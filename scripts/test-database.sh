#!/bin/bash

# scripts/test-database.sh
# Script principal pour lancer tous les tests du DatabaseService

set -e  # Arrêter en cas d'erreur

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration par défaut
DEFAULT_TEST_TYPE="unit"
DEFAULT_COVERAGE="false"
DEFAULT_WATCH="false"
DEFAULT_VERBOSE="false"

# Fonction d'aide
show_help() {
    echo -e "${BLUE}Database Service Test Runner${NC}"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -t, --type TYPE        Type de tests à exécuter (unit|integration|e2e|performance|security|all)"
    echo "  -c, --coverage         Générer le rapport de couverture"
    echo "  -w, --watch           Mode watch (redémarrage automatique)"
    echo "  -v, --verbose         Mode verbose"
    echo "  -h, --help            Afficher cette aide"
    echo "  --setup-only          Effectuer seulement le setup"
    echo "  --cleanup-only        Effectuer seulement le nettoyage"
    echo "  --emergency-cleanup   Nettoyage d'urgence"
    echo ""
    echo "Types de tests:"
    echo "  unit                  Tests unitaires uniquement"
    echo "  integration           Tests d'intégration avec vraie DB"
    echo "  e2e                   Tests end-to-end complets"
    echo "  performance           Tests de performance et stress"
    echo "  security              Tests de sécurité"
    echo "  all                   Tous les types de tests"
    echo ""
    echo "Variables d'environnement:"
    echo "  TEST_DATABASE_URL     URL de la base de données de test"
    echo "  INTEGRATION_DATABASE_URL  URL pour les tests d'intégration"
    echo "  E2E_DATABASE_URL      URL pour les tests E2E"
    echo "  REDIS_HOST            Host Redis (défaut: localhost)"
    echo "  REDIS_PORT            Port Redis (défaut: 6379)"
    echo ""
    echo "Exemples:"
    echo "  $0 -t unit -c         Tests unitaires avec couverture"
    echo "  $0 -t integration -v  Tests d'intégration en mode verbose"
    echo "  $0 -t all --coverage  Tous les tests avec couverture"
    echo "  $0 --setup-only       Setup uniquement"
}

# Fonction de log avec couleurs
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Fonction pour vérifier les prérequis
check_prerequisites() {
    log_info "Vérification des prérequis..."
    
    # Vérifier Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js n'est pas installé"
        exit 1
    fi
    
    # Vérifier npm
    if ! command -v npm &> /dev/null; then
        log_error "npm n'est pas installé"
        exit 1
    fi
    
    # Vérifier les dépendances
    if [ ! -d "node_modules" ]; then
        log_warning "node_modules manquant, installation des dépendances..."
        npm install
    fi
    
    log_success "Prérequis vérifiés"
}

# Fonction pour setup l'environnement
setup_environment() {
    log_info "Configuration de l'environnement de test..."
    
    # Variables d'environnement de base
    export NODE_ENV=test
    export PRISMA_HIDE_UPDATE_MESSAGE=true
    
    # Configuration des bases de données
    if [ -z "$TEST_DATABASE_URL" ]; then
        export TEST_DATABASE_URL="postgresql://nicolasbernard@localhost:5432/project_service_test_db"
        log_warning "TEST_DATABASE_URL non définie, utilisation de la valeur par défaut"
    fi
    
    if [ -z "$INTEGRATION_DATABASE_URL" ]; then
        export INTEGRATION_DATABASE_URL="postgresql://nicolasbernard@localhost:5432/project_service_integration_test_db"
    fi
    
    if [ -z "$E2E_DATABASE_URL" ]; then
        export E2E_DATABASE_URL="postgresql://nicolasbernard@localhost:5432/project_service_e2e_test_db"
    fi
    
    # Configuration Redis
    export REDIS_HOST=${REDIS_HOST:-localhost}
    export REDIS_PORT=${REDIS_PORT:-6379}
    export REDIS_DB=1  # Base dédiée aux tests
    
    log_success "Environnement configuré"
}

# Fonction pour vérifier les services
check_services() {
    log_info "Vérification des services..."
    
    # Vérifier PostgreSQL
    if ! pg_isready -h localhost -p 5433 -U test_user -d postgres &> /dev/null; then
        log_warning "PostgreSQL non accessible sur localhost:5433"
        log_info "Tentative de connexion sur le port par défaut..."
        if ! pg_isready -h localhost -p 5432 -U postgres -d postgres &> /dev/null; then
            log_error "PostgreSQL n'est pas accessible. Assurez-vous qu'il est démarré."
            return 1
        fi
    fi
    
    # Vérifier Redis (optionnel)
    if command -v redis-cli &> /dev/null; then
        if ! redis-cli -h $REDIS_HOST -p $REDIS_PORT ping &> /dev/null; then
            log_warning "Redis non accessible sur $REDIS_HOST:$REDIS_PORT"
        else
            log_success "Redis accessible"
        fi
    fi
    
    log_success "Services vérifiés"
}

# Fonction pour vérifier si des tests existent pour un pattern donné
check_tests_exist() {
    local pattern="$1"
    
    if [ "$VERBOSE" = "true" ]; then
        log_info "🔍 Recherche de tests pour le pattern: $pattern"
    fi
    
    case $pattern in
        "unit")
            if [ -f "test/unit/common/database/database.service.spec.ts" ] || \
               [ -d "test/unit" ] && find test/unit -name "*.spec.ts" -o -name "*.test.ts" 2>/dev/null | head -1 | grep -q .; then
                return 0
            fi
            ;;
        "integration")
            if [ -f "test/integration/project.integration.spec.ts" ] || \
               [ -d "test/integration" ] && find test/integration -name "*.spec.ts" -o -name "*.test.ts" 2>/dev/null | head -1 | grep -q .; then
                return 0
            fi
            ;;
        "e2e")
            # Debug pour E2E
            if [ "$VERBOSE" = "true" ]; then
                log_info "🔍 Vérification répertoire E2E:"
                if [ -d "test/e2e" ]; then
                    log_info "Répertoire test/e2e/ existe"
                    log_info "Contenu:"
                    ls -la test/e2e/
                else
                    log_warning "Répertoire test/e2e/ n'existe pas"
                fi
            fi
            
            # Vérifier directement le fichier E2E
            if [ -f "test/e2e/project.e2e-spec.ts" ] || \
               [ -f "test/e2e/project.e2e.spec.ts" ] || \
               ([ -d "test/e2e" ] && find test/e2e -name "*.spec.ts" -o -name "*.test.ts" 2>/dev/null | head -1 | grep -q .); then
                return 0
            fi
            ;;
        "performance")
            if [ -d "test/performance" ] && find test/performance -name "*.spec.ts" -o -name "*.test.ts" 2>/dev/null | head -1 | grep -q .; then
                return 0
            fi
            # Chercher aussi des fichiers avec "performance" dans le nom
            if find test -name "*performance*.spec.ts" -o -name "*performance*.test.ts" 2>/dev/null | head -1 | grep -q .; then
                return 0
            fi
            ;;
        "security")
            # Chercher les fichiers de sécurité (on sait qu'ils existent dans unit/)
            if find test -name "*security*.spec.ts" -o -name "*security*.test.ts" 2>/dev/null | head -1 | grep -q .; then
                return 0
            fi
            ;;
        *)
            # Recherche générale
            if find test -name "*${pattern}*.spec.ts" -o -name "*${pattern}*.test.ts" 2>/dev/null | head -1 | grep -q .; then
                return 0
            fi
            ;;
    esac
    
    if [ "$VERBOSE" = "true" ]; then
        log_warning "Aucun fichier de test trouvé pour: $pattern"
    fi
    
    return 1
}

# Fonction pour exécuter Jest avec gestion d'erreur améliorée
run_jest_with_error_handling() {
    local jest_args="$1"
    local test_type="$2"
    
    log_info "Exécution de Jest avec les arguments: $jest_args"
    
    # Exécuter Jest et capturer le code de sortie
    if npx jest $jest_args; then
        log_success "Tests $test_type terminés avec succès"
        return 0
    else
        local exit_code=$?
        log_error "Tests $test_type ont échoué (code: $exit_code)"
        return $exit_code
    fi
}

# Fonction pour lancer les tests unitaires
run_unit_tests() {
    log_info "Lancement des tests unitaires..."
    
    if ! check_tests_exist "unit"; then
        log_warning "Aucun test unitaire trouvé"
        return 0
    fi
    
    local jest_args="--config jest.database.config.js --testPathPattern=unit"
    
    if [ "$COVERAGE" = "true" ]; then
        jest_args="$jest_args --coverage"
    fi
    
    if [ "$WATCH" = "true" ]; then
        jest_args="$jest_args --watch"
    fi
    
    if [ "$VERBOSE" = "true" ]; then
        jest_args="$jest_args --verbose"
        export DEBUG_TESTS=true
    fi
    
    run_jest_with_error_handling "$jest_args" "unitaires"
}

# Fonction pour lancer les tests d'intégration
run_integration_tests() {
    log_info "Lancement des tests d'intégration..."
    log_warning "Nécessite une base de données PostgreSQL accessible"
    
    if ! check_tests_exist "integration"; then
        log_warning "Aucun test d'intégration trouvé"
        return 0
    fi
    
    local jest_args="--config jest.database.config.js --testPathPattern=integration --runInBand"
    
    if [ "$COVERAGE" = "true" ]; then
        jest_args="$jest_args --coverage"
    fi
    
    if [ "$VERBOSE" = "true" ]; then
        jest_args="$jest_args --verbose"
        export DEBUG_TESTS=true
    fi
    
    # Timeout plus long pour l'intégration
    export JEST_TIMEOUT=60000
    
    run_jest_with_error_handling "$jest_args" "d'intégration"
}

# Fonction pour lancer les tests E2E
run_e2e_tests() {
    log_info "Lancement des tests E2E..."
    log_warning "Nécessite une base de données PostgreSQL dédiée"
    
    if ! check_tests_exist "e2e"; then
        log_warning "Aucun test E2E trouvé"
        return 0
    fi
    
    local jest_args="--config jest.database.config.js --testPathPattern=e2e --runInBand"
    
    if [ "$COVERAGE" = "true" ]; then
        jest_args="$jest_args --coverage"
    fi
    
    if [ "$VERBOSE" = "true" ]; then
        jest_args="$jest_args --verbose"
        export DEBUG_TESTS=true
    fi
    
    # Timeout très long pour E2E
    export JEST_TIMEOUT=120000
    
    run_jest_with_error_handling "$jest_args" "E2E"
}

# Fonction pour lancer les tests de performance
run_performance_tests() {
    log_info "Lancement des tests de performance..."
    log_warning "Ces tests peuvent prendre plusieurs minutes"
    
    if ! check_tests_exist "performance"; then
        log_warning "Aucun test de performance trouvé - ignoré"
        log_info "Pour créer des tests de performance, ajoutez des fichiers dans test/performance/"
        return 0
    fi
    
    export RUN_PERFORMANCE_TESTS=true
    
    local jest_args="--config jest.database.config.js --testPathPattern=performance --runInBand --maxWorkers=1"
    
    if [ "$VERBOSE" = "true" ]; then
        jest_args="$jest_args --verbose"
        export DEBUG_TESTS=true
    fi
    
    # Timeout très long pour les tests de performance
    export JEST_TIMEOUT=300000  # 5 minutes
    
    run_jest_with_error_handling "$jest_args" "de performance"
}

# Fonction pour lancer les tests de sécurité
run_security_tests() {
    log_info "Lancement des tests de sécurité..."
    
    if ! check_tests_exist "security"; then
        log_warning "Aucun test de sécurité trouvé"
        return 0
    fi
    
    local jest_args="--config jest.database.config.js --testPathPattern=security"
    
    if [ "$COVERAGE" = "true" ]; then
        jest_args="$jest_args --coverage"
    fi
    
    if [ "$VERBOSE" = "true" ]; then
        jest_args="$jest_args --verbose"
        export DEBUG_TESTS=true
    fi
    
    run_jest_with_error_handling "$jest_args" "de sécurité"
}

# Fonction pour lancer tous les tests
run_all_tests() {
    log_info "Lancement de tous les tests..."
    
    local overall_exit_code=0
    
    # Ordre optimal d'exécution
    log_info "1/5 - Tests unitaires"
    run_unit_tests || overall_exit_code=1
    
    log_info "2/5 - Tests de sécurité"
    run_security_tests || overall_exit_code=1
    
    log_info "3/5 - Tests d'intégration"
    run_integration_tests || overall_exit_code=1
    
    log_info "4/5 - Tests E2E"
    run_e2e_tests || overall_exit_code=1
    
    log_info "5/5 - Tests de performance"
    run_performance_tests || overall_exit_code=1
    
    if [ $overall_exit_code -eq 0 ]; then
        log_success "Tous les tests terminés avec succès"
    else
        log_error "Certains tests ont échoué"
    fi
    
    return $overall_exit_code
}

# Fonction de setup uniquement
setup_only() {
    log_info "Setup uniquement..."
    
    check_prerequisites
    setup_environment
    check_services
    
    # Exécuter le setup global
    if npx ts-node test/setup/global-setup.ts; then
        log_success "Setup terminé"
        return 0
    else
        log_error "Échec du setup"
        return 1
    fi
}

# Fonction de nettoyage uniquement
cleanup_only() {
    log_info "Nettoyage uniquement..."
    
    # Exécuter le teardown global
    if npx ts-node test/setup/global-teardown.ts; then
        log_success "Nettoyage terminé"
        return 0
    else
        log_error "Échec du nettoyage"
        return 1
    fi
}

# Fonction de nettoyage d'urgence
emergency_cleanup() {
    log_warning "Nettoyage d'urgence..."
    
    # Tuer tous les processus Jest
    pkill -f "jest.*database" || true
    pkill -f "node.*prisma" || true
    
    # Exécuter le teardown d'urgence
    if npx ts-node test/setup/global-teardown.ts --emergency; then
        log_success "Nettoyage d'urgence terminé"
        return 0
    else
        log_error "Échec du nettoyage d'urgence"
        return 1
    fi
}

# Fonction pour afficher le résumé final
show_summary() {
    local exit_code=$1
    
    echo ""
    echo "================================"
    
    if [ $exit_code -eq 0 ]; then
        log_success "Tests terminés avec succès"
    else
        log_error "Tests terminés avec des erreurs"
    fi
    
    # Afficher les rapports générés
    if [ "$COVERAGE" = "true" ] && [ -d "coverage" ]; then
        log_info "Rapport de couverture disponible dans: coverage/"
    fi
    
    if [ -d "test-results" ]; then
        log_info "Rapports de test disponibles dans: test-results/"
    fi
    
    echo "================================"
}

# Fonction principale
main() {
    local test_type="$DEFAULT_TEST_TYPE"
    local coverage="$DEFAULT_COVERAGE"
    local watch="$DEFAULT_WATCH"
    local verbose="$DEFAULT_VERBOSE"
    local setup_only_flag=false
    local cleanup_only_flag=false
    local emergency_cleanup_flag=false
    
    # Parser les arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -t|--type)
                test_type="$2"
                shift 2
                ;;
            -c|--coverage)
                coverage="true"
                shift
                ;;
            -w|--watch)
                watch="true"
                shift
                ;;
            -v|--verbose)
                verbose="true"
                shift
                ;;
            --setup-only)
                setup_only_flag=true
                shift
                ;;
            --cleanup-only)
                cleanup_only_flag=true
                shift
                ;;
            --emergency-cleanup)
                emergency_cleanup_flag=true
                shift
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            *)
                log_error "Option inconnue: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    # Exporter les variables pour les sous-processus
    export COVERAGE="$coverage"
    export WATCH="$watch"
    export VERBOSE="$verbose"
    
    echo -e "${BLUE}"
    echo "╔══════════════════════════════════════╗"
    echo "║      Database Service Test Runner    ║"
    echo "╚══════════════════════════════════════╝"
    echo -e "${NC}"
    
    # Gestion des actions spéciales
    if [ "$emergency_cleanup_flag" = true ]; then
        emergency_cleanup
        exit $?
    fi
    
    if [ "$cleanup_only_flag" = true ]; then
        cleanup_only
        exit $?
    fi
    
    if [ "$setup_only_flag" = true ]; then
        setup_only
        exit $?
    fi
    
    # Configuration standard
    check_prerequisites
    setup_environment
    check_services
    
    # Trap pour nettoyage en cas d'interruption
    trap 'log_warning "Interruption détectée, nettoyage..."; cleanup_only; exit 130' INT TERM
    
    local exit_code=0
    
    # Lancer les tests selon le type
    case $test_type in
        unit)
            run_unit_tests || exit_code=$?
            ;;
        integration)
            run_integration_tests || exit_code=$?
            ;;
        e2e)
            run_e2e_tests || exit_code=$?
            ;;
        performance)
            run_performance_tests || exit_code=$?
            ;;
        security)
            run_security_tests || exit_code=$?
            ;;
        all)
            run_all_tests || exit_code=$?
            ;;
        *)
            log_error "Type de test invalide: $test_type"
            show_help
            exit 1
            ;;
    esac
    
    # Afficher le résumé
    show_summary $exit_code
    
    exit $exit_code
}

# Point d'entrée
main "$@"