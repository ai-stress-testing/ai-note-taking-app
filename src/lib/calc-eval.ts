/**
 * Safe arithmetic evaluator — the "tool" behind /calc verification. The
 * local model only *extracts* the expression; the number comes from here,
 * so correctness never depends on model arithmetic. Recursive descent over
 * a fixed grammar; no eval, no Function, no identifiers beyond the
 * allowlist below.
 */

const FUNCS: Record<string, (x: number) => number> = {
  sqrt: Math.sqrt,
  abs: Math.abs,
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  ln: Math.log,
  log: Math.log10,
  exp: Math.exp,
};

const CONSTS: Record<string, number> = { pi: Math.PI, e: Math.E };

export function evaluateExpression(input: string): number {
  const src = input.trim();
  if (src.length === 0 || src.length > 500) throw new Error("empty or oversized expression");
  let pos = 0;

  const peek = () => src[pos];
  const skipWs = () => {
    while (pos < src.length && /\s/.test(src[pos])) pos++;
  };

  function parseExpr(): number {
    let left = parseTerm();
    for (;;) {
      skipWs();
      const op = peek();
      if (op === "+" || op === "-") {
        pos++;
        const right = parseTerm();
        left = op === "+" ? left + right : left - right;
      } else return left;
    }
  }

  function parseTerm(): number {
    let left = parsePower();
    for (;;) {
      skipWs();
      const op = peek();
      if (op === "*" || op === "/" || op === "%") {
        pos++;
        const right = parsePower();
        left = op === "*" ? left * right : op === "/" ? left / right : left % right;
      } else return left;
    }
  }

  function parsePower(): number {
    const base = parseUnary();
    skipWs();
    if (peek() === "^") {
      pos++;
      // Right-associative, like mathematical convention.
      return Math.pow(base, parsePower());
    }
    return base;
  }

  function parseUnary(): number {
    skipWs();
    if (peek() === "-") {
      pos++;
      return -parseUnary();
    }
    if (peek() === "+") {
      pos++;
      return parseUnary();
    }
    return parseAtom();
  }

  function parseAtom(): number {
    skipWs();
    if (peek() === "(") {
      pos++;
      const v = parseExpr();
      skipWs();
      if (peek() !== ")") throw new Error("missing closing paren");
      pos++;
      return v;
    }
    const numMatch = /^\d+(\.\d+)?([eE][+-]?\d+)?/.exec(src.slice(pos));
    if (numMatch) {
      pos += numMatch[0].length;
      return Number(numMatch[0]);
    }
    const wordMatch = /^[a-z]+/.exec(src.slice(pos));
    if (wordMatch) {
      const word = wordMatch[0];
      pos += word.length;
      if (word in CONSTS) return CONSTS[word];
      if (word in FUNCS) {
        skipWs();
        if (peek() !== "(") throw new Error(`${word} needs parentheses`);
        pos++;
        const arg = parseExpr();
        skipWs();
        if (peek() !== ")") throw new Error("missing closing paren");
        pos++;
        return FUNCS[word](arg);
      }
      throw new Error(`unknown identifier "${word}"`);
    }
    throw new Error(`unexpected character "${peek() ?? "end"}"`);
  }

  const result = parseExpr();
  skipWs();
  if (pos !== src.length) throw new Error(`unexpected trailing input "${src.slice(pos)}"`);
  if (!Number.isFinite(result)) throw new Error("expression did not evaluate to a finite number");
  return result;
}
