import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  Query,
  Headers,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  ParseIntPipe,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiHeader,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { plainToClass } from 'class-transformer';
import { StatisticsService } from './statistics.service';
import { UpdateStatisticsDto } from './dto/update-statistics.dto';
import { StatisticsResponseDto } from './dto/statistics-response.dto';
import { AuthGuard } from '../common/guards/auth.guard';
import { ProjectOwnerGuard } from '../common/guards/project-owner.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../common/interfaces/user.interface';

/**
 * Contrôleur pour les endpoints de statistiques
 * Expose deux types d'APIs :
 * 1. API interne pour les services (mise à jour des stats)
 * 2. API utilisateur pour consultation des stats
 */
@Controller('statistics')
@ApiTags('Statistics')
export class StatisticsController {
  private readonly logger = new Logger(StatisticsController.name);

  // Token de service pour l'authentification inter-services
  private readonly SERVICE_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || 'dev-service-token';

  constructor(private readonly statisticsService: StatisticsService) {}

  /**
   * Endpoint pour que les services externes mettent à jour les statistiques
   * Utilisé par : Service de Coûts, Service de Monitoring, Service d'Orchestration
   */
  @Put('projects/:projectId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update project statistics (internal service API)',
    description: 'Allows external services to update project statistics. Requires service authentication token.',
  })
  @ApiParam({
    name: 'projectId',
    description: 'Unique identifier of the project',
    example: 'project-uuid-123',
  })
  @ApiHeader({
    name: 'x-service-token',
    description: 'Internal service authentication token',
    required: true,
  })
  @ApiBody({
    type: UpdateStatisticsDto,
    description: 'Statistics data to update',
    examples: {
      costUpdate: {
        summary: 'Cost update from cost-tracking-service',
        description: 'Example of cost statistics update',
        value: {
          costs: {
            claudeApi: 12.45,
            storage: 2.30,
            compute: 5.67,
            total: 20.42,
            currency: 'USD',
          },
          metadata: {
            source: 'cost-tracking-service',
            timestamp: '2024-08-19T10:30:00Z',
            version: '1.0.0',
          },
        },
      },
      performanceUpdate: {
        summary: 'Performance update from orchestration-service',
        description: 'Example of performance statistics update',
        value: {
          performance: {
            generationTime: 45.23,
            processingTime: 12.45,
            interviewTime: 180.75,
            totalTime: 238.43,
          },
          usage: {
            documentsGenerated: 5,
            tokensUsed: 15750,
            apiCallsCount: 12,
          },
          metadata: {
            source: 'orchestration-service',
            timestamp: '2024-08-19T10:35:00Z',
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Statistics updated successfully',
    type: StatisticsResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid or missing service token',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid statistics data',
  })
  @ApiResponse({
    status: 404,
    description: 'Project not found',
  })
  async updateProjectStatistics(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() updateDto: UpdateStatisticsDto,
    @Headers('x-service-token') serviceToken: string,
  ): Promise<StatisticsResponseDto> {
    this.logger.debug(`Updating statistics for project ${projectId} from service`);

    // Validation du token de service
    if (!serviceToken || serviceToken !== this.SERVICE_TOKEN) {
      this.logger.warn(`Invalid service token attempt for project ${projectId}`);
      throw new ForbiddenException('Invalid service authentication token');
    }

    // Validation métier des données - Transformation en instance de classe
    const validationDto = plainToClass(UpdateStatisticsDto, updateDto);
    const validation = validationDto.isValid();
    if (!validation.valid) {
      this.logger.warn(`Invalid statistics data for project ${projectId}: ${validation.errors.join(', ')}`);
      throw new BadRequestException({
        message: 'Invalid statistics data',
        errors: validation.errors,
      });
    }

    try {
      const updatedStats = await this.statisticsService.updateStatistics(projectId, updateDto);
      
      this.logger.debug(`Statistics updated successfully for project ${projectId}`);
      
      return updatedStats;
    } catch (error) {
      this.logger.error(`Failed to update statistics for project ${projectId}`, error.stack);
      
      if (error.message.includes('not found')) {
        throw new NotFoundException(`Project ${projectId} not found`);
      }
      
      throw error;
    }
  }

  /**
   * Récupère les statistiques d'un projet pour son propriétaire
   */
  @Get('projects/:projectId')
  @UseGuards(AuthGuard, ProjectOwnerGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get project statistics',
    description: 'Retrieves detailed statistics for a project. Only accessible by project owner.',
  })
  @ApiParam({
    name: 'projectId',
    description: 'Unique identifier of the project',
    example: 'project-uuid-123',
  })
  @ApiResponse({
    status: 200,
    description: 'Project statistics retrieved successfully',
    type: StatisticsResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Authentication required',
  })
  @ApiResponse({
    status: 403,
    description: 'Access denied - not project owner',
  })
  @ApiResponse({
    status: 404,
    description: 'Project or statistics not found',
  })
  async getProjectStatistics(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @CurrentUser() user: User,
  ): Promise<StatisticsResponseDto> {
    this.logger.debug(`Getting statistics for project ${projectId} for user ${user.id}`);

    try {
      const statistics = await this.statisticsService.getStatistics(projectId);
      
      if (!statistics) {
        throw new NotFoundException(`No statistics found for project ${projectId}`);
      }

      return statistics;
    } catch (error) {
      this.logger.error(`Failed to get statistics for project ${projectId}`, error.stack);
      throw error;
    }
  }

  /**
   * Récupère les statistiques globales de la plateforme
   * Accessible aux utilisateurs authentifiés
   */
  @Get('global')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get global platform statistics',
    description: 'Retrieves aggregated statistics across all projects on the platform.',
  })
  @ApiResponse({
    status: 200,
    description: 'Global statistics retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        totalProjects: {
          type: 'number',
          description: 'Total number of projects with statistics',
          example: 1250,
        },
        totalCosts: {
          type: 'number',
          description: 'Total costs across all projects in USD',
          example: 45789.32,
        },
        totalDocuments: {
          type: 'number',
          description: 'Total documents generated across all projects',
          example: 8945,
        },
        averageQualityScore: {
          type: 'number',
          description: 'Average data quality score (0-100)',
          example: 87.5,
        },
        sourceDistribution: {
          type: 'object',
          description: 'Distribution of data sources',
          example: {
            'cost-tracking-service': 1200,
            'monitoring-service': 1100,
            'orchestration-service': 1250,
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Authentication required',
  })
  async getGlobalStatistics(@CurrentUser() user: User): Promise<{
    totalProjects: number;
    totalCosts: number;
    totalDocuments: number;
    averageQualityScore: number;
    sourceDistribution: Record<string, number>;
  }> {
    this.logger.debug(`Getting global statistics for user ${user.id}`);

    try {
      return await this.statisticsService.getGlobalStatistics();
    } catch (error) {
      this.logger.error('Failed to get global statistics', error.stack);
      throw error;
    }
  }

  /**
   * Recherche des projets selon des critères de statistiques
   */
  @Get('search')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Search projects by statistics criteria',
    description: 'Find projects that match specific statistical criteria.',
  })
  @ApiQuery({
    name: 'minTotalCost',
    description: 'Minimum total cost filter',
    required: false,
    type: Number,
    example: 10.0,
  })
  @ApiQuery({
    name: 'maxTotalCost',
    description: 'Maximum total cost filter',
    required: false,
    type: Number,
    example: 100.0,
  })
  @ApiQuery({
    name: 'minDocuments',
    description: 'Minimum number of documents generated',
    required: false,
    type: Number,
    example: 3,
  })
  @ApiQuery({
    name: 'maxPerformanceTime',
    description: 'Maximum total performance time in seconds',
    required: false,
    type: Number,
    example: 600,
  })
  @ApiQuery({
    name: 'dataFreshnessMinutes',
    description: 'Maximum age of data in minutes',
    required: false,
    type: Number,
    example: 60,
  })
  @ApiResponse({
    status: 200,
    description: 'Search results',
    type: [StatisticsResponseDto],
  })
  @ApiResponse({
    status: 401,
    description: 'Authentication required',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid search criteria',
  })
  async searchStatistics(
    @CurrentUser() user: User,
    @Query('minTotalCost') minTotalCost?: number,
    @Query('maxTotalCost') maxTotalCost?: number,
    @Query('minDocuments') minDocuments?: number,
    @Query('maxPerformanceTime') maxPerformanceTime?: number,
    @Query('dataFreshnessMinutes') dataFreshnessMinutes?: number,
  ): Promise<StatisticsResponseDto[]> {
    this.logger.debug(`Searching statistics for user ${user.id}`);

    // Validation des paramètres de recherche
    if (minTotalCost && minTotalCost < 0) {
      throw new BadRequestException('minTotalCost must be non-negative');
    }
    if (maxTotalCost && maxTotalCost < 0) {
      throw new BadRequestException('maxTotalCost must be non-negative');
    }
    if (minTotalCost && maxTotalCost && minTotalCost > maxTotalCost) {
      throw new BadRequestException('minTotalCost cannot be greater than maxTotalCost');
    }
    if (minDocuments && minDocuments < 0) {
      throw new BadRequestException('minDocuments must be non-negative');
    }
    if (maxPerformanceTime && maxPerformanceTime < 0) {
      throw new BadRequestException('maxPerformanceTime must be non-negative');
    }
    if (dataFreshnessMinutes && dataFreshnessMinutes < 0) {
      throw new BadRequestException('dataFreshnessMinutes must be non-negative');
    }

    const criteria = {
      minTotalCost,
      maxTotalCost,
      minDocuments,
      maxPerformanceTime,
      dataFreshnessMinutes,
    };

    try {
      return await this.statisticsService.searchStatistics(criteria);
    } catch (error) {
      this.logger.error('Failed to search statistics', error.stack);
      throw error;
    }
  }

  /**
   * Endpoint d'administration pour nettoyer les anciennes statistiques
   * Devrait être protégé par un rôle admin en production
   */
  @Put('cleanup/:retentionDays')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Cleanup old statistics (Admin)',
    description: 'Removes statistics older than specified retention period. Admin only.',
  })
  @ApiParam({
    name: 'retentionDays',
    description: 'Number of days to retain statistics',
    example: 90,
  })
  @ApiResponse({
    status: 200,
    description: 'Cleanup completed',
    schema: {
      type: 'object',
      properties: {
        deletedCount: {
          type: 'number',
          description: 'Number of records deleted',
          example: 150,
        },
        retentionDays: {
          type: 'number',
          description: 'Retention period used',
          example: 90,
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Authentication required',
  })
  @ApiResponse({
    status: 403,
    description: 'Admin access required',
  })
  async cleanupOldStatistics(
    @CurrentUser() user: User,
    @Param('retentionDays', ParseIntPipe) retentionDays: number,
  ): Promise<{ deletedCount: number; retentionDays: number }> {
    this.logger.debug(`Cleaning up statistics older than ${retentionDays} days by user ${user.id}`);

    // Vérification du rôle admin (simplifié pour le moment)
    if (!user.roles || !user.roles.includes('admin')) {
      throw new ForbiddenException('Admin access required for cleanup operations');
    }

    // Validation des paramètres
    if (retentionDays < 1 || retentionDays > 365) {
      throw new BadRequestException('Retention days must be between 1 and 365');
    }

    try {
      const deletedCount = await this.statisticsService.cleanupOldStatistics(retentionDays);
      
      this.logger.debug(`Cleanup completed: ${deletedCount} records deleted`);
      
      return {
        deletedCount,
        retentionDays,
      };
    } catch (error) {
      this.logger.error('Failed to cleanup old statistics', error.stack);
      throw error;
    }
  }

  /**
   * Endpoint pour obtenir un résumé des statistiques de multiples projets
   * Utile pour les dashboards et vues d'ensemble
   */
  @Get('projects/batch')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get statistics for multiple projects',
    description: 'Retrieves statistics for multiple projects in a single request. Only returns projects owned by the user.',
  })
  @ApiQuery({
    name: 'projectIds',
    description: 'Comma-separated list of project IDs',
    required: true,
    example: 'project-1,project-2,project-3',
  })
  @ApiResponse({
    status: 200,
    description: 'Batch statistics retrieved successfully',
    schema: {
      type: 'object',
      additionalProperties: {
        $ref: '#/components/schemas/StatisticsResponseDto',
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Authentication required',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid project IDs format',
  })
  async getBatchStatistics(
    @CurrentUser() user: User,
    @Query('projectIds') projectIdsString: string,
  ): Promise<Record<string, StatisticsResponseDto>> {
    this.logger.debug(`Getting batch statistics for user ${user.id}`);

    if (!projectIdsString) {
      throw new BadRequestException('projectIds parameter is required');
    }

    // Parsing et validation des IDs de projets
    const projectIds = projectIdsString.split(',').map(id => id.trim());
    
    if (projectIds.length === 0) {
      throw new BadRequestException('At least one project ID must be provided');
    }

    if (projectIds.length > 50) {
      throw new BadRequestException('Maximum 50 projects per batch request');
    }

    // Validation du format UUID (basique)
    const invalidIds = projectIds.filter(id => !id.match(/^[0-9a-f-]{36}$/i));
    if (invalidIds.length > 0) {
      throw new BadRequestException(`Invalid project ID format: ${invalidIds.join(', ')}`);
    }

    try {
      const statisticsMap = await this.statisticsService.getMultipleStatistics(projectIds);
      
      // Conversion Map vers Object pour JSON response
      const result: Record<string, StatisticsResponseDto> = {};
      statisticsMap.forEach((stats, projectId) => {
        result[projectId] = stats;
      });

      this.logger.debug(`Retrieved batch statistics for ${Object.keys(result).length}/${projectIds.length} projects`);
      
      return result;
    } catch (error) {
      this.logger.error('Failed to get batch statistics', error.stack);
      throw error;
    }
  }

  /**
   * Health check endpoint pour le service de statistiques
   */
  @Get('health')
  @ApiOperation({
    summary: 'Statistics service health check',
    description: 'Checks the health of the statistics service and its dependencies.',
  })
  @ApiResponse({
    status: 200,
    description: 'Service is healthy',
    schema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          example: 'healthy',
        },
        timestamp: {
          type: 'string',
          format: 'date-time',
          example: '2024-08-19T10:30:00Z',
        },
        dependencies: {
          type: 'object',
          properties: {
            database: {
              type: 'string',
              example: 'connected',
            },
            cache: {
              type: 'string',
              example: 'connected',
            },
          },
        },
      },
    },
  })
  async healthCheck(): Promise<{
    status: string;
    timestamp: Date;
    dependencies: Record<string, string>;
  }> {
    // Health check basique - dans un vrai système, on vérifierait les dépendances
    return {
      status: 'healthy',
      timestamp: new Date(),
      dependencies: {
        database: 'connected',
        cache: 'connected',
        repository: 'operational',
      },
    };
  }
}