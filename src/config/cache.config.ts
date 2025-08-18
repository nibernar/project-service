// src/config/cache.config.ts

import { registerAs } from '@nestjs/config';
import type { RedisOptions } from 'ioredis';

// ============================================================================
// INTERFACES DE CONFIGURATION
// ============================================================================

export interface CacheConnectionConfig {
  host: string;
  port: number;
  password?: string;
  username?: string;
  db: number;
  family: 4 | 6;
  connectTimeout: number;
  lazyConnect: boolean;
  keepAlive: number;
}

export interface CachePerformanceConfig {
  defaultTtl: number;
  maxConnections: number;
  minConnections: number;
  connectionTimeout: number;
  responseTimeout: number;
  commandTimeout: number;
  acquireTimeout: number;
  maxWaitingClients: number;
}

export interface CacheRetryConfig {
  enabled: boolean;
  retryDelayOnFailover: number;
  maxRetriesPerRequest: number;
  retryDelayOnClusterDown: number;
  maxRetriesPerRequestOnFailover: number;
  enableReadyCheck: boolean;
  maxRetriesPerRequestOnReadyCheck: number;
}

export interface CacheSerializationConfig {
  mode: 'json' | 'msgpack' | 'buffer';
  compression: boolean;
  compressionThreshold: number;
  keyPrefix: string;
  keyExpiration: boolean;
  valueMaxSize: number;
}

export interface CacheMonitoringConfig {
  enabled: boolean;
  collectCommandStats: boolean;
  slowCommandThreshold: number;
  healthCheckInterval: number;
  healthCheckTimeout: number;
  enableMetrics: boolean;
  metricsInterval: number;
}

export interface CacheSecurityConfig {
  enableAuth: boolean;
  enableTLS: boolean;
  tlsRejectUnauthorized: boolean;
  tlsCa?: string;
  tlsCert?: string;
  tlsKey?: string;
  enableIPWhitelist: boolean;
  allowedIPs: string[];
}

export interface CacheClusterConfig {
  enabled: boolean;
  nodes: Array<{ host: string; port: number }>;
  enableOfflineQueue: boolean;
  redisOptions: Partial<RedisOptions>;
  scaleReads: 'master' | 'slave' | 'all';
  maxRedirections: number;
}

export interface CacheFeaturesConfig {
  enablePipelining: boolean;
  enableTransactions: boolean;
  enableStreams: boolean;
  enablePubSub: boolean;
  enableScripting: boolean;
  enableCaching: boolean;
  enableDistributedLock: boolean;
}

export interface CacheConfig {
  connection: CacheConnectionConfig;
  performance: CachePerformanceConfig;
  retry: CacheRetryConfig;
  serialization: CacheSerializationConfig;
  monitoring: CacheMonitoringConfig;
  security: CacheSecurityConfig;
  cluster: CacheClusterConfig;
  features: CacheFeaturesConfig;
}

export interface CacheLimits {
  maxConnections: number;
  recommendedConnections: number;
  minConnections: number;
  defaultTtl: number;
  maxTtl: number;
}

export interface EnvironmentCacheLimits {
  development: CacheLimits;
  test: CacheLimits;
  staging: CacheLimits;
  production: CacheLimits;
}

// ============================================================================
// ERREURS PERSONNALISÉES
// ============================================================================

export class CacheConfigurationError extends Error {
  constructor(
    message: string,
    public readonly variable?: string,
    public readonly value?: any,
  ) {
    super(message);
    this.name = 'CacheConfigurationError';
  }
}

export class CacheValidationError extends CacheConfigurationError {
  constructor(
    message: string,
    variable: string,
    value: any,
    public readonly suggestion?: string,
  ) {
    super(message, variable, value);
    this.name = 'CacheValidationError';
  }
}

export class CacheConnectionError extends CacheConfigurationError {
  constructor(
    message: string,
    public readonly originalError?: Error,
  ) {
    super(message);
    this.name = 'CacheConnectionError';
  }
}

// ============================================================================
// CONSTANTES ET VALEURS PAR DÉFAUT
// ============================================================================

export const CACHE_LIMITS: EnvironmentCacheLimits = {
  development: {
    minConnections: 1,
    maxConnections: 10,
    recommendedConnections: 3,
    defaultTtl: 300,
    maxTtl: 3600,
  },
  test: {
    minConnections: 1,
    maxConnections: 3,
    recommendedConnections: 1,
    defaultTtl: 30,
    maxTtl: 300,
  },
  staging: {
    minConnections: 5,
    maxConnections: 25,
    recommendedConnections: 10,
    defaultTtl: 600,
    maxTtl: 7200,
  },
  production: {
    minConnections: 10,
    maxConnections: 100,
    recommendedConnections: 25,
    defaultTtl: 900,
    maxTtl: 14400,
  },
};

export const CACHE_KEYS = {
  PROJECT: (id: string) => `project:${id}`,
  PROJECT_LIST: (userId: string, page: number, limit: number) =>
    `projects:${userId}:${page}:${limit}`,
  PROJECT_STATISTICS: (projectId: string) => `stats:${projectId}`,
  USER_PROJECTS_COUNT: (userId: string) => `count:projects:${userId}`,
  PROJECT_SEARCH: (userId: string, query: string) =>
    `search:${userId}:${query}`,
  EXPORT_STATUS: (exportId: string) => `export:status:${exportId}`,
  RATE_LIMIT: (userId: string, action: string) =>
    `ratelimit:${userId}:${action}`,
} as const;

export const CACHE_TTL = {
  PROJECT: 300, // 5 minutes
  PROJECT_LIST: 60, // 1 minute
  PROJECT_STATISTICS: 600, // 10 minutes
  USER_PROJECTS_COUNT: 120, // 2 minutes
  PROJECT_SEARCH: 180, // 3 minutes
  EXPORT_STATUS: 1800, // 30 minutes
  RATE_LIMIT: 3600, // 1 hour
} as const;

export const SERIALIZATION_MODES = ['json', 'msgpack', 'buffer'] as const;
export type SerializationMode = (typeof SERIALIZATION_MODES)[number];

export const ENVIRONMENT_MAPPINGS = {
  REDIS_HOST: 'connection.host',
  REDIS_PORT: 'connection.port',
  REDIS_PASSWORD: 'connection.password',
  REDIS_USERNAME: 'connection.username',
  REDIS_DB: 'connection.db',
  REDIS_CONNECT_TIMEOUT: 'connection.connectTimeout',
  CACHE_TTL: 'performance.defaultTtl',
  REDIS_MAX_CONNECTIONS: 'performance.maxConnections',
  REDIS_MIN_CONNECTIONS: 'performance.minConnections',
  REDIS_RESPONSE_TIMEOUT: 'performance.responseTimeout',
  REDIS_RETRY_DELAY: 'retry.retryDelayOnFailover',
  REDIS_MAX_RETRIES: 'retry.maxRetriesPerRequest',
  REDIS_KEY_PREFIX: 'serialization.keyPrefix',
  REDIS_COMPRESSION: 'serialization.compression',
  REDIS_ENABLE_METRICS: 'monitoring.enabled',
  REDIS_HEALTH_CHECK_INTERVAL: 'monitoring.healthCheckInterval',
  REDIS_ENABLE_TLS: 'security.enableTLS',
  REDIS_TLS_REJECT_UNAUTHORIZED: 'security.tlsRejectUnauthorized',
  REDIS_CLUSTER_ENABLED: 'cluster.enabled',
};

// ============================================================================
// CLASSES DE VALIDATION
// ============================================================================

export class CacheConfigValidator {
  /**
   * Valide la configuration de connexion Redis
   */
  static validateConnectionConfig(config: CacheConnectionConfig): void {
    if (!config.host) {
      throw new CacheValidationError(
        'Redis host is required',
        'REDIS_HOST',
        config.host,
        'Use localhost for development or a valid hostname/IP',
      );
    }

    if (config.port < 1 || config.port > 65535) {
      throw new CacheValidationError(
        'Redis port must be between 1 and 65535',
        'REDIS_PORT',
        config.port,
        'Use 6379 for default Redis port',
      );
    }

    if (config.db < 0 || config.db > 15) {
      throw new CacheValidationError(
        'Redis database number must be between 0 and 15',
        'REDIS_DB',
        config.db,
        'Use 0 for default database',
      );
    }

    if (config.connectTimeout <= 0) {
      throw new CacheValidationError(
        'Connection timeout must be greater than 0',
        'REDIS_CONNECT_TIMEOUT',
        config.connectTimeout,
        'Use a positive number in milliseconds like 10000',
      );
    }
  }

  /**
   * Valide la configuration de performance
   */
  static validatePerformanceConfig(config: CachePerformanceConfig): void {
    if (config.maxConnections <= 0) {
      throw new CacheValidationError(
        'Maximum connections must be greater than 0',
        'REDIS_MAX_CONNECTIONS',
        config.maxConnections,
        'Use a positive number like 10',
      );
    }

    if (config.minConnections >= config.maxConnections) {
      throw new CacheValidationError(
        'Minimum connections must be less than maximum connections',
        'REDIS_MIN_CONNECTIONS',
        config.minConnections,
        `Set REDIS_MIN_CONNECTIONS < ${config.maxConnections}`,
      );
    }

    if (config.defaultTtl <= 0) {
      throw new CacheValidationError(
        'Default TTL must be greater than 0',
        'CACHE_TTL',
        config.defaultTtl,
        'Use a positive number in seconds like 300',
      );
    }

    if (config.responseTimeout <= 0) {
      throw new CacheValidationError(
        'Response timeout must be greater than 0',
        'REDIS_RESPONSE_TIMEOUT',
        config.responseTimeout,
        'Use a positive number in milliseconds like 5000',
      );
    }
  }

  /**
   * Valide les variables d'environnement requises
   */
  static validateEnvironmentVariables(): void {
    // Aucune variable n'est absolument requise car Redis peut fonctionner avec des défauts
    // Mais on avertit sur les importantes

    const nodeEnv = process.env.NODE_ENV || 'development';
    if (nodeEnv === 'production') {
      const productionImportantVars = [
        'REDIS_HOST',
        'REDIS_PASSWORD',
        'REDIS_MAX_CONNECTIONS',
      ];

      productionImportantVars.forEach((varName) => {
        if (!process.env[varName]) {
          console.warn(
            `⚠️  Production environment variable not set: ${varName}`,
          );
        }
      });
    }

    // Validation de l'URL Redis si fournie
    if (process.env.REDIS_URL) {
      try {
        new URL(process.env.REDIS_URL);
      } catch (error) {
        throw new CacheValidationError(
          'Invalid Redis URL format',
          'REDIS_URL',
          process.env.REDIS_URL,
          'Format: redis://[:password@]host[:port][/database]',
        );
      }
    }
  }

  /**
   * Valide la cohérence de la configuration complète
   */
  static validateCompleteConfig(config: CacheConfig): void {
    this.validateConnectionConfig(config.connection);
    this.validatePerformanceConfig(config.performance);

    // Validation de cohérence entre composants
    if (config.cluster.enabled && config.cluster.nodes.length === 0) {
      throw new CacheConfigurationError(
        'Cluster mode enabled but no nodes configured',
      );
    }

    if (
      config.security.enableTLS &&
      !config.security.tlsRejectUnauthorized &&
      process.env.NODE_ENV === 'production'
    ) {
      console.warn(
        '⚠️  TLS enabled but certificate verification disabled in production',
      );
    }

    if (
      config.serialization.compression &&
      config.serialization.compressionThreshold <= 0
    ) {
      throw new CacheValidationError(
        'Compression threshold must be greater than 0 when compression is enabled',
        'REDIS_COMPRESSION_THRESHOLD',
        config.serialization.compressionThreshold,
        'Use a positive number in bytes like 1024',
      );
    }
  }
}

// ============================================================================
// FACTORY DE CONFIGURATION
// ============================================================================

export class CacheConfigFactory {
  /**
   * Point d'entrée principal pour créer la configuration complète
   */
  static create(options: { strict?: boolean } = {}): CacheConfig {
    try {
      // Mode debug en développement
      if (
        process.env.NODE_ENV === 'development' &&
        process.env.DEBUG_CONFIG === 'true'
      ) {
        this.debugEnvironmentVariables();
      }

      // Validation préliminaire
      CacheConfigValidator.validateEnvironmentVariables();

      const nodeEnv = process.env.NODE_ENV || 'development';
      const config = this.createForEnvironment(nodeEnv);

      // Validation complète si mode strict
      if (options.strict !== false) {
        CacheConfigValidator.validateCompleteConfig(config);
      }

      return config;
    } catch (error) {
      console.error('❌ Cache Configuration Error:', error.message);
      throw error;
    }
  }

  /**
   * Crée une configuration spécifique à l'environnement
   */
  static createForEnvironment(env: string): CacheConfig {
    const actualEnv = env || process.env.NODE_ENV || 'development';
    switch (actualEnv) {
      case 'development':
        return this.createDevelopmentConfig();
      case 'test':
        return this.createTestConfig();
      case 'staging':
        return this.createStagingConfig();
      case 'production':
        return this.createProductionConfig();
      default:
        console.warn(
          `⚠️  Unknown environment "${actualEnv}", using development config`,
        );
        return this.createDevelopmentConfig();
    }
  }

  /**
   * Configuration optimisée pour le développement
   */
  static createDevelopmentConfig(): CacheConfig {
    const limits = CACHE_LIMITS.development;

    return {
      connection: this.createConnectionConfig('development'),
      performance: this.createPerformanceConfig('development', limits),
      retry: this.createRetryConfig('development'),
      serialization: this.createSerializationConfig('development'),
      monitoring: this.createMonitoringConfig('development'),
      security: this.createSecurityConfig('development'),
      cluster: this.createClusterConfig('development'),
      features: this.createFeaturesConfig('development'),
    };
  }

  /**
   * Configuration optimisée pour les tests
   */
  static createTestConfig(): CacheConfig {
    const limits = CACHE_LIMITS.test;

    return {
      connection: this.createConnectionConfig('test'),
      performance: this.createPerformanceConfig('test', limits),
      retry: this.createRetryConfig('test'),
      serialization: this.createSerializationConfig('test'),
      monitoring: this.createMonitoringConfig('test'),
      security: this.createSecurityConfig('test'),
      cluster: this.createClusterConfig('test'),
      features: this.createFeaturesConfig('test'),
    };
  }

  /**
   * Configuration optimisée pour le staging
   */
  static createStagingConfig(): CacheConfig {
    const limits = CACHE_LIMITS.staging;

    return {
      connection: this.createConnectionConfig('staging'),
      performance: this.createPerformanceConfig('staging', limits),
      retry: this.createRetryConfig('staging'),
      serialization: this.createSerializationConfig('staging'),
      monitoring: this.createMonitoringConfig('staging'),
      security: this.createSecurityConfig('staging'),
      cluster: this.createClusterConfig('staging'),
      features: this.createFeaturesConfig('staging'),
    };
  }

  /**
   * Configuration optimisée pour la production
   */
  static createProductionConfig(): CacheConfig {
    const limits = CACHE_LIMITS.production;

    return {
      connection: this.createConnectionConfig('production'),
      performance: this.createPerformanceConfig('production', limits),
      retry: this.createRetryConfig('production'),
      serialization: this.createSerializationConfig('production'),
      monitoring: this.createMonitoringConfig('production'),
      security: this.createSecurityConfig('production'),
      cluster: this.createClusterConfig('production'),
      features: this.createFeaturesConfig('production'),
    };
  }

  /**
   * Crée la configuration de connexion
   */
  static createConnectionConfig(env: string): CacheConnectionConfig {
    // Parse Redis URL si fournie
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
      return this.parseRedisUrl(redisUrl, env);
    }

    return {
      host: process.env.REDIS_HOST || 'localhost',
      port: this.parseInt(process.env.REDIS_PORT, 6379),
      password: process.env.REDIS_PASSWORD,
      username: process.env.REDIS_USERNAME,
      db: this.parseInt(process.env.REDIS_DB, env === 'test' ? 1 : 0),
      family: this.parseInt(process.env.REDIS_FAMILY, 4) as 4 | 6,
      connectTimeout: this.parseInt(
        process.env.REDIS_CONNECT_TIMEOUT,
        env === 'production' ? 10000 : 5000,
      ),
      lazyConnect: this.parseBoolean(process.env.REDIS_LAZY_CONNECT, true),
      keepAlive: this.parseInt(process.env.REDIS_KEEP_ALIVE, 30000),
    };
  }

  /**
   * Crée la configuration de performance
   */
  static createPerformanceConfig(
    env: string,
    limits: CacheLimits,
  ): CachePerformanceConfig {
    return {
      defaultTtl: this.parseInt(process.env.CACHE_TTL, limits.defaultTtl),
      maxConnections: this.parseInt(
        process.env.REDIS_MAX_CONNECTIONS,
        limits.recommendedConnections,
      ),
      minConnections: this.parseInt(
        process.env.REDIS_MIN_CONNECTIONS,
        limits.minConnections,
      ),
      connectionTimeout: this.parseInt(
        process.env.REDIS_CONNECTION_TIMEOUT,
        env === 'production' ? 15000 : 10000,
      ),
      responseTimeout: this.parseInt(
        process.env.REDIS_RESPONSE_TIMEOUT,
        env === 'production' ? 10000 : 5000,
      ),
      commandTimeout: this.parseInt(
        process.env.REDIS_COMMAND_TIMEOUT,
        env === 'production' ? 5000 : 3000,
      ),
      acquireTimeout: this.parseInt(process.env.REDIS_ACQUIRE_TIMEOUT, 10000),
      maxWaitingClients: this.parseInt(
        process.env.REDIS_MAX_WAITING_CLIENTS,
        env === 'production' ? 100 : 50,
      ),
    };
  }

  /**
   * Crée la configuration de retry
   */
  static createRetryConfig(env: string): CacheRetryConfig {
    return {
      enabled: this.parseBoolean(
        process.env.REDIS_RETRIES_ENABLED,
        env !== 'test',
      ),
      retryDelayOnFailover: this.parseInt(process.env.REDIS_RETRY_DELAY, 100),
      maxRetriesPerRequest: this.parseInt(
        process.env.REDIS_MAX_RETRIES,
        env === 'production' ? 5 : 3,
      ),
      retryDelayOnClusterDown: this.parseInt(
        process.env.REDIS_CLUSTER_RETRY_DELAY,
        300,
      ),
      maxRetriesPerRequestOnFailover: this.parseInt(
        process.env.REDIS_MAX_RETRIES_FAILOVER,
        2,
      ),
      enableReadyCheck: this.parseBoolean(
        process.env.REDIS_ENABLE_READY_CHECK,
        true,
      ),
      maxRetriesPerRequestOnReadyCheck: this.parseInt(
        process.env.REDIS_MAX_RETRIES_READY,
        1,
      ),
    };
  }

  /**
   * Crée la configuration de sérialisation
   */
  static createSerializationConfig(env: string): CacheSerializationConfig {
    const mode =
      (process.env.REDIS_SERIALIZATION as SerializationMode) || 'json';
    const validModes = SERIALIZATION_MODES;

    return {
      mode: validModes.includes(mode) ? mode : 'json',
      compression: this.parseBoolean(
        process.env.REDIS_COMPRESSION,
        env === 'production',
      ),
      compressionThreshold: this.parseInt(
        process.env.REDIS_COMPRESSION_THRESHOLD,
        1024,
      ),
      keyPrefix:
        process.env.REDIS_KEY_PREFIX || `coders:project-service:${env}:`,
      keyExpiration: this.parseBoolean(process.env.REDIS_KEY_EXPIRATION, true),
      valueMaxSize: this.parseInt(
        process.env.REDIS_VALUE_MAX_SIZE,
        env === 'production' ? 10485760 : 1048576,
      ), // 10MB prod, 1MB autres
    };
  }

  /**
   * Crée la configuration de monitoring
   */
  static createMonitoringConfig(env: string): CacheMonitoringConfig {
    return {
      enabled: this.parseBoolean(
        process.env.REDIS_ENABLE_METRICS,
        env !== 'test',
      ),
      collectCommandStats: this.parseBoolean(
        process.env.REDIS_COLLECT_COMMAND_STATS,
        env === 'development' || env === 'staging',
      ),
      slowCommandThreshold: this.parseInt(
        process.env.REDIS_SLOW_COMMAND_THRESHOLD,
        env === 'production' ? 1000 : 500,
      ),
      healthCheckInterval: this.parseInt(
        process.env.REDIS_HEALTH_CHECK_INTERVAL,
        env === 'production' ? 30000 : 60000,
      ),
      healthCheckTimeout: this.parseInt(
        process.env.REDIS_HEALTH_CHECK_TIMEOUT,
        5000,
      ),
      enableMetrics: this.parseBoolean(
        process.env.REDIS_ENABLE_METRICS,
        env !== 'test',
      ),
      metricsInterval: this.parseInt(process.env.REDIS_METRICS_INTERVAL, 60000),
    };
  }

  /**
   * Crée la configuration de sécurité
   */
  static createSecurityConfig(env: string): CacheSecurityConfig {
    return {
      enableAuth: this.parseBoolean(
        process.env.REDIS_ENABLE_AUTH,
        env === 'production' || env === 'staging',
      ),
      enableTLS: this.parseBoolean(
        process.env.REDIS_ENABLE_TLS,
        env === 'production',
      ),
      tlsRejectUnauthorized: this.parseBoolean(
        process.env.REDIS_TLS_REJECT_UNAUTHORIZED,
        env === 'production',
      ),
      tlsCa: process.env.REDIS_TLS_CA,
      tlsCert: process.env.REDIS_TLS_CERT,
      tlsKey: process.env.REDIS_TLS_KEY,
      enableIPWhitelist: this.parseBoolean(
        process.env.REDIS_ENABLE_IP_WHITELIST,
        false,
      ),
      allowedIPs: this.parseArray(process.env.REDIS_ALLOWED_IPS),
    };
  }

  /**
   * Crée la configuration de cluster
   */
  static createClusterConfig(env: string): CacheClusterConfig {
    const clusterEnabled = this.parseBoolean(
      process.env.REDIS_CLUSTER_ENABLED,
      false,
    );

    let nodes: Array<{ host: string; port: number }> = [];
    if (clusterEnabled) {
      const nodesStr = process.env.REDIS_CLUSTER_NODES;
      if (nodesStr) {
        nodes = nodesStr.split(',').map((node) => {
          const [host, portStr] = node.trim().split(':');
          return { host, port: parseInt(portStr) || 6379 };
        });
      }
    }

    return {
      enabled: clusterEnabled,
      nodes,
      enableOfflineQueue: this.parseBoolean(
        process.env.REDIS_ENABLE_OFFLINE_QUEUE,
        false,
      ),
      redisOptions: {
        password: process.env.REDIS_PASSWORD,
        connectTimeout: this.parseInt(process.env.REDIS_CONNECT_TIMEOUT, 10000),
      },
      scaleReads:
        (process.env.REDIS_SCALE_READS as 'master' | 'slave' | 'all') ||
        'slave',
      maxRedirections: this.parseInt(process.env.REDIS_MAX_REDIRECTIONS, 16),
    };
  }

  /**
   * Crée la configuration des fonctionnalités
   */
  static createFeaturesConfig(env: string): CacheFeaturesConfig {
    return {
      enablePipelining: this.parseBoolean(
        process.env.REDIS_ENABLE_PIPELINING,
        env === 'production',
      ),
      enableTransactions: this.parseBoolean(
        process.env.REDIS_ENABLE_TRANSACTIONS,
        true,
      ),
      enableStreams: this.parseBoolean(process.env.REDIS_ENABLE_STREAMS, false),
      enablePubSub: this.parseBoolean(
        process.env.REDIS_ENABLE_PUBSUB,
        env !== 'test',
      ),
      enableScripting: this.parseBoolean(
        process.env.REDIS_ENABLE_SCRIPTING,
        true,
      ),
      enableCaching: this.parseBoolean(
        process.env.REDIS_ENABLE_CACHING,
        env !== 'test',
      ),
      enableDistributedLock: this.parseBoolean(
        process.env.REDIS_ENABLE_DISTRIBUTED_LOCK,
        env === 'production' || env === 'staging',
      ),
    };
  }

  // ============================================================================
  // MÉTHODES UTILITAIRES
  // ============================================================================

  /**
   * Parse une URL Redis complète
   */
  static parseRedisUrl(url: string, env: string): CacheConnectionConfig {
    try {
      const urlObj = new URL(url);

      return {
        host: urlObj.hostname || 'localhost',
        port: urlObj.port ? parseInt(urlObj.port) : 6379,
        password: urlObj.password || undefined,
        username: urlObj.username || undefined,
        db: urlObj.pathname ? parseInt(urlObj.pathname.slice(1)) || 0 : 0,
        family: 4,
        connectTimeout: env === 'production' ? 10000 : 5000,
        lazyConnect: true,
        keepAlive: 30000,
      };
    } catch (error) {
      throw new CacheValidationError(
        'Invalid Redis URL format',
        'REDIS_URL',
        url,
        'Format: redis://[:password@]host[:port][/database]',
      );
    }
  }

  /**
   * Méthode de debug pour comprendre les valeurs d'environnement
   */
  static debugEnvironmentVariables(): void {
    console.log('🔍 Cache Environment Variables Debug:');
    console.log('NODE_ENV:', process.env.NODE_ENV);
    console.log(
      'REDIS_HOST:',
      process.env.REDIS_HOST || '[DEFAULT: localhost]',
    );
    console.log('REDIS_PORT:', process.env.REDIS_PORT || '[DEFAULT: 6379]');
    console.log('REDIS_URL:', process.env.REDIS_URL ? '[SET]' : '[NOT SET]');
    console.log(
      'REDIS_PASSWORD:',
      process.env.REDIS_PASSWORD ? '[SET]' : '[NOT SET]',
    );
    console.log(
      'CACHE_TTL:',
      process.env.CACHE_TTL || '[DEFAULT: varies by env]',
    );
    console.log(
      'REDIS_MAX_CONNECTIONS:',
      process.env.REDIS_MAX_CONNECTIONS || '[DEFAULT: varies by env]',
    );
    console.log(
      'REDIS_ENABLE_METRICS:',
      process.env.REDIS_ENABLE_METRICS || '[DEFAULT: varies by env]',
    );
  }

  /**
   * Parse une variable d'environnement booléenne
   */
  static parseBoolean(
    value: string | undefined,
    defaultValue: boolean,
  ): boolean {
    if (value === undefined || value === null) {
      return defaultValue;
    }

    const trimmedValue = value.toString().trim();
    if (trimmedValue === '') {
      return defaultValue;
    }

    const lowerValue = trimmedValue.toLowerCase();

    if (['true', '1', 'yes', 'on'].includes(lowerValue)) return true;
    if (['false', '0', 'no', 'off'].includes(lowerValue)) return false;

    console.warn(
      `⚠️  Invalid boolean value "${value}", using default: ${defaultValue}`,
    );
    return defaultValue;
  }

  /**
   * Parse une variable d'environnement numérique
   */
  static parseInt(value: string | undefined, defaultValue: number): number {
    if (value === undefined || value === null) {
      return defaultValue;
    }

    const trimmedValue = value.toString().trim();
    if (trimmedValue === '') {
      return defaultValue;
    }

    const parsed = parseInt(trimmedValue, 10);

    if (isNaN(parsed) || parsed < 0) {
      console.warn(
        `⚠️  Invalid number value "${value}", using default: ${defaultValue}`,
      );
      return defaultValue;
    }

    return parsed;
  }

  /**
   * Parse une variable d'environnement en tableau
   */
  static parseArray(value: string | undefined, delimiter = ','): string[] {
    if (!value) return [];

    return value
      .split(delimiter)
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }
}

// ============================================================================
// UTILITAIRES D'INTÉGRATION
// ============================================================================

/**
 * Helper pour récupérer la config depuis ConfigService
 */
export function getCacheConfig(configService: any): CacheConfig {
  return configService.get('cache');
}

/**
 * Calcule la taille optimale du pool de connexions
 */
export function calculateOptimalPoolSize(
  environment: string,
  availableMemory?: number,
): number {
  const limits =
    CACHE_LIMITS[environment as keyof EnvironmentCacheLimits] ||
    CACHE_LIMITS.development;
  let baseSize = limits.recommendedConnections;

  if (availableMemory) {
    // Estimation : ~128MB par connexion Redis (approximatif)
    const memoryFactor = Math.floor(availableMemory / 128);
    baseSize = Math.min(limits.maxConnections, baseSize + memoryFactor);
  }

  return Math.max(
    limits.minConnections,
    Math.min(limits.maxConnections, baseSize),
  );
}

// ============================================================================
// EXPORT DE LA CONFIGURATION
// ============================================================================

/**
 * Configuration principale du cache Redis
 * Utilisable avec @Inject(cacheConfig.KEY) dans les services
 */
export const cacheConfig = registerAs('cache', () => {
  try {
    return CacheConfigFactory.create();
  } catch (error) {
    console.error('Failed to create cache configuration:', error.message);
    throw error;
  }
});

/**
 * Type pour l'injection de dépendance
 * Usage: @Inject(cacheConfig.KEY) private readonly config: ConfigType<typeof cacheConfig>
 */
export type CacheConfigType = ReturnType<typeof cacheConfig>;

// ============================================================================
// EXPORTS ADDITIONNELS POUR UTILISATION EXTERNE
// ============================================================================

export {
  CacheConfigFactory as CacheConfigurationFactory,
  CacheConfigValidator as CacheValidator,
  CACHE_LIMITS as CacheConnectionLimits,
  ENVIRONMENT_MAPPINGS as CacheEnvironmentMappings,
  CACHE_KEYS as CacheKeyPatterns,
  CACHE_TTL as CacheTimeToLive,
};
