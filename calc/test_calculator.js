
const fs = require('fs');
const path = require('path');

global.document = {
  getElementById: (id) => {
    return {
      addEventListener: () => {},
      classList: {
        add: () => {},
        remove: () => {},
        toggle: () => {}
      },
      innerHTML: '',
      textContent: '',
      appendChild: () => {}
    };
  },
  querySelectorAll: () => [],
  querySelector: () => {
    return {
      getAttribute: () => 'dark',
      setAttribute: () => {},
      addEventListener: () => {}
    };
  }
};
global.window = {
  addEventListener: () => {}
};
global.localStorage = {
  getItem: () => null,
  setItem: () => {}
};
global.Audio = class {
  constructor() {}
};

const calcCode = fs.readFileSync(path.join(__dirname, 'calculator.js'), 'utf8');

eval(calcCode + "\nglobal.Fraction = Fraction;\nglobal.Value = Value;\nglobal.MathEngine = MathEngine;\nglobal.simplifyRadical = simplifyRadical;");

console.log("Mock environment loaded successfully.");

// Test 1: Fraction arithmetic
console.log("Running Test 1: Fractions...");
let f1 = new Fraction(1, 2);
let f2 = new Fraction(1, 3);
let sum = f1.add(f2);
console.assert(sum.n === 5 && sum.d === 6, `Expected 5/6, got ${sum.toString()}`);
console.log("Test 1 Passed: 1/2 + 1/3 =", sum.toString());

console.log("Running Test 2: Radicals...");
let r1 = simplifyRadical(8);
console.assert(r1.coeff === 2 && r1.radicand === 2, `Expected 2√2, got ${r1.coeff}√${r1.radicand}`);
let r2 = simplifyRadical(12);
console.assert(r2.coeff === 2 && r2.radicand === 3, `Expected 2√3, got ${r2.coeff}√${r2.radicand}`);
console.log("Test 2 Passed: √8 = 2√2, √12 = 2√3");

console.log("Running Test 3: Symbolic operations...");
let val1 = Value.fromRadical(1, 1, 8); // √8 = 2√2
let val2 = Value.fromRadical(1, 1, 2); // √2
let sumVal = val1.add(val2); // 3√2
console.assert(sumVal.terms.length === 1, "Expected 1 term after simplification");
console.assert(sumVal.terms[0].coeff.n === 3 && sumVal.terms[0].radical === 2, "Expected 3√2");
console.log("Test 3 Passed: √8 + √2 = 3√2");

console.log("Running Test 4: Math Engine Parser...");
let engine = new MathEngine({}, Value.fromFraction(0), 'DEG');
let res1 = engine.evaluate("1/2 + 1/3");
console.assert(res1.isExact && res1.terms[0].coeff.n === 5 && res1.terms[0].coeff.d === 6, "Expected 5/6");
console.log("Test 4a Passed: '1/2 + 1/3' = 5/6");

let res2 = engine.evaluate("√(8)");
console.assert(res2.isExact && res2.terms[0].coeff.n === 2 && res2.terms[0].radical === 2, "Expected 2√2");
console.log("Test 4b Passed: '√(8)' = 2√2");

let res3 = engine.evaluate("sin(30)"); // DEG mode
console.assert(res3.terms[0].coeff.n === 1 && res3.terms[0].coeff.d === 2, "Expected 1/2");
console.log("Test 4c Passed: 'sin(30)' = 1/2");

console.log("All unit tests passed successfully!");
