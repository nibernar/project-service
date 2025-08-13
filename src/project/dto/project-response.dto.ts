import { Expose, Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProjectStatus } from '../../common/enums/project-status.enum';

/**
 * DTO pour les statistiques de projet dans les réponses
 * 
 * Structure et expose les données de performance, coûts et usage
 * collectées par les autres services de la plateforme.
 * 
 * SÉCURITÉ : 
 * - Données read-only pour consultation uniquement
 * - Pas d'exposition de données internes sensibles
 * - Transformation sécurisée des données JSON
 * 
 * @example
 * ```typescript
 * const stats: StatisticsResponseDto = {
 *   costs: { claudeApi: 0.45, storage: 0.02, total: 0.47 },
 *   performance: { generationTime: 12500, totalTime: 15000 },
 *   usage: { documentsGenerated: 5, tokensUsed: 1250 },
 *   lastUpdated: new Date()
 * };
 * ```
 */
export class StatisticsResponseDto {
  /**
   * Informations de coûts du projet
   * 
   * Agrège tous les coûts associés au projet depuis sa création.
   * Fournit une transparence complète sur les coûts pour l'utilisateur.
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
    if (costs.total === 0 || Math.abs(costs.total - (costs.claudeApi + costs.storage + costs.compute)) > 0.01) {
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
   * 
   * Temps de traitement et de génération pour évaluer l'efficacité
   * du processus de création documentaire.
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
      generationTime: typeof value.generationTime === 'number' ? Math.max(0, value.generationTime) : 0,
      processingTime: typeof value.processingTime === 'number' ? Math.max(0, value.processingTime) : 0,
      totalTime: typeof value.totalTime === 'number' ? Math.max(0, value.totalTime) : 0,
    };
    
    // Recalcul du temps total si manquant
    if (performance.totalTime === 0) {
      performance.totalTime = performance.generationTime + performance.processingTime;
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
   * 
   * Métriques d'utilisation et de production pour mesurer
   * la productivité et l'engagement utilisateur.
   */
  @ApiProperty({
    description: 'Statistiques d\'usage et de production du projet',
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
      documentsGenerated: typeof value.documentsGenerated === 'number' ? Math.max(0, Math.floor(value.documentsGenerated)) : 0,
      filesProcessed: typeof value.filesProcessed === 'number' ? Math.max(0, Math.floor(value.filesProcessed)) : 0,
      tokensUsed: typeof value.tokensUsed === 'number' ? Math.max(0, Math.floor(value.tokensUsed)) : 0,
    };
  })
  usage: {
    documentsGenerated: number;
    filesProcessed: number;
    tokensUsed: number;
  };

  /**
   * Date de dernière mise à jour des statistiques
   * 
   * Horodatage de la dernière réception de données statistiques
   * permettant d'évaluer la fraîcheur des informations.
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
   * 
   * @returns Coût unitaire par document (0 si aucun document)
   */
  getCostPerDocument(): number {
    if (this.usage.documentsGenerated === 0) return 0;
    return Number((this.costs.total / this.usage.documentsGenerated).toFixed(4));
  }

  /**
   * Calcule la vitesse de génération moyenne
   * 
   * @returns Nombre de tokens traités par seconde
   */
  getTokensPerSecond(): number {
    if (this.performance.totalTime === 0 || this.usage.tokensUsed === 0) return 0;
    const timeInSeconds = this.performance.totalTime / 1000;
    return Number((this.usage.tokensUsed / timeInSeconds).toFixed(2));
  }

  /**
   * Vérifie si les statistiques sont récentes (moins de 24h)
   * 
   * @returns true si les statistiques ont moins de 24h
   */
  isDataFresh(): boolean {
    const dayInMs = 24 * 60 * 60 * 1000;
    return (new Date().getTime() - this.lastUpdated.getTime()) < dayInMs;
  }

  /**
   * Retourne un résumé des performances
   * 
   * @returns Évaluation qualitative des performances
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
 * 
 * Expose toutes les informations d'un projet avec contrôle granulaire
 * de la visibilité des champs. Inclut conditionnellement les statistiques
 * et applique les transformations de sécurité appropriées.
 * 
 * PRINCIPES DE SÉCURITÉ :
 * - Exposition sélective avec @Expose()
 * - Transformation sécurisée des données sensibles
 * - Validation des types lors de la sérialisation
 * - Masquage automatique des champs système internes
 * 
 * CHAMPS EXPOSÉS :
 * ✅ Identifiants et métadonnées utilisateur
 * ✅ Informations du projet (nom, description, prompt, statut)
 * ✅ Références des fichiers (uploadés et générés)
 * ✅ Dates de création et modification
 * ✅ Statistiques (si disponibles)
 * 
 * CHAMPS MASQUÉS :
 * ❌ ownerId (récupéré via le contexte d'authentification)
 * ❌ Champs internes de base de données
 * ❌ Données sensibles des autres services
 * 
 * @example
 * ```typescript
 * // Usage dans un contrôleur
 * @Get(':id')
 * async findOne(@Param('id') id: string): Promise<ProjectResponseDto> {
 *   return this.projectService.findOne(id);
 * }
 * ```
 */
export class ProjectResponseDto {
  /**
   * Identifiant unique du projet
   * 
   * UUID généré automatiquement lors de la création.
   * Utilisé pour toutes les opérations sur le projet.
   */
  @ApiProperty({
    description: 'Identifiant unique du projet (UUID)',
    example: '550e8400-e29b-41d4-a716-446655440000',
    format: 'uuid',
  })
  @Expose()
  id: string;

  /**
   * Nom du projet défini par l'utilisateur
   * 
   * Identifiant principal visible dans l'interface utilisateur.
   * Modifiable via l'endpoint de mise à jour.
   */
  @ApiProperty({
    description: 'Nom du projet défini par l\'utilisateur',
    example: 'Application E-commerce',
    maxLength: 100,
  })
  @Expose()
  name: string;

  /**
   * Description détaillée du projet (optionnelle)
   * 
   * Contexte supplémentaire fourni par l'utilisateur pour
   * enrichir la compréhension du projet.
   */
  @ApiPropertyOptional({
    description: 'Description détaillée du projet',
    example: 'Plateforme de vente en ligne avec gestion des stocks et paiements',
    maxLength: 1000,
  })
  @Expose()
  description?: string;

  /**
   * Prompt initial fourni lors de la création
   * 
   * Demande originale de l'utilisateur qui a déclenché
   * le processus de génération documentaire.
   * 
   * IMPORTANT : Champ immutable préservé pour l'audit
   */
  @ApiProperty({
    description: 'Prompt initial ayant déclenché la création du projet',
    example: 'Je souhaite créer une application de gestion des ressources humaines',
    minLength: 10,
    maxLength: 5000,
  })
  @Expose()
  initialPrompt: string;

  /**
   * Statut actuel du projet
   * 
   * État du cycle de vie du projet (ACTIVE, ARCHIVED, DELETED).
   * Contrôle la visibilité et les opérations autorisées.
   */
  @ApiProperty({
    description: 'Statut actuel du projet',
    enum: ProjectStatus,
    example: ProjectStatus.ACTIVE,
  })
  @Expose()
  status: ProjectStatus;

  /**
   * Liste des identifiants des fichiers uploadés
   * 
   * Références vers les fichiers fournis par l'utilisateur
   * comme contexte supplémentaire lors de la création.
   */
  @ApiProperty({
    description: 'Identifiants des fichiers uploadés par l\'utilisateur',
    example: ['file1-uuid', 'file2-uuid'],
    type: [String],
  })
  @Expose()
  @Transform(({ value }) => {
    // Sécurisation du tableau - s'assurer que c'est bien un array de strings
    if (!Array.isArray(value)) return [];
    return value.filter(item => typeof item === 'string' && item.length > 0);
  })
  uploadedFileIds: string[];

  /**
   * Liste des identifiants des fichiers générés
   * 
   * Références vers les documents produits par les agents IA.
   * Mis à jour automatiquement par l'orchestrateur.
   */
  @ApiProperty({
    description: 'Identifiants des fichiers générés par les agents IA',
    example: ['generated-doc1-uuid', 'generated-doc2-uuid'],
    type: [String],
  })
  @Expose()
  @Transform(({ value }) => {
    // Sécurisation du tableau
    if (!Array.isArray(value)) return [];
    return value.filter(item => typeof item === 'string' && item.length > 0);
  })
  generatedFileIds: string[];

  /**
   * Date de création du projet
   * 
   * Horodatage UTC de la création initiale du projet.
   * Immutable après création.
   */
  @ApiProperty({
    description: 'Date de création du projet',
    example: '2024-08-08T10:30:00Z',
    type: 'string',
    format: 'date-time',
  })
  @Expose()
  @Type(() => Date)
  createdAt: Date;

  /**
   * Date de dernière modification
   * 
   * Horodatage UTC de la dernière modification des métadonnées
   * du projet (nom, description, statut).
   */
  @ApiProperty({
    description: 'Date de dernière modification du projet',
    example: '2024-08-08T14:30:00Z',
    type: 'string',
    format: 'date-time',
  })
  @Expose()
  @Type(() => Date)
  updatedAt: Date;

  /**
   * Statistiques du projet (optionnelles)
   * 
   * Métriques de performance, coûts et usage collectées
   * par les autres services. Disponibles si des données
   * ont été collectées depuis la création.
   */
  @ApiPropertyOptional({
    description: 'Statistiques de performance et d\'usage du projet',
    type: StatisticsResponseDto,
  })
  @Expose()
  @Type(() => StatisticsResponseDto)
  statistics?: StatisticsResponseDto;

  // ========================================================================
  // MÉTHODES UTILITAIRES
  // ========================================================================

  /**
   * Vérifie si le projet a des fichiers uploadés
   * 
   * @returns true si au moins un fichier a été uploadé
   */
  hasUploadedFiles(): boolean {
    return this.uploadedFileIds && this.uploadedFileIds.length > 0;
  }

  /**
   * Vérifie si le projet a des fichiers générés
   * 
   * @returns true si au moins un fichier a été généré
   */
  hasGeneratedFiles(): boolean {
    return this.generatedFileIds && this.generatedFileIds.length > 0;
  }

  /**
   * Retourne le nombre total de fichiers (uploadés + générés)
   * 
   * @returns Nombre total de fichiers associés au projet
   */
  getTotalFilesCount(): number {
    const uploadedCount = this.uploadedFileIds?.length ?? 0;
    const generatedCount = this.generatedFileIds?.length ?? 0;
    return uploadedCount + generatedCount;
  }

  /**
   * Vérifie si le projet a des statistiques disponibles
   * 
   * @returns true si des statistiques sont présentes
   */
  hasStatistics(): boolean {
    return this.statistics !== undefined && this.statistics !== null;
  }

  /**
   * Calcule l'âge du projet en jours
   * 
   * @returns Nombre de jours depuis la création
   */
  getAgeInDays(): number {
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - this.createdAt.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }

  /**
   * Vérifie si le projet a été modifié depuis sa création
   * 
   * @returns true si updatedAt > createdAt (avec tolérance de 1 seconde)
   */
  hasBeenModified(): boolean {
    const diffMs = this.updatedAt.getTime() - this.createdAt.getTime();
    return diffMs > 1000; // Tolérance de 1 seconde pour les différences techniques
  }

  /**
   * Retourne le statut d'accessibilité du projet
   * 
   * @returns Indique si le projet est accessible à l'utilisateur
   */
  isAccessible(): boolean {
    return this.status === ProjectStatus.ACTIVE || this.status === ProjectStatus.ARCHIVED;
  }

  /**
   * Retourne un résumé de l'activité du projet
   * 
   * @returns Évaluation qualitative de l'activité
   */
  getActivityLevel(): 'new' | 'active' | 'mature' | 'inactive' {
    const ageInDays = this.getAgeInDays();
    const hasFiles = this.hasGeneratedFiles();
    const wasModified = this.hasBeenModified();

    if (ageInDays <= 1 && !hasFiles) return 'new';
    if (hasFiles && wasModified && ageInDays <= 30) return 'active';
    if (hasFiles && ageInDays > 30) return 'mature';
    return 'inactive';
  }

  /**
   * Retourne les métriques de coût si disponibles
   * 
   * @returns Coût total ou null si non disponible
   */
  getTotalCost(): number | null {
    return this.hasStatistics() ? this.statistics!.costs.total : null;
  }

  /**
   * Retourne le nombre de documents générés si disponible
   * 
   * @returns Nombre de documents ou null si non disponible
   */
  getDocumentsCount(): number | null {
    return this.hasStatistics() ? this.statistics!.usage.documentsGenerated : null;
  }

  /**
   * Vérifie si le projet est considéré comme "récent"
   * 
   * @returns true si le projet a été créé il y a moins de 7 jours
   */
  isRecent(): boolean {
    return this.getAgeInDays() <= 7;
  }

  /**
   * Retourne la complexité estimée du projet basée sur le prompt initial
   * 
   * @returns Niveau de complexité estimé
   */
  getComplexityEstimate(): 'low' | 'medium' | 'high' {
    if (!this.initialPrompt) return 'low';
    
    const length = this.initialPrompt.length;
    const wordCount = this.initialPrompt.split(/\s+/).length;
    
    // Logique corrigée : utiliser AND au lieu de OR pour éviter les conflits
    if (length < 50 && wordCount < 10) return 'low';
    if (length < 200 && wordCount < 35) return 'medium';
    return 'high';
  }

  /**
   * Génère un résumé du projet pour l'affichage
   * 
   * @returns Chaîne descriptive du projet
   */
  toString(): string {
    const filesInfo = this.getTotalFilesCount() > 0 
      ? `, files=${this.getTotalFilesCount()}` 
      : '';
    const statsInfo = this.hasStatistics() 
      ? `, cost=${this.getTotalCost()?.toFixed(2) ?? 'N/A'}€` 
      : '';
    
    return `Project[${this.name}](${this.status}, age=${this.getAgeInDays()}d${filesInfo}${statsInfo})`;
  }

  /**
   * Crée une version sanitisée pour les logs (sans données sensibles)
   * 
   * SÉCURITÉ CRITIQUE : Aucune donnée utilisateur exposée
   * 
   * @returns Version sécurisée pour les logs
   */
  toLogSafeString(): string {
    const age = this.getAgeInDays();
    const filesCount = this.getTotalFilesCount();
    const hasStats = this.hasStatistics();
    const complexity = this.getComplexityEstimate();
    
    return `Project[id=${this.id}, status=${this.status}, age=${age}d, files=${filesCount}, stats=${hasStats}, complexity=${complexity}]`;
  }

  /**
   * Retourne les métadonnées du projet pour l'indexation
   * 
   * @returns Objet contenant les métadonnées non sensibles
   */
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