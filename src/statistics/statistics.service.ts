import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { StatisticsRepository } from './statistics.repository';
import { CacheService } from '../cache/cache.service';
import { UpdateStatisticsDto } from './dto/update-statistics.dto';
import { StatisticsResponseDto } from './dto/statistics-response.dto';
import { ProjectStatisticsEntity } from './entities/project-statistics.entity';
import { plainToClass } from 'class-transformer';

/**
 * Service métier pour la gestion des statistiques de projets
 * Orchestre les opérations entre le repository, le cache et la logique métier
 */
@Injectable()
export class StatisticsService {
  private readonly logger = new Logger(StatisticsService.name);

  // Clés de cache pour les statistiques
  private readonly CACHE_KEYS = {
    PROJECT_STATS: (projectId: string) => `stats:project:${projectId}`,
    GLOBAL_STATS: 'stats:global',
    PROJECT_SUMMARY: (projectId: string) => `stats:summary:${projectId}`,
  };

  // TTL du cache en secondes
  private readonly CACHE_TTL = {
    PROJECT_STATS: 300, // 5 minutes
    GLOBAL_STATS: 600,  // 10 minutes
    PROJECT_SUMMARY: 60, // 1 minute
  };

  constructor(
    private readonly statisticsRepository: StatisticsRepository,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Met à jour les statistiques d'un projet
   * Point d'entrée principal pour les services externes
   * @param projectId - Identifiant du projet
   * @param updateDto - Données de statistiques à fusionner
   * @returns Statistiques mises à jour
   */
  async updateStatistics(
    projectId: string,
    updateDto: UpdateStatisticsDto,
  ): Promise<StatisticsResponseDto> {
    this.logger.debug(`Updating statistics for project ${projectId}`);

    try {
      // Validation métier des données reçues
      const validationDto = plainToClass(UpdateStatisticsDto, updateDto);
      const validation = validationDto.isValid();
      if (!validation.valid) {
        this.logger.warn(
          `Invalid statistics data for project ${projectId}: ${validation.errors.join(', ')}`,
        );
        // On continue mais on log les problèmes pour investigation
      }

      // Mise à jour via repository avec fusion intelligente
      const updatedEntity = await this.statisticsRepository.upsert(
        projectId,
        updateDto,
      );

      // Invalidation du cache pour ce projet
      await this.invalidateProjectCache(projectId);

      // Conversion vers DTO de réponse avec enrichissements
      const responseDto = await this.entityToResponseDto(updatedEntity);

      // Mise en cache des nouvelles statistiques
      await this.cacheProjectStatistics(projectId, responseDto);

      // Log des métriques importantes pour monitoring
      this.logStatisticsMetrics(projectId, responseDto, 'updated');

      this.logger.debug(`Statistics updated successfully for project ${projectId}`);
      
      return responseDto;

    } catch (error) {
      this.logger.error(
        `Failed to update statistics for project ${projectId}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Récupère les statistiques d'un projet
   * @param projectId - Identifiant du projet
   * @returns Statistiques du projet ou null si non trouvées
   */
  async getStatistics(projectId: string): Promise<StatisticsResponseDto | null> {
    this.logger.debug(`Getting statistics for project ${projectId}`);

    try {
      // Tentative de récupération depuis le cache
      const cached = await this.getCachedProjectStatistics(projectId);
      if (cached) {
        this.logger.debug(`Statistics found in cache for project ${projectId}`);
        return cached;
      }

      // Récupération depuis la base de données
      const entity = await this.statisticsRepository.findByProjectId(projectId);
      if (!entity) {
        this.logger.debug(`No statistics found for project ${projectId}`);
        return null;
      }

      // Conversion vers DTO de réponse
      const responseDto = await this.entityToResponseDto(entity);

      // Mise en cache pour les prochaines consultations
      await this.cacheProjectStatistics(projectId, responseDto);

      this.logger.debug(`Statistics retrieved from database for project ${projectId}`);
      
      return responseDto;

    } catch (error) {
      this.logger.error(
        `Failed to get statistics for project ${projectId}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Supprime les statistiques d'un projet
   * @param projectId - Identifiant du projet
   * @returns true si suppression réussie
   */
  async deleteStatistics(projectId: string): Promise<boolean> {
    this.logger.debug(`Deleting statistics for project ${projectId}`);

    try {
      // Suppression depuis la base de données
      const deleted = await this.statisticsRepository.deleteByProjectId(projectId);

      if (deleted) {
        // Invalidation du cache
        await this.invalidateProjectCache(projectId);
        
        this.logger.debug(`Statistics deleted for project ${projectId}`);
      } else {
        this.logger.debug(`No statistics to delete for project ${projectId}`);
      }

      return deleted;

    } catch (error) {
      this.logger.error(
        `Failed to delete statistics for project ${projectId}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Récupère les statistiques de multiples projets
   * Optimisé pour les consultations en lot
   * @param projectIds - Liste des identifiants de projets
   * @returns Map des statistiques par projectId
   */
  async getMultipleStatistics(
    projectIds: string[],
  ): Promise<Map<string, StatisticsResponseDto>> {
    this.logger.debug(`Getting statistics for ${projectIds.length} projects`);

    if (projectIds.length === 0) {
      return new Map();
    }

    try {
      const result = new Map<string, StatisticsResponseDto>();
      const uncachedProjectIds: string[] = [];

      // Tentative de récupération depuis le cache pour chaque projet
      for (const projectId of projectIds) {
        const cached = await this.getCachedProjectStatistics(projectId);
        if (cached) {
          result.set(projectId, cached);
        } else {
          uncachedProjectIds.push(projectId);
        }
      }

      // Récupération des projets non mis en cache depuis la base
      if (uncachedProjectIds.length > 0) {
        const entities = await this.statisticsRepository.findManyByProjectIds(
          uncachedProjectIds,
        );

        // Conversion et mise en cache
        for (const [projectId, entity] of entities) {
          const responseDto = await this.entityToResponseDto(entity);
          result.set(projectId, responseDto);
          
          // Mise en cache asynchrone pour les futures consultations
          this.cacheProjectStatistics(projectId, responseDto).catch(error => {
            this.logger.warn(`Failed to cache statistics for project ${projectId}`, error);
          });
        }
      }

      this.logger.debug(
        `Retrieved statistics for ${result.size}/${projectIds.length} projects`,
      );
      
      return result;

    } catch (error) {
      this.logger.error('Failed to get multiple statistics', error.stack);
      throw error;
    }
  }

  /**
   * Obtient des statistiques globales agrégées
   * @returns Métriques globales de la plateforme
   */
  async getGlobalStatistics(): Promise<{
    totalProjects: number;
    totalCosts: number;
    totalDocuments: number;
    averageQualityScore: number;
    sourceDistribution: Record<string, number>;
  }> {
    this.logger.debug('Getting global statistics');

    try {
      // Tentative de récupération depuis le cache
      const cached = await this.cacheService.get<any>(this.CACHE_KEYS.GLOBAL_STATS);
      if (cached) {
        this.logger.debug('Global statistics found in cache');
        return cached;
      }

      // Calcul depuis la base de données
      const globalStats = await this.statisticsRepository.getGlobalStatistics();

      // Mise en cache des statistiques globales
      await this.cacheService.set(
        this.CACHE_KEYS.GLOBAL_STATS,
        globalStats,
        this.CACHE_TTL.GLOBAL_STATS,
      );

      this.logger.debug('Global statistics computed and cached');
      
      return globalStats;

    } catch (error) {
      this.logger.error('Failed to get global statistics', error.stack);
      throw error;
    }
  }

  /**
   * Recherche les projets selon des critères de statistiques
   * @param criteria - Critères de recherche
   * @returns Liste des statistiques correspondantes
   */
  async searchStatistics(criteria: {
    minTotalCost?: number;
    maxTotalCost?: number;
    minDocuments?: number;
    maxPerformanceTime?: number;
    dataFreshnessMinutes?: number;
  }): Promise<StatisticsResponseDto[]> {
    this.logger.debug('Searching statistics with criteria', criteria);

    try {
      const entities = await this.statisticsRepository.findByCriteria(criteria);
      
      const results: StatisticsResponseDto[] = [];
      for (const entity of entities) {
        const responseDto = await this.entityToResponseDto(entity);
        results.push(responseDto);
      }

      this.logger.debug(`Found ${results.length} statistics matching criteria`);
      
      return results;

    } catch (error) {
      this.logger.error('Failed to search statistics', error.stack);
      throw error;
    }
  }

  /**
   * Met à jour partiellement les statistiques (pour optimisation)
   * @param projectId - Identifiant du projet
   * @param partialData - Données partielles à mettre à jour
   * @returns Statistiques mises à jour ou null si projet non trouvé
   */
  async partialUpdateStatistics(
    projectId: string,
    partialData: Partial<{
      costs: any;
      performance: any;
      usage: any;
    }>,
  ): Promise<StatisticsResponseDto | null> {
    this.logger.debug(`Partial update for project ${projectId}`);

    try {
      const updatedEntity = await this.statisticsRepository.partialUpdate(
        projectId,
        partialData,
      );

      if (!updatedEntity) {
        return null;
      }

      // Invalidation du cache
      await this.invalidateProjectCache(projectId);

      // Conversion vers DTO de réponse
      const responseDto = await this.entityToResponseDto(updatedEntity);

      // Mise en cache
      await this.cacheProjectStatistics(projectId, responseDto);

      return responseDto;

    } catch (error) {
      this.logger.error(
        `Failed to partially update statistics for project ${projectId}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Nettoie les statistiques anciennes
   * @param retentionDays - Nombre de jours de rétention
   * @returns Nombre d'enregistrements supprimés
   */
  async cleanupOldStatistics(retentionDays: number = 90): Promise<number> {
    this.logger.debug(`Cleaning up statistics older than ${retentionDays} days`);

    try {
      const deletedCount = await this.statisticsRepository.cleanupOldStatistics(
        retentionDays,
      );

      // Invalidation du cache global si des suppressions ont eu lieu
      if (deletedCount > 0) {
        await this.cacheService.del(this.CACHE_KEYS.GLOBAL_STATS);
      }

      this.logger.debug(`Cleaned up ${deletedCount} old statistics records`);
      
      return deletedCount;

    } catch (error) {
      this.logger.error('Failed to cleanup old statistics', error.stack);
      throw error;
    }
  }

  /**
   * Convertit une entité vers un DTO de réponse avec enrichissements
   * @param entity - Entité statistique
   * @returns DTO de réponse enrichi
   */
  private async entityToResponseDto(
    entity: ProjectStatisticsEntity,
  ): Promise<StatisticsResponseDto> {
    // Calculs et enrichissements automatiques
    const globalEfficiency = this.calculateGlobalEfficiency(entity);
    const recommendations = this.generateRecommendations(entity);
    const overallStatus = this.determineOverallStatus(globalEfficiency);

    // Construction du DTO de réponse
    const responseDto = plainToInstance(StatisticsResponseDto, {
      costs: {
        ...entity.costs,
        costPerDocument: this.calculateCostPerDocument(entity),
        costPerHour: this.calculateCostPerHour(entity),
        breakdown: this.calculateCostBreakdown(entity.costs),
        trend: this.determineCostTrend(entity),
      },
      performance: {
        ...entity.performance,
        averageDocumentTime: this.calculateAverageDocumentTime(entity),
        efficiency: this.calculatePerformanceEfficiency(entity),
        bottlenecks: this.identifyBottlenecks(entity.performance),
        benchmark: this.determineBenchmark(entity),
      },
      usage: {
        ...entity.usage,
        tokensPerDocument: this.calculateTokensPerDocument(entity),
        storageEfficiency: this.calculateStorageEfficiency(entity),
        activityPattern: this.analyzeActivityPattern(entity),
        resourceIntensity: this.determineResourceIntensity(entity),
      },
      summary: {
        totalCost: this.formatCurrency(entity.costs.total || 0),
        totalTime: StatisticsResponseDto.formatDuration(entity.performance.totalTime || 0),
        efficiency: globalEfficiency,
        status: overallStatus,
        keyMetrics: this.generateKeyMetrics(entity),
        recommendations: recommendations,
      },
      metadata: {
        lastUpdated: entity.lastUpdated,
        dataFreshness: this.calculateDataFreshness(entity.lastUpdated),
        completeness: this.calculateDataCompleteness(entity),
        sources: this.extractSources(entity),
        version: '1.0.0',
        generatedAt: new Date(),
        missingFields: this.identifyMissingFields(entity),
        estimatedFields: this.identifyEstimatedFields(entity),
      },
    });

    return responseDto;
  }

  /**
   * Méthodes utilitaires pour les calculs d'enrichissement
   */

  private calculateGlobalEfficiency(entity: ProjectStatisticsEntity): number {
    const costEfficiency = this.calculateCostEfficiency(entity);
    const performanceEfficiency = this.calculatePerformanceEfficiencyScore(entity);
    const usageEfficiency = this.calculateUsageEfficiency(entity);

    return (costEfficiency + performanceEfficiency + usageEfficiency) / 3;
  }

  private calculateCostEfficiency(entity: ProjectStatisticsEntity): number {
    const costPerDoc = this.calculateCostPerDocument(entity);
    if (!costPerDoc || entity.usage.documentsGenerated === 0) {
      return 50; // Score neutre si pas de données
    }

    // Benchmarks indicatifs (à ajuster selon les données réelles)
    const benchmarkCostPerDoc = 5.0;
    const ratio = benchmarkCostPerDoc / costPerDoc;
    
    return Math.min(100, Math.max(0, ratio * 100));
  }

  private calculatePerformanceEfficiencyScore(entity: ProjectStatisticsEntity): number {
    const totalTime = entity.performance.totalTime || 0;
    const docs = entity.usage.documentsGenerated || 0;
    
    if (totalTime === 0 || docs === 0) {
      return 50; // Score neutre
    }

    const timePerDoc = totalTime / docs;
    // Benchmark : moins de 2 minutes par document = 100%
    const benchmark = 120; // 2 minutes en secondes
    const ratio = benchmark / timePerDoc;
    
    return Math.min(100, Math.max(0, ratio * 100));
  }

  private calculateUsageEfficiency(entity: ProjectStatisticsEntity): number {
    const tokensPerDoc = this.calculateTokensPerDocument(entity);
    if (!tokensPerDoc || entity.usage.documentsGenerated === 0) {
      return 50; // Score neutre
    }

    // Benchmark indicatif tokens par document
    const benchmarkTokensPerDoc = 3000;
    const ratio = benchmarkTokensPerDoc / tokensPerDoc;
    
    return Math.min(100, Math.max(0, ratio * 100));
  }

  private generateRecommendations(entity: ProjectStatisticsEntity): string[] {
    const recommendations: string[] = [];

    // Recommandations basées sur les coûts
    const costPerDoc = this.calculateCostPerDocument(entity);
    if (costPerDoc && costPerDoc > 5.0) {
      recommendations.push('Consider optimizing prompt length to reduce API costs');
    }

    const breakdown = this.calculateCostBreakdown(entity.costs);
    if (breakdown.claudeApiPercentage > 80) {
      recommendations.push('API costs are high - review prompt efficiency');
    }

    // Recommandations basées sur la performance
    const processingEff = this.calculateProcessingEfficiency(entity.performance);
    if (processingEff < 70) {
      recommendations.push('File processing could be optimized for better performance');
    }

    const bottlenecks = this.identifyBottlenecks(entity.performance);
    if (bottlenecks.includes('queue_wait')) {
      recommendations.push('Consider upgrading to reduce queue wait times');
    }

    // Recommandations basées sur l'usage
    const tokensPerDoc = this.calculateTokensPerDocument(entity);
    if (tokensPerDoc && tokensPerDoc > 4000) {
      recommendations.push('Document generation uses many tokens - consider template optimization');
    }

    if ((entity.usage.exportCount || 0) === 0) {
      recommendations.push("Generated documents haven't been exported yet");
    }

    return recommendations;
  }

  private determineOverallStatus(efficiency: number): 'optimal' | 'good' | 'needs_attention' {
    if (efficiency >= 90) return 'optimal';
    if (efficiency >= 70) return 'good';
    return 'needs_attention';
  }

  private calculateCostPerDocument(entity: ProjectStatisticsEntity): number | undefined {
    const total = entity.costs.total;
    const docs = entity.usage.documentsGenerated;
    return (total && docs && docs > 0) ? total / docs : undefined;
  }

  private calculateCostPerHour(entity: ProjectStatisticsEntity): number | undefined {
    const total = entity.costs.total;
    const time = entity.performance.totalTime;
    return (total && time && time > 0) ? total / (time / 3600) : undefined;
  }

  private calculateCostBreakdown(costs: any): any {
    const total = costs.total || 0;
    if (total === 0) {
      return {
        claudeApiPercentage: 0,
        storagePercentage: 0,
        computePercentage: 0,
        bandwidthPercentage: 0,
      };
    }

    return {
      claudeApiPercentage: ((costs.claudeApi || 0) / total) * 100,
      storagePercentage: ((costs.storage || 0) / total) * 100,
      computePercentage: ((costs.compute || 0) / total) * 100,
      bandwidthPercentage: ((costs.bandwidth || 0) / total) * 100,
    };
  }

  private determineCostTrend(entity: ProjectStatisticsEntity): 'increasing' | 'decreasing' | 'stable' {
    // Logique simplifiée - dans un vrai système, on comparerait avec l'historique
    return 'stable';
  }

  private calculateAverageDocumentTime(entity: ProjectStatisticsEntity): number | undefined {
    const totalTime = entity.performance.totalTime;
    const docs = entity.usage.documentsGenerated;
    return (totalTime && docs && docs > 0) ? totalTime / docs : undefined;
  }

  private calculatePerformanceEfficiency(entity: ProjectStatisticsEntity): any {
    const performance = entity.performance;
    const usage = entity.usage;
    const totalTime = performance.totalTime || 0;

    return {
      documentsPerHour: (usage.documentsGenerated && totalTime > 0) 
        ? (usage.documentsGenerated / (totalTime / 3600)) : 0,
      tokensPerSecond: (usage.tokensUsed && totalTime > 0) 
        ? (usage.tokensUsed / totalTime) : 0,
      processingEfficiency: this.calculateProcessingEfficiency(performance),
      resourceUtilization: this.calculateResourceUtilization(entity),
    };
  }

  private calculateProcessingEfficiency(performance: any): number {
    const totalTime = performance.totalTime || 0;
    const waitTime = performance.queueWaitTime || 0;
    const activeTime = totalTime - waitTime;
    return totalTime > 0 ? (activeTime / totalTime) * 100 : 0;
  }

  private calculateResourceUtilization(entity: ProjectStatisticsEntity): number {
    // Score basé sur l'utilisation des ressources vs recommandations
    let score = 50; // Score de base
    
    const docs = entity.usage.documentsGenerated || 0;
    const tokens = entity.usage.tokensUsed || 0;
    
    if (docs > 0) score += 20;
    if (tokens > 5000) score += 15;
    if (tokens > 10000) score += 15;
    
    return Math.min(100, score);
  }

  private identifyBottlenecks(performance: any): string[] {
    const bottlenecks: string[] = [];
    
    if ((performance.queueWaitTime || 0) > 10) {
      bottlenecks.push('queue_wait');
    }
    if ((performance.interviewTime || 0) > 300) {
      bottlenecks.push('interview');
    }
    if ((performance.generationTime || 0) > 120) {
      bottlenecks.push('generation');
    }
    
    return bottlenecks;
  }

  private determineBenchmark(entity: ProjectStatisticsEntity): 'faster' | 'average' | 'slower' {
    const totalTime = entity.performance.totalTime || 0;
    const docs = entity.usage.documentsGenerated || 1;
    const timePerDoc = totalTime / docs;
    
    if (timePerDoc < 60) return 'faster';      // Moins d'1 minute par doc
    if (timePerDoc < 120) return 'average';    // 1-2 minutes par doc
    return 'slower';                           // Plus de 2 minutes par doc
  }

  private calculateTokensPerDocument(entity: ProjectStatisticsEntity): number | undefined {
    const tokens = entity.usage.tokensUsed;
    const docs = entity.usage.documentsGenerated;
    return (tokens && docs && docs > 0) ? Math.round(tokens / docs) : undefined;
  }

  private calculateStorageEfficiency(entity: ProjectStatisticsEntity): number {
    const storage = entity.usage.storageSize || 0;
    const docs = entity.usage.documentsGenerated || 1;
    return storage / docs;
  }

  private analyzeActivityPattern(entity: ProjectStatisticsEntity): any {
    // Analyse simplifiée - dans un vrai système, on analyserait l'historique
    return {
      usageFrequency: 'occasional',
      preferredFormats: ['markdown', 'pdf'],
      averageSessionDuration: entity.performance.totalTime || 0,
    };
  }

  private determineResourceIntensity(entity: ProjectStatisticsEntity): 'light' | 'moderate' | 'intensive' {
    const tokens = entity.usage.tokensUsed || 0;
    const docs = entity.usage.documentsGenerated || 0;
    
    if (tokens > 15000 || docs > 8) return 'intensive';
    if (tokens > 5000 || docs > 3) return 'moderate';
    return 'light';
  }

  private generateKeyMetrics(entity: ProjectStatisticsEntity): any[] {
    const metrics = [];
    
    if (entity.costs.total) {
      metrics.push({
        name: 'Total Cost',
        value: entity.costs.total.toFixed(2),
        unit: 'USD',
        status: entity.costs.total < 10 ? 'good' : 'warning',
      });
    }
    
    if (entity.performance.totalTime) {
      metrics.push({
        name: 'Total Time',
        value: Math.round(entity.performance.totalTime / 60).toString(),
        unit: 'min',
        status: entity.performance.totalTime < 600 ? 'good' : 'warning',
      });
    }
    
    return metrics;
  }

  private calculateDataFreshness(lastUpdated: Date): number {
    const now = new Date();
    const diffMs = now.getTime() - lastUpdated.getTime();
    return Math.round(diffMs / (1000 * 60)); // En minutes
  }

  private calculateDataCompleteness(entity: ProjectStatisticsEntity): number {
    let score = 0;
    let maxScore = 0;
    
    // Vérification des champs essentiels
    const checks = [
      { field: entity.costs.total, weight: 25 },
      { field: entity.performance.totalTime, weight: 25 },
      { field: entity.usage.documentsGenerated, weight: 25 },
      { field: entity.usage.tokensUsed, weight: 15 },
      { field: entity.costs.claudeApi, weight: 10 },
    ];
    
    checks.forEach(check => {
      maxScore += check.weight;
      if (check.field !== undefined && check.field !== null) {
        score += check.weight;
      }
    });
    
    return maxScore > 0 ? (score / maxScore) * 100 : 0;
  }

  private extractSources(entity: ProjectStatisticsEntity): string[] {
    const metadata = entity.metadata || {};
    return metadata.sources || [];
  }

  private identifyMissingFields(entity: ProjectStatisticsEntity): string[] {
    const missing = [];
    
    if (!entity.costs.total) missing.push('costs.total');
    if (!entity.performance.totalTime) missing.push('performance.totalTime');
    if (!entity.usage.documentsGenerated) missing.push('usage.documentsGenerated');
    
    return missing;
  }

  private identifyEstimatedFields(entity: ProjectStatisticsEntity): string[] {
    const estimated = [];
    
    // Les champs calculés sont considérés comme estimés
    if (entity.costs.total && !entity.costs.breakdown) {
      estimated.push('costs.breakdown');
    }
    
    return estimated;
  }

  private formatCurrency(amount: number): string {
    return `$${amount.toFixed(2)}`;
  }

  /**
   * Méthodes de gestion du cache
   */

  private async getCachedProjectStatistics(projectId: string): Promise<StatisticsResponseDto | null> {
    try {
      return await this.cacheService.get<StatisticsResponseDto>(
        this.CACHE_KEYS.PROJECT_STATS(projectId),
      );
    } catch (error) {
      this.logger.warn(`Failed to get cached statistics for project ${projectId}`, error);
      return null;
    }
  }

  private async cacheProjectStatistics(
    projectId: string,
    statistics: StatisticsResponseDto,
  ): Promise<void> {
    try {
      await this.cacheService.set(
        this.CACHE_KEYS.PROJECT_STATS(projectId),
        statistics,
        this.CACHE_TTL.PROJECT_STATS,
      );
    } catch (error) {
      this.logger.warn(`Failed to cache statistics for project ${projectId}`, error);
    }
  }

  private async invalidateProjectCache(projectId: string): Promise<void> {
    try {
      await Promise.all([
        this.cacheService.del(this.CACHE_KEYS.PROJECT_STATS(projectId)),
        this.cacheService.del(this.CACHE_KEYS.PROJECT_SUMMARY(projectId)),
        this.cacheService.del(this.CACHE_KEYS.GLOBAL_STATS), // Invalidation globale aussi
      ]);
    } catch (error) {
      this.logger.warn(`Failed to invalidate cache for project ${projectId}`, error);
    }
  }

  /**
   * Logging et monitoring
   */

  private logStatisticsMetrics(
    projectId: string,
    statistics: StatisticsResponseDto,
    operation: string,
  ): void {
    this.logger.debug(
      `Statistics ${operation} - Project: ${projectId}, ` +
      `Cost: ${statistics.costs.total}, ` +
      `Documents: ${statistics.usage.documentsGenerated}, ` +
      `Efficiency: ${statistics.summary.efficiency}%`,
    );
  }
}