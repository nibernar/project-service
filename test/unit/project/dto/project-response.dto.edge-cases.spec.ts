// test/unit/project/dto/project-response.dto.edge-cases.spec.ts

import { plainToInstance, instanceToPlain } from 'class-transformer';
import { ProjectResponseDto, StatisticsResponseDto } from '../../../../src/project/dto/project-response.dto';
import { ProjectStatus } from '../../../../src/common/enums/project-status.enum';

describe('ProjectResponseDto - Edge Cases', () => {
  // ========================================================================
  // FIXTURES POUR LES EDGE CASES
  // ========================================================================

  const createValidStatisticsData = () => ({
    costs: {
      claudeApi: 0.45,
      storage: 0.02,
      compute: 0.01,
      total: 0.48,
    },
    performance: {
      generationTime: 12500,
      processingTime: 2300,
      totalTime: 14800,
    },
    usage: {
      documentsGenerated: 5,
      filesProcessed: 3,
      tokensUsed: 1250,
    },
    lastUpdated: new Date('2024-08-08T14:30:00Z'),
  });

  const createMinimalProjectData = () => ({
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Minimal Project',
    initialPrompt: 'Simple prompt',
    status: ProjectStatus.ACTIVE,
    uploadedFileIds: [],
    generatedFileIds: [],
    createdAt: new Date('2024-08-08T10:30:00Z'),
    updatedAt: new Date('2024-08-08T10:30:00Z'),
  });

  // ========================================================================
  // EDGE CASES - StatisticsResponseDto
  // ========================================================================

  describe('StatisticsResponseDto - Edge Cases', () => {
    describe('Données malformées', () => {
      it('devrait gérer des données costs malformées', () => {
        const malformedData = {
          costs: 'not an object',
          performance: { generationTime: 1000, processingTime: 500, totalTime: 1500 },
          usage: { documentsGenerated: 1, filesProcessed: 1, tokensUsed: 100 },
          lastUpdated: new Date(),
        };

        const dto = plainToInstance(StatisticsResponseDto, malformedData);
        expect(dto.costs).toEqual({
          claudeApi: 0,
          storage: 0,
          compute: 0,
          total: 0,
        });
      });

      it('devrait gérer des données costs null', () => {
        const nullCostsData = {
          costs: null,
          performance: { generationTime: 1000, processingTime: 500, totalTime: 1500 },
          usage: { documentsGenerated: 1, filesProcessed: 1, tokensUsed: 100 },
          lastUpdated: new Date(),
        };

        const dto = plainToInstance(StatisticsResponseDto, nullCostsData);
        expect(dto.costs).toEqual({
          claudeApi: 0,
          storage: 0,
          compute: 0,
          total: 0,
        });
      });

      it('devrait gérer des données costs undefined', () => {
        const undefinedCostsData = {
          costs: undefined,
          performance: { generationTime: 1000, processingTime: 500, totalTime: 1500 },
          usage: { documentsGenerated: 1, filesProcessed: 1, tokensUsed: 100 },
          lastUpdated: new Date(),
        };

        const dto = plainToInstance(StatisticsResponseDto, undefinedCostsData);
        expect(dto.costs).toEqual({
          claudeApi: 0,
          storage: 0,
          compute: 0,
          total: 0,
        });
      });

      it('devrait gérer des données performance malformées', () => {
        const malformedData = {
          costs: { claudeApi: 0.1, storage: 0.01, compute: 0.01, total: 0.12 },
          performance: 'not an object',
          usage: { documentsGenerated: 1, filesProcessed: 1, tokensUsed: 100 },
          lastUpdated: new Date(),
        };

        const dto = plainToInstance(StatisticsResponseDto, malformedData);
        expect(dto.performance).toEqual({
          generationTime: 0,
          processingTime: 0,
          totalTime: 0,
        });
      });

      it('devrait gérer des données usage malformées', () => {
        const malformedData = {
          costs: { claudeApi: 0.1, storage: 0.01, compute: 0.01, total: 0.12 },
          performance: { generationTime: 1000, processingTime: 500, totalTime: 1500 },
          usage: 'not an object',
          lastUpdated: new Date(),
        };

        const dto = plainToInstance(StatisticsResponseDto, malformedData);
        expect(dto.usage).toEqual({
          documentsGenerated: 0,
          filesProcessed: 0,
          tokensUsed: 0,
        });
      });
    });

    describe('Valeurs numériques extrêmes', () => {
      it('devrait gérer des valeurs négatives dans performance', () => {
        const negativeData = {
          costs: { claudeApi: 0.1, storage: 0.01, compute: 0.01, total: 0.12 },
          performance: {
            generationTime: -1000, // Négatif
            processingTime: -500,  // Négatif
            totalTime: 1500,
          },
          usage: { documentsGenerated: 1, filesProcessed: 1, tokensUsed: 100 },
          lastUpdated: new Date(),
        };

        const dto = plainToInstance(StatisticsResponseDto, negativeData);
        expect(dto.performance.generationTime).toBe(0); // Converti en 0
        expect(dto.performance.processingTime).toBe(0);  // Converti en 0
      });

      it('devrait gérer des valeurs négatives dans costs', () => {
        const negativeData = {
          costs: {
            claudeApi: -0.1,  // Négatif
            storage: -0.01,   // Négatif
            compute: 0.01,
            total: 0.12,
          },
          performance: { generationTime: 1000, processingTime: 500, totalTime: 1500 },
          usage: { documentsGenerated: 1, filesProcessed: 1, tokensUsed: 100 },
          lastUpdated: new Date(),
        };

        const dto = plainToInstance(StatisticsResponseDto, negativeData);
        expect(dto.costs.claudeApi).toBe(-0.1); // Les coûts négatifs peuvent être acceptés (remboursements)
        expect(dto.costs.storage).toBe(-0.01);
      });

      it('devrait gérer des valeurs non-entières dans usage', () => {
        const floatData = {
          costs: { claudeApi: 0.1, storage: 0.01, compute: 0.01, total: 0.12 },
          performance: { generationTime: 1000, processingTime: 500, totalTime: 1500 },
          usage: {
            documentsGenerated: 5.7,  // Float
            filesProcessed: 3.9,      // Float
            tokensUsed: 1250.3,       // Float
          },
          lastUpdated: new Date(),
        };

        const dto = plainToInstance(StatisticsResponseDto, floatData);
        expect(dto.usage.documentsGenerated).toBe(5);    // Arrondi vers le bas
        expect(dto.usage.filesProcessed).toBe(3);        // Arrondi vers le bas
        expect(dto.usage.tokensUsed).toBe(1250);         // Arrondi vers le bas
      });

      it('devrait gérer des valeurs extrêmement grandes', () => {
        const extremeData = {
          costs: {
            claudeApi: Number.MAX_SAFE_INTEGER,
            storage: Number.MAX_SAFE_INTEGER,
            compute: Number.MAX_SAFE_INTEGER,
            total: Number.MAX_SAFE_INTEGER,
          },
          performance: {
            generationTime: Number.MAX_SAFE_INTEGER,
            processingTime: Number.MAX_SAFE_INTEGER,
            totalTime: Number.MAX_SAFE_INTEGER,
          },
          usage: {
            documentsGenerated: Number.MAX_SAFE_INTEGER,
            filesProcessed: Number.MAX_SAFE_INTEGER,
            tokensUsed: Number.MAX_SAFE_INTEGER,
          },
          lastUpdated: new Date(),
        };

        const dto = plainToInstance(StatisticsResponseDto, extremeData);
        expect(dto.costs.claudeApi).toBe(Number.MAX_SAFE_INTEGER);
        expect(dto.getTokensPerSecond()).toBeGreaterThan(0);
        expect(dto.getCostPerDocument()).toBeGreaterThan(0);
      });

      it('devrait gérer des valeurs infinies', () => {
        const infiniteData = {
          costs: {
            claudeApi: Infinity,
            storage: -Infinity,
            compute: 0.01,
            total: Infinity,
          },
          performance: {
            generationTime: Infinity,
            processingTime: 500,
            totalTime: Infinity,
          },
          usage: {
            documentsGenerated: 5,
            filesProcessed: 3,
            tokensUsed: Infinity,
          },
          lastUpdated: new Date(),
        };

        const dto = plainToInstance(StatisticsResponseDto, infiniteData);
        expect(dto.costs.claudeApi).toBe(Infinity);
        expect(dto.costs.storage).toBe(-Infinity);
        expect(dto.performance.generationTime).toBe(Infinity);
        expect(dto.usage.tokensUsed).toBe(Infinity);
      });

      it('devrait gérer des valeurs NaN', () => {
        const nanData = {
          costs: {
            claudeApi: NaN,
            storage: 0.01,
            compute: 0.01,
            total: NaN,
          },
          performance: {
            generationTime: NaN,
            processingTime: 500,
            totalTime: 1500,
          },
          usage: {
            documentsGenerated: NaN,
            filesProcessed: 3,
            tokensUsed: 1000,
          },
          lastUpdated: new Date(),
        };

        const dto = plainToInstance(StatisticsResponseDto, nanData);
        expect(dto.costs.claudeApi).toBeNaN();
        expect(dto.performance.generationTime).toBeNaN();
        expect(dto.usage.documentsGenerated).toBeNaN();
      });
    });

    describe('Dates limites', () => {
      it('devrait gérer une date lastUpdated future', () => {
        const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // Demain
        const futureData = {
          ...createValidStatisticsData(),
          lastUpdated: futureDate,
        };

        const dto = plainToInstance(StatisticsResponseDto, futureData);
        expect(dto.isDataFresh()).toBe(true); // Une date future est considérée comme fraîche
        expect(dto.lastUpdated).toEqual(futureDate);
      });

      it('devrait gérer une date lastUpdated très ancienne', () => {
        const ancientDate = new Date('1970-01-01T00:00:00Z');
        const ancientData = {
          ...createValidStatisticsData(),
          lastUpdated: ancientDate,
        };

        const dto = plainToInstance(StatisticsResponseDto, ancientData);
        expect(dto.isDataFresh()).toBe(false);
        expect(dto.lastUpdated).toEqual(ancientDate);
      });

      it('devrait gérer une date lastUpdated invalide', () => {
        const invalidDateData = {
          ...createValidStatisticsData(),
          lastUpdated: new Date('invalid-date'),
        };

        const dto = plainToInstance(StatisticsResponseDto, invalidDateData);
        expect(dto.lastUpdated).toBeInstanceOf(Date);
        expect(isNaN(dto.lastUpdated.getTime())).toBe(true);
      });
    });

    describe('Calculs edge cases', () => {
      it('devrait gérer division par zéro dans getCostPerDocument', () => {
        const zeroDivisorData = {
          ...createValidStatisticsData(),
          usage: { documentsGenerated: 0, filesProcessed: 0, tokensUsed: 0 },
        };

        const dto = plainToInstance(StatisticsResponseDto, zeroDivisorData);
        expect(dto.getCostPerDocument()).toBe(0); // Division par zéro gérée
      });

      it('devrait gérer division par zéro dans getTokensPerSecond', () => {
        const zeroTimeData = {
          ...createValidStatisticsData(),
          performance: { generationTime: 0, processingTime: 0, totalTime: 0 },
        };

        const dto = plainToInstance(StatisticsResponseDto, zeroTimeData);
        expect(dto.getTokensPerSecond()).toBe(0); // Division par zéro gérée
      });

      it('devrait gérer des calculs avec des valeurs très petites', () => {
        const tinyData = {
          costs: {
            claudeApi: 0.000001,
            storage: 0.000001,
            compute: 0.000001,
            total: 0.000003,
          },
          performance: {
            generationTime: 1, // 1ms
            processingTime: 1,
            totalTime: 2,
          },
          usage: {
            documentsGenerated: 1,
            filesProcessed: 1,
            tokensUsed: 1,
          },
          lastUpdated: new Date(),
        };

        const dto = plainToInstance(StatisticsResponseDto, tinyData);
        expect(dto.getCostPerDocument()).toBe(0.000003);
        expect(dto.getTokensPerSecond()).toBe(500); // 1 token / 0.002s = 500 tokens/s
      });
    });
  });

  // ========================================================================
  // EDGE CASES - ProjectResponseDto
  // ========================================================================

  describe('ProjectResponseDto - Edge Cases', () => {
    describe('Tableaux de fichiers malformés', () => {
      it('devrait filtrer les valeurs non-string dans les tableaux de fichiers', () => {
        const malformedData = {
          ...createMinimalProjectData(),
          uploadedFileIds: ['valid-uuid', 123, null, '', 'another-valid-uuid'],
          generatedFileIds: [null, 'valid-gen-uuid', undefined, false, 'another-gen-uuid'],
        };

        const dto = plainToInstance(ProjectResponseDto, malformedData);
        expect(dto.uploadedFileIds).toEqual(['valid-uuid', 'another-valid-uuid']);
        expect(dto.generatedFileIds).toEqual(['valid-gen-uuid', 'another-gen-uuid']);
      });

      it('devrait gérer des tableaux de fichiers non-array', () => {
        const malformedData = {
          ...createMinimalProjectData(),
          uploadedFileIds: 'not-an-array',
          generatedFileIds: null,
        };

        const dto = plainToInstance(ProjectResponseDto, malformedData);
        expect(dto.uploadedFileIds).toEqual([]);
        expect(dto.generatedFileIds).toEqual([]);
      });

      it('devrait gérer des tableaux contenant des objets', () => {
        const objectArrayData = {
          ...createMinimalProjectData(),
          uploadedFileIds: [{ id: 'object-id' }, 'valid-string', ['nested', 'array']],
          generatedFileIds: [new Date(), 42, 'valid-string'],
        };

        const dto = plainToInstance(ProjectResponseDto, objectArrayData);
        expect(dto.uploadedFileIds).toEqual(['valid-string']);
        expect(dto.generatedFileIds).toEqual(['valid-string']);
      });

      it('devrait gérer des tableaux très larges', () => {
        const largeArrayData = {
          ...createMinimalProjectData(),
          uploadedFileIds: Array.from({ length: 10000 }, (_, i) => `file-${i}`),
          generatedFileIds: Array.from({ length: 10000 }, (_, i) => `gen-${i}`),
        };

        const dto = plainToInstance(ProjectResponseDto, largeArrayData);
        expect(dto.uploadedFileIds).toHaveLength(10000);
        expect(dto.generatedFileIds).toHaveLength(10000);
        expect(dto.getTotalFilesCount()).toBe(20000);
      });

      it('devrait gérer des chaînes vides dans les tableaux', () => {
        const emptyStringData = {
          ...createMinimalProjectData(),
          uploadedFileIds: ['', '   ', 'valid-id', '\t\n', 'another-valid'],
          generatedFileIds: ['', 'valid-gen', ''],
        };

        const dto = plainToInstance(ProjectResponseDto, emptyStringData);
        expect(dto.uploadedFileIds).toEqual(['valid-id', 'another-valid']);
        expect(dto.generatedFileIds).toEqual(['valid-gen']);
      });
    });

    describe('Dates edge cases', () => {
      it('devrait gérer des dates créées et modifiées identiques (tolérance)', () => {
        const sameTimeData = {
          ...createMinimalProjectData(),
          createdAt: new Date('2024-08-08T10:30:00.000Z'),
          updatedAt: new Date('2024-08-08T10:30:00.500Z'), // 500ms de différence
        };

        const dto = plainToInstance(ProjectResponseDto, sameTimeData);
        expect(dto.hasBeenModified()).toBe(false); // Moins de 1 seconde = pas modifié
      });

      it('devrait gérer des dates futures', () => {
        const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // Demain
        const futureData = {
          ...createMinimalProjectData(),
          createdAt: futureDate,
          updatedAt: futureDate,
        };

        const dto = plainToInstance(ProjectResponseDto, futureData);
        expect(dto.getAgeInDays()).toBeGreaterThanOrEqual(0);
        expect(dto.createdAt).toEqual(futureDate);
        expect(dto.updatedAt).toEqual(futureDate);
      });

      it('devrait gérer des dates très anciennes', () => {
        const ancientDate = new Date('1970-01-01T00:00:00Z');
        const ancientData = {
          ...createMinimalProjectData(),
          createdAt: ancientDate,
          updatedAt: ancientDate,
        };

        const dto = plainToInstance(ProjectResponseDto, ancientData);
        expect(dto.getAgeInDays()).toBeGreaterThan(365 * 50); // Plus de 50 ans
        expect(dto.isRecent()).toBe(false);
      });

      it('devrait gérer des dates invalides', () => {
        const invalidDateData = {
          ...createMinimalProjectData(),
          createdAt: new Date('invalid-date'),
          updatedAt: new Date('also-invalid'),
        };

        const dto = plainToInstance(ProjectResponseDto, invalidDateData);
        expect(dto.createdAt).toBeInstanceOf(Date);
        expect(dto.updatedAt).toBeInstanceOf(Date);
        expect(isNaN(dto.createdAt.getTime())).toBe(true);
        expect(isNaN(dto.updatedAt.getTime())).toBe(true);
      });

      it('devrait gérer un âge de 0 jours (projet créé aujourd\'hui)', () => {
        const now = new Date();
        const todayData = {
          ...createMinimalProjectData(),
          createdAt: now,
          updatedAt: now,
        };

        const dto = plainToInstance(ProjectResponseDto, todayData);
        expect(dto.getAgeInDays()).toBe(0);
        expect(dto.isRecent()).toBe(true);
      });
    });

    describe('Prompt initial edge cases', () => {
      it('devrait gérer un prompt initial vide pour la complexité', () => {
        const emptyPromptData = {
          ...createMinimalProjectData(),
          initialPrompt: '',
        };

        const dto = plainToInstance(ProjectResponseDto, emptyPromptData);
        expect(dto.getComplexityEstimate()).toBe('low');
      });

      it('devrait gérer un prompt initial très long', () => {
        const longPromptData = {
          ...createMinimalProjectData(),
          initialPrompt: 'A'.repeat(10000), // 10k caractères
        };

        const dto = plainToInstance(ProjectResponseDto, longPromptData);
        expect(dto.getComplexityEstimate()).toBe('high');
        expect(dto.initialPrompt).toHaveLength(10000);
      });

      it('devrait gérer un prompt initial avec caractères spéciaux', () => {
        const specialCharsPrompt = {
          ...createMinimalProjectData(),
          initialPrompt: '🚀 Create a web app with émojis and spéciàl characters ñoël 中文',
        };

        const dto = plainToInstance(ProjectResponseDto, specialCharsPrompt);
        expect(dto.getComplexityEstimate()).toBe('medium');
        expect(dto.initialPrompt).toContain('🚀');
        expect(dto.initialPrompt).toContain('中文');
      });

      it('devrait gérer un prompt initial uniquement composé d\'espaces', () => {
        const whitespacePromptData = {
          ...createMinimalProjectData(),
          initialPrompt: '   \t\n   ',
        };

        const dto = plainToInstance(ProjectResponseDto, whitespacePromptData);
        expect(dto.getComplexityEstimate()).toBe('low');
      });
    });

    describe('Statistiques edge cases', () => {
      it('devrait gérer des statistics undefined vs null vs objet vide', () => {
        const undefinedStatsData = { ...createMinimalProjectData(), statistics: undefined };
        const nullStatsData = { ...createMinimalProjectData(), statistics: null };
        const emptyStatsData = { ...createMinimalProjectData(), statistics: {} };

        const undefinedDto = plainToInstance(ProjectResponseDto, undefinedStatsData);
        const nullDto = plainToInstance(ProjectResponseDto, nullStatsData);
        const emptyDto = plainToInstance(ProjectResponseDto, emptyStatsData);

        expect(undefinedDto.hasStatistics()).toBe(false);
        expect(nullDto.hasStatistics()).toBe(false);
        expect(emptyDto.hasStatistics()).toBe(true); // Objet vide = présent
      });

      it('devrait gérer des statistiques malformées', () => {
        const malformedStatsData = {
          ...createMinimalProjectData(),
          statistics: 'not an object',
        };

        const dto = plainToInstance(ProjectResponseDto, malformedStatsData);
        expect(dto.hasStatistics()).toBe(true); // String = objet présent
        expect(dto.getTotalCost()).toBeNull(); // Mais pas accessible
        expect(dto.getDocumentsCount()).toBeNull();
      });

      it('devrait gérer des statistiques avec propriétés manquantes', () => {
        const incompleteStatsData = {
          ...createMinimalProjectData(),
          statistics: {
            costs: { claudeApi: 0.5 }, // Propriétés manquantes
            // performance manquant
            usage: {}, // Vide
            lastUpdated: new Date(),
          },
        };

        const dto = plainToInstance(ProjectResponseDto, incompleteStatsData);
        expect(dto.hasStatistics()).toBe(true);
        expect(dto.statistics).toBeInstanceOf(StatisticsResponseDto);
      });
    });

    describe('Calculs edge cases', () => {
      it('devrait gérer getTotalFilesCount avec de très grandes listes', () => {
        const massiveFileData = {
          ...createMinimalProjectData(),
          uploadedFileIds: Array.from({ length: 50000 }, (_, i) => `upload-${i}`),
          generatedFileIds: Array.from({ length: 50000 }, (_, i) => `gen-${i}`),
        };

        const dto = plainToInstance(ProjectResponseDto, massiveFileData);
        expect(dto.getTotalFilesCount()).toBe(100000);
        expect(dto.hasUploadedFiles()).toBe(true);
        expect(dto.hasGeneratedFiles()).toBe(true);
      });

      it('devrait gérer getActivityLevel avec des cas limites', () => {
        // Projet créé exactement il y a 7 jours
        const exactlySevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const sevenDayData = {
          ...createMinimalProjectData(),
          createdAt: exactlySevenDaysAgo,
          generatedFileIds: ['file1'],
        };

        const dto = plainToInstance(ProjectResponseDto, sevenDayData);
        expect(dto.getActivityLevel()).toBe('active');
        expect(dto.isRecent()).toBe(true); // Exactement 7 jours = encore récent
      });

      it('devrait gérer getComplexityEstimate avec des cas limites de longueur', () => {
        // Prompt de 50 caractères exactement
        const exactFiftyCharsData = {
          ...createMinimalProjectData(),
          initialPrompt: 'A'.repeat(50), // Exactement 50 chars, 1 mot
        };

        const dto = plainToInstance(ProjectResponseDto, exactFiftyCharsData);
        expect(dto.getComplexityEstimate()).toBe('medium'); // 50 chars et 1 mot -> medium (pas low car >= 50)
      });
    });

    describe('Statuts edge cases', () => {
      it('devrait gérer tous les statuts possibles', () => {
        const statuses = Object.values(ProjectStatus);

        statuses.forEach(status => {
          const statusData = { ...createMinimalProjectData(), status };
          const dto = plainToInstance(ProjectResponseDto, statusData);
          
          expect(dto.status).toBe(status);
          expect(typeof dto.isAccessible()).toBe('boolean');
        });
      });

      it('devrait gérer un statut invalide/inexistant', () => {
        const invalidStatusData = {
          ...createMinimalProjectData(),
          status: 'INVALID_STATUS' as ProjectStatus,
        };

        const dto = plainToInstance(ProjectResponseDto, invalidStatusData);
        expect(dto.status).toBe('INVALID_STATUS');
        expect(dto.isAccessible()).toBe(false); // Status inconnu = pas accessible
      });
    });

    describe('Cas de données corrompues', () => {
      it('devrait gérer un objet complètement vide', () => {
        const emptyData = {};

        const dto = plainToInstance(ProjectResponseDto, emptyData);
        expect(dto).toBeInstanceOf(ProjectResponseDto);
        expect(dto.uploadedFileIds).toEqual([]);
        expect(dto.generatedFileIds).toEqual([]);
        expect(dto.getTotalFilesCount()).toBe(0);
      });

      it('devrait gérer des données partiellement corrompues', () => {
        const corruptedData = {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Valid Name',
          // initialPrompt manquant
          status: ProjectStatus.ACTIVE,
          uploadedFileIds: ['valid-file'],
          generatedFileIds: null,
          createdAt: 'not-a-date',
          updatedAt: new Date(),
          statistics: { invalid: 'structure' },
        };

        const dto = plainToInstance(ProjectResponseDto, corruptedData);
        expect(dto.name).toBe('Valid Name');
        expect(dto.uploadedFileIds).toEqual(['valid-file']);
        expect(dto.generatedFileIds).toEqual([]); // null converti en []
        expect(dto.hasStatistics()).toBe(true); // Objet présent même si invalide
      });

      it('devrait gérer des propriétés avec des types complètement incorrects', () => {
        const wrongTypesData = {
          id: 123, // Number au lieu de string
          name: ['array', 'instead', 'of', 'string'],
          initialPrompt: { object: 'instead of string' },
          status: true, // Boolean au lieu d'enum
          uploadedFileIds: 'string-instead-of-array',
          generatedFileIds: 42,
          createdAt: 'definitely-not-a-date',
          updatedAt: null,
        };

        const dto = plainToInstance(ProjectResponseDto, wrongTypesData);
        expect(dto).toBeInstanceOf(ProjectResponseDto);
        expect(dto.uploadedFileIds).toEqual([]);
        expect(dto.generatedFileIds).toEqual([]);
      });
    });

    describe('Sérialisation avec options', () => {
      it('devrait sérialiser correctement avec excludeExtraneousValues', () => {
        const dataWithExtraFields = {
          ...createMinimalProjectData(),
          extraField: 'should not appear',
          anotherExtra: 123,
        };

        const dto = plainToInstance(ProjectResponseDto, dataWithExtraFields);
        const json = instanceToPlain(dto, { excludeExtraneousValues: true });

        expect(json).not.toHaveProperty('extraField');
        expect(json).not.toHaveProperty('anotherExtra');
        expect(json).toHaveProperty('id');
        expect(json).toHaveProperty('name');
      });

      it('devrait gérer les cycles de sérialisation avec options', () => {
        const data = createMinimalProjectData();
        
        const dto1 = plainToInstance(ProjectResponseDto, data);
        const json1 = instanceToPlain(dto1, { excludeExtraneousValues: true });
        const dto2 = plainToInstance(ProjectResponseDto, json1);
        const json2 = instanceToPlain(dto2, { excludeExtraneousValues: true });

        expect(json1).toEqual(json2);
        expect(dto1.name).toBe(dto2.name);
        expect(dto1.getTotalFilesCount()).toBe(dto2.getTotalFilesCount());
      });
    });
  });
});