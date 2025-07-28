/**
 * Setup spécialisé pour les tests du module project-status.enum.ts
 * 
 * Ce fichier configure l'environnement de test pour garantir des conditions
 * optimales et cohérentes pour tous les tests d'enum.
 * 
 * @fileoverview Setup des tests ProjectStatus enum
 */

// Polyfills et extensions globales
if (!global.performance) {
  global.performance = require('perf_hooks').performance;
}

// Matcher personnalisés pour Jest
expect.extend({
  /**
   * Matcher pour vérifier qu'une couleur est un hex valide
   */
  toBeValidHexColor(received: string) {
    const pass = /^#[0-9A-F]{6}$/i.test(received);
    
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid hex color`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid hex color (format: #RRGGBB)`,
        pass: false,
      };
    }
  },

  /**
   * Matcher pour vérifier qu'un objet est une métadonnée valide de statut
   */
  toBeValidStatusMetadata(received: any) {
    const requiredProperties = ['status', 'label', 'description', 'color', 'allowedTransitions'];
    const missingProperties = requiredProperties.filter(prop => !(prop in received));
    
    if (missingProperties.length === 0) {
      const colorValid = /^#[0-9A-F]{6}$/i.test(received.color);
      const transitionsValid = Array.isArray(received.allowedTransitions);
      
      if (colorValid && transitionsValid) {
        return {
          message: () => `expected ${JSON.stringify(received)} not to be valid status metadata`,
          pass: true,
        };
      } else {
        return {
          message: () => `expected ${JSON.stringify(received)} to have valid color and transitions array`,
          pass: false,
        };
      }
    } else {
      return {
        message: () => `expected ${JSON.stringify(received)} to have properties: ${missingProperties.join(', ')}`,
        pass: false,
      };
    }
  },

  /**
   * Matcher pour vérifier les performances
   */
  toCompleteWithin(received: () => void, expectedTime: number) {
    const startTime = performance.now();
    received();
    const endTime = performance.now();
    const actualTime = endTime - startTime;
    
    const pass = actualTime <= expectedTime;
    
    if (pass) {
      return {
        message: () => `expected function to take more than ${expectedTime}ms but took ${actualTime.toFixed(2)}ms`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected function to complete within ${expectedTime}ms but took ${actualTime.toFixed(2)}ms`,
        pass: false,
      };
    }
  },
});

// Extension des types Jest pour nos matchers personnalisés
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidHexColor(): R;
      toBeValidStatusMetadata(): R;
      toCompleteWithin(expectedTime: number): R;
    }
  }
}

// Configuration des timeouts par défaut
jest.setTimeout(10000); // 10 secondes pour les tests normaux

// Mock des dépendances externes si nécessaire
jest.mock('@prisma/client', () => ({
  ProjectStatus: {
    ACTIVE: 'ACTIVE',
    ARCHIVED: 'ARCHIVED',
    DELETED: 'DELETED',
  },
}), { virtual: true });

// Configuration des variables d'environnement pour les tests
process.env.NODE_ENV = 'test';

// Helpers globaux pour les tests
declare global {
  var testHelpers: {
    createMockStatus: () => string;
    generateRandomString: (length: number) => string;
    createPerformanceTest: (fn: Function, iterations: number) => Promise<number>;
    createMemoryTest: (fn: Function, iterations: number) => Promise<{ initial: number; final: number; diff: number }>;
  };
}

global.testHelpers = {
  /**
   * Crée un statut mock aléatoire pour les tests
   */
  createMockStatus(): string {
    const mockStatuses = ['MOCK_STATUS', 'TEST_STATUS', 'INVALID_STATUS'];
    return mockStatuses[Math.floor(Math.random() * mockStatuses.length)];
  },

  /**
   * Génère une chaîne aléatoire de la longueur spécifiée
   */
  generateRandomString(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  },

  /**
   * Teste les performances d'une fonction
   */
  async createPerformanceTest(fn: Function, iterations: number): Promise<number> {
    // Warm-up
    for (let i = 0; i < 100; i++) {
      fn();
    }

    // Test réel
    const startTime = performance.now();
    for (let i = 0; i < iterations; i++) {
      fn();
    }
    const endTime = performance.now();

    return endTime - startTime;
  },

  /**
   * Teste l'utilisation de la mémoire d'une fonction
   */
  async createMemoryTest(fn: Function, iterations: number): Promise<{ initial: number; final: number; diff: number }> {
    // Force garbage collection si disponible
    if (global.gc) {
      global.gc();
    }

    const initialMemory = process.memoryUsage().heapUsed;

    for (let i = 0; i < iterations; i++) {
      fn();
    }

    // Force garbage collection si disponible
    if (global.gc) {
      global.gc();
    }

    const finalMemory = process.memoryUsage().heapUsed;

    return {
      initial: initialMemory,
      final: finalMemory,
      diff: finalMemory - initialMemory,
    };
  },
};

// Configuration du nettoyage après chaque test
afterEach(() => {
  // Nettoyer les mocks si nécessaire
  jest.clearAllMocks();
  
  // Nettoyer les variables globales modifiées
  delete (global as any).maliciousCode;
  delete (global as any).maliciousValueOf;
  delete (Object.prototype as any).polluted;
  delete (Array.prototype as any).polluted;
  delete (String.prototype as any).polluted;
});

// Configuration du nettoyage après toute la suite
afterAll(() => {
  // Nettoyage final
  jest.restoreAllMocks();
});

// Configuration pour capturer les erreurs non gérées
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeAll(() => {
  // Capturer les erreurs pour éviter le spam dans les tests de sécurité
  console.error = jest.fn();
  console.warn = jest.fn();
});

afterAll(() => {
  // Restaurer les consoles originales
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

// Utilitaires de test pour les cas spéciaux
export const TestUtils = {
  /**
   * Crée un objet avec toString malveillant
   */
  createMaliciousToString(returnValue: string): any {
    return {
      toString() {
        try {
          // Tenter d'exécuter du code malveillant
          eval('global.maliciousCode = true');
        } catch (e) {
          // Ignore les erreurs
        }
        return returnValue;
      },
    };
  },

  /**
   * Crée un objet avec valueOf malveillant
   */
  createMaliciousValueOf(returnValue: string): any {
    return {
      valueOf() {
        try {
          eval('global.maliciousValueOf = true');
        } catch (e) {
          // Ignore les erreurs
        }
        return returnValue;
      },
      toString() {
        return returnValue;
      },
    };
  },

  /**
   * Crée un objet circulaire pour tester la gestion des références
   */
  createCircularObject(): any {
    const obj: any = { value: 'test' };
    obj.self = obj;
    obj.toString = () => 'ACTIVE';
    return obj;
  },

  /**
   * Simule des conditions de faible mémoire
   */
  simulateLowMemory(): void {
    // Allouer beaucoup de mémoire
    const arrays: any[] = [];
    try {
      for (let i = 0; i < 1000; i++) {
        arrays.push(new Array(10000).fill('memory_pressure'));
      }
    } catch (error) {
      // C'est attendu en cas de manque de mémoire
    }
  },

  /**
   * Nettoie la pollution de prototype
   */
  cleanPrototypePollution(): void {
    delete (Object.prototype as any).polluted;
    delete (Array.prototype as any).polluted;
    delete (String.prototype as any).polluted;
    delete (Function.prototype as any).polluted;
  },

  /**
   * Crée une suite de tests de performance standardisée
   */
  createPerformanceSuite(name: string, fn: Function, expectedTime: number, iterations = 10000): void {
    describe(`${name} Performance`, () => {
      it(`should complete ${iterations} iterations within ${expectedTime}ms`, async () => {
        const actualTime = await global.testHelpers.createPerformanceTest(fn, iterations);
        expect(actualTime).toBeLessThan(expectedTime);
      });

      it(`should not leak memory over ${iterations} iterations`, async () => {
        const memoryResult = await global.testHelpers.createMemoryTest(fn, iterations);
        
        // La mémoire ne devrait pas augmenter de plus de 10MB
        expect(memoryResult.diff).toBeLessThan(10 * 1024 * 1024);
      });
    });
  },
};

// Export pour utilisation dans les tests
export default TestUtils;