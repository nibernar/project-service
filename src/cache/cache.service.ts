// src/cache/cache.service.ts
import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import * as zlib from 'zlib';
import { promisify } from 'util';
import { 
  CACHE_KEYS, 
  CACHE_TTL, 
  CACHE_PATTERNS, 
  CacheUtils,
  ProjectListFilters,
  CacheOptions,
  DEFAULT_CACHE_CONFIG
} from './cache-keys.constants';

// ============================================================================
// INTERFACES ET TYPES
// ============================================================================

interface CacheStats {
  connections: {
    active: number;
    idle: number;
  };
  operations: {
    hits: number;
    misses: number;
    sets: number;
    deletes: number;
    errors: number;
  };
  performance: {
    avgLatency: number;
    maxLatency: number;
    opsPerSecond: number;
  };
  memory: {
    used: number;
    peak: number;
    fragmentation: number;
  };
}

interface SerializationOptions {
  compress?: boolean;
  encoding?: 'json' | 'msgpack';
}

interface CacheServiceOptions {
  compression: {
    enabled: boolean;
    threshold: number;
    algorithm: 'gzip' | 'deflate';
  };
  serialization: {
    default: 'json';
    binary: boolean;
  };
  performance: {
    maxRetries: number;
    retryDelay: number;
    timeout: number;
  };
  monitoring: {
    enabled: boolean;
    sampleRate: number;
  };
}

// ============================================================================
// SERVICE PRINCIPAL
// ============================================================================

@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private readonly gzipAsync = promisify(zlib.gzip);
  private readonly gunzipAsync = promisify(zlib.gunzip);
  
  // Métriques en mémoire
  private stats = {
    operations: { hits: 0, misses: 0, sets: 0, deletes: 0, errors: 0 },
    performance: { totalLatency: 0, operationCount: 0, maxLatency: 0 }
  };

  private readonly options: CacheServiceOptions;

  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly configService: ConfigService,
  ) {
    this.options = {
      compression: {
        enabled: this.configService.get('CACHE_COMPRESSION_ENABLED', true),
        threshold: this.configService.get('CACHE_COMPRESSION_THRESHOLD', DEFAULT_CACHE_CONFIG.COMPRESSION_THRESHOLD),
        algorithm: this.configService.get('CACHE_COMPRESSION_ALGORITHM', 'gzip'),
      },
      serialization: {
        default: 'json',
        binary: false,
      },
      performance: {
        maxRetries: this.configService.get('CACHE_MAX_RETRIES', 3),
        retryDelay: this.configService.get('CACHE_RETRY_DELAY', 100),
        timeout: this.configService.get('CACHE_TIMEOUT', 5000),
      },
      monitoring: {
        enabled: this.configService.get('CACHE_MONITORING_ENABLED', true),
        sampleRate: this.configService.get('CACHE_MONITORING_SAMPLE_RATE', 1),
      },
    };
  }

  async onModuleInit() {
    this.logger.log('CacheService initialized');
    this.logger.debug('Cache configuration:', this.options);
    
    // Test de connexion initial
    const isConnected = await this.healthCheck();
    if (!isConnected) {
      this.logger.warn('Initial Redis connection test failed');
    }
  }

  async onModuleDestroy() {
    this.logger.log('CacheService shutting down');
    await this.disconnect();
  }

  // ============================================================================
  // OPÉRATIONS DE BASE
  // ============================================================================

  /**
   * Récupère une valeur depuis le cache
   */
  async get<T>(key: string, options?: CacheOptions): Promise<T | null> {
    const startTime = Date.now();
    
    try {
      if (!CacheUtils.validateKey(key)) {
        this.logger.warn(`Invalid cache key: ${key}`);
        return null;
      }

      const fullKey = this.getFullKey(key);
      const rawValue = await this.redis.get(fullKey);
      
      if (rawValue === null) {
        this.updateStats('miss', Date.now() - startTime);
        return null;
      }

      const serializationOptions: SerializationOptions = {
        compress: options?.compression,
        encoding: 'json'
      };
      const value = await this.deserialize<T>(rawValue, serializationOptions);
      this.updateStats('hit', Date.now() - startTime);
      
      return value;
    } catch (error) {
      this.updateStats('error', Date.now() - startTime);
      this.logger.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Stocke une valeur dans le cache
   */
  async set<T>(key: string, value: T, ttl?: number, options?: CacheOptions): Promise<boolean> {
    const startTime = Date.now();
    
    try {
      if (!CacheUtils.validateKey(key)) {
        this.logger.warn(`Invalid cache key: ${key}`);
        return false;
      }

      const finalTtl = ttl || DEFAULT_CACHE_CONFIG.DEFAULT_TTL;
      const fullKey = this.getFullKey(key);
      const serializationOptions: SerializationOptions = {
        compress: options?.compression,
        encoding: 'json'
      };
      const serializedValue = await this.serialize(value, serializationOptions);

      await this.redis.setex(fullKey, finalTtl, serializedValue);
      
      this.updateStats('set', Date.now() - startTime);
      return true;
    } catch (error) {
      this.updateStats('error', Date.now() - startTime);
      this.logger.error(`Cache set error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Supprime une ou plusieurs clés du cache
   */
  async del(key: string | string[]): Promise<number> {
    const startTime = Date.now();
    
    try {
      const keys = Array.isArray(key) ? key : [key];
      if (keys.length === 0) return 0;

      const validKeys = keys.filter(k => CacheUtils.validateKey(k));
      if (validKeys.length !== keys.length) {
        this.logger.warn(`Some invalid keys filtered out: ${keys.length - validKeys.length} keys`);
      }

      if (validKeys.length === 0) return 0;

      const fullKeys = validKeys.map(k => this.getFullKey(k));
      const result = await this.redis.del(...fullKeys);
      
      this.updateStats('delete', Date.now() - startTime);
      return result;
    } catch (error) {
      this.updateStats('error', Date.now() - startTime);
      this.logger.error('Cache delete error:', error);
      return 0;
    }
  }

  // ============================================================================
  // OPÉRATIONS AVANCÉES
  // ============================================================================

  /**
   * Récupère plusieurs valeurs en une seule opération
   */
  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    const startTime = Date.now();
    
    try {
      const validKeys = keys.filter(k => CacheUtils.validateKey(k));
      if (validKeys.length === 0) return [];

      const fullKeys = validKeys.map(k => this.getFullKey(k));
      const rawValues = await this.redis.mget(...fullKeys);
      
      const results = await Promise.all(
        rawValues.map(async (rawValue, index) => {
          if (rawValue === null) return null;
          try {
            return await this.deserialize<T>(rawValue);
          } catch (error) {
            this.logger.warn(`Deserialization error for key ${validKeys[index]}:`, error);
            return null;
          }
        })
      );

      const hits = results.filter(r => r !== null).length;
      const misses = results.length - hits;
      
      this.stats.operations.hits += hits;
      this.stats.operations.misses += misses;
      this.updateStats('performance', Date.now() - startTime);

      return results;
    } catch (error) {
      this.updateStats('error', Date.now() - startTime);
      this.logger.error('Cache mget error:', error);
      return keys.map(() => null);
    }
  }

  /**
   * Stocke plusieurs valeurs en une seule transaction
   */
  async mset(entries: Array<[string, any, number?]>): Promise<boolean> {
    const startTime = Date.now();
    
    try {
      if (entries.length === 0) return true;

      const pipeline = this.redis.pipeline();
      
      for (const [key, value, ttl] of entries) {
        if (!CacheUtils.validateKey(key)) {
          this.logger.warn(`Skipping invalid key: ${key}`);
          continue;
        }

        const fullKey = this.getFullKey(key);
        const serializedValue = await this.serialize(value);
        const finalTtl = ttl || DEFAULT_CACHE_CONFIG.DEFAULT_TTL;
        
        pipeline.setex(fullKey, finalTtl, serializedValue);
      }

      const results = await pipeline.exec();
      const success = results?.every(([err]) => err === null) ?? false;
      
      this.updateStats('set', Date.now() - startTime);
      return success;
    } catch (error) {
      this.updateStats('error', Date.now() - startTime);
      this.logger.error('Cache mset error:', error);
      return false;
    }
  }

  /**
   * Vérifie l'existence d'une clé
   */
  async exists(key: string): Promise<boolean> {
    try {
      if (!CacheUtils.validateKey(key)) return false;
      
      const fullKey = this.getFullKey(key);
      const result = await this.redis.exists(fullKey);
      return result === 1;
    } catch (error) {
      this.logger.error(`Cache exists error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Définit une nouvelle expiration pour une clé
   */
  async expire(key: string, ttl: number): Promise<boolean> {
    try {
      if (!CacheUtils.validateKey(key)) return false;
      
      const fullKey = this.getFullKey(key);
      const result = await this.redis.expire(fullKey, ttl);
      return result === 1;
    } catch (error) {
      this.logger.error(`Cache expire error for key ${key}:`, error);
      return false;
    }
  }

  // ============================================================================
  // OPÉRATIONS AVEC PATTERNS
  // ============================================================================

  /**
   * Récupère toutes les clés correspondant à un pattern
   */
  async keys(pattern: string): Promise<string[]> {
    try {
      const fullPattern = this.getFullKey(pattern);
      const keys = await this.redis.keys(fullPattern);
      
      // Retire le préfixe des clés retournées
      const prefix = this.getKeyPrefix();
      return keys.map(key => key.startsWith(prefix) ? key.slice(prefix.length) : key);
    } catch (error) {
      this.logger.error(`Cache keys error for pattern ${pattern}:`, error);
      return [];
    }
  }

  /**
   * Supprime toutes les clés correspondant à un pattern
   */
  async deleteByPattern(pattern: string): Promise<number> {
    try {
      const keys = await this.keys(pattern);
      if (keys.length === 0) return 0;
      
      return await this.del(keys);
    } catch (error) {
      this.logger.error(`Cache deleteByPattern error for pattern ${pattern}:`, error);
      return 0;
    }
  }

  // ============================================================================
  // SYSTÈME DE LOCKS DISTRIBUÉS
  // ============================================================================

  /**
   * Acquiert un lock distribué
   */
  async acquireLock(operation: string, resourceId: string, ttl: number = CACHE_TTL.OPERATION_LOCK): Promise<string | null> {
    try {
      const lockKey = CacheUtils.lockKey(operation, resourceId);
      const lockValue = this.generateLockValue();
      
      const result = await this.redis.set(
        this.getFullKey(lockKey),
        lockValue,
        'PX', ttl * 1000, // TTL en millisecondes
        'NX' // Seulement si la clé n'existe pas
      );

      if (result === 'OK') {
        this.logger.debug(`Lock acquired: ${lockKey} = ${lockValue}`);
        return lockValue;
      }
      
      return null;
    } catch (error) {
      this.logger.error(`Lock acquisition error for ${operation}:${resourceId}:`, error);
      return null;
    }
  }

  /**
   * Libère un lock distribué
   */
  async releaseLock(operation: string, resourceId: string, lockValue: string): Promise<boolean> {
    try {
      const lockKey = CacheUtils.lockKey(operation, resourceId);
      
      // Script Lua pour libération atomique
      const luaScript = `
        if redis.call("GET", KEYS[1]) == ARGV[1] then
          return redis.call("DEL", KEYS[1])
        else
          return 0
        end
      `;
      
      const result = await this.redis.eval(
        luaScript,
        1,
        this.getFullKey(lockKey),
        lockValue
      ) as number;

      const success = result === 1;
      if (success) {
        this.logger.debug(`Lock released: ${lockKey}`);
      } else {
        this.logger.warn(`Lock release failed - not owner or expired: ${lockKey}`);
      }
      
      return success;
    } catch (error) {
      this.logger.error(`Lock release error for ${operation}:${resourceId}:`, error);
      return false;
    }
  }

  /**
   * Vérifie si une ressource est verrouillée
   */
  async isLocked(operation: string, resourceId: string): Promise<boolean> {
    try {
      const lockKey = CacheUtils.lockKey(operation, resourceId);
      return await this.exists(lockKey);
    } catch (error) {
      this.logger.error(`Lock check error for ${operation}:${resourceId}:`, error);
      return false;
    }
  }

  // ============================================================================
  // INVALIDATION SPÉCIALISÉE
  // ============================================================================

  /**
   * Invalide tous les caches liés à un projet
   */
  async invalidateProjectCache(projectId: string, userId: string): Promise<void> {
    try {
      const keysToDelete = [
        CACHE_KEYS.PROJECT(projectId),
        CACHE_KEYS.PROJECT_WITH_STATS(projectId),
        CACHE_KEYS.PROJECT_STATISTICS(projectId),
        CACHE_KEYS.PROJECT_FILES_LIST(projectId),
      ];

      // Invalide les listes utilisateur avec patterns
      const userListsDeleted = await this.deleteByPattern(CACHE_PATTERNS.USER_PROJECTS(userId));
      
      // Supprime les clés individuelles
      const individualDeleted = await this.del(keysToDelete);
      
      this.logger.debug(`Project cache invalidated: ${projectId}, deleted ${individualDeleted + userListsDeleted} keys`);
    } catch (error) {
      this.logger.error(`Project cache invalidation error for ${projectId}:`, error);
    }
  }

  /**
   * Invalide tous les caches des projets d'un utilisateur
   */
  async invalidateUserProjectsCache(userId: string): Promise<void> {
    try {
      const patterns = [
        CACHE_PATTERNS.USER_PROJECTS(userId),
        CACHE_PATTERNS.USER_SESSIONS(userId),
      ];

      let totalDeleted = 0;
      for (const pattern of patterns) {
        const deleted = await this.deleteByPattern(pattern);
        totalDeleted += deleted;
      }

      // Invalide aussi le résumé des statistiques utilisateur
      await this.del(CACHE_KEYS.USER_STATISTICS_SUMMARY(userId));
      totalDeleted += 1;

      this.logger.debug(`User projects cache invalidated: ${userId}, deleted ${totalDeleted} keys`);
    } catch (error) {
      this.logger.error(`User projects cache invalidation error for ${userId}:`, error);
    }
  }

  /**
   * Invalide les caches de statistiques
   */
  async invalidateStatisticsCache(projectId?: string): Promise<void> {
    try {
      if (projectId) {
        // Invalide les statistiques d'un projet spécifique
        await this.del([
          CACHE_KEYS.PROJECT_STATISTICS(projectId),
          CACHE_KEYS.PROJECT_WITH_STATS(projectId),
        ]);
        this.logger.debug(`Statistics cache invalidated for project: ${projectId}`);
      } else {
        // Invalide toutes les statistiques
        const deleted = await this.deleteByPattern(CACHE_PATTERNS.ALL_STATISTICS());
        this.logger.debug(`All statistics cache invalidated, deleted ${deleted} keys`);
      }
    } catch (error) {
      this.logger.error(`Statistics cache invalidation error:`, error);
    }
  }

  // ============================================================================
  // MÉTHODES UTILITAIRES POUR LES CLÉS TYPÉES
  // ============================================================================

  getProjectKey(projectId: string): string {
    return CACHE_KEYS.PROJECT(projectId);
  }

  getProjectWithStatsKey(projectId: string): string {
    return CACHE_KEYS.PROJECT_WITH_STATS(projectId);
  }

  getProjectListKey(userId: string, page: number, limit: number, filters?: ProjectListFilters): string {
    return CACHE_KEYS.PROJECT_LIST(userId, page, limit, filters);
  }

  getProjectCountKey(userId: string, filters?: ProjectListFilters): string {
    return CACHE_KEYS.PROJECT_COUNT(userId, filters);
  }

  getProjectStatisticsKey(projectId: string): string {
    return CACHE_KEYS.PROJECT_STATISTICS(projectId);
  }

  getUserStatisticsSummaryKey(userId: string): string {
    return CACHE_KEYS.USER_STATISTICS_SUMMARY(userId);
  }

  getFileMetadataKey(fileId: string): string {
    return CACHE_KEYS.FILE_METADATA(fileId);
  }

  getProjectFilesListKey(projectId: string): string {
    return CACHE_KEYS.PROJECT_FILES_LIST(projectId);
  }

  getExportStatusKey(exportId: string): string {
    return CACHE_KEYS.EXPORT_STATUS(exportId);
  }

  getExportResultKey(exportId: string): string {
    return CACHE_KEYS.EXPORT_RESULT(exportId);
  }

  getTokenValidationKey(token: string): string {
    return CACHE_KEYS.TOKEN_VALIDATION(CacheUtils.hashToken(token));
  }

  getUserSessionKey(userId: string, sessionId: string): string {
    return CACHE_KEYS.USER_SESSION(userId, sessionId);
  }

  // ============================================================================
  // MONITORING ET STATISTIQUES
  // ============================================================================

  /**
   * Récupère les statistiques du cache
   */
  async getStats(): Promise<CacheStats> {
    try {
      const info = await this.redis.info();
      const infoLines = info.split('\r\n');
      
      const getInfoValue = (key: string): number => {
        const line = infoLines.find(line => line.startsWith(key));
        return line ? parseInt(line.split(':')[1]) || 0 : 0;
      };

      const avgLatency = this.stats.performance.operationCount > 0 
        ? this.stats.performance.totalLatency / this.stats.performance.operationCount 
        : 0;

      return {
        connections: {
          active: getInfoValue('connected_clients'),
          idle: getInfoValue('blocked_clients'),
        },
        operations: { ...this.stats.operations },
        performance: {
          avgLatency: Math.round(avgLatency * 100) / 100,
          maxLatency: this.stats.performance.maxLatency,
          opsPerSecond: this.calculateOpsPerSecond(),
        },
        memory: {
          used: getInfoValue('used_memory'),
          peak: getInfoValue('used_memory_peak'),
          fragmentation: getInfoValue('mem_fragmentation_ratio') / 100,
        },
      };
    } catch (error) {
      this.logger.error('Failed to get cache stats:', error);
      return this.getEmptyStats();
    }
  }

  /**
   * Vérifie la santé de Redis
   */
  async healthCheck(): Promise<boolean> {
    try {
      const start = Date.now();
      const result = await this.redis.ping();
      const latency = Date.now() - start;
      
      if (result !== 'PONG') {
        this.logger.warn('Redis ping returned unexpected result:', result);
        return false;
      }

      if (latency > 1000) {
        this.logger.warn(`Redis ping latency high: ${latency}ms`);
      }

      return true;
    } catch (error) {
      this.logger.error('Redis health check failed:', error);
      return false;
    }
  }

  // ============================================================================
  // MÉTHODES PRIVÉES - SÉRIALISATION
  // ============================================================================

  private async serialize<T>(value: T, options?: SerializationOptions): Promise<string> {
    try {
      let serialized = JSON.stringify(value);
      
      if (this.shouldCompress(serialized, options)) {
        const compressed = await this.gzipAsync(Buffer.from(serialized, 'utf-8'));
        return `gzip:${compressed.toString('base64')}`;
      }
      
      return serialized;
    } catch (error) {
      this.logger.error('Serialization error:', error);
      throw error;
    }
  }

  private async deserialize<T>(data: string, options?: SerializationOptions): Promise<T> {
    try {
      if (data.startsWith('gzip:')) {
        const compressedData = Buffer.from(data.slice(5), 'base64');
        const decompressed = await this.gunzipAsync(compressedData);
        return JSON.parse(decompressed.toString('utf-8'));
      }
      
      return JSON.parse(data);
    } catch (error) {
      this.logger.error('Deserialization error:', error);
      throw error;
    }
  }

  private shouldCompress(data: string, options?: SerializationOptions): boolean {
    if (options?.compress === false) return false;
    if (options?.compress === true) return true;
    
    return this.options.compression.enabled && 
           data.length >= this.options.compression.threshold;
  }

  // ============================================================================
  // MÉTHODES PRIVÉES - UTILITAIRES
  // ============================================================================

  private getFullKey(key: string): string {
    return CacheUtils.withEnvironmentPrefix(key);
  }

  private getKeyPrefix(): string {
    const prefix = process.env.REDIS_KEY_PREFIX;
    return prefix ? `${prefix}:` : '';
  }

  private generateLockValue(): string {
    return `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  private updateStats(operation: 'hit' | 'miss' | 'set' | 'delete' | 'error' | 'performance', latency: number): void {
    if (!this.options.monitoring.enabled) return;

    if (operation === 'performance') {
      this.stats.performance.totalLatency += latency;
      this.stats.performance.operationCount += 1;
      this.stats.performance.maxLatency = Math.max(this.stats.performance.maxLatency, latency);
    } else {
      // Mapping des opérations vers les noms de propriétés au pluriel
      const operationMap = {
        'hit': 'hits',
        'miss': 'misses', 
        'set': 'sets',
        'delete': 'deletes',
        'error': 'errors'
      } as const;
      
      const statKey = operationMap[operation];
      this.stats.operations[statKey] += 1;
    }
  }

  private calculateOpsPerSecond(): number {
    // Calcul basique - pourrait être amélioré avec une fenêtre glissante
    const totalOps = Object.values(this.stats.operations).reduce((sum, count) => sum + count, 0);
    const uptimeSeconds = process.uptime();
    return uptimeSeconds > 0 ? Math.round(totalOps / uptimeSeconds) : 0;
  }

  private getEmptyStats(): CacheStats {
    return {
      connections: { active: 0, idle: 0 },
      operations: { hits: 0, misses: 0, sets: 0, deletes: 0, errors: 0 },
      performance: { avgLatency: 0, maxLatency: 0, opsPerSecond: 0 },
      memory: { used: 0, peak: 0, fragmentation: 0 },
    };
  }

  /**
   * Ferme la connexion Redis (utile pour les tests)
   */
  async disconnect(): Promise<void> {
    try {
      await this.redis.quit();
      this.logger.log('Redis connection closed');
    } catch (error) {
      this.logger.error('Error closing Redis connection:', error);
    }
  }
}