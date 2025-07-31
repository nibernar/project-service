// src/config/app.config.ts

import { registerAs } from '@nestjs/config';
import { readFileSync } from 'fs';
import { join } from 'path';

// ============================================================================
// INTERFACES DE CONFIGURATION
// ============================================================================

export interface ServerConfig {
  port: number;
  host: string;
  apiPrefix: string;
  globalTimeout: number;
  bodyLimit: string;
  compressionEnabled: boolean;
}

export interface EnvironmentConfig {
  nodeEnv: 'development' | 'staging' | 'production' | 'test';
  isDevelopment: boolean;
  isProduction: boolean;
  isTest: boolean;
  appName: string;
  appVersion: string;
  buildTimestamp: string;
}

export interface CorsConfig {
  enabled: boolean;
  origin: string | string[] | boolean;
  credentials: boolean;
  methods: string[];
  allowedHeaders: string[];
}

export interface RateLimitConfig {
  enabled: boolean;
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests: boolean;
}

export interface SecurityConfig {
  cors: CorsConfig;
  rateLimit: RateLimitConfig;
  trustedProxies: string[];
  apiKeyHeader: string;
}

export interface ServiceConfig {
  baseUrl: string;
  timeout: number;
  retries: number;
  apiKey?: string;
}

export interface ExternalServicesConfig {
  authService: ServiceConfig;
  orchestrationService: ServiceConfig;
  storageService: ServiceConfig;
  costTrackingService: ServiceConfig;
  apiGateway: ServiceConfig;
}

export interface FeaturesConfig {
  exportEnabled: boolean;
  statisticsEnabled: boolean;
  cacheEnabled: boolean;
  eventsEnabled: boolean;
  healthChecksEnabled: boolean;
  swaggerEnabled: boolean;
  debugMode: boolean;
}

export interface LoggingConfig {
  level: 'error' | 'warn' | 'info' | 'debug' | 'verbose';
  format: 'json' | 'text';
  enableColors: boolean;
  timestamp: boolean;
}

export interface MetricsConfig {
  enabled: boolean;
  path: string;
  defaultLabels: Record<string, string>;
}

export interface TracingConfig {
  enabled: boolean;
  serviceName: string;
  sampleRate: number;
}

export interface ObservabilityConfig {
  logging: LoggingConfig;
  metrics: MetricsConfig;
  tracing: TracingConfig;
}

export interface AppConfig {
  server: ServerConfig;
  environment: EnvironmentConfig;
  security: SecurityConfig;
  externalServices: ExternalServicesConfig;
  features: FeaturesConfig;
  observability: ObservabilityConfig;
}

// ============================================================================
// ERREURS PERSONNALISÉES
// ============================================================================

export class ConfigurationError extends Error {
  constructor(
    message: string,
    public readonly variable?: string,
    public readonly value?: any
  ) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

export class ValidationError extends ConfigurationError {
  constructor(
    message: string,
    variable: string,
    value: any,
    public readonly suggestion?: string
  ) {
    super(message, variable, value);
    this.name = 'ValidationError';
  }
}

// ============================================================================
// FACTORY DE CONFIGURATION
// ============================================================================

export class AppConfigFactory {
  /**
   * Point d'entrée principal pour créer la configuration complète
   */
  static create(): AppConfig {
    try {
      // Validation préliminaire de l'environnement
      this.validateEnvironment();

      return {
        server: this.createServerConfig(),
        environment: this.createEnvironmentConfig(),
        security: this.createSecurityConfig(),
        externalServices: this.createExternalServicesConfig(),
        features: this.createFeaturesConfig(),
        observability: this.createObservabilityConfig(),
      };
    } catch (error) {
      console.error('❌ Configuration Error:', error.message);
      throw error;
    }
  }

  /**
   * Valide la présence des variables d'environnement critiques
   */
  private static validateEnvironment(): void {
    const requiredVars = ['DATABASE_URL'];
    const missingVars = requiredVars.filter(varName => !process.env[varName]);

    if (missingVars.length > 0) {
      throw new ConfigurationError(
        `Missing required environment variables: ${missingVars.join(', ')}`
      );
    }

    // Avertissements pour variables optionnelles importantes
    const optionalImportantVars = [
      'REDIS_HOST',
      'AUTH_SERVICE_URL',
      'ORCHESTRATION_SERVICE_URL'
    ];

    optionalImportantVars.forEach(varName => {
      if (!process.env[varName]) {
        console.warn(`⚠️  Optional environment variable not set: ${varName}`);
      }
    });
  }

  /**
   * Crée la configuration serveur
   */
  private static createServerConfig(): ServerConfig {
    const port = this.parseInt(process.env.PORT, 3000);
    
    if (port < 1 || port > 65535) {
      throw new ValidationError(
        'Port must be between 1 and 65535',
        'PORT',
        port,
        'Use a valid port number like 3000'
      );
    }

    return {
      port,
      host: process.env.HOST || '0.0.0.0',
      apiPrefix: process.env.API_PREFIX || 'api/v1',
      globalTimeout: this.parseInt(process.env.GLOBAL_TIMEOUT, 30000),
      bodyLimit: process.env.BODY_LIMIT || '10mb',
      compressionEnabled: this.parseBoolean(process.env.COMPRESSION_ENABLED, true),
    };
  }

  /**
   * Crée la configuration d'environnement
   */
  private static createEnvironmentConfig(): EnvironmentConfig {
    const nodeEnv = process.env.NODE_ENV || 'development';
    
    // Validation de l'environnement
    const validEnvs = ['development', 'staging', 'production', 'test'] as const;
    if (!validEnvs.includes(nodeEnv as any)) {
      throw new ValidationError(
        `Invalid NODE_ENV value`,
        'NODE_ENV',
        nodeEnv,
        `Use one of: ${validEnvs.join(', ')}`
      );
    }

    const typedNodeEnv = nodeEnv as 'development' | 'staging' | 'production' | 'test';

    return {
      nodeEnv: typedNodeEnv,
      isDevelopment: typedNodeEnv === 'development',
      isProduction: typedNodeEnv === 'production',
      isTest: typedNodeEnv === 'test',
      appName: process.env.APP_NAME || 'project-service',
      appVersion: this.getAppVersion(),
      buildTimestamp: process.env.BUILD_TIMESTAMP || new Date().toISOString(),
    };
  }

  /**
   * Crée la configuration de sécurité
   */
  private static createSecurityConfig(): SecurityConfig {
    const nodeEnv = process.env.NODE_ENV || 'development';
    
    return {
      cors: this.createCorsConfig(nodeEnv),
      rateLimit: this.createRateLimitConfig(nodeEnv),
      trustedProxies: this.parseArray(process.env.TRUSTED_PROXIES),
      apiKeyHeader: process.env.API_KEY_HEADER || 'x-api-key',
    };
  }

  /**
   * Crée la configuration CORS
   */
  private static createCorsConfig(nodeEnv: string): CorsConfig {
    const corsEnabled = this.parseBoolean(process.env.CORS_ENABLED, true);
    
    let origin: string | string[] | boolean = true;
    if (process.env.CORS_ORIGIN) {
      const origins = this.parseArray(process.env.CORS_ORIGIN);
      origin = origins.length === 1 ? origins[0] : origins;
    } else if (nodeEnv === 'production') {
      origin = false;
    }

    // ✅ CORRECTION: Gestion correcte des tableaux vides
    const corsMethodsFromEnv = this.parseArray(process.env.CORS_METHODS, ',');
    const corsMethods = corsMethodsFromEnv.length > 0 ? corsMethodsFromEnv : 
                      ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];

    const corsHeadersFromEnv = this.parseArray(process.env.CORS_ALLOWED_HEADERS, ',');
    const corsHeaders = corsHeadersFromEnv.length > 0 ? corsHeadersFromEnv :
                      ['Content-Type', 'Authorization', 'x-api-key'];

    return {
      enabled: corsEnabled,
      origin,
      credentials: this.parseBoolean(process.env.CORS_CREDENTIALS, true),
      methods: corsMethods,
      allowedHeaders: corsHeaders,
    };
  }

  /**
   * Crée la configuration de rate limiting
   */
  private static createRateLimitConfig(nodeEnv: string): RateLimitConfig {
    // Rate limiting plus strict en production
    const defaultMaxRequests = nodeEnv === 'production' ? 100 : 1000;
    
    return {
      enabled: this.parseBoolean(process.env.RATE_LIMIT_ENABLED, nodeEnv !== 'test'),
      windowMs: this.parseInt(process.env.RATE_LIMIT_WINDOW_MS, 60000),
      maxRequests: this.parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, defaultMaxRequests),
      skipSuccessfulRequests: this.parseBoolean(process.env.RATE_LIMIT_SKIP_SUCCESSFUL, false),
    };
  }

  /**
   * Crée la configuration des services externes
   */
  private static createExternalServicesConfig(): ExternalServicesConfig {
    return {
      authService: this.createServiceConfig('AUTH_SERVICE'),
      orchestrationService: this.createServiceConfig('ORCHESTRATION_SERVICE'),
      storageService: this.createServiceConfig('STORAGE_SERVICE'),
      costTrackingService: this.createServiceConfig('COST_TRACKING_SERVICE'),
      apiGateway: this.createServiceConfig('API_GATEWAY'),
    };
  }

  /**
   * Crée la configuration d'un service externe
   */
  private static createServiceConfig(prefix: string): ServiceConfig {
    const baseUrl = process.env[`${prefix}_URL`];
    
    return {
      baseUrl: baseUrl || `http://localhost:3000`, // Fallback pour développement
      timeout: this.parseInt(process.env[`${prefix}_TIMEOUT`], 5000),
      retries: this.parseInt(process.env[`${prefix}_RETRIES`], 3),
      apiKey: process.env[`${prefix}_API_KEY`],
    };
  }

  /**
   * Crée la configuration des fonctionnalités
   */
  private static createFeaturesConfig(): FeaturesConfig {
    const nodeEnv = process.env.NODE_ENV || 'development';
    const isDev = nodeEnv === 'development';
    const isTest = nodeEnv === 'test';

    return {
      exportEnabled: this.parseBoolean(process.env.EXPORT_ENABLED, !isTest),
      statisticsEnabled: this.parseBoolean(process.env.STATISTICS_ENABLED, !isTest),
      cacheEnabled: this.parseBoolean(process.env.CACHE_ENABLED, !isTest),
      eventsEnabled: this.parseBoolean(process.env.EVENTS_ENABLED, !isTest),
      healthChecksEnabled: this.parseBoolean(process.env.HEALTH_CHECKS_ENABLED, true),
      swaggerEnabled: this.parseBoolean(process.env.SWAGGER_ENABLED, isDev),
      debugMode: this.parseBoolean(process.env.DEBUG_MODE, isDev),
    };
  }

  /**
   * Crée la configuration d'observabilité
   */
  private static createObservabilityConfig(): ObservabilityConfig {
    const nodeEnv = process.env.NODE_ENV || 'development';
    
    return {
      logging: this.createLoggingConfig(nodeEnv),
      metrics: this.createMetricsConfig(nodeEnv),
      tracing: this.createTracingConfig(nodeEnv),
    };
  }

  /**
   * Crée la configuration de logging
   */
  private static createLoggingConfig(nodeEnv: string): LoggingConfig {
    let defaultLevel: LoggingConfig['level'];
    
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
    
    const level = process.env.LOG_LEVEL as LoggingConfig['level'] || defaultLevel;
    
    return {
      level,
      format: process.env.LOG_FORMAT as 'json' | 'text' || 
              (nodeEnv === 'production' ? 'json' : 'text'),
      enableColors: this.parseBoolean(process.env.LOG_COLORS, nodeEnv === 'development'),
      timestamp: this.parseBoolean(process.env.LOG_TIMESTAMP, true),
    };
  }

  /**
   * Crée la configuration des métriques
   */
  private static createMetricsConfig(nodeEnv: string): MetricsConfig {
    const appName = process.env.APP_NAME || 'project-service';
    
    return {
      enabled: this.parseBoolean(process.env.METRICS_ENABLED, nodeEnv !== 'test'),
      path: process.env.METRICS_PATH || '/metrics',
      defaultLabels: {
        service: appName,
        environment: nodeEnv,
        version: this.getAppVersion(),
      },
    };
  }

  /**
   * Crée la configuration de tracing
   */
  private static createTracingConfig(nodeEnv: string): TracingConfig {
    const appName = process.env.APP_NAME || 'project-service';
    
    return {
      enabled: this.parseBoolean(process.env.TRACING_ENABLED, false),
      serviceName: process.env.TRACING_SERVICE_NAME || appName,
      sampleRate: parseFloat(process.env.TRACING_SAMPLE_RATE || '0.1'),
    };
  }

  // ============================================================================
  // MÉTHODES UTILITAIRES
  // ============================================================================

  /**
   * Parse une variable d'environnement booléenne
   */
  private static parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
    if (value === undefined) return defaultValue;
    
    const lowerValue = value.toLowerCase().trim();
    
    if (['true', '1', 'yes', 'on'].includes(lowerValue)) return true;
    if (['false', '0', 'no', 'off'].includes(lowerValue)) return false;
    
    console.warn(`⚠️  Invalid boolean value "${value}", using default: ${defaultValue}`);
    return defaultValue;
  }

  /**
   * Parse une variable d'environnement numérique
   */
  private static parseInt(value: string | undefined, defaultValue: number): number {
    if (value === undefined) return defaultValue;
    
    const parsed = parseInt(value, 10);
    
    if (isNaN(parsed)) {
      console.warn(`⚠️  Invalid number value "${value}", using default: ${defaultValue}`);
      return defaultValue;
    }
    
    return parsed;
  }

  /**
   * Parse une variable d'environnement en tableau
   */
  private static parseArray(value: string | undefined, delimiter = ','): string[] {
    if (!value) return [];
    
    return value
      .split(delimiter)
      .map(item => item.trim())
      .filter(item => item.length > 0);
  }

  /**
   * Valide et normalise une URL
   */
  private static parseUrl(value: string | undefined, required = false): string | undefined {
    if (!value) {
      if (required) {
        throw new ConfigurationError('Required URL is missing');
      }
      return undefined;
    }
    
    try {
      const url = new URL(value);
      // Supprime le slash final pour normaliser
      return url.toString().replace(/\/$/, '');
    } catch (error) {
      throw new ValidationError(
        'Invalid URL format',
        'URL',
        value,
        'Use format: http://hostname:port or https://hostname:port'
      );
    }
  }

  /**
   * Récupère la version de l'application depuis package.json
   */
  private static getAppVersion(): string {
    try {
      const packageJsonPath = join(process.cwd(), 'package.json');
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
      return packageJson.version || '0.0.1';
    } catch (error) {
      console.warn('⚠️  Could not read package.json version, using default');
      return '0.0.1';
    }
  }
}

// ============================================================================
// EXPORT DE LA CONFIGURATION
// ============================================================================

/**
 * Configuration principale de l'application
 * Utilisable avec @Inject(appConfig.KEY) dans les services
 */
export const appConfig = registerAs('app', () => AppConfigFactory.create());

/**
 * Type pour l'injection de dépendance
 * Usage: @Inject(appConfig.KEY) private readonly config: ConfigType<typeof appConfig>
 */
export type AppConfigType = ReturnType<typeof appConfig>;
