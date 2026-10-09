// The evaluator (blueprint sheets-engine.md "Workbook and recalculation"): a stored formula's tree to a value,
// with operators broadcasting over arrays as Sheets does. References resolve through the frame's layouts at
// evaluation time, so a formula always reads the cells its ids name.
import type { StoredRef } from '../sheet';
import type { BinaryOp, Node } from '../formula/ast';
import { deref, lift } from '../formula/fn';
import { FUNCTIONS } from '../formula/registry';
import { resolveRef } from '../formula/stored';
import { posToRange } from './refs';
import {
  compareScalars,
  err,
  isError,
  toNumber,
  toText,
  type Scalar,
  type Value,
} from '../formula/values';
import type { EvalValue, Frame } from './frame';

function arith(op: BinaryOp, a: Scalar, b: Scalar): Value {
  if (isError(a)) return a;
  if (isError(b)) return b;
  if (op === '&') {
    const x = toText(a);
    const y = toText(b);
    if (isError(x)) return x;
    if (isError(y)) return y;
    return x + y;
  }
  if (op === '=' || op === '<>' || op === '<' || op === '>' || op === '<=' || op === '>=') {
    const c = compareScalars(a, b);
    switch (op) {
      case '=':
        return c === 0;
      case '<>':
        return c !== 0;
      case '<':
        return c < 0;
      case '>':
        return c > 0;
      case '<=':
        return c <= 0;
      default:
        return c >= 0;
    }
  }
  const x = toNumber(a);
  const y = toNumber(b);
  if (typeof x !== 'number') return x;
  if (typeof y !== 'number') return y;
  let r: number;
  switch (op) {
    case '+':
      r = x + y;
      break;
    case '-':
      r = x - y;
      break;
    case '*':
      r = x * y;
      break;
    case '/':
      if (y === 0) return err('#DIV/0!');
      r = x / y;
      break;
    default:
      if (x === 0 && y < 0) return err('#DIV/0!');
      r = x ** y;
  }
  if (!Number.isFinite(r)) return err('#NUM!');
  // Full precision is kept; comparisons and display read 15 significant digits (compareScalars, numberText), so
  // 0.1 + 0.2 = 0.3 is TRUE without compounding rounding through a chain of operations.
  return r;
}

function unary(kind: 'neg' | 'pos' | 'pct', v: Value): Value {
  return lift([v], ([x]) => {
    if (kind === 'pos') return x!;
    const n = toNumber(x!);
    if (typeof n !== 'number') return n;
    return kind === 'neg' ? -n : n / 100;
  });
}

export function evaluate(node: Node, refs: readonly StoredRef[], f: Frame): EvalValue {
  switch (node.k) {
    case 'num':
      return node.v;
    case 'str':
      return node.v;
    case 'bool':
      return node.v;
    case 'err':
      return err(node.v);
    // A named range reads as its cells (formulas.md "Named ranges").
    case 'name': {
      const pos = f.ctx.name?.(node.v);
      const range = pos ? posToRange(pos, f) : null;
      return range ? { ref: range } : err('#NAME?', `Unknown name ${node.v}`);
    }
    case 'stored': {
      const ref = refs[node.i];
      const pos = ref ? resolveRef(ref, f.ctx) : null;
      const range = pos ? posToRange(pos, f) : null;
      return range ? { ref: range } : err('#REF!');
    }
    // A typed A1 reference never reaches evaluation: stored templates hold `@n` (INDIRECT reads A1 itself).
    case 'ref':
      return err('#REF!');
    case 'neg':
    case 'pos':
    case 'pct':
      return unary(node.k, deref(evaluate(node.a, refs, f), f));
    case 'bin': {
      const a = deref(evaluate(node.a, refs, f), f);
      const b = deref(evaluate(node.b, refs, f), f);
      return lift([a, b], ([x, y]) => arith(node.op, x!, y!));
    }
    case 'arr':
      return {
        rows: node.rows.map((row) => row.map((x) => deref(evaluate(x, refs, f), f))),
      };
    case 'call': {
      const def = FUNCTIONS[node.name];
      if (!def || !Object.prototype.hasOwnProperty.call(FUNCTIONS, node.name))
        return err('#NAME?', `Unknown function ${node.name}`);
      const n = node.args.length;
      if (n < def.min || n > def.max) {
        const expected =
          def.min === def.max
            ? `exactly ${def.min}`
            : n < def.min
              ? `at least ${def.min}`
              : `at most ${def.max}`;
        return err('#N/A', `Wrong number of arguments to ${node.name}. Expected ${expected}`);
      }
      if (def.volatile) f.volatile();
      const evalArg = (a: Node | null): EvalValue => (a ? evaluate(a, refs, f) : null);
      if (def.lazy)
        return def.impl(
          node.args.map((a) => () => evalArg(a)),
          f,
        );
      return def.impl(node.args.map(evalArg), f);
    }
  }
}
