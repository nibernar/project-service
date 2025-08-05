// jest.config.js
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  
  // ✅ Ajout des patterns testMatch pour reconnaître TOUS les types de tests
  testMatch: [
    '**/__tests__/**/*.[jt]s?(x)',           // Tests dans dossier __tests__
    '**/?(*.)+(spec|test).[tj]s?(x)',        // Fichiers .spec.ts et .test.ts
    '**/*.e2e-spec.[tj]s?(x)',               // ✅ Fichiers .e2e-spec.ts
    '**/*.e2e.spec.[tj]s?(x)',               // ✅ Fichiers .e2e.spec.ts
    '**/*.integration-spec.[tj]s?(x)',       // ✅ Fichiers .integration-spec.ts
    '**/*.performance-spec.[tj]s?(x)',       // ✅ Fichiers .performance-spec.ts
  ],
  
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  
  collectCoverageFrom: [
    'src/**/*.(t|j)s',
    '!src/**/*.spec.ts',
    '!src/**/*.interface.ts',
    '!src/**/*.d.ts',
  ],
  
  coverageDirectory: 'coverage',
  testEnvironment: 'node',
  
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@test/(.*)$': '<rootDir>/test/$1',
  },
  
  // ✅ Configuration pour éviter les problèmes de fermeture
  forceExit: false,
  detectOpenHandles: true,
  
  // ✅ Setup pour les variables d'environnement
  setupFiles: ['<rootDir>/test/setup/env-setup.ts'],
  
  // ✅ Timeout global
  testTimeout: 30000,
};