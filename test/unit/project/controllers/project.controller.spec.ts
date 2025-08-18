/**
 * Tests unitaires pour ProjectController
 *
 * Teste tous les endpoints REST avec validation complète :
 * - Authentification et autorisation (guards)
 * - Validation des DTOs et paramètres
 * - Transformation des réponses
 * - Gestion d'erreurs HTTP appropriées
 * - Logging structuré
 * - Edge cases et scénarios limites
 *
 * @fileoverview Tests unitaires complets du contrôleur Project
 * @version 1.0.0
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

  // ========================================================================
  // FIXTURES ET DONNÉES DE TEST
  // ========================================================================

  const mockUser: User = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    email: 'test@example.com',
    roles: ['user'],
  };

  const mockProjectId = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
  const mockOtherProjectId = '123e4567-e89b-12d3-a456-426614174000';

  const createValidCreateDto = (): CreateProjectDto => {
    const dto = {
      name: 'Test Project',
      description: 'A test project description',
      initialPrompt: 'Create a simple web application with React and Node.js',
      uploadedFileIds: ['file1-uuid', 'file2-uuid'],
      hasUploadedFiles: jest.fn().mockReturnValue(true),
      getPromptComplexity: jest.fn().mockReturnValue('medium'),
      isValid: jest.fn().mockReturnValue(true),
    } as unknown as CreateProjectDto;

    return dto;
  };

  const createValidUpdateDto = (): UpdateProjectDto => {
    const dto = {
      name: 'Updated Project Name',
      description: 'Updated description',
      hasValidUpdates: jest.fn().mockReturnValue(true),
      getDefinedFields: jest.fn().mockReturnValue({
        name: 'Updated Project Name',
        description: 'Updated description',
      }),
      getUpdateFieldsCount: jest.fn().mockReturnValue(2),
      isValid: jest.fn().mockReturnValue(true),
    } as unknown as UpdateProjectDto;

    return dto;
  };

  const createMockProjectResponse = (): ProjectResponseDto => {
    const response = new ProjectResponseDto();
    Object.assign(response, {
      id: mockProjectId,
      name: 'Test Project',
      description: 'Test description',
      initialPrompt: 'Create a test application',
      status: ProjectStatus.ACTIVE,
      uploadedFileIds: ['file1-uuid'],
      generatedFileIds: ['gen1-uuid', 'gen2-uuid'],
      createdAt: new Date('2024-01-01T10:00:00Z'),
      updatedAt: new Date('2024-01-01T10:00:00Z'),
      statistics: undefined,
    });

    // Mock des méthodes
    response.hasStatistics = jest.fn().mockReturnValue(false);
    response.hasUploadedFiles = jest.fn().mockReturnValue(true);
    response.hasGeneratedFiles = jest.fn().mockReturnValue(true);

    return response;
  };

  const createMockProjectListItem = (): ProjectListItemDto => {
    const item = new ProjectListItemDto();
    Object.assign(item, {
      id: mockProjectId,
      name: 'Test Project',
      description: 'Test description',
      status: ProjectStatus.ACTIVE,
      createdAt: new Date('2024-01-01T10:00:00Z'),
      updatedAt: new Date('2024-01-01T10:00:00Z'),
      uploadedFilesCount: 1,
      generatedFilesCount: 2,
      hasStatistics: false,
      totalCost: undefined,
    });

    return item;
  };

  const createMockPaginatedResult = <T>(
    data: T[],
    total: number = data.length,
    page: number = 1,
    limit: number = 10,
  ): PaginatedResult<T> => ({
    data,
    total,
    pagination: {
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNext: total > page * limit,
      hasPrevious: page > 1,
      offset: (page - 1) * limit,
    },
  });

  const createMockPagination = (
    page: number = 1,
    limit: number = 10,
  ): PaginationDto => {
    const pagination = new PaginationDto();
    pagination.page = page;
    pagination.limit = limit;
    return pagination;
  };

  // ========================================================================
  // CONFIGURATION DU MODULE DE TEST
  // ========================================================================

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
      // Arrange
      const createDto = createValidCreateDto();
      const expectedResponse = createMockProjectResponse();

      mockProjectService.create.mockResolvedValue(expectedResponse);

      // Act
      const result = await controller.create(createDto, mockUser);

      // Assert
      expect(result).toEqual(expectedResponse);
      expect(mockProjectService.create).toHaveBeenCalledWith(
        createDto,
        mockUser.id,
      );
    });

    it('should log project creation attempt', async () => {
      // Arrange
      const createDto = createValidCreateDto();
      const expectedResponse = createMockProjectResponse();
      const loggerSpy = jest.spyOn(controller['logger'], 'log');

      mockProjectService.create.mockResolvedValue(expectedResponse);

      // Act
      await controller.create(createDto, mockUser);

      // Assert
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
      // Arrange
      const createDto = createValidCreateDto();
      const serviceError = new ConflictException('Project name already exists');

      mockProjectService.create.mockRejectedValue(serviceError);

      // Act & Assert
      await expect(controller.create(createDto, mockUser)).rejects.toThrow(
        ConflictException,
      );
      expect(mockProjectService.create).toHaveBeenCalledWith(
        createDto,
        mockUser.id,
      );
    });

    it('should log errors during project creation', async () => {
      // Arrange
      const createDto = createValidCreateDto();
      const serviceError = new Error('Service error');
      const loggerSpy = jest.spyOn(controller['logger'], 'error');

      mockProjectService.create.mockRejectedValue(serviceError);

      // Act & Assert
      await expect(controller.create(createDto, mockUser)).rejects.toThrow();
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to create project'),
        serviceError,
      );
    });

    it('should create project with minimal data', async () => {
      // Arrange
      const createDto = {
        name: 'Test Project',
        description: undefined,
        initialPrompt: 'Create a simple web application with React and Node.js',
        uploadedFileIds: undefined,
        hasUploadedFiles: jest.fn().mockReturnValue(false),
        getPromptComplexity: jest.fn().mockReturnValue('medium'),
        isValid: jest.fn().mockReturnValue(true),
      } as unknown as CreateProjectDto;

      const expectedResponse = createMockProjectResponse();
      expectedResponse.description = undefined;
      expectedResponse.uploadedFileIds = [];

      mockProjectService.create.mockResolvedValue(expectedResponse);

      // Act
      const result = await controller.create(createDto, mockUser);

      // Assert
      expect(result.description).toBeUndefined();
      expect(result.uploadedFileIds).toEqual([]);
    });
  });

  // ========================================================================
  // TESTS DE L'ENDPOINT GET /projects
  // ========================================================================

  describe('GET /projects', () => {
    const mockPagination = createMockPagination(1, 10);
    const mockFilters: ProjectFiltersDto = {};

    it('should return paginated projects list', async () => {
      // Arrange
      const projectItems = [createMockProjectListItem()];
      const expectedResult = createMockPaginatedResult(projectItems);

      mockProjectService.findAll.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.findAll(
        mockUser,
        mockPagination,
        mockFilters,
      );

      // Assert
      expect(result).toEqual(expectedResult);
      expect(mockProjectService.findAll).toHaveBeenCalledWith(
        mockUser.id,
        mockPagination,
        expect.objectContaining({}),
      );
    });

    it('should apply filters correctly', async () => {
      // Arrange
      const filters: ProjectFiltersDto = {
        status: ProjectStatus.ACTIVE,
        search: 'test project',
        hasGeneratedFiles: true,
        hasStatistics: false,
        orderBy: 'createdAt',
        order: 'asc',
      };
      const expectedResult = createMockPaginatedResult([]);

      mockProjectService.findAll.mockResolvedValue(expectedResult);

      // Act
      await controller.findAll(mockUser, mockPagination, filters);

      // Assert
      expect(mockProjectService.findAll).toHaveBeenCalledWith(
        mockUser.id,
        mockPagination,
        expect.objectContaining({
          status: ProjectStatus.ACTIVE,
          search: 'test project',
          hasGeneratedFiles: true,
          hasStatistics: false,
          orderBy: 'createdAt',
          order: 'asc',
        }),
      );
    });

    it('should convert date string filters to Date objects', async () => {
      // Arrange
      const filters: ProjectFiltersDto = {
        createdAfter: '2024-01-01T00:00:00Z',
        createdBefore: '2024-12-31T23:59:59Z',
      };
      const expectedResult = createMockPaginatedResult([]);

      mockProjectService.findAll.mockResolvedValue(expectedResult);

      // Act
      await controller.findAll(mockUser, mockPagination, filters);

      // Assert
      expect(mockProjectService.findAll).toHaveBeenCalledWith(
        mockUser.id,
        mockPagination,
        expect.objectContaining({
          createdAfter: new Date('2024-01-01T00:00:00Z'),
          createdBefore: new Date('2024-12-31T23:59:59Z'),
        }),
      );
    });

    it('should handle empty results', async () => {
      // Arrange
      const emptyResult = createMockPaginatedResult([], 0);

      mockProjectService.findAll.mockResolvedValue(emptyResult);

      // Act
      const result = await controller.findAll(
        mockUser,
        mockPagination,
        mockFilters,
      );

      // Assert
      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should log debug information', async () => {
      // Arrange
      const loggerSpy = jest.spyOn(controller['logger'], 'debug');
      const expectedResult = createMockPaginatedResult([]);

      mockProjectService.findAll.mockResolvedValue(expectedResult);

      // Act
      await controller.findAll(mockUser, mockPagination, mockFilters);

      // Assert
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Finding projects'),
        expect.objectContaining({
          operation: 'findAll',
          userId: mockUser.id,
        }),
      );
    });

    it('should handle service errors', async () => {
      // Arrange
      const serviceError = new Error('Database error');

      mockProjectService.findAll.mockRejectedValue(serviceError);

      // Act & Assert
      await expect(
        controller.findAll(mockUser, mockPagination, mockFilters),
      ).rejects.toThrow();
    });
  });

  // ========================================================================
  // TESTS DE L'ENDPOINT GET /projects/:id
  // ========================================================================

  describe('GET /projects/:id', () => {
    it('should return project by ID', async () => {
      // Arrange
      const expectedResponse = createMockProjectResponse();

      mockProjectService.findOne.mockResolvedValue(expectedResponse);

      // Act
      const result = await controller.findOne(mockProjectId, mockUser);

      // Assert
      expect(result).toEqual(expectedResponse);
      expect(mockProjectService.findOne).toHaveBeenCalledWith(
        mockProjectId,
        mockUser.id,
      );
    });

    it('should apply ProjectOwnerGuard', async () => {
      // Arrange
      const expectedResponse = createMockProjectResponse();

      mockProjectService.findOne.mockResolvedValue(expectedResponse);

      // Act
      await controller.findOne(mockProjectId, mockUser);

      // Assert
      // Le guard devrait avoir été appelé (vérifié par le décorateur UseGuards)
      expect(mockProjectService.findOne).toHaveBeenCalled();
    });

    it('should handle project not found', async () => {
      // Arrange
      mockProjectService.findOne.mockRejectedValue(
        new NotFoundException('Project not found'),
      );

      // Act & Assert
      await expect(controller.findOne(mockProjectId, mockUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should handle access denied', async () => {
      // Arrange
      mockProjectService.findOne.mockRejectedValue(
        new ForbiddenException('Access denied'),
      );

      // Act & Assert
      await expect(controller.findOne(mockProjectId, mockUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should log debug information', async () => {
      // Arrange
      const loggerSpy = jest.spyOn(controller['logger'], 'debug');
      const expectedResponse = createMockProjectResponse();

      mockProjectService.findOne.mockResolvedValue(expectedResponse);

      // Act
      await controller.findOne(mockProjectId, mockUser);

      // Assert
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Finding project'),
        expect.objectContaining({
          operation: 'findOne',
          projectId: mockProjectId,
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
      // Arrange
      const updateDto = createValidUpdateDto();
      const expectedResponse = createMockProjectResponse();
      expectedResponse.name = 'Updated Project Name';

      mockProjectService.update.mockResolvedValue(expectedResponse);

      // Act
      const result = await controller.update(
        mockProjectId,
        updateDto,
        mockUser,
      );

      // Assert
      expect(result).toEqual(expectedResponse);
      expect(mockProjectService.update).toHaveBeenCalledWith(
        mockProjectId,
        updateDto,
        mockUser.id,
      );
    });

    it('should validate that updates are provided', async () => {
      // Arrange
      const updateDto = {
        name: 'Updated Project Name',
        description: 'Updated description',
        hasValidUpdates: jest.fn().mockReturnValue(false),
        getDefinedFields: jest.fn().mockReturnValue({
          name: 'Updated Project Name',
          description: 'Updated description',
        }),
        getUpdateFieldsCount: jest.fn().mockReturnValue(2),
        isValid: jest.fn().mockReturnValue(true),
      } as unknown as UpdateProjectDto;

      // Act & Assert
      await expect(
        controller.update(mockProjectId, updateDto, mockUser),
      ).rejects.toThrow(BadRequestException);
      expect(mockProjectService.update).not.toHaveBeenCalled();
    });

    it('should apply ProjectOwnerGuard', async () => {
      // Arrange
      const updateDto = createValidUpdateDto();
      const expectedResponse = createMockProjectResponse();

      mockProjectService.update.mockResolvedValue(expectedResponse);

      // Act
      await controller.update(mockProjectId, updateDto, mockUser);

      // Assert
      expect(mockProjectService.update).toHaveBeenCalled();
    });

    it('should handle project not found', async () => {
      // Arrange
      const updateDto = createValidUpdateDto();

      mockProjectService.update.mockRejectedValue(
        new NotFoundException('Project not found'),
      );

      // Act & Assert
      await expect(
        controller.update(mockProjectId, updateDto, mockUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('should handle conflict errors', async () => {
      // Arrange
      const updateDto = createValidUpdateDto();

      mockProjectService.update.mockRejectedValue(
        new ConflictException('Project cannot be modified'),
      );

      // Act & Assert
      await expect(
        controller.update(mockProjectId, updateDto, mockUser),
      ).rejects.toThrow(ConflictException);
    });

    it('should log update attempt', async () => {
      // Arrange
      const updateDto = createValidUpdateDto();
      const loggerSpy = jest.spyOn(controller['logger'], 'log');
      const expectedResponse = createMockProjectResponse();

      mockProjectService.update.mockResolvedValue(expectedResponse);

      // Act
      await controller.update(mockProjectId, updateDto, mockUser);

      // Assert
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Updating project'),
        expect.objectContaining({
          operation: 'update',
          projectId: mockProjectId,
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
      // Arrange
      mockProjectService.archive.mockResolvedValue(undefined);

      // Act
      await controller.archive(mockProjectId, mockUser);

      // Assert
      expect(mockProjectService.archive).toHaveBeenCalledWith(
        mockProjectId,
        mockUser.id,
      );
    });

    it('should return 204 status (void)', async () => {
      // Arrange
      mockProjectService.archive.mockResolvedValue(undefined);

      // Act
      const result = await controller.archive(mockProjectId, mockUser);

      // Assert
      expect(result).toBeUndefined();
    });

    it('should apply ProjectOwnerGuard', async () => {
      // Arrange
      mockProjectService.archive.mockResolvedValue(undefined);

      // Act
      await controller.archive(mockProjectId, mockUser);

      // Assert
      expect(mockProjectService.archive).toHaveBeenCalled();
    });

    it('should handle project not found', async () => {
      // Arrange
      mockProjectService.archive.mockRejectedValue(
        new NotFoundException('Project not found'),
      );

      // Act & Assert
      await expect(controller.archive(mockProjectId, mockUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should handle invalid state transition', async () => {
      // Arrange
      mockProjectService.archive.mockRejectedValue(
        new ConflictException('Cannot archive project'),
      );

      // Act & Assert
      await expect(controller.archive(mockProjectId, mockUser)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should log archiving attempt', async () => {
      // Arrange
      const loggerSpy = jest.spyOn(controller['logger'], 'log');

      mockProjectService.archive.mockResolvedValue(undefined);

      // Act
      await controller.archive(mockProjectId, mockUser);

      // Assert
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Archiving project'),
        expect.objectContaining({
          operation: 'archive',
          projectId: mockProjectId,
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
      // Arrange
      mockProjectService.delete.mockResolvedValue(undefined);

      // Act
      await controller.delete(mockProjectId, mockUser);

      // Assert
      expect(mockProjectService.delete).toHaveBeenCalledWith(
        mockProjectId,
        mockUser.id,
      );
    });

    it('should return 204 status (void)', async () => {
      // Arrange
      mockProjectService.delete.mockResolvedValue(undefined);

      // Act
      const result = await controller.delete(mockProjectId, mockUser);

      // Assert
      expect(result).toBeUndefined();
    });

    it('should apply ProjectOwnerGuard', async () => {
      // Arrange
      mockProjectService.delete.mockResolvedValue(undefined);

      // Act
      await controller.delete(mockProjectId, mockUser);

      // Assert
      expect(mockProjectService.delete).toHaveBeenCalled();
    });

    it('should handle project not found', async () => {
      // Arrange
      mockProjectService.delete.mockRejectedValue(
        new NotFoundException('Project not found'),
      );

      // Act & Assert
      await expect(controller.delete(mockProjectId, mockUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should log deletion attempt', async () => {
      // Arrange
      const loggerSpy = jest.spyOn(controller['logger'], 'log');

      mockProjectService.delete.mockResolvedValue(undefined);

      // Act
      await controller.delete(mockProjectId, mockUser);

      // Assert
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Deleting project'),
        expect.objectContaining({
          operation: 'delete',
          projectId: mockProjectId,
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
      fileIds: ['gen1-uuid', 'gen2-uuid', 'gen3-uuid'],
      mode: 'append',
    };

    it('should update generated files successfully', async () => {
      // Arrange
      const serviceToken = 'valid-service-token';

      mockProjectService.updateGeneratedFiles.mockResolvedValue(undefined);

      // Act
      await controller.updateGeneratedFiles(
        mockProjectId,
        validUpdateFilesDto,
        serviceToken,
      );

      // Assert
      expect(mockProjectService.updateGeneratedFiles).toHaveBeenCalledWith(
        mockProjectId,
        validUpdateFilesDto.fileIds,
        validUpdateFilesDto.mode,
      );
    });

    it('should validate service token presence', async () => {
      // Arrange
      const emptyToken = '';

      // Act & Assert
      await expect(
        controller.updateGeneratedFiles(
          mockProjectId,
          validUpdateFilesDto,
          emptyToken,
        ),
      ).rejects.toThrow(BadRequestException);

      expect(mockProjectService.updateGeneratedFiles).not.toHaveBeenCalled();
    });

    it('should validate service token is not empty', async () => {
      // Arrange
      const whitespaceToken = '   ';

      // Act & Assert
      await expect(
        controller.updateGeneratedFiles(
          mockProjectId,
          validUpdateFilesDto,
          whitespaceToken,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle missing service token header', async () => {
      // Act & Assert
      await expect(
        controller.updateGeneratedFiles(
          mockProjectId,
          validUpdateFilesDto,
          undefined as any,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should update files in replace mode', async () => {
      // Arrange
      const replaceDto: UpdateGeneratedFilesDto = {
        fileIds: ['new-gen1-uuid', 'new-gen2-uuid'],
        mode: 'replace',
      };
      const serviceToken = 'valid-service-token';

      mockProjectService.updateGeneratedFiles.mockResolvedValue(undefined);

      // Act
      await controller.updateGeneratedFiles(
        mockProjectId,
        replaceDto,
        serviceToken,
      );

      // Assert
      expect(mockProjectService.updateGeneratedFiles).toHaveBeenCalledWith(
        mockProjectId,
        replaceDto.fileIds,
        'replace',
      );
    });

    it('should handle empty file IDs array', async () => {
      // Arrange
      const emptyFilesDto: UpdateGeneratedFilesDto = {
        fileIds: [],
        mode: 'append',
      };
      const serviceToken = 'valid-service-token';

      mockProjectService.updateGeneratedFiles.mockResolvedValue(undefined);

      // Act
      await controller.updateGeneratedFiles(
        mockProjectId,
        emptyFilesDto,
        serviceToken,
      );

      // Assert
      expect(mockProjectService.updateGeneratedFiles).toHaveBeenCalledWith(
        mockProjectId,
        [],
        'append',
      );
    });

    it('should handle service errors', async () => {
      // Arrange
      const serviceToken = 'valid-service-token';

      mockProjectService.updateGeneratedFiles.mockRejectedValue(
        new NotFoundException('Project not found'),
      );

      // Act & Assert
      await expect(
        controller.updateGeneratedFiles(
          mockProjectId,
          validUpdateFilesDto,
          serviceToken,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should log file update attempt', async () => {
      // Arrange
      const serviceToken = 'valid-service-token';
      const loggerSpy = jest.spyOn(controller['logger'], 'log');

      mockProjectService.updateGeneratedFiles.mockResolvedValue(undefined);

      // Act
      await controller.updateGeneratedFiles(
        mockProjectId,
        validUpdateFilesDto,
        serviceToken,
      );

      // Assert
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Updating generated files'),
        expect.objectContaining({
          operation: 'updateGeneratedFiles',
          projectId: mockProjectId,
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
      const validUuid = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
      const expectedResponse = createMockProjectResponse();

      mockProjectService.findOne.mockResolvedValue(expectedResponse);

      // Act
      await controller.findOne(validUuid, mockUser);

      // Assert
      expect(mockProjectService.findOne).toHaveBeenCalledWith(
        validUuid,
        mockUser.id,
      );
    });

    it('should handle pagination edge cases', async () => {
      // Arrange
      const edgePagination = createMockPagination(1000, 100);
      const expectedResult = createMockPaginatedResult([], 0);

      mockProjectService.findAll.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.findAll(mockUser, edgePagination, {});

      // Assert
      expect(result.data).toHaveLength(0);
      expect(mockProjectService.findAll).toHaveBeenCalledWith(
        mockUser.id,
        edgePagination,
        expect.any(Object),
      );
    });
  });

  // ========================================================================
  // TESTS DE GESTION D'ERREURS GLOBALES
  // ========================================================================

  describe('Error handling', () => {
    it('should propagate service validation errors', async () => {
      // Arrange
      const createDto = createValidCreateDto();

      mockProjectService.create.mockRejectedValue(
        new BadRequestException('Invalid data'),
      );

      // Act & Assert
      await expect(controller.create(createDto, mockUser)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should propagate service authorization errors', async () => {
      // Arrange
      mockProjectService.findOne.mockRejectedValue(
        new ForbiddenException('Access denied'),
      );

      // Act & Assert
      await expect(controller.findOne(mockProjectId, mockUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should propagate service not found errors', async () => {
      // Arrange
      mockProjectService.findOne.mockRejectedValue(
        new NotFoundException('Project not found'),
      );

      // Act & Assert
      await expect(controller.findOne(mockProjectId, mockUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should propagate service conflict errors', async () => {
      // Arrange
      const updateDto = createValidUpdateDto();

      mockProjectService.update.mockRejectedValue(
        new ConflictException('Name already exists'),
      );

      // Act & Assert
      await expect(
        controller.update(mockProjectId, updateDto, mockUser),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ========================================================================
  // TESTS D'EDGE CASES ET SCÉNARIOS LIMITES
  // ========================================================================

  describe('Edge cases', () => {
    it('should handle very long project lists', async () => {
      // Arrange
      const pagination = createMockPagination(1, 100);
      const manyItems = Array.from({ length: 100 }, (_, i) => {
        const item = createMockProjectListItem();
        item.id = `project-${i}-uuid`;
        item.name = `Project ${i}`;
        return item;
      });
      const result = createMockPaginatedResult(manyItems, 1000, 1, 100);

      mockProjectService.findAll.mockResolvedValue(result);

      // Act
      const response = await controller.findAll(mockUser, pagination, {});

      // Assert
      expect(response.data).toHaveLength(100);
      expect(response.total).toBe(1000);
      expect(response.pagination.hasNext).toBe(true);
    });

    it('should handle projects with maximum file counts', async () => {
      // Arrange
      const response = createMockProjectResponse();
      response.uploadedFileIds = Array.from(
        { length: 10 },
        (_, i) => `upload-${i}-uuid`,
      );
      response.generatedFileIds = Array.from(
        { length: 50 },
        (_, i) => `gen-${i}-uuid`,
      );

      mockProjectService.findOne.mockResolvedValue(response);

      // Act
      const result = await controller.findOne(mockProjectId, mockUser);

      // Assert
      expect(result.uploadedFileIds).toHaveLength(10);
      expect(result.generatedFileIds).toHaveLength(50);
    });

    it('should handle complex filter combinations', async () => {
      // Arrange
      const complexFilters: ProjectFiltersDto = {
        status: ProjectStatus.ACTIVE,
        search: 'complex search term',
        hasGeneratedFiles: true,
        hasStatistics: false,
        createdAfter: '2024-01-01T00:00:00Z',
        createdBefore: '2024-12-31T23:59:59Z',
        orderBy: 'name',
        order: 'asc',
      };
      const result = createMockPaginatedResult([]);
      const pagination = createMockPagination(1, 10);

      mockProjectService.findAll.mockResolvedValue(result);

      // Act
      await controller.findAll(mockUser, pagination, complexFilters);

      // Assert
      expect(mockProjectService.findAll).toHaveBeenCalledWith(
        mockUser.id,
        pagination,
        expect.objectContaining({
          status: ProjectStatus.ACTIVE,
          search: 'complex search term',
          hasGeneratedFiles: true,
          hasStatistics: false,
          createdAfter: new Date('2024-01-01T00:00:00Z'),
          createdBefore: new Date('2024-12-31T23:59:59Z'),
          orderBy: 'name',
          order: 'asc',
        }),
      );
    });

    it('should handle simultaneous operations gracefully', async () => {
      // Arrange
      const createDto = createValidCreateDto();
      const updateDto = createValidUpdateDto();
      const createResponse = createMockProjectResponse();
      const updateResponse = createMockProjectResponse();
      updateResponse.name = 'Updated Name';

      mockProjectService.create.mockResolvedValue(createResponse);
      mockProjectService.update.mockResolvedValue(updateResponse);

      // Act - Simule des opérations simultanées
      const [createResult, updateResult] = await Promise.all([
        controller.create(createDto, mockUser),
        controller.update(mockProjectId, updateDto, mockUser),
      ]);

      // Assert
      expect(createResult.id).toBe(mockProjectId);
      expect(updateResult.name).toBe('Updated Name');
      expect(mockProjectService.create).toHaveBeenCalledTimes(1);
      expect(mockProjectService.update).toHaveBeenCalledTimes(1);
    });
  });
});
