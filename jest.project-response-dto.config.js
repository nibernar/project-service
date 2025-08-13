const { pathsToModuleNameMapper } = require('ts-jest');
const { compilerOptions } = require('./tsconfig.json');

module.exports = {
  // Configuration de base
  displayName: {
    name: 'PROJECT-RESPONSE-DTO',
    color: 'cyan',
  },
  preset: 'ts-jest',
  testEnvironment: 'node',
  
  // Chemins des tests
  testMatch: [
    '<rootDir>/test/unit/project/dto/project-response.dto.spec.ts',
  ],
  
  // Configuration TypeScript moderne
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', {
      tsconfig: {
        target: 'ES2020',
        module: 'CommonJS',
      },
      useESM: false,
    }],
  },
  
  // Résolution des modules
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@test/(.*)$': '<rootDir>/test/$1',
    ...pathsToModuleNameMapper(compilerOptions.paths || {}, {
      prefix: '<rootDir>/',
    }),
  },
  
  // Extensions de fichiers
  moduleFileExtensions: ['js', 'json', 'ts'],
  
  // Répertoire racine
  rootDir: '.',
  
  // Configuration de couverture
  collectCoverage: true,
  coverageDirectory: '<rootDir>/coverage/project-response-dto',
  coverageReporters: [
    'text',
    'text-summary',
    'html',
    'lcov',
    'clover',
    'json',
  ],
  
  // Fichiers inclus dans la couverture
  collectCoverageFrom: [
    'src/project/dto/project-response.dto.ts',
  ],
  
  // Seuils de couverture stricts pour ce DTO critique
  coverageThreshold: {
    global: {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
    'src/project/dto/project-response.dto.ts': {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
  },
  
  // Configuration des reporters
  reporters: [
    'default',
    [
      'jest-html-reporters',
      {
        publicDir: './coverage/project-response-dto',
        filename: 'project-response-dto-report.html',
        pageTitle: 'Tests ProjectResponseDto',
        overwrite: true,
        expand: true,
        hideIcon: false,
        testCommand: 'npm run test:project-response-dto',
      },
    ],
    [
      'jest-junit',
      {
        outputDirectory: './coverage/project-response-dto',
        outputName: 'junit-project-response-dto.xml',
        classNameTemplate: 'ProjectResponseDto.{classname}',
        titleTemplate: '{title}',
        ancestorSeparator: ' › ',
        usePathForSuiteName: true,
      },
    ],
  ],
  
  // Configuration de setup
  setupFilesAfterEnv: [
    '<rootDir>/test/setup/jest.setup.ts',
  ],
  
  // Timeout pour les tests
  testTimeout: 30000,
  
  // Configuration des mocks
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  
  // Configuration des timers (corrigé)
  fakeTimers: {
    enableGlobally: false,
  },
  
  // Configuration verbose pour diagnostic détaillé
  verbose: true,
  
  // Détection des handles ouverts
  detectOpenHandles: true,
  forceExit: false,
  
  // Ignore patterns
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/dist/',
    '<rootDir>/coverage/',
  ],
  
  // Configuration pour les tests de performance
  maxWorkers: '50%',
  
  // Configuration des transformations
  transformIgnorePatterns: [
    'node_modules/(?!(class-transformer|class-validator)/)',
  ],
  
  // Configuration du cache
  cacheDirectory: '<rootDir>/.jest-cache/project-response-dto',
  
  // Hook pour setup global si nécessaire
  globalSetup: '<rootDir>/test/setup/global-setup.ts',
  globalTeardown: '<rootDir>/test/setup/global-teardown.ts',
  
  // Configuration de la parallélisation
  maxConcurrency: 5,
  
  // Affichage détaillé des erreurs
  errorOnDeprecated: true,
  
  // Configuration des notifications (optionnel)
  notify: false,
  notifyMode: 'failure-change',
  
  // Configuration pour le watch mode
  watchPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/coverage/',
    '<rootDir>/dist/',
  ],
};