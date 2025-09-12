#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

echo -e "${BLUE}🛠️  Setup Développement - Project Service (Corrigé)${NC}"
echo "=================================================="

# Check prerequisites
print_info "Vérification des prérequis..."

# Check Docker
if ! command -v docker &> /dev/null; then
    print_error "Docker n'est pas installé"
    exit 1
fi

# Check Docker Compose
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    print_error "Docker Compose n'est pas installé"
    exit 1
fi

# Get Docker Compose version
if docker compose version &> /dev/null; then
    COMPOSE_VERSION=$(docker compose version --short 2>/dev/null || echo "v2.x.x")
    print_success "Docker Compose $COMPOSE_VERSION détecté"
    COMPOSE_CMD="docker compose"
else
    COMPOSE_VERSION=$(docker-compose version --short 2>/dev/null || echo "v1.x.x")
    print_success "Docker Compose $COMPOSE_VERSION détecté"
    COMPOSE_CMD="docker-compose"
fi

# Check Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    print_success "Node.js $NODE_VERSION OK"
else
    print_error "Node.js n'est pas installé"
    exit 1
fi

# Check if .env.development exists
if [ ! -f ".env.development" ]; then
    print_warning "Fichier .env.development manquant, création..."
    # Create .env.development with default values
    cat > .env.development << 'EOF'
NODE_ENV=development
DATABASE_URL="postgresql://project_user:project_password@localhost:5432/project_service_dev?schema=public"
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=project_user
DB_PASSWORD=project_password
DB_DATABASE=project_service_dev
REDIS_HOST=localhost
REDIS_PORT=6379
APP_PORT=3000
JWT_SECRET=your-super-secret-jwt-key-change-in-production
EOF
    print_success "Fichier .env.development créé"
else
    print_info "Fichier .env.development existe déjà"
fi

# Create docker directory if it doesn't exist
mkdir -p docker

# Create init-db.sql if it doesn't exist
if [ ! -f "docker/init-db.sql" ]; then
    print_info "Création du fichier d'initialisation de la base de données..."
    cat > docker/init-db.sql << 'EOF'
-- Initialisation de la base de données PostgreSQL
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'project_user') THEN
        CREATE USER project_user WITH PASSWORD 'project_password';
    END IF;
END
$$;

GRANT ALL PRIVILEGES ON DATABASE project_service_dev TO project_user;
GRANT ALL ON SCHEMA public TO project_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO project_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO project_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO project_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO project_user;
EOF
    print_success "Fichier docker/init-db.sql créé"
fi

# Install dependencies
print_info "Installation des dépendances..."
if npm install; then
    print_success "Dépendances installées"
else
    print_error "Échec de l'installation des dépendances"
    exit 1
fi

# Stop existing containers
print_info "Arrêt des conteneurs existants..."
$COMPOSE_CMD -f docker/docker-compose.dev.yml down --remove-orphans

# Remove existing volumes to start fresh
print_info "Suppression des volumes existants pour un redémarrage propre..."
$COMPOSE_CMD -f docker/docker-compose.dev.yml down -v

# Start Docker services
print_info "Démarrage des services Docker..."
if $COMPOSE_CMD -f docker/docker-compose.dev.yml up -d; then
    print_success "Services Docker démarrés"
else
    print_error "Échec du démarrage des services Docker"
    exit 1
fi

# Wait for PostgreSQL to be ready
print_info "Attente de PostgreSQL..."
max_attempts=30
attempt=1

while [ $attempt -le $max_attempts ]; do
    if docker exec project-service-postgres-dev pg_isready -U project_user -d project_service_dev > /dev/null 2>&1; then
        print_success "PostgreSQL prêt"
        break
    fi
    
    if [ $attempt -eq $max_attempts ]; then
        print_error "PostgreSQL n'est pas prêt après $max_attempts tentatives"
        print_info "Vérification des logs PostgreSQL..."
        $COMPOSE_CMD -f docker/docker-compose.dev.yml logs postgres
        exit 1
    fi
    
    echo -n "."
    sleep 2
    ((attempt++))
done

# Wait for Redis to be ready
print_info "Vérification de Redis..."
if docker exec project-service-redis-dev redis-cli ping > /dev/null 2>&1; then
    print_success "Redis prêt"
else
    print_warning "Redis pourrait ne pas être prêt"
fi

# Generate Prisma client
print_info "Génération du client Prisma..."
if npx prisma generate; then
    print_success "Client Prisma généré"
else
    print_error "Échec de la génération du client Prisma"
    exit 1
fi

# Run database migrations
print_info "Application des migrations de base de données..."
if npx prisma db push; then
    print_success "Migrations appliquées avec succès"
else
    print_error "Échec des migrations"
    print_info "Tentative de création de la base de données..."
    
    # Try to create database if it doesn't exist
    docker exec project-service-postgres-dev createdb -U project_user project_service_dev 2>/dev/null || true
    
    # Retry migrations
    if npx prisma db push; then
        print_success "Migrations appliquées avec succès (après création de la DB)"
    else
        print_error "Échec persistant des migrations"
        print_info "Logs Docker pour diagnostic:"
        $COMPOSE_CMD -f docker/docker-compose.dev.yml logs
        exit 1
    fi
fi

# Optional: Run database seeding
if [ -f "prisma/seed.ts" ]; then
    print_info "Exécution du seeding de la base de données..."
    if npx prisma db seed; then
        print_success "Seeding terminé"
    else
        print_warning "Échec du seeding (non critique)"
    fi
fi

echo ""
print_success "🎉 Setup terminé avec succès!"
echo ""
print_info "Services disponibles:"
echo "  📦 PostgreSQL: localhost:5432"
echo "  🔴 Redis: localhost:6379"
echo ""
print_info "Commandes utiles:"
echo "  🚀 Démarrer l'application: npm run start:dev"
echo "  🧪 Lancer les tests: npm test"
echo "  📊 Voir les logs Docker: $COMPOSE_CMD -f docker/docker-compose.dev.yml logs"
echo "  🛑 Arrêter les services: $COMPOSE_CMD -f docker/docker-compose.dev.yml down"
echo ""
print_info "Base de données:"
echo "  🔗 URL: postgresql://project_user:project_pass@localhost:5432/project_service_dev"
echo "  👤 Utilisateur: project_user"
echo "  🔑 Mot de passe: project_password"