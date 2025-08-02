// test/e2e/cache.e2e-spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppModule } from '../../src/app.module';
import { CacheService } from '../../src/cache/cache.service';
import { CACHE_KEYS } from '../../src/config/cache.config';
import Redis from 'ioredis';

describe('Cache E2E', () => {
  let app: INestApplication;
  let cacheService: CacheService;
  let redis: Redis;

  const E2E_TIMEOUT = 30000;

  beforeAll(async () => {
    // Configuration E2E avec base de données et cache de test
    process.env.NODE_ENV = 'test';
    process.env.REDIS_DB = '2'; // Base dédiée aux tests E2E
    process.env.CACHE_TTL = '60';
    process.env.REDIS_ENABLE_METRICS = 'false';
    process.env.REDIS_KEY_PREFIX = 'test:'; // Définir explicitement le préfixe pour les tests

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    cacheService = app.get<CacheService>(CacheService);

    // Connexion Redis directe pour vérifications
    redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      db: 2, // Base E2E
      lazyConnect: true,
    });

    // Vérifier que Redis est disponible
    try {
      await redis.ping();
      await redis.flushdb(); // Nettoyer la base E2E
    } catch (error) {
      console.error('Redis not available for E2E tests:', error.message);
      throw new Error('Redis server is required for E2E tests');
    }
  }, E2E_TIMEOUT);

  afterAll(async () => {
    // Fermer toutes les connexions dans l'ordre approprié
    if (redis) {
      try {
        await redis.flushdb();
        await redis.quit();
      } catch (error) {
        console.warn('Error closing direct Redis connection:', error.message);
      }
    }
    
    if (cacheService) {
      try {
        await cacheService.disconnect();
      } catch (error) {
        console.warn('Error disconnecting cache service:', error.message);
      }
    }
    
    if (app) {
      try {
        await app.close();
      } catch (error) {
        console.warn('Error closing app:', error.message);
      }
    }
  });

  beforeEach(async () => {
    try {
      await redis.flushdb();
    } catch (error) {
      console.warn('Error flushing Redis in beforeEach:', error.message);
    }
  });

  describe('Project Cache Workflow', () => {
    it('should complete full project lifecycle with cache', async () => {
      const projectId = 'e2e-project-123';
      const userId = 'e2e-user-456';
      
      // Données de projet simulées
      const projectData = {
        id: projectId,
        name: 'E2E Test Project',
        description: 'End-to-end testing project',
        initialPrompt: 'Create a web application',
        status: 'ACTIVE',
        ownerId: userId,
        uploadedFileIds: ['file-1', 'file-2'],
        generatedFileIds: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // === PHASE 1: CRÉATION DU PROJET ===
      
      // 1.1 Cache du projet créé
      await cacheService.set(CACHE_KEYS.PROJECT(projectId), projectData);
      
      // 1.2 Mise à jour du compteur utilisateur
      await cacheService.set(CACHE_KEYS.USER_PROJECTS_COUNT(userId), 1);
      
      // 1.3 Cache de la liste des projets
      const projectList = [{ 
        id: projectId, 
        name: projectData.name, 
        status: projectData.status,
        createdAt: projectData.createdAt 
      }];
      await cacheService.set(CACHE_KEYS.PROJECT_LIST(userId, 1, 10), projectList);

      // Vérifier que tout est en cache
      expect(await cacheService.get(CACHE_KEYS.PROJECT(projectId))).toEqual(projectData);
      expect(await cacheService.get(CACHE_KEYS.USER_PROJECTS_COUNT(userId))).toBe(1);
      expect(await cacheService.get(CACHE_KEYS.PROJECT_LIST(userId, 1, 10))).toEqual(projectList);

      // === PHASE 2: GÉNÉRATION DE DOCUMENTS ===
      
      const updatedProjectData = {
        ...projectData,
        generatedFileIds: ['generated-1', 'generated-2', 'generated-3'],
        updatedAt: new Date().toISOString(),
      };

      // 2.1 Invalider le cache du projet lors de la mise à jour
      await cacheService.invalidateProjectCache(projectId, userId);
      
      // Vérifier que le cache a été invalidé
      expect(await cacheService.get(CACHE_KEYS.PROJECT(projectId))).toBeNull();
      expect(await cacheService.get(CACHE_KEYS.PROJECT_LIST(userId, 1, 10))).toBeNull();
      
      // 2.2 Re-cacher le projet mis à jour
      await cacheService.set(CACHE_KEYS.PROJECT(projectId), updatedProjectData);
      
      // === PHASE 3: AJOUT DE STATISTIQUES ===
      
      const statisticsData = {
        costs: {
          claudeApi: 2.50,
          storage: 0.10,
          compute: 0.05,
          total: 2.65,
        },
        performance: {
          generationTime: 45000,
          processingTime: 15000,
          totalTime: 60000,
        },
        usage: {
          documentsGenerated: 3,
          filesProcessed: 2,
          tokensUsed: 15000,
        },
        lastUpdated: new Date().toISOString(),
      };

      await cacheService.set(CACHE_KEYS.PROJECT_STATISTICS(projectId), statisticsData);
      
      // Vérifier les statistiques
      const cachedStats = await cacheService.get(CACHE_KEYS.PROJECT_STATISTICS(projectId));
      expect(cachedStats).toEqual(statisticsData);

      // === PHASE 4: CONSULTATION DU PROJET ===
      
      const consultations = 5;
      for (let i = 0; i < consultations; i++) {
        const projectFromCache = await cacheService.get(CACHE_KEYS.PROJECT(projectId));
        expect(projectFromCache).toEqual(updatedProjectData);
        
        const statsFromCache = await cacheService.get(CACHE_KEYS.PROJECT_STATISTICS(projectId));
        expect(statsFromCache).toEqual(statisticsData);
      }

      // === PHASE 5: ARCHIVAGE DU PROJET ===
      
      const archivedProjectData = {
        ...updatedProjectData,
        status: 'ARCHIVED',
        updatedAt: new Date().toISOString(),
      };

      // Invalider et remettre en cache
      await cacheService.invalidateProjectCache(projectId, userId);
      await cacheService.set(CACHE_KEYS.PROJECT(projectId), archivedProjectData);
      
      // Vérifier l'archivage
      const archivedProject = await cacheService.get(CACHE_KEYS.PROJECT(projectId));
      expect(archivedProject.status).toBe('ARCHIVED');

      // === PHASE 6: SUPPRESSION DU PROJET ===
      
      await cacheService.invalidateProjectCache(projectId, userId);
      
      // Vérifier que tout a été supprimé
      expect(await cacheService.get(CACHE_KEYS.PROJECT(projectId))).toBeNull();
      expect(await cacheService.get(CACHE_KEYS.PROJECT_STATISTICS(projectId))).toBeNull();
    }, E2E_TIMEOUT);

    it('should handle multiple projects per user workflow', async () => {
      const userId = 'multi-project-user';
      const projects = [
        {
          id: 'multi-project-1',
          name: 'First Project',
          status: 'ACTIVE',
        },
        {
          id: 'multi-project-2', 
          name: 'Second Project',
          status: 'ACTIVE',
        },
        {
          id: 'multi-project-3',
          name: 'Third Project', 
          status: 'ARCHIVED',
        },
      ];

      // === CRÉER PLUSIEURS PROJETS ===
      
      // Cache individuel de chaque projet
      for (const project of projects) {
        await cacheService.set(CACHE_KEYS.PROJECT(project.id), {
          ...project,
          ownerId: userId,
          createdAt: new Date().toISOString(),
        });
      }

      // Cache des listes avec pagination
      const allProjects = projects;

      await cacheService.set(CACHE_KEYS.PROJECT_LIST(userId, 1, 10), allProjects);
      await cacheService.set(CACHE_KEYS.USER_PROJECTS_COUNT(userId), projects.length);

      // === VÉRIFIER LES LISTES CACHÉES ===
      
      const cachedList = await cacheService.get(CACHE_KEYS.PROJECT_LIST(userId, 1, 10));
      expect(cachedList).toHaveLength(3);
      expect(cachedList).toEqual(allProjects);

      const cachedCount = await cacheService.get(CACHE_KEYS.USER_PROJECTS_COUNT(userId));
      expect(cachedCount).toBe(3);

      // === MODIFIER UN PROJET SPÉCIFIQUE ===
      
      const projectToUpdate = 'multi-project-2';
      await cacheService.invalidateProjectCache(projectToUpdate, userId);

      // Vérifier que seul le projet modifié et les listes sont invalidés
      expect(await cacheService.get(CACHE_KEYS.PROJECT(projectToUpdate))).toBeNull();
      expect(await cacheService.get(CACHE_KEYS.PROJECT_LIST(userId, 1, 10))).toBeNull();
      expect(await cacheService.get(CACHE_KEYS.USER_PROJECTS_COUNT(userId))).toBeNull();

      // Les autres projets restent en cache
      expect(await cacheService.get(CACHE_KEYS.PROJECT('multi-project-1'))).toBeTruthy();
      expect(await cacheService.get(CACHE_KEYS.PROJECT('multi-project-3'))).toBeTruthy();

      // === INVALIDER TOUT LE CACHE UTILISATEUR ===
      
      await cacheService.invalidateUserProjectsCache(userId);

      // Vérifier que les listes de projets sont invalidées
      expect(await cacheService.get(CACHE_KEYS.PROJECT_LIST(userId, 1, 10))).toBeNull();
      // USER_PROJECTS_COUNT n'est PAS supprimé par invalidateUserProjectsCache
      expect(await cacheService.get(CACHE_KEYS.USER_PROJECTS_COUNT(userId))).toBeNull(); // Déjà supprimé par invalidateProjectCache précédent
    }, E2E_TIMEOUT);
  });

  describe('Statistics Cache Workflow', () => {
    it('should handle statistics updates and aggregation workflow', async () => {
      const projectId = 'stats-workflow-project';
      
      // === ÉTAPE 1: STATISTIQUES INITIALES ===
      const initialStats = {
        costs: { total: 0 },
        performance: { generationTime: 0 },
        usage: { tokensUsed: 0 },
        lastUpdated: new Date().toISOString(),
      };

      await cacheService.set(CACHE_KEYS.PROJECT_STATISTICS(projectId), initialStats);

      // === ÉTAPE 2: MISE À JOUR INCRÉMENTALE DES COÛTS ===
      const costUpdate = {
        costs: { claudeApi: 1.25, storage: 0.05, total: 1.30 },
        performance: { generationTime: 30000 },
        usage: { tokensUsed: 8000, documentsGenerated: 1 },
        lastUpdated: new Date().toISOString(),
      };

      await cacheService.set(CACHE_KEYS.PROJECT_STATISTICS(projectId), costUpdate);
      
      let stats = await cacheService.get(CACHE_KEYS.PROJECT_STATISTICS(projectId));
      expect(stats.costs.total).toBe(1.30);
      expect(stats.usage.tokensUsed).toBe(8000);

      // === ÉTAPE 3: MISE À JOUR APRÈS GÉNÉRATION SUPPLÉMENTAIRE ===
      const additionalGeneration = {
        costs: { claudeApi: 2.75, storage: 0.12, compute: 0.08, total: 2.95 },
        performance: { 
          generationTime: 75000, 
          processingTime: 25000,
          totalTime: 100000 
        },
        usage: { 
          tokensUsed: 18500, 
          documentsGenerated: 3,
          filesProcessed: 2 
        },
        lastUpdated: new Date().toISOString(),
      };

      await cacheService.set(CACHE_KEYS.PROJECT_STATISTICS(projectId), additionalGeneration);
      
      stats = await cacheService.get(CACHE_KEYS.PROJECT_STATISTICS(projectId));
      expect(stats.costs.total).toBe(2.95);
      expect(stats.usage.documentsGenerated).toBe(3);
      expect(stats.performance.totalTime).toBe(100000);

      // === ÉTAPE 4: CONSULTATION RÉPÉTÉE (PERFORMANCE) ===
      const consultationStart = Date.now();
      
      for (let i = 0; i < 10; i++) {
        const cachedStats = await cacheService.get(CACHE_KEYS.PROJECT_STATISTICS(projectId));
        expect(cachedStats).toEqual(additionalGeneration);
      }
      
      const consultationTime = Date.now() - consultationStart;
      expect(consultationTime).toBeLessThan(100); // Moins de 100ms pour 10 consultations

      // === ÉTAPE 5: INVALIDATION LORS DE SUPPRESSION PROJET ===
      const userId = 'stats-project-owner';
      await cacheService.invalidateProjectCache(projectId, userId);
      
      expect(await cacheService.get(CACHE_KEYS.PROJECT_STATISTICS(projectId))).toBeNull();
    }, E2E_TIMEOUT);
  });

  describe('Export Cache Workflow', () => {
    it('should handle export status caching workflow', async () => {
      const exportId = 'export-123';
      const projectId = 'export-project-456';
      
      // === ÉTAPE 1: DÉMARRAGE DE L'EXPORT ===
      const exportStartStatus = {
        status: 'STARTED',
        progress: 0,
        startedAt: new Date().toISOString(),
        projectId,
        format: 'pdf',
      };

      await cacheService.set(CACHE_KEYS.EXPORT_STATUS(exportId), exportStartStatus, 1800); // 30 min TTL
      
      let status = await cacheService.get(CACHE_KEYS.EXPORT_STATUS(exportId));
      expect(status.status).toBe('STARTED');
      expect(status.progress).toBe(0);

      // === ÉTAPE 2: PROGRESSION DE L'EXPORT ===
      const progressStatuses = [
        { status: 'PROCESSING', progress: 25, step: 'Retrieving files' },
        { status: 'PROCESSING', progress: 50, step: 'Converting to PDF' },
        { status: 'PROCESSING', progress: 75, step: 'Generating download link' },
      ];

      for (const progressStatus of progressStatuses) {
        const updatedStatus = {
          ...exportStartStatus,
          ...progressStatus,
          updatedAt: new Date().toISOString(),
        };
        
        await cacheService.set(CACHE_KEYS.EXPORT_STATUS(exportId), updatedStatus, 1800);
        
        status = await cacheService.get(CACHE_KEYS.EXPORT_STATUS(exportId));
        expect(status.progress).toBe(progressStatus.progress);
        expect(status.step).toBe(progressStatus.step);
      }

      // === ÉTAPE 3: COMPLETION DE L'EXPORT ===
      const completedStatus = {
        ...exportStartStatus,
        status: 'COMPLETED',
        progress: 100,
        downloadUrl: 'https://storage.example.com/exports/export-123.pdf',
        fileSize: 2048576, // 2MB
        completedAt: new Date().toISOString(),
      };

      await cacheService.set(CACHE_KEYS.EXPORT_STATUS(exportId), completedStatus, 1800);
      
      status = await cacheService.get(CACHE_KEYS.EXPORT_STATUS(exportId));
      expect(status.status).toBe('COMPLETED');
      expect(status.downloadUrl).toBeTruthy();
      expect(status.fileSize).toBe(2048576);

      // === ÉTAPE 4: CONSULTATIONS RÉPÉTÉES DU STATUT ===
      for (let i = 0; i < 5; i++) {
        const polledStatus = await cacheService.get(CACHE_KEYS.EXPORT_STATUS(exportId));
        expect(polledStatus.status).toBe('COMPLETED');
        expect(polledStatus.downloadUrl).toBeTruthy();
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // === ÉTAPE 5: EXPIRATION AUTOMATIQUE ===
      // Attendre un peu pour que la clé soit effectivement créée
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Vérifier que la clé existe et a un TTL positif
      const fullKey = `${cacheService.getKeyPrefix()}${CACHE_KEYS.EXPORT_STATUS(exportId)}`;
      const exists = await redis.exists(fullKey);
      expect(exists).toBe(1);
      
      const ttl = await redis.ttl(fullKey);
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(1800);
    }, E2E_TIMEOUT);
  });

  describe('Rate Limiting Cache Workflow', () => {
    it('should handle rate limiting with cache', async () => {
      const userId = 'rate-limit-user';
      const action = 'project-creation';
      
      // === SIMULER DES TENTATIVES D'ACTION ===
      const maxAttempts = 5;
      const windowMinutes = 60;
      
      // Première tentative
      const firstAttempt = {
        count: 1,
        firstAttempt: new Date().toISOString(),
        lastAttempt: new Date().toISOString(),
      };
      
      await cacheService.set(
        CACHE_KEYS.RATE_LIMIT(userId, action), 
        firstAttempt, 
        windowMinutes * 60
      );
      
      let rateLimitData = await cacheService.get(CACHE_KEYS.RATE_LIMIT(userId, action));
      expect(rateLimitData.count).toBe(1);

      // Tentatives supplémentaires
      for (let i = 2; i <= maxAttempts; i++) {
        const updatedAttempt = {
          ...rateLimitData,
          count: i,
          lastAttempt: new Date().toISOString(),
        };
        
        await cacheService.set(
          CACHE_KEYS.RATE_LIMIT(userId, action), 
          updatedAttempt, 
          windowMinutes * 60
        );
        
        rateLimitData = await cacheService.get(CACHE_KEYS.RATE_LIMIT(userId, action));
        expect(rateLimitData.count).toBe(i);
      }

      // === VÉRIFIER LA LIMITE ATTEINTE ===
      expect(rateLimitData.count).toBe(maxAttempts);
      
      // Tentative supplémentaire (devrait être rejetée)
      const shouldBeRejected = rateLimitData.count >= maxAttempts;
      expect(shouldBeRejected).toBe(true);

      // === VÉRIFIER L'EXPIRATION ===
      // Attendre un peu pour que la clé soit effectivement créée
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const fullKey = `${cacheService.getKeyPrefix()}${CACHE_KEYS.RATE_LIMIT(userId, action)}`;
      const exists = await redis.exists(fullKey);
      expect(exists).toBe(1);
      
      const ttl = await redis.ttl(fullKey);
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(windowMinutes * 60);
    }, E2E_TIMEOUT);
  });

  describe('Cache Performance and Monitoring', () => {
    it('should demonstrate cache performance benefits', async () => {
      const projectId = 'performance-test-project';
      const complexProjectData = {
        id: projectId,
        name: 'Performance Test Project',
        description: 'A'.repeat(1000), // Large description
        metadata: {
          tags: Array(100).fill(0).map((_, i) => `tag-${i}`),
          properties: Array(50).fill(0).reduce((acc, _, i) => {
            acc[`prop-${i}`] = `value-${i}`.repeat(10);
            return acc;
          }, {}),
        },
        files: Array(20).fill(0).map((_, i) => ({
          id: `file-${i}`,
          name: `document-${i}.pdf`,
          size: Math.floor(Math.random() * 1000000),
        })),
      };

      // === PREMIÈRE CONSULTATION (CACHE MISS) ===
      const missStart = Date.now();
      
      // Simuler la récupération depuis la base (plus lente)
      await new Promise(resolve => setTimeout(resolve, 100)); // Simuler 100ms de DB
      await cacheService.set(CACHE_KEYS.PROJECT(projectId), complexProjectData);
      
      const missTime = Date.now() - missStart;

      // === CONSULTATIONS SUIVANTES (CACHE HIT) ===
      const hitTimes: number[] = [];
      
      for (let i = 0; i < 10; i++) {
        const hitStart = Date.now();
        const cachedData = await cacheService.get(CACHE_KEYS.PROJECT(projectId));
        const hitTime = Date.now() - hitStart;
        
        hitTimes.push(hitTime);
        expect(cachedData).toEqual(complexProjectData);
      }

      const avgHitTime = hitTimes.reduce((a, b) => a + b, 0) / hitTimes.length;
      
      // Le cache doit être significativement plus rapide
      expect(avgHitTime).toBeLessThan(missTime / 2);
      expect(avgHitTime).toBeLessThan(50); // Moins de 50ms en moyenne
    }, E2E_TIMEOUT);

    it('should handle cache monitoring data collection', async () => {
      const monitoringData = {
        cacheHits: 0,
        cacheMisses: 0,
        averageResponseTime: 0,
        memoryUsage: 0,
      };

      // Simuler des opérations avec monitoring
      const operations = [
        { type: 'SET', key: 'monitor:1', value: { data: 'test1' } },
        { type: 'GET', key: 'monitor:1' }, // HIT
        { type: 'GET', key: 'monitor:2' }, // MISS
        { type: 'SET', key: 'monitor:2', value: { data: 'test2' } },
        { type: 'GET', key: 'monitor:2' }, // HIT
        { type: 'GET', key: 'monitor:1' }, // HIT
      ];

      for (const op of operations) {
        const start = Date.now();
        
        if (op.type === 'SET') {
          await cacheService.set(op.key, op.value);
        } else {
          const result = await cacheService.get(op.key);
          
          if (result !== null) {
            monitoringData.cacheHits++;
          } else {
            monitoringData.cacheMisses++;
          }
        }
        
        const responseTime = Date.now() - start;
        monitoringData.averageResponseTime = 
          (monitoringData.averageResponseTime + responseTime) / 2;
      }

      // Vérifier les métriques de monitoring
      expect(monitoringData.cacheHits).toBe(3); // 3 hits
      expect(monitoringData.cacheMisses).toBe(1); // 1 miss
      expect(monitoringData.averageResponseTime).toBeGreaterThan(0);
      
      const hitRate = monitoringData.cacheHits / (monitoringData.cacheHits + monitoringData.cacheMisses);
      expect(hitRate).toBe(0.75); // 75% hit rate
    }, E2E_TIMEOUT);
  });
});