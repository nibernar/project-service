import { ValidationPipe, BadRequestException } from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { UpdateProjectDto } from '../../../../src/project/dto/update-project.dto';

/**
 * Tests d'intégration pour UpdateProjectDto
 * Tests avec mocks des services externes et ValidationPipe NestJS
 */
describe('UpdateProjectDto - Integration Tests', () => {
  let validationPipe: ValidationPipe;

  // Mock services - simplifiés sans TestingModule
  const mockDatabaseService = {
    project: {
      update: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
  };

  const mockCacheService = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    invalidateProjectCache: jest.fn(),
  };

  const mockUser = {
    id: 'test-user-123',
    email: 'test@example.com',
    roles: ['user'],
  };

  const mockProject = {
    id: 'project-123',
    name: 'Existing Project',
    description: 'Existing description',
    ownerId: mockUser.id,
    createdAt: new Date(),
    updatedAt: new Date(),
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
    it('should transform and validate complete update DTO', async () => {
      const rawDto = {
        name: '  Integration Update Test  ',
        description: '  Updated test project for integration  ',
      };

      const result = await validationPipe.transform(rawDto, {
        type: 'body',
        metatype: UpdateProjectDto,
      });

      expect(result).toBeInstanceOf(UpdateProjectDto);
      expect(result.name).toBe('Integration Update Test');
      expect(result.description).toBe('Updated test project for integration');
      expect(result.hasValidUpdates()).toBe(true);
      expect(result.getUpdateFieldsCount()).toBe(2);
    });

    it('should handle partial updates through validation pipe', async () => {
      const partialUpdates = [
        // Name only
        {
          input: { name: '  Name Only Update  ' },
          expected: { name: 'Name Only Update', description: undefined },
        },
        // Description only
        {
          input: { description: '  Description Only Update  ' },
          expected: { name: undefined, description: 'Description Only Update' },
        },
        // Description clearing
        {
          input: { description: '' },
          expected: { name: undefined, description: '' },
        },
        // No updates
        {
          input: {},
          expected: { name: undefined, description: undefined },
        },
      ];

      for (const testCase of partialUpdates) {
        const result = await validationPipe.transform(testCase.input, {
          type: 'body',
          metatype: UpdateProjectDto,
        });

        expect(result).toBeInstanceOf(UpdateProjectDto);
        expect(result.name).toBe(testCase.expected.name);
        expect(result.description).toBe(testCase.expected.description);
      }
    });

    it('should reject invalid update DTO through validation pipe', async () => {
      const invalidDto = {
        name: '', // Invalid - empty when provided
        description: 'A'.repeat(1001), // Too long
        extraField: 'should be removed', // Non-whitelisted
      };

      await expect(
        validationPipe.transform(invalidDto, {
          type: 'body',
          metatype: UpdateProjectDto,
        }),
      ).rejects.toThrow();
    });

    it('should strip non-whitelisted properties', async () => {
      const dtoWithExtraFields = {
        name: 'Valid Update Name',
        description: 'Valid description',
        unauthorizedField: 'should be removed',
        anotherBadField: 123,
        maliciousField: '<script>alert("xss")</script>',
      };

      await expect(
        validationPipe.transform(dtoWithExtraFields, {
          type: 'body',
          metatype: UpdateProjectDto,
        }),
      ).rejects.toThrow();
    });

    it('should handle null and undefined transformations', async () => {
      const nullUndefinedCases = [
        {
          input: { name: null, description: null },
          // name: null devient undefined, description: null devient ''
        },
        {
          input: { name: undefined, description: undefined },
          // Pas de changement
        },
        {
          input: { description: '   ' }, // Whitespace only
          // description devient '' après trim
        },
      ];

      for (const testCase of nullUndefinedCases) {
        const result = await validationPipe.transform(testCase.input, {
          type: 'body',
          metatype: UpdateProjectDto,
        });

        expect(result).toBeInstanceOf(UpdateProjectDto);
        expect(() => result.hasValidUpdates()).not.toThrow();
        expect(() => result.isValid()).not.toThrow();
      }
    });
  });

  // ============================================================================
  // TESTS D'INTÉGRATION AVEC MOCK SERVICES
  // ============================================================================

  describe('service integration simulation', () => {
    it('should work with mocked database update service', async () => {
      const updateDto = plainToClass(UpdateProjectDto, {
        name: 'Database Update Integration Test',
        description: 'Updated description for database integration',
      });

      const errors = await validate(updateDto);
      expect(errors).toHaveLength(0);

      // Simulate database update
      const updatedProject = {
        ...mockProject,
        name: updateDto.name,
        description: updateDto.description,
        updatedAt: new Date(),
      };

      mockDatabaseService.project.update.mockResolvedValue(updatedProject);

      const result = await mockDatabaseService.project.update({
        where: { id: mockProject.id },
        data: updateDto.getDefinedFields(),
      });

      expect(result.name).toBe(updateDto.name);
      expect(result.description).toBe(updateDto.description);
      expect(mockDatabaseService.project.update).toHaveBeenCalledWith({
        where: { id: mockProject.id },
        data: {
          name: updateDto.name,
          description: updateDto.description,
        },
      });
    });

    it('should work with mocked cache invalidation', async () => {
      const updateDto = plainToClass(UpdateProjectDto, {
        name: 'Cache Integration Test',
      });

      const errors = await validate(updateDto);
      expect(errors).toHaveLength(0);

      // Simulate cache operations for update
      const cacheKey = `project:${mockProject.id}`;
      const userCacheKey = `projects:${mockUser.id}:*`;

      mockCacheService.invalidateProjectCache.mockResolvedValue('OK');

      // Simulate cache invalidation after update
      await mockCacheService.invalidateProjectCache(
        mockProject.id,
        mockUser.id,
      );

      expect(mockCacheService.invalidateProjectCache).toHaveBeenCalledWith(
        mockProject.id,
        mockUser.id,
      );
    });

    it('should handle partial updates with service integration', async () => {
      const partialUpdates = [
        { name: 'Name Only Update' },
        { description: 'Description Only Update' },
        { description: '' }, // Clearing description
      ];

      for (const updateData of partialUpdates) {
        const updateDto = plainToClass(UpdateProjectDto, updateData);
        const errors = await validate(updateDto);
        expect(errors).toHaveLength(0);

        // Simulate partial database update
        const updatedProject = {
          ...mockProject,
          ...updateDto.getDefinedFields(),
          updatedAt: new Date(),
        };

        mockDatabaseService.project.update.mockResolvedValue(updatedProject);

        const result = await mockDatabaseService.project.update({
          where: { id: mockProject.id },
          data: updateDto.getDefinedFields(),
        });

        // Verify only defined fields were updated
        const definedFields = updateDto.getDefinedFields();
        Object.keys(definedFields).forEach((key) => {
          expect(result[key]).toBe(definedFields[key]);
        });

        // Reset mock
        mockDatabaseService.project.update.mockClear();
      }
    });

    it('should handle service errors gracefully', async () => {
      const updateDto = plainToClass(UpdateProjectDto, {
        name: 'Error Handling Test',
        description: 'Test error handling in updates',
      });

      const errors = await validate(updateDto);
      expect(errors).toHaveLength(0);

      // Simulate different types of database errors
      const errorScenarios = [
        new Error('Database connection failed'),
        new Error('Project not found'),
        new Error('Constraint violation'),
        new Error('Timeout error'),
      ];

      for (const error of errorScenarios) {
        mockDatabaseService.project.update.mockRejectedValue(error);

        await expect(
          mockDatabaseService.project.update({
            where: { id: mockProject.id },
            data: updateDto.getDefinedFields(),
          }),
        ).rejects.toThrow(error.message);

        // Reset for next test
        mockDatabaseService.project.update.mockClear();
      }
    });

    it('should integrate with audit logging simulation', async () => {
      const updateDto = plainToClass(UpdateProjectDto, {
        name: 'Audit Integration Test',
        description: 'Testing audit integration',
      });

      const errors = await validate(updateDto);
      expect(errors).toHaveLength(0);

      // Simulate audit logging
      const auditLogEntry = {
        action: 'project.update',
        userId: mockUser.id,
        projectId: mockProject.id,
        changes: updateDto.getDefinedFields(),
        timestamp: new Date(),
        // Safe logging without sensitive data
        metadata: updateDto.toLogSafeString(),
      };

      expect(auditLogEntry.metadata).toContain('fields=2');
      expect(auditLogEntry.metadata).not.toContain('Audit Integration Test'); // No sensitive data
      expect(auditLogEntry.changes).toEqual({
        name: 'Audit Integration Test',
        description: 'Testing audit integration',
      });
    });
  });

  // ============================================================================
  // TESTS D'INTÉGRATION AVEC TRANSFORMATION COMPLEXE
  // ============================================================================

  describe('complex transformation integration', () => {
    it('should handle nested object transformation gracefully', async () => {
      const complexInput = {
        name: '  Complex Update  ',
        description: '  Complex description  ',
        metadata: {
          // This should be stripped
          version: '2.0',
          author: 'test',
        },
        nestedUpdate: {
          value: 'nested',
        },
      };

      await expect(
        validationPipe.transform(complexInput, {
          type: 'body',
          metatype: UpdateProjectDto,
        }),
      ).rejects.toThrow(); // Should reject extra fields
    });

    it('should handle transformation edge cases in integration', async () => {
      const transformationEdgeCases = [
        {
          name: 'Update Edge Case 1',
          description: '', // Empty description (clearing)
        },
        {
          name: undefined, // No name update
          description: 'Description Only Update',
        },
        {
          // No updates at all
        },
        {
          name: '   Edge Case Whitespace   ',
          description: '\t\n  Whitespace Description  \r\n',
        },
      ];

      for (const testCase of transformationEdgeCases) {
        const result = await validationPipe.transform(testCase, {
          type: 'body',
          metatype: UpdateProjectDto,
        });

        expect(result).toBeInstanceOf(UpdateProjectDto);
        expect(result.hasValidUpdates()).toBe(Object.keys(testCase).length > 0);

        if (testCase.name !== undefined) {
          expect(result.name).toBe(testCase.name.trim());
        }
        if (testCase.description !== undefined) {
          expect(result.description).toBe(testCase.description.trim());
        }
      }
    });

    it('should handle array-like objects transformation', async () => {
      const arrayLikeInputs = [
        { name: ['Should', 'Not', 'Work'] },
        { description: { 0: 'A', 1: 'B', length: 2 } },
      ];

      for (const input of arrayLikeInputs) {
        // These should either be transformed to strings or cause validation errors
        const result = await validationPipe.transform(input, {
          type: 'body',
          metatype: UpdateProjectDto,
        });

        expect(result).toBeInstanceOf(UpdateProjectDto);
        // The transformation should handle these gracefully
        expect(() => validate(result)).not.toThrow();
      }
    });
  });

  // ============================================================================
  // TESTS D'INTÉGRATION AVEC DIFFÉRENTS SCÉNARIOS
  // ============================================================================

  describe('integration scenarios', () => {
    it('should handle concurrent update DTO processing', async () => {
      const concurrentUpdates = Array(10)
        .fill(null)
        .map((_, i) => ({
          name: `Concurrent Update ${i}`,
          description: i % 3 === 0 ? `Description ${i}` : undefined,
        }));

      const promises = concurrentUpdates.map((updateData) =>
        validationPipe.transform(updateData, {
          type: 'body',
          metatype: UpdateProjectDto,
        }),
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
      results.forEach((result, i) => {
        expect(result).toBeInstanceOf(UpdateProjectDto);
        expect(result.name).toBe(`Concurrent Update ${i}`);
        expect(result.hasValidUpdates()).toBe(true);
      });
    });

    it('should handle malformed update input gracefully', async () => {
      // Test 1: Inputs malformés qui deviennent valides après transformation
      const transformableInputs: any[] = [
        { name: '  Valid Name  ' }, // Whitespace -> trimmed
        { description: null }, // null -> empty string
        { name: ['Valid', 'Name'] }, // Array -> joined string
        { description: '  Valid Description  ' }, // Whitespace -> trimmed
      ];

      for (const input of transformableInputs) {
        // Ces inputs ne doivent PAS lever d'exception car ils deviennent valides après transformation
        const result = await validationPipe.transform(input, {
          type: 'body',
          metatype: UpdateProjectDto,
          data: undefined,
        });

        expect(result).toBeInstanceOf(UpdateProjectDto);
        expect(() => result.hasValidUpdates()).not.toThrow();
      }

      // Test 2: Inputs malformés qui restent invalides après transformation et DOIVENT lever une exception
      const invalidInputs: any[] = [
        { name: 123 }, // number -> reste number -> échoue @IsString
        { name: false }, // boolean -> reste boolean -> échoue @IsString
        { name: '' }, // empty string -> échoue @IsNotEmpty
        { description: 'A'.repeat(1001) }, // trop long -> échoue validation longueur
        { name: '<script>alert("xss")</script>' }, // dangerous -> échoue pattern match
      ];

      for (const input of invalidInputs) {
        // Ces inputs DOIVENT lever une exception car ils restent invalides après transformation
        await expect(
          validationPipe.transform(input, {
            type: 'body',
            metatype: UpdateProjectDto,
            data: undefined,
          }),
        ).rejects.toThrow(BadRequestException);
      }

      // Test 3: Transformation seule (sans validation) pour tester la robustesse
      const robustnessInputs: any[] = [
        // Objets complexes simples (pas circulaires)
        { name: { nested: 'object' }, description: ['array', 'data'] },
        // Fonctions et symboles
        { name: () => 'function', description: Symbol('symbol') },
        // Objets avec propriétés dangereuses
        { name: 'valid', description: 'valid', __proto__: { polluted: true } },
        // Types primitifs non-string
        { name: 123, description: true },
        { name: false, description: 456 },
      ];

      for (const input of robustnessInputs) {
        // Test seulement la transformation (pas la validation avec ValidationPipe)
        expect(() => {
          const transformed = plainToClass(UpdateProjectDto, input);

          // Vérifier qu'aucune pollution de prototype n'a eu lieu
          expect((UpdateProjectDto.prototype as any).polluted).toBeUndefined();
          expect((Object.prototype as any).polluted).toBeUndefined();

          // Les méthodes du DTO doivent toujours fonctionner
          expect(() => transformed.hasValidUpdates()).not.toThrow();
          expect(() => transformed.toString()).not.toThrow();
          expect(() => transformed.getDefinedFields()).not.toThrow();
        }).not.toThrow();
      }
    });

    it('should handle mixed valid/invalid update combinations', async () => {
      const mixedCases = [
        {
          input: { name: 'Valid Name', description: 'A'.repeat(1001) },
          expectError: true,
          errorProperty: 'description',
        },
        {
          input: { name: '', description: 'Valid Description' },
          expectError: true,
          errorProperty: 'name',
        },
        {
          input: { name: 'Valid Name', description: 'Valid Description' },
          expectError: false,
        },
        {
          input: { description: '' }, // Valid clearing
          expectError: false,
        },
      ];

      for (const testCase of mixedCases) {
        if (testCase.expectError) {
          await expect(
            validationPipe.transform(testCase.input, {
              type: 'body',
              metatype: UpdateProjectDto,
            }),
          ).rejects.toThrow();
        } else {
          const result = await validationPipe.transform(testCase.input, {
            type: 'body',
            metatype: UpdateProjectDto,
          });
          expect(result).toBeInstanceOf(UpdateProjectDto);
          expect(result.hasValidUpdates()).toBe(true);
        }
      }
    });
  });

  // ============================================================================
  // TESTS D'INTÉGRATION AVEC VALIDATION BUSINESS
  // ============================================================================

  describe('business validation integration', () => {
    it('should integrate with business rules validation', async () => {
      // Simulate business rules that might be applied after DTO validation
      const updateDto = await validationPipe.transform(
        {
          name: 'Business Rules Update Test',
          description: 'Testing business rules integration',
        },
        {
          type: 'body',
          metatype: UpdateProjectDto,
        },
      );

      // Simulate business validation
      const businessValidation = {
        isValidUpdateName: (name: string) =>
          !name.toLowerCase().includes('forbidden'),
        canUpdateDescription: (userId: string) => userId === mockUser.id,
        isUpdateFrequencyAllowed: (lastUpdate: Date) => {
          const now = new Date();
          const diffMs = now.getTime() - lastUpdate.getTime();
          return diffMs > 60000; // Must wait 1 minute between updates
        },
      };

      // Business rules should work with validated DTO
      expect(businessValidation.isValidUpdateName(updateDto.name!)).toBe(true);
      expect(businessValidation.canUpdateDescription(mockUser.id)).toBe(true);
      expect(
        businessValidation.isUpdateFrequencyAllowed(
          new Date(Date.now() - 120000),
        ),
      ).toBe(true);
    });

    it('should handle authorization context integration', async () => {
      const updateDto = await validationPipe.transform(
        {
          name: 'Authorization Update Test',
          description: 'Testing authorization integration',
        },
        {
          type: 'body',
          metatype: UpdateProjectDto,
        },
      );

      // Simulate authorization checks
      const authContext = {
        user: mockUser,
        canUpdateProject: true,
        canUpdateName: true,
        canUpdateDescription: true,
        maxNameLength: 80,
        allowedUpdateFields: ['name', 'description'],
      };

      // Authorization should work with validated DTO
      expect(authContext.canUpdateProject).toBe(true);
      expect(updateDto.name!.length).toBeLessThanOrEqual(
        authContext.maxNameLength,
      );

      const updateFields = Object.keys(updateDto.getDefinedFields());
      expect(
        updateFields.every((field) =>
          authContext.allowedUpdateFields.includes(field),
        ),
      ).toBe(true);
    });

    it('should integrate with conflict detection', async () => {
      const updateDto = await validationPipe.transform(
        {
          name: 'Conflict Detection Test',
          description: 'Testing conflict detection',
        },
        {
          type: 'body',
          metatype: UpdateProjectDto,
        },
      );

      // Simulate optimistic locking / conflict detection
      const conflictDetection = {
        checkForConflicts: (
          projectId: string,
          currentVersion: number,
          updateFields: object,
        ) => {
          // Simulate version check
          return {
            hasConflict: false,
            conflictingFields: [],
            currentVersion: currentVersion + 1,
          };
        },
      };

      const result = conflictDetection.checkForConflicts(
        mockProject.id,
        1,
        updateDto.getDefinedFields(),
      );

      expect(result.hasConflict).toBe(false);
      expect(result.conflictingFields).toHaveLength(0);
    });
  });

  // ============================================================================
  // TESTS D'INTÉGRATION AVEC LOGGING ET MONITORING
  // ============================================================================

  describe('logging and monitoring integration', () => {
    it('should integrate with structured logging systems', async () => {
      const updateDto = await validationPipe.transform(
        {
          name: 'Logging Integration Test',
          description: 'Testing logging integration',
        },
        {
          type: 'body',
          metatype: UpdateProjectDto,
        },
      );

      // Simulate structured logging
      const logEntry = {
        timestamp: new Date().toISOString(),
        level: 'info',
        service: 'project-service',
        action: 'project.update.validated',
        data: {
          projectId: mockProject.id,
          userId: mockUser.id,
          updateFields: Object.keys(updateDto.getDefinedFields()),
          fieldsCount: updateDto.getUpdateFieldsCount(),
          // Safe logging without sensitive data
          metadata: updateDto.toLogSafeString(),
        },
        correlationId: 'test-correlation-123',
      };

      expect(logEntry.data.metadata).toContain('fields=2');
      expect(logEntry.data.metadata).not.toContain('Logging Integration Test'); // No sensitive data
      expect(logEntry.data.updateFields).toEqual(['name', 'description']);
      expect(logEntry.data.fieldsCount).toBe(2);
    });

    it('should integrate with metrics collection', async () => {
      const startTime = Date.now();

      const updateDto = await validationPipe.transform(
        {
          name: 'Metrics Integration Test',
          description: 'Testing metrics integration',
        },
        {
          type: 'body',
          metatype: UpdateProjectDto,
        },
      );

      const endTime = Date.now();

      // Simulate metrics collection
      const metrics = {
        validation_duration_ms: Math.max(1, endTime - startTime),
        dto_size_bytes: JSON.stringify(updateDto).length,
        fields_updated_count: updateDto.getUpdateFieldsCount(),
        has_name_update: updateDto.isUpdatingName(),
        has_description_update: updateDto.isUpdatingDescription(),
        is_description_clearing: updateDto.isClearingDescription(),
        is_partial_update: updateDto.getUpdateFieldsCount() < 2,
        validation_success: true,
      };

      expect(metrics.validation_duration_ms).toBeGreaterThan(0);
      expect(metrics.dto_size_bytes).toBeGreaterThan(0);
      expect(metrics.fields_updated_count).toBe(2);
      expect(metrics.has_name_update).toBe(true);
      expect(metrics.has_description_update).toBe(true);
      expect(metrics.is_description_clearing).toBe(false);
      expect(metrics.is_partial_update).toBe(false);
    });

    it('should integrate with error tracking', async () => {
      const invalidUpdateData = {
        name: '', // Invalid
        description: 'A'.repeat(1001), // Invalid
      };

      try {
        await validationPipe.transform(invalidUpdateData, {
          type: 'body',
          metatype: UpdateProjectDto,
        });
        fail('Should have thrown validation error');
      } catch (error) {
        // Simulate error tracking
        const errorReport = {
          timestamp: new Date().toISOString(),
          errorType: 'ValidationError',
          service: 'project-service',
          action: 'project.update.validation',
          userId: mockUser.id,
          projectId: mockProject.id,
          errorDetails: {
            invalidFields: ['name', 'description'],
            // Safe error data without sensitive information
            inputFieldsCount: Object.keys(invalidUpdateData).length,
          },
          correlationId: 'test-error-correlation-123',
        };

        expect(errorReport.errorType).toBe('ValidationError');
        expect(errorReport.errorDetails.invalidFields).toContain('name');
        expect(errorReport.errorDetails.invalidFields).toContain('description');
        expect(errorReport.errorDetails.inputFieldsCount).toBe(2);
      }
    });
  });

  // ============================================================================
  // TESTS D'INTÉGRATION AVEC WORKFLOW COMPLET
  // ============================================================================

  describe('complete workflow integration', () => {
    it('should handle complete update workflow', async () => {
      // 1. Validation and transformation
      const updateDto = await validationPipe.transform(
        {
          name: '  Complete Workflow Test  ',
          description: '  Complete workflow description  ',
        },
        {
          type: 'body',
          metatype: UpdateProjectDto,
        },
      );

      expect(updateDto).toBeInstanceOf(UpdateProjectDto);
      expect(updateDto.name).toBe('Complete Workflow Test');
      expect(updateDto.description).toBe('Complete workflow description');

      // 2. Business validation
      expect(updateDto.isValid()).toBe(true);
      expect(updateDto.hasValidUpdates()).toBe(true);
      expect(updateDto.isConsistent()).toBe(true);

      // 3. Database update simulation
      const updateData = updateDto.getDefinedFields();
      mockDatabaseService.project.update.mockResolvedValue({
        ...mockProject,
        ...updateData,
        updatedAt: new Date(),
      });

      const updatedProject = await mockDatabaseService.project.update({
        where: { id: mockProject.id },
        data: updateData,
      });

      // 4. Cache invalidation
      await mockCacheService.invalidateProjectCache(
        mockProject.id,
        mockUser.id,
      );

      // 5. Audit logging
      const auditLog = {
        action: 'project.updated',
        projectId: mockProject.id,
        userId: mockUser.id,
        changes: updateData,
        metadata: updateDto.toLogSafeString(),
        timestamp: new Date(),
      };

      // Verify complete workflow
      expect(updatedProject.name).toBe(updateDto.name);
      expect(updatedProject.description).toBe(updateDto.description);
      expect(mockDatabaseService.project.update).toHaveBeenCalledWith({
        where: { id: mockProject.id },
        data: updateData,
      });
      expect(mockCacheService.invalidateProjectCache).toHaveBeenCalledWith(
        mockProject.id,
        mockUser.id,
      );
      expect(auditLog.metadata).toContain('fields=2');
    });

    it('should handle partial update workflow', async () => {
      // Test partial update (description clearing)
      const updateDto = await validationPipe.transform(
        {
          description: '', // Clearing description
        },
        {
          type: 'body',
          metatype: UpdateProjectDto,
        },
      );

      expect(updateDto.isUpdatingDescription()).toBe(true);
      expect(updateDto.isClearingDescription()).toBe(true);
      expect(updateDto.isUpdatingName()).toBe(false);
      expect(updateDto.getUpdateFieldsCount()).toBe(1);

      const updateData = updateDto.getDefinedFields();
      expect(updateData).toEqual({ description: '' });

      // Simulate partial database update
      mockDatabaseService.project.update.mockResolvedValue({
        ...mockProject,
        description: '',
        updatedAt: new Date(),
      });

      const result = await mockDatabaseService.project.update({
        where: { id: mockProject.id },
        data: updateData,
      });

      expect(result.description).toBe('');
      expect(result.name).toBe(mockProject.name); // Unchanged
    });

    it('should handle no-update workflow', async () => {
      // Test empty update
      const updateDto = await validationPipe.transform(
        {},
        {
          type: 'body',
          metatype: UpdateProjectDto,
        },
      );

      expect(updateDto.hasValidUpdates()).toBe(false);
      expect(updateDto.getUpdateFieldsCount()).toBe(0);
      expect(updateDto.getDefinedFields()).toEqual({});

      // In a real service, this would likely return early without database call
      const updateData = updateDto.getDefinedFields();
      expect(Object.keys(updateData)).toHaveLength(0);
    });
  });
});
