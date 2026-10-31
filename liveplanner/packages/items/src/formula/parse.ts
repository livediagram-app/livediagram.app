// The formula parser (docs/specs/026-plan/item-types.md "Formula fields"): recursive descent over the tokens, nesting
// held to FORMULA_DEPTH_MAX so a hostile formula can never run the stack out. `* /` bind before `+ -`, which bind
// before a comparison. A field stays a name here; references.ts turns names into ids and back.
import { FORMULA_DEPTH_MAX } from './limits';
import { FUNCTIONS, arityText, functionNamed, type FunctionName } from './functions';
import { column, tokenize, type FormulaSyntaxError, type Op, type Token } from './tokens';

export type FormulaNode =
  | { k: 'num'; v: number }
  | { k: 'str'; v: string }
  | { k: 'bool'; v: boolean }
  // A field, by the name (or, stored, the id) it was written with.
  | { k: 'ref'; name: string; at: number; end: number }
  | { k: 'neg'; x: FormulaNode }
  | { k: 'bin'; op: Op; a: FormulaNode; b: FormulaNode }
  | { k: 'call'; fn: FunctionName; args: FormulaNode[] };

const COMPARISONS: ReadonlySet<Op> = new Set(['=', '!=', '<', '<=', '>', '>=']);

class Fail extends Error {
  readonly error: string;
  readonly at: number;
  constructor(error: string, at: number) {
    super(error);
    this.error = error;
    this.at = at;
  }
}

// A formula's tree, or the first problem in it.
export function parseFormula(src: string): FormulaNode | FormulaSyntaxError {
  const tokens = tokenize(src);
  if (!Array.isArray(tokens)) return tokens;
  if (tokens.length === 0) return { error: 'The formula is empty', at: 0 };
  let pos = 0;
  let depth = 0;
  const peek = (): Token | undefined => tokens[pos];
  const endAt = () => src.length;
  const where = (tok: Token | undefined) => (tok ? tok.at : endAt());

  const enter = (at: number) => {
    depth += 1;
    if (depth > FORMULA_DEPTH_MAX)
      throw new Fail(`Nested too deeply (up to ${FORMULA_DEPTH_MAX})`, at);
  };

  const expect = (t: ')' | ',' | '(', what: string) => {
    const tok = peek();
    if (tok?.t !== t) throw new Fail(`Expected ${what} at ${column(where(tok))}`, where(tok));
    pos += 1;
  };

  function comparison(): FormulaNode {
    let a = sum();
    for (;;) {
      const tok = peek();
      if (tok?.t !== 'op' || !COMPARISONS.has(tok.v)) return a;
      pos += 1;
      a = { k: 'bin', op: tok.v, a, b: sum() };
    }
  }

  function sum(): FormulaNode {
    let a = product();
    for (;;) {
      const tok = peek();
      if (tok?.t !== 'op' || (tok.v !== '+' && tok.v !== '-')) return a;
      pos += 1;
      a = { k: 'bin', op: tok.v, a, b: product() };
    }
  }

  function product(): FormulaNode {
    let a = unary();
    for (;;) {
      const tok = peek();
      if (tok?.t !== 'op' || (tok.v !== '*' && tok.v !== '/')) return a;
      pos += 1;
      a = { k: 'bin', op: tok.v, a, b: unary() };
    }
  }

  function unary(): FormulaNode {
    const tok = peek();
    if (tok?.t === 'op' && (tok.v === '-' || tok.v === '+')) {
      pos += 1;
      enter(tok.at);
      const x = unary();
      depth -= 1;
      return tok.v === '-' ? { k: 'neg', x } : x;
    }
    return primary();
  }

  function primary(): FormulaNode {
    const tok = peek();
    if (!tok) throw new Fail(`Expected a value at ${column(endAt())}`, endAt());
    if (tok.t === 'num') {
      pos += 1;
      return { k: 'num', v: tok.v };
    }
    if (tok.t === 'str') {
      pos += 1;
      return { k: 'str', v: tok.v };
    }
    if (tok.t === '(') {
      pos += 1;
      enter(tok.at);
      const x = comparison();
      expect(')', ')');
      depth -= 1;
      return x;
    }
    if (tok.t === 'name') {
      pos += 1;
      if (!tok.braced && peek()?.t === '(') return call(tok);
      if (!tok.braced) {
        const word = tok.v.toLowerCase();
        if (word === 'true' || word === 'false') return { k: 'bool', v: word === 'true' };
      }
      return { k: 'ref', name: tok.v, at: tok.at, end: tok.end };
    }
    throw new Fail(`Expected a value at ${column(tok.at)}`, tok.at);
  }

  function call(name: Extract<Token, { t: 'name' }>): FormulaNode {
    const fn = functionNamed(name.v);
    if (!fn) throw new Fail(`Unknown function "${name.v}"`, name.at);
    enter(name.at);
    pos += 1; // (
    const args: FormulaNode[] = [];
    if (peek()?.t !== ')') {
      args.push(comparison());
      while (peek()?.t === ',') {
        pos += 1;
        args.push(comparison());
      }
    }
    expect(')', ')');
    depth -= 1;
    const { min, max } = FUNCTIONS[fn];
    if (args.length < min || args.length > max)
      throw new Fail(`${fn} takes ${arityText(fn)}`, name.at);
    return { k: 'call', fn, args };
  }

  try {
    const tree = comparison();
    const rest = peek();
    if (rest)
      throw new Fail(`Unexpected "${src.slice(rest.at, rest.end)}" at ${column(rest.at)}`, rest.at);
    return tree;
  } catch (e) {
    // Only a Fail is thrown in here.
    const fail = e as Fail;
    return { error: fail.error, at: fail.at };
  }
}

// Every field a tree names, each once, in the order written.
export function refsOf(tree: FormulaNode): Extract<FormulaNode, { k: 'ref' }>[] {
  const out: Extract<FormulaNode, { k: 'ref' }>[] = [];
  const walk = (n: FormulaNode) => {
    if (n.k === 'ref') {
      if (!out.some((r) => r.name === n.name)) out.push(n);
    } else if (n.k === 'neg') walk(n.x);
    else if (n.k === 'bin') {
      walk(n.a);
      walk(n.b);
    } else if (n.k === 'call') n.args.forEach(walk);
  };
  walk(tree);
  return out;
}
