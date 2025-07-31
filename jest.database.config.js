// jest.database.config.js
const baseConfig = require('./jest.config');

module.exports = {
  ...baseConfig,
  displayName: 'Database Service Tests',
  
  testMatch: [
    '**/common/database/**/*.spec.ts',
    '**/config/**/*.spec.ts',
    '**/integration/*.integration.spec.ts',
    '**/e2e/*.e2e-spec.ts'
  ],
  
  setupFilesAfterEnv: ['<rootDir>/test/setup/database-test-setup.ts'],
  testEnvironment: 'node',
  maxWorkers: 1,
  testTimeout: 120000,
  setupFiles: ['<rootDir>/test/setup/env-setup.ts'],
  clearMocks: true,
  restoreMocks: true,
  globalSetup: '<rootDir>/test/setup/global-setup.ts',
  globalTeardown: '<rootDir>/test/setup/global-teardown.ts',
  
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@test/(.*)$': '<rootDir>/test/$1'
  },
};