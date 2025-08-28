/**
 * Event Types Constants for Project Service
 * 
 * Centralized definition of all event types that can be published
 * or consumed by the Project Service in the Event-Driven Architecture.
 * 
 * Convention: {domain}.{action} format with snake_case values
 * Domain: 'project' for this service
 * Actions: past tense verbs (created, updated, archived, deleted)
 */

/**
 * Project Event Namespace
 * Used as prefix for all project-related events to avoid conflicts
 */
export const PROJECT_EVENT_NAMESPACE = 'project' as const;

/**
 * Core Project Event Types
 * 
 * These constants define all event types that the Project Service
 * can publish to notify other services of state changes.
 */
export const EVENT_TYPES = {
  /**
   * PROJECT_CREATED
   * Triggered when: A new project is successfully created
   * Target consumers: Orchestration Service (C06)
   * Criticality: HIGH - Must be processed to start document generation workflow
   * Payload: Project creation details, initial prompt, uploaded file IDs
   */
  PROJECT_CREATED: `${PROJECT_EVENT_NAMESPACE}.created`,

  /**
   * PROJECT_UPDATED
   * Triggered when: Project metadata (name, description) is modified
   * Target consumers: Monitoring services, Cache services
   * Criticality: MEDIUM - For cache invalidation and reference synchronization
   * Payload: Project ID, changed fields, update timestamp
   */
  PROJECT_UPDATED: `${PROJECT_EVENT_NAMESPACE}.updated`,

  /**
   * PROJECT_ARCHIVED
   * Triggered when: Project status changes to ARCHIVED
   * Target consumers: Monitoring services, Cleanup services
   * Criticality: MEDIUM - For resource optimization and archival processes
   * Payload: Project ID, archival timestamp, archival reason (optional)
   */
  PROJECT_ARCHIVED: `${PROJECT_EVENT_NAMESPACE}.archived`,

  /**
   * PROJECT_DELETED
   * Triggered when: Project is soft-deleted (status = DELETED)
   * Target consumers: All services with project references
   * Criticality: HIGH - For maintaining referential integrity
   * Payload: Project ID, deletion timestamp, cleanup requirements
   */
  PROJECT_DELETED: `${PROJECT_EVENT_NAMESPACE}.deleted`,

  /**
   * PROJECT_FILES_UPDATED
   * Triggered when: Generated file IDs are received from orchestrator
   * Target consumers: File Storage Service, User interfaces, Cache services
   * Criticality: HIGH - User deliverable availability
   * Payload: Project ID, new generated file IDs, generation completion status
   */
  PROJECT_FILES_UPDATED: `${PROJECT_EVENT_NAMESPACE}.files.updated`,
} as const;

/**
 * Type Union for Event Type Validation
 * 
 * This type can be used to ensure type safety when working with events.
 * It represents all valid project event types.
 */
export type ProjectEventType = typeof EVENT_TYPES[keyof typeof EVENT_TYPES];

/**
 * Event Criticality Levels
 * 
 * Defines the importance and urgency levels for event processing.
 * Used by message brokers for prioritization and retry policies.
 */
export const EVENT_CRITICALITY = {
  HIGH: 'high',
  MEDIUM: 'medium', 
  LOW: 'low',
} as const;

export type EventCriticality = typeof EVENT_CRITICALITY[keyof typeof EVENT_CRITICALITY];

/**
 * Event Metadata Configuration
 * 
 * Provides additional context and configuration for each event type.
 * Used for documentation, monitoring, and event processing configuration.
 */
export const EVENT_METADATA = {
  [EVENT_TYPES.PROJECT_CREATED]: {
    description: 'Triggered when a new project is successfully created',
    criticality: EVENT_CRITICALITY.HIGH,
    expectedConsumers: ['orchestration-service'],
    retryPolicy: 'exponential-backoff',
    maxRetries: 5,
    timeout: 30000, // 30 seconds
  },
  [EVENT_TYPES.PROJECT_UPDATED]: {
    description: 'Triggered when project metadata is modified',
    criticality: EVENT_CRITICALITY.MEDIUM,
    expectedConsumers: ['monitoring-service', 'cache-service'],
    retryPolicy: 'linear-backoff',
    maxRetries: 3,
    timeout: 15000, // 15 seconds
  },
  [EVENT_TYPES.PROJECT_ARCHIVED]: {
    description: 'Triggered when project status changes to ARCHIVED',
    criticality: EVENT_CRITICALITY.MEDIUM,
    expectedConsumers: ['monitoring-service', 'cleanup-service'],
    retryPolicy: 'linear-backoff',
    maxRetries: 3,
    timeout: 15000, // 15 seconds
  },
  [EVENT_TYPES.PROJECT_DELETED]: {
    description: 'Triggered when project is soft-deleted',
    criticality: EVENT_CRITICALITY.HIGH,
    expectedConsumers: ['file-storage-service', 'statistics-service', 'monitoring-service'],
    retryPolicy: 'exponential-backoff',
    maxRetries: 5,
    timeout: 45000, // 45 seconds
  },
  [EVENT_TYPES.PROJECT_FILES_UPDATED]: {
    description: 'Triggered when generated file IDs are received from orchestrator',
    criticality: EVENT_CRITICALITY.HIGH,
    expectedConsumers: ['file-storage-service', 'cache-service'],
    retryPolicy: 'exponential-backoff',
    maxRetries: 5,
    timeout: 30000, // 30 seconds
  },
} as const;

/**
 * Event Routing Configuration
 * 
 * Defines routing patterns for different event types.
 * Used by message brokers for event distribution.
 */
export const EVENT_ROUTING = {
  // High criticality events go to priority queues
  HIGH_PRIORITY_EVENTS: [
    EVENT_TYPES.PROJECT_CREATED,
    EVENT_TYPES.PROJECT_DELETED,
    EVENT_TYPES.PROJECT_FILES_UPDATED,
  ],
  
  // Medium criticality events go to standard queues
  STANDARD_PRIORITY_EVENTS: [
    EVENT_TYPES.PROJECT_UPDATED,
    EVENT_TYPES.PROJECT_ARCHIVED,
  ],
  
  // Events that trigger orchestration workflows
  ORCHESTRATION_EVENTS: [
    EVENT_TYPES.PROJECT_CREATED,
  ],
  
  // Events that require cache invalidation
  CACHE_INVALIDATION_EVENTS: [
    EVENT_TYPES.PROJECT_UPDATED,
    EVENT_TYPES.PROJECT_ARCHIVED,
    EVENT_TYPES.PROJECT_DELETED,
    EVENT_TYPES.PROJECT_FILES_UPDATED,
  ],
  
  // Events that require cleanup actions
  CLEANUP_EVENTS: [
    EVENT_TYPES.PROJECT_ARCHIVED,
    EVENT_TYPES.PROJECT_DELETED,
  ],
} as const;

/**
 * Utility Functions for Event Type Validation
 */

/**
 * Validates if a given string is a valid project event type
 * @param eventType - The event type string to validate
 * @returns True if the event type is valid, false otherwise
 */
export function isValidProjectEventType(eventType: string): eventType is ProjectEventType {
  return Object.values(EVENT_TYPES).includes(eventType as ProjectEventType);
}

/**
 * Gets event metadata for a specific event type
 * @param eventType - The event type to get metadata for
 * @returns Event metadata or undefined if event type is invalid
 */
export function getEventMetadata(eventType: ProjectEventType) {
  return EVENT_METADATA[eventType];
}

/**
 * Checks if an event type is high priority
 * @param eventType - The event type to check
 * @returns True if the event type is high priority
 */
export function isHighPriorityEvent(eventType: ProjectEventType): boolean {
  return (EVENT_ROUTING.HIGH_PRIORITY_EVENTS as readonly string[]).includes(eventType);
}

/**
 * Checks if an event type requires cache invalidation
 * @param eventType - The event type to check
 * @returns True if the event type requires cache invalidation
 */
export function requiresCacheInvalidation(eventType: ProjectEventType): boolean {
  return (EVENT_ROUTING.CACHE_INVALIDATION_EVENTS as readonly string[]).includes(eventType);
}