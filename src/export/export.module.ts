import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';

// Import des modules globaux nécessaires
import { DatabaseModule } from '../database/database.module';
import { CacheModule } from '../cache/cache.module';

// Import du contrôleur principal
import { ExportController } from './export.controller';

// Import du service principal d'orchestration
import { ExportService } from './export.service';

// Import des services spécialisés
import { FileRetrievalService } from './services/file-retrieval.service';
import { MarkdownExportService } from './services/markdown-export.service';
import { PdfExportService } from './services/pdf-export.service';

/**
 * Module Export pour la gestion des exports de projets
 * 
 * Responsabilités :
 * - Export des documents générés vers différents formats (Markdown, PDF)
 * - Récupération des fichiers depuis le service de stockage
 * - Conversion PDF via Pandoc avec options personnalisées
 * - Gestion des téléchargements temporaires avec URLs signées
 * - Validation des permissions et accès aux projets
 * - Suivi asynchrone des exports longs
 * 
 * Architecture :
 * - ExportController : Exposition de l'API REST
 * - ExportService : Orchestrateur principal des workflows d'export
 * - FileRetrievalService : Interface avec le service de stockage
 * - MarkdownExportService : Export Markdown natif avec agrégation
 * - PdfExportService : Conversion via Pandoc avec gestion des templates
 * 
 * Dépendances externes :
 * - DatabaseModule : Accès aux données projet pour validation
 * - CacheModule : Cache des exports et statuts de progression
 * - HttpModule : Communication avec le service de stockage externe
 * - ConfigModule : Configuration Pandoc et stockage temporaire
 */
@Module({
  imports: [
    // Module HTTP pour communication avec services externes
    HttpModule.registerAsync({
      useFactory: () => ({
        timeout: 30000, // 30 secondes pour récupération fichiers
        maxRedirects: 3,
        retries: 3,
        retryDelay: (retryCount: number) => Math.pow(2, retryCount) * 1000, // Backoff exponentiel
      }),
    }),

    // Module de configuration pour les paramètres d'export
    ConfigModule,

    // Modules globaux (déjà importés globalement mais référencés pour clarté)
    DatabaseModule,
    CacheModule,
  ],

  // Contrôleurs exposés par ce module
  controllers: [
    ExportController,
  ],

  // Services fournis par ce module
  providers: [
    // Service principal d'orchestration des exports
    ExportService,

    // Services spécialisés pour chaque aspect de l'export
    FileRetrievalService,
    MarkdownExportService,
    PdfExportService,
  ],

  // Services exportés pour utilisation par d'autres modules
  exports: [
    // Export du service principal pour usage externe si nécessaire
    // (par exemple, pour des exports déclenchés par des jobs batch)
    ExportService,
  ],
})
export class ExportModule {
  /**
   * Constructeur du module Export
   * 
   * Note : Le module est conçu pour être autonome avec toutes ses dépendances
   * clairement définies. Les services spécialisés ne sont pas exportés car
   * ils sont destinés à un usage interne au module uniquement.
   */
}