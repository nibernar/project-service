// src/common/interfaces/paginated-result.interface.ts

/**
 * Interface générique pour les résultats paginés
 */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
  hasPrevious: boolean;
}