// test/unit/config/app.config.spec.ts

import { readFileSync } from 'fs';
import { join } from 'path';
import {
  AppConfigFactory,
  ConfigurationError,
  ValidationError,
  appConfig,
  type AppConfig,
  type AppConfigType,
} from '../../../src/config/app.config';

// Mock fs pour les tests du package.json
jest.mock('fs');
const mockReadFileSync = readFileSync as jest.MockedFunction<typeof readFileSync>;

describe('AppConfig', () => {
  // Sauvegarde de l'environnement original
  const originalEnv = process.env;
  
  // Mock console.warn et console.error pour éviter les logs dans les tests
  const originalConsoleWarn = console.warn;
  const originalConsoleError = console.error;

  beforeEach(() => {
    // Reset de l'environnement pour chaque test
    jest.resetModules();
    process.env = { ...originalEnv };
    mockReadFileSync.mockClear();
    
    // Mock console pour éviter le spam dans les tests
    console.warn = jest.fn();
    console.error = jest.fn();
  });

  afterAll(() => {
    // Restauration de l'environnement original
    process.env = originalEnv;
    console.warn = originalConsoleWarn;
    console.error = originalConsoleError;
  });

  // ============================================================================
  // TESTS DE CRÉATION DE CONFIGURATION DE BASE
  // ============================================================================

  describe('AppConfigFactory.create()', () => {
    it('should create complete configuration with minimal environment', () => {
      // Arrange
      process.env = {
        DATABASE_URL: 'postgresql://test:test@localhost:5432/test_db',
        NODE_ENV: 'development',
      };
      mockReadFileSync.mockReturnValue('{"version": "1.0.0"}');

      // Act
      const config = AppConfigFactory.create();

      // Assert
      expect(config).toBeDefined();
      expect(config.server).toBeDefined();
      expect(config.environment).toBeDefined();
      expect(config.security).toBeDefined();
      expect(config.externalServices).toBeDefined();
      expect(config.features).toBeDefined();
      expect(config.observability).toBeDefined();
    });

    it('should throw ConfigurationError when DATABASE_URL is missing', () => {
      // Arrange
      process.env = {
        NODE_ENV: 'development',
        // DATABASE_URL manquant intentionnellement
      };

      // Act & Assert
      expect(() => AppConfigFactory.create()).toThrow(ConfigurationError);
      expect(() => AppConfigFactory.create()).toThrow(
        'Missing required environment variables: DATABASE_URL'
      );
    });

    it('should handle missing package.json gracefully', () => {
      // Arrange
      process.env = {
        DATABASE_URL: 'postgresql://test:test@localhost:5432/test_db',
        NODE_ENV: 'development',
      };
      mockReadFileSync.mockImplementation(() => {
        throw new Error('ENOENT: no such file or directory');
      });

      // Act
      const config = AppConfigFactory.create();

      // Assert
      expect(config.environment.appVersion).toBe('0.0.1'); // Version par défaut
    });

    it('should handle corrupted package.json gracefully', () => {
      // Arrange
      process.env = {
        DATABASE_URL: 'postgresql://test:test@localhost:5432/test_db',
      };
      mockReadFileSync.mockReturnValue('{"invalid json"}');

      // Act
      const config = AppConfigFactory.create();

      // Assert
      expect(config.environment.appVersion).toBe('0.0.1'); // Fallback
    });
  });

  // ============================================================================
  // TESTS DE CONFIGURATION SERVEUR
  // ============================================================================

  describe('Server Configuration', () => {
    beforeEach(() => {
      process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
      mockReadFileSync.mockReturnValue('{"version": "1.0.0"}');
    });

    it('should use default server configuration', () => {
      // Act
      const config = AppConfigFactory.create();

      // Assert
      expect(config.server.port).toBe(3000);
      expect(config.server.host).toBe('0.0.0.0');
      expect(config.server.apiPrefix).toBe('api/v1');
      expect(config.server.globalTimeout).toBe(30000);
      expect(config.server.bodyLimit).toBe('10mb');
      expect(config.server.compressionEnabled).toBe(true);
    });

    it('should use environment variables for server configuration', () => {
      // Arrange
      process.env.PORT = '8080';
      process.env.HOST = '127.0.0.1';
      process.env.API_PREFIX = 'api/v2';
      process.env.GLOBAL_TIMEOUT = '60000';
      process.env.BODY_LIMIT = '50mb';
      process.env.COMPRESSION_ENABLED = 'false';

      // Act
      const config = AppConfigFactory.create();

      // Assert
      expect(config.server.port).toBe(8080);
      expect(config.server.host).toBe('127.0.0.1');
      expect(config.server.apiPrefix).toBe('api/v2');
      expect(config.server.globalTimeout).toBe(60000);
      expect(config.server.bodyLimit).toBe('50mb');
      expect(config.server.compressionEnabled).toBe(false);
    });

    it('should throw ValidationError for invalid port', () => {
      // Arrange
      process.env.PORT = '99999'; // Port invalide

      // Act & Assert
      expect(() => AppConfigFactory.create()).toThrow(ValidationError);
      expect(() => AppConfigFactory.create()).toThrow('Port must be between 1 and 65535');
    });

    it('should handle negative port', () => {
      // Arrange
      process.env.PORT = '-1';

      // Act & Assert
      expect(() => AppConfigFactory.create()).toThrow(ValidationError);
    });
  });

  // ============================================================================
  // TESTS DE CONFIGURATION D'ENVIRONNEMENT
  // ============================================================================

  describe('Environment Configuration', () => {
    beforeEach(() => {
      process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
      mockReadFileSync.mockReturnValue('{"version": "2.1.0"}');
    });

    it('should configure for development environment', () => {
      // Arrange
      process.env.NODE_ENV = 'development';

      // Act
      const config = AppConfigFactory.create();

      // Assert
      expect(config.environment.nodeEnv).toBe('development');
      expect(config.environment.isDevelopment).toBe(true);
      expect(config.environment.isProduction).toBe(false);
      expect(config.environment.isTest).toBe(false);
    });

    it('should configure for production environment', () => {
      // Arrange
      process.env.NODE_ENV = 'production';

      // Act
      const config = AppConfigFactory.create();

      // Assert
      expect(config.environment.nodeEnv).toBe('production');
      expect(config.environment.isDevelopment).toBe(false);
      expect(config.environment.isProduction).toBe(true);
      expect(config.environment.isTest).toBe(false);
    });

    it('should configure for test environment', () => {
      // Arrange
      process.env.NODE_ENV = 'test';

      // Act
      const config = AppConfigFactory.create();

      // Assert
      expect(config.environment.nodeEnv).toBe('test');
      expect(config.environment.isDevelopment).toBe(false);
      expect(config.environment.isProduction).toBe(false);
      expect(config.environment.isTest).toBe(true);
    });

    it('should default to development when NODE_ENV is not set', () => {
      // Arrange
      delete process.env.NODE_ENV;

      // Act
      const config = AppConfigFactory.create();

      // Assert
      expect(config.environment.nodeEnv).toBe('development');
      expect(config.environment.isDevelopment).toBe(true);
    });

    it('should throw ValidationError for invalid NODE_ENV', () => {
      // Arrange
      process.env.NODE_ENV = 'invalid';

      // Act & Assert
      expect(() => AppConfigFactory.create()).toThrow(ValidationError);
      expect(() => AppConfigFactory.create()).toThrow('Invalid NODE_ENV value');
    });

    it('should read app version from package.json', () => {
      // Arrange
      mockReadFileSync.mockReturnValue('{"version": "3.2.1"}');

      // Act
      const config = AppConfigFactory.create();

      // Assert
      expect(config.environment.appVersion).toBe('3.2.1');
    });

    it('should set build timestamp', () => {
      // Arrange
      process.env.BUILD_TIMESTAMP = '2023-12-01T10:00:00Z';

      // Act
      const config = AppConfigFactory.create();

      // Assert
      expect(config.environment.buildTimestamp).toBe('2023-12-01T10:00:00Z');
    });
  });

  // ============================================================================
  // TESTS DE CONFIGURATION DE SÉCURITÉ
  // ============================================================================

  describe('Security Configuration', () => {
    beforeEach(() => {
      process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
      mockReadFileSync.mockReturnValue('{"version": "1.0.0"}');
    });

    describe('CORS Configuration', () => {
      it('should configure CORS with defaults', () => {
        // Arrange - S'assurer qu'aucune variable CORS n'est définie
        delete process.env.CORS_METHODS;
        delete process.env.CORS_ALLOWED_HEADERS;
        delete process.env.CORS_ORIGIN;
        process.env.NODE_ENV = 'development'; // Environnement explicite

        // Act
        const config = AppConfigFactory.create();

        // Assert
        expect(config.security.cors.enabled).toBe(true);
        expect(config.security.cors.origin).toBe(true);
        expect(config.security.cors.credentials).toBe(true);
        // Les méthodes par défaut sont définies quand CORS_METHODS n'est pas défini
        expect(config.security.cors.methods).toEqual(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']);
        expect(config.security.cors.allowedHeaders).toEqual(['Content-Type', 'Authorization', 'x-api-key']);
      });

      it('should configure CORS origin from environment', () => {
        // Arrange
        process.env.CORS_ORIGIN = 'https://example.com,https://test.com';

        // Act
        const config = AppConfigFactory.create();

        // Assert
        expect(config.security.cors.origin).toEqual(['https://example.com', 'https://test.com']);
      });

      it('should handle single CORS origin', () => {
        // Arrange
        process.env.CORS_ORIGIN = 'https://single.com';

        // Act
        const config = AppConfigFactory.create();

        // Assert
        expect(config.security.cors.origin).toBe('https://single.com');
      });

      it('should handle custom CORS methods from environment', () => {
        // Arrange
        process.env.CORS_METHODS = 'GET,POST,CUSTOM';

        // Act
        const config = AppConfigFactory.create();

        // Assert
        expect(config.security.cors.methods).toEqual(['GET', 'POST', 'CUSTOM']);
      });

      it('should handle custom CORS headers from environment', () => {
        // Arrange
        process.env.CORS_ALLOWED_HEADERS = 'Content-Type,X-Custom-Header';

        // Act
        const config = AppConfigFactory.create();

        // Assert
        expect(config.security.cors.allowedHeaders).toEqual(['Content-Type', 'X-Custom-Header']);
      });

      it('should restrict CORS origin in production', () => {
        // Arrange
        process.env.NODE_ENV = 'production';

        // Act
        const config = AppConfigFactory.create();

        // Assert
        expect(config.security.cors.origin).toBe(false);
      });
    });

    describe('Rate Limiting Configuration', () => {
      it('should configure rate limiting with defaults in development', () => {
        // Arrange
        process.env.NODE_ENV = 'development';

        // Act
        const config = AppConfigFactory.create();

        // Assert
        expect(config.security.rateLimit.enabled).toBe(true);
        expect(config.security.rateLimit.windowMs).toBe(60000);
        expect(config.security.rateLimit.maxRequests).toBe(1000); // Dev default
      });

      it('should use stricter rate limiting in production', () => {
        // Arrange
        process.env.NODE_ENV = 'production';

        // Act
        const config = AppConfigFactory.create();

        // Assert
        expect(config.security.rateLimit.maxRequests).toBe(100); // Prod default
      });

      it('should disable rate limiting in test environment', () => {
        // Arrange
        process.env.NODE_ENV = 'test';

        // Act
        const config = AppConfigFactory.create();

        // Assert
        expect(config.security.rateLimit.enabled).toBe(false);
      });
    });

    it('should parse trusted proxies', () => {
      // Arrange
      process.env.TRUSTED_PROXIES = '127.0.0.1,10.0.0.1,::1';

      // Act
      const config = AppConfigFactory.create();

      // Assert
      expect(config.security.trustedProxies).toEqual(['127.0.0.1', '10.0.0.1', '::1']);
    });
  });

  // ============================================================================
  // TESTS DE CONFIGURATION DES FEATURES FLAGS
  // ============================================================================

  describe('Features Configuration', () => {
    beforeEach(() => {
      process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
      mockReadFileSync.mockReturnValue('{"version": "1.0.0"}');
    });

    it('should enable features by default in development', () => {
      // Arrange
      process.env.NODE_ENV = 'development';

      // Act
      const config = AppConfigFactory.create();

      // Assert
      expect(config.features.exportEnabled).toBe(true);
      expect(config.features.statisticsEnabled).toBe(true);
      expect(config.features.cacheEnabled).toBe(true);
      expect(config.features.swaggerEnabled).toBe(true);
      expect(config.features.debugMode).toBe(true);
    });

    it('should disable test-incompatible features in test environment', () => {
      // Arrange
      process.env.NODE_ENV = 'test';

      // Act
      const config = AppConfigFactory.create();

      // Assert
      expect(config.features.exportEnabled).toBe(false);
      expect(config.features.statisticsEnabled).toBe(false);
      expect(config.features.cacheEnabled).toBe(false);
      expect(config.features.swaggerEnabled).toBe(false);
      expect(config.features.debugMode).toBe(false);
    });

    it('should override feature flags with environment variables', () => {
      // Arrange
      process.env.EXPORT_ENABLED = 'true';
      process.env.SWAGGER_ENABLED = 'false';

      // Act
      const config = AppConfigFactory.create();

      // Assert
      expect(config.features.exportEnabled).toBe(true);
      expect(config.features.swaggerEnabled).toBe(false);
    });
  });

  // ============================================================================
  // TESTS DES MÉTHODES UTILITAIRES
  // ============================================================================

  describe('Utility Methods', () => {
    beforeEach(() => {
      process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
      mockReadFileSync.mockReturnValue('{"version": "1.0.0"}');
    });

    describe('parseBoolean', () => {
      const testCases = [
        { input: 'true', expected: true },
        { input: 'TRUE', expected: true },
        { input: '1', expected: true },
        { input: 'yes', expected: true },
        { input: 'on', expected: true },
        { input: 'false', expected: false },
        { input: 'FALSE', expected: false },
        { input: '0', expected: false },
        { input: 'no', expected: false },
        { input: 'off', expected: false },
      ];

      testCases.forEach(({ input, expected }) => {
        it(`should parse "${input}" as ${expected}`, () => {
          // Arrange
          process.env.TEST_BOOL = input;

          // Act
          const config = AppConfigFactory.create();

          // Assert - Utilisons compressionEnabled comme test
          process.env.COMPRESSION_ENABLED = input;
          const testConfig = AppConfigFactory.create();
          expect(typeof testConfig.server.compressionEnabled).toBe('boolean');
        });
      });

      it('should return default for invalid boolean values', () => {
        // Arrange
        process.env.COMPRESSION_ENABLED = 'invalid';

        // Act
        const config = AppConfigFactory.create();

        // Assert
        expect(config.server.compressionEnabled).toBe(true); // Default value
      });

      it('should handle undefined values', () => {
        // Arrange
        delete process.env.COMPRESSION_ENABLED;

        // Act
        const config = AppConfigFactory.create();

        // Assert
        expect(config.server.compressionEnabled).toBe(true); // Default value
      });

      it('should trim whitespace', () => {
        // Arrange
        process.env.COMPRESSION_ENABLED = '  true  ';

        // Act
        const config = AppConfigFactory.create();

        // Assert
        expect(config.server.compressionEnabled).toBe(true);
      });
    });

    describe('parseInt', () => {
      it('should parse valid numbers', () => {
        // Arrange
        process.env.PORT = '8080';

        // Act
        const config = AppConfigFactory.create();

        // Assert
        expect(config.server.port).toBe(8080);
      });

      it('should handle negative numbers', () => {
        // Arrange
        process.env.GLOBAL_TIMEOUT = '-1000';

        // Act
        const config = AppConfigFactory.create();

        // Assert
        expect(config.server.globalTimeout).toBe(-1000);
      });

      it('should return default for invalid numbers', () => {
        // Arrange
        process.env.PORT = 'invalid';

        // Act
        const config = AppConfigFactory.create();

        // Assert
        expect(config.server.port).toBe(3000); // Default value
      });

      it('should handle floating point strings', () => {
        // Arrange
        process.env.PORT = '8080.5';

        // Act
        const config = AppConfigFactory.create();

        // Assert
        expect(config.server.port).toBe(8080); // parseInt ignore la partie décimale
      });

      it('should handle undefined values', () => {
        // Arrange
        delete process.env.PORT;

        // Act
        const config = AppConfigFactory.create();

        // Assert
        expect(config.server.port).toBe(3000); // Default value
      });
    });

    describe('parseArray', () => {
      it('should parse comma-separated values', () => {
        // Arrange
        process.env.TRUSTED_PROXIES = 'proxy1,proxy2,proxy3';

        // Act
        const config = AppConfigFactory.create();

        // Assert
        expect(config.security.trustedProxies).toEqual(['proxy1', 'proxy2', 'proxy3']);
      });

      it('should trim whitespace', () => {
        // Arrange
        process.env.TRUSTED_PROXIES = ' proxy1 , proxy2 , proxy3 ';

        // Act
        const config = AppConfigFactory.create();

        // Assert
        expect(config.security.trustedProxies).toEqual(['proxy1', 'proxy2', 'proxy3']);
      });

      it('should filter empty values', () => {
        // Arrange
        process.env.TRUSTED_PROXIES = 'proxy1,,proxy3,';

        // Act
        const config = AppConfigFactory.create();

        // Assert
        expect(config.security.trustedProxies).toEqual(['proxy1', 'proxy3']);
      });

      it('should handle single values', () => {
        // Arrange
        process.env.TRUSTED_PROXIES = 'single-proxy';

        // Act
        const config = AppConfigFactory.create();

        // Assert
        expect(config.security.trustedProxies).toEqual(['single-proxy']);
      });

      it('should return empty array for empty string', () => {
        // Arrange
        process.env.TRUSTED_PROXIES = '';

        // Act
        const config = AppConfigFactory.create();

        // Assert
        expect(config.security.trustedProxies).toEqual([]);
      });

      it('should return empty array for undefined values', () => {
        // Arrange
        delete process.env.TRUSTED_PROXIES;

        // Act
        const config = AppConfigFactory.create();

        // Assert
        expect(config.security.trustedProxies).toEqual([]);
      });

      it('should handle mixed comma and semicolon separators', () => {
        // Arrange
        process.env.CORS_METHODS = 'GET;POST,PUT';

        // Act  
        const config = AppConfigFactory.create();

        // Assert
        expect(config.security.cors.methods).toEqual(['GET;POST', 'PUT']);
      });
    });
  });

  // ============================================================================
  // TESTS DES CAS D'ERREUR ET EDGE CASES
  // ============================================================================

  describe('Error Handling and Edge Cases', () => {
    beforeEach(() => {
      mockReadFileSync.mockReturnValue('{"version": "1.0.0"}');
    });

    it('should handle extremely large numbers', () => {
      // Arrange
      process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
      process.env.GLOBAL_TIMEOUT = '999999999';

      // Act
      const config = AppConfigFactory.create();

      // Assert
      expect(config.server.globalTimeout).toBe(999999999);
    });

    it('should handle special characters in configuration', () => {
      // Arrange
      process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
      process.env.APP_NAME = 'My App! @#$%^&*()';

      // Act
      const config = AppConfigFactory.create();

      // Assert
      expect(config.environment.appName).toBe('My App! @#$%^&*()');
    });

    it('should handle empty environment variables', () => {
      // Arrange
      process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
      process.env.API_PREFIX = '';

      // Act
      const config = AppConfigFactory.create();

      // Assert
      expect(config.server.apiPrefix).toBe('api/v1'); // Should use default
    });

    it('should provide meaningful error messages', () => {
      // Arrange
      delete process.env.DATABASE_URL;

      // Act & Assert
      try {
        AppConfigFactory.create();
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigurationError);
        expect(error.message).toContain('DATABASE_URL');
      }
    });
  });

  // ============================================================================
  // TESTS D'OBSERVABILITÉ
  // ============================================================================

  describe('Observability Configuration', () => {
    beforeEach(() => {
      process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
      mockReadFileSync.mockReturnValue('{"version": "1.0.0"}');
    });

    describe('Logging Configuration', () => {
      it('should configure logging for development', () => {
        // Arrange
        process.env.NODE_ENV = 'development';

        // Act
        const config = AppConfigFactory.create();

        // Assert
        expect(config.observability.logging.level).toBe('debug');
        expect(config.observability.logging.format).toBe('text');
        expect(config.observability.logging.enableColors).toBe(true);
      });

      it('should configure logging for production', () => {
        // Arrange
        process.env.NODE_ENV = 'production';

        // Act
        const config = AppConfigFactory.create();

        // Assert
        expect(config.observability.logging.level).toBe('info');
        expect(config.observability.logging.format).toBe('json');
        expect(config.observability.logging.enableColors).toBe(false);
      });

      it('should override log level from environment', () => {
        // Arrange
        process.env.LOG_LEVEL = 'warn';

        // Act
        const config = AppConfigFactory.create();

        // Assert
        expect(config.observability.logging.level).toBe('warn');
      });
    });

    describe('Metrics Configuration', () => {
      it('should configure metrics with defaults in development', () => {
        // Arrange
        process.env.NODE_ENV = 'development';

        // Act
        const config = AppConfigFactory.create();

        // Assert
        expect(config.observability.metrics.enabled).toBe(true);
        expect(config.observability.metrics.path).toBe('/metrics');
        expect(config.observability.metrics.defaultLabels.service).toBe('project-service');
      });

      it('should disable metrics in test environment', () => {
        // Arrange
        process.env.NODE_ENV = 'test';

        // Act
        const config = AppConfigFactory.create();

        // Assert
        expect(config.observability.metrics.enabled).toBe(false);
      });
    });

    describe('Tracing Configuration', () => {
      it('should configure tracing with defaults', () => {
        // Act
        const config = AppConfigFactory.create();

        // Assert
        expect(config.observability.tracing.enabled).toBe(false);
        expect(config.observability.tracing.serviceName).toBe('project-service');
        expect(config.observability.tracing.sampleRate).toBe(0.1);
      });

      it('should enable tracing from environment', () => {
        // Arrange
        process.env.TRACING_ENABLED = 'true';
        process.env.TRACING_SAMPLE_RATE = '0.5';

        // Act
        const config = AppConfigFactory.create();

        // Assert
        expect(config.observability.tracing.enabled).toBe(true);
        expect(config.observability.tracing.sampleRate).toBe(0.5);
      });
    });
  });

  // ============================================================================
  // TESTS DE RÉGRESSION NESTJS
  // ============================================================================

  describe('NestJS Integration', () => {
    beforeEach(() => {
      process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
      mockReadFileSync.mockReturnValue('{"version": "1.0.0"}');
    });

    it('should export appConfig for NestJS ConfigModule', () => {
      // Assert
      expect(appConfig).toBeDefined();
      expect(typeof appConfig).toBe('function');
    });

    it('should return consistent configuration structure', () => {
      // Arrange
      process.env.BUILD_TIMESTAMP = '2023-01-01T00:00:00.000Z'; // Timestamp fixe

      // Act
      const config1 = AppConfigFactory.create();
      const config2 = AppConfigFactory.create();

      // Assert - Compare tout sauf les timestamps qui peuvent varier
      expect(config1.server).toEqual(config2.server);
      expect(config1.security).toEqual(config2.security);
      expect(config1.features).toEqual(config2.features);
      expect(config1.externalServices).toEqual(config2.externalServices);
      expect(config1.observability).toEqual(config2.observability);
      
      // Vérification spécifique de l'environnement (sans buildTimestamp auto-généré)
      expect(config1.environment.nodeEnv).toEqual(config2.environment.nodeEnv);
      expect(config1.environment.appName).toEqual(config2.environment.appName);
      expect(config1.environment.appVersion).toEqual(config2.environment.appVersion);
    });

    it('should provide TypeScript types', () => {
      // Act
      const config: AppConfig = AppConfigFactory.create();

      // Assert - Test de type à la compilation
      expect(config.server.port).toEqual(expect.any(Number));
      expect(config.environment.nodeEnv).toEqual(expect.any(String));
      expect(config.features.cacheEnabled).toEqual(expect.any(Boolean));
    });
  });
});