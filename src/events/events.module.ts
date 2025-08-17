/**
 * EventsModule - Module temporaire pour la gestion des événements métier
 * 
 * STUB TEMPORAIRE - À remplacer en Phase 6 !
 * 
 * Ce module fournit l'EventsService stub pour permettre le développement
 * et les tests sans attendre l'implémentation complète du système d'événements.
 * 
 * @fileoverview Module temporaire pour les événements
 * @version 0.1.0-stub 
 * @since 2025-01-28
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventsService } from './events.service';

/**
 * Module temporaire pour la gestion des événements
 * 
 * ATTENTION : Ce module sera remplacé en Phase 6 par une implémentation
 * complète avec HTTP client, message queues, retry logic, etc.
 */
@Module({
  imports: [ConfigModule],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}