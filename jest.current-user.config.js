// jest.current-user.config.js
const baseConfig = require('./jest.config');

module.exports = {
  ...baseConfig,
  displayName: 'Current User Decorator Tests',
  
  testMatch: [
    '**/test/unit/common/decorators/current-user.decorator*.spec.ts',
  ],
  
  setupFilesAfterEnv: ['<rootDir>/test/setup/current-user-test-setup.ts'],
  testEnvironment: 'node',
  maxWorkers: '75%',
  testTimeout: 30000,
  setupFiles: ['<rootDir>/test/setup/env-setup.ts'],
  clearMocks: true,
  restoreMocks: true,
  
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@test/(.*)$': '<rootDir>/test/$1'
  },
  
  collectCoverageFrom: [
    'src/common/decorators/**/*.ts',
    '!src/common/decorators/**/*.spec.ts',
    '!src/common/decorators/**/*.d.ts',
  ],
  
  coverageDirectory: 'coverage/current-user-decorator',
  
  coverageReporters: [
    'text',
    'lcov', 
    'html',
    'json',
    'clover'
  ],
  
  coverageThreshold: {
    global: {
      branches: 95,
      functions: 100,
      lines: 95,
      statements: 95,
    },
    'src/common/decorators/current-user.decorator.ts': {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
  },
  
  reporters: [
    'default',
    [
      'jest-html-reporters',
      {
        publicPath: './test-results/current-user-decorator',
        filename: 'current-user-test-report.html',
        expand: true,
        hideIcon: false,
        pageTitle: 'Current User Decorator Test Report',
        logoImgPath: undefined,
        inlineSource: false,
      }
    ],
    [
      'jest-junit',
      {
        outputDirectory: './test-results/current-user-decorator',
        outputName: 'current-user-tests.xml',
        suiteName: 'Current User Decorator Tests',
        classNameTemplate: '{classname}',
        titleTemplate: '{title}',
        ancestorSeparator: ' › ',
        usePathForSuiteName: true,
      }
    ]
  ],
  
  verbose: true,
  
  globalSetup: '<rootDir>/test/setup/performance-global-setup.js',
  globalTeardown: '<rootDir>/test/setup/performance-global-teardown.js',
  
  // Configuration ts-jest corrigée (syntaxe valide)
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: {
        target: 'es2020',
        module: 'commonjs',
        strict: true,
        esModuleInterop: true,
        experimentalDecorators: true,
        emitDecoratorMetadata: true,
      },
    }],
  },
  
  modulePathIgnorePatterns: [
    '<rootDir>/dist/',
    '<rootDir>/coverage/',
    '<rootDir>/node_modules/',
  ],
  
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  
  detectOpenHandles: process.env.NODE_ENV === 'development',
  forceExit: true,
};