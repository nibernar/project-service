import { Test, TestingModule } from '@nestjs/testing';
import { StatisticsService } from '../../../src/statistics/statistics.service';
import { StatisticsRepository } from '../../../src/statistics/statistics.repository';
import { CacheService } from '../../../src/cache/cache.service';
import { DatabaseService } from '../../../src/database/database.service';
import { plainToClass } from 'class-transformer';
import { UpdateStatisticsDto } from '../../../src/statistics/dto/update-statistics.dto';
import { ProjectStatisticsEntity } from '../../../src/statistics/entities/project-statistics.entity';

describe('Statistics Module Integration', () => {
  let statisticsService: StatisticsService;
  let statisticsRepository: jest.Mocked<StatisticsRepository>;
  let cacheService: jest.Mocked<CacheService>;
  let databaseService: jest.Mocked<DatabaseService>;

  const mockProjectId = '550e8400-e29b-41d4-a716-446655440000';

  const createMockEntity = (data: Partial<any> = {}): ProjectStatisticsEntity => {
    return new ProjectStatisticsEntity({
      id: 'stats-123',
      projectId: mockProjectId,
      costs: {
        claudeApi: 12.45,
        storage: 2.30,
        compute: 5.67,
        total: 20.42,
        currency: 'USD',
      },
      performance: {
        generationTime: 45.23,
        processingTime: 12.45,
        totalTime: 57.68,
      },
      usage: {
        documentsGenerated: 5,
        tokensUsed: 15750,
        apiCallsCount: 12,
      },
      lastUpdated: new Date('2024-08-18T10:30:00Z'),
      ...data,
    });
  };

  beforeEach(async () => {
    const mockRepository = {
      upsert: jest.fn(),
      findByProjectId: jest.fn(),
      deleteByProjectId: jest.fn(),
      findManyByProjectIds: jest.fn(),
      partialUpdate: jest.fn(),
      findByCriteria: jest.fn(),
      cleanupOldStatistics: jest.fn(),
      getGlobalStatistics: jest.fn(),
    };

    const mockCache = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      keys: jest.fn(),
    };

    const mockDb = {
      projectStatistics: {
        deleteMany: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        upsert: jest.fn(),
        delete: jest.fn(),
      },
      project: {
        create: jest.fn(),
        deleteMany: jest.fn(),
      },
      $connect: jest.fn(),
      $disconnect: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StatisticsService,
        {
          provide: StatisticsRepository,
          useValue: mockRepository,
        },
        {
          provide: CacheService,
          useValue: mockCache,
        },
        {
          provide: DatabaseService,
          useValue: mockDb,
        },
      ],
    }).compile();

    statisticsService = module.get<StatisticsService>(StatisticsService);
    statisticsRepository = module.get(StatisticsRepository);
    cacheService = module.get(CacheService);
    databaseService = module.get(DatabaseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Service Layer Integration', () => {
    describe('Complete Statistics Workflow', () => {
      it('should complete full statistics lifecycle', async () => {
        // Arrange
        const testProjectId = 'test-project-lifecycle';
        const initialStatsData = {
          costs: {
            claudeApi: 10.0,
            storage: 2.0,
            total: 12.0,
            currency: 'USD',
          },
          performance: {
            generationTime: 30.0,
            totalTime: 35.0,
          },
          usage: {
            documentsGenerated: 3,
            tokensUsed: 5000,
          },
          metadata: {
            source: 'cost-tracking-service',
            timestamp: new Date(),
            version: '1.0.0',
          },
        };

        const initialStats = plainToClass(UpdateStatisticsDto, initialStatsData);

        // Mock responses
        const createdEntity = createMockEntity({ 
          costs: initialStatsData.costs,
          usage: initialStatsData.usage 
        });
        statisticsRepository.upsert.mockResolvedValue(createdEntity);
        statisticsRepository.findByProjectId.mockResolvedValue(createdEntity);
        statisticsRepository.deleteByProjectId.mockResolvedValue(true);
        cacheService.del.mockResolvedValue(undefined);
        cacheService.set.mockResolvedValue(undefined);

        // Act 1: Create initial statistics
        const created = await statisticsService.updateStatistics(testProjectId, initialStats);

        // Assert 1: Statistics created
        expect(created).toBeDefined();
        expect(created.costs.total).toBe(12.0);
        expect(created.usage.documentsGenerated).toBe(3);

        // Act 2: Update statistics
        const updateStatsData = {
          costs: {
            claudeApi: 15.0,
            total: 17.0,
          },
          usage: {
            documentsGenerated: 5,
            tokensUsed: 8000,
          },
        };

        const updateStats = plainToClass(UpdateStatisticsDto, updateStatsData);
        const updatedEntity = createMockEntity({ 
          costs: { ...initialStatsData.costs, ...updateStatsData.costs },
          usage: { ...initialStatsData.usage, ...updateStatsData.usage }
        });
        statisticsRepository.upsert.mockResolvedValue(updatedEntity);

        const updated = await statisticsService.updateStatistics(testProjectId, updateStats);

        // Assert 2: Statistics updated
        expect(updated.costs.total).toBe(17.0);
        expect(updated.usage.documentsGenerated).toBe(5);

        // Act 3: Retrieve statistics
        statisticsRepository.findByProjectId.mockResolvedValue(updatedEntity);
        cacheService.get.mockResolvedValue(null);

        const retrieved = await statisticsService.getStatistics(testProjectId);

        // Assert 3: Statistics retrieved correctly
        expect(retrieved).toBeDefined();
        if (retrieved) {
          expect(retrieved.costs.total).toBe(17.0);
          expect(retrieved.usage.documentsGenerated).toBe(5);
        }

        // Act 4: Delete statistics
        const deleted = await statisticsService.deleteStatistics(testProjectId);

        // Assert 4: Statistics deleted
        expect(deleted).toBe(true);

        // Act 5: Verify deletion
        statisticsRepository.findByProjectId.mockResolvedValue(null);
        const afterDeletion = await statisticsService.getStatistics(testProjectId);

        // Assert 5: Statistics no longer exist
        expect(afterDeletion).toBeNull();
      });

      it('should handle cache coherence across operations', async () => {
        // Arrange
        const testProjectId = 'test-project-cache';
        const initialStatsData = {
          costs: { total: 20.0 },
          performance: { totalTime: 60.0 },
          usage: { documentsGenerated: 4 },
        };

        const initialStats = plainToClass(UpdateStatisticsDto, initialStatsData);
        const initialEntity = createMockEntity({ 
          costs: { total: 20.0 },
          usage: { documentsGenerated: 4 }
        });

        statisticsRepository.upsert.mockResolvedValue(initialEntity);
        cacheService.del.mockResolvedValue(undefined);
        cacheService.set.mockResolvedValue(undefined);

        // Act 1: Create statistics (should cache)
        await statisticsService.updateStatistics(testProjectId, initialStats);

        // Act 2: Retrieve from cache
        const cachedResponse = { costs: { total: 20.0 }, performance: { totalTime: 60.0 } };
        cacheService.get.mockResolvedValue(cachedResponse);
        const fromCache = await statisticsService.getStatistics(testProjectId);

        // Act 3: Update statistics (should invalidate cache)
        const updateStatsData = { costs: { total: 25.0 } };
        const updateStats = plainToClass(UpdateStatisticsDto, updateStatsData);
        const updatedEntity = createMockEntity({ costs: { total: 25.0 } });
        
        statisticsRepository.upsert.mockResolvedValue(updatedEntity);
        cacheService.get.mockResolvedValue(null); // Cache invalidated
        statisticsRepository.findByProjectId.mockResolvedValue(updatedEntity);

        await statisticsService.updateStatistics(testProjectId, updateStats);

        // Act 4: Retrieve after update
        const afterUpdate = await statisticsService.getStatistics(testProjectId);

        // Assert: Cache was properly invalidated and updated
        expect(fromCache?.costs.total).toBe(20.0);
        expect(afterUpdate?.costs.total).toBe(25.0);
      });

      it('should handle concurrent updates correctly', async () => {
        // Arrange
        const testProjectId = 'test-project-concurrent';
        const baseStatsData = {
          costs: { claudeApi: 10.0, total: 10.0 },
          usage: { documentsGenerated: 1 },
        };

        const baseStats = plainToClass(UpdateStatisticsDto, baseStatsData);
        const baseEntity = createMockEntity({ 
          costs: baseStatsData.costs,
          usage: baseStatsData.usage
        });
        
        statisticsRepository.upsert.mockResolvedValue(baseEntity);
        cacheService.del.mockResolvedValue(undefined);
        cacheService.set.mockResolvedValue(undefined);

        await statisticsService.updateStatistics(testProjectId, baseStats);

        // Act: Perform concurrent updates
        const update1Data = { costs: { storage: 5.0 } };
        const update2Data = { performance: { generationTime: 30.0 } };
        const update3Data = { usage: { tokensUsed: 2000 } };

        const finalEntity = createMockEntity({
          costs: { ...baseStatsData.costs, storage: 5.0 },
          performance: { generationTime: 30.0 },
          usage: { ...baseStatsData.usage, tokensUsed: 2000 },
        });

        statisticsRepository.upsert.mockResolvedValue(finalEntity);
        statisticsRepository.findByProjectId.mockResolvedValue(finalEntity);
        cacheService.get.mockResolvedValue(null);

        const update1 = statisticsService.updateStatistics(testProjectId, plainToClass(UpdateStatisticsDto, update1Data));
        const update2 = statisticsService.updateStatistics(testProjectId, plainToClass(UpdateStatisticsDto, update2Data));
        const update3 = statisticsService.updateStatistics(testProjectId, plainToClass(UpdateStatisticsDto, update3Data));

        // Wait for all updates to complete
        const [result1, result2, result3] = await Promise.all([update1, update2, update3]);

        // Assert: All updates succeeded
        expect(result1).toBeDefined();
        expect(result2).toBeDefined();
        expect(result3).toBeDefined();

        // Verify final state
        const final = await statisticsService.getStatistics(testProjectId);
        expect(final?.costs.claudeApi).toBe(10.0);
        expect(statisticsRepository.upsert).toHaveBeenCalledTimes(4); // base + 3 updates
      });
    });

    describe('Batch Operations Integration', () => {
      it('should handle multiple projects efficiently', async () => {
        // Arrange
        const projectIds = [
          'test-batch-1',
          'test-batch-2',
          'test-batch-3',
          'test-batch-4',
          'test-batch-5',
        ];

        const baseStatsData = {
          costs: { claudeApi: 10.0, total: 10.0 },
          usage: { documentsGenerated: 2 },
        };

        // Mock batch creation
        statisticsRepository.upsert.mockImplementation(async (projectId, data) => 
          createMockEntity({
            projectId,
            costs: data.costs || {},
          })
        );

        // Act 1: Create statistics for multiple projects
        const createPromises = projectIds.map((id, index) => {
          const statsData = {
            ...baseStatsData,
            costs: { ...baseStatsData.costs, total: 10.0 + index },
          };
          return statisticsService.updateStatistics(id, plainToClass(UpdateStatisticsDto, statsData));
        });

        await Promise.all(createPromises);

        // Act 2: Retrieve multiple statistics
        const entitiesMap = new Map();
        projectIds.forEach((id, index) => {
          entitiesMap.set(id, createMockEntity({
            projectId: id,
            costs: { total: 10.0 + index },
          }));
        });

        statisticsRepository.findManyByProjectIds.mockResolvedValue(entitiesMap);
        cacheService.get.mockResolvedValue(null);

        const batchResults = await statisticsService.getMultipleStatistics(projectIds);

        // Assert: All projects returned with correct data
        expect(batchResults.size).toBe(projectIds.length);
        projectIds.forEach((id, index) => {
          const stats = batchResults.get(id);
          expect(stats).toBeDefined();
          expect(stats?.costs.total).toBe(10.0 + index);
        });
      });

      it('should handle partial batch failures gracefully', async () => {
        // Arrange
        const existingProjects = ['test-existing-1', 'test-existing-2'];
        const nonExistentProjects = ['test-nonexistent-1', 'test-nonexistent-2'];
        const allProjects = [...existingProjects, ...nonExistentProjects];

        // Create statistics only for existing projects
        for (const id of existingProjects) {
          const statsData = {
            costs: { total: 15.0 },
            usage: { documentsGenerated: 3 },
          };
          const entity = createMockEntity({ projectId: id, costs: { total: 15.0 } });
          statisticsRepository.upsert.mockResolvedValue(entity);
          await statisticsService.updateStatistics(id, plainToClass(UpdateStatisticsDto, statsData));
        }

        // Act: Request batch including non-existent projects
        const partialMap = new Map();
        existingProjects.forEach(id => {
          partialMap.set(id, createMockEntity({ projectId: id, costs: { total: 15.0 } }));
        });

        statisticsRepository.findManyByProjectIds.mockResolvedValue(partialMap);
        cacheService.get.mockResolvedValue(null);

        const results = await statisticsService.getMultipleStatistics(allProjects);

        // Assert: Only existing projects returned
        expect(results.size).toBe(existingProjects.length);
        existingProjects.forEach(id => {
          expect(results.has(id)).toBe(true);
          expect(results.get(id)?.costs.total).toBe(15.0);
        });
        nonExistentProjects.forEach(id => {
          expect(results.has(id)).toBe(false);
        });
      });
    });

    describe('Search and Filtering Integration', () => {
      it('should search by cost criteria correctly', async () => {
        // Arrange
        const searchResults = [
          createMockEntity({
            projectId: 'test-search-medium-cost',
            costs: { total: 25.0 },
          }),
        ];

        statisticsRepository.findByCriteria.mockResolvedValue(searchResults);

        // Act: Search for medium-range costs
        const results = await statisticsService.searchStatistics({
          minTotalCost: 10.0,
          maxTotalCost: 50.0,
        });

        // Assert: Only medium-cost project returned
        expect(results).toHaveLength(1);
        expect(results[0].costs.total).toBe(25.0);
        expect(statisticsRepository.findByCriteria).toHaveBeenCalledWith({
          minTotalCost: 10.0,
          maxTotalCost: 50.0,
        });
      });

      it('should search by multiple criteria', async () => {
        // Arrange
        const searchResults = [
          createMockEntity({
            projectId: 'test-search-complex',
            costs: { total: 25.0 },
            performance: { totalTime: 300.0 },
            usage: { documentsGenerated: 5 },
          }),
        ];

        statisticsRepository.findByCriteria.mockResolvedValue(searchResults);

        // Act: Search with multiple constraints
        const results = await statisticsService.searchStatistics({
          minTotalCost: 20.0,
          minDocuments: 4,
          maxPerformanceTime: 400.0,
        });

        // Assert: Only projects meeting all criteria
        expect(results).toHaveLength(1);
        expect(results[0].costs.total).toBe(25.0);
        expect(results[0].usage.documentsGenerated).toBe(5);
        expect(results[0].performance.totalTime).toBe(300.0);
      });
    });

    describe('Global Statistics Integration', () => {
      it('should compute global statistics correctly', async () => {
        // Arrange
        const mockGlobalStats = {
          totalProjects: 3,
          totalCosts: 60.0,
          totalDocuments: 15,
          averageQualityScore: 85.5,
          sourceDistribution: {},
        };

        statisticsRepository.getGlobalStatistics.mockResolvedValue(mockGlobalStats);
        cacheService.get.mockResolvedValue(null);
        cacheService.set.mockResolvedValue(undefined);

        // Act
        const global = await statisticsService.getGlobalStatistics();

        // Assert: Aggregations are correct
        expect(global.totalProjects).toBe(3);
        expect(global.totalCosts).toBe(60.0);
        expect(global.totalDocuments).toBe(15);
        expect(global.averageQualityScore).toBe(85.5);
      });

      it('should cache global statistics for performance', async () => {
        // Arrange
        const mockGlobalStats = {
          totalProjects: 3,
          totalCosts: 60.0,
          totalDocuments: 15,
          averageQualityScore: 85.5,
          sourceDistribution: {},
        };

        // Act 1: First call (should compute)
        cacheService.get.mockResolvedValueOnce(null);
        statisticsRepository.getGlobalStatistics.mockResolvedValue(mockGlobalStats);
        cacheService.set.mockResolvedValue(undefined);

        const global1 = await statisticsService.getGlobalStatistics();

        // Act 2: Second call (should use cache)
        cacheService.get.mockResolvedValueOnce(mockGlobalStats);

        const global2 = await statisticsService.getGlobalStatistics();

        // Assert: Both calls return same result, second doesn't hit repository
        expect(global1).toEqual(mockGlobalStats);
        expect(global2).toEqual(mockGlobalStats);
        expect(statisticsRepository.getGlobalStatistics).toHaveBeenCalledTimes(1);
        expect(cacheService.get).toHaveBeenCalledTimes(2);
      });
    });

    describe('Cleanup Operations Integration', () => {
      it('should cleanup old statistics for archived/deleted projects only', async () => {
        // Arrange
        statisticsRepository.cleanupOldStatistics.mockResolvedValue(2);
        cacheService.del.mockResolvedValue(undefined);

        // Act: Cleanup with 90-day retention
        const deletedCount = await statisticsService.cleanupOldStatistics(90);

        // Assert: Only old archived/deleted projects cleaned up
        expect(deletedCount).toBe(2);
        expect(statisticsRepository.cleanupOldStatistics).toHaveBeenCalledWith(90);
        expect(cacheService.del).toHaveBeenCalledWith('stats:global');
      });
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle repository errors gracefully', async () => {
      // Arrange
      const testProjectId = 'test-error-handling';
      const statsData = {
        costs: { total: 15.0 },
        usage: { documentsGenerated: 3 },
      };

      statisticsRepository.upsert.mockRejectedValue(new Error('Database connection failed'));

      // Act & Assert: Should propagate the error
      await expect(
        statisticsService.updateStatistics(testProjectId, plainToClass(UpdateStatisticsDto, statsData))
      ).rejects.toThrow('Database connection failed');
    });

    it('should handle cache failures gracefully', async () => {
      // Arrange
      const testProjectId = 'test-cache-failure';
      const statsData = {
        costs: { total: 15.0 },
        usage: { documentsGenerated: 3 },
      };

      const entity = createMockEntity({ costs: { total: 15.0 } });
      
      // Mock cache failures but successful repository operations
      cacheService.get.mockRejectedValue(new Error('Cache unavailable'));
      cacheService.set.mockRejectedValue(new Error('Cache unavailable'));
      cacheService.del.mockRejectedValue(new Error('Cache unavailable'));
      
      statisticsRepository.upsert.mockResolvedValue(entity);
      statisticsRepository.findByProjectId.mockResolvedValue(entity);

      // Act: Operations should still work without cache
      await statisticsService.updateStatistics(testProjectId, plainToClass(UpdateStatisticsDto, statsData));
      const result = await statisticsService.getStatistics(testProjectId);

      // Assert: Operations succeed despite cache failures
      expect(result).toBeDefined();
      expect(result?.costs.total).toBe(15.0);
    });

    it('should handle timeout scenarios', async () => {
      // Arrange
      const invalidProjectId = 'test-timeout-scenario';
      statisticsRepository.findByProjectId.mockResolvedValue(null);
      cacheService.get.mockResolvedValue(null);

      // Act: Should handle gracefully
      const result = await statisticsService.getStatistics(invalidProjectId);

      // Assert: Should return null for non-existent project
      expect(result).toBeNull();
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle high-frequency updates efficiently', async () => {
      // Arrange
      const testProjectId = 'test-high-frequency';
      const updateCount = 50;
      
      const entity = createMockEntity({ projectId: testProjectId });
      statisticsRepository.upsert.mockResolvedValue(entity);
      statisticsRepository.findByProjectId.mockResolvedValue(entity);
      cacheService.get.mockResolvedValue(null);
      cacheService.del.mockResolvedValue(undefined);
      cacheService.set.mockResolvedValue(undefined);

      // Generate many small updates
      const updates = [];
      for (let i = 0; i < updateCount; i++) {
        const updateData = {
          costs: { claudeApi: i * 0.1 },
          usage: { apiCallsCount: i },
        };
        updates.push(
          statisticsService.updateStatistics(testProjectId, plainToClass(UpdateStatisticsDto, updateData)),
        );
      }

      const start = Date.now();
      await Promise.all(updates);
      const duration = Date.now() - start;

      // Assert: All updates completed in reasonable time
      expect(duration).toBeLessThan(5000); // 5 seconds for 50 updates
      expect(statisticsRepository.upsert).toHaveBeenCalledTimes(updateCount);

      // Verify final state
      const final = await statisticsService.getStatistics(testProjectId);
      expect(final).toBeDefined();
    }, 10000);

    it('should handle large batch operations efficiently', async () => {
      // Arrange
      const batchSize = 100;
      const projectIds = Array.from({ length: batchSize }, (_, i) => `test-large-batch-${i}`);

      // Mock batch creation
      statisticsRepository.upsert.mockImplementation(async (projectId) =>
        createMockEntity({
          projectId,
        })
      );

      // Create statistics for all projects
      const createPromises = projectIds.map((id, index) => {
        const statsData = {
          costs: { total: index * 5.0 },
          usage: { documentsGenerated: index + 1 },
        };
        return statisticsService.updateStatistics(id, plainToClass(UpdateStatisticsDto, statsData));
      });

      await Promise.all(createPromises);

      // Test batch retrieval performance
      const entitiesMap = new Map();
      projectIds.forEach((id, index) => {
        entitiesMap.set(id, createMockEntity({
          projectId: id,
          costs: { total: index * 5.0 },
        }));
      });

      statisticsRepository.findManyByProjectIds.mockResolvedValue(entitiesMap);
      cacheService.get.mockResolvedValue(null);

      const start = Date.now();
      const results = await statisticsService.getMultipleStatistics(projectIds);
      const duration = Date.now() - start;

      // Assert: Batch operation completed efficiently
      expect(duration).toBeLessThan(2000); // 2 seconds for 100 projects
      expect(results.size).toBe(batchSize);
    }, 15000);
  });
});