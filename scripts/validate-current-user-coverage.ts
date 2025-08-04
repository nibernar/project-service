// scripts/validate-current-user-coverage.ts

/**
 * Validateur de couverture pour les tests du décorateur CurrentUser
 * 
 * Ce script vérifie que tous les aspects du décorateur sont correctement testés
 * et que la couverture de code respecte les standards de qualité.
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// TYPES ET INTERFACES
// ============================================================================

interface CoverageReport {
  total: {
    lines: { total: number; covered: number; skipped: number; pct: number };
    functions: { total: number; covered: number; skipped: number; pct: number };
    statements: { total: number; covered: number; skipped: number; pct: number };
    branches: { total: number; covered: number; skipped: number; pct: number };
  };
  [filePath: string]: any;
}

interface TestSuiteValidation {
  name: string;
  exists: boolean;
  path: string;
  testCount?: number;
  issues: string[];
}

interface ValidationResult {
  success: boolean;
  coverageValid: boolean;
  testSuitesValid: boolean;
  details: {
    coverage: CoverageReport['total'] | null;
    testSuites: TestSuiteValidation[];
    recommendations: string[];
    errors: string[];
  };
}

// ============================================================================
// CONSTANTES DE VALIDATION
// ============================================================================

const COVERAGE_THRESHOLDS = {
  lines: 95,
  functions: 100,
  statements: 95,
  branches: 95,
};

const REQUIRED_TEST_SUITES = [
  {
    name: 'Tests unitaires principaux',
    pattern: '**/current-user.decorator.spec.ts',
    expectedTests: [
      'Fonctionnement nominal',
      'Validation des données utilisateur',
      'Gestion des contextes',
      'Compatibilité TypeScript',
      'Intégration NestJS',
    ],
  },
  {
    name: 'Tests des cas limites',
    pattern: '**/current-user.decorator.edge-cases.spec.ts',
    expectedTests: [
      'Erreurs - Utilisateur absent',
      'Erreurs - Contexte malformé',
      'Utilisateurs avec données incomplètes',
      'Données utilisateur extrêmes',
      'Types de données inattendus',
      'Contextes dégradés',
    ],
  },
  {
    name: 'Tests de sécurité',
    pattern: '**/current-user.decorator.security.spec.ts',
    expectedTests: [
      'Isolation des données utilisateur',
      'Protection contre les injections',
      'Sécurité des rôles utilisateur',
      'Protection contre la divulgation d\'informations',
      'Protection contre les attaques temporelles',
      'Validation d\'intégrité',
    ],
  },
  {
    name: 'Tests de performance',
    pattern: '**/current-user.decorator.performance.spec.ts',
    expectedTests: [
      'Vitesse d\'exécution',
      'Utilisation mémoire',
      'Tests de stress et charge',
      'Benchmarks de régression',
    ],
  },
  {
    name: 'Tests de régression',
    pattern: '**/current-user.decorator.regression.spec.ts',
    expectedTests: [
      'Régression de performance',
      'Régression de compatibilité',
      'Régression fonctionnelle',
      'Régression de sécurité',
    ],
  },
];

const PROJECT_ROOT = path.resolve(__dirname, '..');
const COVERAGE_FILE = path.join(PROJECT_ROOT, 'coverage', 'current-user-decorator', 'coverage-final.json');
const TEST_DIR = path.join(PROJECT_ROOT, 'test', 'unit', 'common', 'decorators');

// ============================================================================
// FONCTIONS DE VALIDATION
// ============================================================================

/**
 * Valide la couverture de code
 */
function validateCoverage(): { valid: boolean; coverage: CoverageReport['total'] | null; issues: string[] } {
  const issues: string[] = [];
  
  if (!fs.existsSync(COVERAGE_FILE)) {
    issues.push('❌ Fichier de couverture non trouvé. Exécutez les tests avec --coverage');
    return { valid: false, coverage: null, issues };
  }

  try {
    const coverageData: CoverageReport = JSON.parse(fs.readFileSync(COVERAGE_FILE, 'utf8'));
    const total = coverageData.total;

    // Vérification des seuils
    Object.entries(COVERAGE_THRESHOLDS).forEach(([metric, threshold]) => {
      const actual = total[metric as keyof typeof total].pct;
      if (actual < threshold) {
        issues.push(`❌ Couverture ${metric}: ${actual}% < ${threshold}% (seuil requis)`);
      } else {
        console.log(`✅ Couverture ${metric}: ${actual}% >= ${threshold}%`);
      }
    });

    // Vérification spécifique du fichier décorateur
    const decoratorFile = 'src/common/decorators/current-user.decorator.ts';
    if (coverageData[decoratorFile]) {
      const fileCoverage = coverageData[decoratorFile];
      if (fileCoverage.lines?.pct < 100) {
        issues.push(`⚠️  Couverture du décorateur: ${fileCoverage.lines.pct}% (recommandé: 100%)`);
      }
    } else {
      issues.push('❌ Couverture du fichier décorateur non trouvée');
    }

    return { valid: issues.length === 0, coverage: total, issues };

  } catch (error) {
    issues.push(`❌ Erreur de lecture du fichier de couverture: ${error.message}`);
    return { valid: false, coverage: null, issues };
  }
}

/**
 * Valide l'existence et la complétude des suites de tests
 */
function validateTestSuites(): { valid: boolean; suites: TestSuiteValidation[] } {
  const suites: TestSuiteValidation[] = [];

  REQUIRED_TEST_SUITES.forEach(requiredSuite => {
    const validation: TestSuiteValidation = {
      name: requiredSuite.name,
      exists: false,
      path: '',
      issues: [],
    };

    // Recherche du fichier de test
    const testFiles = findTestFiles(TEST_DIR, requiredSuite.pattern);
    
    if (testFiles.length === 0) {
      validation.issues.push(`❌ Fichier de test non trouvé: ${requiredSuite.pattern}`);
    } else if (testFiles.length > 1) {
      validation.issues.push(`⚠️  Plusieurs fichiers trouvés: ${testFiles.join(', ')}`);
      validation.exists = true;
      validation.path = testFiles[0];
    } else {
      validation.exists = true;
      validation.path = testFiles[0];
      
      // Validation du contenu
      const contentValidation = validateTestFileContent(testFiles[0], requiredSuite.expectedTests);
      validation.testCount = contentValidation.testCount;
      validation.issues.push(...contentValidation.issues);
    }

    suites.push(validation);
  });

  const allValid = suites.every(suite => suite.exists && suite.issues.length === 0);
  return { valid: allValid, suites };
}

/**
 * Recherche les fichiers de test correspondant à un pattern
 */
function findTestFiles(dir: string, pattern: string): string[] {
  const files: string[] = [];
  
  if (!fs.existsSync(dir)) {
    return files;
  }

  const items = fs.readdirSync(dir);
  
  items.forEach(item => {
    const itemPath = path.join(dir, item);
    const stat = fs.statSync(itemPath);
    
    if (stat.isDirectory()) {
      files.push(...findTestFiles(itemPath, pattern));
    } else if (stat.isFile() && item.match(pattern.replace('**/', '').replace('*', '.*'))) {
      files.push(itemPath);
    }
  });

  return files;
}

/**
 * Valide le contenu d'un fichier de test
 */
function validateTestFileContent(filePath: string, expectedTests: string[]): { testCount: number; issues: string[] } {
  const issues: string[] = [];
  let testCount = 0;

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Compter les tests
    const testMatches = content.match(/\s*(it|test)\s*\(/g);
    testCount = testMatches ? testMatches.length : 0;

    // Vérifier la présence des sections attendues
    expectedTests.forEach(expectedTest => {
      const regex = new RegExp(`describe\\s*\\(\\s*['"\`].*${expectedTest.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.*['"\`]`, 'i');
      if (!regex.test(content)) {
        issues.push(`⚠️  Section manquante: "${expectedTest}"`);
      }
    });

    // Vérifications de structure
    if (!content.includes('describe(')) {
      issues.push('❌ Aucun bloc describe trouvé');
    }

    if (testCount === 0) {
      issues.push('❌ Aucun test trouvé');
    } else if (testCount < 5) {
      issues.push(`⚠️  Peu de tests: ${testCount} (recommandé: >5)`);
    }

    // Vérifications de qualité
    if (!content.includes('expect(')) {
      issues.push('❌ Aucune assertion trouvée');
    }

    if (!content.includes('beforeEach') && !content.includes('beforeAll')) {
      issues.push('⚠️  Aucun setup de test trouvé');
    }

  } catch (error) {
    issues.push(`❌ Erreur de lecture du fichier: ${error.message}`);
  }

  return { testCount, issues };
}

/**
 * Génère des recommandations d'amélioration
 */
function generateRecommendations(validationResult: ValidationResult): string[] {
  const recommendations: string[] = [];

  // Recommandations de couverture
  if (!validationResult.coverageValid) {
    recommendations.push('🔧 Améliorer la couverture de code en ajoutant des tests pour les branches non couvertes');
    recommendations.push('🔧 Utiliser --coverage --verbose pour identifier les lignes non testées');
  }

  // Recommandations de tests
  const missingTests = validationResult.details.testSuites.filter(suite => !suite.exists);
  if (missingTests.length > 0) {
    recommendations.push(`🔧 Créer les suites de tests manquantes: ${missingTests.map(t => t.name).join(', ')}`);
  }

  const incompleteTests = validationResult.details.testSuites.filter(suite => suite.exists && suite.issues.length > 0);
  if (incompleteTests.length > 0) {
    recommendations.push('🔧 Compléter les suites de tests existantes avec les sections manquantes');
  }

  // Recommandations générales
  if (validationResult.success) {
    recommendations.push('✅ Excellente couverture ! Maintenir ce niveau de qualité');
    recommendations.push('🚀 Considérer l\'ajout de tests de mutation pour valider la robustesse');
  } else {
    recommendations.push('📈 Prioriser la résolution des erreurs avant d\'ajouter de nouvelles fonctionnalités');
  }

  return recommendations;
}

/**
 * Affiche un rapport détaillé
 */
function displayReport(validationResult: ValidationResult): void {
  console.log('\n' + '='.repeat(80));
  console.log('📊 RAPPORT DE VALIDATION - TESTS CURRENT USER DECORATOR');
  console.log('='.repeat(80));

  // Statut global
  console.log(`\n🎯 STATUT GLOBAL: ${validationResult.success ? '✅ VALIDÉ' : '❌ ÉCHEC'}`);

  // Couverture
  console.log(`\n📈 COUVERTURE DE CODE: ${validationResult.coverageValid ? '✅' : '❌'}`);
  if (validationResult.details.coverage) {
    const { coverage } = validationResult.details;
    console.log(`   Lignes: ${coverage.lines.pct}% (${coverage.lines.covered}/${coverage.lines.total})`);
    console.log(`   Fonctions: ${coverage.functions.pct}% (${coverage.functions.covered}/${coverage.functions.total})`);
    console.log(`   Instructions: ${coverage.statements.pct}% (${coverage.statements.covered}/${coverage.statements.total})`);
    console.log(`   Branches: ${coverage.branches.pct}% (${coverage.branches.covered}/${coverage.branches.total})`);
  }

  // Suites de tests
  console.log(`\n🧪 SUITES DE TESTS: ${validationResult.testSuitesValid ? '✅' : '❌'}`);
  validationResult.details.testSuites.forEach(suite => {
    const status = suite.exists ? (suite.issues.length === 0 ? '✅' : '⚠️ ') : '❌';
    console.log(`   ${status} ${suite.name} ${suite.testCount ? `(${suite.testCount} tests)` : ''}`);
    suite.issues.forEach(issue => console.log(`      ${issue}`));
  });

  // Erreurs
  if (validationResult.details.errors.length > 0) {
    console.log('\n❌ ERREURS:');
    validationResult.details.errors.forEach(error => console.log(`   ${error}`));
  }

  // Recommandations
  console.log('\n💡 RECOMMANDATIONS:');
  validationResult.details.recommendations.forEach(rec => console.log(`   ${rec}`));

  console.log('\n' + '='.repeat(80));
}

/**
 * Fonction principale de validation
 */
function main(): number {
  console.log('🔍 Validation de la couverture des tests CurrentUser Decorator...\n');

  try {
    // Validation de la couverture
    console.log('📊 Validation de la couverture de code...');
    const coverageValidation = validateCoverage();

    // Validation des suites de tests
    console.log('🧪 Validation des suites de tests...');
    const testSuitesValidation = validateTestSuites();

    // Compilation des résultats
    const validationResult: ValidationResult = {
      success: coverageValidation.valid && testSuitesValidation.valid,
      coverageValid: coverageValidation.valid,
      testSuitesValid: testSuitesValidation.valid,
      details: {
        coverage: coverageValidation.coverage,
        testSuites: testSuitesValidation.suites,
        recommendations: [],
        errors: [...coverageValidation.issues],
      },
    };

    // Collecte des erreurs de tests
    testSuitesValidation.suites.forEach(suite => {
      validationResult.details.errors.push(...suite.issues);
    });

    // Génération des recommandations
    validationResult.details.recommendations = generateRecommendations(validationResult);

    // Affichage du rapport
    displayReport(validationResult);

    // Code de retour
    return validationResult.success ? 0 : 1;

  } catch (error) {
    console.error('❌ Erreur inattendue lors de la validation:', error.message);
    console.error(error.stack);
    return 1;
  }
}

// ============================================================================
// EXÉCUTION
// ============================================================================

if (require.main === module) {
  const exitCode = main();
  process.exit(exitCode);
}

export { main as validateCurrentUserCoverage };