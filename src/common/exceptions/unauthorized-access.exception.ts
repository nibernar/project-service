import { ForbiddenException } from '@nestjs/common';

/**
 * Exception levée quand un utilisateur tente d'accéder à une ressource
 * sans avoir les permissions nécessaires
 * 
 * Hérite de ForbiddenException (403) car l'utilisateur est authentifié
 * mais n'a pas les permissions nécessaires. Cette exception fournit
 * des informations détaillées pour l'audit tout en maintenant des
 * messages sécurisés pour l'utilisateur final.
 * 
 * @example
 * ```typescript
 * throw new UnauthorizedAccessException();
 * throw new UnauthorizedAccessException('project', 'proj-123', 'user-456', 'delete');
 * throw new UnauthorizedAccessException('statistics', 'stat-789', 'user-123', 'view');
 * ```
 */
export class UnauthorizedAccessException extends ForbiddenException {
  /**
   * Type de ressource à laquelle l'accès a été tenté
   */
  readonly resourceType: string;

  /**
   * ID de la ressource spécifique (optionnel pour la sécurité)
   */
  readonly resourceId?: string;

  /**
   * ID de l'utilisateur qui a tenté l'accès (pour l'audit)
   */
  readonly userId?: string;

  /**
   * Action qui a été tentée (read, write, delete, etc.)
   */
  readonly action?: string;

  /**
   * Timestamp de la tentative d'accès pour l'audit
   */
  readonly timestamp: Date;

  /**
   * Code d'erreur standardisé pour l'identification programmatique
   */
  readonly errorCode: string = 'UNAUTHORIZED_ACCESS';

  /**
   * Crée une nouvelle instance de UnauthorizedAccessException
   * 
   * @param resourceType - Type de ressource (par défaut: undefined pour message générique)
   * @param resourceId - ID de la ressource (optionnel, pour l'audit interne)
   * @param userId - ID de l'utilisateur (optionnel, pour l'audit interne) 
   * @param action - Action tentée (optionnel, pour l'audit interne)
   */
  constructor(
    resourceType?: string,
    resourceId?: string,
    userId?: string,
    action?: string
  ) {
    // Génération du message d'erreur pour l'utilisateur
    const publicMessage = UnauthorizedAccessException.generatePublicMessage(resourceType, action);

    // Appel du constructeur parent avec le message public
    super(publicMessage);

    // Initialisation des propriétés pour l'audit interne
    // CORRECTION: Préserver les chaînes vides au lieu de les remplacer par 'project'
    this.resourceType = resourceType !== undefined ? resourceType : 'project';
    this.resourceId = resourceId;
    this.userId = userId;
    this.action = action;
    this.timestamp = new Date();

    // Conservation du nom de l'exception pour le stack trace
    this.name = 'UnauthorizedAccessException';

    // Capture du stack trace si disponible (Node.js)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, UnauthorizedAccessException);
    }
  }

  /**
   * Génère un message d'erreur public
   * 
   * @param resourceType - Type de ressource
   * @param action - Action tentée
   * @returns Message d'erreur pour l'utilisateur
   */
  private static generatePublicMessage(resourceType?: string, action?: string): string {
    // Message générique si pas de type de ressource
    if (!resourceType) {
      return 'You do not have permission to access this resource';
    }

    // Si une action est fournie, l'inclure dans le message
    if (action) {
      return `You do not have permission to ${action} this ${resourceType}`;
    }
    
    // Message standard avec type de ressource (support complet Unicode et types custom)
    return `You do not have permission to access this ${resourceType}`;
  }

  /**
   * Retourne les informations d'audit complètes pour logging sécurisé
   * 
   * Cette méthode fournit toutes les informations nécessaires pour
   * l'audit de sécurité et la détection d'intrusions.
   * 
   * @returns Objet contenant toutes les informations d'audit
   */
  getAuditInfo(): {
    errorCode: string;
    resourceType: string;
    resourceId?: string;
    userId?: string;
    action?: string;
    timestamp: Date;
    message: string;
    publicMessage: string;
  } {
    return {
      errorCode: this.errorCode,
      resourceType: this.resourceType,
      resourceId: this.resourceId,
      userId: this.userId,
      action: this.action,
      timestamp: this.timestamp,
      message: this.generateInternalMessage(),
      publicMessage: this.message,
    };
  }

  /**
   * Génère un message détaillé pour l'audit interne
   * 
   * @returns Message détaillé pour les logs internes
   */
  private generateInternalMessage(): string {
    let message = 'Unauthorized access attempt';
    
    // Format spécifique : "by user X to ACTION RESOURCETYPE with ID Y"
    if (this.userId) {
      message += ` by user ${this.userId}`;
    }
    
    if (this.action && this.resourceType) {
      message += ` to ${this.action} ${this.resourceType}`;
    } else if (this.resourceType) {
      message += ` to ${this.resourceType}`;
    }
    
    if (this.resourceId) {
      message += ` with ID ${this.resourceId}`;
    }

    return message;
  }

  /**
   * Sérialise l'exception pour les logs JSON sécurisés
   * 
   * @param includeResourceId - Inclure l'ID de ressource (défaut: false pour la sécurité)
   * @returns Représentation JSON sérialisable
   */
  toJSON(includeResourceId: boolean = false): Record<string, any> {
    const baseInfo = {
      name: this.name,
      message: this.message,
      errorCode: this.errorCode,
      resourceType: this.resourceType,
      action: this.action,
      timestamp: this.timestamp.toISOString(),
      stack: this.stack,
    };

    // Inclusion conditionnelle des informations sensibles
    if (includeResourceId && this.resourceId) {
      return {
        ...baseInfo,
        resourceId: this.resourceId,
      };
    }

    return baseInfo;
  }

  /**
   * Crée une version sanitisée de l'exception pour l'API publique
   * (sans aucune information sensible)
   * 
   * @returns Version publique totalement sécurisée
   */
  toPublicError(): {
    message: string;
    errorCode: string;
    timestamp: string;
  } {
    return {
      message: 'You do not have permission to access this resource',
      errorCode: this.errorCode,
      timestamp: this.timestamp.toISOString(),
    };
  }

  /**
   * Vérifie si cette tentative d'accès correspond à un pattern suspect
   * 
   * @param recentAttempts - Nombre de tentatives récentes du même utilisateur
   * @returns true si le pattern semble suspect
   */
  isSuspiciousActivity(recentAttempts: number = 0): boolean {
    // Pattern suspect si :
    // - Tentatives multiples rapprochées
    // - Accès à des ressources sensibles sans contexte valide
    // - Actions administratives sans autorisation
    
    if (recentAttempts > 5) {
      return true;
    }

    if (this.action && ['delete', 'admin', 'modify'].includes(this.action.toLowerCase())) {
      return true;
    }

    return false;
  }

  /**
   * Génère un hash unique pour cette tentative d'accès (pour déduplication)
   * 
   * @returns Hash unique basé sur les propriétés de l'exception
   */
  getAttemptHash(): string {
    const components = [
      this.userId || 'anonymous',
      this.resourceType,
      this.action || 'access',
      this.timestamp.toISOString().substring(0, 13), // Précision à l'heure
    ];

    return Buffer.from(components.join('|')).toString('base64');
  }
}