import 'reflect-metadata';

// Interface pour typer les erreurs de validation mockées
interface MockValidationError {
  property: string;
  constraints: Record<string, string>;
}

// Mock du module class-validator AVANT l'import
jest.mock('class-validator', () => ({
  validate: jest.fn().mockResolvedValue([]),
  ValidationError: class MockValidationError {
    property: string;
    constraints: Record<string, string>;
    constructor() {
      this.property = '';
      this.constraints = {};
    }
  },
  // Inclure tous les décorateurs utilisés
  IsOptional: () => () => {},
  IsObject: () => () => {},
  IsNumber: () => () => {},
  IsInt: () => () => {},
  IsString: () => () => {},
  IsDate: () => () => {},
  IsISO4217CurrencyCode: () => () => {},
  Min: () => () => {},
  Max: () => () => {},
  ValidateNested: () => () => {},
  IsPositive: () => () => {},
  IsIn: () => () => {},
  Length: () => () => {},
  Matches: () => () => {},
}));

// Import APRÈS le mock
import { plainToClass } from 'class-transformer';
import { validate } from 'class-validator';
import {
  UpdateStatisticsDto,
  CostsStatisticsDto,
  PerformanceStatisticsDto,
  UsageStatisticsDto,
  StatisticsMetadataDto,
} from '../../../../src/statistics/dto/update-statistics.dto';

// Récupération de la fonction mockée
const mockValidate = validate as jest.MockedFunction<typeof validate>;

describe('UpdateStatisticsDto', () => {
  beforeEach(() => {
    mockValidate.mockClear();
    mockValidate.mockResolvedValue([]); // Par défaut, pas d'erreurs
  });

  // Helper pour créer des erreurs de validation mockées
  function createValidationError(property: string, constraints: Record<string, string>): MockValidationError {
    return { property, constraints };
  }

  describe('CostsStatisticsDto', () => {
    it('should validate valid cost data', async () => {
      // Arrange
      const validData = {
        claudeApi: 12.45,
        storage: 2.30,
        compute: 5.67,
        bandwidth: 1.23,
        total: 21.65,
        currency: 'USD',
      };

      // Act
      const dto = plainToClass(CostsStatisticsDto, validData);
      const errors = await mockValidate(dto);

      // Assert
      expect(errors).toHaveLength(0);
      expect(dto.claudeApi).toBe(12.45);
      expect(dto.currency).toBe('USD');
    });

    it('should reject negative costs', async () => {
      // Arrange
      const invalidData = {
        claudeApi: -5.0,
        storage: -1.0,
        total: -6.0,
      };

      mockValidate.mockResolvedValue([
        createValidationError('claudeApi', { min: 'claudeApi must not be less than 0' }),
        createValidationError('storage', { min: 'storage must not be less than 0' }),
        createValidationError('total', { min: 'total must not be less than 0' }),
      ]);

      // Act
      const dto = plainToClass(CostsStatisticsDto, invalidData);
      const errors = await mockValidate(dto);

      // Assert
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e: MockValidationError) => e.property === 'claudeApi')).toBe(true);
      expect(errors.some((e: MockValidationError) => e.property === 'storage')).toBe(true);
      expect(errors.some((e: MockValidationError) => e.property === 'total')).toBe(true);
    });

    it('should reject invalid currency codes', async () => {
      // Arrange
      const invalidData = {
        claudeApi: 10.0,
        currency: 'INVALID',
      };

      mockValidate.mockResolvedValue([
        createValidationError('currency', { isISO4217CurrencyCode: 'currency must be a valid ISO 4217 currency code' }),
      ]);

      // Act
      const dto = plainToClass(CostsStatisticsDto, invalidData);
      const errors = await mockValidate(dto);

      // Assert
      expect(errors.some((e: MockValidationError) => e.property === 'currency')).toBe(true);
    });

    it('should handle precision in decimal values', async () => {
      // Arrange
      const preciseData = {
        claudeApi: 12.123456789,
        total: 12.123456789,
      };

      mockValidate.mockResolvedValue([
        createValidationError('claudeApi', { maxDecimalPlaces: 'claudeApi must have at most 4 decimal places' }),
        createValidationError('total', { maxDecimalPlaces: 'total must have at most 4 decimal places' }),
      ]);

      // Act
      const dto = plainToClass(CostsStatisticsDto, preciseData);
      const errors = await mockValidate(dto);

      // Assert
      expect(errors.some((e: MockValidationError) => e.constraints && Object.keys(e.constraints).some(key => key.includes('maxDecimalPlaces')))).toBe(true);
    });

    it('should accept valid ISO currency codes', async () => {
      // Arrange
      const validCurrencies = ['USD', 'EUR', 'GBP', 'JPY', 'CAD'];

      for (const currency of validCurrencies) {
        // Act
        const dto = plainToClass(CostsStatisticsDto, {
          claudeApi: 10.0,
          currency,
        });
        const errors = await mockValidate(dto);

        // Assert
        expect(errors.filter((e: MockValidationError) => e.property === 'currency')).toHaveLength(0);
      }
    });

    it('should handle zero values correctly', async () => {
      // Arrange
      const zeroData = {
        claudeApi: 0,
        storage: 0,
        total: 0,
      };

      // Act
      const dto = plainToClass(CostsStatisticsDto, zeroData);
      const errors = await mockValidate(dto);

      // Assert
      expect(errors).toHaveLength(0);
      expect(dto.total).toBe(0);
    });
  });

  describe('PerformanceStatisticsDto', () => {
    it('should validate valid performance data', async () => {
      // Arrange
      const validData = {
        generationTime: 45.23,
        processingTime: 12.45,
        interviewTime: 180.75,
        exportTime: 8.90,
        totalTime: 247.33,
        queueWaitTime: 5.12,
      };

      // Act
      const dto = plainToClass(PerformanceStatisticsDto, validData);
      const errors = await mockValidate(dto);

      // Assert
      expect(errors).toHaveLength(0);
      expect(dto.totalTime).toBe(247.33);
    });

    it('should reject negative time values', async () => {
      // Arrange
      const invalidData = {
        generationTime: -10.0,
        totalTime: -50.0,
      };

      mockValidate.mockResolvedValue([
        createValidationError('generationTime', { min: 'generationTime must not be less than 0' }),
        createValidationError('totalTime', { min: 'totalTime must not be less than 0' }),
      ]);

      // Act
      const dto = plainToClass(PerformanceStatisticsDto, invalidData);
      const errors = await mockValidate(dto);

      // Assert
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e: MockValidationError) => e.property === 'generationTime')).toBe(true);
      expect(errors.some((e: MockValidationError) => e.property === 'totalTime')).toBe(true);
    });

    it('should handle very large time values', async () => {
      // Arrange
      const largeData = {
        totalTime: Number.MAX_SAFE_INTEGER - 1,
      };

      // Act
      const dto = plainToClass(PerformanceStatisticsDto, largeData);
      const errors = await mockValidate(dto);

      // Assert
      expect(errors).toHaveLength(0);
      expect(dto.totalTime).toBe(Number.MAX_SAFE_INTEGER - 1);
    });

    it('should handle floating point precision', async () => {
      // Arrange
      const preciseData = {
        generationTime: 45.123,
        processingTime: 12.456,
      };

      // Act
      const dto = plainToClass(PerformanceStatisticsDto, preciseData);
      const errors = await mockValidate(dto);

      // Assert
      expect(errors).toHaveLength(0);
      expect(dto.generationTime).toBe(45.123);
    });
  });

  describe('UsageStatisticsDto', () => {
    it('should validate valid usage data', async () => {
      // Arrange
      const validData = {
        documentsGenerated: 5,
        filesProcessed: 3,
        tokensUsed: 15750,
        apiCallsCount: 12,
        storageSize: 2048576,
        exportCount: 2,
      };

      // Act
      const dto = plainToClass(UsageStatisticsDto, validData);
      const errors = await mockValidate(dto);

      // Assert
      expect(errors).toHaveLength(0);
      expect(dto.documentsGenerated).toBe(5);
      expect(dto.tokensUsed).toBe(15750);
    });

    it('should reject negative integer values', async () => {
      // Arrange
      const invalidData = {
        documentsGenerated: -5,
        tokensUsed: -1000,
        storageSize: -1024,
      };

      mockValidate.mockResolvedValue([
        createValidationError('documentsGenerated', { min: 'documentsGenerated must not be less than 0' }),
        createValidationError('tokensUsed', { min: 'tokensUsed must not be less than 0' }),
        createValidationError('storageSize', { min: 'storageSize must not be less than 0' }),
      ]);

      // Act
      const dto = plainToClass(UsageStatisticsDto, invalidData);
      const errors = await mockValidate(dto);

      // Assert
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e: MockValidationError) => e.property === 'documentsGenerated')).toBe(true);
      expect(errors.some((e: MockValidationError) => e.property === 'tokensUsed')).toBe(true);
      expect(errors.some((e: MockValidationError) => e.property === 'storageSize')).toBe(true);
    });

    it('should reject non-integer values', async () => {
      // Arrange
      const invalidData = {
        documentsGenerated: 5.5,
        tokensUsed: 1000.75,
      };

      mockValidate.mockResolvedValue([
        createValidationError('documentsGenerated', { isInt: 'documentsGenerated must be an integer number' }),
        createValidationError('tokensUsed', { isInt: 'tokensUsed must be an integer number' }),
      ]);

      // Act
      const dto = plainToClass(UsageStatisticsDto, invalidData);
      const errors = await mockValidate(dto);

      // Assert
      expect(errors.some((e: MockValidationError) => e.property === 'documentsGenerated')).toBe(true);
      expect(errors.some((e: MockValidationError) => e.property === 'tokensUsed')).toBe(true);
    });

    it('should handle very large integer values', async () => {
      // Arrange
      const largeData = {
        tokensUsed: Number.MAX_SAFE_INTEGER - 1,
        storageSize: Number.MAX_SAFE_INTEGER - 1,
      };

      // Act
      const dto = plainToClass(UsageStatisticsDto, largeData);
      const errors = await mockValidate(dto);

      // Assert
      expect(errors).toHaveLength(0);
    });

    it('should handle zero values correctly', async () => {
      // Arrange
      const zeroData = {
        documentsGenerated: 0,
        filesProcessed: 0,
        tokensUsed: 0,
      };

      // Act
      const dto = plainToClass(UsageStatisticsDto, zeroData);
      const errors = await mockValidate(dto);

      // Assert
      expect(errors).toHaveLength(0);
    });
  });

  describe('StatisticsMetadataDto', () => {
    it('should validate valid metadata', async () => {
      // Arrange
      const validData = {
        source: 'cost-tracking-service',
        timestamp: new Date('2024-08-18T10:30:00Z'),
        version: '1.0.0',
        batchId: 'batch-2024081810-abc123',
        confidence: 0.95,
      };

      // Act
      const dto = plainToClass(StatisticsMetadataDto, validData);
      const errors = await mockValidate(dto);

      // Assert
      expect(errors).toHaveLength(0);
      expect(dto.source).toBe('cost-tracking-service');
      expect(dto.confidence).toBe(0.95);
    });

    it('should reject invalid source values', async () => {
      // Arrange
      const invalidData = {
        source: 'invalid-service',
      };

      mockValidate.mockResolvedValue([
        createValidationError('source', { isIn: 'source must be one of the following values: cost-tracking-service, monitoring-service, orchestration-service, generation-agent-service, document-processing-service, export-service' }),
      ]);

      // Act
      const dto = plainToClass(StatisticsMetadataDto, invalidData);
      const errors = await mockValidate(dto);

      // Assert
      expect(errors.some((e: MockValidationError) => e.property === 'source')).toBe(true);
    });

    it('should validate semantic version format', async () => {
      // Arrange
      const invalidVersions = ['1.0', 'v1.0.0', '1.0.0-beta', 'invalid'];

      for (const version of invalidVersions) {
        mockValidate.mockResolvedValue([
          createValidationError('version', { matches: 'Version must follow semantic versioning format (x.y.z)' }),
        ]);

        // Act
        const dto = plainToClass(StatisticsMetadataDto, { version });
        const errors = await mockValidate(dto);

        // Assert
        expect(errors.some((e: MockValidationError) => e.property === 'version')).toBe(true);
      }
    });

    it('should validate valid semantic versions', async () => {
      // Arrange
      const validVersions = ['1.0.0', '2.1.3', '0.0.1', '10.20.30'];

      for (const version of validVersions) {
        // Reset mock pour chaque version valide
        mockValidate.mockResolvedValue([]);

        // Act
        const dto = plainToClass(StatisticsMetadataDto, { version });
        const errors = await mockValidate(dto);

        // Assert
        expect(errors.filter((e: MockValidationError) => e.property === 'version')).toHaveLength(0);
      }
    });

    it('should validate confidence range', async () => {
      // Arrange
      const invalidConfidences = [-0.1, 1.1, 2.0];

      for (const confidence of invalidConfidences) {
        mockValidate.mockResolvedValue([
          createValidationError('confidence', { min: 'confidence must not be less than 0', max: 'confidence must not be greater than 1' }),
        ]);

        // Act
        const dto = plainToClass(StatisticsMetadataDto, { confidence });
        const errors = await mockValidate(dto);

        // Assert
        expect(errors.some((e: MockValidationError) => e.property === 'confidence')).toBe(true);
      }
    });

    it('should validate batchId length', async () => {
      // Arrange
      const longBatchId = 'a'.repeat(51);

      mockValidate.mockResolvedValue([
        createValidationError('batchId', { length: 'batchId must be longer than or equal to 1 and shorter than or equal to 50 characters' }),
      ]);

      // Act
      const dto = plainToClass(StatisticsMetadataDto, { batchId: longBatchId });
      const errors = await mockValidate(dto);

      // Assert
      expect(errors.some((e: MockValidationError) => e.property === 'batchId')).toBe(true);
    });
  });

  describe('UpdateStatisticsDto', () => {
    it('should validate complete valid DTO', async () => {
      // Arrange
      const validData = {
        costs: {
          claudeApi: 12.45,
          storage: 2.30,
          total: 14.75,
          currency: 'USD',
        },
        performance: {
          generationTime: 45.23,
          totalTime: 60.0,
        },
        usage: {
          documentsGenerated: 5,
          tokensUsed: 15750,
        },
        metadata: {
          source: 'cost-tracking-service',
          timestamp: new Date(),
          version: '1.0.0',
        },
      };

      // Act
      const dto = plainToClass(UpdateStatisticsDto, validData);
      const errors = await mockValidate(dto);

      // Assert
      expect(errors).toHaveLength(0);
      expect(dto.costs?.claudeApi).toBe(12.45);
      expect(dto.performance?.totalTime).toBe(60.0);
      expect(dto.usage?.documentsGenerated).toBe(5);
    });

    it('should allow partial updates', async () => {
      // Arrange
      const partialData = {
        costs: {
          claudeApi: 15.0,
        },
      };

      // Act
      const dto = plainToClass(UpdateStatisticsDto, partialData);
      const errors = await mockValidate(dto);

      // Assert
      expect(errors).toHaveLength(0);
      expect(dto.costs?.claudeApi).toBe(15.0);
      expect(dto.performance).toBeUndefined();
      expect(dto.usage).toBeUndefined();
    });

    it('should validate nested objects', async () => {
      // Arrange
      const invalidNestedData = {
        costs: {
          claudeApi: -10.0, // Invalid negative cost
        },
        performance: {
          totalTime: -30.0, // Invalid negative time
        },
      };

      mockValidate.mockResolvedValue([
        createValidationError('costs.claudeApi', { min: 'claudeApi must not be less than 0' }),
        createValidationError('performance.totalTime', { min: 'totalTime must not be less than 0' }),
      ]);

      // Act
      const dto = plainToClass(UpdateStatisticsDto, invalidNestedData);
      const errors = await mockValidate(dto);

      // Assert
      expect(errors.length).toBeGreaterThan(0);
    });

    describe('Business Logic Validation Methods', () => {
      it('should validate cost coherence correctly', () => {
        // Arrange - Coherent costs
        const coherentDto = plainToClass(UpdateStatisticsDto, {
          costs: {
            claudeApi: 10.0,
            storage: 5.0,
            total: 15.0,
          },
        });

        // Act
        const result = coherentDto.validateCostsCoherence();

        // Assert
        expect(result).toBe(true);
      });

      it('should detect cost incoherence', () => {
        // Arrange - Incoherent costs
        const incoherentDto = plainToClass(UpdateStatisticsDto, {
          costs: {
            claudeApi: 10.0,
            storage: 5.0,
            total: 20.0, // Should be 15.0
          },
        });

        // Act
        const result = incoherentDto.validateCostsCoherence();

        // Assert
        expect(result).toBe(false);
      });

      it('should validate performance coherence correctly', () => {
        // Arrange - Coherent performance
        const coherentDto = plainToClass(UpdateStatisticsDto, {
          performance: {
            generationTime: 30.0,
            processingTime: 20.0,
            totalTime: 60.0, // Greater than or equal to sum
          },
        });

        // Act
        const result = coherentDto.validatePerformanceCoherence();

        // Assert
        expect(result).toBe(true);
      });

      it('should detect performance incoherence', () => {
        // Arrange - Incoherent performance
        const incoherentDto = plainToClass(UpdateStatisticsDto, {
          performance: {
            generationTime: 30.0,
            processingTime: 20.0,
            interviewTime: 60.0,
            totalTime: 50.0, // Less than sum (110.0)
          },
        });

        // Act
        const result = incoherentDto.validatePerformanceCoherence();

        // Assert
        expect(result).toBe(false);
      });

      it('should validate usage coherence correctly', () => {
        // Arrange - Coherent usage
        const coherentDto = plainToClass(UpdateStatisticsDto, {
          usage: {
            documentsGenerated: 5,
            exportCount: 3, // Less than documents generated
          },
        });

        // Act
        const result = coherentDto.validateUsageCoherence();

        // Assert
        expect(result).toBe(true);
      });

      it('should detect usage incoherence', () => {
        // Arrange - Incoherent usage
        const incoherentDto = plainToClass(UpdateStatisticsDto, {
          usage: {
            documentsGenerated: 3,
            exportCount: 5, // More than documents generated
          },
        });

        // Act
        const result = incoherentDto.validateUsageCoherence();

        // Assert
        expect(result).toBe(false);
      });

      it('should validate fresh timestamp', () => {
        // Arrange - Fresh timestamp
        const freshDto = plainToClass(UpdateStatisticsDto, {
          metadata: {
            timestamp: new Date(), // Current time
          },
        });

        // Act
        const result = freshDto.validateTimestamp();

        // Assert
        expect(result).toBe(true);
      });

      it('should reject old timestamp', () => {
        // Arrange - Old timestamp
        const oldDto = plainToClass(UpdateStatisticsDto, {
          metadata: {
            timestamp: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25 hours ago
          },
        });

        // Act
        const result = oldDto.validateTimestamp();

        // Assert
        expect(result).toBe(false);
      });

      it('should reject future timestamp', () => {
        // Arrange - Future timestamp
        const futureDto = plainToClass(UpdateStatisticsDto, {
          metadata: {
            timestamp: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes in future
          },
        });

        // Act
        const result = futureDto.validateTimestamp();

        // Assert
        expect(result).toBe(false);
      });

      it('should perform complete validation successfully', () => {
        // Arrange - Valid DTO
        const validDto = plainToClass(UpdateStatisticsDto, {
          costs: {
            claudeApi: 10.0,
            storage: 5.0,
            total: 15.0,
          },
          performance: {
            generationTime: 30.0,
            totalTime: 40.0,
          },
          usage: {
            documentsGenerated: 5,
            exportCount: 2,
          },
          metadata: {
            timestamp: new Date(),
          },
        });

        // Act
        const result = validDto.isValid();

        // Assert
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should collect all validation errors', () => {
        // Arrange - Invalid DTO
        const invalidData = {
          costs: {
            claudeApi: 10.0,
            total: 5.0, // Inconsistent
          },
          performance: {
            generationTime: 50.0,
            totalTime: 30.0, // Inconsistent
          },
          usage: {
            documentsGenerated: 3,
            exportCount: 5, // Inconsistent  
          },
          metadata: {
            timestamp: new Date(Date.now() - 30 * 60 * 60 * 1000), // Too old
          },
        };

        const invalidDto = plainToClass(UpdateStatisticsDto, invalidData);

        // Act
        const result = invalidDto.isValid();

        // Assert
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors).toContain('Costs total is inconsistent with sum of components');
        expect(result.errors).toContain('Performance total time is inconsistent with sum of components');
        expect(result.errors).toContain('Usage statistics contain logical inconsistencies');
        expect(result.errors).toContain('Timestamp is too old or in the future');
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle very small decimal values', async () => {
      // Arrange
      const smallDecimalData = {
        costs: {
          claudeApi: 0.0001,
          storage: 1e-10,
        },
      };

      // Act
      const dto = plainToClass(UpdateStatisticsDto, smallDecimalData);
      const errors = await mockValidate(dto);

      // Assert
      expect(errors).toHaveLength(0);
    });

    it('should handle infinity and NaN values', async () => {
      // Arrange
      const invalidNumberData = {
        costs: {
          claudeApi: Infinity,
          storage: NaN,
        },
      };

      mockValidate.mockResolvedValue([
        createValidationError('costs.claudeApi', { isNumber: 'claudeApi must be a number' }),
        createValidationError('costs.storage', { isNumber: 'storage must be a number' }),
      ]);

      // Act
      const dto = plainToClass(UpdateStatisticsDto, invalidNumberData);
      const errors = await mockValidate(dto);

      // Assert
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should handle empty objects gracefully', () => {
      // Arrange
      const emptyDto = plainToClass(UpdateStatisticsDto, {});

      // Act
      const result = emptyDto.isValid();

      // Assert
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate with missing optional properties', () => {
      // Arrange
      const minimalDto = plainToClass(UpdateStatisticsDto, {
        costs: {
          claudeApi: 10.0,
        },
      });

      // Act
      const result = minimalDto.isValid();

      // Assert
      expect(result.valid).toBe(true);
    });
  });
});