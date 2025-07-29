/**
 * Tests de régression pour les interfaces de pagination.
 * 
 * Ces tests garantissent que les modifications futures ne cassent pas
 * les comportements établis et documentés de l'API de pagination.
 */

import {
  PaginatedResult,
  PaginationMeta,
  calculatePaginationMeta,
  validatePaginationParams,
  createPaginatedResult,
  createEmptyPaginatedResult,
  mapPaginatedResult,
  isPaginatedResult,
  PAGINATION_DEFAULTS,
} from '../../../../src/common/interfaces/paginated-result.interface';

describe('Pagination Regression Tests', () => {
  describe('API Stability - Version 1.0.0 Baseline', () => {
    /**
     * Ces tests documentent le comportement exact de la v1.0.0
     * Toute modification qui fait échouer ces tests est un breaking change
     */

    describe('calculatePaginationMeta - Baseline Behavior', () => {
      it('should maintain exact calculations for documented examples', () => {
        // Cas documenté dans la v1.0.0
        const result = calculatePaginationMeta(3, 10, 42);
        
        expect(result).toEqual({
          page: 3,
          limit: 10,
          totalPages: 5,
          hasNext: true,
          hasPrevious: true,
          offset: 20,
        });
      });

      it('should preserve edge case behavior for zero total', () => {
        // Comportement établi pour total = 0
        const result = calculatePaginationMeta(1, 10, 0);
        
        expect(result).toEqual({
          page: 1,
          limit: 10,
          totalPages: 0,
          hasNext: false,
          hasPrevious: false,
          offset: 0,
        });
      });

      it('should maintain behavior for single page scenarios', () => {
        // Comportement pour un seul élément
        const result = calculatePaginationMeta(1, 10, 5);
        
        expect(result).toEqual({
          page: 1,
          limit: 10,
          totalPages: 1,
          hasNext: false,
          hasPrevious: false,
          offset: 0,
        });
      });

      it('should preserve calculation precision for edge cases', () => {
        // Test de précision pour des calculs de division
        const testCases = [
          { page: 1, limit: 3, total: 10, expectedPages: 4 },
          { page: 1, limit: 7, total: 20, expectedPages: 3 },
          { page: 1, limit: 4, total: 15, expectedPages: 4 },
        ];

        testCases.forEach(({ page, limit, total, expectedPages }) => {
          const result = calculatePaginationMeta(page, limit, total);
          expect(result.totalPages).toBe(expectedPages);
        });
      });
    });

    describe('validatePaginationParams - Baseline Normalization', () => {
      it('should maintain exact normalization rules', () => {
        const testCases = [
          { input: [0, 10, 100], expected: { page: 1, limit: 10 } },
          { input: [-5, 10, 100], expected: { page: 1, limit: 10 } },
          { input: [1, 0, 100], expected: { page: 1, limit: 1 } },
          { input: [1, -10, 100], expected: { page: 1, limit: 1 } },
          { input: [1, 150, 100], expected: { page: 1, limit: 100 } },
          { input: [1.7, 10.9, 100], expected: { page: 1, limit: 10 } },
        ];

        testCases.forEach(({ input, expected }) => {
          const result = validatePaginationParams(input[0], input[1], input[2]);
          expect(result).toEqual(expected);
        });
      });

      it('should preserve default maxLimit behavior', () => {
        // Comportement par défaut de maxLimit = 100
        const result = validatePaginationParams(1, 150);
        expect(result.limit).toBe(100);
      });

      it('should handle special numeric values consistently', () => {
        const specialCases = [
          { input: [NaN, 10, 100], expectedPage: 1 },
          { input: [1, NaN, 100], expectedLimit: 10 },
          { input: [Infinity, 10, 100], expectedPage: 1 },
          { input: [1, Infinity, 100], expectedLimit: 100 },
        ];

        specialCases.forEach(({ input, expectedPage, expectedLimit }) => {
          const result = validatePaginationParams(input[0], input[1], input[2]);
          if (expectedPage) expect(result.page).toBe(expectedPage);
          if (expectedLimit) expect(result.limit).toBe(expectedLimit);
        });
      });
    });

    describe('createPaginatedResult - Structure Stability', () => {
      it('should maintain exact result structure', () => {
        const data = ['item1', 'item2'];
        const result = createPaginatedResult(data, 1, 10, 20);

        // Structure exacte requise
        expect(result).toHaveProperty('data');
        expect(result).toHaveProperty('pagination');
        expect(result).toHaveProperty('total');
        
        expect(result.data).toBe(data); // Référence directe
        expect(result.total).toBe(20);
        
        // Structure de pagination exacte
        expect(result.pagination).toHaveProperty('page');
        expect(result.pagination).toHaveProperty('limit');
        expect(result.pagination).toHaveProperty('totalPages');
        expect(result.pagination).toHaveProperty('hasNext');
        expect(result.pagination).toHaveProperty('hasPrevious');
        expect(result.pagination).toHaveProperty('offset');
      });

      it('should preserve options handling behavior', () => {
        const data = ['test'];
        
        // Comportement avec includeTotalCount: false
        const resultWithoutTotal = createPaginatedResult(data, 1, 10, 100, {
          includeTotalCount: false,
        });
        expect(resultWithoutTotal.total).toBe(-1);

        // Comportement avec maxLimit
        const resultWithLimit = createPaginatedResult(data, 1, 200, 100, {
          maxLimit: 50,
        });
        expect(resultWithLimit.pagination.limit).toBe(50);
      });
    });

    describe('isPaginatedResult - Type Guard Stability', () => {
      it('should maintain exact validation logic', () => {
        // Valid cases that must always pass
        const validCases = [
          {
            data: [],
            pagination: { page: 1, limit: 10, totalPages: 0, hasNext: false, hasPrevious: false, offset: 0 },
            total: 0,
          },
          {
            data: ['test'],
            pagination: { page: 1, limit: 10, totalPages: 1, hasNext: false, hasPrevious: false, offset: 0 },
            total: 1,
            extra: 'should be ignored',
          },
        ];

        validCases.forEach(testCase => {
          expect(isPaginatedResult(testCase)).toBe(true);
        });

        // Invalid cases that must always fail
        const invalidCases = [
          null,
          undefined,
          {},
          { data: [] },
          { data: [], pagination: {} },
          { data: 'not array', pagination: {}, total: 0 },
          { data: [], pagination: {}, total: 'not number' },
        ];

        invalidCases.forEach(testCase => {
          expect(isPaginatedResult(testCase)).toBe(false);
        });
      });
    });

    describe('Constants Stability', () => {
      it('should preserve PAGINATION_DEFAULTS values', () => {
        // Ces valeurs ne doivent jamais changer sans version majeure
        expect(PAGINATION_DEFAULTS.DEFAULT_PAGE).toBe(1);
        expect(PAGINATION_DEFAULTS.DEFAULT_LIMIT).toBe(10);
        expect(PAGINATION_DEFAULTS.DEFAULT_MAX_LIMIT).toBe(100);
        expect(PAGINATION_DEFAULTS.UNKNOWN_TOTAL).toBe(-1);
      });
    });
  });

  describe('Backward Compatibility', () => {
    /**
     * Tests pour s'assurer que les changements futurs restent rétrocompatibles
     */

    describe('Interface Extensions', () => {
      it('should accept additional properties in options without breaking', () => {
        const data = ['test'];
        const extendedOptions = {
          includeTotalCount: true,
          maxLimit: 100,
          // Nouvelles propriétés hypothétiques qui pourraient être ajoutées
          newFeature: true,
          customProperty: 'value',
        } as any;

        expect(() => {
          const result = createPaginatedResult(data, 1, 10, 1, extendedOptions);
          expect(result.data).toBe(data);
        }).not.toThrow();
      });

      it('should handle extended PaginatedResult objects gracefully', () => {
        const extendedResult = {
          data: ['test'],
          pagination: {
            page: 1,
            limit: 10,
            totalPages: 1,
            hasNext: false,
            hasPrevious: false,
            offset: 0,
            // Nouvelles propriétés hypothétiques
            cursor: 'abc123',
            timestamp: new Date(),
          },
          total: 1,
          // Métadonnées supplémentaires
          metadata: { source: 'test' },
        };

        expect(isPaginatedResult(extendedResult)).toBe(true);
      });
    });

    describe('Function Signature Compatibility', () => {
      it('should maintain compatibility with optional parameters', () => {
        // Ces appels doivent continuer à fonctionner
        expect(() => calculatePaginationMeta(1, 10, 100)).not.toThrow();
        expect(() => validatePaginationParams(1, 10)).not.toThrow();
        expect(() => createPaginatedResult([], 1, 10, 0)).not.toThrow();
        expect(() => createEmptyPaginatedResult(1, 10)).not.toThrow();
      });

      it('should support method chaining patterns', () => {
        const data = [1, 2, 3];
        const result = createPaginatedResult(data, 1, 10, 3);
        
        // Pattern de chaînage qui doit rester supporté
        expect(() => {
          const mapped = mapPaginatedResult(result, x => x * 2);
          const valid = isPaginatedResult(mapped);
          expect(valid).toBe(true);
        }).not.toThrow();
      });
    });
  });

  describe('Performance Regression', () => {
    /**
     * Tests pour détecter les régressions de performance
     */

    describe('Execution Time Baselines', () => {
      it('should maintain calculation performance baseline', () => {
        const iterations = 10000;
        const start = performance.now();

        for (let i = 0; i < iterations; i++) {
          calculatePaginationMeta(i % 100 + 1, 10, 1000);
        }

        const duration = performance.now() - start;
        const perOperation = duration / iterations;

        // Baseline: moins de 0.01ms par opération
        expect(perOperation).toBeLessThan(0.01);
      });

      it('should maintain validation performance baseline', () => {
        const iterations = 10000;
        const start = performance.now();

        for (let i = 0; i < iterations; i++) {
          validatePaginationParams(i % 1000, i % 100 + 1, 200);
        }

        const duration = performance.now() - start;
        const perOperation = duration / iterations;

        // Baseline: moins de 0.005ms par opération
        expect(perOperation).toBeLessThan(0.005);
      });

      it('should maintain creation performance baseline', () => {
        const data = Array.from({ length: 100 }, (_, i) => `item-${i}`);
        const iterations = 1000;
        const start = performance.now();

        for (let i = 0; i < iterations; i++) {
          createPaginatedResult(data, i % 10 + 1, 10, 100);
        }

        const duration = performance.now() - start;
        const perOperation = duration / iterations;

        // Baseline: moins de 0.1ms par opération
        expect(perOperation).toBeLessThan(0.1);
      });
    });

    describe('Memory Usage Baseline', () => {
    });
  });

  describe('Error Handling Regression', () => {
    /**
     * Tests pour s'assurer que la gestion d'erreur reste cohérente
     */

    describe('Exception Consistency', () => {
      it('should maintain consistent error behavior for invalid inputs', () => {
        // Ces comportements d'erreur doivent rester identiques
        expect(() => calculatePaginationMeta(1, 0, 100)).not.toThrow();
        expect(() => validatePaginationParams(NaN, NaN, 100)).not.toThrow();
        
        // mapPaginatedResult doit laisser les erreurs du mapper remonter
        const data = [1, 2, 3];
        const result = createPaginatedResult(data, 1, 10, 3);
        
        expect(() => {
          mapPaginatedResult(result, (x) => {
            if (x === 2) throw new Error('Test error');
            return x;
          });
        }).toThrow('Test error');
      });

      it('should handle malformed objects consistently', () => {
        const malformedObjects = [
          { data: null, pagination: {}, total: 1 },
          { data: [], pagination: null, total: 1 },
          { data: [], pagination: {}, total: null },
        ];

        malformedObjects.forEach(obj => {
          expect(isPaginatedResult(obj)).toBe(false);
        });
      });
    });
  });

  describe('Integration Points Stability', () => {
    /**
     * Tests pour les points d'intégration avec d'autres systèmes
     */

    describe('Serialization Compatibility', () => {
      it('should maintain JSON serialization compatibility', () => {
        const result = createPaginatedResult(['test'], 1, 10, 1);
        
        // Doit pouvoir être sérialisé et désérialisé sans perte
        const serialized = JSON.stringify(result);
        const deserialized = JSON.parse(serialized);
        
        expect(isPaginatedResult(deserialized)).toBe(true);
        expect(deserialized.data).toEqual(['test']);
        expect(deserialized.pagination.page).toBe(1);
        expect(deserialized.total).toBe(1);
      });

      it('should handle date serialization in data', () => {
        const dataWithDates = [
          { id: 1, createdAt: new Date('2023-01-01') },
          { id: 2, createdAt: new Date('2023-01-02') },
        ];
        
        const result = createPaginatedResult(dataWithDates, 1, 10, 2);
        
        // La sérialisation ne doit pas altérer la structure de base
        const serialized = JSON.stringify(result);
        const deserialized = JSON.parse(serialized);
        
        expect(deserialized.data).toHaveLength(2);
        expect(deserialized.data[0].id).toBe(1);
        expect(typeof deserialized.data[0].createdAt).toBe('string'); // Date devient string
      });
    });

    describe('TypeScript Compatibility', () => {
      it('should maintain generic type inference', () => {
        interface TestItem {
          id: number;
          name: string;
        }
        
        const items: TestItem[] = [
          { id: 1, name: 'test1' },
          { id: 2, name: 'test2' },
        ];
        
        const result = createPaginatedResult(items, 1, 10, 2);
        
        // TypeScript doit inférer correctement le type
        expect(result.data[0].id).toBe(1);
        expect(result.data[0].name).toBe('test1');
        
        // mapPaginatedResult doit préserver les types
        const mapped = mapPaginatedResult(result, item => ({
          ...item,
          displayName: item.name.toUpperCase(),
        }));
        
        expect(mapped.data[0].displayName).toBe('TEST1');
      });
    });
  });

  describe('Documentation Examples Validation', () => {
    /**
     * Tests basés sur les exemples de la documentation
     * Ces tests échouent si la documentation devient obsolète
     */

    describe('README Examples', () => {
      it('should validate basic usage example from documentation', () => {
        // Exemple de base de la documentation
        const projects = [
          { id: 1, name: 'Project 1' },
          { id: 2, name: 'Project 2' },
        ];
        
        const result = createPaginatedResult(projects, 1, 10, 42);
        
        expect(result.data).toBe(projects);
        expect(result.total).toBe(42);
        expect(result.pagination.page).toBe(1);
        expect(result.pagination.limit).toBe(10);
        expect(result.pagination.totalPages).toBe(5);
      });

      it('should validate advanced usage example from documentation', () => {
        // Exemple avancé avec options
        const data = ['item1', 'item2'];
        const result = createPaginatedResult(data, 1, 10, -1, {
          includeTotalCount: false,
        });
        
        expect(result.total).toBe(-1);
        expect(result.data).toBe(data);
      });

      it('should validate transformation example from documentation', () => {
        interface Entity { id: number; internal: string; }
        interface DTO { id: number; public: string; }
        
        const entities: Entity[] = [
          { id: 1, internal: 'internal1' },
          { id: 2, internal: 'internal2' },
        ];
        
        const entityResult = createPaginatedResult(entities, 1, 10, 2);
        const dtoResult = mapPaginatedResult(entityResult, (entity): DTO => ({
          id: entity.id,
          public: `public_${entity.internal}`,
        }));
        
        expect(dtoResult.data[0].public).toBe('public_internal1');
        expect(dtoResult.pagination).toEqual(entityResult.pagination);
      });
    });
  });

  describe('Version Compatibility Matrix', () => {
    /**
     * Tests de compatibilité entre versions
     */

    describe('v1.0.0 Compatibility', () => {
      it('should maintain compatibility with v1.0.0 data structures', () => {
        // Structure de données v1.0.0
        const v1Result = {
          data: ['test'],
          pagination: {
            page: 1,
            limit: 10,
            totalPages: 1,
            hasNext: false,
            hasPrevious: false,
            offset: 0,
          },
          total: 1,
        };
        
        expect(isPaginatedResult(v1Result)).toBe(true);
        
        // Doit pouvoir être traité par les nouvelles fonctions
        const mapped = mapPaginatedResult(v1Result, x => x.toUpperCase());
        expect(mapped.data[0]).toBe('TEST');
      });
    });
  });

  describe('Future-Proofing Tests', () => {
    /**
     * Tests qui documentent les extensions prévues
     */

    describe('Cursor Pagination Preparation', () => {
      it('should handle cursor-like properties without breaking', () => {
        const resultWithCursor = {
          data: ['test'],
          pagination: {
            page: 1,
            limit: 10,
            totalPages: 1,
            hasNext: false,
            hasPrevious: false,
            offset: 0,
            // Propriétés futures pour la pagination cursor
            cursor: 'opaque-cursor-123',
            nextCursor: null,
            previousCursor: null,
          },
          total: 1,
        };
        
        // Doit rester compatible
        expect(isPaginatedResult(resultWithCursor)).toBe(true);
      });
    });

    describe('Metadata Extensions', () => {
      it('should handle additional metadata without breaking', () => {
        const resultWithMetadata = {
          data: ['test'],
          pagination: {
            page: 1,
            limit: 10,
            totalPages: 1,
            hasNext: false,
            hasPrevious: false,
            offset: 0,
          },
          total: 1,
          // Métadonnées futures potentielles
          metadata: {
            source: 'database',
            cached: true,
            generatedAt: new Date(),
          },
        };
        
        expect(isPaginatedResult(resultWithMetadata)).toBe(true);
      });
    });
  });
});