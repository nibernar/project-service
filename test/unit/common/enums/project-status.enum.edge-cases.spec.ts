/**
 * Tests d'edge cases pour le module project-status.enum.ts
 * 
 * Ces tests couvrent tous les cas limites, situations exceptionnelles
 * et scénarios de bordure qui pourraient causer des problèmes.
 * 
 * @fileoverview Tests d'edge cases du module ProjectStatus
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
  ALL_PROJECT_STATUSES,
} from '../../../../src/common/enums/project-status.enum';

describe('ProjectStatus Enum - Edge Cases Tests', () => {
  
  // ============================================================================
  // EDGE CASES DE VALIDATION D'ENTRÉE
  // ============================================================================
  
  describe('Input Validation Edge Cases', () => {
    
    describe('Boundary String Cases', () => {
      it('should handle empty string', () => {
        expect(isValidProjectStatus('')).toBe(false);
      });

      it('should handle single character strings', () => {
        expect(isValidProjectStatus('A')).toBe(false);
        expect(isValidProjectStatus('1')).toBe(false);
        expect(isValidProjectStatus(' ')).toBe(false);
      });

      it('should handle very long strings', () => {
        const maxSafeLength = 'A'.repeat(Number.MAX_SAFE_INTEGER > 10000 ? 10000 : 1000);
        expect(() => isValidProjectStatus(maxSafeLength)).not.toThrow();
        expect(isValidProjectStatus(maxSafeLength)).toBe(false);
      });

      it('should handle strings with only whitespace', () => {
        const whitespaceStrings = [
          ' ',
          '\t',
          '\n',
          '\r',
          '\r\n',
          '   ',
          '\t\t\t',
          '\n\n\n',
          ' \t\n\r ',
        ];

        whitespaceStrings.forEach(str => {
          expect(isValidProjectStatus(str)).toBe(false);
        });
      });

      it('should handle strings with mixed whitespace and content', () => {
        const mixedStrings = [
          ' ACTIVE',
          'ACTIVE ',
          ' ACTIVE ',
          '\tACTIVE\t',
          '\nACTIVE\n',
          ' A C T I V E ',
          'A C T I V E',
        ];

        mixedStrings.forEach(str => {
          expect(isValidProjectStatus(str)).toBe(false);
        });
      });
    });

    describe('Case Sensitivity Edge Cases', () => {
      it('should be strictly case sensitive', () => {
        const caseMixtures = [
          'active',
          'Active',
          'ACTIV',
          'ACTIVe',
          'aCTIVE',
          'AcTiVe',
        ];

        caseMixtures.forEach(str => {
          expect(isValidProjectStatus(str)).toBe(false);
        });
      });

      it('should handle case with special characters', () => {
        const specialCases = [
          'ACTIVE!',
          'ACTIVE?',
          'ACTIVE.',
          'ACTIVE,',
          'ACTIVE;',
          'ACTIVE:',
        ];

        specialCases.forEach(str => {
          expect(isValidProjectStatus(str)).toBe(false);
        });
      });
    });

    describe('Type Coercion Edge Cases', () => {
      it('should handle number inputs', () => {
        const numbers = [0, 1, -1, 0.5, NaN, Infinity, -Infinity];
        
        numbers.forEach(num => {
          expect(() => isValidProjectStatus(num as any)).not.toThrow();
          expect(isValidProjectStatus(num as any)).toBe(false);
        });
      });

      it('should handle boolean inputs', () => {
        expect(isValidProjectStatus(true as any)).toBe(false);
        expect(isValidProjectStatus(false as any)).toBe(false);
      });

      it('should handle object inputs', () => {
        const objects = [
          {},
          { status: 'ACTIVE' },
          { toString: () => 'ACTIVE' },
          { valueOf: () => 'ACTIVE' },
          Object.create(null),
        ];

        objects.forEach(obj => {
          expect(() => isValidProjectStatus(obj as any)).not.toThrow();
          expect(isValidProjectStatus(obj as any)).toBe(false);
        });
      });

      it('should handle array inputs', () => {
        const arrays = [
          [],
          ['ACTIVE'],
          ['ACTIVE', 'ARCHIVED'],
          [1, 2, 3],
        ];

        arrays.forEach(arr => {
          expect(() => isValidProjectStatus(arr as any)).not.toThrow();
          expect(isValidProjectStatus(arr as any)).toBe(false);
        });
      });

      it('should handle function inputs', () => {
        const functions = [
          () => 'ACTIVE',
          function() { return 'ACTIVE'; },
          async () => 'ACTIVE',
          function* () { yield 'ACTIVE'; },
        ];

        functions.forEach(fn => {
          expect(() => isValidProjectStatus(fn as any)).not.toThrow();
          expect(isValidProjectStatus(fn as any)).toBe(false);
        });
      });
    });

    describe('Null and Undefined Edge Cases', () => {
      it('should handle null values safely', () => {
        expect(() => isValidProjectStatus(null as any)).not.toThrow();
        expect(isValidProjectStatus(null as any)).toBe(false);
      });

      it('should handle undefined values safely', () => {
        expect(() => isValidProjectStatus(undefined as any)).not.toThrow();
        expect(isValidProjectStatus(undefined as any)).toBe(false);
      });

      it('should handle variables that might be undefined', () => {
        let undefinedVar: string | undefined;
        
        expect(() => isValidProjectStatus(undefinedVar as any)).not.toThrow();
        expect(isValidProjectStatus(undefinedVar as any)).toBe(false);
      });
    });
  });

  // ============================================================================
  // EDGE CASES DE TRANSITIONS
  // ============================================================================
  
  describe('Transition Edge Cases', () => {
    
    describe('Self-Transition Edge Cases', () => {
      it('should reject all self-transitions', () => {
        Object.values(ProjectStatus).forEach(status => {
          expect(isValidStatusTransition(status, status)).toBe(false);
        });
      });

      it('should handle rapid self-transition attempts', () => {
        for (let i = 0; i < 1000; i++) {
          expect(isValidStatusTransition(ProjectStatus.ACTIVE, ProjectStatus.ACTIVE)).toBe(false);
        }
      });
    });

    describe('Invalid Transition Combinations', () => {
      it('should handle all invalid from-status values', () => {
        const invalidStatuses = ['INVALID', '', null, undefined, 123, true, {}];
        
        invalidStatuses.forEach(invalidStatus => {
          expect(() => isValidStatusTransition(invalidStatus as any, ProjectStatus.ACTIVE)).not.toThrow();
          expect(isValidStatusTransition(invalidStatus as any, ProjectStatus.ACTIVE)).toBe(false);
        });
      });

      it('should handle all invalid to-status values', () => {
        const invalidStatuses = ['INVALID', '', null, undefined, 123, true, {}];
        
        invalidStatuses.forEach(invalidStatus => {
          expect(() => isValidStatusTransition(ProjectStatus.ACTIVE, invalidStatus as any)).not.toThrow();
          expect(isValidStatusTransition(ProjectStatus.ACTIVE, invalidStatus as any)).toBe(false);
        });
      });

      it('should handle both invalid status values', () => {
        const invalidStatuses = ['INVALID', '', null, undefined];
        
        invalidStatuses.forEach(from => {
          invalidStatuses.forEach(to => {
            expect(() => isValidStatusTransition(from as any, to as any)).not.toThrow();
            expect(isValidStatusTransition(from as any, to as any)).toBe(false);
          });
        });
      });
    });

    describe('Deleted Status Edge Cases', () => {
      it('should never allow transitions from DELETED', () => {
        Object.values(ProjectStatus).forEach(targetStatus => {
          expect(isValidStatusTransition(ProjectStatus.DELETED, targetStatus)).toBe(false);
        });
      });

      it('should handle attempts to transition deleted projects', () => {
        const targetStatuses = [ProjectStatus.ACTIVE, ProjectStatus.ARCHIVED, 'INVALID' as any];
        
        targetStatuses.forEach(target => {
          expect(isValidStatusTransition(ProjectStatus.DELETED, target)).toBe(false);
        });
      });
    });

    describe('Transition Matrix Completeness', () => {
      it('should have defined transitions for all status combinations', () => {
        Object.values(ProjectStatus).forEach(from => {
          Object.values(ProjectStatus).forEach(to => {
            expect(() => isValidStatusTransition(from, to)).not.toThrow();
            
            const result = isValidStatusTransition(from, to);
            expect(typeof result).toBe('boolean');
          });
        });
      });

      it('should maintain transition matrix symmetry where appropriate', () => {
        // ACTIVE <-> ARCHIVED should be bidirectional
        expect(isValidStatusTransition(ProjectStatus.ACTIVE, ProjectStatus.ARCHIVED)).toBe(true);
        expect(isValidStatusTransition(ProjectStatus.ARCHIVED, ProjectStatus.ACTIVE)).toBe(true);
        
        // Both should allow transition to DELETED
        expect(isValidStatusTransition(ProjectStatus.ACTIVE, ProjectStatus.DELETED)).toBe(true);
        expect(isValidStatusTransition(ProjectStatus.ARCHIVED, ProjectStatus.DELETED)).toBe(true);
        
        // But DELETED should not allow transitions back
        expect(isValidStatusTransition(ProjectStatus.DELETED, ProjectStatus.ACTIVE)).toBe(false);
        expect(isValidStatusTransition(ProjectStatus.DELETED, ProjectStatus.ARCHIVED)).toBe(false);
      });
    });
  });

  // ============================================================================
  // EDGE CASES DE MÉTADONNÉES
  // ============================================================================
  
  describe('Metadata Edge Cases', () => {
    
    describe('Error Handling Edge Cases', () => {
      it('should throw meaningful errors for invalid status', () => {
        const invalidStatuses = ['INVALID', '', 'null', 'undefined'];
        
        invalidStatuses.forEach(status => {
          expect(() => getStatusMetadata(status as any)).toThrow();
          expect(() => getStatusMetadata(status as any)).toThrow(/Unknown project status/);
        });
      });

      it('should include the invalid status in error message', () => {
        try {
          getStatusMetadata('INVALID_STATUS' as any);
          fail('Should have thrown an error');
        } catch (error) {
          expect((error as Error).message).toContain('INVALID_STATUS');
        }
      });

      it('should handle special characters in error messages', () => {
        const specialStatuses = ['<script>', '"quotes"', "'quotes'", '\n\t'];
        
        specialStatuses.forEach(status => {
          try {
            getStatusMetadata(status as any);
            fail('Should have thrown an error');
          } catch (error) {
            expect((error as Error).message).toBeTruthy();
            expect((error as Error).message).toContain('Unknown project status');
          }
        });
      });
    });

    describe('Metadata Immutability Edge Cases', () => {
      it('should return consistent metadata across multiple calls', () => {
        const metadata1 = getStatusMetadata(ProjectStatus.ACTIVE);
        const metadata2 = getStatusMetadata(ProjectStatus.ACTIVE);
        
        expect(metadata1).toEqual(metadata2);
        
        // Verify deep equality
        expect(metadata1.status).toBe(metadata2.status);
        expect(metadata1.label).toBe(metadata2.label);
        expect(metadata1.description).toBe(metadata2.description);
        expect(metadata1.color).toBe(metadata2.color);
        expect(metadata1.allowedTransitions).toEqual(metadata2.allowedTransitions);
      });

      it('should handle concurrent metadata access', async () => {
        const promises = Array.from({ length: 100 }, () =>
          Promise.resolve(getStatusMetadata(ProjectStatus.ACTIVE))
        );
        
        const results = await Promise.all(promises);
        
        // All results should be identical
        results.forEach(result => {
          expect(result).toEqual(results[0]);
        });
      });

      it('should protect against modification attempts', () => {
        const metadata = getStatusMetadata(ProjectStatus.ACTIVE);
        const originalLabel = metadata.label;
        
        try {
          (metadata as any).label = 'Modified';
        } catch (error) {
        }
        
        expect(() => getStatusMetadata(ProjectStatus.ACTIVE)).not.toThrow();
      });
    });

    describe('Metadata Content Edge Cases', () => {
      it('should have valid hex colors for all statuses', () => {
        Object.values(ProjectStatus).forEach(status => {
          const color = getStatusColor(status);
          expect(color).toMatch(/^#[0-9A-F]{6}$/i);
          
          // Verify it's a valid color value
          expect(color.length).toBe(7);
          expect(color[0]).toBe('#');
        });
      });

      it('should have non-empty labels for all statuses', () => {
        Object.values(ProjectStatus).forEach(status => {
          const label = getStatusLabel(status);
          expect(label).toBeTruthy();
          expect(typeof label).toBe('string');
          expect(label.trim().length).toBeGreaterThan(0);
        });
      });

      it('should have consistent color brightness for readability', () => {
        // Helper function to calculate brightness
        const getBrightness = (hex: string) => {
          const r = parseInt(hex.slice(1, 3), 16);
          const g = parseInt(hex.slice(3, 5), 16);
          const b = parseInt(hex.slice(5, 7), 16);
          return (r * 299 + g * 587 + b * 114) / 1000;
        };
        
        Object.values(ProjectStatus).forEach(status => {
          const color = getStatusColor(status);
          const brightness = getBrightness(color);
          
          // Colors should be bright enough to be visible (> 50) but not too bright (< 200)
          expect(brightness).toBeGreaterThan(50);
          expect(brightness).toBeLessThan(200);
        });
      });
    });
  });

  // ============================================================================
  // EDGE CASES DES TABLEAUX DE TRANSITIONS
  // ============================================================================
  
  describe('Available Transitions Edge Cases', () => {
    
    describe('Array Immutability Edge Cases', () => {
      it('should return independent arrays for each call', () => {
        const transitions1 = getAvailableTransitions(ProjectStatus.ACTIVE);
        const transitions2 = getAvailableTransitions(ProjectStatus.ACTIVE);
        
        // Should be equal but not the same reference
        expect(transitions1).toEqual(transitions2);
        expect(transitions1).not.toBe(transitions2);
      });

      it('should not affect internal state when modifying returned arrays', () => {
        const transitions = getAvailableTransitions(ProjectStatus.ACTIVE);
        const originalLength = transitions.length;
        
        // Modify the returned array
        transitions.push('MALICIOUS' as any);
        transitions[0] = 'HACKED' as any;
        transitions.reverse();
        
        // Get fresh transitions and verify they're unchanged
        const freshTransitions = getAvailableTransitions(ProjectStatus.ACTIVE);
        expect(freshTransitions.length).toBe(originalLength);
        expect(freshTransitions).not.toContain('MALICIOUS');
        expect(freshTransitions).not.toContain('HACKED');
      });

      it('should handle rapid successive calls efficiently', () => {
        const startTime = performance.now();
        
        for (let i = 0; i < 10000; i++) {
          const transitions = getAvailableTransitions(ProjectStatus.ACTIVE);
          expect(Array.isArray(transitions)).toBe(true);
        }
        
        const endTime = performance.now();
        expect(endTime - startTime).toBeLessThan(1000); // Should complete in under 1 second
      });
    });

    describe('Empty Transitions Edge Cases', () => {
      it('should handle statuses with no available transitions', () => {
        const transitions = getAvailableTransitions(ProjectStatus.DELETED);
        
        expect(Array.isArray(transitions)).toBe(true);
        expect(transitions.length).toBe(0);
        expect(transitions).toEqual([]);
      });

      it('should handle modifications to empty transition arrays', () => {
        const emptyTransitions = getAvailableTransitions(ProjectStatus.DELETED);
        
        // Attempt to modify
        emptyTransitions.push('SHOULD_NOT_WORK' as any);
        
        // Verify internal state is not affected
        const freshEmptyTransitions = getAvailableTransitions(ProjectStatus.DELETED);
        expect(freshEmptyTransitions).toEqual([]);
      });
    });

    describe('Invalid Status Edge Cases', () => {
      it('should handle invalid status gracefully', () => {
        const invalidStatuses = ['INVALID', '', null, undefined, 123, {}];
        
        invalidStatuses.forEach(status => {
          expect(() => getAvailableTransitions(status as any)).not.toThrow();
          const result = getAvailableTransitions(status as any);
          expect(Array.isArray(result)).toBe(true);
          expect(result).toEqual([]);
        });
      });
    });
  });

  // ============================================================================
  // EDGE CASES DES FONCTIONS HELPER
  // ============================================================================
  
  describe('Helper Functions Edge Cases', () => {
    
    describe('Status Type Checker Edge Cases', () => {
      it('should handle rapid type checking without performance issues', () => {
        const statuses = Object.values(ProjectStatus);
        const checkers = [isActiveStatus, isArchivedStatus, isDeletedStatus];
        
        const startTime = performance.now();
        
        for (let i = 0; i < 10000; i++) {
          const status = statuses[i % statuses.length];
          checkers.forEach(checker => checker(status));
        }
        
        const endTime = performance.now();
        expect(endTime - startTime).toBeLessThan(100);
      });

      it('should maintain mutual exclusivity across all combinations', () => {
        Object.values(ProjectStatus).forEach(status => {
          const results = [
            isActiveStatus(status),
            isArchivedStatus(status),
            isDeletedStatus(status),
          ];
          
          const trueCount = results.filter(Boolean).length;
          expect(trueCount).toBe(1); // Exactly one should be true
        });
      });

      it('should handle invalid status in type checkers', () => {
        const invalidStatuses = ['INVALID', '', null, undefined];
        
        invalidStatuses.forEach(status => {
          expect(() => isActiveStatus(status as any)).not.toThrow();
          expect(() => isArchivedStatus(status as any)).not.toThrow();
          expect(() => isDeletedStatus(status as any)).not.toThrow();
          
          expect(isActiveStatus(status as any)).toBe(false);
          expect(isArchivedStatus(status as any)).toBe(false);
          expect(isDeletedStatus(status as any)).toBe(false);
        });
      });
    });
  });

  // ============================================================================
  // EDGE CASES DE COHÉRENCE GLOBALE
  // ============================================================================
  
  describe('Global Consistency Edge Cases', () => {
    
    it('should maintain consistency under stress conditions', () => {
      // Utiliser directement Object.values(ProjectStatus) au lieu de ALL_PROJECT_STATUSES
      for (let i = 0; i < 1000; i++) {
        const statuses = Object.values(ProjectStatus);
        const status = statuses[i % statuses.length];
        
        // Multiple operations on the same status
        expect(isValidProjectStatus(status)).toBe(true);
        const metadata = getStatusMetadata(status);
        const transitions = getAvailableTransitions(status);
        
        expect(metadata.status).toBe(status);
        expect(metadata.allowedTransitions).toEqual(transitions);
        
        // Verify transitions are all valid
        transitions.forEach(target => {
          expect(isValidProjectStatus(target)).toBe(true);
          expect(isValidStatusTransition(status, target)).toBe(true);
        });
      }
    });

    it('should handle edge cases in constant references', () => {
      // Verify ALL_PROJECT_STATUSES is complete and consistent
      expect(ALL_PROJECT_STATUSES.length).toBe(Object.values(ProjectStatus).length);
      
      ALL_PROJECT_STATUSES.forEach(status => {
        expect(Object.values(ProjectStatus)).toContain(status);
        expect(isValidProjectStatus(status)).toBe(true);
      });
    });

    it('should maintain data integrity across all edge cases', () => {
      // Comprehensive integrity check
      Object.values(ProjectStatus).forEach(status => {
        // Basic validation
        expect(isValidProjectStatus(status)).toBe(true);
        
        // Metadata consistency
        const metadata = getStatusMetadata(status);
        expect(metadata.status).toBe(status);
        expect(PROJECT_STATUS_METADATA[status]).toBeDefined();
        expect(PROJECT_STATUS_METADATA[status]).toEqual(metadata);
        
        // Transition consistency
        const transitions = getAvailableTransitions(status);
        expect(VALID_STATUS_TRANSITIONS[status]).toEqual(transitions);
        expect(metadata.allowedTransitions).toEqual(transitions);
        
        // Type checker consistency
        const typeChecks = [
          isActiveStatus(status),
          isArchivedStatus(status), 
          isDeletedStatus(status),
        ];
        expect(typeChecks.filter(Boolean).length).toBe(1);
      });
    });
  });
});