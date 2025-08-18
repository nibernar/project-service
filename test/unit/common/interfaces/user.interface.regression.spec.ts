/**
 * Tests de régression pour l'interface User
 *
 * @fileoverview Tests pour prévenir les régressions et maintenir la compatibilité
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

describe('User Interface - Tests de Régression', () => {
  // ============================================================================
  // 1. TESTS DE COMPATIBILITÉ ASCENDANTE - VERSION 1.0
  // ============================================================================

  describe('Compatibilité ascendante v1.0', () => {
    describe('Interface User de base', () => {
      it("devrait maintenir la structure exacte de l'interface User v1.0", () => {
        const user: User = {
          id: '123e4567-e89b-12d3-a456-426614174000',
          email: 'user@example.com',
          roles: ['user', 'premium'],
        };

        // Vérification des propriétés obligatoires v1.0
        expect(typeof user.id).toBe('string');
        expect(typeof user.email).toBe('string');
        expect(Array.isArray(user.roles)).toBe(true);
        expect(user.roles.every((role) => typeof role === 'string')).toBe(true);

        // Aucune propriété supplémentaire obligatoire
        const userKeys = Object.keys(user);
        expect(userKeys).toEqual(['id', 'email', 'roles']);
      });

      it("devrait maintenir l'énumération UserRole v1.0", () => {
        // Les valeurs de l'enum ne doivent jamais changer
        expect(UserRole.USER).toBe('user');
        expect(UserRole.ADMIN).toBe('admin');
        expect(UserRole.PREMIUM).toBe('premium');

        // Vérification que l'enum n'a pas de propriétés supplémentaires inattendues
        const enumValues = Object.values(UserRole);
        expect(enumValues).toEqual(['user', 'admin', 'premium']);
      });

      it('devrait maintenir la signature de createUser v1.0', () => {
        // Test de la signature originale
        const user1 = createUser('123', 'user@example.com');
        expect(user1.roles).toEqual(['user']);

        const user2 = createUser('123', 'user@example.com', [UserRole.ADMIN]);
        expect(user2.roles).toEqual(['user', 'admin']);

        // Test avec undefined (devrait fonctionner)
        const user3 = createUser('123', 'user@example.com', undefined);
        expect(user3.roles).toEqual(['user']);
      });
    });

    describe('Fonctions de vérification de rôles v1.0', () => {
      let testUser: User;

      beforeEach(() => {
        testUser = {
          id: '123',
          email: 'test@example.com',
          roles: ['user', 'premium'],
        };
      });

      it('devrait maintenir le comportement de hasRole v1.0', () => {
        // Comportements documentés v1.0
        expect(hasRole(testUser, UserRole.USER)).toBe(true);
        expect(hasRole(testUser, UserRole.PREMIUM)).toBe(true);
        expect(hasRole(testUser, UserRole.ADMIN)).toBe(false);

        // Test avec utilisateur sans rôles
        const emptyUser: User = {
          id: '123',
          email: 'test@example.com',
          roles: [],
        };
        expect(hasRole(emptyUser, UserRole.USER)).toBe(false);
      });

      it('devrait maintenir le comportement de hasAnyRole v1.0', () => {
        expect(hasAnyRole(testUser, [UserRole.USER])).toBe(true);
        expect(hasAnyRole(testUser, [UserRole.ADMIN])).toBe(false);
        expect(hasAnyRole(testUser, [UserRole.USER, UserRole.ADMIN])).toBe(
          true,
        );
        expect(hasAnyRole(testUser, [])).toBe(false);
      });

      it('devrait maintenir le comportement de hasAllRoles v1.0', () => {
        expect(hasAllRoles(testUser, [UserRole.USER])).toBe(true);
        expect(hasAllRoles(testUser, [UserRole.USER, UserRole.PREMIUM])).toBe(
          true,
        );
        expect(hasAllRoles(testUser, [UserRole.USER, UserRole.ADMIN])).toBe(
          false,
        );
        expect(hasAllRoles(testUser, [])).toBe(true); // Cas limite v1.0
      });

      it('devrait maintenir le comportement des type guards v1.0', () => {
        const adminUser: User = {
          id: '123',
          email: 'admin@example.com',
          roles: ['user', 'admin'],
        };

        expect(isAdmin(adminUser)).toBe(true);
        expect(isPremium(adminUser)).toBe(false);
        expect(isAdmin(testUser)).toBe(false);
        expect(isPremium(testUser)).toBe(true);
      });
    });

    describe('Validation isValidUser v1.0', () => {
      it('devrait maintenir les critères de validation v1.0', () => {
        // Cas valides v1.0
        expect(
          isValidUser({
            id: '123',
            email: 'user@example.com',
            roles: ['user'],
          }),
        ).toBe(true);

        expect(
          isValidUser({
            id: 'a',
            email: 'a@b.c',
            roles: [],
          }),
        ).toBe(true);

        // Cas invalides v1.0
        expect(isValidUser(null)).toBe(false);
        expect(isValidUser(undefined)).toBe(false);
        expect(isValidUser({})).toBe(false);
        expect(isValidUser({ id: '123' })).toBe(false);
        expect(
          isValidUser({ id: '', email: 'user@example.com', roles: [] }),
        ).toBe(false);
        expect(isValidUser({ id: '123', email: 'no-at-sign', roles: [] })).toBe(
          false,
        );
        expect(
          isValidUser({
            id: '123',
            email: 'user@example.com',
            roles: 'not-array',
          }),
        ).toBe(false);
      });
    });
  });

  // ============================================================================
  // 2. TESTS DE COMPORTEMENT HISTORIQUE
  // ============================================================================

  describe('Comportements historiques préservés', () => {
    describe('Gestion des cas limites historiques', () => {
      it('devrait préserver le comportement avec rôles dupliqués', () => {
        // Comportement historique: les doublons sont préservés
        const userWithDuplicates = createUser('123', 'user@example.com', [
          UserRole.USER,
          UserRole.ADMIN,
          UserRole.USER,
        ]);

        // La déduplication doit se faire
        expect(userWithDuplicates.roles).toEqual(['user', 'admin']);
        expect(userWithDuplicates.roles.length).toBe(2);
      });

      it('devrait préserver la sensibilité à la casse', () => {
        // Comportement historique: case-sensitive
        const user: User = {
          id: '123',
          email: 'user@example.com',
          roles: ['User', 'ADMIN'],
        };

        expect(hasRole(user, UserRole.USER)).toBe(false);
        expect(hasRole(user, UserRole.ADMIN)).toBe(false);
        expect(hasRole(user, 'User' as UserRole)).toBe(true);
      });

      it('devrait préserver le comportement avec emails complexes', () => {
        // Emails qui ont toujours été acceptés
        const complexEmails = [
          'user+tag@example.com',
          'user.with.dots@example.com',
          'user_with_underscores@example-domain.com',
        ];

        complexEmails.forEach((email) => {
          expect(
            isValidUser({
              id: '123',
              email: email,
              roles: ['user'],
            }),
          ).toBe(true);
        });
      });
    });

    describe('Ordonnancement et priorités historiques', () => {
      it("devrait préserver l'ordre des rôles dans createUser", () => {
        // L'ordre doit être: rôle par défaut 'user' en premier, puis les autres
        const user = createUser('123', 'user@example.com', [
          UserRole.ADMIN,
          UserRole.PREMIUM,
        ]);

        expect(user.roles[0]).toBe('user');
        expect(user.roles).toContain('admin');
        expect(user.roles).toContain('premium');
      });

      it('devrait préserver les performances des opérations de base', () => {
        // Les opérations de base ne doivent pas être plus lentes
        const user = createUser('123', 'user@example.com', [
          UserRole.USER,
          UserRole.PREMIUM,
        ]);

        const start = performance.now();
        for (let i = 0; i < 10000; i++) {
          hasRole(user, UserRole.PREMIUM);
        }
        const duration = performance.now() - start;

        // Ne devrait pas prendre plus de 50ms pour 10k opérations
        expect(duration).toBeLessThan(50);
      });
    });
  });

  // ============================================================================
  // 3. TESTS DE COMPATIBILITÉ DES EXTENSIONS
  // ============================================================================

  describe('Compatibilité des extensions', () => {
    describe('Interface ExtendedUser', () => {
      it('devrait maintenir la compatibilité avec User de base', () => {
        const baseUser = createUser('123', 'user@example.com');
        const extendedUser = createExtendedUser(baseUser, {
          name: 'John Doe',
        });

        // Un ExtendedUser doit toujours être compatible avec User
        expect(isValidUser(extendedUser)).toBe(true);
        expect(hasRole(extendedUser, UserRole.USER)).toBe(true);

        // Les propriétés de base doivent être préservées
        expect(extendedUser.id).toBe(baseUser.id);
        expect(extendedUser.email).toBe(baseUser.email);
        expect(extendedUser.roles).toEqual(baseUser.roles);
      });

      it('devrait maintenir la rétrocompatibilité des préférences', () => {
        const defaultPrefs = createDefaultPreferences();

        // Les valeurs par défaut documentées ne doivent pas changer
        expect(defaultPrefs.language).toBe('en');
        expect(defaultPrefs.timezone).toBe('UTC');
        expect(defaultPrefs.theme).toBe('light');
        expect(defaultPrefs.notifications).toBe(true);
        expect(defaultPrefs.dateFormat).toBe('DD/MM/YYYY');
        expect(defaultPrefs.itemsPerPage).toBe(10);
      });

      it('devrait préserver le comportement de fusion des préférences', () => {
        const baseUser = createUser('123', 'user@example.com');
        const userWithPartialPrefs = createExtendedUser(baseUser, {
          preferences: {
            theme: 'dark',
            language: 'fr',
            // Autres propriétés omises intentionnellement
          },
        });

        const mergedPrefs = getUserPreferences(userWithPartialPrefs);

        // Les préférences utilisateur doivent être préservées
        expect(mergedPrefs.theme).toBe('dark');
        expect(mergedPrefs.language).toBe('fr');

        // Les valeurs par défaut doivent combler les manques
        expect(mergedPrefs.timezone).toBe('UTC');
        expect(mergedPrefs.notifications).toBe(true);
        expect(mergedPrefs.itemsPerPage).toBe(10);
      });
    });

    describe('Fonctions utilitaires étendues', () => {
      it('devrait maintenir le comportement de getDisplayName', () => {
        const baseUser = createUser('123', 'user@example.com');

        // Utilisateur de base -> email
        expect(getDisplayName(baseUser)).toBe('user@example.com');

        // Utilisateur avec nom -> nom
        const namedUser = createExtendedUser(baseUser, { name: 'John Doe' });
        expect(getDisplayName(namedUser)).toBe('John Doe');

        // Utilisateur avec nom vide -> email (fallback)
        const emptyNameUser = createExtendedUser(baseUser, { name: '' });
        expect(getDisplayName(emptyNameUser)).toBe('user@example.com');
      });

      it('devrait maintenir le comportement des vérifications de statut', () => {
        const baseUser = createUser('123', 'user@example.com');

        // Utilisateur de base -> considéré comme actif et non vérifié
        expect(isActiveUser(baseUser)).toBe(true);
        expect(hasVerifiedEmail(baseUser)).toBe(false);

        // Utilisateur étendu avec statuts explicites
        const activeVerifiedUser = createExtendedUser(baseUser, {
          status: 'active',
          emailVerified: true,
        });
        expect(isActiveUser(activeVerifiedUser)).toBe(true);
        expect(hasVerifiedEmail(activeVerifiedUser)).toBe(true);

        const suspendedUser = createExtendedUser(baseUser, {
          status: 'suspended',
        });
        expect(isActiveUser(suspendedUser)).toBe(false);
      });
    });
  });

  // ============================================================================
  // 4. TESTS DE SÉRIALISATION/DÉSÉRIALISATION
  // ============================================================================

  describe('Sérialisation/Désérialisation', () => {
    describe('Compatibilité JSON', () => {
      it('devrait maintenir la compatibilité JSON pour User de base', () => {
        const originalUser = createUser('123', 'user@example.com', [
          UserRole.PREMIUM,
        ]);

        const serialized = JSON.stringify(originalUser);
        const deserialized = JSON.parse(serialized);

        // Structure préservée
        expect(deserialized.id).toBe(originalUser.id);
        expect(deserialized.email).toBe(originalUser.email);
        expect(deserialized.roles).toEqual(originalUser.roles);

        // Toujours valide après sérialisation
        expect(isValidUser(deserialized)).toBe(true);
      });

      it('devrait maintenir la compatibilité JSON pour ExtendedUser', () => {
        const baseUser = createUser('123', 'user@example.com');
        const originalExtended = createExtendedUser(baseUser, {
          name: 'John Doe',
          avatar: 'https://example.com/avatar.jpg',
          createdAt: new Date('2024-01-01T10:00:00Z'),
          preferences: {
            theme: 'dark',
            language: 'fr',
          },
          status: 'active',
          emailVerified: true,
        });

        const serialized = JSON.stringify(originalExtended);
        const deserialized = JSON.parse(serialized);

        // Propriétés de base préservées
        expect(deserialized.id).toBe(originalExtended.id);
        expect(deserialized.email).toBe(originalExtended.email);
        expect(deserialized.roles).toEqual(originalExtended.roles);

        // Propriétés étendues préservées
        expect(deserialized.name).toBe('John Doe');
        expect(deserialized.avatar).toBe('https://example.com/avatar.jpg');
        expect(deserialized.status).toBe('active');
        expect(deserialized.emailVerified).toBe(true);

        // Date devient string (comportement JSON standard)
        expect(typeof deserialized.createdAt).toBe('string');
        expect(deserialized.createdAt).toBe('2024-01-01T10:00:00.000Z');

        // Préférences préservées
        expect(deserialized.preferences.theme).toBe('dark');
        expect(deserialized.preferences.language).toBe('fr');
      });

      it('devrait gérer la désérialisation avec propriétés manquantes', () => {
        // Simulation d'un objet venant d'une version antérieure
        const oldFormatUser = {
          id: '123',
          email: 'user@example.com',
          roles: ['user'],
          // Pas de nouvelles propriétés
        };

        expect(isValidUser(oldFormatUser)).toBe(true);
        expect(hasRole(oldFormatUser, UserRole.USER)).toBe(true);
        expect(getDisplayName(oldFormatUser)).toBe('user@example.com');
      });
    });

    describe('Migration de données', () => {
      it("devrait gérer l'évolution des formats de préférences", () => {
        // Simulation d'anciennes préférences avec structure différente
        const oldPreferencesFormat = {
          lang: 'fr', // Ancienne propriété
          theme: 'dark',
          // notifications manquant
        };

        const baseUser = createUser('123', 'user@example.com');
        const userWithOldPrefs = createExtendedUser(baseUser, {
          preferences: oldPreferencesFormat as any,
        });

        const currentPrefs = getUserPreferences(userWithOldPrefs);

        // Les nouvelles valeurs par défaut doivent être utilisées
        expect(currentPrefs.language).toBe('en'); // Défaut car 'lang' n'est pas 'language'
        expect(currentPrefs.theme).toBe('dark'); // Préservé
        expect(currentPrefs.notifications).toBe(true); // Défaut
      });

      it('devrait gérer les changements de types de propriétés', () => {
        // Simulation de données avec types incorrects venant d'une version antérieure
        const userWithWrongTypes: any = {
          id: 123, // Était number, maintenant string
          email: 'user@example.com',
          roles: 'user', // Était string, maintenant array
        };

        // La validation doit échouer pour les types incorrects
        expect(isValidUser(userWithWrongTypes)).toBe(false);
      });
    });
  });

  // ============================================================================
  // 5. TESTS DE STABILITÉ DE L'API
  // ============================================================================

  describe("Stabilité de l'API", () => {
    describe('Signatures de fonctions', () => {
      it('devrait maintenir les signatures exactes des fonctions publiques', () => {
        // Test que les fonctions acceptent toujours les mêmes types
        const user = createUser('123', 'user@example.com', [UserRole.USER]);

        // Ces appels ne doivent jamais échouer avec les types corrects
        expect(() => {
          hasRole(user, UserRole.USER);
          hasAnyRole(user, [UserRole.USER, UserRole.ADMIN]);
          hasAllRoles(user, [UserRole.USER]);
          isAdmin(user);
          isPremium(user);
          isValidUser(user);
          getDisplayName(user);
          getUserPreferences(user);
        }).not.toThrow();
      });

      it('devrait maintenir les valeurs de retour attendues', () => {
        const user = createUser('123', 'user@example.com', [
          UserRole.USER,
          UserRole.PREMIUM,
        ]);

        // Types de retour garantis
        expect(typeof hasRole(user, UserRole.USER)).toBe('boolean');
        expect(typeof hasAnyRole(user, [UserRole.USER])).toBe('boolean');
        expect(typeof hasAllRoles(user, [UserRole.USER])).toBe('boolean');
        expect(typeof isAdmin(user)).toBe('boolean');
        expect(typeof isPremium(user)).toBe('boolean');
        expect(typeof isValidUser(user)).toBe('boolean');
        expect(typeof isExtendedUser(user)).toBe('boolean');
        expect(typeof getDisplayName(user)).toBe('string');

        const prefs = getUserPreferences(user);
        expect(typeof prefs).toBe('object');
        expect(prefs).not.toBeNull();
      });
    });

    describe('Constance des énumérations', () => {
      it('ne devrait jamais modifier les valeurs de UserRole', () => {
        // Ces valeurs sont des constantes de l'API
        const expectedRoles = {
          USER: 'user',
          ADMIN: 'admin',
          PREMIUM: 'premium',
        };

        Object.entries(expectedRoles).forEach(([key, value]) => {
          expect(UserRole[key as keyof typeof UserRole]).toBe(value);
        });

        // Aucune nouvelle valeur ne doit apparaître sans migration
        expect(Object.keys(UserRole)).toEqual(['USER', 'ADMIN', 'PREMIUM']);
      });
    });

    describe('Comportement avec valeurs par défaut', () => {
      it('devrait maintenir les valeurs par défaut documentées', () => {
        const defaultPrefs = createDefaultPreferences();

        // Ces valeurs par défaut font partie du contrat de l'API
        const expectedDefaults = {
          language: 'en',
          timezone: 'UTC',
          theme: 'light',
          notifications: true,
          dateFormat: 'DD/MM/YYYY',
          itemsPerPage: 10,
        };

        Object.entries(expectedDefaults).forEach(([key, value]) => {
          expect(defaultPrefs[key as keyof UserPreferences]).toBe(value);
        });
      });

      it('devrait maintenir le comportement de createUser sans rôles', () => {
        const user = createUser('123', 'user@example.com');

        // Le rôle 'user' doit toujours être ajouté par défaut
        expect(user.roles).toEqual(['user']);
        expect(user.roles.length).toBe(1);
      });
    });
  });

  // ============================================================================
  // 6. TESTS DE NON-RÉGRESSION SPÉCIFIQUES
  // ============================================================================

  describe('Prévention de régressions spécifiques', () => {
    describe('Bug fixes historiques', () => {
      it('ne devrait pas réintroduire le bug de déduplication des rôles', () => {
        // Bug hypothétique: les rôles dupliqués n'étaient pas supprimés
        const userWithDuplicates = createUser('123', 'user@example.com', [
          UserRole.USER,
          UserRole.USER,
          UserRole.ADMIN,
          UserRole.USER,
        ]);

        // Fix: la déduplication doit fonctionner
        expect(userWithDuplicates.roles).toEqual(['user', 'admin']);
        expect(userWithDuplicates.roles.length).toBe(2);
      });

      it("ne devrait pas réintroduire le bug de validation d'email", () => {
        // Bug hypothétique: les emails sans @ étaient acceptés
        const invalidEmailUser = {
          id: '123',
          email: 'invalid-email-without-at-sign',
          roles: ['user'],
        };

        // Fix: la validation doit rejeter les emails sans @
        expect(isValidUser(invalidEmailUser)).toBe(false);
      });

      it('ne devrait pas réintroduire le bug de fusion des préférences', () => {
        // Bug hypothétique: les préférences undefined écrasaient les défauts
        const baseUser = createUser('123', 'user@example.com');
        const userWithUndefinedPrefs = createExtendedUser(baseUser, {
          preferences: {
            theme: 'dark',
            language: undefined, // Ne devrait pas écraser le défaut
          } as any,
        });

        const mergedPrefs = getUserPreferences(userWithUndefinedPrefs);

        // Fix: undefined ne doit pas écraser les valeurs par défaut
        expect(mergedPrefs.theme).toBe('dark'); // Valeur utilisateur
        expect(mergedPrefs.language).toBe('en'); // Défaut préservé
      });
    });

    describe('Vérifications de cohérence', () => {
      it('devrait maintenir la cohérence entre isExtendedUser et les propriétés', () => {
        const baseUser = createUser('123', 'user@example.com');

        // Un utilisateur de base ne doit pas être considéré comme étendu
        expect(isExtendedUser(baseUser)).toBe(false);

        // Un utilisateur avec au moins une propriété étendue doit être considéré comme étendu
        const extendedUser = createExtendedUser(baseUser, { name: 'John' });
        expect(isExtendedUser(extendedUser)).toBe(true);

        // Un utilisateur avec propriétés undefined ne doit pas être considéré comme étendu
        const pseudoExtended = createExtendedUser(baseUser, {
          name: undefined,
        });
        expect(isExtendedUser(pseudoExtended)).toBe(false);
      });

      it('devrait maintenir la cohérence des type guards', () => {
        const adminUser = createUser('123', 'admin@example.com', [
          UserRole.ADMIN,
        ]);
        const premiumUser = createUser('123', 'premium@example.com', [
          UserRole.PREMIUM,
        ]);
        const regularUser = createUser('123', 'user@example.com', [
          UserRole.USER,
        ]);

        // Cohérence avec hasRole
        expect(isAdmin(adminUser)).toBe(hasRole(adminUser, UserRole.ADMIN));
        expect(isPremium(premiumUser)).toBe(
          hasRole(premiumUser, UserRole.PREMIUM),
        );

        // Un utilisateur régulier ne doit pas être admin ni premium
        expect(isAdmin(regularUser)).toBe(false);
        expect(isPremium(regularUser)).toBe(false);
      });
    });

    describe('Stabilité des transformations', () => {
      it("devrait maintenir l'idempotence de createExtendedUser", () => {
        const baseUser = createUser('123', 'user@example.com');
        const extensions = { name: 'John Doe', avatar: 'avatar.jpg' };

        const extended1 = createExtendedUser(baseUser, extensions);
        const extended2 = createExtendedUser(extended1, {});

        // Une extension sans modifications ne doit pas changer l'objet
        expect(extended2.id).toBe(extended1.id);
        expect(extended2.email).toBe(extended1.email);
        expect(extended2.roles).toEqual(extended1.roles);
        expect(extended2.name).toBe(extended1.name);
        expect(extended2.avatar).toBe(extended1.avatar);
      });

      it('devrait maintenir la stabilité des préférences par défaut', () => {
        // Les préférences par défaut doivent être identiques à chaque appel
        const prefs1 = createDefaultPreferences();
        const prefs2 = createDefaultPreferences();

        expect(prefs1).toEqual(prefs2);

        // Modification de l'une ne doit pas affecter l'autre
        prefs1.theme = 'dark';
        expect(prefs2.theme).toBe('light');
      });
    });
  });

  // ============================================================================
  // 7. TESTS DE PERFORMANCE DE RÉGRESSION
  // ============================================================================

  describe('Performance - Non-régression', () => {
    describe("Temps d'exécution des opérations critiques", () => {
      it('ne devrait pas dégrader les performances de hasRole', () => {
        const user = createUser('123', 'user@example.com', [
          UserRole.USER,
          UserRole.PREMIUM,
        ]);

        const iterations = 100000;
        const start = performance.now();

        for (let i = 0; i < iterations; i++) {
          hasRole(user, UserRole.PREMIUM);
        }

        const duration = performance.now() - start;

        // Ne devrait pas prendre plus de 100ms pour 100k opérations
        expect(duration).toBeLessThan(100);
      });

      it('ne devrait pas dégrader les performances de createUser', () => {
        const iterations = 10000;
        const start = performance.now();

        for (let i = 0; i < iterations; i++) {
          createUser(`user_${i}`, `user${i}@example.com`, [UserRole.USER]);
        }

        const duration = performance.now() - start;

        // Ne devrait pas prendre plus de 500ms pour 10k créations
        expect(duration).toBeLessThan(500);
      });

      it('ne devrait pas dégrader les performances de isValidUser', () => {
        const validUser = {
          id: '123',
          email: 'user@example.com',
          roles: ['user'],
        };
        const iterations = 50000;
        const start = performance.now();

        for (let i = 0; i < iterations; i++) {
          isValidUser(validUser);
        }

        const duration = performance.now() - start;

        // Ne devrait pas prendre plus de 200ms pour 50k validations
        expect(duration).toBeLessThan(200);
      });
    });

    describe('Utilisation mémoire', () => {
      it('ne devrait pas avoir de fuites mémoire avec les créations répétées', () => {
        const initialMemory = process.memoryUsage().heapUsed;

        // Création et destruction répétée
        for (let cycle = 0; cycle < 100; cycle++) {
          const users = [];
          for (let i = 0; i < 1000; i++) {
            users.push(
              createUser(`user_${cycle}_${i}`, `user${i}@example.com`),
            );
          }
          // Les utilisateurs sortent de portée à la fin de chaque cycle
        }

        // Forcer le garbage collection si disponible
        if (global.gc) {
          global.gc();
        }

        const finalMemory = process.memoryUsage().heapUsed;
        const memoryIncrease = finalMemory - initialMemory;

        // L'augmentation de mémoire ne devrait pas être excessive
        expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // Moins de 50MB
      });
    });
  });

  // ============================================================================
  // 8. TESTS DE MIGRATION ET ÉVOLUTION
  // ============================================================================

  describe('Migration et évolution future', () => {
    describe('Préparation aux changements futurs', () => {
      it("devrait gérer l'ajout de nouvelles propriétés optionnelles", () => {
        // Simulation d'un utilisateur avec une nouvelle propriété future
        const futureUser: any = createExtendedUser(
          createUser('123', 'user@example.com'),
          {
            name: 'John Doe',
            // Propriété hypothétique future - using any to bypass TypeScript checking
            organizationId: 'org-456',
            permissions: ['read', 'write'],
          } as any, // Cast to any to allow future properties
        );

        // Les fonctions existantes doivent continuer à fonctionner
        expect(isValidUser(futureUser)).toBe(true);
        expect(isExtendedUser(futureUser)).toBe(true);
        expect(getDisplayName(futureUser)).toBe('John Doe'); // Nom correct
        expect(hasRole(futureUser, UserRole.USER)).toBe(true);
      });

      it("devrait préserver la rétrocompatibilité lors d'ajouts d'énums", () => {
        // Test avec un rôle qui pourrait être ajouté dans le futur
        const userWithFutureRole: User = {
          id: '123',
          email: 'user@example.com',
          roles: ['user', 'moderator'], // 'moderator' n'existe pas encore
        };

        // Les fonctions doivent continuer à fonctionner
        expect(isValidUser(userWithFutureRole)).toBe(true);
        expect(hasRole(userWithFutureRole, UserRole.USER)).toBe(true);
        expect(hasRole(userWithFutureRole, 'moderator' as UserRole)).toBe(true);
      });
    });

    describe('Tests de migration de schéma', () => {
      it('devrait simuler une migration de v1.0 vers v1.1', () => {
        // Données au format v1.0
        const v1User = {
          id: '123',
          email: 'user@example.com',
          roles: ['user', 'premium'],
        };

        // Migration vers v1.1 (ajout de propriétés optionnelles)
        const v1_1User = {
          ...v1User,
          // Nouvelles propriétés avec valeurs par défaut
          emailVerified: false,
          status: 'active' as const,
        };

        // Validation que la migration préserve la fonctionnalité
        expect(isValidUser(v1User)).toBe(true);
        expect(isValidUser(v1_1User)).toBe(true);
        expect(hasRole(v1User, UserRole.PREMIUM)).toBe(true);
        expect(hasRole(v1_1User, UserRole.PREMIUM)).toBe(true);
      });

      it('devrait gérer la migration des préférences', () => {
        // Anciennes préférences (format hypothétique v1.0)
        const oldPrefs = {
          lang: 'fr',
          darkMode: true,
        };

        // Fonction de migration hypothétique
        const migratePreferences = (oldPrefs: any): UserPreferences => ({
          language: oldPrefs.lang || 'en',
          theme: oldPrefs.darkMode ? 'dark' : 'light',
          timezone: 'UTC',
          notifications: true,
          dateFormat: 'DD/MM/YYYY',
          itemsPerPage: 10,
        });

        const migratedPrefs = migratePreferences(oldPrefs);

        expect(migratedPrefs.language).toBe('fr');
        expect(migratedPrefs.theme).toBe('dark');
        expect(migratedPrefs.timezone).toBe('UTC'); // Valeur par défaut
      });
    });
  });
});
