import {
  IsOptional,
  IsObject,
  IsNumber,
  IsInt,
  IsString,
  IsDate,
  IsISO4217CurrencyCode,
  Min,
  Max,
  ValidateNested,
  IsPositive,
  IsIn,
  Length,
  Matches,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO pour les statistiques de coûts d'un projet
 */
export class CostsStatisticsDto {
  @ApiPropertyOptional({
    description: 'Coût des appels API Claude en USD',
    example: 12.45,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  claudeApi?: number;

  @ApiPropertyOptional({
    description: 'Coût de stockage des fichiers en USD',
    example: 2.30,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  storage?: number;

  @ApiPropertyOptional({
    description: 'Coût des ressources de calcul en USD',
    example: 5.67,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  compute?: number;

  @ApiPropertyOptional({
    description: 'Coût de la bande passante en USD',
    example: 1.23,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  bandwidth?: number;

  @ApiPropertyOptional({
    description: 'Coût total calculé ou fourni explicitement en USD',
    example: 21.65,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  total?: number;

  @ApiPropertyOptional({
    description: 'Devise des montants selon ISO 4217',
    example: 'USD',
    default: 'USD',
  })
  @IsOptional()
  @IsString()
  @IsISO4217CurrencyCode()
  currency?: string = 'USD';
}

/**
 * DTO pour les statistiques de performance d'un projet
 */
export class PerformanceStatisticsDto {
  @ApiPropertyOptional({
    description: 'Temps de génération des documents en secondes',
    example: 45.23,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  generationTime?: number;

  @ApiPropertyOptional({
    description: 'Temps de traitement des fichiers en secondes',
    example: 12.45,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  processingTime?: number;

  @ApiPropertyOptional({
    description: "Durée de l'interview en secondes",
    example: 180.75,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  interviewTime?: number;

  @ApiPropertyOptional({
    description: "Temps d'export des documents en secondes",
    example: 8.90,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  exportTime?: number;

  @ApiPropertyOptional({
    description: 'Temps total du workflow en secondes',
    example: 247.33,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  totalTime?: number;

  @ApiPropertyOptional({
    description: "Temps d'attente en queue en secondes",
    example: 5.12,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  queueWaitTime?: number;
}

/**
 * DTO pour les statistiques d'utilisation d'un projet
 */
export class UsageStatisticsDto {
  @ApiPropertyOptional({
    description: 'Nombre de documents générés',
    example: 5,
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  documentsGenerated?: number;

  @ApiPropertyOptional({
    description: 'Nombre de fichiers traités',
    example: 3,
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  filesProcessed?: number;

  @ApiPropertyOptional({
    description: 'Nombre de tokens Claude consommés',
    example: 15750,
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  tokensUsed?: number;

  @ApiPropertyOptional({
    description: 'Nombre d\'appels API effectués',
    example: 12,
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  apiCallsCount?: number;

  @ApiPropertyOptional({
    description: 'Taille totale de stockage utilisée en bytes',
    example: 2048576,
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  storageSize?: number;

  @ApiPropertyOptional({
    description: "Nombre d'exports réalisés",
    example: 2,
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  exportCount?: number;
}

/**
 * DTO pour les métadonnées des statistiques
 */
export class StatisticsMetadataDto {
  @ApiPropertyOptional({
    description: 'Service source de la statistique',
    example: 'cost-tracking-service',
    enum: [
      'cost-tracking-service',
      'monitoring-service',
      'orchestration-service',
      'generation-agent-service',
      'document-processing-service',
      'export-service',
    ],
  })
  @IsOptional()
  @IsString()
  @IsIn([
    'cost-tracking-service',
    'monitoring-service',
    'orchestration-service',
    'generation-agent-service',
    'document-processing-service',
    'export-service',
  ])
  source?: string;

  @ApiPropertyOptional({
    description: 'Horodatage de la mesure',
    example: '2024-08-18T10:30:00.000Z',
  })
  @IsOptional()
  @IsDate()
  @Transform(({ value }) => new Date(value))
  timestamp?: Date;

  @ApiPropertyOptional({
    description: 'Version du format de statistique',
    example: '1.0.0',
    pattern: '^\\d+\\.\\d+\\.\\d+$',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d+\.\d+\.\d+$/, {
    message: 'Version must follow semantic versioning format (x.y.z)',
  })
  version?: string;

  @ApiPropertyOptional({
    description: 'Identifiant de batch pour traçabilité',
    example: 'batch-2024081810-abc123',
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  batchId?: string;

  @ApiPropertyOptional({
    description: 'Niveau de confiance de la mesure (0-1)',
    example: 0.95,
    minimum: 0,
    maximum: 1,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  @Max(1)
  confidence?: number;
}

/**
 * DTO principal pour la mise à jour des statistiques d'un projet
 * Toutes les propriétés sont optionnelles pour supporter les mises à jour partielles
 */
export class UpdateStatisticsDto {
  @ApiPropertyOptional({
    description: 'Statistiques des coûts du projet',
    type: CostsStatisticsDto,
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => CostsStatisticsDto)
  costs?: CostsStatisticsDto;

  @ApiPropertyOptional({
    description: 'Statistiques de performance du projet',
    type: PerformanceStatisticsDto,
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => PerformanceStatisticsDto)
  performance?: PerformanceStatisticsDto;

  @ApiPropertyOptional({
    description: "Statistiques d'utilisation du projet",
    type: UsageStatisticsDto,
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => UsageStatisticsDto)
  usage?: UsageStatisticsDto;

  @ApiPropertyOptional({
    description: 'Métadonnées contextuelles sur la mise à jour',
    type: StatisticsMetadataDto,
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => StatisticsMetadataDto)
  metadata?: StatisticsMetadataDto;

  /**
   * Valide la cohérence des données de coûts
   * Vérifie que le total est cohérent avec la somme des composants si fourni
   */
  validateCostsCoherence(): boolean {
    if (!this.costs?.total) {
      return true; // Pas de validation si pas de total fourni
    }

    const components = [
      this.costs.claudeApi || 0,
      this.costs.storage || 0,
      this.costs.compute || 0,
      this.costs.bandwidth || 0,
    ];

    const calculatedTotal = components.reduce((sum, cost) => sum + cost, 0);
    const tolerance = 0.01; // Tolérance de 1 centime pour les erreurs d'arrondi

    return Math.abs(this.costs.total - calculatedTotal) <= tolerance;
  }

  /**
   * Valide la cohérence temporelle des données de performance
   * Vérifie que le temps total est cohérent avec la somme des composants si fourni
   */
  validatePerformanceCoherence(): boolean {
    if (!this.performance?.totalTime) {
      return true; // Pas de validation si pas de temps total fourni
    }

    const components = [
      this.performance.generationTime || 0,
      this.performance.processingTime || 0,
      this.performance.interviewTime || 0,
      this.performance.exportTime || 0,
      this.performance.queueWaitTime || 0,
    ];

    const calculatedTotal = components.reduce((sum, time) => sum + time, 0);
    const tolerance = 0.1; // Tolérance de 100ms pour les erreurs d'arrondi

    return this.performance.totalTime >= calculatedTotal - tolerance;
  }

  /**
   * Valide la cohérence logique des données d'utilisation
   * Vérifie les relations logiques entre les métriques
   */
  validateUsageCoherence(): boolean {
    if (!this.usage) {
      return true;
    }

    // Le nombre de documents générés ne peut pas être supérieur aux fichiers traités + 10
    // (marge pour les documents générés automatiquement)
    if (
      this.usage.documentsGenerated &&
      this.usage.filesProcessed &&
      this.usage.documentsGenerated > this.usage.filesProcessed + 10
    ) {
      return false;
    }

    // Le nombre d'exports ne peut pas être supérieur aux documents générés
    if (
      this.usage.exportCount &&
      this.usage.documentsGenerated &&
      this.usage.exportCount > this.usage.documentsGenerated
    ) {
      return false;
    }

    return true;
  }

  /**
   * Valide la fraîcheur des données basée sur le timestamp
   * Les données ne doivent pas être trop anciennes ou futures
   */
  validateTimestamp(): boolean {
    if (!this.metadata?.timestamp) {
      return true; // Pas de validation si pas de timestamp
    }

    const now = new Date();
    const maxAge = 24 * 60 * 60 * 1000; // 24 heures en ms
    const maxFuture = 5 * 60 * 1000; // 5 minutes en ms

    const age = now.getTime() - this.metadata.timestamp.getTime();

    return age >= -maxFuture && age <= maxAge;
  }

  /**
   * Effectue une validation métier complète du DTO
   * Combine toutes les validations de cohérence
   */
  isValid(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.validateCostsCoherence()) {
      errors.push('Costs total is inconsistent with sum of components');
    }

    if (!this.validatePerformanceCoherence()) {
      errors.push('Performance total time is inconsistent with sum of components');
    }

    if (!this.validateUsageCoherence()) {
      errors.push('Usage statistics contain logical inconsistencies');
    }

    if (!this.validateTimestamp()) {
      errors.push('Timestamp is too old or in the future');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}