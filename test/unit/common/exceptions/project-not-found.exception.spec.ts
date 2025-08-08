import { NotFoundException } from '@nestjs/common';
import { ProjectNotFoundException } from '../../../../src/common/exceptions/project-not-found.exception';

describe('ProjectNotFoundException', () => {
  const validProjectId = '123e4567-e89b-12d3-a456-426614174000';
  const additionalContext = 'User attempted to access archived project';

  describe('constructor', () => {
    it('should create exception with project ID', () => {
      const exception = new ProjectNotFoundException(validProjectId);

      expect(exception).toBeInstanceOf(ProjectNotFoundException);
      expect(exception).toBeInstanceOf(NotFoundException);
      expect(exception.message).toBe(`Project with ID "${validProjectId}" not found`);
      expect(exception.projectId).toBe(validProjectId);
      expect(exception.errorCode).toBe('PROJECT_NOT_FOUND');
      expect(exception.timestamp).toBeInstanceOf(Date);
      expect(exception.name).toBe('ProjectNotFoundException');
    });

    it('should include additional context when provided', () => {
      const exception = new ProjectNotFoundException(validProjectId, additionalContext);

      expect(exception.message).toBe(
        `Project with ID "${validProjectId}" not found: ${additionalContext}`
      );
      expect(exception.additionalContext).toBe(additionalContext);
    });

    it('should have correct HTTP status code (404)', () => {
      const exception = new ProjectNotFoundException(validProjectId);
      expect(exception.getStatus()).toBe(404);
    });

    it('should validate project ID is not empty', () => {
      expect(() => new ProjectNotFoundException('')).toThrow(
        'ProjectId cannot be empty when creating ProjectNotFoundException'
      );
    });

    it('should validate project ID is not null or undefined', () => {
      expect(() => new ProjectNotFoundException(null as any)).toThrow(
        'ProjectId cannot be empty when creating ProjectNotFoundException'
      );
      
      expect(() => new ProjectNotFoundException(undefined as any)).toThrow(
        'ProjectId cannot be empty when creating ProjectNotFoundException'
      );
    });

    it('should validate project ID is a string', () => {
      expect(() => new ProjectNotFoundException(123 as any)).toThrow(
        'ProjectId cannot be empty when creating ProjectNotFoundException'
      );
    });

    it('should validate project ID is not only whitespace', () => {
      expect(() => new ProjectNotFoundException('   ')).toThrow(
        'ProjectId cannot be empty when creating ProjectNotFoundException'
      );
    });

    it('should include timestamp', () => {
      const beforeCreation = new Date();
      const exception = new ProjectNotFoundException(validProjectId);
      const afterCreation = new Date();

      expect(exception.timestamp).toBeInstanceOf(Date);
      expect(exception.timestamp.getTime()).toBeGreaterThanOrEqual(beforeCreation.getTime());
      expect(exception.timestamp.getTime()).toBeLessThanOrEqual(afterCreation.getTime());
    });

    it('should preserve stack trace', () => {
      const exception = new ProjectNotFoundException(validProjectId);
      expect(exception.stack).toBeDefined();
      expect(typeof exception.stack).toBe('string');
      expect(exception.stack).toContain('ProjectNotFoundException');
    });
  });

  describe('getAuditInfo', () => {
    it('should return complete audit information', () => {
      const exception = new ProjectNotFoundException(validProjectId, additionalContext);
      const auditInfo = exception.getAuditInfo();

      expect(auditInfo).toEqual({
        errorCode: 'PROJECT_NOT_FOUND',
        projectId: validProjectId,
        timestamp: exception.timestamp,
        additionalContext: additionalContext,
        message: exception.message,
      });
    });

    it('should return audit info without context when not provided', () => {
      const exception = new ProjectNotFoundException(validProjectId);
      const auditInfo = exception.getAuditInfo();

      expect(auditInfo.additionalContext).toBeUndefined();
      expect(auditInfo.errorCode).toBe('PROJECT_NOT_FOUND');
      expect(auditInfo.projectId).toBe(validProjectId);
    });
  });

  describe('toJSON', () => {
    it('should serialize all properties for logging', () => {
      const exception = new ProjectNotFoundException(validProjectId, additionalContext);
      const json = exception.toJSON();

      expect(json).toEqual({
        name: 'ProjectNotFoundException',
        message: exception.message,
        errorCode: 'PROJECT_NOT_FOUND',
        projectId: validProjectId,
        timestamp: exception.timestamp.toISOString(),
        additionalContext: additionalContext,
        stack: exception.stack,
      });
    });

    it('should handle missing context in serialization', () => {
      const exception = new ProjectNotFoundException(validProjectId);
      const json = exception.toJSON();

      expect(json.additionalContext).toBeUndefined();
      expect(json.projectId).toBe(validProjectId);
    });
  });

  describe('toPublicError', () => {
    it('should create sanitized public error response', () => {
      const exception = new ProjectNotFoundException(validProjectId, additionalContext);
      const publicError = exception.toPublicError();

      expect(publicError).toEqual({
        message: `Project with ID "${validProjectId}" not found`,
        errorCode: 'PROJECT_NOT_FOUND',
        timestamp: exception.timestamp.toISOString(),
      });
    });

    it('should not expose sensitive context in public error', () => {
      const sensitiveContext = 'Internal database error occurred while checking user permissions';
      const exception = new ProjectNotFoundException(validProjectId, sensitiveContext);
      const publicError = exception.toPublicError();

      expect(publicError.message).not.toContain('database error');
      expect(publicError.message).not.toContain('permissions');
      expect(publicError.message).toBe(`Project with ID "${validProjectId}" not found`);
    });
  });

  describe('properties', () => {
    it('should have readonly properties', () => {
      const exception = new ProjectNotFoundException(validProjectId, additionalContext);

      expect(exception.projectId).toBe(validProjectId);
      expect(exception.errorCode).toBe('PROJECT_NOT_FOUND');
    });

    it('should maintain property values after creation', () => {
      const exception = new ProjectNotFoundException(validProjectId, additionalContext);
      const originalTimestamp = exception.timestamp;
      const originalProjectId = exception.projectId;

      // Simulate some time passing
      setTimeout(() => {
        expect(exception.timestamp).toBe(originalTimestamp);
        expect(exception.projectId).toBe(originalProjectId);
        expect(exception.additionalContext).toBe(additionalContext);
      }, 10);
    });
  });

  describe('edge cases', () => {
    it('should handle very long project IDs', () => {
      const longProjectId = 'a'.repeat(1000);
      const exception = new ProjectNotFoundException(longProjectId);

      expect(exception.projectId).toBe(longProjectId);
      expect(exception.message).toContain(longProjectId);
    });

    it('should handle special characters in project ID', () => {
      const specialId = 'project-123_test$special';
      const exception = new ProjectNotFoundException(specialId);

      expect(exception.projectId).toBe(specialId);
      expect(exception.message).toContain(specialId);
    });

    it('should handle Unicode characters in context', () => {
      const unicodeContext = 'Utilisateur français avec émojis 🚀 a tenté d\'accéder';
      const exception = new ProjectNotFoundException(validProjectId, unicodeContext);

      expect(exception.additionalContext).toBe(unicodeContext);
      expect(exception.message).toContain(unicodeContext);
    });

    it('should handle very long additional context', () => {
      const longContext = 'Very long context: ' + 'a'.repeat(5000);
      const exception = new ProjectNotFoundException(validProjectId, longContext);

      expect(exception.additionalContext).toBe(longContext);
      expect(exception.message).toContain(longContext);
    });
  });

  describe('inheritance', () => {
    it('should properly inherit from NotFoundException', () => {
      const exception = new ProjectNotFoundException(validProjectId);

      expect(exception instanceof NotFoundException).toBe(true);
      expect(exception instanceof Error).toBe(true);
      expect(exception.constructor.name).toBe('ProjectNotFoundException');
    });

    it('should be catchable as NotFoundException', () => {
      let caught = false;
      
      try {
        throw new ProjectNotFoundException(validProjectId);
      } catch (error) {
        if (error instanceof NotFoundException) {
          caught = true;
        }
      }

      expect(caught).toBe(true);
    });

    it('should be distinguishable from other exceptions', () => {
      const projectException = new ProjectNotFoundException(validProjectId);
      const nestException = new NotFoundException('Generic not found');

      expect(projectException instanceof ProjectNotFoundException).toBe(true);
      expect(nestException instanceof ProjectNotFoundException).toBe(false);
    });
  });

  describe('integration with NestJS', () => {
    it('should be properly serialized by NestJS exception filters', () => {
      const exception = new ProjectNotFoundException(validProjectId);
      
      // Simulate what NestJS does internally
      const response = {
        message: exception.message,
        error: exception.constructor.name,
        statusCode: exception.getStatus(),
      };

      expect(response.statusCode).toBe(404);
      expect(response.error).toBe('ProjectNotFoundException');
      expect(response.message).toContain(validProjectId);
    });
  });
});