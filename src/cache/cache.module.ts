// src/cache/cache.module.ts
import { Global, Module, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisModule } from '@nestjs-modules/ioredis';
import type { RedisModuleOptions } from '@nestjs-modules/ioredis';
import { CacheService } from './cache.service';
import { DEFAULT_CACHE_CONFIG } from './cache-keys.constants';

// ============================================================================
// CONFIGURATION REDIS PAR ENVIRONNEMENT
// ============================================================================

/**
 * Génère la configuration Redis optimisée selon l'environnement
 */
function getRedisConfiguration(configService: ConfigService): RedisModuleOptions {
  const logger = new Logger('CacheModule');
  const env = configService.get('NODE_ENV', 'development');
  
  // Configuration de base
  const baseConfig = {
    host: configService.get('REDIS_HOST', 'localhost'),
    port: parseInt(configService.get('REDIS_PORT', '6379'), 10),
    password: configService.get('REDIS_PASSWORD'),
    username: configService.get('REDIS_USERNAME'),
    db: parseInt(configService.get('REDIS_DB', '0'), 10),
    keyPrefix: configService.get('REDIS_KEY_PREFIX', DEFAULT_CACHE_CONFIG.DEFAULT_PREFIX) + ':',
  };

  // Configuration par environnement
  const environmentConfigs = {
    production: {
      ...baseConfig,
      // Configuration production - priorité à la fiabilité
      connectTimeout: 15000,
      commandTimeout: 10000,
      lazyConnect: false, // Connexion immédiate en production
      maxRetriesPerRequest: 5,
      retryDelayOnFailover: 200,
      enableReadyCheck: true,
      // Pool de connexions optimisé
      family: 4, // IPv4 pour la stabilité
      keepAlive: 30000,
      // Monitoring renforcé
      enableOfflineQueue: true,
    },
    
    staging: {
      ...baseConfig,
      // Configuration staging - équilibre performance/fiabilité
      connectTimeout: 10000,
      commandTimeout: 8000,
      lazyConnect: true,
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 150,
      enableReadyCheck: true,
      family: 4,
      keepAlive: 20000,
      enableOfflineQueue: true,
    },
    
    test: {
      ...baseConfig,
      // Configuration test - priorité à la rapidité
      connectTimeout: 2000,
      commandTimeout: 1000,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      retryDelayOnFailover: 50,
      enableReadyCheck: false,
      family: 4,
      keepAlive: 5000,
      enableOfflineQueue: false,
    },
    
    development: {
      ...baseConfig,
      // Configuration développement - équilibrée avec logging
      connectTimeout: 5000,
      commandTimeout: 5000,
      lazyConnect: true,
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
      enableReadyCheck: true,
      family: 4,
      keepAlive: 15000,
      enableOfflineQueue: true,
    },
  };

  const config = environmentConfigs[env as keyof typeof environmentConfigs] || environmentConfigs.development;
  
  // Configuration TLS pour la production
  if (env === 'production' && configService.get('REDIS_TLS_ENABLED', false)) {
    (config as any).tls = {
      rejectUnauthorized: configService.get('REDIS_TLS_REJECT_UNAUTHORIZED', true),
      ca: configService.get('REDIS_TLS_CA'),
      cert: configService.get('REDIS_TLS_CERT'),
      key: configService.get('REDIS_TLS_KEY'),
    };
  }

  // Validation de la configuration
  if (!config.host || !config.port) {
    logger.error('Invalid Redis configuration: host and port are required');
    throw new Error('Redis configuration error: missing host or port');
  }

  // Logging de la configuration (sans les informations sensibles)
  logger.log(`Redis configuration for ${env}:`);
  logger.log(`  Host: ${config.host}:${config.port}`);
  logger.log(`  Database: ${config.db}`);
  logger.log(`  Key Prefix: ${config.keyPrefix}`);
  logger.log(`  Connection Timeout: ${config.connectTimeout}ms`);
  logger.log(`  Command Timeout: ${config.commandTimeout}ms`);
  logger.log(`  Max Retries: ${config.maxRetriesPerRequest}`);
  logger.log(`  Lazy Connect: ${config.lazyConnect}`);
  
  if (config.password) {
    logger.log('  Authentication: enabled');
  }
  
  if ((config as any).tls) {
    logger.log('  TLS: enabled');
  }

  return {
    type: 'single',
    options: config,
  };
}

// ============================================================================
// HEALTH CHECK PROVIDER (OPTIONNEL)
// ============================================================================

/**
 * Provider pour les health checks Redis
 * À utiliser si le module @nestjs/terminus est installé
 */
/*
@Injectable()
export class CacheHealthIndicator extends HealthIndicator {
  constructor(private readonly cacheService: CacheService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      const isHealthy = await this.cacheService.healthCheck();
      const result = this.getStatus(key, isHealthy, { 
        status: isHealthy ? 'up' : 'down' 
      });

      if (isHealthy) {
        return result;
      }
      
      throw new HealthCheckError('Redis health check failed', result);
    } catch (error) {
      const result = this.getStatus(key, false, { 
        status: 'down',
        error: error.message 
      });
      throw new HealthCheckError('Redis health check failed', result);
    }
  }
}
*/

// ============================================================================
// LOGGER DE MODULE
// ============================================================================

/**
 * Logger spécialisé pour le module de cache
 */
class CacheModuleLogger {
  private readonly logger = new Logger('CacheModule');

  onModuleInit(): void {
    this.logger.log('CacheModule initialized successfully');
    this.logger.debug('Redis connection pool created');
  }

  onModuleDestroy(): void {
    this.logger.log('CacheModule shutting down');
    this.logger.debug('Redis connection pool destroyed');
  }

  logConnectionEvent(event: 'connect' | 'ready' | 'error' | 'close', details?: any): void {
    switch (event) {
      case 'connect':
        this.logger.log('Redis connection established');
        break;
      case 'ready':
        this.logger.log('Redis client ready for commands');
        break;
      case 'error':
        this.logger.error('Redis connection error:', details);
        break;
      case 'close':
        this.logger.warn('Redis connection closed');
        break;
    }
  }
}

// ============================================================================
// MODULE PRINCIPAL
// ============================================================================

/**
 * Module Cache global pour la gestion de Redis
 * 
 * Ce module configure Redis de manière optimisée selon l'environnement
 * et expose le CacheService dans toute l'application.
 * 
 * Variables d'environnement supportées:
 * - REDIS_HOST (défaut: localhost)
 * - REDIS_PORT (défaut: 6379)
 * - REDIS_PASSWORD (optionnel)
 * - REDIS_USERNAME (optionnel)
 * - REDIS_DB (défaut: 0)
 * - REDIS_KEY_PREFIX (défaut: project-service)
 * - REDIS_TLS_ENABLED (défaut: false, production seulement)
 * - REDIS_TLS_REJECT_UNAUTHORIZED (défaut: true)
 * - REDIS_TLS_CA (certificat CA pour TLS)
 * - REDIS_TLS_CERT (certificat client pour TLS)
 * - REDIS_TLS_KEY (clé privée pour TLS)
 */
@Global()
@Module({
  imports: [
    RedisModule.forRootAsync({
      useFactory: getRedisConfiguration,
      inject: [ConfigService],
    }),
  ],
  providers: [
    CacheService,
    CacheModuleLogger,
    // Décommentez si vous utilisez @nestjs/terminus pour les health checks
    // CacheHealthIndicator,
  ],
  exports: [
    CacheService,
    // CacheHealthIndicator,
  ],
})
export class CacheModule {
  private readonly logger = new Logger(CacheModule.name);

  constructor(
    private readonly cacheService: CacheService,
    private readonly moduleLogger: CacheModuleLogger,
  ) {}

  /**
   * Initialisation du module
   */
  async onModuleInit(): Promise<void> {
    this.moduleLogger.onModuleInit();
    
    // Test de connexion initial en développement
    if (process.env.NODE_ENV === 'development') {
      try {
        const isHealthy = await this.cacheService.healthCheck();
        if (isHealthy) {
          this.logger.log('Initial Redis connection test: SUCCESS');
        } else {
          this.logger.warn('Initial Redis connection test: FAILED');
        }
      } catch (error) {
        this.logger.error('Initial Redis connection test error:', error.message);
      }
    }
  }

  /**
   * Nettoyage lors de la destruction du module
   */
  async onModuleDestroy(): Promise<void> {
    this.moduleLogger.onModuleDestroy();
    
    try {
      await this.cacheService.disconnect();
      this.logger.log('Redis connections closed gracefully');
    } catch (error) {
      this.logger.error('Error during Redis disconnection:', error.message);
    }
  }
}

// ============================================================================
// EXPORTS POUR FACILITER L'UTILISATION
// ============================================================================

export { CacheService } from './cache.service';
export { CacheModuleLogger };
// export { CacheHealthIndicator }; // Si health checks utilisés