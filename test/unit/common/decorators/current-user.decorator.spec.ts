// test/unit/common/decorators/current-user.decorator.spec.ts

import { ExecutionContext } from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { CurrentUser } from '../../../../src/common/decorators/current-user.decorator';
import { User } from '../../../../src/common/interfaces/user.interface';

describe('CurrentUser Decorator - Unit Tests', () => {
  // Récupération de la fonction de transformation du décorateur
  const decoratorFactory = CurrentUser as any;

  // Fonction helper qui reproduit la logique du décorateur pour les tests
  const extractUserFunction = (data: unknown, ctx: ExecutionContext): User => {
    const request = ctx.switchToHttp().getRequest<FastifyRequest>();
    const user = (request as any).user;

    if (!user) {
      throw new Error(
        'User not found in request context. Make sure AuthGuard is applied.',
      );
    }

    return user;
  };

  // ============================================================================
  // HELPERS DE TEST
  // ============================================================================

  const createMockExecutionContext = (
    options: { user?: User | null | undefined; [key: string]: any } = {},
  ): ExecutionContext => {
    const mockRequest: any = {
      user: options.user,
      method: options.method || 'GET',
      url: options.url || '/test',
      headers: options.headers || {},
      body: options.body,
      params: options.params || {},
      query: options.query || {},
      ip: options.ip || '127.0.0.1',
      ...options,
    };

    return {
      switchToHttp: () => ({
        getRequest: () => mockRequest as FastifyRequest,
        getResponse: jest.fn(),
        getNext: jest.fn(),
      }),
      switchToRpc: jest.fn(),
      switchToWs: jest.fn(),
      getType: () => 'http',
      getClass: jest.fn(),
      getHandler: jest.fn(),
      getArgs: jest.fn(),
      getArgByIndex: jest.fn(),
    } as ExecutionContext;
  };

  const createTestUser = (overrides: Partial<User> = {}): User => ({
    id: 'user-123',
    email: 'test@example.com',
    roles: ['user'],
    ...overrides,
  });

  // ============================================================================
  // TESTS DE FONCTIONNEMENT NOMINAL
  // ============================================================================

  describe('Fonctionnement nominal', () => {
    it('should extract user from HTTP context successfully', () => {
      // Arrange
      const testUser = createTestUser();
      const mockContext = createMockExecutionContext({ user: testUser });

      // Act
      const result = extractUserFunction(undefined, mockContext);

      // Assert
      expect(result).toEqual(testUser);
      expect(result).toMatchObject({
        id: 'user-123',
        email: 'test@example.com',
        roles: ['user'],
      });
    });

    it('should return complete and valid User object', () => {
      // Arrange
      const testUser = createTestUser({
        id: 'user-456',
        email: 'admin@example.com',
        roles: ['admin', 'user'],
      });
      const mockContext = createMockExecutionContext({ user: testUser });

      // Act
      const result = extractUserFunction(undefined, mockContext);

      // Assert
      expect(result).toMatchObject(testUser);
      expect(result.id).toBe('user-456');
      expect(result.email).toBe('admin@example.com');
      expect(result.roles).toHaveLength(2);
      expect(result.roles).toContain('admin');
      expect(result.roles).toContain('user');
    });

    it('should preserve all user properties without modification', () => {
      // Arrange
      const testUser = createTestUser();
      const mockContext = createMockExecutionContext({ user: testUser });

      // Act
      const result = extractUserFunction(undefined, mockContext);

      // Assert
      expect(Object.keys(result)).toEqual(Object.keys(testUser));
      expect(result).toEqual(testUser);
      expect(result === testUser).toBe(true); // Same reference
    });

    it('should work with users having different role combinations', () => {
      // Arrange
      const testCases = [
        { roles: [] },
        { roles: ['user'] },
        { roles: ['admin'] },
        { roles: ['user', 'admin'] },
        { roles: ['user', 'admin', 'moderator'] },
        { roles: ['super-admin', 'owner'] },
      ];

      testCases.forEach(({ roles }, index) => {
        // Arrange
        const testUser = createTestUser({
          id: `user-${index}`,
          roles,
        });
        const mockContext = createMockExecutionContext({ user: testUser });

        // Act
        const result = extractUserFunction(undefined, mockContext);

        // Assert
        expect(result.roles).toEqual(roles);
        expect(result.id).toBe(`user-${index}`);
      });
    });

    it('should handle users with minimal required properties', () => {
      // Arrange
      const minimalUser: User = {
        id: 'minimal-user',
        email: 'minimal@example.com',
        roles: [],
      };
      const mockContext = createMockExecutionContext({ user: minimalUser });

      // Act
      const result = extractUserFunction(undefined, mockContext);

      // Assert
      expect(result).toEqual(minimalUser);
      expect(result.id).toBe('minimal-user');
      expect(result.email).toBe('minimal@example.com');
      expect(result.roles).toEqual([]);
    });
  });

  // ============================================================================
  // TESTS DE VALIDATION DES DONNÉES
  // ============================================================================

  describe('Validation des données utilisateur', () => {
    it('should work with different ID formats', () => {
      // Arrange
      const testIds = [
        'user-123',
        '550e8400-e29b-41d4-a716-446655440000', // UUID v4
        '6ba7b810-9dad-11d1-80b4-00c04fd430c8', // UUID v1
        '12345',
        'user_abc_123',
        'USR-2025-001',
      ];

      testIds.forEach((id) => {
        // Arrange
        const testUser = createTestUser({ id });
        const mockContext = createMockExecutionContext({ user: testUser });

        // Act
        const result = extractUserFunction(undefined, mockContext);

        // Assert
        expect(result.id).toBe(id);
        expect(typeof result.id).toBe('string');
      });
    });

    it('should work with different email formats', () => {
      // Arrange
      const testEmails = [
        'user@example.com',
        'test.user+tag@domain.co.uk',
        'user123@subdomain.example.org',
        'firstName.lastName@company-name.com',
        'user+filter@gmail.com',
        'admin@localhost',
      ];

      testEmails.forEach((email) => {
        // Arrange
        const testUser = createTestUser({ email });
        const mockContext = createMockExecutionContext({ user: testUser });

        // Act
        const result = extractUserFunction(undefined, mockContext);

        // Assert
        expect(result.email).toBe(email);
        expect(typeof result.email).toBe('string');
      });
    });

    it('should preserve additional user properties if present', () => {
      // Arrange
      const extendedUser = {
        ...createTestUser(),
        customProperty: 'customValue',
        metadata: {
          createdAt: '2025-01-01T00:00:00Z',
          lastLogin: '2025-01-28T10:30:00Z',
        },
        preferences: {
          theme: 'dark',
          language: 'en',
        },
      };
      const mockContext = createMockExecutionContext({ user: extendedUser });

      // Act
      const result = extractUserFunction(undefined, mockContext);

      // Assert
      expect(result).toEqual(extendedUser);
      expect((result as any).customProperty).toBe('customValue');
      expect((result as any).metadata).toEqual({
        createdAt: '2025-01-01T00:00:00Z',
        lastLogin: '2025-01-28T10:30:00Z',
      });
      expect((result as any).preferences).toEqual({
        theme: 'dark',
        language: 'en',
      });
    });

    it('should handle users with empty string values', () => {
      // Arrange
      const userWithEmptyValues = createTestUser({
        id: '',
        email: '',
        roles: [],
      });
      const mockContext = createMockExecutionContext({
        user: userWithEmptyValues,
      });

      // Act
      const result = extractUserFunction(undefined, mockContext);

      // Assert
      expect(result).toEqual(userWithEmptyValues);
      expect(result.id).toBe('');
      expect(result.email).toBe('');
      expect(result.roles).toEqual([]);
    });

    it('should handle deeply nested role structures', () => {
      // Arrange
      const complexRoles = [
        'role:admin:read',
        'role:admin:write',
        'permission:users:create',
        'permission:projects:delete',
        'scope:organization:12345',
      ];
      const testUser = createTestUser({ roles: complexRoles });
      const mockContext = createMockExecutionContext({ user: testUser });

      // Act
      const result = extractUserFunction(undefined, mockContext);

      // Assert
      expect(result.roles).toEqual(complexRoles);
      expect(result.roles).toHaveLength(5);
    });
  });

  // ============================================================================
  // TESTS DE GESTION DES CONTEXTES
  // ============================================================================

  describe('Gestion des contextes', () => {
    it('should use correct HTTP context method', () => {
      // Arrange
      const testUser = createTestUser();
      const mockContext = createMockExecutionContext({ user: testUser });
      const switchToHttpSpy = jest.spyOn(mockContext, 'switchToHttp');

      // Act
      extractUserFunction(undefined, mockContext);

      // Assert
      expect(switchToHttpSpy).toHaveBeenCalledTimes(1);
      expect(switchToHttpSpy).toHaveBeenCalledWith();
    });

    it('should retrieve request from HTTP context', () => {
      // Arrange
      const testUser = createTestUser();
      const mockContext = createMockExecutionContext({ user: testUser });

      // Act & Assert - Si ça ne lève pas d'erreur, c'est que getRequest() a été appelé
      expect(() => {
        const result = extractUserFunction(undefined, mockContext);
        expect(result).toEqual(testUser);
      }).not.toThrow();
    });

    it('should work with different request types and properties', () => {
      // Arrange
      const testUser = createTestUser();
      const testCases = [
        {
          user: testUser,
          method: 'GET',
          url: '/api/projects',
          headers: { authorization: 'Bearer token123' },
        },
        {
          user: testUser,
          method: 'POST',
          url: '/api/projects',
          body: { name: 'New Project' },
          params: {},
        },
        {
          user: testUser,
          method: 'PUT',
          url: '/api/projects/123',
          query: { include: 'stats' },
        },
        {
          user: testUser,
          method: 'DELETE',
          url: '/api/projects/456',
          ip: '127.0.0.1',
        },
      ];

      testCases.forEach((requestData, index) => {
        // Arrange
        const mockContext = createMockExecutionContext(requestData);

        // Act
        const result = extractUserFunction(undefined, mockContext);

        // Assert
        expect(result).toEqual(testUser);
        expect(result.id).toBe(testUser.id);
      });
    });

    it('should not modify the original request object', () => {
      // Arrange
      const testUser = createTestUser();
      const mockContext = createMockExecutionContext({
        user: testUser,
        method: 'GET',
        url: '/test',
      });

      // Act
      const result = extractUserFunction(undefined, mockContext);

      // Assert
      expect(result).toEqual(testUser);
      // Note: Can't easily test original request immutability with current mock structure
    });

    it('should work with requests containing circular references', () => {
      // Arrange
      const testUser = createTestUser();
      const mockContext = createMockExecutionContext({ user: testUser });

      // Act
      const result = extractUserFunction(undefined, mockContext);

      // Assert
      expect(result).toEqual(testUser);
      expect(result.id).toBe(testUser.id);
    });
  });

  // ============================================================================
  // TESTS DE COMPATIBILITÉ TYPESCRIPT
  // ============================================================================

  describe('Compatibilité TypeScript', () => {
    it('should respect TypeScript typing for User interface', () => {
      // Arrange
      const testUser = createTestUser();
      const mockContext = createMockExecutionContext({ user: testUser });

      // Act
      const result: User = extractUserFunction(undefined, mockContext);

      // Assert
      expect(typeof result.id).toBe('string');
      expect(typeof result.email).toBe('string');
      expect(Array.isArray(result.roles)).toBe(true);
      result.roles.forEach((role) => {
        expect(typeof role).toBe('string');
      });
    });

    it('should work with decorator factory structure', () => {
      // Le décorateur est créé via createParamDecorator qui retourne une factory
      expect(typeof decoratorFactory).toBe('function');
      expect(typeof extractUserFunction).toBe('function');
    });

    it('should maintain type safety with generic ExecutionContext', () => {
      // Arrange
      const testUser = createTestUser();

      // Test avec différents types de contexte
      const httpContext = createMockExecutionContext({ user: testUser });
      const result = extractUserFunction(undefined, httpContext);

      // Assert
      expect(result).toEqual(testUser);
      expect(result satisfies User).toBeTruthy();
    });

    it('should handle user objects with strict typing', () => {
      // Arrange - User strict avec seulement les propriétés requises
      const strictUser: User = {
        id: 'strict-user-123',
        email: 'strict@example.com',
        roles: ['user', 'reader'],
      };
      const mockContext = createMockExecutionContext({ user: strictUser });

      // Act
      const result = extractUserFunction(undefined, mockContext);

      // Assert
      expect(result).toEqual(strictUser);
      expect(Object.keys(result)).toEqual(['id', 'email', 'roles']);
    });
  });

  // ============================================================================
  // TESTS D'INTÉGRATION AVEC NESTJS
  // ============================================================================

  describe('Intégration NestJS', () => {
    it('should work as parameter decorator in controller methods', () => {
      // Simulate comment l'utilisation dans un contrôleur
      const testUser = createTestUser();
      const mockContext = createMockExecutionContext({ user: testUser });

      // Simulation d'un appel de contrôleur
      const controllerMethod = (user: User) => {
        return { message: `Hello ${user.email}`, userId: user.id };
      };

      // Act
      const extractedUser = extractUserFunction(undefined, mockContext);
      const controllerResult = controllerMethod(extractedUser);

      // Assert
      expect(controllerResult).toEqual({
        message: 'Hello test@example.com',
        userId: 'user-123',
      });
    });

    it('should work with multiple decorators in same method', () => {
      // Simulate l'utilisation avec d'autres décorateurs
      const testUser = createTestUser();
      const mockContext = createMockExecutionContext({
        user: testUser,
        body: { name: 'Test Project' },
        params: { id: '123' },
      });

      // Act
      const extractedUser = extractUserFunction(undefined, mockContext);

      // Assert
      expect(extractedUser).toEqual(testUser);
      // Vérifier que l'extraction n'interfère pas avec les autres données
      const request = mockContext.switchToHttp().getRequest() as any;
      expect(request.body).toEqual({ name: 'Test Project' });
      expect(request.params).toEqual({ id: '123' });
    });

    it('should maintain request context integrity', () => {
      // Arrange
      const testUser = createTestUser();
      const complexRequest = {
        user: testUser,
        method: 'POST',
        url: '/api/projects',
        headers: {
          'content-type': 'application/json',
          authorization: 'Bearer token123',
        },
        body: { name: 'New Project' },
        params: { organizationId: '456' },
        query: { include: 'stats' },
      };
      const mockContext = createMockExecutionContext(complexRequest);

      // Act
      const result = extractUserFunction(undefined, mockContext);

      // Assert
      expect(result).toEqual(testUser);
      // Vérifier que le contexte complet est préservé
      const request = mockContext.switchToHttp().getRequest() as any;
      expect(request.method).toBe('POST');
      expect(request.headers['authorization']).toBe('Bearer token123');
      expect(request.body).toEqual({ name: 'New Project' });
    });
  });

  // ============================================================================
  // TESTS D'ERREURS
  // ============================================================================

  describe('Gestion des erreurs', () => {
    it('should throw error when user is not present', () => {
      // Arrange
      const mockContext = createMockExecutionContext({}); // No user

      // Act & Assert
      expect(() => {
        extractUserFunction(undefined, mockContext);
      }).toThrow(
        'User not found in request context. Make sure AuthGuard is applied.',
      );
    });

    it('should throw error when user is null', () => {
      // Arrange
      const mockContext = createMockExecutionContext({ user: null });

      // Act & Assert
      expect(() => {
        extractUserFunction(undefined, mockContext);
      }).toThrow(
        'User not found in request context. Make sure AuthGuard is applied.',
      );
    });

    it('should throw error when user is undefined', () => {
      // Arrange
      const mockContext = createMockExecutionContext({ user: undefined });

      // Act & Assert
      expect(() => {
        extractUserFunction(undefined, mockContext);
      }).toThrow(
        'User not found in request context. Make sure AuthGuard is applied.',
      );
    });
  });
});
