import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { UpdateProjectDto } from '../../../../src/project/dto/update-project.dto';

/**
 * Tests d'Edge Cases pour UpdateProjectDto
 */
describe('UpdateProjectDto - Edge Cases', () => {
  let dto: UpdateProjectDto;

  beforeEach(() => {
    dto = new UpdateProjectDto();
  });

  // ============================================================================
  // EDGE CASES DES LIMITES DE VALIDATION
  // ============================================================================

  describe('validation boundaries', () => {
    it('should handle exact boundary values for name', async () => {
      const boundaryTests = [
        { name: 'A', valid: true }, // 1 char (min)
        { name: 'A'.repeat(100), valid: true }, // 100 chars (max)
        { name: 'A'.repeat(101), valid: false }, // 101 chars (over max)
        { name: '', valid: false }, // 0 chars (under min when provided)
        { name: undefined, valid: true }, // undefined (no update)
      ];

      for (const test of boundaryTests) {
        dto.name = test.name;

        const errors = await validate(dto);
        const isValid = errors.length === 0;
        expect(isValid).toBe(test.valid);
      }
    });

    it('should handle exact boundary values for description', async () => {
      const boundaryTests = [
        { description: '', valid: true }, // 0 chars (clearing)
        { description: 'A'.repeat(1000), valid: true }, // 1000 chars (max)
        { description: 'A'.repeat(1001), valid: false }, // 1001 chars (over max)
        { description: undefined, valid: true }, // undefined (no update)
      ];

      for (const test of boundaryTests) {
        dto.description = test.description;

        const errors = await validate(dto);
        const isValid = errors.length === 0;
        expect(isValid).toBe(test.valid);
      }
    });

    it('should handle UTF-8 multibyte characters in updates', async () => {
      const multibyteChars = ['🚀', '💻', 'é', '中', '🏴󠁧󠁢󠁳󠁣󠁴󠁿'];

      for (const char of multibyteChars) {
        // Test name with multibyte
        dto.name = char;
        let errors = await validate(dto);
        expect(errors).toHaveLength(0);

        // Test boundary with multibyte chars in name
        dto.name = char.repeat(100);
        errors = await validate(dto);
        expect(errors).toHaveLength(0);

        dto.name = char.repeat(101);
        errors = await validate(dto);
        expect(errors.length).toBeGreaterThan(0);

        // Reset for description test
        dto = new UpdateProjectDto();

        // Test description with multibyte
        dto.description = char.repeat(1000);
        errors = await validate(dto);
        expect(errors).toHaveLength(0);

        dto.description = char.repeat(1001);
        errors = await validate(dto);
        expect(errors.length).toBeGreaterThan(0);

        // Reset for next iteration
        dto = new UpdateProjectDto();
      }
    });

    it('should handle partial update boundaries correctly', async () => {
      const partialTests = [
        // Only name at boundary
        { name: 'A'.repeat(100), valid: true },
        { name: 'A'.repeat(101), valid: false },

        // Only description at boundary
        { description: 'B'.repeat(1000), valid: true },
        { description: 'B'.repeat(1001), valid: false },

        // Both at max valid length
        { name: 'A'.repeat(100), description: 'B'.repeat(1000), valid: true },

        // One valid, one invalid
        { name: 'A'.repeat(100), description: 'B'.repeat(1001), valid: false },
        { name: 'A'.repeat(101), description: 'B'.repeat(1000), valid: false },
      ];

      for (const test of partialTests) {
        dto = new UpdateProjectDto();
        if (test.name !== undefined) dto.name = test.name;
        if (test.description !== undefined) dto.description = test.description;

        const errors = await validate(dto);
        const isValid = errors.length === 0;
        expect(isValid).toBe(test.valid);
      }
    });
  });

  // ============================================================================
  // EDGE CASES D'ENCODAGE ET CARACTÈRES SPÉCIAUX
  // ============================================================================

  describe('encoding and special characters', () => {
    it('should handle various line endings in description', async () => {
      const lineEndingTests = [
        'Line 1\nLine 2', // Unix LF
        'Line 1\r\nLine 2', // Windows CRLF
        'Line 1\rLine 2', // Old Mac CR
        'Multiple\n\nEmpty\r\n\rLines',
      ];

      for (const text of lineEndingTests) {
        dto.description = text;

        const errors = await validate(dto);
        expect(errors).toHaveLength(0);
      }
    });

    it('should handle Unicode normalization in updates', async () => {
      const normalizationTests = [
        { nfc: 'é', nfd: 'e\u0301' },
        { nfc: 'ñ', nfd: 'n\u0303' },
        { nfc: 'ü', nfd: 'u\u0308' },
      ];

      for (const test of normalizationTests) {
        // Test NFC form
        dto.name = `Updated ${test.nfc}`;
        dto.description = `Updated with ${test.nfc}`;
        let errors = await validate(dto);
        expect(errors).toHaveLength(0);

        // Test NFD form
        dto.name = `Updated ${test.nfd}`;
        dto.description = `Updated with ${test.nfd}`;
        errors = await validate(dto);
        expect(errors).toHaveLength(0);

        // Reset for next test
        dto = new UpdateProjectDto();
      }
    });

    it('should handle zero-width characters', async () => {
      const zeroWidthTests = [
        'update\u200B', // Zero width space
        'update\u200C', // Zero width non-joiner
        'update\u200D', // Zero width joiner
        'update\uFEFF', // BOM
        'update\u061C', // Arabic letter mark
      ];

      for (const text of zeroWidthTests) {
        dto.name = `Project ${text}`;
        dto.description = `Description ${text}`;

        const errors = await validate(dto);
        expect(errors).toHaveLength(0);
        expect(() => dto.toString()).not.toThrow();
        expect(() => dto.toLogSafeString()).not.toThrow();

        // Reset
        dto = new UpdateProjectDto();
      }
    });

    it('should handle mixed scripts and complex Unicode', async () => {
      const complexUnicodeTests = [
        'Project العربية', // Arabic
        'Проект Русский', // Cyrillic
        'プロジェクト日本語', // Japanese
        '项目中文', // Chinese
        'Projet Français', // French with accents
        'Projekt Deutsch', // German
        '👨‍👩‍👧‍👦 Family', // Emoji with ZWJ sequences
      ];

      for (const text of complexUnicodeTests) {
        dto.name = text;
        dto.description = `Updated description for ${text}`;

        const errors = await validate(dto);
        expect(errors).toHaveLength(0);
        expect(() => dto.isValid()).not.toThrow();

        // Reset
        dto = new UpdateProjectDto();
      }
    });
  });

  // ============================================================================
  // EDGE CASES DE STRUCTURES DE DONNÉES
  // ============================================================================

  describe('data structure edge cases', () => {
    it('should handle circular references gracefully', async () => {
      const circular: any = { name: 'Circular Update' };
      circular.self = circular;

      dto.name = circular as any;
      dto.description = 'Valid description';

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'name')).toBe(true);
      expect(() => validate(dto)).not.toThrow();
    });

    it('should handle malformed objects as field values', async () => {
      const malformedObjects = [
        {
          toString: () => {
            throw new Error('Malformed toString');
          },
        },
        {
          valueOf: () => {
            throw new Error('Malformed valueOf');
          },
        },
        Object.create(null), // Object without prototype
        new Proxy(
          {},
          {
            get: () => {
              throw new Error('Proxy error');
            },
          },
        ),
      ];

      for (const malformed of malformedObjects) {
        dto.name = malformed as any;
        dto.description = 'Valid description';

        expect(() => validate(dto)).not.toThrow();

        // Reset
        dto = new UpdateProjectDto();
      }
    });

    it('should handle symbol and function values', async () => {
      const specialValues = [
        Symbol('test'),
        () => 'function',
        async () => 'async function',
        function* generator() {
          yield 1;
        },
      ];

      for (const value of specialValues) {
        dto.name = value as any;

        const errors = await validate(dto);
        expect(errors.some((e) => e.property === 'name')).toBe(true);
        expect(() => validate(dto)).not.toThrow();

        // Reset
        dto = new UpdateProjectDto();
      }
    });

    it('should handle nested object transformations', async () => {
      const nestedInput = {
        name: {
          nested: 'Should not work',
          toString: () => 'Nested Name',
        },
        description: {
          value: 'Nested Description',
        },
      };

      const transformed = plainToClass(UpdateProjectDto, nestedInput);

      // Objects should be handled by transformation
      expect(typeof transformed.name).toBe('string');
      expect(typeof transformed.description).toBe('string');
    });
  });

  // ============================================================================
  // EDGE CASES DE PERFORMANCE LÉGERS
  // ============================================================================

  describe('light performance edge cases', () => {
    it('should handle large strings efficiently', async () => {
      const largeString = 'A'.repeat(2000);

      dto.name = largeString.substring(0, 100);
      dto.description = largeString.substring(0, 1000);

      const startTime = Date.now();
      const errors = await validate(dto);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(1000); // Less than 1 second
      expect(errors).toHaveLength(0);
    });

    it('should handle rapid update cycles', async () => {
      const startTime = Date.now();

      for (let i = 0; i < 100; i++) {
        const testDto = new UpdateProjectDto();
        testDto.name = `Update ${i}`;
        testDto.description = i % 2 === 0 ? `Description ${i}` : undefined;

        testDto.isValid();
        testDto.hasValidUpdates();
        testDto.toString();
        testDto.toLogSafeString();
      }

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(1000); // Should be fast
    });

    it('should handle transformation edge cases efficiently', async () => {
      const transformationCases = [
        { name: '  ' + 'A'.repeat(98) + '  ' }, // Whitespace + max length
        { description: '  ' + 'B'.repeat(998) + '  ' }, // Whitespace + max length
        { name: '\t\n  Mixed Whitespace  \r\n' },
        { description: null }, // null to empty string
      ];

      const startTime = Date.now();

      for (const testCase of transformationCases) {
        const transformed = plainToClass(UpdateProjectDto, testCase);
        await validate(transformed);
      }

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(500);
    });
  });

  // ============================================================================
  // EDGE CASES TEMPORELS SIMPLES
  // ============================================================================

  describe('timing edge cases', () => {
    it('should handle concurrent validation of updates', async () => {
      const promises = Array(10)
        .fill(null)
        .map(async (_, i) => {
          const testDto = new UpdateProjectDto();
          testDto.name = `Concurrent Update ${i}`;
          testDto.description = i % 3 === 0 ? `Description ${i}` : undefined;
          return validate(testDto);
        });

      const results = await Promise.all(promises);
      expect(results).toHaveLength(10);
      results.forEach((errors) => {
        expect(errors).toHaveLength(0);
      });
    });

    it('should handle mixed update operations concurrently', async () => {
      const updatePromises = Array(15)
        .fill(null)
        .map(async (_, i) => {
          const testDto = new UpdateProjectDto();

          // Différents patterns de mise à jour
          switch (i % 3) {
            case 0: // Name only
              testDto.name = `Name Update ${i}`;
              break;
            case 1: // Description only
              testDto.description = `Description Update ${i}`;
              break;
            case 2: // Both fields
              testDto.name = `Name ${i}`;
              testDto.description = `Description ${i}`;
              break;
          }

          return validate(testDto);
        });

      const results = await Promise.all(updatePromises);
      expect(Array.isArray(results)).toBe(true);
      expect(results).toHaveLength(15);
    });
  });

  // ============================================================================
  // EDGE CASES SYSTÈME SIMPLES
  // ============================================================================

  describe('system edge cases', () => {
    it('should handle problematic update names with care', async () => {
      const problematicNames = [
        'CON',
        'PRN',
        'AUX', // Windows reserved
        'update.txt.', // Trailing dot
        'update/name', // Slash
        'update\\name', // Backslash
        'update?name', // Question mark
        'update*name', // Asterisk
      ];

      for (const name of problematicNames) {
        dto.name = name;
        dto.description = `Updated description for ${name}`;

        const errors = await validate(dto);
        expect(errors).toHaveLength(0);
        expect(() => dto.toString()).not.toThrow();
      }
    });

    it('should reject dangerous protocol patterns in updates', async () => {
      const dangerousPatterns = [
        'javascript:alert("updated")',
        'vbscript:msgbox("updated")',
        'data:text/html,<script>alert("update")</script>',
        'file:///etc/passwd',
        'ftp://malicious.com/update',
      ];

      for (const pattern of dangerousPatterns) {
        dto.name = pattern;
        dto.description = `Safe description`;

        const errors = await validate(dto);
        // Ces patterns devraient être rejetés par la validation des protocoles
        expect(errors.length).toBeGreaterThan(0);
        const nameErrors = errors.filter((e) => e.property === 'name');
        expect(nameErrors.length).toBeGreaterThan(0);
      }
    });

    it('should handle network encoding characters in updates', async () => {
      const encodingChars = [
        '\u00A0', // Non-breaking space
        '\u1680', // Ogham space mark
        '\u2000', // En quad
        '\u2001', // Em quad
        '\u2028', // Line separator
        '\u2029', // Paragraph separator
        '\uFEFF', // BOM
      ];

      for (const char of encodingChars) {
        dto.name = `Update${char}Name`;
        dto.description = `Update description${char}content`;

        const errors = await validate(dto);
        expect(errors).toHaveLength(0);
        expect(() => JSON.stringify(dto)).not.toThrow();
      }
    });

    it('should handle partial updates with system characters', async () => {
      const systemCharTests = [
        { name: 'Update\u0000Name' }, // NULL in name only
        { description: 'Update\u0000Description' }, // NULL in description only
        { name: 'Update\tName', description: 'Update\rDescription' }, // Mixed
      ];

      for (const testCase of systemCharTests) {
        dto = new UpdateProjectDto();
        if (testCase.name !== undefined) dto.name = testCase.name;
        if (testCase.description !== undefined)
          dto.description = testCase.description;

        expect(() => validate(dto)).not.toThrow();
        expect(() => dto.toString()).not.toThrow();
        expect(() => dto.toLogSafeString()).not.toThrow();
      }
    });
  });

  // ============================================================================
  // EDGE CASES DE RÉGRESSION SPÉCIFIQUES AUX UPDATES
  // ============================================================================

  describe('update-specific regression edge cases', () => {
    it('should handle previously problematic update cases', async () => {
      const regressiveCases = [
        {
          name: 'Update\u0000WithNull',
          description: 'Update description\u0000with\u0000nulls',
        },
        {
          name: 'Update With "Quotes"',
          description: 'Update with "quoted" content',
        },
        {
          name: 'Update With \\ Backslashes',
          description: 'Update with \\ backslashes',
        },
        {
          // Test partial update with problematic chars
          name: 'Update\u200BWith\u200CZeroWidth',
        },
        {
          // Test clearing with problematic previous content
          description: '',
        },
      ];

      for (const testCase of regressiveCases) {
        dto = new UpdateProjectDto();
        if (testCase.name !== undefined) dto.name = testCase.name;
        if (testCase.description !== undefined)
          dto.description = testCase.description;

        expect(() => validate(dto)).not.toThrow();
        expect(() => dto.toString()).not.toThrow();
        expect(() => dto.toLogSafeString()).not.toThrow();
        expect(() => dto.hasValidUpdates()).not.toThrow();
        expect(() => dto.getDefinedFields()).not.toThrow();
      }
    });

    it('should handle extreme Unicode cases in updates', async () => {
      const extremeUnicode = [
        '\uFFFF', // Max BMP
        '🏴󠁧󠁢󠁳󠁣󠁴󠁿', // Complex flag emoji
        '👨‍👩‍👧‍👦', // Family emoji with ZWJ
        '\uD800\uDC00', // Surrogate pair (valid)
        '\u{1F600}', // Emoji in ES6 syntax
      ];

      for (const char of extremeUnicode) {
        dto.name = `Update ${char} Name`;
        dto.description = `Update ${char} Description`;

        expect(() => validate(dto)).not.toThrow();
        expect(() => dto.toString()).not.toThrow();
        expect(() => dto.isValid()).not.toThrow();

        // Reset
        dto = new UpdateProjectDto();
      }
    });

    it('should handle edge cases in field combination logic', async () => {
      const combinationTests = [
        // Name valid, description clearing
        { name: 'Valid Update', description: '' },

        // Name at boundary, description at boundary
        { name: 'A'.repeat(100), description: 'B'.repeat(1000) },

        // One field undefined, other at boundary
        { name: undefined, description: 'B'.repeat(1000) },
        { name: 'A'.repeat(100), description: undefined },

        // Both undefined (no update)
        { name: undefined, description: undefined },

        // Special characters combination
        { name: 'Update 🚀', description: 'Description 💻' },
      ];

      for (const test of combinationTests) {
        dto = new UpdateProjectDto();
        if (test.name !== undefined) dto.name = test.name;
        if (test.description !== undefined) dto.description = test.description;

        const errors = await validate(dto);
        expect(errors).toHaveLength(0);

        // Test utility methods work correctly
        expect(() => dto.hasValidUpdates()).not.toThrow();
        expect(() => dto.getUpdateFieldsCount()).not.toThrow();
        expect(() => dto.isConsistent()).not.toThrow();

        const definedFields = dto.getDefinedFields();
        expect(typeof definedFields).toBe('object');
      }
    });
  });

  // ============================================================================
  // EDGE CASES DE TRANSFORMATION AVANCÉE
  // ============================================================================

  describe('advanced transformation edge cases', () => {
    it('should handle deep object structures being flattened', async () => {
      const deepInput = {
        name: {
          deep: {
            nested: {
              value: 'Deep Update Name',
            },
          },
        },
        description: {
          content: {
            text: 'Deep Update Description',
          },
        },
      };

      // Should not crash, but may not produce expected values
      expect(() => plainToClass(UpdateProjectDto, deepInput)).not.toThrow();
    });

    it('should handle array-like objects as field values', async () => {
      const arrayLikeInputs = [
        { name: ['Update', 'Name'] },
        { description: ['Update', 'Description'] },
        { name: { 0: 'U', 1: 'p', length: 2 } }, // Array-like object
      ];

      for (const input of arrayLikeInputs) {
        expect(() => {
          const transformed = plainToClass(UpdateProjectDto, input);
          validate(transformed);
        }).not.toThrow();
      }
    });

    it('should handle transformation with getters and setters', async () => {
      const objectWithGettersSetters = {
        get name() {
          return 'Getter Update Name';
        },
        set name(value) {
          /* setter */
        },
        description: 'Normal Description',
      };

      expect(() => {
        const transformed = plainToClass(
          UpdateProjectDto,
          objectWithGettersSetters,
        );
        validate(transformed);
      }).not.toThrow();
    });

    it('should handle class instances as input', async () => {
      class MockUpdateInput {
        name = 'Class Update Name';
        description = 'Class Update Description';
        extraProperty = 'Should be ignored';
      }

      const classInput = new MockUpdateInput();

      expect(() => {
        const transformed = plainToClass(UpdateProjectDto, classInput);
        validate(transformed);
      }).not.toThrow();
    });
  });
});
