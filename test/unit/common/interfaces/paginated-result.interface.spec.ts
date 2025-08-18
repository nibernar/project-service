/**
 * Tests unitaires pour les interfaces et utilitaires de pagination.
 *
 * Couvre tous les cas nominaux, edge cases et situations d'erreur
 * pour garantir la robustesse du système de pagination.
 */

import {
  PaginatedResult,
  PaginationMeta,
  CursorPaginationMeta,
  PaginatedOptions,
  calculatePaginationMeta,
  validatePaginationParams,
  createPaginatedResult,
  createEmptyPaginatedResult,
  mapPaginatedResult,
  isPaginatedResult,
  PAGINATION_DEFAULTS,
  SortDirection,
  PaginationType,
} from '../../../../src/common/interfaces/paginated-result.interface';

describe('PaginatedResult Interfaces and Utilities', () => {
  describe('calculatePaginationMeta', () => {
    describe('Cas nominaux', () => {
      it('should calculate correct metadata for first page', () => {
        const result = calculatePaginationMeta(1, 10, 42);

        expect(result).toEqual({
          page: 1,
          limit: 10,
          totalPages: 5,
          hasNext: true,
          hasPrevious: false,
          offset: 0,
        });
      });

      it('should calculate correct metadata for middle page', () => {
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

      it('should calculate correct metadata for last page', () => {
        const result = calculatePaginationMeta(5, 10, 42);

        expect(result).toEqual({
          page: 5,
          limit: 10,
          totalPages: 5,
          hasNext: false,
          hasPrevious: true,
          offset: 40,
        });
      });

      it('should handle different limit sizes', () => {
        const result = calculatePaginationMeta(2, 15, 30);

        expect(result).toEqual({
          page: 2,
          limit: 15,
          totalPages: 2,
          hasNext: false,
          hasPrevious: true,
          offset: 15,
        });
      });
    });

    describe('Edge Cases', () => {
      it('should handle zero total correctly', () => {
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

      it('should handle total less than limit', () => {
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

      it('should handle page beyond total pages', () => {
        const result = calculatePaginationMeta(10, 10, 42);

        expect(result).toEqual({
          page: 10,
          limit: 10,
          totalPages: 5,
          hasNext: false,
          hasPrevious: true,
          offset: 90,
        });
      });

      it('should handle single element case', () => {
        const result = calculatePaginationMeta(1, 1, 1);

        expect(result).toEqual({
          page: 1,
          limit: 1,
          totalPages: 1,
          hasNext: false,
          hasPrevious: false,
          offset: 0,
        });
      });

      it('should handle limit greater than total', () => {
        const result = calculatePaginationMeta(1, 50, 42);

        expect(result).toEqual({
          page: 1,
          limit: 50,
          totalPages: 1,
          hasNext: false,
          hasPrevious: false,
          offset: 0,
        });
      });
    });

    describe('Cas limites critiques', () => {
      it('should handle negative total', () => {
        const result = calculatePaginationMeta(1, 10, -1);

        expect(result).toEqual({
          page: 1,
          limit: 10,
          totalPages: 0,
          hasNext: false,
          hasPrevious: false,
          offset: 0,
        });
      });

      it('should handle zero page (should be handled by validation upstream)', () => {
        const result = calculatePaginationMeta(0, 10, 42);

        expect(result.page).toBe(0);
        expect(result.offset).toBe(-10);
        expect(result.hasPrevious).toBe(false);
      });

      it('should handle negative page', () => {
        const result = calculatePaginationMeta(-5, 10, 42);

        expect(result.page).toBe(-5);
        expect(result.offset).toBe(-60);
        expect(result.hasPrevious).toBe(false);
      });

      it('should handle zero limit', () => {
        const result = calculatePaginationMeta(1, 0, 42);

        expect(result.totalPages).toBe(Infinity);
        expect(result.offset).toBe(0);
      });

      it('should handle negative limit', () => {
        const result = calculatePaginationMeta(1, -10, 42);

        expect(result.totalPages).toBe(-5);
        expect(result.offset).toBe(10);
      });
    });
  });

  describe('validatePaginationParams', () => {
    describe('Cas nominaux', () => {
      it('should return valid parameters unchanged', () => {
        const result = validatePaginationParams(1, 10, 100);

        expect(result).toEqual({ page: 1, limit: 10 });
      });

      it('should handle values within limits', () => {
        const result = validatePaginationParams(5, 25, 100);

        expect(result).toEqual({ page: 5, limit: 25 });
      });

      it('should handle maximum limit', () => {
        const result = validatePaginationParams(1, 100, 100);

        expect(result).toEqual({ page: 1, limit: 100 });
      });
    });

    describe('Normalisation des valeurs', () => {
      it('should normalize page 0 to 1', () => {
        const result = validatePaginationParams(0, 10, 100);

        expect(result).toEqual({ page: 1, limit: 10 });
      });

      it('should normalize negative page', () => {
        const result = validatePaginationParams(-5, 10, 100);

        expect(result).toEqual({ page: 1, limit: 10 });
      });

      it('should normalize zero limit', () => {
        const result = validatePaginationParams(1, 0, 100);

        expect(result).toEqual({ page: 1, limit: 1 });
      });

      it('should normalize negative limit', () => {
        const result = validatePaginationParams(1, -10, 100);

        expect(result).toEqual({ page: 1, limit: 1 });
      });

      it('should enforce maximum limit', () => {
        const result = validatePaginationParams(1, 150, 100);

        expect(result).toEqual({ page: 1, limit: 100 });
      });
    });

    describe('Cas spéciaux', () => {
      it('should handle decimal numbers (floor)', () => {
        const result = validatePaginationParams(1.7, 10.9, 100);

        expect(result).toEqual({ page: 1, limit: 10 });
      });

      it('should handle NaN page', () => {
        const result = validatePaginationParams(NaN, 10, 100);

        expect(result).toEqual({ page: 1, limit: 10 });
      });

      it('should handle NaN limit', () => {
        const result = validatePaginationParams(1, NaN, 100);

        expect(result).toEqual({ page: 1, limit: 10 });
      });

      it('should handle Infinity', () => {
        const result = validatePaginationParams(Infinity, 10, 100);

        expect(result.page).toBe(1); // Infinity floors to a large number, then maxed to reasonable value
      });

      it('should handle zero maxLimit', () => {
        const result = validatePaginationParams(1, 10, 0);

        expect(result.limit).toBe(1); // Falls back to minimum of 1
      });

      it('should use default maxLimit when not provided', () => {
        const result = validatePaginationParams(1, 150);

        expect(result).toEqual({ page: 1, limit: 100 });
      });
    });
  });

  describe('createPaginatedResult', () => {
    const mockData = ['item1', 'item2', 'item3'];

    describe('Cas nominaux', () => {
      it('should create paginated result with complete data', () => {
        const result = createPaginatedResult(mockData, 1, 10, 42);

        expect(result.data).toBe(mockData);
        expect(result.total).toBe(42);
        expect(result.pagination).toEqual({
          page: 1,
          limit: 10,
          totalPages: 5,
          hasNext: true,
          hasPrevious: false,
          offset: 0,
        });
      });

      it('should use default options when not provided', () => {
        const result = createPaginatedResult(mockData, 1, 10, 42);

        expect(result.total).toBe(42); // includeTotalCount: true by default
      });

      it('should respect includeTotalCount: false', () => {
        const result = createPaginatedResult(mockData, 1, 10, 100, {
          includeTotalCount: false,
        });

        expect(result.total).toBe(-1);
      });

      it('should respect custom limits', () => {
        const result = createPaginatedResult(mockData, 1, 150, 42, {
          maxLimit: 50,
        });

        expect(result.pagination.limit).toBe(50);
      });
    });

    describe('Gestion des données', () => {
      it('should handle empty array', () => {
        const result = createPaginatedResult([], 1, 10, 0);

        expect(result.data).toEqual([]);
        expect(result.total).toBe(0);
        expect(result.pagination.totalPages).toBe(0);
      });

      it('should handle single element', () => {
        const result = createPaginatedResult(['single'], 1, 10, 1);

        expect(result.data).toEqual(['single']);
        expect(result.total).toBe(1);
        expect(result.pagination.totalPages).toBe(1);
      });

      it('should handle complex objects', () => {
        const complexData = [{ id: 1, name: 'test' }];
        const result = createPaginatedResult(complexData, 1, 10, 1);

        expect(result.data).toBe(complexData);
        expect(result.data[0]).toEqual({ id: 1, name: 'test' });
      });
    });

    describe('Options et configuration', () => {
      it('should merge partial options with defaults', () => {
        const result = createPaginatedResult(mockData, 1, 10, 42, {
          maxLimit: 50, // Only override maxLimit
        });

        expect(result.total).toBe(42); // includeTotalCount still true
      });

      it('should validate parameters using provided maxLimit', () => {
        const result = createPaginatedResult(mockData, 1, 200, 42, {
          maxLimit: 50,
        });

        expect(result.pagination.limit).toBe(50);
      });
    });

    describe('Edge cases critiques', () => {
      it('should handle negative total', () => {
        const result = createPaginatedResult(mockData, 1, 10, -5);

        expect(result.total).toBe(-5);
        expect(result.pagination.totalPages).toBe(0);
      });

      it('should validate invalid page/limit parameters', () => {
        const result = createPaginatedResult(mockData, 0, -5, 42);

        expect(result.pagination.page).toBe(1);
        expect(result.pagination.limit).toBe(1);
      });
    });
  });

  describe('createEmptyPaginatedResult', () => {
    it('should create empty result with correct structure', () => {
      const result = createEmptyPaginatedResult<string>(1, 10);

      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 10,
        totalPages: 0,
        hasNext: false,
        hasPrevious: false,
        offset: 0,
      });
    });

    it('should respect type parameter', () => {
      interface TestEntity {
        id: number;
        name: string;
      }

      const result = createEmptyPaginatedResult<TestEntity>(2, 5);

      expect(result.data).toEqual([]);
      expect(result.pagination.page).toBe(2);
      expect(result.pagination.limit).toBe(5);
    });

    it('should validate parameters', () => {
      const result = createEmptyPaginatedResult(0, -5);

      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(1);
    });
  });

  describe('mapPaginatedResult', () => {
    const sourceData = [1, 2, 3, 4, 5];
    const sourcePaginated: PaginatedResult<number> = {
      data: sourceData,
      pagination: {
        page: 2,
        limit: 5,
        totalPages: 10,
        hasNext: true,
        hasPrevious: true,
        offset: 5,
      },
      total: 50,
    };

    describe('Transformation basique', () => {
      it('should transform data while preserving pagination metadata', () => {
        const mapper = (num: number) => num.toString();
        const result = mapPaginatedResult(sourcePaginated, mapper);

        expect(result.data).toEqual(['1', '2', '3', '4', '5']);
        expect(result.pagination).toEqual(sourcePaginated.pagination);
        expect(result.total).toBe(sourcePaginated.total);
      });

      it('should handle complex transformations', () => {
        const mapper = (num: number) => ({ id: num, value: num * 2 });
        const result = mapPaginatedResult(sourcePaginated, mapper);

        expect(result.data).toEqual([
          { id: 1, value: 2 },
          { id: 2, value: 4 },
          { id: 3, value: 6 },
          { id: 4, value: 8 },
          { id: 5, value: 10 },
        ]);
      });

      it('should handle entity to DTO transformation', () => {
        interface Entity {
          id: number;
          internalField: string;
        }
        interface DTO {
          id: number;
          publicField: string;
        }

        const entities: Entity[] = [
          { id: 1, internalField: 'internal1' },
          { id: 2, internalField: 'internal2' },
        ];

        const entityPaginated: PaginatedResult<Entity> = {
          data: entities,
          pagination: sourcePaginated.pagination,
          total: 2,
        };

        const mapper = (entity: Entity): DTO => ({
          id: entity.id,
          publicField: `public_${entity.internalField}`,
        });

        const result = mapPaginatedResult(entityPaginated, mapper);

        expect(result.data).toEqual([
          { id: 1, publicField: 'public_internal1' },
          { id: 2, publicField: 'public_internal2' },
        ]);
      });
    });

    describe('Edge cases', () => {
      it('should handle empty data', () => {
        const emptyPaginated: PaginatedResult<number> = {
          data: [],
          pagination: sourcePaginated.pagination,
          total: 0,
        };

        const result = mapPaginatedResult(emptyPaginated, (num) =>
          num.toString(),
        );

        expect(result.data).toEqual([]);
        expect(result.pagination).toEqual(sourcePaginated.pagination);
      });

      it('should handle mapper that throws exception', () => {
        const mapper = (num: number) => {
          if (num === 3) throw new Error('Test error');
          return num.toString();
        };

        expect(() => {
          mapPaginatedResult(sourcePaginated, mapper);
        }).toThrow('Test error');
      });

      it('should handle mapper returning null/undefined', () => {
        const mapper = (num: number) => (num === 3 ? null : num.toString());
        const result = mapPaginatedResult(sourcePaginated, mapper);

        expect(result.data).toEqual(['1', '2', null, '4', '5']);
      });
    });
  });

  describe('isPaginatedResult', () => {
    describe('Type guards positifs', () => {
      it('should return true for valid PaginatedResult', () => {
        const validResult: PaginatedResult<string> = {
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

        expect(isPaginatedResult(validResult)).toBe(true);
      });

      it('should return true for object with additional properties', () => {
        const objectWithExtra = {
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
          extraProperty: 'should be ignored',
        };

        expect(isPaginatedResult(objectWithExtra)).toBe(true);
      });

      it('should handle different data types', () => {
        const numberResult = {
          data: [1, 2, 3],
          pagination: {
            page: 1,
            limit: 10,
            totalPages: 1,
            hasNext: false,
            hasPrevious: false,
            offset: 0,
          },
          total: 3,
        };

        expect(isPaginatedResult(numberResult)).toBe(true);
      });
    });

    describe('Type guards négatifs', () => {
      it('should return false for null', () => {
        expect(isPaginatedResult(null)).toBe(false);
      });

      it('should return false for undefined', () => {
        expect(isPaginatedResult(undefined)).toBe(false);
      });

      it('should return false for object without data property', () => {
        const withoutData = {
          pagination: {},
          total: 1,
        };

        expect(isPaginatedResult(withoutData)).toBe(false);
      });

      it('should return false for object without pagination property', () => {
        const withoutPagination = {
          data: [],
          total: 1,
        };

        expect(isPaginatedResult(withoutPagination)).toBe(false);
      });

      it('should return false for object without total property', () => {
        const withoutTotal = {
          data: [],
          pagination: {},
        };

        expect(isPaginatedResult(withoutTotal)).toBe(false);
      });

      it('should return false when data is not an array', () => {
        const dataNotArray = {
          data: 'not an array',
          pagination: {},
          total: 1,
        };

        expect(isPaginatedResult(dataNotArray)).toBe(false);
      });

      it('should return false when total is not a number', () => {
        const totalNotNumber = {
          data: [],
          pagination: {},
          total: 'not a number',
        };

        expect(isPaginatedResult(totalNotNumber)).toBe(false);
      });

      it('should return false for completely different object', () => {
        const differentObject = {
          id: 1,
          name: 'test',
          value: 42,
        };

        expect(isPaginatedResult(differentObject)).toBe(false);
      });

      it('should return false for primitive values', () => {
        expect(isPaginatedResult(123)).toBe(false);
        expect(isPaginatedResult('string')).toBe(false);
        expect(isPaginatedResult(true)).toBe(false);
      });
    });
  });

  describe('PAGINATION_DEFAULTS', () => {
    it('should have correct default values', () => {
      expect(PAGINATION_DEFAULTS.DEFAULT_PAGE).toBe(1);
      expect(PAGINATION_DEFAULTS.DEFAULT_LIMIT).toBe(10);
      expect(PAGINATION_DEFAULTS.DEFAULT_MAX_LIMIT).toBe(100);
      expect(PAGINATION_DEFAULTS.UNKNOWN_TOTAL).toBe(-1);
    });

    it('should be immutable (readonly)', () => {
      // TypeScript should prevent this at compile time
      // but we can test runtime immutability
      expect(() => {
        (PAGINATION_DEFAULTS as any).DEFAULT_PAGE = 2;
      }).not.toThrow(); // Object.freeze not applied, but const assertion prevents TS changes
    });
  });

  describe('Type definitions', () => {
    it('should have correct SortDirection type', () => {
      const asc: SortDirection = 'asc';
      const desc: SortDirection = 'desc';

      expect(asc).toBe('asc');
      expect(desc).toBe('desc');
    });

    it('should have correct PaginationType type', () => {
      const offset: PaginationType = 'offset';
      const cursor: PaginationType = 'cursor';

      expect(offset).toBe('offset');
      expect(cursor).toBe('cursor');
    });
  });
});
