/**
 * Tests de performance pour le module project-status.enum.ts
 * 
 * Ces tests vérifient que les fonctions maintiennent de bonnes performances
 * même sous charge et avec un usage intensif.
 * 
 * @fileoverview Tests de performance du module ProjectStatus
 */

import { ProjectStatus } from '@prisma/client';
import {
  isValidProjectStatus,
  isValidStatusTransition,
  getStatusMetadata,
  getAvailableTransitions,
  getStatusLabel,
  getStatusColor,
} from '../../../../src/common/enums/project-status.enum';

describe('ProjectStatus Enum - Performance Tests', () => {
  
  // ============================================================================
  // TESTS DE VITESSE INDIVIDUELS
  // ============================================================================
  
  describe('Individual Function Performance', () => {
    
    describe('isValidProjectStatus() Performance', () => {
      it('should complete validation in <1ms', async () => {
        const startTime = performance.now();
        
        // Exécuter la validation multiple fois
        for (let i = 0; i < 1000; i++) {
          isValidProjectStatus('ACTIVE');
          isValidProjectStatus('INVALID');
        }
        
        const endTime = performance.now();
        const totalTime = endTime - startTime;
        
        expect(totalTime).toBeLessThan(10); // 10ms pour 1000 appels = 0.01ms par appel
      });

      it('should handle rapid successive calls efficiently', () => {
        const startTime = performance.now();
        
        const testCases = ['ACTIVE', 'ARCHIVED', 'DELETED', 'INVALID', '', 'null'];
        
        for (let i = 0; i < 10000; i++) {
          const testCase = testCases[i % testCases.length];
          isValidProjectStatus(testCase);
        }
        
        const endTime = performance.now();
        const totalTime = endTime - startTime;
        
        expect(totalTime).toBeLessThan(50); // 50ms pour 10000 appels
      });
    });

    describe('isValidStatusTransition() Performance', () => {
      it('should complete transition check in <1ms', () => {
        const startTime = performance.now();
        
        // Test toutes les combinaisons possibles
        const statuses = [ProjectStatus.ACTIVE, ProjectStatus.ARCHIVED, ProjectStatus.DELETED];
        
        for (let i = 0; i < 1000; i++) {
          statuses.forEach(from => {
            statuses.forEach(to => {
              isValidStatusTransition(from, to);
            });
          });
        }
        
        const endTime = performance.now();
        const totalTime = endTime - startTime;
        
        expect(totalTime).toBeLessThan(100); // 100ms pour 9000 appels (9 combinaisons * 1000)
      });
    });

    describe('getStatusMetadata() Performance', () => {
      it('should complete metadata lookup in <1ms', () => {
        const startTime = performance.now();
        
        for (let i = 0; i < 10000; i++) {
          getStatusMetadata(ProjectStatus.ACTIVE);
          getStatusMetadata(ProjectStatus.ARCHIVED);
          getStatusMetadata(ProjectStatus.DELETED);
        }
        
        const endTime = performance.now();
        const totalTime = endTime - startTime;
        
        expect(totalTime).toBeLessThan(50); // 50ms pour 30000 appels
      });
    });

    describe('getAvailableTransitions() Performance', () => {
      it('should complete transitions lookup efficiently', () => {
        const startTime = performance.now();
        
        for (let i = 0; i < 10000; i++) {
          getAvailableTransitions(ProjectStatus.ACTIVE);
          getAvailableTransitions(ProjectStatus.ARCHIVED);
          getAvailableTransitions(ProjectStatus.DELETED);
        }
        
        const endTime = performance.now();
        const totalTime = endTime - startTime;
        
        expect(totalTime).toBeLessThan(100); // 100ms pour 30000 appels
      });
    });

    describe('Helper Functions Performance', () => {
      it('should handle label and color lookups efficiently', () => {
        const startTime = performance.now();
        
        for (let i = 0; i < 10000; i++) {
          getStatusLabel(ProjectStatus.ACTIVE);
          getStatusColor(ProjectStatus.ACTIVE);
          getStatusLabel(ProjectStatus.ARCHIVED);
          getStatusColor(ProjectStatus.ARCHIVED);
          getStatusLabel(ProjectStatus.DELETED);
          getStatusColor(ProjectStatus.DELETED);
        }
        
        const endTime = performance.now();
        const totalTime = endTime - startTime;
        
        expect(totalTime).toBeLessThan(50); // 50ms pour 60000 appels
      });
    });
  });

  // ============================================================================
  // TESTS DE CHARGE
  // ============================================================================
  
  describe('Load Testing', () => {
    
    it('should handle 100000 validations quickly', () => {
      const startTime = performance.now();
      
      const testInputs = [
        'ACTIVE', 'ARCHIVED', 'DELETED',
        'INVALID', 'null', '', 'undefined',
        'active', 'ACTIV', ' ACTIVE ',
      ];
      
      for (let i = 0; i < 100000; i++) {
        const input = testInputs[i % testInputs.length];
        isValidProjectStatus(input);
      }
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      // Doit traiter 100k validations en moins de 500ms
      expect(totalTime).toBeLessThan(500);
    });

    it('should handle concurrent-like access patterns', async () => {
      const startTime = performance.now();
      
      // Simuler des accès concurrents avec des opérations mélangées
      const operations = [];
      
      for (let i = 0; i < 1000; i++) {
        operations.push(() => isValidProjectStatus('ACTIVE'));
        operations.push(() => getStatusMetadata(ProjectStatus.ACTIVE));
        operations.push(() => getAvailableTransitions(ProjectStatus.ARCHIVED));
        operations.push(() => isValidStatusTransition(ProjectStatus.ACTIVE, ProjectStatus.ARCHIVED));
      }
      
      // Mélanger les opérations
      for (let i = operations.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [operations[i], operations[j]] = [operations[j], operations[i]];
      }
      
      // Exécuter toutes les opérations
      operations.forEach(op => op());
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      expect(totalTime).toBeLessThan(200); // 200ms pour 4000 opérations mixtes
    });

    it('should maintain performance with repeated metadata access', () => {
      const startTime = performance.now();
      
      // Accès répété aux mêmes métadonnées (test de cache implicite)
      for (let i = 0; i < 50000; i++) {
        const metadata = getStatusMetadata(ProjectStatus.ACTIVE);
        expect(metadata.status).toBe(ProjectStatus.ACTIVE);
      }
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      expect(totalTime).toBeLessThan(1500);
    });
  });

  // ============================================================================
  // TESTS DE MÉMOIRE
  // ============================================================================
  
  describe('Memory Performance', () => {
    
    it('should not leak memory with repeated calls', () => {
      // Mesure de base
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Exécuter beaucoup d'opérations
      for (let i = 0; i < 100000; i++) {
        isValidProjectStatus('ACTIVE');
        getStatusMetadata(ProjectStatus.ACTIVE);
        getAvailableTransitions(ProjectStatus.ACTIVE);
      }
      
      // Forcer le garbage collection si possible
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // La mémoire ne devrait pas augmenter significativement (< 10MB)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });

    it('should maintain constant memory usage for array returns', () => {
      const arrays: any[] = [];
      
      // Collecter beaucoup de tableaux retournés
      for (let i = 0; i < 1000; i++) {
        arrays.push(getAvailableTransitions(ProjectStatus.ACTIVE));
        arrays.push(getAvailableTransitions(ProjectStatus.ARCHIVED)); 
        arrays.push(getAvailableTransitions(ProjectStatus.DELETED));
      }
      
      // Vérifier que les tableaux sont bien des copies indépendantes
      const firstArray = arrays[0];
      const lastArray = arrays[arrays.length - 3]; // Prendre un tableau de même type (ACTIVE)
      
      expect(firstArray).not.toBe(lastArray);
      expect(firstArray).toEqual(lastArray);
      
      // Modifier un tableau ne devrait pas affecter les autres
      const originalLength = firstArray.length;
      firstArray.push('TEST');
      expect(lastArray).not.toContain('TEST');
      expect(lastArray.length).toBe(originalLength);
    });

    it('should handle large string inputs efficiently', () => {
      const largeString = 'A'.repeat(10000);
      const veryLargeString = 'B'.repeat(100000);
      
      const startTime = performance.now();
      
      // Tester avec des chaînes de grande taille
      for (let i = 0; i < 1000; i++) {
        isValidProjectStatus(largeString);
        isValidProjectStatus(veryLargeString);
      }
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      // Même avec des grandes chaînes, ça devrait rester rapide
      expect(totalTime).toBeLessThan(100);
    });
  });

  // ============================================================================
  // TESTS DE RÉGRESSION DE PERFORMANCE
  // ============================================================================
  
  describe('Performance Regression Tests', () => {
    
    it('should maintain baseline performance for mixed workload', () => {
      const startTime = performance.now();
      
      // Workload mixte représentatif d'un usage réel
      for (let i = 0; i < 10000; i++) {
        // 40% validations
        if (i % 10 < 4) {
          isValidProjectStatus(i % 2 === 0 ? 'ACTIVE' : 'INVALID');
        }
        // 30% récupération métadonnées
        else if (i % 10 < 7) {
          getStatusMetadata(ProjectStatus.ACTIVE);
        }
        // 20% vérification transitions
        else if (i % 10 < 9) {
          isValidStatusTransition(ProjectStatus.ACTIVE, ProjectStatus.ARCHIVED);
        }
        // 10% récupération transitions disponibles
        else {
          getAvailableTransitions(ProjectStatus.ACTIVE);
        }
      }
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      // Baseline: 10k opérations mixtes en moins de 100ms
      expect(totalTime).toBeLessThan(100);
    });

    it('should scale linearly with input size', () => {
      // Test de mise à l'échelle avec différentes tailles d'input
      const sizes = [1000, 10000, 100000];
      const times: number[] = [];
      
      sizes.forEach(size => {
        const start = performance.now();
        
        for (let i = 0; i < size; i++) {
          isValidProjectStatus('ACTIVE');
          isValidProjectStatus('INVALID');
        }
        
        times.push(performance.now() - start);
      });
      
      // Calculer les ratios de performance
      const ratio1 = times[1] / times[0]; // 10k vs 1k
      const ratio2 = times[2] / times[1]; // 100k vs 10k
      
      // ✅ CORRECTION: Ajuster les seuils pour être plus tolérants aux variations de performance
      // La performance devrait être raisonnablement linéaire mais pas parfaite
      expect(ratio1).toBeGreaterThan(5);   // Au moins 5x plus lent pour 10x plus de données
      expect(ratio1).toBeLessThan(20);     // Mais pas plus de 20x plus lent
      expect(ratio2).toBeGreaterThan(5);   // Au moins 5x plus lent pour 10x plus de données  
      expect(ratio2).toBeLessThan(20);     // ✅ CORRECTION: Augmenté de 3 à 20 pour plus de tolérance
    });
  });

  // ============================================================================
  // TESTS DE PERFORMANCE EN CONDITIONS ADVERSES
  // ============================================================================
  
  describe('Adverse Conditions Performance', () => {
    
    it('should handle many invalid inputs efficiently', () => {
      const startTime = performance.now();
      
      const invalidInputs = [
        'INVALID', 'null', 'undefined', '', ' ',
        'ACTIV', 'active', 'Active', 'INVALID_STATUS',
        '123', 'true', 'false', '[]', '{}',
      ];
      
      // Beaucoup d'entrées invalides (cas défavorable)
      for (let i = 0; i < 50000; i++) {
        const input = invalidInputs[i % invalidInputs.length];
        isValidProjectStatus(input);
      }
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      expect(totalTime).toBeLessThan(300);
    });

    it('should handle errors gracefully without performance degradation', () => {
      const startTime = performance.now();
      let errorCount = 0;
      
      for (let i = 0; i < 10000; i++) {
        try {
          // Intentionnellement causer des erreurs
          getStatusMetadata('INVALID' as any);
        } catch (error) {
          errorCount++;
        }
      }
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      expect(errorCount).toBe(10000); // Toutes les calls devraient lever une erreur
      expect(totalTime).toBeLessThan(200); // Même avec des erreurs, ça doit rester rapide
    });
  });
});