// ================================================================
// jest.config.js - Config unique (unit + integration + e2e)
// ================================================================
module.exports = {
  displayName: 'Tests',
  preset: 'ts-jest',
  testEnvironment: 'node',

  // Tous les patterns de test
  testMatch: [
    '<rootDir>/test/unit/**/*.spec.ts',
    '<rootDir>/test/integration/**/*.integration.spec.ts',
    '<rootDir>/test/e2e/**/*.e2e-spec.ts',
    '<rootDir>/test/security/**/*.spec.ts'
  ],

  moduleFileExtensions: ['js', 'json', 'ts'],
  transform: { '^.+\\.(t|j)s$': 'ts-jest' },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@test/(.*)$': '<rootDir>/test/$1',
  },

  setupFilesAfterEnv: ['<rootDir>/test/setup/jest.setup.ts'],

  collectCoverageFrom: [
    'src/**/*.(t|j)s',
    '!src/**/*.spec.ts',
    '!src/**/*.interface.ts',
    '!src/**/*.d.ts',
    '!src/main.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],

  testTimeout: 30000,
  clearMocks: true,
  restoreMocks: true,
  detectOpenHandles: true,
};
