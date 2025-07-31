// test/unit/config/database-config-factory.spec.ts

import {
  DatabaseConfigFactory,
  DatabaseConfigurationError,
  CONNECTION_LIMITS,
} from '../../../src/config/database.config';

describe('DatabaseConfigFactory', () => {
  // Sauvegarder les variables d'environnement
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset des variables d'environnement pour chaque test
    jest.resetModules();
    process.env = { ...originalEnv };
    
    // Variables requises par défaut
    process.env.DATABASE_URL = 'postgresql://test@localhost/db';
  });

  afterEach(() => {
    // Restaurer console.error/warn après les tests
    jest.restoreAllMocks();
  });

  afterAll(() => {
    // Restaurer les variables d'environnement originales
    process.env = originalEnv;
  });

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

      expect(() => DatabaseConfigFactory.create())
        .toThrow('Missing required database environment variables');
        
      // Une erreur devrait être loggée
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '❌ Database Configuration Error:',
        expect.stringContaining('Missing required database environment variables')
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

      expect(() => DatabaseConfigFactory.create())
        .toThrow('Invalid database URL format');
        
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
        expect.stringContaining('Unknown environment "unknown"')
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
        expect.stringContaining('Invalid DB_LOG_LEVEL')
      );
      
      consoleSpy.mockRestore();
    });

    it('should handle mixed valid/invalid log levels', () => {
      process.env.DB_LOG_LEVEL = 'error,invalid,warn,unknown';
      
      const config = DatabaseConfigFactory.createLoggingConfig('development');
      
      expect(config.level).toEqual(['error', 'warn']); // Only valid ones
    });
  });

  describe('utility methods', () => {
    describe('parseBoolean', () => {
      const parseBoolean = DatabaseConfigFactory['parseBoolean'];

      it('should parse true values correctly', () => {
        const trueValues = ['true', '1', 'yes', 'on', 'TRUE', 'Yes', 'ON'];
        
        trueValues.forEach(value => {
          expect(parseBoolean(value, false)).toBe(true);
        });
      });

      it('should parse false values correctly', () => {
        const falseValues = ['false', '0', 'no', 'off', 'FALSE', 'No', 'OFF'];
        
        falseValues.forEach(value => {
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
        expect(DatabaseConfigFactory.calculateOptimalPoolSize('development'))
          .toBe(CONNECTION_LIMITS.development.recommended);
        expect(DatabaseConfigFactory.calculateOptimalPoolSize('production'))
          .toBe(CONNECTION_LIMITS.production.recommended);
        expect(DatabaseConfigFactory.calculateOptimalPoolSize('test'))
          .toBe(CONNECTION_LIMITS.test.recommended);
      });

      it('should consider available memory', () => {
        const size = DatabaseConfigFactory.calculateOptimalPoolSize('development', 2048);
        
        expect(size).toBeGreaterThan(CONNECTION_LIMITS.development.recommended);
        expect(size).toBeLessThanOrEqual(CONNECTION_LIMITS.development.max);
      });

      it('should respect environment limits', () => {
        const size = DatabaseConfigFactory.calculateOptimalPoolSize('test', 10000);
        
        expect(size).toBeLessThanOrEqual(CONNECTION_LIMITS.test.max);
        expect(size).toBeGreaterThanOrEqual(CONNECTION_LIMITS.test.min);
      });

      it('should handle unknown environment', () => {
        const size = DatabaseConfigFactory.calculateOptimalPoolSize('unknown');
        
        expect(size).toBe(CONNECTION_LIMITS.development.recommended);
      });

      it('should handle very large memory', () => {
        const size = DatabaseConfigFactory.calculateOptimalPoolSize('production', 100000);
        
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
});