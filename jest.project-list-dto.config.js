// jest.project-list-dto.config.js
module.exports = {
  displayName: 'ProjectListItemDto Tests',
  
  // Test patterns
  testMatch: [
    '<rootDir>/test/unit/project/dto/project-list.dto*.spec.ts',
    '<rootDir>/test/integration/project/dto/project-list.dto*.spec.ts',
    '<rootDir>/test/e2e/project/dto/project-list.dto*.spec.ts',
  ],
  
  // Environment
  testEnvironment: 'node',
  
  // Configuration TypeScript avec ts-jest (syntaxe moderne)
  preset: 'ts-jest',
  
  // Support des décorateurs TypeScript (STRUCTURE CORRIGÉE)
  transform: {
    '^.+\\.(t|j)s$': [
      'ts-jest',
      {
        // Configuration TypeScript correcte - PAS compilerOptions directement
        tsconfig: {
          experimentalDecorators: true,
          emitDecoratorMetadata: true,
          target: 'es2020',
          module: 'commonjs',
          strict: false,
        },
        // Autres options ts-jest
        isolatedModules: false,
      },
    ],
  },
  
  // Extensions de fichiers
  moduleFileExtensions: ['js', 'json', 'ts'],
  
  // Résolution des modules
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^test/(.*)$': '<rootDir>/test/$1',
  },
  
  // Configuration de couverture
  collectCoverageFrom: [
    'src/project/dto/project-list.dto.ts',
  ],
  coverageDirectory: '<rootDir>/coverage/project-list-dto',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95,
    },
  },
  
  // Timeout et performance
  testTimeout: 30000,
  maxWorkers: 4,
  workerIdleMemoryLimit: '512MB',
  
  // Reporters
  reporters: [
    'default',
    [
      'jest-html-reporters',
      {
        publicPath: './jest-html-reporters-attach/project-list-dto-report',
        filename: 'index.html',
        openReport: false,
        includeFailureMsg: true,
      },
    ],
  ],
};