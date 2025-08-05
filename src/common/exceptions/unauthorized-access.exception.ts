import { ForbiddenException } from '@nestjs/common';

/**
 * Exception levée quand un utilisateur tente d'accéder à un projet
 * dont il n'est pas le propriétaire
 * 
 * Hérite de ForbiddenException (403) car l'utilisateur est authentifié
 * mais n'a pas les permissions nécessaires.
 */
export class UnauthorizedAccessException extends ForbiddenException {
  constructor() {
    super('You do not have permission to access this project');
  }
}