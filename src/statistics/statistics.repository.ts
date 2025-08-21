import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from '../database/database.service';
import { ProjectStatisticsEntity } from './entities/project-statistics.entity';
import { UpdateStatisticsDto } from './dto/update-statistics.dto';

/**
 * Repository pour les opérations de base de données sur les statistiques de projets
 * Gère les requêtes Prisma et la transformation vers les entités métier
 */
@Injectable()
export class StatisticsRepository {
  private readonly logger = new Logger(StatisticsRepository.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Crée ou met à jour les statistiques d'un projet (upsert)
   * @param projectId - Identifiant du projet
   * @param data - Données de statistiques à fusionner
   * @returns Entité statistique mise à jour
   */
  async upsert(
    projectId: string,
    data: UpdateStatisticsDto,
  ): Promise<ProjectStatisticsEntity> {
    this.logger.debug(`Upserting statistics for project ${projectId}`);

    try {
      // Récupération des statistiques existantes pour fusion intelligente
      const existing = await this.findByProjectId(projectId);
      
      // Préparation des données pour l'upsert
      const upsertData = this.prepareUpsertData(existing, data);

      // Exécution de l'upsert avec gestion des conflits
      const result = await this.db.projectStatistics.upsert({
        where: { projectId },
        create: {
          projectId,
          costs: upsertData.costs as any,
          performance: upsertData.performance as any,
          usage: upsertData.usage as any,
        },
        update: {
          costs: upsertData.costs as any,
          performance: upsertData.performance as any,
          usage: upsertData.usage as any,
        },
        include: {
          project: false, // Optimisation : pas besoin de la relation pour l'upsert
        },
      });

      this.logger.debug(`Statistics upserted successfully for project ${projectId}`);
      
      // Conversion vers l'entité métier avec calculs automatiques
      return this.toEntity(result);

    } catch (error) {
      this.logger.error(
        `Failed to upsert statistics for project ${projectId}`,
        error.stack,
      );
      throw new Error(`Statistics upsert failed: ${error.message}`);
    }
  }

  /**
   * Récupère les statistiques d'un projet par son ID
   * @param projectId - Identifiant du projet
   * @returns Entité statistique ou null si non trouvée
   */
  async findByProjectId(projectId: string): Promise<ProjectStatisticsEntity | null> {
    this.logger.debug(`Finding statistics for project ${projectId}`);

    try {
      const result = await this.db.projectStatistics.findUnique({
        where: { projectId },
        include: {
          project: true, // Inclusion de la relation pour les cas d'usage étendus
        },
      });

      if (!result) {
        this.logger.debug(`No statistics found for project ${projectId}`);
        return null;
      }

      const entity = this.toEntity(result);
      this.logger.debug(`Statistics found for project ${projectId}`);
      
      return entity;

    } catch (error) {
      this.logger.error(
        `Failed to find statistics for project ${projectId}`,
        error.stack,
      );
      throw new Error(`Statistics retrieval failed: ${error.message}`);
    }
  }

  /**
   * Récupère les statistiques par ID direct de l'enregistrement
   * @param id - Identifiant unique de l'enregistrement statistique
   * @returns Entité statistique ou null si non trouvée
   */
  async findById(id: string): Promise<ProjectStatisticsEntity | null> {
    this.logger.debug(`Finding statistics by ID ${id}`);

    try {
      const result = await this.db.projectStatistics.findUnique({
        where: { id },
        include: {
          project: true,
        },
      });

      return result ? this.toEntity(result) : null;

    } catch (error) {
      this.logger.error(`Failed to find statistics by ID ${id}`, error.stack);
      throw new Error(`Statistics retrieval by ID failed: ${error.message}`);
    }
  }

  /**
   * Supprime les statistiques d'un projet
   * @param projectId - Identifiant du projet
   * @returns true si suppression réussie, false si non trouvé
   */
  async deleteByProjectId(projectId: string): Promise<boolean> {
    this.logger.debug(`Deleting statistics for project ${projectId}`);

    try {
      const result = await this.db.projectStatistics.delete({
        where: { projectId },
      });

      this.logger.debug(`Statistics deleted for project ${projectId}`);
      return true;

    } catch (error) {
      if (error.code === 'P2025') {
        // Enregistrement non trouvé
        this.logger.debug(`No statistics to delete for project ${projectId}`);
        return false;
      }

      this.logger.error(
        `Failed to delete statistics for project ${projectId}`,
        error.stack,
      );
      throw new Error(`Statistics deletion failed: ${error.message}`);
    }
  }

  /**
   * Récupère les statistiques de multiples projets avec optimisation
   * @param projectIds - Liste des identifiants de projets
   * @returns Map des statistiques par projectId
   */
  async findManyByProjectIds(
    projectIds: string[],
  ): Promise<Map<string, ProjectStatisticsEntity>> {
    this.logger.debug(`Finding statistics for ${projectIds.length} projects`);

    if (projectIds.length === 0) {
      return new Map();
    }

    try {
      const results = await this.db.projectStatistics.findMany({
        where: {
          projectId: {
            in: projectIds,
          },
        },
        include: {
          project: false, // Optimisation pour les requêtes batch
        },
      });

      const statisticsMap = new Map<string, ProjectStatisticsEntity>();
      
      for (const result of results) {
        const entity = this.toEntity(result);
        statisticsMap.set(result.projectId, entity);
      }

      this.logger.debug(`Found statistics for ${statisticsMap.size}/${projectIds.length} projects`);
      
      return statisticsMap;

    } catch (error) {
      this.logger.error('Failed to find statistics for multiple projects', error.stack);
      throw new Error(`Batch statistics retrieval failed: ${error.message}`);
    }
  }

  /**
   * Met à jour partiellement les statistiques sans fusion complète
   * Utilisé pour les mises à jour rapides de champs spécifiques
   * @param projectId - Identifiant du projet
   * @param updates - Champs à mettre à jour directement
   * @returns Entité statistique mise à jour
   */
  async partialUpdate(
    projectId: string,
    updates: Partial<{
      costs: any;
      performance: any;
      usage: any;
      metadata?: any; // Sera stocké dans usage
    }>,
  ): Promise<ProjectStatisticsEntity | null> {
    this.logger.debug(`Partial update for project ${projectId}`);

    try {
      const updateData: any = {};

      // Conversion et nettoyage des données JSON
      if (updates.costs) {
        updateData.costs = this.sanitizeJsonData(updates.costs);
      }
      if (updates.performance) {
        updateData.performance = this.sanitizeJsonData(updates.performance);
      }
      if (updates.usage || updates.metadata) {
        // Fusion usage et metadata (stockage temporaire)
        const usageData: any = { ...updates.usage || {} };
        if (updates.metadata) {
          usageData._metadata = updates.metadata;
        }
        updateData.usage = this.sanitizeJsonData(usageData);
      }

      const result = await this.db.projectStatistics.update({
        where: { projectId },
        data: updateData,
      });

      return this.toEntity(result);

    } catch (error) {
      if (error.code === 'P2025') {
        this.logger.debug(`No statistics found for partial update of project ${projectId}`);
        return null;
      }

      this.logger.error(
        `Failed to partially update statistics for project ${projectId}`,
        error.stack,
      );
      throw new Error(`Partial statistics update failed: ${error.message}`);
    }
  }

  /**
   * Recherche les projets avec des statistiques selon des critères
   * Utilise les capacités de requête JSON de PostgreSQL
   * @param criteria - Critères de recherche sur les données JSON
   * @returns Liste des entités statistiques correspondantes
   */
  async findByCriteria(criteria: {
    minTotalCost?: number;
    maxTotalCost?: number;
    minDocuments?: number;
    maxPerformanceTime?: number;
    sources?: string[];
    dataFreshnessMinutes?: number;
  }): Promise<ProjectStatisticsEntity[]> {
    this.logger.debug('Finding statistics by criteria', criteria);

    try {
      const whereConditions: Prisma.ProjectStatisticsWhereInput[] = [];

      // Filtrage par coût total
      if (criteria.minTotalCost !== undefined) {
        whereConditions.push({
          costs: {
            path: ['total'],
            gte: criteria.minTotalCost,
          } as any,
        });
      }

      if (criteria.maxTotalCost !== undefined) {
        whereConditions.push({
          costs: {
            path: ['total'],
            lte: criteria.maxTotalCost,
          } as any,
        });
      }

      // Filtrage par nombre de documents
      if (criteria.minDocuments !== undefined) {
        whereConditions.push({
          usage: {
            path: ['documentsGenerated'],
            gte: criteria.minDocuments,
          } as any,
        });
      }

      // Filtrage par temps de performance
      if (criteria.maxPerformanceTime !== undefined) {
        whereConditions.push({
          performance: {
            path: ['totalTime'],
            lte: criteria.maxPerformanceTime,
          } as any,
        });
      }

      // Pour les sources, on ne peut pas filtrer sur metadata car le champ n'existe pas dans Prisma
      // Cette fonctionnalité sera ajoutée plus tard quand le schéma sera mis à jour
      if (criteria.sources && criteria.sources.length > 0) {
        this.logger.warn('Source filtering not available - metadata field not in current schema');
      }

      // Filtrage par fraîcheur des données
      if (criteria.dataFreshnessMinutes !== undefined) {
        const cutoffTime = new Date(Date.now() - criteria.dataFreshnessMinutes * 60 * 1000);
        whereConditions.push({
          lastUpdated: {
            gte: cutoffTime,
          },
        });
      }

      const results = await this.db.projectStatistics.findMany({
        where: {
          AND: whereConditions,
        },
        include: {
          project: true,
        },
        orderBy: {
          lastUpdated: 'desc',
        },
      });

      return results.map(result => this.toEntity(result));

    } catch (error) {
      this.logger.error('Failed to find statistics by criteria', error.stack);
      throw new Error(`Statistics search failed: ${error.message}`);
    }
  }

  /**
   * Nettoie les statistiques anciennes selon une politique de rétention
   * @param retentionDays - Nombre de jours de rétention
   * @returns Nombre d'enregistrements supprimés
   */
  async cleanupOldStatistics(retentionDays: number = 90): Promise<number> {
    this.logger.debug(`Cleaning up statistics older than ${retentionDays} days`);

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const result = await this.db.projectStatistics.deleteMany({
        where: {
          lastUpdated: {
            lt: cutoffDate,
          },
          // Seulement pour les projets supprimés ou archivés
          project: {
            status: {
              in: ['DELETED', 'ARCHIVED'],
            },
          },
        },
      });

      this.logger.debug(`Cleaned up ${result.count} old statistics records`);
      return result.count;

    } catch (error) {
      this.logger.error('Failed to cleanup old statistics', error.stack);
      throw new Error(`Statistics cleanup failed: ${error.message}`);
    }
  }

  /**
   * Prépare les données pour l'opération upsert avec fusion intelligente
   * @param existing - Statistiques existantes (si présentes)
   * @param newData - Nouvelles données à fusionner
   * @returns Données préparées pour l'upsert
   */
  private prepareUpsertData(
    existing: ProjectStatisticsEntity | null,
    newData: UpdateStatisticsDto,
  ): {
    costs: any;
    performance: any;
    usage: any;
  } {
    if (!existing) {
      // Création : utilisation directe des nouvelles données
      // Note: metadata sera stocké dans usage pour l'instant
      const usage: any = { ...newData.usage || {} };
      if (newData.metadata) {
        usage._metadata = newData.metadata;
      }
      
      return {
        costs: this.sanitizeJsonData(newData.costs || {}),
        performance: this.sanitizeJsonData(newData.performance || {}),
        usage: this.sanitizeJsonData(usage),
      };
    }

    // Mise à jour : fusion intelligente avec les données existantes
    const entity = new ProjectStatisticsEntity(existing);
    
    if (newData.costs) {
      entity.mergeCosts(newData.costs);
    }
    
    if (newData.performance) {
      entity.mergePerformance(newData.performance);
    }
    
    if (newData.usage) {
      entity.mergeUsage(newData.usage);
    }
    
    if (newData.metadata) {
      entity.updateMetadata(newData.metadata);
    }

    // Stockage temporaire des metadata dans usage
    const usage: any = { ...entity.usage };
    if (entity.metadata) {
      usage._metadata = entity.metadata;
    }

    return {
      costs: this.sanitizeJsonData(entity.costs),
      performance: this.sanitizeJsonData(entity.performance),
      usage: this.sanitizeJsonData(usage),
    };
  }

  /**
   * Sanitise les données pour les rendre compatibles avec Prisma JSON
   * @param data - Données à sanitiser
   * @returns Données sanitisées
   */
  private sanitizeJsonData(data: any): any {
    if (data === null || data === undefined) {
      return {};
    }
    
    // Conversion en objet plain pour éviter les problèmes de prototype
    return JSON.parse(JSON.stringify(data));
  }

  /**
   * Convertit un enregistrement Prisma vers une entité métier
   * @param record - Enregistrement de base de données
   * @returns Entité statistique avec calculs automatiques
   */
  private toEntity(record: any): ProjectStatisticsEntity {
    // Extraction des metadata stockées temporairement dans usage
    const usage = { ...record.usage || {} };
    const metadata = usage._metadata || {};
    delete usage._metadata; // Nettoyage

    const entity = new ProjectStatisticsEntity({
      id: record.id,
      projectId: record.projectId,
      costs: record.costs || {},
      performance: record.performance || {},
      usage: usage,
      metadata: metadata,
      lastUpdated: record.lastUpdated,
      project: record.project,
    });

    // Validation et calcul automatique du score de qualité
    const qualityScore = entity.calculateDataQualityScore();
    
    this.logger.debug(
      `Converted statistics entity for project ${record.projectId}, quality score: ${qualityScore}`,
    );

    return entity;
  }

  /**
   * Obtient des statistiques agrégées sur l'ensemble des projets
   * Utilisé pour les dashboards et analyses globales
   * @returns Métriques globales agrégées
   */
  async getGlobalStatistics(): Promise<{
    totalProjects: number;
    totalCosts: number;
    totalDocuments: number;
    averageQualityScore: number;
    sourceDistribution: Record<string, number>;
  }> {
    this.logger.debug('Computing global statistics');

    try {
      // Utilisation de requêtes SQL brutes pour les agrégations complexes
      const result = await this.db.$queryRaw<Array<{
        total_projects: bigint;
        total_costs: number;
        total_documents: bigint;
        avg_quality_score: number;
      }>>`
        SELECT 
          COUNT(*) as total_projects,
          COALESCE(SUM(CAST(costs->>'total' AS DECIMAL)), 0) as total_costs,
          COALESCE(SUM(CAST(usage->>'documentsGenerated' AS INTEGER)), 0) as total_documents,
          COALESCE(AVG(CAST(usage->'_metadata'->>'qualityScore' AS DECIMAL)), 0) as avg_quality_score
        FROM project_statistics 
        WHERE costs->>'total' IS NOT NULL
      `;

      // Pour l'instant, pas de distribution des sources car metadata n'est pas disponible
      const sourceDistribution: Record<string, number> = {};

      const stats = result[0];

      return {
        totalProjects: Number(stats?.total_projects || 0),
        totalCosts: Number(stats?.total_costs || 0),
        totalDocuments: Number(stats?.total_documents || 0),
        averageQualityScore: Number(stats?.avg_quality_score || 0),
        sourceDistribution: sourceDistribution,
      };

    } catch (error) {
      this.logger.error('Failed to compute global statistics', error.stack);
      throw new Error(`Global statistics computation failed: ${error.message}`);
    }
  }
}