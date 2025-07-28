import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient, Prisma } from '@prisma/client';

/**
 * Interface pour le statut de santé de la base de données
 */
export interface DatabaseHealth {
  status: 'healthy' | 'unhealthy' | 'degraded';
  responseTime: number;
  connectionsActive: number;
  connectionsIdle: number;
  lastSuccessfulQuery: Date;
  errors: {
    count: number;
    lastError?: string;
    lastErrorTime?: Date;
  };
}

/**
 * Interface pour le statut de connexion
 */
export interface ConnectionStatus {
  isConnected: boolean;
  responseTime: number;
  lastCheck: Date;
}

/**
 * Options pour les transactions
 */
export interface TransactionOptions {
  timeout?: number;
  isolationLevel?: Prisma.TransactionIsolationLevel;
}

/**
 * Service central de gestion de la base de données
 * Encapsule Prisma Client avec des fonctionnalités additionnelles
 */
@Injectable()
export class DatabaseService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private isConnected = false;
  private readonly maxRetries = 3;
  private readonly retryDelay = 1000; // 1 seconde
  private healthMonitoringInterval?: NodeJS.Timeout;
  
  // Métriques de santé
  private healthMetrics: DatabaseHealth = {
    status: 'unhealthy',
    responseTime: 0,
    connectionsActive: 0,
    connectionsIdle: 0,
    lastSuccessfulQuery: new Date(),
    errors: {
      count: 0,
    },
  };

  constructor(private readonly configService: ConfigService) {
    const databaseUrl = configService.get<string>('DATABASE_URL');
    const nodeEnv = configService.get<string>('NODE_ENV', 'development');
    
    if (!databaseUrl) {
      throw new Error('DATABASE_URL is required but not provided');
    }

    // Configuration Prisma selon l'environnement
    const prismaOptions: Prisma.PrismaClientOptions = {
      datasources: {
        db: {
          url: databaseUrl,
        },
      },
    };

    // Configuration des logs selon l'environnement
    if (nodeEnv === 'development') {
      prismaOptions.log = [
        { level: 'query', emit: 'event' },
        { level: 'error', emit: 'stdout' },
        { level: 'info', emit: 'stdout' },
        { level: 'warn', emit: 'stdout' },
      ];
    } else if (nodeEnv === 'test') {
      prismaOptions.log = [
        { level: 'error', emit: 'stdout' },
      ];
    } else {
      // Production
      prismaOptions.log = [
        { level: 'error', emit: 'stdout' },
        { level: 'warn', emit: 'stdout' },
      ];
    }

    super(prismaOptions);

    // Configuration du logging des requêtes
    this.setupQueryLogging();
  }

  /**
   * Initialisation du module - connexion à la base de données
   */
  async onModuleInit(): Promise<void> {
    this.logger.log('Initializing database connection...');
    
    try {
      await this.connectWithRetry();
      this.isConnected = true;
      this.healthMetrics.status = 'healthy';
      this.logger.log('Database connection established successfully');
      
      // Démarrage du monitoring en production
      if (this.configService.get('NODE_ENV') === 'production') {
        this.startHealthMonitoring();
      }
    } catch (error) {
      this.logger.error('Failed to establish database connection', this.sanitizeError(error as Error));
      this.handleConnectionError(error as Error);
      throw new Error(`Failed to connect to database after ${this.maxRetries} attempts`);
    }
  }

  /**
   * Destruction du module - fermeture propre de la connexion
   */
  async onModuleDestroy(): Promise<void> {
    this.logger.log('Closing database connection...');
    
    // Arrêter le monitoring
    if (this.healthMonitoringInterval) {
      clearInterval(this.healthMonitoringInterval);
      this.healthMonitoringInterval = undefined;
    }
    
    try {
      await this.gracefulDisconnect();
      this.isConnected = false;
      this.logger.log('Database connection closed');
    } catch (error) {
      this.logger.error('Error during disconnect', this.sanitizeError(error as Error));
      // Ne pas lancer d'erreur lors du teardown
    }
  }

  /**
   * Vérification simple de la santé de la base de données
   */
  async isHealthy(): Promise<boolean> {
    try {
      const startTime = Date.now();
      await this.$queryRaw`SELECT 1`;
      const responseTime = Date.now() - startTime;
      
      this.healthMetrics.responseTime = responseTime;
      this.healthMetrics.lastSuccessfulQuery = new Date();
      
      // Considéré comme sain si réponse < 5000ms
      const isHealthy = responseTime < 5000;
      this.healthMetrics.status = isHealthy ? 'healthy' : 'degraded';
      
      return isHealthy;
    } catch (error) {
      this.logger.error('Health check failed', this.sanitizeError(error as Error));
      this.incrementErrorCount(error as Error);
      this.healthMetrics.status = 'unhealthy';
      return false;
    }
  }

  /**
   * Obtention du statut détaillé de la connexion
   */
  async getConnectionStatus(): Promise<ConnectionStatus> {
    const startTime = Date.now();
    
    try {
      await this.$queryRaw`SELECT 1`;
      const responseTime = Date.now() - startTime;
      
      return {
        isConnected: true,
        responseTime,
        lastCheck: new Date(),
      };
    } catch (error) {
      this.logger.error('Connection status check failed', this.sanitizeError(error as Error));
      return {
        isConnected: false,
        responseTime: Date.now() - startTime,
        lastCheck: new Date(),
      };
    }
  }

  /**
   * Obtention des métriques de santé détaillées
   */
  getHealthMetrics(): DatabaseHealth {
    return { ...this.healthMetrics };
  }

  /**
   * Exécution d'une opération dans une transaction
   */
  async withTransaction<T>(
    callback: (tx: Prisma.TransactionClient) => Promise<T>,
    options: TransactionOptions = {},
  ): Promise<T> {
    const transactionOptions = {
      // ✅ CORRECTION: Forcer la conversion en number
      timeout: options.timeout || parseInt(this.configService.get('DB_TRANSACTION_TIMEOUT', '10000'), 10),
      isolationLevel: options.isolationLevel || Prisma.TransactionIsolationLevel.ReadCommitted,
    };

    try {
      this.logger.debug('Starting transaction');
      const result = await this.$transaction(callback, transactionOptions);
      this.logger.debug('Transaction completed successfully');
      return result;
    } catch (error) {
      this.logger.error('Transaction failed', this.sanitizeError(error as Error));
      this.incrementErrorCount(error as Error);
      throw error;
    }
  }

  /**
   * Réinitialisation de la base de données (uniquement en test)
   */
  async resetDatabase(): Promise<void> {
    const nodeEnv = this.configService.get('NODE_ENV');
    
    if (nodeEnv !== 'test') {
      throw new Error('Database reset is only allowed in test environment');
    }

    this.logger.warn('Resetting database - TEST ENVIRONMENT ONLY');
    
    try {
      // ✅ CORRECTION: Typage explicite du paramètre tx
      await this.$transaction(async (tx: Prisma.TransactionClient) => {
        // Suppression de toutes les données dans l'ordre inverse des dépendances
        await tx.projectStatistics.deleteMany();
        await tx.project.deleteMany();
      });
      
      this.logger.log('Database reset completed');
    } catch (error) {
      this.logger.error('Database reset failed', this.sanitizeError(error as Error));
      throw error;
    }
  }

  /**
   * Seeding de la base de données (uniquement en développement et test)
   */
  async seedDatabase(): Promise<void> {
    const nodeEnv = this.configService.get('NODE_ENV');
    
    // ✅ CORRECTION: Validation stricte
    if (nodeEnv !== 'development' && nodeEnv !== 'test') {
      throw new Error('Database seeding is only allowed in development and test environments');
    }

    this.logger.log('Seeding database with test data');
    
    try {
      // Exemple de données de seed - à adapter selon les besoins
      const seedData = await this.project.createMany({
        data: [
          {
            id: 'seed-project-1',
            name: 'Sample Project 1',
            description: 'A sample project for development',
            initialPrompt: 'Create a web application',
            ownerId: 'seed-user-1',
            status: 'ACTIVE',
            uploadedFileIds: [],
            generatedFileIds: [],
          },
          {
            id: 'seed-project-2',
            name: 'Sample Project 2',
            description: 'Another sample project',
            initialPrompt: 'Build a mobile app',
            ownerId: 'seed-user-2',
            status: 'ACTIVE',
            uploadedFileIds: [],
            generatedFileIds: [],
          },
        ],
        skipDuplicates: true,
      });
      
      this.logger.log(`Database seeded with ${seedData.count} projects`);
    } catch (error) {
      this.logger.error('Database seeding failed', this.sanitizeError(error as Error));
      throw error;
    }
  }

  /**
   * Connexion avec retry automatique
   */
  private async connectWithRetry(): Promise<void> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        this.logger.debug(`Connection attempt ${attempt}/${this.maxRetries}`);
        await this.$connect();
        
        // Test de la connexion
        await this.$queryRaw`SELECT 1`;
        
        this.logger.log('Database connection successful');
        return;
      } catch (error) {
        lastError = error as Error;
        this.logger.warn(
          `Connection attempt ${attempt} failed: ${this.sanitizeErrorMessage(error as Error)}`,
        );
        
        if (attempt < this.maxRetries && this.isRetriableError(error as Error)) {
          const delay = this.retryDelay * Math.pow(2, attempt - 1); // Backoff exponentiel
          this.logger.debug(`Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    // ✅ CORRECTION: Log l'erreur complète mais ne l'expose pas
    if (lastError) {
      this.logger.error('Final connection error details', lastError);
    }
    
    throw new Error(`Failed to connect to database after ${this.maxRetries} attempts`);
  }

  /**
   * Déconnexion propre
   */
  private async gracefulDisconnect(): Promise<void> {
    try {
      await this.$disconnect();
    } catch (error) {
      this.logger.error('Error during disconnect', this.sanitizeError(error as Error));
      // Re-throw pour permettre une gestion d'erreur appropriée
      throw error;
    }
  }

  /**
   * Gestion des erreurs de connexion
   */
  private handleConnectionError(error: Error): void {
    this.incrementErrorCount(error);
    
    // Log différent selon le type d'erreur (mais sans exposer d'infos sensibles)
    const sanitizedMessage = this.sanitizeErrorMessage(error);
    
    if (error.message.includes('ECONNREFUSED')) {
      this.logger.error('Database connection refused - check if PostgreSQL is running');
    } else if (error.message.includes('authentication')) {
      this.logger.error('Database authentication failed - check credentials');
    } else if (error.message.includes('timeout')) {
      this.logger.error('Database connection timeout - check network connectivity');
    } else {
      this.logger.error(`Database connection error: ${sanitizedMessage}`);
    }
  }

  /**
   * Vérification si une erreur est "retry-able"
   */
  private isRetriableError(error: Error): boolean {
    const retriableErrors = [
      'ECONNREFUSED',
      'ENOTFOUND',
      'ETIMEDOUT',
      'ECONNRESET',
      'connection terminated unexpectedly',
    ];
    
    return retriableErrors.some(retryableError =>
      error.message.toLowerCase().includes(retryableError.toLowerCase()),
    );
  }

  /**
   * Incrémentation du compteur d'erreurs
   */
  private incrementErrorCount(error: Error): void {
    this.healthMetrics.errors.count++;
    this.healthMetrics.errors.lastError = this.sanitizeErrorMessage(error);
    this.healthMetrics.errors.lastErrorTime = new Date();
  }

  /**
   * ✅ NOUVEAU : Sanitisation des erreurs pour éviter l'information disclosure
   */
  private sanitizeError(error: Error): any {
    // Pour les logs internes, on garde l'erreur complète mais on retire les infos sensibles
    const sensitivePatterns = [
      /password[^:]*:[^@]*/gi,
      /\/\/[^:]+:[^@]+@/gi,
      /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, // IP addresses
    ];
    
    let sanitizedMessage = error.message;
    sensitivePatterns.forEach(pattern => {
      sanitizedMessage = sanitizedMessage.replace(pattern, '***');
    });
    
    return {
      ...error,
      message: sanitizedMessage,
    };
  }

  /**
   * ✅ NOUVEAU : Sanitisation des messages d'erreur pour exposition publique
   */
  private sanitizeErrorMessage(error: Error): string {
    const sensitivePatterns = [
      /password[^:]*:[^@]*/gi,
      /\/\/[^:]+:[^@]+@/gi,
      /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,
      /user\s+"[^"]+"/gi,
      /for\s+user\s+"[^"]+"/gi,
    ];
    
    let sanitizedMessage = error.message;
    sensitivePatterns.forEach(pattern => {
      sanitizedMessage = sanitizedMessage.replace(pattern, '***');
    });
    
    return sanitizedMessage;
  }

  /**
   * Configuration du logging des requêtes
   */
  private setupQueryLogging(): void {
    const nodeEnv = this.configService.get('NODE_ENV');
    
    if (nodeEnv === 'development') {
      this.$on('query' as never, (e: any) => {
        this.logger.debug(`Query: ${e.query}`);
        this.logger.debug(`Params: ${e.params}`);
        this.logger.debug(`Duration: ${e.duration}ms`);
      });
    }

    // Log des requêtes lentes en production
    if (nodeEnv === 'production') {
      this.$on('query' as never, (e: any) => {
        if (e.duration > 1000) { // Plus de 1 seconde
          this.logger.warn(`Slow query detected (${e.duration}ms): ${e.query}`);
        }
      });
    }
  }

  /**
   * Démarrage du monitoring de santé en arrière-plan
   */
  private startHealthMonitoring(): void {
    // Monitoring toutes les 30 secondes
    this.healthMonitoringInterval = setInterval(async () => {
      try {
        await this.isHealthy();
        this.logDatabaseMetrics();
      } catch (error) {
        this.logger.error('Health monitoring error', this.sanitizeError(error as Error));
      }
    }, 30000);
  }

  /**
   * Log des métriques de base de données
   */
  private logDatabaseMetrics(): void {
    const metrics = this.getHealthMetrics();
    
    this.logger.log(
      `DB Health: ${metrics.status}, Response: ${metrics.responseTime}ms, Errors: ${metrics.errors.count}`,
    );
    
    // Alerte si dégradé
    if (metrics.status === 'degraded') {
      this.logger.warn('Database performance is degraded');
    } else if (metrics.status === 'unhealthy') {
      this.logger.error('Database is unhealthy');
    }
  }
}