/**
 * Tests unitaires pour ProjectService - VERSION AVEC FIXTURES
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
import { ProjectResponseDto } from '../../../../src/project/dto/project-response.dto';
import { ProjectListItemDto } from '../../../../src/project/dto/project-list.dto';
import { ProjectStatus } from '../../../../src/common/enums/project-status.enum';

// ✅ IMPORT DES FIXTURES - Plus besoin de factory functions locales !
import { TestFixtures, createTestDataSet } from '../../../fixtures/project.fixtures';
import { PaginationDto } from '../../../../src/common/dto/pagination.dto';

describe('ProjectService', () => {
  let service: ProjectService;
  let mockRepository: jest.Mocked<ProjectRepository>;
  let mockCacheService: jest.Mocked<CacheService>;
  let mockEventsService: jest.Mocked<EventsService>;

  // ✅ DONNÉES DE TEST COHÉRENTES depuis les fixtures
  const testData = createTestDataSet();
  const mockUser = TestFixtures.users.validUser();
  const otherUser = TestFixtures.users.otherUser();

  beforeEach(async () => {
    // Configuration des mocks (identique)
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
        { provide: ProjectRepository, useValue: mockRepository },
        { provide: CacheService, useValue: mockCacheService },
        { provide: EventsService, useValue: mockEventsService },
      ],
    }).compile();

    service = module.get<ProjectService>(ProjectService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a project successfully with minimal data', async () => {
      // ✅ AVANT: 10+ lignes de setup
      // ✅ APRÈS: 2 lignes avec fixtures
      const createDto = TestFixtures.projects.minimalCreateDto();
      const expectedProject = TestFixtures.projects.mockProject({ 
        uploadedFileIds: [] 
      });

      mockRepository.findByNameAndOwner.mockResolvedValue(null);
      mockRepository.create.mockResolvedValue(expectedProject);

      const result = await service.create(createDto, mockUser.id);

      expect(result).toBeInstanceOf(ProjectResponseDto);
      expect(result.id).toBe(TestFixtures.ids.PROJECT_1);
      expect(result.name).toBe('Projet Test');
      expect(mockRepository.findByNameAndOwner).toHaveBeenCalledWith(
        'Projet Test',
        mockUser.id,
      );
      expect(mockCacheService.invalidateUserProjectsCache).toHaveBeenCalledWith(
        mockUser.id,
      );
      expect(mockEventsService.publishProjectCreated).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: TestFixtures.ids.PROJECT_1,
          ownerId: mockUser.id,
          name: 'Projet Test',
        }),
      );
    });

    it('should create a project with uploaded files', async () => {
      // ✅ Données cohérentes depuis les fixtures
      const createDto = TestFixtures.projects.validCreateDto();
      const expectedProject = TestFixtures.projects.projectWithFiles();

      mockRepository.findByNameAndOwner.mockResolvedValue(null);
      mockRepository.create.mockResolvedValue(expectedProject);

      const result = await service.create(createDto, mockUser.id);

      expect(result.uploadedFileIds).toEqual(TestFixtures.files.uploadedFileIds());
      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          uploadedFileIds: TestFixtures.files.uploadedFileIds(),
        }),
        mockUser.id,
      );
    });

    it('should throw ConflictException when project name already exists', async () => {
      // ✅ Scénario pré-configuré avec fixtures
      const createDto = TestFixtures.projects.validCreateDto();
      const conflictingProject = TestFixtures.projects.conflictingProject();

      mockRepository.findByNameAndOwner.mockResolvedValue(conflictingProject);

      await expect(service.create(createDto, mockUser.id)).rejects.toThrow(
        ConflictException,
      );
      expect(mockRepository.create).not.toHaveBeenCalled();
      expect(mockEventsService.publishProjectCreated).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for invalid UUID ownerId', async () => {
      const createDto = TestFixtures.projects.validCreateDto();
      const invalidUserId = 'invalid-uuid';

      await expect(service.create(createDto, invalidUserId)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockRepository.findByNameAndOwner).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return project from cache when available', async () => {
      // ✅ Projet pré-configuré avec relations
      const cachedProject = TestFixtures.projects.mockProjectWithStats();
      mockCacheService.get.mockResolvedValue(cachedProject);

      const result = await service.findOne(TestFixtures.ids.PROJECT_1, mockUser.id);

      expect(result).toBeInstanceOf(ProjectResponseDto);
      expect(result.id).toBe(TestFixtures.ids.PROJECT_1);
      expect(mockCacheService.get).toHaveBeenCalledWith(
        `project:${TestFixtures.ids.PROJECT_1}`,
      );
      expect(mockRepository.findById).not.toHaveBeenCalled();
    });

    it('should fetch from database and cache when not in cache', async () => {
      const project = TestFixtures.projects.mockProject();
      mockCacheService.get.mockResolvedValue(null);
      mockRepository.findById.mockResolvedValue(project);

      const result = await service.findOne(TestFixtures.ids.PROJECT_1, mockUser.id);

      expect(result).toBeInstanceOf(ProjectResponseDto);
      expect(mockRepository.findById).toHaveBeenCalledWith(TestFixtures.ids.PROJECT_1, true);
      expect(mockCacheService.set).toHaveBeenCalledWith(
        `project:${TestFixtures.ids.PROJECT_1}`,
        project,
        300,
      );
    });

    it('should throw ForbiddenException for wrong owner', async () => {
      // ✅ Scénario de sécurité pré-configuré
      const project = TestFixtures.projects.mockProject({ 
        ownerId: otherUser.id 
      });
      mockCacheService.get.mockResolvedValue(project);

      await expect(
        service.findOne(TestFixtures.ids.PROJECT_1, mockUser.id)
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('findAll', () => {
    it('should return projects from cache when available', async () => {
      const cachedResult = TestFixtures.responses.paginatedProjectsResponse();
      // ✅ CORRECTION: Créer une vraie instance PaginationDto
      const pagination = new PaginationDto();
      pagination.page = 1;
      pagination.limit = 10;

      mockCacheService.get.mockResolvedValue(cachedResult);

      const result = await service.findAll(mockUser.id, pagination);

      expect(result).toEqual(cachedResult);
      expect(mockCacheService.get).toHaveBeenCalledWith(
        expect.stringContaining(`projects:${mockUser.id}:1:10:`),
      );
      expect(mockRepository.findByOwner).not.toHaveBeenCalled();
    });

    it('should apply filters correctly', async () => {
      const filters = {
        status: ProjectStatus.ACTIVE,
        hasGeneratedFiles: true,
        orderBy: 'createdAt' as const,
        order: 'asc' as const,
      };
      const projects = TestFixtures.projects.projectsList(3);
      // ✅ CORRECTION: Utiliser la méthode corrigée
      const repositoryResult = TestFixtures.responses.createPaginatedResult(projects);
      // ✅ CORRECTION: Instance PaginationDto
      const pagination = new PaginationDto();
      pagination.page = 1;
      pagination.limit = 10;

      mockCacheService.get.mockResolvedValue(null);
      mockRepository.findByOwner.mockResolvedValue(repositoryResult);

      await service.findAll(mockUser.id, pagination, filters);

      expect(mockRepository.findByOwner).toHaveBeenCalledWith(
        mockUser.id,
        pagination,
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
  });

  describe('update', () => {
    it('should update project successfully', async () => {
      // ✅ DTOs et entités pré-configurés
      const updateDto = TestFixtures.projects.validUpdateDto();
      const existingProject = TestFixtures.projects.mockProject();
      const updatedProject = TestFixtures.projects.builder()
        .withName('Application E-commerce Mise à Jour')
        .withDescription('Plateforme de vente en ligne avec gestion des commandes et des paiements modernisée')
        .build();

      mockRepository.findById.mockResolvedValue(existingProject);
      mockRepository.update.mockResolvedValue(updatedProject);

      const result = await service.update(TestFixtures.ids.PROJECT_1, updateDto, mockUser.id);

      expect(result).toBeInstanceOf(ProjectResponseDto);
      expect(result.name).toBe('Application E-commerce Mise à Jour');
      expect(mockRepository.update).toHaveBeenCalledWith(TestFixtures.ids.PROJECT_1, {
        name: 'Application E-commerce Mise à Jour',
        description: 'Plateforme de vente en ligne avec gestion des commandes et des paiements modernisée',
      });
    });

    it('should throw ForbiddenException for wrong owner', async () => {
      const updateDto = TestFixtures.projects.validUpdateDto();
      // ✅ Projet appartenant à un autre utilisateur
      const project = TestFixtures.projects.mockProject({ 
        ownerId: otherUser.id 
      });

      mockRepository.findById.mockResolvedValue(project);

      await expect(
        service.update(TestFixtures.ids.PROJECT_1, updateDto, mockUser.id),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ConflictException for non-modifiable project', async () => {
      const updateDto = TestFixtures.projects.validUpdateDto();
      // ✅ Projet dans un état non-modifiable
      const project = TestFixtures.projects.deletedProject();

      mockRepository.findById.mockResolvedValue(project);

      await expect(
        service.update(TestFixtures.ids.PROJECT_1, updateDto, mockUser.id),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('archive', () => {
    it('should archive project successfully', async () => {
      // ✅ Projet actif prêt pour archivage
      const project = TestFixtures.projects.mockProject({
        status: ProjectStatus.ACTIVE,
      });
      const archivedProject = TestFixtures.projects.archivedProject();

      mockRepository.findById.mockResolvedValue(project);
      mockRepository.update.mockResolvedValue(archivedProject);

      await service.archive(TestFixtures.ids.PROJECT_1, mockUser.id);

      expect(mockRepository.update).toHaveBeenCalledWith(TestFixtures.ids.PROJECT_1, {
        status: ProjectStatus.ARCHIVED,
      });
      expect(mockEventsService.publishProjectArchived).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: TestFixtures.ids.PROJECT_1,
          ownerId: mockUser.id,
          previousStatus: ProjectStatus.ACTIVE,
        }),
      );
    });
  });

  describe('updateGeneratedFiles', () => {
    it('should update generated files successfully in append mode', async () => {
      const project = TestFixtures.projects.mockProject();
      // ✅ IDs de fichiers pré-configurés et cohérents
      const fileIds = TestFixtures.files.generatedFileIds();

      mockRepository.findById.mockResolvedValue(project);

      await service.updateGeneratedFiles(TestFixtures.ids.PROJECT_1, fileIds, 'append');

      expect(mockRepository.updateGeneratedFiles).toHaveBeenCalledWith(
        TestFixtures.ids.PROJECT_1,
        {
          fileIds,
          mode: 'append',
        },
      );
      expect(mockEventsService.publishProjectFilesUpdated).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: TestFixtures.ids.PROJECT_1,
          ownerId: mockUser.id,
          newFileIds: fileIds,
          updateMode: 'append',
        }),
      );
    });
  });

  describe('edge cases', () => {
    it('should handle pagination at maximum limit', async () => {
      // ✅ CORRECTION: Utiliser la méthode corrigée
      const performanceData = TestFixtures.generator.createPerformanceTestData();
      // ✅ CORRECTION: Instance PaginationDto  
      const pagination = new PaginationDto();
      pagination.page = 1;
      pagination.limit = 100;

      mockCacheService.get.mockResolvedValue(null);
      mockRepository.findByOwner.mockResolvedValue({
        data: performanceData.multipleProjects.slice(0, 100),
        total: 150,
        pagination: {
          page: 1,
          limit: 100,
          totalPages: 2,
          hasNext: true,
          hasPrevious: false,
          offset: 0,
        },
      });

      const result = await service.findAll(mockUser.id, pagination);

      expect(result.data).toHaveLength(100);
      expect(result.pagination.hasNext).toBe(true);
    });
  });
});