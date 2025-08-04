// test/setup/auth-guard-test-setup.ts

import 'reflect-metadata';

// ============================================================================
// CONFIGURATION GLOBALE DES TESTS AUTHGUARD
// ============================================================================

// Configuration des timeouts pour les tests longs
jest.setTimeout(30000);

// Configuration des variables d'environnement pour les tests
process.env.NODE_ENV = 'test';
process.env.AUTH_SERVICE_URL = 'http://localhost:3001';
process.env.AUTH_SERVICE_TIMEOUT = '5000';
process.env.AUTH_CACHE_TTL = '300';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';

// ============================================================================
// MOCKS GLOBAUX
// ============================================================================

// Mock global pour les métriques de performance
global.recordPerformanceMetric = jest.fn((name: string, value: any, metadata?: any) => {
  // Stocker les métriques pour analyse
  if (!(global as any).performanceMetrics) {
    (global as any).performanceMetrics = [];
  }
  (global as any).performanceMetrics.push({
    name,
    value,
    metadata,
    timestamp: Date.now(),
  });
});

// Mock global pour le garbage collector (si disponible)
if (typeof global.gc === 'undefined') {
  global.gc = jest.fn();
}

// ============================================================================
// HELPERS GLOBAUX POUR LES TESTS
// ============================================================================

// Helper pour créer des tokens de test valides
global.createTestToken = (payload: any = {}) => {
  const header = { alg: 'HS256', typ: 'JWT' };
  const defaultPayload = {
    sub: 'test-user-123',
    email: 'test@example.com',
    roles: ['user'],
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...payload,
  };

  const headerEncoded = Buffer.from(JSON.stringify(header)).toString('base64url');
  const payloadEncoded = Buffer.from(JSON.stringify(defaultPayload)).toString('base64url');
  const signature = 'test-signature';

  return `${headerEncoded}.${payloadEncoded}.${signature}`;
};

// Helper pour créer des utilisateurs de test
global.createTestUser = (overrides: any = {}) => ({
  id: 'test-user-123',
  email: 'test@example.com',
  roles: ['user'],
  ...overrides,
});

// Helper pour créer des réponses d'authentification de test
global.createTestAuthResponse = (user: any = global.createTestUser()) => ({
  data: {
    valid: true,
    user: {
      id: user.id,
      email: user.email,
      roles: user.roles,
    },
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
  },
  status: 200,
  statusText: 'OK',
  headers: {},
  config: {} as any,
});

// Helper pour mesurer les performances
global.measurePerformance = async (fn: () => Promise<any>): Promise<{ result: any; duration: number; memory: any }> => {
  const startTime = process.hrtime.bigint();
  const startMemory = process.memoryUsage();
  
  const result = await fn();
  
  const endTime = process.hrtime.bigint();
  const endMemory = process.memoryUsage();
  
  const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
  const memory = {
    heapUsed: endMemory.heapUsed - startMemory.heapUsed,
    heapTotal: endMemory.heapTotal - startMemory.heapTotal,
    external: endMemory.external - startMemory.external,
  };

  return { result, duration, memory };
};

// Helper pour attendre de manière asynchrone
global.waitFor = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

// Helper pour créer des mocks de ExecutionContext
global.createMockExecutionContext = (request: any) => ({
  switchToHttp: () => ({
    getRequest: () => request,
    getResponse: jest.fn(),
    getNext: jest.fn(),
  }),
  switchToRpc: jest.fn(),
  switchToWs: jest.fn(),
  getType: () => 'http' as const,
  getClass: jest.fn(),
  getHandler: jest.fn(),
  getArgs: jest.fn(),
  getArgByIndex: jest.fn(),
});

// ============================================================================
// CONFIGURATION DES ERREURS NON CAPTURÉES
// ============================================================================

// Gestionnaire pour les rejections non gérées
const unhandledRejections = new Set();
process.on('unhandledRejection', (reason, promise) => {
  unhandledRejections.add(promise);
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('rejectionHandled', (promise) => {
  unhandledRejections.delete(promise);
});

// Vérifier qu'il n'y a pas de rejections non gérées après chaque test
afterEach(() => {
  if (unhandledRejections.size > 0) {
    console.warn(`Warning: ${unhandledRejections.size} unhandled promise rejections detected`);
    unhandledRejections.clear();
  }
});

// ============================================================================
// CONFIGURATION DES MOCKS AXIOS
// ============================================================================

// Mock global pour les erreurs Axios communes
global.createAxiosError = (message: string, code: string, status?: number) => {
  const error: any = new Error(message);
  error.isAxiosError = true;
  error.code = code;
  error.response = status ? {
    status,
    statusText: message,
    data: { error: message },
    headers: {},
    config: {},
  } : undefined;
  return error;
};

// ============================================================================
// CONFIGURATION DU NETTOYAGE
// ============================================================================

// Nettoyage après chaque test
afterEach(async () => {
  // Nettoyer les métriques de performance
  if ((global as any).performanceMetrics) {
    (global as any).performanceMetrics = [];
  }
  
  // Forcer le garbage collection si disponible
  if (global.gc && typeof global.gc === 'function') {
    global.gc();
  }
  
  // Nettoyer les variables d'environnement modifiées
  process.env.NODE_ENV = 'test';
  
  // Attendre un peu pour permettre aux opérations asynchrones de se terminer
  await new Promise(resolve => setImmediate(resolve));
});

// Nettoyage après tous les tests
afterAll(async () => {
  // Nettoyer les listeners d'événements
  process.removeAllListeners('unhandledRejection');
  process.removeAllListeners('rejectionHandled');
  
  // Attendre que toutes les promesses en attente se terminent
  await new Promise(resolve => setTimeout(resolve, 100));
});

// ============================================================================
// CONFIGURATION DES MATCHERS JEST PERSONNALISÉS
// ============================================================================

// Matcher personnalisé pour vérifier les tokens JWT
expect.extend({
  toBeValidJWTFormat(received: string) {
    const jwtRegex = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
    const pass = typeof received === 'string' && jwtRegex.test(received);
    
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid JWT format`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid JWT format`,
        pass: false,
      };
    }
  },
});

// Matcher personnalisé pour vérifier les clés de cache
expect.extend({
  toBeValidCacheKey(received: string) {
    const cacheKeyRegex = /^auth:token:[a-f0-9]{64}$/;
    const pass = typeof received === 'string' && cacheKeyRegex.test(received);
    
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid cache key format`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid cache key format (auth:token:[64-char-hex])`,
        pass: false,
      };
    }
  },
});

// Matcher personnalisé pour vérifier les performances
expect.extend({
  toBeWithinPerformanceThreshold(received: number, threshold: number) {
    const pass = received <= threshold;
    
    if (pass) {
      return {
        message: () => `expected ${received}ms to exceed performance threshold of ${threshold}ms`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received}ms to be within performance threshold of ${threshold}ms`,
        pass: false,
      };
    }
  },
});

// Matcher personnalisé pour vérifier les objets User
expect.extend({
  toBeValidUser(received: any) {
    const isValid = received && 
                   typeof received.id === 'string' && 
                   typeof received.email === 'string' && 
                   Array.isArray(received.roles) &&
                   received.id.length > 0 &&
                   received.email.includes('@') &&
                   received.roles.every((role: any) => typeof role === 'string');
    
    if (isValid) {
      return {
        message: () => `expected ${JSON.stringify(received)} not to be a valid user object`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${JSON.stringify(received)} to be a valid user object with id, email, and roles`,
        pass: false,
      };
    }
  },
});

// ============================================================================
// CONFIGURATION DES LOGS DE TEST
// ============================================================================

// Configuration du niveau de log pour les tests
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

// Filtrer les logs pendant les tests sauf si explicitement activés
if (!process.env.JEST_VERBOSE_LOGS) {
  console.log = (...args) => {
    if (args[0]?.includes && (args[0].includes('TEST_LOG') || args[0].includes('📊'))) {
      originalConsoleLog(...args);
    }
  };
  
  console.error = (...args) => {
    if (args[0]?.includes && args[0].includes('TEST_ERROR')) {
      originalConsoleError(...args);
    }
  };
  
  console.warn = (...args) => {
    if (args[0]?.includes && args[0].includes('TEST_WARN')) {
      originalConsoleWarn(...args);
    }
  };
}

// Restaurer les logs après les tests
afterAll(() => {
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

// ============================================================================
// CONFIGURATION DES TYPES TYPESCRIPT POUR LES HELPERS GLOBAUX
// ============================================================================

declare global {
  function recordPerformanceMetric(name: string, value: any, metadata?: any): void;
  function createTestToken(payload?: any): string;
  function createTestUser(overrides?: any): any;
  function createTestAuthResponse(user?: any): any;
  function measurePerformance(fn: () => Promise<any>): Promise<{ result: any; duration: number; memory: any }>;
  function waitFor(ms: number): Promise<void>;
  function createMockExecutionContext(request: any): any;
  function createAxiosError(message: string, code: string, status?: number): any;
  
  namespace jest {
    interface Matchers<R> {
      toBeValidJWTFormat(): R;
      toBeValidCacheKey(): R;
      toBeWithinPerformanceThreshold(threshold: number): R;
      toBeValidUser(): R;
    }
  }
  
  var performanceMetrics: Array<{
    name: string;
    value: any;
    metadata?: any;
    timestamp: number;
  }>;
}

export {};