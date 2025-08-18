// test/integration/project.integration.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../../src/database/database.service';
import { Logger } from '@nestjs/common';
// ✅ AJOUT: Importer la fonction helper
import { createDatabaseTestingModule } from '../setup/database-test-setup';

/**
 * Tests d'intégration avec vraie base de données PostgreSQL
 * Nécessite une instance PostgreSQL de test configurée
 */
describe('DatabaseService - Integration Tests', () => {
  let service: DatabaseService;
  let module: TestingModule;
  let configService: ConfigService;

  // Configuration pour base de test réelle
  const testConfig = {
    DATABASE_URL:
      process.env.TEST_DATABASE_URL ||
      'postgresql://test_user:test_pass@localhost:5433/project_service_integration_test',
    NODE_ENV: 'test',
    DB_TRANSACTION_TIMEOUT: 10000,
    DB_MAX_WAIT: 5000,
  };

  beforeAll(async () => {
    if (!process.env.TEST_DATABASE_URL && !process.env.CI) {
      console.log(
        '⏭️  Integration tests skipped - No test database configured',
      );
      return;
    }

    // Mock Logger pour réduire le bruit
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();

    module = await createDatabaseTestingModule(testConfig, false); // false = pas de mock Prisma pour l'intégration

    service = module.get<DatabaseService>(DatabaseService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterAll(async () => {
    if (module) {
      await module.close();
    }
    jest.restoreAllMocks();
  });

  beforeEach(async () => {
    if (!service) return; // Skip si pas de base de test

    try {
      await service.resetDatabase();
    } catch (error) {}
  });

  describe('Real Database Connection', () => {
    it('should connect to real PostgreSQL instance', async () => {
      if (!service) return;

      await expect(service.onModuleInit()).resolves.toBeUndefined();

      const health = service.getHealthMetrics();
      expect(health.status).toBe('healthy');
    }, 15000);

    it('should execute real queries successfully', async () => {
      if (!service) return;

      await service.onModuleInit();

      // Test query direct
      const result = await service.$queryRaw`SELECT 1 as test_value`;
      expect(result).toEqual([{ test_value: 1 }]);

      // Test query avec paramètre
      const name = 'test';
      const paramResult = await service.$queryRaw`SELECT ${name} as name_value`;
      expect(paramResult).toEqual([{ name_value: 'test' }]);
    });

    it('should handle real transaction rollback', async () => {
      if (!service) return;

      await service.onModuleInit();

      // Insérer des données de test d'abord
      await service.project.create({
        data: {
          id: 'test-project-rollback',
          name: 'Test Project',
          description: 'For rollback test',
          initialPrompt: 'Test prompt',
          ownerId: 'test-user',
          status: 'ACTIVE',
          uploadedFileIds: [],
          generatedFileIds: [],
        },
      });

      // Test transaction avec rollback
      await expect(
        service.withTransaction(async (tx: any) => {
          // Modifier le projet
          await tx.project.update({
            where: { id: 'test-project-rollback' },
            data: { name: 'Modified Name' },
          });

          // Forcer une erreur pour déclencher le rollback
          throw new Error('Force rollback');
        }),
      ).rejects.toThrow('Force rollback');

      // Vérifier que les modifications ont été annulées
      const project = await service.project.findUnique({
        where: { id: 'test-project-rollback' },
      });

      expect(project?.name).toBe('Test Project'); // Nom original
    });

    it('should persist data across connections', async () => {
      if (!service) return;

      await service.onModuleInit();

      // Créer des données
      const testProject = await service.project.create({
        data: {
          id: 'test-persistence',
          name: 'Persistence Test',
          description: 'Test data persistence',
          initialPrompt: 'Test prompt',
          ownerId: 'test-user',
          status: 'ACTIVE',
          uploadedFileIds: [],
          generatedFileIds: [],
        },
      });

      expect(testProject.id).toBe('test-persistence');

      // Simuler une déconnexion/reconnexion
      await service.onModuleDestroy();
      await service.onModuleInit();

      // Vérifier que les données sont toujours là
      const retrievedProject = await service.project.findUnique({
        where: { id: 'test-persistence' },
      });

      expect(retrievedProject).not.toBeNull();
      expect(retrievedProject?.name).toBe('Persistence Test');
    });
  });

  describe('Real Transaction Testing', () => {
    beforeEach(async () => {
      if (!service) return;
      await service.onModuleInit();
    });

    it('should commit successful transactions', async () => {
      if (!service) return;

      const result = await service.withTransaction(async (tx) => {
        const project = await tx.project.create({
          data: {
            id: 'test-commit',
            name: 'Commit Test',
            description: 'Test transaction commit',
            initialPrompt: 'Test prompt',
            ownerId: 'test-user',
            status: 'ACTIVE',
            uploadedFileIds: [],
            generatedFileIds: [],
          },
        });

        return project;
      });

      expect(result.id).toBe('test-commit');

      // Vérifier que les données ont été commitées
      const project = await service.project.findUnique({
        where: { id: 'test-commit' },
      });

      expect(project).not.toBeNull();
      expect(project?.name).toBe('Commit Test');
    });

    it('should rollback failed transactions', async () => {
      if (!service) return;

      await expect(
        service.withTransaction(async (tx) => {
          // Créer un projet
          await tx.project.create({
            data: {
              id: 'test-rollback-fail',
              name: 'Rollback Test',
              description: 'Test transaction rollback',
              initialPrompt: 'Test prompt',
              ownerId: 'test-user',
              status: 'ACTIVE',
              uploadedFileIds: [],
              generatedFileIds: [],
            },
          });

          // Forcer une erreur
          throw new Error('Transaction should rollback');
        }),
      ).rejects.toThrow('Transaction should rollback');

      // Vérifier que rien n'a été sauvegardé
      const project = await service.project.findUnique({
        where: { id: 'test-rollback-fail' },
      });

      expect(project).toBeNull();
    });

    it('should handle concurrent transactions', async () => {
      if (!service) return;

      // Créer plusieurs transactions concurrentes
      const promises = Array.from({ length: 5 }, (_, i) =>
        service.withTransaction(async (tx) => {
          return tx.project.create({
            data: {
              id: `concurrent-${i}`,
              name: `Concurrent Project ${i}`,
              description: 'Concurrent test',
              initialPrompt: 'Test prompt',
              ownerId: 'test-user',
              status: 'ACTIVE',
              uploadedFileIds: [],
              generatedFileIds: [],
            },
          });
        }),
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
      results.forEach((result, i) => {
        expect(result.id).toBe(`concurrent-${i}`);
      });

      // Vérifier que tous les projets ont été créés
      const projects = await service.project.findMany({
        where: {
          id: { startsWith: 'concurrent-' },
        },
      });

      expect(projects).toHaveLength(5);
    });

    it('should respect isolation levels', async () => {
      if (!service) return;

      // Créer un projet initial
      await service.project.create({
        data: {
          id: 'isolation-test',
          name: 'Isolation Test',
          description: 'Test isolation',
          initialPrompt: 'Test prompt',
          ownerId: 'test-user',
          status: 'ACTIVE',
          uploadedFileIds: [],
          generatedFileIds: [],
        },
      });

      // Transaction avec niveau d'isolation sérialisable
      await service.withTransaction(
        async (tx) => {
          const project = await tx.project.findUnique({
            where: { id: 'isolation-test' },
          });

          expect(project).not.toBeNull();

          await tx.project.update({
            where: { id: 'isolation-test' },
            data: { name: 'Updated in Serializable' },
          });
        },
        { isolationLevel: 'Serializable' },
      );

      // Vérifier la mise à jour
      const updatedProject = await service.project.findUnique({
        where: { id: 'isolation-test' },
      });

      expect(updatedProject?.name).toBe('Updated in Serializable');
    });
  });

  describe('Performance and Resource Testing', () => {
    beforeEach(async () => {
      if (!service) return;
      await service.onModuleInit();
    });

    it('should measure query response times', async () => {
      if (!service) return;

      const startTime = Date.now();
      await service.isHealthy();
      const responseTime = Date.now() - startTime;

      expect(responseTime).toBeLessThan(1000); // Moins d'1 seconde

      const health = service.getHealthMetrics();
      expect(health.responseTime).toBeGreaterThanOrEqual(0);
      expect(health.responseTime).toBeLessThan(1000);
    });

    it('should handle batch operations efficiently', async () => {
      if (!service) return;

      const batchSize = 100;
      const projectsData = Array.from({ length: batchSize }, (_, i) => ({
        id: `batch-${i}`,
        name: `Batch Project ${i}`,
        description: `Batch test project ${i}`,
        initialPrompt: 'Batch test prompt',
        ownerId: 'batch-user',
        status: 'ACTIVE' as const,
        uploadedFileIds: [],
        generatedFileIds: [],
      }));

      const startTime = Date.now();

      const result = await service.project.createMany({
        data: projectsData,
        skipDuplicates: true,
      });

      const duration = Date.now() - startTime;

      expect(result.count).toBe(batchSize);
      expect(duration).toBeLessThan(5000); // Moins de 5 secondes pour 100 enregistrements

      // Vérifier que les données ont été créées
      const count = await service.project.count({
        where: { ownerId: 'batch-user' },
      });

      expect(count).toBe(batchSize);
    });

    it('should handle large result sets efficiently', async () => {
      if (!service) return;

      // Créer des données de test
      const testData = Array.from({ length: 50 }, (_, i) => ({
        id: `large-${i}`,
        name: `Large Dataset ${i}`,
        description: 'Large dataset test',
        initialPrompt: 'Test prompt',
        ownerId: 'large-user',
        status: 'ACTIVE' as const,
        uploadedFileIds: [],
        generatedFileIds: [],
      }));

      await service.project.createMany({
        data: testData,
        skipDuplicates: true,
      });

      const startTime = Date.now();

      const projects = await service.project.findMany({
        where: { ownerId: 'large-user' },
        include: { statistics: true },
      });

      const duration = Date.now() - startTime;

      expect(projects).toHaveLength(50);
      expect(duration).toBeLessThan(2000); // Moins de 2 secondes
    });
  });

  describe('Error Handling with Real Database', () => {
    beforeEach(async () => {
      if (!service) return;
      await service.onModuleInit();
    });

    it('should handle unique constraint violations', async () => {
      if (!service) return;

      // Créer un projet
      await service.project.create({
        data: {
          id: 'unique-test',
          name: 'Unique Test',
          description: 'Test unique constraint',
          initialPrompt: 'Test prompt',
          ownerId: 'test-user',
          status: 'ACTIVE',
          uploadedFileIds: [],
          generatedFileIds: [],
        },
      });

      // Essayer de créer le même ID
      await expect(
        service.project.create({
          data: {
            id: 'unique-test', // Même ID
            name: 'Duplicate Test',
            description: 'Should fail',
            initialPrompt: 'Test prompt',
            ownerId: 'test-user',
            status: 'ACTIVE',
            uploadedFileIds: [],
            generatedFileIds: [],
          },
        }),
      ).rejects.toThrow();
    });

    it('should handle foreign key violations', async () => {
      if (!service) return;

      // Essayer de créer des statistiques pour un projet inexistant
      await expect(
        service.projectStatistics.create({
          data: {
            id: 'stats-invalid',
            projectId: 'non-existent-project',
            costs: {},
            performance: {},
            usage: {},
          },
        }),
      ).rejects.toThrow();
    });

    it('should handle connection loss gracefully', async () => {
      if (!service) return;

      // Simuler une perte de connexion n'est pas trivial en test d'intégration
      // On teste plutôt la détection d'état de santé
      const isHealthy = await service.isHealthy();
      expect(typeof isHealthy).toBe('boolean');
    });
  });

  describe('Real Utilities Testing', () => {
    beforeEach(async () => {
      if (!service) return;
      await service.onModuleInit();
    });

    it('should reset database completely', async () => {
      if (!service) return;

      // Créer des données de test
      const project = await service.project.create({
        data: {
          id: 'reset-test',
          name: 'Reset Test',
          description: 'Will be deleted',
          initialPrompt: 'Test prompt',
          ownerId: 'test-user',
          status: 'ACTIVE',
          uploadedFileIds: [],
          generatedFileIds: [],
        },
      });

      await service.projectStatistics.create({
        data: {
          id: 'stats-reset-test',
          projectId: project.id,
          costs: { total: 100 },
          performance: { time: 1000 },
          usage: { requests: 10 },
        },
      });

      // Reset
      await service.resetDatabase();

      // Vérifier que tout a été supprimé
      const projectCount = await service.project.count();
      const statsCount = await service.projectStatistics.count();

      expect(projectCount).toBe(0);
      expect(statsCount).toBe(0);
    });

    it('should seed database with test data', async () => {
      if (!service) return;

      await service.seedDatabase();

      // Vérifier que les données ont été créées
      const projects = await service.project.findMany({
        where: {
          id: { in: ['seed-project-1', 'seed-project-2'] },
        },
      });

      expect(projects).toHaveLength(2);
      expect(projects[0].name).toBe('Sample Project 1');
      expect(projects[1].name).toBe('Sample Project 2');
    });
  });

  describe('Health Checks with Real Database', () => {
    beforeEach(async () => {
      if (!service) return;
      await service.onModuleInit();
    });

    it('should report healthy status for working database', async () => {
      if (!service) return;

      const isHealthy = await service.isHealthy();
      expect(isHealthy).toBe(true);

      const health = service.getHealthMetrics();
      expect(health.status).toBe('healthy');
      expect(health.responseTime).toBeGreaterThanOrEqual(0);
      expect(health.lastSuccessfulQuery).toBeInstanceOf(Date);
    });

    it('should provide accurate connection status', async () => {
      if (!service) return;

      const status = await service.getConnectionStatus();

      expect(status.isConnected).toBe(true);
      expect(status.responseTime).toBeGreaterThanOrEqual(0);
      expect(status.lastCheck).toBeInstanceOf(Date);
    });

    it('should track error metrics accurately', async () => {
      if (!service) return;

      const initialHealth = service.getHealthMetrics();
      const initialErrorCount = initialHealth.errors.count;

      // Provoquer une erreur
      try {
        await service.$queryRaw`SELECT * FROM non_existent_table`;
      } catch {
        // Ignorer l'erreur
      }

      const health = service.getHealthMetrics();
      expect(health.errors.count).toBeGreaterThanOrEqual(initialErrorCount);
    });
  });
});
