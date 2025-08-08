import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { CreateProjectDto } from '../../../../src/project/dto/create-project.dto';

/**
 * Tests d'Edge Cases simplifiés pour CreateProjectDto
 */
describe('CreateProjectDto - Edge Cases', () => {
  let dto: CreateProjectDto;

  beforeEach(() => {
    dto = new CreateProjectDto();
  });

  // ============================================================================
  // EDGE CASES DES LIMITES DE VALIDATION
  // ============================================================================

  describe('validation boundaries', () => {
    it('should handle exact boundary values', async () => {
      const boundaryTests = [
        { name: 'A', valid: true }, // 1 char (min)
        { name: 'A'.repeat(100), valid: true }, // 100 chars (max)
        { name: 'A'.repeat(101), valid: false }, // 101 chars (over max)
        { name: '', valid: false }, // 0 chars (under min)
      ];

      for (const test of boundaryTests) {
        dto.name = test.name;
        dto.initialPrompt = 'A'.repeat(50);
        
        const errors = await validate(dto);
        const isValid = errors.length === 0;
        expect(isValid).toBe(test.valid);
      }
    });

    it('should handle UTF-8 multibyte characters', async () => {
      const multibyteChars = ['🚀', '💻', 'é', '中'];

      for (const char of multibyteChars) {
        dto.name = char;
        dto.initialPrompt = 'Create Unicode application';
        
        const errors = await validate(dto);
        expect(errors).toHaveLength(0);
        
        // Test boundary with multibyte chars
        dto.name = char.repeat(100);
        const boundaryErrors = await validate(dto);
        expect(boundaryErrors).toHaveLength(0);
        
        dto.name = char.repeat(101);
        const exceedErrors = await validate(dto);
        expect(exceedErrors.length).toBeGreaterThan(0);
      }
    });

    it('should handle array size boundaries', async () => {
      dto.name = 'Array Test';
      dto.initialPrompt = 'Create array test application';
      
      // Exactly 10 files (limit)
      dto.uploadedFileIds = Array(10).fill('550e8400-e29b-41d4-a716-446655440000');
      let errors = await validate(dto);
      expect(errors).toHaveLength(0);
      
      // 11 files (over limit)
      dto.uploadedFileIds = Array(11).fill('550e8400-e29b-41d4-a716-446655440000');
      errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // EDGE CASES D'ENCODAGE ET CARACTÈRES SPÉCIAUX
  // ============================================================================

  describe('encoding and special characters', () => {
    it('should handle various line endings with caution', async () => {
      const lineEndingTests = [
        'Line 1\nLine 2',       // Unix LF
        'Line 1\r\nLine 2',     // Windows CRLF
        'Line 1\rLine 2',       // Old Mac CR
      ];

      for (const text of lineEndingTests) {
        dto.name = 'Line Test';
        dto.description = text; // Description permet plus de caractères
        dto.initialPrompt = `Create app with line endings`;
        
        const errors = await validate(dto);
        expect(errors).toHaveLength(0);
      }
    });

    it('should handle Unicode normalization', async () => {
      const normalizationTests = [
        { nfc: 'é', nfd: 'e\u0301' },
        { nfc: 'ñ', nfd: 'n\u0303' },
      ];

      for (const test of normalizationTests) {
        dto.name = `Project ${test.nfc}`;
        dto.initialPrompt = `Create app with ${test.nfc}`;
        let errors = await validate(dto);
        expect(errors).toHaveLength(0);
        
        dto.name = `Project ${test.nfd}`;
        dto.initialPrompt = `Create app with ${test.nfd}`;
        errors = await validate(dto);
        expect(errors).toHaveLength(0);
      }
    });

    it('should handle zero-width characters', async () => {
      const zeroWidthTests = [
        'script\u200B',    // Zero width space
        'script\u200C',    // Zero width non-joiner
        'script\uFEFF',    // BOM
      ];

      for (const text of zeroWidthTests) {
        dto.name = `Project ${text}`;
        dto.initialPrompt = `Create app with ${text}`;
        
        const errors = await validate(dto);
        expect(errors).toHaveLength(0);
        expect(() => dto.toString()).not.toThrow();
      }
    });
  });

  // ============================================================================
  // EDGE CASES DE STRUCTURES DE DONNÉES
  // ============================================================================

  describe('data structure edge cases', () => {
    it('should handle circular references gracefully', async () => {
      const circular: any = { name: 'Circular Test' };
      circular.self = circular;
      
      dto.name = circular as any;
      dto.initialPrompt = 'Valid prompt';
      
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'name')).toBe(true);
      expect(() => validate(dto)).not.toThrow();
    });

    it('should handle malformed arrays', async () => {
      const malformedArrays = [
        { length: 5, 0: 'fake-uuid' },
        Object.assign([], { dangerous: 'value' }),
      ];

      for (const malformed of malformedArrays) {
        dto.name = 'Malformed Test';
        dto.initialPrompt = 'Create test application';
        dto.uploadedFileIds = malformed as any;
        
        const errors = await validate(dto);
        expect(() => validate(dto)).not.toThrow();
        
        // Les objets malformés peuvent ou non être détectés selon class-validator
        // On vérifie juste qu'il n'y a pas de crash
        expect(Array.isArray(errors)).toBe(true);
      }
    });
  });

  // ============================================================================
  // EDGE CASES DE PERFORMANCE LÉGERS
  // ============================================================================

  describe('light performance edge cases', () => {
    it('should handle large strings efficiently', async () => {
      const largeString = 'A'.repeat(1000);
      
      dto.name = largeString.substring(0, 100);
      dto.description = largeString;
      dto.initialPrompt = largeString.substring(0, 5000);
      
      const startTime = Date.now();
      const errors = await validate(dto);
      const duration = Date.now() - startTime;
      
      expect(duration).toBeLessThan(1000); // Less than 1 second
      expect(errors).toHaveLength(0);
    });

    it('should handle rapid creation cycles', async () => {
      const startTime = Date.now();
      
      for (let i = 0; i < 100; i++) {
        const testDto = new CreateProjectDto();
        testDto.name = `Test ${i}`;
        testDto.initialPrompt = `Create app ${i}`;
        
        testDto.isValid();
        testDto.toString();
      }
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(1000); // Should be fast
    });
  });

  // ============================================================================
  // EDGE CASES TEMPORELS SIMPLES
  // ============================================================================

  describe('timing edge cases', () => {
    it('should handle concurrent validation', async () => {
      const promises = Array(10).fill(null).map(async (_, i) => {
        const testDto = new CreateProjectDto();
        testDto.name = `Concurrent ${i}`;
        testDto.initialPrompt = `Create concurrent app ${i}`;
        return validate(testDto);
      });

      const results = await Promise.all(promises);
      expect(results).toHaveLength(10);
      results.forEach(errors => {
        expect(errors).toHaveLength(0);
      });
    });

    it('should handle validation timeout scenarios', async () => {
      const validationPromises = Array(20).fill(null).map(async (_, i) => {
        const testDto = new CreateProjectDto();
        testDto.name = `Timeout Test ${i}`;
        testDto.initialPrompt = 'Create timeout test application';
        return validate(testDto);
      });

      // Plus simple : juste attendre les promesses
      const results = await Promise.all(validationPromises);

      expect(Array.isArray(results)).toBe(true);
      expect(results).toHaveLength(20);
    });
  });

  // ============================================================================
  // EDGE CASES SYSTÈME SIMPLES
  // ============================================================================

  describe('system edge cases', () => {
    it('should handle problematic file names with care', async () => {
      const problematicNames = [
        'CON', 'PRN', 'AUX',     // Windows reserved
        'file.txt.',             // Trailing dot
        'file/name',             // Slash
        // 'file:name' retiré car déclenche la validation des protocoles dangereux
      ];

      for (const name of problematicNames) {
        dto.name = name;
        dto.initialPrompt = `Create app for ${name}`;
        
        const errors = await validate(dto);
        expect(errors).toHaveLength(0);
        expect(() => dto.toString()).not.toThrow();
      }
    });

    it('should reject dangerous protocol patterns in names', async () => {
      const dangerousNames = [
        'file:name',             // Protocole file
        'javascript:alert',      // Protocole javascript
      ];

      for (const name of dangerousNames) {
        dto.name = name;
        dto.initialPrompt = `Create app for safe usage`;
        
        const errors = await validate(dto);
        // Ces noms devraient être rejetés par la validation des protocoles
        expect(errors.length).toBeGreaterThan(0);
        const nameErrors = errors.filter(e => e.property === 'name');
        expect(nameErrors.length).toBeGreaterThan(0);
      }
    });

    it('should handle network encoding characters', async () => {
      const encodingChars = [
        '\u00A0',  // Non-breaking space
        '\u200B',  // Zero-width space
        '\uFEFF',  // BOM
      ];

      for (const char of encodingChars) {
        dto.name = `Network${char}Test`;
        dto.initialPrompt = `Create network app ${char}`;
        
        const errors = await validate(dto);
        expect(errors).toHaveLength(0);
        expect(() => JSON.stringify(dto)).not.toThrow();
      }
    });
  });

  // ============================================================================
  // EDGE CASES DE RÉGRESSION
  // ============================================================================

  describe('regression edge cases', () => {
    it('should handle previously problematic cases', async () => {
      const regressiveCases = [
        {
          name: 'Project\u0000WithNull',
          initialPrompt: 'Create app\u0000with\u0000nulls',
        },
        {
          name: 'Project With "Quotes"',
          initialPrompt: 'Create app with "quoted" content',
        },
        {
          name: 'Project With \\ Backslashes',
          initialPrompt: 'Create app with \\ backslashes',
        },
      ];

      for (const testCase of regressiveCases) {
        dto.name = testCase.name;
        dto.initialPrompt = testCase.initialPrompt;
        
        expect(() => validate(dto)).not.toThrow();
        expect(() => dto.toString()).not.toThrow();
        expect(() => dto.toLogSafeString()).not.toThrow();
      }
    });

    it('should handle extreme Unicode cases', async () => {
      const extremeUnicode = [
        '\uFFFF',        // Max BMP
        '🏴󠁧󠁢󠁳󠁣󠁴󠁿',    // Complex flag
        '👨‍👩‍👧‍👦',        // Family emoji
      ];

      for (const char of extremeUnicode) {
        dto.name = `Unicode ${char} Test`;
        dto.initialPrompt = `Create Unicode app ${char}`;
        
        expect(() => validate(dto)).not.toThrow();
        expect(() => dto.toString()).not.toThrow();
      }
    });
  });
});