// jest.auth-guard.config.js - Configuration propre et fonctionnelle

module.exports = {
  // Configuration de base
  preset: 'ts-jest',
  testEnvironment: 'node',
  
  // Nom d'affichage
  displayName: {
    name: 'AuthGuard Tests',
    color: 'blue',
  },
  
  // Fichiers de tests à exécuter
  testMatch: [
    '<rootDir>/test/unit/common/guards/auth.guard*.spec.ts',
    '<rootDir>/test/integration/common/guards/auth.guard*.spec.ts',
  ],
  
  // Extensions de fichiers
  moduleFileExtensions: ['js', 'json', 'ts'],
  
  // Transformation des fichiers TypeScript
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  
  // Configuration TypeScript pour ts-jest
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', {
      tsconfig: './tsconfig.json',
    }],
  },
  
  // Mapping des modules (résolution des imports)
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/src/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  
  // Setup des tests
  setupFilesAfterEnv: [
    '<rootDir>/test/setup/auth-guard-test-setup.ts',
  ],
  
  // Configuration de la couverture de code
  collectCoverage: false, // Activé via --coverage en CLI
  coverageDirectory: '<rootDir>/coverage/auth-guard',
  coverageReporters: [
    'text',
    'html',
    'lcov',
    'json',
  ],
  
  // Fichiers inclus dans la couverture
  collectCoverageFrom: [
    'src/common/guards/auth.guard.ts',
    '!src/**/*.spec.ts',
    '!src/**/*.test.ts',
    '!src/**/*.d.ts',
  ],
  
  // Seuils de couverture
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  
  // Reporters (simplifié)
  reporters: [
    'default',
  ],
  
  // Configuration des timeouts
  testTimeout: 30000,
  
  // Configuration des workers
  maxWorkers: '50%',
  
  // Répertoires de modules
  moduleDirectories: ['node_modules', '<rootDir>/src'],
  
  // Configuration des mocks
  clearMocks: true,
  resetMocks: false,
  restoreMocks: true,
  
  // Patterns d'exclusion
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/dist/',
    '<rootDir>/coverage/',
  ],
  
  // Patterns d'exclusion des transformations
  transformIgnorePatterns: [
    'node_modules/(?!(.*\\.mjs$))',
  ],
  
  // Configuration verbose
  verbose: true,
  
  // Configuration des logs
  silent: false,
  
  // Gestion des erreurs deprecated
  errorOnDeprecated: false,
  
  // Configuration du cache
  cacheDirectory: '<rootDir>/.jest-cache/auth-guard',
  
  // Patterns ignorés en mode watch
  watchPathIgnorePatterns: [
    '<rootDir>/test-results/',
    '<rootDir>/coverage/',
    '<rootDir>/.jest-cache/',
  ],
  
  // Configuration pour les tests parallèles
  detectOpenHandles: true,
  forceExit: true,
  
  // Éviter les fuites mémoire
  logHeapUsage: false,
  
  // Configuration des notifications
  notify: false,
  
  // Variables d'environnement
  testEnvironmentOptions: {},
  
  // Configuration des snapshots
  updateSnapshot: false,
  
  // Configuration du bail (arrêt sur première erreur)
  bail: false,
  
  // Configuration pour éviter les warnings
  haste: {
    computeSha1: false,
    throwOnModuleCollision: false,
  },
  
  // Extensions supportées
  moduleFileExtensions: ['js', 'json', 'ts', 'tsx', 'jsx'],
  
  // Configuration des chemins absolus
  modulePaths: ['<rootDir>/src'],
  
  // Configuration pour les tests d'intégration
  testEnvironment: 'node',
  
  // Configuration des extensions Jest
  prettierPath: null, // Désactiver Prettier pour éviter les conflits
};