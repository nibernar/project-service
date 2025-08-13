// test/unit/project/dto/project-response.dto.regression.spec.ts

import { plainToInstance, instanceToPlain } from 'class-transformer';
import { ProjectResponseDto, StatisticsResponseDto } from '../../../../src/project/dto/project-response.dto';
import { ProjectStatus } from '../../../../src/common/enums/project-status.enum';

describe('ProjectResponseDto - Tests de Régression', () => {
  // ========================================================================
  // FIXTURES POUR LES TESTS DE RÉGRESSION
  // ========================================================================

  // Données représentant un ancien format (avant évolutions)
  const createLegacyProjectData = () => ({
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Legacy Project',
    description: 'Legacy description',
    initialPrompt: 'Old format prompt',
    status: 'ACTIVE', // String au lieu d'enum dans d'anciennes versions
    createdAt: '2024-08-08T10:30:00Z', // String au lieu de Date
    updatedAt: '2024-08-08T10:30:00Z',
    // uploadedFileIds et generatedFileIds manquants dans certaines versions
  });

  // Données avec un format intermédiaire
  const createIntermediateProjectData = () => ({
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Intermediate Project',
    description: 'Intermediate description',
    initialPrompt: 'Intermediate format prompt',
    status: ProjectStatus.ACTIVE,
    uploadedFileIds: null, // null au lieu de [] dans certaines versions
    generatedFileIds: undefined, // undefined au lieu de []
    createdAt: new Date('2024-08-08T10:30:00Z'),
    updatedAt: new Date('2024-08-08T10:30:00Z'),
  });

  // Données modernes complètes
  const createModernProjectData = () => ({
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Modern Project',
    description: 'Modern description with all features',
    initialPrompt: 'Modern comprehensive prompt with all latest features',
    status: ProjectStatus.ACTIVE,
    uploadedFileIds: ['file1-uuid', 'file2-uuid'],
    generatedFileIds: ['gen1-uuid', 'gen2-uuid', 'gen3-uuid'],
    createdAt: new Date('2024-08-08T10:30:00Z'),
    updatedAt: new Date('2024-08-08T14:30:00Z'),
    statistics: {
      costs: { claudeApi: 0.45, storage: 0.02, compute: 0.01, total: 0.48 },
      performance: { generationTime: 12500, processingTime: 2300, totalTime: 14800 },
      usage: { documentsGenerated: 5, filesProcessed: 3, tokensUsed: 1250 },
      lastUpdated: new Date('2024-08-08T14:30:00Z'),
    },
  });

  // ========================================================================
  // TESTS DE BACKWARD COMPATIBILITY
  // ========================================================================

  describe('Backward Compatibility', () => {
    describe('Compatibilité des formats de données', () => {
      it('devrait maintenir la compatibilité avec les anciennes données manquant des champs', () => {
        const legacyData = createLegacyProjectData();
        const dto = plainToInstance(ProjectResponseDto, legacyData);
        
        // Les champs doivent être correctement initialisés même s'ils manquent
        expect(dto.name).toBe('Legacy Project');
        expect(dto.status).toBe(ProjectStatus.ACTIVE);
        expect(dto.createdAt).toBeInstanceOf(Date);
        expect(dto.uploadedFileIds).toEqual([]);
        expect(dto.generatedFileIds).toEqual([]);
        expect(dto.hasUploadedFiles()).toBe(false);
        expect(dto.getTotalFilesCount()).toBe(0);
        expect(dto.hasStatistics()).toBe(false);
      });

      it('devrait gérer les données avec des valeurs null/undefined', () => {
        const intermediateData = createIntermediateProjectData();
        const dto = plainToInstance(ProjectResponseDto, intermediateData);
        
        expect(dto.uploadedFileIds).toEqual([]);
        expect(dto.generatedFileIds).toEqual([]);
        expect(dto.hasUploadedFiles()).toBe(false);
        expect(dto.hasGeneratedFiles()).toBe(false);
        expect(dto.getTotalFilesCount()).toBe(0);
      });

      it('devrait maintenir la compatibilité avec des statistiques manquantes', () => {
        const dataWithoutStats = {
          ...createModernProjectData(),
          statistics: undefined,
        };
        
        const dto = plainToInstance(ProjectResponseDto, dataWithoutStats);
        
        expect(dto.hasStatistics()).toBe(false);
        expect(dto.getTotalCost()).toBeNull();
        expect(dto.getDocumentsCount()).toBeNull();
      });

      it('devrait gérer les statistiques partielles (anciennes versions)', () => {
        const partialStatsData = {
          ...createModernProjectData(),
          statistics: {
            costs: { claudeApi: 0.5, total: 0.5 }, // Champs manquants
            lastUpdated: new Date(),
            // performance et usage manquants
          },
        };
        
        const dto = plainToInstance(ProjectResponseDto, partialStatsData);
        
        expect(dto.hasStatistics()).toBe(true);
        expect(dto.statistics).toBeInstanceOf(StatisticsResponseDto);
        expect(dto.statistics?.costs.claudeApi).toBe(0.5);
        expect(dto.statistics?.costs.storage).toBe(0); // Valeur par défaut
        expect(dto.statistics?.costs.compute).toBe(0); // Valeur par défaut
      });
    });

    describe('Évolution des types de données', () => {
      it('devrait convertir les anciens formats de statut (string vers enum)', () => {
        const oldStatusFormats = [
          { status: 'ACTIVE', expected: ProjectStatus.ACTIVE },
          { status: 'ARCHIVED', expected: ProjectStatus.ARCHIVED },
          { status: 'DELETED', expected: ProjectStatus.DELETED },
          { status: 'active', expected: 'active' }, // Préservé tel quel si non reconnu
        ];

        oldStatusFormats.forEach(({ status, expected }) => {
          const data = { ...createLegacyProjectData(), status };
          const dto = plainToInstance(ProjectResponseDto, data);
          expect(dto.status).toBe(expected);
        });
      });

      it('devrait convertir les anciennes dates (string vers Date)', () => {
        const stringDateData = {
          ...createLegacyProjectData(),
          createdAt: '2024-08-08T10:30:00.000Z',
          updatedAt: '2024-08-08T14:30:00.000Z',
        };
        
        const dto = plainToInstance(ProjectResponseDto, stringDateData);
        
        expect(dto.createdAt).toBeInstanceOf(Date);
        expect(dto.updatedAt).toBeInstanceOf(Date);
        expect(dto.createdAt.getTime()).toBe(new Date('2024-08-08T10:30:00.000Z').getTime());
        expect(dto.updatedAt.getTime()).toBe(new Date('2024-08-08T14:30:00.000Z').getTime());
      });

      it('devrait gérer l\'évolution des formats de tableaux', () => {
        const evolutionaryFormats = [
          { uploadedFileIds: undefined, generatedFileIds: null },
          { uploadedFileIds: [], generatedFileIds: [] },
          { uploadedFileIds: ['file1'], generatedFileIds: ['gen1'] },
          { uploadedFileIds: 'single-file', generatedFileIds: 'single-gen' }, // Format invalide ancien
        ];

        evolutionaryFormats.forEach(fileFormats => {
          const data = { ...createModernProjectData(), ...fileFormats };
          const dto = plainToInstance(ProjectResponseDto, data);
          
          expect(Array.isArray(dto.uploadedFileIds)).toBe(true);
          expect(Array.isArray(dto.generatedFileIds)).toBe(true);
          expect(typeof dto.getTotalFilesCount()).toBe('number');
        });
      });
    });

    describe('Migration des structures de statistiques', () => {
      it('devrait migrer les anciennes structures de coûts', () => {
        const oldCostStructure = {
          ...createModernProjectData(),
          statistics: {
            // Ancienne structure simplifiée
            totalCost: 0.75,
            processingTime: 15000,
            documentsCount: 7,
            lastUpdated: new Date(),
          },
        };
        
        const dto = plainToInstance(ProjectResponseDto, oldCostStructure);
        
        expect(dto.hasStatistics()).toBe(true);
        expect(dto.statistics).toBeInstanceOf(StatisticsResponseDto);
        // Les valeurs par défaut doivent être appliquées pour les champs manquants
        expect(dto.statistics?.costs.claudeApi).toBe(0);
        expect(dto.statistics?.costs.storage).toBe(0);
        expect(dto.statistics?.costs.compute).toBe(0);
        expect(dto.statistics?.costs.total).toBe(0);
      });

      it('devrait préserver les données lors de la migration vers de nouveaux formats', () => {
        const mixedFormatData = {
          ...createModernProjectData(),
          statistics: {
            costs: { api: 0.5, storage: 0.1 }, // Anciens noms de champs
            performance: { generation: 1000, processing: 500 }, // Anciens noms
            usage: { docs: 3, files: 2, tokens: 750 }, // Anciens noms
            lastUpdated: new Date(),
          },
        };
        
        const dto = plainToInstance(ProjectResponseDto, mixedFormatData);
        
        // Les nouvelles structures doivent être créées avec des valeurs par défaut
        expect(dto.statistics?.costs.claudeApi).toBe(0);
        expect(dto.statistics?.costs.storage).toBe(0);
        expect(dto.statistics?.performance.generationTime).toBe(0);
        expect(dto.statistics?.usage.documentsGenerated).toBe(0);
      });
    });
  });

  // ========================================================================
  // TESTS DE STABILITÉ DES CALCULS
  // ========================================================================

  describe('Stabilité des calculs', () => {
    describe('Cohérence des calculs temporels', () => {
      it('devrait maintenir la cohérence des calculs d\'âge dans le temps', () => {
        const fixedDate = new Date('2024-08-08T10:30:00Z');
        const data = {
          ...createModernProjectData(),
          createdAt: fixedDate,
          updatedAt: new Date(fixedDate.getTime() + 4 * 60 * 60 * 1000), // +4h
        };

        const dto = plainToInstance(ProjectResponseDto, data);
        
        // Ces calculs doivent rester stables
        expect(dto.hasBeenModified()).toBe(true);
        expect(dto.getAgeInDays()).toBeGreaterThanOrEqual(0);
        
        // Le calcul d'âge doit être déterministe pour une date fixée
        const age1 = dto.getAgeInDays();
        const age2 = dto.getAgeInDays();
        expect(age1).toBe(age2);
      });

      it('devrait maintenir la cohérence des calculs de complexité', () => {
        const testCases = [
          { prompt: 'Simple app', expected: 'low' },
          { prompt: 'Create a web application with user authentication and basic dashboard features', expected: 'medium' },
          { prompt: 'Create a comprehensive enterprise resource planning system with multiple modules including inventory management, customer relationship management, financial reporting', expected: 'high' },
        ];

        testCases.forEach(({ prompt, expected }) => {
          const data = { ...createModernProjectData(), initialPrompt: prompt };
          const dto = plainToInstance(ProjectResponseDto, data);
          
          expect(dto.getComplexityEstimate()).toBe(expected);
        });
      });

      it('devrait maintenir la cohérence des calculs de niveau d\'activité', () => {
        const today = new Date();
        const testScenarios = [
          {
            name: 'nouveau projet',
            createdAt: today,
            updatedAt: today,
            generatedFileIds: [],
            expected: 'new'
          },
          {
            name: 'projet actif',
            createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // Il y a 2 jours
            updatedAt: today,
            generatedFileIds: ['file1', 'file2'],
            expected: 'active'
          },
          {
            name: 'projet mature',
            createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // Il y a 60 jours
            updatedAt: new Date(Date.now() - 50 * 24 * 60 * 60 * 1000),
            generatedFileIds: ['file1'],
            expected: 'mature'
          }
        ];

        testScenarios.forEach(({ name, createdAt, updatedAt, generatedFileIds, expected }) => {
          const data = {
            ...createModernProjectData(),
            createdAt,
            updatedAt,
            generatedFileIds,
          };
          const dto = plainToInstance(ProjectResponseDto, data);
          
          expect(dto.getActivityLevel()).toBe(expected);
        });
      });
    });

    describe('Stabilité des calculs de statistiques', () => {
      it('devrait maintenir la cohérence des calculs de coût par document', () => {
        const testCases = [
          { costs: { total: 1.0 }, usage: { documentsGenerated: 4 }, expected: 0.25 },
          { costs: { total: 0.0 }, usage: { documentsGenerated: 5 }, expected: 0 },
          { costs: { total: 2.4 }, usage: { documentsGenerated: 0 }, expected: 0 },
        ];

        testCases.forEach(({ costs, usage, expected }) => {
          const statsData = {
            costs: { claudeApi: 0, storage: 0, compute: 0, ...costs },
            performance: { generationTime: 1000, processingTime: 500, totalTime: 1500 },
            usage: { documentsGenerated: 0, filesProcessed: 0, tokensUsed: 0, ...usage },
            lastUpdated: new Date(),
          };
          
          const dto = plainToInstance(StatisticsResponseDto, statsData);
          expect(dto.getCostPerDocument()).toBe(expected);
        });
      });

      it('devrait maintenir la cohérence des calculs de vitesse de traitement', () => {
        const testCases = [
          { performance: { totalTime: 1000 }, usage: { tokensUsed: 100 }, expected: 100 }, // 100 tokens/s
          { performance: { totalTime: 2000 }, usage: { tokensUsed: 100 }, expected: 50 },  // 50 tokens/s
          { performance: { totalTime: 0 }, usage: { tokensUsed: 100 }, expected: 0 },      // Division par zéro
        ];

        testCases.forEach(({ performance, usage, expected }) => {
          const statsData = {
            costs: { claudeApi: 0, storage: 0, compute: 0, total: 0 },
            performance: { generationTime: 0, processingTime: 0, totalTime: 0, ...performance },
            usage: { documentsGenerated: 0, filesProcessed: 0, tokensUsed: 0, ...usage },
            lastUpdated: new Date(),
          };
          
          const dto = plainToInstance(StatisticsResponseDto, statsData);
          expect(dto.getTokensPerSecond()).toBe(expected);
        });
      });

      it('devrait maintenir la cohérence des évaluations de performance', () => {
        const performanceThresholds = [
          { tokensPerSecond: 150, expected: 'excellent' },
          { tokensPerSecond: 75, expected: 'good' },
          { tokensPerSecond: 30, expected: 'average' },
          { tokensPerSecond: 10, expected: 'slow' },
        ];

        performanceThresholds.forEach(({ tokensPerSecond, expected }) => {
          // Calculer le temps nécessaire pour obtenir le tokensPerSecond souhaité
          const totalTime = 1000; // 1 seconde
          const tokensUsed = tokensPerSecond * (totalTime / 1000);
          
          const statsData = {
            costs: { claudeApi: 0, storage: 0, compute: 0, total: 0 },
            performance: { generationTime: totalTime, processingTime: 0, totalTime },
            usage: { documentsGenerated: 1, filesProcessed: 1, tokensUsed },
            lastUpdated: new Date(),
          };
          
          const dto = plainToInstance(StatisticsResponseDto, statsData);
          expect(dto.getPerformanceSummary()).toBe(expected);
        });
      });
    });
  });

  // ========================================================================
  // TESTS DE FORMATS DE SORTIE STABLES
  // ========================================================================

  describe('Stabilité des formats de sortie', () => {
    describe('Format toString()', () => {
      it('devrait maintenir le format de toString() dans le temps', () => {
        const data = createModernProjectData();
        const dto = plainToInstance(ProjectResponseDto, data);
        const result = dto.toString();

        // Le format doit contenir ces éléments clés dans un ordre prévisible
        expect(result).toMatch(/^Project\[.*\]\(.*\)$/);
        expect(result).toContain('Modern Project');
        expect(result).toContain('ACTIVE');
        expect(result).toContain('files=5');
        expect(result).toContain('cost=0.48€');
      });

      it('devrait maintenir la cohérence du format toString() avec différents projets', () => {
        const projects = [
          createLegacyProjectData(),
          createIntermediateProjectData(),
          createModernProjectData(),
        ];

        projects.forEach(data => {
          const dto = plainToInstance(ProjectResponseDto, data);
          const result = dto.toString();
          
          // Tous doivent suivre le même pattern
          expect(result).toMatch(/^Project\[.*\]\(.*\)$/);
          expect(result).toContain(data.name);
        });
      });

      it('devrait maintenir la stabilité du format avec des données edge case', () => {
        const edgeCaseData = {
          ...createModernProjectData(),
          name: '',
          uploadedFileIds: [],
          generatedFileIds: [],
          statistics: undefined,
        };

        const dto = plainToInstance(ProjectResponseDto, edgeCaseData);
        const result = dto.toString();

        expect(result).toMatch(/^Project\[.*\]\(.*\)$/);
        expect(result).toContain('files=0');
      });
    });

    describe('Format toLogSafeString()', () => {
      it('devrait maintenir la sécurité du format de log dans le temps', () => {
        const sensitiveData = {
          ...createModernProjectData(),
          name: 'Super Secret Project',
          description: 'Confidential information',
          initialPrompt: 'Secret military project details',
        };

        const dto = plainToInstance(ProjectResponseDto, sensitiveData);
        const safeString = dto.toLogSafeString();

        // Ces vérifications de sécurité doivent rester stables dans toutes les versions
        expect(safeString).toContain('id=550e8400-e29b-41d4-a716-446655440000');
        expect(safeString).toContain('status=ACTIVE');
        expect(safeString).toContain('files=5');
        
        // Aucune donnée sensible ne doit apparaître
        expect(safeString).not.toContain('Super Secret');
        expect(safeString).not.toContain('Confidential');
        expect(safeString).not.toContain('military');
      });

      it('devrait maintenir le format standardisé des logs sécurisés', () => {
        const data = createModernProjectData();
        const dto = plainToInstance(ProjectResponseDto, data);
        const safeString = dto.toLogSafeString();

        // Le format doit être prévisible et parseable
        expect(safeString).toMatch(/^Project\[id=[a-f0-9-]+, status=\w+, age=\d+d, files=\d+, stats=(true|false), complexity=\w+\]$/);
      });
    });

    describe('Format getMetadata()', () => {
      it('devrait maintenir la structure des métadonnées dans le temps', () => {
        const data = createModernProjectData();
        const dto = plainToInstance(ProjectResponseDto, data);
        const metadata = dto.getMetadata();

        // La structure doit rester stable
        const expectedKeys = [
          'id', 'status', 'ageInDays', 'totalFiles', 
          'hasStatistics', 'complexity', 'activityLevel'
        ];
        
        expectedKeys.forEach(key => {
          expect(metadata).toHaveProperty(key);
        });

        // Aucune donnée sensible ne doit être présente
        expect(metadata).not.toHaveProperty('name');
        expect(metadata).not.toHaveProperty('description');
        expect(metadata).not.toHaveProperty('initialPrompt');
      });

      it('devrait maintenir la cohérence des types dans les métadonnées', () => {
        const data = createModernProjectData();
        const dto = plainToInstance(ProjectResponseDto, data);
        const metadata = dto.getMetadata();

        expect(typeof metadata.id).toBe('string');
        expect(typeof metadata.status).toBe('string');
        expect(typeof metadata.ageInDays).toBe('number');
        expect(typeof metadata.totalFiles).toBe('number');
        expect(typeof metadata.hasStatistics).toBe('boolean');
        expect(typeof metadata.complexity).toBe('string');
        expect(typeof metadata.activityLevel).toBe('string');
      });
    });
  });

  // ========================================================================
  // TESTS DE STABILITÉ DES VALEURS PAR DÉFAUT
  // ========================================================================

  describe('Stabilité des valeurs par défaut', () => {
    describe('Valeurs par défaut de ProjectResponseDto', () => {
      it('devrait maintenir les valeurs par défaut pour les tableaux', () => {
        const minimalData = {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Minimal',
          initialPrompt: 'Minimal prompt',
          status: ProjectStatus.ACTIVE,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const dto = plainToInstance(ProjectResponseDto, minimalData);

        expect(dto.uploadedFileIds).toEqual([]);
        expect(dto.generatedFileIds).toEqual([]);
        expect(dto.getTotalFilesCount()).toBe(0);
        expect(dto.hasUploadedFiles()).toBe(false);
        expect(dto.hasGeneratedFiles()).toBe(false);
      });

      it('devrait maintenir les valeurs par défaut pour les statistiques', () => {
        const dataWithoutStats = createModernProjectData();
        delete dataWithoutStats.statistics;

        const dto = plainToInstance(ProjectResponseDto, dataWithoutStats);

        expect(dto.hasStatistics()).toBe(false);
        expect(dto.getTotalCost()).toBeNull();
        expect(dto.getDocumentsCount()).toBeNull();
      });
    });

    describe('Valeurs par défaut de StatisticsResponseDto', () => {
      it('devrait maintenir les valeurs par défaut des statistiques', () => {
        const emptyStats = { lastUpdated: new Date() };
        const dto = plainToInstance(StatisticsResponseDto, emptyStats);

        // Ces valeurs par défaut doivent rester stables dans toutes les versions
        expect(dto.costs).toEqual({
          claudeApi: 0,
          storage: 0,
          compute: 0,
          total: 0,
        });
        expect(dto.performance).toEqual({
          generationTime: 0,
          processingTime: 0,
          totalTime: 0,
        });
        expect(dto.usage).toEqual({
          documentsGenerated: 0,
          filesProcessed: 0,
          tokensUsed: 0,
        });
      });

      it('devrait maintenir les transformations de recalcul automatique', () => {
        const incompleteStats = {
          costs: { claudeApi: 0.30, storage: 0.05, compute: 0.02, total: 0 },
          performance: { generationTime: 8000, processingTime: 1500, totalTime: 0 },
          usage: { documentsGenerated: 2, filesProcessed: 1, tokensUsed: 500 },
          lastUpdated: new Date(),
        };

        const dto = plainToInstance(StatisticsResponseDto, incompleteStats);

        // Les recalculs automatiques doivent rester stables
        expect(dto.costs.total).toBe(0.37); // 0.30 + 0.05 + 0.02
        expect(dto.performance.totalTime).toBe(9500); // 8000 + 1500
      });
    });

    describe('Transformations des tableaux vides', () => {
      it('devrait maintenir les transformations de tableaux null/undefined', () => {
        const scenarios = [
          { uploadedFileIds: null, generatedFileIds: undefined },
          { uploadedFileIds: undefined, generatedFileIds: null },
          { uploadedFileIds: '', generatedFileIds: 0 },
          { uploadedFileIds: false, generatedFileIds: {} },
        ];

        scenarios.forEach(scenario => {
          const data = { ...createModernProjectData(), ...scenario };
          const dto = plainToInstance(ProjectResponseDto, data);
          
          expect(dto.uploadedFileIds).toEqual([]);
          expect(dto.generatedFileIds).toEqual([]);
          expect(dto.getTotalFilesCount()).toBe(0);
        });
      });
    });
  });

  // ========================================================================
  // TESTS DE NON-RÉGRESSION
  // ========================================================================

  describe('Tests de non-régression', () => {
    describe('Bugs corrigés - ne doivent pas revenir', () => {
      it('ne devrait pas reintroduire le bug de division par zéro dans getCostPerDocument', () => {
        const zeroDivisorData = {
          costs: { claudeApi: 1.0, storage: 0.5, compute: 0.25, total: 1.75 },
          performance: { generationTime: 1000, processingTime: 500, totalTime: 1500 },
          usage: { documentsGenerated: 0, filesProcessed: 5, tokensUsed: 1000 }, // 0 documents
          lastUpdated: new Date(),
        };

        const dto = plainToInstance(StatisticsResponseDto, zeroDivisorData);
        
        // Ne doit pas lever d'exception
        expect(() => dto.getCostPerDocument()).not.toThrow();
        expect(dto.getCostPerDocument()).toBe(0);
      });

      it('ne devrait pas reintroduire le bug de division par zéro dans getTokensPerSecond', () => {
        const zeroTimeData = {
          costs: { claudeApi: 1.0, storage: 0.5, compute: 0.25, total: 1.75 },
          performance: { generationTime: 0, processingTime: 0, totalTime: 0 }, // 0 temps
          usage: { documentsGenerated: 5, filesProcessed: 5, tokensUsed: 1000 },
          lastUpdated: new Date(),
        };

        const dto = plainToInstance(StatisticsResponseDto, zeroTimeData);
        
        // Ne doit pas lever d'exception
        expect(() => dto.getTokensPerSecond()).not.toThrow();
        expect(dto.getTokensPerSecond()).toBe(0);
      });

      it('ne devrait pas reintroduire le bug des dates invalides', () => {
        const invalidDatesData = {
          ...createModernProjectData(),
          createdAt: new Date('invalid-date'),
          updatedAt: new Date('also-invalid'),
        };

        const dto = plainToInstance(ProjectResponseDto, invalidDatesData);
        
        // Ne doit pas lever d'exception lors des calculs de dates
        expect(() => dto.getAgeInDays()).not.toThrow();
        expect(() => dto.hasBeenModified()).not.toThrow();
        expect(() => dto.isRecent()).not.toThrow();
      });

      it('ne devrait pas reintroduire le bug de fuite de données sensibles dans toLogSafeString', () => {
        const sensitiveData = {
          ...createModernProjectData(),
          name: 'Password123',
          description: 'API Key: sk-1234567890abcdef',
          initialPrompt: 'Secret token: ghp_xxxxxxxxxxxxxxxxxxxx',
        };

        const dto = plainToInstance(ProjectResponseDto, sensitiveData);
        const safeString = dto.toLogSafeString();

        // Aucune donnée sensible ne doit apparaître dans les logs
        expect(safeString).not.toContain('Password123');
        expect(safeString).not.toContain('sk-1234567890abcdef');
        expect(safeString).not.toContain('ghp_xxxxxxxxxxxxxxxxxxxx');
        expect(safeString).not.toContain('API Key');
        expect(safeString).not.toContain('Secret token');
      });

      it('ne devrait pas reintroduire le bug de corruption des tableaux lors des transformations', () => {
        const corruptionProneData = {
          ...createModernProjectData(),
          uploadedFileIds: ['file1', null, 'file2', undefined, '', 'file3'],
          generatedFileIds: [42, 'gen1', false, 'gen2', [], 'gen3'],
        };

        const dto = plainToInstance(ProjectResponseDto, corruptionProneData);
        
        // Les tableaux doivent être proprement filtrés
        expect(dto.uploadedFileIds).toEqual(['file1', 'file2', 'file3']);
        expect(dto.generatedFileIds).toEqual(['gen1', 'gen2', 'gen3']);
        expect(dto.getTotalFilesCount()).toBe(6);
        
        // Plusieurs transformations ne doivent pas corrompre les données
        const json1 = instanceToPlain(dto, { excludeExtraneousValues: true });
        const dto2 = plainToInstance(ProjectResponseDto, json1);
        const json2 = instanceToPlain(dto2, { excludeExtraneousValues: true });
        
        expect(dto2.uploadedFileIds).toEqual(['file1', 'file2', 'file3']);
        expect(dto2.generatedFileIds).toEqual(['gen1', 'gen2', 'gen3']);
      });
    });

    describe('Stabilité des performances', () => {
      it('ne devrait pas régresser en performance avec de grandes listes', () => {
        const largeData = {
          ...createModernProjectData(),
          uploadedFileIds: Array.from({ length: 5000 }, (_, i) => `upload-${i}`),
          generatedFileIds: Array.from({ length: 5000 }, (_, i) => `gen-${i}`),
        };

        const start = performance.now();
        const dto = plainToInstance(ProjectResponseDto, largeData);
        dto.getTotalFilesCount();
        dto.hasUploadedFiles();
        dto.hasGeneratedFiles();
        dto.toString();
        dto.toLogSafeString();
        const end = performance.now();
        
        const duration = end - start;
        expect(duration).toBeLessThan(100); // Seuil de régression : 100ms pour 10k fichiers
      });

      it('ne devrait pas régresser en mémoire lors de créations répétées', () => {
        const data = createModernProjectData();
        
        // Mesurer la mémoire initiale
        if (global.gc) global.gc();
        const initialMemory = process.memoryUsage().heapUsed;
        
        // Créer et détruire 1000 instances
        for (let i = 0; i < 1000; i++) {
          const dto = plainToInstance(ProjectResponseDto, data);
          dto.getTotalFilesCount();
          dto.hasStatistics();
        }
        
        if (global.gc) global.gc();
        const finalMemory = process.memoryUsage().heapUsed;
        const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB
        
        // Pas plus de 5MB d'augmentation pour 1000 créations
        expect(memoryIncrease).toBeLessThan(5);
      });
    });

    describe('Stabilité de la sérialisation', () => {
      it('ne devrait pas régresser dans la stabilité de la sérialisation cyclique', () => {
        const data = createModernProjectData();
        
        // Effectuer 10 cycles de sérialisation/désérialisation
        let currentData = data;
        for (let i = 0; i < 10; i++) {
          const dto = plainToInstance(ProjectResponseDto, currentData);
          currentData = instanceToPlain(dto, { excludeExtraneousValues: true });
        }
        
        const finalDto = plainToInstance(ProjectResponseDto, currentData);
        
        // Les données doivent rester cohérentes après 10 cycles
        expect(finalDto.name).toBe(data.name);
        expect(finalDto.getTotalFilesCount()).toBe(5);
        expect(finalDto.hasStatistics()).toBe(true);
        expect(finalDto.status).toBe(ProjectStatus.ACTIVE);
      });

      it('ne devrait pas régresser dans la préservation des types après sérialisation', () => {
        const data = createModernProjectData();
        const dto1 = plainToInstance(ProjectResponseDto, data);
        const json = instanceToPlain(dto1, { excludeExtraneousValues: true });
        const dto2 = plainToInstance(ProjectResponseDto, json);
        
        // Les types doivent être préservés
        expect(dto2.createdAt).toBeInstanceOf(Date);
        expect(dto2.updatedAt).toBeInstanceOf(Date);
        expect(Array.isArray(dto2.uploadedFileIds)).toBe(true);
        expect(Array.isArray(dto2.generatedFileIds)).toBe(true);
        expect(dto2.statistics).toBeInstanceOf(StatisticsResponseDto);
        expect(dto2.statistics?.lastUpdated).toBeInstanceOf(Date);
      });
    });
  });
});