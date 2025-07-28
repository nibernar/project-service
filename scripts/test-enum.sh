#!/bin/bash

# scripts/test-enum.sh
# Script d'exécution des tests pour le module project-status.enum.ts
#
# Usage: ./scripts/test-enum.sh [options]
# Options:
#   -h, --help              Afficher l'aide
#   -a, --all              Exécuter tous les types de tests
#   -u, --unit             Exécuter les tests unitaires
#   -p, --performance      Exécuter les tests de performance
#   -s, --security         Exécuter les tests de sécurité
#   -i, --integration      Exécuter les tests d'intégration
#   -e, --edge-cases       Exécuter les tests d'edge cases
#   -r, --regression       Exécuter les tests de régression
#   -c, --coverage         Génerer le rapport de couverture
#   -w, --watch            Mode watch (re-exécution automatique)
#   -v, --verbose          Mode verbose
#   --no-cache             Désactiver le cache Jest
#   --fail-fast            Arrêter à la première erreur

set -e  # Arrêter le script en cas d'erreur

# Couleurs pour l'output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Variables par défaut
RUN_ALL=false
RUN_UNIT=false
RUN_PERFORMANCE=false
RUN_SECURITY=false
RUN_INTEGRATION=false
RUN_EDGE_CASES=false
RUN_REGRESSION=false
GENERATE_COVERAGE=false
WATCH_MODE=false
VERBOSE=false
NO_CACHE=false
FAIL_FAST=false

# Fonction d'aide
show_help() {
    cat << EOF
Script d'exécution des tests pour le module project-status.enum.ts

Usage: $0 [options]

Options:
    -h, --help              Afficher cette aide
    -a, --all              Exécuter tous les types de tests
    -u, --unit             Exécuter les tests unitaires
    -p, --performance      Exécuter les tests de performance
    -s, --security         Exécuter les tests de sécurité
    -i, --integration      Exécuter les tests d'intégration
    -e, --edge-cases       Exécuter les tests d'edge cases
    -r, --regression       Exécuter les tests de régression
    -c, --coverage         Générer le rapport de couverture
    -w, --watch            Mode watch (re-exécution automatique)
    -v, --verbose          Mode verbose
    --no-cache             Désactiver le cache Jest
    --fail-fast            Arrêter à la première erreur

Exemples:
    $0 -a                  # Exécuter tous les tests
    $0 -u -c               # Tests unitaires avec couverture
    $0 -p -s               # Tests de performance et sécurité
    $0 -a -w               # Tous les tests en mode watch
    $0 --integration --verbose  # Tests d'intégration en mode verbose

Types de tests:
    📋 Unitaires     : Tests de base des fonctions et comportements
    ⚡ Performance   : Tests de rapidité et efficacité mémoire
    🛡️  Sécurité     : Tests contre injections et attaques
    🔗 Intégration   : Tests avec Prisma et l'écosystème NestJS
    🎯 Edge Cases    : Tests des cas limites et situations exceptionnelles
    📊 Régression    : Tests de non-régression et compatibilité

EOF
}

# Parse des arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -a|--all)
            RUN_ALL=true
            shift
            ;;
        -u|--unit)
            RUN_UNIT=true
            shift
            ;;
        -p|--performance)
            RUN_PERFORMANCE=true
            shift
            ;;
        -s|--security)
            RUN_SECURITY=true
            shift
            ;;
        -i|--integration)
            RUN_INTEGRATION=true
            shift
            ;;
        -e|--edge-cases)
            RUN_EDGE_CASES=true
            shift
            ;;
        -r|--regression)
            RUN_REGRESSION=true
            shift
            ;;
        -c|--coverage)
            GENERATE_COVERAGE=true
            shift
            ;;
        -w|--watch)
            WATCH_MODE=true
            shift
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        --no-cache)
            NO_CACHE=true
            shift
            ;;
        --fail-fast)
            FAIL_FAST=true
            shift
            ;;
        *)
            echo -e "${RED}❌ Option inconnue: $1${NC}"
            show_help
            exit 1
            ;;
    esac
done

# Si aucune option spécifique, afficher l'aide
if [[ "$RUN_ALL" == false && "$RUN_UNIT" == false && "$RUN_PERFORMANCE" == false && "$RUN_SECURITY" == false && "$RUN_INTEGRATION" == false && "$RUN_EDGE_CASES" == false && "$RUN_REGRESSION" == false ]]; then
    echo -e "${YELLOW}⚠️  Aucun type de test spécifié. Utiliser -h pour voir l'aide.${NC}"
    exit 1
fi

# Si --all est spécifié, activer tous les tests
if [[ "$RUN_ALL" == true ]]; then
    RUN_UNIT=true
    RUN_PERFORMANCE=true
    RUN_SECURITY=true
    RUN_INTEGRATION=true
    RUN_EDGE_CASES=true
    RUN_REGRESSION=true
fi

# Vérification des prérequis
echo -e "${BLUE}🔍 Vérification des prérequis...${NC}"

if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm n'est pas installé${NC}"
    exit 1
fi

if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ package.json introuvable. Exécuter depuis la racine du projet.${NC}"
    exit 1
fi

if [ ! -f "jest.enum.config.js" ]; then
    echo -e "${YELLOW}⚠️  jest.enum.config.js introuvable. Utilisation de la config par défaut.${NC}"
fi

# Créer les dossiers de résultats s'ils n'existent pas
mkdir -p test-results/enum
mkdir -p coverage/enum

# Construction des arguments Jest
JEST_ARGS=""

if [[ "$VERBOSE" == true ]]; then
    JEST_ARGS="$JEST_ARGS --verbose"
fi

if [[ "$NO_CACHE" == true ]]; then
    JEST_ARGS="$JEST_ARGS --no-cache"
fi

if [[ "$FAIL_FAST" == true ]]; then
    JEST_ARGS="$JEST_ARGS --bail"
fi

if [[ "$WATCH_MODE" == true ]]; then
    JEST_ARGS="$JEST_ARGS --watch"
fi

if [[ "$GENERATE_COVERAGE" == true ]]; then
    JEST_ARGS="$JEST_ARGS --coverage --coverageDirectory=coverage/enum"
fi

# Configuration Jest
JEST_CONFIG=""
if [ -f "jest.enum.config.js" ]; then
    JEST_CONFIG="--config jest.enum.config.js"
fi

# Fonction pour exécuter un type de test
run_test_type() {
    local test_type=$1
    local test_pattern=$2
    local emoji=$3
    local description=$4
    
    echo -e "\n${emoji} ${BLUE}Exécution des tests ${description}...${NC}"
    
    local test_command="npx jest $JEST_CONFIG $JEST_ARGS --testNamePattern=\"$test_pattern\""
    
    if [[ "$VERBOSE" == true ]]; then
        echo -e "${CYAN}Commande: $test_command${NC}"
    fi
    
    if eval $test_command; then
        echo -e "${GREEN}✅ Tests ${description} : SUCCÈS${NC}"
        return 0
    else
        echo -e "${RED}❌ Tests ${description} : ÉCHEC${NC}"
        return 1
    fi
}

# Fonction pour exécuter un fichier de test spécifique
run_test_file() {
    local test_file=$1
    local emoji=$2
    local description=$3
    
    echo -e "\n${emoji} ${BLUE}Exécution des tests ${description}...${NC}"
    
    if [ ! -f "$test_file" ]; then
        echo -e "${YELLOW}⚠️  Fichier de test introuvable: $test_file${NC}"
        return 0
    fi
    
    local test_command="npx jest $JEST_CONFIG $JEST_ARGS $test_file"
    
    if [[ "$VERBOSE" == true ]]; then
        echo -e "${CYAN}Commande: $test_command${NC}"
    fi
    
    if eval $test_command; then
        echo -e "${GREEN}✅ Tests ${description} : SUCCÈS${NC}"
        return 0
    else
        echo -e "${RED}❌ Tests ${description} : ÉCHEC${NC}"
        return 1
    fi
}

# Variables pour tracking des résultats
TOTAL_TESTS=0
FAILED_TESTS=0
START_TIME=$(date +%s)

echo -e "\n${PURPLE}🚀 Démarrage des tests ProjectStatus Enum${NC}"
echo -e "${PURPLE}================================================${NC}"

# Exécution des tests selon les options
if [[ "$RUN_UNIT" == true ]]; then
    ((TOTAL_TESTS++))
    if ! run_test_file "test/unit/common/enums/project-status.enum.spec.ts" "📋" "unitaires"; then
        ((FAILED_TESTS++))
    fi
fi

if [[ "$RUN_PERFORMANCE" == true ]]; then
    ((TOTAL_TESTS++))
    if ! run_test_file "test/unit/common/enums/project-status.enum.performance.spec.ts" "⚡" "de performance"; then
        ((FAILED_TESTS++))
    fi
fi

if [[ "$RUN_SECURITY" == true ]]; then
    ((TOTAL_TESTS++))
    if ! run_test_file "test/unit/common/enums/project-status.enum.security.spec.ts" "🛡️" "de sécurité"; then
        ((FAILED_TESTS++))
    fi
fi

if [[ "$RUN_INTEGRATION" == true ]]; then
    ((TOTAL_TESTS++))
    if ! run_test_file "test/integration/project-status.enum.integration.spec.ts" "🔗" "d'intégration"; then
        ((FAILED_TESTS++))
    fi
fi

if [[ "$RUN_EDGE_CASES" == true ]]; then
    ((TOTAL_TESTS++))
    if ! run_test_file "test/unit/common/enums/project-status.enum.edge-cases.spec.ts" "🎯" "d'edge cases"; then
        ((FAILED_TESTS++))
    fi
fi

if [[ "$RUN_REGRESSION" == true ]]; then
    ((TOTAL_TESTS++))
    if ! run_test_file "test/unit/common/enums/project-status.enum.regression.spec.ts" "📊" "de régression"; then
        ((FAILED_TESTS++))
    fi
fi

# Calcul du temps d'exécution
END_TIME=$(date +%s)
EXECUTION_TIME=$((END_TIME - START_TIME))

# Résumé final
echo -e "\n${PURPLE}📊 RÉSUMÉ DES TESTS${NC}"
echo -e "${PURPLE}==================${NC}"
echo -e "Tests exécutés     : ${TOTAL_TESTS}"
echo -e "Tests réussis      : $((TOTAL_TESTS - FAILED_TESTS))"
echo -e "Tests échoués      : ${FAILED_TESTS}"
echo -e "Temps d'exécution  : ${EXECUTION_TIME}s"

if [[ "$GENERATE_COVERAGE" == true ]]; then
    echo -e "\n${CYAN}📈 Rapport de couverture généré dans: coverage/enum/${NC}"
fi

echo -e "\n${CYAN}📋 Rapport HTML disponible dans: test-results/enum/enum-test-report.html${NC}"

# Code de sortie
if [[ $FAILED_TESTS -eq 0 ]]; then
    echo -e "\n${GREEN}🎉 TOUS LES TESTS ONT RÉUSSI !${NC}"
    exit 0
else
    echo -e "\n${RED}💥 $FAILED_TESTS TEST(S) ONT ÉCHOUÉ${NC}"
    exit 1
fi