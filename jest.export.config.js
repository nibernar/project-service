const { pathsToModuleNameMapper } = require('ts-jest');
const { compilerOptions } = require('./tsconfig.json');

module.exports = {
  displayName: 'Export Module Tests',
  preset: 'ts-jest',
  testEnvironment: 'node',
  
  // Test files patterns
  testMatch: [
    '<rootDir>/test/unit/export/**/*.spec.ts'
  ],
  
  // Setup files
  setupFilesAfterEnv: [
    '<rootDir>/test/setup/jest.setup.ts'
  ],
  
  // Module name mapping from tsconfig paths
  moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths || {}, {
    prefix: '<rootDir>/'
  }),
  
  // Coverage configuration
  collectCoverage: true,
  collectCoverageFrom: [
    'src/export/**/*.{ts,js}',
    '!src/export/**/*.d.ts',
    '!src/export/**/*.interface.ts',
    '!src/export/**/*.spec.ts',
    '!src/export/**/*.test.ts'
  ],
  coverageDirectory: 'coverage/export',
  coverageReporters: ['text', 'lcov', 'html', 'json'],
  coverageThreshold: {
    global: {
      branches: 85,
      functions: 90,
      lines: 90,
      statements: 90
    }
  },
  
  // Transform configuration
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  
  // Module file extensions
  moduleFileExtensions: ['js', 'json', 'ts'],
  
  // Test timeout for performance tests
  testTimeout: 60000,
  
  // Verbose output
  verbose: true,
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Restore mocks after each test
  restoreMocks: true
};