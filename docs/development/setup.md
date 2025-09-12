# Guide de développement - Service de Gestion des Projets (C04) - Version Complète

## Vue d'ensemble

Ce guide vous accompagne dans la configuration complète de l'environnement de développement pour le Service de Gestion des Projets de la plateforme Coders, incluant les fonctionnalités avancées de validation, sécurité, qualité des données et observabilité.

### Architecture technique enrichie
- **Backend** : NestJS avec Fastify et validation avancée
- **Base de données** : PostgreSQL avec Prisma ORM et index optimisés
- **Cache** : Redis pour les performances avec invalidation intelligente
- **Validation** : class-validator avec sanitisation automatique
- **Sécurité** : Guards composables avec audit trail
- **Tests** : Jest avec couverture complète et tests de qualité
- **Observabilité** : Monitoring, métriques et logs structurés
- **Conteneurisation** : Docker pour l'environnement de développement

---

## Prérequis

### Logiciels requis

**Node.js 18+ (LTS recommandé)**
```bash
# Vérification de la version
node --version  # Doit être >= 18.0.0
npm --version   # Doit être >= 8.0.0

# Installation avec gestionnaire de versions (recommandé)
# Via nvm (Linux/macOS)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install --lts
nvm use --lts

# Via fnm (alternative rapide)
curl -fsSL https://fnm.vercel.app/install | bash
fnm install --lts
fnm use --lts
```

**PostgreSQL 14+**
```bash
# Installation sur Ubuntu/Debian
sudo apt update
sudo apt install postgresql postgresql-contrib postgresql-14-postgis-3

# Installation sur macOS avec Homebrew
brew install postgresql@14
brew services start postgresql@14

# Vérification
psql --version
```

**Redis 6+**
```bash
# Installation sur Ubuntu/Debian
sudo apt install redis-server redis-tools

# Installation sur macOS avec Homebrew  
brew install redis
brew services start redis

# Installation sur Windows
# Via WSL ou Docker recommandé

# Vérification
redis-server --version
redis-cli ping  # Doit retourner PONG
```

**Docker et Docker Compose**
```bash
# Installation Docker (Ubuntu/Debian)
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Installation Docker Compose
sudo apt install docker-compose-plugin

# Installation sur macOS
brew install --cask docker

# Vérification
docker --version
docker compose version
```

**Git avec configuration recommandée**
```bash
# Installation sur Ubuntu/Debian
sudo apt install git git-lfs

# Configuration globale recommandée
git config --global user.name "Votre Nom"
git config --global user.email "votre.email@example.com"
git config --global init.defaultBranch main
git config --global pull.rebase false
git config --global core.autocrlf input

# Support des gros fichiers
git lfs install

# Vérification
git --version
```


## Installation

### 1. Clone du repository

```bash
# Clone depuis GitLab avec toutes les branches
git clone --recurse-submodules https://gitlab.com/coders-platform/project-service.git
```

### 2. Installation des dépendances

```bash
# Nettoyage et installation des dépendances
rm -rf node_modules package-lock.json
npm install

# Vérification de l'installation avec audit
npm audit
npm list --depth=0

# Installation des dépendances globales pour le développement
npm install -g concurrently cross-env nodemon
```

**Dépendances principales installées** :
- **Core** : NestJS, Fastify, TypeScript
- **Validation** : class-validator, class-transformer
- **Database** : Prisma, PostgreSQL client
- **Cache** : ioredis, @nestjs-modules/ioredis
- **Security** : helmet, rate-limiter-flexible
- **Testing** : Jest, Supertest, @nestjs/testing
- **Documentation** : @nestjs/swagger
- **Utilities** : date-fns, uuid, bcrypt

### 3. Configuration des variables d'environnement

**Contenu complet du fichier `.env.development` :**
```bash
# ====================================================================
# CONFIGURATION APPLICATION
# ====================================================================
NODE_ENV=development
PORT=3000
API_PREFIX=api/v1
API_VERSION=1.2.0

# URLs et domaines
BASE_URL=http://localhost:3000
FRONTEND_URL=http://localhost:3001
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001,http://localhost:3002

# ====================================================================
# BASE DE DONNÉES POSTGRESQL
# ====================================================================
DATABASE_URL="postgresql://project_user:project_pass@localhost:5432/project_service_dev"
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=project_user
DB_PASSWORD=project_pass
DB_DATABASE=project_service_dev

# Pool de connexions
DB_MAX_CONNECTIONS=20
DB_MIN_CONNECTIONS=5
DB_CONNECTION_TIMEOUT=10000
DB_IDLE_TIMEOUT=30000

# ====================================================================
# REDIS CACHE
# ====================================================================
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
REDIS_MAX_CONNECTIONS=10
REDIS_RETRY_ATTEMPTS=3
REDIS_RETRY_DELAY=1000

# TTL du cache (en secondes)
CACHE_TTL_PROJECT=300        # 5 minutes
CACHE_TTL_STATISTICS=600     # 10 minutes
CACHE_TTL_USER_SESSION=1800  # 30 minutes

# ====================================================================
# SÉCURITÉ ET AUTHENTIFICATION
# ====================================================================
# Token pour les services internes (CHANGEZ EN PRODUCTION!)
INTERNAL_SERVICE_TOKEN=dev-service-token-change-in-production-random-32-bytes-hex

# JWT Configuration
JWT_SECRET=development-jwt-secret-change-in-production-random-64-bytes-hex
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=30d

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000   # 1 minute
RATE_LIMIT_MAX_REQUESTS=100  # Requêtes par fenêtre
RATE_LIMIT_SKIP_SUCCESSFUL=false

# ====================================================================
# SERVICES EXTERNES
# ====================================================================
# URLs des services (mockés en développement)
STORAGE_SERVICE_URL=http://localhost:3001
ORCHESTRATOR_SERVICE_URL=http://localhost:3002
AUTH_SERVICE_URL=http://localhost:3003
COST_TRACKING_SERVICE_URL=http://localhost:3004
MONITORING_SERVICE_URL=http://localhost:3005

# Timeouts des services externes (ms)
SERVICE_TIMEOUT=5000
SERVICE_RETRY_ATTEMPTS=3
SERVICE_RETRY_DELAY=1000

# ====================================================================
# LIMITES ET QUOTAS
# ====================================================================
# Limites par utilisateur
MAX_PROJECTS_PER_USER=100
MAX_PROJECTS_PER_PREMIUM_USER=500
MAX_EXPORT_FILE_SIZE_MB=100
MAX_CONCURRENT_EXPORTS=3
MAX_CONCURRENT_EXPORTS_PREMIUM=5

# Limites techniques
MAX_REQUEST_SIZE_MB=10
MAX_UPLOAD_FILE_SIZE_MB=50
MAX_PROJECT_NAME_LENGTH=100
MAX_PROJECT_DESCRIPTION_LENGTH=1000
MAX_INITIAL_PROMPT_LENGTH=5000

# ====================================================================
# EXPORT ET FICHIERS
# ====================================================================
# Configuration export
EXPORT_TEMP_DIR=/tmp/project-exports
EXPORT_RETENTION_HOURS=24
EXPORT_RETENTION_HOURS_PREMIUM=72
EXPORT_MAX_CONCURRENT_CONVERSIONS=5

# Pandoc configuration
PANDOC_BINARY_PATH=/usr/bin/pandoc
PANDOC_DATA_DIR=/usr/share/pandoc
PANDOC_TIMEOUT=30000

# ====================================================================
# LOGGING ET DEBUGGING
# ====================================================================
LOG_LEVEL=debug
LOG_FORMAT=json
LOG_OUTPUT=console,file
LOG_FILE_PATH=./logs/app.log
LOG_MAX_FILES=10
LOG_MAX_SIZE=10m

# Debugging
ENABLE_QUERY_LOGGING=true
ENABLE_SLOW_QUERY_LOG=true
SLOW_QUERY_THRESHOLD=1000    # ms
ENABLE_REQUEST_LOGGING=true
ENABLE_PERFORMANCE_MONITORING=true

# ====================================================================
# FEATURES FLAGS
# ====================================================================
# Fonctionnalités activées
ENABLE_STATISTICS_COLLECTION=true
ENABLE_EXPORT_PDF=true
ENABLE_EXPORT_MARKDOWN=true
ENABLE_CURSOR_PAGINATION=true
ENABLE_ADVANCED_FILTERS=true
ENABLE_AUDIT_TRAIL=true

# Fonctionnalités expérimentales
ENABLE_WEBHOOKS=false
ENABLE_GRAPHQL_API=false
ENABLE_COLLABORATION=false

# ====================================================================
# MONITORING ET MÉTRIQUES
# ====================================================================
# Prometheus metrics
ENABLE_METRICS=true
METRICS_PORT=9090
METRICS_PATH=/metrics

# Health checks
HEALTH_CHECK_TIMEOUT=5000
HEALTH_CHECK_DB=true
HEALTH_CHECK_REDIS=true
HEALTH_CHECK_EXTERNAL_SERVICES=true

# ====================================================================
# DÉVELOPPEMENT
# ====================================================================
# Configuration spécifique au développement
ENABLE_SWAGGER=true
SWAGGER_PATH=/api/docs
ENABLE_CORS=true
ENABLE_DETAILED_ERRORS=true

# Mock des services externes
MOCK_EXTERNAL_SERVICES=true
MOCK_SERVICE_DELAY=100       # ms

# Base de données
ENABLE_DB_SEEDING=true
ENABLE_DB_RESET_ON_START=false
```

**Variables pour les tests (`.env.test`) :**
```bash
# ====================================================================
# CONFIGURATION TEST
# ====================================================================
NODE_ENV=test
PORT=3001
API_PREFIX=api/v1

# Base de données de test (séparée)
DATABASE_URL="postgresql://test_user:test_pass@localhost:5432/project_service_test"

# Redis de test
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=1

# Désactivation des logs en test
LOG_LEVEL=error
LOG_OUTPUT=console
ENABLE_QUERY_LOGGING=false
ENABLE_REQUEST_LOGGING=false

# Configuration test
INTERNAL_SERVICE_TOKEN=test-token-for-internal-services
JWT_SECRET=test-jwt-secret-not-for-production
MOCK_EXTERNAL_SERVICES=true

# Timeouts réduits pour les tests
SERVICE_TIMEOUT=1000
DB_CONNECTION_TIMEOUT=5000
CACHE_TTL_PROJECT=60
CACHE_TTL_STATISTICS=120

# Limites réduites pour les tests
MAX_PROJECTS_PER_USER=10
MAX_CONCURRENT_EXPORTS=2
RATE_LIMIT_MAX_REQUESTS=1000  # Plus permissif pour les tests
```

---

## Configuration avec Docker (Recommandé)

### Approche tout-en-un avec Docker Compose enrichi

**Avantages :**
- Configuration isolée et reproductible
- Pas d'installation locale de PostgreSQL/Redis
- Reset facile de l'environnement
- Cohérence entre développeurs
- Services de monitoring intégrés

```bash
# Lancement des services de développement complets
docker compose -f docker/docker-compose.dev.yml up -d

# Vérification des services avec health checks
docker compose -f docker/docker-compose.dev.yml ps
docker compose -f docker/docker-compose.dev.yml logs -f

# Monitoring des ressources
docker stats

# Nettoyage complet si nécessaire
docker compose -f docker/docker-compose.dev.yml down -v
docker system prune -f
```

**Services démarrés enrichis :**
- **PostgreSQL** : `localhost:5432` avec extensions PostGIS et pg_stat_statements
- **Redis** : `localhost:6379` avec Redis Insight sur `localhost:8001`
- **Adminer** (interface web PostgreSQL) : `localhost:8080`
- **Prometheus** (métriques) : `localhost:9090`
- **Grafana** (dashboards) : `localhost:3001` (admin/admin)
- **Jaeger** (tracing) : `localhost:16686`

### Configuration de la base de données avancée

```bash
# Génération du client Prisma avec tous les générateurs
npx prisma generate

# Application des migrations avec validation
npm run db:migrate

# Validation du schéma
npx prisma validate

# Seeding avec données enrichies
npm run db:seed

# Interface Prisma Studio pour inspection
npm run db:studio

# Génération du diagramme DBML
npx prisma generate --generator dbml-generator
```

**Scripts de base de données avancés :**
```bash
# Reset complet avec confirmation
npm run db:reset

# Migration avec nom descriptif
npx prisma migrate dev --name "add_project_statistics_quality_score"

# Deploy en production
npx prisma migrate deploy

# Snapshot pour tests
npx prisma db push --force-reset

# Backup de développement
npm run db:backup

# Restore depuis backup
npm run db:restore ./backups/dev-backup-2024-08-18.sql
```

---

## Configuration manuelle (sans Docker)

### Configuration PostgreSQL avancée

```bash
# Connexion en tant que superutilisateur
sudo -u postgres psql

# Création de l'utilisateur et des bases avec permissions étendues
CREATE USER project_user WITH PASSWORD 'project_pass' CREATEDB;
CREATE USER test_user WITH PASSWORD 'test_pass' CREATEDB;

# Création des bases avec configuration optimisée
CREATE DATABASE project_service_dev 
  OWNER project_user 
  ENCODING 'UTF8' 
  LC_COLLATE = 'en_US.UTF-8' 
  LC_CTYPE = 'en_US.UTF-8'
  TEMPLATE template0;

CREATE DATABASE project_service_test 
  OWNER test_user 
  ENCODING 'UTF8' 
  LC_COLLATE = 'en_US.UTF-8' 
  LC_CTYPE = 'en_US.UTF-8'
  TEMPLATE template0;

# Attribution des privilèges
GRANT ALL PRIVILEGES ON DATABASE project_service_dev TO project_user;
GRANT ALL PRIVILEGES ON DATABASE project_service_test TO test_user;

# Configuration des extensions (optionnel mais recommandé)
\c project_service_dev;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

\c project_service_test;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

# Sortie
\q
```

### Configuration Redis avancée

```bash
# Démarrage du service Redis
sudo systemctl start redis-server

# Activation au démarrage
sudo systemctl enable redis-server

# Configuration Redis pour le développement
sudo nano /etc/redis/redis.conf

# Paramètres recommandés
maxmemory 512mb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
save 60 10000

# Test de connexion avec commandes
redis-cli ping                    # PONG
redis-cli info memory            # Informations mémoire
redis-cli config get maxmemory   # Configuration actuelle
```

### Application des migrations enrichies

```bash
# Génération du client Prisma
npx prisma generate

# Application des migrations sur la base de développement
npx prisma migrate dev --name "initial_schema_with_validation"

# Application sur la base de test
NODE_ENV=test npx prisma migrate deploy

# Vérification des migrations
npx prisma migrate status

# Seeding des données de développement avec qualité
npm run db:seed

# Validation des données après seeding
npm run db:validate
```

---

## Démarrage de l'application

### Mode développement avancé

```bash
# Démarrage avec rechargement automatique et debugging
npm run start:dev

# Démarrage avec inspection et profiling
npm run start:dev:debug

# Démarrage avec monitoring des performances
npm run start:dev:perf

# L'application sera accessible sur :
# http://localhost:3000              - API principale
# http://localhost:3000/api/docs     - Documentation Swagger
# http://localhost:3000/health       - Health check
# http://localhost:3000/metrics      - Métriques Prometheus
```

## Tests avancés

### Configuration des tests enrichie

Assurez-vous que la base de données de test est configurée avec les extensions :

```bash
# Vérification de la connexion test avec health check
NODE_ENV=test npm run health:check

# Si nécessaire, application des migrations test
NODE_ENV=test npx prisma migrate deploy

# Reset de la base de test avec données de qualité
NODE_ENV=test npm run db:reset

# Validation de l'environnement de test
npm run test:env:validate
```

### Exécution des tests par catégorie

**Tests unitaires avec validation de qualité**
```bash
# Tous les tests unitaires avec coverage
npm run test

# Tests avec surveillance des changements
npm run test:watch

# Tests d'un fichier spécifique avec debug
npm run test:debug -- project.service.spec.ts

# Tests avec pattern et coverage détaillée
npm run test:coverage -- --testNamePattern="should create"

# Tests de validation des entités
npm run test:validation

# Tests de sécurité
npm run test:security
```

**Tests d'intégration avec vraie base**
```bash
# Tests d'intégration (avec vraie base de données)
npm run test:integration

# Tests d'intégration avec setup/teardown
npm run test:integration:full

# Tests d'intégration par module
npm run test:integration -- --testPathPattern="project"

# Tests de performance
npm run test:performance
```

**Tests E2E complets**
```bash
# Tests E2E avec environnement complet
npm run test:e2e

# Tests E2E avec base dockerisée
npm run test:e2e:docker

# Tests E2E avec monitoring
npm run test:e2e:monitor
```

### Scripts de test spécialisés

```bash
# Tests de qualité des données
npm run test:data-quality

# Tests de cohérence des statistiques
npm run test:statistics:consistency

# Tests de validation métier
npm run test:business-rules

# Tests de sécurité des guards
npm run test:security:guards

# Tests de performance des requêtes
npm run test:performance:queries

# Tests de charge basiques
npm run test:load

# Tests de régression
npm run test:regression
```

### Coverage et qualité

```bash
# Génération du rapport de couverture complet
npm run test:coverage

# Coverage avec seuils de qualité
npm run test:coverage:strict

# Rapport HTML détaillé
npm run test:coverage:html

# Export coverage pour CI/CD
npm run test:coverage:export

# Ouverture du rapport HTML
npm run coverage:open
```

---

## Structure du projet enrichie

### Organisation des dossiers détaillée

```
project-service/
├── src/
│   ├── common/                     # Code partagé sécurisé
│   │   ├── decorators/             # Décorateurs avec injection sécurisée
│   │   │   ├── current-user.decorator.ts    # @CurrentUser avec validation
│   │   │   └── auth.decorator.ts            # @Auth avec composition de guards
│   │   ├── dto/                    # DTOs réutilisables avec validation
│   │   │   └── pagination.dto.ts           # Pagination avec limites sécurisées
│   │   ├── enums/                  # Énumérations avec métadonnées
│   │   │   └── project-status.enum.ts      # Statuts avec transitions validées
│   │   ├── exceptions/             # Exceptions métier personnalisées
│   │   │   ├── project-not-found.exception.ts
│   │   │   ├── unauthorized-access.exception.ts
│   │   │   └── invalid-operation.exception.ts
│   │   ├── guards/                 # Guards sécurisés avec audit
│   │   │   ├── auth.guard.ts               # Validation JWT avec cache
│   │   │   └── project-owner.guard.ts      # Vérification propriété optimisée
│   │   ├── interceptors/           # Intercepteurs pour logging et transformation
│   │   │   ├── transform.interceptor.ts    # Transformation des réponses
│   │   │   ├── logging.interceptor.ts      # Logging structuré
│   │   │   └── audit.interceptor.ts        # Audit trail automatique
│   │   ├── interfaces/             # Interfaces TypeScript enrichies
│   │   │   ├── user.interface.ts           # Utilisateur avec préférences
│   │   │   ├── paginated-result.interface.ts # Pagination offset/cursor
│   │   │   └── api-response.interface.ts   # Réponses API standardisées
│   │   ├── pipes/                  # Pipes de validation et transformation
│   │   │   ├── validation.pipe.ts          # Validation avec class-validator
│   │   │   ├── sanitization.pipe.ts        # Sanitisation anti-XSS
│   │   │   └── uuid-validation.pipe.ts     # Validation UUID stricte
│   │   └── utils/                  # Utilitaires sécurisés
│   │       ├── validation.utils.ts         # Validation métier
│   │       ├── sanitization.utils.ts       # Nettoyage des données
│   │       ├── file.utils.ts               # Manipulation fichiers
│   │       └── crypto.utils.ts             # Utilitaires cryptographiques
│   ├── config/                     # Configuration modulaire
│   │   ├── app.config.ts                   # Configuration générale
│   │   ├── database.config.ts              # Configuration Prisma optimisée
│   │   ├── cache.config.ts                 # Configuration Redis
│   │   ├── security.config.ts              # Configuration sécurité
│   │   ├── validation.config.ts            # Configuration validation globale
│   │   └── monitoring.config.ts            # Configuration observabilité
│   ├── database/                   # Module base de données
│   │   ├── database.module.ts              # Module Prisma global
│   │   ├── database.service.ts             # Service avec health checks
│   │   ├── health/                         # Health checks spécialisés
│   │   └── migrations/                     # Migrations personnalisées
│   ├── project/                    # Module principal Project
│   │   ├── dto/                    # DTOs avec validation complète
│   │   │   ├── create-project.dto.ts       # Validation création avec sanitisation
│   │   │   ├── update-project.dto.ts       # Validation mise à jour partielle
│   │   │   ├── project-response.dto.ts     # DTO réponse avec transformation
│   │   │   └── project-list.dto.ts         # DTO liste optimisé
│   │   ├── entities/               # Entités avec méthodes métier
│   │   │   └── project.entity.ts           # Entité riche avec validation
│   │   ├── guards/                 # Guards spécialisés
│   │   │   └── project-access.guard.ts     # Contrôle accès granulaire
│   │   ├── services/               # Services métier
│   │   │   ├── project.service.ts          # Service principal
│   │   │   ├── project-validation.service.ts # Validation métier spécialisée
│   │   │   └── project-audit.service.ts    # Service d'audit
│   │   ├── project.controller.ts           # Contrôleur REST avec documentation
│   │   ├── project.repository.ts           # Repository avec cache intelligent
│   │   └── project.module.ts               # Module avec toutes dépendances
│   ├── statistics/                 # Module Statistics enrichi
│   │   ├── dto/                    # DTOs avec validation JSON
│   │   │   ├── update-statistics.dto.ts    # Validation structure JSON
│   │   │   └── statistics-response.dto.ts  # Réponse avec métadonnées qualité
│   │   ├── entities/               # Entités avec calculs automatiques
│   │   │   └── project-statistics.entity.ts # Entité avec scoring qualité
│   │   ├── services/               # Services de traitement
│   │   │   ├── statistics.service.ts       # Service principal
│   │   │   ├── quality.service.ts          # Service scoring qualité
│   │   │   └── validation.service.ts       # Validation cohérence
│   │   ├── statistics.controller.ts        # API interne/externe
│   │   ├── statistics.repository.ts        # Repository JSON optimisé
│   │   └── statistics.module.ts            # Module avec services qualité
│   ├── export/                     # Module Export avancé
│   │   ├── dto/                    # DTOs avec options avancées
│   │   │   ├── export-options.dto.ts       # Options avec validation stricte
│   │   │   └── export-response.dto.ts      # Réponse avec métadonnées
│   │   ├── services/               # Services spécialisés
│   │   │   ├── export.service.ts           # Orchestrateur principal
│   │   │   ├── markdown-export.service.ts  # Export Markdown natif
│   │   │   ├── pdf-export.service.ts       # Conversion PDF Pandoc
│   │   │   ├── file-retrieval.service.ts   # Récupération fichiers
│   │   │   └── compression.service.ts      # Compression optimisée
│   │   ├── export.controller.ts            # API avec gestion async
│   │   └── export.module.ts                # Module avec queue système
│   ├── cache/                      # Module Cache intelligent
│   │   ├── cache.service.ts                # Service avec invalidation
│   │   ├── cache.module.ts                 # Module Redis global
│   │   ├── strategies/             # Stratégies de cache
│   │   │   ├── project-cache.strategy.ts   # Cache projets
│   │   │   └── statistics-cache.strategy.ts # Cache statistiques
│   │   └── cache-keys.constants.ts         # Clés standardisées
│   ├── events/                     # Module Événements
│   │   ├── dto/                    # DTOs d'événements
│   │   │   ├── project-created.dto.ts      # Événement création
│   │   │   └── audit-event.dto.ts          # Événement audit
│   │   ├── services/               # Services événementiels
│   │   │   ├── events.service.ts           # Publication événements
│   │   │   └── audit.service.ts            # Service audit trail
│   │   ├── events.module.ts                # Module avec message broker
│   │   └── event-types.constants.ts        # Types d'événements
│   ├── security/                   # Module Sécurité
│   │   ├── services/               # Services sécurisés
│   │   │   ├── encryption.service.ts       # Chiffrement AES-256
│   │   │   ├── audit-trail.service.ts      # Trail d'audit complet
│   │   │   └── rate-limiting.service.ts    # Rate limiting adaptatif
│   │   ├── guards/                 # Guards de sécurité
│   │   │   ├── roles.guard.ts              # Contrôle des rôles
│   │   │   └── rate-limit.guard.ts         # Protection rate limiting
│   │   └── security.module.ts              # Module sécurité global
│   ├── monitoring/                 # Module Observabilité
│   │   ├── services/               # Services de monitoring
│   │   │   ├── metrics.service.ts          # Métriques Prometheus
│   │   │   ├── tracing.service.ts          # Tracing distribué
│   │   │   └── health.service.ts           # Health checks avancés
│   │   ├── monitoring.controller.ts        # API métriques
│   │   └── monitoring.module.ts            # Module avec exporters
│   ├── health/                     # Module Health Check
│   │   ├── health.controller.ts            # Endpoints health standard
│   │   ├── health.service.ts               # Vérifications complètes
│   │   ├── indicators/             # Indicateurs spécialisés
│   │   │   ├── database.indicator.ts       # Santé base de données
│   │   │   ├── cache.indicator.ts          # Santé cache Redis
│   │   │   └── external.indicator.ts       # Santé services externes
│   │   └── health.module.ts                # Module avec tous indicateurs
│   ├── app.controller.ts                   # Contrôleur racine
│   ├── app.service.ts                      # Service racine
│   ├── app.module.ts                       # Module principal
│   └── main.ts                             # Point d'entrée avec configuration
├── prisma/                         # Configuration Prisma enrichie
│   ├── schema.prisma                       # Schéma avec index optimisés
│   ├── seed.ts                             # Seeding avec données qualité
│   ├── migrations/                         # Migrations versionnées
│   ├── seeds/                              # Scripts de seeding modulaires
│   │   ├── users.seed.ts                   # Utilisateurs de test
│   │   ├── projects.seed.ts                # Projets avec complexité variée
│   │   └── statistics.seed.ts              # Statistiques réalistes
│   └── dbml/                               # Diagrammes auto-générés
│       └── schema.dbml                     # Diagramme de base
├── test/                           # Tests structurés
│   ├── unit/                       # Tests unitaires par module
│   │   ├── common/                 # Tests des utilitaires
│   │   │   ├── guards/             # Tests guards avec mocks
│   │   │   ├── utils/              # Tests utilitaires
│   │   │   └── pipes/              # Tests pipes de validation
│   │   ├── project/                # Tests module Project
│   │   │   ├── services/           # Tests services avec mocks
│   │   │   ├── controllers/        # Tests contrôleurs
│   │   │   └── entities/           # Tests entités métier
│   │   ├── statistics/             # Tests module Statistics
│   │   └── export/                 # Tests module Export
│   ├── integration/                # Tests d'intégration
│   │   ├── project.integration.spec.ts     # Tests avec vraie DB
│   │   ├── statistics.integration.spec.ts  # Tests cohérence données
│   │   └── export.integration.spec.ts      # Tests export complets
│   ├── e2e/                        # Tests end-to-end
│   │   ├── project.e2e-spec.ts             # Scénarios complets
│   │   ├── statistics.e2e-spec.ts          # Tests API statistiques
│   │   └── export.e2e-spec.ts              # Tests processus export
│   ├── performance/                # Tests de performance
│   │   ├── load.spec.ts                    # Tests charge
│   │   └── stress.spec.ts                  # Tests limites
│   ├── security/                   # Tests de sécurité
│   │   ├── auth.security.spec.ts           # Tests authentification
│   │   ├── validation.security.spec.ts     # Tests validation
│   │   └── injection.security.spec.ts      # Tests injection
│   ├── fixtures/                   # Données de test réutilisables
│   │   ├── project.fixtures.ts             # Projets de test variés
│   │   ├── user.fixtures.ts                # Utilisateurs avec rôles
│   │   └── statistics.fixtures.ts          # Statistiques réalistes
│   └── setup/                      # Configuration tests
│       ├── global-setup.ts                 # Setup global
│       ├── global-teardown.ts              # Teardown global
│       ├── test-database.ts                # DB dédiée aux tests
│       └── test-utils.ts                   # Utilitaires tests
├── scripts/                        # Scripts d'automatisation
│   ├── setup/                      # Scripts de setup
│   │   ├── setup-dev.sh                    # Setup environnement dev
│   │   ├── setup-test.sh                   # Setup environnement test
│   │   └── setup-production.sh             # Setup production
│   ├── database/                   # Scripts base de données
│   │   ├── migrate.sh                      # Migrations sécurisées
│   │   ├── seed.sh                         # Seeding contrôlé
│   │   ├── backup.sh                       # Backup automatisé
│   │   └── restore.sh                      # Restauration
│   ├── build/                      # Scripts de build
│   │   ├── build.sh                        # Build production
│   │   ├── build-docker.sh                 # Build image Docker
│   │   └── optimize.sh                     # Optimisation assets
│   ├── test/                       # Scripts de test
│   │   ├── test-all.sh                     # Tous les tests
│   │   ├── test-coverage.sh                # Coverage complet
│   │   └── test-security.sh                # Tests sécurité
│   └── monitoring/                 # Scripts monitoring
│       ├── health-check.sh                 # Health check externe
│       ├── metrics-export.sh               # Export métriques
│       └── log-analysis.sh                 # Analyse logs
├── docker/                         # Configuration Docker
│   ├── Dockerfile                          # Image multi-stage optimisée
│   ├── Dockerfile.dev                      # Image développement
│   ├── docker-compose.yml                  # Composition production
│   ├── docker-compose.dev.yml              # Composition développement
│   ├── docker-compose.test.yml             # Composition tests
│   ├── .dockerignore                       # Exclusions Docker
│   └── scripts/                    # Scripts Docker
│       ├── entrypoint.sh                   # Point d'entrée
│       └── health-check.sh                 # Health check interne
├── docs/                           # Documentation complète
│   ├── api/                        # Documentation API
│   │   ├── project-api.md                  # API projets détaillée
│   │   ├── statistics-api.md               # API statistiques
│   │   ├── export-api.md                   # API export
│   │   └── openapi.yaml                    # Spécification OpenAPI
│   ├── development/                # Guides développement
│   │   ├── setup.md                        # Ce guide
│   │   ├── testing.md                      # Guide tests
│   │   ├── deployment.md                   # Guide déploiement
│   │   ├── debugging.md                    # Guide debugging
│   │   └── contributing.md                 # Guide contribution
│   ├── architecture/               # Documentation architecture
│   │   ├── overview.md                     # Vue d'ensemble
│   │   ├── database-schema.md              # Schéma base
│   │   ├── security.md                     # Sécurité
│   │   └── performance.md                  # Performance
│   ├── runbooks/                   # Guides opérationnels
│   │   ├── monitoring.md                   # Monitoring
│   │   ├── troubleshooting.md              # Dépannage
│   │   └── maintenance.md                  # Maintenance
│   └── examples/                   # Exemples d'usage
│       ├── api-examples.md                 # Exemples API
│       └── integration-examples.md         # Exemples intégration
├── monitoring/                     # Configuration monitoring
│   ├── prometheus/                 # Configuration Prometheus
│   │   ├── prometheus.yml                  # Config Prometheus
│   │   └── alerts.yml                      # Règles d'alerte
│   ├── grafana/                    # Dashboards Grafana
│   │   ├── dashboards/             # Dashboards JSON
│   │   └── provisioning/           # Configuration auto
│   └── jaeger/                     # Configuration tracing
│       └── jaeger.yml                      # Config Jaeger
├── .github/                        # CI/CD GitHub Actions
│   └── workflows/                  # Workflows automatisés
│       ├── ci.yml                          # Tests et qualité
│       ├── cd.yml                          # Déploiement
│       ├── security.yml                    # Tests sécurité
│       └── performance.yml                 # Tests performance
├── .vscode/                        # Configuration VS Code
│   ├── settings.json                       # Paramètres projet
│   ├── extensions.json                     # Extensions recommandées
│   ├── launch.json                         # Configuration debug
│   └── tasks.json                          # Tâches VS Code
├── config/                         # Fichiers de configuration
│   ├── environments/               # Configuration par environnement
│   │   ├── development.json                # Config développement
│   │   ├── staging.json                    # Config staging
│   │   ├── production.json                 # Config production
│   │   └── test.json                       # Config test
│   └── validation-schemas/         # Schémas de validation
│       ├── project.schema.json             # Schéma validation projet
│       └── statistics.schema.json          # Schéma validation stats
├── logs/                           # Dossier logs (gitignored)
├── coverage/                       # Rapports coverage (gitignored)
├── dist/                           # Build de production (gitignored)
├── tmp/                           # Fichiers temporaires (gitignored)
└── backups/                       # Backups locaux (gitignored)
```

### Conventions de nommage enrichies

**Fichiers et dossiers**
- `kebab-case` pour les fichiers et dossiers
- Suffixes explicites : `.service.ts`, `.controller.ts`, `.dto.ts`, `.entity.ts`, `.guard.ts`
- Tests : même nom + `.spec.ts` (unitaires), `.integration.spec.ts` (intégration), `.e2e-spec.ts` (E2E)
- Configuration : `.config.ts` pour la configuration modulaire

**Code TypeScript**
- `PascalCase` pour les classes, interfaces, enums, types
- `camelCase` pour les variables, fonctions, propriétés, méthodes
- `SCREAMING_SNAKE_CASE` pour les constantes et variables d'environnement
- Préfixes pour les interfaces : `I` optionnel, préférer des noms descriptifs

**Base de données**
- `snake_case` pour les tables et colonnes
- Préfixes explicites : `project_`, `statistics_`
- Noms au pluriel pour les tables, singulier pour les colonnes
- Index nommés : `idx_table_column` ou `idx_table_column1_column2`

**API et routes**
- `kebab-case` pour les segments d'URL
- Verbes HTTP appropriés (GET, POST, PUT, PATCH, DELETE)
- Versions dans l'URL : `/api/v1/`
- Endpoints RESTful standard

---

## Commandes utiles enrichies

### Développement quotidien

```bash
# Démarrage complet de l'environnement avec monitoring
npm run dev:start:full

# Démarrage développement standard
npm run start:dev

# Démarrage avec profiling des performances
npm run dev:profile

# Reset complet de l'environnement
npm run dev:reset

# Validation complète du code
npm run dev:validate

# Nouvelle migration après modification du schéma
npx prisma migrate dev --name "add_user_preferences_to_statistics"

# Inspection de la base via interface web
npm run db:studio

# Génération de nouveaux modules/services avec template
nest generate module billing --dry-run
nest generate service billing --dry-run
nest generate controller billing --dry-run

# Mise à jour des dépendances avec audit
npm run deps:update
npm run deps:audit
```

### Debugging avancé

```bash
# Logs détaillés de l'application avec filtrage
npm run start:dev -- --log-level debug --enable-query-logging

# Inspection des requêtes SQL avec timing
ENABLE_QUERY_LOGGING=true SLOW_QUERY_THRESHOLD=100 npm run start:dev

# Profiling des performances avec visualisation
npm run start:dev -- --enable-profiler

# Tests avec debugging et breakpoints
npm run test:debug -- --testNamePattern="failing test"

# Debugging d'un test spécifique
npm run test:debug -- project.service.spec.ts

# Analyse des fuites mémoire
npm run start:dev:memory -- --inspect-brk

# Monitoring en temps réel des métriques
npm run monitoring:watch
```

### Maintenance et qualité

```bash
# Mise à jour sécurisée des dépendances
npm run deps:update:safe
npm run deps:security:audit

# Audit de sécurité complet
npm run security:audit:full
npm run security:scan

# Nettoyage complet du cache et rebuild
npm run clean:all
npm run rebuild

# Validation complète de l'environnement
npm run env:validate

# Optimisation des performances
npm run optimize:queries
npm run optimize:cache

# Vérification de la qualité du code
npm run quality:check
npm run quality:report

# Backup automatisé avec compression
npm run backup:create
npm run backup:verify

# Analyse des logs avec patterns
npm run logs:analyze
npm run logs:errors
```

### Outils de monitoring et debugging

```bash
# Health check complet avec détails
curl http://localhost:3000/health/detailed

# Métriques Prometheus formatées
curl http://localhost:3000/metrics | grep project_

# Validation de la configuration
npm run config:validate

# Test de charge local
npm run load-test:local

# Profiling de la base de données
npm run db:profile

# Analyse des requêtes lentes
npm run db:slow-queries

# Export des métriques pour analyse
npm run metrics:export

# Monitoring des ressources système
npm run system:monitor
```

---

## Optimisations pour l'environnement de développement

### Performance Node.js

**Configuration Node.js pour le développement avancé**
```bash
# Variables d'environnement pour de meilleures performances
export NODE_OPTIONS="--max-old-space-size=4096 --enable-source-maps"
export UV_THREADPOOL_SIZE=16
export NODE_ENV=development

# Optimisations V8 pour le développement
export NODE_OPTIONS="$NODE_OPTIONS --inspect --expose-gc"

# Ajout au .bashrc ou .zshrc pour persistance
echo 'export NODE_OPTIONS="--max-old-space-size=4096 --enable-source-maps"' >> ~/.bashrc
echo 'export UV_THREADPOOL_SIZE=16' >> ~/.bashrc
```

**Configuration TypeScript pour la compilation rapide**
```json
// tsconfig.json - options pour le développement
{
  "compilerOptions": {
    "incremental": true,
    "tsBuildInfoFile": ".tsbuildinfo",
    "skipLibCheck": true,
    "declaration": false,
    "sourceMap": true
  },
  "ts-node": {
    "swc": true,
    "transpileOnly": true
  }
}
```

### Intégration IDE avancée

**Configuration VS Code enrichie** (`.vscode/settings.json`)
```json
{
  "typescript.preferences.importModuleSpecifier": "relative",
  "typescript.suggest.autoImports": true,
  "typescript.updateImportsOnFileMove.enabled": "always",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true,
    "source.organizeImports": true
  },
  "editor.rulers": [80, 120],
  "files.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/.git": true,
    "**/coverage": true,
    "**/.tsbuildinfo": true
  },
  "search.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/coverage": true
  },
  "jest.jestCommandLine": "npm run test --",
  "jest.autoRun": "watch",
  "eslint.validate": ["typescript"],
  "prisma.showPrismaDataPlatformNotification": false,
  "typescript.preferences.includePackageJsonAutoImports": "auto"
}
```

**Tâches VS Code enrichies** (`.vscode/tasks.json`)
```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Start Dev Server",
      "type": "npm",
      "script": "start:dev",
      "group": "build",
      "presentation": {
        "reveal": "always",
        "panel": "new"
      },
      "problemMatcher": ["$tsc"],
      "runOptions": {
        "runOn": "folderOpen"
      }
    },
    {
      "label": "Run All Tests",
      "type": "npm", 
      "script": "test:all",
      "group": "test",
      "presentation": {
        "reveal": "always",
        "panel": "dedicated"
      }
    },
    {
      "label": "Database Reset",
      "type": "npm",
      "script": "db:reset",
      "group": "build",
      "presentation": {
        "reveal": "always"
      }
    },
    {
      "label": "Generate Prisma Client",
      "type": "shell",
      "command": "npx prisma generate",
      "group": "build"
    },
    {
      "label": "Health Check",
      "type": "shell",
      "command": "curl http://localhost:3000/health",
      "group": "test"
    }
  ]
}
```

**Configuration de debug enrichie** (`.vscode/launch.json`)
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug NestJS App",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/src/main.ts",
      "runtimeArgs": [
        "-r", "ts-node/register",
        "-r", "tsconfig-paths/register"
      ],
      "env": {
        "NODE_ENV": "development"
      },
      "console": "integratedTerminal",
      "restart": true,
      "protocol": "inspector",
      "envFile": "${workspaceFolder}/.env.development"
    },
    {
      "name": "Debug Tests",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/.bin/jest",
      "args": ["--runInBand", "--no-cache"],
      "console": "integratedTerminal",
      "env": {
        "NODE_ENV": "test"
      },
      "envFile": "${workspaceFolder}/.env.test"
    },
    {
      "name": "Debug Current Test File",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/.bin/jest",
      "args": [
        "--runInBand",
        "--no-cache",
        "${relativeFile}"
      ],
      "console": "integratedTerminal",
      "env": {
        "NODE_ENV": "test"
      }
    }
  ]
}
```
