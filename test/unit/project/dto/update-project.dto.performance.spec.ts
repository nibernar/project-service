import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import {
  UpdateProjectDto,
  UPDATE_PROJECT_CONSTANTS,
} from '../../../../src/project/dto/update-project.dto';

/**
 * Tests de performance pour UpdateProjectDto
 */
describe('UpdateProjectDto - Performance Tests', () => {
  let dto: UpdateProjectDto;

  beforeEach(() => {
    dto = new UpdateProjectDto();
  });

  // ============================================================================
  // TESTS DE PERFORMANCE DE VALIDATION
  // ============================================================================

  describe('validation performance', () => {
    it('should validate small update DTO quickly', async () => {
      dto.name = 'Quick Update';
      dto.description = 'Quick description update';

      const startTime = performance.now();
      const errors = await validate(dto);
      const duration = performance.now() - startTime;

      expect(errors).toHaveLength(0);
      expect(duration).toBeLessThan(10); // Less than 10ms
    });

    it('should validate partial updates efficiently', async () => {
      const partialUpdateTests = [
        // Name only
        { name: 'Name Update Only' },
        // Description only
        { description: 'Description update only' },
        // Both fields
        { name: 'Both Fields', description: 'Both updated' },
        // Empty update
        {},
        // Description clearing
        { description: '' },
      ];

      const startTime = performance.now();

      for (const updateData of partialUpdateTests) {
        const testDto = plainToClass(UpdateProjectDto, updateData);
        await validate(testDto);
      }

      const duration = performance.now() - startTime;
      expect(duration).toBeLessThan(25); // Less than 25ms for all tests
    });

    it('should validate maximum size update DTO efficiently', async () => {
      dto.name = 'A'.repeat(UPDATE_PROJECT_CONSTANTS.NAME.MAX_LENGTH);
      dto.description = 'B'.repeat(
        UPDATE_PROJECT_CONSTANTS.DESCRIPTION.MAX_LENGTH,
      );

      const startTime = performance.now();
      const errors = await validate(dto);
      const duration = performance.now() - startTime;

      expect(errors).toHaveLength(0);
      expect(duration).toBeLessThan(50); // Less than 50ms
    });

    it('should handle invalid update DTO validation quickly', async () => {
      dto.name = ''; // Invalid - empty when provided
      dto.description = 'A'.repeat(
        UPDATE_PROJECT_CONSTANTS.DESCRIPTION.MAX_LENGTH + 100,
      ); // Invalid - too long

      const startTime = performance.now();
      const errors = await validate(dto);
      const duration = performance.now() - startTime;

      expect(errors.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(30); // Even errors should be fast
    });

    it('should scale well with field combinations', async () => {
      const combinations = [
        { fieldsCount: 0, data: {} },
        { fieldsCount: 1, data: { name: 'Name' } },
        { fieldsCount: 1, data: { description: 'Description' } },
        { fieldsCount: 2, data: { name: 'Name', description: 'Description' } },
      ];

      const results: number[] = [];

      for (const combo of combinations) {
        const testDto = plainToClass(UpdateProjectDto, combo.data);

        const startTime = performance.now();
        await validate(testDto);
        const duration = performance.now() - startTime;

        results.push(duration);
      }

      // Performance should not degrade significantly with more fields
      expect(Math.max(...results)).toBeLessThan(15);
    });

    it('should validate complex Unicode updates efficiently', async () => {
      dto.name = '🚀🌟💻 Unicode Update ✨🔥⚡';
      dto.description = `Updated проект with various scripts: English, Français, 中文, العربية`;

      const startTime = performance.now();
      const errors = await validate(dto);
      const duration = performance.now() - startTime;

      expect(errors).toHaveLength(0);
      expect(duration).toBeLessThan(25); // Unicode shouldn't slow down significantly
    });

    it('should handle conditional validation efficiently', async () => {
      const conditionalTests = [
        undefined, // No name - no validation
        '', // Empty name - should validate and fail
        '   ', // Whitespace - should validate and fail
        'Valid Name', // Valid name - should validate and pass
      ];

      const startTime = performance.now();

      for (const nameValue of conditionalTests) {
        const testDto = new UpdateProjectDto();
        testDto.name = nameValue;
        testDto.description = 'Valid description';

        await validate(testDto);
      }

      const duration = performance.now() - startTime;
      expect(duration).toBeLessThan(50);
    });
  });

  // ============================================================================
  // TESTS DE PERFORMANCE DE TRANSFORMATION
  // ============================================================================

  describe('transformation performance', () => {
    it('should transform simple update DTO quickly', async () => {
      const plainObject = {
        name: '  Updated Project Name  ',
        description: '  Updated description  ',
      };

      const startTime = performance.now();
      const transformed = plainToClass(UpdateProjectDto, plainObject);
      const duration = performance.now() - startTime;

      expect(transformed.name).toBe('Updated Project Name');
      expect(transformed.description).toBe('Updated description');
      expect(duration).toBeLessThan(5);
    });

    it('should transform large update DTO efficiently', async () => {
      const plainObject = {
        name: '  ' + 'A'.repeat(98) + '  ',
        description: '  ' + 'B'.repeat(998) + '  ',
      };

      const startTime = performance.now();
      const transformed = plainToClass(UpdateProjectDto, plainObject);
      const duration = performance.now() - startTime;

      expect(transformed.name).toBe('A'.repeat(98));
      expect(transformed.description).toBe('B'.repeat(998));
      expect(duration).toBeLessThan(15);
    });

    it('should handle multiple transformations efficiently', async () => {
      const plainObjects = Array(50)
        .fill(null)
        .map((_, i) => ({
          name: i % 2 === 0 ? `  Update ${i}  ` : undefined,
          description: i % 3 === 0 ? `  Description ${i}  ` : undefined,
        }));

      const startTime = performance.now();
      const transformed = plainObjects.map((obj) =>
        plainToClass(UpdateProjectDto, obj),
      );
      const duration = performance.now() - startTime;

      expect(transformed).toHaveLength(50);
      expect(transformed[0].name).toBe('Update 0');
      expect(duration).toBeLessThan(50);
    });

    it('should handle null/undefined transformations efficiently', async () => {
      const nullUndefinedCases = [
        { name: null, description: null },
        { name: undefined, description: undefined },
        { name: '  ', description: '  ' },
        { name: '', description: '' },
        {},
      ];

      const startTime = performance.now();

      for (const testCase of nullUndefinedCases) {
        const transformed = plainToClass(UpdateProjectDto, testCase);
        // Just ensure transformation doesn't crash
        expect(transformed).toBeInstanceOf(UpdateProjectDto);
      }

      const duration = performance.now() - startTime;
      expect(duration).toBeLessThan(25);
    });

    it('should handle edge case transformations efficiently', async () => {
      const edgeCases = [
        // Only name
        { name: '  Edge Name  ' },
        // Only description
        { description: '  Edge Description  ' },
        // Description clearing
        { description: '' },
        // Mixed whitespace
        { name: '\t\n  Mixed  \r\n', description: '\t\r\n  Mixed  \n\t' },
      ];

      const startTime = performance.now();

      for (const testCase of edgeCases) {
        const transformed = plainToClass(UpdateProjectDto, testCase);
        // Verify transformations work correctly
        if (testCase.name !== undefined) {
          expect(typeof transformed.name).toBe('string');
        }
        if (testCase.description !== undefined) {
          expect(typeof transformed.description).toBe('string');
        }
      }

      const duration = performance.now() - startTime;
      expect(duration).toBeLessThan(20);
    });
  });

  // ============================================================================
  // TESTS DE PERFORMANCE SOUS CHARGE LÉGÈRE
  // ============================================================================

  describe('light load performance', () => {
    it('should handle concurrent update validations efficiently', async () => {
      const concurrency = 20;

      const startTime = performance.now();

      const promises = Array(concurrency)
        .fill(null)
        .map(async (_, i) => {
          const testDto = new UpdateProjectDto();
          testDto.name = `Concurrent Update ${i}`;
          testDto.description = i % 3 === 0 ? `Description ${i}` : undefined;

          return validate(testDto);
        });

      const results = await Promise.all(promises);
      const duration = performance.now() - startTime;

      expect(results).toHaveLength(concurrency);
      results.forEach((errors) => {
        expect(errors).toHaveLength(0);
      });

      expect(duration).toBeLessThan(200);
    });

    it('should handle mixed update operations efficiently', async () => {
      const startTime = performance.now();

      const promises = [];

      // 10 validations
      for (let i = 0; i < 10; i++) {
        const testDto = new UpdateProjectDto();
        testDto.name = `Mixed Update ${i}`;
        testDto.description = i % 2 === 0 ? `Description ${i}` : undefined;
        promises.push(validate(testDto));
      }

      // 10 transformations
      for (let i = 0; i < 10; i++) {
        const plainObject = {
          name: i % 2 === 0 ? `  Transform Update ${i}  ` : undefined,
          description:
            i % 3 === 0 ? `  Transform Description ${i}  ` : undefined,
        };
        promises.push(
          Promise.resolve(plainToClass(UpdateProjectDto, plainObject)),
        );
      }

      const results = await Promise.all(promises);
      const duration = performance.now() - startTime;

      expect(results).toHaveLength(20);
      expect(duration).toBeLessThan(150);
    });

    it('should handle partial vs complete updates efficiently', async () => {
      const updatePatterns = [
        // Partial updates
        { name: 'Name Only' },
        { description: 'Description Only' },
        { description: '' }, // Clearing
        // Complete updates
        { name: 'Complete', description: 'Complete Update' },
        // No updates
        {},
      ];

      const iterations = 20; // Test each pattern multiple times
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        for (const pattern of updatePatterns) {
          const testDto = plainToClass(UpdateProjectDto, pattern);
          await validate(testDto);

          // Also test utility methods
          testDto.hasValidUpdates();
          testDto.getUpdateFieldsCount();
          testDto.isConsistent();
        }
      }

      const duration = performance.now() - startTime;
      expect(duration).toBeLessThan(300); // Should handle 100 operations quickly
    });
  });

  // ============================================================================
  // TESTS DE PERFORMANCE MÉMOIRE LÉGERS
  // ============================================================================

  describe('light memory performance', () => {
    it('should not leak memory during repeated update validations', async () => {
      const iterations = 100;

      if (global.gc) global.gc();
      const startMemory = process.memoryUsage().heapUsed;

      for (let i = 0; i < iterations; i++) {
        const testDto = new UpdateProjectDto();
        testDto.name = `Memory Test Update ${i}`;
        testDto.description = i % 2 === 0 ? `Description ${i}` : undefined;

        await validate(testDto);
      }

      if (global.gc) global.gc();
      const endMemory = process.memoryUsage().heapUsed;
      const memoryIncreaseMB = (endMemory - startMemory) / 1024 / 1024;

      expect(memoryIncreaseMB).toBeLessThan(5); // Less than 5MB for 100 validations
    });

    it('should handle large update strings without memory explosion', async () => {
      const largeString = 'A'.repeat(1000);

      const startMemory = process.memoryUsage().heapUsed;

      const dtos = Array(20)
        .fill(null)
        .map((_, i) => {
          const testDto = new UpdateProjectDto();
          testDto.name = largeString.substring(0, 100);
          testDto.description =
            i % 2 === 0 ? largeString.substring(0, 1000) : undefined;
          return testDto;
        });

      const promises = dtos.map((dto) => validate(dto));
      await Promise.all(promises);

      const endMemory = process.memoryUsage().heapUsed;
      const memoryIncreaseMB = (endMemory - startMemory) / 1024 / 1024;

      expect(memoryIncreaseMB).toBeLessThan(10);
    });

    it('should handle transformation memory efficiently', async () => {
      const startMemory = process.memoryUsage().heapUsed;

      for (let i = 0; i < 100; i++) {
        const largeInput = {
          name: '  ' + 'Name'.repeat(25) + '  ', // 100 chars after repeat
          description:
            i % 2 === 0 ? '  ' + 'Description'.repeat(90) + '  ' : undefined, // ~1000 chars
        };

        const transformed = plainToClass(UpdateProjectDto, largeInput);
        await validate(transformed);
      }

      if (global.gc) global.gc();
      const endMemory = process.memoryUsage().heapUsed;
      const memoryIncreaseMB = (endMemory - startMemory) / 1024 / 1024;

      expect(memoryIncreaseMB).toBeLessThan(8);
    });
  });

  // ============================================================================
  // TESTS DE PERFORMANCE DES MÉTHODES UTILITAIRES
  // ============================================================================

  describe('utility methods performance', () => {
    beforeEach(() => {
      dto.name = 'Performance Test Update';
      dto.description = 'Performance test description update';
    });

    it('should execute hasValidUpdates() quickly', () => {
      const iterations = 1000;

      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        dto.hasValidUpdates();
      }

      const duration = performance.now() - startTime;
      expect(duration).toBeLessThan(50);
    });

    it('should execute isValid() efficiently', () => {
      const iterations = 1000;

      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        dto.isValid();
      }

      const duration = performance.now() - startTime;
      expect(duration).toBeLessThan(100); // More complex validation, slightly more time
    });

    it('should execute field checkers efficiently', () => {
      const iterations = 1000;

      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        dto.isUpdatingName();
        dto.isUpdatingDescription();
        dto.isClearingDescription();
        dto.getUpdateFieldsCount();
      }

      const duration = performance.now() - startTime;
      expect(duration).toBeLessThan(50);
    });

    it('should execute getDefinedFields() efficiently', () => {
      const iterations = 500; // Fewer iterations as this creates new objects

      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        const fields = dto.getDefinedFields();
        expect(typeof fields).toBe('object');
      }

      const duration = performance.now() - startTime;
      expect(duration).toBeLessThan(100);
    });

    it('should execute toString() and toLogSafeString() efficiently', () => {
      const iterations = 100;

      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        dto.toString();
        dto.toLogSafeString();
      }

      const duration = performance.now() - startTime;
      expect(duration).toBeLessThan(100);
    });

    it('should handle utility methods with large data efficiently', () => {
      dto.name = 'A'.repeat(100);
      dto.description = 'B'.repeat(1000);

      const startTime = performance.now();

      for (let i = 0; i < 10; i++) {
        dto.isValid();
        dto.hasValidUpdates();
        dto.getUpdateFieldsCount();
        dto.isUpdatingName();
        dto.isUpdatingDescription();
        dto.isClearingDescription();
        dto.getDefinedFields();
        dto.isConsistent();
        dto.toString();
        dto.toLogSafeString();
        dto.createSecureCopy();
      }

      const duration = performance.now() - startTime;
      expect(duration).toBeLessThan(100);
    });

    it('should handle different update patterns efficiently', () => {
      const updatePatterns = [
        { name: 'Name Only', description: undefined },
        { name: undefined, description: 'Description Only' },
        { name: 'Both Fields', description: 'Both Updated' },
        { name: undefined, description: '' }, // Clearing only
        { name: undefined, description: undefined }, // No updates
      ];

      const startTime = performance.now();

      for (let i = 0; i < 50; i++) {
        for (const pattern of updatePatterns) {
          const testDto = new UpdateProjectDto();
          testDto.name = pattern.name;
          testDto.description = pattern.description;

          testDto.hasValidUpdates();
          testDto.isValid();
          testDto.getUpdateFieldsCount();
          testDto.toString();
        }
      }

      const duration = performance.now() - startTime;
      expect(duration).toBeLessThan(200);
    });
  });

  // ============================================================================
  // TESTS DE PERFORMANCE BASELINE
  // ============================================================================

  describe('baseline performance', () => {
    it('should maintain baseline performance for typical update usage', async () => {
      const typicalUpdates = [
        { name: 'Updated Project Name' },
        { description: 'Updated project description with more details' },
        { name: 'Complete Update', description: 'Complete update description' },
        { description: '' }, // Clearing description
        {}, // No updates
      ];

      const iterations = 20;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        for (const updateData of typicalUpdates) {
          const testDto = plainToClass(UpdateProjectDto, updateData);
          await validate(testDto);

          testDto.isValid();
          testDto.hasValidUpdates();
          testDto.getUpdateFieldsCount();
          testDto.toString();
        }
      }

      const duration = performance.now() - startTime;
      const avgDuration = duration / (iterations * typicalUpdates.length);

      expect(avgDuration).toBeLessThan(5); // Less than 5ms per complete operation
    });

    it('should scale efficiently with realistic update data growth', async () => {
      const dataSizes = [1, 2, 5];
      const results: number[] = [];

      for (const size of dataSizes) {
        const testDto = new UpdateProjectDto();
        testDto.name = 'Update Test ' + 'X'.repeat(size * 10);
        testDto.description =
          size % 2 === 0 ? 'Description '.repeat(size * 20) : undefined;

        const startTime = performance.now();

        await validate(testDto);
        testDto.isValid();
        testDto.hasValidUpdates();
        testDto.toString();

        const duration = performance.now() - startTime;
        results.push(duration);
      }

      // Performance should grow sub-linearly
      expect(results[2]).toBeLessThan(results[0] * 10);
    });

    it('should handle mixed validation and transformation workload efficiently', async () => {
      const workloadSize = 50;
      const startTime = performance.now();

      for (let i = 0; i < workloadSize; i++) {
        // Alternate between different operations
        switch (i % 4) {
          case 0: // Validation only
            const validationDto = new UpdateProjectDto();
            validationDto.name = `Validation ${i}`;
            await validate(validationDto);
            break;

          case 1: // Transformation only
            const transformData = { name: `  Transform ${i}  ` };
            plainToClass(UpdateProjectDto, transformData);
            break;

          case 2: // Both operations
            const bothData = {
              name: `  Both ${i}  `,
              description: `  Desc ${i}  `,
            };
            const bothDto = plainToClass(UpdateProjectDto, bothData);
            await validate(bothDto);
            break;

          case 3: // Utility methods
            const utilDto = new UpdateProjectDto();
            utilDto.name = `Util ${i}`;
            utilDto.hasValidUpdates();
            utilDto.isValid();
            utilDto.toString();
            break;
        }
      }

      const duration = performance.now() - startTime;
      expect(duration).toBeLessThan(250); // Should handle mixed workload efficiently
    });

    it('should maintain performance with edge case data', async () => {
      const edgeCaseUpdates = [
        // Boundary values
        { name: 'A'.repeat(100) },
        { description: 'B'.repeat(1000) },
        // Unicode
        { name: '🚀 Unicode Update' },
        // Empty/null handling
        { description: '' },
        { name: undefined, description: undefined },
        // Whitespace
        { name: '   Whitespace   ' },
      ];

      const iterations = 10;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        for (const updateData of edgeCaseUpdates) {
          const testDto = plainToClass(UpdateProjectDto, updateData);
          await validate(testDto);
          testDto.isValid();
          testDto.hasValidUpdates();
        }
      }

      const duration = performance.now() - startTime;
      const avgDuration = duration / (iterations * edgeCaseUpdates.length);

      expect(avgDuration).toBeLessThan(8); // Edge cases should still be performant
    });
  });
});
