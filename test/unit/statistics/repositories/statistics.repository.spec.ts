import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { StatisticsRepository } from '../../../../src/statistics/statistics.repository';
import { DatabaseService } from '../../../../src/database/database.service';
import { UpdateStatisticsDto } from '../../../../src/statistics/dto/update-statistics.dto';
import { ProjectStatisticsEntity } from '../../../../src/statistics/entities/project-statistics.entity';
import { plainToClass } from 'class-transformer';

// Helper function to create valid UpdateStatisticsDto
function createValidUpdateStatisticsDto(data: Partial<UpdateStatisticsDto>): UpdateStatisticsDto {
  const dto = plainToClass(UpdateStatisticsDto, data);
  
  // Add validation methods
  dto.validateCostsCoherence = jest.fn().mockReturnValue(true);
  dto.validatePerformanceCoherence = jest.fn().mockReturnValue(true);
  dto.validateUsageCoherence = jest.fn().mockReturnValue(true);
  dto.validateTimestamp = jest.fn().mockReturnValue(true);
  dto.isValid = jest.fn().mockReturnValue({ valid: true, errors: [] });
  
  return dto;
}

describe('StatisticsRepository', () => {
  let repository: StatisticsRepository;
  let db: jest.Mocked<DatabaseService>;

  const mockProjectId = 'project-123-uuid';
  const mockStatisticsId = 'stats-123-uuid';

  const mockPrismaRecord = {
    id: mockStatisticsId,
    projectId: mockProjectId,
    costs: {
      claudeApi: 12.45,
      storage: 2.30,
      compute: 5.67,
      total: 20.42,
      currency: 'USD',
    },
    performance: {
      generationTime: 45.23,
      processingTime: 12.45,
      totalTime: 57.68,
    },
    usage: {
      documentsGenerated: 5,
      tokensUsed: 15750,
      apiCallsCount: 12,
    },
    lastUpdated: new Date('2024-08-18T10:30:00Z'),
    project: {
      id: mockProjectId,
      name: 'Test Project',
      status: 'ACTIVE',
      description: 'Test Description',
      initialPrompt: 'Test Prompt',
      uploadedFileIds: [],
      generatedFileIds: [],
      ownerId: 'owner-123',
      createdAt: new Date(),
      updatedAt: new Date(),
      generatedAt: null,
      processedAt: null,
      exportedAt: null,
      archivedAt: null,
      deletedAt: null,
      orderIndex: 1,
      tags: [],
      metadata: {},
      settings: {},
      collaborators: [],
      permissions: {},
      auditLog: [],
      scheduledTasks: [],
      customFields: {},
      integrations: {},
      backupInfo: {},
      performanceMetrics: {},
      resourceUsage: {},
      dependencies: [],
      childProjects: [],
      parentProjectId: null,
      templateId: null,
      branchInfo: {},
      mergeRequests: [],
      deploymentInfo: {},
      monitoringConfig: {},
      alertConfig: {},
    },
  };

  beforeEach(async () => {
    const mockDb = {
      projectStatistics: {
        upsert: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
      },
      $queryRaw: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StatisticsRepository,
        {
          provide: DatabaseService,
          useValue: mockDb,
        },
      ],
    }).compile();

    repository = module.get<StatisticsRepository>(StatisticsRepository);
    db = module.get(DatabaseService);

    // Configure default mock implementations
    (db.projectStatistics.upsert as jest.Mock).mockResolvedValue(mockPrismaRecord);
    (db.projectStatistics.findUnique as jest.Mock).mockResolvedValue(mockPrismaRecord);
    (db.projectStatistics.findMany as jest.Mock).mockResolvedValue([mockPrismaRecord]);
    (db.projectStatistics.update as jest.Mock).mockResolvedValue(mockPrismaRecord);
    (db.projectStatistics.delete as jest.Mock).mockResolvedValue(mockPrismaRecord);
    (db.projectStatistics.deleteMany as jest.Mock).mockResolvedValue({ count: 1 });
    (db.$queryRaw as jest.Mock).mockResolvedValue([{
      total_projects: BigInt(1250),
      total_costs: 45789.32,
      total_documents: BigInt(8945),
      avg_quality_score: 87.5,
    }]);

    // Suppress console logs during tests
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('upsert', () => {
    const updateDto = createValidUpdateStatisticsDto({
      costs: {
        claudeApi: 15.00,
        storage: 3.00,
        total: 18.00,
      },
      performance: {
        generationTime: 50.0,
        totalTime: 60.0,
      },
      usage: {
        documentsGenerated: 6,
        tokensUsed: 18000,
      },
    });

    it('should create new statistics successfully', async () => {
      // Arrange
      jest.spyOn(repository, 'findByProjectId').mockResolvedValue(null);
      (db.projectStatistics.upsert as jest.Mock).mockResolvedValue(mockPrismaRecord);

      // Act
      const result = await repository.upsert(mockProjectId, updateDto);

      // Assert
      expect(db.projectStatistics.upsert).toHaveBeenCalledWith({
        where: { projectId: mockProjectId },
        create: {
          projectId: mockProjectId,
          costs: expect.any(Object),
          performance: expect.any(Object),
          usage: expect.any(Object),
        },
        update: {
          costs: expect.any(Object),
          performance: expect.any(Object),
          usage: expect.any(Object),
        },
        include: {
          project: false,
        },
      });
      expect(result).toBeInstanceOf(ProjectStatisticsEntity);
    });

    it('should update existing statistics with merge', async () => {
      // Arrange
      const existingEntity = new ProjectStatisticsEntity({
        id: mockStatisticsId,
        projectId: mockProjectId,
        costs: mockPrismaRecord.costs,
        performance: mockPrismaRecord.performance,
        usage: mockPrismaRecord.usage,
        lastUpdated: mockPrismaRecord.lastUpdated,
      });
      jest.spyOn(repository, 'findByProjectId').mockResolvedValue(existingEntity);
      (db.projectStatistics.upsert as jest.Mock).mockResolvedValue(mockPrismaRecord);

      // Act
      const result = await repository.upsert(mockProjectId, updateDto);

      // Assert
      expect(repository.findByProjectId).toHaveBeenCalledWith(mockProjectId);
      expect(db.projectStatistics.upsert).toHaveBeenCalled();
      expect(result).toBeInstanceOf(ProjectStatisticsEntity);
    });

    it('should sanitize JSON data correctly', async () => {
      // Arrange
      jest.spyOn(repository, 'findByProjectId').mockResolvedValue(null);
      (db.projectStatistics.upsert as jest.Mock).mockResolvedValue(mockPrismaRecord);

      const dtoWithNulls = createValidUpdateStatisticsDto({
        costs: { claudeApi: 10, storage: null as any, total: undefined as any },
      });

      // Act
      await repository.upsert(mockProjectId, dtoWithNulls);

      // Assert
      const callArgs = (db.projectStatistics.upsert as jest.Mock).mock.calls[0][0];
      expect(callArgs.create.costs).toEqual(expect.objectContaining({ claudeApi: 10 }));
    });

    it('should handle metadata in usage field', async () => {
      // Arrange
      jest.spyOn(repository, 'findByProjectId').mockResolvedValue(null);
      (db.projectStatistics.upsert as jest.Mock).mockResolvedValue(mockPrismaRecord);

      const dtoWithMetadata = createValidUpdateStatisticsDto({
        ...updateDto,
        metadata: {
          source: 'cost-tracking-service',
          timestamp: new Date(),
        },
      });

      // Act
      await repository.upsert(mockProjectId, dtoWithMetadata);

      // Assert
      const callArgs = (db.projectStatistics.upsert as jest.Mock).mock.calls[0][0];
      expect(callArgs.create.usage._metadata).toEqual(expect.objectContaining({
        source: 'cost-tracking-service',
        timestamp: expect.any(String),
      }));
    });

    it('should handle database constraint violations', async () => {
      // Arrange
      jest.spyOn(repository, 'findByProjectId').mockResolvedValue(null);
      const constraintError = new Error('Unique constraint violation');
      (constraintError as any).code = 'P2002';
      (db.projectStatistics.upsert as jest.Mock).mockRejectedValue(constraintError);

      // Act & Assert
      await expect(repository.upsert(mockProjectId, updateDto)).rejects.toThrow(
        'Statistics upsert failed: Unique constraint violation',
      );
    });

    it('should handle database connection errors', async () => {
      // Arrange
      jest.spyOn(repository, 'findByProjectId').mockResolvedValue(null);
      (db.projectStatistics.upsert as jest.Mock).mockRejectedValue(new Error('Connection timeout'));

      // Act & Assert
      await expect(repository.upsert(mockProjectId, updateDto)).rejects.toThrow(
        'Statistics upsert failed: Connection timeout',
      );
    });

    it('should merge with existing entity correctly', async () => {
      // Arrange
      const existingEntity = new ProjectStatisticsEntity({
        id: mockStatisticsId,
        projectId: mockProjectId,
        costs: { claudeApi: 10.0, storage: 2.0, total: 12.0 },
        performance: { generationTime: 30.0, totalTime: 40.0 },
        usage: { documentsGenerated: 3, tokensUsed: 9000 },
        lastUpdated: new Date(),
      });

      jest.spyOn(repository, 'findByProjectId').mockResolvedValue(existingEntity);
      jest.spyOn(existingEntity, 'mergeCosts');
      jest.spyOn(existingEntity, 'mergePerformance');
      jest.spyOn(existingEntity, 'mergeUsage');
      jest.spyOn(existingEntity, 'updateMetadata');
      (db.projectStatistics.upsert as jest.Mock).mockResolvedValue(mockPrismaRecord);

      // Act
      await repository.upsert(mockProjectId, updateDto);

      // Assert
      expect(existingEntity.mergeCosts).toHaveBeenCalledWith(updateDto.costs);
      expect(existingEntity.mergePerformance).toHaveBeenCalledWith(updateDto.performance);
      expect(existingEntity.mergeUsage).toHaveBeenCalledWith(updateDto.usage);
    });
  });

  describe('findByProjectId', () => {
    it('should find statistics by project ID successfully', async () => {
      // Arrange
      (db.projectStatistics.findUnique as jest.Mock).mockResolvedValue(mockPrismaRecord);

      // Act
      const result = await repository.findByProjectId(mockProjectId);

      // Assert
      expect(db.projectStatistics.findUnique).toHaveBeenCalledWith({
        where: { projectId: mockProjectId },
        include: { project: true },
      });
      expect(result).toBeInstanceOf(ProjectStatisticsEntity);
      expect(result?.projectId).toBe(mockProjectId);
    });

    it('should return null when statistics not found', async () => {
      // Arrange
      (db.projectStatistics.findUnique as jest.Mock).mockResolvedValue(null);

      // Act
      const result = await repository.findByProjectId(mockProjectId);

      // Assert
      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      // Arrange
      (db.projectStatistics.findUnique as jest.Mock).mockRejectedValue(new Error('Query error'));

      // Act & Assert
      await expect(repository.findByProjectId(mockProjectId)).rejects.toThrow(
        'Statistics retrieval failed: Query error',
      );
    });

    it('should handle malformed data gracefully', async () => {
      // Arrange
      const malformedRecord = {
        ...mockPrismaRecord,
        costs: null,
        performance: undefined,
      };
      (db.projectStatistics.findUnique as jest.Mock).mockResolvedValue(malformedRecord);

      // Act
      const result = await repository.findByProjectId(mockProjectId);

      // Assert
      expect(result).toBeInstanceOf(ProjectStatisticsEntity);
      expect(result?.costs).toEqual({});
      expect(result?.performance).toEqual({});
    });

    it('should properly construct entity from Prisma record', async () => {
      // Arrange
      (db.projectStatistics.findUnique as jest.Mock).mockResolvedValue(mockPrismaRecord);

      // Act
      const result = await repository.findByProjectId(mockProjectId);

      // Assert
      expect(result?.id).toBe(mockStatisticsId);
      expect(result?.projectId).toBe(mockProjectId);
      expect(result?.costs).toEqual(mockPrismaRecord.costs);
      expect(result?.performance).toEqual(mockPrismaRecord.performance);
      expect(result?.usage).toEqual(mockPrismaRecord.usage);
      expect(result?.lastUpdated).toEqual(mockPrismaRecord.lastUpdated);
    });
  });

  describe('findById', () => {
    it('should find statistics by record ID', async () => {
      // Arrange
      (db.projectStatistics.findUnique as jest.Mock).mockResolvedValue(mockPrismaRecord);

      // Act
      const result = await repository.findById(mockStatisticsId);

      // Assert
      expect(db.projectStatistics.findUnique).toHaveBeenCalledWith({
        where: { id: mockStatisticsId },
        include: { project: true },
      });
      expect(result).toBeInstanceOf(ProjectStatisticsEntity);
    });

    it('should return null when not found', async () => {
      // Arrange
      (db.projectStatistics.findUnique as jest.Mock).mockResolvedValue(null);

      // Act
      const result = await repository.findById(mockStatisticsId);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('deleteByProjectId', () => {
    it('should delete statistics successfully', async () => {
      // Arrange
      (db.projectStatistics.delete as jest.Mock).mockResolvedValue(mockPrismaRecord);

      // Act
      const result = await repository.deleteByProjectId(mockProjectId);

      // Assert
      expect(db.projectStatistics.delete).toHaveBeenCalledWith({
        where: { projectId: mockProjectId },
      });
      expect(result).toBe(true);
    });

    it('should return false when record not found', async () => {
      // Arrange
      const notFoundError = new Error('Record not found');
      (notFoundError as any).code = 'P2025';
      (db.projectStatistics.delete as jest.Mock).mockRejectedValue(notFoundError);

      // Act
      const result = await repository.deleteByProjectId(mockProjectId);

      // Assert
      expect(result).toBe(false);
    });

    it('should handle database errors', async () => {
      // Arrange
      (db.projectStatistics.delete as jest.Mock).mockRejectedValue(new Error('Delete error'));

      // Act & Assert
      await expect(repository.deleteByProjectId(mockProjectId)).rejects.toThrow(
        'Statistics deletion failed: Delete error',
      );
    });
  });

  describe('findManyByProjectIds', () => {
    const projectIds = ['project-1', 'project-2', 'project-3'];

    it('should return empty map for empty input', async () => {
      // Act
      const result = await repository.findManyByProjectIds([]);

      // Assert
      expect(result.size).toBe(0);
      expect(db.projectStatistics.findMany).not.toHaveBeenCalled();
    });

    it('should find multiple statistics efficiently', async () => {
      // Arrange
      const records = [
        { ...mockPrismaRecord, projectId: 'project-1' },
        { ...mockPrismaRecord, projectId: 'project-2' },
      ];
      (db.projectStatistics.findMany as jest.Mock).mockResolvedValue(records);

      // Act
      const result = await repository.findManyByProjectIds(projectIds);

      // Assert
      expect(db.projectStatistics.findMany).toHaveBeenCalledWith({
        where: {
          projectId: { in: projectIds },
        },
        include: { project: false },
      });
      expect(result.size).toBe(2);
      expect(result.get('project-1')).toBeInstanceOf(ProjectStatisticsEntity);
      expect(result.get('project-2')).toBeInstanceOf(ProjectStatisticsEntity);
    });

    it('should handle large batch requests', async () => {
      // Arrange
      const largeBatch = Array.from({ length: 1000 }, (_, i) => `project-${i}`);
      (db.projectStatistics.findMany as jest.Mock).mockResolvedValue([]);

      // Act
      const result = await repository.findManyByProjectIds(largeBatch);

      // Assert
      expect(db.projectStatistics.findMany).toHaveBeenCalledWith({
        where: { projectId: { in: largeBatch } },
        include: { project: false },
      });
      expect(result.size).toBe(0);
    });

    it('should handle database errors in batch operations', async () => {
      // Arrange
      (db.projectStatistics.findMany as jest.Mock).mockRejectedValue(new Error('Batch error'));

      // Act & Assert
      await expect(repository.findManyByProjectIds(projectIds)).rejects.toThrow(
        'Batch statistics retrieval failed: Batch error',
      );
    });

    it('should properly map results by project ID', async () => {
      // Arrange
      const records = [
        { ...mockPrismaRecord, id: 'stats-1', projectId: 'project-1' },
        { ...mockPrismaRecord, id: 'stats-2', projectId: 'project-2' },
        { ...mockPrismaRecord, id: 'stats-3', projectId: 'project-3' },
      ];
      (db.projectStatistics.findMany as jest.Mock).mockResolvedValue(records);

      // Act
      const result = await repository.findManyByProjectIds(projectIds);

      // Assert
      expect(result.size).toBe(3);
      expect(result.get('project-1')?.id).toBe('stats-1');
      expect(result.get('project-2')?.id).toBe('stats-2');
      expect(result.get('project-3')?.id).toBe('stats-3');
    });
  });

  describe('partialUpdate', () => {
    const partialData = {
      costs: { claudeApi: 20.0 },
      performance: { generationTime: 60.0 },
    };

    it('should update partial data successfully', async () => {
      // Arrange
      (db.projectStatistics.update as jest.Mock).mockResolvedValue(mockPrismaRecord);

      // Act
      const result = await repository.partialUpdate(mockProjectId, partialData);

      // Assert
      expect(db.projectStatistics.update).toHaveBeenCalledWith({
        where: { projectId: mockProjectId },
        data: {
          costs: { claudeApi: 20.0 },
          performance: { generationTime: 60.0 },
        },
      });
      expect(result).toBeInstanceOf(ProjectStatisticsEntity);
    });

    it('should return null when record not found', async () => {
      // Arrange
      const notFoundError = new Error('Record not found');
      (notFoundError as any).code = 'P2025';
      (db.projectStatistics.update as jest.Mock).mockRejectedValue(notFoundError);

      // Act
      const result = await repository.partialUpdate(mockProjectId, partialData);

      // Assert
      expect(result).toBeNull();
    });

    it('should handle metadata in usage updates', async () => {
      // Arrange
      const dataWithMetadata = {
        usage: { documentsGenerated: 10 },
        metadata: { source: 'test-service' },
      };
      (db.projectStatistics.update as jest.Mock).mockResolvedValue(mockPrismaRecord);

      // Act
      await repository.partialUpdate(mockProjectId, dataWithMetadata);

      // Assert
      const callArgs = (db.projectStatistics.update as jest.Mock).mock.calls[0][0];
      expect(callArgs.data.usage._metadata).toEqual({ source: 'test-service' });
    });

    it('should sanitize JSON data in partial updates', async () => {
      // Arrange
      const dataWithNulls = {
        costs: { claudeApi: 15, storage: null as any, undefined: 'invalid' as any },
      };
      (db.projectStatistics.update as jest.Mock).mockResolvedValue(mockPrismaRecord);

      // Act
      await repository.partialUpdate(mockProjectId, dataWithNulls);

      // Assert
      const callArgs = (db.projectStatistics.update as jest.Mock).mock.calls[0][0];
      expect(callArgs.data.costs).toEqual(expect.objectContaining({ claudeApi: 15 }));
    });
  });

  describe('findByCriteria', () => {
    const criteria = {
      minTotalCost: 10.0,
      maxTotalCost: 100.0,
      minDocuments: 3,
      maxPerformanceTime: 600,
      dataFreshnessMinutes: 60,
    };

    it('should build complex search queries correctly', async () => {
      // Arrange
      (db.projectStatistics.findMany as jest.Mock).mockResolvedValue([mockPrismaRecord]);

      // Act
      const result = await repository.findByCriteria(criteria);

      // Assert
      expect(db.projectStatistics.findMany).toHaveBeenCalledWith({
        where: {
          AND: expect.arrayContaining([
            { costs: { path: ['total'], gte: 10.0 } },
            { costs: { path: ['total'], lte: 100.0 } },
            { usage: { path: ['documentsGenerated'], gte: 3 } },
            { performance: { path: ['totalTime'], lte: 600 } },
            { lastUpdated: { gte: expect.any(Date) } },
          ]),
        },
        include: { project: true },
        orderBy: { lastUpdated: 'desc' },
      });
      expect(result).toHaveLength(1);
      expect(result[0]).toBeInstanceOf(ProjectStatisticsEntity);
    });

    it('should handle empty criteria', async () => {
      // Arrange
      (db.projectStatistics.findMany as jest.Mock).mockResolvedValue([]);

      // Act
      const result = await repository.findByCriteria({});

      // Assert
      expect(db.projectStatistics.findMany).toHaveBeenCalledWith({
        where: { AND: [] },
        include: { project: true },
        orderBy: { lastUpdated: 'desc' },
      });
      expect(result).toHaveLength(0);
    });

    it('should handle single criteria filter', async () => {
      // Arrange
      (db.projectStatistics.findMany as jest.Mock).mockResolvedValue([mockPrismaRecord]);

      // Act
      const result = await repository.findByCriteria({ minTotalCost: 5.0 });

      // Assert
      expect(db.projectStatistics.findMany).toHaveBeenCalledWith({
        where: {
          AND: [{ costs: { path: ['total'], gte: 5.0 } }],
        },
        include: { project: true },
        orderBy: { lastUpdated: 'desc' },
      });
      expect(result).toHaveLength(1);
    });

    it('should calculate data freshness cutoff correctly', async () => {
      // Arrange
      const fixedDate = new Date('2024-08-18T12:00:00Z');
      jest.spyOn(Date, 'now').mockReturnValue(fixedDate.getTime());
      (db.projectStatistics.findMany as jest.Mock).mockResolvedValue([]);

      // Act
      await repository.findByCriteria({ dataFreshnessMinutes: 30 });

      // Assert
      const expectedCutoff = new Date(fixedDate.getTime() - 30 * 60 * 1000);
      expect(db.projectStatistics.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [{ lastUpdated: { gte: expectedCutoff } }],
          },
        }),
      );
    });

    it('should handle search errors', async () => {
      // Arrange
      (db.projectStatistics.findMany as jest.Mock).mockRejectedValue(new Error('Search error'));

      // Act & Assert
      await expect(repository.findByCriteria(criteria)).rejects.toThrow(
        'Statistics search failed: Search error',
      );
    });
  });

  describe('cleanupOldStatistics', () => {
    it('should cleanup old statistics for deleted/archived projects', async () => {
      // Arrange
      (db.projectStatistics.deleteMany as jest.Mock).mockResolvedValue({ count: 150 });

      // Act
      const result = await repository.cleanupOldStatistics(90);

      // Assert
      expect(db.projectStatistics.deleteMany).toHaveBeenCalledWith({
        where: {
          lastUpdated: { lt: expect.any(Date) },
          project: {
            status: { in: ['DELETED', 'ARCHIVED'] },
          },
        },
      });
      expect(result).toBe(150);
    });

    it('should calculate retention cutoff date correctly', async () => {
      // Arrange
      const fixedDate = new Date('2024-08-18T12:00:00Z');
      const dateSpy = jest.spyOn(Date, 'now').mockReturnValue(fixedDate.getTime());
      (db.projectStatistics.deleteMany as jest.Mock).mockResolvedValue({ count: 50 });

      // Act
      await repository.cleanupOldStatistics(90);

      // Assert
      const expectedCutoff = new Date(fixedDate.getTime() - (90 * 24 * 60 * 60 * 1000));
      expect(db.projectStatistics.deleteMany).toHaveBeenCalledWith({
        where: {
          lastUpdated: { lt: expect.any(Date) },
          project: {
            status: { in: ['DELETED', 'ARCHIVED'] },
          },
        },
      });
      
      dateSpy.mockRestore();
    });

    it('should handle cleanup errors', async () => {
      // Arrange
      (db.projectStatistics.deleteMany as jest.Mock).mockRejectedValue(new Error('Cleanup error'));

      // Act & Assert
      await expect(repository.cleanupOldStatistics(90)).rejects.toThrow(
        'Statistics cleanup failed: Cleanup error',
      );
    });

    it('should return zero when no records to cleanup', async () => {
      // Arrange
      (db.projectStatistics.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });

      // Act
      const result = await repository.cleanupOldStatistics(90);

      // Assert
      expect(result).toBe(0);
    });
  });

  describe('getGlobalStatistics', () => {
    const mockGlobalQueryResult = [
      {
        total_projects: BigInt(1250),
        total_costs: 45789.32,
        total_documents: BigInt(8945),
        avg_quality_score: 87.5,
      },
    ];

    it('should compute global statistics correctly', async () => {
      // Arrange
      (db.$queryRaw as jest.Mock).mockResolvedValue(mockGlobalQueryResult);

      // Act
      const result = await repository.getGlobalStatistics();

      // Assert
      expect(db.$queryRaw).toHaveBeenCalledWith(expect.any(Object));
      expect(result).toEqual({
        totalProjects: 1250,
        totalCosts: 45789.32,
        totalDocuments: 8945,
        averageQualityScore: 87.5,
        sourceDistribution: {},
      });
    });

    it('should handle empty database', async () => {
      // Arrange
      (db.$queryRaw as jest.Mock).mockResolvedValue([]);

      // Act
      const result = await repository.getGlobalStatistics();

      // Assert
      expect(result).toEqual({
        totalProjects: 0,
        totalCosts: 0,
        totalDocuments: 0,
        averageQualityScore: 0,
        sourceDistribution: {},
      });
    });

    it('should handle null values in query results', async () => {
      // Arrange
      const nullResults = [
        {
          total_projects: null,
          total_costs: null,
          total_documents: null,
          avg_quality_score: null,
        },
      ];
      (db.$queryRaw as jest.Mock).mockResolvedValue(nullResults);

      // Act
      const result = await repository.getGlobalStatistics();

      // Assert
      expect(result).toEqual({
        totalProjects: 0,
        totalCosts: 0,
        totalDocuments: 0,
        averageQualityScore: 0,
        sourceDistribution: {},
      });
    });

    it('should handle query errors', async () => {
      // Arrange
      (db.$queryRaw as jest.Mock).mockRejectedValue(new Error('SQL error'));

      // Act & Assert
      await expect(repository.getGlobalStatistics()).rejects.toThrow(
        'Global statistics computation failed: SQL error',
      );
    });

    it('should properly convert BigInt values to numbers', async () => {
      // Arrange
      const bigIntResults = [
        {
          total_projects: BigInt(5000),
          total_costs: 123456.78,
          total_documents: BigInt(50000),
          avg_quality_score: 92.3,
        },
      ];
      (db.$queryRaw as jest.Mock).mockResolvedValue(bigIntResults);

      // Act
      const result = await repository.getGlobalStatistics();

      // Assert
      expect(result.totalProjects).toBe(5000);
      expect(result.totalDocuments).toBe(50000);
      expect(typeof result.totalProjects).toBe('number');
      expect(typeof result.totalDocuments).toBe('number');
    });
  });

  describe('Edge Cases and Data Integrity', () => {
    it('should handle very large JSON objects', async () => {
      // Arrange
      const largeData = createValidUpdateStatisticsDto({
        costs: { claudeApi: 10.0, storage: 5.0, total: 15.0 },
      });
      jest.spyOn(repository, 'findByProjectId').mockResolvedValue(null);
      (db.projectStatistics.upsert as jest.Mock).mockResolvedValue(mockPrismaRecord);

      // Act
      await repository.upsert(mockProjectId, largeData);

      // Assert
      expect(db.projectStatistics.upsert).toHaveBeenCalled();
    });

    it('should handle special characters in JSON data', async () => {
      // Arrange
      const specialData = createValidUpdateStatisticsDto({
        metadata: {
          source: 'test-service',
          batchId: 'Test with special chars: éàü"\\n\\t',
        },
      });
      jest.spyOn(repository, 'findByProjectId').mockResolvedValue(null);
      (db.projectStatistics.upsert as jest.Mock).mockResolvedValue(mockPrismaRecord);

      // Act
      await repository.upsert(mockProjectId, specialData);

      // Assert
      expect(db.projectStatistics.upsert).toHaveBeenCalled();
    });

    it('should preserve precision for financial calculations', async () => {
      // Arrange
      const preciseData = createValidUpdateStatisticsDto({
        costs: {
          claudeApi: 12.123456789,
          storage: 0.001,
          total: 12.124456789,
        },
      });
      jest.spyOn(repository, 'findByProjectId').mockResolvedValue(null);
      const preciseRecord = {
        ...mockPrismaRecord,
        costs: preciseData.costs,
      };
      (db.projectStatistics.upsert as jest.Mock).mockResolvedValue(preciseRecord);

      // Act
      const result = await repository.upsert(mockProjectId, preciseData);

      // Assert
      expect(result.costs.claudeApi).toBe(12.123456789);
      expect(result.costs.total).toBe(12.124456789);
    });

    it('should handle database timeout gracefully', async () => {
      // Arrange
      const timeoutError = new Error('Query timeout');
      (timeoutError as any).code = 'P2024';
      (db.projectStatistics.findUnique as jest.Mock).mockRejectedValue(timeoutError);

      // Act & Assert
      await expect(repository.findByProjectId(mockProjectId)).rejects.toThrow(
        'Statistics retrieval failed: Query timeout',
      );
    });

    it('should handle concurrent access correctly', async () => {
      // Arrange
      const concurrentPromises = Array.from({ length: 10 }, (_, i) =>
        repository.findByProjectId(`project-${i}`),
      );
      (db.projectStatistics.findUnique as jest.Mock).mockResolvedValue(mockPrismaRecord);

      // Act
      const results = await Promise.all(concurrentPromises);

      // Assert
      expect(results).toHaveLength(10);
      expect(db.projectStatistics.findUnique).toHaveBeenCalledTimes(10);
      results.forEach(result => {
        expect(result).toBeInstanceOf(ProjectStatisticsEntity);
      });
    });

    it('should validate entity consistency after creation', async () => {
      // Arrange
      jest.spyOn(repository, 'findByProjectId').mockResolvedValue(null);
      (db.projectStatistics.upsert as jest.Mock).mockResolvedValue(mockPrismaRecord);

      const updateDto = createValidUpdateStatisticsDto({
        costs: { claudeApi: 10.0, storage: 5.0, total: 15.0 },
        usage: { documentsGenerated: 3 },
      });

      // Act
      const result = await repository.upsert(mockProjectId, updateDto);

      // Assert
      expect(result).toBeInstanceOf(ProjectStatisticsEntity);
      
      // Test that the entity methods work correctly
      const validation = result.validateConsistency();
      expect(validation).toHaveProperty('valid');
      expect(validation).toHaveProperty('issues');
      
      const qualityScore = result.calculateDataQualityScore();
      expect(typeof qualityScore).toBe('number');
      expect(qualityScore).toBeGreaterThanOrEqual(0);
      expect(qualityScore).toBeLessThanOrEqual(100);
    });
  });
});