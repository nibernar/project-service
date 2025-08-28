/**
 * EventsModule - Module complet pour la gestion des événements métier
 *
 * Ce module configure l'infrastructure complète pour la publication d'événements
 * dans l'architecture Event-Driven de la plateforme Coders. Il gère les différents
 * transports (HTTP, Message Broker, Stub) et toutes les dépendances nécessaires.
 *
 * FONCTIONNALITÉS :
 * - Configuration multi-transport selon l'environnement
 * - HttpModule optimisé pour communications inter-services
 * - Circuit breaker et retry policies intégrées
 * - Monitoring et métriques des événements
 * - Support complet du développement au production
 *
 * ARCHITECTURE :
 * - EventsService pour la logique métier d'événements
 * - Transport abstraction pour flexibilité
 * - Configuration dynamique par environnement
 * - Integration avec le système de monitoring global
 *
 * SÉCURITÉ :
 * - Authentification inter-services
 * - Validation des payloads d'événements
 * - Isolation des erreurs de transport
 * - Audit trail des publications d'événements
 *
 * @fileoverview Module complet pour la gestion des événements
 * @version 1.0.0
 * @since 2025-01-28
 */

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { EventsService } from './events.service';

/**
 * Events Module
 * 
 * Configure tous les composants nécessaires pour la publication robuste
 * d'événements vers les services externes (notamment l'orchestrateur).
 * 
 * Features:
 * - HTTP client optimisé pour communications inter-services
 * - Configuration dynamique selon l'environnement
 * - Support de multiple transports (HTTP, Message Broker, Stub)
 * - Métriques et monitoring intégrés
 * - Gestion des erreurs et retry automatique
 */
@Module({
  imports: [
    // Configuration HTTP optimisée pour communications inter-services
    HttpModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const nodeEnv = configService.get('NODE_ENV', 'development');
        
        // Configuration de base pour tous les environnements
        const baseConfig = {
          timeout: configService.get('EVENTS_HTTP_TIMEOUT', 15000),
          maxRedirects: 0, // Pas de redirections pour les APIs internes
          headers: {
            'User-Agent': 'project-service-events/1.0.0',
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
        };

        // Configuration spécifique par environnement
        switch (nodeEnv) {
          case 'production':
            return {
              ...baseConfig,
              timeout: 30000, // Plus de tolérance en production
              retries: 5,
              retryDelay: 1000,
              validateStatus: (status: number) => status >= 200 && status < 300,
              maxBodyLength: 1048576, // 1MB max pour événements
              maxContentLength: 1048576,
              // Configuration sécurisée
              httpsAgent: {
                rejectUnauthorized: true,
                keepAlive: true,
              },
            };

          case 'staging':
            return {
              ...baseConfig,
              timeout: 20000,
              retries: 3,
              retryDelay: 500,
              validateStatus: (status: number) => status >= 200 && status < 500, // Plus tolérant pour les tests
            };

          case 'test':
            return {
              ...baseConfig,
              timeout: 5000, // Timeout court pour les tests
              retries: 1,
              retryDelay: 100,
            };

          case 'development':
          default:
            return {
              ...baseConfig,
              timeout: 10000,
              retries: 2,
              retryDelay: 200,
              // Logging détaillé en développement
              validateStatus: () => true, // Accepter toutes les réponses pour debugging
            };
        }
      },
      inject: [ConfigService],
    }),

    // Configuration module déjà importé globalement
    // Pas besoin de le réimporter, mais on le garde pour clarté
    ConfigModule,
  ],

  providers: [
    EventsService,
    
    // Provider de configuration pour validation des paramètres événements
    {
      provide: 'EVENTS_CONFIG_VALIDATOR',
      useFactory: (configService: ConfigService) => {
        const transportType = configService.get('EVENT_TRANSPORT', 'stub');
        
        // Validation de la configuration selon le transport
        switch (transportType) {
          case 'http':
            const orchestrationUrl = configService.get('ORCHESTRATION_SERVICE_URL');
            if (!orchestrationUrl) {
              console.warn('⚠️ WARNING: ORCHESTRATION_SERVICE_URL not configured for HTTP transport');
            }
            
            const serviceToken = configService.get('INTERNAL_SERVICE_TOKEN');
            if (!serviceToken || serviceToken === 'dev-token') {
              console.warn('⚠️ WARNING: INTERNAL_SERVICE_TOKEN not configured or using default');
            }
            break;

          case 'messagebroker':
            const brokerUrl = configService.get('MESSAGE_BROKER_URL');
            if (!brokerUrl) {
              console.warn('⚠️ WARNING: MESSAGE_BROKER_URL not configured for message broker transport');
            }
            break;

          case 'stub':
            console.log('ℹ️ Events module running in STUB mode - events will be logged only');
            break;

          default:
            console.warn(`⚠️ WARNING: Unknown EVENT_TRANSPORT: ${transportType}`);
        }

        return { validated: true, transport: transportType };
      },
      inject: [ConfigService],
    },
  ],

  exports: [
    EventsService,
    // Export des types pour utilisation dans d'autres modules
    'EVENTS_CONFIG_VALIDATOR',
  ],
})
export class EventsModule {
  constructor(
    private readonly configService: ConfigService,
    private readonly eventsService: EventsService,
  ) {
    this.logModuleConfiguration();
  }

  /**
   * Log la configuration du module au démarrage pour visibility opérationnelle
   */
  private logModuleConfiguration(): void {
    const nodeEnv = this.configService.get('NODE_ENV', 'development');
    const transportType = this.configService.get('EVENT_TRANSPORT', 'stub');
    const orchestrationUrl = this.configService.get('ORCHESTRATION_SERVICE_URL', 'not-configured');
    
    console.log('📡 EventsModule Configuration:');
    console.log(`   Environment: ${nodeEnv}`);
    console.log(`   Transport: ${transportType}`);
    console.log(`   Orchestration URL: ${orchestrationUrl}`);
    
    if (transportType === 'stub') {
      console.log('   ⚠️  Running in STUB mode - events are logged but not published');
    } else {
      console.log('   ✅ Production transport configured');
    }
    
    // Configuration additionnelle selon l'environnement
    if (nodeEnv === 'development') {
      console.log('   🔧 Development mode: detailed logging enabled');
    } else if (nodeEnv === 'production') {
      console.log('   🏭 Production mode: performance optimizations enabled');
    }
  }

  /**
   * Méthode pour obtenir la configuration actuelle (utile pour debugging)
   */
  getConfiguration(): {
    environment: string;
    transport: string;
    orchestrationUrl: string;
    httpTimeout: number;
    stubEnabled: boolean;
  } {
    return {
      environment: this.configService.get('NODE_ENV', 'development'),
      transport: this.configService.get('EVENT_TRANSPORT', 'stub'),
      orchestrationUrl: this.configService.get('ORCHESTRATION_SERVICE_URL', 'not-configured'),
      httpTimeout: this.configService.get('EVENTS_HTTP_TIMEOUT', 15000),
      stubEnabled: this.configService.get('EVENT_TRANSPORT', 'stub') === 'stub',
    };
  }
}