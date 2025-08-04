// test/setup/performance-global-teardown.js

const fs = require('fs');
const path = require('path');

module.exports = async () => {
  console.log('\n🏁 Finalisation des tests de performance...');
  
  const endTime = Date.now();
  const startTime = global.__PERFORMANCE_START_TIME__ || endTime;
  const totalDuration = endTime - startTime;
  
  const finalMemoryUsage = process.memoryUsage();
  const initialMemoryUsage = global.__INITIAL_MEMORY_USAGE__ || finalMemoryUsage;
  
  console.log('📊 Métriques finales:');
  console.log(`   Durée totale: ${totalDuration}ms`);
  console.log(`   Heap final: ${Math.round(finalMemoryUsage.heapUsed / 1024 / 1024)}MB`);
  console.log(`   Différence heap: ${Math.round((finalMemoryUsage.heapUsed - initialMemoryUsage.heapUsed) / 1024 / 1024)}MB`);
  
  if (typeof global.gc === 'function') {
    console.log('🧹 Nettoyage final de la mémoire...');
    global.gc();
    
    const afterGCMemory = process.memoryUsage();
    console.log(`   Heap après GC: ${Math.round(afterGCMemory.heapUsed / 1024 / 1024)}MB`);
  }
  
  const performanceDir = path.join(process.cwd(), 'test-results', 'performance');
  const performanceMetrics = global.__PERFORMANCE_METRICS__ || [];
  
  const finalReport = {
    summary: {
      startTime: new Date(startTime).toISOString(),
      endTime: new Date(endTime).toISOString(),
      totalDuration,
      initialMemory: initialMemoryUsage,
      finalMemory: finalMemoryUsage,
      memoryDifference: {
        heapUsed: finalMemoryUsage.heapUsed - initialMemoryUsage.heapUsed,
        heapTotal: finalMemoryUsage.heapTotal - initialMemoryUsage.heapTotal,
        rss: finalMemoryUsage.rss - initialMemoryUsage.rss,
      },
    },
    metrics: performanceMetrics,
  };
  
  const reportFile = path.join(performanceDir, 'performance-report.json');
  fs.writeFileSync(reportFile, JSON.stringify(finalReport, null, 2));
  console.log(`📋 Rapport de performance sauvegardé: ${reportFile}`);
  
  console.log('✅ Finalisation des tests de performance terminée');
};