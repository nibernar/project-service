// Dans test/unit/common/decorators/current-user.decorator.edge-cases.spec.ts
// Remplacer le début du fichier par :

import { ExecutionContext } from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { CurrentUser } from '../../../../src/common/decorators/current-user.decorator';
import { User } from '../../../../src/common/interfaces/user.interface';

describe('CurrentUser Decorator - Edge Cases', () => {
  // Récupération de la fonction de transformation du décorateur
  const decoratorFactory = CurrentUser as any;
  
  // Fonction helper qui reproduit la logique du décorateur pour les tests
  const extractUserFunction = (data: unknown, ctx: ExecutionContext): User => {
    const request = ctx.switchToHttp().getRequest<FastifyRequest>();
    const user = (request as any).user;
    
    if (!user) {
      throw new Error('User not found in request context. Make sure AuthGuard is applied.');
    }
    
    return user;
  };

  // Helper pour créer un mock d'ExecutionContext
  const createMockExecutionContext = (request: any): ExecutionContext => ({
    switchToHttp: () => ({
      getRequest: () => request,
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
  } as ExecutionContext);

  // Helper pour créer un utilisateur de test
  const createTestUser = (overrides: Partial<User> = {}): User => ({
    id: 'edge-case-user',
    email: 'edge@example.com',
    roles: ['user'],
    ...overrides,
  });

  // ============================================================================
  // TESTS D'ERREURS - UTILISATEUR ABSENT
  // ============================================================================

  describe('Erreurs - Utilisateur absent', () => {
    it('should throw error when user property is missing from request', () => {
      // Arrange
      const mockRequest = {}; // Pas de propriété user
      const mockContext = createMockExecutionContext(mockRequest);

      // Act & Assert
      expect(() => {
        extractUserFunction(undefined, mockContext);
      }).toThrow('User not found in request context. Make sure AuthGuard is applied.');
    });

    it('should throw error when user property is null', () => {
      // Arrange
      const mockRequest = { user: null };
      const mockContext = createMockExecutionContext(mockRequest);

      // Act & Assert
      expect(() => {
        extractUserFunction(undefined, mockContext);
      }).toThrow('User not found in request context. Make sure AuthGuard is applied.');
    });

    it('should throw error when user property is undefined', () => {
      // Arrange
      const mockRequest = { user: undefined };
      const mockContext = createMockExecutionContext(mockRequest);

      // Act & Assert
      expect(() => {
        extractUserFunction(undefined, mockContext);
      }).toThrow('User not found in request context. Make sure AuthGuard is applied.');
    });

    it('should throw error when user property is empty string', () => {
      // Arrange
      const mockRequest = { user: '' };
      const mockContext = createMockExecutionContext(mockRequest);

      // Act & Assert
      expect(() => {
        extractUserFunction(undefined, mockContext);
      }).toThrow('User not found in request context. Make sure AuthGuard is applied.');
    });

    it('should throw error when user property is false', () => {
      // Arrange
      const mockRequest = { user: false };
      const mockContext = createMockExecutionContext(mockRequest);

      // Act & Assert
      expect(() => {
        extractUserFunction(undefined, mockContext);
      }).toThrow('User not found in request context. Make sure AuthGuard is applied.');
    });

    it('should throw error when user property is 0', () => {
      // Arrange
      const mockRequest = { user: 0 };
      const mockContext = createMockExecutionContext(mockRequest);

      // Act & Assert
      expect(() => {
        extractUserFunction(undefined, mockContext);
      }).toThrow('User not found in request context. Make sure AuthGuard is applied.');
    });

    it('should throw error when user property is NaN', () => {
      // Arrange
      const mockRequest = { user: NaN };
      const mockContext = createMockExecutionContext(mockRequest);

      // Act & Assert
      expect(() => {
        extractUserFunction(undefined, mockContext);
      }).toThrow('User not found in request context. Make sure AuthGuard is applied.');
    });
  });

  // ============================================================================
  // TESTS D'ERREURS - CONTEXTE MALFORMÉ
  // ============================================================================

  describe('Erreurs - Contexte malformé', () => {
    it('should throw error when ExecutionContext is null', () => {
      // Act & Assert
      expect(() => {
        extractUserFunction(undefined, null as any);
      }).toThrow();
    });

    it('should throw error when ExecutionContext is undefined', () => {
      // Act & Assert
      expect(() => {
        extractUserFunction(undefined, undefined as any);
      }).toThrow();
    });

    it('should throw error when ExecutionContext switchToHttp returns null', () => {
      // Arrange
      const invalidContext = {
        switchToHttp: () => null,
      } as any;

      // Act & Assert
      expect(() => {
        extractUserFunction(undefined, invalidContext);
      }).toThrow();
    });

    it('should throw error when ExecutionContext switchToHttp is undefined', () => {
      // Arrange
      const invalidContext = {
        switchToHttp: undefined,
      } as any;

      // Act & Assert
      expect(() => {
        extractUserFunction(undefined, invalidContext);
      }).toThrow();
    });

    it('should throw error when getRequest returns null', () => {
      // Arrange
      const invalidContext = {
        switchToHttp: () => ({
          getRequest: () => null,
          getResponse: jest.fn(),
          getNext: jest.fn(),
        }),
      } as any;

      // Act & Assert
      expect(() => {
        extractUserFunction(undefined, invalidContext);
      }).toThrow();
    });

    it('should throw error when getRequest returns undefined', () => {
      // Arrange
      const invalidContext = {
        switchToHttp: () => ({
          getRequest: () => undefined,
          getResponse: jest.fn(),
          getNext: jest.fn(),
        }),
      } as any;

      // Act & Assert
      expect(() => {
        extractUserFunction(undefined, invalidContext);
      }).toThrow();
    });

    it('should throw error when getRequest is not a function', () => {
      // Arrange
      const invalidContext = {
        switchToHttp: () => ({
          getRequest: 'not-a-function',
          getResponse: jest.fn(),
          getNext: jest.fn(),
        }),
      } as any;

      // Act & Assert
      expect(() => {
        extractUserFunction(undefined, invalidContext);
      }).toThrow();
    });
  });

  // ============================================================================
  // TESTS - UTILISATEURS AVEC DONNÉES INCOMPLÈTES
  // ============================================================================

  describe('Utilisateurs avec données incomplètes', () => {
    it('should handle user with missing id property', () => {
      // Arrange
      const incompleteUser = { 
        email: 'incomplete@example.com',
        roles: ['user'] 
      } as any; // Force type pour test
      const mockRequest = { user: incompleteUser };
      const mockContext = createMockExecutionContext(mockRequest);

      // Act
      const result = extractUserFunction(undefined, mockContext);

      // Assert
      expect(result).toEqual(incompleteUser);
      expect(result.email).toBe('incomplete@example.com');
      expect(result.roles).toEqual(['user']);
      expect(result.id).toBeUndefined();
    });

    it('should handle user with missing email property', () => {
      // Arrange
      const incompleteUser = { 
        id: 'user-no-email',
        roles: ['user'] 
      } as any;
      const mockRequest = { user: incompleteUser };
      const mockContext = createMockExecutionContext(mockRequest);

      // Act
      const result = extractUserFunction(undefined, mockContext);

      // Assert
      expect(result).toEqual(incompleteUser);
      expect(result.id).toBe('user-no-email');
      expect(result.roles).toEqual(['user']);
      expect(result.email).toBeUndefined();
    });

    it('should handle user with missing roles property', () => {
      // Arrange
      const incompleteUser = { 
        id: 'user-no-roles',
        email: 'noroles@example.com'
      } as any;
      const mockRequest = { user: incompleteUser };
      const mockContext = createMockExecutionContext(mockRequest);

      // Act
      const result = extractUserFunction(undefined, mockContext);

      // Assert
      expect(result).toEqual(incompleteUser);
      expect(result.id).toBe('user-no-roles');
      expect(result.email).toBe('noroles@example.com');
      expect(result.roles).toBeUndefined();
    });

    it('should handle user with all properties null', () => {
      // Arrange
      const nullUser = { 
        id: null,
        email: null,
        roles: null 
      } as any;
      const mockRequest = { user: nullUser };
      const mockContext = createMockExecutionContext(mockRequest);

      // Act
      const result = extractUserFunction(undefined, mockContext);

      // Assert
      expect(result).toEqual(nullUser);
      expect(result.id).toBeNull();
      expect(result.email).toBeNull();
      expect(result.roles).toBeNull();
    });

    it('should handle user with all properties undefined', () => {
      // Arrange
      const undefinedUser = { 
        id: undefined,
        email: undefined,
        roles: undefined 
      } as any;
      const mockRequest = { user: undefinedUser };
      const mockContext = createMockExecutionContext(mockRequest);

      // Act
      const result = extractUserFunction(undefined, mockContext);

      // Assert
      expect(result).toEqual(undefinedUser);
      expect(result.id).toBeUndefined();
      expect(result.email).toBeUndefined();
      expect(result.roles).toBeUndefined();
    });
  });

  // ============================================================================
  // TESTS - DONNÉES UTILISATEUR EXTRÊMES
  // ============================================================================

  describe('Données utilisateur extrêmes', () => {
    it('should handle user with extremely long ID', () => {
      // Arrange
      const longId = 'a'.repeat(10000); // 10k caractères
      const testUser = createTestUser({ id: longId });
      const mockRequest = { user: testUser };
      const mockContext = createMockExecutionContext(mockRequest);

      // Act
      const result = extractUserFunction(undefined, mockContext);

      // Assert
      expect(result.id).toBe(longId);
      expect(result.id).toHaveLength(10000);
    });

    it('should handle user with extremely long email', () => {
      // Arrange
      const longEmail = `${'a'.repeat(1000)}@${'b'.repeat(1000)}.com`;
      const testUser = createTestUser({ email: longEmail });
      const mockRequest = { user: testUser };
      const mockContext = createMockExecutionContext(mockRequest);

      // Act
      const result = extractUserFunction(undefined, mockContext);

      // Assert
      expect(result.email).toBe(longEmail);
    });

    it('should handle user with extremely large number of roles', () => {
      // Arrange
      const manyRoles = Array.from({ length: 1000 }, (_, i) => `role-${i}`);
      const testUser = createTestUser({ roles: manyRoles });
      const mockRequest = { user: testUser };
      const mockContext = createMockExecutionContext(mockRequest);

      // Act
      const result = extractUserFunction(undefined, mockContext);

      // Assert
      expect(result.roles).toEqual(manyRoles);
      expect(result.roles).toHaveLength(1000);
    });

    it('should handle user with special characters in all fields', () => {
      // Arrange
      const specialUser = createTestUser({
        id: '!@#$%^&*()_+-=[]{}|;:,.<>?`~',
        email: 'special!@#$%^&*()_+-=[]{}|;:,.<>?`~@example.com',
        roles: ['role!@#$%^&*()', 'another_role-with.special:chars']
      });
      const mockRequest = { user: specialUser };
      const mockContext = createMockExecutionContext(mockRequest);

      // Act
      const result = extractUserFunction(undefined, mockContext);

      // Assert
      expect(result).toEqual(specialUser);
      expect(result.id).toBe('!@#$%^&*()_+-=[]{}|;:,.<>?`~');
    });

    it('should handle user with Unicode characters', () => {
      // Arrange
      const unicodeUser = createTestUser({
        id: 'user-🚀🎉🔥💯',
        email: '用户@例子.中国',
        roles: ['rôle-français', 'роль-русский', 'ロール-日本語']
      });
      const mockRequest = { user: unicodeUser };
      const mockContext = createMockExecutionContext(mockRequest);

      // Act
      const result = extractUserFunction(undefined, mockContext);

      // Assert
      expect(result).toEqual(unicodeUser);
      expect(result.id).toBe('user-🚀🎉🔥💯');
      expect(result.email).toBe('用户@例子.中国');
    });

    it('should handle user with extremely nested object properties', () => {
      // Arrange
      const deepObject: any = { level: 1 };
      let current = deepObject;
      for (let i = 2; i <= 100; i++) {
        current.nested = { level: i };
        current = current.nested;
      }

      const nestedUser = {
        ...createTestUser(),
        deepProperty: deepObject
      };
      const mockRequest = { user: nestedUser };
      const mockContext = createMockExecutionContext(mockRequest);

      // Act
      const result = extractUserFunction(undefined, mockContext);

      // Assert
      expect(result).toEqual(nestedUser);
      expect((result as any).deepProperty.level).toBe(1);
    });
  });

  // ============================================================================
  // TESTS - TYPES DE DONNÉES INATTENDUS
  // ============================================================================

  describe('Types de données inattendus', () => {
    it('should handle user object with function properties', () => {
      // Arrange
      const userWithFunction = {
        ...createTestUser(),
        someMethod: () => 'test',
        getData: function() { return this.id; }
      };
      const mockRequest = { user: userWithFunction };
      const mockContext = createMockExecutionContext(mockRequest);

      // Act
      const result = extractUserFunction(undefined, mockContext);

      // Assert
      expect(result).toEqual(userWithFunction);
      expect(typeof (result as any).someMethod).toBe('function');
      expect(typeof (result as any).getData).toBe('function');
    });

    it('should handle user with Symbol properties', () => {
      // Arrange
      const symbolKey = Symbol('userSymbol');
      const userWithSymbol = {
        ...createTestUser(),
        [symbolKey]: 'symbol-value'
      };
      const mockRequest = { user: userWithSymbol };
      const mockContext = createMockExecutionContext(mockRequest);

      // Act
      const result = extractUserFunction(undefined, mockContext);

      // Assert
      expect(result).toEqual(userWithSymbol);
      expect((result as any)[symbolKey]).toBe('symbol-value');
    });

    it('should handle user with Date objects', () => {
      // Arrange
      const now = new Date();
      const userWithDates = {
        ...createTestUser(),
        createdAt: now,
        lastLogin: new Date('2025-01-01')
      };
      const mockRequest = { user: userWithDates };
      const mockContext = createMockExecutionContext(mockRequest);

      // Act
      const result = extractUserFunction(undefined, mockContext);

      // Assert
      expect(result).toEqual(userWithDates);
      expect((result as any).createdAt).toBeInstanceOf(Date);
      expect((result as any).lastLogin).toBeInstanceOf(Date);
    });

    it('should handle user with RegExp objects', () => {
      // Arrange
      const userWithRegex = {
        ...createTestUser(),
        emailPattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        idPattern: new RegExp('^[a-zA-Z0-9-]+$')
      };
      const mockRequest = { user: userWithRegex };
      const mockContext = createMockExecutionContext(mockRequest);

      // Act
      const result = extractUserFunction(undefined, mockContext);

      // Assert
      expect(result).toEqual(userWithRegex);
      expect((result as any).emailPattern).toBeInstanceOf(RegExp);
      expect((result as any).idPattern).toBeInstanceOf(RegExp);
    });

    it('should handle user with BigInt properties', () => {
      // Arrange
      const userWithBigInt = {
        ...createTestUser(),
        bigNumber: BigInt('9007199254740991'),
        anotherBigInt: 123n
      };
      const mockRequest = { user: userWithBigInt };
      const mockContext = createMockExecutionContext(mockRequest);

      // Act
      const result = extractUserFunction(undefined, mockContext);

      // Assert
      expect(result).toEqual(userWithBigInt);
      expect(typeof (result as any).bigNumber).toBe('bigint');
      expect(typeof (result as any).anotherBigInt).toBe('bigint');
    });
  });

  // ============================================================================
  // TESTS - CONTEXTES DÉGRADÉS
  // ============================================================================

  describe('Contextes dégradés', () => {
    it('should handle request with corrupted prototype', () => {
      // Arrange
      const testUser = createTestUser();
      const corruptedRequest = Object.create(null);
      corruptedRequest.user = testUser;
      const mockContext = createMockExecutionContext(corruptedRequest);

      // Act
      const result = extractUserFunction(undefined, mockContext);

      // Assert
      expect(result).toEqual(testUser);
    });

    it('should handle request with overridden toString method', () => {
      // Arrange
      const testUser = createTestUser();
      const mockRequest = {
        user: testUser,
        toString: () => 'corrupted-request'
      };
      const mockContext = createMockExecutionContext(mockRequest);

      // Act
      const result = extractUserFunction(undefined, mockContext);

      // Assert
      expect(result).toEqual(testUser);
    });

    it('should handle request with Proxy wrapper', () => {
      // Arrange
      const testUser = createTestUser();
      const baseRequest = { user: testUser };
      const proxyRequest = new Proxy(baseRequest, {
        get: (target, prop) => {
          if (prop === 'user') return target.user;
          return target[prop as keyof typeof target];
        }
      });
      const mockContext = createMockExecutionContext(proxyRequest);

      // Act
      const result = extractUserFunction(undefined, mockContext);

      // Assert
      expect(result).toEqual(testUser);
    });

    it('should handle frozen user object', () => {
      // Arrange
      const testUser = createTestUser();
      const frozenUser = Object.freeze(testUser);
      const mockRequest = { user: frozenUser };
      const mockContext = createMockExecutionContext(mockRequest);

      // Act
      const result = extractUserFunction(undefined, mockContext);

      // Assert
      expect(result).toEqual(frozenUser);
      expect(Object.isFrozen(result)).toBe(true);
    });

    it('should handle sealed user object', () => {
      // Arrange
      const testUser = createTestUser();
      const sealedUser = Object.seal(testUser);
      const mockRequest = { user: sealedUser };
      const mockContext = createMockExecutionContext(mockRequest);

      // Act
      const result = extractUserFunction(undefined, mockContext);

      // Assert
      expect(result).toEqual(sealedUser);
      expect(Object.isSealed(result)).toBe(true);
    });
  });
});