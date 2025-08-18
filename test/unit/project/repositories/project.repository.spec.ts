/**
 * Tests unitaires pour ProjectRepository - VERSION CORRIGÉE COMPLÈTE
 *
 * Résout tous les problèmes identifiés :
 * - UUIDs valides au format v4 pour tous les IDs
 * - Validation des fileIds comme UUIDs
 * - Comportement exact du repository (filtres, tri, includes)
 * - Gestion correcte des erreurs et validations
 *
 * @fileoverview Tests unitaires du repository Project (version corrigée complète)
 * @version 1.0.2
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

  // ========================================================================
  // FIXTURES ET DONNÉES DE TEST - UUIDs VALIDES
  // ========================================================================

  // UUIDs valides au format v4 strict (3ème groupe commence par 4, 4ème par [89ab])
  const mockUserId = '550e8400-e29b-41d4-a716-446655440000';
  const mockProjectId = '6ba7b810-9dad-41d1-80b4-00c04fd430c8';
  const mockOtherUserId = '123e4567-e89b-42d3-a456-426614174000';

  // FileIds valides (UUIDs v4 stricts)
  const validFileId1 = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
  const validFileId2 = 'f47ac10b-58cc-4372-a567-0e02b2c3d480';
  const validFileId3 = 'f47ac10b-58cc-4372-a567-0e02b2c3d481';

  const createMockPrismaProject = (
    overrides: Partial<MockPrismaProject> = {},
  ): MockPrismaProject => ({
    id: mockProjectId,
    name: 'Test Project',
    description: 'Test description',
    initialPrompt: 'Create a test application with comprehensive functionality',
    status: 'ACTIVE',
    uploadedFileIds: [validFileId1],
    generatedFileIds: [validFileId2, validFileId3],
    ownerId: mockUserId,
    createdAt: new Date('2024-01-01T10:00:00Z'),
    updatedAt: new Date('2024-01-01T10:00:00Z'),
    statistics: null,
    ...overrides,
  });

  const createValidCreateData = (): CreateProjectData => ({
    name: 'New Test Project',
    description: 'A new test project with detailed description',
    initialPrompt:
      'Create a new comprehensive application with modern architecture',
    uploadedFileIds: [validFileId1, validFileId2],
  });

  const createValidUpdateData = (): UpdateProjectData => ({
    name: 'Updated Project Name',
    description: 'Updated comprehensive description',
  });

  const createMockPaginationDto = (): PaginationDto => {
    const dto = new PaginationDto();
    dto.page = 1;
    dto.limit = 10;

    // Mock des méthodes si elles existent
    if (typeof dto.getSkip === 'undefined') {
      (dto as any).getSkip = jest.fn().mockReturnValue(0);
    }
    if (typeof dto.getTake === 'undefined') {
      (dto as any).getTake = jest.fn().mockReturnValue(10);
    }
    if (typeof dto.isValid === 'undefined') {
      (dto as any).isValid = jest.fn().mockReturnValue(true);
    }

    return dto;
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
      // Arrange
      const createData = createValidCreateData();
      const expectedPrismaProject = createMockPrismaProject({
        name: createData.name,
        description: createData.description,
        initialPrompt: createData.initialPrompt,
        uploadedFileIds: createData.uploadedFileIds,
      });

      mockDatabaseService.project.create.mockResolvedValue(
        expectedPrismaProject,
      );

      // Act
      const result = await repository.create(createData, mockUserId);

      // Assert
      expect(result).toBeInstanceOf(ProjectEntity);
      expect(result.id).toBe(mockProjectId);
      expect(result.name).toBe(createData.name);
      expect(result.ownerId).toBe(mockUserId);
      expect(mockDatabaseService.project.create).toHaveBeenCalledWith({
        data: {
          name: createData.name,
          description: createData.description,
          initialPrompt: createData.initialPrompt,
          uploadedFileIds: createData.uploadedFileIds,
          generatedFileIds: [],
          ownerId: mockUserId,
          status: 'ACTIVE',
        },
        include: {
          statistics: false,
        },
      });
    });

    it('should create a project with minimal data', async () => {
      // Arrange
      const minimalData: CreateProjectData = {
        name: 'Minimal Project',
        initialPrompt:
          'Simple prompt but with sufficient length for validation',
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

      // Act
      const result = await repository.create(minimalData, mockUserId);

      // Assert
      expect(result.name).toBe(minimalData.name);
      expect(result.description).toBeUndefined();
      expect(mockDatabaseService.project.create).toHaveBeenCalledWith({
        data: {
          name: minimalData.name,
          description: null,
          initialPrompt: minimalData.initialPrompt,
          uploadedFileIds: [],
          generatedFileIds: [],
          ownerId: mockUserId,
          status: 'ACTIVE',
        },
        include: {
          statistics: false,
        },
      });
    });

    it('should handle Prisma constraint violation error', async () => {
      // Arrange
      const createData = createValidCreateData();
      const prismaError = new Error('Unique constraint failed');
      (prismaError as any).code = 'P2002';
      (prismaError as any).meta = { target: ['name', 'ownerId'] };

      mockDatabaseService.project.create.mockRejectedValue(prismaError);

      // Act & Assert
      await expect(repository.create(createData, mockUserId)).rejects.toThrow(
        ProjectConstraintError,
      );
    });

    it('should handle invalid file ID validation', async () => {
      // Arrange
      const createData: CreateProjectData = {
        name: 'Test Project',
        initialPrompt: 'Valid initial prompt with sufficient length',
        uploadedFileIds: ['invalid-file-id'], // ID invalide
      };

      // Act & Assert
      await expect(repository.create(createData, mockUserId)).rejects.toThrow(
        ProjectConstraintError,
      );
      expect(mockDatabaseService.project.create).not.toHaveBeenCalled();
    });

    it('should handle invalid owner ID validation', async () => {
      // Arrange
      const createData = createValidCreateData();
      const invalidOwnerId = 'invalid-owner-id'; // ID invalide

      // Act & Assert
      await expect(
        repository.create(createData, invalidOwnerId),
      ).rejects.toThrow(ProjectConstraintError);
      expect(mockDatabaseService.project.create).not.toHaveBeenCalled();
    });

    it('should create project with valid file IDs (all UUIDs)', async () => {
      // Arrange
      const validData: CreateProjectData = {
        name: 'x'.repeat(100), // Longueur maximale
        description: 'y'.repeat(1000), // Longueur maximale
        initialPrompt: 'z'.repeat(50), // Longueur valide
        uploadedFileIds: [validFileId1, validFileId2, validFileId3], // UUIDs valides
      };
      const expectedPrismaProject = createMockPrismaProject(validData);

      mockDatabaseService.project.create.mockResolvedValue(
        expectedPrismaProject,
      );

      // Act
      const result = await repository.create(validData, mockUserId);

      // Assert
      expect(result.name).toBe(validData.name);
      expect(result.description).toBe(validData.description);
      expect(result.uploadedFileIds).toHaveLength(3);
    });
  });

  // ========================================================================
  // TESTS DE LA MÉTHODE FINDBYID
  // ========================================================================

  describe('findById', () => {
    it('should find project by ID without statistics', async () => {
      // Arrange
      const prismaProject = createMockPrismaProject();
      mockDatabaseService.project.findUnique.mockResolvedValue(prismaProject);

      // Act
      const result = await repository.findById(mockProjectId, false);

      // Assert
      expect(result).toBeInstanceOf(ProjectEntity);
      expect(result!.id).toBe(mockProjectId);
      expect(mockDatabaseService.project.findUnique).toHaveBeenCalledWith({
        where: { id: mockProjectId },
        include: { statistics: false },
      });
    });

    it('should find project by ID with statistics', async () => {
      // Arrange
      const prismaProject = createMockPrismaProject({
        statistics: {
          id: 'f47ac10b-58cc-4372-a567-0e02b2c3d490',
          projectId: mockProjectId,
          costs: { total: 1.5 },
          performance: { generationTime: 5000 },
          usage: { documentsGenerated: 3 },
          lastUpdated: new Date(),
        },
      });
      mockDatabaseService.project.findUnique.mockResolvedValue(prismaProject);

      // Act
      const result = await repository.findById(mockProjectId, true);

      // Assert
      expect(result!.statistics).toBeDefined();
      expect(mockDatabaseService.project.findUnique).toHaveBeenCalledWith({
        where: { id: mockProjectId },
        include: { statistics: true },
      });
    });

    it('should return null when project not found', async () => {
      // Arrange
      const validNonExistentId = 'f47ac10b-58cc-4372-a567-0e02b2c3d999';
      mockDatabaseService.project.findUnique.mockResolvedValue(null);

      // Act
      const result = await repository.findById(validNonExistentId);

      // Assert
      expect(result).toBeNull();
      expect(mockDatabaseService.project.findUnique).toHaveBeenCalledWith({
        where: { id: validNonExistentId },
        include: { statistics: false },
      });
    });

    it('should handle invalid project ID', async () => {
      // Arrange
      const invalidId = 'invalid-project-id';

      // Act & Assert
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
      // Arrange
      const pagination = createMockPaginationDto();
      const prismaProjects = [
        createMockPrismaProject(),
        createMockPrismaProject({
          id: 'f47ac10b-58cc-4372-a567-0e02b2c3d482',
          name: 'Project 2',
        }),
      ];

      mockDatabaseService.project.findMany.mockResolvedValue(prismaProjects);
      mockDatabaseService.project.count.mockResolvedValue(2);

      // Act
      const result = await repository.findByOwner(mockUserId, pagination);

      // Assert
      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(10);

      expect(mockDatabaseService.project.findMany).toHaveBeenCalledWith({
        where: {
          ownerId: mockUserId,
          status: { not: 'DELETED' },
        },
        include: { statistics: false },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 10,
      });

      expect(mockDatabaseService.project.count).toHaveBeenCalledWith({
        where: {
          ownerId: mockUserId,
          status: { not: 'DELETED' },
        },
      });
    });

    it('should apply status filter', async () => {
      // Arrange
      const pagination = createMockPaginationDto();
      const filters = { status: ProjectStatus.ACTIVE };
      const prismaProjects = [createMockPrismaProject({ status: 'ACTIVE' })];

      mockDatabaseService.project.findMany.mockResolvedValue(prismaProjects);
      mockDatabaseService.project.count.mockResolvedValue(1);

      // Act
      const result = await repository.findByOwner(
        mockUserId,
        pagination,
        filters,
      );

      // Assert
      expect(mockDatabaseService.project.findMany).toHaveBeenCalledWith({
        where: {
          ownerId: mockUserId,
          status: 'ACTIVE',
        },
        include: { statistics: false },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 10,
      });
    });

    it('should apply search filter', async () => {
      // Arrange
      const pagination = createMockPaginationDto();
      const filters = { search: 'test project' };
      const prismaProjects = [createMockPrismaProject()];

      mockDatabaseService.project.findMany.mockResolvedValue(prismaProjects);
      mockDatabaseService.project.count.mockResolvedValue(1);

      // Act
      await repository.findByOwner(mockUserId, pagination, filters);

      // Assert
      expect(mockDatabaseService.project.findMany).toHaveBeenCalledWith({
        where: {
          ownerId: mockUserId,
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
      // Arrange
      const pagination = createMockPaginationDto();

      mockDatabaseService.project.findMany.mockResolvedValue([]);
      mockDatabaseService.project.count.mockResolvedValue(0);

      // Act
      const result = await repository.findByOwner(mockUserId, pagination);

      // Assert
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
      // Arrange
      const updateData = createValidUpdateData();
      const currentProject = createMockPrismaProject();
      const updatedPrismaProject = createMockPrismaProject({
        name: updateData.name,
        description: updateData.description,
        updatedAt: new Date('2024-01-02T10:00:00Z'),
      });

      // Mock findById pour la vérification d'existence
      mockDatabaseService.project.findUnique.mockResolvedValue(currentProject);
      mockDatabaseService.project.update.mockResolvedValue(
        updatedPrismaProject,
      );

      // Act
      const result = await repository.update(mockProjectId, updateData);

      // Assert
      expect(result).toBeInstanceOf(ProjectEntity);
      expect(result.name).toBe(updateData.name);
      expect(result.description).toBe(updateData.description);
      expect(mockDatabaseService.project.update).toHaveBeenCalledWith({
        where: {
          id: mockProjectId,
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
      // Arrange
      const updateData = createValidUpdateData();
      mockDatabaseService.project.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(
        repository.update(mockProjectId, updateData),
      ).rejects.toThrow(ProjectNotFoundError);
    });
  });

  // ========================================================================
  // TESTS DE LA MÉTHODE DELETE
  // ========================================================================

  describe('delete', () => {
    it('should soft delete project successfully', async () => {
      // Arrange
      const deletedProject = createMockPrismaProject({ status: 'DELETED' });
      mockDatabaseService.project.update.mockResolvedValue(deletedProject);

      // Act
      await repository.delete(mockProjectId);

      // Assert
      expect(mockDatabaseService.project.update).toHaveBeenCalledWith({
        where: { id: mockProjectId },
        data: {
          status: 'DELETED',
          updatedAt: expect.any(Date),
        },
      });
    });

    it('should handle project not found during delete', async () => {
      // Arrange
      const prismaError = new Error('Record to update not found');
      (prismaError as any).code = 'P2025';

      mockDatabaseService.project.update.mockRejectedValue(prismaError);

      // Act & Assert
      await expect(repository.delete(mockProjectId)).rejects.toThrow(
        ProjectNotFoundError,
      );
    });
  });

  // ========================================================================
  // TESTS DES MÉTHODES SPÉCIALISÉES
  // ========================================================================

  describe('findByNameAndOwner', () => {
    it('should find project by name and owner', async () => {
      // Arrange
      const projectName = 'Unique Project Name';
      const prismaProject = createMockPrismaProject({ name: projectName });

      mockDatabaseService.project.findFirst.mockResolvedValue(prismaProject);

      // Act
      const result = await repository.findByNameAndOwner(
        projectName,
        mockUserId,
      );

      // Assert
      expect(result).toBeInstanceOf(ProjectEntity);
      expect(result!.name).toBe(projectName);
      expect(mockDatabaseService.project.findFirst).toHaveBeenCalledWith({
        where: {
          name: {
            equals: projectName,
            mode: 'insensitive',
          },
          ownerId: mockUserId,
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
      // Arrange
      mockDatabaseService.project.findFirst.mockResolvedValue(null);

      // Act
      const result = await repository.findByNameAndOwner(
        'Non-existent',
        mockUserId,
      );

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('countByOwner', () => {
    it('should count projects for owner', async () => {
      // Arrange
      mockDatabaseService.project.count.mockResolvedValue(5);

      // Act
      const result = await repository.countByOwner(mockUserId);

      // Assert
      expect(result).toBe(5);
      expect(mockDatabaseService.project.count).toHaveBeenCalledWith({
        where: {
          ownerId: mockUserId,
          status: {
            not: 'DELETED',
          },
        },
      });
    });

    it('should count projects with filters', async () => {
      // Arrange
      const filters = { status: ProjectStatus.ACTIVE };
      mockDatabaseService.project.count.mockResolvedValue(3);

      // Act
      const result = await repository.countByOwner(mockUserId, filters);

      // Assert
      expect(result).toBe(3);
      expect(mockDatabaseService.project.count).toHaveBeenCalledWith({
        where: {
          ownerId: mockUserId,
          status: 'ACTIVE',
        },
      });
    });
  });

  describe('existsForOwner', () => {
    it('should return true when project exists for owner', async () => {
      // Arrange
      mockDatabaseService.project.findUnique.mockResolvedValue(
        createMockPrismaProject(),
      );

      // Act
      const result = await repository.existsForOwner(mockProjectId, mockUserId);

      // Assert
      expect(result).toBe(true);
      expect(mockDatabaseService.project.findUnique).toHaveBeenCalledWith({
        where: {
          id: mockProjectId,
          ownerId: mockUserId,
        },
        select: { id: true },
      });
    });

    it('should return false when project does not exist', async () => {
      // Arrange
      mockDatabaseService.project.findUnique.mockResolvedValue(null);

      // Act
      const result = await repository.existsForOwner(mockProjectId, mockUserId);

      // Assert
      expect(result).toBe(false);
    });
  });
});
