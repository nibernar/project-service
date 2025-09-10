// src/cache/cache.module.ts - Configuration progressive avec les options vraiment utiles
import { Global, Module, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisModule } from '@nestjs-modules/ioredis';
import type { RedisModuleOptions } from '@nestjs-modules/ioredis';
import { CacheService } from './cache.service';

/**
 * Configuration Redis progressive par environnement
 * Réintroduit les options utiles sans over-engineering
 */
function getRedisConfiguration(configService: ConfigService): RedisModuleOptions {
  const logger = new Logger('CacheModule');
  const env = configService.get('NODE_ENV', 'development');
  
  // Configuration de base (qui fonctionne)
  const baseConfig = {
    host: configService.get('REDIS_HOST', 'localhost'),
    port: parseInt(configService.get('REDIS_PORT', '6379'), 10),
    db: parseInt(configService.get('REDIS_DB', '0'), 10),
    password: configService.get('REDIS_PASSWORD'),
    connectTimeout: 10000,
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
  };

  // Ajout progressif des options par environnement
  const environmentConfigs = {
    development: {
      ...baseConfig,
      // Options spécifiques au développement
      lazyConnect: false,      // Connection immédiate pour debugging
      keepAlive: 15000,
      // keyPrefix: configService.get('REDIS_KEY_PREFIX', 'project-service') + ':dev:', // Désactivé - géré par CacheService
    },
    
    test: {
      ...baseConfig,
      // Options optimisées pour les tests
      db: parseInt(configService.get('REDIS_DB', '1'), 10), // DB séparée pour tests
      lazyConnect: false,
      keepAlive: 10000,
      maxRetriesPerRequest: 2,  // Moins de retries en test
      keyPrefix: configService.get('REDIS_KEY_PREFIX', 'project-service') + ':test:',
    },
    
    staging: {
      ...baseConfig,
      // Options intermédiaires pour staging
      lazyConnect: true,
      keepAlive: 20000,
      commandTimeout: 8000,
      keyPrefix: configService.get('REDIS_KEY_PREFIX', 'project-service') + ':staging:',
      // Ajout du monitoring en staging
      enableOfflineQueue: true,
    },
    
    production: {
      ...baseConfig,
      // Options robustes pour production
      lazyConnect: false,       // Connection immédiate en prod
      keepAlive: 30000,
      commandTimeout: 10000,
      maxRetriesPerRequest: 5,  // Plus de retries en prod
      retryDelayOnFailover: 200,
      keyPrefix: configService.get('REDIS_KEY_PREFIX', 'project-service') + ':prod:',
      enableOfflineQueue: true,
      family: 4,                // Force IPv4 en production
    },
  };

  const config = environmentConfigs[env as keyof typeof environmentConfigs] || environmentConfigs.development;

  // Ajout conditionnel du TLS pour la production
  if (env === 'production' && configService.get('REDIS_TLS_ENABLED', 'false') === 'true') {
    (config as any).tls = {
      rejectUnauthorized: configService.get('REDIS_TLS_REJECT_UNAUTHORIZED', 'true') === 'true',
      ca: configService.get('REDIS_TLS_CA'),
      cert: configService.get('REDIS_TLS_CERT'),
      key: configService.get('REDIS_TLS_KEY'),
    };
    logger.log('TLS enabled for Redis connection');
  }

  // Validation de la configuration
  if (!config.host || !config.port) {
    logger.error('Invalid Redis configuration: host and port are required');
    throw new Error('Redis configuration error: missing host or port');
  }

  // Logging de la configuration appliquée
  logger.log(`Redis configuration for ${env}:`);
  logger.log(`  Host: ${config.host}:${config.port}`);
  logger.log(`  Database: ${config.db}`);
  // logger.log(`  Key Prefix: ${config.keyPrefix}`);
  logger.log(`  Connection Timeout: ${config.connectTimeout}ms`);
  logger.log(`  Max Retries: ${config.maxRetriesPerRequest}`);
  logger.log(`  Lazy Connect: ${config.lazyConnect}`);
  
  if (config.password) {
    logger.log('  Authentication: enabled');
  }

  return {
    type: 'single',
    options: config,
  };
}

/**
 * Provider pour les événements Redis (optionnel)
 * Utile pour le monitoring et debugging
 */
class RedisEventsLogger {
  private readonly logger = new Logger('RedisEvents');

  constructor(private readonly cacheService: CacheService) {
    // Se connecter aux événements Redis si disponible
    this.setupEventLogging();
  }

  private setupEventLogging(): void {
    // Note: L'accès direct à l'instance Redis dépend de l'implémentation
    // Cette partie peut être ajustée selon vos besoins de monitoring
    try {
      const env = process.env.NODE_ENV;
      if (env === 'development') {
        this.logger.log('Redis event logging enabled for development');
        // Ici on pourrait ajouter des listeners d'événements Redis
      }
    } catch (error) {
      this.logger.warn('Could not setup Redis event logging:', error.message);
    }
  }
}

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
    RedisEventsLogger, // Monitoring optionnel
  ],
  exports: [CacheService],
})
export class CacheModule {
  private readonly logger = new Logger(CacheModule.name);

  constructor(
    private readonly cacheService: CacheService,
    private readonly redisEvents: RedisEventsLogger,
  ) {}

  async onModuleInit(): Promise<void> {
    this.logger.log('CacheModule initialized successfully');
    
    // Test de santé initial selon l'environnement
    const env = process.env.NODE_ENV || 'development';
    const shouldTestConnection = ['development', 'test'].includes(env);
    
    if (shouldTestConnection) {
      try {
        const isHealthy = await this.cacheService.healthCheck();
        if (isHealthy) {
          this.logger.log('Redis connection health check: SUCCESS');
          
          // Test des fonctionnalités de base en développement
          if (env === 'development') {
            await this.performDevelopmentTests();
          }
        } else {
          this.logger.warn('Redis connection health check: FAILED');
        }
      } catch (error) {
        this.logger.error('Redis health check error:', error.message);
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.log('CacheModule shutting down');
    
    try {
      await this.cacheService.disconnect();
      this.logger.log('Redis connections closed gracefully');
    } catch (error) {
      this.logger.error('Error during Redis disconnection:', error.message);
    }
  }

  /**
   * Tests de fonctionnalités en développement
   */
  private async performDevelopmentTests(): Promise<void> {
    try {
      this.logger.debug('Running development cache tests...');
      
      // Test SET/GET basique
      const testKey = 'dev-test';
      const testValue = { test: 'value', timestamp: Date.now() };
      
      await this.cacheService.set(testKey, testValue, 60);
      const retrieved = await this.cacheService.get(testKey);
      
      if (JSON.stringify(retrieved) === JSON.stringify(testValue)) {
        this.logger.debug('Cache SET/GET test: PASSED');
      } else {
        this.logger.warn('Cache SET/GET test: FAILED');
      }
      
      // Nettoyage
      await this.cacheService.del(testKey);
      
      // Test des statistiques
      const stats = await this.cacheService.getStats();
      this.logger.debug(`Cache stats: ${stats.operations.hits} hits, ${stats.operations.misses} misses`);
      
    } catch (error) {
      this.logger.warn('Development cache tests failed:', error.message);
    }
  }
}

export { CacheService } from './cache.service';