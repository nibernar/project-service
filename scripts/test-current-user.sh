#!/bin/bash

# scripts/test-current-user.sh
# Script de test pour le décorateur CurrentUser

set -e

# Configuration des couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
TEST_RESULTS_DIR="$PROJECT_ROOT/test-results/current-user-decorator"
COVERAGE_DIR="$PROJECT_ROOT/coverage/current-user-decorator"

# Fonction d'affichage avec couleurs
print_header() {
    echo ""
    echo -e "${BLUE}================================================${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}================================================${NC}"
    echo ""
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${CYAN}ℹ️  $1${NC}"
}

# Fonction de nettoyage
cleanup() {
    print_info "Nettoyage en cours..."
    # Killer d'éventuels processus Jest restants
    pkill -f "jest.*current-user" 2>/dev/null || true
    sleep 1
}

# Fonction de validation des prérequis
check_prerequisites() {
    print_header "Vérification des prérequis"
    
    # Vérifier Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js n'est pas installé"
        exit 1
    fi
    print_success "Node.js: $(node --version)"
    
    # Vérifier npm
    if ! command -v npm &> /dev/null; then
        print_error "npm n'est pas installé"
        exit 1
    fi
    print_success "npm: $(npm --version)"
    
    # Vérifier que nous sommes dans le bon répertoire
    if [[ ! -f "$PROJECT_ROOT/package.json" ]]; then
        print_error "package.json non trouvé. Êtes-vous dans le bon répertoire?"
        exit 1
    fi
    
    # Vérifier les dépendances
    if [[ ! -d "$PROJECT_ROOT/node_modules" ]]; then
        print_warning "node_modules non trouvé, installation des dépendances..."
        cd "$PROJECT_ROOT"
        npm ci
    fi
    
    print_success "Prérequis validés"
}

# Fonction de préparation de l'environnement
setup_environment() {
    print_header "Préparation de l'environnement de test"
    
    # Créer les répertoires de résultats
    mkdir -p "$TEST_RESULTS_DIR"
    mkdir -p "$COVERAGE_DIR"
    
    # Variables d'environnement pour les tests
    export NODE_ENV=test
    export NODE_OPTIONS="--expose-gc --max-old-space-size=4096"
    export JEST_WORKERS="75%"
    
    # Configuration spécifique pour les tests de performance
    export PERFORMANCE_TESTS=true
    export SECURITY_TESTS=true
    export MEMORY_LIMIT_MB=1024
    
    print_success "Environnement configuré"
}

# Fonction de tests unitaires
run_unit_tests() {
    print_header "Exécution des tests unitaires"
    
    cd "$PROJECT_ROOT"
    
    local jest_config="jest.current-user.config.js"
    local test_file="test/unit/common/decorators/current-user.decorator.spec.ts"
    
    if npm run test -- --config="$jest_config" "$test_file" --verbose; then
        print_success "Tests unitaires réussis"
        return 0
    else
        print_error "Échec des tests unitaires"
        return 1
    fi
}

# Fonction de tests edge cases
run_edge_case_tests() {
    print_header "Exécution des tests edge cases"
    
    cd "$PROJECT_ROOT"
    
    local jest_config="jest.current-user.config.js"
    local test_file="test/unit/common/decorators/current-user.decorator.edge-cases.spec.ts"
    
    if npm run test -- --config="$jest_config" "$test_file" --verbose; then
        print_success "Tests edge cases réussis"
        return 0
    else
        print_error "Échec des tests edge cases"
        return 1
    fi
}

# Fonction de tests de sécurité
run_security_tests() {
    print_header "Exécution des tests de sécurité"
    
    cd "$PROJECT_ROOT"
    
    local jest_config="jest.current-user.config.js"
    local test_file="test/unit/common/decorators/current-user.decorator.security.spec.ts"
    
    print_info "Tests de sécurité incluant :"
    print_info "  - Protection contre les injections XSS"
    print_info "  - Protection contre les injections SQL"
    print_info "  - Protection contre les attaques temporelles"
    print_info "  - Validation de l'intégrité des données"
    
    if npm run test -- --config="$jest_config" "$test_file" --verbose; then
        print_success "Tests de sécurité réussis"
        return 0
    else
        print_error "Échec des tests de sécurité"
        return 1
    fi
}

# Fonction de tests de performance
run_performance_tests() {
    print_header "Exécution des tests de performance"
    
    cd "$PROJECT_ROOT"
    
    local jest_config="jest.current-user.config.js"
    local test_file="test/unit/common/decorators/current-user.decorator.performance.spec.ts"
    
    print_info "Tests de performance incluant :"
    print_info "  - Vitesse d'exécution (< 1ms par appel)"
    print_info "  - Utilisation mémoire (pas de fuites)"
    print_info "  - Tests de stress (10k+ appels)"
    print_info "  - Benchmarks de régression"
    
    # Configuration spéciale pour les tests de performance
    export NODE_OPTIONS="--expose-gc --max-old-space-size=8192"
    
    if npm run test -- --config="$jest_config" "$test_file" --verbose --runInBand; then
        print_success "Tests de performance réussis"
        return 0
    else
        print_error "Échec des tests de performance ou timeout (5min)"
        return 1
    fi
}

# Fonction de tests de régression
run_regression_tests() {
    print_header "Exécution des tests de régression"
    
    cd "$PROJECT_ROOT"
    
    local jest_config="jest.current-user.config.js"
    local test_file="test/unit/common/decorators/current-user.decorator.regression.spec.ts"
    
    print_info "Tests de régression incluant :"
    print_info "  - Régression de performance"
    print_info "  - Régression de compatibilité"
    print_info "  - Régression fonctionnelle"
    print_info "  - Régression de sécurité"
    
    if npm run test -- --config="$jest_config" "$test_file" --verbose; then
        print_success "Tests de régression réussis"
        return 0
    else
        print_error "Échec des tests de régression"
        return 1
    fi
}

# Fonction de tests complets avec couverture
run_full_test_suite() {
    print_header "Exécution de la suite complète de tests"
    
    cd "$PROJECT_ROOT"
    
    local jest_config="jest.current-user.config.js"
    
    print_info "Suite complète incluant tous les types de tests avec couverture"
    
    if npm run test -- --config="$jest_config" --coverage --verbose; then
        print_success "Suite complète de tests réussie"
        return 0
    else
        print_error "Échec de la suite complète de tests"
        return 1
    fi
}

# Fonction de génération de rapport
generate_report() {
    print_header "Génération du rapport de tests"
    
    local report_file="$TEST_RESULTS_DIR/current-user-test-report.html"
    local coverage_file="$COVERAGE_DIR/lcov-report/index.html"
    
    if [[ -f "$report_file" ]]; then
        print_success "Rapport de tests généré : $report_file"
    else
        print_warning "Rapport de tests non trouvé"
    fi
    
    if [[ -f "$coverage_file" ]]; then
        print_success "Rapport de couverture généré : $coverage_file"
        
        # Extraire le pourcentage de couverture
        if command -v lcov &> /dev/null && [[ -f "$COVERAGE_DIR/lcov.info" ]]; then
            local coverage_summary
            coverage_summary=$(lcov --summary "$COVERAGE_DIR/lcov.info" 2>/dev/null | grep "lines" | awk '{print $2}')
            if [[ -n "$coverage_summary" ]]; then
                print_info "Couverture des lignes : $coverage_summary"
            fi
        fi
    else
        print_warning "Rapport de couverture non trouvé"
    fi
    
    # Générer un résumé
    echo ""
    print_info "=== RÉSUMÉ DES TESTS ==="
    echo "📂 Répertoire des résultats : $TEST_RESULTS_DIR"
    echo "📊 Répertoire de couverture : $COVERAGE_DIR"
    echo "🏷️  Configuration Jest : jest.current-user.config.js"
    echo ""
}

# Fonction de validation de la couverture
validate_coverage() {
    print_header "Validation de la couverture de code"
    
    local coverage_json="$COVERAGE_DIR/coverage-final.json"
    
    if [[ ! -f "$coverage_json" ]]; then
        print_warning "Fichier de couverture non trouvé, validation ignorée"
        return 0
    fi
    
    # Utiliser jq si disponible pour analyser la couverture
    if command -v jq &> /dev/null; then
        local coverage_percent
        coverage_percent=$(jq -r '.total.lines.pct // 0' "$coverage_json" 2>/dev/null)
        
        if (( $(echo "$coverage_percent >= 95" | bc -l) )); then
            print_success "Couverture des lignes : ${coverage_percent}% (✅ ≥ 95%)"
        else
            print_warning "Couverture des lignes : ${coverage_percent}% (⚠️ < 95%)"
        fi
    else
        print_info "jq non disponible, validation de couverture ignorée"
    fi
}

# Fonction de nettoyage des artefacts
clean_artifacts() {
    print_header "Nettoyage des anciens artefacts"
    
    # Supprimer les anciens résultats
    if [[ -d "$TEST_RESULTS_DIR" ]]; then
        rm -rf "$TEST_RESULTS_DIR"
        print_success "Anciens résultats supprimés"
    fi
    
    if [[ -d "$COVERAGE_DIR" ]]; then
        rm -rf "$COVERAGE_DIR"
        print_success "Ancienne couverture supprimée"
    fi
    
    # Nettoyer le cache Jest
    cd "$PROJECT_ROOT"
    npx jest --clearCache --config=jest.current-user.config.js &>/dev/null || true
    print_success "Cache Jest nettoyé"
}

# Fonction d'aide
show_help() {
    echo "Usage: $0 [OPTION]"
    echo ""
    echo "Tests pour le décorateur CurrentUser du Project Service"
    echo ""
    echo "Options:"
    echo "  unit            Exécuter seulement les tests unitaires"
    echo "  edge-cases      Exécuter seulement les tests edge cases"
    echo "  security        Exécuter seulement les tests de sécurité"
    echo "  performance     Exécuter seulement les tests de performance"
    echo "  regression      Exécuter seulement les tests de régression"
    echo "  full            Exécuter la suite complète avec couverture (défaut)"
    echo "  clean           Nettoyer les artefacts de test"
    echo "  report          Générer seulement le rapport (si tests déjà exécutés)"
    echo "  help            Afficher cette aide"
    echo ""
    echo "Exemples:"
    echo "  $0                    # Suite complète"
    echo "  $0 unit              # Tests unitaires seulement"
    echo "  $0 performance       # Tests de performance seulement"
    echo "  $0 clean && $0 full  # Nettoyage puis suite complète"
    echo ""
}

# Fonction principale
main() {
    local test_type="${1:-full}"
    local exit_code=0
    
    # Traitement des arguments
    case "$test_type" in
        "help"|"-h"|"--help")
            show_help
            exit 0
            ;;
        "clean")
            clean_artifacts
            exit 0
            ;;
        "report")
            generate_report
            validate_coverage
            exit 0
            ;;
    esac
    
    # Trap pour nettoyage en cas d'interruption
    trap cleanup EXIT INT TERM
    
    # Étapes communes
    check_prerequisites
    setup_environment
    
    # Exécution selon le type demandé
    case "$test_type" in
        "unit")
            run_unit_tests || exit_code=$?
            ;;
        "edge-cases")
            run_edge_case_tests || exit_code=$?
            ;;
        "security")
            run_security_tests || exit_code=$?
            ;;
        "performance")
            run_performance_tests || exit_code=$?
            ;;
        "regression")
            run_regression_tests || exit_code=$?
            ;;
        "full")
            # Suite complète avec tous les types de tests
            run_unit_tests || exit_code=$?
            if [[ $exit_code -eq 0 ]]; then
                run_edge_case_tests || exit_code=$?
            fi
            if [[ $exit_code -eq 0 ]]; then
                run_security_tests || exit_code=$?
            fi
            if [[ $exit_code -eq 0 ]]; then
                run_performance_tests || exit_code=$?
            fi
            if [[ $exit_code -eq 0 ]]; then
                run_regression_tests || exit_code=$?
            fi
            if [[ $exit_code -eq 0 ]]; then
                run_full_test_suite || exit_code=$?
            fi
            ;;
        *)
            print_error "Type de test non reconnu: $test_type"
            show_help
            exit 1
            ;;
    esac
    
    # Génération du rapport
    generate_report
    validate_coverage
    
    # Résultat final
    echo ""
    if [[ $exit_code -eq 0 ]]; then
        print_success "🎉 TOUS LES TESTS SONT PASSÉS !"
        print_info "Les tests du décorateur CurrentUser sont validés."
    else
        print_error "💥 ÉCHEC DES TESTS"
        print_info "Vérifiez les logs ci-dessus pour plus de détails."
    fi
    
    exit $exit_code
}

# Point d'entrée
main "$@"