// ================================================================
// jest.config.js - Configuration PRINCIPALE (Tests unitaires)
// ================================================================
module.exports = {
  displayName: 'Unit Tests',
  preset: 'ts-jest',
  testEnvironment: 'node',
  
  // Pattern pour tests UNITAIRES uniquement
  testMatch: [
    '<rootDir>/test/unit/**/*.spec.ts'
  ],
  
  // Extensions et transformation
  moduleFileExtensions: ['js', 'json', 'ts'],
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  
  // Résolution modules
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@test/(.*)$': '<rootDir>/test/$1',
  },
  
  // Setup
  setupFiles: ['<rootDir>/test/setup/env-setup.ts'],
  setupFilesAfterEnv: ['<rootDir>/test/setup/jest.setup.ts'],
  
  // Coverage
  collectCoverageFrom: [
    'src/**/*.(t|j)s',
    '!src/**/*.spec.ts',
    '!src/**/*.interface.ts',
    '!src/**/*.d.ts',
    '!src/main.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  
  // Performance
  testTimeout: 30000,
  maxWorkers: '50%',
  
  // Nettoyage
  clearMocks: true,
  restoreMocks: true,
  
  // Gestion fermeture
  detectOpenHandles: true,
  forceExit: false,
};