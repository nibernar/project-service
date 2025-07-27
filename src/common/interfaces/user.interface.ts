// src/common/interfaces/user.interface.ts

/**
 * Interface pour les données utilisateur extraites du JWT
 */
export interface User {
  id: string;
  email: string;
  roles: string[];
}