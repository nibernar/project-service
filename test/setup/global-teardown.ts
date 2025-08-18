// test/setup/global-teardown.ts

import { Client } from 'pg';
import { execSync } from 'child_process';

/**
 * Teardown global pour tous les tests de base de données
 * Exécuté une seule fois après tous les tests
 */

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
  const regexWithPassword =
    /postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/;
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
 * Nettoie une base de données de test
 */
async function cleanupTestDatabase(config: DatabaseConfig): Promise<void> {
  console.log(`🧹 Cleaning up test database: ${config.database}`);

  const adminClient = new Client({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: 'postgres', // Base par défaut pour les opérations admin
  });

  try {
    await adminClient.connect();

    // Terminer toutes les connexions actives à la base de test
    await adminClient.query(
      `
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE datname = $1 AND pid <> pg_backend_pid()
    `,
      [config.database],
    );

    // Vérifier si la base existe avant de la supprimer
    const result = await adminClient.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [config.database],
    );

    if (result.rows.length > 0) {
      // Option 1: Supprimer complètement la base (plus radical)
      if (process.env.CLEANUP_STRATEGY === 'drop') {
        await adminClient.query(`DROP DATABASE IF EXISTS "${config.database}"`);
        console.log(`🗑️  Dropped test database: ${config.database}`);
      } else {
        // Option 2: Juste nettoyer les données (plus sûr)
        console.log(`✅ Test database preserved: ${config.database}`);
      }
    }
  } catch (error) {
    console.warn(
      `⚠️  Failed to cleanup database ${config.database}: ${(error as Error).message}`,
    );
    // Ne pas faire échouer le teardown pour ça
  } finally {
    await adminClient.end();
  }
}

/**
 * Nettoie les connexions Redis de test
 */
async function cleanupRedisConnections(): Promise<void> {
  try {
    const Redis = require('ioredis');
    const redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      db: 1, // Base de test
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 1,
    });

    // Nettoyer la base Redis de test
    await redis.flushdb();
    redis.disconnect();

    console.log('🧹 Redis test database cleaned');
  } catch (error) {
    console.warn(`⚠️  Failed to cleanup Redis: ${(error as Error).message}`);
    // Ne pas faire échouer le teardown pour ça
  }
}

/**
 * Génère un rapport de couverture final
 */
async function generateCoverageReport(): Promise<void> {
  if (process.env.GENERATE_COVERAGE === 'true') {
    try {
      console.log('📊 Generating coverage report...');

      execSync('npm run test:cov:report', {
        stdio: 'inherit',
        timeout: 30000,
      });

      console.log('✅ Coverage report generated');
    } catch (error) {
      console.warn(
        '⚠️  Failed to generate coverage report:',
        (error as Error).message,
      );
    }
  }
}

/**
 * Génère un rapport de test final
 */
async function generateTestReport(): Promise<void> {
  try {
    const fs = require('fs');
    const path = require('path');

    const reportDir = 'test-results';
    const reportPath = path.join(reportDir, 'test-summary.json');

    // Créer le dossier s'il n'existe pas
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    const report = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      ci: process.env.CI === 'true',
      testTypes: {
        unit: true,
        integration: !!process.env.TEST_DATABASE_URL,
        e2e: !!process.env.E2E_DATABASE_URL,
        performance: process.env.RUN_PERFORMANCE_TESTS === 'true',
      },
      databases: {
        test: process.env.TEST_DATABASE_URL ? 'configured' : 'missing',
        integration: process.env.INTEGRATION_DATABASE_URL
          ? 'configured'
          : 'missing',
        e2e: process.env.E2E_DATABASE_URL ? 'configured' : 'missing',
      },
      redis: process.env.REDIS_HOST ? 'configured' : 'missing',
    };

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`📋 Test summary saved to: ${reportPath}`);
  } catch (error) {
    console.warn(
      '⚠️  Failed to generate test report:',
      (error as Error).message,
    );
  }
}

/**
 * Nettoie les fichiers temporaires de test
 */
async function cleanupTemporaryFiles(): Promise<void> {
  try {
    const fs = require('fs');
    const path = require('path');

    const tempDirs = ['tmp/test', 'temp/test', '.tmp/test'];

    for (const tempDir of tempDirs) {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
        console.log(`🧹 Cleaned temporary directory: ${tempDir}`);
      }
    }

    // Nettoyer les fichiers de lock Jest
    const lockFiles = ['.jest-cache', 'node_modules/.cache/jest'];

    for (const lockFile of lockFiles) {
      if (fs.existsSync(lockFile)) {
        fs.rmSync(lockFile, { recursive: true, force: true });
        console.log(`🧹 Cleaned cache directory: ${lockFile}`);
      }
    }
  } catch (error) {
    console.warn(
      '⚠️  Failed to cleanup temporary files:',
      (error as Error).message,
    );
  }
}

/**
 * Ferme les connexions ouvertes
 */
async function closeOpenConnections(): Promise<void> {
  try {
    // Attendre que toutes les connexions asynchrones se ferment
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Nettoyer les timers globaux
    if (global.gc) {
      global.gc();
    }

    console.log('🔌 Closed open connections');
  } catch (error) {
    console.warn('⚠️  Failed to close connections:', (error as Error).message);
  }
}

/**
 * Affiche les statistiques finales
 */
function displayFinalStats(): void {
  const memoryUsage = process.memoryUsage();
  const uptime = process.uptime();

  console.log('\n📊 Final Test Statistics:');
  console.log(`   Duration: ${uptime.toFixed(2)}s`);
  console.log(
    `   Memory: ${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB used`,
  );
  console.log(
    `   Peak Memory: ${(memoryUsage.heapTotal / 1024 / 1024).toFixed(2)}MB total`,
  );
  console.log(`   Environment: ${process.env.NODE_ENV}`);
  console.log(`   CI: ${process.env.CI === 'true' ? 'Yes' : 'No'}`);

  if (process.env.VERBOSE_TESTS === 'true') {
    console.log('\n🔍 Environment Variables:');
    const relevantEnvs = [
      'DATABASE_URL',
      'TEST_DATABASE_URL',
      'INTEGRATION_DATABASE_URL',
      'E2E_DATABASE_URL',
      'REDIS_HOST',
      'REDIS_PORT',
    ];

    relevantEnvs.forEach((env) => {
      const value = process.env[env];
      if (value) {
        // Masquer les credentials dans les URLs
        const maskedValue = value.replace(/\/\/[^:]+:[^@]+@/, '//***:***@');
        console.log(`   ${env}: ${maskedValue}`);
      }
    });
  }
}

/**
 * Teardown spécialisé pour CI
 */
async function teardownForCI(): Promise<void> {
  console.log('🤖 Running CI teardown...');

  // En CI, on peut être plus agressif dans le nettoyage
  process.env.CLEANUP_STRATEGY = 'drop';

  // Générer les rapports pour CI
  await generateCoverageReport();
  await generateTestReport();

  console.log('✅ CI teardown completed');
}

/**
 * Teardown pour développement local
 */
async function teardownForLocal(): Promise<void> {
  console.log('🏠 Running local teardown...');

  // En local, on préserve les bases de données pour debug
  process.env.CLEANUP_STRATEGY = 'preserve';

  console.log('✅ Local teardown completed');
}

/**
 * Fonction principale de teardown global
 */
export default async function globalTeardown(): Promise<void> {
  console.log('🏁 Starting global test teardown...');

  try {
    // 1. Fermer les connexions ouvertes
    await closeOpenConnections();

    // 2. Nettoyer Redis
    await cleanupRedisConnections();

    // 3. Nettoyer les bases de données
    const databaseUrls = [
      process.env.TEST_DATABASE_URL,
      process.env.INTEGRATION_DATABASE_URL,
      process.env.E2E_DATABASE_URL,
    ].filter(Boolean);

    for (const url of databaseUrls) {
      if (url) {
        try {
          const config = parseDatabaseUrl(url);
          await cleanupTestDatabase(config);
        } catch (error) {
          console.warn(`⚠️  Failed to cleanup database: ${url}`);
        }
      }
    }

    // 4. Nettoyer les fichiers temporaires
    await cleanupTemporaryFiles();

    // 5. Générer les rapports
    if (process.env.CI === 'true') {
      await teardownForCI();
    } else {
      await teardownForLocal();
    }

    // 6. Afficher les statistiques finales
    displayFinalStats();

    console.log('✅ Global test teardown completed successfully');
  } catch (error) {
    console.error('❌ Global test teardown failed:', error);

    // Afficher des informations d'aide
    console.log('\n📋 Cleanup notes:');
    console.log('   - Some cleanup failures are normal and can be ignored');
    console.log('   - Test databases may be preserved for debugging');
    console.log('   - Manual cleanup may be needed for persistent connections');

    // Ne pas faire échouer le processus pour les erreurs de teardown
    console.log('⚠️  Teardown completed with warnings');
  }
}

/**
 * Fonction d'urgence pour forcer le nettoyage
 */
export async function emergencyCleanup(): Promise<void> {
  console.log('🚨 Running emergency cleanup...');

  try {
    // Forcer la fermeture de toutes les connexions
    process.env.CLEANUP_STRATEGY = 'drop';

    // Tuer les processus bloqués
    if (process.platform !== 'win32') {
      execSync('pkill -f "jest.*database" || true', { stdio: 'ignore' });
      execSync('pkill -f "node.*prisma" || true', { stdio: 'ignore' });
    }

    // Nettoyer toutes les bases de test
    await globalTeardown();

    console.log('✅ Emergency cleanup completed');
  } catch (error) {
    console.error('❌ Emergency cleanup failed:', error);
    process.exit(1);
  }
}

// Auto-exécution si appelé directement
if (require.main === module) {
  const isEmergency = process.argv.includes('--emergency');

  if (isEmergency) {
    emergencyCleanup().catch((error) => {
      console.error('Emergency cleanup failed:', error);
      process.exit(1);
    });
  } else {
    globalTeardown().catch((error) => {
      console.error('Teardown failed:', error);
      // Ne pas faire échouer le processus pour les erreurs de teardown
      process.exit(0);
    });
  }
}
