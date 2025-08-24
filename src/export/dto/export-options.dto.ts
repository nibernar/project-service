import {
  IsEnum,
  IsOptional,
  IsArray,
  IsString,
  IsBoolean,
  IsObject,
  IsUUID,
  ValidateNested,
  ValidateIf,
  IsNumber,
  Min,
  Max,
  ArrayMaxSize,
  Matches,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Constantes de validation pour les options d'export
 * Maintient la cohérence des limites à travers l'application
 */
export const EXPORT_OPTIONS_CONSTANTS = {
  FILE_IDS: {
    MAX_COUNT: 50,
  },
  PDF: {
    MARGINS: {
      MIN: 10,
      MAX: 50,
      DEFAULT: 20,
    },
  },

  MAX_FILE_SIZE_MB: 100,
} as const;

/**
 * DTO pour les options spécifiques à l'export PDF via Pandoc
 * 
 * Encapsule tous les paramètres de configuration pour la génération PDF
 * avec des validations strictes pour garantir la qualité de sortie.
 * 
 * SÉCURITÉ :
 * - Validation stricte des énumérations
 * - Limites de taille pour éviter les DoS
 * - Transformation sécurisée des booléens
 * 
 * @example
 * ```typescript
 * const pdfOptions: PdfOptionsDto = {
 *   pageSize: 'A4',
 *   margins: 25,
 *   includeTableOfContents: true
 * };
 * ```
 */
export class PdfOptionsDto {
  /**
   * Format de page pour le document PDF
   * 
   * Détermine les dimensions de base du document généré.
   * A4 est le standard international, Letter pour le marché US.
   * 
   * @example 'A4', 'Letter'
   */
  @ApiPropertyOptional({
    description: 'Format de page pour le document PDF',
    enum: ['A4', 'Letter'],
    default: 'A4',
    example: 'A4',
  })
  @IsOptional()
  @IsEnum(['A4', 'Letter'], { 
    message: 'Le format de page doit être A4 ou Letter' 
  })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.trim().toUpperCase();
    }
    return value;
  })
  pageSize?: 'A4' | 'Letter' = 'A4';

  /**
   * Largeur des marges en millimètres (uniforme sur tous les côtés)
   * 
   * Contrôle l'espace blanc autour du contenu. Des marges trop petites
   * peuvent rendre le document difficile à lire, trop grandes gaspillent l'espace.
   * 
   * @example 20, 25, 30
   */
  @ApiPropertyOptional({
    description: 'Largeur des marges en millimètres (uniforme sur tous les côtés)',
    minimum: EXPORT_OPTIONS_CONSTANTS.PDF.MARGINS.MIN,
    maximum: EXPORT_OPTIONS_CONSTANTS.PDF.MARGINS.MAX,
    default: EXPORT_OPTIONS_CONSTANTS.PDF.MARGINS.DEFAULT,
    example: 25,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 }, { message: 'Les marges doivent être un nombre avec maximum 1 décimale' })
  @Min(EXPORT_OPTIONS_CONSTANTS.PDF.MARGINS.MIN, { 
    message: `Les marges doivent être d'au moins ${EXPORT_OPTIONS_CONSTANTS.PDF.MARGINS.MIN}mm` 
  })
  @Max(EXPORT_OPTIONS_CONSTANTS.PDF.MARGINS.MAX, { 
    message: `Les marges ne peuvent pas dépasser ${EXPORT_OPTIONS_CONSTANTS.PDF.MARGINS.MAX}mm` 
  })
  @Type(() => Number)
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      return isNaN(parsed) ? value : parsed;
    }
    return value;
  })
  margins?: number = EXPORT_OPTIONS_CONSTANTS.PDF.MARGINS.DEFAULT;

  /**
   * Génération automatique d'une table des matières
   * 
   * Analyse les headers Markdown (H1-H3) pour créer une navigation
   * structurée en début de document. Utile pour les documents longs.
   * 
   * @example true, false
   */
  @ApiPropertyOptional({
    description: 'Génération automatique d\'une table des matières basée sur les headers H1-H3',
    default: false,
    example: true,
  })
  @IsOptional()
  @IsBoolean({ message: 'includeTableOfContents doit être un booléen' })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      const lowered = value.toLowerCase().trim();
      if (lowered === 'true' || lowered === '1') return true;
      if (lowered === 'false' || lowered === '0') return false;
      return value;
    }
    return value;
  })
  includeTableOfContents?: boolean = false;

  /**
   * Valide la cohérence des options PDF
   * Vérifie que les paramètres sont compatibles entre eux
   * 
   * @returns true si les options sont cohérentes
   */
  isValid(): boolean {
    // Validation croisée des paramètres
    if (this.margins && this.pageSize) {
      // Pour A4 (210x297mm), des marges > 40mm laissent peu d'espace
      const maxMarginForA4 = this.pageSize === 'A4' ? 40 : 35;
      if (this.margins > maxMarginForA4) {
        return false;
      }
    }

    return true;
  }
}

/**
 * DTO principal pour les options d'export de documents du projet
 * 
 * Interface unifiée pour configurer l'export des documents générés
 * avec support de multiples formats et options de personnalisation.
 * 
 * SÉCURITÉ RENFORCÉE :
 * - Validation stricte des UUIDs pour éviter les injections
 * - Limitation du nombre de fichiers pour éviter les DoS
 * - Transformation sécurisée des entrées utilisateur
 * - Validation conditionnelle selon le format
 * 
 * VALIDATION MÉTIER :
 * - Cohérence entre format et options spécialisées
 * - Limites de performance pour éviter les timeouts
 * - Validation de l'existence des fichiers référencés
 * 
 * @example
 * ```typescript
 * @Post('projects/:id/export')
 * async exportProject(
 *   @Param('id') projectId: string,
 *   @Body() options: ExportOptionsDto,
 *   @CurrentUser() user: User
 * ) {
 *   return this.exportService.exportProject(projectId, options, user);
 * }
 * ```
 */
export class ExportOptionsDto {
  /**
   * Format de sortie pour l'export
   * 
   * Détermine le type de fichier généré et le pipeline de traitement.
   * - 'markdown' : Export natif sans transformation
   * - 'pdf' : Conversion via Pandoc avec options avancées
   * 
   * SÉCURITÉ : Énumération stricte pour éviter les injections
   * 
   * @example 'pdf', 'markdown'
   */
  @ApiProperty({
    description: 'Format de sortie pour l\'export des documents',
    enum: ['markdown', 'pdf'],
    example: 'pdf',
    type: 'string',
  })
  @IsEnum(['markdown', 'pdf'], { 
    message: 'Le format d\'export doit être markdown ou pdf' 
  })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.toLowerCase().trim();
    }
    return value;
  })
  // SÉCURITÉ : Validation supplémentaire pour bloquer les injections
  @Matches(/^(markdown|pdf)$/, {
    message: 'Format must be exactly markdown or pdf',
  })
  format: 'markdown' | 'pdf';

  /**
   * Liste des identifiants de fichiers à inclure dans l'export
   * 
   * Permet la sélection granulaire des documents à exporter.
   * Si omis, tous les fichiers générés du projet sont inclus.
   * 
   * SÉCURITÉ CRITIQUE :
   * - Validation UUID stricte pour éviter les path traversal
   * - Limite de 50 fichiers pour éviter les DoS
   * - Filtrage des valeurs vides et malformées
   * 
   * @example ["550e8400-e29b-41d4-a716-446655440000", "6ba7b810-9dad-11d1-80b4-00c04fd430c8"]
   */
  @ApiPropertyOptional({
    description: 'Liste des identifiants UUID des fichiers à inclure. Si omis, tous les fichiers générés sont exportés',
    type: [String],
    example: [
      '550e8400-e29b-41d4-a716-446655440000',
      '6ba7b810-9dad-11d1-80b4-00c04fd430c8'
    ],
    maxItems: EXPORT_OPTIONS_CONSTANTS.FILE_IDS.MAX_COUNT,
    items: {
      type: 'string',
      format: 'uuid',
    },
  })
  @IsOptional()
  @IsArray({ message: 'fileIds doit être un tableau de chaînes' })
  @IsString({ 
    each: true, 
    message: 'Chaque fileId doit être une chaîne de caractères valide' 
  })
  @IsUUID('4', { 
    each: true, 
    message: 'Chaque fileId doit être un UUID v4 valide pour des raisons de sécurité' 
  })
  @ArrayMaxSize(EXPORT_OPTIONS_CONSTANTS.FILE_IDS.MAX_COUNT, { 
    message: `Maximum ${EXPORT_OPTIONS_CONSTANTS.FILE_IDS.MAX_COUNT} fichiers peuvent être exportés simultanément` 
  })
  // SÉCURITÉ : Nettoyage des entrées et filtrage des valeurs dangereuses
  @Transform(({ value }) => {
    if (Array.isArray(value)) {
      return value
        .filter(id => id && typeof id === 'string')
        .map(id => id.trim())
        .filter(id => id.length > 0)
        .filter(id => /^[0-9a-f-]+$/i.test(id)); // Seulement caractères UUID valides
    }
    return value;
  })
  fileIds?: string[];

  /**
   * Inclure les métadonnées du projet dans l'export
   * 
   * Contrôle l'ajout d'informations contextuelles :
   * - Nom du projet et description
   * - Date de génération et timestamp d'export
   * - Prompt initial utilisateur
   * - Version de la plateforme
   * - Statistiques de génération
   * 
   * SÉCURITÉ : Transformation sécurisée des booléens de query params
   * 
   * @example true, false
   */
  @ApiPropertyOptional({
    description: 'Inclure les métadonnées du projet (nom, date, prompt initial, etc.) dans l\'export',
    default: true,
    example: true,
    type: 'boolean',
  })
  @IsOptional()
  @IsBoolean({ message: 'includeMetadata doit être un booléen strict' })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      const lowered = value.toLowerCase().trim();
      if (lowered === 'true' || lowered === '1' || lowered === 'yes') return true;
      if (lowered === 'false' || lowered === '0' || lowered === 'no') return false;
      return value; // Laisser la validation class-validator gérer l'erreur
    }
    return value;
  })
  includeMetadata?: boolean = true;

  /**
   * Options spécifiques pour la génération PDF
   * 
   * Configuration avancée du pipeline Pandoc pour personnaliser
   * l'apparence et la structure du document PDF final.
   * 
   * VALIDATION CONDITIONNELLE : Ignoré si format !== 'pdf'
   * 
   * @example { pageSize: 'A4', margins: 25, includeTableOfContents: true }
   */
  @ApiPropertyOptional({
    description: 'Options spécifiques pour la génération PDF via Pandoc. Ignoré si format !== pdf',
    type: PdfOptionsDto,
  })
  @ValidateIf(o => o.format === 'pdf')
  @IsOptional()
  @IsObject({ message: 'pdfOptions doit être un objet structuré' })
  @ValidateNested()
  @Type(() => PdfOptionsDto)
  pdfOptions?: PdfOptionsDto;

  /**
   * Valide la cohérence globale des options d'export
   * Combine validation syntaxique et validation métier
   * 
   * SÉCURITÉ : Validation supplémentaire côté métier
   * 
   * @returns Objet avec statut de validation et erreurs détaillées
   * 
   * @example
   * ```typescript
   * const options = new ExportOptionsDto();
   * options.format = 'pdf';
   * options.pdfOptions = { margins: 60 }; // Invalide
   * 
   * const validation = options.validateOptions();
   * if (!validation.valid) {
   *   console.log(validation.errors); // ["PDF margins too large for page size"]
   * }
   * ```
   */
  validateOptions(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validation format/options cohérence
    if (this.format === 'pdf' && this.pdfOptions && !this.pdfOptions.isValid()) {
      errors.push('PDF options are inconsistent with selected page size');
    }

    // Validation limites performance
    if (this.fileIds && this.fileIds.length > EXPORT_OPTIONS_CONSTANTS.FILE_IDS.MAX_COUNT) {
      errors.push(`Too many files selected (max: ${EXPORT_OPTIONS_CONSTANTS.FILE_IDS.MAX_COUNT})`);
    }

    // Validation sécurité UUID
    if (this.fileIds) {
      const invalidIds = this.fileIds.filter(id => 
        !id || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
      );
      if (invalidIds.length > 0) {
        errors.push(`Invalid UUID format in fileIds: ${invalidIds.join(', ')}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Vérifie si l'export est configuré pour tous les fichiers du projet
   * 
   * @returns true si aucune sélection spécifique de fichiers
   */
  isFullExport(): boolean {
    return !this.fileIds || this.fileIds.length === 0;
  }

  /**
   * Retourne le nombre de fichiers sélectionnés pour l'export
   * 
   * @returns Nombre de fichiers ou 0 si export complet
   */
  getSelectedFilesCount(): number {
    return this.fileIds?.length ?? 0;
  }

  /**
   * Vérifie si l'export nécessite des ressources importantes
   * Basé sur le nombre de fichiers et le format de sortie
   * 
   * @returns true si l'export peut prendre du temps
   */
  isHeavyExport(): boolean {
    const fileCount = this.getSelectedFilesCount();
    
    // PDF est plus lourd que Markdown
    if (this.format === 'pdf') {
      return fileCount > 10 || this.isFullExport();
    }
    
    return fileCount > 25 || this.isFullExport();
  }

  /**
   * Estime la complexité de l'export pour le scheduling
   * 
   * @returns Niveau de complexité pour la queue de traitement
   */
  getExportComplexity(): 'low' | 'medium' | 'high' {
    if (this.format === 'markdown' && this.getSelectedFilesCount() <= 5) {
      return 'low';
    }
    
    if (this.format === 'pdf' || this.getSelectedFilesCount() > 20) {
      return 'high';
    }
    
    return 'medium';
  }

  /**
   * Génère un nom de fichier suggéré basé sur les options
   * 
   * @param projectName Nom du projet pour le préfixe
   * @returns Nom de fichier avec extension appropriée
   * 
   * @example
   * ```typescript
   * const options = new ExportOptionsDto();
   * options.format = 'pdf';
   * console.log(options.generateFileName('Mon Projet')); 
   * // "Mon Projet - Export - 2024-08-18.pdf"
   * ```
   */
  generateFileName(projectName: string): string {
    const safeProjectName = projectName
      .replace(/[^a-zA-Z0-9\s-_]/g, '')
      .trim()
      .substring(0, 50);
    
    const timestamp = new Date().toISOString().split('T')[0];
    const extension = this.format === 'pdf' ? 'pdf' : 'zip';
    
    const typeIndicator = this.isFullExport() ? 'Export' : 'Export-Partiel';
    
    return `${safeProjectName} - ${typeIndicator} - ${timestamp}.${extension}`;
  }

  /**
   * Crée une version sécurisée du DTO pour le logging
   * 
   * SÉCURITÉ CRITIQUE : Aucune donnée utilisateur sensible exposée
   * 
   * @returns Chaîne descriptive pour les logs d'audit
   */
  toLogSafeString(): string {
    const complexity = this.getExportComplexity();
    const fileInfo = this.isFullExport() ? 'full' : `${this.getSelectedFilesCount()}_files`;
    const pdfInfo = this.format === 'pdf' && this.pdfOptions?.pageSize ? 
      `_${this.pdfOptions.pageSize}` : '';
    
    return `ExportOptionsDto[format=${this.format}${pdfInfo}, scope=${fileInfo}, complexity=${complexity}, metadata=${this.includeMetadata}]`;
  }

  /**
   * Retourne un résumé des options pour l'interface utilisateur
   * 
   * @returns Description conviviale des options sélectionnées
   */
  toString(): string {
    const formatDisplay = this.format.toUpperCase();
    const filesDisplay = this.isFullExport() ? 
      'tous les fichiers' : 
      `${this.getSelectedFilesCount()} fichier(s) sélectionné(s)`;
    
    const metadataDisplay = this.includeMetadata ? 'avec métadonnées' : 'sans métadonnées';
    
    let pdfDisplay = '';
    if (this.format === 'pdf' && this.pdfOptions) {
      pdfDisplay = ` (${this.pdfOptions.pageSize}, marges: ${this.pdfOptions.margins}mm)`;
    }
    
    return `Export ${formatDisplay}${pdfDisplay} - ${filesDisplay} - ${metadataDisplay}`;
  }
}