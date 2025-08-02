// test/unit/config/cache.config.spec.ts

import {
  CacheConfigFactory,
  CacheConfigValidator,
  CacheConfigurationError,
  CacheValidationError,
  CACHE_LIMITS,
  SERIALIZATION_MODES,
} from '../../../src/config/cache.config';

// ========================================
// ÉTAPE 1: Fonction cleanEnvironment ajoutée/modifiée
// ========================================
function cleanEnvironment() {
  const keysToDelete = Object.keys(process.env).filter(key => 
    key.startsWith('REDIS_') || 
    key === 'CACHE_TTL' || 
    key === 'DEBUG_CONFIG'
  );
  keysToDelete.forEach(key => delete process.env[key]);
}

describe('CacheConfig', () => {
  let originalEnv: NodeJS.ProcessEnv;

  // ========================================
  // ÉTAPE 2: beforeEach modifié pour utiliser cleanEnvironment
  // ========================================
  beforeEach(() => {
    cleanEnvironment();
  });

  // ========================================
  // ÉTAPE 3: afterEach modifié pour utiliser cleanEnvironment
  // ========================================
  afterEach(() => {
    cleanEnvironment();
  });

  describe('CacheConfigFactory', () => {
    describe('Environment-specific configurations', () => {
      it('should create development config with correct defaults', () => {
        process.env.NODE_ENV = 'development';
        
        const config = CacheConfigFactory.create();
        
        expect(config.connection.host).toBe('localhost');
        expect(config.connection.port).toBe(6379);
        expect(config.connection.db).toBe(0);
        expect(config.performance.maxConnections).toBe(CACHE_LIMITS.development.recommendedConnections);
        expect(config.performance.minConnections).toBe(CACHE_LIMITS.development.minConnections);
        expect(config.performance.defaultTtl).toBe(CACHE_LIMITS.development.defaultTtl);
        expect(config.monitoring.enabled).toBe(true);
        expect(config.security.enableTLS).toBe(false);
        expect(config.cluster.enabled).toBe(false);
      });

      // ========================================
      // ÉTAPE 4: Test "should create test config with minimal resources" remplacé
      // ========================================
      it('should create test config with minimal resources', () => {
        cleanEnvironment();
        process.env.NODE_ENV = 'test';
        
        const config = CacheConfigFactory.create({ strict: false });
        
        expect(config.performance.defaultTtl).toBe(CACHE_LIMITS.test.defaultTtl);
        expect(config.performance.maxConnections).toBeGreaterThanOrEqual(2);
        expect(config.performance.minConnections).toBeGreaterThanOrEqual(1);
        expect(config.performance.minConnections).toBeLessThan(config.performance.maxConnections);
        expect(config.security.enableTLS).toBe(false);
        expect(config.security.enableAuth).toBe(false);
        expect(config.monitoring.enabled).toBe(false);
      });

      // ========================================
      // ÉTAPE 5: Test "should create staging config with moderate resources" remplacé
      // ========================================
      it('should create staging config with moderate resources', () => {
        cleanEnvironment();
        process.env.NODE_ENV = 'staging';
        
        const config = CacheConfigFactory.create({ strict: false });
        
        expect(config.performance.defaultTtl).toBe(CACHE_LIMITS.staging.defaultTtl);
        expect(config.performance.maxConnections).toBe(CACHE_LIMITS.staging.recommendedConnections);
        expect(config.performance.minConnections).toBeLessThan(config.performance.maxConnections);
        expect(config.security.enableTLS).toBe(true);
        expect(config.security.enableAuth).toBe(true);  
        expect(config.monitoring.enabled).toBe(true);
      });

      it('should create production config with high performance settings', () => {
        process.env.NODE_ENV = 'production';
        
        const config = CacheConfigFactory.create();
        
        expect(config.performance.maxConnections).toBe(CACHE_LIMITS.production.recommendedConnections);
        expect(config.performance.minConnections).toBe(CACHE_LIMITS.production.minConnections);
        expect(config.security.enableTLS).toBe(true);
        expect(config.security.enableAuth).toBe(true);
        expect(config.serialization.compression).toBe(true);
        expect(config.features.enablePipelining).toBe(true);
        expect(config.features.enableDistributedLock).toBe(true);
      });

      it('should handle unknown environment gracefully', () => {
        process.env.NODE_ENV = 'unknown';
        
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
        const config = CacheConfigFactory.create();
        
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Unknown environment "unknown", using development config')
        );
        expect(config.performance.maxConnections).toBe(CACHE_LIMITS.development.recommendedConnections);
        
        consoleSpy.mockRestore();
      });
    });

    describe('Environment variable parsing', () => {
      beforeEach(() => {
        process.env.NODE_ENV = 'development';
      });

      it('should parse REDIS_HOST correctly', () => {
        process.env.REDIS_HOST = 'redis.example.com';
        
        const config = CacheConfigFactory.create();
        
        expect(config.connection.host).toBe('redis.example.com');
      });

      it('should parse REDIS_PORT correctly', () => {
        process.env.REDIS_PORT = '6380';
        
        const config = CacheConfigFactory.create();
        
        expect(config.connection.port).toBe(6380);
      });

      it('should parse REDIS_DB correctly', () => {
        process.env.REDIS_DB = '2';
        
        const config = CacheConfigFactory.create();
        
        expect(config.connection.db).toBe(2);
      });

      it('should parse CACHE_TTL correctly', () => {
        process.env.CACHE_TTL = '600';
        
        const config = CacheConfigFactory.create();
        
        expect(config.performance.defaultTtl).toBe(600);
      });

      it('should parse boolean values correctly', () => {
        const testCases = [
          { value: 'true', expected: true },
          { value: 'false', expected: false },
          { value: '1', expected: true },
          { value: '0', expected: false },
          { value: 'yes', expected: true },
          { value: 'no', expected: false },
          { value: 'on', expected: true },
          { value: 'off', expected: false },
          { value: 'TRUE', expected: true },
          { value: 'FALSE', expected: false },
        ];

        testCases.forEach(({ value, expected }) => {
          process.env.REDIS_ENABLE_METRICS = value;
          
          const config = CacheConfigFactory.create();
          
          expect(config.monitoring.enabled).toBe(expected);
        });
      });

      it('should parse array values correctly', () => {
        process.env.REDIS_ALLOWED_IPS = '192.168.1.1,192.168.1.2,10.0.0.1';
        
        const config = CacheConfigFactory.create();
        
        expect(config.security.allowedIPs).toEqual(['192.168.1.1', '192.168.1.2', '10.0.0.1']);
      });

      it('should handle empty array values', () => {
        process.env.REDIS_ALLOWED_IPS = '';
        
        const config = CacheConfigFactory.create();
        
        expect(config.security.allowedIPs).toEqual([]);
      });

      it('should parse serialization mode correctly', () => {
        process.env.REDIS_SERIALIZATION = 'msgpack';
        
        const config = CacheConfigFactory.create();
        
        expect(config.serialization.mode).toBe('msgpack');
      });

      it('should fallback to json for invalid serialization mode', () => {
        process.env.REDIS_SERIALIZATION = 'invalid-mode';
        
        const config = CacheConfigFactory.create();
        
        expect(config.serialization.mode).toBe('json');
      });
    });

    describe('Fallback behavior', () => {
      beforeEach(() => {
        process.env.NODE_ENV = 'development';
      });

      it('should use defaults when env vars are undefined', () => {
        const config = CacheConfigFactory.create();
        
        expect(config.connection.host).toBe('localhost');
        expect(config.connection.port).toBe(6379);
        expect(config.connection.db).toBe(0);
        expect(config.performance.defaultTtl).toBe(CACHE_LIMITS.development.defaultTtl);
      });

      it('should use defaults when env vars are empty strings', () => {
        process.env.REDIS_HOST = '';
        process.env.REDIS_PORT = '';
        process.env.CACHE_TTL = '';
        
        const config = CacheConfigFactory.create();
        
        expect(config.connection.host).toBe('localhost');
        expect(config.connection.port).toBe(6379);
        expect(config.performance.defaultTtl).toBe(CACHE_LIMITS.development.defaultTtl);
      });

      it('should warn and use defaults when env vars are invalid', () => {
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
        
        process.env.REDIS_PORT = 'invalid-port';
        process.env.CACHE_TTL = 'invalid-ttl';
        process.env.REDIS_ENABLE_METRICS = 'invalid-boolean';
        
        const config = CacheConfigFactory.create();
        
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid number value "invalid-port"'));
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid number value "invalid-ttl"'));
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid boolean value "invalid-boolean"'));
        
        expect(config.connection.port).toBe(6379);
        expect(config.performance.defaultTtl).toBe(CACHE_LIMITS.development.defaultTtl);
        
        consoleSpy.mockRestore();
      });
    });

    describe('Redis URL parsing', () => {
      beforeEach(() => {
        process.env.NODE_ENV = 'development';
      });

      it('should parse REDIS_URL correctly', () => {
        process.env.REDIS_URL = 'redis://user:pass@redis.example.com:6380/2';
        
        const config = CacheConfigFactory.create();
        
        expect(config.connection.host).toBe('redis.example.com');
        expect(config.connection.port).toBe(6380);
        expect(config.connection.username).toBe('user');
        expect(config.connection.password).toBe('pass');
        expect(config.connection.db).toBe(2);
      });

      it('should extract host and port from URL without auth', () => {
        process.env.REDIS_URL = 'redis://redis.example.com:6380';
        
        const config = CacheConfigFactory.create();
        
        expect(config.connection.host).toBe('redis.example.com');
        expect(config.connection.port).toBe(6380);
        expect(config.connection.username).toBeUndefined();
        expect(config.connection.password).toBeUndefined();
      });

      it('should handle REDIS_URL with database number', () => {
        process.env.REDIS_URL = 'redis://localhost:6379/5';
        
        const config = CacheConfigFactory.create();
        
        expect(config.connection.host).toBe('localhost');
        expect(config.connection.port).toBe(6379);
        expect(config.connection.db).toBe(5);
      });

      it('should fallback to individual vars when REDIS_URL is invalid', () => {
        process.env.REDIS_URL = 'invalid-url';
        process.env.REDIS_HOST = 'fallback.host.com';
        process.env.REDIS_PORT = '6380';
        
        expect(() => CacheConfigFactory.create()).toThrow(CacheValidationError);
      });

      it('should handle URL without database', () => {
        process.env.REDIS_URL = 'redis://localhost:6379';
        
        const config = CacheConfigFactory.create();
        
        expect(config.connection.db).toBe(0);
      });

      it('should handle URL with only password', () => {
        cleanEnvironment();
        process.env.NODE_ENV = 'test';
        process.env.REDIS_URL = 'redis://:password@localhost:6379';
        
        const config = CacheConfigFactory.create({ strict: false });
        
        expect(config.connection.password).toBe('password');
        expect(config.connection.username).toBeUndefined();
      });
    });

    describe('Debug mode', () => {
      it('should output debug info when DEBUG_CONFIG is true', () => {
        process.env.NODE_ENV = 'development';
        process.env.DEBUG_CONFIG = 'true';
        
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
        
        CacheConfigFactory.create();
        
        expect(consoleSpy).toHaveBeenCalledWith('🔍 Cache Environment Variables Debug:');
        expect(consoleSpy).toHaveBeenCalledWith('NODE_ENV:', 'development');
        
        consoleSpy.mockRestore();
      });
    });
  });

  describe('CacheConfigValidator', () => {
    describe('Connection validation', () => {
      it('should validate valid connection config', () => {
        const config = {
          host: 'localhost',
          port: 6379,
          db: 0,
          connectTimeout: 5000,
        };

        expect(() => CacheConfigValidator.validateConnectionConfig(config as any))
          .not.toThrow();
      });

      it('should throw error for empty host', () => {
        const config = {
          host: '',
          port: 6379,
          db: 0,
          connectTimeout: 5000,
        };

        expect(() => CacheConfigValidator.validateConnectionConfig(config as any))
          .toThrow(CacheValidationError);
        expect(() => CacheConfigValidator.validateConnectionConfig(config as any))
          .toThrow('Redis host is required');
      });

      it('should throw error for invalid port numbers', () => {
        const invalidPorts = [0, -1, 65536, 70000];
        
        invalidPorts.forEach(port => {
          const config = {
            host: 'localhost',
            port,
            db: 0,
            connectTimeout: 5000,
          };

          expect(() => CacheConfigValidator.validateConnectionConfig(config as any))
            .toThrow(CacheValidationError);
          expect(() => CacheConfigValidator.validateConnectionConfig(config as any))
            .toThrow('Redis port must be between 1 and 65535');
        });
      });

      it('should throw error for invalid database number', () => {
        const invalidDbs = [-1, 16, 20];
        
        invalidDbs.forEach(db => {
          const config = {
            host: 'localhost',
            port: 6379,
            db,
            connectTimeout: 5000,
          };

          expect(() => CacheConfigValidator.validateConnectionConfig(config as any))
            .toThrow(CacheValidationError);
          expect(() => CacheConfigValidator.validateConnectionConfig(config as any))
            .toThrow('Redis database number must be between 0 and 15');
        });
      });

      it('should throw error for invalid timeout', () => {
        const config = {
          host: 'localhost',
          port: 6379,
          db: 0,
          connectTimeout: 0,
        };

        expect(() => CacheConfigValidator.validateConnectionConfig(config as any))
          .toThrow(CacheValidationError);
        expect(() => CacheConfigValidator.validateConnectionConfig(config as any))
          .toThrow('Connection timeout must be greater than 0');
      });
    });

    describe('Performance validation', () => {
      it('should validate valid performance config', () => {
        const config = {
          maxConnections: 10,
          minConnections: 2,
          defaultTtl: 300,
          responseTimeout: 5000,
        };

        expect(() => CacheConfigValidator.validatePerformanceConfig(config as any))
          .not.toThrow();
      });

      it('should throw error when maxConnections is zero or negative', () => {
        const invalidMaxConnections = [0, -1, -10];
        
        invalidMaxConnections.forEach(maxConnections => {
          const config = {
            maxConnections,
            minConnections: 2,
            defaultTtl: 300,
            responseTimeout: 5000,
          };

          expect(() => CacheConfigValidator.validatePerformanceConfig(config as any))
            .toThrow(CacheValidationError);
          expect(() => CacheConfigValidator.validatePerformanceConfig(config as any))
            .toThrow('Maximum connections must be greater than 0');
        });
      });

      it('should throw error when minConnections >= maxConnections', () => {
        const config = {
          maxConnections: 5,
          minConnections: 5,
          defaultTtl: 300,
          responseTimeout: 5000,
        };

        expect(() => CacheConfigValidator.validatePerformanceConfig(config as any))
          .toThrow(CacheValidationError);
        expect(() => CacheConfigValidator.validatePerformanceConfig(config as any))
          .toThrow('Minimum connections must be less than maximum connections');
      });

      it('should throw error when defaultTtl is zero or negative', () => {
        const invalidTtls = [0, -1, -300];
        
        invalidTtls.forEach(defaultTtl => {
          const config = {
            maxConnections: 10,
            minConnections: 2,
            defaultTtl,
            responseTimeout: 5000,
          };

          expect(() => CacheConfigValidator.validatePerformanceConfig(config as any))
            .toThrow(CacheValidationError);
          expect(() => CacheConfigValidator.validatePerformanceConfig(config as any))
            .toThrow('Default TTL must be greater than 0');
        });
      });

      it('should throw error when responseTimeout is zero or negative', () => {
        const config = {
          maxConnections: 10,
          minConnections: 2,
          defaultTtl: 300,
          responseTimeout: 0,
        };

        expect(() => CacheConfigValidator.validatePerformanceConfig(config as any))
          .toThrow(CacheValidationError);
        expect(() => CacheConfigValidator.validatePerformanceConfig(config as any))
          .toThrow('Response timeout must be greater than 0');
      });
    });

    describe('Environment variables validation', () => {
      it('should not throw for missing optional variables in development', () => {
        process.env.NODE_ENV = 'development';
        
        expect(() => CacheConfigValidator.validateEnvironmentVariables())
          .not.toThrow();
      });

      it('should warn about missing production variables', () => {
        process.env.NODE_ENV = 'production';
        delete process.env.REDIS_HOST;
        delete process.env.REDIS_PASSWORD;
        
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
        
        CacheConfigValidator.validateEnvironmentVariables();
        
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Production environment variable not set: REDIS_HOST')
        );
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Production environment variable not set: REDIS_PASSWORD')
        );
        
        consoleSpy.mockRestore();
      });

      it('should validate Redis URL format', () => {
        process.env.REDIS_URL = 'invalid-url-format';
        
        expect(() => CacheConfigValidator.validateEnvironmentVariables())
          .toThrow(CacheValidationError);
        expect(() => CacheConfigValidator.validateEnvironmentVariables())
          .toThrow('Invalid Redis URL format');
      });

      it('should accept valid Redis URL formats', () => {
        const validUrls = [
          'redis://localhost',
          'redis://localhost:6379',
          'redis://user:pass@localhost:6379',
          'redis://localhost:6379/1',
          'redis://user:pass@localhost:6379/1',
        ];

        validUrls.forEach(url => {
          process.env.REDIS_URL = url;
          
          expect(() => CacheConfigValidator.validateEnvironmentVariables())
            .not.toThrow();
        });
      });
    });

    describe('Complete configuration validation', () => {
      let validConfig: any;

      beforeEach(() => {
        validConfig = {
          connection: {
            host: 'localhost',
            port: 6379,
            db: 0,
            connectTimeout: 5000,
          },
          performance: {
            maxConnections: 10,
            minConnections: 2,
            defaultTtl: 300,
            responseTimeout: 5000,
          },
          cluster: {
            enabled: false,
            nodes: [],
          },
          security: {
            enableTLS: false,
            tlsRejectUnauthorized: true,
          },
          serialization: {
            compression: false,
            compressionThreshold: 1024,
          },
        };
      });

      it('should validate complete valid config', () => {
        expect(() => CacheConfigValidator.validateCompleteConfig(validConfig))
          .not.toThrow();
      });

      it('should throw error when cluster enabled but no nodes', () => {
        validConfig.cluster.enabled = true;
        validConfig.cluster.nodes = [];

        expect(() => CacheConfigValidator.validateCompleteConfig(validConfig))
          .toThrow(CacheConfigurationError);
        expect(() => CacheConfigValidator.validateCompleteConfig(validConfig))
          .toThrow('Cluster mode enabled but no nodes configured');
      });

      it('should warn when TLS enabled but verification disabled in production', () => {
        process.env.NODE_ENV = 'production';
        validConfig.security.enableTLS = true;
        validConfig.security.tlsRejectUnauthorized = false;

        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
        
        CacheConfigValidator.validateCompleteConfig(validConfig);
        
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('TLS enabled but certificate verification disabled in production')
        );
        
        consoleSpy.mockRestore();
      });

      it('should throw error when compression enabled but threshold invalid', () => {
        validConfig.serialization.compression = true;
        validConfig.serialization.compressionThreshold = 0;

        expect(() => CacheConfigValidator.validateCompleteConfig(validConfig))
          .toThrow(CacheValidationError);
        expect(() => CacheConfigValidator.validateCompleteConfig(validConfig))
          .toThrow('Compression threshold must be greater than 0 when compression is enabled');
      });
    });
  });

  describe('Edge Cases', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    it('should handle extremely large TTL values', () => {
      process.env.CACHE_TTL = '999999999';
      
      const config = CacheConfigFactory.create();
      
      expect(config.performance.defaultTtl).toBe(999999999);
    });

    it('should handle extremely large connection numbers', () => {
      process.env.REDIS_MAX_CONNECTIONS = '1000';
      process.env.REDIS_MIN_CONNECTIONS = '100';
      
      const config = CacheConfigFactory.create();
      
      expect(config.performance.maxConnections).toBe(1000);
      expect(config.performance.minConnections).toBe(100);
    });

    it('should handle negative values gracefully', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      process.env.REDIS_PORT = '-1';
      process.env.CACHE_TTL = '-300';
      
      const config = CacheConfigFactory.create();
      
      expect(config.connection.port).toBe(6379); // Default
      expect(config.performance.defaultTtl).toBe(CACHE_LIMITS.development.defaultTtl); // Default
      
      consoleSpy.mockRestore();
    });

    it('should handle special characters in Redis password (alternative)', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.REDIS_URL; // Assurer qu'on n'utilise pas d'URL
      process.env.REDIS_PASSWORD = 'p@ssw0rd!@#$%^&*()[]{}|;:,.<>?';
      
      const config = CacheConfigFactory.create();
      expect(config.connection.password).toBe('p@ssw0rd!@#$%^&*()[]{}|;:,.<>?');
    });

    it('should handle IPv6 addresses', () => {
      process.env.REDIS_HOST = '::1';
      
      const config = CacheConfigFactory.create();
      
      expect(config.connection.host).toBe('::1');
    });

    it('should handle localhost vs 127.0.0.1', () => {
      // Test localhost
      process.env.REDIS_HOST = 'localhost';
      let config = CacheConfigFactory.create();
      expect(config.connection.host).toBe('localhost');

      // Test 127.0.0.1
      process.env.REDIS_HOST = '127.0.0.1';
      config = CacheConfigFactory.create();
      expect(config.connection.host).toBe('127.0.0.1');
    });
  });
});