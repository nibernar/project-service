/**
 * Tests de performance pour l'interface User
 *
 * @fileoverview Tests de performance, scalabilité et optimisation
 * @version 1.0.0
 * @since 2025-01-28
 */

import {
  User,
  UserRole,
  ExtendedUser,
  hasRole,
  hasAnyRole,
  hasAllRoles,
  createUser,
  createExtendedUser,
  isValidUser,
  isExtendedUser,
  getUserPreferences,
  getDisplayName,
} from '../../../../src/common/interfaces/user.interface';

describe('User Interface - Tests de Performance', () => {
  // ============================================================================
  // 1. TESTS DE PERFORMANCE DES FONCTIONS DE RÔLES
  // ============================================================================

  describe('Performance des fonctions de rôles', () => {
    let userWithManyRoles: User;
    let manyRoles: string[];

    beforeAll(() => {
      // Création d'un utilisateur avec beaucoup de rôles
      manyRoles = Array.from({ length: 10000 }, (_, i) => `role_${i}`);
      userWithManyRoles = {
        id: '123',
        email: 'user@example.com',
        roles: [...manyRoles, UserRole.USER, UserRole.ADMIN, UserRole.PREMIUM],
      };
    });

    describe('hasRole() - Performance avec nombreux rôles', () => {
      it('devrait être rapide avec beaucoup de rôles (premier élément)', () => {
        const startTime = performance.now();

        for (let i = 0; i < 1000; i++) {
          hasRole(userWithManyRoles, UserRole.USER);
        }

        const endTime = performance.now();
        const executionTime = endTime - startTime;

        expect(executionTime).toBeLessThan(100); // Moins de 100ms pour 1000 appels
      });

      it('devrait être rapide avec beaucoup de rôles (dernier élément)', () => {
        const startTime = performance.now();

        for (let i = 0; i < 1000; i++) {
          hasRole(userWithManyRoles, UserRole.PREMIUM);
        }

        const endTime = performance.now();
        const executionTime = endTime - startTime;

        expect(executionTime).toBeLessThan(100); // Moins de 100ms pour 1000 appels
      });

      it('devrait être rapide avec beaucoup de rôles (élément inexistant)', () => {
        const startTime = performance.now();

        for (let i = 0; i < 1000; i++) {
          hasRole(userWithManyRoles, 'non_existent_role' as UserRole);
        }

        const endTime = performance.now();
        const executionTime = endTime - startTime;

        expect(executionTime).toBeLessThan(150); // Moins de 150ms (pire cas)
      });
    });

    describe('hasAnyRole() - Performance avec nombreux rôles', () => {
      it('devrait être rapide avec recherche de nombreux rôles', () => {
        const rolesToSearch = Array.from(
          { length: 1000 },
          (_, i) => `search_role_${i}` as UserRole,
        );
        rolesToSearch.push(UserRole.USER); // Un rôle qui existe

        const startTime = performance.now();

        for (let i = 0; i < 100; i++) {
          hasAnyRole(userWithManyRoles, rolesToSearch);
        }

        const endTime = performance.now();
        const executionTime = endTime - startTime;

        expect(executionTime).toBeLessThan(1000); // Moins de 1000ms pour 100 appels
      });

      it("devrait optimiser l'arrêt précoce", () => {
        const rolesToSearch = [
          UserRole.USER,
          ...Array.from(
            { length: 1000 },
            (_, i) => `other_role_${i}` as UserRole,
          ),
        ];

        const startTime = performance.now();

        for (let i = 0; i < 1000; i++) {
          hasAnyRole(userWithManyRoles, rolesToSearch);
        }

        const endTime = performance.now();
        const executionTime = endTime - startTime;

        // Devrait être rapide car le premier rôle correspond
        expect(executionTime).toBeLessThan(50);
      });
    });

    describe('hasAllRoles() - Performance avec nombreux rôles', () => {
      it('devrait être rapide avec vérification de tous les rôles', () => {
        const rolesToCheck = [UserRole.USER, UserRole.ADMIN, UserRole.PREMIUM];

        const startTime = performance.now();

        for (let i = 0; i < 1000; i++) {
          hasAllRoles(userWithManyRoles, rolesToCheck);
        }

        const endTime = performance.now();
        const executionTime = endTime - startTime;

        expect(executionTime).toBeLessThan(100);
      });

      it("devrait optimiser l'arrêt précoce sur échec", () => {
        const rolesToCheck = [
          'non_existent_role' as UserRole,
          UserRole.USER,
          UserRole.ADMIN,
        ];

        const startTime = performance.now();

        for (let i = 0; i < 1000; i++) {
          hasAllRoles(userWithManyRoles, rolesToCheck);
        }

        const endTime = performance.now();
        const executionTime = endTime - startTime;

        // Devrait être rapide car échec sur le premier rôle
        expect(executionTime).toBeLessThan(50);
      });
    });
  });

  // ============================================================================
  // 2. TESTS DE PERFORMANCE DE CRÉATION D'UTILISATEURS
  // ============================================================================

  describe("Performance de création d'utilisateurs", () => {
    describe('createUser() - Performance en masse', () => {
      it('devrait créer rapidement de nombreux utilisateurs', () => {
        const startTime = performance.now();
        const users: User[] = [];

        for (let i = 0; i < 10000; i++) {
          users.push(
            createUser(`user_${i}`, `user${i}@example.com`, [UserRole.USER]),
          );
        }

        const endTime = performance.now();
        const executionTime = endTime - startTime;

        expect(executionTime).toBeLessThan(1000); // Moins de 1 seconde
        expect(users).toHaveLength(10000);
        expect(users[0].id).toBe('user_0');
        expect(users[9999].id).toBe('user_9999');
      });

      it('devrait gérer efficacement la déduplication des rôles', () => {
        const duplicatedRoles = Array.from(
          { length: 1000 },
          () => UserRole.USER,
        );
        duplicatedRoles.push(UserRole.ADMIN, UserRole.PREMIUM);

        const startTime = performance.now();

        for (let i = 0; i < 1000; i++) {
          createUser(`user_${i}`, `user${i}@example.com`, duplicatedRoles);
        }

        const endTime = performance.now();
        const executionTime = endTime - startTime;

        expect(executionTime).toBeLessThan(500); // Moins de 500ms
      });
    });

    describe('createExtendedUser() - Performance avec propriétés étendues', () => {
      it('devrait créer rapidement des utilisateurs étendus', () => {
        const baseUser = createUser('123', 'user@example.com');
        const largePreferences = {
          language: 'fr',
          timezone: 'Europe/Paris',
          theme: 'dark' as const,
          notifications: true,
          dateFormat: 'DD/MM/YYYY',
          itemsPerPage: 25,
        };

        const startTime = performance.now();

        for (let i = 0; i < 5000; i++) {
          createExtendedUser(baseUser, {
            name: `User ${i}`,
            avatar: `https://example.com/avatar${i}.jpg`,
            preferences: largePreferences,
            status: 'active',
            emailVerified: true,
          });
        }

        const endTime = performance.now();
        const executionTime = endTime - startTime;

        expect(executionTime).toBeLessThan(200); // Moins de 200ms
      });
    });
  });

  // ============================================================================
  // 3. TESTS DE PERFORMANCE DE VALIDATION
  // ============================================================================

  describe('Performance de validation', () => {
    describe('isValidUser() - Performance avec objets complexes', () => {
      it('devrait valider rapidement de nombreux utilisateurs valides', () => {
        const validUsers = Array.from({ length: 10000 }, (_, i) => ({
          id: `user_${i}`,
          email: `user${i}@example.com`,
          roles: [`role_${i}`, 'user'],
        }));

        const startTime = performance.now();

        let validCount = 0;
        for (const user of validUsers) {
          if (isValidUser(user)) {
            validCount++;
          }
        }

        const endTime = performance.now();
        const executionTime = endTime - startTime;

        expect(executionTime).toBeLessThan(500); // Moins de 500ms
        expect(validCount).toBe(10000);
      });

      it('devrait rejeter rapidement de nombreux utilisateurs invalides', () => {
        const invalidUsers = Array.from({ length: 10000 }, (_, i) => ({
          id: i % 2 === 0 ? `user_${i}` : undefined, // 50% avec ID manquant
          email: i % 3 === 0 ? `user${i}@example.com` : 'invalid-email', // 33% avec email invalide
          roles: i % 4 === 0 ? [`role_${i}`] : 'not-an-array', // 25% avec roles invalides
        }));

        const startTime = performance.now();

        let invalidCount = 0;
        for (const user of invalidUsers) {
          if (!isValidUser(user)) {
            invalidCount++;
          }
        }

        const endTime = performance.now();
        const executionTime = endTime - startTime;

        expect(executionTime).toBeLessThan(500); // Moins de 500ms
        expect(invalidCount).toBeGreaterThan(5000); // La plupart invalides
      });

      it('devrait gérer efficacement les objets avec de nombreuses propriétés', () => {
        const bloatedUsers = Array.from({ length: 1000 }, (_, i) => {
          const user: any = {
            id: `user_${i}`,
            email: `user${i}@example.com`,
            roles: ['user'],
          };

          // Ajout de 100 propriétés supplémentaires
          for (let j = 0; j < 100; j++) {
            user[`extra_prop_${j}`] = `value_${j}`;
          }

          return user;
        });

        const startTime = performance.now();

        let validCount = 0;
        for (const user of bloatedUsers) {
          if (isValidUser(user)) {
            validCount++;
          }
        }

        const endTime = performance.now();
        const executionTime = endTime - startTime;

        expect(executionTime).toBeLessThan(200); // Moins de 200ms
        expect(validCount).toBe(1000);
      });
    });

    describe("isExtendedUser() - Performance avec détection d'extensions", () => {
      it('devrait détecter rapidement les utilisateurs étendus', () => {
        const users = Array.from({ length: 5000 }, (_, i) => {
          const base = createUser(`user_${i}`, `user${i}@example.com`);
          return i % 2 === 0
            ? createExtendedUser(base, { name: `User ${i}` })
            : base;
        });

        const startTime = performance.now();

        let extendedCount = 0;
        for (const user of users) {
          if (isExtendedUser(user)) {
            extendedCount++;
          }
        }

        const endTime = performance.now();
        const executionTime = endTime - startTime;

        expect(executionTime).toBeLessThan(100); // Moins de 100ms
        expect(extendedCount).toBe(2500); // 50% des utilisateurs
      });
    });
  });

  // ============================================================================
  // 4. TESTS DE PERFORMANCE DES UTILITAIRES
  // ============================================================================

  describe('Performance des fonctions utilitaires', () => {
    describe('getUserPreferences() - Performance avec préférences complexes', () => {
      let usersWithPreferences: ExtendedUser[];

      beforeAll(() => {
        usersWithPreferences = Array.from({ length: 1000 }, (_, i) => {
          const base = createUser(`user_${i}`, `user${i}@example.com`);
          return createExtendedUser(base, {
            preferences: {
              language: i % 2 === 0 ? 'fr' : 'en',
              timezone: `Timezone/${i}`,
              theme: i % 2 === 0 ? 'dark' : 'light',
              notifications: i % 2 === 0,
              dateFormat: 'DD/MM/YYYY',
              itemsPerPage: 10 + (i % 50),
            },
          });
        });
      });

      it('devrait récupérer rapidement les préférences', () => {
        const startTime = performance.now();

        for (let i = 0; i < 10; i++) {
          for (const user of usersWithPreferences) {
            getUserPreferences(user);
          }
        }

        const endTime = performance.now();
        const executionTime = endTime - startTime;

        expect(executionTime).toBeLessThan(200); // Moins de 200ms pour 10k appels
      });

      it('devrait fusionner efficacement avec les défauts', () => {
        const usersWithPartialPrefs = Array.from({ length: 1000 }, (_, i) => {
          const base = createUser(`user_${i}`, `user${i}@example.com`);
          return createExtendedUser(base, {
            preferences: {
              theme: i % 2 === 0 ? 'dark' : 'light',
              // Seulement le thème défini, le reste par défaut
            },
          });
        });

        const startTime = performance.now();

        for (const user of usersWithPartialPrefs) {
          const prefs = getUserPreferences(user);
          expect(prefs.language).toBe('en'); // Valeur par défaut
          expect(prefs.theme).toBeDefined(); // Valeur utilisateur
        }

        const endTime = performance.now();
        const executionTime = endTime - startTime;

        expect(executionTime).toBeLessThan(60);
      });
    });

    describe('getDisplayName() - Performance avec noms complexes', () => {
      it("devrait extraire rapidement les noms d'affichage", () => {
        const users = Array.from({ length: 5000 }, (_, i) => {
          const base = createUser(`user_${i}`, `user${i}@example.com`);
          return i % 3 === 0
            ? createExtendedUser(base, {
                name: `Very Long User Name ${i} With Many Words`,
              })
            : base;
        });

        const startTime = performance.now();

        for (const user of users) {
          getDisplayName(user);
        }

        const endTime = performance.now();
        const executionTime = endTime - startTime;

        expect(executionTime).toBeLessThan(50);
      });

      it('devrait gérer efficacement les noms avec caractères spéciaux', () => {
        const users = Array.from({ length: 1000 }, (_, i) => {
          const base = createUser(`user_${i}`, `user${i}@example.com`);
          return createExtendedUser(base, {
            name: `名前${i}`, // Caractères Unicode
          });
        });

        const startTime = performance.now();

        for (const user of users) {
          const displayName = getDisplayName(user);
          expect(displayName).toContain('名前');
        }

        const endTime = performance.now();
        const executionTime = endTime - startTime;

        expect(executionTime).toBeLessThan(30);
      });
    });
  });

  // ============================================================================
  // 5. TESTS DE PERFORMANCE MÉMOIRE
  // ============================================================================

  describe('Performance mémoire', () => {
    describe('Gestion de la mémoire avec objets volumineux', () => {
      it('devrait gérer efficacement de nombreux utilisateurs en mémoire', () => {
        const users: User[] = [];
        const initialMemory = process.memoryUsage();

        // Création de 50k utilisateurs
        for (let i = 0; i < 50000; i++) {
          users.push(
            createUser(`user_${i}`, `user${i}@example.com`, [
              UserRole.USER,
              ...(i % 10 === 0 ? [UserRole.PREMIUM] : []),
            ]),
          );
        }

        const afterCreationMemory = process.memoryUsage();
        const memoryIncrease =
          afterCreationMemory.heapUsed - initialMemory.heapUsed;

        // Vérification que l'usage mémoire reste raisonnable
        expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // Moins de 100MB
        expect(users).toHaveLength(50000);

        // Cleanup
        users.length = 0;
      });

      it('devrait éviter les fuites mémoire avec utilisateurs étendus', () => {
        let users: ExtendedUser[] = [];
        const initialMemory = process.memoryUsage();

        // Création et destruction cyclique
        for (let cycle = 0; cycle < 10; cycle++) {
          users = Array.from({ length: 1000 }, (_, i) => {
            const base = createUser(
              `user_${cycle}_${i}`,
              `user${cycle}_${i}@example.com`,
            );
            return createExtendedUser(base, {
              name: `User ${cycle} ${i}`,
              avatar: `https://example.com/avatar${cycle}_${i}.jpg`,
              preferences: {
                language: 'en',
                theme: 'light',
                notifications: true,
              },
            });
          });

          // Simulation d'usage
          users.forEach((user) => {
            getUserPreferences(user);
            getDisplayName(user);
          });

          // Nettoyage
          users.length = 0;
        }

        const finalMemory = process.memoryUsage();
        const memoryDifference = finalMemory.heapUsed - initialMemory.heapUsed;

        // La différence de mémoire devrait être minimale après cleanup
        expect(memoryDifference).toBeLessThan(10 * 1024 * 1024); // Moins de 10MB
      });
    });

    describe('Performance avec sérialisation JSON', () => {
      it('devrait sérialiser rapidement de nombreux utilisateurs', () => {
        const users = Array.from({ length: 1000 }, (_, i) => {
          const base = createUser(`user_${i}`, `user${i}@example.com`);
          return createExtendedUser(base, {
            name: `User ${i}`,
            avatar: `https://example.com/avatar${i}.jpg`,
            createdAt: new Date(),
            lastLoginAt: new Date(),
            preferences: {
              language: 'en',
              theme: 'light',
              notifications: true,
              itemsPerPage: 25,
            },
          });
        });

        const startTime = performance.now();

        const serialized = users.map((user) => JSON.stringify(user));

        const endTime = performance.now();
        const executionTime = endTime - startTime;

        expect(executionTime).toBeLessThan(100);
        expect(serialized).toHaveLength(1000);
        expect(serialized[0]).toContain('"id":"user_0"');
      });

      it('devrait désérialiser rapidement de nombreux utilisateurs', () => {
        const userJsons = Array.from({ length: 1000 }, (_, i) =>
          JSON.stringify({
            id: `user_${i}`,
            email: `user${i}@example.com`,
            roles: ['user'],
            name: `User ${i}`,
            preferences: {
              language: 'en',
              theme: 'light',
            },
          }),
        );

        const startTime = performance.now();

        const users = userJsons.map((json) => JSON.parse(json));

        const endTime = performance.now();
        const executionTime = endTime - startTime;

        expect(executionTime).toBeLessThan(50);
        expect(users).toHaveLength(1000);
        expect(users[0].id).toBe('user_0');
      });
    });
  });

  // ============================================================================
  // 6. TESTS COMPARATIFS ET BENCHMARKS
  // ============================================================================

  describe('Benchmarks comparatifs', () => {
    describe('Comparaison des algorithmes de recherche', () => {
      let largeUser: User;

      beforeAll(() => {
        const roles = Array.from({ length: 10000 }, (_, i) => `role_${i}`);
        roles.push(UserRole.USER, UserRole.ADMIN, UserRole.PREMIUM);
        largeUser = {
          id: '123',
          email: 'user@example.com',
          roles: roles,
        };
      });

      it('devrait comparer les performances de hasRole vs includes direct', () => {
        const iterations = 10000;

        // Test avec notre fonction hasRole
        const startHasRole = performance.now();
        for (let i = 0; i < iterations; i++) {
          hasRole(largeUser, UserRole.PREMIUM);
        }
        const endHasRole = performance.now();
        const hasRoleTime = endHasRole - startHasRole;

        // Test avec includes direct
        const startIncludes = performance.now();
        for (let i = 0; i < iterations; i++) {
          largeUser.roles.includes(UserRole.PREMIUM);
        }
        const endIncludes = performance.now();
        const includesTime = endIncludes - startIncludes;

        // Notre fonction ne devrait pas être plus de 2x plus lente
        expect(hasRoleTime).toBeLessThan(includesTime * 2);

        console.log(
          `hasRole: ${hasRoleTime.toFixed(2)}ms, includes: ${includesTime.toFixed(2)}ms`,
        );
      });
    });

    describe('Performance baseline', () => {
      it('devrait établir des benchmarks de référence', () => {
        const results = {
          createUser: 0,
          hasRole: 0,
          isValidUser: 0,
          getUserPreferences: 0,
        };

        // Benchmark createUser
        let start = performance.now();
        for (let i = 0; i < 10000; i++) {
          createUser(`user_${i}`, `user${i}@example.com`);
        }
        results.createUser = performance.now() - start;

        // Benchmark hasRole
        const user = createUser('123', 'user@example.com', [
          UserRole.USER,
          UserRole.PREMIUM,
        ]);
        start = performance.now();
        for (let i = 0; i < 100000; i++) {
          hasRole(user, UserRole.PREMIUM);
        }
        results.hasRole = performance.now() - start;

        // Benchmark isValidUser
        const testUser = {
          id: '123',
          email: 'user@example.com',
          roles: ['user'],
        };
        start = performance.now();
        for (let i = 0; i < 50000; i++) {
          isValidUser(testUser);
        }
        results.isValidUser = performance.now() - start;

        // Benchmark getUserPreferences
        const extendedUser = createExtendedUser(user, {
          preferences: { theme: 'dark' },
        });
        start = performance.now();
        for (let i = 0; i < 10000; i++) {
          getUserPreferences(extendedUser);
        }
        results.getUserPreferences = performance.now() - start;

        // Logging des résultats pour référence
        console.log('Performance Benchmarks:', results);

        // Assertions de performance acceptable
        expect(results.createUser).toBeLessThan(1000); // 10k créations < 1s
        expect(results.hasRole).toBeLessThan(100); // 100k vérifications < 100ms
        expect(results.isValidUser).toBeLessThan(500); // 50k validations < 500ms
        expect(results.getUserPreferences).toBeLessThan(200); // 10k récupérations < 200ms
      });
    });
  });
});
