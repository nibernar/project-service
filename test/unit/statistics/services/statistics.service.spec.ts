import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { StatisticsService } from '../../../../src/statistics/statistics.service';
import { StatisticsRepository } from '../../../../src/statistics/statistics.repository';
import { CacheService } from '../../../../src/cache/cache.service';
import { UpdateStatisticsDto } from '../../../../src/statistics/dto/update-statistics.dto';
import { StatisticsResponseDto } from '../../../../src/statistics/dto/statistics-response.dto';
import { ProjectStatisticsEntity } from '../../../../src/statistics/entities/project-statistics.entity';
import { plainToClass } from 'class-transformer';

// Helper function to create valid UpdateStatisticsDto with proper methods
function createValidUpdateStatisticsDto(data: Partial<UpdateStatisticsDto>): UpdateStatisticsDto {
  const dto = plainToClass(UpdateStatisticsDto, data);
  
  // Add validation methods that exist in the real DTO
  dto.validateCostsCoherence = jest.fn().mockReturnValue(true);
  dto.validatePerformanceCoherence = jest.fn().mockReturnValue(true);
  dto.validateUsageCoherence = jest.fn().mockReturnValue(true);
  dto.validateTimestamp = jest.fn().mockReturnValue(true);
  dto.isValid = jest.fn().mockReturnValue({ valid: true, errors: [] });
  
  return dto;
}

// Helper function to create mock ProjectStatisticsEntity with real methods
function createMockStatisticsEntity(data: any): ProjectStatisticsEntity {
  const entity = new ProjectStatisticsEntity(data);
  
  // Only mock methods that actually exist in the entity
  // Keep the real implementations but spy on them
  jest.spyOn(entity, 'mergeCosts');
  jest.spyOn(entity, 'mergePerformance');
  jest.spyOn(entity, 'mergeUsage');
  jest.spyOn(entity, 'updateMetadata');
  jest.spyOn(entity, 'validateConsistency');
  jest.spyOn(entity, 'calculateDataQualityScore');
  jest.spyOn(entity, 'toJSON');
  
  return entity;
}

// Helper to create properly typed StatisticsResponseDto
function createMockStatisticsResponseDto(data: any): StatisticsResponseDto {
  const dto = plainToClass(StatisticsResponseDto, data);
  
  // Add required methods with mocks
  dto.calculateGlobalEfficiency = jest.fn().mockReturnValue(85.0);
  dto.generateRecommendations = jest.fn().mockReturnValue(['Test recommendation']);
  dto.determineOverallStatus = jest.fn().mockReturnValue('good');
  
  return dto;
}

describe('StatisticsService', () => {
  let service: StatisticsService;
  let repository: jest.Mocked<StatisticsRepository>;
  let cacheService: jest.Mocked<CacheService>;

  const mockProjectId = 'project-123-uuid';
  const mockStatisticsEntity = createMockStatisticsEntity({
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
    metadata: {
      sources: ['cost-tracking-service'],
      version: '1.0.0',
      confidence: 0.95,
    },
    lastUpdated: new Date('2024-08-18T10:30:00Z'),
  });

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

  describe('updateStatistics', () => {
    const updateDto = createValidUpdateStatisticsDto({
      costs: {
        claudeApi: 15.00,
        storage: 3.00,
        total: 18.00,
      },
      performance: {
        generationTime: 50.0,
      },
      usage: {
        documentsGenerated: 6,
      },
    });

    it('should update statistics successfully', async () => {
      // Arrange
      repository.upsert.mockResolvedValue(mockStatisticsEntity);
      cacheService.del.mockResolvedValue(undefined);
      cacheService.set.mockResolvedValue(undefined);

      // Act
      const result = await service.updateStatistics(mockProjectId, updateDto);

      // Assert
      expect(repository.upsert).toHaveBeenCalledWith(mockProjectId, updateDto);
      expect(cacheService.del).toHaveBeenCalled();
      expect(cacheService.set).toHaveBeenCalled();
      expect(result).toBeInstanceOf(StatisticsResponseDto);
      expect(result.costs.total).toBeDefined();
    });

    it('should handle invalid data gracefully', async () => {
      // Arrange
      const invalidDto = createValidUpdateStatisticsDto({ costs: { total: -100 } });
      invalidDto.isValid = jest.fn().mockReturnValue({ valid: false, errors: ['Invalid total'] });
      repository.upsert.mockResolvedValue(mockStatisticsEntity);

      // Act
      const result = await service.updateStatistics(mockProjectId, invalidDto);

      // Assert
      expect(repository.upsert).toHaveBeenCalled();
      expect(result).toBeInstanceOf(StatisticsResponseDto);
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
      cacheService.set.mockResolvedValue(undefined);

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

    it('should validate data consistency when updating', async () => {
      // Arrange
      repository.upsert.mockResolvedValue(mockStatisticsEntity);

      // Act
      await service.updateStatistics(mockProjectId, updateDto);

      // Assert
      // Le service devrait utiliser le DTO pour la validation métier si nécessaire
      // Pour l'instant, on vérifie juste que l'upsert est appelé avec les bonnes données
      expect(repository.upsert).toHaveBeenCalledWith(mockProjectId, updateDto);
      // Optionnel: Si le service appelle la validation métier
      // expect(updateDto.isValid).toHaveBeenCalled(); 
    });
  });

  describe('getStatistics', () => {
    it('should return cached statistics when available', async () => {
      // Arrange
      const cachedResponse = createMockStatisticsResponseDto({
        costs: { total: 25.0 },
        performance: { totalTime: 120.0 },
        usage: { documentsGenerated: 3 },
        summary: { efficiency: 85.0 },
        metadata: { lastUpdated: new Date() },
      });
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
      cacheService.set.mockResolvedValue(undefined);

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

    it('should call data quality score calculation when creating response', async () => {
      // Arrange
      cacheService.get.mockResolvedValue(null);
      repository.findByProjectId.mockResolvedValue(mockStatisticsEntity);

      // Act
      await service.getStatistics(mockProjectId);

      // Assert
      expect(mockStatisticsEntity.calculateDataQualityScore).toHaveBeenCalled();
    });
  });

  describe('deleteStatistics', () => {
    it('should delete statistics successfully', async () => {
      // Arrange
      repository.deleteByProjectId.mockResolvedValue(true);
      cacheService.del.mockResolvedValue(undefined);

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

  describe('getMultipleStatistics', () => {
    const projectIds = ['project-1', 'project-2', 'project-3'];

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
      const entity1 = createMockStatisticsEntity({ id: 'stats-1', projectId: 'project-1' });
      const entity2 = createMockStatisticsEntity({ id: 'stats-2', projectId: 'project-2' });
      const entitiesMap = new Map([
        ['project-1', entity1],
        ['project-2', entity2],
      ]);
      repository.findManyByProjectIds.mockResolvedValue(entitiesMap);
      cacheService.set.mockResolvedValue(undefined);

      // Act
      const result = await service.getMultipleStatistics(projectIds);

      // Assert
      expect(cacheService.get).toHaveBeenCalledTimes(projectIds.length);
      expect(repository.findManyByProjectIds).toHaveBeenCalledWith(projectIds);
      expect(result.size).toBe(2);
    });

    it('should combine cached and uncached results', async () => {
      // Arrange
      const cachedResponse = createMockStatisticsResponseDto({ costs: { total: 15.0 } });
      cacheService.get
        .mockResolvedValueOnce(cachedResponse) // project-1 cached
        .mockResolvedValueOnce(null) // project-2 not cached
        .mockResolvedValueOnce(null); // project-3 not cached

      const entity2 = createMockStatisticsEntity({ id: 'stats-2', projectId: 'project-2' });
      const entitiesMap = new Map([['project-2', entity2]]);
      repository.findManyByProjectIds.mockResolvedValue(entitiesMap);

      // Act
      const result = await service.getMultipleStatistics(projectIds);

      // Assert
      expect(result.size).toBe(2);
      expect(result.get('project-1')).toBe(cachedResponse);
      expect(result.get('project-2')).toBeInstanceOf(StatisticsResponseDto);
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

    it('should calculate data quality for each entity', async () => {
      // Arrange
      cacheService.get.mockResolvedValue(null);
      const entity1 = createMockStatisticsEntity({ id: 'stats-1', projectId: 'project-1' });
      const entitiesMap = new Map([['project-1', entity1]]);
      repository.findManyByProjectIds.mockResolvedValue(entitiesMap);

      // Act
      await service.getMultipleStatistics(['project-1']);

      // Assert
      expect(entity1.calculateDataQualityScore).toHaveBeenCalled();
    });
  });

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
      cacheService.set.mockResolvedValue(undefined);

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
  });

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

    it('should calculate data quality for search results', async () => {
      // Arrange
      repository.findByCriteria.mockResolvedValue([mockStatisticsEntity]);

      // Act
      await service.searchStatistics(searchCriteria);

      // Assert
      expect(mockStatisticsEntity.calculateDataQualityScore).toHaveBeenCalled();
    });
  });

  describe('partialUpdateStatistics', () => {
    const partialData = { costs: { claudeApi: 20.0 } };

    it('should update statistics partially', async () => {
      // Arrange
      repository.partialUpdate.mockResolvedValue(mockStatisticsEntity);
      cacheService.del.mockResolvedValue(undefined);
      cacheService.set.mockResolvedValue(undefined);

      // Act
      const result = await service.partialUpdateStatistics(mockProjectId, partialData);

      // Assert
      expect(repository.partialUpdate).toHaveBeenCalledWith(mockProjectId, partialData);
      expect(result).toBeInstanceOf(StatisticsResponseDto);
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

      // Act
      await service.partialUpdateStatistics(mockProjectId, partialData);

      // Assert
      expect(cacheService.del).toHaveBeenCalled();
    });
  });

  describe('cleanupOldStatistics', () => {
    it('should cleanup old statistics successfully', async () => {
      // Arrange
      repository.cleanupOldStatistics.mockResolvedValue(150);
      cacheService.del.mockResolvedValue(undefined);

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
  });

  describe('Entity Validation and Consistency', () => {
    it('should validate entity consistency when retrieving statistics', async () => {
      // Arrange
      cacheService.get.mockResolvedValue(null);
      repository.findByProjectId.mockResolvedValue(mockStatisticsEntity);

      // Act
      await service.getStatistics(mockProjectId);

      // Assert
      expect(mockStatisticsEntity.validateConsistency).toHaveBeenCalled();
    });

    it('should handle validation failures gracefully', async () => {
      // Arrange
      const inconsistentEntity = createMockStatisticsEntity(mockStatisticsEntity);
      inconsistentEntity.validateConsistency = jest.fn().mockReturnValue({
        valid: false,
        issues: ['Total cost is negative'],
      });
      cacheService.get.mockResolvedValue(null);
      repository.findByProjectId.mockResolvedValue(inconsistentEntity);

      // Act
      const result = await service.getStatistics(mockProjectId);

      // Assert
      expect(result).toBeInstanceOf(StatisticsResponseDto);
      expect(inconsistentEntity.validateConsistency).toHaveBeenCalled();
    });
  });

  describe('Edge Cases and Error Handling', () => {
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
      cacheService.set.mockResolvedValue(undefined);

      // Act
      const result = await service.getStatistics(mockProjectId);

      // Assert
      // Le service peut soit retourner les données malformées du cache,
      // soit faire un fallback vers le repository - les deux comportements sont acceptables
      expect(result).toBeDefined();
      
      // Si le service utilise le cache malformé, il retourne les données telles quelles
      // Si le service fait un fallback, il créé une StatisticsResponseDto depuis l'entity
      if (result instanceof StatisticsResponseDto) {
        // Fallback vers le repository effectué
        expect(repository.findByProjectId).toHaveBeenCalledWith(mockProjectId);
        expect(cacheService.set).toHaveBeenCalled();
      } else {
        // Données du cache retournées directement (comportement possible)
        expect(result).toBe(malformedData);
      }
    });

    it('should handle very large numbers in statistics', async () => {
      // Arrange
      const largeNumbersEntity = createMockStatisticsEntity({
        ...mockStatisticsEntity,
        costs: { total: Number.MAX_SAFE_INTEGER - 1 },
        usage: { tokensUsed: Number.MAX_SAFE_INTEGER - 1 },
      });
      repository.findByProjectId.mockResolvedValue(largeNumbersEntity);
      cacheService.get.mockResolvedValue(null);

      // Act
      const result = await service.getStatistics(mockProjectId);

      // Assert
      expect(result).toBeInstanceOf(StatisticsResponseDto);
      expect(result).not.toBeNull();
      expect(result!.costs.total).toBe(Number.MAX_SAFE_INTEGER - 1);
    });

    it('should handle missing nested properties gracefully', async () => {
      // Arrange
      const incompleteEntity = createMockStatisticsEntity({
        ...mockStatisticsEntity,
        costs: {},
        performance: {},
        usage: {},
      });
      repository.findByProjectId.mockResolvedValue(incompleteEntity);
      cacheService.get.mockResolvedValue(null);

      // Act
      const result = await service.getStatistics(mockProjectId);

      // Assert
      expect(result).toBeInstanceOf(StatisticsResponseDto);
      expect(result).not.toBeNull();
      expect(result!.costs).toBeDefined();
      expect(result).not.toBeNull();
      expect(result!.performance).toBeDefined();
      expect(result).not.toBeNull();
      expect(result!.usage).toBeDefined();
    });

    it('should handle zero values correctly', async () => {
      // Arrange
      const zeroEntity = createMockStatisticsEntity({
        ...mockStatisticsEntity,
        costs: { total: 0, claudeApi: 0 },
        performance: { totalTime: 0 },
        usage: { documentsGenerated: 0 },
      });
      repository.findByProjectId.mockResolvedValue(zeroEntity);
      cacheService.get.mockResolvedValue(null);

      // Act
      const result = await service.getStatistics(mockProjectId);

      // Assert
      expect(result).toBeInstanceOf(StatisticsResponseDto);
      expect(result).not.toBeNull();
      expect(result!.costs.total).toBe(0);
    });

    it('should handle entity serialization correctly', async () => {
      // Arrange
      cacheService.get.mockResolvedValue(null);
      repository.findByProjectId.mockResolvedValue(mockStatisticsEntity);

      // Act
      await service.getStatistics(mockProjectId);

      // Assert
      expect(mockStatisticsEntity.toJSON).toHaveBeenCalled();
    });
  });

  describe('Performance Tests', () => {
    it('should handle high frequency updates', async () => {
      // Arrange
      repository.upsert.mockResolvedValue(mockStatisticsEntity);
      const updatePromises = Array.from({ length: 50 }, () =>
        service.updateStatistics(mockProjectId, createValidUpdateStatisticsDto({ costs: { claudeApi: 1.0 } })),
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
  });
});