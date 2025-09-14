// test/setup/jest.setup.ts

import 'reflect-metadata';
import { ClassTransformOptions } from 'class-transformer';
import { useContainer } from 'class-validator';

// =============================================================================
// CONFIGURATION DE BASE
// =============================================================================

// Variables d'environnement pour les tests
process.env.NODE_ENV = 'test';
process.env.TZ = 'UTC';

// Configuration class-transformer
const defaultTransformOptions: ClassTransformOptions = {
  enableImplicitConversion: true,
  excludeExtraneousValues: true,
  exposeDefaultValues: true,
  exposeUnsetFields: false,
};

if (typeof global !== 'undefined') {
  (global as any).classTransformOptions = defaultTransformOptions;
}

// Configuration timeouts
jest.setTimeout(30000);

// =============================================================================
// MATCHERS PERSONNALISÉS
// =============================================================================

declare global {
  namespace jest {
    interface Matchers<R> {
      // Project & Statistics matchers
      toBeValidProjectResponseDto(): R;
      toBeValidStatisticsResponseDto(): R;
      toContainOnlyValidFileIds(): R;
      toHaveSecureLogOutput(): R;
      toBeFreshData(): R;
      toBeWithinTimeRange(start: Date, end: Date): R;
      
      // Pagination matchers
      toBeValidPaginatedResult(): R;
      toHaveValidPaginationMeta(): R;
      toHaveCorrectPaginationCalculations(): R;
      
      // Security & Validation matchers
      toNotContainSensitiveInfo(sensitiveTerms: string[]): R;
      toBeValidationResult(): R;
      toHaveAuditProperties(expectedProps: string[]): R;
    }
  }
}

expect.extend({
  // Project Response DTO matcher
  toBeValidProjectResponseDto(received: any) {
    const pass =
      received &&
      typeof received.id === 'string' &&
      typeof received.name === 'string' &&
      typeof received.initialPrompt === 'string' &&
      typeof received.status === 'string' &&
      Array.isArray(received.uploadedFileIds) &&
      Array.isArray(received.generatedFileIds) &&
      received.createdAt instanceof Date &&
      received.updatedAt instanceof Date &&
      typeof received.hasUploadedFiles === 'function' &&
      typeof received.hasGeneratedFiles === 'function' &&
      typeof received.getTotalFilesCount === 'function' &&
      typeof received.toLogSafeString === 'function';

    return {
      message: () => pass
        ? `expected ${received} not to be a valid ProjectResponseDto`
        : `expected ${received} to be a valid ProjectResponseDto`,
      pass,
    };
  },

  // Statistics Response DTO matcher
  toBeValidStatisticsResponseDto(received: any) {
    const pass =
      received &&
      received.costs &&
      typeof received.costs.claudeApi === 'number' &&
      typeof received.costs.storage === 'number' &&
      typeof received.costs.compute === 'number' &&
      typeof received.costs.total === 'number' &&
      received.performance &&
      typeof received.performance.generationTime === 'number' &&
      typeof received.performance.processingTime === 'number' &&
      typeof received.performance.totalTime === 'number' &&
      received.usage &&
      typeof received.usage.documentsGenerated === 'number' &&
      typeof received.usage.filesProcessed === 'number' &&
      typeof received.usage.tokensUsed === 'number' &&
      received.lastUpdated instanceof Date &&
      typeof received.getCostPerDocument === 'function' &&
      typeof received.getTokensPerSecond === 'function' &&
      typeof received.isDataFresh === 'function' &&
      typeof received.getPerformanceSummary === 'function';

    return {
      message: () => pass
        ? `expected ${received} not to be a valid StatisticsResponseDto`
        : `expected ${received} to be a valid StatisticsResponseDto`,
      pass,
    };
  },

  // File IDs validation
  toContainOnlyValidFileIds(received: any[]) {
    if (!Array.isArray(received)) {
      return {
        message: () => `expected ${received} to be an array`,
        pass: false,
      };
    }

    const invalidItems = received.filter(
      (item) =>
        typeof item !== 'string' ||
        item.length === 0 ||
        item.includes('<script>') ||
        item.includes('javascript:') ||
        item.includes('data:'),
    );

    const pass = invalidItems.length === 0;

    return {
      message: () => pass
        ? `expected ${received} not to contain only valid file IDs`
        : `expected ${received} to contain only valid file IDs, but found invalid items: ${JSON.stringify(invalidItems)}`,
      pass,
    };
  },

  // Security log output
  toHaveSecureLogOutput(received: string) {
    const sensitivePatterns = [
      /password/i,
      /secret/i,
      /confidentiel/i,
      /private/i,
      /token/i,
      /<script>/i,
      /javascript:/i,
      /data:/i,
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/, // Email
      /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/, // Numéro de carte
    ];

    const foundSensitiveData = sensitivePatterns.some((pattern) =>
      pattern.test(received),
    );
    const pass = !foundSensitiveData;

    return {
      message: () => pass
        ? `expected log output "${received}" to contain sensitive data`
        : `expected log output "${received}" not to contain sensitive data`,
      pass,
    };
  },

  // Fresh data validation
  toBeFreshData(received: Date) {
    if (!(received instanceof Date)) {
      return {
        message: () => `expected ${received} to be a Date instance`,
        pass: false,
      };
    }

    const now = new Date();
    const dayInMs = 24 * 60 * 60 * 1000;
    const age = now.getTime() - received.getTime();
    const pass = age >= 0 && age < dayInMs;

    return {
      message: () => pass
        ? `expected date ${received.toISOString()} not to be fresh (less than 24h old)`
        : `expected date ${received.toISOString()} to be fresh (less than 24h old), but it's ${Math.round(age / (60 * 60 * 1000))}h old`,
      pass,
    };
  },

  // Date range validation
  toBeWithinTimeRange(received: Date, start: Date, end: Date) {
    if (
      !(received instanceof Date) ||
      !(start instanceof Date) ||
      !(end instanceof Date)
    ) {
      return {
        message: () => `expected all parameters to be Date instances`,
        pass: false,
      };
    }

    const pass = received >= start && received <= end;

    return {
      message: () => pass
        ? `expected date ${received.toISOString()} not to be within range [${start.toISOString()}, ${end.toISOString()}]`
        : `expected date ${received.toISOString()} to be within range [${start.toISOString()}, ${end.toISOString()}]`,
      pass,
    };
  },

  // Paginated result validation
  toBeValidPaginatedResult(received: unknown) {
    const isValid = !!(received && 
      typeof received === 'object' &&
      'data' in received && Array.isArray((received as any).data) &&
      'pagination' in received && typeof (received as any).pagination === 'object' &&
      'total' in received && typeof (received as any).total === 'number');
    
    return {
      message: () => isValid 
        ? `Expected object not to be a valid PaginatedResult`
        : `Expected object to be a valid PaginatedResult`,
      pass: isValid,
    };
  },

  // Pagination meta validation
  toHaveValidPaginationMeta(received: any) {
    const requiredFields = [
      'page', 'limit', 'totalPages', 'hasNext', 'hasPrevious', 'offset'
    ];
    const missingFields = requiredFields.filter(field => !(field in received));

    if (missingFields.length > 0) {
      return {
        message: () => `PaginationMeta is missing required fields: ${missingFields.join(', ')}`,
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

    return {
      message: () => validTypes 
        ? `Expected PaginationMeta to be invalid`
        : `PaginationMeta has invalid field types`,
      pass: validTypes,
    };
  },

  // Pagination calculations validation
  toHaveCorrectPaginationCalculations(received: any) {
    const { page, limit, totalPages, hasNext, hasPrevious, offset } = received.pagination;
    const { total } = received;

    const expectedTotalPages = total > 0 ? Math.ceil(total / limit) : 0;
    const expectedOffset = (page - 1) * limit;
    const expectedHasNext = page < totalPages;
    const expectedHasPrevious = page > 1;

    const errors: string[] = [];
    if (totalPages !== expectedTotalPages) {
      errors.push(`totalPages: expected ${expectedTotalPages}, got ${totalPages}`);
    }
    if (offset !== expectedOffset) {
      errors.push(`offset: expected ${expectedOffset}, got ${offset}`);
    }
    if (hasNext !== expectedHasNext) {
      errors.push(`hasNext: expected ${expectedHasNext}, got ${hasNext}`);
    }
    if (hasPrevious !== expectedHasPrevious) {
      errors.push(`hasPrevious: expected ${expectedHasPrevious}, got ${hasPrevious}`);
    }

    const pass = errors.length === 0;

    return {
      message: () => pass
        ? `Expected pagination calculations to be incorrect`
        : `Pagination calculations are incorrect: ${errors.join(', ')}`,
      pass,
    };
  },

  // Sensitive information validation
  toNotContainSensitiveInfo(received: string, sensitiveTerms: string[]) {
    const containsSensitive = sensitiveTerms.some(term => 
      received && received.toLowerCase().includes(term.toLowerCase())
    );
    
    if (!containsSensitive) {
      return {
        message: () => `Expected message to contain sensitive information`,
        pass: true,
      };
    } else {
      const foundTerms = sensitiveTerms.filter(term =>
        received.toLowerCase().includes(term.toLowerCase())
      );
      return {
        message: () => `Expected message not to contain sensitive terms: ${foundTerms.join(', ')}`,
        pass: false,
      };
    }
  },

  // Validation result structure
  toBeValidationResult(received: any) {
    const hasRequiredProps =
      received &&
      typeof received === 'object' &&
      typeof received.isValid === 'boolean' &&
      Array.isArray(received.errors);

    return {
      message: () => hasRequiredProps
        ? `Expected not to be a validation result`
        : `Expected to be a validation result with isValid (boolean) and errors (array)`,
      pass: hasRequiredProps,
    };
  },

  // Audit properties validation
  toHaveAuditProperties(received: any, expectedProps: string[]) {
    const pass = expectedProps.every(
      (prop) => received && typeof received === 'object' && prop in received,
    );

    if (pass) {
      return {
        message: () => `Expected exception not to have audit properties ${expectedProps.join(', ')}`,
        pass: true,
      };
    } else {
      const missingProps = expectedProps.filter((prop) => !(prop in received));
      return {
        message: () => `Expected exception to have audit properties: ${missingProps.join(', ')}`,
        pass: false,
      };
    }
  },
});

// =============================================================================
// MOCKS GLOBAUX
// =============================================================================

const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

beforeAll(() => {
  // Réduire la verbosité des logs pendant les tests
  console.log = jest.fn();
  console.warn = jest.fn();
  console.error = jest.fn();
});

afterAll(() => {
  // Restaurer les fonctions originales
  console.log = originalConsoleLog;
  console.warn = originalConsoleWarn;
  console.error = originalConsoleError;
});

// =============================================================================
// UTILITAIRES GLOBAUX
// =============================================================================

// Utilitaire pour créer des dates de test cohérentes
global.createTestDate = (offset: number = 0): Date => {
  const baseDate = new Date('2024-08-08T10:30:00.000Z');
  return new Date(baseDate.getTime() + offset);
};

// Utilitaire pour créer des IDs de test cohérents
global.createTestId = (prefix: string = 'test', suffix: string = ''): string => {
  const uuid = '550e8400-e29b-41d4-a716-446655440000';
  return suffix ? `${prefix}-${uuid}-${suffix}` : `${prefix}-${uuid}`;
};

// Utilitaire pour attendre un délai
global.sleep = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

// Utilitaire pour mesurer le temps d'exécution
global.measureTime = async <T>(
  fn: () => T | Promise<T>,
): Promise<{ result: T; duration: number }> => {
  const start = performance.now();
  const result = await fn();
  const end = performance.now();
  return { result, duration: end - start };
};

// Utilitaire pour générer des données de test volumineuses
global.generateLargeArray = <T>(
  size: number,
  generator: (index: number) => T,
): T[] => {
  return Array.from({ length: size }, (_, index) => generator(index));
};

// Utilitaire pour vérifier la sécurité des chaînes
global.isSecureString = (str: string): boolean => {
  const dangerousPatterns = [
    /<script>/i,
    /javascript:/i,
    /vbscript:/i,
    /data:/i,
    /on\w+\s*=/i,
    /eval\s*\(/i,
    /expression\s*\(/i,
  ];

  return !dangerousPatterns.some((pattern) => pattern.test(str));
};

// Fonction pour debugger les transformations class-transformer
global.debugTransformation = (data: any, TargetClass: any) => {
  console.log('=== DEBUG TRANSFORMATION ===');
  console.log('Input data:', JSON.stringify(data, null, 2));

  try {
    const { plainToInstance } = require('class-transformer');
    const result = plainToInstance(TargetClass, data);
    console.log('Transformed result:', result);
    console.log('Result type:', result.constructor.name);
    return result;
  } catch (error) {
    console.error('Transformation error:', error);
    throw error;
  }
};

// =============================================================================
// DÉCLARATIONS GLOBALES TYPESCRIPT
// =============================================================================

declare global {
  function createTestDate(offset?: number): Date;
  function createTestId(prefix?: string, suffix?: string): string;
  function sleep(ms: number): Promise<void>;
  function measureTime<T>(
    fn: () => T | Promise<T>,
  ): Promise<{ result: T; duration: number }>;
  function generateLargeArray<T>(
    size: number,
    generator: (index: number) => T,
  ): T[];
  function isSecureString(str: string): boolean;
  function debugTransformation(data: any, TargetClass: any): any;
}

// =============================================================================
// MÉTRIQUES DE PERFORMANCE
// =============================================================================

let performanceMetrics: Array<{
  testName: string;
  duration: number;
  memory: number;
}> = [];

beforeEach(() => {
  if (global.gc) {
    global.gc(); // Force garbage collection si disponible
  }
});

afterEach(() => {
  const testName = expect.getState().currentTestName || 'unknown';
  const memoryUsage = process.memoryUsage().heapUsed;

  performanceMetrics.push({
    testName,
    duration: 0,
    memory: memoryUsage,
  });
});

afterAll(() => {
  if (process.env.JEST_VERBOSE === 'true') {
    console.log('\n=== Performance Metrics ===');
    performanceMetrics.forEach((metric) => {
      console.log(
        `${metric.testName}: ${(metric.memory / 1024 / 1024).toFixed(2)}MB`,
      );
    });
  }
});

// =============================================================================
// GESTION DES ERREURS
// =============================================================================

process.on('unhandledRejection', (reason, promise) => {
  if (process.env.JEST_VERBOSE === 'true') {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  }
});

process.on('uncaughtException', (error) => {
  if (process.env.JEST_VERBOSE === 'true') {
    console.error('Uncaught Exception:', error);
  }
});

// =============================================================================
// FINALISATION
// =============================================================================

if (process.env.JEST_VERBOSE === 'true') {
  console.log('✅ Jest setup completed');
  console.log(`📅 Test environment: ${process.env.NODE_ENV}`);
  console.log(`🌍 Timezone: ${process.env.TZ}`);
  console.log(`🚀 Ready to run tests!`);
}

export {};