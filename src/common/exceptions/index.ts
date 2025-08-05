/**
 * Index centralisé des exceptions communes du service
 * 
 * Facilite l'import des exceptions personnalisées à travers l'application
 * et maintient une organisation claire des types d'erreurs.
 * 
 * @fileoverview Export centralisé des exceptions
 * @version 1.0.0
 */

// Exceptions spécifiques aux projets
export { ProjectNotFoundException } from './project-not-found.exception';
export { UnauthorizedAccessException } from './unauthorized-access.exception';
export { InvalidOperationException } from './invalid-operation.exception';