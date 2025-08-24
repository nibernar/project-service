import {
  IsString,
  IsNumber,
  IsDate,
  IsOptional,
  IsIn,
  Min,
  Max,
  Length,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Constantes pour les réponses d'export
 * Maintient la cohérence des limites à travers l'application
 */
export const EXPORT_RESPONSE_CONSTANTS = {
  FILE_NAME: {
    MAX_LENGTH: 100,
  },
  MESSAGE: {
    MAX_LENGTH: 200,
  },
  ERROR: {
    MAX_LENGTH: 500,
  },
  DOWNLOAD_URL: {
    MAX_LENGTH: 2048,
  },
} as const;

/**
 * DTO de réponse pour les opérations d'export
 * 
 * Contient toutes les informations nécessaires pour permettre à l'utilisateur
 * de télécharger le fichier exporté de manière sécurisée.
 * 
 * SÉCURITÉ :
 * - URLs temporaires avec expiration pour contrôler l'accès
 * - Hash MD5 pour vérification d'intégrité
 * - Validation stricte des formats de fichiers
 * - Limitation de la taille des noms de fichiers
 * 
 * PERFORMANCE :
 * - Informations sur la taille pour validation côté client
 * - Format explicite pour traitement approprié
 * - Expiration pour gestion automatique du cache
 * 
 * @example
 * ```typescript
 * const response: ExportResponseDto = {
 *   downloadUrl: 'https://storage.coders.com/exports/temp/abc123.pdf?expires=1640995200',
 *   fileName: 'Mon Projet - Export - 2024-01-15.pdf',
 *   fileSize: 1048576,
 *   format: 'pdf',
 *   expiresAt: new Date('2024-01-15T15:30:00.000Z'),
 *   md5Hash: 'a1b2c3d4e5f6789012345678901234567890abcd'
 * };
 * ```
 */
export class ExportResponseDto {
  /**
   * URL de téléchargement temporaire avec signature sécurisée
   * 
   * URL signée qui expire automatiquement pour contrôler l'accès.
   * Inclut les paramètres de sécurité nécessaires (expires, signature).
   * 
   * SÉCURITÉ CRITIQUE :
   * - URL temporaire avec expiration forcée
   * - Signature cryptographique pour éviter la falsification
   * - Domaine contrôlé pour éviter les redirections malveillantes
   * 
   * @example "https://storage.coders.com/exports/temp/abc123-export.pdf?expires=1640995200&signature=xyz"
   */
  @ApiProperty({
    description: 'URL de téléchargement temporaire avec signature sécurisée',
    example: 'https://storage.coders.com/exports/temp/abc123-export.pdf?expires=1640995200&signature=xyz',
    format: 'uri',
    maxLength: EXPORT_RESPONSE_CONSTANTS.DOWNLOAD_URL.MAX_LENGTH,
  })
  @IsString({ message: 'downloadUrl must be a string' })
  @Length(1, EXPORT_RESPONSE_CONSTANTS.DOWNLOAD_URL.MAX_LENGTH, {
    message: `downloadUrl must not exceed ${EXPORT_RESPONSE_CONSTANTS.DOWNLOAD_URL.MAX_LENGTH} characters`,
  })
  // SÉCURITÉ : Validation stricte du format URL avec domaine contrôlé
  @Matches(/^https:\/\/[a-zA-Z0-9.-]+\.coders\.com\/[a-zA-Z0-9\/.?&=_-]+$/, {
    message: 'downloadUrl must be a valid HTTPS URL from coders.com domain',
  })
  downloadUrl: string;

  /**
   * Nom du fichier exporté avec extension appropriée
   * 
   * Nom descriptif incluant le projet, type d'export et timestamp.
   * Extension correspond au format réel du fichier généré.
   * 
   * SÉCURITÉ : Nettoyé pour éviter les caractères dangereux dans les noms de fichiers
   * 
   * @example "Mon Projet - Export - 2024-01-15.pdf"
   */
  @ApiProperty({
    description: 'Nom du fichier exporté avec extension appropriée',
    example: 'Mon Projet - Export - 2024-01-15.pdf',
    maxLength: EXPORT_RESPONSE_CONSTANTS.FILE_NAME.MAX_LENGTH,
  })
  @IsString({ message: 'fileName must be a string' })
  @Length(1, EXPORT_RESPONSE_CONSTANTS.FILE_NAME.MAX_LENGTH, {
    message: `fileName must not exceed ${EXPORT_RESPONSE_CONSTANTS.FILE_NAME.MAX_LENGTH} characters`,
  })
  // SÉCURITÉ : Blocage des caractères dangereux dans les noms de fichiers
  @Matches(/^[a-zA-Z0-9\s.\-_()]+\.(pdf|zip|md)$/, {
    message: 'fileName must contain only safe characters and have a valid extension (pdf, zip, md)',
  })
  fileName: string;

  /**
   * Taille du fichier en octets pour validation côté client
   * 
   * Permet la validation de l'intégrité du téléchargement
   * et l'affichage d'informations à l'utilisateur.
   * 
   * @example 1048576 (1 MB)
   */
  @ApiProperty({
    description: 'Taille du fichier en octets pour validation côté client',
    example: 1048576,
    minimum: 1,
    maximum: 104857600, // 100 MB max
  })
  @IsNumber({}, { message: 'fileSize must be a number' })
  @Min(1, { message: 'fileSize must be at least 1 byte' })
  @Max(104857600, { message: 'fileSize cannot exceed 100 MB' })
  fileSize: number;

  /**
   * Format effectif du fichier exporté
   * 
   * Indique le type MIME ou extension du fichier généré.
   * Peut différer du format demandé (ex: markdown → zip si multiples fichiers).
   * 
   * @example "pdf", "zip", "markdown"
   */
  @ApiProperty({
    description: 'Format effectif du fichier exporté',
    example: 'pdf',
    enum: ['pdf', 'zip', 'markdown'],
  })
  @IsString({ message: 'format must be a string' })
  @IsIn(['pdf', 'zip', 'markdown'], {
    message: 'format must be one of: pdf, zip, markdown',
  })
  format: 'pdf' | 'zip' | 'markdown';

  /**
   * Date d'expiration de l'URL de téléchargement (UTC)
   * 
   * Timestamp après lequel l'URL ne sera plus valide.
   * Permet la gestion automatique des fichiers temporaires.
   * 
   * @example new Date('2024-01-15T15:30:00.000Z')
   */
  @ApiProperty({
    description: 'Date d\'expiration de l\'URL de téléchargement (UTC)',
    example: '2024-01-15T15:30:00.000Z',
    format: 'date-time',
  })
  @IsDate({ message: 'expiresAt must be a valid date' })
  @Type(() => Date)
  expiresAt: Date;

  /**
   * Hash MD5 du fichier pour vérification d'intégrité (optionnel)
   * 
   * Permet la validation de l'intégrité du fichier téléchargé.
   * Utile pour détecter les corruptions lors du transfert.
   * 
   * @example "a1b2c3d4e5f6789012345678901234567890abcd"
   */
  @ApiPropertyOptional({
    description: 'Hash MD5 du fichier pour vérification d\'intégrité',
    example: 'a1b2c3d4e5f6789012345678901234567890abcd',
    pattern: '^[a-f0-9]{32}$',
  })
  @IsOptional()
  @IsString({ message: 'md5Hash must be a string when provided' })
  @Matches(/^[a-f0-9]{32}$/, {
    message: 'md5Hash must be exactly 32 hexadecimal characters',
  })
  md5Hash?: string;

  /**
   * Vérifie si l'URL de téléchargement est encore valide
   * 
   * @returns true si l'URL n'est pas expirée
   * 
   * @example
   * ```typescript
   * if (response.isDownloadValid()) {
   *   window.open(response.downloadUrl);
   * } else {
   *   console.log('Lien de téléchargement expiré');
   * }
   * ```
   */
  isDownloadValid(): boolean {
    return new Date() < this.expiresAt;
  }

  /**
   * Retourne le temps restant avant expiration en minutes
   * 
   * @returns Nombre de minutes avant expiration (0 si expiré)
   */
  getTimeUntilExpiry(): number {
    const now = new Date().getTime();
    const expiry = this.expiresAt.getTime();
    const diffMs = expiry - now;
    
    return Math.max(0, Math.floor(diffMs / (1000 * 60)));
  }

  /**
   * Formate la taille du fichier en unité lisible
   * 
   * @returns Taille formatée avec unité appropriée
   * 
   * @example "1.2 MB", "543.2 KB", "2.1 GB"
   */
  getFormattedFileSize(): string {
    const bytes = this.fileSize;
    
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }

  /**
   * Vérifie si le fichier est volumineux (> 10 MB)
   * Utile pour afficher des avertissements à l'utilisateur
   * 
   * @returns true si le fichier fait plus de 10 MB
   */
  isLargeFile(): boolean {
    return this.fileSize > 10 * 1024 * 1024; // 10 MB
  }

  /**
   * Génère un résumé pour l'interface utilisateur
   * 
   * @returns Description conviviale du fichier exporté
   */
  toString(): string {
    const sizeFormatted = this.getFormattedFileSize();
    const timeLeft = this.getTimeUntilExpiry();
    const timeInfo = timeLeft > 0 ? ` (expire dans ${timeLeft}min)` : ' (expiré)';
    
    return `${this.fileName} (${sizeFormatted}, ${this.format.toUpperCase()})${timeInfo}`;
  }
}

/**
 * DTO pour le statut d'un export en cours (suivi asynchrone)
 * 
 * Utilisé pour informer l'utilisateur de la progression des exports longs
 * avec possibilité de suivi en temps réel via WebSocket ou polling.
 * 
 * ROBUSTESSE :
 * - Gestion des erreurs avec messages descriptifs
 * - Estimation du temps restant pour planification utilisateur
 * - Horodatage pour détecter les processus bloqués
 * 
 * EXPÉRIENCE UTILISATEUR :
 * - Messages contextuels selon l'étape
 * - Progression granulaire pour feedback visuel
 * - Gestion des échecs avec informations actionables
 * 
 * @example
 * ```typescript
 * const status: ExportStatusDto = {
 *   status: 'processing',
 *   progress: 75,
 *   message: 'Conversion PDF en cours...',
 *   estimatedTimeRemaining: 30,
 *   lastUpdated: new Date()
 * };
 * ```
 */
export class ExportStatusDto {
  /**
   * Statut actuel de l'opération d'export
   * 
   * États du workflow :
   * - 'pending' : En attente de traitement (dans la queue)
   * - 'processing' : Traitement en cours
   * - 'completed' : Export terminé avec succès
   * - 'failed' : Échec avec détails dans le champ error
   * 
   * @example "processing"
   */
  @ApiProperty({
    description: 'Statut actuel de l\'opération d\'export',
    enum: ['pending', 'processing', 'completed', 'failed'],
    example: 'processing',
  })
  @IsIn(['pending', 'processing', 'completed', 'failed'], {
    message: 'status must be one of: pending, processing, completed, failed',
  })
  status: 'pending' | 'processing' | 'completed' | 'failed';

  /**
   * Progression de l'export en pourcentage (0-100)
   * 
   * Permet l'affichage d'une barre de progression à l'utilisateur.
   * Peut être estimé ou précis selon le type d'export.
   * 
   * @example 75 (75% terminé)
   */
  @ApiPropertyOptional({
    description: 'Progression de l\'export en pourcentage (0-100)',
    minimum: 0,
    maximum: 100,
    example: 75,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 }, { 
    message: 'progress must be a number with maximum 1 decimal place' 
  })
  @Min(0, { message: 'progress cannot be negative' })
  @Max(100, { message: 'progress cannot exceed 100' })
  progress?: number;

  /**
   * Message descriptif du statut actuel pour l'utilisateur
   * 
   * Message contextuel expliquant l'étape en cours.
   * Doit être compréhensible par l'utilisateur final.
   * 
   * SÉCURITÉ : Nettoyé pour éviter l'injection de contenu malveillant
   * 
   * @example "Conversion PDF en cours...", "Récupération des fichiers..."
   */
  @ApiPropertyOptional({
    description: 'Message descriptif du statut actuel pour l\'utilisateur',
    example: 'Conversion PDF en cours...',
    maxLength: EXPORT_RESPONSE_CONSTANTS.MESSAGE.MAX_LENGTH,
  })
  @IsOptional()
  @IsString({ message: 'message must be a string when provided' })
  @Length(0, EXPORT_RESPONSE_CONSTANTS.MESSAGE.MAX_LENGTH, {
    message: `message must not exceed ${EXPORT_RESPONSE_CONSTANTS.MESSAGE.MAX_LENGTH} characters`,
  })
  // SÉCURITÉ : Blocage des balises HTML et scripts
  @Matches(/^[^<>]*$/, {
    message: 'message cannot contain HTML tags',
  })
  message?: string;

  /**
   * Détails de l'erreur si status === 'failed'
   * 
   * Message d'erreur technique pour diagnostic et support.
   * Peut contenir plus de détails que le message utilisateur.
   * 
   * SÉCURITÉ : Sanitisé pour éviter la fuite d'informations sensibles
   * 
   * @example "Erreur lors de la conversion Pandoc: fichier source corrompu"
   */
  @ApiPropertyOptional({
    description: 'Détails de l\'erreur si status === failed',
    example: 'Erreur lors de la conversion Pandoc: fichier source corrompu',
    maxLength: EXPORT_RESPONSE_CONSTANTS.ERROR.MAX_LENGTH,
  })
  @IsOptional()
  @IsString({ message: 'error must be a string when provided' })
  @Length(0, EXPORT_RESPONSE_CONSTANTS.ERROR.MAX_LENGTH, {
    message: `error must not exceed ${EXPORT_RESPONSE_CONSTANTS.ERROR.MAX_LENGTH} characters`,
  })
  // SÉCURITÉ : Blocage des informations sensibles et des balises
  @Matches(/^(?!.*(?:password|token|key|secret))[^<>]*$/i, {
    message: 'error message cannot contain sensitive information or HTML tags',
  })
  error?: string;

  /**
   * Temps estimé restant en secondes (si calculable)
   * 
   * Estimation basée sur la progression actuelle et les performances historiques.
   * Peut être imprécis mais donne une indication à l'utilisateur.
   * 
   * @example 30 (30 secondes restantes)
   */
  @ApiPropertyOptional({
    description: 'Temps estimé restant en secondes (si calculable)',
    example: 30,
    minimum: 0,
    maximum: 3600, // Max 1 heure
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 0 }, { message: 'estimatedTimeRemaining must be an integer' })
  @Min(0, { message: 'estimatedTimeRemaining cannot be negative' })
  @Max(3600, { message: 'estimatedTimeRemaining cannot exceed 1 hour' })
  estimatedTimeRemaining?: number;

  /**
   * Timestamp de dernière mise à jour du statut
   * 
   * Permet de détecter les processus bloqués et l'obsolescence des données.
   * Utile pour l'invalidation côté client et le debugging.
   * 
   * @example new Date('2024-08-18T10:35:22.123Z')
   */
  @ApiPropertyOptional({
    description: 'Timestamp de dernière mise à jour du statut',
    example: '2024-08-18T10:35:22.123Z',
    format: 'date-time',
  })
  @IsOptional()
  @IsDate({ message: 'lastUpdated must be a valid date' })
  @Type(() => Date)
  lastUpdated?: Date;

  /**
   * Vérifie si le statut indique un export terminé (succès ou échec)
   * 
   * @returns true si l'export est dans un état final
   */
  isCompleted(): boolean {
    return this.status === 'completed' || this.status === 'failed';
  }

  /**
   * Vérifie si l'export est en cours de traitement
   * 
   * @returns true si l'export est actif (pending ou processing)
   */
  isActive(): boolean {
    return this.status === 'pending' || this.status === 'processing';
  }

  /**
   * Vérifie si le statut semble obsolète (pas de mise à jour récente)
   * 
   * @param maxAgeMinutes Âge maximum acceptable en minutes (défaut: 5)
   * @returns true si la dernière mise à jour est trop ancienne
   */
  isStale(maxAgeMinutes: number = 5): boolean {
    if (!this.lastUpdated) return true;
    
    const now = new Date().getTime();
    const lastUpdate = this.lastUpdated.getTime();
    const ageMs = now - lastUpdate;
    
    return ageMs > (maxAgeMinutes * 60 * 1000);
  }

  /**
   * Formate le temps estimé restant en texte lisible
   * 
   * @returns Durée formatée ou message si non disponible
   * 
   * @example "30 secondes", "2 minutes", "Non disponible"
   */
  getFormattedTimeRemaining(): string {
    if (!this.estimatedTimeRemaining || this.estimatedTimeRemaining <= 0) {
      return 'Non disponible';
    }
    
    const seconds = this.estimatedTimeRemaining;
    
    if (seconds < 60) {
      return `${seconds} seconde${seconds > 1 ? 's' : ''}`;
    }
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (remainingSeconds === 0) {
      return `${minutes} minute${minutes > 1 ? 's' : ''}`;
    }
    
    return `${minutes}min ${remainingSeconds}s`;
  }

  /**
   * Génère un message de statut complet pour l'interface utilisateur
   * 
   * @returns Message descriptif incluant progression et temps estimé
   * 
   * @example "En cours (75%) - Conversion PDF... - 30 secondes restantes"
   */
  getDisplayMessage(): string {
    const statusMap = {
      pending: 'En attente',
      processing: 'En cours',
      completed: 'Terminé',
      failed: 'Échec',
    };
    
    let display = statusMap[this.status];
    
    if (this.progress !== undefined && this.status === 'processing') {
      display += ` (${this.progress}%)`;
    }
    
    if (this.message) {
      display += ` - ${this.message}`;
    }
    
    if (this.estimatedTimeRemaining && this.isActive()) {
      display += ` - ${this.getFormattedTimeRemaining()} restantes`;
    }
    
    return display;
  }

  /**
   * Retourne le niveau de sévérité pour l'affichage UI
   * 
   * @returns Niveau pour coloration/icônes de l'interface
   */
  getSeverityLevel(): 'info' | 'success' | 'warning' | 'error' {
    switch (this.status) {
      case 'pending':
        return 'info';
      case 'processing':
        return 'info';
      case 'completed':
        return 'success';
      case 'failed':
        return 'error';
      default:
        return 'warning';
    }
  }

  /**
   * Crée une version sécurisée pour les logs
   * 
   * SÉCURITÉ : Exclut les informations sensibles des logs
   * 
   * @returns Version safe pour logging
   */
  toLogSafeString(): string {
    const progressInfo = this.progress !== undefined ? `_${this.progress}%` : '';
    const timeInfo = this.estimatedTimeRemaining ? `_${this.estimatedTimeRemaining}s` : '';
    
    return `ExportStatusDto[status=${this.status}${progressInfo}${timeInfo}, stale=${this.isStale()}]`;
  }
}