import { ProjectStatisticsEntity } from '../../../../src/statistics/entities/project-statistics.entity';

describe('ProjectStatisticsEntity', () => {
  const mockProjectId = 'project-123-uuid';
  const mockEntityData = {
    id: 'stats-123-uuid',
    projectId: mockProjectId,
    costs: {
      claudeApi: 12.45,
      storage: 2.30,
      compute: 5.67,
      bandwidth: 1.23,
      total: 21.65,
      currency: 'USD',
    },
    performance: {
      generationTime: 45.23,
      processingTime: 12.45,
      interviewTime: 180.75,
      exportTime: 8.90,
      totalTime: 247.33,
      queueWaitTime: 5.12,
    },
    usage: {
      documentsGenerated: 5,
      filesProcessed: 3,
      tokensUsed: 15750,
      apiCallsCount: 12,
      storageSize: 2048576,
      exportCount: 2,
    },
    metadata: {
      sources: ['cost-tracking-service'],
      version: '1.0.0',
      batchId: 'batch-2024081810-abc123',
      confidence: 0.95,
    },
    lastUpdated: new Date('2024-08-18T10:30:00Z'),
  };

  describe('Constructor and Initialization', () => {
    it('should create entity with complete data', () => {
      // Act
      const entity = new ProjectStatisticsEntity(mockEntityData);

      // Assert
      expect(entity.id).toBe(mockEntityData.id);
      expect(entity.projectId).toBe(mockEntityData.projectId);
      expect(entity.costs).toEqual(mockEntityData.costs);
      expect(entity.performance).toEqual(mockEntityData.performance);
      expect(entity.usage).toEqual(mockEntityData.usage);
      expect(entity.metadata).toEqual(mockEntityData.metadata);
      expect(entity.lastUpdated).toEqual(mockEntityData.lastUpdated);
    });

    it('should create entity with minimal data', () => {
      // Arrange
      const minimalData = {
        id: 'stats-456',
        projectId: 'project-456',
        lastUpdated: new Date(),
      };

      // Act
      const entity = new ProjectStatisticsEntity(minimalData);

      // Assert
      expect(entity.id).toBe(minimalData.id);
      expect(entity.projectId).toBe(minimalData.projectId);
      expect(entity.costs).toEqual({});
      expect(entity.performance).toEqual({});
      expect(entity.usage).toEqual({});
      expect(entity.metadata).toEqual({});
    });

    it('should handle undefined optional fields', () => {
      // Arrange
      const dataWithUndefined = {
        ...mockEntityData,
        metadata: undefined,
      };

      // Act
      const entity = new ProjectStatisticsEntity(dataWithUndefined);

      // Assert
      expect(entity.metadata).toEqual({});
      expect(entity.costs).toEqual(mockEntityData.costs);
    });

    it('should handle empty initialization', () => {
      // Act
      const entity = new ProjectStatisticsEntity();

      // Assert
      expect(entity.costs).toEqual({});
      expect(entity.performance).toEqual({});
      expect(entity.usage).toEqual({});
      expect(entity.metadata).toEqual({});
    });
  });

  describe('mergeCosts', () => {
    let entity: ProjectStatisticsEntity;

    beforeEach(() => {
      entity = new ProjectStatisticsEntity(mockEntityData);
    });

    it('should merge new cost data with existing data', () => {
      // Arrange
      const newCosts = {
        claudeApi: 20.0,
        bandwidth: 2.0,
      };

      // Act
      entity.mergeCosts(newCosts);

      // Assert
      expect(entity.costs.claudeApi).toBe(20.0); // Updated
      expect(entity.costs.storage).toBe(2.30); // Preserved
      expect(entity.costs.bandwidth).toBe(2.0); // Updated
    });

    it('should recalculate total when merging costs', () => {
      // Arrange
      const newCosts = {
        claudeApi: 15.0,
        storage: 3.0,
        compute: 6.0,
        bandwidth: 1.5,
      };

      // Act
      entity.mergeCosts(newCosts);

      // Assert
      expect(entity.costs.total).toBe(25.5);
    });

    it('should recalculate cost breakdown percentages', () => {
      // Arrange
      const newCosts = {
        claudeApi: 50.0,
        storage: 25.0,
        compute: 20.0,
        bandwidth: 5.0,
      };

      // Act
      entity.mergeCosts(newCosts);

      // Assert
      expect(entity.costs.total).toBe(100.0);
      expect(entity.costs.breakdown?.claudeApiPercentage).toBe(50.0);
      expect(entity.costs.breakdown?.storagePercentage).toBe(25.0);
      expect(entity.costs.breakdown?.computePercentage).toBe(20.0);
      expect(entity.costs.breakdown?.bandwidthPercentage).toBe(5.0);
    });

    it('should handle merging with empty costs object', () => {
      // Arrange
      entity.costs = {};
      const newCosts = {
        claudeApi: 10.0,
      };

      // Act
      entity.mergeCosts(newCosts);

      // Assert
      expect(entity.costs.claudeApi).toBe(10.0);
      expect(entity.costs.total).toBe(10.0);
    });

    it('should preserve currency when merging', () => {
      // Arrange
      const newCosts = {
        claudeApi: 15.0,
      };

      // Act
      entity.mergeCosts(newCosts);

      // Assert
      expect(entity.costs.currency).toBe('USD');
    });

    it('should update currency when explicitly provided', () => {
      // Arrange
      const newCosts = {
        claudeApi: 15.0,
        currency: 'EUR',
      };

      // Act
      entity.mergeCosts(newCosts);

      // Assert
      expect(entity.costs.currency).toBe('EUR');
    });
  });

  describe('mergePerformance', () => {
    let entity: ProjectStatisticsEntity;

    beforeEach(() => {
      entity = new ProjectStatisticsEntity(mockEntityData);
    });

    it('should merge new performance data', () => {
      // Arrange
      const newPerformance = {
        generationTime: 55.0,
        exportTime: 12.0,
      };

      // Act
      entity.mergePerformance(newPerformance);

      // Assert
      expect(entity.performance.generationTime).toBe(55.0);
      expect(entity.performance.processingTime).toBe(12.45); // Preserved
      expect(entity.performance.exportTime).toBe(12.0);
    });

    it('should recalculate total time when merging', () => {
      // Arrange
      const newPerformance = {
        generationTime: 50.0,
        processingTime: 15.0,
        interviewTime: 200.0,
        exportTime: 10.0,
        queueWaitTime: 5.0,
      };

      // Act
      entity.mergePerformance(newPerformance);

      // Assert
      expect(entity.performance.totalTime).toBe(280.0);
    });

    it('should handle merging with empty performance object', () => {
      // Arrange
      entity.performance = {};
      const newPerformance = {
        generationTime: 30.0,
      };

      // Act
      entity.mergePerformance(newPerformance);

      // Assert
      expect(entity.performance.generationTime).toBe(30.0);
      expect(entity.performance.totalTime).toBe(30.0);
    });

    it('should handle partial time updates', () => {
      // Arrange
      const newPerformance = {
        generationTime: 60.0,
        // Only updating generation time
      };

      // Act
      entity.mergePerformance(newPerformance);

      // Assert
      expect(entity.performance.generationTime).toBe(60.0);
      // Total should be recalculated with new generation time
      const expectedTotal = 60.0 + 12.45 + 180.75 + 8.90 + 5.12;
      expect(entity.performance.totalTime).toBeCloseTo(expectedTotal, 2);
    });

    it('should handle zero values correctly', () => {
      // Arrange
      const newPerformance = {
        queueWaitTime: 0,
        exportTime: 0,
      };

      // Act
      entity.mergePerformance(newPerformance);

      // Assert
      expect(entity.performance.queueWaitTime).toBe(0);
      expect(entity.performance.exportTime).toBe(0);
    });

    it('should identify bottlenecks automatically', () => {
      // Arrange
      const newPerformance = {
        generationTime: 120.0, // Above threshold (60s)
        queueWaitTime: 15.0, // Above threshold (10s)
      };

      // Act
      entity.mergePerformance(newPerformance);

      // Assert
      expect(entity.performance.bottlenecks).toContain('generation');
      expect(entity.performance.bottlenecks).toContain('queue_wait');
    });

    it('should handle efficiency object merging', () => {
      // Arrange
      const newPerformance = {
        efficiency: {
          documentsPerHour: 12.0,
          tokensPerSecond: 50.0,
        },
      };

      // Act
      entity.mergePerformance(newPerformance);

      // Assert
      expect(entity.performance.efficiency?.documentsPerHour).toBe(12.0);
      expect(entity.performance.efficiency?.tokensPerSecond).toBe(50.0);
    });
  });

  describe('mergeUsage', () => {
    let entity: ProjectStatisticsEntity;

    beforeEach(() => {
      entity = new ProjectStatisticsEntity(mockEntityData);
    });

    it('should merge new usage data', () => {
      // Arrange
      const newUsage = {
        documentsGenerated: 8,
        apiCallsCount: 20,
      };

      // Act
      entity.mergeUsage(newUsage);

      // Assert
      expect(entity.usage.documentsGenerated).toBe(8);
      expect(entity.usage.filesProcessed).toBe(3); // Preserved
      expect(entity.usage.apiCallsCount).toBe(20);
    });

    it('should calculate derived metrics automatically', () => {
      // Arrange
      const newUsage = {
        tokensUsed: 20000,
        documentsGenerated: 4,
      };

      // Act
      entity.mergeUsage(newUsage);

      // Assert
      expect(entity.usage.tokensPerDocument).toBe(5000); // 20000 / 4
    });

    it('should calculate storage efficiency', () => {
      // Arrange
      const newUsage = {
        storageSize: 1024000, // 1MB
        documentsGenerated: 2,
      };

      // Act
      entity.mergeUsage(newUsage);

      // Assert
      expect(entity.usage.storageEfficiency).toBe(512000); // 1024000 / 2
    });

    it('should determine resource intensity', () => {
      // Arrange
      const intensiveUsage = {
        tokensUsed: 50000, // High
        documentsGenerated: 10, // High
        storageSize: 50 * 1024 * 1024, // 50MB - High
        apiCallsCount: 50, // High
      };

      // Act
      entity.mergeUsage(intensiveUsage);

      // Assert
      expect(entity.usage.resourceIntensity).toBe('intensive');
    });

    it('should handle moderate resource intensity', () => {
      // Arrange - Modifié pour correspondre à l'algorithme corrigé
      const moderateUsage = {
        tokensUsed: 12000, // > 10000, donc 1 point
        documentsGenerated: 7, // > 5, donc 1 point
        // Total: 2 points >= 2 donc 'moderate'
      };

      // Act
      entity.mergeUsage(moderateUsage);

      // Assert
      expect(entity.usage.resourceIntensity).toBe('moderate');
    });

    it('should handle light resource intensity', () => {
      // Arrange
      const lightUsage = {
        tokensUsed: 1000, // Light
        documentsGenerated: 1, // Light
      };

      // Act
      entity.mergeUsage(lightUsage);

      // Assert
      expect(entity.usage.resourceIntensity).toBe('light');
    });

    it('should handle activity pattern merging', () => {
      // Arrange
      const newUsage = {
        activityPattern: {
          peakUsageHour: 14,
          usageFrequency: 'daily' as const,
          preferredFormats: ['PDF', 'DOCX'],
        },
      };

      // Act
      entity.mergeUsage(newUsage);

      // Assert
      expect(entity.usage.activityPattern?.peakUsageHour).toBe(14);
      expect(entity.usage.activityPattern?.usageFrequency).toBe('daily');
      expect(entity.usage.activityPattern?.preferredFormats).toEqual(['PDF', 'DOCX']);
    });

    it('should handle merging with empty usage object', () => {
      // Arrange
      entity.usage = {};
      const newUsage = {
        documentsGenerated: 3,
        tokensUsed: 5000,
      };

      // Act
      entity.mergeUsage(newUsage);

      // Assert
      expect(entity.usage.documentsGenerated).toBe(3);
      expect(entity.usage.tokensUsed).toBe(5000);
      expect(entity.usage.tokensPerDocument).toBe(Math.round(5000 / 3));
    });

    it('should handle zero values', () => {
      // Arrange
      const newUsage = {
        exportCount: 0,
        apiCallsCount: 0,
      };

      // Act
      entity.mergeUsage(newUsage);

      // Assert
      expect(entity.usage.exportCount).toBe(0);
      expect(entity.usage.apiCallsCount).toBe(0);
    });
  });

  describe('updateMetadata', () => {
    let entity: ProjectStatisticsEntity;

    beforeEach(() => {
      entity = new ProjectStatisticsEntity(mockEntityData);
    });

    it('should update metadata fields', () => {
      // Arrange
      const newMetadata = {
        sources: ['monitoring-service'],
        version: '2.0.0',
        confidence: 0.85,
      };

      // Act
      entity.updateMetadata(newMetadata);

      // Assert
      expect(entity.metadata?.sources).toEqual(['monitoring-service']);
      expect(entity.metadata?.version).toBe('2.0.0');
      expect(entity.metadata?.confidence).toBe(0.85);
      expect(entity.metadata?.batchId).toBe('batch-2024081810-abc123'); // Preserved
    });

    it('should set data freshness to 0 when updating', () => {
      // Arrange
      const newMetadata = {
        version: '2.0.0',
      };

      // Act
      entity.updateMetadata(newMetadata);

      // Assert
      expect(entity.metadata).toBeDefined();
      expect(entity.metadata!.dataFreshness).toBe(0);
    });

    it('should create metadata when empty', () => {
      // Arrange
      entity.metadata = {};
      const newMetadata = {
        sources: ['new-service'],
        version: '1.0.0',
      };

      // Act
      entity.updateMetadata(newMetadata);

      // Assert
      expect(entity.metadata).toEqual(expect.objectContaining(newMetadata));
      expect(entity.metadata?.dataFreshness).toBe(0);
    });

    it('should handle undefined metadata gracefully', () => {
      // Arrange
      entity.metadata = undefined;
      const newMetadata = {
        sources: ['test-service'],
      };

      // Act
      entity.updateMetadata(newMetadata);

      // Assert
      expect(entity.metadata).toEqual(expect.objectContaining(newMetadata));
      expect(entity.metadata!.dataFreshness).toBe(0);
    });
  });

  describe('validateConsistency', () => {
    it('should validate consistent data', () => {
      // Arrange
      const entity = new ProjectStatisticsEntity(mockEntityData);

      // Act
      const result = entity.validateConsistency();

      // Assert
      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('should detect negative total cost', () => {
      // Arrange
      const invalidData = {
        ...mockEntityData,
        costs: {
          ...mockEntityData.costs,
          total: -10.0,
        },
      };
      const entity = new ProjectStatisticsEntity(invalidData);

      // Act
      const result = entity.validateConsistency();

      // Assert
      expect(result.valid).toBe(false);
      expect(result.issues).toContain('Total cost cannot be negative');
    });

    it('should detect negative total time', () => {
      // Arrange
      const invalidData = {
        ...mockEntityData,
        performance: {
          ...mockEntityData.performance,
          totalTime: -50.0,
        },
      };
      const entity = new ProjectStatisticsEntity(invalidData);

      // Act
      const result = entity.validateConsistency();

      // Assert
      expect(result.valid).toBe(false);
      expect(result.issues).toContain('Total time cannot be negative');
    });

    it('should detect export count exceeding documents generated', () => {
      // Arrange
      const invalidData = {
        ...mockEntityData,
        usage: {
          ...mockEntityData.usage,
          documentsGenerated: 3,
          exportCount: 5,
        },
      };
      const entity = new ProjectStatisticsEntity(invalidData);

      // Act
      const result = entity.validateConsistency();

      // Assert
      expect(result.valid).toBe(false);
      expect(result.issues).toContain('Export count cannot exceed documents generated');
    });

    it('should detect cost per document inconsistency', () => {
      // Arrange
      const invalidData = {
        ...mockEntityData,
        costs: {
          ...mockEntityData.costs,
          total: 20.0,
          costPerDocument: 10.0, // Should be 4.0 (20/5)
        },
        usage: {
          ...mockEntityData.usage,
          documentsGenerated: 5,
        },
      };
      const entity = new ProjectStatisticsEntity(invalidData);

      // Act
      const result = entity.validateConsistency();

      // Assert
      expect(result.valid).toBe(false);
      expect(result.issues).toContain('Cost per document is inconsistent with total cost and document count');
    });

    it('should handle missing data gracefully', () => {
      // Arrange
      const entity = new ProjectStatisticsEntity({
        id: 'test',
        projectId: 'test',
        costs: {},
        performance: {},
        usage: {},
        lastUpdated: new Date(),
      });

      // Act
      const result = entity.validateConsistency();

      // Assert
      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });
  });

  describe('calculateDataQualityScore', () => {
    it('should calculate quality score for complete data', () => {
      // Arrange
      const entity = new ProjectStatisticsEntity(mockEntityData);

      // Act
      const score = entity.calculateDataQualityScore();

      // Assert
      expect(score).toBeGreaterThan(80);
      expect(score).toBeLessThanOrEqual(100);
      expect(entity.metadata?.qualityScore).toBe(score);
    });

    it('should return lower score for incomplete data', () => {
      // Arrange
      const incompleteData = {
        ...mockEntityData,
        costs: {}, // Missing cost data
        performance: {}, // Missing performance data
        usage: {}, // Missing usage data
      };
      const entity = new ProjectStatisticsEntity(incompleteData);

      // Act
      const score = entity.calculateDataQualityScore();

      // Assert
      expect(score).toBeLessThan(80);
      expect(score).toBeGreaterThan(0);
    });

    it('should handle empty data gracefully', () => {
      // Arrange
      const entity = new ProjectStatisticsEntity({
        id: 'test',
        projectId: 'test',
        lastUpdated: new Date(),
      });

      // Act
      const score = entity.calculateDataQualityScore();

      // Assert
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should penalize inconsistent data', () => {
      // Arrange
      const inconsistentData = {
        ...mockEntityData,
        costs: {
          ...mockEntityData.costs,
          total: -10.0, // Invalid - 1 issue = -5 points
        },
        usage: {
          ...mockEntityData.usage,
          documentsGenerated: 2,
          exportCount: 5, // Invalid - more exports than documents - 1 issue = -5 points
        },
      };
      const entity = new ProjectStatisticsEntity(inconsistentData);

      // Act
      const score = entity.calculateDataQualityScore();

      // Assert
      // Score de base 100, moins 10 points (2 * 5) pour les incohérences = 90
      // Donc le score devrait être autour de 90, donc > 70
      expect(score).toBeLessThan(95); // Should be penalized for inconsistencies
      expect(score).toBeGreaterThan(80); // But not too severely
    });

    it('should consider data freshness in quality score', () => {
      // Arrange
      const staleData = {
        ...mockEntityData,
        metadata: {
          ...mockEntityData.metadata,
          dataFreshness: 120, // 2 hours old
        },
      };
      const entity = new ProjectStatisticsEntity(staleData);

      // Act
      const score = entity.calculateDataQualityScore();

      // Assert
      const freshEntity = new ProjectStatisticsEntity(mockEntityData);
      const freshScore = freshEntity.calculateDataQualityScore();
      expect(score).toBeLessThan(freshScore);
    });
  });

  describe('Serialization', () => {
    it('should convert to JSON correctly with toJSON', () => {
      // Arrange
      const entity = new ProjectStatisticsEntity(mockEntityData);

      // Act
      const json = entity.toJSON();

      // Assert
      expect(json.id).toBe(entity.id);
      expect(json.projectId).toBe(entity.projectId);
      expect(json.costs).toEqual(entity.costs);
      expect(json.performance).toEqual(entity.performance);
      expect(json.usage).toEqual(entity.usage);
      expect(json.metadata).toEqual(entity.metadata);
      expect(json.lastUpdated).toEqual(entity.lastUpdated);
    });

    it('should serialize to JSON correctly', () => {
      // Arrange
      const entity = new ProjectStatisticsEntity(mockEntityData);

      // Act
      const json = JSON.stringify(entity);
      const parsed = JSON.parse(json);

      // Assert
      expect(parsed.id).toBe(entity.id);
      expect(parsed.projectId).toBe(entity.projectId);
      expect(parsed.costs).toEqual(entity.costs);
      expect(parsed.performance).toEqual(entity.performance);
      expect(parsed.usage).toEqual(entity.usage);
    });

    it('should create entity from JSON using fromJSON', () => {
      // Arrange
      const jsonData = {
        id: 'test-id',
        projectId: 'test-project',
        costs: { claudeApi: 10.0, total: 10.0 },
        performance: { generationTime: 30.0, totalTime: 30.0 },
        usage: { documentsGenerated: 2 },
        metadata: { version: '1.0.0' },
        lastUpdated: '2024-08-18T10:30:00.000Z',
      };

      // Act
      const entity = ProjectStatisticsEntity.fromJSON(jsonData);

      // Assert
      expect(entity.id).toBe(jsonData.id);
      expect(entity.projectId).toBe(jsonData.projectId);
      expect(entity.costs).toEqual(jsonData.costs);
      expect(entity.performance).toEqual(jsonData.performance);
      expect(entity.usage).toEqual(jsonData.usage);
      expect(entity.metadata).toEqual(jsonData.metadata);
      expect(entity.lastUpdated).toEqual(new Date(jsonData.lastUpdated));
    });

    it('should handle date serialization', () => {
      // Arrange
      const entity = new ProjectStatisticsEntity(mockEntityData);

      // Act
      const json = JSON.stringify(entity);
      const parsed = JSON.parse(json);

      // Assert
      expect(typeof parsed.lastUpdated).toBe('string');
      expect(new Date(parsed.lastUpdated)).toEqual(entity.lastUpdated);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle extremely large numbers', () => {
      // Arrange
      const largeData = {
        ...mockEntityData,
        costs: {
          total: Number.MAX_SAFE_INTEGER - 1,
          claudeApi: Number.MAX_SAFE_INTEGER - 1,
        },
        usage: {
          tokensUsed: Number.MAX_SAFE_INTEGER - 1,
          documentsGenerated: 1,
        },
      };

      // Act
      const entity = new ProjectStatisticsEntity(largeData);

      // Assert
      expect(entity.costs.total).toBe(Number.MAX_SAFE_INTEGER - 1);
      expect(entity.usage.tokensUsed).toBe(Number.MAX_SAFE_INTEGER - 1);
    });

    it('should handle very small decimal values', () => {
      // Arrange
      const smallData = {
        ...mockEntityData,
        costs: {
          claudeApi: 0.0001,
          storage: 1e-10,
          total: 0.0001 + 1e-10,
        },
      };

      // Act
      const entity = new ProjectStatisticsEntity(smallData);

      // Assert
      expect(entity.costs.claudeApi).toBe(0.0001);
      expect(entity.costs.storage).toBe(1e-10);
    });

    it('should handle circular references in data', () => {
      // Arrange
      const circularData: any = { ...mockEntityData };
      circularData.costs.self = circularData.costs;

      // Act & Assert
      expect(() => new ProjectStatisticsEntity(circularData)).not.toThrow();
    });

    it('should preserve data immutability when needed', () => {
      // Arrange
      const entity = new ProjectStatisticsEntity(mockEntityData);
      const originalCosts = { ...entity.costs };

      // Act
      entity.mergeCosts({ claudeApi: 999.0 });

      // Assert
      expect(originalCosts.claudeApi).toBe(12.45); // Original object unchanged
      expect(entity.costs.claudeApi).toBe(999.0); // Entity updated
    });

    it('should handle undefined values in merge operations', () => {
      // Arrange
      const entity = new ProjectStatisticsEntity(mockEntityData);

      // Act & Assert
      expect(() => entity.mergeCosts(undefined as any)).not.toThrow();
      expect(() => entity.mergePerformance(undefined as any)).not.toThrow();
      expect(() => entity.mergeUsage(undefined as any)).not.toThrow();
      expect(() => entity.updateMetadata(undefined as any)).not.toThrow();
    });
  });
});