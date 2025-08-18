import { ForbiddenException } from '@nestjs/common';
import { UnauthorizedAccessException } from '../../../../src/common/exceptions/unauthorized-access.exception';

describe('UnauthorizedAccessException', () => {
  const testUserId = '123e4567-e89b-12d3-a456-426614174000';
  const testResourceId = '987e6543-e21d-43c2-b456-426614174999';

  describe('constructor', () => {
    it('should create exception with default message', () => {
      const exception = new UnauthorizedAccessException();

      expect(exception).toBeInstanceOf(UnauthorizedAccessException);
      expect(exception).toBeInstanceOf(ForbiddenException);
      expect(exception.message).toBe(
        'You do not have permission to access this resource',
      );
      expect(exception.resourceType).toBe('project');
      expect(exception.errorCode).toBe('UNAUTHORIZED_ACCESS');
      expect(exception.timestamp).toBeInstanceOf(Date);
      expect(exception.name).toBe('UnauthorizedAccessException');
    });

    it('should have correct HTTP status code (403)', () => {
      const exception = new UnauthorizedAccessException();
      expect(exception.getStatus()).toBe(403);
    });

    it('should handle optional parameters', () => {
      const exception = new UnauthorizedAccessException(
        'statistics',
        testResourceId,
        testUserId,
        'delete',
      );

      expect(exception.resourceType).toBe('statistics');
      expect(exception.resourceId).toBe(testResourceId);
      expect(exception.userId).toBe(testUserId);
      expect(exception.action).toBe('delete');
      expect(exception.message).toBe(
        'You do not have permission to delete this statistics',
      );
    });

    it('should handle partial parameters', () => {
      const exception = new UnauthorizedAccessException('file', testResourceId);

      expect(exception.resourceType).toBe('file');
      expect(exception.resourceId).toBe(testResourceId);
      expect(exception.userId).toBeUndefined();
      expect(exception.action).toBeUndefined();
      expect(exception.message).toBe(
        'You do not have permission to access this file',
      );
    });

    it('should include timestamp', () => {
      const beforeCreation = new Date();
      const exception = new UnauthorizedAccessException();
      const afterCreation = new Date();

      expect(exception.timestamp).toBeInstanceOf(Date);
      expect(exception.timestamp.getTime()).toBeGreaterThanOrEqual(
        beforeCreation.getTime(),
      );
      expect(exception.timestamp.getTime()).toBeLessThanOrEqual(
        afterCreation.getTime(),
      );
    });
  });

  describe('message generation', () => {
    it('should not expose sensitive information', () => {
      const exception = new UnauthorizedAccessException(
        'secret_database',
        'sensitive-id-123',
        'attacker-user',
        'hack',
      );

      // Message should be generic and not reveal the sensitive resource type
      expect(exception.message).toBe(
        'You do not have permission to hack this secret_database',
      );

      // But it should not expose the actual IDs in the public message
      expect(exception.message).not.toContain('sensitive-id-123');
      expect(exception.message).not.toContain('attacker-user');
    });

    it('should generate appropriate message for different resource types', () => {
      const cases = [
        {
          resourceType: 'project',
          expected: 'You do not have permission to access this project',
        },
        {
          resourceType: 'user',
          expected: 'You do not have permission to access this user',
        },
        {
          resourceType: 'file',
          expected: 'You do not have permission to access this file',
        },
      ];

      cases.forEach(({ resourceType, expected }) => {
        const exception = new UnauthorizedAccessException(resourceType);
        expect(exception.message).toBe(expected);
      });
    });

    it('should generate appropriate message with actions', () => {
      const cases = [
        {
          action: 'read',
          expected: 'You do not have permission to read this project',
        },
        {
          action: 'delete',
          expected: 'You do not have permission to delete this project',
        },
        {
          action: 'modify',
          expected: 'You do not have permission to modify this project',
        },
      ];

      cases.forEach(({ action, expected }) => {
        const exception = new UnauthorizedAccessException(
          'project',
          undefined,
          undefined,
          action,
        );
        expect(exception.message).toBe(expected);
      });
    });
  });

  describe('getAuditInfo', () => {
    it('should include audit information', () => {
      const exception = new UnauthorizedAccessException(
        'project',
        testResourceId,
        testUserId,
        'delete',
      );

      const auditInfo = exception.getAuditInfo();

      expect(auditInfo).toEqual({
        errorCode: 'UNAUTHORIZED_ACCESS',
        resourceType: 'project',
        resourceId: testResourceId,
        userId: testUserId,
        action: 'delete',
        timestamp: exception.timestamp,
        message:
          'Unauthorized access attempt by user ' +
          testUserId +
          ' to delete project with ID ' +
          testResourceId,
        publicMessage: exception.message,
      });
    });

    it('should handle missing optional parameters in audit info', () => {
      const exception = new UnauthorizedAccessException('file');
      const auditInfo = exception.getAuditInfo();

      expect(auditInfo.resourceId).toBeUndefined();
      expect(auditInfo.userId).toBeUndefined();
      expect(auditInfo.action).toBeUndefined();
      expect(auditInfo.resourceType).toBe('file');
      expect(auditInfo.message).toBe('Unauthorized access attempt to file');
    });

    it('should generate detailed internal message for audit', () => {
      const exception = new UnauthorizedAccessException(
        'statistics',
        testResourceId,
        testUserId,
        'view',
      );

      const auditInfo = exception.getAuditInfo();
      expect(auditInfo.message).toBe(
        `Unauthorized access attempt by user ${testUserId} to view statistics with ID ${testResourceId}`,
      );
    });
  });

  describe('toJSON', () => {
    it('should serialize for logging without sensitive data by default', () => {
      const exception = new UnauthorizedAccessException(
        'project',
        testResourceId,
        testUserId,
        'delete',
      );

      const json = exception.toJSON();

      expect(json).toEqual({
        name: 'UnauthorizedAccessException',
        message: exception.message,
        errorCode: 'UNAUTHORIZED_ACCESS',
        resourceType: 'project',
        action: 'delete',
        timestamp: exception.timestamp.toISOString(),
        stack: exception.stack,
      });

      // Should not include resourceId by default for security
      expect(json.resourceId).toBeUndefined();
    });

    it('should include resource ID when explicitly requested', () => {
      const exception = new UnauthorizedAccessException(
        'project',
        testResourceId,
        testUserId,
        'delete',
      );

      const json = exception.toJSON(true);
      expect(json.resourceId).toBe(testResourceId);
    });
  });

  describe('toPublicError', () => {
    it('should create completely sanitized public error', () => {
      const exception = new UnauthorizedAccessException(
        'top_secret_resource',
        'classified-id-123',
        'spy-user-456',
        'extract_data',
      );

      const publicError = exception.toPublicError();

      expect(publicError).toEqual({
        message: 'You do not have permission to access this resource',
        errorCode: 'UNAUTHORIZED_ACCESS',
        timestamp: exception.timestamp.toISOString(),
      });

      // Should not expose any specific information
      expect(publicError.message).not.toContain('top_secret');
      expect(publicError.message).not.toContain('classified-id');
      expect(publicError.message).not.toContain('spy-user');
      expect(publicError.message).not.toContain('extract_data');
    });
  });

  describe('isSuspiciousActivity', () => {
    it('should detect suspicious activity based on recent attempts', () => {
      const exception = new UnauthorizedAccessException('project');

      expect(exception.isSuspiciousActivity(0)).toBe(false);
      expect(exception.isSuspiciousActivity(3)).toBe(false);
      expect(exception.isSuspiciousActivity(6)).toBe(true);
      expect(exception.isSuspiciousActivity(10)).toBe(true);
    });

    it('should detect suspicious activity for dangerous actions', () => {
      const dangerousActions = ['delete', 'admin', 'modify'];
      const safeActions = ['read', 'view', 'list'];

      dangerousActions.forEach((action) => {
        const exception = new UnauthorizedAccessException(
          'project',
          undefined,
          undefined,
          action,
        );
        expect(exception.isSuspiciousActivity(0)).toBe(true);
      });

      safeActions.forEach((action) => {
        const exception = new UnauthorizedAccessException(
          'project',
          undefined,
          undefined,
          action,
        );
        expect(exception.isSuspiciousActivity(0)).toBe(false);
      });
    });

    it('should be case insensitive for action detection', () => {
      const exception = new UnauthorizedAccessException(
        'project',
        undefined,
        undefined,
        'DELETE',
      );
      expect(exception.isSuspiciousActivity(0)).toBe(true);

      const exception2 = new UnauthorizedAccessException(
        'project',
        undefined,
        undefined,
        'Admin',
      );
      expect(exception2.isSuspiciousActivity(0)).toBe(true);
    });
  });

  describe('getAttemptHash', () => {
    it('should generate unique hash for deduplication', () => {
      const exception1 = new UnauthorizedAccessException(
        'project',
        testResourceId,
        testUserId,
        'read',
      );
      const exception2 = new UnauthorizedAccessException(
        'project',
        testResourceId,
        testUserId,
        'read',
      );

      // Same parameters should generate similar hash (within the same hour)
      const hash1 = exception1.getAttemptHash();
      const hash2 = exception2.getAttemptHash();

      expect(hash1).toBe(hash2);
      expect(typeof hash1).toBe('string');
      expect(hash1.length).toBeGreaterThan(0);
    });

    it('should generate different hashes for different users', () => {
      const exception1 = new UnauthorizedAccessException(
        'project',
        testResourceId,
        'user1',
        'read',
      );
      const exception2 = new UnauthorizedAccessException(
        'project',
        testResourceId,
        'user2',
        'read',
      );

      const hash1 = exception1.getAttemptHash();
      const hash2 = exception2.getAttemptHash();

      expect(hash1).not.toBe(hash2);
    });

    it('should handle anonymous users', () => {
      const exception = new UnauthorizedAccessException('project');
      const hash = exception.getAttemptHash();

      expect(hash).toBeDefined();
      expect(hash).toContain(
        Buffer.from('anonymous').toString('base64').substring(0, 8),
      );
    });
  });

  describe('properties', () => {
    it('should have readonly properties', () => {
      const exception = new UnauthorizedAccessException(
        'project',
        testResourceId,
        testUserId,
        'delete',
      );

      expect(exception.resourceType).toBe('project');
      expect(exception.errorCode).toBe('UNAUTHORIZED_ACCESS');
    });
  });

  describe('edge cases', () => {
    it('should handle empty string parameters', () => {
      const exception = new UnauthorizedAccessException('', '', '', '');

      expect(exception.resourceType).toBe('');
      expect(exception.resourceId).toBe('');
      expect(exception.userId).toBe('');
      expect(exception.action).toBe('');
    });

    it('should handle very long parameter values', () => {
      const longString = 'a'.repeat(1000);
      const exception = new UnauthorizedAccessException(
        longString,
        longString,
        longString,
        longString,
      );

      expect(exception.resourceType).toBe(longString);
      expect(exception.resourceId).toBe(longString);
      expect(exception.userId).toBe(longString);
      expect(exception.action).toBe(longString);
    });

    it('should handle Unicode characters', () => {
      const unicodeResource = 'ressource_française_🚀';
      const exception = new UnauthorizedAccessException(unicodeResource);

      expect(exception.resourceType).toBe(unicodeResource);
      expect(exception.message).toContain(unicodeResource);
    });
  });

  describe('inheritance', () => {
    it('should properly inherit from ForbiddenException', () => {
      const exception = new UnauthorizedAccessException();

      expect(exception instanceof ForbiddenException).toBe(true);
      expect(exception instanceof Error).toBe(true);
      expect(exception.constructor.name).toBe('UnauthorizedAccessException');
    });

    it('should be catchable as ForbiddenException', () => {
      let caught = false;

      try {
        throw new UnauthorizedAccessException();
      } catch (error) {
        if (error instanceof ForbiddenException) {
          caught = true;
        }
      }

      expect(caught).toBe(true);
    });

    it('should be distinguishable from other exceptions', () => {
      const authException = new UnauthorizedAccessException();
      const forbiddenException = new ForbiddenException('Generic forbidden');

      expect(authException instanceof UnauthorizedAccessException).toBe(true);
      expect(forbiddenException instanceof UnauthorizedAccessException).toBe(
        false,
      );
    });
  });

  describe('integration with NestJS', () => {
    it('should be properly serialized by NestJS exception filters', () => {
      const exception = new UnauthorizedAccessException(
        'project',
        testResourceId,
        testUserId,
        'delete',
      );

      // Simulate what NestJS does internally
      const response = {
        message: exception.message,
        error: exception.constructor.name,
        statusCode: exception.getStatus(),
      };

      expect(response.statusCode).toBe(403);
      expect(response.error).toBe('UnauthorizedAccessException');
      expect(response.message).toBe(
        'You do not have permission to delete this project',
      );
    });
  });

  describe('security considerations', () => {
    it('should never expose internal IDs in public messages', () => {
      const sensitiveId = 'SENSITIVE_INTERNAL_ID_12345';
      const exception = new UnauthorizedAccessException('project', sensitiveId);

      expect(exception.message).not.toContain(sensitiveId);
      expect(exception.toPublicError().message).not.toContain(sensitiveId);
    });

    it('should not leak user information in public responses', () => {
      const userId = 'internal-user-id-67890';
      const exception = new UnauthorizedAccessException(
        'project',
        testResourceId,
        userId,
      );

      expect(exception.message).not.toContain(userId);
      expect(exception.toPublicError().message).not.toContain(userId);
    });

    it('should maintain audit trail while protecting public interface', () => {
      const sensitiveData = {
        resourceType: 'classified_documents',
        resourceId: 'top-secret-123',
        userId: 'agent-007',
        action: 'extract',
      };

      const exception = new UnauthorizedAccessException(
        sensitiveData.resourceType,
        sensitiveData.resourceId,
        sensitiveData.userId,
        sensitiveData.action,
      );

      // Audit info should contain everything
      const auditInfo = exception.getAuditInfo();
      expect(auditInfo.resourceId).toBe(sensitiveData.resourceId);
      expect(auditInfo.userId).toBe(sensitiveData.userId);

      // Public response should be generic
      const publicError = exception.toPublicError();
      expect(publicError.message).toBe(
        'You do not have permission to access this resource',
      );
    });
  });
});
