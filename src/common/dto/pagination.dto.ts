import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Constantes de pagination pour maintenir la cohérence
 */
export const PAGINATION_CONSTANTS = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 100,
  MIN_PAGE: 1,
  MIN_LIMIT: 1,
} as const;

/**
 * DTO standardisé pour les paramètres de pagination
 *
 * Utilisé dans tous les endpoints retournant des listes paginées.
 * Valide automatiquement les paramètres de requête et applique
 * les valeurs par défaut appropriées.
 *
 * @example
 * ```typescript
 * @Get()
 * async findAll(@Query() pagination: PaginationDto) {
 *   return this.service.findAll(pagination);
 * }
 * ```
 */
export class PaginationDto {
  /**
   * Numéro de la page demandée (base 1)
   *
   * @example 1, 2, 3...
   * @default 1
   */
  @ApiPropertyOptional({
    description: 'Numéro de la page demandée (base 1)',
    minimum: PAGINATION_CONSTANTS.MIN_PAGE,
    default: PAGINATION_CONSTANTS.DEFAULT_PAGE,
    example: 1,
    type: 'integer',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page must be an integer' })
  @Min(PAGINATION_CONSTANTS.MIN_PAGE, {
    message: `page must be at least ${PAGINATION_CONSTANTS.MIN_PAGE}`,
  })
  page?: number = PAGINATION_CONSTANTS.DEFAULT_PAGE;

  /**
   * Nombre d'éléments par page
   *
   * @example 10, 20, 50...
   * @default 10
   * @maximum 100
   */
  @ApiPropertyOptional({
    description: "Nombre d'éléments par page",
    minimum: PAGINATION_CONSTANTS.MIN_LIMIT,
    maximum: PAGINATION_CONSTANTS.MAX_LIMIT,
    default: PAGINATION_CONSTANTS.DEFAULT_LIMIT,
    example: 10,
    type: 'integer',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit must be an integer' })
  @Min(PAGINATION_CONSTANTS.MIN_LIMIT, {
    message: `limit must be at least ${PAGINATION_CONSTANTS.MIN_LIMIT}`,
  })
  @Max(PAGINATION_CONSTANTS.MAX_LIMIT, {
    message: `limit must not be greater than ${PAGINATION_CONSTANTS.MAX_LIMIT}`,
  })
  limit?: number = PAGINATION_CONSTANTS.DEFAULT_LIMIT;

  /**
   * Calcule l'offset pour les requêtes base de données
   *
   * @returns Nombre d'éléments à ignorer (skip)
   * @example
   * ```typescript
   * const pagination = new PaginationDto();
   * pagination.page = 3;
   * pagination.limit = 20;
   * console.log(pagination.getSkip()); // 40
   * ```
   */
  getSkip(): number {
    const currentPage = this.page ?? PAGINATION_CONSTANTS.DEFAULT_PAGE;
    const currentLimit = this.limit ?? PAGINATION_CONSTANTS.DEFAULT_LIMIT;
    return (currentPage - 1) * currentLimit;
  }

  /**
   * Retourne le nombre d'éléments à prendre
   *
   * @returns Nombre d'éléments à récupérer (take)
   * @example
   * ```typescript
   * const pagination = new PaginationDto();
   * pagination.limit = 25;
   * console.log(pagination.getTake()); // 25
   * ```
   */
  getTake(): number {
    return this.limit ?? PAGINATION_CONSTANTS.DEFAULT_LIMIT;
  }

  /**
   * Valide que la pagination est dans des limites raisonnables
   *
   * @returns true si la pagination est valide
   */
  isValid(): boolean {
    const currentPage = this.page ?? PAGINATION_CONSTANTS.DEFAULT_PAGE;
    const currentLimit = this.limit ?? PAGINATION_CONSTANTS.DEFAULT_LIMIT;

    return (
      currentPage >= PAGINATION_CONSTANTS.MIN_PAGE &&
      currentLimit >= PAGINATION_CONSTANTS.MIN_LIMIT &&
      currentLimit <= PAGINATION_CONSTANTS.MAX_LIMIT
    );
  }

  /**
   * Retourne une représentation string de la pagination pour le logging
   *
   * @returns Chaîne descriptive de la pagination
   */
  toString(): string {
    const currentPage = this.page ?? PAGINATION_CONSTANTS.DEFAULT_PAGE;
    const currentLimit = this.limit ?? PAGINATION_CONSTANTS.DEFAULT_LIMIT;
    return `page=${currentPage}, limit=${currentLimit}, skip=${this.getSkip()}`;
  }
}
