# ================================================================
# scripts/test-integration.sh - Tests d'intégration uniquement  
# ================================================================

#!/bin/bash
set -e

# Couleurs
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}🔗 Tests d'intégration - Project Service${NC}"
echo "========================================"

# Vérification des services requis
echo -e "${BLUE}🔍 Vérification des prérequis...${NC}"

# PostgreSQL
if ! nc -z localhost 5432 2>/dev/null; then
    echo -e "${YELLOW}⚠️  PostgreSQL n'est pas accessible sur localhost:5432${NC}"
    echo -e "${YELLOW}   Démarrage conseillé: docker-compose up -d postgres${NC}"
fi

# Redis  
if ! nc -z localhost 6379 2>/dev/null; then
    echo -e "${YELLOW}⚠️  Redis n'est pas accessible sur localhost:6379${NC}"
    echo -e "${YELLOW}   Démarrage conseillé: docker-compose up -d redis${NC}"
fi

# Configuration des variables d'environnement
export NODE_ENV=test
export DATABASE_URL=${TEST_DATABASE_URL:-"postgresql://test_user:test_pass@localhost:5432/project_service_test"}
export REDIS_HOST=${REDIS_HOST:-"localhost"}
export REDIS_PORT=${REDIS_PORT:-"6379"}

# Préparation de la base de test (si Prisma disponible)
if command -v npx &> /dev/null && [ -f "prisma/schema.prisma" ]; then
    echo -e "${BLUE}🗄️  Préparation de la base de test...${NC}"
    npx prisma db push --force-reset > /dev/null 2>&1 || echo -e "${YELLOW}⚠️  Erreur préparation DB (peut être ignorée)${NC}"
fi

# Exécution des tests
echo -e "${BLUE}🔗 Lancement des tests d'intégration...${NC}"
npm run test:integration

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Tests d'intégration réussis !${NC}"
else
    echo -e "${RED}❌ Tests d'intégration échoués !${NC}"
    exit 1
fi