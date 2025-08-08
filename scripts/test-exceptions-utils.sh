#!/bin/bash

# Script de test pour les exceptions et utilitaires
# 
# Ce script exécute tous les tests relatifs aux exceptions métier
# et aux utilitaires de validation avec des rapports de couverture détaillés.

set -e

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COVERAGE_DIR="$PROJECT_ROOT/coverage/exceptions-utils"
TEST_RESULTS_DIR="$PROJECT_ROOT/test-results/exceptions-utils"

echo -e "${BLUE}🧪 Démarrage des tests d'exceptions et utilitaires${NC}"
echo "================================================"

# Nettoyage des anciens résultats
echo -e "${YELLOW}🧹 Nettoyage des anciens résultats...${NC}"
rm -rf "$COVERAGE_DIR"
rm -rf "$TEST_RESULTS_DIR"
mkdir -p "$COVERAGE_DIR"
mkdir -p "$TEST_RESULTS_DIR"

# Vérification que les fichiers de test existent
echo -e "${YELLOW}🔍 Vérification des fichiers de test...${NC}"

test_files=(
  "$PROJECT_ROOT/test/unit/common/exceptions/project-not-found.exception.spec.ts"
  "$PROJECT_ROOT/test/unit/common/exceptions/unauthorized-access.exception.spec.ts"
  "$PROJECT_ROOT/test/unit/common/utils/validation.utils.spec.ts"
)

missing_files=()
for file in "${test_files[@]}"; do
  if [[ ! -f "$file" ]]; then
    missing_files+=("$file")
  fi
done

if [[ ${#missing_files[@]} -gt 0 ]]; then
  echo -e "${RED}❌ Fichiers de test manquants:${NC}"
  for file in "${missing_files[@]}"; do
    echo "  - $file"
  done
  exit 1
fi

echo -e "${GREEN}✅ Tous les fichiers de test sont présents${NC}"

# Exécution des tests par catégorie
echo
echo -e "${BLUE}📊 Exécution des tests...${NC}"
echo "========================"

# 1. Tests des exceptions ProjectNotFoundException
echo -e "${YELLOW}🔧 Tests ProjectNotFoundException...${NC}"
npm run test -- --config=jest.exceptions-utils.config.js \
  --testPathPattern="test/unit/common/exceptions/project-not-found.exception.spec.ts" \
  --verbose \
  --coverage \
  --coverageDirectory="$COVERAGE_DIR/project-not-found" \
  --collectCoverageFrom="src/common/exceptions/project-not-found.exception.ts" \
  2>&1 | tee "$TEST_RESULTS_DIR/project-not-found.log"

if [[ $? -eq 0 ]]; then
  echo -e "${GREEN}✅ Tests ProjectNotFoundException réussis${NC}"
else
  echo -e "${RED}❌ Tests ProjectNotFoundException échoués${NC}"
fi

# 2. Tests des exceptions UnauthorizedAccessException
echo
echo -e "${YELLOW}🔒 Tests UnauthorizedAccessException...${NC}"
npm run test -- --config=jest.exceptions-utils.config.js \
  --testPathPattern="test/unit/common/exceptions/unauthorized-access.exception.spec.ts" \
  --verbose \
  --coverage \
  --coverageDirectory="$COVERAGE_DIR/unauthorized-access" \
  --collectCoverageFrom="src/common/exceptions/unauthorized-access.exception.ts" \
  2>&1 | tee "$TEST_RESULTS_DIR/unauthorized-access.log"

if [[ $? -eq 0 ]]; then
  echo -e "${GREEN}✅ Tests UnauthorizedAccessException réussis${NC}"
else
  echo -e "${RED}❌ Tests UnauthorizedAccessException échoués${NC}"
fi

# 3. Tests des utilitaires ValidationUtils
echo
echo -e "${YELLOW}✔️ Tests ValidationUtils...${NC}"
npm run test -- --config=jest.exceptions-utils.config.js \
  --testPathPattern="test/unit/common/utils/validation.utils.spec.ts" \
  --verbose \
  --coverage \
  --coverageDirectory="$COVERAGE_DIR/validation-utils" \
  --collectCoverageFrom="src/common/utils/validation.utils.ts" \
  2>&1 | tee "$TEST_RESULTS_DIR/validation-utils.log"

if [[ $? -eq 0 ]]; then
  echo -e "${GREEN}✅ Tests ValidationUtils réussis${NC}"
else
  echo -e "${RED}❌ Tests ValidationUtils échoués${NC}"
fi

# 4. Tests complets avec couverture globale
echo
echo -e "${BLUE}🎯 Tests complets avec couverture globale...${NC}"
echo "============================================="
npm run test -- --config=jest.exceptions-utils.config.js \
  --coverage \
  --coverageDirectory="$COVERAGE_DIR/global" \
  --coverageReporters html --coverageReporters lcov --coverageReporters text-summary --coverageReporters cobertura \
  --verbose \
  2>&1 | tee "$TEST_RESULTS_DIR/global.log"

test_exit_code=$?

# Génération des rapports
echo
echo -e "${BLUE}📋 Génération des rapports...${NC}"
echo "=============================="

# Validation de la couverture
if [[ -f "$COVERAGE_DIR/global/lcov.info" ]]; then
  echo -e "${GREEN}✅ Rapport de couverture généré${NC}"
  echo "📊 Localisation: $COVERAGE_DIR/global/index.html"
  
  # Extraction des statistiques de couverture
  if command -v lcov &> /dev/null; then
    echo
    echo -e "${YELLOW}📈 Résumé de couverture:${NC}"
    lcov --summary "$COVERAGE_DIR/global/lcov.info" 2>/dev/null | grep -E "(lines|functions|branches)" || echo "Impossible d'extraire le résumé"
  fi
else
  echo -e "${RED}⚠️  Rapport de couverture non généré${NC}"
fi

# Génération d'un rapport consolidé
cat > "$TEST_RESULTS_DIR/summary.md" << EOF
# Rapport de Tests - Exceptions et Utilitaires

## Résumé d'Exécution
- **Date**: $(date)
- **Durée**: ${SECONDS}s
- **Status Global**: $(if [[ $test_exit_code -eq 0 ]]; then echo "✅ SUCCÈS"; else echo "❌ ÉCHEC"; fi)

## Composants Testés
1. **ProjectNotFoundException**
   - Fichier: \`src/common/exceptions/project-not-found.exception.ts\`
   - Tests: \`src/common/exceptions/project-not-found.exception.spec.ts\`
   - Log: \`$TEST_RESULTS_DIR/project-not-found.log\`

2. **UnauthorizedAccessException**
   - Fichier: \`src/common/exceptions/unauthorized-access.exception.ts\`
   - Tests: \`src/common/exceptions/unauthorized-access.exception.spec.ts\`
   - Log: \`$TEST_RESULTS_DIR/unauthorized-access.log\`

3. **ValidationUtils**
   - Fichier: \`src/common/utils/validation.utils.ts\`
   - Tests: \`src/common/utils/validation.utils.spec.ts\`
   - Log: \`$TEST_RESULTS_DIR/validation-utils.log\`

## Rapports de Couverture
- **HTML**: \`$COVERAGE_DIR/global/index.html\`
- **LCOV**: \`$COVERAGE_DIR/global/lcov.info\`
- **Cobertura**: \`$COVERAGE_DIR/global/cobertura-coverage.xml\`

## Seuils de Couverture Requis
- **Lignes**: 95%
- **Fonctions**: 95%
- **Branches**: 90%
- **Instructions**: 95%

## Commandes Utiles
\`\`\`bash
# Voir les résultats HTML
open $COVERAGE_DIR/global/index.html

# Réexécuter les tests
$0

# Tests en mode watch
npm run test:watch -- --config=jest.exceptions-utils.config.js
\`\`\`
EOF

# Affichage final
echo
echo -e "${BLUE}🎉 Tests terminés!${NC}"
echo "=================="
echo "📊 Rapport de couverture: file://$COVERAGE_DIR/global/index.html"
echo "📋 Résumé détaillé: $TEST_RESULTS_DIR/summary.md"
echo

if [[ $test_exit_code -eq 0 ]]; then
  echo -e "${GREEN}✅ Tous les tests ont réussi!${NC}"
  echo -e "${GREEN}🚀 Les composants d'exceptions et utilitaires sont prêts pour la production${NC}"
else
  echo -e "${RED}❌ Certains tests ont échoué${NC}"
  echo -e "${YELLOW}🔧 Consultez les logs pour plus de détails:${NC}"
  echo "   - $TEST_RESULTS_DIR/*.log"
  echo "   - $COVERAGE_DIR/global/index.html"
fi

echo
echo -e "${BLUE}💡 Conseils:${NC}"
echo "   - Pour des tests en continu: npm run test:watch -- --config=jest.exceptions-utils.config.js"
echo "   - Pour debugger: npm run test:debug -- --config=jest.exceptions-utils.config.js"
echo "   - Pour les performances: npm run test -- --config=jest.exceptions-utils.config.js --detectOpenHandles"

exit $test_exit_code