// ================================================================
// jest.e2e.config.js - Tests end-to-end
// ================================================================
const baseConfig = require('./jest.config.js');

module.exports = {
  ...baseConfig,
  displayName: 'E2E Tests',
  
  testMatch: [
    '<rootDir>/test/e2e/**/*.e2e-spec.ts'
  ],
  
  setupFilesAfterEnv: [
    '<rootDir>/test/setup/jest.setup.ts',
    '<rootDir>/test/setup/global-setup.ts'
  ],
  
  // Configuration spéciale E2E
  collectCoverage: false,
  testTimeout: 120000, // 2 minutes pour E2E
  maxWorkers: 1, // Séquentiel obligatoire
  runInBand: true,
};