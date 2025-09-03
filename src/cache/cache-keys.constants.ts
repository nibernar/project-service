import { createHash } from 'crypto';
import { ProjectStatus } from '../common/enums/project-status.enum';

// ============================================================================
// TYPES POUR LES FILTRES ET OPTIONS DE CACHE
// ============================================================================

/**
 * Interface pour les filtres de liste de projets
 */
export interface ProjectListFilters {
  status?: ProjectStatus;
  createdAfter?: Date;
  createdBefore?: Date;
  hasFiles?: boolean;
  search?: string;
}

/**
 * Options pour la configuration du cache
 */
export interface CacheOptions {
  ttl?: number;
  compression?: boolean;
  serialization?: 'json' | 'msgpack';
}

/**
 * Type pour les fonctions de génération de clés dynamiques
 */
export type CacheKeyFunction<T extends unknown[] = unknown[]> = (...args: T) => string;

// ============================================================================
// CONSTANTES DE CLÉS DE CACHE
// ============================================================================

/**
 * Constantes centralisées pour toutes les clés de cache Redis
 * Format: <domain>:<entity>:<identifier>[:<metadata>]
 */
export const CACHE_KEYS = {
  // ----------------------------------------
  // PROJETS INDIVIDUELS
  // ----------------------------------------
  
  /**
   * Cache d'un projet individuel (sans statistiques)
   * Format: projects:project:{projectId}
   */
  PROJECT: (id: string): string => `projects:project:${id}`,
  
  /**
   * Cache d'un projet avec ses statistiques complètes
   * Format: projects:project-full:{projectId}
   */
  PROJECT_WITH_STATS: (id: string): string => `projects:project-full:${id}`,
  
  // ----------------------------------------
  // LISTES ET COLLECTIONS
  // ----------------------------------------
  
  /**
   * Cache des listes paginées de projets
   * Format: projects:list:{userId}:p{page}:l{limit}:{filtersHash}
   */
  PROJECT_LIST: (userId: string, page: number, limit: number, filters?: ProjectListFilters): string => {
    const filtersHash = filters ? CacheUtils.hashFilters(filters) : 'no-filters';
    return `projects:list:${userId}:p${page}:l${limit}:${filtersHash}`;
  },
  
  /**
   * Cache du nombre total de projets pour un utilisateur
   * Format: projects:count:{userId}:{filtersHash}
   */
  PROJECT_COUNT: (userId: string, filters?: ProjectListFilters): string => {
    const filtersHash = filters ? CacheUtils.hashFilters(filters) : 'no-filters';
    return `projects:count:${userId}:${filtersHash}`;
  },
  
  // ----------------------------------------
  // STATISTIQUES
  // ----------------------------------------
  
  /**
   * Cache des statistiques détaillées d'un projet
   * Format: stats:project:{projectId}
   */
  PROJECT_STATISTICS: (projectId: string): string => `stats:project:${projectId}`,
  
  /**
   * Cache du résumé des statistiques utilisateur
   * Format: stats:user-summary:{userId}
   */
  USER_STATISTICS_SUMMARY: (userId: string): string => `stats:user-summary:${userId}`,
  
  // ----------------------------------------
  // FICHIERS ET MÉTADONNÉES
  // ----------------------------------------
  
  /**
   * Cache des métadonnées d'un fichier
   * Format: files:metadata:{fileId}
   */
  FILE_METADATA: (fileId: string): string => `files:metadata:${fileId}`,
  
  /**
   * Cache de la liste des fichiers d'un projet
   * Format: files:project-list:{projectId}
   */
  PROJECT_FILES_LIST: (projectId: string): string => `files:project-list:${projectId}`,
  
  // ----------------------------------------
  // EXPORT ET GÉNÉRATION
  // ----------------------------------------
  
  /**
   * Cache du statut d'un export
   * Format: export:status:{exportId}
   */
  EXPORT_STATUS: (exportId: string): string => `export:status:${exportId}`,
  
  /**
   * Cache du résultat d'un export (URL, métadonnées)
   * Format: export:result:{exportId}
   */
  EXPORT_RESULT: (exportId: string): string => `export:result:${exportId}`,
  
  // ----------------------------------------
  // AUTHENTIFICATION ET SESSIONS
  // ----------------------------------------
  
  /**
   * Cache de validation d'un token JWT
   * Format: auth:token:{tokenHash}
   */
  TOKEN_VALIDATION: (tokenHash: string): string => `auth:token:${tokenHash}`,
  
  /**
   * Cache d'une session utilisateur
   * Format: auth:session:{userId}:{sessionId}
   */
  USER_SESSION: (userId: string, sessionId: string): string => `auth:session:${userId}:${sessionId}`,
  
  // ----------------------------------------
  // SYSTÈME ET UTILITAIRES
  // ----------------------------------------
  
  /**
   * Cache des résultats de health check
   * Format: system:health
   */
  HEALTH_CHECK: (): string => 'system:health',
  
  /**
   * Cache de la configuration du service
   * Format: system:config:{configKey}
   */
  SERVICE_CONFIG: (configKey: string): string => `system:config:${configKey}`,
  
  /**
   * Cache des locks pour opérations critiques
   * Format: locks:{operation}:{resourceId}
   */
  OPERATION_LOCK: (operation: string, resourceId: string): string => `locks:${operation}:${resourceId}`,
  
} as const;

// ============================================================================
// CONSTANTES DE TTL (TIME TO LIVE)
// ============================================================================

/**
 * Durées de vie (en secondes) pour chaque type de cache
 */
export const CACHE_TTL = {
  // ----------------------------------------
  // DONNÉES DE PROJETS
  // ----------------------------------------
  
  /** Projets individuels - 5 minutes */
  PROJECT: 300,
  
  /** Projets avec statistiques - 3 minutes (plus coûteux) */
  PROJECT_WITH_STATS: 180,
  
  /** Listes paginées - 1 minute */
  PROJECT_LIST: 60,
  
  /** Compteurs - 2 minutes */
  PROJECT_COUNT: 120,
  
  // ----------------------------------------
  // STATISTIQUES
  // ----------------------------------------
  
  /** Statistiques détaillées - 10 minutes */
  PROJECT_STATISTICS: 600,
  
  /** Résumés utilisateur - 5 minutes */
  USER_STATISTICS: 300,
  
  // ----------------------------------------
  // FICHIERS ET MÉTADONNÉES
  // ----------------------------------------
  
  /** Métadonnées de fichiers - 30 minutes */
  FILE_METADATA: 1800,
  
  /** Listes de fichiers - 5 minutes */
  FILES_LIST: 300,
  
  // ----------------------------------------
  // EXPORT ET TRAITEMENT
  // ----------------------------------------
  
  /** Statut d'export - 1 heure */
  EXPORT_STATUS: 3600,
  
  /** Résultats d'export - 2 heures */
  EXPORT_RESULT: 7200,
  
  // ----------------------------------------
  // AUTHENTIFICATION
  // ----------------------------------------
  
  /** Validation de tokens - 5 minutes */
  TOKEN_VALIDATION: 300,
  
  /** Sessions utilisateur - 30 minutes */
  USER_SESSION: 1800,
  
  // ----------------------------------------
  // SYSTÈME
  // ----------------------------------------
  
  /** Health checks - 30 secondes */
  HEALTH_CHECK: 30,
  
  /** Configuration service - 1 heure */
  SERVICE_CONFIG: 3600,
  
  /** Locks d'opération - 5 minutes */
  OPERATION_LOCK: 300,
  
} as const;

// ============================================================================
// PATTERNS DE CLÉS POUR INVALIDATION
// ============================================================================

/**
 * Patterns de clés pour invalidation par batch
 */
export const CACHE_PATTERNS = {
  /**
   * Pattern pour toutes les listes de projets d'un utilisateur
   * Format: projects:list:{userId}:*
   */
  USER_PROJECT_LISTS: (userId: string): string => `projects:list:${userId}:*`,
  
  /**
   * Pattern pour tous les compteurs de projets d'un utilisateur  
   * Format: projects:count:{userId}:*
   */
  USER_PROJECT_COUNTS: (userId: string): string => `projects:count:${userId}:*`,
  
  /**
   * Pattern pour tous les caches d'un projet (plus spécifique)
   * Format: projects:*:{projectId} + stats:project:{projectId} + files:*:{projectId}
   */
  PROJECT_ALL: (projectId: string): string[] => [
    `projects:*:${projectId}`,
    `stats:project:${projectId}`, 
    `files:*:${projectId}`,
  ],
  
  /**
   * Pattern pour toutes les sessions d'un utilisateur
   * Format: auth:session:{userId}:*
   */
  USER_SESSIONS: (userId: string): string => `auth:session:${userId}:*`,
  
  /**
   * Pattern pour tous les caches de statistiques
   * Format: stats:*
   */
  ALL_STATISTICS: (): string => 'stats:*',
  
  /**
   * Pattern pour tous les caches de fichiers
   * Format: files:*
   */
  ALL_FILES: (): string => 'files:*',
  
  /**
   * Pattern pour les exports expirés
   * Format: export:result:*
   */
  EXPIRED_EXPORTS: (): string => 'export:result:*',
} as const;

// ============================================================================
// UTILITAIRES POUR LA GESTION DES CLÉS
// ============================================================================

/**
 * Utilitaires pour la génération et manipulation des clés de cache
 */
export const CacheUtils = {
  /**
   * Génère un hash consistant pour les filtres de projet
   */
  hashFilters: (filters: ProjectListFilters): string => {
    // Normalise les filtres pour avoir un hash consistant
    const normalized = {
      status: filters.status || null,
      createdAfter: filters.createdAfter?.toISOString() || null,
      createdBefore: filters.createdBefore?.toISOString() || null,
      hasFiles: filters.hasFiles !== undefined ? filters.hasFiles : null,
      search: filters.search?.trim().toLowerCase() || null,
    };
    
    // Crée une chaîne déterministe à partir des filtres
    const filterString = JSON.stringify(normalized, Object.keys(normalized).sort());
    
    // Génère un hash court mais unique
    return createHash('md5').update(filterString).digest('hex').substring(0, 8);
  },
  
  /**
   * Génère un hash anonymisé pour un token
   */
  hashToken: (token: string): string => {
    return createHash('sha256').update(token).digest('hex').substring(0, 16);
  },
  
  /**
   * Valide qu'une clé Redis respecte les contraintes
   */
  validateKey: (key: string): boolean => {
    // Redis keys ne doivent pas dépasser 512 MB, mais en pratique on limite à 250 chars
    if (key.length > 250) return false;
    
    // Vérifie qu'il n'y a pas de caractères problématiques
    if (key.includes(' ') || key.includes('\n') || key.includes('\r')) return false;
    
    // Vérifie le format général
    return /^[a-zA-Z0-9:_-]+$/.test(key);
  },
  
  /**
   * Génère une clé de lock pour une opération critique
   */
  lockKey: (operation: string, resourceId: string): string => {
    return CACHE_KEYS.OPERATION_LOCK(operation, resourceId);
  },
  
  /**
   * Génère une clé de version pour invalidation globale
   */
  versionKey: (domain: string): string => {
    return `version:${domain}`;
  },
  
  /**
   * Ajoute un préfixe d'environnement si configuré
   */
  withEnvironmentPrefix: (key: string): string => {
    const prefix = process.env.REDIS_KEY_PREFIX;
    return prefix ? `${prefix}:${key}` : key;
  },
  
  /**
   * Extrait l'ID d'une ressource à partir d'une clé
   */
  extractResourceId: (key: string, pattern: string): string | null => {
    // Remplace les wildcards par des groupes de capture
    const regexPattern = pattern.replace(/\*/g, '([^:]+)');
    const match = key.match(new RegExp(regexPattern));
    return match ? match[1] : null;
  },
  
} as const;

// ============================================================================
// PROFILS DE CACHE PAR ENVIRONNEMENT
// ============================================================================

/**
 * Configuration des TTL par environnement
 */
export const CACHE_PROFILES = {
  development: {
    PROJECT: 60,              // 1 minute en dev
    PROJECT_LIST: 30,         // 30 secondes en dev
    PROJECT_STATISTICS: 120,  // 2 minutes en dev
    EXPORT_RESULT: 300,       // 5 minutes en dev
  },
  
  production: {
    PROJECT: 300,             // 5 minutes en prod
    PROJECT_LIST: 60,         // 1 minute en prod
    PROJECT_STATISTICS: 600,  // 10 minutes en prod
    EXPORT_RESULT: 7200,      // 2 heures en prod
  },
  
  test: {
    PROJECT: 5,               // 5 secondes en test
    PROJECT_LIST: 5,          // 5 secondes en test
    PROJECT_STATISTICS: 10,   // 10 secondes en test
    EXPORT_RESULT: 30,        // 30 secondes en test
  },
} as const;

// ============================================================================
// TYPES DÉRIVÉS
// ============================================================================

/**
 * Type union de toutes les clés de cache possibles
 */
export type CacheKeyType = keyof typeof CACHE_KEYS;

/**
 * Type union de toutes les durées TTL possibles
 */
export type CacheTTLType = keyof typeof CACHE_TTL;

/**
 * Type pour les profils d'environnement
 */
export type CacheProfile = keyof typeof CACHE_PROFILES;

// ============================================================================
// CONFIGURATION PAR DÉFAUT
// ============================================================================

/**
 * Configuration par défaut du cache
 */
export const DEFAULT_CACHE_CONFIG = {
  /** TTL par défaut si non spécifié */
  DEFAULT_TTL: 300,
  
  /** Longueur maximale des clés Redis */
  MAX_KEY_LENGTH: 250,
  
  /** Taille minimale pour activer la compression */
  COMPRESSION_THRESHOLD: 1024,
  
  /** Version par défaut pour invalidation globale */
  CACHE_VERSION: '1.0.0',
  
  /** Préfixe par défaut */
  DEFAULT_PREFIX: 'project-service',
} as const;

// ============================================================================
// EXPORTS POUR FACILITER L'UTILISATION
// ============================================================================

/**
 * Export des constantes principales pour faciliter l'import
 */
export {
  CACHE_KEYS as Keys,
  CACHE_TTL as TTL,
  CACHE_PATTERNS as Patterns,
  CacheUtils as Utils,
};

// Les types sont déjà exportés directement dans leurs définitions ci-dessus