// test/unit/project/dto/project-response.dto.performance.spec.ts

import { plainToInstance, instanceToPlain } from 'class-transformer';
import {
  ProjectResponseDto,
  StatisticsResponseDto,
} from '../../../../src/project/dto/project-response.dto';
import { ProjectStatus } from '../../../../src/common/enums/project-status.enum';

describe('ProjectResponseDto - Tests de Performance', () => {
  // ========================================================================
  // UTILITIES DE PERFORMANCE
  // ========================================================================

  const measureExecutionTime = async <T>(
    fn: () => T | Promise<T>,
  ): Promise<{ result: T; duration: number }> => {
    const start = performance.now();
    const result = await fn();
    const end = performance.now();
    return { result, duration: end - start };
  };

  const createLargeArray = <T>(
    size: number,
    generator: (index: number) => T,
  ): T[] => {
    return Array.from({ length: size }, (_, index) => generator(index));
  };

  const createPerformanceTestData = (fileCount: number = 1000) => ({
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Performance Test Project',
    description: 'A'.repeat(1000), // Description de 1000 caractères
    initialPrompt: 'B'.repeat(2000), // Prompt de 2000 caractères
    status: ProjectStatus.ACTIVE,
    uploadedFileIds: createLargeArray(
      fileCount / 2,
      (i) => `uploaded-file-${i}-uuid`,
    ),
    generatedFileIds: createLargeArray(
      fileCount / 2,
      (i) => `generated-file-${i}-uuid`,
    ),
    createdAt: new Date('2024-08-08T10:30:00Z'),
    updatedAt: new Date('2024-08-08T14:30:00Z'),
    statistics: {
      costs: {
        claudeApi: 125.67,
        storage: 45.32,
        compute: 78.91,
        total: 249.9,
      },
      performance: {
        generationTime: 125000,
        processingTime: 23000,
        totalTime: 148000,
      },
      usage: {
        documentsGenerated: 150,
        filesProcessed: 89,
        tokensUsed: 125000,
      },
      lastUpdated: new Date('2024-08-08T15:00:00Z'),
    },
  });

  // ========================================================================
  // TESTS DE PERFORMANCE - OPÉRATIONS DE BASE
  // ========================================================================

  describe('Performance des opérations de base', () => {
    describe("Création d'instances", () => {
      it('devrait créer une instance rapidement avec des données normales', async () => {
        const data = createPerformanceTestData(100);

        const { duration } = await measureExecutionTime(() => {
          return plainToInstance(ProjectResponseDto, data);
        });

        expect(duration).toBeLessThan(10); // Moins de 10ms pour 100 fichiers
      });

      it('devrait créer une instance rapidement avec de grandes listes de fichiers', async () => {
        const data = createPerformanceTestData(1000);

        const { result, duration } = await measureExecutionTime(() => {
          return plainToInstance(ProjectResponseDto, data);
        });

        expect(result.getTotalFilesCount()).toBe(1000);
        expect(duration).toBeLessThan(50); // Moins de 50ms pour 1000 fichiers
      });

      it('devrait créer une instance avec de très grandes listes', async () => {
        const data = createPerformanceTestData(10000);

        const { result, duration } = await measureExecutionTime(() => {
          return plainToInstance(ProjectResponseDto, data);
        });

        expect(result.getTotalFilesCount()).toBe(10000);
        expect(duration).toBeLessThan(200); // Moins de 200ms pour 10k fichiers
      });

      it('devrait créer plusieurs instances en parallèle efficacement', async () => {
        const data = createPerformanceTestData(500);

        const { result, duration } = await measureExecutionTime(async () => {
          const promises = createLargeArray(100, () =>
            Promise.resolve(plainToInstance(ProjectResponseDto, data)),
          );
          return Promise.all(promises);
        });

        expect(result).toHaveLength(100);
        expect(result.every((dto) => dto instanceof ProjectResponseDto)).toBe(
          true,
        );
        expect(duration).toBeLessThan(500); // Moins de 500ms pour 100 instances
      });

      it('devrait gérer la création en série sans dégradation', async () => {
        const data = createPerformanceTestData(200);
        const durations: number[] = [];

        for (let i = 0; i < 10; i++) {
          const { duration } = await measureExecutionTime(() => {
            return plainToInstance(ProjectResponseDto, data);
          });
          durations.push(duration);
        }

        // Vérifier qu'il n'y a pas de dégradation significative
        const firstDuration = durations[0];
        const lastDuration = durations[durations.length - 1];
        const degradationRatio = lastDuration / firstDuration;

        expect(degradationRatio).toBeLessThan(3); // Pas plus de 3x plus lent
      });
    });

    describe('Méthodes utilitaires', () => {
      let largeDto: ProjectResponseDto;

      beforeEach(() => {
        const data = createPerformanceTestData(5000);
        largeDto = plainToInstance(ProjectResponseDto, data);
      });

      it('hasUploadedFiles() devrait être rapide avec de grandes listes', async () => {
        const { result, duration } = await measureExecutionTime(() => {
          return largeDto.hasUploadedFiles();
        });

        expect(result).toBe(true);
        expect(duration).toBeLessThan(1); // Moins de 1ms
      });

      it('hasGeneratedFiles() devrait être rapide avec de grandes listes', async () => {
        const { result, duration } = await measureExecutionTime(() => {
          return largeDto.hasGeneratedFiles();
        });

        expect(result).toBe(true);
        expect(duration).toBeLessThan(1); // Moins de 1ms
      });

      it('getTotalFilesCount() devrait être rapide avec de grandes listes', async () => {
        const { result, duration } = await measureExecutionTime(() => {
          return largeDto.getTotalFilesCount();
        });

        expect(result).toBe(5000);
        expect(duration).toBeLessThan(1); // Moins de 1ms
      });

      it('getComplexityEstimate() devrait être rapide avec de longs prompts', async () => {
        const { result, duration } = await measureExecutionTime(() => {
          return largeDto.getComplexityEstimate();
        });

        expect(result).toBe('high');
        expect(duration).toBeLessThan(1); // Moins de 1ms
      });

      it('toString() devrait être rapide avec de grandes données', async () => {
        const { result, duration } = await measureExecutionTime(() => {
          return largeDto.toString();
        });

        expect(result).toContain('Performance Test Project');
        expect(duration).toBeLessThan(2); // Moins de 2ms
      });

      it('toLogSafeString() devrait être rapide avec de grandes données', async () => {
        const { result, duration } = await measureExecutionTime(() => {
          return largeDto.toLogSafeString();
        });

        expect(result).toContain('550e8400-e29b-41d4-a716-446655440000');
        expect(duration).toBeLessThan(2); // Moins de 2ms
      });

      it('getMetadata() devrait être rapide avec de grandes données', async () => {
        const { result, duration } = await measureExecutionTime(() => {
          return largeDto.getMetadata();
        });

        expect(result.totalFiles).toBe(5000);
        expect(duration).toBeLessThan(5); // Moins de 5ms
      });
    });

    describe('Calculs de dates et âge', () => {
      it('getAgeInDays() devrait être rapide', async () => {
        const data = createPerformanceTestData(100);
        const dto = plainToInstance(ProjectResponseDto, data);

        const { result, duration } = await measureExecutionTime(() => {
          return dto.getAgeInDays();
        });

        expect(typeof result).toBe('number');
        expect(duration).toBeLessThan(1); // Moins de 1ms
      });

      it('hasBeenModified() devrait être rapide', async () => {
        const data = createPerformanceTestData(100);
        const dto = plainToInstance(ProjectResponseDto, data);

        const { result, duration } = await measureExecutionTime(() => {
          return dto.hasBeenModified();
        });

        expect(typeof result).toBe('boolean');
        expect(duration).toBeLessThan(1); // Moins de 1ms
      });

      it('isRecent() devrait être rapide', async () => {
        const data = createPerformanceTestData(100);
        const dto = plainToInstance(ProjectResponseDto, data);

        const { result, duration } = await measureExecutionTime(() => {
          return dto.isRecent();
        });

        expect(typeof result).toBe('boolean');
        expect(duration).toBeLessThan(1); // Moins de 1ms
      });

      it('getActivityLevel() devrait être rapide avec de grandes listes', async () => {
        const data = createPerformanceTestData(1000);
        const dto = plainToInstance(ProjectResponseDto, data);

        const { result, duration } = await measureExecutionTime(() => {
          return dto.getActivityLevel();
        });

        expect(['new', 'active', 'mature', 'inactive']).toContain(result);
        expect(duration).toBeLessThan(2); // Moins de 2ms
      });
    });
  });

  // ========================================================================
  // TESTS DE PERFORMANCE - TRANSFORMATIONS
  // ========================================================================

  describe('Performance des transformations', () => {
    describe('Sérialisation', () => {
      it('devrait sérialiser rapidement de grandes structures', async () => {
        const data = createPerformanceTestData(2000);
        const dto = plainToInstance(ProjectResponseDto, data);

        const { result, duration } = await measureExecutionTime(() => {
          return instanceToPlain(dto, { excludeExtraneousValues: true });
        });

        expect(result.uploadedFileIds).toHaveLength(1000);
        expect(result.generatedFileIds).toHaveLength(1000);
        expect(duration).toBeLessThan(100); // Moins de 100ms pour 2000 fichiers
      });

      it('devrait désérialiser rapidement de grandes structures JSON', async () => {
        const jsonData = {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Large JSON Project',
          initialPrompt: 'Large prompt from JSON',
          status: 'ACTIVE',
          uploadedFileIds: createLargeArray(1000, (i) => `json-upload-${i}`),
          generatedFileIds: createLargeArray(
            1000,
            (i) => `json-generated-${i}`,
          ),
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

        const { result, duration } = await measureExecutionTime(() => {
          return plainToInstance(ProjectResponseDto, jsonData);
        });

        expect(result.getTotalFilesCount()).toBe(2000);
        expect(duration).toBeLessThan(100); // Moins de 100ms
      });

      it('devrait gérer des cycles de transformation multiples efficacement', async () => {
        const data = createPerformanceTestData(500);

        const { result, duration } = await measureExecutionTime(() => {
          // Cycle 1: Data -> DTO -> JSON -> DTO
          const dto1 = plainToInstance(ProjectResponseDto, data);
          const json1 = instanceToPlain(dto1, {
            excludeExtraneousValues: true,
          });
          const dto2 = plainToInstance(ProjectResponseDto, json1);

          // Cycle 2: DTO -> JSON -> DTO
          const json2 = instanceToPlain(dto2, {
            excludeExtraneousValues: true,
          });
          const dto3 = plainToInstance(ProjectResponseDto, json2);

          return dto3;
        });

        expect(result.getTotalFilesCount()).toBe(500);
        expect(duration).toBeLessThan(150); // Moins de 150ms pour cycles multiples
      });

      it('devrait sérialiser en parallèle efficacement', async () => {
        const instances = createLargeArray(50, (i) => {
          const data = createPerformanceTestData(100);
          return plainToInstance(ProjectResponseDto, data);
        });

        const { result, duration } = await measureExecutionTime(async () => {
          const promises = instances.map((dto) =>
            Promise.resolve(
              instanceToPlain(dto, { excludeExtraneousValues: true }),
            ),
          );
          return Promise.all(promises);
        });

        expect(result).toHaveLength(50);
        expect(duration).toBeLessThan(200); // Moins de 200ms pour 50 sérialisations
      });
    });

    describe('Filtrage des tableaux', () => {
      it('devrait filtrer rapidement de grandes listes avec données malformées', async () => {
        const malformedData = {
          ...createPerformanceTestData(1000),
          uploadedFileIds: [
            ...createLargeArray(500, (i) => `valid-file-${i}`),
            ...createLargeArray(100, () => null),
            ...createLargeArray(100, () => 123),
            ...createLargeArray(100, () => ''),
            ...createLargeArray(200, (i) => `another-valid-${i}`),
          ],
          generatedFileIds: [
            ...createLargeArray(400, (i) => `valid-gen-${i}`),
            ...createLargeArray(200, () => undefined),
            ...createLargeArray(200, () => false),
            ...createLargeArray(200, (i) => `final-valid-${i}`),
          ],
        };

        const { result, duration } = await measureExecutionTime(() => {
          return plainToInstance(ProjectResponseDto, malformedData);
        });

        expect(result.uploadedFileIds.length).toBe(700); // 500 + 200 valides
        expect(result.generatedFileIds.length).toBe(600); // 400 + 200 valides
        expect(duration).toBeLessThan(50); // Moins de 50ms pour le filtrage
      });

      it("devrait gérer efficacement des tableaux avec des milliers d'éléments invalides", async () => {
        const massiveInvalidData = {
          ...createPerformanceTestData(100),
          uploadedFileIds: [
            ...createLargeArray(10000, () => null),
            ...createLargeArray(1000, (i) => `valid-${i}`),
            ...createLargeArray(10000, () => ''),
          ],
          generatedFileIds: [
            ...createLargeArray(5000, () => undefined),
            ...createLargeArray(1000, (i) => `gen-${i}`),
            ...createLargeArray(5000, () => 42),
          ],
        };

        const { result, duration } = await measureExecutionTime(() => {
          return plainToInstance(ProjectResponseDto, massiveInvalidData);
        });

        expect(result.uploadedFileIds.length).toBe(1000); // Seuls les valides
        expect(result.generatedFileIds.length).toBe(1000); // Seuls les valides
        expect(duration).toBeLessThan(100); // Moins de 100ms malgré 31k éléments
      });
    });
  });

  // ========================================================================
  // TESTS DE PERFORMANCE - STATISTIQUES
  // ========================================================================

  describe('Performance des statistiques', () => {
    describe("Création d'instances StatisticsResponseDto", () => {
      it('devrait créer rapidement des instances de statistiques simples', async () => {
        const simpleStatsData = {
          costs: { claudeApi: 0.5, storage: 0.1, compute: 0.05, total: 0.65 },
          performance: {
            generationTime: 1000,
            processingTime: 500,
            totalTime: 1500,
          },
          usage: { documentsGenerated: 3, filesProcessed: 2, tokensUsed: 750 },
          lastUpdated: new Date(),
        };

        const { result, duration } = await measureExecutionTime(() => {
          return plainToInstance(StatisticsResponseDto, simpleStatsData);
        });

        expect(result).toBeInstanceOf(StatisticsResponseDto);
        expect(duration).toBeLessThan(5); // Moins de 5ms
      });

      it('devrait créer rapidement plusieurs instances de statistiques', async () => {
        const statsData = {
          costs: {
            claudeApi: 125.67,
            storage: 45.32,
            compute: 78.91,
            total: 249.9,
          },
          performance: {
            generationTime: 125000,
            processingTime: 23000,
            totalTime: 148000,
          },
          usage: {
            documentsGenerated: 150,
            filesProcessed: 89,
            tokensUsed: 125000,
          },
          lastUpdated: new Date(),
        };

        const { result, duration } = await measureExecutionTime(() => {
          return createLargeArray(1000, () =>
            plainToInstance(StatisticsResponseDto, statsData),
          );
        });

        expect(result).toHaveLength(1000);
        expect(duration).toBeLessThan(200); // Moins de 200ms pour 1000 instances
      });
    });

    describe('Méthodes de calcul des statistiques', () => {
      let statsDto: StatisticsResponseDto;

      beforeEach(() => {
        const largeStatsData = {
          costs: {
            claudeApi: 999.99,
            storage: 123.45,
            compute: 456.78,
            total: 1580.22,
          },
          performance: {
            generationTime: 999999,
            processingTime: 123456,
            totalTime: 1123455,
          },
          usage: {
            documentsGenerated: 9999,
            filesProcessed: 5555,
            tokensUsed: 999999,
          },
          lastUpdated: new Date(),
        };
        statsDto = plainToInstance(StatisticsResponseDto, largeStatsData);
      });

      it('getCostPerDocument() devrait être rapide avec de grandes valeurs', async () => {
        const { result, duration } = await measureExecutionTime(() => {
          return statsDto.getCostPerDocument();
        });

        expect(typeof result).toBe('number');
        expect(duration).toBeLessThan(1); // Moins de 1ms
      });

      it('getTokensPerSecond() devrait être rapide avec de grandes valeurs', async () => {
        const { result, duration } = await measureExecutionTime(() => {
          return statsDto.getTokensPerSecond();
        });

        expect(typeof result).toBe('number');
        expect(duration).toBeLessThan(1); // Moins de 1ms
      });

      it('isDataFresh() devrait être rapide', async () => {
        const { result, duration } = await measureExecutionTime(() => {
          return statsDto.isDataFresh();
        });

        expect(typeof result).toBe('boolean');
        expect(duration).toBeLessThan(1); // Moins de 1ms
      });

      it('getPerformanceSummary() devrait être rapide', async () => {
        const { result, duration } = await measureExecutionTime(() => {
          return statsDto.getPerformanceSummary();
        });

        expect(['excellent', 'good', 'average', 'slow']).toContain(result);
        expect(duration).toBeLessThan(1); // Moins de 1ms
      });

      it('devrait exécuter tous les calculs en série rapidement', async () => {
        const { result, duration } = await measureExecutionTime(() => {
          return {
            costPerDoc: statsDto.getCostPerDocument(),
            tokensPerSec: statsDto.getTokensPerSecond(),
            isFresh: statsDto.isDataFresh(),
            performance: statsDto.getPerformanceSummary(),
          };
        });

        expect(result).toHaveProperty('costPerDoc');
        expect(result).toHaveProperty('tokensPerSec');
        expect(result).toHaveProperty('isFresh');
        expect(result).toHaveProperty('performance');
        expect(duration).toBeLessThan(2); // Moins de 2ms pour tous les calculs
      });
    });
  });

  // ========================================================================
  // TESTS DE PERFORMANCE - GESTION MÉMOIRE
  // ========================================================================

  describe('Gestion mémoire et optimisations', () => {
    describe("Création répétée d'instances", () => {
      it('ne devrait pas fuiter de mémoire avec des créations répétées', async () => {
        const data = createPerformanceTestData(500);
        const initialMemory = process.memoryUsage().heapUsed;

        // Créer et détruire 1000 instances
        for (let i = 0; i < 1000; i++) {
          const dto = plainToInstance(ProjectResponseDto, data);
          dto.hasStatistics();
          dto.getTotalFilesCount();
          dto.toString();
          // Les objets devraient être garbage collectés automatiquement
        }

        // Forcer le garbage collection si disponible
        if (global.gc) {
          global.gc();
        }

        const finalMemory = process.memoryUsage().heapUsed;
        const memoryIncrease = finalMemory - initialMemory;
        const memoryIncreaseKB = memoryIncrease / 1024;

        // L'augmentation de mémoire ne devrait pas être excessive
        expect(memoryIncreaseKB).toBeLessThan(10000); // Moins de 10MB d'augmentation
      });

      it('devrait réutiliser efficacement les transformations', async () => {
        const data = createPerformanceTestData(200);

        const { duration } = await measureExecutionTime(() => {
          // Créer plusieurs instances avec les mêmes données
          for (let i = 0; i < 100; i++) {
            const dto = plainToInstance(ProjectResponseDto, data);
            dto.hasUploadedFiles();
            dto.hasGeneratedFiles();
            dto.getTotalFilesCount();
          }
        });

        expect(duration).toBeLessThan(100); // Moins de 100ms pour 100 créations
      });
    });

    describe('Optimisation des chaînes longues', () => {
      it('devrait gérer efficacement les descriptions très longues', async () => {
        const longStringData = {
          ...createPerformanceTestData(100),
          description: 'A'.repeat(50000), // 50k caractères
          initialPrompt: 'B'.repeat(100000), // 100k caractères
        };

        const { result, duration } = await measureExecutionTime(() => {
          const dto = plainToInstance(ProjectResponseDto, longStringData);
          dto.getComplexityEstimate();
          dto.toString();
          dto.toLogSafeString();
          return dto;
        });

        expect(result.description).toHaveLength(50000);
        expect(result.initialPrompt).toHaveLength(100000);
        expect(duration).toBeLessThan(20); // Moins de 20ms malgré les longues chaînes
      });

      it('devrait optimiser les opérations sur des chaînes répétitives', async () => {
        const repetitiveData = createLargeArray(10, (i) => ({
          ...createPerformanceTestData(100),
          name: `Project ${i}`,
          description: 'Same description '.repeat(1000),
          initialPrompt: 'Same prompt '.repeat(2000),
        }));

        const { result, duration } = await measureExecutionTime(() => {
          return repetitiveData.map((data) => {
            const dto = plainToInstance(ProjectResponseDto, data);
            dto.getComplexityEstimate();
            return dto;
          });
        });

        expect(result).toHaveLength(10);
        expect(duration).toBeLessThan(50); // Moins de 50ms pour 10 instances
      });
    });

    describe('Performance avec données volumineuses', () => {
      it('devrait gérer des projets avec des milliers de fichiers', async () => {
        const massiveData = createPerformanceTestData(20000); // 20k fichiers

        const { result, duration } = await measureExecutionTime(() => {
          const dto = plainToInstance(ProjectResponseDto, massiveData);
          dto.hasUploadedFiles();
          dto.hasGeneratedFiles();
          dto.getTotalFilesCount();
          dto.toString();
          dto.toLogSafeString();
          dto.getMetadata();
          return dto;
        });

        expect(result.getTotalFilesCount()).toBe(20000);
        expect(duration).toBeLessThan(500); // Moins de 500ms pour 20k fichiers
      });

      it('devrait maintenir les performances avec des statistiques complexes', async () => {
        const complexStatsData = {
          ...createPerformanceTestData(1000),
          statistics: {
            costs: createLargeArray(100, (i) => ({
              [`metric${i}`]: Math.random() * 100,
            })).reduce((acc, obj) => ({ ...acc, ...obj }), {
              claudeApi: 100,
              storage: 50,
              compute: 25,
              total: 175,
            }),
            performance: createLargeArray(50, (i) => ({
              [`perf${i}`]: Math.random() * 10000,
            })).reduce((acc, obj) => ({ ...acc, ...obj }), {
              generationTime: 10000,
              processingTime: 5000,
              totalTime: 15000,
            }),
            usage: createLargeArray(75, (i) => ({
              [`usage${i}`]: Math.floor(Math.random() * 1000),
            })).reduce((acc, obj) => ({ ...acc, ...obj }), {
              documentsGenerated: 100,
              filesProcessed: 50,
              tokensUsed: 50000,
            }),
            lastUpdated: new Date(),
          },
        };

        const { result, duration } = await measureExecutionTime(() => {
          const dto = plainToInstance(ProjectResponseDto, complexStatsData);
          dto.hasStatistics();
          dto.getTotalCost();
          dto.getDocumentsCount();
          return dto;
        });

        expect(result.hasStatistics()).toBe(true);
        expect(duration).toBeLessThan(100); // Moins de 100ms malgré la complexité
      });
    });

    describe('Benchmarks comparatifs', () => {
      it('devrait être plus rapide avec des données optimisées', async () => {
        const normalData = createPerformanceTestData(1000);
        const optimizedData = {
          ...normalData,
          uploadedFileIds: normalData.uploadedFileIds.filter(
            (id) => id.length > 0,
          ),
          generatedFileIds: normalData.generatedFileIds.filter(
            (id) => id.length > 0,
          ),
        };

        const { duration: normalDuration } = await measureExecutionTime(() => {
          return plainToInstance(ProjectResponseDto, normalData);
        });

        const { duration: optimizedDuration } = await measureExecutionTime(
          () => {
            return plainToInstance(ProjectResponseDto, optimizedData);
          },
        );

        // Les données optimisées devraient être au moins aussi rapides
        expect(optimizedDuration).toBeLessThanOrEqual(normalDuration * 1.1); // 10% de tolérance
      });

      it('devrait comparer favorablement les différentes tailles de données', async () => {
        const sizes = [100, 500, 1000, 2000];
        const durations: number[] = [];

        for (const size of sizes) {
          const data = createPerformanceTestData(size);
          const { duration } = await measureExecutionTime(() => {
            return plainToInstance(ProjectResponseDto, data);
          });
          durations.push(duration);
        }

        // Vérifier que la complexité est raisonnable (pas plus que linéaire)
        const complexityRatio = durations[3] / durations[0]; // 2000 vs 100
        expect(complexityRatio).toBeLessThan(40); // Moins de 40x plus lent pour 20x plus de données
      });
    });
  });

  // ========================================================================
  // TESTS DE STRESS ET LIMITES
  // ========================================================================

  describe('Tests de stress et limites', () => {
    describe('Limites de capacité', () => {
      it('devrait gérer des projets avec un nombre extrême de fichiers', async () => {
        const extremeData = createPerformanceTestData(50000); // 50k fichiers

        const { result, duration } = await measureExecutionTime(() => {
          const dto = plainToInstance(ProjectResponseDto, extremeData);
          return dto.getTotalFilesCount();
        });

        expect(result).toBe(50000);
        expect(duration).toBeLessThan(1000); // Moins de 1 seconde même pour 50k fichiers
      });

      it('devrait résister aux tentatives de surcharge mémoire', async () => {
        const memoryStressData = {
          ...createPerformanceTestData(1000),
          name: 'Stress Test '.repeat(10000), // 130k caractères
          description: 'Description '.repeat(50000), // 600k caractères
          initialPrompt: 'Prompt '.repeat(100000), // 700k caractères
        };

        const { result, duration } = await measureExecutionTime(() => {
          const dto = plainToInstance(ProjectResponseDto, memoryStressData);
          dto.toString();
          dto.toLogSafeString();
          dto.getComplexityEstimate();
          return dto;
        });

        expect(result.name).toContain('Stress Test');
        expect(duration).toBeLessThan(100); // Moins de 100ms malgré les énormes chaînes
      });
    });

    describe('Résistance aux opérations coûteuses', () => {
      it('devrait optimiser les opérations répétées sur la même instance', async () => {
        const data = createPerformanceTestData(5000);
        const dto = plainToInstance(ProjectResponseDto, data);

        const { duration } = await measureExecutionTime(() => {
          // Répéter les mêmes opérations 1000 fois
          for (let i = 0; i < 1000; i++) {
            dto.hasUploadedFiles();
            dto.hasGeneratedFiles();
            dto.getTotalFilesCount();
            dto.hasStatistics();
            dto.isAccessible();
          }
        });

        expect(duration).toBeLessThan(50); // Moins de 50ms pour 5000 opérations
      });

      it("devrait maintenir les performances lors d'appels imbriqués", async () => {
        const data = createPerformanceTestData(1000);

        const { duration } = await measureExecutionTime(() => {
          for (let i = 0; i < 100; i++) {
            const dto = plainToInstance(ProjectResponseDto, data);
            const metadata = dto.getMetadata();
            const toString = dto.toString();
            const logSafe = dto.toLogSafeString();

            // Utiliser les résultats pour éviter l'optimisation du compilateur
            expect(metadata.totalFiles).toBe(1000);
            expect(toString.length).toBeGreaterThan(0);
            expect(logSafe.length).toBeGreaterThan(0);
          }
        });

        expect(duration).toBeLessThan(200); // Moins de 200ms pour 100 cycles complets
      });
    });

    describe('Performance sous charge concurrente', () => {
      it('devrait maintenir les performances avec des accès concurrents', async () => {
        const data = createPerformanceTestData(1000);
        const dto = plainToInstance(ProjectResponseDto, data);

        const { duration } = await measureExecutionTime(async () => {
          const concurrentPromises = createLargeArray(50, async () => {
            await Promise.resolve();
            dto.getTotalFilesCount();
            dto.hasStatistics();
            dto.getComplexityEstimate();
            dto.toString();
            return dto.getMetadata();
          });

          return Promise.all(concurrentPromises);
        });

        expect(duration).toBeLessThan(100); // Moins de 100ms pour 50 accès concurrents
      });

      it("devrait éviter les goulots d'étranglement lors de transformations multiples", async () => {
        const datasets = createLargeArray(20, (i) =>
          createPerformanceTestData(500 + i * 50),
        );

        const { result, duration } = await measureExecutionTime(async () => {
          const transformPromises = datasets.map(async (data, index) => {
            await new Promise((resolve) => setTimeout(resolve, index)); // Léger délai décalé
            const dto = plainToInstance(ProjectResponseDto, data);
            const json = instanceToPlain(dto, {
              excludeExtraneousValues: true,
            });
            return plainToInstance(ProjectResponseDto, json);
          });

          return Promise.all(transformPromises);
        });

        expect(result).toHaveLength(20);
        expect(duration).toBeLessThan(500); // Moins de 500ms pour 20 transformations concurrentes
      });
    });
  });
});
