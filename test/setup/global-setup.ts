// test/setup/global-setup.ts

import { execSync } from 'child_process';
import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

/**
 * Setup global pour tous les tests de base de données
 * Exécuté une seule fois avant tous les tests
 */

// IMPORTANT: Charger les variables d'environnement AVANT tout le reste
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return String(error);
}

function loadEnvironmentVariables(): void {
  // Charger le fichier .env.test
  const envTestPath = path.join(__dirname, '../../.env.test');
  dotenv.config({ path: envTestPath });
  
  // Charger aussi .env par défaut
  const envPath = path.join(__dirname, '../../.env');
  dotenv.config({ path: envPath });
  
  // S'assurer que NODE_ENV est défini
  if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = 'test';
  }
  
  console.log('🔧 Environment variables loaded');
  
  // Debug: afficher les variables importantes (masquées)
  if (process.env.DEBUG_TESTS === 'true') {
    console.log('   NODE_ENV:', process.env.NODE_ENV);
    console.log('   DATABASE_URL:', process.env.DATABASE_URL ? 'configured' : 'missing');
    console.log('   TEST_DATABASE_URL:', process.env.TEST_DATABASE_URL ? 'configured' : 'missing');
  }
}

interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

/**
 * Parse une URL de base de données PostgreSQL
 */
function parseDatabaseUrl(url: string): DatabaseConfig {
  // Support des URLs avec et sans mot de passe
  const regexWithPassword = /postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/;
  const regexWithoutPassword = /postgresql:\/\/([^@]+)@([^:]+):(\d+)\/(.+)/;
  
  let match = url.match(regexWithPassword);
  if (match) {
    return {
      user: match[1],
      password: match[2],
      host: match[3],
      port: parseInt(match[4], 10),
      database: match[5],
    };
  }
  
  match = url.match(regexWithoutPassword);
  if (match) {
    return {
      user: match[1],
      password: '', // Pas de mot de passe
      host: match[2],
      port: parseInt(match[3], 10),
      database: match[4],
    };
  }
  
  throw new Error(`Invalid database URL format: ${url}`);
}

/**
 * Crée une base de données de test si elle n'existe pas
 */
async function createTestDatabase(config: DatabaseConfig): Promise<void> {
  const adminClient = new Client({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: 'postgres', // Base par défaut pour les opérations admin
  });

  try {
    await adminClient.connect();
    
    // Vérifier si la base existe
    const result = await adminClient.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [config.database]
    );
    
    if (result.rows.length === 0) {
      console.log(`🏗️  Creating test database: ${config.database}`);
      await adminClient.query(`CREATE DATABASE "${config.database}"`);
    } else {
      console.log(`✅ Test database already exists: ${config.database}`);
    }
  } catch (error) {
    console.error(`❌ Failed to create test database: ${getErrorMessage(error)}`);
    throw error;
  } finally {
    await adminClient.end();
  }
}

/**
 * Exécute les migrations Prisma sur la base de test
 */
async function runMigrations(databaseUrl: string): Promise<void> {
  console.log('🔄 Running database migrations...');
  
  try {
    // Générer le client Prisma
    execSync('npx prisma generate', {
      stdio: 'pipe',
      env: { ...process.env, DATABASE_URL: databaseUrl },
    });
    
    // Exécuter les migrations
    execSync('npx prisma migrate deploy', {
      stdio: 'pipe',
      env: { ...process.env, DATABASE_URL: databaseUrl },
    });
    
    console.log('✅ Database migrations completed');
  } catch (error) {
    console.error(`❌ Migration failed: ${getErrorMessage(error)}`);
    throw error;
  }
}

/**
 * Vérifie que les services requis sont disponibles
 */
async function checkRequiredServices(): Promise<void> {
  const services = [
    { name: 'PostgreSQL', check: checkPostgreSQL },
    { name: 'Redis', check: checkRedis },
  ];
  
  for (const service of services) {
    try {
      await service.check();
      console.log(`✅ ${service.name} is available`);
    } catch (error) {
      console.warn(`⚠️  ${service.name} is not available: ${getErrorMessage(error)}`);
      // Ne pas faire échouer le setup pour Redis (optionnel pour certains tests)
      if (service.name === 'PostgreSQL') {
        throw error;
      }
    }
  }
}

/**
 * Vérifie la disponibilité de PostgreSQL
 */
async function checkPostgreSQL(): Promise<void> {
  // Maintenant les variables d'environnement sont chargées
  const dbUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
  
  if (!dbUrl) {
    console.error('❌ No database URL configured');
    console.error('   Expected: TEST_DATABASE_URL or DATABASE_URL');
    console.error('   Current environment variables:');
    console.error('   - TEST_DATABASE_URL:', process.env.TEST_DATABASE_URL ? 'set' : 'not set');
    console.error('   - DATABASE_URL:', process.env.DATABASE_URL ? 'set' : 'not set');
    console.error('   - NODE_ENV:', process.env.NODE_ENV);
    throw new Error('No database URL configured');
  }
  
  console.log(`🔍 Testing PostgreSQL connection...`);
  
  // Parser l'URL pour obtenir les infos de connexion
  const config = parseDatabaseUrl(dbUrl);
  
  // Se connecter à la base postgres (qui existe toujours) pour vérifier PostgreSQL
  const client = new Client({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: 'postgres', // Base par défaut qui existe toujours
  });
  
  try {
    await client.connect();
    await client.query('SELECT 1');
    console.log('✅ PostgreSQL connection successful');
  } catch (error) {
    console.error(`❌ PostgreSQL connection failed: ${getErrorMessage(error)}`);
    throw error;
  } finally {
    await client.end();
  }
}

/**
 * Vérifie la disponibilité de Redis
 */
async function checkRedis(): Promise<void> {
  try {
    const Redis = require('ioredis');
    const redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      db: parseInt(process.env.REDIS_DB || '1', 10),
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 1,
      lazyConnect: true, // Ne pas se connecter automatiquement
    });
    
    await redis.connect();
    await redis.ping();
    redis.disconnect();
  } catch (error) {
    throw new Error(`Redis connection failed: ${getErrorMessage(error)}`);
  }
}

/**
 * Configure l'environnement de test
 */
function setupTestEnvironment(): void {
  // Variables d'environnement pour les tests
  process.env.NODE_ENV = 'test';
  
  // Désactiver les warnings Prisma en test
  process.env.PRISMA_HIDE_UPDATE_MESSAGE = 'true';
  
  // Augmenter les limites de listeners pour les tests parallèles
  require('events').EventEmitter.defaultMaxListeners = 20;
  
  console.log('🔧 Test environment configured');
}

/**
 * Setup des bases de données multiples pour différents types de tests
 */
async function setupMultipleTestDatabases(): Promise<void> {
  const databaseUrls = [
    process.env.TEST_DATABASE_URL,
    process.env.INTEGRATION_DATABASE_URL,
    process.env.E2E_DATABASE_URL,
  ].filter(Boolean);
  
  if (databaseUrls.length === 0) {
    console.warn('⚠️  No test database URLs configured');
    return;
  }
  
  for (const url of databaseUrls) {
    if (url) {
      try {
        const config = parseDatabaseUrl(url);
        await createTestDatabase(config);
        await runMigrations(url);
        console.log(`✅ Setup completed for: ${config.database}`);
      } catch (error) {
        console.error(`❌ Failed to setup database: ${url}`);
        throw error;
      }
    }
  }
}

/**
 * Nettoyage des anciens processus de test
 */
async function cleanupOldTestProcesses(): Promise<void> {
  try {
    // Tuer les anciens processus Jest qui pourraient être bloqués
    if (process.platform !== 'win32') {
      execSync('pkill -f "jest.*database" || true', { stdio: 'ignore' });
    }
    
    console.log('🧹 Cleaned up old test processes');
  } catch (error) {
    // Ignorer les erreurs de nettoyage
    console.log('ℹ️  No old processes to clean up');
  }
}

/**
 * Fonction principale de setup global
 */
export default async function globalSetup(): Promise<void> {
  console.log('🚀 Starting global test setup...');
  
  try {
    // 1. CHARGER LES VARIABLES D'ENVIRONNEMENT EN PREMIER
    loadEnvironmentVariables();
    
    // 2. Nettoyer les anciens processus
    await cleanupOldTestProcesses();
    
    // 3. Configurer l'environnement
    setupTestEnvironment();
    
    // 4. Vérifier les services requis
    await checkRequiredServices();
    
    // 5. Configurer les bases de données
    await setupMultipleTestDatabases();
    
    // 6. Attendre un peu pour que tout soit stable
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('✅ Global test setup completed successfully');
    
  } catch (error) {
    console.error('❌ Global test setup failed:', error);
    
    // Afficher des informations d'aide
    console.log('\n📋 Troubleshooting tips:');
    console.log('   - Ensure PostgreSQL is running and accessible');
    console.log('   - Check that your .env.test file exists and contains TEST_DATABASE_URL');
    console.log('   - Verify that the database user has CREATE DATABASE permissions');
    console.log('   - Make sure the port is not blocked by firewall');
    console.log('   - Check if PostgreSQL is running on the expected port (5432)');
    
    // Exit avec code d'erreur pour arrêter Jest
    process.exit(1);
  }
}

/**
 * Setup spécialisé pour CI/CD
 */
export async function setupForCI(): Promise<void> {
  console.log('🤖 Setting up for CI environment...');
  
  // Configuration spéciale pour CI
  process.env.CI = 'true';
  process.env.NODE_ENV = 'test';
  
  // Moins de workers en CI pour éviter les conflits de ressources
  process.env.JEST_MAX_WORKERS = '2';
  
  // Attendre plus longtemps pour que les services soient disponibles
  let retries = 30;
  while (retries > 0) {
    try {
      await checkRequiredServices();
      break;
    } catch (error) {
      retries--;
      if (retries === 0) throw error;
      
      console.log(`⏳ Waiting for services... (${retries} retries left)`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  console.log('✅ CI setup completed');
}

/**
 * Fonction utilitaire pour les tests locaux
 */
export async function setupForLocal(): Promise<void> {
  console.log('🏠 Setting up for local development...');
  
  // Configuration pour développement local
  process.env.NODE_ENV = 'test';
  process.env.DEBUG_TESTS = 'true';
  
  console.log('✅ Local setup completed');
}

// Auto-détection de l'environnement si appelé directement
if (require.main === module) {
  const isCI = process.env.CI === 'true';
  
  if (isCI) {
    setupForCI().catch(error => {
      console.error('CI setup failed:', error);
      process.exit(1);
    });
  } else {
    globalSetup().catch(error => {
      console.error('Setup failed:', error);
      process.exit(1);
    });
  }
}