// src/database/database.module.ts
import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseService } from './database.service';
import { databaseConfig } from '../config/database.config';

@Global()
@Module({
  imports: [
    ConfigModule,
    ConfigModule.forFeature(databaseConfig)
  ],
  providers: [DatabaseService],
  exports: [DatabaseService],
})
export class DatabaseModule {}