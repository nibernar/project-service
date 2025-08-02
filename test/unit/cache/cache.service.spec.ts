// test/unit/cache/cache.service.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../../../src/cache/cache.service';
import { CACHE_KEYS, CACHE_TTL } from '../../../src/config/cache.config';
import Redis from 'ioredis';

// Token exact utilisé par @nestjs-modules/ioredis
const DEFAULT_IOREDIS_MODULE_CONNECTION_TOKEN = 'default_IORedisModuleConnectionToken';

describe('CacheService', () => {
  let service: CacheService;
  let mockRedis: jest.Mocked<Redis>;
  let mockConfigService: jest.Mocked<ConfigService>;

  const mockCacheConfig = {
    performance: {
      defaultTtl: 300,
    },
    serialization: {
      keyPrefix: 'test:',
    },
  };

  beforeEach(async () => {
    // Mock Redis instance
    mockRedis = {
      get: jest.fn(),
      setex: jest.fn(),
      del: jest.fn(),
      keys: jest.fn(),
      ping: jest.fn(),
      info: jest.fn(),
    } as any;

    // Mock ConfigService
    mockConfigService = {
      get: jest.fn().mockReturnValue(mockCacheConfig),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheService,
        {
          provide: DEFAULT_IOREDIS_MODULE_CONNECTION_TOKEN,
          useValue: mockRedis,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<CacheService>(CacheService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('get', () => {
    it('should get value from cache successfully', async () => {
      const testKey = 'test:key';
      const testValue = { id: 1, name: 'test' };
      mockRedis.get.mockResolvedValue(JSON.stringify(testValue));

      const result = await service.get<typeof testValue>(testKey);

      expect(mockRedis.get).toHaveBeenCalledWith(testKey);
      expect(result).toEqual(testValue);
    });

    it('should return null when key does not exist', async () => {
      const testKey = 'nonexistent:key';
      mockRedis.get.mockResolvedValue(null);

      const result = await service.get(testKey);

      expect(mockRedis.get).toHaveBeenCalledWith(testKey);
      expect(result).toBeNull();
    });

    it('should return null when value is invalid JSON', async () => {
      const testKey = 'invalid:json:key';
      mockRedis.get.mockResolvedValue('invalid-json-string');

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const result = await service.get(testKey);

      expect(mockRedis.get).toHaveBeenCalledWith(testKey);
      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(`Cache get error for key ${testKey}:`),
        expect.any(Error)
      );
      
      consoleSpy.mockRestore();
    });

    it('should handle Redis connection errors gracefully', async () => {
      const testKey = 'error:key';
      const error = new Error('Redis connection failed');
      mockRedis.get.mockRejectedValue(error);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const result = await service.get(testKey);

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(`Cache get error for key ${testKey}:`),
        error
      );
      
      consoleSpy.mockRestore();
    });

    it('should handle empty string values', async () => {
      const testKey = 'empty:key';
      mockRedis.get.mockResolvedValue('');

      const result = await service.get(testKey);

      expect(result).toBeNull();
    });

    it('should handle complex nested objects', async () => {
      const testKey = 'complex:key';
      const complexValue = {
        id: 1,
        metadata: {
          tags: ['tag1', 'tag2'],
          settings: {
            enabled: true,
            count: 42,
          },
        },
        items: [
          { name: 'item1', value: 100 },
          { name: 'item2', value: 200 },
        ],
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(complexValue));

      const result = await service.get(testKey);

      expect(result).toEqual(complexValue);
    });
  });

  describe('set', () => {
    it('should set value with default TTL', async () => {
      const testKey = 'test:key';
      const testValue = { id: 1, name: 'test' };
      mockRedis.setex.mockResolvedValue('OK');

      await service.set(testKey, testValue);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        testKey,
        mockCacheConfig.performance.defaultTtl,
        JSON.stringify(testValue)
      );
    });

    it('should set value with custom TTL', async () => {
      const testKey = 'test:key';
      const testValue = { id: 1, name: 'test' };
      const customTtl = 600;
      mockRedis.setex.mockResolvedValue('OK');

      await service.set(testKey, testValue, customTtl);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        testKey,
        customTtl,
        JSON.stringify(testValue)
      );
    });

    it('should handle JSON serialization correctly', async () => {
      const testKey = 'test:key';
      const testValue = {
        string: 'test',
        number: 42,
        boolean: true,
        null: null,
        array: [1, 2, 3],
        object: { nested: true },
      };
      mockRedis.setex.mockResolvedValue('OK');

      await service.set(testKey, testValue);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        testKey,
        mockCacheConfig.performance.defaultTtl,
        JSON.stringify(testValue)
      );
    });

    it('should handle Redis connection errors during set', async () => {
      const testKey = 'error:key';
      const testValue = { id: 1, name: 'test' };
      const error = new Error('Redis connection failed');
      mockRedis.setex.mockRejectedValue(error);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      await service.set(testKey, testValue);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(`Cache set error for key ${testKey}:`),
        error
      );
      
      consoleSpy.mockRestore();
    });

    it('should handle undefined values', async () => {
      const testKey = 'undefined:key';
      const testValue = undefined;
      mockRedis.setex.mockResolvedValue('OK');

      await service.set(testKey, testValue);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        testKey,
        mockCacheConfig.performance.defaultTtl,
        JSON.stringify(testValue)
      );
    });

    it('should handle zero TTL', async () => {
      const testKey = 'zero:ttl:key';
      const testValue = { test: true };
      mockRedis.setex.mockResolvedValue('OK');

      await service.set(testKey, testValue, 0);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        testKey,
        0,
        JSON.stringify(testValue)
      );
    });
  });

  describe('del', () => {
    it('should delete single key successfully', async () => {
      const testKey = 'test:key';
      mockRedis.del.mockResolvedValue(1);

      await service.del(testKey);

      expect(mockRedis.del).toHaveBeenCalledWith(testKey);
    });

    it('should delete multiple keys successfully', async () => {
      const testKeys = ['test:key1', 'test:key2', 'test:key3'];
      mockRedis.del.mockResolvedValue(3);

      await service.del(testKeys);

      expect(mockRedis.del).toHaveBeenCalledWith(...testKeys);
    });

    it('should handle deletion of non-existent keys', async () => {
      const testKey = 'nonexistent:key';
      mockRedis.del.mockResolvedValue(0);

      await service.del(testKey);

      expect(mockRedis.del).toHaveBeenCalledWith(testKey);
    });

    it('should handle empty array deletion', async () => {
      await service.del([]);

      expect(mockRedis.del).not.toHaveBeenCalled();
    });

    it('should handle Redis connection errors during delete', async () => {
      const testKey = 'error:key';
      const error = new Error('Redis connection failed');
      mockRedis.del.mockRejectedValue(error);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      await service.del(testKey);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Cache delete error:'),
        error
      );
      
      consoleSpy.mockRestore();
    });

    it('should handle deletion of single item array', async () => {
      const testKeys = ['test:key1'];
      mockRedis.del.mockResolvedValue(1);

      await service.del(testKeys);

      expect(mockRedis.del).toHaveBeenCalledWith('test:key1');
    });
  });

  describe('Business Methods', () => {
    describe('invalidateProjectCache', () => {
      it('should invalidate project cache correctly', async () => {
        const projectId = 'project-123';
        const userId = 'user-456';
        
        const expectedKeys = [
          CACHE_KEYS.PROJECT(projectId),
          CACHE_KEYS.PROJECT_STATISTICS(projectId),
          CACHE_KEYS.USER_PROJECTS_COUNT(userId),
        ];
        
        const listKeys = ['test:projects:user-456:1:10', 'test:projects:user-456:2:10'];
        mockRedis.keys.mockResolvedValue(listKeys);
        mockRedis.del.mockResolvedValue(expectedKeys.length + listKeys.length);

        await service.invalidateProjectCache(projectId, userId);

        expect(mockRedis.keys).toHaveBeenCalledWith('test:projects:user-456:*');
        expect(mockRedis.del).toHaveBeenCalledWith(...expectedKeys, 'projects:user-456:1:10', 'projects:user-456:2:10');
      });

      it('should handle Redis pattern matching errors', async () => {
        const projectId = 'project-123';
        const userId = 'user-456';
        const error = new Error('Redis keys command failed');
        mockRedis.keys.mockRejectedValue(error);

        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
        
        // Cette méthode ne devrait pas lancer d'erreur mais la gérer en interne
        await expect(service.invalidateProjectCache(projectId, userId)).resolves.not.toThrow();

        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Cache delete error:'),
          error
        );
        
        consoleSpy.mockRestore();
      });

      it('should handle empty pattern matches', async () => {
        const projectId = 'project-123';
        const userId = 'user-456';
        
        mockRedis.keys.mockResolvedValue([]);
        mockRedis.del.mockResolvedValue(3);

        await service.invalidateProjectCache(projectId, userId);

        expect(mockRedis.keys).toHaveBeenCalled();
        expect(mockRedis.del).toHaveBeenCalledWith(
          CACHE_KEYS.PROJECT(projectId),
          CACHE_KEYS.PROJECT_STATISTICS(projectId),
          CACHE_KEYS.USER_PROJECTS_COUNT(userId)
        );
      });
    });

    describe('invalidateUserProjectsCache', () => {
      it('should invalidate all user projects cache', async () => {
        const userId = 'user-456';
        const projectListKeys = [
          'test:projects:user-456:1:10',
          'test:projects:user-456:2:10',
          'test:projects:user-456:1:20',
        ];
        
        mockRedis.keys.mockResolvedValue(projectListKeys);
        mockRedis.del.mockResolvedValue(projectListKeys.length);

        await service.invalidateUserProjectsCache(userId);

        expect(mockRedis.keys).toHaveBeenCalledWith('test:projects:user-456:*');
        expect(mockRedis.del).toHaveBeenCalledWith('projects:user-456:1:10', 'projects:user-456:2:10', 'projects:user-456:1:20');
      });

      it('should handle users with no cached projects', async () => {
        const userId = 'user-with-no-cache';
        
        mockRedis.keys.mockResolvedValue([]);

        await service.invalidateUserProjectsCache(userId);

        expect(mockRedis.keys).toHaveBeenCalledWith('test:projects:user-with-no-cache:*');
        expect(mockRedis.del).not.toHaveBeenCalled();
      });

      it('should handle Redis keys command errors', async () => {
        const userId = 'user-456';
        const error = new Error('Redis keys command failed');
        mockRedis.keys.mockRejectedValue(error);

        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
        
        // Cette méthode ne devrait pas lancer d'erreur mais la gérer en interne
        await expect(service.invalidateUserProjectsCache(userId)).resolves.not.toThrow();

        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Cache delete error:'),
          error
        );
        
        consoleSpy.mockRestore();
      });
    });

    describe('Key generation utilities', () => {
      it('should generate correct project key', () => {
        const projectId = 'project-123';
        const result = service.getProjectKey(projectId);
        expect(result).toBe(CACHE_KEYS.PROJECT(projectId));
      });

      it('should generate correct project list key', () => {
        const userId = 'user-456';
        const page = 1;
        const limit = 10;
        const result = service.getProjectListKey(userId, page, limit);
        expect(result).toBe(CACHE_KEYS.PROJECT_LIST(userId, page, limit));
      });

      it('should generate correct statistics key', () => {
        const projectId = 'project-123';
        const result = service.getProjectStatisticsKey(projectId);
        expect(result).toBe(CACHE_KEYS.PROJECT_STATISTICS(projectId));
      });

      it('should generate correct user projects count key', () => {
        const userId = 'user-456';
        const result = service.getUserProjectsCountKey(userId);
        expect(result).toBe(CACHE_KEYS.USER_PROJECTS_COUNT(userId));
      });
    });
  });

  describe('Health Checks', () => {
    describe('isConnected', () => {
      it('should return true when Redis is connected', async () => {
        mockRedis.ping.mockResolvedValue('PONG');

        const result = await service.isConnected();

        expect(mockRedis.ping).toHaveBeenCalled();
        expect(result).toBe(true);
      });

      it('should return false when Redis is disconnected', async () => {
        const error = new Error('Connection refused');
        mockRedis.ping.mockRejectedValue(error);

        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
        
        const result = await service.isConnected();

        expect(result).toBe(false);
        expect(consoleSpy).toHaveBeenCalledWith(
          'Redis connection check failed:',
          error
        );
        
        consoleSpy.mockRestore();
      });

      it('should handle unexpected ping responses', async () => {
        mockRedis.ping.mockResolvedValue('UNEXPECTED_RESPONSE');

        const result = await service.isConnected();

        expect(result).toBe(false);
      });

      it('should handle ping timeout', async () => {
        const timeoutError = new Error('Command timed out');
        mockRedis.ping.mockRejectedValue(timeoutError);

        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
        
        const result = await service.isConnected();

        expect(result).toBe(false);
        expect(consoleSpy).toHaveBeenCalledWith(
          'Redis connection check failed:',
          timeoutError
        );
        
        consoleSpy.mockRestore();
      });
    });

    describe('getInfo', () => {
      it('should retrieve Redis info successfully', async () => {
        const mockInfo = `# Server
redis_version:7.2.5
redis_git_sha1:00000000
redis_mode:standalone
uptime_in_seconds:123456`;

        mockRedis.info.mockResolvedValue(mockInfo);

        const result = await service.getInfo();

        expect(mockRedis.info).toHaveBeenCalled();
        expect(result).toBe(mockInfo);
        expect(result).toContain('redis_version:7.2.5');
      });

      it('should handle INFO command errors', async () => {
        const error = new Error('INFO command failed');
        mockRedis.info.mockRejectedValue(error);

        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
        
        const result = await service.getInfo();

        expect(result).toBe('');
        expect(consoleSpy).toHaveBeenCalledWith(
          'Redis info failed:',
          error
        );
        
        consoleSpy.mockRestore();
      });

      it('should handle empty info response', async () => {
        mockRedis.info.mockResolvedValue('');

        const result = await service.getInfo();

        expect(result).toBe('');
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle very large JSON objects', async () => {
      const largeObject = {
        data: Array(1000).fill(0).map((_, i) => ({
          id: i,
          name: `item-${i}`,
          description: `Description for item ${i}`.repeat(10),
        })),
      };
      
      mockRedis.setex.mockResolvedValue('OK');
      mockRedis.get.mockResolvedValue(JSON.stringify(largeObject));

      await service.set('large:object', largeObject);
      const result = await service.get('large:object');

      expect(result).toEqual(largeObject);
    });

    it('should handle special characters in keys', async () => {
      const specialKey = 'test:key:with:colons:and-dashes_and_underscores.and.dots';
      const testValue = { test: true };
      
      mockRedis.setex.mockResolvedValue('OK');
      mockRedis.get.mockResolvedValue(JSON.stringify(testValue));

      await service.set(specialKey, testValue);
      const result = await service.get(specialKey);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        specialKey,
        mockCacheConfig.performance.defaultTtl,
        JSON.stringify(testValue)
      );
      expect(result).toEqual(testValue);
    });

    it('should handle Unicode characters', async () => {
      const unicodeKey = 'test:unicode:🚀:key';
      const unicodeValue = {
        message: 'Hello 世界! 🌍',
        emoji: '🎉🎊🥳',
        special: 'café naïve résumé',
      };
      
      mockRedis.setex.mockResolvedValue('OK');
      mockRedis.get.mockResolvedValue(JSON.stringify(unicodeValue));

      await service.set(unicodeKey, unicodeValue);
      const result = await service.get(unicodeKey);

      expect(result).toEqual(unicodeValue);
    });

    it('should handle Date objects in JSON', async () => {
      const dateKey = 'test:date:key';
      const dateValue = {
        createdAt: new Date('2025-07-31T15:00:00Z'),
        updatedAt: new Date(),
      };
      
      mockRedis.setex.mockResolvedValue('OK');
      // Note: Les dates sont sérialisées en strings par JSON.stringify
      const serializedValue = JSON.parse(JSON.stringify(dateValue));
      mockRedis.get.mockResolvedValue(JSON.stringify(serializedValue));

      await service.set(dateKey, dateValue);
      const result = await service.get(dateKey);

      expect(result).toEqual(serializedValue);
      expect(typeof result.createdAt).toBe('string');
      expect(typeof result.updatedAt).toBe('string');
    });

    it('should handle null and undefined values in objects', async () => {
      const nullKey = 'test:null:key';
      const nullValue = {
        nullValue: null,
        undefinedValue: undefined,
        emptyString: '',
        zeroValue: 0,
        falseValue: false,
      };
      
      mockRedis.setex.mockResolvedValue('OK');
      // Note: undefined est ignoré par JSON.stringify
      const expectedValue = JSON.parse(JSON.stringify(nullValue));
      mockRedis.get.mockResolvedValue(JSON.stringify(expectedValue));

      await service.set(nullKey, nullValue);
      const result = await service.get(nullKey);

      expect(result).toEqual(expectedValue);
      expect(result.nullValue).toBeNull();
      expect(result).not.toHaveProperty('undefinedValue');
      expect(result.emptyString).toBe('');
      expect(result.zeroValue).toBe(0);
      expect(result.falseValue).toBe(false);
    });

    it('should handle circular references gracefully', async () => {
      const circularKey = 'test:circular:key';
      const circularValue: any = { name: 'test' };
      circularValue.self = circularValue; // Circular reference

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      await service.set(circularKey, circularValue);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(`Cache set error for key ${circularKey}:`),
        expect.any(Error)
      );
      
      consoleSpy.mockRestore();
    });

    it('should handle very long keys', async () => {
      const longKey = 'test:' + 'a'.repeat(1000);
      const testValue = { test: true };
      
      mockRedis.setex.mockResolvedValue('OK');
      mockRedis.get.mockResolvedValue(JSON.stringify(testValue));

      await service.set(longKey, testValue);
      const result = await service.get(longKey);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        longKey,
        mockCacheConfig.performance.defaultTtl,
        JSON.stringify(testValue)
      );
      expect(result).toEqual(testValue);
    });
  });
});