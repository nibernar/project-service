/**
 * Tests unitaires pour ProjectRepository - VERSION AVEC FIXTURES
 *
 * Teste le repository avec données cohérentes et centralisées :
 * - UUIDs valides depuis les fixtures 
 * - Validation des fileIds et opérations CRUD
 * - Comportement exact du repository (filtres, tri, includes)
 * - Gestion correcte des erreurs et validations
 * - Edge cases et scénarios limites
 *
 * @fileoverview Tests unitaires du repository Project (version avec fixtures)
 * @version 2.0.0
 */

import { Test, TestingModule } from '@nestjs/testing';
import {
  ProjectRepository,
  ProjectNotFoundError,
  ProjectOwnershipError,
  ProjectConstraintError,
  ProjectOptimisticLockError,
} from '../../../../src/project/project.repository';
import { DatabaseService } from '../../../../src/database/database.service';
import {
  ProjectEntity,
  CreateProjectData,
  UpdateProjectData,
} from '../../../../src/project/entities/project.entity';
import { ProjectStatus } from '../../../../src/common/enums/project-status.enum';
import { PaginationDto } from '../../../../src/common/dto/pagination.dto';

// Import des fixtures centralisées
import { TestFixtures } from '../../../fixtures/project.fixtures';

// ========================================================================
// INTERFACES ET TYPES POUR LES MOCKS
// ========================================================================

interface MockPrismaProject {
  id: string;
  name: string;
  description?: string | null;
  initialPrompt: string;
  status: string;
  uploadedFileIds: string[];
  generatedFileIds: string[];
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
  statistics?: any;
}

// Mock type pour DatabaseService
interface MockDatabaseService {
  project: {
    create: jest.MockedFunction<any>;
    findUnique: jest.MockedFunction<any>;
    findMany: jest.MockedFunction<any>;
    findFirst: jest.MockedFunction<any>;
    update: jest.MockedFunction<any>;
    delete: jest.MockedFunction<any>;
    count: jest.MockedFunction<any>;
    createMany: jest.MockedFunction<any>;
    updateMany: jest.MockedFunction<any>;
    deleteMany: jest.MockedFunction<any>;
    upsert: jest.MockedFunction<any>;
    aggregate: jest.MockedFunction<any>;
    groupBy: jest.MockedFunction<any>;
  };
  projectStatistics: {
    findUnique: jest.MockedFunction<any>;
    create: jest.MockedFunction<any>;
    update: jest.MockedFunction<any>;
    delete: jest.MockedFunction<any>;
  };
  $transaction: jest.MockedFunction<any>;
  $queryRaw: jest.MockedFunction<any>;
  $executeRaw: jest.MockedFunction<any>;
}

describe('ProjectRepository', () => {
  let repository: ProjectRepository;
  let mockDatabaseService: MockDatabaseService;

  // Données de test cohérentes depuis les fixtures
  const mockUser = TestFixtures.users.validUser();
  const otherUser = TestFixtures.users.otherUser();

  // Helper pour créer un projet Prisma depuis une entité
  const createMockPrismaProject = (
    overrides: Partial<MockPrismaProject> = {},
  ): MockPrismaProject => {
    const baseProject = TestFixtures.projects.mockProject();
    return {
      id: baseProject.id,
      name: baseProject.name,
      description: baseProject.description,
      initialPrompt: baseProject.initialPrompt,
      status: baseProject.status,
      uploadedFileIds: baseProject.uploadedFileIds,
      generatedFileIds: baseProject.generatedFileIds,
      ownerId: baseProject.ownerId,
      createdAt: baseProject.createdAt,
      updatedAt: baseProject.updatedAt,
      statistics: null,
      ...overrides,
    };
  };

  // ========================================================================
  // CONFIGURATION DU MODULE DE TEST
  // ========================================================================

  beforeEach(async () => {
    // Mock complet de DatabaseService avec types appropriés
    mockDatabaseService = {
      project: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
        createMany: jest.fn(),
        updateMany: jest.fn(),
        deleteMany: jest.fn(),
        upsert: jest.fn(),
        aggregate: jest.fn(),
        groupBy: jest.fn(),
      },
      projectStatistics: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      $transaction: jest.fn(),
      $queryRaw: jest.fn(),
      $executeRaw: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectRepository,
        {
          provide: DatabaseService,
          useValue: mockDatabaseService,
        },
      ],
    }).compile();

    repository = module.get<ProjectRepository>(ProjectRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ========================================================================
  // TESTS DE LA MÉTHODE CREATE
  // ========================================================================

  describe('create', () => {
    it('should create a project successfully', async () => {
      // Utilisation des fixtures pour les données de création
      const createDto = TestFixtures.projects.validCreateDto();
      const createData: CreateProjectData = {
        name: createDto.name,
        description: createDto.description,
        initialPrompt: createDto.initialPrompt,
        uploadedFileIds: createDto.uploadedFileIds || [],
      };

      const expectedPrismaProject = createMockPrismaProject({
        name: createData.name,
        description: createData.description,
        initialPrompt: createData.initialPrompt,
        uploadedFileIds: createData.uploadedFileIds,
      });

      mockDatabaseService.project.create.mockResolvedValue(
        expectedPrismaProject,
      );

      const result = await repository.create(createData, mockUser.id);

      expect(result).toBeInstanceOf(ProjectEntity);
      expect(result.id).toBe(TestFixtures.ids.PROJECT_1);
      expect(result.name).toBe(createData.name);
      expect(result.ownerId).toBe(mockUser.id);
      expect(mockDatabaseService.project.create).toHaveBeenCalledWith({
        data: {
          name: createData.name,
          description: createData.description,
          initialPrompt: createData.initialPrompt,
          uploadedFileIds: createData.uploadedFileIds,
          generatedFileIds: [],
          ownerId: mockUser.id,
          status: 'ACTIVE',
        },
        include: {
          statistics: false,
        },
      });
    });

    it('should create a project with minimal data', async () => {
      // Utilisation du DTO minimal depuis les fixtures
      const minimalDto = TestFixtures.projects.minimalCreateDto();
      const minimalData: CreateProjectData = {
        name: minimalDto.name,
        initialPrompt: minimalDto.initialPrompt,
        uploadedFileIds: [],
      };

      const expectedPrismaProject = createMockPrismaProject({
        name: minimalData.name,
        description: null,
        initialPrompt: minimalData.initialPrompt,
        uploadedFileIds: [],
      });

      mockDatabaseService.project.create.mockResolvedValue(
        expectedPrismaProject,
      );

      const result = await repository.create(minimalData, mockUser.id);

      expect(result.name).toBe(minimalData.name);
      expect(result.description).toBeUndefined();
      expect(mockDatabaseService.project.create).toHaveBeenCalledWith({
        data: {
          name: minimalData.name,
          description: null,
          initialPrompt: minimalData.initialPrompt,
          uploadedFileIds: [],
          generatedFileIds: [],
          ownerId: mockUser.id,
          status: 'ACTIVE',
        },
        include: {
          statistics: false,
        },
      });
    });

    it('should handle Prisma constraint violation error', async () => {
      const createDto = TestFixtures.projects.validCreateDto();
      const createData: CreateProjectData = {
        name: createDto.name,
        description: createDto.description,
        initialPrompt: createDto.initialPrompt,
        uploadedFileIds: createDto.uploadedFileIds || [],
      };

      const prismaError = new Error('Unique constraint failed');
      (prismaError as any).code = 'P2002';
      (prismaError as any).meta = { target: ['name', 'ownerId'] };

      mockDatabaseService.project.create.mockRejectedValue(prismaError);

      await expect(repository.create(createData, mockUser.id)).rejects.toThrow(
        ProjectConstraintError,
      );
    });

    it('should handle invalid file ID validation', async () => {
      const createData: CreateProjectData = {
        name: 'Test Project',
        initialPrompt: 'Valid initial prompt with sufficient length',
        uploadedFileIds: ['invalid-file-id'], // ID invalide
      };

      await expect(repository.create(createData, mockUser.id)).rejects.toThrow(
        ProjectConstraintError,
      );
      expect(mockDatabaseService.project.create).not.toHaveBeenCalled();
    });

    it('should handle invalid owner ID validation', async () => {
      const createDto = TestFixtures.projects.validCreateDto();
      const createData: CreateProjectData = {
        name: createDto.name,
        description: createDto.description,
        initialPrompt: createDto.initialPrompt,
        uploadedFileIds: createDto.uploadedFileIds || [],
      };
      const invalidOwnerId = 'invalid-owner-id';

      await expect(
        repository.create(createData, invalidOwnerId),
      ).rejects.toThrow(ProjectConstraintError);
      expect(mockDatabaseService.project.create).not.toHaveBeenCalled();
    });

    it('should create project with valid file IDs (all UUIDs)', async () => {
      // Utilisation des fichiers depuis les fixtures
      const validFileIds = TestFixtures.files.mixedFileIds();
      const createDto = TestFixtures.projects.validCreateDto();
      
      const validData: CreateProjectData = {
        name: 'x'.repeat(100), // Longueur maximale
        description: 'y'.repeat(1000), // Longueur maximale
        initialPrompt: createDto.initialPrompt,
        uploadedFileIds: validFileIds,
      };

      const expectedPrismaProject = createMockPrismaProject(validData);
      mockDatabaseService.project.create.mockResolvedValue(
        expectedPrismaProject,
      );

      const result = await repository.create(validData, mockUser.id);

      expect(result.name).toBe(validData.name);
      expect(result.description).toBe(validData.description);
      expect(result.uploadedFileIds).toHaveLength(validFileIds.length);
    });
  });

  // ========================================================================
  // TESTS DE LA MÉTHODE FINDBYID
  // ========================================================================

  describe('findById', () => {
    it('should find project by ID without statistics', async () => {
      const prismaProject = createMockPrismaProject();
      mockDatabaseService.project.findUnique.mockResolvedValue(prismaProject);

      const result = await repository.findById(TestFixtures.ids.PROJECT_1, false);

      expect(result).toBeInstanceOf(ProjectEntity);
      expect(result!.id).toBe(TestFixtures.ids.PROJECT_1);
      expect(mockDatabaseService.project.findUnique).toHaveBeenCalledWith({
        where: { id: TestFixtures.ids.PROJECT_1 },
        include: { statistics: false },
      });
    });

    it('should find project by ID with statistics', async () => {
      // Utilisation des statistiques depuis les fixtures
      const stats = TestFixtures.statistics.completeStats();
      const prismaProject = createMockPrismaProject({
        statistics: {
          id: stats.id,
          projectId: TestFixtures.ids.PROJECT_1,
          costs: stats.costs,
          performance: stats.performance,
          usage: stats.usage,
          lastUpdated: stats.lastUpdated,
        },
      });
      mockDatabaseService.project.findUnique.mockResolvedValue(prismaProject);

      const result = await repository.findById(TestFixtures.ids.PROJECT_1, true);

      expect(result!.statistics).toBeDefined();
      expect(mockDatabaseService.project.findUnique).toHaveBeenCalledWith({
        where: { id: TestFixtures.ids.PROJECT_1 },
        include: { statistics: true },
      });
    });

    it('should return null when project not found', async () => {
      const validNonExistentId = TestFixtures.ids.PROJECT_3; // ID valide mais inexistant
      mockDatabaseService.project.findUnique.mockResolvedValue(null);

      const result = await repository.findById(validNonExistentId);

      expect(result).toBeNull();
      expect(mockDatabaseService.project.findUnique).toHaveBeenCalledWith({
        where: { id: validNonExistentId },
        include: { statistics: false },
      });
    });

    it('should handle invalid project ID', async () => {
      const invalidId = 'invalid-project-id';

      await expect(repository.findById(invalidId)).rejects.toThrow(
        ProjectConstraintError,
      );
      expect(mockDatabaseService.project.findUnique).not.toHaveBeenCalled();
    });
  });

  // ========================================================================
  // TESTS DE LA MÉTHODE FINDBYOWNER
  // ========================================================================

  describe('findByOwner', () => {
    it('should find projects by owner with pagination', async () => {
      const pagination = TestFixtures.helpers.createPaginationDto(1, 10);
      const prismaProjects = [
        createMockPrismaProject(),
        createMockPrismaProject({
          id: TestFixtures.ids.PROJECT_2,
          name: 'Plateforme de Blog',
        }),
      ];

      mockDatabaseService.project.findMany.mockResolvedValue(prismaProjects);
      mockDatabaseService.project.count.mockResolvedValue(2);

      const result = await repository.findByOwner(mockUser.id, pagination);

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(10);

      expect(mockDatabaseService.project.findMany).toHaveBeenCalledWith({
        where: {
          ownerId: mockUser.id,
          status: { not: 'DELETED' },
        },
        include: { statistics: false },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 10,
      });

      expect(mockDatabaseService.project.count).toHaveBeenCalledWith({
        where: {
          ownerId: mockUser.id,
          status: { not: 'DELETED' },
        },
      });
    });

    it('should apply status filter', async () => {
      const pagination = TestFixtures.helpers.createPaginationDto(1, 10);
      const filters = { status: ProjectStatus.ACTIVE };
      const prismaProjects = [createMockPrismaProject({ status: 'ACTIVE' })];

      mockDatabaseService.project.findMany.mockResolvedValue(prismaProjects);
      mockDatabaseService.project.count.mockResolvedValue(1);

      const result = await repository.findByOwner(
        mockUser.id,
        pagination,
        filters,
      );

      expect(mockDatabaseService.project.findMany).toHaveBeenCalledWith({
        where: {
          ownerId: mockUser.id,
          status: 'ACTIVE',
        },
        include: { statistics: false },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 10,
      });
    });

    it('should apply search filter', async () => {
      const pagination = TestFixtures.helpers.createPaginationDto(1, 10);
      const filters = { search: 'test project' };
      const prismaProjects = [createMockPrismaProject()];

      mockDatabaseService.project.findMany.mockResolvedValue(prismaProjects);
      mockDatabaseService.project.count.mockResolvedValue(1);

      await repository.findByOwner(mockUser.id, pagination, filters);

      expect(mockDatabaseService.project.findMany).toHaveBeenCalledWith({
        where: {
          ownerId: mockUser.id,
          status: { not: 'DELETED' },
          OR: [
            { name: { contains: 'test project', mode: 'insensitive' } },
            { description: { contains: 'test project', mode: 'insensitive' } },
          ],
        },
        include: { statistics: false },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 10,
      });
    });

    it('should handle empty results', async () => {
      const pagination = TestFixtures.helpers.createPaginationDto(1, 10);

      mockDatabaseService.project.findMany.mockResolvedValue([]);
      mockDatabaseService.project.count.mockResolvedValue(0);

      const result = await repository.findByOwner(mockUser.id, pagination);

      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.pagination.hasNext).toBe(false);
      expect(result.pagination.hasPrevious).toBe(false);
    });
  });

  // ========================================================================
  // TESTS DE LA MÉTHODE UPDATE
  // ========================================================================

  describe('update', () => {
    it('should update project successfully', async () => {
      const updateDto = TestFixtures.projects.validUpdateDto();
      const updateData: UpdateProjectData = {
        name: updateDto.name,
        description: updateDto.description,
      };

      const currentProject = createMockPrismaProject();
      const updatedPrismaProject = createMockPrismaProject({
        name: updateData.name,
        description: updateData.description,
        updatedAt: new Date('2024-01-02T10:00:00Z'),
      });

      mockDatabaseService.project.findUnique.mockResolvedValue(currentProject);
      mockDatabaseService.project.update.mockResolvedValue(
        updatedPrismaProject,
      );

      const result = await repository.update(TestFixtures.ids.PROJECT_1, updateData);

      expect(result).toBeInstanceOf(ProjectEntity);
      expect(result.name).toBe(updateData.name);
      expect(result.description).toBe(updateData.description);
      expect(mockDatabaseService.project.update).toHaveBeenCalledWith({
        where: {
          id: TestFixtures.ids.PROJECT_1,
          updatedAt: currentProject.updatedAt,
        },
        data: {
          name: updateData.name,
          description: updateData.description,
        },
        include: { statistics: false },
      });
    });

    it('should handle project not found error', async () => {
      const updateDto = TestFixtures.projects.validUpdateDto();
      const updateData: UpdateProjectData = {
        name: updateDto.name,
        description: updateDto.description,
      };

      mockDatabaseService.project.findUnique.mockResolvedValue(null);

      await expect(
        repository.update(TestFixtures.ids.PROJECT_1, updateData),
      ).rejects.toThrow(ProjectNotFoundError);
    });
  });

  // ========================================================================
  // TESTS DE LA MÉTHODE DELETE
  // ========================================================================

  describe('delete', () => {
    it('should soft delete project successfully', async () => {
      const deletedProject = createMockPrismaProject({ status: 'DELETED' });
      mockDatabaseService.project.update.mockResolvedValue(deletedProject);

      await repository.delete(TestFixtures.ids.PROJECT_1);

      expect(mockDatabaseService.project.update).toHaveBeenCalledWith({
        where: { id: TestFixtures.ids.PROJECT_1 },
        data: {
          status: 'DELETED',
          updatedAt: expect.any(Date),
        },
      });
    });

    it('should handle project not found during delete', async () => {
      const prismaError = new Error('Record to update not found');
      (prismaError as any).code = 'P2025';

      mockDatabaseService.project.update.mockRejectedValue(prismaError);

      await expect(repository.delete(TestFixtures.ids.PROJECT_1)).rejects.toThrow(
        ProjectNotFoundError,
      );
    });
  });

  // ========================================================================
  // TESTS DES MÉTHODES SPÉCIALISÉES
  // ========================================================================

  describe('findByNameAndOwner', () => {
    it('should find project by name and owner', async () => {
      const projectName = 'Application E-commerce';
      const prismaProject = createMockPrismaProject({ name: projectName });

      mockDatabaseService.project.findFirst.mockResolvedValue(prismaProject);

      const result = await repository.findByNameAndOwner(
        projectName,
        mockUser.id,
      );

      expect(result).toBeInstanceOf(ProjectEntity);
      expect(result!.name).toBe(projectName);
      expect(mockDatabaseService.project.findFirst).toHaveBeenCalledWith({
        where: {
          name: {
            equals: projectName,
            mode: 'insensitive',
          },
          ownerId: mockUser.id,
          status: {
            not: 'DELETED',
          },
        },
        include: {
          statistics: false,
        },
      });
    });

    it('should return null when project not found', async () => {
      mockDatabaseService.project.findFirst.mockResolvedValue(null);

      const result = await repository.findByNameAndOwner(
        'Non-existent Project',
        mockUser.id,
      );

      expect(result).toBeNull();
    });
  });

  describe('countByOwner', () => {
    it('should count projects for owner', async () => {
      mockDatabaseService.project.count.mockResolvedValue(5);

      const result = await repository.countByOwner(mockUser.id);

      expect(result).toBe(5);
      expect(mockDatabaseService.project.count).toHaveBeenCalledWith({
        where: {
          ownerId: mockUser.id,
          status: {
            not: 'DELETED',
          },
        },
      });
    });

    it('should count projects with filters', async () => {
      const filters = { status: ProjectStatus.ACTIVE };
      mockDatabaseService.project.count.mockResolvedValue(3);

      const result = await repository.countByOwner(mockUser.id, filters);

      expect(result).toBe(3);
      expect(mockDatabaseService.project.count).toHaveBeenCalledWith({
        where: {
          ownerId: mockUser.id,
          status: 'ACTIVE',
        },
      });
    });
  });

  describe('existsForOwner', () => {
    it('should return true when project exists for owner', async () => {
      mockDatabaseService.project.findUnique.mockResolvedValue(
        createMockPrismaProject(),
      );

      const result = await repository.existsForOwner(TestFixtures.ids.PROJECT_1, mockUser.id);

      expect(result).toBe(true);
      expect(mockDatabaseService.project.findUnique).toHaveBeenCalledWith({
        where: {
          id: TestFixtures.ids.PROJECT_1,
          ownerId: mockUser.id,
        },
        select: { id: true },
      });
    });

    it('should return false when project does not exist', async () => {
      mockDatabaseService.project.findUnique.mockResolvedValue(null);

      const result = await repository.existsForOwner(TestFixtures.ids.PROJECT_1, mockUser.id);

      expect(result).toBe(false);
    });
  });

  // ========================================================================
  // TESTS D'EDGE CASES ET SCÉNARIOS LIMITES
  // ========================================================================

  describe('edge cases', () => {
    it('should handle very long project lists', async () => {
      const pagination = TestFixtures.helpers.createPaginationDto(1, 100);
      // Utilisation des données de performance depuis les fixtures
      const performanceData = TestFixtures.generator.createPerformanceTestData();
      const prismaProjects = performanceData.multipleProjects.slice(0, 100).map(entity => 
        createMockPrismaProject({
          id: entity.id,
          name: entity.name,
          description: entity.description,
        })
      );

      mockDatabaseService.project.findMany.mockResolvedValue(prismaProjects);
      mockDatabaseService.project.count.mockResolvedValue(100);

      const result = await repository.findByOwner(mockUser.id, pagination);

      expect(result.data).toHaveLength(100);
      expect(result.total).toBe(100);
    });

    it('should handle projects with maximum file counts', async () => {
      // Utilisation du projet volumineux depuis les fixtures
      const largeProject = TestFixtures.projects.largeProject();
      const prismaProject = createMockPrismaProject({
        id: largeProject.id,
        name: largeProject.name,
        uploadedFileIds: largeProject.uploadedFileIds,
        generatedFileIds: largeProject.generatedFileIds,
      });

      mockDatabaseService.project.findUnique.mockResolvedValue(prismaProject);

      const result = await repository.findById(largeProject.id);

      expect(result!.uploadedFileIds.length).toBeGreaterThanOrEqual(10);
      expect(result!.generatedFileIds.length).toBeGreaterThanOrEqual(20);
    });

    it('should handle concurrent operations gracefully', async () => {
      const createDto = TestFixtures.projects.validCreateDto();
      const updateDto = TestFixtures.projects.validUpdateDto();
      
      const createData: CreateProjectData = {
        name: createDto.name,
        description: createDto.description,
        initialPrompt: createDto.initialPrompt,
        uploadedFileIds: createDto.uploadedFileIds || [],
      };

      const updateData: UpdateProjectData = {
        name: updateDto.name,
        description: updateDto.description,
      };

      const createPrismaProject = createMockPrismaProject();
      const updatePrismaProject = createMockPrismaProject({ ...updateData });
      const existingProject = createMockPrismaProject();

      mockDatabaseService.project.create.mockResolvedValue(createPrismaProject);
      mockDatabaseService.project.findUnique.mockResolvedValue(existingProject);
      mockDatabaseService.project.update.mockResolvedValue(updatePrismaProject);

      // Simule des opérations simultanées
      const [createResult, updateResult] = await Promise.all([
        repository.create(createData, mockUser.id),
        repository.update(TestFixtures.ids.PROJECT_1, updateData),
      ]);

      expect(createResult.id).toBe(TestFixtures.ids.PROJECT_1);
      expect(updateResult.name).toBe(updateData.name);
    });
  });
});