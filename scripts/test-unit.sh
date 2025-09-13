# ================================================================
# scripts/test-unit.sh - Tests unitaires uniquement
# ================================================================

#!/bin/bash
set -e

# Couleurs
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}🧪 Tests unitaires - Project Service${NC}"
echo "====================================="

# Options par défaut
COVERAGE=false
WATCH=false
VERBOSE=false

# Parsing des arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --coverage)
            COVERAGE=true
            shift
            ;;
        --watch)
            WATCH=true
            shift
            ;;
        --verbose)
            VERBOSE=true
            shift
            ;;
        --help)
            echo "Usage: $0 [--coverage] [--watch] [--verbose]"
            exit 0
            ;;
        *)
            echo -e "${RED}Option inconnue: $1${NC}"
            exit 1
            ;;
    esac
done

# Construction de la commande
CMD="npm run test:unit"

if [ "$COVERAGE" = true ]; then
    CMD="npm run test:cov"
fi

if [ "$WATCH" = true ]; then
    CMD="npm run test:watch"
fi

if [ "$VERBOSE" = true ]; then
    CMD="$CMD -- --verbose"
fi

# Exécution
echo -e "${BLUE}📋 Commande: $CMD${NC}"
eval $CMD

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Tests unitaires réussis !${NC}"
else
    echo -e "${RED}❌ Tests unitaires échoués !${NC}"
    exit 1
fi