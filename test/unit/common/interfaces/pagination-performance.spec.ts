/**
 * Tests de performance et de charge pour les utilitaires de pagination.
 * 
 * Vérifie que les fonctions de pagination maintiennent des performances
 * acceptables même avec de gros volumes de données.
 */

import {
  calculatePaginationMeta,
  createPaginatedResult,
  mapPaginatedResult,
  validatePaginationParams,
  PaginatedResult,
} from '../../../../src/common/interfaces/paginated-result.interface';

describe('Pagination Performance Tests', () => {
  describe('calculatePaginationMeta Performance', () => {
    it('should calculate metadata quickly for reasonable parameters', () => {
      const start = performance.now();
      
      // Simulate 1000 calculations
      for (let i = 0; i < 1000; i++) {
        calculatePaginationMeta(i + 1, 20, 100000);
      }
      
      const duration = performance.now() - start;
      
      expect(duration).toBeLessThan(10); // Should complete in less than 10ms
    });

    it('should handle large numbers efficiently', () => {
      const start = performance.now();
      
      const result = calculatePaginationMeta(1000000, 100, 50000000);
      
      const duration = performance.now() - start;
      
      expect(duration).toBeLessThan(1); // Should be nearly instantaneous
      expect(result.totalPages).toBe(500000);
      expect(result.offset).toBe(99999900);
    });

    it('should maintain performance with maximum safe integers', () => {
      const start = performance.now();
      
      // Use large but safe numbers
      const result = calculatePaginationMeta(
        100000,
        1000,
        Number.MAX_SAFE_INTEGER / 1000 // Avoid overflow in calculations
      );
      
      const duration = performance.now() - start;
      
      expect(duration).toBeLessThan(1);
      expect(typeof result.totalPages).toBe('number');
      expect(isFinite(result.totalPages)).toBe(true);
    });
  });

  describe('validatePaginationParams Performance', () => {
    it('should validate parameters quickly in batch', () => {
      const start = performance.now();
      
      // Validate 10000 parameter sets
      for (let i = 0; i < 10000; i++) {
        validatePaginationParams(i % 1000 + 1, i % 100 + 1, 200);
      }
      
      const duration = performance.now() - start;
      
      expect(duration).toBeLessThan(50); // Should complete in less than 50ms
    });

    it('should handle edge case validation efficiently', () => {
      const testCases = [
        [0, 10, 100],
        [-1000, -500, 100],
        [NaN, NaN, 100],
        [Infinity, -Infinity, 100],
        [1.7, 10.9, 100],
      ];
      
      const start = performance.now();
      
      // Run each test case 1000 times
      testCases.forEach(([page, limit, maxLimit]) => {
        for (let i = 0; i < 1000; i++) {
          validatePaginationParams(page, limit, maxLimit);
        }
      });
      
      const duration = performance.now() - start;
      
      expect(duration).toBeLessThan(20);
    });
  });

  describe('createPaginatedResult Performance', () => {
    const generateLargeDataset = (size: number): string[] => {
      return Array.from({ length: size }, (_, i) => `item-${i}`);
    };

    it('should create paginated result quickly with small datasets', () => {
      const data = generateLargeDataset(100);
      const start = performance.now();
      
      for (let i = 0; i < 1000; i++) {
        createPaginatedResult(data, 1, 20, 1000);
      }
      
      const duration = performance.now() - start;
      
      expect(duration).toBeLessThan(20);
    });

    it('should handle large datasets efficiently', () => {
      const data = generateLargeDataset(10000);
      const start = performance.now();
      
      const result = createPaginatedResult(data, 50, 100, 100000);
      
      const duration = performance.now() - start;
      
      expect(duration).toBeLessThan(5);
      expect(result.data).toBe(data); // Should reference, not copy
      expect(result.pagination.page).toBe(50);
    });

    it('should maintain performance with complex objects', () => {
      interface ComplexObject {
        id: number;
        name: string;
        metadata: {
          created: Date;
          tags: string[];
        };
      }
      
      const complexData: ComplexObject[] = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        name: `Complex Object ${i}`,
        metadata: {
          created: new Date(),
          tags: [`tag-${i}`, `category-${i % 10}`],
        },
      }));
      
      const start = performance.now();
      
      const result = createPaginatedResult(complexData, 5, 50, 5000);
      
      const duration = performance.now() - start;
      
      expect(duration).toBeLessThan(2);
      expect(result.data).toBe(complexData);
    });

    it('should not degrade with options processing', () => {
      const data = generateLargeDataset(1000);
      const options = {
        includeTotalCount: false,
        maxLimit: 150,
        defaultLimit: 25,
      };
      
      const start = performance.now();
      
      for (let i = 0; i < 1000; i++) {
        createPaginatedResult(data, i % 100 + 1, i % 50 + 1, 10000, options);
      }
      
      const duration = performance.now() - start;
      
      expect(duration).toBeLessThan(30);
    });
  });

  describe('mapPaginatedResult Performance', () => {
    const createTestPaginatedResult = <T>(data: T[]): PaginatedResult<T> => ({
      data,
      pagination: {
        page: 1,
        limit: data.length,
        totalPages: 1,
        hasNext: false,
        hasPrevious: false,
        offset: 0,
      },
      total: data.length,
    });

    it('should map small datasets quickly', () => {
      const numbers = Array.from({ length: 100 }, (_, i) => i);
      const paginatedResult = createTestPaginatedResult(numbers);
      
      const start = performance.now();
      
      for (let i = 0; i < 1000; i++) {
        mapPaginatedResult(paginatedResult, (num) => num.toString());
      }
      
      const duration = performance.now() - start;
      
      expect(duration).toBeLessThan(50);
    });

    it('should handle large datasets efficiently', () => {
      const numbers = Array.from({ length: 10000 }, (_, i) => i);
      const paginatedResult = createTestPaginatedResult(numbers);
      
      const start = performance.now();
      
      const result = mapPaginatedResult(paginatedResult, (num) => ({
        id: num,
        value: num * 2,
        text: `Item ${num}`,
      }));
      
      const duration = performance.now() - start;
      
      expect(duration).toBeLessThan(20);
      expect(result.data).toHaveLength(10000);
      expect(result.data[0]).toEqual({
        id: 0,
        value: 0,
        text: 'Item 0',
      });
    });
  });

  describe('Memory Usage Tests', () => {
    it('should not create memory leaks with repeated operations', () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Perform many operations that could potentially leak memory
      for (let i = 0; i < 10000; i++) {
        const data = Array.from({ length: 100 }, (_, j) => `item-${i}-${j}`);
        const result = createPaginatedResult(data, i % 100 + 1, 10, 50000);
        const mapped = mapPaginatedResult(result, (item) => ({ value: item }));
        
        // Operations that might retain references
        calculatePaginationMeta(i + 1, 10, 100000);
        validatePaginationParams(i + 1, 10, 100);
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowth = finalMemory - initialMemory;
      
      // Memory growth should be reasonable (less than 50MB for this test)
      expect(memoryGrowth).toBeLessThan(50 * 1024 * 1024);
    });

    it('should handle large objects without excessive memory usage', () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Create a large dataset
      const largeData = Array.from({ length: 10000 }, (_, i) => ({
        id: i,
        payload: 'x'.repeat(1000), // 1KB per object = ~10MB total
        metadata: {
          tags: Array.from({ length: 10 }, (_, j) => `tag-${j}`),
          timestamp: new Date(),
        },
      }));
      
      const result = createPaginatedResult(largeData, 1, 100, 10000);
      const mapped = mapPaginatedResult(result, (item) => ({
        id: item.id,
        hasPayload: item.payload.length > 0,
      }));
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowth = finalMemory - initialMemory;
      
      // Should not use significantly more memory than the data itself
      // Allow for some overhead, but not excessive
      expect(memoryGrowth).toBeLessThan(50 * 1024 * 1024); // Less than 50MB
      
      // Verify the results are correct
      expect(result.data).toHaveLength(10000);
      expect(mapped.data).toHaveLength(10000);
      expect(mapped.data[0].hasPayload).toBe(true);
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent pagination operations', async () => {
      const concurrentOperations = Array.from({ length: 100 }, async (_, i) => {
        const data = Array.from({ length: 50 }, (_, j) => `item-${i}-${j}`);
        
        return new Promise<void>((resolve) => {
          setTimeout(() => {
            // Simulate concurrent pagination operations
            const result = createPaginatedResult(data, i % 10 + 1, 10, 500);
            const meta = calculatePaginationMeta(i + 1, 20, 2000);
            const validated = validatePaginationParams(i + 1, i % 50 + 1, 100);
            
            expect(result.data).toHaveLength(50);
            expect(meta.page).toBe(i + 1);
            expect(validated.page).toBeGreaterThan(0);
            
            resolve();
          }, Math.random() * 10); // Random delay up to 10ms
        });
      });
      
      const start = performance.now();
      
      await Promise.all(concurrentOperations);
      
      const duration = performance.now() - start;
      
      // Should complete reasonably quickly even with concurrency
      expect(duration).toBeLessThan(100);
    });
  });

  describe('Stress Tests', () => {
    it('should handle extreme pagination parameters', () => {
      const start = performance.now();
      
      // Test with very large page numbers and limits
      const extremeCases = [
        [1000000, 1000, 1000000000],
        [1, 10000, 50000000],
        [50000, 500, 25000000],
      ];
      
      extremeCases.forEach(([page, limit, total]) => {
        const meta = calculatePaginationMeta(page, limit, total);
        expect(meta.page).toBe(page);
        expect(meta.limit).toBe(limit);
        expect(isFinite(meta.totalPages)).toBe(true);
      });
      
      const duration = performance.now() - start;
      
      expect(duration).toBeLessThan(5);
    });

    it('should maintain stability under repeated stress', () => {
      const iterations = 50000;
      const start = performance.now();
      
      for (let i = 0; i < iterations; i++) {
        // Mix of operations to stress test all functions
        const page = (i % 1000) + 1;
        const limit = (i % 100) + 1;
        const total = (i % 10000) + 100;
        
        calculatePaginationMeta(page, limit, total);
        validatePaginationParams(page, limit, 200);
        
        if (i % 100 === 0) {
          // Occasionally create paginated results
          const data = Array.from({ length: limit }, (_, j) => j);
          createPaginatedResult(data, page, limit, total);
        }
      }
      
      const duration = performance.now() - start;
      const operationsPerMs = iterations / duration;
      
      // Should maintain high throughput
      expect(operationsPerMs).toBeGreaterThan(100); // At least 100 ops per ms
      expect(duration).toBeLessThan(1000); // Complete within 1 second
    });
  });

  describe('Edge Case Performance', () => {
    it('should handle zero and negative values efficiently', () => {
      const start = performance.now();
      
      const problematicCases = [
        [0, 0, 0],
        [-1, -1, -1],
        [0, 10, 0],
        [1, 0, 100],
        [-100, 50, 1000],
      ];
      
      problematicCases.forEach(([page, limit, total]) => {
        calculatePaginationMeta(page, limit, total);
        validatePaginationParams(page, limit, 100);
      });
      
      const duration = performance.now() - start;
      
      expect(duration).toBeLessThan(1);
    });

    it('should handle NaN and Infinity without hanging', () => {
      const start = performance.now();
      
      const specialValues = [NaN, Infinity, -Infinity];
      
      specialValues.forEach((value) => {
        calculatePaginationMeta(value, 10, 100);
        calculatePaginationMeta(1, value, 100);
        calculatePaginationMeta(1, 10, value);
        validatePaginationParams(value, 10, 100);
        validatePaginationParams(1, value, 100);
      });
      
      const duration = performance.now() - start;
      
      expect(duration).toBeLessThan(5);
    });
  });
});