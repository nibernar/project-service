// jest.cache.config.js

const { pathsToModuleNameMapper } = require('ts-jest');

let moduleNameMapper = {};
try {
  const { compilerOptions } = require('./tsconfig.json');
  if (compilerOptions && compilerOptions.paths) {
    moduleNameMapper = pathsToModuleNameMapper(compilerOptions.paths, {
      prefix: '<rootDir>/',
    });
  }
} catch (error) {
  console.warn('Could not load tsconfig paths, using default module resolution');
}

module.exports = {
  displayName: {
    name: 'CACHE TESTS',
    color: 'blue',
  },

  testEnvironment: 'node',

  moduleFileExtensions: ['js', 'json', 'ts'],

  testMatch: [
    '**/test/**/*cache*.spec.ts',
    '**/test/**/cache.*.spec.ts',
    '**/test/**/cache/**/*.spec.ts',
    // Ajout des patterns pour les tests E2E
    '**/test/**/*cache*.e2e-spec.ts',
    '**/test/**/cache.*.e2e-spec.ts',
  ],

  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/dist/',
    '<rootDir>/coverage/',
  ],

  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },

  preset: 'ts-jest',
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.json',
      isolatedModules: true,
    },
  },

  collectCoverage: true,
  collectCoverageFrom: [
    'src/config/cache.config.ts',
    'src/cache/**/*.ts',
    '!src/cache/**/*.spec.ts',
    '!src/cache/**/*.e2e-spec.ts',
    '!src/**/*.interface.ts',
    '!src/**/*.module.ts',
  ],

  coverageDirectory: 'coverage/cache',
  coverageReporters: ['text', 'text-summary', 'html', 'lcov', 'clover', 'json'],

  coverageThreshold: {
    global: {
      branches: 85,
      functions: 90,
      lines: 88,
      statements: 88,
    },
    'src/config/cache.config.ts': {
      branches: 90,
      functions: 95,
      lines: 92,
      statements: 92,
    },
    'src/cache/cache.service.ts': {
      branches: 85,
      functions: 90,
      lines: 85,
      statements: 85,
    },
  },

  setupFilesAfterEnv: ['<rootDir>/test/setup/cache-test-setup.ts'],

  testEnvironmentOptions: {
    NODE_ENV: 'test',
  },

  testTimeout: 30000,

  reporters: [
    'default',
    [
      'jest-html-reporters',
      {
        publicPath: './test-results/cache',
        filename: 'cache-test-report.html',
        pageTitle: 'Cache Tests Report',
        includeFailureMsg: true,
        includeSuiteFailure: true,
      },
    ],
    [
      'jest-junit',
      {
        outputDirectory: './test-results/cache',
        outputName: 'cache-tests.xml',
        suiteName: 'Cache Tests',
        classNameTemplate: '{classname}',
        titleTemplate: '{title}',
      },
    ],
  ],

  verbose: true,
  silent: false,

  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,

  detectLeaks: false,
  detectOpenHandles: true,

  maxWorkers: '50%',

  cache: true,
  cacheDirectory: '<rootDir>/node_modules/.cache/jest-cache',

  errorOnDeprecated: true,
  updateSnapshot: false,
  bail: false,

  watchPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/dist/',
    '<rootDir>/coverage/',
    '<rootDir>/test-results/',
  ],

  extensionsToTreatAsEsm: [],

  transformIgnorePatterns: ['node_modules/(?!(.*\\.mjs$))'],

  moduleNameMapper,
};