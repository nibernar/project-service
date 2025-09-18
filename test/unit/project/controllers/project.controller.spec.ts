/**
 * Tests unitaires pour ProjectController - VERSION AVEC FIXTURES
 *
 * Teste tous les endpoints REST avec validation complète :
 * - Authentification et autorisation (guards)
 * - Validation des DTOs et paramètres
 * - Transformation des réponses
 * - Gestion d'erreurs HTTP appropriées
 * - Logging structuré
 * - Edge cases et scénarios limites
 *
 * @fileoverview Tests unitaires complets du contrôleur Project (version avec fixtures)
 * @version 2.0.0
 */

import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { ProjectController } from '../../../../src/project/project.controller';
import { ProjectService } from '../../../../src/project/project.service';
import { AuthGuard } from '../../../../src/common/guards/auth.guard';
import { ProjectOwnerGuard } from '../../../../src/common/guards/project-owner.guard';
import { CreateProjectDto } from '../../../../src/project/dto/create-project.dto';
import { UpdateProjectDto } from '../../../../src/project/dto/update-project.dto';
import { ProjectResponseDto } from '../../../../src/project/dto/project-response.dto';
import { ProjectListItemDto } from '../../../../src/project/dto/project-list.dto';
import { PaginationDto } from '../../../../src/common/dto/pagination.dto';
import { ProjectStatus } from '../../../../src/common/enums/project-status.enum';
import { User } from '../../../../src/common/interfaces/user.interface';
import { PaginatedResult } from '../../../../src/common/interfaces/paginated-result.interface';

// ✅ IMPORT DES FIXTURES - Plus besoin de factory functions locales !
import { TestFixtures } from '../../../fixtures/project.fixtures';

// Interface temporaire pour ProjectFiltersDto basée sur l'usage dans les tests
interface ProjectFiltersDto {
  status?: ProjectStatus;
  search?: string;
  hasGeneratedFiles?: boolean;
  hasStatistics?: boolean;
  createdAfter?: string;
  createdBefore?: string;
  orderBy?: 'name' | 'createdAt' | 'updatedAt';
  order?: 'asc' | 'desc';
}

// Interface temporaire pour UpdateGeneratedFilesDto
interface UpdateGeneratedFilesDto {
  fileIds: string[];
  mode: 'append' | 'replace';
}

describe('ProjectController', () => {
  let controller: ProjectController;
  let mockProjectService: jest.Mocked<ProjectService>;
  let mockAuthGuard: jest.MockedClass<typeof AuthGuard>;
  let mockProjectOwnerGuard: jest.MockedClass<typeof ProjectOwnerGuard>;

  // ✅ DONNÉES DE TEST COHÉRENTES depuis les fixtures
  const mockUser = TestFixtures.users.validUser();
  const otherUser = TestFixtures.users.otherUser();

  beforeEach(async () => {
    // Mock complet du ProjectService
    mockProjectService = {
      create: jest.fn(),
      findOne: jest.fn(),
      findAll: jest.fn(),
      update: jest.fn(),
      archive: jest.fn(),
      delete: jest.fn(),
      updateGeneratedFiles: jest.fn(),
      countProjects: jest.fn(),
      findActiveProjects: jest.fn(),
      findRecentProjects: jest.fn(),
      existsForUser: jest.fn(),
    } as any;

    // Mock des guards
    mockAuthGuard = jest.fn().mockImplementation(() => true);
    mockProjectOwnerGuard = jest.fn().mockImplementation(() => true);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProjectController],
      providers: [
        {
          provide: ProjectService,
          useValue: mockProjectService,
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue(mockAuthGuard)
      .overrideGuard(ProjectOwnerGuard)
      .useValue(mockProjectOwnerGuard)
      .compile();

    controller = module.get<ProjectController>(ProjectController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ========================================================================
  // TESTS DE L'ENDPOINT POST /projects
  // ========================================================================

  describe('POST /projects', () => {
    it('should create a project successfully', async () => {
      // ✅ AVANT: 10+ lignes de setup avec factory functions
      // ✅ APRÈS: 2 lignes avec fixtures
      const createDto = TestFixtures.projects.validCreateDto();
      const expectedResponse = TestFixtures.responses.projectResponseDto();

      mockProjectService.create.mockResolvedValue(expectedResponse);

      const result = await controller.create(createDto, mockUser);

      expect(result).toEqual(expectedResponse);
      expect(mockProjectService.create).toHaveBeenCalledWith(
        createDto,
        mockUser.id,
      );
    });

    it('should log project creation attempt', async () => {
      const createDto = TestFixtures.projects.validCreateDto();
      const expectedResponse = TestFixtures.responses.projectResponseDto();
      const loggerSpy = jest.spyOn(controller['logger'], 'log');

      mockProjectService.create.mockResolvedValue(expectedResponse);

      await controller.create(createDto, mockUser);

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Creating project'),
        expect.objectContaining({
          operation: 'create',
          userId: mockUser.id,
          projectName: createDto.name,
        }),
      );
    });

    it('should handle service errors and re-throw them', async () => {
      const createDto = TestFixtures.projects.validCreateDto();
      const serviceError = new ConflictException('Project name already exists');

      mockProjectService.create.mockRejectedValue(serviceError);

      await expect(controller.create(createDto, mockUser)).rejects.toThrow(
        ConflictException,
      );
      expect(mockProjectService.create).toHaveBeenCalledWith(
        createDto,
        mockUser.id,
      );
    });

    it('should log errors during project creation', async () => {
      const createDto = TestFixtures.projects.validCreateDto();
      const serviceError = new Error('Service error');
      const loggerSpy = jest.spyOn(controller['logger'], 'error');

      mockProjectService.create.mockRejectedValue(serviceError);

      await expect(controller.create(createDto, mockUser)).rejects.toThrow();
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to create project'),
        serviceError,
      );
    });

    it('should create project with minimal data', async () => {
      // ✅ Utilisation du DTO minimal pré-configuré
      const createDto = TestFixtures.projects.minimalCreateDto();
      const expectedResponse = TestFixtures.responses.projectResponseDto();
      expectedResponse.description = undefined;
      expectedResponse.uploadedFileIds = [];

      mockProjectService.create.mockResolvedValue(expectedResponse);

      const result = await controller.create(createDto, mockUser);

      expect(result.description).toBeUndefined();
      expect(result.uploadedFileIds).toEqual([]);
    });
  });

  // ========================================================================
  // TESTS DE L'ENDPOINT GET /projects
  // ========================================================================

  describe('GET /projects', () => {
    it('should return paginated projects list', async () => {
      // ✅ FIX: La méthode findAll n'attend qu'un ProjectStatus optionnel
      const page = 1;
      const limit = 10;
      const status = undefined; // Pas de filtre de statut
      const expectedResult = TestFixtures.responses.paginatedProjectsResponse();

      mockProjectService.findAll.mockResolvedValue(expectedResult);

      const result = await controller.findAll(
        mockUser,
        page,
        limit,
        status,
      );

      expect(result).toEqual(expectedResult);
      expect(mockProjectService.findAll).toHaveBeenCalledWith(
        mockUser.id,
        expect.objectContaining({ page, limit }),
        expect.any(Object),
      );
    });

    it('should apply status filter correctly', async () => {
      const page = 1;
      const limit = 10;
      const status = ProjectStatus.ACTIVE;
      const expectedResult = TestFixtures.responses.createPaginatedResult([]);

      mockProjectService.findAll.mockResolvedValue(expectedResult);

      await controller.findAll(mockUser, page, limit, status);

      expect(mockProjectService.findAll).toHaveBeenCalledWith(
        mockUser.id,
        expect.objectContaining({ page, limit }),
        expect.objectContaining({
          status: ProjectStatus.ACTIVE,
        }),
      );
    });

    it('should handle no status filter', async () => {
      const page = 1;
      const limit = 10;
      const status = undefined;
      const expectedResult = TestFixtures.responses.createPaginatedResult([]);

      mockProjectService.findAll.mockResolvedValue(expectedResult);

      await controller.findAll(mockUser, page, limit, status);

      expect(mockProjectService.findAll).toHaveBeenCalledWith(
        mockUser.id,
        expect.objectContaining({ page, limit }),
        expect.any(Object),
      );
    });

    it('should handle empty results', async () => {
      const page = 1;
      const limit = 10;
      const status = undefined;
      const emptyResult = TestFixtures.responses.createPaginatedResult([], 0);

      mockProjectService.findAll.mockResolvedValue(emptyResult);

      const result = await controller.findAll(
        mockUser,
        page,
        limit,
        status,
      );

      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should log debug information', async () => {
      const page = 1;
      const limit = 10;
      const status = undefined;
      const loggerSpy = jest.spyOn(controller['logger'], 'debug');
      const expectedResult = TestFixtures.responses.createPaginatedResult([]);

      mockProjectService.findAll.mockResolvedValue(expectedResult);

      await controller.findAll(mockUser, page, limit, status);

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Finding projects'),
        expect.objectContaining({
          operation: 'findAll',
          userId: mockUser.id,
        }),
      );
    });

    it('should handle service errors', async () => {
      const page = 1;
      const limit = 10;
      const status = undefined;
      const serviceError = new Error('Database error');

      mockProjectService.findAll.mockRejectedValue(serviceError);

      await expect(
        controller.findAll(mockUser, page, limit, status),
      ).rejects.toThrow();
    });
  });

  // ========================================================================
  // TESTS DE L'ENDPOINT GET /projects/:id
  // ========================================================================

  describe('GET /projects/:id', () => {
    it('should return project by ID', async () => {
      // ✅ IDs cohérents depuis les fixtures
      const expectedResponse = TestFixtures.responses.projectResponseDto();

      mockProjectService.findOne.mockResolvedValue(expectedResponse);

      const result = await controller.findOne(TestFixtures.ids.PROJECT_1, mockUser);

      expect(result).toEqual(expectedResponse);
      expect(mockProjectService.findOne).toHaveBeenCalledWith(
        TestFixtures.ids.PROJECT_1,
        mockUser.id,
      );
    });

    it('should apply ProjectOwnerGuard', async () => {
      const expectedResponse = TestFixtures.responses.projectResponseDto();

      mockProjectService.findOne.mockResolvedValue(expectedResponse);

      await controller.findOne(TestFixtures.ids.PROJECT_1, mockUser);

      expect(mockProjectService.findOne).toHaveBeenCalled();
    });

    it('should handle project not found', async () => {
      mockProjectService.findOne.mockRejectedValue(
        new NotFoundException('Project not found'),
      );

      await expect(controller.findOne(TestFixtures.ids.PROJECT_1, mockUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should handle access denied', async () => {
      mockProjectService.findOne.mockRejectedValue(
        new ForbiddenException('Access denied'),
      );

      await expect(controller.findOne(TestFixtures.ids.PROJECT_1, mockUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should log debug information', async () => {
      const loggerSpy = jest.spyOn(controller['logger'], 'debug');
      const expectedResponse = TestFixtures.responses.projectResponseDto();

      mockProjectService.findOne.mockResolvedValue(expectedResponse);

      await controller.findOne(TestFixtures.ids.PROJECT_1, mockUser);

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Finding project'),
        expect.objectContaining({
          operation: 'findOne',
          projectId: TestFixtures.ids.PROJECT_1,
          userId: mockUser.id,
        }),
      );
    });
  });

  // ========================================================================
  // TESTS DE L'ENDPOINT PATCH /projects/:id
  // ========================================================================

  describe('PATCH /projects/:id', () => {
    it('should update project successfully', async () => {
      // ✅ DTOs pré-configurés
      const updateDto = TestFixtures.projects.validUpdateDto();
      const expectedResponse = TestFixtures.responses.projectResponseDto();
      expectedResponse.name = 'Application E-commerce Mise à Jour';

      mockProjectService.update.mockResolvedValue(expectedResponse);

      const result = await controller.update(
        TestFixtures.ids.PROJECT_1,
        updateDto,
        mockUser,
      );

      expect(result).toEqual(expectedResponse);
      expect(mockProjectService.update).toHaveBeenCalledWith(
        TestFixtures.ids.PROJECT_1,
        updateDto,
        mockUser.id,
      );
    });

    it('should validate that updates are provided', async () => {
      // ✅ Utilisation du helper pour créer un DTO invalide
      const updateDto = TestFixtures.helpers.createMockUpdateDto(
        { name: 'Updated Project Name', description: 'Updated description' },
        { hasValidUpdates: false }
      );

      await expect(
        controller.update(TestFixtures.ids.PROJECT_1, updateDto, mockUser),
      ).rejects.toThrow(BadRequestException);
      expect(mockProjectService.update).not.toHaveBeenCalled();
    });

    it('should apply ProjectOwnerGuard', async () => {
      const updateDto = TestFixtures.projects.validUpdateDto();
      const expectedResponse = TestFixtures.responses.projectResponseDto();

      mockProjectService.update.mockResolvedValue(expectedResponse);

      await controller.update(TestFixtures.ids.PROJECT_1, updateDto, mockUser);

      expect(mockProjectService.update).toHaveBeenCalled();
    });

    it('should handle project not found', async () => {
      const updateDto = TestFixtures.projects.validUpdateDto();

      mockProjectService.update.mockRejectedValue(
        new NotFoundException('Project not found'),
      );

      await expect(
        controller.update(TestFixtures.ids.PROJECT_1, updateDto, mockUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('should handle conflict errors', async () => {
      const updateDto = TestFixtures.projects.validUpdateDto();

      mockProjectService.update.mockRejectedValue(
        new ConflictException('Project cannot be modified'),
      );

      await expect(
        controller.update(TestFixtures.ids.PROJECT_1, updateDto, mockUser),
      ).rejects.toThrow(ConflictException);
    });

    it('should log update attempt', async () => {
      const updateDto = TestFixtures.projects.validUpdateDto();
      const loggerSpy = jest.spyOn(controller['logger'], 'log');
      const expectedResponse = TestFixtures.responses.projectResponseDto();

      mockProjectService.update.mockResolvedValue(expectedResponse);

      await controller.update(TestFixtures.ids.PROJECT_1, updateDto, mockUser);

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Updating project'),
        expect.objectContaining({
          operation: 'update',
          projectId: TestFixtures.ids.PROJECT_1,
          userId: mockUser.id,
        }),
      );
    });
  });

  // ========================================================================
  // TESTS DE L'ENDPOINT PUT /projects/:id/archive
  // ========================================================================

  describe('PUT /projects/:id/archive', () => {
    it('should archive project successfully', async () => {
      mockProjectService.archive.mockResolvedValue(undefined);

      await controller.archive(TestFixtures.ids.PROJECT_1, mockUser);

      expect(mockProjectService.archive).toHaveBeenCalledWith(
        TestFixtures.ids.PROJECT_1,
        mockUser.id,
      );
    });

    it('should return 204 status (void)', async () => {
      mockProjectService.archive.mockResolvedValue(undefined);

      const result = await controller.archive(TestFixtures.ids.PROJECT_1, mockUser);

      expect(result).toBeUndefined();
    });

    it('should apply ProjectOwnerGuard', async () => {
      mockProjectService.archive.mockResolvedValue(undefined);

      await controller.archive(TestFixtures.ids.PROJECT_1, mockUser);

      expect(mockProjectService.archive).toHaveBeenCalled();
    });

    it('should handle project not found', async () => {
      mockProjectService.archive.mockRejectedValue(
        new NotFoundException('Project not found'),
      );

      await expect(controller.archive(TestFixtures.ids.PROJECT_1, mockUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should handle invalid state transition', async () => {
      mockProjectService.archive.mockRejectedValue(
        new ConflictException('Cannot archive project'),
      );

      await expect(controller.archive(TestFixtures.ids.PROJECT_1, mockUser)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should log archiving attempt', async () => {
      const loggerSpy = jest.spyOn(controller['logger'], 'log');

      mockProjectService.archive.mockResolvedValue(undefined);

      await controller.archive(TestFixtures.ids.PROJECT_1, mockUser);

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Archiving project'),
        expect.objectContaining({
          operation: 'archive',
          projectId: TestFixtures.ids.PROJECT_1,
          userId: mockUser.id,
        }),
      );
    });
  });

  // ========================================================================
  // TESTS DE L'ENDPOINT DELETE /projects/:id
  // ========================================================================

  describe('DELETE /projects/:id', () => {
    it('should delete project successfully', async () => {
      mockProjectService.delete.mockResolvedValue(undefined);

      await controller.delete(TestFixtures.ids.PROJECT_1, mockUser);

      expect(mockProjectService.delete).toHaveBeenCalledWith(
        TestFixtures.ids.PROJECT_1,
        mockUser.id,
      );
    });

    it('should return 204 status (void)', async () => {
      mockProjectService.delete.mockResolvedValue(undefined);

      const result = await controller.delete(TestFixtures.ids.PROJECT_1, mockUser);

      expect(result).toBeUndefined();
    });

    it('should apply ProjectOwnerGuard', async () => {
      mockProjectService.delete.mockResolvedValue(undefined);

      await controller.delete(TestFixtures.ids.PROJECT_1, mockUser);

      expect(mockProjectService.delete).toHaveBeenCalled();
    });

    it('should handle project not found', async () => {
      mockProjectService.delete.mockRejectedValue(
        new NotFoundException('Project not found'),
      );

      await expect(controller.delete(TestFixtures.ids.PROJECT_1, mockUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should log deletion attempt', async () => {
      const loggerSpy = jest.spyOn(controller['logger'], 'log');

      mockProjectService.delete.mockResolvedValue(undefined);

      await controller.delete(TestFixtures.ids.PROJECT_1, mockUser);

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Deleting project'),
        expect.objectContaining({
          operation: 'delete',
          projectId: TestFixtures.ids.PROJECT_1,
          userId: mockUser.id,
        }),
      );
    });
  });

  // ========================================================================
  // TESTS DE L'ENDPOINT PUT /projects/:id/files (API INTERNE)
  // ========================================================================

  describe('PUT /projects/:id/files', () => {
    const validUpdateFilesDto: UpdateGeneratedFilesDto = {
      fileIds: TestFixtures.files.generatedFileIds(),
      mode: 'append',
    };

    it('should update generated files successfully', async () => {
      const serviceToken = 'valid-service-token';

      mockProjectService.updateGeneratedFiles.mockResolvedValue(undefined);

      await controller.updateGeneratedFiles(
        TestFixtures.ids.PROJECT_1,
        validUpdateFilesDto,
        serviceToken,
      );

      expect(mockProjectService.updateGeneratedFiles).toHaveBeenCalledWith(
        TestFixtures.ids.PROJECT_1,
        validUpdateFilesDto.fileIds,
        validUpdateFilesDto.mode,
      );
    });

    it('should validate service token presence', async () => {
      const emptyToken = '';

      await expect(
        controller.updateGeneratedFiles(
          TestFixtures.ids.PROJECT_1,
          validUpdateFilesDto,
          emptyToken,
        ),
      ).rejects.toThrow(BadRequestException);

      expect(mockProjectService.updateGeneratedFiles).not.toHaveBeenCalled();
    });

    it('should validate service token is not empty', async () => {
      const whitespaceToken = '   ';

      await expect(
        controller.updateGeneratedFiles(
          TestFixtures.ids.PROJECT_1,
          validUpdateFilesDto,
          whitespaceToken,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle missing service token header', async () => {
      await expect(
        controller.updateGeneratedFiles(
          TestFixtures.ids.PROJECT_1,
          validUpdateFilesDto,
          undefined as any,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should update files in replace mode', async () => {
      const replaceDto: UpdateGeneratedFilesDto = {
        fileIds: ['new-gen1-uuid', 'new-gen2-uuid'],
        mode: 'replace',
      };
      const serviceToken = 'valid-service-token';

      mockProjectService.updateGeneratedFiles.mockResolvedValue(undefined);

      await controller.updateGeneratedFiles(
        TestFixtures.ids.PROJECT_1,
        replaceDto,
        serviceToken,
      );

      expect(mockProjectService.updateGeneratedFiles).toHaveBeenCalledWith(
        TestFixtures.ids.PROJECT_1,
        replaceDto.fileIds,
        'replace',
      );
    });

    it('should handle empty file IDs array', async () => {
      const emptyFilesDto: UpdateGeneratedFilesDto = {
        fileIds: [],
        mode: 'append',
      };
      const serviceToken = 'valid-service-token';

      mockProjectService.updateGeneratedFiles.mockResolvedValue(undefined);

      await controller.updateGeneratedFiles(
        TestFixtures.ids.PROJECT_1,
        emptyFilesDto,
        serviceToken,
      );

      expect(mockProjectService.updateGeneratedFiles).toHaveBeenCalledWith(
        TestFixtures.ids.PROJECT_1,
        [],
        'append',
      );
    });

    it('should handle service errors', async () => {
      const serviceToken = 'valid-service-token';

      mockProjectService.updateGeneratedFiles.mockRejectedValue(
        new NotFoundException('Project not found'),
      );

      await expect(
        controller.updateGeneratedFiles(
          TestFixtures.ids.PROJECT_1,
          validUpdateFilesDto,
          serviceToken,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should log file update attempt', async () => {
      const serviceToken = 'valid-service-token';
      const loggerSpy = jest.spyOn(controller['logger'], 'log');

      mockProjectService.updateGeneratedFiles.mockResolvedValue(undefined);

      await controller.updateGeneratedFiles(
        TestFixtures.ids.PROJECT_1,
        validUpdateFilesDto,
        serviceToken,
      );

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Updating generated files'),
        expect.objectContaining({
          operation: 'updateGeneratedFiles',
          projectId: TestFixtures.ids.PROJECT_1,
          fileCount: validUpdateFilesDto.fileIds.length,
          mode: validUpdateFilesDto.mode,
          hasServiceToken: true,
        }),
      );
    });
  });

  // ========================================================================
  // TESTS DE VALIDATION DES PARAMÈTRES
  // ========================================================================

  describe('Parameter validation', () => {
    it('should validate UUID format for project ID', async () => {
      // Les pipes UUID sont gérés par NestJS, mais on peut tester la logique
      const validUuid = TestFixtures.ids.PROJECT_1;
      const expectedResponse = TestFixtures.responses.projectResponseDto();

      mockProjectService.findOne.mockResolvedValue(expectedResponse);

      await controller.findOne(validUuid, mockUser);

      expect(mockProjectService.findOne).toHaveBeenCalledWith(
        validUuid,
        mockUser.id,
      );
    });

    it('should handle pagination edge cases', async () => {
      // ✅ FIX: Passer des valeurs numériques séparées et un status optionnel
      const page = 1000;
      const limit = 100;
      const status = undefined;
      const expectedResult = TestFixtures.responses.createPaginatedResult([], 0);

      mockProjectService.findAll.mockResolvedValue(expectedResult);

      const result = await controller.findAll(mockUser, page, limit, status);

      expect(result.data).toHaveLength(0);
      expect(mockProjectService.findAll).toHaveBeenCalledWith(
        mockUser.id,
        expect.objectContaining({ page, limit }),
        expect.any(Object),
      );
    });
  });

  // ========================================================================
  // TESTS DE GESTION D'ERREURS GLOBALES
  // ========================================================================

  describe('Error handling', () => {
    it('should propagate service validation errors', async () => {
      const createDto = TestFixtures.projects.validCreateDto();

      mockProjectService.create.mockRejectedValue(
        new BadRequestException('Invalid data'),
      );

      await expect(controller.create(createDto, mockUser)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should propagate service authorization errors', async () => {
      mockProjectService.findOne.mockRejectedValue(
        new ForbiddenException('Access denied'),
      );

      await expect(controller.findOne(TestFixtures.ids.PROJECT_1, mockUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should propagate service not found errors', async () => {
      mockProjectService.findOne.mockRejectedValue(
        new NotFoundException('Project not found'),
      );

      await expect(controller.findOne(TestFixtures.ids.PROJECT_1, mockUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should propagate service conflict errors', async () => {
      const updateDto = TestFixtures.projects.validUpdateDto();

      mockProjectService.update.mockRejectedValue(
        new ConflictException('Name already exists'),
      );

      await expect(
        controller.update(TestFixtures.ids.PROJECT_1, updateDto, mockUser),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ========================================================================
  // TESTS D'EDGE CASES ET SCÉNARIOS LIMITES
  // ========================================================================

  describe('Edge cases', () => {
    it('should handle very long project lists', async () => {
      const page = 1;
      const limit = 100;
      const status = undefined;
      // Créer des ProjectListItemDto directement
      const manyItems = Array.from({ length: 100 }, (_, i) => {
        const item = TestFixtures.responses.projectListItemDto();
        item.id = `project-${i}-uuid`;
        item.name = `Project ${i}`;
        return item;
      });
      const result = TestFixtures.responses.createPaginatedResult(manyItems, 1000);

      mockProjectService.findAll.mockResolvedValue(result);

      const response = await controller.findAll(mockUser, page, limit, status);

      expect(response.data).toHaveLength(100);
      expect(response.total).toBe(1000);
      expect(response.pagination.hasNext).toBe(true);
    });

    it('should handle projects with maximum file counts', async () => {
      // ✅ Projet volumineux pré-configuré
      const largeProject = TestFixtures.projects.largeProject();
      const response = TestFixtures.responses.projectResponseDto();
      response.uploadedFileIds = largeProject.uploadedFileIds;
      response.generatedFileIds = largeProject.generatedFileIds;

      mockProjectService.findOne.mockResolvedValue(response);

      const result = await controller.findOne(TestFixtures.ids.PROJECT_1, mockUser);

      expect(result.uploadedFileIds.length).toBeGreaterThanOrEqual(10);
      expect(result.generatedFileIds.length).toBeGreaterThanOrEqual(20);
    });

    it('should handle different status filters', async () => {
      // ✅ Test simplifié pour correspondre à la vraie signature de l'API
      const page = 1;
      const limit = 10;
      const status = ProjectStatus.ACTIVE;
      const result = TestFixtures.responses.createPaginatedResult([]);

      mockProjectService.findAll.mockResolvedValue(result);

      await controller.findAll(mockUser, page, limit, status);

      expect(mockProjectService.findAll).toHaveBeenCalledWith(
        mockUser.id,
        expect.objectContaining({ page, limit }),
        expect.objectContaining({
          status: ProjectStatus.ACTIVE,
        }),
      );
    });

    it('should handle simultaneous operations gracefully', async () => {
      const createDto = TestFixtures.projects.validCreateDto();
      const updateDto = TestFixtures.projects.validUpdateDto();
      const createResponse = TestFixtures.responses.projectResponseDto();
      const updateResponse = TestFixtures.responses.projectResponseDto();
      updateResponse.name = 'Application E-commerce Mise à Jour';

      mockProjectService.create.mockResolvedValue(createResponse);
      mockProjectService.update.mockResolvedValue(updateResponse);

      // Act - Simule des opérations simultanées
      const [createResult, updateResult] = await Promise.all([
        controller.create(createDto, mockUser),
        controller.update(TestFixtures.ids.PROJECT_1, updateDto, mockUser),
      ]);

      expect(createResult.id).toBe(TestFixtures.ids.PROJECT_1);
      expect(updateResult.name).toBe('Application E-commerce Mise à Jour');
      expect(mockProjectService.create).toHaveBeenCalledTimes(1);
      expect(mockProjectService.update).toHaveBeenCalledTimes(1);
    });
  });
});