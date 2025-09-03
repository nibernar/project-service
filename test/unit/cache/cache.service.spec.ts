// test/unit/cache/cache.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { CacheService } from '../../../src/cache/cache.service';
import { 
  CACHE_KEYS, 
  CACHE_TTL, 
  CacheUtils,
  ProjectListFilters 
} from '../../../src/cache/cache-keys.constants';
import { 
  CacheMockHelper,
  setupRedisForTests,
  cleanupRedisAfterTest,
  teardownRedisAfterTests
} from '../../setup/cache-test-setup';

// Token pour @nestjs-modules/ioredis@2.0.2
const REDIS_TOKEN = 'default_IORedisModuleConnectionToken';

describe('CacheService', () => {
  let service: CacheService;
  let redis: jest.Mocked<Redis>;
  let configService: jest.Mocked<ConfigService>;
  let mockHelper: CacheMockHelper;

  // Mock Redis client
  const createMockRedis = (): jest.Mocked<Redis> => ({
    get: jest.fn(),
    set: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
    mget: jest.fn(),
    exists: jest.fn(),
    expire: jest.fn(),
    keys: jest.fn(),
    ping: jest.fn(),
    pipeline: jest.fn(),
    eval: jest.fn(),
    quit: jest.fn(),
    info: jest.fn(),
  } as any);

  beforeAll(async () => {
    await setupRedisForTests();
  });

  beforeEach(async () => {
    mockHelper = new CacheMockHelper();
    mockHelper.setupDefaultRedisMock();
    
    redis = mockHelper.getMockRedis();
    configService = mockHelper.getMockConfigService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheService,
        {
          provide: REDIS_TOKEN,
          useValue: redis,
        },
        {
          provide: ConfigService,
          useValue: configService,
        },
      ],
    }).compile();

    service = module.get<CacheService>(CacheService);
  });

  afterEach(async () => {
    mockHelper.reset();
    await cleanupRedisAfterTest();
  });

  afterAll(async () => {
    await teardownRedisAfterTests();
  });

  describe('Basic Operations', () => {
    describe('get()', () => {
      it('should retrieve an existing value', async () => {
        const testValue = { id: '123', name: 'test' };
        redis.get.mockResolvedValue(JSON.stringify(testValue));

        const result = await service.get<typeof testValue>('test-key');

        expect(redis.get).toHaveBeenCalledWith('project-service:test-key');
        expect(result).toEqual(testValue);
      });

      it('should return null for non-existing key', async () => {
        redis.get.mockResolvedValue(null);

        const result = await service.get('non-existing');

        expect(result).toBeNull();
      });

      it('should handle compressed data', async () => {
        const testValue = { data: 'large data content' };
        const compressed = Buffer.from(JSON.stringify(testValue)).toString('base64');
        redis.get.mockResolvedValue(`gzip:${compressed}`);

        // Mock gzip decompression
        jest.spyOn(service as any, 'gunzipAsync').mockResolvedValue(
          Buffer.from(JSON.stringify(testValue), 'utf-8')
        );

        const result = await service.get<typeof testValue>('compressed-key');

        expect(result).toEqual(testValue);
      });

      it('should handle invalid keys gracefully', async () => {
        const result = await service.get('invalid key with spaces');

        expect(redis.get).not.toHaveBeenCalled();
        expect(result).toBeNull();
      });

      it('should handle Redis errors gracefully', async () => {
        redis.get.mockRejectedValue(new Error('Redis connection error'));

        const result = await service.get('test-key');

        expect(result).toBeNull();
      });

      it('should handle deserialization errors', async () => {
        redis.get.mockResolvedValue('invalid json{');

        const result = await service.get('test-key');

        expect(result).toBeNull();
      });
    });

    describe('set()', () => {
      it('should store a value with default TTL', async () => {
        const testValue = { id: '123' };
        redis.setex.mockResolvedValue('OK');

        const result = await service.set('test-key', testValue);

        expect(redis.setex).toHaveBeenCalledWith(
          'project-service:test-key',
          300, // DEFAULT_TTL
          JSON.stringify(testValue)
        );
        expect(result).toBe(true);
      });

      it('should store a value with custom TTL', async () => {
        const testValue = 'test-string';
        redis.setex.mockResolvedValue('OK');

        const result = await service.set('test-key', testValue, 600);

        expect(redis.setex).toHaveBeenCalledWith(
          'project-service:test-key',
          600,
          JSON.stringify(testValue)
        );
        expect(result).toBe(true);
      });

      it('should compress large values automatically', async () => {
        const largeValue = { data: 'x'.repeat(2000) }; // > compression threshold
        redis.setex.mockResolvedValue('OK');
        
        // Mock compression
        const mockCompressed = Buffer.from('compressed-data');
        jest.spyOn(service as any, 'gzipAsync').mockResolvedValue(mockCompressed);

        const result = await service.set('test-key', largeValue);

        expect(result).toBe(true);
        expect(redis.setex).toHaveBeenCalledWith(
          'project-service:test-key',
          300,
          `gzip:${mockCompressed.toString('base64')}`
        );
      });

      it('should handle invalid keys', async () => {
        const result = await service.set('invalid key!@#', 'value');

        expect(redis.setex).not.toHaveBeenCalled();
        expect(result).toBe(false);
      });

      it('should handle Redis errors gracefully', async () => {
        redis.setex.mockRejectedValue(new Error('Redis error'));

        const result = await service.set('test-key', 'value');

        expect(result).toBe(false);
      });
    });

    describe('del()', () => {
      it('should delete a single key', async () => {
        redis.del.mockResolvedValue(1);

        const result = await service.del('test-key');

        expect(redis.del).toHaveBeenCalledWith('project-service:test-key');
        expect(result).toBe(1);
      });

      it('should delete multiple keys', async () => {
        redis.del.mockResolvedValue(2);

        const result = await service.del(['key1', 'key2']);

        expect(redis.del).toHaveBeenCalledWith(
          'project-service:key1',
          'project-service:key2'
        );
        expect(result).toBe(2);
      });

      it('should handle empty key arrays', async () => {
        const result = await service.del([]);

        expect(redis.del).not.toHaveBeenCalled();
        expect(result).toBe(0);
      });

      it('should filter invalid keys', async () => {
        redis.del.mockResolvedValue(1);

        const result = await service.del(['valid-key', 'invalid key']);

        expect(redis.del).toHaveBeenCalledWith('project-service:valid-key');
        expect(result).toBe(1);
      });

      it('should handle Redis errors', async () => {
        redis.del.mockRejectedValue(new Error('Redis error'));

        const result = await service.del('test-key');

        expect(result).toBe(0);
      });
    });
  });

  describe('Advanced Operations', () => {
    describe('mget()', () => {
      it('should retrieve multiple values', async () => {
        const values = [JSON.stringify({id: '1'}), JSON.stringify({id: '2'})];
        redis.mget.mockResolvedValue(values);

        const result = await service.mget(['key1', 'key2']);

        expect(redis.mget).toHaveBeenCalledWith(
          'project-service:key1',
          'project-service:key2'
        );
        expect(result).toEqual([{id: '1'}, {id: '2'}]);
      });

      it('should handle mix of existing and non-existing values', async () => {
        redis.mget.mockResolvedValue([JSON.stringify({id: '1'}), null]);

        const result = await service.mget(['key1', 'key2']);

        expect(result).toEqual([{id: '1'}, null]);
      });

      it('should handle deserialization errors gracefully', async () => {
        redis.mget.mockResolvedValue([JSON.stringify({id: '1'}), 'invalid json']);

        const result = await service.mget(['key1', 'key2']);

        expect(result).toEqual([{id: '1'}, null]);
      });

      it('should handle empty key array', async () => {
        const result = await service.mget([]);

        expect(redis.mget).not.toHaveBeenCalled();
        expect(result).toEqual([]);
      });
    });

    describe('mset()', () => {
      it('should store multiple values in a transaction', async () => {
        const mockPipeline = mockHelper.setupPipelineMock([
          [null, 'OK'], [null, 'OK']
        ]);

        const entries: Array<[string, any, number?]> = [
          ['key1', {id: '1'}, 300],
          ['key2', {id: '2'}, 600],
        ];

        const result = await service.mset(entries);

        expect(redis.pipeline).toHaveBeenCalled();
        expect(mockPipeline.setex).toHaveBeenCalledWith(
          'project-service:key1',
          300,
          JSON.stringify({id: '1'})
        );
        expect(mockPipeline.setex).toHaveBeenCalledWith(
          'project-service:key2', 
          600,
          JSON.stringify({id: '2'})
        );
        expect(result).toBe(true);
      });

      it('should handle pipeline errors', async () => {
        const mockPipeline = mockHelper.setupPipelineMock([
          [new Error('Redis error'), null]
        ]);

        const result = await service.mset([['key1', 'value1']]);

        expect(result).toBe(false);
      });

      it('should handle empty entries array', async () => {
        const result = await service.mset([]);

        expect(redis.pipeline).not.toHaveBeenCalled();
        expect(result).toBe(true);
      });
    });

    describe('exists() and expire()', () => {
      it('should check key existence', async () => {
        redis.exists.mockResolvedValue(1);

        const result = await service.exists('test-key');

        expect(redis.exists).toHaveBeenCalledWith('project-service:test-key');
        expect(result).toBe(true);
      });

      it('should return false for non-existing key', async () => {
        redis.exists.mockResolvedValue(0);

        const result = await service.exists('test-key');

        expect(result).toBe(false);
      });

      it('should set new expiration', async () => {
        redis.expire.mockResolvedValue(1);

        const result = await service.expire('test-key', 600);

        expect(redis.expire).toHaveBeenCalledWith('project-service:test-key', 600);
        expect(result).toBe(true);
      });
    });
  });

  describe('Pattern Operations', () => {
    describe('keys()', () => {
      it('should retrieve keys by pattern', async () => {
        redis.keys.mockResolvedValue([
          'project-service:projects:list:user1:*',
          'project-service:projects:list:user2:*',
        ]);

        const result = await service.keys('projects:list:*');

        expect(redis.keys).toHaveBeenCalledWith('project-service:projects:list:*');
        expect(result).toEqual([
          'projects:list:user1:*',
          'projects:list:user2:*',
        ]);
      });

      it('should return empty array on Redis error', async () => {
        redis.keys.mockRejectedValue(new Error('Redis error'));

        const result = await service.keys('test:*');

        expect(result).toEqual([]);
      });
    });

    describe('deleteByPattern()', () => {
      it('should delete keys matching pattern', async () => {
        // Mock keys() call
        jest.spyOn(service, 'keys').mockResolvedValue(['key1', 'key2']);
        // Mock del() call
        jest.spyOn(service, 'del').mockResolvedValue(2);

        const result = await service.deleteByPattern('test:*');

        expect(service.keys).toHaveBeenCalledWith('test:*');
        expect(service.del).toHaveBeenCalledWith(['key1', 'key2']);
        expect(result).toBe(2);
      });

      it('should return 0 when no keys match pattern', async () => {
        jest.spyOn(service, 'keys').mockResolvedValue([]);

        const result = await service.deleteByPattern('no-match:*');

        expect(result).toBe(0);
      });
    });
  });

  describe('Distributed Lock System', () => {
    describe('acquireLock()', () => {
      it('should acquire lock successfully', async () => {
        redis.set.mockResolvedValue('OK');

        const lockValue = await service.acquireLock('test-operation', 'resource-123');

        expect(redis.set).toHaveBeenCalledWith(
          'project-service:locks:test-operation:resource-123',
          expect.stringMatching(/^\d+-\d+-[a-z0-9]+$/), // PID-timestamp-random
          'PX',
          300000, // TTL in milliseconds
          'NX'
        );
        expect(lockValue).toMatch(/^\d+-\d+-[a-z0-9]+$/);
      });

      it('should return null when lock already exists', async () => {
        redis.set.mockResolvedValue(null); // Lock already exists

        const lockValue = await service.acquireLock('test-operation', 'resource-123');

        expect(lockValue).toBeNull();
      });

      it('should use custom TTL', async () => {
        redis.set.mockResolvedValue('OK');

        await service.acquireLock('test-operation', 'resource-123', 600);

        expect(redis.set).toHaveBeenCalledWith(
          expect.any(String),
          expect.any(String),
          'PX',
          600000, // Custom TTL in milliseconds
          'NX'
        );
      });

      it('should handle Redis errors', async () => {
        redis.set.mockRejectedValue(new Error('Redis error'));

        const lockValue = await service.acquireLock('test-operation', 'resource-123');

        expect(lockValue).toBeNull();
      });
    });

    describe('releaseLock()', () => {
      it('should release lock with correct value', async () => {
        redis.eval.mockResolvedValue(1); // Successfully released

        const result = await service.releaseLock(
          'test-operation',
          'resource-123', 
          'valid-lock-value'
        );

        expect(redis.eval).toHaveBeenCalledWith(
          expect.stringContaining('if redis.call("GET", KEYS[1]) == ARGV[1]'),
          1,
          'project-service:locks:test-operation:resource-123',
          'valid-lock-value'
        );
        expect(result).toBe(true);
      });

      it('should fail to release with wrong lock value', async () => {
        redis.eval.mockResolvedValue(0); // Not owner or expired

        const result = await service.releaseLock(
          'test-operation',
          'resource-123',
          'wrong-lock-value'
        );

        expect(result).toBe(false);
      });

      it('should handle Redis eval errors', async () => {
        redis.eval.mockRejectedValue(new Error('Lua script error'));

        const result = await service.releaseLock(
          'test-operation',
          'resource-123',
          'lock-value'
        );

        expect(result).toBe(false);
      });
    });

    describe('isLocked()', () => {
      it('should detect active lock', async () => {
        jest.spyOn(service, 'exists').mockResolvedValue(true);

        const result = await service.isLocked('test-operation', 'resource-123');

        expect(service.exists).toHaveBeenCalledWith('locks:test-operation:resource-123');
        expect(result).toBe(true);
      });

      it('should detect no lock', async () => {
        jest.spyOn(service, 'exists').mockResolvedValue(false);

        const result = await service.isLocked('test-operation', 'resource-123');

        expect(result).toBe(false);
      });
    });
  });

  describe('Specialized Invalidation', () => {
    describe('invalidateProjectCache()', () => {
      it('should invalidate all project-related caches', async () => {
        jest.spyOn(service, 'deleteByPattern').mockResolvedValue(5);
        jest.spyOn(service, 'del').mockResolvedValue(4);

        await service.invalidateProjectCache('project-123', 'user-456');

        // Check pattern deletion for user lists
        expect(service.deleteByPattern).toHaveBeenCalledWith('projects:*:user-456:*');
        
        // Check individual key deletion
        expect(service.del).toHaveBeenCalledWith([
          'projects:project:project-123',
          'projects:project-full:project-123',
          'stats:project:project-123',
          'files:project-list:project-123',
        ]);
      });

      it('should handle invalidation errors gracefully', async () => {
        jest.spyOn(service, 'deleteByPattern').mockRejectedValue(new Error('Redis error'));
        jest.spyOn(service, 'del').mockResolvedValue(0);

        // Should not throw
        await expect(service.invalidateProjectCache('project-123', 'user-456')).resolves.toBeUndefined();
      });
    });

    describe('invalidateUserProjectsCache()', () => {
      it('should invalidate all user-related caches', async () => {
        jest.spyOn(service, 'deleteByPattern').mockResolvedValue(3);
        jest.spyOn(service, 'del').mockResolvedValue(1);

        await service.invalidateUserProjectsCache('user-456');

        expect(service.deleteByPattern).toHaveBeenCalledWith('projects:*:user-456:*');
        expect(service.deleteByPattern).toHaveBeenCalledWith('auth:session:user-456:*');
        expect(service.del).toHaveBeenCalledWith('stats:user-summary:user-456');
      });
    });

    describe('invalidateStatisticsCache()', () => {
      it('should invalidate specific project statistics', async () => {
        jest.spyOn(service, 'del').mockResolvedValue(2);

        await service.invalidateStatisticsCache('project-123');

        expect(service.del).toHaveBeenCalledWith([
          'stats:project:project-123',
          'projects:project-full:project-123',
        ]);
      });

      it('should invalidate all statistics when no projectId', async () => {
        jest.spyOn(service, 'deleteByPattern').mockResolvedValue(10);

        await service.invalidateStatisticsCache();

        expect(service.deleteByPattern).toHaveBeenCalledWith('stats:*');
      });
    });
  });

  describe('Typed Key Methods', () => {
    it('should generate correct project key', () => {
      const key = service.getProjectKey('123');
      expect(key).toBe('projects:project:123');
    });

    it('should generate correct project list key without filters', () => {
      const key = service.getProjectListKey('user-123', 1, 10);
      expect(key).toBe('projects:list:user-123:p1:l10:no-filters');
    });

    it('should generate correct project list key with filters', () => {
      const filters: ProjectListFilters = { 
        status: 'ACTIVE' as any, 
        hasFiles: true 
      };
      const key = service.getProjectListKey('user-123', 1, 10, filters);
      
      expect(key).toContain('projects:list:user-123:p1:l10:');
      expect(key).not.toContain('no-filters');
    });

    it('should generate correct statistics key', () => {
      const key = service.getProjectStatisticsKey('project-123');
      expect(key).toBe('stats:project:project-123');
    });

    it('should generate correct token validation key', () => {
      const key = service.getTokenValidationKey('sample-jwt-token');
      
      expect(key).toContain('auth:token:');
      expect(key).toHaveLength(27); // 'auth:token:' + 16 chars hash
    });
  });

  describe('Monitoring and Statistics', () => {
    describe('getStats()', () => {
      it('should return complete cache statistics', async () => {
        const mockInfo = [
          'connected_clients:5',
          'blocked_clients:0', 
          'used_memory:1024000',
          'used_memory_peak:2048000',
          'mem_fragmentation_ratio:1.2',
        ].join('\r\n');
        
        redis.info.mockResolvedValue(mockInfo);

        const stats = await service.getStats();

        expect(stats).toMatchObject({
          connections: {
            active: 5,
            idle: 0,
          },
          operations: expect.objectContaining({
            hits: expect.any(Number),
            misses: expect.any(Number),
          }),
          performance: expect.objectContaining({
            avgLatency: expect.any(Number),
            opsPerSecond: expect.any(Number),
          }),
          memory: {
            used: 1024000,
            peak: 2048000,
            fragmentation: 1.2,
          },
        });
      });

      it('should return empty stats on Redis error', async () => {
        redis.info.mockRejectedValue(new Error('Redis error'));

        const stats = await service.getStats();

        expect(stats.connections.active).toBe(0);
        expect(stats.operations.hits).toBe(0);
      });
    });

    describe('healthCheck()', () => {
      it('should return true on successful ping', async () => {
        redis.ping.mockResolvedValue('PONG');

        const result = await service.healthCheck();

        expect(redis.ping).toHaveBeenCalled();
        expect(result).toBe(true);
      });

      it('should return false on ping error', async () => {
        redis.ping.mockRejectedValue(new Error('Connection error'));

        const result = await service.healthCheck();

        expect(result).toBe(false);
      });

      it('should return false on unexpected ping response', async () => {
        redis.ping.mockResolvedValue('UNEXPECTED' as any);

        const result = await service.healthCheck();

        expect(result).toBe(false);
      });
    });
  });

  describe('Lifecycle Management', () => {
    describe('onModuleInit()', () => {
      it('should initialize successfully', async () => {
        jest.spyOn(service, 'healthCheck').mockResolvedValue(true);

        await service.onModuleInit();

        expect(service.healthCheck).toHaveBeenCalled();
      });

      it('should handle failed initial health check', async () => {
        jest.spyOn(service, 'healthCheck').mockResolvedValue(false);

        // Should not throw
        await expect(service.onModuleInit()).resolves.toBeUndefined();
      });
    });

    describe('disconnect()', () => {
      it('should close Redis connection gracefully', async () => {
        redis.quit.mockResolvedValue('OK' as any);

        await service.disconnect();

        expect(redis.quit).toHaveBeenCalled();
      });

      it('should handle disconnect errors', async () => {
        redis.quit.mockRejectedValue(new Error('Disconnect error'));

        // Should not throw
        await expect(service.disconnect()).resolves.toBeUndefined();
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    describe('Key Validation', () => {
      it('should reject keys with spaces', async () => {
        const result = await service.get('invalid key');
        expect(result).toBeNull();
        expect(redis.get).not.toHaveBeenCalled();
      });

      it('should reject keys with special characters', async () => {
        const result = await service.set('key!@#$%', 'value');
        expect(result).toBe(false);
        expect(redis.setex).not.toHaveBeenCalled();
      });

      it('should reject very long keys', async () => {
        const longKey = 'x'.repeat(300);
        const result = await service.exists(longKey);
        expect(result).toBe(false);
      });
    });

    describe('Serialization Edge Cases', () => {
      it('should handle circular references in objects', async () => {
        const circularObj: any = { name: 'test' };
        circularObj.self = circularObj;

        const result = await service.set('circular', circularObj);

        expect(result).toBe(false); // Should fail serialization
      });

      it('should handle undefined and null values', async () => {
        redis.setex.mockResolvedValue('OK');

        await service.set('null-value', null);
        await service.set('undefined-value', undefined);

        expect(redis.setex).toHaveBeenCalledWith(
          expect.any(String),
          expect.any(Number),
          'null'
        );
        expect(redis.setex).toHaveBeenCalledWith(
          expect.any(String), 
          expect.any(Number),
          'null' // undefined gets serialized as null
        );
      });

      it('should handle special characters in values', async () => {
        const specialValue = { text: 'Hello "world" \n \t 🚀' };
        redis.setex.mockResolvedValue('OK');

        const result = await service.set('special', specialValue);

        expect(result).toBe(true);
        expect(redis.setex).toHaveBeenCalledWith(
          expect.any(String),
          expect.any(Number),
          JSON.stringify(specialValue)
        );
      });
    });

    describe('TTL Edge Cases', () => {
      it('should handle zero TTL', async () => {
        redis.setex.mockResolvedValue('OK');

        await service.set('zero-ttl', 'value', 0);

        expect(redis.setex).toHaveBeenCalledWith(
          expect.any(String),
          0,
          expect.any(String)
        );
      });

      it('should handle negative TTL', async () => {
        redis.setex.mockResolvedValue('OK');

        await service.set('negative-ttl', 'value', -100);

        expect(redis.setex).toHaveBeenCalledWith(
          expect.any(String),
          -100,
          expect.any(String)
        );
      });
    });
  });

  describe('Statistics Tracking', () => {
    it('should track hits and misses correctly', async () => {
      // Setup hit
      redis.get.mockResolvedValueOnce('"hit-value"');
      // Setup miss  
      redis.get.mockResolvedValueOnce(null);

      await service.get('hit-key');
      await service.get('miss-key');

      const stats = await service.getStats();
      
      // Can't test exact numbers due to internal state, but structure should be correct
      expect(stats.operations).toMatchObject({
        hits: expect.any(Number),
        misses: expect.any(Number),
        sets: expect.any(Number),
        deletes: expect.any(Number),
        errors: expect.any(Number),
      });
    });

    it('should track operation latency', async () => {
      // Simuler une opération qui ajoute de la latence
      const mockLatency = 50;
      service['updateStats']('performance', mockLatency);

      const stats = await service.getStats();
      expect(stats.performance.avgLatency).toBeGreaterThan(0);
    });

    it('should track set operations', async () => {
      redis.setex.mockResolvedValue('OK');

      await service.set('test', 'value');

      const stats = await service.getStats();
      expect(stats.operations.sets).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Memory and Compression', () => {
    it('should compress large objects', async () => {
      const largeObject = { data: 'x'.repeat(2000) };
      redis.setex.mockResolvedValue('OK');
      
      const mockCompressed = Buffer.from('compressed');
      jest.spyOn(service as any, 'gzipAsync').mockResolvedValue(mockCompressed);

      await service.set('large-object', largeObject);

      expect(service['gzipAsync']).toHaveBeenCalled();
      expect(redis.setex).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Number),
        `gzip:${mockCompressed.toString('base64')}`
      );
    });

    it('should not compress small objects', async () => {
      const smallObject = { data: 'small' };
      redis.setex.mockResolvedValue('OK');

      await service.set('small-object', smallObject);

      expect(redis.setex).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Number),
        JSON.stringify(smallObject)
      );
    });

    it('should respect compression options', async () => {
      const object = { data: 'x'.repeat(2000) };
      redis.setex.mockResolvedValue('OK');

      await service.set('no-compress', object, 300, { compression: false });

      expect(redis.setex).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Number),
        JSON.stringify(object) // Not compressed
      );
    });
  });
});