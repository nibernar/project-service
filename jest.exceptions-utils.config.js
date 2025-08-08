// jest.exceptions-utils.config.js
// Configuration Jest spécialisée pour les tests d'exceptions et utilitaires

module.exports = {
  // Configuration de base héritée
  ...require('./jest.config.js'),

  // Override spécifique pour les tests d'exceptions et utilitaires
  displayName: {
    name: 'Exceptions & Utils Tests',
    color: 'red',
  },

  // Patterns de test spécifiques aux exceptions et utilitaires
  testMatch: [
    '<rootDir>/test/unit/common/exceptions/**/*.spec.ts',
    '<rootDir>/test/unit/common/utils/**/*.spec.ts'
  ],

  // Couverture spécifique aux exceptions et utilitaires
  collectCoverageFrom: [
    'src/common/exceptions/**/*.ts',
    'src/common/utils/**/*.ts',
    '!src/common/exceptions/index.ts',
    '!src/common/utils/index.ts',
    '!src/**/*.d.ts',
    '!src/**/*.spec.ts',
    '!src/**/*.test.ts',
  ],

  // Seuils de couverture stricts pour ces composants critiques
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 95,
      lines: 95,
      statements: 95
    },
    // Seuils spécifiques par fichier
    './src/common/exceptions/project-not-found.exception.ts': {
      branches: 95,
      functions: 100,
      lines: 95,
      statements: 95
    },
    './src/common/exceptions/unauthorized-access.exception.ts': {
      branches: 90,
      functions: 95,
      lines: 95,
      statements: 95
    },
    './src/common/utils/validation.utils.ts': {
      branches: 92,
      functions: 95,
      lines: 95,
      statements: 95
    }
  },

  // Configuration spécifique pour les tests d'exceptions et utilitaires
  testEnvironment: 'node',
  
  // Timeout pour les tests incluant des tests de performance
  testTimeout: 10000,

  // Setup spécifique pour les tests d'exceptions et utilitaires (pas de dépendances externes)
  setupFilesAfterEnv: [
    '<rootDir>/test/setup/exceptions-test-setup.ts',
  ],

  // Verbose pour voir tous les tests
  verbose: true,

  // Configuration de la couverture
  collectCoverage: true,
  coverageDirectory: '<rootDir>/coverage/exceptions-utils',
  coverageReporters: ['text', 'lcov', 'html', 'cobertura'],

  // Cache pour accélérer les re-runs
  cacheDirectory: '<rootDir>/node_modules/.cache/jest/exceptions-utils',

  // Configuration pour la détection des fuites mémoire
  detectOpenHandles: false,
  forceExit: false,
  
  // Configuration pour les tests de performance
  maxWorkers: '50%',
  
  // Bail sur le premier échec (désactivé pour voir tous les résultats)
  bail: false,

  // Configuration avancée
  errorOnDeprecated: true,
  
  // Module mapper pour les alias TypeScript
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@common/(.*)$': '<rootDir>/src/common/$1',
    '^@test/(.*)$': '<rootDir>/test/$1',
  },

  // Transform TypeScript avec ts-jest
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', {
      useESM: false,
      isolatedModules: false,
      tsconfig: {
        target: 'ES2020',
        module: 'CommonJS',
        moduleResolution: 'node',
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
        experimentalDecorators: true,
        emitDecoratorMetadata: true,
        resolveJsonModule: true,
        allowSyntheticDefaultImports: true,
      },
    }],
  },

  // Extensions de fichiers reconnues
  moduleFileExtensions: ['js', 'json', 'ts'],

  // Racines pour la résolution des modules
  roots: ['<rootDir>/src', '<rootDir>/test'],

  // Configuration des seuils de performance
  slowTestThreshold: 5,

  // Pattern pour ignorer certains fichiers
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/dist/',
    '<rootDir>/coverage/',
  ],

  // Variables d'environnement pour les tests
  testEnvironmentOptions: {
    NODE_ENV: 'test',
  },

  // Nettoyage automatique entre les tests
  clearMocks: true,
  restoreMocks: true,
  resetMocks: true,

  // Hooks pour les tests - DÉSACTIVÉS (pas de base de données nécessaire pour ces tests)
  // globalSetup: '<rootDir>/test/setup/global-setup.ts',
  // globalTeardown: '<rootDir>/test/setup/global-teardown.ts',

  // Configuration des reporters pour un output détaillé
  reporters: ['default'],

  // Configuration pour les tests regex
  // testRegex: '(/__tests__/.*|(\\.|/)(test|spec))\\.(jsx?|tsx?)

  // Configuration pour éviter les warnings de dépréciations
  testRunner: 'jest-circus/runner',

  // Configuration pour les transformations
  transformIgnorePatterns: [
    '/node_modules/(?!.*\\.mjs$)',
  ],

  // Configuration pour les watch mode
  watchPathIgnorePatterns: [
    '<rootDir>/coverage/',
    '<rootDir>/dist/',
    '<rootDir>/node_modules/',
  ],

  // Configuration pour les tests parallèles
  workerIdleMemoryLimit: '512MB',

  // Configuration pour éviter les warnings de dépréciations
  testRunner: 'jest-circus/runner',

  // Configuration pour les transformations
  transformIgnorePatterns: [
    '/node_modules/(?!.*\\.mjs$)',
  ],

  // Configuration pour les watch mode
  watchPathIgnorePatterns: [
    '<rootDir>/coverage/',
    '<rootDir>/dist/',
    '<rootDir>/node_modules/',
  ],

  // Configuration pour les tests parallèles
  workerIdleMemoryLimit: '512MB',
};