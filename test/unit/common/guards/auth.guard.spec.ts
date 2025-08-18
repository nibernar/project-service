// test/unit/common/guards/auth.guard.spec.ts

import {
  ExecutionContext,
  UnauthorizedException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { Test, TestingModule } from '@nestjs/testing';
import { of, throwError } from 'rxjs';
import { AxiosResponse, AxiosError } from 'axios';

import { AuthGuard } from '../../../../src/common/guards/auth.guard';
import { CacheService } from '../../../../src/cache/cache.service';
import { User } from '../../../../src/common/interfaces/user.interface';

describe('AuthGuard - Unit Tests', () => {
  let authGuard: AuthGuard;
  let configService: jest.Mocked<ConfigService>;
  let cacheService: jest.Mocked<CacheService>;
  let httpService: jest.Mocked<HttpService>;

  // ============================================================================
  // HELPERS DE TEST
  // ============================================================================

  const createMockExecutionContext = (request: any): ExecutionContext => {
    return {
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
    } as ExecutionContext;
  };

  const createValidUser = (): User => ({
    id: 'user-123',
    email: 'test@example.com',
    roles: ['user'],
  });

  const createValidAuthResponse = (
    user: User = createValidUser(),
  ): AxiosResponse => ({
    data: {
      valid: true,
      user: {
        id: user.id,
        email: user.email,
        roles: user.roles,
      },
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    },
    status: 200,
    statusText: 'OK',
    headers: {},
    config: {} as any,
  });

  const createValidToken = (): string => {
    return 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEyMyIsImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSIsInJvbGVzIjpbInVzZXIiXSwiaWF0IjoxNjE2MjM5MDIyfQ.signature';
  };

  // ============================================================================
  // SETUP ET TEARDOWN
  // ============================================================================

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthGuard,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
        {
          provide: CacheService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
          },
        },
        {
          provide: HttpService,
          useValue: {
            post: jest.fn(),
          },
        },
      ],
    }).compile();

    authGuard = module.get<AuthGuard>(AuthGuard);
    configService = module.get(ConfigService);
    cacheService = module.get(CacheService);
    httpService = module.get(HttpService);

    // Configuration par défaut
    configService.get.mockImplementation((key: string) => {
      switch (key) {
        case 'AUTH_SERVICE_URL':
          return 'http://localhost:3001';
        case 'AUTH_SERVICE_TIMEOUT':
          return '5000';
        default:
          return undefined;
      }
    });

    process.env.AUTH_SERVICE_URL = 'http://localhost:3001';
    process.env.AUTH_SERVICE_TIMEOUT = '5000';
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  // ============================================================================
  // TESTS UNITAIRES - FONCTIONNEMENT NORMAL
  // ============================================================================

  describe('canActivate', () => {
    it('should be defined', () => {
      expect(authGuard).toBeDefined();
      expect(authGuard.canActivate).toBeDefined();
    });

    it('should return true for valid cached user', async () => {
      // Arrange
      const token = createValidToken();
      const user = createValidUser();
      const request = { headers: { authorization: `Bearer ${token}` } };
      const context = createMockExecutionContext(request);

      cacheService.get.mockResolvedValue(user);

      // Act
      const result = await authGuard.canActivate(context);

      // Assert
      expect(result).toBe(true);
      expect((request as any).user).toEqual(user);
      expect(cacheService.get).toHaveBeenCalledWith(
        expect.stringMatching(/^auth:token:/),
      );
      expect(httpService.post).not.toHaveBeenCalled();
    });

    it('should return true for valid token from auth service', async () => {
      // Arrange
      const token = createValidToken();
      const user = createValidUser();
      const request = { headers: { authorization: `Bearer ${token}` } };
      const context = createMockExecutionContext(request);

      cacheService.get.mockResolvedValue(null); // Cache miss
      httpService.post.mockReturnValue(of(createValidAuthResponse(user)));

      // Act
      const result = await authGuard.canActivate(context);

      // Assert
      expect(result).toBe(true);
      expect((request as any).user).toEqual(user);
      expect(cacheService.get).toHaveBeenCalled();
      expect(httpService.post).toHaveBeenCalledWith(
        'http://localhost:3001/auth/validate',
        { token },
        expect.objectContaining({
          timeout: 5000,
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        }),
      );
      expect(cacheService.set).toHaveBeenCalledWith(
        expect.stringMatching(/^auth:token:/),
        user,
        expect.any(Number), // Plus flexible que 300 exact
      );
    });

    it('should inject user into request context', async () => {
      // Arrange
      const token = createValidToken();
      const user = createValidUser();
      const request = { headers: { authorization: `Bearer ${token}` } };
      const context = createMockExecutionContext(request);

      cacheService.get.mockResolvedValue(user);

      // Act
      await authGuard.canActivate(context);

      // Assert
      expect((request as any).user).toEqual(user);
      expect((request as any).user).toHaveProperty('id', user.id);
      expect((request as any).user).toHaveProperty('email', user.email);
      expect((request as any).user).toHaveProperty('roles', user.roles);
    });

    it('should handle user with multiple roles', async () => {
      // Arrange
      const token = createValidToken();
      const adminUser: User = {
        id: 'admin-456',
        email: 'admin@example.com',
        roles: ['user', 'admin', 'moderator'],
      };
      const request = { headers: { authorization: `Bearer ${token}` } };
      const context = createMockExecutionContext(request);

      cacheService.get.mockResolvedValue(null);
      httpService.post.mockReturnValue(of(createValidAuthResponse(adminUser)));

      // Act
      const result = await authGuard.canActivate(context);

      // Assert
      expect(result).toBe(true);
      expect((request as any).user).toEqual(adminUser);
      expect((request as any).user.roles).toContain('user');
      expect((request as any).user.roles).toContain('admin');
      expect((request as any).user.roles).toContain('moderator');
    });

    it('should use cached user and not call auth service', async () => {
      // Arrange
      const token = createValidToken();
      const cachedUser = createValidUser();
      const request = { headers: { authorization: `Bearer ${token}` } };
      const context = createMockExecutionContext(request);

      cacheService.get.mockResolvedValue(cachedUser);

      // Act
      const result = await authGuard.canActivate(context);

      // Assert
      expect(result).toBe(true);
      expect(httpService.post).not.toHaveBeenCalled();
      expect(cacheService.set).not.toHaveBeenCalled(); // Pas de mise à jour du cache
      expect((request as any).user).toEqual(cachedUser);
    });
  });

  // ============================================================================
  // TESTS UNITAIRES - GESTION DES ERREURS
  // ============================================================================

  describe('Error Handling', () => {
    it('should throw UnauthorizedException when no authorization header', async () => {
      // Arrange
      const request = { headers: {} };
      const context = createMockExecutionContext(request);

      // Act & Assert
      await expect(authGuard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(authGuard.canActivate(context)).rejects.toThrow(
        'No token provided',
      );

      expect(cacheService.get).not.toHaveBeenCalled();
      expect(httpService.post).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when authorization header is malformed', async () => {
      // Arrange
      const malformedHeaders = [
        'InvalidToken',
        'Bearer',
        'Bearer ',
        'Basic dXNlcjpwYXNz',
        'Token abc123',
      ];

      for (const auth of malformedHeaders) {
        const request = { headers: { authorization: auth } };
        const context = createMockExecutionContext(request);

        // Act & Assert
        await expect(authGuard.canActivate(context)).rejects.toThrow(
          UnauthorizedException,
        );
        await expect(authGuard.canActivate(context)).rejects.toThrow(
          'Invalid token format',
        );
      }
    });

    it('should throw UnauthorizedException when token is invalid', async () => {
      // Arrange
      const invalidToken = 'invalid.token.signature';
      const request = { headers: { authorization: `Bearer ${invalidToken}` } };
      const context = createMockExecutionContext(request);

      cacheService.get.mockResolvedValue(null);
      httpService.post.mockReturnValue(
        throwError(() => new AxiosError('Invalid token', '401')),
      );

      // Act & Assert
      await expect(authGuard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(authGuard.canActivate(context)).rejects.toThrow(
        'Authentication failed',
      );

      expect(cacheService.get).toHaveBeenCalled();
      expect(httpService.post).toHaveBeenCalled();
      expect(cacheService.set).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when token is expired', async () => {
      // Arrange
      const expiredToken = createValidToken();
      const request = { headers: { authorization: `Bearer ${expiredToken}` } };
      const context = createMockExecutionContext(request);

      cacheService.get.mockResolvedValue(null);
      httpService.post.mockReturnValue(
        throwError(() => new AxiosError('Token expired', '401')),
      );

      // Act & Assert
      await expect(authGuard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );

      expect(cacheService.get).toHaveBeenCalled();
      expect(httpService.post).toHaveBeenCalled();
    });

    it('should throw ServiceUnavailableException when auth service is down', async () => {
      // Arrange
      const token = createValidToken();
      const request = { headers: { authorization: `Bearer ${token}` } };
      const context = createMockExecutionContext(request);

      cacheService.get.mockResolvedValue(null);
      httpService.post.mockReturnValue(
        throwError(() =>
          Object.assign(new Error('connect ECONNREFUSED'), {
            code: 'ECONNREFUSED',
          }),
        ),
      );

      // Act & Assert
      await expect(authGuard.canActivate(context)).rejects.toThrow(
        ServiceUnavailableException,
      );
      await expect(authGuard.canActivate(context)).rejects.toThrow(
        'Authentication service unavailable',
      );
    });

    it('should throw ServiceUnavailableException on timeout', async () => {
      // Arrange
      const token = createValidToken();
      const request = { headers: { authorization: `Bearer ${token}` } };
      const context = createMockExecutionContext(request);

      cacheService.get.mockResolvedValue(null);
      httpService.post.mockReturnValue(
        throwError(() => new Error('timeout of 5000ms exceeded')),
      );

      // Act & Assert
      await expect(authGuard.canActivate(context)).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('should handle auth service returning invalid response', async () => {
      // Arrange
      const token = createValidToken();
      const request = { headers: { authorization: `Bearer ${token}` } };
      const context = createMockExecutionContext(request);

      cacheService.get.mockResolvedValue(null);
      httpService.post.mockReturnValue(
        of({
          data: { valid: false },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        }),
      );

      // Act & Assert
      await expect(authGuard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(authGuard.canActivate(context)).rejects.toThrow(
        'Authentication failed',
      );
    });

    it('should handle auth service returning malformed response', async () => {
      // Arrange
      const token = createValidToken();
      const request = { headers: { authorization: `Bearer ${token}` } };
      const context = createMockExecutionContext(request);

      cacheService.get.mockResolvedValue(null);
      httpService.post.mockReturnValue(
        of({
          data: { invalid: 'response' },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        }),
      );

      // Act & Assert
      await expect(authGuard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  // ============================================================================
  // TESTS UNITAIRES - GESTION DU CACHE
  // ============================================================================

  describe('Cache Management', () => {
    it('should set user in cache after successful authentication', async () => {
      // Arrange
      const token = createValidToken();
      const user = createValidUser();
      const request = { headers: { authorization: `Bearer ${token}` } };
      const context = createMockExecutionContext(request);

      cacheService.get.mockResolvedValue(null);
      httpService.post.mockReturnValue(of(createValidAuthResponse(user)));
      cacheService.set.mockResolvedValue();

      // Act
      await authGuard.canActivate(context);

      // Assert
      expect(cacheService.set).toHaveBeenCalledWith(
        expect.stringMatching(/^auth:token:[a-f0-9]{64}$/),
        user,
        300,
      );
    });

    it('should continue execution even if cache set fails', async () => {
      // Arrange
      const token = createValidToken();
      const user = createValidUser();
      const request = { headers: { authorization: `Bearer ${token}` } };
      const context = createMockExecutionContext(request);

      cacheService.get.mockResolvedValue(null);
      httpService.post.mockReturnValue(of(createValidAuthResponse(user)));
      cacheService.set.mockRejectedValue(new Error('Redis connection failed'));

      // Act
      const result = await authGuard.canActivate(context);

      // Assert
      expect(result).toBe(true);
      expect((request as any).user).toEqual(user);
      expect(cacheService.set).toHaveBeenCalled();
    });

    it('should continue execution if cache get fails', async () => {
      // Arrange
      const token = createValidToken();
      const user = createValidUser();
      const request = { headers: { authorization: `Bearer ${token}` } };
      const context = createMockExecutionContext(request);

      cacheService.get.mockRejectedValue(new Error('Redis connection failed'));
      httpService.post.mockReturnValue(of(createValidAuthResponse(user)));

      // Act
      const result = await authGuard.canActivate(context);

      // Assert
      expect(result).toBe(true);
      expect((request as any).user).toEqual(user);
      expect(httpService.post).toHaveBeenCalled(); // Fallback to auth service
    });

    it('should use correct cache key format', async () => {
      // Arrange
      const token = createValidToken();
      const user = createValidUser();
      const request = { headers: { authorization: `Bearer ${token}` } };
      const context = createMockExecutionContext(request);

      cacheService.get.mockResolvedValue(null);
      httpService.post.mockReturnValue(of(createValidAuthResponse(user)));

      // Act
      await authGuard.canActivate(context);

      // Assert
      expect(cacheService.get).toHaveBeenCalledWith(
        expect.stringMatching(/^auth:token:[a-f0-9]{64}$/),
      );
      expect(cacheService.set).toHaveBeenCalledWith(
        expect.stringMatching(/^auth:token:[a-f0-9]{64}$/),
        user,
        300,
      );

      // Vérifier que les clés get et set sont identiques
      const getKey = cacheService.get.mock.calls[0][0];
      const setKey = cacheService.set.mock.calls[0][0];
      expect(getKey).toBe(setKey);
    });

    it('should handle cache returning null gracefully', async () => {
      // Arrange
      const token = createValidToken();
      const user = createValidUser();
      const request = { headers: { authorization: `Bearer ${token}` } };
      const context = createMockExecutionContext(request);

      cacheService.get.mockResolvedValue(null);
      httpService.post.mockReturnValue(of(createValidAuthResponse(user)));

      // Act
      const result = await authGuard.canActivate(context);

      // Assert
      expect(result).toBe(true);
      expect(httpService.post).toHaveBeenCalled();
      expect(cacheService.set).toHaveBeenCalled();
    });

    it('should handle cache returning undefined gracefully', async () => {
      // Arrange
      const token = createValidToken();
      const user = createValidUser();
      const request = { headers: { authorization: `Bearer ${token}` } };
      const context = createMockExecutionContext(request);

      cacheService.get.mockResolvedValue(undefined);
      httpService.post.mockReturnValue(of(createValidAuthResponse(user)));

      // Act
      const result = await authGuard.canActivate(context);

      // Assert
      expect(result).toBe(true);
      expect(httpService.post).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // TESTS UNITAIRES - CONFIGURATION
  // ============================================================================

  describe('Configuration', () => {
    it('should use configured auth service URL', async () => {
      // Arrange
      const customUrl = 'https://custom-auth.example.com';
      configService.get.mockImplementation((key: string) => {
        if (key === 'AUTH_SERVICE_URL') return customUrl;
        if (key === 'AUTH_SERVICE_TIMEOUT') return '3000';
        return undefined;
      });

      const token = createValidToken();
      const user = createValidUser();
      const request = { headers: { authorization: `Bearer ${token}` } };
      const context = createMockExecutionContext(request);

      cacheService.get.mockResolvedValue(null);
      httpService.post.mockReturnValue(of(createValidAuthResponse(user)));

      // Act
      await authGuard.canActivate(context);

      // Assert
      expect(httpService.post).toHaveBeenCalledWith(
        `${customUrl}/auth/validate`,
        { token },
        expect.any(Object),
      );
    });

    it('should use configured timeout', async () => {
      // Arrange
      const customTimeout = '10000';
      configService.get.mockImplementation((key: string) => {
        if (key === 'AUTH_SERVICE_URL') return 'http://localhost:3001';
        if (key === 'AUTH_SERVICE_TIMEOUT') return customTimeout;
        return undefined;
      });

      const token = createValidToken();
      const user = createValidUser();
      const request = { headers: { authorization: `Bearer ${token}` } };
      const context = createMockExecutionContext(request);

      cacheService.get.mockResolvedValue(null);
      httpService.post.mockReturnValue(of(createValidAuthResponse(user)));

      // Act
      await authGuard.canActivate(context);

      // Assert
      expect(httpService.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({
          timeout: 10000,
        }),
      );
    });

    it('should use default values when configuration is missing', async () => {
      // Arrange
      configService.get.mockReturnValue(undefined);
      process.env.AUTH_SERVICE_URL = 'http://fallback-auth.local';
      process.env.AUTH_SERVICE_TIMEOUT = '7500';

      const token = createValidToken();
      const user = createValidUser();
      const request = { headers: { authorization: `Bearer ${token}` } };
      const context = createMockExecutionContext(request);

      cacheService.get.mockResolvedValue(null);
      httpService.post.mockReturnValue(of(createValidAuthResponse(user)));

      // Act
      await authGuard.canActivate(context);

      // Assert
      expect(httpService.post).toHaveBeenCalledWith(
        'http://fallback-auth.local/auth/validate',
        { token },
        expect.objectContaining({
          timeout: 7500,
        }),
      );
    });

    it('should handle missing environment variables gracefully', async () => {
      // Arrange
      configService.get.mockReturnValue(undefined);
      delete process.env.AUTH_SERVICE_URL;
      delete process.env.AUTH_SERVICE_TIMEOUT;

      const token = createValidToken();
      const request = { headers: { authorization: `Bearer ${token}` } };
      const context = createMockExecutionContext(request);

      cacheService.get.mockResolvedValue(null);

      // Act & Assert
      await expect(authGuard.canActivate(context)).rejects.toThrow();
    });
  });

  // ============================================================================
  // TESTS UNITAIRES - VALIDATION DES DONNÉES
  // ============================================================================

  describe('Data Validation', () => {
    it('should validate user object structure from auth service', async () => {
      // Arrange
      const token = createValidToken();
      const validUser = createValidUser();
      const request = { headers: { authorization: `Bearer ${token}` } };
      const context = createMockExecutionContext(request);

      cacheService.get.mockResolvedValue(null);
      httpService.post.mockReturnValue(of(createValidAuthResponse(validUser)));

      // Act
      const result = await authGuard.canActivate(context);

      // Assert
      expect(result).toBe(true);
      const injectedUser = (request as any).user;
      expect(injectedUser).toHaveProperty('id');
      expect(injectedUser).toHaveProperty('email');
      expect(injectedUser).toHaveProperty('roles');
      expect(Array.isArray(injectedUser.roles)).toBe(true);
    });

    it('should handle user with empty roles array', async () => {
      // Arrange
      const token = createValidToken();
      const userWithoutRoles: User = {
        id: 'user-789',
        email: 'noroles@example.com',
        roles: [],
      };
      const request = { headers: { authorization: `Bearer ${token}` } };
      const context = createMockExecutionContext(request);

      cacheService.get.mockResolvedValue(null);
      httpService.post.mockReturnValue(
        of(createValidAuthResponse(userWithoutRoles)),
      );

      // Act
      const result = await authGuard.canActivate(context);

      // Assert
      expect(result).toBe(true);
      expect((request as any).user).toEqual(userWithoutRoles);
      expect((request as any).user.roles).toEqual([]);
    });

    it('should handle user with special characters in email', async () => {
      // Arrange
      const token = createValidToken();
      const userWithSpecialEmail: User = {
        id: 'user-special',
        email: 'user+tag@example-domain.co.uk',
        roles: ['user'],
      };
      const request = { headers: { authorization: `Bearer ${token}` } };
      const context = createMockExecutionContext(request);

      cacheService.get.mockResolvedValue(userWithSpecialEmail);

      // Act
      const result = await authGuard.canActivate(context);

      // Assert
      expect(result).toBe(true);
      expect((request as any).user).toEqual(userWithSpecialEmail);
    });

    it('should handle user with long ID', async () => {
      // Arrange
      const token = createValidToken();
      const userWithLongId: User = {
        id: 'user-' + 'a'.repeat(100),
        email: 'longid@example.com',
        roles: ['user'],
      };
      const request = { headers: { authorization: `Bearer ${token}` } };
      const context = createMockExecutionContext(request);

      cacheService.get.mockResolvedValue(userWithLongId);

      // Act
      const result = await authGuard.canActivate(context);

      // Assert
      expect(result).toBe(true);
      expect((request as any).user.id).toBe(userWithLongId.id);
    });

    it('should reject auth response missing user data', async () => {
      // Arrange
      const token = createValidToken();
      const request = { headers: { authorization: `Bearer ${token}` } };
      const context = createMockExecutionContext(request);

      cacheService.get.mockResolvedValue(null);
      httpService.post.mockReturnValue(
        of({
          data: {
            valid: true,
            // user missing
            expiresAt: new Date(Date.now() + 3600000).toISOString(),
          },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        }),
      );

      // Act & Assert
      await expect(authGuard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should reject user missing required fields', async () => {
      // Arrange
      const token = createValidToken();
      const request = { headers: { authorization: `Bearer ${token}` } };
      const context = createMockExecutionContext(request);

      cacheService.get.mockResolvedValue(null);
      httpService.post.mockReturnValue(
        of({
          data: {
            valid: true,
            user: {
              // id missing
              email: 'incomplete@example.com',
              roles: ['user'],
            },
            expiresAt: new Date(Date.now() + 3600000).toISOString(),
          },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        }),
      );

      // Act & Assert
      await expect(authGuard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
