

function gcd(a, b) {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) {
    let t = b;
    b = a % b;
    a = t;
  }
  return a;
}

function lcm(a, b) {
  if (a === 0 || b === 0) return 0;
  return Math.abs(a * b) / gcd(a, b);
}

// Simplify radicals: e.g. simplifyRadical(8) -> { coeff: 2, radicand: 2 } (representing 2√2)
function simplifyRadical(c) {
  if (c < 0) return { coeff: 1, radicand: c }; // Avoid imaginary errors here
  let coeff = 1;
  let radicand = c;
  for (let i = 2; i * i <= radicand; i++) {
    while (radicand % (i * i) === 0) {
      coeff *= i;
      radicand /= (i * i);
    }
  }
  return { coeff, radicand };
}

// -------------------------------------------------------------
// Fraction Class (exact arithmetic)
// -------------------------------------------------------------
class Fraction {
  constructor(n, d = 1) {
    if (d === 0) throw new Error("Divide by Zero");
    let g = gcd(Math.abs(n), Math.abs(d));
    let sign = (n * d < 0) ? -1 : 1;
    this.n = sign * Math.abs(n) / g;
    this.d = Math.abs(d) / g;
  }

  add(o) { return new Fraction(this.n * o.d + o.n * this.d, this.d * o.d); }
  sub(o) { return new Fraction(this.n * o.d - o.n * this.d, this.d * o.d); }
  mul(o) { return new Fraction(this.n * o.n, this.d * o.d); }
  div(o) { return new Fraction(this.n * o.d, this.d * o.n); }
  neg() { return new Fraction(-this.n, this.d); }
  inv() { return new Fraction(this.d, this.n); }
  toDouble() { return this.n / this.d; }
  isInteger() { return this.d === 1; }
  toString() { return this.d === 1 ? `${this.n}` : `${this.n}/${this.d}`; }
}

// -------------------------------------------------------------
// Exact Math Value (Fraction + Radicals + Pi representation)
// -------------------------------------------------------------
class Value {
  constructor(terms = null, dec = null) {
    if (terms !== null) {
      this.terms = this.simplifyTerms(terms);
      this.isExact = true;
      this.dec = this.calcDecimal();
    } else {
      this.terms = [];
      this.isExact = false;
      this.dec = dec;
    }
  }

  simplifyTerms(terms) {
    let groups = {};
    for (let t of terms) {
      let c = t.coeff;
      if (c.n === 0) continue;
      let key = `${t.radical}_${t.pi}`;
      if (!groups[key]) {
        groups[key] = { coeff: new Fraction(0), radical: t.radical, pi: t.pi };
      }
      groups[key].coeff = groups[key].coeff.add(c);
    }
    return Object.values(groups).filter(g => g.coeff.n !== 0);
  }

  calcDecimal() {
    let sum = 0;
    for (let t of this.terms) {
      let termVal = t.coeff.toDouble();
      if (t.radical > 1) termVal *= Math.sqrt(t.radical);
      if (t.pi) termVal *= Math.PI;
      sum += termVal;
    }
    return sum;
  }

  toDouble() {
    return this.isExact ? this.dec : this.dec;
  }

  static fromDecimal(d) {
    return new Value(null, d);
  }

  static fromFraction(n, d) {
    return new Value([{ coeff: new Fraction(n, d), radical: 1, pi: false }]);
  }

  static fromPi(n, d) {
    return new Value([{ coeff: new Fraction(n, d), radical: 1, pi: true }]);
  }

  static fromRadical(n, d, r) {
    let { coeff: r_coeff, radicand: r_rad } = simplifyRadical(r);
    return new Value([{ coeff: new Fraction(n, d).mul(new Fraction(r_coeff)), radical: r_rad, pi: false }]);
  }

  add(o) {
    if (!this.isExact || !o.isExact) return Value.fromDecimal(this.toDouble() + o.toDouble());
    return new Value([...this.terms, ...o.terms]);
  }

  sub(o) {
    if (!this.isExact || !o.isExact) return Value.fromDecimal(this.toDouble() - o.toDouble());
    let negTerms = o.terms.map(t => ({ coeff: t.coeff.neg(), radical: t.radical, pi: t.pi }));
    return new Value([...this.terms, ...negTerms]);
  }

  mul(o) {
    if (!this.isExact || !o.isExact) return Value.fromDecimal(this.toDouble() * o.toDouble());
    let newTerms = [];
    for (let t1 of this.terms) {
      for (let t2 of o.terms) {
        if (t1.pi && t2.pi) return Value.fromDecimal(this.toDouble() * o.toDouble()); // pi squared fallback
        let coeff = t1.coeff.mul(t2.coeff);
        let r_val = t1.radical * t2.radical;
        let { coeff: r_coeff, radicand: r_rad } = simplifyRadical(r_val);
        coeff = coeff.mul(new Fraction(r_coeff));
        let pi = t1.pi || t2.pi;
        newTerms.push({ coeff, radical: r_rad, pi });
      }
    }
    return new Value(newTerms);
  }

  div(o) {
    if (!this.isExact || !o.isExact || o.terms.length !== 1) {
      return Value.fromDecimal(this.toDouble() / o.toDouble());
    }
    let t2 = o.terms[0];
    if (t2.coeff.n === 0) throw new Error("Divide by Zero");

    let newTerms = [];
    for (let t1 of this.terms) {
      let pi = false;
      if (t1.pi && t2.pi) {
        pi = false;
      } else if (t1.pi && !t2.pi) {
        pi = true;
      } else if (!t1.pi && t2.pi) {
        return Value.fromDecimal(this.toDouble() / o.toDouble()); // division by pi fallback
      }

      let coeff = t1.coeff.div(t2.coeff);
      let radical = 1;

      if (t1.radical === 1 && t2.radical === 1) {
        radical = 1;
      } else if (t1.radical > 1 && t2.radical === 1) {
        radical = t1.radical;
      } else if (t1.radical === 1 && t2.radical > 1) {
        coeff = coeff.div(new Fraction(t2.radical));
        radical = t2.radical;
      } else {
        coeff = coeff.div(new Fraction(t2.radical));
        let r_val = t1.radical * t2.radical;
        let { coeff: r_coeff, radicand: r_rad } = simplifyRadical(r_val);
        coeff = coeff.mul(new Fraction(r_coeff));
        radical = r_rad;
      }
      newTerms.push({ coeff, radical, pi });
    }
    return new Value(newTerms);
  }

  neg() {
    if (!this.isExact) return Value.fromDecimal(-this.dec);
    return new Value(this.terms.map(t => ({ coeff: t.coeff.neg(), radical: t.radical, pi: t.pi })));
  }

  sqrt() {
    if (!this.isExact) return Value.fromDecimal(Math.sqrt(this.toDouble()));
    if (this.terms.length === 1) {
      let t = this.terms[0];
      if (t.pi) return Value.fromDecimal(Math.sqrt(this.toDouble()));
      if (t.radical === 1) {
        let n = t.coeff.n;
        let d = t.coeff.d;
        if (n < 0) throw new Error("Domain Error");
        let radicand = n * d;
        let { coeff: r_coeff, radicand: r_rad } = simplifyRadical(radicand);
        let coeff = new Fraction(r_coeff, d);
        return new Value([{ coeff, radical: r_rad, pi: false }]);
      }
    }
    return Value.fromDecimal(Math.sqrt(this.toDouble()));
  }

  pow(o) {
    let p = o.toDouble();
    if (p === 0) return Value.fromFraction(1, 1);
    if (p === 0.5) return this.sqrt();
    if (Number.isInteger(p)) {
      let res = Value.fromFraction(1, 1);
      let base = p < 0 ? Value.fromFraction(1, 1).div(this) : this;
      let absP = Math.abs(p);
      for (let i = 0; i < absP; i++) {
        res = res.mul(base);
      }
      return res;
    }
    return Value.fromDecimal(Math.pow(this.toDouble(), p));
  }
}

// -------------------------------------------------------------
// Document tree model for editing (Fractions, Superscripts, Radicals)
// -------------------------------------------------------------
class NodeBuilder {
  static char(v) { return { type: 'char', value: v }; }
  static fraction() { return { type: 'fraction', num: [], den: [] }; }
  static power() { return { type: 'power', exp: [] }; }
  static radical() { return { type: 'radical', content: [] }; }
  static symbol(v) { return { type: 'symbol', value: v }; }
  static variable(v) { return { type: 'var', name: v }; }
}

class ExpressionEditor {
  constructor() {
    this.root = [];
    this.path = []; // List of { type: string, node: nodeRef, field: string }
    this.index = 0;
  }

  clear() {
    this.root = [];
    this.path = [];
    this.index = 0;
  }

  isEmpty() {
    return this.root.length === 0;
  }

  getCurrentArray() {
    let arr = this.root;
    for (let p of this.path) {
      arr = p.node[p.field];
    }
    return arr;
  }

  insert(node) {
    let arr = this.getCurrentArray();
    arr.splice(this.index, 0, node);
    this.index++;
    // If inserting container, place cursor inside it
    if (node.type === 'fraction') {
      this.path.push({ type: 'fraction', node: node, field: 'num' });
      this.index = 0;
    } else if (node.type === 'power') {
      this.path.push({ type: 'power', node: node, field: 'exp' });
      this.index = 0;
    } else if (node.type === 'radical') {
      this.path.push({ type: 'radical', node: node, field: 'content' });
      this.index = 0;
    }
  }

  delete() {
    let arr = this.getCurrentArray();
    if (this.index > 0) {
      arr.splice(this.index - 1, 1);
      this.index--;
    } else {
      // Cursor is at index 0 of sub-array. Move cursor out to the parent level
      if (this.path.length > 0) {
        let p = this.path.pop();
        let parentArr = this.getCurrentArray();
        this.index = parentArr.indexOf(p.node);
      }
    }
  }

  moveLeft() {
    let arr = this.getCurrentArray();
    if (this.index > 0) {
      let leftNode = arr[this.index - 1];
      if (leftNode.type === 'fraction') {
        this.path.push({ type: 'fraction', node: leftNode, field: 'den' });
        let nextArr = this.getCurrentArray();
        this.index = nextArr.length;
      } else if (leftNode.type === 'power') {
        this.path.push({ type: 'power', node: leftNode, field: 'exp' });
        let nextArr = this.getCurrentArray();
        this.index = nextArr.length;
      } else if (leftNode.type === 'radical') {
        this.path.push({ type: 'radical', node: leftNode, field: 'content' });
        let nextArr = this.getCurrentArray();
        this.index = nextArr.length;
      } else {
        this.index--;
      }
    } else {
      if (this.path.length > 0) {
        let p = this.path.pop();
        let parentArr = this.getCurrentArray();
        this.index = parentArr.indexOf(p.node);
      }
    }
  }

  moveRight() {
    let arr = this.getCurrentArray();
    if (this.index < arr.length) {
      let rightNode = arr[this.index];
      if (rightNode.type === 'fraction') {
        this.path.push({ type: 'fraction', node: rightNode, field: 'num' });
        this.index = 0;
      } else if (rightNode.type === 'power') {
        this.path.push({ type: 'power', node: rightNode, field: 'exp' });
        this.index = 0;
      } else if (rightNode.type === 'radical') {
        this.path.push({ type: 'radical', node: rightNode, field: 'content' });
        this.index = 0;
      } else {
        this.index++;
      }
    } else {
      if (this.path.length > 0) {
        let p = this.path.pop();
        let parentArr = this.getCurrentArray();
        this.index = parentArr.indexOf(p.node) + 1;
      }
    }
  }

  moveUp() {
    if (this.path.length > 0) {
      let last = this.path[this.path.length - 1];
      if (last.type === 'fraction' && last.field === 'den') {
        last.field = 'num';
        this.index = last.node.num.length;
        return true;
      }
    }
    return false; // Can bubble up to scroll history
  }

  moveDown() {
    if (this.path.length > 0) {
      let last = this.path[this.path.length - 1];
      if (last.type === 'fraction' && last.field === 'num') {
        last.field = 'den';
        this.index = last.node.den.length;
        return true;
      }
    }
    return false; // Can bubble down to scroll history
  }

  // Convert editor tree to parsed math string
  serializeToMathString() {
    return this.serializeNodes(this.root);
  }

  serializeNodes(nodes) {
    let out = '';
    for (let node of nodes) {
      if (node.type === 'char') {
        let val = node.value;
        if (val === '×') val = '*';
        if (val === '÷') val = '/';
        if (val === '−') val = '-';
        out += val;
      } else if (node.type === 'symbol') {
        out += node.value === 'π' ? 'pi' : node.value.toLowerCase();
      } else if (node.type === 'var') {
        out += node.name;
      } else if (node.type === 'fraction') {
        out += `((` + this.serializeNodes(node.num) + `)/(` + this.serializeNodes(node.den) + `))`;
      } else if (node.type === 'power') {
        out += `^(` + this.serializeNodes(node.exp) + `)`;
      } else if (node.type === 'radical') {
        out += `√(` + this.serializeNodes(node.content) + `)`;
      }
    }
    return out;
  }

  // Render to HTML MathPrint formatting
  renderHTML() {
    return this.renderNodes(this.root, this.getCurrentArray(), this.index);
  }

  renderNodes(nodes, activeArr, activeIdx) {
    let html = '';
    let isCurrent = (nodes === activeArr);
    
    for (let i = 0; i <= nodes.length; i++) {
      // Blinking cursor insertion point
      if (isCurrent && i === activeIdx) {
        html += '<span class="cursor" id="lcdCursor"></span>';
      }
      if (i === nodes.length) break;

      let node = nodes[i];
      if (node.type === 'char' || node.type === 'symbol' || node.type === 'var') {
        let val = (node.type === 'var') ? node.name : (node.value || node.name);
        html += `<span>${val}</span>`;
      } else if (node.type === 'fraction') {
        let numHTML = this.renderNodes(node.num, activeArr, activeIdx);
        let denHTML = this.renderNodes(node.den, activeArr, activeIdx);
        if (numHTML === '' && isCurrent && activeArr === node.num) numHTML = '&nbsp;';
        if (denHTML === '' && isCurrent && activeArr === node.den) denHTML = '&nbsp;';
        html += `<span class="math-fraction"><span class="math-numerator">${numHTML || '&nbsp;'}</span><span class="math-denominator">${denHTML || '&nbsp;'}</span></span>`;
      } else if (node.type === 'power') {
        let expHTML = this.renderNodes(node.exp, activeArr, activeIdx);
        html += `<span class="math-power"><span class="math-exponent">${expHTML || '&nbsp;'}</span></span>`;
      } else if (node.type === 'radical') {
        let contentHTML = this.renderNodes(node.content, activeArr, activeIdx);
        html += `<span class="math-radical"><span class="math-radical-symbol">&radic;</span><span class="math-radical-content">${contentHTML || '&nbsp;'}</span></span>`;
      }
    }
    return html;
  }
}

// -------------------------------------------------------------
// Math Parser & Evaluator Engine
// -------------------------------------------------------------
class MathEngine {
  constructor(variables = {}, lastAnswer = Value.fromFraction(0, 1), angleMode = 'DEG') {
    this.variables = variables;
    this.lastAnswer = lastAnswer;
    this.angleMode = angleMode; // DEG, RAD, GRAD
  }

  evaluate(str) {
    let tokens = this.tokenize(str);
    tokens = this.insertImplicitMultiplication(tokens);
    let parser = new ExpressionParser(tokens, this.variables, this.lastAnswer, this.angleMode);
    return parser.parseExpression();
  }

  tokenize(str) {
    let tokens = [];
    let i = 0;
    while (i < str.length) {
      let c = str[i];
      if (/\s/.test(c)) { i++; continue; }
      
      // Function mappings
      if (str.startsWith('sin(', i)) { tokens.push('sin('); i += 4; }
      else if (str.startsWith('cos(', i)) { tokens.push('cos('); i += 4; }
      else if (str.startsWith('tan(', i)) { tokens.push('tan('); i += 4; }
      else if (str.startsWith('asin(', i)) { tokens.push('asin('); i += 5; }
      else if (str.startsWith('acos(', i)) { tokens.push('acos('); i += 5; }
      else if (str.startsWith('atan(', i)) { tokens.push('atan('); i += 5; }
      else if (str.startsWith('log(', i)) { tokens.push('log('); i += 4; }
      else if (str.startsWith('ln(', i)) { tokens.push('ln('); i += 3; }
      else if (str.startsWith('√(', i)) { tokens.push('√('); i += 2; }
      else if (str.startsWith('abs(', i)) { tokens.push('abs('); i += 4; }
      else if (str.startsWith('lcm(', i)) { tokens.push('lcm('); i += 4; }
      else if (str.startsWith('gcd(', i)) { tokens.push('gcd('); i += 4; }
      else if (str.startsWith('min(', i)) { tokens.push('min('); i += 4; }
      else if (str.startsWith('max(', i)) { tokens.push('max('); i += 4; }
      else if (str.startsWith('nPr', i)) { tokens.push('nPr'); i += 3; }
      else if (str.startsWith('nCr', i)) { tokens.push('nCr'); i += 3; }
      else if (str.startsWith('ans', i)) { tokens.push('ans'); i += 3; }
      else if (c === 'π' || str.startsWith('pi', i)) { tokens.push('π'); i += (c === 'π' ? 1 : 2); }
      else if (c === 'e') { tokens.push('e'); i++; }
      else if (c === ',') { tokens.push(','); i++; }
      else if (c === '+' || c === '-' || c === '*' || c === '/' || c === '^' || c === '!' || c === '(' || c === ')') {
        tokens.push(c);
        i++;
      } else if (/[0-9.]/.test(c)) {
        let num = '';
        while (i < str.length && /[0-9.]/.test(str[i])) {
          num += str[i];
          i++;
        }
        tokens.push(num);
      } else if (/[xyztabcXYZTABC]/.test(c)) {
        tokens.push(c.toLowerCase());
        i++;
      } else {
        tokens.push(c);
        i++;
      }
    }
    return tokens;
  }

  insertImplicitMultiplication(tokens) {
    let result = [];
    for (let i = 0; i < tokens.length; i++) {
      result.push(tokens[i]);
      if (i + 1 < tokens.length) {
        let a = tokens[i];
        let b = tokens[i+1];
        let aIsTerm = /[0-9.]/.test(a) || a === ')' || a === 'π' || a === 'e' || a === 'ans' || /^[xyztabc]$/.test(a) || a === '!';
        let bIsTerm = /[0-9.]/.test(b) || b === '(' || b === 'π' || b === 'e' || b === 'ans' || /^[xyztabc]$/.test(b) || b.endsWith('(') || b === '√(';
        if (aIsTerm && bIsTerm) {
          if (!(/[0-9.]/.test(a) && /[0-9.]/.test(b))) {
            result.push('*');
          }
        }
      }
    }
    return result;
  }
}

// Recursive Descent Expression Parser
class ExpressionParser {
  constructor(tokens, variables, lastAnswer, angleMode) {
    this.tokens = tokens;
    this.pos = 0;
    this.variables = variables;
    this.lastAnswer = lastAnswer;
    this.angleMode = angleMode;
  }

  peek() {
    return this.pos < this.tokens.length ? this.tokens[this.pos] : null;
  }

  next() {
    let t = this.peek();
    this.pos++;
    return t;
  }

  match(token) {
    if (this.peek() === token) {
      this.pos++;
      return true;
    }
    return false;
  }

  parseExpression() {
    return this.parseAdditive();
  }

  parseAdditive() {
    let val = this.parseMultiplicative();
    while (true) {
      if (this.match('+')) {
        val = val.add(this.parseMultiplicative());
      } else if (this.match('-')) {
        val = val.sub(this.parseMultiplicative());
      } else {
        break;
      }
    }
    return val;
  }

  parseMultiplicative() {
    let val = this.parsePower();
    while (true) {
      if (this.match('*')) {
        val = val.mul(this.parsePower());
      } else if (this.match('/')) {
        val = val.div(this.parsePower());
      } else if (this.match('nPr')) {
        let r = this.parsePower().toDouble();
        let n = val.toDouble();
        val = Value.fromDecimal(this.permutations(n, r));
      } else if (this.match('nCr')) {
        let r = this.parsePower().toDouble();
        let n = val.toDouble();
        val = Value.fromDecimal(this.combinations(n, r));
      } else {
        break;
      }
    }
    return val;
  }

  parsePower() {
    let val = this.parseUnary();
    while (this.match('^')) {
      val = val.pow(this.parseUnary());
    }
    return val;
  }

  parseUnary() {
    if (this.match('-')) {
      return this.parseUnary().neg();
    }
    if (this.match('+')) {
      return this.parseUnary();
    }
    return this.parsePostfix();
  }

  parsePostfix() {
    let val = this.parsePrimary();
    while (this.match('!')) {
      val = Value.fromDecimal(this.factorial(val.toDouble()));
    }
    return val;
  }

  parsePrimary() {
    let t = this.next();
    if (t === null) throw new Error("Syntax Error");

    if (t === '(') {
      let val = this.parseExpression();
      if (!this.match(')')) throw new Error("Mismatched (");
      return val;
    }

    if (t === 'π') {
      return Value.fromPi(1, 1);
    }
    if (t === 'e') {
      return Value.fromDecimal(Math.E);
    }
    if (t === 'ans') {
      return this.lastAnswer;
    }
    if (/^[xyztabc]$/.test(t)) {
      let val = this.variables[t];
      return val !== undefined ? val : Value.fromFraction(0, 1);
    }

    // Functions
    if (t.endsWith('(')) {
      let func = t.slice(0, -1);
      // Dual argument functions check
      if (func === 'lcm' || func === 'gcd' || func === 'min' || func === 'max') {
        let arg1 = this.parseExpression();
        if (!this.match(',')) throw new Error("Expected comma");
        let arg2 = this.parseExpression();
        if (!this.match(')')) throw new Error("Expected )");
        
        let a = arg1.toDouble();
        let b = arg2.toDouble();
        if (func === 'lcm') return Value.fromFraction(lcm(a, b), 1);
        if (func === 'gcd') return Value.fromFraction(gcd(a, b), 1);
        if (func === 'min') return Value.fromDecimal(Math.min(a, b));
        if (func === 'max') return Value.fromDecimal(Math.max(a, b));
      }
      
      let arg = this.parseExpression();
      if (!this.match(')')) throw new Error("Expected )");

      // Trig & Radicals functions
      if (func === '√') return arg.sqrt();
      if (func === 'abs') return Value.fromDecimal(Math.abs(arg.toDouble()));
      if (func === 'log') return Value.fromDecimal(Math.log10(arg.toDouble()));
      if (func === 'ln') return Value.fromDecimal(Math.log(arg.toDouble()));
      
      // Angle calculations
      let radAngle = arg.toDouble();
      if (this.angleMode === 'DEG') {
        radAngle = radAngle * Math.PI / 180;
      } else if (this.angleMode === 'GRAD') {
        radAngle = radAngle * Math.PI / 200;
      }

      if (func === 'sin') {
        // Return exact value if DEG mode and multiple of 30 or 45
        if (this.angleMode === 'DEG') {
          let deg = Math.round(arg.toDouble()) % 360;
          if (deg < 0) deg += 360;
          if (deg === 30 || deg === 150) return Value.fromFraction(1, 2);
          if (deg === 210 || deg === 330) return Value.fromFraction(-1, 2);
          if (deg === 90) return Value.fromFraction(1, 1);
          if (deg === 270) return Value.fromFraction(-1, 1);
          if (deg === 0 || deg === 180) return Value.fromFraction(0, 1);
          if (deg === 45 || deg === 135) return Value.fromRadical(1, 2, 2); // √2 / 2
          if (deg === 225 || deg === 315) return Value.fromRadical(-1, 2, 2);
          if (deg === 60 || deg === 120) return Value.fromRadical(1, 2, 3); // √3 / 2
          if (deg === 240 || deg === 300) return Value.fromRadical(-1, 2, 3);
        }
        return Value.fromDecimal(Math.sin(radAngle));
      }
      if (func === 'cos') {
        if (this.angleMode === 'DEG') {
          let deg = Math.round(arg.toDouble()) % 360;
          if (deg < 0) deg += 360;
          if (deg === 60 || deg === 300) return Value.fromFraction(1, 2);
          if (deg === 120 || deg === 240) return Value.fromFraction(-1, 2);
          if (deg === 0) return Value.fromFraction(1, 1);
          if (deg === 180) return Value.fromFraction(-1, 1);
          if (deg === 90 || deg === 270) return Value.fromFraction(0, 1);
          if (deg === 45 || deg === 315) return Value.fromRadical(1, 2, 2); // √2 / 2
          if (deg === 135 || deg === 225) return Value.fromRadical(-1, 2, 2);
          if (deg === 30 || deg === 330) return Value.fromRadical(1, 2, 3); // √3 / 2
          if (deg === 150 || deg === 210) return Value.fromRadical(-1, 2, 3);
        }
        return Value.fromDecimal(Math.cos(radAngle));
      }
      if (func === 'tan') {
        if (this.angleMode === 'DEG') {
          let deg = Math.round(arg.toDouble()) % 180;
          if (deg < 0) deg += 180;
          if (deg === 0) return Value.fromFraction(0, 1);
          if (deg === 45) return Value.fromFraction(1, 1);
          if (deg === 135) return Value.fromFraction(-1, 1);
          if (deg === 90) throw new Error("Domain Error");
        }
        return Value.fromDecimal(Math.tan(radAngle));
      }
      
      // Inverse angles
      if (func === 'asin') {
        let res = Math.asin(arg.toDouble());
        if (this.angleMode === 'DEG') res = res * 180 / Math.PI;
        if (this.angleMode === 'GRAD') res = res * 200 / Math.PI;
        return Value.fromDecimal(res);
      }
      if (func === 'acos') {
        let res = Math.acos(arg.toDouble());
        if (this.angleMode === 'DEG') res = res * 180 / Math.PI;
        if (this.angleMode === 'GRAD') res = res * 200 / Math.PI;
        return Value.fromDecimal(res);
      }
      if (func === 'atan') {
        let res = Math.atan(arg.toDouble());
        if (this.angleMode === 'DEG') res = res * 180 / Math.PI;
        if (this.angleMode === 'GRAD') res = res * 200 / Math.PI;
        return Value.fromDecimal(res);
      }
    }

    // Number parsing
    let numVal = parseFloat(t);
    if (!isNaN(numVal)) {
      if (t.includes('.')) {
        return Value.fromDecimal(numVal);
      }
      return Value.fromFraction(numVal, 1);
    }

    throw new Error("Syntax Error");
  }

  permutations(n, r) {
    if (n < 0 || r < 0 || r > n) return 0;
    return this.factorial(n) / this.factorial(n - r);
  }

  combinations(n, r) {
    if (n < 0 || r < 0 || r > n) return 0;
    return this.factorial(n) / (this.factorial(r) * this.factorial(n - r));
  }

  factorial(n) {
    if (n < 0 || !Number.isInteger(n)) throw new Error("Domain Error");
    if (n === 0 || n === 1) return 1;
    let res = 1;
    for (let i = 2; i <= n; i++) res *= i;
    return res;
  }
}

// -------------------------------------------------------------
// List statistics module (Data Editor / Stats calculations)
// -------------------------------------------------------------
class StatsEditor {
  constructor() {
    this.lists = { L1: [], L2: [], L3: [] };
    this.activeList = 'L1';
    this.rowIdx = 0;
  }

  clearList(listName) {
    this.lists[listName] = [];
    this.rowIdx = 0;
  }

  setVal(listName, idx, val) {
    if (isNaN(val)) return;
    this.lists[listName][idx] = val;
  }

  compute1Var(listName) {
    let arr = this.lists[listName].filter(x => x !== undefined && !isNaN(x));
    if (arr.length === 0) throw new Error("No Data");

    let n = arr.length;
    let sum = arr.reduce((a, b) => a + b, 0);
    let sumSq = arr.reduce((a, b) => a + b*b, 0);
    let mean = sum / n;
    
    // Std dev
    let variancePop = (sumSq - (sum * sum) / n) / n;
    let stdDevPop = Math.sqrt(variancePop);
    let varianceSam = (sumSq - (sum * sum) / n) / (n - 1);
    let stdDevSam = n > 1 ? Math.sqrt(varianceSam) : 0;

    let sorted = [...arr].sort((a,b) => a - b);
    let min = sorted[0];
    let max = sorted[sorted.length - 1];

    let getMedian = (subArr) => {
      let len = subArr.length;
      if (len === 0) return 0;
      let mid = Math.floor(len / 2);
      return len % 2 !== 0 ? subArr[mid] : (subArr[mid - 1] + subArr[mid]) / 2;
    };

    let med = getMedian(sorted);
    let q1 = 0, q3 = 0;
    let midIdx = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
      q1 = getMedian(sorted.slice(0, midIdx));
      q3 = getMedian(sorted.slice(midIdx));
    } else {
      q1 = getMedian(sorted.slice(0, midIdx));
      q3 = getMedian(sorted.slice(midIdx + 1));
    }

    return {
      n, mean, stdDevSam, stdDevPop, sum, sumSq, min, q1, med, q3, max
    };
  }

  compute2Var(xList, yList) {
    let xs = this.lists[xList].filter(x => x !== undefined && !isNaN(x));
    let ys = this.lists[yList].filter(x => x !== undefined && !isNaN(x));
    let n = Math.min(xs.length, ys.length);
    if (n === 0) throw new Error("No Data");

    let sumX = 0, sumY = 0, sumXSq = 0, sumYSq = 0, sumXY = 0;
    for (let i = 0; i < n; i++) {
      sumX += xs[i];
      sumY += ys[i];
      sumXSq += xs[i] * xs[i];
      sumYSq += ys[i] * ys[i];
      sumXY += xs[i] * ys[i];
    }

    let meanX = sumX / n;
    let meanY = sumY / n;

    // Linear regression y = ax + b
    let den = (n * sumXSq - sumX * sumX);
    let a = den !== 0 ? (n * sumXY - sumX * sumY) / den : 0;
    let b = meanY - a * meanX;

    // Correlation
    let numCorr = (n * sumXY - sumX * sumY);
    let denCorr = Math.sqrt((n * sumXSq - sumX * sumX) * (n * sumYSq - sumY * sumY));
    let r = denCorr !== 0 ? numCorr / denCorr : 0;

    return {
      n, meanX, meanY, sumX, sumY, sumXSq, sumYSq, sumXY, a, b, r
    };
  }
}

// -------------------------------------------------------------
// UI State & Display formatting Coordinator
// -------------------------------------------------------------
class UIController {
  constructor() {
    this.editor = new ExpressionEditor();
    this.variables = { x: Value.fromFraction(0), y: Value.fromFraction(0), z: Value.fromFraction(0), t: Value.fromFraction(0), a: Value.fromFraction(0), b: Value.fromFraction(0), c: Value.fromFraction(0) };
    this.lastAnswer = Value.fromFraction(0);
    
    // Settings
    this.angleMode = 'DEG';
    this.notation = 'NORM';
    this.decimalPlaces = 'FLOAT';
    this.displayMode = 'MATHPRINT';

    this.engine = new MathEngine(this.variables, this.lastAnswer, this.angleMode);
    this.stats = new StatsEditor();
    
    // UI History scrolling
    this.history = []; // Array of { exprNodes: [], resultVal: Value }
    this.historyIdx = -1;

    // Table Mode Data
    this.tableFormula = []; // Node tree
    this.tableStart = 0;
    this.tableStep = 1;
    this.tableXValues = [];
    this.tableAuto = true;
    this.tableCursorRow = 0;
    this.tableCursorCol = 0; // 0 for X, 1 for Y
    this.tableStepScreen = 0; // 0: Formula input, 1: Setup values, 2: Table view

    // App state flags
    this.is2ndActive = false;
    this.activeMenu = null; // 'MODE', 'PRB', 'MATH', 'DATA', 'STAT', 'RECALL', 'RESET', 'TABLE_SETUP', 'TABLE_VIEW', 'DATA_EDIT'
    this.menuSelectionIdx = 0;
    this.menuRows = [];
    this.isStoreWaiting = false;

    // Audio status
    this.soundEnabled = true;

    // Load from LocalStorage
    this.loadState();
    this.initDOM();
  }

  initDOM() {
    this.dom = {
      lines: [
        document.getElementById('line-0'),
        document.getElementById('line-1'),
        document.getElementById('line-2'),
        document.getElementById('line-3'),
      ],
      ind2nd: document.getElementById('ind-2nd'),
      indHyp: document.getElementById('ind-hyp'),
      indFix: document.getElementById('ind-fix'),
      indSci: document.getElementById('ind-sci'),
      indEng: document.getElementById('ind-eng'),
      indDeg: document.getElementById('ind-deg'),
      indRad: document.getElementById('ind-rad'),
      indGrad: document.getElementById('ind-grad'),
      indL1: document.getElementById('ind-l1'),
      indL2: document.getElementById('ind-l2'),
      indL3: document.getElementById('ind-l3'),
      arrUp: document.getElementById('ind-arrow-up'),
      arrDown: document.getElementById('ind-arrow-down'),
      arrLeft: document.getElementById('ind-arrow-left'),
      arrRight: document.getElementById('ind-arrow-right'),
      menuOverlay: document.getElementById('lcdMenuOverlay'),
      menuTitle: document.getElementById('menuTitle'),
      menuItems: document.getElementById('menuItems'),
      soundToggleBtn: document.getElementById('soundToggleBtn'),
      themeToggleBtn: document.getElementById('themeToggleBtn'),
      guideSidebar: document.getElementById('guideSidebar'),
      openSidebarBtn: document.getElementById('openSidebarBtn'),
      closeSidebarBtn: document.getElementById('closeSidebarBtn'),
      audioClick: document.getElementById('audioClick'),
      calcContainer: document.querySelector('.calculator')
    };

    // Attach Keypad listeners
    document.querySelectorAll('.btn, .dpad-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        let key = btn.getAttribute('data-key');
        this.handleButtonPress(key);
      });
    });

    // Sidebar listeners
    this.dom.openSidebarBtn.addEventListener('click', () => {
      this.dom.guideSidebar.classList.remove('hidden');
    });
    this.dom.closeSidebarBtn.addEventListener('click', () => {
      this.dom.guideSidebar.classList.add('hidden');
    });

    // Settings listeners
    this.dom.soundToggleBtn.addEventListener('click', () => {
      this.soundEnabled = !this.soundEnabled;
      this.dom.soundToggleBtn.textContent = `🔊 Sound: ${this.soundEnabled ? 'On' : 'Off'}`;
      this.playClick();
    });

    this.dom.themeToggleBtn.addEventListener('click', () => {
      let currentLCDTheme = this.dom.calcContainer.getAttribute('data-lcd-theme');
      if (currentLCDTheme === 'dark') {
        this.dom.calcContainer.setAttribute('data-lcd-theme', 'retro');
        document.body.removeAttribute('data-theme');
      } else {
        this.dom.calcContainer.setAttribute('data-lcd-theme', 'dark');
        document.body.setAttribute('data-theme', 'dark-mode');
      }
      this.playClick();
    });

    // Keyboard bindings
    window.addEventListener('keydown', (e) => {
      this.handleKeyboard(e);
    });

    this.updateScreen();
  }

  playClick() {
    if (this.soundEnabled) {
      this.dom.audioClick.currentTime = 0;
      this.dom.audioClick.play().catch(() => {});
    }
  }

  handleButtonPress(key) {
    this.playClick();

    // 2nd logic modifier
    let is2nd = this.is2ndActive;
    if (key !== '2nd') {
      this.is2ndActive = false;
      this.dom.ind2nd.classList.remove('active');
    }

    if (key === '2nd') {
      this.is2ndActive = !this.is2ndActive;
      this.dom.ind2nd.classList.toggle('active', this.is2ndActive);
      return;
    }

    // Direct redirection for menu structures
    if (this.activeMenu) {
      this.handleMenuPress(key, is2nd);
      return;
    }

    // Store value assignment
    if (this.isStoreWaiting) {
      if (key === 'vars') {
        this.editor.insert(NodeBuilder.variable(this.cycleVars(true)));
        this.isStoreWaiting = false;
        this.updateScreen();
      }
      return;
    }

    switch (key) {
      // Numbers
      case '0':
      case '1':
      case '2':
      case '3':
      case '4':
      case '5':
      case '6':
      case '7':
      case '8':
      case '9':
      case '.':
        if (is2nd && key === '0') {
          this.openResetMenu();
        } else {
          this.editor.insert(NodeBuilder.char(key));
        }
        break;
      
      // Basic Operators
      case '+':
      case '*':
      case '/':
        this.editor.insert(NodeBuilder.char(key === '*' ? '×' : (key === '/' ? '÷' : key)));
        break;
      case '-':
        this.editor.insert(NodeBuilder.char('−'));
        break;

      case '(-)':
        if (is2nd) {
          this.editor.insert(NodeBuilder.symbol('Ans'));
        } else {
          this.editor.insert(NodeBuilder.char('-'));
        }
        break;

      // Variables
      case 'vars':
        if (is2nd) {
          this.openRecallMenu();
        } else {
          this.editor.insert(NodeBuilder.variable(this.cycleVars()));
        }
        break;

      // Functions
      case 'x-1':
        if (is2nd) {
          this.editor.insert(NodeBuilder.char('!'));
        } else {
          this.editor.insert(NodeBuilder.char('^-1'));
        }
        break;

      case 'x2':
        if (is2nd) {
          this.editor.insert(NodeBuilder.radical());
        } else {
          let pNode = NodeBuilder.power();
          pNode.exp.push(NodeBuilder.char('2'));
          this.editor.insert(pNode);
          // Auto move cursor out of squared power to keep it simple
          this.editor.moveRight();
        }
        break;

      case '^':
        if (is2nd) {
          // x-th root is in MATH menu, but let's support a shortcut
          this.editor.insert(NodeBuilder.char('x√('));
        } else {
          this.editor.insert(NodeBuilder.power());
        }
        break;

      case 'sin':
        this.editor.insert(NodeBuilder.char(is2nd ? 'asin(' : 'sin('));
        break;
      case 'cos':
        this.editor.insert(NodeBuilder.char(is2nd ? 'acos(' : 'cos('));
        break;
      case 'tan':
        this.editor.insert(NodeBuilder.char(is2nd ? 'atan(' : 'tan('));
        break;
      case 'pi':
        if (is2nd) {
          this.editor.insert(NodeBuilder.char('%'));
        } else {
          this.editor.insert(NodeBuilder.symbol('π'));
        }
        break;
      case 'x10n':
        this.editor.insert(NodeBuilder.char('*10^('));
        break;

      case 'frac':
        if (is2nd) {
          // mixed fraction - represented simply as U n/d
          this.editor.insert(NodeBuilder.char('U'));
        } else {
          this.editor.insert(NodeBuilder.fraction());
        }
        break;

      case 'log':
        this.editor.insert(NodeBuilder.char(is2nd ? '10^(' : 'log('));
        break;
      case 'ln':
        this.editor.insert(NodeBuilder.char(is2nd ? 'e^(' : 'ln('));
        break;

      case '(':
        if (is2nd) {
          this.openPrbMenu();
        } else {
          this.editor.insert(NodeBuilder.char('('));
        }
        break;
      case ')':
        if (is2nd) {
          this.openAngleMenu();
        } else {
          this.editor.insert(NodeBuilder.char(')'));
        }
        break;

      // Navigations
      case 'ArrowLeft':
        this.editor.moveLeft();
        break;
      case 'ArrowRight':
        this.editor.moveRight();
        break;
      case 'ArrowUp':
        if (!this.editor.moveUp()) {
          // Scroll up history
          if (this.history.length > 0) {
            if (this.historyIdx === -1) this.historyIdx = this.history.length - 1;
            else if (this.historyIdx > 0) this.historyIdx--;
            this.loadHistoryToActive();
          }
        }
        break;
      case 'ArrowDown':
        if (!this.editor.moveDown()) {
          // Scroll down history
          if (this.history.length > 0 && this.historyIdx !== -1) {
            if (this.historyIdx < this.history.length - 1) {
              this.historyIdx++;
              this.loadHistoryToActive();
            } else {
              this.historyIdx = -1;
              this.editor.clear();
            }
          }
        }
        break;

      // Controls
      case 'del':
        if (is2nd) {
          // INS (insert toggle) - CSS cursor changes to underscore. In this app, we'll keep standard insertion.
        } else {
          this.editor.delete();
        }
        break;

      case 'clear':
        if (is2nd) {
          this.clearAllVariables();
        } else {
          this.editor.clear();
          this.historyIdx = -1;
        }
        break;

      case 'mode':
        if (is2nd) {
          // QUIT
          this.activeMenu = null;
        } else {
          this.openModeMenu();
        }
        break;

      case 'math':
        this.openMathMenu();
        break;
      case 'data':
        if (is2nd) {
          this.openStatMenu();
        } else {
          this.openDataEditScreen();
        }
        break;
      case 'table':
        this.openTableFormulaScreen();
        break;

      case 'sto':
        this.isStoreWaiting = true;
        break;

      case 'toggle':
        this.toggleResultExactDecimal();
        break;

      case 'enter':
        this.processEnter();
        break;
    }

    this.updateScreen();
  }

  // -------------------------------------------------------------
  // Calculator Actions / Calculation Pipeline
  // -------------------------------------------------------------
  processEnter() {
    if (this.editor.isEmpty()) return;
    
    // If waiting for store assignment
    if (this.isStoreWaiting) {
      this.isStoreWaiting = false;
      return;
    }

    let rawString = this.editor.serializeToMathString();
    
    // Check if storing to variable
    let storeMatch = rawString.match(/(.+)sto([xyztabc])/);
    if (storeMatch) {
      try {
        let calcStr = storeMatch[1];
        let varName = storeMatch[2];
        let val = this.engine.evaluate(calcStr);
        this.variables[varName] = val;
        this.lastAnswer = val;
        this.saveState();
        // Clear editor and display success
        this.editor.clear();
        this.history.push({ exprNodes: this.editor.root, resultVal: val });
        this.historyIdx = -1;
      } catch (err) {
        this.showError(err.message || 'Error');
      }
      return;
    }

    try {
      let val = this.engine.evaluate(rawString);
      
      // Save in history
      // We clone the root expression nodes
      let exprClone = JSON.parse(JSON.stringify(this.editor.root));
      this.history.push({ exprNodes: exprClone, resultVal: val });
      this.lastAnswer = val;
      this.engine.lastAnswer = val;
      this.historyIdx = -1;
      this.editor.clear(); // Clear current input
      this.saveState();
    } catch (err) {
      this.showError(err.message || 'Syntax Error');
    }
  }

  toggleResultExactDecimal() {
    if (this.history.length === 0) return;
    let lastHist = this.history[this.history.length - 1];
    if (lastHist.resultVal) {
      lastHist.resultVal.isExact = !lastHist.resultVal.isExact;
      this.updateScreen();
    }
  }

  loadHistoryToActive() {
    if (this.historyIdx !== -1 && this.history[this.historyIdx]) {
      let hist = this.history[this.historyIdx];
      this.editor.root = JSON.parse(JSON.stringify(hist.exprNodes));
      this.editor.path = [];
      this.editor.index = this.editor.root.length;
    }
  }

  showError(msg) {
    this.dom.lines[3].innerHTML = `<span style="color: #ff4757; font-weight: 700;">${msg}</span>`;
  }

  // Cycle through variables (x, y, z, t, a, b, c) on multiple presses
  cycleVars(isStore = false) {
    if (!this.lastVarPressTime || Date.now() - this.lastVarPressTime > 1500) {
      this.varIndex = 0;
    } else {
      this.varIndex = (this.varIndex + 1) % 7;
      // Delete the last inserted var if cycling
      if (!isStore) {
        this.editor.delete();
      }
    }
    this.lastVarPressTime = Date.now();
    let vars = ['x', 'y', 'z', 't', 'a', 'b', 'c'];
    return vars[this.varIndex];
  }

  clearAllVariables() {
    for (let k in this.variables) {
      this.variables[k] = Value.fromFraction(0);
    }
    this.saveState();
  }

  // -------------------------------------------------------------
  // Menu Overlay Handlers
  // -------------------------------------------------------------
  openModeMenu() {
    this.activeMenu = 'MODE';
    this.menuSelectionIdx = 0; // Row index
    this.menuRows = [
      { name: 'Angle', options: ['DEG', 'RAD', 'GRAD'], active: this.angleMode },
      { name: 'Notation', options: ['NORM', 'SCI', 'ENG'], active: this.notation },
      { name: 'Fix', options: ['FLOAT', '0', '1', '2', '3', '4', '5'], active: this.decimalPlaces },
      { name: 'Display', options: ['CLASSIC', 'MATHPRINT'], active: this.displayMode }
    ];
    this.renderMenuOverlay("MODE SETTINGS");
  }

  openPrbMenu() {
    this.activeMenu = 'PRB';
    this.menuSelectionIdx = 0;
    this.menuRows = [
      { name: 'Probability', options: ['nPr', 'nCr', '!', 'rand', 'randInt('], active: '' }
    ];
    this.renderMenuOverlay("PROBABILITY");
  }

  openMathMenu() {
    this.activeMenu = 'MATH';
    this.menuSelectionIdx = 0;
    this.menuRows = [
      { name: 'Math Functions', options: ['lcm(', 'gcd(', '³√(', 'abs(', 'min(', 'max('], active: '' }
    ];
    this.renderMenuOverlay("MATH FUNCTIONS");
  }

  openStatMenu() {
    this.activeMenu = 'STAT';
    this.menuSelectionIdx = 0;
    this.menuRows = [
      { name: 'Statistics Calculations', options: ['1-Var Stats', '2-Var Stats'], active: '' }
    ];
    this.renderMenuOverlay("STATISTICS");
  }

  openRecallMenu() {
    this.activeMenu = 'RECALL';
    this.menuSelectionIdx = 0;
    let varsList = Object.keys(this.variables).map(k => `${k.toUpperCase()} = ${formatDecimal(this.variables[k].toDouble())}`);
    this.menuRows = [
      { name: 'Recall Variables', options: varsList, active: '' }
    ];
    this.renderMenuOverlay("RECALL VARIABLES");
  }

  openResetMenu() {
    this.activeMenu = 'RESET';
    this.menuSelectionIdx = 0;
    this.menuRows = [
      { name: 'Reset Memory?', options: ['No', 'Yes'], active: 'No' }
    ];
    this.renderMenuOverlay("RESET ALL MEMORY");
  }

  renderMenuOverlay(title) {
    this.dom.menuTitle.textContent = title;
    this.dom.menuItems.innerHTML = '';
    
    if (this.activeMenu === 'MODE') {
      // Rows of horizontal options
      this.menuRows.forEach((row, rIdx) => {
        let rowDiv = document.createElement('div');
        rowDiv.className = `menu-row-container ${rIdx === this.menuSelectionIdx ? 'selected-row' : ''}`;
        
        let label = document.createElement('span');
        label.className = 'menu-row-label';
        label.textContent = `${row.name}: `;
        rowDiv.appendChild(label);

        row.options.forEach(opt => {
          let optSpan = document.createElement('span');
          optSpan.className = `menu-row-option ${opt === row.active ? 'active-option' : ''}`;
          optSpan.textContent = opt;
          
          // Click handler to select option directly
          optSpan.addEventListener('click', (e) => {
            e.stopPropagation();
            this.playClick();
            this.menuSelectionIdx = rIdx;
            row.active = opt;
            this.applyModeChange(rIdx, opt);
            this.renderMenuOverlay("MODE SETTINGS");
          });
          
          rowDiv.appendChild(optSpan);
        });

        this.dom.menuItems.appendChild(rowDiv);
      });
    } else {
      // Single vertical lists
      let options = this.menuRows[0].options;
      options.forEach((opt, idx) => {
        let div = document.createElement('div');
        div.className = `menu-item ${idx === this.menuSelectionIdx ? 'selected' : ''}`;
        div.textContent = `${idx + 1}: ${opt}`;
        
        // Click handler to select list item directly
        div.addEventListener('click', (e) => {
          e.stopPropagation();
          this.playClick();
          this.menuSelectionIdx = idx;
          this.executeMenuSelection(idx);
        });
        
        this.dom.menuItems.appendChild(div);
      });
    }
    
    this.dom.menuOverlay.classList.remove('hidden');
  }

  handleMenuPress(key, is2nd) {
    if (key === 'clear' || (is2nd && key === 'mode')) {
      // Exit menus
      this.activeMenu = null;
      this.dom.menuOverlay.classList.add('hidden');
      this.updateScreen();
      return;
    }

    if (this.activeMenu === 'MODE') {
      let currentRow = this.menuRows[this.menuSelectionIdx];
      let currentOptIdx = currentRow.options.indexOf(currentRow.active);

      if (key === 'ArrowUp') {
        this.menuSelectionIdx = (this.menuSelectionIdx - 1 + this.menuRows.length) % this.menuRows.length;
      } else if (key === 'ArrowDown') {
        this.menuSelectionIdx = (this.menuSelectionIdx + 1) % this.menuRows.length;
      } else if (key === 'ArrowLeft') {
        let len = currentRow.options.length;
        currentOptIdx = (currentOptIdx - 1 + len) % len;
        currentRow.active = currentRow.options[currentOptIdx];
        this.applyModeChange(this.menuSelectionIdx, currentRow.active);
      } else if (key === 'ArrowRight' || key === 'enter') {
        let len = currentRow.options.length;
        currentOptIdx = (currentOptIdx + 1) % len;
        currentRow.active = currentRow.options[currentOptIdx];
        this.applyModeChange(this.menuSelectionIdx, currentRow.active);
      }
      this.renderMenuOverlay("MODE SETTINGS");
    } else {
      // List based selection
      let options = this.menuRows[0].options;
      if (key === 'ArrowUp') {
        this.menuSelectionIdx = (this.menuSelectionIdx - 1 + options.length) % options.length;
        this.renderMenuOverlay(this.dom.menuTitle.textContent);
      } else if (key === 'ArrowDown') {
        this.menuSelectionIdx = (this.menuSelectionIdx + 1) % options.length;
        this.renderMenuOverlay(this.dom.menuTitle.textContent);
      } else if (key === 'enter' || /[1-9]/.test(key)) {
        let idx = key === 'enter' ? this.menuSelectionIdx : parseInt(key) - 1;
        if (idx >= 0 && idx < options.length) {
          this.executeMenuSelection(idx);
        }
      }
    }
  }

  applyModeChange(rowIdx, value) {
    if (rowIdx === 0) {
      this.angleMode = value;
      this.engine.angleMode = value;
    } else if (rowIdx === 1) {
      this.notation = value;
    } else if (rowIdx === 2) {
      this.decimalPlaces = value;
    } else if (rowIdx === 3) {
      this.displayMode = value;
    }
    this.saveState();
  }

  executeMenuSelection(idx) {
    let menu = this.activeMenu;
    this.activeMenu = null;
    this.dom.menuOverlay.classList.add('hidden');

    if (menu === 'PRB') {
      let prbs = ['nPr', 'nCr', '!', 'rand', 'randInt('];
      let val = prbs[idx];
      this.editor.insert(NodeBuilder.char(val));
    } else if (menu === 'MATH') {
      let maths = ['lcm(', 'gcd(', '³√(', 'abs(', 'min(', 'max('];
      let val = maths[idx];
      this.editor.insert(NodeBuilder.char(val));
    } else if (menu === 'STAT') {
      if (idx === 0) {
        this.runStatistics(1);
      } else {
        this.runStatistics(2);
      }
    } else if (menu === 'RECALL') {
      let vars = ['x', 'y', 'z', 't', 'a', 'b', 'c'];
      let selectedVar = vars[idx];
      this.editor.insert(NodeBuilder.variable(selectedVar));
    } else if (menu === 'RESET') {
      if (idx === 1) {
        // YES Reset
        this.clearAllVariables();
        this.stats.clearList('L1');
        this.stats.clearList('L2');
        this.stats.clearList('L3');
        this.history = [];
        this.lastAnswer = Value.fromFraction(0);
        this.engine.lastAnswer = this.lastAnswer;
        this.saveState();
      }
    }
    this.updateScreen();
  }

  // -------------------------------------------------------------
  // Data Statistics Grid Editing
  // -------------------------------------------------------------
  openDataEditScreen() {
    this.activeMenu = 'DATA_EDIT';
    this.stats.rowIdx = 0;
    this.stats.activeList = 'L1';
    this.renderDataGrid();
  }

  renderDataGrid() {
    this.dom.menuTitle.textContent = "DATA LIST EDITOR";
    this.dom.menuItems.innerHTML = '';
    
    // Construct Grid
    let table = document.createElement('table');
    table.className = 'data-grid-table';
    
    let trHead = document.createElement('tr');
    ['L1', 'L2', 'L3'].forEach(col => {
      let th = document.createElement('th');
      th.textContent = col;
      if (col === this.stats.activeList) th.className = 'active-col-header';
      trHead.appendChild(th);
    });
    table.appendChild(trHead);

    // Show 4 visible rows (scrollable)
    let startRow = Math.max(0, this.stats.rowIdx - 2);
    for (let r = 0; r < 4; r++) {
      let actualRowIdx = startRow + r;
      let tr = document.createElement('tr');
      
      ['L1', 'L2', 'L3'].forEach(listKey => {
        let td = document.createElement('td');
        let val = this.stats.lists[listKey][actualRowIdx];
        td.textContent = (val !== undefined) ? val : '';
        
        if (listKey === this.stats.activeList && actualRowIdx === this.stats.rowIdx) {
          td.className = 'active-cell';
          // Cursor block in active cell
          td.innerHTML = `${td.textContent}<span class="cursor"></span>`;
        }
        
        // Add click listener to select this cell directly
        td.addEventListener('click', () => {
          this.playClick();
          this.stats.activeList = listKey;
          this.stats.rowIdx = actualRowIdx;
          this.renderDataGrid();
        });
        
        tr.appendChild(td);
      });
      table.appendChild(tr);
    }

    // Footnote row index
    let footerInfo = document.createElement('div');
    footerInfo.className = 'data-grid-footer';
    footerInfo.textContent = `${this.stats.activeList}[${this.stats.rowIdx + 1}] = ${this.stats.lists[this.stats.activeList][this.stats.rowIdx] || ''}`;

    this.dom.menuItems.appendChild(table);
    this.dom.menuItems.appendChild(footerInfo);
    this.dom.menuOverlay.classList.remove('hidden');
    this.updateIndicators();
  }

  runStatistics(varsMode) {
    try {
      if (varsMode === 1) {
        let list = this.stats.activeList; // Run on current active list
        let res = this.stats.compute1Var(list);
        this.displayStatsResults(res, 1);
      } else {
        // Assume L1 and L2 for 2-Var stats
        let res = this.stats.compute2Var('L1', 'L2');
        this.displayStatsResults(res, 2);
      }
    } catch (err) {
      this.showError(err.message || 'Stats Error');
    }
  }

  displayStatsResults(res, mode) {
    this.activeMenu = 'STATS_RESULTS';
    this.menuSelectionIdx = 0;
    
    let listItems = [];
    if (mode === 1) {
      listItems = [
        `n = ${res.n}`,
        `x̄ = ${formatDecimal(res.mean)}`,
        `Sx = ${formatDecimal(res.stdDevSam)}`,
        `σx = ${formatDecimal(res.stdDevPop)}`,
        `Σx = ${formatDecimal(res.sum)}`,
        `Σx² = ${formatDecimal(res.sumSq)}`,
        `Min = ${formatDecimal(res.min)}`,
        `Q1 = ${formatDecimal(res.q1)}`,
        `Med = ${formatDecimal(res.med)}`,
        `Q3 = ${formatDecimal(res.q3)}`,
        `Max = ${formatDecimal(res.max)}`
      ];
    } else {
      listItems = [
        `n = ${res.n}`,
        `x̄ = ${formatDecimal(res.meanX)}`,
        `ȳ = ${formatDecimal(res.meanY)}`,
        `Σx = ${formatDecimal(res.sumX)}`,
        `Σy = ${formatDecimal(res.sumY)}`,
        `Σx² = ${formatDecimal(res.sumXSq)}`,
        `Σy² = ${formatDecimal(res.sumYSq)}`,
        `Σxy = ${formatDecimal(res.sumXY)}`,
        `a = ${formatDecimal(res.a)}`,
        `b = ${formatDecimal(res.b)}`,
        `r = ${formatDecimal(res.r)}`
      ];
    }

    this.menuRows = [{ name: 'Stat Results', options: listItems, active: '' }];
    this.renderMenuOverlay("STATISTICS RESULTS");
  }

  // -------------------------------------------------------------
  // Function Table Building Screen
  // -------------------------------------------------------------
  openTableFormulaScreen() {
    this.activeMenu = 'TABLE_SETUP';
    this.tableStepScreen = 0;
    this.editor.clear();
    // Pre-populate if we have historical formula
    if (this.tableFormula.length > 0) {
      this.editor.root = JSON.parse(JSON.stringify(this.tableFormula));
      this.editor.index = this.editor.root.length;
    }
  }

  renderTableSetup() {
    this.dom.menuTitle.textContent = "TABLE FUNCTION";
    this.dom.menuItems.innerHTML = '';

    if (this.tableStepScreen === 0) {
      // Formula editor y = ...
      let container = document.createElement('div');
      container.className = 'table-setup-formula';
      
      let label = document.createElement('div');
      label.textContent = "Enter Function f(x):";
      label.className = 'table-setup-label';
      container.appendChild(label);

      let formulaInput = document.createElement('div');
      formulaInput.className = 'table-formula-input-box';
      formulaInput.innerHTML = `f(x) = ${this.editor.renderHTML()}`;
      container.appendChild(formulaInput);

      this.dom.menuItems.appendChild(container);
    } else if (this.tableStepScreen === 1) {
      // Setup range: Start, Step, Auto/Ask
      let container = document.createElement('div');
      container.className = 'table-setup-fields';

      let fields = [
        { label: 'Start: ', val: this.tableStart, key: 'start' },
        { label: 'Step:  ', val: this.tableStep, key: 'step' },
        { label: 'Input: ', val: this.tableAuto ? 'Auto' : 'Ask-x', key: 'mode' }
      ];

      fields.forEach((f, idx) => {
        let div = document.createElement('div');
        div.className = `menu-row-container ${idx === this.menuSelectionIdx ? 'selected-row' : ''}`;
        
        let labelSpan = document.createElement('span');
        labelSpan.textContent = f.label;
        div.appendChild(labelSpan);

        let valSpan = document.createElement('span');
        valSpan.textContent = f.val;
        if (idx === this.menuSelectionIdx) {
          valSpan.className = 'active-option';
        }
        div.appendChild(valSpan);
        
        // Add click listener to select this field directly
        div.addEventListener('click', () => {
          this.playClick();
          this.menuSelectionIdx = idx;
          if (idx === 2) {
            // Toggle Auto/Ask directly
            this.tableAuto = !this.tableAuto;
          }
          this.renderTableSetup();
        });
        
        container.appendChild(div);
      });

      let okRow = document.createElement('div');
      okRow.className = `menu-row-container ${3 === this.menuSelectionIdx ? 'selected-row' : ''}`;
      okRow.textContent = "[ OK ]";
      
      // Click listener to execute table view
      okRow.addEventListener('click', () => {
        this.playClick();
        this.menuSelectionIdx = 3;
        this.runTableCalculation();
      });
      
      container.appendChild(okRow);

      this.dom.menuItems.appendChild(container);
    }

    this.dom.menuOverlay.classList.remove('hidden');
  }

  runTableCalculation() {
    this.activeMenu = 'TABLE_VIEW';
    this.tableStepScreen = 2;
    this.tableCursorRow = 0;
    this.tableCursorCol = 0;
    
    // Evaluate initial 10 values
    this.tableXValues = [];
    if (this.tableAuto) {
      for (let i = 0; i < 20; i++) {
        this.tableXValues.push(this.tableStart + i * this.tableStep);
      }
    } else {
      // Ask mode: populate with empty space
      for (let i = 0; i < 5; i++) {
        this.tableXValues.push(null);
      }
    }
    this.renderTableView();
  }

  renderTableView() {
    this.dom.menuTitle.textContent = "TABLE: y = f(x)";
    this.dom.menuItems.innerHTML = '';

    let table = document.createElement('table');
    table.className = 'data-grid-table';

    let trHead = document.createElement('tr');
    let thX = document.createElement('th'); thX.textContent = 'x';
    let thY = document.createElement('th'); thY.textContent = 'y = f(x)';
    trHead.appendChild(thX);
    trHead.appendChild(thY);
    table.appendChild(trHead);

    let startRow = Math.max(0, this.tableCursorRow - 2);
    for (let r = 0; r < 4; r++) {
      let actualRowIdx = startRow + r;
      let tr = document.createElement('tr');

      let xVal = this.tableXValues[actualRowIdx];
      let yValHTML = '';

      if (xVal !== null && xVal !== undefined) {
        try {
          // Evaluate formula replacing x with xVal
          let formulaStr = new ExpressionEditor();
          formulaStr.root = JSON.parse(JSON.stringify(this.tableFormula));
          let parsedStr = formulaStr.serializeToMathString();
          
          let engineCopy = new MathEngine({ x: Value.fromDecimal(xVal) }, this.lastAnswer, this.angleMode);
          let val = engineCopy.evaluate(parsedStr);
          yValHTML = formatDecimal(val.toDouble());
        } catch (err) {
          yValHTML = 'Error';
        }
      }

      // X Cell
      let tdX = document.createElement('td');
      tdX.textContent = xVal !== null && xVal !== undefined ? xVal : '';
      if (this.tableCursorRow === actualRowIdx && this.tableCursorCol === 0) {
        tdX.className = 'active-cell';
        tdX.innerHTML = `${tdX.textContent}<span class="cursor"></span>`;
      }
      
      // Click listener to select X cell
      tdX.addEventListener('click', () => {
        this.playClick();
        this.tableCursorRow = actualRowIdx;
        this.tableCursorCol = 0;
        this.renderTableView();
      });
      
      tr.appendChild(tdX);

      // Y Cell
      let tdY = document.createElement('td');
      tdY.innerHTML = yValHTML;
      if (this.tableCursorRow === actualRowIdx && this.tableCursorCol === 1) {
        tdY.className = 'active-cell';
      }
      
      // Click listener to select Y cell
      tdY.addEventListener('click', () => {
        this.playClick();
        this.tableCursorRow = actualRowIdx;
        this.tableCursorCol = 1;
        this.renderTableView();
      });
      
      tr.appendChild(tdY);

      table.appendChild(tr);
    }

    this.dom.menuItems.appendChild(table);
    this.dom.menuOverlay.classList.remove('hidden');
  }

  // -------------------------------------------------------------
  // Keyboard Routing
  // -------------------------------------------------------------
  handleKeyboard(e) {
    let key = e.key;

    // Override page scrolling
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
      e.preventDefault();
    }

    if (key >= '0' && key <= '9') { this.handleButtonPress(key); }
    else if (key === '.') { this.handleButtonPress('.'); }
    else if (key === '+') { this.handleButtonPress('+'); }
    else if (key === '-') { this.handleButtonPress('-'); }
    else if (key === '*') { this.handleButtonPress('*'); }
    else if (key === '/') { this.handleButtonPress('/'); }
    else if (key === '(' || key === ')') { this.handleButtonPress(key); }
    else if (key === 'Enter' || key === '=') { this.handleButtonPress('enter'); }
    else if (key === 'Backspace') { this.handleButtonPress('del'); }
    else if (key === 'Escape') { this.handleButtonPress('clear'); }
    else if (key === 'ArrowLeft') { this.handleButtonPress('ArrowLeft'); }
    else if (key === 'ArrowRight') { this.handleButtonPress('ArrowRight'); }
    else if (key === 'ArrowUp') { this.handleButtonPress('ArrowUp'); }
    else if (key === 'ArrowDown') { this.handleButtonPress('ArrowDown'); }
    else if (key === 'Shift') { this.handleButtonPress('2nd'); }
    else if (key.toLowerCase() === 'f') { this.handleButtonPress('frac'); }
    else if (key.toLowerCase() === 't') { this.handleButtonPress('toggle'); }
    else if (key.toLowerCase() === 's') { this.handleButtonPress('sin'); }
    else if (key.toLowerCase() === 'o') { this.handleButtonPress('cos'); }
    else if (key.toLowerCase() === 'a') { this.handleButtonPress('tan'); }
    else if (key.toLowerCase() === 'v') { this.handleButtonPress('vars'); }
    else if (key.toLowerCase() === 'm') { this.handleButtonPress('mode'); }
    else if (key.toLowerCase() === 'd') { this.handleButtonPress('data'); }
  }

  // -------------------------------------------------------------
  // Combined Screen Rendering Engine
  // -------------------------------------------------------------
  updateScreen() {
    this.updateIndicators();

    if (this.activeMenu === 'DATA_EDIT') {
      this.renderDataGrid();
      return;
    }

    if (this.activeMenu === 'TABLE_SETUP') {
      this.renderTableSetup();
      return;
    }

    if (this.activeMenu === 'TABLE_VIEW') {
      this.renderTableView();
      return;
    }

    if (this.activeMenu) {
      // General overlay lists (MODE, STAT, RECALL, etc.)
      this.renderMenuOverlay(this.dom.menuTitle.textContent);
      return;
    }

    // Default Multi-line calculations rendering
    // Render lines 0 to 2 as historical logs
    let historyCount = this.history.length;
    for (let r = 0; r < 3; r++) {
      let histIdx = historyCount - 3 + r;
      let lineDiv = this.dom.lines[r];
      lineDiv.classList.remove('active-line');
      
      if (histIdx >= 0 && histIdx < historyCount) {
        let histItem = this.history[histIdx];
        
        // Show expression in MathPrint/Classic format
        let editorCopy = new ExpressionEditor();
        editorCopy.root = histItem.exprNodes;
        
        let exprHTML = editorCopy.renderNodes(editorCopy.root, null, -1);
        let resHTML = formatValueHTML(histItem.resultVal, this.displayMode === 'CLASSIC');

        lineDiv.innerHTML = `<span class="history-expr">${exprHTML}</span><span class="history-res">${resHTML}</span>`;
      } else {
        lineDiv.innerHTML = '';
      }
    }

    // Line 3 is active input line
    let activeLine = this.dom.lines[3];
    activeLine.classList.add('active-line');
    activeLine.innerHTML = this.editor.renderHTML();
  }

  updateIndicators() {
    // Clear indicators
    document.querySelectorAll('.indicator').forEach(ind => ind.classList.remove('active'));

    // Set Active State based on parameters
    this.dom.indDeg.classList.toggle('active', this.angleMode === 'DEG');
    this.dom.indRad.classList.toggle('active', this.angleMode === 'RAD');
    this.dom.indGrad.classList.toggle('active', this.angleMode === 'GRAD');

    this.dom.indSci.classList.toggle('active', this.notation === 'SCI');
    this.dom.indEng.classList.toggle('active', this.notation === 'ENG');
    this.dom.indFix.classList.toggle('active', this.decimalPlaces !== 'FLOAT');
    this.dom.ind2nd.classList.toggle('active', this.is2ndActive);

    // List Stats indicators
    this.dom.indL1.classList.toggle('active', this.stats.lists['L1'].length > 0);
    this.dom.indL2.classList.toggle('active', this.stats.lists['L2'].length > 0);
    this.dom.indL3.classList.toggle('active', this.stats.lists['L3'].length > 0);
  }

  // -------------------------------------------------------------
  // Data Grid Key routing
  // -------------------------------------------------------------
  handleMenuPressDataGrid(key) {
    if (key === 'ArrowUp') {
      if (this.stats.rowIdx > 0) this.stats.rowIdx--;
    } else if (key === 'ArrowDown' || key === 'enter') {
      this.stats.rowIdx++;
    } else if (key === 'ArrowLeft') {
      let cols = ['L1', 'L2', 'L3'];
      let idx = cols.indexOf(this.stats.activeList);
      this.stats.activeList = cols[(idx - 1 + 3) % 3];
    } else if (key === 'ArrowRight') {
      let cols = ['L1', 'L2', 'L3'];
      let idx = cols.indexOf(this.stats.activeList);
      this.stats.activeList = cols[(idx + 1) % 3];
    } else if (key === 'del') {
      this.stats.lists[this.stats.activeList].splice(this.stats.rowIdx, 1);
    } else if (key === 'clear') {
      this.stats.clearList(this.stats.activeList);
    } else if (/[0-9.-]/.test(key) || key === '(-)') {
      // Direct insertion of data digits
      let cellStr = (this.stats.lists[this.stats.activeList][this.stats.rowIdx] || '').toString();
      let addedChar = key === '(-)' ? '-' : key;
      cellStr += addedChar;
      this.stats.setVal(this.stats.activeList, this.stats.rowIdx, parseFloat(cellStr));
    }
    this.renderDataGrid();
  }

  // -------------------------------------------------------------
  // Table Navigation Routing
  // -------------------------------------------------------------
  handleMenuPressTableSetup(key) {
    if (this.tableStepScreen === 0) {
      // Editing formula
      if (key === 'enter') {
        if (this.editor.isEmpty()) return;
        this.tableFormula = JSON.parse(JSON.stringify(this.editor.root));
        this.tableStepScreen = 1;
        this.menuSelectionIdx = 0;
        this.editor.clear();
      } else {
        // Forward back to main editor routes
        // (Will be captured automatically in general key handler)
      }
    } else if (this.tableStepScreen === 1) {
      // Setup options Start, Step, OK
      if (key === 'ArrowUp') {
        this.menuSelectionIdx = (this.menuSelectionIdx - 1 + 4) % 4;
      } else if (key === 'ArrowDown') {
        this.menuSelectionIdx = (this.menuSelectionIdx + 1) % 4;
      } else if (key === 'ArrowLeft' || key === 'ArrowRight') {
        if (this.menuSelectionIdx === 2) {
          this.tableAuto = !this.tableAuto;
        }
      } else if (key === 'enter') {
        if (this.menuSelectionIdx === 3) {
          // OK click
          this.runTableCalculation();
          return;
        }
      } else if (/[0-9.-]/.test(key) || key === '(-)') {
        let added = key === '(-)' ? '-' : key;
        if (this.menuSelectionIdx === 0) {
          let str = this.tableStart.toString();
          str = str === '0' ? added : str + added;
          this.tableStart = parseFloat(str) || 0;
        } else if (this.menuSelectionIdx === 1) {
          let str = this.tableStep.toString();
          str = str === '0' ? added : str + added;
          this.tableStep = parseFloat(str) || 1;
        }
      } else if (key === 'del') {
        if (this.menuSelectionIdx === 0) this.tableStart = 0;
        if (this.menuSelectionIdx === 1) this.tableStep = 1;
      }
    }
    this.renderTableSetup();
  }

  handleMenuPressTableView(key) {
    if (key === 'ArrowUp') {
      if (this.tableCursorRow > 0) this.tableCursorRow--;
    } else if (key === 'ArrowDown') {
      this.tableCursorRow++;
      // Auto expand range
      if (this.tableCursorRow >= this.tableXValues.length) {
        if (this.tableAuto) {
          this.tableXValues.push(this.tableStart + this.tableCursorRow * this.tableStep);
        } else {
          this.tableXValues.push(null);
        }
      }
    } else if (key === 'ArrowLeft' || key === 'ArrowRight') {
      this.tableCursorCol = this.tableCursorCol === 0 ? 1 : 0;
    } else if (!this.tableAuto && this.tableCursorCol === 0) {
      // In Ask mode, allow entering values in column X
      if (/[0-9.-]/.test(key) || key === '(-)') {
        let cellStr = (this.tableXValues[this.tableCursorRow] !== null ? this.tableXValues[this.tableCursorRow] : '').toString();
        let added = key === '(-)' ? '-' : key;
        cellStr += added;
        this.tableXValues[this.tableCursorRow] = parseFloat(cellStr) || 0;
      } else if (key === 'del') {
        this.tableXValues[this.tableCursorRow] = null;
      }
    }
    this.renderTableView();
  }

  // -------------------------------------------------------------
  // Storage Managers
  // -------------------------------------------------------------
  saveState() {
    let state = {
      variables: {},
      angleMode: this.angleMode,
      notation: this.notation,
      decimalPlaces: this.decimalPlaces,
      displayMode: this.displayMode,
      lists: this.stats.lists
    };
    // Map Value properties to plain objects
    for (let k in this.variables) {
      state.variables[k] = {
        isExact: this.variables[k].isExact,
        dec: this.variables[k].dec,
        terms: this.variables[k].terms
      };
    }
    localStorage.setItem('ti30xs_state', JSON.stringify(state));
  }

  loadState() {
    let raw = localStorage.getItem('ti30xs_state');
    if (!raw) return;
    try {
      let state = JSON.parse(raw);
      this.angleMode = state.angleMode || 'DEG';
      this.notation = state.notation || 'NORM';
      this.decimalPlaces = state.decimalPlaces || 'FLOAT';
      this.displayMode = state.displayMode || 'MATHPRINT';
      
      if (state.variables) {
        for (let k in state.variables) {
          let v = state.variables[k];
          this.variables[k] = new Value(v.terms, v.dec);
        }
      }
      if (state.lists) {
        this.stats.lists = state.lists;
      }
    } catch(e) {
      console.error("Error loading localStorage state:", e);
    }
  }
}

// -------------------------------------------------------------
// Combined Formatter Utilities (Fractions / Radicals / Scientific)
// -------------------------------------------------------------
function formatDecimalText(num, notation = 'NORM', fix = 'FLOAT') {
  return formatDecimal(num, notation, fix);
}

function formatDecimal(num, notation = 'NORM', fix = 'FLOAT') {
  if (isNaN(num)) return 'Error';
  if (!isFinite(num)) return num < 0 ? '-Infinity' : 'Infinity';
  
  let rounded = num;
  if (fix !== 'FLOAT') {
    rounded = parseFloat(num.toFixed(parseInt(fix)));
  }
  
  if (notation === 'SCI') {
    let exponent = Math.floor(Math.log10(Math.abs(rounded) || 1));
    let coeff = rounded / Math.pow(10, exponent);
    let coeffStr = (fix === 'FLOAT') ? coeff.toPrecision(8).replace(/\.?0+$/, "") : coeff.toFixed(parseInt(fix));
    return `${coeffStr}×10^(${exponent})`;
  } else if (notation === 'ENG') {
    let exponent = Math.floor(Math.log10(Math.abs(rounded) || 1));
    let engExponent = Math.floor(exponent / 3) * 3;
    let coeff = rounded / Math.pow(10, engExponent);
    let coeffStr = (fix === 'FLOAT') ? coeff.toPrecision(8).replace(/\.?0+$/, "") : coeff.toFixed(parseInt(fix));
    return `${coeffStr}×10^(${engExponent})`;
  } else {
    if (Math.abs(rounded) >= 1e10 || (Math.abs(rounded) < 1e-3 && rounded !== 0)) {
      let exponent = Math.floor(Math.log10(Math.abs(rounded) || 1));
      let coeff = rounded / Math.pow(10, exponent);
      let coeffStr = coeff.toPrecision(8).replace(/\.?0+$/, "");
      return `${coeffStr}×10^(${exponent})`;
    }
    if (fix === 'FLOAT') {
      let str = rounded.toString();
      if (str.length > 12) {
        str = rounded.toPrecision(10).replace(/\.?0+$/, "");
      }
      return str;
    } else {
      return rounded.toFixed(parseInt(fix));
    }
  }
}

function formatValueHTML(value, forceDecimal = false) {
  if (forceDecimal || !value.isExact || value.terms.length === 0) {
    let rawText = formatDecimal(value.dec, ui.notation, ui.decimalPlaces);
    // Render exponential base visually
    let sciMatch = rawText.match(/(.+)×10\^\((.+)\)/);
    if (sciMatch) {
      return `${sciMatch[1]}&times;10<span class="math-power"><span class="math-exponent">${sciMatch[2]}</span></span>`;
    }
    return rawText;
  }
  
  if (value.terms.length === 1) {
    let t = value.terms[0];
    if (t.coeff.d > 1) {
      let numHTML = '';
      if (t.pi) {
        let n = t.coeff.n;
        if (n === 1) numHTML = '&pi;';
        else if (n === -1) numHTML = '-&pi;';
        else numHTML = `${n}&pi;`;
      } else if (t.radical > 1) {
        let n = t.coeff.n;
        if (n === 1) numHTML = `&radic;${t.radical}`;
        else if (n === -1) numHTML = `-&radic;${t.radical}`;
        else numHTML = `${n}&radic;${t.radical}`;
      } else {
        numHTML = `${t.coeff.n}`;
      }
      return `<span class="math-fraction"><span class="math-numerator">${numHTML}</span><span class="math-denominator">${t.coeff.d}</span></span>`;
    }
  }
  
  let html = '';
  for (let i = 0; i < value.terms.length; i++) {
    let t = value.terms[i];
    let termHTML = '';
    let sign = '';
    let absCoeff = new Fraction(Math.abs(t.coeff.n), t.coeff.d);
    
    if (i > 0) {
      sign = t.coeff.n < 0 ? ' &minus; ' : ' + ';
    } else {
      sign = t.coeff.n < 0 ? '&minus;' : '';
    }
    
    if (t.pi) {
      let n = absCoeff.n;
      if (absCoeff.d === 1) {
        termHTML = (n === 1) ? '&pi;' : `${n}&pi;`;
      } else {
        termHTML = `<span class="math-fraction"><span class="math-numerator">${n === 1 ? '' : n}&pi;</span><span class="math-denominator">${absCoeff.d}</span></span>`;
      }
    } else if (t.radical > 1) {
      let n = absCoeff.n;
      if (absCoeff.d === 1) {
        termHTML = (n === 1) ? `&radic;${t.radical}` : `${n}&radic;${t.radical}`;
      } else {
        termHTML = `<span class="math-fraction"><span class="math-numerator">${n === 1 ? '' : n}&radic;${t.radical}</span><span class="math-denominator">${absCoeff.d}</span></span>`;
      }
    } else {
      if (absCoeff.d === 1) {
        termHTML = `${absCoeff.n}`;
      } else {
        termHTML = `<span class="math-fraction"><span class="math-numerator">${absCoeff.n}</span><span class="math-denominator">${absCoeff.d}</span></span>`;
      }
    }
    
    html += sign + termHTML;
  }
  return html;
}

// Redirect special sub-menu routers on active status
UIController.prototype.handleMenuPress = function(key, is2nd) {
  if (key === 'clear' || (is2nd && key === 'mode')) {
    this.activeMenu = null;
    this.dom.menuOverlay.classList.add('hidden');
    this.updateScreen();
    return;
  }

  if (this.activeMenu === 'DATA_EDIT') {
    this.handleMenuPressDataGrid(key);
    return;
  }

  if (this.activeMenu === 'TABLE_SETUP') {
    this.handleMenuPressTableSetup(key);
    return;
  }

  if (this.activeMenu === 'TABLE_VIEW') {
    this.handleMenuPressTableView(key);
    return;
  }

  // Handle standard lists (MODE, Probability, Reset etc)
  let options = this.menuRows[0].options;
  if (this.activeMenu === 'MODE') {
    let currentRow = this.menuRows[this.menuSelectionIdx];
    let currentOptIdx = currentRow.options.indexOf(currentRow.active);

    if (key === 'ArrowUp') {
      this.menuSelectionIdx = (this.menuSelectionIdx - 1 + this.menuRows.length) % this.menuRows.length;
    } else if (key === 'ArrowDown') {
      this.menuSelectionIdx = (this.menuSelectionIdx + 1) % this.menuRows.length;
    } else if (key === 'ArrowLeft') {
      let len = currentRow.options.length;
      currentOptIdx = (currentOptIdx - 1 + len) % len;
      currentRow.active = currentRow.options[currentOptIdx];
      this.applyModeChange(this.menuSelectionIdx, currentRow.active);
    } else if (key === 'ArrowRight' || key === 'enter') {
      let len = currentRow.options.length;
      currentOptIdx = (currentOptIdx + 1) % len;
      currentRow.active = currentRow.options[currentOptIdx];
      this.applyModeChange(this.menuSelectionIdx, currentRow.active);
    }
    this.renderMenuOverlay("MODE SETTINGS");
  } else {
    if (key === 'ArrowUp') {
      this.menuSelectionIdx = (this.menuSelectionIdx - 1 + options.length) % options.length;
      this.renderMenuOverlay(this.dom.menuTitle.textContent);
    } else if (key === 'ArrowDown') {
      this.menuSelectionIdx = (this.menuSelectionIdx + 1) % options.length;
      this.renderMenuOverlay(this.dom.menuTitle.textContent);
    } else if (key === 'enter') {
      this.executeMenuSelection(this.menuSelectionIdx);
    } else if (/[1-9]/.test(key)) {
      let idx = parseInt(key) - 1;
      if (idx >= 0 && idx < options.length) {
        this.executeMenuSelection(idx);
      }
    }
  }
};

// Initialize UI instances
const ui = new UIController();
