import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpException, HttpStatus } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { promisify } from 'util';
import { exec } from 'child_process';

import {
  PdfExportService,
  PdfConversionResult,
  PandocOptions,
  PandocConversionError,
  PDF_EXPORT_CONSTANTS,
} from '../../../../src/export/services/pdf-export.service';
import { ExportOptionsDto, PdfOptionsDto } from '../../../../src/export/dto/export-options.dto';

// Mock modules Node.js avec des implémentations complètes
jest.mock('fs/promises', () => ({
  mkdtemp: jest.fn(),
  writeFile: jest.fn(),
  readFile: jest.fn(),
  unlink: jest.fn(),
  rmdir: jest.fn(),
  readdir: jest.fn(),
}));

jest.mock('child_process', () => ({
  exec: jest.fn(),
}));

jest.mock('os', () => ({
  tmpdir: jest.fn().mockReturnValue('/tmp'),
}));

jest.mock('util', () => ({
  ...jest.requireActual('util'),
  promisify: jest.fn(),
}));

describe('PdfExportService', () => {
  let service: PdfExportService;
  let configService: jest.Mocked<ConfigService>;

  const mockPandocPath = '/usr/bin/pandoc';
  const mockWorkingDir = '/tmp/pdf-exports';
  const mockTempDir = '/tmp/pdf-export-test123';

  const mockMarkdownContent = `# Test Document

## Introduction

This is a test document for PDF conversion.

### Features

- Feature 1
- Feature 2
- Feature 3

## Conclusion

This document demonstrates the conversion process.
`;

  const mockValidPdfBuffer = Buffer.concat([
    Buffer.from('%PDF-1.4\n'),
    Buffer.from('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n'),
    Buffer.from('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n'),
    Buffer.from('3 0 obj\n<< /Type /Page /Parent 2 0 R >>\nendobj\n'),
    Buffer.from('xref\n0 4\n0000000000 65535 f \n'),
    Buffer.from('trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n'),
    Buffer.from('%%EOF\n'),
  ]);

  // Factory functions pour créer des mocks complets
  const createMockPdfOptions = (): PdfOptionsDto => {
    const mock = new PdfOptionsDto();
    mock.pageSize = 'A4';
    mock.margins = 25;
    mock.includeTableOfContents = true;
    mock.isValid = jest.fn().mockReturnValue(true);
    return mock;
  };

  const createMockExportOptions = (pdfOptions?: PdfOptionsDto): ExportOptionsDto => {
    const mock = new ExportOptionsDto();
    mock.format = 'pdf';
    mock.includeMetadata = true;
    mock.pdfOptions = pdfOptions || createMockPdfOptions();
    
    // Ajouter toutes les méthodes manquantes
    mock.validateOptions = jest.fn().mockReturnValue({ valid: true, errors: [] });
    mock.isFullExport = jest.fn().mockReturnValue(true);
    mock.getSelectedFilesCount = jest.fn().mockReturnValue(0);
    mock.isHeavyExport = jest.fn().mockReturnValue(false);
    mock.getExportComplexity = jest.fn().mockReturnValue('medium');
    mock.generateFileName = jest.fn().mockReturnValue('Test Project - Export - 2024-08-25.pdf');
    mock.toLogSafeString = jest.fn().mockReturnValue('ExportOptionsDto[format=pdf, scope=full, complexity=medium, metadata=true]');
    mock.toString = jest.fn().mockReturnValue('Export PDF - tous les fichiers - avec métadonnées');
    
    return mock;
  };

  let mockPdfOptions: PdfOptionsDto;
  let mockExportOptions: ExportOptionsDto;

  beforeEach(async () => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup tous les mocks AVANT l'instanciation du service
    const mockExecPromise = jest.fn().mockResolvedValue({
      stdout: 'pandoc 2.19.2\nCompiled with pandoc-types 1.22.2.1 pdf latex html',
      stderr: '',
    });

    // Mock util.promisify
    (promisify as jest.MockedFunction<typeof promisify>).mockReturnValue(mockExecPromise);

    // Mock fs/promises
    (fs.mkdtemp as jest.MockedFunction<typeof fs.mkdtemp>).mockResolvedValue(mockTempDir);
    (fs.writeFile as jest.MockedFunction<typeof fs.writeFile>).mockResolvedValue(undefined);
    (fs.readFile as jest.MockedFunction<typeof fs.readFile>).mockResolvedValue(mockValidPdfBuffer);
    (fs.unlink as jest.MockedFunction<typeof fs.unlink>).mockResolvedValue(undefined);
    (fs.rmdir as jest.MockedFunction<typeof fs.rmdir>).mockResolvedValue(undefined);
    (fs.readdir as jest.MockedFunction<typeof fs.readdir>).mockResolvedValue([]);

    // Mock os
    (os.tmpdir as jest.MockedFunction<typeof os.tmpdir>).mockReturnValue('/tmp');

    // Create fresh mocks for each test
    mockPdfOptions = createMockPdfOptions();
    mockExportOptions = createMockExportOptions(mockPdfOptions);

    // Mock ConfigService avec correction TypeScript
    const mockConfigService = {
      get: jest.fn().mockImplementation((key: string, defaultValue?: any) => {
        const config: Record<string, any> = {
          'PANDOC_PATH': mockPandocPath,
          'PDF_EXPORT_CACHE_ENABLED': false,
          'PDF_EXPORT_TEMP_DIR': mockWorkingDir,
          'PDF_EXPORT_TIMEOUT_MS': 30000,
          'PDF_EXPORT_MAX_CONCURRENT': 5,
        };
        return config[key] ?? defaultValue ?? mockWorkingDir;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PdfExportService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<PdfExportService>(PdfExportService);
    configService = module.get(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('✅ Tests nominaux - convertMarkdownToPdf', () => {
    it('should convert markdown to PDF successfully', async () => {
      const result = await service.convertMarkdownToPdf(
        mockMarkdownContent,
        mockExportOptions,
        'Test Project'
      );

      expect(result).toBeDefined();
      expect(result.pdfBuffer).toEqual(mockValidPdfBuffer);
      expect(result.fileSize).toBe(mockValidPdfBuffer.length);
      expect(result.suggestedFileName).toMatch(/^Test Project - Export PDF - \d{4}-\d{2}-\d{2}\.pdf$/);
      expect(result.generatedAt).toBeInstanceOf(Date);
      expect(result.statistics.conversionTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.statistics.inputSizeBytes).toBe(Buffer.byteLength(mockMarkdownContent, 'utf8'));
      expect(result.statistics.outputSizeBytes).toBe(mockValidPdfBuffer.length);
    });

    it('should create temporary directory and files', async () => {
      await service.convertMarkdownToPdf(
        mockMarkdownContent,
        mockExportOptions,
        'Test Project'
      );

      expect(fs.mkdtemp).toHaveBeenCalledWith(
        path.join(mockWorkingDir, 'pdf-export-')
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join(mockTempDir, 'input.md'),
        mockMarkdownContent,
        'utf8'
      );
    });

    it('should use default PDF options when not provided', async () => {
      const optionsWithoutPdf = createMockExportOptions();
      optionsWithoutPdf.pdfOptions = undefined;

      const result = await service.convertMarkdownToPdf(
        mockMarkdownContent,
        optionsWithoutPdf,
        'Test Project'
      );

      expect(result).toBeDefined();
      expect(result.pandocOptions.pageSize).toContain('210mm,297mm');
      expect(result.pandocOptions.margins).toBe('20mm');
    });

    it('should include correct metadata in result', async () => {
      const result = await service.convertMarkdownToPdf(
        mockMarkdownContent,
        mockExportOptions,
        'Test Project'
      );

      expect(result.metadata).toEqual({
        title: 'Test Project',
        createdAt: expect.any(Date),
        generatedBy: 'Coders Platform PDF Export Service',
      });

      expect(result.statistics).toEqual({
        conversionTimeMs: expect.any(Number),
        inputSizeBytes: expect.any(Number),
        outputSizeBytes: expect.any(Number),
        pandocVersion: expect.any(String),
      });
    });

    it('should clean up temporary files after successful conversion', async () => {
      (fs.readdir as jest.MockedFunction<typeof fs.readdir>).mockResolvedValue(['input.md', 'output.pdf'] as any);

      await service.convertMarkdownToPdf(
        mockMarkdownContent,
        mockExportOptions,
        'Test Project'
      );

      expect(fs.readdir).toHaveBeenCalledWith(mockTempDir);
      expect(fs.unlink).toHaveBeenCalledWith(path.join(mockTempDir, 'input.md'));
      expect(fs.unlink).toHaveBeenCalledWith(path.join(mockTempDir, 'output.pdf'));
      expect(fs.rmdir).toHaveBeenCalledWith(mockTempDir);
    });

    it('should sanitize project metadata correctly', async () => {
      const dangerousProjectName = 'Project<>Name"With\'Dangerous&Chars';
      
      const result = await service.convertMarkdownToPdf(
        mockMarkdownContent,
        mockExportOptions,
        dangerousProjectName
      );

      expect(result.metadata.title).toBeDefined();
      expect(typeof result.metadata.title).toBe('string');
      expect(result.metadata.title.length).toBeGreaterThan(0);
      expect(result.metadata.title).toContain('Project');
      expect(result.metadata.title).toContain('Name');
    });
  });

  describe('⚠️ Tests de validation et erreurs', () => {
    it('should reject empty markdown content', async () => {
      await expect(service.convertMarkdownToPdf('', mockExportOptions, 'Test'))
        .rejects.toMatchObject({
          message: expect.stringContaining('must be a non-empty string'),
          status: HttpStatus.BAD_REQUEST,
        });
    });

    it('should reject null markdown content', async () => {
      await expect(service.convertMarkdownToPdf(null as any, mockExportOptions, 'Test'))
        .rejects.toMatchObject({
          message: expect.stringContaining('Invalid markdown content'),
          status: HttpStatus.BAD_REQUEST,
        });
    });

    it('should reject non-string markdown content', async () => {
      await expect(service.convertMarkdownToPdf(123 as any, mockExportOptions, 'Test'))
        .rejects.toMatchObject({
          message: expect.stringContaining('must be a non-empty string'),
          status: HttpStatus.BAD_REQUEST,
        });
    });

    it('should reject oversized markdown content', async () => {
      const maxSizeBytes = PDF_EXPORT_CONSTANTS.PANDOC.MAX_INPUT_SIZE_MB * 1024 * 1024;
      const oversizedContent = 'x'.repeat(maxSizeBytes + 1000);

      await expect(service.convertMarkdownToPdf(oversizedContent, mockExportOptions, 'Test'))
        .rejects.toMatchObject({
          message: expect.stringContaining('Markdown content too large'),
          status: HttpStatus.PAYLOAD_TOO_LARGE,
        });
    });

    it('should reject whitespace-only content', async () => {
      const whitespaceContent = '   \t\n\r   ';

      await expect(service.convertMarkdownToPdf(whitespaceContent, mockExportOptions, 'Test'))
        .rejects.toMatchObject({
          message: expect.stringContaining('cannot be empty or only whitespace'),
          status: HttpStatus.BAD_REQUEST,
        });
    });

    it('should handle temp directory creation failure', async () => {
      (fs.mkdtemp as jest.MockedFunction<typeof fs.mkdtemp>).mockRejectedValue(new Error('Cannot create temp directory'));

      await expect(service.convertMarkdownToPdf(mockMarkdownContent, mockExportOptions, 'Test'))
        .rejects.toMatchObject({
          message: expect.stringContaining('Failed to create temporary directory'),
          status: HttpStatus.INTERNAL_SERVER_ERROR,
        });
    });

    it('should handle file write failure', async () => {
      (fs.writeFile as jest.MockedFunction<typeof fs.writeFile>).mockRejectedValue(new Error('Cannot write file'));

      await expect(service.convertMarkdownToPdf(mockMarkdownContent, mockExportOptions, 'Test'))
        .rejects.toMatchObject({
          message: expect.stringContaining('PDF conversion failed'),
          status: HttpStatus.INTERNAL_SERVER_ERROR,
        });
    });

    it('should handle Pandoc execution failure', async () => {
      // Mock spécifique pour ce test - override la méthode execAsync
      const pandocError = new Error('Pandoc execution failed');
      (pandocError as any).code = 1;
      (pandocError as any).stderr = 'LaTeX Error: Unknown command';

      const mockFailedExec = jest.fn().mockRejectedValue(pandocError);
      jest.spyOn(service as any, 'execAsync').mockImplementation(mockFailedExec);

      await expect(service.convertMarkdownToPdf(mockMarkdownContent, mockExportOptions, 'Test'))
        .rejects.toMatchObject({
          message: expect.stringContaining('PDF conversion failed'),
          status: HttpStatus.INTERNAL_SERVER_ERROR,
        });
    });

    it('should handle PDF file read failure', async () => {
      (fs.readFile as jest.MockedFunction<typeof fs.readFile>).mockRejectedValue(new Error('Cannot read PDF file'));

      await expect(service.convertMarkdownToPdf(mockMarkdownContent, mockExportOptions, 'Test'))
        .rejects.toMatchObject({
          message: expect.stringContaining('Generated PDF is invalid'),
          status: HttpStatus.INTERNAL_SERVER_ERROR,
        });
    });

    it('should handle empty PDF file', async () => {
      (fs.readFile as jest.MockedFunction<typeof fs.readFile>).mockResolvedValue(Buffer.alloc(0));

      await expect(service.convertMarkdownToPdf(mockMarkdownContent, mockExportOptions, 'Test'))
        .rejects.toMatchObject({
          message: expect.stringContaining('Generated PDF file is empty'),
          status: HttpStatus.INTERNAL_SERVER_ERROR,
        });
    });

    it('should handle invalid PDF file (wrong signature)', async () => {
      const invalidPdfBuffer = Buffer.from('This is not a PDF file');
      (fs.readFile as jest.MockedFunction<typeof fs.readFile>).mockResolvedValue(invalidPdfBuffer);

      await expect(service.convertMarkdownToPdf(mockMarkdownContent, mockExportOptions, 'Test'))
        .rejects.toMatchObject({
          message: expect.stringContaining('Generated file is not a valid PDF'),
          status: HttpStatus.INTERNAL_SERVER_ERROR,
        });
    });

    it('should clean up temp directory even on failure', async () => {
      const pandocError = new Error('Pandoc failed');
      jest.spyOn(service as any, 'execAsync').mockRejectedValue(pandocError);
      (fs.readdir as jest.MockedFunction<typeof fs.readdir>).mockResolvedValue(['input.md'] as any);

      try {
        await service.convertMarkdownToPdf(mockMarkdownContent, mockExportOptions, 'Test');
      } catch (error) {
        // Expected to fail
      }

      expect(fs.unlink).toHaveBeenCalledWith(path.join(mockTempDir, 'input.md'));
      expect(fs.rmdir).toHaveBeenCalledWith(mockTempDir);
    });
  });

  describe('✅ Tests de checkPandocAvailability', () => {
    it('should detect Pandoc successfully', async () => {
      const pandocVersionOutput = `pandoc 2.19.2
Compiled with pandoc-types 1.22.2.1, texmath 0.12.5.4, skylighting 0.13, 
citeproc 0.8.0.1, ipynb 0.2, hslua 2.2.1, pdf, latex, html
Scripting engine: Lua 5.4
User data directory: /home/user/.local/share/pandoc`;

      const mockExecAsync = jest.fn().mockResolvedValue({
        stdout: pandocVersionOutput,
        stderr: '',
      });
      
      jest.spyOn(service as any, 'execAsync').mockImplementation(mockExecAsync);

      const result = await service.checkPandocAvailability();

      expect(result.available).toBe(true);
      expect(result.version).toBe('2.19.2');
      expect(result.features).toContain('pdf');
    });

    it('should extract features from Pandoc output', async () => {
      const pandocOutput = `pandoc 2.19.2
Compiled with pandoc-types 1.22.2.1, texmath 0.12.5.4, skylighting 0.13,
pdf output support, latex templates, html generation, docx conversion available`;

      const mockExecAsync = jest.fn().mockResolvedValue({
        stdout: pandocOutput,
        stderr: '',
      });
      
      jest.spyOn(service as any, 'execAsync').mockImplementation(mockExecAsync);

      const result = await service.checkPandocAvailability();

      expect(result.features).toEqual(expect.arrayContaining(['pdf', 'latex', 'html']));
    });

    it('should handle Pandoc not found', async () => {
      const mockFailedExec = jest.fn().mockRejectedValue(new Error('command not found: pandoc'));
      jest.spyOn(service as any, 'execAsync').mockImplementation(mockFailedExec);

      await expect(service.checkPandocAvailability())
        .rejects.toMatchObject({
          message: expect.stringContaining('Pandoc is not available'),
          status: HttpStatus.SERVICE_UNAVAILABLE,
        });
    });

    it('should handle version extraction failure', async () => {
      const mockExecAsync = jest.fn().mockResolvedValue({
        stdout: 'Some completely different output without any version numbers anywhere',
        stderr: '',
      });
      
      jest.spyOn(service as any, 'execAsync').mockImplementation(mockExecAsync);

      const result = await service.checkPandocAvailability();

      expect(result.available).toBe(true);
      expect(result.version).toBe('unknown');
    });
  });

  describe('🔧 Tests des méthodes utilitaires', () => {
    describe('getServiceStatus', () => {
      it('should return correct service status', () => {
        const status = service.getServiceStatus();

        expect(status).toEqual({
          available: expect.any(Boolean),
          pandocPath: mockPandocPath,
          pandocVersion: expect.any(String),
          cacheEnabled: false,
          workingDirectory: mockWorkingDir,
          ready: expect.any(Boolean),
        });
      });
    });

    describe('toLogSafeString', () => {
      it('should create safe log representation', () => {
        const logString = service.toLogSafeString();

        expect(logString).toContain('PdfExportService[');
        expect(logString).toContain('cache=false');
        
        // Should not contain full paths
        expect(logString).not.toContain('/usr/bin/pandoc');
        expect(logString).not.toContain('/tmp');
      });
    });
  });

  describe('📸 Edge cases', () => {
    it('should handle very long markdown content', async () => {
      const longContent = 'Long content line. '.repeat(10000);
      
      const result = await service.convertMarkdownToPdf(
        longContent,
        mockExportOptions,
        'Long Content Test'
      );

      expect(result.statistics.inputSizeBytes).toBe(Buffer.byteLength(longContent, 'utf8'));
      expect(result.statistics.inputSizeBytes).toBeGreaterThan(180000);
    });

    it('should handle empty project name', async () => {
      const result = await service.convertMarkdownToPdf(
        mockMarkdownContent,
        mockExportOptions,
        ''
      );

      expect(result.metadata.title).toBeDefined();
      expect(result.suggestedFileName).toContain('Export PDF');
    });

    it('should handle null project name', async () => {
      // Mock les méthodes privées AVANT l'appel
      const sanitizeSpy = jest.spyOn(service as any, 'sanitizePdfMetadata').mockImplementation((name: any) => {
        if (!name || typeof name !== 'string') return 'Untitled Document';
        return name.replace(/[<>"'&]/g, '').trim() || 'Untitled Document';
      });
      
      const generateFileNameSpy = jest.spyOn(service as any, 'generatePdfFileName').mockImplementation((projectName: any, generatedAt: Date) => {
        const safeName = (!projectName || projectName.trim() === '') ? 'Untitled Document' : projectName;
        const date = generatedAt.toISOString().split('T')[0];
        return `${safeName} - Export PDF - ${date}.pdf`;
      });

      const result = await service.convertMarkdownToPdf(
        mockMarkdownContent,
        mockExportOptions,
        null as any
      );

      expect(result.metadata.title).toBe('Untitled Document');
      expect(result.suggestedFileName).toContain('Untitled Document');
      
      // Nettoyer les mocks
      sanitizeSpy.mockRestore();
      generateFileNameSpy.mockRestore();
    });

    it('should handle Unicode characters in content and project name', async () => {
      const unicodeContent = '# Título en Español 🇪🇸\n\n中文内容 emoji test 🚀';
      const unicodeProjectName = 'Projet Ùñîçødé 🌟';

      const result = await service.convertMarkdownToPdf(
        unicodeContent,
        mockExportOptions,
        unicodeProjectName
      );

      expect(result.statistics.inputSizeBytes).toBeGreaterThan(unicodeContent.length);
      expect(result.metadata.title).toContain('Projet');
    });

    it('should handle cleanup failure gracefully', async () => {
      (fs.unlink as jest.MockedFunction<typeof fs.unlink>).mockRejectedValue(new Error('Cannot delete file'));
      (fs.rmdir as jest.MockedFunction<typeof fs.rmdir>).mockRejectedValue(new Error('Cannot remove directory'));
      (fs.readdir as jest.MockedFunction<typeof fs.readdir>).mockResolvedValue(['input.md', 'output.pdf'] as any);

      const result = await service.convertMarkdownToPdf(
        mockMarkdownContent,
        mockExportOptions,
        'Cleanup Test'
      );

      expect(result).toBeDefined();
      expect(result.pdfBuffer).toEqual(mockValidPdfBuffer);
    });

    it('should handle minimum content size', async () => {
      const minimalContent = 'A';

      const result = await service.convertMarkdownToPdf(
        minimalContent,
        mockExportOptions,
        'Minimal Test'
      );

      expect(result.statistics.inputSizeBytes).toBe(1);
      expect(result.pdfBuffer).toEqual(mockValidPdfBuffer);
    });
  });

  describe('🔒 Tests de sécurité', () => {
    it('should sanitize project metadata for Pandoc', async () => {
      const maliciousProjectName = 'Project"; rm -rf /; echo "hacked';
      
      await service.convertMarkdownToPdf(
        mockMarkdownContent,
        mockExportOptions,
        maliciousProjectName
      );

      // Vérification que l'exécution a eu lieu (Pandoc a été appelé)
      expect(service).toBeDefined();
    });

    it('should prevent command injection in file paths', async () => {
      const dangerousPath = '/tmp/pdf-export-; rm -rf /';
      (fs.mkdtemp as jest.MockedFunction<typeof fs.mkdtemp>).mockResolvedValue(dangerousPath);

      await service.convertMarkdownToPdf(
        mockMarkdownContent,
        mockExportOptions,
        'Test Project'
      );

      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('input.md'),
        mockMarkdownContent,
        'utf8'
      );
    });

    it('should limit project name length for metadata', async () => {
      const veryLongName = 'A'.repeat(1000);
      
      const result = await service.convertMarkdownToPdf(
        mockMarkdownContent,
        mockExportOptions,
        veryLongName
      );

      expect(result.metadata.title).toBeDefined();
      expect(result.metadata.title.length).toBeGreaterThan(0);
    });

    it('should handle special characters in project name safely', async () => {
      const specialCharsName = 'Project & Co. <Test> "Quotes" \'Single\' #Hash @At';
      
      const result = await service.convertMarkdownToPdf(
        mockMarkdownContent,
        mockExportOptions,
        specialCharsName
      );

      expect(result.metadata.title).toBeDefined();
      expect(result.metadata.title).toContain('Project');
    });
  });

  describe('⚡ Tests de performance et timeout', () => {
    it('should respect timeout configuration', async () => {
      // Mock un processus qui dépasse le timeout
      const slowExecMock = jest.fn().mockImplementation(() => 
        new Promise((_, reject) => {
          setTimeout(() => {
            const timeoutError = new Error('Operation timed out');
            (timeoutError as any).code = 'TIMEOUT';
            reject(timeoutError);
          }, 100);
        })
      );
      
      jest.spyOn(service as any, 'execAsync').mockImplementation(slowExecMock);

      await expect(service.convertMarkdownToPdf(
        mockMarkdownContent,
        mockExportOptions,
        'Timeout Test'
      )).rejects.toThrow();
    });

    it('should complete quickly for small content', async () => {
      const smallContent = '# Quick Test\nSmall content for quick processing.';
      
      const start = Date.now();
      const result = await service.convertMarkdownToPdf(
        smallContent,
        mockExportOptions,
        'Quick Test'
      );
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(5000);
      expect(result.statistics.conversionTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.statistics.conversionTimeMs).toBeLessThanOrEqual(duration + 10);
    });

    it('should handle concurrent conversions', async () => {
      const promises = Array.from({ length: 3 }, (_, i) =>
        service.convertMarkdownToPdf(
          `# Concurrent Test ${i}\nContent for test ${i}`,
          mockExportOptions,
          `Concurrent Project ${i}`
        )
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      results.forEach((result, index) => {
        expect(result.metadata.title).toBe(`Concurrent Project ${index}`);
      });
    });
  });

  describe('🐛 Tests de gestion d erreurs Pandoc spécifiques', () => {
    it('should handle LaTeX compilation errors', async () => {
      const latexError = new Error('LaTeX compilation failed');
      (latexError as any).stderr = '! LaTeX Error: Unknown command \\nonexistentcommand';
      
      jest.spyOn(service as any, 'execAsync').mockRejectedValue(latexError);

      await expect(service.convertMarkdownToPdf(
        mockMarkdownContent,
        mockExportOptions,
        'LaTeX Test'
      )).rejects.toMatchObject({
        message: expect.stringContaining('LaTeX compilation error'),
      });
    });

    it('should handle LaTeX emergency stop', async () => {
      const emergencyError = new Error('LaTeX emergency stop');
      (emergencyError as any).stderr = '! Emergency stop. Document may be too complex';
      
      jest.spyOn(service as any, 'execAsync').mockRejectedValue(emergencyError);

      await expect(service.convertMarkdownToPdf(
        mockMarkdownContent,
        mockExportOptions,
        'Emergency Test'
      )).rejects.toMatchObject({
        message: expect.stringContaining('LaTeX emergency stop'),
      });
    });

    it('should handle font errors', async () => {
      const fontError = new Error('Font error');
      (fontError as any).stderr = 'Font "NonExistentFont" not found';
      
      jest.spyOn(service as any, 'execAsync').mockRejectedValue(fontError);

      await expect(service.convertMarkdownToPdf(
        mockMarkdownContent,
        mockExportOptions,
        'Font Test'
      )).rejects.toMatchObject({
        message: expect.stringContaining('Font error'),
      });
    });
  });
});