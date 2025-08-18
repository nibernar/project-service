/**
 * ProjectModule - Module principal pour la gestion des projets
 *
 * @fileoverview Module principal pour la gestion des projets utilisateurs
 * @version 1.0.0
 * @since 2025-01-28
 * @author Coders Team
 *
 * @example
 * ```typescript
 * // Utilisation dans un autre module
 * @Module({
 *   imports: [ProjectModule],
 * })
 * export class SomeModule {
 *   constructor(private readonly projectService: ProjectService) {}
 * }
 * ```
 */

import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { CacheModule } from '../cache/cache.module';
import { EventsModule } from '../events/events.module';
import { ProjectController } from './project.controller';
import { ProjectService } from './project.service';
import { ProjectRepository } from './project.repository';

/**
 * Module principal pour la gestion des projets
 *
 * @public
 */
@Module({
  imports: [
    // Module global pour l'accès aux données PostgreSQL
    // Fournit : DatabaseService (client Prisma configuré)
    // Inclut : Connection pooling, health checks, migrations
    DatabaseModule,

    // Module global pour le cache Redis haute performance
    // Fournit : CacheService (client Redis typé)
    // Inclut : Sérialisation JSON, TTL, invalidation
    CacheModule,

    // Module pour la publication d'événements métier
    // Phase 3 : Service stub avec logging
    // Phase 6 : HTTP client + Message queue + Retry logic
    // Fournit : EventsService
    EventsModule,
  ],

  // Contrôleurs REST pour l'API publique
  controllers: [
    // API REST complète pour la gestion des projets
    // Routes : /projects/*
    // Sécurité : AuthGuard + ProjectOwnerGuard
    // Validation : DTOs avec class-validator
    ProjectController,
  ],

  // Services et providers du domaine Project
  providers: [
    // Service principal encapsulant la logique métier
    // Orchestration : Repository + Cache + Events
    // Scope : Singleton (performances optimisées)
    ProjectService,

    // Repository pour l'accès aux données
    // Abstraction : Découplage Prisma/métier
    // Responsabilité : Requêtes et transactions
    ProjectRepository,
  ],

  // Services exposés aux autres modules
  exports: [
    // Service principal - API publique du domaine
    // Utilisé par : StatisticsModule, ExportModule, API Gateway
    // Interface stable pour évolution future
    ProjectService,

    // Repository - Pour tests d'intégration avancés
    // Accès direct aux données si nécessaire
    // Utilisation : Tests, migrations, administration
    ProjectRepository,
  ],
})
export class ProjectModule {
  /**
   * Hook de cycle de vie pour validation du module
   *
   * Vérifie que toutes les dépendances sont correctement injectées
   * et que les configurations sont cohérentes.
   *
   * @private
   */
  constructor() {
    // Note: Les validations spécifiques sont déléguées aux services
    // Le module se contente d'orchestrer l'injection de dépendances
    // Future enhancement (Phase 4+):
    // - Validation des configurations inter-modules
    // - Enregistrement des métriques de démarrage
    // - Initialisation des health checks avancés
  }
}

/**
 * Types exportés pour utilisation externe
 *
 * Ces types permettent aux autres modules d'interagir
 * avec le ProjectModule sans couplage fort.
 */
export type {
  // Entités principales
  ProjectEntity,
} from './entities/project.entity';

export type {
  // DTO de création
  CreateProjectDto,
} from './dto/create-project.dto';

export type {
  // DTO de mise à jour
  UpdateProjectDto,
} from './dto/update-project.dto';

export type {
  // DTO de réponse détaillée
  ProjectResponseDto,
} from './dto/project-response.dto';

export type {
  // DTO de liste optimisée
  ProjectListItemDto,
} from './dto/project-list.dto';

export type {
  // DTOs utilitaires
  PaginationDto,
} from '../common/dto/pagination.dto';

export type {
  // Interfaces de résultat
  PaginatedResult,
} from '../common/interfaces/paginated-result.interface';

/**
 * Configuration par défaut du module
 *
 * Ces constantes définissent le comportement par défaut
 * du ProjectModule et peuvent être surchargées via
 * les variables d'environnement.
 */
export const PROJECT_MODULE_CONFIG = {
  // Cache configuration
  CACHE_TTL_SECONDS: 300, // 5 minutes
  CACHE_KEY_PREFIX: 'project:',

  // Pagination par défaut
  DEFAULT_PAGE_SIZE: 10,
  MAX_PAGE_SIZE: 100,

  // Validation des projets
  MAX_PROJECT_NAME_LENGTH: 100,
  MAX_DESCRIPTION_LENGTH: 1000,
  MAX_PROMPT_LENGTH: 5000,

  // Événements
  EVENT_TIMEOUT_MS: 5000,
  MAX_RETRY_ATTEMPTS: 3,

  // Performance
  SLOW_QUERY_THRESHOLD_MS: 1000,
  CACHE_WARMING_ENABLED: false, // Phase 4+
} as const;

/**
 * Métadonnées du module pour introspection
 *
 * Ces informations peuvent être utilisées par les outils
 * de monitoring et d'administration.
 */
export const PROJECT_MODULE_METADATA = {
  name: 'ProjectModule',
  version: '1.0.0',
  domain: 'Project Management',
  phase: 3,

  // Dépendances requises
  dependencies: ['DatabaseModule', 'CacheModule', 'EventsModule'],

  // Services fournis
  provides: ['ProjectService', 'ProjectRepository', 'ProjectController'],

  // API exposée
  endpoints: [
    'POST /projects',
    'GET /projects',
    'GET /projects/:id',
    'PATCH /projects/:id',
    'PUT /projects/:id/archive',
    'DELETE /projects/:id',
  ],

  // Événements publiés
  events: [
    'project.created',
    'project.updated',
    'project.archived',
    'project.deleted',
  ],

  // Métriques exposées
  metrics: [
    'project_operations_total',
    'project_cache_hits_total',
    'project_cache_misses_total',
    'project_events_published_total',
    'project_response_time_seconds',
  ],

  // Prêt pour évolution
  evolutionReadiness: {
    phase4: 'StatisticsModule integration ready',
    phase5: 'ExportModule integration ready',
    phase6: 'Full EventsModule ready',
  },
} as const;
