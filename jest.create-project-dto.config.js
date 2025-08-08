/**
 * Configuration Jest simplifiée pour les tests CreateProjectDto
 * Tests unitaires uniquement avec mocks automatiques
 */

module.exports = {
  // Configuration TypeScript de base
  preset: 'ts-jest',
  testEnvironment: 'node',
  
  // Nom d'affichage
  displayName: {
    name: 'CreateProjectDto Tests',
    color: 'green',
  },
  
  // Extensions de fichiers
  moduleFileExtensions: ['js', 'json', 'ts'],
  
  // Pattern de tests - tous les tests simplifiés
  testMatch: [
    '<rootDir>/test/unit/project/dto/*.spec.ts',
    '<rootDir>/test/integration/project/dto/*.spec.ts',
    '<rootDir>/test/e2e/project/dto/*.spec.ts',
  ],
  
  // Transformation TypeScript
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', {
      tsconfig: './tsconfig.json',
    }],
  },
  
  // Mapping des modules
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/src/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  
  // Configuration de coverage
  collectCoverage: false,
  coverageDirectory: '<rootDir>/coverage/create-project-dto',
  coverageReporters: ['text', 'lcov', 'html'],
  
  collectCoverageFrom: [
    'src/project/dto/create-project.dto.ts',
    '!src/**/*.spec.ts',
    '!src/**/*.test.ts',
  ],
  
  coverageThreshold: {
    global: {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95,
    },
    'src/project/dto/create-project.dto.ts': {
      branches: 98,
      functions: 98,
      lines: 98,
      statements: 98,
    },
  },
  
  // Setup
  setupFilesAfterEnv: [
    '<rootDir>/test/setup/create-project-dto-setup.ts',
  ],
  
  // Configuration des mocks
  clearMocks: true,
  restoreMocks: true,
  resetMocks: true,
  
  // Timeouts
  testTimeout: 30000,
  
  // Reporter simple
  reporters: ['default'],
  
  // Verbose pour voir les détails
  verbose: true,
  
  // Configuration des workers
  maxWorkers: 1,
  
  // Forcer la fermeture après les tests
  forceExit: true,
  detectOpenHandles: true,
  
  // Configuration du cache
  cache: false,
  
  // Répertoires de modules
  moduleDirectories: ['node_modules', '<rootDir>/src'],
  
  // Patterns d'exclusion
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/dist/',
    '<rootDir>/coverage/',
  ],
  
  // Configuration des erreurs
  errorOnDeprecated: false,
  
  // Transformation des modules node_modules si nécessaire
  transformIgnorePatterns: [
    'node_modules/(?!(.*\\.mjs$))'
  ],
};