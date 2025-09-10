import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { DatabaseService } from '../database/database.service';
import { CacheService } from '../cache/cache.service';
import { firstValueFrom } from 'rxjs';
import { timeout } from 'rxjs/operators';

// Types et interfaces
export type HealthStatus = 'up' | 'down';
export type GlobalHealthStatus = 'healthy' | 'unhealthy';

export interface HealthCheck {
  status: HealthStatus;
  responseTime: number;
  error?: string;
  details?: Record<string, any>;
}

export interface ServiceHealthCheck extends HealthCheck {
  serviceName: string;
  endpoint?: string;
  version?: string;
}

export interface DetailedHealthStatus {
  status: GlobalHealthStatus;
  timestamp: Date;
  uptime: number;
  checks: {
    database: HealthCheck;
    cache: HealthCheck;
    externalServices: Record<string, ServiceHealthCheck>;
  };
  metadata: {
    serviceName: string;
    version: string;
    environment: string;
  };
}

export interface HealthServiceConfig {
  database: {
    timeoutMs: number;
    maxRetries: number;
  };
  cache: {
    timeoutMs: number;
    testKey: string;
  };
  externalServices: {
    [serviceName: string]: {
      url: string;
      endpoint: string;
      timeoutMs: number;
      enabled: boolean;
    };
  };
  global: {
    unhealthyThresholdMs: number;
    startupTime: Date;
  };
}

// Classes d'erreur spécialisées
export class DatabaseHealthError extends Error {
  constructor(
    message: string,
    public readonly originalError: Error,
    public readonly responseTime: number
  ) {
    super(message);
    this.name = 'DatabaseHealthError';
  }
}

export class CacheHealthError extends Error {
  constructor(
    message: string,
    public readonly originalError: Error,
    public readonly responseTime: number
  ) {
    super(message);
    this.name = 'CacheHealthError';
  }
}

export class ExternalServiceHealthError extends Error {
  constructor(
    message: string,
    public readonly serviceName: string,
    public readonly statusCode?: number,
    public readonly responseTime?: number
  ) {
    super(message);
    this.name = 'ExternalServiceHealthError';
  }
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  private readonly startupTime: Date;
  private readonly config: HealthServiceConfig;

  constructor(
    private readonly db: DatabaseService,
    private readonly cacheService: CacheService,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.startupTime = new Date();
    this.config = this.buildHealthConfig();
  }

  /**
   * Vérifier la santé de la base de données PostgreSQL
   */
  async checkDatabase(): Promise<HealthCheck> {
    const startTime = Date.now();
    
    try {
      this.logger.debug('Starting database health check');
      
      // Créer une promesse avec timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Database check timeout after ${this.config.database.timeoutMs}ms`)), this.config.database.timeoutMs);
      });

      // Test simple de connectivité avec une requête basique
      const checkPromise = this.db.$queryRaw<[{ result: number }]>`SELECT 1 as result`;
      
      const result = await Promise.race([checkPromise, timeoutPromise]);
      const responseTime = Date.now() - startTime;
      
      this.logger.debug(`Database health check succeeded in ${responseTime}ms`);
      
      return {
        status: 'up',
        responseTime,
        details: { queryResult: result[0]?.result },
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      this.logger.warn(`Database health check failed in ${responseTime}ms: ${errorMessage}`);
      
      return {
        status: 'down',
        responseTime,
        error: errorMessage,
      };
    }
  }

  /**
   * Vérifier la santé du cache Redis
   */
  async checkCache(): Promise<HealthCheck> {
    const startTime = Date.now();
    
    try {
      this.logger.debug('Starting cache health check');
      
      // Créer une promesse avec timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Cache check timeout after ${this.config.cache.timeoutMs}ms`)), this.config.cache.timeoutMs);
      });

      const testKey = this.config.cache.testKey;
      const testValue = `health-check-${Date.now()}`;
      
      // Test SET/GET pour vérifier la fonctionnalité complète
      const checkPromise = async () => {
        await this.cacheService.set(testKey, testValue, 60);
        const retrievedValue = await this.cacheService.get<string>(testKey);
        await this.cacheService.del(testKey);
        return retrievedValue === testValue;
      };
      
      const isWorking = await Promise.race([checkPromise(), timeoutPromise]);
      const responseTime = Date.now() - startTime;
      
      this.logger.debug(`Cache health check succeeded in ${responseTime}ms`);
      
      return {
        status: 'up',
        responseTime,
        details: { 
          testSuccessful: isWorking,
          testKey,
          testValue: isWorking ? testValue : null
        },
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      this.logger.warn(`Cache health check failed in ${responseTime}ms: ${errorMessage}`);
      
      return {
        status: 'down',
        responseTime,
        error: errorMessage,
      };
    }
  }

  /**
   * Vérifier la santé des services externes
   */
  async checkExternalServices(): Promise<Record<string, ServiceHealthCheck>> {
    const results: Record<string, ServiceHealthCheck> = {};
    const services = this.config.externalServices;

    // Exécuter tous les checks en parallèle
    const promises = Object.entries(services)
      .filter(([_, config]) => config.enabled)
      .map(async ([serviceName, config]) => {
        const result = await this.callExternalService(serviceName, config);
        return { serviceName, result };
      });

    const settledPromises = await Promise.allSettled(promises);

    settledPromises.forEach((promise, index) => {
      const serviceName = Object.keys(services).filter(name => services[name].enabled)[index];
      
      if (promise.status === 'fulfilled') {
        results[serviceName] = promise.value.result;
      } else {
        // En cas d'échec de la promesse elle-même
        results[serviceName] = {
          serviceName,
          status: 'down',
          responseTime: 0,
          error: `Service check failed: ${promise.reason}`,
        };
      }
    });

    return results;
  }

  /**
   * Fournir un état de santé complet du service
   */
  async getDetailedStatus(): Promise<DetailedHealthStatus> {
    this.logger.debug('Starting detailed health status check');

    // Exécuter tous les checks en parallèle pour optimiser le temps de réponse
    const [databaseCheck, cacheCheck, externalServicesCheck] = await Promise.allSettled([
      this.checkDatabase(),
      this.checkCache(),
      this.checkExternalServices(),
    ]);

    // Traiter les résultats en gérant les échecs gracieusement
    const database: HealthCheck = databaseCheck.status === 'fulfilled' 
      ? databaseCheck.value 
      : { status: 'down', responseTime: 0, error: 'Database check failed' };

    const cache: HealthCheck = cacheCheck.status === 'fulfilled'
      ? cacheCheck.value
      : { status: 'down', responseTime: 0, error: 'Cache check failed' };

    const externalServices = externalServicesCheck.status === 'fulfilled'
      ? externalServicesCheck.value
      : {};

    const checks = { database, cache, externalServices };
    const globalStatus = this.determineGlobalStatus(checks);
    const uptime = this.getUptime();

    const result: DetailedHealthStatus = {
      status: globalStatus,
      timestamp: new Date(),
      uptime,
      checks,
      metadata: this.buildMetadata(),
    };

    this.logger.debug(`Health check completed: ${globalStatus} (uptime: ${uptime}s)`);
    
    if (globalStatus === 'unhealthy') {
      this.logger.warn('Service is unhealthy', { checks: result.checks });
    }

    return result;
  }

  /**
   * Vérification rapide de santé pour les load balancers
   */
  async isHealthy(): Promise<boolean> {
    try {
      // Ne vérifier que les composants critiques pour une réponse rapide
      const [dbResult, cacheResult] = await Promise.allSettled([
        this.checkDatabase(),
        this.checkCache(),
      ]);

      const dbHealthy = dbResult.status === 'fulfilled' && dbResult.value.status === 'up';
      const cacheHealthy = cacheResult.status === 'fulfilled' && cacheResult.value.status === 'up';

      return dbHealthy && cacheHealthy;
    } catch (error) {
      this.logger.error('Error in quick health check', error);
      return false;
    }
  }

  /**
   * Calculer l'uptime en secondes depuis le démarrage
   */
  getUptime(): number {
    return Math.floor((Date.now() - this.startupTime.getTime()) / 1000);
  }

  /**
   * Appeler un service externe et analyser sa réponse
   */
  private async callExternalService(
    serviceName: string,
    config: { url: string; endpoint: string; timeoutMs: number }
  ): Promise<ServiceHealthCheck> {
    const startTime = Date.now();
    const fullUrl = `${config.url}${config.endpoint}`;

    try {
      this.logger.debug(`Checking external service: ${serviceName} at ${fullUrl}`);

      const response$ = this.httpService.get(fullUrl).pipe(
        timeout(config.timeoutMs)
      );

      const response = await firstValueFrom(response$);
      const responseTime = Date.now() - startTime;

      if (response.status >= 400) {
        return {
          serviceName,
          status: 'down',
          responseTime,
          error: `HTTP ${response.status}: ${response.statusText}`,
          endpoint: fullUrl,
        };
      }

      // Tenter d'extraire la version si disponible
      const version = response.data?.version || response.data?.info?.version || 'unknown';

      return {
        serviceName,
        status: 'up',
        responseTime,
        endpoint: fullUrl,
        version: version,
        details: {
          statusCode: response.status,
          hasData: !!response.data,
        },
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      let errorMessage = 'Unknown error';
      let statusCode: number | undefined;

      if (error?.response) {
        // Erreur HTTP avec réponse
        statusCode = error.response.status;
        errorMessage = `HTTP ${statusCode}: ${error.response.statusText || error.message}`;
      } else if (error instanceof Error) {
        // Erreur de timeout ou réseau
        errorMessage = error.message;
      }

      this.logger.warn(`External service ${serviceName} check failed: ${errorMessage}`);

      return {
        serviceName,
        status: 'down',
        responseTime,
        error: errorMessage,
        endpoint: fullUrl,
      };
    }
  }

  /**
   * Calculer le status global basé sur les checks individuels
   */
  private determineGlobalStatus(checks: {
    database: HealthCheck;
    cache: HealthCheck;
    externalServices: Record<string, ServiceHealthCheck>;
  }): GlobalHealthStatus {
    // Les services critiques (DB et Cache) doivent être 'up'
    const criticalServicesUp = checks.database.status === 'up' && checks.cache.status === 'up';

    if (!criticalServicesUp) {
      return 'unhealthy';
    }

    // Pour les services externes, nous sommes plus tolérants
    // Le service peut être 'healthy' même si certains services externes sont down
    const externalServicesValues = Object.values(checks.externalServices);
    const externalServicesDown = externalServicesValues.filter(service => service.status === 'down').length;
    const totalExternalServices = externalServicesValues.length;

    // Si plus de 50% des services externes sont down, considérer comme unhealthy
    if (totalExternalServices > 0 && externalServicesDown > totalExternalServices / 2) {
      this.logger.warn(`Too many external services are down: ${externalServicesDown}/${totalExternalServices}`);
      return 'unhealthy';
    }

    return 'healthy';
  }

  /**
   * Construire les métadonnées du service
   */
  private buildMetadata(): { serviceName: string; version: string; environment: string } {
    return {
      serviceName: 'project-service',
      version: this.configService.get('app.version', '1.0.0'),
      environment: this.configService.get('app.nodeEnv', 'development'),
    };
  }

  /**
   * Construire la configuration du service de santé
   */
  private buildHealthConfig(): HealthServiceConfig {
    return {
      database: {
        timeoutMs: this.configService.get<number>('DB_HEALTH_TIMEOUT_MS', 5000),
        maxRetries: this.configService.get<number>('DB_HEALTH_MAX_RETRIES', 2),
      },
      cache: {
        timeoutMs: this.configService.get<number>('CACHE_HEALTH_TIMEOUT_MS', 3000),
        testKey: this.configService.get<string>('CACHE_HEALTH_TEST_KEY', 'health:test'),
      },
      externalServices: {
        storageService: {
          url: this.configService.get<string>('STORAGE_SERVICE_HEALTH_URL', ''),
          endpoint: '/health',
          timeoutMs: 5000,
          enabled: this.configService.get<string>('STORAGE_SERVICE_HEALTH_ENABLED', 'false') === 'true',
        },
        orchestrationService: {
          url: this.configService.get<string>('ORCHESTRATION_SERVICE_HEALTH_URL', ''),
          endpoint: '/health',
          timeoutMs: 5000,
          enabled: this.configService.get<string>('ORCHESTRATION_SERVICE_HEALTH_ENABLED', 'false') === 'true',
        },
        authService: {
          url: this.configService.get<string>('AUTH_SERVICE_HEALTH_URL', ''),
          endpoint: '/health',
          timeoutMs: 3000,
          enabled: this.configService.get<string>('AUTH_SERVICE_HEALTH_ENABLED', 'false') === 'true',
        },
      },
      global: {
        unhealthyThresholdMs: this.configService.get<number>('HEALTH_UNHEALTHY_THRESHOLD_MS', 10000),
        startupTime: this.startupTime,
      },
    };
  }
}