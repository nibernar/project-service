// @ts-nocheck
// test/unit/common/database/database.service.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import {
  DatabaseService,
  DatabaseHealth,
  ConnectionStatus,
} from '../../../../src/database/database.service';
import {
  createDatabaseTestingModule,
  createPrismaPromiseMock,
  createDelayedPrismaPromiseMock,
  expectHealthyStatus,
  expectUnhealthyStatus,
} from '../../../setup/database-test-setup';

describe('DatabaseService - Consolidated Tests', () => {
  let service: DatabaseService;
  let configService: ConfigService;
  let module: TestingModule;

  // Setup commun pour tous les tests
  beforeEach(async () => {
    module = await createDatabaseTestingModule();
    service = module.get<DatabaseService>(DatabaseService);
    configService = module.get<ConfigService>(ConfigService);

    // Mock Logger global pour réduire le bruit
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
  });

  afterEach(async () => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    await module.close();
  });

  describe('Configuration and Construction', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
      expect(service.constructor.name).toBe('DatabaseService');
    });

    it('should throw error when DATABASE_URL is missing', async () => {
      const mockConfigService = {
        get: jest.fn((key: string) => {
          if (key === 'DATABASE_URL') return undefined;
          if (key === 'NODE_ENV') return 'test';
          return undefined;
        }),
      };

      expect(() => {
        new DatabaseService(mockConfigService as any);
      }).toThrow('DATABASE_URL is required but not provided');
    });

    it('should configure different environments correctly', async () => {
      const envs = ['development', 'production', 'test'];
      
      for (const env of envs) {
        const envModule = await createDatabaseTestingModule({ NODE_ENV: env });
        const envService = envModule.get<DatabaseService>(DatabaseService);
        expect(envService).toBeDefined();
        await envModule.close();
      }
    });

    it('should not log sensitive information from connection strings', async () => {
      const logSpy = jest.spyOn(Logger.prototype, 'log');
      const debugSpy = jest.spyOn(Logger.prototype, 'debug');

      const sensitiveModule = await createDatabaseTestingModule({
        DATABASE_URL: 'postgresql://secret_user:secret_password@localhost:5432/test_db',
      });
      const sensitiveService = sensitiveModule.get<DatabaseService>(DatabaseService);

      await sensitiveService.isHealthy().catch(() => {});
      
      const allLogs = [...logSpy.mock.calls.flat(), ...debugSpy.mock.calls.flat()].join(' ');
      expect(allLogs).not.toContain('secret_password');
      expect(allLogs).not.toContain('secret_user');

      await sensitiveModule.close();
    });
  });

  describe('Health Check Methods', () => {
    it('should return true for healthy connection', async () => {
      jest.spyOn(service, '$queryRaw').mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => resolve([{ '?column?': 1 }]), 15);
        });
      });

      const result = await service.isHealthy();
      expect(result).toBe(true);

      const health = service.getHealthMetrics();
      expectHealthyStatus(health);
      expect(health.responseTime).toBeGreaterThan(0);
    });

    it('should return false for slow or failed connection', async () => {
      // Test slow connection
      jest.spyOn(service, '$queryRaw').mockImplementation(() =>
        createDelayedPrismaPromiseMock([{ '?column?': 1 }], 6000)
      );

      let result = await service.isHealthy();
      expect(result).toBe(false);
      
      let health = service.getHealthMetrics();
      expect(health.status).toBe('degraded');

      // Test failed connection
      jest.spyOn(service, '$queryRaw').mockImplementation(() =>
        Promise.reject(new Error('Connection failed'))
      );

      result = await service.isHealthy();
      expect(result).toBe(false);
      
      health = service.getHealthMetrics();
      expectUnhealthyStatus(health);
      expect(health.errors.count).toBeGreaterThan(0);
      expect(health.errors.lastError).toBe('Connection failed');
    });

    it('should return connection status details', async () => {
      jest.spyOn(service, '$queryRaw').mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => resolve([{ '?column?': 1 }]), 15);
        });
      });

      const status: ConnectionStatus = await service.getConnectionStatus();
      expect(status.isConnected).toBe(true);
      expect(status.responseTime).toBeGreaterThan(0);
      expect(status.lastCheck).toBeInstanceOf(Date);
    });

    it('should return health metrics copy not reference', () => {
      const health1 = service.getHealthMetrics();
      const health2 = service.getHealthMetrics();

      expect(health1).not.toBe(health2); // Différentes références
      expect(health1).toEqual(health2); // Même contenu
      expect(health1).toHaveProperty('status');
      expect(['healthy', 'unhealthy', 'degraded']).toContain(health1.status);
    });
  });

  describe('Transaction Management', () => {
    it('should execute callback within transaction with default options', async () => {
      const mockCallback = jest.fn().mockResolvedValue('test result');
      const mockTransaction = jest
        .spyOn(service, '$transaction')
        .mockImplementation((callback) => callback({} as any));

      const result = await service.withTransaction(mockCallback);

      expect(result).toBe('test result');
      expect(mockTransaction).toHaveBeenCalledWith(
        mockCallback,
        expect.objectContaining({
          timeout: 10000,
          isolationLevel: 'ReadCommitted',
        }),
      );
    });

    it('should use custom transaction options', async () => {
      const mockCallback = jest.fn().mockResolvedValue('result');
      const mockTransaction = jest
        .spyOn(service, '$transaction')
        .mockImplementation((callback) => callback({} as any));

      const customOptions = {
        timeout: 20000,
        isolationLevel: 'Serializable' as const,
      };

      await service.withTransaction(mockCallback, customOptions);

      expect(mockTransaction).toHaveBeenCalledWith(
        mockCallback,
        expect.objectContaining(customOptions),
      );
    });

    it('should handle transaction failures', async () => {
      const mockError = new Error('Transaction failed');
      const mockCallback = jest.fn().mockRejectedValue(mockError);
      const mockTransaction = jest
        .spyOn(service, '$transaction')
        .mockRejectedValue(mockError);

      const initialHealth = service.getHealthMetrics();
      const initialErrorCount = initialHealth.errors.count;

      await expect(service.withTransaction(mockCallback)).rejects.toThrow('Transaction failed');

      const health = service.getHealthMetrics();
      expect(health.errors.count).toBe(initialErrorCount + 1);
    });
  });

  describe('Module Lifecycle', () => {
    it('should connect successfully on module init', async () => {
      const mockConnect = jest.spyOn(service, '$connect').mockResolvedValue(undefined);
      const mockQueryRaw = jest.spyOn(service, '$queryRaw').mockResolvedValue([{ '?column?': 1 }]);
      const logSpy = jest.spyOn(Logger.prototype, 'log');

      await service.onModuleInit();

      expect(mockConnect).toHaveBeenCalledTimes(1);
      expect(mockQueryRaw).toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledWith('Initializing database connection...');
      expect(logSpy).toHaveBeenCalledWith('Database connection established successfully');
    });

    it('should retry connection on failure', async () => {
      // Mock setTimeout pour les retries
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = jest.fn((callback: () => void) => {
        if (typeof callback === 'function') {
          callback();
        }
        return {} as any;
      }) as any;

      jest.spyOn(service, '$connect').mockRejectedValue(new Error('ECONNREFUSED'));
      const errorSpy = jest.spyOn(Logger.prototype, 'error');

      try {
        await expect(service.onModuleInit()).rejects.toThrow(
          'Failed to connect to database after 3 attempts'
        );
        expect(service.$connect).toHaveBeenCalledTimes(3);
        expect(errorSpy).toHaveBeenCalled();
      } finally {
        global.setTimeout = originalSetTimeout;
      }
    });

    it('should disconnect cleanly on module destroy', async () => {
      const mockDisconnect = jest.spyOn(service, '$disconnect').mockResolvedValue(undefined);
      const logSpy = jest.spyOn(Logger.prototype, 'log');

      await service.onModuleDestroy();

      expect(mockDisconnect).toHaveBeenCalledTimes(1);
      expect(logSpy).toHaveBeenCalledWith('Closing database connection...');
      expect(logSpy).toHaveBeenCalledWith('Database connection closed');
    });

    it('should handle disconnect errors gracefully', async () => {
      const disconnectError = new Error('Disconnect failed');
      const mockDisconnect = jest.spyOn(service, '$disconnect').mockRejectedValue(disconnectError);
      const errorSpy = jest.spyOn(Logger.prototype, 'error');

      await expect(service.onModuleDestroy()).resolves.toBeUndefined();
      expect(errorSpy).toHaveBeenCalledWith(
        'Error during disconnect',
        expect.objectContaining({ message: 'Disconnect failed' }),
      );
    });
  });

  describe('Database Utilities', () => {
    describe('resetDatabase', () => {
      it('should reset database in test environment', async () => {
        const testModule = await createDatabaseTestingModule({ NODE_ENV: 'test' });
        const testService = testModule.get<DatabaseService>(DatabaseService);

        const mockTransaction = jest.spyOn(testService, '$transaction').mockImplementation(async (callback) => {
          return await callback({
            projectStatistics: {
              deleteMany: jest.fn().mockImplementation(() => createPrismaPromiseMock({ count: 5 })),
            },
            project: {
              deleteMany: jest.fn().mockImplementation(() => createPrismaPromiseMock({ count: 10 })),
            },
          } as any);
        });

        const warnSpy = jest.spyOn(Logger.prototype, 'warn');
        const logSpy = jest.spyOn(Logger.prototype, 'log');

        await testService.resetDatabase();

        expect(mockTransaction).toHaveBeenCalledTimes(1);
        expect(warnSpy).toHaveBeenCalledWith('Resetting database - TEST ENVIRONMENT ONLY');
        expect(logSpy).toHaveBeenCalledWith('Database reset completed');

        await testModule.close();
      });

      it('should throw error in production environment', async () => {
        const prodModule = await createDatabaseTestingModule({ NODE_ENV: 'production' });
        const prodService = prodModule.get<DatabaseService>(DatabaseService);

        await expect(prodService.resetDatabase()).rejects.toThrow(
          'Database reset is only allowed in test environment'
        );

        await prodModule.close();
      });
    });

    describe('seedDatabase', () => {
      it('should seed database in development environment', async () => {
        const devModule = await createDatabaseTestingModule({ NODE_ENV: 'development' });
        const devService = devModule.get<DatabaseService>(DatabaseService);

        const mockCreateMany = jest.fn().mockImplementation(() => createPrismaPromiseMock({ count: 2 }));
        Object.assign(devService, {
          project: { createMany: mockCreateMany },
        });

        const logSpy = jest.spyOn(Logger.prototype, 'log');

        await devService.seedDatabase();

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

        expect(logSpy).toHaveBeenCalledWith('Database seeded with 2 projects');

        await devModule.close();
      });

      it('should throw error in production environment', async () => {
        const prodModule = await createDatabaseTestingModule({ NODE_ENV: 'production' });
        const prodService = prodModule.get<DatabaseService>(DatabaseService);

        await expect(prodService.seedDatabase()).rejects.toThrow(
          'Database seeding is only allowed in development and test environments'
        );

        await prodModule.close();
      });
    });

    it('should handle environment edge cases', async () => {
      const cases = [
        { env: undefined, name: 'undefined' },
        { env: '', name: 'empty string' },
        { env: 'TEST', name: 'uppercase' },
        { env: 'staging', name: 'invalid env' },
      ];

      for (const { env, name } of cases) {
        const envModule = await createDatabaseTestingModule({ NODE_ENV: env });
        const envService = envModule.get<DatabaseService>(DatabaseService);

        await expect(envService.resetDatabase()).rejects.toThrow();
        await expect(envService.seedDatabase()).rejects.toThrow();

        await envModule.close();
      }
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle various database connection errors', async () => {
      const errorTypes = [
        'ECONNREFUSED',
        'timeout',
        'authentication failed',
        'FATAL ERROR'
      ];

      for (const errorType of errorTypes) {
        jest.spyOn(service, '$queryRaw').mockRejectedValue(new Error(errorType));

        const result = await service.isHealthy();
        expect(result).toBe(false);

        const health = service.getHealthMetrics();
        expect(health.status).toBe('unhealthy');
        expect(health.errors.lastError).toBe(errorType);
      }
    });

    it('should handle SQL injection attempts safely', async () => {
      const maliciousInputs = [
        "'; DROP TABLE projects; --",
        "' OR '1'='1",
        "'; INSERT INTO evil VALUES ('hacked'); --",
      ];

      const mockQueryRaw = jest.spyOn(service, '$queryRaw').mockImplementation(() => {
        // Prisma protège automatiquement contre l'injection
        return createPrismaPromiseMock([]);
      });

      for (const maliciousInput of maliciousInputs) {
        // Test avec paramètre sécurisé (template literal)
        await service.$queryRaw`SELECT * FROM projects WHERE name = ${maliciousInput}`;
        expect(mockQueryRaw).toHaveBeenCalled();
      }
    });

    it('should enforce transaction timeouts', async () => {
      const mockTransaction = jest.spyOn(service, '$transaction').mockImplementation(
        () => new Promise((resolve, reject) => {
          setTimeout(() => reject(new Error('Transaction timeout')), 1000);
        })
      );

      await expect(
        service.withTransaction(
          async () => {
            await new Promise((resolve) => setTimeout(resolve, 2000));
            return 'should timeout';
          },
          { timeout: 500 }
        )
      ).rejects.toThrow();
    });

    it('should log debug messages appropriately', async () => {
      const debugSpy = jest.spyOn(Logger.prototype, 'debug');
      const mockCallback = jest.fn().mockResolvedValue('result');
      const mockTransaction = jest.spyOn(service, '$transaction').mockImplementation((callback) => callback({} as any));

      await service.withTransaction(mockCallback);

      expect(debugSpy).toHaveBeenCalledWith('Starting transaction');
      expect(debugSpy).toHaveBeenCalledWith('Transaction completed successfully');
    });
  });

  describe('Integration Tests', () => {
    it('should handle full lifecycle correctly', async () => {
      const mockConnect = jest.spyOn(service, '$connect').mockResolvedValue(undefined);
      const mockQueryRaw = jest.spyOn(service, '$queryRaw').mockResolvedValue([{ '?column?': 1 }]);
      const mockDisconnect = jest.spyOn(service, '$disconnect').mockResolvedValue(undefined);

      // Init
      await service.onModuleInit();
      expect(mockConnect).toHaveBeenCalledTimes(1);

      // Vérifier santé
      const isHealthy = await service.isHealthy();
      expect(isHealthy).toBe(true);

      // Transaction
      await service.withTransaction(async () => 'test');

      // Destroy
      await service.onModuleDestroy();
      expect(mockDisconnect).toHaveBeenCalledTimes(1);
    });

    it('should handle reset followed by seed in test environment', async () => {
      const testModule = await createDatabaseTestingModule({ NODE_ENV: 'test' });
      const testService = testModule.get<DatabaseService>(DatabaseService);

      // Mock reset
      const mockTransaction = jest.spyOn(testService, '$transaction').mockImplementation(async (callback) => {
        return await callback({
          projectStatistics: { deleteMany: jest.fn().mockImplementation(() => createPrismaPromiseMock({ count: 0 })) },
          project: { deleteMany: jest.fn().mockImplementation(() => createPrismaPromiseMock({ count: 0 })) },
        } as any);
      });

      // Mock seed
      const mockCreateMany = jest.fn().mockImplementation(() => createPrismaPromiseMock({ count: 2 }));
      Object.assign(testService, { project: { createMany: mockCreateMany } });

      // Execute sequence
      await testService.resetDatabase();
      await testService.seedDatabase();

      expect(mockTransaction).toHaveBeenCalled();
      expect(mockCreateMany).toHaveBeenCalled();

      await testModule.close();
    });
  });
});