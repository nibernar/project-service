// ================================================================
// jest.integration.config.js - Tests d'intégration
// ================================================================
const baseConfig = require('./jest.config.js');

module.exports = {
  ...baseConfig,
  displayName: 'Integration Tests',
  
  testMatch: [
    '<rootDir>/test/integration/**/*.spec.ts'
  ],
  
  setupFilesAfterEnv: [
    '<rootDir>/test/setup/jest.setup.ts',
    '<rootDir>/test/setup/database-test-setup.ts'
  ],
  
  // Pas de coverage pour les tests d'intégration
  collectCoverage: false,
  
  // Plus de timeout pour l'intégration
  testTimeout: 60000,
  maxWorkers: 1, // Séquentiel pour éviter conflits DB
};
