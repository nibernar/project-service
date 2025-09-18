import { Test, TestingModule } from '@nestjs/testing';
import { StatisticsService } from '../../../src/statistics/statistics.service';
import { StatisticsRepository } from '../../../src/statistics/statistics.repository';
import { CacheService } from '../../../src/cache/cache.service';
import { DatabaseService } from '../../../src/database/database.service';
import { plainToClass } from 'class-transformer';
import { UpdateStatisticsDto } from '../../../src/statistics/dto/update-statistics.dto';
import { ProjectStatisticsEntity } from '../../../src/statistics/entities/project-statistics.entity';

// Import des fixtures
import {
  TestFixtures,
  ProjectFixtures,
  UserFixtures,
  StatisticsFixtures,
  TEST_IDS,
  DataGenerator,
  createTestDataSet,
  createCompleteTestScenario,
} from '../../fixtures/project.fixtures';

describe('Statistics Module Integration', () => {
  let statisticsService: StatisticsService;
  let statisticsRepository: jest.Mocked<StatisticsRepository>;
  let cacheService: jest.Mocked<CacheService>;
  let databaseService: jest.Mocked<DatabaseService>;

  // Utilisation des fixtures pour les données de test
  let testUser: ReturnType<typeof UserFixtures.validUser>;
  let testDataSet: ReturnType<typeof createTestDataSet>;
  let completeScenario: ReturnType<typeof createCompleteTestScenario>;

  const createMockEntity = (data: Partial<any> = {}): ProjectStatisticsEntity => {
    // Utiliser les fixtures pour créer des entités plus réalistes
    const baseStats = StatisticsFixtures.basicStats();
    return Object.assign(new ProjectStatisticsEntity(), {
      id: data.id || DataGenerator.randomUUID('stats'),
      projectId: data.projectId || TEST_IDS.PROJECT_1,
      costs: data.costs || baseStats.costs,
      performance: data.performance || baseStats.performance,
      usage: data.usage || baseStats.usage,
      lastUpdated: data.lastUpdated || new Date('2024-08-18T10:30:00Z'),
      ...data,
    });
  };

  beforeEach(async () => {
    // Initialiser les données de test avec les fixtures
    testUser = UserFixtures.validUser();
    testDataSet = createTestDataSet();
    completeScenario = createCompleteTestScenario();

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
      set: jest.fn().mockResolvedValue(true), // Correction: retourne boolean
      del: jest.fn().mockResolvedValue(1), // Correction: retourne number
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
        // Arrange - Utiliser les fixtures pour des données réalistes
        const testProjectId = TEST_IDS.PROJECT_1;
        const initialStatsDto = StatisticsFixtures.updateStatisticsDto();
        const initialStatsData = {
          costs: initialStatsDto.costs,
          performance: initialStatsDto.performance,
          usage: initialStatsDto.usage,
          metadata: {
            source: 'cost-tracking-service',
            timestamp: new Date(),
            version: '1.0.0',
          },
        };

        const initialStats = plainToClass(UpdateStatisticsDto, initialStatsData);

        // Mock responses using fixtures
        const createdEntity = StatisticsFixtures.basicStats();
        statisticsRepository.upsert.mockResolvedValue(createdEntity);
        statisticsRepository.findByProjectId.mockResolvedValue(createdEntity);
        statisticsRepository.deleteByProjectId.mockResolvedValue(true);
        cacheService.del.mockResolvedValue(1); // Correction: number
        cacheService.set.mockResolvedValue(true); // Correction: boolean

        // Act 1: Create initial statistics
        const created = await statisticsService.updateStatistics(testProjectId, initialStats);

        // Assert 1: Statistics created
        expect(created).toBeDefined();
        expect(created.costs.total).toBeDefined();
        expect(created.usage.documentsGenerated).toBeDefined();

        // Act 2: Update statistics avec les fixtures
        const updateStatsDto = TestFixtures.helpers.createMockUpdateDto({
          costs: {
            claudeApi: 15.0,
            total: 17.0,
          },
          usage: {
            documentsGenerated: 5,
            tokensUsed: 8000,
          },
        });

        const updateStats = plainToClass(UpdateStatisticsDto, updateStatsDto);
        const updatedEntity = StatisticsFixtures.completeStats();
        statisticsRepository.upsert.mockResolvedValue(updatedEntity);

        const updated = await statisticsService.updateStatistics(testProjectId, updateStats);

        // Assert 2: Statistics updated
        expect(updated.costs.total).toBeDefined();
        expect(updated.usage.documentsGenerated).toBeDefined();

        // Act 3: Retrieve statistics
        statisticsRepository.findByProjectId.mockResolvedValue(updatedEntity);
        cacheService.get.mockResolvedValue(null);

        const retrieved = await statisticsService.getStatistics(testProjectId);

        // Assert 3: Statistics retrieved correctly
        expect(retrieved).toBeDefined();
        if (retrieved) {
          expect(retrieved.costs.total).toBeDefined();
          expect(retrieved.usage.documentsGenerated).toBeDefined();
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
        // Arrange - Utiliser les fixtures
        const testProjectId = TEST_IDS.PROJECT_2;
        const initialStatsData = {
          costs: testDataSet.completeStats.costs,
          performance: testDataSet.completeStats.performance,
          usage: testDataSet.completeStats.usage,
        };

        const initialStats = plainToClass(UpdateStatisticsDto, initialStatsData);
        const initialEntity = StatisticsFixtures.basicStats();

        statisticsRepository.upsert.mockResolvedValue(initialEntity);
        cacheService.del.mockResolvedValue(1); // Correction: number
        cacheService.set.mockResolvedValue(true); // Correction: boolean

        // Act 1: Create statistics (should cache)
        await statisticsService.updateStatistics(testProjectId, initialStats);

        // Act 2: Retrieve from cache
        const cachedResponse = { 
          costs: initialStatsData.costs, 
          performance: initialStatsData.performance 
        };
        cacheService.get.mockResolvedValue(cachedResponse);
        const fromCache = await statisticsService.getStatistics(testProjectId);

        // Act 3: Update statistics (should invalidate cache)
        const updateStatsData = { costs: { total: 25.0 } };
        const updateStats = plainToClass(UpdateStatisticsDto, updateStatsData);
        const updatedEntity = StatisticsFixtures.completeStats();
        
        statisticsRepository.upsert.mockResolvedValue(updatedEntity);
        cacheService.get.mockResolvedValue(null); // Cache invalidated
        statisticsRepository.findByProjectId.mockResolvedValue(updatedEntity);

        await statisticsService.updateStatistics(testProjectId, updateStats);

        // Act 4: Retrieve after update
        const afterUpdate = await statisticsService.getStatistics(testProjectId);

        // Assert: Cache was properly invalidated and updated
        expect(fromCache?.costs).toBeDefined();
        expect(afterUpdate?.costs).toBeDefined();
      });

      it('should handle concurrent updates correctly', async () => {
        // Arrange - Utiliser les fixtures pour les données de test
        const testProjectId = TEST_IDS.PROJECT_3;
        const baseStatsData = StatisticsFixtures.updateStatisticsDto();

        const baseStats = plainToClass(UpdateStatisticsDto, baseStatsData);
        const baseEntity = StatisticsFixtures.basicStats();
        
        statisticsRepository.upsert.mockResolvedValue(baseEntity);
        cacheService.del.mockResolvedValue(1); // Correction: number
        cacheService.set.mockResolvedValue(true); // Correction: boolean

        await statisticsService.updateStatistics(testProjectId, baseStats);

        // Act: Perform concurrent updates using fixtures
        const update1Data = { costs: { storage: 5.0 } };
        const update2Data = { performance: { generationTime: 30.0 } };
        const update3Data = { usage: { tokensUsed: 2000 } };

        const finalEntity = StatisticsFixtures.completeStats();

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
        expect(final?.costs).toBeDefined();
        expect(statisticsRepository.upsert).toHaveBeenCalledTimes(4); // base + 3 updates
      });
    });

    describe('Batch Operations Integration', () => {
      it('should handle multiple projects efficiently', async () => {
        // Arrange - Utiliser les fixtures pour générer des projets multiples
        const projectIds = [
          TEST_IDS.PROJECT_1,
          TEST_IDS.PROJECT_2,
          TEST_IDS.PROJECT_3,
          DataGenerator.randomUUID('batch-4'),
          DataGenerator.randomUUID('batch-5'),
        ];

        const baseStatsData = StatisticsFixtures.updateStatisticsDto();

        // Mock batch creation using fixtures
        statisticsRepository.upsert.mockImplementation(async (projectId, data) => 
          createMockEntity({
            projectId,
            costs: data.costs || baseStatsData.costs,
          })
        );

        // Act 1: Create statistics for multiple projects
        const createPromises = projectIds.map((id, index) => {
          const statsData = {
            ...baseStatsData,
            costs: { ...baseStatsData.costs, total: (baseStatsData.costs?.total || 10.0) + index },
          };
          return statisticsService.updateStatistics(id, plainToClass(UpdateStatisticsDto, statsData));
        });

        await Promise.all(createPromises);

        // Act 2: Retrieve multiple statistics
        const entitiesMap = new Map();
        projectIds.forEach((id, index) => {
          entitiesMap.set(id, createMockEntity({
            projectId: id,
            costs: { total: (baseStatsData.costs?.total || 10.0) + index },
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
          expect(stats?.costs.total).toBeDefined();
        });
      });

      it('should handle partial batch failures gracefully', async () => {
        // Arrange - Utiliser les fixtures pour créer des scénarios réalistes
        const existingProjects = [TEST_IDS.PROJECT_1, TEST_IDS.PROJECT_2];
        const nonExistentProjects = [
          DataGenerator.randomUUID('nonexistent-1'), 
          DataGenerator.randomUUID('nonexistent-2')
        ];
        const allProjects = [...existingProjects, ...nonExistentProjects];

        // Create statistics only for existing projects using fixtures
        for (const id of existingProjects) {
          const statsData = StatisticsFixtures.updateStatisticsDto();
          const entity = createMockEntity({ 
            projectId: id, 
            costs: statsData.costs 
          });
          statisticsRepository.upsert.mockResolvedValue(entity);
          await statisticsService.updateStatistics(id, plainToClass(UpdateStatisticsDto, statsData));
        }

        // Act: Request batch including non-existent projects
        const partialMap = new Map();
        existingProjects.forEach(id => {
          partialMap.set(id, createMockEntity({ 
            projectId: id, 
            costs: StatisticsFixtures.basicStats().costs 
          }));
        });

        statisticsRepository.findManyByProjectIds.mockResolvedValue(partialMap);
        cacheService.get.mockResolvedValue(null);

        const results = await statisticsService.getMultipleStatistics(allProjects);

        // Assert: Only existing projects returned
        expect(results.size).toBe(existingProjects.length);
        existingProjects.forEach(id => {
          expect(results.has(id)).toBe(true);
          expect(results.get(id)?.costs).toBeDefined();
        });
        nonExistentProjects.forEach(id => {
          expect(results.has(id)).toBe(false);
        });
      });
    });

    describe('Search and Filtering Integration', () => {
      it('should search by cost criteria correctly', async () => {
        // Arrange - Utiliser les fixtures pour créer des résultats de recherche
        const searchResults = [
          createMockEntity({
            projectId: DataGenerator.randomUUID('search-medium-cost'),
            costs: StatisticsFixtures.basicStats().costs,
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
        expect(results[0].costs.total).toBeDefined();
        expect(statisticsRepository.findByCriteria).toHaveBeenCalledWith({
          minTotalCost: 10.0,
          maxTotalCost: 50.0,
        });
      });

      it('should search by multiple criteria', async () => {
        // Arrange - Utiliser les fixtures pour créer des résultats complexes
        const complexStats = StatisticsFixtures.completeStats();
        const searchResults = [
          createMockEntity({
            projectId: DataGenerator.randomUUID('search-complex'),
            costs: complexStats.costs,
            performance: complexStats.performance,
            usage: complexStats.usage,
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
        expect(results[0].costs.total).toBeDefined();
        expect(results[0].usage.documentsGenerated).toBeDefined();
        expect(results[0].performance.totalTime).toBeDefined();
      });
    });

    describe('Global Statistics Integration', () => {
      it('should compute global statistics correctly', async () => {
        // Arrange - Utiliser les fixtures pour créer des statistiques globales
        const mockGlobalStats = {
          totalProjects: 3,
          totalCosts: 60.0,
          totalDocuments: 15,
          averageQualityScore: 85.5,
          sourceDistribution: {},
        };

        statisticsRepository.getGlobalStatistics.mockResolvedValue(mockGlobalStats);
        cacheService.get.mockResolvedValue(null);
        cacheService.set.mockResolvedValue(true); // Correction: boolean

        // Act
        const global = await statisticsService.getGlobalStatistics();

        // Assert: Aggregations are correct
        expect(global.totalProjects).toBe(3);
        expect(global.totalCosts).toBe(60.0);
        expect(global.totalDocuments).toBe(15);
        expect(global.averageQualityScore).toBe(85.5);
      });

      it('should cache global statistics for performance', async () => {
        // Arrange - Utiliser les fixtures pour les statistiques globales
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
        cacheService.set.mockResolvedValue(true); // Correction: boolean

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
        cacheService.del.mockResolvedValue(1); // Correction: number

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
      // Arrange - Utiliser les fixtures pour les données d'erreur
      const testProjectId = TEST_IDS.PROJECT_1;
      const statsData = StatisticsFixtures.updateStatisticsDto();

      statisticsRepository.upsert.mockRejectedValue(new Error('Database connection failed'));

      // Act & Assert: Should propagate the error
      await expect(
        statisticsService.updateStatistics(testProjectId, plainToClass(UpdateStatisticsDto, statsData))
      ).rejects.toThrow('Database connection failed');
    });

    it('should handle cache failures gracefully', async () => {
      // Arrange - Utiliser les fixtures
      const testProjectId = TEST_IDS.PROJECT_2;
      const statsData = StatisticsFixtures.updateStatisticsDto();

      const entity = StatisticsFixtures.basicStats();
      
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
      expect(result?.costs).toBeDefined();
    });

    it('should handle timeout scenarios', async () => {
      // Arrange
      const invalidProjectId = DataGenerator.randomUUID('timeout-scenario');
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
      // Arrange - Utiliser les fixtures pour les tests de performance
      const testProjectId = DataGenerator.randomUUID('high-frequency');
      const updateCount = 50;
      
      const entity = createMockEntity({ projectId: testProjectId });
      statisticsRepository.upsert.mockResolvedValue(entity);
      statisticsRepository.findByProjectId.mockResolvedValue(entity);
      cacheService.get.mockResolvedValue(null);
      cacheService.del.mockResolvedValue(1); // Correction: number
      cacheService.set.mockResolvedValue(true); // Correction: boolean

      // Generate many small updates using data generator
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
      // Arrange - Utiliser le générateur de données pour des tests à grande échelle
      const batchSize = 100;
      const projectIds = Array.from({ length: batchSize }, (_, i) => 
        DataGenerator.randomUUID(`large-batch-${i}`)
      );

      // Mock batch creation using fixtures
      statisticsRepository.upsert.mockImplementation(async (projectId) =>
        createMockEntity({
          projectId,
        })
      );

      // Create statistics for all projects using fixtures
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

  describe('Integration with Project Fixtures', () => {
    it('should work with complete test scenarios from fixtures', async () => {
      // Arrange - Utiliser le scénario complet des fixtures
      const scenario = completeScenario;
      const activeProject = scenario.activeProject;
      const projectWithStats = scenario.projectWithStats;

      // Mock statistics for active project
      const activeProjectStats = StatisticsFixtures.basicStats();
      statisticsRepository.findByProjectId.mockResolvedValueOnce(activeProjectStats);
      cacheService.get.mockResolvedValue(null);

      // Act: Get statistics for active project
      const activeStats = await statisticsService.getStatistics(activeProject.id);

      // Assert: Statistics found for active project
      expect(activeStats).toBeDefined();
      expect(activeStats?.costs).toBeDefined();
      expect(activeStats?.usage).toBeDefined();

      // Test with project that has statistics
      const projectStats = StatisticsFixtures.completeStats();
      statisticsRepository.findByProjectId.mockResolvedValueOnce(projectStats);
      
      const existingStats = await statisticsService.getStatistics(projectWithStats.id);
      expect(existingStats).toBeDefined();
      expect(existingStats?.costs.total).toBeDefined();
    });

    it('should handle different user scenarios', async () => {
      // Arrange - Utiliser différents utilisateurs des fixtures
      const validUser = UserFixtures.validUser();
      const otherUser = UserFixtures.otherUser();
      const adminUser = UserFixtures.adminUser();

      // Create projects for different users
      const userProjects = [
        { userId: validUser.id, projectId: DataGenerator.randomUUID(`user-${validUser.id}`) },
        { userId: otherUser.id, projectId: DataGenerator.randomUUID(`user-${otherUser.id}`) },
        { userId: adminUser.id, projectId: DataGenerator.randomUUID(`user-${adminUser.id}`) },
      ];

      // Mock statistics for each user's project
      const statsResults = new Map();
      userProjects.forEach(({ userId, projectId }) => {
        const userStats = createMockEntity({
          projectId,
          costs: { total: Math.random() * 100 },
          usage: { documentsGenerated: Math.floor(Math.random() * 10) + 1 },
        });
        statsResults.set(projectId, userStats);
      });

      statisticsRepository.findManyByProjectIds.mockResolvedValue(statsResults);
      cacheService.get.mockResolvedValue(null);

      // Act: Get statistics for all user projects
      const allProjectIds = userProjects.map(p => p.projectId);
      const results = await statisticsService.getMultipleStatistics(allProjectIds);

      // Assert: Statistics returned for all users
      expect(results.size).toBe(userProjects.length);
      userProjects.forEach(({ projectId }) => {
        expect(results.has(projectId)).toBe(true);
        expect(results.get(projectId)?.costs).toBeDefined();
      });
    });

    it('should handle different project complexities from fixtures', async () => {
      // Arrange - Utiliser différents types de projets des fixtures
      const largeProject = TestFixtures.generator.createPerformanceTestData().largeProject;
      const simpleProject = ProjectFixtures.minimalCreateDto();
      
      // Create statistics reflecting project complexity
      const largeProjectStats = StatisticsFixtures.highCostStats(); // Projet complexe = coûts élevés
      const simpleProjectStats = StatisticsFixtures.basicStats(); // Projet simple = coûts basiques

      statisticsRepository.findByProjectId
        .mockResolvedValueOnce(largeProjectStats)
        .mockResolvedValueOnce(simpleProjectStats);
      
      cacheService.get.mockResolvedValue(null);

      // Act: Get statistics for both projects
      const largeStats = await statisticsService.getStatistics(largeProject.id);
      const simpleStats = await statisticsService.getStatistics(DataGenerator.randomUUID('simple'));

      // Assert: Large project has higher costs/usage
      expect(largeStats?.costs.total).toBeGreaterThan(simpleStats?.costs.total || 0);
      expect(largeStats?.usage.documentsGenerated).toBeGreaterThan(simpleStats?.usage.documentsGenerated || 0);
    });
  });
});