import { 
  Controller, 
  Post, 
  Get, 
  Body, 
  Param, 
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  ParseUUIDPipe,
  Logger,
  HttpException,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiBody,
  ApiConsumes,
  ApiProduces,
} from '@nestjs/swagger';
import { ExportService } from './export.service';
import { ExportOptionsDto } from './dto/export-options.dto';
import { ExportResponseDto, ExportStatusDto } from './dto/export-response.dto';
import { AuthGuard } from '../common/guards/auth.guard';
import { ProjectOwnerGuard } from '../common/guards/project-owner.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../common/interfaces/user.interface';

/**
 * Contrôleur d'export de documents de projets
 * 
 * Responsabilités principales :
 * - Exposition des endpoints REST pour l'export de documents
 * - Validation des permissions et de l'authentification utilisateur
 * - Orchestration des appels au service d'export principal
 * - Suivi des exports asynchrones avec statuts temps réel
 * - Documentation API complète avec Swagger/OpenAPI
 * - Gestion robuste des erreurs avec codes HTTP appropriés
 * 
 * SÉCURITÉ :
 * - Authentification obligatoire via JWT Bearer token
 * - Validation de propriété du projet via ProjectOwnerGuard
 * - Isolation complète des exports par utilisateur
 * - Validation stricte de tous les paramètres d'entrée
 * - Rate limiting implicite via la limitation de concurrence du service
 * 
 * PERFORMANCE :
 * - Cache automatique des exports récents
 * - Support des exports asynchrones pour éviter les timeouts
 * - Compression automatique des réponses volumineuses
 * - Endpoints optimisés pour les différents cas d'usage
 * 
 * FORMATS SUPPORTÉS :
 * - Markdown natif (.md ou .zip si multiples fichiers)
 * - PDF professionnel via Pandoc avec options avancées
 * - Support futur : HTML, DOCX, etc.
 * 
 * MONITORING :
 * - Logging détaillé de toutes les opérations
 * - Métriques de performance et d'usage
 * - Alerting sur les échecs d'export
 * - Audit trail complet des téléchargements
 * 
 * @example
 * ```bash
 * # Export PDF d'un projet complet
 * curl -X POST "https://api.coders.com/export/projects/uuid-123" \
 *   -H "Authorization: Bearer your-jwt-token" \
 *   -H "Content-Type: application/json" \
 *   -d '{
 *     "format": "pdf",
 *     "includeMetadata": true,
 *     "pdfOptions": {
 *       "pageSize": "A4",
 *       "margins": 25,
 *       "includeTableOfContents": true
 *     }
 *   }'
 * 
 * # Suivi d'un export en cours
 * curl -X GET "https://api.coders.com/export/status/export-uuid-456" \
 *   -H "Authorization: Bearer your-jwt-token"
 * ```
 */
@Controller('export')
@ApiTags('Export')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class ExportController {
  private readonly logger = new Logger(ExportController.name);

  constructor(private readonly exportService: ExportService) {}

  /**
   * Démarre l'export d'un projet selon les options spécifiées
   * 
   * Endpoint principal pour initier un export de projet. Supporte tous
   * les formats disponibles avec options avancées de personnalisation.
   * 
   * PROCESSUS :
   * 1. Validation de l'authentification et des permissions
   * 2. Validation des options d'export
   * 3. Démarrage de l'export (synchrone ou asynchrone selon la taille)
   * 4. Retour immédiat avec URL de téléchargement ou statut de progression
   * 
   * PERFORMANCE :
   * - Cache intelligent : retour immédiat si export identique récent
   * - Traitement asynchrone pour exports volumineux (>20 fichiers ou PDF)
   * - Queue avec priorité pour optimiser les temps d'attente
   * 
   * @param projectId - UUID du projet à exporter
   * @param exportOptions - Options d'export avec format et personnalisation
   * @param user - Utilisateur authentifié (injecté automatiquement)
   * @returns Promise avec informations de téléchargement ou statut
   * 
   * @throws BadRequestException si les options sont invalides
   * @throws ForbiddenException si l'utilisateur n'a pas accès au projet
   * @throws NotFoundException si le projet n'existe pas
   * 
   * @example
   * ```typescript
   * // Export Markdown simple
   * const simpleOptions = {
   *   format: 'markdown',
   *   includeMetadata: true
   * };
   * 
   * // Export PDF personnalisé
   * const pdfOptions = {
   *   format: 'pdf',
   *   fileIds: ['uuid1', 'uuid2'], // Sélection spécifique
   *   includeMetadata: true,
   *   pdfOptions: {
   *     pageSize: 'A4',
   *     margins: 30,
   *     includeTableOfContents: true
   *   }
   * };
   * ```
   */
  @Post('projects/:projectId')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ProjectOwnerGuard)
  @ApiOperation({ 
    summary: 'Exporter un projet',
    description: `
      Démarre l'export d'un projet selon le format et les options spécifiées.
      
      **Formats supportés :**
      - \`markdown\` : Export natif Markdown (fichier .md ou archive .zip)
      - \`pdf\` : Conversion PDF via Pandoc avec options avancées
      
      **Traitement :**
      - Synchrone pour exports simples (< 5 fichiers Markdown)
      - Asynchrone pour exports complexes (PDF ou nombreux fichiers)
      
      **Cache :**
      - Les exports identiques récents (1h) sont retournés depuis le cache
      - Gain de performance significatif pour les consultations répétées
    `
  })
  @ApiParam({
    name: 'projectId',
    description: 'UUID du projet à exporter',
    example: '550e8400-e29b-41d4-a716-446655440000',
    type: 'string',
    format: 'uuid',
  })
  @ApiBody({
    type: ExportOptionsDto,
    description: 'Options d\'export avec format et personnalisation',
    examples: {
      markdown: {
        summary: 'Export Markdown simple',
        value: {
          format: 'markdown',
          includeMetadata: true
        }
      },
      pdf: {
        summary: 'Export PDF personnalisé',
        value: {
          format: 'pdf',
          includeMetadata: true,
          pdfOptions: {
            pageSize: 'A4',
            margins: 25,
            includeTableOfContents: true
          }
        }
      },
      selective: {
        summary: 'Export sélectif de fichiers',
        value: {
          format: 'pdf',
          fileIds: [
            '550e8400-e29b-41d4-a716-446655440001',
            '550e8400-e29b-41d4-a716-446655440002'
          ],
          includeMetadata: false
        }
      }
    }
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Export réussi - Informations de téléchargement',
    type: ExportResponseDto,
    example: {
      downloadUrl: 'https://storage.coders.com/exports/temp/abc123-export.pdf?expires=1640995200&signature=xyz',
      fileName: 'Mon Projet - Export PDF - 2024-08-18.pdf',
      fileSize: 1048576,
      format: 'pdf',
      expiresAt: '2024-08-18T15:30:00.000Z',
      md5Hash: 'a1b2c3d4e5f6789012345678901234567890abcd'
    }
  })
  @ApiResponse({
    status: HttpStatus.ACCEPTED,
    description: 'Export démarré en mode asynchrone - Utiliser le statut pour suivre',
    schema: {
      type: 'object',
      properties: {
        exportId: {
          type: 'string',
          format: 'uuid',
          description: 'UUID de l\'export pour suivi du statut'
        },
        status: {
          type: 'string',
          enum: ['pending', 'processing'],
          description: 'Statut initial de l\'export'
        },
        estimatedDurationMs: {
          type: 'number',
          description: 'Durée estimée en millisecondes'
        },
        message: {
          type: 'string',
          description: 'Message informatif sur le traitement'
        }
      }
    }
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Options d\'export invalides',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: { 
          type: 'string', 
          example: 'Invalid export options: format must be markdown or pdf' 
        },
        error: { type: 'string', example: 'Bad Request' }
      }
    }
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Accès refusé au projet',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 403 },
        message: { type: 'string', example: 'You do not have permission to export this project' },
        error: { type: 'string', example: 'Forbidden' }
      }
    }
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Projet non trouvé',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 404 },
        message: { type: 'string', example: 'Project not found' },
        error: { type: 'string', example: 'Not Found' }
      }
    }
  })
  @ApiResponse({
    status: HttpStatus.PAYLOAD_TOO_LARGE,
    description: 'Projet trop volumineux pour l\'export',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 413 },
        message: { type: 'string', example: 'Project too large for export (max 100MB)' },
        error: { type: 'string', example: 'Payload Too Large' }
      }
    }
  })
  @ApiResponse({
    status: HttpStatus.TOO_MANY_REQUESTS,
    description: 'Trop d\'exports simultanés',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 429 },
        message: { type: 'string', example: 'Too many concurrent exports. Please try again later.' },
        error: { type: 'string', example: 'Too Many Requests' }
      }
    }
  })
  @ApiConsumes('application/json')
  @ApiProduces('application/json')
  async exportProject(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() exportOptions: ExportOptionsDto,
    @CurrentUser() user: User,
  ): Promise<ExportResponseDto> {
    this.logger.log(
      `Export request for project ${projectId} by user ${user.id}: format=${exportOptions.format}, complexity=${exportOptions.getExportComplexity()}`
    );

    try {
      // Validation préliminaire des options
      const validation = exportOptions.validateOptions();
      if (!validation.valid) {
        this.logger.warn(
          `Invalid export options for project ${projectId}: ${validation.errors.join(', ')}`
        );
        throw new BadRequestException({
          message: `Invalid export options: ${validation.errors.join(', ')}`,
          errors: validation.errors,
          code: 'INVALID_EXPORT_OPTIONS'
        });
      }

      // Log des détails pour monitoring
      this.logger.debug(
        `Export details: ${exportOptions.toLogSafeString()}, heavy=${exportOptions.isHeavyExport()}`
      );

      // Délégation au service principal
      const result = await this.exportService.exportProject(
        projectId, 
        exportOptions, 
        user.id
      );

      // Logging du succès pour analytics
      this.logger.log(
        `Export completed successfully for project ${projectId}: ${result.fileName} (${result.fileSize} bytes)`
      );

      return result;

    } catch (error) {
      // Gestion centralisée des erreurs avec logging
      this.handleExportError(error, projectId, user.id, exportOptions);
      throw error; // Re-throw après logging
    }
  }

  /**
   * Récupère le statut d'un export en cours ou terminé
   * 
   * Endpoint de suivi pour les exports asynchrones. Fournit des informations
   * de progression en temps réel avec estimation du temps restant.
   * 
   * UTILISATION :
   * - Polling régulier (toutes les 2-5 secondes) pour les exports longs
   * - Vérification ponctuelle du statut d'un export
   * - Récupération de l'URL de téléchargement une fois terminé
   * 
   * STATUTS POSSIBLES :
   * - `pending` : En attente dans la queue
   * - `processing` : Traitement en cours avec progression
   * - `completed` : Terminé avec succès
   * - `failed` : Échec avec détails d'erreur
   * 
   * @param exportId - UUID de l'export à suivre
   * @param user - Utilisateur authentifié (validation d'accès)
   * @returns Promise avec le statut détaillé de l'export
   * 
   * @throws NotFoundException si l'export n'existe pas ou est terminé
   * @throws ForbiddenException si l'utilisateur n'a pas accès à cet export
   */
  @Get('status/:exportId')
  @ApiOperation({ 
    summary: 'Récupérer le statut d\'un export',
    description: `
      Récupère les informations de statut et progression d'un export en cours.
      
      **Cas d'usage :**
      - Suivi en temps réel des exports asynchrones
      - Vérification de la completion avant téléchargement  
      - Diagnostic en cas d'échec d'export
      
      **Polling recommandé :**
      - Intervalle : 2-5 secondes pour les exports actifs
      - Arrêt : quand status = 'completed' ou 'failed'
      - Timeout : abandon après 10 minutes sans progression
    `
  })
  @ApiParam({
    name: 'exportId',
    description: 'UUID de l\'export à suivre (reçu lors du démarrage)',
    example: '550e8400-e29b-41d4-a716-446655440000',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Statut récupéré avec succès',
    type: ExportStatusDto,
    examples: {
      processing: {
        summary: 'Export en cours',
        value: {
          status: 'processing',
          progress: 75,
          message: 'Conversion PDF en cours...',
          estimatedTimeRemaining: 30,
          lastUpdated: '2024-08-18T10:35:22.123Z'
        }
      },
      completed: {
        summary: 'Export terminé',
        value: {
          status: 'completed',
          progress: 100,
          message: 'Export terminé avec succès',
          lastUpdated: '2024-08-18T10:36:45.789Z'
        }
      },
      failed: {
        summary: 'Export en échec',
        value: {
          status: 'failed',
          progress: 45,
          message: 'Échec lors de la conversion',
          error: 'Pandoc conversion failed: document too complex',
          lastUpdated: '2024-08-18T10:35:30.456Z'
        }
      }
    }
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Export non trouvé ou déjà terminé',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 404 },
        message: { type: 'string', example: 'Export not found or already completed' },
        error: { type: 'string', example: 'Not Found' }
      }
    }
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Accès refusé à cet export',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 403 },
        message: { type: 'string', example: 'You do not have access to this export' },
        error: { type: 'string', example: 'Forbidden' }
      }
    }
  })
  @ApiProduces('application/json')
  async getExportStatus(
    @Param('exportId', ParseUUIDPipe) exportId: string,
    @CurrentUser() user: User,
  ): Promise<ExportStatusDto> {
    this.logger.debug(`Status request for export ${exportId} by user ${user.id}`);

    try {
      const status = await this.exportService.getExportStatus(exportId, user.id);
      
      this.logger.debug(
        `Export status: ${exportId} -> ${status.status} (${status.progress}%)`
      );

      return status;

    } catch (error) {
      if (error instanceof HttpException) {
        if (error.getStatus() === HttpStatus.NOT_FOUND) {
          this.logger.warn(`Export status not found: ${exportId} for user ${user.id}`);
        }
        throw error;
      }

      this.logger.error(
        `Failed to retrieve export status ${exportId}: ${error.message}`,
        error.stack
      );
      
      throw new HttpException(
        'Failed to retrieve export status',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Récupère les informations de santé du service d'export
   * 
   * Endpoint de monitoring pour vérifier l'état des services d'export
   * et de leurs dépendances. Utilisé par les systèmes de surveillance.
   * 
   * INFORMATIONS FOURNIES :
   * - État global du service (ready/not ready)
   * - Nombre d'exports actifs et en queue
   * - Disponibilité des services dépendants
   * - Statistiques de performance récentes
   * 
   * @returns Informations détaillées sur l'état du service
   */
  @Get('health')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Vérifier la santé du service d\'export',
    description: `
      Retourne l'état de santé du service d'export et de ses dépendances.
      
      **Usage :**
      - Monitoring automatisé des services
      - Diagnostics en cas de problème d'export
      - Vérification avant démarrage d'exports critiques
    `
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'État de santé du service',
    schema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['healthy', 'degraded', 'unhealthy'],
          description: 'État global du service'
        },
        timestamp: {
          type: 'string',
          format: 'date-time',
          description: 'Timestamp de la vérification'
        },
        services: {
          type: 'object',
          properties: {
            fileRetrieval: { type: 'boolean', description: 'Service de récupération de fichiers' },
            markdownExport: { type: 'boolean', description: 'Service d\'export Markdown' },
            pdfExport: { type: 'boolean', description: 'Service d\'export PDF (Pandoc)' },
            cache: { type: 'boolean', description: 'Service de cache Redis' }
          }
        },
        metrics: {
          type: 'object',
          properties: {
            activeExports: { type: 'number', description: 'Exports en cours' },
            queuedExports: { type: 'number', description: 'Exports en attente' },
            maxConcurrency: { type: 'number', description: 'Limite de concurrence' }
          }
        }
      }
    }
  })
  @ApiProduces('application/json')
  async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: string;
    services: Record<string, boolean>;
    metrics: Record<string, number>;
  }> {
    try {
      const serviceStatus = this.exportService.getServiceStatus();
      
      // Évaluation de l'état global
      const allDependenciesReady = Object.values(serviceStatus.dependencies).every(ready => ready);
      const hasCapacity = serviceStatus.activeExports < serviceStatus.maxConcurrency;
      
      let globalStatus: 'healthy' | 'degraded' | 'unhealthy';
      
      if (serviceStatus.ready && allDependenciesReady && hasCapacity) {
        globalStatus = 'healthy';
      } else if (serviceStatus.ready && (allDependenciesReady || hasCapacity)) {
        globalStatus = 'degraded';
      } else {
        globalStatus = 'unhealthy';
      }

      const healthInfo = {
        status: globalStatus,
        timestamp: new Date().toISOString(),
        services: {
          fileRetrieval: serviceStatus.dependencies.fileRetrieval,
          markdownExport: serviceStatus.dependencies.markdownExport,
          pdfExport: serviceStatus.dependencies.pdfExport,
          cache: serviceStatus.dependencies.cache,
        },
        metrics: {
          activeExports: serviceStatus.activeExports,
          queuedExports: serviceStatus.queuedExports,
          maxConcurrency: serviceStatus.maxConcurrency,
        }
      };

      this.logger.debug(`Health check completed: ${globalStatus}`);
      return healthInfo;

    } catch (error) {
      this.logger.error(`Health check failed: ${error.message}`, error.stack);
      
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        services: {
          fileRetrieval: false,
          markdownExport: false,
          pdfExport: false,
          cache: false,
        },
        metrics: {
          activeExports: 0,
          queuedExports: 0,
          maxConcurrency: 0,
        }
      };
    }
  }

  /**
   * MÉTHODES PRIVÉES - GESTION D'ERREURS ET UTILITAIRES
   */

  /**
   * Gère les erreurs d'export avec logging approprié
   * Centralise la gestion d'erreurs pour consistency et monitoring
   */
  private handleExportError(
    error: any, 
    projectId: string, 
    userId: string, 
    options: ExportOptionsDto
  ): void {
    const errorContext = {
      projectId,
      userId,
      format: options.format,
      complexity: options.getExportComplexity(),
      filesCount: options.getSelectedFilesCount(),
    };

    if (error instanceof HttpException) {
      const status = error.getStatus();
      
      // Log selon le niveau de sévérité
      if (status >= 500) {
        this.logger.error(
          `Export system error: ${error.message}`,
          { ...errorContext, stack: error.stack }
        );
      } else if (status === 429) {
        this.logger.warn(
          `Export rate limited: ${error.message}`,
          errorContext
        );
      } else if (status >= 400) {
        this.logger.warn(
          `Export client error: ${error.message}`,
          errorContext
        );
      }
      
      return; // HttpException sera re-throw automatiquement
    }

    // Erreurs inattendues
    this.logger.error(
      `Unexpected export error: ${error.message}`,
      { ...errorContext, stack: error.stack }
    );
    
    // Classification automatique pour les erreurs non-HTTP
    if (error.message?.includes('timeout')) {
      throw new HttpException(
        'Export timeout - project may be too large',
        HttpStatus.REQUEST_TIMEOUT
      );
    }
    
    if (error.message?.includes('memory') || error.message?.includes('size')) {
      throw new HttpException(
        'Project too large for export',
        HttpStatus.PAYLOAD_TOO_LARGE
      );
    }
    
    if (error.message?.includes('pandoc') || error.message?.includes('conversion')) {
      throw new HttpException(
        'Document conversion failed - please try again or contact support',
        HttpStatus.UNPROCESSABLE_ENTITY
      );
    }
    
    // Erreur générique pour les cas non classifiés
    throw new HttpException(
      'Export failed due to technical error',
      HttpStatus.INTERNAL_SERVER_ERROR
    );
  }
}