// test/e2e/cache-events.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from '../../src/cache/cache.module';
import { EventsModule } from '../../src/events/events.module';
import { CacheService } from '../../src/cache/cache.service';
import { EventsService } from '../../src/events/events.service';
import { PROJECT_EVENT_NAMESPACE } from '../../src/events/event-types.constants';
import { ProjectStatus } from '../../src/common/enums/project-status.enum';
import Redis from 'ioredis';

// Mock HTTP server for orchestrator
import express from 'express';
import { Server } from 'http';

describe('Cache + Events E2E Tests', () => {
  let module: TestingModule;
  let cacheService: CacheService;
  let eventsService: EventsService;
  let redis: Redis;
  let mockOrchestrator: Server;
  let receivedEvents: any[] = [];

  const testConfig = {
    NODE_ENV: 'test',
    REDIS_HOST: 'localhost',
    REDIS_PORT: '6379',
    REDIS_DB: '14', // Separate DB for E2E tests
    REDIS_KEY_PREFIX: 'e2e-test',
    EVENT_TRANSPORT: 'http',
    ORCHESTRATION_SERVICE_URL: 'http://localhost:3335',
    INTERNAL_SERVICE_TOKEN: 'e2e-test-token',
    EVENTS_HTTP_TIMEOUT: '3000',
  };

  beforeAll(async () => {
    // Setup mock orchestrator
    const app = express();
    app.use(express.json());
    
    app.post('/events/project/created', (req, res) => {
      receivedEvents.push({ type: 'created', body: req.body });
      res.json({ received: true });
    });
    
    app.post('/events/project/updated', (req, res) => {
      receivedEvents.push({ type: 'updated', body: req.body });
      res.json({ received: true });
    });
    
    app.post('/events/project/deleted', (req, res) => {
      receivedEvents.push({ type: 'deleted', body: req.body });
      res.json({ received: true });
    });

    app.get('/health', (req, res) => {
      res.json({ status: 'healthy' });
    });

    mockOrchestrator = app.listen(3335);

    // Setup test module with both cache and events
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [() => testConfig],
        }),
        CacheModule,
        EventsModule,
      ],
    }).compile();

    cacheService = module.get<CacheService>(CacheService);
    eventsService = module.get<EventsService>(EventsService);

    // Initialize Redis client for direct access
    redis = new Redis({
      host: testConfig.REDIS_HOST,
      port: parseInt(testConfig.REDIS_PORT),
      db: parseInt(testConfig.REDIS_DB),
    });

    // Wait for services to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  afterAll(async () => {
    await redis.flushdb();
    await redis.quit();
    await module.close();
    
    if (mockOrchestrator) {
      await new Promise(resolve => mockOrchestrator.close(resolve));
    }
  });

  beforeEach(async () => {
    await redis.flushdb();
    receivedEvents = [];
    eventsService.resetMetrics();
  });

  describe('Complete Project Lifecycle Flow', () => {
    const mockProject = {
      id: 'e2e-project-123',
      ownerId: 'e2e-user-456', 
      name: 'E2E Test Project',
      description: 'Project for end-to-end testing',
      status: ProjectStatus.ACTIVE,
      createdAt: new Date(),
      uploadedFileIds: ['file-1', 'file-2'],
      generatedFileIds: [],
    };

    it('should handle complete project creation flow', async () => {
      // 1. Store project in cache (simulating ProjectService.create)
      await cacheService.set(
        cacheService.getProjectKey(mockProject.id),
        mockProject
      );

      // 2. Cache project list for user  
      const projectList = [{ id: mockProject.id, name: mockProject.name }];
      await cacheService.set(
        cacheService.getProjectListKey(mockProject.ownerId, 1, 10),
        projectList
      );

      // 3. Publish creation event
      await eventsService.publishProjectCreated({
        projectId: mockProject.id,
        ownerId: mockProject.ownerId,
        name: mockProject.name,
        description: mockProject.description,
        initialPrompt: 'Create a comprehensive application',
        uploadedFileIds: mockProject.uploadedFileIds,
        hasUploadedFiles: true,
        promptComplexity: 'medium',
        createdAt: mockProject.createdAt,
      });

      // Verify cache contains project data
      const cachedProject = await cacheService.get(cacheService.getProjectKey(mockProject.id));
      expect(cachedProject).toEqual(mockProject);

      const cachedList = await cacheService.get(
        cacheService.getProjectListKey(mockProject.ownerId, 1, 10)
      );
      expect(cachedList).toEqual(projectList);

      // Verify event was published
      expect(receivedEvents).toHaveLength(1);
      expect(receivedEvents[0].body.eventType).toBe(`${PROJECT_EVENT_NAMESPACE}.created`);
      expect(receivedEvents[0].body.payload.projectId).toBe(mockProject.id);
    });

    it('should handle project update flow with cache invalidation', async () => {
      // 1. Setup initial cached data
      await cacheService.set(cacheService.getProjectKey(mockProject.id), mockProject);
      await cacheService.set(
        cacheService.getProjectListKey(mockProject.ownerId, 1, 10),
        [mockProject]
      );

      // Verify data is cached
      let cached = await cacheService.get(cacheService.getProjectKey(mockProject.id));
      expect(cached).toEqual(mockProject);

      // 2. Update project (simulate ProjectService.update)
      const updatedProject = { ...mockProject, name: 'Updated Project Name' };
      await cacheService.set(cacheService.getProjectKey(mockProject.id), updatedProject);

      // 3. Invalidate cache (simulate post-update cleanup)
      await cacheService.invalidateProjectCache(mockProject.id, mockProject.ownerId);

      // 4. Publish update event
      await eventsService.publishProjectUpdated({
        projectId: mockProject.id,
        ownerId: mockProject.ownerId,
        changes: { name: 'Updated Project Name' },
        modifiedFields: ['name'],
        updatedAt: new Date(),
      });

      // Verify cache was invalidated
      cached = await cacheService.get(cacheService.getProjectKey(mockProject.id));
      expect(cached).toBeNull();

      const cachedList = await cacheService.get(
        cacheService.getProjectListKey(mockProject.ownerId, 1, 10)
      );
      expect(cachedList).toBeNull();

      // Verify event was published
      expect(receivedEvents).toHaveLength(1);
      expect(receivedEvents[0].body.payload.changes.name).toBe('Updated Project Name');
    });

    it('should handle project deletion flow', async () => {
      // 1. Setup project with statistics and files cache
      const projectWithStats = {
        ...mockProject,
        statistics: { costs: 15.50, performance: { time: 30000 } },
      };

      await cacheService.set(cacheService.getProjectKey(mockProject.id), mockProject);
      await cacheService.set(cacheService.getProjectWithStatsKey(mockProject.id), projectWithStats);
      await cacheService.set(cacheService.getProjectStatisticsKey(mockProject.id), projectWithStats.statistics);
      await cacheService.set(cacheService.getProjectFilesListKey(mockProject.id), mockProject.uploadedFileIds);

      // Setup user caches
      await cacheService.set(
        cacheService.getProjectListKey(mockProject.ownerId, 1, 10),
        [mockProject]
      );
      await cacheService.set(
        cacheService.getProjectCountKey(mockProject.ownerId),
        1
      );

      // 2. Delete project (simulate ProjectService.delete)
      await cacheService.invalidateProjectCache(mockProject.id, mockProject.ownerId);

      // 3. Publish deletion event
      await eventsService.publishProjectDeleted({
        projectId: mockProject.id,
        ownerId: mockProject.ownerId,
        previousStatus: 'ACTIVE',
        hadGeneratedFiles: false,
        fileCount: { uploaded: 2, generated: 0, total: 2 },
        deletedAt: new Date(),
      });

      // Verify all project caches were cleared
      expect(await cacheService.get(cacheService.getProjectKey(mockProject.id))).toBeNull();
      expect(await cacheService.get(cacheService.getProjectWithStatsKey(mockProject.id))).toBeNull();
      expect(await cacheService.get(cacheService.getProjectStatisticsKey(mockProject.id))).toBeNull();
      expect(await cacheService.get(cacheService.getProjectFilesListKey(mockProject.id))).toBeNull();

      // Verify user list caches were cleared
      expect(await cacheService.get(
        cacheService.getProjectListKey(mockProject.ownerId, 1, 10)
      )).toBeNull();

      // Verify deletion event was published
      expect(receivedEvents).toHaveLength(1);
      expect(receivedEvents[0].body.eventType).toBe(`${PROJECT_EVENT_NAMESPACE}.deleted`);
      expect(receivedEvents[0].body.payload.hadGeneratedFiles).toBe(false);
    });

    it('should handle files update flow', async () => {
      // 1. Setup project cache
      await cacheService.set(cacheService.getProjectKey(mockProject.id), mockProject);

      // 2. Simulate orchestrator completing document generation
      const generatedFiles = ['gen-doc-1.md', 'gen-roadmap-1.md', 'gen-plan-1.md'];
      const updatedProject = {
        ...mockProject,
        generatedFileIds: generatedFiles,
      };

      // 3. Update project cache with generated files
      await cacheService.set(cacheService.getProjectKey(mockProject.id), updatedProject);

      // 4. Cache the files list
      await cacheService.set(
        cacheService.getProjectFilesListKey(mockProject.id), 
        generatedFiles
      );

      // 5. Publish files updated event
      await eventsService.publishProjectFilesUpdated({
        projectId: mockProject.id,
        ownerId: mockProject.ownerId,
        newFileIds: generatedFiles,
        updateMode: 'replace',
        totalGeneratedFiles: generatedFiles.length,
        updatedAt: new Date(),
      });

      // Verify cache contains updated data
      const cachedProject = await cacheService.get(cacheService.getProjectKey(mockProject.id));
      expect(cachedProject).toEqual(updatedProject);

      const cachedFiles = await cacheService.get(cacheService.getProjectFilesListKey(mockProject.id));
      expect(cachedFiles).toEqual(generatedFiles);

      // Verify event was published
      expect(receivedEvents).toHaveLength(1);
      expect(receivedEvents[0].body.payload.newFileIds).toEqual(generatedFiles);
      expect(receivedEvents[0].body.payload.fileCount).toBe(3);
    });
  });

  describe('Cache-Event Coordination Patterns', () => {
    describe('Cache-First Pattern', () => {
      it('should update cache first, then publish event', async () => {
        const project = { id: 'cache-first-123', name: 'Cache First Project' };
        
        // 1. Update cache
        const cacheStart = Date.now();
        await cacheService.set('projects:project:cache-first-123', project);
        const cacheTime = Date.now() - cacheStart;

        // 2. Publish event
        const eventStart = Date.now();
        await eventsService.publishProjectCreated({
          projectId: project.id,
          ownerId: 'user-123',
          name: project.name,
          description: 'Cache first test',
          initialPrompt: 'Test cache-first pattern',
          uploadedFileIds: [],
          hasUploadedFiles: false,
          promptComplexity: 'low',
          createdAt: new Date(),
        });
        const eventTime = Date.now() - eventStart;

        console.log(`Cache operation: ${cacheTime}ms, Event operation: ${eventTime}ms`);

        // Verify both operations completed
        const cached = await cacheService.get('projects:project:cache-first-123');
        expect(cached).toEqual(project);
        expect(receivedEvents).toHaveLength(1);
      });
    });

    describe('Event-Driven Cache Invalidation', () => {
      it('should simulate event-driven cache invalidation flow', async () => {
        const project = {
          id: 'event-driven-123',
          ownerId: 'user-456',
          name: 'Event Driven Project',
        };

        // 1. Setup initial cache state
        await cacheService.set(cacheService.getProjectKey(project.id), project);
        await cacheService.set(
          cacheService.getProjectListKey(project.ownerId, 1, 10),
          [project]
        );

        // Verify initial state
        expect(await cacheService.get(cacheService.getProjectKey(project.id))).toEqual(project);

        // 2. Simulate receiving an external event (e.g., from orchestrator)
        // that would trigger cache invalidation
        await cacheService.invalidateProjectCache(project.id, project.ownerId);

        // 3. Publish our own event about the invalidation
        await eventsService.publishProjectUpdated({
          projectId: project.id,
          ownerId: project.ownerId,
          changes: { name: 'New Name' },
          modifiedFields: ['name'],
          updatedAt: new Date(),
        });

        // Verify cache was invalidated
        expect(await cacheService.get(cacheService.getProjectKey(project.id))).toBeNull();
        
        // Verify event was published
        expect(receivedEvents).toHaveLength(1);
        expect(receivedEvents[0].body.payload.changes.name).toBe('New Name');
      });

      it('should handle rapid cache updates with event publishing', async () => {
        const projectId = 'rapid-updates-123';
        const userId = 'user-789';

        // Simulate rapid sequence of updates
        const updates = [
          { version: 1, name: 'Version 1', field: 'name' },
          { version: 2, name: 'Version 2', field: 'description' },
          { version: 3, name: 'Version 3', field: 'status' },
        ];

        const startTime = Date.now();

        for (const update of updates) {
          // Update cache
          await cacheService.set(cacheService.getProjectKey(projectId), {
            id: projectId,
            version: update.version,
            name: update.name,
          });

          // Invalidate related caches
          await cacheService.invalidateProjectCache(projectId, userId);

          // Publish event
          await eventsService.publishProjectUpdated({
            projectId,
            ownerId: userId,
            changes: { [update.field]: `Updated ${update.field}` },
            modifiedFields: [update.field],
            updatedAt: new Date(),
          });
        }

        const totalTime = Date.now() - startTime;
        console.log(`Rapid updates sequence completed in ${totalTime}ms`);

        // Verify all events were published
        expect(receivedEvents).toHaveLength(3);
        expect(totalTime).toBeLessThan(5000); // Should complete efficiently

        // Final cache state should be clean (invalidated)
        expect(await cacheService.get(cacheService.getProjectKey(projectId))).toBeNull();
      });
    });

    describe('Concurrent Cache and Events', () => {
      it('should handle concurrent cache operations during event publishing', async () => {
        const projectCount = 10;
        const promises = [];

        for (let i = 0; i < projectCount; i++) {
          const projectId = `concurrent-${i}`;
          const project = {
            id: projectId,
            name: `Concurrent Project ${i}`,
            ownerId: 'concurrent-user',
          };

          // Start cache and event operations simultaneously
          promises.push(
            Promise.all([
              // Cache operations
              cacheService.set(cacheService.getProjectKey(projectId), project),
              cacheService.set(
                cacheService.getProjectListKey('concurrent-user', 1, 10),
                [project]
              ),
              // Event operation
              eventsService.publishProjectCreated({
                projectId,
                ownerId: 'concurrent-user',
                name: project.name,
                description: 'Concurrent test',
                initialPrompt: 'Test concurrent operations',
                uploadedFileIds: [],
                hasUploadedFiles: false,
                promptComplexity: 'low',
                createdAt: new Date(),
              }),
            ])
          );
        }

        const startTime = Date.now();
        await Promise.all(promises);
        const duration = Date.now() - startTime;

        console.log(`Concurrent operations for ${projectCount} projects completed in ${duration}ms`);

        // Verify all operations completed successfully
        expect(receivedEvents).toHaveLength(projectCount);

        // Verify cache integrity
        for (let i = 0; i < projectCount; i++) {
          const cached = await cacheService.get(cacheService.getProjectKey(`concurrent-${i}`));
          expect(cached).toBeTruthy();
        }

        // Verify metrics
        const cacheStats = await cacheService.getStats();
        const eventMetrics = eventsService.getMetrics();
        
        expect(cacheStats.operations.sets).toBeGreaterThanOrEqual(projectCount * 2);
        expect(eventMetrics['project_created_success']).toBe(projectCount);
      });
    });
  });

  describe('Failure Recovery and Resilience', () => {
    describe('Cache Failure with Events Success', () => {
      it('should handle Redis failure while events continue working', async () => {
        // 1. Setup normal state
        await cacheService.set('test-key', 'test-value');
        expect(await cacheService.get('test-key')).toBe('test-value');

        // 2. Simulate Redis failure by disconnecting
        await redis.quit();

        // 3. Cache operations should fail gracefully
        const cacheResult = await cacheService.set('new-key', 'new-value');
        expect(cacheResult).toBe(false);

        const getResult = await cacheService.get('test-key');
        expect(getResult).toBeNull();

        // 4. Events should still work
        await eventsService.publishProjectCreated({
          projectId: 'redis-down-test',
          ownerId: 'user-123',
          name: 'Redis Down Test',
          description: 'Test when Redis is down',
          initialPrompt: 'Test resilience',
          uploadedFileIds: [],
          hasUploadedFiles: false,
          promptComplexity: 'low',
          createdAt: new Date(),
        });

        expect(receivedEvents).toHaveLength(1);

        // 5. Reconnect Redis for cleanup
        redis = new Redis({
          host: testConfig.REDIS_HOST,
          port: parseInt(testConfig.REDIS_PORT),
          db: parseInt(testConfig.REDIS_DB),
        });
      });
    });

    describe('Event Failure with Cache Success', () => {
      it('should handle orchestrator failure while cache continues working', async () => {
        // 1. Stop orchestrator
        await new Promise(resolve => mockOrchestrator.close(resolve));

        // 2. Cache should still work
        await cacheService.set('cache-only-test', { id: 'test' });
        const cached = await cacheService.get('cache-only-test');
        expect(cached).toEqual({ id: 'test' });

        // 3. Events should fail but not crash the system
        await expect(eventsService.publishProjectCreated({
          projectId: 'orchestrator-down-test',
          ownerId: 'user-123',
          name: 'Orchestrator Down Test',
          description: 'Test when orchestrator is down',
          initialPrompt: 'Test resilience',
          uploadedFileIds: [],
          hasUploadedFiles: false,
          promptComplexity: 'low',
          createdAt: new Date(),
        })).rejects.toThrow();

        // 4. Cache health should still be good
        const cacheHealthy = await cacheService.healthCheck();
        expect(cacheHealthy).toBe(true);

        // 5. Events health should be degraded
        const eventsHealth = await eventsService.healthCheck();
        expect(eventsHealth.status).toBe('unhealthy');

        // 6. Restart orchestrator for other tests
        mockOrchestrator = await new Promise(resolve => {
          const app = express();
          app.use(express.json());
          app.post('/events/project/created', (req, res) => {
            receivedEvents.push({ type: 'created', body: req.body });
            res.json({ received: true });
          });
          app.get('/health', (req, res) => res.json({ status: 'healthy' }));
          const server = app.listen(3335, () => resolve(server));
        });
      });
    });

    describe('Recovery Scenarios', () => {
      it('should recover from temporary failures', async () => {
        // Setup a project that will be affected by failures
        const project = { id: 'recovery-test', name: 'Recovery Test' };
        await cacheService.set('recovery-project', project);

        // Temporarily break orchestrator (respond with errors)
        let errorCount = 0;
        await new Promise(resolve => mockOrchestrator.close(resolve));

        const app = express();
        app.use(express.json());
        app.post('/events/project/created', (req, res) => {
          errorCount++;
          if (errorCount <= 2) {
            res.status(500).json({ error: 'Temporary failure' });
          } else {
            receivedEvents.push({ type: 'created', body: req.body });
            res.json({ received: true });
          }
        });
        app.get('/health', (req, res) => res.json({ status: 'healthy' }));
        mockOrchestrator = app.listen(3335);

        // Wait for server to be ready
        await new Promise(resolve => setTimeout(resolve, 500));

        // This should eventually succeed after retries
        await eventsService.publishProjectCreated({
          projectId: 'recovery-test-project',
          ownerId: 'user-recovery',
          name: 'Recovery Test',
          description: 'Testing recovery',
          initialPrompt: 'Test recovery pattern',
          uploadedFileIds: [],
          hasUploadedFiles: false,
          promptComplexity: 'low',
          createdAt: new Date(),
        });

        expect(receivedEvents).toHaveLength(1);
        expect(errorCount).toBe(3); // Failed 2 times, succeeded on 3rd
        
        // Cache should still be working
        const cached = await cacheService.get('recovery-project');
        expect(cached).toEqual(project);
      });
    });
  });

  describe('Complex Integration Scenarios', () => {
    describe('Multi-User Project Management', () => {
      it('should handle multiple users with isolated caches and shared events', async () => {
        const users = ['user-A', 'user-B', 'user-C'];
        const projectsPerUser = 3;

        // Setup projects for each user
        for (const userId of users) {
          const userProjects = [];
          
          for (let i = 0; i < projectsPerUser; i++) {
            const projectId = `${userId}-project-${i}`;
            const project = {
              id: projectId,
              ownerId: userId,
              name: `${userId} Project ${i}`,
              status: ProjectStatus.ACTIVE,
            };

            // Cache project
            await cacheService.set(cacheService.getProjectKey(projectId), project);
            userProjects.push(project);

            // Publish creation event
            await eventsService.publishProjectCreated({
              projectId,
              ownerId: userId,
              name: project.name,
              description: 'Multi-user test project',
              initialPrompt: 'Test multi-user isolation',
              uploadedFileIds: [],
              hasUploadedFiles: false,
              promptComplexity: 'low',
              createdAt: new Date(),
            });
          }

          // Cache user's project list
          await cacheService.set(
            cacheService.getProjectListKey(userId, 1, 10),
            userProjects
          );
        }

        // Verify cache isolation
        for (const userId of users) {
          const userList = await cacheService.get(
            cacheService.getProjectListKey(userId, 1, 10)
          );
          expect(userList).toHaveLength(projectsPerUser);
          
          // Each user should only see their own projects
          const projectOwners = (userList as any[]).map(p => p.ownerId);
          expect(projectOwners.every(owner => owner === userId)).toBe(true);
        }

        // Verify all events were published
        expect(receivedEvents).toHaveLength(users.length * projectsPerUser);

        // Test selective invalidation
        await cacheService.invalidateUserProjectsCache('user-B');

        // User A and C caches should remain
        expect(await cacheService.get(cacheService.getProjectListKey('user-A', 1, 10))).not.toBeNull();
        expect(await cacheService.get(cacheService.getProjectListKey('user-C', 1, 10))).not.toBeNull();
        
        // User B cache should be gone
        expect(await cacheService.get(cacheService.getProjectListKey('user-B', 1, 10))).toBeNull();
      });
    });

    describe('Statistics Integration', () => {
      it('should coordinate statistics caching with event publishing', async () => {
        const projectId = 'stats-integration-test';
        const statisticsData = {
          costs: { api: 25.50, storage: 5.00, total: 30.50 },
          performance: { generationTime: 60000, processingTime: 15000 },
          usage: { documentsGenerated: 7, filesProcessed: 3 },
        };

        // 1. Cache project statistics
        await cacheService.set(
          cacheService.getProjectStatisticsKey(projectId),
          statisticsData,
          600 // 10 minutes TTL
        );

        // 2. Cache project with stats
        const projectWithStats = {
          id: projectId,
          name: 'Stats Integration Test',
          statistics: statisticsData,
        };
        await cacheService.set(
          cacheService.getProjectWithStatsKey(projectId),
          projectWithStats
        );

        // 3. Simulate statistics update (from external service)
        const updatedStats = {
          ...statisticsData,
          costs: { ...statisticsData.costs, total: 35.00 },
          usage: { ...statisticsData.usage, documentsGenerated: 8 },
        };

        await cacheService.set(
          cacheService.getProjectStatisticsKey(projectId),
          updatedStats
        );

        // 4. Invalidate cached project with old stats
        await cacheService.invalidateStatisticsCache(projectId);

        // 5. Publish statistics updated event (simulated)
        await eventsService.publishProjectUpdated({
          projectId,
          ownerId: 'user-stats',
          changes: { statistics: updatedStats },
          modifiedFields: ['statistics'],
          updatedAt: new Date(),
        });

        // Verify stats cache has updated data
        const cachedStats = await cacheService.get(cacheService.getProjectStatisticsKey(projectId));
        expect(cachedStats).toEqual(updatedStats);

        // Verify project-with-stats cache was invalidated
        expect(await cacheService.get(cacheService.getProjectWithStatsKey(projectId))).toBeNull();

        // Verify event was published
        expect(receivedEvents).toHaveLength(1);
      });
    });

    describe('Export Flow Integration', () => {
      it('should coordinate export operations with caching and events', async () => {
        const projectId = 'export-integration-test';
        const exportId = 'export-123';

        // 1. Setup project cache
        const project = {
          id: projectId,
          name: 'Export Test Project', 
          generatedFileIds: ['doc-1.md', 'roadmap-1.md'],
        };
        await cacheService.set(cacheService.getProjectKey(projectId), project);

        // 2. Cache export status
        const exportStatus = {
          status: 'processing',
          progress: 0,
          startedAt: new Date(),
        };
        await cacheService.set(cacheService.getExportStatusKey(exportId), exportStatus);

        // 3. Simulate export completion
        const exportResult = {
          downloadUrl: 'https://storage.example.com/exports/export-123.zip',
          fileName: 'project-export.zip',
          fileSize: 1048576,
          format: 'markdown',
          expiresAt: new Date(Date.now() + 3600000), // 1 hour
        };

        await cacheService.set(cacheService.getExportResultKey(exportId), exportResult, 7200);

        // Update export status
        await cacheService.set(cacheService.getExportStatusKey(exportId), {
          ...exportStatus,
          status: 'completed',
          progress: 100,
          completedAt: new Date(),
        });

        // 4. Publish project files accessed event (simulated)
        await eventsService.publishProjectUpdated({
          projectId,
          ownerId: 'export-user',
          changes: { lastExported: new Date() },
          modifiedFields: ['lastExported'],
          updatedAt: new Date(),
        });

        // Verify export data is cached correctly
        const cachedResult = await cacheService.get(cacheService.getExportResultKey(exportId));
        expect(cachedResult).toEqual(exportResult);

        const cachedStatus = await cacheService.get(cacheService.getExportStatusKey(exportId));
        expect(cachedStatus.status).toBe('completed');

        // Verify event was published  
        expect(receivedEvents).toHaveLength(1);
      });
    });
  });

  describe('Performance and Scalability', () => {
    describe('High Volume Operations', () => {
      it('should handle high volume of cache + event operations', async () => {
        const operationCount = 100;
        const batchSize = 10;
        
        const startTime = Date.now();

        // Process in batches to avoid overwhelming the system
        for (let batch = 0; batch < operationCount / batchSize; batch++) {
          const batchPromises = [];
          
          for (let i = 0; i < batchSize; i++) {
            const index = batch * batchSize + i;
            const projectId = `volume-test-${index}`;
            
            batchPromises.push(
              Promise.all([
                cacheService.set(`project:${projectId}`, { id: projectId }),
                eventsService.publishProjectCreated({
                  projectId,
                  ownerId: 'volume-user',
                  name: `Volume Test ${index}`,
                  description: 'High volume test',
                  initialPrompt: 'Test high volume',
                  uploadedFileIds: [],
                  hasUploadedFiles: false,
                  promptComplexity: 'low',
                  createdAt: new Date(),
                }),
              ])
            );
          }
          
          await Promise.all(batchPromises);
        }

        const totalTime = Date.now() - startTime;
        console.log(`High volume test: ${operationCount} operations in ${totalTime}ms`);

        // Verify completion
        expect(receivedEvents).toHaveLength(operationCount);
        
        // Verify cache performance
        const cacheStats = await cacheService.getStats();
        expect(cacheStats.operations.sets).toBeGreaterThanOrEqual(operationCount);
        
        // Performance should be reasonable
        expect(totalTime).toBeLessThan(30000); // 30 seconds max for 100 operations
      });
    });

    describe('Memory Usage Monitoring', () => {
      it('should monitor memory usage during intensive operations', async () => {
        // Get baseline
        const baselineStats = await cacheService.getStats();
        const baselineMemory = baselineStats.memory.used;

        // Generate large cache data
        const largeData = { content: 'x'.repeat(10000) }; // 10KB per item
        for (let i = 0; i < 50; i++) {
          await cacheService.set(`memory-test-${i}`, largeData, 300);
        }

        // Publish some events
        for (let i = 0; i < 10; i++) {
          await eventsService.publishProjectCreated({
            projectId: `memory-event-${i}`,
            ownerId: 'memory-user',
            name: `Memory Test ${i}`,
            description: 'x'.repeat(5000), // 5KB description
            initialPrompt: 'y'.repeat(10000), // 10KB prompt
            uploadedFileIds: [],
            hasUploadedFiles: false,
            promptComplexity: 'medium',
            createdAt: new Date(),
          });
        }

        const finalStats = await cacheService.getStats();
        const memoryIncrease = finalStats.memory.used - baselineMemory;

        console.log(`Memory increase: ${memoryIncrease} bytes`);
        console.log(`Cache operations: ${finalStats.operations.sets} sets, ${finalStats.operations.hits} hits`);

        // Memory should have increased due to cached data
        expect(memoryIncrease).toBeGreaterThan(0);
        
        // Events should have been processed
        expect(receivedEvents).toHaveLength(10);
      });
    });
  });

  describe('Real-World Usage Patterns', () => {
    describe('User Session Simulation', () => {
      it('should simulate a complete user session with mixed operations', async () => {
        const userId = 'session-user-123';
        const sessionId = 'session-abc-789';

        // 1. User login - cache session
        const sessionData = {
          userId,
          roles: ['user'],
          loginTime: new Date(),
        };
        await cacheService.set(
          cacheService.getUserSessionKey(userId, sessionId),
          sessionData,
          1800 // 30 minutes
        );

        // 2. User creates project
        const project1 = {
          id: 'session-project-1',
          ownerId: userId,
          name: 'Session Project 1',
        };
        
        await cacheService.set(cacheService.getProjectKey(project1.id), project1);
        await eventsService.publishProjectCreated({
          projectId: project1.id,
          ownerId: userId,
          name: project1.name,
          description: 'First project in session',
          initialPrompt: 'Create first project',
          uploadedFileIds: [],
          hasUploadedFiles: false,
          promptComplexity: 'low',
          createdAt: new Date(),
        });

        // 3. User creates second project
        const project2 = {
          id: 'session-project-2',
          ownerId: userId,
          name: 'Session Project 2',
        };

        await cacheService.set(cacheService.getProjectKey(project2.id), project2);
        await eventsService.publishProjectCreated({
          projectId: project2.id,
          ownerId: userId,
          name: project2.name,
          description: 'Second project in session',
          initialPrompt: 'Create second project',
          uploadedFileIds: ['uploaded-spec.pdf'],
          hasUploadedFiles: true,
          promptComplexity: 'medium',
          createdAt: new Date(),
        });

        // 4. User updates first project
        await cacheService.invalidateProjectCache(project1.id, userId);
        await eventsService.publishProjectUpdated({
          projectId: project1.id,
          ownerId: userId,
          changes: { name: 'Updated Session Project 1' },
          modifiedFields: ['name'],
          updatedAt: new Date(),
        });

        // 5. Cache user's project list
        await cacheService.set(
          cacheService.getProjectListKey(userId, 1, 10),
          [project1, project2]
        );

        // 6. User logs out - invalidate session caches
        await cacheService.invalidateUserProjectsCache(userId);

        // Verify session flow
        expect(receivedEvents).toHaveLength(3); // 2 creates + 1 update

        // Session cache should be gone
        expect(await cacheService.get(
          cacheService.getUserSessionKey(userId, sessionId)
        )).toBeNull();

        // Project list cache should be gone  
        expect(await cacheService.get(
          cacheService.getProjectListKey(userId, 1, 10)
        )).toBeNull();

        // Individual project caches should remain (not part of user cache patterns)
        expect(await cacheService.get(cacheService.getProjectKey(project1.id))).not.toBeNull();
        expect(await cacheService.get(cacheService.getProjectKey(project2.id))).not.toBeNull();
      });
    });

    describe('Pagination and Filtering Integration', () => {
      it('should handle complex filtering with cache and events', async () => {
        const userId = 'filter-user';
        const projects = [
          { id: 'p1', status: ProjectStatus.ACTIVE, hasFiles: true, createdAt: new Date('2025-01-01') },
          { id: 'p2', status: ProjectStatus.ACTIVE, hasFiles: false, createdAt: new Date('2025-02-01') },
          { id: 'p3', status: ProjectStatus.ARCHIVED, hasFiles: true, createdAt: new Date('2025-03-01') },
          { id: 'p4', status: ProjectStatus.ACTIVE, hasFiles: true, createdAt: new Date('2025-04-01') },
        ];

        // Cache different filtered views
        const activeProjects = projects.filter(p => p.status === ProjectStatus.ACTIVE);
        const projectsWithFiles = projects.filter(p => p.hasFiles);
        const activeWithFiles = projects.filter(p => 
          p.status === ProjectStatus.ACTIVE && p.hasFiles
        );

        await cacheService.set(
          cacheService.getProjectListKey(userId, 1, 10, { status: ProjectStatus.ACTIVE }),
          activeProjects
        );

        await cacheService.set(
          cacheService.getProjectListKey(userId, 1, 10, { hasFiles: true }),
          projectsWithFiles
        );

        await cacheService.set(
          cacheService.getProjectListKey(userId, 1, 10, { 
            status: ProjectStatus.ACTIVE, 
            hasFiles: true 
          }),
          activeWithFiles
        );

        // Publish events for project status changes
        await eventsService.publishProjectArchived({
          projectId: 'p1', // Change p1 from active to archived
          ownerId: userId,
          previousStatus: 'ACTIVE',
          archivedAt: new Date(),
        });

        // Simulate cache invalidation triggered by the archived event
        await cacheService.invalidateUserProjectsCache(userId);

        // Verify all filtered caches were invalidated
        expect(await cacheService.get(
          cacheService.getProjectListKey(userId, 1, 10, { status: ProjectStatus.ACTIVE })
        )).toBeNull();

        expect(await cacheService.get(
          cacheService.getProjectListKey(userId, 1, 10, { hasFiles: true })
        )).toBeNull();

        expect(await cacheService.get(
          cacheService.getProjectListKey(userId, 1, 10, { 
            status: ProjectStatus.ACTIVE, 
            hasFiles: true 
          })
        )).toBeNull();

        // Verify event was published
        expect(receivedEvents).toHaveLength(1);
        expect(receivedEvents[0].body.payload.previousStatus).toBe('ACTIVE');
      });
    });
  });

  describe('Error Recovery Integration', () => {
    it('should handle partial failures gracefully', async () => {
      const project = { id: 'partial-failure-test', name: 'Partial Failure' };

      // 1. Cache operation succeeds
      await cacheService.set('partial-test', project);

      // 2. Break events temporarily
      await new Promise(resolve => mockOrchestrator.close(resolve));

      // 3. Event operation fails but doesn't affect cache
      await expect(eventsService.publishProjectCreated({
        projectId: project.id,
        ownerId: 'partial-user',
        name: project.name,
        description: 'Partial failure test',
        initialPrompt: 'Test partial failures',
        uploadedFileIds: [],
        hasUploadedFiles: false,
        promptComplexity: 'low',
        createdAt: new Date(),
      })).rejects.toThrow();

      // 4. Cache should still work
      const cached = await cacheService.get('partial-test');
      expect(cached).toEqual(project);

      // 5. Restore events service
      const app = express();
      app.use(express.json());
      app.post('/events/project/created', (req, res) => {
        receivedEvents.push({ type: 'created', body: req.body });
        res.json({ received: true });
      });
      app.get('/health', (req, res) => res.json({ status: 'healthy' }));
      mockOrchestrator = app.listen(3335);

      await new Promise(resolve => setTimeout(resolve, 500));

      // 6. Events should work again
      await eventsService.publishProjectCreated({
        projectId: 'recovery-project',
        ownerId: 'recovery-user',
        name: 'Recovery Test',
        description: 'Test recovery',
        initialPrompt: 'Test service recovery',
        uploadedFileIds: [],
        hasUploadedFiles: false,
        promptComplexity: 'low',
        createdAt: new Date(),
      });

      expect(receivedEvents).toHaveLength(1);
    });
  });

  describe('Configuration Environment Testing', () => {
    it('should respect environment-specific configurations', async () => {
      // Test environment should have short TTLs and fast timeouts
      const testValue = { data: 'environment test' };
      
      await cacheService.set('env-test', testValue, undefined); // Use default TTL
      
      // Check TTL is short for test environment
      const ttl = await redis.ttl('e2e-test:env-test');
      expect(ttl).toBeLessThanOrEqual(300); // Test env should have short TTL
      
      // Events should use test configuration (short timeout)
      const healthStart = Date.now();
      await eventsService.healthCheck();
      const healthDuration = Date.now() - healthStart;
      
      expect(healthDuration).toBeLessThan(1000); // Should be fast in test env
    });
  });

  describe('Data Consistency Verification', () => {
    it('should maintain consistency between cache and events during complex flows', async () => {
      const userId = 'consistency-user';
      const projectId = 'consistency-project';
      
      // Complex flow: create → update → add files → archive → delete
      const operations = [
        {
          name: 'create',
          cacheOp: () => cacheService.set(cacheService.getProjectKey(projectId), {
            id: projectId, status: 'ACTIVE', files: []
          }),
          eventOp: () => eventsService.publishProjectCreated({
            projectId, ownerId: userId, name: 'Consistency Test',
            description: 'Test', initialPrompt: 'Test', uploadedFileIds: [],
            hasUploadedFiles: false, promptComplexity: 'low', createdAt: new Date()
          }),
        },
        {
          name: 'update',
          cacheOp: () => cacheService.invalidateProjectCache(projectId, userId),
          eventOp: () => eventsService.publishProjectUpdated({
            projectId, ownerId: userId, changes: { name: 'Updated' },
            modifiedFields: ['name'], updatedAt: new Date()
          }),
        },
        {
          name: 'delete',
          cacheOp: () => cacheService.invalidateProjectCache(projectId, userId),
          eventOp: () => eventsService.publishProjectDeleted({
            projectId, ownerId: userId, previousStatus: 'ACTIVE',
            hadGeneratedFiles: false, fileCount: { uploaded: 0, generated: 0, total: 0 },
            deletedAt: new Date()
          }),
        },
      ];

      // Execute operations in sequence
      for (const operation of operations) {
        await Promise.all([
          operation.cacheOp(),
          operation.eventOp(),
        ]);
        
        // Small delay between operations
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Verify final state consistency
      expect(receivedEvents).toHaveLength(3);
      expect(receivedEvents.map(e => e.type)).toEqual(['created', 'updated', 'deleted']);

      // Cache should be clean after deletion
      expect(await cacheService.get(cacheService.getProjectKey(projectId))).toBeNull();
    });
  });
});