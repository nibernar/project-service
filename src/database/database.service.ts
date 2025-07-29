import { Injectable, OnModuleInit, OnModuleDestroy, Logger, Inject } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { ConfigService } from '@nestjs/config';
import { PrismaClient, Prisma } from '@prisma/client';
import { databaseConfig, DatabaseConfig } from '../config/database.config';

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
  configuration: {
    maxConnections: number;
    environment: string;
    sslEnabled: boolean;
  };
}

/**
 * Interface pour le statut de connexion
 */
export interface ConnectionStatus {
  isConnected: boolean;
  responseTime: number;
  lastCheck: Date;
  retryCount: number;
}

/**
 * Options pour les transactions
 */
export interface TransactionOptions {
  timeout?: number;
  isolationLevel?: Prisma.TransactionIsolationLevel;
}

/**
 * Interface pour les métriques de performance
 */
export interface PerformanceMetrics {
  totalQueries: number;
  slowQueries: number;
  avgResponseTime: number;
  connectionPoolUsage: number;
  lastSlowQueryTime?: Date;
}

/**
 * Service central de gestion de la base de données
 * Encapsule Prisma Client avec des fonctionnalités additionnelles
 */
@Injectable()
export class DatabaseService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private isConnected = false;
  private healthMonitoringInterval?: NodeJS.Timeout;
  private retryCount = 0;
  
  // Métriques de santé et performance
  private healthMetrics: DatabaseHealth;
  private performanceMetrics: PerformanceMetrics = {
    totalQueries: 0,
    slowQueries: 0,
    avgResponseTime: 0,
    connectionPoolUsage: 0,
  };
  
  // Cache des temps de réponse pour calcul de moyenne
  private responseTimes: number[] = [];
  private readonly maxResponseTimesSamples = 100;

  constructor(
    @Inject(databaseConfig.KEY) 
    private readonly dbConfig: ConfigType<typeof databaseConfig>,
    private readonly configService: ConfigService
  ) {
    // Validation de la configuration au démarrage
    if (!dbConfig.url) {
      throw new Error('DATABASE_URL is required but not provided in database configuration');
    }

    // Configuration Prisma basée sur notre nouvelle config
    const prismaOptions: Prisma.PrismaClientOptions = {
      datasources: {
        db: {
          url: dbConfig.url,
        },
      },
      // Configuration des logs basée sur la nouvelle config
      log: dbConfig.logging.enabled ? dbConfig.logging.level.map(level => ({
        level: level as Prisma.LogLevel,
        emit: level === 'query' ? 'event' : 'stdout'
      })) : [],
    };

    super(prismaOptions);
    
    // Initialisation des métriques de santé
    this.healthMetrics = {
      status: 'unhealthy',
      responseTime: 0,
      connectionsActive: 0,
      connectionsIdle: 0,
      lastSuccessfulQuery: new Date(),
      errors: {
        count: 0,
      },
      configuration: {
        maxConnections: dbConfig.maxConnections,
        environment: process.env.NODE_ENV || 'development',
        sslEnabled: typeof dbConfig.ssl === 'boolean' ? dbConfig.ssl : dbConfig.ssl.enabled,
      }
    };

    // Configuration du logging des requêtes
    this.setupQueryLogging();
  }

  /**
   * Initialisation du module - connexion à la base de données
   */
  async onModuleInit(): Promise<void> {
    this.logger.log('Initializing database connection...');
    this.logger.debug(`Database config: Max connections: ${this.dbConfig.maxConnections}, SSL: ${typeof this.dbConfig.ssl === 'boolean' ? this.dbConfig.ssl : this.dbConfig.ssl.enabled}`);
    
    try {
      await this.connectWithRetry();
      this.isConnected = true;
      this.healthMetrics.status = 'healthy';
      this.logger.log('Database connection established successfully');
      
      // Démarrage du monitoring si activé
      if (this.dbConfig.health.enableHealthCheck) {
        this.startHealthMonitoring();
      }
      
      // Migration automatique si configurée
      if (this.dbConfig.migration.autoMigrate) {
        await this.runMigrations();
      }
      
      // Seeding automatique si configuré
      if (this.dbConfig.migration.seedOnCreate) {
        await this.seedDatabase();
      }
      
    } catch (error) {
      this.logger.error('Failed to establish database connection', this.sanitizeError(error as Error));
      this.handleConnectionError(error as Error);
      throw new Error(`Failed to connect to database after ${this.dbConfig.retries.maxRetries} attempts`);
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
      
      this.updatePerformanceMetrics(responseTime);
      this.healthMetrics.responseTime = responseTime;
      this.healthMetrics.lastSuccessfulQuery = new Date();
      
      // Utilise le threshold configuré
      const threshold = this.dbConfig.health.healthCheckTimeout;
      const isHealthy = responseTime < threshold;
      
      if (responseTime > threshold * 0.8) {
        this.healthMetrics.status = 'degraded';
      } else {
        this.healthMetrics.status = 'healthy';
      }
      
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
        retryCount: this.retryCount,
      };
    } catch (error) {
      this.logger.error('Connection status check failed', this.sanitizeError(error as Error));
      return {
        isConnected: false,
        responseTime: Date.now() - startTime,
        lastCheck: new Date(),
        retryCount: this.retryCount,
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
   * Obtention des métriques de performance
   */
  getPerformanceMetrics(): PerformanceMetrics {
    return { ...this.performanceMetrics };
  }

  /**
   * Exécution d'une opération dans une transaction
   */
  async withTransaction<T>(
    callback: (tx: Prisma.TransactionClient) => Promise<T>,
    options: TransactionOptions = {},
  ): Promise<T> {
    const transactionOptions = {
      timeout: options.timeout || this.dbConfig.transactionTimeout,
      isolationLevel: options.isolationLevel || Prisma.TransactionIsolationLevel.ReadCommitted,
    };

    try {
      this.logger.debug('Starting transaction');
      const startTime = Date.now();
      
      const result = await this.$transaction(callback, transactionOptions);
      
      const duration = Date.now() - startTime;
      this.updatePerformanceMetrics(duration);
      this.logger.debug('Transaction completed successfully');
      
      return result;
    } catch (error) {
      this.logger.error('Transaction failed', this.sanitizeError(error as Error));
      this.incrementErrorCount(error as Error);
      throw error;
    }
  }

  /**
   * Exécution d'une requête avec retry automatique
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries?: number
  ): Promise<T> {
    const retries = maxRetries || this.dbConfig.retries.maxRetries;
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const startTime = Date.now();
        const result = await operation();
        
        const duration = Date.now() - startTime;
        this.updatePerformanceMetrics(duration);
        
        return result;
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < retries && this.isRetriableError(error as Error)) {
          const delay = this.calculateRetryDelay(attempt);
          this.logger.warn(`Operation failed (attempt ${attempt}/${retries}), retrying in ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          this.incrementErrorCount(error as Error);
          break;
        }
      }
    }
    
    throw lastError || new Error('Operation failed after all retry attempts');
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
   * Seeding de la base de données
   */
  async seedDatabase(): Promise<void> {
    const nodeEnv = this.configService.get('NODE_ENV');
    
    if (nodeEnv !== 'development' && nodeEnv !== 'test') {
      throw new Error('Database seeding is only allowed in development and test environments');
    }

    this.logger.log('Seeding database with test data');
    
    try {
      const seedData = await this.project.createMany({
        data: [
          {
            id: 'seed-project-1',
            name: 'Sample Project 1',
            description: 'A sample project for development',
            initialPrompt: 'Create a web application with React and NestJS',
            ownerId: 'seed-user-1',
            status: 'ACTIVE',
            uploadedFileIds: [],
            generatedFileIds: [],
          },
          {
            id: 'seed-project-2',
            name: 'Sample Project 2',
            description: 'Another sample project for testing',
            initialPrompt: 'Build a mobile application with React Native',
            ownerId: 'seed-user-2',
            status: 'ACTIVE',
            uploadedFileIds: [],
            generatedFileIds: [],
          },
          {
            id: 'seed-project-3',
            name: 'Archived Project',
            description: 'An archived project for testing',
            initialPrompt: 'Create a desktop application',
            ownerId: 'seed-user-1',
            status: 'ARCHIVED',
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
   * Exécution des migrations
   */
  private async runMigrations(): Promise<void> {
    try {
      this.logger.log('Running database migrations...');
      // Note: En production, les migrations doivent être exécutées via CLI
      // Ici c'est principalement pour le développement
      this.logger.log('Migrations completed (handled by Prisma CLI in production)');
    } catch (error) {
      this.logger.error('Migration failed', this.sanitizeError(error as Error));
      throw error;
    }
  }

  /**
   * Connexion avec retry automatique basé sur la configuration
   */
  private async connectWithRetry(): Promise<void> {
    const maxRetries = this.dbConfig.retries.enabled ? this.dbConfig.retries.maxRetries : 1;
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.logger.debug(`Connection attempt ${attempt}/${maxRetries}`);
        
        // Timeout basé sur la configuration
        const connectPromise = this.$connect();
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Connection timeout')), this.dbConfig.connectionTimeout);
        });
        
        await Promise.race([connectPromise, timeoutPromise]);
        
        // Test de la connexion
        await this.$queryRaw`SELECT 1`;
        
        this.retryCount = 0; // Reset le compteur en cas de succès
        this.logger.log('Database connection successful');
        return;
        
      } catch (error) {
        lastError = error as Error;
        this.retryCount = attempt;
        
        this.logger.warn(
          `Connection attempt ${attempt} failed: ${this.sanitizeErrorMessage(error as Error)}`,
        );
        
        if (attempt < maxRetries && this.isRetriableError(error as Error)) {
          const delay = this.calculateRetryDelay(attempt);
          this.logger.debug(`Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    if (lastError) {
      this.logger.error('Final connection error details', lastError);
    }
    
    throw new Error(`Failed to connect to database after ${maxRetries} attempts`);
  }

  /**
   * Calcul du délai de retry basé sur la configuration
   */
  private calculateRetryDelay(attempt: number): number {
    const baseDelay = this.dbConfig.retries.delay;
    const factor = this.dbConfig.retries.factor;
    const maxDelay = this.dbConfig.retries.maxDelay;
    
    const delay = baseDelay * Math.pow(factor, attempt - 1);
    return Math.min(delay, maxDelay);
  }

  /**
   * Déconnexion propre
   */
  private async gracefulDisconnect(): Promise<void> {
    try {
      await this.$disconnect();
    } catch (error) {
      this.logger.error('Error during disconnect', this.sanitizeError(error as Error));
      throw error;
    }
  }

  /**
   * Gestion des erreurs de connexion
   */
  private handleConnectionError(error: Error): void {
    this.incrementErrorCount(error);
    
    const sanitizedMessage = this.sanitizeErrorMessage(error);
    
    if (error.message.includes('ECONNREFUSED')) {
      this.logger.error('Database connection refused - check if PostgreSQL is running');
    } else if (error.message.includes('authentication')) {
      this.logger.error('Database authentication failed - check credentials');
    } else if (error.message.includes('timeout')) {
      this.logger.error('Database connection timeout - check network connectivity');
    } else if (error.message.includes('ssl')) {
      this.logger.error('SSL connection error - check SSL configuration');
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
      'EPIPE',
      'connection terminated unexpectedly',
      'connection timeout',
      'server closed the connection unexpectedly',
    ];
    
    return retriableErrors.some(retryableError =>
      error.message.toLowerCase().includes(retryableError.toLowerCase()),
    );
  }

  /**
   * Mise à jour des métriques de performance
   */
  private updatePerformanceMetrics(responseTime: number): void {
    this.performanceMetrics.totalQueries++;
    
    // Gestion du cache des temps de réponse
    this.responseTimes.push(responseTime);
    if (this.responseTimes.length > this.maxResponseTimesSamples) {
      this.responseTimes.shift();
    }
    
    // Calcul de la moyenne
    this.performanceMetrics.avgResponseTime = 
      this.responseTimes.reduce((sum, time) => sum + time, 0) / this.responseTimes.length;
    
    // Détection des requêtes lentes
    if (responseTime > this.dbConfig.logging.slowQueryThreshold) {
      this.performanceMetrics.slowQueries++;
      this.performanceMetrics.lastSlowQueryTime = new Date();
    }
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
   * Sanitisation des erreurs pour les logs internes
   */
  private sanitizeError(error: Error): any {
    const sensitivePatterns = [
      /password[^:]*:[^@]*/gi,
      /\/\/[^:]+:[^@]+@/gi,
      /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,
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
   * Sanitisation des messages d'erreur pour exposition publique
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
   * Configuration du logging des requêtes basé sur la nouvelle config
   */
  private setupQueryLogging(): void {
    if (this.dbConfig.logging.enabled && this.dbConfig.logging.level.includes('query')) {
      this.$on('query' as never, (e: any) => {
        const duration = e.duration || 0;
        
        if (this.dbConfig.logging.includeParameters) {
          this.logger.debug(`Query: ${e.query}`);
          this.logger.debug(`Params: ${e.params}`);
        }
        
        if (duration > this.dbConfig.logging.slowQueryThreshold) {
          this.logger.warn(`Slow query detected (${duration}ms): ${e.query}`);
        } else {
          this.logger.debug(`Query executed in ${duration}ms`);
        }
      });
    }
  }

  /**
   * Démarrage du monitoring de santé en arrière-plan
   */
  private startHealthMonitoring(): void {
    const interval = this.dbConfig.health.healthCheckInterval;
    
    this.healthMonitoringInterval = setInterval(async () => {
      try {
        await this.isHealthy();
        this.logDatabaseMetrics();
      } catch (error) {
        this.logger.error('Health monitoring error', this.sanitizeError(error as Error));
      }
    }, interval);
    
    this.logger.log(`Health monitoring started with ${interval}ms interval`);
  }

  /**
   * Log des métriques de base de données
   */
  private logDatabaseMetrics(): void {
    const health = this.getHealthMetrics();
    const performance = this.getPerformanceMetrics();
    
    this.logger.log(
      `DB Health: ${health.status}, Response: ${health.responseTime}ms, ` +
      `Queries: ${performance.totalQueries}, Slow: ${performance.slowQueries}, ` +
      `Avg: ${Math.round(performance.avgResponseTime)}ms, Errors: ${health.errors.count}`,
    );
    
    // Alertes basées sur les seuils configurés
    if (health.status === 'degraded') {
      this.logger.warn('Database performance is degraded');
    } else if (health.status === 'unhealthy') {
      this.logger.error('Database is unhealthy');
    }
    
    // Alerte si trop de requêtes lentes
    const slowQueryRatio = performance.totalQueries > 0 ? 
      performance.slowQueries / performance.totalQueries : 0;
    
    if (slowQueryRatio > 0.1) { // Plus de 10% de requêtes lentes
      this.logger.warn(`High slow query ratio: ${Math.round(slowQueryRatio * 100)}%`);
    }
  }
}