import { BadRequestException } from '@nestjs/common';

/**
 * Exception levée pour les opérations invalides (ID manquant, format incorrect, etc.)
 * 
 * Hérite de BadRequestException (400) pour indiquer une erreur côté client.
 */
export class InvalidOperationException extends BadRequestException {
  constructor(message: string) {
    super(message);
  }
}