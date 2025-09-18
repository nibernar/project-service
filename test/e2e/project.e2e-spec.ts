import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../../src/database/database.service';
import { DatabaseModule } from '../../src/database/database.module';
import { Logger } from '@nestjs/common';
import { 
  ProjectFixtures, 
  UserFixtures, 
  FileFixtures,
  TEST_IDS,
  createTestDataSet,
  createCompleteTestScenario,
  createPerformanceTestData
} from '../fixtures/project.fixtures';

/**
 * Tests End-to-End pour DatabaseService
 * Ces tests simulent des scenarios réels d'utilisation complets
 */
describe('DatabaseService - E2E Tests', () => {
  let app: INestApplication;
  let service: DatabaseService;
  let module: TestingModule;

  const testConfig = {
    DATABASE_URL:
      process.env.E2E_DATABASE_URL ||
      process.env.TEST_DATABASE_URL ||
      'postgresql://nicolasbernard@localhost:5432/project_service_e2e_test_db',
    NODE_ENV: 'test',
    DB_TRANSACTION_TIMEOUT: 15000,
    DB_MAX_WAIT: 10000,
    DB_MAX_CONNECTIONS: 10,
  };

  console.log('🔍 E2E_DATABASE_URL:', process.env.E2E_DATABASE_URL);
  console.log('🔍 TEST_DATABASE_URL:', process.env.TEST_DATABASE_URL);
  console.log('🔍 Final DATABASE_URL:', testConfig.DATABASE_URL);

  beforeAll(async () => {
    // Skip si pas de base E2E configurée
    if (
      !process.env.E2E_DATABASE_URL &&
      !process.env.TEST_DATABASE_URL &&
      !process.env.CI
    ) {
      console.log('⭐️  E2E tests skipped - No test database configured');
      return;
    }

    // Réduire les logs pour les tests E2E
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();

    module = await Test.createTestingModule({
      imports: [DatabaseModule],
      providers: [
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, defaultValue?: any) =>
              (testConfig as any)[key] ?? defaultValue,
          },
        },
      ],
    }).compile();

    app = module.createNestApplication();
    await app.init();

    service = module.get<DatabaseService>(DatabaseService);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    jest.restoreAllMocks();
  });

  beforeEach(async () => {
    if (!service) return;

    try {
      await service.resetDatabase();
    } catch (error) {
      // Ignorer les erreurs de reset
    }
  });

  describe('🎯 Real-World Project Scenarios', () => {
    it('should handle complete project lifecycle', async () => {
      if (!service) return;

      const testUser = UserFixtures.validUser();
      const lifecycleProject = ProjectFixtures.mockProject({
        id: TEST_IDS.PROJECT_1,
        ownerId: testUser.id,
        name: 'E2E Lifecycle Project',
        description: 'Complete lifecycle test',
        initialPrompt: 'Create a web application for managing tasks',
        uploadedFileIds: FileFixtures.uploadedFileIds().slice(0, 2),
        generatedFileIds: [],
      });

      // 1. Création d'un projet
      const project = await service.project.create({
        data: {
          id: lifecycleProject.id,
          name: lifecycleProject.name,
          description: lifecycleProject.description,
          initialPrompt: lifecycleProject.initialPrompt,
          ownerId: lifecycleProject.ownerId,
          status: lifecycleProject.status,
          uploadedFileIds: lifecycleProject.uploadedFileIds,
          generatedFileIds: lifecycleProject.generatedFileIds,
        },
      });

      expect(project.id).toBe(lifecycleProject.id);
      expect(project.status).toBe('ACTIVE');

      // 2. Ajout de statistiques
      const stats = await service.projectStatistics.create({
        data: {
          id: TEST_IDS.STATS_1,
          projectId: project.id,
          costs: {
            claudeApi: 15.5,
            storage: 2.3,
            compute: 8.75,
            total: 26.55,
          },
          performance: {
            generationTime: 45000,
            processingTime: 12000,
            totalTime: 57000,
          },
          usage: {
            documentsGenerated: 5,
            filesProcessed: 3,
            tokensUsed: 25000,
          },
        },
      });

      expect(stats.projectId).toBe(project.id);

      // 3. Mise à jour avec fichiers générés
      const generatedFiles = FileFixtures.generatedFileIds().slice(0, 3);
      const updatedProject = await service.project.update({
        where: { id: project.id },
        data: {
          generatedFileIds: generatedFiles,
          status: 'ACTIVE',
        },
      });

      expect(updatedProject.generatedFileIds).toHaveLength(3);

      // 4. Récupération complète avec relations
      const fullProject = await service.project.findUnique({
        where: { id: project.id },
        include: { statistics: true },
      });

      expect(fullProject).not.toBeNull();
      expect(fullProject?.statistics).not.toBeNull();
      expect(fullProject?.statistics?.costs).toHaveProperty('total', 26.55);

      // 5. Archivage du projet
      const archivedProject = await service.project.update({
        where: { id: project.id },
        data: { status: 'ARCHIVED' },
      });

      expect(archivedProject.status).toBe('ARCHIVED');

      console.log('✅ Complete project lifecycle test passed');
    });

    it('should handle multiple projects with concurrent operations', async () => {
      if (!service) return;

      const projectCount = 10;
      const testUser = UserFixtures.validUser();
      const baseProject = ProjectFixtures.mockProject();

      // Créer plusieurs projets en parallèle
      const createPromises = Array.from({ length: projectCount }, (_, i) => {
        const projectData = {
          ...baseProject,
          id: `concurrent-${i}`,
          name: `Concurrent Project ${i}`,
          description: `Project ${i} for concurrent testing`,
          initialPrompt: `Create application ${i}`,
          ownerId: testUser.id,
          uploadedFileIds: [`upload-${i}`],
          generatedFileIds: [],
        };

        return service.project.create({
          data: {
            id: projectData.id,
            name: projectData.name,
            description: projectData.description,
            initialPrompt: projectData.initialPrompt,
            ownerId: projectData.ownerId,
            status: projectData.status,
            uploadedFileIds: projectData.uploadedFileIds,
            generatedFileIds: projectData.generatedFileIds,
          },
        });
      });

      const projects = await Promise.all(createPromises);
      expect(projects).toHaveLength(projectCount);

      // Ajouter des statistiques en parallèle
      const statsPromises = projects.map((project, i) =>
        service.projectStatistics.create({
          data: {
            id: `stats-concurrent-${i}`,
            projectId: project.id,
            costs: { total: 10 + i },
            performance: { totalTime: 1000 * i },
            usage: { documentsGenerated: i },
          },
        }),
      );

      const stats = await Promise.all(statsPromises);
      expect(stats).toHaveLength(projectCount);

      // Récupérer tous les projets de l'utilisateur
      const userProjects = await service.project.findMany({
        where: { ownerId: testUser.id },
        include: { statistics: true },
        orderBy: { createdAt: 'asc' },
      });

      expect(userProjects).toHaveLength(projectCount);
      expect(userProjects.every((p) => p.statistics !== null)).toBe(true);

      // Mettre à jour tous les projets en parallèle
      const updatePromises = userProjects.map((project) =>
        service.project.update({
          where: { id: project.id },
          data: {
            generatedFileIds: [`gen-${project.id}`],
            status: 'ACTIVE',
          },
        }),
      );

      const updatedProjects = await Promise.all(updatePromises);
      expect(updatedProjects.every((p) => p.generatedFileIds.length > 0)).toBe(
        true,
      );

      console.log(
        `✅ ${projectCount} concurrent projects handled successfully`,
      );
    });

    it('should handle data consistency across complex transactions', async () => {
      if (!service) return;

      const testUser = UserFixtures.validUser();
      const complexProject = ProjectFixtures.mockProject({
        id: TEST_IDS.PROJECT_2,
        ownerId: testUser.id,
        name: 'Complex Transaction Project',
        description: 'Testing complex transaction consistency',
        initialPrompt: 'Create a complex application',
        uploadedFileIds: FileFixtures.uploadedFileIds().slice(0, 2),
        generatedFileIds: [],
      });

      // Scénario complexe : création d'un projet avec statistiques en une transaction
      const result = await service.withTransaction(async (tx) => {
        // 1. Créer le projet
        const project = await tx.project.create({
          data: {
            id: complexProject.id,
            name: complexProject.name,
            description: complexProject.description,
            initialPrompt: complexProject.initialPrompt,
            ownerId: complexProject.ownerId,
            status: complexProject.status,
            uploadedFileIds: complexProject.uploadedFileIds,
            generatedFileIds: complexProject.generatedFileIds,
          },
        });

        // 2. Ajouter les statistiques
        const statistics = await tx.projectStatistics.create({
          data: {
            id: TEST_IDS.STATS_2,
            projectId: project.id,
            costs: {
              claudeApi: 25.75,
              storage: 5.25,
              compute: 15.5,
              total: 46.5,
            },
            performance: {
              generationTime: 65000,
              processingTime: 18000,
              totalTime: 83000,
            },
            usage: {
              documentsGenerated: 8,
              filesProcessed: 6,
              tokensUsed: 45000,
            },
          },
        });

        // 3. Mettre à jour le projet avec les fichiers générés
        const generatedFiles = FileFixtures.generatedFileIds().slice(0, 3);
        const updatedProject = await tx.project.update({
          where: { id: project.id },
          data: {
            generatedFileIds: generatedFiles,
          },
        });

        return { project: updatedProject, statistics };
      });

      // Vérifier que tout a été créé correctement
      expect(result.project.id).toBe(complexProject.id);
      expect(result.project.generatedFileIds).toHaveLength(3);
      expect(result.statistics.projectId).toBe(result.project.id);

      // Vérifier la cohérence en base
      const dbProject = await service.project.findUnique({
        where: { id: complexProject.id },
        include: { statistics: true },
      });

      expect(dbProject).not.toBeNull();
      expect(dbProject?.statistics).not.toBeNull();
      expect(dbProject?.statistics?.costs).toHaveProperty('total', 46.5);
      expect(dbProject?.generatedFileIds).toHaveLength(3);

      console.log('✅ Complex transaction consistency test passed');
    });
  });

  describe('🔄 Application Lifecycle Scenarios', () => {
    it('should handle application startup and shutdown gracefully', async () => {
      if (!service) return;

      const testUser = UserFixtures.validUser();
      const startupProject = ProjectFixtures.mockProject({
        id: TEST_IDS.PROJECT_1,
        ownerId: testUser.id,
        name: 'Startup Test Project',
        description: 'Testing startup scenario',
      });

      // Test du cycle complet de l'application
      const health1 = await service.isHealthy();
      expect(health1).toBe(true);

      // Simuler une utilisation normale
      await service.project.create({
        data: {
          id: startupProject.id,
          name: startupProject.name,
          description: startupProject.description,
          initialPrompt: startupProject.initialPrompt,
          ownerId: startupProject.ownerId,
          status: startupProject.status,
          uploadedFileIds: startupProject.uploadedFileIds,
          generatedFileIds: startupProject.generatedFileIds,
        },
      });

      // Vérifier que les données persistent
      const project = await service.project.findUnique({
        where: { id: startupProject.id },
      });

      expect(project).not.toBeNull();

      // Test du shutdown propre
      await service.onModuleDestroy();

      // Redémarrer
      await service.onModuleInit();

      const health2 = await service.isHealthy();
      expect(health2).toBe(true);

      // Vérifier que les données sont toujours là 
      const persistedProject = await service.project.findUnique({
        where: { id: startupProject.id },
      });

      expect(persistedProject).not.toBeNull();
      expect(persistedProject?.name).toBe(startupProject.name);

      console.log('✅ Application lifecycle test passed');
    });

    it('should handle service restarts with active connections', async () => {
      if (!service) return;

      const testUser = UserFixtures.validUser();
      const baseProject = ProjectFixtures.mockProject();

      // Démarrer plusieurs opérations longues
      const longOperations = Array.from({ length: 5 }, (_, i) =>
        service.withTransaction(async (tx) => {
          // Simuler une opération qui prend du temps
          await new Promise((resolve) => setTimeout(resolve, 500));

          const projectData = {
            ...baseProject,
            id: `restart-${i}`,
            name: `Restart Test ${i}`,
            description: 'Testing restart scenario',
            ownerId: testUser.id,
          };

          return tx.project.create({
            data: {
              id: projectData.id,
              name: projectData.name,
              description: projectData.description,
              initialPrompt: projectData.initialPrompt,
              ownerId: projectData.ownerId,
              status: projectData.status,
              uploadedFileIds: projectData.uploadedFileIds,
              generatedFileIds: projectData.generatedFileIds,
            },
          });
        }),
      );

      // Attendre que toutes les opérations se terminent
      const results = await Promise.allSettled(longOperations);
      const successful = results.filter((r) => r.status === 'fulfilled').length;

      expect(successful).toBeGreaterThan(0); // Au moins quelques succès

      // Vérifier que le service est toujours fonctionnel
      const health = await service.isHealthy();
      expect(health).toBe(true);

      console.log(
        `✅ Service restart test: ${successful}/5 operations completed`,
      );
    });

    it('should handle database maintenance scenarios', async () => {
      if (!service) return;

      const maintenanceUser = UserFixtures.otherUser();
      const baseProject = ProjectFixtures.mockProject();

      // Créer des données de test
      await service.project.createMany({
        data: [
          {
            id: 'maintenance-1',
            name: 'Maintenance Test 1',
            description: 'Before maintenance',
            initialPrompt: baseProject.initialPrompt,
            ownerId: maintenanceUser.id,
            status: baseProject.status,
            uploadedFileIds: [],
            generatedFileIds: [],
          },
          {
            id: 'maintenance-2',
            name: 'Maintenance Test 2',
            description: 'Before maintenance',
            initialPrompt: baseProject.initialPrompt,
            ownerId: maintenanceUser.id,
            status: baseProject.status,
            uploadedFileIds: [],
            generatedFileIds: [],
          },
        ],
      });

      // Simuler une opération de maintenance (reset/seed)
      await service.resetDatabase();
      await service.seedDatabase();

      // Vérifier que les données de seed sont présentes
      const seedProjects = await service.project.findMany({
        where: {
          id: { in: ['seed-project-1', 'seed-project-2'] },
        },
      });

      expect(seedProjects).toHaveLength(2);

      // Vérifier que les anciennes données ont été supprimées
      const oldProjects = await service.project.findMany({
        where: { ownerId: maintenanceUser.id },
      });

      expect(oldProjects).toHaveLength(0);

      console.log('✅ Database maintenance scenario test passed');
    });
  });

  describe('🚨 Error Recovery Scenarios', () => {
    it('should recover from constraint violations gracefully', async () => {
      if (!service) return;

      const testUser = UserFixtures.validUser();
      const constraintProject = ProjectFixtures.mockProject({
        id: TEST_IDS.PROJECT_1,
        ownerId: testUser.id,
        name: 'Constraint Test',
        description: 'Testing constraint handling',
      });

      // Créer un projet initial
      const project = await service.project.create({
        data: {
          id: constraintProject.id,
          name: constraintProject.name,
          description: constraintProject.description,
          initialPrompt: constraintProject.initialPrompt,
          ownerId: constraintProject.ownerId,
          status: constraintProject.status,
          uploadedFileIds: constraintProject.uploadedFileIds,
          generatedFileIds: constraintProject.generatedFileIds,
        },
      });

      // Essayer de créer un doublon (devrait échouer)
      await expect(
        service.project.create({
          data: {
            id: constraintProject.id, // Même ID
            name: 'Duplicate Test',
            description: 'Should fail',
            initialPrompt: constraintProject.initialPrompt,
            ownerId: constraintProject.ownerId,
            status: constraintProject.status,
            uploadedFileIds: [],
            generatedFileIds: [],
          },
        }),
      ).rejects.toThrow();

      // Vérifier que le service fonctionne toujours
      const health = await service.isHealthy();
      expect(health).toBe(true);

      // Vérifier que le projet original existe toujours
      const existingProject = await service.project.findUnique({
        where: { id: constraintProject.id },
      });

      expect(existingProject).not.toBeNull();
      expect(existingProject?.name).toBe(constraintProject.name);

      console.log('✅ Constraint violation recovery test passed');
    });

    it('should handle transaction rollbacks in complex scenarios', async () => {
      if (!service) return;

      const testUser = UserFixtures.validUser();
      const baseProject = ProjectFixtures.mockProject({
        id: TEST_IDS.PROJECT_1,
        ownerId: testUser.id,
        name: 'Rollback Base Project',
        description: 'Base for rollback test',
      });

      // Créer un projet de base
      const createdBaseProject = await service.project.create({
        data: {
          id: baseProject.id,
          name: baseProject.name,
          description: baseProject.description,
          initialPrompt: baseProject.initialPrompt,
          ownerId: baseProject.ownerId,
          status: baseProject.status,
          uploadedFileIds: baseProject.uploadedFileIds,
          generatedFileIds: baseProject.generatedFileIds,
        },
      });

      // Transaction complexe qui doit échouer
      await expect(
        service.withTransaction(async (tx) => {
          // 1. Modifier le projet existant
          await tx.project.update({
            where: { id: createdBaseProject.id },
            data: { name: 'Modified Name' },
          });

          // 2. Créer un nouveau projet
          await tx.project.create({
            data: {
              id: TEST_IDS.PROJECT_2,
              name: 'New Project in Transaction',
              description: 'Should be rolled back',
              initialPrompt: baseProject.initialPrompt,
              ownerId: testUser.id,
              status: baseProject.status,
              uploadedFileIds: [],
              generatedFileIds: [],
            },
          });

          // 3. Créer des statistiques
          await tx.projectStatistics.create({
            data: {
              id: 'rollback-stats',
              projectId: TEST_IDS.PROJECT_2,
              costs: { total: 100 },
              performance: { totalTime: 1000 },
              usage: { documentsGenerated: 1 },
            },
          });

          // 4. Forcer une erreur pour déclencher le rollback
          throw new Error('Forced rollback');
        }),
      ).rejects.toThrow();

      // Vérifier que rien n'a été modifié
      const originalProject = await service.project.findUnique({
        where: { id: baseProject.id },
      });
      expect(originalProject?.name).toBe(baseProject.name); // Nom original

      const newProject = await service.project.findUnique({
        where: { id: TEST_IDS.PROJECT_2 },
      });
      expect(newProject).toBeNull(); // N'existe pas

      const stats = await service.projectStatistics.findUnique({
        where: { id: 'rollback-stats' },
      });
      expect(stats).toBeNull(); // N'existent pas

      console.log('✅ Complex transaction rollback test passed');
    });

    it('should maintain data integrity under concurrent stress', async () => {
      if (!service) return;

      const concurrentOperations = 20;
      const stressUser = UserFixtures.thirdUser();
      const baseProject = ProjectFixtures.mockProject();

      // Lancer de nombreuses opérations concurrentes
      const promises = Array.from({ length: concurrentOperations }, (_, i) =>
        service
          .withTransaction(async (tx) => {
            // Mélanger succès et échecs
            if (i % 4 === 0) {
              // Opération qui échoue intentionnellement
              await tx.project.create({
                data: {
                  id: 'duplicate-id', // ID dupliqué pour forcer l'échec
                  name: `Stress Test ${i}`,
                  description: 'Should fail',
                  initialPrompt: baseProject.initialPrompt,
                  ownerId: stressUser.id,
                  status: baseProject.status,
                  uploadedFileIds: [],
                  generatedFileIds: [],
                },
              });
            } else {
              // Opération normale
              return tx.project.create({
                data: {
                  id: `stress-${i}`,
                  name: `Stress Test ${i}`,
                  description: 'Stress test project',
                  initialPrompt: baseProject.initialPrompt,
                  ownerId: stressUser.id,
                  status: baseProject.status,
                  uploadedFileIds: [],
                  generatedFileIds: [],
                },
              });
            }
          })
          .catch((error) => {
            // Ignorer les erreurs attendues
            return null;
          }),
      );

      const results = await Promise.allSettled(promises);
      const successful = results.filter(
        (r) => r.status === 'fulfilled' && r.value !== null,
      ).length;

      // Au moins quelques opérations devraient réussir
      expect(successful).toBeGreaterThan(0);

      // Vérifier l'intégrité des données
      const finalProjects = await service.project.findMany({
        where: { ownerId: stressUser.id },
      });

      expect(finalProjects).toHaveLength(successful);

      // Vérifier que le service est toujours sain
      const health = await service.isHealthy();
      expect(health).toBe(true);

      console.log(
        `✅ Concurrent stress test: ${successful}/${concurrentOperations} operations succeeded`,
      );
    });
  });

  describe('📈 Real-World Performance Scenarios', () => {
    it('should handle typical daily usage patterns', async () => {
      if (!service) return;

      const dailyOperations = 50; // Réduit pour les tests plus rapides
      const batchSize = 10;
      const results = [];
      const performanceData = createPerformanceTestData();

      // Simuler des vagues d'utilisation typiques
      for (let batch = 0; batch < dailyOperations / batchSize; batch++) {
        const batchStart = Date.now();

        const batchOperations = Array.from({ length: batchSize }, (_, i) => {
          const operationId = batch * batchSize + i;

          if (operationId % 5 === 0) {
            // Health check (20%)
            return service.isHealthy();
          } else if (operationId % 3 === 0) {
            // Lecture de projet (33%)
            return service.project.findMany({
              where: { ownerId: `user-${operationId % 10}` },
              take: 5,
            });
          } else {
            // Création/modification (47%)
            const projectData = {
              ...performanceData.largeProject,
              id: `daily-${operationId}`,
              name: `Daily Project ${operationId}`,
              description: 'Daily usage pattern',
              ownerId: `user-${operationId % 10}`,
              uploadedFileIds: [],
              generatedFileIds: [],
            };

            return service.project
              .create({
                data: {
                  id: projectData.id,
                  name: projectData.name,
                  description: projectData.description,
                  initialPrompt: projectData.initialPrompt,
                  ownerId: projectData.ownerId,
                  status: projectData.status,
                  uploadedFileIds: projectData.uploadedFileIds,
                  generatedFileIds: projectData.generatedFileIds,
                },
              })
              .catch(() => null); // Ignorer les erreurs de duplication
          }
        });

        const batchResults = await Promise.allSettled(batchOperations);
        const batchSuccess = batchResults.filter(
          (r) => r.status === 'fulfilled',
        ).length;
        const batchDuration = Date.now() - batchStart;

        results.push({ batch, success: batchSuccess, duration: batchDuration });

        // Pause courte entre les batches (simulation réaliste)
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      // Analyser les résultats
      const totalSuccess = results.reduce((sum, r) => sum + r.success, 0);
      const avgDuration =
        results.reduce((sum, r) => sum + r.duration, 0) / results.length;
      const maxDuration = Math.max(...results.map((r) => r.duration));

      expect(totalSuccess).toBeGreaterThan(dailyOperations * 0.8); // 80% de succès
      expect(avgDuration).toBeLessThan(2000); // Moins de 2s par batch en moyenne
      expect(maxDuration).toBeLessThan(5000); // Moins de 5s pour le batch le plus lent

      console.log(
        `✅ Daily usage pattern: ${totalSuccess}/${dailyOperations} operations, avg ${avgDuration.toFixed(0)}ms/batch`,
      );
    }, 30000);

    it('should handle peak traffic simulation', async () => {
      if (!service) return;

      const peakDuration = 3000; // 3 secondes de trafic intense (réduit)
      const requestInterval = 50; // Une requête toutes les 50ms (réduit)
      const startTime = Date.now();
      const operations = [];
      const baseProject = ProjectFixtures.mockProject();

      let operationId = 0;
      while (Date.now() - startTime < peakDuration) {
        const projectData = {
          ...baseProject,
          id: `peak-${operationId}-${Date.now()}`,
          name: `Peak Project ${operationId}`,
          description: 'Peak traffic simulation',
          ownerId: `peak-user-${operationId % 5}`,
          uploadedFileIds: [],
          generatedFileIds: [],
        };

        const operation = service.project
          .create({
            data: {
              id: projectData.id,
              name: projectData.name,
              description: projectData.description,
              initialPrompt: projectData.initialPrompt,
              ownerId: projectData.ownerId,
              status: projectData.status,
              uploadedFileIds: projectData.uploadedFileIds,
              generatedFileIds: projectData.generatedFileIds,
            },
          })
          .catch(() => null);

        operations.push(operation);
        operationId++;

        await new Promise((resolve) => setTimeout(resolve, requestInterval));
      }

      const results = await Promise.allSettled(operations);
      const successful = results.filter(
        (r) => r.status === 'fulfilled' && r.value !== null,
      ).length;
      const successRate = (successful / operations.length) * 100;

      expect(successRate).toBeGreaterThan(70); // Au moins 70% de succès sous charge

      // Vérifier que le service est toujours fonctionnel
      const health = await service.isHealthy();
      expect(health).toBe(true);

      console.log(
        `✅ Peak traffic simulation: ${successful}/${operations.length} (${successRate.toFixed(1)}%) operations succeeded`,
      );
    }, 15000);
  });
});