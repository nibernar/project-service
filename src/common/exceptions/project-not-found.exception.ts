import { NotFoundException } from '@nestjs/common';

/**
 * Exception levée quand un projet demandé n'existe pas
 * 
 * Hérite de NotFoundException (404) pour une réponse HTTP appropriée.
 * Fournit un message d'erreur contextualisé avec l'ID du projet.
 */
export class ProjectNotFoundException extends NotFoundException {
  constructor(projectId: string) {
    super(`Project with ID "${projectId}" not found`);
  }
}