/**
 * Service Project - Logique métier principale du Service de Gestion des Projets (C04)
 *
 * Ce service orchestre toutes les opérations métier sur les projets utilisateurs,
 * en coordonnant l'accès aux données, la gestion du cache, les événements métier
 * et les transformations entre entités et DTOs.
 *
 * RESPONSABILITÉS PRINCIPALES :
 * - CRUD complet avec validation métier
 * - Gestion des permissions et de l'ownership
 * - Optimisation des performances via cache Redis
 * - Publication d'événements vers l'orchestrateur
 * - Transformation entre entités domain et DTOs API
 * - Gestion centralisée des erreurs métier
 *
 * ARCHITECTURE :
 * - Repository Pattern pour l'accès aux données
 * - Cache-aside Pattern pour les performances
 * - Event-driven Pattern pour la communication inter-services
 * - DTO Pattern pour l'isolation des couches
 *
 * SÉCURITÉ :
 * - Validation stricte des permissions (ownership)
 * - Sanitisation des entrées utilisateur
 * - Audit trail des opérations sensibles
 * - Protection contre les attaques par déni de service
 *
 * @fileoverview Service métier principal pour la gestion des projets
 * @version 1.0.0
 * @since 2025-01-28
 */

import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import {
  ProjectRepository,
  ProjectFilters,
  ProjectQueryOptions,
  GeneratedFilesUpdate,
  ProjectNotFoundError,
  ProjectOwnershipError,
  ProjectConstraintError,
  ProjectOptimisticLockError,
} from './project.repository';
import { CacheService } from '../cache/cache.service';
import {
  EventsService,
  ProjectCreatedEventDto,
  ProjectUpdatedEventDto,
  ProjectArchivedEventDto,
  ProjectDeletedEventDto,
  ProjectFilesUpdatedEventDto,
} from '../events/events.service';
import {
  ProjectEntity,
  CreateProjectData,
  UpdateProjectData,
} from './entities/project.entity';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import {
  ProjectResponseDto,
  StatisticsResponseDto,
} from './dto/project-response.dto';
import { ProjectListItemDto } from './dto/project-list.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import {
  PaginatedResult,
  createPaginatedResult,
  createEmptyPaginatedResult,
} from '../common/interfaces/paginated-result.interface';
import { User } from '../common/interfaces/user.interface';
import { ProjectStatus } from '../common/enums/project-status.enum';

/**
 * Interface pour les options de recherche de projets
 */
export interface ProjectSearchOptions extends ProjectFilters {
  /** Inclure les statistiques dans les résultats */
  includeStatistics?: boolean;
  /** Inclure les projets supprimés */
  includeDeleted?: boolean;
  /** Champ de tri */
  orderBy?: 'createdAt' | 'updatedAt' | 'name';
  /** Direction du tri */
  order?: 'asc' | 'desc';
}

/**
 * Service métier principal pour la gestion des projets
 *
 * Coordonne toutes les opérations métier et assure la cohérence
 * des données à travers les différentes couches de l'application.
 */
@Injectable()
export class ProjectService {
  private readonly logger = new Logger(ProjectService.name);

  // Clés de cache standardisées
  private readonly CACHE_KEYS = {
    PROJECT: (id: string) => `project:${id}`,
    PROJECT_LIST: (
      userId: string,
      page: number,
      limit: number,
      filtersHash: string,
    ) => `projects:${userId}:${page}:${limit}:${filtersHash}`,
    USER_PROJECTS_COUNT: (userId: string, filtersHash: string) =>
      `count:projects:${userId}:${filtersHash}`,
  };

  // TTL pour les différents types de cache (en secondes)
  private readonly CACHE_TTL = {
    PROJECT: 300, // 5 minutes
    PROJECT_LIST: 60, // 1 minute
    PROJECT_COUNT: 600, // 10 minutes
  };

  constructor(
    private readonly projectRepository: ProjectRepository,
    private readonly cacheService: CacheService,
    private readonly eventsService: EventsService,
  ) {}

  // ========================================================================
  // MÉTHODES PUBLIQUES - CRUD PRINCIPAL
  // ========================================================================

  /**
   * Crée un nouveau projet et déclenche le workflow de génération
   *
   * @param createDto Données de création du projet
   * @param ownerId ID du propriétaire authentifié
   * @returns Projet créé avec toutes les métadonnées
   * @throws BadRequestException si les données sont invalides
   * @throws ConflictException si le nom existe déjà (optionnel)
   * @throws InternalServerErrorException en cas d'erreur technique
   */
  async create(
    createDto: CreateProjectDto,
    ownerId: string,
  ): Promise<ProjectResponseDto> {
    this.logger.log(`Creating project for user ${ownerId}`, {
      operation: 'create',
      ownerId,
      projectName: createDto.name,
      hasUploadedFiles: createDto.hasUploadedFiles(),
      promptComplexity: createDto.getPromptComplexity(),
    });

    try {
      // 1. Validation métier des données
      await this.validateCreateData(createDto, ownerId);

      // 2. Préparation des données pour le repository
      const createData: CreateProjectData = {
        name: createDto.name.trim(),
        description: createDto.description?.trim(),
        initialPrompt: createDto.initialPrompt.trim(),
        uploadedFileIds: createDto.uploadedFileIds || [],
      };

      // 3. Création via repository avec transaction
      const createdProject = await this.projectRepository.create(
        createData,
        ownerId,
      );

      // 4. Invalidation du cache des listes utilisateur
      await this.invalidateUserCaches(ownerId);

      // 5. Publication de l'événement de création
      await this.publishProjectCreatedEvent(createdProject);

      // 6. Logging de l'audit
      this.logger.log(`Project created successfully`, {
        operation: 'create',
        projectId: createdProject.id,
        ownerId,
        uploadedFilesCount: createdProject.uploadedFileIds.length,
      });

      // 7. Transformation en DTO de réponse
      return this.transformToResponseDto(createdProject);
    } catch (error) {
      this.logger.error(`Failed to create project for user ${ownerId}`, error);
      throw this.handleServiceError(error, 'create');
    }
  }

  /**
   * Récupère un projet spécifique avec vérification des droits
   *
   * @param id UUID du projet
   * @param ownerId ID du propriétaire pour vérification
   * @returns Projet avec statistiques si disponibles
   * @throws NotFoundException si le projet n'existe pas
   * @throws ForbiddenException si accès non autorisé
   */
  async findOne(id: string, ownerId: string): Promise<ProjectResponseDto> {
    this.logger.debug(`Finding project ${id} for user ${ownerId}`, {
      operation: 'findOne',
      projectId: id,
      ownerId,
    });

    try {
      // 1. Validation des paramètres
      this.validateUUID(id, 'Project ID');
      this.validateUUID(ownerId, 'Owner ID');

      // 2. Tentative de récupération depuis le cache
      const cacheKey = this.CACHE_KEYS.PROJECT(id);
      let project = await this.cacheService.get<ProjectEntity>(cacheKey);

      if (!project) {
        // 3. Cache miss - récupération depuis la base avec statistiques
        project = await this.projectRepository.findById(id, true);

        if (!project) {
          throw new ProjectNotFoundError(id);
        }

        // 4. Mise en cache du résultat
        await this.cacheService.set(cacheKey, project, this.CACHE_TTL.PROJECT);
      }

      // 5. Vérification de l'ownership
      this.checkProjectOwnership(project, ownerId);

      // 6. Logging de la consultation
      this.logger.debug(`Project retrieved successfully`, {
        operation: 'findOne',
        projectId: id,
        ownerId,
        hasStatistics: project.hasStatistics(),
      });

      // 7. Transformation en DTO de réponse
      return this.transformToResponseDto(project);
    } catch (error) {
      this.logger.error(
        `Failed to find project ${id} for user ${ownerId}`,
        error,
      );
      throw this.handleServiceError(error, 'findOne');
    }
  }

  /**
   * Liste les projets d'un utilisateur avec pagination et filtres
   *
   * @param ownerId ID du propriétaire
   * @param pagination Paramètres de pagination
   * @param filters Filtres optionnels à appliquer
   * @returns Résultat paginé des projets
   */
  async findAll(
    ownerId: string,
    pagination: PaginationDto,
    filters?: ProjectSearchOptions,
  ): Promise<PaginatedResult<ProjectListItemDto>> {
    this.logger.debug(`Finding projects for user ${ownerId}`, {
      operation: 'findAll',
      ownerId,
      page: pagination.page,
      limit: pagination.limit,
      hasFilters: !!filters,
    });

    try {
      // 1. Validation des paramètres
      this.validateUUID(ownerId, 'Owner ID');

      // 2. Normalisation des paramètres pour la clé de cache
      const normalizedParams = this.normalizePagination(pagination);

      // 3. Construction de la clé de cache avec hash des filtres
      const filtersHash = this.hashFilters(filters);
      const cacheKey = this.CACHE_KEYS.PROJECT_LIST(
        ownerId,
        normalizedParams.page,
        normalizedParams.limit,
        filtersHash,
      );

      // 4. Tentative de récupération depuis le cache
      let result =
        await this.cacheService.get<PaginatedResult<ProjectListItemDto>>(
          cacheKey,
        );

      if (!result) {
        // 5. Cache miss - récupération depuis la base
        const repositoryFilters = this.convertToRepositoryFilters(filters);
        const queryOptions: ProjectQueryOptions = {
          includeStatistics: false, // Optimisation pour les listes
          includeDeleted: filters?.includeDeleted || false,
          orderBy: filters?.orderBy || 'updatedAt',
          order: filters?.order || 'desc',
        };

        // Utilisation de l'objet pagination original - le repository gère la normalisation
        const projects = await this.projectRepository.findByOwner(
          ownerId,
          pagination,
          repositoryFilters,
          queryOptions,
        );

        // 6. Transformation en DTOs de liste optimisés
        const listItems = projects.data.map((project) =>
          this.transformToListItemDto(project),
        );

        // 7. Construction du résultat paginé
        result = createPaginatedResult(
          listItems,
          projects.pagination.page,
          projects.pagination.limit,
          projects.total,
        );

        // 8. Mise en cache du résultat
        await this.cacheService.set(
          cacheKey,
          result,
          this.CACHE_TTL.PROJECT_LIST,
        );
      }

      // 9. Logging de la consultation
      this.logger.debug(`Projects retrieved successfully`, {
        operation: 'findAll',
        ownerId,
        count: result.data.length,
        total: result.total,
        cached: result !== null,
      });

      return result;
    } catch (error) {
      this.logger.error(`Failed to find projects for user ${ownerId}`, error);
      throw this.handleServiceError(error, 'findAll');
    }
  }

  /**
   * Met à jour les métadonnées d'un projet
   *
   * @param id UUID du projet
   * @param updateDto Données de mise à jour partielles
   * @param ownerId ID du propriétaire pour vérification
   * @returns Projet mis à jour
   * @throws NotFoundException si le projet n'existe pas
   * @throws ForbiddenException si accès non autorisé
   * @throws BadRequestException si les données sont invalides
   */
  async update(
    id: string,
    updateDto: UpdateProjectDto,
    ownerId: string,
  ): Promise<ProjectResponseDto> {
    this.logger.log(`Updating project ${id} for user ${ownerId}`, {
      operation: 'update',
      projectId: id,
      ownerId,
      updateFields: Object.keys(updateDto.getDefinedFields()),
      fieldCount: updateDto.getUpdateFieldsCount(),
    });

    try {
      // 1. Validation des paramètres
      this.validateUUID(id, 'Project ID');
      this.validateUUID(ownerId, 'Owner ID');

      if (!updateDto.hasValidUpdates()) {
        throw new BadRequestException('No valid updates provided');
      }

      // 2. Vérification de l'existence et de l'ownership
      const existingProject = await this.projectRepository.findById(id);
      if (!existingProject) {
        throw new ProjectNotFoundError(id);
      }

      this.checkProjectOwnership(existingProject, ownerId);

      // 3. Validation métier des données de mise à jour
      await this.validateUpdateData(updateDto, existingProject);

      // 4. Préparation des données pour le repository
      const updateData: UpdateProjectData = updateDto.getDefinedFields();

      // 5. Mise à jour via repository
      const updatedProject = await this.projectRepository.update(
        id,
        updateData,
      );

      // 6. Invalidation du cache
      await this.invalidateProjectCache(id, ownerId);

      // 7. Publication de l'événement de modification
      await this.publishProjectUpdatedEvent(updatedProject, updateData);

      // 8. Logging de la modification
      this.logger.log(`Project updated successfully`, {
        operation: 'update',
        projectId: id,
        ownerId,
        modifiedFields: Object.keys(updateData),
      });

      // 9. Transformation en DTO de réponse
      return this.transformToResponseDto(updatedProject);
    } catch (error) {
      this.logger.error(
        `Failed to update project ${id} for user ${ownerId}`,
        error,
      );
      throw this.handleServiceError(error, 'update');
    }
  }

  /**
   * Archive un projet (changement d'état vers ARCHIVED)
   *
   * @param id UUID du projet
   * @param ownerId ID du propriétaire
   * @throws NotFoundException si le projet n'existe pas
   * @throws ForbiddenException si accès non autorisé
   * @throws ConflictException si l'état ne permet pas l'archivage
   */
  async archive(id: string, ownerId: string): Promise<void> {
    this.logger.log(`Archiving project ${id} for user ${ownerId}`, {
      operation: 'archive',
      projectId: id,
      ownerId,
    });

    try {
      // 1. Validation des paramètres
      this.validateUUID(id, 'Project ID');
      this.validateUUID(ownerId, 'Owner ID');

      // 2. Vérification de l'existence et de l'ownership
      const project = await this.projectRepository.findById(id);
      if (!project) {
        throw new ProjectNotFoundError(id);
      }

      this.checkProjectOwnership(project, ownerId);

      // 3. Validation de la transition d'état
      if (!project.canTransitionTo(ProjectStatus.ARCHIVED)) {
        throw new ConflictException(
          `Cannot archive project in status: ${project.status}`,
        );
      }

      // 4. Mise à jour du statut via repository
      await this.projectRepository.update(id, {
        status: ProjectStatus.ARCHIVED,
      });

      // 5. Invalidation du cache
      await this.invalidateProjectCache(id, ownerId);

      // 6. Publication de l'événement d'archivage
      await this.publishProjectArchivedEvent(project);

      // 7. Logging de l'archivage
      this.logger.log(`Project archived successfully`, {
        operation: 'archive',
        projectId: id,
        ownerId,
        previousStatus: project.status,
      });
    } catch (error) {
      this.logger.error(
        `Failed to archive project ${id} for user ${ownerId}`,
        error,
      );
      throw this.handleServiceError(error, 'archive');
    }
  }

  /**
   * Supprime logiquement un projet (soft delete)
   *
   * @param id UUID du projet
   * @param ownerId ID du propriétaire
   * @throws NotFoundException si le projet n'existe pas
   * @throws ForbiddenException si accès non autorisé
   */
  async delete(id: string, ownerId: string): Promise<void> {
    this.logger.log(`Deleting project ${id} for user ${ownerId}`, {
      operation: 'delete',
      projectId: id,
      ownerId,
    });

    try {
      // 1. Validation des paramètres
      this.validateUUID(id, 'Project ID');
      this.validateUUID(ownerId, 'Owner ID');

      // 2. Vérification de l'existence et de l'ownership
      const project = await this.projectRepository.findById(id);
      if (!project) {
        throw new ProjectNotFoundError(id);
      }

      this.checkProjectOwnership(project, ownerId);

      // 3. Suppression logique via repository
      await this.projectRepository.delete(id);

      // 4. Invalidation complète du cache
      await this.invalidateProjectCache(id, ownerId);

      // 5. Publication de l'événement de suppression
      await this.publishProjectDeletedEvent(project);

      // 6. Logging de la suppression
      this.logger.log(`Project deleted successfully`, {
        operation: 'delete',
        projectId: id,
        ownerId,
        previousStatus: project.status,
      });
    } catch (error) {
      this.logger.error(
        `Failed to delete project ${id} for user ${ownerId}`,
        error,
      );
      throw this.handleServiceError(error, 'delete');
    }
  }

  /**
   * Met à jour les références de fichiers générés (appelé par l'orchestrateur)
   *
   * @param id UUID du projet
   * @param fileIds Liste des nouveaux IDs de fichiers générés
   * @param mode Mode de mise à jour ('append' ou 'replace')
   * @throws NotFoundException si le projet n'existe pas
   * @throws BadRequestException si les IDs de fichiers sont invalides
   */
  async updateGeneratedFiles(
    id: string,
    fileIds: string[],
    mode: 'append' | 'replace' = 'append',
  ): Promise<void> {
    this.logger.log(`Updating generated files for project ${id}`, {
      operation: 'updateGeneratedFiles',
      projectId: id,
      fileCount: fileIds.length,
      mode,
    });

    try {
      // 1. Validation des paramètres
      this.validateUUID(id, 'Project ID');
      this.validateFileIds(fileIds);

      // 2. Vérification de l'existence du projet
      const project = await this.projectRepository.findById(id);
      if (!project) {
        throw new ProjectNotFoundError(id);
      }

      // 3. Mise à jour via repository
      const update: GeneratedFilesUpdate = { fileIds, mode };
      await this.projectRepository.updateGeneratedFiles(id, update);

      // 4. Invalidation du cache du projet
      await this.invalidateProjectCache(id, project.ownerId);

      // 5. Publication de l'événement de mise à jour des fichiers
      await this.publishProjectFilesUpdatedEvent(project, fileIds, mode);

      // 6. Logging de la mise à jour
      this.logger.log(`Generated files updated successfully`, {
        operation: 'updateGeneratedFiles',
        projectId: id,
        newFileCount: fileIds.length,
        mode,
      });
    } catch (error) {
      this.logger.error(
        `Failed to update generated files for project ${id}`,
        error,
      );
      throw this.handleServiceError(error, 'updateGeneratedFiles');
    }
  }

  // ========================================================================
  // MÉTHODES PRIVÉES - VALIDATION ET HELPERS
  // ========================================================================

  /**
   * Valide les données de création d'un projet
   */
  private async validateCreateData(
    createDto: CreateProjectDto,
    ownerId: string,
  ): Promise<void> {
    // Validation de base via DTO déjà effectuée par les décorateurs class-validator

    // Validation métier supplémentaire
    if (!createDto.isValid()) {
      throw new BadRequestException('Invalid project data provided');
    }

    // Validation de l'ownership
    this.validateUUID(ownerId, 'Owner ID');

    // Validation de l'unicité du nom par utilisateur
    const existingProject = await this.projectRepository.findByNameAndOwner(
      createDto.name,
      ownerId,
    );
    if (existingProject) {
      throw new ConflictException(
        `A project with the name "${createDto.name}" already exists`,
      );
    }
  }

  /**
   * Valide les données de mise à jour d'un projet
   */
  private async validateUpdateData(
    updateDto: UpdateProjectDto,
    existingProject: ProjectEntity,
  ): Promise<void> {
    // Validation de base via DTO déjà effectuée par les décorateurs class-validator

    // Validation métier supplémentaire
    if (!updateDto.isValid()) {
      throw new BadRequestException('Invalid update data provided');
    }

    // Validation que le projet peut être modifié
    if (!existingProject.isModifiable()) {
      throw new ConflictException(
        `Project cannot be modified in status: ${existingProject.status}`,
      );
    }
  }

  /**
   * Vérifie que l'utilisateur est propriétaire du projet
   */
  private checkProjectOwnership(project: ProjectEntity, ownerId: string): void {
    if (!project.belongsToUserId(ownerId)) {
      throw new ForbiddenException(
        'You do not have permission to access this project',
      );
    }
  }

  /**
   * Valide qu'une chaîne est un UUID valide
   */
  private validateUUID(value: string, fieldName: string): void {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (!value || typeof value !== 'string' || !uuidRegex.test(value)) {
      throw new BadRequestException(`${fieldName} must be a valid UUID`);
    }
  }

  /**
   * Valide un tableau d'identifiants de fichiers
   */
  private validateFileIds(fileIds: string[]): void {
    if (!Array.isArray(fileIds)) {
      throw new BadRequestException('File IDs must be an array');
    }

    fileIds.forEach((fileId, index) => {
      try {
        this.validateUUID(fileId, `File ID at index ${index}`);
      } catch (error) {
        throw new BadRequestException(
          `Invalid file ID at index ${index}: ${fileId}`,
        );
      }
    });
  }

  /**
   * Normalise les paramètres de pagination
   */
  private normalizePagination(pagination: PaginationDto): {
    page: number;
    limit: number;
  } {
    return {
      page: Math.max(1, Math.floor(pagination.page || 1)),
      limit: Math.max(1, Math.min(100, Math.floor(pagination.limit || 10))),
    };
  }

  /**
   * Convertit les filtres de recherche en filtres repository
   */
  private convertToRepositoryFilters(
    filters?: ProjectSearchOptions,
  ): ProjectFilters | undefined {
    if (!filters) return undefined;

    return {
      status: filters.status,
      hasGeneratedFiles: filters.hasGeneratedFiles,
      hasStatistics: filters.hasStatistics,
      createdAfter: filters.createdAfter,
      createdBefore: filters.createdBefore,
      search: filters.search,
    };
  }

  /**
   * Génère un hash des filtres pour la clé de cache
   */
  private hashFilters(filters?: ProjectSearchOptions): string {
    if (!filters) return 'none';

    const filterString = JSON.stringify({
      status: filters.status,
      hasGeneratedFiles: filters.hasGeneratedFiles,
      hasStatistics: filters.hasStatistics,
      createdAfter: filters.createdAfter?.getTime(),
      createdBefore: filters.createdBefore?.getTime(),
      search: filters.search,
      orderBy: filters.orderBy,
      order: filters.order,
    });

    // Hash simple pour la clé de cache
    return Buffer.from(filterString).toString('base64').substring(0, 16);
  }

  // ========================================================================
  // MÉTHODES PRIVÉES - TRANSFORMATION DE DONNÉES
  // ========================================================================

  /**
   * Transforme une entité vers un DTO de réponse complet
   */
  private transformToResponseDto(project: ProjectEntity): ProjectResponseDto {
    const dto = plainToInstance(ProjectResponseDto, {
      id: project.id,
      name: project.name,
      description: project.description,
      initialPrompt: project.initialPrompt,
      status: project.status,
      uploadedFileIds: [...project.uploadedFileIds],
      generatedFileIds: [...project.generatedFileIds],
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      statistics: project.statistics
        ? this.transformStatisticsData(project.statistics)
        : undefined,
    });

    return dto;
  }

  /**
   * Transforme une entité vers un DTO de liste optimisé
   */
  private transformToListItemDto(project: ProjectEntity): ProjectListItemDto {
    const fileCount = project.getFileCount();

    const dto = plainToInstance(ProjectListItemDto, {
      id: project.id,
      name: project.name,
      description: project.description,
      status: project.status,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      uploadedFilesCount: fileCount.uploaded,
      generatedFilesCount: fileCount.generated,
      hasStatistics: project.hasStatistics(),
      totalCost: project.statistics?.costs
        ? (project.statistics.costs as any).total
        : undefined,
    });

    return dto;
  }

  /**
   * Transforme les données de statistiques pour l'API
   */
  private transformStatisticsData(statistics: any): StatisticsResponseDto {
    return plainToInstance(StatisticsResponseDto, {
      costs: statistics.costs || {
        claudeApi: 0,
        storage: 0,
        compute: 0,
        total: 0,
      },
      performance: statistics.performance || {
        generationTime: 0,
        processingTime: 0,
        totalTime: 0,
      },
      usage: statistics.usage || {
        documentsGenerated: 0,
        filesProcessed: 0,
        tokensUsed: 0,
      },
      lastUpdated: statistics.lastUpdated || new Date(),
    });
  }

  // ========================================================================
  // MÉTHODES PRIVÉES - GESTION DU CACHE
  // ========================================================================

  /**
   * Invalide le cache d'un projet spécifique et ses listes associées
   */
  private async invalidateProjectCache(
    projectId: string,
    ownerId: string,
  ): Promise<void> {
    try {
      // Invalidation du projet individuel
      const projectKey = this.CACHE_KEYS.PROJECT(projectId);
      await this.cacheService.del(projectKey);

      // Invalidation des listes et compteurs utilisateur
      await this.invalidateUserCaches(ownerId);

      this.logger.debug(`Cache invalidated for project ${projectId}`, {
        operation: 'invalidateProjectCache',
        projectId,
        ownerId,
      });
    } catch (error) {
      // Log l'erreur mais ne pas faire échouer l'opération principale
      this.logger.warn(
        `Failed to invalidate cache for project ${projectId}`,
        error,
      );
    }
  }

  /**
   * Invalide les caches utilisateur (listes et compteurs)
   */
  private async invalidateUserCaches(ownerId: string): Promise<void> {
    try {
      await this.cacheService.invalidateUserProjectsCache(ownerId);

      this.logger.debug(`User caches invalidated`, {
        operation: 'invalidateUserCaches',
        ownerId,
      });
    } catch (error) {
      // Log l'erreur mais ne pas faire échouer l'opération principale
      this.logger.warn(
        `Failed to invalidate user caches for ${ownerId}`,
        error,
      );
    }
  }

  // ========================================================================
  // MÉTHODES PRIVÉES - ÉVÉNEMENTS MÉTIER
  // ========================================================================

  /**
   * Publie l'événement de création de projet
   */
  private async publishProjectCreatedEvent(
    project: ProjectEntity,
  ): Promise<void> {
    try {
      const event: ProjectCreatedEventDto = {
        projectId: project.id,
        ownerId: project.ownerId,
        name: project.name,
        description: project.description,
        initialPrompt: project.initialPrompt,
        uploadedFileIds: project.uploadedFileIds,
        hasUploadedFiles: project.hasUploadedFiles(),
        promptComplexity: project.getComplexityEstimate(),
        createdAt: project.createdAt,
      };

      await this.eventsService.publishProjectCreated(event);

      this.logger.debug(`Project created event published`, {
        operation: 'publishProjectCreatedEvent',
        projectId: project.id,
        eventType: 'project.created',
      });
    } catch (error) {
      // Log l'erreur mais ne pas faire échouer l'opération principale
      this.logger.warn(
        `Failed to publish project created event for ${project.id}`,
        error,
      );
    }
  }

  /**
   * Publie l'événement de mise à jour de projet
   */
  private async publishProjectUpdatedEvent(
    project: ProjectEntity,
    changes: UpdateProjectData,
  ): Promise<void> {
    try {
      const event: ProjectUpdatedEventDto = {
        projectId: project.id,
        ownerId: project.ownerId,
        changes,
        modifiedFields: Object.keys(changes),
        updatedAt: project.updatedAt,
      };

      await this.eventsService.publishProjectUpdated(event);

      this.logger.debug(`Project updated event published`, {
        operation: 'publishProjectUpdatedEvent',
        projectId: project.id,
        eventType: 'project.updated',
      });
    } catch (error) {
      this.logger.warn(
        `Failed to publish project updated event for ${project.id}`,
        error,
      );
    }
  }

  /**
   * Publie l'événement d'archivage de projet
   */
  private async publishProjectArchivedEvent(
    project: ProjectEntity,
  ): Promise<void> {
    try {
      const event: ProjectArchivedEventDto = {
        projectId: project.id,
        ownerId: project.ownerId,
        previousStatus: project.status,
        archivedAt: new Date(),
      };

      await this.eventsService.publishProjectArchived(event);

      this.logger.debug(`Project archived event published`, {
        operation: 'publishProjectArchivedEvent',
        projectId: project.id,
        eventType: 'project.archived',
      });
    } catch (error) {
      this.logger.warn(
        `Failed to publish project archived event for ${project.id}`,
        error,
      );
    }
  }

  /**
   * Publie l'événement de suppression de projet
   */
  private async publishProjectDeletedEvent(
    project: ProjectEntity,
  ): Promise<void> {
    try {
      const event: ProjectDeletedEventDto = {
        projectId: project.id,
        ownerId: project.ownerId,
        previousStatus: project.status,
        hadGeneratedFiles: project.hasGeneratedFiles(),
        fileCount: project.getFileCount(),
        deletedAt: new Date(),
      };

      await this.eventsService.publishProjectDeleted(event);

      this.logger.debug(`Project deleted event published`, {
        operation: 'publishProjectDeletedEvent',
        projectId: project.id,
        eventType: 'project.deleted',
      });
    } catch (error) {
      this.logger.warn(
        `Failed to publish project deleted event for ${project.id}`,
        error,
      );
    }
  }

  /**
   * Publie l'événement de mise à jour des fichiers générés
   */
  private async publishProjectFilesUpdatedEvent(
    project: ProjectEntity,
    fileIds: string[],
    mode: string,
  ): Promise<void> {
    try {
      const event: ProjectFilesUpdatedEventDto = {
        projectId: project.id,
        ownerId: project.ownerId,
        newFileIds: fileIds,
        updateMode: mode,
        totalGeneratedFiles:
          mode === 'append'
            ? project.generatedFileIds.length +
              fileIds.filter((id) => !project.generatedFileIds.includes(id))
                .length
            : fileIds.length,
        updatedAt: new Date(),
      };

      await this.eventsService.publishProjectFilesUpdated(event);

      this.logger.debug(`Project files updated event published`, {
        operation: 'publishProjectFilesUpdatedEvent',
        projectId: project.id,
        eventType: 'project.files.updated',
      });
    } catch (error) {
      this.logger.warn(
        `Failed to publish project files updated event for ${project.id}`,
        error,
      );
    }
  }

  // ========================================================================
  // MÉTHODES PRIVÉES - GESTION D'ERREURS
  // ========================================================================

  /**
   * Transforme les erreurs repository en erreurs service appropriées
   */
  private handleServiceError(error: any, operation: string): Error {
    // Si c'est déjà une erreur HTTP NestJS, la retourner telle quelle
    if (
      error instanceof NotFoundException ||
      error instanceof ForbiddenException ||
      error instanceof BadRequestException ||
      error instanceof ConflictException ||
      error instanceof InternalServerErrorException
    ) {
      return error;
    }

    // Transformation des erreurs repository
    if (error instanceof ProjectNotFoundError) {
      return new NotFoundException(error.message);
    }

    if (error instanceof ProjectOwnershipError) {
      return new ForbiddenException(error.message);
    }

    if (error instanceof ProjectConstraintError) {
      return new BadRequestException(error.message);
    }

    if (error instanceof ProjectOptimisticLockError) {
      return new ConflictException(error.message);
    }

    // Erreur générique avec contexte sanitisé
    const sanitizedMessage = this.sanitizeErrorMessage(
      error.message || 'Unknown error occurred',
    );
    this.logger.error(`Unhandled error in operation ${operation}`, {
      operation,
      error: error.stack || error.message,
    });

    return new InternalServerErrorException(
      `Operation failed: ${sanitizedMessage}`,
    );
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
      /token[^:]*:[^@]*/gi,
    ];

    let sanitized = message;
    sensitivePatterns.forEach((pattern) => {
      sanitized = sanitized.replace(pattern, '***');
    });

    return sanitized;
  }

  // ========================================================================
  // MÉTHODES PUBLIQUES - UTILITAIRES ET STATISTIQUES
  // ========================================================================

  /**
   * Compte les projets d'un utilisateur avec filtres optionnels
   *
   * @param ownerId ID du propriétaire
   * @param filters Filtres optionnels
   * @returns Nombre de projets correspondants
   */
  async countProjects(
    ownerId: string,
    filters?: ProjectSearchOptions,
  ): Promise<number> {
    try {
      this.validateUUID(ownerId, 'Owner ID');

      const repositoryFilters = this.convertToRepositoryFilters(filters);
      return await this.projectRepository.countByOwner(
        ownerId,
        repositoryFilters,
      );
    } catch (error) {
      this.logger.error(`Failed to count projects for user ${ownerId}`, error);
      throw this.handleServiceError(error, 'countProjects');
    }
  }

  /**
   * Récupère les projets actifs d'un utilisateur
   *
   * @param ownerId ID du propriétaire
   * @returns Liste des projets actifs
   */
  async findActiveProjects(ownerId: string): Promise<ProjectListItemDto[]> {
    try {
      this.validateUUID(ownerId, 'Owner ID');

      const projects = await this.projectRepository.findActiveByOwner(ownerId);
      return projects.map((project) => this.transformToListItemDto(project));
    } catch (error) {
      this.logger.error(
        `Failed to find active projects for user ${ownerId}`,
        error,
      );
      throw this.handleServiceError(error, 'findActiveProjects');
    }
  }

  /**
   * Récupère les projets récents d'un utilisateur
   *
   * @param ownerId ID du propriétaire
   * @param days Nombre de jours pour définir "récent" (défaut: 7)
   * @returns Liste des projets récents
   */
  async findRecentProjects(
    ownerId: string,
    days: number = 7,
  ): Promise<ProjectListItemDto[]> {
    try {
      this.validateUUID(ownerId, 'Owner ID');

      const projects = await this.projectRepository.findRecentByOwner(
        ownerId,
        days,
      );
      return projects.map((project) => this.transformToListItemDto(project));
    } catch (error) {
      this.logger.error(
        `Failed to find recent projects for user ${ownerId}`,
        error,
      );
      throw this.handleServiceError(error, 'findRecentProjects');
    }
  }

  /**
   * Vérifie si un projet existe pour un utilisateur donné
   *
   * @param id UUID du projet
   * @param ownerId ID du propriétaire
   * @returns true si le projet existe et appartient à l'utilisateur
   */
  async existsForUser(id: string, ownerId: string): Promise<boolean> {
    try {
      this.validateUUID(id, 'Project ID');
      this.validateUUID(ownerId, 'Owner ID');

      return await this.projectRepository.existsForOwner(id, ownerId);
    } catch (error) {
      this.logger.error(
        `Failed to check project existence ${id} for user ${ownerId}`,
        error,
      );
      return false;
    }
  }
}
