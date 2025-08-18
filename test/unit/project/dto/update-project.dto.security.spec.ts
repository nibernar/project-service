import { validate } from 'class-validator';
import { UpdateProjectDto } from '../../../../src/project/dto/update-project.dto';

/**
 * Tests de sécurité pour UpdateProjectDto
 */
describe('UpdateProjectDto - Security Tests', () => {
  let dto: UpdateProjectDto;

  beforeEach(() => {
    dto = new UpdateProjectDto();
  });

  // ============================================================================
  // TESTS ANTI-XSS ET INJECTION HTML
  // ============================================================================

  describe('XSS and HTML injection prevention', () => {
    it('should prevent script injection in name field', async () => {
      const xssPayloads = [
        '<script>alert("xss")</script>',
        '<script src="malicious.js"></script>',
        '<SCRIPT>alert("XSS")</SCRIPT>',
        '&lt;script&gt;alert("xss")&lt;/script&gt;',
        'javascript:alert("xss")',
        'vbscript:msgbox("xss")',
        '<img src="x" onerror="alert(1)">',
        '<svg onload="alert(1)">',
      ];

      for (const payload of xssPayloads) {
        dto.name = `Updated ${payload}`;

        const errors = await validate(dto);

        // Vérifier qu'il y a des erreurs pour les payloads dangereux
        if (payload.includes('<') && payload.includes('>')) {
          expect(errors.length).toBeGreaterThan(0);
          expect(errors.some((e) => e.property === 'name')).toBe(true);
        }

        if (payload.includes('javascript:') || payload.includes('vbscript:')) {
          expect(errors.length).toBeGreaterThan(0);
          expect(errors.some((e) => e.property === 'name')).toBe(true);
        }
      }
    });

    it('should prevent script injection in description field', async () => {
      const xssPayloads = [
        '<script>alert("update xss")</script>',
        '<iframe src="javascript:alert(1)">',
        '<form action="malicious.php">',
        '<meta http-equiv="refresh" content="0;url=malicious.com">',
        '<object data="javascript:alert(1)">',
        '<embed src="javascript:alert(1)">',
      ];

      for (const payload of xssPayloads) {
        dto.description = `Updated description ${payload}`;

        const errors = await validate(dto);
        expect(errors).toHaveLength(1);

        const descError = errors.find((e) => e.property === 'description');
        expect(descError).toBeDefined();
        expect(descError?.constraints?.matches).toBe(
          'description cannot contain HTML tags or potentially dangerous scripts',
        );
      }
    });

    it('should prevent HTML injection attempts in both fields', async () => {
      const htmlPayloads = [
        '<div>content</div>',
        '<span onclick="malicious()">text</span>',
        '<a href="javascript:alert(1)">link</a>',
        '<input type="hidden" value="malicious">',
        '<textarea>malicious content</textarea>',
        '<button onclick="evil()">click</button>',
      ];

      for (const payload of htmlPayloads) {
        // Test name field
        dto.name = `Updated ${payload}`;
        dto.description = 'Safe description';

        let errors = await validate(dto);
        expect(errors.length).toBeGreaterThan(0);

        let nameError = errors.find((e) => e.property === 'name');
        expect(nameError).toBeDefined();

        // Test description field
        dto.name = 'Safe Name';
        dto.description = `Updated ${payload}`;

        errors = await validate(dto);
        expect(errors.length).toBeGreaterThan(0);

        let descError = errors.find((e) => e.property === 'description');
        expect(descError).toBeDefined();

        // Reset
        dto = new UpdateProjectDto();
      }
    });

    it('should prevent XML injection attempts', async () => {
      const xmlPayloads = [
        '<?xml version="1.0"?><!DOCTYPE test>',
        '<?xml-stylesheet href="malicious.xsl"?>',
        '<!DOCTYPE html PUBLIC "malicious">',
        '<![CDATA[malicious content]]>',
        '<?php echo "malicious"; ?>',
        '<!ENTITY xxe SYSTEM "file:///etc/passwd">',
      ];

      for (const payload of xmlPayloads) {
        dto.name = `Updated ${payload}`;

        const errors = await validate(dto);
        expect(errors.length).toBeGreaterThan(0);

        const nameError = errors.find((e) => e.property === 'name');
        expect(nameError).toBeDefined();
        expect(nameError?.constraints?.matches).toBe(
          'name cannot contain potentially dangerous characters',
        );
      }
    });

    it('should handle comparison operators safely in updates', async () => {
      const safeContent = [
        'Update for user_id = 1000',
        'Handle data where price equals 100',
        'Process items with quantity greater than 50',
        'Filter results with rating above average',
        'Update condition: status != deleted',
        'Set value >= minimum threshold',
      ];

      for (const content of safeContent) {
        dto.name = content;
        dto.description = `Description: ${content}`;

        const errors = await validate(dto);
        // Ces contenus devraient passer
        expect(errors).toHaveLength(0);

        // Reset
        dto = new UpdateProjectDto();
      }
    });

    it('should prevent event handler injection', async () => {
      const eventHandlers = [
        'onclick="alert(1)"',
        'onload="malicious()"',
        'onerror="evil()"',
        'onmouseover="bad()"',
        'onfocus="dangerous()"',
        'onsubmit="hack()"',
      ];

      for (const handler of eventHandlers) {
        dto.name = `Updated name with ${handler}`;
        dto.description = `Updated description with ${handler}`;

        const errors = await validate(dto);
        expect(errors.length).toBeGreaterThan(0);

        // Both fields should have errors
        expect(errors.some((e) => e.property === 'name')).toBe(true);
        expect(errors.some((e) => e.property === 'description')).toBe(true);

        // Reset
        dto = new UpdateProjectDto();
      }
    });
  });

  // ============================================================================
  // TESTS ANTI-INJECTION SQL (PATTERNS)
  // ============================================================================

  describe('SQL injection pattern handling', () => {
    it('should handle SQL injection patterns safely in updates', async () => {
      // Ces patterns seront acceptés car Prisma gère l'échappement
      const sqlPatterns = [
        "'; DROP TABLE projects; --",
        "' OR '1'='1",
        "' UNION SELECT password FROM users --",
        "' AND 1=1 --",
        '"; DROP DATABASE; --',
        "1' OR 1=1--",
        "admin'--",
        "' OR 'x'='x",
      ];

      for (const pattern of sqlPatterns) {
        dto.name = `Updated ${pattern}`;
        dto.description = `Update with ${pattern}`;

        // Ces patterns ne doivent pas causer de crash
        expect(() => validate(dto)).not.toThrow();

        const errors = await validate(dto);
        // Seules les contraintes de longueur peuvent échouer
        if (dto.name && dto.name.length > 100) {
          expect(errors.some((e) => e.property === 'name')).toBe(true);
        }
        if (dto.description && dto.description.length > 1000) {
          expect(errors.some((e) => e.property === 'description')).toBe(true);
        }

        // Reset
        dto = new UpdateProjectDto();
      }
    });

    it('should handle NoSQL injection patterns in updates', async () => {
      const nosqlPatterns = [
        '{"$gt": ""}',
        '{"$ne": null}',
        '{"$regex": ".*"}',
        '{"$or": [{"a":1}, {"b":2}]}',
        '{"$where": "this.credits == this.debits"}',
        '{"$exists": true}',
      ];

      for (const pattern of nosqlPatterns) {
        dto.name = `Update with ${pattern}`;
        dto.description = `Updated handling ${pattern}`;

        const errors = await validate(dto);
        expect(errors).toHaveLength(0);

        // Reset
        dto = new UpdateProjectDto();
      }
    });

    it('should handle database function injection attempts', async () => {
      const dbFunctionPatterns = [
        'CONCAT("a", "b")',
        'SUBSTRING(name, 1, 10)',
        'UPPER(description)',
        'NOW()',
        'RAND()',
        'VERSION()',
      ];

      for (const pattern of dbFunctionPatterns) {
        dto.name = `Update ${pattern}`;
        dto.description = `Description with ${pattern}`;

        const errors = await validate(dto);
        expect(errors).toHaveLength(0);

        // Reset
        dto = new UpdateProjectDto();
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
        '\u202E', // Right-to-left override
        '\u202D', // Left-to-right override
      ];

      for (const char of controlCharacters) {
        dto.name = `Update${char}Name`;
        dto.description = `Update${char}Description`;

        expect(() => validate(dto)).not.toThrow();
        expect(() => dto.toString()).not.toThrow();
        expect(() => dto.toLogSafeString()).not.toThrow();

        // Reset
        dto = new UpdateProjectDto();
      }
    });

    it('should handle bidirectional text attacks', async () => {
      const bidiAttacks = [
        'user\u202Eroot\u202C', // RLO override
        'user\u202Droot\u202C', // LRO override
        '\u061Cscript\u061C', // Arabic letter mark
        'admin\u202E\u200Buser', // Complex override
        '\u2066override\u2069', // Isolate override
      ];

      for (const attack of bidiAttacks) {
        dto.name = attack;
        dto.description = `Updated for ${attack}`;

        expect(() => validate(dto)).not.toThrow();
        expect(() => dto.toString()).not.toThrow();
        expect(() => dto.hasValidUpdates()).not.toThrow();

        // Reset
        dto = new UpdateProjectDto();
      }
    });

    it('should handle Unicode normalization attacks', async () => {
      const normalizationAttacks = [
        // Visually similar but different Unicode
        'admin', // Normal
        'аdmin', // Cyrillic 'а' instead of Latin 'a'
        'аdmіn', // Cyrillic 'а' and 'і'
        'αdmin', // Greek alpha
        // Homograph attacks
        'gооgle', // 'о' are Cyrillic
        'аpple', // 'а' is Cyrillic
      ];

      for (const attack of normalizationAttacks) {
        dto.name = `Updated ${attack}`;
        dto.description = `Update for ${attack}`;

        const errors = await validate(dto);
        expect(errors).toHaveLength(0);
        expect(() => dto.isValid()).not.toThrow();

        // Reset
        dto = new UpdateProjectDto();
      }
    });

    it('should handle zero-width character attacks', async () => {
      const zeroWidthAttacks = [
        'update\u200Bscript', // Zero width space
        'update\u200Cscript', // Zero width non-joiner
        'update\u200Dscript', // Zero width joiner
        'update\uFEFFscript', // BOM
        'up\u200Bdate\u200Cscript\u200D', // Multiple
      ];

      for (const attack of zeroWidthAttacks) {
        dto.name = attack;
        dto.description = `Description ${attack}`;

        const errors = await validate(dto);
        expect(errors).toHaveLength(0);
        expect(() => dto.getDefinedFields()).not.toThrow();

        // Reset
        dto = new UpdateProjectDto();
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
      dto.name = largeString.substring(0, 100); // Within limits
      dto.description = largeString.substring(0, 1000); // Within limits

      const errors = await validate(dto);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(1000); // Less than 1 second
      expect(errors).toHaveLength(0);
    });

    it('should handle oversized strings with proper rejection', async () => {
      const startTime = Date.now();

      const oversizedString = 'A'.repeat(10000);
      dto.name = oversizedString; // Over limit
      dto.description = oversizedString; // Over limit

      const errors = await validate(dto);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(1000);
      expect(errors.some((e) => e.property === 'name')).toBe(true);
      expect(errors.some((e) => e.property === 'description')).toBe(true);
    });

    it('should handle regex DoS attempts', async () => {
      const regexDosAttempts = [
        'a'.repeat(1000) + '<script>',
        '<' + 'a'.repeat(1000) + '>',
        'update' + 'a'.repeat(1000) + 'javascript:',
        '<script>' + 'a'.repeat(1000) + '</script>',
      ];

      for (const attempt of regexDosAttempts) {
        const startTime = Date.now();

        dto.name = attempt.substring(0, 100); // Truncate to valid length
        dto.description = attempt.substring(0, 1000); // Truncate to valid length

        const errors = await validate(dto);
        const duration = Date.now() - startTime;

        expect(duration).toBeLessThan(100); // Should be fast
      }
    });

    it('should handle rapid validation cycles', async () => {
      const startTime = Date.now();

      for (let i = 0; i < 100; i++) {
        const testDto = new UpdateProjectDto();
        testDto.name = `Update ${i}`;
        testDto.description = i % 2 === 0 ? `Description ${i}` : undefined;

        await validate(testDto);
      }

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(2000); // Should handle 100 validations quickly
    });
  });

  // ============================================================================
  // TESTS DE CORRUPTION DE DONNÉES
  // ============================================================================

  describe('data corruption prevention', () => {
    it('should handle prototype pollution attempts', async () => {
      const maliciousData = {
        name: 'Safe Update',
        description: 'Safe Description',
        __proto__: { polluted: true },
        constructor: { prototype: { polluted: true } },
        prototype: { evil: true },
      };

      const testDto = Object.assign(new UpdateProjectDto(), maliciousData);

      // Ne doit pas polluer le prototype global
      expect((Object.prototype as any).polluted).toBeUndefined();
      expect((UpdateProjectDto.prototype as any).polluted).toBeUndefined();
      expect((UpdateProjectDto.prototype as any).evil).toBeUndefined();

      expect(() => validate(testDto)).not.toThrow();
    });

    it('should handle circular references in updates', async () => {
      const circular: any = { name: 'Circular Update' };
      circular.self = circular;
      circular.description = 'Safe description';

      dto.name = circular as any;
      dto.description = circular.description;

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'name')).toBe(true);
      expect(() => validate(dto)).not.toThrow();
    });

    it('should handle malformed objects safely', async () => {
      const malformedObjects = [
        // Object without toString
        Object.create(null),
        // Object with throwing toString
        {
          toString: () => {
            throw new Error('Bad toString');
          },
        },
        // Object with throwing valueOf
        {
          valueOf: () => {
            throw new Error('Bad valueOf');
          },
        },
        // Proxy that throws
        new Proxy(
          {},
          {
            get: () => {
              throw new Error('Bad proxy');
            },
            has: () => {
              throw new Error('Bad proxy');
            },
          },
        ),
      ];

      for (const malformed of malformedObjects) {
        dto = new UpdateProjectDto();
        dto.name = malformed as any;
        dto.description = 'Safe description';

        expect(() => validate(dto)).not.toThrow();
        expect(() => dto.hasValidUpdates()).not.toThrow();
      }
    });

    it('should handle memory exhaustion attempts', async () => {
      // Attempt to create memory pressure
      const memoryPressureData = {
        name: 'A'.repeat(100),
        description: 'B'.repeat(1000),
        // Additional properties that should be ignored
        ...Array(1000)
          .fill(null)
          .reduce((acc, _, i) => {
            acc[`prop${i}`] = `value${i}`;
            return acc;
          }, {}),
      };

      expect(() => {
        const testDto = Object.assign(
          new UpdateProjectDto(),
          memoryPressureData,
        );
        validate(testDto);
      }).not.toThrow();
    });
  });

  // ============================================================================
  // TESTS DE SÉCURITÉ DES MÉTHODES UTILITAIRES
  // ============================================================================

  describe('utility methods security', () => {
    it('should handle malicious inputs in toString()', () => {
      dto.name = '<script>alert("xss")</script>';
      dto.description = '${process.env}';

      expect(() => {
        const result = dto.toString();
        expect(typeof result).toBe('string');
        // Should not contain actual script execution
        expect(result).not.toContain('${process.env}');
      }).not.toThrow();
    });

    it('should handle malicious inputs in toLogSafeString()', () => {
      dto.name = '\u0000\u0001malicious\u0002';
      dto.description = String.fromCharCode(0, 1, 2, 3) + 'content';

      expect(() => {
        const result = dto.toLogSafeString();
        expect(typeof result).toBe('string');
        // Should not contain sensitive data
        expect(result).not.toContain('malicious');
        expect(result).not.toContain('\u0000');
      }).not.toThrow();
    });

    it('should handle security issues in getDefinedFields()', () => {
      dto.name = 'legitimate name';
      dto.description = 'legitimate description';

      // Inject malicious properties
      (dto as any).__proto__ = { malicious: true };
      (dto as any).constructor = { dangerous: true };

      expect(() => {
        const fields = dto.getDefinedFields();
        expect(typeof fields).toBe('object');
        expect(fields.hasOwnProperty('malicious')).toBe(false);
        expect(fields.hasOwnProperty('dangerous')).toBe(false);
        expect(fields.hasOwnProperty('constructor')).toBe(false);
        expect(fields.hasOwnProperty('__proto__')).toBe(false);
      }).not.toThrow();
    });

    it('should handle memory exhaustion in utility methods', () => {
      dto.name = 'A'.repeat(100);
      dto.description = 'B'.repeat(1000);

      expect(() => {
        // Run multiple times to check for memory leaks
        for (let i = 0; i < 100; i++) {
          dto.toString();
          dto.toLogSafeString();
          dto.hasValidUpdates();
          dto.getUpdateFieldsCount();
          dto.isUpdatingName();
          dto.isUpdatingDescription();
          dto.getDefinedFields();
          dto.isConsistent();
          dto.createSecureCopy();
        }
      }).not.toThrow();
    });

    it('should handle injection attempts in utility methods', () => {
      const injectionAttempts = [
        'eval("malicious code")',
        'Function("return process.env")()',
        '${7*7}', // Template literal injection
        '#{7*7}', // Ruby-style injection
        '{{7*7}}', // Handlebars-style injection
      ];

      for (const injection of injectionAttempts) {
        dto.name = injection;
        dto.description = injection;

        expect(() => {
          const result = dto.toString();
          const logResult = dto.toLogSafeString();

          // Results should not contain executed injection
          expect(result).not.toContain('49'); // 7*7 result
          expect(logResult).not.toContain('49');
          expect(result).not.toContain('process.env');
          expect(logResult).not.toContain('process.env');
        }).not.toThrow();

        // Reset
        dto = new UpdateProjectDto();
      }
    });
  });

  // ============================================================================
  // TESTS DE VALIDATION SÉCURISÉE
  // ============================================================================

  describe('secure validation', () => {
    it('should validate securely with mixed attack vectors', async () => {
      dto.name = '<script>alert("xss")</script>';
      dto.description = '"; DROP TABLE users; --';

      const errors = await validate(dto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'name')).toBe(true);
      expect(errors.some((e) => e.property === 'description')).toBe(true);
    });

    it('should maintain security under concurrent updates', async () => {
      const promises = Array(50)
        .fill(null)
        .map(async (_, i) => {
          const testDto = new UpdateProjectDto();
          testDto.name = `<script>alert(${i})</script>`;
          testDto.description = `'OR 1=1--${i}`;
          return validate(testDto);
        });

      const results = await Promise.all(promises);

      expect(results).toHaveLength(50);
      results.forEach((errors, i) => {
        expect(errors.some((e) => e.property === 'name')).toBe(true);
        // Description might be valid as it doesn't trigger HTML validation
      });
    });

    it('should handle edge cases in security validation', async () => {
      const securityEdgeCases = [
        // Mixed case attempts
        { name: '<ScRiPt>alert("mixed")</ScRiPt>' },
        // Encoded attempts
        { name: '&lt;script&gt;alert("encoded")&lt;/script&gt;' },
        // Unicode attempts
        { name: '<scr\u0069pt>alert("unicode")</script>' },
        // Nested attempts
        { name: '<<script>script>alert("nested")</script>' },
        // Protocol with data
        { name: 'javascript:alert("data")' },
        // Data URL
        { name: 'data:text/html,<script>alert("data")</script>' },
      ];

      for (const testCase of securityEdgeCases) {
        dto = new UpdateProjectDto();
        if (testCase.name) dto.name = testCase.name;

        const errors = await validate(dto);
        expect(errors.length).toBeGreaterThan(0);
        expect(errors.some((e) => e.property === 'name')).toBe(true);
      }
    });

    it('should prevent security bypass through field manipulation', async () => {
      dto.name = 'Safe Name';
      dto.description = 'Safe Description';

      // Attempt to bypass validation by modifying validators
      (dto as any).name = '<script>alert("bypass")</script>';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'name')).toBe(true);
    });
  });
});
