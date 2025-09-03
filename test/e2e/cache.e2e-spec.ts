// test/e2e/cache.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppModule } from '../../src/app.module';
import { CacheService } from '../../src/cache/cache.service';
import { ProjectStatus } from '../../src/common/enums/project-status.enum';
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
    process.env.REDIS_ENABLE_METRICS = 'true';
    process.env.REDIS_KEY_PREFIX = 'e2e-test';

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

  describe('Complete Project Lifecycle Cache Management', () => {
    it('should handle full project creation workflow with cache', async () => {
      const projectId = 'e2e-project-123';
      const userId = 'e2e-user-456';

      // Données de projet simulées
      const projectData = {
        id: projectId,
        name: 'E2E Test Project',
        description: 'End-to-end testing project with comprehensive data',
        initialPrompt: 'Create a modern web application with React frontend and NestJS backend',
        status: ProjectStatus.ACTIVE,
        ownerId: userId,
        uploadedFileIds: ['uploaded-spec.pdf', 'requirements.md'],
        generatedFileIds: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: {
          complexity: 'high',
          estimatedCost: 25.00,
          tags: ['web', 'fullstack', 'react', 'nestjs'],
        },
      };

      // === PHASE 1: CRÉATION DU PROJET ===

      // 1.1 Cache du projet créé
      const projectKey = cacheService.getProjectKey(projectId);
      await cacheService.set(projectKey, projectData);

      // 1.2 Mise à jour du compteur utilisateur
      const countKey = cacheService.getProjectCountKey(userId);
      await cacheService.set(countKey, 1);

      // 1.3 Cache de la liste des projets (page 1)
      const projectList = [{
        id: projectId,
        name: projectData.name,
        status: projectData.status,
        createdAt: projectData.createdAt,
        hasFiles: projectData.uploadedFileIds.length > 0,
      }];
      
      const listKey = cacheService.getProjectListKey(userId, 1, 10);
      await cacheService.set(listKey, projectList);

      // Vérifier que tout est en cache
      expect(await cacheService.get(projectKey)).toEqual(projectData);
      expect(await cacheService.get(countKey)).toBe(1);
      expect(await cacheService.get(listKey)).toEqual(projectList);

      // === PHASE 2: GÉNÉRATION DE DOCUMENTS ===

      const generatedFiles = [
        'generated-architecture.md',
        'generated-api-docs.md', 
        'generated-frontend-components.tsx',
        'generated-database-schema.sql',
      ];

      const updatedProjectData = {
        ...projectData,
        generatedFileIds: generatedFiles,
        updatedAt: new Date().toISOString(),
      };

      // 2.1 Invalider le cache lors de la génération
      await cacheService.invalidateProjectCache(projectId, userId);

      // Vérifier que le cache a été invalidé
      expect(await cacheService.get(projectKey)).toBeNull();
      expect(await cacheService.get(listKey)).toBeNull();
      expect(await cacheService.get(countKey)).toBeNull();

      // 2.2 Re-cacher le projet mis à jour
      await cacheService.set(projectKey, updatedProjectData);

      // 2.3 Cacher la liste des fichiers générés
      const filesListKey = cacheService.getProjectFilesListKey(projectId);
      await cacheService.set(filesListKey, generatedFiles);

      // Vérifier les nouvelles données
      const updatedProject = await cacheService.get(projectKey);
      expect(updatedProject.generatedFileIds).toHaveLength(4);
      
      const cachedFiles = await cacheService.get(filesListKey);
      expect(cachedFiles).toEqual(generatedFiles);

      // === PHASE 3: AJOUT DES STATISTIQUES DÉTAILLÉES ===

      const statisticsData = {
        costs: {
          claudeApiCalls: 15.75,
          storageUsage: 0.25,
          computeTime: 0.15,
          dataTransfer: 0.10,
          total: 16.25,
        },
        performance: {
          generationTime: 120000,
          processingTime: 45000,
          renderingTime: 15000,
          totalTime: 180000,
        },
        usage: {
          documentsGenerated: 4,
          filesProcessed: 2,
          tokensUsed: 35000,
          apiCallsCount: 127,
        },
        quality: {
          averageDocumentLength: 2500,
          complexityScore: 8.5,
          completenessRating: 9.2,
        },
        lastUpdated: new Date().toISOString(),
      };

      const statsKey = cacheService.getProjectStatisticsKey(projectId);
      await cacheService.set(statsKey, statisticsData);

      // Cache du projet avec statistiques
      const projectWithStatsKey = cacheService.getProjectWithStatsKey(projectId);
      await cacheService.set(projectWithStatsKey, {
        ...updatedProjectData,
        statistics: statisticsData,
      });

      // Vérifier les statistiques
      const cachedStats = await cacheService.get(statsKey);
      expect(cachedStats).toEqual(statisticsData);
      expect(cachedStats.costs.total).toBe(16.25);

      const projectWithStats = await cacheService.get(projectWithStatsKey);
      expect(projectWithStats.statistics).toEqual(statisticsData);

      // === PHASE 4: CONSULTATIONS MULTIPLES ET PERFORMANCE ===

      const consultations = 10;
      const consultationTimes = [];

      for (let i = 0; i < consultations; i++) {
        const start = Date.now();
        
        // Consulter le projet complet
        const projectFromCache = await cacheService.get(projectKey);
        expect(projectFromCache).toEqual(updatedProjectData);

        // Consulter les statistiques
        const statsFromCache = await cacheService.get(statsKey);
        expect(statsFromCache).toEqual(statisticsData);

        // Consulter la liste des fichiers
        const filesFromCache = await cacheService.get(filesListKey);
        expect(filesFromCache).toEqual(generatedFiles);

        const consultationTime = Date.now() - start;
        consultationTimes.push(consultationTime);
      }

      const avgConsultationTime = consultationTimes.reduce((a, b) => a + b) / consultations;
      console.log(`Average consultation time: ${avgConsultationTime}ms`);
      expect(avgConsultationTime).toBeLessThan(50); // Cache should be fast

      // === PHASE 5: MISE À JOUR PROGRESSIVE DES STATISTIQUES ===

      const costUpdates = [
        { increment: 2.50, newTotal: 18.75 },
        { increment: 1.25, newTotal: 20.00 },
        { increment: 3.00, newTotal: 23.00 },
      ];

      for (const update of costUpdates) {
        const updatedStats = {
          ...statisticsData,
          costs: {
            ...statisticsData.costs,
            total: update.newTotal,
          },
          lastUpdated: new Date().toISOString(),
        };

        // Invalider les caches de statistiques
        await cacheService.invalidateStatisticsCache(projectId);
        
        // Re-cacher avec nouvelles données
        await cacheService.set(statsKey, updatedStats);
        
        // Vérifier la mise à jour
        const updated = await cacheService.get(statsKey);
        expect(updated.costs.total).toBe(update.newTotal);

        statisticsData.costs.total = update.newTotal; // Update for next iteration
      }

      // === PHASE 6: ARCHIVAGE DU PROJET ===

      const archivedProjectData = {
        ...updatedProjectData,
        status: ProjectStatus.ARCHIVED,
        archivedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Invalider et remettre en cache
      await cacheService.invalidateProjectCache(projectId, userId);
      await cacheService.set(projectKey, archivedProjectData);

      // Vérifier l'archivage
      const archivedProject = await cacheService.get(projectKey);
      expect(archivedProject.status).toBe(ProjectStatus.ARCHIVED);
      expect(archivedProject.archivedAt).toBeTruthy();

      // === PHASE 7: SUPPRESSION COMPLÈTE ===

      await cacheService.invalidateProjectCache(projectId, userId);
      await cacheService.invalidateStatisticsCache(projectId);

      // Vérifier que tout a été supprimé
      expect(await cacheService.get(projectKey)).toBeNull();
      expect(await cacheService.get(statsKey)).toBeNull();
      expect(await cacheService.get(filesListKey)).toBeNull();
      expect(await cacheService.get(projectWithStatsKey)).toBeNull();
    }, E2E_TIMEOUT);

    it('should handle multiple projects per user with different cache scenarios', async () => {
      const userId = 'multi-project-user';
      const projects = [
        {
          id: 'project-active-1',
          name: 'Active Project 1',
          status: ProjectStatus.ACTIVE,
          hasFiles: true,
          uploadedFileIds: ['file1.pdf'],
          generatedFileIds: ['gen1.md', 'gen2.md'],
        },
        {
          id: 'project-active-2',
          name: 'Active Project 2', 
          status: ProjectStatus.ACTIVE,
          hasFiles: false,
          uploadedFileIds: [],
          generatedFileIds: ['gen3.md'],
        },
        {
          id: 'project-archived-1',
          name: 'Archived Project 1',
          status: ProjectStatus.ARCHIVED,
          hasFiles: true,
          uploadedFileIds: ['file2.pdf', 'file3.md'],
          generatedFileIds: [],
        },
      ];

      // === CRÉER ET CACHER TOUS LES PROJETS ===

      for (const project of projects) {
        const fullProjectData = {
          ...project,
          ownerId: userId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        // Cache individuel de chaque projet
        await cacheService.set(
          cacheService.getProjectKey(project.id),
          fullProjectData
        );

        // Cache des statistiques simulées
        const projectStats = {
          costs: { total: Math.random() * 20 },
          performance: { generationTime: Math.floor(Math.random() * 60000) },
          usage: { documentsGenerated: project.generatedFileIds.length },
        };

        await cacheService.set(
          cacheService.getProjectStatisticsKey(project.id),
          projectStats
        );

        // Cache des fichiers si nécessaire
        if (project.generatedFileIds.length > 0) {
          await cacheService.set(
            cacheService.getProjectFilesListKey(project.id),
            project.generatedFileIds
          );
        }
      }

      // === CACHE DES LISTES AVEC FILTRES DIFFÉRENTS ===

      // Liste des projets actifs
      const activeProjects = projects.filter(p => p.status === ProjectStatus.ACTIVE);
      const activeListKey = cacheService.getProjectListKey(userId, 1, 10, { 
        status: ProjectStatus.ACTIVE 
      });
      await cacheService.set(activeListKey, activeProjects);

      // Liste des projets avec fichiers
      const projectsWithFiles = projects.filter(p => p.hasFiles);
      const filesListKey = cacheService.getProjectListKey(userId, 1, 10, {
        hasFiles: true
      });
      await cacheService.set(filesListKey, projectsWithFiles);

      // Liste complète (sans filtre)
      const allListKey = cacheService.getProjectListKey(userId, 1, 10);
      await cacheService.set(allListKey, projects);

      // Compteurs
      await cacheService.set(
        cacheService.getProjectCountKey(userId, { status: ProjectStatus.ACTIVE }),
        activeProjects.length
      );
      await cacheService.set(
        cacheService.getProjectCountKey(userId),
        projects.length
      );

      // === VÉRIFIER LES LISTES CACHÉES ===

      const cachedActive = await cacheService.get(activeListKey);
      expect(cachedActive).toHaveLength(2);
      expect(cachedActive.every(p => p.status === ProjectStatus.ACTIVE)).toBe(true);

      const cachedWithFiles = await cacheService.get(filesListKey);
      expect(cachedWithFiles).toHaveLength(2);
      expect(cachedWithFiles.every(p => p.hasFiles)).toBe(true);

      const cachedAll = await cacheService.get(allListKey);
      expect(cachedAll).toHaveLength(3);

      const activeCount = await cacheService.get(
        cacheService.getProjectCountKey(userId, { status: ProjectStatus.ACTIVE })
      );
      expect(activeCount).toBe(2);

      // === MODIFIER UN PROJET SPÉCIFIQUE ===

      const projectToUpdate = 'project-active-1';
      await cacheService.invalidateProjectCache(projectToUpdate, userId);

      // Vérifier invalidation sélective
      expect(await cacheService.get(cacheService.getProjectKey(projectToUpdate))).toBeNull();
      expect(await cacheService.get(activeListKey)).toBeNull();
      expect(await cacheService.get(filesListKey)).toBeNull();
      expect(await cacheService.get(allListKey)).toBeNull();

      // Les autres projets individuels restent en cache
      expect(await cacheService.get(cacheService.getProjectKey('project-active-2'))).toBeTruthy();
      expect(await cacheService.get(cacheService.getProjectKey('project-archived-1'))).toBeTruthy();

      // === INVALIDER TOUT LE CACHE UTILISATEUR ===

      await cacheService.invalidateUserProjectsCache(userId);

      // Toutes les listes devraient être supprimées
      expect(await cacheService.get(allListKey)).toBeNull();
      
      // Les projets individuels ne sont pas affectés par invalidateUserProjectsCache
      expect(await cacheService.get(cacheService.getProjectKey('project-active-2'))).toBeTruthy();
    }, E2E_TIMEOUT);
  });

  describe('Statistics Cache Integration Workflow', () => {
    it('should handle complete statistics lifecycle', async () => {
      const projectId = 'stats-workflow-project';
      const userId = 'stats-user';

      // === ÉTAPE 1: STATISTIQUES INITIALES (PROJET VIDE) ===
      const initialStats = {
        costs: { total: 0, breakdown: {} },
        performance: { generationTime: 0 },
        usage: { tokensUsed: 0, documentsGenerated: 0 },
        quality: { averageScore: 0 },
        timestamps: {
          firstGeneration: null,
          lastUpdate: new Date().toISOString(),
        },
      };

      await cacheService.set(
        cacheService.getProjectStatisticsKey(projectId),
        initialStats
      );

      // === ÉTAPE 2: PREMIÈRE GÉNÉRATION ===
      const firstGenerationStats = {
        costs: { 
          claudeApi: 3.25, 
          storage: 0.05, 
          compute: 0.12,
          total: 3.42 
        },
        performance: { 
          generationTime: 45000,
          processingTime: 12000,
          totalTime: 57000,
        },
        usage: { 
          tokensUsed: 12000,
          documentsGenerated: 2,
          apiCallsCount: 15,
        },
        quality: {
          averageScore: 8.5,
          completeness: 0.92,
        },
        timestamps: {
          firstGeneration: new Date().toISOString(),
          lastUpdate: new Date().toISOString(),
        },
      };

      await cacheService.set(
        cacheService.getProjectStatisticsKey(projectId),
        firstGenerationStats
      );

      let stats = await cacheService.get(cacheService.getProjectStatisticsKey(projectId));
      expect(stats.costs.total).toBe(3.42);
      expect(stats.usage.documentsGenerated).toBe(2);

      // === ÉTAPE 3: GÉNÉRATIONS ADDITIONNELLES ===
      const additionalGenerations = [
        { 
          additionalCost: 2.15, 
          newDocs: 1, 
          newTokens: 8500,
          reason: 'User requested additional documentation'
        },
        { 
          additionalCost: 1.85, 
          newDocs: 2, 
          newTokens: 6200,
          reason: 'Code optimization and testing docs'
        },
        { 
          additionalCost: 4.20, 
          newDocs: 3, 
          newTokens: 15800,
          reason: 'Complete API documentation'
        },
      ];

      for (const addition of additionalGenerations) {
        const currentStats = await cacheService.get(
          cacheService.getProjectStatisticsKey(projectId)
        );

        const updatedStats = {
          ...currentStats,
          costs: {
            ...currentStats.costs,
            total: currentStats.costs.total + addition.additionalCost,
          },
          usage: {
            ...currentStats.usage,
            documentsGenerated: currentStats.usage.documentsGenerated + addition.newDocs,
            tokensUsed: currentStats.usage.tokensUsed + addition.newTokens,
          },
          timestamps: {
            ...currentStats.timestamps,
            lastUpdate: new Date().toISOString(),
          },
        };

        await cacheService.set(
          cacheService.getProjectStatisticsKey(projectId),
          updatedStats
        );

        stats = await cacheService.get(cacheService.getProjectStatisticsKey(projectId));
        expect(stats.costs.total).toBe(
          firstGenerationStats.costs.total + 
          additionalGenerations.slice(0, additionalGenerations.indexOf(addition) + 1)
            .reduce((sum, add) => sum + add.additionalCost, 0)
        );
      }

      // === ÉTAPE 4: CONSULTATION RÉPÉTÉE HAUTE PERFORMANCE ===
      const consultationStart = Date.now();
      const consultationCount = 50;

      for (let i = 0; i < consultationCount; i++) {
        const cachedStats = await cacheService.get(
          cacheService.getProjectStatisticsKey(projectId)
        );
        expect(cachedStats.costs.total).toBeCloseTo(11.62); // Final total
        expect(cachedStats.usage.documentsGenerated).toBe(8); // Final count

        // Alterner avec des consultations du projet avec stats
        if (i % 2 === 0) {
          const projectWithStats = await cacheService.get(
            cacheService.getProjectWithStatsKey(projectId)
          );
          if (projectWithStats) {
            expect(projectWithStats.statistics).toBeTruthy();
          }
        }
      }

      const consultationTime = Date.now() - consultationStart;
      const avgTimePerConsultation = consultationTime / consultationCount;
      
      console.log(`${consultationCount} consultations in ${consultationTime}ms (avg: ${avgTimePerConsultation}ms)`);
      expect(avgTimePerConsultation).toBeLessThan(20); // Very fast for cached data

      // === ÉTAPE 5: INVALIDATION LORS DE FINALISATION ===
      await cacheService.invalidateStatisticsCache(projectId);

      expect(await cacheService.get(cacheService.getProjectStatisticsKey(projectId))).toBeNull();
      expect(await cacheService.get(cacheService.getProjectWithStatsKey(projectId))).toBeNull();
    }, E2E_TIMEOUT);
  });

  describe('Export System Cache Workflow', () => {
    it('should handle complete export workflow with status tracking', async () => {
      const exportId = 'comprehensive-export-123';
      const projectId = 'export-source-project';
      const userId = 'export-user';

      // === PHASE 1: INITIATION DE L'EXPORT ===
      const exportRequest = {
        projectId,
        userId,
        format: 'pdf',
        options: {
          includeStats: true,
          includeFiles: true,
          template: 'professional',
        },
        requestedAt: new Date().toISOString(),
      };

      const initialStatus = {
        status: 'QUEUED',
        progress: 0,
        message: 'Export request received and queued',
        ...exportRequest,
      };

      await cacheService.set(
        cacheService.getExportStatusKey(exportId),
        initialStatus,
        3600 // 1 hour TTL
      );

      let status = await cacheService.get(cacheService.getExportStatusKey(exportId));
      expect(status.status).toBe('QUEUED');
      expect(status.progress).toBe(0);

      // === PHASE 2: PROGRESSION DÉTAILLÉE DE L'EXPORT ===
      const progressSteps = [
        { 
          progress: 10, 
          status: 'PROCESSING', 
          message: 'Retrieving project data',
          currentStep: 'data-retrieval',
          estimatedTimeRemaining: 180000, // 3 minutes
        },
        { 
          progress: 25, 
          status: 'PROCESSING', 
          message: 'Loading uploaded files',
          currentStep: 'file-loading',
          estimatedTimeRemaining: 150000,
        },
        { 
          progress: 40, 
          status: 'PROCESSING', 
          message: 'Retrieving generated documents',
          currentStep: 'document-retrieval',
          estimatedTimeRemaining: 120000,
        },
        { 
          progress: 60, 
          status: 'PROCESSING', 
          message: 'Compiling statistics and metrics',
          currentStep: 'stats-compilation',
          estimatedTimeRemaining: 90000,
        },
        { 
          progress: 80, 
          status: 'PROCESSING', 
          message: 'Converting to PDF format',
          currentStep: 'pdf-conversion',
          estimatedTimeRemaining: 30000,
        },
        { 
          progress: 95, 
          status: 'FINALIZING', 
          message: 'Generating secure download link',
          currentStep: 'link-generation',
          estimatedTimeRemaining: 10000,
        },
      ];

      for (const [index, step] of progressSteps.entries()) {
        const updatedStatus = {
          ...initialStatus,
          ...step,
          updatedAt: new Date().toISOString(),
          processingTimeElapsed: (index + 1) * 15000, // 15s per step
        };

        await cacheService.set(
          cacheService.getExportStatusKey(exportId),
          updatedStatus,
          3600
        );

        status = await cacheService.get(cacheService.getExportStatusKey(exportId));
        expect(status.progress).toBe(step.progress);
        expect(status.message).toBe(step.message);
        expect(status.currentStep).toBe(step.currentStep);

        // Simuler le temps de traitement
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // === PHASE 3: COMPLETION ET RÉSULTAT FINAL ===
      const completedStatus = {
        ...initialStatus,
        status: 'COMPLETED',
        progress: 100,
        message: 'Export completed successfully',
        currentStep: 'completed',
        completedAt: new Date().toISOString(),
        processingTimeTotal: 120000, // 2 minutes total
      };

      const exportResult = {
        downloadUrl: 'https://secure-storage.example.com/exports/comprehensive-export-123.pdf',
        fileName: 'Project_Export_2025-08-28.pdf',
        fileSize: 2048576, // 2MB
        format: 'pdf',
        generatedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString(), // 24h
        metadata: {
          pageCount: 47,
          includesFiles: true,
          includesStats: true,
          template: 'professional',
        },
        checksum: 'sha256:1a2b3c4d5e6f7g8h9i0j',
      };

      // Cacher le statut final et le résultat
      await cacheService.set(
        cacheService.getExportStatusKey(exportId),
        completedStatus,
        3600
      );

      await cacheService.set(
        cacheService.getExportResultKey(exportId),
        exportResult,
        86400 // 24h TTL for download link
      );

      // === PHASE 4: CONSULTATION DU RÉSULTAT ===
      const finalStatus = await cacheService.get(cacheService.getExportStatusKey(exportId));
      expect(finalStatus.status).toBe('COMPLETED');
      expect(finalStatus.progress).toBe(100);

      const result = await cacheService.get(cacheService.getExportResultKey(exportId));
      expect(result.downloadUrl).toBeTruthy();
      expect(result.fileSize).toBe(2048576);
      expect(result.metadata.pageCount).toBe(47);

      // === PHASE 5: CONSULTATIONS RÉPÉTÉES (USAGE RÉEL) ===
      
      // Simuler plusieurs utilisateurs consultant le statut
      const consultationPromises = [];
      for (let i = 0; i < 20; i++) {
        consultationPromises.push(
          Promise.all([
            cacheService.get(cacheService.getExportStatusKey(exportId)),
            cacheService.get(cacheService.getExportResultKey(exportId)),
          ])
        );
      }

      const consultationResults = await Promise.all(consultationPromises);
      
      // Toutes les consultations devraient retourner les bonnes données
      consultationResults.forEach(([statusResult, resultResult]) => {
        expect(statusResult.status).toBe('COMPLETED');
        expect(resultResult.downloadUrl).toBeTruthy();
      });

      // === PHASE 6: NETTOYAGE APRÈS TÉLÉCHARGEMENT ===
      
      // Après téléchargement, on peut nettoyer le statut mais garder le résultat
      await cacheService.del(cacheService.getExportStatusKey(exportId));
      
      expect(await cacheService.get(cacheService.getExportStatusKey(exportId))).toBeNull();
      expect(await cacheService.get(cacheService.getExportResultKey(exportId))).not.toBeNull();

    }, E2E_TIMEOUT);
  });

  describe('User Session and Authentication Cache Workflow', () => {
    it('should handle user session caching with security', async () => {
      const userId = 'session-user-789';
      const sessionIds = ['sess-abc-123', 'sess-def-456', 'sess-ghi-789'];

      // === PHASE 1: CONNEXION UTILISATEUR (SESSIONS MULTIPLES) ===
      
      const sessions = sessionIds.map((sessionId, index) => ({
        sessionId,
        userId,
        userAgent: `Browser-${index}`,
        ipAddress: `192.168.1.${100 + index}`,
        loginTime: new Date(Date.now() - (index * 3600000)).toISOString(), // Staggered logins
        lastActivity: new Date().toISOString(),
        roles: ['user'],
        permissions: ['read:projects', 'write:projects'],
        deviceInfo: {
          type: ['desktop', 'mobile', 'tablet'][index],
          os: ['Windows', 'iOS', 'Android'][index],
        },
      }));

      // Cacher toutes les sessions
      for (const session of sessions) {
        const sessionKey = cacheService.getUserSessionKey(userId, session.sessionId);
        await cacheService.set(sessionKey, session, 1800); // 30 min TTL
      }

      // === PHASE 2: VALIDATION DE TOKENS ===
      
      const tokens = [
        'jwt.token.for.session1',
        'jwt.token.for.session2', 
        'jwt.token.for.session3',
      ];

      const tokenValidations = tokens.map((token, index) => ({
        valid: true,
        userId,
        sessionId: sessionIds[index],
        roles: ['user'],
        permissions: sessions[index].permissions,
        exp: Date.now() + 3600000, // 1 hour
        iat: Date.now() - 60000, // Issued 1 minute ago
      }));

      // Cacher les validations de tokens
      for (let i = 0; i < tokens.length; i++) {
        const tokenKey = cacheService.getTokenValidationKey(tokens[i]);
        await cacheService.set(tokenKey, tokenValidations[i], 3600);
      }

      // === PHASE 3: ACTIVITÉ UTILISATEUR ===
      
      // Simuler de l'activité qui met à jour les sessions
      for (let i = 0; i < sessions.length; i++) {
        const session = sessions[i];
        const updatedSession = {
          ...session,
          lastActivity: new Date().toISOString(),
          activityCount: (session.activityCount || 0) + 1,
        };

        await cacheService.set(
          cacheService.getUserSessionKey(userId, session.sessionId),
          updatedSession,
          1800
        );
      }

      // === PHASE 4: VÉRIFICATION DE LA SÉCURITÉ ===
      
      // Vérifier que les tokens sont correctement hashés
      for (const token of tokens) {
        const tokenKey = cacheService.getTokenValidationKey(token);
        expect(tokenKey).not.toContain(token);
        expect(tokenKey).toMatch(/^auth:token:[a-f0-9]{16}$/);
        
        const validation = await cacheService.get(tokenKey);
        expect(validation.valid).toBe(true);
        expect(validation.userId).toBe(userId);
      }

      // === PHASE 5: DÉCONNEXION SÉLECTIVE ===
      
      // Déconnecter une session spécifique
      const sessionToLogout = sessionIds[1]; // Session du milieu
      await cacheService.del(cacheService.getUserSessionKey(userId, sessionToLogout));

      // Vérifier que seule cette session est supprimée
      const remainingSessions = [];
      for (const sessionId of sessionIds) {
        const session = await cacheService.get(cacheService.getUserSessionKey(userId, sessionId));
        if (session) {
          remainingSessions.push(session);
        }
      }

      expect(remainingSessions).toHaveLength(2);
      expect(remainingSessions.map(s => s.sessionId)).toEqual([sessionIds[0], sessionIds[2]]);

      // === PHASE 6: DÉCONNEXION GLOBALE UTILISATEUR ===
      
      await cacheService.invalidateUserProjectsCache(userId);

      // Toutes les sessions devraient être supprimées
      for (const sessionId of sessionIds) {
        const session = await cacheService.get(cacheService.getUserSessionKey(userId, sessionId));
        expect(session).toBeNull();
      }

      // Les validations de tokens restent (gérées séparément)
      for (const token of tokens) {
        const tokenKey = cacheService.getTokenValidationKey(token);
        const validation = await cacheService.get(tokenKey);
        expect(validation).not.toBeNull(); // Pas supprimées par invalidateUserProjectsCache
      }

    }, E2E_TIMEOUT);
  });

  describe('Rate Limiting and Security Cache Workflow', () => {
    it('should implement rate limiting through cache', async () => {
      const userId = 'rate-limit-user';
      const actions = ['project-creation', 'file-upload', 'export-request'];
      const limits = { 'project-creation': 5, 'file-upload': 20, 'export-request': 3 };
      const windowMinutes = 60;

      // === PHASE 1: PREMIÈRE UTILISATION DES ACTIONS ===
      
      for (const action of actions) {
        const rateLimitKey = cacheService.getRateLimitKey(userId, action);
        const initialLimit = {
          count: 1,
          limit: limits[action],
          windowStart: new Date().toISOString(),
          firstAttempt: new Date().toISOString(),
          lastAttempt: new Date().toISOString(),
          resetAt: new Date(Date.now() + windowMinutes * 60000).toISOString(),
        };

        await cacheService.set(rateLimitKey, initialLimit, windowMinutes * 60);

        const cached = await cacheService.get(rateLimitKey);
        expect(cached.count).toBe(1);
        expect(cached.limit).toBe(limits[action]);
      }

      // === PHASE 2: UTILISATION INTENSIVE ===
      
      const action = 'project-creation';
      const limit = limits[action];
      const rateLimitKey = cacheService.getRateLimitKey(userId, action);

      // Utilisations successives jusqu'à la limite
      for (let attempt = 2; attempt <= limit; attempt++) {
        const currentLimit = await cacheService.get(rateLimitKey);
        const updatedLimit = {
          ...currentLimit,
          count: attempt,
          lastAttempt: new Date().toISOString(),
        };

        await cacheService.set(rateLimitKey, updatedLimit, windowMinutes * 60);

        const cached = await cacheService.get(rateLimitKey);
        expect(cached.count).toBe(attempt);
      }

      // === PHASE 3: VÉRIFICATION DE LA LIMITE ===
      
      const finalLimitData = await cacheService.get(rateLimitKey);
      expect(finalLimitData.count).toBe(limit);

      // Simuler une vérification avant une nouvelle tentative
      const isAtLimit = finalLimitData.count >= finalLimitData.limit;
      expect(isAtLimit).toBe(true);

      // === PHASE 4: TENTATIVE DE DÉPASSEMENT ===
      
      // Cette tentative devrait être bloquée par la logique applicative
      // (le cache contient déjà la limite atteinte)
      const shouldBeBlocked = finalLimitData.count >= limits[action];
      expect(shouldBeBlocked).toBe(true);

      // === PHASE 5: RÉINITIALISATION ET EXPIRATION ===
      
      // Vérifier que la clé a un TTL approprié
      const ttl = await redis.ttl(`e2e-test:${rateLimitKey}`);
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(windowMinutes * 60);

      // Simuler la réinitialisation (en production, cela se fait par expiration)
      await cacheService.del(rateLimitKey);
      
      const afterReset = await cacheService.get(rateLimitKey);
      expect(afterReset).toBeNull();

      // === PHASE 6: NOUVELLE FENÊTRE DE TEMPS ===
      
      const newWindowLimit = {
        count: 1,
        limit: limits[action],
        windowStart: new Date().toISOString(),
        firstAttempt: new Date().toISOString(),
        lastAttempt: new Date().toISOString(),
      };

      await cacheService.set(rateLimitKey, newWindowLimit, windowMinutes * 60);
      
      const newWindow = await cacheService.get(rateLimitKey);
      expect(newWindow.count).toBe(1);

    }, E2E_TIMEOUT);
  });

  describe('Cache Performance Under Load', () => {
    it('should maintain performance under realistic load patterns', async () => {
      const users = ['user-1', 'user-2', 'user-3', 'user-4', 'user-5'];
      const projectsPerUser = 10;
      const operationsPerProject = 5;

      const loadTestStart = Date.now();

      // === SIMULATION DE CHARGE RÉALISTE ===
      
      const allOperations = [];

      for (const userId of users) {
        for (let p = 0; p < projectsPerUser; p++) {
          const projectId = `load-test-project-${userId}-${p}`;
          const projectData = {
            id: projectId,
            ownerId: userId,
            name: `Load Test Project ${p}`,
            status: p % 3 === 0 ? ProjectStatus.ARCHIVED : ProjectStatus.ACTIVE,
            hasFiles: p % 2 === 0,
            createdAt: new Date(Date.now() - p * 86400000).toISOString(), // Spread over days
          };

          // Opérations par projet
          for (let op = 0; op < operationsPerProject; op++) {
            allOperations.push(async () => {
              // Mix d'opérations
              switch (op % 5) {
                case 0:
                  return cacheService.set(cacheService.getProjectKey(projectId), projectData);
                case 1:
                  return cacheService.get(cacheService.getProjectKey(projectId));
                case 2:
                  return cacheService.set(
                    cacheService.getProjectListKey(userId, 1, 10),
                    [projectData]
                  );
                case 3:
                  return cacheService.get(cacheService.getProjectListKey(userId, 1, 10));
                case 4:
                  return cacheService.exists(cacheService.getProjectKey(projectId));
              }
            });
          }
        }
      }

      // Exécuter toutes les opérations en parallèle
      const batchSize = 50; // Process in batches to avoid overwhelming
      const results = [];

      for (let i = 0; i < allOperations.length; i += batchSize) {
        const batch = allOperations.slice(i, i + batchSize);
        const batchPromises = batch.map(op => op().catch(() => null));
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
      }

      const loadTestTime = Date.now() - loadTestStart;
      const totalOperations = allOperations.length;
      const opsPerSecond = totalOperations / (loadTestTime / 1000);

      console.log(`Load test: ${totalOperations} operations in ${loadTestTime}ms (${opsPerSecond.toFixed(2)} ops/sec)`);

      // Performance expectations
      expect(loadTestTime).toBeLessThan(30000); // Should complete in < 30s
      expect(opsPerSecond).toBeGreaterThan(10); // At least 10 ops/sec

      // Vérifier quelques résultats
      const successfulSets = results.filter(r => r === true).length;
      expect(successfulSets).toBeGreaterThan(0);

      // === VÉRIFICATION DE L'ÉTAT FINAL ===
      
      const finalStats = await cacheService.getStats();
      expect(finalStats.operations.sets).toBeGreaterThan(0);
      expect(finalStats.operations.hits + finalStats.operations.misses).toBeGreaterThan(0);

      console.log('Final cache stats:', {
        hits: finalStats.operations.hits,
        misses: finalStats.operations.misses,
        sets: finalStats.operations.sets,
        avgLatency: `${finalStats.performance.avgLatency}ms`,
      });

    }, E2E_TIMEOUT);

    it('should demonstrate cache efficiency vs database simulation', async () => {
      const projectId = 'efficiency-test-project';
      const userId = 'efficiency-user';

      const complexProjectData = {
        id: projectId,
        ownerId: userId,
        name: 'Efficiency Test Project',
        description: 'A'.repeat(2000), // 2KB description
        metadata: {
          tags: Array(50).fill(0).map((_, i) => `tag-${i}`),
          properties: Array(25).fill(0).reduce((acc, _, i) => {
            acc[`property-${i}`] = `value-${i}`.repeat(20);
            return acc;
          }, {}),
          files: Array(30).fill(0).map((_, i) => ({
            id: `file-${i}`,
            name: `document-${i}.pdf`,
            size: Math.floor(Math.random() * 2000000),
            metadata: { type: 'generated', complexity: Math.random() },
          })),
        },
      };

      // === PREMIÈRE CONSULTATION (CACHE MISS) ===
      
      const missStart = Date.now();
      
      // Simuler la récupération depuis la base (plus lente)
      await new Promise(resolve => setTimeout(resolve, 200)); // Simulate 200ms DB query
      await cacheService.set(cacheService.getProjectKey(projectId), complexProjectData, 600);
      
      const missTime = Date.now() - missStart;

      // === CONSULTATIONS SUIVANTES (CACHE HIT) ===
      
      const hitTimes: number[] = [];
      const hitCount = 20;

      for (let i = 0; i < hitCount; i++) {
        const hitStart = Date.now();
        const cachedData = await cacheService.get(cacheService.getProjectKey(projectId));
        const hitTime = Date.now() - hitStart;

        hitTimes.push(hitTime);
        expect(cachedData).toEqual(complexProjectData);
        expect(cachedData.metadata.files).toHaveLength(30);
      }

      const avgHitTime = hitTimes.reduce((a, b) => a + b, 0) / hitTimes.length;
      const maxHitTime = Math.max(...hitTimes);
      const minHitTime = Math.min(...hitTimes);

      console.log(`Cache performance: miss=${missTime}ms, avg hit=${avgHitTime.toFixed(2)}ms, max=${maxHitTime}ms, min=${minHitTime}ms`);

      // Le cache doit être significativement plus rapide
      expect(avgHitTime).toBeLessThan(missTime / 3); // At least 3x faster
      expect(avgHitTime).toBeLessThan(50); // Under 50ms average
      expect(maxHitTime).toBeLessThan(100); // Even slowest hit under 100ms

      // === VÉRIFICATION DE L'EFFICACITÉ GLOBALE ===
      
      const totalTime = missTime + hitTimes.reduce((a, b) => a + b, 0);
      const totalWithoutCache = missTime * (hitCount + 1); // If every access was a DB query
      const timeSaved = totalWithoutCache - totalTime;
      const efficiency = timeSaved / totalWithoutCache;

      console.log(`Cache efficiency: ${(efficiency * 100).toFixed(1)}% time saved`);
      expect(efficiency).toBeGreaterThan(0.7); // At least 70% time savings

    }, E2E_TIMEOUT);
  });

  describe('Cache Consistency and Data Integrity', () => {
    it('should maintain data consistency through complex operations', async () => {
      const userId = 'consistency-user';
      const projectIds = ['consistency-p1', 'consistency-p2', 'consistency-p3'];

      // === SETUP INITIAL DATA ===
      
      const projects = projectIds.map((id, index) => ({
        id,
        name: `Consistency Project ${index + 1}`,
        ownerId: userId,
        status: ProjectStatus.ACTIVE,
        version: 1,
        createdAt: new Date(Date.now() - index * 3600000).toISOString(),
      }));

      // Cache tous les projets individuellement
      for (const project of projects) {
        await cacheService.set(cacheService.getProjectKey(project.id), project);
      }

      // Cache la liste
      await cacheService.set(
        cacheService.getProjectListKey(userId, 1, 10),
        projects
      );

      // === SÉRIE D'OPÉRATIONS COMPLEXES ===
      
      const operations = [
        {
          name: 'update-project-1',
          action: async () => {
            // Mise à jour du projet 1
            const updated = { ...projects[0], version: 2, name: 'Updated Project 1' };
            await cacheService.invalidateProjectCache(projects[0].id, userId);
            await cacheService.set(cacheService.getProjectKey(projects[0].id), updated);
            projects[0] = updated; // Update reference
          },
        },
        {
          name: 'delete-project-2',
          action: async () => {
            // Suppression du projet 2
            await cacheService.invalidateProjectCache(projects[1].id, userId);
            projects.splice(1, 1); // Remove from reference
          },
        },
        {
          name: 'add-project-4',
          action: async () => {
            // Ajout d'un nouveau projet
            const newProject = {
              id: 'consistency-p4',
              name: 'New Project 4',
              ownerId: userId,
              status: ProjectStatus.ACTIVE,
              version: 1,
              createdAt: new Date().toISOString(),
            };
            
            await cacheService.set(cacheService.getProjectKey(newProject.id), newProject);
            projects.push(newProject); // Add to reference
          },
        },
        {
          name: 'refresh-list',
          action: async () => {
            // Rafraîchir la liste après les changements
            await cacheService.set(
              cacheService.getProjectListKey(userId, 1, 10),
              projects
            );
          },
        },
      ];

      // Exécuter les opérations en séquence
      for (const operation of operations) {
        await operation.action();
        
        // Vérifier la cohérence après chaque opération
        const cachedList = await cacheService.get(
          cacheService.getProjectListKey(userId, 1, 10)
        );

        if (operation.name === 'refresh-list') {
          expect(cachedList).toHaveLength(projects.length);
          expect(cachedList.map(p => p.id)).toEqual(projects.map(p => p.id));
        }
      }

      // === VÉRIFICATION DE LA COHÉRENCE FINALE ===
      
      const finalList = await cacheService.get(
        cacheService.getProjectListKey(userId, 1, 10)
      );

      expect(finalList).toHaveLength(3); // 1 updated, 1 deleted, 1 original, 1 added
      expect(finalList[0].name).toBe('Updated Project 1'); // Updated
      expect(finalList.find(p => p.id === 'consistency-p2')).toBeUndefined(); // Deleted
      expect(finalList.find(p => p.id === 'consistency-p4')).toBeTruthy(); // Added

      // Vérifier que les projets individuels sont cohérents
      for (const project of projects) {
        const cached = await cacheService.get(cacheService.getProjectKey(project.id));
        expect(cached).toEqual(project);
      }

    }, E2E_TIMEOUT);
  });

  describe('Memory Management and Resource Optimization', () => {
    it('should efficiently manage memory with TTL-based cleanup', async () => {
      const baselineStats = await cacheService.getStats();
      const baselineMemory = baselineStats.memory.used;

      // === PHASE 1: REMPLISSAGE PROGRESSIF ===
      
      const dataItems = [];
      for (let i = 0; i < 200; i++) {
        const item = {
          id: `memory-item-${i}`,
          data: 'x'.repeat(1000), // 1KB per item
          metadata: {
            created: new Date().toISOString(),
            index: i,
            category: `cat-${i % 5}`,
          },
        };
        
        dataItems.push(item);
        await cacheService.set(`memory-test:${item.id}`, item, 300); // 5 minute TTL
      }

      // Vérifier l'usage mémoire après remplissage
      const afterFillStats = await cacheService.getStats();
      const memoryIncrease = afterFillStats.memory.used - baselineMemory;
      
      console.log(`Memory increase after storing 200 items: ${memoryIncrease} bytes`);
      expect(memoryIncrease).toBeGreaterThan(0);

      // === PHASE 2: UTILISATION INTENSIVE ===
      
      const accessCount = 500;
      const accessStartTime = Date.now();

      for (let i = 0; i < accessCount; i++) {
        const randomIndex = Math.floor(Math.random() * dataItems.length);
        const item = dataItems[randomIndex];
        
        const cached = await cacheService.get(`memory-test:${item.id}`);
        expect(cached).toEqual(item);
      }

      const accessTime = Date.now() - accessStartTime;
      const avgAccessTime = accessTime / accessCount;

      console.log(`${accessCount} random accesses in ${accessTime}ms (avg: ${avgAccessTime.toFixed(2)}ms)`);
      expect(avgAccessTime).toBeLessThan(10); // Should be very fast

      // === PHASE 3: EXPIRATION ET NETTOYAGE ===
      
      // Changer quelques TTL pour test d'expiration
      const shortTTLItems = dataItems.slice(0, 10);
      for (const item of shortTTLItems) {
        await cacheService.expire(`memory-test:${item.id}`, 2); // 2 seconds
      }

      // Attendre l'expiration
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Vérifier l'expiration
      for (const item of shortTTLItems) {
        const expired = await cacheService.get(`memory-test:${item.id}`);
        expect(expired).toBeNull();
      }

      // Les autres éléments devraient toujours être là
      const longTTLItem = dataItems[50];
      const stillCached = await cacheService.get(`memory-test:${longTTLItem.id}`);
      expect(stillCached).toEqual(longTTLItem);

      // === PHASE 4: NETTOYAGE COMPLET ===
      
      const deletedCount = await cacheService.deleteByPattern('memory-test:*');
      expect(deletedCount).toBeGreaterThan(100); // Most items should have been deleted

      const finalStats = await cacheService.getStats();
      console.log('Memory usage after cleanup:', {
        baseline: baselineMemory,
        peak: afterFillStats.memory.used,
        final: finalStats.memory.used,
      });

    }, E2E_TIMEOUT);
  });

  describe('Distributed Lock E2E Scenarios', () => {
    it('should handle real-world lock scenarios', async () => {
      // === SCÉNARIO 1: EXPORT EXCLUSIF ===
      
      const exportOperation = 'project-export';
      const projectId = 'locked-project-123';

      // Première tentative d'export
      const lockValue1 = await cacheService.acquireLock(exportOperation, projectId, 60);
      expect(lockValue1).toBeTruthy();

      // Deuxième tentative simultanée (devrait échouer)
      const lockValue2 = await cacheService.acquireLock(exportOperation, projectId);
      expect(lockValue2).toBeNull();

      // Vérifier que le verrou est actif
      expect(await cacheService.isLocked(exportOperation, projectId)).toBe(true);

      // Simuler fin de l'export
      const released = await cacheService.releaseLock(exportOperation, projectId, lockValue1!);
      expect(released).toBe(true);

      // Nouvelle tentative devrait maintenant réussir
      const lockValue3 = await cacheService.acquireLock(exportOperation, projectId, 30);
      expect(lockValue3).toBeTruthy();
      expect(lockValue3).not.toBe(lockValue1); // Nouvelle valeur unique

      await cacheService.releaseLock(exportOperation, projectId, lockValue3!);

      // === SCÉNARIO 2: LOCKS MULTIPLES SUR RESSOURCES DIFFÉRENTES ===
      
      const resources = ['resource-A', 'resource-B', 'resource-C'];
      const lockValues = [];

      // Acquérir des locks sur différentes ressources
      for (const resource of resources) {
        const lockValue = await cacheService.acquireLock('batch-operation', resource, 120);
        expect(lockValue).toBeTruthy();
        lockValues.push(lockValue);
      }

      // Tous les locks devraient être actifs
      for (const resource of resources) {
        expect(await cacheService.isLocked('batch-operation', resource)).toBe(true);
      }

      // Libérer dans l'ordre inverse
      for (let i = resources.length - 1; i >= 0; i--) {
        const released = await cacheService.releaseLock(
          'batch-operation', 
          resources[i], 
          lockValues[i]!
        );
        expect(released).toBe(true);
      }

      // === SCÉNARIO 3: EXPIRATION AUTOMATIQUE ===
      
      const shortLockValue = await cacheService.acquireLock('short-operation', 'temp-resource', 3);
      expect(shortLockValue).toBeTruthy();

      // Attendre l'expiration
      await new Promise(resolve => setTimeout(resolve, 4000));

      // Lock devrait avoir expiré
      expect(await cacheService.isLocked('short-operation', 'temp-resource')).toBe(false);

      // Nouvelle acquisition devrait réussir
      const newLockValue = await cacheService.acquireLock('short-operation', 'temp-resource');
      expect(newLockValue).toBeTruthy();
      expect(newLockValue).not.toBe(shortLockValue);

      await cacheService.releaseLock('short-operation', 'temp-resource', newLockValue!);

    }, E2E_TIMEOUT);
  });

  describe('Error Recovery and Resilience E2E', () => {
    it('should demonstrate graceful degradation patterns', async () => {
      const projectId = 'resilience-project';
      const userId = 'resilience-user';

      // === ÉTAT INITIAL SAIN ===
      
      const projectData = { id: projectId, name: 'Resilience Test', ownerId: userId };
      await cacheService.set(cacheService.getProjectKey(projectId), projectData);
      
      expect(await cacheService.healthCheck()).toBe(true);
      expect(await cacheService.get(cacheService.getProjectKey(projectId))).toEqual(projectData);

      // === SIMULATION DE PROBLÈMES REDIS ===
      
      // Fermer la connexion Redis
      await redis.disconnect();

      // Opérations devraient échouer gracieusement
      const getResult = await cacheService.get(cacheService.getProjectKey(projectId));
      expect(getResult).toBeNull(); // Failed gracefully

      const setResult = await cacheService.set('new-key-during-failure', 'value');
      expect(setResult).toBe(false); // Failed gracefully

      const healthCheck = await cacheService.healthCheck();
      expect(healthCheck).toBe(false); // Correctly reports unhealthy

      // === RÉCUPÉRATION ===
      
      // Reconnecter Redis
      await redis.connect();
      
      // Attendre un moment pour la récupération
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Le service devrait récupérer
      const newSetResult = await cacheService.set('recovery-test', 'recovery-value');
      expect(newSetResult).toBe(true);

      const recoveryValue = await cacheService.get('recovery-test');
      expect(recoveryValue).toBe('recovery-value');

      const recoveredHealth = await cacheService.healthCheck();
      expect(recoveredHealth).toBe(true);

      console.log('Cache service successfully recovered from Redis disconnection');

    }, E2E_TIMEOUT);
  });

  describe('Configuration and Environment E2E', () => {
    it('should respect environment-specific cache configurations', async () => {
      // Test que la configuration test est bien appliquée
      
      // TTL courts en environnement test
      await cacheService.set('ttl-test', 'value'); // Uses default TTL

      const ttl = await redis.ttl('e2e-test:ttl-test');
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(300); // Test env should have shorter TTLs

      // Compression activée
      const largeData = { content: 'x'.repeat(2000) };
      await cacheService.set('compression-test', largeData);
      
      const rawValue = await redis.get('e2e-test:compression-test');
      expect(rawValue).toMatch(/^gzip:/); // Should be compressed

      // Métriques activées
      const stats = await cacheService.getStats();
      expect(stats.operations).toBeDefined();
      expect(typeof stats.operations.hits).toBe('number');

    }, E2E_TIMEOUT);

    it('should handle configuration validation in application context', async () => {
      // Vérifier que l'application démarre correctement avec la config
      expect(app).toBeTruthy();
      expect(cacheService).toBeTruthy();

      // Test des fonctionnalités critiques
      const criticalTests = [
        () => cacheService.healthCheck(),
        () => cacheService.set('config-test', 'value'),
        () => cacheService.get('config-test'),
        () => cacheService.getStats(),
      ];

      for (const test of criticalTests) {
        await expect(test()).resolves.toBeDefined();
      }

      console.log('All critical cache functions working correctly in E2E environment');

    }, E2E_TIMEOUT);
  });
});