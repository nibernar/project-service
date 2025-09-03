// test/integration/events.integration.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HttpModule, HttpService } from '@nestjs/axios';
import { EventsModule } from '../../src/events/events.module';
import { EventsService } from '../../src/events/events.service';
import { EVENT_TYPES } from '../../src/events/event-types.constants';
import type {
  ProjectCreatedEventDto,
  ProjectUpdatedEventDto,
  ProjectDeletedEventDto,
} from '../../src/events/events.service';

// Mock HTTP server for testing real HTTP transport
import express from 'express';
import { Server } from 'http';

describe('Events Integration Tests', () => {
  let module: TestingModule;
  let eventsService: EventsService;
  let httpService: HttpService;
  let mockServer: Server;
  let receivedEvents: any[] = [];

  // Mock orchestrator server setup
  const setupMockOrchestrator = (port: number = 3333): Promise<Server> => {
    return new Promise((resolve) => {
      const app = express();
      app.use(express.json());

      // Event endpoints
      app.post('/events/project/created', (req, res) => {
        receivedEvents.push({ type: 'created', ...req.body });
        res.json({ received: true, timestamp: new Date().toISOString() });
      });

      app.post('/events/project/updated', (req, res) => {
        receivedEvents.push({ type: 'updated', ...req.body });
        res.json({ received: true });
      });

      app.post('/events/project/deleted', (req, res) => {
        receivedEvents.push({ type: 'deleted', ...req.body });
        res.json({ received: true });
      });

      app.post('/events/project/archived', (req, res) => {
        receivedEvents.push({ type: 'archived', ...req.body });
        res.json({ received: true });
      });

      app.post('/events/project/files/updated', (req, res) => {
        receivedEvents.push({ type: 'files-updated', ...req.body });
        res.json({ received: true });
      });

      // Health check endpoint
      app.get('/health', (req, res) => {
        res.json({ status: 'healthy', timestamp: new Date().toISOString() });
      });

      // Error simulation endpoints
      app.post('/events/error/timeout', (req, res) => {
        // Never respond to simulate timeout
        setTimeout(() => res.status(500).json({ error: 'timeout' }), 10000);
      });

      app.post('/events/error/500', (req, res) => {
        res.status(500).json({ error: 'Internal server error' });
      });

      app.post('/events/error/400', (req, res) => {
        res.status(400).json({ error: 'Bad request' });
      });

      const server = app.listen(port, () => {
        console.log(`Mock orchestrator server running on port ${port}`);
        resolve(server);
      });
    });
  };

  beforeAll(async () => {
    // Start mock orchestrator server
    mockServer = await setupMockOrchestrator();

    // Test configuration for HTTP transport
    const testConfig = {
      NODE_ENV: 'test',
      EVENT_TRANSPORT: 'http',
      ORCHESTRATION_SERVICE_URL: 'http://localhost:3333',
      INTERNAL_SERVICE_TOKEN: 'integration-test-token',
      EVENTS_HTTP_TIMEOUT: '5000',
    };

    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [() => testConfig],
        }),
        EventsModule,
      ],
    }).compile();

    eventsService = module.get<EventsService>(EventsService);
    httpService = module.get<HttpService>(HttpService);

    // Initialize the service
    await eventsService.onModuleInit();

    // Wait for initial health check
    await new Promise(resolve => setTimeout(resolve, 500));
  });

  afterAll(async () => {
    await eventsService.onModuleDestroy();
    await module.close();
    
    if (mockServer) {
      await new Promise(resolve => mockServer.close(resolve));
    }
  });

  beforeEach(() => {
    // Clear received events before each test
    receivedEvents = [];
    eventsService.resetMetrics();
  });

  describe('Real HTTP Communication', () => {
    const mockProjectCreated: ProjectCreatedEventDto = {
      projectId: '01234567-89ab-cdef-0123-456789abcdef',
      ownerId: 'user-98765432-10ab-cdef-0123-456789abcdef',
      name: 'Integration Test Project',
      description: 'A project created during integration testing',
      initialPrompt: 'Create a comprehensive web application with authentication',
      uploadedFileIds: ['file-int-1', 'file-int-2'],
      hasUploadedFiles: true,
      promptComplexity: 'high',
      createdAt: new Date('2025-08-28T10:00:00.000Z'),
    };

    describe('Successful Event Publishing', () => {
      it('should send project created event to real HTTP endpoint', async () => {
        await eventsService.publishProjectCreated(mockProjectCreated, 'integration-corr-123');

        expect(receivedEvents).toHaveLength(1);
        
        const receivedEvent = receivedEvents[0];
        expect(receivedEvent.type).toBe('created');
        expect(receivedEvent.eventType).toBe(EVENT_TYPES.PROJECT_CREATED);
        expect(receivedEvent.payload).toMatchObject({
          projectId: mockProjectCreated.projectId,
          ownerId: mockProjectCreated.ownerId,
          name: mockProjectCreated.name,
          hasUploadedFiles: true,
          eventMetadata: expect.objectContaining({
            eventId: expect.stringMatching(/^evt_[0-9a-f-]+$/),
            sourceService: 'project-service',
            eventVersion: '1.0',
          }),
        });
        expect(receivedEvent.correlationId).toBe('integration-corr-123');
      });

      it('should send all event types to correct endpoints', async () => {
        const events = [
          {
            method: 'publishProjectCreated',
            data: mockProjectCreated,
            expectedType: 'created',
          },
          {
            method: 'publishProjectUpdated', 
            data: {
              projectId: mockProjectCreated.projectId,
              ownerId: mockProjectCreated.ownerId,
              changes: { name: 'Updated Name' },
              modifiedFields: ['name'],
              updatedAt: new Date(),
            },
            expectedType: 'updated',
          },
          {
            method: 'publishProjectDeleted',
            data: {
              projectId: mockProjectCreated.projectId,
              ownerId: mockProjectCreated.ownerId,
              previousStatus: 'ACTIVE',
              hadGeneratedFiles: true,
              fileCount: { uploaded: 2, generated: 3, total: 5 },
              deletedAt: new Date(),
            },
            expectedType: 'deleted',
          },
        ];

        for (const event of events) {
          await (eventsService as any)[event.method](event.data);
        }

        expect(receivedEvents).toHaveLength(3);
        expect(receivedEvents.map(e => e.type)).toEqual(['created', 'updated', 'deleted']);
      });

      it('should include correct authentication headers', async () => {
        let receivedHeaders: any = {};
        
        // Temporary endpoint to capture headers
        const app = express();
        app.use(express.json());
        app.post('/test/headers', (req, res) => {
          receivedHeaders = req.headers;
          res.json({ received: true });
        });
        
        const headerTestServer = app.listen(3334);

        try {
          // Temporarily change config for this test
          const configService = module.get<ConfigService>(ConfigService);
          jest.spyOn(configService, 'get').mockImplementation((key: string) => {
            if (key === 'ORCHESTRATION_SERVICE_URL') return 'http://localhost:3334';
            if (key === 'INTERNAL_SERVICE_TOKEN') return 'test-auth-token';
            return undefined;
          });

          // Reinitialize with new config
          await eventsService.onModuleInit();

          // Mock the URL generation to use our test endpoint
          const originalTransport = (eventsService as any).transport;
          originalTransport.getTargetUrl = () => 'http://localhost:3334/test/headers';

          await eventsService.publishProjectCreated(mockProjectCreated, 'header-test');

          expect(receivedHeaders['content-type']).toBe('application/json');
          expect(receivedHeaders['x-service-token']).toBe('test-auth-token');
          expect(receivedHeaders['x-event-type']).toBe(EVENT_TYPES.PROJECT_CREATED);
          expect(receivedHeaders['x-correlation-id']).toBe('header-test');

        } finally {
          headerTestServer.close();
          jest.restoreAllMocks();
          await eventsService.onModuleInit(); // Restore original config
        }
      });
    });

    describe('Error Handling in Real Network Conditions', () => {
      beforeEach(() => {
        // Clear any previous circuit breaker state
        const circuitBreaker = (eventsService as any).circuitBreaker;
        (circuitBreaker as any).state = 'closed';
        (circuitBreaker as any).failureCount = 0;
      });

      it('should handle server errors with retry', async () => {
        // Temporarily change URL to error endpoint
        const originalTransport = (eventsService as any).transport;
        const originalGetTargetUrl = originalTransport.getTargetUrl;
        
        let attemptCount = 0;
        originalTransport.getTargetUrl = () => {
          attemptCount++;
          if (attemptCount <= 2) {
            return 'http://localhost:3333/events/error/500'; // First 2 attempts fail
          }
          return 'http://localhost:3333/events/project/created'; // 3rd succeeds
        };

        try {
          await eventsService.publishProjectCreated(mockProjectCreated);

          // Should have eventually succeeded
          expect(receivedEvents).toHaveLength(1);
          expect(attemptCount).toBe(3);

          const metrics = eventsService.getMetrics();
          expect(metrics['project_created_retry']).toBeGreaterThan(0);
          expect(metrics['project_created_success']).toBe(1);

        } finally {
          originalTransport.getTargetUrl = originalGetTargetUrl;
        }
      });

      it('should fail after max retries on persistent errors', async () => {
        const originalTransport = (eventsService as any).transport;
        const originalGetTargetUrl = originalTransport.getTargetUrl;
        originalTransport.getTargetUrl = () => 'http://localhost:3333/events/error/500';

        try {
          await expect(eventsService.publishProjectCreated(mockProjectCreated))
            .rejects.toThrow('Failed to publish event project.created after 5 attempts');

          expect(receivedEvents).toHaveLength(0); // No successful events
          
          const metrics = eventsService.getMetrics();
          expect(metrics['project_created_failure']).toBe(1);

        } finally {
          originalTransport.getTargetUrl = originalGetTargetUrl;
        }
      });

      it('should handle timeout errors gracefully', async () => {
        const originalTransport = (eventsService as any).transport;
        const originalGetTargetUrl = originalTransport.getTargetUrl;
        originalTransport.getTargetUrl = () => 'http://localhost:3333/events/error/timeout';

        try {
          await expect(eventsService.publishProjectCreated(mockProjectCreated))
            .rejects.toThrow();

          const metrics = eventsService.getMetrics();
          expect(metrics['project_created_error']).toBeGreaterThan(0);

        } finally {
          originalTransport.getTargetUrl = originalGetTargetUrl;
        }
      });

      it('should handle unreachable service', async () => {
        // Point to unreachable URL
        const configService = module.get<ConfigService>(ConfigService);
        jest.spyOn(configService, 'get').mockImplementation((key: string) => {
          if (key === 'ORCHESTRATION_SERVICE_URL') return 'http://localhost:9999'; // Unreachable
          return undefined;
        });

        await eventsService.onModuleInit();

        await expect(eventsService.publishProjectCreated(mockProjectCreated))
          .rejects.toThrow();

        jest.restoreAllMocks();
        await eventsService.onModuleInit(); // Restore
      });
    });

    describe('Circuit Breaker in Real Conditions', () => {
      it('should open circuit breaker after repeated failures', async () => {
        const originalTransport = (eventsService as any).transport;
        const originalGetTargetUrl = originalTransport.getTargetUrl;
        originalTransport.getTargetUrl = () => 'http://localhost:3333/events/error/500';

        try {
          // Trigger 5 failures to open circuit breaker
          const failures = [];
          for (let i = 0; i < 5; i++) {
            failures.push(
              eventsService.publishProjectCreated({
                ...mockProjectCreated,
                projectId: `failure-project-${i}`,
              }).catch(() => {}) // Ignore errors for this test
            );
          }
          
          await Promise.all(failures);

          // Circuit breaker should now be open
          const health = await eventsService.healthCheck();
          expect(health.circuitBreakerState).toBe('open');

          // Next call should be blocked immediately
          const blockedStart = Date.now();
          await expect(eventsService.publishProjectCreated({
            ...mockProjectCreated,
            projectId: 'blocked-project',
          })).rejects.toThrow('Circuit breaker is OPEN');
          
          const blockedDuration = Date.now() - blockedStart;
          expect(blockedDuration).toBeLessThan(1000); // Should fail fast

        } finally {
          originalTransport.getTargetUrl = originalGetTargetUrl;
          
          // Reset circuit breaker for other tests
          const circuitBreaker = (eventsService as any).circuitBreaker;
          (circuitBreaker as any).state = 'closed';
          (circuitBreaker as any).failureCount = 0;
        }
      });

      it('should recover from open circuit breaker after timeout', async () => {
        const circuitBreaker = (eventsService as any).circuitBreaker;
        
        // Force circuit breaker to open with old timestamp
        (circuitBreaker as any).state = 'open';
        (circuitBreaker as any).failureCount = 5;
        (circuitBreaker as any).lastFailureTime = Date.now() - 35000; // 35 seconds ago

        // This should succeed and reset circuit breaker
        await eventsService.publishProjectCreated(mockProjectCreated);

        expect(receivedEvents).toHaveLength(1);
        expect(circuitBreaker.getState()).toBe('closed');
        expect(circuitBreaker.getFailureCount()).toBe(0);
      });
    });

    describe('Performance with Real HTTP', () => {
      it('should handle burst of events efficiently', async () => {
        const eventCount = 20;
        const startTime = Date.now();

        const promises = [];
        for (let i = 0; i < eventCount; i++) {
          promises.push(eventsService.publishProjectCreated({
            ...mockProjectCreated,
            projectId: `burst-project-${i}`,
            name: `Burst Project ${i}`,
          }));
        }

        await Promise.all(promises);
        const duration = Date.now() - startTime;

        console.log(`Published ${eventCount} events in ${duration}ms`);
        
        expect(receivedEvents).toHaveLength(eventCount);
        expect(duration).toBeLessThan(10000); // Should complete in < 10 seconds

        const metrics = eventsService.getMetrics();
        expect(metrics['project_created_success']).toBe(eventCount);
      });

      it('should handle sequential events with timing', async () => {
        const events = [
          { method: 'publishProjectCreated', data: mockProjectCreated },
          { method: 'publishProjectUpdated', data: {
              projectId: mockProjectCreated.projectId,
              ownerId: mockProjectCreated.ownerId,
              changes: { name: 'Updated' },
              modifiedFields: ['name'],
              updatedAt: new Date(),
            }
          },
        ];

        const timings: number[] = [];
        
        for (const event of events) {
          const start = Date.now();
          await (eventsService as any)[event.method](event.data);
          timings.push(Date.now() - start);
        }

        expect(receivedEvents).toHaveLength(2);
        expect(timings.every(t => t < 2000)).toBe(true); // Each event < 2s
      });
    });
  });

  describe('Different Transport Configurations', () => {
    describe('Stub Transport in Development', () => {
      let stubEventsService: EventsService;
      let stubModule: TestingModule;

      beforeAll(async () => {
        const stubConfig = {
          NODE_ENV: 'development',
          EVENT_TRANSPORT: 'stub',
          EVENT_STUB_SIMULATE_DELAY: 'true',
          EVENT_STUB_DELAY_MS: '50',
          EVENT_STUB_FAILURE_RATE: '0.1',
        };

        stubModule = await Test.createTestingModule({
          imports: [
            ConfigModule.forRoot({
              isGlobal: true,
              load: [() => stubConfig],
            }),
            EventsModule,
          ],
        }).compile();

        stubEventsService = stubModule.get<EventsService>(EventsService);
        await stubEventsService.onModuleInit();
      });

      afterAll(async () => {
        await stubEventsService.onModuleDestroy();
        await stubModule.close();
      });

      it('should simulate events without real HTTP calls', async () => {
        const startTime = Date.now();
        
        await stubEventsService.publishProjectCreated(mockProjectCreated);
        
        const duration = Date.now() - startTime;
        
        // Should have simulated delay
        expect(duration).toBeGreaterThanOrEqual(45);
        
        // No real HTTP calls made
        expect(receivedEvents).toHaveLength(0);
        
        // Should be marked as healthy
        const health = await stubEventsService.healthCheck();
        expect(health.status).toBe('healthy');
        expect(health.transport).toBe('stub');
      });

      it('should simulate failures based on failure rate', async () => {
        // Configure high failure rate for testing
        const highFailureConfig = {
          NODE_ENV: 'test',
          EVENT_TRANSPORT: 'stub',
          EVENT_STUB_FAILURE_RATE: '0.8', // 80% failure rate
        };

        const failureModule = await Test.createTestingModule({
          imports: [
            ConfigModule.forRoot({
              isGlobal: true,
              load: [() => highFailureConfig],
            }),
            EventsModule,
          ],
        }).compile();

        const failureService = failureModule.get<EventsService>(EventsService);
        await failureService.onModuleInit();

        let failures = 0;
        const attempts = 10;

        for (let i = 0; i < attempts; i++) {
          try {
            await failureService.publishProjectCreated({
              ...mockProjectCreated,
              projectId: `failure-test-${i}`,
            });
          } catch (error) {
            failures++;
          }
        }

        // Should have significant failures due to high failure rate
        expect(failures).toBeGreaterThan(5); // At least 50% should fail

        await failureService.onModuleDestroy();
        await failureModule.close();
      });
    });

    describe('Configuration Validation', () => {
      it('should handle missing configuration gracefully', async () => {
        const incompleteConfig = {
          NODE_ENV: 'test',
          EVENT_TRANSPORT: 'http',
          // Missing ORCHESTRATION_SERVICE_URL
        };

        const incompleteModule = await Test.createTestingModule({
          imports: [
            ConfigModule.forRoot({
              isGlobal: true,
              load: [() => incompleteConfig],
            }),
            EventsModule,
          ],
        }).compile();

        const incompleteService = incompleteModule.get<EventsService>(EventsService);
        
        // Should initialize without throwing
        await expect(incompleteService.onModuleInit()).resolves.toBeUndefined();

        // But health check should indicate unhealthy state
        const health = await incompleteService.healthCheck();
        expect(health.status).toBe('unhealthy');

        await incompleteService.onModuleDestroy();
        await incompleteModule.close();
      });

      it('should validate configuration on module initialization', async () => {
        const logSpy = jest.spyOn(console, 'warn').mockImplementation();

        const warningConfig = {
          EVENT_TRANSPORT: 'http',
          INTERNAL_SERVICE_TOKEN: 'dev-token', // Default token should trigger warning
        };

        const warningModule = await Test.createTestingModule({
          imports: [
            ConfigModule.forRoot({
              isGlobal: true,
              load: [() => warningConfig],
            }),
            EventsModule,
          ],
        }).compile();

        // Should have logged warnings about default token
        expect(logSpy).toHaveBeenCalledWith(
          expect.stringContaining('INTERNAL_SERVICE_TOKEN not configured or using default')
        );

        logSpy.mockRestore();
        await warningModule.close();
      });
    });
  });

  describe('Event Metadata and Validation', () => {
    it('should generate unique event IDs for each event', async () => {
      const eventCount = 5;
      
      for (let i = 0; i < eventCount; i++) {
        await eventsService.publishProjectCreated({
          ...mockProjectCreated,
          projectId: `unique-id-test-${i}`,
        });
      }

      expect(receivedEvents).toHaveLength(eventCount);

      // Extract all event IDs
      const eventIds = receivedEvents.map(e => e.payload.eventMetadata.eventId);
      const uniqueEventIds = new Set(eventIds);

      // All event IDs should be unique
      expect(uniqueEventIds.size).toBe(eventCount);
      
      // All should match the expected format
      eventIds.forEach(id => {
        expect(id).toMatch(/^evt_[0-9a-f-]{36}$/);
      });
    });

    it('should include accurate timestamps', async () => {
      const beforeEvent = Date.now();
      
      await eventsService.publishProjectCreated(mockProjectCreated);
      
      const afterEvent = Date.now();
      
      const receivedEvent = receivedEvents[0];
      const eventTimestamp = new Date(receivedEvent.payload.eventMetadata.eventTimestamp).getTime();
      const payloadTimestamp = new Date(receivedEvent.timestamp).getTime();

      // Event metadata timestamp should be within the test window
      expect(eventTimestamp).toBeGreaterThanOrEqual(beforeEvent - 1000);
      expect(eventTimestamp).toBeLessThanOrEqual(afterEvent + 1000);
      
      // Transport timestamp should be within window too
      expect(payloadTimestamp).toBeGreaterThanOrEqual(beforeEvent - 1000);
      expect(payloadTimestamp).toBeLessThanOrEqual(afterEvent + 1000);
    });

    it('should preserve correlation IDs across the chain', async () => {
      const correlationId = 'test-correlation-chain-123';
      
      await eventsService.publishProjectCreated(mockProjectCreated, correlationId);

      const receivedEvent = receivedEvents[0];
      expect(receivedEvent.correlationId).toBe(correlationId);
    });

    it('should include all required event metadata fields', async () => {
      await eventsService.publishProjectCreated(mockProjectCreated);

      const eventMetadata = receivedEvents[0].payload.eventMetadata;
      
      expect(eventMetadata).toMatchObject({
        eventId: expect.stringMatching(/^evt_/),
        eventTimestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
        eventVersion: '1.0',
        sourceService: 'project-service',
      });
    });
  });

  describe('Event Priority and Criticality', () => {
    it('should handle critical events with different retry behavior', async () => {
      const originalTransport = (eventsService as any).transport;
      const originalGetTargetUrl = originalTransport.getTargetUrl;
      
      let criticalAttempts = 0;
      let mediumAttempts = 0;

      originalTransport.getTargetUrl = (eventType: string) => {
        if (eventType === EVENT_TYPES.PROJECT_CREATED) {
          criticalAttempts++;
          if (criticalAttempts <= 4) return 'http://localhost:3333/events/error/500';
        } else if (eventType === EVENT_TYPES.PROJECT_UPDATED) {
          mediumAttempts++;
          if (mediumAttempts <= 2) return 'http://localhost:3333/events/error/500';
        }
        return originalGetTargetUrl(eventType);
      };

      try {
        // Critical event should retry 5 times
        await eventsService.publishProjectCreated(mockProjectCreated);
        expect(criticalAttempts).toBe(5);

        // Medium priority should retry 3 times  
        await eventsService.publishProjectUpdated({
          projectId: mockProjectCreated.projectId,
          ownerId: mockProjectCreated.ownerId,
          changes: { name: 'Updated' },
          modifiedFields: ['name'],
          updatedAt: new Date(),
        });
        expect(mediumAttempts).toBe(3);

        expect(receivedEvents).toHaveLength(2);

      } finally {
        originalTransport.getTargetUrl = originalGetTargetUrl;
      }
    });

    it('should use circuit breaker only for high priority events', async () => {
      const circuitBreaker = (eventsService as any).circuitBreaker;
      const executeSpy = jest.spyOn(circuitBreaker, 'execute');

      // High priority event should use circuit breaker
      await eventsService.publishProjectCreated(mockProjectCreated);
      expect(executeSpy).toHaveBeenCalledTimes(1);

      executeSpy.mockClear();

      // Medium priority event should not use circuit breaker
      await eventsService.publishProjectUpdated({
        projectId: 'test',
        ownerId: 'user',
        changes: {},
        modifiedFields: [],
        updatedAt: new Date(),
      });
      expect(executeSpy).not.toHaveBeenCalled();
    });
  });

  describe('Concurrent Event Publishing', () => {
    it('should handle multiple simultaneous events', async () => {
      const concurrentCount = 10;
      const promises = [];

      for (let i = 0; i < concurrentCount; i++) {
        promises.push(eventsService.publishProjectCreated({
          ...mockProjectCreated,
          projectId: `concurrent-${i}`,
          name: `Concurrent Project ${i}`,
        }));
      }

      const startTime = Date.now();
      await Promise.all(promises);
      const duration = Date.now() - startTime;

      console.log(`Published ${concurrentCount} concurrent events in ${duration}ms`);

      expect(receivedEvents).toHaveLength(concurrentCount);
      expect(duration).toBeLessThan(5000); // Should complete in reasonable time

      // Verify all events were received correctly
      const projectIds = receivedEvents.map(e => e.payload.projectId);
      const expectedIds = Array.from({ length: concurrentCount }, (_, i) => `concurrent-${i}`);
      
      expect(projectIds.sort()).toEqual(expectedIds.sort());
    });

    it('should maintain order for sequential events on same project', async () => {
      const projectId = 'sequential-test-project';
      
      // Send events in sequence
      await eventsService.publishProjectCreated({
        ...mockProjectCreated,
        projectId,
        name: 'Original Name',
      });

      await eventsService.publishProjectUpdated({
        projectId,
        ownerId: mockProjectCreated.ownerId,
        changes: { name: 'Updated Name' },
        modifiedFields: ['name'],
        updatedAt: new Date(Date.now() + 1000), // 1 second later
      });

      expect(receivedEvents).toHaveLength(2);
      
      // Verify order by timestamps
      const timestamps = receivedEvents.map(e => new Date(e.payload.eventMetadata.eventTimestamp).getTime());
      expect(timestamps[1]).toBeGreaterThan(timestamps[0]);
    });
  });

  describe('Payload Validation and Transformation', () => {
    it('should handle large payloads correctly', async () => {
      const largeProject: ProjectCreatedEventDto = {
        ...mockProjectCreated,
        description: 'x'.repeat(50000), // 50KB description
        initialPrompt: 'y'.repeat(100000), // 100KB prompt
        uploadedFileIds: Array.from({ length: 100 }, (_, i) => `file-${i}`), // Many files
      };

      await eventsService.publishProjectCreated(largeProject);

      const receivedEvent = receivedEvents[0];
      expect(receivedEvent.payload.description).toBe(largeProject.description);
      expect(receivedEvent.payload.initialPrompt).toBe(largeProject.initialPrompt);
      expect(receivedEvent.payload.uploadedFileIds).toHaveLength(100);
    });

    it('should handle special characters and encoding', async () => {
      const specialProject: ProjectCreatedEventDto = {
        ...mockProjectCreated,
        name: 'Projet with émojis 🚀 and special chars àáâãäå',
        description: 'Description with\nnewlines and\ttabs and "quotes"',
        initialPrompt: 'Create app with <HTML> & JSON {"key": "value"} content',
      };

      await eventsService.publishProjectCreated(specialProject);

      const receivedEvent = receivedEvents[0];
      expect(receivedEvent.payload.name).toBe(specialProject.name);
      expect(receivedEvent.payload.description).toBe(specialProject.description);
      expect(receivedEvent.payload.initialPrompt).toBe(specialProject.initialPrompt);
    });

    it('should handle edge case values correctly', async () => {
      const edgeCaseProject: ProjectCreatedEventDto = {
        ...mockProjectCreated,
        description: undefined, // Optional field
        uploadedFileIds: [], // Empty array
        hasUploadedFiles: false,
        promptComplexity: 'unknown' as any,
      };

      await eventsService.publishProjectCreated(edgeCaseProject);

      const receivedEvent = receivedEvents[0];
      expect(receivedEvent.payload.description).toBeUndefined();
      expect(receivedEvent.payload.uploadedFileIds).toEqual([]);
      expect(receivedEvent.payload.hasUploadedFiles).toBe(false);
    });
  });

  describe('Health Monitoring and Observability', () => {
    it('should provide detailed health status', async () => {
      // Publish some events to generate metrics
      await eventsService.publishProjectCreated(mockProjectCreated);

      const health = await eventsService.healthCheck();

      expect(health).toMatchObject({
        status: 'healthy',
        transport: 'http',
        circuitBreakerState: 'closed',
        uptime: expect.any(Number),
        metrics: expect.any(Object),
      });

      expect(health.uptime).toBeGreaterThan(0);
      expect(Object.keys(health.metrics).length).toBeGreaterThan(0);
    });

    it('should detect unhealthy state when orchestrator unreachable', async () => {
      // Stop the mock server to simulate unreachable service
      await new Promise(resolve => mockServer.close(resolve));

      const health = await eventsService.healthCheck();

      expect(health.status).toBe('unhealthy');

      // Restart server for other tests
      mockServer = await setupMockOrchestrator();
      
      // Wait a moment for the service to potentially recover
      await new Promise(resolve => setTimeout(resolve, 1000));
    });

    it('should accumulate metrics over multiple operations', async () => {
      // Generate various events to build metrics
      const operations = [
        () => eventsService.publishProjectCreated({...mockProjectCreated, projectId: 'metrics-1'}),
        () => eventsService.publishProjectCreated({...mockProjectCreated, projectId: 'metrics-2'}),
        () => eventsService.publishProjectUpdated({
          projectId: 'metrics-1',
          ownerId: 'user',
          changes: {},
          modifiedFields: [],
          updatedAt: new Date(),
        }),
      ];

      for (const operation of operations) {
        await operation();
      }

      const metrics = eventsService.getMetrics();
      
      expect(metrics['project_created_success']).toBe(2);
      expect(metrics['project_updated_success']).toBe(1);
      expect(metrics['project_created_duration']).toBeGreaterThan(0);
    });
  });

  describe('Network Error Scenarios', () => {
    it('should differentiate between different HTTP error types', async () => {
      const originalTransport = (eventsService as any).transport;
      const originalGetTargetUrl = originalTransport.getTargetUrl;

      // Test 4xx error (client error)
      originalTransport.getTargetUrl = () => 'http://localhost:3333/events/error/400';

      await expect(eventsService.publishProjectCreated({
        ...mockProjectCreated,
        projectId: '400-error-test',
      })).rejects.toThrow();

      // Test 5xx error (server error) 
      originalTransport.getTargetUrl = () => 'http://localhost:3333/events/error/500';

      await expect(eventsService.publishProjectCreated({
        ...mockProjectCreated,
        projectId: '500-error-test',
      })).rejects.toThrow();

      // Both should have been retried
      const metrics = eventsService.getMetrics();
      expect(metrics['project_created_retry']).toBeGreaterThan(0);

      originalTransport.getTargetUrl = originalGetTargetUrl;
    });

    it('should handle connection refused errors', async () => {
      // Point to a definitely closed port
      const configService = module.get<ConfigService>(ConfigService);
      jest.spyOn(configService, 'get').mockImplementation((key: string) => {
        if (key === 'ORCHESTRATION_SERVICE_URL') return 'http://localhost:19999'; 
        return undefined;
      });

      await eventsService.onModuleInit();

      await expect(eventsService.publishProjectCreated(mockProjectCreated))
        .rejects.toThrow();

      jest.restoreAllMocks();
      await eventsService.onModuleInit();
    });
  });

  describe('Memory and Resource Management', () => {
    it('should not leak memory with many events', async () => {
      const initialMetrics = eventsService.getMetrics();
      const initialMetricCount = Object.keys(initialMetrics).length;

      // Publish many events
      for (let i = 0; i < 100; i++) {
        await eventsService.publishProjectCreated({
          ...mockProjectCreated,
          projectId: `memory-test-${i}`,
        });
      }

      const afterMetrics = eventsService.getMetrics();
      const afterMetricCount = Object.keys(afterMetrics).length;

      // Metrics count shouldn't grow excessively
      expect(afterMetricCount).toBeLessThan(initialMetricCount + 20);

      // Success count should reflect all events
      expect(afterMetrics['project_created_success']).toBe(100);
    });

    it('should handle metrics reset correctly', async () => {
      // Generate some metrics
      await eventsService.publishProjectCreated(mockProjectCreated);
      
      let metrics = eventsService.getMetrics();
      expect(Object.keys(metrics).length).toBeGreaterThan(0);

      // Reset
      eventsService.resetMetrics();
      
      metrics = eventsService.getMetrics();
      expect(metrics).toEqual({});
    });
  });

  describe('Environment-Specific Behavior', () => {
    it('should use test environment HTTP configuration', async () => {
      // Test configuration should use shorter timeouts
      const health = await eventsService.healthCheck();
      
      // In test environment, should be configured for speed
      expect(health.status).toBe('healthy');
    });

    it('should log appropriately for test environment', async () => {
      const logSpy = jest.spyOn(console, 'log').mockImplementation();
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

      await eventsService.publishProjectCreated(mockProjectCreated);

      // Should have some logging activity
      expect(logSpy).toHaveBeenCalled();

      logSpy.mockRestore();
      warnSpy.mockRestore();
    });
  });

  describe('Service Lifecycle Management', () => {
    it('should handle multiple init/destroy cycles', async () => {
      // Destroy current instance
      await eventsService.onModuleDestroy();

      // Verify it's destroyed
      let health = await eventsService.healthCheck();
      expect(health.status).toBe('unhealthy');

      // Reinitialize
      await eventsService.onModuleInit();

      // Should be healthy again
      health = await eventsService.healthCheck();
      expect(health.status).toBe('healthy');

      // Should be able to publish events
      await eventsService.publishProjectCreated(mockProjectCreated);
      expect(receivedEvents).toHaveLength(1);
    });
  });
});