// test/setup/env-setup.ts

import * as dotenv from 'dotenv';
import * as path from 'path';

/**
 * Configuration des variables d'environnement pour les tests
 * Ce fichier est exécuté avant tous les tests via Jest setupFiles
 */

// Interface pour les variables d'environnement
interface TestEnvironmentVariables {
  NODE_ENV: string;
  DATABASE_URL: string;
  DB_TRANSACTION_TIMEOUT: string;
  DB_MAX_WAIT: string;
  DB_MAX_CONNECTIONS: string;
  REDIS_HOST: string;
  REDIS_PORT: string;
  REDIS_DB: string;
  CACHE_TTL: string;
  LOG_LEVEL: string;
  ENABLE_METRICS: string;
  PRISMA_CLI_QUERY_ENGINE_TYPE: string;
  PRISMA_HIDE_UPDATE_MESSAGE: string;
}

/**
 * Charge les fichiers d'environnement dans l'ordre approprié
 */
function loadEnvironmentFiles(): void {
  // 1. Charger .env.test en priorité
  const envTestPath = path.join(__dirname, '../../.env.test');
  dotenv.config({ path: envTestPath });

  // 2. Charger .env comme fallback
  const envPath = path.join(__dirname, '../../.env');
  dotenv.config({ path: envPath });

  console.log('🔧 Environment files loaded from:', envTestPath);
}

// CHARGER LES FICHIERS D'ENVIRONNEMENT IMMÉDIATEMENT
loadEnvironmentFiles();

// Variables d'environnement par défaut pour les tests
const testEnvironmentVariables: TestEnvironmentVariables = {
  // Environment de test
  NODE_ENV: 'test',

  // Base de données de test - utiliser la valeur du .env.test en priorité
  DATABASE_URL:
    process.env.TEST_DATABASE_URL ||
    process.env.DATABASE_URL ||
    'postgresql://postgres:postgres@localhost:5432/project_service_test',

  // Configuration de base de données
  DB_TRANSACTION_TIMEOUT: '15000',
  DB_MAX_WAIT: '10000',
  DB_MAX_CONNECTIONS: '5',

  // Configuration Redis pour les tests
  REDIS_HOST: 'localhost',
  REDIS_PORT: '6379',
  REDIS_DB: '1',

  // Configuration des timeouts
  CACHE_TTL: '60',

  // Configuration des logs
  LOG_LEVEL: 'error', // Réduire les logs pendant les tests

  // Désactiver les métriques en test
  ENABLE_METRICS: 'false',

  // Configuration Prisma
  PRISMA_CLI_QUERY_ENGINE_TYPE: 'binary',

  // Désactiver les warnings Prisma en test
  PRISMA_HIDE_UPDATE_MESSAGE: 'true',
};

// Configuration spéciale pour CI
const ciEnvironmentVariables: Partial<TestEnvironmentVariables> = {
  // Base de données CI - garantir qu'on a toujours une valeur
  DATABASE_URL:
    process.env.CI_DATABASE_URL ||
    process.env.DATABASE_URL ||
    'postgresql://postgres:postgres@localhost:5432/project_service_test',

  // Timeouts plus longs en CI
  DB_TRANSACTION_TIMEOUT: '30000',
  DB_MAX_WAIT: '15000',

  // Plus de connexions en CI
  DB_MAX_CONNECTIONS: '10',

  // Configuration Redis CI
  REDIS_HOST: process.env.CI_REDIS_HOST || 'localhost',
  REDIS_PORT: process.env.CI_REDIS_PORT || '6379',
};

// Configuration spéciale pour tests d'intégration
const integrationTestVariables: Partial<TestEnvironmentVariables> = {
  // Base dédiée aux tests d'intégration - garantir qu'on a toujours une valeur
  DATABASE_URL:
    process.env.INTEGRATION_DATABASE_URL ||
    process.env.TEST_DATABASE_URL ||
    'postgresql://postgres:postgres@localhost:5432/project_service_integration_test',

  // Timeouts plus longs pour l'intégration
  DB_TRANSACTION_TIMEOUT: '20000',

  // Pool de connexions plus grand
  DB_MAX_CONNECTIONS: '15',
};

/**
 * Détecte le type de test en cours d'exécution
 */
function detectTestType(): 'unit' | 'integration' | 'e2e' {
  const testFile = process.env.JEST_WORKER_ID
    ? process.argv.find((arg) => arg.includes('.spec.ts')) || ''
    : '';

  if (testFile.includes('integration.spec.ts')) {
    return 'integration';
  } else if (testFile.includes('e2e.spec.ts')) {
    return 'e2e';
  } else {
    return 'unit';
  }
}

/**
 * Configure les variables d'environnement selon le contexte
 */
function setupEnvironmentVariables() {
  const testType = detectTestType();
  const isCI = process.env.CI === 'true';

  let envVars: TestEnvironmentVariables = { ...testEnvironmentVariables };

  // Ajouter les variables spécifiques au contexte
  if (isCI) {
    envVars = { ...envVars, ...ciEnvironmentVariables };
  }

  if (testType === 'integration') {
    envVars = { ...envVars, ...integrationTestVariables };
  }

  // Appliquer les variables d'environnement seulement si elles ne sont pas déjà définies
  Object.entries(envVars).forEach(([key, value]) => {
    if (!process.env[key]) {
      process.env[key] = value;
    }
  });

  // Log de la configuration en mode debug
  if (
    process.env.DEBUG_TESTS === 'true' ||
    process.env.VERBOSE_TESTS === 'true'
  ) {
    console.log(`🔧 Test Environment Setup:`);
    console.log(`   Type: ${testType}`);
    console.log(`   CI: ${isCI}`);
    console.log(
      `   Database: ${process.env.DATABASE_URL?.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')}`,
    );
    console.log(
      `   TEST_DATABASE_URL: ${process.env.TEST_DATABASE_URL ? 'configured' : 'missing'}`,
    );
    console.log(
      `   Redis: ${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
    );
  }
}

/**
 * Validation des variables d'environnement critiques
 */
function validateEnvironmentVariables() {
  const requiredVars = ['NODE_ENV', 'DATABASE_URL'];

  const missingVars = requiredVars.filter((varName) => !process.env[varName]);

  if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables for tests:');
    missingVars.forEach((varName) => {
      console.error(`   - ${varName}`);
    });

    console.log('\n💡 Expected configuration:');
    console.log('   Create a .env.test file with:');
    console.log(
      '   TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/project_service_test"',
    );
    console.log(
      '   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/project_service_test"',
    );

    throw new Error(
      `Missing required environment variables for tests: ${missingVars.join(', ')}`,
    );
  }

  // Validation du format de l'URL de base de données
  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl && !dbUrl.startsWith('postgresql://')) {
    throw new Error(
      'DATABASE_URL must be a valid PostgreSQL connection string',
    );
  }

  // Validation que nous sommes bien en environnement de test
  if (process.env.NODE_ENV !== 'test') {
    console.warn('⚠️  NODE_ENV is not set to "test". This may cause issues.');
    process.env.NODE_ENV = 'test'; // Forcer la valeur
  }
}

/**
 * Setup des variables d'environnement pour différents scénarios de test
 */
export function setupTestScenario(
  scenario: 'normal' | 'no-db' | 'slow-db' | 'invalid-config',
) {
  switch (scenario) {
    case 'no-db':
      process.env.DATABASE_URL =
        'postgresql://invalid:invalid@nonexistent:5432/nonexistent';
      break;

    case 'slow-db':
      process.env.DB_TRANSACTION_TIMEOUT = '1000'; // Timeout court
      process.env.DB_MAX_WAIT = '500';
      break;

    case 'invalid-config':
      process.env.DATABASE_URL = 'invalid-url';
      process.env.DB_TRANSACTION_TIMEOUT = 'invalid';
      break;

    case 'normal':
    default:
      setupEnvironmentVariables();
      break;
  }
}

/**
 * Nettoyage des variables d'environnement après les tests
 */
export function cleanupTestEnvironment() {
  const testVars = Object.keys(testEnvironmentVariables) as Array<
    keyof TestEnvironmentVariables
  >;
  testVars.forEach((varName) => {
    delete process.env[varName];
  });
}

/**
 * Helper pour les tests nécessitant une base de données
 */
export function requiresDatabase(): boolean {
  const hasTestDb = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
  const isCI = process.env.CI === 'true';

  return !!(hasTestDb || isCI);
}

/**
 * Helper pour vérifier si on peut exécuter les tests d'intégration
 */
export function canRunIntegrationTests(): boolean {
  return !!(
    process.env.INTEGRATION_DATABASE_URL ||
    process.env.TEST_DATABASE_URL ||
    process.env.CI
  );
}

/**
 * Configuration des timeouts Jest selon l'environnement
 */
export function getTestTimeouts() {
  const isCI = process.env.CI === 'true';
  const testType = detectTestType();

  const timeouts = {
    unit: isCI ? 10000 : 5000,
    integration: isCI ? 60000 : 30000,
    e2e: isCI ? 120000 : 60000,
  };

  return timeouts[testType];
}

// Exécuter le setup automatiquement quand ce fichier est importé
try {
  setupEnvironmentVariables();
  validateEnvironmentVariables();

  // Confirmation du chargement
  if (process.env.VERBOSE_TESTS === 'true') {
    console.log('✅ Test environment setup completed');
    console.log(`   NODE_ENV: ${process.env.NODE_ENV}`);
    console.log(
      `   Database: ${process.env.DATABASE_URL?.replace(/\/\/.*@/, '//***@')}`,
    );
  }
} catch (error) {
  console.error(
    '❌ Failed to setup test environment:',
    error instanceof Error ? error.message : String(error),
  );

  // Afficher les variables actuellement chargées pour debug
  console.log('\n🔍 Current environment variables:');
  console.log('   NODE_ENV:', process.env.NODE_ENV);
  console.log('   DATABASE_URL:', process.env.DATABASE_URL ? 'set' : 'not set');
  console.log(
    '   TEST_DATABASE_URL:',
    process.env.TEST_DATABASE_URL ? 'set' : 'not set',
  );
  console.log('   Working directory:', process.cwd());

  process.exit(1);
}
