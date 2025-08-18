/**
 * Entité Project - Modèle de domaine principal du Service de Gestion des Projets (C04)
 *
 * Cette entité encapsule toutes les informations métier relatives à un projet utilisateur
 * et sert de modèle de domaine pour les opérations CRUD et les transformations de données.
 * Elle correspond directement au modèle Prisma Project et assure la cohérence des données.
 *
 * PRINCIPES DE CONCEPTION :
 * - Correspondance exacte avec le schéma Prisma
 * - Validation métier avec class-validator
 * - Méthodes utilitaires pour la logique de domaine
 * - Immutabilité contrôlée des données critiques
 * - Isolation des données par utilisateur (ownerId)
 *
 * SÉCURITÉ :
 * - Validation stricte des entrées utilisateur
 * - Protection contre les injections via sanitisation
 * - Contrôle d'accès par propriété (ownerId)
 * - Audit trail avec timestamps
 *
 * @fileoverview Entité principale du domaine Project
 * @version 1.0.0
 * @since 2025-01-28
 */

import {
  IsString,
  IsUUID,
  IsNotEmpty,
  Length,
  IsOptional,
  IsEnum,
  IsArray,
  IsDate,
  ValidateNested,
  ArrayNotEmpty,
  Matches,
} from 'class-validator';
import { Type, Transform, Exclude, Expose } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProjectStatus } from '../../common/enums/project-status.enum';
import { User } from '../../common/interfaces/user.interface';

/**
 * Interface pour les statistiques de projet (relation optionnelle)
 * Reflète la structure de ProjectStatistics sans créer de dépendance circulaire
 */
export interface ProjectStatisticsData {
  id: string;
  projectId: string;
  costs: Record<string, any>;
  performance: Record<string, any>;
  usage: Record<string, any>;
  lastUpdated: Date;
}

/**
 * Interface pour les données de création d'un projet
 * Utilisée par les factories et les méthodes de création
 */
export interface CreateProjectData {
  name: string;
  description?: string;
  initialPrompt: string;
  uploadedFileIds?: string[];
}

/**
 * Interface pour les données de mise à jour d'un projet
 * Utilisée pour les opérations de modification partielle
 */
export interface UpdateProjectData {
  name?: string;
  description?: string;
  status?: ProjectStatus;
  uploadedFileIds?: string[];
  generatedFileIds?: string[];
}

/**
 * Interface pour un résumé de projet (vue simplifiée)
 * Utilisée pour les listings et aperçus
 */
export interface ProjectSummary {
  id: string;
  name: string;
  status: ProjectStatus;
  createdAt: Date;
  generatedFilesCount: number;
  hasStatistics: boolean;
}

/**
 * Interface pour les données d'export de projet
 * Utilisée par le service d'export
 */
export interface ProjectExportData {
  id: string;
  name: string;
  description?: string;
  initialPrompt: string;
  uploadedFileIds: string[];
  generatedFileIds: string[];
  createdAt: Date;
  statistics?: ProjectStatisticsData;
}

/**
 * Entité principale représentant un projet utilisateur
 *
 * Cette classe encapsule toutes les informations d'un projet et fournit
 * les méthodes métier pour la gestion du cycle de vie, des fichiers et des états.
 *
 * CORRESPONDANCE PRISMA :
 * - Tous les champs correspondent exactement au modèle Project
 * - Les types TypeScript reflètent les types PostgreSQL
 * - Les contraintes de validation respectent le schéma DB
 *
 * VALIDATION :
 * - Validation stricte avec class-validator
 * - Sanitisation des entrées utilisateur
 * - Cohérence des données métier
 *
 * @example
 * ```typescript
 * const project = new ProjectEntity();
 * project.id = '123e4567-e89b-12d3-a456-426614174000';
 * project.name = 'Mon Application Web';
 * project.description = 'Application e-commerce moderne';
 * project.initialPrompt = 'Créer une application de vente en ligne...';
 * project.status = ProjectStatus.ACTIVE;
 * project.ownerId = 'user-123';
 * project.uploadedFileIds = ['file-1', 'file-2'];
 * project.generatedFileIds = [];
 * project.createdAt = new Date();
 * project.updatedAt = new Date();
 * ```
 */
export class ProjectEntity {
  /**
   * Identifiant unique du projet (UUID v4)
   *
   * Généré automatiquement par PostgreSQL lors de la création.
   * Utilisé comme clé primaire et référence inter-services.
   *
   * IMMUTABLE : Ne peut pas être modifié après création
   */
  @ApiProperty({
    description: 'Identifiant unique du projet (UUID)',
    example: '550e8400-e29b-41d4-a716-446655440000',
    format: 'uuid',
  })
  @IsUUID(4, { message: "L'identifiant doit être un UUID v4 valide" })
  @IsNotEmpty({ message: "L'identifiant du projet est obligatoire" })
  @Expose()
  id: string;

  /**
   * Nom du projet défini par l'utilisateur
   *
   * Identifiant principal visible dans l'interface utilisateur.
   * Doit être unique au niveau utilisateur pour éviter la confusion.
   */
  @ApiProperty({
    description: "Nom du projet défini par l'utilisateur",
    example: 'Application E-commerce',
    minLength: 1,
    maxLength: 100,
  })
  @IsString({ message: 'Le nom du projet doit être une chaîne de caractères' })
  @IsNotEmpty({ message: 'Le nom du projet est obligatoire' })
  @Length(1, 100, {
    message: 'Le nom du projet doit contenir entre 1 et 100 caractères',
  })
  @Transform(({ value }) => {
    // Sanitisation : suppression des caractères de contrôle et espaces multiples
    if (typeof value === 'string') {
      return value
        .replace(/[\u0000-\u001f\u007f-\u009f]/g, '') // Supprime caractères de contrôle
        .replace(/\s+/g, ' ') // Remplace espaces multiples par un seul
        .trim(); // Supprime espaces en début/fin
    }
    return value;
  })
  @Expose()
  name: string;

  /**
   * Description détaillée du projet (optionnelle)
   *
   * Contexte supplémentaire fourni par l'utilisateur pour
   * enrichir la compréhension du projet. Support du Markdown simple.
   */
  @ApiPropertyOptional({
    description: 'Description détaillée du projet (support Markdown)',
    example:
      'Plateforme de vente en ligne avec gestion des stocks et paiements',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString({ message: 'La description doit être une chaîne de caractères' })
  @Length(0, 1000, {
    message: 'La description ne peut pas dépasser 1000 caractères',
  })
  @Transform(({ value }) => {
    // Sanitisation de la description tout en préservant le Markdown simple
    if (typeof value === 'string' && value.length > 0) {
      return value
        .replace(/[\u0000-\u001f\u007f-\u009f]/g, '') // Supprime caractères de contrôle
        .trim();
    }
    return value;
  })
  @Expose()
  description?: string;

  /**
   * Prompt initial fourni lors de la création
   *
   * Demande originale de l'utilisateur qui a déclenché
   * le processus de génération documentaire.
   *
   * IMMUTABLE : Préservé pour l'audit et la traçabilité
   */
  @ApiProperty({
    description: 'Prompt initial ayant déclenché la création du projet',
    example:
      'Je souhaite créer une application de gestion des ressources humaines avec authentification, gestion des employés, calcul de paie et reporting.',
    minLength: 10,
    maxLength: 5000,
  })
  @IsString({ message: 'Le prompt initial doit être une chaîne de caractères' })
  @IsNotEmpty({ message: 'Le prompt initial est obligatoire' })
  @Length(10, 5000, {
    message: 'Le prompt initial doit contenir entre 10 et 5000 caractères',
  })
  @Transform(({ value }) => {
    // Sanitisation tout en préservant les retours ligne et la structure
    if (typeof value === 'string') {
      return value
        .replace(/[\u0000-\u001f\u007f-\u009f]/g, (char) => {
          // Préserve les retours ligne et tabulations
          return ['\n', '\r', '\t'].includes(char) ? char : '';
        })
        .trim();
    }
    return value;
  })
  @Expose()
  initialPrompt: string;

  /**
   * Statut actuel du projet
   *
   * État du cycle de vie du projet contrôlant la visibilité
   * et les opérations autorisées.
   */
  @ApiProperty({
    description: 'Statut actuel du projet',
    enum: ProjectStatus,
    example: ProjectStatus.ACTIVE,
  })
  @IsEnum(ProjectStatus, {
    message:
      'Le statut doit être une valeur valide (ACTIVE, ARCHIVED, DELETED)',
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
    description: "Identifiants des fichiers uploadés par l'utilisateur",
    example: ['file1-uuid', 'file2-uuid'],
    type: [String],
  })
  @IsArray({
    message: 'Les identifiants de fichiers uploadés doivent former un tableau',
  })
  @IsUUID(4, {
    each: true,
    message:
      'Chaque identifiant de fichier uploadé doit être un UUID v4 valide',
  })
  @Transform(({ value }) => {
    // Sécurisation du tableau : filtrage et validation
    if (!Array.isArray(value)) return [];
    return value
      .filter((item) => typeof item === 'string' && item.length > 0)
      .filter((item, index, arr) => arr.indexOf(item) === index); // Supprime doublons
  })
  @Expose()
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
  @IsArray({
    message: 'Les identifiants de fichiers générés doivent former un tableau',
  })
  @IsUUID(4, {
    each: true,
    message: 'Chaque identifiant de fichier généré doit être un UUID v4 valide',
  })
  @Transform(({ value }) => {
    // Sécurisation du tableau avec préservation de l'ordre chronologique
    if (!Array.isArray(value)) return [];
    return value
      .filter((item) => typeof item === 'string' && item.length > 0)
      .filter((item, index, arr) => arr.indexOf(item) === index); // Supprime doublons
  })
  @Expose()
  generatedFileIds: string[];

  /**
   * Identifiant du propriétaire du projet
   *
   * Référence vers l'utilisateur propriétaire, utilisée pour
   * l'isolation des données et le contrôle d'accès.
   *
   * IMMUTABLE : Ne peut pas être modifié après création
   */
  @ApiProperty({
    description: 'Identifiant du propriétaire du projet',
    example: '123e4567-e89b-12d3-a456-426614174000',
    format: 'uuid',
  })
  @IsUUID(4, {
    message: "L'identifiant du propriétaire doit être un UUID v4 valide",
  })
  @IsNotEmpty({ message: "L'identifiant du propriétaire est obligatoire" })
  @Exclude() // Masqué dans les réponses API pour la sécurité
  ownerId: string;

  /**
   * Date de création du projet
   *
   * Horodatage UTC de la création initiale du projet.
   *
   * IMMUTABLE : Défini automatiquement lors de la création
   */
  @ApiProperty({
    description: 'Date de création du projet',
    example: '2024-08-08T10:30:00Z',
    type: 'string',
    format: 'date-time',
  })
  @IsDate({ message: 'La date de création doit être une date valide' })
  @Type(() => Date)
  @Expose()
  createdAt: Date;

  /**
   * Date de dernière modification
   *
   * Horodatage UTC de la dernière modification des métadonnées
   * du projet. Mis à jour automatiquement par Prisma.
   */
  @ApiProperty({
    description: 'Date de dernière modification du projet',
    example: '2024-08-08T14:30:00Z',
    type: 'string',
    format: 'date-time',
  })
  @IsDate({ message: 'La date de modification doit être une date valide' })
  @Type(() => Date)
  @Expose()
  updatedAt: Date;

  /**
   * Statistiques du projet (relation optionnelle)
   *
   * Chargement lazy des statistiques pour éviter les surcharges.
   * Disponible uniquement si des données ont été collectées.
   */
  @ApiPropertyOptional({
    description: "Statistiques de performance et d'usage du projet",
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => Object) // Validation flexible pour les données JSON
  @Expose()
  statistics?: ProjectStatisticsData;

  // ========================================================================
  // MÉTHODES DE VALIDATION STATIQUES
  // ========================================================================

  /**
   * Valide si un nom de projet est acceptable
   *
   * @param name - Le nom à valider
   * @returns true si le nom est valide, false sinon
   *
   * @example
   * ```typescript
   * const isValid = ProjectEntity.validateName('Mon Super Projet'); // true
   * const isInvalid = ProjectEntity.validateName(''); // false
   * ```
   */
  static validateName(name: string): boolean {
    if (typeof name !== 'string') return false;

    const trimmedName = name.trim();
    if (trimmedName.length === 0 || trimmedName.length > 100) return false;

    // Vérifie qu'il n'y a pas que des caractères spéciaux
    const visibleChars = trimmedName.replace(/[\s\-_\.]/g, '');
    return visibleChars.length > 0;
  }

  /**
   * Valide si un prompt initial est acceptable
   *
   * @param prompt - Le prompt à valider
   * @returns true si le prompt est valide, false sinon
   */
  static validatePrompt(prompt: string): boolean {
    if (typeof prompt !== 'string') return false;

    const trimmedPrompt = prompt.trim();
    if (trimmedPrompt.length < 10 || trimmedPrompt.length > 5000) return false;

    // Vérifie qu'il y a du contenu significatif (pas que des espaces/ponctuation)
    const significantContent = trimmedPrompt.replace(/[\s\.\,\!\?\;\:]/g, '');
    return significantContent.length >= 5;
  }

  /**
   * Valide si un tableau d'identifiants de fichiers est correct
   *
   * @param fileIds - Le tableau d'IDs à valider
   * @returns true si tous les IDs sont valides, false sinon
   */
  static validateFileIds(fileIds: string[]): boolean {
    if (!Array.isArray(fileIds)) return false;

    // Regex UUID v4 plus stricte
    const uuidV4Regex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    return fileIds.every(
      (id) =>
        typeof id === 'string' && id.length === 36 && uuidV4Regex.test(id),
    );
  }

  /**
   * Valide si un identifiant utilisateur est correct
   *
   * @param userId - L'ID utilisateur à valider
   * @returns true si l'ID est valide, false sinon
   */
  static validateUserId(userId: string): boolean {
    if (typeof userId !== 'string') return false;

    const uuidV4Regex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return userId.length === 36 && uuidV4Regex.test(userId);
  }

  // ========================================================================
  // MÉTHODES DE VÉRIFICATION D'ÉTAT
  // ========================================================================

  /**
   * Vérifie si le projet est dans l'état ACTIVE
   *
   * @returns true si le projet est actif
   */
  isActive(): boolean {
    return this.status === ProjectStatus.ACTIVE;
  }

  /**
   * Vérifie si le projet est dans l'état ARCHIVED
   *
   * @returns true si le projet est archivé
   */
  isArchived(): boolean {
    return this.status === ProjectStatus.ARCHIVED;
  }

  /**
   * Vérifie si le projet est dans l'état DELETED
   *
   * @returns true si le projet est supprimé
   */
  isDeleted(): boolean {
    return this.status === ProjectStatus.DELETED;
  }

  /**
   * Vérifie si le projet est accessible aux utilisateurs
   *
   * @returns true si le projet est accessible (ACTIVE ou ARCHIVED)
   */
  isAccessible(): boolean {
    return this.isActive() || this.isArchived();
  }

  /**
   * Vérifie si le projet peut être modifié
   *
   * @returns true si le projet peut être modifié (ACTIVE uniquement)
   */
  isModifiable(): boolean {
    return this.isActive();
  }

  // ========================================================================
  // MÉTHODES DE GESTION DES FICHIERS
  // ========================================================================

  /**
   * Ajoute un fichier généré à la liste
   *
   * @param fileId - L'identifiant du fichier à ajouter
   * @throws Error si l'ID de fichier est invalide ou déjà présent
   *
   * @example
   * ```typescript
   * project.addGeneratedFile('generated-doc-123');
   * ```
   */
  addGeneratedFile(fileId: string): void {
    if (!ProjectEntity.validateFileIds([fileId])) {
      throw new Error(`Invalid file ID: ${fileId}`);
    }

    if (this.generatedFileIds.includes(fileId)) {
      throw new Error(`File ID already exists: ${fileId}`);
    }

    this.generatedFileIds.push(fileId);
    this.updatedAt = new Date();
  }

  /**
   * Supprime un fichier généré de la liste
   *
   * @param fileId - L'identifiant du fichier à supprimer
   * @returns true si le fichier a été supprimé, false s'il n'était pas présent
   */
  removeGeneratedFile(fileId: string): boolean {
    const index = this.generatedFileIds.indexOf(fileId);
    if (index === -1) return false;

    this.generatedFileIds.splice(index, 1);
    this.updatedAt = new Date();
    return true;
  }

  /**
   * Ajoute plusieurs fichiers générés à la liste
   *
   * @param fileIds - Les identifiants des fichiers à ajouter
   * @throws Error si un des IDs est invalide
   */
  addGeneratedFiles(fileIds: string[]): void {
    if (!ProjectEntity.validateFileIds(fileIds)) {
      throw new Error('One or more file IDs are invalid');
    }

    // Filtre les doublons existants
    const newFileIds = fileIds.filter(
      (id) => !this.generatedFileIds.includes(id),
    );

    if (newFileIds.length > 0) {
      this.generatedFileIds.push(...newFileIds);
      this.updatedAt = new Date();
    }
  }

  /**
   * Remplace complètement la liste des fichiers générés
   *
   * @param fileIds - La nouvelle liste d'identifiants
   * @throws Error si un des IDs est invalide
   */
  setGeneratedFiles(fileIds: string[]): void {
    if (!ProjectEntity.validateFileIds(fileIds)) {
      throw new Error('One or more file IDs are invalid');
    }

    // Supprime les doublons
    const uniqueFileIds = [...new Set(fileIds)];

    this.generatedFileIds = uniqueFileIds;
    this.updatedAt = new Date();
  }

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
   * Retourne le nombre de fichiers par catégorie
   *
   * @returns Objet avec les comptages détaillés
   */
  getFileCount(): { uploaded: number; generated: number; total: number } {
    const uploaded = this.uploadedFileIds?.length ?? 0;
    const generated = this.generatedFileIds?.length ?? 0;

    return {
      uploaded,
      generated,
      total: uploaded + generated,
    };
  }

  // ========================================================================
  // MÉTHODES DE TRANSITION D'ÉTAT
  // ========================================================================

  /**
   * Archive le projet (ACTIVE → ARCHIVED)
   *
   * @throws Error si la transition n'est pas valide
   */
  archive(): void {
    if (!this.isActive()) {
      throw new Error(`Cannot archive project in status: ${this.status}`);
    }

    this.status = ProjectStatus.ARCHIVED;
    this.updatedAt = new Date();
  }

  /**
   * Restaure un projet archivé (ARCHIVED → ACTIVE)
   *
   * @throws Error si la transition n'est pas valide
   */
  restore(): void {
    if (!this.isArchived()) {
      throw new Error(`Cannot restore project in status: ${this.status}`);
    }

    this.status = ProjectStatus.ACTIVE;
    this.updatedAt = new Date();
  }

  /**
   * Supprime logiquement le projet (ACTIVE|ARCHIVED → DELETED)
   *
   * @throws Error si le projet est déjà supprimé
   */
  softDelete(): void {
    if (this.isDeleted()) {
      throw new Error('Project is already deleted');
    }

    this.status = ProjectStatus.DELETED;
    this.updatedAt = new Date();
  }

  /**
   * Vérifie si une transition d'état est possible
   *
   * @param newStatus - Le nouveau statut souhaité
   * @returns true si la transition est valide
   */
  canTransitionTo(newStatus: ProjectStatus): boolean {
    if (this.status === newStatus) return true; // Pas de changement

    switch (this.status) {
      case ProjectStatus.ACTIVE:
        return (
          newStatus === ProjectStatus.ARCHIVED ||
          newStatus === ProjectStatus.DELETED
        );
      case ProjectStatus.ARCHIVED:
        return (
          newStatus === ProjectStatus.ACTIVE ||
          newStatus === ProjectStatus.DELETED
        );
      case ProjectStatus.DELETED:
        return false; // État final, aucune transition possible
      default:
        return false;
    }
  }

  // ========================================================================
  // MÉTHODES DE TRANSFORMATION ET D'EXPORT
  // ========================================================================

  /**
   * Génère un résumé du projet pour les listings
   *
   * @returns Vue simplifiée du projet
   */
  toSummary(): ProjectSummary {
    return {
      id: this.id,
      name: this.name,
      status: this.status,
      createdAt: this.createdAt,
      generatedFilesCount: this.generatedFileIds?.length ?? 0,
      hasStatistics: this.statistics !== undefined,
    };
  }

  /**
   * Prépare les données pour l'export
   *
   * @returns Données structurées pour l'export
   */
  toExport(): ProjectExportData {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      initialPrompt: this.initialPrompt,
      uploadedFileIds: [...(this.uploadedFileIds ?? [])],
      generatedFileIds: [...(this.generatedFileIds ?? [])],
      createdAt: this.createdAt,
      statistics: this.statistics ? { ...this.statistics } : undefined,
    };
  }

  /**
   * Vérifie si le projet appartient à un utilisateur donné
   *
   * @param user - L'utilisateur à vérifier
   * @returns true si l'utilisateur est propriétaire
   */
  belongsToUser(user: User): boolean {
    return this.ownerId === user.id;
  }

  /**
   * Vérifie si le projet appartient à un utilisateur par ID
   *
   * @param userId - L'ID de l'utilisateur à vérifier
   * @returns true si l'utilisateur est propriétaire
   */
  belongsToUserId(userId: string): boolean {
    return this.ownerId === userId;
  }

  // ========================================================================
  // MÉTHODES UTILITAIRES ET MÉTADONNÉES
  // ========================================================================

  /**
   * Calcule l'âge du projet en jours
   *
   * @returns Nombre de jours depuis la création
   */
  getAgeInDays(): number {
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - this.createdAt.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
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
   * Vérifie si le projet est considéré comme "récent"
   *
   * @returns true si le projet a été créé il y a moins de 7 jours
   */
  isRecent(): boolean {
    return this.getAgeInDays() <= 7;
  }

  /**
   * Estime la complexité du projet basée sur le prompt initial
   *
   * @returns Niveau de complexité estimé
   */
  getComplexityEstimate(): 'low' | 'medium' | 'high' {
    if (!this.initialPrompt) return 'low';

    const length = this.initialPrompt.length;
    const wordCount = this.initialPrompt.split(/\s+/).length;

    if (length < 50 && wordCount < 10) return 'low';
    if (length < 200 && wordCount < 35) return 'medium';
    return 'high';
  }

  /**
   * Retourne l'état d'activité du projet
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
   * Vérifie si le projet a des statistiques disponibles
   *
   * @returns true si des statistiques sont présentes
   */
  hasStatistics(): boolean {
    return this.statistics !== undefined && this.statistics !== null;
  }

  /**
   * Génère une représentation textuelle du projet
   *
   * @returns Chaîne descriptive du projet
   */
  toString(): string {
    const filesInfo =
      this.getFileCount().total > 0
        ? `, files=${this.getFileCount().total}`
        : '';
    const ageInfo = `, age=${this.getAgeInDays()}d`;

    return `Project[${this.name}](${this.status}${ageInfo}${filesInfo})`;
  }

  /**
   * Crée une version sécurisée pour les logs (sans données sensibles)
   *
   * SÉCURITÉ CRITIQUE : Aucune donnée utilisateur exposée
   *
   * @returns Version sécurisée pour les logs
   */
  toLogSafeString(): string {
    const age = this.getAgeInDays();
    const filesCount = this.getFileCount().total;
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
    isAccessible: boolean;
    isModifiable: boolean;
  } {
    return {
      id: this.id,
      status: this.status,
      ageInDays: this.getAgeInDays(),
      totalFiles: this.getFileCount().total,
      hasStatistics: this.hasStatistics(),
      complexity: this.getComplexityEstimate(),
      activityLevel: this.getActivityLevel(),
      isAccessible: this.isAccessible(),
      isModifiable: this.isModifiable(),
    };
  }

  // ========================================================================
  // MÉTHODES FACTORY STATIQUES
  // ========================================================================

  /**
   * Crée une nouvelle instance de ProjectEntity avec validation
   *
   * @param data - Données de création du projet
   * @param ownerId - ID du propriétaire
   * @returns Nouvelle instance validée
   * @throws Error si les données sont invalides
   */
  static create(data: CreateProjectData, ownerId: string): ProjectEntity {
    // Validation des paramètres
    if (!ProjectEntity.validateName(data.name)) {
      throw new Error('Invalid project name');
    }
    if (!ProjectEntity.validatePrompt(data.initialPrompt)) {
      throw new Error('Invalid initial prompt');
    }
    if (!ProjectEntity.validateUserId(ownerId)) {
      throw new Error('Invalid owner ID');
    }
    if (
      data.uploadedFileIds &&
      !ProjectEntity.validateFileIds(data.uploadedFileIds)
    ) {
      throw new Error('Invalid uploaded file IDs');
    }

    const project = new ProjectEntity();

    // Génération d'un UUID v4 pour l'ID (normalement fait par la DB)
    project.id = this.generateUUID();
    project.name = data.name.trim();
    project.description = data.description?.trim() || undefined;
    project.initialPrompt = data.initialPrompt.trim();
    project.status = ProjectStatus.ACTIVE;
    project.uploadedFileIds = data.uploadedFileIds
      ? [...data.uploadedFileIds]
      : [];
    project.generatedFileIds = [];
    project.ownerId = ownerId;

    const now = new Date();
    project.createdAt = now;
    project.updatedAt = now;

    return project;
  }

  /**
   * Génère un UUID v4 simple (à remplacer par une librairie en production)
   *
   * @returns UUID v4 généré
   * @private
   */
  private static generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /**
   * Met à jour une instance existante avec de nouvelles données
   *
   * @param project - L'instance à mettre à jour
   * @param data - Nouvelles données
   * @throws Error si les données sont invalides ou les transitions illégales
   */
  static update(project: ProjectEntity, data: UpdateProjectData): void {
    // Validation des nouveaux champs
    if (data.name !== undefined && !ProjectEntity.validateName(data.name)) {
      throw new Error('Invalid project name');
    }
    if (
      data.uploadedFileIds !== undefined &&
      !ProjectEntity.validateFileIds(data.uploadedFileIds)
    ) {
      throw new Error('Invalid uploaded file IDs');
    }
    if (
      data.generatedFileIds !== undefined &&
      !ProjectEntity.validateFileIds(data.generatedFileIds)
    ) {
      throw new Error('Invalid generated file IDs');
    }
    if (data.status !== undefined && !project.canTransitionTo(data.status)) {
      throw new Error(
        `Invalid status transition from ${project.status} to ${data.status}`,
      );
    }

    // Application des modifications
    if (data.name !== undefined) {
      project.name = data.name.trim();
    }
    if (data.description !== undefined) {
      project.description = data.description.trim() || undefined;
    }
    if (data.status !== undefined) {
      project.status = data.status;
    }
    if (data.uploadedFileIds !== undefined) {
      project.uploadedFileIds = [...data.uploadedFileIds];
    }
    if (data.generatedFileIds !== undefined) {
      project.generatedFileIds = [...data.generatedFileIds];
    }

    project.updatedAt = new Date();
  }
}
