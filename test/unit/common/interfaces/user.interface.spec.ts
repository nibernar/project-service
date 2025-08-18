/**
 * Tests unitaires principaux pour l'interface User
 *
 * @fileoverview Tests des fonctionnalités principales de l'interface utilisateur
 * @version 1.0.0
 * @since 2025-01-28
 */

import {
  User,
  UserRole,
  ExtendedUser,
  UserPreferences,
  AdminUser,
  PremiumUser,
  hasRole,
  hasAnyRole,
  hasAllRoles,
  isAdmin,
  isPremium,
  createUser,
  createExtendedUser,
  createDefaultPreferences,
  isValidUser,
  isExtendedUser,
  hasVerifiedEmail,
  isActiveUser,
  getDisplayName,
  getUserPreferences,
} from '../../../../src/common/interfaces/user.interface';

describe('User Interface - Tests Principaux', () => {
  // ============================================================================
  // 1. TESTS DE L'INTERFACE USER DE BASE
  // ============================================================================

  describe('Interface User', () => {
    let validUser: User;

    beforeEach(() => {
      validUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'user@example.com',
        roles: ['user'],
      };
    });

    it('devrait créer un utilisateur valide avec toutes les propriétés', () => {
      expect(validUser).toBeDefined();
      expect(validUser.id).toBe('123e4567-e89b-12d3-a456-426614174000');
      expect(validUser.email).toBe('user@example.com');
      expect(validUser.roles).toEqual(['user']);
    });

    it('devrait accepter un utilisateur avec des rôles multiples', () => {
      const multiRoleUser: User = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'admin@example.com',
        roles: ['user', 'admin', 'premium'],
      };

      expect(multiRoleUser.roles).toHaveLength(3);
      expect(multiRoleUser.roles).toContain('user');
      expect(multiRoleUser.roles).toContain('admin');
      expect(multiRoleUser.roles).toContain('premium');
    });

    it('devrait accepter un utilisateur avec roles vide', () => {
      const emptyRolesUser: User = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'empty@example.com',
        roles: [],
      };

      expect(emptyRolesUser.roles).toEqual([]);
      expect(emptyRolesUser.roles).toHaveLength(0);
    });
  });

  // ============================================================================
  // 2. TESTS DE L'ENUM USERROLE
  // ============================================================================

  describe('UserRole Enum', () => {
    it('devrait définir toutes les valeurs de rôles', () => {
      expect(UserRole.USER).toBe('user');
      expect(UserRole.ADMIN).toBe('admin');
      expect(UserRole.PREMIUM).toBe('premium');
    });

    it('devrait permettre la comparaison avec des strings', () => {
      expect(UserRole.USER === 'user').toBe(true);
      expect(UserRole.ADMIN === 'admin').toBe(true);
      expect(UserRole.PREMIUM === 'premium').toBe(true);
    });

    it("devrait être utilisable comme clé d'objet", () => {
      const permissions = {
        [UserRole.USER]: ['read'],
        [UserRole.ADMIN]: ['read', 'write', 'delete'],
        [UserRole.PREMIUM]: ['read', 'write'],
      };

      expect(permissions[UserRole.USER]).toEqual(['read']);
      expect(permissions[UserRole.ADMIN]).toEqual(['read', 'write', 'delete']);
      expect(permissions[UserRole.PREMIUM]).toEqual(['read', 'write']);
    });
  });

  // ============================================================================
  // 3. TESTS DES FONCTIONS DE VÉRIFICATION DE RÔLES
  // ============================================================================

  describe('hasRole()', () => {
    let user: User;

    beforeEach(() => {
      user = {
        id: '123',
        email: 'test@example.com',
        roles: ['user', 'premium'],
      };
    });

    it("devrait retourner true si l'utilisateur a le rôle", () => {
      expect(hasRole(user, UserRole.USER)).toBe(true);
      expect(hasRole(user, UserRole.PREMIUM)).toBe(true);
    });

    it("devrait retourner false si l'utilisateur n'a pas le rôle", () => {
      expect(hasRole(user, UserRole.ADMIN)).toBe(false);
    });

    it('devrait être case-sensitive', () => {
      const upperCaseRoleUser = {
        ...user,
        roles: ['USER', 'PREMIUM'],
      };

      expect(hasRole(upperCaseRoleUser, UserRole.USER)).toBe(false);
      expect(hasRole(upperCaseRoleUser, UserRole.PREMIUM)).toBe(false);
    });
  });

  describe('hasAnyRole()', () => {
    let user: User;

    beforeEach(() => {
      user = {
        id: '123',
        email: 'test@example.com',
        roles: ['user', 'premium'],
      };
    });

    it("devrait retourner true si l'utilisateur a au moins un des rôles", () => {
      expect(hasAnyRole(user, [UserRole.USER, UserRole.ADMIN])).toBe(true);
      expect(hasAnyRole(user, [UserRole.PREMIUM, UserRole.ADMIN])).toBe(true);
      expect(hasAnyRole(user, [UserRole.USER, UserRole.PREMIUM])).toBe(true);
    });

    it("devrait retourner false si l'utilisateur n'a aucun des rôles", () => {
      expect(hasAnyRole(user, [UserRole.ADMIN])).toBe(false);
    });

    it('devrait retourner false pour un tableau de rôles vide', () => {
      expect(hasAnyRole(user, [])).toBe(false);
    });

    it('devrait fonctionner avec un seul rôle dans le tableau', () => {
      expect(hasAnyRole(user, [UserRole.USER])).toBe(true);
      expect(hasAnyRole(user, [UserRole.ADMIN])).toBe(false);
    });
  });

  describe('hasAllRoles()', () => {
    let user: User;

    beforeEach(() => {
      user = {
        id: '123',
        email: 'test@example.com',
        roles: ['user', 'premium', 'admin'],
      };
    });

    it("devrait retourner true si l'utilisateur a tous les rôles requis", () => {
      expect(hasAllRoles(user, [UserRole.USER, UserRole.PREMIUM])).toBe(true);
      expect(hasAllRoles(user, [UserRole.USER])).toBe(true);
      expect(
        hasAllRoles(user, [UserRole.USER, UserRole.PREMIUM, UserRole.ADMIN]),
      ).toBe(true);
    });

    it("devrait retourner false si l'utilisateur n'a pas tous les rôles requis", () => {
      const partialUser = {
        ...user,
        roles: ['user', 'premium'],
      };

      expect(
        hasAllRoles(partialUser, [
          UserRole.USER,
          UserRole.PREMIUM,
          UserRole.ADMIN,
        ]),
      ).toBe(false);
    });

    it('devrait retourner true pour un tableau de rôles vide', () => {
      expect(hasAllRoles(user, [])).toBe(true);
    });

    it('devrait gérer les doublons dans les rôles requis', () => {
      expect(
        hasAllRoles(user, [UserRole.USER, UserRole.USER, UserRole.PREMIUM]),
      ).toBe(true);
    });
  });

  // ============================================================================
  // 4. TESTS DES FONCTIONS SPÉCIALISÉES
  // ============================================================================

  describe('isAdmin()', () => {
    it('devrait retourner true pour un utilisateur admin', () => {
      const adminUser: User = {
        id: '123',
        email: 'admin@example.com',
        roles: ['user', 'admin'],
      };

      expect(isAdmin(adminUser)).toBe(true);
    });

    it('devrait retourner false pour un utilisateur non-admin', () => {
      const regularUser: User = {
        id: '123',
        email: 'user@example.com',
        roles: ['user', 'premium'],
      };

      expect(isAdmin(regularUser)).toBe(false);
    });

    it('devrait fonctionner comme type guard', () => {
      const adminUser: User = {
        id: '123',
        email: 'admin@example.com',
        roles: ['user', 'admin'],
      };

      if (isAdmin(adminUser)) {
        // TypeScript devrait reconnaître adminUser comme AdminUser
        expect(adminUser.roles).toContain('admin');
      }
    });
  });

  describe('isPremium()', () => {
    it('devrait retourner true pour un utilisateur premium', () => {
      const premiumUser: User = {
        id: '123',
        email: 'premium@example.com',
        roles: ['user', 'premium'],
      };

      expect(isPremium(premiumUser)).toBe(true);
    });

    it('devrait retourner false pour un utilisateur non-premium', () => {
      const regularUser: User = {
        id: '123',
        email: 'user@example.com',
        roles: ['user'],
      };

      expect(isPremium(regularUser)).toBe(false);
    });
  });

  // ============================================================================
  // 5. TESTS DE CRÉATION D'UTILISATEURS
  // ============================================================================

  describe('createUser()', () => {
    it('devrait créer un utilisateur avec les rôles par défaut', () => {
      const user = createUser('123', 'user@example.com');

      expect(user.id).toBe('123');
      expect(user.email).toBe('user@example.com');
      expect(user.roles).toEqual(['user']);
    });

    it('devrait créer un utilisateur avec des rôles additionnels', () => {
      const user = createUser('123', 'admin@example.com', [
        UserRole.ADMIN,
        UserRole.PREMIUM,
      ]);

      expect(user.roles).toContain('user'); // Rôle par défaut ajouté
      expect(user.roles).toContain('admin');
      expect(user.roles).toContain('premium');
    });

    it('devrait dédupliquer les rôles', () => {
      const user = createUser('123', 'user@example.com', [
        UserRole.USER,
        UserRole.PREMIUM,
        UserRole.USER,
      ]);

      expect(user.roles).toEqual(['user', 'premium']);
      expect(user.roles).toHaveLength(2);
    });

    it("devrait ajouter le rôle user même s'il est déjà présent", () => {
      const user = createUser('123', 'user@example.com', [
        UserRole.USER,
        UserRole.PREMIUM,
      ]);

      expect(user.roles).toEqual(['user', 'premium']);
      expect(user.roles.filter((role) => role === 'user')).toHaveLength(1);
    });

    it('devrait gérer un tableau de rôles vide', () => {
      const user = createUser('123', 'user@example.com', []);

      expect(user.roles).toEqual(['user']);
    });
  });

  describe('createExtendedUser()', () => {
    let baseUser: User;

    beforeEach(() => {
      baseUser = createUser('123', 'user@example.com', [UserRole.PREMIUM]);
    });

    it('devrait étendre un utilisateur de base', () => {
      const extendedUser = createExtendedUser(baseUser, {
        name: 'John Doe',
        avatar: 'https://example.com/avatar.jpg',
      });

      expect(extendedUser.id).toBe(baseUser.id);
      expect(extendedUser.email).toBe(baseUser.email);
      expect(extendedUser.roles).toEqual(baseUser.roles);
      expect(extendedUser.name).toBe('John Doe');
      expect(extendedUser.avatar).toBe('https://example.com/avatar.jpg');
    });

    it('devrait créer une copie sans extensions', () => {
      const extendedUser = createExtendedUser(baseUser);

      expect(extendedUser).toEqual(baseUser);
      expect(extendedUser).not.toBe(baseUser); // Différente instance
    });

    it('devrait préserver les propriétés originales', () => {
      const extendedUser = createExtendedUser(baseUser, {
        name: 'John Doe',
        emailVerified: true,
      });

      expect(extendedUser.id).toBe(baseUser.id);
      expect(extendedUser.email).toBe(baseUser.email);
      expect(extendedUser.roles).toEqual(baseUser.roles);
    });
  });

  // ============================================================================
  // 6. TESTS DE VALIDATION ET TYPE GUARDS
  // ============================================================================

  describe('isValidUser()', () => {
    it('devrait valider un utilisateur correct', () => {
      const validUser = {
        id: '123',
        email: 'user@example.com',
        roles: ['user'],
      };

      expect(isValidUser(validUser)).toBe(true);
    });

    it('devrait rejeter un objet avec id manquant', () => {
      const invalidUser = {
        email: 'user@example.com',
        roles: ['user'],
      };

      expect(isValidUser(invalidUser)).toBe(false);
    });

    it('devrait rejeter un objet avec email manquant', () => {
      const invalidUser = {
        id: '123',
        roles: ['user'],
      };

      expect(isValidUser(invalidUser)).toBe(false);
    });

    it('devrait rejeter un objet avec roles manquant', () => {
      const invalidUser = {
        id: '123',
        email: 'user@example.com',
      };

      expect(isValidUser(invalidUser)).toBe(false);
    });

    it('devrait rejeter un email sans @', () => {
      const invalidUser = {
        id: '123',
        email: 'invalid-email',
        roles: ['user'],
      };

      expect(isValidUser(invalidUser)).toBe(false);
    });

    it('devrait rejeter des roles non-array', () => {
      const invalidUser = {
        id: '123',
        email: 'user@example.com',
        roles: 'user',
      };

      expect(isValidUser(invalidUser)).toBe(false);
    });

    it('devrait rejeter des roles avec des éléments non-string', () => {
      const invalidUser = {
        id: '123',
        email: 'user@example.com',
        roles: ['user', 123, null],
      };

      expect(isValidUser(invalidUser)).toBe(false);
    });

    it('devrait accepter un utilisateur avec roles vide', () => {
      const validUser = {
        id: '123',
        email: 'user@example.com',
        roles: [],
      };

      expect(isValidUser(validUser)).toBe(true);
    });
  });

  describe('isExtendedUser()', () => {
    let baseUser: User;
    let extendedUser: ExtendedUser;

    beforeEach(() => {
      baseUser = createUser('123', 'user@example.com');
      extendedUser = createExtendedUser(baseUser, {
        name: 'John Doe',
        avatar: 'https://example.com/avatar.jpg',
      });
    });

    it('devrait identifier un utilisateur étendu', () => {
      expect(isExtendedUser(extendedUser)).toBe(true);
    });

    it('devrait identifier un utilisateur de base comme non-étendu', () => {
      expect(isExtendedUser(baseUser)).toBe(false);
    });

    it('devrait identifier comme étendu avec une seule propriété', () => {
      const partialExtended = createExtendedUser(baseUser, { name: 'John' });
      expect(isExtendedUser(partialExtended)).toBe(true);
    });

    it('devrait identifier comme non-étendu avec propriétés undefined', () => {
      const pseudoExtended = createExtendedUser(baseUser, {
        name: undefined,
        avatar: undefined,
      });
      expect(isExtendedUser(pseudoExtended)).toBe(false);
    });
  });

  // ============================================================================
  // 7. TESTS DES PRÉFÉRENCES UTILISATEUR
  // ============================================================================

  describe('createDefaultPreferences()', () => {
    it('devrait créer des préférences par défaut', () => {
      const preferences = createDefaultPreferences();

      expect(preferences.language).toBe('en');
      expect(preferences.timezone).toBe('UTC');
      expect(preferences.theme).toBe('light');
      expect(preferences.notifications).toBe(true);
      expect(preferences.dateFormat).toBe('DD/MM/YYYY');
      expect(preferences.itemsPerPage).toBe(10);
    });

    it('devrait fusionner avec les overrides', () => {
      const preferences = createDefaultPreferences({
        theme: 'dark',
        language: 'fr',
      });

      expect(preferences.theme).toBe('dark');
      expect(preferences.language).toBe('fr');
      expect(preferences.timezone).toBe('UTC'); // Valeur par défaut préservée
      expect(preferences.notifications).toBe(true); // Valeur par défaut préservée
    });

    it('devrait gérer des overrides vides', () => {
      const preferences = createDefaultPreferences({});

      expect(preferences).toEqual(createDefaultPreferences());
    });

    it('devrait gérer des overrides partiels', () => {
      const preferences = createDefaultPreferences({
        itemsPerPage: 25,
      });

      expect(preferences.itemsPerPage).toBe(25);
      expect(preferences.language).toBe('en');
      expect(preferences.theme).toBe('light');
    });
  });

  describe('getUserPreferences()', () => {
    let baseUser: User;
    let extendedUser: ExtendedUser;

    beforeEach(() => {
      baseUser = createUser('123', 'user@example.com');
      extendedUser = createExtendedUser(baseUser, {
        preferences: {
          theme: 'dark',
          language: 'fr',
        },
      });
    });

    it('devrait retourner les préférences par défaut pour un utilisateur de base', () => {
      const preferences = getUserPreferences(baseUser);

      expect(preferences).toEqual(createDefaultPreferences());
    });

    it('devrait fusionner les préférences utilisateur avec les défauts', () => {
      const preferences = getUserPreferences(extendedUser);

      expect(preferences.theme).toBe('dark');
      expect(preferences.language).toBe('fr');
      expect(preferences.timezone).toBe('UTC'); // Valeur par défaut
      expect(preferences.notifications).toBe(true); // Valeur par défaut
    });

    it('devrait retourner les défauts pour un ExtendedUser sans préférences', () => {
      const userWithoutPrefs = createExtendedUser(baseUser, { name: 'John' });
      const preferences = getUserPreferences(userWithoutPrefs);

      expect(preferences).toEqual(createDefaultPreferences());
    });
  });

  // ============================================================================
  // 8. TESTS DE SÉCURITÉ ET STATUT
  // ============================================================================

  describe('hasVerifiedEmail()', () => {
    it('devrait retourner true pour un utilisateur avec email vérifié', () => {
      const verifiedUser = createExtendedUser(
        createUser('123', 'user@example.com'),
        {
          emailVerified: true,
        },
      );

      expect(hasVerifiedEmail(verifiedUser)).toBe(true);
    });

    it('devrait retourner false pour un utilisateur avec email non vérifié', () => {
      const unverifiedUser = createExtendedUser(
        createUser('123', 'user@example.com'),
        {
          emailVerified: false,
        },
      );

      expect(hasVerifiedEmail(unverifiedUser)).toBe(false);
    });

    it('devrait retourner false pour un utilisateur de base', () => {
      const baseUser = createUser('123', 'user@example.com');

      expect(hasVerifiedEmail(baseUser)).toBe(false);
    });

    it('devrait retourner false pour un ExtendedUser sans propriété emailVerified', () => {
      const extendedUser = createExtendedUser(
        createUser('123', 'user@example.com'),
        {
          name: 'John Doe',
        },
      );

      expect(hasVerifiedEmail(extendedUser)).toBe(false);
    });
  });

  describe('isActiveUser()', () => {
    it('devrait retourner true pour un utilisateur avec statut active', () => {
      const activeUser = createExtendedUser(
        createUser('123', 'user@example.com'),
        {
          status: 'active',
        },
      );

      expect(isActiveUser(activeUser)).toBe(true);
    });

    it('devrait retourner false pour un utilisateur suspendu', () => {
      const suspendedUser = createExtendedUser(
        createUser('123', 'user@example.com'),
        {
          status: 'suspended',
        },
      );

      expect(isActiveUser(suspendedUser)).toBe(false);
    });

    it('devrait retourner false pour un utilisateur en attente de vérification', () => {
      const pendingUser = createExtendedUser(
        createUser('123', 'user@example.com'),
        {
          status: 'pending_verification',
        },
      );

      expect(isActiveUser(pendingUser)).toBe(false);
    });

    it('devrait retourner true pour un utilisateur de base', () => {
      const baseUser = createUser('123', 'user@example.com');

      expect(isActiveUser(baseUser)).toBe(true);
    });

    it('devrait retourner true pour un ExtendedUser sans statut (undefined)', () => {
      const extendedUser = createExtendedUser(
        createUser('123', 'user@example.com'),
        {
          name: 'John Doe',
        },
      );

      expect(isActiveUser(extendedUser)).toBe(true);
    });
  });

  // ============================================================================
  // 9. TESTS D'AFFICHAGE ET UTILITAIRES
  // ============================================================================

  describe('getDisplayName()', () => {
    it('devrait retourner le nom pour un ExtendedUser avec nom', () => {
      const namedUser = createExtendedUser(
        createUser('123', 'user@example.com'),
        {
          name: 'John Doe',
        },
      );

      expect(getDisplayName(namedUser)).toBe('John Doe');
    });

    it("devrait retourner l'email pour un ExtendedUser sans nom", () => {
      const unnamedUser = createExtendedUser(
        createUser('123', 'user@example.com'),
        {
          avatar: 'https://example.com/avatar.jpg',
        },
      );

      expect(getDisplayName(unnamedUser)).toBe('user@example.com');
    });

    it("devrait retourner l'email pour un utilisateur de base", () => {
      const baseUser = createUser('123', 'user@example.com');

      expect(getDisplayName(baseUser)).toBe('user@example.com');
    });

    it('devrait gérer un nom vide', () => {
      const emptyNameUser = createExtendedUser(
        createUser('123', 'user@example.com'),
        {
          name: '',
        },
      );

      expect(getDisplayName(emptyNameUser)).toBe('user@example.com');
    });

    it('devrait gérer un nom avec seulement des espaces', () => {
      const spacesNameUser = createExtendedUser(
        createUser('123', 'user@example.com'),
        {
          name: '   ',
        },
      );

      expect(getDisplayName(spacesNameUser)).toBe('user@example.com');
    });
  });
});
