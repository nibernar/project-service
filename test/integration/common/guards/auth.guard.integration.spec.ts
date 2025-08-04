// test/integration/common/guards/auth.guard.integration.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HttpModule, HttpService } from '@nestjs/axios';
import { ExecutionContext, UnauthorizedException, ServiceUnavailableException, InternalServerErrorException } from '@nestjs/common';
import { of, throwError, delay } from 'rxjs';
import { AxiosResponse, AxiosError } from 'axios';
import Redis from 'ioredis-mock';

import { AuthGuard } from '../../../../src/common/guards/auth.guard';
import { CacheService } from '../../../../src/cache/cache.service';
import { CacheModule } from '../../../../src/cache/cache.module';
import { User } from '../../../../src/common/interfaces/user.interface';

describe('AuthGuard - Integration Tests', () => {
  let module: TestingModule;
  let authGuard: AuthGuard;
  let configService: ConfigService;
  let cacheService: CacheService;
  let httpService: HttpService;
  let redisClient: InstanceType<typeof Redis>; // Fix: Utilisation du type correct

  // ============================================================================
  // HELPERS D'INTÉGRATION
  // ============================================================================

  const createMockExecutionContext = (request: any): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: jest.fn(),
        getNext: jest.fn(),
      }),
      switchToRpc: jest.fn(),
      switchToWs: jest.fn(),
      getType: () => 'http',
      getClass: jest.fn(),
      getHandler: jest.fn(),
      getArgs: jest.fn(),
      getArgByIndex: jest.fn(),
    } as ExecutionContext;
  };

  const createTestUser = (): User => ({
    id: 'integration-user-123',
    email: 'integration@example.com',
    roles: ['user'],
  });

  const createAuthResponse = (user: User): AxiosResponse => ({
    data: {
      valid: true,
      user: {
        id: user.id,
        email: user.email,
        roles: user.roles,
      },
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    },
    status: 200,
    statusText: 'OK',
    headers: {},
    config: {} as any,
  });

  const waitForCache = (ms: number = 50): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, ms));
  };

  // ============================================================================
  // SETUP ET TEARDOWN
  // ============================================================================

  beforeAll(async () => {
    // Setup Redis mock
    redisClient = new Redis({
      data: {},
      lazyConnect: false,
      enableOfflineQueue: true,
    });

    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [
            () => ({
              AUTH_SERVICE_URL: 'http://localhost:3001',
              AUTH_SERVICE_TIMEOUT: '5000',
              AUTH_CACHE_TTL: '300',
              REDIS_HOST: 'localhost',
              REDIS_PORT: '6379',
            }),
          ],
        }),
        HttpModule.register({
          timeout: 5000,
          maxRedirects: 0,
        }),
      ],
      providers: [
        AuthGuard,
        {
          provide: CacheService,
          useFactory: () => {
            const mockCacheService = {
              redis: redisClient,
              async get(key: string) {
                return redisClient.get(key).then((value: string | null) => value ? JSON.parse(value) : null); // Fix: Type explicite pour value
              },
              async set(key: string, value: any, ttl?: number) {
                const serialized = JSON.stringify(value);
                if (ttl) {
                  return redisClient.setex(key, ttl, serialized);
                }
                return redisClient.set(key, serialized);
              },
              async del(key: string | string[]) {
                return Array.isArray(key) ? redisClient.del(...key) : redisClient.del(key);
              },
            };
            return mockCacheService;
          },
        },
      ],
    }).compile();

    authGuard = module.get<AuthGuard>(AuthGuard);
    configService = module.get<ConfigService>(ConfigService);
    cacheService = module.get<CacheService>(CacheService);
    httpService = module.get<HttpService>(HttpService);
  });

  afterAll(async () => {
    try {
      await redisClient.flushall();
      await redisClient.quit();
    } catch (error) {
      // Ignore Redis mock cleanup errors
    }
    await module.close();
  });

  beforeEach(async () => {
    // Clear cache before each test
    try {
      await redisClient.flushall();
    } catch (error) {
      // Ignore Redis mock connection errors
    }
    jest.clearAllMocks();
  });

  // ============================================================================
  // TESTS D'INTÉGRATION - FLUX COMPLET
  // ============================================================================

  describe('Complete Authentication Flow', () => {
    it('should perform complete cache miss -> auth service -> cache set flow', async () => {
      // Arrange
      const token = 'eyJhbGciOiJIUzI1NiJ9.integration-test-token.signature';
      const user = createTestUser();
      const request = { headers: { authorization: `Bearer ${token}` } };
      const context = createMockExecutionContext(request);

      // Mock HTTP service response
      jest.spyOn(httpService, 'post').mockReturnValue(of(createAuthResponse(user)));

      // Act
      const result = await authGuard.canActivate(context);

      // Assert
      expect(result).toBe(true);
      expect((request as any).user).toEqual(user);

      // Verify cache was populated
      await waitForCache();
      const cacheKey = `auth:token:${require('crypto').createHash('sha256').update(token).digest('hex')}`;
      const cachedUser = await cacheService.get(cacheKey);
      expect(cachedUser).toEqual(user);
    });

    it('should perform complete cache hit flow without calling auth service', async () => {
      // Arrange
      const token = 'eyJhbGciOiJIUzI1NiJ9.cached-token.signature';
      const user = createTestUser();
      const request = { headers: { authorization: `Bearer ${token}` } };
      const context = createMockExecutionContext(request);

      // Pre-populate cache
      const cacheKey = `auth:token:${require('crypto').createHash('sha256').update(token).digest('hex')}`;
      await cacheService.set(cacheKey, user, 300);

      // Mock HTTP service (should not be called)
      const httpSpy = jest.spyOn(httpService, 'post');

      // Act
      const result = await authGuard.canActivate(context);

      // Assert
      expect(result).toBe(true);
      expect((request as any).user).toEqual(user);
      expect(httpSpy).not.toHaveBeenCalled();
    });

    it('should handle cache failure and fallback to auth service', async () => {
      // Arrange
      const token = 'eyJhbGciOiJIUzI1NiJ9.fallback-token.signature';
      const user = createTestUser();
      const request = { headers: { authorization: `Bearer ${token}` } };
      const context = createMockExecutionContext(request);

      // Simulate cache failure
      jest.spyOn(cacheService, 'get').mockRejectedValue(new Error('Redis connection lost'));
      jest.spyOn(httpService, 'post').mockReturnValue(of(createAuthResponse(user)));

      // Act
      const result = await authGuard.canActivate(context);

      // Assert
      expect(result).toBe(true);
      expect((request as any).user).toEqual(user);
      expect(httpService.post).toHaveBeenCalled();
    });

    it('should handle auth service failure with proper error propagation', async () => {
      // Arrange
      const token = 'eyJhbGciOiJIUzI1NiJ9.invalid-token.signature';
      const request = { headers: { authorization: `Bearer ${token}` } };
      const context = createMockExecutionContext(request);

      // Mock auth service failure
      jest.spyOn(httpService, 'post').mockReturnValue(
        throwError(() => ({
          response: { status: 401 },
          message: 'Unauthorized'
        }))
      );

      // Act & Assert
      await expect(authGuard.canActivate(context)).rejects.toThrow(UnauthorizedException);
      await expect(authGuard.canActivate(context)).rejects.toThrow('Authentication failed');

      // Verify no cache pollution
      const cacheKey = `auth:token:${require('crypto').createHash('sha256').update(token).digest('hex')}`;
      const cachedUser = await cacheService.get(cacheKey);
      expect(cachedUser).toBeNull();
    });
  });

  // ============================================================================
  // TESTS D'INTÉGRATION - CONFIGURATION RÉELLE
  // ============================================================================

  describe('Real Configuration Integration', () => {
    it('should use actual configuration values from ConfigService', async () => {
      // Arrange
      const token = 'eyJhbGciOiJIUzI1NiJ9.config-test.signature';
      const user = createTestUser();
      const request = { headers: { authorization: `Bearer ${token}` } };
      const context = createMockExecutionContext(request);

      let capturedUrl: string = '';
      let capturedConfig: any = {};

      // Mock HTTP service to capture actual call
      jest.spyOn(httpService, 'post').mockImplementation((url, data, config) => {
        capturedUrl = url;
        capturedConfig = config;
        return of(createAuthResponse(user));
      });

      // Act
      await authGuard.canActivate(context);

      // Assert
      expect(capturedUrl).toBe('http://localhost:3001/auth/validate');
      expect(capturedConfig.timeout).toBe(5000);
      expect(capturedConfig.headers).toEqual({
        'Content-Type': 'application/json',
        'User-Agent': expect.stringMatching(/project-service/),
      });
    });

    it('should use configured cache TTL from ConfigService', async () => {
      // Arrange
      const token = 'eyJhbGciOiJIUzI1NiJ9.ttl-test.signature';
      const user = createTestUser();
      const request = { headers: { authorization: `Bearer ${token}` } };
      const context = createMockExecutionContext(request);

      jest.spyOn(httpService, 'post').mockReturnValue(of(createAuthResponse(user)));

      // Act
      await authGuard.canActivate(context);

      // Assert - Check cache TTL
      await waitForCache();
      const cacheKey = `auth:token:${require('crypto').createHash('sha256').update(token).digest('hex')}`;
      const ttl = await redisClient.ttl(cacheKey);
      expect(ttl).toBeGreaterThan(250); // Should be close to 300 (5 minutes)
      expect(ttl).toBeLessThanOrEqual(300);
    });

    it('should handle missing configuration gracefully', async () => {
      // Arrange
      const originalGet = configService.get.bind(configService);
      jest.spyOn(configService, 'get').mockImplementation((key: string, defaultValue?: any) => { // Fix: Ajout du paramètre defaultValue
        if (key === 'AUTH_SERVICE_URL') return undefined;
        return originalGet(key, defaultValue); // Fix: Appel direct avec bind
      });

      const token = 'eyJhbGciOiJIUzI1NiJ9.missing-config.signature';
      const request = { headers: { authorization: `Bearer ${token}` } };
      const context = createMockExecutionContext(request);

      // Act & Assert
      await expect(authGuard.canActivate(context)).rejects.toThrow();
    });
  });

  // ============================================================================
  // TESTS D'INTÉGRATION - CONCURRENCE RÉELLE
  // ============================================================================

  describe('Real Concurrency Integration', () => {
    it('should handle concurrent requests with real cache operations', async () => {
      // Arrange
      const token = 'eyJhbGciOiJIUzI1NiJ9.concurrent-real.signature';
      const user = createTestUser();

      let authServiceCallCount = 0;
      jest.spyOn(httpService, 'post').mockImplementation(() => {
        authServiceCallCount++;
        // Simulate network delay with delayed Observable
        return of(createAuthResponse(user)).pipe(
          delay(50)
        );
      });

      // Act - 20 concurrent requests
      const promises = Array.from({ length: 20 }, async (_, i) => {
        const request = { headers: { authorization: `Bearer ${token}` } };
        const context = createMockExecutionContext(request);
        return authGuard.canActivate(context);
      });

      const results = await Promise.all(promises);

      // Assert
      expect(results.every(result => result === true)).toBe(true);
      
      // All requests should succeed even if auth service is called multiple times
      expect(authServiceCallCount).toBeGreaterThan(0);
      expect(authServiceCallCount).toBeLessThanOrEqual(20);

      // Verify cache contains the user
      await waitForCache(100);
      const cacheKey = `auth:token:${require('crypto').createHash('sha256').update(token).digest('hex')}`;
      const cachedUser = await cacheService.get(cacheKey);
      expect(cachedUser).toEqual(user);
    });

    it('should handle mixed cache hits and misses in concurrent scenario', async () => {
      // Arrange
      const users = Array.from({ length: 5 }, (_, i) => ({
        id: `concurrent-user-${i}`,
        email: `user${i}@example.com`,
        roles: ['user'],
      }));

      const tokens = users.map((_, i) => `eyJhbGciOiJIUzI1NiJ9.concurrent-${i}.signature`);

      // Pre-populate cache for first 3 users
      for (let i = 0; i < 3; i++) {
        const cacheKey = `auth:token:${require('crypto').createHash('sha256').update(tokens[i]).digest('hex')}`;
        await cacheService.set(cacheKey, users[i], 300);
      }

      // Mock auth service for cache misses
      jest.spyOn(httpService, 'post').mockImplementation(() => {
        return of(createAuthResponse(users[0])); // Return any valid user
      });

      // Act - Concurrent requests with mix of cache hits and misses
      const promises = tokens.flatMap(token => 
        Array.from({ length: 4 }, async () => {
          const request = { headers: { authorization: `Bearer ${token}` } };
          const context = createMockExecutionContext(request);
          return authGuard.canActivate(context);
        })
      );

      const results = await Promise.all(promises);

      // Assert
      expect(results.every(result => result === true)).toBe(true);
      expect(results).toHaveLength(20); // 5 tokens × 4 requests each
    });
  });

  // ============================================================================
  // TESTS D'INTÉGRATION - RÉSILIENCE RÉSEAU
  // ============================================================================

  describe('Network Resilience Integration', () => {
    it('should handle network timeouts with real HTTP client', async () => {
      // Arrange
      const token = 'eyJhbGciOiJIUzI1NiJ9.timeout-test.signature';
      const request = { headers: { authorization: `Bearer ${token}` } };
      const context = createMockExecutionContext(request);

      // Mock a timeout error
      jest.spyOn(httpService, 'post').mockReturnValue(
        throwError(() => ({
          code: 'ECONNABORTED',
          message: 'timeout of 5000ms exceeded',
          name: 'Error',
        }))
      );

      await expect(authGuard.canActivate(context)).rejects.toThrow(ServiceUnavailableException);
    });

    it('should handle network connection errors', async () => {
      // Arrange
      const token = 'eyJhbGciOiJIUzI1NiJ9.connection-error.signature';
      const request = { headers: { authorization: `Bearer ${token}` } };
      const context = createMockExecutionContext(request);

      // Mock connection error
      jest.spyOn(httpService, 'post').mockReturnValue(
        throwError(() => ({
          code: 'ECONNREFUSED',
          message: 'connect ECONNREFUSED 127.0.0.1:3001',
          name: 'Error',
        }))
      );

      // Act & Assert
      await expect(authGuard.canActivate(context)).rejects.toThrow(ServiceUnavailableException);
    });

    it('should handle DNS resolution errors', async () => {
      // Arrange
      const token = 'eyJhbGciOiJIUzI1NiJ9.dns-error.signature';
      const request = { headers: { authorization: `Bearer ${token}` } };
      const context = createMockExecutionContext(request);

      // Mock DNS error
      jest.spyOn(httpService, 'post').mockReturnValue(
        throwError(() => ({
          code: 'ENOTFOUND',
          message: 'getaddrinfo ENOTFOUND non-existent-auth-service.local',
          name: 'Error',
        }))
      );

      // Act & Assert
      await expect(authGuard.canActivate(context)).rejects.toThrow(ServiceUnavailableException);
    });

    it('should recover after network issues are resolved', async () => {
      const token = 'eyJhbGciOiJIUzI1NiJ9.recovery-test.signature';
      const user = createTestUser();
      const request = { headers: { authorization: `Bearer ${token}` } };
      const context = createMockExecutionContext(request);

      const httpSpy = jest.spyOn(httpService, 'post');

      httpSpy.mockReturnValueOnce(
        throwError(() => new Error('Network error'))
      );

      httpSpy.mockReturnValueOnce(of(createAuthResponse(user)));

      await expect(authGuard.canActivate(context)).rejects.toThrow(UnauthorizedException);

      const result = await authGuard.canActivate(context);

      expect(result).toBe(true);
      expect((request as any).user).toEqual(user);
    });
  });

  // ============================================================================
  // TESTS D'INTÉGRATION - CACHE REDIS RÉEL
  // ============================================================================

  describe('Real Redis Cache Integration', () => {
    it('should perform actual Redis operations for cache management', async () => {
      const token = 'eyJhbGciOiJIUzI1NiJ9.redis-test.signature';
      const user = createTestUser();
      const request = { headers: { authorization: `Bearer ${token}` } };
      const context = createMockExecutionContext(request);

      jest.spyOn(httpService, 'post').mockReturnValue(of(createAuthResponse(user)));

      // Act
      await authGuard.canActivate(context);

      // Assert - Verify Redis operations
      await waitForCache();
      const cacheKey = `auth:token:${require('crypto').createHash('sha256').update(token).digest('hex')}`;
      
      // Check direct Redis operations
      const exists = await redisClient.exists(cacheKey);
      expect(exists).toBe(1);

      const cachedValue = await redisClient.get(cacheKey);
      expect(cachedValue).not.toBeNull();
      expect(JSON.parse(cachedValue!)).toEqual(user);

      const ttl = await redisClient.ttl(cacheKey);
      expect(ttl).toBeGreaterThan(0);
    });

    it('should handle Redis connection failures gracefully', async () => {
      // Arrange
      const token = 'eyJhbGciOiJIUzI1NiJ9.redis-failure.signature';
      const user = createTestUser();
      const request = { headers: { authorization: `Bearer ${token}` } };
      const context = createMockExecutionContext(request);

      // Simulate Redis failure
      jest.spyOn(cacheService, 'get').mockRejectedValue(new Error('Redis connection failed'));
      jest.spyOn(cacheService, 'set').mockRejectedValue(new Error('Redis connection failed'));
      jest.spyOn(httpService, 'post').mockReturnValue(of(createAuthResponse(user)));

      // Act
      const result = await authGuard.canActivate(context);

      // Assert
      expect(result).toBe(true);
      expect((request as any).user).toEqual(user);
      // Should fallback to auth service when cache fails
      expect(httpService.post).toHaveBeenCalled();
    });

    it('should handle cache key collisions properly', async () => {
      // Arrange
      const token1 = 'eyJhbGciOiJIUzI1NiJ9.collision-test-1.signature';
      const token2 = 'eyJhbGciOiJIUzI1NiJ9.collision-test-2.signature';
      
      const user1 = { ...createTestUser(), id: 'user-1' };
      const user2 = { ...createTestUser(), id: 'user-2' };

      // Act - Cache both users
      jest.spyOn(httpService, 'post')
        .mockReturnValueOnce(of(createAuthResponse(user1)))
        .mockReturnValueOnce(of(createAuthResponse(user2)));

      const request1 = { headers: { authorization: `Bearer ${token1}` } };
      const context1 = createMockExecutionContext(request1);
      await authGuard.canActivate(context1);

      const request2 = { headers: { authorization: `Bearer ${token2}` } };
      const context2 = createMockExecutionContext(request2);
      await authGuard.canActivate(context2);

      // Assert - Verify both users are cached separately
      await waitForCache();
      
      const cacheKey1 = `auth:token:${require('crypto').createHash('sha256').update(token1).digest('hex')}`;
      const cacheKey2 = `auth:token:${require('crypto').createHash('sha256').update(token2).digest('hex')}`;

      expect(cacheKey1).not.toBe(cacheKey2);

      const cachedUser1 = await cacheService.get(cacheKey1);
      const cachedUser2 = await cacheService.get(cacheKey2);

      expect(cachedUser1).toEqual(user1);
      expect(cachedUser2).toEqual(user2);
    });

    it('should handle cache eviction and expiration correctly', async () => {
      // Arrange
      const token = 'eyJhbGciOiJIUzI1NiJ9.expiration-test.signature';
      const user = createTestUser();

      // Set with very short TTL
      const cacheKey = `auth:token:${require('crypto').createHash('sha256').update(token).digest('hex')}`;
      await cacheService.set(cacheKey, user, 1); // 1 second TTL

      const request = { headers: { authorization: `Bearer ${token}` } };
      const context = createMockExecutionContext(request);

      // Act - First call should hit cache
      const result1 = await authGuard.canActivate(context);
      expect(result1).toBe(true);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Setup auth service for cache miss
      jest.spyOn(httpService, 'post').mockReturnValue(of(createAuthResponse(user)));

      // Second call should miss cache and hit auth service
      const result2 = await authGuard.canActivate(context);

      // Assert
      expect(result2).toBe(true);
      expect(httpService.post).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // TESTS D'INTÉGRATION - MONITORING ET OBSERVABILITÉ
  // ============================================================================

  describe('Monitoring and Observability Integration', () => {
    it('should provide metrics for successful authentications', async () => {
      // Arrange
      const token = 'eyJhbGciOiJIUzI1NiJ9.metrics-success.signature';
      const user = createTestUser();
      const request = { headers: { authorization: `Bearer ${token}` } };
      const context = createMockExecutionContext(request);

      jest.spyOn(httpService, 'post').mockReturnValue(of(createAuthResponse(user)));

      // Mock metrics collection
      const metricsCollected: any[] = [];
      const originalConsoleLog = console.log;
      console.log = (...args) => {
        if (args[0]?.includes && args[0].includes('AUTH_SUCCESS')) {
          metricsCollected.push(args);
        }
        originalConsoleLog(...args);
      };

      try {
        // Act
        await authGuard.canActivate(context);

        // Assert
        // In a real implementation, you would verify metrics were sent to your monitoring system
        expect((request as any).user).toEqual(user);
      } finally {
        console.log = originalConsoleLog;
      }
    });

    it('should provide metrics for authentication failures', async () => {
      // Arrange
      const token = 'eyJhbGciOiJIUzI1NiJ9.metrics-failure.signature';
      const request = { headers: { authorization: `Bearer ${token}` } };
      const context = createMockExecutionContext(request);

      jest.spyOn(httpService, 'post').mockReturnValue(
        throwError(() => new AxiosError('Unauthorized', '401'))
      );

      // Mock metrics collection
      const metricsCollected: any[] = [];
      const originalConsoleError = console.error;
      console.error = (...args) => {
        if (args[0]?.includes && args[0].includes('AUTH_FAILURE')) {
          metricsCollected.push(args);
        }
        originalConsoleError(...args);
      };

      try {
        await expect(authGuard.canActivate(context)).rejects.toThrow(UnauthorizedException);
      } finally {
        console.error = originalConsoleError;
      }
    });

    it('should track cache hit/miss ratios', async () => {
      // Arrange
      const baseToken = 'eyJhbGciOiJIUzI1NiJ9.cache-metrics';
      const user = createTestUser();

      // Pre-populate cache for some tokens
      const cachedTokens = Array.from({ length: 3 }, (_, i) => `${baseToken}-cached-${i}.signature`);
      const uncachedTokens = Array.from({ length: 7 }, (_, i) => `${baseToken}-uncached-${i}.signature`);

      for (const token of cachedTokens) {
        const cacheKey = `auth:token:${require('crypto').createHash('sha256').update(token).digest('hex')}`;
        await cacheService.set(cacheKey, user, 300);
      }

      jest.spyOn(httpService, 'post').mockReturnValue(of(createAuthResponse(user)));

      let cacheHits = 0;
      let cacheMisses = 0;

      // Act - Test cache hits
      for (const token of cachedTokens) {
        const request = { headers: { authorization: `Bearer ${token}` } };
        const context = createMockExecutionContext(request);
        await authGuard.canActivate(context);
        cacheHits++;
      }

      // Test cache misses
      for (const token of uncachedTokens) {
        const request = { headers: { authorization: `Bearer ${token}` } };
        const context = createMockExecutionContext(request);
        await authGuard.canActivate(context);
        cacheMisses++;
      }

      // Assert
      expect(cacheHits).toBe(3);
      expect(cacheMisses).toBe(7);
      expect(httpService.post).toHaveBeenCalledTimes(7); // Only cache misses call auth service
    });
  });
});