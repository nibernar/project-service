#!/bin/bash

# =============================================================================
# Script de test complet pour project-response.dto.ts
# =============================================================================

set -e  # Arrêt en cas d'erreur
set -u  # Arrêt si variable non définie

# =============================================================================
# CONFIGURATION
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
TEST_NAME="project-response-dto"
TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
LOG_DIR="${PROJECT_ROOT}/logs/tests/${TEST_NAME}"
COVERAGE_DIR="${PROJECT_ROOT}/coverage/${TEST_NAME}"

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# =============================================================================
# FONCTIONS UTILITAIRES
# =============================================================================

log() {
    echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[$(date '+%H:%M:%S')] ✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}[$(date '+%H:%M:%S')] ⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}[$(date '+%H:%M:%S')] ❌ $1${NC}"
}

log_info() {
    echo -e "${CYAN}[$(date '+%H:%M:%S')] ℹ️  $1${NC}"
}

# Affichage du header
print_header() {
    echo -e "${PURPLE}"
    echo "========================================================================"
    echo "               TESTS COMPLETS - PROJECT RESPONSE DTO"
    echo "========================================================================"
    echo -e "${NC}"
    echo "📁 Projet     : $(basename "${PROJECT_ROOT}")"
    echo "🎯 Composant  : src/project/dto/project-response.dto.ts"
    echo "📅 Timestamp  : ${TIMESTAMP}"
    echo "📊 Couverture : ${COVERAGE_DIR}"
    echo "📝 Logs       : ${LOG_DIR}"
    echo
}

# Vérification des prérequis
check_prerequisites() {
    log "Vérification des prérequis..."
    
    # Vérifier que nous sommes dans le bon répertoire
    if [[ ! -f "${PROJECT_ROOT}/package.json" ]]; then
        log_error "Pas de package.json trouvé. Exécutez ce script depuis la racine du projet."
        exit 1
    fi
    
    # Vérifier que le fichier DTO existe
    if [[ ! -f "${PROJECT_ROOT}/src/project/dto/project-response.dto.ts" ]]; then
        log_error "Fichier project-response.dto.ts non trouvé."
        exit 1
    fi
    
    # Vérifier que le fichier de test existe
    if [[ ! -f "${PROJECT_ROOT}/test/unit/project/dto/project-response.dto.spec.ts" ]]; then
        log_error "Fichier de test project-response.dto.spec.ts non trouvé."
        exit 1
    fi
    
    # Vérifier que la configuration Jest existe
    if [[ ! -f "${PROJECT_ROOT}/jest.project-response-dto.config.js" ]]; then
        log_error "Configuration Jest jest.project-response-dto.config.js non trouvée."
        exit 1
    fi
    
    # Vérifier Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js n'est pas installé."
        exit 1
    fi
    
    # Vérifier npm
    if ! command -v npm &> /dev/null; then
        log_error "npm n'est pas installé."
        exit 1
    fi
    
    log_success "Tous les prérequis sont satisfaits"
}

# Création des répertoires
create_directories() {
    log "Création des répertoires de logs et couverture..."
    
    mkdir -p "${LOG_DIR}"
    mkdir -p "${COVERAGE_DIR}"
    
    log_success "Répertoires créés"
}

# Installation des dépendances si nécessaire
install_dependencies() {
    log "Vérification des dépendances..."
    
    if [[ ! -d "${PROJECT_ROOT}/node_modules" ]]; then
        log_warning "node_modules manquant, installation des dépendances..."
        cd "${PROJECT_ROOT}"
        npm ci
        log_success "Dépendances installées"
    else
        log_info "Dépendances déjà installées"
    fi
}

# Nettoyage avant les tests
cleanup_before_tests() {
    log "Nettoyage avant les tests..."
    
    # Supprimer les anciens rapports
    rm -rf "${COVERAGE_DIR}"/*
    rm -rf "${PROJECT_ROOT}/.jest-cache/${TEST_NAME}"
    
    # Créer les répertoires nécessaires
    mkdir -p "${COVERAGE_DIR}"
    
    log_success "Nettoyage terminé"
}

# Compilation TypeScript pour vérifier la syntaxe
compile_typescript() {
    log "Compilation TypeScript..."
    
    cd "${PROJECT_ROOT}"
    
    if npx tsc --noEmit --project tsconfig.json > "${LOG_DIR}/typescript_${TIMESTAMP}.log" 2>&1; then
        log_success "Compilation TypeScript réussie"
    else
        log_error "Erreurs de compilation TypeScript détectées"
        echo "Voir les détails dans: ${LOG_DIR}/typescript_${TIMESTAMP}.log"
        cat "${LOG_DIR}/typescript_${TIMESTAMP}.log"
        exit 1
    fi
}

# Exécution des tests avec métriques détaillées
run_tests() {
    log "Exécution des tests ProjectResponseDto..."
    
    cd "${PROJECT_ROOT}"
    
    local start_time=$(date +%s)
    local test_log="${LOG_DIR}/tests_${TIMESTAMP}.log"
    local test_json="${LOG_DIR}/tests_${TIMESTAMP}.json"
    
    # Configuration des variables d'environnement pour les tests
    export NODE_ENV=test
    export TZ=UTC
    
    # Commande de test avec toutes les options
    local jest_cmd="npx jest \
        --config=jest.project-response-dto.config.js \
        --coverage \
        --verbose \
        --detectOpenHandles \
        --forceExit \
        --json \
        --outputFile=\"${test_json}\" \
        --testTimeout=30000 \
        --maxWorkers=50% \
        --logHeapUsage"
    
    log_info "Commande: ${jest_cmd}"
    
    if eval "${jest_cmd}" > "${test_log}" 2>&1; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        
        log_success "Tests réussis en ${duration}s"
        
        # Afficher le résumé des tests
        show_test_summary "${test_json}" "${duration}"
        
        return 0
    else
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        
        log_error "Tests échoués après ${duration}s"
        
        # Afficher les erreurs
        echo
        log_error "=== ERREURS DE TESTS ==="
        tail -50 "${test_log}"
        
        # Tenter d'afficher le résumé quand même
        if [[ -f "${test_json}" ]]; then
            show_test_summary "${test_json}" "${duration}"
        fi
        
        return 1
    fi
}

# Affichage du résumé des tests
show_test_summary() {
    local test_json="$1"
    local duration="$2"
    
    if [[ ! -f "${test_json}" ]]; then
        log_warning "Fichier de résumé JSON non trouvé"
        return
    fi
    
    log_info "=== RÉSUMÉ DES TESTS ==="
    
    # Utiliser jq si disponible, sinon grep/sed
    if command -v jq &> /dev/null; then
        local total_tests=$(jq '.numTotalTests' "${test_json}" 2>/dev/null || echo "N/A")
        local passed_tests=$(jq '.numPassedTests' "${test_json}" 2>/dev/null || echo "N/A")
        local failed_tests=$(jq '.numFailedTests' "${test_json}" 2>/dev/null || echo "N/A")
        local test_suites=$(jq '.numTotalTestSuites' "${test_json}" 2>/dev/null || echo "N/A")
        
        echo "📊 Tests total    : ${total_tests}"
        echo "✅ Tests réussis  : ${passed_tests}"
        echo "❌ Tests échoués  : ${failed_tests}"
        echo "📁 Test suites    : ${test_suites}"
        echo "⏱️  Durée         : ${duration}s"
    else
        echo "📊 Résumé disponible dans: ${test_json}"
        echo "⏱️  Durée         : ${duration}s"
    fi
}

# Analyse de la couverture de code
analyze_coverage() {
    log "Analyse de la couverture de code..."
    
    local coverage_summary="${COVERAGE_DIR}/coverage-summary.json"
    local coverage_lcov="${COVERAGE_DIR}/lcov.info"
    
    if [[ -f "${coverage_summary}" ]]; then
        log_info "=== COUVERTURE DE CODE ==="
        
        if command -v jq &> /dev/null; then
            # Extraire les métriques de couverture
            local lines_pct=$(jq -r '.total.lines.pct' "${coverage_summary}" 2>/dev/null || echo "N/A")
            local statements_pct=$(jq -r '.total.statements.pct' "${coverage_summary}" 2>/dev/null || echo "N/A")
            local functions_pct=$(jq -r '.total.functions.pct' "${coverage_summary}" 2>/dev/null || echo "N/A")
            local branches_pct=$(jq -r '.total.branches.pct' "${coverage_summary}" 2>/dev/null || echo "N/A")
            
            echo "📏 Lignes         : ${lines_pct}%"
            echo "📝 Déclarations   : ${statements_pct}%"
            echo "🔧 Fonctions      : ${functions_pct}%"
            echo "🌳 Branches       : ${branches_pct}%"
            
            # Vérifier si on atteint 100%
            if [[ "${lines_pct}" == "100" && "${statements_pct}" == "100" && "${functions_pct}" == "100" && "${branches_pct}" == "100" ]]; then
                log_success "🎯 Couverture complète atteinte (100%)"
            else
                log_warning "🎯 Couverture incomplète détectée"
            fi
        else
            log_info "📊 Détails disponibles dans: ${COVERAGE_DIR}/index.html"
        fi
        
        log_info "📁 Rapport HTML : ${COVERAGE_DIR}/index.html"
        log_info "📄 Rapport LCOV : ${coverage_lcov}"
    else
        log_warning "Rapport de couverture non trouvé"
    fi
}

# Validation de la qualité du code
validate_code_quality() {
    log "Validation de la qualité du code..."
    
    cd "${PROJECT_ROOT}"
    
    # ESLint sur le fichier DTO
    log_info "Vérification ESLint..."
    if npx eslint "src/project/dto/project-response.dto.ts" > "${LOG_DIR}/eslint_${TIMESTAMP}.log" 2>&1; then
        log_success "ESLint: Aucun problème détecté"
    else
        log_warning "ESLint: Problèmes détectés"
        cat "${LOG_DIR}/eslint_${TIMESTAMP}.log"
    fi
    
    # Prettier check
    log_info "Vérification Prettier..."
    if npx prettier --check "src/project/dto/project-response.dto.ts" > "${LOG_DIR}/prettier_${TIMESTAMP}.log" 2>&1; then
        log_success "Prettier: Formatage correct"
    else
        log_warning "Prettier: Formatage incorrect"
        cat "${LOG_DIR}/prettier_${TIMESTAMP}.log"
    fi
}

# Analyse des métriques de test
analyze_test_metrics() {
    log "Analyse des métriques de test..."
    
    local test_file="${PROJECT_ROOT}/test/unit/project/dto/project-response.dto.spec.ts"
    
    if [[ -f "${test_file}" ]]; then
        local total_lines=$(wc -l < "${test_file}")
        local test_cases=$(grep -c "it(" "${test_file}" || echo "0")
        local describe_blocks=$(grep -c "describe(" "${test_file}" || echo "0")
        local expect_assertions=$(grep -c "expect(" "${test_file}" || echo "0")
        
        log_info "=== MÉTRIQUES DE TEST ==="
        echo "📄 Lignes de test    : ${total_lines}"
        echo "🧪 Cas de test       : ${test_cases}"
        echo "📦 Blocs describe    : ${describe_blocks}"
        echo "✔️  Assertions       : ${expect_assertions}"
        
        if [[ ${test_cases} -gt 50 ]]; then
            log_success "Couverture de test excellente (${test_cases} cas)"
        elif [[ ${test_cases} -gt 30 ]]; then
            log_info "Couverture de test bonne (${test_cases} cas)"
        else
            log_warning "Couverture de test limitée (${test_cases} cas)"
        fi
    fi
}

# Génération du rapport final
generate_final_report() {
    log "Génération du rapport final..."
    
    local report_file="${LOG_DIR}/final_report_${TIMESTAMP}.md"
    
    cat > "${report_file}" << EOF
# Rapport de Test - ProjectResponseDto

**Date**: $(date)
**Composant**: src/project/dto/project-response.dto.ts
**Test Suite**: test/unit/project/dto/project-response.dto.spec.ts

## Résumé Exécutif

EOF
    
    # Ajouter les métriques si disponibles
    if [[ -f "${COVERAGE_DIR}/coverage-summary.json" ]] && command -v jq &> /dev/null; then
        echo "## Couverture de Code" >> "${report_file}"
        echo "" >> "${report_file}"
        
        local lines_pct=$(jq -r '.total.lines.pct' "${COVERAGE_DIR}/coverage-summary.json" 2>/dev/null)
        local statements_pct=$(jq -r '.total.statements.pct' "${COVERAGE_DIR}/coverage-summary.json" 2>/dev/null)
        local functions_pct=$(jq -r '.total.functions.pct' "${COVERAGE_DIR}/coverage-summary.json" 2>/dev/null)
        local branches_pct=$(jq -r '.total.branches.pct' "${COVERAGE_DIR}/coverage-summary.json" 2>/dev/null)
        
        echo "- **Lignes**: ${lines_pct}%" >> "${report_file}"
        echo "- **Déclarations**: ${statements_pct}%" >> "${report_file}"
        echo "- **Fonctions**: ${functions_pct}%" >> "${report_file}"
        echo "- **Branches**: ${branches_pct}%" >> "${report_file}"
        echo "" >> "${report_file}"
    fi
    
    echo "## Fichiers Générés" >> "${report_file}"
    echo "" >> "${report_file}"
    echo "- **Rapport HTML**: [${COVERAGE_DIR}/index.html](${COVERAGE_DIR}/index.html)" >> "${report_file}"
    echo "- **Rapport LCOV**: [${COVERAGE_DIR}/lcov.info](${COVERAGE_DIR}/lcov.info)" >> "${report_file}"
    echo "- **Logs détaillés**: [${LOG_DIR}/](${LOG_DIR}/)" >> "${report_file}"
    echo "" >> "${report_file}"
    
    log_success "Rapport final généré: ${report_file}"
}

# Nettoyage après les tests
cleanup_after_tests() {
    log "Nettoyage après les tests..."
    
    # Supprimer les fichiers temporaires
    rm -rf "${PROJECT_ROOT}/.jest-cache/${TEST_NAME}"
    
    # Archiver les logs anciens (garder seulement les 5 derniers)
    if [[ -d "${LOG_DIR}" ]]; then
        find "${LOG_DIR}" -name "*.log" -type f -mtime +5 -delete 2>/dev/null || true
    fi
    
    log_success "Nettoyage terminé"
}

# Affichage de l'aide
show_help() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -h, --help          Afficher cette aide"
    echo "  -v, --verbose       Mode verbeux"
    echo "  -q, --quiet         Mode silencieux"
    echo "  --no-coverage       Désactiver la couverture de code"
    echo "  --no-lint           Désactiver les vérifications de qualité"
    echo "  --watch             Mode watch (tests en continu)"
    echo ""
    echo "Exemples:"
    echo "  $0                  Exécution normale"
    echo "  $0 --verbose        Exécution avec logs détaillés"
    echo "  $0 --no-coverage    Tests sans couverture de code"
    echo ""
}

# =============================================================================
# SCRIPT PRINCIPAL
# =============================================================================

main() {
    local verbose=false
    local quiet=false
    local skip_coverage=false
    local skip_lint=false
    local watch_mode=false
    
    # Traitement des arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_help
                exit 0
                ;;
            -v|--verbose)
                verbose=true
                shift
                ;;
            -q|--quiet)
                quiet=true
                shift
                ;;
            --no-coverage)
                skip_coverage=true
                shift
                ;;
            --no-lint)
                skip_lint=true
                shift
                ;;
            --watch)
                watch_mode=true
                shift
                ;;
            *)
                log_error "Option inconnue: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    # Configuration du logging
    if [[ "${quiet}" == "true" ]]; then
        exec > /dev/null 2>&1
    fi
    
    # Début de l'exécution
    local overall_start_time=$(date +%s)
    
    print_header
    
    # Exécution des étapes
    check_prerequisites
    create_directories
    install_dependencies
    cleanup_before_tests
    
    # Compilation TypeScript
    if [[ "${skip_lint}" != "true" ]]; then
        compile_typescript
    fi
    
    # Tests principaux
    if run_tests; then
        # Analyses post-test en cas de succès
        if [[ "${skip_coverage}" != "true" ]]; then
            analyze_coverage
        fi
        
        if [[ "${skip_lint}" != "true" ]]; then
            validate_code_quality
        fi
        
        analyze_test_metrics
        generate_final_report
        
        # Temps total
        local overall_end_time=$(date +%s)
        local total_duration=$((overall_end_time - overall_start_time))
        
        echo
        log_success "🎉 TOUS LES TESTS RÉUSSIS!"
        log_info "⏱️  Durée totale: ${total_duration}s"
        log_info "📊 Rapport: ${LOG_DIR}/final_report_${TIMESTAMP}.md"
        
        if [[ "${skip_coverage}" != "true" ]]; then
            log_info "🌐 Rapport HTML: ${COVERAGE_DIR}/index.html"
        fi
        
        cleanup_after_tests
        exit 0
    else
        # Gestion des échecs
        local overall_end_time=$(date +%s)
        local total_duration=$((overall_end_time - overall_start_time))
        
        echo
        log_error "💥 TESTS ÉCHOUÉS!"
        log_info "⏱️  Durée totale: ${total_duration}s"
        log_info "📝 Logs: ${LOG_DIR}/"
        
        cleanup_after_tests
        exit 1
    fi
}

# Point d'entrée
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi