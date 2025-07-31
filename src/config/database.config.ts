// src/config/database.config.ts

import { registerAs } from '@nestjs/config';
import { readFileSync } from 'fs';
import { join } from 'path';

// ============================================================================
// INTERFACES DE CONFIGURATION
// ============================================================================

export interface DatabaseSSLConfig {
  enabled: boolean;
  rejectUnauthorized: boolean;
  ca?: string;
  cert?: string;
  key?: string;
}

export interface DatabaseLoggingConfig {
  enabled: boolean;
  level: ('query' | 'info' | 'warn' | 'error')[];
  slowQueryThreshold: number;
  colorize: boolean;
  includeParameters: boolean;
}

export interface DatabasePerformanceConfig {
  statementCacheSize: number;
  connectionIdleTimeout: number;
  acquireTimeout: number;
  createTimeout: number;
  destroyTimeout: number;
  reapInterval: number;
  evictionRunIntervalMillis: number;
  numTestsPerEvictionRun: number;
}

export interface DatabaseMigrationConfig {
  autoMigrate: boolean;
  migrationPath: string;
  seedOnCreate: boolean;
  createDatabase: boolean;
  dropDatabase: boolean;
}

export interface DatabaseHealthConfig {
  enableHealthCheck: boolean;
  healthCheckInterval: number;
  maxHealthCheckFailures: number;
  healthCheckTimeout: number;
}

export interface DatabaseConfig {
  url: string;
  maxConnections: number;
  minConnections: number;
  connectionTimeout: number;
  idleTimeout: number;
  queryTimeout: number;
  transactionTimeout: number;
  maxWait: number;
  ssl: DatabaseSSLConfig | boolean;
  logging: DatabaseLoggingConfig;
  performance: DatabasePerformanceConfig;
  migration: DatabaseMigrationConfig;
  health: DatabaseHealthConfig;
  retries: {
    enabled: boolean;
    maxRetries: number;
    delay: number;
    factor: number;
    maxDelay: number;
  };
}

export interface ConnectionLimits {
  min: number;
  max: number;
  recommended: number;
}

export interface EnvironmentLimits {
  development: ConnectionLimits;
  test: ConnectionLimits;
  staging: ConnectionLimits;
  production: ConnectionLimits;
}

// ============================================================================
// ERREURS PERSONNALISÉES
// ============================================================================

export class DatabaseConfigurationError extends Error {
  constructor(
    message: string,
    public readonly variable?: string,
    public readonly value?: any
  ) {
    super(message);
    this.name = 'DatabaseConfigurationError';
  }
}

export class DatabaseValidationError extends DatabaseConfigurationError {
  constructor(
    message: string,
    variable: string,
    value: any,
    public readonly suggestion?: string
  ) {
    super(message, variable, value);
    this.name = 'DatabaseValidationError';
  }
}

export class DatabaseConnectionError extends DatabaseConfigurationError {
  constructor(
    message: string,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'DatabaseConnectionError';
  }
}

// ============================================================================
// CONSTANTES ET VALEURS PAR DÉFAUT
// ============================================================================

export const CONNECTION_LIMITS: EnvironmentLimits = {
  development: { min: 2, max: 15, recommended: 5 },
  test: { min: 1, max: 5, recommended: 2 },
  staging: { min: 5, max: 30, recommended: 10 },
  production: { min: 10, max: 100, recommended: 25 }
};

export const ENVIRONMENT_MAPPINGS = {
  DATABASE_URL: 'url',
  DB_MAX_CONNECTIONS: 'maxConnections',
  DB_MIN_CONNECTIONS: 'minConnections',
  DB_CONNECTION_TIMEOUT: 'connectionTimeout',
  DB_IDLE_TIMEOUT: 'idleTimeout',
  DB_QUERY_TIMEOUT: 'queryTimeout',
  DB_TRANSACTION_TIMEOUT: 'transactionTimeout',
  DB_MAX_WAIT: 'maxWait',
  DB_SSL_ENABLED: 'ssl.enabled',
  DB_SSL_REJECT_UNAUTHORIZED: 'ssl.rejectUnauthorized',
  DB_SSL_CA: 'ssl.ca',
  DB_SSL_CERT: 'ssl.cert',
  DB_SSL_KEY: 'ssl.key',
  DB_LOG_ENABLED: 'logging.enabled',
  DB_LOG_LEVEL: 'logging.level',
  DB_SLOW_QUERY_THRESHOLD: 'logging.slowQueryThreshold',
  DB_AUTO_MIGRATE: 'migration.autoMigrate',
  DB_SEED_ON_CREATE: 'migration.seedOnCreate'
};

// ============================================================================
// CLASSES DE VALIDATION
// ============================================================================

export class DatabaseConfigValidator {
  /**
   * ✅ CORRECTION: Valide le format de l'URL de connexion
   */
  static validateConnectionUrl(url: string): boolean {
    if (!url) {
      throw new DatabaseValidationError(
        'Database URL is required',
        'DATABASE_URL',
        url,
        'Format: postgresql://username:password@host:port/database'
      );
    }

    // ✅ CORRECTION: Détection précoce des URLs sans hostname
    if (url.includes(':///') || url.includes('://:')) {
      throw new DatabaseValidationError(
        'Database URL must include hostname',
        'DATABASE_URL',
        url,
        'Format: postgresql://username:password@host:port/database'
      );
    }

    try {
      const urlObj = new URL(url);
      
      if (!['postgres:', 'postgresql:'].includes(urlObj.protocol)) {
        throw new DatabaseValidationError(
          'Invalid database URL protocol',
          'DATABASE_URL',
          urlObj.protocol,
          'Use postgresql:// protocol'
        );
      }

      if (!urlObj.hostname) {
        throw new DatabaseValidationError(
          'Database URL must include hostname',
          'DATABASE_URL',
          url,
          'Format: postgresql://username:password@host:port/database'
        );
      }

      if (!urlObj.pathname || urlObj.pathname === '/') {
        throw new DatabaseValidationError(
          'Database URL must include database name',
          'DATABASE_URL',
          url,
          'Format: postgresql://username:password@host:port/database'
        );
      }

      return true;
    } catch (error) {
      if (error instanceof DatabaseValidationError) {
        throw error;
      }
      
      // Pour toutes les autres erreurs (URL complètement invalide)
      throw new DatabaseValidationError(
        'Invalid database URL format',
        'DATABASE_URL',
        url,
        'Format: postgresql://username:password@host:port/database'
      );
    }
  }

  /**
   * Valide la cohérence des paramètres de pool
   */
  static validatePoolConfiguration(config: DatabaseConfig): void {
    const { maxConnections, minConnections, connectionTimeout, idleTimeout, queryTimeout } = config;

    // ✅ Validation de maxConnections en premier
    if (maxConnections <= 0) {
      throw new DatabaseValidationError(
        'Maximum connections must be greater than 0',
        'DB_MAX_CONNECTIONS',
        maxConnections,
        'Use a positive number like 10'
      );
    }

    // Ensuite validation des limites de connexions
    if (minConnections >= maxConnections) {
      throw new DatabaseValidationError(
        'Minimum connections must be less than maximum connections',
        'DB_MIN_CONNECTIONS',
        minConnections,
        `Set DB_MIN_CONNECTIONS < ${maxConnections}`
      );
    }

    // Validation des timeouts
    if (connectionTimeout <= 0) {
      throw new DatabaseValidationError(
        'Connection timeout must be greater than 0',
        'DB_CONNECTION_TIMEOUT',
        connectionTimeout,
        'Use a positive number in milliseconds like 30000'
      );
    }

    if (idleTimeout <= connectionTimeout) {
      throw new DatabaseValidationError(
        'Idle timeout should be greater than connection timeout',
        'DB_IDLE_TIMEOUT',
        idleTimeout,
        `Set DB_IDLE_TIMEOUT > ${connectionTimeout}`
      );
    }

    if (queryTimeout <= 0) {
      throw new DatabaseValidationError(
        'Query timeout must be greater than 0',
        'DB_QUERY_TIMEOUT',
        queryTimeout,
        'Use a positive number in milliseconds like 60000'
      );
    }
  }

  /**
   * ✅ FIX: Vérifie la présence des variables d'environnement requises
   */
  static validateEnvironmentVariables(): void {
    const requiredVars = ['DATABASE_URL'];
    const missingVars = requiredVars.filter(varName => !process.env[varName]);

    if (missingVars.length > 0) {
      throw new DatabaseConfigurationError(
        `Missing required database environment variables: ${missingVars.join(', ')}`
      );
    }

    // ✅ FIX: Avertissements pour variables optionnelles importantes (sauf en production)
    const nodeEnv = process.env.NODE_ENV || 'development';
    if (nodeEnv !== 'production') {
      const optionalImportantVars = [
        'DB_MAX_CONNECTIONS',
        'DB_CONNECTION_TIMEOUT',
        'DB_SSL_ENABLED'
      ];

      optionalImportantVars.forEach(varName => {
        if (!process.env[varName]) {
          console.warn(`⚠️  Optional database environment variable not set: ${varName}`);
        }
      });
    }
  }

  /**
   * ✅ CORRECTION: Nettoie et complète la configuration
   */
  static sanitizeConfig(config: Partial<DatabaseConfig>): DatabaseConfig {
    const nodeEnv = process.env.NODE_ENV || 'development';
    
    // ✅ FIX: Utiliser directement createForEnvironment pour éviter les incohérences
    const envConfig = DatabaseConfigFactory.createForEnvironment(nodeEnv);
    
    return {
      url: config.url || envConfig.url,
      maxConnections: config.maxConnections !== undefined ? config.maxConnections : envConfig.maxConnections,
      minConnections: config.minConnections !== undefined ? config.minConnections : envConfig.minConnections,
      connectionTimeout: config.connectionTimeout !== undefined ? config.connectionTimeout : envConfig.connectionTimeout,
      idleTimeout: config.idleTimeout !== undefined ? config.idleTimeout : envConfig.idleTimeout,
      queryTimeout: config.queryTimeout !== undefined ? config.queryTimeout : envConfig.queryTimeout,
      transactionTimeout: config.transactionTimeout !== undefined ? config.transactionTimeout : envConfig.transactionTimeout,
      maxWait: config.maxWait !== undefined ? config.maxWait : envConfig.maxWait,
      ssl: config.ssl !== undefined ? config.ssl : envConfig.ssl,
      logging: config.logging || envConfig.logging,
      performance: config.performance || envConfig.performance,
      migration: config.migration || envConfig.migration,
      health: config.health || envConfig.health,
      retries: config.retries || envConfig.retries
    };
  }
}

// ============================================================================
// FACTORY DE CONFIGURATION
// ============================================================================

export class DatabaseConfigFactory {
  /**
   * ✅ CORRECTION: Point d'entrée principal pour créer la configuration complète
   */
  static create(options: { strict?: boolean } = {}): DatabaseConfig {
    try {
      // Mode debug en développement
      if (process.env.NODE_ENV === 'development' && process.env.DEBUG_CONFIG === 'true') {
        this.debugEnvironmentVariables();
      }

      // ✅ FIX: Validation préliminaire AVANT de créer la config
      DatabaseConfigValidator.validateEnvironmentVariables();

      const nodeEnv = process.env.NODE_ENV || 'development';
      const config = this.createForEnvironment(nodeEnv);

      // ✅ FIX: Validation APRÈS création de la config avec toutes les valeurs
      DatabaseConfigValidator.validateConnectionUrl(config.url);
      DatabaseConfigValidator.validatePoolConfiguration(config);

      return config;
    } catch (error) {
      console.error('❌ Database Configuration Error:', error.message);
      throw error;
    }
  }

  /**
   * ✅ CORRECTION: Crée une configuration spécifique à l'environnement
   */
  static createForEnvironment(env: string): DatabaseConfig {
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
        console.warn(`⚠️  Unknown environment "${actualEnv}", using development config`);
        return this.createDevelopmentConfig();
    }
  }

  /**
   * ✅ CORRECTION: Configuration optimisée pour le développement
   */
  static createDevelopmentConfig(): DatabaseConfig {
    const limits = CONNECTION_LIMITS.development; // min: 2, max: 15, recommended: 5
    
    return {
      url: process.env.DATABASE_URL || '',
      maxConnections: this.parseInt(process.env.DB_MAX_CONNECTIONS, limits.recommended), // 5
      minConnections: this.parseInt(process.env.DB_MIN_CONNECTIONS, limits.min), // 2
      connectionTimeout: this.parseInt(process.env.DB_CONNECTION_TIMEOUT, 30000),
      idleTimeout: this.parseInt(process.env.DB_IDLE_TIMEOUT, 300000),
      queryTimeout: this.parseInt(process.env.DB_QUERY_TIMEOUT, 60000),
      transactionTimeout: this.parseInt(process.env.DB_TRANSACTION_TIMEOUT, 10000),
      maxWait: this.parseInt(process.env.DB_MAX_WAIT, 5000),
      ssl: this.createSSLConfig('development'),
      logging: this.createLoggingConfig('development'),
      performance: this.createPerformanceConfig('development'),
      migration: this.createMigrationConfig('development'),
      health: this.createHealthConfig('development'),
      retries: this.createRetriesConfig('development')
    };
  }

  /**
   * ✅ CORRECTION: Configuration optimisée pour les tests
   */
  static createTestConfig(): DatabaseConfig {
    const limits = CONNECTION_LIMITS.test; // min: 1, max: 5, recommended: 2
    
    return {
      url: process.env.DATABASE_URL || '',
      maxConnections: this.parseInt(process.env.DB_MAX_CONNECTIONS, limits.recommended), // 2
      minConnections: this.parseInt(process.env.DB_MIN_CONNECTIONS, limits.min), // 1
      connectionTimeout: 5000, // Plus court pour les tests
      idleTimeout: 30000,
      queryTimeout: 10000,
      transactionTimeout: 5000,
      maxWait: 2000,
      ssl: false, // SSL désactivé en test
      logging: this.createLoggingConfig('test'),
      performance: this.createPerformanceConfig('test'),
      migration: this.createMigrationConfig('test'),
      health: this.createHealthConfig('test'),
      retries: this.createRetriesConfig('test')
    };
  }

  /**
   * ✅ CORRECTION: Configuration optimisée pour le staging
   */
  static createStagingConfig(): DatabaseConfig {
    const limits = CONNECTION_LIMITS.staging; // min: 5, max: 30, recommended: 10
    
    return {
      url: process.env.DATABASE_URL || '',
      maxConnections: this.parseInt(process.env.DB_MAX_CONNECTIONS, limits.recommended), // 10
      minConnections: this.parseInt(process.env.DB_MIN_CONNECTIONS, limits.min), // 5
      connectionTimeout: this.parseInt(process.env.DB_CONNECTION_TIMEOUT, 45000),
      idleTimeout: this.parseInt(process.env.DB_IDLE_TIMEOUT, 600000),
      queryTimeout: this.parseInt(process.env.DB_QUERY_TIMEOUT, 120000),
      transactionTimeout: this.parseInt(process.env.DB_TRANSACTION_TIMEOUT, 15000),
      maxWait: this.parseInt(process.env.DB_MAX_WAIT, 10000),
      ssl: this.createSSLConfig('staging'),
      logging: this.createLoggingConfig('staging'),
      performance: this.createPerformanceConfig('staging'),
      migration: this.createMigrationConfig('staging'),
      health: this.createHealthConfig('staging'),
      retries: this.createRetriesConfig('staging')
    };
  }

  /**
   * ✅ CORRECTION: Configuration optimisée pour la production
   */
  static createProductionConfig(): DatabaseConfig {
    const limits = CONNECTION_LIMITS.production; // min: 10, max: 100, recommended: 25
    
    return {
      url: process.env.DATABASE_URL || '',
      maxConnections: this.parseInt(process.env.DB_MAX_CONNECTIONS, limits.recommended), // 25
      minConnections: this.parseInt(process.env.DB_MIN_CONNECTIONS, limits.min), // 10
      connectionTimeout: this.parseInt(process.env.DB_CONNECTION_TIMEOUT, 60000),
      idleTimeout: this.parseInt(process.env.DB_IDLE_TIMEOUT, 900000), // 15 minutes
      queryTimeout: this.parseInt(process.env.DB_QUERY_TIMEOUT, 180000), // 3 minutes
      transactionTimeout: this.parseInt(process.env.DB_TRANSACTION_TIMEOUT, 30000),
      maxWait: this.parseInt(process.env.DB_MAX_WAIT, 30000),
      ssl: this.createSSLConfig('production'),
      logging: this.createLoggingConfig('production'),
      performance: this.createPerformanceConfig('production'),
      migration: this.createMigrationConfig('production'),
      health: this.createHealthConfig('production'),
      retries: this.createRetriesConfig('production')
    };
  }

  /**
   * ✅ CORRECTION: Crée la configuration SSL
   */
  static createSSLConfig(env: string): DatabaseSSLConfig | boolean {
    // SSL activé par défaut pour production ET staging
    const sslEnabled = this.parseBoolean(
      process.env.DB_SSL_ENABLED, 
      env === 'production' || env === 'staging'
    );
    
    if (!sslEnabled) {
      return false;
    }

    return {
      enabled: true,
      rejectUnauthorized: this.parseBoolean(
        process.env.DB_SSL_REJECT_UNAUTHORIZED, 
        env === 'production' || env === 'staging'
      ),
      ca: process.env.DB_SSL_CA,
      cert: process.env.DB_SSL_CERT,
      key: process.env.DB_SSL_KEY
    };
  }

  /**
   * ✅ CORRECTION: Crée la configuration de logging
   */
  static createLoggingConfig(env: string): DatabaseLoggingConfig {
    const defaultLevel: ('query' | 'info' | 'warn' | 'error')[] = 
      env === 'production' ? ['error'] : 
      env === 'test' ? ['error'] : 
      env === 'staging' ? ['warn', 'error'] :
      ['query', 'info', 'warn', 'error'];
    
    const levelStr = process.env.DB_LOG_LEVEL;
    let level: ('query' | 'info' | 'warn' | 'error')[] = defaultLevel;
    
    if (levelStr) {
      const validLevels = ['query', 'info', 'warn', 'error'] as const;
      const parsedLevels = levelStr.split(',').map(l => l.trim().toLowerCase());
      
      const filteredLevels = parsedLevels.filter((l): l is 'query' | 'info' | 'warn' | 'error' => 
        validLevels.includes(l as any)
      );
      
      if (filteredLevels.length > 0) {
        level = filteredLevels;
      } else {
        console.warn(`⚠️  Invalid DB_LOG_LEVEL "${levelStr}", using default: ${defaultLevel.join(',')}`);
      }
    }

    return {
      enabled: this.parseBoolean(process.env.DB_LOG_ENABLED, env !== 'production'),
      level,
      slowQueryThreshold: this.parseInt(process.env.DB_SLOW_QUERY_THRESHOLD, env === 'production' ? 2000 : 1000),
      colorize: env === 'development',
      includeParameters: env === 'development'
    };
  }

  /**
   * Crée la configuration de performance
   */
  static createPerformanceConfig(env: string): DatabasePerformanceConfig {
    return {
      statementCacheSize: this.parseInt(process.env.DB_STATEMENT_CACHE_SIZE, env === 'production' ? 1000 : 100),
      connectionIdleTimeout: this.parseInt(process.env.DB_CONNECTION_IDLE_TIMEOUT, env === 'production' ? 900000 : 300000),
      acquireTimeout: this.parseInt(process.env.DB_ACQUIRE_TIMEOUT, env === 'production' ? 60000 : 30000),
      createTimeout: this.parseInt(process.env.DB_CREATE_TIMEOUT, env === 'production' ? 30000 : 15000),
      destroyTimeout: this.parseInt(process.env.DB_DESTROY_TIMEOUT, 5000),
      reapInterval: this.parseInt(process.env.DB_REAP_INTERVAL, env === 'production' ? 10000 : 5000),
      evictionRunIntervalMillis: this.parseInt(process.env.DB_EVICTION_RUN_INTERVAL, 300000),
      numTestsPerEvictionRun: this.parseInt(process.env.DB_NUM_TESTS_PER_EVICTION, 3)
    };
  }

  /**
   * ✅ CORRECTION: Configuration des migrations
   */
  static createMigrationConfig(env: string): DatabaseMigrationConfig {
    return {
      autoMigrate: this.parseBoolean(process.env.DB_AUTO_MIGRATE, env === 'development'),
      migrationPath: process.env.DB_MIGRATION_PATH || './prisma/migrations',
      seedOnCreate: this.parseBoolean(process.env.DB_SEED_ON_CREATE, env === 'development'),
      createDatabase: this.parseBoolean(process.env.DB_CREATE_DATABASE, env === 'development'),
      dropDatabase: this.parseBoolean(process.env.DB_DROP_DATABASE, false)
    };
  }

  /**
   * Crée la configuration de health check
   */
  static createHealthConfig(env: string): DatabaseHealthConfig {
    return {
      enableHealthCheck: this.parseBoolean(process.env.DB_ENABLE_HEALTH_CHECK, true),
      healthCheckInterval: this.parseInt(process.env.DB_HEALTH_CHECK_INTERVAL, env === 'production' ? 30000 : 60000),
      maxHealthCheckFailures: this.parseInt(process.env.DB_MAX_HEALTH_CHECK_FAILURES, 3),
      healthCheckTimeout: this.parseInt(process.env.DB_HEALTH_CHECK_TIMEOUT, 5000)
    };
  }

  /**
   * ✅ CORRECTION: Configuration de retry
   */
  static createRetriesConfig(env: string): DatabaseConfig['retries'] {
    return {
      enabled: this.parseBoolean(process.env.DB_RETRIES_ENABLED, env !== 'test'),
      maxRetries: this.parseInt(process.env.DB_MAX_RETRIES, env === 'production' ? 5 : 3),
      delay: this.parseInt(process.env.DB_RETRY_DELAY, 1000),
      factor: parseFloat(process.env.DB_RETRY_FACTOR || '2'),
      maxDelay: this.parseInt(process.env.DB_MAX_RETRY_DELAY, 30000)
    };
  }

  // ============================================================================
  // MÉTHODES STATIQUES POUR DÉFAUTS
  // ============================================================================

  static createDefaultLoggingConfig(env: string): DatabaseLoggingConfig {
    return this.createLoggingConfig(env);
  }

  static createDefaultPerformanceConfig(env: string): DatabasePerformanceConfig {
    return this.createPerformanceConfig(env);
  }

  static createDefaultMigrationConfig(env: string): DatabaseMigrationConfig {
    return this.createMigrationConfig(env);
  }

  static createDefaultHealthConfig(env: string): DatabaseHealthConfig {
    return this.createHealthConfig(env);
  }

  static createDefaultRetriesConfig(env: string): DatabaseConfig['retries'] {
    return this.createRetriesConfig(env);
  }

  // ============================================================================
  // MÉTHODES UTILITAIRES
  // ============================================================================

  /**
   * Méthode de debug pour comprendre les valeurs d'environnement
   */
  static debugEnvironmentVariables(): void {
    console.log('🔍 Database Environment Variables Debug:');
    console.log('NODE_ENV:', process.env.NODE_ENV);
    console.log('DATABASE_URL:', process.env.DATABASE_URL ? '[SET]' : '[NOT SET]');
    console.log('DB_MAX_CONNECTIONS:', process.env.DB_MAX_CONNECTIONS);
    console.log('DB_MIN_CONNECTIONS:', process.env.DB_MIN_CONNECTIONS);
    console.log('DB_CONNECTION_TIMEOUT:', process.env.DB_CONNECTION_TIMEOUT);
    console.log('DB_SSL_ENABLED:', process.env.DB_SSL_ENABLED);
  }

  /**
   * Parse une variable d'environnement booléenne
   */
  private static parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
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
    
    console.warn(`⚠️  Invalid boolean value "${value}", using default: ${defaultValue}`);
    return defaultValue;
  }

  /**
   * ✅ CORRECTION: Parse une variable d'environnement numérique
   */
  private static parseInt(value: string | undefined, defaultValue: number): number {
    if (value === undefined || value === null) {
      return defaultValue;
    }
    
    const trimmedValue = value.toString().trim();
    if (trimmedValue === '') {
      return defaultValue;
    }
    
    const parsed = parseInt(trimmedValue, 10);
    
    if (isNaN(parsed) || parsed < 0) {
      console.warn(`⚠️  Invalid number value "${value}", using default: ${defaultValue}`);
      return defaultValue;
    }
    
    return parsed;
  }

  /**
   * Calcule la taille optimale du pool de connexions
   */
  static calculateOptimalPoolSize(environment: string, availableMemory?: number): number {
    const limits = CONNECTION_LIMITS[environment as keyof EnvironmentLimits] || CONNECTION_LIMITS.development;
    let baseSize = limits.recommended;
    
    if (availableMemory) {
      // Estimation : ~512MB par connexion (très approximatif)
      const memoryFactor = Math.floor(availableMemory / 512);
      baseSize = Math.min(limits.max, baseSize + memoryFactor);
    }
    
    return Math.max(limits.min, Math.min(limits.max, baseSize));
  }

  /**
   * Adapte les timeouts selon la latence réseau
   */
  static adaptTimeouts(baseConfig: DatabaseConfig, networkLatency: number): DatabaseConfig {
    if (networkLatency <= 50) return baseConfig; // Latence acceptable
    
    const multiplier = networkLatency > 200 ? 2 : 1.5;
    
    return {
      ...baseConfig,
      connectionTimeout: Math.round(baseConfig.connectionTimeout * multiplier),
      queryTimeout: Math.round(baseConfig.queryTimeout * multiplier),
      transactionTimeout: Math.round(baseConfig.transactionTimeout * multiplier)
    };
  }
}

// ============================================================================
// EXPORT DE LA CONFIGURATION
// ============================================================================

/**
 * Configuration principale de la base de données
 * Utilisable avec @Inject(databaseConfig.KEY) dans les services
 */
export const databaseConfig = registerAs('database', () => {
  try {
    return DatabaseConfigFactory.create();
  } catch (error) {
    // En cas d'erreur de configuration, propager l'erreur au lieu de masquer
    console.error('Failed to create database configuration:', error.message);
    throw error;
  }
});

/**
 * Type pour l'injection de dépendance
 * Usage: @Inject(databaseConfig.KEY) private readonly config: ConfigType<typeof databaseConfig>
 */
export type DatabaseConfigType = ReturnType<typeof databaseConfig>;

// ============================================================================
// EXPORTS ADDITIONNELS POUR UTILISATION EXTERNE
// ============================================================================

export {
  DatabaseConfigFactory as DatabaseConfigurationFactory,
  DatabaseConfigValidator as DatabaseValidator,
  CONNECTION_LIMITS as DatabaseConnectionLimits,
  ENVIRONMENT_MAPPINGS as DatabaseEnvironmentMappings
};

// ============================================================================
// EXPORTS SUPPLÉMENTAIRES POUR app.config.ts
// ============================================================================

/**
 * Crée la configuration de logging pour app.config.ts
 */
export function createAppLoggingConfig(nodeEnv: string): {
  level: 'error' | 'warn' | 'info' | 'debug' | 'verbose';
  format: 'json' | 'text';
  enableColors: boolean;
  timestamp: boolean;
} {
  let defaultLevel: 'error' | 'warn' | 'info' | 'debug' | 'verbose';
  
  switch (nodeEnv) {
    case 'production':
      defaultLevel = 'info';
      break;
    case 'test':
      defaultLevel = 'error';
      break;
    case 'development':
    default:
      defaultLevel = 'debug';
      break;
  }
  
  const level = (process.env.LOG_LEVEL as 'error' | 'warn' | 'info' | 'debug' | 'verbose') || defaultLevel;
  
  return {
    level,
    format: (process.env.LOG_FORMAT as 'json' | 'text') || 
            (nodeEnv === 'production' ? 'json' : 'text'),
    enableColors: parseBoolean(process.env.LOG_COLORS, nodeEnv === 'development'),
    timestamp: parseBoolean(process.env.LOG_TIMESTAMP, true),
  };
}

/**
 * Parse une variable d'environnement booléenne (utilitaire public)
 */
export function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
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
  
  console.warn(`⚠️  Invalid boolean value "${value}", using default: ${defaultValue}`);
  return defaultValue;
}