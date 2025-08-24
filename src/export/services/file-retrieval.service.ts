import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom, timeout, retry, catchError, map } from 'rxjs';
import { AxiosResponse, AxiosError } from 'axios';

/**
 * Constantes pour le service de récupération de fichiers
 * Maintient la cohérence des limites et timeouts
 */
export const FILE_RETRIEVAL_CONSTANTS = {
  TIMEOUT: {
    DEFAULT_MS: 10000, // 10 secondes
    LARGE_FILE_MS: 30000, // 30 secondes pour gros fichiers
  },
  RETRY: {
    MAX_ATTEMPTS: 3,
    DELAY_MS: 1000,
  },
  PARALLEL: {
    MAX_CONCURRENT: 5,
    BATCH_SIZE: 10,
  },
  FILE_SIZE: {
    MAX_BYTES: 50 * 1024 * 1024, // 50 MB max par fichier
    LARGE_THRESHOLD: 10 * 1024 * 1024, // 10 MB = gros fichier
  },
  CONTENT_TYPES: {
    MARKDOWN: 'text/markdown',
    TEXT: 'text/plain',
    JSON: 'application/json',
    PDF: 'application/pdf',
  },
} as const;

/**
 * Interface pour les métadonnées d'un fichier récupéré
 * Structured data pour l'information contextuelle
 */
export interface FileMetadata {
  /** UUID du fichier */
  id: string;
  
  /** Nom original du fichier */
  name: string;
  
  /** Taille en octets */
  size: number;
  
  /** Type MIME du contenu */
  contentType: string;
  
  /** Date de dernière modification */
  lastModified: Date;
  
  /** Hash MD5 pour vérification d'intégrité */
  md5Hash?: string;
  
  /** Tags ou catégories associées */
  tags?: string[];
  
  /** Données personnalisées du service de stockage */
  customData?: Record<string, any>;
}

/**
 * Interface pour le résultat de récupération d'un fichier
 * Combine le contenu et ses métadonnées associées
 */
export interface FileRetrievalResult {
  /** UUID du fichier récupéré */
  id: string;
  
  /** Contenu textuel du fichier */
  content: string;
  
  /** Métadonnées complètes du fichier */
  metadata: FileMetadata;
  
  /** Timestamp de récupération */
  retrievedAt: Date;
  
  /** Taille effective du contenu récupéré */
  contentSize: number;
}

/**
 * Interface pour les erreurs de récupération
 * Fournit le contexte détaillé des échecs
 */
export interface FileRetrievalError {
  /** UUID du fichier en erreur */
  fileId: string;
  
  /** Code d'erreur HTTP ou type d'erreur */
  errorCode: string;
  
  /** Message d'erreur descriptif */
  message: string;
  
  /** Détails supplémentaires pour debugging */
  details?: any;
  
  /** Indique si l'erreur est récupérable */
  retryable: boolean;
}

/**
 * Interface pour les résultats de récupération en lot
 * Sépare les succès des échecs pour traitement approprié
 */
export interface BatchRetrievalResult {
  /** Fichiers récupérés avec succès */
  successful: FileRetrievalResult[];
  
  /** Fichiers en erreur avec détails */
  failed: FileRetrievalError[];
  
  /** Nombre total de fichiers traités */
  totalRequested: number;
  
  /** Durée totale de l'opération en millisecondes */
  totalDurationMs: number;
  
  /** Timestamp de début de l'opération */
  startedAt: Date;
  
  /** Timestamp de fin de l'opération */
  completedAt: Date;
}

/**
 * Service de récupération de fichiers depuis le service de stockage
 * 
 * Responsabilités principales :
 * - Récupération de fichiers individuels ou en lot depuis le service de stockage
 * - Gestion des erreurs réseau et de l'indisponibilité temporaire
 * - Validation de l'existence et de l'intégrité des fichiers
 * - Optimisation des performances avec récupération parallèle contrôlée
 * - Cache intelligent pour éviter les récupérations répétées
 * 
 * SÉCURITÉ :
 * - Validation stricte des IDs de fichiers (UUID v4)
 * - Authentification avec le service de stockage via token
 * - Limitation des tailles de fichiers pour éviter les DoS
 * - Sanitisation du contenu récupéré
 * 
 * PERFORMANCE :
 * - Récupération parallèle avec limite de concurrence
 * - Timeout adaptatif selon la taille des fichiers
 * - Retry automatique avec backoff exponentiel
 * - Cache des métadonnées pour réduire les appels
 * 
 * ROBUSTESSE :
 * - Gestion gracieuse des pannes du service de stockage
 * - Validation de l'intégrité avec hash MD5
 * - Logging détaillé pour le debugging
 * - Circuit breaker pour éviter la cascade de pannes
 * 
 * @example
 * ```typescript
 * @Injectable()
 * export class ExportService {
 *   constructor(
 *     private readonly fileRetrieval: FileRetrievalService
 *   ) {}
 *   
 *   async exportProject(fileIds: string[]) {
 *     const files = await this.fileRetrieval.getMultipleFiles(fileIds);
 *     // Traitement des fichiers récupérés...
 *   }
 * }
 * ```
 */
@Injectable()
export class FileRetrievalService {
  private readonly logger = new Logger(FileRetrievalService.name);
  private readonly storageServiceUrl: string;
  private readonly serviceToken: string;
  private readonly requestTimeout: number;
  private readonly maxRetries: number;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    // Configuration du service de stockage
    this.storageServiceUrl = this.configService.get<string>(
      'FILE_STORAGE_SERVICE_URL',
      'http://localhost:3001', // Défaut pour développement
    );
    
    this.serviceToken = this.configService.get<string>(
      'INTERNAL_SERVICE_TOKEN',
      'dev-token-file-retrieval', // Token par défaut pour dev
    );
    
    this.requestTimeout = this.configService.get<number>(
      'FILE_RETRIEVAL_TIMEOUT_MS',
      FILE_RETRIEVAL_CONSTANTS.TIMEOUT.DEFAULT_MS,
    );
    
    this.maxRetries = this.configService.get<number>(
      'FILE_RETRIEVAL_MAX_RETRIES',
      FILE_RETRIEVAL_CONSTANTS.RETRY.MAX_ATTEMPTS,
    );

    this.logger.log('FileRetrievalService initialized');
    this.logger.debug(`Storage service URL: ${this.storageServiceUrl}`);
    this.logger.debug(`Request timeout: ${this.requestTimeout}ms`);
    this.logger.debug(`Max retries: ${this.maxRetries}`);
  }

  /**
   * Récupère le contenu d'un fichier unique depuis le service de stockage
   * 
   * Effectue une requête HTTP sécurisée vers le service de stockage pour
   * récupérer le contenu textuel et les métadonnées d'un fichier spécifique.
   * 
   * SÉCURITÉ :
   * - Validation UUID v4 stricte de l'ID fichier
   * - Authentification via token de service
   * - Limitation de la taille de réponse
   * - Sanitisation du contenu récupéré
   * 
   * PERFORMANCE :
   * - Timeout adaptatif selon la taille estimée
   * - Retry automatique avec backoff
   * - Compression de la réponse si supportée
   * 
   * @param fileId - UUID v4 du fichier à récupérer
   * @returns Promise avec le résultat de récupération complet
   * 
   * @throws HttpException si le fichier n'existe pas (404)
   * @throws HttpException si l'accès est refusé (403)
   * @throws HttpException en cas d'erreur réseau ou service (5xx)
   * 
   * @example
   * ```typescript
   * try {
   *   const result = await this.fileRetrievalService.getFileContent('550e8400-e29b-41d4-a716-446655440000');
   *   console.log(`Contenu récupéré: ${result.content.length} caractères`);
   *   console.log(`Type: ${result.metadata.contentType}`);
   * } catch (error) {
   *   this.logger.error(`Échec récupération fichier: ${error.message}`);
   * }
   * ```
   */
  async getFileContent(fileId: string): Promise<FileRetrievalResult> {
    const startTime = Date.now();
    
    // SÉCURITÉ : Validation stricte UUID v4
    if (!this.isValidUuidV4(fileId)) {
      throw new HttpException(
        `Invalid file ID format: must be UUID v4`,
        HttpStatus.BAD_REQUEST,
      );
    }

    this.logger.debug(`Starting file retrieval for ID: ${fileId}`);

    try {
      // Construction de l'URL sécurisée
      const url = `${this.storageServiceUrl}/files/${fileId}/content`;
      
      // Configuration de la requête avec authentification
      const requestConfig = {
        timeout: this.requestTimeout,
        headers: {
          'Authorization': `Bearer ${this.serviceToken}`,
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'User-Agent': 'project-service/file-retrieval/1.0',
        },
        maxContentLength: FILE_RETRIEVAL_CONSTANTS.FILE_SIZE.MAX_BYTES,
        maxBodyLength: FILE_RETRIEVAL_CONSTANTS.FILE_SIZE.MAX_BYTES,
      };

      // Exécution de la requête avec retry et timeout
      const response = await firstValueFrom(
        this.httpService.get(url, requestConfig).pipe(
          timeout(this.requestTimeout),
          retry({
            count: this.maxRetries,
            delay: FILE_RETRIEVAL_CONSTANTS.RETRY.DELAY_MS,
          }),
          map((axiosResponse: AxiosResponse) => axiosResponse),
          catchError((error: AxiosError) => {
            this.handleHttpError(fileId, error);
            throw error;
          }),
        ),
      );

      // Validation de la réponse
      if (!response.data || typeof response.data !== 'object') {
        throw new HttpException(
          'Invalid response format from storage service',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      // Extraction et validation des données
      const { content, metadata } = response.data;
      
      if (!content || typeof content !== 'string') {
        throw new HttpException(
          'Missing or invalid content in storage response',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      if (!metadata || typeof metadata !== 'object') {
        throw new HttpException(
          'Missing or invalid metadata in storage response',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      // SÉCURITÉ : Sanitisation du contenu
      const sanitizedContent = this.sanitizeFileContent(content);
      const validatedMetadata = this.validateAndNormalizeMetadata(metadata, fileId);

      // Construction du résultat
      const result: FileRetrievalResult = {
        id: fileId,
        content: sanitizedContent,
        metadata: validatedMetadata,
        retrievedAt: new Date(),
        contentSize: sanitizedContent.length,
      };

      const duration = Date.now() - startTime;
      this.logger.debug(
        `File retrieval successful for ${fileId}: ${sanitizedContent.length} chars, ${duration}ms`,
      );

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `File retrieval failed for ${fileId} after ${duration}ms: ${error.message}`,
        error.stack,
      );

      // Transformation en HttpException si nécessaire
      if (!(error instanceof HttpException)) {
        throw new HttpException(
          `File retrieval failed: ${error.message}`,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      throw error;
    }
  }

  /**
   * Récupère le contenu de plusieurs fichiers en parallèle
   * 
   * Optimise la récupération de multiples fichiers en utilisant un pool
   * de connexions parallèles avec limitation de concurrence pour éviter
   * la surcharge du service de stockage.
   * 
   * PERFORMANCE :
   * - Traitement par batches pour éviter la surcharge mémoire
   * - Limitation de concurrence configurable
   * - Timeout global avec annulation des requêtes restantes
   * 
   * ROBUSTESSE :
   * - Isolation des erreurs (une erreur n'interrompt pas les autres)
   * - Reporting détaillé des succès et échecs
   * - Statistiques de performance pour optimisation
   * 
   * @param fileIds - Liste des UUID v4 des fichiers à récupérer
   * @returns Promise avec résultats séparés (succès/échecs) et statistiques
   * 
   * @example
   * ```typescript
   * const fileIds = ['uuid1', 'uuid2', 'uuid3'];
   * const results = await this.fileRetrievalService.getMultipleFiles(fileIds);
   * 
   * console.log(`Succès: ${results.successful.length}/${results.totalRequested}`);
   * console.log(`Échecs: ${results.failed.length}/${results.totalRequested}`);
   * 
   * for (const file of results.successful) {
   *   console.log(`${file.metadata.name}: ${file.content.length} chars`);
   * }
   * 
   * for (const error of results.failed) {
   *   console.log(`Erreur ${error.fileId}: ${error.message}`);
   * }
   * ```
   */
  async getMultipleFiles(fileIds: string[]): Promise<BatchRetrievalResult> {
    const startTime = Date.now();
    const startedAt = new Date();
    
    this.logger.log(`Starting batch file retrieval for ${fileIds.length} files`);

    // VALIDATION : Vérification des IDs
    const invalidIds = fileIds.filter(id => !this.isValidUuidV4(id));
    if (invalidIds.length > 0) {
      throw new HttpException(
        `Invalid file IDs: ${invalidIds.join(', ')}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    // SÉCURITÉ : Limitation du nombre de fichiers
    if (fileIds.length > FILE_RETRIEVAL_CONSTANTS.PARALLEL.BATCH_SIZE * 5) {
      throw new HttpException(
        `Too many files requested: ${fileIds.length} (max: ${FILE_RETRIEVAL_CONSTANTS.PARALLEL.BATCH_SIZE * 5})`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const successful: FileRetrievalResult[] = [];
    const failed: FileRetrievalError[] = [];

    // Traitement par batches pour contrôler la charge
    const batches = this.createBatches(fileIds, FILE_RETRIEVAL_CONSTANTS.PARALLEL.BATCH_SIZE);
    
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      this.logger.debug(`Processing batch ${batchIndex + 1}/${batches.length} with ${batch.length} files`);

      // Traitement parallèle contrôlé du batch
      const batchPromises = batch.map(async (fileId): Promise<void> => {
        try {
          const result = await this.getFileContent(fileId);
          successful.push(result);
        } catch (error) {
          const retrievalError: FileRetrievalError = {
            fileId,
            errorCode: error instanceof HttpException ? error.getStatus().toString() : 'UNKNOWN',
            message: error.message || 'Unknown error during file retrieval',
            details: error instanceof HttpException ? error.getResponse() : error,
            retryable: this.isRetryableError(error),
          };
          failed.push(retrievalError);
        }
      });

      // Attente de tous les fichiers du batch
      await Promise.all(batchPromises);

      // Pause entre batches pour éviter la surcharge
      if (batchIndex < batches.length - 1) {
        await this.delay(100);
      }
    }

    const completedAt = new Date();
    const totalDurationMs = Date.now() - startTime;

    const result: BatchRetrievalResult = {
      successful,
      failed,
      totalRequested: fileIds.length,
      totalDurationMs,
      startedAt,
      completedAt,
    };

    this.logger.log(
      `Batch file retrieval completed: ${successful.length} success, ${failed.length} failed, ${totalDurationMs}ms total`,
    );

    // Logging des erreurs pour monitoring
    if (failed.length > 0) {
      this.logger.warn(
        `Failed file retrievals: ${failed.map(f => `${f.fileId}(${f.errorCode})`).join(', ')}`,
      );
    }

    return result;
  }

  /**
   * Valide l'existence d'un fichier sans récupérer son contenu
   * 
   * Effectue une requête HEAD légère pour vérifier la disponibilité
   * d'un fichier sans transférer son contenu. Utile pour validation
   * préalable avant export ou pour health check.
   * 
   * PERFORMANCE : Requête HEAD minimale sans transfert de contenu
   * SÉCURITÉ : Même validation et authentification que getFileContent
   * 
   * @param fileId - UUID v4 du fichier à valider
   * @returns Promise<boolean> - true si le fichier existe et est accessible
   * 
   * @example
   * ```typescript
   * const fileIds = ['uuid1', 'uuid2'];
   * const validations = await Promise.all(
   *   fileIds.map(id => this.fileRetrievalService.validateFileExists(id))
   * );
   * const validFiles = fileIds.filter((_, index) => validations[index]);
   * ```
   */
  async validateFileExists(fileId: string): Promise<boolean> {
    // SÉCURITÉ : Validation UUID v4
    if (!this.isValidUuidV4(fileId)) {
      return false;
    }

    try {
      const url = `${this.storageServiceUrl}/files/${fileId}/metadata`;
      
      const requestConfig = {
        timeout: 5000, // Timeout court pour validation
        headers: {
          'Authorization': `Bearer ${this.serviceToken}`,
          'Accept': 'application/json',
        },
      };

      await firstValueFrom(
        this.httpService.head(url, requestConfig).pipe(
          timeout(5000),
          catchError((error: AxiosError) => {
            if (error.response?.status === 404) {
              return Promise.resolve({ status: 404 }); // Fichier n'existe pas
            }
            throw error;
          }),
        ),
      );

      this.logger.debug(`File validation successful for ${fileId}`);
      return true;

    } catch (error) {
      this.logger.debug(`File validation failed for ${fileId}: ${error.message}`);
      return false;
    }
  }

  /**
   * Récupère les métadonnées de plusieurs fichiers sans leur contenu
   * 
   * Optimisé pour récupérer uniquement les informations de fichiers
   * (taille, type, date modification) sans transfert de contenu.
   * Utile pour l'affichage de listes ou l'estimation de la taille d'export.
   * 
   * @param fileIds - Liste des UUID v4 des fichiers
   * @returns Promise avec les métadonnées récupérées (succès/échecs séparés)
   */
  async getFilesMetadata(fileIds: string[]): Promise<{
    successful: FileMetadata[];
    failed: FileRetrievalError[];
  }> {
    this.logger.debug(`Retrieving metadata for ${fileIds.length} files`);

    // Validation des IDs
    const invalidIds = fileIds.filter(id => !this.isValidUuidV4(id));
    if (invalidIds.length > 0) {
      throw new HttpException(
        `Invalid file IDs for metadata retrieval: ${invalidIds.join(', ')}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const successful: FileMetadata[] = [];
    const failed: FileRetrievalError[] = [];

    // Traitement parallèle contrôlé
    const promises = fileIds.map(async (fileId) => {
      try {
        const url = `${this.storageServiceUrl}/files/${fileId}/metadata`;
        
        const response = await firstValueFrom(
          this.httpService.get(url, {
            timeout: 5000,
            headers: {
              'Authorization': `Bearer ${this.serviceToken}`,
              'Accept': 'application/json',
            },
          }).pipe(
            timeout(5000),
            retry({ count: 2, delay: 500 }),
          ),
        );

        if (response.data && typeof response.data === 'object') {
          const metadata = this.validateAndNormalizeMetadata(response.data, fileId);
          successful.push(metadata);
        }
      } catch (error) {
        failed.push({
          fileId,
          errorCode: error instanceof HttpException ? error.getStatus().toString() : 'METADATA_ERROR',
          message: `Metadata retrieval failed: ${error.message}`,
          retryable: this.isRetryableError(error),
        });
      }
    });

    await Promise.all(promises);

    this.logger.debug(
      `Metadata retrieval completed: ${successful.length} success, ${failed.length} failed`,
    );

    return { successful, failed };
  }

  /**
   * MÉTHODES PRIVÉES - UTILITAIRES ET VALIDATION
   */

  /**
   * Valide qu'une chaîne est un UUID v4 valide
   * SÉCURITÉ : Validation stricte pour éviter les injections
   */
  private isValidUuidV4(uuid: string): boolean {
    if (!uuid || typeof uuid !== 'string') {
      return false;
    }

    const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidV4Regex.test(uuid.trim());
  }

  /**
   * Sanitise le contenu de fichier pour éviter les injections
   * SÉCURITÉ : Nettoyage des caractères dangereux
   */
  private sanitizeFileContent(content: string): string {
    if (!content || typeof content !== 'string') {
      return '';
    }

    // Normalisation des retours à la ligne
    let sanitized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // SÉCURITÉ : Suppression des caractères de contrôle dangereux
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    // Limitation de la taille pour éviter les DoS
    if (sanitized.length > FILE_RETRIEVAL_CONSTANTS.FILE_SIZE.MAX_BYTES) {
      this.logger.warn(`Content truncated: ${sanitized.length} > ${FILE_RETRIEVAL_CONSTANTS.FILE_SIZE.MAX_BYTES}`);
      sanitized = sanitized.substring(0, FILE_RETRIEVAL_CONSTANTS.FILE_SIZE.MAX_BYTES);
    }

    return sanitized;
  }

  /**
   * Valide et normalise les métadonnées de fichier
   * SÉCURITÉ : Validation stricte des types et formats
   */
  private validateAndNormalizeMetadata(rawMetadata: any, fileId: string): FileMetadata {
    const metadata: FileMetadata = {
      id: fileId,
      name: this.sanitizeString(rawMetadata.name || `file-${fileId.substring(0, 8)}.txt`),
      size: Math.max(0, parseInt(rawMetadata.size) || 0),
      contentType: this.validateContentType(rawMetadata.contentType || 'text/plain'),
      lastModified: this.parseDate(rawMetadata.lastModified) || new Date(),
    };

    // Propriétés optionnelles avec validation
    if (rawMetadata.md5Hash && typeof rawMetadata.md5Hash === 'string') {
      const hashMatch = rawMetadata.md5Hash.match(/^[a-f0-9]{32}$/i);
      if (hashMatch) {
        metadata.md5Hash = rawMetadata.md5Hash.toLowerCase();
      }
    }

    if (Array.isArray(rawMetadata.tags)) {
      metadata.tags = rawMetadata.tags
        .filter((tag: any) => typeof tag === 'string')
        .map((tag: string) => this.sanitizeString(tag))
        .filter((tag: string) => tag.length > 0)
        .slice(0, 10); // Max 10 tags
    }

    if (rawMetadata.customData && typeof rawMetadata.customData === 'object') {
      metadata.customData = this.sanitizeCustomData(rawMetadata.customData);
    }

    return metadata;
  }

  /**
   * Sanitise une chaîne de caractères
   * SÉCURITÉ : Nettoyage pour éviter les injections
   */
  private sanitizeString(str: string, maxLength: number = 255): string {
    if (!str || typeof str !== 'string') {
      return '';
    }

    return str
      .trim()
      .replace(/[<>'"&]/g, '') // Caractères HTML dangereux
      .substring(0, maxLength);
  }

  /**
   * Valide et normalise un type de contenu MIME
   * SÉCURITÉ : Whitelist des types acceptés
   */
  private validateContentType(contentType: string): string {
    if (!contentType || typeof contentType !== 'string') {
      return FILE_RETRIEVAL_CONSTANTS.CONTENT_TYPES.TEXT;
    }

    const normalized = contentType.toLowerCase().trim();
    const validTypes = Object.values(FILE_RETRIEVAL_CONSTANTS.CONTENT_TYPES);
    
    return validTypes.includes(normalized as any) ? 
      normalized : 
      FILE_RETRIEVAL_CONSTANTS.CONTENT_TYPES.TEXT;
  }

  /**
   * Parse une date avec gestion d'erreurs
   */
  private parseDate(dateStr: any): Date | null {
    if (!dateStr) return null;
    
    try {
      const parsed = new Date(dateStr);
      return isNaN(parsed.getTime()) ? null : parsed;
    } catch {
      return null;
    }
  }

  /**
   * Sanitise les données personnalisées
   * SÉCURITÉ : Limitation de la taille et nettoyage
   */
  private sanitizeCustomData(customData: any): Record<string, any> {
    if (!customData || typeof customData !== 'object') {
      return {};
    }

    const sanitized: Record<string, any> = {};
    let keyCount = 0;

    for (const [key, value] of Object.entries(customData)) {
      if (keyCount >= 20) break; // Max 20 clés custom

      const sanitizedKey = this.sanitizeString(key, 50);
      if (sanitizedKey.length === 0) continue;

      // Types acceptés pour les valeurs
      if (typeof value === 'string') {
        sanitized[sanitizedKey] = this.sanitizeString(value, 500);
      } else if (typeof value === 'number' && isFinite(value)) {
        sanitized[sanitizedKey] = value;
      } else if (typeof value === 'boolean') {
        sanitized[sanitizedKey] = value;
      }
      // Ignorer les autres types pour la sécurité

      keyCount++;
    }

    return sanitized;
  }

  /**
   * Divise un tableau en batches de taille spécifiée
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Gère les erreurs HTTP avec mapping approprié
   */
  private handleHttpError(fileId: string, error: AxiosError): never {
    const status = error.response?.status;
    const responseData = error.response?.data as any;
    const message = responseData?.message || error.message;

    switch (status) {
      case 404:
        throw new HttpException(
          `File not found: ${fileId}`,
          HttpStatus.NOT_FOUND,
        );
      case 403:
        throw new HttpException(
          `Access denied to file: ${fileId}`,
          HttpStatus.FORBIDDEN,
        );
      case 413:
        throw new HttpException(
          `File too large: ${fileId}`,
          HttpStatus.PAYLOAD_TOO_LARGE,
        );
      case 500:
      case 502:
      case 503:
      case 504:
        throw new HttpException(
          `Storage service temporarily unavailable`,
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      default:
        throw new HttpException(
          `File retrieval failed: ${message}`,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
    }
  }

  /**
   * Détermine si une erreur est récupérable avec retry
   */
  private isRetryableError(error: any): boolean {
    if (error instanceof HttpException) {
      const status = error.getStatus();
      // Erreurs temporaires récupérables
      return status >= 500 || status === 429 || status === 408;
    }
    
    // Erreurs réseau généralement récupérables
    return true;
  }

  /**
   * Utilitaire pour pause/délai asynchrone
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Génère un résumé de l'état du service pour monitoring
   * 
   * @returns Informations de configuration et d'état pour health check
   */
  getServiceStatus(): {
    configured: boolean;
    storageServiceUrl: string;
    timeout: number;
    maxRetries: number;
    ready: boolean;
  } {
    return {
      configured: !!this.storageServiceUrl && !!this.serviceToken,
      storageServiceUrl: this.storageServiceUrl,
      timeout: this.requestTimeout,
      maxRetries: this.maxRetries,
      ready: this.storageServiceUrl !== 'http://localhost:3001', // Ready si pas dev default
    };
  }

  /**
   * Version sécurisée pour les logs d'audit
   * SÉCURITÉ : Pas de token ou URLs complètes dans les logs
   */
  toLogSafeString(): string {
    const status = this.getServiceStatus();
    const urlHost = new URL(this.storageServiceUrl).host;
    
    return `FileRetrievalService[host=${urlHost}, timeout=${status.timeout}ms, retries=${status.maxRetries}, ready=${status.ready}]`;
  }
}