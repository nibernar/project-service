import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import {
  CreateProjectDto,
  CREATE_PROJECT_CONSTANTS,
} from '../../../../src/project/dto/create-project.dto';

/**
 * Tests de performance simplifiés pour CreateProjectDto
 */
describe('CreateProjectDto - Performance Tests', () => {
  let dto: CreateProjectDto;

  beforeEach(() => {
    dto = new CreateProjectDto();
  });

  // ============================================================================
  // TESTS DE PERFORMANCE DE VALIDATION
  // ============================================================================

  describe('validation performance', () => {
    it('should validate small DTO quickly', async () => {
      dto.name = 'Quick Test';
      dto.initialPrompt = 'Create a quick test application';

      const startTime = performance.now();
      const errors = await validate(dto);
      const duration = performance.now() - startTime;

      expect(errors).toHaveLength(0);
      expect(duration).toBeLessThan(10); // Less than 10ms
    });

    it('should validate maximum size DTO efficiently', async () => {
      dto.name = 'A'.repeat(CREATE_PROJECT_CONSTANTS.NAME.MAX_LENGTH);
      dto.description = 'B'.repeat(
        CREATE_PROJECT_CONSTANTS.DESCRIPTION.MAX_LENGTH,
      );
      dto.initialPrompt = 'C'.repeat(
        CREATE_PROJECT_CONSTANTS.INITIAL_PROMPT.MAX_LENGTH,
      );
      dto.uploadedFileIds = Array(
        CREATE_PROJECT_CONSTANTS.UPLOADED_FILES.MAX_COUNT,
      ).fill('550e8400-e29b-41d4-a716-446655440000');

      const startTime = performance.now();
      const errors = await validate(dto);
      const duration = performance.now() - startTime;

      expect(errors).toHaveLength(0);
      expect(duration).toBeLessThan(50); // Less than 50ms
    });

    it('should handle invalid DTO validation quickly', async () => {
      dto.name = '';
      dto.description = 'A'.repeat(
        CREATE_PROJECT_CONSTANTS.DESCRIPTION.MAX_LENGTH + 100,
      );
      dto.initialPrompt = 'Short';
      dto.uploadedFileIds = ['invalid-uuid', 'another-invalid'];

      const startTime = performance.now();
      const errors = await validate(dto);
      const duration = performance.now() - startTime;

      expect(errors.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(30); // Even errors should be fast
    });

    it('should scale linearly with array size', async () => {
      const sizes = [1, 5, 10];
      const results: number[] = [];

      for (const size of sizes) {
        dto.name = 'Performance Test';
        dto.initialPrompt = 'Create a performance test application';
        dto.uploadedFileIds = Array(size).fill(
          '550e8400-e29b-41d4-a716-446655440000',
        );

        const startTime = performance.now();
        await validate(dto);
        const duration = performance.now() - startTime;

        results.push(duration);
      }

      // Validation should not grow exponentially
      expect(results[2]).toBeLessThan(results[0] * 20);
    });

    it('should validate complex Unicode efficiently', async () => {
      dto.name = '🚀🌟💻 Unicode Project ✨🔥⚡';
      dto.description = `Проект с различными языками: English, Français, 中文, العربية`;
      dto.initialPrompt = `Create multilingual app: 🌍 Global, 📱 Mobile, 🔒 Security`;

      const startTime = performance.now();
      const errors = await validate(dto);
      const duration = performance.now() - startTime;

      expect(errors).toHaveLength(0);
      expect(duration).toBeLessThan(25); // Unicode shouldn't slow down significantly
    });
  });

  // ============================================================================
  // TESTS DE PERFORMANCE DE TRANSFORMATION
  // ============================================================================

  describe('transformation performance', () => {
    it('should transform simple DTO quickly', async () => {
      const plainObject = {
        name: '  Simple Project  ',
        initialPrompt: '  Create a simple application  ',
        description: '  Simple description  ',
      };

      const startTime = performance.now();
      const transformed = plainToClass(CreateProjectDto, plainObject);
      const duration = performance.now() - startTime;

      expect(transformed.name).toBe('Simple Project');
      expect(transformed.initialPrompt).toBe('Create a simple application');
      expect(transformed.description).toBe('Simple description');
      expect(duration).toBeLessThan(5);
    });

    it('should transform large DTO efficiently', async () => {
      const plainObject = {
        name: '  ' + 'A'.repeat(98) + '  ',
        description: '  ' + 'B'.repeat(998) + '  ',
        initialPrompt: '  ' + 'C'.repeat(4998) + '  ',
        uploadedFileIds: Array(10).fill('550e8400-e29b-41d4-a716-446655440000'),
      };

      const startTime = performance.now();
      const transformed = plainToClass(CreateProjectDto, plainObject);
      const duration = performance.now() - startTime;

      expect(transformed.name).toBe('A'.repeat(98));
      expect(duration).toBeLessThan(15);
    });

    it('should handle multiple transformations efficiently', async () => {
      const plainObjects = Array(50)
        .fill(null)
        .map((_, i) => ({
          name: `  Project ${i}  `,
          initialPrompt: `  Create application number ${i}  `,
          description: i % 2 === 0 ? `  Description ${i}  ` : undefined,
        }));

      const startTime = performance.now();
      const transformed = plainObjects.map((obj) =>
        plainToClass(CreateProjectDto, obj),
      );
      const duration = performance.now() - startTime;

      expect(transformed).toHaveLength(50);
      expect(transformed[0].name).toBe('Project 0');
      expect(duration).toBeLessThan(50);
    });
  });

  // ============================================================================
  // TESTS DE PERFORMANCE SOUS CHARGE LÉGÈRE
  // ============================================================================

  describe('light load performance', () => {
    it('should handle concurrent validations efficiently', async () => {
      const concurrency = 20;

      const startTime = performance.now();

      const promises = Array(concurrency)
        .fill(null)
        .map(async (_, i) => {
          const testDto = new CreateProjectDto();
          testDto.name = `Concurrent Project ${i}`;
          testDto.initialPrompt = `Create concurrent application number ${i}`;
          testDto.uploadedFileIds =
            i % 3 === 0 ? ['550e8400-e29b-41d4-a716-446655440000'] : undefined;

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

    it('should handle mixed operations efficiently', async () => {
      const startTime = performance.now();

      const promises = [];

      // 10 validations
      for (let i = 0; i < 10; i++) {
        const testDto = new CreateProjectDto();
        testDto.name = `Mixed Load Project ${i}`;
        testDto.initialPrompt = `Create mixed load application ${i}`;
        promises.push(validate(testDto));
      }

      // 10 transformations
      for (let i = 0; i < 10; i++) {
        const plainObject = {
          name: `  Transform Project ${i}  `,
          initialPrompt: `  Transform application ${i}  `,
        };
        promises.push(
          Promise.resolve(plainToClass(CreateProjectDto, plainObject)),
        );
      }

      const results = await Promise.all(promises);
      const duration = performance.now() - startTime;

      expect(results).toHaveLength(20);
      expect(duration).toBeLessThan(150);
    });
  });

  // ============================================================================
  // TESTS DE PERFORMANCE MÉMOIRE LÉGERS
  // ============================================================================

  describe('light memory performance', () => {
    it('should not leak memory during repeated validations', async () => {
      const iterations = 100;

      if (global.gc) global.gc();
      const startMemory = process.memoryUsage().heapUsed;

      for (let i = 0; i < iterations; i++) {
        const testDto = new CreateProjectDto();
        testDto.name = `Memory Test ${i}`;
        testDto.initialPrompt = `Create memory test application ${i}`;

        await validate(testDto);
      }

      if (global.gc) global.gc();
      const endMemory = process.memoryUsage().heapUsed;
      const memoryIncreaseMB = (endMemory - startMemory) / 1024 / 1024;

      expect(memoryIncreaseMB).toBeLessThan(5); // Less than 5MB for 100 validations
    });

    it('should handle large strings without memory explosion', async () => {
      const largeString = 'A'.repeat(1000);

      const startMemory = process.memoryUsage().heapUsed;

      const dtos = Array(20)
        .fill(null)
        .map(() => {
          const testDto = new CreateProjectDto();
          testDto.name = largeString.substring(0, 100);
          testDto.description = largeString;
          testDto.initialPrompt = largeString.substring(0, 5000);
          return testDto;
        });

      const promises = dtos.map((dto) => validate(dto));
      await Promise.all(promises);

      const endMemory = process.memoryUsage().heapUsed;
      const memoryIncreaseMB = (endMemory - startMemory) / 1024 / 1024;

      expect(memoryIncreaseMB).toBeLessThan(10);
    });
  });

  // ============================================================================
  // TESTS DE PERFORMANCE DES MÉTHODES UTILITAIRES
  // ============================================================================

  describe('utility methods performance', () => {
    beforeEach(() => {
      dto.name = 'Performance Test Project';
      dto.description = 'A performance test project description';
      dto.initialPrompt = 'Create a performance test application';
      dto.uploadedFileIds = Array(10).fill(
        '550e8400-e29b-41d4-a716-446655440000',
      );
    });

    it('should execute isValid() quickly', () => {
      const iterations = 1000;

      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        dto.isValid();
      }

      const duration = performance.now() - startTime;
      expect(duration).toBeLessThan(50);
    });

    it('should execute getUploadedFilesCount() efficiently', () => {
      const iterations = 1000;

      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        const count = dto.getUploadedFilesCount();
        expect(count).toBe(10);
      }

      const duration = performance.now() - startTime;
      expect(duration).toBeLessThan(50); // Plus tolérant
    });

    it('should execute getPromptComplexity() efficiently', () => {
      const testCases = [
        'Simple app',
        'Create a comprehensive web application',
        'A'.repeat(500) + ' ' + 'word '.repeat(50),
      ];

      const startTime = performance.now();

      for (let i = 0; i < 100; i++) {
        for (const testCase of testCases) {
          dto.initialPrompt = testCase;
          dto.getPromptComplexity();
        }
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
      dto.initialPrompt = 'C'.repeat(5000);
      dto.uploadedFileIds = Array(10).fill(
        '550e8400-e29b-41d4-a716-446655440000',
      );

      const startTime = performance.now();

      for (let i = 0; i < 10; i++) {
        dto.isValid();
        dto.getUploadedFilesCount();
        dto.hasUploadedFiles();
        dto.getPromptComplexity();
        dto.toString();
        dto.toLogSafeString();
      }

      const duration = performance.now() - startTime;
      expect(duration).toBeLessThan(100);
    });
  });

  // ============================================================================
  // TESTS DE PERFORMANCE BASELINE
  // ============================================================================

  describe('baseline performance', () => {
    it('should maintain baseline performance for typical usage', async () => {
      const typicalDto = {
        name: 'Typical Project Name',
        description: 'A typical project description',
        initialPrompt:
          'Create a web application with user authentication and data management',
        uploadedFileIds: ['550e8400-e29b-41d4-a716-446655440000'],
      };

      const iterations = 20;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        const testDto = plainToClass(CreateProjectDto, typicalDto);
        await validate(testDto);

        testDto.isValid();
        testDto.getUploadedFilesCount();
        testDto.getPromptComplexity();
      }

      const duration = performance.now() - startTime;
      const avgDuration = duration / iterations;

      expect(avgDuration).toBeLessThan(5); // Less than 5ms per complete operation
    });

    it('should scale efficiently with realistic data growth', async () => {
      const dataSizes = [1, 2, 5];
      const results: number[] = [];

      for (const size of dataSizes) {
        const testDto = new CreateProjectDto();
        testDto.name = 'Scalability Test ' + 'X'.repeat(size * 10);
        testDto.description = 'Description '.repeat(size * 20);
        testDto.initialPrompt = 'Create application '.repeat(size * 30);
        testDto.uploadedFileIds = Array(size * 2).fill(
          '550e8400-e29b-41d4-a716-446655440000',
        );

        const startTime = performance.now();

        await validate(testDto);
        testDto.isValid();
        testDto.toString();

        const duration = performance.now() - startTime;
        results.push(duration);
      }

      // Performance should grow sub-linearly
      expect(results[2]).toBeLessThan(results[0] * 10);
    });
  });
});
