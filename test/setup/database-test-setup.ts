// test/setup/database-test-setup.ts

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../../src/database/database.service';

/**
 * Configuration de test globale pour DatabaseService
 */

interface TestConfigValues {
  [key: string]: string | number | boolean | undefined;
}

export const createPrismaPromiseMock = (resolvedValue: any) => {
  const promise = Promise.resolve(resolvedValue);
  Object.defineProperty(promise, Symbol.toStringTag, {
    value: 'PrismaPromise',
    configurable: true
  });
  return promise;
};

export const createMockConfigService = (overrides: TestConfigValues = {}) => {
  const defaultConfig: TestConfigValues = {
    'DATABASE_URL': 'postgresql://test_user:test_pass@localhost:5433/project_service_test',
    'NODE_ENV': 'test',
    'DB_TRANSACTION_TIMEOUT': 10000,
    'DB_MAX_WAIT': 5000,
    ...overrides,
  };

  return {
    get: jest.fn((key: string, defaultValue?: any) => {
      return defaultConfig[key] ?? defaultValue;
    }),
  };
};

export const createMockPrismaClient = () => {
  const createPrismaPromiseMock = (resolvedValue: any) => {
    const promise = Promise.resolve(resolvedValue);
    Object.defineProperty(promise, Symbol.toStringTag, {
      value: 'PrismaPromise',
      configurable: true
    });
    return promise;
  };

  return {
    $connect: jest.fn().mockResolvedValue(undefined),
    $disconnect: jest.fn().mockResolvedValue(undefined),
    $queryRaw: jest.fn().mockImplementation(() => {
      return new Promise(resolve => {
        setTimeout(() => {
          resolve([{ '?column?': 1 }]);
        }, Math.floor(Math.random() * 50) + 10); // 10-60ms aléatoire
      });
    }),
    $transaction: jest.fn().mockImplementation((callback: any) => {
      if (typeof callback === 'function') {
        return callback({
          $queryRaw: jest.fn().mockImplementation(() => createPrismaPromiseMock([{ '?column?': 1 }])),
        });
      }
      return createPrismaPromiseMock(undefined);
    }),
    project: {
      createMany: jest.fn().mockImplementation(() => createPrismaPromiseMock({ count: 1 })),
      deleteMany: jest.fn().mockImplementation(() => createPrismaPromiseMock({ count: 1 })),
    },
    projectStatistics: {
      deleteMany: jest.fn().mockImplementation(() => createPrismaPromiseMock({ count: 1 })),
    },
    $on: jest.fn(),
  };
};

// Factory pour créer un module de test avec DatabaseService
export const createDatabaseTestingModule = async (
  configOverrides: TestConfigValues = {},
  mockPrisma: boolean = true,
): Promise<TestingModule> => {
  const module = await Test.createTestingModule({
    providers: [
      DatabaseService,
      {
        provide: ConfigService,
        useValue: createMockConfigService(configOverrides),
      },
    ],
  }).compile();

  if (mockPrisma) {
    const databaseService = module.get<DatabaseService>(DatabaseService);
    const mockClient = createMockPrismaClient();
    
    // Override des méthodes Prisma avec les mocks
    Object.assign(databaseService, mockClient);
  }

  return module;
};

// Helper pour créer un module de test sûr qui peut être null
export const createSafeDatabaseTestingModule = async (
  configOverrides: TestConfigValues = {},
  mockPrisma: boolean = true,
): Promise<TestingModule | null> => {
  try {
    return await createDatabaseTestingModule(configOverrides, mockPrisma);
  } catch (error) {
    console.error('Failed to create testing module:', error);
    return null;
  }
};

// Utilitaires pour les tests d'intégration
export const setupIntegrationDatabase = async () => {
  // Setup d'une vraie base de données pour les tests d'intégration
  const testDbUrl = process.env.TEST_DATABASE_URL || 
    'postgresql://test_user:test_pass@localhost:5433/project_service_test';
  
  // Ici on pourrait ajouter la logique pour :
  // - Créer une base de test isolée
  // - Exécuter les migrations
  // - Préparer les données de test
  
  return testDbUrl;
};

export const cleanupIntegrationDatabase = async () => {
  // Nettoyage après les tests d'intégration
  // - Supprimer la base de test
  // - Fermer les connexions
};

// Helpers pour les assertions
export const expectDatabaseError = (error: any, expectedMessage?: string) => {
  expect(error).toBeInstanceOf(Error);
  if (expectedMessage) {
    expect(error.message).toContain(expectedMessage);
  }
};

export const expectHealthyStatus = (health: any) => {
  expect(health.status).toBe('healthy');
  expect(health.responseTime).toBeGreaterThan(0);
  expect(health.lastSuccessfulQuery).toBeInstanceOf(Date);
};

export const expectUnhealthyStatus = (health: any) => {
  expect(health.status).toBe('unhealthy');
  expect(health.errors.count).toBeGreaterThan(0);
};

// Mock pour setTimeout dans les tests
export const mockSetTimeout = () => {
  jest.useFakeTimers();
  return {
    advance: (ms: number) => jest.advanceTimersByTime(ms),
    restore: () => jest.useRealTimers(),
  };
};

// Helper pour créer des mocks avec timeout
export const createDelayedPrismaPromiseMock = (resolvedValue: any, delay: number = 1000) => {
  const promise = new Promise((resolve) => {
    setTimeout(() => resolve(resolvedValue), delay);
  });
  
  Object.defineProperty(promise, Symbol.toStringTag, {
    value: 'PrismaPromise',
    configurable: true
  });
  
  return promise;
};

// Helper pour les tests avec transactions
export const createTransactionMock = (mockImplementation?: any) => {
  return jest.fn().mockImplementation((callback: any) => {
    if (typeof callback === 'function') {
      const txMock = {
        $queryRaw: jest.fn().mockImplementation(() => createPrismaPromiseMock([{ '?column?': 1 }])),
        project: {
          createMany: jest.fn().mockImplementation(() => createPrismaPromiseMock({ count: 1 })),
          deleteMany: jest.fn().mockImplementation(() => createPrismaPromiseMock({ count: 1 })),
        },
        projectStatistics: {
          deleteMany: jest.fn().mockImplementation(() => createPrismaPromiseMock({ count: 1 })),
        },
      };
      return callback(txMock);
    }
    return createPrismaPromiseMock(mockImplementation || undefined);
  });
};

// Configuration Jest spécifique aux tests de base de données
beforeAll(() => {
  // Configuration globale avant tous les tests
});

afterAll(() => {
  // Nettoyage global après tous les tests
});

beforeEach(() => {
  // Reset des mocks avant chaque test
  jest.clearAllMocks();
});

afterEach(() => {
  // Nettoyage après chaque test
  jest.restoreAllMocks();
});