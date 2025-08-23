import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { StatisticsService } from '../../../src/statistics/statistics.service';
import { StatisticsRepository } from '../../../src/statistics/statistics.repository';
import { CacheService } from '../../../src/cache/cache.service';
import { UpdateStatisticsDto } from '../../../src/statistics/dto/update-statistics.dto';

describe('Statistics Performance Tests', () => {
  let service: StatisticsService;
  let repository: jest.Mocked<StatisticsRepository>;
  let cacheService: jest.Mocked<CacheService>;

  beforeEach(async () => {
    const mockRepository = {
      upsert: jest.fn(),
      findByProjectId: jest.fn(),
      findManyByProjectIds: jest.fn(),
      findByCriteria: jest.fn(),
      getGlobalStatistics: jest.fn(),
      cleanupOldStatistics: jest.fn(),
    };

    const mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StatisticsService,
        {
          provide: StatisticsRepository,
          useValue: mockRepository,
        },
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
      ],
    }).compile();

    service = module.get<StatisticsService>(StatisticsService);
    repository = module.get(StatisticsRepository);
    cacheService = module.get(CacheService);

    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Cache Performance', () => {
    it('should achieve high cache hit rates for repeated access', async () => {
      // Arrange
      const projectId = 'performance-test-cache';
      const mockStats = { costs: { total: 25.0 }, usage: { documentsGenerated: 5 } };
      
      cacheService.get.mockResolvedValue(mockStats);

      // Act: Multiple calls should hit cache
      const iterations = 1000;
      const promises = Array.from({ length: iterations }, () =>
        service.getStatistics(projectId),
      );

      const start = Date.now();
      await Promise.all(promises);
      const duration = Date.now() - start;

      // Assert: High performance with cache hits
      expect(duration).toBeLessThan(500); // 1000 cache hits in under 500ms
      expect(cacheService.get).toHaveBeenCalledTimes(iterations);
      expect(repository.findByProjectId).not.toHaveBeenCalled();
    });

    it('should handle cache misses efficiently', async () => {
      // Arrange
      const projectIds = Array.from({ length: 100 }, (_, i) => `project-${i}`);
      const mockEntity = { id: 'test', projectId: 'test', costs: {}, performance: {}, usage: {} };
      
      cacheService.get.mockResolvedValue(null); // Always cache miss
      repository.findByProjectId.mockResolvedValue(mockEntity);
      cacheService.set.mockResolvedValue(undefined);

      // Act
      const start = Date.now();
      const promises = projectIds.map(id => service.getStatistics(id));
      await Promise.all(promises);
      const duration = Date.now() - start;

      // Assert: Database queries should complete quickly
      expect(duration).toBeLessThan(2000); // 100 DB queries in under 2 seconds
      expect(repository.findByProjectId).toHaveBeenCalledTimes(projectIds.length);
      expect(cacheService.set).toHaveBeenCalledTimes(projectIds.length);
    });

    it('should optimize batch operations for cache efficiency', async () => {
      // Arrange
      const projectIds = Array.from({ length: 50 }, (_, i) => `batch-${i}`);
      const entitiesMap = new Map();
      projectIds.forEach((id, index) => {
        entitiesMap.set(id, { 
          id: `entity-${index}`, 
          projectId: id, 
          costs: { total: index * 10 }, 
          performance: {}, 
          usage: {} 
        });
      });

      // Some projects cached, some not
      cacheService.get
        .mockResolvedValueOnce(null) // First 25 not cached
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      
      // Mock 25 cache hits
      for (let i = 25; i < 50; i++) {
        cacheService.get.mockResolvedValueOnce({ costs: { total: i * 10 } });
      }

      repository.findManyByProjectIds.mockResolvedValue(entitiesMap);

      // Act
      const start = Date.now();
      const result = await service.getMultipleStatistics(projectIds);
      const duration = Date.now() - start;

      // Assert: Batch optimization should be fast
      expect(duration).toBeLessThan(200);
      expect(result.size).toBe(projectIds.length);
      expect(repository.findManyByProjectIds).toHaveBeenCalledWith(
        expect.arrayContaining(projectIds.slice(0, 25)), // Only uncached IDs
      );
    });

    it('should handle cache invalidation efficiently', async () => {
      // Arrange
      const projectId = 'invalidation-test';
      const updateDto: UpdateStatisticsDto = { costs: { claudeApi: 15.0 } };
      const mockEntity = { id: 'test', projectId, costs: {}, performance: {}, usage: {} };

      repository.upsert.mockResolvedValue(mockEntity);
      cacheService.del.mockResolvedValue(undefined);
      cacheService.set.mockResolvedValue(undefined);

      // Act: Multiple updates should invalidate efficiently
      const updates = Array.from({ length: 100 }, () =>
        service.updateStatistics(projectId, updateDto)
      );

      const start = Date.now();
      await Promise.all(updates);
      const duration = Date.now() - start;

      // Assert: Invalidation overhead should be minimal
      expect(duration).toBeLessThan(3000); // 100 updates with invalidation
      expect(cacheService.del).toHaveBeenCalledTimes(100);
    });
  });

  describe('Database Performance', () => {
    it('should handle high-frequency upserts efficiently', async () => {
      // Arrange
      const projectId = 'high-freq-test';
      const updates = Array.from({ length: 200 }, (_, i) => ({
        costs: { claudeApi: i * 0.5 },
        usage: { apiCallsCount: i },
      }));

      repository.upsert.mockImplementation(async () => ({
        id: 'test',
        projectId,
        costs: {},
        performance: {},
        usage: {},
      }));

      // Act
      const start = Date.now();
      const promises = updates.map(update =>
        service.updateStatistics(projectId, update),
      );
      await Promise.all(promises);
      const duration = Date.now() - start;

      // Assert: High-frequency updates should be fast
      expect(duration).toBeLessThan(5000); // 200 updates in under 5 seconds
      expect(repository.upsert).toHaveBeenCalledTimes(200);
    });

    it('should optimize batch queries for large datasets', async () => {
      // Arrange
      const batchSize = 500;
      const projectIds = Array.from({ length: batchSize }, (_, i) => `large-batch-${i}`);
      const entitiesMap = new Map();

      // Simulate realistic response time for large batch
      repository.findManyByProjectIds.mockImplementation(async (ids) => {
        await new Promise(resolve => setTimeout(resolve, 100)); // Simulate DB latency
        ids.forEach(id => entitiesMap.set(id, { 
          id: `entity-${id}`, 
          projectId: id, 
          costs: {}, 
          performance: {}, 
          usage: {} 
        }));
        return entitiesMap;
      });

      cacheService.get.mockResolvedValue(null); // Force DB query

      // Act
      const start = Date.now();
      const result = await service.getMultipleStatistics(projectIds);
      const duration = Date.now() - start;

      // Assert: Large batch should complete in reasonable time
      expect(duration).toBeLessThan(1000); // 500 records in under 1 second
      expect(result.size).toBe(batchSize);
      expect(repository.findManyByProjectIds).toHaveBeenCalledTimes(1); // Single batch query
    });

    it('should handle search queries efficiently with complex criteria', async () => {
      // Arrange
      const complexCriteria = {
        minTotalCost: 10.0,
        maxTotalCost: 100.0,
        minDocuments: 5,
        maxPerformanceTime: 300.0,
        dataFreshnessMinutes: 60,
      };

      const mockResults = Array.from({ length: 25 }, (_, i) => ({
        id: `search-${i}`,
        projectId: `project-${i}`,
        costs: { total: 50.0 + i },
        performance: { totalTime: 200.0 + i },
        usage: { documentsGenerated: 8 + i },
      }));

      repository.findByCriteria.mockResolvedValue(mockResults);

      // Act
      const start = Date.now();
      const results = await service.searchStatistics(complexCriteria);
      const duration = Date.now() - start;

      // Assert: Complex search should be fast
      expect(duration).toBeLessThan(500);
      expect(results).toHaveLength(25);
      expect(repository.findByCriteria).toHaveBeenCalledWith(complexCriteria);
    });

    it('should handle global statistics computation efficiently', async () => {
      // Arrange
      const mockGlobalStats = {
        totalProjects: 10000,
        totalCosts: 500000.0,
        totalDocuments: 75000,
        averageQualityScore: 85.5,
        sourceDistribution: {},
      };

      repository.getGlobalStatistics.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 200)); // Simulate complex aggregation
        return mockGlobalStats;
      });

      cacheService.get.mockResolvedValue(null); // Force computation

      // Act
      const start = Date.now();
      const result = await service.getGlobalStatistics();
      const duration = Date.now() - start;

      // Assert: Global computation should complete quickly
      expect(duration).toBeLessThan(500);
      expect(result).toEqual(mockGlobalStats);
      expect(repository.getGlobalStatistics).toHaveBeenCalledTimes(1);
    });
  });

  describe('Memory and Resource Usage', () => {
    it('should handle large data volumes without memory leaks', async () => {
      // Arrange
      const iterations = 1000;
      const largeDataSize = 10000; // Simulate large JSON objects

      const largeData = {
        costs: Array.from({ length: largeDataSize }, (_, i) => ({ [`cost_${i}`]: i * 0.01 }))
          .reduce((acc, obj) => ({ ...acc, ...obj }), {}),
        performance: Array.from({ length: largeDataSize }, (_, i) => ({ [`perf_${i}`]: i * 0.1 }))
          .reduce((acc, obj) => ({ ...acc, ...obj }), {}),
        usage: Array.from({ length: largeDataSize }, (_, i) => ({ [`usage_${i}`]: i }))
          .reduce((acc, obj) => ({ ...acc, ...obj }), {}),
      };

      repository.upsert.mockResolvedValue({
        id: 'large-data-test',
        projectId: 'memory-test',
        costs: largeData.costs,
        performance: largeData.performance,
        usage: largeData.usage,
      });

      // Act: Process large data multiple times
      const promises = Array.from({ length: iterations }, (_, i) =>
        service.updateStatistics(`memory-test-${i}`, largeData),
      );

      const start = Date.now();
      const initialMemory = process.memoryUsage().heapUsed;
      
      await Promise.all(promises);
      
      const finalMemory = process.memoryUsage().heapUsed;
      const duration = Date.now() - start;

      // Assert: Memory usage should be reasonable
      const memoryIncrease = finalMemory - initialMemory;
      const memoryPerOperation = memoryIncrease / iterations;
      
      expect(duration).toBeLessThan(10000); // 1000 large operations in under 10 seconds
      expect(memoryPerOperation).toBeLessThan(1024 * 1024); // Less than 1MB per operation
    });

    it('should handle concurrent operations without resource contention', async () => {
      // Arrange
      const concurrentOps = 50;
      const opsPerBatch = 20;

      repository.upsert.mockImplementation(async (projectId) => ({
        id: `concurrent-${projectId}`,
        projectId,
        costs: {},
        performance: {},
        usage: {},
      }));

      // Act: Simulate concurrent load
      const batches = Array.from({ length: concurrentOps }, (_, batchIndex) =>
        Promise.all(
          Array.from({ length: opsPerBatch }, (_, opIndex) =>
            service.updateStatistics(
              `concurrent-${batchIndex}-${opIndex}`,
              { costs: { claudeApi: opIndex * 1.0 } },
            ),
          ),
        ),
      );

      const start = Date.now();
      await Promise.all(batches);
      const duration = Date.now() - start;

      // Assert: Concurrent operations should complete efficiently
      const totalOps = concurrentOps * opsPerBatch;
      expect(duration).toBeLessThan(5000); // 1000 concurrent ops in under 5 seconds
      expect(repository.upsert).toHaveBeenCalledTimes(totalOps);
    });
  });

  describe('Scalability Tests', () => {
    it('should scale linearly with batch size', async () => {
      // Arrange: Test different batch sizes
      const batchSizes = [10, 50, 100, 200];
      const results: Array<{ size: number; duration: number }> = [];

      for (const size of batchSizes) {
        const projectIds = Array.from({ length: size }, (_, i) => `scale-test-${size}-${i}`);
        const entitiesMap = new Map();
        projectIds.forEach(id => entitiesMap.set(id, { 
          id, 
          projectId: id, 
          costs: {}, 
          performance: {}, 
          usage: {} 
        }));

        repository.findManyByProjectIds.mockResolvedValue(entitiesMap);
        cacheService.get.mockResolvedValue(null);

        // Act
        const start = Date.now();
        await service.getMultipleStatistics(projectIds);
        const duration = Date.now() - start;

        results.push({ size, duration });
      }

      // Assert: Performance should scale reasonably
      const ratios = results.slice(1).map((result, index) => 
        result.duration / results[index].duration
      );

      // Each doubling should not increase time by more than 3x
      ratios.forEach(ratio => {
        expect(ratio).toBeLessThan(3.0);
      });
    });

    it('should handle database connection pool limits gracefully', async () => {
      // Arrange: Simulate many simultaneous database operations
      const simultaneousOps = 100;
      let completedOps = 0;

      repository.findByProjectId.mockImplementation(async (projectId) => {
        await new Promise(resolve => setTimeout(resolve, 50)); // Simulate DB latency
        completedOps++;
        return {
          id: `pool-test-${projectId}`,
          projectId,
          costs: {},
          performance: {},
          usage: {},
        };
      });

      cacheService.get.mockResolvedValue(null); // Force DB queries

      // Act: Launch many operations simultaneously
      const operations = Array.from({ length: simultaneousOps }, (_, i) =>
        service.getStatistics(`pool-test-${i}`),
      );

      const start = Date.now();
      const results = await Promise.all(operations);
      const duration = Date.now() - start;

      // Assert: All operations complete despite pool limits
      expect(results).toHaveLength(simultaneousOps);
      expect(completedOps).toBe(simultaneousOps);
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
    });
  });

  describe('Throughput and Response Time Tests', () => {
    it('should maintain low response times under high load', async () => {
      // Arrange
      const loadTestDuration = 5000; // 5 seconds
      const requestsPerSecond = 100;
      const totalRequests = (loadTestDuration / 1000) * requestsPerSecond;

      repository.findByProjectId.mockResolvedValue({
        id: 'load-test',
        projectId: 'load-test',
        costs: { total: 10.0 },
        performance: {},
        usage: {},
      });

      cacheService.get.mockResolvedValue(null);

      // Act: Generate sustained load
      const responseTimes: number[] = [];
      const promises: Promise<void>[] = [];

      for (let i = 0; i < totalRequests; i++) {
        const promise = (async () => {
          const start = Date.now();
          await service.getStatistics(`load-test-${i}`);
          const responseTime = Date.now() - start;
          responseTimes.push(responseTime);
        })();

        promises.push(promise);

        // Throttle requests to maintain target RPS
        if (i % requestsPerSecond === 0) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }

      await Promise.all(promises);

      // Assert: Response times should remain acceptable
      const averageResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const p95ResponseTime = responseTimes.sort((a, b) => a - b)[Math.floor(responseTimes.length * 0.95)];

      expect(averageResponseTime).toBeLessThan(100); // Average under 100ms
      expect(p95ResponseTime).toBeLessThan(200); // 95th percentile under 200ms
    });

    it('should handle burst traffic patterns efficiently', async () => {
      // Arrange: Simulate traffic bursts
      const burstSize = 50;
      const numBursts = 5;
      const burstInterval = 1000; // 1 second between bursts

      repository.findByProjectId.mockResolvedValue({
        id: 'burst-test',
        projectId: 'burst-test',
        costs: {},
        performance: {},
        usage: {},
      });

      cacheService.get.mockResolvedValue(null);

      // Act: Generate burst traffic
      const allPromises: Promise<any>[] = [];

      for (let burst = 0; burst < numBursts; burst++) {
        // Create burst of requests
        const burstPromises = Array.from({ length: burstSize }, (_, i) =>
          service.getStatistics(`burst-${burst}-${i}`)
        );

        allPromises.push(...burstPromises);

        // Wait between bursts
        if (burst < numBursts - 1) {
          await new Promise(resolve => setTimeout(resolve, burstInterval));
        }
      }

      const start = Date.now();
      await Promise.all(allPromises);
      const duration = Date.now() - start;

      // Assert: Should handle bursts without significant degradation
      const totalRequests = burstSize * numBursts;
      const avgTimePerRequest = duration / totalRequests;

      expect(avgTimePerRequest).toBeLessThan(50); // Average under 50ms per request
      expect(duration).toBeLessThan(10000); // All bursts complete within 10 seconds
    });
  });

  describe('Resource Efficiency Tests', () => {
    it('should efficiently utilize CPU resources', async () => {
      // Arrange: CPU-intensive operations
      const cpuIntensiveOperations = Array.from({ length: 100 }, (_, i) => ({
        costs: {
          claudeApi: Math.random() * 100,
          storage: Math.random() * 50,
          compute: Math.random() * 25,
        },
        performance: {
          generationTime: Math.random() * 200,
          processingTime: Math.random() * 100,
        },
        usage: {
          documentsGenerated: Math.floor(Math.random() * 20),
          tokensUsed: Math.floor(Math.random() * 50000),
        },
      }));

      repository.upsert.mockImplementation(async (projectId, data) => ({
        id: projectId,
        projectId,
        costs: data.costs || {},
        performance: data.performance || {},
        usage: data.usage || {},
      }));

      // Act: Process CPU-intensive operations
      const start = process.cpuUsage();
      const promises = cpuIntensiveOperations.map((data, i) =>
        service.updateStatistics(`cpu-test-${i}`, data)
      );

      await Promise.all(promises);
      const cpuUsage = process.cpuUsage(start);

      // Assert: CPU usage should be reasonable
      const totalCpuTime = cpuUsage.user + cpuUsage.system;
      const cpuTimePerOperation = totalCpuTime / cpuIntensiveOperations.length;

      expect(cpuTimePerOperation).toBeLessThan(10000); // Less than 10ms CPU time per operation
    });

    it('should handle garbage collection pressure efficiently', async () => {
      // Arrange: Operations that create garbage
      const garbageGeneratingOps = 200;
      const largeObjectSize = 1000;

      repository.upsert.mockImplementation(async () => {
        // Generate garbage
        const garbage = Array.from({ length: largeObjectSize }, (_, i) => ({
          [`temp_${i}`]: Math.random().toString(36),
        }));

        return {
          id: 'gc-test',
          projectId: 'gc-test',
          costs: {},
          performance: {},
          usage: {},
        };
      });

      // Act: Generate operations that stress GC
      const initialMemory = process.memoryUsage();
      
      for (let i = 0; i < garbageGeneratingOps; i++) {
        await service.updateStatistics(`gc-test-${i}`, {
          costs: { claudeApi: Math.random() * 10 },
        });
        
        // Force GC periodically if available
        if (i % 50 === 0 && global.gc) {
          global.gc();
        }
      }

      const finalMemory = process.memoryUsage();

      // Assert: Memory growth should be controlled
      const memoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryGrowthPerOp = memoryGrowth / garbageGeneratingOps;

      expect(memoryGrowthPerOp).toBeLessThan(10000); // Less than 10KB growth per operation
    });
  });
});