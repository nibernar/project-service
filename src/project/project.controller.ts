import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Headers,
  HttpCode,
  HttpStatus,
  UseGuards,
  ParseUUIDPipe,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiHeader,
  ApiBearerAuth,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import {
  IsOptional,
  IsEnum,
  IsString,
  Length,
  IsBoolean,
  IsDateString,
  IsArray,
  IsUUID,
  ArrayMaxSize,
} from 'class-validator';
import { Transform } from 'class-transformer';

import { AuthGuard } from '../common/guards/auth.guard';
import { ProjectOwnerGuard } from '../common/guards/project-owner.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';
import { ProjectStatus } from '../common/enums/project-status.enum';
import { User } from '../common/interfaces/user.interface';
import { PaginatedResult } from '../common/interfaces/paginated-result.interface';

import { ProjectService, ProjectSearchOptions } from './project.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectResponseDto } from './dto/project-response.dto';
import { ProjectListItemDto } from './dto/project-list.dto';

/**
 * DTO pour les filtres de recherche de projets
 */
export class ProjectFiltersDto {
  @ApiPropertyOptional({
    description: 'Filtrer par statut de projet',
    enum: ProjectStatus,
    example: ProjectStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;

  @ApiPropertyOptional({
    description: 'Recherche textuelle dans le nom et la description',
    example: 'e-commerce',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  search?: string;

  @ApiPropertyOptional({
    description: 'Filtrer les projets ayant des fichiers générés',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }: { value: any }) => value === 'true' || value === true)
  hasGeneratedFiles?: boolean;

  @ApiPropertyOptional({
    description: 'Filtrer les projets ayant des statistiques disponibles',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }: { value: any }) => value === 'true' || value === true)
  hasStatistics?: boolean;

  @ApiPropertyOptional({
    description: 'Filtrer les projets créés après cette date',
    example: '2024-01-01T00:00:00Z',
    format: 'date-time',
  })
  @IsOptional()
  @IsDateString()
  createdAfter?: string;

  @ApiPropertyOptional({
    description: 'Filtrer les projets créés avant cette date',
    example: '2024-12-31T23:59:59Z',
    format: 'date-time',
  })
  @IsOptional()
  @IsDateString()
  createdBefore?: string;

  @ApiPropertyOptional({
    description: 'Champ de tri',
    enum: ['createdAt', 'updatedAt', 'name'],
    example: 'updatedAt',
  })
  @IsOptional()
  @IsEnum(['createdAt', 'updatedAt', 'name'])
  orderBy?: 'createdAt' | 'updatedAt' | 'name';

  @ApiPropertyOptional({
    description: 'Direction du tri',
    enum: ['asc', 'desc'],
    example: 'desc',
  })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  order?: 'asc' | 'desc';
}

/**
 * DTO pour la mise à jour des fichiers générés (API interne)
 */
export class UpdateGeneratedFilesDto {
  @ApiPropertyOptional({
    description: 'Liste des identifiants UUID des fichiers générés',
    example: ['file1-uuid', 'file2-uuid'],
    type: [String],
    maxItems: 50,
  })
  @IsArray()
  @IsUUID(4, { each: true })
  @ArrayMaxSize(50)
  fileIds: string[];

  @ApiPropertyOptional({
    description: 'Mode de mise à jour des fichiers',
    enum: ['append', 'replace'],
    example: 'append',
  })
  @IsEnum(['append', 'replace'])
  mode: 'append' | 'replace';
}

/**
 * Contrôleur REST pour la gestion des projets utilisateurs
 *
 * Expose une API complète pour toutes les opérations sur les projets,
 * en orchestrant les appels au ProjectService tout en gérant
 * l'authentification, la validation, et la transformation des réponses.
 */
@Controller('projects')
@ApiTags('Projects')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class ProjectController {
  private readonly logger = new Logger(ProjectController.name);

  constructor(private readonly projectService: ProjectService) {}

  /**
   * Crée un nouveau projet
   *
   * Déclenche automatiquement le processus de génération documentaire
   * via l'orchestrateur. Le projet est créé avec le statut ACTIVE.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new project',
    description:
      'Creates a new project and triggers the document generation workflow',
  })
  @ApiResponse({
    status: 201,
    type: ProjectResponseDto,
    description: 'Project created successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input data',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 409,
    description: 'Project name already exists',
  })
  async create(
    @Body() createDto: CreateProjectDto,
    @CurrentUser() user: User,
  ): Promise<ProjectResponseDto> {
    this.logger.log(
      `Creating project "${createDto.name}" for user ${user.email}`,
      {
        operation: 'create',
        userId: user.id,
        projectName: createDto.name,
        hasUploadedFiles: createDto.hasUploadedFiles(),
        promptComplexity: createDto.getPromptComplexity(),
      },
    );

    try {
      const project = await this.projectService.create(createDto, user.id);

      this.logger.log(`Project created successfully: ${project.id}`, {
        operation: 'create',
        projectId: project.id,
        userId: user.id,
      });

      return project;
    } catch (error) {
      this.logger.error(`Failed to create project for user ${user.id}`, error);
      throw error;
    }
  }

  /**
   * Liste les projets de l'utilisateur avec pagination et filtres
   *
   * Retourne une liste paginée des projets avec possibilité de filtrage
   * par statut, recherche textuelle, présence de fichiers, etc.
   */
  @Get()
  @ApiOperation({
    summary: 'Get user projects with pagination and filters',
    description:
      'Retrieves a paginated list of user projects with optional filtering',
  })
  @ApiResponse({
    status: 200,
    description: 'Projects retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: { $ref: '#/components/schemas/ProjectListItemDto' },
        },
        pagination: {
          type: 'object',
          properties: {
            page: { type: 'number' },
            limit: { type: 'number' },
            totalPages: { type: 'number' },
            hasNext: { type: 'boolean' },
            hasPrevious: { type: 'boolean' },
            offset: { type: 'number' },
          },
        },
        total: { type: 'number' },
      },
    },
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (1-based)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (max 100)',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ProjectStatus,
    description: 'Filter by status',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Search in name and description',
  })
  @ApiQuery({
    name: 'hasGeneratedFiles',
    required: false,
    type: Boolean,
    description: 'Filter projects with generated files',
  })
  @ApiQuery({
    name: 'hasStatistics',
    required: false,
    type: Boolean,
    description: 'Filter projects with statistics',
  })
  @ApiQuery({
    name: 'createdAfter',
    required: false,
    type: String,
    description: 'Filter projects created after date',
  })
  @ApiQuery({
    name: 'createdBefore',
    required: false,
    type: String,
    description: 'Filter projects created before date',
  })
  @ApiQuery({
    name: 'orderBy',
    required: false,
    enum: ['createdAt', 'updatedAt', 'name'],
    description: 'Sort field',
  })
  @ApiQuery({
    name: 'order',
    required: false,
    enum: ['asc', 'desc'],
    description: 'Sort direction',
  })
  async findAll(
    @CurrentUser() user: User,
    @Query() pagination: PaginationDto,
    @Query() filters: ProjectFiltersDto,
  ): Promise<PaginatedResult<ProjectListItemDto>> {
    this.logger.debug(`Finding projects for user ${user.email}`, {
      operation: 'findAll',
      userId: user.id,
      page: pagination.page,
      limit: pagination.limit,
      hasFilters: Object.keys(filters).length > 0,
    });

    try {
      // Conversion des filtres avec gestion des dates
      const searchOptions: ProjectSearchOptions = {
        ...filters,
        createdAfter: filters.createdAfter
          ? new Date(filters.createdAfter)
          : undefined,
        createdBefore: filters.createdBefore
          ? new Date(filters.createdBefore)
          : undefined,
      };

      const result = await this.projectService.findAll(
        user.id,
        pagination,
        searchOptions,
      );

      this.logger.debug(`Projects retrieved successfully`, {
        operation: 'findAll',
        userId: user.id,
        count: result.data.length,
        total: result.total,
      });

      return result;
    } catch (error) {
      this.logger.error(`Failed to find projects for user ${user.id}`, error);
      throw error;
    }
  }

  /**
   * Récupère un projet spécifique par son ID
   *
   * Retourne les informations complètes du projet incluant
   * les statistiques si disponibles.
   */
  @Get(':id')
  @UseGuards(ProjectOwnerGuard)
  @ApiOperation({
    summary: 'Get project by ID with detailed information',
    description:
      'Retrieves detailed project information including statistics if available',
  })
  @ApiResponse({
    status: 200,
    type: ProjectResponseDto,
    description: 'Project found',
  })
  @ApiResponse({
    status: 404,
    description: 'Project not found',
  })
  @ApiResponse({
    status: 403,
    description: 'Access denied',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'Project UUID',
  })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ): Promise<ProjectResponseDto> {
    this.logger.debug(`Finding project ${id} for user ${user.email}`, {
      operation: 'findOne',
      projectId: id,
      userId: user.id,
    });

    try {
      const project = await this.projectService.findOne(id, user.id);

      this.logger.debug(`Project retrieved successfully`, {
        operation: 'findOne',
        projectId: id,
        userId: user.id,
        hasStatistics: project.hasStatistics(),
      });

      return project;
    } catch (error) {
      this.logger.error(
        `Failed to find project ${id} for user ${user.id}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Met à jour les métadonnées d'un projet
   *
   * Permet de modifier le nom et/ou la description du projet.
   * Le prompt initial est immutable pour préserver l'audit.
   */
  @Patch(':id')
  @UseGuards(ProjectOwnerGuard)
  @ApiOperation({
    summary: 'Update project metadata',
    description:
      'Updates project name and/or description. Initial prompt is immutable.',
  })
  @ApiResponse({
    status: 200,
    type: ProjectResponseDto,
    description: 'Project updated successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid update data',
  })
  @ApiResponse({
    status: 404,
    description: 'Project not found',
  })
  @ApiResponse({
    status: 403,
    description: 'Access denied',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict (name exists or invalid state)',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'Project UUID',
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateProjectDto,
    @CurrentUser() user: User,
  ): Promise<ProjectResponseDto> {
    this.logger.log(`Updating project ${id} for user ${user.email}`, {
      operation: 'update',
      projectId: id,
      userId: user.id,
      updateFields: Object.keys(updateDto.getDefinedFields()),
      fieldCount: updateDto.getUpdateFieldsCount(),
    });

    try {
      // Validation que le DTO contient des modifications
      if (!updateDto.hasValidUpdates()) {
        throw new BadRequestException('No valid updates provided');
      }

      const project = await this.projectService.update(id, updateDto, user.id);

      this.logger.log(`Project updated successfully`, {
        operation: 'update',
        projectId: id,
        userId: user.id,
        modifiedFields: Object.keys(updateDto.getDefinedFields()),
      });

      return project;
    } catch (error) {
      this.logger.error(
        `Failed to update project ${id} for user ${user.id}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Archive un projet
   *
   * Change le statut du projet vers ARCHIVED. Le projet reste
   * accessible mais est masqué par défaut dans les listes.
   * Opération idempotente.
   */
  @Put(':id/archive')
  @UseGuards(ProjectOwnerGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Archive a project',
    description:
      'Changes project status to ARCHIVED. Project remains accessible but hidden by default.',
  })
  @ApiResponse({
    status: 204,
    description: 'Project archived successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Project not found',
  })
  @ApiResponse({
    status: 403,
    description: 'Access denied',
  })
  @ApiResponse({
    status: 409,
    description: 'Cannot archive project in current state',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'Project UUID',
  })
  async archive(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ): Promise<void> {
    this.logger.log(`Archiving project ${id} for user ${user.email}`, {
      operation: 'archive',
      projectId: id,
      userId: user.id,
    });

    try {
      await this.projectService.archive(id, user.id);

      this.logger.log(`Project archived successfully`, {
        operation: 'archive',
        projectId: id,
        userId: user.id,
      });
    } catch (error) {
      this.logger.error(
        `Failed to archive project ${id} for user ${user.id}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Supprime logiquement un projet
   *
   * Change le statut du projet vers DELETED (soft delete).
   * Le projet devient inaccessible aux utilisateurs mais reste
   * en base pour l'audit. Opération idempotente mais irréversible.
   */
  @Delete(':id')
  @UseGuards(ProjectOwnerGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Soft delete a project',
    description:
      'Changes project status to DELETED. Project becomes inaccessible but remains in database for audit.',
  })
  @ApiResponse({
    status: 204,
    description: 'Project deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Project not found',
  })
  @ApiResponse({
    status: 403,
    description: 'Access denied',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'Project UUID',
  })
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ): Promise<void> {
    this.logger.log(`Deleting project ${id} for user ${user.email}`, {
      operation: 'delete',
      projectId: id,
      userId: user.id,
    });

    try {
      await this.projectService.delete(id, user.id);

      this.logger.log(`Project deleted successfully`, {
        operation: 'delete',
        projectId: id,
        userId: user.id,
      });
    } catch (error) {
      this.logger.error(
        `Failed to delete project ${id} for user ${user.id}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Met à jour les fichiers générés (API interne pour l'orchestrateur)
   *
   * Point d'entrée utilisé par l'orchestrateur pour signaler
   * la génération de nouveaux documents. Authentification
   * par token de service au lieu de JWT utilisateur.
   */
  @Put(':id/files')
  @ApiOperation({
    summary: 'Update generated files (internal API for orchestrator)',
    description:
      'Used by the orchestrator to update the list of generated files for a project',
  })
  @ApiResponse({
    status: 204,
    description: 'Files updated successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid file IDs',
  })
  @ApiResponse({
    status: 404,
    description: 'Project not found',
  })
  @ApiHeader({
    name: 'X-Service-Token',
    required: true,
    description: 'Service authentication token',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'Project UUID',
  })
  async updateGeneratedFiles(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateGeneratedFilesDto,
    @Headers('x-service-token') serviceToken: string,
  ): Promise<void> {
    this.logger.log(`Updating generated files for project ${id}`, {
      operation: 'updateGeneratedFiles',
      projectId: id,
      fileCount: updateDto.fileIds.length,
      mode: updateDto.mode,
      hasServiceToken: !!serviceToken,
    });

    try {
      // Validation du token de service
      // Note: Dans un vrai environnement, il faudrait valider le token
      // contre un service d'authentification ou une liste de tokens autorisés
      if (!serviceToken) {
        throw new BadRequestException('Service token is required');
      }

      // Pour cette implémentation, on accepte tout token non vide
      // En production, il faudrait une validation réelle
      if (
        typeof serviceToken !== 'string' ||
        serviceToken.trim().length === 0
      ) {
        throw new BadRequestException('Invalid service token');
      }

      await this.projectService.updateGeneratedFiles(
        id,
        updateDto.fileIds,
        updateDto.mode,
      );

      this.logger.log(`Generated files updated successfully`, {
        operation: 'updateGeneratedFiles',
        projectId: id,
        newFileCount: updateDto.fileIds.length,
        mode: updateDto.mode,
      });
    } catch (error) {
      this.logger.error(
        `Failed to update generated files for project ${id}`,
        error,
      );
      throw error;
    }
  }
}
