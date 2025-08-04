// test/setup/current-user-test-setup.ts

import { ExecutionContext } from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { User } from '../../src/common/interfaces/user.interface';

/**
 * Configuration de test globale pour CurrentUser Decorator
 */

// ============================================================================
// TYPES ET INTERFACES
// ============================================================================

// Interface étendue pour FastifyRequest avec la propriété user
interface FastifyRequestWithUser extends FastifyRequest {
  user?: User | null | undefined;
}

export interface MockExecutionContextOptions {
  user?: User | null | undefined;
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  body?: any;
  params?: Record<string, string>;
  query?: Record<string, string>;
  ip?: string;
  additionalProperties?: Record<string, any>;
}

export interface PerformanceMetrics {
  executionTime: number;
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
  iterations: number;
  averageTime: number;
}

export interface UserTestVariants {
  minimal: User;
  typical: User;
  complex: User;
  large: User;
  unicode: User;
  empty: User;
}

// ============================================================================
// FACTORIES DE CRÉATION D'OBJETS DE TEST
// ============================================================================

/**
 * Crée un mock d'ExecutionContext pour les tests
 * TEMPORAIRE: Accepte n'importe quel format pour compatibilité avec les tests existants
 */
export const createMockExecutionContext = (options: any = {}): ExecutionContext => {
  const mockRequest: any = {
    user: options.user,
    method: options.method || 'GET',
    url: options.url || '/test',
    headers: options.headers || {},
    body: options.body,
    params: options.params || {},
    query: options.query || {},
    ip: options.ip || '127.0.0.1',
    ...options
  };

  return {
    switchToHttp: () => ({
      getRequest: () => mockRequest as FastifyRequest,
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

/**
 * Crée différentes variantes d'utilisateurs pour les tests
 */
export const createUserVariants = (): UserTestVariants => ({
  minimal: {
    id: 'min-user',
    email: 'min@test.com',
    roles: [],
  },
  typical: {
    id: 'user-550e8400-e29b-41d4-a716-446655440000',
    email: 'john.doe@company.com',
    roles: ['user', 'reader', 'contributor'],
  },
  complex: {
    id: 'complex-user-123',
    email: 'complex.user@enterprise.com',
    roles: ['user', 'admin', 'project:read', 'project:write', 'org:manage'],
  },
  large: {
    id: 'large-user-with-many-roles',
    email: 'large.user@example.com',
    roles: Array.from({ length: 100 }, (_, i) => `role-${i}`),
  },
  unicode: {
    id: 'unicode-用户-🚀',
    email: '用户@例子.中国',
    roles: ['rôle-français', 'роль-русский', 'ロール-日本語'],
  },
  empty: {
    id: '',
    email: '',
    roles: [],
  },
});

/**
 * Crée un utilisateur de test avec surcharges personnalisées
 */
export const createTestUser = (overrides: Partial<User> = {}): User => ({
  id: 'test-user-123',
  email: 'test@example.com',
  roles: ['user'],
  ...overrides,
});

/**
 * Crée un utilisateur avec propriétés étendues (pour tests de propriétés additionnelles)
 */
export const createExtendedUser = (baseUser?: Partial<User>, extensions?: Record<string, any>) => ({
  ...createTestUser(baseUser),
  ...extensions,
});

// ============================================================================
// HELPERS DE VALIDATION ET ASSERTION
// ============================================================================

/**
 * Valide qu'un objet respecte l'interface User
 */
export const assertValidUser = (user: any): asserts user is User => {
  expect(user).toHaveProperty('id');
  expect(user).toHaveProperty('email');
  expect(user).toHaveProperty('roles');
  expect(typeof user.id).toBe('string');
  expect(typeof user.email).toBe('string');
  expect(Array.isArray(user.roles)).toBe(true);
};

/**
 * Valide l'intégrité des données utilisateur
 */
export const assertUserIntegrity = (original: User, extracted: User) => {
  expect(extracted).toEqual(original);
  expect(extracted.id).toBe(original.id);
  expect(extracted.email).toBe(original.email);
  expect(extracted.roles).toEqual(original.roles);
};

/**
 * Valide qu'une erreur de décorateur est correcte
 */
export const assertDecoratorError = (error: any, expectedMessage?: string) => {
  expect(error).toBeInstanceOf(Error);
  if (expectedMessage) {
    expect(error.message).toContain(expectedMessage);
  } else {
    expect(error.message).toContain('User not found in request context');
  }
};

/**
 * Valide qu'un ExecutionContext est valide
 */
export const assertValidExecutionContext = (context: ExecutionContext) => {
  expect(context).toBeDefined();
  expect(typeof context.switchToHttp).toBe('function');
  expect(typeof context.getType).toBe('function');
};

// ============================================================================
// HELPERS DE PERFORMANCE
// ============================================================================

/**
 * Mesure le temps d'exécution d'une fonction
 */
export const measureExecutionTime = (fn: () => void, iterations: number = 1): number => {
  const startTime = process.hrtime.bigint();
  for (let i = 0; i < iterations; i++) {
    fn();
  }
  const endTime = process.hrtime.bigint();
  return Number(endTime - startTime) / 1000000; // Convert to milliseconds
};

/**
 * Mesure l'utilisation mémoire d'une fonction
 */
export const measureMemoryUsage = (fn: () => void): PerformanceMetrics['memoryUsage'] => {
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

/**
 * Effectue un benchmark complet d'une fonction
 */
export const benchmarkFunction = (
  fn: () => void, 
  options: { iterations?: number; warmup?: number } = {}
): PerformanceMetrics => {
  const { iterations = 1000, warmup = 100 } = options;
  
  // Warmup
  for (let i = 0; i < warmup; i++) {
    fn();
  }
  
  // Measurement
  const executionTime = measureExecutionTime(fn, iterations);
  const memoryUsage = measureMemoryUsage(() => {
    for (let i = 0; i < iterations; i++) {
      fn();
    }
  });
  
  return {
    executionTime,
    memoryUsage,
    iterations,
    averageTime: executionTime / iterations,
  };
};

/**
 * Valide les métriques de performance
 */
export const assertPerformanceMetrics = (
  metrics: PerformanceMetrics, 
  expectations: { 
    maxAverageTime?: number;
    maxTotalTime?: number;
    maxMemoryUsage?: number;
  }
) => {
  if (expectations.maxAverageTime) {
    expect(metrics.averageTime).toBeLessThan(expectations.maxAverageTime);
  }
  if (expectations.maxTotalTime) {
    expect(metrics.executionTime).toBeLessThan(expectations.maxTotalTime);
  }
  if (expectations.maxMemoryUsage) {
    expect(Math.abs(metrics.memoryUsage.heapUsed)).toBeLessThan(expectations.maxMemoryUsage);
  }
};

// ============================================================================
// HELPERS DE STRESS TEST
// ============================================================================

/**
 * Générateur de contextes d'exécution aléatoires
 */
export const generateRandomExecutionContexts = (count: number): ExecutionContext[] => {
  const userVariants = createUserVariants();
  const variants = Object.values(userVariants);
  
  return Array.from({ length: count }, (_, i) => {
    const user = variants[i % variants.length];
    return createMockExecutionContext({
      user,
      method: ['GET', 'POST', 'PUT', 'DELETE'][i % 4],
      url: `/api/endpoint-${i}`,
      headers: { 
        authorization: `Bearer token-${i}`,
        'user-agent': `TestAgent/${i}`
      }
    });
  });
};

/**
 * Stress test avec différents types d'utilisateurs
 */
export const runStressTest = (
  extractFunction: (data: any, context: ExecutionContext) => User,
  options: { 
    iterations?: number;
    concurrency?: number;
    userTypes?: ('minimal' | 'typical' | 'complex' | 'large')[];
  } = {}
): PerformanceMetrics => {
  const { iterations = 1000, concurrency = 1, userTypes = ['typical'] } = options;
  const userVariants = createUserVariants();
  
  const contexts = Array.from({ length: iterations }, (_, i) => {
    const userType = userTypes[i % userTypes.length];
    const user = userVariants[userType];
    return createMockExecutionContext({ user });
  });
  
  return benchmarkFunction(() => {
    contexts.forEach(context => {
      extractFunction(undefined, context);
    });
  }, { iterations: 1, warmup: 0 }); // Single iteration because we loop inside
};

// ============================================================================
// HELPERS DE SÉCURITÉ
// ============================================================================

/**
 * Crée des objets utilisateur malveillants pour tests de sécurité
 */
export const createMaliciousUsers = () => ({
  xssUser: createTestUser({
    id: '<script>alert("XSS")</script>',
    email: 'javascript:alert(1)@example.com',
    roles: ['<img src=x onerror=alert(1)>'],
  }),
  sqlInjectionUser: createTestUser({
    id: "'; DROP TABLE users; --",
    email: "admin'--@example.com",
    roles: ["'; DELETE FROM roles; --"],
  }),
  commandInjectionUser: createTestUser({
    id: '$(rm -rf /)',
    email: '`cat /etc/passwd`@example.com',
    roles: ['user; cat /etc/shadow'],
  }),
  oversizedUser: createTestUser({
    id: 'x'.repeat(10000),
    email: 'x'.repeat(1000) + '@example.com',
    roles: Array.from({ length: 10000 }, (_, i) => `role-${i}`),
  }),
});

/**
 * Crée des contextes corrompus pour tests de robustesse
 */
export const createCorruptedContexts = () => ({
  nullRequest: {
    switchToHttp: () => ({
      getRequest: () => null,
      getResponse: jest.fn(),
      getNext: jest.fn(),
    }),
  } as any,
  undefinedUser: createMockExecutionContext({ user: undefined }),
  nullUser: createMockExecutionContext({ user: null }),
  emptyStringUser: createMockExecutionContext({ user: '' as any }),
  numberUser: createMockExecutionContext({ user: 123 as any }),
  functionUser: createMockExecutionContext({ user: (() => {}) as any }),
});

// ============================================================================
// CONFIGURATION JEST SETUP
// ============================================================================

// Configuration globale avant tous les tests
beforeAll(() => {
  // Configuration des timeouts pour les tests de performance
  jest.setTimeout(30000);
  
  // Configuration de la mémoire pour les tests de stress
  if (global.gc) {
    global.gc(); // Initial cleanup
  }
});

// Configuration avant chaque test
beforeEach(() => {
  // Reset des mocks
  jest.clearAllMocks();
  
  // Nettoyage des variables globales si nécessaire
  delete (global as any).testMetrics;
});

// Configuration après chaque test
afterEach(() => {
  // Nettoyage spécifique aux tests de décorateur
  jest.restoreAllMocks();
});

// Configuration après tous les tests
afterAll(() => {
  // Nettoyage final de la mémoire
  if (global.gc) {
    global.gc();
  }
});

// ============================================================================
// EXPORTS POUR UTILISATION DANS LES TESTS
// ============================================================================

export const CurrentUserTestUtils = {
  // Factories
  createMockExecutionContext,
  createUserVariants,
  createTestUser,
  createExtendedUser,
  createMaliciousUsers,
  createCorruptedContexts,
  
  // Validators
  assertValidUser,
  assertUserIntegrity,
  assertDecoratorError,
  assertValidExecutionContext,
  
  // Performance
  measureExecutionTime,
  measureMemoryUsage,
  benchmarkFunction,
  assertPerformanceMetrics,
  
  // Stress testing
  generateRandomExecutionContexts,
  runStressTest,
};

// Export par défaut pour compatibilité
export default CurrentUserTestUtils;

// ============================================================================
// CONSTANTES POUR LES TESTS
// ============================================================================

export const TEST_CONSTANTS = {
  PERFORMANCE_THRESHOLDS: {
    SINGLE_CALL_MAX_TIME: 1, // ms
    BURST_CALL_MAX_TIME: 0.1, // ms per call
    SUSTAINED_CALL_MAX_TIME: 0.005, // ms per call
    MAX_MEMORY_USAGE: 1024 * 1024, // 1MB
  },
  
  STRESS_TEST_DEFAULTS: {
    ITERATIONS: 1000,
    CONCURRENCY: 10,
    TIMEOUT: 30000, // ms
  },
  
  SECURITY_TEST_PATTERNS: {
    XSS_PATTERNS: [
      '<script>alert("XSS")</script>',
      'javascript:alert(1)',
      '<img src=x onerror=alert(1)>',
      '"><script>alert(document.cookie)</script>',
    ],
    SQL_INJECTION_PATTERNS: [
      "'; DROP TABLE users; --",
      "' OR 1=1 --",
      "'; DELETE FROM roles; --",
      "' UNION SELECT * FROM passwords --",
    ],
    COMMAND_INJECTION_PATTERNS: [
      '$(rm -rf /)',
      '`cat /etc/passwd`',
      '; cat /etc/shadow',
      '| nc -l 4444',
    ],
  },
} as const;