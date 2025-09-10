import { NestFactory } from '@nestjs/core';
import { 
  FastifyAdapter, 
  NestFastifyApplication 
} from '@nestjs/platform-fastify';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

/**
 * Bootstrap function - Point d'entrée principal de l'application
 * Configure et démarre le Service de Gestion des Projets
 */
async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');

  try {
    // Création de l'application NestJS avec adaptateur Fastify
    const app = await NestFactory.create<NestFastifyApplication>(
      AppModule,
      new FastifyAdapter({
        logger: false, // Délégué à NestJS
        trustProxy: true, // Support des proxies/load balancers
        bodyLimit: 50 * 1024 * 1024, // 50MB limit par défaut
        requestTimeout: 30000, // 30 secondes timeout
        keepAliveTimeout: 5000,
        maxParamLength: 500
      }),
      {
        logger: ['error', 'warn', 'log', 'debug'],
        abortOnError: false,
        bufferLogs: true
      }
    );

    // Récupération du service de configuration
    const configService = app.get(ConfigService);
    
    // Configuration du préfixe API global
    const apiPrefix = configService.get<string>('app.apiPrefix', 'api/v1');
    app.setGlobalPrefix(apiPrefix);

    // Configuration des pipes de validation globaux
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true, // Supprime les propriétés non validées
      forbidNonWhitelisted: true, // Rejette les propriétés inconnues
      transform: true, // Transforme automatiquement les types
      disableErrorMessages: configService.get('app.nodeEnv') === 'production',
      validationError: {
        target: false, // Ne pas exposer l'objet cible
        value: false // Ne pas exposer la valeur rejetée
      },
      stopAtFirstError: true,
      skipMissingProperties: false,
      skipNullProperties: false,
      skipUndefinedProperties: false
    }));

    // Configuration CORS
    const allowedOrigins = configService.get<string[]>('app.allowedOrigins', []);
    const isProduction = configService.get('app.nodeEnv') === 'production';
    
    app.enableCors({
      origin: isProduction ? allowedOrigins : true,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Origin',
        'X-Requested-With', 
        'Content-Type', 
        'Accept',
        'Authorization',
        'X-Service-Token',
        'Cache-Control'
      ],
      exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
      maxAge: 86400 // Cache preflight 24h
    });

    // Configuration Swagger/OpenAPI
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Project Service API')
      .setDescription(`
        # Service de Gestion des Projets - Plateforme Coders
        
        Ce service gère le cycle de vie complet des projets utilisateurs et leurs métadonnées.
        
        ## Authentification
        Toutes les routes protégées nécessitent un token JWT Bearer valide.
        
        ## Gestion des erreurs
        L'API retourne des codes d'erreur HTTP standard avec messages descriptifs.
        
        ## Pagination
        Les listes supportent la pagination avec les paramètres \`page\` et \`limit\`.
        
        ## Cache
        Certaines réponses sont mises en cache pour améliorer les performances.
      `)
      .setVersion('1.0.0')
      .setContact(
        'Équipe Technique Coders',
        'https://coders.tech/support',
        'tech@coders.tech'
      )
      .setLicense('MIT', 'https://opensource.org/licenses/MIT')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          name: 'Authorization',
          description: 'Token JWT fourni par le service d\'authentification',
          in: 'header'
        },
        'JWT-auth'
      )
      .addApiKey(
        {
          type: 'apiKey',
          name: 'X-Service-Token',
          in: 'header',
          description: 'Token pour l\'authentification inter-services'
        },
        'Service-Token'
      )
      .addServer(
        configService.get('app.baseUrl', 'http://localhost:3000'),
        'Serveur principal'
      )
      .addTag('App', 'Informations générales de l\'API')
      .addTag('Projects', 'Gestion des projets utilisateurs')
      .addTag('Statistics', 'Statistiques et métriques des projets') 
      .addTag('Export', 'Export des documents générés')
      .addTag('Health', 'Surveillance de la santé du service')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig, {
      operationIdFactory: (controllerKey: string, methodKey: string) => methodKey,
      deepScanRoutes: true,
      ignoreGlobalPrefix: false
    });

    // Configuration de l'interface Swagger
    SwaggerModule.setup(`${apiPrefix}/docs`, app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        docExpansion: 'none',
        filter: true,
        showRequestHeaders: true,
        tryItOutEnabled: true,
        defaultModelsExpandDepth: 2,
        defaultModelExpandDepth: 2,
        displayOperationId: true,
        showExtensions: true
      },
      customSiteTitle: 'Project Service API Documentation',
      customfavIcon: '/favicon.ico',
      customCss: `
        .swagger-ui .topbar { display: none; }
        .swagger-ui .info .title { color: #1f2937; font-weight: bold; }
        .swagger-ui .info .description { color: #374151; }
        .swagger-ui .scheme-container { background: #f9fafb; padding: 10px; border-radius: 5px; }
      `,
      customJs: '/swagger-custom.js'
    });

    // Configuration du port et de l'interface d'écoute
    const port = configService.get<number>('app.port', 3000);
    const host = configService.get<string>('app.host', '0.0.0.0');

    // Démarrage du serveur
    await app.listen(port, host);

    // Logs informatifs de démarrage
    const nodeEnv = configService.get('app.nodeEnv', 'development');
    const baseUrl = configService.get('app.baseUrl', `http://localhost:${port}`);
    
    logger.log('🚀 Project Service started successfully');
    logger.log(`📡 Server listening on ${host}:${port}`);
    logger.log(`🌍 Environment: ${nodeEnv}`);
    logger.log(`🔗 API Base URL: ${baseUrl}/${apiPrefix}`);
    logger.log(`📚 API Documentation: ${baseUrl}/${apiPrefix}/docs`);
    logger.log(`❤️  Health Check: ${baseUrl}/${apiPrefix}/health`);
    
    // Logs de configuration en développement
    if (nodeEnv === 'development') {
      logger.log('🔧 Development mode - CORS enabled for all origins');
      logger.log('📝 Detailed error messages enabled');
      logger.log('🔍 Request logging enabled');
    }

    // Log de la version de l'application
    try {
      const packageJson = require('../../package.json');
      logger.log(`📦 Version: ${packageJson.version}`);
    } catch (error) {
      logger.warn('📦 Version: unable to read package.json');
    }

  } catch (error) {
    logger.error('❌ Failed to start Project Service', error);
    process.exit(1);
  }
}

/**
 * Gestion gracieuse de l'arrêt de l'application
 */
const gracefulShutdown = async (signal: string, app?: NestFastifyApplication) => {
  const logger = new Logger('Shutdown');
  logger.log(`📡 Received ${signal}, starting graceful shutdown...`);
  
  try {
    if (app) {
      await app.close();
      logger.log('✅ Application closed successfully');
    }
    process.exit(0);
  } catch (error) {
    logger.error('❌ Error during shutdown', error);
    process.exit(1);
  }
};

/**
 * Configuration des handlers de signaux système
 */
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

/**
 * Gestion des erreurs non capturées
 */
process.on('unhandledRejection', (reason, promise) => {
  const logger = new Logger('UnhandledRejection');
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // En production, on pourrait vouloir redémarrer le service
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
});

process.on('uncaughtException', (error) => {
  const logger = new Logger('UncaughtException');
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

/**
 * Optimisation de la gestion mémoire Node.js
 */
if (process.env.NODE_ENV === 'production') {
  // Configuration pour optimiser les performances en production
  process.env.UV_THREADPOOL_SIZE = '16';
  
  // Surveillance de la mémoire
  setInterval(() => {
    const memUsage = process.memoryUsage();
    const logger = new Logger('MemoryMonitor');
    
    if (memUsage.heapUsed / memUsage.heapTotal > 0.9) {
      logger.warn('High memory usage detected', {
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + ' MB',
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + ' MB',
        usage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100) + '%'
      });
    }
  }, 30000); // Check toutes les 30 secondes
}

// Démarrage de l'application
bootstrap().catch((error) => {
  const logger = new Logger('Bootstrap');
  logger.error('Failed to bootstrap application', error);
  process.exit(1);
});