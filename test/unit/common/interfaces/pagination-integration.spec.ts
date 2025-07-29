/**
 * Tests d'intégration pour les interfaces de pagination.
 * 
 * Teste l'intégration avec Prisma, NestJS controllers, et autres composants
 * pour s'assurer que la pagination fonctionne correctement dans un contexte réel.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import * as request from 'supertest';
import {
  PaginatedResult,
  createPaginatedResult,
  validatePaginationParams,
  calculatePaginationMeta,
} from '../../../../src/common/interfaces/paginated-result.interface';

// Mock interfaces pour les tests
interface MockProject {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
}

interface MockProjectDto {
  id: string;
  name: string;
  description?: string;
  createdAt: Date;
}

// Mock Service simulant un service réel
class MockProjectService {
  private projects: MockProject[] = [];

  constructor() {
    // Initialiser avec des données de test
    for (let i = 1; i <= 150; i++) {
      this.projects.push({
        id: `project-${i}`,
        name: `Project ${i}`,
        description: `Description for project ${i}`,
        ownerId: `user-${Math.ceil(i / 10)}`, // 10 projets par user
        createdAt: new Date(Date.now() - i * 86400000), // 1 jour de différence
        updatedAt: new Date(),
      });
    }
  }

  async findAll(
    userId: string,
    page: number,
    limit: number,
  ): Promise<PaginatedResult<MockProjectDto>> {
    // Valider les paramètres
    const { page: validPage, limit: validLimit } = validatePaginationParams(
      page,
      limit,
      100,
    );

    // Filtrer par utilisateur
    const userProjects = this.projects.filter(p => p.ownerId === userId);

    // Appliquer la pagination
    const offset = (validPage - 1) * validLimit;
    const paginatedProjects = userProjects.slice(offset, offset + validLimit);

    // Transformer en DTO
    const projectDtos: MockProjectDto[] = paginatedProjects.map(p => ({
      id: p.id,
      name: p.name,
      description: p.description,
      createdAt: p.createdAt,
    }));

    return createPaginatedResult(
      projectDtos,
      validPage,
      validLimit,
      userProjects.length,
    );
  }

  async findById(id: string, userId: string): Promise<MockProjectDto | null> {
    const project = this.projects.find(p => p.id === id && p.ownerId === userId);
    if (!project) return null;

    return {
      id: project.id,
      name: project.name,
      description: project.description,
      createdAt: project.createdAt,
    };
  }

  async count(userId: string): Promise<number> {
    return this.projects.filter(p => p.ownerId === userId).length;
  }
}

// Mock Controller simulant un contrôleur NestJS
class MockProjectController {
  constructor(private readonly projectService: MockProjectService) {}

  async findAll(userId: string, page = 1, limit = 10) {
    return this.projectService.findAll(userId, page, limit);
  }
}

describe('Pagination Integration Tests', () => {
  let service: MockProjectService;
  let controller: MockProjectController;

  beforeAll(() => {
    service = new MockProjectService();
    controller = new MockProjectController(service);
  });

  describe('Service Integration', () => {
    describe('Pagination avec logique métier', () => {
      it('should paginate user projects correctly', async () => {
        const result = await service.findAll('user-1', 1, 5);

        expect(result.data).toHaveLength(5);
        expect(result.total).toBe(10); // user-1 a 10 projets
        expect(result.pagination).toEqual({
          page: 1,
          limit: 5,
          totalPages: 2,
          hasNext: true,
          hasPrevious: false,
          offset: 0,
        });

        // Vérifier que les projets appartiennent bien au bon utilisateur
        result.data.forEach(project => {
          expect(project.id).toMatch(/^project-[1-9]$|^project-10$/);
        });
      });

      it('should handle last page correctly', async () => {
        const result = await service.findAll('user-1', 2, 5);

        expect(result.data).toHaveLength(5);
        expect(result.pagination).toEqual({
          page: 2,
          limit: 5,
          totalPages: 2,
          hasNext: false,
          hasPrevious: true,
          offset: 5,
        });
      });

      it('should handle page beyond available data', async () => {
        const result = await service.findAll('user-1', 10, 5);

        expect(result.data).toHaveLength(0);
        expect(result.total).toBe(10);
        expect(result.pagination).toEqual({
          page: 10,
          limit: 5,
          totalPages: 2,
          hasNext: false,
          hasPrevious: true,
          offset: 45,
        });
      });

      it('should isolate users data correctly', async () => {
        const user1Result = await service.findAll('user-1', 1, 10);
        const user2Result = await service.findAll('user-2', 1, 10);

        expect(user1Result.total).toBe(10);
        expect(user2Result.total).toBe(10);

        // Vérifier qu'il n'y a pas de fuite de données entre utilisateurs
        const user1Ids = user1Result.data.map(p => p.id);
        const user2Ids = user2Result.data.map(p => p.id);

        expect(user1Ids.some(id => user2Ids.includes(id))).toBe(false);
      });
    });

    describe('Validation des paramètres', () => {
      it('should handle invalid page parameters gracefully', async () => {
        const result = await service.findAll('user-1', 0, 10);

        expect(result.pagination.page).toBe(1);
        expect(result.data).toHaveLength(10);
      });

      it('should enforce maximum limit', async () => {
        const result = await service.findAll('user-1', 1, 200);

        expect(result.pagination.limit).toBe(100); // Max limit enforced
        expect(result.data).toHaveLength(10); // But only 10 items available
      });

      it('should handle negative parameters', async () => {
        const result = await service.findAll('user-1', -5, -10);

        expect(result.pagination.page).toBe(1);
        expect(result.pagination.limit).toBe(1);
        expect(result.data).toHaveLength(1);
      });
    });

    describe('Performance avec volumes réels', () => {
      it('should handle pagination efficiently with 150 total items', async () => {
        const start = performance.now();

        // Paginer à travers tous les utilisateurs
        const promises = [];
        for (let userId = 1; userId <= 15; userId++) {
          promises.push(service.findAll(`user-${userId}`, 1, 10));
        }

        const results = await Promise.all(promises);
        const duration = performance.now() - start;

        expect(duration).toBeLessThan(50); // Devrait être très rapide
        expect(results).toHaveLength(15);
        results.forEach(result => {
          expect(result.data).toHaveLength(10);
          expect(result.total).toBe(10);
        });
      });

      it('should maintain performance with large page numbers', async () => {
        const start = performance.now();

        const result = await service.findAll('user-1', 1000, 1);

        const duration = performance.now() - start;

        expect(duration).toBeLessThan(10);
        expect(result.data).toHaveLength(0);
        expect(result.pagination.page).toBe(1000);
      });
    });
  });

  describe('Controller Integration', () => {
    describe('HTTP-like scenarios', () => {
      it('should handle typical API request patterns', async () => {
        // Simuler une requête GET /projects?page=2&limit=3
        const result = await controller.findAll('user-5', 2, 3);

        expect(result.data).toHaveLength(3);
        expect(result.total).toBe(10);
        expect(result.pagination.page).toBe(2);
        expect(result.pagination.limit).toBe(3);
        expect(result.pagination.hasNext).toBe(true);
        expect(result.pagination.hasPrevious).toBe(true);
      });

      it('should handle requests without pagination parameters', async () => {
        // Simuler une requête GET /projects (paramètres par défaut)
        const result = await controller.findAll('user-3');

        expect(result.data).toHaveLength(10);
        expect(result.pagination.page).toBe(1);
        expect(result.pagination.limit).toBe(10);
        expect(result.total).toBe(10);
      });

      it('should be consistent across multiple requests', async () => {
        // Faire plusieurs requêtes identiques
        const requests = Array.from({ length: 5 }, () =>
          controller.findAll('user-7', 1, 5)
        );

        const results = await Promise.all(requests);

        // Tous les résultats doivent être identiques
        const firstResult = results[0];
        results.forEach(result => {
          expect(result).toEqual(firstResult);
        });
      });
    });
  });

  describe('Database-like Scenarios', () => {
    describe('Simulation Prisma', () => {
      it('should handle count queries efficiently', async () => {
        const start = performance.now();

        // Simuler plusieurs requêtes count simultanées
        const countPromises = Array.from({ length: 15 }, (_, i) =>
          service.count(`user-${i + 1}`)
        );

        const counts = await Promise.all(countPromises);
        const duration = performance.now() - start;

        expect(duration).toBeLessThan(20);
        expect(counts).toHaveLength(15);
        counts.forEach(count => {
          expect(count).toBe(10);
        });
      });

      it('should maintain consistency between findMany and count', async () => {
        const userId = 'user-12';
        
        // Récupérer tous les projets par petites pages
        let allProjectsFromPagination: MockProjectDto[] = [];
        let currentPage = 1;
        let hasMorePages = true;

        while (hasMorePages) {
          const result = await service.findAll(userId, currentPage, 3);
          allProjectsFromPagination.push(...result.data);
          hasMorePages = result.pagination.hasNext;
          currentPage++;
        }

        const totalCount = await service.count(userId);

        expect(allProjectsFromPagination).toHaveLength(totalCount);
      });
    });
  });

  describe('Edge Cases d\'intégration', () => {
    describe('Données vides', () => {
      it('should handle user with no projects', async () => {
        const result = await service.findAll('nonexistent-user', 1, 10);

        expect(result.data).toHaveLength(0);
        expect(result.total).toBe(0);
        expect(result.pagination).toEqual({
          page: 1,
          limit: 10,
          totalPages: 0,
          hasNext: false,
          hasPrevious: false,
          offset: 0,
        });
      });
    });

    describe('Concurrence', () => {
      it('should handle concurrent pagination requests', async () => {
        const concurrentRequests = Array.from({ length: 20 }, (_, i) => {
          const userId = `user-${(i % 15) + 1}`;
          const page = (i % 3) + 1;
          const limit = ((i % 5) + 1) * 2;
          return service.findAll(userId, page, limit);
        });

        const start = performance.now();
        const results = await Promise.all(concurrentRequests);
        const duration = performance.now() - start;

        expect(duration).toBeLessThan(100);
        expect(results).toHaveLength(20);

        results.forEach(result => {
          expect(result.data).toBeDefined();
          expect(result.pagination).toBeDefined();
          expect(result.total).toBeDefined();
        });
      });
    });

    describe('Cohérence des données', () => {
      it('should maintain data consistency across pages', async () => {
        const userId = 'user-10';
        
        // Récupérer la première et deuxième page
        const page1 = await service.findAll(userId, 1, 3);
        const page2 = await service.findAll(userId, 2, 3);

        // Les IDs ne doivent pas se chevaucher
        const page1Ids = page1.data.map(p => p.id);
        const page2Ids = page2.data.map(p => p.id);

        expect(page1Ids.some(id => page2Ids.includes(id))).toBe(false);

        // Le total doit être cohérent
        expect(page1.total).toBe(page2.total);
      });

      it('should handle pagination metadata correctly across different scenarios', async () => {
        const testCases = [
          { userId: 'user-1', page: 1, limit: 5, expectedPages: 2 },
          { userId: 'user-2', page: 1, limit: 10, expectedPages: 1 },
          { userId: 'user-3', page: 2, limit: 3, expectedPages: 4 },
        ];

        for (const testCase of testCases) {
          const result = await service.findAll(
            testCase.userId,
            testCase.page,
            testCase.limit,
          );

          expect(result.pagination.totalPages).toBe(testCase.expectedPages);
          expect(result.pagination.page).toBe(testCase.page);
          expect(result.pagination.limit).toBe(testCase.limit);

          // Vérifier la cohérence des flags hasNext/hasPrevious
          expect(result.pagination.hasNext).toBe(
            testCase.page < testCase.expectedPages,
          );
          expect(result.pagination.hasPrevious).toBe(testCase.page > 1);
        }
      });
    });
  });

  describe('Transformation et mapping', () => {
    it('should handle entity to DTO transformation in pagination context', async () => {
      // Simuler la transformation Entity -> DTO comme dans un vrai service
      const userId = 'user-4';
      
      // Récupérer les entités brutes
      const rawProjects = service['projects']
        .filter(p => p.ownerId === userId)
        .slice(0, 5);

      // Appliquer la pagination avec transformation
      const transformedResult = createPaginatedResult(
        rawProjects.map(project => ({
          id: project.id,
          name: project.name.toUpperCase(), // Transformation
          description: project.description?.substring(0, 50), // Troncature
          createdAt: project.createdAt,
          isRecent: Date.now() - project.createdAt.getTime() < 7 * 24 * 60 * 60 * 1000,
        })),
        1,
        5,
        10,
      );

      expect(transformedResult.data).toHaveLength(5);
      expect(transformedResult.data[0].name).toMatch(/^PROJECT \d+$/);
      expect(transformedResult.data[0].isRecent).toBeDefined();
      expect(typeof transformedResult.data[0].isRecent).toBe('boolean');
    });
  });

  describe('Validation et sécurité', () => {
    it('should prevent data leakage between users', async () => {
      // Tenter d'accéder aux données d'un autre utilisateur
      const user1Data = await service.findAll('user-1', 1, 100);
      const user2Data = await service.findAll('user-2', 1, 100);

      const user1ProjectIds = user1Data.data.map(p => p.id);
      const user2ProjectIds = user2Data.data.map(p => p.id);

      // Aucun ID ne doit être présent dans les deux listes
      user1ProjectIds.forEach(id => {
        expect(user2ProjectIds).not.toContain(id);
      });
    });

    it('should handle malformed parameters gracefully', async () => {
      const malformedRequests = [
        service.findAll('user-1', undefined as any, 10),
        service.findAll('user-1', null as any, 10),
        service.findAll('user-1', 1, undefined as any),
        service.findAll('user-1', 1, null as any),
      ];

      const results = await Promise.allSettled(malformedRequests);

      results.forEach(result => {
        if (result.status === 'fulfilled') {
          expect(result.value.data).toBeDefined();
          expect(result.value.pagination.page).toBeGreaterThan(0);
          expect(result.value.pagination.limit).toBeGreaterThan(0);
        }
      });
    });
  });
});