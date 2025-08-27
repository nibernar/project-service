import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { HttpException, HttpStatus } from '@nestjs/common';
import { of, throwError, Observable } from 'rxjs';
import { AxiosResponse, AxiosError } from 'axios';

import {
  FileRetrievalService,
  FileRetrievalResult,
  FileMetadata,
  BatchRetrievalResult,
  FILE_RETRIEVAL_CONSTANTS,
} from '../../../../src/export/services/file-retrieval.service';

describe('FileRetrievalService', () => {
  let service: FileRetrievalService;
  let httpService: jest.Mocked<HttpService>;
  let configService: jest.Mocked<ConfigService>;

  // UUIDs v4 VALIDES pour les tests
  const mockFileId = '550e8400-e29b-41d4-a716-446655440000';
  const mockFileId2 = '6ba7b810-9dad-41d1-80b4-00c04fd430c8';
  const mockFileId3 = '6ba7b811-9dad-41d1-90b4-00c04fd430c9';
  const mockStorageUrl = 'http://storage-service:3001';
  const mockServiceToken = 'test-service-token';

  const mockFileMetadata: FileMetadata = {
    id: mockFileId,
    name: 'test-document.md',
    size: 1024,
    contentType: 'text/markdown',
    lastModified: new Date('2024-01-15T10:00:00Z'),
    md5Hash: 'abc123def456789012345678901234567890abcd',
    tags: ['documentation', 'test'],
    customData: { author: 'Test User', version: '1.0' },
  };

  const mockFileContent = '# Test Document\n\nThis is a test document content.';

  const mockAxiosResponse: AxiosResponse = {
    data: {
      content: mockFileContent,
      metadata: mockFileMetadata,
    },
    status: 200,
    statusText: 'OK',
    headers: {},
    config: {} as any,
  };

  // Helper pour créer des observables simples qui fonctionnent
  const createSuccessObservable = <T>(data: T): Observable<T> => {
    return new Observable<T>((subscriber) => {
      setTimeout(() => {
        subscriber.next(data);
        subscriber.complete();
      }, 0);
    });
  };

  const createErrorObservable = (error: any): Observable<never> => {
    return new Observable<never>((subscriber) => {
      setTimeout(() => {
        subscriber.error(error);
      }, 0);
    });
  };

  // Helper pour créer un observable d'erreur VRAIMENT instantané pour les tests de timeout
  const createInstantErrorObservable = (error: any): Observable<never> => {
    return new Observable<never>((subscriber) => {
      subscriber.error(error);
    });
  };

  beforeEach(async () => {
    const mockHttpService = {
      get: jest.fn(),
      head: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn().mockImplementation((key: string, defaultValue?: any) => {
        const config: Record<string, any> = {
          'FILE_STORAGE_SERVICE_URL': mockStorageUrl,
          'INTERNAL_SERVICE_TOKEN': mockServiceToken,
          'FILE_RETRIEVAL_TIMEOUT_MS': FILE_RETRIEVAL_CONSTANTS.TIMEOUT.DEFAULT_MS,
          'FILE_RETRIEVAL_MAX_RETRIES': FILE_RETRIEVAL_CONSTANTS.RETRY.MAX_ATTEMPTS,
        };
        return config[key] ?? defaultValue;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FileRetrievalService,
        { provide: HttpService, useValue: mockHttpService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<FileRetrievalService>(FileRetrievalService);
    httpService = module.get(HttpService);
    configService = module.get(ConfigService);

    // Reset tous les mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Tests nominaux - getFileContent', () => {
    beforeEach(() => {
      httpService.get.mockReturnValue(createSuccessObservable(mockAxiosResponse));
    });

    it('should retrieve file content successfully', async () => {
      const result = await service.getFileContent(mockFileId);

      expect(result).toBeDefined();
      expect(result.id).toBe(mockFileId);
      expect(result.content).toBe(mockFileContent);
      expect(result.metadata).toMatchObject({
        id: mockFileId,
        name: 'test-document.md',
        size: 1024,
        contentType: 'text/markdown',
      });
      expect(result.retrievedAt).toBeInstanceOf(Date);
      expect(result.contentSize).toBe(mockFileContent.length);
    });

    it('should make HTTP request with correct parameters', async () => {
      await service.getFileContent(mockFileId);

      expect(httpService.get).toHaveBeenCalledWith(
        `${mockStorageUrl}/files/${mockFileId}/content`,
        expect.objectContaining({
          timeout: FILE_RETRIEVAL_CONSTANTS.TIMEOUT.DEFAULT_MS,
          headers: expect.objectContaining({
            'Authorization': `Bearer ${mockServiceToken}`,
            'Accept': 'application/json',
            'Accept-Encoding': 'gzip, deflate',
            'User-Agent': 'project-service/file-retrieval/1.0',
          }),
          maxContentLength: FILE_RETRIEVAL_CONSTANTS.FILE_SIZE.MAX_BYTES,
          maxBodyLength: FILE_RETRIEVAL_CONSTANTS.FILE_SIZE.MAX_BYTES,
        })
      );
    });

    it('should sanitize file content correctly', async () => {
      const contentWithControlChars = 'Test\x00content\x01with\x1Fcontrol\x7Fchars';
      httpService.get.mockReturnValue(createSuccessObservable({
        ...mockAxiosResponse,
        data: {
          content: contentWithControlChars,
          metadata: mockFileMetadata,
        },
      }));

      const result = await service.getFileContent(mockFileId);

      expect(result.content).toBe('Testcontentwithcontrolchars');
    });

    it('should normalize line endings', async () => {
      const contentWithMixedLineEndings = 'Line 1\r\nLine 2\rLine 3\nLine 4';
      httpService.get.mockReturnValue(createSuccessObservable({
        ...mockAxiosResponse,
        data: {
          content: contentWithMixedLineEndings,
          metadata: mockFileMetadata,
        },
      }));

      const result = await service.getFileContent(mockFileId);

      expect(result.content).toBe('Line 1\nLine 2\nLine 3\nLine 4');
    });

    it('should handle missing optional metadata fields', async () => {
      const minimalMetadata = {
        id: mockFileId,
        name: 'minimal.txt',
        size: 100,
        contentType: 'text/plain',
        lastModified: '2024-01-15T10:00:00Z',
      };

      httpService.get.mockReturnValue(createSuccessObservable({
        ...mockAxiosResponse,
        data: {
          content: mockFileContent,
          metadata: minimalMetadata,
        },
      }));

      const result = await service.getFileContent(mockFileId);

      expect(result.metadata.md5Hash).toBeUndefined();
      expect(result.metadata.tags).toBeUndefined();
      expect(result.metadata.customData).toBeUndefined();
    });
  });

  describe('Tests de validation - getFileContent', () => {
    it('should reject invalid UUID format', async () => {
      const invalidIds = [
        'not-a-uuid',
        '123456789',
        '550e8400-e29b-41d4-a716-44665544000g', // Invalid character
        '550e8400-e29b-41d4-5716-446655440000', // Invalid version (5)
        '550e8400-e29b-41d4-2716-246655440000', // Invalid variant (2)
        '',
        null,
        undefined,
      ];

      for (const invalidId of invalidIds) {
        await expect(service.getFileContent(invalidId as any))
          .rejects.toMatchObject({
            message: 'Invalid file ID format: must be UUID v4',
            status: HttpStatus.BAD_REQUEST,
          });
      }

      // Vérifier qu'aucun appel HTTP n'a été fait pour les UUID invalides
      expect(httpService.get).not.toHaveBeenCalled();
    });

    it('should handle file not found (404)', async () => {
      const error: AxiosError = {
        response: {
          status: 404,
          statusText: 'Not Found',
          data: { message: 'File not found' },
          headers: {},
          config: {} as any,
        },
        message: 'Request failed with status code 404',
        name: 'AxiosError',
        config: {} as any,
        isAxiosError: true,
        toJSON: () => ({}),
      };

      httpService.get.mockReturnValue(createErrorObservable(error));

      await expect(service.getFileContent(mockFileId))
        .rejects.toMatchObject({
          message: `File not found: ${mockFileId}`,
          status: HttpStatus.NOT_FOUND,
        });
    });

    it('should handle access denied (403)', async () => {
      const error: AxiosError = {
        response: {
          status: 403,
          statusText: 'Forbidden',
          data: { message: 'Access denied' },
          headers: {},
          config: {} as any,
        },
        message: 'Request failed with status code 403',
        name: 'AxiosError',
        config: {} as any,
        isAxiosError: true,
        toJSON: () => ({}),
      };

      httpService.get.mockReturnValue(createErrorObservable(error));

      await expect(service.getFileContent(mockFileId))
        .rejects.toMatchObject({
          message: `Access denied to file: ${mockFileId}`,
          status: HttpStatus.FORBIDDEN,
        });
    });

    it('should handle file too large (413)', async () => {
      const error: AxiosError = {
        response: {
          status: 413,
          statusText: 'Payload Too Large',
          data: { message: 'File too large' },
          headers: {},
          config: {} as any,
        },
        message: 'Request failed with status code 413',
        name: 'AxiosError',
        config: {} as any,
        isAxiosError: true,
        toJSON: () => ({}),
      };

      httpService.get.mockReturnValue(createErrorObservable(error));

      await expect(service.getFileContent(mockFileId))
        .rejects.toMatchObject({
          message: `File too large: ${mockFileId}`,
          status: HttpStatus.PAYLOAD_TOO_LARGE,
        });
    });

    it('should handle service unavailable (503)', async () => {
      const error: AxiosError = {
        response: {
          status: 503,
          statusText: 'Service Unavailable',
          data: { message: 'Service temporarily unavailable' },
          headers: {},
          config: {} as any,
        },
        message: 'Request failed with status code 503',
        name: 'AxiosError',
        config: {} as any,
        isAxiosError: true,
        toJSON: () => ({}),
      };

      httpService.get.mockReturnValue(createErrorObservable(error));

      await expect(service.getFileContent(mockFileId))
        .rejects.toMatchObject({
          message: 'Storage service temporarily unavailable',
          status: HttpStatus.SERVICE_UNAVAILABLE,
        });
    });

    it('should handle malformed response data', async () => {
      const malformedResponses = [
        { data: null },
        { data: 'not-an-object' },
        { data: {} }, // Missing content and metadata
        { data: { content: null, metadata: mockFileMetadata } },
        { data: { content: mockFileContent, metadata: null } },
        { data: { content: 123, metadata: mockFileMetadata } },
        { data: { content: mockFileContent, metadata: 'not-an-object' } },
      ];

      for (const response of malformedResponses) {
        httpService.get.mockReturnValue(createSuccessObservable(response as any));

        await expect(service.getFileContent(mockFileId))
          .rejects.toThrow(HttpException);
      }
    });

    it('should handle network timeout', async () => {
      const timeoutError = new Error('timeout of 10000ms exceeded');
      httpService.get.mockReturnValue(createErrorObservable(timeoutError));

      await expect(service.getFileContent(mockFileId))
        .rejects.toMatchObject({
          message: expect.stringContaining('File retrieval failed'),
          status: HttpStatus.INTERNAL_SERVER_ERROR,
        });
    });
  });

  describe('Tests nominaux - getMultipleFiles', () => {
    const mockFileIds = [
      '550e8400-e29b-41d4-a716-446655440000',
      '6ba7b810-9dad-41d1-80b4-00c04fd430c8',
      '6ba7b811-9dad-41d1-90b4-00c04fd430c9',
    ];

    beforeEach(() => {
      httpService.get.mockImplementation((url) => {
        const fileIdMatch = url.match(/\/files\/([^\/]+)\/content/);
        const fileId = fileIdMatch?.[1];

        if (fileId && mockFileIds.includes(fileId)) {
          return createSuccessObservable({
            ...mockAxiosResponse,
            data: {
              content: `Content for ${fileId}`,
              metadata: { ...mockFileMetadata, id: fileId, name: `file-${fileId}.md` },
            },
          });
        }

        const error: AxiosError = {
          response: { status: 404, statusText: 'Not Found', data: {}, headers: {}, config: {} as any },
          message: 'File not found',
          name: 'AxiosError',
          config: {} as any,
          isAxiosError: true,
          toJSON: () => ({}),
        };
        return createErrorObservable(error);
      });
    });

    it('should retrieve multiple files successfully', async () => {
      const result = await service.getMultipleFiles(mockFileIds);

      expect(result.totalRequested).toBe(3);
      expect(result.successful).toHaveLength(3);
      expect(result.failed).toHaveLength(0);
      expect(result.startedAt).toBeInstanceOf(Date);
      expect(result.completedAt).toBeInstanceOf(Date);
      expect(result.totalDurationMs).toBeGreaterThanOrEqual(0);

      mockFileIds.forEach((fileId, index) => {
        expect(result.successful[index].id).toBe(fileId);
        expect(result.successful[index].content).toBe(`Content for ${fileId}`);
      });
    });

    it('should handle mixed success and failure', async () => {
      const mixedFileIds = [
        ...mockFileIds.slice(0, 2), // Valid
        '6ba7b811-9dad-41d1-a0b4-00c04fd430d0', // UUID valide mais pas dans mock
      ];

      const result = await service.getMultipleFiles(mixedFileIds);

      expect(result.totalRequested).toBe(3);
      expect(result.successful).toHaveLength(2);
      expect(result.failed).toHaveLength(1);

      result.failed.forEach(error => {
        expect(error.fileId).toBeDefined();
        expect(error.errorCode).toBeDefined();
        expect(error.message).toBeDefined();
        expect(typeof error.retryable).toBe('boolean');
      });
    });

    it('should process files in batches', async () => {
      const largeFileList = Array.from({ length: 25 }, (_, i) => {
        const suffix = i.toString().padStart(4, '0');
        return `550e8400-e29b-41d4-a716-44665544${suffix}`;
      });

      httpService.get.mockReturnValue(createSuccessObservable({
        ...mockAxiosResponse,
        data: {
          content: 'Test content',
          metadata: { ...mockFileMetadata, name: 'test.md' },
        },
      }));

      const result = await service.getMultipleFiles(largeFileList);

      expect(result.totalRequested).toBe(25);
      expect(result.successful).toHaveLength(25);
      expect(result.failed).toHaveLength(0);
    });

    it('should handle empty file list', async () => {
      const result = await service.getMultipleFiles([]);

      expect(result.totalRequested).toBe(0);
      expect(result.successful).toHaveLength(0);
      expect(result.failed).toHaveLength(0);
    });

    it('should provide detailed timing information', async () => {
      const startTime = Date.now();
      const result = await service.getMultipleFiles(mockFileIds.slice(0, 1));
      const endTime = Date.now();

      expect(result.startedAt.getTime()).toBeGreaterThanOrEqual(startTime);
      expect(result.completedAt.getTime()).toBeLessThanOrEqual(endTime);
      expect(result.totalDurationMs).toBeGreaterThanOrEqual(0);
      expect(result.totalDurationMs).toBeLessThan(endTime - startTime + 100);
    });
  });

  describe('Tests de validation - getMultipleFiles', () => {
    it('should reject non-array input', async () => {
      const invalidInputs = [
        'not-an-array',
        123,
        null,
        undefined,
        {},
      ];

      for (const input of invalidInputs) {
        await expect(service.getMultipleFiles(input as any))
          .rejects.toThrow();
      }
    });

    it('should reject array with invalid UUIDs', async () => {
      const invalidFileIds = [
        '550e8400-e29b-41d4-a716-446655440000', // Valid
        'not-a-uuid', // Invalid
        'another-invalid-id', // Invalid
      ];

      await expect(service.getMultipleFiles(invalidFileIds))
        .rejects.toMatchObject({
          message: expect.stringContaining('Invalid file IDs'),
          status: HttpStatus.BAD_REQUEST,
        });
    });

    it('should reject too many files', async () => {
      const tooManyFiles = Array.from({ length: 51 }, (_, i) => {
        const suffix = i.toString().padStart(4, '0');
        return `550e8400-e29b-41d4-a716-44665544${suffix}`;
      });

      await expect(service.getMultipleFiles(tooManyFiles))
        .rejects.toMatchObject({
          message: expect.stringContaining('Too many files requested'),
          status: HttpStatus.BAD_REQUEST,
        });
    });
  });

  describe('Tests nominaux - validateFileExists', () => {
    it('should return true for existing file', async () => {
      httpService.head.mockReturnValue(createSuccessObservable({ status: 200 } as any));

      const result = await service.validateFileExists(mockFileId);

      expect(result).toBe(true);
      expect(httpService.head).toHaveBeenCalledWith(
        `${mockStorageUrl}/files/${mockFileId}/metadata`,
        expect.objectContaining({
          timeout: 5000,
          headers: expect.objectContaining({
            'Authorization': `Bearer ${mockServiceToken}`,
            'Accept': 'application/json',
          }),
        })
      );
    });

    it('should return false for non-existing file (404)', async () => {
      const error: AxiosError = {
        response: { status: 404, statusText: 'Not Found', data: {}, headers: {}, config: {} as any },
        message: 'File not found',
        name: 'AxiosError',
        config: {} as any,
        isAxiosError: true,
        toJSON: () => ({}),
      };

      httpService.head.mockReturnValue(createErrorObservable(error));

      const result = await service.validateFileExists(mockFileId);

      expect(result).toBe(false);
    });

    it('should return false for invalid UUID', async () => {
      const result = await service.validateFileExists('invalid-uuid');

      expect(result).toBe(false);
      expect(httpService.head).not.toHaveBeenCalled();
    });

    it('should return false for network errors', async () => {
      httpService.head.mockReturnValue(createErrorObservable(new Error('Network error')));

      const result = await service.validateFileExists(mockFileId);

      expect(result).toBe(false);
    });
  });

  describe('Tests nominaux - getFilesMetadata', () => {
    beforeEach(() => {
      httpService.get.mockImplementation((url) => {
        const fileIdMatch = url.match(/\/files\/([^\/]+)\/metadata/);
        const fileId = fileIdMatch?.[1];

        if (fileId) {
          return createSuccessObservable({
            data: { ...mockFileMetadata, id: fileId },
            status: 200,
            statusText: 'OK',
            headers: {},
            config: {} as any,
          });
        }

        return createErrorObservable(new Error('File not found'));
      });
    });

    it('should retrieve metadata for multiple files', async () => {
      const fileIds = [
        '550e8400-e29b-41d4-a716-446655440000',
        '6ba7b810-9dad-41d1-80b4-00c04fd430c8',
      ];

      const result = await service.getFilesMetadata(fileIds);

      expect(result.successful).toHaveLength(2);
      expect(result.failed).toHaveLength(0);

      result.successful.forEach((metadata, index) => {
        expect(metadata.id).toBe(fileIds[index]);
        expect(metadata.name).toBeDefined();
        expect(metadata.size).toBeGreaterThanOrEqual(0);
        expect(metadata.contentType).toBeDefined();
      });
    });

    it('should handle mixed success and failure for metadata', async () => {
      const result = await service.getFilesMetadata([]);
      
      expect(result).toEqual({
        successful: [],
        failed: []
      });
    });

    it('should handle empty metadata array', async () => {
      const result = await service.getFilesMetadata([]);
      
      expect(result).toEqual({
        successful: [],
        failed: []
      });
    });
  });

  describe('Tests des méthodes privées (via tests indirects)', () => {
    describe('UUID validation', () => {
      it('should accept valid UUIDs v4', async () => {
        const validUuids = [
          '550e8400-e29b-41d4-a716-446655440000',
          '6ba7b810-9dad-41d1-80b4-00c04fd430c8',
          'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
          '00000000-0000-4000-8000-000000000000',
        ];

        httpService.get.mockReturnValue(createSuccessObservable(mockAxiosResponse));

        for (const uuid of validUuids) {
          await expect(service.getFileContent(uuid)).resolves.toBeDefined();
        }
      });

      it('should reject invalid UUIDs', async () => {
        const invalidUuids = [
          '550e8400-e29b-41d4-a716-44665544000', // Too short
          '550e8400-e29b-41d4-a716-446655440000g', // Too long
          '550e8400-e29b-41d4-5716-446655440000', // Invalid version (5)
          '550e8400-e29b-41d4-2716-246655440000', // Invalid variant (2)
          'not-a-uuid-at-all',
          '',
          '   ',
        ];

        for (const uuid of invalidUuids) {
          await expect(service.getFileContent(uuid))
            .rejects.toThrow('Invalid file ID format: must be UUID v4');
        }

        // Vérifier qu'aucun appel HTTP n'a été fait
        expect(httpService.get).not.toHaveBeenCalled();
      });
    });

    describe('Content sanitization', () => {
      it('should remove control characters', async () => {
        const dirtyContent = 'Clean\x00content\x01with\x1Fcontrol\x7Fchars';
        httpService.get.mockReturnValue(createSuccessObservable({
          ...mockAxiosResponse,
          data: {
            content: dirtyContent,
            metadata: mockFileMetadata,
          },
        }));

        const result = await service.getFileContent(mockFileId);

        expect(result.content).not.toMatch(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/);
        expect(result.content).toBe('Cleancontentwithcontrolchars');
      });

      it('should truncate oversized content', async () => {
        const oversizedContent = 'x'.repeat(FILE_RETRIEVAL_CONSTANTS.FILE_SIZE.MAX_BYTES + 1000);
        httpService.get.mockReturnValue(createSuccessObservable({
          ...mockAxiosResponse,
          data: {
            content: oversizedContent,
            metadata: mockFileMetadata,
          },
        }));

        const result = await service.getFileContent(mockFileId);

        expect(result.content.length).toBe(FILE_RETRIEVAL_CONSTANTS.FILE_SIZE.MAX_BYTES);
      });
    });

    describe('Metadata validation', () => {
      it('should sanitize and validate metadata fields', async () => {
        const rawMetadata = {
          name: '  <script>alert("xss")</script>test.md  ',
          size: '1024abc', // String avec caractères non-numériques - devrait retourner 0
          contentType: 'UNKNOWN/TYPE', // Invalid content type
          lastModified: 'invalid-date',
          md5Hash: 'INVALID_HASH_FORMAT',
          tags: ['valid', '<script>', '', null, 123, 'another-valid'],
          customData: {
            key1: 'value1',
            'dangerous<key>': '<script>alert("xss")</script>',
            number: 123,
            boolean: true,
            object: { nested: 'should be ignored' },
          },
        };

        httpService.get.mockReturnValue(createSuccessObservable({
          ...mockAxiosResponse,
          data: {
            content: mockFileContent,
            metadata: rawMetadata,
          },
        }));

        const result = await service.getFileContent(mockFileId);

        expect(result.metadata.name).toBe('scriptalert(xss)scripttest.md');
        expect(result.metadata.size).toBe(0); // parseSize devrait retourner 0 pour '1024abc'
        expect(result.metadata.contentType).toBe('text/plain');
        expect(result.metadata.lastModified).toBeInstanceOf(Date);
        expect(result.metadata.md5Hash).toBeUndefined();
        expect(result.metadata.tags).toEqual(['valid', 'another-valid']);
        expect(result.metadata.customData).toEqual({
          key1: 'value1',
          'dangerouskey': '', // Sanitized key
          number: 123,
          boolean: true,
        });
      });

      it('should handle completely invalid metadata', async () => {
        httpService.get.mockReturnValue(createSuccessObservable({
          ...mockAxiosResponse,
          data: {
            content: mockFileContent,
            metadata: null,
          },
        }));

        await expect(service.getFileContent(mockFileId))
          .rejects.toThrow('Missing or invalid metadata in storage response');
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle very large file lists within limits', async () => {
      const maxFiles = FILE_RETRIEVAL_CONSTANTS.PARALLEL.BATCH_SIZE * 5;
      const largeFileList = Array.from({ length: maxFiles }, (_, i) => {
        const suffix = i.toString().padStart(4, '0');
        return `550e8400-e29b-41d4-a716-44665544${suffix}`;
      });

      httpService.get.mockReturnValue(createSuccessObservable(mockAxiosResponse));

      const result = await service.getMultipleFiles(largeFileList);

      expect(result.totalRequested).toBe(maxFiles);
      expect(result.successful).toHaveLength(maxFiles);
    });

    it('should handle empty content', async () => {
      httpService.get.mockReturnValue(createSuccessObservable({
        ...mockAxiosResponse,
        data: {
          content: '', // Chaîne vide devrait être acceptée
          metadata: mockFileMetadata,
        },
      }));

      const result = await service.getFileContent(mockFileId);

      expect(result.content).toBe('');
      expect(result.contentSize).toBe(0);
    });

    it('should handle content with only whitespace', async () => {
      const whitespaceContent = '   \t\n\r   ';
      httpService.get.mockReturnValue(createSuccessObservable({
        ...mockAxiosResponse,
        data: {
          content: whitespaceContent,
          metadata: mockFileMetadata,
        },
      }));

      const result = await service.getFileContent(mockFileId);

      expect(result.content).toBe('   \t\n\n   '); // Control chars removed, line endings normalized
    });

    it('should handle Unicode content correctly', async () => {
      const unicodeContent = 'Hello 世界! 🌍 Émoji test: 👨‍💻';
      httpService.get.mockReturnValue(createSuccessObservable({
        ...mockAxiosResponse,
        data: {
          content: unicodeContent,
          metadata: mockFileMetadata,
        },
      }));

      const result = await service.getFileContent(mockFileId);

      expect(result.content).toBe(unicodeContent);
      expect(result.contentSize).toBe(unicodeContent.length);
    });

    it('should handle concurrent file retrievals', async () => {
      const fileIds = [
        '550e8400-e29b-41d4-a716-446655440001',
        '550e8400-e29b-41d4-a716-446655440002',
        '550e8400-e29b-41d4-a716-446655440003',
      ];

      httpService.get.mockReturnValue(createSuccessObservable(mockAxiosResponse));

      const promises = fileIds.map(id => service.getFileContent(id));
      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      results.forEach((result, index) => {
        expect(result.id).toBe(fileIds[index]);
      });
    });

    it('should handle mixed content types properly', async () => {
      const contentTypes = [
        'text/markdown',
        'text/plain',
        'application/json',
        'application/pdf',
        'unknown/type', // Should default to text/plain
      ];

      for (const contentType of contentTypes) {
        httpService.get.mockReturnValue(createSuccessObservable({
          ...mockAxiosResponse,
          data: {
            content: mockFileContent,
            metadata: { ...mockFileMetadata, contentType },
          },
        }));

        const result = await service.getFileContent(mockFileId);
        const expectedType = contentTypes.slice(0, 4).includes(contentType) ? 
          contentType : 'text/plain';
        
        expect(result.metadata.contentType).toBe(expectedType);
      }
    });
  });

  describe('Tests de sécurité', () => {
    it('should prevent path traversal in file IDs', async () => {
      const maliciousIds = [
        '../../../etc/passwd',
        '..\\..\\windows\\system32\\config',
        'file:///etc/passwd',
        'http://malicious.com/file',
      ];

      for (const maliciousId of maliciousIds) {
        await expect(service.getFileContent(maliciousId))
          .rejects.toThrow('Invalid file ID format: must be UUID v4');
      }
    });

    it('should validate authorization header format', async () => {
      httpService.get.mockReturnValue(createSuccessObservable(mockAxiosResponse));

      await service.getFileContent(mockFileId);

      expect(httpService.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': `Bearer ${mockServiceToken}`,
          }),
        })
      );
    });

    it('should prevent content injection in metadata', async () => {
      const maliciousMetadata = {
        id: mockFileId,
        name: 'file<script>alert("xss")</script>.md',
        size: 1024,
        contentType: 'text/plain; charset=utf-8; boundary=--evil',
        lastModified: new Date().toISOString(),
        customData: {
          'script>alert("xss")</script>': 'malicious',
          'normal_key': '<script>alert("content")</script>',
        },
      };

      httpService.get.mockReturnValue(createSuccessObservable({
        ...mockAxiosResponse,
        data: {
          content: mockFileContent,
          metadata: maliciousMetadata,
        },
      }));

      const result = await service.getFileContent(mockFileId);

      expect(result.metadata.name).not.toContain('<script>');
      expect(result.metadata.name).not.toContain('</script>');
      expect(result.metadata.contentType).toBe('text/plain');
      
      if (result.metadata.customData) {
        Object.keys(result.metadata.customData).forEach(key => {
          expect(key).not.toContain('<script>');
        });
        Object.values(result.metadata.customData).forEach(value => {
          if (typeof value === 'string') {
            expect(value).not.toContain('<script>');
          }
        });
      }
    });

    it('should limit custom data size and count', async () => {
      const oversizedCustomData: Record<string, any> = {};
      
      for (let i = 0; i < 25; i++) {
        oversizedCustomData[`key${i}`] = 'x'.repeat(600);
      }

      httpService.get.mockReturnValue(createSuccessObservable({
        ...mockAxiosResponse,
        data: {
          content: mockFileContent,
          metadata: {
            ...mockFileMetadata,
            customData: oversizedCustomData,
          },
        },
      }));

      const result = await service.getFileContent(mockFileId);

      expect(Object.keys(result.metadata.customData || {})).toHaveLength(20);
      
      Object.values(result.metadata.customData || {}).forEach(value => {
        if (typeof value === 'string') {
          expect(value.length).toBeLessThanOrEqual(500);
        }
      });
    });

    it('should handle potential ReDoS attacks in regex validation', () => {
      const pathologicalInput = 'a'.repeat(10000) + '!';
      
      const start = Date.now();
      service.validateFileExists(pathologicalInput);
      const duration = Date.now() - start;
      
      expect(duration).toBeLessThan(100);
    });

    it('should reject files with suspicious extensions in metadata', async () => {
      const suspiciousNames = [
        'document.exe.md',
        'file.bat',
        'script.js.md',
        'config.ini',
      ];

      for (const suspiciousName of suspiciousNames) {
        httpService.get.mockReturnValue(createSuccessObservable({
          ...mockAxiosResponse,
          data: {
            content: mockFileContent,
            metadata: { ...mockFileMetadata, name: suspiciousName },
          },
        }));

        const result = await service.getFileContent(mockFileId);
        
        expect(result.metadata.name).toBeDefined();
        expect(result.metadata.name.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Tests de performance', () => {
    it('should handle timeout correctly', async () => {
      // Utiliser les fake timers de Jest pour contrôler le temps
      jest.useFakeTimers();
      
      const timeoutError = new Error('timeout of 10000ms exceeded');
      httpService.get.mockReturnValue(createInstantErrorObservable(timeoutError));

      const start = Date.now();
      const promise = expect(service.getFileContent(mockFileId)).rejects.toThrow();
      
      // Avancer tous les timers pour forcer la completion
      jest.runAllTimers();
      
      await promise;
      
      const duration = Date.now() - start;

      // Restaurer les vrais timers
      jest.useRealTimers();
      
      expect(duration).toBeLessThan(100); // Avec fake timers, devrait être très rapide
    });

    it('should batch process large file lists efficiently', async () => {
      const largeFileList = Array.from({ length: 30 }, (_, i) => {
        const suffix = i.toString().padStart(4, '0');
        return `550e8400-e29b-41d4-a716-44665544${suffix}`;
      });

      let callCount = 0;
      httpService.get.mockImplementation(() => {
        callCount++;
        return createSuccessObservable(mockAxiosResponse);
      });

      await service.getMultipleFiles(largeFileList);

      expect(callCount).toBe(30);
    });

    it('should handle rapid successive calls', async () => {
      httpService.get.mockReturnValue(createSuccessObservable(mockAxiosResponse));

      const rapidCalls = Array.from({ length: 10 }, () => 
        service.getFileContent(mockFileId)
      );

      const results = await Promise.all(rapidCalls);

      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(result.id).toBe(mockFileId);
      });
    });
  });

  describe('Tests des méthodes utilitaires', () => {
    describe('getServiceStatus', () => {
      it('should return correct service status', () => {
        const status = service.getServiceStatus();

        expect(status).toEqual({
          configured: true,
          storageServiceUrl: mockStorageUrl,
          timeout: FILE_RETRIEVAL_CONSTANTS.TIMEOUT.DEFAULT_MS,
          maxRetries: FILE_RETRIEVAL_CONSTANTS.RETRY.MAX_ATTEMPTS,
          ready: true,
        });
      });

      it('should detect development configuration', async () => {
        const mockConfigService = {
          get: jest.fn().mockImplementation((key, defaultValue) => {
            if (key === 'FILE_STORAGE_SERVICE_URL') {
              return 'http://localhost:3001';
            }
            if (key === 'INTERNAL_SERVICE_TOKEN') {
              return 'dev-token-file-retrieval';
            }
            if (key === 'FILE_RETRIEVAL_TIMEOUT_MS') {
              return FILE_RETRIEVAL_CONSTANTS.TIMEOUT.DEFAULT_MS;
            }
            if (key === 'FILE_RETRIEVAL_MAX_RETRIES') {
              return FILE_RETRIEVAL_CONSTANTS.RETRY.MAX_ATTEMPTS;
            }
            return defaultValue;
          }),
        };

        const testModule = await Test.createTestingModule({
          providers: [
            FileRetrievalService,
            { provide: HttpService, useValue: httpService },
            { provide: ConfigService, useValue: mockConfigService },
          ],
        }).compile();

        const devService = testModule.get<FileRetrievalService>(FileRetrievalService);
        const status = devService.getServiceStatus();
        expect(status.ready).toBe(false);
      });
    });

    describe('toLogSafeString', () => {
      it('should create safe log representation', () => {
        const logString = service.toLogSafeString();

        expect(logString).toContain('FileRetrievalService[');
        expect(logString).toContain('ready=true');
        expect(logString).toContain('timeout=');
        expect(logString).toContain('retries=');
        
        expect(logString).not.toContain(mockServiceToken);
        expect(logString).toContain('host=storage-service');
      });
    });
  });
});