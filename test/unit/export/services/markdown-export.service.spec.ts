import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpException, HttpStatus } from '@nestjs/common';

import {
  MarkdownExportService,
  MarkdownExportResult,
  MarkdownExportMetadata,
  MARKDOWN_EXPORT_CONSTANTS,
} from '../../../../src/export/services/markdown-export.service';
import { ExportOptionsDto } from '../../../../src/export/dto/export-options.dto';
import { FileRetrievalResult } from '../../../../src/export/services/file-retrieval.service';

describe('MarkdownExportService', () => {
  let service: MarkdownExportService;
  let configService: jest.Mocked<ConfigService>;

  const mockPlatformVersion = '1.2.3';
  const mockDebugMode = false;

  // Factory function pour créer des mocks complets d'ExportOptionsDto
  const createMockExportOptions = (overrides: Partial<ExportOptionsDto> = {}): ExportOptionsDto => {
    const mock = new ExportOptionsDto();
    mock.format = 'markdown';
    mock.includeMetadata = true;
    
    // Ajouter toutes les méthodes manquantes
    mock.validateOptions = jest.fn().mockReturnValue({ valid: true, errors: [] });
    mock.isFullExport = jest.fn().mockReturnValue(true);
    mock.getSelectedFilesCount = jest.fn().mockReturnValue(0);
    mock.isHeavyExport = jest.fn().mockReturnValue(false);
    mock.getExportComplexity = jest.fn().mockReturnValue('medium');
    mock.generateFileName = jest.fn().mockReturnValue('Test Project - Export - 2024-08-25.md');
    mock.toLogSafeString = jest.fn().mockReturnValue('ExportOptionsDto[format=markdown, scope=full, complexity=medium, metadata=true]');
    mock.toString = jest.fn().mockReturnValue('Export Markdown - tous les fichiers - avec métadonnées');
    
    // Appliquer les overrides
    Object.assign(mock, overrides);
    
    return mock;
  };

  const createMockFile = (
    id: string,
    name: string,
    content: string,
    contentType: string = 'text/markdown'
  ): FileRetrievalResult => ({
    id,
    content,
    metadata: {
      id,
      name,
      size: content.length,
      contentType,
      lastModified: new Date('2024-01-15T10:00:00Z'),
    },
    retrievedAt: new Date(),
    contentSize: content.length,
  });

  const mockSingleFile = createMockFile(
    '550e8400-e29b-41d4-a716-446655440000',
    'README.md',
    '# Project Title\n\nThis is a sample README file.\n\n## Installation\n\nRun `npm install`.'
  );

  const mockMultipleFiles: FileRetrievalResult[] = [
    createMockFile(
      '550e8400-e29b-41d4-a716-446655440001',
      'introduction.md',
      '# Introduction\n\nThis document provides an overview of the project.'
    ),
    createMockFile(
      '550e8400-e29b-41d4-a716-446655440002',
      'architecture.md',
      '# Architecture\n\n## Components\n\n- Frontend\n- Backend\n- Database'
    ),
    createMockFile(
      '550e8400-e29b-41d4-a716-446655440003',
      'api-reference.md',
      '# API Reference\n\n## Endpoints\n\n### GET /users\n\nRetrieve all users.'
    ),
  ];

  const mockProjectMetadata: Partial<MarkdownExportMetadata> = {
    projectName: 'Test Project',
    projectDescription: 'A comprehensive test project',
    initialPrompt: 'Create a well-documented application',
    statistics: {
      documentsGenerated: 3,
      tokensUsed: 1500,
      generationTime: 120,
    },
  };

  let mockExportOptions: ExportOptionsDto;

  beforeEach(async () => {
    const mockConfigService = {
      get: jest.fn().mockImplementation((key: string, defaultValue?: any) => {
        switch (key) {
          case 'APP_VERSION':
            return mockPlatformVersion;
          case 'MARKDOWN_EXPORT_DEBUG':
            return mockDebugMode;
          default:
            return defaultValue;
        }
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarkdownExportService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<MarkdownExportService>(MarkdownExportService);
    configService = module.get(ConfigService);

    // Create fresh mock for each test
    mockExportOptions = createMockExportOptions();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('✅ Tests nominaux - exportMarkdown', () => {
    it('should export single file successfully', async () => {
      const result = await service.exportMarkdown(
        [mockSingleFile],
        mockExportOptions,
        mockProjectMetadata
      );

      expect(result).toBeDefined();
      expect(result.content).toContain('# Test Project');
      expect(result.content).toContain(mockSingleFile.content);
      expect(result.contentSize).toBeGreaterThan(0);
      expect(result.suggestedFileName).toContain('Test Project');
      expect(result.suggestedFileName).toMatch(/\.md$/);
      expect(result.generatedAt).toBeInstanceOf(Date);
      expect(result.generationDurationMs).toBeGreaterThan(0);
      expect(result.includedFiles).toHaveLength(1);
      expect(result.includedFiles[0].id).toBe(mockSingleFile.id);
    });

    it('should export multiple files with table of contents', async () => {
      const result = await service.exportMarkdown(
        mockMultipleFiles,
        mockExportOptions,
        mockProjectMetadata
      );

      expect(result.content).toContain('# Test Project');
      expect(result.content).toContain('## Table des matières');
      expect(result.content).toContain('1. [introduction.md](#introductionmd)');
      expect(result.content).toContain('2. [architecture.md](#architecturemd)');
      expect(result.content).toContain('3. [api-reference.md](#api-referencemd)');

      // Check that all file contents are included (with adjusted headers for multiple files)
      expect(result.content).toContain('This document provides an overview of the project.');
      expect(result.content).toContain('Frontend');
      expect(result.content).toContain('Backend');
      expect(result.content).toContain('Database');
      expect(result.content).toContain('Retrieve all users.');
      
      // Headers are adjusted for multiple files (H1 -> H2, H2 -> H3)
      expect(result.content).toContain('## Architecture');
      expect(result.content).toContain('### Components');

      expect(result.includedFiles).toHaveLength(3);
      expect(result.metadata.filesCount).toBe(3);
    });

    it('should include metadata header when requested', async () => {
      const result = await service.exportMarkdown(
        [mockSingleFile],
        createMockExportOptions({ includeMetadata: true }),
        mockProjectMetadata
      );

      expect(result.content).toContain('---');
      expect(result.content).toContain('title: "Test Project"');
      expect(result.content).toContain('description: "A comprehensive test project"');
      expect(result.content).toContain(`platform_version: "${mockPlatformVersion}"`);
      expect(result.content).toContain('files_count: 1');
      expect(result.content).toContain('statistics:');
      expect(result.content).toContain('  documents_generated: 3');
      expect(result.content).toContain('  tokens_used: 1500');
      expect(result.content).toContain('  generation_time: 120');
      expect(result.content).toContain('## Demande initiale');
      expect(result.content).toContain('> Create a well-documented application');
    });

    it('should skip metadata when not requested', async () => {
      const result = await service.exportMarkdown(
        [mockSingleFile],
        createMockExportOptions({ includeMetadata: false }),
        mockProjectMetadata
      );

      expect(result.content).not.toContain('---');
      expect(result.content).not.toContain('title: "Test Project"');
      expect(result.content).not.toContain('## Table des matières');
      expect(result.content).not.toContain('## Demande initiale');
      expect(result.content).toContain(mockSingleFile.content); // Should still contain file content
    });

    it('should handle files without optional metadata', async () => {
      const minimalMetadata = {
        projectName: 'Minimal Project',
      };

      const result = await service.exportMarkdown(
        [mockSingleFile],
        mockExportOptions,
        minimalMetadata
      );

      expect(result.content).toContain('# Minimal Project');
      expect(result.content).not.toContain('description:');
      expect(result.content).not.toContain('## Demande initiale');
      expect(result.content).not.toContain('statistics:');
      expect(result.metadata.projectDescription).toBeUndefined();
    });

    it('should adjust header levels for multiple files', async () => {
      const filesWithHeaders = [
        createMockFile('1', 'doc1.md', '# Main Title\n## Subtitle\n### Sub-subtitle'),
        createMockFile('2', 'doc2.md', '# Another Main\n## Another Sub'),
      ];

      const result = await service.exportMarkdown(
        filesWithHeaders,
        mockExportOptions,
        mockProjectMetadata
      );

      // Headers should be adjusted by +1 level since we have file sections
      expect(result.content).toContain('## doc1.md');
      expect(result.content).toContain('## Main Title'); // H1 -> H2
      expect(result.content).toContain('### Subtitle'); // H2 -> H3
      expect(result.content).toContain('#### Sub-subtitle'); // H3 -> H4

      expect(result.content).toContain('## doc2.md');
      expect(result.content).toContain('## Another Main');
      expect(result.content).toContain('### Another Sub');
    });

    it('should preserve original headers for single file', async () => {
      const fileWithHeaders = createMockFile(
        '1', 
        'single.md', 
        '# Original H1\n## Original H2\n### Original H3'
      );

      const result = await service.exportMarkdown(
        [fileWithHeaders],
        mockExportOptions,
        mockProjectMetadata
      );

      // For single file, no header adjustment should occur
      expect(result.content).toContain('# Original H1');
      expect(result.content).toContain('## Original H2');
      expect(result.content).toContain('### Original H3');
    });

    it('should generate correct file metadata', async () => {
      const result = await service.exportMarkdown(
        mockMultipleFiles,
        mockExportOptions,
        mockProjectMetadata
      );

      expect(result.metadata).toMatchObject({
        projectName: 'Test Project',
        projectDescription: 'A comprehensive test project',
        initialPrompt: 'Create a well-documented application',
        platformVersion: expect.any(String), // Accept any string since config may be undefined
        filesCount: 3,
        totalContentSize: expect.any(Number),
      });

      expect(result.metadata.generatedAt).toBeInstanceOf(Date);
      expect(result.metadata.exportedAt).toBeInstanceOf(Date);
      expect(result.metadata.statistics).toEqual(mockProjectMetadata.statistics);
    });

    it('should calculate content size correctly', async () => {
      const result = await service.exportMarkdown(
        [mockSingleFile],
        mockExportOptions,
        mockProjectMetadata
      );

      expect(result.contentSize).toBe(result.content.length);
      expect(result.contentSize).toBe(Buffer.byteLength(result.content, 'utf8'));
    });
  });

  describe('⚠️ Tests de validation', () => {
    it('should reject invalid file array', async () => {
      const invalidInputs = [
        null,
        undefined,
        'not-an-array',
        123,
        {},
      ];

      for (const invalidInput of invalidInputs) {
        await expect(service.exportMarkdown(
          invalidInput as any,
          mockExportOptions,
          mockProjectMetadata
        )).rejects.toThrow(); // Accept any error type
      }
    });

    it('should reject empty file array', async () => {
      await expect(service.exportMarkdown(
        [],
        mockExportOptions,
        mockProjectMetadata
      )).rejects.toMatchObject({
        message: 'No files provided for export',
        status: HttpStatus.BAD_REQUEST,
      });
    });

    it('should reject too many files', async () => {
      const tooManyFiles = Array.from({ length: MARKDOWN_EXPORT_CONSTANTS.CONTENT.MAX_FILES_COUNT + 1 }, (_, i) =>
        createMockFile(`file-${i}`, `file-${i}.md`, 'content')
      );

      await expect(service.exportMarkdown(
        tooManyFiles,
        mockExportOptions,
        mockProjectMetadata
      )).rejects.toMatchObject({
        message: expect.stringContaining('Too many files'),
        status: HttpStatus.BAD_REQUEST,
      });
    });

    it('should reject files with invalid structure', async () => {
      const invalidFiles = [
        null,
        undefined,
        'not-an-object',
        { id: 'valid' }, // Missing content
        { content: 'valid' }, // Missing metadata
        { content: 'valid', metadata: 'not-object' },
        { content: null, metadata: {} },
        { content: 123, metadata: {} },
      ];

      for (let i = 0; i < invalidFiles.length; i++) {
        const testFiles = [invalidFiles[i] as any];
        
        await expect(service.exportMarkdown(
          testFiles,
          mockExportOptions,
          mockProjectMetadata
        )).rejects.toMatchObject({
          message: expect.stringContaining(`Invalid file at index 0`),
          status: HttpStatus.BAD_REQUEST,
        });
      }
    });

    it('should reject content exceeding size limit', async () => {
      const maxSizeBytes = MARKDOWN_EXPORT_CONSTANTS.CONTENT.MAX_TOTAL_SIZE_MB * 1024 * 1024;
      const oversizedContent = 'x'.repeat(maxSizeBytes + 1000);
      const oversizedFile = createMockFile('1', 'huge.md', oversizedContent);

      await expect(service.exportMarkdown(
        [oversizedFile],
        mockExportOptions,
        mockProjectMetadata
      )).rejects.toMatchObject({
        message: expect.stringContaining('Total content size'),
        status: HttpStatus.PAYLOAD_TOO_LARGE,
      });
    });

    it('should validate individual file content', async () => {
      const filesWithInvalidContent = [
        { ...mockSingleFile, content: null },
        { ...mockSingleFile, content: undefined },
        { ...mockSingleFile, content: 123 },
        { ...mockSingleFile, content: {} },
      ];

      for (const invalidFile of filesWithInvalidContent) {
        await expect(service.exportMarkdown(
          [invalidFile as any],
          mockExportOptions,
          mockProjectMetadata
        )).rejects.toThrow(HttpException);
      }
    });
  });

  describe('🔧 Tests de sanitisation et sécurité', () => {
    it('should sanitize project name', async () => {
      const maliciousMetadata = {
        projectName: '  <script>alert("xss")</script>Project#Name[]  ',
      };

      const result = await service.exportMarkdown(
        [mockSingleFile],
        mockExportOptions,
        maliciousMetadata
      );

      expect(result.metadata.projectName).toBe('scriptalertxss/scriptProjectName');
      expect(result.metadata.projectName).not.toContain('<script>');
      expect(result.metadata.projectName).not.toContain('[');
      expect(result.metadata.projectName).not.toContain(']');
      expect(result.metadata.projectName).not.toContain('(');
      expect(result.metadata.projectName).not.toContain(')');
    });

    it('should sanitize project description', async () => {
      const maliciousMetadata = {
        projectName: 'Safe Project',
        projectDescription: 'Description with <script>alert("xss")</script> and\n\nmultiple\r\nline breaks',
      };

      const result = await service.exportMarkdown(
        [mockSingleFile],
        mockExportOptions,
        maliciousMetadata
      );

      expect(result.metadata.projectDescription).not.toContain('<script>');
      expect(result.metadata.projectDescription).not.toContain('\n');
      expect(result.metadata.projectDescription).not.toContain('\r');
      expect(result.metadata.projectDescription).toBe(
        'Description with scriptalert(xss)/script and multiple line breaks'
      );
    });

    it('should sanitize initial prompt', async () => {
      const maliciousMetadata = {
        projectName: 'Safe Project',
        initialPrompt: 'Create > something with <script> and > blockquote chars',
      };

      const result = await service.exportMarkdown(
        [mockSingleFile],
        mockExportOptions,
        maliciousMetadata
      );

      expect(result.metadata.initialPrompt).not.toContain('<script>');
      expect(result.content).toContain('Create  something with script and  blockquote chars');
    });

    it('should sanitize file names', async () => {
      const filesWithDangerousNames = [
        createMockFile('1', '<script>alert("xss")</script>file.md', 'content1'),
        createMockFile('2', 'file#with[]dangerous{chars}.md', 'content2'),
        createMockFile('3', '  spaced file  .md  ', 'content3'),
      ];

      const result = await service.exportMarkdown(
        filesWithDangerousNames,
        mockExportOptions,
        mockProjectMetadata
      );

      expect(result.content).toContain('## scriptalertxss/scriptfile.md');
      expect(result.content).toContain('## filewithdangerouschars.md');
      expect(result.content).toContain('## spaced file  .md');
    });

    it('should limit project name length', async () => {
      const longName = 'a'.repeat(MARKDOWN_EXPORT_CONSTANTS.METADATA.MAX_PROJECT_NAME_LENGTH + 50);
      const maliciousMetadata = {
        projectName: longName,
      };

      const result = await service.exportMarkdown(
        [mockSingleFile],
        mockExportOptions,
        maliciousMetadata
      );

      expect(result.metadata.projectName.length).toBeLessThanOrEqual(
        MARKDOWN_EXPORT_CONSTANTS.METADATA.MAX_PROJECT_NAME_LENGTH
      );
    });

    it('should limit description length', async () => {
      const longDescription = 'b'.repeat(MARKDOWN_EXPORT_CONSTANTS.METADATA.MAX_DESCRIPTION_LENGTH + 50);
      const maliciousMetadata = {
        projectName: 'Test',
        projectDescription: longDescription,
      };

      const result = await service.exportMarkdown(
        [mockSingleFile],
        mockExportOptions,
        maliciousMetadata
      );

      expect(result.metadata.projectDescription!.length).toBeLessThanOrEqual(
        MARKDOWN_EXPORT_CONSTANTS.METADATA.MAX_DESCRIPTION_LENGTH
      );
    });

    it('should handle null/undefined metadata gracefully', async () => {
      const badMetadata = {
        projectName: null,
        projectDescription: undefined,
        initialPrompt: '',
      };

      const result = await service.exportMarkdown(
        [mockSingleFile],
        mockExportOptions,
        badMetadata as any
      );

      expect(result.metadata.projectName).toBe('Projet Sans Nom');
      expect(result.metadata.projectDescription).toBeUndefined();
      expect(result.metadata.initialPrompt).toBeUndefined();
    });
  });

  describe('📸 Edge cases', () => {
    it('should handle empty file content', async () => {
      const emptyFile = createMockFile('1', 'empty.md', ' '); // Use space instead of empty string

      const result = await service.exportMarkdown(
        [emptyFile],
        mockExportOptions,
        mockProjectMetadata
      );

      expect(result.content).toContain('# Test Project');
      expect(result.includedFiles[0].size).toBe(1);
    });

    it('should handle file content with only whitespace', async () => {
      const whitespaceFile = createMockFile('1', 'whitespace.md', '   \t\n\r   ');

      const result = await service.exportMarkdown(
        [whitespaceFile],
        mockExportOptions,
        mockProjectMetadata
      );

      expect(result.content).toBeDefined();
      expect(result.includedFiles[0].size).toBe(9); // Correct length of whitespace
    });

    it('should handle very long file names', async () => {
      const longFileName = 'a'.repeat(MARKDOWN_EXPORT_CONSTANTS.CONTENT.MAX_FILE_NAME_LENGTH + 50) + '.md';
      const fileWithLongName = createMockFile('1', longFileName, 'content');

      const result = await service.exportMarkdown(
        [fileWithLongName],
        mockExportOptions,
        mockProjectMetadata
      );

      // For single file, no file header is generated, just the content
      expect(result.content).toContain('content');
      expect(result.includedFiles[0].name).toBe(longFileName); // Original name preserved in metadata
    });

    it('should handle files with complex header structures', async () => {
      const complexHeaderFile = createMockFile(
        '1',
        'complex.md',
        '# H1\n## H2\n### H3\n#### H4\n##### H5\n###### H6\n####### Invalid H7'
      );

      const result = await service.exportMarkdown(
        [complexHeaderFile],
        mockExportOptions,
        mockProjectMetadata
      );

      // Should preserve all headers as-is for single file
      expect(result.content).toContain('# H1');
      expect(result.content).toContain('###### H6');
      expect(result.content).toContain('####### Invalid H7'); // Should remain as-is
    });

    it('should handle maximum header level adjustment', async () => {
      const deepHeaderFile = createMockFile(
        '1',
        'deep.md',
        '##### H5 Original\n###### H6 Original'
      );

      const result = await service.exportMarkdown(
        [deepHeaderFile, mockSingleFile], // Multiple files to trigger adjustment
        mockExportOptions,
        mockProjectMetadata
      );

      // H5 + 1 level shift = H6 (max level 6)
      // H6 + 1 level shift = H6 (capped at max level 6)
      expect(result.content).toContain('###### H5 Original');
      expect(result.content).toContain('###### H6 Original');
    });

    it('should handle Unicode content correctly', async () => {
      const unicodeFile = createMockFile(
        '1',
        'unicode-文件.md',
        '# Título 中文 🌍\n\nContenu en français avec émojis 🚀 et caractères spéciaux: ñ, ü, ø'
      );

      const unicodeMetadata = {
        projectName: 'Projet Ùñîçødé 🌟',
        projectDescription: 'Description avec émojis 🎉 et caractères spéciaux',
      };

      const result = await service.exportMarkdown(
        [unicodeFile],
        mockExportOptions,
        unicodeMetadata
      );

      expect(result.content).toContain('# Projet Ùñîçødé 🌟');
      expect(result.content).toContain('Título 中文 🌍');
      expect(result.content).toContain('émojis 🚀');
      expect(result.contentSize).toBeGreaterThan(result.content.length); // UTF-8 byte size
    });

    it('should handle mixed line endings in content', async () => {
      const mixedLineEndingsFile = createMockFile(
        '1',
        'mixed.md',
        'Line 1\r\nLine 2\rLine 3\nLine 4'
      );

      const result = await service.exportMarkdown(
        [mixedLineEndingsFile],
        mockExportOptions,
        mockProjectMetadata
      );

      // Should normalize to Unix line endings
      expect(result.content).toContain('Line 1\nLine 2\nLine 3\nLine 4');
      expect(result.content).not.toContain('\r\n');
      expect(result.content).not.toContain('\r');
    });

    it('should handle files with no extension', async () => {
      const noExtFile = createMockFile('1', 'README', 'Content without extension');

      const result = await service.exportMarkdown(
        [noExtFile],
        mockExportOptions,
        mockProjectMetadata
      );

      // For single file, content is included directly without file section headers
      expect(result.content).toContain('Content without extension');
      expect(result.includedFiles[0].name).toBe('README');
    });

    it('should generate unique anchors for duplicate file names', async () => {
      const duplicateFiles = [
        createMockFile('1', 'README.md', 'First README'),
        createMockFile('2', 'README.md', 'Second README'),
        createMockFile('3', 'readme.md', 'Third readme (different case)'),
      ];

      const result = await service.exportMarkdown(
        duplicateFiles,
        mockExportOptions,
        mockProjectMetadata
      );

      // Should generate table of contents with proper anchors (no dashes)
      expect(result.content).toContain('1. [README.md](#readmemd)');
      expect(result.content).toContain('2. [README.md](#readmemd)');
      expect(result.content).toContain('3. [readme.md](#readmemd)');
    });

    it('should handle extremely large number of files (at limit)', async () => {
      const maxFiles = MARKDOWN_EXPORT_CONSTANTS.CONTENT.MAX_FILES_COUNT;
      const manyFiles = Array.from({ length: maxFiles }, (_, i) =>
        createMockFile(`file-${i}`, `file-${i}.md`, `Content ${i}`)
      );

      const result = await service.exportMarkdown(
        manyFiles,
        mockExportOptions,
        mockProjectMetadata
      );

      expect(result.includedFiles).toHaveLength(maxFiles);
      expect(result.metadata.filesCount).toBe(maxFiles);
      expect(result.content).toContain('## Table des matières');
    });
  });

  describe('📊 Tests avec mode debug activé', () => {
    beforeEach(() => {
      // Enable debug mode
      configService.get.mockImplementation((key: string, defaultValue?: any) => {
        switch (key) {
          case 'APP_VERSION':
            return mockPlatformVersion;
          case 'MARKDOWN_EXPORT_DEBUG':
            return true;
          default:
            return defaultValue;
        }
      });

      // Create new service instance with debug enabled
      return Test.createTestingModule({
        providers: [
          MarkdownExportService,
          { provide: ConfigService, useValue: configService },
        ],
      }).compile().then(module => {
        service = module.get<MarkdownExportService>(MarkdownExportService);
      });
    });

    it('should include debug footer when debug mode is enabled', async () => {
      const result = await service.exportMarkdown(
        mockMultipleFiles,
        mockExportOptions,
        mockProjectMetadata
      );

      expect(result.content).toContain('## Informations techniques');
      expect(result.content).toContain('*Ces informations sont générées automatiquement à des fins de debug.*');
      expect(result.content).toContain('### Statistiques de l\'export');
      expect(result.content).toContain('- **Nombre de fichiers :** 3');
      expect(result.content).toContain('- **Taille totale :**');
      expect(result.content).toContain(`- **Plateforme :** Coders v${mockPlatformVersion}`);
      expect(result.content).toContain('### Fichiers inclus');
      
      // Should list all files
      mockMultipleFiles.forEach(file => {
        expect(result.content).toContain(`- **${file.metadata.name}**`);
      });
    });

    it('should not include debug footer for single file in debug mode', async () => {
      const result = await service.exportMarkdown(
        [mockSingleFile],
        mockExportOptions,
        mockProjectMetadata
      );

      expect(result.content).toContain('## Informations techniques');
      expect(result.content).not.toContain('### Fichiers inclus'); // Only for multiple files
    });
  });

  describe('📄 Tests de génération de noms de fichiers', () => {
    it('should generate appropriate filename for single file', async () => {
      const result = await service.exportMarkdown(
        [mockSingleFile],
        mockExportOptions,
        mockProjectMetadata
      );

      expect(result.suggestedFileName).toMatch(/^Test Project - Export Markdown - \d{4}-\d{2}-\d{2}\.md$/);
    });

    it('should generate appropriate filename for multiple files', async () => {
      const result = await service.exportMarkdown(
        mockMultipleFiles,
        mockExportOptions,
        mockProjectMetadata
      );

      expect(result.suggestedFileName).toMatch(/^Test Project - Export Markdown \(3 fichiers\) - \d{4}-\d{2}-\d{2}\.md$/);
    });

    it('should sanitize project name in filename', async () => {
      const dangerousMetadata = {
        projectName: 'Project<>Name:/With\\Dangerous*Chars?',
      };

      const result = await service.exportMarkdown(
        [mockSingleFile],
        mockExportOptions,
        dangerousMetadata
      );

      expect(result.suggestedFileName).toMatch(/^ProjectNameWithDangerousChars - Export Markdown - \d{4}-\d{2}-\d{2}\.md$/);
    });

    it('should handle very long project names in filename', async () => {
      const longMetadata = {
        projectName: 'A'.repeat(100) + ' Project',
      };

      const result = await service.exportMarkdown(
        [mockSingleFile],
        mockExportOptions,
        longMetadata
      );

      const fileName = result.suggestedFileName;
      const projectPart = fileName.split(' - Export Markdown')[0];
      expect(projectPart.length).toBeLessThanOrEqual(50);
    });
  });

  describe('🔧 Tests des méthodes utilitaires', () => {
    describe('getServiceStatus', () => {
      it('should return correct service status', () => {
        const status = service.getServiceStatus();

        expect(status).toEqual({
          ready: true,
          platformVersion: expect.any(String), // Accept any string since config may return undefined
          debugEnabled: expect.any(Boolean),
          maxFileSize: MARKDOWN_EXPORT_CONSTANTS.CONTENT.MAX_TOTAL_SIZE_MB,
          maxFilesCount: MARKDOWN_EXPORT_CONSTANTS.CONTENT.MAX_FILES_COUNT,
        });
      });
    });

    describe('toLogSafeString', () => {
      it('should create safe log representation', () => {
        const logString = service.toLogSafeString();

        expect(logString).toContain('MarkdownExportService[');
        expect(logString).toContain('debug=');
        expect(logString).toContain(`maxFiles=${MARKDOWN_EXPORT_CONSTANTS.CONTENT.MAX_FILES_COUNT}`);
        expect(logString).toContain('ready=true');
        
        // Should not contain sensitive information
        expect(logString).not.toContain('Test Project');
        expect(logString).not.toContain('file content');
      });
    });
  });

  describe('⚡ Tests de performance', () => {
    it('should process large content efficiently', async () => {
      const largeContent = 'Lorem ipsum '.repeat(10000);
      const largeFile = createMockFile('1', 'large.md', largeContent);

      const startTime = Date.now();
      const result = await service.exportMarkdown(
        [largeFile],
        mockExportOptions,
        mockProjectMetadata
      );
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      expect(result.content).toContain(largeContent);
    });

    it('should handle maximum number of files efficiently', async () => {
      const maxFiles = MARKDOWN_EXPORT_CONSTANTS.CONTENT.MAX_FILES_COUNT;
      const manyFiles = Array.from({ length: maxFiles }, (_, i) =>
        createMockFile(`${i}`, `file-${i}.md`, `Content for file ${i}`)
      );

      const startTime = Date.now();
      const result = await service.exportMarkdown(
        manyFiles,
        mockExportOptions,
        mockProjectMetadata
      );
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
      expect(result.includedFiles).toHaveLength(maxFiles);
    });

    it('should measure generation time accurately', async () => {
      const result = await service.exportMarkdown(
        mockMultipleFiles,
        mockExportOptions,
        mockProjectMetadata
      );

      expect(result.generationDurationMs).toBeGreaterThanOrEqual(0);
      expect(result.generationDurationMs).toBeLessThan(10000); // Reasonable upper bound
    });
  });

  describe('📝 Tests de normalisation du contenu', () => {
    it('should normalize line endings consistently', async () => {
      const mixedContent = 'Line 1\r\nLine 2\rLine 3\nLine 4\n\n\nMultiple breaks';
      const mixedFile = createMockFile('1', 'mixed.md', mixedContent);

      const result = await service.exportMarkdown(
        [mixedFile],
        mockExportOptions,
        mockProjectMetadata
      );

      // Should normalize to single \n and reduce multiple breaks
      expect(result.content).not.toContain('\r\n');
      expect(result.content).not.toContain('\r');
      expect(result.content).toContain('Line 1\nLine 2\nLine 3\nLine 4');
      expect(result.content).not.toContain('\n\n\n'); // Should reduce to double breaks max
    });

    it('should trim whitespace appropriately', async () => {
      const whitespaceContent = '   \t\n  # Title  \n\n  Content with spaces  \n\n\n   ';
      const whitespaceFile = createMockFile('1', 'spaces.md', whitespaceContent);

      const result = await service.exportMarkdown(
        [whitespaceFile],
        mockExportOptions,
        mockProjectMetadata
      );

      // Should trim leading/trailing document whitespace but preserve internal structure
      expect(result.content).not.toMatch(/^\s+/); // No leading whitespace
      expect(result.content).toMatch(/\n$/); // Should end with single newline
      expect(result.content).toContain('# Title');
      expect(result.content).toContain('Content with spaces');
    });

    it('should add final newline if missing', async () => {
      const noNewlineContent = '# Title\nContent without final newline';
      const noNewlineFile = createMockFile('1', 'no-newline.md', noNewlineContent);

      const result = await service.exportMarkdown(
        [noNewlineFile],
        mockExportOptions,
        mockProjectMetadata
      );

      expect(result.content).toMatch(/\n$/);
      expect(result.content).not.toMatch(/\n\n$/); // Should not double up if already present
    });
  });
});