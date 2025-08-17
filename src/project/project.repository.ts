/**
 * Repository Project - Couche d'accès aux données pour les entités Project
 * 
 * Ce repository encapsule toutes les opérations de persistance avec PostgreSQL
 * via Prisma ORM, en assurant la séparation des préoccupations entre la logique
 * métier (services) et l'accès aux données.
 * 
 * RESPONSABILITÉS :
 * - Opérations CRUD complètes sur les projets
 * - Gestion des relations avec ProjectStatistics
 * - Optimisation des performances (pagination, index, cache)
 * - Transformation entre modèles Prisma et entités domain
 * - Gestion des transactions et de la cohérence des données
 * 
 * PERFORMANCES :
 * - Utilisation d'index optimaux pour les requêtes fréquentes
 * - Pagination cursor-based pour les gros volumes
 * - Chargement conditionnel des relations (eager/lazy)
 * - Requêtes batch pour les opérations multiples
 * 
 * SÉCURITÉ :
 * - Validation stricte des entrées
 * - Isolation des données par propriétaire (ownerId)
 * - Protection contre les injections SQL
 * - Audit des opérations sensibles
 * 
 * @fileoverview Repository principal pour la gestion des projets
 * @version 1.0.0
 * @since 2025-01-28
 */

import { Injectable, Logger } from '@nestjs/common';
import { Prisma, ProjectStatus, Project, ProjectStatistics } from '@prisma/client';
import { DatabaseService } from '../database/database.service';
import { ProjectEntity, CreateProjectData, UpdateProjectData, ProjectSummary, ProjectExportData } from './entities/project.entity';
import { PaginationDto } from '../common/dto/pagination.dto';
import { PaginatedResult, createPaginatedResult, createEmptyPaginatedResult, validatePaginationParams } from '../common/interfaces/paginated-result.interface';

/**
 * Types d'erreurs spécialisées pour le repository
 */
export class ProjectNotFoundError extends Error {
  constructor(projectId: string) {
    super(`Project with ID "${projectId}" not found`);
    this.name = 'ProjectNotFoundError';
  }
}

export class ProjectOwnershipError extends Error {
  constructor(projectId: string, userId: string) {
    super(`User "${userId}" does not own project "${projectId}"`);
    this.name = 'ProjectOwnershipError';
  }
}

export class ProjectConstraintError extends Error {
  constructor(message: string) {
    super(`Database constraint violation: ${message}`);
    this.name = 'ProjectConstraintError';
  }
}

export class ProjectOptimisticLockError extends Error {
  constructor(projectId: string) {
    super(`Project "${projectId}" was modified by another operation`);
    this.name = 'ProjectOptimisticLockError';
  }
}

/**
 * Interface pour les filtres de recherche de projets
 */
export interface ProjectFilters {
  /** Statut(s) de projet à inclure */
  status?: ProjectStatus | ProjectStatus[];
  /** Filtrer les projets ayant des fichiers générés */
  hasGeneratedFiles?: boolean;
  /** Filtrer les projets ayant des statistiques */
  hasStatistics?: boolean;
  /** Projets créés après cette date */
  createdAfter?: Date;
  /** Projets créés avant cette date */
  createdBefore?: Date;
  /** Recherche textuelle (nom, description) */
  search?: string;
}

/**
 * Options de requête pour contrôler le comportement des opérations
 */
export interface ProjectQueryOptions {
  /** Inclure les statistiques dans les résultats */
  includeStatistics?: boolean;
  /** Inclure les projets supprimés (soft delete) */
  includeDeleted?: boolean;
  /** Champ de tri */
  orderBy?: 'createdAt' | 'updatedAt' | 'name';
  /** Direction du tri */
  order?: 'asc' | 'desc';
}

/**
 * Interface pour les données de mise à jour des fichiers générés
 */
export interface GeneratedFilesUpdate {
  /** Identifiants des nouveaux fichiers générés */
  fileIds: string[];
  /** Mode de mise à jour */
  mode: 'replace' | 'append';
}

/**
 * Type pour un projet Prisma avec ses relations optionnelles
 */
type ProjectWithRelations = Project & {
  statistics?: ProjectStatistics | null;
};

/**
 * Repository principal pour la gestion des projets
 * 
 * Encapsule toutes les opérations de persistance avec optimisations
 * de performance et gestion d'erreurs appropriée.
 */
@Injectable()
export class ProjectRepository {
  private readonly logger = new Logger(ProjectRepository.name);

  constructor(
    private readonly db: DatabaseService,
  ) {}

  // ========================================================================
  // OPÉRATIONS CRUD PRINCIPALES
  // ========================================================================

  /**
   * Crée un nouveau projet avec validation et transaction
   * 
   * @param data Données de création du projet
   * @param ownerId Identifiant du propriétaire
   * @returns Projet créé transformé en entité
   * @throws ProjectConstraintError si les contraintes sont violées
   * 
   * @example
   * ```typescript
   * const project = await repository.create({
   *   name: 'Mon Projet',
   *   description: 'Description du projet',
   *   initialPrompt: 'Créer une application web...',
   *   uploadedFileIds: ['file1', 'file2']
   * }, 'user-123');
   * ```
   */
  async create(data: CreateProjectData, ownerId: string): Promise<ProjectEntity> {
    this.logger.log(`Creating project for user ${ownerId}`, {
      operation: 'create',
      ownerId,
      projectName: data.name,
    });

    try {
      // Validation préalable
      await this.validateCreateData(data, ownerId);

      const projectData: Prisma.ProjectCreateInput = {
        name: data.name.trim(),
        description: data.description?.trim() || null,
        initialPrompt: data.initialPrompt.trim(),
        status: ProjectStatus.ACTIVE,
        uploadedFileIds: data.uploadedFileIds || [],
        generatedFileIds: [],
        ownerId,
      };

      const createdProject = await this.db.project.create({
        data: projectData,
        include: {
          statistics: false, // Pas de statistiques lors de la création
        },
      });

      this.logger.log(`Project created successfully`, {
        operation: 'create',
        projectId: createdProject.id,
        ownerId,
      });

      return this.transformToEntity(createdProject);
    } catch (error) {
      this.logger.error(`Failed to create project for user ${ownerId}`, error);
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Récupère un projet par son identifiant
   * 
   * @param id Identifiant du projet
   * @param includeStatistics Inclure les statistiques dans le résultat
   * @returns Projet trouvé ou null si non trouvé
   * 
   * @example
   * ```typescript
   * const project = await repository.findById('project-123', true);
   * if (project) {
   *   console.log(`Found project: ${project.name}`);
   * }
   * ```
   */
  async findById(id: string, includeStatistics: boolean = false): Promise<ProjectEntity | null> {
    try {
      this.validateUUID(id, 'Project ID');

      const project = await this.db.project.findUnique({
        where: { id },
        include: {
          statistics: includeStatistics,
        },
      });

      if (!project) {
        return null;
      }

      return this.transformToEntity(project);
    } catch (error) {
      this.logger.error(`Failed to find project ${id}`, error);
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Récupère les projets d'un utilisateur avec pagination et filtres
   * 
   * @param ownerId Identifiant du propriétaire
   * @param pagination Paramètres de pagination
   * @param filters Filtres optionnels à appliquer
   * @param options Options de requête
   * @returns Résultat paginé des projets
   * 
   * @example
   * ```typescript
   * const result = await repository.findByOwner('user-123', {
   *   page: 1,
   *   limit: 10
   * }, {
   *   status: ProjectStatus.ACTIVE,
   *   hasGeneratedFiles: true
   * });
   * 
   * console.log(`Found ${result.data.length} projects out of ${result.total}`);
   * ```
   */
  async findByOwner(
    ownerId: string,
    pagination: PaginationDto,
    filters?: ProjectFilters,
    options?: ProjectQueryOptions,
  ): Promise<PaginatedResult<ProjectEntity>> {
    try {
      this.validateUUID(ownerId, 'Owner ID');

      // Validation et normalisation des paramètres de pagination
      const { page, limit } = validatePaginationParams(
        pagination.page || 1,
        pagination.limit || 10,
        100, // Limite max
      );

      // Construction de la clause WHERE
      const where = this.buildWhereClause(ownerId, filters, options);

      // Construction de la clause ORDER BY
      const orderBy = this.buildOrderByClause(options);

      // Calcul des paramètres de pagination
      const skip = (page - 1) * limit;
      const take = limit;

      // Exécution des requêtes en parallèle pour optimiser les performances
      const [projects, total] = await Promise.all([
        this.db.project.findMany({
          where,
          include: {
            statistics: options?.includeStatistics || false,
          },
          orderBy,
          skip,
          take,
        }),
        this.db.project.count({ where }),
      ]);

      // Transformation des résultats
      const entities = projects.map((project: ProjectWithRelations) => this.transformToEntity(project));

      this.logger.debug(`Found ${entities.length} projects for user ${ownerId}`, {
        operation: 'findByOwner',
        ownerId,
        page,
        limit,
        total,
        filters: filters ? Object.keys(filters) : [],
      });

      return createPaginatedResult(entities, page, limit, total);
    } catch (error) {
      this.logger.error(`Failed to find projects for user ${ownerId}`, error);
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Met à jour un projet existant avec optimistic locking
   * 
   * @param id Identifiant du projet
   * @param data Données de mise à jour partielles
   * @returns Projet mis à jour
   * @throws ProjectNotFoundError si le projet n'existe pas
   * @throws ProjectOptimisticLockError en cas de conflit de modification
   * 
   * @example
   * ```typescript
   * const updated = await repository.update('project-123', {
   *   name: 'Nouveau nom',
   *   description: 'Nouvelle description'
   * });
   * ```
   */
  async update(id: string, data: UpdateProjectData): Promise<ProjectEntity> {
    this.logger.log(`Updating project ${id}`, {
      operation: 'update',
      projectId: id,
      fields: Object.keys(data),
    });

    try {
      this.validateUUID(id, 'Project ID');

      // Vérification de l'existence du projet
      const currentProject = await this.findById(id);
      if (!currentProject) {
        throw new ProjectNotFoundError(id);
      }

      // Validation des données de mise à jour
      await this.validateUpdateData(data);

      // Préparation des données Prisma
      const updateData: Prisma.ProjectUpdateInput = {};

      if (data.name !== undefined) {
        updateData.name = data.name.trim();
      }
      if (data.description !== undefined) {
        updateData.description = data.description?.trim() || null;
      }
      if (data.status !== undefined) {
        // Validation de la transition d'état
        this.validateStatusTransition(currentProject.status, data.status);
        updateData.status = data.status;
      }
      if (data.uploadedFileIds !== undefined) {
        updateData.uploadedFileIds = [...data.uploadedFileIds];
      }
      if (data.generatedFileIds !== undefined) {
        updateData.generatedFileIds = [...data.generatedFileIds];
      }

      // Mise à jour avec optimistic locking
      const updatedProject = await this.db.project.update({
        where: {
          id,
          updatedAt: currentProject.updatedAt, // Optimistic lock
        },
        data: updateData,
        include: {
          statistics: false,
        },
      });

      this.logger.log(`Project updated successfully`, {
        operation: 'update',
        projectId: id,
      });

      return this.transformToEntity(updatedProject);
    } catch (error) {
      if (error instanceof ProjectNotFoundError) {
        throw error;
      }

      // Gestion de l'optimistic locking
      if (error.code === 'P2025') {
        throw new ProjectOptimisticLockError(id);
      }

      this.logger.error(`Failed to update project ${id}`, error);
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Supprime logiquement un projet (soft delete)
   * 
   * @param id Identifiant du projet à supprimer
   * @throws ProjectNotFoundError si le projet n'existe pas
   * 
   * @example
   * ```typescript
   * await repository.delete('project-123');
   * ```
   */
  async delete(id: string): Promise<void> {
    this.logger.log(`Deleting project ${id}`, {
      operation: 'delete',
      projectId: id,
    });

    try {
      this.validateUUID(id, 'Project ID');

      const result = await this.db.project.update({
        where: { id },
        data: {
          status: ProjectStatus.DELETED,
          updatedAt: new Date(),
        },
      });

      this.logger.log(`Project deleted successfully`, {
        operation: 'delete',
        projectId: id,
      });
    } catch (error) {
      if (error.code === 'P2025') {
        throw new ProjectNotFoundError(id);
      }

      this.logger.error(`Failed to delete project ${id}`, error);
      throw this.handlePrismaError(error);
    }
  }

  // ========================================================================
  // OPÉRATIONS SPÉCIALISÉES
  // ========================================================================

  /**
   * Met à jour spécifiquement les fichiers générés d'un projet
   * 
   * @param id Identifiant du projet
   * @param update Données de mise à jour des fichiers
   * @throws ProjectNotFoundError si le projet n'existe pas
   * 
   * @example
   * ```typescript
   * await repository.updateGeneratedFiles('project-123', {
   *   fileIds: ['file1', 'file2', 'file3'],
   *   mode: 'append'
   * });
   * ```
   */
  async updateGeneratedFiles(id: string, update: GeneratedFilesUpdate): Promise<void> {
    this.logger.log(`Updating generated files for project ${id}`, {
      operation: 'updateGeneratedFiles',
      projectId: id,
      mode: update.mode,
      fileCount: update.fileIds.length,
    });

    try {
      this.validateUUID(id, 'Project ID');
      this.validateFileIds(update.fileIds);

      if (update.mode === 'replace') {
        // Remplacement complet
        await this.db.project.update({
          where: { id },
          data: {
            generatedFileIds: update.fileIds,
            updatedAt: new Date(),
          },
        });
      } else {
        // Mode append : récupérer les fichiers existants et ajouter les nouveaux
        const project = await this.db.project.findUnique({
          where: { id },
          select: { generatedFileIds: true },
        });

        if (!project) {
          throw new ProjectNotFoundError(id);
        }

        // Suppression des doublons et ajout des nouveaux fichiers
        const existingFiles = new Set(project.generatedFileIds);
        const newFiles = update.fileIds.filter(fileId => !existingFiles.has(fileId));
        const updatedFileIds = [...project.generatedFileIds, ...newFiles];

        await this.db.project.update({
          where: { id },
          data: {
            generatedFileIds: updatedFileIds,
            updatedAt: new Date(),
          },
        });
      }

      this.logger.log(`Generated files updated successfully`, {
        operation: 'updateGeneratedFiles',
        projectId: id,
      });
    } catch (error) {
      if (error instanceof ProjectNotFoundError) {
        throw error;
      }

      if (error.code === 'P2025') {
        throw new ProjectNotFoundError(id);
      }

      this.logger.error(`Failed to update generated files for project ${id}`, error);
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Compte les projets d'un utilisateur avec filtres optionnels
   * 
   * @param ownerId Identifiant du propriétaire
   * @param filters Filtres optionnels
   * @returns Nombre de projets correspondants
   * 
   * @example
   * ```typescript
   * const activeCount = await repository.countByOwner('user-123', {
   *   status: ProjectStatus.ACTIVE
   * });
   * ```
   */
  async countByOwner(ownerId: string, filters?: ProjectFilters): Promise<number> {
    try {
      this.validateUUID(ownerId, 'Owner ID');

      const where = this.buildWhereClause(ownerId, filters);

      const count = await this.db.project.count({ where });

      return count;
    } catch (error) {
      this.logger.error(`Failed to count projects for user ${ownerId}`, error);
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Récupère les projets actifs d'un utilisateur
   * 
   * @param ownerId Identifiant du propriétaire
   * @returns Liste des projets actifs
   */
  async findActiveByOwner(ownerId: string): Promise<ProjectEntity[]> {
    try {
      this.validateUUID(ownerId, 'Owner ID');

      const projects = await this.db.project.findMany({
        where: {
          ownerId,
          status: ProjectStatus.ACTIVE,
        },
        include: {
          statistics: false,
        },
        orderBy: {
          updatedAt: 'desc',
        },
      });

      return projects.map((project: ProjectWithRelations) => this.transformToEntity(project));
    } catch (error) {
      this.logger.error(`Failed to find active projects for user ${ownerId}`, error);
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Récupère les projets récents d'un utilisateur
   * 
   * @param ownerId Identifiant du propriétaire
   * @param days Nombre de jours pour définir "récent"
   * @returns Liste des projets récents
   */
  async findRecentByOwner(ownerId: string, days: number = 7): Promise<ProjectEntity[]> {
    try {
      this.validateUUID(ownerId, 'Owner ID');

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      const projects = await this.db.project.findMany({
        where: {
          ownerId,
          status: {
            not: ProjectStatus.DELETED,
          },
          createdAt: {
            gte: cutoffDate,
          },
        },
        include: {
          statistics: false,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      return projects.map((project: ProjectWithRelations) => this.transformToEntity(project));
    } catch (error) {
      this.logger.error(`Failed to find recent projects for user ${ownerId}`, error);
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Recherche un projet par nom et propriétaire
   * 
   * @param name Nom du projet à rechercher
   * @param ownerId Identifiant du propriétaire
   * @returns Projet trouvé ou null si non trouvé
   */
  async findByNameAndOwner(name: string, ownerId: string): Promise<ProjectEntity | null> {
    try {
      this.validateUUID(ownerId, 'Owner ID');

      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return null;
      }

      const trimmedName = name.trim();

      const project = await this.db.project.findFirst({
        where: {
          name: {
            equals: trimmedName,
            mode: 'insensitive', // Recherche insensible à la casse
          },
          ownerId,
          status: {
            not: ProjectStatus.DELETED, // Exclure les projets supprimés
          },
        },
        include: {
          statistics: false, // Pas besoin des statistiques pour la validation
        },
      });

      if (!project) {
        return null;
      }

      return this.transformToEntity(project);
    } catch (error) {
      this.logger.error(`Failed to find project by name "${name}" for user ${ownerId}`, error);
      throw this.handlePrismaError(error);
    }
  }

  // ========================================================================
  // OPÉRATIONS BATCH
  // ========================================================================

  /**
   * Récupère plusieurs projets par leurs identifiants
   * 
   * @param ids Liste des identifiants
   * @param includeStatistics Inclure les statistiques
   * @returns Liste des projets trouvés
   */
  async findManyByIds(ids: string[], includeStatistics: boolean = false): Promise<ProjectEntity[]> {
    try {
      if (ids.length === 0) {
        return [];
      }

      ids.forEach(id => this.validateUUID(id, 'Project ID'));

      const projects = await this.db.project.findMany({
        where: {
          id: {
            in: ids,
          },
        },
        include: {
          statistics: includeStatistics,
        },
      });

      return projects.map((project: ProjectWithRelations) => this.transformToEntity(project));
    } catch (error) {
      this.logger.error(`Failed to find projects by IDs`, error);
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Met à jour le statut de plusieurs projets
   * 
   * @param ids Liste des identifiants
   * @param status Nouveau statut
   * @returns Nombre de projets mis à jour
   */
  async updateManyStatuses(ids: string[], status: ProjectStatus): Promise<number> {
    try {
      if (ids.length === 0) {
        return 0;
      }

      ids.forEach(id => this.validateUUID(id, 'Project ID'));

      const result = await this.db.project.updateMany({
        where: {
          id: {
            in: ids,
          },
        },
        data: {
          status,
          updatedAt: new Date(),
        },
      });

      this.logger.log(`Updated status for ${result.count} projects`, {
        operation: 'updateManyStatuses',
        count: result.count,
        status,
      });

      return result.count;
    } catch (error) {
      this.logger.error(`Failed to update statuses for projects`, error);
      throw this.handlePrismaError(error);
    }
  }

  // ========================================================================
  // MÉTHODES DE VALIDATION ET EXISTENCE
  // ========================================================================

  /**
   * Vérifie si un projet existe
   * 
   * @param id Identifiant du projet
   * @returns true si le projet existe
   */
  async exists(id: string): Promise<boolean> {
    try {
      this.validateUUID(id, 'Project ID');

      const project = await this.db.project.findUnique({
        where: { id },
        select: { id: true },
      });

      return project !== null;
    } catch (error) {
      this.logger.error(`Failed to check existence of project ${id}`, error);
      return false;
    }
  }

  /**
   * Vérifie si un projet existe pour un propriétaire donné
   * 
   * @param id Identifiant du projet
   * @param ownerId Identifiant du propriétaire
   * @returns true si le projet existe et appartient au propriétaire
   */
  async existsForOwner(id: string, ownerId: string): Promise<boolean> {
    try {
      this.validateUUID(id, 'Project ID');
      this.validateUUID(ownerId, 'Owner ID');

      const project = await this.db.project.findUnique({
        where: {
          id,
          ownerId,
        },
        select: { id: true },
      });

      return project !== null;
    } catch (error) {
      this.logger.error(`Failed to check ownership of project ${id} for user ${ownerId}`, error);
      return false;
    }
  }

  /**
   * Vérifie si un utilisateur est propriétaire d'un projet
   * 
   * @param projectId Identifiant du projet
   * @param userId Identifiant de l'utilisateur
   * @returns true si l'utilisateur est propriétaire
   */
  async isOwner(projectId: string, userId: string): Promise<boolean> {
    return this.existsForOwner(projectId, userId);
  }

  // ========================================================================
  // MÉTHODES PRIVÉES - CONSTRUCTION DE REQUÊTES
  // ========================================================================

  /**
   * Construit la clause WHERE pour les requêtes de recherche
   */
  private buildWhereClause(
    ownerId: string,
    filters?: ProjectFilters,
    options?: ProjectQueryOptions,
  ): Prisma.ProjectWhereInput {
    const where: Prisma.ProjectWhereInput = {
      ownerId,
    };

    // Gestion des projets supprimés
    if (!options?.includeDeleted) {
      where.status = {
        not: ProjectStatus.DELETED,
      };
    }

    if (!filters) {
      return where;
    }

    // Filtre par statut
    if (filters.status) {
      if (Array.isArray(filters.status)) {
        where.status = {
          in: filters.status,
        };
      } else {
        where.status = filters.status;
      }
    }

    // Filtre par présence de fichiers générés
    if (filters.hasGeneratedFiles !== undefined) {
      if (filters.hasGeneratedFiles) {
        where.generatedFileIds = {
          isEmpty: false,
        };
      } else {
        where.generatedFileIds = {
          isEmpty: true,
        };
      }
    }

    // Filtre par présence de statistiques
    if (filters.hasStatistics !== undefined) {
      if (filters.hasStatistics) {
        where.statistics = {
          isNot: null,
        };
      } else {
        where.statistics = {
          is: null,
        };
      }
    }

    // Filtre par date de création
    if (filters.createdAfter || filters.createdBefore) {
      where.createdAt = {};
      if (filters.createdAfter) {
        where.createdAt.gte = filters.createdAfter;
      }
      if (filters.createdBefore) {
        where.createdAt.lte = filters.createdBefore;
      }
    }

    // Recherche textuelle
    if (filters.search) {
      const searchTerm = filters.search.trim();
      if (searchTerm.length > 0) {
        where.OR = [
          {
            name: {
              contains: searchTerm,
              mode: 'insensitive',
            },
          },
          {
            description: {
              contains: searchTerm,
              mode: 'insensitive',
            },
          },
        ];
      }
    }

    return where;
  }

  /**
   * Construit la clause ORDER BY pour les requêtes
   */
  private buildOrderByClause(options?: ProjectQueryOptions): Prisma.ProjectOrderByWithRelationInput {
    const orderBy = options?.orderBy || 'createdAt';
    const order = options?.order || 'desc';

    return {
      [orderBy]: order,
    };
  }

  // ========================================================================
  // MÉTHODES PRIVÉES - TRANSFORMATION ET VALIDATION
  // ========================================================================

  /**
   * Parse un champ JSON de Prisma vers un Record<string, any>
   */
  private parseJsonField(jsonValue: Prisma.JsonValue, defaultValue: Record<string, any> = {}): Record<string, any> {
    // Si la valeur est null ou undefined, retourner la valeur par défaut
    if (jsonValue === null || jsonValue === undefined) {
      return defaultValue;
    }

    // Si c'est déjà un objet (JsonObject), le retourner tel quel
    if (typeof jsonValue === 'object' && !Array.isArray(jsonValue)) {
      return jsonValue as Record<string, any>;
    }

    // Si c'est un string, essayer de le parser comme JSON
    if (typeof jsonValue === 'string') {
      try {
        const parsed = JSON.parse(jsonValue);
        if (typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed;
        }
      } catch (error) {
        this.logger.warn(`Failed to parse JSON field: ${jsonValue}`, error);
      }
    }

    // Pour tous les autres cas (number, boolean, array), retourner la valeur par défaut
    return defaultValue;
  }

  /**
   * Transforme un objet Prisma en entité domain
   */
  private transformToEntity(prismaProject: ProjectWithRelations): ProjectEntity {
    const entity = new ProjectEntity();

    entity.id = prismaProject.id;
    entity.name = prismaProject.name;
    entity.description = prismaProject.description || undefined; // Conversion null -> undefined
    entity.initialPrompt = prismaProject.initialPrompt;
    entity.status = prismaProject.status;
    entity.uploadedFileIds = prismaProject.uploadedFileIds || [];
    entity.generatedFileIds = prismaProject.generatedFileIds || [];
    entity.ownerId = prismaProject.ownerId;
    entity.createdAt = prismaProject.createdAt;
    entity.updatedAt = prismaProject.updatedAt;

    // Transformation des statistiques si présentes
    if (prismaProject.statistics) {
      entity.statistics = {
        id: prismaProject.statistics.id,
        projectId: prismaProject.statistics.projectId,
        costs: this.parseJsonField(prismaProject.statistics.costs, {}),
        performance: this.parseJsonField(prismaProject.statistics.performance, {}),
        usage: this.parseJsonField(prismaProject.statistics.usage, {}),
        lastUpdated: prismaProject.statistics.lastUpdated,
      };
    }

    return entity;
  }

  /**
   * Valide les données de création d'un projet
   */
  private async validateCreateData(data: CreateProjectData, ownerId: string): Promise<void> {
    // Validation du nom
    if (!data.name || data.name.trim().length === 0) {
      throw new ProjectConstraintError('Project name is required');
    }

    if (data.name.trim().length > 100) {
      throw new ProjectConstraintError('Project name cannot exceed 100 characters');
    }

    // Validation du prompt initial
    if (!data.initialPrompt || data.initialPrompt.trim().length < 10) {
      throw new ProjectConstraintError('Initial prompt must be at least 10 characters long');
    }

    if (data.initialPrompt.trim().length > 5000) {
      throw new ProjectConstraintError('Initial prompt cannot exceed 5000 characters');
    }

    // Validation de la description
    if (data.description && data.description.trim().length > 1000) {
      throw new ProjectConstraintError('Description cannot exceed 1000 characters');
    }

    // Validation des fichiers uploadés
    if (data.uploadedFileIds) {
      this.validateFileIds(data.uploadedFileIds);
    }

    // Validation de l'ownership
    this.validateUUID(ownerId, 'Owner ID');
  }

  /**
   * Valide les données de mise à jour d'un projet
   */
  private async validateUpdateData(data: UpdateProjectData): Promise<void> {
    // Validation du nom si fourni
    if (data.name !== undefined) {
      if (!data.name || data.name.trim().length === 0) {
        throw new ProjectConstraintError('Project name cannot be empty');
      }

      if (data.name.trim().length > 100) {
        throw new ProjectConstraintError('Project name cannot exceed 100 characters');
      }
    }

    // Validation de la description si fournie
    if (data.description !== undefined && data.description && data.description.trim().length > 1000) {
      throw new ProjectConstraintError('Description cannot exceed 1000 characters');
    }

    // Validation des fichiers si fournis
    if (data.uploadedFileIds) {
      this.validateFileIds(data.uploadedFileIds);
    }

    if (data.generatedFileIds) {
      this.validateFileIds(data.generatedFileIds);
    }
  }

  /**
   * Valide une transition de statut
   */
  private validateStatusTransition(currentStatus: ProjectStatus, newStatus: ProjectStatus): void {
    const validTransitions: Record<ProjectStatus, ProjectStatus[]> = {
      [ProjectStatus.ACTIVE]: [ProjectStatus.ARCHIVED, ProjectStatus.DELETED],
      [ProjectStatus.ARCHIVED]: [ProjectStatus.ACTIVE, ProjectStatus.DELETED],
      [ProjectStatus.DELETED]: [], // État final
    };

    const allowedStatuses = validTransitions[currentStatus];
    if (!allowedStatuses.includes(newStatus)) {
      throw new ProjectConstraintError(
        `Invalid status transition from ${currentStatus} to ${newStatus}`
      );
    }
  }

  /**
   * Valide qu'une chaîne est un UUID valide
   */
  private validateUUID(value: string, fieldName: string): void {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    
    if (!value || typeof value !== 'string' || !uuidRegex.test(value)) {
      throw new ProjectConstraintError(`${fieldName} must be a valid UUID`);
    }
  }

  /**
   * Valide un tableau d'identifiants de fichiers
   */
  private validateFileIds(fileIds: string[]): void {
    if (!Array.isArray(fileIds)) {
      throw new ProjectConstraintError('File IDs must be an array');
    }

    fileIds.forEach((fileId, index) => {
      try {
        this.validateUUID(fileId, `File ID at index ${index}`);
      } catch (error) {
        throw new ProjectConstraintError(`Invalid file ID at index ${index}: ${fileId}`);
      }
    });
  }

  // ========================================================================
  // MÉTHODES PRIVÉES - GESTION D'ERREURS
  // ========================================================================

  /**
   * Transforme les erreurs Prisma en erreurs métier appropriées
   */
  private handlePrismaError(error: any): Error {
    // Si c'est déjà une erreur métier, la retourner telle quelle
    if (error instanceof ProjectNotFoundError ||
        error instanceof ProjectOwnershipError ||
        error instanceof ProjectConstraintError ||
        error instanceof ProjectOptimisticLockError) {
      return error;
    }

    // Transformation des erreurs Prisma communes
    if (error.code) {
      switch (error.code) {
        case 'P2002':
          // Unique constraint violation
          return new ProjectConstraintError('A project with this name already exists for this user');

        case 'P2025':
          // Record not found
          return new ProjectNotFoundError('Project');

        case 'P2034':
          // Transaction failed
          return new ProjectOptimisticLockError('Transaction');

        case 'P2003':
          // Foreign key constraint violation
          return new ProjectConstraintError('Referenced entity does not exist');

        default:
          this.logger.error(`Unhandled Prisma error code: ${error.code}`, error);
          break;
      }
    }

    // Erreur générique avec message sanitisé
    const sanitizedMessage = this.sanitizeErrorMessage(error.message || 'Unknown database error');
    return new Error(`Database operation failed: ${sanitizedMessage}`);
  }

  /**
   * Sanitise les messages d'erreur pour éviter l'exposition d'informations sensibles
   */
  private sanitizeErrorMessage(message: string): string {
    // Patterns de données sensibles à masquer
    const sensitivePatterns = [
      /password[^:]*:[^@]*/gi,
      /\/\/[^:]+:[^@]+@/gi,
      /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,
      /user\s+"[^"]+"/gi,
    ];

    let sanitized = message;
    sensitivePatterns.forEach(pattern => {
      sanitized = sanitized.replace(pattern, '***');
    });

    return sanitized;
  }
}