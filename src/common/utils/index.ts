/**
 * Index centralisé des utilitaires communs du service
 *
 * Export centralisé de tous les utilitaires réutilisables pour faciliter
 * l'import et maintenir une organisation claire du code.
 *
 * @fileoverview Export centralisé des utilitaires
 * @version 1.0.0
 */

// Utilitaires de validation métier
export {
  ValidationUtils,
  ValidationResult,
  SanitizeOptions,
} from './validation.utils';

// Types utilitaires pour la validation
export type {
  ValidationResult as ValidationResponse,
  SanitizeOptions as TextSanitizeOptions,
} from './validation.utils';

/**
 * Constantes de validation communes
 */
export const VALIDATION_CONSTANTS = {
  PROJECT_NAME: {
    MIN_LENGTH: 1,
    MAX_LENGTH: 100,
  },
  DESCRIPTION: {
    MAX_LENGTH: 1000,
  },
  PROMPT: {
    MIN_LENGTH: 10,
    MAX_LENGTH: 5000,
  },
  FILE_IDS: {
    MAX_COUNT: 50,
    WARNING_THRESHOLD: 20,
  },
} as const;

/**
 * Messages d'erreur standardisés
 */
export const VALIDATION_MESSAGES = {
  REQUIRED: 'This field is required',
  INVALID_FORMAT: 'Invalid format provided',
  TOO_SHORT: 'Value is too short',
  TOO_LONG: 'Value is too long',
  INVALID_CHARACTERS: 'Contains invalid characters',
  DUPLICATE_VALUES: 'Duplicate values found',
  SECURITY_VIOLATION: 'Security validation failed',
} as const;

/**
 * Patterns de validation réutilisables
 */
export const VALIDATION_PATTERNS = {
  UUID: /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  PROJECT_NAME: /^[a-zA-Z0-9\s\-_]+$/,
  SAFE_TEXT: /^[^<>\"'&\x00-\x1f\x7f]*$/,
  FILE_ID: /^[a-zA-Z0-9\-_]{8,}$/,
} as const;
