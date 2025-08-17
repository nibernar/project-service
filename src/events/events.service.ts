/**
 * EventsService - Stub temporaire pour la publication d'événements métier
 * 
 * ATTENTION : Cette implémentation est temporaire !
 * 
 * Ce service stub permet de tester le workflow complet sans attendre
 * l'implémentation finale du module Events (Phase 6 de la roadmap).
 * 
 * FONCTIONNALITÉS ACTUELLES :
 * - Logging structuré des événements
 * - Interface compatible avec l'implémentation finale
 * - Simulation des délais de réseau
 * - Gestion basique des erreurs
 * 
 * À REMPLACER PAR (Phase 6) :
 * - Publication réelle vers l'orchestrateur (HTTP/Message Queue)
 * - Gestion des retry et dead letter queues
 * - Monitoring des flux d'événements
 * - Sérialisation/désérialisation avancée
 * 
 * @fileoverview Stub temporaire pour les événements projet
 * @version 0.1.0-stub
 * @since 2025-01-28
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Types d'événements supportés par le système
 */
export const EVENT_TYPES = {
  PROJECT_CREATED: 'project.created',
  PROJECT_UPDATED: 'project.updated', 
  PROJECT_ARCHIVED: 'project.archived',
  PROJECT_DELETED: 'project.deleted',
  PROJECT_FILES_UPDATED: 'project.files.updated',
} as const;

/**
 * Interface pour les événements de création de projet
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

/**
 * Interface pour les événements de mise à jour de projet
 */
export interface ProjectUpdatedEventDto {
  projectId: string;
  ownerId: string;
  changes: Record<string, any>;
  modifiedFields: string[];
  updatedAt: Date;
}

/**
 * Interface pour les événements d'archivage
 */
export interface ProjectArchivedEventDto {
  projectId: string;
  ownerId: string;
  previousStatus: string;
  archivedAt: Date;
}

/**
 * Interface pour les événements de suppression
 */
export interface ProjectDeletedEventDto {
  projectId: string;
  ownerId: string;
  previousStatus: string;
  hadGeneratedFiles: boolean;
  fileCount: { uploaded: number; generated: number; total: number };
  deletedAt: Date;
}

/**
 * Interface pour les événements de mise à jour des fichiers
 */
export interface ProjectFilesUpdatedEventDto {
  projectId: string;
  ownerId: string;
  newFileIds: string[];
  updateMode: string;
  totalGeneratedFiles: number;
  updatedAt: Date;
}

/**
 * Configuration pour la simulation d'événements
 */
interface EventsConfig {
  simulateNetworkDelay: boolean;
  delayMs: number;
  failureRate: number;
  enableDetailedLogging: boolean;
}

/**
 * Service stub pour la publication d'événements métier
 * 
 * IMPORTANT : Ne pas utiliser en production !
 * Ce service simule la publication d'événements avec logging.
 */
@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);
  private readonly config: EventsConfig;

  constructor(private readonly configService: ConfigService) {
    // Configuration du stub (peut être surchargée via environment)
    this.config = {
      simulateNetworkDelay: this.configService.get('EVENTS_SIMULATE_DELAY', 'true') === 'true',
      delayMs: parseInt(this.configService.get('EVENTS_DELAY_MS', '100'), 10),
      failureRate: parseFloat(this.configService.get('EVENTS_FAILURE_RATE', '0.0')),
      enableDetailedLogging: this.configService.get('NODE_ENV') === 'development',
    };

    this.logger.warn('⚠️  USING STUB EventsService - Events are only logged, not published!');
    this.logger.log('Events configuration', this.config);
  }

  /**
   * Publie un événement de création de projet
   * 
   * @param event Données de l'événement de création
   */
  async publishProjectCreated(event: ProjectCreatedEventDto): Promise<void> {
    const eventData = {
      type: EVENT_TYPES.PROJECT_CREATED,
      projectId: event.projectId,
      ownerId: event.ownerId,
      timestamp: new Date(),
      data: {
        name: event.name,
        description: event.description,
        initialPrompt: this.truncateForLog(event.initialPrompt, 100),
        uploadedFileIds: event.uploadedFileIds,
        hasUploadedFiles: event.hasUploadedFiles,
        promptComplexity: event.promptComplexity,
        createdAt: event.createdAt,
      },
    };

    await this.simulateEventPublication(eventData);

    this.logger.log('📤 PROJECT_CREATED event published', {
      projectId: event.projectId,
      ownerId: event.ownerId,
      promptLength: event.initialPrompt.length,
      filesCount: event.uploadedFileIds.length,
      complexity: event.promptComplexity,
    });

    // Log détaillé en développement
    if (this.config.enableDetailedLogging) {
      this.logger.debug('Event details', { event: eventData });
    }
  }

  /**
   * Publie un événement de mise à jour de projet
   * 
   * @param event Données de l'événement de mise à jour
   */
  async publishProjectUpdated(event: ProjectUpdatedEventDto): Promise<void> {
    const eventData = {
      type: EVENT_TYPES.PROJECT_UPDATED,
      projectId: event.projectId,
      ownerId: event.ownerId,
      timestamp: new Date(),
      data: {
        changes: event.changes,
        modifiedFields: event.modifiedFields,
        updatedAt: event.updatedAt,
      },
    };

    await this.simulateEventPublication(eventData);

    this.logger.log('📤 PROJECT_UPDATED event published', {
      projectId: event.projectId,
      ownerId: event.ownerId,
      modifiedFields: event.modifiedFields,
      changesCount: Object.keys(event.changes).length,
    });

    if (this.config.enableDetailedLogging) {
      this.logger.debug('Event details', { event: eventData });
    }
  }

  /**
   * Publie un événement d'archivage de projet
   * 
   * @param event Données de l'événement d'archivage
   */
  async publishProjectArchived(event: ProjectArchivedEventDto): Promise<void> {
    const eventData = {
      type: EVENT_TYPES.PROJECT_ARCHIVED,
      projectId: event.projectId,
      ownerId: event.ownerId,
      timestamp: new Date(),
      data: {
        previousStatus: event.previousStatus,
        archivedAt: event.archivedAt,
      },
    };

    await this.simulateEventPublication(eventData);

    this.logger.log('📤 PROJECT_ARCHIVED event published', {
      projectId: event.projectId,
      ownerId: event.ownerId,
      previousStatus: event.previousStatus,
    });

    if (this.config.enableDetailedLogging) {
      this.logger.debug('Event details', { event: eventData });
    }
  }

  /**
   * Publie un événement de suppression de projet
   * 
   * @param event Données de l'événement de suppression
   */
  async publishProjectDeleted(event: ProjectDeletedEventDto): Promise<void> {
    const eventData = {
      type: EVENT_TYPES.PROJECT_DELETED,
      projectId: event.projectId,
      ownerId: event.ownerId,
      timestamp: new Date(),
      data: {
        previousStatus: event.previousStatus,
        hadGeneratedFiles: event.hadGeneratedFiles,
        fileCount: event.fileCount,
        deletedAt: event.deletedAt,
      },
    };

    await this.simulateEventPublication(eventData);

    this.logger.log('📤 PROJECT_DELETED event published', {
      projectId: event.projectId,
      ownerId: event.ownerId,
      previousStatus: event.previousStatus,
      totalFiles: event.fileCount.total,
    });

    if (this.config.enableDetailedLogging) {
      this.logger.debug('Event details', { event: eventData });
    }
  }

  /**
   * Publie un événement de mise à jour des fichiers générés
   * 
   * @param event Données de l'événement de mise à jour des fichiers
   */
  async publishProjectFilesUpdated(event: ProjectFilesUpdatedEventDto): Promise<void> {
    const eventData = {
      type: EVENT_TYPES.PROJECT_FILES_UPDATED,
      projectId: event.projectId,
      ownerId: event.ownerId,
      timestamp: new Date(),
      data: {
        newFileIds: event.newFileIds,
        updateMode: event.updateMode,
        totalGeneratedFiles: event.totalGeneratedFiles,
        updatedAt: event.updatedAt,
      },
    };

    await this.simulateEventPublication(eventData);

    this.logger.log('📤 PROJECT_FILES_UPDATED event published', {
      projectId: event.projectId,
      ownerId: event.ownerId,
      newFilesCount: event.newFileIds.length,
      updateMode: event.updateMode,
      totalFiles: event.totalGeneratedFiles,
    });

    if (this.config.enableDetailedLogging) {
      this.logger.debug('Event details', { event: eventData });
    }
  }

  // ========================================================================
  // MÉTHODES PRIVÉES - SIMULATION
  // ========================================================================

  /**
   * Simule la publication d'un événement avec délai et échecs possibles
   * 
   * @param eventData Données de l'événement à publier
   * @throws Error si la simulation d'échec est activée
   */
  private async simulateEventPublication(eventData: any): Promise<void> {
    // Simulation du délai réseau
    if (this.config.simulateNetworkDelay && this.config.delayMs > 0) {
      await this.sleep(this.config.delayMs);
    }

    // Simulation d'échecs aléatoires
    if (this.config.failureRate > 0) {
      const random = Math.random();
      if (random < this.config.failureRate) {
        const error = new Error(`Simulated event publication failure (${Math.floor(random * 100)}% chance)`);
        this.logger.error('❌ Event publication simulation failed', {
          eventType: eventData.type,
          projectId: eventData.projectId,
          error: error.message,
        });
        throw error;
      }
    }

    // TODO Phase 6: Remplacer par vraie publication vers orchestrateur
    // - HTTP POST vers service d'orchestration
    // - Ou publication dans une queue (RabbitMQ/Redis)
    // - Avec retry et dead letter queue
    
    this.logger.debug('✅ Event publication simulated successfully', {
      eventType: eventData.type,
      projectId: eventData.projectId,
    });
  }

  /**
   * Fonction utilitaire pour simuler un délai
   * 
   * @param ms Millisecondes à attendre
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Tronque une chaîne pour les logs
   * 
   * @param text Texte à tronquer
   * @param maxLength Longueur maximale
   * @returns Texte tronqué avec ellipse si nécessaire
   */
  private truncateForLog(text: string, maxLength: number): string {
    if (!text || text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength) + '...';
  }

  // ========================================================================
  // MÉTHODES UTILITAIRES POUR LES TESTS
  // ========================================================================

  /**
   * Retourne la configuration actuelle du stub
   * 
   * @returns Configuration du service d'événements
   */
  getConfig(): EventsConfig {
    return { ...this.config };
  }

  /**
   * Met à jour la configuration du stub (pour les tests)
   * 
   * @param updates Mises à jour partielles de la configuration
   */
  updateConfig(updates: Partial<EventsConfig>): void {
    Object.assign(this.config, updates);
    this.logger.log('Events configuration updated', this.config);
  }

  /**
   * Désactive toutes les simulations (pour les tests unitaires)
   */
  disableSimulation(): void {
    this.updateConfig({
      simulateNetworkDelay: false,
      delayMs: 0,
      failureRate: 0,
      enableDetailedLogging: false,
    });
  }

  /**
   * Active le mode détaillé pour le debugging
   */
  enableDetailedMode(): void {
    this.updateConfig({
      enableDetailedLogging: true,
      simulateNetworkDelay: false,
    });
  }

  /**
   * Retourne les statistiques d'utilisation (pour monitoring temporaire)
   */
  getUsageStats(): {
    totalEventsPublished: number;
    eventsByType: Record<string, number>;
    lastEventTimestamp: Date | null;
  } {
    // TODO: Implémenter vraies statistiques si nécessaire
    // Pour l'instant retourne des données vides
    return {
      totalEventsPublished: 0,
      eventsByType: {},
      lastEventTimestamp: null,
    };
  }
}