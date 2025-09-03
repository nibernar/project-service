#!/bin/bash
# scripts/test-cache.sh - Cache & Events Testing Script

set -e

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
REDIS_REQUIRED=false
COVERAGE_THRESHOLD=85
HTTP_SERVER_PORT=3335

# Fonctions utilitaires
print_header() {
    echo -e "\n${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}\n"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}" >&2
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${CYAN}ℹ️  $1${NC}"
}

# Vérifier si Redis est disponible
check_redis() {
    print_info "Checking Redis availability..."
    
    if command -v redis-cli >/dev/null 2>&1; then
        if redis-cli ping >/dev/null 2>&1; then
            print_success "Redis server is running"
            return 0
        else
            print_error "Redis server is not running"
            return 1
        fi
    else
        print_error "Redis CLI is not installed"
        return 1
    fi
}

# Démarrer Redis si nécessaire
start_redis_if_needed() {
    if ! check_redis; then
        print_info "Attempting to start Redis with Docker..."
        
        if command -v docker >/dev/null 2>&1; then
            # Vérifier si un conteneur Redis existe déjà
            if docker ps -a --format '{{.Names}}' | grep -q "redis-test"; then
                print_info "Starting existing Redis test container..."
                docker start redis-test >/dev/null 2>&1
            else
                print_info "Creating new Redis test container..."
                docker run -d --name redis-test -p 6379:6379 redis:7-alpine >/dev/null 2>&1
            fi
            
            # Attendre que Redis soit prêt
            for i in {1..30}; do
                if redis-cli ping >/dev/null 2>&1; then
                    print_success "Redis is now running"
                    return 0
                fi
                sleep 1
            done
            
            print_error "Failed to start Redis"
            return 1
        else
            print_error "Docker is not available to start Redis"
            return 1
        fi
    fi
    
    return 0
}

# Nettoyer la base de données de test
clean_test_db() {
    if check_redis; then
        print_info "Cleaning Redis test database..."
        redis-cli -n 1 flushdb >/dev/null 2>&1 || true
        redis-cli -n 2 flushdb >/dev/null 2>&1 || true
        redis-cli -n 14 flushdb >/dev/null 2>&1 || true # E2E tests
        print_success "Test databases cleaned"
    fi
}

# Vérifier si un port est libre
check_port() {
    local port=$1
    if command -v lsof >/dev/null 2>&1; then
        if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
            return 1
        else
            return 0
        fi
    else
        # Si lsof n'est pas disponible, on assume que le port est libre
        return 0
    fi
}

# Afficher l'aide
show_help() {
    echo -e "${CYAN}Cache & Events Testing Script${NC}"
    echo ""
    echo "Usage: $0 [OPTIONS] [TEST_TYPE]"
    echo ""
    echo "Test Types:"
    echo "  unit           Run unit tests only"
    echo "  integration    Run integration tests (requires Redis + HTTP server)"
    echo "  e2e           Run end-to-end tests (requires Redis + HTTP server)"
    echo "  cache-events   Run cache-events combined E2E tests"
    echo "  cache-only     Run only cache tests"
    echo "  events-only    Run only events tests"
    echo "  edge-cases     Run edge cases tests"
    echo "  security       Run security tests"
    echo "  performance    Run performance tests"
    echo "  all            Run all cache & events tests (default)"
    echo ""
    echo "Options:"
    echo "  -h, --help     Show this help message"
    echo "  -v, --verbose  Verbose output"
    echo "  -c, --coverage Show coverage report"
    echo "  --no-redis     Skip Redis-dependent tests"
    echo "  --watch        Run tests in watch mode"
    echo "  --ci           Run in CI mode (strict)"
    echo ""
    echo "Examples:"
    echo "  $0 unit                    # Run unit tests only"
    echo "  $0 integration -v          # Run integration tests with verbose output"
    echo "  $0 cache-events --coverage # Run cache-events E2E tests with coverage"
    echo "  $0 all --coverage          # Run all tests with coverage"
    echo "  $0 --watch unit            # Watch unit tests"
}

# Parser les arguments
VERBOSE=false
SHOW_COVERAGE=false
WATCH_MODE=false
CI_MODE=false
TEST_TYPE="all"

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -c|--coverage)
            SHOW_COVERAGE=true
            shift
            ;;
        --no-redis)
            REDIS_REQUIRED=false
            shift
            ;;
        --watch)
            WATCH_MODE=true
            shift
            ;;
        --ci)
            CI_MODE=true
            shift
            ;;
        unit|integration|e2e|cache-events|cache-only|events-only|edge-cases|security|performance|all)
            TEST_TYPE=$1
            shift
            ;;
        *)
            print_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Configuration des variables d'environnement
export NODE_ENV=test
export REDIS_DB=1
export CACHE_TTL=30
export REDIS_MAX_CONNECTIONS=3
export REDIS_ENABLE_METRICS=false

# Variables d'environnement pour Events
export EVENT_TRANSPORT=http
export ORCHESTRATION_SERVICE_URL=http://localhost:$HTTP_SERVER_PORT
export INTERNAL_SERVICE_TOKEN=test-token
export EVENTS_HTTP_TIMEOUT=5000

if [[ "$VERBOSE" == "true" ]]; then
    export TEST_VERBOSE=true
fi

# Aller dans le répertoire du projet
cd "$PROJECT_DIR"

print_header "CACHE & EVENTS TESTING SUITE"

# Vérifier les prérequis
print_info "Checking prerequisites..."

# Vérifier Node.js
if ! command -v node >/dev/null 2>&1; then
    print_error "Node.js is not installed"
    exit 1
fi

# Vérifier npm
if ! command -v npm >/dev/null 2>&1; then
    print_error "npm is not installed"
    exit 1
fi

print_success "Prerequisites OK"

# Gérer Redis et HTTP server selon le type de test
case $TEST_TYPE in
    integration|e2e|cache-events|all)
        if ! start_redis_if_needed; then
            if [[ "$CI_MODE" == "true" ]]; then
                print_error "Redis is required for CI mode"
                exit 1
            else
                print_warning "Redis not available - skipping integration tests"
                if [[ "$TEST_TYPE" == "integration" || "$TEST_TYPE" == "e2e" || "$TEST_TYPE" == "cache-events" ]]; then
                    print_info "Switching to unit tests only"
                    TEST_TYPE="unit"
                fi
            fi
        else
            clean_test_db
        fi
        
        # Vérifier le port HTTP pour les tests Events
        if [[ "$TEST_TYPE" == "integration" || "$TEST_TYPE" == "e2e" || "$TEST_TYPE" == "cache-events" || "$TEST_TYPE" == "events-only" || "$TEST_TYPE" == "all" ]]; then
            if ! check_port $HTTP_SERVER_PORT; then
                print_warning "Port $HTTP_SERVER_PORT is in use - may affect Events tests"
            fi
        fi
        ;;
    *)
        print_info "Redis/HTTP server not required for $TEST_TYPE tests"
        ;;
esac

# Construire la commande Jest avec le nouveau fichier de configuration
JEST_CMD="npx jest --config jest.cache-events.config.js"

# Ajouter les options selon le type de test
case $TEST_TYPE in
    unit)
        JEST_CMD="$JEST_CMD --testPathPattern='test/unit.*(cache|events).*spec\.ts'"
        print_header "RUNNING UNIT TESTS (CACHE & EVENTS)"
        ;;
    integration)
        JEST_CMD="$JEST_CMD --testPathPattern='test/integration.*(cache|events).*spec\.ts'"
        print_header "RUNNING INTEGRATION TESTS (CACHE & EVENTS)"
        ;;
    e2e)
        JEST_CMD="$JEST_CMD --testPathPattern='test/e2e.*cache.*spec\.ts'"
        print_header "RUNNING E2E TESTS (CACHE & EVENTS)"
        ;;
    cache-events)
        JEST_CMD="$JEST_CMD --testPathPattern='test/e2e/cache-events\.e2e-spec\.ts'"
        print_header "RUNNING CACHE-EVENTS E2E TESTS"
        ;;
    cache-only)
        JEST_CMD="$JEST_CMD --testPathPattern='.*cache.*spec\.ts'"
        print_header "RUNNING CACHE TESTS ONLY"
        ;;
    events-only)
        JEST_CMD="$JEST_CMD --testPathPattern='.*events.*spec\.ts'"
        print_header "RUNNING EVENTS TESTS ONLY"
        ;;
    edge-cases)
        JEST_CMD="$JEST_CMD --testPathPattern='.*edge-cases.*spec\.ts'"
        print_header "RUNNING EDGE CASES TESTS"
        ;;
    security)
        JEST_CMD="$JEST_CMD --testPathPattern='.*security.*spec\.ts'"
        print_header "RUNNING SECURITY TESTS"
        ;;
    performance)
        JEST_CMD="$JEST_CMD --testPathPattern='test/performance.*(cache|events).*spec\.ts'"
        print_header "RUNNING PERFORMANCE TESTS"
        ;;
    all)
        print_header "RUNNING ALL CACHE & EVENTS TESTS"
        ;;
esac

# Ajouter les options globales
if [[ "$WATCH_MODE" == "true" ]]; then
    JEST_CMD="$JEST_CMD --watch"
else
    JEST_CMD="$JEST_CMD --runInBand"
fi

if [[ "$VERBOSE" == "true" ]]; then
    JEST_CMD="$JEST_CMD --verbose"
fi

if [[ "$CI_MODE" == "true" ]]; then
    JEST_CMD="$JEST_CMD --ci --coverage --maxWorkers=2"
    SHOW_COVERAGE=true
fi

if [[ "$SHOW_COVERAGE" == "true" ]]; then
    JEST_CMD="$JEST_CMD --coverage"
fi

# Afficher la commande si verbose
if [[ "$VERBOSE" == "true" ]]; then
    print_info "Running command: $JEST_CMD"
fi

# Exécuter les tests
print_info "Starting tests..."
echo ""

if eval $JEST_CMD; then
    print_success "Tests completed successfully!"
    
    # Afficher le rapport de couverture si demandé
    if [[ "$SHOW_COVERAGE" == "true" ]]; then
        echo ""
        print_header "COVERAGE REPORT"
        
        if [[ -f "coverage/cache-events/lcov-report/index.html" ]]; then
            print_info "Detailed coverage report: coverage/cache-events/lcov-report/index.html"
        fi
        
        # Vérifier les seuils de couverture
        if [[ -f "coverage/cache-events/coverage-summary.json" ]]; then
            print_info "Coverage summary available in coverage/cache-events/"
        fi
    fi
    
    # Afficher les rapports de test si disponibles
    if [[ -f "test-results/cache-events/cache-events-test-report.html" ]]; then
        print_info "Test report: test-results/cache-events/cache-events-test-report.html"
    fi
    
    echo ""
    print_success "All cache & events tests passed!"
    
else
    TEST_EXIT_CODE=$?
    echo ""
    print_error "Tests failed!"
    
    # Afficher des conseils de debugging
    echo ""
    print_info "Debugging tips:"
    echo "  • Run with --verbose for more details"
    echo "  • Check Redis connection if cache/integration tests failed"
    echo "  • Check HTTP server availability if events tests failed"
    echo "  • Review test logs in test-results/cache-events/"
    
    if [[ "$TEST_TYPE" == "integration" || "$TEST_TYPE" == "e2e" || "$TEST_TYPE" == "cache-events" || "$TEST_TYPE" == "all" ]]; then
        echo "  • For Redis issues:"
        echo "    - redis-server (local)"
        echo "    - docker run -d -p 6379:6379 redis:7-alpine"
        echo "  • For Events HTTP server issues:"
        echo "    - Check port $HTTP_SERVER_PORT availability"
        echo "    - Verify ORCHESTRATION_SERVICE_URL configuration"
    fi
    
    exit $TEST_EXIT_CODE
fi

# Nettoyer après les tests
if check_redis; then
    clean_test_db
fi

print_success "Cache & Events testing completed!"