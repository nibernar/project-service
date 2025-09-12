#!/bin/bash
set -e

# Couleurs
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Variables
ENVIRONMENT=${NODE_ENV:-development}

# Validation environnement
if [ ! -f ".env.$ENVIRONMENT" ]; then
    log_error "Fichier .env.$ENVIRONMENT non trouvé"
    exit 1
fi

# Charger les variables
export $(grep -v '^#' ".env.$ENVIRONMENT" | xargs)

main() {
    echo "🗄️ Migration Base de Données - Phase 9"
    echo "======================================"
    
    log_info "Environnement: $ENVIRONMENT"
    
    # Générer le client Prisma
    log_info "Génération du client Prisma..."
    npx prisma generate
    
    # Appliquer les migrations
    log_info "Application des migrations..."
    if [ "$ENVIRONMENT" = "development" ]; then
        npx prisma migrate dev
    else
        npx prisma migrate deploy
    fi
    
    log_success "Migrations terminées"
}

# Vérifier qu'on est dans la racine du projet
if [ ! -f package.json ]; then
    log_error "Exécuter depuis la racine du projet"
    exit 1
fi

main