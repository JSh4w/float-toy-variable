const FloatXX = (function() {
    'use strict';
    
    // Pre-compute constants used in calculations
    const LOG2E = Math.LOG2E;
    const POW2_ARR = new Float64Array(2048); // Pre-computed powers of 2
    for (let i = 0; i < 2048; i++) {
      POW2_ARR[i] = Math.pow(2, i - 1024);
    }
  
    // Utility function to get power of 2 from pre-computed array
    const getPow2 = (exp) => POW2_ARR[exp + 1024] || (exp >= 1024 ? Infinity : 0);
  
    // Constants for bit manipulation
    const SIGN_BIT = 63n;
    const BIGINT_ZERO = 0n;
    const BIGINT_ONE = 1n;
  
    class VariableFloatArray {
      constructor(length, expWidth, mantWidth) {
        // Validate input parameters
        if (expWidth <= 0 || mantWidth <= 0 || length <= 0) {
          throw new Error('Invalid parameters');
        }
  
        this.expWidth = expWidth;
        this.mantWidth = mantWidth;
        this.length = length;
        
        // Pre-compute masks and constants
        this.expMask = (BIGINT_ONE << BigInt(expWidth)) - BIGINT_ONE;
        this.mantMask = (BIGINT_ONE << BigInt(mantWidth)) - BIGINT_ONE;
        this.expBias = (BIGINT_ONE << BigInt(expWidth - 1)) - BIGINT_ONE;
        
        // Pre-compute bit shifts
        this.mantShift = BigInt(63 - expWidth - mantWidth);
        this.expShift = BigInt(63 - expWidth);
        
        // Create underlying storage
        this.storage = new Float64Array(length);
        this.bits = new BigInt64Array(this.storage.buffer);
        
        // Cache common values
        this.maxExp = Number(this.expBias);
        this.minExp = -this.maxExp + 1;
        this.mantScale = 2 ** mantWidth;
      }
  
      set(index, value) {
        if (index < 0 || index >= this.length) {
          return;
        }
  
        // Fast path for special values
        if (value === 0) {
          this.storage[index] = Object.is(value, -0) ? -0 : 0;
          return;
        }
        
        if (!Number.isFinite(value)) {
          this.storage[index] = value;
          return;
        }
  
        // Extract sign and handle negative values
        const sign = value < 0 ? BIGINT_ONE : BIGINT_ZERO;
        value = Math.abs(value);
  
        // Calculate exponent using natural log for better precision
        const exp = Math.floor(Math.log(value) * LOG2E);
        let mant = value * getPow2(-exp);
  
        // Normalize mantissa to [1,2) with minimal branching
        const adjust = mant >= 2.0 ? 1 : 0;
        mant *= getPow2(-adjust);
        const finalExp = exp + adjust;
  
        // Handle range limits with early returns
        if (finalExp < this.minExp) {
          this.storage[index] = sign ? -0 : 0;
          return;
        }
        if (finalExp > this.maxExp) {
          this.storage[index] = sign ? -Infinity : Infinity;
          return;
        }
  
        // Convert to fixed-point and pack bits
        const expBits = BigInt(finalExp + Number(this.expBias));
        const mantBits = BigInt(Math.floor((mant - 1.0) * this.mantScale));
  
        // Combine all components with minimal operations
        this.bits[index] = (sign << SIGN_BIT) | 
                          (expBits << this.expShift) |
                          (mantBits & this.mantMask);
      }
  
      get(index) {
        if (!Number.isFinite(this.storage[index])) {
          return this.storage[index];
        }
  
        const bits = this.bits[index];
        const sign = (bits >> SIGN_BIT) & BIGINT_ONE;
        const exp = ((bits >> this.expShift) & this.expMask) - this.expBias;
        const mant = bits & this.mantMask;
  
        // Fast path for zero
        if (exp === -this.expBias && mant === BIGINT_ZERO) {
          return sign ? -0 : 0;
        }
  
        // Compute value using pre-calculated constants
        const value = (1 + Number(mant) / this.mantScale) * getPow2(Number(exp));
        return sign ? -value : value;
      }
    }
  
    // Test bench implementation with performance monitoring
    class TestBench {
      constructor(iterations = 1000000) {
        this.ITERATIONS = iterations;
        this.TEST_VALUES = Object.freeze([
          0, 1, -1, Math.PI, 1e-20, 1e20, 
          Infinity, -Infinity, NaN
        ]);
      }
  
      async runBenchmark() {
        console.log('Starting optimized Variable Float benchmark...');
        
        const configs = [
          { exp: 5, mant: 10 },  // Half precision
          { exp: 8, mant: 23 },  // Single precision
          { exp: 11, mant: 52 }  // Double precision
        ];
  
        const results = [];
        
        for (const config of configs) {
          const metrics = await this.benchmarkConfig(config);
          results.push({ config, metrics });
        }
  
        return results;
      }
  
      async benchmarkConfig({ exp, mant }) {
        const arr = new VariableFloatArray(1, exp, mant);
        const start = performance.now();
        
        // Run the benchmark
        for (let i = 0; i < this.ITERATIONS; i++) {
          const value = this.TEST_VALUES[i % this.TEST_VALUES.length];
          arr.set(0, value);
        }
        
        const duration = performance.now() - start;
        const opsPerSec = this.ITERATIONS / (duration / 1000);
  
        // Test precision
        const precisionTests = this.TEST_VALUES.map(value => {
          arr.set(0, value);
          return {
            input: value,
            output: arr.get(0)
          };
        });
  
        return {
          duration,
          opsPerSec,
          precisionTests
        };
      }
    }
  
    return {
      VariableFloatArray,
      TestBench
    };
  })();
  
  
const bench = new FloatXX.TestBench();
bench.runBenchmark().then(results => {
results.forEach(({ config, metrics }) => {
    console.log(`\nConfiguration: exp=${config.exp}, mant=${config.mant}`);
    console.log(`Operations per second: ${metrics.opsPerSec.toFixed(2)}`);
    console.log('Precision tests:');
    metrics.precisionTests.forEach(test => {
    console.log(`${test.input} -> ${test.output}`);
    });
});
});
