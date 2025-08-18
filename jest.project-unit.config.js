const baseConfig = require('./jest.config');

module.exports = {
  ...baseConfig,
  displayName: 'Project Unit Tests',
  testMatch: [
    '<rootDir>/test/unit/project/**/*.spec.ts'
  ],
  collectCoverageFrom: [
    'src/project/**/*.ts',
    '!src/project/**/*.dto.ts', // Exclure les DTOs déjà testés
    '!src/project/**/*.entity.ts',
    '!src/project/**/*.module.ts',
  ],
  coverageDirectory: 'coverage/project-unit',
  coverageReporters: ['text', 'lcov', 'html'],
};