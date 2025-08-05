module.exports = {
  displayName: 'ProjectOwnerGuard E2E Tests',
  testMatch: [
    '<rootDir>/test/e2e/common/guards/project-owner.guarde2e.spec.ts',
  ],
  preset: 'ts-jest',
  testEnvironment: 'node',
  testTimeout: 60000,
  maxWorkers: 1,
  setupFiles: ['<rootDir>/test/setup/env-setup.ts'],
};