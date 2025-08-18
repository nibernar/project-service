import { plainToInstance } from 'class-transformer';
import { ProjectListItemDto } from '../../../../src/project/dto/project-list.dto';
import { ProjectStatus } from '../../../../src/common/enums/project-status.enum';

describe('ProjectListItemDto - Edge Cases', () => {
  let baseDto: any;

  beforeEach(() => {
    baseDto = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Test Project',
      status: ProjectStatus.ACTIVE,
      createdAt: new Date('2024-08-01T10:00:00Z'),
      updatedAt: new Date('2024-08-01T10:00:00Z'),
      uploadedFilesCount: 0,
      generatedFilesCount: 0,
      hasStatistics: false,
    };
  });

  describe('Gestion des valeurs nulles/undefined', () => {
    it('should handle null description gracefully', () => {
      const dto = plainToInstance(ProjectListItemDto, {
        ...baseDto,
        description: null,
      });

      expect(dto.getShortDescription()).toBe('');
      expect(dto.getCompletionScore()).toBe(0); // No bonus for description
    });

    it('should handle undefined description gracefully', () => {
      const dto = plainToInstance(ProjectListItemDto, {
        ...baseDto,
        description: undefined,
      });

      expect(dto.getShortDescription()).toBe('');
      expect(dto.getCompletionScore()).toBe(0);
    });

    it('should handle null totalCost gracefully', () => {
      const dto = plainToInstance(ProjectListItemDto, {
        ...baseDto,
        totalCost: null,
      });

      expect(dto.getFormattedCost()).toBe('Non calculé');
      expect(() => dto.getTooltipSummary()).not.toThrow();
    });

    it('should handle undefined arrays in transformations', () => {
      const dto = plainToInstance(ProjectListItemDto, {
        ...baseDto,
        uploadedFileIds: undefined,
        generatedFileIds: undefined,
        uploadedFilesCount: undefined,
        generatedFilesCount: undefined,
      });

      expect(dto.uploadedFilesCount).toBe(0);
      expect(dto.generatedFilesCount).toBe(0);
      expect(dto.getTotalFilesCount()).toBe(0);
    });

    it('should handle null arrays in transformations', () => {
      const dto = plainToInstance(ProjectListItemDto, {
        ...baseDto,
        uploadedFileIds: null,
        generatedFileIds: null,
        uploadedFilesCount: undefined,
        generatedFilesCount: undefined,
      });

      expect(dto.uploadedFilesCount).toBe(0);
      expect(dto.generatedFilesCount).toBe(0);
    });

    it('should handle empty arrays in transformations', () => {
      const dto = plainToInstance(ProjectListItemDto, {
        ...baseDto,
        uploadedFileIds: [],
        generatedFileIds: [],
        uploadedFilesCount: undefined,
        generatedFilesCount: undefined,
      });

      expect(dto.uploadedFilesCount).toBe(0);
      expect(dto.generatedFilesCount).toBe(0);
    });

    it('should handle null statistics object', () => {
      const dto = plainToInstance(ProjectListItemDto, {
        ...baseDto,
        statistics: null,
        hasStatistics: undefined,
        totalCost: undefined,
      });

      expect(dto.hasStatistics).toBe(false);
      expect(dto.totalCost).toBeUndefined();
    });

    it('should handle undefined statistics object', () => {
      const dto = plainToInstance(ProjectListItemDto, {
        ...baseDto,
        statistics: undefined,
        hasStatistics: undefined,
        totalCost: undefined,
      });

      expect(dto.hasStatistics).toBe(false);
      expect(dto.totalCost).toBeUndefined();
    });
  });

  describe('Gestion des dates invalides', () => {
    it('should handle invalid dates', () => {
      const dto = plainToInstance(ProjectListItemDto, {
        ...baseDto,
        createdAt: new Date('invalid-date'),
        updatedAt: new Date('invalid-date'),
      });

      // Les dates invalides deviennent NaN
      expect(isNaN(dto.createdAt.getTime())).toBe(true);
      expect(isNaN(dto.updatedAt.getTime())).toBe(true);

      // Les méthodes doivent gérer gracieusement
      expect(() => dto.getAgeInDays()).not.toThrow();
      expect(() => dto.getRelativeAge()).not.toThrow();
      expect(() => dto.hasBeenModified()).not.toThrow();
    });

    it('should handle future dates', () => {
      const futureDate = new Date('2030-01-01T00:00:00Z');
      const dto = plainToInstance(ProjectListItemDto, {
        ...baseDto,
        createdAt: futureDate,
        updatedAt: futureDate,
      });

      expect(dto.getAgeInDays()).toBeGreaterThan(0);
      expect(dto.getRelativeAge()).toContain('il y a');
    });

    it('should handle very old dates', () => {
      const ancientDate = new Date('1970-01-01T00:00:00Z');
      const dto = plainToInstance(ProjectListItemDto, {
        ...baseDto,
        createdAt: ancientDate,
        updatedAt: ancientDate,
      });

      expect(dto.getAgeInDays()).toBeGreaterThan(365);
      expect(dto.getRelativeAge()).toContain('ans');
    });

    it('should handle dates at epoch', () => {
      const epochDate = new Date(0);
      const dto = plainToInstance(ProjectListItemDto, {
        ...baseDto,
        createdAt: epochDate,
        updatedAt: epochDate,
      });

      expect(() => dto.getAgeInDays()).not.toThrow();
      expect(() => dto.getRelativeAge()).not.toThrow();
    });
  });

  describe('Valeurs extrêmes', () => {
    it('should handle very long description', () => {
      const veryLongDescription = 'a'.repeat(10000);
      const dto = plainToInstance(ProjectListItemDto, {
        ...baseDto,
        description: veryLongDescription,
      });

      expect(dto.description).toBe(veryLongDescription);
      expect(dto.getShortDescription(100).length).toBeLessThanOrEqual(103);
      expect(dto.getCompletionScore()).toBeGreaterThanOrEqual(10); // Bonus for having description
    });

    it('should handle very long name', () => {
      const veryLongName = 'Project Name '.repeat(100);
      const dto = plainToInstance(ProjectListItemDto, {
        ...baseDto,
        name: veryLongName,
      });

      expect(dto.name).toBe(veryLongName);
      expect(() => dto.toString()).not.toThrow();
      expect(() => dto.getTooltipSummary()).not.toThrow();
    });

    it('should handle very high file counts', () => {
      const dto = plainToInstance(ProjectListItemDto, {
        ...baseDto,
        uploadedFilesCount: 999999,
        generatedFilesCount: 999999,
      });

      expect(dto.uploadedFilesCount).toBe(999999);
      expect(dto.generatedFilesCount).toBe(999999);
      expect(dto.getTotalFilesCount()).toBe(1999998);
      expect(dto.hasFiles()).toBe(true);
      expect(dto.isProductive()).toBe(true);
    });

    it('should handle very high costs', () => {
      const dto = plainToInstance(ProjectListItemDto, {
        ...baseDto,
        totalCost: 999999.999,
      });

      // CORRECTION: La transformation arrondit à 2 décimales
      expect(dto.totalCost).toBe(1000000.0); // Arrondi automatique
      expect(dto.getFormattedCost()).toBe('1000000.00€');
    });

    it('should handle very small costs', () => {
      const dto = plainToInstance(ProjectListItemDto, {
        ...baseDto,
        totalCost: 0.001,
      });

      // CORRECTION: La transformation arrondit à 2 décimales
      expect(dto.totalCost).toBe(0.0); // Arrondi vers le bas
      expect(dto.getFormattedCost()).toBe('Gratuit'); // Puisque 0.00
    });

    it('should handle precision issues with costs', () => {
      const dto = plainToInstance(ProjectListItemDto, {
        ...baseDto,
        totalCost: 0.1 + 0.2, // Classic floating point precision issue
      });

      expect(dto.getFormattedCost()).toMatch(/0\.30€/); // Should handle precision
    });
  });

  describe('Cas de troncature et formatage', () => {
    it('should handle getShortDescription with maxLength = 0', () => {
      const dto = plainToInstance(ProjectListItemDto, {
        ...baseDto,
        description: 'Some description',
      });

      const result = dto.getShortDescription(0);
      expect(result).toBe('...');
    });

    it('should handle getShortDescription with maxLength = 1', () => {
      const dto = plainToInstance(ProjectListItemDto, {
        ...baseDto,
        description: 'Some description',
      });

      const result = dto.getShortDescription(1);
      expect(result.length).toBeLessThanOrEqual(4); // '...' might be added
    });

    it('should handle getShortDescription with very large maxLength', () => {
      const dto = plainToInstance(ProjectListItemDto, {
        ...baseDto,
        description: 'Short',
      });

      const result = dto.getShortDescription(10000);
      expect(result).toBe('Short'); // Should return as-is
    });

    it('should handle description without spaces for truncation', () => {
      const dto = plainToInstance(ProjectListItemDto, {
        ...baseDto,
        description: 'verylongdescriptionwithoutanyspacesatall',
      });

      const result = dto.getShortDescription(20);
      // CORRECTION: La vraie logique de troncature
      expect(result).toBe('verylongdescriptionw...');
      expect(result.length).toBe(23);
    });

    it('should handle description with only spaces', () => {
      const dto = plainToInstance(ProjectListItemDto, {
        ...baseDto,
        description: '     ',
      });

      const result = dto.getShortDescription(10);
      expect(result).toBe('     ');
    });

    it('should handle empty description', () => {
      const dto = plainToInstance(ProjectListItemDto, {
        ...baseDto,
        description: '',
      });

      const result = dto.getShortDescription(10);
      expect(result).toBe('');
    });

    it('should handle description with special characters', () => {
      const dto = plainToInstance(ProjectListItemDto, {
        ...baseDto,
        description: 'Description with émojis 😀 and special chars ñáéíóú',
      });

      const result = dto.getShortDescription(30);
      expect(result).toContain('Description with émojis');
      expect(() => dto.getShortDescription(30)).not.toThrow();
    });
  });

  describe('Cas limites des transformations', () => {
    it('should handle malformed arrays in transformations', () => {
      const dto = plainToInstance(ProjectListItemDto, {
        ...baseDto,
        uploadedFileIds: 'not-an-array',
        generatedFileIds: 123,
        uploadedFilesCount: undefined,
        generatedFilesCount: undefined,
      });

      expect(dto.uploadedFilesCount).toBe(0);
      expect(dto.generatedFilesCount).toBe(0);
    });

    it('should handle arrays with non-string elements', () => {
      const dto = plainToInstance(ProjectListItemDto, {
        ...baseDto,
        uploadedFileIds: [null, undefined, 123, {}, []],
        generatedFileIds: [true, false, 'valid-id'],
        uploadedFilesCount: undefined,
        generatedFilesCount: undefined,
      });

      expect(dto.uploadedFilesCount).toBe(5); // Count all elements regardless of type
      expect(dto.generatedFilesCount).toBe(3);
    });

    it('should handle malformed statistics object', () => {
      const dto = plainToInstance(ProjectListItemDto, {
        ...baseDto,
        statistics: 'not-an-object',
        hasStatistics: undefined,
        totalCost: undefined,
      });

      // CORRECTION: string n'est pas null/undefined, donc hasStatistics = true
      expect(dto.hasStatistics).toBe(true);
      expect(dto.totalCost).toBeUndefined();
    });

    it('should handle statistics object without costs', () => {
      const dto = plainToInstance(ProjectListItemDto, {
        ...baseDto,
        statistics: { someOtherData: 'value' },
        hasStatistics: undefined,
        totalCost: undefined,
      });

      expect(dto.hasStatistics).toBe(true);
      expect(dto.totalCost).toBeUndefined();
    });

    it('should handle statistics with malformed costs', () => {
      const dto = plainToInstance(ProjectListItemDto, {
        ...baseDto,
        statistics: { costs: 'not-an-object' },
        hasStatistics: undefined,
        totalCost: undefined,
      });

      expect(dto.hasStatistics).toBe(true);
      expect(dto.totalCost).toBeUndefined();
    });

    it('should handle statistics with non-numeric total cost', () => {
      const dto = plainToInstance(ProjectListItemDto, {
        ...baseDto,
        statistics: { costs: { total: 'not-a-number' } },
        hasStatistics: undefined,
        totalCost: undefined,
      });

      expect(dto.hasStatistics).toBe(true);
      expect(dto.totalCost).toBeUndefined();
    });
  });

  describe("Cas limites des calculs d'âge", () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-08-08T12:00:00Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should handle same timestamp for created and current', () => {
      const dto = plainToInstance(ProjectListItemDto, {
        ...baseDto,
        createdAt: new Date('2024-08-08T12:00:00Z'),
      });

      // CORRECTION: Même timestamp = 0 jours (pas 1)
      expect(dto.getAgeInDays()).toBe(0);
      expect(dto.getRelativeAge()).toBe("aujourd'hui");
    });

    it('should handle created timestamp in the future', () => {
      const dto = plainToInstance(ProjectListItemDto, {
        ...baseDto,
        createdAt: new Date('2024-08-10T12:00:00Z'),
      });

      expect(dto.getAgeInDays()).toBeGreaterThan(0); // Math.abs ensures positive
      expect(() => dto.getRelativeAge()).not.toThrow();
    });

    it('should handle edge case around year boundaries', () => {
      const dto = plainToInstance(ProjectListItemDto, {
        ...baseDto,
        createdAt: new Date('2023-08-08T12:00:00Z'), // Exactly 1 year ago
      });

      expect(dto.getAgeInDays()).toBe(366); // 365 + 1 due to Math.ceil
      expect(dto.getRelativeAge()).toBe('il y a 1 an');
    });

    it('should handle timezone edge cases', () => {
      const dto = plainToInstance(ProjectListItemDto, {
        ...baseDto,
        createdAt: new Date('2024-08-07T23:59:59Z'), // Almost yesterday
      });

      expect(() => dto.getAgeInDays()).not.toThrow();
      expect(() => dto.getRelativeAge()).not.toThrow();
    });
  });

  describe('Cas limites des méthodes utilitaires', () => {
    it('should handle completion score with edge cases', () => {
      const dto = plainToInstance(ProjectListItemDto, {
        ...baseDto,
        uploadedFilesCount: 0,
        generatedFilesCount: 0,
        hasStatistics: false,
        description: '',
      });

      expect(dto.getCompletionScore()).toBe(0);
    });

    it('should handle activity indicator with edge timestamps', () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-08-08T00:00:00Z')); // Midnight

      const dto = plainToInstance(ProjectListItemDto, {
        ...baseDto,
        createdAt: new Date('2024-08-07T23:59:59Z'), // 1 second before
        updatedAt: new Date('2024-08-07T23:59:59Z'),
        generatedFilesCount: 0,
      });

      expect(() => dto.getActivityIndicator()).not.toThrow();

      jest.useRealTimers();
    });

    it('should handle tooltip summary with missing data', () => {
      const dto = plainToInstance(ProjectListItemDto, {
        ...baseDto,
        name: '',
        uploadedFilesCount: 0,
        generatedFilesCount: 0,
        totalCost: undefined,
      });

      expect(() => dto.getTooltipSummary()).not.toThrow();
      const summary = dto.getTooltipSummary();
      expect(summary).toContain('0 fichier(s)');
      expect(summary).toContain('Non calculé');
    });

    it('should handle log safe string with special characters', () => {
      const dto = plainToInstance(ProjectListItemDto, {
        ...baseDto,
        name: 'Project with "quotes" and \'apostrophes\' & symbols',
        description: 'Description with <html> tags and {json}',
      });

      const logStr = dto.toLogSafeString();
      expect(logStr).not.toContain('Project with "quotes"');
      expect(logStr).not.toContain('<html>');
      expect(logStr).toContain(dto.id);
    });
  });
});
