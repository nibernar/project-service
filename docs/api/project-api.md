# Documentation API - Service de Gestion des Projets (C04) - Version Complète

## Vue d'ensemble

Le Service de Gestion des Projets est responsable de la gestion complète du cycle de vie des projets utilisateurs dans la plateforme Coders. Il orchestre la création, modification, archivage et export des projets tout en maintenant leurs statistiques de performance et coûts avec des mécanismes avancés de validation, sécurité et qualité des données.

### Responsabilités principales
- Gestion CRUD des projets utilisateurs avec validation métier complète
- Orchestration avec les services IA pour la génération documentaire
- Collecte, validation et exposition des statistiques enrichies avec scoring qualité
- Export multi-format des documents générés avec conversion PDF
- Isolation sécurisée des données par utilisateur avec audit trail
- Gestion fine des rôles et permissions utilisateur

### Limitations et périmètre
- **Service de donnée uniquement** : Ne génère pas de contenu IA directement
- **Mono-tenant** : Un projet = un propriétaire unique
- **Pas de collaboration** : Pas de partage entre utilisateurs (limitation actuelle)
- **Export temporaire** : Fichiers avec expiration automatique
- **Validation stricte** : Sanitisation automatique des entrées utilisateur

---

## Configuration de base

### URL de base
```
https://api.coders.com/api/v1
```

### Versioning
- **Version actuelle** : v1
- **Politique** : Compatibilité rétrograde maintenue dans la version majeure
- **Evolution** : Nouveaux endpoints ajoutés sans breaking changes
- **Support multi-version** : v1 et v2 supportées simultanément

### Environnements disponibles
- **Production** : `https://api.coders.com/api/v1`
- **Staging** : `https://staging-api.coders.com/api/v1`
- **Développement** : `https://dev-api.coders.com/api/v1`

---

## Authentification et autorisation

### Méthode d'authentification
Tous les endpoints nécessitent une authentification via **JWT Bearer Token**.

```http
Authorization: Bearer <your-jwt-token>
```

### Obtention du token
Le token JWT est obtenu via le Service d'Authentification (C03) :

```bash
# Exemple d'obtention de token
curl -X POST "https://api.coders.com/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "your-password"
  }'
```

### Durée de validité
- **Token principal** : 24 heures
- **Refresh token** : 30 jours
- **Renouvellement automatique** : Via refresh token avant expiration

### Gestion des rôles utilisateur

**Rôles disponibles :**
- `user` : Utilisateur standard (rôle par défaut)
- `premium` : Utilisateur premium avec fonctionnalités avancées
- `admin` : Administrateur avec accès complet

**Vérification des rôles :**
```typescript
// L'API valide automatiquement les rôles selon les endpoints
// Exemple : certaines statistiques nécessitent le rôle premium
```

### Gestion des erreurs d'authentification

**401 Unauthorized - Token manquant ou invalide**
```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "error": "JWT token is required",
  "timestamp": "2024-08-18T10:30:00.000Z",
  "path": "/api/v1/projects"
}
```

**403 Forbidden - Token valide mais permissions insuffisantes**
```json
{
  "statusCode": 403,
  "message": "Forbidden",
  "error": "You do not have permission to access this project",
  "timestamp": "2024-08-18T10:30:00.000Z",
  "path": "/api/v1/projects/550e8400-e29b-41d4-a716-446655440001"
}
```

---

## Modèles de données enrichis

### Interface Project complète
```typescript
interface Project {
  id: string;                    // UUID unique (immutable)
  name: string;                  // Nom du projet (1-100 caractères, sanitisé)
  description?: string;          // Description optionnelle (max 1000, support Markdown)
  initialPrompt: string;         // Prompt initial (10-5000 caractères, immutable)
  status: ProjectStatus;         // Statut du projet avec métadonnées
  uploadedFileIds: string[];     // IDs des fichiers uploadés (UUID validés)
  generatedFileIds: string[];    // IDs des fichiers générés (UUID validés)
  createdAt: Date;              // Date de création (ISO 8601, immutable)
  updatedAt: Date;              // Date de modification (ISO 8601, auto-updaté)
  
  // Propriétés calculées exposées
  ageInDays: number;            // Âge du projet en jours
  hasBeenModified: boolean;     // Projet modifié depuis création
  complexityEstimate: 'low' | 'medium' | 'high'; // Complexité estimée
  activityLevel: 'new' | 'active' | 'mature' | 'inactive'; // Niveau d'activité
  fileCount: {                  // Comptage des fichiers
    uploaded: number;
    generated: number;
    total: number;
  };
  
  // Relations optionnelles
  statistics?: ProjectStatistics; // Statistiques enrichies
}
```

### Interface ProjectStatistics enrichie
```typescript
interface ProjectStatistics {
  id: string;
  projectId: string;
  
  // Coûts détaillés avec breakdown automatique
  costs: {
    claudeApi: number;        // Coûts API Claude en USD
    storage: number;          // Coûts de stockage en USD
    compute: number;          // Coûts de calcul en USD
    bandwidth: number;        // Coûts de bande passante en USD
    total: number;            // Total calculé automatiquement
    currency: string;         // Devise (ISO 4217)
    costPerDocument: number;  // Coût par document généré
    breakdown: {              // Répartition en pourcentages (auto-calculée)
      claudeApiPercentage: number;
      storagePercentage: number;
      computePercentage: number;
      bandwidthPercentage: number;
    };
    trend: 'increasing' | 'decreasing' | 'stable'; // Tendance des coûts
  };
  
  // Performance détaillée avec détection de goulots
  performance: {
    generationTime: number;   // Temps de génération en secondes
    processingTime: number;   // Temps de traitement en secondes
    interviewTime: number;    // Durée de l'interview en secondes
    exportTime: number;       // Temps d'export en secondes
    totalTime: number;        // Temps total (calculé automatiquement)
    queueWaitTime: number;    // Temps d'attente en queue
    efficiency: {
      documentsPerHour: number;     // Productivité
      tokensPerSecond: number;      // Débit de tokens
      processingEfficiency: number; // Efficacité traitement (0-1)
      resourceUtilization: number;  // Utilisation ressources (0-1)
    };
    bottlenecks: string[];    // Goulots détectés automatiquement
    benchmark: 'faster' | 'average' | 'slower'; // Comparaison avec benchmarks
  };
  
  // Usage enrichi avec patterns d'activité
  usage: {
    documentsGenerated: number; // Nombre de documents générés
    filesProcessed: number;     // Nombre de fichiers traités
    tokensUsed: number;         // Nombre de tokens utilisés
    apiCallsCount: number;      // Nombre d'appels API
    storageSize: number;        // Taille de stockage en bytes
    exportCount: number;        // Nombre d'exports réalisés
    tokensPerDocument: number;  // Tokens par document (calculé)
    storageEfficiency: number;  // Efficacité stockage (bytes/doc)
    activityPattern: {
      peakUsageHour: number;           // Heure de pic d'usage (0-23)
      usageFrequency: 'daily' | 'weekly' | 'occasional'; // Fréquence
      preferredFormats: string[];      // Formats d'export préférés
      averageSessionDuration: number;  // Durée moyenne des sessions
    };
    resourceIntensity: 'light' | 'moderate' | 'intensive'; // Intensité calculée
  };
  
  // Métadonnées de qualité et traçabilité
  metadata: {
    sources: string[];        // Services sources des données
    version: string;          // Version des données
    batchId: string;          // ID du batch de traitement
    confidence: number;       // Niveau de confiance (0-1)
    dataFreshness: number;    // Fraîcheur en minutes
    completeness: number;     // Complétude en pourcentage
    qualityScore: number;     // Score de qualité (0-100, calculé auto)
    missingFields: string[];  // Champs manquants identifiés
    estimatedFields: string[]; // Champs avec valeurs estimées
    lastUpdated: Date;        // Dernière mise à jour
  };
}
```

### Énumération ProjectStatus avec métadonnées
```typescript
enum ProjectStatus {
  ACTIVE = "ACTIVE",       // Projet actif et accessible
  ARCHIVED = "ARCHIVED",   // Projet archivé mais récupérable
  DELETED = "DELETED"      // Projet supprimé (soft delete)
}

// Métadonnées complètes pour chaque statut
interface ProjectStatusMetadata {
  status: ProjectStatus;
  label: string;           // Label français pour l'UI
  description: string;     // Description détaillée
  color: string;           // Code couleur hexadécimal
  allowedTransitions: ProjectStatus[]; // Transitions autorisées
}

// Exemple de métadonnées
const STATUS_METADATA = {
  ACTIVE: {
    label: "Actif",
    description: "Projet en cours d'utilisation, accessible pour consultation et modification",
    color: "#10B981",      // Green-500
    allowedTransitions: ["ARCHIVED", "DELETED"]
  },
  ARCHIVED: {
    label: "Archivé", 
    description: "Projet archivé, consultation possible mais masqué par défaut",
    color: "#F59E0B",      // Amber-500
    allowedTransitions: ["ACTIVE", "DELETED"]
  },
  DELETED: {
    label: "Supprimé",
    description: "Projet supprimé (soft delete), inaccessible aux utilisateurs", 
    color: "#EF4444",      // Red-500
    allowedTransitions: [] // État final
  }
};
```

### Interface utilisateur étendue
```typescript
interface User {
  id: string;              // UUID unique
  email: string;           // Email validé
  roles: string[];         // Rôles avec permissions
}

interface ExtendedUser extends User {
  name?: string;           // Nom d'affichage
  avatar?: string;         // URL avatar
  createdAt?: Date;        // Date création compte
  lastLoginAt?: Date;      // Dernière connexion
  preferences?: {
    language?: string;     // Langue (ISO 639-1)
    timezone?: string;     // Fuseau (IANA timezone)
    theme?: 'light' | 'dark'; // Thème interface
    notifications?: boolean;   // Notifications email
    dateFormat?: string;   // Format de date préféré
    itemsPerPage?: number; // Pagination préférée (5-100)
  };
  status?: 'active' | 'suspended' | 'pending_verification';
  emailVerified?: boolean; // Statut vérification email
}
```

### Interface de pagination avancée
```typescript
// Pagination offset traditionnelle
interface PaginatedResult<T> {
  data: T[];                // Éléments de la page courante
  pagination: {
    page: number;           // Page courante (1-based)
    limit: number;          // Éléments par page
    totalPages: number;     // Nombre total de pages
    hasNext: boolean;       // Page suivante disponible
    hasPrevious: boolean;   // Page précédente disponible
    offset: number;         // Offset calculé pour les requêtes
  };
  total: number;            // Nombre total d'éléments
}

// Pagination cursor haute performance (pour gros volumes)
interface CursorPaginatedResult<T> {
  data: T[];
  pagination: {
    cursor: string | null;       // Curseur courant
    nextCursor: string | null;   // Curseur page suivante
    previousCursor: string | null; // Curseur page précédente
    hasNext: boolean;
    hasPrevious: boolean;
  };
}
```

---

## Endpoints Projects

### POST /projects - Création d'un projet

Crée un nouveau projet avec validation métier complète et déclenche automatiquement le processus de génération documentaire.

**URL** : `POST /api/v1/projects`

**Headers requis** :
```http
Authorization: Bearer <token>
Content-Type: application/json
```

**Corps de requête avec validation** :
```typescript
{
  name: string;                    // Requis, 1-100 caractères, sanitisé automatiquement
  description?: string;            // Optionnel, max 1000 caractères, support Markdown
  initialPrompt: string;           // Requis, 10-5000 caractères, sanitisé
  uploadedFileIds?: string[];      // Optionnel, max 10 UUIDs validés
}
```

**Validation automatique** :
- **name** : Suppression caractères de contrôle, anti-XSS, espaces multiples normalisés
- **description** : Préservation Markdown simple, sanitisation HTML
- **initialPrompt** : Préservation structure, suppression caractères dangereux
- **uploadedFileIds** : Validation UUID v4, vérification existence via service stockage

**Exemple de requête** :
```json
{
  "name": "Application E-commerce",
  "description": "Plateforme de vente en ligne avec gestion des stocks et paiements\n\n**Fonctionnalités principales :**\n- Catalogue produits\n- Panier d'achat\n- Paiements Stripe",
  "initialPrompt": "Je souhaite créer une application e-commerce moderne avec React et Node.js, incluant la gestion des produits, panier, paiements Stripe et espace admin. L'application doit être responsive et suivre les meilleures pratiques de sécurité.",
  "uploadedFileIds": [
    "550e8400-e29b-41d4-a716-446655440000",
    "6ba7b810-9dad-11d1-80b4-00c04fd430c8"
  ]
}
```

**Réponses** :

**201 Created - Projet créé avec succès**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "name": "Application E-commerce", 
  "description": "Plateforme de vente en ligne avec gestion des stocks et paiements\n\n**Fonctionnalités principales :**\n- Catalogue produits\n- Panier d'achat\n- Paiements Stripe",
  "initialPrompt": "Je souhaite créer une application e-commerce moderne...",
  "status": "ACTIVE",
  "uploadedFileIds": [
    "550e8400-e29b-41d4-a716-446655440000",
    "6ba7b810-9dad-11d1-80b4-00c04fd430c8"
  ],
  "generatedFileIds": [],
  "createdAt": "2024-08-18T10:30:00.000Z",
  "updatedAt": "2024-08-18T10:30:00.000Z",
  "ageInDays": 0,
  "hasBeenModified": false,
  "complexityEstimate": "high",
  "activityLevel": "new",
  "fileCount": {
    "uploaded": 2,
    "generated": 0,
    "total": 2
  }
}
```

**400 Bad Request - Validation échouée**
```json
{
  "statusCode": 400,
  "message": [
    {
      "field": "name",
      "value": "",
      "constraints": {
        "isNotEmpty": "Le nom du projet est obligatoire",
        "length": "Le nom du projet doit contenir entre 1 et 100 caractères"
      }
    },
    {
      "field": "initialPrompt",
      "value": "trop court",
      "constraints": {
        "length": "Le prompt initial doit contenir entre 10 et 5000 caractères"
      }
    }
  ],
  "error": "Bad Request",
  "timestamp": "2024-08-18T10:30:00.000Z",
  "path": "/api/v1/projects"
}
```

**422 Unprocessable Entity - Fichiers invalides**
```json
{
  "statusCode": 422,
  "message": "One or more uploaded file IDs are invalid or inaccessible",
  "error": "Unprocessable Entity",
  "details": {
    "invalidFileIds": ["invalid-uuid-123"],
    "inaccessibleFileIds": ["550e8400-e29b-41d4-a716-446655440000"]
  }
}
```

---

### GET /projects - Liste des projets

Récupère la liste paginée des projets de l'utilisateur avec filtres avancés et métadonnées enrichies.

**URL** : `GET /api/v1/projects`

**Paramètres de requête étendus** :
```typescript
{
  // Pagination
  page?: number;              // Numéro de page (défaut: 1, min: 1)
  limit?: number;             // Éléments par page (défaut: 10, max: 100)
  
  // Filtres
  status?: ProjectStatus;     // Filtrage par statut
  search?: string;            // Recherche textuelle dans nom/description
  hasGeneratedFiles?: boolean; // Projets avec fichiers générés
  hasStatistics?: boolean;    // Projets avec statistiques
  complexityEstimate?: 'low' | 'medium' | 'high'; // Filtrage par complexité
  activityLevel?: 'new' | 'active' | 'mature' | 'inactive'; // Filtrage par activité
  
  // Filtres temporels
  createdAfter?: string;      // Date ISO 8601
  createdBefore?: string;     // Date ISO 8601
  updatedAfter?: string;      // Date ISO 8601
  updatedBefore?: string;     // Date ISO 8601
  
  // Tri
  orderBy?: 'createdAt' | 'updatedAt' | 'name' | 'status'; // Champ de tri
  order?: 'asc' | 'desc';     // Direction (défaut: desc)
  
  // Options avancées
  includeStatistics?: boolean; // Inclure les statistiques dans la réponse
  paginationType?: 'offset' | 'cursor'; // Type de pagination (défaut: offset)
  cursor?: string;            // Curseur pour pagination cursor-based
}
```

**Exemple de requête avec filtres** :
```bash
curl -X GET "https://api.coders.com/api/v1/projects?page=1&limit=20&status=ACTIVE&search=e-commerce&complexityEstimate=high&orderBy=updatedAt&order=desc&includeStatistics=true" \
  -H "Authorization: Bearer <token>"
```

**Réponse 200 OK avec métadonnées enrichies** :
```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "name": "Application E-commerce",
      "description": "Plateforme de vente en ligne...",
      "status": "ACTIVE",
      "statusMetadata": {
        "label": "Actif",
        "color": "#10B981",
        "allowedTransitions": ["ARCHIVED", "DELETED"]
      },
      "createdAt": "2024-08-18T10:30:00.000Z",
      "updatedAt": "2024-08-18T14:30:00.000Z",
      "ageInDays": 0,
      "hasBeenModified": true,
      "complexityEstimate": "high",
      "activityLevel": "active",
      "fileCount": {
        "uploaded": 2,
        "generated": 5,
        "total": 7
      },
      "statistics": {
        "costs": {
          "total": 12.45,
          "currency": "USD"
        },
        "metadata": {
          "qualityScore": 95.5,
          "completeness": 98.2
        }
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "totalPages": 1,
    "hasNext": false,
    "hasPrevious": false,
    "offset": 0
  },
  "total": 1,
  "filters": {
    "applied": {
      "status": "ACTIVE",
      "search": "e-commerce",
      "complexityEstimate": "high"
    },
    "available": {
      "statuses": ["ACTIVE", "ARCHIVED"],
      "complexityLevels": ["low", "medium", "high"],
      "activityLevels": ["new", "active", "mature", "inactive"]
    }
  }
}
```

---

### GET /projects/:id - Détail d'un projet

Récupère les informations complètes d'un projet spécifique avec toutes les métadonnées calculées.

**URL** : `GET /api/v1/projects/{id}`

**Paramètres** :
- `id` : UUID du projet

**Paramètres de requête optionnels** :
```typescript
{
  includeStatistics?: boolean;    // Inclure les statistiques (défaut: true)
  includeMetadata?: boolean;      // Inclure les métadonnées étendues (défaut: true)
  statisticsDepth?: 'basic' | 'full'; // Niveau de détail des statistiques
}
```

**Exemple de requête** :
```bash
curl -X GET "https://api.coders.com/api/v1/projects/550e8400-e29b-41d4-a716-446655440001?includeStatistics=true&statisticsDepth=full" \
  -H "Authorization: Bearer <token>"
```

**Réponse 200 OK complète** :
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "name": "Application E-commerce",
  "description": "Plateforme de vente en ligne avec gestion des stocks et paiements",
  "initialPrompt": "Je souhaite créer une application e-commerce moderne...",
  "status": "ACTIVE",
  "statusMetadata": {
    "label": "Actif",
    "description": "Projet en cours d'utilisation, accessible pour consultation et modification",
    "color": "#10B981",
    "allowedTransitions": ["ARCHIVED", "DELETED"]
  },
  "uploadedFileIds": [
    "550e8400-e29b-41d4-a716-446655440000"
  ],
  "generatedFileIds": [
    "650f8400-e29b-41d4-a716-446655440000",
    "750f8400-e29b-41d4-a716-446655440000"
  ],
  "createdAt": "2024-08-18T10:30:00.000Z",
  "updatedAt": "2024-08-18T14:30:00.000Z",
  
  // Métadonnées calculées
  "ageInDays": 0,
  "hasBeenModified": true,
  "complexityEstimate": "high",
  "activityLevel": "active",
  "fileCount": {
    "uploaded": 1,
    "generated": 2,
    "total": 3
  },
  
  // Statistiques enrichies complètes
  "statistics": {
    "costs": {
      "claudeApi": 10.25,
      "storage": 1.50,
      "compute": 0.70,
      "bandwidth": 0.00,
      "total": 12.45,
      "currency": "USD",
      "costPerDocument": 6.23,
      "breakdown": {
        "claudeApiPercentage": 82.3,
        "storagePercentage": 12.0,
        "computePercentage": 5.6,
        "bandwidthPercentage": 0.1
      },
      "trend": "stable"
    },
    "performance": {
      "generationTime": 45.2,
      "processingTime": 12.8,
      "interviewTime": 180.5,
      "exportTime": 0.0,
      "totalTime": 238.5,
      "queueWaitTime": 5.2,
      "efficiency": {
        "documentsPerHour": 7.5,
        "tokensPerSecond": 65.2,
        "processingEfficiency": 0.85,
        "resourceUtilization": 0.78
      },
      "bottlenecks": ["interview"],
      "benchmark": "average"
    },
    "usage": {
      "documentsGenerated": 2,
      "filesProcessed": 1,
      "tokensUsed": 15750,
      "apiCallsCount": 12,
      "storageSize": 2048576,
      "exportCount": 0,
      "tokensPerDocument": 7875,
      "storageEfficiency": 1024288,
      "activityPattern": {
        "peakUsageHour": 14,
        "usageFrequency": "daily",
        "preferredFormats": ["markdown"],
        "averageSessionDuration": 240.5
      },
      "resourceIntensity": "moderate"
    },
    "metadata": {
      "sources": ["cost-tracking-service", "orchestration-service"],
      "version": "1.2.0",
      "batchId": "batch-2024081814-abc123",
      "confidence": 0.95,
      "dataFreshness": 15,
      "completeness": 95.5,
      "qualityScore": 92.3,
      "missingFields": [],
      "estimatedFields": ["efficiency.resourceUtilization"],
      "lastUpdated": "2024-08-18T14:30:00.000Z"
    }
  }
}
```

**404 Not Found - Projet non trouvé**
```json
{
  "statusCode": 404,
  "message": "Project with ID \"550e8400-e29b-41d4-a716-446655440001\" not found",
  "error": "Not Found",
  "timestamp": "2024-08-18T10:30:00.000Z",
  "path": "/api/v1/projects/550e8400-e29b-41d4-a716-446655440001"
}
```

---

### PATCH /projects/:id - Modification d'un projet

Met à jour les métadonnées d'un projet avec validation métier et préservation de l'historique.

**URL** : `PATCH /api/v1/projects/{id}`

**Corps de requête avec validation** :
```typescript
{
  name?: string;           // Optionnel, 1-100 caractères, sanitisé
  description?: string;    // Optionnel, max 1000 caractères, support Markdown
}
```

**Validation automatique** :
- Même validation que pour la création
- Préservation des champs immutables (id, initialPrompt, createdAt, ownerId)
- Mise à jour automatique de updatedAt
- Invalidation du cache associé

**Exemple de requête** :
```json
{
  "name": "Application E-commerce Modernisée",
  "description": "Plateforme de vente en ligne avec nouvelles fonctionnalités IA\n\n**Nouvelles fonctionnalités :**\n- Recommandations IA\n- Chatbot support\n- Analyse prédictive"
}
```

**Réponse 200 OK** : Même structure que GET /projects/:id avec les modifications appliquées

**400 Bad Request - Validation échouée** :
```json
{
  "statusCode": 400,
  "message": [
    {
      "field": "name",
      "value": "Nom avec caractères <script>alert('xss')</script> dangereux",
      "constraints": {
        "matches": "Le nom contient des caractères non autorisés"
      }
    }
  ],
  "error": "Bad Request"
}
```

---

### PUT /projects/:id/archive - Archivage d'un projet

Change le statut du projet vers `ARCHIVED` avec validation de transition.

**URL** : `PUT /api/v1/projects/{id}/archive`

**Validation de transition** :
- Vérifie que le statut actuel permet la transition vers ARCHIVED
- Seuls les projets ACTIVE peuvent être archivés
- Met à jour automatiquement updatedAt
- Déclenche un événement d'audit

**Réponse 204 No Content** : Aucun contenu retourné

**409 Conflict - Transition invalide** :
```json
{
  "statusCode": 409,
  "message": "Cannot archive project in status: DELETED",
  "error": "Conflict",
  "availableTransitions": []
}
```

---

### PUT /projects/:id/restore - Restauration d'un projet archivé

Restaure un projet archivé vers le statut `ACTIVE`.

**URL** : `PUT /api/v1/projects/{id}/restore`

**Validation de transition** :
- Seuls les projets ARCHIVED peuvent être restaurés
- Vérification des quotas utilisateur
- Validation de l'intégrité des données

**Réponse 204 No Content** : Aucun contenu retourné

---

### DELETE /projects/:id - Suppression d'un projet  

Suppression logique (soft delete) - statut `DELETED` avec audit trail.

**URL** : `DELETE /api/v1/projects/{id}`

**Processus de suppression** :
- Transition vers statut DELETED (irréversible)
- Préservation des données pour audit
- Masquage dans toutes les listes utilisateur
- Conservation des statistiques pour reporting

**Réponse 204 No Content** : Aucun contenu retourné

---

### PUT /projects/:id/files - Mise à jour fichiers générés (API interne)

Endpoint utilisé par l'orchestrateur pour signaler la génération de nouveaux documents.

**URL** : `PUT /api/v1/projects/{id}/files`

**Headers requis** :
```http
X-Service-Token: <service-token>
Content-Type: application/json
```

**Configuration du token de service** :
```bash
# Variable d'environnement
INTERNAL_SERVICE_TOKEN=service-secret-token-production-change-required

# Validation du token
# Le service valide le header X-Service-Token contre la variable d'environnement
# Rotation recommandée tous les 30 jours
```

**Corps de requête** :
```json
{
  "fileIds": ["file1-uuid", "file2-uuid"], // UUIDs validés
  "mode": "append"  // "append" | "replace"
}
```

**Modes de mise à jour** :
- `append` : Ajoute les nouveaux fichiers à la liste existante
- `replace` : Remplace complètement la liste des fichiers générés

**Réponse 204 No Content** : Aucun contenu retourné

**401 Unauthorized - Token de service invalide** :
```json
{
  "statusCode": 401,
  "message": "Invalid or missing service token",
  "error": "Unauthorized"
}
```

---

## Endpoints Statistics

### PUT /statistics/projects/:projectId - Mise à jour statistiques (API interne)

Permet aux services externes de mettre à jour les statistiques d'un projet avec validation de qualité.

**URL** : `PUT /api/v1/statistics/projects/{projectId}`

**Headers requis** :
```http
X-Service-Token: <service-token>
Content-Type: application/json
```

**Corps de requête enrichi** :
```json
{
  "costs": {
    "claudeApi": 12.45,
    "storage": 2.30,
    "compute": 5.67,
    "bandwidth": 1.23,
    "total": 21.65,      // Calculé automatiquement si omis
    "currency": "USD",
    "trend": "increasing"
  },
  "performance": {
    "generationTime": 45.23,
    "processingTime": 12.45,
    "interviewTime": 180.75,
    "exportTime": 8.90,
    "totalTime": 247.33, // Calculé automatiquement si omis
    "queueWaitTime": 5.12,
    "efficiency": {
      "documentsPerHour": 7.2,
      "tokensPerSecond": 58.3,
      "processingEfficiency": 0.87,
      "resourceUtilization": 0.74
    }
  },
  "usage": {
    "documentsGenerated": 5,
    "filesProcessed": 3,
    "tokensUsed": 15750,
    "apiCallsCount": 12,
    "storageSize": 2048576,
    "exportCount": 2,
    "activityPattern": {
      "peakUsageHour": 14,
      "usageFrequency": "daily",
      "preferredFormats": ["markdown", "pdf"],
      "averageSessionDuration": 245.8
    }
  },
  "metadata": {
    "source": "cost-tracking-service",
    "timestamp": "2024-08-18T10:30:00.000Z",
    "version": "1.0.0",
    "batchId": "batch-2024081810-abc123",
    "confidence": 0.95
  }
}
```

**Processus de mise à jour** :
1. Validation du token de service
2. Validation de la structure des données
3. Fusion intelligente avec les données existantes
4. Calcul automatique des métriques dérivées
5. Validation de cohérence des données
6. Calcul du score de qualité
7. Identification automatique des goulots de performance
8. Mise à jour des métadonnées de fraîcheur

**Réponse 200 OK avec score de qualité** :
```json
{
  "id": "stat-550e8400-e29b-41d4-a716-446655440001",
  "projectId": "550e8400-e29b-41d4-a716-446655440001",
  "costs": {
    // Données mises à jour avec breakdown calculé
    "total": 21.65,
    "breakdown": {
      "claudeApiPercentage": 57.5,
      "storagePercentage": 10.6,
      "computePercentage": 26.2,
      "bandwidthPercentage": 5.7
    }
  },
  "performance": {
    // Données avec détection automatique de goulots
    "bottlenecks": ["processing", "queue_wait"],
    "benchmark": "slower"
  },
  "usage": {
    // Données avec calculs automatiques
    "tokensPerDocument": 3150,
    "storageEfficiency": 409715,
    "resourceIntensity": "moderate"
  },
  "metadata": {
    "qualityScore": 88.7,
    "completeness": 92.3,
    "dataFreshness": 0,
    "consistencyIssues": [],
    "lastUpdated": "2024-08-18T10:30:00.000Z"
  }
}
```

---

### GET /statistics/projects/:projectId - Consultation des statistiques

Récupère les statistiques détaillées d'un projet pour son propriétaire.

**URL** : `GET /api/v1/statistics/projects/{projectId}`

**Paramètres de requête** :
```typescript
{
  depth?: 'basic' | 'full';     // Niveau de détail (défaut: basic)
  includeMetadata?: boolean;    // Inclure métadonnées qualité (défaut: true)
  includeHistory?: boolean;     // Inclure historique des modifications
  format?: 'json' | 'summary'; // Format de réponse
}
```

**Réponse 200 OK** : Structure `ProjectStatistics` complète avec enrichissements

---

### GET /statistics/global - Statistiques globales

Récupère les statistiques agrégées de la plateforme (admin uniquement).

**URL** : `GET /api/v1/statistics/global`

**Autorisation** : Rôle `admin` requis

**Réponse 200 OK** :
```json
{
  "totalProjects": 1250,
  "totalCosts": 45789.32,
  "totalDocuments": 8945,
  "averageQualityScore": 87.5,
  "platformMetrics": {
    "averageGenerationTime": 52.3,
    "averageTokensPerProject": 12750,
    "popularComplexityLevels": {
      "low": 35.2,
      "medium": 45.8,
      "high": 19.0
    }
  },
  "sourceDistribution": {
    "cost-tracking-service": 1200,
    "monitoring-service": 1100,
    "orchestration-service": 1250
  },
  "qualityMetrics": {
    "averageCompletenessScore": 91.2,
    "averageConfidenceLevel": 0.89,
    "dataFreshnessDistribution": {
      "fresh": 78.5,      // < 10 minutes
      "recent": 18.2,     // 10-60 minutes  
      "stale": 3.3        // > 60 minutes
    }
  }
}
```

---

## Endpoints Export

### POST /export/projects/:projectId - Démarrage d'un export

Lance l'export des documents d'un projet selon les options spécifiées avec validation avancée.

**URL** : `POST /api/v1/export/projects/{projectId}`

**Corps de requête enrichi** :
```json
{
  "format": "pdf",  // "markdown" | "pdf"
  "fileIds": [      // Optionnel, tous si omis
    "550e8400-e29b-41d4-a716-446655440000"
  ],
  "includeMetadata": true,
  "includeStatistics": false, // Inclure les statistiques dans l'export
  "pdfOptions": {   // Requis si format = "pdf"
    "pageSize": "A4",              // "A4" | "Letter" | "A3"
    "margins": 25,                 // Marges en mm
    "includeTableOfContents": true,
    "includeHeaderFooter": true,
    "headerText": "Application E-commerce - Documentation",
    "footerText": "Généré par Coders Platform",
    "fontSize": 12,                // Taille police (8-16)
    "fontFamily": "Arial",         // "Arial" | "Times" | "Helvetica"
    "lineSpacing": 1.2,           // Espacement lignes (1.0-2.0)
    "theme": "professional"        // "professional" | "modern" | "minimal"
  },
  "markdownOptions": { // Optionnel pour format = "markdown"
    "includeFileHeaders": true,
    "separateFiles": false,       // Un fichier par document ou agrégé
    "addTimestamps": true,
    "preserveFormatting": true
  },
  "exportOptions": {
    "compressionLevel": "medium",  // "none" | "low" | "medium" | "high"
    "watermark": false,           // Ajouter filigrane (premium uniquement)
    "password": "",               // Protection par mot de passe (premium)
    "expirationHours": 24         // Durée avant expiration (1-72h)
  }
}
```

**Validation des options** :
- Vérification du format demandé
- Validation des IDs de fichiers
- Contrôle des permissions selon le rôle utilisateur
- Validation des options PDF (tailles, marges, polices)
- Vérification des quotas d'export

**Réponse 200 OK - Export synchrone terminé** :
```json
{
  "downloadUrl": "https://storage.coders.com/exports/temp/abc123-export.pdf?expires=1640995200&signature=xyz",
  "fileName": "Application E-commerce - Export PDF - 2024-08-18.pdf",
  "fileSize": 1048576,
  "format": "pdf",
  "expiresAt": "2024-08-18T15:30:00.000Z",
  "md5Hash": "a1b2c3d4e5f6789012345678901234567890abcd",
  "sha256Hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "metadata": {
    "pageCount": 25,
    "generationTime": 8.7,
    "compressionRatio": 0.73,
    "includedFiles": 2,
    "includedStatistics": false
  }
}
```

**Réponse 202 Accepted - Export asynchrone démarré** :
```json
{
  "exportId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "pending",
  "estimatedDurationMs": 30000,
  "message": "Export en cours de traitement...",
  "progress": 0,
  "queuePosition": 3,
  "statusUrl": "/api/v1/export/status/550e8400-e29b-41d4-a716-446655440000"
}
```

**400 Bad Request - Options invalides** :
```json
{
  "statusCode": 400,
  "message": "Invalid export options",
  "error": "Bad Request",
  "details": {
    "invalidOptions": [
      {
        "field": "pdfOptions.margins",
        "value": 5,
        "message": "Margins must be between 10 and 50mm"
      }
    ]
  }
}
```

**429 Too Many Requests - Quota dépassé** :
```json
{
  "statusCode": 429,
  "message": "Export quota exceeded. Maximum 3 concurrent exports allowed.",
  "error": "Too Many Requests",
  "retryAfter": 300,
  "currentExports": {
    "active": 3,
    "queued": 1,
    "dailyCount": 15,
    "dailyLimit": 20
  }
}
```

---

### GET /export/status/:exportId - Statut d'un export

Récupère le statut et la progression d'un export en cours avec détails enrichis.

**URL** : `GET /api/v1/export/status/{exportId}`

**Réponse 200 OK** :
```json
{
  "exportId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "processing",      // "pending" | "processing" | "completed" | "failed"
  "progress": 75,              // 0-100
  "currentStep": "pdf_conversion", // Étape en cours
  "message": "Conversion PDF en cours...",
  "estimatedTimeRemaining": 30, // secondes
  "lastUpdated": "2024-08-18T10:35:22.123Z",
  "metadata": {
    "totalSteps": 5,
    "completedSteps": 3,
    "currentStepProgress": 75,
    "processingTime": 45.2,
    "queueWaitTime": 12.8
  },
  "steps": [
    { "name": "validation", "status": "completed", "duration": 2.1 },
    { "name": "file_retrieval", "status": "completed", "duration": 8.7 },
    { "name": "content_aggregation", "status": "completed", "duration": 15.3 },
    { "name": "pdf_conversion", "status": "processing", "progress": 75 },
    { "name": "finalization", "status": "pending", "progress": 0 }
  ]
}
```

**Export terminé avec succès** :
```json
{
  "exportId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "completed",
  "progress": 100,
  "message": "Export terminé avec succès",
  "completedAt": "2024-08-18T10:36:45.567Z",
  "downloadUrl": "https://storage.coders.com/exports/temp/abc123-export.pdf?expires=1640995200&signature=xyz",
  "result": {
    "fileName": "Application E-commerce - Export PDF - 2024-08-18.pdf",
    "fileSize": 1048576,
    "format": "pdf",
    "expiresAt": "2024-08-18T15:30:00.000Z",
    "md5Hash": "a1b2c3d4e5f6789012345678901234567890abcd"
  }
}
```

**Export échoué** :
```json
{
  "exportId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "failed",
  "progress": 45,
  "message": "Échec lors de la conversion PDF",
  "failedAt": "2024-08-18T10:35:22.123Z",
  "error": {
    "code": "PDF_CONVERSION_ERROR",
    "message": "Unable to process large image in document",
    "details": {
      "failedStep": "pdf_conversion",
      "originalError": "Image exceeds maximum dimensions",
      "suggestedFix": "Reduce image size or exclude problematic files"
    }
  }
}
```

---

## Codes d'erreur standardisés

### Structure des réponses d'erreur enrichies
```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request",
  "timestamp": "2024-08-18T10:30:00.000Z",
  "path": "/api/v1/projects",
  "requestId": "req-123e4567-e89b-12d3-a456-426614174000", // Pour le debugging
  "details": {
    // Détails spécifiques selon le type d'erreur
  }
}
```

### Codes d'erreur spécifiques étendus

**Erreurs de validation (400)**
- `VALIDATION_FAILED` : Échec de validation des données (400)
- `INVALID_UUID` : Format UUID invalide (400)
- `INVALID_FILE_REFERENCE` : Référence de fichier invalide (400)
- `SANITIZATION_ERROR` : Erreur lors de la sanitisation (400)

**Erreurs d'autorisation (401/403)**
- `UNAUTHORIZED_ACCESS` : Accès non autorisé au projet (403)
- `INVALID_SERVICE_TOKEN` : Token de service invalide (401)
- `INSUFFICIENT_ROLE` : Rôle insuffisant pour l'opération (403)

**Erreurs de ressources (404)**
- `PROJECT_NOT_FOUND` : Projet inexistant (404)
- `STATISTICS_NOT_FOUND` : Statistiques non disponibles (404)
- `EXPORT_NOT_FOUND` : Export inexistant ou expiré (404)

**Erreurs de conflit (409/422)**
- `INVALID_STATUS_TRANSITION` : Transition d'état invalide (409)
- `PROJECT_QUOTA_EXCEEDED` : Quota de projets dépassé (422)
- `EXPORT_QUOTA_EXCEEDED` : Quota d'exports dépassé (429)

**Erreurs de traitement (422)**
- `EXPORT_NOT_READY` : Export pas encore terminé (409)
- `FILE_PROCESSING_ERROR` : Erreur de traitement de fichier (422)
- `STATISTICS_VALIDATION_ERROR` : Données statistiques incohérentes (422)

---

## Exemples pratiques enrichis

### Scénario complet : Création et export d'un projet avec statistiques

**1. Création du projet avec validation**
```bash
curl -X POST "https://api.coders.com/api/v1/projects" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Application Mobile React Native",
    "description": "App mobile de gestion de tâches avec synchronisation offline\n\n**Fonctionnalités clés :**\n- Authentification biométrique\n- Mode offline\n- Notifications push\n- Synchronisation cloud",
    "initialPrompt": "Je veux créer une app mobile de gestion de tâches avec React Native, incluant authentification, synchronisation offline et notifications push. L'\''app doit fonctionner sur iOS et Android avec une UX moderne.",
    "uploadedFileIds": ["550e8400-e29b-41d4-a716-446655440001"]
  }'
```

**2. Suivi de la génération avec métadonnées**
```bash
curl -X GET "https://api.coders.com/api/v1/projects/{project-id}?includeStatistics=true&statisticsDepth=full" \
  -H "Authorization: Bearer <token>"
```

**3. Export PDF avec options avancées**
```bash
curl -X POST "https://api.coders.com/api/v1/export/projects/{project-id}" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "format": "pdf",
    "includeMetadata": true,
    "includeStatistics": true,
    "pdfOptions": {
      "pageSize": "A4",
      "margins": 25,
      "includeTableOfContents": true,
      "includeHeaderFooter": true,
      "headerText": "App Mobile React Native - Documentation Technique",
      "fontSize": 11,
      "fontFamily": "Arial",
      "theme": "professional"
    },
    "exportOptions": {
      "compressionLevel": "medium",
      "expirationHours": 48
    }
  }'
```

**4. Suivi de l'export avec progression**
```bash
curl -X GET "https://api.coders.com/api/v1/export/status/{export-id}" \
  -H "Authorization: Bearer <token>"
```

**5. Téléchargement sécurisé**
```bash
# Utiliser downloadUrl retourné à l'étape 3 ou 4
wget "<downloadUrl>" -O "app-mobile-react-native-docs.pdf"
```

### Scénario : Gestion des statuts avec validation

**1. Archivage d'un projet**
```bash
curl -X PUT "https://api.coders.com/api/v1/projects/{project-id}/archive" \
  -H "Authorization: Bearer <token>"
```

**2. Restauration d'un projet archivé**
```bash
curl -X PUT "https://api.coders.com/api/v1/projects/{project-id}/restore" \
  -H "Authorization: Bearer <token>"
```

**3. Vérification des transitions disponibles**
```bash
curl -X GET "https://api.coders.com/api/v1/projects/{project-id}" \
  -H "Authorization: Bearer <token>" | jq '.statusMetadata.allowedTransitions'
```

---

## Considérations techniques avancées

### Limites et quotas enrichis
- **Projets par utilisateur** : 100 projets actifs (user), 500 (premium), illimité (admin)
- **Taille des requêtes** : 10 MB maximum (multipart pour les uploads)
- **Rate limiting** : 100 req/min (user), 200 req/min (premium), 500 req/min (admin)
- **Export simultanés** : 3 exports max (user), 5 exports (premium), 10 exports (admin)
- **Rétention exports** : 24 heures (user), 72 heures (premium), 7 jours (admin)
- **Taille maximale export** : 100 MB par fichier généré

### Performance et cache avancés
- **Cache projets** : 5 minutes pour les détails, 1 minute pour les listes
- **Cache statistiques** : 10 minutes avec invalidation intelligente
- **ETags** : Supportés pour optimiser les requêtes répétées
- **Compression** : Gzip automatique + Brotli pour connexions HTTPS
- **CDN** : Cache des assets statiques (images, CSS) avec TTL de 1 heure

### Sécurité renforcée
- **Isolation utilisateur** : Accès strict aux projets propriétés avec audit trail
- **Validation entrées** : Sanitisation anti-XSS + validation OWASP
- **URLs temporaires** : Expiration forcée avec signature HMAC
- **Audit trail** : Journalisation de toutes les actions avec IP et user-agent
- **Token rotation** : Tokens de service renouvelés automatiquement
- **Chiffrement** : Données sensibles chiffrées en base avec AES-256

### Monitoring et observabilité
- **Métriques temps réel** : Latence, throughput, taux d'erreur par endpoint
- **Traces distribuées** : Corrélation des requêtes inter-services
- **Health checks** : Endpoints /health avec vérification dépendances
- **Alerting** : Seuils configurables avec escalation automatique
- **Dashboards** : Métriques business et techniques en temps réel

---

## Changements et évolution

### Versioning de l'API enrichi
- **Version actuelle** : v1 (stable depuis janvier 2024)
- **Rétrocompatibilité** : Maintenue dans v1.x avec deprecation warnings
- **Nouveautés v1.2** : Statistiques enrichies, pagination cursor, export avancé
- **Roadmap v2** : Collaboration multi-utilisateurs, webhooks, API GraphQL
- **Deprecation** : Préavis de 6 mois minimum avec documentation de migration

### Changelog récent détaillé
- **v1.2.3** (2024-08-18) : Amélioration scoring qualité statistiques
- **v1.2.2** (2024-08-15) : Support thèmes d'export PDF, compression avancée
- **v1.2.1** (2024-08-10) : Optimisation cache, métadonnées statuts enrichies
- **v1.2.0** (2024-08-01) : Ajout filtres avancés, pagination cursor-based
- **v1.1.0** (2024-07-15) : Support export PDF avec options Pandoc
- **v1.0.0** (2024-07-01) : Version initiale stable

### Fonctionnalités expérimentales (preview)
- **Webhooks** : Notifications temps réel des événements projet
- **API GraphQL** : Requêtes flexibles pour les clients avancés
- **Collaboration** : Partage de projets entre utilisateurs (bêta fermée)
- **Templates** : Modèles de projets prédéfinis
- **Intégrations** : Connecteurs Git, Slack, Jira (roadmap)

Cette documentation complète reflète la richesse réelle du Service de Gestion des Projets avec ses fonctionnalités avancées de validation, sécurité, qualité des données et observabilité.