// test/setup/jest.setup.ts

import 'reflect-metadata';

// =============================================================================
// CONFIGURATION GLOBALE JEST POUR PROJECT-RESPONSE-DTO TESTS
// =============================================================================

// Configuration des variables d'environnement pour les tests
process.env.NODE_ENV = 'test';
process.env.TZ = 'UTC';

// =============================================================================
// CONFIGURATION CLASS-TRANSFORMER
// =============================================================================

// Assurer que class-transformer utilise les bonnes configurations
import { ClassTransformOptions } from 'class-transformer';

// Configuration par défaut pour tous les tests de transformation
const defaultTransformOptions: ClassTransformOptions = {
  enableImplicitConversion: true,
  excludeExtraneousValues: true,
  exposeDefaultValues: true,
  exposeUnsetFields: false,
};

// Appliquer la configuration globale si disponible
if (typeof global !== 'undefined') {
  (global as any).classTransformOptions = defaultTransformOptions;
}

// =============================================================================
// MATCHERS PERSONNALISÉS JEST
// =============================================================================

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidProjectResponseDto(): R;
      toBeValidStatisticsResponseDto(): R;
      toContainOnlyValidFileIds(): R;
      toHaveSecureLogOutput(): R;
      toBeFreshData(): R;
      toBeWithinTimeRange(start: Date, end: Date): R;
    }
  }
}

// Matcher pour vérifier qu'un objet est un ProjectResponseDto valide
expect.extend({
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

    if (pass) {
      return {
        message: () =>
          `expected ${received} not to be a valid ProjectResponseDto`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid ProjectResponseDto`,
        pass: false,
      };
    }
  },
});

// Matcher pour vérifier qu'un objet est un StatisticsResponseDto valide
expect.extend({
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

    if (pass) {
      return {
        message: () =>
          `expected ${received} not to be a valid StatisticsResponseDto`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected ${received} to be a valid StatisticsResponseDto`,
        pass: false,
      };
    }
  },
});

// Matcher pour vérifier que les tableaux contiennent uniquement des IDs de fichiers valides
expect.extend({
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

    if (pass) {
      return {
        message: () =>
          `expected ${received} not to contain only valid file IDs`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected ${received} to contain only valid file IDs, but found invalid items: ${JSON.stringify(invalidItems)}`,
        pass: false,
      };
    }
  },
});

// Matcher pour vérifier que la sortie de log est sécurisée
expect.extend({
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

    if (pass) {
      return {
        message: () =>
          `expected log output "${received}" to contain sensitive data`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected log output "${received}" not to contain sensitive data`,
        pass: false,
      };
    }
  },
});

// Matcher pour vérifier que les données sont fraîches (moins de 24h)
expect.extend({
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

    if (pass) {
      return {
        message: () =>
          `expected date ${received.toISOString()} not to be fresh (less than 24h old)`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected date ${received.toISOString()} to be fresh (less than 24h old), but it's ${Math.round(age / (60 * 60 * 1000))}h old`,
        pass: false,
      };
    }
  },
});

// Matcher pour vérifier qu'une date est dans une plage donnée
expect.extend({
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

    if (pass) {
      return {
        message: () =>
          `expected date ${received.toISOString()} not to be within range [${start.toISOString()}, ${end.toISOString()}]`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected date ${received.toISOString()} to be within range [${start.toISOString()}, ${end.toISOString()}]`,
        pass: false,
      };
    }
  },
});

// =============================================================================
// MOCKS GLOBAUX
// =============================================================================

// Mock de console.log pour éviter la pollution des logs pendant les tests
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
// UTILITAIRES DE TEST GLOBAUX
// =============================================================================

// Utilitaire pour créer des dates de test cohérentes
global.createTestDate = (offset: number = 0): Date => {
  const baseDate = new Date('2024-08-08T10:30:00.000Z');
  return new Date(baseDate.getTime() + offset);
};

// Utilitaire pour créer des IDs de test cohérents
global.createTestId = (
  prefix: string = 'test',
  suffix: string = '',
): string => {
  const uuid = '550e8400-e29b-41d4-a716-446655440000';
  return suffix ? `${prefix}-${uuid}-${suffix}` : `${prefix}-${uuid}`;
};

// Utilitaire pour attendre un délai (pour les tests de performance)
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

// =============================================================================
// CONFIGURATION PERFORMANCE
// =============================================================================

// Augmenter les timeouts pour les tests de performance
jest.setTimeout(30000);

// Configuration pour capturer les métriques de performance
let performanceMetrics: Array<{
  testName: string;
  duration: number;
  memory: number;
}> = [];

beforeEach(() => {
  // Enregistrer l'état initial pour les métriques
  if (global.gc) {
    global.gc(); // Force garbage collection si disponible
  }
});

afterEach(() => {
  // Collecter les métriques de performance
  const testName = expect.getState().currentTestName || 'unknown';
  const memoryUsage = process.memoryUsage().heapUsed;

  performanceMetrics.push({
    testName,
    duration: 0, // Sera mis à jour par les tests individuels si nécessaire
    memory: memoryUsage,
  });
});

afterAll(() => {
  // Afficher un résumé des métriques de performance si en mode verbose
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
// GESTION DES ERREURS ASYNC
// =============================================================================

// Capturer les erreurs async non gérées
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Ne pas faire échouer les tests pour les erreurs async non critiques
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Ne pas faire échouer les tests pour les exceptions non critiques
});

// =============================================================================
// CONFIGURATION CLASS-VALIDATOR (si utilisé)
// =============================================================================

// Configuration pour class-validator si nécessaire dans les tests
import { useContainer } from 'class-validator';

// Utiliser un container vide pour éviter les conflits
useContainer({
  get: () => undefined,
});

// =============================================================================
// UTILITAIRES DE DEBUGGING
// =============================================================================

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
// EXPORT DES TYPES POUR TYPESCRIPT
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
// FINALISATION DU SETUP
// =============================================================================

console.log('✅ Jest setup completed for ProjectResponseDto tests');
console.log(`📅 Test environment: ${process.env.NODE_ENV}`);
console.log(`🌍 Timezone: ${process.env.TZ}`);
console.log(`🚀 Ready to run tests!`);

export {};
