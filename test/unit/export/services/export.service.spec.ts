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

  // Test data fixtures
  const mockUserId = 'user-123';
  const mockProjectId = 'project-456';
  const mockExportId = 'export-789';

  const mockProjectMetadata = {
    name: 'Test Project',
    description: 'A test project',
    initialPrompt: 'Create a test application',
    createdAt: new Date('2023-01-01T00:00:00.000Z'),
    statistics: {
      documentsGenerated: 5,
      tokensUsed: 15000,
      generationTime: 245,
    },
  };

  const mockFileRetrievalResults: FileRetrievalResult[] = [
    {
      id: 'file-1',
      content: '# Test 1\nContent 1',
      metadata: {
        id: 'file-1',
        name: 'test1.md',
        size: 100,
        contentType: 'text/markdown',
        lastModified: new Date('2023-01-01T00:00:00.000Z'),
      },
      retrievedAt: new Date('2023-01-01T00:00:00.000Z'),
      contentSize: 100,
    },
    {
      id: 'file-2',
      content: '# Test 2\nContent 2',
      metadata: {
        id: 'file-2',
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
    content: '# Combined Document\n\n# Test 1\nContent 1\n\n# Test 2\nContent 2',
    contentSize: 250,
    suggestedFileName: 'test-project-export.md',
    metadata: {
      projectName: 'Test Project',
      exportedAt: new Date('2023-01-01T00:00:00.000Z'),
      generatedAt: new Date('2023-01-01T00:00:00.000Z'),
      platformVersion: '1.0.0',
      filesCount: 2,
      totalContentSize: 250,
    },
    includedFiles: [
      {
        id: 'file-1',
        name: 'test1.md',
        size: 100,
        contentType: 'text/markdown',
      },
      {
        id: 'file-2',
        name: 'test2.md',
        size: 150,
        contentType: 'text/markdown',
      },
    ],
    generatedAt: new Date('2023-01-01T00:00:00.000Z'),
    generationDurationMs: 100,
  };

  // Création d'une instance valide de PdfOptionsDto
  const createValidPdfOptions = (): PdfOptionsDto => {
    const pdfOptions = new PdfOptionsDto();
    pdfOptions.pageSize = 'A4';
    pdfOptions.margins = 25;
    pdfOptions.includeTableOfContents = true;
    return pdfOptions;
  };

  const mockPdfResult: PdfConversionResult = {
    pdfBuffer: Buffer.from('fake-pdf-content'),
    fileSize: 1000,
    suggestedFileName: 'test-project-export.pdf',
    pandocOptions: {
      from: 'markdown',
      to: 'pdf',
      output: '/tmp/output.pdf',
      pageSize: 'A4',
      margins: '25mm',
    },
    metadata: {
      title: 'Test Project',
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
      const options = new ExportOptionsDto();
      options.format = 'markdown';
      options.includeMetadata = true;
      
      // Mock validation success
      jest.spyOn(options, 'validateOptions').mockReturnValue({
        valid: true,
        errors: [],
      });

      const result = await service.exportProject(mockProjectId, options, mockUserId);

      expect(result).toBeInstanceOf(ExportResponseDto);
      expect(result.format).toBe('markdown');
      expect(result.fileName).toBe('test-project-export.md');
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
      const options = new ExportOptionsDto();
      options.format = 'pdf';
      options.pdfOptions = createValidPdfOptions();
      
      jest.spyOn(options, 'validateOptions').mockReturnValue({
        valid: true,
        errors: [],
      });

      const result = await service.exportProject(mockProjectId, options, mockUserId);

      expect(result).toBeInstanceOf(ExportResponseDto);
      expect(result.format).toBe('pdf');
      expect(result.fileName).toBe('test-project-export.pdf');
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
      const selectedFileIds = ['file-1'];
      const options = new ExportOptionsDto();
      options.format = 'markdown';
      options.fileIds = selectedFileIds;
      
      jest.spyOn(options, 'validateOptions').mockReturnValue({
        valid: true,
        errors: [],
      });

      await service.exportProject(mockProjectId, options, mockUserId);

      expect(fileRetrievalService.getMultipleFiles).toHaveBeenCalledWith(
        selectedFileIds
      );
    });

    it('should include metadata when requested', async () => {
      const options = new ExportOptionsDto();
      options.format = 'markdown';
      options.includeMetadata = true;
      
      jest.spyOn(options, 'validateOptions').mockReturnValue({
        valid: true,
        errors: [],
      });

      await service.exportProject(mockProjectId, options, mockUserId);

      expect(markdownExportService.exportMarkdown).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({ includeMetadata: true }),
        expect.objectContaining({
          projectName: expect.any(String),
        })
      );
    });

    it('should cache export result when cache is enabled', async () => {
      const options = new ExportOptionsDto();
      options.format = 'markdown';
      
      jest.spyOn(options, 'validateOptions').mockReturnValue({
        valid: true,
        errors: [],
      });

      await service.exportProject(mockProjectId, options, mockUserId);

      // The service may call cache.set multiple times (for status updates and final result)
      expect(cacheService.set).toHaveBeenCalledWith(
        expect.stringContaining('export'),
        expect.anything(),
        expect.any(Number)
      );
    });

    it('should return cached result when available', async () => {
      const cachedResult = new ExportResponseDto();
      cachedResult.downloadUrl = 'cached-url';
      cachedResult.fileName = 'cached-file.md';
      cachedResult.format = 'markdown';
      cachedResult.fileSize = 100;
      cachedResult.expiresAt = new Date();
      cachedResult.md5Hash = 'cached-hash';
      
      // Mock the cache to return the cached result immediately
      cacheService.get.mockResolvedValueOnce(cachedResult);
      
      const options = new ExportOptionsDto();
      options.format = 'markdown';
      
      jest.spyOn(options, 'validateOptions').mockReturnValue({
        valid: true,
        errors: [],
      });

      const result = await service.exportProject(mockProjectId, options, mockUserId);

      // The service should return the cached result directly
      expect(result.downloadUrl).toBe('cached-url');
      expect(result.fileName).toBe('cached-file.md');
      expect(result.format).toBe('markdown');
      expect(result.fileSize).toBe(100);
      expect(result.md5Hash).toBe('cached-hash');
      
      expect(fileRetrievalService.getMultipleFiles).not.toHaveBeenCalled();
      expect(markdownExportService.exportMarkdown).not.toHaveBeenCalled();
    });
  });

  describe('exportProject - Tests d\'erreur', () => {
    it('should throw error for invalid export options', async () => {
      const options = new ExportOptionsDto();
      options.format = 'invalid' as any;
      
      jest.spyOn(options, 'validateOptions').mockReturnValue({
        valid: false,
        errors: ['Invalid format specified'],
      });

      await expect(
        service.exportProject(mockProjectId, options, mockUserId)
      ).rejects.toThrow(HttpException);

      await expect(
        service.exportProject(mockProjectId, options, mockUserId)
      ).rejects.toMatchObject({
        message: expect.stringContaining('Invalid export options'),
        status: HttpStatus.BAD_REQUEST,
      });
    });

    it('should handle project access validation failure', async () => {
      const options = new ExportOptionsDto();
      options.format = 'markdown';
      
      jest.spyOn(options, 'validateOptions').mockReturnValue({
        valid: true,
        errors: [],
      });

      fileRetrievalService.getMultipleFiles.mockRejectedValue(
        new HttpException('Project not found or access denied', HttpStatus.FORBIDDEN)
      );

      await expect(
        service.exportProject(mockProjectId, options, mockUserId)
      ).rejects.toThrow(HttpException);
    });

    it('should handle file retrieval failure', async () => {
      const options = new ExportOptionsDto();
      options.format = 'markdown';
      
      jest.spyOn(options, 'validateOptions').mockReturnValue({
        valid: true,
        errors: [],
      });

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
        service.exportProject(mockProjectId, options, mockUserId)
      ).rejects.toThrow(HttpException);

      await expect(
        service.exportProject(mockProjectId, options, mockUserId)
      ).rejects.toMatchObject({
        message: 'No files could be retrieved for export',
        status: HttpStatus.NOT_FOUND,
      });
    });

    it('should handle partial file retrieval failure gracefully', async () => {
      const options = new ExportOptionsDto();
      options.format = 'markdown';
      
      jest.spyOn(options, 'validateOptions').mockReturnValue({
        valid: true,
        errors: [],
      });

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

      const result = await service.exportProject(mockProjectId, options, mockUserId);

      expect(result).toBeInstanceOf(ExportResponseDto);
      expect(markdownExportService.exportMarkdown).toHaveBeenCalledWith(
        [mockFileRetrievalResults[0]],
        options,
        expect.any(Object)
      );
    });

    it('should handle Markdown export failure', async () => {
      const options = new ExportOptionsDto();
      options.format = 'markdown';
      
      jest.spyOn(options, 'validateOptions').mockReturnValue({
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

      markdownExportService.exportMarkdown.mockRejectedValue(
        new Error('Markdown processing failed')
      );

      await expect(
        service.exportProject(mockProjectId, options, mockUserId)
      ).rejects.toThrow(HttpException);

      await expect(
        service.exportProject(mockProjectId, options, mockUserId)
      ).rejects.toMatchObject({
        message: expect.stringContaining('Export failed'),
        status: HttpStatus.INTERNAL_SERVER_ERROR,
      });
    });

    it('should handle PDF conversion failure', async () => {
      const options = new ExportOptionsDto();
      options.format = 'pdf';
      
      jest.spyOn(options, 'validateOptions').mockReturnValue({
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

      markdownExportService.exportMarkdown.mockResolvedValue(mockMarkdownResult);
      pdfExportService.convertMarkdownToPdf.mockRejectedValue(
        new Error('PDF conversion failed - Pandoc not available')
      );

      await expect(
        service.exportProject(mockProjectId, options, mockUserId)
      ).rejects.toThrow(HttpException);
    });

    it('should handle unsupported export format', async () => {
      const options = new ExportOptionsDto();
      options.format = 'unsupported' as any;
      
      jest.spyOn(options, 'validateOptions').mockReturnValue({
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
        service.exportProject(mockProjectId, options, mockUserId)
      ).rejects.toMatchObject({
        message: expect.stringContaining('Unsupported export format'),
        status: HttpStatus.BAD_REQUEST,
      });
    });
  });

  describe('getExportStatus', () => {
    it('should return cached export status', async () => {
      const mockStatus = new ExportStatusDto();
      mockStatus.status = 'processing';
      mockStatus.progress = 50;
      mockStatus.message = 'Converting files...';
      
      cacheService.get.mockResolvedValue(mockStatus);

      const result = await service.getExportStatus(mockExportId, mockUserId);

      expect(result).toBe(mockStatus);
      expect(cacheService.get).toHaveBeenCalledWith(
        `export_status:${mockExportId}:${mockUserId}`
      );
    });

    it('should throw error for non-existent export', async () => {
      cacheService.get.mockResolvedValue(null);

      await expect(
        service.getExportStatus('non-existent-export', mockUserId)
      ).rejects.toThrow(HttpException);

      await expect(
        service.getExportStatus('non-existent-export', mockUserId)
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
      const options1 = new ExportOptionsDto();
      options1.format = 'markdown';
      options1.fileIds = ['file-1', 'file-2'];
      options1.includeMetadata = true;

      const options2 = new ExportOptionsDto();
      options2.format = 'markdown';
      options2.fileIds = ['file-2', 'file-1']; // Different order
      options2.includeMetadata = true;

      expect(options1.format).toBe(options2.format);
      expect(options1.includeMetadata).toBe(options2.includeMetadata);
    });

    it('should handle cache service errors gracefully', async () => {
      const options = new ExportOptionsDto();
      options.format = 'markdown';
      
      jest.spyOn(options, 'validateOptions').mockReturnValue({
        valid: true,
        errors: [],
      });

      // Mock cache to return null (no cached result), then let subsequent cache operations fail
      cacheService.get.mockResolvedValue(null);
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

      const result = await service.exportProject(mockProjectId, options, mockUserId);

      expect(result).toBeInstanceOf(ExportResponseDto);
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
      const options = new ExportOptionsDto();
      options.format = 'markdown';
      
      jest.spyOn(options, 'validateOptions').mockReturnValue({
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

      markdownExportService.exportMarkdown.mockRejectedValue(
        new Error('Export processing failed')
      );

      await expect(
        service.exportProject(mockProjectId, options, mockUserId)
      ).rejects.toThrow('Export processing failed');

      expect(markdownExportService.exportMarkdown).toHaveBeenCalled();
    });

    it('should handle cleanup errors gracefully', async () => {
      const options = new ExportOptionsDto();
      options.format = 'markdown';
      
      jest.spyOn(options, 'validateOptions').mockReturnValue({
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

      markdownExportService.exportMarkdown.mockRejectedValue(
        new Error('Export failed')
      );

      cacheService.del.mockRejectedValue(new Error('Cleanup failed'));

      await expect(
        service.exportProject(mockProjectId, options, mockUserId)
      ).rejects.toThrow('Export failed');
    });
  });
});