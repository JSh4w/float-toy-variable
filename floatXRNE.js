export class FloatXRNE {
    constructor(length, expWidth, mantWidth) {
        this.expWidth = expWidth;
        this.mantWidth = mantWidth;
        this.storage = new Float64Array(length);
        
        this.expMask = (1n << BigInt(expWidth)) - 1n;
        this.mantMask = (1n << BigInt(mantWidth)) - 1n;
        this.expBias = (1n << BigInt(expWidth - 1)) - 1n;
    }

    setFloatXRNE(index, value) {
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
        
        // First get approximate exponent
        let exp = Math.floor(Math.log2(value));
        
        // Calculate exact ULP for this exponent
        const ulp = Math.pow(2, exp - this.mantWidth);
        
        // Round the full value to nearest ULP, ties to even
        const scale = 1 / ulp;
        const scaled = value * scale;
        const integer = Math.floor(scaled);
        const fraction = scaled - integer;
        
        if (fraction > 0.5 || (fraction === 0.5 && (integer & 1) === 1)) {
            value = (integer + 1) / scale;
        } else {
            value = integer / scale;
        }
        
        // Now get exact exp and mant from rounded value
        exp = Math.floor(Math.log2(value));
        const mant = Math.floor((value / Math.pow(2, exp) - 1.0) * (2 ** this.mantWidth));
        
        // Handle range limits
        if (exp < -Number(this.expBias) + 1) {
            this.storage[index] = sign ? -0 : 0;
            return;
        }
        if (exp > Number(this.expBias)) {
            this.storage[index] = sign ? -Infinity : Infinity;
            return;
        }

        const biasedExp = BigInt(exp + Number(this.expBias));
        const bits = (sign << 63n) | 
                    (biasedExp << BigInt(63 - this.expWidth)) |
                    (BigInt(mant) & this.mantMask);
                    
        new BigInt64Array(this.storage.buffer)[index] = bits;
    }
    
    getFloatXRNE(index) {
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
    
    getFloatXRNEBits(index) {
        if (!Number.isFinite(this.storage[index])) {
          if (this.storage[index] === 0) {
            // Handle zero
            return Object.is(this.storage[index], -0) ? 
              (1n << 63n) : 0n;
          } else if (Number.isNaN(this.storage[index])) {
            // Handle NaN
            return (this.expMask << BigInt(63 - this.expWidth)) | 1n;
          } else {
            // Handle Infinity
            const sign = this.storage[index] < 0 ? 1n : 0n;
            return (sign << 63n) | (this.expMask << BigInt(63 - this.expWidth));
          }
        }
        
        return new BigInt64Array(this.storage.buffer)[index];
      }
      
    getFloatXRNEBitString(index) {
        const bits = this.getFloatXRNEBits(index);
        let result = '';
        
        for (let i = 63; i >= 0; i--) {
          result += ((bits >> BigInt(i)) & 1n).toString();
        }
        
        return result;
      }
}

export function getFloatXRNE(floatXRNE, index) {
    if (!(floatXRNE instanceof FloatXRNE)) {
        throw new TypeError("First Argument must be an instance of FloatXRNE");
    }
    return floatXRNE.getFloatXRNE(index);
}

export function setFloatXRNE(floatXRNE, index, value) {
    if (!(floatXRNE instanceof FloatXRNE)) {
        throw new TypeError("First argument must be an instance of FloatXRNE");
    }
    floatXRNE.setFloatXRNE(index, value);
}

export function getFloatXRNEBits(floatXRNE, index) {
    if (!(floatXRNE instanceof FloatXRNE)) {
        throw new TypeError("First argument must be an instance of FloatXRNE");
    }
    floatXRNE.getFloatXRNEBits(index);
}
export function getFloatXRNEBitString(floatXRNE, index) {
    if (!(floatXRNE instanceof FloatXRNE)) {
        throw new TypeError("First argument must be an instance of FloatXRNE");
    }
    floatXRNE.getFloatXRNEBitString(index);
}