// jest.statistics.config.js
const baseConfig = require('./jest.config.js');

module.exports = {
  ...baseConfig,
  displayName: 'Statistics Module',
  testMatch: [
    '<rootDir>/test/unit/statistics/**/*.spec.ts',
    '<rootDir>/test/integration/statistics/**/*.spec.ts',
  ],
  collectCoverageFrom: [
    'src/statistics/**/*.ts',
    '!src/statistics/**/*.spec.ts',
    '!src/statistics/**/index.ts',
  ],
  coverageDirectory: 'coverage/statistics',
  setupFilesAfterEnv: ['<rootDir>/test/setup/jest.setup.ts'],
};