// test/setup/cache-test-setup.ts

import { config } from 'dotenv';
import Redis from 'ioredis';

// ============================================================================
// CONFIGURATION D'ENVIRONNEMENT POUR LES TESTS
// ============================================================================

// Charger les variables d'environnement de test
config({ path: '.env.test' });

// Configuration forcée pour les tests
process.env.NODE_ENV = 'test';
process.env.REDIS_DB = '1'; // Base dédiée aux tests
process.env.CACHE_TTL = '30'; // TTL court pour les tests
process.env.REDIS_MAX_CONNECTIONS = '3';
process.env.REDIS_ENABLE_METRICS = 'false';

// ============================================================================
// UTILITAIRES DE TEST REDIS
// ============================================================================

export class RedisTestHelper {
  private static redis: Redis | null = null;
  private static connectionCount = 0;

  /**
   * Obtenir une connexion Redis pour les tests
   */
  static async getRedis(): Promise<Redis> {
    if (!this.redis) {
      this.redis = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        db: parseInt(process.env.REDIS_DB || '1'),
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
      });
      this.connectionCount++;
    }

    return this.redis;
  }

  /**
   * Vérifier si Redis est disponible
   */
  static async isRedisAvailable(): Promise<boolean> {
    try {
      const redis = await this.getRedis();
      await redis.ping();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Nettoyer la base de données de test
   */
  static async flushTestDb(): Promise<void> {
    try {
      const redis = await this.getRedis();
      await redis.flushdb();
    } catch (error) {
      console.warn('Could not flush test database:', error.message);
    }
  }

  /**
   * Fermer la connexion Redis
   */
  static async closeRedis(): Promise<void> {
    if (this.redis) {
      try {
        await this.redis.quit();
        this.connectionCount--;
      } catch (error) {
        console.warn('Error closing Redis connection:', error.message);
      } finally {
        this.redis = null;
      }
    }
  }

  /**
   * Créer des données de test dans Redis
   */
  static async seedTestData(): Promise<void> {
    const redis = await this.getRedis();

    const testData = {
      'test:project:1': { id: '1', name: 'Test Project 1' },
      'test:project:2': { id: '2', name: 'Test Project 2' },
      'test:user:123:projects:count': 2,
      'test:statistics:1': { costs: { total: 10.5 } },
    };

    for (const [key, value] of Object.entries(testData)) {
      await redis.setex(key, 300, JSON.stringify(value));
    }
  }

  /**
   * Vérifier l'existence d'une clé
   */
  static async keyExists(key: string): Promise<boolean> {
    const redis = await this.getRedis();
    const exists = await redis.exists(key);
    return exists === 1;
  }

  /**
   * Obtenir la valeur d'une clé
   */
  static async getValue(key: string): Promise<any> {
    const redis = await this.getRedis();
    const value = await redis.get(key);
    return value ? JSON.parse(value) : null;
  }

  /**
   * Définir une valeur avec TTL
   */
  static async setValue(
    key: string,
    value: any,
    ttl: number = 300,
  ): Promise<void> {
    const redis = await this.getRedis();
    await redis.setex(key, ttl, JSON.stringify(value));
  }

  /**
   * Obtenir le nombre de connexions actives
   */
  static getConnectionCount(): number {
    return this.connectionCount;
  }
}

// ============================================================================
// HELPERS DE MOCK
// ============================================================================

export class CacheMockHelper {
  /**
   * Créer un mock de Redis avec comportement par défaut
   */
  static createRedisMock(): jest.Mocked<Redis> {
    return {
      get: jest.fn(),
      setex: jest.fn(),
      del: jest.fn(),
      keys: jest.fn(),
      ping: jest.fn(),
      info: jest.fn(),
      exists: jest.fn(),
      ttl: jest.fn(),
      flushdb: jest.fn(),
      quit: jest.fn(),
    } as any;
  }

  /**
   * Configurer un mock Redis avec des réponses par défaut
   */
  static setupDefaultRedisMock(mockRedis: jest.Mocked<Redis>): void {
    mockRedis.get.mockResolvedValue(null);
    mockRedis.setex.mockResolvedValue('OK');
    mockRedis.del.mockResolvedValue(1);
    mockRedis.keys.mockResolvedValue([]);
    mockRedis.ping.mockResolvedValue('PONG');
    mockRedis.info.mockResolvedValue('# Server\nredis_version:7.2.5');
    mockRedis.exists.mockResolvedValue(0);
    mockRedis.ttl.mockResolvedValue(-1);
    mockRedis.flushdb.mockResolvedValue('OK');
    mockRedis.quit.mockResolvedValue('OK');
  }

  /**
   * Créer un mock de ConfigService pour les tests cache
   */
  static createConfigServiceMock(overrides: any = {}): jest.Mocked<any> {
    const defaultConfig = {
      performance: {
        defaultTtl: 300,
        maxConnections: 10,
        minConnections: 2,
      },
      serialization: {
        keyPrefix: 'test:',
        compression: false,
      },
      connection: {
        host: 'localhost',
        port: 6379,
        db: 1,
      },
      monitoring: {
        enabled: false,
      },
      ...overrides,
    };

    return {
      get: jest.fn().mockReturnValue(defaultConfig),
    } as any;
  }
}

// ============================================================================
// SETUP ET TEARDOWN GLOBAUX
// ============================================================================

// Variable pour tracker si c'est un test E2E (qui gère ses propres connexions)
let isE2ETest = false;

// Détecter si c'est un test E2E
beforeAll(async () => {
  const testPath = expect.getState().testPath || '';
  isE2ETest = testPath.includes('e2e') || testPath.includes('E2E');

  // Ne setup Redis que si ce n'est pas un test E2E
  if (!isE2ETest) {
    const isAvailable = await RedisTestHelper.isRedisAvailable();

    if (!isAvailable) {
      console.warn(`
      ⚠️  Redis server is not available for testing!
      
      Integration tests will be skipped.
      Only unit tests will run.
      
      To run all tests, start Redis:
      - redis-server (local)
      - docker run -d -p 6379:6379 redis:7-alpine
      `);
    } else {
      console.log('✅ Redis server is available for testing');
      await RedisTestHelper.flushTestDb();
    }
  }
});

// Nettoyer après chaque test (sauf pour les tests E2E)
afterEach(async () => {
  if (!isE2ETest) {
    await RedisTestHelper.flushTestDb();
  }
});

// Fermer les connexions après tous les tests (sauf pour les tests E2E)
afterAll(async () => {
  if (!isE2ETest) {
    await RedisTestHelper.closeRedis();
  }
});

// ============================================================================
// CONFIGURATION DES LOGS POUR LES TESTS
// ============================================================================

// Réduire les logs pendant les tests
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

console.error = (...args: any[]) => {
  // Ne log que les erreurs importantes pendant les tests
  if (process.env.TEST_VERBOSE === 'true') {
    originalConsoleError(...args);
  }
};

console.warn = (...args: any[]) => {
  // Ne log que les warnings importants pendant les tests
  if (process.env.TEST_VERBOSE === 'true') {
    originalConsoleWarn(...args);
  }
};

// Restaurer les logs après les tests
afterAll(() => {
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

// ============================================================================
// GESTIONNAIRE D'ERREURS POUR LES CONNEXIONS
// ============================================================================

// Capturer les erreurs de connexion non gérées
process.on('unhandledRejection', (reason, promise) => {
  if (reason && typeof reason === 'object' && 'code' in reason) {
    // Ignorer les erreurs de connexion Redis lors de l'arrêt des tests
    if (['ECONNRESET', 'EPIPE', 'ENOTFOUND'].includes((reason as any).code)) {
      return;
    }
  }

  if (process.env.TEST_VERBOSE === 'true') {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  }
});

// Gestionnaire pour les erreurs SIGTERM/SIGINT pendant les tests
const cleanupOnExit = async () => {
  await RedisTestHelper.closeRedis();
  process.exit(0);
};

process.on('SIGTERM', cleanupOnExit);
process.on('SIGINT', cleanupOnExit);

// ============================================================================
// EXPORT DES UTILITAIRES
// ============================================================================

export { RedisTestHelper, CacheMockHelper };

export default {
  RedisTestHelper,
  CacheMockHelper,
};
