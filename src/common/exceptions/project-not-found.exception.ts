import { NotFoundException } from '@nestjs/common';

/**
 * Exception levée quand un projet demandé n'existe pas
 * 
 * Hérite de NotFoundException (404) pour une réponse HTTP appropriée.
 * Fournit un message d'erreur contextualisé avec l'ID du projet et
 * des informations détaillées pour l'audit et le debugging.
 * 
 * @example
 * ```typescript
 * throw new ProjectNotFoundException('123e4567-e89b-12d3-a456-426614174000');
 * throw new ProjectNotFoundException('invalid-id', 'User attempted to access archived project');
 * ```
 */
export class ProjectNotFoundException extends NotFoundException {
  /**
   * ID du projet qui n'a pas été trouvé
   */
  readonly projectId: string;

  /**
   * Timestamp de l'exception pour l'audit
   */
  readonly timestamp: Date;

  /**
   * Code d'erreur standardisé pour l'identification programmatique
   */
  readonly errorCode: string = 'PROJECT_NOT_FOUND';

  /**
   * Contexte additionnel optionnel pour le debugging
   */
  readonly additionalContext?: string;

  /**
   * Crée une nouvelle instance de ProjectNotFoundException
   * 
   * @param projectId - L'ID du projet non trouvé (ne doit pas être vide)
   * @param additionalContext - Contexte additionnel optionnel pour le debugging
   * 
   * @throws {Error} Si projectId est vide ou invalide
   */
  constructor(projectId: string, additionalContext?: string) {
    // Validation de l'ID du projet
    if (!projectId || typeof projectId !== 'string' || projectId.trim().length === 0) {
      throw new Error('ProjectId cannot be empty when creating ProjectNotFoundException');
    }

    // Génération du message d'erreur approprié
    const baseMessage = `Project with ID "${projectId}" not found`;
    const fullMessage = additionalContext 
      ? `${baseMessage}: ${additionalContext}`
      : baseMessage;

    // Appel du constructeur parent
    super(fullMessage);

    // Initialisation des propriétés spécifiques
    this.projectId = projectId;
    this.timestamp = new Date();
    this.additionalContext = additionalContext;

    // Conservation du nom de l'exception pour le stack trace
    this.name = 'ProjectNotFoundException';

    // Capture du stack trace si disponible (Node.js)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ProjectNotFoundException);
    }
  }

  /**
   * Retourne les informations d'audit pour logging sécurisé
   * 
   * @returns Objet contenant les informations d'audit
   */
  getAuditInfo(): {
    errorCode: string;
    projectId: string;
    timestamp: Date;
    additionalContext?: string;
    message: string;
  } {
    return {
      errorCode: this.errorCode,
      projectId: this.projectId,
      timestamp: this.timestamp,
      additionalContext: this.additionalContext,
      message: this.message,
    };
  }

  /**
   * Sérialise l'exception pour les logs JSON
   * 
   * @returns Représentation JSON sérialisable
   */
  toJSON(): Record<string, any> {
    return {
      name: this.name,
      message: this.message,
      errorCode: this.errorCode,
      projectId: this.projectId,
      timestamp: this.timestamp.toISOString(),
      additionalContext: this.additionalContext,
      stack: this.stack,
    };
  }

  /**
   * Crée une version sanitisée de l'exception pour l'API publique
   * (sans informations sensibles)
   * 
   * @returns Version publique sécurisée
   */
  toPublicError(): {
    message: string;
    errorCode: string;
    timestamp: string;
  } {
    return {
      message: `Project with ID "${this.projectId}" not found`,
      errorCode: this.errorCode,
      timestamp: this.timestamp.toISOString(),
    };
  }
}