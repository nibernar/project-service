// scripts/validate-coverage.ts

import * as fs from 'fs';
import * as path from 'path';

/**
 * Script de validation de la couverture de code pour DatabaseService
 * Vérifie que les seuils de couverture sont respectés et génère des rapports détaillés
 */

interface CoverageData {
  lines: { total: number; covered: number; skipped: number; pct: number };
  functions: { total: number; covered: number; skipped: number; pct: number };
  statements: { total: number; covered: number; skipped: number; pct: number };
  branches: { total: number; covered: number; skipped: number; pct: number };
}

interface CoverageReport {
  [filePath: string]: CoverageData;
}

interface CoverageThresholds {
  lines: number;
  functions: number;
  statements: number;
  branches: number;
}

interface ValidationResult {
  passed: boolean;
  failures: string[];
  warnings: string[];
  summary: {
    totalFiles: number;
    passedFiles: number;
    failedFiles: number;
    overallCoverage: CoverageData;
  };
}

/**
 * Seuils de couverture requis
 */
const COVERAGE_THRESHOLDS: CoverageThresholds = {
  lines: 95,
  functions: 100,
  statements: 95,
  branches: 90,
};

/**
 * Seuils spécifiques par fichier critique
 */
const FILE_SPECIFIC_THRESHOLDS: Record<string, Partial<CoverageThresholds>> = {
  'src/database/database.service.ts': {
    lines: 98,
    functions: 100,
    statements: 98,
    branches: 95,
  },
};

/**
 * Fichiers exclus de la validation stricte
 */
const EXCLUDED_FILES = [
  'src/database/database.module.ts', // Module simple
  'src/database/*.interface.ts',     // Interfaces TypeScript
  'src/database/*.d.ts',             // Fichiers de déclaration
];

/**
 * Couleurs pour l'affichage console
 */
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
};

/**
 * Fonction utilitaire pour afficher avec couleur
 */
function colorLog(message: string, color: keyof typeof colors): void {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Lit et parse le rapport de couverture JSON
 */
function readCoverageReport(): CoverageReport {
  const coveragePath = path.join(process.cwd(), 'coverage', 'coverage-summary.json');
  
  if (!fs.existsSync(coveragePath)) {
    throw new Error(`❌ Rapport de couverture non trouvé: ${coveragePath}`);
  }
  
  try {
    const coverageData = fs.readFileSync(coveragePath, 'utf-8');
    return JSON.parse(coverageData);
  } catch (error) {
    throw new Error(`❌ Erreur lors de la lecture du rapport: ${error.message}`);
  }
}

/**
 * Vérifie si un fichier doit être exclu de la validation
 */
function isFileExcluded(filePath: string): boolean {
  return EXCLUDED_FILES.some(pattern => {
    if (pattern.includes('*')) {
      const regex = new RegExp(pattern.replace('*', '.*'));
      return regex.test(filePath);
    }
    return filePath.includes(pattern);
  });
}

/**
 * Obtient les seuils applicables pour un fichier
 */
function getThresholdsForFile(filePath: string): CoverageThresholds {
  const specificThresholds = FILE_SPECIFIC_THRESHOLDS[filePath];
  return {
    ...COVERAGE_THRESHOLDS,
    ...specificThresholds,
  };
}

/**
 * Valide la couverture d'un fichier
 */
function validateFileCoverage(
  filePath: string,
  coverage: CoverageData,
  thresholds: CoverageThresholds
): { passed: boolean; failures: string[]; warnings: string[] } {
  const failures: string[] = [];
  const warnings: string[] = [];
  
  // Vérification des seuils obligatoires
  if (coverage.lines.pct < thresholds.lines) {
    failures.push(`Lines: ${coverage.lines.pct}% < ${thresholds.lines}%`);
  }
  
  if (coverage.functions.pct < thresholds.functions) {
    failures.push(`Functions: ${coverage.functions.pct}% < ${thresholds.functions}%`);
  }
  
  if (coverage.statements.pct < thresholds.statements) {
    failures.push(`Statements: ${coverage.statements.pct}% < ${thresholds.statements}%`);
  }
  
  if (coverage.branches.pct < thresholds.branches) {
    failures.push(`Branches: ${coverage.branches.pct}% < ${thresholds.branches}%`);
  }
  
  // Avertissements pour les cas proches des seuils
  const warningMargin = 2; // 2% de marge
  
  if (coverage.lines.pct < thresholds.lines + warningMargin && coverage.lines.pct >= thresholds.lines) {
    warnings.push(`Lines proche du seuil: ${coverage.lines.pct}%`);
  }
  
  if (coverage.branches.pct < thresholds.branches + warningMargin && coverage.branches.pct >= thresholds.branches) {
    warnings.push(`Branches proche du seuil: ${coverage.branches.pct}%`);
  }
  
  return {
    passed: failures.length === 0,
    failures,
    warnings,
  };
}

/**
 * Calcule la couverture globale
 */
function calculateOverallCoverage(report: CoverageReport): CoverageData {
  let totalLines = 0, coveredLines = 0;
  let totalFunctions = 0, coveredFunctions = 0;
  let totalStatements = 0, coveredStatements = 0;
  let totalBranches = 0, coveredBranches = 0;
  
  Object.values(report).forEach(coverage => {
    if (coverage.lines) {
      totalLines += coverage.lines.total;
      coveredLines += coverage.lines.covered;
    }
    if (coverage.functions) {
      totalFunctions += coverage.functions.total;
      coveredFunctions += coverage.functions.covered;
    }
    if (coverage.statements) {
      totalStatements += coverage.statements.total;
      coveredStatements += coverage.statements.covered;
    }
    if (coverage.branches) {
      totalBranches += coverage.branches.total;
      coveredBranches += coverage.branches.covered;
    }
  });
  
  return {
    lines: {
      total: totalLines,
      covered: coveredLines,
      skipped: 0,
      pct: totalLines > 0 ? Math.round((coveredLines / totalLines) * 100 * 100) / 100 : 0,
    },
    functions: {
      total: totalFunctions,
      covered: coveredFunctions,
      skipped: 0,
      pct: totalFunctions > 0 ? Math.round((coveredFunctions / totalFunctions) * 100 * 100) / 100 : 0,
    },
    statements: {
      total: totalStatements,
      covered: coveredStatements,
      skipped: 0,
      pct: totalStatements > 0 ? Math.round((coveredStatements / totalStatements) * 100 * 100) / 100 : 0,
    },
    branches: {
      total: totalBranches,
      covered: coveredBranches,
      skipped: 0,
      pct: totalBranches > 0 ? Math.round((coveredBranches / totalBranches) * 100 * 100) / 100 : 0,
    },
  };
}

/**
 * Identifie les lignes non couvertes
 */
function findUncoveredLines(): string[] {
  const lcovPath = path.join(process.cwd(), 'coverage', 'lcov.info');
  
  if (!fs.existsSync(lcovPath)) {
    return ['⚠️  Fichier lcov.info non trouvé'];
  }
  
  try {
    const lcovContent = fs.readFileSync(lcovPath, 'utf-8');
    const uncoveredLines: string[] = [];
    
    let currentFile = '';
    const lines = lcovContent.split('\n');
    
    for (const line of lines) {
      if (line.startsWith('SF:')) {
        currentFile = line.substring(3);
      } else if (line.startsWith('LH:')) {
        const covered = parseInt(line.substring(3));
        if (covered === 0) {
          uncoveredLines.push(`${currentFile}: Aucune ligne couverte`);
        }
      } else if (line.startsWith('DA:')) {
        const parts = line.substring(3).split(',');
        const lineNumber = parts[0];
        const hitCount = parseInt(parts[1]);
        
        if (hitCount === 0 && currentFile.includes('database.service.ts')) {
          uncoveredLines.push(`${currentFile}:${lineNumber}`);
        }
      }
    }
    
    return uncoveredLines.slice(0, 10); // Limiter à 10 exemples
  } catch (error) {
    return [`⚠️  Erreur lors de l'analyse LCOV: ${error.message}`];
  }
}

/**
 * Génère des recommandations pour améliorer la couverture
 */
function generateRecommendations(result: ValidationResult): string[] {
  const recommendations: string[] = [];
  
  if (result.summary.overallCoverage.functions.pct < 100) {
    recommendations.push('🎯 Ajouter des tests pour les fonctions non couvertes');
  }
  
  if (result.summary.overallCoverage.branches.pct < COVERAGE_THRESHOLDS.branches) {
    recommendations.push('🔀 Tester tous les chemins conditionnels (if/else, switch, try/catch)');
  }
  
  if (result.summary.overallCoverage.lines.pct < COVERAGE_THRESHOLDS.lines) {
    recommendations.push('📝 Ajouter des tests pour les lignes de code non exécutées');
  }
  
  if (result.failures.some(f => f.includes('error handling'))) {
    recommendations.push('🚨 Améliorer les tests de gestion d\'erreurs');
  }
  
  if (result.failures.some(f => f.includes('edge cases'))) {
    recommendations.push('🎯 Ajouter des tests pour les cas limites');
  }
  
  recommendations.push('📊 Consulter le rapport HTML détaillé: coverage/lcov-report/index.html');
  
  return recommendations;
}

/**
 * Valide la couverture de code complète
 */
function validateCoverage(): ValidationResult {
  colorLog('\n🔍 Validation de la couverture de code DatabaseService', 'blue');
  colorLog('================================================================', 'blue');
  
  const report = readCoverageReport();
  const failures: string[] = [];
  const warnings: string[] = [];
  let passedFiles = 0;
  let failedFiles = 0;
  
  // Validation par fichier
  Object.entries(report).forEach(([filePath, coverage]) => {
    // Ignorer le total global et les fichiers exclus
    if (filePath === 'total' || isFileExcluded(filePath)) {
      return;
    }
    
    const thresholds = getThresholdsForFile(filePath);
    const validation = validateFileCoverage(filePath, coverage, thresholds);
    
    if (validation.passed) {
      passedFiles++;
      colorLog(`✅ ${filePath}`, 'green');
    } else {
      failedFiles++;
      colorLog(`❌ ${filePath}`, 'red');
      validation.failures.forEach(failure => {
        failures.push(`${filePath}: ${failure}`);
        colorLog(`   ${failure}`, 'red');
      });
    }
    
    validation.warnings.forEach(warning => {
      warnings.push(`${filePath}: ${warning}`);
      colorLog(`   ⚠️  ${warning}`, 'yellow');
    });
  });
  
  const overallCoverage = calculateOverallCoverage(report);
  
  return {
    passed: failures.length === 0,
    failures,
    warnings,
    summary: {
      totalFiles: passedFiles + failedFiles,
      passedFiles,
      failedFiles,
      overallCoverage,
    },
  };
}

/**
 * Affiche le rapport de validation
 */
function displayValidationReport(result: ValidationResult): void {
  colorLog('\n📊 Résumé de la couverture', 'blue');
  colorLog('================================================================', 'blue');
  
  const { overallCoverage } = result.summary;
  
  // Affichage des métriques globales
  console.log(`${colors.bold}Couverture Globale:${colors.reset}`);
  console.log(`  Lines:      ${overallCoverage.lines.pct}% (${overallCoverage.lines.covered}/${overallCoverage.lines.total})`);
  console.log(`  Functions:  ${overallCoverage.functions.pct}% (${overallCoverage.functions.covered}/${overallCoverage.functions.total})`);
  console.log(`  Statements: ${overallCoverage.statements.pct}% (${overallCoverage.statements.covered}/${overallCoverage.statements.total})`);
  console.log(`  Branches:   ${overallCoverage.branches.pct}% (${overallCoverage.branches.covered}/${overallCoverage.branches.total})`);
  
  console.log(`\n${colors.bold}Fichiers:${colors.reset}`);
  console.log(`  Total:  ${result.summary.totalFiles}`);
  console.log(`  ✅ Validés: ${result.summary.passedFiles}`);
  console.log(`  ❌ Échecs:  ${result.summary.failedFiles}`);
  
  // Seuils de validation
  console.log(`\n${colors.bold}Seuils Requis:${colors.reset}`);
  console.log(`  Lines:      ${COVERAGE_THRESHOLDS.lines}%`);
  console.log(`  Functions:  ${COVERAGE_THRESHOLDS.functions}%`);
  console.log(`  Statements: ${COVERAGE_THRESHOLDS.statements}%`);
  console.log(`  Branches:   ${COVERAGE_THRESHOLDS.branches}%`);
  
  // Échecs détaillés
  if (result.failures.length > 0) {
    colorLog('\n❌ Échecs de couverture:', 'red');
    result.failures.forEach(failure => {
      colorLog(`  ${failure}`, 'red');
    });
  }
  
  // Avertissements
  if (result.warnings.length > 0) {
    colorLog('\n⚠️  Avertissements:', 'yellow');
    result.warnings.forEach(warning => {
      colorLog(`  ${warning}`, 'yellow');
    });
  }
  
  // Lignes non couvertes
  const uncoveredLines = findUncoveredLines();
  if (uncoveredLines.length > 0) {
    colorLog('\n🔍 Exemples de lignes non couvertes:', 'yellow');
    uncoveredLines.forEach(line => {
      console.log(`  ${line}`);
    });
  }
  
  // Recommandations
  const recommendations = generateRecommendations(result);
  if (recommendations.length > 0) {
    colorLog('\n💡 Recommandations:', 'blue');
    recommendations.forEach(rec => {
      console.log(`  ${rec}`);
    });
  }
  
  // Résultat final
  console.log('\n' + '='.repeat(64));
  if (result.passed) {
    colorLog('✅ VALIDATION RÉUSSIE - Couverture conforme aux exigences', 'green');
  } else {
    colorLog('❌ VALIDATION ÉCHOUÉE - Couverture insuffisante', 'red');
  }
  console.log('='.repeat(64));
}

/**
 * Sauvegarde le rapport de validation
 */
function saveValidationReport(result: ValidationResult): void {
  const reportDir = path.join(process.cwd(), 'test-results');
  
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }
  
  const reportPath = path.join(reportDir, 'coverage-validation.json');
  const report = {
    timestamp: new Date().toISOString(),
    validation: result,
    thresholds: COVERAGE_THRESHOLDS,
    fileSpecificThresholds: FILE_SPECIFIC_THRESHOLDS,
  };
  
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  colorLog(`📄 Rapport sauvegardé: ${reportPath}`, 'blue');
}

/**
 * Point d'entrée principal
 */
function main(): void {
  try {
    const result = validateCoverage();
    displayValidationReport(result);
    saveValidationReport(result);
    
    // Code de sortie basé sur la validation
    process.exit(result.passed ? 0 : 1);
    
  } catch (error) {
    colorLog(`❌ Erreur lors de la validation: ${error.message}`, 'red');
    process.exit(1);
  }
}

// Exécution si appelé directement
if (require.main === module) {
  main();
}

export {
  validateCoverage,
  displayValidationReport,
  ValidationResult,
  CoverageThresholds,
};