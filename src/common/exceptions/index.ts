/**
 * Index centralisé des exceptions communes du service
 *
 * Facilite l'import des exceptions personnalisées à travers l'application
 * et maintient une organisation claire des types d'erreurs.
 *
 * Les exceptions enrichies fournissent des informations détaillées pour
 * l'audit, le debugging et la sécurité tout en maintenant des messages
 * publics appropriés.
 *
 * @fileoverview Export centralisé des exceptions enrichies
 * @version 2.0.0
 */

// Exceptions spécifiques aux projets avec audit et contexte
export { ProjectNotFoundException } from './project-not-found.exception';

// Exception d'accès avec informations d'audit sécurisé
export { UnauthorizedAccessException } from './unauthorized-access.exception';

// Exception pour opérations invalides
export { InvalidOperationException } from './invalid-operation.exception';

/**
 * Types d'audit pour les exceptions
 */
export interface ExceptionAuditInfo {
  errorCode: string;
  timestamp: Date;
  message: string;
}

export interface ProjectAuditInfo extends ExceptionAuditInfo {
  projectId: string;
  additionalContext?: string;
}

export interface AccessAuditInfo extends ExceptionAuditInfo {
  resourceType: string;
  resourceId?: string;
  userId?: string;
  action?: string;
  publicMessage: string;
}
