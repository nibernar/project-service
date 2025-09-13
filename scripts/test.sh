#!/bin/bash
# ================================================================
# scripts/test.sh - Script principal pour tous les tests
# ================================================================

set -e

# Couleurs
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}🚀 Lancement de tous les tests - Project Service${NC}"
echo "================================================="

# Vérification des prérequis
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm n'est pas installé${NC}"
    exit 1
fi

# Tests unitaires
echo -e "${BLUE}📋 Tests unitaires...${NC}"
npm run test:unit

# Tests d'intégration
echo -e "${BLUE}🔗 Tests d'intégration...${NC}"
npm run test:integration

# Tests E2E
echo -e "${BLUE}🎯 Tests E2E...${NC}"
npm run test:e2e

echo -e "${GREEN}✅ Tous les tests ont réussi !${NC}"
