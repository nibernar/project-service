// src/cache/cache.module.ts
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisModule } from '@nestjs-modules/ioredis';
import type { RedisModuleOptions } from '@nestjs-modules/ioredis';
import { getCacheConfig } from '../config/cache.config';
import { CacheService } from './cache.service';

@Global()
@Module({
  imports: [
    RedisModule.forRootAsync({
      useFactory: (configService: ConfigService): RedisModuleOptions => {
        const cacheConfig = getCacheConfig(configService);
        
        // Conversion vers le format attendu par @nestjs-modules/ioredis
        const redisModuleOptions: RedisModuleOptions = {
          type: 'single',
          options: {
            host: cacheConfig.connection.host,
            port: cacheConfig.connection.port,
            password: cacheConfig.connection.password,
            username: cacheConfig.connection.username,
            db: cacheConfig.connection.db,
            family: cacheConfig.connection.family,
            connectTimeout: cacheConfig.connection.connectTimeout,
            lazyConnect: cacheConfig.connection.lazyConnect,
            keepAlive: cacheConfig.connection.keepAlive,
            commandTimeout: cacheConfig.performance.commandTimeout,
            maxRetriesPerRequest: cacheConfig.retry.maxRetriesPerRequest,
            enableReadyCheck: cacheConfig.retry.enableReadyCheck,
            keyPrefix: cacheConfig.serialization.keyPrefix,
          },
        };

        // Configuration TLS si activée
        if (cacheConfig.security.enableTLS && redisModuleOptions.options) {
          redisModuleOptions.options.tls = {
            rejectUnauthorized: cacheConfig.security.tlsRejectUnauthorized,
            ca: cacheConfig.security.tlsCa,
            cert: cacheConfig.security.tlsCert,
            key: cacheConfig.security.tlsKey,
          };
        }

        return redisModuleOptions;
      },
      inject: [ConfigService],
    }),
  ],
  providers: [CacheService],
  exports: [CacheService],
})
export class CacheModule {}