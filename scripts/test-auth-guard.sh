#!/bin/bash

# test-auth-guard-fixed.sh - Script corrigé pour macOS et tous environnements

set -e  # Exit on any error

# ============================================================================
# CONFIGURATION ET VARIABLES
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration des tests
TEST_RESULTS_DIR="$PROJECT_ROOT/test-results/auth-guard"
COVERAGE_DIR="$PROJECT_ROOT/coverage/auth-guard"

# ============================================================================
# FONCTIONS UTILITAIRES
# ============================================================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_section() {
    echo -e "\n${PURPLE}============================================${NC}"
    echo -e "${PURPLE}$1${NC}"
    echo -e "${PURPLE}============================================${NC}"
}

# Fonction timeout compatible macOS/Linux
run_with_timeout() {
    local timeout_duration=$1
    shift
    local command=("$@")
    
    # Vérifier si timeout (Linux) ou gtimeout (macOS avec coreutils) est disponible
    if command -v timeout >/dev/null 2>&1; then
        timeout "$timeout_duration" "${command[@]}"
    elif command -v gtimeout >/dev/null 2>&1; then
        gtimeout "$timeout_duration" "${command[@]}"
    else
        # Fallback sans timeout - exécution directe
        log_warning "Timeout non disponible, exécution sans limite de temps"
        "${command[@]}"
    fi
}

cleanup() {
    log_info "Nettoyage en cours..."
    
    # Tuer les processus Node.js orphelins
    pkill -f "jest.*auth-guard" 2>/dev/null || true
    
    # Nettoyer les fichiers temporaires
    rm -f /tmp/auth-guard-test-* 2>/dev/null || true
    
    log_info "Nettoyage terminé"
}

check_dependencies() {
    log_section "VÉRIFICATION DES DÉPENDANCES"
    
    # Vérifier Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js n'est pas installé"
        exit 1
    fi
    
    node_version=$(node --version)
    log_info "Node.js version: $node_version"
    
    # Vérifier npm
    if ! command -v npm &> /dev/null; then
        log_error "npm n'est pas installé"
        exit 1
    fi
    
    npm_version=$(npm --version)
    log_info "npm version: $npm_version"
    
    # Vérifier Jest
    if ! npx jest --version &> /dev/null; then
        log_error "Jest n'est pas disponible"
        exit 1
    fi
    
    jest_version=$(npx jest --version)
    log_info "Jest version: $jest_version"
    
    # Vérifier les dépendances du projet
    if [ ! -f "$PROJECT_ROOT/package.json" ]; then
        log_error "package.json non trouvé dans $PROJECT_ROOT"
        exit 1
    fi
    
    if [ ! -d "$PROJECT_ROOT/node_modules" ]; then
        log_warning "node_modules non trouvé, installation des dépendances..."
        cd "$PROJECT_ROOT" && npm ci
    fi
    
    log_success "Toutes les dépendances sont disponibles"
}

setup_test_environment() {
    log_section "CONFIGURATION DE L'ENVIRONNEMENT DE TEST"
    
    # Créer les répertoires de résultats
    mkdir -p "$TEST_RESULTS_DIR"
    mkdir -p "$COVERAGE_DIR"
    
    # Configuration des variables d'environnement
    export NODE_ENV=test
    export NODE_OPTIONS="--max-old-space-size=2048"
    export JEST_VERBOSE_LOGS=false
    export AUTH_SERVICE_URL=http://localhost:3001
    export AUTH_SERVICE_TIMEOUT=5000
    export AUTH_CACHE_TTL=300
    export REDIS_HOST=localhost
    export REDIS_PORT=6379
    
    # Nettoyer les anciens résultats si demandé
    if [ "$CLEAN_RESULTS" = "true" ]; then
        log_info "Nettoyage des anciens résultats..."
        rm -rf "$TEST_RESULTS_DIR"/*
        rm -rf "$COVERAGE_DIR"/*
    fi
    
    log_success "Environnement de test configuré"
}

check_test_files() {
    log_section "VÉRIFICATION DES FICHIERS DE TEST"
    
    local required_files=(
        "test/unit/common/guards/auth.guard.spec.ts"
        "test/unit/common/guards/auth.guard.edge-cases.spec.ts"
        "test/unit/common/guards/auth.guard.regression.spec.ts"
        "test/unit/common/guards/auth.guard.performance.spec.ts"
        "test/unit/common/guards/auth.guard.security.spec.ts"
        "test/integration/common/guards/auth.guard.integration.spec.ts"
        "test/setup/auth-guard-test-setup.ts"
        "jest.auth-guard.config.js"
    )
    
    local missing_files=()
    
    for file in "${required_files[@]}"; do
        if [ ! -f "$PROJECT_ROOT/$file" ]; then
            missing_files+=("$file")
        fi
    done
    
    if [ ${#missing_files[@]} -gt 0 ]; then
        log_error "Fichiers de test manquants:"
        for file in "${missing_files[@]}"; do
            log_error "  ❌ $file"
        done
        log_error ""
        log_error "Vous devez créer ces fichiers avant d'exécuter les tests."
        log_error "Consultez les artefacts fournis par l'assistant pour le contenu."
        exit 1
    fi
    
    log_success "Tous les fichiers de test sont présents"
}

install_missing_dependencies() {
    log_section "VÉRIFICATION DES DÉPENDANCES DE TEST"
    
    # Vérifier si les dépendances de test sont installées
    local missing_deps=()
    
    # Dépendances essentielles pour les tests
    if ! npm list jest-html-reporters >/dev/null 2>&1; then
        missing_deps+=("jest-html-reporters")
    fi
    
    if ! npm list jest-junit >/dev/null 2>&1; then
        missing_deps+=("jest-junit")
    fi
    
    if ! npm list ioredis-mock >/dev/null 2>&1; then
        missing_deps+=("ioredis-mock")
    fi
    
    if [ ${#missing_deps[@]} -gt 0 ]; then
        log_warning "Installation des dépendances manquantes..."
        cd "$PROJECT_ROOT"
        for dep in "${missing_deps[@]}"; do
            log_info "Installation de $dep..."
            npm install --save-dev "$dep" || log_warning "Échec installation $dep"
        done
    fi
    
    log_success "Dépendances vérifiées"
}

run_specific_test() {
    local test_file=$1
    local test_name=$2
    
    if [ -f "$PROJECT_ROOT/$test_file" ]; then
        log_info "Exécution: $test_file"
        
        cd "$PROJECT_ROOT"
        if run_with_timeout 120 npx jest \
            --config jest.auth-guard.config.js \
            --testPathPattern="$test_file" \
            --verbose \
            --detectOpenHandles \
            --forceExit; then
            log_success "✅ $test_name - RÉUSSI"
            return 0
        else
            log_error "❌ $test_name - ÉCHEC"
            return 1
        fi
    else
        log_warning "⚠️  Fichier non trouvé: $test_file"
        return 0
    fi
}

run_unit_tests() {
    log_section "TESTS UNITAIRES AUTHGUARD"
    
    local failed_tests=()
    local test_files=(
        "test/unit/common/guards/auth.guard.spec.ts:Tests unitaires de base"
        "test/unit/common/guards/auth.guard.edge-cases.spec.ts:Tests des cas limites"
        "test/unit/common/guards/auth.guard.regression.spec.ts:Tests de régression"
    )
    
    for test_info in "${test_files[@]}"; do
        IFS=':' read -r test_file test_name <<< "$test_info"
        if ! run_specific_test "$test_file" "$test_name"; then
            failed_tests+=("$test_file")
        fi
    done
    
    if [ ${#failed_tests[@]} -eq 0 ]; then
        log_success "Tous les tests unitaires ont réussi"
        return 0
    else
        log_error "Tests unitaires échoués: ${failed_tests[*]}"
        return 1
    fi
}

run_performance_tests() {
    log_section "TESTS DE PERFORMANCE AUTHGUARD"
    
    run_specific_test \
        "test/unit/common/guards/auth.guard.performance.spec.ts" \
        "Tests de performance"
    return $?
}

run_security_tests() {
    log_section "TESTS DE SÉCURITÉ AUTHGUARD"
    
    run_specific_test \
        "test/unit/common/guards/auth.guard.security.spec.ts" \
        "Tests de sécurité"
    return $?
}

run_integration_tests() {
    log_section "TESTS D'INTÉGRATION AUTHGUARD"
    
    run_specific_test \
        "test/integration/common/guards/auth.guard.integration.spec.ts" \
        "Tests d'intégration"
    return $?
}

run_coverage_analysis() {
    log_section "ANALYSE DE COUVERTURE"
    
    log_info "Génération du rapport de couverture..."
    
    cd "$PROJECT_ROOT"
    if npx jest \
        --config jest.auth-guard.config.js \
        --coverage \
        --coverageReporters=text \
        --coverageReporters=html \
        --coverageReporters=lcov \
        --passWithNoTests \
        --silent; then
        
        log_success "✅ Rapport de couverture généré"
        
        if [ -f "$COVERAGE_DIR/lcov-report/index.html" ]; then
            log_info "📊 Rapport HTML disponible: $COVERAGE_DIR/lcov-report/index.html"
        fi
        
        return 0
    else
        log_error "❌ Échec de génération du rapport de couverture"
        return 1
    fi
}

validate_test_results() {
    log_section "VALIDATION DES RÉSULTATS"
    
    local validation_passed=true
    
    # Vérifier la présence des répertoires
    if [ ! -d "$TEST_RESULTS_DIR" ]; then
        log_error "Répertoire de résultats manquant"
        validation_passed=false
    fi
    
    # Compter les fichiers de test
    local test_files_count=0
    if [ -d "$PROJECT_ROOT/test" ]; then
        test_files_count=$(find "$PROJECT_ROOT/test" -name "*auth.guard*.spec.ts" 2>/dev/null | wc -l | tr -d ' ')
    fi
    log_info "📈 Fichiers de test détectés: $test_files_count"
    
    if [ "$validation_passed" = true ]; then
        log_success "✅ Validation des résultats réussie"
        return 0
    else
        log_error "❌ Validation des résultats échouée"
        return 1
    fi
}

generate_summary_report() {
    log_section "GÉNÉRATION DU RAPPORT DE SYNTHÈSE"
    
    local summary_file="$TEST_RESULTS_DIR/auth-guard-summary-$TIMESTAMP.md"
    
    cat > "$summary_file" << EOF
# Rapport de Tests AuthGuard

**Date d'exécution:** $(date)
**Durée totale:** $((SECONDS / 60)) minutes et $((SECONDS % 60)) secondes

## Résumé des Tests

### Statut
- Configuration Jest: ✅ Corrigée
- Dépendances: ✅ Vérifiées
- Environnement: ✅ Configuré

### Fichiers Requis
Pour une exécution complète, vous devez créer:
- test/unit/common/guards/auth.guard.spec.ts
- test/unit/common/guards/auth.guard.edge-cases.spec.ts
- test/unit/common/guards/auth.guard.regression.spec.ts
- test/integration/common/guards/auth.guard.integration.spec.ts
- test/setup/auth-guard-test-setup.ts

## Fichiers de Résultats

- **Répertoire de résultats:** \`$TEST_RESULTS_DIR\`
- **Couverture:** \`$COVERAGE_DIR\`

## Prochaines Étapes

1. Créer les fichiers de test manquants (voir artefacts de l'assistant)
2. Réexécuter: \`./scripts/test-auth-guard-fixed.sh\`

---
*Généré par test-auth-guard-fixed.sh*
EOF

    log_success "📄 Rapport de synthèse généré: $summary_file"
}

show_help() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Script corrigé pour tester le AuthGuard (compatible macOS/Linux)"
    echo ""
    echo "OPTIONS:"
    echo "  -h, --help              Afficher cette aide"
    echo "  -u, --unit-only         Tests unitaires seulement"
    echo "  -p, --performance-only  Tests de performance seulement"
    echo "  -s, --security-only     Tests de sécurité seulement"
    echo "  -i, --integration-only  Tests d'intégration seulement"
    echo "  -c, --coverage-only     Rapport de couverture seulement"
    echo "  --check-only            Vérifier les fichiers seulement"
    echo "  --install-deps          Installer les dépendances manquantes"
    echo "  --clean                 Nettoyer les anciens résultats"
    echo "  --verbose               Mode verbeux"
    echo ""
    echo "Exemples:"
    echo "  $0 --check-only         # Vérifier les fichiers requis"
    echo "  $0 --install-deps       # Installer les dépendances"
    echo "  $0 --unit-only          # Tests unitaires seulement"
}

# ============================================================================
# GESTION DES SIGNAUX
# ============================================================================

trap cleanup EXIT
trap 'log_error "Script interrompu"; exit 130' INT TERM

# ============================================================================
# ANALYSE DES ARGUMENTS
# ============================================================================

UNIT_ONLY=false
PERFORMANCE_ONLY=false
SECURITY_ONLY=false
INTEGRATION_ONLY=false
COVERAGE_ONLY=false
CHECK_ONLY=false
INSTALL_DEPS=false
CLEAN_RESULTS=false
VERBOSE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -u|--unit-only)
            UNIT_ONLY=true
            shift
            ;;
        -p|--performance-only)
            PERFORMANCE_ONLY=true
            shift
            ;;
        -s|--security-only)
            SECURITY_ONLY=true
            shift
            ;;
        -i|--integration-only)
            INTEGRATION_ONLY=true
            shift
            ;;
        -c|--coverage-only)
            COVERAGE_ONLY=true
            shift
            ;;
        --check-only)
            CHECK_ONLY=true
            shift
            ;;
        --install-deps)
            INSTALL_DEPS=true
            shift
            ;;
        --clean)
            CLEAN_RESULTS=true
            shift
            ;;
        --verbose)
            VERBOSE=true
            export JEST_VERBOSE_LOGS=true
            shift
            ;;
        *)
            log_error "Option inconnue: $1"
            show_help
            exit 1
            ;;
    esac
done

# ============================================================================
# EXÉCUTION PRINCIPALE
# ============================================================================

main() {
    local start_time=$SECONDS
    local exit_code=0
    
    log_section "🚀 TESTS AUTHGUARD - VERSION CORRIGÉE"
    log_info "Répertoire du projet: $PROJECT_ROOT"
    log_info "Système: $(uname -s)"
    
    # Vérifications préliminaires
    check_dependencies
    setup_test_environment
    
    # Changer vers le répertoire du projet
    cd "$PROJECT_ROOT"
    
    # Vérification des fichiers
    if [ "$CHECK_ONLY" = true ]; then
        check_test_files
        exit 0
    fi
    
    # Installation des dépendances
    if [ "$INSTALL_DEPS" = true ]; then
        install_missing_dependencies
        exit 0
    fi
    
    # Vérifier les fichiers avant d'exécuter les tests
    if ! check_test_files; then
        exit_code=1
    else
        # Installer les dépendances si nécessaire
        install_missing_dependencies
        
        # Exécution des tests selon les options
        if [ "$COVERAGE_ONLY" = true ]; then
            run_coverage_analysis || exit_code=1
        elif [ "$UNIT_ONLY" = true ]; then
            run_unit_tests || exit_code=1
        elif [ "$PERFORMANCE_ONLY" = true ]; then
            run_performance_tests || exit_code=1
        elif [ "$SECURITY_ONLY" = true ]; then
            run_security_tests || exit_code=1
        elif [ "$INTEGRATION_ONLY" = true ]; then
            run_integration_tests || exit_code=1
        else
            # Exécuter tous les tests
            run_unit_tests || exit_code=1
            run_performance_tests || exit_code=1
            run_security_tests || exit_code=1
            run_integration_tests || exit_code=1
            run_coverage_analysis || exit_code=1
        fi
    fi
    
    # Validation et rapports
    validate_test_results
    generate_summary_report
    
    # Résumé final
    local duration=$((SECONDS - start_time))
    log_section "🏁 RÉSULTATS FINAUX"
    log_info "Durée totale: $((duration / 60))m $((duration % 60))s"
    
    if [ $exit_code -eq 0 ]; then
        log_success "🎉 Exécution réussie!"
    else
        log_error "❌ Des problèmes ont été détectés (code: $exit_code)"
    fi
    
    log_info "📋 Consultez le rapport: $TEST_RESULTS_DIR/auth-guard-summary-$TIMESTAMP.md"
    
    exit $exit_code
}

# Exécuter le script principal
main "$@"