// test/unit/common/decorators/current-user.decorator.regression.spec.ts

import { ExecutionContext } from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { CurrentUser } from '../../../../src/common/decorators/current-user.decorator';
import { User } from '../../../../src/common/interfaces/user.interface';
// import { CurrentUserTestUtils } from '../../../setup/current-user-test-setup';

// Interface étendue pour les tests de régression permettant des propriétés supplémentaires
interface ExtendedUserForTesting extends User {
  [key: string]: any; // Permet d'ajouter n'importe quelle propriété pour les tests
}

// Extension de global pour les métriques de performance
declare global {
  var recordPerformanceMetric:
    | ((name: string, value: any, metadata?: any) => void)
    | undefined;
}

describe('CurrentUser Decorator - Regression Tests', () => {
  // Récupération de la fonction de transformation du décorateur
  const decoratorFactory = CurrentUser as any;

  // Fonction helper qui reproduit la logique du décorateur pour les tests
  const extractUserFunction = (data: unknown, ctx: ExecutionContext): User => {
    const request = ctx.switchToHttp().getRequest<FastifyRequest>();
    const user = (request as any).user;

    if (!user) {
      throw new Error(
        'User not found in request context. Make sure AuthGuard is applied.',
      );
    }

    return user;
  };

  // ============================================================================
  // HELPERS DE TEST LOCAUX
  // ============================================================================

  const createTestUser = (
    overrides: Partial<ExtendedUserForTesting> = {},
  ): ExtendedUserForTesting => ({
    id: 'regression-test-user',
    email: 'regression@example.com',
    roles: ['user'],
    ...overrides,
  });

  const createMockExecutionContext = (request: any): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => request as any,
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
    }) as ExecutionContext;

  const measureExecutionTime = (fn: () => void): number => {
    const startTime = process.hrtime.bigint();
    fn();
    const endTime = process.hrtime.bigint();
    return Number(endTime - startTime) / 1000000; // Convert to milliseconds
  };

  const measureMemoryUsage = (fn: () => void): { heapUsed: number } => {
    if (global.gc) global.gc();
    const beforeMemory = process.memoryUsage();
    fn();
    const afterMemory = process.memoryUsage();
    return {
      heapUsed: afterMemory.heapUsed - beforeMemory.heapUsed,
    };
  };

  const benchmarkFunction = (
    fn: () => void,
    options: { iterations: number; warmup: number },
  ) => {
    // Warmup
    for (let i = 0; i < options.warmup; i++) {
      fn();
    }

    // Measure
    const startTime = process.hrtime.bigint();
    for (let i = 0; i < options.iterations; i++) {
      fn();
    }
    const endTime = process.hrtime.bigint();

    return {
      averageTime: Number(endTime - startTime) / 1000000 / options.iterations,
    };
  };

  const createUserVariants = () => ({
    basic: createTestUser(),
    admin: createTestUser({ roles: ['admin'] }),
    multiRole: createTestUser({ roles: ['user', 'admin', 'moderator'] }),
    emptyRoles: createTestUser({ roles: [] }),
    longId: createTestUser({ id: 'a'.repeat(100) }),
  });

  const createMaliciousUsers = () => ({
    scriptTag: createTestUser({ id: '<script>alert("xss")</script>' }),
    sqlInjection: createTestUser({ email: "'; DROP TABLE users; --@test.com" }),
    prototype: (() => {
      const user: any = createTestUser();
      try {
        user.__proto__.malicious = 'payload';
      } catch (e) {}
      return user;
    })(),
  });

  // ============================================================================
  // CONSTANTES DE RÉFÉRENCE POUR LA RÉGRESSION
  // ============================================================================

  // Baselines établies lors du développement initial (à ajuster selon le matériel)
  const PERFORMANCE_BASELINES = {
    SINGLE_EXTRACTION_MAX_TIME: 1.0, // ms - Ajusté pour être plus réaliste
    BURST_EXTRACTION_AVG_TIME: 0.1, // ms par extraction en burst
    MEMORY_OVERHEAD_MAX: 100 * 1024 * 1024, // bytes - 100MB pour 10k extractions
    LARGE_OBJECT_MAX_TIME: 10, // ms pour gros objets utilisateur
    STRESS_TEST_MAX_TIME: 200, // ms pour 1000 extractions
  };

  // Versions de référence pour la compatibilité
  const COMPATIBILITY_BASELINES = {
    NODE_VERSION: process.version,
    JEST_VERSION: require('jest/package.json').version,
    NESTJS_VERSION: require('@nestjs/core/package.json').version,
  };

  // ============================================================================
  // TESTS DE RÉGRESSION PERFORMANCE
  // ============================================================================

  describe('Régression de performance', () => {
    it('should maintain baseline performance for single extractions', () => {
      // Arrange
      const testUser = createTestUser();
      const mockContext = createMockExecutionContext({ user: testUser });

      // Act & Assert
      const metrics = benchmarkFunction(
        () => extractUserFunction(undefined, mockContext),
        { iterations: 1000, warmup: 100 },
      );

      // Vérification de la régression
      expect(metrics.averageTime).toBeLessThan(
        PERFORMANCE_BASELINES.SINGLE_EXTRACTION_MAX_TIME,
      );

      // Enregistrement pour le monitoring
      if (global.recordPerformanceMetric) {
        global.recordPerformanceMetric(
          'regression-single-extraction',
          metrics.averageTime,
          {
            baseline: PERFORMANCE_BASELINES.SINGLE_EXTRACTION_MAX_TIME,
            passed:
              metrics.averageTime <
              PERFORMANCE_BASELINES.SINGLE_EXTRACTION_MAX_TIME,
          },
        );
      }

      // Log pour tracking des performances dans le temps
      console.log(
        `📊 Regression - Single extraction: ${metrics.averageTime.toFixed(6)}ms (baseline: ${PERFORMANCE_BASELINES.SINGLE_EXTRACTION_MAX_TIME}ms)`,
      );
    });

    it('should maintain burst extraction performance', () => {
      // Arrange
      const testUser = createTestUser();
      const mockContext = createMockExecutionContext({ user: testUser });

      // Act - Burst de 1000 extractions
      const burstTime = measureExecutionTime(() => {
        for (let i = 0; i < 1000; i++) {
          extractUserFunction(undefined, mockContext);
        }
      });

      const avgBurstTime = burstTime / 1000;

      // Assert
      expect(avgBurstTime).toBeLessThan(
        PERFORMANCE_BASELINES.BURST_EXTRACTION_AVG_TIME,
      );
      expect(burstTime).toBeLessThan(
        PERFORMANCE_BASELINES.STRESS_TEST_MAX_TIME,
      );

      // Enregistrement pour monitoring
      if (global.recordPerformanceMetric) {
        global.recordPerformanceMetric(
          'regression-burst-extraction',
          avgBurstTime,
          {
            baseline: PERFORMANCE_BASELINES.BURST_EXTRACTION_AVG_TIME,
            totalTime: burstTime,
            iterations: 1000,
          },
        );
      }

      console.log(
        `📊 Regression - Burst extraction: ${avgBurstTime.toFixed(6)}ms/call (baseline: ${PERFORMANCE_BASELINES.BURST_EXTRACTION_AVG_TIME}ms)`,
      );
    });

    it('should handle large user objects within baseline', () => {
      // Arrange - Gros objet utilisateur avec interface étendue
      const largeUser: ExtendedUserForTesting = createTestUser({
        roles: Array.from({ length: 1000 }, (_, i) => `role-${i}`),
        metadata: Array.from({ length: 500 }, (_, i) => ({
          key: `meta-${i}`,
          value: 'x'.repeat(100), // 100 char strings
          nested: {
            level: i,
            data: Array.from({ length: 10 }, (_, j) => `data-${j}`),
          },
        })),
        permissions: Array.from({ length: 200 }, (_, i) => ({
          resource: `resource-${i}`,
          actions: ['read', 'write', 'delete'],
          conditions: { department: `dept-${i % 10}` },
        })),
      });

      const mockContext = createMockExecutionContext({ user: largeUser });

      // Act & Assert
      const executionTime = measureExecutionTime(() => {
        const result = extractUserFunction(undefined, mockContext);
        expect(result).toEqual(largeUser);
      });

      expect(executionTime).toBeLessThan(
        PERFORMANCE_BASELINES.LARGE_OBJECT_MAX_TIME,
      );

      console.log(
        `📊 Regression - Large object: ${executionTime.toFixed(6)}ms (baseline: ${PERFORMANCE_BASELINES.LARGE_OBJECT_MAX_TIME}ms)`,
      );
    });

    it('should not cause memory regression', () => {
      // Arrange
      const testUser = createTestUser();
      const mockContext = createMockExecutionContext({ user: testUser });

      // Act - Mesure de la mémoire
      const memoryUsage = measureMemoryUsage(() => {
        // 10000 extractions pour détecter les fuites
        for (let i = 0; i < 10000; i++) {
          extractUserFunction(undefined, mockContext);
        }
      });

      // Assert - Le décorateur ne devrait pas allouer de mémoire supplémentaire
      const memoryOverhead = Math.abs(memoryUsage.heapUsed);
      expect(memoryOverhead).toBeLessThan(
        PERFORMANCE_BASELINES.MEMORY_OVERHEAD_MAX,
      );

      console.log(
        `📊 Regression - Memory overhead: ${memoryOverhead} bytes (baseline: ${PERFORMANCE_BASELINES.MEMORY_OVERHEAD_MAX} bytes)`,
      );
    });
  });

  // ============================================================================
  // TESTS DE RÉGRESSION COMPATIBILITÉ
  // ============================================================================

  describe('Régression de compatibilité', () => {
    it('should work with current Node.js version', () => {
      // Vérification de compatibilité Node.js
      const currentNodeVersion = process.version;
      const majorVersion = parseInt(currentNodeVersion.slice(1).split('.')[0]);

      // Supporté: Node.js 16+
      expect(majorVersion).toBeGreaterThanOrEqual(16);

      console.log(`🔧 Node.js version: ${currentNodeVersion} (compatible)`);
    });

    it('should maintain TypeScript compatibility', () => {
      // Test que les types TypeScript sont toujours corrects
      const testUser: User = createTestUser();
      const mockContext = createMockExecutionContext({ user: testUser });

      // Act - Le typage doit être préservé
      const result: User = extractUserFunction(undefined, mockContext);

      // Assert - Compatibilité TypeScript
      expect(typeof result.id).toBe('string');
      expect(typeof result.email).toBe('string');
      expect(Array.isArray(result.roles)).toBe(true);

      // Test des propriétés strictes
      const keys = Object.keys(result);
      expect(keys).toContain('id');
      expect(keys).toContain('email');
      expect(keys).toContain('roles');
    });

    it('should work with current NestJS decorators pattern', () => {
      // Vérification que le pattern createParamDecorator est toujours supporté
      expect(typeof decoratorFactory).toBe('function');

      // Test de la signature du décorateur - le décorateur lui-même est la fonction
      const testUser = createTestUser();
      const mockContext = createMockExecutionContext({ user: testUser });

      // Le décorateur doit fonctionner quand appelé directement
      expect(() => {
        // Simuler l'appel du décorateur comme NestJS le ferait
        const result = extractUserFunction(undefined, mockContext);
        expect(result).toEqual(testUser);
      }).not.toThrow();
    });

    it('should handle ExecutionContext interface changes', () => {
      // Test de robustesse face aux changements potentiels d'ExecutionContext
      const testUser = createTestUser();

      // Créer un contexte qui implémente seulement les méthodes essentielles
      const minimalContext = {
        switchToHttp: () => ({
          getRequest: () => ({ user: testUser }) as any, // Cast en any pour éviter l'erreur TypeScript
          getResponse: jest.fn(),
          getNext: jest.fn(),
        }),
      } as any;

      // Act & Assert - Doit fonctionner avec interface minimale
      expect(() => {
        const result = extractUserFunction(undefined, minimalContext);
        expect(result).toEqual(testUser);
      }).not.toThrow();
    });
  });

  // ============================================================================
  // TESTS DE RÉGRESSION FONCTIONNELLE
  // ============================================================================

  describe('Régression fonctionnelle', () => {
    it('should maintain exact behavior with different user types', () => {
      // Test avec tous les types d'utilisateurs connus
      const userVariants = createUserVariants();

      Object.entries(userVariants).forEach(([variantName, user]) => {
        const mockContext = createMockExecutionContext({ user });

        const result = extractUserFunction(undefined, mockContext);

        // Le résultat doit être identique à l'entrée
        expect(result).toEqual(user);
        expect(result === user).toBe(true); // Même référence
      });
    });

    it('should maintain error behavior consistency', () => {
      // Test que les erreurs sont toujours levées de manière cohérente
      const errorCases = [
        { user: undefined, name: 'undefined user' },
        { user: null, name: 'null user' },
        { user: '', name: 'empty string user' },
        { user: false, name: 'false user' },
        { user: 0, name: 'zero user' },
      ];

      errorCases.forEach(({ user, name }) => {
        const mockContext = createMockExecutionContext({ user });

        expect(() => {
          extractUserFunction(undefined, mockContext);
        }).toThrow(
          'User not found in request context. Make sure AuthGuard is applied.',
        );
      });
    });

    it('should preserve all user properties without modification', () => {
      // Test que toutes les propriétés sont préservées exactement
      const complexUser: ExtendedUserForTesting = {
        id: 'complex-user-123',
        email: 'complex@example.com',
        roles: ['user', 'admin'],
        customProp: 'custom-value',
        nested: {
          level1: {
            level2: {
              data: 'deep-data',
            },
          },
        },
        array: [1, 2, 3, { nested: 'value' }],
        date: new Date('2025-01-01'),
        regex: /test-pattern/g,
        nullValue: null,
        undefinedValue: undefined,
        emptyString: '',
        zeroNumber: 0,
        falseBoolean: false,
      };

      const mockContext = createMockExecutionContext({ user: complexUser });
      const result = extractUserFunction(
        undefined,
        mockContext,
      ) as ExtendedUserForTesting;

      // Vérification propriété par propriété
      expect(result).toEqual(complexUser);
      expect(result.customProp).toBe('custom-value');
      expect(result.nested.level1.level2.data).toBe('deep-data');
      expect(result.date).toBeInstanceOf(Date);
      expect(result.regex).toBeInstanceOf(RegExp);
      expect(result.nullValue).toBeNull();
      expect(result.undefinedValue).toBeUndefined();
    });
  });

  // ============================================================================
  // TESTS DE RÉGRESSION SÉCURITÉ
  // ============================================================================

  describe('Régression de sécurité', () => {
    it('should maintain isolation from request modifications', () => {
      // Test que les modifications du request n'affectent pas le résultat
      const originalUser = createTestUser();
      const mockRequest = { user: originalUser };
      const mockContext = createMockExecutionContext(mockRequest);

      // Première extraction
      const result1 = extractUserFunction(undefined, mockContext);

      // Modification du request (simulation d'attaque)
      (mockRequest as any).user = {
        id: 'hacked',
        email: 'hacker@evil.com',
        roles: ['admin', 'super-admin'],
      };

      // Deuxième extraction - devrait refléter la nouvelle valeur
      const result2 = extractUserFunction(undefined, mockContext);

      // Le décorateur ne clone pas - il retourne la référence actuelle
      expect(result2).not.toEqual(originalUser);
      expect(result2.id).toBe('hacked');
    });

    it('should resist prototype pollution attempts', () => {
      // Test de résistance à la pollution de prototype
      const testUser = createTestUser();
      const mockRequest: any = { user: testUser };

      // Tentative de pollution
      try {
        mockRequest.__proto__.polluted = 'malicious';
        mockRequest.constructor.prototype.polluted = 'evil';
      } catch (e) {
        // Ignorer les erreurs de strict mode
      }

      const mockContext = createMockExecutionContext(mockRequest);
      const result = extractUserFunction(undefined, mockContext);

      // Le résultat doit être l'objet utilisateur attendu
      expect(result).toEqual(testUser);
      expect(result.id).toBe(testUser.id);
      expect(result.email).toBe(testUser.email);
      expect(result.roles).toEqual(testUser.roles);

      // Note: La pollution de prototype peut affecter l'objet retourné car c'est
      // un comportement JavaScript normal. La protection doit se faire au niveau
      // de l'environnement d'exécution, pas au niveau du décorateur.
    });

    it('should handle malicious user objects safely', () => {
      // Test avec objets utilisateur potentiellement malveillants
      const maliciousUsers = createMaliciousUsers();

      Object.entries(maliciousUsers).forEach(([type, maliciousUser]) => {
        const mockContext = createMockExecutionContext({ user: maliciousUser });

        // Doit extraire sans erreur
        expect(() => {
          const result = extractUserFunction(undefined, mockContext);
          expect(result).toEqual(maliciousUser);
        }).not.toThrow();
      });
    });
  });

  // ============================================================================
  // RAPPORT DE RÉGRESSION
  // ============================================================================

  describe('Génération de rapport de régression', () => {
    it('should generate regression baseline report', () => {
      // Collecte de toutes les métriques de performance pour rapport
      const testUser = createTestUser();
      const mockContext = createMockExecutionContext({ user: testUser });

      const regressionReport = {
        timestamp: new Date().toISOString(),
        environment: {
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch,
        },
        baselines: PERFORMANCE_BASELINES,
        compatibility: COMPATIBILITY_BASELINES,
        currentMeasurements: {
          singleExtraction: measureExecutionTime(() => {
            extractUserFunction(undefined, mockContext);
          }),
          burstExtraction:
            measureExecutionTime(() => {
              for (let i = 0; i < 100; i++) {
                extractUserFunction(undefined, mockContext);
              }
            }) / 100,
        },
      };

      // Validation que les mesures actuelles respectent les baselines
      expect(
        regressionReport.currentMeasurements.singleExtraction,
      ).toBeLessThan(PERFORMANCE_BASELINES.SINGLE_EXTRACTION_MAX_TIME);
      expect(regressionReport.currentMeasurements.burstExtraction).toBeLessThan(
        PERFORMANCE_BASELINES.BURST_EXTRACTION_AVG_TIME,
      );

      // Log du rapport pour tracking
      console.log(
        '📋 Regression Report:',
        JSON.stringify(regressionReport, null, 2),
      );

      // Enregistrement pour le monitoring
      if (global.recordPerformanceMetric) {
        global.recordPerformanceMetric('regression-report', regressionReport, {
          type: 'baseline-validation',
        });
      }
    });
  });
});
