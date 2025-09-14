import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import {
  CreateProjectDto,
  CREATE_PROJECT_CONSTANTS,
} from '../../../../src/project/dto/create-project.dto';

/**
 * Tests unitaires complets pour CreateProjectDto
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
      dto.initialPrompt = '   ';
      const errors = await validate(dto);

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

    it('should handle malformed transformation inputs safely', () => {
      const malformedInputs = [
        {
          name: ['Array', 'Name'], // Array instead of string
          initialPrompt: 'Valid prompt',
        },
        {
          name: 123, // Number instead of string
          initialPrompt: 'Valid prompt',
        },
        {
          name: { toString: () => 'Object Name' }, // Object with toString
          initialPrompt: 'Valid prompt',
        },
      ];

      malformedInputs.forEach((input) => {
        expect(() => {
          const transformed = plainToClass(CreateProjectDto, input);
          // Should not throw during transformation
          expect(transformed).toBeDefined();
        }).not.toThrow();
      });
    });

    it('should handle null and undefined gracefully', () => {
      const nullUndefinedCases = [
        {
          name: 'Valid Name',
          description: null,
          initialPrompt: 'Valid prompt',
        },
        {
          name: 'Valid Name',
          description: undefined,
          initialPrompt: 'Valid prompt',
        },
        {
          name: 'Valid Name',
          initialPrompt: 'Valid prompt',
          uploadedFileIds: null,
        },
      ];

      nullUndefinedCases.forEach((input) => {
        expect(() => {
          const transformed = plainToClass(CreateProjectDto, input);
          expect(transformed).toBeDefined();
        }).not.toThrow();
      });
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

      it('should handle edge cases in validation', () => {
        // Test avec des valeurs limites
        dto.name = 'A'.repeat(CREATE_PROJECT_CONSTANTS.NAME.MAX_LENGTH);
        dto.initialPrompt = 'A'.repeat(CREATE_PROJECT_CONSTANTS.INITIAL_PROMPT.MIN_LENGTH);
        expect(dto.isValid()).toBe(true);

        // Test juste au-dessus des limites
        dto.name = 'A'.repeat(CREATE_PROJECT_CONSTANTS.NAME.MAX_LENGTH + 1);
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

      it('should handle edge cases safely', () => {
        // Test avec undefined
        dto.uploadedFileIds = undefined;
        expect(dto.getUploadedFilesCount()).toBe(0);

        // Test avec null (si possible)
        (dto as any).uploadedFileIds = null;
        expect(dto.getUploadedFilesCount()).toBe(0);
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

      it('should handle edge cases in complexity calculation', () => {
        // Test exactement à la limite
        const exactlyMediumLength = 'A'.repeat(100); // Exactement 100 chars
        dto.initialPrompt = exactlyMediumLength;
        expect(dto.getPromptComplexity()).toBe('medium');

        // Test avec mots multiples
        const exactly15Words = 'word '.repeat(14) + 'word'; // Exactement 15 mots
        dto.initialPrompt = exactly15Words;
        expect(dto.getPromptComplexity()).toBe('medium');

        // Test avec prompt vide (ne devrait pas arriver en pratique)
        dto.initialPrompt = '';
        expect(dto.getPromptComplexity()).toBe('low');
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

      it('should handle undefined values correctly', () => {
        // Test sans description
        const result1 = dto.toString();
        expect(result1).toContain('with_description=false');

        // Test sans fichiers
        expect(result1).toContain('files=0');

        // Test avec valeurs définies
        dto.description = 'Some description';
        dto.uploadedFileIds = ['file1'];
        const result2 = dto.toString();
        expect(result2).toContain('with_description=true');
        expect(result2).toContain('files=1');
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

      it('should not expose sensitive information', () => {
        dto.name = 'Project with API key: sk-123456789';
        dto.description = 'Contains password: admin123';
        dto.initialPrompt = 'Create app with secret token xyz789';

        const result = dto.toLogSafeString();

        // Ne devrait pas contenir de données sensibles
        expect(result).not.toContain('API key');
        expect(result).not.toContain('sk-123456789');
        expect(result).not.toContain('password');
        expect(result).not.toContain('admin123');
        expect(result).not.toContain('secret token');
        expect(result).not.toContain('xyz789');

        // Devrait contenir seulement des métadonnées sûres
        expect(result).toContain('name_length=');
        expect(result).toContain('prompt_length=');
        expect(result).toContain('complexity=');
      });

      it('should handle undefined description safely', () => {
        dto.description = undefined;
        const result = dto.toLogSafeString();
        expect(result).toContain('has_description=false');
        expect(result).not.toContain('undefined');
      });
    });

    describe('getEstimatedCost()', () => {
      it('should estimate cost based on complexity', () => {
        // Low complexity
        dto.initialPrompt = 'Simple app';
        const lowCost = dto.getEstimatedCost();
        expect(lowCost).toBeGreaterThan(0);
        expect(lowCost).toBeLessThan(10);

        // Medium complexity
        dto.initialPrompt = 'Create a web application with user authentication and dashboard';
        const mediumCost = dto.getEstimatedCost();
        expect(mediumCost).toBeGreaterThan(lowCost);
        expect(mediumCost).toBeLessThan(50);

        // High complexity
        dto.initialPrompt = 'A'.repeat(400) + ' ' + 'feature '.repeat(60);
        const highCost = dto.getEstimatedCost();
        expect(highCost).toBeGreaterThan(mediumCost);
      });

      it('should factor in uploaded files count', () => {
        dto.initialPrompt = 'Create a web application';
        
        const costWithoutFiles = dto.getEstimatedCost();
        
        dto.uploadedFileIds = ['file1', 'file2', 'file3'];
        const costWithFiles = dto.getEstimatedCost();
        
        expect(costWithFiles).toBeGreaterThan(costWithoutFiles);
      });
    });

    describe('getProjectPreview()', () => {
      it('should generate project preview', () => {
        dto.name = 'E-commerce Platform';
        dto.description = 'Modern online shopping platform';
        dto.initialPrompt = 'Create e-commerce with React and Node.js';
        dto.uploadedFileIds = ['requirements.pdf'];

        const preview = dto.getProjectPreview();
        
        expect(preview).toHaveProperty('name', 'E-commerce Platform');
        expect(preview).toHaveProperty('description', 'Modern online shopping platform');
        expect(preview).toHaveProperty('complexity', 'medium');
        expect(preview).toHaveProperty('estimatedCost');
        expect(preview).toHaveProperty('uploadedFilesCount', 1);
        expect(preview.estimatedCost).toBeGreaterThan(0);
      });

      it('should handle missing optional fields', () => {
        dto.name = 'Minimal Project';
        dto.initialPrompt = 'Create simple app';
        // description et uploadedFileIds undefined

        const preview = dto.getProjectPreview();
        
        expect(preview.description).toBeUndefined();
        expect(preview.uploadedFilesCount).toBe(0);
        expect(preview.complexity).toBe('low');
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

    it('should handle realistic project creation scenarios', async () => {
      const scenarios = [
        {
          name: 'Web Application',
          description: 'Modern web app with React',
          initialPrompt: 'Create a React web application with user authentication and dashboard',
          uploadedFileIds: ['mockup.pdf', 'requirements.docx'],
        },
        {
          name: 'Mobile App',
          initialPrompt: 'Create a mobile application for iOS and Android with React Native',
          uploadedFileIds: [], // Pas de fichiers uploadés
        },
        {
          name: 'Enterprise System',
          description: 'Large scale enterprise resource planning system',
          initialPrompt: 'Create comprehensive ERP system with multiple modules including inventory, CRM, and reporting',
          uploadedFileIds: ['spec1.pdf', 'spec2.pdf', 'wireframes.sketch'],
        },
      ];

      for (const scenario of scenarios) {
        const dto = plainToClass(CreateProjectDto, scenario);
        const errors = await validate(dto);
        
        expect(errors).toHaveLength(0);
        expect(dto.isValid()).toBe(true);
        expect(dto.getPromptComplexity()).toBeDefined();
        expect(dto.getEstimatedCost()).toBeGreaterThan(0);
        
        const preview = dto.getProjectPreview();
        expect(preview.name).toBe(scenario.name);
        expect(preview.complexity).toMatch(/^(low|medium|high)$/);
      }
    });
  });

  // ============================================================================
  // TESTS DE SÉCURITÉ
  // ============================================================================

  describe('security tests', () => {
    it('should prevent XSS in name field', async () => {
      const xssPayloads = [
        '<script>alert("xss")</script>',
        'javascript:alert("xss")',
        '<img src="x" onerror="alert(1)">',
        '<svg onload="alert(1)">',
      ];

      for (const payload of xssPayloads) {
        dto.name = payload;
        dto.initialPrompt = 'Valid prompt';
        
        const errors = await validate(dto);
        expect(errors.length).toBeGreaterThan(0);
        
        const nameErrors = errors.filter(e => e.property === 'name');
        expect(nameErrors.length).toBeGreaterThan(0);
      }
    });

    it('should prevent injection in initialPrompt', async () => {
      const injectionPayloads = [
        'Create app with <script>alert("xss")</script>',
        'Build system with ${process.env.SECRET}',
        'Make app with javascript:alert(1)',
      ];

      for (const payload of injectionPayloads) {
        dto.name = 'Valid Name';
        dto.initialPrompt = payload;
        
        const errors = await validate(dto);
        expect(errors.length).toBeGreaterThan(0);
        
        const promptErrors = errors.filter(e => e.property === 'initialPrompt');
        expect(promptErrors.length).toBeGreaterThan(0);
      }
    });

    it('should handle prototype pollution attempts', () => {
      const maliciousInput = {
        name: 'Valid Name',
        initialPrompt: 'Valid prompt',
        '__proto__': { polluted: true },
        'constructor': { prototype: { evil: true } },
      };

      expect(() => {
        const dto = plainToClass(CreateProjectDto, maliciousInput);
        
        // Vérifier qu'il n'y a pas de pollution
        expect((Object.prototype as any).polluted).toBeUndefined();
        expect((CreateProjectDto.prototype as any).evil).toBeUndefined();
        
        // Les méthodes doivent toujours fonctionner
        expect(() => dto.isValid()).not.toThrow();
        expect(() => dto.toString()).not.toThrow();
      }).not.toThrow();
    });

    it('should not leak sensitive data in error messages', () => {
      const sensitiveData = 'SECRET_API_KEY_123';
      
      dto.name = sensitiveData;
      dto.initialPrompt = `Create app with ${sensitiveData}`;
      
      // Capturer les erreurs de console
      const originalConsoleError = console.error;
      const errors: string[] = [];
      console.error = (...args: any[]) => {
        errors.push(args.join(' '));
      };

      try {
        // Déclencher des opérations qui pourraient logger
        dto.toString();
        dto.toLogSafeString();
        dto.getPromptComplexity();
        dto.getEstimatedCost();
        
        // Vérifier qu'aucune donnée sensible n'est loggée
        errors.forEach(error => {
          expect(error).not.toContain(sensitiveData);
        });
      } finally {
        console.error = originalConsoleError;
      }
    });
  });

  // ============================================================================
  // TESTS DE PERFORMANCE
  // ============================================================================

  describe('performance tests', () => {
    it('should handle batch validation efficiently', async () => {
      const batchSize = 100;
      const startTime = Date.now();
      
      const promises = Array(batchSize).fill(null).map((_, i) => {
        const dto = plainToClass(CreateProjectDto, {
          name: `Batch Project ${i}`,
          initialPrompt: `Create batch application number ${i}`,
        });
        return validate(dto);
      });

      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;
      
      expect(results).toHaveLength(batchSize);
      expect(duration).toBeLessThan(1000); // Moins de 1 seconde
      
      results.forEach(errors => {
        expect(errors).toHaveLength(0);
      });
    });

    it('should handle large prompts efficiently', () => {
      const largePrompt = 'Create application '.repeat(1000); // ~20KB prompt
      
      const startTime = performance.now();
      dto.name = 'Large Prompt Project';
      dto.initialPrompt = largePrompt;
      
      const complexity = dto.getPromptComplexity();
      const cost = dto.getEstimatedCost();
      const preview = dto.getProjectPreview();
      
      const duration = performance.now() - startTime;
      
      expect(duration).toBeLessThan(100); // Moins de 100ms
      expect(complexity).toBe('high');
      expect(cost).toBeGreaterThan(0);
      expect(preview).toBeDefined();
    });
  });
});

// ============================================================================
// HELPERS ET MATCHERS PERSONNALISÉS
// ============================================================================

// Helper pour créer des données de test valides
function validProjectData() {
  return {
    name: DataGenerator.realisticProjectName(0),
    description: DataGenerator.realisticDescription(0),
    initialPrompt: DataGenerator.complexPrompt(0),
    uploadedFileIds: FileFixtures.uploadedFileIds(),
  };
}

// Helper pour créer des données de test invalides
function invalidProjectData() {
  return {
    name: '', // Invalide
    description: 'A'.repeat(TEST_CONSTANTS.VALID_DESCRIPTION_LENGTH.max + 1), // Trop long
    initialPrompt: 'Short', // Trop court
    uploadedFileIds: ['invalid-uuid'], // UUID invalide
  };
}

// Utilisation des helpers du fixtures
function createRealisticTestScenarios() {
  return [
    ProjectFixtures.validCreateDto(),
    ProjectFixtures.minimalCreateDto(),
    {
      name: DataGenerator.realisticProjectName(1),
      description: DataGenerator.realisticDescription(1),
      initialPrompt: DataGenerator.complexPrompt(1),
      uploadedFileIds: FileFixtures.singleUploadedFileId(),
    }
  ];
}

// Matcher personnalisé pour valider qu'un DTO est valide
expect.extend({
  toBeValidDto(received) {
    const pass = Array.isArray(received) && received.length === 0;
    if (pass) {
      return {
        message: () =>
          `expected ${received} not to be a valid DTO (no validation errors)`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected ${received} to be a valid DTO (should have no validation errors)`,
        pass: false,
      };
    }
  },
});

// Helper pour tests de performance
function measureExecutionTime<T>(fn: () => T): [T, number] {
  const start = performance.now();
  const result = fn();
  const duration = performance.now() - start;
  return [result, duration];
}

// Helper pour générer des données de test aléatoires
function generateRandomProjectData() {
  const complexities = ['low', 'medium', 'high'];
  const randomComplexity = complexities[Math.floor(Math.random() * complexities.length)];
  
  const prompts = {
    low: 'Simple app',
    medium: 'Create a web application with user authentication and basic features',
    high: 'Create comprehensive enterprise system with multiple modules, advanced analytics, real-time processing, microservices architecture, and full deployment automation',
  };

  return {
    name: `Random Project ${Math.random().toString(36).substr(2, 9)}`,
    description: Math.random() > 0.5 ? 'Random project description' : undefined,
    initialPrompt: prompts[randomComplexity as keyof typeof prompts],
    uploadedFileIds: Array(Math.floor(Math.random() * 5))
      .fill(null)
      .map(() => `550e8400-e29b-41d4-a716-44665544${Math.floor(Math.random() * 9999).toString().padStart(4, '0')}`),
  };
}