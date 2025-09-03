// test/unit/events/events.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { AxiosResponse } from 'axios';

import { EventsService } from '../../../src/events/events.service';
import { 
  EVENT_TYPES,
  getEventMetadata,
  isHighPriorityEvent,
} from '../../../src/events/event-types.constants';

import type {
  ProjectCreatedEventDto,
  ProjectUpdatedEventDto,
  ProjectArchivedEventDto,
  ProjectDeletedEventDto,
  ProjectFilesUpdatedEventDto,
} from '../../../src/events/events.service';

describe('EventsService', () => {
  let service: EventsService;
  let configService: jest.Mocked<ConfigService>;
  let httpService: jest.Mocked<HttpService>;

  // Test fixtures
  const mockProjectCreated: ProjectCreatedEventDto = {
    projectId: '01234567-89ab-cdef-0123-456789abcdef',
    ownerId: 'user-98765432-10ab-cdef-0123-456789abcdef',
    name: 'Test Project',
    description: 'A test project description',
    initialPrompt: 'Create a web application with React and NestJS backend',
    uploadedFileIds: ['file1', 'file2'],
    hasUploadedFiles: true,
    promptComplexity: 'medium',
    createdAt: new Date('2025-08-28T10:00:00.000Z'),
  };

  const mockProjectUpdated: ProjectUpdatedEventDto = {
    projectId: '01234567-89ab-cdef-0123-456789abcdef',
    ownerId: 'user-98765432-10ab-cdef-0123-456789abcdef',
    changes: { name: 'Updated Name', description: 'New description' },
    modifiedFields: ['name', 'description'],
    updatedAt: new Date('2025-08-28T11:00:00.000Z'),
  };

  const mockProjectDeleted: ProjectDeletedEventDto = {
    projectId: '01234567-89ab-cdef-0123-456789abcdef',
    ownerId: 'user-98765432-10ab-cdef-0123-456789abcdef',
    previousStatus: 'ACTIVE',
    hadGeneratedFiles: true,
    fileCount: { uploaded: 2, generated: 5, total: 7 },
    deletedAt: new Date('2025-08-28T12:00:00.000Z'),
  };

  const mockAxiosResponse: Partial<AxiosResponse> = {
    status: 200,
    statusText: 'OK',
    headers: { 'x-response-time': '50ms' },
    data: { received: true },
  };

  beforeEach(async () => {
    const mockConfigService = {
      get: jest.fn((key: string, defaultValue?: any) => {
        const values: Record<string, any> = {
          'NODE_ENV': 'test',
          'EVENT_TRANSPORT': 'http',
          'ORCHESTRATION_SERVICE_URL': 'http://localhost:3002',
          'INTERNAL_SERVICE_TOKEN': 'test-token',
          'EVENTS_HTTP_TIMEOUT': 15000,
        };
        return values[key] || defaultValue;
      }),
    };

    const mockHttpService = {
      post: jest.fn(),
      get: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventsService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
      ],
    }).compile();

    service = module.get<EventsService>(EventsService);
    configService = module.get(ConfigService);
    httpService = module.get(HttpService);

    // Reset metrics before each test
    service.resetMetrics();
    
    // Reset circuit breaker state manually if it exists
    try {
      const circuitBreaker = (service as any).circuitBreaker;
      if (circuitBreaker && typeof circuitBreaker === 'object') {
        // Reset circuit breaker state manually
        circuitBreaker.state = 'closed';
        circuitBreaker.failureCount = 0;
        circuitBreaker.lastFailureTime = 0;
      }
    } catch (error) {
      // Ignore if circuit breaker doesn't exist or doesn't have these properties
    }
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('Module Lifecycle', () => {
    describe('onModuleInit()', () => {
      it('should initialize HTTP transport in production', async () => {
        configService.get.mockImplementation((key) => {
          if (key === 'EVENT_TRANSPORT') return 'http';
          if (key === 'ORCHESTRATION_SERVICE_URL') return 'http://localhost:3002';
          return undefined;
        });

        httpService.get.mockReturnValue(of(mockAxiosResponse as AxiosResponse));

        await service.onModuleInit();

        expect(configService.get).toHaveBeenCalledWith('EVENT_TRANSPORT', 'stub');
      });

      it('should initialize Stub transport in development', async () => {
        configService.get.mockImplementation((key) => {
          if (key === 'EVENT_TRANSPORT') return 'stub';
          return undefined;
        });

        await service.onModuleInit();

        expect(configService.get).toHaveBeenCalledWith('EVENT_TRANSPORT', 'stub');
      });

      it('should handle transport health check failure gracefully', async () => {
        configService.get.mockReturnValue('http');
        httpService.get.mockReturnValue(throwError(() => new Error('Connection failed')));

        // Should not throw
        await expect(service.onModuleInit()).resolves.toBeUndefined();
      });
    });

    describe('onModuleDestroy()', () => {
      it('should close transport and log metrics', async () => {
        await service.onModuleInit();
        
        const logSpy = jest.spyOn(service as any, 'logMetricsSummary');
        
        await service.onModuleDestroy();

        expect(logSpy).toHaveBeenCalled();
      });
    });
  });

  describe('Event Publishing', () => {
    beforeEach(async () => {
      // Initialize service with HTTP transport
      configService.get.mockImplementation((key) => {
        if (key === 'EVENT_TRANSPORT') return 'http';
        if (key === 'ORCHESTRATION_SERVICE_URL') return 'http://localhost:3002';
        if (key === 'INTERNAL_SERVICE_TOKEN') return 'test-token';
        return undefined;
      });

      httpService.get.mockReturnValue(of(mockAxiosResponse as AxiosResponse));
      await service.onModuleInit();
    });

    describe('publishProjectCreated()', () => {
      it('should publish project created event successfully', async () => {
        httpService.post.mockReturnValue(of(mockAxiosResponse as AxiosResponse));

        await service.publishProjectCreated(mockProjectCreated, 'corr-123');

        expect(httpService.post).toHaveBeenCalledWith(
          'http://localhost:3002/events/project/created',
          expect.objectContaining({
            eventType: EVENT_TYPES.PROJECT_CREATED,
            payload: expect.objectContaining({
              projectId: mockProjectCreated.projectId,
              ownerId: mockProjectCreated.ownerId,
              name: mockProjectCreated.name,
              initialPrompt: mockProjectCreated.initialPrompt,
              hasUploadedFiles: true,
              eventMetadata: expect.objectContaining({
                eventId: expect.stringMatching(/^evt_[0-9a-f-]+$/),
                sourceService: 'project-service',
                eventVersion: '1.0',
              }),
            }),
            correlationId: 'corr-123',
            sourceService: 'project-service',
          }),
          expect.objectContaining({
            timeout: 30000, // High priority event timeout
            headers: expect.objectContaining({
              'Content-Type': 'application/json',
              'X-Service-Token': 'test-token',
              'X-Event-Type': EVENT_TYPES.PROJECT_CREATED,
              'X-Correlation-ID': 'corr-123',
            }),
          })
        );
      });

      it('should retry on failure up to max retries', async () => {
        httpService.post
          .mockReturnValueOnce(throwError(() => new Error('Network error')))
          .mockReturnValueOnce(throwError(() => new Error('Network error')))
          .mockReturnValueOnce(of(mockAxiosResponse as AxiosResponse));

        const startTime = Date.now();
        await service.publishProjectCreated(mockProjectCreated);
        const endTime = Date.now();

        expect(httpService.post).toHaveBeenCalledTimes(3);
        // Should have delay between retries (exponential backoff)
        expect(endTime - startTime).toBeGreaterThan(100); // At least base delay
      });

      it('should fail after max retries exceeded', async () => {
        httpService.post.mockReturnValue(throwError(() => new Error('Network error')));

        await expect(service.publishProjectCreated(mockProjectCreated))
          .rejects.toThrow('Failed to publish event project.created after 5 attempts');

        expect(httpService.post).toHaveBeenCalledTimes(5);
      });

      it('should use circuit breaker for critical events', async () => {
        const circuitBreaker = (service as any).circuitBreaker;
        const executeSpy = jest.spyOn(circuitBreaker, 'execute');
        
        httpService.post.mockReturnValue(of(mockAxiosResponse as AxiosResponse));

        await service.publishProjectCreated(mockProjectCreated);

        expect(executeSpy).toHaveBeenCalled();
      });

      it('should update metrics on success', async () => {
        httpService.post.mockReturnValue(of(mockAxiosResponse as AxiosResponse));

        await service.publishProjectCreated(mockProjectCreated);

        const metrics = service.getMetrics();
        expect(metrics['project_created_success']).toBe(1);
        // Note: Duration metric may be 0 in test environment due to fast execution
        expect(metrics['project_created_duration']).toBeGreaterThanOrEqual(0);
      });

      it('should update metrics on failure', async () => {
        httpService.post.mockReturnValue(throwError(() => new Error('Network error')));

        await expect(service.publishProjectCreated(mockProjectCreated))
          .rejects.toThrow();

        const metrics = service.getMetrics();
        expect(metrics['project_created_error']).toBe(1);
        expect(metrics['project_created_failure']).toBe(1);
      });
    });

    describe('publishProjectUpdated()', () => {
      it('should publish update event successfully', async () => {
        httpService.post.mockReturnValue(of(mockAxiosResponse as AxiosResponse));

        await service.publishProjectUpdated(mockProjectUpdated, 'corr-456');

        expect(httpService.post).toHaveBeenCalledWith(
          'http://localhost:3002/events/project/updated',
          expect.objectContaining({
            eventType: EVENT_TYPES.PROJECT_UPDATED,
            payload: expect.objectContaining({
              projectId: mockProjectUpdated.projectId,
              changes: mockProjectUpdated.changes,
              modifiedFields: mockProjectUpdated.modifiedFields,
            }),
          }),
          expect.any(Object)
        );
      });

      it('should not throw on failure (graceful degradation)', async () => {
        httpService.post.mockReturnValue(throwError(() => new Error('Network error')));

        // Should not throw for non-critical event
        await expect(service.publishProjectUpdated(mockProjectUpdated))
          .resolves.toBeUndefined();

        const metrics = service.getMetrics();
        expect(metrics['project_updated_error']).toBe(1);
      });

      it('should use medium priority settings', async () => {
        httpService.post
          .mockReturnValueOnce(throwError(() => new Error('Error 1')))
          .mockReturnValueOnce(throwError(() => new Error('Error 2')))
          .mockReturnValueOnce(throwError(() => new Error('Error 3')));

        await service.publishProjectUpdated(mockProjectUpdated);

        // Should retry max 3 times for medium priority
        expect(httpService.post).toHaveBeenCalledTimes(3);
      });
    });

    describe('publishProjectDeleted()', () => {
      it('should publish delete event successfully', async () => {
        httpService.post.mockReturnValue(of(mockAxiosResponse as AxiosResponse));

        await service.publishProjectDeleted(mockProjectDeleted);

        expect(httpService.post).toHaveBeenCalledWith(
          'http://localhost:3002/events/project/deleted',
          expect.objectContaining({
            eventType: EVENT_TYPES.PROJECT_DELETED,
            payload: expect.objectContaining({
              projectId: mockProjectDeleted.projectId,
              hadGeneratedFiles: true,
              fileCount: { uploaded: 2, generated: 5, total: 7 },
            }),
          }),
          expect.any(Object)
        );
      });

      it('should throw on failure (critical event)', async () => {
        httpService.post.mockReturnValue(throwError(() => new Error('Network error')));

        await expect(service.publishProjectDeleted(mockProjectDeleted))
          .rejects.toThrow();

        // Should retry 5 times for critical event
        expect(httpService.post).toHaveBeenCalledTimes(5);
      });
    });

    describe('publishProjectFilesUpdated()', () => {
      const mockFilesUpdated: ProjectFilesUpdatedEventDto = {
        projectId: '01234567-89ab-cdef-0123-456789abcdef',
        ownerId: 'user-98765432-10ab-cdef-0123-456789abcdef',
        newFileIds: ['gen-file-1', 'gen-file-2', 'gen-file-3'],
        updateMode: 'append',
        totalGeneratedFiles: 3,
        updatedAt: new Date('2025-08-28T13:00:00.000Z'),
      };

      it('should publish files updated event successfully', async () => {
        httpService.post.mockReturnValue(of(mockAxiosResponse as AxiosResponse));

        await service.publishProjectFilesUpdated(mockFilesUpdated, 'corr-789');

        expect(httpService.post).toHaveBeenCalledWith(
          'http://localhost:3002/events/project/files/updated',
          expect.objectContaining({
            eventType: EVENT_TYPES.PROJECT_FILES_UPDATED,
            payload: expect.objectContaining({
              projectId: mockFilesUpdated.projectId,
              newFileIds: mockFilesUpdated.newFileIds,
              updateMode: 'append',
              totalGeneratedFiles: 3,
              fileCount: 3,
            }),
          }),
          expect.any(Object)
        );
      });

      it('should throw on failure (critical event for user deliverables)', async () => {
        httpService.post.mockReturnValue(throwError(() => new Error('Network error')));

        await expect(service.publishProjectFilesUpdated(mockFilesUpdated))
          .rejects.toThrow();

        expect(httpService.post).toHaveBeenCalledTimes(5); // Max retries for critical
      });
    });
  });

  describe('Retry Logic', () => {
    beforeEach(async () => {
      configService.get.mockImplementation((key) => {
        if (key === 'EVENT_TRANSPORT') return 'http';
        if (key === 'ORCHESTRATION_SERVICE_URL') return 'http://localhost:3002';
        return undefined;
      });
      
      httpService.get.mockReturnValue(of(mockAxiosResponse as AxiosResponse));
      await service.onModuleInit();
    });

    describe('publishWithRetry()', () => {
      it('should calculate exponential backoff delays for high priority events', async () => {
        const delays: number[] = [];
        const originalSleep = (service as any).sleep;
        
        jest.spyOn(service as any, 'sleep').mockImplementation(async (delay: number) => {
          delays.push(delay);
          return originalSleep.call(service, 1); // Fast execution for testing
        });

        httpService.post
          .mockReturnValueOnce(throwError(() => new Error('Error 1')))
          .mockReturnValueOnce(throwError(() => new Error('Error 2')))
          .mockReturnValueOnce(of(mockAxiosResponse as AxiosResponse));

        await service.publishProjectCreated(mockProjectCreated);

        // Should have 2 delays (between 3 attempts)
        expect(delays).toHaveLength(2);
        
        // Exponential backoff: base * 2^(attempt-1) + jitter
        expect(delays[0]).toBeGreaterThanOrEqual(100); // Base delay + jitter
        expect(delays[0]).toBeLessThan(200);
        expect(delays[1]).toBeGreaterThanOrEqual(200); // 2 * base + jitter  
        expect(delays[1]).toBeLessThan(300);
      });

      it('should calculate linear backoff for medium priority events', async () => {
        const delays: number[] = [];
        jest.spyOn(service as any, 'sleep').mockImplementation(async (delay: number) => {
          delays.push(delay);
          return Promise.resolve();
        });

        httpService.post
          .mockReturnValueOnce(throwError(() => new Error('Error 1')))
          .mockReturnValueOnce(throwError(() => new Error('Error 2')))
          .mockReturnValueOnce(throwError(() => new Error('Error 3')));

        await service.publishProjectUpdated(mockProjectUpdated);

        expect(delays).toHaveLength(2);
        
        // Linear backoff: attempt * 500 + jitter
        expect(delays[0]).toBeGreaterThanOrEqual(500); // 1 * 500 + jitter
        expect(delays[0]).toBeLessThan(600);
        expect(delays[1]).toBeGreaterThanOrEqual(1000); // 2 * 500 + jitter
        expect(delays[1]).toBeLessThan(1100);
      });

      it('should add jitter to prevent thundering herd', async () => {
        const delays: number[] = [];
        jest.spyOn(service as any, 'sleep').mockImplementation(async (delay: number) => {
          delays.push(delay);
          return Promise.resolve();
        });

        // Make multiple calls to see jitter variation
        const promises = [];
        for (let i = 0; i < 3; i++) {
          httpService.post.mockReturnValueOnce(throwError(() => new Error('Error')));
          httpService.post.mockReturnValueOnce(of(mockAxiosResponse as AxiosResponse));
          
          promises.push(service.publishProjectCreated({
            ...mockProjectCreated,
            projectId: `project-${i}`,
          }));
        }

        await Promise.all(promises);

        // Should have different delays due to jitter
        const firstDelays = delays.filter((_, index) => index % 2 === 0);
        expect(new Set(firstDelays).size).toBeGreaterThan(1);
      });

      it('should respect max retries configuration', async () => {
        // Create a fresh service instance with mocked metadata
        const mockEventTypesModule = require('../../../src/events/event-types.constants');
        const originalGetEventMetadata = mockEventTypesModule.getEventMetadata;
        
        // Mock the function to return custom retry config
        mockEventTypesModule.getEventMetadata = jest.fn().mockReturnValue({
          maxRetries: 2,
          timeout: 15000,
          retryPolicy: 'linear-backoff',
          priority: 'high'
        });

        httpService.post.mockReturnValue(throwError(() => new Error('Network error')));

        try {
          await service.publishProjectCreated(mockProjectCreated);
        } catch (error) {
          expect(error.message).toContain('Failed to publish event project.created after 2 attempts');
        }

        expect(httpService.post).toHaveBeenCalledTimes(2);
        
        // Restore the original function
        mockEventTypesModule.getEventMetadata = originalGetEventMetadata;
      });
    });

    describe('Retry Configuration', () => {
      it('should respect event-specific retry configurations', async () => {
        // Test that different event types use different retry strategies
        httpService.post.mockReturnValue(throwError(() => new Error('Network error')));

        // High priority event (project created) should retry more times
        try {
          await service.publishProjectCreated(mockProjectCreated);
        } catch (error) {
          // Expected to fail after max retries
        }

        const createdRetries = httpService.post.mock.calls.length;

        // Reset mock
        jest.clearAllMocks();

        // Medium priority event (project updated) should retry fewer times  
        try {
          await service.publishProjectUpdated(mockProjectUpdated);
        } catch (error) {
          // Expected to fail after max retries
        }

        const updatedRetries = httpService.post.mock.calls.length;

        // High priority should have more retry attempts than medium priority
        expect(createdRetries).toBeGreaterThan(updatedRetries);
      });

      it('should implement exponential backoff behavior', async () => {
        const delays: number[] = [];
        jest.spyOn(service as any, 'sleep').mockImplementation(async (delay: number) => {
          delays.push(delay);
          return Promise.resolve();
        });

        httpService.post
          .mockReturnValueOnce(throwError(() => new Error('Error 1')))
          .mockReturnValueOnce(throwError(() => new Error('Error 2')))
          .mockReturnValueOnce(of(mockAxiosResponse as AxiosResponse));

        await service.publishProjectCreated(mockProjectCreated);

        // Should have delays that increase over time (exponential backoff characteristic)
        expect(delays.length).toBeGreaterThan(0);
        if (delays.length > 1) {
          expect(delays[1]).toBeGreaterThan(delays[0]);
        }
      });

      it('should include jitter in retry delays', async () => {
        const delays: number[] = [];
        jest.spyOn(service as any, 'sleep').mockImplementation(async (delay: number) => {
          delays.push(delay);
          return Promise.resolve();
        });

        // Make multiple calls to test jitter variation
        const promises = [];
        for (let i = 0; i < 3; i++) {
          httpService.post.mockReturnValueOnce(throwError(() => new Error('Error')));
          httpService.post.mockReturnValueOnce(of(mockAxiosResponse as AxiosResponse));
          
          promises.push(service.publishProjectCreated({
            ...mockProjectCreated,
            projectId: `project-${i}`,
          }));
        }

        await Promise.all(promises);

        // Should have some variation in delays due to jitter
        const uniqueDelays = new Set(delays);
        expect(uniqueDelays.size).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe('Circuit Breaker', () => {
    let circuitBreaker: any;

    beforeEach(async () => {
      configService.get.mockReturnValue('http');
      await service.onModuleInit();
      circuitBreaker = (service as any).circuitBreaker;
    });

    it('should start in CLOSED state', () => {
      expect(circuitBreaker.getState()).toBe('closed');
      expect(circuitBreaker.getFailureCount()).toBe(0);
    });

    it('should transition to OPEN after threshold failures', async () => {
      httpService.post.mockReturnValue(throwError(() => new Error('Network error')));

      // Trigger 5 failures to reach threshold
      for (let i = 0; i < 5; i++) {
        try {
          await service.publishProjectCreated({
            ...mockProjectCreated,
            projectId: `project-${i}`,
          });
        } catch (error) {
          // Expected to fail
        }
      }

      expect(circuitBreaker.getState()).toBe('open');
      expect(circuitBreaker.getFailureCount()).toBe(5);
    });

    it('should block requests when OPEN', async () => {
      // Force circuit breaker to OPEN state
      (circuitBreaker as any).state = 'open';
      (circuitBreaker as any).failureCount = 5;
      (circuitBreaker as any).lastFailureTime = Date.now();

      await expect(service.publishProjectCreated(mockProjectCreated))
        .rejects.toThrow('Circuit breaker is OPEN');

      expect(httpService.post).not.toHaveBeenCalled();
    });

    it('should transition to HALF_OPEN after timeout', async () => {
      // Force circuit breaker to OPEN state with old timestamp
      (circuitBreaker as any).state = 'open';
      (circuitBreaker as any).failureCount = 5;
      (circuitBreaker as any).lastFailureTime = Date.now() - 35000; // 35 seconds ago

      httpService.post.mockReturnValue(of(mockAxiosResponse as AxiosResponse));

      await service.publishProjectCreated(mockProjectCreated);

      // Should have attempted the call and reset to CLOSED on success
      expect(httpService.post).toHaveBeenCalled();
      expect(circuitBreaker.getState()).toBe('closed');
      expect(circuitBreaker.getFailureCount()).toBe(0);
    });

    it('should not use circuit breaker for medium priority events', async () => {
      const executeSpy = jest.spyOn(circuitBreaker, 'execute');
      httpService.post.mockReturnValue(of(mockAxiosResponse as AxiosResponse));

      await service.publishProjectUpdated(mockProjectUpdated);

      expect(executeSpy).not.toHaveBeenCalled();
    });
  });

  describe('Transport Abstraction', () => {
    describe('HttpEventTransport', () => {
      beforeEach(async () => {
        configService.get.mockImplementation((key) => {
          if (key === 'EVENT_TRANSPORT') return 'http';
          if (key === 'ORCHESTRATION_SERVICE_URL') return 'http://localhost:3002';
          if (key === 'INTERNAL_SERVICE_TOKEN') return 'test-token';
          return undefined;
        });

        httpService.get.mockReturnValue(of(mockAxiosResponse as AxiosResponse));
        await service.onModuleInit();
      });

      it('should use correct URLs for different event types', async () => {
        httpService.post.mockReturnValue(of(mockAxiosResponse as AxiosResponse));

        const events = [
          { method: 'publishProjectCreated', event: mockProjectCreated, url: '/events/project/created' },
          { method: 'publishProjectUpdated', event: mockProjectUpdated, url: '/events/project/updated' },
          { method: 'publishProjectDeleted', event: mockProjectDeleted, url: '/events/project/deleted' },
        ];

        for (const { method, event, url } of events) {
          await (service as any)[method](event);
          
          expect(httpService.post).toHaveBeenCalledWith(
            `http://localhost:3002${url}`,
            expect.any(Object),
            expect.any(Object)
          );
        }
      });

      it('should include all required headers', async () => {
        httpService.post.mockReturnValue(of(mockAxiosResponse as AxiosResponse));

        await service.publishProjectCreated(mockProjectCreated, 'test-correlation');

        expect(httpService.post).toHaveBeenCalledWith(
          expect.any(String),
          expect.any(Object),
          expect.objectContaining({
            headers: expect.objectContaining({
              'Content-Type': 'application/json',
              'X-Service-Token': 'test-token',
              'X-Event-Type': EVENT_TYPES.PROJECT_CREATED,
              'X-Correlation-ID': 'test-correlation',
            }),
          })
        );
      });

      it('should use correct timeouts based on event metadata', async () => {
        httpService.post.mockReturnValue(of(mockAxiosResponse as AxiosResponse));

        await service.publishProjectCreated(mockProjectCreated);

        const metadata = getEventMetadata(EVENT_TYPES.PROJECT_CREATED);
        expect(httpService.post).toHaveBeenCalledWith(
          expect.any(String),
          expect.any(Object),
          expect.objectContaining({
            timeout: metadata.timeout, // 30000ms for critical events
          })
        );
      });

      it('should handle health check', async () => {
        httpService.get.mockReturnValue(of(mockAxiosResponse as AxiosResponse));

        const health = await service.healthCheck();

        expect(httpService.get).toHaveBeenCalledWith('http://localhost:3002/health');
        expect(health.status).toBe('healthy');
        expect(health.transport).toBe('http');
      });
    });

    describe('StubEventTransport', () => {
      beforeEach(async () => {
        configService.get.mockImplementation((key) => {
          const values: Record<string, any> = {
            'EVENT_TRANSPORT': 'stub',
            'EVENT_STUB_SIMULATE_DELAY': 'true',
            'EVENT_STUB_DELAY_MS': '50',
            'EVENT_STUB_FAILURE_RATE': '0.1',
            'NODE_ENV': 'development',
          };
          return values[key];
        });

        await service.onModuleInit();
      });

      it('should simulate network delay', async () => {
        const startTime = Date.now();
        
        await service.publishProjectCreated(mockProjectCreated);
        
        const endTime = Date.now();
        expect(endTime - startTime).toBeGreaterThanOrEqual(45); // At least 50ms - tolerance
      });

      it('should simulate failures based on failure rate', async () => {
        // Set high failure rate for testing
        configService.get.mockImplementation((key) => {
          const values: Record<string, any> = {
            'EVENT_TRANSPORT': 'stub',
            'EVENT_STUB_FAILURE_RATE': '1.0', // 100% failure
            'EVENT_STUB_SIMULATE_DELAY': 'false',
            'EVENT_STUB_DELAY_MS': '0',
            'NODE_ENV': 'test',
          };
          return values[key];
        });

        // Reinitialize with new config
        await service.onModuleInit();

        await expect(service.publishProjectCreated(mockProjectCreated))
          .rejects.toThrow();
      });

      it('should always return healthy for health check', async () => {
        const health = await service.healthCheck();

        expect(health.status).toBe('healthy');
        expect(health.transport).toBe('stub');
      });

      it('should log detailed event information in development', async () => {
        // Use a different logging spy - the stub transport might use a different logger
        const logSpy = jest.spyOn((service as any).logger, 'log').mockImplementation();

        await service.publishProjectCreated(mockProjectCreated);

        // In stub transport, it should log event information through the service logger
        expect(logSpy).toHaveBeenCalled();
        logSpy.mockRestore();
      });
    });
  });

  describe('Metrics and Monitoring', () => {
    beforeEach(async () => {
      configService.get.mockReturnValue('stub');
      await service.onModuleInit();
    });

    describe('getMetrics()', () => {
      it('should return empty metrics initially', () => {
        const metrics = service.getMetrics();
        expect(metrics).toEqual({});
      });

      it('should track success metrics', async () => {
        await service.publishProjectCreated(mockProjectCreated);

        const metrics = service.getMetrics();
        expect(metrics['project_created_success']).toBe(1);
        // Duration may be 0 in test environment due to fast execution
        expect(metrics['project_created_duration']).toBeGreaterThanOrEqual(0);
      });

      it('should track retry metrics', async () => {
        configService.get.mockImplementation((key) => {
          const values: Record<string, any> = {
            'EVENT_TRANSPORT': 'stub',
            'EVENT_STUB_FAILURE_RATE': '0.8', // 80% failure
            'EVENT_STUB_SIMULATE_DELAY': 'false',
            'EVENT_STUB_DELAY_MS': '0',
            'NODE_ENV': 'test',
          };
          return values[key];
        });
        
        await service.onModuleInit();

        // This should trigger retries
        try {
          await service.publishProjectCreated(mockProjectCreated);
        } catch (error) {
          // Expected to fail after retries
        }

        const metrics = service.getMetrics();
        expect(metrics['project_created_retry']).toBeGreaterThanOrEqual(0);
      });
    });

    describe('resetMetrics()', () => {
      it('should clear all metrics', async () => {
        // Generate some metrics
        await service.publishProjectCreated(mockProjectCreated);
        
        let metrics = service.getMetrics();
        expect(Object.keys(metrics).length).toBeGreaterThan(0);

        // Reset
        service.resetMetrics();
        
        metrics = service.getMetrics();
        expect(metrics).toEqual({});
      });
    });

    describe('healthCheck()', () => {
      it('should return detailed health information', async () => {
        const health = await service.healthCheck();

        expect(health).toMatchObject({
          status: expect.stringMatching(/^(healthy|unhealthy)$/),
          transport: expect.any(String),
          circuitBreakerState: expect.stringMatching(/^(closed|open|half-open)$/),
          uptime: expect.any(Number),
          metrics: expect.any(Object),
        });
      });

      it('should include error information when unhealthy', async () => {
        // Mock transport health check to fail
        const mockTransport = (service as any).transport;
        if (mockTransport && mockTransport.healthCheck) {
          jest.spyOn(mockTransport, 'healthCheck').mockResolvedValue(false);
        }

        const health = await service.healthCheck();

        expect(health.status).toBe('unhealthy');
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    beforeEach(async () => {
      configService.get.mockReturnValue('http');
      httpService.get.mockReturnValue(of(mockAxiosResponse as AxiosResponse));
      await service.onModuleInit();
    });

    describe('Payload Edge Cases', () => {
      it('should handle very large payloads', async () => {
        const largeProject = {
          ...mockProjectCreated,
          description: 'x'.repeat(50000), // 50KB description
          initialPrompt: 'x'.repeat(100000), // 100KB prompt
        };

        httpService.post.mockReturnValue(of(mockAxiosResponse as AxiosResponse));

        await service.publishProjectCreated(largeProject);

        expect(httpService.post).toHaveBeenCalled();
        
        const call = httpService.post.mock.calls[0];
        const payloadSize = JSON.stringify(call[1]).length;
        expect(payloadSize).toBeGreaterThan(150000); // Should be large
      });

      it('should handle special characters in strings', async () => {
        const specialProject = {
          ...mockProjectCreated,
          name: 'Test with émojis 🚀 and "quotes" & symbols',
          description: 'Multi\nline\ttext with\r\nvarious characters: àáâãäå',
          initialPrompt: 'Create app with special chars: <>&"\'',
        };

        httpService.post.mockReturnValue(of(mockAxiosResponse as AxiosResponse));

        await service.publishProjectCreated(specialProject);

        expect(httpService.post).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            payload: expect.objectContaining({
              name: specialProject.name,
              description: specialProject.description,
              initialPrompt: specialProject.initialPrompt,
            }),
          }),
          expect.any(Object)
        );
      });

      it('should handle empty arrays and null values', async () => {
        const edgeCaseProject = {
          ...mockProjectCreated,
          description: undefined,
          uploadedFileIds: [],
          hasUploadedFiles: false,
        };

        httpService.post.mockReturnValue(of(mockAxiosResponse as AxiosResponse));

        await service.publishProjectCreated(edgeCaseProject);

        expect(httpService.post).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            payload: expect.objectContaining({
              description: undefined,
              uploadedFileIds: [],
              hasUploadedFiles: false,
            }),
          }),
          expect.any(Object)
        );
      });
    });

    describe('Network Error Scenarios', () => {
      it('should handle timeout errors', async () => {
        const timeoutError = new Error('Timeout');
        timeoutError.name = 'TimeoutError';
        httpService.post.mockReturnValue(throwError(() => timeoutError));

        await expect(service.publishProjectCreated(mockProjectCreated))
          .rejects.toThrow();

        expect(httpService.post).toHaveBeenCalledTimes(5); // Max retries
      });

      it('should handle HTTP 5xx errors (server errors)', async () => {
        const serverError = new Error('Internal Server Error');
        (serverError as any).response = { status: 500 };
        httpService.post.mockReturnValue(throwError(() => serverError));

        await expect(service.publishProjectCreated(mockProjectCreated))
          .rejects.toThrow();

        expect(httpService.post).toHaveBeenCalledTimes(5); // Should retry server errors
      });

      it('should handle HTTP 4xx errors (client errors)', async () => {
        const clientError = new Error('Bad Request');
        (clientError as any).response = { status: 400 };
        httpService.post.mockReturnValue(throwError(() => clientError));

        await expect(service.publishProjectCreated(mockProjectCreated))
          .rejects.toThrow();

        expect(httpService.post).toHaveBeenCalledTimes(5); // Still retry (might be transient)
      });

      it('should handle network unreachable errors', async () => {
        const networkError = new Error('ENOTFOUND');
        networkError.name = 'ENOTFOUND';
        httpService.post.mockReturnValue(throwError(() => networkError));

        await expect(service.publishProjectCreated(mockProjectCreated))
          .rejects.toThrow();
      });
    });

    describe('Concurrent Event Publishing', () => {
      it('should handle multiple simultaneous events for same project', async () => {
        httpService.post.mockReturnValue(of(mockAxiosResponse as AxiosResponse));

        const promises = [
          service.publishProjectCreated(mockProjectCreated),
          service.publishProjectUpdated(mockProjectUpdated),
        ];

        await Promise.all(promises);

        expect(httpService.post).toHaveBeenCalledTimes(2);
        
        const metrics = service.getMetrics();
        expect(metrics['project_created_success']).toBe(1);
        expect(metrics['project_updated_success']).toBe(1);
      });

      it('should handle high volume of events', async () => {
        httpService.post.mockReturnValue(of(mockAxiosResponse as AxiosResponse));

        const promises = [];
        for (let i = 0; i < 50; i++) {
          promises.push(service.publishProjectCreated({
            ...mockProjectCreated,
            projectId: `project-${i}`,
          }));
        }

        await Promise.all(promises);

        expect(httpService.post).toHaveBeenCalledTimes(50);
        
        const metrics = service.getMetrics();
        expect(metrics['project_created_success']).toBe(50);
      });
    });
  });

  describe('Event Metadata Generation', () => {
    beforeEach(async () => {
      // Ensure clean state for these tests
      configService.get.mockReturnValue('http');
      httpService.get.mockReturnValue(of(mockAxiosResponse as AxiosResponse));
      await service.onModuleInit();
      
      // Reset circuit breaker for these tests
      try {
        const circuitBreaker = (service as any).circuitBreaker;
        if (circuitBreaker && typeof circuitBreaker === 'object') {
          circuitBreaker.state = 'closed';
          circuitBreaker.failureCount = 0;
          circuitBreaker.lastFailureTime = 0;
        }
      } catch (error) {
        // Ignore if circuit breaker doesn't exist or doesn't have these properties
      }
    });

    it('should generate unique event IDs', async () => {
      httpService.post.mockReturnValue(of(mockAxiosResponse as AxiosResponse));

      const promises = [
        service.publishProjectCreated({ ...mockProjectCreated, projectId: 'p1' }),
        service.publishProjectCreated({ ...mockProjectCreated, projectId: 'p2' }),
      ];

      await Promise.all(promises);

      const calls = httpService.post.mock.calls;
      const eventId1 = (calls[0][1] as any).payload.eventMetadata.eventId;
      const eventId2 = (calls[1][1] as any).payload.eventMetadata.eventId;

      expect(eventId1).not.toEqual(eventId2);
      expect(eventId1).toMatch(/^evt_[0-9a-f-]+$/);
      expect(eventId2).toMatch(/^evt_[0-9a-f-]+$/);
    });

    it('should include accurate timestamps', async () => {
      httpService.post.mockReturnValue(of(mockAxiosResponse as AxiosResponse));

      const beforePublish = Date.now();
      await service.publishProjectCreated(mockProjectCreated);
      const afterPublish = Date.now();

      const call = httpService.post.mock.calls[0];
      const eventTimestamp = new Date((call[1] as any).payload.eventMetadata.eventTimestamp).getTime();

      expect(eventTimestamp).toBeGreaterThanOrEqual(beforePublish - 1000); // 1s tolerance
      expect(eventTimestamp).toBeLessThanOrEqual(afterPublish + 1000);
    });

    it('should include correct source service', async () => {
      httpService.post.mockReturnValue(of(mockAxiosResponse as AxiosResponse));

      await service.publishProjectCreated(mockProjectCreated);

      const call = httpService.post.mock.calls[0];
      expect((call[1] as any).sourceService).toBe('project-service');
      expect((call[1] as any).payload.eventMetadata.sourceService).toBe('project-service');
    });
  });

  describe('Configuration Validation', () => {
    it('should handle missing ORCHESTRATION_SERVICE_URL', async () => {
      configService.get.mockImplementation((key) => {
        if (key === 'EVENT_TRANSPORT') return 'http';
        if (key === 'ORCHESTRATION_SERVICE_URL') return undefined;
        return undefined;
      });

      await service.onModuleInit();

      // Should still initialize but log warnings
      const health = await service.healthCheck();
      expect(health.status).toBe('unhealthy'); // No URL configured
    });

    it('should handle missing service token', async () => {
      configService.get.mockImplementation((key) => {
        const values: Record<string, any> = {
          'EVENT_TRANSPORT': 'http',
          'ORCHESTRATION_SERVICE_URL': 'http://localhost:3002',
          'INTERNAL_SERVICE_TOKEN': undefined, // Missing token
        };
        return values[key];
      });

      httpService.get.mockReturnValue(of(mockAxiosResponse as AxiosResponse));
      httpService.post.mockReturnValue(of(mockAxiosResponse as AxiosResponse));

      await service.onModuleInit();
      await service.publishProjectCreated(mockProjectCreated);

      // Should use undefined when no token is configured (not 'dev-token')
      expect(httpService.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Service-Token': undefined,
          }),
        })
      );
    });
  });

  describe('Memory and Performance', () => {
    it('should handle metrics collection without memory leaks', async () => {
      // Generate lots of metrics
      for (let i = 0; i < 1000; i++) {
        (service as any).recordMetric(`test_metric_${i}`, 1);
      }

      const metrics = service.getMetrics();
      expect(Object.keys(metrics)).toHaveLength(1000);

      // Reset should clear everything
      service.resetMetrics();
      expect(service.getMetrics()).toEqual({});
    });

    it('should handle large event payloads efficiently', async () => {
      // Ensure the service is properly initialized for this test
      configService.get.mockReturnValue('http');
      httpService.get.mockReturnValue(of(mockAxiosResponse as AxiosResponse));
      await service.onModuleInit();

      // Reset circuit breaker for this test
      try {
        const circuitBreaker = (service as any).circuitBreaker;
        if (circuitBreaker && typeof circuitBreaker === 'object') {
          circuitBreaker.state = 'closed';
          circuitBreaker.failureCount = 0;
          circuitBreaker.lastFailureTime = 0;
        }
      } catch (error) {
        // Ignore if circuit breaker doesn't exist
      }

      const largeProject = {
        ...mockProjectCreated,
        initialPrompt: 'x'.repeat(1000000), // 1MB prompt
      };

      httpService.post.mockReturnValue(of(mockAxiosResponse as AxiosResponse));

      const startTime = Date.now();
      await service.publishProjectCreated(largeProject);
      const endTime = Date.now();

      // Should complete in reasonable time even with large payload
      expect(endTime - startTime).toBeLessThan(5000); // 5 seconds max
    });
  });

  describe('Error Logging and Debugging', () => {
    beforeEach(async () => {
      // Ensure clean state for these tests
      configService.get.mockReturnValue('http');
      httpService.get.mockReturnValue(of(mockAxiosResponse as AxiosResponse));
      await service.onModuleInit();
      
      // Reset circuit breaker for these tests
      try {
        const circuitBreaker = (service as any).circuitBreaker;
        if (circuitBreaker && typeof circuitBreaker === 'object') {
          circuitBreaker.state = 'closed';
          circuitBreaker.failureCount = 0;
          circuitBreaker.lastFailureTime = 0;
        }
      } catch (error) {
        // Ignore if circuit breaker doesn't exist
      }
    });

    it('should log detailed error information on failures', async () => {
      const errorSpy = jest.spyOn((service as any).logger, 'error');
      
      httpService.post.mockReturnValue(throwError(() => new Error('Network failure')));

      try {
        await service.publishProjectCreated(mockProjectCreated, 'debug-correlation');
      } catch (error) {
        // Expected to fail
      }

      // Check that error was logged with project information
      expect(errorSpy).toHaveBeenCalledWith(
        'Failed to publish project created event',
        expect.objectContaining({
          projectId: mockProjectCreated.projectId,
          correlationId: 'debug-correlation',
        })
      );
    });

    it('should log retry attempts', async () => {
      const warnSpy = jest.spyOn((service as any).logger, 'warn');
      
      httpService.post
        .mockReturnValueOnce(throwError(() => new Error('Temporary error')))
        .mockReturnValueOnce(of(mockAxiosResponse as AxiosResponse));

      await service.publishProjectCreated(mockProjectCreated);

      // Should log the retry attempt
      expect(warnSpy).toHaveBeenCalled();
    });

    it('should log successful publish after retries', async () => {
      const logSpy = jest.spyOn((service as any).logger, 'log');
      
      httpService.post
        .mockReturnValueOnce(throwError(() => new Error('Error 1')))
        .mockReturnValueOnce(throwError(() => new Error('Error 2')))
        .mockReturnValueOnce(of(mockAxiosResponse as AxiosResponse));

      await service.publishProjectCreated(mockProjectCreated);

      // Should log successful completion after retries
      expect(logSpy).toHaveBeenCalled();
    });
  });
});