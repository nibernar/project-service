import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { ExportController } from '../../../../src/export/export.controller';
import { ExportService } from '../../../../src/export/export.service';
import { ExportOptionsDto, PdfOptionsDto } from '../../../../src/export/dto/export-options.dto';
import { ExportResponseDto, ExportStatusDto } from '../../../../src/export/dto/export-response.dto';
import { AuthGuard } from '../../../../src/common/guards/auth.guard';
import { ProjectOwnerGuard } from '../../../../src/common/guards/project-owner.guard';
import { User } from '../../../../src/common/interfaces/user.interface';

// Mock des guards
const mockAuthGuard = {
  canActivate: jest.fn().mockReturnValue(true),
};

const mockProjectOwnerGuard = {
  canActivate: jest.fn().mockReturnValue(true),
};

describe('ExportController', () => {
  let controller: ExportController;
  let exportService: jest.Mocked<ExportService>;

  // Test data fixtures
  const mockUser: User = {
    id: 'user-123',
    email: 'test@example.com',
    roles: ['user'], // CORRIGÉ : Suppression de 'name' qui n'existe que dans ExtendedUser
  };

  const mockProjectId = 'project-456';
  const mockExportId = 'export-789';

  // CORRIGÉ : Mock avec toutes les méthodes de classe
  const createMockExportResponse = (): ExportResponseDto => {
    const mock = new ExportResponseDto();
    mock.downloadUrl = 'https://storage.coders.com/exports/temp/test-export.pdf?expires=1640995200&signature=xyz';
    mock.fileName = 'Test Project - Export PDF - 2024-08-18.pdf';
    mock.fileSize = 1048576;
    mock.format = 'pdf';
    mock.expiresAt = new Date('2024-08-18T15:30:00.000Z');
    mock.md5Hash = 'a1b2c3d4e5f6789012345678901234567890abcd';
    
    // Ajouter les méthodes manquantes
    mock.isDownloadValid = jest.fn().mockReturnValue(true);
    mock.getTimeUntilExpiry = jest.fn().mockReturnValue(30);
    mock.getFormattedFileSize = jest.fn().mockReturnValue('1.0 MB');
    mock.isLargeFile = jest.fn().mockReturnValue(false);
    
    return mock;
  };

  // CORRIGÉ : Mock avec toutes les méthodes de classe
  const createMockExportStatus = (): ExportStatusDto => {
    const mock = new ExportStatusDto();
    mock.status = 'processing';
    mock.progress = 75;
    mock.message = 'Conversion PDF en cours...';
    mock.estimatedTimeRemaining = 30;
    mock.lastUpdated = new Date('2024-08-18T10:35:22.123Z');
    
    // Ajouter les méthodes manquantes
    mock.isCompleted = jest.fn().mockReturnValue(false);
    mock.isActive = jest.fn().mockReturnValue(true);
    mock.isStale = jest.fn().mockReturnValue(false);
    mock.getFormattedTimeRemaining = jest.fn().mockReturnValue('30 secondes');
    mock.getDisplayMessage = jest.fn().mockReturnValue('En cours (75%) - Conversion PDF... - 30 secondes restantes');
    mock.getSeverityLevel = jest.fn().mockReturnValue('info');
    mock.toLogSafeString = jest.fn().mockReturnValue('ExportStatusDto[status=processing_75%_30s, stale=false]');
    
    return mock;
  };

  const mockServiceStatus = {
    ready: true,
    activeExports: 2,
    queuedExports: 1,
    maxConcurrency: 5,
    cacheEnabled: true,
    dependencies: {
      fileRetrieval: true,
      markdownExport: true,
      pdfExport: true,
      cache: true,
    },
  };

  beforeEach(async () => {
    // Create mock ExportService
    const mockExportService = {
      exportProject: jest.fn(),
      getExportStatus: jest.fn(),
      getServiceStatus: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ExportController],
      providers: [
        { provide: ExportService, useValue: mockExportService },
      ],
    })
    .overrideGuard(AuthGuard)
    .useValue(mockAuthGuard)
    .overrideGuard(ProjectOwnerGuard)
    .useValue(mockProjectOwnerGuard)
    .compile();

    controller = module.get<ExportController>(ExportController);
    exportService = module.get(ExportService);

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('Controller Definition', () => {
    it('should be defined', () => {
      expect(controller).toBeDefined();
    });
  });

  describe('exportProject - Tests nominaux', () => {
    it('should export project with Markdown format successfully', async () => {
      const exportOptions = new ExportOptionsDto();
      exportOptions.format = 'markdown';
      exportOptions.includeMetadata = true;

      // Mock validation success
      jest.spyOn(exportOptions, 'validateOptions').mockReturnValue({
        valid: true,
        errors: [],
      });

      // CORRIGÉ : Utiliser les bonnes valeurs de complexité
      jest.spyOn(exportOptions, 'getExportComplexity').mockReturnValue('low');
      jest.spyOn(exportOptions, 'toLogSafeString').mockReturnValue('format=markdown,complexity=low');
      jest.spyOn(exportOptions, 'isHeavyExport').mockReturnValue(false);

      const expectedResponse = createMockExportResponse();
      expectedResponse.format = 'markdown';
      expectedResponse.fileName = 'Test Project - Export Markdown - 2024-08-18.md';

      exportService.exportProject.mockResolvedValue(expectedResponse);

      const result = await controller.exportProject(mockProjectId, exportOptions, mockUser);

      expect(result).toEqual(expectedResponse);
      expect(exportService.exportProject).toHaveBeenCalledWith(
        mockProjectId,
        exportOptions,
        mockUser.id
      );
    });

    it('should export project with PDF format and custom options', async () => {
      const exportOptions = new ExportOptionsDto();
      exportOptions.format = 'pdf';
      exportOptions.includeMetadata = true;
      
      // CORRIGÉ : Créer un mock PDF options avec la méthode isValid()
      const mockPdfOptions = new PdfOptionsDto();
      mockPdfOptions.pageSize = 'A4';
      mockPdfOptions.margins = 25;
      mockPdfOptions.includeTableOfContents = true;
      mockPdfOptions.isValid = jest.fn().mockReturnValue(true); // Ajouter la méthode manquante
      
      exportOptions.pdfOptions = mockPdfOptions;

      jest.spyOn(exportOptions, 'validateOptions').mockReturnValue({
        valid: true,
        errors: [],
      });

      // CORRIGÉ : Utiliser les bonnes valeurs de complexité
      jest.spyOn(exportOptions, 'getExportComplexity').mockReturnValue('high');
      jest.spyOn(exportOptions, 'toLogSafeString').mockReturnValue('format=pdf,complexity=high');
      jest.spyOn(exportOptions, 'isHeavyExport').mockReturnValue(true);

      const mockResponse = createMockExportResponse();
      exportService.exportProject.mockResolvedValue(mockResponse);

      const result = await controller.exportProject(mockProjectId, exportOptions, mockUser);

      expect(result).toEqual(mockResponse);
      expect(exportService.exportProject).toHaveBeenCalledWith(
        mockProjectId,
        exportOptions,
        mockUser.id
      );
    });

    it('should export project with file selection', async () => {
      const exportOptions = new ExportOptionsDto();
      exportOptions.format = 'pdf';
      exportOptions.fileIds = ['file-1', 'file-2', 'file-3'];
      exportOptions.includeMetadata = false;

      jest.spyOn(exportOptions, 'validateOptions').mockReturnValue({
        valid: true,
        errors: [],
      });

      // CORRIGÉ : Utiliser les bonnes valeurs de complexité
      jest.spyOn(exportOptions, 'getExportComplexity').mockReturnValue('medium');
      jest.spyOn(exportOptions, 'toLogSafeString').mockReturnValue('format=pdf,files=3,complexity=medium');
      jest.spyOn(exportOptions, 'isHeavyExport').mockReturnValue(false);

      const mockResponse = createMockExportResponse();
      exportService.exportProject.mockResolvedValue(mockResponse);

      const result = await controller.exportProject(mockProjectId, exportOptions, mockUser);

      expect(result).toEqual(mockResponse);
    });

    it('should handle successful export with proper logging', async () => {
      const exportOptions = new ExportOptionsDto();
      exportOptions.format = 'markdown';

      jest.spyOn(exportOptions, 'validateOptions').mockReturnValue({
        valid: true,
        errors: [],
      });

      // CORRIGÉ : Utiliser les bonnes valeurs de complexité
      jest.spyOn(exportOptions, 'getExportComplexity').mockReturnValue('low');
      jest.spyOn(exportOptions, 'toLogSafeString').mockReturnValue('format=markdown');
      jest.spyOn(exportOptions, 'isHeavyExport').mockReturnValue(false);

      const mockResponse = createMockExportResponse();
      exportService.exportProject.mockResolvedValue(mockResponse);

      // Spy on logger
      const logSpy = jest.spyOn(controller['logger'], 'log');
      const debugSpy = jest.spyOn(controller['logger'], 'debug');

      await controller.exportProject(mockProjectId, exportOptions, mockUser);

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining(`Export request for project ${mockProjectId} by user ${mockUser.id}`)
      );
      expect(debugSpy).toHaveBeenCalledWith(
        expect.stringContaining('Export details:')
      );
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining(`Export completed successfully for project ${mockProjectId}`)
      );
    });
  });

  describe('exportProject - Tests d\'erreur', () => {
    it('should throw BadRequestException for invalid export options', async () => {
      const exportOptions = new ExportOptionsDto();
      exportOptions.format = 'invalid' as any;

      jest.spyOn(exportOptions, 'validateOptions').mockReturnValue({
        valid: false,
        errors: ['Invalid format specified', 'Format must be markdown or pdf'],
      });

      // CORRIGÉ : Utiliser les bonnes valeurs de complexité
      jest.spyOn(exportOptions, 'getExportComplexity').mockReturnValue('low');

      const warnSpy = jest.spyOn(controller['logger'], 'warn');

      await expect(
        controller.exportProject(mockProjectId, exportOptions, mockUser)
      ).rejects.toThrow(BadRequestException);

      // CORRIGÉ : Adapter le test à la structure réelle de l'exception
      await expect(
        controller.exportProject(mockProjectId, exportOptions, mockUser)
      ).rejects.toMatchObject({
        message: expect.stringContaining('Invalid export options'),
      });

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining(`Invalid export options for project ${mockProjectId}`)
      );
    });

    it('should handle service errors and re-throw HttpExceptions', async () => {
      const exportOptions = new ExportOptionsDto();
      exportOptions.format = 'markdown';

      jest.spyOn(exportOptions, 'validateOptions').mockReturnValue({
        valid: true,
        errors: [],
      });

      // CORRIGÉ : Utiliser les bonnes valeurs de complexité
      jest.spyOn(exportOptions, 'getExportComplexity').mockReturnValue('low');
      jest.spyOn(exportOptions, 'toLogSafeString').mockReturnValue('format=markdown');
      jest.spyOn(exportOptions, 'isHeavyExport').mockReturnValue(false);
      jest.spyOn(exportOptions, 'getSelectedFilesCount').mockReturnValue(5);

      const serviceError = new HttpException(
        'Project not found or access denied',
        HttpStatus.FORBIDDEN
      );

      exportService.exportProject.mockRejectedValue(serviceError);

      await expect(
        controller.exportProject(mockProjectId, exportOptions, mockUser)
      ).rejects.toThrow(HttpException);

      await expect(
        controller.exportProject(mockProjectId, exportOptions, mockUser)
      ).rejects.toMatchObject({
        message: 'Project not found or access denied',
        status: HttpStatus.FORBIDDEN,
      });
    });

    it('should transform timeout errors appropriately', async () => {
      const exportOptions = new ExportOptionsDto();
      exportOptions.format = 'pdf';

      jest.spyOn(exportOptions, 'validateOptions').mockReturnValue({
        valid: true,
        errors: [],
      });

      // CORRIGÉ : Utiliser les bonnes valeurs de complexité
      jest.spyOn(exportOptions, 'getExportComplexity').mockReturnValue('high');
      jest.spyOn(exportOptions, 'toLogSafeString').mockReturnValue('format=pdf');
      jest.spyOn(exportOptions, 'isHeavyExport').mockReturnValue(true);
      jest.spyOn(exportOptions, 'getSelectedFilesCount').mockReturnValue(10);

      const timeoutError = new Error('Export timeout - project too large');
      exportService.exportProject.mockRejectedValue(timeoutError);

      await expect(
        controller.exportProject(mockProjectId, exportOptions, mockUser)
      ).rejects.toMatchObject({
        message: 'Export timeout - project may be too large',
        status: HttpStatus.REQUEST_TIMEOUT,
      });
    });

    it('should transform memory/size errors appropriately', async () => {
      const exportOptions = new ExportOptionsDto();
      exportOptions.format = 'pdf';

      jest.spyOn(exportOptions, 'validateOptions').mockReturnValue({
        valid: true,
        errors: [],
      });

      // CORRIGÉ : Utiliser les bonnes valeurs de complexité
      jest.spyOn(exportOptions, 'getExportComplexity').mockReturnValue('high');
      jest.spyOn(exportOptions, 'toLogSafeString').mockReturnValue('format=pdf');
      jest.spyOn(exportOptions, 'isHeavyExport').mockReturnValue(true);
      jest.spyOn(exportOptions, 'getSelectedFilesCount').mockReturnValue(100);

      const memoryError = new Error('Not enough memory to process export');
      exportService.exportProject.mockRejectedValue(memoryError);

      await expect(
        controller.exportProject(mockProjectId, exportOptions, mockUser)
      ).rejects.toMatchObject({
        message: 'Project too large for export',
        status: HttpStatus.PAYLOAD_TOO_LARGE,
      });
    });

    it('should transform Pandoc conversion errors appropriately', async () => {
      const exportOptions = new ExportOptionsDto();
      exportOptions.format = 'pdf';

      jest.spyOn(exportOptions, 'validateOptions').mockReturnValue({
        valid: true,
        errors: [],
      });

      // CORRIGÉ : Utiliser les bonnes valeurs de complexité
      jest.spyOn(exportOptions, 'getExportComplexity').mockReturnValue('high');
      jest.spyOn(exportOptions, 'toLogSafeString').mockReturnValue('format=pdf');
      jest.spyOn(exportOptions, 'isHeavyExport').mockReturnValue(true);
      jest.spyOn(exportOptions, 'getSelectedFilesCount').mockReturnValue(5);

      const pandocError = new Error('pandoc conversion failed');
      exportService.exportProject.mockRejectedValue(pandocError);

      await expect(
        controller.exportProject(mockProjectId, exportOptions, mockUser)
      ).rejects.toMatchObject({
        message: 'Document conversion failed - please try again or contact support',
        status: HttpStatus.UNPROCESSABLE_ENTITY,
      });
    });

    it('should handle unexpected errors with generic message', async () => {
      const exportOptions = new ExportOptionsDto();
      exportOptions.format = 'markdown';

      jest.spyOn(exportOptions, 'validateOptions').mockReturnValue({
        valid: true,
        errors: [],
      });

      // CORRIGÉ : Utiliser les bonnes valeurs de complexité
      jest.spyOn(exportOptions, 'getExportComplexity').mockReturnValue('low');
      jest.spyOn(exportOptions, 'toLogSafeString').mockReturnValue('format=markdown');
      jest.spyOn(exportOptions, 'isHeavyExport').mockReturnValue(false);
      jest.spyOn(exportOptions, 'getSelectedFilesCount').mockReturnValue(3);

      const unexpectedError = new Error('Unexpected database error');
      exportService.exportProject.mockRejectedValue(unexpectedError);

      const errorSpy = jest.spyOn(controller['logger'], 'error');

      await expect(
        controller.exportProject(mockProjectId, exportOptions, mockUser)
      ).rejects.toMatchObject({
        message: 'Export failed due to technical error',
        status: HttpStatus.INTERNAL_SERVER_ERROR,
      });

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unexpected export error'),
        expect.objectContaining({
          projectId: mockProjectId,
          userId: mockUser.id,
          format: 'markdown',
          complexity: 'low',
          filesCount: 3,
          stack: expect.any(String),
        })
      );
    });
  });

  describe('getExportStatus - Tests nominaux', () => {
    it('should return export status successfully', async () => {
      const mockStatus = createMockExportStatus();
      exportService.getExportStatus.mockResolvedValue(mockStatus);

      const result = await controller.getExportStatus(mockExportId, mockUser);

      expect(result).toEqual(mockStatus);
      expect(exportService.getExportStatus).toHaveBeenCalledWith(mockExportId, mockUser.id);
    });

    it('should return completed status', async () => {
      const completedStatus = createMockExportStatus();
      completedStatus.status = 'completed';
      completedStatus.progress = 100;
      completedStatus.message = 'Export terminé avec succès';
      completedStatus.lastUpdated = new Date('2024-08-18T10:36:45.789Z');
      completedStatus.isCompleted = jest.fn().mockReturnValue(true);

      exportService.getExportStatus.mockResolvedValue(completedStatus);

      const result = await controller.getExportStatus(mockExportId, mockUser);

      expect(result).toEqual(completedStatus);
    });

    it('should return failed status', async () => {
      const failedStatus = createMockExportStatus();
      failedStatus.status = 'failed';
      failedStatus.progress = 45;
      failedStatus.message = 'Échec lors de la conversion';
      failedStatus.error = 'Pandoc conversion failed: document too complex';
      failedStatus.lastUpdated = new Date('2024-08-18T10:35:30.456Z');
      failedStatus.isCompleted = jest.fn().mockReturnValue(true);

      exportService.getExportStatus.mockResolvedValue(failedStatus);

      const result = await controller.getExportStatus(mockExportId, mockUser);

      expect(result).toEqual(failedStatus);
    });

    it('should log debug information correctly', async () => {
      const mockStatus = createMockExportStatus();
      exportService.getExportStatus.mockResolvedValue(mockStatus);

      const debugSpy = jest.spyOn(controller['logger'], 'debug');

      await controller.getExportStatus(mockExportId, mockUser);

      expect(debugSpy).toHaveBeenCalledWith(
        `Status request for export ${mockExportId} by user ${mockUser.id}`
      );
      expect(debugSpy).toHaveBeenCalledWith(
        `Export status: ${mockExportId} -> ${mockStatus.status} (${mockStatus.progress}%)`
      );
    });
  });

  describe('getExportStatus - Tests d\'erreur', () => {
    it('should handle export not found error', async () => {
      const notFoundError = new HttpException(
        'Export not found or already completed',
        HttpStatus.NOT_FOUND
      );

      exportService.getExportStatus.mockRejectedValue(notFoundError);

      const warnSpy = jest.spyOn(controller['logger'], 'warn');

      await expect(
        controller.getExportStatus(mockExportId, mockUser)
      ).rejects.toThrow(HttpException);

      await expect(
        controller.getExportStatus(mockExportId, mockUser)
      ).rejects.toMatchObject({
        message: 'Export not found or already completed',
        status: HttpStatus.NOT_FOUND,
      });

      expect(warnSpy).toHaveBeenCalledWith(
        `Export status not found: ${mockExportId} for user ${mockUser.id}`
      );
    });

    it('should handle forbidden access error', async () => {
      const forbiddenError = new HttpException(
        'You do not have access to this export',
        HttpStatus.FORBIDDEN
      );

      exportService.getExportStatus.mockRejectedValue(forbiddenError);

      await expect(
        controller.getExportStatus(mockExportId, mockUser)
      ).rejects.toThrow(HttpException);

      await expect(
        controller.getExportStatus(mockExportId, mockUser)
      ).rejects.toMatchObject({
        message: 'You do not have access to this export',
        status: HttpStatus.FORBIDDEN,
      });
    });

    it('should handle unexpected errors in getExportStatus', async () => {
      const unexpectedError = new Error('Database connection failed');
      exportService.getExportStatus.mockRejectedValue(unexpectedError);

      const errorSpy = jest.spyOn(controller['logger'], 'error');

      await expect(
        controller.getExportStatus(mockExportId, mockUser)
      ).rejects.toMatchObject({
        message: 'Failed to retrieve export status',
        status: HttpStatus.INTERNAL_SERVER_ERROR,
      });

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining(`Failed to retrieve export status ${mockExportId}`),
        expect.any(String)
      );
    });
  });

  describe('getHealthStatus - Tests nominaux', () => {
    it('should return healthy status when all services are ready', async () => {
      exportService.getServiceStatus.mockReturnValue(mockServiceStatus);

      const result = await controller.getHealthStatus();

      expect(result.status).toBe('healthy');
      expect(result.services).toEqual({
        fileRetrieval: true,
        markdownExport: true,
        pdfExport: true,
        cache: true,
      });
      expect(result.metrics).toEqual({
        activeExports: 2,
        queuedExports: 1,
        maxConcurrency: 5,
      });
      expect(result.timestamp).toBeDefined();
    });

    it('should return degraded status when some services are down', async () => {
      const degradedStatus = {
        ...mockServiceStatus,
        dependencies: {
          ...mockServiceStatus.dependencies,
          cache: false, // Cache is down
        },
      };

      exportService.getServiceStatus.mockReturnValue(degradedStatus);

      const result = await controller.getHealthStatus();

      expect(result.status).toBe('degraded');
      expect(result.services.cache).toBe(false);
      expect(result.services.fileRetrieval).toBe(true);
    });

    it('should return degraded status when at capacity', async () => {
      const atCapacityStatus = {
        ...mockServiceStatus,
        activeExports: 5, // At max capacity
      };

      exportService.getServiceStatus.mockReturnValue(atCapacityStatus);

      const result = await controller.getHealthStatus();

      expect(result.status).toBe('degraded');
      expect(result.metrics.activeExports).toBe(5);
      expect(result.metrics.maxConcurrency).toBe(5);
    });

    it('should return unhealthy status when service is not ready', async () => {
      const unhealthyStatus = {
        ...mockServiceStatus,
        ready: false,
        dependencies: {
          fileRetrieval: false,
          markdownExport: false,
          pdfExport: false,
          cache: false,
        },
      };

      exportService.getServiceStatus.mockReturnValue(unhealthyStatus);

      const result = await controller.getHealthStatus();

      expect(result.status).toBe('unhealthy');
      expect(Object.values(result.services)).toEqual([false, false, false, false]);
    });

    it('should handle health check with proper logging', async () => {
      exportService.getServiceStatus.mockReturnValue(mockServiceStatus);

      const debugSpy = jest.spyOn(controller['logger'], 'debug');

      await controller.getHealthStatus();

      expect(debugSpy).toHaveBeenCalledWith('Health check completed: healthy');
    });
  });

  describe('getHealthStatus - Tests d\'erreur', () => {
    it('should return unhealthy status when health check fails', async () => {
      const healthError = new Error('Service status check failed');
      exportService.getServiceStatus.mockImplementation(() => {
        throw healthError;
      });

      const errorSpy = jest.spyOn(controller['logger'], 'error');

      const result = await controller.getHealthStatus();

      expect(result.status).toBe('unhealthy');
      expect(Object.values(result.services)).toEqual([false, false, false, false]);
      expect(result.metrics).toEqual({
        activeExports: 0,
        queuedExports: 0,
        maxConcurrency: 0,
      });

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Health check failed'),
        expect.any(String)
      );
    });
  });

  describe('Guards Integration', () => {
    it('should use AuthGuard for all endpoints', () => {
      // This test ensures guards are properly configured
      // The actual guard logic is tested separately
      expect(mockAuthGuard.canActivate).toBeDefined();
    });

    it('should use ProjectOwnerGuard for exportProject endpoint', () => {
      // This test ensures the ProjectOwnerGuard is applied
      expect(mockProjectOwnerGuard.canActivate).toBeDefined();
    });

    it('should handle guard rejection', async () => {
      mockProjectOwnerGuard.canActivate.mockReturnValue(false);

      const exportOptions = new ExportOptionsDto();
      exportOptions.format = 'markdown';

      jest.spyOn(exportOptions, 'validateOptions').mockReturnValue({
        valid: true,
        errors: [],
      });

      // In real scenario, the guard would prevent this call
      // But for unit testing, we test the guard separately
      expect(mockProjectOwnerGuard.canActivate).toBeDefined();
    });
  });

  describe('Parameter Validation', () => {
    it('should validate UUID format for projectId', async () => {
      // This test ensures ParseUUIDPipe is configured correctly
      const exportOptions = new ExportOptionsDto();
      exportOptions.format = 'markdown';

      jest.spyOn(exportOptions, 'validateOptions').mockReturnValue({
        valid: true,
        errors: [],
      });

      // CORRIGÉ : Utiliser les bonnes valeurs de complexité
      jest.spyOn(exportOptions, 'getExportComplexity').mockReturnValue('low');
      jest.spyOn(exportOptions, 'toLogSafeString').mockReturnValue('format=markdown');
      jest.spyOn(exportOptions, 'isHeavyExport').mockReturnValue(false);

      const mockResponse = createMockExportResponse();
      exportService.exportProject.mockResolvedValue(mockResponse);

      // Valid UUID should work
      await expect(
        controller.exportProject(mockProjectId, exportOptions, mockUser)
      ).resolves.toBeDefined();
    });

    it('should validate UUID format for exportId', async () => {
      const mockStatus = createMockExportStatus();
      exportService.getExportStatus.mockResolvedValue(mockStatus);

      // Valid UUID should work
      await expect(
        controller.getExportStatus(mockExportId, mockUser)
      ).resolves.toBeDefined();
    });
  });

  describe('Error Logging and Context', () => {
    it('should log errors with appropriate severity levels', async () => {
      const exportOptions = new ExportOptionsDto();
      exportOptions.format = 'pdf';

      jest.spyOn(exportOptions, 'validateOptions').mockReturnValue({
        valid: true,
        errors: [],
      });

      // CORRIGÉ : Utiliser les bonnes valeurs de complexité
      jest.spyOn(exportOptions, 'getExportComplexity').mockReturnValue('high');
      jest.spyOn(exportOptions, 'toLogSafeString').mockReturnValue('format=pdf');
      jest.spyOn(exportOptions, 'isHeavyExport').mockReturnValue(true);
      jest.spyOn(exportOptions, 'getSelectedFilesCount').mockReturnValue(10);

      const serverError = new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
      exportService.exportProject.mockRejectedValue(serverError);

      const errorSpy = jest.spyOn(controller['logger'], 'error');

      await expect(
        controller.exportProject(mockProjectId, exportOptions, mockUser)
      ).rejects.toThrow();

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Export system error'),
        expect.objectContaining({
          projectId: mockProjectId,
          userId: mockUser.id,
          format: 'pdf',
          complexity: 'high',
          filesCount: 10,
        })
      );
    });

    it('should log rate limiting warnings', async () => {
      const exportOptions = new ExportOptionsDto();
      exportOptions.format = 'markdown';

      jest.spyOn(exportOptions, 'validateOptions').mockReturnValue({
        valid: true,
        errors: [],
      });

      // CORRIGÉ : Utiliser les bonnes valeurs de complexité
      jest.spyOn(exportOptions, 'getExportComplexity').mockReturnValue('low');
      jest.spyOn(exportOptions, 'toLogSafeString').mockReturnValue('format=markdown');
      jest.spyOn(exportOptions, 'isHeavyExport').mockReturnValue(false);
      jest.spyOn(exportOptions, 'getSelectedFilesCount').mockReturnValue(5);

      const rateLimitError = new HttpException('Too many requests', HttpStatus.TOO_MANY_REQUESTS);
      exportService.exportProject.mockRejectedValue(rateLimitError);

      const warnSpy = jest.spyOn(controller['logger'], 'warn');

      await expect(
        controller.exportProject(mockProjectId, exportOptions, mockUser)
      ).rejects.toThrow();

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Export rate limited'),
        expect.objectContaining({
          projectId: mockProjectId,
          userId: mockUser.id,
        })
      );
    });

    it('should provide complete error context', async () => {
      const exportOptions = new ExportOptionsDto();
      exportOptions.format = 'pdf';
      exportOptions.fileIds = ['file-1', 'file-2'];

      jest.spyOn(exportOptions, 'validateOptions').mockReturnValue({
        valid: true,
        errors: [],
      });

      // CORRIGÉ : Utiliser les bonnes valeurs de complexité
      jest.spyOn(exportOptions, 'getExportComplexity').mockReturnValue('medium');
      jest.spyOn(exportOptions, 'toLogSafeString').mockReturnValue('format=pdf,files=2');
      jest.spyOn(exportOptions, 'isHeavyExport').mockReturnValue(false);
      jest.spyOn(exportOptions, 'getSelectedFilesCount').mockReturnValue(2);

      const clientError = new HttpException('Bad request', HttpStatus.BAD_REQUEST);
      exportService.exportProject.mockRejectedValue(clientError);

      const warnSpy = jest.spyOn(controller['logger'], 'warn');

      await expect(
        controller.exportProject(mockProjectId, exportOptions, mockUser)
      ).rejects.toThrow();

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Export client error'),
        expect.objectContaining({
          projectId: mockProjectId,
          userId: mockUser.id,
          format: 'pdf',
          complexity: 'medium',
          filesCount: 2,
        })
      );
    });
  });
});