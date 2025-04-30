export class FloatXRNE {
    constructor(length, expWidth, mantWidth) {
        this.expWidth = expWidth;
        this.mantWidth = mantWidth;
        this.width = expWidth + mantWidth + 1;
        this.storage = new Float64Array(length);
        
        this.expMask = (1n << BigInt(expWidth)) - 1n;
        this.mantMask = (1n << BigInt(mantWidth)) - 1n;
        this.expBias = (1n << BigInt(expWidth - 1)) - 1n;

        this.negativeZero = 1n << BigInt(this.width - 1);
        this.inf = BigInt(this.expMask) << BigInt(this.width - 1 - this.expWidth);
        this.negInf = (1n << BigInt(this.width - 1)) | this.inf;
        this.nan = this.inf + (1n << BigInt(this.mantWidth - 1));
    }

    isNaN(index) {
        const bits = new BigInt64Array(this.storage.buffer)[index];
        // Check if the exponent is all ones and the mantissa is non-zero
        return ((bits >> BigInt(this.mantWidth)) & this.expMask) === this.expMask && (bits & this.mantMask) !== 0n;
    }

    isInf(index) {
        const bits = new BigInt64Array(this.storage.buffer)[index];
        // Check if the exponent is all ones and the mantissa is zero
        return ((bits >> BigInt(this.mantWidth)) & this.expMask) === this.expMask && (bits & this.mantMask) === 0n;
    }

    setFloatXRNE(index, value) {
        // takes decimal value
        if (index < 0 || index >= this.storage.length) return;
        
        if (value === 0) {
            new BigInt64Array(this.storage.buffer)[index] = Object.is(value, -0) ? this.negativeZero : 0n;
            return;
        }
        if (value === Infinity) {
            new BigInt64Array(this.storage.buffer)[index] = this.inf;
            return;         
        }
        if (value === -Infinity) {
            new BigInt64Array(this.storage.buffer)[index] = this.negInf;
            return;         
        }
        if (Number.isNaN(value)) {
            new BigInt64Array(this.storage.buffer)[index] = this.nan;
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
            new BigInt64Array(this.storage.buffer)[index] = Object.is(value, -0) ? this.negativeZero : 0n;
            return;
        }
        if (exp > Number(this.expBias)) {
            new BigInt64Array(this.storage.buffer)[index] = sign ? this.negInf : this.inf;
            return;
        }

        const biasedExp = BigInt(exp + Number(this.expBias));
        const bits = (sign << BigInt(this.width-1)) | 
                    (biasedExp << BigInt(this.mantWidth)) |
                    (BigInt(mant) & this.mantMask);
                    
        new BigInt64Array(this.storage.buffer)[index] = bits;
    }
    
    getFloatXRNE(index) {    
        const bits = new BigInt64Array(this.storage.buffer)[index];
        if (this.isInf(index)) {
            if (bits >> BigInt(this.width - 1)) {
                return -Infinity; 
            } else {
                return Infinity;
            }
        }
        if (this.isNaN(index)) {
            return NaN;
        }

        const sign = (bits >> BigInt(this.width-1)) & 1n;
        const exp = ((bits >> BigInt(this.mantWidth)) & this.expMask) - this.expBias;
        const mant = bits & this.mantMask;

        if (exp === -this.expBias && mant === 0n) {
            return sign ? -0 : 0;
        }
    
        const value = (1 + Number(mant) / (2 ** this.mantWidth)) * Math.pow(2, Number(exp));
        return sign ? -value : value;
    }
    
    getFloatXRNEBits(index) {
        return new BigInt64Array(this.storage.buffer)[index];
      }
      
    getFloatXRNEBitString(index) {
        const bits = this.getFloatXRNEBits(index);
        let result = '';
        
        for (let i = BigInt(this.width-1); i >= 0; i--) {
          result += ((bits >> BigInt(i)) & 1n).toString();
        }
        // returns in right aligned format 
        return result;
      }

    clearUnusedBits(index) { 
        const totalBits = 1 + this.expWidth + this.mantWidth;
        // Mask for preserved bits
        const usedBitsMask = ((1n << BigInt(totalBits)) - 1n) << BigInt(64 - totalBits);
        
        const bits = new BigInt64Array(this.storage.buffer)[index];
        new BigInt64Array(this.storage.buffer)[index] = bits & usedBitsMask;
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

export function clearUnusedBits(floatXRNE) {
    if (!(floatXRNE instanceof FloatXRNE)) {
        throw new TypeError("First argument must be an instance of FloatXRNE");
    }
    floatXRNE.clearUnusedBits(index);
}