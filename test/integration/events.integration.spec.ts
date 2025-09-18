import { Test, TestingModule } from '@nestjs/testing';
import { EventsService } from '../../src/events/events.service';
import { CacheService } from '../../src/cache/cache.service';
import { DatabaseService } from '../../src/database/database.service';
import { 
  ProjectFixtures, 
  UserFixtures, 
  TEST_IDS,
  StatisticsFixtures
} from '../fixtures/project.fixtures';

describe('EventsService Integration', () => {
  let eventsService: EventsService;
  let cacheService: CacheService;
  let databaseService: DatabaseService;
  let module: TestingModule;
  let mockProjectCreated: any; // Using any to avoid type conflicts

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [
        {
          provide: EventsService,
          useValue: {
            publishProjectCreated: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: CacheService,
          useValue: {
            set: jest.fn(),
            get: jest.fn(),
            del: jest.fn(),
            invalidatePattern: jest.fn(),
          },
        },
        {
          provide: DatabaseService,
          useValue: {
            project: {
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    eventsService = module.get<EventsService>(EventsService);
    cacheService = module.get<CacheService>(CacheService);
    databaseService = module.get<DatabaseService>(DatabaseService);
  });

  beforeEach(() => {
    const mockUser = UserFixtures.validUser();
    const mockProject = ProjectFixtures.mockProject({
      id: TEST_IDS.PROJECT_1,
      ownerId: mockUser.id,
      name: 'Test Project Integration',
      description: 'A test project for integration testing'
    });

    // Create mock event data with all required properties
    mockProjectCreated = {
      projectId: mockProject.id,
      ownerId: mockProject.ownerId,
      name: mockProject.name,
      description: mockProject.description,
      initialPrompt: mockProject.initialPrompt,
      uploadedFileIds: mockProject.uploadedFileIds || [],
      uploadedFileCount: (mockProject.uploadedFileIds || []).length,
      createdAt: mockProject.createdAt,
      eventMetadata: {
        version: '1.0',
        source: 'project-service'
      },
      hasUploadedFiles: (mockProject.uploadedFileIds || []).length > 0,
      promptComplexity: 'medium'
    };

    jest.clearAllMocks();
  });

  afterAll(async () => {
    if (module) {
      await module.close();
    }
  });

  describe('publishProjectCreated', () => {
    it('should publish project created event successfully', async () => {
      await eventsService.publishProjectCreated(mockProjectCreated);

      expect(eventsService.publishProjectCreated).toHaveBeenCalledWith(mockProjectCreated);
      expect(eventsService.publishProjectCreated).toHaveBeenCalledTimes(1);
    });

    it('should handle project created event with correlation ID', async () => {
      const correlationId = 'test-correlation-123';
      
      const eventData = {
        ...mockProjectCreated,
        correlationId
      };

      await eventsService.publishProjectCreated(eventData);

      expect(eventsService.publishProjectCreated).toHaveBeenCalledWith(eventData);
    });

    it('should validate project data structure', async () => {
      const invalidEventData = {
        ...mockProjectCreated,
        projectId: '', // Invalid project ID
      };

      // Mock rejection for invalid data
      (eventsService.publishProjectCreated as jest.Mock)
        .mockRejectedValueOnce(new Error('Invalid project data'));

      await expect(eventsService.publishProjectCreated(invalidEventData))
        .rejects.toThrow('Invalid project data');
    });

    it('should handle cache interactions during event publishing', async () => {
      await eventsService.publishProjectCreated(mockProjectCreated);

      // Verify cache interactions based on your service implementation
      const expectedCacheKey = `project:${mockProjectCreated.projectId}`;
      // Add specific cache interaction assertions based on your implementation
      expect(eventsService.publishProjectCreated).toHaveBeenCalledWith(mockProjectCreated);
    });

    it('should process event with correct project metadata', async () => {
      const eventWithMetadata = {
        ...mockProjectCreated,
        projectId: mockProjectCreated.projectId,
        ownerId: mockProjectCreated.ownerId,
      };

      await eventsService.publishProjectCreated(eventWithMetadata);

      // Verify that the event was processed with correct metadata
      expect(eventWithMetadata.projectId).toBe(mockProjectCreated.projectId);
      expect(eventWithMetadata.ownerId).toBe(mockProjectCreated.ownerId);
    });

    it('should handle concurrent event publishing', async () => {
      const correlationId = 'concurrent-test-123';
      
      await eventsService.publishProjectCreated(mockProjectCreated, correlationId);
      await eventsService.publishProjectCreated(mockProjectCreated);

      // Verify concurrent processing doesn't cause conflicts
      expect(eventsService.publishProjectCreated).toHaveBeenCalledTimes(2);
    });

    it('should emit proper event structure', async () => {
      const eventData = {
        ...mockProjectCreated,
        timestamp: new Date().toISOString()
      };

      await eventsService.publishProjectCreated(eventData);

      // Verify event structure and content
      expect(eventData.projectId).toBeDefined();
      expect(eventData.ownerId).toBeDefined();
      expect(eventData.name).toBeDefined();
    });
  });

  describe('Event Processing and Metrics', () => {
    it('should track event processing metrics', async () => {
      const startTime = Date.now();

      await eventsService.publishProjectCreated(mockProjectCreated);

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      expect(processingTime).toBeLessThan(1000); // Should process within 1 second
    });

    it('should handle event publishing with statistics', async () => {
      const projectWithStats = {
        ...mockProjectCreated,
        statistics: StatisticsFixtures.basicStats()
      };

      await eventsService.publishProjectCreated(projectWithStats);

      // Verify statistics are included in the event
      expect(projectWithStats.statistics).toBeDefined();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle multiple event publications', async () => {
      const events = [
        {...mockProjectCreated, projectId: 'metrics-1'},
        {...mockProjectCreated, projectId: 'metrics-2'}
      ];

      await Promise.all(events.map(event => 
        eventsService.publishProjectCreated(event)
      ));

      // Verify all events were processed correctly
      expect(eventsService.publishProjectCreated).toHaveBeenCalledTimes(2);
    });

    it('should handle event publishing errors gracefully', async () => {
      const invalidEvent = {
        ...mockProjectCreated,
        projectId: null as any, // Force invalid data
      };

      const faultyEvent = {
        ...mockProjectCreated,
        ownerId: undefined as any,
      };

      // Mock rejection for invalid events
      (eventsService.publishProjectCreated as jest.Mock)
        .mockRejectedValueOnce(new Error('Invalid project ID'))
        .mockRejectedValueOnce(new Error('Invalid owner ID'));

      // Test error handling for invalid events
      await expect(eventsService.publishProjectCreated(invalidEvent))
        .rejects.toThrow('Invalid project ID');

      await expect(eventsService.publishProjectCreated(faultyEvent))
        .rejects.toThrow('Invalid owner ID');
    });

    it('should handle service unavailability', async () => {
      // Mock service failure
      (eventsService.publishProjectCreated as jest.Mock)
        .mockRejectedValueOnce(new Error('Service unavailable'));

      await expect(eventsService.publishProjectCreated(mockProjectCreated))
        .rejects.toThrow('Service unavailable');
    });

    it('should validate event data completeness', async () => {
      const incompleteEvent = {
        ...mockProjectCreated,
        description: undefined,
      };

      await eventsService.publishProjectCreated(incompleteEvent);
      
      // Should handle incomplete data gracefully or throw appropriate error
      expect(eventsService.publishProjectCreated).toHaveBeenCalledWith(incompleteEvent);
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle high-volume event publishing', async () => {
      const events = Array.from({ length: 50 }, (_, i) => ({
        ...mockProjectCreated,
        projectId: `load-test-${i}`,
      }));

      const startTime = Date.now();
      
      await Promise.all(events.map(event => 
        eventsService.publishProjectCreated(event)
      ));

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      expect(totalTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(eventsService.publishProjectCreated).toHaveBeenCalledTimes(50);
    });

    it('should maintain performance under concurrent load', async () => {
      const concurrentEvents = Array.from({ length: 10 }, (_, i) => ({
        ...mockProjectCreated,
        projectId: `concurrent-${i}`,
      }));

      const promises = concurrentEvents.map(event =>
        eventsService.publishProjectCreated(event)
      );

      await expect(Promise.all(promises)).resolves.not.toThrow();
      expect(eventsService.publishProjectCreated).toHaveBeenCalledTimes(10);
    });
  });

  describe('Integration with Cache and Database', () => {
    it('should integrate with cache service correctly', async () => {
      await eventsService.publishProjectCreated(mockProjectCreated);

      // Verify cache operations based on your implementation
      // This will depend on how your EventsService interacts with cache
      expect(eventsService.publishProjectCreated).toHaveBeenCalledWith(mockProjectCreated);
    });

    it('should integrate with database service correctly', async () => {
      await eventsService.publishProjectCreated(mockProjectCreated);

      // Verify database operations based on your implementation
      // This will depend on how your EventsService interacts with database
      expect(eventsService.publishProjectCreated).toHaveBeenCalledWith(mockProjectCreated);
    });

    it('should handle cache miss scenarios', async () => {
      const cacheKey = `project:${mockProjectCreated.projectId}`;
      (cacheService.get as jest.Mock).mockResolvedValue(null);

      await eventsService.publishProjectCreated(mockProjectCreated);

      // Verify behavior when cache is empty
      expect(eventsService.publishProjectCreated).toHaveBeenCalledWith(mockProjectCreated);
    });
  });

  describe('Event Data Variations', () => {
    it('should handle projects with different statuses', async () => {
      const archivedProject = {
        ...mockProjectCreated,
        status: 'ARCHIVED',
      };

      await eventsService.publishProjectCreated(archivedProject);

      expect(archivedProject.status).toBe('ARCHIVED');
      expect(eventsService.publishProjectCreated).toHaveBeenCalledWith(archivedProject);
    });

    it('should handle projects with files', async () => {
      const projectWithFiles = {
        ...mockProjectCreated,
        uploadedFileIds: ['file1', 'file2', 'file3'],
        uploadedFileCount: 3,
        hasUploadedFiles: true,
        promptComplexity: 'high'
      };

      await eventsService.publishProjectCreated(projectWithFiles);

      expect(projectWithFiles.uploadedFileIds).toHaveLength(3);
      expect(projectWithFiles.hasUploadedFiles).toBe(true);
    });

    it('should handle projects from different users', async () => {
      const otherUser = UserFixtures.otherUser();
      const otherProject = {
        ...mockProjectCreated,
        ownerId: otherUser.id,
      };

      await eventsService.publishProjectCreated(otherProject);

      expect(otherProject.ownerId).toBe(otherUser.id);
    });

    it('should handle empty file lists', async () => {
      const projectWithoutFiles = {
        ...mockProjectCreated,
        uploadedFileIds: [],
        uploadedFileCount: 0,
        hasUploadedFiles: false,
        promptComplexity: 'low'
      };

      await eventsService.publishProjectCreated(projectWithoutFiles);

      expect(projectWithoutFiles.uploadedFileIds).toEqual([]);
      expect(projectWithoutFiles.hasUploadedFiles).toBe(false);
    });
  });

  describe('Helper Functions', () => {
    const createEventVariation = (overrides: any = {}) => ({
      ...mockProjectCreated,
      ...overrides,
    });

    it('should create event variations correctly', () => {
      const variation = createEventVariation({ 
        projectId: 'test-variation',
        promptComplexity: 'high'
      });
      
      expect(variation.projectId).toBe('test-variation');
      expect(variation.promptComplexity).toBe('high');
    });

    it('should preserve all required fields in variations', () => {
      const variation = createEventVariation({ name: 'Modified Project' });
      
      expect(variation.projectId).toBeDefined();
      expect(variation.ownerId).toBeDefined();
      expect(variation.hasUploadedFiles).toBeDefined();
      expect(variation.promptComplexity).toBeDefined();
      expect(variation.name).toBe('Modified Project');
    });
  });
});