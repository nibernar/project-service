// jest.config.pagination.js
// Configuration Jest spécialisée pour les tests de pagination

module.exports = {
  // Configuration de base héritée
  ...require('./jest.config.js'),

  // Override spécifique pour les tests de pagination
  displayName: {
    name: 'Pagination Tests',
    color: 'green',
  },

  // Patterns de test spécifiques à la pagination
  testMatch: [
    '<rootDir>/test/unit/common/interfaces/paginated-result.interface.spec.ts',
    '<rootDir>/test/unit/common/interfaces/pagination-performance.spec.ts',
    '<rootDir>/test/unit/common/interfaces/pagination-integration.spec.ts', 
    '<rootDir>/test/unit/common/interfaces/pagination-security.spec.ts',
    '<rootDir>/test/unit/common/interfaces/pagination-e2e.spec.ts',
    '<rootDir>/test/unit/common/interfaces/pagination-regression.spec.ts',
  ],

  // Couverture spécifique au module pagination
  collectCoverageFrom: [
    'src/common/interfaces/paginated-result.interface.ts',
    '!src/**/*.d.ts',
    '!src/**/*.spec.ts',
    '!src/**/*.test.ts',
  ],

  // Seuils de couverture pour la pagination
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 95,
      lines: 90,
      statements: 90,
    },
  },

  // Configuration spécifique pour les tests de pagination
  testEnvironment: 'node',
  
  // Timeout pour les tests de performance
  testTimeout: 30000,

  // Setup spécifique pour les tests de pagination
  setupFiles: ['<rootDir>/test/setup/env-setup.ts'],
  setupFilesAfterEnv: [
    '<rootDir>/test/setup/pagination-test-setup.ts',
  ],

  // Verbose pour voir tous les tests
  verbose: true,

  // Configuration de la couverture
  collectCoverage: false,
  coverageDirectory: '<rootDir>/coverage/pagination',
  coverageReporters: ['text', 'lcov', 'html'],

  // Cache pour accélérer les re-runs
  cacheDirectory: '<rootDir>/node_modules/.cache/jest/pagination',

  // Configuration pour la détection des fuites mémoire
  detectOpenHandles: true,
  forceExit: false,
  
  // Configuration pour les tests de performance
  maxWorkers: '50%',
  
  // Bail sur le premier échec
  bail: false,

  // Configuration avancée
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
        strict: false,
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

  // Nettoyage automatique entre les tests
  clearMocks: true,
  restoreMocks: true,
  resetMocks: true,

  // Hooks pour les tests
  globalSetup: '<rootDir>/test/setup/global-setup.ts',
  globalTeardown: '<rootDir>/test/setup/global-teardown.ts',
};