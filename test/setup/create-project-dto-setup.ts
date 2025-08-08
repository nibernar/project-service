/**
 * Setup simplifié pour les tests CreateProjectDto
 */

import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';

// =============================================================================
// CONFIGURATION GLOBALE SIMPLE
// =============================================================================

jest.setTimeout(30000);

// Variables d'environnement minimales
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';

// =============================================================================
// MOCKS AUTOMATIQUES
// =============================================================================

// Mock automatique de tous les modules externes - version simplifiée
jest.mock('@nestjs/common', () => {
  const actual = jest.requireActual('@nestjs/common');
  
  // Mock Logger sans overrideLogger pour éviter les erreurs
  const mockLogger = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
  };
  
  return {
    ...actual,
    Logger: jest.fn().mockImplementation(() => mockLogger),
  };
});

// =============================================================================
// UTILITAIRES SIMPLES
// =============================================================================

/**
 * Utilitaire pour valider un DTO
 */
declare global {
  var validateDto: <T extends object>(
    DtoClass: new () => T,
    data: any
  ) => Promise<{ dto: T; errors: any[] }>;
  
  var validProjectData: () => any;
  var invalidProjectData: () => any;
  var generateUuid: () => string;
}

global.validateDto = async <T extends object>(
  DtoClass: new () => T,
  data: any
): Promise<{ dto: T; errors: any[] }> => {
  const dto = plainToClass(DtoClass, data);
  const errors = await validate(dto as any);
  return { dto, errors };
};

/**
 * Données de test valides
 */
global.validProjectData = () => ({
  name: 'Test Project',
  description: 'A valid test project',
  initialPrompt: 'Create a test application with basic features',
  uploadedFileIds: ['550e8400-e29b-41d4-a716-446655440000'],
});

/**
 * Données de test invalides
 */
global.invalidProjectData = () => ({
  name: '',
  description: 'A'.repeat(1001),
  initialPrompt: 'Short',
  uploadedFileIds: ['invalid-uuid'],
});

/**
 * Générateur d'UUID valide
 */
global.generateUuid = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// =============================================================================
// MATCHERS JEST SIMPLES
// =============================================================================

declare global {
  namespace jest {
    interface Matchers<R> {
      toHaveValidationError(property: string): R;
      toBeValidDto(): R;
    }
  }
}

expect.extend({
  toHaveValidationError(received: any[], property: string) {
    const hasError = received.some(error => error.property === property);
    
    return {
      message: () => hasError 
        ? `Expected no validation error for "${property}"` 
        : `Expected validation error for "${property}"`,
      pass: hasError,
    };
  },

  toBeValidDto(received: any[]) {
    const isValid = received.length === 0;
    
    return {
      message: () => isValid 
        ? 'Expected DTO to be invalid' 
        : `Expected DTO to be valid but found errors: ${received.map(e => e.property).join(', ')}`,
      pass: isValid,
    };
  },
});

// =============================================================================
// HOOKS SIMPLES
// =============================================================================

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  // Pas de gestion des timers pour les tests simples
});