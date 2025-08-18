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

// Import du CommonModule (AuthGuard, decorators, etc.)
import { CommonModule } from './common/common.module';

// Import du EventsModule (stub temporaire)
import { EventsModule } from './events/events.module';

// Import du ProjectModule (module principal)
import { ProjectModule } from './project/project.module';

@Module({
  imports: [
    // Configuration globale
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, cacheConfig],
      envFilePath: ['.env.development', '.env'],
    }),

    // Modules d'infrastructure
    DatabaseModule,
    CacheModule,

    // Modules de support
    CommonModule, // AuthGuard, decorators, utilitaires communs
    EventsModule, // Publication d'événements métier (stub temporaire)

    // Modules métier
    ProjectModule, // Gestion des projets (CRUD + logique métier)
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
