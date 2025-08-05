module.exports = {
  displayName: 'ProjectOwnerGuard Tests',
  testMatch: [
    '<rootDir>/test/unit/common/guards/project-owner.guard*.spec.ts',
    '<rootDir>/test/integration/common/guards/project-owner.guard*.spec.ts',
  ],
  collectCoverageFrom: [
    'src/common/guards/project-owner.guard.ts',
    'src/common/exceptions/*.ts',
  ],
  coverageDirectory: 'coverage/project-owner-guard',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 95,
      lines: 95,
      statements: 95,
    },
  },
  testEnvironment: 'node',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  // CORRECTION: moduleNameMap → moduleNameMapper
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testTimeout: 30000,
  // Optimisation pour éviter les problèmes de workers
  maxWorkers: 1,
  forceExit: true,
  detectOpenHandles: true,
  testTimeout: 30000,
  setupFilesAfterEnv: [],
};