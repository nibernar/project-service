import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiInfoResponseDto } from './app.controller';

/**
 * Service racine de l'application
 * Gère la logique métier de base pour les informations de l'API
 */
@Injectable()
export class AppService {
  constructor(private readonly configService: ConfigService) {}

  /**
   * Récupère les informations de base de l'API
   * 
   * @returns {ApiInfoResponseDto} Informations sur l'API (nom, version, environnement)
   */
  getApiInfo(): ApiInfoResponseDto {
    return {
      name: 'Project Service API',
      version: '1.0.0',
      environment: this.configService.get('app.nodeEnv', 'development'),
    };
  }
}