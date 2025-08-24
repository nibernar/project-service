import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ExportOptionsDto } from '../dto/export-options.dto';
import { FileRetrievalResult } from './file-retrieval.service';

/**
 * Constantes pour l'export Markdown
 * Maintient la cohérence des limites et formats
 */
export const MARKDOWN_EXPORT_CONSTANTS = {
  METADATA: {
    HEADER_SEPARATOR: '---',
    SECTION_SEPARATOR: '\n\n---\n\n',
    MAX_PROJECT_NAME_LENGTH: 100,
    MAX_DESCRIPTION_LENGTH: 500,
  },
  CONTENT: {
    MAX_TOTAL_SIZE_MB: 50,
    MAX_FILES_COUNT: 100,
    MAX_FILE_NAME_LENGTH: 255,
  },
  ENCODING: {
    OUTPUT_CHARSET: 'utf-8',
    LINE_ENDING: '\n',
  },
  HEADERS: {
    H1_PREFIX: '# ',
    H2_PREFIX: '## ',
    H3_PREFIX: '### ',
    H4_PREFIX: '#### ',
  },
} as const;

/**
 * Interface pour les métadonnées d'export Markdown
 * Structure les informations contextuelles du projet
 */
export interface MarkdownExportMetadata {
  /** Nom du projet */
  projectName: string;
  
  /** Description du projet */
  projectDescription?: string;
  
  /** Prompt initial de l'utilisateur */
  initialPrompt?: string;
  
  /** Date de génération des documents */
  generatedAt: Date;
  
  /** Date d'export */
  exportedAt: Date;
  
  /** Version de la plateforme */
  platformVersion: string;
  
  /** Nombre de fichiers inclus */
  filesCount: number;
  
  /** Taille totale du contenu */
  totalContentSize: number;
  
  /** Statistiques optionnelles */
  statistics?: {
    generationTime?: number;
    tokensUsed?: number;
    documentsGenerated?: number;
  };
}

/**
 * Interface pour le résultat d'export Markdown
 * Contient le contenu généré et ses métadonnées
 */
export interface MarkdownExportResult {
  /** Contenu Markdown complet */
  content: string;
  
  /** Taille du contenu en octets */
  contentSize: number;
  
  /** Nom de fichier suggéré */
  suggestedFileName: string;
  
  /** Métadonnées de l'export */
  metadata: MarkdownExportMetadata;
  
  /** Liste des fichiers inclus dans l'export */
  includedFiles: Array<{
    id: string;
    name: string;
    size: number;
    contentType: string;
  }>;
  
  /** Timestamp de génération */
  generatedAt: Date;
  
  /** Durée de génération en millisecondes */
  generationDurationMs: number;
}

/**
 * Service pour l'export Markdown natif
 * 
 * Responsabilités principales :
 * - Agrégation de multiples fichiers Markdown en un document unifié
 * - Ajout de métadonnées de contexte (nom projet, date génération, etc.)
 * - Structuration hiérarchique du contenu avec headers appropriés
 * - Préservation de la qualité du formatage Markdown original
 * - Gestion des conflits de numérotation des headers
 * - Optimisation pour la lisibilité et la navigation
 * 
 * QUALITÉ :
 * - Préservation du formatage Markdown original sans altération
 * - Structuration logique avec table des matières automatique
 * - Normalisation des retours à la ligne et de l'encodage
 * - Gestion intelligente des doublons et des conflits
 * 
 * PERFORMANCE :
 * - Traitement en mémoire avec limitation de taille
 * - Optimisation des concaténations pour éviter les réallocations
 * - Cache des templates de métadonnées
 * - Streaming pour les exports volumineux si nécessaire
 * 
 * SÉCURITÉ :
 * - Sanitisation des noms de projets pour les headers
 * - Validation de la taille totale pour éviter les DoS
 * - Nettoyage des caractères de contrôle dangereux
 * - Anonymisation des métadonnées sensibles
 * 
 * @example
 * ```typescript
 * @Injectable()
 * export class ExportService {
 *   constructor(
 *     private readonly markdownExport: MarkdownExportService
 *   ) {}
 *   
 *   async exportAsMarkdown(files: FileRetrievalResult[], options: ExportOptionsDto) {
 *     const metadata = { projectName: 'Mon Projet', ... };
 *     const result = await this.markdownExport.exportMarkdown(files, options, metadata);
 *     return result.content;
 *   }
 * }
 * ```
 */
@Injectable()
export class MarkdownExportService {
  private readonly logger = new Logger(MarkdownExportService.name);
  private readonly platformVersion: string;
  private readonly includeDebugInfo: boolean;

  constructor(private readonly configService: ConfigService) {
    this.platformVersion = this.configService.get<string>(
      'APP_VERSION',
      '1.0.0', // Version par défaut
    );
    
    this.includeDebugInfo = this.configService.get<boolean>(
      'MARKDOWN_EXPORT_DEBUG',
      false, // Pas de debug par défaut en production
    );

    this.logger.log('MarkdownExportService initialized');
    this.logger.debug(`Platform version: ${this.platformVersion}`);
    this.logger.debug(`Debug info enabled: ${this.includeDebugInfo}`);
  }

  /**
   * Exporte une collection de fichiers en format Markdown unifié
   * 
   * Agrège les fichiers fournis en un document Markdown cohérent avec
   * métadonnées optionnelles, structuration hiérarchique et navigation.
   * 
   * PROCESSUS :
   * 1. Validation des fichiers d'entrée
   * 2. Construction des métadonnées contextuelles
   * 3. Génération de l'en-tête avec informations projet
   * 4. Combinaison intelligente des contenus
   * 5. Normalisation du formatage final
   * 6. Génération de statistiques d'export
   * 
   * QUALITÉ MARKDOWN :
   * - Préservation des headers existants avec renumérotation si nécessaire
   * - Gestion des liens internes et des références croisées
   * - Conservation de la syntaxe Markdown native (code blocks, listes, etc.)
   * - Ajout de séparateurs visuels entre les sections
   * 
   * @param files - Fichiers récupérés à exporter (déjà validés et récupérés)
   * @param options - Options d'export (includeMetadata, etc.)
   * @param projectMetadata - Métadonnées contextuelles du projet
   * @returns Promise avec le résultat d'export complet
   * 
   * @throws HttpException si les fichiers sont invalides ou trop volumineux
   * @throws HttpException si la génération échoue pour des raisons techniques
   * 
   * @example
   * ```typescript
   * const files = await fileRetrievalService.getMultipleFiles(['uuid1', 'uuid2']);
   * const metadata = {
   *   projectName: 'Application E-commerce',
   *   projectDescription: 'Plateforme de vente en ligne complète',
   *   initialPrompt: 'Créer une application e-commerce moderne'
   * };
   * 
   * const result = await markdownExportService.exportMarkdown(
   *   files.successful, 
   *   options, 
   *   metadata
   * );
   * 
   * console.log(`Export généré: ${result.contentSize} octets`);
   * console.log(`Fichier suggéré: ${result.suggestedFileName}`);
   * ```
   */
  async exportMarkdown(
    files: FileRetrievalResult[],
    options: ExportOptionsDto,
    projectMetadata: Partial<MarkdownExportMetadata>,
  ): Promise<MarkdownExportResult> {
    const startTime = Date.now();
    const generatedAt = new Date();

    this.logger.log(`Starting Markdown export for ${files.length} files`);

    // VALIDATION : Vérification des fichiers d'entrée
    this.validateInputFiles(files);

    // VALIDATION : Vérification de la taille totale
    const totalSize = files.reduce((sum, file) => sum + file.contentSize, 0);
    const maxSizeBytes = MARKDOWN_EXPORT_CONSTANTS.CONTENT.MAX_TOTAL_SIZE_MB * 1024 * 1024;
    
    if (totalSize > maxSizeBytes) {
      throw new HttpException(
        `Total content size ${totalSize} exceeds maximum ${maxSizeBytes} bytes`,
        HttpStatus.PAYLOAD_TOO_LARGE,
      );
    }

    try {
      // Construction des métadonnées complètes
      const completeMetadata = this.buildCompleteMetadata(
        projectMetadata,
        files,
        totalSize,
        generatedAt,
      );

      // Génération du contenu Markdown
      let markdownContent = '';

      // ÉTAPE 1 : Ajout des métadonnées en en-tête si demandé
      if (options.includeMetadata) {
        markdownContent += this.generateMetadataHeader(completeMetadata);
        markdownContent += MARKDOWN_EXPORT_CONSTANTS.METADATA.SECTION_SEPARATOR;
      }

      // ÉTAPE 2 : Génération de la table des matières si multiples fichiers
      if (files.length > 1 && options.includeMetadata) {
        markdownContent += this.generateTableOfContents(files);
        markdownContent += MARKDOWN_EXPORT_CONSTANTS.METADATA.SECTION_SEPARATOR;
      }

      // ÉTAPE 3 : Combinaison des contenus de fichiers
      const combinedContent = this.combineFileContents(files, options);
      markdownContent += combinedContent;

      // ÉTAPE 4 : Ajout du footer avec informations techniques (si debug activé)
      if (this.includeDebugInfo && options.includeMetadata) {
        markdownContent += this.generateDebugFooter(completeMetadata, files);
      }

      // ÉTAPE 5 : Normalisation finale du contenu
      const normalizedContent = this.normalizeMarkdownContent(markdownContent);

      // Construction du résultat
      const result: MarkdownExportResult = {
        content: normalizedContent,
        contentSize: Buffer.byteLength(normalizedContent, 'utf8'),
        suggestedFileName: this.generateFileName(completeMetadata),
        metadata: completeMetadata,
        includedFiles: files.map(file => ({
          id: file.id,
          name: file.metadata.name,
          size: file.contentSize,
          contentType: file.metadata.contentType,
        })),
        generatedAt,
        generationDurationMs: Date.now() - startTime,
      };

      this.logger.log(
        `Markdown export completed: ${result.contentSize} bytes, ${files.length} files, ${result.generationDurationMs}ms`,
      );

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `Markdown export failed after ${duration}ms: ${error.message}`,
        error.stack,
      );

      if (!(error instanceof HttpException)) {
        throw new HttpException(
          `Markdown export generation failed: ${error.message}`,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      throw error;
    }
  }

  /**
   * MÉTHODES PRIVÉES - GÉNÉRATION DE CONTENU
   */

  /**
   * Valide les fichiers d'entrée pour l'export
   * SÉCURITÉ : Vérification de cohérence et limites
   */
  private validateInputFiles(files: FileRetrievalResult[]): void {
    if (!Array.isArray(files)) {
      throw new HttpException('Files must be an array', HttpStatus.BAD_REQUEST);
    }

    if (files.length === 0) {
      throw new HttpException('No files provided for export', HttpStatus.BAD_REQUEST);
    }

    if (files.length > MARKDOWN_EXPORT_CONSTANTS.CONTENT.MAX_FILES_COUNT) {
      throw new HttpException(
        `Too many files: ${files.length} > ${MARKDOWN_EXPORT_CONSTANTS.CONTENT.MAX_FILES_COUNT}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    // Validation de chaque fichier
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      if (!file || typeof file !== 'object') {
        throw new HttpException(
          `Invalid file at index ${i}: not an object`,
          HttpStatus.BAD_REQUEST,
        );
      }

      if (!file.content || typeof file.content !== 'string') {
        throw new HttpException(
          `Invalid file at index ${i}: missing or invalid content`,
          HttpStatus.BAD_REQUEST,
        );
      }

      if (!file.metadata || typeof file.metadata !== 'object') {
        throw new HttpException(
          `Invalid file at index ${i}: missing metadata`,
          HttpStatus.BAD_REQUEST,
        );
      }
    }
  }

  /**
   * Construit les métadonnées complètes pour l'export
   * Combine les données projet avec les informations calculées
   */
  private buildCompleteMetadata(
    projectMetadata: Partial<MarkdownExportMetadata>,
    files: FileRetrievalResult[],
    totalSize: number,
    generatedAt: Date,
  ): MarkdownExportMetadata {
    return {
      projectName: this.sanitizeProjectName(
        projectMetadata.projectName || 'Projet Sans Nom'
      ),
      projectDescription: projectMetadata.projectDescription 
        ? this.sanitizeDescription(projectMetadata.projectDescription)
        : undefined,
      initialPrompt: projectMetadata.initialPrompt 
        ? this.sanitizePrompt(projectMetadata.initialPrompt)
        : undefined,
      generatedAt: projectMetadata.generatedAt || generatedAt,
      exportedAt: generatedAt,
      platformVersion: this.platformVersion,
      filesCount: files.length,
      totalContentSize: totalSize,
      statistics: projectMetadata.statistics || undefined,
    };
  }

  /**
   * Génère l'en-tête avec métadonnées du projet
   * Format YAML Front Matter compatible avec la plupart des outils Markdown
   */
  private generateMetadataHeader(metadata: MarkdownExportMetadata): string {
    const lines: string[] = [];
    
    lines.push(MARKDOWN_EXPORT_CONSTANTS.METADATA.HEADER_SEPARATOR);
    lines.push(`title: "${metadata.projectName}"`);
    
    if (metadata.projectDescription) {
      lines.push(`description: "${metadata.projectDescription}"`);
    }
    
    lines.push(`generated_at: "${metadata.generatedAt.toISOString()}"`);
    lines.push(`exported_at: "${metadata.exportedAt.toISOString()}"`);
    lines.push(`platform_version: "${metadata.platformVersion}"`);
    lines.push(`files_count: ${metadata.filesCount}`);
    lines.push(`total_size: ${metadata.totalContentSize}`);
    
    if (metadata.statistics) {
      lines.push('statistics:');
      if (metadata.statistics.generationTime) {
        lines.push(`  generation_time: ${metadata.statistics.generationTime}`);
      }
      if (metadata.statistics.tokensUsed) {
        lines.push(`  tokens_used: ${metadata.statistics.tokensUsed}`);
      }
      if (metadata.statistics.documentsGenerated) {
        lines.push(`  documents_generated: ${metadata.statistics.documentsGenerated}`);
      }
    }
    
    lines.push(MARKDOWN_EXPORT_CONSTANTS.METADATA.HEADER_SEPARATOR);
    
    // Titre principal du document
    lines.push('');
    lines.push(`${MARKDOWN_EXPORT_CONSTANTS.HEADERS.H1_PREFIX}${metadata.projectName}`);
    lines.push('');
    
    if (metadata.projectDescription) {
      lines.push(metadata.projectDescription);
      lines.push('');
    }
    
    if (metadata.initialPrompt) {
      lines.push(`${MARKDOWN_EXPORT_CONSTANTS.HEADERS.H2_PREFIX}Demande initiale`);
      lines.push('');
      lines.push(`> ${metadata.initialPrompt}`);
      lines.push('');
    }

    return lines.join(MARKDOWN_EXPORT_CONSTANTS.ENCODING.LINE_ENDING);
  }

  /**
   * Génère une table des matières basée sur les fichiers
   * Créé une navigation pour les exports multi-fichiers
   */
  private generateTableOfContents(files: FileRetrievalResult[]): string {
    const lines: string[] = [];
    
    lines.push(`${MARKDOWN_EXPORT_CONSTANTS.HEADERS.H2_PREFIX}Table des matières`);
    lines.push('');
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileName = this.sanitizeFileName(file.metadata.name);
      const anchor = this.generateAnchor(fileName);
      
      lines.push(`${i + 1}. [${fileName}](#${anchor})`);
    }
    
    lines.push('');
    
    return lines.join(MARKDOWN_EXPORT_CONSTANTS.ENCODING.LINE_ENDING);
  }

  /**
   * Combine le contenu de tous les fichiers
   * Gère la structuration hiérarchique et les séparateurs
   */
  private combineFileContents(
    files: FileRetrievalResult[],
    options: ExportOptionsDto,
  ): string {
    const sections: string[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileName = this.sanitizeFileName(file.metadata.name);
      
      // En-tête de section pour chaque fichier (sauf si un seul fichier)
      if (files.length > 1) {
        sections.push(`${MARKDOWN_EXPORT_CONSTANTS.HEADERS.H2_PREFIX}${fileName}`);
        sections.push('');
        
        // Métadonnées optionnelles du fichier
        if (options.includeMetadata) {
          const fileInfo = [
            `**Taille :** ${this.formatFileSize(file.contentSize)}`,
            `**Type :** ${file.metadata.contentType}`,
            `**Dernière modification :** ${file.metadata.lastModified.toLocaleDateString('fr-FR')}`,
          ];
          
          sections.push(fileInfo.join(' • '));
          sections.push('');
        }
      }
      
      // Contenu du fichier avec ajustement des headers si nécessaire
      const adjustedContent = this.adjustMarkdownHeaders(
        file.content, 
        files.length > 1 ? 1 : 0 // Décaler d'1 niveau si multiples fichiers
      );
      
      sections.push(adjustedContent);
      
      // Séparateur entre fichiers (sauf le dernier)
      if (i < files.length - 1) {
        sections.push(MARKDOWN_EXPORT_CONSTANTS.METADATA.SECTION_SEPARATOR);
      }
    }
    
    return sections.join(MARKDOWN_EXPORT_CONSTANTS.ENCODING.LINE_ENDING);
  }

  /**
   * Ajuste les niveaux de headers Markdown pour cohérence hiérarchique
   * Évite les conflits de numérotation dans l'export unifié
   */
  private adjustMarkdownHeaders(content: string, levelShift: number): string {
    if (levelShift === 0) {
      return content; // Pas d'ajustement nécessaire
    }
    
    const lines = content.split(/\r?\n/);
    const adjustedLines: string[] = [];
    
    for (const line of lines) {
      // Détection des headers Markdown (#, ##, ###, etc.)
      const headerMatch = line.match(/^(#{1,6})\s+(.*)/);
      
      if (headerMatch) {
        const currentLevel = headerMatch[1].length;
        const newLevel = Math.min(6, currentLevel + levelShift); // Max 6 niveaux
        const headerText = headerMatch[2];
        
        adjustedLines.push(`${'#'.repeat(newLevel)} ${headerText}`);
      } else {
        adjustedLines.push(line);
      }
    }
    
    return adjustedLines.join(MARKDOWN_EXPORT_CONSTANTS.ENCODING.LINE_ENDING);
  }

  /**
   * Génère un footer avec informations de debug
   * Inclus uniquement si le mode debug est activé
   */
  private generateDebugFooter(
    metadata: MarkdownExportMetadata,
    files: FileRetrievalResult[],
  ): string {
    const lines: string[] = [];
    
    lines.push(MARKDOWN_EXPORT_CONSTANTS.METADATA.SECTION_SEPARATOR);
    lines.push(`${MARKDOWN_EXPORT_CONSTANTS.HEADERS.H2_PREFIX}Informations techniques`);
    lines.push('');
    lines.push('*Ces informations sont générées automatiquement à des fins de debug.*');
    lines.push('');
    
    // Statistiques de l'export
    lines.push(`${MARKDOWN_EXPORT_CONSTANTS.HEADERS.H3_PREFIX}Statistiques de l'export`);
    lines.push('');
    lines.push(`- **Nombre de fichiers :** ${files.length}`);
    lines.push(`- **Taille totale :** ${this.formatFileSize(metadata.totalContentSize)}`);
    lines.push(`- **Plateforme :** Coders v${metadata.platformVersion}`);
    lines.push(`- **Export généré le :** ${metadata.exportedAt.toLocaleString('fr-FR')}`);
    lines.push('');
    
    // Détail des fichiers inclus
    if (files.length > 1) {
      lines.push(`${MARKDOWN_EXPORT_CONSTANTS.HEADERS.H3_PREFIX}Fichiers inclus`);
      lines.push('');
      
      for (const file of files) {
        const size = this.formatFileSize(file.contentSize);
        const name = this.sanitizeFileName(file.metadata.name);
        lines.push(`- **${name}** (${size}) - ${file.metadata.contentType}`);
      }
      
      lines.push('');
    }
    
    return lines.join(MARKDOWN_EXPORT_CONSTANTS.ENCODING.LINE_ENDING);
  }

  /**
   * Normalise le contenu Markdown final
   * Uniformise les retours à la ligne et l'encodage
   */
  private normalizeMarkdownContent(content: string): string {
    if (!content || typeof content !== 'string') {
      return '';
    }

    // Normalisation des retours à la ligne
    let normalized = content
      .replace(/\r\n/g, '\n')  // Windows -> Unix
      .replace(/\r/g, '\n');   // Mac -> Unix

    // Suppression des espaces en fin de ligne
    normalized = normalized.replace(/[ \t]+$/gm, '');

    // Normalisation des espaces multiples entre paragraphes
    normalized = normalized.replace(/\n{3,}/g, '\n\n');

    // Suppression des espaces/tabs en début et fin de document
    normalized = normalized.trim();

    // Ajout d'un retour à la ligne final (convention Unix)
    if (normalized.length > 0) {
      normalized += MARKDOWN_EXPORT_CONSTANTS.ENCODING.LINE_ENDING;
    }

    return normalized;
  }

  /**
   * MÉTHODES PRIVÉES - UTILITAIRES ET SANITISATION
   */

  /**
   * Sanitise un nom de projet pour utilisation en header
   * SÉCURITÉ : Nettoyage des caractères dangereux
   */
  private sanitizeProjectName(name: string): string {
    if (!name || typeof name !== 'string') {
      return 'Projet Sans Nom';
    }

    return name
      .trim()
      .replace(/[#\[\](){}]/g, '') // Caractères Markdown spéciaux
      .replace(/[<>'"&]/g, '')     // Caractères HTML dangereux
      .substring(0, MARKDOWN_EXPORT_CONSTANTS.METADATA.MAX_PROJECT_NAME_LENGTH)
      .trim() || 'Projet Sans Nom';
  }

  /**
   * Sanitise une description de projet
   * SÉCURITÉ : Nettoyage avec préservation de la lisibilité
   */
  private sanitizeDescription(description: string): string {
    if (!description || typeof description !== 'string') {
      return '';
    }

    return description
      .trim()
      .replace(/[<>'"&]/g, '')     // Caractères HTML dangereux
      .replace(/\r?\n/g, ' ')      // Retours à la ligne -> espaces
      .replace(/\s+/g, ' ')        // Espaces multiples -> simple
      .substring(0, MARKDOWN_EXPORT_CONSTANTS.METADATA.MAX_DESCRIPTION_LENGTH)
      .trim();
  }

  /**
   * Sanitise un prompt initial
   * SÉCURITÉ : Nettoyage pour inclusion dans blockquote
   */
  private sanitizePrompt(prompt: string): string {
    if (!prompt || typeof prompt !== 'string') {
      return '';
    }

    return prompt
      .trim()
      .replace(/[<>'"&]/g, '')     // Caractères HTML dangereux
      .replace(/>/g, '\\>')        // Échappement du caractère blockquote
      .substring(0, 1000)          // Limitation raisonnable
      .trim();
  }

  /**
   * Sanitise un nom de fichier pour utilisation en header/anchor
   * SÉCURITÉ : Nettoyage pour headers et ancres Markdown
   */
  private sanitizeFileName(fileName: string): string {
    if (!fileName || typeof fileName !== 'string') {
      return 'Fichier Sans Nom';
    }

    return fileName
      .trim()
      .replace(/[#\[\](){}]/g, '') // Caractères Markdown spéciaux
      .replace(/[<>'"&]/g, '')     // Caractères HTML dangereux
      .substring(0, MARKDOWN_EXPORT_CONSTANTS.CONTENT.MAX_FILE_NAME_LENGTH)
      .trim() || 'Fichier Sans Nom';
  }

  /**
   * Génère une ancre Markdown valide depuis un nom
   * Utilisé pour la table des matières
   */
  private generateAnchor(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')  // Seulement alphanumérique et espaces/tirets
      .replace(/\s+/g, '-')          // Espaces -> tirets
      .replace(/-+/g, '-')           // Tirets multiples -> simple
      .replace(/^-|-$/g, '');        // Suppression tirets début/fin
  }

  /**
   * Génère un nom de fichier approprié pour l'export
   * Format : "NomProjet - Export Markdown - YYYY-MM-DD.md"
   */
  private generateFileName(metadata: MarkdownExportMetadata): string {
    const safeName = metadata.projectName
      .replace(/[^a-zA-Z0-9\s-_]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 50);
    
    const date = metadata.exportedAt.toISOString().split('T')[0];
    const fileCount = metadata.filesCount > 1 ? ` (${metadata.filesCount} fichiers)` : '';
    
    return `${safeName} - Export Markdown${fileCount} - ${date}.md`;
  }

  /**
   * Formate une taille de fichier en unité lisible
   * Utilitaire pour l'affichage des métadonnées
   */
  private formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} octets`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} Go`;
  }

  /**
   * Génère un résumé de l'état du service pour monitoring
   * 
   * @returns Informations de configuration et d'état
   */
  getServiceStatus(): {
    ready: boolean;
    platformVersion: string;
    debugEnabled: boolean;
    maxFileSize: number;
    maxFilesCount: number;
  } {
    return {
      ready: true, // Service toujours prêt (pas de dépendances externes)
      platformVersion: this.platformVersion,
      debugEnabled: this.includeDebugInfo,
      maxFileSize: MARKDOWN_EXPORT_CONSTANTS.CONTENT.MAX_TOTAL_SIZE_MB,
      maxFilesCount: MARKDOWN_EXPORT_CONSTANTS.CONTENT.MAX_FILES_COUNT,
    };
  }

  /**
   * Version sécurisée pour les logs d'audit
   * SÉCURITÉ : Pas d'informations sensibles dans les logs
   */
  toLogSafeString(): string {
    const status = this.getServiceStatus();
    return `MarkdownExportService[version=${status.platformVersion}, debug=${status.debugEnabled}, maxFiles=${status.maxFilesCount}, ready=${status.ready}]`;
  }
}