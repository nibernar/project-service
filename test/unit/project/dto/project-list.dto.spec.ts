import { plainToInstance, Transform } from 'class-transformer';
import { validate } from 'class-validator';
import { ProjectListItemDto } from '../../../../src/project/dto/project-list.dto';
import { ProjectStatus } from '../../../../src/common/enums/project-status.enum';

describe('ProjectListItemDto', () => {
  let validDto: ProjectListItemDto;
  let baseDate: Date;
  let updatedDate: Date;

  beforeEach(() => {
    baseDate = new Date('2024-08-01T10:00:00Z');
    updatedDate = new Date('2024-08-08T14:30:00Z');

    validDto = plainToInstance(ProjectListItemDto, {
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Test Project',
      description: 'A test project description',
      status: ProjectStatus.ACTIVE,
      createdAt: baseDate,
      updatedAt: updatedDate,
      uploadedFilesCount: 3,
      generatedFilesCount: 5,
      hasStatistics: true,
      totalCost: 12.45,
    });
  });

  describe('Validation des propriétés de base', () => {
    it('should create a valid DTO with all required properties', () => {
      expect(validDto).toBeDefined();
      expect(validDto.id).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(validDto.name).toBe('Test Project');
      expect(validDto.description).toBe('A test project description');
      expect(validDto.status).toBe(ProjectStatus.ACTIVE);
      expect(validDto.createdAt).toEqual(baseDate);
      expect(validDto.updatedAt).toEqual(updatedDate);
      expect(validDto.uploadedFilesCount).toBe(3);
      expect(validDto.generatedFilesCount).toBe(5);
      expect(validDto.hasStatistics).toBe(true);
      expect(validDto.totalCost).toBe(12.45);
    });

    it('should handle optional properties correctly', () => {
      const dtoWithoutOptionals = plainToInstance(ProjectListItemDto, {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Mobile App Backend API',
        status: ProjectStatus.ACTIVE,
        createdAt: baseDate,
        updatedAt: updatedDate,
        uploadedFilesCount: 0,
        generatedFilesCount: 0,
        hasStatistics: false,
      });

      expect(dtoWithoutOptionals.description).toBeUndefined();
      expect(dtoWithoutOptionals.totalCost).toBeUndefined();
    });

    it('should validate enum values for status', () => {
      Object.values(ProjectStatus).forEach((status) => {
        const dto = plainToInstance(ProjectListItemDto, {
          ...validDto,
          status,
        });
        expect(dto.status).toBe(status);
      });
    });

    it('should handle Date objects correctly', () => {
      expect(validDto.createdAt).toBeInstanceOf(Date);
      expect(validDto.updatedAt).toBeInstanceOf(Date);
      expect(validDto.createdAt.getTime()).toBe(baseDate.getTime());
      expect(validDto.updatedAt.getTime()).toBe(updatedDate.getTime());
    });
  });

  describe('Tests des transformations (@Transform)', () => {
    describe('uploadedFilesCount transformation', () => {
      it('should use predefined numeric value', () => {
        const dto = plainToInstance(ProjectListItemDto, {
          ...validDto,
          uploadedFilesCount: 7,
        });
        expect(dto.uploadedFilesCount).toBe(7);
      });

      it('should calculate from array if provided', () => {
        const dto = plainToInstance(ProjectListItemDto, {
          ...validDto,
          uploadedFileIds: ['specs.pdf', 'wireframes.png', 'requirements.docx'],
          uploadedFilesCount: undefined,
        });
        expect(dto.uploadedFilesCount).toBe(3);
      });

      it('should return 0 for negative values', () => {
        const dto = plainToInstance(ProjectListItemDto, {
          ...validDto,
          uploadedFilesCount: -5,
        });
        expect(dto.uploadedFilesCount).toBe(0);
      });

      it('should floor decimal values', () => {
        const dto = plainToInstance(ProjectListItemDto, {
          ...validDto,
          uploadedFilesCount: 3.7,
        });
        expect(dto.uploadedFilesCount).toBe(3);
      });

      it('should default to 0 when no data available', () => {
        const dto = plainToInstance(ProjectListItemDto, {
          ...validDto,
          uploadedFilesCount: undefined,
          uploadedFileIds: undefined,
        });
        expect(dto.uploadedFilesCount).toBe(0);
      });

      it('should safely handle malformed arrays', () => {
        const fakeArrays = [
          'not-an-array',
          123,
          { length: 5, 0: 'fake1', 1: 'fake2' },
          new String('fake-array'),
          null,
          undefined,
        ];

        fakeArrays.forEach((fakeArray) => {
          expect(() => {
            const dto = plainToInstance(ProjectListItemDto, {
              ...validDto,
              uploadedFileIds: fakeArray,
              uploadedFilesCount: undefined,
            });

            const uploadedCount = dto.uploadedFilesCount;
            expect(typeof uploadedCount).toBe('number');
            expect(uploadedCount).toBeGreaterThanOrEqual(0);
          }).not.toThrow();
        });
      });
    });

    describe('generatedFilesCount transformation', () => {
      it('should use predefined numeric value', () => {
        const dto = plainToInstance(ProjectListItemDto, {
          ...validDto,
          generatedFilesCount: 10,
        });
        expect(dto.generatedFilesCount).toBe(10);
      });

      it('should calculate from array if provided', () => {
        const dto = plainToInstance(ProjectListItemDto, {
          ...validDto,
          generatedFileIds: ['cadrage.md', 'roadmap-frontend.md'],
          generatedFilesCount: undefined,
        });
        expect(dto.generatedFilesCount).toBe(2);
      });

      it('should handle empty arrays', () => {
        const dto = plainToInstance(ProjectListItemDto, {
          ...validDto,
          generatedFileIds: [],
          generatedFilesCount: undefined,
        });
        expect(dto.generatedFilesCount).toBe(0);
      });
    });

    describe('hasStatistics transformation', () => {
      it('should use predefined boolean value', () => {
        const dto = plainToInstance(ProjectListItemDto, {
          ...validDto,
          hasStatistics: false,
        });
        expect(dto.hasStatistics).toBe(false);
      });

      it('should detect statistics object presence', () => {
        const dto = plainToInstance(ProjectListItemDto, {
          ...validDto,
          statistics: {
            costs: {
              claudeApi: 8.5,
              storage: 1.25,
              compute: 0.75,
              total: 10.5,
            },
            performance: {
              generationTime: 45000,
              processingTime: 12000,
            },
            usage: {
              documentsGenerated: 5,
              tokensUsed: 15000,
            },
          },
          hasStatistics: undefined,
        });
        expect(dto.hasStatistics).toBe(true);
      });

      it('should return false for null statistics', () => {
        const dto = plainToInstance(ProjectListItemDto, {
          ...validDto,
          statistics: null,
          hasStatistics: undefined,
        });
        expect(dto.hasStatistics).toBe(false);
      });

      it('should prevent prototype pollution through statistics', () => {
        const pollutionAttempt = {
          statistics: JSON.parse(
            '{"__proto__": {"polluted": true}, "costs": {"total": 100}}',
          ),
        };

        const dto = plainToInstance(ProjectListItemDto, {
          ...validDto,
          ...pollutionAttempt,
          hasStatistics: undefined,
          totalCost: undefined,
        });

        expect((Object.prototype as any).polluted).toBeUndefined();
        expect((dto as any).polluted).toBeUndefined();
        expect(dto.hasStatistics).toBe(true);
        expect(dto.totalCost).toBe(100);
      });
    });

    describe('totalCost transformation', () => {
      it('should use predefined numeric value', () => {
        const dto = plainToInstance(ProjectListItemDto, {
          ...validDto,
          totalCost: 25.5,
        });
        expect(dto.totalCost).toBe(25.5);
      });

      it('should extract from statistics object', () => {
        const dto = plainToInstance(ProjectListItemDto, {
          ...validDto,
          statistics: {
            costs: {
              claudeApi: 12.5,
              storage: 2.25,
              compute: 1.0,
              total: 15.75,
            },
            performance: {
              generationTime: 60000,
              processingTime: 15000,
            },
            usage: {
              documentsGenerated: 4,
              filesProcessed: 3,
              tokensUsed: 18500,
            },
          },
          totalCost: undefined,
        });
        expect(dto.totalCost).toBe(15.75);
      });

      it('should round to 2 decimal places', () => {
        const dto = plainToInstance(ProjectListItemDto, {
          ...validDto,
          totalCost: 12.456789,
        });
        expect(dto.totalCost).toBe(12.46);
      });

      it('should handle zero cost', () => {
        const dto = plainToInstance(ProjectListItemDto, {
          ...validDto,
          totalCost: 0,
        });
        expect(dto.totalCost).toBe(0);
      });

      it('should prevent negative costs', () => {
        const dto = plainToInstance(ProjectListItemDto, {
          ...validDto,
          totalCost: -10.5,
        });
        expect(dto.totalCost).toBe(0);
      });

      it('should safely handle numeric edge cases', () => {
        const maliciousNumbers = [
          { totalCost: Infinity },
          { totalCost: -Infinity },
          { totalCost: NaN },
          { totalCost: 'Infinity' as any },
          { totalCost: 'NaN' as any },
          { totalCost: '1e308' as any },
        ];

        maliciousNumbers.forEach((malicious) => {
          expect(() => {
            const dto = plainToInstance(ProjectListItemDto, {
              ...validDto,
              ...malicious,
            });

            const cost = dto.totalCost;
            if (
              cost !== undefined &&
              cost !== null &&
              !isNaN(cost) &&
              isFinite(cost)
            ) {
              expect(typeof cost).toBe('number');
              expect(cost).toBeGreaterThanOrEqual(0);
            }
          }).not.toThrow();
        });
      });
    });
  });

  describe('Méthodes utilitaires', () => {
    describe('getShortDescription()', () => {
      it('should return full description if shorter than maxLength', () => {
        validDto.description = 'Short desc';
        expect(validDto.getShortDescription(50)).toBe('Short desc');
      });

      it('should truncate at word boundary', () => {
        validDto.description =
          'Complete technical documentation for a modern e-commerce platform with microservices architecture, including frontend React app, backend NestJS APIs, PostgreSQL database, Redis cache, and deployment on Kubernetes';
        const result = validDto.getShortDescription(80);
        expect(result).toBe(
          'Complete technical documentation for a modern e-commerce platform with...',
        );
        expect(result.length).toBeLessThanOrEqual(83);
      });

      it('should handle descriptions without spaces', () => {
        validDto.description = 'Averylongdescriptionwithoutspaces';
        const result = validDto.getShortDescription(20);
        expect(result).toBe('Averylongdescription...');
      });

      it('should return empty string for undefined description', () => {
        validDto.description = undefined;
        expect(validDto.getShortDescription()).toBe('');
      });

      it('should use default maxLength of 100', () => {
        const longDesc = 'a'.repeat(150);
        validDto.description = longDesc;
        const result = validDto.getShortDescription();
        expect(result.length).toBeLessThanOrEqual(103);
      });

      it('should safely handle XSS attempts in description', () => {
        const maliciousDto = plainToInstance(ProjectListItemDto, {
          ...validDto,
          description:
            '<script>alert("XSS")</script><img src="x" onerror="alert(1)">',
        });

        const shortDesc = maliciousDto.getShortDescription(100);
        expect(shortDesc).toContain('<script>');
        expect(() => maliciousDto.getShortDescription(50)).not.toThrow();
      });
    });

    describe('getTotalFilesCount()', () => {
      it('should sum uploaded and generated files', () => {
        expect(validDto.getTotalFilesCount()).toBe(8);
      });

      it('should handle zero counts', () => {
        validDto.uploadedFilesCount = 0;
        validDto.generatedFilesCount = 0;
        expect(validDto.getTotalFilesCount()).toBe(0);
      });
    });

    describe('hasFiles()', () => {
      it('should return true when files exist', () => {
        expect(validDto.hasFiles()).toBe(true);
      });

      it('should return false when no files exist', () => {
        validDto.uploadedFilesCount = 0;
        validDto.generatedFilesCount = 0;
        expect(validDto.hasFiles()).toBe(false);
      });
    });

    describe('getAgeInDays()', () => {
      beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2024-08-08T10:00:00Z'));
      });

      afterEach(() => {
        jest.useRealTimers();
      });

      it('should calculate age correctly', () => {
        validDto.createdAt = new Date('2024-08-01T10:00:00Z');
        expect(validDto.getAgeInDays()).toBe(7);
      });

      it('should return 0 for today', () => {
        validDto.createdAt = new Date('2024-08-08T10:00:00Z');
        expect(validDto.getAgeInDays()).toBe(0);
      });

      it('should handle future dates', () => {
        validDto.createdAt = new Date('2024-08-10T10:00:00Z');
        expect(validDto.getAgeInDays()).toBe(2);
      });

      it('should handle malformed dates', () => {
        const dto = plainToInstance(ProjectListItemDto, {
          ...validDto,
          createdAt: new Date('invalid-date'),
        });
        expect(dto.getAgeInDays()).toBe(0);
      });

      it('should handle null createdAt', () => {
        const dto = plainToInstance(ProjectListItemDto, {
          ...validDto,
          createdAt: null as any,
        });
        expect(dto.getAgeInDays()).toBe(0);
      });

      it('should handle NaN dates', () => {
        const dto = plainToInstance(ProjectListItemDto, {
          ...validDto,
          createdAt: new Date(NaN),
        });
        expect(dto.getAgeInDays()).toBe(0);
      });
    });

    describe('getRelativeAge()', () => {
      beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2024-08-08T10:00:00Z'));
      });

      afterEach(() => {
        jest.useRealTimers();
      });

      it('should return "aujourd\'hui" for same day', () => {
        validDto.createdAt = new Date('2024-08-08T10:00:00Z');
        expect(validDto.getRelativeAge()).toBe("aujourd'hui");
      });

      it('should return "hier" for yesterday', () => {
        validDto.createdAt = new Date('2024-08-07T10:00:00Z');
        expect(validDto.getRelativeAge()).toBe('hier');
      });

      it('should return days for recent dates', () => {
        validDto.createdAt = new Date('2024-08-05T10:00:00Z');
        expect(validDto.getRelativeAge()).toBe('il y a 3 jours');
      });

      it('should return weeks for older dates', () => {
        validDto.createdAt = new Date('2024-07-25T10:00:00Z');
        expect(validDto.getRelativeAge()).toBe('il y a 2 semaines');
      });

      it('should return months for very old dates', () => {
        validDto.createdAt = new Date('2024-06-08T10:00:00Z');
        expect(validDto.getRelativeAge()).toBe('il y a 2 mois');
      });

      it('should return years for ancient dates', () => {
        validDto.createdAt = new Date('2022-08-08T10:00:00Z');
        expect(validDto.getRelativeAge()).toBe('il y a 2 ans');
      });

      it('should handle exactly 1 year old date', () => {
        const dto = plainToInstance(ProjectListItemDto, {
          ...validDto,
          createdAt: new Date('2023-08-08T10:00:00Z'),
        });
        expect(dto.getRelativeAge()).toBe('il y a 1 an');
      });

      it('should handle malformed dates safely', () => {
        const maliciousDates = [
          new Date('2024-13-45'),
          new Date(NaN),
          new Date('javascript:alert(1)'),
          new Date('${process.env.SECRET}'),
        ];

        maliciousDates.forEach((date) => {
          expect(() => {
            const dto = plainToInstance(ProjectListItemDto, {
              ...validDto,
              createdAt: date,
              updatedAt: date,
            });

            const relativeAge = dto.getRelativeAge();
            expect(typeof relativeAge).toBe('string');
            expect(relativeAge).not.toContain('javascript:');
            expect(relativeAge).not.toContain('${');
            expect(relativeAge).not.toContain('process.env');
          }).not.toThrow();
        });
      });
    });

    describe('hasBeenModified()', () => {
      it('should return true when updated after created', () => {
        validDto.createdAt = new Date('2024-08-01T10:00:00Z');
        validDto.updatedAt = new Date('2024-08-01T10:00:05Z');
        expect(validDto.hasBeenModified()).toBe(true);
      });

      it('should return false for same timestamps', () => {
        const sameTime = new Date('2024-08-01T10:00:00Z');
        validDto.createdAt = sameTime;
        validDto.updatedAt = sameTime;
        expect(validDto.hasBeenModified()).toBe(false);
      });

      it('should handle tolerance of 1 second', () => {
        validDto.createdAt = new Date('2024-08-01T10:00:00Z');
        validDto.updatedAt = new Date('2024-08-01T10:00:00.500Z');
        expect(validDto.hasBeenModified()).toBe(false);
      });
    });

    describe('getActivityIndicator()', () => {
      beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2024-08-08T10:00:00Z'));
      });

      afterEach(() => {
        jest.useRealTimers();
      });

      it('should return "nouveau" for today', () => {
        validDto.createdAt = new Date('2024-08-08T10:00:00Z');
        expect(validDto.getActivityIndicator()).toBe('nouveau');
      });

      it('should return "récent" for recent with generated files', () => {
        validDto.createdAt = new Date('2024-08-05T10:00:00Z');
        validDto.generatedFilesCount = 2;
        expect(validDto.getActivityIndicator()).toBe('récent');
      });

      it('should return "actif" for older with generated files', () => {
        validDto.createdAt = new Date('2024-07-20T10:00:00Z');
        validDto.generatedFilesCount = 5;
        expect(validDto.getActivityIndicator()).toBe('actif');
      });

      it('should return "ancien" for old without generation activity', () => {
        validDto.createdAt = new Date('2024-06-01T10:00:00Z');
        validDto.generatedFilesCount = 0;
        validDto.updatedAt = validDto.createdAt;
        expect(validDto.getActivityIndicator()).toBe('ancien');
      });
    });

    describe('isAccessible()', () => {
      it('should return true for ACTIVE status', () => {
        validDto.status = ProjectStatus.ACTIVE;
        expect(validDto.isAccessible()).toBe(true);
      });

      it('should return true for ARCHIVED status', () => {
        validDto.status = ProjectStatus.ARCHIVED;
        expect(validDto.isAccessible()).toBe(true);
      });

      it('should return false for DELETED status', () => {
        validDto.status = ProjectStatus.DELETED;
        expect(validDto.isAccessible()).toBe(false);
      });
    });

    describe('getStatusColor() and getStatusLabel()', () => {
      it('should return correct color and label for ACTIVE', () => {
        validDto.status = ProjectStatus.ACTIVE;
        expect(validDto.getStatusColor()).toBe('#10B981');
        expect(validDto.getStatusLabel()).toBe('Actif');
      });

      it('should return correct color and label for ARCHIVED', () => {
        validDto.status = ProjectStatus.ARCHIVED;
        expect(validDto.getStatusColor()).toBe('#F59E0B');
        expect(validDto.getStatusLabel()).toBe('Archivé');
      });

      it('should return correct color and label for DELETED', () => {
        validDto.status = ProjectStatus.DELETED;
        expect(validDto.getStatusColor()).toBe('#EF4444');
        expect(validDto.getStatusLabel()).toBe('Supprimé');
      });

      it('should handle unknown status', () => {
        const dto = plainToInstance(ProjectListItemDto, {
          ...validDto,
          status: 'UNKNOWN_STATUS' as ProjectStatus,
        });

        expect(dto.getStatusColor()).toBe('#6B7280');
        expect(dto.getStatusLabel()).toBe('Inconnu');
      });
    });

    describe('isProductive()', () => {
      it('should return true when generated files exist', () => {
        validDto.generatedFilesCount = 1;
        expect(validDto.isProductive()).toBe(true);
      });

      it('should return false when no generated files', () => {
        validDto.generatedFilesCount = 0;
        expect(validDto.isProductive()).toBe(false);
      });
    });

    describe('getCompletionScore()', () => {
      it('should calculate full score correctly', () => {
        validDto.uploadedFilesCount = 1;
        validDto.generatedFilesCount = 1;
        validDto.hasStatistics = true;
        validDto.description = 'Test desc';
        expect(validDto.getCompletionScore()).toBe(100);
      });

      it('should handle partial completion', () => {
        validDto.uploadedFilesCount = 0;
        validDto.generatedFilesCount = 1;
        validDto.hasStatistics = false;
        validDto.description = undefined;
        expect(validDto.getCompletionScore()).toBe(40);
      });

      it('should cap at 100%', () => {
        validDto.uploadedFilesCount = 1;
        validDto.generatedFilesCount = 1;
        validDto.hasStatistics = true;
        validDto.description = 'Test';
        expect(validDto.getCompletionScore()).toBe(100);
      });

      it('should handle empty description correctly', () => {
        const dto1 = plainToInstance(ProjectListItemDto, {
          ...validDto,
          description: '',
        });

        const dto2 = plainToInstance(ProjectListItemDto, {
          ...validDto,
          description: '   ',
        });

        expect(dto1.getCompletionScore()).toBe(90);
        expect(dto2.getCompletionScore()).toBe(90);
      });
    });

    describe('getFormattedCost()', () => {
      it('should format valid cost', () => {
        validDto.totalCost = 12.45;
        expect(validDto.getFormattedCost()).toBe('12.45€');
      });

      it('should handle zero cost', () => {
        validDto.totalCost = 0;
        expect(validDto.getFormattedCost()).toBe('Gratuit');
      });

      it('should handle undefined cost', () => {
        validDto.totalCost = undefined;
        expect(validDto.getFormattedCost()).toBe('Non calculé');
      });

      it('should handle null cost', () => {
        (validDto as any).totalCost = null;
        expect(validDto.getFormattedCost()).toBe('Non calculé');
      });
    });

    describe('Méthodes de sérialisation', () => {
      it('should generate correct tooltip summary', () => {
        const summary = validDto.getTooltipSummary();
        expect(summary).toContain(validDto.name);
        expect(summary).toContain('8 fichier(s)');
        expect(summary).toContain('12.45€');
        expect(summary).toContain('100% complet');
      });

      it('should generate correct toString', () => {
        const str = validDto.toString();
        expect(str).toContain('ProjectListItem[Test Project]');
        expect(str).toContain('ACTIVE');
        expect(str).toContain('files=8');
        expect(str).toContain('cost=12.45€');
      });

      it('should generate safe log string', () => {
        const logStr = validDto.toLogSafeString();
        expect(logStr).toContain(
          'ProjectListItem[id=550e8400-e29b-41d4-a716-446655440000',
        );
        expect(logStr).toContain('status=ACTIVE');
        expect(logStr).toContain('files=8');
        expect(logStr).toContain('completion=100%');
        expect(logStr).not.toContain('Test Project');
        expect(logStr).not.toContain('A test project description');
      });

      it('should generate correct metadata', () => {
        const metadata = validDto.getListMetadata();
        expect(metadata).toEqual({
          id: validDto.id,
          status: validDto.status,
          ageInDays: expect.any(Number),
          totalFiles: 8,
          hasStatistics: true,
          activityIndicator: expect.any(String),
          completionScore: 100,
          isProductive: true,
        });
      });

      it('should generate lightweight version', () => {
        const lightweight = validDto.toLightweight();
        expect(lightweight).toEqual({
          id: validDto.id,
          name: validDto.name,
          status: validDto.status,
          createdAt: validDto.createdAt,
          totalFiles: 8,
        });
      });
    });
  });

  describe('Tests de sécurité', () => {
    describe('Protection des données sensibles', () => {
      it('should not expose sensitive user data in toLogSafeString()', () => {
        const sensitiveDto = plainToInstance(ProjectListItemDto, {
          ...validDto,
          name: 'Secret Project with API Keys: sk-1234567890abcdef',
          description:
            'Project containing passwords: admin123, secret tokens, and user emails: user@example.com',
        });

        const logStr = sensitiveDto.toLogSafeString();

        expect(logStr).not.toContain('Secret Project');
        expect(logStr).not.toContain('API Keys');
        expect(logStr).not.toContain('sk-1234567890abcdef');
        expect(logStr).not.toContain('passwords');
        expect(logStr).not.toContain('admin123');
        expect(logStr).not.toContain('secret tokens');
        expect(logStr).not.toContain('user@example.com');

        expect(logStr).toContain('id=550e8400-e29b-41d4-a716-446655440000');
        expect(logStr).toContain('status=ACTIVE');
        expect(logStr).toContain('files=8');
        expect(logStr).toContain('completion=');
        expect(logStr).toContain('activity=');
      });

      it('should not expose sensitive data in getListMetadata()', () => {
        const sensitiveDto = plainToInstance(ProjectListItemDto, {
          ...validDto,
          name: 'Healthcare Platform with PII: Dr. John Doe, Patient ID: P123456789',
          description:
            'Medical records system with SSN: 123-45-6789 and payment info: 4111-1111-1111-1111',
        });

        const metadata = sensitiveDto.getListMetadata();

        expect(JSON.stringify(metadata)).not.toContain('Dr. John Doe');
        expect(JSON.stringify(metadata)).not.toContain('P123456789');
        expect(JSON.stringify(metadata)).not.toContain('123-45-6789');
        expect(JSON.stringify(metadata)).not.toContain('4111-1111-1111-1111');
        expect(JSON.stringify(metadata)).not.toContain('Medical records');

        expect(metadata).toHaveProperty('id');
        expect(metadata).toHaveProperty('status');
        expect(metadata).toHaveProperty('ageInDays');
        expect(metadata).toHaveProperty('totalFiles');
        expect(metadata).toHaveProperty('hasStatistics');
        expect(metadata).toHaveProperty('activityIndicator');
        expect(metadata).toHaveProperty('completionScore');
        expect(metadata).toHaveProperty('isProductive');
      });

      it('should not leak sensitive data through error messages', () => {
        const sensitiveDto = plainToInstance(ProjectListItemDto, {
          ...validDto,
          name: 'Password: secret123',
          description: 'API Key: ak_live_1234567890',
        });

        const originalConsoleError = console.error;
        const errorMessages: string[] = [];
        console.error = (...args: any[]) => {
          errorMessages.push(args.join(' '));
        };

        try {
          (sensitiveDto as any).getShortDescription(-1);
          (sensitiveDto as any).getAgeInDays();
          (sensitiveDto as any).getRelativeAge();
        } catch (error: any) {
          expect(error.message).not.toContain('secret123');
          expect(error.message).not.toContain('ak_live_1234567890');
        } finally {
          console.error = originalConsoleError;
        }

        errorMessages.forEach((msg) => {
          expect(msg).not.toContain('secret123');
          expect(msg).not.toContain('ak_live_1234567890');
        });
      });
    });

    describe('Validation des entrées malveillantes', () => {
      it('should resist injection in description formatting', () => {
        const injectionAttempts = [
          '${process.env.SECRET}',
          '#{7*7}',
          '{{constructor.constructor("return process")().env}}',
          'javascript:alert(1)',
          'data:text/html,<script>alert(1)</script>',
          'eval("malicious code")',
          'require("child_process").exec("rm -rf /")',
        ];

        injectionAttempts.forEach((injection) => {
          const dto = plainToInstance(ProjectListItemDto, {
            ...validDto,
            description: injection,
          });

          expect(() => dto.getShortDescription(50)).not.toThrow();
          expect(() => dto.getTooltipSummary()).not.toThrow();

          const shortDesc = dto.getShortDescription(50);
          const tooltip = dto.getTooltipSummary();

          expect(
            shortDesc.startsWith(injection) ||
              shortDesc.startsWith(injection.substring(0, 47)),
          ).toBe(true);
          expect(tooltip).toContain('Test Project');
        });
      });

      it('should safely handle malformed objects in transformations', () => {
        const malformedInputs = [
          {
            statistics: JSON.parse('{"__proto__": {"malicious": true}}'),
            uploadedFilesCount: undefined,
            generatedFilesCount: undefined,
            hasStatistics: undefined,
            totalCost: undefined,
          },
          {
            uploadedFileIds: { length: 999999, 0: 'fake' } as any,
            uploadedFilesCount: undefined,
            generatedFilesCount: undefined,
          },
          {
            generatedFileIds: 'not-an-array' as any,
            uploadedFilesCount: undefined,
            generatedFilesCount: undefined,
          },
        ];

        malformedInputs.forEach((malformed) => {
          expect(() => {
            const dto = plainToInstance(ProjectListItemDto, {
              ...validDto,
              ...malformed,
            });

            dto.uploadedFilesCount;
            dto.generatedFilesCount;
            dto.hasStatistics;
            dto.totalCost;
          }).not.toThrow();
        });
      });

      it('should safely handle circular references', () => {
        const simpleCircular: any = { costs: { total: 50 } };

        expect(() => {
          const dto = plainToInstance(ProjectListItemDto, {
            ...validDto,
            statistics: simpleCircular,
            hasStatistics: undefined,
            totalCost: undefined,
          });

          dto.hasStatistics;
          dto.totalCost;
        }).not.toThrow();
      });

      it('should prevent timing attacks', () => {
        const sensitiveDescription =
          'SECRET: This contains sensitive information';
        const normalDescription =
          'This is a normal description of the same length approximately';

        const measurements: { sensitive: number[]; normal: number[] } = {
          sensitive: [],
          normal: [],
        };

        for (let i = 0; i < 100; i++) {
          const start1 = performance.now();
          const dto1 = plainToInstance(ProjectListItemDto, {
            ...validDto,
            description: sensitiveDescription,
          });
          dto1.getShortDescription(50);
          const end1 = performance.now();
          measurements.sensitive.push(end1 - start1);

          const start2 = performance.now();
          const dto2 = plainToInstance(ProjectListItemDto, {
            ...validDto,
            description: normalDescription,
          });
          dto2.getShortDescription(50);
          const end2 = performance.now();
          measurements.normal.push(end2 - start2);
        }

        const avgSensitive =
          measurements.sensitive.reduce((a, b) => a + b) /
          measurements.sensitive.length;
        const avgNormal =
          measurements.normal.reduce((a, b) => a + b) /
          measurements.normal.length;

        const timeDifference = Math.abs(avgSensitive - avgNormal);
        const maxAllowedDifference = Math.max(avgSensitive, avgNormal) * 0.1;

        expect(timeDifference).toBeLessThan(maxAllowedDifference);
      });
    });

    describe('Sécurité des transformations', () => {
      it('should prevent code execution through statistics object', () => {
        const maliciousStatistics = {
          costs: {
            total: 100,
            toString: () => {
              throw new Error('Code execution attempt');
            },
            valueOf: () => {
              throw new Error('Value extraction attempt');
            },
          },
          toString: () => {
            throw new Error('Object toString attempt');
          },
        };

        expect(() => {
          const dto = plainToInstance(ProjectListItemDto, {
            ...validDto,
            statistics: maliciousStatistics,
            hasStatistics: undefined,
            totalCost: undefined,
          });

          dto.hasStatistics;
          dto.totalCost;
        }).not.toThrow();
      });

      it('should prevent data exfiltration through error messages', () => {
        const sensitiveData = 'SECRET_API_KEY_1234567890';

        const originalConsoleError = console.error;
        const errors: string[] = [];
        console.error = (...args: any[]) => {
          errors.push(args.join(' '));
        };

        try {
          const dto = plainToInstance(ProjectListItemDto, {
            ...validDto,
            name: sensitiveData,
            description: `Contains ${sensitiveData}`,
          });

          try {
            dto.getAgeInDays();
          } catch (e) {
            /* ignore */
          }
          try {
            dto.getRelativeAge();
          } catch (e) {
            /* ignore */
          }
          try {
            dto.getCompletionScore();
          } catch (e) {
            /* ignore */
          }
          try {
            dto.getFormattedCost();
          } catch (e) {
            /* ignore */
          }

          errors.forEach((error) => {
            expect(error).not.toContain(sensitiveData);
          });
        } finally {
          console.error = originalConsoleError;
        }
      });
    });
  });
});