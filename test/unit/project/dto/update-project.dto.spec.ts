import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import {
  UpdateProjectDto,
  UPDATE_PROJECT_CONSTANTS,
} from '../../../../src/project/dto/update-project.dto';

/**
 * Tests unitaires pour UpdateProjectDto
 */
describe('UpdateProjectDto', () => {
  let dto: UpdateProjectDto;

  beforeEach(() => {
    dto = new UpdateProjectDto();
  });

  // ============================================================================
  // TESTS DE VALIDATION DU CHAMP NAME (OPTIONNEL)
  // ============================================================================

  describe('name validation', () => {
    it('should accept valid names when provided', async () => {
      const validNames = [
        'A',
        'My Updated Project',
        'A'.repeat(100),
        'Project-Updated-123',
        'Système RH v2',
        '🚀 SpaceApp Updated',
      ];

      for (const name of validNames) {
        dto.name = name;
        const errors = await validate(dto);
        expect(errors).toHaveLength(0);
      }
    });

    it('should accept undefined name (no update)', async () => {
      dto.name = undefined;
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should reject invalid names when provided', async () => {
      const invalidCases = [
        { value: '', description: 'empty string after trim' },
        { value: '   ', description: 'whitespace only' },
        { value: 'A'.repeat(101), description: 'too long' },
        { value: null, description: 'null value' },
        { value: 123, description: 'number instead of string' },
        {
          value: '<script>alert("xss")</script>',
          description: 'dangerous characters',
        },
        { value: 'javascript:alert("xss")', description: 'dangerous protocol' },
      ];

      for (const testCase of invalidCases) {
        dto.name = testCase.value as any;
        const errors = await validate(dto);

        expect(errors.length).toBeGreaterThan(0);

        const nameErrors = errors.filter((e) => e.property === 'name');
        expect(nameErrors.length).toBeGreaterThan(0);
      }
    });

    it('should trim whitespace from name', () => {
      const input = {
        name: '  Updated Project Name  ',
      };

      const transformed = plainToClass(UpdateProjectDto, input);
      expect(transformed.name).toBe('Updated Project Name');
    });

    it('should validate name only when provided (conditional validation)', async () => {
      // Cas 1: Pas de nom fourni - devrait être valide
      dto.name = undefined;
      let errors = await validate(dto);
      expect(errors).toHaveLength(0);

      // Cas 2: Nom fourni mais vide après trim - devrait être invalide
      dto.name = '   ';
      errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);

      const nameErrors = errors.filter((e) => e.property === 'name');
      expect(nameErrors.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // TESTS DE VALIDATION DU CHAMP DESCRIPTION (OPTIONNEL)
  // ============================================================================

  describe('description validation', () => {
    it('should accept valid descriptions when provided', async () => {
      const validDescriptions = [
        undefined,
        '',
        'Updated short description',
        'A'.repeat(1000),
        'Multi\nline\nupdated description',
      ];

      for (const description of validDescriptions) {
        dto.description = description;
        const errors = await validate(dto);
        expect(errors).toHaveLength(0);
      }
    });

    it('should reject invalid descriptions when provided', async () => {
      dto.description = 'A'.repeat(1001);
      const errors = await validate(dto);

      expect(errors.length).toBeGreaterThan(0);
      const descErrors = errors.filter((e) => e.property === 'description');
      expect(descErrors.length).toBeGreaterThan(0);
    });

    it('should handle description clearing (empty string)', async () => {
      dto.description = '';
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should handle null conversion to empty string', () => {
      const input = {
        description: null,
      };

      const transformed = plainToClass(UpdateProjectDto, input);
      expect(transformed.description).toBe('');
    });

    it('should trim whitespace from description', () => {
      const input = {
        description: '  Updated description  ',
      };

      const transformed = plainToClass(UpdateProjectDto, input);
      expect(transformed.description).toBe('Updated description');
    });

    it('should reject HTML injection in description', async () => {
      const dangerousDescriptions = [
        '<script>alert("xss")</script>',
        '<img src="x" onerror="alert(1)">',
        'javascript:alert("dangerous")',
        'vbscript:msgbox("bad")',
        '<div onclick="evil()">content</div>',
      ];

      for (const description of dangerousDescriptions) {
        dto.description = description;
        const errors = await validate(dto);

        expect(errors.length).toBeGreaterThan(0);
        const descErrors = errors.filter((e) => e.property === 'description');
        expect(descErrors.length).toBeGreaterThan(0);
      }
    });
  });

  // ============================================================================
  // TESTS DES TRANSFORMATIONS
  // ============================================================================

  describe('transformations', () => {
    it('should handle partial updates correctly', () => {
      const testCases = [
        // Cas 1: Seulement le nom
        {
          input: { name: '  New Name  ' },
          expected: { name: 'New Name', description: undefined },
        },
        // Cas 2: Seulement la description
        {
          input: { description: '  New Description  ' },
          expected: { name: undefined, description: 'New Description' },
        },
        // Cas 3: Les deux champs
        {
          input: { name: '  New Name  ', description: '  New Description  ' },
          expected: { name: 'New Name', description: 'New Description' },
        },
        // Cas 4: Description vide (suppression)
        {
          input: { description: '' },
          expected: { name: undefined, description: '' },
        },
        // Cas 5: Objet vide (pas de modifications)
        {
          input: {},
          expected: { name: undefined, description: undefined },
        },
      ];

      for (const testCase of testCases) {
        const transformed = plainToClass(UpdateProjectDto, testCase.input);
        expect(transformed.name).toBe(testCase.expected.name);
        expect(transformed.description).toBe(testCase.expected.description);
      }
    });

    it('should handle edge case transformations', () => {
      const edgeCases = [
        // Whitespace uniquement dans le nom
        {
          input: { name: '   ' },
          // Après trim, devient '', mais le nom ne peut pas être vide quand fourni
          shouldHaveName: true,
          nameValue: '',
        },
        // Description avec whitespace seulement
        {
          input: { description: '   ' },
          shouldHaveDescription: true,
          descriptionValue: '',
        },
        // Valeurs null
        {
          input: { name: null, description: null },
          shouldHaveName: false, // null devient undefined pour name
          shouldHaveDescription: true, // null devient '' pour description
          descriptionValue: '',
        },
      ];

      for (const testCase of edgeCases) {
        const transformed = plainToClass(UpdateProjectDto, testCase.input);

        if (testCase.shouldHaveName) {
          expect(transformed.name).toBe(testCase.nameValue);
        }

        if (testCase.shouldHaveDescription) {
          expect(transformed.description).toBe(testCase.descriptionValue);
        }
      }
    });
  });

  // ============================================================================
  // TESTS DES MÉTHODES UTILITAIRES
  // ============================================================================

  describe('utility methods', () => {
    describe('hasValidUpdates()', () => {
      it('should return false for empty DTO', () => {
        expect(dto.hasValidUpdates()).toBe(false);
      });

      it('should return true when name is provided', () => {
        dto.name = 'Updated Name';
        expect(dto.hasValidUpdates()).toBe(true);
      });

      it('should return true when description is provided', () => {
        dto.description = 'Updated Description';
        expect(dto.hasValidUpdates()).toBe(true);
      });

      it('should return true when both fields are provided', () => {
        dto.name = 'Updated Name';
        dto.description = 'Updated Description';
        expect(dto.hasValidUpdates()).toBe(true);
      });

      it('should return true even for empty description (clearing)', () => {
        dto.description = '';
        expect(dto.hasValidUpdates()).toBe(true);
      });
    });

    describe('isValid()', () => {
      it('should return true for empty DTO (no updates)', () => {
        expect(dto.isValid()).toBe(true);
      });

      it('should return true for valid name', () => {
        dto.name = 'Valid Name';
        expect(dto.isValid()).toBe(true);
      });

      it('should return true for valid description', () => {
        dto.description = 'Valid Description';
        expect(dto.isValid()).toBe(true);
      });

      it('should return false for invalid name', () => {
        dto.name = '';
        expect(dto.isValid()).toBe(false);

        dto.name = 'A'.repeat(101);
        expect(dto.isValid()).toBe(false);

        dto.name = '<script>alert("xss")</script>';
        expect(dto.isValid()).toBe(false);
      });

      it('should return false for invalid description', () => {
        dto.description = 'A'.repeat(1001);
        expect(dto.isValid()).toBe(false);

        dto.description = '<script>alert("xss")</script>';
        expect(dto.isValid()).toBe(false);
      });

      it('should validate mixed valid/invalid fields correctly', () => {
        // Nom valide, description invalide
        dto.name = 'Valid Name';
        dto.description = 'A'.repeat(1001);
        expect(dto.isValid()).toBe(false);

        // Nom invalide, description valide
        dto.name = '';
        dto.description = 'Valid Description';
        expect(dto.isValid()).toBe(false);

        // Les deux valides
        dto.name = 'Valid Name';
        dto.description = 'Valid Description';
        expect(dto.isValid()).toBe(true);
      });
    });

    describe('getUpdateFieldsCount()', () => {
      it('should return 0 for empty DTO', () => {
        expect(dto.getUpdateFieldsCount()).toBe(0);
      });

      it('should return 1 for single field update', () => {
        dto.name = 'Updated Name';
        expect(dto.getUpdateFieldsCount()).toBe(1);

        dto = new UpdateProjectDto();
        dto.description = 'Updated Description';
        expect(dto.getUpdateFieldsCount()).toBe(1);
      });

      it('should return 2 for both fields update', () => {
        dto.name = 'Updated Name';
        dto.description = 'Updated Description';
        expect(dto.getUpdateFieldsCount()).toBe(2);
      });
    });

    describe('field update checkers', () => {
      it('should correctly identify field updates', () => {
        // État initial
        expect(dto.isUpdatingName()).toBe(false);
        expect(dto.isUpdatingDescription()).toBe(false);

        // Mise à jour du nom
        dto.name = 'Updated Name';
        expect(dto.isUpdatingName()).toBe(true);
        expect(dto.isUpdatingDescription()).toBe(false);

        // Mise à jour de la description
        dto.description = 'Updated Description';
        expect(dto.isUpdatingName()).toBe(true);
        expect(dto.isUpdatingDescription()).toBe(true);

        // Description vide (suppression)
        dto = new UpdateProjectDto();
        dto.description = '';
        expect(dto.isUpdatingDescription()).toBe(true);
        expect(dto.isClearingDescription()).toBe(true);
      });
    });

    describe('getDefinedFields()', () => {
      it('should return empty object for no updates', () => {
        const defined = dto.getDefinedFields();
        expect(defined).toEqual({});
        expect(Object.keys(defined)).toHaveLength(0);
      });

      it('should return only defined fields', () => {
        dto.name = 'Updated Name';

        const defined = dto.getDefinedFields();
        expect(defined).toEqual({ name: 'Updated Name' });
        expect(Object.keys(defined)).toHaveLength(1);
      });

      it('should include empty string description', () => {
        dto.description = '';

        const defined = dto.getDefinedFields();
        expect(defined).toEqual({ description: '' });
        expect(Object.keys(defined)).toHaveLength(1);
      });

      it('should return both fields when both are defined', () => {
        dto.name = 'Updated Name';
        dto.description = 'Updated Description';

        const defined = dto.getDefinedFields();
        expect(defined).toEqual({
          name: 'Updated Name',
          description: 'Updated Description',
        });
        expect(Object.keys(defined)).toHaveLength(2);
      });
    });

    describe('isConsistent()', () => {
      it('should return true for consistent updates', () => {
        expect(dto.isConsistent()).toBe(true);

        dto.name = 'Valid Name';
        expect(dto.isConsistent()).toBe(true);

        dto.description = 'Valid Description';
        expect(dto.isConsistent()).toBe(true);

        dto.description = ''; // Clearing is consistent
        expect(dto.isConsistent()).toBe(true);
      });

      it('should return false for inconsistent updates', () => {
        dto.name = '';
        expect(dto.isConsistent()).toBe(false);

        dto.name = '   '; // Whitespace only
        expect(dto.isConsistent()).toBe(false);
      });
    });

    describe('createSecureCopy()', () => {
      it('should create identical copy', () => {
        dto.name = 'Original Name';
        dto.description = 'Original Description';

        const copy = dto.createSecureCopy();

        expect(copy).toBeInstanceOf(UpdateProjectDto);
        expect(copy.name).toBe(dto.name);
        expect(copy.description).toBe(dto.description);
        expect(copy).not.toBe(dto); // Different instances
      });

      it('should handle undefined fields correctly', () => {
        dto.name = 'Only Name';
        // description reste undefined

        const copy = dto.createSecureCopy();

        expect(copy.name).toBe('Only Name');
        expect(copy.description).toBeUndefined();
      });
    });

    describe('toString()', () => {
      it('should generate descriptive string for no updates', () => {
        const result = dto.toString();
        expect(result).toBe('UpdateProjectDto[no_updates]');
      });

      it('should describe name update', () => {
        dto.name = 'Updated Name';

        const result = dto.toString();
        expect(result).toContain('UpdateProjectDto[');
        expect(result).toContain('name="Updated Name"');
      });

      it('should describe description update', () => {
        dto.description = 'Updated Description';

        const result = dto.toString();
        expect(result).toContain('description=updating');
      });

      it('should describe description clearing', () => {
        dto.description = '';

        const result = dto.toString();
        expect(result).toContain('description=clearing');
      });

      it('should describe multiple updates', () => {
        dto.name = 'Updated Name';
        dto.description = 'Updated Description';

        const result = dto.toString();
        expect(result).toContain('name="Updated Name"');
        expect(result).toContain('description=updating');
      });
    });

    describe('toLogSafeString()', () => {
      it('should generate safe log string without sensitive data', () => {
        dto.name = 'Sensitive Project Name';
        dto.description = 'Sensitive Description';

        const result = dto.toLogSafeString();

        expect(result).not.toContain('Sensitive');
        expect(result).toContain('name_length=');
        expect(result).toContain('description=updating');
        expect(result).toContain('fields=2');
      });

      it('should handle no updates safely', () => {
        const result = dto.toLogSafeString();
        expect(result).toBe('UpdateProjectDto[no_updates]');
      });

      it('should show clearing action safely', () => {
        dto.description = '';

        const result = dto.toLogSafeString();
        expect(result).toContain('description=clearing(0)');
        expect(result).toContain('fields=1');
      });
    });
  });

  // ============================================================================
  // TESTS DE SCÉNARIOS COMPLETS
  // ============================================================================

  describe('complete scenarios', () => {
    it('should validate minimal update (name only)', async () => {
      const minimalUpdate = plainToClass(UpdateProjectDto, {
        name: 'New Project Name',
      });

      const errors = await validate(minimalUpdate);
      expect(errors).toHaveLength(0);

      expect(minimalUpdate.hasValidUpdates()).toBe(true);
      expect(minimalUpdate.isUpdatingName()).toBe(true);
      expect(minimalUpdate.isUpdatingDescription()).toBe(false);
    });

    it('should validate complete update (both fields)', async () => {
      const completeUpdate = plainToClass(UpdateProjectDto, {
        name: 'Updated Project Name',
        description: 'Updated project description with more details',
      });

      const errors = await validate(completeUpdate);
      expect(errors).toHaveLength(0);

      expect(completeUpdate.hasValidUpdates()).toBe(true);
      expect(completeUpdate.getUpdateFieldsCount()).toBe(2);
      expect(completeUpdate.isConsistent()).toBe(true);
    });

    it('should validate description clearing scenario', async () => {
      const clearingUpdate = plainToClass(UpdateProjectDto, {
        description: '',
      });

      const errors = await validate(clearingUpdate);
      expect(errors).toHaveLength(0);

      expect(clearingUpdate.isClearingDescription()).toBe(true);
      expect(clearingUpdate.hasValidUpdates()).toBe(true);
    });

    it('should handle multiple validation errors', async () => {
      const invalidUpdate = plainToClass(UpdateProjectDto, {
        name: '', // Invalid - empty
        description: 'A'.repeat(1001), // Invalid - too long
      });

      const errors = await validate(invalidUpdate);
      expect(errors.length).toBeGreaterThan(1);

      const properties = errors.map((e) => e.property);
      expect(properties).toContain('name');
      expect(properties).toContain('description');
    });

    it('should handle edge case: no modifications', async () => {
      const noUpdate = plainToClass(UpdateProjectDto, {});

      const errors = await validate(noUpdate);
      expect(errors).toHaveLength(0);

      expect(noUpdate.hasValidUpdates()).toBe(false);
      expect(noUpdate.getUpdateFieldsCount()).toBe(0);
      expect(noUpdate.isConsistent()).toBe(true);
    });

    it('should handle partial invalid updates', async () => {
      // Nom valide, description invalide
      const partialInvalid = plainToClass(UpdateProjectDto, {
        name: 'Valid Name',
        description: 'A'.repeat(1001),
      });

      const errors = await validate(partialInvalid);
      expect(errors.length).toBeGreaterThan(0);

      // Seule la description devrait avoir des erreurs
      const nameErrors = errors.filter((e) => e.property === 'name');
      const descErrors = errors.filter((e) => e.property === 'description');

      expect(nameErrors).toHaveLength(0);
      expect(descErrors.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // TESTS DE COMPATIBILITÉ AVEC CREATE DTO
  // ============================================================================

  describe('compatibility with business logic', () => {
    it('should work with typical service update patterns', async () => {
      const updateData = {
        name: 'Updated Project Name',
        description: 'Updated description',
      };

      const dto = plainToClass(UpdateProjectDto, updateData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(0);

      // Pattern typique d'utilisation dans le service
      const fieldsToUpdate = dto.getDefinedFields();
      expect(fieldsToUpdate).toEqual(updateData);

      // Log sécurisé pour audit
      const logEntry = dto.toLogSafeString();
      expect(logEntry).toMatch(/UpdateProjectDto\[fields=2/);
    });

    it('should maintain consistent validation with creation constraints', async () => {
      // Les mêmes règles de validation que CreateProjectDto doivent s'appliquer
      const validationTests = [
        // Longueur nom
        {
          name: 'A'.repeat(UPDATE_PROJECT_CONSTANTS.NAME.MAX_LENGTH),
          valid: true,
        },
        {
          name: 'A'.repeat(UPDATE_PROJECT_CONSTANTS.NAME.MAX_LENGTH + 1),
          valid: false,
        },

        // Longueur description
        {
          description: 'A'.repeat(
            UPDATE_PROJECT_CONSTANTS.DESCRIPTION.MAX_LENGTH,
          ),
          valid: true,
        },
        {
          description: 'A'.repeat(
            UPDATE_PROJECT_CONSTANTS.DESCRIPTION.MAX_LENGTH + 1,
          ),
          valid: false,
        },

        // Sécurité
        { name: '<script>alert("xss")</script>', valid: false },
        { description: '<script>alert("xss")</script>', valid: false },
      ];

      for (const test of validationTests) {
        const dto = plainToClass(UpdateProjectDto, test);
        const errors = await validate(dto);
        const isValid = errors.length === 0;

        expect(isValid).toBe(test.valid);
      }
    });
  });
});

// ============================================================================
// HELPERS ET MATCHERS PERSONNALISÉS
// ============================================================================

// Helper pour créer des données de test valides
function createValidUpdateData() {
  return {
    name: 'Valid Updated Project',
    description: 'Valid updated project description',
  };
}

// Helper pour créer des données de test invalides
function createInvalidUpdateData() {
  return {
    name: '', // Invalide
    description: 'A'.repeat(1001), // Trop long
  };
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
