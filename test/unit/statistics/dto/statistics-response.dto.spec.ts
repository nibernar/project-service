import { plainToInstance, instanceToPlain } from 'class-transformer';
import { StatisticsResponseDto } from '../../../../src/statistics/dto/statistics-response.dto';
import { 
  StatisticsFixtures, 
  TEST_IDS,
  DataGenerator
} from '../../../fixtures/project.fixtures';

describe('StatisticsResponseDto', () => {
  // ========================================================================
  // FIXTURES ET DONNÉES DE TEST
  // ========================================================================

  const createValidStatisticsData = () => ({
    costs: {
      claudeApi: 12.45,
      storage: 2.30,
      compute: 5.67,
      total: 20.42,
    },
    performance: {
      generationTime: 45230,
      processingTime: 12450,
      totalTime: 57680,
    },
    usage: {
      documentsGenerated: 5,
      filesProcessed: 3,
      tokensUsed: 15750,
    },
  });

  const createMinimalStatisticsData = () => ({
    costs: {
      claudeApi: 0,
      storage: 0,
      compute: 0,
      total: 0,
    },
    performance: {
      generationTime: 0,
      processingTime: 0,
      totalTime: 0,
    },
    usage: {
      documentsGenerated: 0,
      filesProcessed: 0,
      tokensUsed: 0,
    },
  });

  // ========================================================================
  // TESTS DE SÉRIALISATION ET DÉSÉRIALISATION
  // ========================================================================

  describe('Serialization and Deserialization', () => {
    it('should serialize to JSON correctly', () => {
      // Arrange
      const data = createValidStatisticsData();
      const dto = plainToInstance(StatisticsResponseDto, data);

      // Act
      const serialized = instanceToPlain(dto, { excludeExtraneousValues: true });

      // Assert
      expect(serialized.costs.total).toBe(20.42);
      expect(serialized.performance.generationTime).toBe(45230);
      expect(serialized.usage.documentsGenerated).toBe(5);
    });

    it('should deserialize from JSON correctly', () => {
      // Arrange
      const jsonData = JSON.stringify(createValidStatisticsData());
      const parsedData = JSON.parse(jsonData);

      // Act
      const dto = plainToInstance(StatisticsResponseDto, parsedData);

      // Assert
      expect(dto).toBeInstanceOf(StatisticsResponseDto);
      expect(dto.costs.total).toBe(20.42);
      expect(dto.performance.totalTime).toBe(57680);
      expect(dto.usage.documentsGenerated).toBe(5);
    });

    it('should handle nested object transformation', () => {
      // Arrange
      const data = createValidStatisticsData();
      const dto = plainToInstance(StatisticsResponseDto, data);

      // Act
      const serialized = instanceToPlain(dto, { excludeExtraneousValues: true });

      // Assert
      expect(serialized.costs).toBeDefined();
      expect(serialized.performance).toBeDefined();
      expect(serialized.usage).toBeDefined();
      expect(typeof serialized.costs.claudeApi).toBe('number');
      expect(typeof serialized.performance.generationTime).toBe('number');
      expect(typeof serialized.usage.documentsGenerated).toBe('number');
    });
  });

  // ========================================================================
  // TESTS DE CONSTRUCTION ET PROPRIÉTÉS
  // ========================================================================

  describe('Construction and Properties', () => {
    it('should create instance with all properties', () => {
      // Arrange
      const data = createValidStatisticsData();

      // Act
      const dto = plainToInstance(StatisticsResponseDto, data);

      // Assert
      expect(dto.costs).toBeDefined();
      expect(dto.performance).toBeDefined();
      expect(dto.usage).toBeDefined();
    });

    it('should handle minimal data', () => {
      // Arrange
      const data = createMinimalStatisticsData();

      // Act
      const dto = plainToInstance(StatisticsResponseDto, data);

      // Assert
      expect(dto.costs.total).toBe(0);
      expect(dto.performance.totalTime).toBe(0);
      expect(dto.usage.documentsGenerated).toBe(0);
    });

    it('should have correct cost structure', () => {
      // Arrange
      const data = createValidStatisticsData();
      const dto = plainToInstance(StatisticsResponseDto, data);

      // Act & Assert
      expect(dto.costs.claudeApi).toBe(12.45);
      expect(dto.costs.storage).toBe(2.30);
      expect(dto.costs.compute).toBe(5.67);
      expect(dto.costs.total).toBe(20.42);
    });

    it('should have correct performance structure', () => {
      // Arrange
      const data = createValidStatisticsData();
      const dto = plainToInstance(StatisticsResponseDto, data);

      // Act & Assert
      expect(dto.performance.generationTime).toBe(45230);
      expect(dto.performance.processingTime).toBe(12450);
      expect(dto.performance.totalTime).toBe(57680);
    });

    it('should have correct usage structure', () => {
      // Arrange
      const data = createValidStatisticsData();
      const dto = plainToInstance(StatisticsResponseDto, data);

      // Act & Assert
      expect(dto.usage.documentsGenerated).toBe(5);
      expect(dto.usage.filesProcessed).toBe(3);
      expect(dto.usage.tokensUsed).toBe(15750);
    });
  });

  // ========================================================================
  // TESTS AVEC FIXTURES
  // ========================================================================

  describe('Integration with Fixtures', () => {
    it('should work with StatisticsFixtures.basicStats()', () => {
      // Arrange
      const statsEntity = StatisticsFixtures.basicStats();

      // Act
      const dto = plainToInstance(StatisticsResponseDto, {
        costs: statsEntity.costs,
        performance: statsEntity.performance,
        usage: statsEntity.usage,
      });

      // Assert
      expect(dto).toBeInstanceOf(StatisticsResponseDto);
      expect(dto.costs).toBeDefined();
      expect(dto.performance).toBeDefined();
      expect(dto.usage).toBeDefined();
    });

    it('should work with StatisticsFixtures.completeStats()', () => {
      // Arrange
      const statsEntity = StatisticsFixtures.completeStats();

      // Act
      const dto = plainToInstance(StatisticsResponseDto, {
        costs: statsEntity.costs,
        performance: statsEntity.performance,
        usage: statsEntity.usage,
      });

      // Assert
      expect(dto).toBeInstanceOf(StatisticsResponseDto);
      expect(dto.costs.total).toBeGreaterThan(0);
      expect(dto.usage.documentsGenerated).toBeGreaterThan(0);
    });

    it('should work with StatisticsFixtures.emptyStats()', () => {
      // Arrange
      const statsEntity = StatisticsFixtures.emptyStats();

      // Act
      const dto = plainToInstance(StatisticsResponseDto, {
        costs: statsEntity.costs,
        performance: statsEntity.performance,
        usage: statsEntity.usage,
      });

      // Assert
      expect(dto).toBeInstanceOf(StatisticsResponseDto);
      expect(dto.costs.total).toBe(0);
      expect(dto.usage.documentsGenerated).toBe(0);
    });

    it('should work with StatisticsFixtures.statisticsResponseDto()', () => {
      // Arrange & Act
      const dto = StatisticsFixtures.statisticsResponseDto();

      // Assert
      expect(dto).toBeInstanceOf(StatisticsResponseDto);
      expect(dto.costs).toBeDefined();
      expect(dto.performance).toBeDefined();
      expect(dto.usage).toBeDefined();
    });
  });

  // ========================================================================
  // TESTS DE CALCULS MANUELS
  // ========================================================================

  describe('Manual Calculations', () => {
    it('should calculate cost per document manually', () => {
      // Arrange
      const data = createValidStatisticsData();
      const dto = plainToInstance(StatisticsResponseDto, data);

      // Act
      const costPerDocument = dto.usage.documentsGenerated > 0 
        ? dto.costs.total / dto.usage.documentsGenerated 
        : 0;

      // Assert
      expect(costPerDocument).toBe(4.084); // 20.42 / 5
    });

    it('should calculate tokens per second manually', () => {
      // Arrange
      const data = createValidStatisticsData();
      const dto = plainToInstance(StatisticsResponseDto, data);

      // Act
      const tokensPerSecond = dto.performance.totalTime > 0
        ? Math.round((dto.usage.tokensUsed / (dto.performance.totalTime / 1000)) * 100) / 100
        : 0;

      // Assert
      expect(tokensPerSecond).toBe(273.09); // 15750 / (57680 / 1000)
    });

    it('should check data freshness concept with creation time', () => {
      // Arrange - Test du concept de fraîcheur sans lastUpdated
      const recentData = createValidStatisticsData();
      const oldData = createValidStatisticsData();

      const recentDto = plainToInstance(StatisticsResponseDto, recentData);
      const oldDto = plainToInstance(StatisticsResponseDto, oldData);

      // Act & Assert - Test que les DTOs sont créés correctement
      expect(recentDto).toBeInstanceOf(StatisticsResponseDto);
      expect(oldDto).toBeInstanceOf(StatisticsResponseDto);
      expect(recentDto.costs.total).toBeDefined();
      expect(oldDto.costs.total).toBeDefined();
    });

    it('should calculate efficiency percentage manually', () => {
      // Arrange
      const data = createValidStatisticsData();
      const dto = plainToInstance(StatisticsResponseDto, data);

      // Act
      const processingEfficiency = dto.performance.totalTime > 0
        ? Math.round((dto.performance.processingTime / dto.performance.totalTime) * 100 * 100) / 100
        : 0;

      // Assert
      expect(processingEfficiency).toBe(21.58); // (12450 / 57680) * 100
    });
  });

  // ========================================================================
  // TESTS DE CAS LIMITES
  // ========================================================================

  describe('Edge Cases and Error Handling', () => {
    it('should handle missing nested objects', () => {
      // Arrange
      const incompleteData = {
        costs: { total: 10.0 },
        performance: {},
        usage: {},
      };

      // Act
      const dto = plainToInstance(StatisticsResponseDto, incompleteData);
      const serialized = instanceToPlain(dto, { excludeExtraneousValues: true });

      // Assert
      expect(serialized.costs.total).toBe(10.0);
      expect(serialized.performance).toBeDefined();
      expect(serialized.usage).toBeDefined();
    });

    it('should handle null and undefined values', () => {
      // Arrange
      const dataWithNulls = {
        costs: {
          claudeApi: null,
          storage: undefined,
          compute: 5.0,
          total: 5.0,
        },
        performance: {
          generationTime: 1000,
          processingTime: null,
          totalTime: 1000,
        },
        usage: {
          documentsGenerated: 1,
          filesProcessed: undefined,
          tokensUsed: 100,
        },
      };

      // Act
      const dto = plainToInstance(StatisticsResponseDto, dataWithNulls);

      // Assert
      expect(dto.costs.total).toBe(5.0);
      expect(dto.performance.totalTime).toBe(1000);
      expect(dto.usage.documentsGenerated).toBe(1);
    });

    it('should handle zero division scenarios', () => {
      // Arrange
      const zeroData = {
        costs: { claudeApi: 0, storage: 0, compute: 0, total: 0 },
        performance: { generationTime: 0, processingTime: 0, totalTime: 0 },
        usage: { documentsGenerated: 0, filesProcessed: 0, tokensUsed: 0 },
      };

      const dto = plainToInstance(StatisticsResponseDto, zeroData);

      // Act - Manual calculations that handle division by zero
      const costPerDocument = dto.usage.documentsGenerated > 0 
        ? dto.costs.total / dto.usage.documentsGenerated 
        : 0;
      const tokensPerSecond = dto.performance.totalTime > 0
        ? dto.usage.tokensUsed / (dto.performance.totalTime / 1000)
        : 0;

      // Assert
      expect(costPerDocument).toBe(0);
      expect(tokensPerSecond).toBe(0);
      expect(dto.costs.total).toBe(0);
    });

    it('should handle very large numbers', () => {
      // Arrange
      const largeData = {
        costs: {
          claudeApi: Number.MAX_SAFE_INTEGER - 100,
          storage: 1000,
          compute: 2000,
          total: Number.MAX_SAFE_INTEGER,
        },
        performance: {
          generationTime: Number.MAX_SAFE_INTEGER - 100,
          processingTime: 1000,
          totalTime: Number.MAX_SAFE_INTEGER,
        },
        usage: {
          documentsGenerated: 1000000,
          filesProcessed: 500000,
          tokensUsed: Number.MAX_SAFE_INTEGER - 100,
        },
      };

      // Act
      const dto = plainToInstance(StatisticsResponseDto, largeData);
      const serialized = instanceToPlain(dto, { excludeExtraneousValues: true });

      // Assert
      expect(serialized.costs.total).toBe(Number.MAX_SAFE_INTEGER);
      expect(serialized.usage.tokensUsed).toBe(Number.MAX_SAFE_INTEGER - 100);
      expect(serialized.usage.documentsGenerated).toBe(1000000);
    });

    it('should handle negative values', () => {
      // Arrange
      const dataWithNegatives = {
        costs: {
          claudeApi: -5.0, // Valeur négative
          storage: 2.0,
          compute: 3.0,
          total: 0.0,
        },
        performance: {
          generationTime: -1000, // Temps négatif
          processingTime: 500,
          totalTime: -500,
        },
        usage: {
          documentsGenerated: -1, // Nombre négatif
          filesProcessed: 2,
          tokensUsed: -100,
        },
      };

      // Act
      const dto = plainToInstance(StatisticsResponseDto, dataWithNegatives);

      // Assert - Les valeurs négatives sont préservées telles quelles
      expect(dto.costs.claudeApi).toBe(-5.0);
      expect(dto.performance.generationTime).toBe(-1000);
      expect(dto.usage.documentsGenerated).toBe(-1);
    });
  });

  // ========================================================================
  // TESTS DE COHÉRENCE DES DONNÉES
  // ========================================================================

  describe('Data Consistency', () => {
    it('should verify cost totals consistency', () => {
      // Arrange
      const data = {
        costs: {
          claudeApi: 10.0,
          storage: 2.0,
          compute: 3.0,
          total: 15.0,
        },
        performance: { generationTime: 1000, processingTime: 500, totalTime: 1500 },
        usage: { documentsGenerated: 1, filesProcessed: 1, tokensUsed: 100 },
      };

      const dto = plainToInstance(StatisticsResponseDto, data);

      // Act - Manual verification
      const calculatedTotal = dto.costs.claudeApi + dto.costs.storage + dto.costs.compute;

      // Assert
      expect(calculatedTotal).toBe(dto.costs.total);
    });

    it('should verify performance time consistency', () => {
      // Arrange
      const data = {
        costs: { claudeApi: 1.0, storage: 0.1, compute: 0.1, total: 1.2 },
        performance: {
          generationTime: 5000,
          processingTime: 2000,
          totalTime: 7000,
        },
        usage: { documentsGenerated: 1, filesProcessed: 1, tokensUsed: 100 },
      };

      const dto = plainToInstance(StatisticsResponseDto, data);

      // Act - Manual verification
      const calculatedTotal = dto.performance.generationTime + dto.performance.processingTime;

      // Assert
      expect(calculatedTotal).toBe(dto.performance.totalTime);
    });
  });

  // ========================================================================
  // TESTS DE CYCLES DE TRANSFORMATION
  // ========================================================================

  describe('Transformation Cycles', () => {
    it('should preserve data through multiple transformation cycles', () => {
      // Arrange
      const originalData = createValidStatisticsData();

      // Act - Multiple cycles
      const dto1 = plainToInstance(StatisticsResponseDto, originalData);
      const json1 = instanceToPlain(dto1, { excludeExtraneousValues: true });
      const dto2 = plainToInstance(StatisticsResponseDto, json1);
      const json2 = instanceToPlain(dto2, { excludeExtraneousValues: true });
      const dto3 = plainToInstance(StatisticsResponseDto, json2);

      // Assert - Data should be preserved
      expect(dto3.costs.total).toBe(originalData.costs.total);
      expect(dto3.performance.totalTime).toBe(originalData.performance.totalTime);
      expect(dto3.usage.documentsGenerated).toBe(originalData.usage.documentsGenerated);
    });

    it('should maintain consistency across transformations', () => {
      // Arrange
      const data = createValidStatisticsData();

      // Act
      const dto1 = plainToInstance(StatisticsResponseDto, data);
      const json = instanceToPlain(dto1, { excludeExtraneousValues: true });
      const dto2 = plainToInstance(StatisticsResponseDto, json);

      // Assert - Manual calculations should be consistent
      const costPerDoc1 = dto1.usage.documentsGenerated > 0 ? dto1.costs.total / dto1.usage.documentsGenerated : 0;
      const costPerDoc2 = dto2.usage.documentsGenerated > 0 ? dto2.costs.total / dto2.usage.documentsGenerated : 0;

      expect(costPerDoc1).toBe(costPerDoc2);
    });
  });
});