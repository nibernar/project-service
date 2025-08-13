// test/unit/project/dto/project-response.dto.spec.ts

import { plainToInstance, instanceToPlain } from 'class-transformer';
import { ProjectResponseDto, StatisticsResponseDto } from '../../../../src/project/dto/project-response.dto';
import { ProjectStatus } from '../../../../src/common/enums/project-status.enum';

describe('ProjectResponseDto - Tests de Base', () => {
  // ========================================================================
  // FIXTURES ET DONNÉES DE TEST
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

  const createValidProjectData = () => ({
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Test Project',
    description: 'A test project description',
    initialPrompt: 'Create a simple web application with user authentication',
    status: ProjectStatus.ACTIVE,
    uploadedFileIds: ['file1-uuid', 'file2-uuid'],
    generatedFileIds: ['gen1-uuid', 'gen2-uuid', 'gen3-uuid'],
    createdAt: new Date('2024-08-08T10:30:00Z'),
    updatedAt: new Date('2024-08-08T14:30:00Z'),
    statistics: createValidStatisticsData(),
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
  // TESTS DE BASE - StatisticsResponseDto
  // ========================================================================

  describe('StatisticsResponseDto', () => {
    describe('Construction et transformations', () => {
      it('devrait créer une instance valide avec toutes les données', () => {
        const data = createValidStatisticsData();
        const dto = plainToInstance(StatisticsResponseDto, data);

        expect(dto).toBeInstanceOf(StatisticsResponseDto);
        expect(dto.costs.claudeApi).toBe(0.45);
        expect(dto.costs.storage).toBe(0.02);
        expect(dto.costs.compute).toBe(0.01);
        expect(dto.costs.total).toBe(0.48);
        expect(dto.performance.generationTime).toBe(12500);
        expect(dto.performance.processingTime).toBe(2300);
        expect(dto.performance.totalTime).toBe(14800);
        expect(dto.usage.documentsGenerated).toBe(5);
        expect(dto.usage.filesProcessed).toBe(3);
        expect(dto.usage.tokensUsed).toBe(1250);
        expect(dto.lastUpdated).toEqual(new Date('2024-08-08T14:30:00Z'));
      });

      it('devrait appliquer les valeurs par défaut quand les données sont manquantes', () => {
        const emptyData = { lastUpdated: new Date() };
        const dto = plainToInstance(StatisticsResponseDto, emptyData);

        expect(dto.costs.claudeApi).toBe(0);
        expect(dto.costs.storage).toBe(0);
        expect(dto.costs.compute).toBe(0);
        expect(dto.costs.total).toBe(0);
        expect(dto.performance.generationTime).toBe(0);
        expect(dto.performance.processingTime).toBe(0);
        expect(dto.performance.totalTime).toBe(0);
        expect(dto.usage.documentsGenerated).toBe(0);
        expect(dto.usage.filesProcessed).toBe(0);
        expect(dto.usage.tokensUsed).toBe(0);
      });

      it('devrait recalculer le total des coûts si manquant ou incohérent', () => {
        const dataWithoutTotal = {
          costs: {
            claudeApi: 0.30,
            storage: 0.05,
            compute: 0.02,
            total: 0, // Total manquant
          },
          performance: { generationTime: 1000, processingTime: 500, totalTime: 1500 },
          usage: { documentsGenerated: 1, filesProcessed: 1, tokensUsed: 100 },
          lastUpdated: new Date(),
        };

        const dto = plainToInstance(StatisticsResponseDto, dataWithoutTotal);
        expect(dto.costs.total).toBe(0.37); // 0.30 + 0.05 + 0.02
      });

      it('devrait recalculer le temps total si manquant', () => {
        const dataWithoutTotalTime = {
          costs: { claudeApi: 0.1, storage: 0.01, compute: 0.01, total: 0.12 },
          performance: {
            generationTime: 8000,
            processingTime: 1500,
            totalTime: 0, // Total manquant
          },
          usage: { documentsGenerated: 2, filesProcessed: 1, tokensUsed: 500 },
          lastUpdated: new Date(),
        };

        const dto = plainToInstance(StatisticsResponseDto, dataWithoutTotalTime);
        expect(dto.performance.totalTime).toBe(9500); // 8000 + 1500
      });
    });

    describe('Méthodes utilitaires', () => {
      let validDto: StatisticsResponseDto;

      beforeEach(() => {
        validDto = plainToInstance(StatisticsResponseDto, createValidStatisticsData());
      });

      it('getCostPerDocument() devrait calculer le coût par document', () => {
        expect(validDto.getCostPerDocument()).toBe(0.096); // 0.48 / 5
      });

      it('getCostPerDocument() devrait retourner 0 si aucun document généré', () => {
        const noDocsData = { ...createValidStatisticsData(), usage: { documentsGenerated: 0, filesProcessed: 0, tokensUsed: 0 } };
        const dto = plainToInstance(StatisticsResponseDto, noDocsData);
        expect(dto.getCostPerDocument()).toBe(0);
      });

      it('getTokensPerSecond() devrait calculer la vitesse de traitement', () => {
        // 1250 tokens / (14800ms / 1000) = 1250 / 14.8 ≈ 84.46
        expect(validDto.getTokensPerSecond()).toBe(84.46);
      });

      it('getTokensPerSecond() devrait retourner 0 si temps total est 0', () => {
        const noTimeData = { 
          ...createValidStatisticsData(), 
          performance: { generationTime: 0, processingTime: 0, totalTime: 0 } 
        };
        const dto = plainToInstance(StatisticsResponseDto, noTimeData);
        expect(dto.getTokensPerSecond()).toBe(0);
      });

      it('isDataFresh() devrait retourner true pour données récentes', () => {
        const recentData = { ...createValidStatisticsData(), lastUpdated: new Date() };
        const dto = plainToInstance(StatisticsResponseDto, recentData);
        expect(dto.isDataFresh()).toBe(true);
      });

      it('isDataFresh() devrait retourner false pour données anciennes', () => {
        const oldDate = new Date();
        oldDate.setDate(oldDate.getDate() - 2); // Il y a 2 jours
        const oldData = { ...createValidStatisticsData(), lastUpdated: oldDate };
        const dto = plainToInstance(StatisticsResponseDto, oldData);
        expect(dto.isDataFresh()).toBe(false);
      });

      it('getPerformanceSummary() devrait retourner les bonnes évaluations', () => {
        // Test avec différentes vitesses
        const excellentData = { 
          ...createValidStatisticsData(), 
          performance: { generationTime: 1000, processingTime: 0, totalTime: 1000 },
          usage: { documentsGenerated: 1, filesProcessed: 1, tokensUsed: 150 } // 150 tokens/s
        };
        const excellentDto = plainToInstance(StatisticsResponseDto, excellentData);
        expect(excellentDto.getPerformanceSummary()).toBe('excellent');

        const goodData = { 
          ...createValidStatisticsData(), 
          performance: { generationTime: 1000, processingTime: 0, totalTime: 1000 },
          usage: { documentsGenerated: 1, filesProcessed: 1, tokensUsed: 75 } // 75 tokens/s
        };
        const goodDto = plainToInstance(StatisticsResponseDto, goodData);
        expect(goodDto.getPerformanceSummary()).toBe('good');

        const averageData = { 
          ...createValidStatisticsData(), 
          performance: { generationTime: 1000, processingTime: 0, totalTime: 1000 },
          usage: { documentsGenerated: 1, filesProcessed: 1, tokensUsed: 30 } // 30 tokens/s
        };
        const averageDto = plainToInstance(StatisticsResponseDto, averageData);
        expect(averageDto.getPerformanceSummary()).toBe('average');

        const slowData = { 
          ...createValidStatisticsData(), 
          performance: { generationTime: 1000, processingTime: 0, totalTime: 1000 },
          usage: { documentsGenerated: 1, filesProcessed: 1, tokensUsed: 10 } // 10 tokens/s
        };
        const slowDto = plainToInstance(StatisticsResponseDto, slowData);
        expect(slowDto.getPerformanceSummary()).toBe('slow');
      });
    });
  });

  // ========================================================================
  // TESTS DE BASE - ProjectResponseDto
  // ========================================================================

  describe('ProjectResponseDto', () => {
    describe('Construction et sérialisation', () => {
      it('devrait créer une instance valide avec toutes les propriétés', () => {
        const data = createValidProjectData();
        const dto = plainToInstance(ProjectResponseDto, data);

        expect(dto).toBeInstanceOf(ProjectResponseDto);
        expect(dto.id).toBe('550e8400-e29b-41d4-a716-446655440000');
        expect(dto.name).toBe('Test Project');
        expect(dto.description).toBe('A test project description');
        expect(dto.initialPrompt).toBe('Create a simple web application with user authentication');
        expect(dto.status).toBe(ProjectStatus.ACTIVE);
        expect(dto.uploadedFileIds).toEqual(['file1-uuid', 'file2-uuid']);
        expect(dto.generatedFileIds).toEqual(['gen1-uuid', 'gen2-uuid', 'gen3-uuid']);
        expect(dto.createdAt).toEqual(new Date('2024-08-08T10:30:00Z'));
        expect(dto.updatedAt).toEqual(new Date('2024-08-08T14:30:00Z'));
        expect(dto.statistics).toBeInstanceOf(StatisticsResponseDto);
      });

      it('devrait créer une instance minimale sans description ni statistiques', () => {
        const data = createMinimalProjectData();
        const dto = plainToInstance(ProjectResponseDto, data);

        expect(dto.name).toBe('Minimal Project');
        expect(dto.description).toBeUndefined();
        expect(dto.statistics).toBeUndefined();
        expect(dto.uploadedFileIds).toEqual([]);
        expect(dto.generatedFileIds).toEqual([]);
      });

      it('devrait transformer correctement vers JSON avec instanceToPlain', () => {
        const data = createValidProjectData();
        const dto = plainToInstance(ProjectResponseDto, data);
        const json = instanceToPlain(dto, { excludeExtraneousValues: true });

        expect(json.id).toBe('550e8400-e29b-41d4-a716-446655440000');
        expect(json.name).toBe('Test Project');
        expect(json.status).toBe('ACTIVE');
        expect(json.uploadedFileIds).toEqual(['file1-uuid', 'file2-uuid']);
        expect(json.statistics).toBeDefined();
        expect(json.statistics.costs.total).toBe(0.48);
      });

      it('devrait sérialiser correctement tous les champs @Expose()', () => {
        const data = createValidProjectData();
        const dto = plainToInstance(ProjectResponseDto, data);
        const json = instanceToPlain(dto, { excludeExtraneousValues: true });

        // Vérifier que tous les champs @Expose() sont présents
        expect(json).toHaveProperty('id');
        expect(json).toHaveProperty('name');
        expect(json).toHaveProperty('description');
        expect(json).toHaveProperty('initialPrompt');
        expect(json).toHaveProperty('status');
        expect(json).toHaveProperty('uploadedFileIds');
        expect(json).toHaveProperty('generatedFileIds');
        expect(json).toHaveProperty('createdAt');
        expect(json).toHaveProperty('updatedAt');
        expect(json).toHaveProperty('statistics');

        // Vérifier que les champs non-@Expose() ne sont PAS présents
        expect(json).not.toHaveProperty('ownerId'); // Ce champ n'est pas exposé
      });

      it('devrait exclure correctement les champs non-@Expose()', () => {
        const dataWithExtraFields = {
          ...createValidProjectData(),
          ownerId: 'user-123', // Champ qui ne devrait pas être exposé
          internalField: 'secret', // Champ qui ne devrait pas être exposé
        };

        const dto = plainToInstance(ProjectResponseDto, dataWithExtraFields);
        const json = instanceToPlain(dto, { excludeExtraneousValues: true });

        expect(json).not.toHaveProperty('ownerId');
        expect(json).not.toHaveProperty('internalField');
      });

      it('devrait préserver les types Date avec @Type()', () => {
        const data = createValidProjectData();
        const dto = plainToInstance(ProjectResponseDto, data);

        expect(dto.createdAt).toBeInstanceOf(Date);
        expect(dto.updatedAt).toBeInstanceOf(Date);
        expect(dto.statistics?.lastUpdated).toBeInstanceOf(Date);
      });

      it('devrait gérer la désérialisation depuis JSON', () => {
        const jsonData = {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'JSON Project',
          initialPrompt: 'From JSON',
          status: 'ACTIVE',
          uploadedFileIds: ['file1'],
          generatedFileIds: ['gen1'],
          createdAt: '2024-08-08T10:30:00.000Z',
          updatedAt: '2024-08-08T14:30:00.000Z',
          statistics: {
            costs: { claudeApi: 0.5, storage: 0.1, compute: 0.05, total: 0.65 },
            performance: { generationTime: 1000, processingTime: 500, totalTime: 1500 },
            usage: { documentsGenerated: 3, filesProcessed: 2, tokensUsed: 750 },
            lastUpdated: '2024-08-08T15:00:00.000Z',
          },
        };

        const dto = plainToInstance(ProjectResponseDto, jsonData);

        expect(dto.name).toBe('JSON Project');
        expect(dto.createdAt).toBeInstanceOf(Date);
        expect(dto.statistics).toBeInstanceOf(StatisticsResponseDto);
        expect(dto.statistics?.costs.total).toBe(0.65);
      });
    });

    describe('Méthodes utilitaires - Fichiers', () => {
      it('hasUploadedFiles() devrait retourner true/false correctement', () => {
        const withFiles = plainToInstance(ProjectResponseDto, createValidProjectData());
        const withoutFiles = plainToInstance(ProjectResponseDto, createMinimalProjectData());

        expect(withFiles.hasUploadedFiles()).toBe(true);
        expect(withoutFiles.hasUploadedFiles()).toBe(false);
      });

      it('hasGeneratedFiles() devrait retourner true/false correctement', () => {
        const withFiles = plainToInstance(ProjectResponseDto, createValidProjectData());
        const withoutFiles = plainToInstance(ProjectResponseDto, createMinimalProjectData());

        expect(withFiles.hasGeneratedFiles()).toBe(true);
        expect(withoutFiles.hasGeneratedFiles()).toBe(false);
      });

      it('getTotalFilesCount() devrait compter tous les fichiers', () => {
        const withFiles = plainToInstance(ProjectResponseDto, createValidProjectData());
        const withoutFiles = plainToInstance(ProjectResponseDto, createMinimalProjectData());

        expect(withFiles.getTotalFilesCount()).toBe(5); // 2 uploaded + 3 generated
        expect(withoutFiles.getTotalFilesCount()).toBe(0);
      });
    });

    describe('Méthodes utilitaires - Statistiques', () => {
      it('hasStatistics() devrait détecter la présence de statistiques', () => {
        const withStats = plainToInstance(ProjectResponseDto, createValidProjectData());
        const withoutStats = plainToInstance(ProjectResponseDto, createMinimalProjectData());

        expect(withStats.hasStatistics()).toBe(true);
        expect(withoutStats.hasStatistics()).toBe(false);
      });

      it('getTotalCost() devrait retourner le coût ou null', () => {
        const withStats = plainToInstance(ProjectResponseDto, createValidProjectData());
        const withoutStats = plainToInstance(ProjectResponseDto, createMinimalProjectData());

        expect(withStats.getTotalCost()).toBe(0.48);
        expect(withoutStats.getTotalCost()).toBeNull();
      });

      it('getDocumentsCount() devrait retourner le nombre de documents ou null', () => {
        const withStats = plainToInstance(ProjectResponseDto, createValidProjectData());
        const withoutStats = plainToInstance(ProjectResponseDto, createMinimalProjectData());

        expect(withStats.getDocumentsCount()).toBe(5);
        expect(withoutStats.getDocumentsCount()).toBeNull();
      });
    });

    describe('Méthodes utilitaires - Dates et âge', () => {
      it('getAgeInDays() devrait calculer l\'âge en jours', () => {
        // Créer un projet vieux de 5 jours
        const oldDate = new Date();
        oldDate.setDate(oldDate.getDate() - 5);
        
        const oldProjectData = {
          ...createMinimalProjectData(),
          createdAt: oldDate,
        };
        const dto = plainToInstance(ProjectResponseDto, oldProjectData);
        
        expect(dto.getAgeInDays()).toBe(5);
      });

      it('hasBeenModified() devrait détecter les modifications', () => {
        const modifiedData = {
          ...createMinimalProjectData(),
          createdAt: new Date('2024-08-08T10:30:00Z'),
          updatedAt: new Date('2024-08-08T14:30:00Z'), // 4h plus tard
        };
        const unmodifiedData = {
          ...createMinimalProjectData(),
          createdAt: new Date('2024-08-08T10:30:00Z'),
          updatedAt: new Date('2024-08-08T10:30:00Z'), // Même heure
        };

        const modifiedDto = plainToInstance(ProjectResponseDto, modifiedData);
        const unmodifiedDto = plainToInstance(ProjectResponseDto, unmodifiedData);

        expect(modifiedDto.hasBeenModified()).toBe(true);
        expect(unmodifiedDto.hasBeenModified()).toBe(false);
      });

      it('isRecent() devrait identifier les projets récents', () => {
        const recentData = {
          ...createMinimalProjectData(),
          createdAt: new Date(), // Aujourd'hui
        };
        const oldData = {
          ...createMinimalProjectData(),
          createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // Il y a 10 jours
        };

        const recentDto = plainToInstance(ProjectResponseDto, recentData);
        const oldDto = plainToInstance(ProjectResponseDto, oldData);

        expect(recentDto.isRecent()).toBe(true);
        expect(oldDto.isRecent()).toBe(false);
      });
    });

    describe('Méthodes utilitaires - Statut et accessibilité', () => {
      it('isAccessible() devrait retourner true pour ACTIVE et ARCHIVED', () => {
        const activeData = { ...createMinimalProjectData(), status: ProjectStatus.ACTIVE };
        const archivedData = { ...createMinimalProjectData(), status: ProjectStatus.ARCHIVED };
        const deletedData = { ...createMinimalProjectData(), status: ProjectStatus.DELETED };

        const activeDto = plainToInstance(ProjectResponseDto, activeData);
        const archivedDto = plainToInstance(ProjectResponseDto, archivedData);
        const deletedDto = plainToInstance(ProjectResponseDto, deletedData);

        expect(activeDto.isAccessible()).toBe(true);
        expect(archivedDto.isAccessible()).toBe(true);
        expect(deletedDto.isAccessible()).toBe(false);
      });

      it('getActivityLevel() devrait classifier l\'activité correctement', () => {
        const today = new Date();
        
        // Nouveau projet (aujourd'hui, pas de fichiers)
        const newData = {
          ...createMinimalProjectData(),
          createdAt: today,
          updatedAt: today,
          generatedFileIds: [],
        };
        const newDto = plainToInstance(ProjectResponseDto, newData);
        expect(newDto.getActivityLevel()).toBe('new');

        // Projet actif (récent avec fichiers et modifications)
        const activeData = {
          ...createMinimalProjectData(),
          createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // Il y a 2 jours
          updatedAt: today,
          generatedFileIds: ['file1', 'file2'],
        };
        const activeDto = plainToInstance(ProjectResponseDto, activeData);
        expect(activeDto.getActivityLevel()).toBe('active');

        // Projet mature (ancien avec fichiers)
        const matureData = {
          ...createMinimalProjectData(),
          createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // Il y a 60 jours
          generatedFileIds: ['file1'],
        };
        const matureDto = plainToInstance(ProjectResponseDto, matureData);
        expect(matureDto.getActivityLevel()).toBe('mature');

        // Projet inactif
        const inactiveData = {
          ...createMinimalProjectData(),
          createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // Il y a 10 jours
          generatedFileIds: [],
        };
        const inactiveDto = plainToInstance(ProjectResponseDto, inactiveData);
        expect(inactiveDto.getActivityLevel()).toBe('inactive');
      });
    });

    describe('Méthodes utilitaires - Complexité et métadonnées', () => {
      it('getComplexityEstimate() devrait estimer la complexité', () => {
        const lowComplexityData = {
          ...createMinimalProjectData(),
          initialPrompt: 'Simple app', // 10 caractères, 2 mots
        };
        const mediumComplexityData = {
          ...createMinimalProjectData(),
          initialPrompt: 'Create a web application with user authentication and basic dashboard features', // 87 caractères, 12 mots
        };
        const highComplexityData = {
          ...createMinimalProjectData(),
          initialPrompt: 'Create a comprehensive enterprise resource planning system with multiple modules including inventory management, customer relationship management, financial reporting, human resources management, supply chain optimization, real-time analytics, role-based access control, multi-tenant architecture, API integration capabilities, and mobile application support', // Plus de 200 caractères et 35 mots
        };

        const lowDto = plainToInstance(ProjectResponseDto, lowComplexityData);
        const mediumDto = plainToInstance(ProjectResponseDto, mediumComplexityData);
        const highDto = plainToInstance(ProjectResponseDto, highComplexityData);

        expect(lowDto.getComplexityEstimate()).toBe('low');
        expect(mediumDto.getComplexityEstimate()).toBe('medium');
        expect(highDto.getComplexityEstimate()).toBe('high');
      });

      it('getMetadata() devrait retourner les métadonnées non sensibles', () => {
        const data = createValidProjectData();
        const dto = plainToInstance(ProjectResponseDto, data);
        const metadata = dto.getMetadata();

        expect(metadata).toEqual({
          id: '550e8400-e29b-41d4-a716-446655440000',
          status: ProjectStatus.ACTIVE,
          ageInDays: expect.any(Number),
          totalFiles: 5,
          hasStatistics: true,
          complexity: 'medium', // Le prompt initial a 64 caractères et 10 mots -> medium
          activityLevel: expect.any(String),
        });

        // Vérifier qu'aucune donnée sensible n'est présente
        expect(metadata).not.toHaveProperty('name');
        expect(metadata).not.toHaveProperty('description');
        expect(metadata).not.toHaveProperty('initialPrompt');
      });
    });

    describe('Méthodes toString et logging', () => {
      it('toString() devrait générer un résumé lisible', () => {
        const data = createValidProjectData();
        const dto = plainToInstance(ProjectResponseDto, data);
        const result = dto.toString();

        expect(result).toContain('Test Project');
        expect(result).toContain('ACTIVE');
        expect(result).toContain('files=5');
        expect(result).toContain('cost=0.48€');
      });

      it('toLogSafeString() ne devrait exposer aucune donnée sensible', () => {
        const data = createValidProjectData();
        const dto = plainToInstance(ProjectResponseDto, data);
        const safeString = dto.toLogSafeString();

        expect(safeString).toContain('550e8400-e29b-41d4-a716-446655440000');
        expect(safeString).toContain('ACTIVE');
        expect(safeString).toContain('files=5');
        expect(safeString).toContain('stats=true');
        
        // Vérifier qu'aucune donnée sensible n'est présente
        expect(safeString).not.toContain('Test Project');
        expect(safeString).not.toContain('test project description');
        expect(safeString).not.toContain('authentication');
      });
    });

    describe('Inclusion conditionnelle', () => {
      it('devrait inclure les statistiques quand présentes', () => {
        const dataWithStats = createValidProjectData();
        const dto = plainToInstance(ProjectResponseDto, dataWithStats);
        const json = instanceToPlain(dto, { excludeExtraneousValues: true });

        expect(json.statistics).toBeDefined();
        expect(json.statistics.costs).toBeDefined();
        expect(json.statistics.performance).toBeDefined();
        expect(json.statistics.usage).toBeDefined();
      });

      it('devrait exclure les statistiques quand absentes', () => {
        const dataWithoutStats = createMinimalProjectData();
        const dto = plainToInstance(ProjectResponseDto, dataWithoutStats);
        const json = instanceToPlain(dto, { excludeExtraneousValues: true });

        expect(json.statistics).toBeUndefined();
      });

      it('devrait gérer description optionnelle', () => {
        const withDesc = createValidProjectData();
        const withoutDesc = { ...createMinimalProjectData(), description: undefined };

        const dtoWith = plainToInstance(ProjectResponseDto, withDesc);
        const dtoWithout = plainToInstance(ProjectResponseDto, withoutDesc);

        const jsonWith = instanceToPlain(dtoWith, { excludeExtraneousValues: true });
        const jsonWithout = instanceToPlain(dtoWithout, { excludeExtraneousValues: true });

        expect(jsonWith.description).toBe('A test project description');
        expect(jsonWithout.description).toBeUndefined();
      });
    });

    describe('Cycles de sérialisation/désérialisation', () => {
      it('devrait préserver toutes les données à travers plusieurs cycles', () => {
        const originalData = createValidProjectData();
        
        // Cycle 1: Data -> DTO -> JSON -> DTO
        const dto1 = plainToInstance(ProjectResponseDto, originalData);
        const json1 = instanceToPlain(dto1, { excludeExtraneousValues: true });
        const dto2 = plainToInstance(ProjectResponseDto, json1);
        
        // Cycle 2: DTO -> JSON -> DTO
        const json2 = instanceToPlain(dto2, { excludeExtraneousValues: true });
        const dto3 = plainToInstance(ProjectResponseDto, json2);

        // Vérifier que les données sont préservées
        expect(dto3.name).toBe(originalData.name);
        expect(dto3.description).toBe(originalData.description);
        expect(dto3.getTotalFilesCount()).toBe(5);
        expect(dto3.hasStatistics()).toBe(true);
        expect(dto3.statistics?.costs.total).toBe(0.48);
      });

      it('devrait maintenir la cohérence des méthodes utilitaires', () => {
        const data = createValidProjectData();
        
        // Transformer plusieurs fois
        const dto1 = plainToInstance(ProjectResponseDto, data);
        const json = instanceToPlain(dto1, { excludeExtraneousValues: true });
        const dto2 = plainToInstance(ProjectResponseDto, json);

        // Les méthodes utilitaires doivent donner les mêmes résultats
        expect(dto1.hasUploadedFiles()).toBe(dto2.hasUploadedFiles());
        expect(dto1.hasGeneratedFiles()).toBe(dto2.hasGeneratedFiles());
        expect(dto1.getTotalFilesCount()).toBe(dto2.getTotalFilesCount());
        expect(dto1.hasStatistics()).toBe(dto2.hasStatistics());
        expect(dto1.isAccessible()).toBe(dto2.isAccessible());
        expect(dto1.getComplexityEstimate()).toBe(dto2.getComplexityEstimate());
      });
    });
  });
});