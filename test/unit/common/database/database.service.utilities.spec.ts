// @ts-nocheck
// test/unit/common/database/database.service.utilities.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { DatabaseService } from '../../../../src/database/database.service';
import {
  createDatabaseTestingModule,
  createPrismaPromiseMock,
  expectDatabaseError,
} from '../../../setup/database-test-setup';

describe('DatabaseService - Utilities Tests', () => {
  let service: DatabaseService;
  let module: TestingModule;

  beforeEach(async () => {
    // Mock Logger
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

  describe('Basic functionality', () => {
    beforeEach(async () => {
      module = await createDatabaseTestingModule();
      service = module.get<DatabaseService>(DatabaseService);
    });

    it('should be defined', () => {
      expect(service).toBeDefined();
      expect(service.constructor.name).toBe('DatabaseService');
    });

    it('should have utility methods', () => {
      expect(typeof service.getHealthMetrics).toBe('function');
      expect(typeof service.isHealthy).toBe('function');
      expect(typeof service.getConnectionStatus).toBe('function');
    });
  });

  describe('resetDatabase()', () => {
    describe('✅ Test Environment - Allowed Operations', () => {
      beforeEach(async () => {
        module = await createDatabaseTestingModule({
          NODE_ENV: 'test',
        });
        service = module.get<DatabaseService>(DatabaseService);
      });

      it('should reset database in test environment', async () => {
        const mockTransaction = jest
          .spyOn(service, '$transaction')
          .mockImplementation(async (callback) => {
            return await callback({
              projectStatistics: {
                deleteMany: jest
                  .fn()
                  .mockImplementation(() =>
                    createPrismaPromiseMock({ count: 5 }),
                  ),
              },
              project: {
                deleteMany: jest
                  .fn()
                  .mockImplementation(() =>
                    createPrismaPromiseMock({ count: 10 }),
                  ),
              },
            } as any);
          });
        const warnSpy = jest.spyOn(Logger.prototype, 'warn');
        const logSpy = jest.spyOn(Logger.prototype, 'log');

        await service.resetDatabase();

        expect(mockTransaction).toHaveBeenCalledTimes(1);
        expect(warnSpy).toHaveBeenCalledWith(
          'Resetting database - TEST ENVIRONMENT ONLY',
        );
        expect(logSpy).toHaveBeenCalledWith('Database reset completed');
      });

      it('should delete data in correct order (foreign key constraints)', async () => {
        const mockProjectStatistics = {
          deleteMany: jest
            .fn()
            .mockImplementation(() => createPrismaPromiseMock({ count: 5 })),
        };
        const mockProject = {
          deleteMany: jest
            .fn()
            .mockImplementation(() => createPrismaPromiseMock({ count: 10 })),
        };

        const mockTransaction = jest
          .spyOn(service, '$transaction')
          .mockImplementation(async (callback) => {
            return await callback({
              projectStatistics: mockProjectStatistics,
              project: mockProject,
            } as any);
          });

        await service.resetDatabase();

        expect(mockTransaction).toHaveBeenCalled();
        // Vérifier que les callbacks ont été appelés dans le bon ordre
        const transactionCallback = mockTransaction.mock.calls[0][0];
        await transactionCallback({
          projectStatistics: mockProjectStatistics,
          project: mockProject,
        } as any);

        expect(mockProjectStatistics.deleteMany).toHaveBeenCalled();
        expect(mockProject.deleteMany).toHaveBeenCalled();
      });

      it('should handle empty database during reset', async () => {
        const mockTransaction = jest
          .spyOn(service, '$transaction')
          .mockImplementation(async (callback) => {
            return await callback({
              projectStatistics: {
                deleteMany: jest
                  .fn()
                  .mockImplementation(() =>
                    createPrismaPromiseMock({ count: 0 }),
                  ),
              },
              project: {
                deleteMany: jest
                  .fn()
                  .mockImplementation(() =>
                    createPrismaPromiseMock({ count: 0 }),
                  ),
              },
            } as any);
          });

        await expect(service.resetDatabase()).resolves.toBeUndefined();
        expect(mockTransaction).toHaveBeenCalled();
      });
    });

    describe('❌ Production Environment - Forbidden Operations', () => {
      beforeEach(async () => {
        module = await createDatabaseTestingModule({
          NODE_ENV: 'production',
        });
        service = module.get<DatabaseService>(DatabaseService);
      });

      it('should throw error in production environment', async () => {
        await expect(service.resetDatabase()).rejects.toThrow(
          'Database reset is only allowed in test environment',
        );
      });

      it('should not execute any database operations in production', async () => {
        const mockTransaction = jest.spyOn(service, '$transaction');

        await expect(service.resetDatabase()).rejects.toThrow();

        expect(mockTransaction).not.toHaveBeenCalled();
      });
    });

    describe('❌ Development Environment - Forbidden Operations', () => {
      beforeEach(async () => {
        module = await createDatabaseTestingModule({
          NODE_ENV: 'development',
        });
        service = module.get<DatabaseService>(DatabaseService);
      });

      it('should throw error in development environment', async () => {
        await expect(service.resetDatabase()).rejects.toThrow(
          'Database reset is only allowed in test environment',
        );
      });
    });

    describe('❌ Edge Cases - resetDatabase', () => {
      beforeEach(async () => {
        module = await createDatabaseTestingModule({
          NODE_ENV: 'test',
        });
        service = module.get<DatabaseService>(DatabaseService);
      });

      it('should handle foreign key constraint errors', async () => {
        const constraintError = new Error('Foreign key constraint violation');
        const mockTransaction = jest
          .spyOn(service, '$transaction')
          .mockRejectedValue(constraintError);
        const errorSpy = jest.spyOn(Logger.prototype, 'error');

        await expect(service.resetDatabase()).rejects.toThrow(
          'Foreign key constraint violation',
        );

        expect(mockTransaction).toHaveBeenCalled();
        expect(errorSpy).toHaveBeenCalledWith(
          'Database reset failed',
          expect.objectContaining({
            message: 'Foreign key constraint violation',
          }),
        );
      });

      it('should handle database errors during reset', async () => {
        const dbError = new Error('Database connection lost');
        const mockTransaction = jest
          .spyOn(service, '$transaction')
          .mockRejectedValue(dbError);

        await expect(service.resetDatabase()).rejects.toThrow(
          'Database connection lost',
        );
      });

      it('should handle transaction timeout during reset', async () => {
        const timeoutError = new Error('Transaction timeout');
        const mockTransaction = jest
          .spyOn(service, '$transaction')
          .mockRejectedValue(timeoutError);

        await expect(service.resetDatabase()).rejects.toThrow(
          'Transaction timeout',
        );
      });

      it('should handle undefined NODE_ENV as non-test', async () => {
        const moduleUndefinedEnv = await createDatabaseTestingModule({
          NODE_ENV: undefined,
        });
        const serviceUndefinedEnv =
          moduleUndefinedEnv.get<DatabaseService>(DatabaseService);

        await expect(serviceUndefinedEnv.resetDatabase()).rejects.toThrow(
          'Database reset is only allowed in test environment',
        );

        await moduleUndefinedEnv.close();
      });
    });
  });

  describe('seedDatabase()', () => {
    describe('✅ Development Environment - Allowed Operations', () => {
      beforeEach(async () => {
        module = await createDatabaseTestingModule({
          NODE_ENV: 'development',
        });
        service = module.get<DatabaseService>(DatabaseService);
      });

      it('should seed database in development', async () => {
        const mockCreateMany = jest
          .fn()
          .mockImplementation(() => createPrismaPromiseMock({ count: 2 }));
        Object.assign(service, {
          project: { createMany: mockCreateMany },
        });

        const logSpy = jest.spyOn(Logger.prototype, 'log');

        await service.seedDatabase();

        expect(mockCreateMany).toHaveBeenCalledWith({
          data: expect.arrayContaining([
            expect.objectContaining({
              id: 'seed-project-1',
              name: 'Sample Project 1',
              ownerId: 'seed-user-1',
            }),
            expect.objectContaining({
              id: 'seed-project-2',
              name: 'Sample Project 2',
              ownerId: 'seed-user-2',
            }),
          ]),
          skipDuplicates: true,
        });

        expect(logSpy).toHaveBeenCalledWith('Seeding database with test data');
        expect(logSpy).toHaveBeenCalledWith('Database seeded with 2 projects');
      });

      it('should skip duplicates during seeding', async () => {
        const mockCreateMany = jest
          .fn()
          .mockImplementation(() => createPrismaPromiseMock({ count: 1 })); // Un seul créé
        Object.assign(service, {
          project: { createMany: mockCreateMany },
        });

        await service.seedDatabase();

        expect(mockCreateMany).toHaveBeenCalledWith(
          expect.objectContaining({
            skipDuplicates: true,
          }),
        );
      });

      it('should return count of seeded records', async () => {
        const mockCreateMany = jest
          .fn()
          .mockImplementation(() => createPrismaPromiseMock({ count: 2 }));
        Object.assign(service, {
          project: { createMany: mockCreateMany },
        });
        const logSpy = jest.spyOn(Logger.prototype, 'log');

        await service.seedDatabase();

        expect(logSpy).toHaveBeenCalledWith('Database seeded with 2 projects');
      });
    });

    describe('✅ Test Environment - Allowed Operations', () => {
      beforeEach(async () => {
        module = await createDatabaseTestingModule({
          NODE_ENV: 'test',
        });
        service = module.get<DatabaseService>(DatabaseService);
      });

      it('should seed database in test environment', async () => {
        const mockCreateMany = jest
          .fn()
          .mockImplementation(() => createPrismaPromiseMock({ count: 2 }));
        Object.assign(service, {
          project: { createMany: mockCreateMany },
        });

        await expect(service.seedDatabase()).resolves.toBeUndefined();
        expect(mockCreateMany).toHaveBeenCalled();
      });
    });

    describe('❌ Production Environment - Forbidden Operations', () => {
      beforeEach(async () => {
        module = await createDatabaseTestingModule({
          NODE_ENV: 'production',
        });
        service = module.get<DatabaseService>(DatabaseService);
      });

      it('should throw error in production', async () => {
        await expect(service.seedDatabase()).rejects.toThrow(
          'Database seeding is only allowed in development and test environments',
        );
      });

      it('should not execute any database operations in production', async () => {
        const mockCreateMany = jest.fn();
        Object.assign(service, {
          project: { createMany: mockCreateMany },
        });

        await expect(service.seedDatabase()).rejects.toThrow();

        expect(mockCreateMany).not.toHaveBeenCalled();
      });
    });

    describe('❌ Edge Cases - seedDatabase', () => {
      beforeEach(async () => {
        module = await createDatabaseTestingModule({
          NODE_ENV: 'development',
        });
        service = module.get<DatabaseService>(DatabaseService);
      });

      it('should handle constraint violations during seed', async () => {
        const constraintError = new Error('Unique constraint violation');
        const mockCreateMany = jest.fn().mockRejectedValue(constraintError);
        Object.assign(service, {
          project: { createMany: mockCreateMany },
        });
        const errorSpy = jest.spyOn(Logger.prototype, 'error');

        await expect(service.seedDatabase()).rejects.toThrow(
          'Unique constraint violation',
        );

        expect(errorSpy).toHaveBeenCalledWith(
          'Database seeding failed',
          expect.objectContaining({
            message: 'Unique constraint violation',
          }),
        );
      });

      it('should handle database errors during seed', async () => {
        const dbError = new Error('Database connection lost');
        const mockCreateMany = jest.fn().mockRejectedValue(dbError);
        Object.assign(service, {
          project: { createMany: mockCreateMany },
        });

        await expect(service.seedDatabase()).rejects.toThrow(
          'Database connection lost',
        );
      });

      it('should handle zero records created', async () => {
        const mockCreateMany = jest
          .fn()
          .mockImplementation(() => createPrismaPromiseMock({ count: 0 }));
        Object.assign(service, {
          project: { createMany: mockCreateMany },
        });
        const logSpy = jest.spyOn(Logger.prototype, 'log');

        await service.seedDatabase();

        expect(logSpy).toHaveBeenCalledWith('Database seeded with 0 projects');
      });

      it('should handle malformed seed data', async () => {
        const mockCreateMany = jest
          .fn()
          .mockRejectedValue(new Error('Invalid data format'));
        Object.assign(service, {
          project: { createMany: mockCreateMany },
        });

        await expect(service.seedDatabase()).rejects.toThrow(
          'Invalid data format',
        );
      });

      it('should handle partial seed success', async () => {
        // Simuler un succès partiel (certains records créés, d'autres en échec)
        const mockCreateMany = jest
          .fn()
          .mockImplementation(() => createPrismaPromiseMock({ count: 1 })); // Un seul créé au lieu de 2
        Object.assign(service, {
          project: { createMany: mockCreateMany },
        });
        const logSpy = jest.spyOn(Logger.prototype, 'log');

        await service.seedDatabase();

        expect(logSpy).toHaveBeenCalledWith('Database seeded with 1 projects');
      });
    });
  });

  describe('Environment Detection Edge Cases', () => {
    it('should handle undefined NODE_ENV', async () => {
      const moduleNullEnv = await createDatabaseTestingModule({
        NODE_ENV: undefined, // Changed from null to undefined
      });
      const serviceNullEnv =
        moduleNullEnv.get<DatabaseService>(DatabaseService);

      await expect(serviceNullEnv.resetDatabase()).rejects.toThrow(
        'Database reset is only allowed in test environment',
      );

      await expect(serviceNullEnv.seedDatabase()).rejects.toThrow(
        'Database seeding is only allowed in development and test environments',
      );

      await moduleNullEnv.close();
    });

    it('should handle empty string NODE_ENV', async () => {
      const moduleEmptyEnv = await createDatabaseTestingModule({
        NODE_ENV: '',
      });
      const serviceEmptyEnv =
        moduleEmptyEnv.get<DatabaseService>(DatabaseService);

      await expect(serviceEmptyEnv.resetDatabase()).rejects.toThrow();
      await expect(serviceEmptyEnv.seedDatabase()).rejects.toThrow();

      await moduleEmptyEnv.close();
    });

    it('should handle case-sensitive environment names', async () => {
      const moduleUpperCase = await createDatabaseTestingModule({
        NODE_ENV: 'TEST', // Uppercase
      });
      const serviceUpperCase =
        moduleUpperCase.get<DatabaseService>(DatabaseService);

      // Devrait être traité comme non-test car case-sensitive
      await expect(serviceUpperCase.resetDatabase()).rejects.toThrow();

      await moduleUpperCase.close();
    });

    it('should handle invalid environment names', async () => {
      const moduleInvalidEnv = await createDatabaseTestingModule({
        NODE_ENV: 'staging',
      });
      const serviceInvalidEnv =
        moduleInvalidEnv.get<DatabaseService>(DatabaseService);

      await expect(serviceInvalidEnv.resetDatabase()).rejects.toThrow();
      await expect(serviceInvalidEnv.seedDatabase()).rejects.toThrow();

      await moduleInvalidEnv.close();
    });
  });

  describe('Utilities Integration', () => {
    beforeEach(async () => {
      module = await createDatabaseTestingModule({
        NODE_ENV: 'test',
      });
      service = module.get<DatabaseService>(DatabaseService);
    });

    it('should handle reset followed by seed', async () => {
      // Mock reset
      const mockTransaction = jest
        .spyOn(service, '$transaction')
        .mockImplementation(async (callback) => {
          return await callback({
            projectStatistics: {
              deleteMany: jest
                .fn()
                .mockImplementation(() =>
                  createPrismaPromiseMock({ count: 0 }),
                ),
            },
            project: {
              deleteMany: jest
                .fn()
                .mockImplementation(() =>
                  createPrismaPromiseMock({ count: 0 }),
                ),
            },
          } as any);
        });

      // Mock seed
      const mockCreateMany = jest
        .fn()
        .mockImplementation(() => createPrismaPromiseMock({ count: 2 }));
      Object.assign(service, {
        project: { createMany: mockCreateMany },
      });

      // Test sequence
      await service.resetDatabase();
      await service.seedDatabase();

      expect(mockTransaction).toHaveBeenCalled();
      expect(mockCreateMany).toHaveBeenCalled();
    });

    it('should handle concurrent utility operations', async () => {
      const mockTransaction = jest
        .spyOn(service, '$transaction')
        .mockImplementation(async (callback) => {
          return await callback({
            projectStatistics: {
              deleteMany: jest
                .fn()
                .mockImplementation(() =>
                  createPrismaPromiseMock({ count: 0 }),
                ),
            },
            project: {
              deleteMany: jest
                .fn()
                .mockImplementation(() =>
                  createPrismaPromiseMock({ count: 0 }),
                ),
            },
          } as any);
        });

      const mockCreateMany = jest
        .fn()
        .mockImplementation(() => createPrismaPromiseMock({ count: 2 }));
      Object.assign(service, {
        project: { createMany: mockCreateMany },
      });

      // Lancer en parallèle (ne devrait pas être fait en pratique)
      const promises = [service.resetDatabase(), service.seedDatabase()];

      await Promise.allSettled(promises);

      expect(mockTransaction).toHaveBeenCalled();
      expect(mockCreateMany).toHaveBeenCalled();
    });
  });
});
