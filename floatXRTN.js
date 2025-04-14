const perf_hooks = require('perf_hooks');
global.performance = perf_hooks.performance;



class VariableFloatArray {
  constructor(length, expWidth, mantWidth) {
    this.expWidth = expWidth;
    this.mantWidth = mantWidth;
    this.storage = new Float64Array(length);
    
    this.expMask = (1n << BigInt(expWidth)) - 1n;
    this.mantMask = (1n << BigInt(mantWidth)) - 1n;
    this.expBias = (1n << BigInt(expWidth - 1)) - 1n;
  }

  set(index, value) {
    if (index < 0 || index >= this.storage.length) return;
    
    if (value === 0) {
      this.storage[index] = Object.is(value, -0) ? -0 : 0;
      return;
    }
    
    if (!Number.isFinite(value)) {
      this.storage[index] = value;
      return;
    }

    const sign = value < 0 ? 1n : 0n;
    value = Math.abs(value);
    
    let exp = Math.floor(Math.log2(value));
    let mant = value / Math.pow(2, exp);

    // Handle range limits
    const maxExp = Number(this.expBias);
    const minExp = -maxExp + 1;
    if (exp < minExp) {
      this.storage[index] = sign ? -0 : 0;
      return;
    }
    if (exp > maxExp) {
      this.storage[index] = sign ? -Infinity : Infinity;
      return;
    }

    // Scale and quantize
    exp = BigInt(exp + Number(this.expBias)); //Set back to positive 

    mant = BigInt(Math.floor((mant - 1.0) * (2 ** this.mantWidth))); //Set to 

    const bits = (sign << 63n) | 
                 (exp << BigInt(63 - this.expWidth)) |
                 (mant & this.mantMask);
                 
    new BigInt64Array(this.storage.buffer)[index] = bits;
  }

  get(index) {
    if (!Number.isFinite(this.storage[index])) {
      return this.storage[index];
    }

    const bits = new BigInt64Array(this.storage.buffer)[index];
    const sign = (bits >> 63n) & 1n;
    const exp = ((bits >> BigInt(63 - this.expWidth)) & this.expMask) - this.expBias;
    const mant = bits & this.mantMask;

    if (exp === -this.expBias && mant === 0n) {
      return sign ? -0 : 0;
    }

    const value = (1 + Number(mant) / (2 ** this.mantWidth)) * Math.pow(2, Number(exp));
    return sign ? -value : value;
  }
}


class TestBench {
  constructor() {
    this.ITERATIONS = 1000000;
    this.TEST_VALUES = [0, 1, -1, Math.PI, 1e-20, 1e20, Infinity, -Infinity, NaN, 4.067762874698273641987635491786324];
  }

  async runBenchmark() {
    console.log('Starting Variable Float benchmark...');
    
    const configs = [
      { exp: 5, mant: 10 },
      { exp: 8, mant: 23 },
      { exp: 11, mant: 52 }
    ];

    for (const config of configs) {
      const start = performance.now();
      const arr = new VariableFloatArray(1, config.exp, config.mant);
      
      for (let i = 0; i < this.ITERATIONS; i++) {
        const value = this.TEST_VALUES[i % this.TEST_VALUES.length];
        arr.set(0, value);
      }
      
      const opsPerSec = this.ITERATIONS / ((performance.now() - start) / 1000);
      console.log(`\nExp ${config.exp}, Mantissa ${config.mant}:`);
      console.log(`Operations per second: ${opsPerSec.toFixed(2)}`);
      
      console.log('Precision test:');
      this.TEST_VALUES.forEach(value => {
        arr.set(0, value);
        console.log(`${value} -> ${arr.get(0)}`);
      });
    }
  }
}

const bench = new TestBench();
bench.runBenchmark().then(() => {
  const memUsage = process.memoryUsage();
  console.log('\nMemory Usage:');
  for (let key in memUsage) {
    console.log(`${key}: ${Math.round(memUsage[key] / 1024 / 1024 * 100) / 100} MB`);
  }
});