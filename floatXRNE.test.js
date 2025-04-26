import { FloatXRNE, getFloatXRNE, setFloatXRNE } from './floatXRNE.js';


// Function to test FloatXRNE against standard float representations
function testFloatXRNE() {
    const floatXRNE = new FloatXRNE(32, 8, 23); // Example: 5 bits for exponent, 10 bits for mantissa

    const testValues = [
        0, 
        1, 
        -1, 
        1.3,
        3.14, 
        65504, 
        -65504, 
        Infinity, 
        -Infinity, 
        NaN,
        1e-10, 
        -1e-10, 
        1e10, 
        -1e10, 
        1e-20, 
        -1e-20, 
        Math.PI, 
        Math.E
    ];

    testValues.forEach(value => {
        // Set value in FloatXRNE
        setFloatXRNE(floatXRNE, 0, value);
        const floatXRNEValue = getFloatXRNE(floatXRNE, 0);
        const bitStringXRNE = floatXRNE.getFloatXRNEBitString(0);
        console.log(`Bitsring: ${bitStringXRNE}`);

        // Compare with float32
        const float32Value = new Float32Array([value])[0];
        console.log(`Value: ${value}, FloatXRNE: ${floatXRNEValue}, Float32: ${float32Value}`);

        // Compare with float64
        const float64Value = new Float64Array([value])[0];
        console.log(`Value: ${value}, FloatXRNE: ${floatXRNEValue}, Float64: ${float64Value}`);
        
    });
}

// Run the tests
testFloatXRNE(); 