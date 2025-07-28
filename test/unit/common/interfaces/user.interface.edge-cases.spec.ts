/**
 * Tests d'edge cases pour l'interface User
 * 
 * @fileoverview Tests des cas limites et situations particulières
 * @version 1.0.0
 * @since 2025-01-28
 */

import {
  User,
  UserRole,
  ExtendedUser,
  UserPreferences,
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

describe('User Interface - Tests d\'Edge Cases', () => {
  // ============================================================================
  // 1. EDGE CASES DE STRUCTURE DE DONNÉES
  // ============================================================================

  describe('Edge cases de structure', () => {
    describe('Objets avec propriétés extrêmes', () => {
      it('devrait gérer des IDs très longs', () => {
        const veryLongId = 'a'.repeat(10000);
        const user = createUser(veryLongId, 'user@example.com');
        
        expect(user.id).toBe(veryLongId);
        expect(user.id.length).toBe(10000);
        expect(isValidUser(user)).toBe(true);
      });

      it('devrait gérer des emails très longs', () => {
        const veryLongEmail = 'a'.repeat(1000) + '@' + 'b'.repeat(1000) + '.com';
        const user = createUser('123', veryLongEmail);
        
        expect(user.email).toBe(veryLongEmail);
        expect(isValidUser(user)).toBe(true);
      });

      it('devrait gérer des emails avec caractères Unicode', () => {
        const unicodeEmail = '测试@例子.测试';
        const user = createUser('123', unicodeEmail);
        
        expect(user.email).toBe(unicodeEmail);
        expect(isValidUser(user)).toBe(true);
      });

      it('devrait gérer des rôles avec caractères spéciaux', () => {
        const specialRoles = ['user-admin', 'super_user', 'role@special', 'rôle-français', '角色'];
        const user: User = {
          id: '123',
          email: 'user@example.com',
          roles: specialRoles,
        };
        
        expect(isValidUser(user)).toBe(true);
        expect(hasRole(user, 'user-admin' as UserRole)).toBe(true);
        expect(hasRole(user, 'rôle-français' as UserRole)).toBe(true);
        expect(hasRole(user, '角色' as UserRole)).toBe(true);
      });
    });

    describe('Objets avec propriétés undefined/null', () => {
      it('devrait gérer les propriétés undefined dans ExtendedUser', () => {
        const user = createExtendedUser(createUser('123', 'user@example.com'), {
          name: undefined,
          avatar: undefined,
          createdAt: undefined,
          lastLoginAt: undefined,
          preferences: undefined,
          status: undefined,
          emailVerified: undefined,
        });
        
        expect(isExtendedUser(user)).toBe(false); // Aucune propriété réellement définie
        expect(getDisplayName(user)).toBe('user@example.com');
        expect(hasVerifiedEmail(user)).toBe(false);
        expect(isActiveUser(user)).toBe(true); // Défaut pour undefined
      });

      it('devrait gérer les préférences avec valeurs undefined', () => {
        const prefsWithUndefined: UserPreferences = {
          language: undefined,
          timezone: undefined,
          theme: undefined,
          notifications: undefined,
          dateFormat: undefined,
          itemsPerPage: undefined,
        };
        
        const user = createExtendedUser(createUser('123', 'user@example.com'), {
          preferences: prefsWithUndefined,
        });
        
        const mergedPrefs = getUserPreferences(user);
        expect(mergedPrefs.language).toBe('en'); // Valeur par défaut
        expect(mergedPrefs.theme).toBe('light'); // Valeur par défaut
        expect(mergedPrefs.notifications).toBe(true); // Valeur par défaut
      });
    });

    describe('Objets avec propriétés vides', () => {
      it('devrait gérer un utilisateur avec tous les champs vides valides', () => {
        const emptyValidUser: User = {
          id: 'a', // Minimum valide
          email: 'a@b.c', // Email minimal valide
          roles: [], // Tableau vide mais valide
        };
        
        expect(isValidUser(emptyValidUser)).toBe(true);
        expect(hasRole(emptyValidUser, UserRole.USER)).toBe(false);
        expect(hasAnyRole(emptyValidUser, [UserRole.USER, UserRole.ADMIN])).toBe(false);
        expect(hasAllRoles(emptyValidUser, [])).toBe(true); // Tableau vide = tous satisfaits
      });

      it('devrait gérer des noms vides ou avec espaces', () => {
        const usersWithEmptyNames = [
          createExtendedUser(createUser('123', 'user@example.com'), { name: '' }),
          createExtendedUser(createUser('123', 'user@example.com'), { name: '   ' }),
          createExtendedUser(createUser('123', 'user@example.com'), { name: '\t\n' }),
        ];
        
        usersWithEmptyNames.forEach(user => {
          expect(getDisplayName(user)).toBe('user@example.com'); // Fallback sur email
          expect(isExtendedUser(user)).toBe(false); // Nom vide = pas étendu
        });
      });
    });
  });

  // ============================================================================
  // 2. EDGE CASES DE LOGIQUE DE RÔLES
  // ============================================================================

  describe('Edge cases de logique de rôles', () => {
    describe('Rôles avec doublons et variations', () => {
      it('devrait gérer les doublons de rôles', () => {
        const userWithDuplicates: User = {
          id: '123',
          email: 'user@example.com',
          roles: ['user', 'user', 'admin', 'user', 'admin'],
        };
        
        expect(hasRole(userWithDuplicates, UserRole.USER)).toBe(true);
        expect(hasRole(userWithDuplicates, UserRole.ADMIN)).toBe(true);
        
        // Compte les occurrences
        const userCount = userWithDuplicates.roles.filter(r => r === UserRole.USER).length;
        expect(userCount).toBe(3);
      });

      it('devrait gérer la casse dans les rôles', () => {
        const mixedCaseUser: User = {
          id: '123',
          email: 'user@example.com',
          roles: ['User', 'ADMIN', 'premium', 'USER'],
        };
        
        // Nos fonctions sont case-sensitive
        expect(hasRole(mixedCaseUser, UserRole.USER)).toBe(false); // 'USER' != 'user'
        expect(hasRole(mixedCaseUser, UserRole.ADMIN)).toBe(false); // 'ADMIN' != 'admin'
        expect(hasRole(mixedCaseUser, UserRole.PREMIUM)).toBe(true); // 'premium' == 'premium'
      });

      it('devrait gérer les rôles avec espaces et caractères invisibles', () => {
        const spacedRolesUser: User = {
          id: '123',
          email: 'user@example.com',
          roles: [' user ', 'admin\t', '\nuser', 'premium\r\n'],
        };
        
        expect(hasRole(spacedRolesUser, UserRole.USER)).toBe(false); // ' user ' != 'user'
        expect(hasRole(spacedRolesUser, UserRole.ADMIN)).toBe(false); // 'admin\t' != 'admin'
        expect(spacedRolesUser.roles).toContain(' user ');
        expect(spacedRolesUser.roles).toContain('admin\t');
      });
    });

    describe('Recherche de rôles avec tableaux spéciaux', () => {
      it('devrait gérer hasAnyRole avec tableau vide', () => {
        const user = createUser('123', 'user@example.com', [UserRole.USER]);
        
        expect(hasAnyRole(user, [])).toBe(false);
      });

      it('devrait gérer hasAllRoles avec tableau vide', () => {
        const user = createUser('123', 'user@example.com', [UserRole.USER]);
        
        expect(hasAllRoles(user, [])).toBe(true); // Logique mathématique: ∀ ∅ = true
      });

      it('devrait gérer des recherches avec rôles inexistants', () => {
        const user = createUser('123', 'user@example.com', [UserRole.USER]);
        const nonExistentRoles = ['nonexistent1', 'nonexistent2'] as unknown as UserRole[];
        
        expect(hasAnyRole(user, nonExistentRoles)).toBe(false);
        expect(hasAllRoles(user, nonExistentRoles)).toBe(false);
      });

      it('devrait gérer des recherches avec mélange de rôles existants et inexistants', () => {
        const user = createUser('123', 'user@example.com', [UserRole.USER, UserRole.PREMIUM]);
        const mixedRoles = [UserRole.USER, 'nonexistent', UserRole.ADMIN] as UserRole[];
        
        expect(hasAnyRole(user, mixedRoles)).toBe(true); // USER existe
        expect(hasAllRoles(user, mixedRoles)).toBe(false); // 'nonexistent' et ADMIN manquent
      });
    });
  });

  // ============================================================================
  // 3. EDGE CASES DE VALIDATION
  // ============================================================================

  describe('Edge cases de validation', () => {
    describe('isValidUser avec objets limites', () => {
      it('devrait gérer des objets avec propriétés nulles explicites', () => {
        const nullPropsUser = {
          id: null,
          email: null,
          roles: null,
        };
        
        expect(isValidUser(nullPropsUser)).toBe(false);
      });

      it('devrait gérer des objets avec propriétés de mauvais type', () => {
        const wrongTypesUser = {
          id: 123,
          email: ['not', 'a', 'string'],
          roles: 'should-be-array',
        };
        
        expect(isValidUser(wrongTypesUser)).toBe(false);
      });

      it('devrait gérer des objets avec getters/setters', () => {
        const objWithGetters = {
          get id() { return '123'; },
          get email() { return 'user@example.com'; },
          get roles() { return ['user']; },
        };
        
        expect(isValidUser(objWithGetters)).toBe(true);
      });

      it('devrait gérer des objets avec propriétés non-enumérables', () => {
        const obj: any = {};
        Object.defineProperty(obj, 'id', { value: '123', enumerable: false });
        Object.defineProperty(obj, 'email', { value: 'user@example.com', enumerable: false });
        Object.defineProperty(obj, 'roles', { value: ['user'], enumerable: false });
        
        expect(isValidUser(obj)).toBe(true);
      });
    });

    describe('Edge cases de validation d\'email', () => {
      it('devrait accepter des emails complexes mais valides', () => {
        const complexEmails = [
          'user+tag@example.com',
          'user.name@example.com',
          'user_name@example-domain.com',
          '123@456.789',
          'a@b.co.uk',
          'very.long.email.address.with.many.dots@very.long.domain.name.example.com',
        ];
        
        complexEmails.forEach(email => {
          const user = { id: '123', email, roles: ['user'] };
          expect(isValidUser(user)).toBe(true);
        });
      });

      it('devrait rejeter des emails sans arobase ou mal formés', () => {
        const invalidEmails = [
          'no-at-sign.com',     // Pas de @
          '',                   // Vide
          'user',              // Pas de @ ni de domaine
          'user.example.com',  // Pas de @
          '@example.com',      // @ au début
          'user@',             // @ à la fin sans domaine
          'user@.com',         // Domaine commençant par un point
          'user@domain',       // Pas de TLD (point)
        ];
        
        invalidEmails.forEach(email => {
          const user = { id: '123', email, roles: ['user'] };
          const result = isValidUser(user);
          if (result) {
            console.log(`❌ Email incorrectement accepté: "${email}"`);
          }
          expect(isValidUser(user)).toBe(false);
        });
      });
    });
  });

  // ============================================================================
  // 4. EDGE CASES DE CRÉATION D'UTILISATEURS
  // ============================================================================

  describe('Edge cases de création', () => {
    describe('createUser avec paramètres extrêmes', () => {
      it('devrait gérer des paramètres vides mais valides', () => {
        const user = createUser('', '', []);
        
        expect(user.id).toBe('');
        expect(user.email).toBe('');
        expect(user.roles).toEqual(['user']); // Rôle par défaut ajouté
      });

      it('devrait gérer des rôles avec doublons', () => {
        const duplicateRoles = [UserRole.USER, UserRole.ADMIN, UserRole.USER, UserRole.PREMIUM, UserRole.ADMIN];
        const user = createUser('123', 'user@example.com', duplicateRoles);
        
        expect(user.roles).toEqual(['user', 'admin', 'premium']);
        expect(user.roles.length).toBe(3);
      });

      it('devrait gérer un très grand nombre de rôles uniques', () => {
        const manyRoles = Array.from({ length: 1000 }, (_, i) => `role_${i}` as UserRole);
        manyRoles.push(UserRole.ADMIN);
        
        const user = createUser('123', 'user@example.com', manyRoles);
        
        expect(user.roles).toContain('user'); // Rôle par défaut
        expect(user.roles).toContain('admin');
        expect(user.roles.length).toBe(1002); // 1000 + user + admin
      });
    });

    describe('createExtendedUser avec extensions complexes', () => {
      it('devrait gérer des extensions avec propriétés circulaires', () => {
        const extensions: any = {
          name: 'User Name',
        };
        extensions.self = extensions; // Référence circulaire
        
        const baseUser = createUser('123', 'user@example.com');
        
        expect(() => createExtendedUser(baseUser, extensions)).not.toThrow();
        const extendedUser = createExtendedUser(baseUser, extensions);
        
        expect(extendedUser.name).toBe('User Name');
        expect((extendedUser as any).self).toBe(extensions);
      });

      it('devrait gérer des dates invalides', () => {
        const baseUser = createUser('123', 'user@example.com');
        const invalidDate = new Date('invalid-date');
        
        const extendedUser = createExtendedUser(baseUser, {
          createdAt: invalidDate,
          lastLoginAt: invalidDate,
        });
        
        expect(extendedUser.createdAt).toBe(invalidDate);
        // Une date invalide en JavaScript a getTime() qui retourne NaN
        expect(Number.isNaN(extendedUser.createdAt?.getTime())).toBe(true);
      });

      it('devrait gérer des préférences avec types incorrects', () => {
        const baseUser = createUser('123', 'user@example.com');
        const badPreferences: any = {
          language: 123, // Devrait être string - sera corrigé
          timezone: true, // Devrait être string - sera corrigé  
          theme: 'invalid-theme', // Valeur non valide - sera corrigée
          notifications: 'yes', // Devrait être boolean - sera corrigé
          itemsPerPage: 'ten', // Devrait être number - sera corrigé
        };
        
        const extendedUser = createExtendedUser(baseUser, {
          preferences: badPreferences,
        });
        
        const mergedPrefs = getUserPreferences(extendedUser);
        // Notre fonction corrige maintenant automatiquement les types incorrects
        expect(typeof mergedPrefs.language).toBe('string'); // Corrigé vers défaut
        expect(typeof mergedPrefs.notifications).toBe('boolean'); // Corrigé vers défaut
        expect(mergedPrefs.theme).toBe('light'); // Corrigé vers défaut (valeur invalide)
        expect(typeof mergedPrefs.timezone).toBe('string'); // Corrigé vers défaut
        expect(typeof mergedPrefs.itemsPerPage).toBe('number'); // Corrigé vers défaut
      });
    });
  });

  // ============================================================================
  // 5. EDGE CASES DE PRÉFÉRENCES
  // ============================================================================

  describe('Edge cases de préférences', () => {
    describe('createDefaultPreferences avec overrides extrêmes', () => {
      it('devrait gérer des overrides avec valeurs nulles', () => {
        const preferences = createDefaultPreferences({
          language: null as any,
          timezone: null as any,
          theme: null as any,
        });
        
        expect(preferences.language).toBeNull();
        expect(preferences.timezone).toBeNull();
        expect(preferences.theme).toBeNull();
        expect(preferences.notifications).toBe(true); // Défaut préservé
      });

      it('devrait gérer des valeurs numériques extrêmes pour itemsPerPage', () => {
        const extremeValues = [
          { itemsPerPage: 0 },
          { itemsPerPage: -1 },
          { itemsPerPage: Infinity },
          { itemsPerPage: NaN },
          { itemsPerPage: Number.MAX_SAFE_INTEGER },
        ];
        
        extremeValues.forEach(override => {
          const preferences = createDefaultPreferences(override);
          expect(preferences.itemsPerPage).toBe(override.itemsPerPage);
        });
      });

      it('devrait gérer des chaînes très longues', () => {
        const veryLongString = 'a'.repeat(100000);
        const preferences = createDefaultPreferences({
          language: veryLongString,
          timezone: veryLongString,
          dateFormat: veryLongString,
        });
        
        expect(preferences.language).toBe(veryLongString);
        expect(preferences.timezone).toBe(veryLongString);
        expect(preferences.dateFormat).toBe(veryLongString);
      });
    });

    describe('getUserPreferences avec préférences corrompues', () => {
      it('devrait gérer des préférences partiellement corrompues', () => {
        const baseUser = createUser('123', 'user@example.com');
        const corruptedPrefs: any = {
          language: 'fr', // Valide
          timezone: undefined, // Corrompu - sera défaut
          theme: 123, // Type incorrect - sera corrigé
          notifications: 'maybe', // Type incorrect - sera corrigé
          dateFormat: null, // Corrompu - sera défaut
          itemsPerPage: 'beaucoup', // Type incorrect - sera corrigé
        };
        
        const extendedUser = createExtendedUser(baseUser, {
          preferences: corruptedPrefs,
        });
        
        const prefs = getUserPreferences(extendedUser);
        
        expect(prefs.language).toBe('fr'); // Valeur utilisateur préservée
        expect(prefs.timezone).toBe('UTC'); // Défaut utilisé
        expect(prefs.theme).toBe('light'); // Défaut utilisé pour type incorrect
        expect(prefs.notifications).toBe(true); // Défaut utilisé
        expect(prefs.dateFormat).toBe('DD/MM/YYYY'); // Défaut utilisé
        expect(prefs.itemsPerPage).toBe(10); // Défaut utilisé
      });

      it('devrait gérer des préférences avec propriétés supplémentaires', () => {
        const baseUser = createUser('123', 'user@example.com');
        const prefsWithExtra: any = {
          language: 'en',
          theme: 'dark',
          extraProperty: 'should-be-ignored',
          anotherExtra: 123,
        };
        
        const extendedUser = createExtendedUser(baseUser, {
          preferences: prefsWithExtra,
        });
        
        const prefs = getUserPreferences(extendedUser) as any;
        
        expect(prefs.language).toBe('en');
        expect(prefs.theme).toBe('dark');
        expect(prefs.extraProperty).toBe('should-be-ignored'); // Préservé par le spread
        expect(prefs.anotherExtra).toBe(123);
      });
    });
  });

  // ============================================================================
  // 6. EDGE CASES DE STATUT ET SÉCURITÉ
  // ============================================================================

  describe('Edge cases de statut et sécurité', () => {
    describe('hasVerifiedEmail avec valeurs extrêmes', () => {
      it('devrait gérer des valeurs truthy/falsy non-boolean', () => {
        const baseUser = createUser('123', 'user@example.com');
        const truthyValues = [1, 'true', [], {}];
        const falsyValues = [0, '', null, undefined];
        
        truthyValues.forEach(value => {
          const user = createExtendedUser(baseUser, {
            emailVerified: value as any,
          });
          expect(hasVerifiedEmail(user)).toBe(true); // Truthy = true
        });
        
        falsyValues.forEach(value => {
          const user = createExtendedUser(baseUser, {
            emailVerified: value as any,
          });
          expect(hasVerifiedEmail(user)).toBe(false); // Falsy = false
        });
      });
    });

    describe('isActiveUser avec statuts non-standard', () => {
      it('devrait gérer des statuts avec casse différente', () => {
        const baseUser = createUser('123', 'user@example.com');
        const cases = ['ACTIVE', 'Active', 'SUSPENDED', 'Suspended'];
        
        cases.forEach(status => {
          const user = createExtendedUser(baseUser, {
            status: status as any,
          });
          
          // Nos comparaisons sont case-sensitive
          expect(isActiveUser(user)).toBe(status === 'active');
        });
      });

      it('devrait gérer des statuts avec espaces', () => {
        const baseUser = createUser('123', 'user@example.com');
        const spacedStatuses = [' active', 'active ', ' active ', 'sus pended'];
        
        spacedStatuses.forEach(status => {
          const user = createExtendedUser(baseUser, {
            status: status as any,
          });
          expect(isActiveUser(user)).toBe(false); // Aucun ne correspond exactement
        });
      });

      it('devrait gérer des statuts complètement invalides', () => {
        const baseUser = createUser('123', 'user@example.com');
        const invalidStatuses = ['maybe', 'unknown', '', 123, null, undefined];
        
        invalidStatuses.forEach(status => {
          const user = createExtendedUser(baseUser, {
            status: status as any,
          });
          
          const isActive = isActiveUser(user);
          if (status === undefined) {
            expect(isActive).toBe(true); // undefined = actif par défaut
          } else {
            expect(isActive).toBe(false);
          }
        });
      });
    });
  });

  // ============================================================================
  // 7. EDGE CASES D'AFFICHAGE
  // ============================================================================

  describe('Edge cases d\'affichage', () => {
    describe('getDisplayName avec noms particuliers', () => {
      it('devrait gérer des noms avec seulement des caractères invisibles', () => {
        const baseUser = createUser('123', 'user@example.com');
        const invisibleNames = [
          '\u200B', // Zero-width space
          '\u00A0', // Non-breaking space
          '\t\r\n', // Tabs et retours ligne
          '\u2060', // Word joiner (invisible)
        ];
        
        invisibleNames.forEach(name => {
          const user = createExtendedUser(baseUser, { name });
          expect(getDisplayName(user)).toBe('user@example.com'); // Fallback
        });
      });

      it('devrait gérer des noms très longs', () => {
        const baseUser = createUser('123', 'user@example.com');
        const veryLongName = 'Very '.repeat(1000) + 'Long Name';
        
        const user = createExtendedUser(baseUser, {
          name: veryLongName,
        });
        
        expect(getDisplayName(user)).toBe(veryLongName);
        expect(getDisplayName(user).length).toBe(veryLongName.length);
      });

      it('devrait gérer des noms avec caractères de contrôle', () => {
        const baseUser = createUser('123', 'user@example.com');
        const nameWithControlChars = 'User\x00Name\x01'; // Caractères de contrôle
        
        const user = createExtendedUser(baseUser, {
          name: nameWithControlChars,
        });
        
        expect(getDisplayName(user)).toBe(nameWithControlChars);
      });
    });
  });

  // ============================================================================
  // 8. EDGE CASES DE SÉRIALISATION
  // ============================================================================

  describe('Edge cases de sérialisation', () => {
    describe('JSON avec données complexes', () => {
      it('devrait gérer la sérialisation d\'utilisateurs avec dates', () => {
        const baseUser = createUser('123', 'user@example.com');
        const userWithDates = createExtendedUser(baseUser, {
          createdAt: new Date('2024-01-01T10:00:00Z'),
          lastLoginAt: new Date('2024-01-15T15:30:00Z'),
        });
        
        const serialized = JSON.stringify(userWithDates);
        const deserialized = JSON.parse(serialized);
        
        expect(typeof deserialized.createdAt).toBe('string'); // Dates deviennent strings
        expect(deserialized.createdAt).toBe('2024-01-01T10:00:00.000Z');
      });

      it('devrait gérer la sérialisation avec fonctions dans les préférences', () => {
        const baseUser = createUser('123', 'user@example.com');
        const prefsWithFunction: any = {
          language: 'en',
          customFormatter: function() { return 'formatted'; }, // Fonction
          theme: 'dark',
        };
        
        const user = createExtendedUser(baseUser, {
          preferences: prefsWithFunction,
        });
        
        const serialized = JSON.stringify(user);
        const deserialized = JSON.parse(serialized);
        
        expect(deserialized.preferences.language).toBe('en');
        expect(deserialized.preferences.customFormatter).toBeUndefined(); // Fonction supprimée
        expect(deserialized.preferences.theme).toBe('dark');
      });

      it('devrait gérer les symboles comme propriétés', () => {
        const symbolKey = Symbol('special');
        const baseUser = createUser('123', 'user@example.com');
        const userWithSymbol: any = createExtendedUser(baseUser, {
          name: 'User Name',
        });
        userWithSymbol[symbolKey] = 'symbol value';
        
        const serialized = JSON.stringify(userWithSymbol);
        const deserialized = JSON.parse(serialized);
        
        expect(deserialized.name).toBe('User Name');
        expect(deserialized[symbolKey]).toBeUndefined(); // Symbole supprimé
      });
    });
  });

  // ============================================================================
  // 9. EDGE CASES D'INTÉGRATION
  // ============================================================================

  describe('Edge cases d\'intégration', () => {
    describe('Combinaisons complexes de fonctionnalités', () => {
      it('devrait gérer un utilisateur avec toutes les propriétés extrêmes', () => {
        const complexUser = createExtendedUser(
          createUser(
            'très-long-id-avec-caractères-spéciaux-éàù-123456789',
            'très.long.email.avec.nombreux.points@très-long-domaine-avec-tirets.exemple.com',
            Array.from({ length: 100 }, (_, i) => `rôle_spécial_${i}` as UserRole)
          ),
          {
            name: 'Nom Très Long Avec Caractères Spéciaux éàùç 测试 🙂',
            avatar: 'https://très-long-domaine.exemple.com/path/to/very/long/avatar/url/with/many/segments/avatar.jpg',
            createdAt: new Date(-8640000000000000), // Date très ancienne
            lastLoginAt: new Date(8640000000000000), // Date très future
            preferences: {
              language: 'fr-CA-special-variant',
              timezone: 'America/Argentina/ComodRivadavia',
              theme: 'dark',
              notifications: true,
              dateFormat: 'DD/MM/YYYY HH:mm:ss Z',
              itemsPerPage: 999,
            },
            status: 'active',
            emailVerified: true,
          }
        );
        
        // Toutes les fonctions devraient fonctionner sans erreur
        expect(() => {
          isValidUser(complexUser);
          isExtendedUser(complexUser);
          hasRole(complexUser, 'rôle_spécial_50' as UserRole);
          hasVerifiedEmail(complexUser);
          isActiveUser(complexUser);
          getDisplayName(complexUser);
          getUserPreferences(complexUser);
        }).not.toThrow();
        
        expect(isExtendedUser(complexUser)).toBe(true);
        expect(hasVerifiedEmail(complexUser)).toBe(true);
        expect(isActiveUser(complexUser)).toBe(true);
        expect(getDisplayName(complexUser)).toContain('测试');
      });

      it('devrait gérer des transformations séquentielles', () => {
        // Transformation séquentielle: User -> ExtendedUser -> Modifications
        let user: User | ExtendedUser = createUser('123', 'user@example.com');
        
        // Étape 1: Extension basique
        user = createExtendedUser(user, { name: 'Initial Name' });
        expect(getDisplayName(user)).toBe('Initial Name');
        
        // Étape 2: Ajout de préférences
        user = createExtendedUser(user, {
          preferences: { theme: 'dark', language: 'fr' },
        });
        expect(getUserPreferences(user).theme).toBe('dark');
        
        // Étape 3: Mise à jour du statut
        user = createExtendedUser(user, { status: 'suspended' });
        expect(isActiveUser(user)).toBe(false);
        
        // Étape 4: Réactivation
        user = createExtendedUser(user, { status: 'active' });
        expect(isActiveUser(user)).toBe(true);
        
        // Vérification de l'intégrité finale
        expect(user.id).toBe('123');
        expect(user.email).toBe('user@example.com');
        expect(getDisplayName(user)).toBe('Initial Name');
      });
    });
  });
});