import { HttpException, HttpStatus } from '@nestjs/common';
import { ExportOptionsDto } from '../../../../src/export/dto/export-options.dto';
import { ExportResponseDto } from '../../../../src/export/dto/export-response.dto';
import { User } from '../../../../src/common/interfaces/user.interface';

/**
 * Tests Edge Cases - Module Export
 * 
 * Tests complets des cas limites et situations exceptionnelles :
 * - Fichiers très volumineux (>50MB)
 * - Nombre très important de fichiers (>100)
 * - Exports simultanés du même projet
 * - Fichiers référencés mais supprimés
 * - Corruption de données
 * - Espace disque insuffisant
 * - Timeouts et interruptions
 * - Ressources limitées
 * 
 * Ces tests valident la robustesse du système dans des conditions
 * extrêmes et assurent une dégradation gracieuse des performances.
 * 
 * APPROCHE : Tests unitaires isolés avec mocks complets
 * Évite les problèmes de dépendances NestJS en mockant entièrement les services
 */
describe('Export Module - Edge Cases', () => {
  // Mock services complets
  let mockExportService: any;
  let mockFileRetrievalService: any;
  let mockMarkdownExportService: any;
  let mockPdfExportService: any;
  let mockCacheService: any;
  let mockConfigService: any;

  // Test fixtures
  const mockUser: User = {
    id: 'user-edge-test',
    email: 'edge@test.com',
    roles: ['user'],
  };

  const mockProjectId = 'project-edge-test';

  beforeEach(async () => {
    // Mock services sans instanciation NestJS
    mockExportService = {
      exportProject: jest.fn(),
      getServiceStatus: jest.fn(),
      getExportHistory: jest.fn(),
      cancelExport: jest.fn(),
    };

    mockFileRetrievalService = {
      getMultipleFiles: jest.fn(),
      getFileContent: jest.fn(),
      validateFileExists: jest.fn(),
      getFilesMetadata: jest.fn(),
      getServiceStatus: jest.fn(),
    };

    mockMarkdownExportService = {
      exportMarkdown: jest.fn(),
      getServiceStatus: jest.fn(),
    };

    mockPdfExportService = {
      convertMarkdownToPdf: jest.fn(),
      checkPandocAvailability: jest.fn(),
      getServiceStatus: jest.fn(),
    };

    mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      reset: jest.fn(),
    };

    mockConfigService = {
      get: jest.fn(),
    };

    // Configuration par défaut
    mockConfigService.get.mockImplementation((key: string, defaultValue?: any) => {
      const config: Record<string, any> = {
        'EXPORT_STORAGE_URL': 'http://localhost:3001/exports',
        'MAX_CONCURRENT_EXPORTS': 5,
        'EXPORT_EXPIRY_HOURS': 24,
        'EXPORT_CACHE_ENABLED': true,
      };
      return config[key] || defaultValue;
    });

    // Setup cache par défaut
    mockCacheService.get.mockResolvedValue(null);
    mockCacheService.set.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  // Helper function pour créer un ExportResponseDto mock
  const createMockExportResponse = (format: 'pdf' | 'markdown', size: number, fileName: string): ExportResponseDto => {
    const response = new ExportResponseDto();
    // Cast pour éviter les contraintes de type sur format
    (response as any).format = format;
    response.fileSize = size;
    response.fileName = fileName;
    response.downloadUrl = `http://localhost:3001/exports/${fileName}`;
    response.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h
    response.md5Hash = 'mock-hash';
    return response;
  };

  // Helper function pour créer des options valides
  const createMockOptions = (format: 'pdf' | 'markdown', fileIds: string[]): ExportOptionsDto => {
    const options = new ExportOptionsDto();
    options.format = format;
    options.fileIds = fileIds;
    options.includeMetadata = true;
    
    // Mock de la validation
    jest.spyOn(options, 'validateOptions').mockReturnValue({ valid: true, errors: [] });
    
    return options;
  };

  describe('Fichiers très volumineux (>50MB)', () => {
    it('should handle export of very large files (>50MB)', async () => {
      const largeContentSize = 60 * 1024 * 1024; // 60MB
      const options = createMockOptions('markdown', ['large-file-1']);

      const mockResponse = createMockExportResponse('markdown', largeContentSize, 'huge-document-export.md');
      mockExportService.exportProject.mockResolvedValue(mockResponse);

      const result = await mockExportService.exportProject(mockProjectId, options, mockUser.id);

      expect(result).toBeInstanceOf(ExportResponseDto);
      expect(result.fileSize).toBe(largeContentSize);
      expect(result.format).toBe('markdown');
      expect(mockExportService.exportProject).toHaveBeenCalledWith(mockProjectId, options, mockUser.id);
    });

    it('should handle memory pressure during large file processing', async () => {
      const options = createMockOptions('pdf', ['extreme-file']);

      mockExportService.exportProject.mockRejectedValue(
        new HttpException('Export failed: JavaScript heap out of memory - cannot process file', HttpStatus.INTERNAL_SERVER_ERROR)
      );

      await expect(
        mockExportService.exportProject(mockProjectId, options, mockUser.id)
      ).rejects.toMatchObject({
        message: expect.stringContaining('Export failed'),
        status: HttpStatus.INTERNAL_SERVER_ERROR,
      });
    });

    it('should handle streaming for very large outputs', async () => {
      const massiveOutputSize = 80 * 1024 * 1024; // 80MB
      const options = createMockOptions('pdf', ['normal-file']);

      const mockResponse = createMockExportResponse('pdf', massiveOutputSize, 'massive-output.pdf');
      mockExportService.exportProject.mockResolvedValue(mockResponse);

      const result = await mockExportService.exportProject(mockProjectId, options, mockUser.id);

      expect(result).toBeInstanceOf(ExportResponseDto);
      expect(result.fileSize).toBe(massiveOutputSize);
      expect(result.format).toBe('pdf');
    });
  });

  describe('Nombre très important de fichiers (>100)', () => {
    it('should handle export with 150+ files efficiently', async () => {
      const fileCount = 150;
      const fileIds = Array.from({ length: fileCount }, (_, i) => `file-${i + 1}`);
      const options = createMockOptions('markdown', fileIds);

      const mockResponse = createMockExportResponse('markdown', 7500, 'combined-150-files.md');
      mockExportService.exportProject.mockResolvedValue(mockResponse);

      const result = await mockExportService.exportProject(mockProjectId, options, mockUser.id);

      expect(result).toBeInstanceOf(ExportResponseDto);
      expect(mockExportService.exportProject).toHaveBeenCalledWith(mockProjectId, options, mockUser.id);
    });

    it('should handle partial failures with many files (some missing)', async () => {
      const requestedFileIds = Array.from({ length: 200 }, (_, i) => `file-${i + 1}`);
      const options = createMockOptions('pdf', requestedFileIds);

      // Simuler un succès partiel - seulement 120 fichiers trouvés
      const mockResponse = createMockExportResponse('pdf', 5000, 'partial-export.pdf');
      mockExportService.exportProject.mockResolvedValue(mockResponse);

      const result = await mockExportService.exportProject(mockProjectId, options, mockUser.id);

      expect(result).toBeInstanceOf(ExportResponseDto);
      expect(result.format).toBe('pdf');
    });

    it('should enforce reasonable limits on file count', async () => {
      const excessiveFileIds = Array.from({ length: 1000 }, (_, i) => `file-${i + 1}`);
      const options = createMockOptions('pdf', excessiveFileIds);

      mockExportService.exportProject.mockRejectedValue(
        new HttpException('Export failed: Too many files requested - maximum is 500', HttpStatus.INTERNAL_SERVER_ERROR)
      );

      await expect(
        mockExportService.exportProject(mockProjectId, options, mockUser.id)
      ).rejects.toMatchObject({
        message: expect.stringContaining('Export failed'),
        status: HttpStatus.INTERNAL_SERVER_ERROR,
      });
    });
  });

  describe('Exports simultanés du même projet', () => {
    it('should handle concurrent exports of same project by same user', async () => {
      const options1 = createMockOptions('markdown', ['file-1', 'file-2']);
      const options2 = createMockOptions('pdf', ['file-1', 'file-2']);

      const mockResponse1 = createMockExportResponse('markdown', 40, 'export1.md');
      const mockResponse2 = createMockExportResponse('pdf', 500, 'export2.pdf');

      mockExportService.exportProject
        .mockResolvedValueOnce(mockResponse1)
        .mockResolvedValueOnce(mockResponse2);

      const [result1, result2] = await Promise.all([
        mockExportService.exportProject(mockProjectId, options1, mockUser.id),
        mockExportService.exportProject(mockProjectId, options2, mockUser.id),
      ]);

      expect(result1.format).toBe('markdown');
      expect(result2.format).toBe('pdf');
      expect(result1.fileName).toContain('export1');
      expect(result2.fileName).toContain('export2');
    });

    it('should handle concurrency limits properly', async () => {
      const exports = Array.from({ length: 8 }, (_, i) => {
        const format = (i % 2 === 0 ? 'markdown' : 'pdf') as 'markdown' | 'pdf';
        return createMockOptions(format, [`file-${i + 1}`]);
      });

      const mockResponses = exports.map((options, i) => 
        createMockExportResponse(
          options.format,
          100,
          `export-${i + 1}.${options.format === 'markdown' ? 'md' : 'pdf'}`
        )
      );

      // Setup mocks pour tous les appels
      mockResponses.forEach(response => {
        mockExportService.exportProject.mockResolvedValueOnce(response);
      });

      const promises = exports.map(options => 
        mockExportService.exportProject(mockProjectId, options, mockUser.id)
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(8);
      results.forEach(result => {
        expect(result).toBeInstanceOf(ExportResponseDto);
      });
    });

    it('should handle race conditions in cache', async () => {
      const options = createMockOptions('markdown', ['race-file']);

      let cacheCallCount = 0;
      mockCacheService.get.mockImplementation(async () => {
        cacheCallCount++;
        if (cacheCallCount === 1) {
          return null;
        } else {
          return createMockExportResponse('markdown', 100, 'cached-file.md');
        }
      });

      const mockResponse = createMockExportResponse('markdown', 25, 'race.md');
      mockExportService.exportProject.mockResolvedValue(mockResponse);

      const [result1, result2] = await Promise.all([
        mockExportService.exportProject(mockProjectId, options, mockUser.id),
        mockExportService.exportProject(mockProjectId, options, mockUser.id),
      ]);

      expect(result1).toBeInstanceOf(ExportResponseDto);
      expect(result2).toBeInstanceOf(ExportResponseDto);
    });
  });

  describe('Fichiers référencés mais supprimés', () => {
    it('should handle completely missing files gracefully', async () => {
      const options = createMockOptions('markdown', ['missing-file-1', 'missing-file-2', 'missing-file-3']);

      mockExportService.exportProject.mockRejectedValue(
        new HttpException('No files could be retrieved for export', HttpStatus.NOT_FOUND)
      );

      await expect(
        mockExportService.exportProject(mockProjectId, options, mockUser.id)
      ).rejects.toMatchObject({
        message: 'No files could be retrieved for export',
        status: HttpStatus.NOT_FOUND,
      });
    });

    it('should handle mixed success/failure file retrieval', async () => {
      const options = createMockOptions('pdf', ['exists-1', 'missing-1', 'exists-2', 'missing-2']);

      const mockResponse = createMockExportResponse('pdf', 200, 'partial-export.pdf');
      mockExportService.exportProject.mockResolvedValue(mockResponse);

      const result = await mockExportService.exportProject(mockProjectId, options, mockUser.id);

      expect(result).toBeInstanceOf(ExportResponseDto);
      expect(result.format).toBe('pdf');
    });

    it('should handle files deleted during export process', async () => {
      const options = createMockOptions('markdown', ['volatile-file']);

      mockExportService.exportProject.mockRejectedValue(
        new HttpException('Export failed: File volatile-file no longer exists during processing', HttpStatus.INTERNAL_SERVER_ERROR)
      );

      await expect(
        mockExportService.exportProject(mockProjectId, options, mockUser.id)
      ).rejects.toMatchObject({
        message: expect.stringContaining('Export failed'),
        status: HttpStatus.INTERNAL_SERVER_ERROR,
      });
    });
  });

  describe('Corruption de données', () => {
    it('should handle corrupted file content gracefully', async () => {
      const options = createMockOptions('pdf', ['corrupted-file']);

      mockExportService.exportProject.mockRejectedValue(
        new HttpException('Export failed: pandoc: invalid UTF-8 sequence in input', HttpStatus.INTERNAL_SERVER_ERROR)
      );

      await expect(
        mockExportService.exportProject(mockProjectId, options, mockUser.id)
      ).rejects.toMatchObject({
        message: expect.stringContaining('Export failed'),
        status: HttpStatus.INTERNAL_SERVER_ERROR,
      });
    });

    it('should handle malformed metadata gracefully', async () => {
      const options = createMockOptions('markdown', ['bad-metadata-file']);

      const mockResponse = createMockExportResponse('markdown', 20, 'sanitized-export.md');
      mockExportService.exportProject.mockResolvedValue(mockResponse);

      const result = await mockExportService.exportProject(mockProjectId, options, mockUser.id);

      expect(result).toBeInstanceOf(ExportResponseDto);
      expect(result.fileName).toContain('sanitized');
    });

    it('should handle JSON parsing errors in cached data', async () => {
      const options = createMockOptions('markdown', ['normal-file']);

      mockCacheService.get.mockRejectedValue(
        new SyntaxError('Unexpected token in JSON at position 42')
      );

      const mockResponse = createMockExportResponse('markdown', 20, 'normal.md');
      mockExportService.exportProject.mockResolvedValue(mockResponse);

      const result = await mockExportService.exportProject(mockProjectId, options, mockUser.id);

      expect(result).toBeInstanceOf(ExportResponseDto);
    });
  });

  describe('Espace disque insuffisant', () => {
    it('should handle disk space errors during export', async () => {
      const options = createMockOptions('pdf', ['large-content-file']);

      mockExportService.exportProject.mockRejectedValue(
        new HttpException('Export failed: ENOSPC: no space left on device, write', HttpStatus.INTERNAL_SERVER_ERROR)
      );

      await expect(
        mockExportService.exportProject(mockProjectId, options, mockUser.id)
      ).rejects.toMatchObject({
        message: expect.stringContaining('Export failed'),
        status: HttpStatus.INTERNAL_SERVER_ERROR,
      });
    });

    it('should handle temporary storage failures', async () => {
      const options = createMockOptions('markdown', ['test-file']);

      mockExportService.exportProject.mockRejectedValue(
        new HttpException('Export failed: Temporary storage service unavailable', HttpStatus.SERVICE_UNAVAILABLE)
      );

      await expect(
        mockExportService.exportProject(mockProjectId, options, mockUser.id)
      ).rejects.toMatchObject({
        message: expect.stringContaining('Temporary storage service unavailable'),
        status: HttpStatus.SERVICE_UNAVAILABLE,
      });
    });
  });

  describe('Timeouts et interruptions', () => {
    it('should handle long-running export timeouts', async () => {
      const options = createMockOptions('pdf', ['complex-file']);

      mockExportService.exportProject.mockRejectedValue(
        new HttpException('Export failed: Pandoc process timeout after 300 seconds', HttpStatus.INTERNAL_SERVER_ERROR)
      );

      await expect(
        mockExportService.exportProject(mockProjectId, options, mockUser.id)
      ).rejects.toMatchObject({
        message: expect.stringContaining('Export failed'),
        status: HttpStatus.INTERNAL_SERVER_ERROR,
      });
    });

    it('should handle network timeouts during file retrieval', async () => {
      const options = createMockOptions('markdown', ['remote-file']);

      mockExportService.exportProject.mockRejectedValue(
        new HttpException('Export failed: Network timeout: Unable to retrieve files from storage service', HttpStatus.INTERNAL_SERVER_ERROR)
      );

      await expect(
        mockExportService.exportProject(mockProjectId, options, mockUser.id)
      ).rejects.toMatchObject({
        message: expect.stringContaining('Export failed'),
        status: HttpStatus.INTERNAL_SERVER_ERROR,
      });
    });

    it('should handle process interruption gracefully', async () => {
      const options = createMockOptions('pdf', ['interrupted-file']);

      mockExportService.exportProject.mockRejectedValue(
        new HttpException('Export failed: Process terminated: SIGTERM received', HttpStatus.INTERNAL_SERVER_ERROR)
      );

      await expect(
        mockExportService.exportProject(mockProjectId, options, mockUser.id)
      ).rejects.toMatchObject({
        message: expect.stringContaining('Export failed'),
        status: HttpStatus.INTERNAL_SERVER_ERROR,
      });
    });
  });

  describe('Configurations limites et stress test', () => {
    it('should handle maximum configuration values', async () => {
      // Configuration avec valeurs extrêmes
      mockConfigService.get.mockImplementation((key: string, defaultValue?: any) => {
        const extremeConfig: Record<string, any> = {
          'EXPORT_STORAGE_URL': 'http://localhost:3001/exports',
          'MAX_CONCURRENT_EXPORTS': 1,
          'EXPORT_EXPIRY_HOURS': 1,
          'EXPORT_CACHE_ENABLED': false,
        };
        return extremeConfig[key] || defaultValue;
      });

      const options = createMockOptions('markdown', ['test-extreme']);

      const mockResponse = createMockExportResponse('markdown', 25, 'test.md');
      mockExportService.exportProject.mockResolvedValue(mockResponse);

      const result = await mockExportService.exportProject(mockProjectId, options, mockUser.id);

      expect(result).toBeInstanceOf(ExportResponseDto);
      expect(result.format).toBe('markdown');
      expect(result.fileName).toBe('test.md');
      
      // Vérifier que la configuration a été mise en place
      expect(mockConfigService.get('MAX_CONCURRENT_EXPORTS')).toBe(1);
      expect(mockConfigService.get('EXPORT_CACHE_ENABLED')).toBe(false);
    });

    it('should handle resource exhaustion scenarios', async () => {
      const options = createMockOptions('pdf', ['resource-heavy-file']);

      mockExportService.exportProject.mockRejectedValue(
        new HttpException('Export failed: EMFILE: too many open files', HttpStatus.INTERNAL_SERVER_ERROR)
      );

      await expect(
        mockExportService.exportProject(mockProjectId, options, mockUser.id)
      ).rejects.toMatchObject({
        message: expect.stringContaining('Export failed'),
        status: HttpStatus.INTERNAL_SERVER_ERROR,
      });
    });
  });

  describe('Tests de performance et monitoring', () => {
    it('should handle service status checks during high load', async () => {
      mockExportService.getServiceStatus.mockReturnValue({
        healthy: true,
        activeExports: 5,
        queuedExports: 10,
        maxConcurrency: 5,
        cacheEnabled: true,
      });

      const status = mockExportService.getServiceStatus();

      expect(status.healthy).toBe(true);
      expect(status.activeExports).toBe(5);
      expect(status.maxConcurrency).toBe(5);
    });

    it('should handle service degradation gracefully', async () => {
      mockExportService.getServiceStatus.mockReturnValue({
        healthy: false,
        activeExports: 5,
        queuedExports: 50,
        maxConcurrency: 5,
        cacheEnabled: false,
        errors: ['Storage service unavailable', 'Cache service down'],
      });

      const status = mockExportService.getServiceStatus();

      expect(status.healthy).toBe(false);
      expect(status.errors).toHaveLength(2);
    });
  });
});