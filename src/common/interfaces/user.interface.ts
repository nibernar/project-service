/**
 * Interface utilisateur pour le Service de Gestion des Projets (C04)
 *
 * Définit la structure standardisée des données utilisateur extraites des tokens JWT.
 * Cette interface assure la cohérence des informations utilisateur à travers l'application
 * et facilite l'intégration avec le service d'authentification (C03).
 *
 * @fileoverview Interface principale pour les données utilisateur
 * @version 1.0.0
 * @since 2025-01-28
 */

/**
 * Énumération des rôles utilisateur disponibles dans le système
 *
 * @enum {string}
 */
export enum UserRole {
  /** Utilisateur standard avec accès aux fonctionnalités de base */
  USER = 'user',

  /** Administrateur avec accès aux fonctionnalités d'administration */
  ADMIN = 'admin',

  /** Utilisateur premium avec accès aux fonctionnalités avancées */
  PREMIUM = 'premium',
}

/**
 * Interface principale représentant un utilisateur authentifié
 *
 * Cette interface contient les informations minimales nécessaires
 * pour identifier et autoriser un utilisateur dans le système.
 *
 * @interface User
 */
export interface User {
  /**
   * Identifiant unique de l'utilisateur (UUID)
   *
   * Utilisé comme clé primaire pour l'isolation des données
   * et comme référence dans les entités Project (ownerId).
   *
   * @type {string}
   * @format uuid
   * @example "123e4567-e89b-12d3-a456-426614174000"
   */
  id: string;

  /**
   * Adresse email de l'utilisateur
   *
   * Sert d'identifiant humain pour l'affichage et l'audit.
   * Doit être unique dans le système.
   *
   * @type {string}
   * @format email
   * @example "user@example.com"
   */
  email: string;

  /**
   * Liste des rôles attribués à l'utilisateur
   *
   * Utilisé pour le contrôle d'accès granulaire et la limitation
   * des fonctionnalités selon l'abonnement.
   *
   * @type {string[]}
   * @example ["user"] | ["admin"] | ["user", "premium"]
   */
  roles: string[];
}

/**
 * Type de garde pour un utilisateur avec un rôle spécifique
 *
 * Permet de créer des types plus stricts pour les fonctions
 * nécessitant des rôles particuliers.
 *
 * @template T - Le rôle requis
 */
export type UserWithRole<T extends UserRole> = User & {
  roles: T[];
};

/**
 * Type pour un utilisateur administrateur
 *
 * @typedef {UserWithRole<UserRole.ADMIN>} AdminUser
 */
export type AdminUser = UserWithRole<UserRole.ADMIN>;

/**
 * Type pour un utilisateur premium
 *
 * @typedef {UserWithRole<UserRole.PREMIUM>} PremiumUser
 */
export type PremiumUser = UserWithRole<UserRole.PREMIUM>;

/**
 * Interface des préférences utilisateur
 *
 * Définit les préférences personnalisables par l'utilisateur
 * pour adapter l'expérience de la plateforme.
 *
 * @interface UserPreferences
 */
export interface UserPreferences {
  /**
   * Langue préférée de l'utilisateur (code ISO 639-1)
   * @example "fr" | "en" | "es"
   */
  language?: string;

  /**
   * Fuseau horaire de l'utilisateur (IANA timezone)
   * @example "Europe/Paris" | "America/New_York"
   */
  timezone?: string;

  /**
   * Thème d'interface préféré
   * @example "light" | "dark"
   */
  theme?: 'light' | 'dark';

  /**
   * Préférences de notifications par email
   * @default true
   */
  notifications?: boolean;

  /**
   * Format de date préféré
   * @example "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD"
   */
  dateFormat?: string;

  /**
   * Nombre d'éléments par page dans les listes
   * @default 10
   * @min 5
   * @max 100
   */
  itemsPerPage?: number;
}

/**
 * Interface utilisateur étendue
 *
 * Extension de l'interface User avec des informations additionnelles
 * pour un affichage et une expérience utilisateur enrichis.
 *
 * @interface ExtendedUser
 * @extends User
 */
export interface ExtendedUser extends User {
  /**
   * Nom d'affichage de l'utilisateur
   * @example "John Doe"
   */
  name?: string;

  /**
   * URL de l'avatar utilisateur
   * @example "https://cdn.example.com/avatars/user123.jpg"
   */
  avatar?: string;

  /**
   * Date de création du compte utilisateur
   * @example new Date("2024-01-15T10:30:00Z")
   */
  createdAt?: Date;

  /**
   * Date de dernière connexion
   * @example new Date("2025-01-28T14:25:30Z")
   */
  lastLoginAt?: Date;

  /**
   * Préférences personnalisées de l'utilisateur
   */
  preferences?: UserPreferences;

  /**
   * Statut du compte utilisateur
   * @example "active" | "suspended" | "pending_verification"
   */
  status?: 'active' | 'suspended' | 'pending_verification';

  /**
   * Indicateur de vérification de l'email
   * @default false
   */
  emailVerified?: boolean;
}

/**
 * Fonction utilitaire pour vérifier si un utilisateur possède un rôle spécifique
 *
 * @param user - L'utilisateur à vérifier
 * @param role - Le rôle à rechercher
 * @returns true si l'utilisateur possède le rôle, false sinon
 *
 * @example
 * ```typescript
 * const user: User = { id: '123', email: 'user@example.com', roles: ['user', 'premium'] };
 *
 * if (hasRole(user, UserRole.PREMIUM)) {
 *   // L'utilisateur a accès aux fonctionnalités premium
 * }
 * ```
 */
export function hasRole(user: User, role: UserRole): boolean {
  return user.roles.includes(role);
}

/**
 * Fonction utilitaire pour vérifier si un utilisateur possède l'un des rôles spécifiés
 *
 * @param user - L'utilisateur à vérifier
 * @param roles - Les rôles à rechercher
 * @returns true si l'utilisateur possède au moins un des rôles, false sinon
 *
 * @example
 * ```typescript
 * const user: User = { id: '123', email: 'user@example.com', roles: ['user'] };
 *
 * if (hasAnyRole(user, [UserRole.ADMIN, UserRole.PREMIUM])) {
 *   // L'utilisateur a des privilèges élevés
 * }
 * ```
 */
export function hasAnyRole(user: User, roles: UserRole[]): boolean {
  return roles.some((role) => user.roles.includes(role));
}

/**
 * Fonction utilitaire pour vérifier si un utilisateur possède tous les rôles spécifiés
 *
 * @param user - L'utilisateur à vérifier
 * @param roles - Les rôles requis
 * @returns true si l'utilisateur possède tous les rôles, false sinon
 *
 * @example
 * ```typescript
 * const user: User = { id: '123', email: 'user@example.com', roles: ['user', 'premium'] };
 *
 * if (hasAllRoles(user, [UserRole.USER, UserRole.PREMIUM])) {
 *   // L'utilisateur possède tous les rôles requis
 * }
 * ```
 */
export function hasAllRoles(user: User, roles: UserRole[]): boolean {
  return roles.every((role) => user.roles.includes(role));
}

/**
 * Fonction utilitaire pour vérifier si un utilisateur est administrateur
 *
 * @param user - L'utilisateur à vérifier
 * @returns true si l'utilisateur est administrateur, false sinon
 *
 * @example
 * ```typescript
 * const user: User = { id: '123', email: 'admin@example.com', roles: ['user', 'admin'] };
 *
 * if (isAdmin(user)) {
 *   // L'utilisateur a des privilèges d'administration
 * }
 * ```
 */
export function isAdmin(user: User): user is AdminUser {
  return hasRole(user, UserRole.ADMIN);
}

/**
 * Fonction utilitaire pour vérifier si un utilisateur est premium
 *
 * @param user - L'utilisateur à vérifier
 * @returns true si l'utilisateur est premium, false sinon
 *
 * @example
 * ```typescript
 * const user: User = { id: '123', email: 'premium@example.com', roles: ['user', 'premium'] };
 *
 * if (isPremium(user)) {
 *   // L'utilisateur a accès aux fonctionnalités premium
 * }
 * ```
 */
export function isPremium(user: User): user is PremiumUser {
  return hasRole(user, UserRole.PREMIUM);
}

/**
 * Fonction utilitaire pour créer un utilisateur avec des rôles par défaut
 *
 * Assure qu'un utilisateur a toujours au minimum le rôle 'user'.
 *
 * @param id - L'identifiant de l'utilisateur
 * @param email - L'email de l'utilisateur
 * @param roles - Les rôles additionnels (optionnel)
 * @returns Un utilisateur avec les rôles appropriés
 *
 * @example
 * ```typescript
 * const user = createUser('123', 'user@example.com', [UserRole.PREMIUM]);
 * // Résultat: { id: '123', email: 'user@example.com', roles: ['user', 'premium'] }
 * ```
 */
export function createUser(
  id: string,
  email: string,
  roles: UserRole[] = [],
): User {
  const defaultRoles = [UserRole.USER];
  const allRoles = [...new Set([...defaultRoles, ...roles])]; // Supprime les doublons

  return {
    id,
    email,
    roles: allRoles,
  };
}

/**
 * Fonction utilitaire pour vérifier si un objet est un utilisateur valide
 *
 * @param obj - L'objet à vérifier
 * @returns true si l'objet est un utilisateur valide, false sinon
 *
 * @example
 * ```typescript
 * const data: unknown = { id: '123', email: 'user@example.com', roles: ['user'] };
 *
 * if (isValidUser(data)) {
 *   // TypeScript sait maintenant que data est de type User
 *   console.log(data.email);
 * }
 * ```
 */
export function isValidUser(obj: unknown): obj is User {
  if (!obj || typeof obj !== 'object') {
    return false;
  }

  const user = obj as Record<string, unknown>;

  // Validation d'email améliorée
  const isValidEmail = (email: string): boolean => {
    if (email.length === 0) return false;

    const atIndex = email.indexOf('@');
    if (atIndex <= 0 || atIndex === email.length - 1) return false; // @ doit être au milieu

    const localPart = email.substring(0, atIndex);
    const domainPart = email.substring(atIndex + 1);

    // Vérifications basiques
    if (localPart.length === 0 || domainPart.length === 0) return false;
    if (domainPart.startsWith('.') || domainPart.endsWith('.')) return false;
    if (!domainPart.includes('.')) return false; // Doit avoir au moins un point dans le domaine

    return true;
  };

  return (
    typeof user.id === 'string' &&
    user.id.length > 0 &&
    typeof user.email === 'string' &&
    isValidEmail(user.email) &&
    Array.isArray(user.roles) &&
    user.roles.every((role) => typeof role === 'string')
  );
}

/**
 * Type guard pour vérifier si un utilisateur est un ExtendedUser
 *
 * @param user - L'utilisateur à vérifier
 * @returns true si l'utilisateur est étendu, false sinon
 *
 * @example
 * ```typescript
 * if (isExtendedUser(user)) {
 *   // Accès aux propriétés étendues
 *   console.log(user.name, user.avatar);
 * }
 * ```
 */
export function isExtendedUser(user: User): user is ExtendedUser {
  const extended = user as ExtendedUser;
  return (
    (extended.name !== undefined && extended.name.trim().length > 0) ||
    (extended.avatar !== undefined && extended.avatar.length > 0) ||
    extended.createdAt !== undefined ||
    extended.lastLoginAt !== undefined ||
    extended.preferences !== undefined ||
    extended.status !== undefined ||
    extended.emailVerified !== undefined
  );
}

/**
 * Fonction utilitaire pour créer des préférences utilisateur par défaut
 *
 * @param overrides - Préférences à surcharger
 * @returns Préférences utilisateur avec valeurs par défaut
 *
 * @example
 * ```typescript
 * const prefs = createDefaultPreferences({ theme: 'dark' });
 * // Résultat: { language: 'en', theme: 'dark', notifications: true, ... }
 * ```
 */
export function createDefaultPreferences(
  overrides: Partial<UserPreferences> = {},
): UserPreferences {
  return {
    language: 'en',
    timezone: 'UTC',
    theme: 'light',
    notifications: true,
    dateFormat: 'DD/MM/YYYY',
    itemsPerPage: 10,
    ...overrides,
  };
}

/**
 * Fonction utilitaire pour créer un utilisateur étendu
 *
 * @param baseUser - Utilisateur de base
 * @param extensions - Propriétés étendues à ajouter
 * @returns Utilisateur étendu
 *
 * @example
 * ```typescript
 * const user = createUser('123', 'user@example.com');
 * const extendedUser = createExtendedUser(user, {
 *   name: 'John Doe',
 *   avatar: 'https://example.com/avatar.jpg'
 * });
 * ```
 */
export function createExtendedUser(
  baseUser: User,
  extensions: Partial<Omit<ExtendedUser, keyof User>> = {},
): ExtendedUser {
  return {
    ...baseUser,
    ...extensions,
  };
}

/**
 * Fonction utilitaire pour vérifier si un utilisateur a un email vérifié
 *
 * @param user - L'utilisateur à vérifier
 * @returns true si l'email est vérifié, false sinon ou si l'info n'est pas disponible
 *
 * @example
 * ```typescript
 * if (hasVerifiedEmail(user)) {
 *   // L'utilisateur peut accéder aux fonctionnalités nécessitant un email vérifié
 * }
 * ```
 */
export function hasVerifiedEmail(user: User | ExtendedUser): boolean {
  if (isExtendedUser(user)) {
    // Conversion truthy/falsy en boolean strict
    return Boolean(user.emailVerified);
  }
  return false; // Considéré comme non vérifié si l'info n'est pas disponible
}

/**
 * Fonction utilitaire pour vérifier si un compte utilisateur est actif
 *
 * @param user - L'utilisateur à vérifier
 * @returns true si le compte est actif, false sinon
 *
 * @example
 * ```typescript
 * if (isActiveUser(user)) {
 *   // L'utilisateur peut utiliser la plateforme normalement
 * } else {
 *   // Rediriger vers la page de suspension/vérification
 * }
 * ```
 */
export function isActiveUser(user: User | ExtendedUser): boolean {
  if (isExtendedUser(user)) {
    return user.status === 'active' || user.status === undefined; // undefined = actif par défaut
  }
  return true; // User de base considéré comme actif
}

/**
 * Fonction utilitaire pour obtenir le nom d'affichage d'un utilisateur
 *
 * @param user - L'utilisateur
 * @returns Le nom d'affichage (name si disponible, sinon email)
 *
 * @example
 * ```typescript
 * const displayName = getDisplayName(user);
 * // "John Doe" ou "user@example.com" si pas de nom
 * ```
 */
export function getDisplayName(user: User | ExtendedUser): string {
  if (isExtendedUser(user) && user.name) {
    // Vérifier que le nom contient des caractères visibles
    const trimmedName = user.name.trim();
    // Supprimer les caractères de contrôle et invisibles
    const visibleName = trimmedName.replace(
      /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202f\u205f-\u206f]/g,
      '',
    );

    if (visibleName.length > 0) {
      return user.name;
    }
  }
  return user.email;
}

/**
 * Fonction utilitaire pour obtenir les préférences avec fallback
 *
 * @param user - L'utilisateur
 * @returns Les préférences utilisateur ou les préférences par défaut
 *
 * @example
 * ```typescript
 * const prefs = getUserPreferences(user);
 * console.log(prefs.theme); // Toujours défini, avec fallback sur 'light'
 * ```
 */
export function getUserPreferences(user: User | ExtendedUser): UserPreferences {
  const defaultPrefs = createDefaultPreferences();

  if (isExtendedUser(user) && user.preferences) {
    // Merge en préservant les propriétés supplémentaires mais validant les types de base
    const result = { ...defaultPrefs, ...user.preferences };

    // Correction des types incorrects pour les propriétés essentielles
    if (
      typeof result.theme !== 'string' ||
      !['light', 'dark'].includes(result.theme)
    ) {
      result.theme = defaultPrefs.theme;
    }
    if (typeof result.language !== 'string') {
      result.language = defaultPrefs.language;
    }
    if (typeof result.notifications !== 'boolean') {
      result.notifications = defaultPrefs.notifications;
    }
    if (typeof result.itemsPerPage !== 'number' || result.itemsPerPage < 1) {
      result.itemsPerPage = defaultPrefs.itemsPerPage;
    }
    if (typeof result.timezone !== 'string') {
      result.timezone = defaultPrefs.timezone;
    }
    if (typeof result.dateFormat !== 'string') {
      result.dateFormat = defaultPrefs.dateFormat;
    }

    return result;
  }

  return defaultPrefs;
}
