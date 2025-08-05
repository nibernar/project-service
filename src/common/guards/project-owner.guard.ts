/**
 * Guard de vérification de propriété des projets
 * 
 * Ce guard vérifie que l'utilisateur authentifié est le propriétaire légitime
 * du projet identifié dans les paramètres de route. Il assure l'isolation des
 * données entre utilisateurs et maintient un audit des accès.
 * 
 * Responsabilités :
 * - Extraction et validation de l'ID du projet depuis les paramètres de route
 * - Vérification de la propriété en base de données avec cache intelligent
 * - Gestion gracieuse des erreurs avec messages appropriés
 * - Audit de sécurité et monitoring des performances
 * 
 * @fileoverview Guard de vérification de propriété des projets
 * @version 1.0.0
 * @since 2025-01-28
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  BadRequestException,
  InternalServerErrorException,
  Logger,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FastifyRequest } from 'fastify';

import { DatabaseService } from '../../database/database.service';
import { CacheService } from '../../cache/cache.service';
import { User, isValidUser } from '../interfaces/user.interface';
import { ProjectStatus } from '../enums/project-status.enum';
import { 
  ProjectNotFoundException, 
  UnauthorizedAccessException,
  InvalidOperationException 
} from '../exceptions';

/**
 * Interface pour les options de configuration du guard
 */
interface ProjectOwnerOptions {
  /** Ignorer le cache Redis pour cette vérification */
  skipCache?: boolean;
  /** Autoriser l'accès aux projets archivés */
  allowArchived?: boolean;
  /** Autoriser l'accès en lecture seule */
  readOnly?: boolean;
}

/**
 * Interface pour les métriques d'audit
 */
interface OwnershipAuditMetrics {
  event: 'ownership_check';
  success: boolean;
  projectId: string;
  userId?: string;
  userEmail?: string;
  timestamp: string;
  cacheHit?: boolean;
  checkDuration?: number;
  error?: string;
  projectStatus?: string;
}

/**
 * Configuration par défaut du guard
 */
const DEFAULT_CONFIG = {
  cachePrefix: 'project_owner:',
  cacheTTL: 300, // 5 minutes
  maxRetries: 3,
  retryDelay: 100, // ms
} as const;

/**
 * Guard de vérification de propriété des projets
 * 
 * S'exécute après l'AuthGuard pour vérifier que l'utilisateur authentifié
 * est propriétaire du projet ciblé par la requête.
 */
@Injectable()
export class ProjectOwnerGuard implements CanActivate {
  private readonly logger = new Logger(ProjectOwnerGuard.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly cacheService: CacheService,
    private readonly reflector: Reflector,
  ) {
    this.logger.log('ProjectOwnerGuard initialized');
  }

  /**
   * Point d'entrée principal du guard NestJS
   * 
   * @param context - Contexte d'exécution de la requête
   * @returns Promise<boolean> - true si l'utilisateur est propriétaire
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const startTime = Date.now();
    let projectId = '';
    let user: User | undefined;
    let cacheHit = false;

    try {
      // Lecture des options de configuration depuis les métadonnées
      const options = this.getGuardOptions(context);
      
      // Extraction de la requête HTTP
      const request = this.getRequest(context);
      
      // Extraction et validation de l'ID du projet
      projectId = this.extractProjectId(request);
      
      // Extraction des informations utilisateur
      user = this.extractUser(request);
      
      // Vérification de la propriété avec cache intelligent
      const ownership = await this.checkProjectOwnership(projectId, user.id, options);
      cacheHit = ownership.cacheHit;
      
      if (!ownership.isOwner) {
        await this.auditOwnershipCheck(
          projectId, false, user, undefined, cacheHit, 
          Date.now() - startTime, 'Access denied'
        );
        throw new UnauthorizedAccessException();
      }

      // Audit de la vérification réussie
      await this.auditOwnershipCheck(
        projectId, true, user, ownership.projectStatus, 
        cacheHit, Date.now() - startTime
      );

      return true;

    } catch (error) {
      // Audit de la vérification échouée
      await this.auditOwnershipCheck(
        projectId, false, user, undefined, cacheHit, 
        Date.now() - startTime, (error as Error).message
      );
      
      // Gestion des erreurs avec re-throw approprié
      this.handleOwnershipError(error, 'canActivate');
      return false; // Ne devrait jamais être atteint
    }
  }

  /**
   * Extraction de l'objet request du contexte d'exécution
   * 
   * @param context - Contexte d'exécution
   * @returns L'objet request Fastify
   */
  private getRequest(context: ExecutionContext): FastifyRequest {
    const contextType = context.getType<'http' | 'ws'>();
    
    if (contextType !== 'http') {
      throw new InternalServerErrorException('ProjectOwnerGuard only supports HTTP context');
    }
    
    return context.switchToHttp().getRequest<FastifyRequest>();
  }

  /**
   * Extraction et validation de l'ID du projet depuis les paramètres de route
   * 
   * @param request - Objet request Fastify
   * @returns ID du projet validé
   * @throws InvalidOperationException si l'ID est manquant ou invalide
   */
  private extractProjectId(request: FastifyRequest): string {
    try {
      const params = (request as any).params || {};
      const projectId = params.id;
      
      if (!projectId) {
        this.logger.warn('Project ID parameter is missing from route');
        throw new InvalidOperationException('Project ID is required');
      }
      
      if (typeof projectId !== 'string') {
        this.logger.warn('Project ID parameter is not a string');
        throw new InvalidOperationException('Project ID must be a string');
      }
      
      // Validation du format UUID
      if (!this.isValidUUID(projectId)) {
        this.logger.warn(`Invalid UUID format for project ID: ${projectId}`);
        throw new InvalidOperationException('Project ID must be a valid UUID');
      }
      
      return projectId;
      
    } catch (error) {
      if (error instanceof InvalidOperationException) {
        throw error;
      }
      
      this.logger.error('Unexpected error extracting project ID', error);
      throw new InvalidOperationException('Failed to extract project ID');
    }
  }

  /**
   * Validation simple d'UUID sans dépendance externe
   * 
   * @param str - Chaîne à valider
   * @returns true si c'est un UUID valide
   */
  private isValidUUID(str: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  }

  /**
   * Extraction des informations utilisateur depuis le contexte de requête
   * 
   * @param request - Objet request contenant les données utilisateur
   * @returns Objet utilisateur validé
   * @throws InvalidOperationException si l'utilisateur n'est pas présent ou invalide
   */
  private extractUser(request: FastifyRequest): User {
    try {
      const user = (request as any).user;
      
      if (!user) {
        this.logger.error('User not found in request context - AuthGuard may not be applied');
        throw new InvalidOperationException('User authentication required');
      }
      
      // Validation de la structure de l'utilisateur
      if (!isValidUser(user)) {
        this.logger.error('Invalid user object in request context', { user });
        throw new InvalidOperationException('Invalid user data');
      }
      
      return user as User;
      
    } catch (error) {
      if (error instanceof InvalidOperationException) {
        throw error;
      }
      
      this.logger.error('Unexpected error extracting user', error);
      throw new InvalidOperationException('Failed to extract user information');
    }
  }

  /**
   * Vérification en base de données que le projet appartient à l'utilisateur
   * 
   * @param projectId - ID du projet à vérifier
   * @param userId - ID de l'utilisateur propriétaire présumé
   * @param options - Options de configuration du guard
   * @returns Résultat de la vérification avec métadonnées
   */
  private async checkProjectOwnership(
    projectId: string, 
    userId: string, 
    options: ProjectOwnerOptions = {}
  ): Promise<{
    isOwner: boolean;
    cacheHit: boolean;
    projectStatus?: ProjectStatus;
  }> {
    try {
      // Vérification du cache si activée
      if (!options.skipCache) {
        const cachedResult = await this.getCachedOwnership(projectId, userId);
        if (cachedResult) {
          this.logger.debug(`Cache hit for ownership check: ${projectId}`);
          return {
            isOwner: cachedResult.isOwner,
            cacheHit: true,
            projectStatus: cachedResult.projectStatus,
          };
        }
      }
      
      // Requête en base de données
      const project = await this.databaseService.executeWithRetry(async () => {
        return await this.databaseService.project.findFirst({
          where: {
            id: projectId,
            ownerId: userId,
            // Exclure les projets supprimés sauf si explicitement autorisé
            status: options.allowArchived ? 
              { not: ProjectStatus.DELETED } : 
              ProjectStatus.ACTIVE,
          },
          select: {
            id: true,
            ownerId: true,
            status: true,
          },
        });
      });
      
      if (!project) {
        // Vérifier si le projet existe mais n'appartient pas à l'utilisateur
        const projectExists = await this.databaseService.executeWithRetry(async () => {
          return await this.databaseService.project.findFirst({
            where: { id: projectId, status: { not: ProjectStatus.DELETED } },
            select: { id: true },
          });
        });
        
        if (!projectExists) {
          throw new ProjectNotFoundException(projectId);
        }
        
        // Le projet existe mais l'utilisateur n'en est pas propriétaire
        const result = { isOwner: false, cacheHit: false };
        
        // Cache du résultat négatif pour éviter les répétitions d'attaques
        if (!options.skipCache) {
          await this.cacheOwnership(projectId, userId, result.isOwner, undefined);
        }
        
        return result;
      }
      
      // Projet trouvé et utilisateur propriétaire
      const result = {
        isOwner: true,
        cacheHit: false,
        projectStatus: project.status as ProjectStatus,
      };
      
      // Mise en cache du résultat positif
      if (!options.skipCache) {
        await this.cacheOwnership(projectId, userId, result.isOwner, result.projectStatus);
      }
      
      return result;
      
    } catch (error) {
      if (error instanceof ProjectNotFoundException || 
          error instanceof UnauthorizedAccessException) {
        throw error;
      }
      
      this.logger.error(`Database error during ownership check for project ${projectId}`, error);
      throw new InternalServerErrorException('Database error occurred while checking project ownership');
    }
  }

  /**
   * Récupération d'une vérification de propriété depuis le cache
   * 
   * @param projectId - ID du projet
   * @param userId - ID de l'utilisateur
   * @returns Résultat en cache ou undefined
   */
  private async getCachedOwnership(
    projectId: string, 
    userId: string
  ): Promise<{ isOwner: boolean; projectStatus?: ProjectStatus } | undefined> {
    try {
      const cacheKey = this.buildCacheKey(projectId, userId);
      const cachedData = await this.cacheService.get<{
        isOwner: boolean;
        projectStatus?: ProjectStatus;
        timestamp: number;
      }>(cacheKey);
      
      if (cachedData && typeof cachedData.isOwner === 'boolean') {
        // Vérification de la fraîcheur (optionnelle)
        const age = Date.now() - cachedData.timestamp;
        if (age < DEFAULT_CONFIG.cacheTTL * 1000) {
          return {
            isOwner: cachedData.isOwner,
            projectStatus: cachedData.projectStatus,
          };
        }
      }
      
      return undefined;
      
    } catch (error) {
      this.logger.warn('Cache retrieval failed for ownership check', error);
      return undefined;
    }
  }

  /**
   * Mise en cache d'une vérification de propriété
   * 
   * @param projectId - ID du projet
   * @param userId - ID de l'utilisateur
   * @param isOwner - Résultat de la vérification
   * @param projectStatus - Statut du projet (si trouvé)
   */
  private async cacheOwnership(
    projectId: string,
    userId: string,
    isOwner: boolean,
    projectStatus?: ProjectStatus
  ): Promise<void> {
    try {
      const cacheKey = this.buildCacheKey(projectId, userId);
      const cacheData = {
        isOwner,
        projectStatus,
        timestamp: Date.now(),
      };
      
      // TTL plus court pour les résultats négatifs (anti-flooding)
      const ttl = isOwner ? DEFAULT_CONFIG.cacheTTL : 60; // 1 minute pour les échecs
      
      await this.cacheService.set(cacheKey, cacheData, ttl);
      
    } catch (error) {
      // Cache non critique - on log mais on ne bloque pas
      this.logger.warn('Failed to cache ownership verification', error);
    }
  }

  /**
   * Lecture des options de configuration depuis les métadonnées du handler
   * 
   * @param context - Contexte d'exécution
   * @returns Options de configuration ou valeurs par défaut
   */
  private getGuardOptions(context: ExecutionContext): ProjectOwnerOptions {
    const options = this.reflector.get<ProjectOwnerOptions>(
      'projectOwnerOptions', 
      context.getHandler()
    );
    
    return options || {};
  }

  /**
   * Audit des vérifications de propriété pour la sécurité et le monitoring
   * 
   * @param projectId - ID du projet vérifié
   * @param success - Succès ou échec de la vérification
   * @param user - Utilisateur (si disponible)
   * @param projectStatus - Statut du projet (si trouvé)
   * @param cacheHit - Indicateur de cache hit
   * @param duration - Durée de vérification en ms
   * @param error - Message d'erreur (si échec)
   */
  private async auditOwnershipCheck(
    projectId: string,
    success: boolean,
    user?: User,
    projectStatus?: ProjectStatus,
    cacheHit?: boolean,
    duration?: number,
    error?: string
  ): Promise<void> {
    try {
      const auditData: OwnershipAuditMetrics = {
        event: 'ownership_check',
        success,
        projectId,
        userId: user?.id,
        userEmail: user?.email,
        timestamp: new Date().toISOString(),
        cacheHit,
        checkDuration: duration,
        projectStatus,
        error,
      };

      if (success) {
        this.logger.log(`✅ Ownership verified for project ${projectId} by user ${user?.email}`, auditData);
      } else {
        this.logger.warn(`❌ Ownership check failed for project ${projectId}: ${error}`, auditData);
      }

      // TODO: Optionnellement envoyer vers un service d'audit externe
      // await this.auditService.logSecurityEvent(auditData);

    } catch (auditError) {
      // L'audit ne doit jamais bloquer la vérification
      this.logger.error('Audit logging failed for ownership check', auditError);
    }
  }

  /**
   * Gestion centralisée des erreurs de vérification de propriété
   * 
   * @param error - Erreur à traiter
   * @param context - Contexte où l'erreur s'est produite
   */
  private handleOwnershipError(error: any, context: string): never {
    // Classification et transformation des erreurs
    if (error instanceof InvalidOperationException ||
        error instanceof ProjectNotFoundException ||
        error instanceof UnauthorizedAccessException ||
        error instanceof InternalServerErrorException) {
      throw error;
    }

    // Erreurs inattendues
    this.logger.error(`Unexpected ownership verification error in ${context}`, error);
    
    // Ne pas leak d'informations sensibles
    throw new InternalServerErrorException('Ownership verification failed');
  }

  /**
   * Construction de la clé de cache pour la vérification de propriété
   * 
   * @param projectId - ID du projet
   * @param userId - ID de l'utilisateur
   * @returns Clé de cache structurée
   */
  private buildCacheKey(projectId: string, userId: string): string {
    return `${DEFAULT_CONFIG.cachePrefix}${projectId}:${userId}`;
  }
}

/**
 * Décorateur pour configurer les options du ProjectOwnerGuard
 * 
 * @param options - Options de configuration
 * @returns Décorateur de métadonnées
 * 
 * @example
 * ```typescript
 * @Get(':id')
 * @UseGuards(AuthGuard, ProjectOwnerGuard)
 * @ProjectOwnerCheck({ allowArchived: true, skipCache: false })
 * async getProject(@Param('id') id: string) {
 *   // Accès autorisé aux projets archivés
 * }
 * ```
 */
export const ProjectOwnerCheck = (options: ProjectOwnerOptions = {}) =>
  SetMetadata('projectOwnerOptions', options);