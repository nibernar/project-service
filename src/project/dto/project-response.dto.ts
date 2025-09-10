import { Expose, Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProjectStatus } from '../../common/enums/project-status.enum';

/**
 * DTO pour les statistiques de projet dans les réponses Project (version simplifiée)
 * 
 * Version allégée des statistiques pour éviter la surcharge dans les réponses
 * de projet. Contient uniquement les métriques essentielles pour l'affichage.
 */
export class ProjectStatisticsResponseDto {
  /**
   * Informations de coûts du projet
   */
  @ApiProperty({
    description: 'Détail des coûts associés au projet',
    example: {
      claudeApi: 0.45,
      storage: 0.02,
      compute: 0.01,
      total: 0.48,
    },
    type: 'object',
    additionalProperties: false,
  })
  @Expose()
  @Transform(({ value }) => {
    // Transformation sécurisée avec valeurs par défaut
    if (!value || typeof value !== 'object') {
      return {
        claudeApi: 0,
        storage: 0,
        compute: 0,
        total: 0,
      };
    }

    const costs = {
      claudeApi: typeof value.claudeApi === 'number' ? value.claudeApi : 0,
      storage: typeof value.storage === 'number' ? value.storage : 0,
      compute: typeof value.compute === 'number' ? value.compute : 0,
      total: typeof value.total === 'number' ? value.total : 0,
    };

    // Recalcul du total si manquant ou incohérent
    if (
      costs.total === 0 ||
      Math.abs(
        costs.total - (costs.claudeApi + costs.storage + costs.compute),
      ) > 0.01
    ) {
      costs.total = costs.claudeApi + costs.storage + costs.compute;
    }

    return costs;
  })
  costs: {
    claudeApi: number;
    storage: number;
    compute: number;
    total: number;
  };

  /**
   * Métriques de performance du projet
   */
  @ApiProperty({
    description: 'Métriques de performance et temps de traitement',
    example: {
      generationTime: 12500,
      processingTime: 2300,
      totalTime: 14800,
    },
    type: 'object',
    additionalProperties: false,
  })
  @Expose()
  @Transform(({ value }) => {
    // Transformation sécurisée avec validation des valeurs
    if (!value || typeof value !== 'object') {
      return {
        generationTime: 0,
        processingTime: 0,
        totalTime: 0,
      };
    }

    const performance = {
      generationTime:
        typeof value.generationTime === 'number'
          ? Math.max(0, value.generationTime)
          : 0,
      processingTime:
        typeof value.processingTime === 'number'
          ? Math.max(0, value.processingTime)
          : 0,
      totalTime:
        typeof value.totalTime === 'number' ? Math.max(0, value.totalTime) : 0,
    };

    // Recalcul du temps total si manquant
    if (performance.totalTime === 0) {
      performance.totalTime =
        performance.generationTime + performance.processingTime;
    }

    return performance;
  })
  performance: {
    generationTime: number;
    processingTime: number;
    totalTime: number;
  };

  /**
   * Statistiques d'usage du projet
   */
  @ApiProperty({
    description: "Statistiques d'usage et de production du projet",
    example: {
      documentsGenerated: 5,
      filesProcessed: 3,
      tokensUsed: 1250,
    },
    type: 'object',
    additionalProperties: false,
  })
  @Expose()
  @Transform(({ value }) => {
    // Transformation sécurisée avec validation des entiers
    if (!value || typeof value !== 'object') {
      return {
        documentsGenerated: 0,
        filesProcessed: 0,
        tokensUsed: 0,
      };
    }

    return {
      documentsGenerated:
        typeof value.documentsGenerated === 'number'
          ? Math.max(0, Math.floor(value.documentsGenerated))
          : 0,
      filesProcessed:
        typeof value.filesProcessed === 'number'
          ? Math.max(0, Math.floor(value.filesProcessed))
          : 0,
      tokensUsed:
        typeof value.tokensUsed === 'number'
          ? Math.max(0, Math.floor(value.tokensUsed))
          : 0,
    };
  })
  usage: {
    documentsGenerated: number;
    filesProcessed: number;
    tokensUsed: number;
  };

  /**
   * Date de dernière mise à jour des statistiques
   */
  @ApiProperty({
    description: 'Date de dernière mise à jour des statistiques',
    example: '2024-08-08T14:30:00Z',
    type: 'string',
    format: 'date-time',
  })
  @Expose()
  @Type(() => Date)
  lastUpdated: Date;

  /**
   * Calcule le coût moyen par document généré
   */
  getCostPerDocument(): number {
    if (this.usage.documentsGenerated === 0) return 0;
    return Number(
      (this.costs.total / this.usage.documentsGenerated).toFixed(4),
    );
  }

  /**
   * Calcule la vitesse de génération moyenne
   */
  getTokensPerSecond(): number {
    if (this.performance.totalTime === 0 || this.usage.tokensUsed === 0)
      return 0;
    const timeInSeconds = this.performance.totalTime / 1000;
    return Number((this.usage.tokensUsed / timeInSeconds).toFixed(2));
  }

  /**
   * Vérifie si les statistiques sont récentes (moins de 24h)
   */
  isDataFresh(): boolean {
    const dayInMs = 24 * 60 * 60 * 1000;
    return new Date().getTime() - this.lastUpdated.getTime() < dayInMs;
  }

  /**
   * Retourne un résumé des performances
   */
  getPerformanceSummary(): 'excellent' | 'good' | 'average' | 'slow' {
    const tokensPerSecond = this.getTokensPerSecond();

    if (tokensPerSecond > 100) return 'excellent';
    if (tokensPerSecond > 50) return 'good';
    if (tokensPerSecond > 20) return 'average';
    return 'slow';
  }
}

/**
 * DTO principal pour les réponses détaillées de projet
 */
export class ProjectResponseDto {
  @ApiProperty({
    description: 'Identifiant unique du projet (UUID)',
    example: '550e8400-e29b-41d4-a716-446655440000',
    format: 'uuid',
  })
  @Expose()
  id: string;

  @ApiProperty({
    description: "Nom du projet défini par l'utilisateur",
    example: 'Application E-commerce',
    maxLength: 100,
  })
  @Expose()
  name: string;

  @ApiPropertyOptional({
    description: 'Description détaillée du projet',
    example:
      'Plateforme de vente en ligne avec gestion des stocks et paiements',
    maxLength: 1000,
  })
  @Expose()
  description?: string;

  @ApiProperty({
    description: 'Prompt initial ayant déclenché la création du projet',
    example:
      'Je souhaite créer une application de gestion des ressources humaines',
    minLength: 10,
    maxLength: 5000,
  })
  @Expose()
  initialPrompt: string;

  @ApiProperty({
    description: 'Statut actuel du projet',
    enum: ProjectStatus,
    example: ProjectStatus.ACTIVE,
  })
  @Expose()
  status: ProjectStatus;

  @ApiProperty({
    description: "Identifiants des fichiers uploadés par l'utilisateur",
    example: ['file1-uuid', 'file2-uuid'],
    type: [String],
  })
  @Expose()
  @Transform(({ value }) => {
    if (!Array.isArray(value)) return [];
    return value.filter((item) => typeof item === 'string' && item.length > 0);
  })
  uploadedFileIds: string[];

  @ApiProperty({
    description: 'Identifiants des fichiers générés par les agents IA',
    example: ['generated-doc1-uuid', 'generated-doc2-uuid'],
    type: [String],
  })
  @Expose()
  @Transform(({ value }) => {
    if (!Array.isArray(value)) return [];
    return value.filter((item) => typeof item === 'string' && item.length > 0);
  })
  generatedFileIds: string[];

  @ApiProperty({
    description: 'Date de création du projet',
    example: '2024-08-08T10:30:00Z',
    type: 'string',
    format: 'date-time',
  })
  @Expose()
  @Type(() => Date)
  createdAt: Date;

  @ApiProperty({
    description: 'Date de dernière modification du projet',
    example: '2024-08-08T14:30:00Z',
    type: 'string',
    format: 'date-time',
  })
  @Expose()
  @Type(() => Date)
  updatedAt: Date;

  @ApiPropertyOptional({
    description: "Statistiques de performance et d'usage du projet",
    type: ProjectStatisticsResponseDto,
  })
  @Expose()
  @Type(() => ProjectStatisticsResponseDto)
  statistics?: ProjectStatisticsResponseDto;

  // Toutes les méthodes utilitaires restent identiques...
  hasUploadedFiles(): boolean {
    return this.uploadedFileIds && this.uploadedFileIds.length > 0;
  }

  hasGeneratedFiles(): boolean {
    return this.generatedFileIds && this.generatedFileIds.length > 0;
  }

  getTotalFilesCount(): number {
    const uploadedCount = this.uploadedFileIds?.length ?? 0;
    const generatedCount = this.generatedFileIds?.length ?? 0;
    return uploadedCount + generatedCount;
  }

  hasStatistics(): boolean {
    return this.statistics !== undefined && this.statistics !== null;
  }

  getAgeInDays(): number {
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - this.createdAt.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }

  hasBeenModified(): boolean {
    const diffMs = this.updatedAt.getTime() - this.createdAt.getTime();
    return diffMs > 1000;
  }

  isAccessible(): boolean {
    return (
      this.status === ProjectStatus.ACTIVE ||
      this.status === ProjectStatus.ARCHIVED
    );
  }

  getActivityLevel(): 'new' | 'active' | 'mature' | 'inactive' {
    const ageInDays = this.getAgeInDays();
    const hasFiles = this.hasGeneratedFiles();
    const wasModified = this.hasBeenModified();

    if (ageInDays <= 1 && !hasFiles) return 'new';
    if (hasFiles && wasModified && ageInDays <= 30) return 'active';
    if (hasFiles && ageInDays > 30) return 'mature';
    return 'inactive';
  }

  getTotalCost(): number | null {
    return this.hasStatistics() ? this.statistics!.costs.total : null;
  }

  getDocumentsCount(): number | null {
    return this.hasStatistics()
      ? this.statistics!.usage.documentsGenerated
      : null;
  }

  isRecent(): boolean {
    return this.getAgeInDays() <= 7;
  }

  getComplexityEstimate(): 'low' | 'medium' | 'high' {
    if (!this.initialPrompt) return 'low';

    const length = this.initialPrompt.length;
    const wordCount = this.initialPrompt.split(/\s+/).length;

    if (length < 50 && wordCount < 10) return 'low';
    if (length < 200 && wordCount < 35) return 'medium';
    return 'high';
  }

  toString(): string {
    const filesInfo =
      this.getTotalFilesCount() > 0
        ? `, files=${this.getTotalFilesCount()}`
        : '';
    const statsInfo = this.hasStatistics()
      ? `, cost=${this.getTotalCost()?.toFixed(2) ?? 'N/A'}€`
      : '';

    return `Project[${this.name}](${this.status}, age=${this.getAgeInDays()}d${filesInfo}${statsInfo})`;
  }

  toLogSafeString(): string {
    const age = this.getAgeInDays();
    const filesCount = this.getTotalFilesCount();
    const hasStats = this.hasStatistics();
    const complexity = this.getComplexityEstimate();

    return `Project[id=${this.id}, status=${this.status}, age=${age}d, files=${filesCount}, stats=${hasStats}, complexity=${complexity}]`;
  }

  getMetadata(): {
    id: string;
    status: ProjectStatus;
    ageInDays: number;
    totalFiles: number;
    hasStatistics: boolean;
    complexity: string;
    activityLevel: string;
  } {
    return {
      id: this.id,
      status: this.status,
      ageInDays: this.getAgeInDays(),
      totalFiles: this.getTotalFilesCount(),
      hasStatistics: this.hasStatistics(),
      complexity: this.getComplexityEstimate(),
      activityLevel: this.getActivityLevel(),
    };
  }
}
