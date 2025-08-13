const baseConfig = require('./jest.config');

module.exports = {
  ...baseConfig,
  displayName: 'UpdateProjectDto All Tests',
  testMatch: [
    '<rootDir>/test/unit/project/dto/update-project.dto*.spec.ts',
    '<rootDir>/test/integration/project/dto/update-project.dto*.spec.ts'
  ],
  collectCoverageFrom: [
    'src/project/dto/update-project.dto.ts'
  ],
  coverageDirectory: 'coverage/update-project-dto',
  testTimeout: 30000 // Pour les tests de performance
};