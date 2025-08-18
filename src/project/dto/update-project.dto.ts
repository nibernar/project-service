import {
  IsString,
  IsOptional,
  Length,
  Matches,
  IsNotEmpty,
  ValidateIf,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  Validate,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Constantes de validation pour la mise à jour de projets
 */
export const UPDATE_PROJECT_CONSTANTS = {
  NAME: {
    MIN_LENGTH: 1,
    MAX_LENGTH: 100,
  },
  DESCRIPTION: {
    MAX_LENGTH: 1000,
  },
} as const;

/**
 * Validateur personnalisé pour les caractères Unicode (optimisé)
 */
@ValidatorConstraint({ name: 'unicodeLength', async: false })
export class UnicodeLengthConstraint implements ValidatorConstraintInterface {
  validate(text: string, args: ValidationArguments): boolean {
    if (typeof text !== 'string') return false;
    const [min, max] = args.constraints;

    let length = text.length;

    if (/[\u{10000}-\u{10FFFF}]/u.test(text)) {
      try {
        if (typeof Intl !== 'undefined' && Intl.Segmenter) {
          const segmenter = new Intl.Segmenter('en', {
            granularity: 'grapheme',
          });
          length = Array.from(segmenter.segment(text)).length;
        } else {
          length = [...text].length;
        }
      } catch {
        length = text.length;
      }
    }

    return length >= min && length <= max;
  }

  defaultMessage(args: ValidationArguments): string {
    const [min, max] = args.constraints;
    return `${args.property} must be between ${min} and ${max} characters`;
  }
}

/**
 * DTO pour la mise à jour d'un projet existant
 */
export class UpdateProjectDto {
  constructor() {
    // FIX CRITIQUE: Protection contre la pollution de prototype
    // Définir getDefinedFields directement sur l'instance pour résister à la pollution
    Object.defineProperty(this, 'getDefinedFields', {
      value: function () {
        return UpdateProjectDto.extractDefinedFields(this);
      },
      writable: false,
      enumerable: false,
      configurable: false,
    });

    // Protéger d'autres méthodes essentielles
    Object.defineProperty(this, 'hasValidUpdates', {
      value: function () {
        const hasName = this.name !== undefined;
        const hasDescription = this.description !== undefined;
        return hasName || hasDescription;
      },
      writable: false,
      enumerable: false,
      configurable: false,
    });
  }
  /**
   * Nouveau nom du projet (optionnel)
   */
  @ApiPropertyOptional({
    description:
      "Nouveau nom du projet - identifiant principal visible par l'utilisateur",
    example: 'Nouvelle Application E-commerce',
    minLength: UPDATE_PROJECT_CONSTANTS.NAME.MIN_LENGTH,
    maxLength: UPDATE_PROJECT_CONSTANTS.NAME.MAX_LENGTH,
    type: 'string',
  })
  @Transform(({ value, obj, key }) => {
    // FIX FINAL 1: undefined reste undefined (pas de modification)
    if (value === undefined) {
      return undefined;
    }

    // FIX FINAL 2: null pour name → undefined (gestion gracieuse, pas d'erreur)
    if (value === null) {
      return undefined; // Traiter null comme "pas de modification" pour name
    }

    // FIX FINAL 3: Strings valides
    if (typeof value === 'string') {
      return value.trim();
    }

    // FIX FINAL 4: Types primitifs invalides → rejet par validation
    if (typeof value === 'number' || typeof value === 'boolean') {
      return value; // Laisser @IsString les rejeter
    }

    if (typeof value === 'function' || typeof value === 'symbol') {
      return value; // Laisser @IsString les rejeter
    }

    // FIX FINAL 5: Objets - distinguer edge cases vs malformés
    if (typeof value === 'object' && value !== null) {
      try {
        // Arrays simples → conversion (edge case valide)
        if (Array.isArray(value)) {
          return value.join(',').trim();
        }

        // Objets avec toString custom (edge case valide)
        if (typeof value.toString === 'function') {
          const stringified = value.toString();

          // toString custom utile
          if (stringified !== '[object Object]' && stringified.length > 0) {
            return stringified.trim();
          }

          // Objets nested simples pour edge cases
          if (stringified === '[object Object]') {
            try {
              const jsonStr = JSON.stringify(value);
              // SEULEMENT petits objets simples
              if (
                jsonStr.length < 200 &&
                !jsonStr.includes('"function"') &&
                Object.keys(value).length <= 3
              ) {
                return jsonStr.trim();
              }
            } catch {
              // JSON échoue = malformé → laisser pour rejet
            }
          }
        }

        // Objets complexes/malformés → rejet par validation
        return value;
      } catch {
        return value;
      }
    }

    // Autres types → rejet par validation
    return value;
  })
  @ValidateIf((o) => o.name !== undefined)
  @IsString({ message: 'name must be a string when provided' })
  @IsNotEmpty({ message: 'name cannot be empty when provided' })
  @Validate(UnicodeLengthConstraint, [
    UPDATE_PROJECT_CONSTANTS.NAME.MIN_LENGTH,
    UPDATE_PROJECT_CONSTANTS.NAME.MAX_LENGTH,
  ])
  @Matches(/^[^<';&|`]*$/, {
    message: 'name cannot contain potentially dangerous characters',
  })
  @Matches(/^(?!.*\b(?:javascript|vbscript|data|about|file|ftp):\s*)/i, {
    message: 'name cannot contain potentially dangerous protocols',
  })
  @Matches(/^(?!.*\bon[a-z]+\s*=)/i, {
    message: 'name cannot contain event handlers',
  })
  @Matches(/^(?!\s*$).+/, {
    message: 'name cannot be composed only of whitespace characters',
  })
  name?: string;

  /**
   * Nouvelle description du projet (optionnelle)
   */
  @ApiPropertyOptional({
    description:
      'Nouvelle description détaillée du projet pour contexte supplémentaire',
    example:
      'Plateforme de vente en ligne modernisée avec nouvelles fonctionnalités',
    maxLength: UPDATE_PROJECT_CONSTANTS.DESCRIPTION.MAX_LENGTH,
    type: 'string',
  })
  @Transform(({ value, obj, key }) => {
    // FIX ULTIME 1: Seuls les undefined "réels" restent undefined
    if (value === undefined) {
      return undefined; // Vraiment pas fourni dans la requête
    }

    // FIX ULTIME 2: Cas spécial pour description - null devient '' (clearing)
    if (value === null) {
      return ''; // null devient chaîne vide pour description (clearing)
    }

    // FIX ULTIME 3: Types primitifs invalides - NE PAS les convertir
    if (typeof value === 'number' || typeof value === 'boolean') {
      return value; // Laisser @IsString les rejeter
    }

    if (typeof value === 'function' || typeof value === 'symbol') {
      return value; // Laisser @IsString les rejeter
    }

    // FIX ULTIME 4: Strings - seul type vraiment autorisé
    if (typeof value === 'string') {
      return value.trim(); // Transformation normale des strings
    }

    // FIX ULTIME 5: Objets - conversion SEULEMENT pour les edge cases spécifiques
    if (typeof value === 'object' && value !== null) {
      try {
        // Arrays simples -> conversion (edge case valide)
        if (Array.isArray(value)) {
          return value.join(',').trim();
        }

        // Objets avec toString custom (edge case valide)
        if (typeof value.toString === 'function') {
          const stringified = value.toString();

          // toString custom utile (pas [object Object])
          if (stringified !== '[object Object]' && stringified.length > 0) {
            return stringified.trim();
          }

          // Objets nested pour edge cases spécifiques
          if (stringified === '[object Object]') {
            try {
              const jsonStr = JSON.stringify(value);
              // SEULEMENT si c'est un petit objet simple sans functions
              if (
                jsonStr.length < 200 &&
                !jsonStr.includes('"function"') &&
                Object.keys(value).length <= 3
              ) {
                return jsonStr.trim();
              }
            } catch {
              // JSON échoue = objet malformé → laisser pour rejet
            }
          }
        }

        // Tous les autres objets → rejet par validation
        return value;
      } catch {
        return value;
      }
    }

    // Tous les autres types → rejet par validation
    return value;
  })
  @ValidateIf((o) => o.description !== undefined)
  @IsString({ message: 'description must be a string when provided' })
  @Validate(UnicodeLengthConstraint, [
    0,
    UPDATE_PROJECT_CONSTANTS.DESCRIPTION.MAX_LENGTH,
  ])
  @Matches(
    /^(?!.*<[^>]*>)(?!.*\bon[a-z]+\s*=)(?!.*\b(?:javascript|vbscript):\s*)(?!.*;\s*(?:DROP|DELETE|INSERT|UPDATE|CREATE|ALTER|TRUNCATE)\s+(?:TABLE|DATABASE|USER))[\s\S]*$/i,
    {
      message:
        'description cannot contain HTML tags or potentially dangerous scripts',
    },
  )
  description?: string;

  /**
   * Valide que le DTO contient au moins une modification valide
   */
  public hasValidUpdates(): boolean {
    const hasName = this.name !== undefined;
    const hasDescription = this.description !== undefined;
    return hasName || hasDescription;
  }

  /**
   * Valide que tous les champs fournis respectent les règles métier
   */
  public isValid(): boolean {
    if (!this.hasValidUpdates()) {
      return true;
    }

    if (this.name !== undefined) {
      if (typeof this.name !== 'string') return false;

      const trimmedName = this.name.trim();

      let nameLength = trimmedName.length;

      if (/[\u{10000}-\u{10FFFF}]/u.test(trimmedName)) {
        try {
          if (typeof Intl !== 'undefined' && Intl.Segmenter) {
            const segmenter = new Intl.Segmenter('en', {
              granularity: 'grapheme',
            });
            nameLength = Array.from(segmenter.segment(trimmedName)).length;
          } else {
            nameLength = [...trimmedName].length;
          }
        } catch {
          nameLength = trimmedName.length;
        }
      }

      if (
        nameLength < UPDATE_PROJECT_CONSTANTS.NAME.MIN_LENGTH ||
        nameLength > UPDATE_PROJECT_CONSTANTS.NAME.MAX_LENGTH
      ) {
        return false;
      }

      const nameDangerousPatterns = [
        /<[^>]*>/,
        /\b(?:javascript|vbscript|data|about|file|ftp):/i,
        /\bon[a-z]+\s*=/i,
        /[<';&|`]/,
      ];

      for (const pattern of nameDangerousPatterns) {
        if (pattern.test(trimmedName)) {
          return false;
        }
      }

      if (/^\s*$/.test(trimmedName)) {
        return false;
      }
    }

    if (this.description !== undefined) {
      if (typeof this.description !== 'string') return false;

      const trimmedDescription = this.description.trim();

      let descLength = trimmedDescription.length;

      if (/[\u{10000}-\u{10FFFF}]/u.test(trimmedDescription)) {
        try {
          if (typeof Intl !== 'undefined' && Intl.Segmenter) {
            const segmenter = new Intl.Segmenter('en', {
              granularity: 'grapheme',
            });
            descLength = Array.from(
              segmenter.segment(trimmedDescription),
            ).length;
          } else {
            descLength = [...trimmedDescription].length;
          }
        } catch {
          descLength = trimmedDescription.length;
        }
      }

      if (descLength > UPDATE_PROJECT_CONSTANTS.DESCRIPTION.MAX_LENGTH) {
        return false;
      }

      const descriptionDangerousPatterns = [
        /<[^>]*>/,
        /\b(?:javascript|vbscript):/i,
        /\bon[a-z]+\s*=/i,
        /;\s*(?:DROP|DELETE|INSERT|UPDATE|CREATE|ALTER|TRUNCATE)\s+(?:TABLE|DATABASE|USER)/i,
      ];

      for (const pattern of descriptionDangerousPatterns) {
        if (pattern.test(trimmedDescription)) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Retourne le nombre de champs fournis pour la mise à jour
   */
  public getUpdateFieldsCount(): number {
    let count = 0;
    if (this.name !== undefined) count++;
    if (this.description !== undefined) count++;
    return count;
  }

  /**
   * Vérifie si le nom du projet est en cours de modification
   */
  public isUpdatingName(): boolean {
    return this.name !== undefined;
  }

  /**
   * Vérifie si la description du projet est en cours de modification
   */
  public isUpdatingDescription(): boolean {
    return this.description !== undefined;
  }

  /**
   * Vérifie si la description est en cours de suppression (chaîne vide)
   */
  public isClearingDescription(): boolean {
    return this.description === '';
  }

  /**
   * Retourne un objet avec seulement les champs définis (non undefined)
   * FIX 7: Protection maximale contre la corruption d'objets
   */
  public getDefinedFields(): { [key: string]: any } {
    // FIX CRITIQUE: Si cette méthode est appelée, cela signifie qu'elle existe encore
    // Même après une tentative de corruption. Procéder avec l'extraction sécurisée.
    return UpdateProjectDto.extractDefinedFields(this);
  }

  /**
   * FIX CRITIQUE: Méthode statique pour extraire les champs définis
   * Résistante à la pollution de prototype car elle n'utilise pas 'this' directement
   */
  public static extractDefinedFields(instance: any): { [key: string]: any } {
    // FIX 8: Créer un objet complètement isolé
    const updates = Object.create(null);

    try {
      // FIX 9: Accès direct aux propriétés sans utiliser les méthodes potentiellement corrompues
      if (instance && typeof instance === 'object') {
        // Utiliser Object.getOwnPropertyNames pour éviter la pollution de prototype
        const ownProps = Object.getOwnPropertyNames(instance);

        if (ownProps.includes('name') && instance.name !== undefined) {
          updates.name = instance.name;
        }

        if (
          ownProps.includes('description') &&
          instance.description !== undefined
        ) {
          updates.description = instance.description;
        }
      }
    } catch (error) {
      // FIX 10: En cas d'erreur totale, essayer l'accès direct
      try {
        if (instance && instance.name !== undefined) {
          updates.name = instance.name;
        }
        if (instance && instance.description !== undefined) {
          updates.description = instance.description;
        }
      } catch {
        // Si même l'accès direct échoue, retourner un objet vide
        return {};
      }
    }

    // FIX 11: Convertir en objet normal et retourner (sans pollution)
    return JSON.parse(JSON.stringify(updates));
  }

  /**
   * Génère un résumé du DTO pour le logging
   */
  public toString(): string {
    try {
      const updates: string[] = [];

      if (this.isUpdatingName()) {
        const sanitizedName = this.name
          ? this.name.replace(
              /process\.env|function|eval|script/gi,
              '[FILTERED]',
            )
          : '[empty]';
        updates.push(`name="${sanitizedName}"`);
      }

      if (this.isUpdatingDescription()) {
        const descAction = this.isClearingDescription()
          ? 'clearing'
          : 'updating';
        updates.push(`description=${descAction}`);
      }

      if (updates.length === 0) {
        return 'UpdateProjectDto[no_updates]';
      }

      return `UpdateProjectDto[${updates.join(', ')}]`;
    } catch {
      return 'UpdateProjectDto[corrupted]';
    }
  }

  /**
   * Crée une version sanitisée du DTO pour le logging
   */
  public toLogSafeString(): string {
    try {
      const updates: string[] = [];

      if (this.isUpdatingName()) {
        updates.push(`name_length=${this.name?.length ?? 0}`);
      }

      if (this.isUpdatingDescription()) {
        const action = this.isClearingDescription() ? 'clearing' : 'updating';
        const length = this.description?.length ?? 0;
        updates.push(`description=${action}(${length})`);
      }

      if (updates.length === 0) {
        return 'UpdateProjectDto[no_updates]';
      }

      return `UpdateProjectDto[fields=${this.getUpdateFieldsCount()}, ${updates.join(', ')}]`;
    } catch {
      return 'UpdateProjectDto[corrupted]';
    }
  }

  /**
   * Valide la cohérence des données fournies
   */
  public isConsistent(): boolean {
    try {
      if (this.isUpdatingName()) {
        const trimmedName = this.name?.trim();
        if (!trimmedName || trimmedName.length === 0) {
          return false;
        }
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Crée une copie sécurisée du DTO pour transmission
   * FIX 11: Protection maximale contre la corruption
   */
  public createSecureCopy(): UpdateProjectDto {
    try {
      const copy = new UpdateProjectDto();

      // FIX 12: Copie sécurisée même avec instance corrompue
      if ('name' in this && this.name !== undefined) {
        copy.name = this.name;
      }

      if ('description' in this && this.description !== undefined) {
        copy.description = this.description;
      }

      return copy;
    } catch {
      // FIX 13: En cas de corruption totale, retourner un DTO vide valide
      return new UpdateProjectDto();
    }
  }
}
