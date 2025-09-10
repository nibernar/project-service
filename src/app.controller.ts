import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiProperty, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString, Matches } from 'class-validator';
import { AppService } from './app.service';

/**
 * DTO pour la réponse des informations de l'API
 */
export class ApiInfoResponseDto {
  @ApiProperty({
    description: 'Name of the API service',
    example: 'Project Service API'
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Current version of the API',
    example: '1.0.0',
    pattern: '^\\d+\\.\\d+\\.\\d+$'
  })
  @IsString()
  @Matches(/^\d+\.\d+\.\d+$/)
  version: string;

  @ApiProperty({
    description: 'Current environment',
    example: 'production',
    enum: ['development', 'staging', 'production', 'test']
  })
  @IsEnum(['development', 'staging', 'production', 'test'])
  environment: string;
}

/**
 * Contrôleur racine de l'application
 * Fournit les endpoints de base pour les informations sur l'API
 */
@Controller()
@ApiTags('App')
export class AppController {
  constructor(private readonly appService: AppService) {}

  /**
   * Récupère les informations de base de l'API
   * 
   * @returns {ApiInfoResponseDto} Informations sur l'API (nom, version, environnement)
   */
  @Get()
  @ApiOperation({ summary: 'Get API information' })
  @ApiResponse({ 
    status: 200, 
    description: 'API information retrieved successfully',
    type: ApiInfoResponseDto 
  })
  getApiInfo(): ApiInfoResponseDto {
    return this.appService.getApiInfo();
  }
}
