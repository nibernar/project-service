import { 
  IsString, 
  IsNotEmpty, 
  IsOptional, 
  Length, 
  IsArray, 
  ArrayMaxSize, 
  IsUUID, 
  Matches 
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Constantes de validation pour la création de projets
 * Maintient la cohérence des limites à travers l'application
 */
export const CREATE_PROJECT_CONSTANTS = {
  NAME: {
    MIN_LENGTH: 1,
    MAX_LENGTH: 100,
  },
  DESCRIPTION: {
    MAX_LENGTH: 1000,
  },
  INITIAL_PROMPT: {
    MIN_LENGTH: 10,
    MAX_LENGTH: 5000,
  },
  UPLOADED_FILES: {
    MAX_COUNT: 10,
  },
} as const;

/**
 * DTO pour la création d'un nouveau projet
 * 
 * Valide et structure toutes les données d'entrée nécessaires à la création
 * d'un projet utilisateur. Applique automatiquement les transformations
 * de nettoyage et les validations métier appropriées.
 * 
 * SÉCURITÉ RENFORCÉE :
 * - Protection anti-XSS avec regex strictes
 * - Validation de l'ordre des transformations
 * - Blocage des injections JavaScript
 * - Nettoyage sécurisé des entrées
 * 
 * @example
 * ```typescript
 * @Post()
 * async create(
 *   @Body() createDto: CreateProjectDto,
 *   @CurrentUser() user: User
 * ) {
 *   return this.projectService.create(createDto, user.id);
 * }
 * ```
 */
export class CreateProjectDto {
  /**
   * Nom du projet
   * 
   * Identifiant principal visible par l'utilisateur.
   * Doit être concis mais descriptif pour faciliter la navigation.
   * 
   * SÉCURITÉ : 
   * - Validation stricte avant transformation
   * - Nettoyage sécurisé des espaces
   * - Blocage des caractères dangereux
   * 
   * @example "Application E-commerce", "Système de Gestion RH"
   */
  @ApiProperty({
    description: 'Nom du projet - identifiant principal visible par l\'utilisateur',
    example: 'Application E-commerce',
    minLength: CREATE_PROJECT_CONSTANTS.NAME.MIN_LENGTH,
    maxLength: CREATE_PROJECT_CONSTANTS.NAME.MAX_LENGTH,
    type: 'string',
  })
  @IsString({ message: 'name must be a string' })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.trim();
    }
    return value;
  })
  @IsNotEmpty({ message: 'name is required and cannot be empty' })
  @Length(CREATE_PROJECT_CONSTANTS.NAME.MIN_LENGTH, CREATE_PROJECT_CONSTANTS.NAME.MAX_LENGTH, {
    message: `name must be between ${CREATE_PROJECT_CONSTANTS.NAME.MIN_LENGTH} and ${CREATE_PROJECT_CONSTANTS.NAME.MAX_LENGTH} characters`,
  })
  // SÉCURITÉ : Blocage des caractères potentiellement dangereux
  @Matches(/^[^<>'";&|`${}\\]*$/, {
    message: 'name cannot contain potentially dangerous characters',
  })
  // SÉCURITÉ : Blocage des protocoles dangereux dans le nom aussi
  @Matches(/^(?!.*(?:javascript:|vbscript:|data:|about:|file:|ftp:)).*$/i, {
    message: 'name cannot contain potentially dangerous protocols',
  })
  name: string;

  /**
   * Description détaillée du projet (optionnelle)
   * 
   * Fournit un contexte supplémentaire sur les objectifs et la portée
   * du projet. Utilisée pour enrichir la génération documentaire.
   * 
   * SÉCURITÉ : Nettoyage sécurisé et validation renforcée
   * 
   * @example "Plateforme de vente en ligne avec gestion des stocks, paiements et livraisons"
   */
  @ApiPropertyOptional({
    description: 'Description détaillée du projet pour contexte supplémentaire',
    example: 'Plateforme de vente en ligne avec gestion des stocks, paiements et livraisons',
    maxLength: CREATE_PROJECT_CONSTANTS.DESCRIPTION.MAX_LENGTH,
    type: 'string',
  })
  @IsOptional()
  @IsString({ message: 'description must be a string when provided' })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    }
    return value;
  })
  @Length(0, CREATE_PROJECT_CONSTANTS.DESCRIPTION.MAX_LENGTH, {
    message: `description must not exceed ${CREATE_PROJECT_CONSTANTS.DESCRIPTION.MAX_LENGTH} characters`,
  })
  // SÉCURITÉ : Blocage des balises HTML et scripts
  @Matches(/^(?!.*<[^>]*>)(?!.*(?:javascript:|vbscript:|on\w+\s*=)).*$/is, {
    message: 'description cannot contain HTML tags or potentially dangerous scripts',
  })
  description?: string;

  /**
   * Prompt initial fourni par l'utilisateur
   * 
   * Demande originale qui déclenche le processus de génération.
   * Utilisé par l'agent d'interview pour adapter les questions
   * et par l'agent de génération pour contextualiser les documents.
   * 
   * SÉCURITÉ CRITIQUE :
   * - Protection anti-XSS renforcée
   * - Blocage des injections de code
   * - Validation stricte des balises
   * 
   * @example "Je souhaite créer une application de gestion des ressources humaines avec planning, congés et évaluations"
   */
  @ApiProperty({
    description: 'Prompt initial décrivant le projet souhaité - déclenche le processus de génération',
    example: 'Je souhaite créer une application de gestion des ressources humaines avec planning, congés et évaluations',
    minLength: CREATE_PROJECT_CONSTANTS.INITIAL_PROMPT.MIN_LENGTH,
    maxLength: CREATE_PROJECT_CONSTANTS.INITIAL_PROMPT.MAX_LENGTH,
    type: 'string',
  })
  @IsString({ message: 'initialPrompt must be a string' })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.trim();
    }
    return value;
  })
  @IsNotEmpty({ message: 'initialPrompt is required and cannot be empty' })
  @Length(CREATE_PROJECT_CONSTANTS.INITIAL_PROMPT.MIN_LENGTH, CREATE_PROJECT_CONSTANTS.INITIAL_PROMPT.MAX_LENGTH, {
    message: `initialPrompt must be between ${CREATE_PROJECT_CONSTANTS.INITIAL_PROMPT.MIN_LENGTH} and ${CREATE_PROJECT_CONSTANTS.INITIAL_PROMPT.MAX_LENGTH} characters`,
  })
  // CORRECTIF SÉCURITÉ CRITIQUE : Regex renforcée pour détecter VRAIMENT les balises HTML
  @Matches(/^(?!.*<[^>]*>).*$/s, {
    message: 'initialPrompt cannot contain HTML or XML tags',
  })
  // SÉCURITÉ : Blocage des injections JavaScript et des protocoles dangereux (mais autoriser les deux-points normaux)
  @Matches(/^(?!.*(?:javascript:|vbscript:|data:|about:|file:|ftp:)).*$/i, {
    message: 'initialPrompt cannot contain potentially dangerous protocols',
  })
  // SÉCURITÉ : Blocage des gestionnaires d'événements et des expressions dangereuses
  @Matches(/^(?!.*(?:on\w+\s*=|eval\s*\(|expression\s*\(|\$\{)).*$/i, {
    message: 'initialPrompt cannot contain event handlers or dangerous expressions',
  })
  initialPrompt: string;

  /**
   * Identifiants des fichiers uploadés (optionnel)
   * 
   * Liste des UUIDs des fichiers fournis par l'utilisateur comme
   * contexte supplémentaire (spécifications, cahiers des charges, etc.).
   * Ces fichiers seront analysés pour enrichir la génération.
   * 
   * SÉCURITÉ : Validation stricte des UUIDs pour éviter les injections
   * 
   * @example ["550e8400-e29b-41d4-a716-446655440000", "6ba7b810-9dad-11d1-80b4-00c04fd430c8"]
   */
  @ApiPropertyOptional({
    description: 'Liste des identifiants UUID des fichiers uploadés comme contexte',
    example: ['550e8400-e29b-41d4-a716-446655440000', '6ba7b810-9dad-11d1-80b4-00c04fd430c8'],
    type: 'array',
    items: {
      type: 'string',
      format: 'uuid',
    },
    maxItems: CREATE_PROJECT_CONSTANTS.UPLOADED_FILES.MAX_COUNT,
  })
  @IsOptional()
  @IsArray({ message: 'uploadedFileIds must be an array when provided' })
  @ArrayMaxSize(CREATE_PROJECT_CONSTANTS.UPLOADED_FILES.MAX_COUNT, {
    message: `maximum ${CREATE_PROJECT_CONSTANTS.UPLOADED_FILES.MAX_COUNT} files can be uploaded`,
  })
  @IsString({ each: true, message: 'each uploadedFileId must be a string' })
  // SÉCURITÉ : Validation UUID stricte pour éviter les injections
  @IsUUID(4, { each: true, message: 'each uploadedFileId must be a valid UUID v4' })
  uploadedFileIds?: string[];

  /**
   * Valide que le DTO contient les informations minimales requises
   * 
   * SÉCURITÉ : Validation supplémentaire côté métier
   * 
   * @returns true si le DTO est valide pour la création
   * 
   * @example
   * ```typescript
   * const dto = new CreateProjectDto();
   * dto.name = 'Test';
   * dto.initialPrompt = 'Create a simple app';
   * 
   * if (dto.isValid()) {
   *   // Procéder à la création
   * }
   * ```
   */
  isValid(): boolean {
    // Validation renforcée avec vérifications de sécurité
    if (!this.name || typeof this.name !== 'string') return false;
    if (!this.initialPrompt || typeof this.initialPrompt !== 'string') return false;
    
    const trimmedName = this.name.trim();
    const trimmedPrompt = this.initialPrompt.trim();
    
    // Vérifications de longueur
    if (trimmedName.length < CREATE_PROJECT_CONSTANTS.NAME.MIN_LENGTH ||
        trimmedName.length > CREATE_PROJECT_CONSTANTS.NAME.MAX_LENGTH) return false;
        
    if (trimmedPrompt.length < CREATE_PROJECT_CONSTANTS.INITIAL_PROMPT.MIN_LENGTH ||
        trimmedPrompt.length > CREATE_PROJECT_CONSTANTS.INITIAL_PROMPT.MAX_LENGTH) return false;
    
    // Vérifications de sécurité supplémentaires
    const dangerousPatterns = [
      /<[^>]*>/,                    // Balises HTML
      /javascript:/i,               // Protocole JavaScript
      /vbscript:/i,                 // Protocole VBScript
      /on\w+\s*=/i,                // Gestionnaires d'événements
      /eval\s*\(/i,                // Fonction eval
      /expression\s*\(/i,          // Expressions CSS
    ];
    
    for (const pattern of dangerousPatterns) {
      if (pattern.test(trimmedName) || pattern.test(trimmedPrompt)) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Retourne le nombre de fichiers uploadés
   * 
   * @returns Nombre de fichiers dans uploadedFileIds (0 si non défini)
   * 
   * @example
   * ```typescript
   * const dto = new CreateProjectDto();
   * dto.uploadedFileIds = ['uuid1', 'uuid2'];
   * console.log(dto.getUploadedFilesCount()); // 2
   * ```
   */
  getUploadedFilesCount(): number {
    return this.uploadedFileIds?.length ?? 0;
  }

  /**
   * Vérifie si le projet a des fichiers uploadés
   * 
   * @returns true si au moins un fichier est uploadé
   */
  hasUploadedFiles(): boolean {
    return this.getUploadedFilesCount() > 0;
  }

  /**
   * Estime la complexité du prompt initial
   * 
   * @returns Score de complexité basé sur la longueur et le contenu
   * 
   * @example
   * ```typescript
   * const dto = new CreateProjectDto();
   * dto.initialPrompt = 'Simple app';
   * console.log(dto.getPromptComplexity()); // 'low'
   * ```
   */
  getPromptComplexity(): 'low' | 'medium' | 'high' {
    if (!this.initialPrompt) return 'low';
    
    const length = this.initialPrompt.length;
    const wordCount = this.initialPrompt.split(/\s+/).length;
    
    // Complexité basée sur la longueur et le nombre de mots
    if (length < 100 || wordCount < 15) return 'low';
    if (length < 300 || wordCount < 50) return 'medium';
    return 'high';
  }

  /**
   * Génère un résumé du DTO pour le logging
   * 
   * SÉCURITÉ : Version non sensible pour les logs
   * 
   * @returns Chaîne descriptive du contenu du DTO
   */
  toString(): string {
    const filesInfo = this.hasUploadedFiles() 
      ? `, files=${this.getUploadedFilesCount()}` 
      : '';
    const descInfo = this.description ? ', with_description=true' : '';
    
    return `CreateProjectDto[name="${this.name}"${descInfo}, prompt_complexity=${this.getPromptComplexity()}${filesInfo}]`;
  }

  /**
   * Crée une version sanitisée du DTO pour le logging (sans données sensibles)
   * 
   * SÉCURITÉ CRITIQUE : Aucune donnée utilisateur sensible exposée
   * 
   * @returns Version sécurisée pour les logs
   */
  toLogSafeString(): string {
    // SÉCURITÉ : Aucune donnée utilisateur dans les logs
    return `CreateProjectDto[name_length=${this.name?.length ?? 0}, prompt_length=${this.initialPrompt?.length ?? 0}, files_count=${this.getUploadedFilesCount()}]`;
  }
}