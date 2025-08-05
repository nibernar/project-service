// test/performance/common/guards/project-owner.guard.performance.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { createMock } from '@golevelup/ts-jest';
import { randomUUID } from 'crypto';

import { ProjectOwnerGuard } from '../../../../src/common/guards/project-owner.guard';
import { DatabaseService } from '../../../../src/database/database.service';
import { CacheService } from '../../../../src/cache/cache.service';
import { DatabaseModule } from '../../../../src/database/database.module';
import { CacheModule } from '../../../../src/cache/cache.module';
import { databaseConfig } from '../../../../src/config/database.config';
import { cacheConfig } from '../../../../src/config/cache.config';
import { User } from '../../../../src/common/interfaces/user.interface';
import { ProjectStatus } from '../../../../src/common/enums/project-status.enum';

// Configuration pour les tests de performance
const PERFORMANCE_CONFIG = {
  CACHE_HIT_MAX_TIME: 10, // ms
  CACHE_MISS_MAX_TIME: 100, // ms  
  CONCURRENT_REQUESTS: 100,
  LOAD_TEST_REQUESTS: 1000,
  MEMORY_LEAK_ITERATIONS: 500,
  CACHE_HIT_RATIO_MIN: 0.8, // 80%
  LOAD_TEST_P95_MAX_TIME: 150,
};

interface PerformanceMetrics {
  avgResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  totalRequests: number;
  cacheHitRatio?: number;
  memoryUsage?: {
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
}

describe('ProjectOwnerGuard - Performance Tests', () => {
  let guard: ProjectOwnerGuard;
  let databaseService: DatabaseService;
  let cacheService: CacheService;
  let module: TestingModule;

  const testUser: User = {
    id: randomUUID(),
    email: 'performance-test@example.com',
    roles: ['user'],
  };

  const createMockExecutionContext = (projectId: string) => {
    return createMock<ExecutionContext>({
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => ({
          params: { id: projectId },
          user: testUser,
        }),
      }),
      getHandler: () => ({}),
    });
  };

  const calculateMetrics = (responseTimes: number[]): PerformanceMetrics => {
    const sorted = responseTimes.sort((a, b) => a - b);
    const total = sorted.length;
    
    return {
      avgResponseTime: sorted.reduce((a, b) => a + b, 0) / total,
      minResponseTime: sorted[0],
      maxResponseTime: sorted[total - 1],
      p95ResponseTime: sorted[Math.floor(total * 0.95)],
      p99ResponseTime: sorted[Math.floor(total * 0.99)],
      totalRequests: total,
    };
  };

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [databaseConfig, cacheConfig],
        }),
        DatabaseModule,
        CacheModule,
      ],
      providers: [
        ProjectOwnerGuard,
        {
          provide: Reflector,
          useValue: createMock<Reflector>({
            get: jest.fn().mockReturnValue({}),
          }),
        },
      ],
    }).compile();

    guard = module.get<ProjectOwnerGuard>(ProjectOwnerGuard);
    databaseService = module.get<DatabaseService>(DatabaseService);
    cacheService = module.get<CacheService>(CacheService);

    await new Promise(resolve => setTimeout(resolve, 2000));
  });

  afterAll(async () => {
    await module.close();
  });

  beforeEach(async () => {
    // Nettoyer les données de test
    await databaseService.project.deleteMany({
      where: { ownerId: testUser.id },
    });

    // Nettoyer le cache
    try {
      await cacheService.del(`project_owner:*:${testUser.id}`);
    } catch (error) {
      // Ignorer les erreurs de cache
    }
  });

  describe('📊 Tests de Performance Unitaires', () => {
    describe('F1. Performance Cache Hit vs Cache Miss', () => {
      it('should have significantly better performance with cache hit', async () => {
        // Arrange
        const projectId = randomUUID();
        const project = await databaseService.project.create({
          data: {
            id: projectId,
            name: 'Performance Cache Test',
            description: 'Project for cache performance testing',
            initialPrompt: 'Create performant app',
            ownerId: testUser.id,
            status: ProjectStatus.ACTIVE,
            uploadedFileIds: [],
            generatedFileIds: [],
          },
        });

        const context = createMockExecutionContext(project.id);

        // Test Cache Miss Performance
        const cacheMissTimes: number[] = [];
        for (let i = 0; i < 10; i++) {
          // Vider le cache avant chaque requête
          await cacheService.del(`project_owner:${project.id}:${testUser.id}`);
          
          const startTime = performance.now();
          await guard.canActivate(context);
          const duration = performance.now() - startTime;
          cacheMissTimes.push(duration);
        }

        // Test Cache Hit Performance
        const cacheHitTimes: number[] = [];
        for (let i = 0; i < 10; i++) {
          const startTime = performance.now();
          await guard.canActivate(context);
          const duration = performance.now() - startTime;
          cacheHitTimes.push(duration);
        }

        // Calculate metrics
        const cacheMissMetrics = calculateMetrics(cacheMissTimes);
        const cacheHitMetrics = calculateMetrics(cacheHitTimes);

        // Assert
        expect(cacheHitMetrics.avgResponseTime).toBeLessThan(PERFORMANCE_CONFIG.CACHE_HIT_MAX_TIME);
        expect(cacheMissMetrics.avgResponseTime).toBeLessThan(PERFORMANCE_CONFIG.CACHE_MISS_MAX_TIME);
        expect(cacheHitMetrics.avgResponseTime).toBeLessThan(cacheMissMetrics.avgResponseTime * 0.5);

        console.log('Cache Performance Results:');
        console.log(`Cache Miss - Avg: ${cacheMissMetrics.avgResponseTime.toFixed(2)}ms, P95: ${cacheMissMetrics.p95ResponseTime.toFixed(2)}ms`);
        console.log(`Cache Hit - Avg: ${cacheHitMetrics.avgResponseTime.toFixed(2)}ms, P95: ${cacheHitMetrics.p95ResponseTime.toFixed(2)}ms`);
      });
    });

    describe('F2. Performance sous charge concurrente', () => {
      it('should maintain good performance under concurrent load', async () => {
        // Arrange
        const projects = await Promise.all(
          Array.from({ length: 20 }, async (_, i) => {
            const projectId = randomUUID();
            return await databaseService.project.create({
              data: {
                id: projectId,
                name: `Concurrent Performance Test ${i}`,
                description: `Project ${i} for concurrent testing`,
                initialPrompt: `Create concurrent app ${i}`,
                ownerId: testUser.id,
                status: ProjectStatus.ACTIVE,
                uploadedFileIds: [],
                generatedFileIds: [],
              },
            });
          })
        );

        // Act - Premier passage (cache miss)
        const startTime1 = performance.now();
        const contexts1 = projects.map(p => createMockExecutionContext(p.id));
        
        const results1 = await Promise.all(
          contexts1.map(async (context) => {
            const reqStartTime = performance.now();
            const result = await guard.canActivate(context);
            const reqDuration = performance.now() - reqStartTime;
            return { result, duration: reqDuration };
          })
        );
        
        const totalTime1 = performance.now() - startTime1;
        const responseTimes1 = results1.map(r => r.duration);
        const metrics1 = calculateMetrics(responseTimes1);

        // Act - Deuxième passage (cache hit)
        const startTime2 = performance.now();
        const contexts2 = projects.map(p => createMockExecutionContext(p.id));
        
        const results2 = await Promise.all(
          contexts2.map(async (context) => {
            const reqStartTime = performance.now();
            const result = await guard.canActivate(context);
            const reqDuration = performance.now() - reqStartTime;
            return { result, duration: reqDuration };
          })
        );
        
        const totalTime2 = performance.now() - startTime2;
        const responseTimes2 = results2.map(r => r.duration);
        const metrics2 = calculateMetrics(responseTimes2);

        // Assert
        expect(results1.every(r => r.result === true)).toBe(true);
        expect(results2.every(r => r.result === true)).toBe(true);
        
        expect(metrics1.p95ResponseTime).toBeLessThan(PERFORMANCE_CONFIG.CACHE_MISS_MAX_TIME);
        expect(metrics2.p95ResponseTime).toBeLessThan(PERFORMANCE_CONFIG.CACHE_HIT_MAX_TIME);
        
        expect(totalTime2).toBeLessThan(totalTime1 * 0.5); // 50% plus rapide avec cache

        console.log('Concurrent Load Results:');
        console.log(`Cache Miss - Total: ${totalTime1.toFixed(2)}ms, Avg: ${metrics1.avgResponseTime.toFixed(2)}ms, P95: ${metrics1.p95ResponseTime.toFixed(2)}ms`);
        console.log(`Cache Hit - Total: ${totalTime2.toFixed(2)}ms, Avg: ${metrics2.avgResponseTime.toFixed(2)}ms, P95: ${metrics2.p95ResponseTime.toFixed(2)}ms`);
      });
    });

    describe('F3. Test de détection de fuites mémoire', () => {
      it('should not leak memory under sustained load', async () => {
        // Arrange
        const projectId = randomUUID();
        const project = await databaseService.project.create({
          data: {
            id: projectId,
            name: 'Memory Leak Test Project',
            description: 'Project for memory leak testing',
            initialPrompt: 'Create memory-efficient app',
            ownerId: testUser.id,
            status: ProjectStatus.ACTIVE,
            uploadedFileIds: [],
            generatedFileIds: [],
          },
        });

        const context = createMockExecutionContext(project.id);

        // Force garbage collection si disponible
        if (global.gc) {
          global.gc();
        }

        // Mesure initiale de mémoire
        const initialMemory = process.memoryUsage();

        // Act - Beaucoup d'itérations pour détecter les fuites
        const responseTimes: number[] = [];
        
        for (let i = 0; i < PERFORMANCE_CONFIG.MEMORY_LEAK_ITERATIONS; i++) {
          const startTime = performance.now();
          const result = await guard.canActivate(context);
          const duration = performance.now() - startTime;
          
          expect(result).toBe(true);
          responseTimes.push(duration);

          // Mesure mémoire périodique
          if (i % 100 === 0 && i > 0) {
            const currentMemory = process.memoryUsage();
            const memoryIncrease = currentMemory.heapUsed - initialMemory.heapUsed;
            
            // La mémoire ne devrait pas augmenter de plus de 50MB
            expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
          }
        }

        // Force garbage collection si disponible
        if (global.gc) {
          global.gc();
        }

        // Mesure finale de mémoire
        const finalMemory = process.memoryUsage();
        const totalMemoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
        const metrics = calculateMetrics(responseTimes);

        // Assert
        expect(totalMemoryIncrease).toBeLessThan(20 * 1024 * 1024); // Max 20MB d'augmentation
        expect(metrics.avgResponseTime).toBeLessThan(PERFORMANCE_CONFIG.CACHE_HIT_MAX_TIME); // Performance maintenue

        console.log('Memory Leak Test Results:');
        console.log(`Total Memory Increase: ${(totalMemoryIncrease / 1024 / 1024).toFixed(2)}MB`);
        console.log(`Avg Response Time: ${metrics.avgResponseTime.toFixed(2)}ms`);
        console.log(`Total Iterations: ${PERFORMANCE_CONFIG.MEMORY_LEAK_ITERATIONS}`);
      });
    });
  });

  describe('📈 Tests de Performance de Charge', () => {
    describe('Load Testing', () => {
      it('should handle high load efficiently', async () => {
        // Arrange
        const numProjects = 50;
        const projects = await Promise.all(
          Array.from({ length: numProjects }, async (_, i) => {
            const projectId = randomUUID();
            return await databaseService.project.create({
              data: {
                id: projectId,
                name: `Load Test Project ${i}`,
                description: `Project ${i} for load testing`,
                initialPrompt: `Create load-tested app ${i}`,
                ownerId: testUser.id,
                status: ProjectStatus.ACTIVE,
                uploadedFileIds: [],
                generatedFileIds: [],
              },
            });
          })
        );

        // Préparer les contextes
        const contexts = Array.from({ length: PERFORMANCE_CONFIG.LOAD_TEST_REQUESTS }, (_, i) => {
          const projectIndex = i % numProjects;
          return createMockExecutionContext(projects[projectIndex].id);
        });

        console.log(`Starting load test with ${PERFORMANCE_CONFIG.LOAD_TEST_REQUESTS} requests across ${numProjects} projects`);

        // Act - Load test
        const startTime = performance.now();
        const results = await Promise.all(
          contexts.map(async (context) => {
            const reqStartTime = performance.now();
            const result = await guard.canActivate(context);
            const reqDuration = performance.now() - reqStartTime;
            return { result, duration: reqDuration };
          })
        );
        const totalTime = performance.now() - startTime;

        // Calculate detailed metrics
        const responseTimes = results.map(r => r.duration);
        const metrics = calculateMetrics(responseTimes);
        const throughput = PERFORMANCE_CONFIG.LOAD_TEST_REQUESTS / (totalTime / 1000); // req/sec

        // Assert
        expect(results.every(r => r.result === true)).toBe(true);
        expect(metrics.p95ResponseTime).toBeLessThan(PERFORMANCE_CONFIG.CACHE_HIT_MAX_TIME * 2); // 2x tolérance sous charge
        expect(throughput).toBeGreaterThan(100); // Au moins 100 req/sec

        console.log('Load Test Results:');
        console.log(`Total Time: ${totalTime.toFixed(2)}ms`);
        console.log(`Throughput: ${throughput.toFixed(2)} req/sec`);
        console.log(`Avg Response Time: ${metrics.avgResponseTime.toFixed(2)}ms`);
        console.log(`P95 Response Time: ${metrics.p95ResponseTime.toFixed(2)}ms`);
        console.log(`P99 Response Time: ${metrics.p99ResponseTime.toFixed(2)}ms`);
      });
    });

    describe('Cache Hit Ratio Analysis', () => {
      it('should achieve good cache hit ratio under realistic load', async () => {
        // Arrange - Simuler un pattern d'accès réaliste (distribution de Pareto)
        const numProjects = 20;
        const projects = await Promise.all(
          Array.from({ length: numProjects }, async (_, i) => {
            const projectId = randomUUID();
            return await databaseService.project.create({
              data: {
                id: projectId,
                name: `Cache Ratio Project ${i}`,
                description: `Project ${i} for cache ratio testing`,
                initialPrompt: `Create cached app ${i}`,
                ownerId: testUser.id,
                status: ProjectStatus.ACTIVE,
                uploadedFileIds: [],
                generatedFileIds: [],
              },
            });
          })
        );

        // Pattern d'accès réaliste : 80% des accès sur 20% des projets
        const popularProjects = projects.slice(0, 4); // 20% des projets
        const regularProjects = projects.slice(4);    // 80% des projets

        const requests: string[] = [];
        
        // 80% des requêtes sur les projets populaires
        for (let i = 0; i < 400; i++) {
          const project = popularProjects[i % popularProjects.length];
          requests.push(project.id);
        }
        
        // 20% des requêtes sur les autres projets
        for (let i = 0; i < 100; i++) {
          const project = regularProjects[i % regularProjects.length];
          requests.push(project.id);
        }

        // Mélanger les requêtes pour simuler un accès réaliste
        for (let i = requests.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [requests[i], requests[j]] = [requests[j], requests[i]];
        }

        // Act - Tracker les performances et le cache
        let cacheHits = 0;
        let cacheMisses = 0;
        const responseTimes: number[] = [];

        for (const projectId of requests) {
          const context = createMockExecutionContext(projectId);
          
          // Check if cache hit (heuristic: requests < 5ms sont probablement des cache hits)
          const startTime = performance.now();
          await guard.canActivate(context);
          const duration = performance.now() - startTime;
          
          responseTimes.push(duration);
          
          if (duration < 5) {
            cacheHits++;
          } else {
            cacheMisses++;
          }
        }

        const cacheHitRatio = cacheHits / (cacheHits + cacheMisses);
        const metrics = calculateMetrics(responseTimes);

        // Assert
        expect(cacheHitRatio).toBeGreaterThan(PERFORMANCE_CONFIG.CACHE_HIT_RATIO_MIN);
        expect(metrics.avgResponseTime).toBeLessThan(PERFORMANCE_CONFIG.CACHE_HIT_MAX_TIME * 1.5);

        console.log('Cache Hit Ratio Analysis:');
        console.log(`Cache Hit Ratio: ${(cacheHitRatio * 100).toFixed(2)}%`);
        console.log(`Cache Hits: ${cacheHits}, Cache Misses: ${cacheMisses}`);
        console.log(`Avg Response Time: ${metrics.avgResponseTime.toFixed(2)}ms`);
      });
    });
  });

  describe('🔍 Profiling et Optimisation', () => {
    describe('Database Query Performance', () => {
      it('should execute database queries efficiently', async () => {
        // Arrange
        const projectId = randomUUID();
        const project = await databaseService.project.create({
          data: {
            id: projectId,
            name: 'DB Query Performance Test',
            description: 'Project for database query performance testing',
            initialPrompt: 'Create DB-optimized app',
            ownerId: testUser.id,
            status: ProjectStatus.ACTIVE,
            uploadedFileIds: [],
            generatedFileIds: [],
          },
        });

        const context = createMockExecutionContext(project.id);

        // Act - Mesurer uniquement les requêtes DB (sans cache)
        const queryTimes: number[] = [];
        
        for (let i = 0; i < 20; i++) {
          // Vider le cache pour forcer la requête DB
          await cacheService.del(`project_owner:${project.id}:${testUser.id}`);
          
          const startTime = performance.now();
          await guard.canActivate(context);
          const duration = performance.now() - startTime;
          queryTimes.push(duration);
        }

        const metrics = calculateMetrics(queryTimes);

        // Assert - Les requêtes DB doivent être raisonnablement rapides
        expect(metrics.avgResponseTime).toBeLessThan(50); // Moins de 50ms en moyenne
        expect(metrics.p95ResponseTime).toBeLessThan(100); // P95 moins de 100ms
        expect(metrics.maxResponseTime).toBeLessThan(200); // Max moins de 200ms

        console.log('Database Query Performance:');
        console.log(`Avg Query Time: ${metrics.avgResponseTime.toFixed(2)}ms`);
        console.log(`P95 Query Time: ${metrics.p95ResponseTime.toFixed(2)}ms`);
        console.log(`Max Query Time: ${metrics.maxResponseTime.toFixed(2)}ms`);
      });
    });

    describe('Cache Performance Analysis', () => {
      it('should have efficient cache operations', async () => {
        // Arrange
        const projectId = randomUUID();
        const project = await databaseService.project.create({
          data: {
            id: projectId,
            name: 'Cache Operations Performance Test',
            description: 'Project for cache operations testing',
            initialPrompt: 'Create cache-optimized app',
            ownerId: testUser.id,
            status: ProjectStatus.ACTIVE,
            uploadedFileIds: [],
            generatedFileIds: [],
          },
        });

        const context = createMockExecutionContext(project.id);

        // Premier appel pour remplir le cache
        await guard.canActivate(context);

        // Act - Mesurer les opérations de cache
        const cacheReadTimes: number[] = [];
        
        for (let i = 0; i < 100; i++) {
          const startTime = performance.now();
          await guard.canActivate(context);
          const duration = performance.now() - startTime;
          cacheReadTimes.push(duration);
        }

        const metrics = calculateMetrics(cacheReadTimes);

        // Assert - Le cache doit être très rapide
        expect(metrics.avgResponseTime).toBeLessThan(5); // Moins de 5ms en moyenne
        expect(metrics.p95ResponseTime).toBeLessThan(10); // P95 moins de 10ms
        expect(metrics.maxResponseTime).toBeLessThan(20); // Max moins de 20ms

        console.log('Cache Operations Performance:');
        console.log(`Avg Cache Read Time: ${metrics.avgResponseTime.toFixed(2)}ms`);
        console.log(`P95 Cache Read Time: ${metrics.p95ResponseTime.toFixed(2)}ms`);
        console.log(`Max Cache Read Time: ${metrics.maxResponseTime.toFixed(2)}ms`);
      });
    });
  });
});