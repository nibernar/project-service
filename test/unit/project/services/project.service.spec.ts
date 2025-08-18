/**
 * Tests unitaires pour ProjectService - VERSION CORRIGÉE FINALE
 *
 * Couvre tous les scénarios critiques avec mocks appropriés :
 * - CRUD complet (create, findOne, findAll, update, archive, delete)
 * - Gestion des fichiers générés
 * - Gestion du cache Redis
 * - Publication d'événements
 * - Validation des permissions
 * - Gestion d'erreurs complète
 * - Edge cases et scénarios limites
 *
 * @fileoverview Tests unitaires complets du service Project (version corrigée finale)
 * @version 2.0.0
 */

import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ProjectService } from '../../../../src/project/project.service';
import {
  ProjectRepository,
  ProjectNotFoundError,
  ProjectOwnershipError,
  ProjectConstraintError,
  ProjectOptimisticLockError,
} from '../../../../src/project/project.repository';
import { CacheService } from '../../../../src/cache/cache.service';
import { EventsService } from '../../../../src/events/events.service';
import { CreateProjectDto } from '../../../../src/project/dto/create-project.dto';
import { UpdateProjectDto } from '../../../../src/project/dto/update-project.dto';
import { ProjectResponseDto } from '../../../../src/project/dto/project-response.dto';
import { ProjectListItemDto } from '../../../../src/project/dto/project-list.dto';
import { PaginationDto } from '../../../../src/common/dto/pagination.dto';
import { ProjectEntity } from '../../../../src/project/entities/project.entity';
import { ProjectStatus } from '../../../../src/common/enums/project-status.enum';
import { PaginatedResult } from '../../../../src/common/interfaces/paginated-result.interface';

describe('ProjectService', () => {
  let service: ProjectService;
  let mockRepository: jest.Mocked<ProjectRepository>;
  let mockCacheService: jest.Mocked<CacheService>;
  let mockEventsService: jest.Mocked<EventsService>;

  // ========================================================================
  // FIXTURES ET DONNÉES DE TEST
  // ========================================================================

  const mockUserId = '550e8400-e29b-41d4-a716-446655440000';
  const mockProjectId = '6ba7b810-9dad-41d1-80b4-00c04fd430c8';
  const mockOtherUserId = '123e4567-e89b-42d3-a456-426614174000';

  // ========================================================================
  // FACTORY FUNCTIONS POUR MOCKS SÉCURISÉS
  // ========================================================================

  /**
   * Factory function pour créer des UpdateProjectDto mockables
   * Contourne le problème des propriétés en lecture seule
   */
  const createMockUpdateDto = (data: any = {}, mockMethods: any = {}): any => {
    const mockDto = Object.create(UpdateProjectDto.prototype);

    // Assigner les propriétés de base
    Object.assign(mockDto, {
      name: data.name,
      description: data.description,
    });

    // Ajouter les méthodes mockables avec des valeurs par défaut sensées
    mockDto.hasValidUpdates = jest
      .fn()
      .mockReturnValue(
        mockMethods.hasValidUpdates ??
          (data.name !== undefined || data.description !== undefined),
      );

    mockDto.getDefinedFields = jest.fn().mockReturnValue(
      mockMethods.getDefinedFields ??
        (() => {
          const fields: any = {};
          if (data.name !== undefined) fields.name = data.name;
          if (data.description !== undefined)
            fields.description = data.description;
          return fields;
        })(),
    );

    mockDto.getUpdateFieldsCount = jest
      .fn()
      .mockReturnValue(
        mockMethods.getUpdateFieldsCount ??
          Object.keys(mockDto.getDefinedFields()).length,
      );

    mockDto.isValid = jest.fn().mockReturnValue(mockMethods.isValid ?? true);

    mockDto.isUpdatingName = jest.fn().mockReturnValue(data.name !== undefined);
    mockDto.isUpdatingDescription = jest
      .fn()
      .mockReturnValue(data.description !== undefined);
    mockDto.isClearingDescription = jest
      .fn()
      .mockReturnValue(data.description === '');

    return mockDto;
  };

  const createValidCreateDto = (): CreateProjectDto => {
    const dto = new CreateProjectDto();
    dto.name = 'Test Project';
    dto.description = 'A test project description';
    dto.initialPrompt =
      'Create a simple web application with React and Node.js';
    dto.uploadedFileIds = [
      'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      'f47ac10b-58cc-4372-a567-0e02b2c3d480',
    ];
    return dto;
  };

  const createValidUpdateDto = (): UpdateProjectDto => {
    const dto = new UpdateProjectDto();
    dto.name = 'Updated Project Name';
    dto.description = 'Updated description';
    return dto;
  };

  const createMockProjectEntity = (
    overrides: Partial<ProjectEntity> = {},
  ): ProjectEntity => {
    const project = new ProjectEntity();
    Object.assign(project, {
      id: mockProjectId,
      name: 'Test Project',
      description: 'Test description',
      initialPrompt: 'Create a test application',
      status: ProjectStatus.ACTIVE,
      uploadedFileIds: ['f47ac10b-58cc-4372-a567-0e02b2c3d479'],
      generatedFileIds: [
        'f47ac10b-58cc-4372-a567-0e02b2c3d481',
        'f47ac10b-58cc-4372-a567-0e02b2c3d482',
      ],
      ownerId: mockUserId, // ← IMPORTANT: Par défaut, utilise mockUserId
      createdAt: new Date('2024-01-01T10:00:00Z'),
      updatedAt: new Date('2024-01-01T10:00:00Z'),
      statistics: null,
      ...overrides,
    });

    // Mock des méthodes de l'entité
    project.belongsToUserId = jest
      .fn()
      .mockImplementation((userId: string) => project.ownerId === userId);
    project.canTransitionTo = jest.fn().mockReturnValue(true);
    project.isModifiable = jest
      .fn()
      .mockReturnValue(project.status === ProjectStatus.ACTIVE);
    project.hasStatistics = jest.fn().mockReturnValue(!!project.statistics);
    project.hasUploadedFiles = jest
      .fn()
      .mockReturnValue(project.uploadedFileIds.length > 0);
    project.hasGeneratedFiles = jest
      .fn()
      .mockReturnValue(project.generatedFileIds.length > 0);
    project.getFileCount = jest.fn().mockReturnValue({
      uploaded: project.uploadedFileIds.length,
      generated: project.generatedFileIds.length,
      total: project.uploadedFileIds.length + project.generatedFileIds.length,
    });
    project.getComplexityEstimate = jest.fn().mockReturnValue('medium');

    return project;
  };

  const createMockPaginatedResult = <T>(
    data: T[],
    total: number = data.length,
  ): PaginatedResult<T> => ({
    data,
    total,
    pagination: {
      page: 1,
      limit: 10,
      totalPages: Math.ceil(total / 10),
      hasNext: total > 10,
      hasPrevious: false,
      offset: 0,
    },
  });

  const createMockPaginationDto = (): PaginationDto => {
    const dto = new PaginationDto();
    dto.page = 1;
    dto.limit = 10;
    return dto;
  };

  // ========================================================================
  // CONFIGURATION DU MODULE DE TEST
  // ========================================================================

  beforeEach(async () => {
    // Création des mocks avec toutes les méthodes
    mockRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findByOwner: jest.fn(),
      findByNameAndOwner: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      updateGeneratedFiles: jest.fn(),
      countByOwner: jest.fn(),
      findActiveByOwner: jest.fn(),
      findRecentByOwner: jest.fn(),
      existsForOwner: jest.fn(),
    } as any;

    mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn().mockResolvedValue(undefined),
      invalidateProjectCache: jest.fn().mockResolvedValue(undefined),
      invalidateUserProjectsCache: jest.fn().mockResolvedValue(undefined),
    } as any;

    mockEventsService = {
      publishProjectCreated: jest.fn().mockResolvedValue(undefined),
      publishProjectUpdated: jest.fn().mockResolvedValue(undefined),
      publishProjectArchived: jest.fn().mockResolvedValue(undefined),
      publishProjectDeleted: jest.fn().mockResolvedValue(undefined),
      publishProjectFilesUpdated: jest.fn().mockResolvedValue(undefined),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectService,
        {
          provide: ProjectRepository,
          useValue: mockRepository,
        },
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
        {
          provide: EventsService,
          useValue: mockEventsService,
        },
      ],
    }).compile();

    service = module.get<ProjectService>(ProjectService);
  });

  // Reset des mocks après chaque test
  afterEach(() => {
    jest.clearAllMocks();
  });

  // ========================================================================
  // TESTS DE LA MÉTHODE CREATE
  // ========================================================================

  describe('create', () => {
    it('should create a project successfully with minimal data', async () => {
      // Arrange
      const createDto = createValidCreateDto();
      createDto.uploadedFileIds = undefined; // Test sans fichiers
      const expectedProject = createMockProjectEntity({ uploadedFileIds: [] });

      mockRepository.findByNameAndOwner.mockResolvedValue(null);
      mockRepository.create.mockResolvedValue(expectedProject);

      // Act
      const result = await service.create(createDto, mockUserId);

      // Assert
      expect(result).toBeInstanceOf(ProjectResponseDto);
      expect(result.id).toBe(mockProjectId);
      expect(result.name).toBe('Test Project');
      expect(mockRepository.findByNameAndOwner).toHaveBeenCalledWith(
        'Test Project',
        mockUserId,
      );
      expect(mockRepository.create).toHaveBeenCalledWith(
        {
          name: 'Test Project',
          description: 'A test project description',
          initialPrompt:
            'Create a simple web application with React and Node.js',
          uploadedFileIds: [],
        },
        mockUserId,
      );
      expect(mockCacheService.invalidateUserProjectsCache).toHaveBeenCalledWith(
        mockUserId,
      );
      expect(mockEventsService.publishProjectCreated).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: mockProjectId,
          ownerId: mockUserId,
          name: 'Test Project',
        }),
      );
    });

    it('should create a project with uploaded files', async () => {
      // Arrange
      const createDto = createValidCreateDto();
      const expectedProject = createMockProjectEntity({
        uploadedFileIds: [
          'f47ac10b-58cc-4372-a567-0e02b2c3d479',
          'f47ac10b-58cc-4372-a567-0e02b2c3d480',
        ],
      });

      mockRepository.findByNameAndOwner.mockResolvedValue(null);
      mockRepository.create.mockResolvedValue(expectedProject);

      // Act
      const result = await service.create(createDto, mockUserId);

      // Assert
      expect(result.uploadedFileIds).toEqual([
        'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        'f47ac10b-58cc-4372-a567-0e02b2c3d480',
      ]);
      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          uploadedFileIds: [
            'f47ac10b-58cc-4372-a567-0e02b2c3d479',
            'f47ac10b-58cc-4372-a567-0e02b2c3d480',
          ],
        }),
        mockUserId,
      );
    });

    it('should throw ConflictException when project name already exists', async () => {
      // Arrange
      const createDto = createValidCreateDto();
      const existingProject = createMockProjectEntity();

      mockRepository.findByNameAndOwner.mockResolvedValue(existingProject);

      // Act & Assert
      await expect(service.create(createDto, mockUserId)).rejects.toThrow(
        ConflictException,
      );
      expect(mockRepository.create).not.toHaveBeenCalled();
      expect(mockEventsService.publishProjectCreated).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for invalid UUID ownerId', async () => {
      // Arrange
      const createDto = createValidCreateDto();
      const invalidUserId = 'invalid-uuid';

      // Act & Assert
      await expect(service.create(createDto, invalidUserId)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockRepository.findByNameAndOwner).not.toHaveBeenCalled();
    });

    it('should handle repository errors gracefully', async () => {
      // Arrange
      const createDto = createValidCreateDto();

      mockRepository.findByNameAndOwner.mockResolvedValue(null);
      mockRepository.create.mockRejectedValue(
        new Error('Database connection failed'),
      );

      // Act & Assert
      await expect(service.create(createDto, mockUserId)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should continue even if event publishing fails', async () => {
      // Arrange
      const createDto = createValidCreateDto();
      const expectedProject = createMockProjectEntity();

      mockRepository.findByNameAndOwner.mockResolvedValue(null);
      mockRepository.create.mockResolvedValue(expectedProject);
      mockEventsService.publishProjectCreated.mockRejectedValue(
        new Error('Event service unavailable'),
      );

      // Act
      const result = await service.create(createDto, mockUserId);

      // Assert - le service devrait continuer malgré l'échec de l'événement
      expect(result).toBeInstanceOf(ProjectResponseDto);
      expect(result.id).toBe(mockProjectId);
    });

    it('should continue even if cache invalidation fails', async () => {
      // Arrange
      const createDto = createValidCreateDto();
      const expectedProject = createMockProjectEntity();

      mockRepository.findByNameAndOwner.mockResolvedValue(null);
      mockRepository.create.mockResolvedValue(expectedProject);
      mockCacheService.invalidateUserProjectsCache.mockRejectedValue(
        new Error('Redis unavailable'),
      );

      // Act
      const result = await service.create(createDto, mockUserId);

      // Assert - le service devrait continuer malgré l'échec du cache
      expect(result).toBeInstanceOf(ProjectResponseDto);
      expect(result.id).toBe(mockProjectId);
    });
  });

  // ========================================================================
  // TESTS DE LA MÉTHODE FINDONE
  // ========================================================================

  describe('findOne', () => {
    it('should return project from cache when available', async () => {
      // Arrange
      const cachedProject = createMockProjectEntity();
      mockCacheService.get.mockResolvedValue(cachedProject);

      // Act
      const result = await service.findOne(mockProjectId, mockUserId);

      // Assert
      expect(result).toBeInstanceOf(ProjectResponseDto);
      expect(result.id).toBe(mockProjectId);
      expect(mockCacheService.get).toHaveBeenCalledWith(
        `project:${mockProjectId}`,
      );
      expect(mockRepository.findById).not.toHaveBeenCalled();
    });

    it('should fetch from database and cache when not in cache', async () => {
      // Arrange
      const project = createMockProjectEntity();
      mockCacheService.get.mockResolvedValue(null);
      mockRepository.findById.mockResolvedValue(project);

      // Act
      const result = await service.findOne(mockProjectId, mockUserId);

      // Assert
      expect(result).toBeInstanceOf(ProjectResponseDto);
      expect(mockRepository.findById).toHaveBeenCalledWith(mockProjectId, true);
      expect(mockCacheService.set).toHaveBeenCalledWith(
        `project:${mockProjectId}`,
        project,
        300, // CACHE_TTL.PROJECT
      );
    });

    it('should throw NotFoundException when project does not exist', async () => {
      // Arrange
      mockCacheService.get.mockResolvedValue(null);
      mockRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(service.findOne(mockProjectId, mockUserId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException for wrong owner', async () => {
      // Arrange
      const project = createMockProjectEntity({ ownerId: mockOtherUserId });
      project.belongsToUserId = jest.fn().mockReturnValue(false);

      mockCacheService.get.mockResolvedValue(project);

      // Act & Assert
      await expect(service.findOne(mockProjectId, mockUserId)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw BadRequestException for invalid project ID', async () => {
      // Arrange
      const invalidId = 'invalid-uuid';

      // Act & Assert
      await expect(service.findOne(invalidId, mockUserId)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockCacheService.get).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for invalid owner ID', async () => {
      // Arrange
      const invalidOwnerId = 'invalid-uuid';

      // Act & Assert
      await expect(
        service.findOne(mockProjectId, invalidOwnerId),
      ).rejects.toThrow(BadRequestException);
      expect(mockCacheService.get).not.toHaveBeenCalled();
    });

    it('should handle repository ProjectNotFoundError', async () => {
      // Arrange
      mockCacheService.get.mockResolvedValue(null);
      mockRepository.findById.mockRejectedValue(
        new ProjectNotFoundError(mockProjectId),
      );

      // Act & Assert
      await expect(service.findOne(mockProjectId, mockUserId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ========================================================================
  // TESTS DE LA MÉTHODE FINDALL
  // ========================================================================

  describe('findAll', () => {
    it('should return projects from cache when available', async () => {
      // Arrange
      const projects = [createMockProjectEntity()];
      const cachedResult = createMockPaginatedResult(
        projects.map((p) => new ProjectListItemDto()),
      );
      const mockPagination = createMockPaginationDto();

      mockCacheService.get.mockResolvedValue(cachedResult);

      // Act
      const result = await service.findAll(mockUserId, mockPagination);

      // Assert
      expect(result).toEqual(cachedResult);
      expect(mockCacheService.get).toHaveBeenCalledWith(
        expect.stringContaining(`projects:${mockUserId}:1:10:`),
      );
      expect(mockRepository.findByOwner).not.toHaveBeenCalled();
    });

    it('should fetch from database and cache when not cached', async () => {
      // Arrange
      const projects = [
        createMockProjectEntity(),
        createMockProjectEntity({ id: 'f47ac10b-58cc-4372-a567-0e02b2c3d483' }),
      ];
      const repositoryResult = createMockPaginatedResult(projects, 2);
      const mockPagination = createMockPaginationDto();

      mockCacheService.get.mockResolvedValue(null);
      mockRepository.findByOwner.mockResolvedValue(repositoryResult);

      // Act
      const result = await service.findAll(mockUserId, mockPagination);

      // Assert
      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(mockRepository.findByOwner).toHaveBeenCalledWith(
        mockUserId,
        mockPagination,
        undefined,
        expect.objectContaining({
          includeStatistics: false,
          includeDeleted: false,
          orderBy: 'updatedAt',
          order: 'desc',
        }),
      );
      expect(mockCacheService.set).toHaveBeenCalledWith(
        expect.stringContaining(`projects:${mockUserId}:1:10:`),
        expect.any(Object),
        60, // CACHE_TTL.PROJECT_LIST
      );
    });

    it('should apply filters correctly', async () => {
      // Arrange
      const filters = {
        status: ProjectStatus.ACTIVE,
        hasGeneratedFiles: true,
        orderBy: 'createdAt' as const,
        order: 'asc' as const,
      };
      const projects = [createMockProjectEntity()];
      const repositoryResult = createMockPaginatedResult(projects);
      const mockPagination = createMockPaginationDto();

      mockCacheService.get.mockResolvedValue(null);
      mockRepository.findByOwner.mockResolvedValue(repositoryResult);

      // Act
      await service.findAll(mockUserId, mockPagination, filters);

      // Assert
      expect(mockRepository.findByOwner).toHaveBeenCalledWith(
        mockUserId,
        mockPagination,
        expect.objectContaining({
          status: ProjectStatus.ACTIVE,
          hasGeneratedFiles: true,
        }),
        expect.objectContaining({
          orderBy: 'createdAt',
          order: 'asc',
        }),
      );
    });

    it('should handle empty results', async () => {
      // Arrange
      const emptyResult = createMockPaginatedResult([], 0);
      const mockPagination = createMockPaginationDto();

      mockCacheService.get.mockResolvedValue(null);
      mockRepository.findByOwner.mockResolvedValue(emptyResult);

      // Act
      const result = await service.findAll(mockUserId, mockPagination);

      // Assert
      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.pagination.hasNext).toBe(false);
    });

    it('should throw BadRequestException for invalid owner ID', async () => {
      // Arrange
      const invalidOwnerId = 'invalid-uuid';
      const mockPagination = createMockPaginationDto();

      // Act & Assert
      await expect(
        service.findAll(invalidOwnerId, mockPagination),
      ).rejects.toThrow(BadRequestException);
      expect(mockRepository.findByOwner).not.toHaveBeenCalled();
    });
  });

  // ========================================================================
  // TESTS DE LA MÉTHODE UPDATE - CORRIGÉS
  // ========================================================================

  describe('update', () => {
    it('should update project successfully', async () => {
      // Arrange - Utilisation de la factory function pour créer un DTO mockable
      const updateDto = createMockUpdateDto({
        name: 'Updated Project Name',
        description: 'Updated description',
      });

      const existingProject = createMockProjectEntity();
      const updatedProject = createMockProjectEntity({
        name: 'Updated Project Name',
        description: 'Updated description',
        updatedAt: new Date('2024-01-02T10:00:00Z'),
      });

      mockRepository.findById.mockResolvedValue(existingProject);
      mockRepository.update.mockResolvedValue(updatedProject);

      // Act
      const result = await service.update(mockProjectId, updateDto, mockUserId);

      // Assert
      expect(result).toBeInstanceOf(ProjectResponseDto);
      expect(result.name).toBe('Updated Project Name');
      expect(mockRepository.update).toHaveBeenCalledWith(mockProjectId, {
        name: 'Updated Project Name',
        description: 'Updated description',
      });
      // Vérifier les appels aux méthodes du cache service (au lieu de la méthode privée)
      expect(mockCacheService.del).toHaveBeenCalledWith(
        `project:${mockProjectId}`,
      );
      expect(mockCacheService.invalidateUserProjectsCache).toHaveBeenCalledWith(
        mockUserId,
      );
      expect(mockEventsService.publishProjectUpdated).toHaveBeenCalled();
    });

    it('should throw BadRequestException for empty updates', async () => {
      // Arrange
      const updateDto = createMockUpdateDto({}, { hasValidUpdates: false });

      // Act & Assert
      await expect(
        service.update(mockProjectId, updateDto, mockUserId),
      ).rejects.toThrow(BadRequestException);
      expect(mockRepository.findById).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when project does not exist', async () => {
      // Arrange
      const updateDto = createMockUpdateDto({ name: 'Updated' });

      mockRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.update(mockProjectId, updateDto, mockUserId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException for wrong owner', async () => {
      // Arrange
      const updateDto = createMockUpdateDto({ name: 'Updated' });
      const project = createMockProjectEntity({ ownerId: mockOtherUserId });
      project.belongsToUserId = jest.fn().mockReturnValue(false);

      mockRepository.findById.mockResolvedValue(project);

      // Act & Assert
      await expect(
        service.update(mockProjectId, updateDto, mockUserId),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ConflictException for non-modifiable project', async () => {
      // Arrange
      const updateDto = createMockUpdateDto({ name: 'Updated' });
      const project = createMockProjectEntity({
        status: ProjectStatus.DELETED,
      });
      project.isModifiable = jest.fn().mockReturnValue(false);

      mockRepository.findById.mockResolvedValue(project);

      // Act & Assert
      await expect(
        service.update(mockProjectId, updateDto, mockUserId),
      ).rejects.toThrow(ConflictException);
    });

    it('should handle repository ProjectOptimisticLockError', async () => {
      // Arrange
      const updateDto = createMockUpdateDto({ name: 'Updated' });
      const existingProject = createMockProjectEntity();

      mockRepository.findById.mockResolvedValue(existingProject);
      mockRepository.update.mockRejectedValue(
        new ProjectOptimisticLockError(mockProjectId),
      );

      // Act & Assert
      await expect(
        service.update(mockProjectId, updateDto, mockUserId),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ========================================================================
  // TESTS DE LA MÉTHODE ARCHIVE - CORRIGÉS
  // ========================================================================

  describe('archive', () => {
    it('should archive project successfully', async () => {
      // Arrange - S'assurer que le projet appartient à mockUserId
      const project = createMockProjectEntity({
        status: ProjectStatus.ACTIVE,
        ownerId: mockUserId, // ← CORRECTION: Utiliser mockUserId
      });
      const archivedProject = createMockProjectEntity({
        status: ProjectStatus.ARCHIVED,
      });
      project.canTransitionTo = jest.fn().mockReturnValue(true);

      mockRepository.findById.mockResolvedValue(project);
      mockRepository.update.mockResolvedValue(archivedProject);

      // Act
      await service.archive(mockProjectId, mockUserId);

      // Assert
      expect(mockRepository.update).toHaveBeenCalledWith(mockProjectId, {
        status: ProjectStatus.ARCHIVED,
      });
      // Vérifier les appels aux méthodes du cache service (au lieu de la méthode privée)
      expect(mockCacheService.del).toHaveBeenCalledWith(
        `project:${mockProjectId}`,
      );
      expect(mockCacheService.invalidateUserProjectsCache).toHaveBeenCalledWith(
        mockUserId,
      );
      expect(mockEventsService.publishProjectArchived).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: mockProjectId,
          ownerId: mockUserId,
          previousStatus: ProjectStatus.ACTIVE,
        }),
      );
    });

    it('should throw NotFoundException when project does not exist', async () => {
      // Arrange
      mockRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(service.archive(mockProjectId, mockUserId)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockRepository.update).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException for wrong owner', async () => {
      // Arrange
      const project = createMockProjectEntity({ ownerId: mockOtherUserId });
      project.belongsToUserId = jest.fn().mockReturnValue(false);

      mockRepository.findById.mockResolvedValue(project);

      // Act & Assert
      await expect(service.archive(mockProjectId, mockUserId)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ConflictException for invalid state transition', async () => {
      // Arrange
      const project = createMockProjectEntity({
        status: ProjectStatus.DELETED,
      });
      project.canTransitionTo = jest.fn().mockReturnValue(false);

      mockRepository.findById.mockResolvedValue(project);

      // Act & Assert
      await expect(service.archive(mockProjectId, mockUserId)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  // ========================================================================
  // TESTS DE LA MÉTHODE DELETE - CORRIGÉS
  // ========================================================================

  describe('delete', () => {
    it('should delete project successfully', async () => {
      // Arrange - S'assurer que le projet appartient à mockUserId
      const project = createMockProjectEntity({ ownerId: mockUserId }); // ← CORRECTION

      mockRepository.findById.mockResolvedValue(project);

      // Act
      await service.delete(mockProjectId, mockUserId);

      // Assert
      expect(mockRepository.delete).toHaveBeenCalledWith(mockProjectId);
      // Vérifier les appels aux méthodes du cache service (au lieu de la méthode privée)
      expect(mockCacheService.del).toHaveBeenCalledWith(
        `project:${mockProjectId}`,
      );
      expect(mockCacheService.invalidateUserProjectsCache).toHaveBeenCalledWith(
        mockUserId,
      );
      expect(mockEventsService.publishProjectDeleted).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: mockProjectId,
          ownerId: mockUserId,
          previousStatus: ProjectStatus.ACTIVE,
        }),
      );
    });

    it('should throw NotFoundException when project does not exist', async () => {
      // Arrange
      mockRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(service.delete(mockProjectId, mockUserId)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockRepository.delete).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException for wrong owner', async () => {
      // Arrange
      const project = createMockProjectEntity({ ownerId: mockOtherUserId });
      project.belongsToUserId = jest.fn().mockReturnValue(false);

      mockRepository.findById.mockResolvedValue(project);

      // Act & Assert
      await expect(service.delete(mockProjectId, mockUserId)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ========================================================================
  // TESTS DE LA MÉTHODE UPDATEGENERATEDFILES - CORRIGÉS
  // ========================================================================

  describe('updateGeneratedFiles', () => {
    const mockFileIds = [
      'f47ac10b-58cc-4372-a567-0e02b2c3d491',
      'f47ac10b-58cc-4372-a567-0e02b2c3d492',
      'f47ac10b-58cc-4372-a567-0e02b2c3d493',
    ];

    it('should update generated files successfully in append mode', async () => {
      // Arrange - S'assurer que le projet appartient à mockUserId
      const project = createMockProjectEntity({ ownerId: mockUserId }); // ← CORRECTION

      mockRepository.findById.mockResolvedValue(project);

      // Act
      await service.updateGeneratedFiles(mockProjectId, mockFileIds, 'append');

      // Assert
      expect(mockRepository.updateGeneratedFiles).toHaveBeenCalledWith(
        mockProjectId,
        {
          fileIds: mockFileIds,
          mode: 'append',
        },
      );
      // Vérifier les appels aux méthodes du cache service (au lieu de la méthode privée)
      expect(mockCacheService.del).toHaveBeenCalledWith(
        `project:${mockProjectId}`,
      );
      expect(mockCacheService.invalidateUserProjectsCache).toHaveBeenCalledWith(
        mockUserId,
      );
      expect(mockEventsService.publishProjectFilesUpdated).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: mockProjectId,
          ownerId: mockUserId,
          newFileIds: mockFileIds,
          updateMode: 'append',
          totalGeneratedFiles: expect.any(Number),
          updatedAt: expect.any(Date),
        }),
      );
    });

    it('should update generated files in replace mode', async () => {
      // Arrange
      const project = createMockProjectEntity({ ownerId: mockUserId });

      mockRepository.findById.mockResolvedValue(project);

      // Act
      await service.updateGeneratedFiles(mockProjectId, mockFileIds, 'replace');

      // Assert
      expect(mockRepository.updateGeneratedFiles).toHaveBeenCalledWith(
        mockProjectId,
        {
          fileIds: mockFileIds,
          mode: 'replace',
        },
      );
    });

    it('should use append mode by default', async () => {
      // Arrange
      const project = createMockProjectEntity({ ownerId: mockUserId });

      mockRepository.findById.mockResolvedValue(project);

      // Act
      await service.updateGeneratedFiles(mockProjectId, mockFileIds);

      // Assert
      expect(mockRepository.updateGeneratedFiles).toHaveBeenCalledWith(
        mockProjectId,
        {
          fileIds: mockFileIds,
          mode: 'append',
        },
      );
    });

    it('should throw NotFoundException when project does not exist', async () => {
      // Arrange
      mockRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.updateGeneratedFiles(mockProjectId, mockFileIds),
      ).rejects.toThrow(NotFoundException);
      expect(mockRepository.updateGeneratedFiles).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for invalid file IDs', async () => {
      // Arrange
      const invalidFileIds = [
        'invalid-uuid',
        'f47ac10b-58cc-4372-a567-0e02b2c3d492',
      ];

      // Act & Assert
      await expect(
        service.updateGeneratedFiles(mockProjectId, invalidFileIds),
      ).rejects.toThrow(BadRequestException);
      expect(mockRepository.findById).not.toHaveBeenCalled();
    });

    it('should handle empty file IDs array', async () => {
      // Arrange
      const project = createMockProjectEntity({ ownerId: mockUserId });

      mockRepository.findById.mockResolvedValue(project);

      // Act
      await service.updateGeneratedFiles(mockProjectId, []);

      // Assert
      expect(mockRepository.updateGeneratedFiles).toHaveBeenCalledWith(
        mockProjectId,
        {
          fileIds: [],
          mode: 'append',
        },
      );
    });
  });

  // ========================================================================
  // TESTS DES MÉTHODES UTILITAIRES
  // ========================================================================

  describe('countProjects', () => {
    it('should return project count for user', async () => {
      // Arrange
      mockRepository.countByOwner.mockResolvedValue(5);

      // Act
      const result = await service.countProjects(mockUserId);

      // Assert
      expect(result).toBe(5);
      expect(mockRepository.countByOwner).toHaveBeenCalledWith(
        mockUserId,
        undefined,
      );
    });

    it('should throw BadRequestException for invalid owner ID', async () => {
      // Act & Assert
      await expect(service.countProjects('invalid-uuid')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('findActiveProjects', () => {
    it('should return active projects for user', async () => {
      // Arrange
      const projects = [
        createMockProjectEntity({ status: ProjectStatus.ACTIVE }),
      ];
      mockRepository.findActiveByOwner.mockResolvedValue(projects);

      // Act
      const result = await service.findActiveProjects(mockUserId);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0]).toBeInstanceOf(ProjectListItemDto);
      expect(mockRepository.findActiveByOwner).toHaveBeenCalledWith(mockUserId);
    });
  });

  describe('findRecentProjects', () => {
    it('should return recent projects with default days', async () => {
      // Arrange
      const projects = [createMockProjectEntity()];
      mockRepository.findRecentByOwner.mockResolvedValue(projects);

      // Act
      const result = await service.findRecentProjects(mockUserId);

      // Assert
      expect(result).toHaveLength(1);
      expect(mockRepository.findRecentByOwner).toHaveBeenCalledWith(
        mockUserId,
        7,
      );
    });

    it('should return recent projects with custom days', async () => {
      // Arrange
      const projects = [createMockProjectEntity()];
      mockRepository.findRecentByOwner.mockResolvedValue(projects);

      // Act
      const result = await service.findRecentProjects(mockUserId, 30);

      // Assert
      expect(result).toHaveLength(1);
      expect(mockRepository.findRecentByOwner).toHaveBeenCalledWith(
        mockUserId,
        30,
      );
    });
  });

  describe('existsForUser', () => {
    it('should return true when project exists for user', async () => {
      // Arrange
      mockRepository.existsForOwner.mockResolvedValue(true);

      // Act
      const result = await service.existsForUser(mockProjectId, mockUserId);

      // Assert
      expect(result).toBe(true);
      expect(mockRepository.existsForOwner).toHaveBeenCalledWith(
        mockProjectId,
        mockUserId,
      );
    });

    it('should return false when project does not exist', async () => {
      // Arrange
      mockRepository.existsForOwner.mockResolvedValue(false);

      // Act
      const result = await service.existsForUser(mockProjectId, mockUserId);

      // Assert
      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      // Arrange
      mockRepository.existsForOwner.mockRejectedValue(
        new Error('Database error'),
      );

      // Act
      const result = await service.existsForUser(mockProjectId, mockUserId);

      // Assert
      expect(result).toBe(false);
    });
  });

  // ========================================================================
  // TESTS DE GESTION D'ERREURS SPÉCIALISÉS
  // ========================================================================

  describe('error handling', () => {
    it('should transform ProjectNotFoundError to NotFoundException', async () => {
      // Arrange
      mockCacheService.get.mockResolvedValue(null);
      mockRepository.findById.mockRejectedValue(
        new ProjectNotFoundError(mockProjectId),
      );

      // Act & Assert
      await expect(service.findOne(mockProjectId, mockUserId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should transform ProjectOwnershipError to ForbiddenException', async () => {
      // Arrange
      const updateDto = createMockUpdateDto({ name: 'Updated' });

      mockRepository.findById.mockRejectedValue(
        new ProjectOwnershipError(mockProjectId, mockUserId),
      );

      // Act & Assert
      await expect(
        service.update(mockProjectId, updateDto, mockUserId),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should transform ProjectConstraintError to BadRequestException', async () => {
      // Arrange
      const createDto = createValidCreateDto();

      mockRepository.findByNameAndOwner.mockResolvedValue(null);
      mockRepository.create.mockRejectedValue(
        new ProjectConstraintError('Name already exists'),
      );

      // Act & Assert
      await expect(service.create(createDto, mockUserId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should transform unknown errors to InternalServerErrorException', async () => {
      // Arrange
      const createDto = createValidCreateDto();

      mockRepository.findByNameAndOwner.mockRejectedValue(
        new Error('Unknown database error'),
      );

      // Act & Assert
      await expect(service.create(createDto, mockUserId)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ========================================================================
  // TESTS EDGE CASES
  // ========================================================================

  describe('edge cases', () => {
    it('should handle very long project names at limit', async () => {
      // Arrange
      const createDto = createValidCreateDto();
      createDto.name = 'a'.repeat(100); // Exactement à la limite
      const project = createMockProjectEntity({ name: createDto.name });

      mockRepository.findByNameAndOwner.mockResolvedValue(null);
      mockRepository.create.mockResolvedValue(project);

      // Act
      const result = await service.create(createDto, mockUserId);

      // Assert
      expect(result.name).toBe(createDto.name);
    });

    it('should handle projects with maximum uploaded files', async () => {
      // Arrange
      const createDto = createValidCreateDto();
      createDto.uploadedFileIds = Array.from(
        { length: 10 },
        (_, i) =>
          `f47ac10b-58cc-4372-a567-0e02b2c3d${i.toString().padStart(3, '0')}`,
      );
      const project = createMockProjectEntity({
        uploadedFileIds: createDto.uploadedFileIds,
      });

      mockRepository.findByNameAndOwner.mockResolvedValue(null);
      mockRepository.create.mockResolvedValue(project);

      // Act
      const result = await service.create(createDto, mockUserId);

      // Assert
      expect(result.uploadedFileIds).toHaveLength(10);
    });

    it('should handle pagination at maximum limit', async () => {
      // Arrange
      const pagination = createMockPaginationDto();
      pagination.page = 1;
      pagination.limit = 100; // Limite max

      const projects = Array.from({ length: 100 }, (_, i) =>
        createMockProjectEntity({
          id: `f47ac10b-58cc-4372-a567-0e02b2c3d${i.toString().padStart(3, '0')}`,
        }),
      );
      const repositoryResult = createMockPaginatedResult(projects, 150);

      mockCacheService.get.mockResolvedValue(null);
      mockRepository.findByOwner.mockResolvedValue(repositoryResult);

      // Act
      const result = await service.findAll(mockUserId, pagination);

      // Assert
      expect(result.data).toHaveLength(100);
      expect(result.pagination.hasNext).toBe(true);
    });

    it('should handle concurrent cache invalidation gracefully', async () => {
      // Arrange
      const createDto = createValidCreateDto();
      const project = createMockProjectEntity();

      mockRepository.findByNameAndOwner.mockResolvedValue(null);
      mockRepository.create.mockResolvedValue(project);

      // Simulation d'un échec de cache intermittent
      mockCacheService.invalidateUserProjectsCache
        .mockRejectedValueOnce(new Error('Redis connection lost'))
        .mockResolvedValueOnce(undefined);

      // Act - ne devrait pas échouer malgré l'erreur de cache
      const result = await service.create(createDto, mockUserId);

      // Assert
      expect(result).toBeInstanceOf(ProjectResponseDto);
      expect(
        mockCacheService.invalidateUserProjectsCache,
      ).toHaveBeenCalledTimes(1);
    });
  });
});
