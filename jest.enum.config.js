// jest.enum.config.js
// Configuration Jest spécialisée pour les tests du module project-status.enum.ts

module.exports = {
  // Configuration de base héritée
  ...require('./jest.config.js'),

  // Override spécifique pour les tests d'enum
  displayName: {
    name: 'ProjectStatus Enum Tests',
    color: 'blue',
  },

  // Patterns de test spécifiques aux enums
  testMatch: [
    '<rootDir>/test/unit/common/enums/**/*.spec.ts',
    '<rootDir>/test/integration/**/project-status.enum.*.spec.ts',
  ],

  // Couverture spécifique au module enum
  collectCoverageFrom: [
    'src/common/enums/project-status.enum.ts',
  ],

  // Seuils de couverture stricts pour ce module critique
  coverageThreshold: {
    global: {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
    'src/common/enums/project-status.enum.ts': {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
  },

  // Configuration spécifique pour les tests d'enum
  testEnvironment: 'node',
  
  // Timeout plus long pour les tests de performance
  testTimeout: 10000,

  // Setup spécifique pour les tests d'enum
  setupFilesAfterEnv: [
    '<rootDir>/test/setup/enum-test-setup.ts',
  ],

  // Verbose pour voir tous les tests
  verbose: true,

  // Grouper les tests par type
  reporters: [
    'default',
    [
      'jest-html-reporters',
      {
        publicPath: './test-results/enum',
        filename: 'enum-test-report.html',
        pageTitle: 'ProjectStatus Enum Test Report',
        openReport: false,
        expand: true,
        hideIcon: false,
        includeFailureMsg: true,
        includeSuiteFailure: true,
      },
    ],
    [
      'jest-junit',
      {
        outputDirectory: './test-results/enum',
        outputName: 'enum-tests.xml',
        suiteName: 'ProjectStatus Enum Tests',
        classNameTemplate: '{classname}',
        titleTemplate: '{title}',
        ancestorSeparator: ' > ',
        usePathForSuiteName: true,
      },
    ],
  ],

  // Cache pour accélérer les re-runs
  cacheDirectory: '<rootDir>/node_modules/.cache/jest/enum',

  // Configuration pour la détection des fuites mémoire
  detectOpenHandles: true,
  forceExit: false,
  
  // Configuration pour les tests de performance
  maxWorkers: 1, // Single worker pour les tests de performance cohérents
  
  // Bail sur le premier échec pour les tests critiques
  bail: false, // Laisser tous les tests s'exécuter pour voir toutes les erreurs

  // Configuration avancée pour les edge cases
  errorOnDeprecated: true,
  
  // Module mapper pour les alias TypeScript
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@test/(.*)$': '<rootDir>/test/$1',
  },

  // Transform TypeScript avec ts-jest
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },

  // Extensions de fichiers reconnues
  moduleFileExtensions: ['js', 'json', 'ts'],

  // Configuration ts-jest spécifique
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

  // Hooks pour les tests de performance et de sécurité
  globalSetup: '<rootDir>/test/setup/global-setup.ts',
  globalTeardown: '<rootDir>/test/setup/global-teardown.ts',
};