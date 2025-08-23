import { Expose, Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO pour la répartition des coûts en pourcentages
 */
export class CostBreakdownDto {
  @ApiProperty({
    description: 'Pourcentage du coût API Claude',
    example: 65.2,
    minimum: 0,
    maximum: 100,
  })
  @Expose()
  claudeApiPercentage: number;

  @ApiProperty({
    description: 'Pourcentage du coût de stockage',
    example: 15.3,
    minimum: 0,
    maximum: 100,
  })
  @Expose()
  storagePercentage: number;

  @ApiProperty({
    description: 'Pourcentage du coût de calcul',
    example: 18.1,
    minimum: 0,
    maximum: 100,
  })
  @Expose()
  computePercentage: number;

  @ApiProperty({
    description: 'Pourcentage du coût de bande passante',
    example: 1.4,
    minimum: 0,
    maximum: 100,
  })
  @Expose()
  bandwidthPercentage: number;
}

/**
 * DTO pour les statistiques de coûts en réponse
 */
export class CostsStatisticsResponseDto {
  @ApiProperty({
    description: 'Coût des appels API Claude en USD',
    example: 12.45,
    minimum: 0,
  })
  @Expose()
  claudeApi: number;

  @ApiProperty({
    description: 'Coût de stockage des fichiers en USD',
    example: 2.30,
    minimum: 0,
  })
  @Expose()
  storage: number;

  @ApiProperty({
    description: 'Coût des ressources de calcul en USD',
    example: 5.67,
    minimum: 0,
  })
  @Expose()
  compute: number;

  @ApiProperty({
    description: 'Coût de la bande passante en USD',
    example: 1.23,
    minimum: 0,
  })
  @Expose()
  bandwidth: number;

  @ApiProperty({
    description: 'Coût total calculé en USD',
    example: 21.65,
    minimum: 0,
  })
  @Expose()
  total: number;

  @ApiProperty({
    description: 'Devise des montants selon ISO 4217',
    example: 'USD',
  })
  @Expose()
  currency: string;

  @ApiPropertyOptional({
    description: 'Coût moyen par document généré',
    example: 4.33,
    minimum: 0,
  })
  @Expose()
  costPerDocument?: number;

  @ApiPropertyOptional({
    description: 'Coût horaire du projet',
    example: 52.36,
    minimum: 0,
  })
  @Expose()
  costPerHour?: number;

  @ApiProperty({
    description: 'Répartition des coûts en pourcentages',
    type: CostBreakdownDto,
  })
  @Expose()
  @Type(() => CostBreakdownDto)
  breakdown: CostBreakdownDto;

  @ApiPropertyOptional({
    description: 'Tendance des coûts',
    example: 'increasing',
    enum: ['increasing', 'decreasing', 'stable'],
  })
  @Expose()
  trend?: 'increasing' | 'decreasing' | 'stable';
}

/**
 * DTO pour les métriques d'efficacité de performance
 */
export class PerformanceEfficiencyDto {
  @ApiProperty({
    description: 'Nombre de documents générés par heure',
    example: 12.5,
    minimum: 0,
  })
  @Expose()
  documentsPerHour: number;

  @ApiProperty({
    description: 'Nombre de tokens traités par seconde',
    example: 145.7,
    minimum: 0,
  })
  @Expose()
  tokensPerSecond: number;

  @ApiProperty({
    description: 'Efficacité du traitement (temps utile/temps total)',
    example: 85.2,
    minimum: 0,
    maximum: 100,
  })
  @Expose()
  processingEfficiency: number;

  @ApiProperty({
    description: 'Utilisation des ressources en pourcentage',
    example: 78.9,
    minimum: 0,
    maximum: 100,
  })
  @Expose()
  resourceUtilization: number;
}

/**
 * DTO pour les statistiques de performance en réponse
 */
export class PerformanceStatisticsResponseDto {
  @ApiProperty({
    description: 'Temps de génération des documents en secondes',
    example: 45.23,
    minimum: 0,
  })
  @Expose()
  generationTime: number;

  @ApiProperty({
    description: 'Temps de traitement des fichiers en secondes',
    example: 12.45,
    minimum: 0,
  })
  @Expose()
  processingTime: number;

  @ApiProperty({
    description: "Durée de l'interview en secondes",
    example: 180.75,
    minimum: 0,
  })
  @Expose()
  interviewTime: number;

  @ApiProperty({
    description: "Temps d'export des documents en secondes",
    example: 8.90,
    minimum: 0,
  })
  @Expose()
  exportTime: number;

  @ApiProperty({
    description: 'Temps total du workflow en secondes',
    example: 247.33,
    minimum: 0,
  })
  @Expose()
  totalTime: number;

  @ApiProperty({
    description: "Temps d'attente en queue en secondes",
    example: 5.12,
    minimum: 0,
  })
  @Expose()
  queueWaitTime: number;

  @ApiPropertyOptional({
    description: 'Temps moyen par document généré',
    example: 49.47,
    minimum: 0,
  })
  @Expose()
  averageDocumentTime?: number;

  @ApiProperty({
    description: "Métriques d'efficacité de performance",
    type: PerformanceEfficiencyDto,
  })
  @Expose()
  @Type(() => PerformanceEfficiencyDto)
  efficiency: PerformanceEfficiencyDto;

  @ApiProperty({
    description: 'Identification des goulots d\'étranglement',
    example: ['generation', 'queue_wait'],
    type: [String],
  })
  @Expose()
  bottlenecks: string[];

  @ApiPropertyOptional({
    description: 'Comparaison aux performances moyennes',
    example: 'faster',
    enum: ['faster', 'average', 'slower'],
  })
  @Expose()
  benchmark?: 'faster' | 'average' | 'slower';
}

/**
 * DTO pour les patterns d'activité
 */
export class ActivityPatternDto {
  @ApiPropertyOptional({
    description: 'Heure de pic d\'utilisation (0-23)',
    example: 14,
    minimum: 0,
    maximum: 23,
  })
  @Expose()
  peakUsageHour?: number;

  @ApiProperty({
    description: 'Fréquence d\'utilisation',
    example: 'daily',
    enum: ['daily', 'weekly', 'occasional'],
  })
  @Expose()
  usageFrequency: 'daily' | 'weekly' | 'occasional';

  @ApiProperty({
    description: 'Formats d\'export préférés',
    example: ['pdf', 'markdown'],
    type: [String],
  })
  @Expose()
  preferredFormats: string[];

  @ApiProperty({
    description: 'Durée moyenne des sessions en secondes',
    example: 1245.7,
    minimum: 0,
  })
  @Expose()
  averageSessionDuration: number;
}

/**
 * DTO pour les statistiques d'utilisation en réponse
 */
export class UsageStatisticsResponseDto {
  @ApiProperty({
    description: 'Nombre de documents générés',
    example: 5,
    minimum: 0,
  })
  @Expose()
  documentsGenerated: number;

  @ApiProperty({
    description: 'Nombre de fichiers traités',
    example: 3,
    minimum: 0,
  })
  @Expose()
  filesProcessed: number;

  @ApiProperty({
    description: 'Nombre de tokens Claude consommés',
    example: 15750,
    minimum: 0,
  })
  @Expose()
  tokensUsed: number;

  @ApiProperty({
    description: 'Nombre d\'appels API effectués',
    example: 12,
    minimum: 0,
  })
  @Expose()
  apiCallsCount: number;

  @ApiProperty({
    description: 'Taille totale de stockage utilisée en bytes',
    example: 2048576,
    minimum: 0,
  })
  @Expose()
  storageSize: number;

  @ApiProperty({
    description: "Nombre d'exports réalisés",
    example: 2,
    minimum: 0,
  })
  @Expose()
  exportCount: number;

  @ApiPropertyOptional({
    description: 'Nombre de tokens par document (efficacité)',
    example: 3150,
    minimum: 0,
  })
  @Expose()
  tokensPerDocument?: number;

  @ApiProperty({
    description: 'Efficacité de stockage (bytes par document)',
    example: 409715.2,
    minimum: 0,
  })
  @Expose()
  storageEfficiency: number;

  @ApiProperty({
    description: "Patterns d'activité utilisateur",
    type: ActivityPatternDto,
  })
  @Expose()
  @Type(() => ActivityPatternDto)
  activityPattern: ActivityPatternDto;

  @ApiProperty({
    description: 'Intensité d\'usage des ressources',
    example: 'moderate',
    enum: ['light', 'moderate', 'intensive'],
  })
  @Expose()
  resourceIntensity: 'light' | 'moderate' | 'intensive';
}

/**
 * DTO pour une métrique clé du résumé
 */
export class KeyMetricDto {
  @ApiProperty({
    description: 'Nom de la métrique',
    example: 'Total Cost',
  })
  @Expose()
  name: string;

  @ApiProperty({
    description: 'Valeur de la métrique',
    example: '21.65',
  })
  @Expose()
  value: string;

  @ApiProperty({
    description: 'Unité de la métrique',
    example: 'USD',
  })
  @Expose()
  unit: string;

  @ApiPropertyOptional({
    description: 'Évolution par rapport à la période précédente',
    example: '+5.2%',
  })
  @Expose()
  change?: string;

  @ApiProperty({
    description: 'Statut de la métrique',
    example: 'good',
    enum: ['good', 'warning', 'critical'],
  })
  @Expose()
  status: 'good' | 'warning' | 'critical';
}

/**
 * DTO pour le résumé exécutif des statistiques
 */
export class StatisticsSummaryDto {
  @ApiProperty({
    description: 'Coût total formaté avec devise',
    example: '$21.65',
  })
  @Expose()
  @Transform(({ obj, value }) => {
    // Gestion défensive de la valeur totalCost
    let cost = 0;
    
    // D'abord, essayer d'utiliser la valeur directe si elle existe
    if (typeof value === 'number' && !isNaN(value)) {
      cost = value;
    }
    // Ensuite, essayer obj.totalCost
    else if (typeof obj?.totalCost === 'number' && !isNaN(obj.totalCost)) {
      cost = obj.totalCost;
    }
    // Ensuite, essayer de parser obj.totalCost comme string
    else if (typeof obj?.totalCost === 'string') {
      const parsed = parseFloat(obj.totalCost);
      cost = !isNaN(parsed) ? parsed : 0;
    }
    // Fallback vers costs.total si disponible
    else if (obj?.costs && typeof obj.costs.total === 'number' && !isNaN(obj.costs.total)) {
      cost = obj.costs.total;
    }
    
    return `$${cost.toFixed(2)}`;
  })
  totalCost: string;

  @ApiProperty({
    description: 'Temps total formaté',
    example: '4h 7m 33s',
  })
  @Expose()
  totalTime: string;

  @ApiProperty({
    description: 'Score d\'efficacité global (0-100)',
    example: 87.5,
    minimum: 0,
    maximum: 100,
  })
  @Expose()
  efficiency: number;

  @ApiProperty({
    description: 'Statut général du projet',
    example: 'good',
    enum: ['optimal', 'good', 'needs_attention'],
  })
  @Expose()
  status: 'optimal' | 'good' | 'needs_attention';

  @ApiProperty({
    description: 'Métriques principales du projet',
    type: [KeyMetricDto],
  })
  @Expose()
  @Type(() => KeyMetricDto)
  keyMetrics: KeyMetricDto[];

  @ApiProperty({
    description: 'Recommandations d\'optimisation',
    example: [
      'Consider optimizing prompt length to reduce API costs',
      'File processing could be optimized for better performance'
    ],
    type: [String],
  })
  @Expose()
  recommendations: string[];
}

/**
 * DTO pour les métadonnées enrichies des statistiques
 */
export class StatisticsMetadataResponseDto {
  @ApiProperty({
    description: 'Dernière mise à jour des statistiques',
    example: '2024-08-18T10:30:00.000Z',
  })
  @Expose()
  lastUpdated: Date;

  @ApiProperty({
    description: 'Fraîcheur des données en minutes',
    example: 15,
    minimum: 0,
  })
  @Expose()
  dataFreshness: number;

  @ApiProperty({
    description: 'Complétude des données en pourcentage',
    example: 95.5,
    minimum: 0,
    maximum: 100,
  })
  @Expose()
  completeness: number;

  @ApiProperty({
    description: 'Services ayant fourni des données',
    example: ['cost-tracking-service', 'monitoring-service'],
    type: [String],
  })
  @Expose()
  sources: string[];

  @ApiProperty({
    description: 'Version du format de statistique',
    example: '1.0.0',
  })
  @Expose()
  version: string;

  @ApiProperty({
    description: 'Moment de génération de cette réponse',
    example: '2024-08-18T10:45:00.000Z',
  })
  @Expose()
  generatedAt: Date;

  @ApiPropertyOptional({
    description: 'Champs manquants dans les données',
    example: ['bandwidth'],
    type: [String],
  })
  @Expose()
  missingFields?: string[];

  @ApiPropertyOptional({
    description: 'Champs estimés ou calculés',
    example: ['costPerDocument', 'trend'],
    type: [String],
  })
  @Expose()
  estimatedFields?: string[];
}

/**
 * DTO principal pour les statistiques en réponse
 * Structure complète pour l'exposition des statistiques de projet
 */
export class StatisticsResponseDto {
  @ApiProperty({
    description: 'Statistiques des coûts du projet',
    type: CostsStatisticsResponseDto,
  })
  @Expose()
  @Type(() => CostsStatisticsResponseDto)
  costs: CostsStatisticsResponseDto;

  @ApiProperty({
    description: 'Statistiques de performance du projet',
    type: PerformanceStatisticsResponseDto,
  })
  @Expose()
  @Type(() => PerformanceStatisticsResponseDto)
  performance: PerformanceStatisticsResponseDto;

  @ApiProperty({
    description: "Statistiques d'utilisation du projet",
    type: UsageStatisticsResponseDto,
  })
  @Expose()
  @Type(() => UsageStatisticsResponseDto)
  usage: UsageStatisticsResponseDto;

  @ApiProperty({
    description: 'Résumé exécutif des statistiques',
    type: StatisticsSummaryDto,
  })
  @Expose()
  @Type(() => StatisticsSummaryDto)
  summary: StatisticsSummaryDto;

  @ApiProperty({
    description: 'Métadonnées enrichies des statistiques',
    type: StatisticsMetadataResponseDto,
  })
  @Expose()
  @Type(() => StatisticsMetadataResponseDto)
  metadata: StatisticsMetadataResponseDto;

  /**
   * Calcule le score d'efficacité global basé sur toutes les métriques
   */
  calculateGlobalEfficiency(): number {
    const costEfficiency = this.calculateCostEfficiency();
    const performanceEfficiency = this.performance.efficiency.processingEfficiency;
    const usageEfficiency = this.calculateUsageEfficiency();

    return (costEfficiency + performanceEfficiency + usageEfficiency) / 3;
  }

  /**
   * Calcule l'efficacité des coûts
   */
  private calculateCostEfficiency(): number {
    if (!this.costs.costPerDocument || this.usage.documentsGenerated === 0) {
      return 50; // Score neutre si pas de données
    }

    // Benchmarks indicatifs (à ajuster selon les données réelles)
    const benchmarkCostPerDoc = 5.0;
    const ratio = benchmarkCostPerDoc / this.costs.costPerDocument;
    
    return Math.min(100, Math.max(0, ratio * 100));
  }

  /**
   * Calcule l'efficacité d'usage
   */
  private calculateUsageEfficiency(): number {
    if (!this.usage.tokensPerDocument || this.usage.documentsGenerated === 0) {
      return 50; // Score neutre si pas de données
    }

    // Benchmark indicatif tokens par document
    const benchmarkTokensPerDoc = 3000;
    const ratio = benchmarkTokensPerDoc / this.usage.tokensPerDocument;
    
    return Math.min(100, Math.max(0, ratio * 100));
  }

  /**
   * Identifie les recommandations d'optimisation
   */
  generateRecommendations(): string[] {
    const recommendations: string[] = [];

    // Recommandations basées sur les coûts
    if (this.costs.costPerDocument && this.costs.costPerDocument > 5.0) {
      recommendations.push('Consider optimizing prompt length to reduce API costs');
    }

    if (this.costs.breakdown.claudeApiPercentage > 80) {
      recommendations.push('API costs are high - review prompt efficiency');
    }

    // Recommandations basées sur la performance
    if (this.performance.efficiency.processingEfficiency < 70) {
      recommendations.push('File processing could be optimized for better performance');
    }

    if (this.performance.bottlenecks.includes('queue_wait')) {
      recommendations.push('Consider upgrading to reduce queue wait times');
    }

    // Recommandations basées sur l'usage
    if (this.usage.tokensPerDocument && this.usage.tokensPerDocument > 4000) {
      recommendations.push('Document generation uses many tokens - consider template optimization');
    }

    if (this.usage.exportCount === 0) {
      recommendations.push('Generated documents haven\'t been exported yet');
    }

    return recommendations;
  }

  /**
   * Détermine le statut général du projet
   */
  determineOverallStatus(): 'optimal' | 'good' | 'needs_attention' {
    const efficiency = this.calculateGlobalEfficiency();

    if (efficiency >= 90) return 'optimal';
    if (efficiency >= 70) return 'good';
    return 'needs_attention';
  }

  /**
   * Formate la durée en format lisible
   */
  static formatDuration(seconds: number): string {
    // Gérer les valeurs négatives en les convertissant à 0
    const safeSeconds = Math.max(0, seconds);
    
    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    const secs = Math.floor(safeSeconds % 60);

    const parts: string[] = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

    return parts.join(' ');
  }

  /**
   * Formate la taille de fichier en format lisible
   */
  static formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }
}