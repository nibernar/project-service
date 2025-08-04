// test/setup/performance-global-setup.js

const fs = require('fs');
const path = require('path');
const os = require('os');

module.exports = async () => {
  console.log('🚀 Initialisation des tests de performance...');
  
  if (typeof global.gc === 'function') {
    console.log('✅ Garbage collection manuelle disponible');
    global.gc();
  } else {
    console.log('⚠️  Garbage collection manuelle non disponible (utilisez --expose-gc)');
  }
  
  const memoryUsage = process.memoryUsage();
  console.log('💾 Utilisation mémoire initiale:');
  console.log(`   Heap utilisé: ${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`);
  console.log(`   Heap total: ${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`);
  console.log(`   RSS: ${Math.round(memoryUsage.rss / 1024 / 1024)}MB`);
  
  console.log('🖥️  Informations système:');
  console.log(`   CPU: ${os.cpus()[0].model} (${os.cpus().length} cores)`);
  console.log(`   Mémoire totale: ${Math.round(os.totalmem() / 1024 / 1024 / 1024)}GB`);
  console.log(`   Mémoire libre: ${Math.round(os.freemem() / 1024 / 1024 / 1024)}GB`);
  console.log(`   OS: ${os.type()} ${os.release()}`);
  console.log(`   Node.js: ${process.version}`);
  
  const performanceDir = path.join(process.cwd(), 'test-results', 'performance');
  if (!fs.existsSync(performanceDir)) {
    fs.mkdirSync(performanceDir, { recursive: true });
    console.log(`📁 Répertoire de performance créé: ${performanceDir}`);
  }
  
  const systemMetrics = {
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    platform: os.platform(),
    arch: os.arch(),
    cpuCount: os.cpus().length,
    totalMemory: os.totalmem(),
    freeMemory: os.freemem(),
    initialHeapUsed: memoryUsage.heapUsed,
    initialHeapTotal: memoryUsage.heapTotal,
    initialRSS: memoryUsage.rss,
  };
  
  const metricsFile = path.join(performanceDir, 'system-metrics.json');
  fs.writeFileSync(metricsFile, JSON.stringify(systemMetrics, null, 2));
  console.log(`📊 Métriques système sauvegardées: ${metricsFile}`);
  
  if (global.jasmine) {
    global.jasmine.DEFAULT_TIMEOUT_INTERVAL = 60000;
  }
  
  global.__PERFORMANCE_START_TIME__ = Date.now();
  global.__INITIAL_MEMORY_USAGE__ = memoryUsage;
  global.__PERFORMANCE_METRICS__ = [];
  
  global.recordPerformanceMetric = function(type, value, metadata = {}) {
    if (!global.__PERFORMANCE_METRICS__) {
      global.__PERFORMANCE_METRICS__ = [];
    }
    
    global.__PERFORMANCE_METRICS__.push({
      timestamp: Date.now(),
      type,
      value,
      metadata,
    });
  };

  global.measureAndRecord = function(name, fn, iterations = 1) {
    const startTime = process.hrtime.bigint();
    
    for (let i = 0; i < iterations; i++) {
      fn();
    }
    
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1000000;
    const avgDuration = duration / iterations;
    
    global.recordPerformanceMetric('execution-time', avgDuration, {
      name,
      iterations,
      totalDuration: duration,
    });
    
    return avgDuration;
  };

  global.measureMemoryUsage = function(name, fn) {
    if (global.gc) {
      global.gc();
    }
    
    const beforeMemory = process.memoryUsage();
    fn();
    const afterMemory = process.memoryUsage();
    
    const memoryDiff = {
      heapUsed: afterMemory.heapUsed - beforeMemory.heapUsed,
      heapTotal: afterMemory.heapTotal - beforeMemory.heapTotal,
      rss: afterMemory.rss - beforeMemory.rss,
      external: afterMemory.external - beforeMemory.external,
    };
    
    global.recordPerformanceMetric('memory-usage', memoryDiff.heapUsed, {
      name,
      fullDiff: memoryDiff,
      beforeMemory,
      afterMemory,
    });
    
    return memoryDiff;
  };
  
  console.log('✅ Configuration des tests de performance terminée\n');
};