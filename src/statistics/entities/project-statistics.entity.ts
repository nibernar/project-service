import { ProjectEntity } from '../../project/entities/project.entity';

/**
 * Interface pour les données de coûts stockées en JSON
 */
export interface CostsData {
  claudeApi?: number;
  storage?: number;
  compute?: number;
  bandwidth?: number;
  total?: number;
  currency?: string;
  costPerDocument?: number;
  costPerHour?: number;
  trend?: 'increasing' | 'decreasing' | 'stable';
  breakdown?: {
    claudeApiPercentage: number;
    storagePercentage: number;
    computePercentage: number;
    bandwidthPercentage: number;
  };
}

/**
 * Interface pour les données de performance stockées en JSON
 */
export interface PerformanceData {
  generationTime?: number;
  processingTime?: number;
  interviewTime?: number;
  exportTime?: number;
  totalTime?: number;
  queueWaitTime?: number;
  averageDocumentTime?: number;
  efficiency?: {
    documentsPerHour?: number;
    tokensPerSecond?: number;
    processingEfficiency?: number;
    resourceUtilization?: number;
  };
  bottlenecks?: string[];
  benchmark?: 'faster' | 'average' | 'slower';
}

/**
 * Interface pour les données d'utilisation stockées en JSON
 */
export interface UsageData {
  documentsGenerated?: number;
  filesProcessed?: number;
  tokensUsed?: number;
  apiCallsCount?: number;
  storageSize?: number;
  exportCount?: number;
  tokensPerDocument?: number;
  storageEfficiency?: number;
  activityPattern?: {
    peakUsageHour?: number;
    usageFrequency?: 'daily' | 'weekly' | 'occasional';
    preferredFormats?: string[];
    averageSessionDuration?: number;
  };
  resourceIntensity?: 'light' | 'moderate' | 'intensive';
}

/**
 * Interface pour les métadonnées des statistiques stockées en JSON
 */
export interface StatisticsMetadata {
  sources?: string[];
  version?: string;
  batchId?: string;
  confidence?: number;
  dataFreshness?: number;
  completeness?: number;
  missingFields?: string[];
  estimatedFields?: string[];
  qualityScore?: number;
}

/**
 * Entité représentant les statistiques d'un projet en base de données
 * Correspond au modèle Prisma ProjectStatistics
 */
export class ProjectStatisticsEntity {
  /**
   * Identifiant unique de l'enregistrement statistique
   */
  id: string;

  /**
   * Identifiant du projet associé (relation 1:1)
   */
  projectId: string;

  /**
   * Données de coûts stockées en JSON
   * Structure flexible permettant l'évolution sans migration de schéma
   */
  costs: CostsData;

  /**
   * Données de performance stockées en JSON
   * Inclut les temps de traitement et métriques d'efficacité
   */
  performance: PerformanceData;

  /**
   * Données d'utilisation stockées en JSON
   * Métriques fonctionnelles et patterns d'activité
   */
  usage: UsageData;

  /**
   * Métadonnées des statistiques
   * Informations sur la qualité, les sources et la fraîcheur des données
   */
  metadata?: StatisticsMetadata;

  /**
   * Timestamp de dernière mise à jour (géré automatiquement par Prisma)
   */
  lastUpdated: Date;

  /**
   * Relation optionnelle vers l'entité Project
   * Utilisée pour les requêtes avec jointures
   */
  project?: ProjectEntity;

  /**
   * Constructeur pour créer une nouvelle instance d'entité statistique
   * @param data - Données partielles pour initialiser l'entité
   */
  constructor(data?: Partial<ProjectStatisticsEntity>) {
    if (data) {
      Object.assign(this, data);
    }

    // Initialisation des objets JSON avec des valeurs par défaut
    this.costs = this.costs || {};
    this.performance = this.performance || {};
    this.usage = this.usage || {};
    this.metadata = this.metadata || {};
  }

  /**
   * Fusionne les nouvelles données de coûts avec les existantes
   * @param newCosts - Nouvelles données de coûts à fusionner
   */
  mergeCosts(newCosts: Partial<CostsData>): void {
    this.costs = {
      ...this.costs,
      ...newCosts,
    };

    // Recalcul automatique du total si les composants sont fournis
    this.recalculateCostTotal();
    this.recalculateCostBreakdown();
  }

  /**
   * Fusionne les nouvelles données de performance avec les existantes
   * @param newPerformance - Nouvelles données de performance à fusionner
   */
  mergePerformance(newPerformance: Partial<PerformanceData>): void {
    this.performance = {
      ...this.performance,
      ...newPerformance,
      // Fusion profonde pour l'objet efficiency avec gestion des valeurs undefined
      efficiency: this.performance.efficiency || newPerformance.efficiency ? {
        ...this.performance.efficiency,
        ...newPerformance.efficiency,
      } : undefined,
    };

    // Recalcul automatique du temps total si les composants sont fournis
    this.recalculatePerformanceTotal();
    this.identifyBottlenecks();
  }

  /**
   * Fusionne les nouvelles données d'utilisation avec les existantes
   * @param newUsage - Nouvelles données d'utilisation à fusionner
   */
  mergeUsage(newUsage: Partial<UsageData>): void {
    this.usage = {
      ...this.usage,
      ...newUsage,
      // Fusion profonde pour l'objet activityPattern avec gestion des valeurs undefined
      activityPattern: this.usage.activityPattern || newUsage.activityPattern ? {
        ...this.usage.activityPattern,
        ...newUsage.activityPattern,
      } : undefined,
    };

    // Calculs automatiques des métriques dérivées
    this.calculateDerivedUsageMetrics();
  }

  /**
   * Met à jour les métadonnées avec de nouvelles informations
   * @param newMetadata - Nouvelles métadonnées à fusionner
   */
  updateMetadata(newMetadata: Partial<StatisticsMetadata>): void {
    this.metadata = {
      ...this.metadata,
      ...newMetadata,
    };

    // Mise à jour automatique de la fraîcheur des données
    this.metadata.dataFreshness = 0; // Fraîchement mis à jour
  }

  /**
   * Recalcule le coût total basé sur les composants individuels
   */
  private recalculateCostTotal(): void {
    const components = [
      this.costs.claudeApi || 0,
      this.costs.storage || 0,
      this.costs.compute || 0,
      this.costs.bandwidth || 0,
    ];

    this.costs.total = components.reduce((sum, cost) => sum + cost, 0);
  }

  /**
   * Recalcule la répartition des coûts en pourcentages
   */
  private recalculateCostBreakdown(): void {
    const total = this.costs.total || 0;
    
    if (total > 0) {
      this.costs.breakdown = {
        claudeApiPercentage: ((this.costs.claudeApi || 0) / total) * 100,
        storagePercentage: ((this.costs.storage || 0) / total) * 100,
        computePercentage: ((this.costs.compute || 0) / total) * 100,
        bandwidthPercentage: ((this.costs.bandwidth || 0) / total) * 100,
      };
    }
  }

  /**
   * Recalcule le temps total basé sur les composants individuels
   */
  private recalculatePerformanceTotal(): void {
    const components = [
      this.performance.generationTime || 0,
      this.performance.processingTime || 0,
      this.performance.interviewTime || 0,
      this.performance.exportTime || 0,
      this.performance.queueWaitTime || 0,
    ];

    this.performance.totalTime = components.reduce((sum, time) => sum + time, 0);
  }

  /**
   * Identifie automatiquement les goulots d'étranglement de performance
   */
  private identifyBottlenecks(): void {
    const bottlenecks: string[] = [];
    const times = this.performance;

    // Seuils pour identifier les goulots d'étranglement
    const thresholds = {
      generation: 60, // Plus de 1 minute
      processing: 30, // Plus de 30 secondes
      interview: 300, // Plus de 5 minutes
      export: 20, // Plus de 20 secondes
      queueWait: 10, // Plus de 10 secondes
    };

    if ((times.generationTime || 0) > thresholds.generation) {
      bottlenecks.push('generation');
    }
    if ((times.processingTime || 0) > thresholds.processing) {
      bottlenecks.push('processing');
    }
    if ((times.interviewTime || 0) > thresholds.interview) {
      bottlenecks.push('interview');
    }
    if ((times.exportTime || 0) > thresholds.export) {
      bottlenecks.push('export');
    }
    if ((times.queueWaitTime || 0) > thresholds.queueWait) {
      bottlenecks.push('queue_wait');
    }

    this.performance.bottlenecks = bottlenecks;
  }

  /**
   * Calcule les métriques dérivées d'utilisation
   */
  private calculateDerivedUsageMetrics(): void {
    const usage = this.usage;

    // Calcul des tokens par document
    if (usage.tokensUsed && usage.documentsGenerated && usage.documentsGenerated > 0) {
      usage.tokensPerDocument = Math.round(usage.tokensUsed / usage.documentsGenerated);
    }

    // Calcul de l'efficacité de stockage (bytes par document)
    if (usage.storageSize && usage.documentsGenerated && usage.documentsGenerated > 0) {
      usage.storageEfficiency = usage.storageSize / usage.documentsGenerated;
    }

    // Détermination de l'intensité des ressources
    usage.resourceIntensity = this.determineResourceIntensity();
  }

  /**
   * Détermine l'intensité d'usage des ressources
   */
  private determineResourceIntensity(): 'light' | 'moderate' | 'intensive' {
    const usage = this.usage;
    
    // Score basé sur plusieurs facteurs
    let intensityScore = 0;
    
    if ((usage.tokensUsed || 0) > 10000) intensityScore += 1;
    if ((usage.documentsGenerated || 0) > 5) intensityScore += 1;
    if ((usage.storageSize || 0) > 10 * 1024 * 1024) intensityScore += 1; // 10MB
    if ((usage.apiCallsCount || 0) > 20) intensityScore += 1;

    if (intensityScore >= 3) return 'intensive';
    if (intensityScore >= 1) return 'moderate';
    return 'light';
  }

  /**
   * Vérifie si les statistiques sont complètes et cohérentes
   */
  validateConsistency(): { valid: boolean; issues: string[] } {
    const issues: string[] = [];

    // Validation des coûts
    if (this.costs.total && this.costs.total < 0) {
      issues.push('Total cost cannot be negative');
    }

    // Validation des temps
    if (this.performance.totalTime && this.performance.totalTime < 0) {
      issues.push('Total time cannot be negative');
    }

    // Validation de cohérence usage
    if (
      this.usage.documentsGenerated &&
      this.usage.exportCount &&
      this.usage.exportCount > this.usage.documentsGenerated
    ) {
      issues.push('Export count cannot exceed documents generated');
    }

    // Validation de cohérence costs/usage
    if (
      this.costs.costPerDocument &&
      this.usage.documentsGenerated &&
      this.usage.documentsGenerated > 0 &&
      this.costs.total
    ) {
      const expectedCostPerDoc = this.costs.total / this.usage.documentsGenerated;
      const tolerance = 0.01;
      
      if (Math.abs(this.costs.costPerDocument - expectedCostPerDoc) > tolerance) {
        issues.push('Cost per document is inconsistent with total cost and document count');
      }
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }

  /**
   * Calcule un score de qualité des données (0-100)
   */
  calculateDataQualityScore(): number {
    let score = 100;
    const deductions = [];

    // Vérification de la complétude des données essentielles
    if (!this.costs.total && !this.costs.claudeApi) {
      score -= 20;
      deductions.push('Missing essential cost data');
    }

    if (!this.performance.totalTime && !this.performance.generationTime) {
      score -= 20;
      deductions.push('Missing essential performance data');
    }

    if (!this.usage.documentsGenerated) {
      score -= 15;
      deductions.push('Missing document generation count');
    }

    // Vérification de la cohérence
    const consistency = this.validateConsistency();
    if (!consistency.valid) {
      score -= consistency.issues.length * 10;
      deductions.push(...consistency.issues);
    }

    // Vérification de la fraîcheur (si métadonnées disponibles)
    if (this.metadata?.dataFreshness && this.metadata.dataFreshness > 60) {
      score -= Math.min(20, this.metadata.dataFreshness / 60 * 5);
      deductions.push('Data is not fresh');
    }

    // Mise à jour du score dans les métadonnées
    if (this.metadata) {
      this.metadata.qualityScore = Math.max(0, score);
    }

    return Math.max(0, score);
  }

  /**
   * Convertit l'entité vers un format JSON sérialisable
   * Utile pour le stockage ou l'export
   */
  toJSON(): Record<string, any> {
    return {
      id: this.id,
      projectId: this.projectId,
      costs: this.costs,
      performance: this.performance,
      usage: this.usage,
      metadata: this.metadata,
      lastUpdated: this.lastUpdated,
    };
  }

  /**
   * Crée une instance d'entité à partir de données JSON
   * @param json - Données JSON à désérialiser
   */
  static fromJSON(json: Record<string, any>): ProjectStatisticsEntity {
    const entity = new ProjectStatisticsEntity();
    
    entity.id = json.id;
    entity.projectId = json.projectId;
    entity.costs = json.costs || {};
    entity.performance = json.performance || {};
    entity.usage = json.usage || {};
    entity.metadata = json.metadata || {};
    entity.lastUpdated = json.lastUpdated ? new Date(json.lastUpdated) : new Date();

    return entity;
  }
}