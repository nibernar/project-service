import { Controller, Get, Logger, HttpStatus, HttpException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiProduces } from '@nestjs/swagger';
import { HealthService, DetailedHealthStatus, GlobalHealthStatus } from './health.service';

// DTOs pour la documentation Swagger
export interface BasicHealthResponse {
  status: string;
  timestamp: Date;
}

export interface ReadinessResponse {
  ready: boolean;
  timestamp: Date;
  checks?: {
    database: boolean;
    cache: boolean;
  };
}

export interface LivenessResponse {
  alive: boolean;
  timestamp: Date;
  uptime: number;
}

@Controller('health')
@ApiTags('Health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(private readonly healthService: HealthService) {}

  /**
   * Basic health check endpoint
   * Endpoint simple pour les load balancers et monitoring basique
   */
  @Get()
  @ApiOperation({ 
    summary: 'Basic health check',
    description: 'Returns basic health status for load balancers and simple monitoring'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Service is healthy',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        timestamp: { type: 'string', format: 'date-time' }
      }
    }
  })
  @ApiResponse({ 
    status: 503, 
    description: 'Service is unhealthy',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'error' },
        timestamp: { type: 'string', format: 'date-time' },
        message: { type: 'string', example: 'Database connection failed' }
      }
    }
  })
  @ApiProduces('application/json')
  async check(): Promise<BasicHealthResponse> {
    try {
      this.logger.debug('Processing basic health check request');
      
      const isHealthy = await this.healthService.isHealthy();
      const response: BasicHealthResponse = {
        status: isHealthy ? 'ok' : 'error',
        timestamp: new Date(),
      };

      if (!isHealthy) {
        this.logger.warn('Basic health check failed - service is unhealthy');
        throw new HttpException(
          {
            ...response,
            message: 'Service is currently unhealthy',
          },
          HttpStatus.SERVICE_UNAVAILABLE
        );
      }

      this.logger.debug('Basic health check completed successfully');
      return response;
    } catch (error) {
      this.logger.error('Basic health check failed', error.stack);
      
      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        {
          status: 'error',
          timestamp: new Date(),
          message: 'Health check failed due to internal error',
        },
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }
  }

  /**
   * Detailed health status endpoint
   * Endpoint complet avec toutes les métriques pour le monitoring avancé
   */
  @Get('detailed')
  @ApiOperation({ 
    summary: 'Detailed health status',
    description: 'Returns comprehensive health information including all checks, metrics, and dependencies'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Detailed health information',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['healthy', 'unhealthy'] },
        timestamp: { type: 'string', format: 'date-time' },
        uptime: { type: 'number', description: 'Uptime in seconds' },
        checks: {
          type: 'object',
          properties: {
            database: {
              type: 'object',
              properties: {
                status: { type: 'string', enum: ['up', 'down'] },
                responseTime: { type: 'number' },
                error: { type: 'string' },
                details: { type: 'object' }
              },
              required: ['status', 'responseTime']
            },
            cache: {
              type: 'object',
              properties: {
                status: { type: 'string', enum: ['up', 'down'] },
                responseTime: { type: 'number' },
                error: { type: 'string' },
                details: { type: 'object' }
              },
              required: ['status', 'responseTime']
            },
            externalServices: {
              type: 'object',
              additionalProperties: {
                type: 'object',
                properties: {
                  serviceName: { type: 'string' },
                  status: { type: 'string', enum: ['up', 'down'] },
                  responseTime: { type: 'number' },
                  endpoint: { type: 'string' },
                  version: { type: 'string' }
                }
              }
            }
          }
        },
        metadata: {
          type: 'object',
          properties: {
            serviceName: { type: 'string' },
            version: { type: 'string' },
            environment: { type: 'string' }
          }
        }
      }
    }
  })
  @ApiResponse({ 
    status: 503, 
    description: 'Service is unhealthy but returns detailed diagnostics' 
  })
  @ApiProduces('application/json')
  async detailed(): Promise<DetailedHealthStatus> {
    try {
      this.logger.debug('Processing detailed health check request');
      
      const healthStatus = await this.healthService.getDetailedStatus();
      
      this.logger.debug(`Detailed health check completed: ${healthStatus.status}`);
      
      if (healthStatus.status === 'unhealthy') {
        this.logger.warn('Service is unhealthy', {
          databaseStatus: healthStatus.checks.database.status,
          cacheStatus: healthStatus.checks.cache.status,
          externalServicesDown: Object.values(healthStatus.checks.externalServices)
            .filter(service => service.status === 'down').length
        });
        
        throw new HttpException(healthStatus, HttpStatus.SERVICE_UNAVAILABLE);
      }

      return healthStatus;
    } catch (error) {
      this.logger.error('Detailed health check failed', error.stack);
      
      if (error instanceof HttpException) {
        throw error;
      }

      // En cas d'erreur critique, retourner un statut minimal
      const fallbackStatus: DetailedHealthStatus = {
        status: 'unhealthy',
        timestamp: new Date(),
        uptime: this.healthService.getUptime(),
        checks: {
          database: { status: 'down', responseTime: 0, error: 'Health check failed' },
          cache: { status: 'down', responseTime: 0, error: 'Health check failed' },
          externalServices: {}
        },
        metadata: {
          serviceName: 'project-service',
          version: '1.0.0',
          environment: 'unknown'
        }
      };

      throw new HttpException(fallbackStatus, HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  /**
   * Readiness probe endpoint
   * Endpoint pour Kubernetes readiness probe - vérifie que le service est prêt à recevoir du trafic
   */
  @Get('ready')
  @ApiOperation({ 
    summary: 'Readiness probe',
    description: 'Kubernetes readiness probe - checks if service is ready to receive traffic'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Service is ready',
    schema: {
      type: 'object',
      properties: {
        ready: { type: 'boolean', example: true },
        timestamp: { type: 'string', format: 'date-time' },
        checks: {
          type: 'object',
          properties: {
            database: { type: 'boolean' },
            cache: { type: 'boolean' }
          }
        }
      }
    }
  })
  @ApiResponse({ 
    status: 503, 
    description: 'Service is not ready' 
  })
  @ApiProduces('application/json')
  async ready(): Promise<ReadinessResponse> {
    try {
      this.logger.debug('Processing readiness probe');
      
      // Pour la readiness, on vérifie les composants essentiels
      const [databaseCheck, cacheCheck] = await Promise.allSettled([
        this.healthService.checkDatabase(),
        this.healthService.checkCache(),
      ]);

      const databaseReady = databaseCheck.status === 'fulfilled' && databaseCheck.value.status === 'up';
      const cacheReady = cacheCheck.status === 'fulfilled' && cacheCheck.value.status === 'up';
      
      // Le service est ready si au moins la base de données fonctionne
      // Le cache peut être temporairement indisponible
      const isReady = databaseReady;
      
      const response: ReadinessResponse = {
        ready: isReady,
        timestamp: new Date(),
        checks: {
          database: databaseReady,
          cache: cacheReady,
        }
      };

      if (!isReady) {
        this.logger.warn('Readiness probe failed', response.checks);
        throw new HttpException(response, HttpStatus.SERVICE_UNAVAILABLE);
      }

      this.logger.debug('Readiness probe passed');
      return response;
    } catch (error) {
      this.logger.error('Readiness probe error', error.stack);
      
      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        {
          ready: false,
          timestamp: new Date(),
          checks: {
            database: false,
            cache: false,
          }
        },
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }
  }

  /**
   * Liveness probe endpoint  
   * Endpoint pour Kubernetes liveness probe - vérifie que le service est vivant
   */
  @Get('live')
  @ApiOperation({ 
    summary: 'Liveness probe',
    description: 'Kubernetes liveness probe - checks if service is alive and should not be restarted'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Service is alive',
    schema: {
      type: 'object',
      properties: {
        alive: { type: 'boolean', example: true },
        timestamp: { type: 'string', format: 'date-time' },
        uptime: { type: 'number', description: 'Service uptime in seconds' }
      }
    }
  })
  @ApiResponse({ 
    status: 503, 
    description: 'Service is not alive and should be restarted' 
  })
  @ApiProduces('application/json')
  async live(): Promise<LivenessResponse> {
    try {
      this.logger.debug('Processing liveness probe');
      
      // Pour la liveness probe, on fait des vérifications très basiques
      // L'objectif est de détecter si le processus est bloqué ou dans un état zombie
      const uptime = this.healthService.getUptime();
      
      // Test très simple : vérifier que le service peut encore traiter les requêtes
      // En principe, si on arrive ici, c'est que le service est vivant
      const isAlive = true;
      
      const response: LivenessResponse = {
        alive: isAlive,
        timestamp: new Date(),
        uptime,
      };

      this.logger.debug(`Liveness probe passed (uptime: ${uptime}s)`);
      return response;
    } catch (error) {
      this.logger.error('Liveness probe error', error.stack);
      
      // En cas d'erreur dans la liveness probe, c'est critique
      throw new HttpException(
        {
          alive: false,
          timestamp: new Date(),
          uptime: 0,
        },
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }
  }
}