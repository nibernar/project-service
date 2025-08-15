import { Expose, Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProjectStatus } from '../../common/enums/project-status.enum';

/**
 * DTO optimisé pour l'affichage des projets en liste
 * 
 * Version allégée du ProjectResponseDto, conçue spécifiquement pour
 * les performances des requêtes de listing paginé. Contient uniquement
 * les informations essentielles pour l'affichage en cartes ou lignes.
 * 
 * OPTIMISATIONS POUR LES PERFORMANCES :
 * - Pas de statistiques détaillées (évite les JOINs coûteux)
 * - Pas de prompt initial (évite le transfert de données volumineuses)
 * - Compteurs de fichiers au lieu des listes complètes
 * - Transformations légères et calculs simples uniquement
 * 
 * USAGE PRÉVU :
 * - Listings paginés de projets
 * - Cartes de projet dans le dashboard
 * - Résultats de recherche
 * - Aperçus de projets
 * 
 * @example
 * ```typescript
 * // Usage dans un contrôleur
 * @Get()
 * async findAll(@Query() pagination: PaginationDto): Promise<PaginatedResult<ProjectListItemDto>> {
 *   return this.projectService.findAll(pagination);
 * }
 * ```
 */
export class ProjectListItemDto {
  /**
   * Identifiant unique du projet
   * 
   * UUID généré automatiquement lors de la création.
   * Utilisé pour la navigation vers le détail du projet.
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
   * Titre principal affiché dans les cartes et listes de projets.
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
   * Description courte du projet (optionnelle)
   * 
   * Aperçu du contexte du projet pour l'affichage en liste.
   * Tronquée automatiquement si trop longue pour l'affichage.
   */
  @ApiPropertyOptional({
    description: 'Description courte du projet pour aperçu',
    example: 'Plateforme de vente en ligne avec gestion des stocks...',
    maxLength: 1000,
  })
  @Expose()
  description?: string;

  /**
   * Statut actuel du projet
   * 
   * État du cycle de vie déterminant la couleur d'affichage
   * et les actions disponibles dans l'interface.
   */
  @ApiProperty({
    description: 'Statut actuel du projet',
    enum: ProjectStatus,
    example: ProjectStatus.ACTIVE,
  })
  @Expose()
  status: ProjectStatus;

  /**
   * Date de création du projet
   * 
   * Permet l'affichage de l'âge du projet et le tri chronologique.
   * Affichée sous forme relative ("il y a 3 jours") dans l'UI.
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
   * Indicateur d'activité récente pour le tri et l'affichage.
   * Utilisée pour identifier les projets récemment modifiés.
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
   * Nombre de fichiers uploadés par l'utilisateur
   * 
   * Compteur optimisé évitant le transfert des listes complètes.
   * Calculé côté base de données pour les performances.
   */
  @ApiProperty({
    description: 'Nombre de fichiers uploadés par l\'utilisateur',
    example: 2,
    minimum: 0,
  })
  @Expose()
  @Transform(({ value, obj }) => {
    // Transformation pour calculer la longueur ou utiliser une valeur précalculée
    if (typeof value === 'number') {
      return Math.max(0, Math.floor(value)); // Valeur précalculée depuis la DB
    }
    // Fallback : calculer depuis la liste si nécessaire
    if (obj && Array.isArray(obj.uploadedFileIds)) {
      return obj.uploadedFileIds.length;
    }
    return 0;
  })
  uploadedFilesCount: number;

  /**
   * Nombre de fichiers générés par les agents IA
   * 
   * Indicateur de progression et de productivité du projet.
   * Affiché comme badge dans les cartes de projet.
   */
  @ApiProperty({
    description: 'Nombre de fichiers générés par les agents IA',
    example: 5,
    minimum: 0,
  })
  @Expose()
  @Transform(({ value, obj }) => {
    // Transformation pour calculer la longueur ou utiliser une valeur précalculée
    if (typeof value === 'number') {
      return Math.max(0, Math.floor(value)); // Valeur précalculée depuis la DB
    }
    // Fallback : calculer depuis la liste si nécessaire
    if (obj && Array.isArray(obj.generatedFileIds)) {
      return obj.generatedFileIds.length;
    }
    return 0;
  })
  generatedFilesCount: number;

  /**
   * Indicateur de présence de statistiques
   * 
   * Détermine si l'icône de statistiques doit être affichée
   * dans l'interface sans charger les données complètes.
   */
  @ApiProperty({
    description: 'Indique si le projet a des statistiques disponibles',
    example: true,
  })
  @Expose()
  @Transform(({ value, obj }) => {
    // Transformation pour déterminer la présence de statistiques
    if (typeof value === 'boolean') {
      return value; // Valeur précalculée depuis la DB
    }
    // Fallback : vérifier la présence de l'objet statistics
    return obj && obj.statistics !== null && obj.statistics !== undefined;
  })
  hasStatistics: boolean;

  /**
   * Coût total estimé du projet (optionnel)
   * 
   * Information de coût affichée si disponible, sans charger
   * toutes les statistiques détaillées pour les performances.
   */
  @ApiPropertyOptional({
    description: 'Coût total estimé du projet en euros',
    example: 2.47,
    minimum: 0,
  })
  @Expose()
  @Transform(({ value, obj }) => {
    // Transformation pour extraire le coût total des statistiques
    if (typeof value === 'number') {
      return Math.max(0, Number(value.toFixed(2))); // Valeur précalculée
    }
    // Fallback : extraire depuis l'objet statistics si présent
    if (obj && obj.statistics && obj.statistics.costs && typeof obj.statistics.costs.total === 'number') {
      return Math.max(0, Number(obj.statistics.costs.total.toFixed(2)));
    }
    return undefined;
  })
  totalCost?: number;

  // ========================================================================
  // MÉTHODES UTILITAIRES POUR L'AFFICHAGE EN LISTE
  // ========================================================================

  /**
   * Retourne une description tronquée pour l'affichage en carte
   * 
   * @param maxLength Longueur maximale souhaitée (défaut: 100)
   * @returns Description tronquée avec ellipse si nécessaire
   * 
   * @example
   * ```typescript
   * const shortDesc = project.getShortDescription(80);
   * // "Plateforme de vente en ligne avec gestion des stocks et..."
   * ```
   */
  getShortDescription(maxLength: number = 100): string {
    if (!this.description) return '';
    
    if (this.description.length <= maxLength) {
      return this.description;
    }
    
    // Trouve le dernier espace avant la limite pour éviter de couper les mots
    const truncated = this.description.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');
    
    if (lastSpace > maxLength * 0.8) { // Si l'espace est assez proche de la fin
      return truncated.substring(0, lastSpace) + '...';
    }
    
    return truncated + '...';
  }

  /**
   * Retourne le nombre total de fichiers (uploadés + générés)
   * 
   * @returns Somme des fichiers uploadés et générés
   */
  getTotalFilesCount(): number {
    return this.uploadedFilesCount + this.generatedFilesCount;
  }

  /**
   * Vérifie si le projet a des fichiers (uploadés ou générés)
   * 
   * @returns true si au moins un fichier est présent
   */
  hasFiles(): boolean {
    return this.getTotalFilesCount() > 0;
  }

  /**
   * Calcule l'âge du projet en jours
   * 
   * @returns Nombre de jours depuis la création
   */
  getAgeInDays(): number {
    if (!this.createdAt || isNaN(this.createdAt.getTime())) {
      return 0; // Ligne 168 - pour les dates invalides
    }
    
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - this.createdAt.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  }

  /**
   * Retourne une représentation relative de l'âge du projet
   * 
   * @returns Chaîne d'affichage de l'âge ("aujourd'hui", "il y a 3 jours", etc.)
   * 
   * @example
   * ```typescript
   * const ageLabel = project.getRelativeAge();
   * // "il y a 5 jours" ou "aujourd'hui"
   * ```
   */
  getRelativeAge(): string {
    const days = this.getAgeInDays();
    
    if (days === 0) return 'aujourd\'hui';
    if (days === 1) return 'hier';
    if (days < 7) return `il y a ${days} jours`;
    if (days < 30) {
      const weeks = Math.floor(days / 7);
      return weeks === 1 ? 'il y a 1 semaine' : `il y a ${weeks} semaines`;
    }
    if (days < 365) {
      const months = Math.floor(days / 30);
      return months === 1 ? 'il y a 1 mois' : `il y a ${months} mois`;
    }
    
    const years = Math.floor(days / 365);
    return years === 1 ? 'il y a 1 an' : `il y a ${years} ans`;
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
   * Retourne un indicateur de l'activité récente du projet
   * 
   * @returns Label d'activité pour l'affichage
   */
  getActivityIndicator(): 'nouveau' | 'récent' | 'actif' | 'ancien' {
    const ageInDays = this.getAgeInDays();
    const hasGenerated = this.generatedFilesCount > 0;
    const wasModified = this.hasBeenModified();

    if (ageInDays === 0) return 'nouveau';
    if (ageInDays <= 7 && (hasGenerated || wasModified)) return 'récent';
    if (hasGenerated && ageInDays <= 30) return 'actif';
    return 'ancien';
  }

  /**
   * Vérifie si le projet est accessible à l'utilisateur
   * 
   * @returns true si le statut permet l'accès utilisateur
   */
  isAccessible(): boolean {
    return this.status === ProjectStatus.ACTIVE || this.status === ProjectStatus.ARCHIVED;
  }

  /**
   * Retourne la couleur d'affichage basée sur le statut
   * 
   * @returns Code couleur pour l'interface utilisateur
   */
  getStatusColor(): string {
    switch (this.status) {
      case ProjectStatus.ACTIVE:
        return '#10B981'; // Green-500 - actif
      case ProjectStatus.ARCHIVED:
        return '#F59E0B'; // Amber-500 - archivé
      case ProjectStatus.DELETED:
        return '#EF4444'; // Red-500 - supprimé
      default:
        return '#6B7280'; // Gray-500 - statut inconnu (ligne 361)
    }
  }

  /**
   * Retourne le label d'affichage du statut
   * 
   * @returns Label français du statut pour l'interface
   */
  getStatusLabel(): string {
    switch (this.status) {
      case ProjectStatus.ACTIVE:
        return 'Actif';
      case ProjectStatus.ARCHIVED:
        return 'Archivé';
      case ProjectStatus.DELETED:
        return 'Supprimé';
      default:
        return 'Inconnu'; // Ligne 379 - statut inconnu
    }
  }

  /**
   * Vérifie si le projet est considéré comme productif
   * 
   * @returns true si le projet a généré au moins un fichier
   */
  isProductive(): boolean {
    return this.generatedFilesCount > 0;
  }

  /**
   * Retourne un score de complétude du projet (0-100)
   * 
   * @returns Pourcentage de complétude basé sur différents critères
   */
  getCompletionScore(): number {
    let score = 0;
    
    // 25% si des fichiers ont été uploadés
    if (this.uploadedFilesCount > 0) score += 25;
    
    // 40% si des fichiers ont été générés
    if (this.generatedFilesCount > 0) score += 40;
    
    // 25% si des statistiques sont disponibles
    if (this.hasStatistics) score += 25;
    
    // 10% si le projet a une description non-vide
    if (this.description && typeof this.description === 'string' && this.description.trim().length > 0) {
      score += 10;
    }
    
    return Math.min(100, score);
  }

  /**
   * Retourne les informations de coût formatées pour l'affichage
   * 
   * @returns Chaîne formatée du coût ou indication si non disponible
   */
  getFormattedCost(): string {
    if (this.totalCost === undefined || this.totalCost === null) {
      return 'Non calculé';
    }
    
    if (this.totalCost === 0) {
      return 'Gratuit';
    }
    
    return `${this.totalCost.toFixed(2)}€`;
  }

  /**
   * Retourne un résumé compact pour l'affichage en tooltip
   * 
   * @returns Chaîne descriptive complète du projet
   */
  getTooltipSummary(): string {
    const age = this.getRelativeAge();
    const files = this.getTotalFilesCount();
    const cost = this.getFormattedCost();
    const completion = this.getCompletionScore();
    
    return `${this.name} - Créé ${age} - ${files} fichier(s) - ${cost} - ${completion}% complet`;
  }

  /**
   * Génère un résumé du projet pour l'affichage en liste
   * 
   * @returns Chaîne descriptive optimisée pour les listes
   */
  toString(): string {
    const filesInfo = this.hasFiles() ? `, files=${this.getTotalFilesCount()}` : '';
    const costInfo = this.totalCost !== undefined ? `, cost=${this.getFormattedCost()}` : '';
    const activity = this.getActivityIndicator();
    
    return `ProjectListItem[${this.name}](${this.status}, ${activity}, age=${this.getAgeInDays()}d${filesInfo}${costInfo})`;
  }

  /**
   * Crée une version sanitisée pour les logs (sans données sensibles)
   * 
   * SÉCURITÉ CRITIQUE : Aucune donnée utilisateur exposée
   * 
   * @returns Version sécurisée pour les logs de monitoring
   */
  toLogSafeString(): string {
    const age = this.getAgeInDays();
    const files = this.getTotalFilesCount();
    const completion = this.getCompletionScore();
    const activity = this.getActivityIndicator();
    
    return `ProjectListItem[id=${this.id}, status=${this.status}, age=${age}d, files=${files}, completion=${completion}%, activity=${activity}]`;
  }

  /**
   * Retourne les métadonnées essentielles pour l'indexation et le tri
   * 
   * @returns Objet contenant les données clés pour les opérations de liste
   */
  getListMetadata(): {
    id: string;
    status: ProjectStatus;
    ageInDays: number;
    totalFiles: number;
    hasStatistics: boolean;
    activityIndicator: string;
    completionScore: number;
    isProductive: boolean;
  } {
    return {
      id: this.id,
      status: this.status,
      ageInDays: this.getAgeInDays(),
      totalFiles: this.getTotalFilesCount(),
      hasStatistics: this.hasStatistics,
      activityIndicator: this.getActivityIndicator(),
      completionScore: this.getCompletionScore(),
      isProductive: this.isProductive(),
    };
  }

  /**
   * Crée une version allégée pour les réponses rapides
   * 
   * @returns Objet contenant uniquement les champs essentiels
   */
  toLightweight(): {
    id: string;
    name: string;
    status: ProjectStatus;
    createdAt: Date;
    totalFiles: number;
  } {
    return {
      id: this.id,
      name: this.name,
      status: this.status,
      createdAt: this.createdAt,
      totalFiles: this.getTotalFilesCount(),
    };
  }
}