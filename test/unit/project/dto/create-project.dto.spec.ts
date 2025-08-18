import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
// Import depuis la racine du projet
import {
  CreateProjectDto,
  CREATE_PROJECT_CONSTANTS,
} from '../../../../src/project/dto/create-project.dto';

/**
 * Tests unitaires simplifiés pour CreateProjectDto
 */
describe('CreateProjectDto', () => {
  let dto: CreateProjectDto;

  beforeEach(() => {
    dto = new CreateProjectDto();
  });

  // ============================================================================
  // TESTS DE VALIDATION DU CHAMP NAME
  // ============================================================================

  describe('name validation', () => {
    beforeEach(() => {
      dto.initialPrompt = 'Create a valid test application';
    });

    it('should accept valid names', async () => {
      const validNames = [
        'A',
        'My Project',
        'A'.repeat(100),
        'Project-123',
        'Système RH',
        '🚀 SpaceApp',
      ];

      for (const name of validNames) {
        dto.name = name;
        const errors = await validate(dto);
        expect(errors).toHaveLength(0);
      }
    });

    it('should reject invalid names', async () => {
      const invalidCases = [
        { value: '', description: 'empty string' },
        { value: 'A'.repeat(101), description: 'too long' },
        { value: null, description: 'null value' },
        { value: 123, description: 'number instead of string' },
        { value: undefined, description: 'undefined value' },
        {
          value: '<script>alert("xss")</script>',
          description: 'dangerous characters',
        },
      ];

      for (const testCase of invalidCases) {
        dto.name = testCase.value as any;
        const errors = await validate(dto);

        expect(errors.length).toBeGreaterThan(0);

        const nameErrors = errors.filter((e) => e.property === 'name');
        expect(nameErrors.length).toBeGreaterThan(0);
      }
    });
  });

  // ============================================================================
  // TESTS DE VALIDATION DU CHAMP DESCRIPTION
  // ============================================================================

  describe('description validation', () => {
    beforeEach(() => {
      dto.name = 'Valid Project';
      dto.initialPrompt = 'Create a valid test application';
    });

    it('should accept valid descriptions', async () => {
      const validDescriptions = [
        undefined,
        '',
        'Short description',
        'A'.repeat(1000),
        'Multi\nline\ndescription',
      ];

      for (const description of validDescriptions) {
        dto.description = description;
        const errors = await validate(dto);
        expect(errors).toHaveLength(0);
      }
    });

    it('should reject invalid descriptions', async () => {
      dto.description = 'A'.repeat(1001);
      const errors = await validate(dto);

      expect(errors.length).toBeGreaterThan(0);
      const descErrors = errors.filter((e) => e.property === 'description');
      expect(descErrors.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // TESTS DE VALIDATION DU CHAMP INITIAL_PROMPT
  // ============================================================================

  describe('initialPrompt validation', () => {
    beforeEach(() => {
      dto.name = 'Valid Project';
    });

    it('should accept valid prompts', async () => {
      const validPrompts = [
        'A'.repeat(10),
        'Create a web application',
        'A'.repeat(5000),
        'Create app with React, Node.js, PostgreSQL',
      ];

      for (const prompt of validPrompts) {
        dto.initialPrompt = prompt;
        const errors = await validate(dto);
        expect(errors).toHaveLength(0);
      }
    });

    it('should reject invalid prompts', async () => {
      const invalidCases = [
        { value: '', expectedError: 'isNotEmpty' },
        { value: 'Short', expectedError: 'length' },
        { value: 'A'.repeat(5001), expectedError: 'length' },
        {
          value: 'Create <script>alert("xss")</script>',
          expectedError: 'matches',
        },
        { value: null, expectedError: 'isString' },
      ];

      for (const testCase of invalidCases) {
        dto.initialPrompt = testCase.value as any;
        const errors = await validate(dto);

        expect(errors.length).toBeGreaterThan(0);
        const promptErrors = errors.filter(
          (e) => e.property === 'initialPrompt',
        );
        expect(promptErrors.length).toBeGreaterThan(0);
      }
    });

    it('should handle whitespace-only prompts correctly', async () => {
      // Cas spécial: whitespace only
      dto.initialPrompt = '   ';
      const errors = await validate(dto);

      // Après transformation, "   " devient "" donc devrait être invalide
      expect(errors.length).toBeGreaterThan(0);
      const promptErrors = errors.filter((e) => e.property === 'initialPrompt');
      expect(promptErrors.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // TESTS DE VALIDATION DU CHAMP UPLOADED_FILE_IDS
  // ============================================================================

  describe('uploadedFileIds validation', () => {
    beforeEach(() => {
      dto.name = 'Valid Project';
      dto.initialPrompt = 'Create a valid test application';
    });

    it('should accept valid file IDs', async () => {
      const validCases = [
        undefined,
        [],
        ['550e8400-e29b-41d4-a716-446655440000'],
        Array(10).fill('550e8400-e29b-41d4-a716-446655440000'),
      ];

      for (const fileIds of validCases) {
        dto.uploadedFileIds = fileIds;
        const errors = await validate(dto);
        expect(errors).toHaveLength(0);
      }
    });

    it('should reject invalid file IDs', async () => {
      const invalidCases = [
        { value: 'not-array', expectedError: 'isArray' },
        {
          value: Array(11).fill('550e8400-e29b-41d4-a716-446655440000'),
          expectedError: 'arrayMaxSize',
        },
        { value: ['invalid-uuid'], expectedError: 'isUuid' },
        { value: [123], expectedError: 'isString' },
      ];

      for (const testCase of invalidCases) {
        dto.uploadedFileIds = testCase.value as any;
        const errors = await validate(dto);

        expect(errors.length).toBeGreaterThan(0);
        const fileErrors = errors.filter(
          (e) => e.property === 'uploadedFileIds',
        );
        expect(fileErrors.length).toBeGreaterThan(0);
      }
    });
  });

  // ============================================================================
  // TESTS DES TRANSFORMATIONS
  // ============================================================================

  describe('transformations', () => {
    it('should trim whitespace from fields', () => {
      const input = {
        name: '  Project Name  ',
        description: '  Description  ',
        initialPrompt: '  Create application  ',
      };

      const transformed = plainToClass(CreateProjectDto, input);
      expect(transformed.name).toBe('Project Name');
      expect(transformed.description).toBe('Description');
      expect(transformed.initialPrompt).toBe('Create application');
    });

    it('should convert empty description to undefined', () => {
      const input = {
        name: 'Valid Name',
        initialPrompt: 'Valid prompt',
        description: '   ',
      };

      const transformed = plainToClass(CreateProjectDto, input);
      expect(transformed.description).toBeUndefined();
    });
  });

  // ============================================================================
  // TESTS DES MÉTHODES UTILITAIRES
  // ============================================================================

  describe('utility methods', () => {
    beforeEach(() => {
      dto.name = 'Test Project';
      dto.initialPrompt = 'Create a test application';
    });

    describe('isValid()', () => {
      it('should return true for valid DTO', () => {
        expect(dto.isValid()).toBe(true);
      });

      it('should return false for invalid DTO', () => {
        dto.name = '';
        expect(dto.isValid()).toBe(false);

        dto.name = 'Valid';
        dto.initialPrompt = 'Short';
        expect(dto.isValid()).toBe(false);
      });
    });

    describe('getUploadedFilesCount()', () => {
      it('should return correct count', () => {
        expect(dto.getUploadedFilesCount()).toBe(0);

        dto.uploadedFileIds = [];
        expect(dto.getUploadedFilesCount()).toBe(0);

        dto.uploadedFileIds = ['uuid1', 'uuid2'];
        expect(dto.getUploadedFilesCount()).toBe(2);
      });
    });

    describe('hasUploadedFiles()', () => {
      it('should return correct boolean', () => {
        expect(dto.hasUploadedFiles()).toBe(false);

        dto.uploadedFileIds = [];
        expect(dto.hasUploadedFiles()).toBe(false);

        dto.uploadedFileIds = ['uuid1'];
        expect(dto.hasUploadedFiles()).toBe(true);
      });
    });

    describe('getPromptComplexity()', () => {
      it('should calculate complexity correctly', () => {
        // Low complexity: < 100 chars ou < 15 mots
        dto.initialPrompt = 'Simple app';
        expect(dto.getPromptComplexity()).toBe('low');

        // Medium complexity: 100-299 chars ou 15-49 mots
        dto.initialPrompt =
          'Create a comprehensive web application with multiple features, advanced functionality, user authentication, data management, reporting capabilities, and modern UI design';
        expect(dto.getPromptComplexity()).toBe('medium');

        // High complexity: 300+ chars ou 50+ mots
        dto.initialPrompt = 'A'.repeat(400) + ' ' + 'word '.repeat(60) + ' end';
        expect(dto.getPromptComplexity()).toBe('high');
      });
    });

    describe('toString()', () => {
      it('should generate descriptive string', () => {
        dto.description = 'Test description';
        dto.uploadedFileIds = ['uuid1', 'uuid2'];

        const result = dto.toString();
        expect(result).toContain('Test Project');
        expect(result).toContain('with_description=true');
        expect(result).toContain('files=2');
      });
    });

    describe('toLogSafeString()', () => {
      it('should generate safe log string', () => {
        dto.name = 'Sensitive Project';
        dto.uploadedFileIds = ['uuid1'];

        const result = dto.toLogSafeString();
        expect(result).not.toContain('Sensitive');
        expect(result).toContain('name_length=17');
        expect(result).toContain('files_count=1');
      });
    });
  });

  // ============================================================================
  // TESTS DE SCÉNARIOS COMPLETS
  // ============================================================================

  describe('complete scenarios', () => {
    it('should validate complete valid DTO', async () => {
      const completeDto = plainToClass(CreateProjectDto, validProjectData());
      const errors = await validate(completeDto);
      expect(errors).toBeValidDto();
    });

    it('should handle multiple validation errors', async () => {
      const invalidDto = plainToClass(CreateProjectDto, invalidProjectData());
      const errors = await validate(invalidDto);

      expect(errors.length).toBeGreaterThan(1);
      const properties = errors.map((e) => e.property);
      expect(properties).toContain('name');
      expect(properties).toContain('description');
      expect(properties).toContain('initialPrompt');
      expect(properties).toContain('uploadedFileIds');
    });

    it('should validate minimal DTO', async () => {
      dto.name = 'Minimal Project';
      dto.initialPrompt = 'Create minimal application';

      const errors = await validate(dto);
      expect(errors).toBeValidDto();
    });
  });
});
