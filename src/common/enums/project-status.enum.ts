/**
 * Énumérations et utilitaires pour la gestion des statuts de projets
 * 
 * Ce fichier centralise la définition des statuts de projets et fournit
 * des utilitaires pour la validation et la gestion des transitions d'état.
 * 
 * @fileoverview Gestion centralisée des statuts de projets
 * @version 1.0.0
 */

// Export direct de l'enum Prisma généré pour maintenir la cohérence
export { ProjectStatus } from '@prisma/client';

// ============================================================================
// TYPES ADDITIONNELS
// ============================================================================

/**
 * Type union pour validation runtime des statuts
 */
export type ProjectStatusType = keyof typeof import('@prisma/client').ProjectStatus;

/**
 * Interface décrivant une transition de statut valide
 */
export interface ProjectStatusTransition {
  /** Statut source */
  from: import('@prisma/client').ProjectStatus;
  /** Statuts cibles autorisés */
  to: import('@prisma/client').ProjectStatus[];
}

/**
 * Interface des métadonnées complètes d'un statut
 */
export interface ProjectStatusMetadata {
  /** Le statut concerné */
  status: import('@prisma/client').ProjectStatus;
  /** Label d'affichage français */
  label: string;
  /** Description détaillée du statut */
  description: string;
  /** Code couleur hexadécimal pour l'UI */
  color: string;
  /** Liste des transitions autorisées depuis ce statut */
  allowedTransitions: import('@prisma/client').ProjectStatus[];
}

// ============================================================================
// CONSTANTES ET MÉTADONNÉES
// ============================================================================

/**
 * Métadonnées complètes pour chaque statut de projet
 * Définit les labels, descriptions, couleurs et transitions autorisées
 */
export const PROJECT_STATUS_METADATA: Record<import('@prisma/client').ProjectStatus, ProjectStatusMetadata> = {
  ACTIVE: {
    status: 'ACTIVE' as import('@prisma/client').ProjectStatus,
    label: 'Actif',
    description: 'Projet en cours d\'utilisation, accessible pour consultation et modification',
    color: '#10B981', // Green-500
    allowedTransitions: ['ARCHIVED' as import('@prisma/client').ProjectStatus, 'DELETED' as import('@prisma/client').ProjectStatus],
  },
  ARCHIVED: {
    status: 'ARCHIVED' as import('@prisma/client').ProjectStatus,
    label: 'Archivé',
    description: 'Projet archivé, consultation possible mais masqué par défaut',
    color: '#F59E0B', // Amber-500
    allowedTransitions: ['ACTIVE' as import('@prisma/client').ProjectStatus, 'DELETED' as import('@prisma/client').ProjectStatus],
  },
  DELETED: {
    status: 'DELETED' as import('@prisma/client').ProjectStatus,
    label: 'Supprimé',
    description: 'Projet supprimé (soft delete), inaccessible aux utilisateurs',
    color: '#EF4444', // Red-500
    allowedTransitions: [], // État final, aucune transition sortante
  },
} as const;

/**
 * Matrice des transitions valides entre statuts
 * Utilisée pour la validation des changements d'état
 */
export const VALID_STATUS_TRANSITIONS: Record<import('@prisma/client').ProjectStatus, import('@prisma/client').ProjectStatus[]> = {
  ACTIVE: ['ARCHIVED' as import('@prisma/client').ProjectStatus, 'DELETED' as import('@prisma/client').ProjectStatus],
  ARCHIVED: ['ACTIVE' as import('@prisma/client').ProjectStatus, 'DELETED' as import('@prisma/client').ProjectStatus],
  DELETED: [], // État final
} as const;

/**
 * Labels d'affichage pour chaque statut (français)
 * Séparé pour faciliter la future internationalisation
 */
export const PROJECT_STATUS_LABELS: Record<import('@prisma/client').ProjectStatus, string> = {
  ACTIVE: 'Actif',
  ARCHIVED: 'Archivé',
  DELETED: 'Supprimé',
} as const;

/**
 * Codes couleur hexadécimaux pour l'affichage UI
 * Basés sur la palette Tailwind CSS pour la cohérence
 */
export const PROJECT_STATUS_COLORS: Record<import('@prisma/client').ProjectStatus, string> = {
  ACTIVE: '#10B981',   // Green-500 - état positif
  ARCHIVED: '#F59E0B', // Amber-500 - état neutre/attention
  DELETED: '#EF4444',  // Red-500 - état négatif
} as const;

// ============================================================================
// FONCTIONS UTILITAIRES
// ============================================================================

/**
 * Valide si une chaîne correspond à un statut de projet valide
 * 
 * @param status - La chaîne à valider
 * @returns Type guard indiquant si le statut est valide
 * 
 * @example
 * ```typescript
 * if (isValidProjectStatus(userInput)) {
 *   // userInput est maintenant typé comme ProjectStatus
 *   console.log(`Statut valide: ${userInput}`);
 * }
 * ```
 */
export function isValidProjectStatus(status: string): status is import('@prisma/client').ProjectStatus {
  // ✅ CORRECTION: Validation plus robuste avec vérification de type
  if (typeof status !== 'string') {
    return false;
  }
  // ✅ CORRECTION: Utiliser directement les clés de l'objet au lieu des valeurs
  return Object.prototype.hasOwnProperty.call(PROJECT_STATUS_METADATA, status);
}

/**
 * Valide si une transition entre deux statuts est autorisée
 * 
 * @param from - Statut source
 * @param to - Statut cible
 * @returns true si la transition est valide, false sinon
 * 
 * @example
 * ```typescript
 * const canArchive = isValidStatusTransition(ProjectStatus.ACTIVE, ProjectStatus.ARCHIVED);
 * // true
 * 
 * const canRestore = isValidStatusTransition(ProjectStatus.DELETED, ProjectStatus.ACTIVE);
 * // false - les projets supprimés ne peuvent pas être restaurés
 * ```
 */
export function isValidStatusTransition(
  from: import('@prisma/client').ProjectStatus,
  to: import('@prisma/client').ProjectStatus,
): boolean {
  // ✅ CORRECTION: Validation des inputs avant traitement
  if (!isValidProjectStatus(from) || !isValidProjectStatus(to)) {
    return false;
  }
  
  const allowedTransitions = VALID_STATUS_TRANSITIONS[from];
  if (!allowedTransitions) {
    return false; // Si le statut 'from' est invalide, la transition est impossible
  }
  return allowedTransitions.includes(to);
}

/**
 * ✅ CORRECTION: Fonction utilitaire pour créer une copie profonde sécurisée
 * Protège contre les modifications malveillantes des métadonnées
 */
function createSecureMetadataCopy(metadata: ProjectStatusMetadata): ProjectStatusMetadata {
  // ✅ CORRECTION: Validation et protection contre la corruption des données
  const safeAllowedTransitions = Array.isArray(metadata.allowedTransitions) 
    ? [...metadata.allowedTransitions] 
    : []; // Valeur par défaut sûre si corrompue

  return {
    status: metadata.status || 'ACTIVE' as import('@prisma/client').ProjectStatus,
    label: typeof metadata.label === 'string' ? metadata.label : 'Statut inconnu',
    description: typeof metadata.description === 'string' ? metadata.description : 'Description non disponible',
    color: typeof metadata.color === 'string' ? metadata.color : '#6B7280',
    allowedTransitions: safeAllowedTransitions,
  };
}

/**
 * Récupère les métadonnées complètes d'un statut
 * 
 * @param status - Le statut dont récupérer les métadonnées
 * @returns Métadonnées complètes du statut (copie sécurisée)
 * @throws Error si le statut n'existe pas
 * 
 * @example
 * ```typescript
 * const metadata = getStatusMetadata(ProjectStatus.ACTIVE);
 * console.log(metadata.label); // "Actif"
 * console.log(metadata.color); // "#10B981"
 * ```
 */
export function getStatusMetadata(status: import('@prisma/client').ProjectStatus): ProjectStatusMetadata {
  // ✅ CORRECTION: Validation d'input et protection contre les modifications
  if (!isValidProjectStatus(status)) {
    throw new Error(`Unknown project status: ${status}`);
  }
  
  const metadata = PROJECT_STATUS_METADATA[status];
  
  if (!metadata) {
    throw new Error(`Unknown project status: ${status}`);
  }
  
  // ✅ CORRECTION: Retourner une copie sécurisée au lieu de la référence directe
  return createSecureMetadataCopy(metadata);
}

/**
 * Récupère la liste des statuts vers lesquels une transition est possible
 * 
 * @param currentStatus - Le statut actuel
 * @returns Array des statuts cibles possibles (copie sécurisée)
 * 
 * @example
 * ```typescript
 * const transitions = getAvailableTransitions(ProjectStatus.ACTIVE);
 * // [ProjectStatus.ARCHIVED, ProjectStatus.DELETED]
 * 
 * const noTransitions = getAvailableTransitions(ProjectStatus.DELETED);
 * // [] - état final
 * ```
 */
export function getAvailableTransitions(
  currentStatus: import('@prisma/client').ProjectStatus,
): import('@prisma/client').ProjectStatus[] {
  // ✅ CORRECTION: Validation d'input et protection contre les modifications
  if (!isValidProjectStatus(currentStatus)) {
    return []; // Si le statut est invalide, retourner tableau vide
  }
  
  const transitions = VALID_STATUS_TRANSITIONS[currentStatus];
  if (!transitions) {
    return []; // Si le statut est invalide, retourner tableau vide
  }
  return [...transitions]; // Copie pour éviter les mutations
}

/**
 * Récupère le label d'affichage d'un statut
 * 
 * @param status - Le statut dont récupérer le label
 * @returns Label français du statut
 * 
 * @example
 * ```typescript
 * const label = getStatusLabel(ProjectStatus.ARCHIVED);
 * // "Archivé"
 * ```
 */
export function getStatusLabel(status: import('@prisma/client').ProjectStatus): string {
  // ✅ CORRECTION: Validation et valeur par défaut
  if (!isValidProjectStatus(status)) {
    return 'Statut inconnu';
  }
  return PROJECT_STATUS_LABELS[status];
}

/**
 * Récupère le code couleur d'un statut
 * 
 * @param status - Le statut dont récupérer la couleur
 * @returns Code couleur hexadécimal
 * 
 * @example
 * ```typescript
 * const color = getStatusColor(ProjectStatus.ACTIVE);
 * // "#10B981"
 * ```
 */
export function getStatusColor(status: import('@prisma/client').ProjectStatus): string {
  // ✅ CORRECTION: Validation et valeur par défaut
  if (!isValidProjectStatus(status)) {
    return '#6B7280'; // Gray-500 pour statut inconnu
  }
  return PROJECT_STATUS_COLORS[status];
}

/**
 * Vérifie si un statut est considéré comme "actif" (accessible aux utilisateurs)
 * 
 * @param status - Le statut à vérifier
 * @returns true si le statut permet l'accès utilisateur
 * 
 * @example
 * ```typescript
 * const isUserAccessible = isActiveStatus(ProjectStatus.ACTIVE); // true
 * const isUserAccessible = isActiveStatus(ProjectStatus.DELETED); // false
 * ```
 */
export function isActiveStatus(status: import('@prisma/client').ProjectStatus): boolean {
  return status === 'ACTIVE';
}

/**
 * Vérifie si un statut est considéré comme "archivé"
 * 
 * @param status - Le statut à vérifier
 * @returns true si le statut est archivé
 */
export function isArchivedStatus(status: import('@prisma/client').ProjectStatus): boolean {
  return status === 'ARCHIVED';
}

/**
 * Vérifie si un statut est considéré comme "supprimé"
 * 
 * @param status - Le statut à vérifier
 * @returns true si le statut est supprimé
 */
export function isDeletedStatus(status: import('@prisma/client').ProjectStatus): boolean {
  return status === 'DELETED';
}

// ============================================================================
// EXPORTS DE COMMODITÉ
// ============================================================================

/**
 * Liste de tous les statuts disponibles
 * Utile pour les boucles et validations
 */
export const ALL_PROJECT_STATUSES = Object.values(PROJECT_STATUS_METADATA).map(metadata => metadata.status);

/**
 * Statuts accessibles aux utilisateurs (non supprimés)
 */
export const USER_ACCESSIBLE_STATUSES = ALL_PROJECT_STATUSES.filter(status => !isDeletedStatus(status));

/**
 * Export par défaut des métadonnées pour faciliter l'import
 */
export default PROJECT_STATUS_METADATA;