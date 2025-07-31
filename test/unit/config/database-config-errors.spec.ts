// test/unit/config/database-config-errors.spec.ts

import {
  DatabaseConfigurationError,
  DatabaseValidationError,
  DatabaseConnectionError,
} from '../../../src/config/database.config';

describe('Database Configuration Errors', () => {
  describe('DatabaseConfigurationError', () => {
    it('should create error with message', () => {
      const error = new DatabaseConfigurationError('Test error');
      
      expect(error.message).toBe('Test error');
      expect(error.name).toBe('DatabaseConfigurationError');
      expect(error).toBeInstanceOf(Error);
    });

    it('should store variable and value', () => {
      const error = new DatabaseConfigurationError(
        'Invalid config', 
        'DB_MAX_CONNECTIONS', 
        'invalid'
      );
      
      expect(error.variable).toBe('DB_MAX_CONNECTIONS');
      expect(error.value).toBe('invalid');
    });

    it('should work without optional parameters', () => {
      const error = new DatabaseConfigurationError('Simple error');
      
      expect(error.variable).toBeUndefined();
      expect(error.value).toBeUndefined();
    });
  });

  describe('DatabaseValidationError', () => {
    it('should extend DatabaseConfigurationError', () => {
      const error = new DatabaseValidationError(
        'Validation failed',
        'DB_URL',
        'invalid-url',
        'Use postgresql:// format'
      );
      
      expect(error).toBeInstanceOf(DatabaseConfigurationError);
      expect(error.name).toBe('DatabaseValidationError');
      expect(error.variable).toBe('DB_URL');
      expect(error.value).toBe('invalid-url');
      expect(error.suggestion).toBe('Use postgresql:// format');
    });

    it('should work without suggestion', () => {
      const error = new DatabaseValidationError(
        'Validation failed',
        'DB_URL',
        'invalid-url'
      );
      
      expect(error.suggestion).toBeUndefined();
    });
  });

  describe('DatabaseConnectionError', () => {
    it('should store original error', () => {
      const originalError = new Error('Connection failed');
      const error = new DatabaseConnectionError(
        'Database unavailable',
        originalError
      );
      
      expect(error.originalError).toBe(originalError);
      expect(error.name).toBe('DatabaseConnectionError');
      expect(error.message).toBe('Database unavailable');
    });

    it('should work without original error', () => {
      const error = new DatabaseConnectionError('Database unavailable');
      
      expect(error.originalError).toBeUndefined();
    });
  });
});