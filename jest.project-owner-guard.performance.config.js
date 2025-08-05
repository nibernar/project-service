module.exports = {
  displayName: 'ProjectOwnerGuard Performance Tests',
  testMatch: [
    '<rootDir>/test/performance/common/guards/project-owner.guard*.spec.ts',
  ],
  testEnvironment: 'node',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  testTimeout: 120000,
  maxWorkers: 1,
};