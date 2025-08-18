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
      name: 'Test Project', // CORRECTION: était 'E-commerce Platform Documentation'
      description: 'A test project description', // CORRECTION: était 'Complete technical documentation...'
      status: ProjectStatus.ACTIVE,
      createdAt: baseDate,
      updatedAt: updatedDate,
      uploadedFilesCount: 3, // User uploaded specifications
      generatedFilesCount: 5, // AI generated documents (cadrage, roadmaps, plans, guides)
      hasStatistics: true,
      totalCost: 12.45, // Claude API + infrastructure costs
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
        uploadedFilesCount: 0, // No initial files uploaded
        generatedFilesCount: 0, // Generation not yet started
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
          uploadedFileIds: ['specs.pdf', 'wireframes.png', 'requirements.docx'], // User specifications
          uploadedFilesCount: undefined,
        });
        // La transformation devrait calculer depuis l'array
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
          generatedFileIds: ['cadrage.md', 'roadmap-frontend.md'], // AI generated documents
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
        expect(result.length).toBeLessThanOrEqual(83); // 80 + '...'
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
        expect(result.length).toBeLessThanOrEqual(103); // 100 + '...'
      });
    });

    describe('getTotalFilesCount()', () => {
      it('should sum uploaded and generated files', () => {
        expect(validDto.getTotalFilesCount()).toBe(8); // 3 + 5
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
        // Mock current date to 2024-08-08 for consistent testing
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2024-08-08T10:00:00Z'));
      });

      afterEach(() => {
        jest.useRealTimers();
      });

      it('should calculate age correctly', () => {
        validDto.createdAt = new Date('2024-08-01T10:00:00Z'); // 7 days ago
        expect(validDto.getAgeInDays()).toBe(7);
      });

      it('should return 0 for today', () => {
        validDto.createdAt = new Date('2024-08-08T10:00:00Z'); // Today
        expect(validDto.getAgeInDays()).toBe(0);
      });

      it('should handle future dates', () => {
        validDto.createdAt = new Date('2024-08-10T10:00:00Z'); // Future
        expect(validDto.getAgeInDays()).toBe(2);
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
        validDto.createdAt = new Date('2024-08-05T10:00:00Z'); // 3 days ago
        expect(validDto.getRelativeAge()).toBe('il y a 3 jours');
      });

      it('should return weeks for older dates', () => {
        validDto.createdAt = new Date('2024-07-25T10:00:00Z'); // 2 weeks ago
        expect(validDto.getRelativeAge()).toBe('il y a 2 semaines');
      });

      it('should return months for very old dates', () => {
        validDto.createdAt = new Date('2024-06-08T10:00:00Z'); // 2 months ago
        expect(validDto.getRelativeAge()).toBe('il y a 2 mois');
      });

      it('should return years for ancient dates', () => {
        validDto.createdAt = new Date('2022-08-08T10:00:00Z'); // 2 years ago
        expect(validDto.getRelativeAge()).toBe('il y a 2 ans');
      });
    });

    describe('hasBeenModified()', () => {
      it('should return true when updated after created', () => {
        validDto.createdAt = new Date('2024-08-01T10:00:00Z');
        validDto.updatedAt = new Date('2024-08-01T10:00:05Z'); // 5 seconds later
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
        validDto.updatedAt = new Date('2024-08-01T10:00:00.500Z'); // 500ms later
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
        validDto.createdAt = new Date('2024-08-05T10:00:00Z'); // 3 days ago
        validDto.generatedFilesCount = 2; // AI has started generating documents
        expect(validDto.getActivityIndicator()).toBe('récent');
      });

      it('should return "actif" for older with generated files', () => {
        validDto.createdAt = new Date('2024-07-20T10:00:00Z'); // 19 days ago
        validDto.generatedFilesCount = 5; // Complete generation finished
        expect(validDto.getActivityIndicator()).toBe('actif');
      });

      it('should return "ancien" for old without generation activity', () => {
        validDto.createdAt = new Date('2024-06-01T10:00:00Z'); // 2+ months ago
        validDto.generatedFilesCount = 0; // No AI generation yet
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
        validDto.uploadedFilesCount = 1; // +25%
        validDto.generatedFilesCount = 1; // +40%
        validDto.hasStatistics = true; // +25%
        validDto.description = 'Test desc'; // +10%
        expect(validDto.getCompletionScore()).toBe(100);
      });

      it('should handle partial completion', () => {
        validDto.uploadedFilesCount = 0; // 0%
        validDto.generatedFilesCount = 1; // +40%
        validDto.hasStatistics = false; // 0%
        validDto.description = undefined; // 0%
        expect(validDto.getCompletionScore()).toBe(40);
      });

      it('should cap at 100%', () => {
        // Even if calculation would exceed 100%
        validDto.uploadedFilesCount = 1;
        validDto.generatedFilesCount = 1;
        validDto.hasStatistics = true;
        validDto.description = 'Test';
        expect(validDto.getCompletionScore()).toBe(100);
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
        expect(summary).toContain('8 fichier(s)'); // 3 + 5
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
        // Should not contain sensitive data
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

  describe('Couverture des branches manquantes', () => {
    it('should handle malformed dates in getAgeInDays', () => {
      const dto = plainToInstance(ProjectListItemDto, {
        ...validDto,
        createdAt: new Date('invalid-date'),
      });

      expect(dto.getAgeInDays()).toBe(0); // Couvre la ligne 168
    });

    it('should handle null createdAt in getAgeInDays', () => {
      const dto = plainToInstance(ProjectListItemDto, {
        ...validDto,
        createdAt: null as any,
      });

      expect(dto.getAgeInDays()).toBe(0); // Couvre aussi la ligne 168
    });

    it('should handle NaN dates in getAgeInDays', () => {
      const dto = plainToInstance(ProjectListItemDto, {
        ...validDto,
        createdAt: new Date(NaN),
      });

      expect(dto.getAgeInDays()).toBe(0); // Couvre la ligne 168
    });

    it('should handle unknown status in getStatusColor and getStatusLabel', () => {
      const dto = plainToInstance(ProjectListItemDto, {
        ...validDto,
        status: 'UNKNOWN_STATUS' as ProjectStatus,
      });

      expect(dto.getStatusColor()).toBe('#6B7280'); // Couvre ligne 361
      expect(dto.getStatusLabel()).toBe('Inconnu'); // Couvre ligne 379
    });

    it('should handle empty description in completion score', () => {
      const dto1 = plainToInstance(ProjectListItemDto, {
        ...validDto,
        description: '',
      });

      const dto2 = plainToInstance(ProjectListItemDto, {
        ...validDto,
        description: '   ', // Espaces seulement
      });

      expect(dto1.getCompletionScore()).toBe(90); // Pas de bonus description
      expect(dto2.getCompletionScore()).toBe(90); // Espaces = pas de bonus
    });

    it('should handle very old dates for year calculation', () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-08-08T10:00:00Z'));

      const dto = plainToInstance(ProjectListItemDto, {
        ...validDto,
        createdAt: new Date('2020-08-08T10:00:00Z'), // 4 years ago
      });

      expect(dto.getRelativeAge()).toBe('il y a 4 ans');

      jest.useRealTimers();
    });

    it('should handle exactly 1 year old date', () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-08-08T10:00:00Z'));

      const dto = plainToInstance(ProjectListItemDto, {
        ...validDto,
        createdAt: new Date('2023-08-08T10:00:00Z'), // Exactly 1 year ago
      });

      expect(dto.getRelativeAge()).toBe('il y a 1 an');

      jest.useRealTimers();
    });
  });
});
