/**
 * Configuration et setup pour les tests de pagination.
 *
 * Ce fichier configure l'environnement de test, les matchers personnalisés,
 * et les utilitaires communs pour tous les tests de pagination.
 */

import {
  PaginatedResult,
  PaginationMeta,
  isPaginatedResult,
} from '../../src/common/interfaces/paginated-result.interface';

// Extension des matchers Jest pour les tests de pagination
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidPaginatedResult(): R;
      toHaveValidPaginationMeta(): R;
      toBePaginationPage(expectedPage: number): R;
      toHavePaginationLimit(expectedLimit: number): R;
      toHaveCorrectPaginationCalculations(): R;
      toBeWithinPerformanceThreshold(maxMs: number): R;
      toHaveValidPaginationNavigation(): R;
      toPreserveDataIntegrity(): R;
    }
  }
}

// Matcher personnalisé pour vérifier qu'un objet est un PaginatedResult valide
expect.extend({
  toBeValidPaginatedResult(received: unknown) {
    const pass = isPaginatedResult(received);

    if (pass) {
      const result = received as PaginatedResult<unknown>;
      const isDataArray = Array.isArray(result.data);
      const hasPagination =
        result.pagination && typeof result.pagination === 'object';
      const hasValidTotal = typeof result.total === 'number';

      if (!isDataArray || !hasPagination || !hasValidTotal) {
        return {
          message: () =>
            `Expected object to be a valid PaginatedResult, but structure is invalid`,
          pass: false,
        };
      }
    }

    return {
      message: () =>
        pass
          ? `Expected object not to be a valid PaginatedResult`
          : `Expected object to be a valid PaginatedResult, but received: ${JSON.stringify(received)}`,
      pass,
    };
  },

  toHaveValidPaginationMeta(received: PaginationMeta) {
    const requiredFields = [
      'page',
      'limit',
      'totalPages',
      'hasNext',
      'hasPrevious',
      'offset',
    ];
    const missingFields = requiredFields.filter(
      (field) => !(field in received),
    );

    if (missingFields.length > 0) {
      return {
        message: () =>
          `PaginationMeta is missing required fields: ${missingFields.join(', ')}`,
        pass: false,
      };
    }

    const validTypes =
      typeof received.page === 'number' &&
      typeof received.limit === 'number' &&
      typeof received.totalPages === 'number' &&
      typeof received.hasNext === 'boolean' &&
      typeof received.hasPrevious === 'boolean' &&
      typeof received.offset === 'number';

    if (!validTypes) {
      return {
        message: () => `PaginationMeta has invalid field types`,
        pass: false,
      };
    }

    return {
      message: () => `Expected PaginationMeta to be invalid`,
      pass: true,
    };
  },

  toBePaginationPage(received: PaginatedResult<unknown>, expectedPage: number) {
    const actualPage = received.pagination.page;
    const pass = actualPage === expectedPage;

    return {
      message: () =>
        pass
          ? `Expected pagination page not to be ${expectedPage}`
          : `Expected pagination page to be ${expectedPage}, but received ${actualPage}`,
      pass,
    };
  },

  toHavePaginationLimit(
    received: PaginatedResult<unknown>,
    expectedLimit: number,
  ) {
    const actualLimit = received.pagination.limit;
    const pass = actualLimit === expectedLimit;

    return {
      message: () =>
        pass
          ? `Expected pagination limit not to be ${expectedLimit}`
          : `Expected pagination limit to be ${expectedLimit}, but received ${actualLimit}`,
      pass,
    };
  },

  toHaveCorrectPaginationCalculations(received: PaginatedResult<unknown>) {
    const { page, limit, totalPages, hasNext, hasPrevious, offset } =
      received.pagination;
    const { total } = received;

    // Vérifier le calcul de totalPages
    const expectedTotalPages = total > 0 ? Math.ceil(total / limit) : 0;
    const totalPagesCorrect = totalPages === expectedTotalPages;

    // Vérifier le calcul de l'offset
    const expectedOffset = (page - 1) * limit;
    const offsetCorrect = offset === expectedOffset;

    // Vérifier hasNext
    const expectedHasNext = page < totalPages;
    const hasNextCorrect = hasNext === expectedHasNext;

    // Vérifier hasPrevious
    const expectedHasPrevious = page > 1;
    const hasPreviousCorrect = hasPrevious === expectedHasPrevious;

    const allCorrect =
      totalPagesCorrect &&
      offsetCorrect &&
      hasNextCorrect &&
      hasPreviousCorrect;

    if (!allCorrect) {
      const errors: string[] = [];
      if (!totalPagesCorrect)
        errors.push(
          `totalPages: expected ${expectedTotalPages}, got ${totalPages}`,
        );
      if (!offsetCorrect)
        errors.push(`offset: expected ${expectedOffset}, got ${offset}`);
      if (!hasNextCorrect)
        errors.push(`hasNext: expected ${expectedHasNext}, got ${hasNext}`);
      if (!hasPreviousCorrect)
        errors.push(
          `hasPrevious: expected ${expectedHasPrevious}, got ${hasPrevious}`,
        );

      return {
        message: () =>
          `Pagination calculations are incorrect: ${errors.join(', ')}`,
        pass: false,
      };
    }

    return {
      message: () => `Expected pagination calculations to be incorrect`,
      pass: true,
    };
  },

  toBeWithinPerformanceThreshold(received: () => void, maxMs: number) {
    const start = performance.now();
    received();
    const duration = performance.now() - start;

    const pass = duration <= maxMs;

    return {
      message: () =>
        pass
          ? `Expected operation to take more than ${maxMs}ms, but took ${duration.toFixed(2)}ms`
          : `Expected operation to complete within ${maxMs}ms, but took ${duration.toFixed(2)}ms`,
      pass,
    };
  },

  toHaveValidPaginationNavigation(received: PaginatedResult<unknown>) {
    const { page, totalPages, hasNext, hasPrevious } = received.pagination;

    // Vérifier la cohérence de la navigation
    const hasNextConsistent = page < totalPages === hasNext;
    const hasPreviousConsistent = page > 1 === hasPrevious;

    // Cas spéciaux
    const firstPageConsistent = page === 1 ? !hasPrevious : true;
    const lastPageConsistent = page === totalPages ? !hasNext : true;

    const allConsistent =
      hasNextConsistent &&
      hasPreviousConsistent &&
      firstPageConsistent &&
      lastPageConsistent;

    if (!allConsistent) {
      const errors: string[] = [];
      if (!hasNextConsistent)
        errors.push('hasNext is inconsistent with page/totalPages');
      if (!hasPreviousConsistent)
        errors.push('hasPrevious is inconsistent with page');
      if (!firstPageConsistent)
        errors.push('First page should not have previous');
      if (!lastPageConsistent) errors.push('Last page should not have next');

      return {
        message: () =>
          `Pagination navigation is inconsistent: ${errors.join(', ')}`,
        pass: false,
      };
    }

    return {
      message: () => `Expected pagination navigation to be inconsistent`,
      pass: true,
    };
  },

  toPreserveDataIntegrity(received: {
    original: unknown;
    result: PaginatedResult<unknown>;
  }) {
    const { original, result } = received;

    // Vérifier que les données ne sont pas mutées
    const dataPreserved = result.data === original;

    // Vérifier que les métadonnées sont cohérentes
    const metadataCoherent =
      result.total >= 0 &&
      result.pagination.page > 0 &&
      result.pagination.limit > 0;

    const integrityPreserved = dataPreserved && metadataCoherent;

    return {
      message: () =>
        integrityPreserved
          ? `Expected data integrity to be compromised`
          : `Data integrity was not preserved: dataPreserved=${dataPreserved}, metadataCoherent=${metadataCoherent}`,
      pass: integrityPreserved,
    };
  },
});

// Utilitaires de test communs
export class PaginationTestUtils {
  /**
   * Génère des données de test standardisées
   */
  static generateTestData<T>(
    count: number,
    generator: (index: number) => T = (i) => `item-${i}` as T,
  ): T[] {
    return Array.from({ length: count }, (_, i) => generator(i));
  }

  /**
   * Crée un PaginatedResult de test valide
   */
  static createValidPaginatedResult<T>(
    data: T[],
    page: number = 1,
    limit: number = 10,
    total?: number,
  ): PaginatedResult<T> {
    const actualTotal = total ?? data.length;
    const totalPages = actualTotal > 0 ? Math.ceil(actualTotal / limit) : 0;

    return {
      data,
      pagination: {
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
        offset: (page - 1) * limit,
      },
      total: actualTotal,
    };
  }

  /**
   * Génère des paramètres de pagination aléatoires valides
   */
  static generateRandomPaginationParams(
    maxPage: number = 100,
    maxLimit: number = 50,
  ): {
    page: number;
    limit: number;
  } {
    return {
      page: Math.floor(Math.random() * maxPage) + 1,
      limit: Math.floor(Math.random() * maxLimit) + 1,
    };
  }

  /**
   * Mesure le temps d'exécution d'une fonction
   */
  static measureExecutionTime<T>(fn: () => T): { result: T; duration: number } {
    const start = performance.now();
    const result = fn();
    const duration = performance.now() - start;

    return { result, duration };
  }

  /**
   * Vérifie la cohérence des calculs de pagination
   */
  static validatePaginationConsistency(
    page: number,
    limit: number,
    total: number,
    meta: PaginationMeta,
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    const expectedTotalPages = total > 0 ? Math.ceil(total / limit) : 0;
    if (meta.totalPages !== expectedTotalPages) {
      errors.push(
        `totalPages: expected ${expectedTotalPages}, got ${meta.totalPages}`,
      );
    }

    const expectedOffset = (page - 1) * limit;
    if (meta.offset !== expectedOffset) {
      errors.push(`offset: expected ${expectedOffset}, got ${meta.offset}`);
    }

    const expectedHasNext = page < expectedTotalPages;
    if (meta.hasNext !== expectedHasNext) {
      errors.push(`hasNext: expected ${expectedHasNext}, got ${meta.hasNext}`);
    }

    const expectedHasPrevious = page > 1;
    if (meta.hasPrevious !== expectedHasPrevious) {
      errors.push(
        `hasPrevious: expected ${expectedHasPrevious}, got ${meta.hasPrevious}`,
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Génère des cas de test edge cases
   */
  static generateEdgeCases(): Array<{
    page: number;
    limit: number;
    total: number;
    description: string;
  }> {
    return [
      { page: 1, limit: 10, total: 0, description: 'Empty dataset' },
      { page: 1, limit: 10, total: 5, description: 'Total less than limit' },
      { page: 1, limit: 1, total: 1, description: 'Single item' },
      {
        page: 10,
        limit: 10,
        total: 50,
        description: 'Page beyond available data',
      },
      {
        page: 1,
        limit: 100,
        total: 50,
        description: 'Limit greater than total',
      },
      {
        page: 1000000,
        limit: 1,
        total: 1000000,
        description: 'Very large page number',
      },
      { page: 1, limit: 1000, total: 1000000, description: 'Very large limit' },
    ];
  }
}

// Configuration globale pour les tests de performance
export const PERFORMANCE_THRESHOLDS = {
  CALCULATION_MS: 1,
  VALIDATION_MS: 1,
  CREATION_MS: 5,
  MAPPING_MS: 10,
  BULK_OPERATIONS_MS: 50,
} as const;

// Configuration globale pour les tests de mémoire
export const MEMORY_THRESHOLDS = {
  SMALL_DATASET_MB: 1,
  MEDIUM_DATASET_MB: 10,
  LARGE_DATASET_MB: 50,
  STRESS_TEST_MB: 100,
} as const;

// Mocking des fonctions de performance si non disponibles
if (typeof performance === 'undefined') {
  global.performance = {
    now: () => Date.now(),
  } as Performance;
}

// Configuration de timeout par défaut plus généreux pour les tests
jest.setTimeout(30000);

// Nettoyage automatique après chaque test
afterEach(() => {
  // Forcer le garbage collection si disponible
  if (global.gc) {
    global.gc();
  }
});

// Rapport de performance global
let testPerformanceLog: Array<{
  testName: string;
  duration: number;
  memoryUsage: number;
}> = [];

beforeEach(() => {
  const testName = expect.getState().currentTestName || 'unknown';
  const memoryBefore = process.memoryUsage().heapUsed;

  (global as any).__testStart = {
    time: performance.now(),
    memory: memoryBefore,
    name: testName,
  };
});

afterEach(() => {
  const testStart = (global as any).__testStart;
  if (testStart) {
    const duration = performance.now() - testStart.time;
    const memoryAfter = process.memoryUsage().heapUsed;
    const memoryDelta = memoryAfter - testStart.memory;

    testPerformanceLog.push({
      testName: testStart.name,
      duration,
      memoryUsage: memoryDelta,
    });
  }
});

// Rapport final des performances
afterAll(() => {
  if (testPerformanceLog.length > 0) {
    console.log('\n📊 Performance Summary:');
    console.log('='.repeat(50));

    const slowTests = testPerformanceLog
      .filter((test) => test.duration > 100)
      .sort((a, b) => b.duration - a.duration);

    if (slowTests.length > 0) {
      console.log('\n🐌 Slowest tests:');
      slowTests.slice(0, 5).forEach((test) => {
        console.log(`  ${test.testName}: ${test.duration.toFixed(2)}ms`);
      });
    }

    const memoryIntensiveTests = testPerformanceLog
      .filter((test) => test.memoryUsage > 10 * 1024 * 1024) // > 10MB
      .sort((a, b) => b.memoryUsage - a.memoryUsage);

    if (memoryIntensiveTests.length > 0) {
      console.log('\n💾 Memory intensive tests:');
      memoryIntensiveTests.slice(0, 5).forEach((test) => {
        console.log(
          `  ${test.testName}: ${(test.memoryUsage / 1024 / 1024).toFixed(2)}MB`,
        );
      });
    }

    const averageDuration =
      testPerformanceLog.reduce((sum, test) => sum + test.duration, 0) /
      testPerformanceLog.length;
    console.log(`\n⚡ Average test duration: ${averageDuration.toFixed(2)}ms`);
    console.log('='.repeat(50));
  }
});
