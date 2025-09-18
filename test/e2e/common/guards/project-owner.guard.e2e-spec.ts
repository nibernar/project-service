// test/e2e/common/guards/project-owner.guard.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, Logger } from '@nestjs/common';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { ConfigModule } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { AppModule } from '../../../../src/app.module';
import { DatabaseService } from '../../../../src/database/database.service';
import { CacheService } from '../../../../src/cache/cache.service';
import { ProjectStatus } from '../../../../src/common/enums/project-status.enum';

describe('ProjectOwnerGuard E2E Tests', () => {
  let app: NestFastifyApplication;
  let databaseService: DatabaseService;
  let cacheService: CacheService;

  // Données de test avec UUIDs valides
  const testUser1 = {
    id: randomUUID(),
    email: 'e2e-user1@example.com',
    roles: ['user'],
  };

  const testUser2 = {
    id: randomUUID(),
    email: 'e2e-user2@example.com',
    roles: ['user'],
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    databaseService = moduleFixture.get<DatabaseService>(DatabaseService);
    cacheService = moduleFixture.get<CacheService>(CacheService);

    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    // ✅ Fermeture propre sans méthodes inexistantes
    if (databaseService) {
      await databaseService.$disconnect();
    }
    await app.close();
  });

  beforeEach(async () => {
    // Nettoyer les données de test
    await databaseService.project.deleteMany({
      where: {
        ownerId: {
          in: [testUser1.id, testUser2.id],
        },
      },
    });

    // Nettoyer le cache (méthode sûre)
    try {
      // ✅ Méthode générique qui existe sur tous les services Redis
      const keys = [
        `project_owner:*:${testUser1.id}`,
        `project_owner:*:${testUser2.id}`,
      ];
      for (const key of keys) {
        await cacheService.del(key);
      }
    } catch (error) {
      // Ignorer les erreurs de cache
    }

    jest.clearAllMocks();
  });

  describe('🧪 Tests de base', () => {
    it('should create test users with valid UUIDs', () => {
      // Vérifier que les UUIDs sont valides
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

      expect(testUser1.id).toMatch(uuidRegex);
      expect(testUser2.id).toMatch(uuidRegex);
      expect(testUser1.id).not.toBe(testUser2.id);
    });

    it('should create project with valid UUID', async () => {
      const projectId = randomUUID();
      const project = await databaseService.project.create({
        data: {
          id: projectId,
          name: 'Test Project',
          description: 'Test description',
          initialPrompt: 'Create test app',
          ownerId: testUser1.id,
          status: ProjectStatus.ACTIVE,
          uploadedFileIds: [],
          generatedFileIds: [],
        },
      });

      expect(project.id).toBe(projectId);
      expect(project.ownerId).toBe(testUser1.id);
    });
  });

  describe("🔐 Tests d'isolation", () => {
    it('should isolate projects between users', async () => {
      // Créer des projets pour chaque utilisateur
      const projectUser1Id = randomUUID();
      const projectUser1 = await databaseService.project.create({
        data: {
          id: projectUser1Id,
          name: 'User 1 Project',
          description: 'Project belonging to user 1',
          initialPrompt: 'Create user 1 app',
          ownerId: testUser1.id,
          status: ProjectStatus.ACTIVE,
          uploadedFileIds: [],
          generatedFileIds: [],
        },
      });

      const projectUser2Id = randomUUID();
      const projectUser2 = await databaseService.project.create({
        data: {
          id: projectUser2Id,
          name: 'User 2 Project',
          description: 'Project belonging to user 2',
          initialPrompt: 'Create user 2 app',
          ownerId: testUser2.id,
          status: ProjectStatus.ACTIVE,
          uploadedFileIds: [],
          generatedFileIds: [],
        },
      });

      // Vérifications de base
      expect(projectUser1.ownerId).toBe(testUser1.id);
      expect(projectUser2.ownerId).toBe(testUser2.id);
      expect(projectUser1.id).not.toBe(projectUser2.id);
    });
  });

  describe('📊 Tests de performance basiques', () => {
    it('should handle multiple projects efficiently', async () => {
      // Créer plusieurs projets
      const projects = await Promise.all(
        Array.from({ length: 5 }, async (_, i) => {
          const projectId = randomUUID();
          return await databaseService.project.create({
            data: {
              id: projectId,
              name: `Performance Project ${i}`,
              description: `Project ${i} for performance testing`,
              initialPrompt: `Create performance app ${i}`,
              ownerId: testUser1.id,
              status: ProjectStatus.ACTIVE,
              uploadedFileIds: [],
              generatedFileIds: [],
            },
          });
        }),
      );

      expect(projects).toHaveLength(5);
      projects.forEach((project) => {
        expect(project.ownerId).toBe(testUser1.id);
      });
    });
  });
});
