import { CreateProjectDto } from '../../src/project/dto/create-project.dto';
import { UpdateProjectDto } from '../../src/project/dto/update-project.dto';
import { ProjectResponseDto } from '../../src/project/dto/project-response.dto';
import { ProjectListItemDto } from '../../src/project/dto/project-list.dto';
import { PaginationDto } from '../../src/common/dto/pagination.dto';
import { ExportOptionsDto } from '../../src/export/dto/export-options.dto';
import { ExportResponseDto } from '../../src/export/dto/export-response.dto';
import { UpdateStatisticsDto } from '../../src/statistics/dto/update-statistics.dto';
import { StatisticsResponseDto } from '../../src/statistics/dto/statistics-response.dto';

import { ProjectEntity } from '../../src/project/entities/project.entity';
import { ProjectStatisticsEntity } from '../../src/statistics/entities/project-statistics.entity';

import { ProjectStatus } from '../../src/common/enums/project-status.enum';
import { User } from '../../src/common/interfaces/user.interface';
import { PaginatedResult } from '../../src/common/interfaces/paginated-result.interface';

// Types utilitaires
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// Constantes de test
export const TEST_CONSTANTS = {
  VALID_PROJECT_NAME_LENGTH: { min: 1, max: 100 },
  VALID_DESCRIPTION_LENGTH: { min: 0, max: 1000 },
  VALID_PROMPT_LENGTH: { min: 10, max: 5000 },
  DEFAULT_PAGINATION: { page: 1, limit: 10 },
  MAX_FILE_IDS_COUNT: 50
} as const;

export const TEST_IDS = {
  PROJECT_1: "550e8400-e29b-41d4-a716-446655440000",
  PROJECT_2: "550e8400-e29b-41d4-a716-446655440001", 
  PROJECT_3: "550e8400-e29b-41d4-a716-446655440002",
  USER_1: "660e8400-e29b-41d4-a716-446655440001",
  USER_2: "660e8400-e29b-41d4-a716-446655440002",
  USER_3: "660e8400-e29b-41d4-a716-446655440003", 
  ADMIN_USER: "660e8400-e29b-41d4-a716-446655440004",
  STATS_1: "770e8400-e29b-41d4-a716-446655440010",
  STATS_2: "770e8400-e29b-41d4-a716-446655440011",
  EXPORT_1: "880e8400-e29b-41d4-a716-446655440020"
} as const;

// Utilitaires de génération
export class DataGenerator {
  private static readonly PROJECT_NAMES = [
    "Application E-commerce",
    "Plateforme de Blog",
    "Système de Gestion RH",
    "API de Géolocalisation",
    "Dashboard Analytics",
    "Application Mobile Banking",
    "Portail Client B2B",
    "Système de Réservation",
    "Plateforme Streaming",
    "Application IoT Smart Home"
  ];

  private static readonly DESCRIPTIONS = [
    "Plateforme de vente en ligne avec gestion des commandes et des paiements",
    "Blog multi-utilisateurs avec système de commentaires et modération",
    "Système complet de gestion des ressources humaines et paie",
    "API REST pour services de géolocalisation et cartographie",
    "Dashboard temps réel pour analytics et métriques business",
    "Application mobile sécurisée pour services bancaires",
    "Portail client pour entreprises avec gestion des commandes",
    "Système de réservation en ligne pour hôtels et restaurants",
    "Plateforme de streaming vidéo avec recommandations IA",
    "Application de contrôle et monitoring pour maison connectée"
  ];

  private static readonly COMPLEX_PROMPTS = [
    "Je souhaite créer une application e-commerce complète avec un backend Node.js, une interface React, une base de données PostgreSQL et un système de paiement intégré. L'application doit permettre aux utilisateurs de s'inscrire, parcourir des produits, les ajouter au panier et finaliser leurs achats. Il faut également un panneau d'administration pour gérer les produits, les commandes et les utilisateurs.",
    "Développer une plateforme de blog moderne avec un système d'authentification robuste, un éditeur de contenu riche (markdown), un système de commentaires avec modération, et des fonctionnalités de SEO avancées. Le blog doit supporter multiple auteurs, catégories, tags, et avoir un dashboard d'analytics intégré.",
    "Créer un système complet de gestion RH incluant la gestion des employés, fiches de paie, congés, formation, évaluations de performance. Le système doit intégrer un workflow d'approbation, des notifications automatiques, et des rapports détaillés. Architecture microservices avec authentification SSO.",
    "Développer une API REST complète pour services de géolocalisation avec authentification par clés API, rate limiting, cache Redis, documentation Swagger. L'API doit fournir des endpoints pour geocoding, reverse geocoding, calcul d'itinéraires, et zones géographiques avec haute disponibilité.",
    "Construire un dashboard analytics temps réel avec visualisations interactives, métriques KPI personnalisables, alertes automatiques, export de rapports. Architecture event-driven avec WebSockets pour les updates temps réel, base de données time-series pour les métriques."
  ];

  static randomUUID(seed?: string): string {
    if (seed) {
      const hash = seed.split('').reduce((a, b) => {
        a = ((a << 5) - a) + b.charCodeAt(0);
        return a & a;
      }, 0);
      return `test-${Math.abs(hash).toString(16).padStart(8, '0')}-e29b-41d4-a716-446655440000`;
    }
    return `test-${Date.now()}-e29b-41d4-a716-${Math.random().toString(16).substr(2, 12)}`;
  }

  static realisticProjectName(index: number = 0): string {
    return this.PROJECT_NAMES[index % this.PROJECT_NAMES.length];
  }

  static realisticDescription(index: number = 0): string {
    return this.DESCRIPTIONS[index % this.DESCRIPTIONS.length];
  }

  static complexPrompt(index: number = 0): string {
    return this.COMPLEX_PROMPTS[index % this.COMPLEX_PROMPTS.length];
  }

  static pastDate(daysAgo: number): Date {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    return date;
  }

  static futureDate(daysAhead: number): Date {
    const date = new Date();
    date.setDate(date.getDate() + daysAhead);
    return date;
  }

  static createPerformanceTestData() {
    return {
      user: UserFixtures.validUser(),
      largeProject: ProjectFixtures.largeProject(),
      multipleProjects: ProjectFixtures.projectsList(50),
      highCostStats: StatisticsFixtures.highCostStats(),
      largeFileList: FileFixtures.largeFileIdsList(100)
    };
  }
}

// Fixtures des fichiers
export class FileFixtures {
  static uploadedFileIds(): string[] {
    return [
      "upload-pdf-550e8400-e29b-41d4-a716-446655440020",
      "upload-docx-550e8400-e29b-41d4-a716-446655440021",
      "upload-txt-550e8400-e29b-41d4-a716-446655440022"
    ];
  }

  static generatedFileIds(): string[] {
    return [
      "gen-cadrage-550e8400-e29b-41d4-a716-446655440030",
      "gen-roadmap-550e8400-e29b-41d4-a716-446655440031",
      "gen-plan-550e8400-e29b-41d4-a716-446655440032",
      "gen-guide-550e8400-e29b-41d4-a716-446655440033"
    ];
  }

  static mixedFileIds(): string[] {
    return [
      ...this.uploadedFileIds(),
      ...this.generatedFileIds()
    ];
  }

  static emptyFileIds(): string[] {
    return [];
  }

  static singleUploadedFileId(): string[] {
    return ["upload-single-550e8400-e29b-41d4-a716-446655440025"];
  }

  static largeFileIdsList(count: number = 20): string[] {
    return Array.from({ length: count }, (_, i) => 
      `file-${i.toString().padStart(3, '0')}-550e8400-e29b-41d4-a716-446655440000`
    );
  }
}

// Fixtures des utilisateurs
export class UserFixtures {
  static validUser(): User {
    return {
      id: TEST_IDS.USER_1,
      email: "john.doe@example.com",
      roles: ["user"]
    };
  }

  static adminUser(): User {
    return {
      id: TEST_IDS.ADMIN_USER,
      email: "admin@coders.platform",
      roles: ["admin", "user"]
    };
  }

  static otherUser(): User {
    return {
      id: TEST_IDS.USER_2,
      email: "jane.smith@example.com",
      roles: ["user"]
    };
  }

  static thirdUser(): User {
    return {
      id: TEST_IDS.USER_3,
      email: "bob.wilson@example.com",
      roles: ["user"]
    };
  }

  static userWithCustomEmail(email: string): User {
    return {
      id: DataGenerator.randomUUID(email),
      email,
      roles: ["user"]
    };
  }

  static userWithToken(): User & { token: string } {
    return {
      ...this.validUser(),
      token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTU1MGU4NDAwLWUyOWItNDFkNC1hNzE2LTQ0NjY1NTQ0MDAwMSIsImVtYWlsIjoiam9obi5kb2VAZXhhbXBsZS5jb20iLCJyb2xlcyI6WyJ1c2VyIl0sImlhdCI6MTY0MDk5NTIwMCwiZXhwIjoxNjQwOTk4ODAwfQ.test-signature"
    };
  }
}

// Fixtures des statistiques
export class StatisticsFixtures {
    static emptyStats(): ProjectStatisticsEntity {
    const entity = Object.assign(new ProjectStatisticsEntity(), {
        id: TEST_IDS.STATS_1,
        projectId: TEST_IDS.PROJECT_1,
        costs: {},
        performance: {},
        usage: {},
        lastUpdated: new Date("2024-01-15T10:30:00Z")
    });

    // Mock seulement des méthodes qui existent vraiment
    entity.mergeCosts = jest.fn().mockReturnValue(entity);
    entity.mergePerformance = jest.fn().mockReturnValue(entity);
    entity.mergeUsage = jest.fn().mockReturnValue(entity);
    entity.updateMetadata = jest.fn().mockReturnValue(entity);

    return entity;
    }

    static basicStats(): ProjectStatisticsEntity {
    const entity = Object.assign(new ProjectStatisticsEntity(), {
        id: TEST_IDS.STATS_1,
        projectId: TEST_IDS.PROJECT_1,
        costs: {
        claudeApi: 1.25,
        storage: 0.05,
        compute: 0.03,
        total: 1.33
        },
        performance: {
        generationTime: 45000,
        processingTime: 12000,
        totalTime: 57000
        },
        usage: {
        documentsGenerated: 3,
        filesProcessed: 1,
        tokensUsed: 15420
        },
        lastUpdated: new Date("2024-01-15T11:00:00Z")
    });

    // Mock seulement des méthodes qui existent vraiment
    entity.mergeCosts = jest.fn().mockReturnValue(entity);
    entity.mergePerformance = jest.fn().mockReturnValue(entity);
    entity.mergeUsage = jest.fn().mockReturnValue(entity);
    entity.updateMetadata = jest.fn().mockReturnValue(entity);

    return entity;
    }

    static completeStats(): ProjectStatisticsEntity {
    const entity = Object.assign(new ProjectStatisticsEntity(), {
        id: TEST_IDS.STATS_1,
        projectId: TEST_IDS.PROJECT_1,
        costs: {
        claudeApi: 2.45,
        storage: 0.12,
        compute: 0.08,
        total: 2.65
        },
        performance: {
        generationTime: 125000,
        processingTime: 45000,
        totalTime: 170000
        },
        usage: {
        documentsGenerated: 5,
        filesProcessed: 2,
        tokensUsed: 45230
        },
        lastUpdated: new Date("2024-01-15T11:45:00Z")
    });

    // Mock seulement des méthodes qui existent vraiment
    entity.mergeCosts = jest.fn().mockReturnValue(entity);
    entity.mergePerformance = jest.fn().mockReturnValue(entity);
    entity.mergeUsage = jest.fn().mockReturnValue(entity);
    entity.updateMetadata = jest.fn().mockReturnValue(entity);

    return entity;
    }

    static highCostStats(): ProjectStatisticsEntity {
    const entity = Object.assign(new ProjectStatisticsEntity(), {
        id: TEST_IDS.STATS_2,
        projectId: TEST_IDS.PROJECT_2,
        costs: {
        claudeApi: 15.75,
        storage: 2.30,
        compute: 1.85,
        total: 19.90
        },
        performance: {
        generationTime: 450000,
        processingTime: 120000,
        totalTime: 570000
        },
        usage: {
        documentsGenerated: 25,
        filesProcessed: 8,
        tokensUsed: 250000
        },
        lastUpdated: new Date("2024-01-15T15:30:00Z")
    });

    // Mock seulement des méthodes qui existent vraiment
    entity.mergeCosts = jest.fn().mockReturnValue(entity);
    entity.mergePerformance = jest.fn().mockReturnValue(entity);
    entity.mergeUsage = jest.fn().mockReturnValue(entity);
    entity.updateMetadata = jest.fn().mockReturnValue(entity);

    return entity;
    }

  static updateStatisticsDto(): UpdateStatisticsDto {
    const dto = Object.assign(new UpdateStatisticsDto(), {
      costs: {
        claudeApi: 1.25,
        storage: 0.05,
        compute: 0.03,
        total: 1.33
      },
      performance: {
        generationTime: 45000,
        processingTime: 12000,
        totalTime: 57000
      },
      usage: {
        documentsGenerated: 3,
        filesProcessed: 1,
        tokensUsed: 15420
      }
    });

    // Mock des méthodes de validation
    dto.validateCostsCoherence = jest.fn().mockReturnValue(true);
    dto.validatePerformanceCoherence = jest.fn().mockReturnValue(true);
    dto.validateUsageCoherence = jest.fn().mockReturnValue(true);
    dto.validateTimestamp = jest.fn().mockReturnValue(true);
    dto.isValid = jest.fn().mockReturnValue(true);

    return dto;
  }

  static statisticsResponseDto(): StatisticsResponseDto {
    const stats = this.completeStats();
    const dto = Object.assign(new StatisticsResponseDto(), {
      costs: stats.costs as any,
      performance: stats.performance as any,
      usage: stats.usage as any,
    });

    return dto;
  }
}

// Fixtures des projets
export class ProjectFixtures {
  static validCreateDto(): CreateProjectDto {
    const dto = new CreateProjectDto();
    dto.name = "Application E-commerce";
    dto.description = "Plateforme de vente en ligne avec gestion des commandes";
    dto.initialPrompt = "Je souhaite créer une application e-commerce complète avec un backend Node.js, une interface React, une base de données PostgreSQL et un système de paiement intégré. L'application doit permettre aux utilisateurs de s'inscrire, parcourir des produits, les ajouter au panier et finaliser leurs achats.";
    dto.uploadedFileIds = FileFixtures.uploadedFileIds();
    return dto;
  }

  static minimalCreateDto(): CreateProjectDto {
    const dto = new CreateProjectDto();
    dto.name = "Projet Test";
    dto.initialPrompt = "Créer une application simple de test avec les fonctionnalités de base.";
    return dto;
  }

  static invalidCreateDto(): Partial<CreateProjectDto> {
    return {
      name: "", // Nom vide
      description: "x".repeat(1001), // Description trop longue
      initialPrompt: "abc", // Prompt trop court
      uploadedFileIds: ["invalid-id"] // ID invalide
    };
  }

  static validUpdateDto(): UpdateProjectDto {
    const dto = new UpdateProjectDto();
    dto.name = "Application E-commerce Mise à Jour";
    dto.description = "Plateforme de vente en ligne avec gestion des commandes et des paiements modernisée";
    return dto;
  }

  static partialUpdateDto(): UpdateProjectDto {
    const dto = new UpdateProjectDto();
    dto.name = "Nouveau Nom";
    return dto;
  }

  static mockProject(overrides?: DeepPartial<ProjectEntity>): ProjectEntity {
    const baseProject = Object.assign(new ProjectEntity(), {
      id: TEST_IDS.PROJECT_1,
      name: "Application E-commerce",
      description: "Plateforme de vente en ligne avec gestion des commandes",
      initialPrompt: "Je souhaite créer une application e-commerce complète avec un backend Node.js, une interface React, une base de données PostgreSQL et un système de paiement intégré. L'application doit permettre aux utilisateurs de s'inscrire, parcourir des produits, les ajouter au panier et finaliser leurs achats.",
      status: ProjectStatus.ACTIVE,
      uploadedFileIds: FileFixtures.uploadedFileIds(),
      generatedFileIds: FileFixtures.generatedFileIds(),
      ownerId: TEST_IDS.USER_1,
      createdAt: new Date("2024-01-15T10:30:00Z"),
      updatedAt: new Date("2024-01-15T10:30:00Z"),
      statistics: null,
      ...overrides
    });

    // Mock des méthodes de l'entité
    baseProject.belongsToUserId = jest.fn().mockImplementation((userId: string) => 
      baseProject.ownerId === userId
    );
    baseProject.canTransitionTo = jest.fn().mockReturnValue(true);
    baseProject.isModifiable = jest.fn().mockReturnValue(
      baseProject.status === ProjectStatus.ACTIVE
    );
    baseProject.hasStatistics = jest.fn().mockReturnValue(!!baseProject.statistics);
    baseProject.hasUploadedFiles = jest.fn().mockReturnValue(
      baseProject.uploadedFileIds.length > 0
    );
    baseProject.hasGeneratedFiles = jest.fn().mockReturnValue(
      baseProject.generatedFileIds.length > 0
    );
    baseProject.getFileCount = jest.fn().mockReturnValue({
      uploaded: baseProject.uploadedFileIds.length,
      generated: baseProject.generatedFileIds.length,
      total: baseProject.uploadedFileIds.length + baseProject.generatedFileIds.length,
    });
    baseProject.getComplexityEstimate = jest.fn().mockReturnValue('medium');

    return baseProject;
  }

  static mockProjectWithStats(overrides?: DeepPartial<ProjectEntity>): ProjectEntity {
    return this.mockProject({
      statistics: StatisticsFixtures.completeStats(),
      ...overrides
    });
  }

  static archivedProject(): ProjectEntity {
    return this.mockProject({
      id: TEST_IDS.PROJECT_2,
      name: "Projet Archivé",
      status: ProjectStatus.ARCHIVED,
      updatedAt: new Date("2024-01-10T15:00:00Z")
    });
  }

  static deletedProject(): ProjectEntity {
    const project = this.mockProject({
      id: TEST_IDS.PROJECT_3,
      name: "Projet Supprimé",
      status: ProjectStatus.DELETED,
      updatedAt: new Date("2024-01-05T09:00:00Z")
    });
    
    // Override isModifiable pour les projets supprimés
    project.isModifiable = jest.fn().mockReturnValue(false);
    
    return project;
  }

  static projectWithFiles(): ProjectEntity {
    return this.mockProject({
      uploadedFileIds: FileFixtures.uploadedFileIds(),
      generatedFileIds: FileFixtures.generatedFileIds()
    });
  }

  static projectWithoutFiles(): ProjectEntity {
    return this.mockProject({
      uploadedFileIds: [],
      generatedFileIds: []
    });
  }

  static projectInProgress(): ProjectEntity {
    return this.mockProject({
      uploadedFileIds: FileFixtures.uploadedFileIds(),
      generatedFileIds: [] // Pas encore de fichiers générés
    });
  }

  static projectReadyForExport(): ProjectEntity {
    return this.mockProject({
      uploadedFileIds: FileFixtures.uploadedFileIds(),
      generatedFileIds: FileFixtures.generatedFileIds()
    });
  }

  static largeProject(): ProjectEntity {
    return this.mockProject({
      name: "Projet Volumineux",
      description: "Un projet avec beaucoup de fichiers et de données pour tester les performances",
      uploadedFileIds: FileFixtures.largeFileIdsList(15),
      generatedFileIds: FileFixtures.largeFileIdsList(25)
    });
  }

  static projectsList(count: number = 5): ProjectEntity[] {
    return Array.from({ length: count }, (_, i) => {
      const statuses = [ProjectStatus.ACTIVE, ProjectStatus.ARCHIVED];
      const status = statuses[i % statuses.length];
      
      return this.mockProject({
        id: `project-${i.toString().padStart(3, '0')}-550e8400-e29b-41d4-a716-446655440000`,
        name: DataGenerator.realisticProjectName(i),
        description: DataGenerator.realisticDescription(i),
        status,
        createdAt: DataGenerator.pastDate(count - i),
        updatedAt: DataGenerator.pastDate(count - i - 1)
      });
    });
  }

  static projectsForPagination(totalCount: number): ProjectEntity[] {
    return this.projectsList(totalCount);
  }

  static conflictingProject(): ProjectEntity {
    return this.mockProject({
      name: "Application E-commerce" // Même nom que le projet par défaut
    });
  }

  static projectWithInvalidFiles(): ProjectEntity {
    return this.mockProject({
      uploadedFileIds: ["invalid-file-id-1", "invalid-file-id-2"],
      generatedFileIds: ["invalid-gen-id-1"]
    });
  }

  static projectWithComplexScenario(): ProjectEntity {
    return this.mockProject({
      name: "Système Complexe Multi-Services",
      description: "Architecture microservices complète avec API Gateway, services métier, bases de données distribuées, système de cache, monitoring temps réel, et déploiement automatisé sur Kubernetes avec haute disponibilité et scalabilité horizontale.",
      initialPrompt: DataGenerator.complexPrompt(0),
      uploadedFileIds: FileFixtures.largeFileIdsList(10),
      generatedFileIds: FileFixtures.largeFileIdsList(15)
    });
  }

  // Builder pattern pour construction fluente
  static builder(): ProjectBuilder {
    return new ProjectBuilder();
  }
}

// Fixtures des réponses DTO
export class ResponseFixtures {
  static projectResponseDto(): ProjectResponseDto {
    const project = ProjectFixtures.mockProject();
    const dto = new ProjectResponseDto();
    dto.id = project.id;
    dto.name = project.name;
    dto.description = project.description;
    dto.status = project.status;
    dto.createdAt = project.createdAt;
    dto.updatedAt = project.updatedAt;
    dto.uploadedFileIds = project.uploadedFileIds;
    dto.generatedFileIds = project.generatedFileIds;
    return dto;
  }

  static projectListItemDto(): ProjectListItemDto {
    const project = ProjectFixtures.mockProject();
    const dto = new ProjectListItemDto();
    dto.id = project.id;
    dto.name = project.name;
    dto.description = project.description;
    dto.status = project.status;
    dto.createdAt = project.createdAt;
    dto.generatedFilesCount = project.generatedFileIds.length;
    return dto;
  }

  static paginatedProjectsResponse(): PaginatedResult<ProjectListItemDto> {
    const projects = ProjectFixtures.projectsList(3);
    const items = projects.map(p => {
      const dto = new ProjectListItemDto();
      dto.id = p.id;
      dto.name = p.name;
      dto.description = p.description;
      dto.status = p.status;
      dto.createdAt = p.createdAt;
      dto.generatedFilesCount = p.generatedFileIds.length;
      return dto;
    });

    return {
      data: items,
      total: 15,
      pagination: {
        page: 1,
        limit: 10,
        totalPages: 2,
        hasNext: true,
        hasPrevious: false,
        offset: 0,
      },
    };
  }

  static createPaginatedResult<T>(data: T[], total: number = data.length): PaginatedResult<T> {
    return {
      data,
      total,
      pagination: {
        page: 1,
        limit: 10,
        totalPages: Math.ceil(total / 10),
        hasNext: total > 10,
        hasPrevious: false,
        offset: 0,
      },
    };
  }
}

// Fixtures d'export
export class ExportFixtures {
  static markdownExportOptions(): ExportOptionsDto {
    const dto = new ExportOptionsDto();
    dto.format = 'markdown';
    dto.includeMetadata = true;
    dto.fileIds = FileFixtures.generatedFileIds();
    return dto;
  }

  static pdfExportOptions(): ExportOptionsDto {
    const dto = new ExportOptionsDto();
    dto.format = 'pdf';
    dto.includeMetadata = true;
    dto.fileIds = FileFixtures.generatedFileIds();
    
    // Créer un objet PdfOptions avec la méthode isValid
    const pdfOptions = {
      pageSize: 'A4' as const,
      margins: 20,
      includeTableOfContents: true,
      isValid: jest.fn().mockReturnValue(true)
    };
    
    dto.pdfOptions = pdfOptions;
    return dto;
  }

  static selectiveExportOptions(): ExportOptionsDto {
    const dto = new ExportOptionsDto();
    dto.format = 'markdown';
    dto.includeMetadata = false;
    dto.fileIds = [FileFixtures.generatedFileIds()[0], FileFixtures.generatedFileIds()[1]];
    return dto;
  }

  static exportResponseDto(): ExportResponseDto {
    const dto = new ExportResponseDto();
    dto.downloadUrl = "https://storage.example.com/exports/project-export-123.zip";
    dto.fileName = "application-ecommerce-export.zip";
    dto.fileSize = 2048576; // 2MB
    dto.format = "markdown";
    dto.expiresAt = DataGenerator.futureDate(7);
    return dto;
  }

  static pdfExportResponseDto(): ExportResponseDto {
    const dto = new ExportResponseDto();
    dto.downloadUrl = "https://storage.example.com/exports/project-export-456.pdf";
    dto.fileName = "application-ecommerce-docs.pdf";
    dto.fileSize = 5242880; // 5MB
    dto.format = "pdf";
    dto.expiresAt = DataGenerator.futureDate(3);
    return dto;
  }
}

// Builder pour construction fluente
export class ProjectBuilder {
  private project: Partial<ProjectEntity> = {};

  withName(name: string): ProjectBuilder {
    this.project.name = name;
    return this;
  }

  withDescription(description: string): ProjectBuilder {
    this.project.description = description;
    return this;
  }

  withStatus(status: ProjectStatus): ProjectBuilder {
    this.project.status = status;
    return this;
  }

  withFiles(uploaded: string[], generated: string[]): ProjectBuilder {
    this.project.uploadedFileIds = uploaded;
    this.project.generatedFileIds = generated;
    return this;
  }

  withOwner(ownerId: string): ProjectBuilder {
    this.project.ownerId = ownerId;
    return this;
  }

  withDates(created: Date, updated?: Date): ProjectBuilder {
    this.project.createdAt = created;
    this.project.updatedAt = updated || created;
    return this;
  }

  withStatistics(stats: ProjectStatisticsEntity): ProjectBuilder {
    this.project.statistics = stats;
    return this;
  }

  withId(id: string): ProjectBuilder {
    this.project.id = id;
    return this;
  }

  build(): ProjectEntity {
    const baseProject = ProjectFixtures.mockProject();
    return Object.assign(baseProject, this.project);
  }
}

// Utilitaires de validation
export class ValidationHelpers {
  static isValidCreateDto(dto: any): dto is CreateProjectDto {
    return dto &&
      typeof dto.name === 'string' &&
      dto.name.length >= TEST_CONSTANTS.VALID_PROJECT_NAME_LENGTH.min &&
      dto.name.length <= TEST_CONSTANTS.VALID_PROJECT_NAME_LENGTH.max &&
      typeof dto.initialPrompt === 'string' &&
      dto.initialPrompt.length >= TEST_CONSTANTS.VALID_PROMPT_LENGTH.min &&
      dto.initialPrompt.length <= TEST_CONSTANTS.VALID_PROMPT_LENGTH.max;
  }

  static isValidProjectEntity(entity: any): entity is ProjectEntity {
    return entity &&
      typeof entity.id === 'string' &&
      typeof entity.name === 'string' &&
      typeof entity.ownerId === 'string' &&
      Object.values(ProjectStatus).includes(entity.status) &&
      Array.isArray(entity.uploadedFileIds) &&
      Array.isArray(entity.generatedFileIds) &&
      entity.createdAt instanceof Date &&
      entity.updatedAt instanceof Date;
  }

  static hasRequiredFields(obj: any, fields: string[]): boolean {
    return fields.every(field => obj && obj.hasOwnProperty(field) && obj[field] !== undefined);
  }
}

// Helpers pour les tests
export class TestHelpers {
  static createPaginationDto(page: number = 1, limit: number = 10): PaginationDto {
    const dto = new PaginationDto();
    dto.page = page;
    dto.limit = limit;
    return dto;
  }

  static createMockUpdateDto(data: any = {}, mockMethods: any = {}): any {
    const mockDto = Object.create(UpdateProjectDto.prototype);
    
    Object.assign(mockDto, {
      name: data.name,
      description: data.description,
    });

    mockDto.hasValidUpdates = jest.fn().mockReturnValue(
      mockMethods.hasValidUpdates ??
      (data.name !== undefined || data.description !== undefined)
    );

    mockDto.getDefinedFields = jest.fn().mockReturnValue(
      mockMethods.getDefinedFields ??
      (() => {
        const fields: any = {};
        if (data.name !== undefined) fields.name = data.name;
        if (data.description !== undefined) fields.description = data.description;
        return fields;
      })()
    );

    mockDto.getUpdateFieldsCount = jest.fn().mockReturnValue(
      mockMethods.getUpdateFieldsCount ??
      Object.keys(mockDto.getDefinedFields()).length
    );

    mockDto.isValid = jest.fn().mockReturnValue(mockMethods.isValid ?? true);
    mockDto.isUpdatingName = jest.fn().mockReturnValue(data.name !== undefined);
    mockDto.isUpdatingDescription = jest.fn().mockReturnValue(data.description !== undefined);
    mockDto.isClearingDescription = jest.fn().mockReturnValue(data.description === '');

    return mockDto;
  }
}

// Export groupé pour usage simple
export const TestFixtures = {
  projects: ProjectFixtures,
  users: UserFixtures,
  statistics: StatisticsFixtures,
  files: FileFixtures,
  responses: ResponseFixtures,
  exports: ExportFixtures,
  constants: TEST_CONSTANTS,
  ids: TEST_IDS,
  generator: DataGenerator,
  validation: ValidationHelpers,
  helpers: TestHelpers
};

// Export de l'ensemble pour les tests complets
export const createTestDataSet = () => ({
  validUser: UserFixtures.validUser(),
  validProject: ProjectFixtures.mockProject(),
  completeStats: StatisticsFixtures.completeStats(),
  exportOptions: ExportFixtures.markdownExportOptions(),
  createDto: ProjectFixtures.validCreateDto(),
  updateDto: ProjectFixtures.validUpdateDto()
});

// Export de datasets spécialisés
export const createCompleteTestScenario = () => ({
  user: UserFixtures.validUser(),
  otherUser: UserFixtures.otherUser(),
  activeProject: ProjectFixtures.mockProject(),
  archivedProject: ProjectFixtures.archivedProject(),
  projectWithStats: ProjectFixtures.mockProjectWithStats(),
  paginatedProjects: ResponseFixtures.paginatedProjectsResponse(),
  exportOptions: ExportFixtures.pdfExportOptions()
});

export const createPerformanceTestData = () => ({
  user: UserFixtures.validUser(),
  largeProject: ProjectFixtures.largeProject(),
  multipleProjects: ProjectFixtures.projectsList(50),
  highCostStats: StatisticsFixtures.highCostStats(),
  largeFileList: FileFixtures.largeFileIdsList(100)
});

export const createSecurityTestData = () => ({
  validUser: UserFixtures.validUser(),
  unauthorizedUser: UserFixtures.otherUser(),
  adminUser: UserFixtures.adminUser(),
  userProject: ProjectFixtures.mockProject(),
  otherUserProject: ProjectFixtures.mockProject({ ownerId: UserFixtures.otherUser().id }),
  deletedProject: ProjectFixtures.deletedProject()
});