// benchmark.js
// Save this file

const perf_hooks = require('perf_hooks');
global.performance = perf_hooks.performance;

class FloatPerformanceTest {
  constructor() {
    this.ITERATIONS = 1000000;
    this.TEST_VALUES = [0, 1, -1, Math.PI, 1e-20, 1e20, Infinity, -Infinity, NaN];
  }

  // Approach 1: Direct bit manipulation
  createBitwiseFloat(value, expWidth, mantWidth) {
    const f64 = new Float64Array(1);
    f64[0] = value;
    const bits = new BigInt64Array(f64.buffer)[0];
    
    const sign = bits >> 63n;
    const exp = ((bits >> 52n) & 0x7FFn) - 1023n;
    const mant = bits & ((1n << 52n) - 1n);
    
    const maxExp = (1n << BigInt(expWidth)) - 1n;
    const mantMask = (1n << BigInt(mantWidth)) - 1n;
    
    if (exp > maxExp) return sign ? -Infinity : Infinity;
    if (exp < -maxExp) return sign ? -0 : 0;
    
    const adjustedMant = mant >> BigInt(52 - mantWidth);
    const adjustedExp = exp + BigInt((1 << (expWidth - 1)) - 1);
    
    return {
      sign: Number(sign),
      exponent: Number(adjustedExp),
      mantissa: Number(adjustedMant)
    };
  }

  // Approach 2: Float64Array with caching
  createCachedFloat() {
    const cache = new Map();
    return (value, expWidth, mantWidth) => {
      const key = `${value}_${expWidth}_${mantWidth}`;
      if (cache.has(key)) return cache.get(key);
      
      const result = this.createBitwiseFloat(value, expWidth, mantWidth);
      cache.set(key, result);
      return result;
    };
  }

  // Test harness
  async runBenchmark() {
    console.log('Starting benchmark...');
    
    // Warm up V8 optimizer
    for (let i = 0; i < 1000; i++) {
      this.createBitwiseFloat(Math.PI, 11, 52);
    }

    const results = {
      bitwise: await this.benchmarkBitwise(),
      cached: await this.benchmarkCached()
    };

    console.log('Results (operations/sec):');
    console.log(`Bitwise: ${results.bitwise.toFixed(2)}`);
    console.log(`Cached:  ${results.cached.toFixed(2)}`);
    
    return results;
  }

  async benchmarkBitwise() {
    const start = performance.now();
    
    for (let i = 0; i < this.ITERATIONS; i++) {
      const value = this.TEST_VALUES[i % this.TEST_VALUES.length];
      const expWidth = (i % 11) + 1; // 1-11 bits
      const mantWidth = (i % 52); // 0-51 bits
      this.createBitwiseFloat(value, expWidth, mantWidth);
    }
    
    return this.ITERATIONS / ((performance.now() - start) / 1000);
  }

  async benchmarkCached() {
    const cachedFloat = this.createCachedFloat();
    const start = performance.now();
    
    for (let i = 0; i < this.ITERATIONS; i++) {
      const value = this.TEST_VALUES[i % this.TEST_VALUES.length];
      const expWidth = (i % 11) + 1;
      const mantWidth = (i % 52);
      cachedFloat(value, expWidth, mantWidth);
    }
    
    return this.ITERATIONS / ((performance.now() - start) / 1000);
  }
}

// Run benchmark
const test = new FloatPerformanceTest();
test.runBenchmark().then(results => {
  // Analyze memory usage
  if (typeof process !== 'undefined' && process.memoryUsage) {
    console.log('Memory usage:', process.memoryUsage());
  }
});

// Run benchmark and log results
async function runTests() {
  const test = new FloatPerformanceTest();
  const results = await test.runBenchmark();
  
  // Log memory stats
  const memUsage = process.memoryUsage();
  console.log('\nMemory Usage:');
  for (let key in memUsage) {
    console.log(`${key}: ${Math.round(memUsage[key] / 1024 / 1024 * 100) / 100} MB`);
  }
}

runTests();