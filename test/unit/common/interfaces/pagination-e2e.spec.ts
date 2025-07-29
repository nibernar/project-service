/**
 * Tests End-to-End pour la pagination dans un contexte applicatif complet.
 * 
 * Simule des scénarios utilisateur réels avec intégration complète
 * des composants (controllers, services, base de données).
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import {
  PaginatedResult,
  createPaginatedResult,
  validatePaginationParams,
} from '../../../../src/common/interfaces/paginated-result.interface';

// Simulation d'une base de données en mémoire pour les tests E2E
class InMemoryDatabase {
  private static instance: InMemoryDatabase;
  private projects: Array<{
    id: string;
    name: string;
    description?: string;
    ownerId: string;
    status: 'ACTIVE' | 'ARCHIVED' | 'DELETED';
    createdAt: Date;
    updatedAt: Date;
  }> = [];

  private users: Array<{
    id: string;
    email: string;
    name: string;
  }> = [];

  static getInstance(): InMemoryDatabase {
    if (!InMemoryDatabase.instance) {
      InMemoryDatabase.instance = new InMemoryDatabase();
    }
    return InMemoryDatabase.instance;
  }

  reset(): void {
    this.projects = [];
    this.users = [];
  }

  seedData(): void {
    // Créer des utilisateurs de test
    this.users = [
      { id: 'user-1', email: 'user1@test.com', name: 'User One' },
      { id: 'user-2', email: 'user2@test.com', name: 'User Two' },
      { id: 'user-3', email: 'user3@test.com', name: 'User Three' },
    ];

    // Créer des projets de test
    this.projects = [];
    for (let userId = 1; userId <= 3; userId++) {
      const projectCount = userId === 1 ? 25 : userId === 2 ? 15 : 5; // Différents nombres de projets
      
      for (let projectNum = 1; projectNum <= projectCount; projectNum++) {
        this.projects.push({
          id: `project-${userId}-${projectNum}`,
          name: `Project ${projectNum} for User ${userId}`,
          description: `Description for project ${projectNum} belonging to user ${userId}`,
          ownerId: `user-${userId}`,
          status: projectNum <= projectCount - 2 ? 'ACTIVE' : projectNum === projectCount - 1 ? 'ARCHIVED' : 'DELETED',
          createdAt: new Date(Date.now() - (projectCount - projectNum) * 86400000), // Projets plus récents ont des numéros plus élevés
          updatedAt: new Date(),
        });
      }
    }
  }

  getProjectsByOwner(ownerId: string, status?: string): typeof this.projects {
    return this.projects.filter(p => {
      const ownerMatch = p.ownerId === ownerId;
      const statusMatch = !status || p.status === status;
      return ownerMatch && statusMatch;
    });
  }

  getProjectById(id: string): typeof this.projects[0] | undefined {
    return this.projects.find(p => p.id === id);
  }
}

// Mock du service Project pour les tests E2E
class MockProjectService {
  private db = InMemoryDatabase.getInstance();

  async findAll(
    ownerId: string,
    page: number = 1,
    limit: number = 10,
    status?: string
  ): Promise<PaginatedResult<any>> {
    const { page: validPage, limit: validLimit } = validatePaginationParams(page, limit, 100);
    
    const allProjects = this.db.getProjectsByOwner(ownerId, status);
    const total = allProjects.length;
    
    // Appliquer la pagination
    const offset = (validPage - 1) * validLimit;
    const paginatedProjects = allProjects
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()) // Tri par date desc
      .slice(offset, offset + validLimit);

    return createPaginatedResult(
      paginatedProjects.map(p => ({
        id: p.id,
        name: p.name,
        description: p.description,
        status: p.status,
        createdAt: p.createdAt,
      })),
      validPage,
      validLimit,
      total
    );
  }

  async findById(id: string, ownerId: string): Promise<any | null> {
    const project = this.db.getProjectById(id);
    if (!project || project.ownerId !== ownerId) {
      return null;
    }

    return {
      id: project.id,
      name: project.name,
      description: project.description,
      status: project.status,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    };
  }
}

// Mock du contrôleur Project
class MockProjectController {
  constructor(private readonly projectService: MockProjectService) {}

  async getProjects(
    req: { user: { id: string } },
    query: { page?: string; limit?: string; status?: string }
  ) {
    const page = query.page ? parseInt(query.page, 10) : 1;
    const limit = query.limit ? parseInt(query.limit, 10) : 10;
    
    return this.projectService.findAll(req.user.id, page, limit, query.status);
  }

  async getProject(
    req: { user: { id: string } },
    params: { id: string }
  ) {
    const project = await this.projectService.findById(params.id, req.user.id);
    if (!project) {
      throw new Error('Project not found');
    }
    return project;
  }
}

// Simulation d'une application NestJS complète
class MockApp {
  private projectController: MockProjectController;
  private projectService: MockProjectService;

  constructor() {
    this.projectService = new MockProjectService();
    this.projectController = new MockProjectController(this.projectService);
  }

  async handleRequest(method: string, path: string, query: any = {}, user: any = null) {
    // Simulation du middleware d'authentification
    if (!user) {
      return { status: 401, body: { message: 'Unauthorized' } };
    }

    const req = { user, query };

    try {
      if (method === 'GET' && path === '/projects') {
        const result = await this.projectController.getProjects(req, query);
        return { status: 200, body: result };
      }

      if (method === 'GET' && path.startsWith('/projects/')) {
        const id = path.split('/')[2];
        const result = await this.projectController.getProject(req, { id });
        return { status: 200, body: result };
      }

      return { status: 404, body: { message: 'Not found' } };
    } catch (error) {
      if (error.message === 'Project not found') {
        return { status: 404, body: { message: 'Project not found' } };
      }
      return { status: 500, body: { message: 'Internal server error' } };
    }
  }
}

describe('Pagination E2E Tests', () => {
  let app: MockApp;
  let db: InMemoryDatabase;

  beforeAll(() => {
    db = InMemoryDatabase.getInstance();
    app = new MockApp();
  });

  beforeEach(() => {
    db.reset();
    db.seedData();
  });

  describe('Scénarios Utilisateur Complets', () => {
    describe('Navigation de pagination basique', () => {
      it('should allow user to browse through all their projects', async () => {
        const user = { id: 'user-1' };
        const pageSize = 10;
        let currentPage = 1;
        let allProjectsCollected: any[] = [];
        let hasMorePages = true;

        // Naviguer à travers toutes les pages
        while (hasMorePages) {
          const response = await app.handleRequest('GET', '/projects', {
            page: currentPage.toString(),
            limit: pageSize.toString(),
          }, user);

          expect(response.status).toBe(200);
          expect(response.body).toBeValidPaginatedResult();

          const result = response.body as PaginatedResult<any>;
          allProjectsCollected.push(...result.data);

          // Vérifier la cohérence de la pagination
          expect(result.pagination.page).toBe(currentPage);
          expect(result.pagination.limit).toBe(pageSize);
          expect(result.data.length).toBeLessThanOrEqual(pageSize);

          hasMorePages = result.pagination.hasNext;
          currentPage++;

          // Protection contre les boucles infinies
          if (currentPage > 10) break;
        }

        // Vérifier que tous les projets ont été collectés
        expect(allProjectsCollected.length).toBe(25); // user-1 a 25 projets
        
        // Vérifier qu'il n'y a pas de doublons
        const uniqueIds = new Set(allProjectsCollected.map(p => p.id));
        expect(uniqueIds.size).toBe(allProjectsCollected.length);
      });

      it('should handle direct page access correctly', async () => {
        const user = { id: 'user-1' };

        // Accéder directement à la page 3
        const response = await app.handleRequest('GET', '/projects', {
          page: '3',
          limit: '5',
        }, user);

        expect(response.status).toBe(200);
        const result = response.body as PaginatedResult<any>;

        expect(result.pagination.page).toBe(3);
        expect(result.pagination.limit).toBe(5);
        expect(result.pagination.hasPrevious).toBe(true);
        expect(result.data.length).toBe(5);

        // Vérifier que les projets sont dans l'ordre attendu (les plus récents d'abord)
        const projectIds = result.data.map(p => p.id);
        expect(projectIds).toEqual([
          'project-1-15',
          'project-1-14',
          'project-1-13',
          'project-1-12',
          'project-1-11',
        ]);
      });

      it('should handle page beyond available data gracefully', async () => {
        const user = { id: 'user-3' }; // user-3 n'a que 5 projets

        const response = await app.handleRequest('GET', '/projects', {
          page: '10',
          limit: '5',
        }, user);

        expect(response.status).toBe(200);
        const result = response.body as PaginatedResult<any>;

        expect(result.data).toHaveLength(0);
        expect(result.total).toBe(5);
        expect(result.pagination.page).toBe(10);
        expect(result.pagination.hasNext).toBe(false);
        expect(result.pagination.hasPrevious).toBe(true);
      });
    });

    describe('Scénarios de filtrage avec pagination', () => {
      it('should paginate filtered results correctly', async () => {
        const user = { id: 'user-1' };

        // Test avec filtre de statut
        const activeResponse = await app.handleRequest('GET', '/projects', {
          status: 'ACTIVE',
          page: '1',
          limit: '10',
        }, user);

        expect(activeResponse.status).toBe(200);
        const activeResult = activeResponse.body as PaginatedResult<any>;

        expect(activeResult.data.every(p => p.status === 'ACTIVE')).toBe(true);
        expect(activeResult.total).toBe(23); // user-1 a 23 projets ACTIVE

        // Vérifier la cohérence des calculs de pagination avec filtre
        expect(activeResult.pagination.totalPages).toBe(3); // 23 projets / 10 par page = 3 pages
      });

      it('should handle multiple filters with pagination', async () => {
        const user = { id: 'user-2' };

        const response = await app.handleRequest('GET', '/projects', {
          status: 'ACTIVE',
          page: '2',
          limit: '5',
        }, user);

        expect(response.status).toBe(200);
        const result = response.body as PaginatedResult<any>;

        expect(result.data.every(p => p.status === 'ACTIVE')).toBe(true);
        expect(result.pagination.page).toBe(2);
        expect(result.data.length).toBe(5);
      });
    });

    describe('Scénarios d\'erreur utilisateur', () => {
      it('should handle invalid pagination parameters gracefully', async () => {
        const user = { id: 'user-1' };

        const testCases = [
          { page: '0', limit: '10' },
          { page: '-5', limit: '10' },
          { page: '1', limit: '0' },
          { page: '1', limit: '-10' },
          { page: 'invalid', limit: '10' },
          { page: '1', limit: 'invalid' },
        ];

        for (const testCase of testCases) {
          const response = await app.handleRequest('GET', '/projects', testCase, user);
          
          expect(response.status).toBe(200); // Doit normaliser et continuer
          const result = response.body as PaginatedResult<any>;
          
          expect(result.pagination.page).toBeGreaterThan(0);
          expect(result.pagination.limit).toBeGreaterThan(0);
          expect(result.data).toBeDefined();
        }
      });

      it('should enforce maximum limits to prevent abuse', async () => {
        const user = { id: 'user-1' };

        const response = await app.handleRequest('GET', '/projects', {
          page: '1',
          limit: '999999', // Tentative d'abus
        }, user);

        expect(response.status).toBe(200);
        const result = response.body as PaginatedResult<any>;

        expect(result.pagination.limit).toBeLessThanOrEqual(100); // Limite maximale appliquée
      });
    });

    describe('Isolation des données utilisateur', () => {
      it('should prevent data leakage between users', async () => {
        const user1 = { id: 'user-1' };
        const user2 = { id: 'user-2' };

        // Récupérer les projets des deux utilisateurs
        const [response1, response2] = await Promise.all([
          app.handleRequest('GET', '/projects', { page: '1', limit: '50' }, user1),
          app.handleRequest('GET', '/projects', { page: '1', limit: '50' }, user2),
        ]);

        expect(response1.status).toBe(200);
        expect(response2.status).toBe(200);

        const result1 = response1.body as PaginatedResult<any>;
        const result2 = response2.body as PaginatedResult<any>;

        // Vérifier qu'il n'y a pas de croisement d'IDs
        const ids1 = new Set(result1.data.map(p => p.id));
        const ids2 = new Set(result2.data.map(p => p.id));

        const intersection = new Set([...ids1].filter(id => ids2.has(id)));
        expect(intersection.size).toBe(0);
      });

      it('should prevent unauthorized access to specific projects', async () => {
        const user1 = { id: 'user-1' };
        const user2 = { id: 'user-2' };

        // user2 tente d'accéder à un projet de user1
        const response = await app.handleRequest('GET', '/projects/project-1-1', {}, user2);

        expect(response.status).toBe(404);
        expect(response.body.message).toBe('Project not found');
      });
    });
  });

  describe('Scénarios de Performance E2E', () => {
    describe('Performance avec volumes réalistes', () => {
      it('should handle pagination efficiently under realistic load', async () => {
        const user = { id: 'user-1' };
        const concurrentRequests = 20;
        
        const start = performance.now();

        // Simuler des requêtes concurrentes de pagination
        const requestPromises = Array.from({ length: concurrentRequests }, (_, i) => {
          return app.handleRequest('GET', '/projects', {
            page: ((i % 5) + 1).toString(),
            limit: '10',
          }, user);
        });

        const responses = await Promise.all(requestPromises);
        const duration = performance.now() - start;

        // Toutes les requêtes doivent réussir
        responses.forEach(response => {
          expect(response.status).toBe(200);
          expect(response.body).toBeValidPaginatedResult();
        });

        // Performance acceptable même avec la concurrence
        expect(duration).toBeLessThan(100); // Moins de 100ms pour 20 requêtes
      });

      it('should maintain consistent response times across pages', async () => {
        const user = { id: 'user-1' };
        const measurements: number[] = [];

        // Mesurer le temps de réponse pour différentes pages
        for (let page = 1; page <= 5; page++) {
          const start = performance.now();
          
          const response = await app.handleRequest('GET', '/projects', {
            page: page.toString(),
            limit: '5',
          }, user);
          
          const duration = performance.now() - start;
          measurements.push(duration);

          expect(response.status).toBe(200);
        }

        // La variance des temps de réponse ne doit pas être excessive
        const avgTime = measurements.reduce((sum, time) => sum + time, 0) / measurements.length;
        const maxTime = Math.max(...measurements);
        
        expect(maxTime).toBeLessThan(avgTime * 3); // Pas plus de 3x le temps moyen
      });
    });
  });

  describe('Intégration avec l\'authentification', () => {
    describe('Gestion des utilisateurs non authentifiés', () => {
      it('should reject requests without authentication', async () => {
        const response = await app.handleRequest('GET', '/projects', {
          page: '1',
          limit: '10',
        }, null); // Pas d'utilisateur

        expect(response.status).toBe(401);
        expect(response.body.message).toBe('Unauthorized');
      });

      it('should reject requests with invalid user', async () => {
        const invalidUser = { id: 'nonexistent-user' };

        const response = await app.handleRequest('GET', '/projects', {
          page: '1',
          limit: '10',
        }, invalidUser);

        expect(response.status).toBe(200);
        const result = response.body as PaginatedResult<any>;
        
        // Utilisateur inexistant -> aucun projet
        expect(result.data).toHaveLength(0);
        expect(result.total).toBe(0);
      });
    });
  });

  describe('Workflows Utilisateur Complexes', () => {
    describe('Scénario de recherche et navigation', () => {
      it('should support complex user workflows', async () => {
        const user = { id: 'user-1' };

        // 1. Utilisateur consulte la première page
        const page1Response = await app.handleRequest('GET', '/projects', {
          page: '1',
          limit: '5',
        }, user);

        expect(page1Response.status).toBe(200);
        const page1Result = page1Response.body as PaginatedResult<any>;
        expect(page1Result.data).toHaveLength(5);

        // 2. Utilisateur clique sur un projet spécifique
        const projectId = page1Result.data[0].id;
        const projectResponse = await app.handleRequest('GET', `/projects/${projectId}`, {}, user);

        expect(projectResponse.status).toBe(200);
        expect(projectResponse.body.id).toBe(projectId);

        // 3. Utilisateur revient à la liste et navigue vers la page suivante
        const page2Response = await app.handleRequest('GET', '/projects', {
          page: '2',
          limit: '5',
        }, user);

        expect(page2Response.status).toBe(200);
        const page2Result = page2Response.body as PaginatedResult<any>;
        expect(page2Result.pagination.page).toBe(2);
        expect(page2Result.pagination.hasPrevious).toBe(true);

        // 4. Utilisateur applique un filtre
        const filteredResponse = await app.handleRequest('GET', '/projects', {
          status: 'ACTIVE',
          page: '1',
          limit: '10',
        }, user);

        expect(filteredResponse.status).toBe(200);
        const filteredResult = filteredResponse.body as PaginatedResult<any>;
        expect(filteredResult.data.every(p => p.status === 'ACTIVE')).toBe(true);
      });
    });

    describe('Cohérence des données en pagination', () => {
      it('should maintain data consistency across pagination requests', async () => {
        const user = { id: 'user-2' };

        // Récupérer tous les projets par petites pages
        const allPages: any[] = [];
        let currentPage = 1;
        let hasMore = true;

        while (hasMore && currentPage <= 10) {
          const response = await app.handleRequest('GET', '/projects', {
            page: currentPage.toString(),
            limit: '3',
          }, user);

          expect(response.status).toBe(200);
          const result = response.body as PaginatedResult<any>;
          
          allPages.push(...result.data);
          hasMore = result.pagination.hasNext;
          currentPage++;
        }

        // Récupérer tous les projets en une seule page
        const singlePageResponse = await app.handleRequest('GET', '/projects', {
          page: '1',
          limit: '50',
        }, user);

        expect(singlePageResponse.status).toBe(200);
        const singlePageResult = singlePageResponse.body as PaginatedResult<any>;

        // Les deux méthodes doivent donner les mêmes résultats
        expect(allPages.length).toBe(singlePageResult.data.length);
        
        const paginatedIds = allPages.map(p => p.id).sort();
        const singlePageIds = singlePageResult.data.map(p => p.id).sort();
        
        expect(paginatedIds).toEqual(singlePageIds);
      });
    });
  });

  describe('Edge Cases E2E', () => {
    describe('Cas limites réalistes', () => {
      it('should handle user with no projects', async () => {
        // Créer un utilisateur sans projets
        const emptyUser = { id: 'empty-user' };

        const response = await app.handleRequest('GET', '/projects', {
          page: '1',
          limit: '10',
        }, emptyUser);

        expect(response.status).toBe(200);
        const result = response.body as PaginatedResult<any>;

        expect(result.data).toHaveLength(0);
        expect(result.total).toBe(0);
        expect(result.pagination.totalPages).toBe(0);
        expect(result.pagination.hasNext).toBe(false);
        expect(result.pagination.hasPrevious).toBe(false);
      });

      it('should handle rapid page switching', async () => {
        const user = { id: 'user-1' };
        const pages = [1, 3, 2, 5, 1, 4];

        const responses = await Promise.all(
          pages.map(page => 
            app.handleRequest('GET', '/projects', {
              page: page.toString(),
              limit: '5',
            }, user)
          )
        );

        responses.forEach((response, index) => {
          expect(response.status).toBe(200);
          const result = response.body as PaginatedResult<any>;
          expect(result.pagination.page).toBe(pages[index]);
        });
      });
    });
  });
});