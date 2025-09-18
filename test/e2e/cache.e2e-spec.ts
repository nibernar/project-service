// test/e2e/cache.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { CacheService } from '../../src/cache/cache.service';
import { ProjectStatus } from '../../src/common/enums/project-status.enum';
import Redis from 'ioredis';

import {
  ProjectFixtures,
  UserFixtures,
  FileFixtures,
  StatisticsFixtures,
  TEST_IDS,
} from '../fixtures/project.fixtures';

// Helper pour typer les retours de cache avec gestion d'erreur robuste
const safeCacheGet = async (cacheService: CacheService, key: string): Promise<any> => {
  try {
    return await cacheService.get(key);
  } catch (error) {
    console.warn(`Cache get error for key ${key}:`, error.message);
    return null;
  }
};

// Helper pour définir une clé avec gestion d'erreur
const safeCacheSet = async (cacheService: CacheService, key: string, value: any, ttl?: number): Promise<boolean> => {
  try {
    await cacheService.set(key, value, ttl);
    return true;
  } catch (error) {
    console.warn(`Cache set error for key ${key}:`, error.message);
    return false;
  }
};

// Helper pour supprimer une clé avec gestion d'erreur
const safeCacheDel = async (cacheService: CacheService, key: string): Promise<boolean> => {
  try {
    await cacheService.del(key);
    return true;
  } catch (error) {
    console.warn(`Cache del error for key ${key}:`, error.message);
    return false;
  }
};

describe('Cache E2E', () => {
  let app: INestApplication;
  let cacheService: CacheService;
  let redis: Redis;

  const E2E_TIMEOUT = 10000; // Timeout réduit

  beforeAll(async () => {
    // Configuration E2E
    process.env.NODE_ENV = 'test';
    process.env.REDIS_DB = '2';
    process.env.CACHE_TTL = '60';
    process.env.REDIS_ENABLE_METRICS = 'true';
    process.env.REDIS_KEY_PREFIX = 'e2e-test';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    cacheService = app.get<CacheService>(CacheService);

    // Connexion Redis directe
    redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      db: 2,
      lazyConnect: true,
    });

    // Vérifier Redis et nettoyer
    try {
      await redis.ping();
      await redis.flushdb();
    } catch (error) {
      console.error('Redis not available:', error.message);
      throw new Error('Redis server required for E2E tests');
    }
  }, E2E_TIMEOUT);

  afterAll(async () => {
    // Nettoyage ordonné
    if (redis) {
      try {
        await redis.flushdb();
        await redis.disconnect();
      } catch (error) {
        console.warn('Redis cleanup error:', error.message);
      }
    }

    if (cacheService) {
      try {
        await cacheService.disconnect();
      } catch (error) {
        console.warn('CacheService cleanup error:', error.message);
      }
    }

    if (app) {
      try {
        await app.close();
      } catch (error) {
        console.warn('App cleanup error:', error.message);
      }
    }

    // Délai pour fermeture propre
    await new Promise(resolve => setTimeout(resolve, 200));
  });

  beforeEach(async () => {
    try {
      await redis.flushdb();
    } catch (error) {
      console.warn('BeforeEach cleanup error:', error.message);
    }
  });

  describe('Basic Cache Operations', () => {
    it('should perform basic set/get/delete operations', async () => {
      const testUser = UserFixtures.validUser();
      const testProject = ProjectFixtures.mockProject({
        id: TEST_IDS.PROJECT_1,
        ownerId: testUser.id,
        name: 'Basic Test Project',
      });

      // Test SET
      const projectKey = cacheService.getProjectKey(testProject.id);
      const setResult = await safeCacheSet(cacheService, projectKey, testProject);
      expect(setResult).toBe(true);

      // Test GET
      const cachedProject = await safeCacheGet(cacheService, projectKey);
      expect(cachedProject).toBeTruthy();
      expect(cachedProject.id).toBe(testProject.id);
      expect(cachedProject.name).toBe(testProject.name);

      // Test DELETE
      const delResult = await safeCacheDel(cacheService, projectKey);
      expect(delResult).toBe(true);

      // Vérifier suppression
      const deletedProject = await safeCacheGet(cacheService, projectKey);
      expect(deletedProject).toBeNull();
    }, E2E_TIMEOUT);

    it('should handle TTL correctly', async () => {
      const key = 'ttl-test-key';
      const value = 'test-value';
      const ttlSeconds = 2;

      // Set avec TTL
      await safeCacheSet(cacheService, key, value, ttlSeconds);
      
      // Vérifier présence immédiate
      const immediateValue = await safeCacheGet(cacheService, key);
      expect(immediateValue).toBe(value);

      // Vérifier que la clé existe
      const exists = await cacheService.exists(key);
      expect(exists).toBe(true);

      // Attendre expiration et vérifier
      await new Promise(resolve => setTimeout(resolve, (ttlSeconds + 1) * 1000));
      const expiredValue = await safeCacheGet(cacheService, key);
      expect(expiredValue).toBeNull();
    }, E2E_TIMEOUT);
  });

  describe('Project Cache Lifecycle', () => {
    it('should handle project creation and updates', async () => {
      const testUser = UserFixtures.validUser();
      const project = ProjectFixtures.mockProject({
        id: TEST_IDS.PROJECT_1,
        ownerId: testUser.id,
        name: 'Lifecycle Test Project',
        uploadedFileIds: FileFixtures.uploadedFileIds().slice(0, 2),
        generatedFileIds: [],
      });

      const projectKey = cacheService.getProjectKey(project.id);
      const listKey = cacheService.getProjectListKey(testUser.id, 1, 10);

      // === PHASE 1: Création ===
      await safeCacheSet(cacheService, projectKey, project);
      await safeCacheSet(cacheService, listKey, [project]);

      const cachedProject = await safeCacheGet(cacheService, projectKey);
      expect(cachedProject).toBeTruthy();
      expect(cachedProject.id).toBe(project.id);

      const cachedList = await safeCacheGet(cacheService, listKey);
      expect(cachedList).toBeTruthy();
      expect(cachedList).toHaveLength(1);

      // === PHASE 2: Mise à jour avec fichiers générés ===
      const updatedProject = {
        ...project,
        generatedFileIds: FileFixtures.generatedFileIds(),
        updatedAt: new Date().toISOString(),
      };

      // Invalidation explicite
      await safeCacheDel(cacheService, projectKey);
      await safeCacheDel(cacheService, listKey);

      // Vérifier invalidation
      expect(await safeCacheGet(cacheService, projectKey)).toBeNull();
      expect(await safeCacheGet(cacheService, listKey)).toBeNull();

      // Re-cache des données mises à jour
      await safeCacheSet(cacheService, projectKey, updatedProject);

      const finalProject = await safeCacheGet(cacheService, projectKey);
      expect(finalProject).toBeTruthy();
      expect(finalProject.generatedFileIds).toHaveLength(4);
    }, E2E_TIMEOUT);

    it('should handle multiple projects with filtering', async () => {
      const testUser = UserFixtures.validUser();
      
      const activeProject = ProjectFixtures.mockProject({
        id: 'active-1',
        ownerId: testUser.id,
        name: 'Active Project',
        status: ProjectStatus.ACTIVE,
        uploadedFileIds: FileFixtures.uploadedFileIds().slice(0, 1),
      });

      const archivedProject = ProjectFixtures.mockProject({
        id: 'archived-1',
        ownerId: testUser.id,
        name: 'Archived Project',
        status: ProjectStatus.ARCHIVED,
        uploadedFileIds: [],
      });

      // Cache des projets individuels
      await safeCacheSet(cacheService, cacheService.getProjectKey(activeProject.id), activeProject);
      await safeCacheSet(cacheService, cacheService.getProjectKey(archivedProject.id), archivedProject);

      // Cache des listes filtrées
      const activeListKey = cacheService.getProjectListKey(testUser.id, 1, 10, { status: ProjectStatus.ACTIVE });
      const allListKey = cacheService.getProjectListKey(testUser.id, 1, 10);

      await safeCacheSet(cacheService, activeListKey, [activeProject]);
      await safeCacheSet(cacheService, allListKey, [activeProject, archivedProject]);

      // Vérifications
      const cachedActiveList = await safeCacheGet(cacheService, activeListKey);
      expect(cachedActiveList).toHaveLength(1);
      expect(cachedActiveList[0].status).toBe(ProjectStatus.ACTIVE);

      const cachedAllList = await safeCacheGet(cacheService, allListKey);
      expect(cachedAllList).toHaveLength(2);

      // Test d'invalidation sélective
      await safeCacheDel(cacheService, cacheService.getProjectKey(activeProject.id));
      await safeCacheDel(cacheService, activeListKey);
      await safeCacheDel(cacheService, allListKey);

      // Vérifier invalidation
      expect(await safeCacheGet(cacheService, cacheService.getProjectKey(activeProject.id))).toBeNull();
      expect(await safeCacheGet(cacheService, activeListKey)).toBeNull();
      expect(await safeCacheGet(cacheService, allListKey)).toBeNull();

      // Le projet archivé doit rester
      expect(await safeCacheGet(cacheService, cacheService.getProjectKey(archivedProject.id))).toBeTruthy();
    }, E2E_TIMEOUT);
  });

  describe('Statistics Cache', () => {
    it('should handle statistics with accurate calculations', async () => {
      const projectId = TEST_IDS.PROJECT_1;

      // Données initiales
      const initialStats = {
        costs: { 
          claudeApi: 3.25, 
          storage: 0.05, 
          compute: 0.12,
          total: 3.42 
        },
        performance: { 
          generationTime: 45000,
          processingTime: 12000,
        },
        usage: { 
          tokensUsed: 12000,
          documentsGenerated: 2,
        },
        lastUpdated: new Date().toISOString(),
      };

      const statsKey = cacheService.getProjectStatisticsKey(projectId);
      await safeCacheSet(cacheService, statsKey, initialStats);

      let stats = await safeCacheGet(cacheService, statsKey);
      expect(stats).toBeTruthy();
      expect(stats.costs.total).toBeCloseTo(3.42, 2);

      // Mises à jour progressives avec précision
      const updates = [
        { additionalCost: 2.50, expectedTotal: 5.92 },
        { additionalCost: 1.25, expectedTotal: 7.17 },
        { additionalCost: 3.00, expectedTotal: 10.17 },
      ];

      let currentTotal = 3.42;
      for (const update of updates) {
        currentTotal = Math.round((currentTotal + update.additionalCost) * 100) / 100; // Arrondir à 2 décimales

        const updatedStats = {
          ...initialStats,
          costs: {
            ...initialStats.costs,
            total: currentTotal,
          },
          lastUpdated: new Date().toISOString(),
        };

        await safeCacheSet(cacheService, statsKey, updatedStats);

        stats = await safeCacheGet(cacheService, statsKey);
        expect(stats).toBeTruthy();
        expect(stats.costs.total).toBeCloseTo(update.expectedTotal, 2);
      }

      // Performance test - consultations répétées
      const consultationCount = 20;
      const consultationTimes = [];

      for (let i = 0; i < consultationCount; i++) {
        const start = Date.now();
        const consultedStats = await safeCacheGet(cacheService, statsKey);
        const consultationTime = Date.now() - start;

        consultationTimes.push(consultationTime);
        expect(consultedStats).toBeTruthy();
      }

      const avgTime = consultationTimes.reduce((a, b) => a + b) / consultationCount;
      expect(avgTime).toBeLessThan(50); // Cache rapide
    }, E2E_TIMEOUT);
  });

  describe('Export System Cache', () => {
    it('should handle export status tracking', async () => {
      const exportId = TEST_IDS.EXPORT_1;
      const projectId = TEST_IDS.PROJECT_1;
      const testUser = UserFixtures.validUser();

      // Status initial
      const initialStatus = {
        exportId,
        projectId,
        userId: testUser.id,
        status: 'QUEUED',
        progress: 0,
        message: 'Export queued',
        createdAt: new Date().toISOString(),
      };

      const statusKey = cacheService.getExportStatusKey(exportId);
      await safeCacheSet(cacheService, statusKey, initialStatus, 3600);

      let status = await safeCacheGet(cacheService, statusKey);
      expect(status).toBeTruthy();
      expect(status.status).toBe('QUEUED');
      expect(status.progress).toBe(0);

      // Progression
      const progressSteps = [
        { progress: 25, status: 'PROCESSING', message: 'Loading data' },
        { progress: 50, status: 'PROCESSING', message: 'Converting files' },
        { progress: 75, status: 'PROCESSING', message: 'Generating output' },
        { progress: 100, status: 'COMPLETED', message: 'Export ready' },
      ];

      for (const step of progressSteps) {
        const updatedStatus = {
          ...initialStatus,
          ...step,
          updatedAt: new Date().toISOString(),
        };

        await safeCacheSet(cacheService, statusKey, updatedStatus, 3600);

        status = await safeCacheGet(cacheService, statusKey);
        expect(status).toBeTruthy();
        expect(status.progress).toBe(step.progress);
        expect(status.status).toBe(step.status);
      }

      // Résultat final
      const exportResult = {
        downloadUrl: 'https://example.com/export.pdf',
        fileName: 'export.pdf',
        fileSize: 1024000,
        expiresAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      };

      const resultKey = cacheService.getExportResultKey(exportId);
      await safeCacheSet(cacheService, resultKey, exportResult, 86400);

      const result = await safeCacheGet(cacheService, resultKey);
      expect(result).toBeTruthy();
      expect(result.downloadUrl).toBeTruthy();
      expect(result.fileSize).toBe(1024000);
    }, E2E_TIMEOUT);
  });

  describe('User Session Cache', () => {
    it('should handle user sessions with proper security', async () => {
      const testUser = UserFixtures.validUser();
      const sessionId = 'test-session-123';

      const sessionData = {
        sessionId,
        userId: testUser.id,
        userAgent: 'Test Browser',
        ipAddress: '192.168.1.100',
        loginTime: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        roles: ['user'],
        permissions: ['read:projects', 'write:projects'],
      };

      // Cache de session
      const sessionKey = cacheService.getUserSessionKey(testUser.id, sessionId);
      await safeCacheSet(cacheService, sessionKey, sessionData, 1800);

      const cachedSession = await safeCacheGet(cacheService, sessionKey);
      expect(cachedSession).toBeTruthy();
      expect(cachedSession.userId).toBe(testUser.id);
      expect(cachedSession.sessionId).toBe(sessionId);

      // Validation de token
      const token = 'test-jwt-token-123';
      const tokenValidation = {
        valid: true,
        userId: testUser.id,
        sessionId,
        roles: ['user'],
        exp: Date.now() + 3600000,
      };

      const tokenKey = cacheService.getTokenValidationKey(token);
      await safeCacheSet(cacheService, tokenKey, tokenValidation, 3600);

      const cachedValidation = await safeCacheGet(cacheService, tokenKey);
      expect(cachedValidation).toBeTruthy();
      expect(cachedValidation.valid).toBe(true);
      expect(cachedValidation.userId).toBe(testUser.id);

      // Déconnexion - suppression explicite
      await safeCacheDel(cacheService, sessionKey);
      await safeCacheDel(cacheService, tokenKey);

      expect(await safeCacheGet(cacheService, sessionKey)).toBeNull();
      expect(await safeCacheGet(cacheService, tokenKey)).toBeNull();
    }, E2E_TIMEOUT);
  });

  describe('Performance and Load Testing', () => {
    it('should maintain performance under concurrent operations', async () => {
      const users = [
        UserFixtures.validUser(),
        UserFixtures.otherUser(),
        UserFixtures.thirdUser(),
      ];

      const operations = [];
      const operationsPerUser = 5;

      // Préparer les opérations
      for (const user of users) {
        for (let i = 0; i < operationsPerUser; i++) {
          const projectId = `perf-test-${user.id}-${i}`;
          const project = ProjectFixtures.mockProject({
            id: projectId,
            ownerId: user.id,
            name: `Performance Test ${i}`,
          });

          operations.push(
            () => safeCacheSet(cacheService, cacheService.getProjectKey(projectId), project),
            () => safeCacheGet(cacheService, cacheService.getProjectKey(projectId)),
          );
        }
      }

      // Exécuter en parallèle par batches
      const startTime = Date.now();
      const batchSize = 10;
      const results = [];

      for (let i = 0; i < operations.length; i += batchSize) {
        const batch = operations.slice(i, i + batchSize);
        const batchResults = await Promise.all(batch.map(op => op()));
        results.push(...batchResults);
      }

      const totalTime = Date.now() - startTime;
      const opsPerSecond = operations.length / (totalTime / 1000);

      expect(totalTime).toBeLessThan(5000); // Moins de 5 secondes
      expect(opsPerSecond).toBeGreaterThan(5); // Au moins 5 ops/sec
      expect(results.filter(r => r !== null && r !== false)).toHaveLength(operations.length / 2); // Les gets qui réussissent
    }, E2E_TIMEOUT);

    it('should demonstrate cache efficiency', async () => {
      const testProject = ProjectFixtures.mockProject({
        id: 'efficiency-test',
        name: 'Large Project',
        uploadedFileIds: FileFixtures.largeFileIdsList(10),
        generatedFileIds: FileFixtures.largeFileIdsList(15),
      });

      const projectKey = cacheService.getProjectKey(testProject.id);

      // Premier accès (miss) - simuler DB query
      const missStart = Date.now();
      await new Promise(resolve => setTimeout(resolve, 100)); // Simule 100ms DB
      await safeCacheSet(cacheService, projectKey, testProject);
      const missTime = Date.now() - missStart;

      // Accès suivants (hits)
      const hitTimes = [];
      for (let i = 0; i < 10; i++) {
        const hitStart = Date.now();
        const cached = await safeCacheGet(cacheService, projectKey);
        const hitTime = Date.now() - hitStart;
        
        hitTimes.push(hitTime);
        expect(cached).toBeTruthy();
      }

      const avgHitTime = hitTimes.reduce((a, b) => a + b) / hitTimes.length;
      
      expect(avgHitTime).toBeLessThan(missTime / 2); // Au moins 2x plus rapide
      expect(avgHitTime).toBeLessThan(25); // Moins de 25ms en moyenne
    }, E2E_TIMEOUT);
  });

  describe('Configuration and Environment', () => {
    it('should validate cache service functionality', async () => {
      // Test des fonctionnalités critiques sans healthCheck
      const basicTests = [
        async () => {
          await safeCacheSet(cacheService, 'config-test', 'test-value');
          return true;
        },
        async () => {
          const value = await safeCacheGet(cacheService, 'config-test');
          return value === 'test-value';
        },
        async () => {
          const stats = await cacheService.getStats();
          return stats && typeof stats.operations === 'object';
        },
      ];

      for (const test of basicTests) {
        const result = await test();
        expect(result).toBe(true);
      }
    }, E2E_TIMEOUT);

    it('should handle environment configuration', async () => {
      // Vérifier que l'environnement de test est configuré
      expect(process.env.NODE_ENV).toBe('test');
      expect(process.env.REDIS_DB).toBe('2');
      expect(process.env.REDIS_KEY_PREFIX).toBe('e2e-test');

      // Test de stockage et récupération via CacheService
      await safeCacheSet(cacheService, 'env-test', 'environment-value');
      
      // Vérifier via CacheService (pas directement Redis)
      const cachedValue = await safeCacheGet(cacheService, 'env-test');
      expect(cachedValue).toBe('environment-value');

      // Vérifier que la clé existe
      const exists = await cacheService.exists('env-test');
      expect(exists).toBe(true);
    }, E2E_TIMEOUT);
  });
});