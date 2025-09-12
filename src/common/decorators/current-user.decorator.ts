/**
 * Décorateur pour injecter l'utilisateur actuel dans les paramètres de méthode
 *
 * @fileoverview Décorateur d'injection utilisateur pour les contrôleurs
 * @version 1.0.0
 * @since 2025-01-28
 */

import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { User } from '../interfaces/user.interface';

/**
 * Décorateur pour extraire l'utilisateur actuel du contexte de requête
 *
 * Utilisé après l'AuthGuard pour récupérer les informations utilisateur
 * injectées dans le contexte.
 *
 * @example
 * ```typescript
 * @Get('profile')
 * @UseGuards(AuthGuard)
 * async getProfile(@CurrentUser() user: User) {
 *   return { message: `Hello ${user.email}` };
 * }
 * ```
 */
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): User => {
    const request = ctx.switchToHttp().getRequest<FastifyRequest>();

    const user = (request as any).user;

    if (!user) {
      // Fallback pour le développement - utilisateur factice avec UUID valide
      if (process.env.NODE_ENV === 'development') {
        const devUser: User = {
          id: '24d87fc1-aa88-4e4f-add7-aaf132d2fb5b',
          email: 'dev@example.com',
          roles: ['user']
        };
        
        console.log('⚠️ Using development fallback user:', devUser.email);
        return devUser;
      }

      throw new Error(
        'User not found in request context. Make sure AuthGuard is applied.',
      );
    }

    return user;
  },
);