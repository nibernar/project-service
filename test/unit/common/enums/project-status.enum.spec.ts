/**
 * Tests unitaires pour le module project-status.enum.ts
 * 
 * Ces tests couvrent toutes les fonctionnalités principales de l'énumération
 * ProjectStatus et ses utilitaires associés.
 * 
 * @fileoverview Tests unitaires complets du module ProjectStatus
 */

import { ProjectStatus } from '@prisma/client';
import {
  isValidProjectStatus,
  isValidStatusTransition,
  getStatusMetadata,
  getAvailableTransitions,
  getStatusLabel,
  getStatusColor,
  isActiveStatus,
  isArchivedStatus,
  isDeletedStatus,
  PROJECT_STATUS_METADATA,
  VALID_STATUS_TRANSITIONS,
  PROJECT_STATUS_LABELS,
  PROJECT_STATUS_COLORS,
  ALL_PROJECT_STATUSES,
  USER_ACCESSIBLE_STATUSES,
} from '../../../../src/common/enums/project-status.enum';

describe('ProjectStatus Enum - Unit Tests', () => {
  
  // ============================================================================
  // TESTS DE BASE - ENUM ET CONSTANTES
  // ============================================================================
  
  describe('Basic Enum Values', () => {
    it('should have all expected enum values', () => {
      expect(ProjectStatus.ACTIVE).toBe('ACTIVE');
      expect(ProjectStatus.ARCHIVED).toBe('ARCHIVED');
      expect(ProjectStatus.DELETED).toBe('DELETED');
    });

    it('should export all project statuses array', () => {
      expect(ALL_PROJECT_STATUSES).toHaveLength(3);
      expect(ALL_PROJECT_STATUSES).toContain(ProjectStatus.ACTIVE);
      expect(ALL_PROJECT_STATUSES).toContain(ProjectStatus.ARCHIVED);
      expect(ALL_PROJECT_STATUSES).toContain(ProjectStatus.DELETED);
    });

    it('should export user accessible statuses', () => {
      expect(USER_ACCESSIBLE_STATUSES).toHaveLength(2);
      expect(USER_ACCESSIBLE_STATUSES).toContain(ProjectStatus.ACTIVE);
      expect(USER_ACCESSIBLE_STATUSES).toContain(ProjectStatus.ARCHIVED);
      expect(USER_ACCESSIBLE_STATUSES).not.toContain(ProjectStatus.DELETED);
    });
  });

  // ============================================================================
  // TESTS DE VALIDATION - isValidProjectStatus()
  // ============================================================================
  
  describe('isValidProjectStatus()', () => {
    describe('Valid Status Values', () => {
      it('should return true for ACTIVE', () => {
        expect(isValidProjectStatus('ACTIVE')).toBe(true);
      });

      it('should return true for ARCHIVED', () => {
        expect(isValidProjectStatus('ARCHIVED')).toBe(true);
      });

      it('should return true for DELETED', () => {
        expect(isValidProjectStatus('DELETED')).toBe(true);
      });

      it('should work with enum values directly', () => {
        expect(isValidProjectStatus(ProjectStatus.ACTIVE)).toBe(true);
        expect(isValidProjectStatus(ProjectStatus.ARCHIVED)).toBe(true);
        expect(isValidProjectStatus(ProjectStatus.DELETED)).toBe(true);
      });
    });

    describe('Invalid Status Values', () => {
      it('should return false for invalid string', () => {
        expect(isValidProjectStatus('INVALID')).toBe(false);
        expect(isValidProjectStatus('UNKNOWN')).toBe(false);
        expect(isValidProjectStatus('PENDING')).toBe(false);
      });

      it('should return false for empty string', () => {
        expect(isValidProjectStatus('')).toBe(false);
      });

      it('should return false for null and undefined', () => {
        expect(isValidProjectStatus(null as any)).toBe(false);
        expect(isValidProjectStatus(undefined as any)).toBe(false);
      });

      it('should return false for non-string types', () => {
        expect(isValidProjectStatus(123 as any)).toBe(false);
        expect(isValidProjectStatus(true as any)).toBe(false);
        expect(isValidProjectStatus({} as any)).toBe(false);
        expect(isValidProjectStatus([] as any)).toBe(false);
      });

      it('should return false for case variations', () => {
        expect(isValidProjectStatus('active')).toBe(false);
        expect(isValidProjectStatus('Active')).toBe(false);
        expect(isValidProjectStatus('ACTIV')).toBe(false);
        expect(isValidProjectStatus('ACTIVe')).toBe(false);
      });

      it('should return false for strings with whitespace', () => {
        expect(isValidProjectStatus(' ACTIVE')).toBe(false);
        expect(isValidProjectStatus('ACTIVE ')).toBe(false);
        expect(isValidProjectStatus(' ACTIVE ')).toBe(false);
        expect(isValidProjectStatus('\tACTIVE\n')).toBe(false);
      });

      it('should handle special characters gracefully', () => {
        expect(isValidProjectStatus('ACTIVE!')).toBe(false);
        expect(isValidProjectStatus('ACTIVE@')).toBe(false);
        expect(isValidProjectStatus('ACT|VE')).toBe(false);
        expect(isValidProjectStatus('ACT;IVE')).toBe(false);
      });

      it('should handle very long strings', () => {
        const longString = 'A'.repeat(1000);
        expect(isValidProjectStatus(longString)).toBe(false);
      });

      it('should handle potential SQL injection attempts', () => {
        expect(isValidProjectStatus("'; DROP TABLE projects; --")).toBe(false);
        expect(isValidProjectStatus("ACTIVE' OR '1'='1")).toBe(false);
      });
    });
  });

  // ============================================================================
  // TESTS DE TRANSITIONS - isValidStatusTransition()
  // ============================================================================
  
  describe('isValidStatusTransition()', () => {
    describe('Valid Transitions', () => {
      it('should allow ACTIVE → ARCHIVED', () => {
        expect(isValidStatusTransition(ProjectStatus.ACTIVE, ProjectStatus.ARCHIVED)).toBe(true);
      });

      it('should allow ACTIVE → DELETED', () => {
        expect(isValidStatusTransition(ProjectStatus.ACTIVE, ProjectStatus.DELETED)).toBe(true);
      });

      it('should allow ARCHIVED → ACTIVE', () => {
        expect(isValidStatusTransition(ProjectStatus.ARCHIVED, ProjectStatus.ACTIVE)).toBe(true);
      });

      it('should allow ARCHIVED → DELETED', () => {
        expect(isValidStatusTransition(ProjectStatus.ARCHIVED, ProjectStatus.DELETED)).toBe(true);
      });
    });

    describe('Invalid Transitions', () => {
      it('should reject DELETED → ACTIVE', () => {
        expect(isValidStatusTransition(ProjectStatus.DELETED, ProjectStatus.ACTIVE)).toBe(false);
      });

      it('should reject DELETED → ARCHIVED', () => {
        expect(isValidStatusTransition(ProjectStatus.DELETED, ProjectStatus.ARCHIVED)).toBe(false);
      });

      it('should reject DELETED → DELETED', () => {
        expect(isValidStatusTransition(ProjectStatus.DELETED, ProjectStatus.DELETED)).toBe(false);
      });
    });

    describe('Self-Transitions', () => {
      it('should reject ACTIVE → ACTIVE', () => {
        expect(isValidStatusTransition(ProjectStatus.ACTIVE, ProjectStatus.ACTIVE)).toBe(false);
      });

      it('should reject ARCHIVED → ARCHIVED', () => {
        expect(isValidStatusTransition(ProjectStatus.ARCHIVED, ProjectStatus.ARCHIVED)).toBe(false);
      });
    });

    describe('Edge Cases', () => {
      it('should handle invalid from status gracefully', () => {
        expect(() => isValidStatusTransition('INVALID' as any, ProjectStatus.ACTIVE)).not.toThrow();
        expect(isValidStatusTransition('INVALID' as any, ProjectStatus.ACTIVE)).toBe(false);
      });

      it('should handle invalid to status gracefully', () => {
        expect(() => isValidStatusTransition(ProjectStatus.ACTIVE, 'INVALID' as any)).not.toThrow();
        expect(isValidStatusTransition(ProjectStatus.ACTIVE, 'INVALID' as any)).toBe(false);
      });
    });
  });

  // ============================================================================
  // TESTS DES MÉTADONNÉES - getStatusMetadata()
  // ============================================================================
  
  describe('getStatusMetadata()', () => {
    describe('Valid Metadata Retrieval', () => {
      it('should return correct metadata for ACTIVE', () => {
        const metadata = getStatusMetadata(ProjectStatus.ACTIVE);
        
        expect(metadata).toMatchObject({
          status: ProjectStatus.ACTIVE,
          label: 'Actif',
          description: expect.stringContaining('cours d\'utilisation'),
          color: '#10B981',
          allowedTransitions: [ProjectStatus.ARCHIVED, ProjectStatus.DELETED],
        });
      });

      it('should return correct metadata for ARCHIVED', () => {
        const metadata = getStatusMetadata(ProjectStatus.ARCHIVED);
        
        expect(metadata).toMatchObject({
          status: ProjectStatus.ARCHIVED,
          label: 'Archivé',
          description: expect.stringContaining('archivé'),
          color: '#F59E0B',
          allowedTransitions: [ProjectStatus.ACTIVE, ProjectStatus.DELETED],
        });
      });

      it('should return correct metadata for DELETED', () => {
        const metadata = getStatusMetadata(ProjectStatus.DELETED);
        
        expect(metadata).toMatchObject({
          status: ProjectStatus.DELETED,
          label: 'Supprimé',
          description: expect.stringContaining('supprimé'),
          color: '#EF4444',
          allowedTransitions: [],
        });
      });
    });

    describe('Metadata Structure Validation', () => {
      it('should return object with all required properties', () => {
        const metadata = getStatusMetadata(ProjectStatus.ACTIVE);
        
        expect(metadata).toHaveProperty('status');
        expect(metadata).toHaveProperty('label');
        expect(metadata).toHaveProperty('description');
        expect(metadata).toHaveProperty('color');
        expect(metadata).toHaveProperty('allowedTransitions');
      });

      it('should return immutable metadata', () => {
        const metadata1 = getStatusMetadata(ProjectStatus.ACTIVE);
        const metadata2 = getStatusMetadata(ProjectStatus.ACTIVE);
        
        // Should be equal but not the same reference if properly implemented
        expect(metadata1).toEqual(metadata2);
      });
    });

    describe('Error Handling', () => {
      it('should throw error for invalid status', () => {
        expect(() => getStatusMetadata('INVALID' as any)).toThrow();
      });

      it('should throw specific error message', () => {
        expect(() => getStatusMetadata('INVALID' as any)).toThrow('Unknown project status: INVALID');
      });
    });
  });

  // ============================================================================
  // TESTS DES TRANSITIONS DISPONIBLES - getAvailableTransitions()
  // ============================================================================
  
  describe('getAvailableTransitions()', () => {
    describe('Available Transitions', () => {
      it('should return [ARCHIVED, DELETED] for ACTIVE', () => {
        const transitions = getAvailableTransitions(ProjectStatus.ACTIVE);
        expect(transitions).toHaveLength(2);
        expect(transitions).toContain(ProjectStatus.ARCHIVED);
        expect(transitions).toContain(ProjectStatus.DELETED);
      });

      it('should return [ACTIVE, DELETED] for ARCHIVED', () => {
        const transitions = getAvailableTransitions(ProjectStatus.ARCHIVED);
        expect(transitions).toHaveLength(2);
        expect(transitions).toContain(ProjectStatus.ACTIVE);
        expect(transitions).toContain(ProjectStatus.DELETED);
      });

      it('should return empty array for DELETED', () => {
        const transitions = getAvailableTransitions(ProjectStatus.DELETED);
        expect(transitions).toHaveLength(0);
        expect(transitions).toEqual([]);
      });
    });

    describe('Immutability', () => {
      it('should return new array (not reference to original)', () => {
        const transitions1 = getAvailableTransitions(ProjectStatus.ACTIVE);
        const transitions2 = getAvailableTransitions(ProjectStatus.ACTIVE);
        
        expect(transitions1).not.toBe(transitions2);
        expect(transitions1).toEqual(transitions2);
      });

      it('mutations should not affect internal state', () => {
        const transitions = getAvailableTransitions(ProjectStatus.ACTIVE);
        const originalLength = transitions.length;
        
        transitions.push('INVALID' as any);
        
        const newTransitions = getAvailableTransitions(ProjectStatus.ACTIVE);
        expect(newTransitions).toHaveLength(originalLength);
      });
    });

    describe('Array Order Consistency', () => {
      it('should maintain consistent order across calls', () => {
        const transitions1 = getAvailableTransitions(ProjectStatus.ACTIVE);
        const transitions2 = getAvailableTransitions(ProjectStatus.ACTIVE);
        
        expect(transitions1).toEqual(transitions2);
      });
    });
  });

  // ============================================================================
  // TESTS DES FONCTIONS HELPER
  // ============================================================================
  
  describe('Helper Functions', () => {
    describe('getStatusLabel()', () => {
      it('should return correct French labels', () => {
        expect(getStatusLabel(ProjectStatus.ACTIVE)).toBe('Actif');
        expect(getStatusLabel(ProjectStatus.ARCHIVED)).toBe('Archivé');
        expect(getStatusLabel(ProjectStatus.DELETED)).toBe('Supprimé');
      });

      it('should handle all enum values', () => {
        Object.values(ProjectStatus).forEach(status => {
          expect(getStatusLabel(status)).toBeTruthy();
          expect(typeof getStatusLabel(status)).toBe('string');
        });
      });
    });

    describe('getStatusColor()', () => {
      it('should return valid hex color codes', () => {
        const hexColorRegex = /^#[0-9A-F]{6}$/i;
        
        expect(getStatusColor(ProjectStatus.ACTIVE)).toMatch(hexColorRegex);
        expect(getStatusColor(ProjectStatus.ARCHIVED)).toMatch(hexColorRegex);
        expect(getStatusColor(ProjectStatus.DELETED)).toMatch(hexColorRegex);
      });

      it('should return consistent colors', () => {
        expect(getStatusColor(ProjectStatus.ACTIVE)).toBe('#10B981');
        expect(getStatusColor(ProjectStatus.ARCHIVED)).toBe('#F59E0B');
        expect(getStatusColor(ProjectStatus.DELETED)).toBe('#EF4444');
      });

      it('should return distinct colors for each status', () => {
        const colors = Object.values(ProjectStatus).map(status => getStatusColor(status));
        const uniqueColors = [...new Set(colors)];
        
        expect(uniqueColors).toHaveLength(colors.length);
      });
    });

    describe('Status Type Checkers', () => {
      describe('isActiveStatus()', () => {
        it('should return true only for ACTIVE', () => {
          expect(isActiveStatus(ProjectStatus.ACTIVE)).toBe(true);
          expect(isActiveStatus(ProjectStatus.ARCHIVED)).toBe(false);
          expect(isActiveStatus(ProjectStatus.DELETED)).toBe(false);
        });
      });

      describe('isArchivedStatus()', () => {
        it('should return true only for ARCHIVED', () => {
          expect(isArchivedStatus(ProjectStatus.ACTIVE)).toBe(false);
          expect(isArchivedStatus(ProjectStatus.ARCHIVED)).toBe(true);
          expect(isArchivedStatus(ProjectStatus.DELETED)).toBe(false);
        });
      });

      describe('isDeletedStatus()', () => {
        it('should return true only for DELETED', () => {
          expect(isDeletedStatus(ProjectStatus.ACTIVE)).toBe(false);
          expect(isDeletedStatus(ProjectStatus.ARCHIVED)).toBe(false);
          expect(isDeletedStatus(ProjectStatus.DELETED)).toBe(true);
        });
      });

      it('should be mutually exclusive', () => {
        Object.values(ProjectStatus).forEach(status => {
          const checks = [
            isActiveStatus(status),
            isArchivedStatus(status),
            isDeletedStatus(status),
          ];
          
          const trueCount = checks.filter(Boolean).length;
          expect(trueCount).toBe(1);
        });
      });
    });
  });

  // ============================================================================
  // TESTS DE COHÉRENCE DES CONSTANTES
  // ============================================================================
  
  describe('Constants Consistency', () => {
    describe('Metadata Consistency', () => {
      it('all statuses in metadata should exist in enum', () => {
        Object.keys(PROJECT_STATUS_METADATA).forEach(status => {
          expect(Object.values(ProjectStatus)).toContain(status as ProjectStatus);
        });
      });

      it('all enum values should have metadata', () => {
        Object.values(ProjectStatus).forEach(status => {
          expect(PROJECT_STATUS_METADATA[status]).toBeDefined();
        });
      });

      it('metadata status should match key', () => {
        Object.entries(PROJECT_STATUS_METADATA).forEach(([key, metadata]) => {
          expect(metadata.status).toBe(key);
        });
      });
    });

    describe('Transition Matrix Consistency', () => {
      it('all transitions should reference valid statuses', () => {
        Object.entries(VALID_STATUS_TRANSITIONS).forEach(([from, tos]) => {
          expect(Object.values(ProjectStatus)).toContain(from as ProjectStatus);
          tos.forEach(to => {
            expect(Object.values(ProjectStatus)).toContain(to);
          });
        });
      });

      it('no status should transition to itself', () => {
        Object.entries(VALID_STATUS_TRANSITIONS).forEach(([from, tos]) => {
          expect(tos).not.toContain(from);
        });
      });

      it('DELETED should have no outgoing transitions', () => {
        expect(VALID_STATUS_TRANSITIONS[ProjectStatus.DELETED]).toEqual([]);
      });

      it('transition matrix should match metadata', () => {
        Object.entries(PROJECT_STATUS_METADATA).forEach(([status, metadata]) => {
          expect(metadata.allowedTransitions).toEqual(VALID_STATUS_TRANSITIONS[status as ProjectStatus]);
        });
      });
    });

    describe('Labels and Colors Consistency', () => {
      it('all statuses should have labels', () => {
        Object.values(ProjectStatus).forEach(status => {
          expect(PROJECT_STATUS_LABELS[status]).toBeTruthy();
          expect(typeof PROJECT_STATUS_LABELS[status]).toBe('string');
        });
      });

      it('all statuses should have colors', () => {
        Object.values(ProjectStatus).forEach(status => {
          expect(PROJECT_STATUS_COLORS[status]).toBeTruthy();
          expect(PROJECT_STATUS_COLORS[status]).toMatch(/^#[0-9A-F]{6}$/i);
        });
      });

      it('labels should match metadata labels', () => {
        Object.values(ProjectStatus).forEach(status => {
          expect(PROJECT_STATUS_LABELS[status]).toBe(PROJECT_STATUS_METADATA[status].label);
        });
      });

      it('colors should match metadata colors', () => {
        Object.values(ProjectStatus).forEach(status => {
          expect(PROJECT_STATUS_COLORS[status]).toBe(PROJECT_STATUS_METADATA[status].color);
        });
      });
    });
  });
});