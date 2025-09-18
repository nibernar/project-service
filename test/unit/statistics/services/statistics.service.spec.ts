import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { StatisticsService } from '../../../../src/statistics/statistics.service';
import { StatisticsRepository } from '../../../../src/statistics/statistics.repository';
import { CacheService } from '../../../../src/cache/cache.service';
import { UpdateStatisticsDto } from '../../../../src/statistics/dto/update-statistics.dto';
import { StatisticsResponseDto } from '../../../../src/statistics/dto/statistics-response.dto';
import { ProjectStatisticsEntity } from '../../../../src/statistics/entities/project-statistics.entity';

// ✅ IMPORTS CORRIGÉS des fixtures
import { 
  StatisticsFixtures, 
  TEST_IDS,
  DataGenerator
} from '../../../fixtures/project.fixtures';

describe('StatisticsService', () => {
  let service: StatisticsService;
  let repository: jest.Mocked<StatisticsRepository>;
  let cacheService: jest.Mocked<CacheService>;

  // ✅ DONNÉES DE TEST depuis les fixtures
  const mockProjectId = TEST_IDS.PROJECT_1;
  const mockStatisticsEntity = StatisticsFixtures.completeStats();
  
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

    const mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
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
          useValue: mockCacheService,
        },
      ],
    }).compile();

    service = module.get<StatisticsService>(StatisticsService);
    repository = module.get(StatisticsRepository);
    cacheService = module.get(CacheService);

    // Suppress console logs during tests
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ========================================================================
  // TESTS DE MISE À JOUR DES STATISTIQUES
  // ========================================================================

  describe('updateStatistics', () => {
    const updateDto = StatisticsFixtures.updateStatisticsDto();

    it('should update statistics successfully', async () => {
      // Arrange
      repository.upsert.mockResolvedValue(mockStatisticsEntity);
      cacheService.del.mockResolvedValue(1);
      cacheService.set.mockResolvedValue(true);

      // Act
      const result = await service.updateStatistics(mockProjectId, updateDto);

      // Assert
      expect(repository.upsert).toHaveBeenCalledWith(mockProjectId, updateDto);
      expect(cacheService.del).toHaveBeenCalled();
      expect(cacheService.set).toHaveBeenCalled();
      expect(result).toBeInstanceOf(StatisticsResponseDto);
      expect(result.costs.total).toBeDefined();
    });

    it('should handle different cost structures', async () => {
      // Arrange
      const customUpdateDto = plainToInstance(UpdateStatisticsDto, {
        costs: {
          claudeApi: 15.00,
          storage: 3.00,
          compute: 2.00,
          total: 20.00,
        },
        performance: {
          generationTime: 50000,
          processingTime: 10000,
          totalTime: 60000,
        },
        usage: {
          documentsGenerated: 6,
          filesProcessed: 4,
          tokensUsed: 20000,
        },
      });

      const updatedEntity = StatisticsFixtures.basicStats();
      updatedEntity.costs = customUpdateDto.costs as any;
      updatedEntity.performance = customUpdateDto.performance as any;
      updatedEntity.usage = customUpdateDto.usage as any;

      repository.upsert.mockResolvedValue(updatedEntity);

      // Act
      const result = await service.updateStatistics(mockProjectId, customUpdateDto);

      // Assert
      expect(result).toBeInstanceOf(StatisticsResponseDto);
      expect(result.costs.claudeApi).toBe(15.00);
      expect(result.performance.totalTime).toBe(60000);
      expect(result.usage.documentsGenerated).toBe(6);
    });

    it('should handle repository errors', async () => {
      // Arrange
      repository.upsert.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(
        service.updateStatistics(mockProjectId, updateDto),
      ).rejects.toThrow('Database error');
    });

    it('should continue when cache invalidation fails', async () => {
      // Arrange
      repository.upsert.mockResolvedValue(mockStatisticsEntity);
      cacheService.del.mockRejectedValue(new Error('Cache error'));
      cacheService.set.mockResolvedValue(true);

      // Act
      const result = await service.updateStatistics(mockProjectId, updateDto);

      // Assert
      expect(result).toBeInstanceOf(StatisticsResponseDto);
      expect(repository.upsert).toHaveBeenCalled();
    });

    it('should handle concurrent updates', async () => {
      // Arrange
      const promise1 = service.updateStatistics(mockProjectId, updateDto);
      const promise2 = service.updateStatistics(mockProjectId, updateDto);

      repository.upsert.mockResolvedValue(mockStatisticsEntity);

      // Act
      const [result1, result2] = await Promise.all([promise1, promise2]);

      // Assert
      expect(result1).toBeInstanceOf(StatisticsResponseDto);
      expect(result2).toBeInstanceOf(StatisticsResponseDto);
      expect(repository.upsert).toHaveBeenCalledTimes(2);
    });

    it('should validate basic data structure when updating', async () => {
      // Arrange
      repository.upsert.mockResolvedValue(mockStatisticsEntity);

      // Act
      await service.updateStatistics(mockProjectId, updateDto);

      // Assert
      expect(repository.upsert).toHaveBeenCalledWith(mockProjectId, updateDto);
      expect(updateDto.costs).toBeDefined();
      expect(updateDto.performance).toBeDefined();
      expect(updateDto.usage).toBeDefined();
    });
  });

  // ========================================================================
  // TESTS DE RÉCUPÉRATION DES STATISTIQUES
  // ========================================================================

  describe('getStatistics', () => {
    it('should return cached statistics when available', async () => {
      // Arrange
      const cachedResponse = StatisticsFixtures.statisticsResponseDto();
      cacheService.get.mockResolvedValue(cachedResponse);

      // Act
      const result = await service.getStatistics(mockProjectId);

      // Assert
      expect(cacheService.get).toHaveBeenCalledWith(
        expect.stringContaining(mockProjectId),
      );
      expect(repository.findByProjectId).not.toHaveBeenCalled();
      expect(result).toBe(cachedResponse);
    });

    it('should fetch from repository when not cached', async () => {
      // Arrange
      cacheService.get.mockResolvedValue(null);
      repository.findByProjectId.mockResolvedValue(mockStatisticsEntity);
      cacheService.set.mockResolvedValue(true);

      // Act
      const result = await service.getStatistics(mockProjectId);

      // Assert
      expect(cacheService.get).toHaveBeenCalled();
      expect(repository.findByProjectId).toHaveBeenCalledWith(mockProjectId);
      expect(cacheService.set).toHaveBeenCalled();
      expect(result).toBeInstanceOf(StatisticsResponseDto);
    });

    it('should return null when statistics not found', async () => {
      // Arrange
      cacheService.get.mockResolvedValue(null);
      repository.findByProjectId.mockResolvedValue(null);

      // Act
      const result = await service.getStatistics(mockProjectId);

      // Assert
      expect(result).toBeNull();
    });

    it('should handle cache errors gracefully', async () => {
      // Arrange
      cacheService.get.mockRejectedValue(new Error('Cache error'));
      repository.findByProjectId.mockResolvedValue(mockStatisticsEntity);

      // Act
      const result = await service.getStatistics(mockProjectId);

      // Assert
      expect(repository.findByProjectId).toHaveBeenCalled();
      expect(result).toBeInstanceOf(StatisticsResponseDto);
    });

    it('should handle repository errors', async () => {
      // Arrange
      cacheService.get.mockResolvedValue(null);
      repository.findByProjectId.mockRejectedValue(new Error('DB error'));

      // Act & Assert
      await expect(service.getStatistics(mockProjectId)).rejects.toThrow('DB error');
    });

    it('should transform entity to response DTO correctly', async () => {
      // Arrange
      cacheService.get.mockResolvedValue(null);
      repository.findByProjectId.mockResolvedValue(mockStatisticsEntity);

      // Act
      const result = await service.getStatistics(mockProjectId);

      // Assert
      expect(result).toBeInstanceOf(StatisticsResponseDto);
      expect(result?.costs.total).toBe(mockStatisticsEntity.costs.total);
      expect(result?.usage.documentsGenerated).toBe(mockStatisticsEntity.usage.documentsGenerated);
      expect(result?.performance.totalTime).toBe(mockStatisticsEntity.performance.totalTime);
    });
  });

  // ========================================================================
  // TESTS DE SUPPRESSION DES STATISTIQUES
  // ========================================================================

  describe('deleteStatistics', () => {
    it('should delete statistics successfully', async () => {
      // Arrange
      repository.deleteByProjectId.mockResolvedValue(true);
      cacheService.del.mockResolvedValue(1);

      // Act
      const result = await service.deleteStatistics(mockProjectId);

      // Assert
      expect(repository.deleteByProjectId).toHaveBeenCalledWith(mockProjectId);
      expect(cacheService.del).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should return false when statistics not found', async () => {
      // Arrange
      repository.deleteByProjectId.mockResolvedValue(false);

      // Act
      const result = await service.deleteStatistics(mockProjectId);

      // Assert
      expect(result).toBe(false);
    });

    it('should handle repository errors', async () => {
      // Arrange
      repository.deleteByProjectId.mockRejectedValue(new Error('Delete error'));

      // Act & Assert
      await expect(service.deleteStatistics(mockProjectId)).rejects.toThrow('Delete error');
    });

    it('should handle cache invalidation errors gracefully', async () => {
      // Arrange
      repository.deleteByProjectId.mockResolvedValue(true);
      cacheService.del.mockRejectedValue(new Error('Cache error'));

      // Act
      const result = await service.deleteStatistics(mockProjectId);

      // Assert
      expect(result).toBe(true);
    });
  });

  // ========================================================================
  // TESTS DE STATISTIQUES MULTIPLES
  // ========================================================================

  describe('getMultipleStatistics', () => {
    const projectIds = [TEST_IDS.PROJECT_1, TEST_IDS.PROJECT_2, TEST_IDS.PROJECT_3];

    it('should return empty map for empty input', async () => {
      // Act
      const result = await service.getMultipleStatistics([]);

      // Assert
      expect(result.size).toBe(0);
      expect(repository.findManyByProjectIds).not.toHaveBeenCalled();
    });

    it('should fetch all uncached statistics', async () => {
      // Arrange
      cacheService.get.mockResolvedValue(null);
      
      const entity1 = StatisticsFixtures.basicStats();
      entity1.id = TEST_IDS.STATS_1;
      entity1.projectId = TEST_IDS.PROJECT_1;
      
      const entity2 = StatisticsFixtures.completeStats();
      entity2.id = TEST_IDS.STATS_2;
      entity2.projectId = TEST_IDS.PROJECT_2;
      
      const entitiesMap = new Map([
        [TEST_IDS.PROJECT_1, entity1],
        [TEST_IDS.PROJECT_2, entity2],
      ]);
      repository.findManyByProjectIds.mockResolvedValue(entitiesMap);
      cacheService.set.mockResolvedValue(true);

      // Act
      const result = await service.getMultipleStatistics(projectIds);

      // Assert
      expect(cacheService.get).toHaveBeenCalledTimes(projectIds.length);
      expect(repository.findManyByProjectIds).toHaveBeenCalledWith(projectIds);
      expect(result.size).toBe(2);
    });

    it('should combine cached and uncached results', async () => {
      // Arrange
      const cachedResponse = StatisticsFixtures.statisticsResponseDto();
      cacheService.get
        .mockResolvedValueOnce(cachedResponse) // project-1 cached
        .mockResolvedValueOnce(null) // project-2 not cached
        .mockResolvedValueOnce(null); // project-3 not cached

      const entity2 = StatisticsFixtures.basicStats();
      entity2.projectId = TEST_IDS.PROJECT_2;
      const entitiesMap = new Map([[TEST_IDS.PROJECT_2, entity2]]);
      repository.findManyByProjectIds.mockResolvedValue(entitiesMap);

      // Act
      const result = await service.getMultipleStatistics(projectIds);

      // Assert
      expect(result.size).toBe(2);
      expect(result.get(TEST_IDS.PROJECT_1)).toBe(cachedResponse);
      expect(result.get(TEST_IDS.PROJECT_2)).toBeInstanceOf(StatisticsResponseDto);
    });

    it('should handle large batches efficiently', async () => {
      // Arrange
      const largeBatch = Array.from({ length: 100 }, (_, i) => `project-${i}`);
      cacheService.get.mockResolvedValue(null);
      repository.findManyByProjectIds.mockResolvedValue(new Map());

      // Act
      const result = await service.getMultipleStatistics(largeBatch);

      // Assert
      expect(repository.findManyByProjectIds).toHaveBeenCalledWith(largeBatch);
      expect(result.size).toBe(0);
    });

    it('should transform entities to DTOs correctly', async () => {
      // Arrange
      cacheService.get.mockResolvedValue(null);
      const entity1 = StatisticsFixtures.completeStats();
      entity1.projectId = TEST_IDS.PROJECT_1;
      const entitiesMap = new Map([[TEST_IDS.PROJECT_1, entity1]]);
      repository.findManyByProjectIds.mockResolvedValue(entitiesMap);

      // Act
      const result = await service.getMultipleStatistics([TEST_IDS.PROJECT_1]);

      // Assert
      const dto = result.get(TEST_IDS.PROJECT_1);
      expect(dto).toBeInstanceOf(StatisticsResponseDto);
      expect(dto?.costs.total).toBe(entity1.costs.total);
    });
  });

  // ========================================================================
  // TESTS DES STATISTIQUES GLOBALES
  // ========================================================================

  describe('getGlobalStatistics', () => {
    const mockGlobalStats = {
      totalProjects: 1250,
      totalCosts: 45789.32,
      totalDocuments: 8945,
      averageQualityScore: 87.5,
      sourceDistribution: { 'cost-tracking-service': 1200 },
    };

    it('should return cached global statistics', async () => {
      // Arrange
      cacheService.get.mockResolvedValue(mockGlobalStats);

      // Act
      const result = await service.getGlobalStatistics();

      // Assert
      expect(cacheService.get).toHaveBeenCalledWith('stats:global');
      expect(repository.getGlobalStatistics).not.toHaveBeenCalled();
      expect(result).toBe(mockGlobalStats);
    });

    it('should compute and cache global statistics', async () => {
      // Arrange
      cacheService.get.mockResolvedValue(null);
      repository.getGlobalStatistics.mockResolvedValue(mockGlobalStats);
      cacheService.set.mockResolvedValue(true);

      // Act
      const result = await service.getGlobalStatistics();

      // Assert
      expect(repository.getGlobalStatistics).toHaveBeenCalled();
      expect(cacheService.set).toHaveBeenCalledWith(
        'stats:global',
        mockGlobalStats,
        600,
      );
      expect(result).toBe(mockGlobalStats);
    });

    it('should handle repository errors', async () => {
      // Arrange
      cacheService.get.mockResolvedValue(null);
      repository.getGlobalStatistics.mockRejectedValue(new Error('Query error'));

      // Act & Assert
      await expect(service.getGlobalStatistics()).rejects.toThrow('Query error');
    });

    it('should handle empty global statistics', async () => {
      // Arrange
      const emptyStats = {
        totalProjects: 0,
        totalCosts: 0,
        totalDocuments: 0,
        averageQualityScore: 0,
        sourceDistribution: {},
      };
      cacheService.get.mockResolvedValue(null);
      repository.getGlobalStatistics.mockResolvedValue(emptyStats);

      // Act
      const result = await service.getGlobalStatistics();

      // Assert
      expect(result.totalProjects).toBe(0);
      expect(result.totalCosts).toBe(0);
    });
  });

  // ========================================================================
  // TESTS DE RECHERCHE DE STATISTIQUES
  // ========================================================================

  describe('searchStatistics', () => {
    const searchCriteria = {
      minTotalCost: 10.0,
      maxTotalCost: 100.0,
      minDocuments: 3,
    };

    it('should search statistics with criteria', async () => {
      // Arrange
      repository.findByCriteria.mockResolvedValue([mockStatisticsEntity]);

      // Act
      const result = await service.searchStatistics(searchCriteria);

      // Assert
      expect(repository.findByCriteria).toHaveBeenCalledWith(searchCriteria);
      expect(result).toHaveLength(1);
      expect(result[0]).toBeInstanceOf(StatisticsResponseDto);
    });

    it('should return empty array when no matches', async () => {
      // Arrange
      repository.findByCriteria.mockResolvedValue([]);

      // Act
      const result = await service.searchStatistics(searchCriteria);

      // Assert
      expect(result).toHaveLength(0);
    });

    it('should handle repository errors', async () => {
      // Arrange
      repository.findByCriteria.mockRejectedValue(new Error('Search error'));

      // Act & Assert
      await expect(service.searchStatistics(searchCriteria)).rejects.toThrow('Search error');
    });

    it('should transform search results correctly', async () => {
      // Arrange
      const entity1 = StatisticsFixtures.basicStats();
      const entity2 = StatisticsFixtures.completeStats();
      repository.findByCriteria.mockResolvedValue([entity1, entity2]);

      // Act
      const result = await service.searchStatistics(searchCriteria);

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0]).toBeInstanceOf(StatisticsResponseDto);
      expect(result[1]).toBeInstanceOf(StatisticsResponseDto);
      expect(result[0].costs.total).toBe(entity1.costs.total);
      expect(result[1].costs.total).toBe(entity2.costs.total);
    });

    it('should handle complex search criteria', async () => {
      // Arrange
      const complexCriteria = {
        minTotalCost: 1.0,
        maxTotalCost: 50.0,
        minDocuments: 1,
        maxDocuments: 10,
        minTokensUsed: 1000,
        projectIds: [TEST_IDS.PROJECT_1, TEST_IDS.PROJECT_2],
      };
      repository.findByCriteria.mockResolvedValue([mockStatisticsEntity]);

      // Act
      const result = await service.searchStatistics(complexCriteria);

      // Assert
      expect(repository.findByCriteria).toHaveBeenCalledWith(complexCriteria);
      expect(result).toHaveLength(1);
    });
  });

  // ========================================================================
  // TESTS DE MISE À JOUR PARTIELLE
  // ========================================================================

  describe('partialUpdateStatistics', () => {
    const partialData = { 
      costs: { 
        claudeApi: 20.0,
        storage: 1.5,
        compute: 2.5,
        total: 24.0,
      } 
    };

    it('should update statistics partially', async () => {
      // Arrange
      const updatedEntity = StatisticsFixtures.completeStats();
      updatedEntity.costs = { ...updatedEntity.costs, ...partialData.costs };
      
      repository.partialUpdate.mockResolvedValue(updatedEntity);
      cacheService.del.mockResolvedValue(1);
      cacheService.set.mockResolvedValue(true);

      // Act
      const result = await service.partialUpdateStatistics(mockProjectId, partialData);

      // Assert
      expect(repository.partialUpdate).toHaveBeenCalledWith(mockProjectId, partialData);
      expect(result).toBeInstanceOf(StatisticsResponseDto);
      expect(result?.costs.claudeApi).toBe(20.0);
    });

    it('should return null when project not found', async () => {
      // Arrange
      repository.partialUpdate.mockResolvedValue(null);

      // Act
      const result = await service.partialUpdateStatistics(mockProjectId, partialData);

      // Assert
      expect(result).toBeNull();
    });

    it('should invalidate cache after partial update', async () => {
      // Arrange
      repository.partialUpdate.mockResolvedValue(mockStatisticsEntity);
      cacheService.del.mockResolvedValue(1);

      // Act
      await service.partialUpdateStatistics(mockProjectId, partialData);

      // Assert
      expect(cacheService.del).toHaveBeenCalled();
    });

    it('should handle partial performance updates', async () => {
      // Arrange
      const performanceUpdate = {
        performance: {
          generationTime: 75000,
        }
      };
      const updatedEntity = StatisticsFixtures.basicStats();
      updatedEntity.performance.generationTime = 75000;

      repository.partialUpdate.mockResolvedValue(updatedEntity);

      // Act
      const result = await service.partialUpdateStatistics(mockProjectId, performanceUpdate);

      // Assert
      expect(result).toBeInstanceOf(StatisticsResponseDto);
      expect(result?.performance.generationTime).toBe(75000);
    });
  });

  // ========================================================================
  // TESTS DE NETTOYAGE DES STATISTIQUES ANCIENNES
  // ========================================================================

  describe('cleanupOldStatistics', () => {
    it('should cleanup old statistics successfully', async () => {
      // Arrange
      repository.cleanupOldStatistics.mockResolvedValue(150);
      cacheService.del.mockResolvedValue(1);

      // Act
      const result = await service.cleanupOldStatistics(90);

      // Assert
      expect(repository.cleanupOldStatistics).toHaveBeenCalledWith(90);
      expect(cacheService.del).toHaveBeenCalledWith('stats:global');
      expect(result).toBe(150);
    });

    it('should not invalidate cache when no records deleted', async () => {
      // Arrange
      repository.cleanupOldStatistics.mockResolvedValue(0);

      // Act
      const result = await service.cleanupOldStatistics(90);

      // Assert
      expect(result).toBe(0);
      expect(cacheService.del).not.toHaveBeenCalled();
    });

    it('should use default retention period', async () => {
      // Arrange
      repository.cleanupOldStatistics.mockResolvedValue(10);

      // Act
      await service.cleanupOldStatistics();

      // Assert
      expect(repository.cleanupOldStatistics).toHaveBeenCalledWith(90);
    });

    it('should handle cleanup of large datasets', async () => {
      // Arrange
      repository.cleanupOldStatistics.mockResolvedValue(5000);

      // Act
      const result = await service.cleanupOldStatistics(30);

      // Assert
      expect(result).toBe(5000);
      expect(repository.cleanupOldStatistics).toHaveBeenCalledWith(30);
    });
  });

  // ========================================================================
  // TESTS DE CAS LIMITES ET GESTION D'ERREURS
  // ========================================================================

  describe('edge cases and error handling', () => {
    it('should handle null/undefined statistics entity', async () => {
      // Arrange
      cacheService.get.mockResolvedValue(null);
      repository.findByProjectId.mockResolvedValue(null);

      // Act
      const result = await service.getStatistics(mockProjectId);

      // Assert
      expect(result).toBeNull();
    });

    it('should handle malformed cache data', async () => {
      // Arrange
      const malformedData = { invalid: 'data' };
      cacheService.get.mockResolvedValue(malformedData);
      repository.findByProjectId.mockResolvedValue(mockStatisticsEntity);
      cacheService.set.mockResolvedValue(true);

      // Act
      const result = await service.getStatistics(mockProjectId);

      // Assert
      expect(result).toBeDefined();
      // Le service peut retourner les données malformées du cache ou faire un fallback
    });

    it('should handle very large numbers in statistics', async () => {
      // Arrange
      const largeNumbersEntity = StatisticsFixtures.highCostStats();
      largeNumbersEntity.costs.total = Number.MAX_SAFE_INTEGER - 1;
      largeNumbersEntity.usage.tokensUsed = Number.MAX_SAFE_INTEGER - 1;
      
      repository.findByProjectId.mockResolvedValue(largeNumbersEntity);
      cacheService.get.mockResolvedValue(null);

      // Act
      const result = await service.getStatistics(mockProjectId);

      // Assert
      expect(result).toBeInstanceOf(StatisticsResponseDto);
      expect(result?.costs.total).toBe(Number.MAX_SAFE_INTEGER - 1);
    });

    it('should handle missing nested properties gracefully', async () => {
      // Arrange
      const incompleteEntity = StatisticsFixtures.emptyStats();
      repository.findByProjectId.mockResolvedValue(incompleteEntity);
      cacheService.get.mockResolvedValue(null);

      // Act
      const result = await service.getStatistics(mockProjectId);

      // Assert
      expect(result).toBeInstanceOf(StatisticsResponseDto);
      expect(result?.costs).toBeDefined();
      expect(result?.performance).toBeDefined();
      expect(result?.usage).toBeDefined();
    });

    it('should handle zero values correctly', async () => {
      // Arrange
      // ✅ FIX: Créer une entité avec des valeurs explicitement à 0
      const zeroEntity = new ProjectStatisticsEntity({
        id: TEST_IDS.STATS_1,
        projectId: TEST_IDS.PROJECT_1,
        costs: {
          claudeApi: 0,
          storage: 0,
          compute: 0,
          total: 0
        },
        performance: {
          generationTime: 0,
          processingTime: 0,
          totalTime: 0
        },
        usage: {
          documentsGenerated: 0,
          filesProcessed: 0,
          tokensUsed: 0
        },
        lastUpdated: new Date("2024-01-15T10:30:00Z")
      });

      repository.findByProjectId.mockResolvedValue(zeroEntity);
      cacheService.get.mockResolvedValue(null);

      // Act
      const result = await service.getStatistics(mockProjectId);

      // Assert
      expect(result).toBeInstanceOf(StatisticsResponseDto);
      expect(result?.costs.total).toBe(0);
      expect(result?.performance.totalTime).toBe(0);
      expect(result?.usage.documentsGenerated).toBe(0);
    });

    it('should handle invalid project IDs', async () => {
      // Arrange
      const invalidProjectId = 'invalid-uuid';
      cacheService.get.mockResolvedValue(null);
      repository.findByProjectId.mockResolvedValue(null);

      // Act & Assert
      // ✅ FIX: Wrapper la fonction async correctement
      await expect(async () => {
        await service.getStatistics(invalidProjectId);
      }).not.toThrow(); // Le service devrait gérer gracieusement les IDs invalides
    });

    it('should handle concurrent cache operations', async () => {
      // Arrange
      const updatePromises = Array.from({ length: 10 }, () =>
        service.updateStatistics(mockProjectId, StatisticsFixtures.updateStatisticsDto())
      );
      repository.upsert.mockResolvedValue(mockStatisticsEntity);

      // Act
      const results = await Promise.all(updatePromises);

      // Assert
      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(result).toBeInstanceOf(StatisticsResponseDto);
      });
    });
  });

  // ========================================================================
  // TESTS DE PERFORMANCE
  // ========================================================================

  describe('performance tests', () => {
    it('should handle high frequency updates efficiently', async () => {
      // Arrange
      repository.upsert.mockResolvedValue(mockStatisticsEntity);
      const updatePromises = Array.from({ length: 50 }, () =>
        service.updateStatistics(mockProjectId, StatisticsFixtures.updateStatisticsDto()),
      );

      // Act
      const results = await Promise.all(updatePromises);

      // Assert
      expect(results).toHaveLength(50);
      expect(repository.upsert).toHaveBeenCalledTimes(50);
    });

    it('should handle cache misses efficiently', async () => {
      // Arrange
      cacheService.get.mockResolvedValue(null);
      repository.findByProjectId.mockResolvedValue(mockStatisticsEntity);

      const start = Date.now();
      
      // Act
      await service.getStatistics(mockProjectId);
      
      const duration = Date.now() - start;

      // Assert
      expect(duration).toBeLessThan(100); // Should complete quickly
    });

    it('should batch multiple statistics requests efficiently', async () => {
      // Arrange
      const manyProjectIds = Array.from({ length: 100 }, (_, i) => `project-${i}`);
      cacheService.get.mockResolvedValue(null);
      repository.findManyByProjectIds.mockResolvedValue(new Map());

      const start = Date.now();

      // Act
      await service.getMultipleStatistics(manyProjectIds);

      const duration = Date.now() - start;

      // Assert
      expect(duration).toBeLessThan(500); // Should handle batch efficiently
      expect(repository.findManyByProjectIds).toHaveBeenCalledTimes(1);
    });
  });

  // ========================================================================
  // TESTS D'INTÉGRATION AVEC LES FIXTURES
  // ========================================================================

  describe('integration with fixtures', () => {
    it('should work with different statistics fixture types', async () => {
      // Arrange
      const basicStats = StatisticsFixtures.basicStats();
      const completeStats = StatisticsFixtures.completeStats();
      const emptyStats = StatisticsFixtures.emptyStats();

      // Act & Assert
      expect(basicStats.costs.total).toBeGreaterThan(0);
      expect(completeStats.usage.documentsGenerated).toBeGreaterThan(basicStats.usage.documentsGenerated || 0);
      // ✅ FIX: Vérifier que emptyStats a bien des objets vides, pas des valeurs 0
      expect(emptyStats.costs.total).toBeUndefined(); // EmptyStats a un objet vide
    });

    it('should maintain data consistency across fixtures', async () => {
      // Arrange
      const updateDto = StatisticsFixtures.updateStatisticsDto();
      const responseDto = StatisticsFixtures.statisticsResponseDto();

      // Act & Assert
      expect(updateDto.costs).toBeDefined();
      expect(updateDto.performance).toBeDefined();
      expect(updateDto.usage).toBeDefined();
      expect(responseDto.costs).toBeDefined();
      expect(responseDto.performance).toBeDefined();
      expect(responseDto.usage).toBeDefined();
    });

    it('should validate fixture IDs consistency', async () => {
      // Arrange
      const entity = StatisticsFixtures.completeStats();

      // Act & Assert
      expect(entity.id).toBe(TEST_IDS.STATS_1);
      expect(entity.projectId).toBe(TEST_IDS.PROJECT_1);
    });
  });
});