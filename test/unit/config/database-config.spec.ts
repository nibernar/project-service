// test/unit/config/database-config.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  DatabaseConfigurationError,
  DatabaseValidationError,
  DatabaseConnectionError,
  DatabaseConfigValidator,
  DatabaseConfigFactory,
  DatabaseConfig,
  databaseConfig,
  CONNECTION_LIMITS,
} from '../../../src/config/database.config';

// Helper pour créer un DatabaseConfig complet avec overrides
function createTestDatabaseConfig(
  overrides: Partial<DatabaseConfig> = {},
): DatabaseConfig {
  return {
    url: 'postgresql://test@localhost/db',
    maxConnections: 10,
    minConnections: 2,
    connectionTimeout: 30000,
    idleTimeout: 300000,
    queryTimeout: 60000,
    transactionTimeout: 10000,
    maxWait: 5000,
    ssl: false,
    logging: {
      enabled: true,
      level: ['error'],
      slowQueryThreshold: 1000,
      colorize: false,
      includeParameters: false,
    },
    performance: {
      statementCacheSize: 100,
      connectionIdleTimeout: 300000,
      acquireTimeout: 30000,
      createTimeout: 15000,
      destroyTimeout: 5000,
      reapInterval: 5000,
      evictionRunIntervalMillis: 300000,
      numTestsPerEvictionRun: 3,
    },
    migration: {
      autoMigrate: false,
      migrationPath: './prisma/migrations',
      seedOnCreate: false,
      createDatabase: false,
      dropDatabase: false,
    },
    health: {
      enableHealthCheck: true,
      healthCheckInterval: 60000,
      maxHealthCheckFailures: 3,
      healthCheckTimeout: 5000,
    },
    retries: {
      enabled: true,
      maxRetries: 3,
      delay: 1000,
      factor: 2,
      maxDelay: 30000,
    },
    ...overrides,
  };
}

describe('Database Configuration', () => {
  // Sauvegarder les variables d'environnement
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset des variables d'environnement pour chaque test
    jest.resetModules();
    jest.clearAllMocks();
    process.env = { ...originalEnv };

    // Variables requises par défaut
    process.env.DATABASE_URL = 'postgresql://test@localhost/db';

    // Nettoyer toutes les variables DB_*
    Object.keys(process.env).forEach((key) => {
      if (key.startsWith('DB_')) {
        delete process.env[key];
      }
    });
  });

  afterEach(() => {
    // Restaurer console.error/warn après les tests
    jest.restoreAllMocks();
  });

  afterAll(() => {
    // Restaurer les variables d'environnement originales
    process.env = originalEnv;
  });

  // ============================================================================
  // TESTS DES CLASSES D'ERREURS
  // ============================================================================

  describe('Error Classes', () => {
    describe('DatabaseConfigurationError', () => {
      it('should create error with message', () => {
        const error = new DatabaseConfigurationError('Test error');

        expect(error.message).toBe('Test error');
        expect(error.name).toBe('DatabaseConfigurationError');
        expect(error).toBeInstanceOf(Error);
      });

      it('should store variable and value', () => {
        const error = new DatabaseConfigurationError(
          'Invalid config',
          'DB_MAX_CONNECTIONS',
          'invalid',
        );

        expect(error.variable).toBe('DB_MAX_CONNECTIONS');
        expect(error.value).toBe('invalid');
      });

      it('should work without optional parameters', () => {
        const error = new DatabaseConfigurationError('Simple error');

        expect(error.variable).toBeUndefined();
        expect(error.value).toBeUndefined();
      });
    });

    describe('DatabaseValidationError', () => {
      it('should extend DatabaseConfigurationError', () => {
        const error = new DatabaseValidationError(
          'Validation failed',
          'DB_URL',
          'invalid-url',
          'Use postgresql:// format',
        );

        expect(error).toBeInstanceOf(DatabaseConfigurationError);
        expect(error.name).toBe('DatabaseValidationError');
        expect(error.variable).toBe('DB_URL');
        expect(error.value).toBe('invalid-url');
        expect(error.suggestion).toBe('Use postgresql:// format');
      });

      it('should work without suggestion', () => {
        const error = new DatabaseValidationError(
          'Validation failed',
          'DB_URL',
          'invalid-url',
        );

        expect(error.suggestion).toBeUndefined();
      });
    });

    describe('DatabaseConnectionError', () => {
      it('should store original error', () => {
        const originalError = new Error('Connection failed');
        const error = new DatabaseConnectionError(
          'Database unavailable',
          originalError,
        );

        expect(error.originalError).toBe(originalError);
        expect(error.name).toBe('DatabaseConnectionError');
        expect(error.message).toBe('Database unavailable');
      });

      it('should work without original error', () => {
        const error = new DatabaseConnectionError('Database unavailable');

        expect(error.originalError).toBeUndefined();
      });
    });
  });

  // ============================================================================
  // TESTS DE VALIDATION
  // ============================================================================

  describe('Validation', () => {
    describe('validateConnectionUrl', () => {
      it('should accept valid PostgreSQL URLs', () => {
        const validUrls = [
          'postgresql://user:pass@localhost:5432/testdb',
          'postgres://user:pass@host.com:5432/db',
          'postgresql://user@localhost/db',
          'postgresql://localhost:5432/db',
          'postgresql://user:pass@127.0.0.1:5432/testdb',
          'postgresql://user:pass@example.com:5432/db?sslmode=require',
        ];

        validUrls.forEach((url) => {
          expect(() =>
            DatabaseConfigValidator.validateConnectionUrl(url),
          ).not.toThrow();
          expect(DatabaseConfigValidator.validateConnectionUrl(url)).toBe(true);
        });
      });

      it('should reject invalid protocols', () => {
        const invalidUrls = [
          'mysql://user:pass@localhost:3306/db',
          'http://localhost:5432/db',
          'ftp://user@host/db',
          'redis://localhost:6379',
        ];

        invalidUrls.forEach((url) => {
          expect(() =>
            DatabaseConfigValidator.validateConnectionUrl(url),
          ).toThrow(DatabaseValidationError);

          try {
            DatabaseConfigValidator.validateConnectionUrl(url);
          } catch (error) {
            expect(error).toBeInstanceOf(DatabaseValidationError);
            expect(error.message).toContain('Invalid database URL protocol');
            expect(error.variable).toBe('DATABASE_URL');
            expect(error.suggestion).toContain('postgresql://');
          }
        });
      });

      it('should reject URLs without hostname', () => {
        const urlsWithoutHost = ['postgresql:///db', 'postgresql://:5432/db'];

        urlsWithoutHost.forEach((url) => {
          expect(() =>
            DatabaseConfigValidator.validateConnectionUrl(url),
          ).toThrow('Database URL must include hostname');
        });
      });

      it('should reject URLs without database name', () => {
        const urlsWithoutDb = [
          'postgresql://user@localhost:5432/',
          'postgresql://user@localhost:5432',
          'postgresql://user@localhost/',
        ];

        urlsWithoutDb.forEach((url) => {
          expect(() =>
            DatabaseConfigValidator.validateConnectionUrl(url),
          ).toThrow('Database URL must include database name');
        });
      });

      it('should reject empty/null URLs', () => {
        expect(() => DatabaseConfigValidator.validateConnectionUrl('')).toThrow(
          'Database URL is required',
        );
        expect(() =>
          DatabaseConfigValidator.validateConnectionUrl(null as any),
        ).toThrow('Database URL is required');
        expect(() =>
          DatabaseConfigValidator.validateConnectionUrl(undefined as any),
        ).toThrow('Database URL is required');
      });

      it('should handle malformed URLs gracefully', () => {
        const malformedUrls = [
          'not-a-url',
          'postgresql://[invalid',
          'postgresql://user:pass@[::1:5432/db',
        ];

        malformedUrls.forEach((url) => {
          expect(() =>
            DatabaseConfigValidator.validateConnectionUrl(url),
          ).toThrow(DatabaseValidationError);

          try {
            DatabaseConfigValidator.validateConnectionUrl(url);
          } catch (error) {
            expect(error.message).toContain('Invalid database URL format');
            expect(error.suggestion).toContain('postgresql://');
          }
        });
      });
    });

    describe('validatePoolConfiguration', () => {
      it('should accept valid pool configuration', () => {
        const validConfig = createTestDatabaseConfig({
          maxConnections: 10,
          minConnections: 2,
          connectionTimeout: 30000,
          idleTimeout: 300000,
          queryTimeout: 60000,
        });

        expect(() =>
          DatabaseConfigValidator.validatePoolConfiguration(validConfig),
        ).not.toThrow();
      });

      it('should reject minConnections >= maxConnections', () => {
        const configs = [
          { max: 5, min: 5 }, // Equal
          { max: 5, min: 6 }, // Min greater than max
          { max: 1, min: 1 }, // Both equal to 1
        ];

        configs.forEach(({ max, min }) => {
          const invalidConfig = createTestDatabaseConfig({
            maxConnections: max,
            minConnections: min,
          });

          expect(() =>
            DatabaseConfigValidator.validatePoolConfiguration(invalidConfig),
          ).toThrow('Minimum connections must be less than maximum connections');
        });
      });

      it('should reject negative or zero maxConnections', () => {
        const invalidValues = [0, -1, -10];

        invalidValues.forEach((value) => {
          const invalidConfig = createTestDatabaseConfig({
            maxConnections: value,
            minConnections: 1,
          });

          expect(() =>
            DatabaseConfigValidator.validatePoolConfiguration(invalidConfig),
          ).toThrow('Maximum connections must be greater than 0');
        });
      });

      it('should reject invalid timeout values', () => {
        const timeoutTests = [
          { name: 'connection timeout', field: 'connectionTimeout', value: 0 },
          {
            name: 'connection timeout',
            field: 'connectionTimeout',
            value: -1000,
          },
          { name: 'query timeout', field: 'queryTimeout', value: 0 },
          { name: 'query timeout', field: 'queryTimeout', value: -5000 },
        ];

        timeoutTests.forEach(({ name, field, value }) => {
          const invalidConfig = createTestDatabaseConfig({
            [field]: value,
          });

          expect(() =>
            DatabaseConfigValidator.validatePoolConfiguration(invalidConfig),
          ).toThrow(
            `${name.charAt(0).toUpperCase() + name.slice(1)} must be greater than 0`,
          );
        });
      });

      it('should reject invalid timeout relationships', () => {
        const invalidConfig = createTestDatabaseConfig({
          connectionTimeout: 60000,
          idleTimeout: 30000, // Less than connection timeout
        });

        expect(() =>
          DatabaseConfigValidator.validatePoolConfiguration(invalidConfig),
        ).toThrow('Idle timeout should be greater than connection timeout');
      });
    });

    describe('validateEnvironmentVariables', () => {
      it('should pass when DATABASE_URL is set', () => {
        process.env.DATABASE_URL = 'postgresql://test@localhost/db';

        expect(() =>
          DatabaseConfigValidator.validateEnvironmentVariables(),
        ).not.toThrow();
      });

      it('should throw when DATABASE_URL is missing', () => {
        delete process.env.DATABASE_URL;

        expect(() =>
          DatabaseConfigValidator.validateEnvironmentVariables(),
        ).toThrow(DatabaseConfigurationError);

        try {
          DatabaseConfigValidator.validateEnvironmentVariables();
        } catch (error) {
          expect(error.message).toContain(
            'Missing required database environment variables: DATABASE_URL',
          );
        }
      });

      it('should warn about missing optional variables', () => {
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
        process.env.DATABASE_URL = 'postgresql://test@localhost/db';
        delete process.env.DB_MAX_CONNECTIONS;
        delete process.env.DB_CONNECTION_TIMEOUT;
        delete process.env.DB_SSL_ENABLED;

        DatabaseConfigValidator.validateEnvironmentVariables();

        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining(
            'Optional database environment variable not set: DB_MAX_CONNECTIONS',
          ),
        );
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining(
            'Optional database environment variable not set: DB_CONNECTION_TIMEOUT',
          ),
        );
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining(
            'Optional database environment variable not set: DB_SSL_ENABLED',
          ),
        );

        consoleSpy.mockRestore();
      });

      it('should not warn if optional variables are set', () => {
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
        process.env.DATABASE_URL = 'postgresql://test@localhost/db';
        process.env.DB_MAX_CONNECTIONS = '10';
        process.env.DB_CONNECTION_TIMEOUT = '30000';
        process.env.DB_SSL_ENABLED = 'true';

        DatabaseConfigValidator.validateEnvironmentVariables();

        expect(consoleSpy).not.toHaveBeenCalled();

        consoleSpy.mockRestore();
      });
    });

    describe('sanitizeConfig', () => {
      beforeEach(() => {
        process.env.DATABASE_URL = 'postgresql://test@localhost/db';
        process.env.NODE_ENV = 'test';
      });

      it('should return complete config with defaults', () => {
        const partialConfig = {
          url: 'postgresql://test@localhost/db',
          maxConnections: 5,
        };

        const result = DatabaseConfigValidator.sanitizeConfig(partialConfig);

        expect(result).toHaveProperty('url', 'postgresql://test@localhost/db');
        expect(result).toHaveProperty('maxConnections', 5);
        expect(result).toHaveProperty('minConnections');
        expect(result).toHaveProperty('connectionTimeout');
        expect(result).toHaveProperty('ssl');
        expect(result).toHaveProperty('logging');
        expect(result).toHaveProperty('performance');
        expect(result).toHaveProperty('migration');
        expect(result).toHaveProperty('health');
        expect(result).toHaveProperty('retries');
      });

      it('should apply environment-based limits', () => {
        process.env.NODE_ENV = 'production';

        const result = DatabaseConfigValidator.sanitizeConfig({});

        expect(result.maxConnections).toBe(25); // Production limit
        expect(result.minConnections).toBe(10); // Production min
      });

      it('should use environment variables as fallback', () => {
        process.env.DATABASE_URL = 'postgresql://env@localhost/envdb';

        const result = DatabaseConfigValidator.sanitizeConfig({});

        expect(result.url).toBe('postgresql://env@localhost/envdb');
      });

      it('should respect provided values over defaults', () => {
        const customConfig = {
          maxConnections: 15,
          connectionTimeout: 45000,
        };

        const result = DatabaseConfigValidator.sanitizeConfig(customConfig);

        expect(result.maxConnections).toBe(15);
        expect(result.connectionTimeout).toBe(45000);
      });
    });
  });

  // ============================================================================
  // TESTS DE LA FACTORY
  // ============================================================================

  describe('Factory', () => {
    describe('create', () => {
      it('should create valid configuration with DATABASE_URL', () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

        const config = DatabaseConfigFactory.create();

        expect(config).toHaveProperty('url', 'postgresql://test@localhost/db');
        expect(config).toHaveProperty('maxConnections');
        expect(config).toHaveProperty('ssl');
        expect(config).toHaveProperty('logging');
        expect(config).toHaveProperty('performance');
        expect(config).toHaveProperty('migration');
        expect(config).toHaveProperty('health');
        expect(config).toHaveProperty('retries');

        // Aucune erreur ne devrait être loggée
        expect(consoleErrorSpy).not.toHaveBeenCalled();

        consoleErrorSpy.mockRestore();
      });

      it('should throw when DATABASE_URL is missing', () => {
        delete process.env.DATABASE_URL;
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

        expect(() => DatabaseConfigFactory.create()).toThrow(
          'Missing required database environment variables',
        );

        // Une erreur devrait être loggée
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          '❌ Database Configuration Error:',
          expect.stringContaining(
            'Missing required database environment variables',
          ),
        );

        consoleErrorSpy.mockRestore();
      });

      it('should apply environment-specific defaults', () => {
        process.env.NODE_ENV = 'production';

        const config = DatabaseConfigFactory.create();

        expect(config.maxConnections).toBe(25); // Production default
        expect(config.ssl).not.toBe(false); // SSL enabled in prod
        expect(config.logging.level).toEqual(['error']); // Only errors in prod
      });

      it('should validate final configuration', () => {
        process.env.DATABASE_URL = 'invalid-url';
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

        expect(() => DatabaseConfigFactory.create()).toThrow(
          'Invalid database URL format',
        );

        consoleErrorSpy.mockRestore();
      });
    });

    describe('createForEnvironment', () => {
      it('should create development config', () => {
        const config = DatabaseConfigFactory.createForEnvironment('development');

        expect(config.maxConnections).toBe(5);
        expect(config.minConnections).toBe(2);
        expect(config.connectionTimeout).toBe(30000);
        expect(config.ssl).toBe(false);
        expect(config.logging.enabled).toBe(true);
        expect(config.logging.colorize).toBe(true);
        expect(config.migration.autoMigrate).toBe(true);
      });

      it('should create test config with reduced limits', () => {
        const config = DatabaseConfigFactory.createForEnvironment('test');

        expect(config.maxConnections).toBe(2);
        expect(config.minConnections).toBe(1);
        expect(config.connectionTimeout).toBe(5000); // Shorter for tests
        expect(config.ssl).toBe(false);
        expect(config.logging.level).toEqual(['error']);
        expect(config.retries.enabled).toBe(false); // Disabled in test
      });

      it('should create staging config', () => {
        const config = DatabaseConfigFactory.createForEnvironment('staging');

        expect(config.maxConnections).toBe(10);
        expect(config.minConnections).toBe(5);
        expect(config.connectionTimeout).toBe(45000);
        expect(config.ssl).not.toBe(false); // SSL config object
      });

      it('should create production config with security', () => {
        const config = DatabaseConfigFactory.createForEnvironment('production');

        expect(config.maxConnections).toBe(25);
        expect(config.minConnections).toBe(10);
        expect(config.connectionTimeout).toBe(60000);
        expect(config.ssl).not.toBe(false); // SSL enabled
        expect(config.logging.level).toEqual(['error']); // Only errors
        expect(config.migration.autoMigrate).toBe(false); // No auto migration in prod
      });

      it('should fallback to development for unknown environment', () => {
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

        const config = DatabaseConfigFactory.createForEnvironment('unknown');

        expect(config.maxConnections).toBe(5); // Development default
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Unknown environment "unknown"'),
        );

        consoleSpy.mockRestore();
      });
    });

    describe('createSSLConfig', () => {
      it('should disable SSL for development', () => {
        const sslConfig = DatabaseConfigFactory.createSSLConfig('development');

        expect(sslConfig).toBe(false);
      });

      it('should disable SSL for test', () => {
        const sslConfig = DatabaseConfigFactory.createSSLConfig('test');

        expect(sslConfig).toBe(false);
      });

      it('should enable SSL for production by default', () => {
        const sslConfig = DatabaseConfigFactory.createSSLConfig('production');

        expect(sslConfig).toMatchObject({
          enabled: true,
          rejectUnauthorized: true,
        });
      });

      it('should respect SSL environment variables', () => {
        process.env.DB_SSL_ENABLED = 'true';
        process.env.DB_SSL_CA = '/path/to/ca.crt';
        process.env.DB_SSL_CERT = '/path/to/cert.crt';
        process.env.DB_SSL_KEY = '/path/to/key.key';
        process.env.DB_SSL_REJECT_UNAUTHORIZED = 'false';

        const sslConfig = DatabaseConfigFactory.createSSLConfig('development');

        expect(sslConfig).toMatchObject({
          enabled: true,
          rejectUnauthorized: false,
          ca: '/path/to/ca.crt',
          cert: '/path/to/cert.crt',
          key: '/path/to/key.key',
        });
      });

      it('should handle disabled SSL explicitly', () => {
        process.env.DB_SSL_ENABLED = 'false';

        const sslConfig = DatabaseConfigFactory.createSSLConfig('production');

        expect(sslConfig).toBe(false);
      });
    });

    describe('createLoggingConfig', () => {
      it('should create development logging config', () => {
        const config = DatabaseConfigFactory.createLoggingConfig('development');

        expect(config.enabled).toBe(true);
        expect(config.level).toEqual(['query', 'info', 'warn', 'error']);
        expect(config.colorize).toBe(true);
        expect(config.includeParameters).toBe(true);
        expect(config.slowQueryThreshold).toBe(1000);
      });

      it('should create production logging config', () => {
        const config = DatabaseConfigFactory.createLoggingConfig('production');

        expect(config.enabled).toBe(false);
        expect(config.level).toEqual(['error']);
        expect(config.colorize).toBe(false);
        expect(config.includeParameters).toBe(false);
        expect(config.slowQueryThreshold).toBe(2000);
      });

      it('should parse custom log levels', () => {
        process.env.DB_LOG_LEVEL = 'warn,error';

        const config = DatabaseConfigFactory.createLoggingConfig('development');

        expect(config.level).toEqual(['warn', 'error']);
      });

      it('should handle invalid log levels', () => {
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
        process.env.DB_LOG_LEVEL = 'invalid,unknown';

        const config = DatabaseConfigFactory.createLoggingConfig('development');

        expect(config.level).toEqual(['query', 'info', 'warn', 'error']); // Default
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Invalid DB_LOG_LEVEL'),
        );

        consoleSpy.mockRestore();
      });

      it('should handle mixed valid/invalid log levels', () => {
        process.env.DB_LOG_LEVEL = 'error,invalid,warn,unknown';

        const config = DatabaseConfigFactory.createLoggingConfig('development');

        expect(config.level).toEqual(['error', 'warn']); // Only valid ones
      });
    });
  });

  // ============================================================================
  // TESTS D'INTÉGRATION NESTJS
  // ============================================================================

  describe('NestJS Integration', () => {
    it('should work with NestJS ConfigModule', async () => {
      process.env.DATABASE_URL = 'postgresql://test@localhost/db';

      const module = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({
            load: [databaseConfig],
          }),
        ],
      }).compile();

      const config = module.get(databaseConfig.KEY);

      expect(config).toBeDefined();
      expect(config.url).toBe('postgresql://test@localhost/db');
      expect(config).toHaveProperty('maxConnections');
      expect(config).toHaveProperty('ssl');
      expect(config).toHaveProperty('logging');

      await module.close();
    });

    it('should be injectable with ConfigService', async () => {
      process.env.DATABASE_URL = 'postgresql://test@localhost/db';

      const testConfig = DatabaseConfigFactory.createForEnvironment('test');

      const module = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({
            load: [databaseConfig],
          }),
        ],
      })
        .overrideProvider(databaseConfig.KEY)
        .useValue(testConfig)
        .compile();

      const configService = module.get<ConfigService>(ConfigService);
      const config = configService.get<DatabaseConfig>('database');

      expect(config).toBeDefined();
      expect(config?.url).toBe('postgresql://test@localhost/db');
      expect(config?.maxConnections).toBe(CONNECTION_LIMITS.test.recommended);

      await module.close();
    });

    it('should validate configuration at startup', async () => {
      delete process.env.DATABASE_URL;
      process.env.NODE_ENV = 'test';

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      expect(() => {
        DatabaseConfigFactory.create();
      }).toThrow('Missing required database environment variables');

      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it('should validate configuration during NestJS module compilation', async () => {
      process.env.DATABASE_URL = 'invalid-url';
      process.env.NODE_ENV = 'test';

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await expect(
        Test.createTestingModule({
          imports: [
            ConfigModule.forRoot({
              load: [databaseConfig],
            }),
          ],
        }).compile(),
      ).rejects.toThrow('Invalid database URL format');

      consoleErrorSpy.mockRestore();
    });

    it('should reject invalid database URLs during module creation', async () => {
      process.env.DATABASE_URL = 'mysql://invalid@localhost/db';
      process.env.NODE_ENV = 'test';
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await expect(
        Test.createTestingModule({
          imports: [
            ConfigModule.forRoot({
              load: [databaseConfig],
            }),
          ],
        }).compile(),
      ).rejects.toThrow('Invalid database URL protocol');

      consoleErrorSpy.mockRestore();
    });

    it('should reject invalid pool configuration', async () => {
      process.env.DATABASE_URL = 'postgresql://test@localhost/db';
      process.env.DB_MAX_CONNECTIONS = '5';
      process.env.DB_MIN_CONNECTIONS = '10'; // Min > Max
      process.env.NODE_ENV = 'test';
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await expect(
        Test.createTestingModule({
          imports: [
            ConfigModule.forRoot({
              load: [databaseConfig],
            }),
          ],
        }).compile(),
      ).rejects.toThrow(
        'Minimum connections must be less than maximum connections',
      );

      consoleErrorSpy.mockRestore();
    });
  });

  // ============================================================================
  // TESTS DES CONFIGURATIONS D'ENVIRONNEMENT
  // ============================================================================

  describe('Environment Configurations', () => {
    describe('Development Environment', () => {
      it('should create development configuration', async () => {
        process.env.DATABASE_URL = 'postgresql://dev@localhost/devdb';
        process.env.NODE_ENV = 'development';

        const devConfig =
          DatabaseConfigFactory.createForEnvironment('development');

        const module = await Test.createTestingModule({
          imports: [
            ConfigModule.forRoot({
              load: [databaseConfig],
            }),
          ],
        })
          .overrideProvider(databaseConfig.KEY)
          .useValue(devConfig)
          .compile();

        const config = module.get(databaseConfig.KEY);

        expect(config.maxConnections).toBe(
          CONNECTION_LIMITS.development.recommended,
        );
        expect(config.ssl).toBe(false);
        expect(config.logging.enabled).toBe(true);
        expect(config.logging.colorize).toBe(true);
        expect(config.migration.autoMigrate).toBe(true);

        await module.close();
      });
    });

    describe('Test Environment', () => {
      it('should create test configuration', async () => {
        process.env.DATABASE_URL = 'postgresql://test@localhost/testdb';
        process.env.NODE_ENV = 'test';

        const testConfig = DatabaseConfigFactory.createForEnvironment('test');

        const module = await Test.createTestingModule({
          imports: [
            ConfigModule.forRoot({
              load: [databaseConfig],
            }),
          ],
        })
          .overrideProvider(databaseConfig.KEY)
          .useValue(testConfig)
          .compile();

        const config = module.get(databaseConfig.KEY);

        expect(config.maxConnections).toBe(CONNECTION_LIMITS.test.recommended);
        expect(config.connectionTimeout).toBe(5000);
        expect(config.ssl).toBe(false);
        expect(config.retries.enabled).toBe(false);

        await module.close();
      });
    });

    describe('Production Environment', () => {
      it('should create production configuration', async () => {
        process.env.DATABASE_URL = 'postgresql://prod@prod.example.com/proddb';
        process.env.NODE_ENV = 'production';

        const prodConfig =
          DatabaseConfigFactory.createForEnvironment('production');

        const module = await Test.createTestingModule({
          imports: [
            ConfigModule.forRoot({
              load: [databaseConfig],
            }),
          ],
        })
          .overrideProvider(databaseConfig.KEY)
          .useValue(prodConfig)
          .compile();

        const config = module.get(databaseConfig.KEY);

        expect(config.maxConnections).toBe(
          CONNECTION_LIMITS.production.recommended,
        );
        expect(config.ssl).not.toBe(false);
        expect(config.logging.enabled).toBe(false);
        expect(config.logging.level).toEqual(['error']);
        expect(config.migration.autoMigrate).toBe(false);

        await module.close();
      });
    });

    describe('Advanced Configuration Scenarios', () => {
      it('should handle SSL configuration properly', async () => {
        process.env.DATABASE_URL = 'postgresql://ssl@secure.example.com/db';
        process.env.DB_SSL_ENABLED = 'true';
        process.env.DB_SSL_REJECT_UNAUTHORIZED = 'true';
        process.env.DB_SSL_CA = '/etc/ssl/ca.crt';
        process.env.NODE_ENV = 'production';

        const sslConfig =
          DatabaseConfigFactory.createForEnvironment('production');

        const module = await Test.createTestingModule({
          imports: [
            ConfigModule.forRoot({
              load: [databaseConfig],
            }),
          ],
        })
          .overrideProvider(databaseConfig.KEY)
          .useValue(sslConfig)
          .compile();

        const config = module.get(databaseConfig.KEY);

        expect(config.ssl).toMatchObject({
          enabled: true,
          rejectUnauthorized: true,
          ca: '/etc/ssl/ca.crt',
        });

        await module.close();
      });

      it('should handle complex logging configuration', async () => {
        process.env.DATABASE_URL = 'postgresql://test@localhost/db';
        process.env.DB_LOG_ENABLED = 'true';
        process.env.DB_LOG_LEVEL = 'warn,error';
        process.env.DB_SLOW_QUERY_THRESHOLD = '1500';
        process.env.NODE_ENV = 'staging';

        const loggingConfig =
          DatabaseConfigFactory.createForEnvironment('staging');

        const module = await Test.createTestingModule({
          imports: [
            ConfigModule.forRoot({
              load: [databaseConfig],
            }),
          ],
        })
          .overrideProvider(databaseConfig.KEY)
          .useValue(loggingConfig)
          .compile();

        const config = module.get(databaseConfig.KEY);

        expect(config.logging.enabled).toBe(true);
        expect(config.logging.level).toEqual(['warn', 'error']);
        expect(config.logging.slowQueryThreshold).toBe(1500);

        await module.close();
      });
    });
  });

  // ============================================================================
  // TESTS DES MÉTHODES UTILITAIRES
  // ============================================================================

  describe('Utility Methods', () => {
    describe('parseBoolean', () => {
      const parseBoolean = DatabaseConfigFactory['parseBoolean'];

      it('should parse true values correctly', () => {
        const trueValues = ['true', '1', 'yes', 'on', 'TRUE', 'Yes', 'ON'];

        trueValues.forEach((value) => {
          expect(parseBoolean(value, false)).toBe(true);
        });
      });

      it('should parse false values correctly', () => {
        const falseValues = ['false', '0', 'no', 'off', 'FALSE', 'No', 'OFF'];

        falseValues.forEach((value) => {
          expect(parseBoolean(value, true)).toBe(false);
        });
      });

      it('should use default for invalid values', () => {
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

        expect(parseBoolean('invalid', true)).toBe(true);
        expect(parseBoolean('maybe', false)).toBe(false);
        expect(parseBoolean(undefined, true)).toBe(true);

        expect(consoleSpy).toHaveBeenCalledTimes(2); // invalid et maybe
        consoleSpy.mockRestore();
      });

      it('should handle whitespace', () => {
        expect(parseBoolean('  true  ', false)).toBe(true);
        expect(parseBoolean(' FALSE ', true)).toBe(false);
      });
    });

    describe('parseInt', () => {
      const parseInt = DatabaseConfigFactory['parseInt'];

      it('should parse valid numbers', () => {
        expect(parseInt('123', 0)).toBe(123);
        expect(parseInt('0', 10)).toBe(0);
        expect(parseInt('999', 1)).toBe(999);
      });

      it('should use default for invalid numbers', () => {
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

        expect(parseInt('invalid', 10)).toBe(10);
        expect(parseInt('abc123', 5)).toBe(5);
        expect(parseInt('', 7)).toBe(7);
        expect(parseInt(undefined, 5)).toBe(5);

        consoleSpy.mockRestore();
      });

      it('should reject negative numbers', () => {
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

        expect(parseInt('-5', 10)).toBe(10);
        expect(parseInt('-100', 1)).toBe(1);

        consoleSpy.mockRestore();
      });

      it('should handle edge cases', () => {
        expect(parseInt('0', 5)).toBe(0); // Zero is valid
        expect(parseInt('3.14', 1)).toBe(3); // Truncates decimal
      });
    });

    describe('calculateOptimalPoolSize', () => {
      it('should return recommended size for environment', () => {
        expect(
          DatabaseConfigFactory.calculateOptimalPoolSize('development'),
        ).toBe(CONNECTION_LIMITS.development.recommended);
        expect(
          DatabaseConfigFactory.calculateOptimalPoolSize('production'),
        ).toBe(CONNECTION_LIMITS.production.recommended);
        expect(DatabaseConfigFactory.calculateOptimalPoolSize('test')).toBe(
          CONNECTION_LIMITS.test.recommended,
        );
      });

      it('should consider available memory', () => {
        const size = DatabaseConfigFactory.calculateOptimalPoolSize(
          'development',
          2048,
        );

        expect(size).toBeGreaterThan(CONNECTION_LIMITS.development.recommended);
        expect(size).toBeLessThanOrEqual(CONNECTION_LIMITS.development.max);
      });

      it('should respect environment limits', () => {
        const size = DatabaseConfigFactory.calculateOptimalPoolSize(
          'test',
          10000,
        );

        expect(size).toBeLessThanOrEqual(CONNECTION_LIMITS.test.max);
        expect(size).toBeGreaterThanOrEqual(CONNECTION_LIMITS.test.min);
      });

      it('should handle unknown environment', () => {
        const size = DatabaseConfigFactory.calculateOptimalPoolSize('unknown');

        expect(size).toBe(CONNECTION_LIMITS.development.recommended);
      });

      it('should handle very large memory', () => {
        const size = DatabaseConfigFactory.calculateOptimalPoolSize(
          'production',
          100000,
        );

        expect(size).toBe(CONNECTION_LIMITS.production.max); // Capped at max
      });
    });

    describe('adaptTimeouts', () => {
      it('should not change timeouts for low latency', () => {
        const baseConfig = {
          connectionTimeout: 30000,
          queryTimeout: 60000,
          transactionTimeout: 10000,
        } as any;

        const result = DatabaseConfigFactory.adaptTimeouts(baseConfig, 20);

        expect(result).toEqual(baseConfig); // No change
      });

      it('should increase timeouts for medium latency', () => {
        const baseConfig = {
          connectionTimeout: 30000,
          queryTimeout: 60000,
          transactionTimeout: 10000,
        } as any;

        const result = DatabaseConfigFactory.adaptTimeouts(baseConfig, 100);

        expect(result.connectionTimeout).toBe(45000); // 1.5x
        expect(result.queryTimeout).toBe(90000); // 1.5x
        expect(result.transactionTimeout).toBe(15000); // 1.5x
      });

      it('should double timeouts for high latency', () => {
        const baseConfig = {
          connectionTimeout: 30000,
          queryTimeout: 60000,
          transactionTimeout: 10000,
        } as any;

        const result = DatabaseConfigFactory.adaptTimeouts(baseConfig, 300);

        expect(result.connectionTimeout).toBe(60000); // 2x
        expect(result.queryTimeout).toBe(120000); // 2x
        expect(result.transactionTimeout).toBe(20000); // 2x
      });

      it('should preserve other config properties', () => {
        const baseConfig = {
          connectionTimeout: 30000,
          queryTimeout: 60000,
          transactionTimeout: 10000,
          maxConnections: 10,
          ssl: false,
        } as any;

        const result = DatabaseConfigFactory.adaptTimeouts(baseConfig, 300);

        expect(result.maxConnections).toBe(10);
        expect(result.ssl).toBe(false);
      });
    });
  });

  // ============================================================================
  // TESTS DE CAS LIMITES
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle missing optional environment variables gracefully', async () => {
      process.env.DATABASE_URL = 'postgresql://minimal@localhost/db';
      process.env.NODE_ENV = 'development';

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const devConfig =
        DatabaseConfigFactory.createForEnvironment('development');

      const module = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({
            load: [databaseConfig],
          }),
        ],
      })
        .overrideProvider(databaseConfig.KEY)
        .useValue(devConfig)
        .compile();

      const config = module.get(databaseConfig.KEY);

      expect(config).toBeDefined();
      expect(config.maxConnections).toBe(
        CONNECTION_LIMITS.development.recommended,
      );

      consoleSpy.mockRestore();
      await module.close();
    });

    it('should handle environment variable type coercion', async () => {
      process.env.DATABASE_URL = 'postgresql://coercion@localhost/db';
      process.env.DB_MAX_CONNECTIONS = 'not-a-number';
      process.env.DB_CONNECTION_TIMEOUT = '5000.5'; // Float
      process.env.DB_SSL_ENABLED = 'invalid-boolean';
      process.env.NODE_ENV = 'development';

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const coercionConfig =
        DatabaseConfigFactory.createForEnvironment('development');

      const module = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({
            load: [databaseConfig],
          }),
        ],
      })
        .overrideProvider(databaseConfig.KEY)
        .useValue(coercionConfig)
        .compile();

      const config = module.get(databaseConfig.KEY);

      // Should fallback to defaults for invalid values
      expect(config.maxConnections).toBe(
        CONNECTION_LIMITS.development.recommended,
      );
      expect(config.connectionTimeout).toBe(5000); // Parsed as int
      expect(config.ssl).toBe(false); // Default for invalid boolean

      consoleSpy.mockRestore();
      await module.close();
    });
  });
});