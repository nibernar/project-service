// test/setup/cache-test-setup.ts
import { config } from 'dotenv';
import Redis from 'ioredis';

config({ path: '.env.test' });

// Configuration forcée pour les tests
process.env.NODE_ENV = 'test';
process.env.REDIS_DB = '12';
process.env.REDIS_KEY_PREFIX = 'integration-test';
process.env.REDIS_CONNECT_TIMEOUT = '15000';
process.env.REDIS_COMMAND_TIMEOUT = '10000';
process.env.REDIS_RESPONSE_TIMEOUT = '10000';
process.env.REDIS_ENABLE_OFFLINE_QUEUE = 'true';
process.env.REDIS_MAX_RETRIES_PER_REQUEST = '5';
process.env.REDIS_RETRY_DELAY = '200';
process.env.REDIS_KEEP_ALIVE = '30000';
process.env.REDIS_LAZY_CONNECT = 'false';
process.env.REDIS_ENABLE_READY_CHECK = 'true';
process.env.REDIS_FAMILY = '4';
process.env.CACHE_COMPRESSION_ENABLED = 'true';
process.env.CACHE_COMPRESSION_THRESHOLD = '1024';

export class RedisTestHelper {
  private static redis: Redis | null = null;
  private static connectionCount = 0;
  private static logger = console;

  private static getRedisConfig(): any {
    return {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      db: parseInt(process.env.REDIS_DB || '12'),
      keyPrefix: `${process.env.REDIS_KEY_PREFIX || 'integration-test'}:`, // CRITIQUE: même préfixe
      
      connectTimeout: 15000,
      commandTimeout: 10000,
      responseTimeout: 10000,
      lazyConnect: false,
      family: 4,
      maxRetriesPerRequest: 5,
      retryDelayOnFailover: 200,
      retryDelayOnClusterDown: 300,
      enableReadyCheck: true,
      enableOfflineQueue: true,
      keepAlive: 30000,
      maxLoadingTimeout: 15000,
      showFriendlyErrorStack: true,
      
      reconnectOnError: (err: Error) => {
        this.logger.warn('Redis reconnectOnError triggered:', err.message);
        const targetError = err.message.slice(0, 'READONLY'.length);
        return targetError === 'READONLY';
      },
    };
  }

  static async getRedis(retries = 3): Promise<Redis> {
    if (this.redis && this.redis.status === 'ready') {
      return this.redis;
    }

    if (this.redis && this.redis.status !== 'ready') {
      try {
        await this.redis.disconnect(false); // Force disconnect
      } catch (error) {
        this.logger.warn('Error disconnecting stale Redis connection:', (error as Error).message);
      }
      this.redis = null;
    }

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        this.logger.log(`Creating Redis connection (attempt ${attempt}/${retries})...`);
        
        this.redis = new Redis(this.getRedisConfig());
        this.connectionCount++;

        this.setupConnectionEvents(this.redis);

        await this.waitForConnection(this.redis, 20000);
        
        const pingResult = await this.redis.ping();
        if (pingResult !== 'PONG') {
          throw new Error(`Ping failed: ${pingResult}`);
        }

        this.logger.log(`Redis connection established successfully (attempt ${attempt})`);
        return this.redis;

      } catch (error) {
        this.logger.error(`Redis connection attempt ${attempt}/${retries} failed:`, (error as Error).message);
        
        if (this.redis) {
          try {
            await this.redis.disconnect(false);
          } catch (disconnectError) {
            this.logger.warn('Error disconnecting failed connection:', (disconnectError as Error).message);
          }
          this.redis = null;
        }

        if (attempt < retries) {
          const delay = Math.min(1000 * attempt, 5000);
          this.logger.log(`Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(`Failed to establish Redis connection after ${retries} attempts`);
  }

  private static setupConnectionEvents(redis: Redis): void {
    redis.on('connect', () => {
      this.logger.log('Redis: Connected to server');
    });

    redis.on('ready', () => {
      this.logger.log('Redis: Ready to receive commands');
    });

    redis.on('error', (error) => {
      this.logger.error('Redis connection error:', error.message);
    });

    redis.on('close', () => {
      this.logger.warn('Redis: Connection closed');
    });

    redis.on('reconnecting', (delay: number) => {
      this.logger.log(`Redis: Reconnecting in ${delay}ms...`);
    });

    redis.on('end', () => {
      this.logger.warn('Redis: Connection ended');
    });
  }

  private static async waitForConnection(redis: Redis, timeoutMs: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Connection timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      const checkReady = () => {
        if (redis.status === 'ready') {
          clearTimeout(timeout);
          resolve();
        } else if (redis.status === 'close' || redis.status === 'end') {
          clearTimeout(timeout);
          reject(new Error(`Connection failed with status: ${redis.status}`));
        } else {
          setTimeout(checkReady, 100);
        }
      };

      checkReady();
    });
  }

  static async isRedisAvailable(): Promise<boolean> {
    try {
      const redis = await this.getRedis(2);
      
      const pingResult = await redis.ping();
      if (pingResult !== 'PONG') return false;
      
      const testKey = `availability-test-${Date.now()}`;
      const testValue = 'test-value';
      
      await redis.setex(testKey, 5, testValue);
      const getValue = await redis.get(testKey);
      await redis.del(testKey);
      
      return getValue === testValue;
      
    } catch (error) {
      this.logger.warn('Redis availability check failed:', (error as Error).message);
      return false;
    }
  }

  static async flushTestDb(retries = 3): Promise<void> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const redis = await this.getRedis();
        await redis.flushdb();
        this.logger.log('Test database flushed successfully');
        return;
      } catch (error) {
        this.logger.warn(`Flush attempt ${attempt}/${retries} failed:`, (error as Error).message);
        if (attempt === retries) {
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  static async closeRedis(): Promise<void> {
    if (!this.redis) return;

    try {
      const currentRedis = this.redis;
      this.redis = null;

      if (currentRedis.status === 'ready') {
        // CORRECTION: Quit synchrone sans Promise.race pour éviter les handles ouverts
        await currentRedis.quit();
        this.logger.log('Redis connection closed gracefully');
      } else {
        await currentRedis.disconnect(false);
        this.logger.log('Redis connection force-closed');
      }
      
      this.connectionCount = Math.max(0, this.connectionCount - 1);
    } catch (error) {
      this.logger.error('Error closing Redis connection:', (error as Error).message);
      
      try {
        if (this.redis) {
          await this.redis.disconnect(false);
        }
      } catch (forceError) {
        this.logger.error('Force disconnect also failed:', (forceError as Error).message);
      }
    }
  }

  // Méthodes utilitaires avec gestion d'erreurs améliorée
  static async keyExists(key: string): Promise<boolean> {
    try {
      const redis = await this.getRedis();
      return (await redis.exists(key)) === 1;
    } catch (error) {
      this.logger.warn(`keyExists error for ${key}:`, (error as Error).message);
      return false;
    }
  }

  static async getValue(key: string): Promise<any> {
    try {
      const redis = await this.getRedis();
      const value = await redis.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      this.logger.warn(`getValue error for ${key}:`, (error as Error).message);
      return null;
    }
  }

  static async setValue(key: string, value: any, ttl: number = 300): Promise<boolean> {
    try {
      const redis = await this.getRedis();
      const result = await redis.setex(key, ttl, JSON.stringify(value));
      return result === 'OK';
    } catch (error) {
      this.logger.warn(`setValue error for ${key}:`, (error as Error).message);
      return false;
    }
  }

  static async reset(): Promise<void> {
    try {
      await this.flushTestDb();
      this.logger.log('Redis test state reset complete');
    } catch (error) {
      this.logger.error('Redis reset failed:', (error as Error).message);
      throw error;
    }
  }

  static getConnectionCount(): number {
    return this.connectionCount;
  }

  // NOUVELLE MÉTHODE: Diagnostic des clés
  static async debugKeys(pattern = '*'): Promise<string[]> {
    try {
      const redis = await this.getRedis();
      const keys = await redis.keys(pattern);
      this.logger.log(`Debug keys matching "${pattern}":`, keys);
      return keys;
    } catch (error) {
      this.logger.error('Error debugging keys:', (error as Error).message);
      return [];
    }
  }
}

// Fonctions utilitaires
export async function setupRedisForTests(): Promise<boolean> {
  console.log('Setting up Redis for tests...');
  
  try {
    const isAvailable = await RedisTestHelper.isRedisAvailable();
    
    if (!isAvailable) {
      console.warn(`Redis server is not available for testing!`);
      return false;
    }

    console.log('Redis server is available');
    await RedisTestHelper.flushTestDb();
    console.log('Redis test environment ready');
    return true;
    
  } catch (error) {
    console.error('Redis setup failed:', (error as Error).message);
    return false;
  }
}

export async function cleanupRedisAfterTest(): Promise<void> {
  try {
    await RedisTestHelper.reset();
  } catch (error) {
    console.warn('Redis cleanup warning:', (error as Error).message);
  }
}

export async function teardownRedisAfterTests(): Promise<void> {
  console.log('Tearing down Redis connections...');
  try {
    await RedisTestHelper.closeRedis();
    console.log('Redis connections closed');
  } catch (error) {
    console.error('Redis teardown error:', (error as Error).message);
  }
}

// Gestion des erreurs process
process.on('unhandledRejection', (reason, promise) => {
  if (reason && typeof reason === 'object' && 'code' in reason) {
    const ignoredErrors = ['ECONNRESET', 'EPIPE', 'ENOTFOUND', 'ECONNREFUSED'];
    if (ignoredErrors.includes((reason as any).code)) {
      console.warn('Ignored Redis connection error during tests:', (reason as any).code);
      return;
    }
  }

  if (reason && typeof reason === 'object' && 'message' in reason) {
    const message = (reason as any).message;
    if (message.includes('Connection is closed') || 
        message.includes('Redis connection lost') ||
        message.includes('Connection timeout')) {
      console.warn('Ignored Redis disconnection during test cleanup');
      return;
    }
  }

  if (process.env.TEST_VERBOSE === 'true') {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  }
});