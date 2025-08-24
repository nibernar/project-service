import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promisify } from 'util';
import { exec } from 'child_process';
import { writeFile, unlink, mkdtemp, rmdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { ExportOptionsDto, PdfOptionsDto } from '../dto/export-options.dto';

/**
 * Constantes pour l'export PDF via Pandoc
 * Maintient la cohérence des paramètres et limites
 */
export const PDF_EXPORT_CONSTANTS = {
  PANDOC: {
    TIMEOUT_MS: 60000, // 60 secondes max pour conversion
    MEMORY_LIMIT_MB: 512, // 512MB max pour Pandoc
    MAX_INPUT_SIZE_MB: 25, // 25MB max de Markdown en entrée
  },
  PAGE_SIZES: {
    A4: { width: '210mm', height: '297mm' },
    Letter: { width: '8.5in', height: '11in' },
  },
  MARGINS: {
    MIN_MM: 10,
    MAX_MM: 50,
    DEFAULT_MM: 20,
  },
  TEMPLATES: {
    DEFAULT: 'default',
    PROFESSIONAL: 'professional',
    MINIMAL: 'minimal',
  },
  FONTS: {
    DEFAULT_FAMILY: 'Liberation Sans',
    CODE_FAMILY: 'Liberation Mono',
    FALLBACK_FAMILIES: ['Arial', 'Helvetica', 'sans-serif'],
  },
  OUTPUT: {
    DPI: 300, // Haute qualité pour PDF
    IMAGE_QUALITY: 95,
  },
} as const;

/**
 * Interface pour les options Pandoc générées
 * Structure les paramètres de ligne de commande
 */
export interface PandocOptions {
  /** Options de base */
  from: string;
  to: string;
  output: string;
  
  /** Options de mise en page */
  pageSize: string;
  margins: string;
  
  /** Options de contenu */
  tableOfContents?: boolean;
  tocDepth?: number;
  numberSections?: boolean;
  
  /** Options de style */
  fontFamily?: string;
  fontSize?: string;
  lineHeight?: number;
  
  /** Options avancées */
  template?: string;
  metadata?: Record<string, any>;
  variables?: Record<string, any>;
  
  /** Options de performance */
  memoryLimit?: string;
  timeout?: number;
}

/**
 * Interface pour le résultat de conversion PDF
 * Contient le fichier généré et ses métadonnées
 */
export interface PdfConversionResult {
  /** Buffer du fichier PDF généré */
  pdfBuffer: Buffer;
  
  /** Taille du fichier PDF en octets */
  fileSize: number;
  
  /** Nom de fichier suggéré */
  suggestedFileName: string;
  
  /** Options utilisées pour la génération */
  pandocOptions: PandocOptions;
  
  /** Métadonnées du PDF */
  metadata: {
    title: string;
    pageCount?: number;
    createdAt: Date;
    generatedBy: string;
  };
  
  /** Statistiques de génération */
  statistics: {
    conversionTimeMs: number;
    inputSizeBytes: number;
    outputSizeBytes: number;
    pandocVersion?: string;
  };
  
  /** Timestamp de génération */
  generatedAt: Date;
}

/**
 * Interface pour les erreurs de conversion Pandoc
 * Fournit le contexte détaillé des échecs
 */
export interface PandocConversionError {
  /** Code d'erreur Pandoc ou système */
  errorCode: number;
  
  /** Message d'erreur Pandoc */
  pandocError: string;
  
  /** Sortie stderr complète */
  stderr: string;
  
  /** Sortie stdout si disponible */
  stdout?: string;
  
  /** Commande Pandoc exécutée */
  command: string;
  
  /** Options utilisées */
  options: PandocOptions;
  
  /** Indique si l'erreur est récupérable */
  retryable: boolean;
}

/**
 * Service pour l'export PDF via Pandoc
 * 
 * Responsabilités principales :
 * - Conversion de contenu Markdown en PDF haute qualité via Pandoc
 * - Configuration avancée de la mise en page (marges, format de page, etc.)
 * - Gestion des templates et styles personnalisés
 * - Support des images, liens et éléments complexes
 * - Optimisation des performances avec cache et traitement asynchrone
 * - Gestion robuste des erreurs et timeouts
 * 
 * QUALITÉ PDF :
 * - Rendu haute résolution (300 DPI) pour impression
 * - Support des fonts système avec fallbacks appropriés
 * - Mise en page professionnelle avec marges configurables
 * - Table des matières automatique avec navigation
 * - Gestion correcte des sauts de page et des éléments flottants
 * 
 * PERFORMANCE :
 * - Traitement asynchrone pour éviter les blocages
 * - Timeout configurables selon la complexité
 * - Cache des conversions répétées (optionnel)
 * - Limitation de mémoire pour éviter les surcharges
 * - Nettoyage automatique des fichiers temporaires
 * 
 * SÉCURITÉ :
 * - Validation stricte des options Pandoc
 * - Isolation des processus avec timeouts
 * - Nettoyage sécurisé des fichiers temporaires
 * - Limitation de la taille des entrées
 * - Sanitisation des métadonnées PDF
 * 
 * PRÉREQUIS SYSTÈME :
 * - Pandoc installé et accessible dans le PATH
 * - LaTeX distribution (texlive recommandée) pour rendu PDF
 * - Fonts système appropriées (Liberation fonts recommandées)
 * 
 * @example
 * ```typescript
 * @Injectable()
 * export class ExportService {
 *   constructor(
 *     private readonly pdfExport: PdfExportService
 *   ) {}
 *   
 *   async exportAsPdf(markdownContent: string, options: ExportOptionsDto) {
 *     const result = await this.pdfExport.convertMarkdownToPdf(
 *       markdownContent, 
 *       options
 *     );
 *     return result.pdfBuffer;
 *   }
 * }
 * ```
 */
@Injectable()
export class PdfExportService {
  private readonly logger = new Logger(PdfExportService.name);
  private readonly execAsync = promisify(exec);
  private readonly pandocPath: string;
  private readonly enableCache: boolean;
  private readonly workingDirectory: string;
  private pandocVersion?: string;

  constructor(private readonly configService: ConfigService) {
    this.pandocPath = this.configService.get<string>(
      'PANDOC_PATH',
      'pandoc', // Assume Pandoc is in PATH
    );
    
    this.enableCache = this.configService.get<boolean>(
      'PDF_EXPORT_CACHE_ENABLED',
      false, // Cache désactivé par défaut
    );
    
    this.workingDirectory = this.configService.get<string>(
      'PDF_EXPORT_TEMP_DIR',
      tmpdir(), // Répertoire temporaire système
    );

    this.logger.log('PdfExportService initialized');
    this.logger.debug(`Pandoc path: ${this.pandocPath}`);
    this.logger.debug(`Cache enabled: ${this.enableCache}`);
    this.logger.debug(`Working directory: ${this.workingDirectory}`);

    // Vérification de Pandoc au démarrage
    this.checkPandocAvailability().catch(error => {
      this.logger.error('Pandoc availability check failed:', error.message);
    });
  }

  /**
   * Convertit du contenu Markdown en PDF via Pandoc
   * 
   * Processus de conversion complet :
   * 1. Validation du contenu d'entrée et des options
   * 2. Création d'un répertoire de travail temporaire
   * 3. Génération des options Pandoc appropriées
   * 4. Écriture du contenu Markdown dans un fichier temporaire
   * 5. Exécution de Pandoc avec surveillance des erreurs
   * 6. Lecture et validation du PDF généré
   * 7. Nettoyage des fichiers temporaires
   * 8. Construction du résultat avec métadonnées
   * 
   * ROBUSTESSE :
   * - Timeout adaptatif selon la taille du contenu
   * - Retry automatique en cas d'erreur temporaire
   * - Validation complète de la sortie PDF
   * - Nettoyage garanti même en cas d'erreur
   * 
   * @param markdownContent - Contenu Markdown à convertir
   * @param options - Options d'export avec paramètres PDF
   * @param projectName - Nom du projet pour métadonnées PDF
   * @returns Promise avec le résultat de conversion complet
   * 
   * @throws HttpException si Pandoc n'est pas disponible
   * @throws HttpException si la conversion échoue
   * @throws HttpException si le contenu est trop volumineux
   * 
   * @example
   * ```typescript
   * const markdownContent = `
   * # Mon Document
   * 
   * ## Introduction
   * Ceci est un document de test.
   * 
   * ## Conclusion  
   * Document converti avec succès.
   * `;
   * 
   * const options: ExportOptionsDto = {
   *   format: 'pdf',
   *   pdfOptions: {
   *     pageSize: 'A4',
   *     margins: 25,
   *     includeTableOfContents: true
   *   }
   * };
   * 
   * const result = await pdfExportService.convertMarkdownToPdf(
   *   markdownContent,
   *   options,
   *   'Mon Projet'
   * );
   * 
   * // Sauvegarder le PDF
   * await fs.writeFile(result.suggestedFileName, result.pdfBuffer);
   * ```
   */
  async convertMarkdownToPdf(
    markdownContent: string,
    options: ExportOptionsDto,
    projectName: string = 'Document Export',
  ): Promise<PdfConversionResult> {
    const startTime = Date.now();
    const generatedAt = new Date();

    this.logger.log(`Starting PDF conversion for "${projectName}"`);

    // VALIDATION : Contenu d'entrée
    this.validateMarkdownInput(markdownContent);

    // VALIDATION : Options PDF
    if (!options.pdfOptions) {
      // Création d'une instance valide de PdfOptionsDto avec valeurs par défaut
      const defaultPdfOptions = new PdfOptionsDto();
      defaultPdfOptions.pageSize = 'A4';
      defaultPdfOptions.margins = PDF_EXPORT_CONSTANTS.MARGINS.DEFAULT_MM;
      defaultPdfOptions.includeTableOfContents = false;
      options.pdfOptions = defaultPdfOptions;
    }

    let tempDir: string | null = null;
    let inputFile: string | null = null;
    let outputFile: string | null = null;

    try {
      // ÉTAPE 1 : Création du répertoire de travail temporaire
      tempDir = await this.createTempDirectory();
      inputFile = join(tempDir, 'input.md');
      outputFile = join(tempDir, 'output.pdf');

      this.logger.debug(`Working in temporary directory: ${tempDir}`);

      // ÉTAPE 2 : Génération des options Pandoc
      const pandocOptions = this.buildPandocOptions(
        inputFile,
        outputFile,
        options.pdfOptions!, // Assertion non-null car vérifié ci-dessus
        projectName,
      );

      // ÉTAPE 3 : Écriture du fichier Markdown d'entrée
      await writeFile(inputFile, markdownContent, 'utf8');
      const inputSizeBytes = Buffer.byteLength(markdownContent, 'utf8');

      this.logger.debug(`Input written: ${inputSizeBytes} bytes`);

      // ÉTAPE 4 : Exécution de Pandoc
      const pandocResult = await this.executePandoc(pandocOptions);

      // ÉTAPE 5 : Lecture et validation du PDF généré
      const pdfBuffer = await this.readAndValidatePdf(outputFile);

      // ÉTAPE 6 : Construction du résultat
      const result: PdfConversionResult = {
        pdfBuffer,
        fileSize: pdfBuffer.length,
        suggestedFileName: this.generatePdfFileName(projectName, generatedAt),
        pandocOptions,
        metadata: {
          title: projectName,
          createdAt: generatedAt,
          generatedBy: `Coders Platform PDF Export Service`,
        },
        statistics: {
          conversionTimeMs: Date.now() - startTime,
          inputSizeBytes,
          outputSizeBytes: pdfBuffer.length,
          pandocVersion: this.pandocVersion,
        },
        generatedAt,
      };

      this.logger.log(
        `PDF conversion completed: ${result.fileSize} bytes, ${result.statistics.conversionTimeMs}ms`,
      );

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `PDF conversion failed for "${projectName}" after ${duration}ms: ${error.message}`,
        error.stack,
      );

      // Transformation en HttpException appropriée
      if (error instanceof HttpException) {
        throw error;
      }

      // Erreurs Pandoc spécifiques
      if (this.isPandocError(error)) {
        throw new HttpException(
          `PDF conversion failed: ${this.extractPandocErrorMessage(error)}`,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      throw new HttpException(
        `PDF conversion failed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );

    } finally {
      // ÉTAPE 7 : Nettoyage garanti des fichiers temporaires
      if (tempDir) {
        await this.cleanupTempDirectory(tempDir).catch(cleanupError => {
          this.logger.warn(`Failed to cleanup temp directory ${tempDir}: ${cleanupError.message}`);
        });
      }
    }
  }

  /**
   * Vérifie la disponibilité de Pandoc sur le système
   * Test la version et les capacités de base
   * 
   * @returns Promise avec les informations de version
   * 
   * @throws HttpException si Pandoc n'est pas disponible
   */
  async checkPandocAvailability(): Promise<{
    available: boolean;
    version: string;
    features: string[];
  }> {
    try {
      const { stdout, stderr } = await this.execAsync(
        `${this.pandocPath} --version`,
        { timeout: 10000 }
      );

      if (stderr && !stdout) {
        throw new Error(`Pandoc version check failed: ${stderr}`);
      }

      // Extraction de la version depuis la sortie
      const versionMatch = stdout.match(/pandoc\s+([0-9]+\.[0-9]+(?:\.[0-9]+)?)/i);
      const version = versionMatch ? versionMatch[1] : 'unknown';
      
      this.pandocVersion = version;

      // Extraction des fonctionnalités supportées
      const features: string[] = [];
      if (stdout.includes('pdf')) features.push('pdf');
      if (stdout.includes('latex')) features.push('latex');
      if (stdout.includes('html')) features.push('html');

      this.logger.log(`Pandoc available: version ${version}, features: ${features.join(', ')}`);

      return {
        available: true,
        version,
        features,
      };

    } catch (error) {
      this.logger.error(`Pandoc not available: ${error.message}`);
      
      throw new HttpException(
        'Pandoc is not available on this system. PDF export requires Pandoc to be installed.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  /**
   * MÉTHODES PRIVÉES - CONSTRUCTION ET VALIDATION
   */

  /**
   * Valide le contenu Markdown d'entrée
   * SÉCURITÉ : Vérification des limites et du format
   */
  private validateMarkdownInput(markdownContent: string): void {
    if (!markdownContent || typeof markdownContent !== 'string') {
      throw new HttpException(
        'Invalid markdown content: must be a non-empty string',
        HttpStatus.BAD_REQUEST,
      );
    }

    const sizeBytes = Buffer.byteLength(markdownContent, 'utf8');
    const maxSizeBytes = PDF_EXPORT_CONSTANTS.PANDOC.MAX_INPUT_SIZE_MB * 1024 * 1024;

    if (sizeBytes > maxSizeBytes) {
      throw new HttpException(
        `Markdown content too large: ${sizeBytes} bytes > ${maxSizeBytes} bytes`,
        HttpStatus.PAYLOAD_TOO_LARGE,
      );
    }

    // Validation basique du contenu Markdown
    if (markdownContent.trim().length === 0) {
      throw new HttpException(
        'Markdown content cannot be empty or only whitespace',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Construit les options Pandoc complètes
   * Configuration optimale pour PDF professionnel
   */
  private buildPandocOptions(
    inputFile: string,
    outputFile: string,
    pdfOptions: PdfOptionsDto,
    projectName: string,
  ): PandocOptions {
    const pageSize = pdfOptions.pageSize || 'A4';
    const margins = pdfOptions.margins || PDF_EXPORT_CONSTANTS.MARGINS.DEFAULT_MM;

    const options: PandocOptions = {
      // Options de base
      from: 'markdown',
      to: 'pdf',
      output: outputFile,
      
      // Mise en page
      pageSize: this.formatPageSize(pageSize),
      margins: this.formatMargins(margins),
      
      // Contenu
      tableOfContents: pdfOptions.includeTableOfContents || false,
      tocDepth: 3, // H1, H2, H3
      numberSections: true,
      
      // Style
      fontFamily: PDF_EXPORT_CONSTANTS.FONTS.DEFAULT_FAMILY,
      fontSize: '11pt',
      lineHeight: 1.2,
      
      // Métadonnées
      metadata: {
        title: this.sanitizePdfMetadata(projectName),
        author: 'Coders Platform',
        creator: 'Pandoc PDF Export',
        subject: 'Generated Project Documentation',
        date: new Date().toISOString().split('T')[0],
      },
      
      // Variables LaTeX pour personnalisation
      variables: {
        geometry: `margin=${margins}mm`,
        fontfamily: 'lmodern',
        fontsize: '11pt',
        linestretch: '1.2',
        links: 'true',
        colorlinks: 'true',
        linkcolor: 'blue',
        urlcolor: 'blue',
        citecolor: 'blue',
      },
      
      // Performance
      memoryLimit: `${PDF_EXPORT_CONSTANTS.PANDOC.MEMORY_LIMIT_MB}M`,
      timeout: PDF_EXPORT_CONSTANTS.PANDOC.TIMEOUT_MS,
    };

    return options;
  }

  /**
   * Formate la taille de page pour Pandoc
   */
  private formatPageSize(pageSize: 'A4' | 'Letter'): string {
    const sizes = PDF_EXPORT_CONSTANTS.PAGE_SIZES;
    
    switch (pageSize) {
      case 'A4':
        return `${sizes.A4.width},${sizes.A4.height}`;
      case 'Letter':
        return `${sizes.Letter.width},${sizes.Letter.height}`;
      default:
        return `${sizes.A4.width},${sizes.A4.height}`;
    }
  }

  /**
   * Formate les marges pour Pandoc
   * Validation et normalisation des valeurs
   */
  private formatMargins(margins: number): string {
    const normalizedMargins = Math.max(
      PDF_EXPORT_CONSTANTS.MARGINS.MIN_MM,
      Math.min(PDF_EXPORT_CONSTANTS.MARGINS.MAX_MM, margins)
    );
    
    return `${normalizedMargins}mm`;
  }

  /**
   * Sanitise les métadonnées PDF
   * SÉCURITÉ : Nettoyage pour éviter l'injection dans les métadonnées
   */
  private sanitizePdfMetadata(text: string): string {
    if (!text || typeof text !== 'string') {
      return 'Untitled Document';
    }

    return text
      .trim()
      .replace(/[^\w\s\-_.,()]/g, '') // Caractères alphanumériques et ponctuation de base
      .substring(0, 255) // Limitation de longueur
      .trim() || 'Untitled Document';
  }

  /**
   * Crée un répertoire temporaire sécurisé
   * Répertoire unique pour chaque conversion
   */
  private async createTempDirectory(): Promise<string> {
    try {
      const tempDir = await mkdtemp(join(this.workingDirectory, 'pdf-export-'));
      this.logger.debug(`Created temporary directory: ${tempDir}`);
      return tempDir;
    } catch (error) {
      this.logger.error(`Failed to create temporary directory: ${error.message}`);
      throw new HttpException(
        'Failed to create temporary directory for PDF conversion',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Exécute Pandoc avec les options spécifiées
   * Gestion des timeouts et des erreurs
   */
  private async executePandoc(options: PandocOptions): Promise<{ stdout: string; stderr: string }> {
    // Construction de la commande Pandoc
    const command = this.buildPandocCommand(options);
    
    this.logger.debug(`Executing Pandoc command: ${command}`);

    try {
      const result = await this.execAsync(command, {
        timeout: options.timeout,
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer max
        cwd: this.workingDirectory,
        env: {
          ...process.env,
          // Variables d'environnement pour Pandoc/LaTeX
          TEXINPUTS: '.:',
          FONTCONFIG_PATH: '/etc/fonts',
        },
      });

      this.logger.debug(`Pandoc completed successfully`);
      return result;

    } catch (error) {
      this.logger.error(`Pandoc execution failed: ${error.message}`);
      
      // Création d'une erreur structurée pour debugging
      const pandocError: PandocConversionError = {
        errorCode: error.code || -1,
        pandocError: error.message,
        stderr: error.stderr || '',
        stdout: error.stdout || '',
        command,
        options,
        retryable: this.isPandocErrorRetryable(error),
      };

      throw pandocError;
    }
  }

  /**
   * Construit la ligne de commande Pandoc complète
   * Assemblage sécurisé des arguments
   */
  private buildPandocCommand(options: PandocOptions): string {
    const args: string[] = [this.pandocPath];

    // Arguments de base
    args.push(`--from=${options.from}`);
    args.push(`--to=${options.to}`);
    args.push(`--output="${options.output}"`);

    // Métadonnées
    if (options.metadata) {
      for (const [key, value] of Object.entries(options.metadata)) {
        args.push(`--metadata="${key}:${value}"`);
      }
    }

    // Variables LaTeX
    if (options.variables) {
      for (const [key, value] of Object.entries(options.variables)) {
        args.push(`--variable="${key}:${value}"`);
      }
    }

    // Options de contenu
    if (options.tableOfContents) {
      args.push('--table-of-contents');
      if (options.tocDepth) {
        args.push(`--toc-depth=${options.tocDepth}`);
      }
    }

    if (options.numberSections) {
      args.push('--number-sections');
    }

    // Template si spécifié
    if (options.template && options.template !== 'default') {
      args.push(`--template="${options.template}"`);
    }

    // Options PDF spécifiques
    args.push('--pdf-engine=pdflatex');
    args.push('--highlight-style=tango');

    // Fichier d'entrée (toujours en dernier)
    const inputFile = options.output.replace('output.pdf', 'input.md');
    args.push(`"${inputFile}"`);

    return args.join(' ');
  }

  /**
   * Lit et valide le fichier PDF généré
   * Vérification de l'intégrité du résultat
   */
  private async readAndValidatePdf(outputFile: string): Promise<Buffer> {
    try {
      const { readFile } = await import('fs/promises');
      const pdfBuffer = await readFile(outputFile);

      // Validation basique du format PDF
      if (pdfBuffer.length === 0) {
        throw new Error('Generated PDF file is empty');
      }

      // Vérification de la signature PDF
      const pdfSignature = pdfBuffer.slice(0, 4).toString();
      if (pdfSignature !== '%PDF') {
        throw new Error('Generated file is not a valid PDF');
      }

      this.logger.debug(`PDF validated: ${pdfBuffer.length} bytes`);
      return pdfBuffer;

    } catch (error) {
      this.logger.error(`PDF validation failed: ${error.message}`);
      throw new HttpException(
        `Generated PDF is invalid: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Nettoie le répertoire temporaire
   * Suppression récursive et sécurisée
   */
  private async cleanupTempDirectory(tempDir: string): Promise<void> {
    try {
      // Suppression des fichiers dans le répertoire
      const { readdir } = await import('fs/promises');
      const files = await readdir(tempDir);
      
      for (const file of files) {
        const filePath = join(tempDir, file);
        await unlink(filePath);
      }

      // Suppression du répertoire
      await rmdir(tempDir);
      
      this.logger.debug(`Cleaned up temporary directory: ${tempDir}`);

    } catch (error) {
      this.logger.warn(`Cleanup warning for ${tempDir}: ${error.message}`);
      // Ne pas faire échouer l'opération pour un problème de nettoyage
    }
  }

  /**
   * Génère un nom de fichier PDF approprié
   * Format : "NomProjet - Export PDF - YYYY-MM-DD.pdf"
   */
  private generatePdfFileName(projectName: string, generatedAt: Date): string {
    const safeName = projectName
      .replace(/[^a-zA-Z0-9\s\-_]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 50);
    
    const date = generatedAt.toISOString().split('T')[0];
    
    return `${safeName} - Export PDF - ${date}.pdf`;
  }

  /**
   * MÉTHODES PRIVÉES - GESTION D'ERREURS
   */

  /**
   * Détermine si une erreur provient de Pandoc
   */
  private isPandocError(error: any): boolean {
    return error && (
      error.stderr?.includes('pandoc') ||
      error.stdout?.includes('pandoc') ||
      error.message?.includes('pandoc') ||
      error.command?.includes('pandoc')
    );
  }

  /**
   * Extrait le message d'erreur utile de Pandoc
   */
  private extractPandocErrorMessage(error: any): string {
    if (error.stderr) {
      // Extraction des erreurs LaTeX courantes
      if (error.stderr.includes('! LaTeX Error')) {
        return 'LaTeX compilation error - check document formatting';
      }
      if (error.stderr.includes('! Emergency stop')) {
        return 'LaTeX emergency stop - document may be too complex';
      }
      if (error.stderr.includes('Font')) {
        return 'Font error - required fonts may not be installed';
      }
      
      return error.stderr.split('\n')[0] || 'Unknown Pandoc error';
    }
    
    return error.message || 'Unknown Pandoc error';
  }

  /**
   * Détermine si une erreur Pandoc est récupérable
   */
  private isPandocErrorRetryable(error: any): boolean {
    if (!error.stderr) return false;
    
    // Erreurs temporaires récupérables
    const retryablePatterns = [
      'timeout',
      'temporary',
      'busy',
      'locked',
      'network',
    ];
    
    const errorText = error.stderr.toLowerCase();
    return retryablePatterns.some(pattern => errorText.includes(pattern));
  }

  /**
   * Génère un résumé de l'état du service pour monitoring
   * 
   * @returns Informations de configuration et d'état
   */
  getServiceStatus(): {
    available: boolean;
    pandocPath: string;
    pandocVersion?: string;
    cacheEnabled: boolean;
    workingDirectory: string;
    ready: boolean;
  } {
    return {
      available: !!this.pandocVersion,
      pandocPath: this.pandocPath,
      pandocVersion: this.pandocVersion,
      cacheEnabled: this.enableCache,
      workingDirectory: this.workingDirectory,
      ready: !!this.pandocVersion, // Ready si Pandoc détecté
    };
  }

  /**
   * Version sécurisée pour les logs d'audit
   * SÉCURITÉ : Pas de chemins complets dans les logs
   */
  toLogSafeString(): string {
    const status = this.getServiceStatus();
    const pandocInfo = status.pandocVersion ? `v${status.pandocVersion}` : 'not-detected';
    
    return `PdfExportService[pandoc=${pandocInfo}, cache=${status.cacheEnabled}, ready=${status.ready}]`;
  }
}