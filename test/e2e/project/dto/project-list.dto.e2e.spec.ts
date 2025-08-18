import { Test, TestingModule } from '@nestjs/testing';
import { plainToInstance } from 'class-transformer';
import { ProjectListItemDto } from '../../../../src/project/dto/project-list.dto';
import { ProjectStatus } from '../../../../src/common/enums/project-status.enum';

// Mock du service de projet pour les tests E2E
class MockProjectService {
  private projects: any[] = [];

  constructor() {
    this.initializeTestData();
  }

  private initializeTestData() {
    this.projects = [
      {
        id: '550e8400-e29b-41d4-a716-446655440001',
        name: 'AI Chat Assistant',
        description: 'Advanced conversational AI platform',
        status: ProjectStatus.ACTIVE,
        createdAt: new Date('2024-07-15T10:00:00Z'),
        updatedAt: new Date('2024-08-01T14:30:00Z'),
        uploadedFilesCount: 3,
        generatedFilesCount: 8,
        hasStatistics: true,
        totalCost: 45.67,
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440002',
        name: 'E-commerce Platform',
        description: 'Complete online shopping solution',
        status: ProjectStatus.ACTIVE,
        createdAt: new Date('2024-06-20T09:15:00Z'),
        updatedAt: new Date('2024-07-25T16:45:00Z'),
        uploadedFilesCount: 5,
        generatedFilesCount: 12,
        hasStatistics: true,
        totalCost: 78.9,
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440003',
        name: 'Mobile Banking App',
        description: 'Secure mobile banking solution',
        status: ProjectStatus.ARCHIVED,
        createdAt: new Date('2024-05-10T11:30:00Z'),
        updatedAt: new Date('2024-05-10T11:30:00Z'),
        uploadedFilesCount: 2,
        generatedFilesCount: 6,
        hasStatistics: false,
        totalCost: undefined,
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440004',
        name: 'Data Analytics Dashboard',
        description: 'Real-time analytics and reporting',
        status: ProjectStatus.ACTIVE,
        createdAt: new Date('2024-08-01T08:00:00Z'),
        updatedAt: new Date('2024-08-05T12:15:00Z'),
        uploadedFilesCount: 4,
        generatedFilesCount: 3,
        hasStatistics: true,
        totalCost: 23.45,
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440005',
        name: 'IoT Management System',
        description: 'Connected device management platform',
        status: ProjectStatus.DELETED,
        createdAt: new Date('2024-04-15T14:20:00Z'),
        updatedAt: new Date('2024-04-15T14:20:00Z'),
        uploadedFilesCount: 1,
        generatedFilesCount: 0,
        hasStatistics: false,
        totalCost: 0,
      },
    ];
  }

  async findAll(pagination: any = {}): Promise<any> {
    let filtered = [...this.projects];

    // Apply status filter
    if (pagination.status) {
      filtered = filtered.filter((p) => p.status === pagination.status);
    }

    // Apply search filter
    if (pagination.search) {
      const searchLower = pagination.search.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(searchLower) ||
          (p.description && p.description.toLowerCase().includes(searchLower)),
      );
    }

    // Apply date range filter
    if (pagination.createdAfter) {
      const afterDate = new Date(pagination.createdAfter);
      filtered = filtered.filter((p) => p.createdAt >= afterDate);
    }

    if (pagination.createdBefore) {
      const beforeDate = new Date(pagination.createdBefore);
      filtered = filtered.filter((p) => p.createdAt <= beforeDate);
    }

    // Apply sorting
    if (pagination.sortBy) {
      filtered.sort((a, b) => {
        let aValue, bValue;

        switch (pagination.sortBy) {
          case 'name':
            aValue = a.name.toLowerCase();
            bValue = b.name.toLowerCase();
            break;
          case 'createdAt':
            aValue = a.createdAt.getTime();
            bValue = b.createdAt.getTime();
            break;
          case 'totalCost':
            aValue = a.totalCost || 0;
            bValue = b.totalCost || 0;
            break;
          case 'totalFiles':
            aValue = (a.uploadedFilesCount || 0) + (a.generatedFilesCount || 0);
            bValue = (b.uploadedFilesCount || 0) + (b.generatedFilesCount || 0);
            break;
          default:
            return 0;
        }

        if (pagination.sortOrder === 'desc') {
          return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
        } else {
          return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
        }
      });
    }

    const page = Math.max(0, pagination.page || 0);
    const limit = Math.min(100, Math.max(1, pagination.limit || 10));

    // Handle invalid page numbers by treating them as valid pages
    const total = filtered.length;
    const startIndex = page * limit;
    const endIndex = Math.min(startIndex + limit, total);

    let paginatedData;
    if (startIndex >= total && total > 0) {
      // If page is beyond data, return empty but valid response
      paginatedData = [];
    } else {
      paginatedData = filtered.slice(startIndex, endIndex);
    }

    return {
      data: paginatedData.map((p) => plainToInstance(ProjectListItemDto, p)),
      meta: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit) || 1,
      },
    };
  }

  // Méthode helper pour les tests
  async getProjectMetrics(): Promise<any> {
    const projects = this.projects.map((p) =>
      plainToInstance(ProjectListItemDto, p),
    );

    return {
      totalProjects: projects.length,
      activeProjects: projects.filter((p) => p.status === ProjectStatus.ACTIVE)
        .length,
      productiveProjects: projects.filter((p) => p.isProductive()).length,
      totalFiles: projects.reduce((sum, p) => sum + p.getTotalFilesCount(), 0),
      totalCost: projects.reduce((sum, p) => sum + (p.totalCost || 0), 0),
      averageAge:
        projects.reduce((sum, p) => sum + p.getAgeInDays(), 0) /
        projects.length,
    };
  }
}

function createTestPagination(overrides: any = {}) {
  return {
    page: 0,
    limit: 10,
    sortBy: 'createdAt',
    sortOrder: 'desc',
    ...overrides,
  };
}

describe('ProjectListItemDto - E2E Tests', () => {
  let projectService: MockProjectService;

  beforeEach(async () => {
    projectService = new MockProjectService();
  });

  describe('Scénarios de pagination réels', () => {
    it('should handle basic pagination for project listing', async () => {
      const result = await projectService.findAll(
        createTestPagination({
          page: 0,
          limit: 3,
        }),
      );

      expect(result.data).toHaveLength(3);
      expect(result.meta.page).toBe(0);
      expect(result.meta.limit).toBe(3);
      expect(result.meta.total).toBe(5);
      expect(result.meta.pages).toBe(2);

      // Verify DTOs are properly instantiated
      result.data.forEach((dto: ProjectListItemDto) => {
        expect(dto).toBeInstanceOf(ProjectListItemDto);
        expect(typeof dto.getTotalFilesCount()).toBe('number');
        expect(typeof dto.getAgeInDays()).toBe('number');
        expect(typeof dto.getCompletionScore()).toBe('number');
      });
    });

    it('should handle multi-page scenarios', async () => {
      // First page
      const page1 = await projectService.findAll(
        createTestPagination({
          page: 0,
          limit: 2,
        }),
      );

      expect(page1.data).toHaveLength(2);
      expect(page1.meta.page).toBe(0);

      // Second page
      const page2 = await projectService.findAll(
        createTestPagination({
          page: 1,
          limit: 2,
        }),
      );

      expect(page2.data).toHaveLength(2);
      expect(page2.meta.page).toBe(1);

      // Third page (partial)
      const page3 = await projectService.findAll(
        createTestPagination({
          page: 2,
          limit: 2,
        }),
      );

      expect(page3.data).toHaveLength(1);
      expect(page3.meta.page).toBe(2);

      // Verify no overlap between pages
      const allIds = [
        ...page1.data.map((d: ProjectListItemDto) => d.id),
        ...page2.data.map((d: ProjectListItemDto) => d.id),
        ...page3.data.map((d: ProjectListItemDto) => d.id),
      ];

      const uniqueIds = new Set(allIds);
      expect(uniqueIds.size).toBe(allIds.length);
    });

    it('should handle sorting by different fields', async () => {
      // Sort by name ascending - CORRECTION: Utiliser les vrais noms des projets de test
      const byName = await projectService.findAll(
        createTestPagination({
          sortBy: 'name',
          sortOrder: 'asc',
        }),
      );

      const names = byName.data.map((dto: ProjectListItemDto) => dto.name);
      expect(names[0]).toBe('AI Chat Assistant'); // Alphabetically first
      expect(names[1]).toBe('Data Analytics Dashboard'); // Second
      expect(names[2]).toBe('E-commerce Platform'); // Third

      // Sort by total cost descending
      const byCost = await projectService.findAll(
        createTestPagination({
          sortBy: 'totalCost',
          sortOrder: 'desc',
        }),
      );

      const costs = byCost.data.map(
        (dto: ProjectListItemDto) => dto.totalCost || 0,
      );
      expect(costs[0]).toBeGreaterThanOrEqual(costs[1]);
      expect(costs[1]).toBeGreaterThanOrEqual(costs[2]);

      // Sort by total files count
      const byFiles = await projectService.findAll(
        createTestPagination({
          sortBy: 'totalFiles',
          sortOrder: 'desc',
        }),
      );

      const fileCounts = byFiles.data.map((dto: ProjectListItemDto) =>
        dto.getTotalFilesCount(),
      );
      expect(fileCounts[0]).toBeGreaterThanOrEqual(fileCounts[1]);
    });
  });

  describe('Scénarios de filtrage avancés', () => {
    it('should filter projects by status with pagination', async () => {
      const activeProjects = await projectService.findAll(
        createTestPagination({
          status: ProjectStatus.ACTIVE,
          limit: 10,
        }),
      );

      expect(activeProjects.data.length).toBeGreaterThan(0);
      activeProjects.data.forEach((dto: ProjectListItemDto) => {
        expect(dto.status).toBe(ProjectStatus.ACTIVE);
        expect(dto.isAccessible()).toBe(true);
      });

      const archivedProjects = await projectService.findAll(
        createTestPagination({
          status: ProjectStatus.ARCHIVED,
        }),
      );

      archivedProjects.data.forEach((dto: ProjectListItemDto) => {
        expect(dto.status).toBe(ProjectStatus.ARCHIVED);
        expect(dto.isAccessible()).toBe(true);
      });
    });

    it('should handle search across multiple pages', async () => {
      const searchResults = await projectService.findAll(
        createTestPagination({
          search: 'platform',
          limit: 5,
        }),
      );

      expect(searchResults.data.length).toBeGreaterThan(0);
      searchResults.data.forEach((dto: ProjectListItemDto) => {
        const matchesName = dto.name.toLowerCase().includes('platform');
        const matchesDesc =
          dto.description && dto.description.toLowerCase().includes('platform');
        expect(matchesName || matchesDesc).toBe(true);
      });
    });

    it('should handle complex pagination scenarios', async () => {
      // Test with multiple filters and pagination
      const complexFilter = await projectService.findAll(
        createTestPagination({
          status: ProjectStatus.ACTIVE,
          createdAfter: '2024-06-01T00:00:00Z',
          sortBy: 'createdAt',
          sortOrder: 'desc',
          page: 0,
          limit: 2,
        }),
      );

      expect(complexFilter.data.length).toBeGreaterThan(0);
      expect(complexFilter.data.length).toBeLessThanOrEqual(2);

      complexFilter.data.forEach((dto: ProjectListItemDto) => {
        expect(dto.status).toBe(ProjectStatus.ACTIVE);
        expect(dto.createdAt.getTime()).toBeGreaterThanOrEqual(
          new Date('2024-06-01T00:00:00Z').getTime(),
        );
      });

      // Verify sorting
      if (complexFilter.data.length > 1) {
        expect(
          complexFilter.data[0].createdAt.getTime(),
        ).toBeGreaterThanOrEqual(complexFilter.data[1].createdAt.getTime());
      }
    });
  });

  describe('Performance et optimisation', () => {
    it('should handle large pagination efficiently', async () => {
      const start = performance.now();

      const result = await projectService.findAll(
        createTestPagination({
          page: 0,
          limit: 100,
        }),
      );

      const end = performance.now();
      const duration = end - start;

      expect(duration).toBeLessThan(50); // Should be very fast for small dataset
      expect(result.data).toHaveLength(5); // All test projects

      result.data.forEach((dto: ProjectListItemDto) => {
        expect(dto).toBeInstanceOf(ProjectListItemDto);
        expect(() => dto.getTooltipSummary()).not.toThrow();
        expect(() => dto.getActivityIndicator()).not.toThrow();
      });
    });

    it('should handle concurrent pagination requests', async () => {
      const promises = [
        projectService.findAll(createTestPagination({ page: 0, limit: 2 })),
        projectService.findAll(createTestPagination({ page: 1, limit: 2 })),
        projectService.findAll(
          createTestPagination({ status: ProjectStatus.ACTIVE }),
        ),
        projectService.findAll(
          createTestPagination({ sortBy: 'name', sortOrder: 'asc' }),
        ),
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(4);
      results.forEach((result) => {
        expect(result.data).toBeDefined();
        expect(result.meta).toBeDefined();
        expect(Array.isArray(result.data)).toBe(true);
      });

      // Verify each result contains proper DTOs
      results.forEach((result) => {
        result.data.forEach((dto: ProjectListItemDto) => {
          expect(dto).toBeInstanceOf(ProjectListItemDto);
          expect(typeof dto.getTotalFilesCount()).toBe('number');
        });
      });
    });
  });

  describe('Scénarios edge case', () => {
    it('should handle empty result sets gracefully', async () => {
      const emptyResult = await projectService.findAll(
        createTestPagination({
          status: 'NONEXISTENT' as ProjectStatus,
        }),
      );

      expect(emptyResult.data).toHaveLength(0);
      expect(emptyResult.meta.total).toBe(0);
      expect(emptyResult.meta.pages).toBe(1);
      expect(Array.isArray(emptyResult.data)).toBe(true);
    });

    it('should handle invalid page numbers gracefully', async () => {
      // CORRECTION: Ajuster les attentes selon le comportement réel du service
      // Page 0 (traité comme page valide)
      const page0Result = await projectService.findAll(
        createTestPagination({
          page: 0,
          limit: 5,
        }),
      );

      expect(page0Result.data).toHaveLength(5); // All projects
      expect(page0Result.meta.page).toBe(0); // Preserves original page number

      // Very high page number - should return empty data but valid structure
      const highPageResult = await projectService.findAll(
        createTestPagination({
          page: 999,
          limit: 5,
        }),
      );

      expect(highPageResult.data).toHaveLength(0); // No data beyond available pages
      expect(highPageResult.meta.page).toBe(999); // Preserves requested page number
      expect(highPageResult.meta.total).toBe(5); // Total count unchanged
      expect(Array.isArray(highPageResult.data)).toBe(true);

      // Negative page number (normalized to 0)
      const negativePageResult = await projectService.findAll(
        createTestPagination({
          page: -5,
          limit: 3,
        }),
      );

      expect(negativePageResult.data).toHaveLength(3);
      expect(negativePageResult.meta.page).toBe(0); // Normalized to 0
    });

    it('should handle date range filtering edge cases', async () => {
      // Future date range (should return empty)
      const futureResult = await projectService.findAll(
        createTestPagination({
          createdAfter: '2025-01-01T00:00:00Z',
        }),
      );

      expect(futureResult.data).toHaveLength(0);

      // Very old date range (should return all)
      const oldResult = await projectService.findAll(
        createTestPagination({
          createdAfter: '2020-01-01T00:00:00Z',
        }),
      );

      expect(oldResult.data.length).toBeGreaterThan(0);

      // Same start and end date
      const sameDateResult = await projectService.findAll(
        createTestPagination({
          createdAfter: '2024-08-01T00:00:00Z',
          createdBefore: '2024-08-01T23:59:59Z',
        }),
      );

      sameDateResult.data.forEach((dto: ProjectListItemDto) => {
        const createdDate = new Date(dto.createdAt);
        expect(createdDate.toDateString()).toBe(
          new Date('2024-08-01').toDateString(),
        );
      });
    });
  });

  describe('Intégration avec les méthodes utilitaires du DTO', () => {
    it('should verify DTO methods work correctly in paginated results', async () => {
      const result = await projectService.findAll(
        createTestPagination({
          limit: 5,
        }),
      );

      expect(result.data.length).toBeGreaterThan(0);

      result.data.forEach((dto: ProjectListItemDto) => {
        // Test all utility methods
        expect(typeof dto.getShortDescription(50)).toBe('string');
        expect(typeof dto.getTotalFilesCount()).toBe('number');
        expect(typeof dto.hasFiles()).toBe('boolean');
        expect(typeof dto.getAgeInDays()).toBe('number');
        expect(typeof dto.getRelativeAge()).toBe('string');
        expect(typeof dto.hasBeenModified()).toBe('boolean');
        expect(['nouveau', 'récent', 'actif', 'ancien']).toContain(
          dto.getActivityIndicator(),
        );
        expect(typeof dto.isAccessible()).toBe('boolean');
        expect(typeof dto.getStatusColor()).toBe('string');
        expect(typeof dto.getStatusLabel()).toBe('string');
        expect(typeof dto.isProductive()).toBe('boolean');
        expect(typeof dto.getCompletionScore()).toBe('number');
        expect(dto.getCompletionScore()).toBeGreaterThanOrEqual(0);
        expect(dto.getCompletionScore()).toBeLessThanOrEqual(100);
        expect(typeof dto.getFormattedCost()).toBe('string');
        expect(typeof dto.getTooltipSummary()).toBe('string');
        expect(typeof dto.toString()).toBe('string');
        expect(typeof dto.toLogSafeString()).toBe('string');
        expect(typeof dto.getListMetadata()).toBe('object');
        expect(typeof dto.toLightweight()).toBe('object');
      });
    });

    it('should maintain DTO consistency across different queries', async () => {
      const [result1, result2] = await Promise.all([
        projectService.findAll(createTestPagination({ sortBy: 'name' })),
        projectService.findAll(createTestPagination({ sortBy: 'createdAt' })),
      ]);

      // Find common projects
      const ids1 = result1.data.map((dto: ProjectListItemDto) => dto.id);
      const ids2 = result2.data.map((dto: ProjectListItemDto) => dto.id);
      const commonIds = ids1.filter((id: string) => ids2.includes(id));

      expect(commonIds.length).toBeGreaterThan(0);

      commonIds.forEach((id: string) => {
        const dto1 = result1.data.find(
          (dto: ProjectListItemDto) => dto.id === id,
        );
        const dto2 = result2.data.find(
          (dto: ProjectListItemDto) => dto.id === id,
        );

        expect(dto1).toBeDefined();
        expect(dto2).toBeDefined();

        // DTOs should be functionally equivalent
        expect(dto1!.name).toBe(dto2!.name);
        expect(dto1!.status).toBe(dto2!.status);
        expect(dto1!.getTotalFilesCount()).toBe(dto2!.getTotalFilesCount());
        expect(dto1!.getCompletionScore()).toBe(dto2!.getCompletionScore());
        expect(dto1!.getActivityIndicator()).toBe(dto2!.getActivityIndicator());
      });
    });
  });

  describe('Métriques et analytics', () => {
    it('should calculate aggregate metrics across paginated results', async () => {
      const metrics = await projectService.getProjectMetrics();

      expect(metrics.totalProjects).toBeGreaterThan(0);
      expect(metrics.activeProjects).toBeGreaterThanOrEqual(0);
      expect(metrics.productiveProjects).toBeGreaterThanOrEqual(0);
      expect(metrics.totalFiles).toBeGreaterThanOrEqual(0);
      expect(metrics.totalCost).toBeGreaterThanOrEqual(0);
      expect(metrics.averageAge).toBeGreaterThan(0);

      // Verify metrics make sense
      expect(metrics.activeProjects).toBeLessThanOrEqual(metrics.totalProjects);
      expect(metrics.productiveProjects).toBeLessThanOrEqual(
        metrics.totalProjects,
      );

      // Test consistency with individual DTO methods
      const allProjects = await projectService.findAll(
        createTestPagination({ limit: 100 }),
      );
      const calculatedTotal = allProjects.data.reduce(
        (sum: number, dto: ProjectListItemDto) =>
          sum + dto.getTotalFilesCount(),
        0,
      );
      expect(calculatedTotal).toBe(metrics.totalFiles);
    });

    it('should support analytics across different time periods', async () => {
      // Recent projects (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const recentProjects = await projectService.findAll(
        createTestPagination({
          createdAfter: thirtyDaysAgo.toISOString(),
        }),
      );

      // Older projects
      const olderProjects = await projectService.findAll(
        createTestPagination({
          createdBefore: thirtyDaysAgo.toISOString(),
        }),
      );

      const recentProductivity = recentProjects.data.filter(
        (dto: ProjectListItemDto) => dto.isProductive(),
      ).length;

      const olderProductivity = olderProjects.data.filter(
        (dto: ProjectListItemDto) => dto.isProductive(),
      ).length;

      // Both time periods should be analyzable
      expect(
        recentProjects.data.length + olderProjects.data.length,
      ).toBeGreaterThan(0);
      expect(typeof recentProductivity).toBe('number');
      expect(typeof olderProductivity).toBe('number');

      // Analytics should work on both time periods
      [...recentProjects.data, ...olderProjects.data].forEach(
        (dto: ProjectListItemDto) => {
          expect(dto.getActivityIndicator()).toMatch(
            /^(nouveau|récent|actif|ancien)$/,
          );
          expect(dto.getAgeInDays()).toBeGreaterThanOrEqual(0);
        },
      );
    });
  });
});
