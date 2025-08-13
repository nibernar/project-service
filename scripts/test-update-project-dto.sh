#!/bin/bash
set -e

echo "🧪 Running All UpdateProjectDto Tests..."
echo "📋 Unit Tests, Edge Cases, Security, Performance & Integration"

npm run test -- --config=jest.update-project-dto.config.js --coverage

echo "✅ All UpdateProjectDto Tests completed!"