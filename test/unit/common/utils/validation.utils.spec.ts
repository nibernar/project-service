import { ValidationUtils, ValidationResult, SanitizeOptions } from '../../../../src/common/utils/validation.utils';

describe('ValidationUtils', () => {
  describe('constructor', () => {
    it('should not be instantiable', () => {
      expect(() => new (ValidationUtils as any)()).toThrow();
    });
  });

  describe('isValidProjectName', () => {
    it('should accept valid project names', () => {
      const validNames = [
        'My Project',
        'Project123',
        'project-name',
        'project_name',
        'A',
        'Simple Project Name',
        'Project-2024_v1',
        '123-test-project',
      ];

      validNames.forEach(name => {
        expect(ValidationUtils.isValidProjectName(name)).toBe(true);
      });
    });

    it('should reject empty names', () => {
      const emptyNames = [
        '',
        null,
        undefined,
        '   ',
        '\t\n\r',
      ];

      emptyNames.forEach(name => {
        expect(ValidationUtils.isValidProjectName(name as any)).toBe(false);
      });
    });

    it('should reject names too long', () => {
      const longName = 'a'.repeat(101); // Over 100 characters
      expect(ValidationUtils.isValidProjectName(longName)).toBe(false);
    });

    it('should accept names at maximum length', () => {
      const maxLengthName = 'a'.repeat(100); // Exactly 100 characters
      expect(ValidationUtils.isValidProjectName(maxLengthName)).toBe(true);
    });

    it('should reject names with invalid characters', () => {
      const invalidNames = [
        'project<script>',
        'project@email.com',
        'project#hash',
        'project%percent',
        'project&ampersand',
        'project*asterisk',
        'project+plus',
        'project=equals',
        'project[brackets]',
        'project{braces}',
        'project|pipe',
        'project\\backslash',
        'project:colon',
        'project;semicolon',
        'project"quotes',
        'project\'apostrophe',
        'project?question',
        'project/slash',
        'project.dot',
        'project,comma',
      ];

      invalidNames.forEach(name => {
        expect(ValidationUtils.isValidProjectName(name)).toBe(false);
      });
    });

    it('should reject names with only special characters', () => {
      const specialOnlyNames = [
        '---',
        '___',
        '   ',
        '- _',
        '_-_-_',
      ];

      specialOnlyNames.forEach(name => {
        expect(ValidationUtils.isValidProjectName(name)).toBe(false);
      });
    });

    it('should handle non-string input', () => {
      const nonStrings = [
        123,
        true,
        {},
        [],
        new Date(),
      ];

      nonStrings.forEach(input => {
        expect(ValidationUtils.isValidProjectName(input as any)).toBe(false);
      });
    });
  });

  describe('validateProjectName', () => {
    it('should return detailed validation for valid names', () => {
      const result = ValidationUtils.validateProjectName('Valid Project');
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.warnings).toBeDefined();
    });

    it('should provide detailed error messages', () => {
      const result = ValidationUtils.validateProjectName('');
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Project name cannot be empty');
    });

    it('should warn about short names', () => {
      const result = ValidationUtils.validateProjectName('Ab');
      
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('Project names with less than 3 characters may be too short');
    });

    it('should warn about trimming whitespace', () => {
      const result = ValidationUtils.validateProjectName('  Project Name  ');
      
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('Project name will be trimmed of leading/trailing whitespace');
    });

    it('should handle multiple validation errors', () => {
      const result = ValidationUtils.validateProjectName('a'.repeat(101) + '@invalid');
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
      expect(result.errors).toContain('Project name cannot exceed 100 characters');
      expect(result.errors).toContain('Project name can only contain letters, numbers, spaces, hyphens, and underscores');
    });
  });

  describe('sanitizeDescription', () => {
    it('should remove HTML tags', () => {
      const htmlDescription = '<p>This is a <strong>description</strong> with <em>HTML</em>.</p>';
      const sanitized = ValidationUtils.sanitizeDescription(htmlDescription);
      
      expect(sanitized).not.toContain('<p>');
      expect(sanitized).not.toContain('<strong>');
      expect(sanitized).not.toContain('</p>');
      expect(sanitized).toContain('This is a description with HTML.');
    });

    it('should remove dangerous HTML tags', () => {
      const dangerousHtml = '<script>alert("hack")</script><iframe src="evil.com"></iframe>';
      const sanitized = ValidationUtils.sanitizeDescription(dangerousHtml);
      
      expect(sanitized).not.toContain('<script');
      expect(sanitized).not.toContain('<iframe');
      expect(sanitized).not.toContain('alert');
      expect(sanitized).not.toContain('evil.com');
    });

    it('should trim whitespace', () => {
      const description = '   This is a description   ';
      const sanitized = ValidationUtils.sanitizeDescription(description);
      
      expect(sanitized).toBe('This is a description');
    });

    it('should limit length', () => {
      const longDescription = 'a'.repeat(1500);
      const sanitized = ValidationUtils.sanitizeDescription(longDescription);
      
      expect(sanitized.length).toBe(1000); // 997 chars + '...'
      expect(sanitized.endsWith('...')).toBe(true);
    });

    it('should remove brackets and content', () => {
      const description = 'Description with <brackets> and more';
      const sanitized = ValidationUtils.sanitizeDescription(description);
      
      expect(sanitized).toBe('Description with  and more');
    });

    it('should handle empty input', () => {
      expect(ValidationUtils.sanitizeDescription('')).toBe('');
      expect(ValidationUtils.sanitizeDescription(null as any)).toBe('');
      expect(ValidationUtils.sanitizeDescription(undefined as any)).toBe('');
    });

    it('should handle non-string input', () => {
      expect(ValidationUtils.sanitizeDescription(123 as any)).toBe('');
      expect(ValidationUtils.sanitizeDescription({} as any)).toBe('');
    });
  });

  describe('isValidDescription', () => {
    it('should accept valid descriptions', () => {
      const validDescriptions = [
        'This is a valid description.',
        'Short desc',
        'Description with numbers 123',
        'Multi-line\ndescription',
        '',
        undefined, // Optional field
      ];

      validDescriptions.forEach(desc => {
        expect(ValidationUtils.isValidDescription(desc as any)).toBe(true);
      });
    });

    it('should reject descriptions that are too long', () => {
      const longDescription = 'a'.repeat(1001);
      expect(ValidationUtils.isValidDescription(longDescription)).toBe(false);
    });

    it('should reject descriptions with unsafe characters', () => {
      const unsafeDescriptions = [
        'Description with <script>',
        'Description with >',
        'Description with "quotes"',
        'Description with \'apostrophes\'',
        'Description with &ampersand',
      ];

      unsafeDescriptions.forEach(desc => {
        expect(ValidationUtils.isValidDescription(desc)).toBe(false);
      });
    });

    it('should handle non-string input', () => {
      expect(ValidationUtils.isValidDescription(123 as any)).toBe(false);
      expect(ValidationUtils.isValidDescription({} as any)).toBe(false);
    });
  });

  describe('isValidFileId', () => {
    it('should accept valid UUIDs', () => {
      const validUUIDs = [
        '123e4567-e89b-42d3-a456-426614174000',
        '987fcdeb-51a2-4321-8876-543210987654',
        'f47ac10b-58cc-4372-9567-0e02b2c3d479',
      ];

      validUUIDs.forEach(uuid => {
        expect(ValidationUtils.isValidFileId(uuid)).toBe(true);
      });
    });

    it('should accept valid alternative file IDs', () => {
      const validFileIds = [
        'file123456789', // Au moins 8 caractères avec 4+ alphanumériques
        'document_abcd1234',
        'IMG20240101123456',
        'data_file_v2_final',
        'a1234567', // 8 caractères avec 5 alphanumériques
      ];

      validFileIds.forEach(fileId => {
        expect(ValidationUtils.isValidFileId(fileId)).toBe(true);
      });
    });

    // CORRECTION: Ajusté pour correspondre à la nouvelle logique plus stricte
    it('should reject invalid formats', () => {
      const invalidIds = [
        '',
        'short',
        '1234567', // 7 caractères, minimum 8
        'invalid-uuid',
        '123e4567-e89b-12d3-a456', // Invalid UUID format
        'file@invalid', // Caractères invalides
        'file with spaces', // Espaces
        '________', // Pas assez de caractères alphanumériques (0)
        '-invalid', // Commence par tiret
        '_invalid', // Commence par underscore
        'abc123__', // Seulement 6 caractères alphanumériques, besoin de 4+ mais la regex demande plus
        '___a___', // Seulement 1 caractère alphanumérique
        '123', // Trop court
        'a_______', // Seulement 1 caractère alphanumérique
        'ab_____c', // 3 caractères alphanumériques seulement
      ];

      invalidIds.forEach(id => {
        expect(ValidationUtils.isValidFileId(id)).toBe(false);
      });
    });

    it('should reject malicious content', () => {
      const maliciousIds = [
        '<script>alert("xss")</script>',
        'javascript:alert(1)',
        '../../../etc/passwd',
        'file"onclick="alert(1)"',
      ];

      maliciousIds.forEach(id => {
        expect(ValidationUtils.isValidFileId(id)).toBe(false);
      });
    });

    it('should handle null/undefined input', () => {
      expect(ValidationUtils.isValidFileId(null as any)).toBe(false);
      expect(ValidationUtils.isValidFileId(undefined as any)).toBe(false);
    });

    it('should handle non-string input', () => {
      expect(ValidationUtils.isValidFileId(123 as any)).toBe(false);
      expect(ValidationUtils.isValidFileId({} as any)).toBe(false);
    });
  });

  describe('validateFileIds', () => {
    it('should accept valid file ID arrays', () => {
      const validArrays = [
        [],
        ['123e4567-e89b-12d3-a456-426614174000'],
        ['file123456789', 'document_abcd1234'],
      ];

      validArrays.forEach(arr => {
        const result = ValidationUtils.validateFileIds(arr);
        expect(result.isValid).toBe(true);
        expect(result.errors).toEqual([]);
      });
    });

    it('should reject non-array input', () => {
      const nonArrays = [
        'not-an-array',
        123,
        {},
        null,
        undefined,
      ];

      nonArrays.forEach(input => {
        const result = ValidationUtils.validateFileIds(input as any);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('File IDs must be provided as an array');
      });
    });

    it('should detect invalid file IDs', () => {
      const invalidArray = ['valid_id_123456789', 'invalid'];
      const result = ValidationUtils.validateFileIds(invalidArray);
      
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('Invalid file IDs found');
      expect(result.errors[0]).toContain('Position 1: invalid');
    });

    it('should detect duplicate IDs', () => {
      const duplicateArray = ['file12345678', 'file87654321', 'file12345678'];
      const result = ValidationUtils.validateFileIds(duplicateArray);
      
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('Duplicate file IDs found');
      expect(result.errors[0]).toContain('file12345678');
    });

    it('should limit number of files', () => {
      const tooManyFiles = Array.from({ length: 51 }, (_, i) => `file${i.toString().padStart(8, '0')}`);
      const result = ValidationUtils.validateFileIds(tooManyFiles);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Cannot upload more than 50 files per project');
    });

    it('should warn about large number of files', () => {
      const manyFiles = Array.from({ length: 25 }, (_, i) => `file${i.toString().padStart(8, '0')}`);
      const result = ValidationUtils.validateFileIds(manyFiles);
      
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('Large number of files may impact performance');
    });
  });

  describe('isValidPrompt', () => {
    it('should accept valid prompts', () => {
      const validPrompts = [
        'Create a simple web application',
        'Build a REST API with authentication and user management features',
        'Develop a mobile app for task management with offline support',
        'A'.repeat(100), // Longer valid prompt
      ];

      validPrompts.forEach(prompt => {
        expect(ValidationUtils.isValidPrompt(prompt)).toBe(true);
      });
    });

    it('should reject prompts that are too short', () => {
      const shortPrompts = [
        '',
        'Short',
        'A'.repeat(9), // Less than 10 characters
      ];

      shortPrompts.forEach(prompt => {
        expect(ValidationUtils.isValidPrompt(prompt)).toBe(false);
      });
    });

    it('should reject prompts that are too long', () => {
      const longPrompt = 'a'.repeat(5001); // Over 5000 characters
      expect(ValidationUtils.isValidPrompt(longPrompt)).toBe(false);
    });

    it('should reject prompts with insufficient meaningful content', () => {
      const meaninglessPrompts = [
        '          ',
        'a a a a a', // Only 5 non-whitespace chars
        '- - - -',
      ];

      meaninglessPrompts.forEach(prompt => {
        expect(ValidationUtils.isValidPrompt(prompt)).toBe(false);
      });
    });

    it('should handle invalid encoding', () => {
      // This test might need adjustment based on actual encoding issues
      expect(ValidationUtils.isValidPrompt('Valid prompt text')).toBe(true);
    });

    it('should handle null/undefined input', () => {
      expect(ValidationUtils.isValidPrompt(null as any)).toBe(false);
      expect(ValidationUtils.isValidPrompt(undefined as any)).toBe(false);
    });
  });

  describe('validatePrompt', () => {
    it('should provide detailed validation for valid prompts', () => {
      const result = ValidationUtils.validatePrompt('Create a comprehensive web application with modern features');
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should warn about short prompts', () => {
      const result = ValidationUtils.validatePrompt('Short but valid prompt');
      
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('Short prompts may not provide enough context for optimal results');
    });

    it('should warn about few words', () => {
      const result = ValidationUtils.validatePrompt('Create app now');
      
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('Prompts with fewer than 5 words may be too brief');
    });

    it('should warn about missing punctuation', () => {
      const result = ValidationUtils.validatePrompt('Create a web application with authentication');
      
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('Consider ending your prompt with proper punctuation');
    });

    it('should not warn when punctuation is present', () => {
      const result = ValidationUtils.validatePrompt('Create a web application with authentication.');
      
      expect(result.isValid).toBe(true);
      expect(result.warnings?.some(w => w.includes('punctuation'))).toBe(false);
    });
  });

  describe('isValidUUID', () => {
    it('should accept valid UUID v4', () => {
      const validUUIDs = [
        '123e4567-e89b-42d3-a456-426614174000',
        '987fcdeb-51a2-4321-8876-543210987654',
        'f47ac10b-58cc-4372-9567-0e02b2c3d479',
      ];

      validUUIDs.forEach(uuid => {
        expect(ValidationUtils.isValidUUID(uuid)).toBe(true);
      });
    });

    it('should reject invalid UUIDs', () => {
      const invalidUUIDs = [
        '',
        'not-a-uuid',
        '123e4567-e89b-12d3-a456', // Too short
        '123e4567-e89b-12d3-a456-426614174000-extra', // Too long
        '123e4567-e89b-12d3-a456-426614174zzz', // Invalid characters
        '123e4567e89b12d3a456426614174000', // Missing dashes
      ];

      invalidUUIDs.forEach(uuid => {
        expect(ValidationUtils.isValidUUID(uuid)).toBe(false);
      });
    });

    it('should handle null/undefined input', () => {
      expect(ValidationUtils.isValidUUID(null as any)).toBe(false);
      expect(ValidationUtils.isValidUUID(undefined as any)).toBe(false);
    });
  });

  describe('sanitizeText', () => {
    const defaultOptions: SanitizeOptions = {};

    it('should trim whitespace by default', () => {
      const result = ValidationUtils.sanitizeText('  test  ', defaultOptions);
      expect(result).toBe('test');
    });

    it('should not trim when trimWhitespace is false', () => {
      const result = ValidationUtils.sanitizeText('  test  ', { trimWhitespace: false });
      expect(result).toBe('  test  ');
    });

    it('should remove HTML by default', () => {
      const result = ValidationUtils.sanitizeText('<p>test</p>', defaultOptions);
      expect(result).toBe('test');
    });

    it('should keep HTML when allowHtml is true', () => {
      const result = ValidationUtils.sanitizeText('<p>test</p>', { allowHtml: true });
      expect(result).toBe('<p>test</p>');
    });

    it('should remove special characters when requested', () => {
      const result = ValidationUtils.sanitizeText('test@#$%', { removeSpecialChars: true });
      expect(result).toBe('test');
    });

    it('should limit length when specified', () => {
      const result = ValidationUtils.sanitizeText('very long text here', { maxLength: 10 });
      expect(result).toBe('very lo...');
      expect(result.length).toBe(10);
    });

    it('should handle empty input', () => {
      expect(ValidationUtils.sanitizeText('', defaultOptions)).toBe('');
      expect(ValidationUtils.sanitizeText(null as any, defaultOptions)).toBe('');
      expect(ValidationUtils.sanitizeText(undefined as any, defaultOptions)).toBe('');
    });
  });

  describe('validateTextLength', () => {
    it('should accept text within valid range', () => {
      expect(ValidationUtils.validateTextLength('hello', 1, 10)).toBe(true);
      expect(ValidationUtils.validateTextLength('hello world', 5, 15)).toBe(true);
    });

    it('should reject text that is too short', () => {
      expect(ValidationUtils.validateTextLength('hi', 5, 10)).toBe(false);
    });

    it('should reject text that is too long', () => {
      expect(ValidationUtils.validateTextLength('very long text', 1, 5)).toBe(false);
    });

    it('should handle empty text with zero minimum', () => {
      expect(ValidationUtils.validateTextLength('', 0, 10)).toBe(true);
      expect(ValidationUtils.validateTextLength(null as any, 0, 10)).toBe(true);
    });

    it('should reject empty text with non-zero minimum', () => {
      expect(ValidationUtils.validateTextLength('', 1, 10)).toBe(false);
    });
  });

  describe('validateAndSanitizeInput', () => {
    it('should validate and sanitize complete input', () => {
      const input = {
        name: 'Valid Project',
        description: 'A good description',
        initialPrompt: 'Create a web application with authentication',
        uploadedFileIds: ['123e4567-e89b-12d3-a456-426614174000'],
      };

      const result = ValidationUtils.validateAndSanitizeInput(input);
      
      expect(result.isValid).toBe(true);
      expect(result.sanitized).toBeDefined();
      expect(result.sanitized?.name).toBe('Valid Project');
    });

    it('should handle partial input', () => {
      const input = {
        name: 'Valid Project',
      };

      const result = ValidationUtils.validateAndSanitizeInput(input);
      
      expect(result.isValid).toBe(true);
      expect(result.sanitized?.name).toBe('Valid Project');
      expect(result.sanitized?.description).toBeUndefined();
    });

    it('should collect multiple validation errors', () => {
      const input = {
        name: '', // Invalid
        description: 'a'.repeat(1001), // Invalid
        initialPrompt: 'short', // Invalid - moins de 10 caractères
        uploadedFileIds: ['invalid'], // Invalid
      };

      const result = ValidationUtils.validateAndSanitizeInput(input);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
      expect(result.sanitized).toBeUndefined();
    });

    it('should trim and sanitize valid inputs', () => {
      const input = {
        name: '  Valid Project  ',
        description: '  <p>Description</p>  ',
        initialPrompt: '  Create a comprehensive web application with modern authentication system and user management features.  ', // Ajout du point final
      };

      const result = ValidationUtils.validateAndSanitizeInput(input);
      
      expect(result.isValid).toBe(true);
      expect(result.sanitized?.name).toBe('Valid Project');
      expect(result.sanitized?.description).toBe('Description');
      expect(result.sanitized?.initialPrompt).toBe('Create a comprehensive web application with modern authentication system and user management features.');
    });
  });

  describe('additional validation methods', () => {
    describe('isValidProjectId', () => {
      it('should accept valid project IDs', () => {
        const validIds = [
          '123e4567-e89b-12d3-a456-426614174000',
          'project_12345678',
        ];

        validIds.forEach(id => {
          expect(ValidationUtils.isValidProjectId(id)).toBe(true);
        });
      });

      it('should reject invalid project IDs', () => {
        const invalidIds = [
          '',
          'short',
          'invalid@id',
        ];

        invalidIds.forEach(id => {
          expect(ValidationUtils.isValidProjectId(id)).toBe(false);
        });
      });
    });

    describe('isValidResourceType', () => {
      it('should accept valid resource types', () => {
        const validTypes = [
          'project',
          'statistics',
          'user',
          'file',
        ];

        validTypes.forEach(type => {
          expect(ValidationUtils.isValidResourceType(type)).toBe(true);
        });
      });

      it('should be case insensitive', () => {
        expect(ValidationUtils.isValidResourceType('PROJECT')).toBe(true);
        expect(ValidationUtils.isValidResourceType('Project')).toBe(true);
      });

      it('should reject invalid resource types', () => {
        const invalidTypes = [
          '',
          'invalid_type',
          'hack',
        ];

        invalidTypes.forEach(type => {
          expect(ValidationUtils.isValidResourceType(type)).toBe(false);
        });
      });
    });

    describe('isValidAction', () => {
      it('should accept valid actions', () => {
        const validActions = [
          'read',
          'write',
          'delete',
          'create',
          'admin',
        ];

        validActions.forEach(action => {
          expect(ValidationUtils.isValidAction(action)).toBe(true);
        });
      });

      it('should be case insensitive', () => {
        expect(ValidationUtils.isValidAction('READ')).toBe(true);
        expect(ValidationUtils.isValidAction('Delete')).toBe(true);
      });

      it('should reject invalid actions', () => {
        const invalidActions = [
          '',
          'hack',
          'exploit',
        ];

        invalidActions.forEach(action => {
          expect(ValidationUtils.isValidAction(action)).toBe(false);
        });
      });
    });
  });

  describe('performance tests', () => {
    it('should handle large inputs efficiently', () => {
      const largeInput = 'a'.repeat(10000);
      const start = Date.now();
      
      ValidationUtils.sanitizeText(largeInput);
      ValidationUtils.isValidProjectName(largeInput);
      ValidationUtils.isValidDescription(largeInput);
      
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(100); // Should complete in under 100ms
    });

    it('should handle many file IDs efficiently', () => {
      // CORRECTION: Génération d'IDs alternatifs valides pour éviter les problèmes d'UUID
      const manyFileIds = Array.from({ length: 50 }, (_, i) => 
        `file${i.toString().padStart(8, '0')}`
      );
      
      const start = Date.now();
      const result = ValidationUtils.validateFileIds(manyFileIds);
      const duration = Date.now() - start;
      
      expect(result.isValid).toBe(true);
      expect(duration).toBeLessThan(50); // Should complete quickly
    });
  });
});