import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { StatisticsController } from './statistics.controller';
import { StatisticsService } from './statistics.service';
import { StatisticsRepository } from './statistics.repository';
import { DatabaseModule } from '../database/database.module';
import { CacheModule } from '../cache/cache.module';
import { EventsModule } from '../events/events.module';

/**
 * Module de gestion des statistiques de projets
 * 
 * RESPONSABILITÉS :
 * - Réception des statistiques depuis les services externes
 * - Stockage et agrégation des métriques
 * - Exposition des données pour consultation
 * - Cache des statistiques fréquemment consultées
 * - Validation et enrichissement des données
 * 
 * ARCHITECTURE :
 * - StatisticsController : API REST (interne + utilisateur)
 * - StatisticsService : Logique métier et orchestration
 * - StatisticsRepository : Accès données avec requêtes JSON optimisées
 * - Cache Redis : Performance des consultations
 * - Events : Publication des changements de statistiques
 * 
 * INTÉGRATIONS :
 * - Service de Coûts : Réception des métriques financières
 * - Service de Monitoring : Réception des métriques de performance  
 * - Service d'Orchestration : Réception des métriques de génération
 * - Service de Processing : Réception des métriques de traitement
 */
@Module({
  imports: [
    // Modules d'infrastructure requis
    DatabaseModule,     // Accès PostgreSQL via Prisma
    CacheModule,        // Cache Redis pour performance
    EventsModule,       // Publication d'événements de changement
    HttpModule.register({
      // Configuration pour les appels HTTP aux services externes
      timeout: 5000,
      maxRedirects: 2,
      // Headers par défaut pour l'authentification inter-services
      headers: {
        'User-Agent': 'project-service-statistics/1.0.0',
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    }),
  ],
  controllers: [
    StatisticsController, // API REST dual : service interne + utilisateur final
  ],
  providers: [
    StatisticsService,    // Service métier principal
    StatisticsRepository, // Repository avec requêtes JSON optimisées
    
    // Configuration pour l'injection de dépendances
    {
      provide: 'STATISTICS_CONFIG',
      useValue: {
        // Configuration du cache
        cache: {
          ttl: {
            project: 300,    // 5 minutes pour les stats projet
            global: 600,     // 10 minutes pour les stats globales
            summary: 60,     // 1 minute pour les résumés
          },
          keys: {
            prefix: 'stats',
            project: (id: string) => `stats:project:${id}`,
            global: 'stats:global',
            search: (hash: string) => `stats:search:${hash}`,
          },
        },
        
        // Configuration de la validation
        validation: {
          maxDataAge: 24 * 60 * 60 * 1000, // 24h en ms
          maxFutureTime: 5 * 60 * 1000,    // 5 min en ms
          requiredFields: ['source', 'timestamp'],
          costThresholds: {
            maxPerDocument: 50.0,  // $50 max par document
            maxTotal: 1000.0,      // $1000 max par projet
          },
          performanceThresholds: {
            maxTimePerDocument: 3600, // 1h max par document
            maxTotalTime: 86400,      // 24h max par projet
          },
        },
        
        // Configuration des services externes
        externalServices: {
          costTracking: {
            baseUrl: process.env.COST_TRACKING_SERVICE_URL || 'http://localhost:3002',
            endpoints: {
              validate: '/api/v1/costs/validate',
              breakdown: '/api/v1/costs/breakdown',
            },
          },
          monitoring: {
            baseUrl: process.env.MONITORING_SERVICE_URL || 'http://localhost:3003',
            endpoints: {
              metrics: '/api/v1/metrics',
              health: '/health',
            },
          },
        },
        
        // Configuration des alertes
        alerting: {
          enabled: process.env.NODE_ENV === 'production',
          thresholds: {
            dataQualityMin: 70,    // Score de qualité minimum
            freshnessMaxHours: 6,  // Fraîcheur maximum des données
            costIncreasePercent: 50, // Alerte si coût augmente de +50%
          },
          channels: {
            email: process.env.ALERT_EMAIL_ENABLED === 'true',
            slack: process.env.ALERT_SLACK_ENABLED === 'true',
            webhook: process.env.ALERT_WEBHOOK_URL,
          },
        },
        
        // Configuration du nettoyage automatique
        cleanup: {
          enabled: true,
          schedule: '0 2 * * *', // Tous les jours à 2h du matin
          retentionDays: {
            active: 365,    // 1 an pour projets actifs
            archived: 90,   // 3 mois pour projets archivés  
            deleted: 30,    // 1 mois pour projets supprimés
          },
          batchSize: 1000,  // Nombre d'enregistrements par batch
        },
        
        // Configuration des métriques et monitoring
        metrics: {
          enabled: true,
          collectInterval: 60000, // 1 minute
          retentionPeriod: 7 * 24 * 60 * 60 * 1000, // 7 jours
          exportPrometheus: process.env.PROMETHEUS_ENABLED === 'true',
        },
      },
    },
    
    // Provider pour les utilitaires de statistiques
    {
      provide: 'STATISTICS_UTILS',
      useValue: {
        // Fonctions utilitaires pour les calculs
        calculateEfficiency: (costs: any, performance: any, usage: any) => {
          // Logique de calcul d'efficacité globale
          const costEff = costs?.total && usage?.documentsGenerated 
            ? Math.min(100, (5.0 / (costs.total / usage.documentsGenerated)) * 100)
            : 50;
          
          const perfEff = performance?.totalTime && usage?.documentsGenerated
            ? Math.min(100, (120 / (performance.totalTime / usage.documentsGenerated)) * 100) 
            : 50;
            
          const usageEff = usage?.tokensPerDocument 
            ? Math.min(100, (3000 / usage.tokensPerDocument) * 100)
            : 50;
            
          return (costEff + perfEff + usageEff) / 3;
        },
        
        // Générateur de recommandations
        generateRecommendations: (stats: any) => {
          const recommendations: string[] = [];
          
          if (stats.costs?.costPerDocument > 5.0) {
            recommendations.push('Consider optimizing prompt length to reduce API costs');
          }
          
          if (stats.performance?.bottlenecks?.includes('queue_wait')) {
            recommendations.push('Consider upgrading to reduce queue wait times');
          }
          
          if (stats.usage?.tokensPerDocument > 4000) {
            recommendations.push('Document generation uses many tokens - consider template optimization');
          }
          
          return recommendations;
        },
        
        // Validation de cohérence des données
        validateDataConsistency: (data: any) => {
          const errors: string[] = [];
          
          // Validation coûts
          if (data.costs?.total < 0) {
            errors.push('Total cost cannot be negative');
          }
          
          // Validation performance
          if (data.performance?.totalTime < 0) {
            errors.push('Total time cannot be negative');
          }
          
          // Validation usage
          if (data.usage?.exportCount > data.usage?.documentsGenerated) {
            errors.push('Export count cannot exceed documents generated');
          }
          
          return { valid: errors.length === 0, errors };
        },
      },
    },
  ],
  exports: [
    StatisticsService,     // Export principal pour autres modules
    StatisticsRepository,  // Export pour tests et modules avancés
    'STATISTICS_CONFIG',   // Export de la configuration
    'STATISTICS_UTILS',    // Export des utilitaires
  ],
})
export class StatisticsModule {
  constructor() {
    // Log d'initialisation du module
    console.log('📊 StatisticsModule initialized with full configuration');
    
    // Validation de la configuration en mode développement
    if (process.env.NODE_ENV === 'development') {
      this.validateConfiguration();
    }
  }
  
  /**
   * Valide la configuration du module au démarrage
   */
  private validateConfiguration(): void {
    const warnings: string[] = [];
    
    if (!process.env.INTERNAL_SERVICE_TOKEN) {
      warnings.push('INTERNAL_SERVICE_TOKEN not set - using default dev token');
    }
    
    if (!process.env.COST_TRACKING_SERVICE_URL) {
      warnings.push('COST_TRACKING_SERVICE_URL not set - using localhost default');
    }
    
    if (!process.env.MONITORING_SERVICE_URL) {
      warnings.push('MONITORING_SERVICE_URL not set - using localhost default');
    }
    
    if (warnings.length > 0) {
      console.warn('⚠️  StatisticsModule configuration warnings:');
      warnings.forEach(warning => console.warn(`   - ${warning}`));
    }
  }
}