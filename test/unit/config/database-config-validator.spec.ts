// test/unit/config/database-config-validator.spec.ts

import {
  DatabaseConfigValidator,
  DatabaseValidationError,
  DatabaseConfigurationError,
  DatabaseConfig,
} from '../../../src/config/database.config';

// Helper pour créer un DatabaseConfig complet avec overrides
function createTestDatabaseConfig(overrides: Partial<DatabaseConfig> = {}): DatabaseConfig {
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

describe('DatabaseConfigValidator', () => {
  // Sauvegarder les variables d'environnement
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset des variables d'environnement pour chaque test
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    // Restaurer les variables d'environnement originales
    process.env = originalEnv;
  });

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
      
      validUrls.forEach(url => {
        expect(() => DatabaseConfigValidator.validateConnectionUrl(url)).not.toThrow();
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
      
      invalidUrls.forEach(url => {
        expect(() => DatabaseConfigValidator.validateConnectionUrl(url))
          .toThrow(DatabaseValidationError);
        
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
      const urlsWithoutHost = [
        'postgresql:///db',
        'postgresql://:5432/db',
      ];

      urlsWithoutHost.forEach(url => {
        expect(() => DatabaseConfigValidator.validateConnectionUrl(url))
          .toThrow('Database URL must include hostname');
      });
    });

    it('should reject URLs without database name', () => {
      const urlsWithoutDb = [
        'postgresql://user@localhost:5432/',
        'postgresql://user@localhost:5432',
        'postgresql://user@localhost/',
      ];

      urlsWithoutDb.forEach(url => {
        expect(() => DatabaseConfigValidator.validateConnectionUrl(url))
          .toThrow('Database URL must include database name');
      });
    });

    it('should reject empty/null URLs', () => {
      expect(() => DatabaseConfigValidator.validateConnectionUrl(''))
        .toThrow('Database URL is required');
      expect(() => DatabaseConfigValidator.validateConnectionUrl(null as any))
        .toThrow('Database URL is required');
      expect(() => DatabaseConfigValidator.validateConnectionUrl(undefined as any))
        .toThrow('Database URL is required');
    });

    it('should handle malformed URLs gracefully', () => {
      const malformedUrls = [
        'not-a-url',
        'postgresql://[invalid',
        'postgresql://user:pass@[::1:5432/db',
      ];

      malformedUrls.forEach(url => {
        expect(() => DatabaseConfigValidator.validateConnectionUrl(url))
          .toThrow(DatabaseValidationError);
        
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
      
      expect(() => DatabaseConfigValidator.validatePoolConfiguration(validConfig))
        .not.toThrow();
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
        
        expect(() => DatabaseConfigValidator.validatePoolConfiguration(invalidConfig))
          .toThrow('Minimum connections must be less than maximum connections');
      });
    });

    it('should reject negative or zero maxConnections', () => {
      const invalidValues = [0, -1, -10];

      invalidValues.forEach(value => {
        const invalidConfig = createTestDatabaseConfig({
          maxConnections: value,
          minConnections: 1,
        });
        
        expect(() => DatabaseConfigValidator.validatePoolConfiguration(invalidConfig))
          .toThrow('Maximum connections must be greater than 0');
      });
    });

    it('should reject invalid timeout values', () => {
      const timeoutTests = [
        { name: 'connection timeout', field: 'connectionTimeout', value: 0 },
        { name: 'connection timeout', field: 'connectionTimeout', value: -1000 },
        { name: 'query timeout', field: 'queryTimeout', value: 0 },
        { name: 'query timeout', field: 'queryTimeout', value: -5000 },
      ];

      timeoutTests.forEach(({ name, field, value }) => {
        const invalidConfig = createTestDatabaseConfig({
          [field]: value,
        });
        
        expect(() => DatabaseConfigValidator.validatePoolConfiguration(invalidConfig))
          .toThrow(`${name.charAt(0).toUpperCase() + name.slice(1)} must be greater than 0`);
      });
    });

    it('should reject invalid timeout relationships', () => {
      const invalidConfig = createTestDatabaseConfig({
        connectionTimeout: 60000,
        idleTimeout: 30000, // Less than connection timeout
      });
      
      expect(() => DatabaseConfigValidator.validatePoolConfiguration(invalidConfig))
        .toThrow('Idle timeout should be greater than connection timeout');
    });
  });

  describe('validateEnvironmentVariables', () => {
    it('should pass when DATABASE_URL is set', () => {
      process.env.DATABASE_URL = 'postgresql://test@localhost/db';
      
      expect(() => DatabaseConfigValidator.validateEnvironmentVariables())
        .not.toThrow();
    });

    it('should throw when DATABASE_URL is missing', () => {
      delete process.env.DATABASE_URL;
      
      expect(() => DatabaseConfigValidator.validateEnvironmentVariables())
        .toThrow(DatabaseConfigurationError);
        
      try {
        DatabaseConfigValidator.validateEnvironmentVariables();
      } catch (error) {
        expect(error.message).toContain('Missing required database environment variables: DATABASE_URL');
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
        expect.stringContaining('Optional database environment variable not set: DB_MAX_CONNECTIONS')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Optional database environment variable not set: DB_CONNECTION_TIMEOUT')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Optional database environment variable not set: DB_SSL_ENABLED')
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