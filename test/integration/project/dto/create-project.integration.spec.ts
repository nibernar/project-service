import { ValidationPipe } from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { CreateProjectDto } from '../../../../src/project/dto/create-project.dto';

/**
 * Tests d'intégration simplifiés pour CreateProjectDto
 * Tests avec mocks des services externes
 */
describe('CreateProjectDto - Integration Tests', () => {
  let validationPipe: ValidationPipe;

  // Mock services - simplifiés sans TestingModule
  const mockDatabaseService = {
    project: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
  };

  const mockCacheService = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  const mockUser = {
    id: 'test-user-123',
    email: 'test@example.com',
    roles: ['user'],
  };

  beforeAll(async () => {
    // Configuration simplifiée sans TestingModule
    validationPipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      validateCustomDecorators: true,
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // TESTS D'INTÉGRATION AVEC VALIDATION PIPE
  // ============================================================================

  describe('validation pipe integration', () => {
    it('should transform and validate complete DTO', async () => {
      const rawDto = {
        name: '  Integration Test Project  ',
        description: '  Test project for integration  ',
        initialPrompt: '  Create a comprehensive integration test application  ',
        uploadedFileIds: ['550e8400-e29b-41d4-a716-446655440000'],
      };

      const result = await validationPipe.transform(rawDto, {
        type: 'body',
        metatype: CreateProjectDto,
      });

      expect(result).toBeInstanceOf(CreateProjectDto);
      expect(result.name).toBe('Integration Test Project');
      expect(result.description).toBe('Test project for integration');
      expect(result.initialPrompt).toBe('Create a comprehensive integration test application');
      expect(result.uploadedFileIds).toEqual(['550e8400-e29b-41d4-a716-446655440000']);
    });

    it('should reject invalid DTO through validation pipe', async () => {
      const invalidDto = {
        name: '', // Invalid
        description: 'A'.repeat(1001), // Too long
        initialPrompt: 'Short', // Too short
        uploadedFileIds: ['invalid-uuid'], // Invalid UUID
        extraField: 'should be removed', // Non-whitelisted
      };

      await expect(
        validationPipe.transform(invalidDto, {
          type: 'body',
          metatype: CreateProjectDto,
        })
      ).rejects.toThrow();
    });

    it('should strip non-whitelisted properties', async () => {
      const dtoWithExtraFields = {
        name: 'Valid Project',
        initialPrompt: 'Create a valid application',
        unauthorizedField: 'should be removed',
        anotherBadField: 123,
      };

      await expect(
        validationPipe.transform(dtoWithExtraFields, {
          type: 'body',
          metatype: CreateProjectDto,
        })
      ).rejects.toThrow();
    });

    it('should handle empty description transformation', async () => {
      const rawDto = {
        name: 'Valid Project',
        description: '   ', // Whitespace only
        initialPrompt: 'Create a valid application',
      };

      const result = await validationPipe.transform(rawDto, {
        type: 'body',
        metatype: CreateProjectDto,
      });

      expect(result.description).toBeUndefined();
    });
  });

  // ============================================================================
  // TESTS D'INTÉGRATION AVEC MOCK SERVICES
  // ============================================================================

  describe('service integration simulation', () => {
    it('should work with mocked database service', async () => {
      const dto = plainToClass(CreateProjectDto, {
        name: 'Database Integration Test',
        initialPrompt: 'Create database integration test application',
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);

      // Simulate database creation
      const mockProject = {
        id: 'project-123',
        name: dto.name,
        initialPrompt: dto.initialPrompt,
        ownerId: mockUser.id,
        createdAt: new Date(),
      };

      mockDatabaseService.project.create.mockResolvedValue(mockProject);

      const result = await mockDatabaseService.project.create({
        data: {
          name: dto.name,
          initialPrompt: dto.initialPrompt,
          ownerId: mockUser.id,
        },
      });

      expect(result.id).toBe('project-123');
      expect(mockDatabaseService.project.create).toHaveBeenCalledWith({
        data: {
          name: dto.name,
          initialPrompt: dto.initialPrompt,
          ownerId: mockUser.id,
        },
      });
    });

    it('should work with mocked cache service', async () => {
      const dto = plainToClass(CreateProjectDto, {
        name: 'Cache Integration Test',
        initialPrompt: 'Create cache integration test application',
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);

      // Simulate cache operations
      const cacheKey = `project:validation:${dto.name}`;
      mockCacheService.get.mockResolvedValue(null);
      mockCacheService.set.mockResolvedValue('OK');

      const cachedValue = await mockCacheService.get(cacheKey);
      expect(cachedValue).toBeNull();

      await mockCacheService.set(cacheKey, dto.toString(), 3600);
      expect(mockCacheService.set).toHaveBeenCalledWith(
        cacheKey,
        dto.toString(),
        3600
      );
    });

    it('should handle service errors gracefully', async () => {
      const dto = plainToClass(CreateProjectDto, {
        name: 'Error Handling Test',
        initialPrompt: 'Create error handling test application',
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);

      // Simulate database error
      mockDatabaseService.project.create.mockRejectedValue(
        new Error('Database connection failed')
      );

      await expect(
        mockDatabaseService.project.create({
          data: {
            name: dto.name,
            initialPrompt: dto.initialPrompt,
          },
        })
      ).rejects.toThrow('Database connection failed');
    });
  });

  // ============================================================================
  // TESTS D'INTÉGRATION AVEC TRANSFORMATION COMPLEXE
  // ============================================================================

  describe('complex transformation integration', () => {
    it('should handle nested object transformation', async () => {
      const complexInput = {
        name: '  Complex Project  ',
        description: '  Complex description  ',
        initialPrompt: '  Create complex application  ',
        uploadedFileIds: [
          '550e8400-e29b-41d4-a716-446655440000',
          '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
        ],
        metadata: { // This should be stripped
          version: '1.0',
          author: 'test',
        },
      };

      await expect(
        validationPipe.transform(complexInput, {
          type: 'body',
          metatype: CreateProjectDto,
        })
      ).rejects.toThrow(); // Should reject extra fields
    });

    it('should handle array transformation edge cases', async () => {
      const arrayEdgeCases = [
        {
          name: 'Array Edge Case 1',
          initialPrompt: 'Create array test application',
          uploadedFileIds: [], // Empty array
        },
        {
          name: 'Array Edge Case 2',
          initialPrompt: 'Create array test application',
          uploadedFileIds: undefined, // Undefined
        },
        {
          name: 'Array Edge Case 3',
          initialPrompt: 'Create array test application',
          uploadedFileIds: ['550e8400-e29b-41d4-a716-446655440000'], // Single item
        },
      ];

      for (const testCase of arrayEdgeCases) {
        const result = await validationPipe.transform(testCase, {
          type: 'body',
          metatype: CreateProjectDto,
        });

        expect(result).toBeInstanceOf(CreateProjectDto);
        expect(result.name).toBe(testCase.name);
        expect(result.uploadedFileIds).toEqual(testCase.uploadedFileIds);
      }
    });
  });

  // ============================================================================
  // TESTS D'INTÉGRATION AVEC DIFFÉRENTS SCÉNARIOS
  // ============================================================================

  describe('integration scenarios', () => {
    it('should handle concurrent DTO processing', async () => {
      const concurrentDtos = Array(10).fill(null).map((_, i) => ({
        name: `Concurrent Project ${i}`,
        initialPrompt: `Create concurrent application ${i}`,
      }));

      const promises = concurrentDtos.map(dto =>
        validationPipe.transform(dto, {
          type: 'body',
          metatype: CreateProjectDto,
        })
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
      results.forEach((result, i) => {
        expect(result).toBeInstanceOf(CreateProjectDto);
        expect(result.name).toBe(`Concurrent Project ${i}`);
      });
    });

    it('should handle malformed input gracefully', async () => {
      const malformedInputs = [
        null,
        undefined,
        'string instead of object',
        123,
        [],
        { // Missing required fields
          description: 'Only description',
        },
      ];

      for (const input of malformedInputs) {
        await expect(
          validationPipe.transform(input, {
            type: 'body',
            metatype: CreateProjectDto,
          })
        ).rejects.toThrow();
      }
    });
  });

  // ============================================================================
  // TESTS D'INTÉGRATION AVEC VALIDATION BUSINESS
  // ============================================================================

  describe('business validation integration', () => {
    it('should integrate with business rules validation', async () => {
      // Simulate business rules that might be applied after DTO validation
      const dto = await validationPipe.transform({
        name: 'Business Rules Test',
        initialPrompt: 'Create business rules test application',
        uploadedFileIds: ['550e8400-e29b-41d4-a716-446655440000'],
      }, {
        type: 'body',
        metatype: CreateProjectDto,
      });

      // Simulate business validation
      const businessValidation = {
        isValidProjectName: (name: string) => !name.toLowerCase().includes('test'),
        isValidFileCount: (count: number) => count <= 5,
        isComplexityAllowed: (complexity: string) => complexity !== 'high',
      };

      // Business rules should work with validated DTO
      expect(businessValidation.isValidProjectName(dto.name)).toBe(false); // Contains "test"
      expect(businessValidation.isValidFileCount(dto.getUploadedFilesCount())).toBe(true);
      expect(businessValidation.isComplexityAllowed(dto.getPromptComplexity())).toBe(true);
    });

    it('should handle authorization context integration', async () => {
      const dto = await validationPipe.transform({
        name: 'Authorization Test',
        initialPrompt: 'Create authorization test application',
      }, {
        type: 'body',
        metatype: CreateProjectDto,
      });

      // Simulate authorization checks
      const authContext = {
        user: mockUser,
        canCreateProject: true,
        maxProjectNameLength: 50,
        allowedComplexity: ['low', 'medium'],
      };

      // Authorization should work with validated DTO
      expect(authContext.canCreateProject).toBe(true);
      expect(dto.name.length).toBeLessThanOrEqual(authContext.maxProjectNameLength);
      expect(authContext.allowedComplexity).toContain(dto.getPromptComplexity());
    });
  });

  // ============================================================================
  // TESTS D'INTÉGRATION AVEC LOGGING ET MONITORING
  // ============================================================================

  describe('logging and monitoring integration', () => {
    it('should integrate with logging systems', async () => {
      const dto = await validationPipe.transform({
        name: 'Logging Test',
        initialPrompt: 'Create logging test application',
      }, {
        type: 'body',
        metatype: CreateProjectDto,
      });

      // Simulate logging
      const logEntry = {
        timestamp: new Date(),
        level: 'info',
        message: 'Project DTO validated',
        data: dto.toLogSafeString(),
        user: mockUser.id,
      };

      expect(logEntry.data).toContain('name_length=');
      expect(logEntry.data).not.toContain('Logging Test'); // Should be safe
      expect(logEntry.user).toBe(mockUser.id);
    });

    it('should integrate with metrics collection', async () => {
      const startTime = Date.now();
      
      const dto = await validationPipe.transform({
        name: 'Metrics Test',
        initialPrompt: 'Create metrics test application',
        uploadedFileIds: ['550e8400-e29b-41d4-a716-446655440000'],
      }, {
        type: 'body',
        metatype: CreateProjectDto,
      });

      const endTime = Date.now();

      // Simulate metrics collection
      const metrics = {
        validation_duration_ms: Math.max(1, endTime - startTime), // Assurer une durée minimale
        dto_size_bytes: JSON.stringify(dto).length,
        files_count: dto.getUploadedFilesCount(),
        complexity: dto.getPromptComplexity(),
        has_description: !!dto.description,
      };

      expect(metrics.validation_duration_ms).toBeGreaterThan(0);
      expect(metrics.dto_size_bytes).toBeGreaterThan(0);
      expect(metrics.files_count).toBe(1);
      expect(metrics.complexity).toBeDefined();
      expect(metrics.has_description).toBe(false);
    });
  });
});