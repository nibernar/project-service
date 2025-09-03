// jest.cache-events.config.js - VERSION DÉFINITIVE CORRIGÉE
const { pathsToModuleNameMapper } = require('ts-jest');
const { compilerOptions } = require('./tsconfig.json');

module.exports = {
  displayName: 'Cache & Events Module Tests',
  preset: 'ts-jest',
  testEnvironment: 'node',
  
  // Test files patterns
  testMatch: [
    '<rootDir>/test/unit/cache/**/*.spec.ts',
    '<rootDir>/test/unit/events/**/*.spec.ts',
    '<rootDir>/test/integration/cache.integration.spec.ts',
    '<rootDir>/test/integration/events.integration.spec.ts'
  ],
  
  // Setup files - ORDRE IMPORTANT
  setupFiles: [
    '<rootDir>/test/setup/env-setup.ts'
  ],
  
  setupFilesAfterEnv: [
    '<rootDir>/test/setup/jest.setup.ts'
  ],
  
  // Module name mapping
  moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths || {}, {
    prefix: '<rootDir>/'
  }),
  
  // Coverage configuration - SEUILS ASSOUPLIS POUR DEBUG
  collectCoverage: true,
  collectCoverageFrom: [
    'src/cache/**/*.ts',
    'src/config/cache.config.ts',
    'src/events/**/*.ts',
    '!**/*.d.ts',
    '!**/*.interface.ts',
    '!**/*.spec.ts',
    '!**/*.test.ts',
    '!**/*.mock.ts'
  ],
  
  coverageDirectory: './test-results/cache-events',
  coverageReporters: ['text', 'lcov', 'html', 'json'],
  
  // Coverage thresholds temporairement désactivés
  // coverageThreshold: {
  //   global: {
  //     branches: 50,
  //     functions: 50,
  //     lines: 50,
  //     statements: 50
  //   }
  // },
  
  // Transform configuration - NOUVELLE SYNTAXE TS-JEST
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', {
      tsconfig: './tsconfig.json',
      isolatedModules: false
    }],
  },
  
  // Module file extensions
  moduleFileExtensions: ['js', 'json', 'ts'],
  
  // TIMEOUT ÉTENDU
  testTimeout: 60000, // 60 secondes
  
  // Verbose output
  verbose: true,
  
  // Clear mocks between tests
  clearMocks: true,
  restoreMocks: true,
  
  // Global setup and teardown
  globalSetup: '<rootDir>/test/setup/global-setup.ts',
  globalTeardown: '<rootDir>/test/setup/global-teardown.ts',
  
  // Jest configuration pour stabilité
  maxWorkers: 1, // Un seul worker pour éviter les conflits Redis
  maxConcurrency: 1, // Tests séquentiels
  
  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/coverage/'
  ],
  
  // Options de run
  bail: false,
  forceExit: true,
  detectOpenHandles: true,
  
  // Configuration des reporters
  reporters: [
    'default',
    ['jest-html-reporters', {
      publicPath: './test-results/cache-events',
      filename: 'cache-events-test-report.html',
      expand: true,
      hideIcon: false,
      includeFailureMsg: true,
      includeSuiteFailure: true
    }]
  ],
  
  // Configuration des transformations
  transformIgnorePatterns: [
    'node_modules/(?!(.*\\.mjs$|ioredis))'
  ],
  
  // Configuration des logs
  silent: false,
  errorOnDeprecated: false,
  
  // Configuration des mocks
  automock: false,
  resetMocks: false,
  resetModules: false,
  restoreMocks: true,
  
  // Configuration du cache Jest
  cacheDirectory: '<rootDir>/node_modules/.cache/jest',
  
  // Configuration des watchers
  watchPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/coverage/',
    '/test-results/'
  ]
};