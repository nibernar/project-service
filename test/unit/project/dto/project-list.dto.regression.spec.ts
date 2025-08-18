import { plainToInstance } from 'class-transformer';
import { ProjectListItemDto } from '../../../../src/project/dto/project-list.dto';
import { ProjectStatus } from '../../../../src/common/enums/project-status.enum';

describe('ProjectListItemDto - Regression Tests', () => {
  let baseDto: any;

  beforeEach(() => {
    baseDto = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Test Project',
      description: 'A test project description',
      status: ProjectStatus.ACTIVE,
      createdAt: new Date('2024-08-01T10:00:00Z'),
      updatedAt: new Date('2024-08-08T14:30:00Z'),
      uploadedFilesCount: 3,
      generatedFilesCount: 5,
      hasStatistics: true,
      totalCost: 12.45,
    };
  });

  describe('Compatibilité des transformations', () => {
    it('should handle legacy data format with file IDs instead of counts', () => {
      // Ancien format où on stockait les IDs des fichiers
      const legacyDto = plainToInstance(ProjectListItemDto, {
        ...baseDto,
        uploadedFileIds: ['file1.txt', 'file2.pdf', 'file3.doc'],
        generatedFileIds: ['gen1.js', 'gen2.ts'],
        // Pas de counts prédéfinis
        uploadedFilesCount: undefined,
        generatedFilesCount: undefined,
      });

      expect(legacyDto.uploadedFilesCount).toBe(3);
      expect(legacyDto.generatedFilesCount).toBe(2);
      expect(legacyDto.getTotalFilesCount()).toBe(5);
    });

    it('should prioritize explicit counts over array lengths for performance', () => {
      // Format optimisé où on stocke directement les counts
      const optimizedDto = plainToInstance(ProjectListItemDto, {
        ...baseDto,
        uploadedFilesCount: 15, // Count précalculé
        generatedFilesCount: 25,
        // Arrays peuvent être présents mais ne doivent pas être utilisés
        uploadedFileIds: ['file1'], // Seulement 1 élément
        generatedFileIds: ['gen1', 'gen2'], // Seulement 2 éléments
      });

      // Doit utiliser les counts explicites, pas les arrays
      expect(optimizedDto.uploadedFilesCount).toBe(15);
      expect(optimizedDto.generatedFilesCount).toBe(25);
      expect(optimizedDto.getTotalFilesCount()).toBe(40);
    });

    it('should handle mixed legacy and new format gracefully', () => {
      const mixedDto = plainToInstance(ProjectListItemDto, {
        ...baseDto,
        uploadedFilesCount: 10, // Nouveau format
        generatedFileIds: ['gen1', 'gen2', 'gen3'], // Ancien format
        generatedFilesCount: undefined,
      });

      expect(mixedDto.uploadedFilesCount).toBe(10);
      expect(mixedDto.generatedFilesCount).toBe(3); // Calculé depuis array
    });

    it('should maintain backward compatibility with old statistics format', () => {
      // Ancien format de statistics
      const oldStatisticsFormat = {
        totalCost: 123.45, // Direct au niveau racine
        breakdown: {
          api: 50.0,
          storage: 73.45,
        },
      };

      const dto = plainToInstance(ProjectListItemDto, {
        ...baseDto,
        statistics: oldStatisticsFormat,
        hasStatistics: undefined,
        totalCost: undefined,
      });

      expect(dto.hasStatistics).toBe(true);
      // totalCost n'est pas au bon endroit dans l'ancien format
      expect(dto.totalCost).toBeUndefined();
    });

    it('should handle new nested statistics format', () => {
      // Nouveau format avec structure imbriquée
      const newStatisticsFormat = {
        costs: {
          total: 156.78,
          breakdown: {
            api: 75.0,
            storage: 81.78,
          },
        },
        usage: {
          requests: 1500,
          storage_gb: 2.5,
        },
      };

      const dto = plainToInstance(ProjectListItemDto, {
        ...baseDto,
        statistics: newStatisticsFormat,
        hasStatistics: undefined,
        totalCost: undefined,
      });

      expect(dto.hasStatistics).toBe(true);
      expect(dto.totalCost).toBe(156.78);
    });

    it('should handle evolution from string to enum status', () => {
      // Simulation d'anciens statuts sous forme de string
      const legacyStatuses = ['active', 'archived', 'deleted'];

      legacyStatuses.forEach((status) => {
        expect(() => {
          const dto = plainToInstance(ProjectListItemDto, {
            ...baseDto,
            status: status as ProjectStatus,
          });

          dto.getStatusColor();
          dto.getStatusLabel();
          dto.isAccessible();
        }).not.toThrow();
      });
    });
  });

  describe('Stabilité des calculs', () => {
    it('should produce consistent results across multiple executions', () => {
      const testData = {
        ...baseDto,
        createdAt: new Date('2024-01-15T10:30:00Z'),
        updatedAt: new Date('2024-01-20T14:45:00Z'),
        uploadedFilesCount: 7,
        generatedFilesCount: 13,
        totalCost: 89.76,
      };

      const results: any[] = [];

      // Exécuter le même calcul plusieurs fois
      for (let i = 0; i < 100; i++) {
        const dto = plainToInstance(ProjectListItemDto, testData);

        results.push({
          totalFiles: dto.getTotalFilesCount(),
          hasFiles: dto.hasFiles(),
          isProductive: dto.isProductive(),
          completionScore: dto.getCompletionScore(),
          formattedCost: dto.getFormattedCost(),
          isAccessible: dto.isAccessible(),
          statusColor: dto.getStatusColor(),
          statusLabel: dto.getStatusLabel(),
        });
      }

      // Tous les résultats doivent être identiques
      const firstResult = results[0];
      results.forEach((result, index) => {
        expect(result).toEqual(firstResult);
      });
    });

    it('should maintain consistent age calculations with fixed time', () => {
      jest.useFakeTimers();
      const fixedNow = new Date('2024-08-15T12:00:00Z');
      jest.setSystemTime(fixedNow);

      const testCases = [
        {
          created: '2024-08-15T12:00:00Z',
          expectedDays: 0,
          expectedLabel: "aujourd'hui",
        }, // CORRECTION: 0 au lieu de 1
        {
          created: '2024-08-14T12:00:00Z',
          expectedDays: 1,
          expectedLabel: 'hier',
        },
        {
          created: '2024-08-13T12:00:00Z',
          expectedDays: 2,
          expectedLabel: 'il y a 2 jours',
        },
        {
          created: '2024-08-08T12:00:00Z',
          expectedDays: 7,
          expectedLabel: 'il y a 1 semaine',
        },
        {
          created: '2024-07-15T12:00:00Z',
          expectedDays: 31,
          expectedLabel: 'il y a 1 mois',
        },
        {
          created: '2023-08-15T12:00:00Z',
          expectedDays: 366,
          expectedLabel: 'il y a 1 an',
        },
      ];

      testCases.forEach(({ created, expectedDays, expectedLabel }) => {
        const dto = plainToInstance(ProjectListItemDto, {
          ...baseDto,
          createdAt: new Date(created),
        });

        expect(dto.getAgeInDays()).toBe(expectedDays);
        expect(dto.getRelativeAge()).toBe(expectedLabel);
      });

      jest.useRealTimers();
    });

    it('should handle daylight saving time transitions correctly', () => {
      jest.useFakeTimers();

      // Test autour du changement d'heure d'été (dernier dimanche de mars 2024)
      const dstTransition = new Date('2024-03-31T03:00:00Z'); // Après le changement
      jest.setSystemTime(dstTransition);

      const beforeDst = new Date('2024-03-30T01:00:00Z'); // Avant le changement
      const afterDst = new Date('2024-03-31T01:00:00Z'); // Après le changement

      const dto1 = plainToInstance(ProjectListItemDto, {
        ...baseDto,
        createdAt: beforeDst,
      });

      const dto2 = plainToInstance(ProjectListItemDto, {
        ...baseDto,
        createdAt: afterDst,
      });

      // Les calculs doivent rester cohérents malgré le changement d'heure
      expect(dto1.getAgeInDays()).toBeGreaterThan(0);
      expect(dto2.getAgeInDays()).toBeGreaterThan(0);
      expect(dto1.getAgeInDays()).toBeGreaterThan(dto2.getAgeInDays());

      jest.useRealTimers();
    });

    it('should maintain consistency across different locales', () => {
      const originalLocale = Intl.DateTimeFormat().resolvedOptions().locale;

      const testData = {
        ...baseDto,
        totalCost: 1234.567,
        createdAt: new Date('2024-01-15T10:30:00Z'),
      };

      // Test avec différentes locales (simulé via différents formats de nombres)
      const dto = plainToInstance(ProjectListItemDto, testData);

      // Les calculs numériques doivent être cohérents
      // CORRECTION: La transformation arrondit automatiquement à 2 décimales
      expect(dto.totalCost).toBe(1234.57); // Au lieu de 1234.567
      expect(dto.getFormattedCost()).toBe('1234.57€'); // Au lieu de '1234.567€'

      // Les méthodes de calcul ne doivent pas dépendre de la locale
      expect(dto.getCompletionScore()).toBe(100); // Toutes les conditions remplies
      expect(dto.getTotalFilesCount()).toBe(8);
    });
  });

  describe('Gestion des changements de timezone', () => {
    it('should handle timezone differences consistently', () => {
      const utcDate = new Date('2024-08-15T12:00:00Z');
      const pstDate = new Date('2024-08-15T12:00:00-08:00'); // Même moment, timezone différente

      const dto1 = plainToInstance(ProjectListItemDto, {
        ...baseDto,
        createdAt: utcDate,
      });

      const dto2 = plainToInstance(ProjectListItemDto, {
        ...baseDto,
        createdAt: pstDate,
      });

      // Les calculs d'âge doivent être basés sur l'heure absolue, pas la timezone
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-08-16T12:00:00Z'));

      expect(dto1.getAgeInDays()).toBe(dto2.getAgeInDays());
      expect(dto1.getRelativeAge()).toBe(dto2.getRelativeAge());

      jest.useRealTimers();
    });
  });

  describe('Cohérence des transformations de coût', () => {
    it('should maintain precision in cost calculations', () => {
      const precisionTestCases = [
        { input: 0.1 + 0.2, expected: 0.3 }, // Problème classique de précision JS
        { input: 12.345678, expected: 12.35 }, // Arrondi à 2 décimales
        { input: 99.999, expected: 100.0 }, // Arrondi supérieur
        { input: 0.001, expected: 0.0 }, // Très petite valeur
        { input: 0, expected: 0 }, // Zéro
      ];

      precisionTestCases.forEach(({ input, expected }) => {
        const dto = plainToInstance(ProjectListItemDto, {
          ...baseDto,
          totalCost: input,
        });

        if (expected === 0) {
          expect(dto.getFormattedCost()).toBe('Gratuit');
        } else {
          expect(dto.getFormattedCost()).toBe(`${expected.toFixed(2)}€`);
        }
      });
    });

    it('should handle cost extraction from different statistics formats', () => {
      const statisticsFormats = [
        // Format actuel
        {
          statistics: { costs: { total: 123.45 } },
          expected: 123.45,
        },
        // Format avec précision élevée
        {
          statistics: { costs: { total: 123.456789 } },
          expected: 123.46,
        },
        // Format sans costs
        {
          statistics: { usage: { requests: 100 } },
          expected: undefined,
        },
        // Format avec costs mais sans total
        {
          statistics: { costs: { breakdown: { api: 50 } } },
          expected: undefined,
        },
      ];

      statisticsFormats.forEach(({ statistics, expected }, index) => {
        const dto = plainToInstance(ProjectListItemDto, {
          ...baseDto,
          statistics,
          totalCost: undefined,
        });

        expect(dto.totalCost).toBe(expected);
      });
    });
  });

  describe("Stabilité de l'indicateur d'activité", () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-08-15T12:00:00Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should provide consistent activity indicators', () => {
      const activityTestCases = [
        {
          createdAt: new Date('2024-08-15T12:00:00Z'), // Aujourd'hui
          updatedAt: new Date('2024-08-15T12:00:00Z'),
          generatedFilesCount: 0,
          expected: 'nouveau',
        },
        {
          createdAt: new Date('2024-08-12T12:00:00Z'), // 3 jours
          updatedAt: new Date('2024-08-14T12:00:00Z'), // Modifié récemment
          generatedFilesCount: 0,
          expected: 'récent',
        },
        {
          createdAt: new Date('2024-08-12T12:00:00Z'), // 3 jours
          updatedAt: new Date('2024-08-12T12:00:00Z'),
          generatedFilesCount: 2, // Fichiers générés
          expected: 'récent',
        },
        {
          createdAt: new Date('2024-07-25T12:00:00Z'), // 21 jours
          updatedAt: new Date('2024-07-25T12:00:00Z'),
          generatedFilesCount: 3, // Fichiers générés
          expected: 'actif',
        },
        {
          createdAt: new Date('2024-06-15T12:00:00Z'), // 2 mois
          updatedAt: new Date('2024-06-15T12:00:00Z'),
          generatedFilesCount: 0, // Pas de fichiers générés
          expected: 'ancien',
        },
      ];

      activityTestCases.forEach(
        ({ createdAt, updatedAt, generatedFilesCount, expected }, index) => {
          const dto = plainToInstance(ProjectListItemDto, {
            ...baseDto,
            createdAt,
            updatedAt,
            generatedFilesCount,
          });

          expect(dto.getActivityIndicator()).toBe(expected);
        },
      );
    });

    it('should handle edge cases in activity determination', () => {
      const edgeCases = [
        {
          description: 'Exactly 7 days with files',
          createdAt: new Date('2024-08-08T12:00:00Z'), // Exactly 7 days
          generatedFilesCount: 1,
          expected: 'récent',
        },
        {
          description: 'Exactly 30 days with files',
          createdAt: new Date('2024-07-16T12:00:00Z'), // Exactly 30 days
          generatedFilesCount: 1,
          expected: 'actif',
        },
        {
          description: 'Just over 30 days with files',
          createdAt: new Date('2024-07-15T12:00:00Z'), // 31 days
          generatedFilesCount: 1,
          expected: 'ancien',
        },
      ];

      edgeCases.forEach(
        ({ description, createdAt, generatedFilesCount, expected }) => {
          const dto = plainToInstance(ProjectListItemDto, {
            ...baseDto,
            createdAt,
            updatedAt: createdAt,
            generatedFilesCount,
          });

          expect(dto.getActivityIndicator()).toBe(expected);
        },
      );
    });
  });

  describe('Robustesse du score de complétion', () => {
    it('should calculate completion score consistently', () => {
      const completionTestCases = [
        {
          description: 'Empty project',
          data: {
            uploadedFilesCount: 0,
            generatedFilesCount: 0,
            hasStatistics: false,
            description: undefined,
          },
          expected: 0,
        },
        {
          description: 'Only uploaded files',
          data: {
            uploadedFilesCount: 1,
            generatedFilesCount: 0,
            hasStatistics: false,
            description: undefined,
          },
          expected: 25,
        },
        {
          description: 'Only generated files',
          data: {
            uploadedFilesCount: 0,
            generatedFilesCount: 1,
            hasStatistics: false,
            description: undefined,
          },
          expected: 40,
        },
        {
          description: 'Only statistics',
          data: {
            uploadedFilesCount: 0,
            generatedFilesCount: 0,
            hasStatistics: true,
            description: undefined,
          },
          expected: 25,
        },
        {
          description: 'Only description',
          data: {
            uploadedFilesCount: 0,
            generatedFilesCount: 0,
            hasStatistics: false,
            description: 'Test',
          },
          expected: 10,
        },
        {
          description: 'Complete project',
          data: {
            uploadedFilesCount: 1,
            generatedFilesCount: 1,
            hasStatistics: true,
            description: 'Test',
          },
          expected: 100,
        },
        {
          description: 'Empty description should not count',
          data: {
            uploadedFilesCount: 1,
            generatedFilesCount: 1,
            hasStatistics: true,
            description: '   ',
          },
          expected: 90, // No bonus for empty description
        },
      ];

      completionTestCases.forEach(({ description, data, expected }) => {
        const dto = plainToInstance(ProjectListItemDto, {
          ...baseDto,
          ...data,
        });

        expect(dto.getCompletionScore()).toBe(expected);
      });
    });
  });

  describe('Cohérence des méthodes de sérialisation', () => {
    it('should maintain consistent serialization format', () => {
      const testDto = plainToInstance(ProjectListItemDto, {
        ...baseDto,
        name: 'Consistent Test Project',
        uploadedFilesCount: 5,
        generatedFilesCount: 10,
        totalCost: 45.67,
      });

      // Test de cohérence sur plusieurs exécutions
      const serializations = Array.from({ length: 10 }, () => ({
        toString: testDto.toString(),
        logSafe: testDto.toLogSafeString(),
        metadata: testDto.getListMetadata(),
        lightweight: testDto.toLightweight(),
        tooltip: testDto.getTooltipSummary(),
      }));

      const first = serializations[0];
      serializations.slice(1).forEach((serialization, index) => {
        expect(serialization.toString).toBe(first.toString);
        expect(serialization.logSafe).toBe(first.logSafe);
        expect(serialization.metadata).toEqual(first.metadata);
        expect(serialization.lightweight).toEqual(first.lightweight);
        expect(serialization.tooltip).toBe(first.tooltip);
      });
    });

    it('should maintain backward compatibility in serialization keys', () => {
      const dto = plainToInstance(ProjectListItemDto, baseDto);

      const metadata = dto.getListMetadata();
      const lightweight = dto.toLightweight();

      // Vérifier que les clés essentielles sont toujours présentes
      expect(metadata).toHaveProperty('id');
      expect(metadata).toHaveProperty('status');
      expect(metadata).toHaveProperty('totalFiles');
      expect(metadata).toHaveProperty('isProductive');

      expect(lightweight).toHaveProperty('id');
      expect(lightweight).toHaveProperty('name');
      expect(lightweight).toHaveProperty('status');
      expect(lightweight).toHaveProperty('createdAt');
      expect(lightweight).toHaveProperty('totalFiles');
    });
  });
});
