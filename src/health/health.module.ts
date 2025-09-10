import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { DatabaseModule } from '../database/database.module';
import { CacheModule } from '../cache/cache.module';

@Module({
  imports: [
    // HttpModule pour les appels aux services externes
    HttpModule.register({
      timeout: 10000, // 10 secondes de timeout par défaut pour les health checks externes
      maxRedirects: 2,
    }),
    // DatabaseModule pour accès à la base de données
    DatabaseModule,
    // CacheModule pour accès au cache Redis
    CacheModule,
  ],
  controllers: [HealthController],
  providers: [HealthService],
  exports: [HealthService], // Exporter pour utilisation dans d'autres modules si nécessaire
})
export class HealthModule {}