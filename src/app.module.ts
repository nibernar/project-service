// src/app.module.ts

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { cacheConfig } from './config/cache.config';
import { CacheModule } from './cache/cache.module';

// Import des configurations
import { appConfig } from './config/app.config';
import { databaseConfig } from './config/database.config';

// Import du DatabaseModule
import { DatabaseModule } from './database/database.module';

@Module({
  imports: [
    // Configuration globale
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, cacheConfig],
      envFilePath: ['.env.development', '.env'],
    }),

    DatabaseModule,
    CacheModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}