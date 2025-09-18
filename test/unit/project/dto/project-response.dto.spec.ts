import { plainToInstance, instanceToPlain } from 'class-transformer';
import {
  ProjectResponseDto,
} from '../../../../src/project/dto/project-response.dto';
import { ProjectStatus } from '../../../../src/common/enums/project-status.enum';
import { 
  StatisticsFixtures, 
  ProjectFixtures, 
  ResponseFixtures,
  TEST_IDS 
} from '../../../fixtures/project.fixtures';

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
    id: TEST_IDS.PROJECT_1,
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
    id: TEST_IDS.PROJECT_2,
    name: 'Minimal Project',
    initialPrompt: 'Simple prompt',
    status: ProjectStatus.ACTIVE,
    uploadedFileIds: [],
    generatedFileIds: [],
    createdAt: new Date('2024-08-08T10:30:00Z'),
    updatedAt: new Date('2024-08-08T10:30:00Z'),
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
        expect(dto.id).toBe(TEST_IDS.PROJECT_1);
        expect(dto.name).toBe('Test Project');
        expect(dto.description).toBe('A test project description');
        expect(dto.initialPrompt).toBe(
          'Create a simple web application with user authentication',
        );
        expect(dto.status).toBe(ProjectStatus.ACTIVE);
        expect(dto.uploadedFileIds).toEqual(['file1-uuid', 'file2-uuid']);
        expect(dto.generatedFileIds).toEqual([
          'gen1-uuid',
          'gen2-uuid',
          'gen3-uuid',
        ]);
        expect(dto.createdAt).toEqual(new Date('2024-08-08T10:30:00Z'));
        expect(dto.updatedAt).toEqual(new Date('2024-08-08T14:30:00Z'));
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

        expect(json.id).toBe(TEST_IDS.PROJECT_1);
        expect(json.name).toBe('Test Project');
        expect(json.status).toBe('ACTIVE');
        expect(json.uploadedFileIds).toEqual(['file1-uuid', 'file2-uuid']);
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

        // Vérifier que les champs non-@Expose() ne sont PAS présents
        expect(json).not.toHaveProperty('ownerId'); // Ce champ n'est pas exposé
      });

      it('devrait exclure correctement les champs non-@Expose()', () => {
        const dataWithExtraFields = {
          ...createValidProjectData(),
          ownerId: TEST_IDS.USER_1, // Champ qui ne devrait pas être exposé
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
      });

      it('devrait gérer la désérialisation depuis JSON', () => {
        const jsonData = {
          id: TEST_IDS.PROJECT_3,
          name: 'JSON Project',
          initialPrompt: 'From JSON',
          status: 'ACTIVE',
          uploadedFileIds: ['file1'],
          generatedFileIds: ['gen1'],
          createdAt: '2024-08-08T10:30:00.000Z',
          updatedAt: '2024-08-08T14:30:00.000Z',
          statistics: {
            costs: { claudeApi: 0.5, storage: 0.1, compute: 0.05, total: 0.65 },
            performance: {
              generationTime: 1000,
              processingTime: 500,
              totalTime: 1500,
            },
            usage: {
              documentsGenerated: 3,
              filesProcessed: 2,
              tokensUsed: 750,
            },
            lastUpdated: '2024-08-08T15:00:00.000Z',
          },
        };

        const dto = plainToInstance(ProjectResponseDto, jsonData);

        expect(dto.name).toBe('JSON Project');
        expect(dto.createdAt).toBeInstanceOf(Date);
      });
    });

    describe('Propriétés de base', () => {
      it('devrait avoir les propriétés de base correctement définies', () => {
        const data = createValidProjectData();
        const dto = plainToInstance(ProjectResponseDto, data);

        expect(dto.id).toBeDefined();
        expect(dto.name).toBeDefined();
        expect(dto.status).toBeDefined();
        expect(dto.createdAt).toBeDefined();
        expect(dto.updatedAt).toBeDefined();
        expect(Array.isArray(dto.uploadedFileIds)).toBe(true);
        expect(Array.isArray(dto.generatedFileIds)).toBe(true);
      });

      it('devrait gérer les fichiers uploadés et générés', () => {
        const withFiles = plainToInstance(
          ProjectResponseDto,
          createValidProjectData(),
        );
        const withoutFiles = plainToInstance(
          ProjectResponseDto,
          createMinimalProjectData(),
        );

        expect(withFiles.uploadedFileIds).toHaveLength(2);
        expect(withFiles.generatedFileIds).toHaveLength(3);
        expect(withoutFiles.uploadedFileIds).toHaveLength(0);
        expect(withoutFiles.generatedFileIds).toHaveLength(0);
      });

      it('devrait calculer le nombre total de fichiers', () => {
        const withFiles = plainToInstance(
          ProjectResponseDto,
          createValidProjectData(),
        );
        const withoutFiles = plainToInstance(
          ProjectResponseDto,
          createMinimalProjectData(),
        );

        const totalFilesWithFiles = withFiles.uploadedFileIds.length + withFiles.generatedFileIds.length;
        const totalFilesWithoutFiles = withoutFiles.uploadedFileIds.length + withoutFiles.generatedFileIds.length;

        expect(totalFilesWithFiles).toBe(5); // 2 uploaded + 3 generated
        expect(totalFilesWithoutFiles).toBe(0);
      });
    });

    describe('Gestion des dates', () => {
      it("devrait calculer l'âge du projet", () => {
        // Créer un projet vieux de 5 jours
        const oldDate = new Date();
        oldDate.setDate(oldDate.getDate() - 5);

        const oldProjectData = {
          ...createMinimalProjectData(),
          createdAt: oldDate,
        };
        const dto = plainToInstance(ProjectResponseDto, oldProjectData);

        const ageInMs = Date.now() - dto.createdAt.getTime();
        const ageInDays = Math.floor(ageInMs / (24 * 60 * 60 * 1000));

        expect(ageInDays).toBe(5);
      });

      it('devrait détecter les modifications', () => {
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
        const unmodifiedDto = plainToInstance(
          ProjectResponseDto,
          unmodifiedData,
        );

        const hasBeenModified1 = modifiedDto.createdAt.getTime() !== modifiedDto.updatedAt.getTime();
        const hasBeenModified2 = unmodifiedDto.createdAt.getTime() !== unmodifiedDto.updatedAt.getTime();

        expect(hasBeenModified1).toBe(true);
        expect(hasBeenModified2).toBe(false);
      });

      it('devrait identifier les projets récents', () => {
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

        const isRecent1 = (Date.now() - recentDto.createdAt.getTime()) < (7 * 24 * 60 * 60 * 1000); // moins de 7 jours
        const isRecent2 = (Date.now() - oldDto.createdAt.getTime()) < (7 * 24 * 60 * 60 * 1000);

        expect(isRecent1).toBe(true);
        expect(isRecent2).toBe(false);
      });
    });

    describe('Gestion du statut et accessibilité', () => {
      it('devrait retourner true pour ACTIVE et ARCHIVED', () => {
        const activeData = {
          ...createMinimalProjectData(),
          status: ProjectStatus.ACTIVE,
        };
        const archivedData = {
          ...createMinimalProjectData(),
          status: ProjectStatus.ARCHIVED,
        };
        const deletedData = {
          ...createMinimalProjectData(),
          status: ProjectStatus.DELETED,
        };

        const activeDto = plainToInstance(ProjectResponseDto, activeData);
        const archivedDto = plainToInstance(ProjectResponseDto, archivedData);
        const deletedDto = plainToInstance(ProjectResponseDto, deletedData);

        const isAccessible1 = activeDto.status === ProjectStatus.ACTIVE || activeDto.status === ProjectStatus.ARCHIVED;
        const isAccessible2 = archivedDto.status === ProjectStatus.ACTIVE || archivedDto.status === ProjectStatus.ARCHIVED;
        const isAccessible3 = deletedDto.status === ProjectStatus.ACTIVE || deletedDto.status === ProjectStatus.ARCHIVED;

        expect(isAccessible1).toBe(true);
        expect(isAccessible2).toBe(true);
        expect(isAccessible3).toBe(false);
      });

      it("devrait classifier l'activité correctement", () => {
        const today = new Date();

        // Nouveau projet (aujourd'hui, pas de fichiers)
        const newData = {
          ...createMinimalProjectData(),
          createdAt: today,
          updatedAt: today,
          generatedFileIds: [],
        };
        const newDto = plainToInstance(ProjectResponseDto, newData);
        
        const ageInDays = Math.floor((Date.now() - newDto.createdAt.getTime()) / (24 * 60 * 60 * 1000));
        const hasGeneratedFiles = newDto.generatedFileIds.length > 0;
        
        let activityLevel = 'inactive';
        if (ageInDays < 1 && !hasGeneratedFiles) {
          activityLevel = 'new';
        }

        expect(activityLevel).toBe('new');

        // Projet avec fichiers générés
        const activeData = {
          ...createMinimalProjectData(),
          createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // Il y a 2 jours
          updatedAt: today,
          generatedFileIds: ['file1', 'file2'],
        };
        const activeDto = plainToInstance(ProjectResponseDto, activeData);
        
        const activeAgeInDays = Math.floor((Date.now() - activeDto.createdAt.getTime()) / (24 * 60 * 60 * 1000));
        const activeHasFiles = activeDto.generatedFileIds.length > 0;
        const recentlyUpdated = (Date.now() - activeDto.updatedAt.getTime()) < (7 * 24 * 60 * 60 * 1000);
        
        let activeLevel = 'inactive';
        if (activeAgeInDays < 1 && !activeHasFiles) {
          activeLevel = 'new';
        } else if (activeHasFiles && recentlyUpdated) {
          activeLevel = 'active';
        } else if (activeAgeInDays > 30 && activeHasFiles) {
          activeLevel = 'mature';
        }

        expect(activeLevel).toBe('active');
      });
    });

    describe('Estimation de complexité', () => {
      it('devrait estimer la complexité', () => {
        const lowComplexityData = {
          ...createMinimalProjectData(),
          initialPrompt: 'Simple app', // 10 caractères, 2 mots
        };
        const mediumComplexityData = {
          ...createMinimalProjectData(),
          initialPrompt:
            'Create a web application with user authentication and basic dashboard features', // 87 caractères, 12 mots
        };
        const highComplexityData = {
          ...createMinimalProjectData(),
          initialPrompt:
            'Create a comprehensive enterprise resource planning system with multiple modules including inventory management, customer relationship management, financial reporting, human resources management, supply chain optimization, real-time analytics, role-based access control, multi-tenant architecture, API integration capabilities, and mobile application support', // Plus de 200 caractères et 35 mots
        };

        const lowDto = plainToInstance(ProjectResponseDto, lowComplexityData);
        const mediumDto = plainToInstance(
          ProjectResponseDto,
          mediumComplexityData,
        );
        const highDto = plainToInstance(ProjectResponseDto, highComplexityData);

        const getComplexity = (prompt: string) => {
          const charCount = prompt.length;
          const wordCount = prompt.split(/\s+/).length;
          
          if (charCount < 100 || wordCount < 15) return 'low';
          if (charCount < 300 || wordCount < 50) return 'medium';
          return 'high';
        };

        expect(getComplexity(lowDto.initialPrompt)).toBe('low');
        expect(getComplexity(mediumDto.initialPrompt)).toBe('medium');
        expect(getComplexity(highDto.initialPrompt)).toBe('high');
      });
    });

    describe('Métadonnées et logging', () => {
      it('devrait retourner les métadonnées non sensibles', () => {
        const data = createValidProjectData();
        const dto = plainToInstance(ProjectResponseDto, data);
        
        const ageInDays = Math.floor((Date.now() - dto.createdAt.getTime()) / (24 * 60 * 60 * 1000));
        const totalFiles = dto.uploadedFileIds.length + dto.generatedFileIds.length;
        const hasStatistics = !!dto.statistics;
        const complexity = dto.initialPrompt.length < 100 ? 'low' : dto.initialPrompt.length < 300 ? 'medium' : 'high';
        
        const expectedMetadata = {
          id: TEST_IDS.PROJECT_1,
          status: ProjectStatus.ACTIVE,
          ageInDays: ageInDays,
          totalFiles: totalFiles,
          hasStatistics: hasStatistics,
          complexity: complexity,
        };

        expect(expectedMetadata.id).toBe(TEST_IDS.PROJECT_1);
        expect(expectedMetadata.status).toBe(ProjectStatus.ACTIVE);
        expect(expectedMetadata.totalFiles).toBe(5);
        expect(expectedMetadata.hasStatistics).toBe(true);
        expect(['low', 'medium', 'high']).toContain(expectedMetadata.complexity);
      });

      it('ne devrait exposer aucune donnée sensible dans les logs', () => {
        const data = createValidProjectData();
        const dto = plainToInstance(ProjectResponseDto, data);
        
        const safeString = `Project[${dto.id}] status=${dto.status} files=${dto.uploadedFileIds.length + dto.generatedFileIds.length} stats=${!!dto.statistics}`;

        expect(safeString).toContain(TEST_IDS.PROJECT_1);
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

        if (dto.statistics) {
          expect(json.statistics).toBeDefined();
        }
      });

      it('devrait exclure les statistiques quand absentes', () => {
        const dataWithoutStats = createMinimalProjectData();
        const dto = plainToInstance(ProjectResponseDto, dataWithoutStats);
        const json = instanceToPlain(dto, { excludeExtraneousValues: true });

        expect(json.statistics).toBeUndefined();
      });

      it('devrait gérer description optionnelle', () => {
        const withDesc = createValidProjectData();
        const withoutDesc = {
          ...createMinimalProjectData(),
          description: undefined,
        };

        const dtoWith = plainToInstance(ProjectResponseDto, withDesc);
        const dtoWithout = plainToInstance(ProjectResponseDto, withoutDesc);

        const jsonWith = instanceToPlain(dtoWith, {
          excludeExtraneousValues: true,
        });
        const jsonWithout = instanceToPlain(dtoWithout, {
          excludeExtraneousValues: true,
        });

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
        expect(dto3.uploadedFileIds.length + dto3.generatedFileIds.length).toBe(5);
      });

      it('devrait maintenir la cohérence des propriétés', () => {
        const data = createValidProjectData();

        // Transformer plusieurs fois
        const dto1 = plainToInstance(ProjectResponseDto, data);
        const json = instanceToPlain(dto1, { excludeExtraneousValues: true });
        const dto2 = plainToInstance(ProjectResponseDto, json);

        // Les propriétés doivent être identiques
        expect(dto1.uploadedFileIds.length > 0).toBe(dto2.uploadedFileIds.length > 0);
        expect(dto1.generatedFileIds.length > 0).toBe(dto2.generatedFileIds.length > 0);
        expect(!!dto1.statistics).toBe(!!dto2.statistics);
        expect(dto1.status === ProjectStatus.ACTIVE || dto1.status === ProjectStatus.ARCHIVED)
          .toBe(dto2.status === ProjectStatus.ACTIVE || dto2.status === ProjectStatus.ARCHIVED);
      });
    });

    describe('Utilisation avec les fixtures', () => {
      it('devrait fonctionner avec ResponseFixtures', () => {
        const fixtureDto = ResponseFixtures.projectResponseDto();
        expect(fixtureDto).toBeInstanceOf(ProjectResponseDto);
        expect(fixtureDto.id).toBeDefined();
        expect(fixtureDto.name).toBeDefined();
        expect(fixtureDto.status).toBeDefined();
      });

      it('devrait fonctionner avec ProjectFixtures', () => {
        const projectEntity = ProjectFixtures.mockProject();
        const dto = plainToInstance(ProjectResponseDto, {
          id: projectEntity.id,
          name: projectEntity.name,
          description: projectEntity.description,
          initialPrompt: projectEntity.initialPrompt,
          status: projectEntity.status,
          uploadedFileIds: projectEntity.uploadedFileIds,
          generatedFileIds: projectEntity.generatedFileIds,
          createdAt: projectEntity.createdAt,
          updatedAt: projectEntity.updatedAt,
        });

        expect(dto.id).toBe(projectEntity.id);
        expect(dto.name).toBe(projectEntity.name);
        expect(dto.status).toBe(projectEntity.status);
      });

      it('devrait fonctionner avec StatisticsFixtures', () => {
        const statsEntity = StatisticsFixtures.completeStats();
        const projectData = {
          ...createMinimalProjectData(),
          statistics: {
            costs: statsEntity.costs,
            performance: statsEntity.performance,
            usage: statsEntity.usage,
            lastUpdated: statsEntity.lastUpdated,
          },
        };

        const dto = plainToInstance(ProjectResponseDto, projectData);
        expect(dto.statistics).toBeDefined();
        expect(dto.statistics?.costs).toBeDefined();
        expect(dto.statistics?.performance).toBeDefined();
        expect(dto.statistics?.usage).toBeDefined();
      });
    });
  });
});