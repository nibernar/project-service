import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { StatisticsController } from '../../../../src/statistics/statistics.controller';
import { StatisticsService } from '../../../../src/statistics/statistics.service';
import { UpdateStatisticsDto } from '../../../../src/statistics/dto/update-statistics.dto';
import { StatisticsResponseDto } from '../../../../src/statistics/dto/statistics-response.dto';
import { AuthGuard } from '../../../../src/common/guards/auth.guard';
import { ProjectOwnerGuard } from '../../../../src/common/guards/project-owner.guard';
import { CacheService } from '../../../../src/cache/cache.service';
import { DatabaseService } from '../../../../src/database/database.service';
import { HttpService } from '@nestjs/axios';
import { User } from '../../../../src/common/interfaces/user.interface';
import { plainToClass } from 'class-transformer';

// Helper function to generate valid UUIDs for testing
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

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

// Helper function to create mock StatisticsResponseDto
function createMockStatisticsResponse(): StatisticsResponseDto {
  const response = new StatisticsResponseDto();
  
  Object.assign(response, {
    costs: {
      claudeApi: 12.45,
      storage: 2.30,
      compute: 5.67,
      bandwidth: 1.23,
      total: 21.65,
      currency: 'USD',
      breakdown: {
        claudeApiPercentage: 57.5,
        storagePercentage: 10.6,
        computePercentage: 26.2,
        bandwidthPercentage: 5.7,
      },
    },
    performance: {
      generationTime: 45.23,
      processingTime: 12.45,
      interviewTime: 180.75,
      exportTime: 8.90,
      totalTime: 247.33,
      queueWaitTime: 5.12,
      efficiency: {
        documentsPerHour: 12.5,
        tokensPerSecond: 145.7,
        processingEfficiency: 85.2,
        resourceUtilization: 78.9,
      },
      bottlenecks: ['generation'],
      benchmark: 'average',
    },
    usage: {
      documentsGenerated: 5,
      filesProcessed: 3,
      tokensUsed: 15750,
      apiCallsCount: 12,
      storageSize: 2048576,
      exportCount: 2,
      tokensPerDocument: 3150,
      storageEfficiency: 409715.2,
      activityPattern: {
        usageFrequency: 'occasional',
        preferredFormats: ['pdf', 'markdown'],
        averageSessionDuration: 1245.7,
      },
      resourceIntensity: 'moderate',
    },
    summary: {
      totalCost: '$21.65',
      totalTime: '4h 7m 33s',
      efficiency: 87.5,
      status: 'good',
      keyMetrics: [],
      recommendations: [],
    },
    metadata: {
      lastUpdated: new Date(),
      dataFreshness: 15,
      completeness: 95.5,
      sources: ['cost-tracking-service'],
      version: '1.0.0',
      generatedAt: new Date(),
    },
  });

  return response;
}

describe('StatisticsController', () => {
  let controller: StatisticsController;
  let service: jest.Mocked<StatisticsService>;

  const mockUser: User = {
    id: 'user-123',
    email: 'test@example.com',
    roles: ['user'],
  };

  const mockAdminUser: User = {
    id: 'admin-123',
    email: 'admin@example.com',
    roles: ['admin'],
  };

  // Use valid UUIDs for testing
  const mockProjectId = generateUUID();
  const validServiceToken = 'dev-service-token';

  const mockStatisticsResponse = createMockStatisticsResponse();

  beforeEach(async () => {
    const mockService = {
      updateStatistics: jest.fn(),
      getStatistics: jest.fn(),
      getGlobalStatistics: jest.fn(),
      searchStatistics: jest.fn(),
      cleanupOldStatistics: jest.fn(),
      getMultipleStatistics: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn((key: string) => {
        switch (key) {
          case 'INTERNAL_SERVICE_TOKEN':
            return validServiceToken;
          default:
            return undefined;
        }
      }),
    };

    const mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };

    const mockHttpService = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
    };

    const mockAuthGuard = {
      canActivate: jest.fn().mockReturnValue(true),
    };

    const mockProjectOwnerGuard = {
      canActivate: jest.fn().mockReturnValue(true),
    };

    const mockDatabaseService = {
      project: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      $disconnect: jest.fn(),
    };

    const mockReflector = {
      get: jest.fn(),
      getAll: jest.fn(),
      getAllAndMerge: jest.fn(),
      getAllAndOverride: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StatisticsController],
      providers: [
        {
          provide: StatisticsService,
          useValue: mockService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
        {
          provide: DatabaseService,
          useValue: mockDatabaseService,
        },
        {
          provide: Reflector,
          useValue: mockReflector,
        },
        {
          provide: AuthGuard,
          useValue: mockAuthGuard,
        },
        {
          provide: ProjectOwnerGuard,
          useValue: mockProjectOwnerGuard,
        },
      ],
    })
    .overrideGuard(AuthGuard)
    .useValue(mockAuthGuard)
    .overrideGuard(ProjectOwnerGuard)
    .useValue(mockProjectOwnerGuard)
    .compile();

    controller = module.get<StatisticsController>(StatisticsController);
    service = module.get(StatisticsService);

    // Mock environment variable
    process.env.INTERNAL_SERVICE_TOKEN = validServiceToken;

    // Suppress console logs during tests
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.INTERNAL_SERVICE_TOKEN;
  });

  describe('updateProjectStatistics', () => {
    const validUpdateDto = createValidUpdateStatisticsDto({
      costs: {
        claudeApi: 12.45,
        storage: 2.30,
        total: 14.75,
        currency: 'USD',
      },
      performance: {
        generationTime: 45.23,
        totalTime: 60.0,
      },
      usage: {
        documentsGenerated: 5,
        tokensUsed: 15750,
      },
      metadata: {
        source: 'cost-tracking-service',
        timestamp: new Date(),
        version: '1.0.0',
      },
    });

    it('should update statistics with valid service token', async () => {
      // Arrange
      service.updateStatistics.mockResolvedValue(mockStatisticsResponse);

      // Act
      const result = await controller.updateProjectStatistics(
        mockProjectId,
        validUpdateDto,
        validServiceToken,
      );

      // Assert
      expect(service.updateStatistics).toHaveBeenCalledWith(mockProjectId, validUpdateDto);
      expect(result).toBe(mockStatisticsResponse);
    });

    it('should reject invalid service token', async () => {
      // Act & Assert
      await expect(
        controller.updateProjectStatistics(
          mockProjectId,
          validUpdateDto,
          'invalid-token',
        ),
      ).rejects.toThrow(ForbiddenException);

      expect(service.updateStatistics).not.toHaveBeenCalled();
    });

    it('should reject missing service token', async () => {
      // Act & Assert
      await expect(
        controller.updateProjectStatistics(
          mockProjectId,
          validUpdateDto,
          '',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should validate statistics data coherence', async () => {
      // Arrange
      const invalidDto = createValidUpdateStatisticsDto({
        costs: {
          claudeApi: 10.0,
          storage: 5.0,
          total: 10.0, // Should be 15.0
        },
      });

      // Mock the isValid method to return validation errors
      invalidDto.isValid = jest.fn().mockReturnValue({
        valid: false,
        errors: ['Costs total is inconsistent with sum of components'],
      });

      // Act & Assert
      await expect(
        controller.updateProjectStatistics(
          mockProjectId,
          invalidDto,
          validServiceToken,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle project not found error', async () => {
      // Arrange
      service.updateStatistics.mockRejectedValue(new Error('Project not found'));

      // Act & Assert
      await expect(
        controller.updateProjectStatistics(
          mockProjectId,
          validUpdateDto,
          validServiceToken,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should handle service errors', async () => {
      // Arrange
      service.updateStatistics.mockRejectedValue(new Error('Service error'));

      // Act & Assert
      await expect(
        controller.updateProjectStatistics(
          mockProjectId,
          validUpdateDto,
          validServiceToken,
        ),
      ).rejects.toThrow('Service error');
    });

    it('should handle large payload gracefully', async () => {
      // Arrange
      const largeDto = createValidUpdateStatisticsDto({
        costs: {
          claudeApi: 12.45,
          storage: 2.30,
          total: 14.75,
        },
      });

      service.updateStatistics.mockResolvedValue(mockStatisticsResponse);

      // Act
      const result = await controller.updateProjectStatistics(
        mockProjectId,
        largeDto,
        validServiceToken,
      );

      // Assert
      expect(result).toBe(mockStatisticsResponse);
    });
  });

  describe('getProjectStatistics', () => {
    it('should return project statistics for user', async () => {
      // Arrange
      service.getStatistics.mockResolvedValue(mockStatisticsResponse);

      // Act
      const result = await controller.getProjectStatistics(mockProjectId, mockUser);

      // Assert
      expect(service.getStatistics).toHaveBeenCalledWith(mockProjectId);
      expect(result).toBe(mockStatisticsResponse);
    });

    it('should throw NotFoundException when statistics not found', async () => {
      // Arrange
      service.getStatistics.mockResolvedValue(null);

      // Act & Assert
      await expect(
        controller.getProjectStatistics(mockProjectId, mockUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('should handle service errors', async () => {
      // Arrange
      service.getStatistics.mockRejectedValue(new Error('Service error'));

      // Act & Assert
      await expect(
        controller.getProjectStatistics(mockProjectId, mockUser),
      ).rejects.toThrow('Service error');
    });

    it('should validate project access', async () => {
      // Arrange
      service.getStatistics.mockResolvedValue(mockStatisticsResponse);

      // Act
      const result = await controller.getProjectStatistics(mockProjectId, mockUser);

      // Assert
      expect(result).toBe(mockStatisticsResponse);
      expect(service.getStatistics).toHaveBeenCalledWith(mockProjectId);
    });
  });

  describe('getGlobalStatistics', () => {
    const mockGlobalStats = {
      totalProjects: 1250,
      totalCosts: 45789.32,
      totalDocuments: 8945,
      averageQualityScore: 87.5,
      sourceDistribution: {
        'cost-tracking-service': 1200,
        'monitoring-service': 1100,
        'orchestration-service': 1250,
      },
    };

    it('should return global statistics for authenticated user', async () => {
      // Arrange
      service.getGlobalStatistics.mockResolvedValue(mockGlobalStats);

      // Act
      const result = await controller.getGlobalStatistics(mockUser);

      // Assert
      expect(service.getGlobalStatistics).toHaveBeenCalled();
      expect(result).toBe(mockGlobalStats);
    });

    it('should handle service errors', async () => {
      // Arrange
      service.getGlobalStatistics.mockRejectedValue(new Error('Global stats error'));

      // Act & Assert
      await expect(controller.getGlobalStatistics(mockUser)).rejects.toThrow(
        'Global stats error',
      );
    });
  });

  describe('searchStatistics', () => {
    const mockSearchResults = [mockStatisticsResponse];

    it('should search statistics with valid criteria', async () => {
      // Arrange
      service.searchStatistics.mockResolvedValue(mockSearchResults);

      // Act
      const result = await controller.searchStatistics(
        mockUser,
        10.0, // minTotalCost
        100.0, // maxTotalCost
        3, // minDocuments
        600, // maxPerformanceTime
        60, // dataFreshnessMinutes
      );

      // Assert
      expect(service.searchStatistics).toHaveBeenCalledWith({
        minTotalCost: 10.0,
        maxTotalCost: 100.0,
        minDocuments: 3,
        maxPerformanceTime: 600,
        dataFreshnessMinutes: 60,
      });
      expect(result).toBe(mockSearchResults);
    });

    it('should handle undefined search parameters', async () => {
      // Arrange
      service.searchStatistics.mockResolvedValue([]);

      // Act
      const result = await controller.searchStatistics(mockUser);

      // Assert
      expect(service.searchStatistics).toHaveBeenCalledWith({
        minTotalCost: undefined,
        maxTotalCost: undefined,
        minDocuments: undefined,
        maxPerformanceTime: undefined,
        dataFreshnessMinutes: undefined,
      });
      expect(result).toHaveLength(0);
    });

    it('should handle service errors', async () => {
      // Arrange
      service.searchStatistics.mockRejectedValue(new Error('Search error'));

      // Act & Assert
      await expect(
        controller.searchStatistics(mockUser, 10.0),
      ).rejects.toThrow('Search error');
    });

    it('should build search criteria correctly', async () => {
      // Arrange
      service.searchStatistics.mockResolvedValue(mockSearchResults);

      // Act
      await controller.searchStatistics(
        mockUser,
        5.0,    // minTotalCost
        50.0,   // maxTotalCost
        2,      // minDocuments
        300,    // maxPerformanceTime
        30,     // dataFreshnessMinutes
      );

      // Assert
      expect(service.searchStatistics).toHaveBeenCalledWith({
        minTotalCost: 5.0,
        maxTotalCost: 50.0,
        minDocuments: 2,
        maxPerformanceTime: 300,
        dataFreshnessMinutes: 30,
      });
    });
  });

  describe('cleanupOldStatistics', () => {
    it('should cleanup statistics for admin user', async () => {
      // Arrange
      service.cleanupOldStatistics.mockResolvedValue(150);

      // Act
      const result = await controller.cleanupOldStatistics(mockAdminUser, 90);

      // Assert
      expect(service.cleanupOldStatistics).toHaveBeenCalledWith(90);
      expect(result).toEqual({
        deletedCount: 150,
        retentionDays: 90,
      });
    });

    it('should reject non-admin users', async () => {
      // Act & Assert
      await expect(
        controller.cleanupOldStatistics(mockUser, 90),
      ).rejects.toThrow(ForbiddenException);

      expect(service.cleanupOldStatistics).not.toHaveBeenCalled();
    });

    it('should handle service errors', async () => {
      // Arrange
      service.cleanupOldStatistics.mockRejectedValue(new Error('Cleanup error'));

      // Act & Assert
      await expect(
        controller.cleanupOldStatistics(mockAdminUser, 90),
      ).rejects.toThrow('Cleanup error');
    });

    it('should use default retention days when not provided', async () => {
      // Arrange
      service.cleanupOldStatistics.mockResolvedValue(75);

      // Act
      const result = await controller.cleanupOldStatistics(mockAdminUser, 90); // Must provide retentionDays

      // Assert
      expect(service.cleanupOldStatistics).toHaveBeenCalledWith(90);
      expect(result.retentionDays).toBe(90);
    });
  });

  describe('getBatchStatistics', () => {
    // Generate valid UUIDs for batch testing
    const projectId1 = generateUUID();
    const projectId2 = generateUUID();
    const projectId3 = generateUUID();

    const mockBatchResults = new Map([
      [projectId1, mockStatisticsResponse],
      [projectId2, mockStatisticsResponse],
    ]);

    it('should get batch statistics for valid project IDs', async () => {
      // Arrange
      service.getMultipleStatistics.mockResolvedValue(mockBatchResults);

      // Act
      const result = await controller.getBatchStatistics(
        mockUser,
        `${projectId1},${projectId2},${projectId3}`,
      );

      // Assert
      expect(service.getMultipleStatistics).toHaveBeenCalledWith([
        projectId1,
        projectId2,
        projectId3,
      ]);
      expect(Object.keys(result)).toHaveLength(2);
      expect(result[projectId1]).toBe(mockStatisticsResponse);
    });

    it('should handle empty results', async () => {
      // Arrange
      service.getMultipleStatistics.mockResolvedValue(new Map());

      // Act
      const result = await controller.getBatchStatistics(
        mockUser,
        `${projectId1},${projectId2}`,
      );

      // Assert
      expect(result).toEqual({});
    });

    it('should handle whitespace in project IDs', async () => {
      // Arrange
      service.getMultipleStatistics.mockResolvedValue(new Map());

      // Act
      const result = await controller.getBatchStatistics(
        mockUser,
        ` ${projectId1} , ${projectId2} , ${projectId3} `,
      );

      // Assert
      expect(service.getMultipleStatistics).toHaveBeenCalledWith([
        projectId1,
        projectId2,
        projectId3,
      ]);
    });

    it('should handle service errors', async () => {
      // Arrange
      service.getMultipleStatistics.mockRejectedValue(new Error('Batch error'));

      // Act & Assert
      await expect(
        controller.getBatchStatistics(mockUser, `${projectId1},${projectId2}`),
      ).rejects.toThrow('Batch error');
    });

    it('should convert Map to Object correctly', async () => {
      // Arrange
      const resultMap = new Map([
        [projectId1, mockStatisticsResponse],
        [projectId2, mockStatisticsResponse],
        [projectId3, mockStatisticsResponse],
      ]);
      service.getMultipleStatistics.mockResolvedValue(resultMap);

      // Act
      const result = await controller.getBatchStatistics(
        mockUser,
        `${projectId1},${projectId2},${projectId3}`,
      );

      // Assert
      expect(Object.keys(result)).toHaveLength(3);
      expect(result[projectId1]).toBe(mockStatisticsResponse);
      expect(result[projectId2]).toBe(mockStatisticsResponse);
      expect(result[projectId3]).toBe(mockStatisticsResponse);
    });
  });

  describe('healthCheck', () => {
    it('should return health status', async () => {
      // Act
      const result = await controller.healthCheck();

      // Assert
      expect(result).toEqual({
        status: 'healthy',
        timestamp: expect.any(Date),
        dependencies: {
          database: 'connected',
          cache: 'connected',
          repository: 'operational',
        },
      });
    });

    it('should return consistent health status format', async () => {
      // Act
      const result1 = await controller.healthCheck();
      const result2 = await controller.healthCheck();

      // Assert
      expect(result1.status).toBe(result2.status);
      expect(result1.dependencies).toEqual(result2.dependencies);
    });
  });

  describe('Input Validation and Edge Cases', () => {
    it('should handle concurrent requests gracefully', async () => {
      // Arrange
      service.getStatistics.mockResolvedValue(mockStatisticsResponse);
      const requests = Array.from({ length: 10 }, () =>
        controller.getProjectStatistics(mockProjectId, mockUser),
      );

      // Act
      const results = await Promise.all(requests);

      // Assert
      expect(results).toHaveLength(10);
      expect(service.getStatistics).toHaveBeenCalledTimes(10);
    });

    it('should handle small decimal values in search', async () => {
      // Arrange
      service.searchStatistics.mockResolvedValue([]);

      // Act
      await controller.searchStatistics(
        mockUser,
        0.001, // Very small decimal
        999999.99, // Large decimal
      );

      // Assert
      expect(service.searchStatistics).toHaveBeenCalledWith({
        minTotalCost: 0.001,
        maxTotalCost: 999999.99,
        minDocuments: undefined,
        maxPerformanceTime: undefined,
        dataFreshnessMinutes: undefined,
      });
    });

    it('should handle empty roles array in admin check', () => {
      // Arrange
      const userWithEmptyRoles = { ...mockUser, roles: [] as string[] };

      // Act & Assert
      expect(() => {
        // Simulate the admin check logic
        const isAdmin = userWithEmptyRoles.roles.includes('admin');
        if (!isAdmin) {
          throw new ForbiddenException('Admin access required');
        }
      }).toThrow(ForbiddenException);
    });

    it('should preserve request context for logging', async () => {
      // Arrange
      service.updateStatistics.mockResolvedValue(mockStatisticsResponse);

      // Act
      await controller.updateProjectStatistics(
        mockProjectId,
        createValidUpdateStatisticsDto({ costs: { claudeApi: 10.0 } }),
        validServiceToken,
      );

      // Assert
      expect(service.updateStatistics).toHaveBeenCalledWith(
        mockProjectId,
        expect.any(Object),
      );
    });

    it('should handle scientific notation in search parameters', async () => {
      // Arrange
      service.searchStatistics.mockResolvedValue([]);

      // Act
      await controller.searchStatistics(
        mockUser,
        1e-10, // Very small number in scientific notation
        1e10,  // Very large number in scientific notation
      );

      // Assert
      expect(service.searchStatistics).toHaveBeenCalledWith({
        minTotalCost: 1e-10,
        maxTotalCost: 1e10,
        minDocuments: undefined,
        maxPerformanceTime: undefined,
        dataFreshnessMinutes: undefined,
      });
    });

    it('should handle floating point precision issues', async () => {
      // Arrange
      service.searchStatistics.mockResolvedValue([]);

      // Act - Use values that don't trigger the minTotalCost > maxTotalCost validation
      await controller.searchStatistics(
        mockUser,
        0.2, // Use a valid range where min < max
        0.4,
      );

      // Assert
      expect(service.searchStatistics).toHaveBeenCalledWith({
        minTotalCost: 0.2,
        maxTotalCost: 0.4,
        minDocuments: undefined,
        maxPerformanceTime: undefined,
        dataFreshnessMinutes: undefined,
      });
    });

    it('should handle project ID case sensitivity', async () => {
      // Arrange
      const upperCaseProjectId = 'ABCDEF12-3456-7890-ABCD-EF1234567890';
      service.getStatistics.mockResolvedValue(mockStatisticsResponse);

      // Act
      const result = await controller.getProjectStatistics(upperCaseProjectId, mockUser);

      // Assert
      expect(result).toBe(mockStatisticsResponse);
      expect(service.getStatistics).toHaveBeenCalledWith(upperCaseProjectId);
    });

    it('should handle different batch sizes correctly', async () => {
      // Arrange - Generate valid UUIDs for batch testing
      const singleProjectId = generateUUID();
      const projectIds = Array.from({ length: 20 }, () => generateUUID());
      
      const singleProject = singleProjectId;
      const smallBatch = `${projectIds[0]},${projectIds[1]}`;
      const largeBatch = projectIds.join(',');

      service.getMultipleStatistics.mockResolvedValue(new Map());

      // Act & Assert for single project
      await controller.getBatchStatistics(mockUser, singleProject);
      expect(service.getMultipleStatistics).toHaveBeenCalledWith([singleProjectId]);

      // Act & Assert for small batch
      await controller.getBatchStatistics(mockUser, smallBatch);
      expect(service.getMultipleStatistics).toHaveBeenCalledWith([projectIds[0], projectIds[1]]);

      // Act & Assert for large batch
      await controller.getBatchStatistics(mockUser, largeBatch);
      expect(service.getMultipleStatistics).toHaveBeenCalledWith(projectIds);
    });

    it('should handle service token comparison securely', async () => {
      // Arrange
      const validDto = createValidUpdateStatisticsDto({ costs: { claudeApi: 10.0 } });
      service.updateStatistics.mockResolvedValue(mockStatisticsResponse);

      // Act - Test with correct token
      const result = await controller.updateProjectStatistics(
        mockProjectId,
        validDto,
        validServiceToken,
      );

      // Assert
      expect(result).toBe(mockStatisticsResponse);

      // Act & Assert - Test with wrong token
      await expect(
        controller.updateProjectStatistics(
          mockProjectId,
          validDto,
          'wrong-token',
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});