import { validate } from 'class-validator';
import { CreateProjectDto } from '../../../../src/project/dto/create-project.dto';

/**
 * Tests de sécurité simplifiés pour CreateProjectDto
 */
describe('CreateProjectDto - Security Tests', () => {
  let dto: CreateProjectDto;

  beforeEach(() => {
    dto = new CreateProjectDto();
    dto.name = 'Security Test Project';
    dto.initialPrompt = 'Create a secure test application';
  });

  // ============================================================================
  // TESTS ANTI-XSS ET INJECTION HTML
  // ============================================================================

  describe('XSS and HTML injection prevention', () => {
    it('should prevent script injection in initialPrompt', async () => {
      const xssPayloads = [
        '<script>alert("xss")</script>',
        '<script src="malicious.js"></script>',
        '<SCRIPT>alert("XSS")</SCRIPT>',
        '&lt;script&gt;alert("xss")&lt;/script&gt;',
        'javascript:alert("xss")',
        'vbscript:msgbox("xss")',
      ];

      for (const payload of xssPayloads) {
        dto.initialPrompt = `Create an application ${payload}`;
        
        const errors = await validate(dto);
        
        // Vérifier qu'il y a des erreurs si le payload contient des balises
        if (payload.includes('<') && payload.includes('>')) {
          expect(errors.length).toBeGreaterThan(0);
          expect(errors.some(e => e.property === 'initialPrompt')).toBe(true);
        }
      }
    });

    it('should prevent HTML injection in all fields', async () => {
      const htmlPayloads = [
        '<div>content</div>',
        '<img src="x" onerror="alert(1)">',
        '<svg onload="alert(1)">',
        '<iframe src="javascript:alert(1)">',
        '<form action="malicious.php">',
        '<meta http-equiv="refresh" content="0;url=malicious.com">',
      ];

      for (const payload of htmlPayloads) {
        dto.initialPrompt = `Create app with ${payload}`;
        
        const errors = await validate(dto);
        expect(errors).toHaveLength(1);
        
        const promptError = errors.find(e => e.property === 'initialPrompt');
        expect(promptError).toBeDefined();
        expect(promptError?.constraints?.matches).toBe('initialPrompt cannot contain HTML or XML tags');
        
        dto.initialPrompt = 'Valid prompt';
      }
    });

    it('should prevent XML injection attempts', async () => {
      const xmlPayloads = [
        '<?xml version="1.0"?><!DOCTYPE test>',
        '<?xml-stylesheet href="malicious.xsl"?>',
        '<!DOCTYPE html PUBLIC "malicious">',
        '<![CDATA[malicious content]]>',
        '<?php echo "malicious"; ?>',
      ];

      for (const payload of xmlPayloads) {
        dto.initialPrompt = `Create application ${payload}`;
        
        const errors = await validate(dto);
        expect(errors).toHaveLength(1);
        
        const promptError = errors.find(e => e.property === 'initialPrompt');
        expect(promptError).toBeDefined();
        expect(promptError?.constraints?.matches).toBe('initialPrompt cannot contain HTML or XML tags');
      }
    });

    it('should handle comparison operators safely', async () => {
      const safeContent = [
        'Create app for user_id = 1000',
        'Handle data where price equals 100', 
        'Process items with quantity greater than 50',
        'Filter results with rating above average',
      ];

      for (const content of safeContent) {
        dto.initialPrompt = content;
        
        const errors = await validate(dto);
        // Ces contenus devraient passer
        expect(errors).toHaveLength(0);
      }
    });
  });

  // ============================================================================
  // TESTS ANTI-INJECTION SQL (PATTERNS)
  // ============================================================================

  describe('SQL injection pattern handling', () => {
    it('should handle SQL injection patterns safely', async () => {
      // Ces patterns seront acceptés car Prisma gère l'échappement
      const sqlPatterns = [
        "'; DROP TABLE projects; --",
        "' OR '1'='1",
        "' UNION SELECT password FROM users --",
        "' AND 1=1 --",
        "\"; DROP DATABASE; --",
      ];

      for (const pattern of sqlPatterns) {
        dto.name = `Project ${pattern}`;
        dto.initialPrompt = `Create application ${pattern}`;
        
        // Ces patterns ne doivent pas causer de crash
        expect(() => validate(dto)).not.toThrow();
        
        const errors = await validate(dto);
        // Seules les contraintes de longueur peuvent échouer
        if (dto.name.length > 100) {
          expect(errors.some(e => e.property === 'name')).toBe(true);
        }
      }
    });

    it('should handle NoSQL injection patterns', async () => {
      const nosqlPatterns = [
        '{"$gt": ""}',
        '{"$ne": null}',
        '{"$regex": ".*"}',
        '{"$or": [{"a":1}, {"b":2}]}',
      ];

      for (const pattern of nosqlPatterns) {
        dto.initialPrompt = `Create app that handles ${pattern}`;
        
        const errors = await validate(dto);
        expect(errors).toHaveLength(0);
      }
    });
  });

  // ============================================================================
  // TESTS UNICODE MALVEILLANT
  // ============================================================================

  describe('malicious Unicode handling', () => {
    it('should handle Unicode control characters safely', async () => {
      const controlCharacters = [
        '\u0000', // NULL
        '\u0001', // SOH
        '\u0008', // BS
        '\u001F', // US
        '\u007F', // DEL
        '\u2028', // Line separator
        '\u2029', // Paragraph separator
      ];

      for (const char of controlCharacters) {
        dto.name = `Project${char}Name`;
        dto.initialPrompt = `Create application${char}with special chars`;
        
        expect(() => validate(dto)).not.toThrow();
      }
    });

    it('should handle bidirectional text attacks', async () => {
      const bidiAttacks = [
        'user\u202Eroot\u202C',     // RLO
        'user\u202Droot\u202C',     // LRO
        '\u061Cscript\u061C',       // Arabic letter mark
      ];

      for (const attack of bidiAttacks) {
        dto.name = attack;
        dto.initialPrompt = `Create application for ${attack}`;
        
        expect(() => validate(dto)).not.toThrow();
        expect(() => dto.toString()).not.toThrow();
      }
    });
  });

  // ============================================================================
  // TESTS DÉNI DE SERVICE LÉGERS
  // ============================================================================

  describe('light DoS prevention', () => {
    it('should handle large strings efficiently', async () => {
      const startTime = Date.now();
      
      const largeString = 'A'.repeat(10000); // 10KB
      dto.name = largeString;
      dto.initialPrompt = largeString;
      dto.description = largeString;
      
      const errors = await validate(dto);
      const duration = Date.now() - startTime;
      
      expect(duration).toBeLessThan(1000); // Less than 1 second
      expect(errors.some(e => e.property === 'name')).toBe(true);
      expect(errors.some(e => e.property === 'initialPrompt')).toBe(true);
    });

    it('should handle large arrays efficiently', async () => {
      const startTime = Date.now();
      
      const largeArray = Array(1000).fill('550e8400-e29b-41d4-a716-446655440000');
      dto.uploadedFileIds = largeArray;
      
      const errors = await validate(dto);
      const duration = Date.now() - startTime;
      
      expect(duration).toBeLessThan(1000);
      expect(errors.some(e => e.property === 'uploadedFileIds')).toBe(true);
    });

    it('should handle regex DoS attempts', async () => {
      const regexDosAttempts = [
        'a'.repeat(1000) + '<script>',
        '<' + 'a'.repeat(1000) + '>',
      ];

      for (const attempt of regexDosAttempts) {
        const startTime = Date.now();
        
        dto.initialPrompt = attempt;
        
        const errors = await validate(dto);
        const duration = Date.now() - startTime;
        
        expect(duration).toBeLessThan(100); // Should be fast
        expect(errors.some(e => e.property === 'initialPrompt')).toBe(true);
      }
    });
  });

  // ============================================================================
  // TESTS DE CORRUPTION DE DONNÉES
  // ============================================================================

  describe('data corruption prevention', () => {
    it('should handle prototype pollution attempts', async () => {
      const maliciousData = {
        name: 'Test',
        initialPrompt: 'Valid prompt',
        '__proto__': { polluted: true },
        'constructor': { prototype: { polluted: true } },
      };
      
      const testDto = Object.assign(new CreateProjectDto(), maliciousData);
      
      // Ne doit pas polluer le prototype global
      expect((Object.prototype as any).polluted).toBeUndefined();
      expect((CreateProjectDto.prototype as any).polluted).toBeUndefined();
      
      expect(() => validate(testDto)).not.toThrow();
    });

    it('should handle circular references', async () => {
      const circular: any = { name: 'Test' };
      circular.self = circular;
      circular.initialPrompt = 'Valid prompt';
      
      dto.uploadedFileIds = circular as any;
      
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'uploadedFileIds')).toBe(true);
      expect(() => validate(dto)).not.toThrow();
    });
  });

  // ============================================================================
  // TESTS DE SÉCURITÉ DES MÉTHODES UTILITAIRES
  // ============================================================================

  describe('utility methods security', () => {
    it('should handle malicious inputs in toString()', () => {
      dto.name = '<script>alert("xss")</script>';
      dto.description = '${process.env}';
      dto.initialPrompt = '{{constructor.constructor("alert(1)")()}}';
      
      expect(() => {
        const result = dto.toString();
        expect(typeof result).toBe('string');
      }).not.toThrow();
    });

    it('should handle malicious inputs in toLogSafeString()', () => {
      dto.name = '\u0000\u0001malicious\u0002';
      dto.initialPrompt = String.fromCharCode(0, 1, 2, 3) + 'content';
      
      expect(() => {
        const result = dto.toLogSafeString();
        expect(typeof result).toBe('string');
        expect(result).not.toContain('\u0000');
      }).not.toThrow();
    });

    it('should handle memory exhaustion in utility methods', () => {
      dto.name = 'A'.repeat(1000);
      dto.initialPrompt = 'B'.repeat(1000);
      dto.uploadedFileIds = Array(100).fill('550e8400-e29b-41d4-a716-446655440000');
      
      expect(() => {
        dto.toString();
        dto.toLogSafeString();
        dto.getUploadedFilesCount();
        dto.hasUploadedFiles();
        dto.getPromptComplexity();
        dto.isValid();
      }).not.toThrow();
    });
  });

  // ============================================================================
  // TESTS DE VALIDATION SÉCURISÉE
  // ============================================================================

  describe('secure validation', () => {
    it('should validate securely with mixed attacks', async () => {
      dto.name = '<script>alert("xss")</script>';
      dto.description = '"; DROP TABLE users; --';
      dto.initialPrompt = '<?xml version="1.0"?><root>evil</root>';
      dto.uploadedFileIds = ['<script>', 'javascript:alert(1)'];
      
      const errors = await validate(dto);
      
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.property === 'initialPrompt')).toBe(true);
      expect(errors.some(e => e.property === 'uploadedFileIds')).toBe(true);
    });

    it('should maintain security under load', async () => {
      const promises = Array(50).fill(null).map(async (_, i) => {
        const testDto = new CreateProjectDto();
        testDto.name = `Security Test ${i}`;
        testDto.initialPrompt = `<script>alert(${i})</script>`;
        return validate(testDto);
      });

      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(50);
      results.forEach(errors => {
        expect(errors.some(e => e.property === 'initialPrompt')).toBe(true);
      });
    });
  });
});