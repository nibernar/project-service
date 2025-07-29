// src/app.module.ts

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';

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
      load: [appConfig, databaseConfig],
      envFilePath: ['.env.development', '.env'],
    }),
    
    // Database module (global)
    DatabaseModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}