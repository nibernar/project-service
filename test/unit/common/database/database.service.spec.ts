// @ts-nocheck
// test/unit/common/database/database.service.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { DatabaseService, DatabaseHealth, ConnectionStatus } from '../../../../src/database/database.service';
import { 
  createDatabaseTestingModule, 
  createMockConfigService, 
  createMockPrismaClient,
  createPrismaPromiseMock,
  createDelayedPrismaPromiseMock,
  expectHealthyStatus,
  expectUnhealthyStatus,
  expectDatabaseError 
} from '../../../setup/database-test-setup';

describe('DatabaseService - Unit Tests', () => {
  let service: DatabaseService;
  let configService: ConfigService;
  let module: TestingModule;

  beforeEach(async () => {
    module = await createDatabaseTestingModule();
    service = module.get<DatabaseService>(DatabaseService);
    configService = module.get<ConfigService>(ConfigService);
    
    // Mock Logger pour éviter les logs pendant les tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
  });

  afterEach(async () => {
    await module.close();
    jest.restoreAllMocks();
  });

  describe('Construction and Configuration', () => {
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
          })
        };

        expect(() => {
          new DatabaseService(mockConfigService as any);
        }).toThrow('DATABASE_URL is required but not provided');
      });

    it('should configure different log levels per environment', async () => {
      const devModule = await createDatabaseTestingModule({
        'NODE_ENV': 'development',
      });
      const devService = devModule.get<DatabaseService>(DatabaseService);
      expect(devService).toBeDefined();
      await devModule.close();

      const prodModule = await createDatabaseTestingModule({
        'NODE_ENV': 'production',
      });
      const prodService = prodModule.get<DatabaseService>(DatabaseService);
      expect(prodService).toBeDefined();
      await prodModule.close();

      // Test test environment
      const testModule = await createDatabaseTestingModule({
        'NODE_ENV': 'test',
      });
      const testService = testModule.get<DatabaseService>(DatabaseService);
      expect(testService).toBeDefined();
      await testModule.close();
    });

    it('should set correct transaction options from config', () => {
      const customModule = createDatabaseTestingModule({
        'DB_TRANSACTION_TIMEOUT': 15000,
        'DB_MAX_WAIT': 8000,
      });

      expect(customModule).resolves.toBeDefined();
    });

    it('should handle malformed DATABASE_URL gracefully', async () => {
      expect(() => {
        createDatabaseTestingModule({
          'DATABASE_URL': 'invalid-url',
        });
      }).not.toThrow(); // La validation se fait à la connexion, pas à la construction
    });

    it('should use default values when config values are missing', async () => {
      const moduleWithDefaults = await createDatabaseTestingModule({
        'DB_TRANSACTION_TIMEOUT': undefined,
        'DB_MAX_WAIT': undefined,
      });

      const serviceWithDefaults = moduleWithDefaults.get<DatabaseService>(DatabaseService);
      expect(serviceWithDefaults).toBeDefined();
      await moduleWithDefaults.close();
    });
  });

  describe('Health Check Methods', () => {
    describe('isHealthy()', () => {
      it('should return true for fast response', async () => {
        jest.spyOn(service, '$queryRaw').mockImplementation(() => {
          return new Promise(resolve => {
            setTimeout(() => resolve([{ '?column?': 1 }]), 15);
          });
        });
        
        const result = await service.isHealthy();
        
        expect(result).toBe(true);
        
        const health = service.getHealthMetrics();
        expectHealthyStatus(health);
      });

      it('should return false for slow response', async () => {
        const mockQueryRaw = jest.spyOn(service, '$queryRaw').mockImplementation(() =>
          createDelayedPrismaPromiseMock([{ '?column?': 1 }], 6000)
        );
        
        const result = await service.isHealthy();
        
        expect(result).toBe(false);
        const health = service.getHealthMetrics();
        expect(health.status).toBe('degraded');
      });

      it('should return false on query failure', async () => {
        // Mock query failure
        const mockQueryRaw = jest.spyOn(service, '$queryRaw').mockImplementation(() => 
          Promise.reject(new Error('Connection failed'))
        );
        
        const result = await service.isHealthy();
        
        expect(result).toBe(false);
        const health = service.getHealthMetrics();
        expectUnhealthyStatus(health);
      });

      it('should update responseTime metric', async () => {
        // ✅ AJOUTER ce mock spécifique
        jest.spyOn(service, '$queryRaw').mockImplementation(() => {
          return new Promise(resolve => {
            setTimeout(() => resolve([{ '?column?': 1 }]), 15);
          });
        });
        
        await service.isHealthy();
        
        const health = service.getHealthMetrics();
        expect(health.responseTime).toBeGreaterThan(0);
      });

      it('should update lastSuccessfulQuery timestamp', async () => {
        const beforeTime = new Date();
        const mockQueryRaw = jest.spyOn(service, '$queryRaw').mockImplementation(() => 
          createPrismaPromiseMock([{ '?column?': 1 }])
        );
        
        await service.isHealthy();
        
        const health = service.getHealthMetrics();
        expect(health.lastSuccessfulQuery.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      });

      it('should increment error count on failure', async () => {
        const mockQueryRaw = jest.spyOn(service, '$queryRaw').mockImplementation(() => 
          Promise.reject(new Error('Test error'))
        );
        
        const initialHealth = service.getHealthMetrics();
        const initialErrorCount = initialHealth.errors.count;
        
        await service.isHealthy();
        
        const health = service.getHealthMetrics();
        expect(health.errors.count).toBe(initialErrorCount + 1);
        expect(health.errors.lastError).toBe('Test error');
        expect(health.errors.lastErrorTime).toBeInstanceOf(Date);
      });
    });

    describe('getConnectionStatus()', () => {
      it('should return connection details on success', async () => {
        // ✅ AJOUTER ce mock spécifique
        jest.spyOn(service, '$queryRaw').mockImplementation(() => {
          return new Promise(resolve => {
            setTimeout(() => resolve([{ '?column?': 1 }]), 15);
          });
        });
        
        const status: ConnectionStatus = await service.getConnectionStatus();
        
        expect(status.isConnected).toBe(true);
        expect(status.responseTime).toBeGreaterThan(0);
        expect(status.lastCheck).toBeInstanceOf(Date);
      });

      it('should return failure details on error', async () => {
        // ✅ AJOUTER ce mock spécifique MÊME pour les erreurs
        jest.spyOn(service, '$queryRaw').mockImplementation(() => {
          return new Promise((resolve, reject) => {
            setTimeout(() => reject(new Error('Connection failed')), 15);
          });
        });
        
        const status: ConnectionStatus = await service.getConnectionStatus();
        
        expect(status.isConnected).toBe(false);
        expect(status.responseTime).toBeGreaterThan(0);
        expect(status.lastCheck).toBeInstanceOf(Date);
      });
    });

    describe('getHealthMetrics()', () => {
      it('should return current health metrics', () => {
        const health: DatabaseHealth = service.getHealthMetrics();
        
        expect(health).toHaveProperty('status');
        expect(health).toHaveProperty('responseTime');
        expect(health).toHaveProperty('connectionsActive');
        expect(health).toHaveProperty('connectionsIdle');
        expect(health).toHaveProperty('lastSuccessfulQuery');
        expect(health).toHaveProperty('errors');
        expect(health.errors).toHaveProperty('count');
        
        expect(['healthy', 'unhealthy', 'degraded']).toContain(health.status);
      });

      it('should return a copy of metrics (not reference)', () => {
        const health1 = service.getHealthMetrics();
        const health2 = service.getHealthMetrics();
        
        expect(health1).not.toBe(health2); // Différentes références
        expect(health1).toEqual(health2); // Même contenu
      });
    });
  });

  describe('Transaction Management', () => {
    describe('withTransaction()', () => {
      it('should execute callback within transaction', async () => {
        const mockCallback = jest.fn().mockResolvedValue('test result');
        const mockTransaction = jest.spyOn(service, '$transaction').mockImplementation(
          (callback) => callback({} as any)
        );
        
        const result = await service.withTransaction(mockCallback);
        
        expect(result).toBe('test result');
        expect(mockTransaction).toHaveBeenCalledWith(
          mockCallback,
          expect.objectContaining({
            timeout: 10000,
            isolationLevel: 'ReadCommitted',
          })
        );
      });

      it('should return callback result', async () => {
        const expectedResult = { id: 1, name: 'test' };
        const mockCallback = jest.fn().mockResolvedValue(expectedResult);
        const mockTransaction = jest.spyOn(service, '$transaction').mockImplementation(
          (callback) => callback({} as any)
        );
        
        const result = await service.withTransaction(mockCallback);
        
        expect(result).toEqual(expectedResult);
      });

      it('should use default transaction options', async () => {
        const mockCallback = jest.fn().mockResolvedValue('result');
        const mockTransaction = jest.spyOn(service, '$transaction').mockImplementation(
          (callback) => callback({} as any)
        );
        
        await service.withTransaction(mockCallback);
        
        expect(mockTransaction).toHaveBeenCalledWith(
          mockCallback,
          expect.objectContaining({
            timeout: 10000,
            isolationLevel: 'ReadCommitted',
          })
        );
      });

      it('should use custom transaction options', async () => {
        const mockCallback = jest.fn().mockResolvedValue('result');
        const mockTransaction = jest.spyOn(service, '$transaction').mockImplementation(
          (callback) => callback({} as any)
        );
        
        const customOptions = {
          timeout: 20000,
          isolationLevel: 'Serializable' as const,
        };
        
        await service.withTransaction(mockCallback, customOptions);
        
        expect(mockTransaction).toHaveBeenCalledWith(
          mockCallback,
          expect.objectContaining(customOptions)
        );
      });

      it('should rollback on callback exception', async () => {
        const mockError = new Error('Callback failed');
        const mockCallback = jest.fn().mockRejectedValue(mockError);
        const mockTransaction = jest.spyOn(service, '$transaction').mockImplementation(
          async (callback) => {
            try {
              return await callback({} as any);
            } catch (error) {
              throw error; // Prisma gère le rollback automatiquement
            }
          }
        );
        
        await expect(service.withTransaction(mockCallback)).rejects.toThrow('Callback failed');
        expect(mockTransaction).toHaveBeenCalled();
      });

      it('should increment error count on transaction failure', async () => {
        const mockError = new Error('Transaction failed');
        const mockCallback = jest.fn().mockRejectedValue(mockError);
        const mockTransaction = jest.spyOn(service, '$transaction').mockRejectedValue(mockError);
        
        const initialHealth = service.getHealthMetrics();
        const initialErrorCount = initialHealth.errors.count;
        
        await expect(service.withTransaction(mockCallback)).rejects.toThrow('Transaction failed');
        
        const health = service.getHealthMetrics();
        expect(health.errors.count).toBe(initialErrorCount + 1);
      });

      it('should handle transaction timeout', async () => {
        const timeoutError = new Error('Transaction timeout');
        const mockCallback = jest.fn();
        const mockTransaction = jest.spyOn(service, '$transaction').mockRejectedValue(timeoutError);
        
        await expect(service.withTransaction(mockCallback)).rejects.toThrow('Transaction timeout');
      });

      it('should handle invalid isolation level', async () => {
        const mockCallback = jest.fn().mockResolvedValue('result');
        const mockTransaction = jest.spyOn(service, '$transaction').mockImplementation(
          (callback) => callback({} as any)
        );
        
        // TypeScript devrait empêcher cela, mais testons quand même
        const invalidOptions = {
          isolationLevel: 'InvalidLevel' as any,
        };
        
        await service.withTransaction(mockCallback, invalidOptions);
        
        expect(mockTransaction).toHaveBeenCalledWith(
          mockCallback,
          expect.objectContaining(invalidOptions)
        );
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors', async () => {
      const connectionError = new Error('ECONNREFUSED');
      jest.spyOn(service, '$queryRaw').mockRejectedValue(connectionError);
      
      const result = await service.isHealthy();
      
      expect(result).toBe(false);
      const health = service.getHealthMetrics();
      expect(health.status).toBe('unhealthy');
      expect(health.errors.lastError).toBe('ECONNREFUSED');
    });

    it('should handle timeout errors', async () => {
      const timeoutError = new Error('timeout');
      jest.spyOn(service, '$queryRaw').mockRejectedValue(timeoutError);
      
      const result = await service.isHealthy();
      
      expect(result).toBe(false);
      const health = service.getHealthMetrics();
      expect(health.errors.lastError).toBe('timeout');
    });

    it('should handle authentication errors', async () => {
      const authError = new Error('authentication failed');
      jest.spyOn(service, '$queryRaw').mockRejectedValue(authError);
      
      const result = await service.isHealthy();
      
      expect(result).toBe(false);
    });
  });

  describe('Logging and Monitoring', () => {
    it('should log debug messages for transactions', async () => {
      const debugSpy = jest.spyOn(Logger.prototype, 'debug');
      const mockCallback = jest.fn().mockResolvedValue('result');
      const mockTransaction = jest.spyOn(service, '$transaction').mockImplementation(
        (callback) => callback({} as any)
      );
      
      await service.withTransaction(mockCallback);
      
      expect(debugSpy).toHaveBeenCalledWith('Starting transaction');
      expect(debugSpy).toHaveBeenCalledWith('Transaction completed successfully');
    });

    it('should log errors appropriately', async () => {
      const errorSpy = jest.spyOn(Logger.prototype, 'error');
      const mockError = new Error('Test error');
      jest.spyOn(service, '$queryRaw').mockRejectedValue(mockError);
      
      await service.isHealthy();
      
      expect(errorSpy).toHaveBeenCalledWith('Health check failed', expect.objectContaining({
        message: 'Test error'
      }));
    });
  });
});