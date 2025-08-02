// test/integration/cache.integration.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RedisModule } from '@nestjs-modules/ioredis';
import { CacheService } from '../../src/cache/cache.service';
import { CacheModule } from '../../src/cache/cache.module';
import { cacheConfig, getCacheConfig, CACHE_KEYS } from '../../src/config/cache.config';
import Redis from 'ioredis';

describe('Cache Integration', () => {
  let service: CacheService;
  let app: TestingModule;
  let redis: Redis;
  let keyPrefix: string;

  // Timeout pour les tests d'intégration
  const INTEGRATION_TIMEOUT = 30000;

  // Helper pour obtenir la clé complète avec préfixe (comme le fait le module NestJS)
  const getFullKey = (key: string): string => keyPrefix + key;

  beforeAll(async () => {
    // Configuration pour les tests d'intégration
    process.env.NODE_ENV = 'test';
    process.env.REDIS_HOST = process.env.REDIS_HOST || 'localhost';
    process.env.REDIS_PORT = process.env.REDIS_PORT || '6379';
    process.env.REDIS_DB = '1'; // Base dédiée aux tests
    process.env.CACHE_TTL = '30'; // TTL court pour les tests
    process.env.REDIS_MAX_CONNECTIONS = '3';
    process.env.REDIS_ENABLE_METRICS = 'false';

    app = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          load: [cacheConfig],
          isGlobal: true,
        }),
        CacheModule,
      ],
    }).compile();

    service = app.get<CacheService>(CacheService);
    
    // Connexion Redis directe pour les tests
    const configService = app.get<ConfigService>(ConfigService);
    const config = getCacheConfig(configService);
    keyPrefix = config.serialization.keyPrefix;
    
    redis = new Redis({
      host: config.connection.host,
      port: config.connection.port,
      db: config.connection.db,
    });

    // Vérifier que Redis est disponible
    try {
      await redis.ping();
    } catch (error) {
      console.error('Redis not available for integration tests:', error.message);
      throw new Error('Redis server is required for integration tests. Please start Redis first.');
    }

    // Nettoyer la base de test
    await redis.flushdb();
  }, INTEGRATION_TIMEOUT);

  afterAll(async () => {
    // Nettoyer après les tests et fermer les connexions
    if (redis) {
      await redis.flushdb();
      await redis.quit();
    }
    
    if (service) {
      await service.disconnect();
    }
    
    if (app) {
      await app.close();
    }
  });

  beforeEach(async () => {
    // Nettoyer avant chaque test
    await redis.flushdb();
  });

  describe('Real Redis Connection', () => {
    it('should connect to Redis successfully', async () => {
      const isConnected = await service.isConnected();
      expect(isConnected).toBe(true);
    }, INTEGRATION_TIMEOUT);

    it('should retrieve Redis server info', async () => {
      const info = await service.getInfo();
      
      expect(info).toBeTruthy();
      expect(info).toContain('redis_version');
      expect(info).toContain('# Server');
    }, INTEGRATION_TIMEOUT);

    it('should use correct database for tests', async () => {
      const configService = app.get<ConfigService>(ConfigService);
      const config = getCacheConfig(configService);
      
      expect(config.connection.db).toBe(1);
    }, INTEGRATION_TIMEOUT);

    it('should handle connection with authentication if configured', async () => {
      // Ce test vérifie que la connexion fonctionne avec les paramètres actuels
      // Si un mot de passe est configuré, il devrait être utilisé automatiquement
      const isConnected = await service.isConnected();
      expect(isConnected).toBe(true);
    }, INTEGRATION_TIMEOUT);
  });

  describe('Basic Operations', () => {
    it('should perform complete set/get/delete cycle', async () => {
      const testKey = 'integration:test:key';
      const testValue = {
        id: 'test-123',
        name: 'Integration Test',
        metadata: {
          created: new Date().toISOString(),
          tags: ['test', 'integration'],
        },
      };

      // SET
      await service.set(testKey, testValue);
      
      // Vérifier que la clé existe dans Redis (avec préfixe automatique)
      const exists = await redis.exists(getFullKey(testKey));
      expect(exists).toBe(1);

      // GET
      const retrieved = await service.get(testKey);
      expect(retrieved).toEqual(testValue);

      // DELETE
      await service.del(testKey);
      
      // Vérifier que la clé n'existe plus
      const existsAfterDelete = await redis.exists(getFullKey(testKey));
      expect(existsAfterDelete).toBe(0);

      // GET après DELETE
      const retrievedAfterDelete = await service.get(testKey);
      expect(retrievedAfterDelete).toBeNull();
    }, INTEGRATION_TIMEOUT);

    it('should respect TTL settings', async () => {
      const testKey = 'integration:ttl:key';
      const testValue = { message: 'TTL test' };
      const customTtl = 2; // 2 secondes

      await service.set(testKey, testValue, customTtl);

      // Vérifier que la clé existe (avec préfixe automatique)
      const exists = await redis.exists(getFullKey(testKey));
      expect(exists).toBe(1);

      // Vérifier le TTL
      const ttl = await redis.ttl(getFullKey(testKey));
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(customTtl);

      // Attendre l'expiration
      await new Promise(resolve => setTimeout(resolve, 2100));

      // Vérifier que la clé a expiré
      const existsAfterTtl = await redis.exists(getFullKey(testKey));
      expect(existsAfterTtl).toBe(0);

      const retrievedAfterTtl = await service.get(testKey);
      expect(retrievedAfterTtl).toBeNull();
    }, INTEGRATION_TIMEOUT);

    it('should handle multiple keys deletion', async () => {
      const keys = ['multi:key1', 'multi:key2', 'multi:key3'];
      const testValue = { test: true };

      // SET multiple keys
      for (const key of keys) {
        await service.set(key, testValue);
      }

      // Vérifier que toutes les clés existent (avec préfixe automatique)
      for (const key of keys) {
        const exists = await redis.exists(getFullKey(key));
        expect(exists).toBe(1);
      }

      // DELETE multiple keys
      await service.del(keys);

      // Vérifier que toutes les clés ont été supprimées
      for (const key of keys) {
        const exists = await redis.exists(getFullKey(key));
        expect(exists).toBe(0);
      }
    }, INTEGRATION_TIMEOUT);
  });

  describe('Performance and Concurrency', () => {
    it('should handle concurrent operations', async () => {
      const concurrentOperations = 50;
      const promises: Promise<any>[] = [];

      // Créer des opérations concurrentes de SET
      for (let i = 0; i < concurrentOperations; i++) {
        const key = `concurrent:set:${i}`;
        const value = { id: i, data: `test-data-${i}` };
        promises.push(service.set(key, value));
      }

      // Attendre que toutes les opérations SET soient terminées
      await Promise.all(promises);

      // Vérifier que toutes les clés ont été créées
      const getPromises: Promise<any>[] = [];
      for (let i = 0; i < concurrentOperations; i++) {
        const key = `concurrent:set:${i}`;
        getPromises.push(service.get(key));
      }

      const results = await Promise.all(getPromises);
      
      // Vérifier que tous les résultats sont corrects
      results.forEach((result, index) => {
        expect(result).toEqual({
          id: index,
          data: `test-data-${index}`,
        });
      });
    }, INTEGRATION_TIMEOUT);

    it('should handle rapid cache invalidation', async () => {
      const projectId = 'rapid-test-project';
      const userId = 'rapid-test-user';

      // Créer plusieurs clés pour le projet et l'utilisateur
      const projectKeys = [
        CACHE_KEYS.PROJECT(projectId),
        CACHE_KEYS.PROJECT_STATISTICS(projectId),
        CACHE_KEYS.USER_PROJECTS_COUNT(userId),
      ];

      const listKeys = [
        CACHE_KEYS.PROJECT_LIST(userId, 1, 10),
        CACHE_KEYS.PROJECT_LIST(userId, 2, 10),
        CACHE_KEYS.PROJECT_LIST(userId, 1, 20),
      ];

      const allKeys = [...projectKeys, ...listKeys];
      const testValue = { test: 'rapid invalidation' };

      // SET toutes les clés
      for (const key of allKeys) {
        await service.set(key, testValue);
      }

      // Vérifier que toutes les clés existent (avec préfixe automatique)
      for (const key of allKeys) {
        const exists = await redis.exists(getFullKey(key));
        expect(exists).toBe(1);
      }

      // Invalidation rapide
      await service.invalidateProjectCache(projectId, userId);

      // Vérifier que toutes les clés ont été supprimées
      for (const key of allKeys) {
        const exists = await redis.exists(getFullKey(key));
        expect(exists).toBe(0);
      }
    }, INTEGRATION_TIMEOUT);

    it('should maintain performance with large datasets', async () => {
      const largeDataset = {
        items: Array(1000).fill(0).map((_, i) => ({
          id: i,
          name: `Item ${i}`,
          description: `Description for item ${i}`.repeat(5),
          metadata: {
            created: new Date().toISOString(),
            tags: [`tag-${i % 10}`, `category-${i % 5}`],
          },
        })),
        summary: {
          total: 1000,
          categories: 5,
          tags: 10,
        },
      };

      const key = 'performance:large:dataset';
      const startTime = Date.now();

      // SET large dataset
      await service.set(key, largeDataset);
      const setTime = Date.now() - startTime;

      // GET large dataset
      const getStartTime = Date.now();
      const retrieved = await service.get(key);
      const getTime = Date.now() - getStartTime;

      expect(retrieved).toEqual(largeDataset);
      expect(setTime).toBeLessThan(1000); // Moins de 1 seconde pour SET
      expect(getTime).toBeLessThan(500);  // Moins de 0.5 seconde pour GET
    }, INTEGRATION_TIMEOUT);
  });

  describe('Resilience and Error Handling', () => {
    it('should handle key patterns correctly', async () => {
      const userId = 'pattern-test-user';
      
      // Créer des clés avec différents patterns
      const keysToCreate = [
        CACHE_KEYS.PROJECT_LIST(userId, 1, 10),
        CACHE_KEYS.PROJECT_LIST(userId, 2, 10),
        CACHE_KEYS.PROJECT_LIST(userId, 1, 20),
        CACHE_KEYS.USER_PROJECTS_COUNT(userId),
        'other:key:not:matching',
      ];

      const testValue = { test: 'pattern test' };

      // SET toutes les clés
      for (const key of keysToCreate) {
        await service.set(key, testValue);
      }

      // Invalider le cache utilisateur
      await service.invalidateUserProjectsCache(userId);

      // Vérifier que seules les clés correspondant au pattern ont été supprimées
      const shouldBeDeleted = keysToCreate.slice(0, 3); // Les 3 premières (PROJECT_LIST)
      const shouldRemain = [CACHE_KEYS.USER_PROJECTS_COUNT(userId), 'other:key:not:matching'];

      for (const key of shouldBeDeleted) {
        const exists = await redis.exists(getFullKey(key));
        expect(exists).toBe(0);
      }

      for (const key of shouldRemain) {
        const exists = await redis.exists(getFullKey(key));
        expect(exists).toBe(1);
      }
    }, INTEGRATION_TIMEOUT);

    it('should handle Redis memory pressure gracefully', async () => {
      // Simuler une pression mémoire en créant beaucoup de clés
      const manyKeys: string[] = [];
      const largeValue = { data: 'x'.repeat(10000) }; // 10KB par valeur

      // Créer beaucoup de clés (attention à ne pas saturer Redis en test)
      for (let i = 0; i < 100; i++) {
        const key = `memory:pressure:${i}`;
        manyKeys.push(key);
        await service.set(key, largeValue, 60); // TTL de 60 secondes
      }

      // Vérifier que toutes les opérations ont réussi
      let successCount = 0;
      for (const key of manyKeys) {
        const value = await service.get(key);
        if (value) {
          successCount++;
        }
      }

      expect(successCount).toBeGreaterThan(90); // Au moins 90% de réussite

      // Nettoyer
      await service.del(manyKeys);
    }, INTEGRATION_TIMEOUT);

    it('should handle Unicode and special characters in keys and values', async () => {
      const specialCases = [
        {
          key: 'unicode:🚀:test:café',
          value: { message: 'Hello 世界!', emoji: '🎉🎊🥳' },
        },
        {
          key: 'special:chars:test:with:colons',
          value: { text: 'Special chars: !@#$%^&*()[]{}|;:,.<>?' },
        },
        {
          key: 'encoded:test',
          value: { data: 'Base64: ' + Buffer.from('test data').toString('base64') },
        },
      ];

      for (const testCase of specialCases) {
        await service.set(testCase.key, testCase.value);
        const retrieved = await service.get(testCase.key);
        expect(retrieved).toEqual(testCase.value);
      }
    }, INTEGRATION_TIMEOUT);
  });

  describe('Business Logic Integration', () => {
    it('should support complete project cache workflow', async () => {
      const projectId = 'workflow-project-123';
      const userId = 'workflow-user-456';
      
      const projectData = {
        id: projectId,
        name: 'Workflow Test Project',
        description: 'Testing complete workflow',
        ownerId: userId,
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
      };

      const statisticsData = {
        costs: { total: 150.50 },
        performance: { generationTime: 5000 },
        usage: { tokensUsed: 1000 },
      };

      const projectListData = [
        { id: projectId, name: projectData.name },
        { id: 'other-project', name: 'Other Project' },
      ];

      // 1. Cache initial project data
      await service.set(CACHE_KEYS.PROJECT(projectId), projectData);
      await service.set(CACHE_KEYS.PROJECT_STATISTICS(projectId), statisticsData);
      await service.set(CACHE_KEYS.PROJECT_LIST(userId, 1, 10), projectListData);
      await service.set(CACHE_KEYS.USER_PROJECTS_COUNT(userId), 2);

      // 2. Verify all data is cached
      expect(await service.get(CACHE_KEYS.PROJECT(projectId))).toEqual(projectData);
      expect(await service.get(CACHE_KEYS.PROJECT_STATISTICS(projectId))).toEqual(statisticsData);
      expect(await service.get(CACHE_KEYS.PROJECT_LIST(userId, 1, 10))).toEqual(projectListData);
      expect(await service.get(CACHE_KEYS.USER_PROJECTS_COUNT(userId))).toBe(2);

      // 3. Simulate project update - invalidate cache
      await service.invalidateProjectCache(projectId, userId);

      // 4. Verify cache invalidation
      expect(await service.get(CACHE_KEYS.PROJECT(projectId))).toBeNull();
      expect(await service.get(CACHE_KEYS.PROJECT_STATISTICS(projectId))).toBeNull();
      expect(await service.get(CACHE_KEYS.PROJECT_LIST(userId, 1, 10))).toBeNull();
      expect(await service.get(CACHE_KEYS.USER_PROJECTS_COUNT(userId))).toBeNull();
    }, INTEGRATION_TIMEOUT);

    it('should handle user project cache isolation', async () => {
      const user1Id = 'isolation-user-1';
      const user2Id = 'isolation-user-2';
      const project1Id = 'isolation-project-1';
      const project2Id = 'isolation-project-2';

      // Créer des données pour deux utilisateurs différents
      await service.set(CACHE_KEYS.PROJECT(project1Id), { ownerId: user1Id });
      await service.set(CACHE_KEYS.PROJECT(project2Id), { ownerId: user2Id });
      await service.set(CACHE_KEYS.PROJECT_LIST(user1Id, 1, 10), [{ id: project1Id }]);
      await service.set(CACHE_KEYS.PROJECT_LIST(user2Id, 1, 10), [{ id: project2Id }]);
      await service.set(CACHE_KEYS.USER_PROJECTS_COUNT(user1Id), 1);
      await service.set(CACHE_KEYS.USER_PROJECTS_COUNT(user2Id), 1);

      // Invalider le cache du premier utilisateur seulement
      await service.invalidateUserProjectsCache(user1Id);

      // Vérifier que seules les listes de projets du premier utilisateur ont été supprimées
      expect(await service.get(CACHE_KEYS.PROJECT_LIST(user1Id, 1, 10))).toBeNull();
      
      // USER_PROJECTS_COUNT ne doit PAS être supprimé par invalidateUserProjectsCache
      expect(await service.get(CACHE_KEYS.USER_PROJECTS_COUNT(user1Id))).toBe(1);

      // Les données du deuxième utilisateur doivent rester intactes
      expect(await service.get(CACHE_KEYS.PROJECT(project2Id))).toEqual({ ownerId: user2Id });
      expect(await service.get(CACHE_KEYS.PROJECT_LIST(user2Id, 1, 10))).toEqual([{ id: project2Id }]);
      expect(await service.get(CACHE_KEYS.USER_PROJECTS_COUNT(user2Id))).toBe(1);
    }, INTEGRATION_TIMEOUT);
  });

  describe('Configuration Integration', () => {
    it('should use configuration values correctly', async () => {
      const configService = app.get<ConfigService>(ConfigService);
      const config = getCacheConfig(configService);

      // Vérifier que la configuration de test est utilisée
      expect(config.connection.db).toBe(1);
      expect(config.performance.defaultTtl).toBe(30);
      expect(config.performance.maxConnections).toBe(3);
      expect(config.monitoring.enabled).toBe(false);
    }, INTEGRATION_TIMEOUT);

    it('should use key prefix from configuration', async () => {
      const configService = app.get<ConfigService>(ConfigService);
      const config = getCacheConfig(configService);
      
      const testKey = 'test:key';
      const testValue = { test: true };
      
      await service.set(testKey, testValue);
      
      // Vérifier que la clé avec préfixe existe dans Redis
      const prefixedKey = config.serialization.keyPrefix + testKey;
      const directValue = await redis.get(prefixedKey);
      
      expect(directValue).toBe(JSON.stringify(testValue));
    }, INTEGRATION_TIMEOUT);
  });
});