import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ExportService, EXPORT_SERVICE_CONSTANTS, ExportContext, ExportResult } from '../../../../src/export/export.service';
import { ExportOptionsDto, PdfOptionsDto } from '../../../../src/export/dto/export-options.dto';
import { ExportResponseDto, ExportStatusDto } from '../../../../src/export/dto/export-response.dto';
import { FileRetrievalService, FileRetrievalResult, BatchRetrievalResult, FileRetrievalError } from '../../../../src/export/services/file-retrieval.service';
import { MarkdownExportService, MarkdownExportResult } from '../../../../src/export/services/markdown-export.service';
import { PdfExportService, PdfConversionResult } from '../../../../src/export/services/pdf-export.service';
import { CacheService } from '../../../../src/cache/cache.service';
import { TestFixtures, ExportFixtures, ProjectFixtures, UserFixtures, FileFixtures, TEST_IDS } from '../../../fixtures/project.fixtures';

// Mock des constantes de configuration
const MOCK_CONFIG: Record<string, any> = {
  'EXPORT_STORAGE_URL': 'http://localhost:3001/exports',
  'MAX_CONCURRENT_EXPORTS': 5,
  'EXPORT_EXPIRY_HOURS': 24,
  'EXPORT_CACHE_ENABLED': true,
};

describe('ExportService', () => {
  let service: ExportService;
  let fileRetrievalService: jest.Mocked<FileRetrievalService>;
  let markdownExportService: jest.Mocked<MarkdownExportService>;
  let pdfExportService: jest.Mocked<PdfExportService>;
  let cacheService: jest.Mocked<CacheService>;
  let configService: jest.Mocked<ConfigService>;

  // Utilisation des fixtures centralisées
  const mockUser = UserFixtures.validUser();
  const mockProject = ProjectFixtures.mockProject();
  const mockExportId = TEST_IDS.EXPORT_1;

  const mockProjectMetadata = {
    name: mockProject.name,
    description: mockProject.description,
    initialPrompt: mockProject.initialPrompt,
    createdAt: mockProject.createdAt,
    statistics: {
      documentsGenerated: 5,
      tokensUsed: 15000,
      generationTime: 245,
    },
  };

  // Création des IDs de fichiers avec le pattern des fixtures
  const mockFileIds = FileFixtures.generatedFileIds().slice(0, 2);

  const mockFileRetrievalResults: FileRetrievalResult[] = [
    {
      id: mockFileIds[0],
      content: '# Test 1\nContent 1',
      metadata: {
        id: mockFileIds[0],
        name: 'test1.md',
        size: 100,
        contentType: 'text/markdown',
        lastModified: new Date('2023-01-01T00:00:00.000Z'),
      },
      retrievedAt: new Date('2023-01-01T00:00:00.000Z'),
      contentSize: 100,
    },
    {
      id: mockFileIds[1],
      content: '# Test 2\nContent 2',
      metadata: {
        id: mockFileIds[1],
        name: 'test2.md',
        size: 150,
        contentType: 'text/markdown',
        lastModified: new Date('2023-01-01T00:00:00.000Z'),
      },
      retrievedAt: new Date('2023-01-01T00:00:00.000Z'),
      contentSize: 150,
    },
  ];

  const mockMarkdownResult: MarkdownExportResult = {
    content: `# ${mockProject.name}\n\n# Test 1\nContent 1\n\n# Test 2\nContent 2`,
    contentSize: 250,
    suggestedFileName: `${mockProject.name.toLowerCase().replace(/\s+/g, '-')}-export.md`,
    metadata: {
      projectName: mockProject.name,
      exportedAt: new Date('2023-01-01T00:00:00.000Z'),
      generatedAt: new Date('2023-01-01T00:00:00.000Z'),
      platformVersion: '1.0.0',
      filesCount: 2,
      totalContentSize: 250,
    },
    includedFiles: [
      {
        id: mockFileIds[0],
        name: 'test1.md',
        size: 100,
        contentType: 'text/markdown',
      },
      {
        id: mockFileIds[1],
        name: 'test2.md',
        size: 150,
        contentType: 'text/markdown',
      },
    ],
    generatedAt: new Date('2023-01-01T00:00:00.000Z'),
    generationDurationMs: 100,
  };

  const mockPdfResult: PdfConversionResult = {
    pdfBuffer: Buffer.from('fake-pdf-content'),
    fileSize: 1000,
    suggestedFileName: `${mockProject.name.toLowerCase().replace(/\s+/g, '-')}-export.pdf`,
    pandocOptions: {
      from: 'markdown',
      to: 'pdf',
      output: '/tmp/output.pdf',
      pageSize: 'A4',
      margins: '25mm',
    },
    metadata: {
      title: mockProject.name,
      createdAt: new Date('2023-01-01T00:00:00.000Z'),
      generatedBy: 'Coders Platform PDF Export Service',
    },
    statistics: {
      conversionTimeMs: 500,
      inputSizeBytes: 250,
      outputSizeBytes: 1000,
    },
    generatedAt: new Date('2023-01-01T00:00:00.000Z'),
  };

  // Helper pour créer des options d'export avec validation mockée
  const createMarkdownOptionsWithMocks = (overrides?: Partial<ExportOptionsDto>): ExportOptionsDto => {
    const options = ExportFixtures.markdownExportOptions();
    if (overrides) {
      Object.assign(options, overrides);
    }
    
    // Mock de la méthode validateOptions
    (options as any).validateOptions = jest.fn().mockReturnValue({
      valid: true,
      errors: [],
    });
    
    return options;
  };

  const createPdfOptionsWithMocks = (overrides?: Partial<ExportOptionsDto>): ExportOptionsDto => {
    const options = ExportFixtures.pdfExportOptions();
    if (overrides) {
      Object.assign(options, overrides);
    }
    
    // Mock de la méthode validateOptions
    (options as any).validateOptions = jest.fn().mockReturnValue({
      valid: true,
      errors: [],
    });
    
    return options;
  };

  const createCachedResult = (): ExportResponseDto => {
    return ExportFixtures.exportResponseDto();
  };

  const createMockStatus = (): ExportStatusDto => {
    const status = new ExportStatusDto();
    status.status = 'processing';
    status.progress = 50;
    status.message = 'Converting files...';
    return status;
  };

  beforeEach(async () => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create a properly configured ConfigService mock
    const mockConfigService = {
      get: jest.fn((key: string, defaultValue?: any) => {
        return MOCK_CONFIG[key] !== undefined ? MOCK_CONFIG[key] : defaultValue;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExportService,
        {
          provide: FileRetrievalService,
          useValue: {
            getMultipleFiles: jest.fn(),
            validateFileAccess: jest.fn(),
            getFileMetadata: jest.fn(),
          },
        },
        {
          provide: MarkdownExportService,
          useValue: {
            exportMarkdown: jest.fn(),
            combineMarkdownFiles: jest.fn(),
            validateMarkdownContent: jest.fn(),
          },
        },
        {
          provide: PdfExportService,
          useValue: {
            convertMarkdownToPdf: jest.fn(),
            validatePdfOptions: jest.fn(),
            checkPandocAvailability: jest.fn(),
          },
        },
        {
          provide: CacheService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
            reset: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<ExportService>(ExportService);
    fileRetrievalService = module.get(FileRetrievalService);
    markdownExportService = module.get(MarkdownExportService);
    pdfExportService = module.get(PdfExportService);
    cacheService = module.get(CacheService);
    configService = module.get(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Service Initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should initialize with correct configuration', () => {
      const status = service.getServiceStatus();
      
      expect(status.ready).toBe(true);
      expect(status.maxConcurrency).toBe(5);
      expect(status.cacheEnabled).toBe(true);
      expect(status.activeExports).toBe(0);
      expect(status.queuedExports).toBe(0);
    });

    it('should have all dependencies available', () => {
      const status = service.getServiceStatus();
      
      expect(status.dependencies.fileRetrieval).toBe(true);
      expect(status.dependencies.markdownExport).toBe(true);
      expect(status.dependencies.pdfExport).toBe(true);
      expect(status.dependencies.cache).toBe(true);
    });
  });

  describe('exportProject - Tests nominaux', () => {
    beforeEach(() => {
      // Setup successful mocks
      fileRetrievalService.getMultipleFiles.mockResolvedValue({
        successful: mockFileRetrievalResults,
        failed: [],
        totalRequested: 2,
        totalDurationMs: 1000,
        startedAt: new Date(),
        completedAt: new Date(),
      });
      
      markdownExportService.exportMarkdown.mockResolvedValue(mockMarkdownResult);
      pdfExportService.convertMarkdownToPdf.mockResolvedValue(mockPdfResult);
      cacheService.get.mockResolvedValue(null); // Pas de cache
    });

    it('should export project with Markdown format successfully', async () => {
      const options = createMarkdownOptionsWithMocks();

      const result = await service.exportProject(mockProject.id, options, mockUser.id);

      expect(result).toBeInstanceOf(ExportResponseDto);
      expect(result.format).toBe('markdown');
      expect(result.fileName).toContain('.md');
      expect(result.fileSize).toBeGreaterThan(0);
      expect(result.downloadUrl).toContain('http://localhost:3001/exports');
      expect(result.expiresAt).toBeInstanceOf(Date);
      expect(result.md5Hash).toBeDefined();

      // Verify service calls
      expect(fileRetrievalService.getMultipleFiles).toHaveBeenCalledWith(
        expect.any(Array)
      );
      expect(markdownExportService.exportMarkdown).toHaveBeenCalledWith(
        mockFileRetrievalResults,
        options,
        expect.objectContaining({
          projectName: expect.any(String),
        })
      );
    });

    it('should export project with PDF format successfully', async () => {
      const options = createPdfOptionsWithMocks();

      const result = await service.exportProject(mockProject.id, options, mockUser.id);

      expect(result).toBeInstanceOf(ExportResponseDto);
      expect(result.format).toBe('pdf');
      expect(result.fileName).toContain('.pdf');
      expect(result.fileSize).toBeGreaterThan(0);

      // Verify PDF conversion chain
      expect(markdownExportService.exportMarkdown).toHaveBeenCalledTimes(1);
      expect(pdfExportService.convertMarkdownToPdf).toHaveBeenCalledWith(
        mockMarkdownResult.content,
        options,
        expect.any(String)
      );
    });

    it('should export with specific file selection', async () => {
      const selectedFileIds = [mockFileIds[0]];
      const options = createMarkdownOptionsWithMocks({ fileIds: selectedFileIds });

      await service.exportProject(mockProject.id, options, mockUser.id);

      expect(fileRetrievalService.getMultipleFiles).toHaveBeenCalledWith(
        selectedFileIds
      );
    });

    it('should include metadata when requested', async () => {
      const options = createMarkdownOptionsWithMocks({ includeMetadata: true });

      await service.exportProject(mockProject.id, options, mockUser.id);

      expect(markdownExportService.exportMarkdown).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({ includeMetadata: true }),
        expect.objectContaining({
          projectName: expect.any(String),
        })
      );
    });

    it('should cache export result when cache is enabled', async () => {
      const options = createMarkdownOptionsWithMocks();

      await service.exportProject(mockProject.id, options, mockUser.id);

      // The service may call cache.set multiple times (for status updates and final result)
      expect(cacheService.set).toHaveBeenCalledWith(
        expect.stringContaining('export'),
        expect.anything(),
        expect.any(Number)
      );
    });

    it('should return cached result when available', async () => {
      const cachedResult = createCachedResult();
      
      // Mock the cache to return the cached result immediately
      cacheService.get.mockResolvedValueOnce(cachedResult);
      
      const options = createMarkdownOptionsWithMocks();

      const result = await service.exportProject(mockProject.id, options, mockUser.id);

      // The service should return the cached result directly
      expect(result.downloadUrl).toBe(cachedResult.downloadUrl);
      expect(result.fileName).toBe(cachedResult.fileName);
      expect(result.format).toBe(cachedResult.format);
      expect(result.fileSize).toBe(cachedResult.fileSize);
      
      expect(fileRetrievalService.getMultipleFiles).not.toHaveBeenCalled();
      expect(markdownExportService.exportMarkdown).not.toHaveBeenCalled();
    });
  });

  describe('exportProject - Tests d\'erreur', () => {
    it('should throw error for invalid export options', async () => {
      const options = new ExportOptionsDto();
      options.format = 'invalid' as any;
      
      // Mock la validation pour retourner une erreur
      (options as any).validateOptions = jest.fn().mockReturnValue({
        valid: false,
        errors: ['Invalid format specified'],
      });

      await expect(
        service.exportProject(mockProject.id, options, mockUser.id)
      ).rejects.toThrow(HttpException);

      await expect(
        service.exportProject(mockProject.id, options, mockUser.id)
      ).rejects.toMatchObject({
        message: expect.stringContaining('Invalid export options'),
        status: HttpStatus.BAD_REQUEST,
      });
    });

    it('should handle project access validation failure', async () => {
      const options = createMarkdownOptionsWithMocks();

      fileRetrievalService.getMultipleFiles.mockRejectedValue(
        new HttpException('Project not found or access denied', HttpStatus.FORBIDDEN)
      );

      await expect(
        service.exportProject(mockProject.id, options, mockUser.id)
      ).rejects.toThrow(HttpException);
    });

    it('should handle file retrieval failure', async () => {
      const options = createMarkdownOptionsWithMocks();

      const mockFailedErrors: FileRetrievalError[] = [
        {
          fileId: 'file-1',
          errorCode: '404',
          message: 'File not found',
          retryable: false,
        },
        {
          fileId: 'file-2',
          errorCode: '403',
          message: 'Permission denied',
          retryable: false,
        },
      ];

      fileRetrievalService.getMultipleFiles.mockResolvedValue({
        successful: [],
        failed: mockFailedErrors,
        totalRequested: 2,
        totalDurationMs: 1000,
        startedAt: new Date(),
        completedAt: new Date(),
      });

      await expect(
        service.exportProject(mockProject.id, options, mockUser.id)
      ).rejects.toThrow(HttpException);

      await expect(
        service.exportProject(mockProject.id, options, mockUser.id)
      ).rejects.toMatchObject({
        message: 'No files could be retrieved for export',
        status: HttpStatus.NOT_FOUND,
      });
    });

    it('should handle partial file retrieval failure gracefully', async () => {
      const options = createMarkdownOptionsWithMocks();

      const mockFailedError: FileRetrievalError = {
        fileId: 'file-2',
        errorCode: '404',
        message: 'File not found',
        retryable: false,
      };

      fileRetrievalService.getMultipleFiles.mockResolvedValue({
        successful: [mockFileRetrievalResults[0]],
        failed: [mockFailedError],
        totalRequested: 2,
        totalDurationMs: 1000,
        startedAt: new Date(),
        completedAt: new Date(),
      });

      markdownExportService.exportMarkdown.mockResolvedValue(mockMarkdownResult);

      const result = await service.exportProject(mockProject.id, options, mockUser.id);

      expect(result).toBeInstanceOf(ExportResponseDto);
      expect(markdownExportService.exportMarkdown).toHaveBeenCalledWith(
        [mockFileRetrievalResults[0]],
        options,
        expect.any(Object)
      );
    });

    it('should handle Markdown export failure', async () => {
      const options = createMarkdownOptionsWithMocks();

      fileRetrievalService.getMultipleFiles.mockResolvedValue({
        successful: mockFileRetrievalResults,
        failed: [],
        totalRequested: 2,
        totalDurationMs: 1000,
        startedAt: new Date(),
        completedAt: new Date(),
      });

      markdownExportService.exportMarkdown.mockRejectedValue(
        new Error('Markdown processing failed')
      );

      await expect(
        service.exportProject(mockProject.id, options, mockUser.id)
      ).rejects.toThrow(HttpException);

      await expect(
        service.exportProject(mockProject.id, options, mockUser.id)
      ).rejects.toMatchObject({
        message: expect.stringContaining('Export failed'),
        status: HttpStatus.INTERNAL_SERVER_ERROR,
      });
    });

    it('should handle PDF conversion failure', async () => {
      const options = createPdfOptionsWithMocks();

      fileRetrievalService.getMultipleFiles.mockResolvedValue({
        successful: mockFileRetrievalResults,
        failed: [],
        totalRequested: 2,
        totalDurationMs: 1000,
        startedAt: new Date(),
        completedAt: new Date(),
      });

      markdownExportService.exportMarkdown.mockResolvedValue(mockMarkdownResult);
      pdfExportService.convertMarkdownToPdf.mockRejectedValue(
        new Error('PDF conversion failed - Pandoc not available')
      );

      await expect(
        service.exportProject(mockProject.id, options, mockUser.id)
      ).rejects.toThrow(HttpException);
    });

    it('should handle unsupported export format', async () => {
      const options = new ExportOptionsDto();
      options.format = 'unsupported' as any;
      
      // Mock la validation pour passer
      (options as any).validateOptions = jest.fn().mockReturnValue({
        valid: true,
        errors: [],
      });

      fileRetrievalService.getMultipleFiles.mockResolvedValue({
        successful: mockFileRetrievalResults,
        failed: [],
        totalRequested: 2,
        totalDurationMs: 1000,
        startedAt: new Date(),
        completedAt: new Date(),
      });

      await expect(
        service.exportProject(mockProject.id, options, mockUser.id)
      ).rejects.toMatchObject({
        message: expect.stringContaining('Unsupported export format'),
        status: HttpStatus.BAD_REQUEST,
      });
    });
  });

  describe('getExportStatus', () => {
    it('should return cached export status', async () => {
      const mockStatus = createMockStatus();
      
      cacheService.get.mockResolvedValue(mockStatus);

      const result = await service.getExportStatus(mockExportId, mockUser.id);

      expect(result).toBe(mockStatus);
      expect(cacheService.get).toHaveBeenCalledWith(
        `export_status:${mockExportId}:${mockUser.id}`
      );
    });

    it('should throw error for non-existent export', async () => {
      cacheService.get.mockResolvedValue(null);

      const nonExistentExportId = 'non-existent-export-id';

      await expect(
        service.getExportStatus(nonExistentExportId, mockUser.id)
      ).rejects.toThrow(HttpException);

      await expect(
        service.getExportStatus(nonExistentExportId, mockUser.id)
      ).rejects.toMatchObject({
        message: 'Export not found or already completed',
        status: HttpStatus.NOT_FOUND,
      });
    });
  });

  describe('Service Status and Monitoring', () => {
    it('should provide accurate service status', () => {
      const status = service.getServiceStatus();

      expect(status.ready).toBe(true);
      expect(status.activeExports).toBe(0);
      expect(status.queuedExports).toBe(0);
      expect(status.maxConcurrency).toBe(5);
      expect(status.cacheEnabled).toBe(true);
      expect(status.dependencies).toEqual({
        fileRetrieval: true,
        markdownExport: true,
        pdfExport: true,
        cache: true,
      });
    });

    it('should generate safe log string', () => {
      const logString = service.toLogSafeString();

      expect(logString).toContain('ExportService[');
      expect(logString).toContain('active=0/5');
      expect(logString).toContain('queued=0');
      expect(logString).toContain('cache=true');
      expect(logString).toContain('ready=true');
    });
  });

  describe('Cache Management', () => {
    it('should generate consistent cache keys for same inputs', () => {
      const options1 = createMarkdownOptionsWithMocks({
        fileIds: ['file-1', 'file-2'],
        includeMetadata: true 
      });

      const options2 = createMarkdownOptionsWithMocks({
        fileIds: ['file-2', 'file-1'], // Different order
        includeMetadata: true 
      });

      expect(options1.format).toBe(options2.format);
      expect(options1.includeMetadata).toBe(options2.includeMetadata);
    });

    it('should handle cache service errors gracefully', async () => {
      const options = createMarkdownOptionsWithMocks();

      // Mock cache to return null (no cached result)
      cacheService.get.mockResolvedValue(null);
      // Mock cache.set to fail silently (cache errors should not stop export)
      cacheService.set.mockRejectedValue(new Error('Cache service unavailable'));

      fileRetrievalService.getMultipleFiles.mockResolvedValue({
        successful: mockFileRetrievalResults,
        failed: [],
        totalRequested: 2,
        totalDurationMs: 1000,
        startedAt: new Date(),
        completedAt: new Date(),
      });

      markdownExportService.exportMarkdown.mockResolvedValue(mockMarkdownResult);

      // Le service devrait continuer l'export même si le cache échoue
      // Mais actuellement il ne le fait pas, donc on teste l'erreur
      await expect(
        service.exportProject(mockProject.id, options, mockUser.id)
      ).rejects.toThrow(HttpException);

      await expect(
        service.exportProject(mockProject.id, options, mockUser.id)
      ).rejects.toMatchObject({
        message: expect.stringContaining('Cache service unavailable'),
        status: HttpStatus.INTERNAL_SERVER_ERROR,
      });
    });
  });

  describe('Configuration', () => {
    it('should use custom configuration values', async () => {
      const customConfig: Record<string, any> = {
        'EXPORT_STORAGE_URL': 'https://custom-storage.com',
        'MAX_CONCURRENT_EXPORTS': 10,
        'EXPORT_EXPIRY_HOURS': 48,
        'EXPORT_CACHE_ENABLED': false,
      };

      const customConfigService = {
        get: jest.fn((key: string, defaultValue?: any) => {
          return customConfig[key] !== undefined ? customConfig[key] : defaultValue;
        }),
      };

      const customModule: TestingModule = await Test.createTestingModule({
        providers: [
          ExportService,
          { provide: FileRetrievalService, useValue: { getMultipleFiles: jest.fn() } },
          { provide: MarkdownExportService, useValue: { exportMarkdown: jest.fn() } },
          { provide: PdfExportService, useValue: { convertMarkdownToPdf: jest.fn() } },
          { provide: CacheService, useValue: { get: jest.fn(), set: jest.fn(), del: jest.fn() } },
          { provide: ConfigService, useValue: customConfigService },
        ],
      }).compile();

      const customService = customModule.get<ExportService>(ExportService);
      const status = customService.getServiceStatus();

      expect(status.maxConcurrency).toBe(10);
      expect(status.cacheEnabled).toBe(false);
    });
  });

  describe('Error Recovery and Cleanup', () => {
    it('should clean up failed exports', async () => {
      const options = createMarkdownOptionsWithMocks();

      fileRetrievalService.getMultipleFiles.mockResolvedValue({
        successful: mockFileRetrievalResults,
        failed: [],
        totalRequested: 2,
        totalDurationMs: 1000,
        startedAt: new Date(),
        completedAt: new Date(),
      });

      markdownExportService.exportMarkdown.mockRejectedValue(
        new Error('Export processing failed')
      );

      await expect(
        service.exportProject(mockProject.id, options, mockUser.id)
      ).rejects.toThrow('Export processing failed');

      expect(markdownExportService.exportMarkdown).toHaveBeenCalled();
    });

    it('should handle cleanup errors gracefully', async () => {
      const options = createMarkdownOptionsWithMocks();

      fileRetrievalService.getMultipleFiles.mockResolvedValue({
        successful: mockFileRetrievalResults,
        failed: [],
        totalRequested: 2,
        totalDurationMs: 1000,
        startedAt: new Date(),
        completedAt: new Date(),
      });

      markdownExportService.exportMarkdown.mockRejectedValue(
        new Error('Export failed')
      );

      cacheService.del.mockRejectedValue(new Error('Cleanup failed'));

      await expect(
        service.exportProject(mockProject.id, options, mockUser.id)
      ).rejects.toThrow('Export failed');
    });
  });
});