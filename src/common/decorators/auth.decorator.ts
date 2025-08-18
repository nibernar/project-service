import { applyDecorators, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiUnauthorizedResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
} from '@nestjs/swagger';
import { AuthGuard } from '../guards/auth.guard';

/**
 * Métadonnées pour la réflexion et l'extensibilité future
 */
export const AUTH_METADATA_KEY = 'custom-auth';

/**
 * Options de configuration pour le décorateur Auth (extensibilité future)
 */
export interface AuthDecoratorOptions {
  /**
   * Indique si la vérification d'expiration du token peut être ignorée
   * @default false
   */
  skipExpiredCheck?: boolean;

  /**
   * Rôles autorisés pour accéder à la ressource (fonctionnalité future)
   * @default undefined
   */
  allowedRoles?: string[];

  /**
   * Indique si l'authentification est optionnelle
   * @default false
   */
  optional?: boolean;
}

/**
 * Schéma de réponse d'erreur d'authentification pour Swagger
 */
const UNAUTHORIZED_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    statusCode: {
      type: 'number',
      example: 401,
      description: 'Code de statut HTTP',
    },
    message: {
      type: 'string',
      example: 'Unauthorized',
      description: "Message d'erreur",
    },
    error: {
      type: 'string',
      example: 'Unauthorized',
      description: "Type d'erreur",
    },
    timestamp: {
      type: 'string',
      example: '2024-01-15T10:30:00.000Z',
      description: "Horodatage de l'erreur",
    },
    path: {
      type: 'string',
      example: '/api/v1/projects',
      description: 'Chemin de la requête',
    },
  },
  required: ['statusCode', 'message', 'error', 'timestamp', 'path'],
};

/**
 * Schéma de réponse d'erreur de service indisponible pour Swagger
 */
const SERVICE_UNAVAILABLE_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    statusCode: {
      type: 'number',
      example: 503,
      description: 'Code de statut HTTP',
    },
    message: {
      type: 'string',
      example: 'Authentication service unavailable',
      description: "Message d'erreur",
    },
    error: {
      type: 'string',
      example: 'Service Unavailable',
      description: "Type d'erreur",
    },
  },
  required: ['statusCode', 'message', 'error'],
};

/**
 * Décorateur composite d'authentification
 *
 * Combine automatiquement :
 * - La validation JWT via AuthGuard
 * - La documentation Swagger pour l'authentification Bearer
 * - Les réponses d'erreur standardisées
 *
 * @param options - Options de configuration (optionnel, pour extensibilité future)
 *
 * @example
 * // Usage basique sur une méthode
 * @Get()
 * @Auth()
 * async findAll(@CurrentUser() user: User) {
 *   // user est automatiquement injecté par AuthGuard
 *   // Logique métier avec accès à user.id, user.email, user.roles
 * }
 *
 * @example
 * // Usage sur une classe entière
 * @Controller('projects')
 * @Auth()
 * export class ProjectController {
 *   // Toutes les méthodes héritent de l'authentification
 * }
 *
 * @example
 * // Combinaison avec d'autres guards
 * @Get(':id')
 * @Auth()
 * @UseGuards(ProjectOwnerGuard)
 * async findOne(@Param('id') id: string, @CurrentUser() user: User) {
 *   // AuthGuard s'exécute en premier, puis ProjectOwnerGuard
 * }
 */
export const Auth = (
  options?: AuthDecoratorOptions,
): MethodDecorator & ClassDecorator => {
  // Pour l'extensibilité future, on peut stocker les options dans les métadonnées
  const decorators: Array<
    ClassDecorator | MethodDecorator | PropertyDecorator
  > = [
    // Application du guard d'authentification JWT
    UseGuards(AuthGuard),

    // Documentation Swagger pour l'authentification Bearer
    ApiBearerAuth('JWT-auth'),

    // Documentation de la réponse d'erreur 401
    ApiUnauthorizedResponse({
      description:
        'Authentication required. Valid JWT token must be provided in Authorization header.',
      schema: UNAUTHORIZED_RESPONSE_SCHEMA,
    }),

    // Documentation de la réponse d'erreur 503 (service d'authentification indisponible)
    ApiServiceUnavailableResponse({
      description:
        'Authentication service temporarily unavailable. Please retry in a few moments.',
      schema: SERVICE_UNAVAILABLE_RESPONSE_SCHEMA,
    }),
  ];

  // Si des options sont fournies, on peut les traiter ici (extensibilité future)
  if (options) {
    // Stockage des métadonnées pour usage futur
    // Reflect.defineMetadata(AUTH_METADATA_KEY, options, target);

    // Exemple d'extension future : authentification optionnelle
    if (options.optional) {
      // Logique pour authentification optionnelle
      // (à implémenter avec un guard spécialisé)
    }

    // Exemple d'extension future : rôles spécifiques
    if (options.allowedRoles && options.allowedRoles.length > 0) {
      // Logique pour vérification de rôles
      // (à implémenter avec un guard spécialisé)
    }
  }

  return applyDecorators(...decorators);
};

/**
 * Décorateur d'authentification avec indication explicite de l'opération API
 * Utile pour une documentation Swagger plus détaillée
 *
 * @param summary - Résumé de l'opération pour Swagger
 * @param options - Options de configuration du décorateur Auth
 *
 * @example
 * @Get()
 * @AuthWithOperation('Get all user projects')
 * async findAll(@CurrentUser() user: User) {
 *   // Logique métier
 * }
 */
export const AuthWithOperation = (
  summary: string,
  options?: AuthDecoratorOptions,
): MethodDecorator => {
  return applyDecorators(ApiOperation({ summary }), Auth(options));
};

/**
 * Décorateur d'authentification pour les opérations d'administration
 * Pré-configuré avec une documentation appropriée
 *
 * @example
 * @Get('admin/stats')
 * @AdminAuth()
 * async getAdminStats(@CurrentUser() user: User) {
 *   // Logique d'administration
 * }
 */
export const AdminAuth = (): MethodDecorator & ClassDecorator => {
  return applyDecorators(
    Auth(),
    ApiOperation({
      summary: 'Administrative operation - requires authentication',
      description:
        'This endpoint requires valid authentication and appropriate permissions.',
    }),
  );
};
