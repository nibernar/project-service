#!/bin/bash

# Test script for User Interface
# Basé sur le pattern du script test-enum.sh existant

set -e

# Couleurs pour les logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration des chemins
BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEST_DIR="$BASE_DIR/test/unit/common/interfaces"
RESULTS_DIR="$BASE_DIR/test-results/user-interface"

# Options par défaut
COVERAGE=false
WATCH=false
VERBOSE=false

# Fonction d'aide
show_help() {
    echo "Usage: $0 [OPTIONS] [TEST_TYPE]"
    echo ""
    echo "Test types:"
    echo "  --unit            Run main unit tests (user.interface.spec.ts)"
    echo "  --security        Run security tests (user.interface.security.spec.ts)"
    echo "  --performance     Run performance tests (user.interface.performance.spec.ts)"
    echo "  --edge-cases      Run edge cases tests (user.interface.edge-cases.spec.ts)"
    echo "  --regression      Run regression tests (user.interface.regression.spec.ts)"
    echo "  --all             Run all user interface tests (default)"
    echo ""
    echo "Options:"
    echo "  --coverage        Generate coverage report"
    echo "  --watch           Run tests in watch mode"
    echo "  --verbose         Verbose output"
    echo "  --help            Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 --unit                    # Run only main unit tests"
    echo "  $0 --security --coverage     # Run security tests with coverage"
    echo "  $0 --all --watch             # Run all tests in watch mode"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --unit)
            TEST_TYPE="unit"
            shift
            ;;
        --security)
            TEST_TYPE="security"
            shift
            ;;
        --performance)
            TEST_TYPE="performance"
            shift
            ;;
        --edge-cases)
            TEST_TYPE="edge-cases"
            shift
            ;;
        --regression)
            TEST_TYPE="regression"
            shift
            ;;
        --all)
            TEST_TYPE="all"
            shift
            ;;
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
            show_help
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Valeur par défaut pour TEST_TYPE
if [ -z "$TEST_TYPE" ]; then
    TEST_TYPE="all"
fi

# Créer le répertoire des résultats
mkdir -p "$RESULTS_DIR"

# Fonction pour exécuter les tests
run_tests() {
    local test_pattern="$1"
    local test_name="$2"
    local output_file="$RESULTS_DIR/${test_name}-tests.xml"
    local report_file="$RESULTS_DIR/${test_name}-test-report.html"
    
    echo -e "${BLUE}🧪 Running ${test_name} tests...${NC}"
    
    # Construction de la commande Jest
    local jest_cmd="jest"
    local jest_args=()
    
    # Pattern de test
    jest_args+=("--testPathPattern=$test_pattern")
    
    # Configuration spécifique
    jest_args+=("--testTimeout=30000")
    jest_args+=("--maxWorkers=1")
    
    # Mode watch
    if [ "$WATCH" = true ]; then
        jest_args+=("--watch")
    fi
    
    # Coverage
    if [ "$COVERAGE" = true ]; then
        jest_args+=("--coverage")
        jest_args+=("--coverageDirectory=$RESULTS_DIR/coverage")
        jest_args+=("--coverageReporters=text")
        jest_args+=("--coverageReporters=lcov")
        jest_args+=("--coverageReporters=html")
    fi
    
    # Verbose
    if [ "$VERBOSE" = true ]; then
        jest_args+=("--verbose")
    fi
    
    # Rapports
    jest_args+=("--reporters=default")
    jest_args+=("--reporters=jest-junit")
    jest_args+=("--reporters=jest-html-reporters")
    
    # Variables d'environnement pour les rapports
    export JEST_JUNIT_OUTPUT_FILE="$output_file"
    export JEST_HTML_REPORTERS_PUBLIC_PATH="$RESULTS_DIR"
    export JEST_HTML_REPORTERS_FILE_NAME="${test_name}-test-report.html"
    
    # Exécution des tests
    echo -e "${YELLOW}Command: $jest_cmd ${jest_args[*]}${NC}"
    
    if $jest_cmd "${jest_args[@]}"; then
        echo -e "${GREEN}✅ ${test_name} tests passed!${NC}"
        
        # Affichage des liens vers les rapports
        if [ -f "$output_file" ]; then
            echo -e "${BLUE}📊 JUnit report: $output_file${NC}"
        fi
        if [ -f "$report_file" ]; then
            echo -e "${BLUE}📋 HTML report: $report_file${NC}"
        fi
        
        return 0
    else
        echo -e "${RED}❌ ${test_name} tests failed!${NC}"
        return 1
    fi
}

# Fonction principale
main() {
    echo -e "${BLUE}🚀 Starting User Interface Tests${NC}"
    echo -e "${YELLOW}Test type: $TEST_TYPE${NC}"
    echo -e "${YELLOW}Coverage: $COVERAGE${NC}"
    echo -e "${YELLOW}Watch mode: $WATCH${NC}"
    echo ""
    
    # Vérifier que les fichiers de test existent
    if [ ! -d "$TEST_DIR" ]; then
        echo -e "${RED}❌ Test directory not found: $TEST_DIR${NC}"
        exit 1
    fi
    
    local exit_code=0
    
    case $TEST_TYPE in
        "unit")
            run_tests "user\.interface\.spec\.ts$" "user-interface-unit" || exit_code=$?
            ;;
        "security")
            run_tests "user\.interface\.security\.spec\.ts$" "user-interface-security" || exit_code=$?
            ;;
        "performance")
            run_tests "user\.interface\.performance\.spec\.ts$" "user-interface-performance" || exit_code=$?
            ;;
        "edge-cases")
            run_tests "user\.interface\.edge-cases\.spec\.ts$" "user-interface-edge-cases" || exit_code=$?
            ;;
        "regression")
            run_tests "user\.interface\.regression\.spec\.ts$" "user-interface-regression" || exit_code=$?
            ;;
        "all")
            echo -e "${BLUE}🔄 Running all User Interface tests...${NC}"
            
            run_tests "user\.interface\.spec\.ts$" "user-interface-unit" || exit_code=$?
            echo ""
            
            run_tests "user\.interface\.security\.spec\.ts$" "user-interface-security" || exit_code=$?
            echo ""
            
            run_tests "user\.interface\.performance\.spec\.ts$" "user-interface-performance" || exit_code=$?
            echo ""
            
            run_tests "user\.interface\.edge-cases\.spec\.ts$" "user-interface-edge-cases" || exit_code=$?
            echo ""
            
            run_tests "user\.interface\.regression\.spec\.ts$" "user-interface-regression" || exit_code=$?
            ;;
        *)
            echo -e "${RED}❌ Unknown test type: $TEST_TYPE${NC}"
            show_help
            exit 1
            ;;
    esac
    
    # Résumé final
    echo ""
    echo -e "${BLUE}📊 User Interface Tests Summary${NC}"
    
    if [ $exit_code -eq 0 ]; then
        echo -e "${GREEN}✅ All tests passed successfully!${NC}"
        
        if [ "$COVERAGE" = true ]; then
            echo -e "${BLUE}📈 Coverage report: $RESULTS_DIR/coverage/index.html${NC}"
        fi
    else
        echo -e "${RED}❌ Some tests failed (exit code: $exit_code)${NC}"
    fi
    
    echo -e "${BLUE}📁 Results directory: $RESULTS_DIR${NC}"
    
    exit $exit_code
}

# Exécution du script principal
main "$@"