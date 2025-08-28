import {
  IsUUID,
  IsString,
  IsOptional,
  IsArray,
  IsInt,
  IsDateString,
  Length,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type, Transform, Expose, Exclude } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Event Metadata for tracking and correlation
 */
export class EventMetadataDto {
  @ApiProperty({
    description: 'Unique identifier for this specific event occurrence',
    example: 'evt_01234567-89ab-cdef-0123-456789abcdef',
  })
  @IsUUID()
  @Expose()
  eventId: string;

  @ApiProperty({
    description: 'Precise timestamp when the event was created',
    example: '2025-08-27T20:36:20.540Z',
  })
  @IsDateString()
  @Expose()
  eventTimestamp: Date;

  @ApiProperty({
    description: 'Schema version for backward compatibility',
    example: '1.0',
  })
  @IsString()
  @Expose()
  eventVersion: string;

  @ApiProperty({
    description: 'Source service that generated this event',
    example: 'project-service',
  })
  @IsString()
  @Expose()
  sourceService: string;
}

/**
 * Project Created Event DTO
 * 
 * Defines the payload structure for the 'project.created' event.
 * This event is published when a new project is successfully created
 * and triggers the document generation workflow in the orchestration service.
 * 
 * @example
 * ```json
 * {
 *   "projectId": "01234567-89ab-cdef-0123-456789abcdef",
 *   "ownerId": "user_98765432-10ab-cdef-0123-456789abcdef",
 *   "name": "My Web Application",
 *   "description": "A modern web application with React and NestJS",
 *   "initialPrompt": "Create a full-stack web application with user authentication...",
 *   "uploadedFileIds": ["file_1", "file_2"],
 *   "uploadedFileCount": 2,
 *   "createdAt": "2025-08-27T20:36:20.540Z",
 *   "eventMetadata": {
 *     "eventId": "evt_01234567-89ab-cdef-0123-456789abcdef",
 *     "eventTimestamp": "2025-08-27T20:36:20.545Z",
 *     "eventVersion": "1.0",
 *     "sourceService": "project-service"
 *   }
 * }
 * ```
 */
export class ProjectCreatedEventDto {
  /**
   * Unique identifier of the created project
   */
  @ApiProperty({
    description: 'Unique UUID identifier of the created project',
    example: '01234567-89ab-cdef-0123-456789abcdef',
    format: 'uuid',
  })
  @IsUUID(4, { message: 'Project ID must be a valid UUID v4' })
  @Expose()
  projectId: string;

  /**
   * Unique identifier of the project owner
   */
  @ApiProperty({
    description: 'Unique UUID identifier of the project owner',
    example: 'user_98765432-10ab-cdef-0123-456789abcdef',
    format: 'uuid',
  })
  @IsUUID(4, { message: 'Owner ID must be a valid UUID v4' })
  @Expose()
  ownerId: string;

  /**
   * Name of the created project
   */
  @ApiProperty({
    description: 'Display name of the project',
    example: 'My Web Application',
    minLength: 1,
    maxLength: 100,
  })
  @IsString({ message: 'Project name must be a string' })
  @Length(1, 100, { message: 'Project name must be between 1 and 100 characters' })
  @Expose()
  name: string;

  /**
   * Optional description of the project
   */
  @ApiPropertyOptional({
    description: 'Optional detailed description of the project',
    example: 'A modern web application with user authentication, real-time features, and responsive design',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString({ message: 'Project description must be a string' })
  @MaxLength(1000, { message: 'Project description cannot exceed 1000 characters' })
  @Expose()
  description?: string;

  /**
   * Initial user prompt that triggered the project creation
   */
  @ApiProperty({
    description: 'Initial user prompt that will be used to start the document generation process',
    example: 'Create a full-stack web application with user authentication, a dashboard, and real-time notifications using React, NestJS, and WebSockets',
    minLength: 10,
    maxLength: 5000,
  })
  @IsString({ message: 'Initial prompt must be a string' })
  @Length(10, 5000, { message: 'Initial prompt must be between 10 and 5000 characters' })
  @Expose()
  initialPrompt: string;

  /**
   * Array of uploaded file identifiers
   */
  @ApiProperty({
    description: 'Array of file IDs that were uploaded with the project',
    example: ['file_001', 'file_002', 'spec_document_123'],
    type: [String],
    isArray: true,
  })
  @IsArray({ message: 'Uploaded file IDs must be an array' })
  @IsString({ each: true, message: 'Each uploaded file ID must be a string' })
  @Expose()
  uploadedFileIds: string[];

  /**
   * Count of uploaded files (computed field for quick reference)
   */
  @ApiProperty({
    description: 'Number of files uploaded with the project (computed from uploadedFileIds length)',
    example: 2,
    minimum: 0,
  })
  @IsInt({ message: 'Uploaded file count must be an integer' })
  @Min(0, { message: 'Uploaded file count cannot be negative' })
  @Transform(({ obj }) => obj.uploadedFileIds?.length || 0)
  @Expose()
  uploadedFileCount: number;

  /**
   * Timestamp when the project was created
   */
  @ApiProperty({
    description: 'ISO 8601 timestamp of when the project was created',
    example: '2025-08-27T20:36:20.540Z',
    format: 'date-time',
  })
  @IsDateString({}, { message: 'Created date must be a valid ISO 8601 date string' })
  @Type(() => Date)
  @Expose()
  createdAt: Date;

  /**
   * Event metadata for tracking and correlation
   */
  @ApiProperty({
    description: 'Metadata about the event for tracking and correlation purposes',
    type: EventMetadataDto,
  })
  @ValidateNested({ message: 'Event metadata must be valid' })
  @Type(() => EventMetadataDto)
  @Expose()
  eventMetadata: EventMetadataDto;

  /**
   * Internal tracking fields (excluded from serialization)
   */
  @Exclude()
  private _validated?: boolean;

  /**
   * Factory method to create ProjectCreatedEventDto from a Project entity
   * 
   * @param projectData - The project entity data
   * @param eventId - Unique event identifier
   * @returns Properly structured ProjectCreatedEventDto
   */
  static fromProjectData(
    projectData: {
      id: string;
      ownerId: string;
      name: string;
      description?: string;
      initialPrompt: string;
      uploadedFileIds: string[];
      createdAt: Date;
    },
    eventId?: string,
  ): ProjectCreatedEventDto {
    const now = new Date();
    const eventDto = new ProjectCreatedEventDto();

    eventDto.projectId = projectData.id;
    eventDto.ownerId = projectData.ownerId;
    eventDto.name = projectData.name;
    eventDto.description = projectData.description;
    eventDto.initialPrompt = projectData.initialPrompt;
    eventDto.uploadedFileIds = projectData.uploadedFileIds || [];
    eventDto.uploadedFileCount = eventDto.uploadedFileIds.length;
    eventDto.createdAt = projectData.createdAt;

    eventDto.eventMetadata = {
      eventId: eventId || `evt_${crypto.randomUUID()}`,
      eventTimestamp: now,
      eventVersion: '1.0',
      sourceService: 'project-service',
    };

    return eventDto;
  }

  /**
   * Create a minimal event DTO for testing purposes
   * 
   * @param overrides - Optional field overrides
   * @returns Test ProjectCreatedEventDto instance
   */
  static createTestEvent(overrides: Partial<ProjectCreatedEventDto> = {}): ProjectCreatedEventDto {
    const now = new Date();
    const baseEvent = ProjectCreatedEventDto.fromProjectData(
      {
        id: crypto.randomUUID(),
        ownerId: crypto.randomUUID(),
        name: 'Test Project',
        description: 'A test project for development',
        initialPrompt: 'Create a simple test application for validation purposes',
        uploadedFileIds: [],
        createdAt: now,
      },
      `evt_test_${crypto.randomUUID()}`,
    );

    return Object.assign(baseEvent, overrides);
  }

  /**
   * Validates the event payload and marks it as validated
   * 
   * @returns Promise that resolves to true if validation passes
   * @throws ValidationError if validation fails
   */
  async validate(): Promise<boolean> {
    // Validation logic would be implemented here using class-validator
    // For now, we'll do basic checks
    
    if (!this.projectId || !this.ownerId || !this.name || !this.initialPrompt) {
      throw new Error('Missing required fields for ProjectCreatedEventDto');
    }

    if (this.uploadedFileIds && this.uploadedFileIds.length !== this.uploadedFileCount) {
      throw new Error('uploadedFileCount must match uploadedFileIds length');
    }

    this._validated = true;
    return true;
  }

  /**
   * Converts the event to a plain JSON object for serialization
   * 
   * @returns Plain object representation suitable for JSON serialization
   */
  toJSON(): Record<string, any> {
    return {
      projectId: this.projectId,
      ownerId: this.ownerId,
      name: this.name,
      description: this.description,
      initialPrompt: this.initialPrompt,
      uploadedFileIds: this.uploadedFileIds,
      uploadedFileCount: this.uploadedFileCount,
      createdAt: this.createdAt.toISOString(),
      eventMetadata: {
        eventId: this.eventMetadata.eventId,
        eventTimestamp: this.eventMetadata.eventTimestamp.toISOString(),
        eventVersion: this.eventMetadata.eventVersion,
        sourceService: this.eventMetadata.sourceService,
      },
    };
  }

  /**
   * Extracts only the event metadata for correlation purposes
   * 
   * @returns Event metadata object
   */
  getEventMetadata(): EventMetadataDto {
    return this.eventMetadata;
  }

  /**
   * Gets the payload size in bytes (approximate)
   * 
   * @returns Approximate size in bytes
   */
  getPayloadSize(): number {
    return new Blob([JSON.stringify(this.toJSON())]).size;
  }

  /**
   * Checks if this event has been validated
   * 
   * @returns True if the event has been validated
   */
  isValidated(): boolean {
    return this._validated === true;
  }
}