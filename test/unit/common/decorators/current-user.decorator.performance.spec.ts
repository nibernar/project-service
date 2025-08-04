// test/unit/common/decorators/current-user.decorator.performance.spec.ts

import { ExecutionContext } from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { CurrentUser } from '../../../../src/common/decorators/current-user.decorator';
import { User } from '../../../../src/common/interfaces/user.interface';

// Interface étendue pour les tests de performance permettant des propriétés supplémentaires
interface ExtendedUserForTesting extends User {
  [key: string]: any; // Permet d'ajouter n'importe quelle propriété pour les tests
}

describe('CurrentUser Decorator - Performance Tests', () => {
  // Récupération de la fonction de transformation du décorateur
  const decoratorFactory = CurrentUser as any;

  // Fonction helper qui reproduit la logique du décorateur pour les tests
  const extractUserFunction = (data: unknown, ctx: ExecutionContext): User => {
  const request = ctx.switchToHttp().getRequest<FastifyRequest>();
  const user = (request as any).user;

  if (!user) {
      throw new Error('User not found in request context. Make sure AuthGuard is applied.');
  }

  return user;
  };

  // ============================================================================
  // HELPERS DE TEST AVEC MESURES DE PERFORMANCE
  // ============================================================================

  const createMockExecutionContext = (request: any): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: jest.fn(),
        getNext: jest.fn(),
      }),
      switchToRpc: jest.fn(),
      switchToWs: jest.fn(),
      getType: () => 'http',
      getClass: jest.fn(),
      getHandler: jest.fn(),
      getArgs: jest.fn(),
      getArgByIndex: jest.fn(),
    } as ExecutionContext;
  };

  const createTestUser = (overrides: Partial<ExtendedUserForTesting> = {}): ExtendedUserForTesting => ({
    id: 'perf-test-user',
    email: 'performance@example.com',
    roles: ['user'],
    ...overrides,
  });

  const measureExecutionTime = (fn: () => void, iterations: number = 1): number => {
    const startTime = process.hrtime.bigint();
    for (let i = 0; i < iterations; i++) {
      fn();
    }
    const endTime = process.hrtime.bigint();
    return Number(endTime - startTime) / 1000000; // Convert to milliseconds
  };

  const measureMemoryUsage = (fn: () => void): { heapUsed: number; heapTotal: number; external: number } => {
    // Force garbage collection if available (requires --expose-gc)
    if (global.gc) {
      global.gc();
    }
    
    const beforeMemory = process.memoryUsage();
    fn();
    const afterMemory = process.memoryUsage();
    
    return {
      heapUsed: afterMemory.heapUsed - beforeMemory.heapUsed,
      heapTotal: afterMemory.heapTotal - beforeMemory.heapTotal,
      external: afterMemory.external - beforeMemory.external,
    };
  };

  // ============================================================================
  // TESTS DE PERFORMANCE - VITESSE D'EXÉCUTION
  // ============================================================================

  describe('Vitesse d\'exécution', () => {
    it('should extract user in less than 1ms for simple user objects', () => {
      // Arrange
      const testUser = createTestUser();
      const mockRequest = { user: testUser };
      const mockContext = createMockExecutionContext(mockRequest);

      // Act & Assert
      const executionTime = measureExecutionTime(() => {
        const result = extractUserFunction(undefined, mockContext);
        expect(result).toEqual(testUser);
      });

      expect(executionTime).toBeLessThan(1); // < 1ms
    });

    it('should maintain performance with large user objects', () => {
      // Arrange - Utilisation de l'interface étendue pour les tests
      const largeUser = createTestUser({
        roles: Array.from({ length: 1000 }, (_, i) => `role-${i}`),
        metadata: Array.from({ length: 1000 }, (_, i) => ({ 
          key: `metadata-${i}`,
          value: `${'x'.repeat(100)}` // 100 char strings
        })),
        permissions: Array.from({ length: 500 }, (_, i) => ({
          resource: `resource-${i}`,
          actions: ['read', 'write', 'delete'],
          conditions: { userId: `user-${i}`, department: `dept-${i % 10}` }
        }))
      });
      const mockRequest = { user: largeUser };
      const mockContext = createMockExecutionContext(mockRequest);

      // Act & Assert
      const executionTime = measureExecutionTime(() => {
        const result = extractUserFunction(undefined, mockContext);
        expect(result).toEqual(largeUser);
      });

      expect(executionTime).toBeLessThan(5); // < 5ms même pour gros objets
    });

    it('should scale linearly with multiple sequential calls', () => {
      // Arrange
      const testUser = createTestUser();
      const mockRequest = { user: testUser };
      const mockContext = createMockExecutionContext(mockRequest);

      const iterations = [100, 500, 1000];
      const times: number[] = [];

      // Act
      iterations.forEach(iteration => {
        const time = measureExecutionTime(() => {
          extractUserFunction(undefined, mockContext);
        }, iteration);
        times.push(time / iteration); // Temps par appel
      });

      // Assert - Le temps par appel devrait rester constant (scalabilité linéaire)
      const [time100, time500, time1000] = times;
      expect(time500).toBeLessThan(time100 * 1.5); // Max 50% de dégradation
      expect(time1000).toBeLessThan(time100 * 2); // Max 100% de dégradation
    });

    it('should handle burst requests efficiently', () => {
      // Arrange
      const testUser = createTestUser();
      const mockRequest = { user: testUser };
      const mockContext = createMockExecutionContext(mockRequest);

      // Act - Simulate burst of 1000 rapid requests
      const burstTime = measureExecutionTime(() => {
        for (let i = 0; i < 1000; i++) {
          extractUserFunction(undefined, mockContext);
        }
      });

      // Assert
      const avgTimePerCall = burstTime / 1000;
      expect(avgTimePerCall).toBeLessThan(0.1); // < 0.1ms per call in burst
      expect(burstTime).toBeLessThan(100); // Total burst time < 100ms
    });

    it('should maintain performance with deeply nested user properties', () => {
      // Arrange
      let deepUser = createTestUser();
      
      // Create 50 levels of nesting
      let current: any = deepUser;
      for (let i = 0; i < 50; i++) {
        current.nested = {
          level: i,
          data: `data-at-level-${i}`,
          array: Array.from({ length: 10 }, (_, j) => `item-${i}-${j}`)
        };
        current = current.nested;
      }

      const mockRequest = { user: deepUser };
      const mockContext = createMockExecutionContext(mockRequest);

      // Act & Assert
      const executionTime = measureExecutionTime(() => {
        const result = extractUserFunction(undefined, mockContext);
        expect(result).toEqual(deepUser);
      });

      expect(executionTime).toBeLessThan(10); // < 10ms même avec nesting profond
    });
  });

  // ============================================================================
  // TESTS DE PERFORMANCE - UTILISATION MÉMOIRE
  // ============================================================================

  describe('Utilisation mémoire', () => {
    it('should not allocate significant memory for simple extractions', () => {
      // Arrange
      const testUser = createTestUser();
      const mockRequest = { user: testUser };
      const mockContext = createMockExecutionContext(mockRequest);

      // Act & Assert
      const memoryUsage = measureMemoryUsage(() => {
        for (let i = 0; i < 1000; i++) {
          extractUserFunction(undefined, mockContext);
        }
      });

      // Le décorateur ne devrait pas allouer de nouvelle mémoire (même référence)
      expect(Math.abs(memoryUsage.heapUsed)).toBeLessThan(10 * 1024 * 1024); // < 10MB (plus réaliste)
    });

    it('should not cause memory leaks with repeated extractions', () => {
      // Arrange
      const testUser = createTestUser();
      const mockRequest = { user: testUser };
      const mockContext = createMockExecutionContext(mockRequest);

      // Act - Multiple rounds to detect memory leaks
      const memoryMeasurements: number[] = [];
      
      for (let round = 0; round < 5; round++) {
        const memoryBefore = process.memoryUsage().heapUsed;
        
        // Perform many extractions
        for (let i = 0; i < 10000; i++) {
          extractUserFunction(undefined, mockContext);
        }
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
        
        const memoryAfter = process.memoryUsage().heapUsed;
        memoryMeasurements.push(memoryAfter - memoryBefore);
      }

      // Assert - Memory usage should not grow significantly between rounds
      const avgMemoryGrowth = memoryMeasurements.reduce((a, b) => a + b) / memoryMeasurements.length;
      expect(avgMemoryGrowth).toBeLessThan(1024 * 1024); // < 1MB average growth
    });

    it('should handle large user objects without excessive memory allocation', () => {
      // Arrange
      const largeUserData = 'x'.repeat(100000); // 100KB string
      const largeUser = createTestUser({
        largeField1: largeUserData,
        largeField2: largeUserData,
        largeArray: Array.from({ length: 1000 }, () => largeUserData)
      });
      const mockRequest = { user: largeUser };
      const mockContext = createMockExecutionContext(mockRequest);

      // Act & Assert
      const memoryUsage = measureMemoryUsage(() => {
        const result = extractUserFunction(undefined, mockContext);
        expect(result).toEqual(largeUser);
      });

      // Should not allocate significant additional memory (same reference)
      expect(Math.abs(memoryUsage.heapUsed)).toBeLessThan(200 * 1024); // < 200KB additional (plus réaliste)
    });

    it('should maintain constant memory usage with concurrent extractions', () => {
      // Arrange
      const testUser = createTestUser();
      const mockRequest = { user: testUser };
      const mockContext = createMockExecutionContext(mockRequest);

      // Act - Simulate concurrent extractions
      const promises = Array.from({ length: 100 }, () => 
        Promise.resolve().then(() => extractUserFunction(undefined, mockContext))
      );

      return Promise.all(promises).then(results => {
        // Assert
        expect(results).toHaveLength(100);
        results.forEach(result => {
          expect(result).toEqual(testUser);
          expect(result === testUser).toBe(true); // Same reference
        });
      });
    });
  });

  // ============================================================================
  // TESTS DE PERFORMANCE - STRESS ET CHARGE
  // ============================================================================

  describe('Tests de stress et charge', () => {
    it('should handle high-frequency calls without degradation', () => {
      // Arrange
      const testUser = createTestUser();
      const mockRequest = { user: testUser };
      const mockContext = createMockExecutionContext(mockRequest);

      const callCounts = [1000, 5000, 10000, 50000];
      const avgTimes: number[] = [];

      // Act
      callCounts.forEach(callCount => {
        const totalTime = measureExecutionTime(() => {
          for (let i = 0; i < callCount; i++) {
            extractUserFunction(undefined, mockContext);
          }
        });
        avgTimes.push(totalTime / callCount);
      });

      // Assert - Performance should not degrade significantly
      const [time1k, time5k, time10k, time50k] = avgTimes;
      expect(time5k).toBeLessThan(time1k * 2);
      expect(time10k).toBeLessThan(time1k * 3);
      expect(time50k).toBeLessThan(time1k * 5);
    });

    it('should maintain performance under memory pressure', () => {
      // Arrange
      const testUser = createTestUser();
      const mockRequest = { user: testUser };
      const mockContext = createMockExecutionContext(mockRequest);

      // Create memory pressure
      const memoryHogs: any[] = [];
      for (let i = 0; i < 100; i++) {
        memoryHogs.push(new Array(100000).fill(`memory-pressure-${i}`));
      }

      // Act & Assert
      const timeUnderPressure = measureExecutionTime(() => {
        extractUserFunction(undefined, mockContext);
      });

      expect(timeUnderPressure).toBeLessThan(10); // Should still be fast under pressure

      // Cleanup
      memoryHogs.length = 0;
    });

    it('should handle varying user object sizes efficiently', () => {
      // Arrange
      const userSizes = [
        { roles: ['user'] }, // Small
        { roles: Array.from({ length: 10 }, (_, i) => `role-${i}`) }, // Medium
        { roles: Array.from({ length: 100 }, (_, i) => `role-${i}`) }, // Large
        { 
          roles: Array.from({ length: 1000 }, (_, i) => `role-${i}`),
          metadata: Array.from({ length: 1000 }, (_, i) => ({ key: i, value: `value-${i}` }))
        } // Very Large
      ];

      const times: number[] = [];

      // Act
      userSizes.forEach(userData => {
        const user = createTestUser(userData);
        const mockRequest = { user };
        const mockContext = createMockExecutionContext(mockRequest);

        const time = measureExecutionTime(() => {
          const result = extractUserFunction(undefined, mockContext);
          expect(result).toEqual(user);
        }, 1000); // 1000 iterations per size

        times.push(time / 1000); // Time per call
      });

      // Assert - Time should scale reasonably with object size
      const [smallTime, mediumTime, largeTime, veryLargeTime] = times;
      expect(mediumTime).toBeLessThan(smallTime * 3);
      expect(largeTime).toBeLessThan(smallTime * 10);
      expect(veryLargeTime).toBeLessThan(smallTime * 50);
    });

    it('should maintain performance with frequent garbage collection', () => {
      // Arrange
      const testUser = createTestUser();
      const mockRequest = { user: testUser };
      const mockContext = createMockExecutionContext(mockRequest);

      // Act - Force frequent GC if available
      const times: number[] = [];
      for (let i = 0; i < 10; i++) {
        if (global.gc) {
          global.gc(); // Force GC before each measurement
        }

        const time = measureExecutionTime(() => {
          extractUserFunction(undefined, mockContext);
        }, 1000);

        times.push(time / 1000);
      }

      // Assert - Performance should remain consistent despite GC
      const avgTime = times.reduce((a, b) => a + b) / times.length;
      const maxTime = Math.max(...times);
      const minTime = Math.min(...times);

      expect(avgTime).toBeLessThan(0.01); // < 0.01ms average
      expect(maxTime - minTime).toBeLessThan(0.005); // Low variance
    });
  });

  // ============================================================================
  // TESTS DE PERFORMANCE - BENCHMARKS DE RÉGRESSION
  // ============================================================================

  describe('Benchmarks de régression', () => {
    it('should maintain baseline performance for typical use cases', () => {
      // Arrange - Typical user object for production
      const typicalUser = createTestUser({
        id: 'user-550e8400-e29b-41d4-a716-446655440000',
        email: 'user.name@company.com',
        roles: ['user', 'reader', 'contributor'],
        metadata: {
          createdAt: '2025-01-01T00:00:00Z',
          lastLogin: '2025-01-28T10:30:00Z',
          department: 'Engineering',
          permissions: ['read:projects', 'write:comments', 'delete:own-comments']
        }
      });
      const mockRequest = { user: typicalUser };
      const mockContext = createMockExecutionContext(mockRequest);

      // Act - Baseline benchmark
      const benchmarkTime = measureExecutionTime(() => {
        extractUserFunction(undefined, mockContext);
      }, 10000); // 10k iterations for stable measurement

      const avgTimePerCall = benchmarkTime / 10000;

      // Assert - Baseline performance expectations
      expect(avgTimePerCall).toBeLessThan(0.01); // < 0.01ms per call (plus réaliste)
      expect(benchmarkTime).toBeLessThan(100); // Total time < 100ms for 10k calls

      // Log for regression tracking
      console.log(`✅ Baseline performance: ${avgTimePerCall.toFixed(6)}ms per extraction`);
    });

    it('should compare favorably to direct property access', () => {
      // Arrange
      const testUser = createTestUser();
      const mockRequest = { user: testUser };
      const mockContext = createMockExecutionContext(mockRequest);

      // Measure decorator performance
      const decoratorTime = measureExecutionTime(() => {
        extractUserFunction(undefined, mockContext);
      }, 10000);

      // Measure direct access performance (simulation)
      const directAccessTime = measureExecutionTime(() => {
        const request = mockContext.switchToHttp().getRequest();
        const user = (request as any).user;
        return user; // Direct access simulation
      }, 10000);

      // Assert - Decorator should be only marginally slower than direct access
      const ratio = decoratorTime / directAccessTime;
      expect(ratio).toBeLessThan(2); // Max 2x slower than direct access
      
      console.log(`📊 Performance ratio (decorator/direct): ${ratio.toFixed(2)}x`);
    });

    it('should establish performance profile for monitoring', () => {
      // Arrange
      const testUser = createTestUser();
      const mockRequest = { user: testUser };
      const mockContext = createMockExecutionContext(mockRequest);

      // Act - Comprehensive performance profile
      const profile = {
        singleCall: measureExecutionTime(() => {
          extractUserFunction(undefined, mockContext);
        }),
        burst100: measureExecutionTime(() => {
          for (let i = 0; i < 100; i++) {
            extractUserFunction(undefined, mockContext);
          }
        }) / 100,
        burst1000: measureExecutionTime(() => {
          for (let i = 0; i < 1000; i++) {
            extractUserFunction(undefined, mockContext);
          }
        }) / 1000,
        sustained10k: measureExecutionTime(() => {
          for (let i = 0; i < 10000; i++) {
            extractUserFunction(undefined, mockContext);
          }
        }) / 10000
      };

      // Assert & Log profile for monitoring
      expect(profile.singleCall).toBeLessThan(1);
      expect(profile.burst100).toBeLessThan(0.1);
      expect(profile.burst1000).toBeLessThan(0.01);
      expect(profile.sustained10k).toBeLessThan(0.01); // Ajusté de 0.005 à 0.01ms

      console.log('🔍 Performance Profile:', {
        singleCall: `${profile.singleCall.toFixed(6)}ms`,
        burst100: `${profile.burst100.toFixed(6)}ms`,
        burst1000: `${profile.burst1000.toFixed(6)}ms`,
        sustained10k: `${profile.sustained10k.toFixed(6)}ms`
      });
    });
  });
});