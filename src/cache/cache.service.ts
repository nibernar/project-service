// src/cache/cache.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { CACHE_KEYS, CACHE_TTL, getCacheConfig } from '../config/cache.config';

@Injectable()
export class CacheService {
  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Le module @nestjs-modules/ioredis applique automatiquement le préfixe configuré
   * Donc on retourne la clé telle quelle
   */
  private getFullKey(key: string): string {
    return key;
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const fullKey = this.getFullKey(key);
      const value = await this.redis.get(fullKey);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      const cacheConfig = getCacheConfig(this.configService);
      const finalTtl = ttl !== undefined ? ttl : cacheConfig.performance.defaultTtl;
      const fullKey = this.getFullKey(key);
      
      await this.redis.setex(fullKey, finalTtl, JSON.stringify(value));
    } catch (error) {
      console.error(`Cache set error for key ${key}:`, error);
    }
  }

  async del(key: string | string[]): Promise<void> {
    try {
      if (Array.isArray(key)) {
        if (key.length > 0) {
          const fullKeys = key.map(k => this.getFullKey(k));
          await this.redis.del(...fullKeys);
        }
      } else {
        const fullKey = this.getFullKey(key);
        await this.redis.del(fullKey);
      }
    } catch (error) {
      console.error(`Cache delete error:`, error);
    }
  }

  async invalidateProjectCache(projectId: string, userId: string): Promise<void> {
    try {
      const keys = [
        CACHE_KEYS.PROJECT(projectId),
        CACHE_KEYS.PROJECT_STATISTICS(projectId),
        CACHE_KEYS.USER_PROJECTS_COUNT(userId),
      ];
      
      // Invalider aussi les listes de projets de l'utilisateur
      // Pour keys(), nous devons inclure le préfixe manuellement
      const prefix = this.getKeyPrefix();
      const listPattern = `${prefix}projects:${userId}:*`;
      
      const listKeys = await this.redis.keys(listPattern);
      
      // Enlever le préfixe des clés trouvées car del() applique automatiquement le préfixe
      const listKeysWithoutPrefix = listKeys.map(key => key.replace(prefix, ''));
      
      const allKeysToDelete = [...keys, ...listKeysWithoutPrefix];
      
      await this.del(allKeysToDelete);
    } catch (error) {
      console.error(`Cache delete error:`, error);
    }
  }

  async invalidateUserProjectsCache(userId: string): Promise<void> {
    try {
      // Rechercher toutes les clés de liste pour cet utilisateur
      // Pour keys(), nous devons inclure le préfixe manuellement
      const prefix = this.getKeyPrefix();
      const listPattern = `${prefix}projects:${userId}:*`;
      const keys = await this.redis.keys(listPattern);
      
      // Enlever le préfixe des clés trouvées car del() applique automatiquement le préfixe
      const keysWithoutPrefix = keys.map(key => key.replace(prefix, ''));
      
      if (keysWithoutPrefix.length > 0) {
        await this.del(keysWithoutPrefix);
      }
    } catch (error) {
      console.error(`Cache delete error:`, error);
    }
  }

  /**
   * Méthodes utilitaires pour construire les clés de cache
   */
  getProjectKey(projectId: string): string {
    return CACHE_KEYS.PROJECT(projectId);
  }

  getProjectListKey(userId: string, page: number, limit: number): string {
    return CACHE_KEYS.PROJECT_LIST(userId, page, limit);
  }

  getProjectStatisticsKey(projectId: string): string {
    return CACHE_KEYS.PROJECT_STATISTICS(projectId);
  }

  getUserProjectsCountKey(userId: string): string {
    return CACHE_KEYS.USER_PROJECTS_COUNT(userId);
  }

  /**
   * Récupère le préfixe des clés depuis la configuration
   */
  getKeyPrefix(): string {
    const cacheConfig = getCacheConfig(this.configService);
    return cacheConfig.serialization.keyPrefix;
  }

  /**
   * Vérifie si Redis est connecté
   */
  async isConnected(): Promise<boolean> {
    try {
      const result = await this.redis.ping();
      return result === 'PONG';
    } catch (error) {
      console.error('Redis connection check failed:', error);
      return false;
    }
  }

  /**
   * Récupère des informations sur Redis
   */
  async getInfo(): Promise<string> {
    try {
      return await this.redis.info();
    } catch (error) {
      console.error('Redis info failed:', error);
      return '';
    }
  }

  /**
   * Ferme la connexion Redis (utile pour les tests)
   */
  async disconnect(): Promise<void> {
    try {
      await this.redis.quit();
    } catch (error) {
      console.error('Error closing Redis connection:', error);
    }
  }
}