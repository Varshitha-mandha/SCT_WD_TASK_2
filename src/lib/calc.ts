// Expression evaluator supporting scientific functions, constants, and operators.
// Operators: + - * / ^ %(postfix) !(postfix) and word op `mod`
// Functions: sqrt, sin, cos, tan, asin, acos, atan, log, ln, exp, abs
// Constants: pi, e
// `%` postfix: turns last value into value/100, OR for "a + b%" pattern computes a*b/100.

export type AngleMode = "deg" | "rad";

type Token =
  | { type: "num"; value: number }
  | { type: "op"; value: string } // + - * / ^ mod
  | { type: "unary"; value: "u-" | "u+" }
  | { type: "func"; value: string }
  | { type: "lparen" }
  | { type: "rparen" }
  | { type: "comma" };

const BINARY_PREC: Record<string, number> = {
  "+": 1,
  "-": 1,
  "*": 2,
  "/": 2,
  mod: 2,
  "^": 4,
};
const RIGHT_ASSOC: Record<string, boolean> = { "^": true };
const UNARY_PREC = 3;

const FUNCS = new Set([
  "sqrt",
  "sin",
  "cos",
  "tan",
  "asin",
  "acos",
  "atan",
  "log",
  "ln",
  "exp",
  "abs",
]);

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const src = input.replace(/\s+/g, " ").trim();

  const isDigit = (c: string) => c >= "0" && c <= "9";
  const isAlpha = (c: string) => /[a-zA-Z]/.test(c);

  while (i < src.length) {
    const ch = src[i];
    if (ch === " ") {
      i++;
      continue;
    }

    // Number
    if (isDigit(ch) || (ch === "." && isDigit(src[i + 1] ?? ""))) {
      let j = i;
      let sawDot = false;
      let sawExp = false;
      while (j < src.length) {
        const c = src[j];
        if (isDigit(c)) {
          j++;
          continue;
        }
        if (c === "." && !sawDot && !sawExp) {
          sawDot = true;
          j++;
          continue;
        }
        if ((c === "e" || c === "E") && !sawExp && j > i) {
          sawExp = true;
          j++;
          if (src[j] === "+" || src[j] === "-") j++;
          continue;
        }
        break;
      }
      const numStr = src.slice(i, j);
      const n = Number(numStr);
      if (!isFinite(n) || isNaN(n)) throw new Error("Invalid number");
      tokens.push({ type: "num", value: n });
      i = j;
      continue;
    }

    // Identifier (function or constant or `mod`)
    if (isAlpha(ch)) {
      let j = i;
      while (j < src.length && isAlpha(src[j])) j++;
      const name = src.slice(i, j).toLowerCase();
      if (name === "pi") tokens.push({ type: "num", value: Math.PI });
      else if (name === "e") tokens.push({ type: "num", value: Math.E });
      else if (name === "mod") tokens.push({ type: "op", value: "mod" });
      else if (FUNCS.has(name)) tokens.push({ type: "func", value: name });
      else throw new Error(`Unknown identifier: ${name}`);
      i = j;
      continue;
    }

    if (ch === "(") {
      tokens.push({ type: "lparen" });
      i++;
      continue;
    }
    if (ch === ")") {
      tokens.push({ type: "rparen" });
      i++;
      continue;
    }
    if (ch === ",") {
      tokens.push({ type: "comma" });
      i++;
      continue;
    }

    if ("+-*/^".includes(ch)) {
      const prev = tokens[tokens.length - 1];
      const isUnary =
        !prev ||
        prev.type === "op" ||
        prev.type === "unary" ||
        prev.type === "lparen" ||
        prev.type === "comma" ||
        prev.type === "func";
      if (isUnary && (ch === "+" || ch === "-")) {
        tokens.push({ type: "unary", value: ch === "-" ? "u-" : "u+" });
      } else {
        tokens.push({ type: "op", value: ch });
      }
      i++;
      continue;
    }

    if (ch === "!") {
      // Factorial postfix: encode as op token but handled with special precedence
      tokens.push({ type: "op", value: "!" });
      i++;
      continue;
    }

    if (ch === "%") {
      // Percent postfix; transform previous numeric expression.
      // For the simple sugar "a + b%" pattern, compute a*b/100.
      const prev = tokens[tokens.length - 1];
      if (!prev || prev.type === "op" || prev.type === "lparen") throw new Error("Invalid % usage");

      if (prev.type === "num") {
        const opTok = tokens[tokens.length - 2];
        const baseTok = tokens[tokens.length - 3];
        if (
          opTok &&
          opTok.type === "op" &&
          (opTok.value === "+" || opTok.value === "-") &&
          baseTok &&
          baseTok.type === "num"
        ) {
          prev.value = (baseTok.value * prev.value) / 100;
        } else {
          prev.value = prev.value / 100;
        }
      } else {
        // Otherwise wrap last subexpression: emit /100 as binary
        tokens.push({ type: "op", value: "/" });
        tokens.push({ type: "num", value: 100 });
      }
      i++;
      continue;
    }

    throw new Error(`Invalid character: ${ch}`);
  }

  return tokens;
}

function factorial(n: number): number {
  if (n < 0 || !Number.isInteger(n)) throw new Error("Factorial requires non-negative integer");
  if (n > 170) throw new Error("Overflow");
  let r = 1;
  for (let k = 2; k <= n; k++) r *= k;
  return r;
}

function applyFunc(name: string, x: number, mode: AngleMode): number {
  const toRad = (v: number) => (mode === "deg" ? (v * Math.PI) / 180 : v);
  const fromRad = (v: number) => (mode === "deg" ? (v * 180) / Math.PI : v);
  switch (name) {
    case "sqrt":
      if (x < 0) throw new Error("Invalid input for √");
      return Math.sqrt(x);
    case "sin":
      return Math.sin(toRad(x));
    case "cos":
      return Math.cos(toRad(x));
    case "tan": {
      const r = Math.tan(toRad(x));
      if (!isFinite(r) || Math.abs(r) > 1e15) throw new Error("Undefined");
      return r;
    }
    case "asin":
      if (x < -1 || x > 1) throw new Error("Out of range");
      return fromRad(Math.asin(x));
    case "acos":
      if (x < -1 || x > 1) throw new Error("Out of range");
      return fromRad(Math.acos(x));
    case "atan":
      return fromRad(Math.atan(x));
    case "log":
      if (x <= 0) throw new Error("Invalid input for log");
      return Math.log10(x);
    case "ln":
      if (x <= 0) throw new Error("Invalid input for ln");
      return Math.log(x);
    case "exp":
      return Math.exp(x);
    case "abs":
      return Math.abs(x);
    default:
      throw new Error(`Unknown function: ${name}`);
  }
}

function applyBinary(op: string, a: number, b: number): number {
  switch (op) {
    case "+":
      return a + b;
    case "-":
      return a - b;
    case "*":
      return a * b;
    case "/":
      if (b === 0) throw new Error("Cannot divide by zero");
      return a / b;
    case "^": {
      const r = Math.pow(a, b);
      if (isNaN(r)) throw new Error("Invalid power");
      return r;
    }
    case "mod":
      if (b === 0) throw new Error("Cannot mod by zero");
      return a - Math.floor(a / b) * b;
    default:
      throw new Error(`Unknown operator: ${op}`);
  }
}

// Shunting-yard to RPN
function toRPN(tokens: Token[]): Token[] {
  const out: Token[] = [];
  const stack: Token[] = [];
  for (const t of tokens) {
    if (t.type === "num") out.push(t);
    else if (t.type === "func") stack.push(t);
    else if (t.type === "comma") {
      while (stack.length && stack[stack.length - 1].type !== "lparen") out.push(stack.pop()!);
      if (!stack.length) throw new Error("Mismatched parens");
    } else if (t.type === "unary") {
      stack.push(t);
    } else if (t.type === "op") {
      if (t.value === "!") {
        // Postfix; emit immediately
        out.push(t);
        continue;
      }
      const p = BINARY_PREC[t.value];
      while (stack.length) {
        const top = stack[stack.length - 1];
        if (top.type === "op") {
          const tp = BINARY_PREC[top.value];
          if (tp > p || (tp === p && !RIGHT_ASSOC[t.value])) {
            out.push(stack.pop()!);
            continue;
          }
        } else if (top.type === "unary") {
          if (UNARY_PREC >= p) {
            out.push(stack.pop()!);
            continue;
          }
        } else if (top.type === "func") {
          out.push(stack.pop()!);
          continue;
        }
        break;
      }
      stack.push(t);
    } else if (t.type === "lparen") stack.push(t);
    else if (t.type === "rparen") {
      while (stack.length && stack[stack.length - 1].type !== "lparen") out.push(stack.pop()!);
      if (!stack.length) throw new Error("Mismatched parens");
      stack.pop();
      if (stack.length && stack[stack.length - 1].type === "func") out.push(stack.pop()!);
    }
  }
  while (stack.length) {
    const t = stack.pop()!;
    if (t.type === "lparen" || t.type === "rparen") throw new Error("Mismatched parens");
    out.push(t);
  }
  return out;
}

function evalRPN(rpn: Token[], mode: AngleMode): number {
  const stack: number[] = [];
  for (const t of rpn) {
    if (t.type === "num") {
      stack.push(t.value);
      continue;
    }
    if (t.type === "unary") {
      const a = stack.pop();
      if (a === undefined) throw new Error("Invalid expression");
      stack.push(t.value === "u-" ? -a : a);
      continue;
    }
    if (t.type === "func") {
      const a = stack.pop();
      if (a === undefined) throw new Error("Invalid expression");
      stack.push(applyFunc(t.value, a, mode));
      continue;
    }
    if (t.type === "op") {
      if (t.value === "!") {
        const a = stack.pop();
        if (a === undefined) throw new Error("Invalid expression");
        stack.push(factorial(a));
        continue;
      }
      const b = stack.pop();
      const a = stack.pop();
      if (a === undefined || b === undefined) throw new Error("Invalid expression");
      stack.push(applyBinary(t.value, a, b));
    }
  }
  if (stack.length !== 1) throw new Error("Invalid expression");
  const r = stack[0];
  if (!isFinite(r)) throw new Error("Overflow");
  return r;
}

export function evaluate(expr: string, mode: AngleMode = "rad"): number {
  if (!expr.trim()) throw new Error("Empty expression");
  return evalRPN(toRPN(tokenize(expr)), mode);
}

export function formatNumber(n: number): string {
  if (!isFinite(n)) return "Error";
  if (Object.is(n, -0)) n = 0;
  const abs = Math.abs(n);
  if (abs !== 0 && (abs >= 1e15 || abs < 1e-6)) {
    return n.toExponential(8).replace(/\.?0+e/, "e");
  }
  const rounded = Math.round(n * 1e10) / 1e10;
  const [intPart, decPart] = String(rounded).split(".");
  const sign = intPart.startsWith("-") ? "-" : "";
  const absInt = sign ? intPart.slice(1) : intPart;
  const withCommas = sign + Number(absInt).toLocaleString("en-US");
  return decPart ? `${withCommas}.${decPart}` : withCommas;
}

// Convert raw expression to a pretty display string.
const PRETTY: Array<[RegExp, string]> = [
  [/\bsqrt\b/g, "√"],
  [/\bpi\b/g, "π"],
  [/\bmod\b/g, "mod"],
  [/\*/g, "×"],
  [/\//g, "÷"],
];

export function prettyExpr(expr: string): string {
  let s = expr;
  for (const [re, rep] of PRETTY) s = s.replace(re, rep);
  return s;
}
