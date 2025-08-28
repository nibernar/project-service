import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { timeout, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';

import { 
  EVENT_TYPES, 
  ProjectEventType, 
  getEventMetadata, 
  isHighPriorityEvent,
} from './event-types.constants';

/**
 * Event DTOs for different project events (compatible with project.service.ts)
 */
export interface ProjectCreatedEventDto {
  projectId: string;
  ownerId: string;
  name: string;
  description?: string;
  initialPrompt: string;
  uploadedFileIds: string[];
  hasUploadedFiles: boolean;
  promptComplexity: string;
  createdAt: Date;
}

export interface ProjectUpdatedEventDto {
  projectId: string;
  ownerId: string;
  changes: Record<string, any>;
  modifiedFields: string[];
  updatedAt: Date;
}

export interface ProjectArchivedEventDto {
  projectId: string;
  ownerId: string;
  previousStatus: string;
  archivedAt: Date;
}

export interface ProjectDeletedEventDto {
  projectId: string;
  ownerId: string;
  previousStatus: string;
  hadGeneratedFiles: boolean;
  fileCount: { uploaded: number; generated: number; total: number };
  deletedAt: Date;
}

export interface ProjectFilesUpdatedEventDto {
  projectId: string;
  ownerId: string;
  newFileIds: string[];
  updateMode: string;
  totalGeneratedFiles: number;
  updatedAt: Date;
}

/**
 * Event Transport Interface
 */
export interface EventTransport {
  publish(eventType: ProjectEventType, payload: any, options?: EventPublishOptions): Promise<void>;
  healthCheck(): Promise<boolean>;
  close(): Promise<void>;
}

/**
 * Event Publishing Options
 */
export interface EventPublishOptions {
  correlationId?: string;
  timeout?: number;
  maxRetries?: number;
  priority?: 'high' | 'medium' | 'low';
}

/**
 * Circuit Breaker States
 */
enum CircuitBreakerState {
  CLOSED = 'closed',
  OPEN = 'open', 
  HALF_OPEN = 'half-open',
}

/**
 * Circuit Breaker Implementation
 */
class CircuitBreaker {
  private state = CircuitBreakerState.CLOSED;
  private failureCount = 0;
  private lastFailureTime = 0;
  private readonly threshold = 5;
  private readonly timeout = 30000; // 30 seconds

  constructor(private readonly logger: Logger) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitBreakerState.OPEN) {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = CircuitBreakerState.HALF_OPEN;
        this.logger.log('Circuit breaker transitioning to HALF_OPEN');
      } else {
        throw new Error('Circuit breaker is OPEN - requests blocked');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.state = CircuitBreakerState.CLOSED;
      this.logger.log('Circuit breaker restored to CLOSED state');
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.threshold) {
      this.state = CircuitBreakerState.OPEN;
      this.logger.warn(`Circuit breaker OPENED after ${this.failureCount} failures`);
    }
  }

  getState(): CircuitBreakerState {
    return this.state;
  }

  getFailureCount(): number {
    return this.failureCount;
  }
}

/**
 * HTTP Event Transport Implementation
 */
class HttpEventTransport implements EventTransport {
  constructor(
    private readonly httpService: HttpService,
    private readonly config: ConfigService,
    private readonly logger: Logger,
  ) {}

  async publish(eventType: ProjectEventType, payload: any, options?: EventPublishOptions): Promise<void> {
    const targetUrl = this.getTargetUrl(eventType);
    const requestTimeout = options?.timeout || this.getDefaultTimeout(eventType);

    const requestPayload = {
      eventType,
      payload,
      timestamp: new Date().toISOString(),
      correlationId: options?.correlationId,
      sourceService: 'project-service',
    };

    this.logger.debug(`Publishing event via HTTP`, {
      eventType,
      targetUrl,
      timeout: requestTimeout,
      payloadSize: JSON.stringify(requestPayload).length,
    });

    const response = await firstValueFrom(
      this.httpService.post(targetUrl, requestPayload, {
        timeout: requestTimeout,
        headers: {
          'Content-Type': 'application/json',
          'X-Service-Token': this.config.get('INTERNAL_SERVICE_TOKEN', 'dev-token'),
          'X-Event-Type': eventType,
          ...(options?.correlationId && { 'X-Correlation-ID': options.correlationId }),
        },
      }).pipe(
        timeout(requestTimeout),
        catchError(error => {
          this.logger.error(`HTTP event publish failed`, {
            eventType,
            targetUrl,
            error: error.message,
            status: error.response?.status,
          });
          return throwError(() => error);
        }),
      ),
    );

    this.logger.debug(`Event published successfully via HTTP`, {
      eventType,
      status: response.status,
      responseTime: response.headers['x-response-time'],
    });
  }

  async healthCheck(): Promise<boolean> {
    try {
      const orchestrationUrl = this.config.get('ORCHESTRATION_SERVICE_URL', 'http://localhost:3002');
      await firstValueFrom(
        this.httpService.get(`${orchestrationUrl}/health`).pipe(timeout(5000)),
      );
      return true;
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    this.logger.debug('HTTP event transport closed');
  }

  private getTargetUrl(eventType: ProjectEventType): string {
    const baseUrl = this.config.get('ORCHESTRATION_SERVICE_URL', 'http://localhost:3002');
    
    switch (eventType) {
      case EVENT_TYPES.PROJECT_CREATED:
        return `${baseUrl}/events/project/created`;
      case EVENT_TYPES.PROJECT_UPDATED:
        return `${baseUrl}/events/project/updated`;
      case EVENT_TYPES.PROJECT_ARCHIVED:
        return `${baseUrl}/events/project/archived`;
      case EVENT_TYPES.PROJECT_DELETED:
        return `${baseUrl}/events/project/deleted`;
      case EVENT_TYPES.PROJECT_FILES_UPDATED:
        return `${baseUrl}/events/project/files/updated`;
      default:
        return `${baseUrl}/events/generic`;
    }
  }

  private getDefaultTimeout(eventType: ProjectEventType): number {
    const metadata = getEventMetadata(eventType);
    return metadata?.timeout || 15000;
  }
}

/**
 * Stub Event Transport for Development
 */
class StubEventTransport implements EventTransport {
  private publishCount = 0;
  
  constructor(
    private readonly logger: Logger,
    private readonly config: any = {},
  ) {}

  async publish(eventType: ProjectEventType, payload: any, options?: EventPublishOptions): Promise<void> {
    this.publishCount++;
    
    this.logger.warn(`🔔 [STUB] Event would be published:`, {
      eventType,
      payloadKeys: Object.keys(payload),
      correlationId: options?.correlationId,
      publishCount: this.publishCount,
    });

    if (this.config.simulateNetworkDelay) {
      await this.sleep(this.config.delayMs || 100);
    }

    if (this.config.failureRate > 0 && Math.random() < this.config.failureRate) {
      throw new Error(`Simulated failure (rate: ${this.config.failureRate})`);
    }

    if (this.config.enableDetailedLogging) {
      this.logger.debug(`[STUB] Event payload:`, JSON.stringify(payload, null, 2));
    }
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }

  async close(): Promise<void> {
    this.logger.log(`[STUB] Transport closed. Total events published: ${this.publishCount}`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Events Service
 * 
 * Central service for publishing events in the Project Service.
 * Handles event routing, retry logic, circuit breaker pattern,
 * and provides abstraction over different transport mechanisms.
 */
@Injectable()
export class EventsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventsService.name);
  private transport: EventTransport;
  private circuitBreaker: CircuitBreaker;
  private metricsCollector: Map<string, number> = new Map();
  private startTime = Date.now();

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.circuitBreaker = new CircuitBreaker(this.logger);
  }

  async onModuleInit(): Promise<void> {
    await this.initializeTransport();
    this.startMetricsCollection();
    this.logger.log('EventsService initialized successfully');
  }

  async onModuleDestroy(): Promise<void> {
    if (this.transport) {
      await this.transport.close();
    }
    this.logMetricsSummary();
  }

  /**
   * Publishes project created event to orchestration service
   * This is a critical event that triggers the document generation workflow
   */
  async publishProjectCreated(event: ProjectCreatedEventDto, correlationId?: string): Promise<void> {
    const startTime = Date.now();
    
    try {
      const eventPayload = {
        projectId: event.projectId,
        ownerId: event.ownerId,
        name: event.name,
        description: event.description,
        initialPrompt: event.initialPrompt,
        uploadedFileIds: event.uploadedFileIds,
        hasUploadedFiles: event.hasUploadedFiles,
        promptComplexity: event.promptComplexity,
        createdAt: event.createdAt.toISOString(),
        eventMetadata: {
          eventId: `evt_${crypto.randomUUID()}`,
          eventTimestamp: new Date().toISOString(),
          eventVersion: '1.0',
          sourceService: 'project-service',
        },
      };

      await this.publishWithRetry(
        EVENT_TYPES.PROJECT_CREATED,
        eventPayload,
        {
          correlationId,
          priority: 'high',
          maxRetries: 5,
        },
      );

      this.recordMetric('project_created_success', 1);
      this.recordMetric('project_created_duration', Date.now() - startTime);
      
      this.logger.log('Project created event published successfully', {
        projectId: event.projectId,
        eventId: eventPayload.eventMetadata.eventId,
        correlationId,
        duration: Date.now() - startTime,
      });
      
    } catch (error) {
      this.recordMetric('project_created_error', 1);
      this.logger.error('Failed to publish project created event', {
        projectId: event.projectId,
        error: error.message,
        correlationId,
      });
      throw error;
    }
  }

  /**
   * Publishes project updated event
   * Non-critical event for cache invalidation and monitoring
   */
  async publishProjectUpdated(
    event: ProjectUpdatedEventDto,
    correlationId?: string,
  ): Promise<void> {
    const eventPayload = {
      projectId: event.projectId,
      ownerId: event.ownerId,
      changes: event.changes,
      modifiedFields: event.modifiedFields,
      updatedAt: event.updatedAt.toISOString(),
      eventMetadata: {
        eventId: `evt_${crypto.randomUUID()}`,
        eventTimestamp: new Date().toISOString(),
        eventVersion: '1.0',
        sourceService: 'project-service',
      },
    };

    try {
      await this.publishWithRetry(
        EVENT_TYPES.PROJECT_UPDATED,
        eventPayload,
        {
          correlationId,
          priority: 'medium',
          maxRetries: 3,
        },
      );

      this.recordMetric('project_updated_success', 1);
      this.logger.log('Project updated event published successfully', {
        projectId: event.projectId,
        changedFields: event.modifiedFields,
        correlationId,
      });
      
    } catch (error) {
      this.recordMetric('project_updated_error', 1);
      this.logger.error('Failed to publish project updated event', {
        projectId: event.projectId,
        error: error.message,
        correlationId,
      });
      // Don't throw for non-critical events - graceful degradation
    }
  }

  /**
   * Publishes project archived event
   * Medium priority event for resource cleanup
   */
  async publishProjectArchived(event: ProjectArchivedEventDto, correlationId?: string): Promise<void> {
    const eventPayload = {
      projectId: event.projectId,
      ownerId: event.ownerId,
      previousStatus: event.previousStatus,
      archivedAt: event.archivedAt.toISOString(),
      eventMetadata: {
        eventId: `evt_${crypto.randomUUID()}`,
        eventTimestamp: new Date().toISOString(),
        eventVersion: '1.0',
        sourceService: 'project-service',
      },
    };

    try {
      await this.publishWithRetry(
        EVENT_TYPES.PROJECT_ARCHIVED,
        eventPayload,
        {
          correlationId,
          priority: 'medium',
          maxRetries: 3,
        },
      );

      this.recordMetric('project_archived_success', 1);
      this.logger.log('Project archived event published successfully', {
        projectId: event.projectId,
        correlationId,
      });
      
    } catch (error) {
      this.recordMetric('project_archived_error', 1);
      this.logger.error('Failed to publish project archived event', {
        projectId: event.projectId,
        error: error.message,
        correlationId,
      });
      // Don't throw for non-critical events
    }
  }

  /**
   * Publishes project deleted event
   * Critical event for maintaining referential integrity across services
   */
  async publishProjectDeleted(event: ProjectDeletedEventDto, correlationId?: string): Promise<void> {
    const eventPayload = {
      projectId: event.projectId,
      ownerId: event.ownerId,
      previousStatus: event.previousStatus,
      hadGeneratedFiles: event.hadGeneratedFiles,
      fileCount: event.fileCount,
      deletedAt: event.deletedAt.toISOString(),
      eventMetadata: {
        eventId: `evt_${crypto.randomUUID()}`,
        eventTimestamp: new Date().toISOString(),
        eventVersion: '1.0',
        sourceService: 'project-service',
      },
    };

    try {
      await this.publishWithRetry(
        EVENT_TYPES.PROJECT_DELETED,
        eventPayload,
        {
          correlationId,
          priority: 'high',
          maxRetries: 5,
        },
      );

      this.recordMetric('project_deleted_success', 1);
      this.logger.log('Project deleted event published successfully', {
        projectId: event.projectId,
        correlationId,
      });
      
    } catch (error) {
      this.recordMetric('project_deleted_error', 1);
      this.logger.error('Failed to publish project deleted event', {
        projectId: event.projectId,
        error: error.message,
        correlationId,
      });
      throw error; // Critical event - must succeed
    }
  }

  /**
   * Publishes project files updated event
   * Critical event indicating user deliverables are ready
   */
  async publishProjectFilesUpdated(
    event: ProjectFilesUpdatedEventDto,
    correlationId?: string,
  ): Promise<void> {
    const eventPayload = {
      projectId: event.projectId,
      ownerId: event.ownerId,
      newFileIds: event.newFileIds,
      updateMode: event.updateMode,
      totalGeneratedFiles: event.totalGeneratedFiles,
      fileCount: event.newFileIds.length,
      updatedAt: event.updatedAt.toISOString(),
      eventMetadata: {
        eventId: `evt_${crypto.randomUUID()}`,
        eventTimestamp: new Date().toISOString(),
        eventVersion: '1.0',
        sourceService: 'project-service',
      },
    };

    try {
      await this.publishWithRetry(
        EVENT_TYPES.PROJECT_FILES_UPDATED,
        eventPayload,
        {
          correlationId,
          priority: 'high',
          maxRetries: 5,
        },
      );

      this.recordMetric('project_files_updated_success', 1);
      this.logger.log('Project files updated event published successfully', {
        projectId: event.projectId,
        fileCount: event.newFileIds.length,
        correlationId,
      });
      
    } catch (error) {
      this.recordMetric('project_files_updated_error', 1);
      this.logger.error('Failed to publish project files updated event', {
        projectId: event.projectId,
        error: error.message,
        correlationId,
      });
      throw error; // Critical event - user deliverables
    }
  }

  /**
   * Health check for event publishing capability
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    transport: string;
    circuitBreakerState: CircuitBreakerState;
    lastError?: string;
    uptime: number;
    metrics: Record<string, number>;
  }> {
    try {
      const transportHealthy = await this.transport.healthCheck();
      
      return {
        status: transportHealthy ? 'healthy' : 'unhealthy',
        transport: this.configService.get('EVENT_TRANSPORT', 'stub'),
        circuitBreakerState: this.circuitBreaker.getState(),
        uptime: Date.now() - this.startTime,
        metrics: this.getMetrics(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        transport: this.configService.get('EVENT_TRANSPORT', 'stub'),
        circuitBreakerState: this.circuitBreaker.getState(),
        lastError: error.message,
        uptime: Date.now() - this.startTime,
        metrics: this.getMetrics(),
      };
    }
  }

  /**
   * Get current metrics for monitoring
   */
  getMetrics(): Record<string, number> {
    return Object.fromEntries(this.metricsCollector);
  }

  /**
   * Reset metrics (useful for testing)
   */
  resetMetrics(): void {
    this.metricsCollector.clear();
    this.logger.debug('EventsService metrics reset');
  }

  /**
   * Private helper methods
   */
  private async initializeTransport(): Promise<void> {
    const transportType = this.configService.get('EVENT_TRANSPORT', 'stub');
    
    this.logger.log(`Initializing ${transportType} event transport`);
    
    switch (transportType.toLowerCase()) {
      case 'http':
        this.transport = new HttpEventTransport(
          this.httpService,
          this.configService,
          this.logger,
        );
        this.logger.log('HTTP event transport initialized');
        break;
        
      case 'stub':
      default:
        this.logger.warn(`⚠️  USING STUB EventsService - Events are only logged, not published!`);
        const stubConfig = {
          simulateNetworkDelay: this.configService.get('EVENT_STUB_SIMULATE_DELAY', 'true') === 'true',
          delayMs: parseInt(this.configService.get('EVENT_STUB_DELAY_MS', '100'), 10),
          failureRate: parseFloat(this.configService.get('EVENT_STUB_FAILURE_RATE', '0')),
          enableDetailedLogging: this.configService.get('NODE_ENV') === 'development',
        };
        
        this.transport = new StubEventTransport(this.logger, stubConfig);
        this.logger.log('Stub event transport initialized', stubConfig);
        break;
    }

    // Test transport health
    const healthy = await this.transport.healthCheck();
    if (!healthy) {
      this.logger.warn('Event transport health check failed - continuing with degraded functionality');
    }
  }

  private async publishWithRetry(
    eventType: ProjectEventType,
    payload: any,
    options: EventPublishOptions = {},
  ): Promise<void> {
    const metadata = getEventMetadata(eventType);
    const maxRetries = options.maxRetries || metadata?.maxRetries || 3;
    const isHighPriority = isHighPriorityEvent(eventType);

    let lastError: Error | undefined;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Use circuit breaker for high priority events only
        if (isHighPriority) {
          await this.circuitBreaker.execute(async () => {
            await this.transport.publish(eventType, payload, { ...options, timeout: options.timeout });
          });
        } else {
          await this.transport.publish(eventType, payload, options);
        }
        
        if (attempt > 1) {
          this.logger.log(`Event published successfully after ${attempt} attempts`, {
            eventType,
            attempt,
          });
          this.recordMetric(`${eventType.replace('.', '_')}_retry_success`, 1);
        }
        
        this.recordMetric(`${eventType.replace('.', '_')}_attempt`, attempt);
        return;
        
      } catch (error) {
        lastError = error;
        this.recordMetric(`${eventType.replace('.', '_')}_retry`, 1);
        
        if (attempt === maxRetries) {
          this.logger.error(`Event publishing failed after ${maxRetries} attempts`, {
            eventType,
            error: error.message,
            attempts: maxRetries,
            circuitBreakerState: this.circuitBreaker.getState(),
          });
          break;
        }
        
        const delay = this.calculateRetryDelay(attempt, metadata?.retryPolicy);
        this.logger.warn(`Event publish attempt ${attempt} failed, retrying in ${delay}ms`, {
          eventType,
          error: error.message,
          nextAttemptIn: delay,
          remainingAttempts: maxRetries - attempt,
        });
        
        await this.sleep(delay);
      }
    }
    
    this.recordMetric(`${eventType.replace('.', '_')}_failure`, 1);
    throw new Error(
      `Failed to publish event ${eventType} after ${maxRetries} attempts. Last error: ${lastError?.message || 'Unknown error'}`,
    );
  }

  private calculateRetryDelay(attempt: number, retryPolicy?: string): number {
    const baseDelay = 100;
    const jitter = Math.random() * 50; // Add randomization to prevent thundering herd
    
    switch (retryPolicy) {
      case 'exponential-backoff':
        return Math.pow(2, attempt - 1) * baseDelay + jitter;
      case 'linear-backoff':
      default:
        return attempt * 500 + jitter;
    }
  }

  private recordMetric(key: string, value: number): void {
    const current = this.metricsCollector.get(key) || 0;
    this.metricsCollector.set(key, current + value);
  }

  private startMetricsCollection(): void {
    // Log metrics summary every hour
    setInterval(() => {
      this.logMetricsSummary();
    }, 3600000); // 1 hour

    // Reset detailed metrics every 6 hours to prevent memory growth
    setInterval(() => {
      this.metricsCollector.clear();
      this.logger.debug('EventsService metrics reset');
    }, 6 * 3600000); // 6 hours
  }

  private logMetricsSummary(): void {
    if (this.metricsCollector.size > 0) {
      const metrics = Object.fromEntries(this.metricsCollector);
      this.logger.log('Events metrics summary:', {
        ...metrics,
        uptime: Date.now() - this.startTime,
        circuitBreakerState: this.circuitBreaker.getState(),
        circuitBreakerFailures: this.circuitBreaker.getFailureCount(),
      });
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}