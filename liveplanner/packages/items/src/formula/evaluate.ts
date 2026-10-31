// The formula evaluator (docs/specs/026-plan/item-types.md "Formula fields"): a tree to a value, every node counted
// against a shared step budget (FORMULA_STEPS_MAX across the formulas one card's value reads), so nothing a person
// writes can hang a board. Fields come from `read`, a value source the caller provides: today a card's own fields,
// later a rollup's result, without the evaluator knowing which.
import { FUNCTIONS, type FunctionEnv } from './functions';
import type { FormulaNode } from './parse';
import type { Op } from './tokens';
import {
  fail,
  finite,
  isDate,
  kindName,
  single,
  toNumber,
  type FormulaDate,
  type FormulaValue,
} from './values';

export interface EvalEnv {
  // A field's value on the card by its stored id; fails (FormulaFail) for one it can't read.
  read: (id: string) => FormulaValue;
  today: () => FormulaDate;
  // Steps left, shared by every formula one read works out.
  budget: { left: number };
}

type One = Exclude<FormulaValue, { list: unknown }>;

function add(a: One, b: One): FormulaValue {
  if (typeof a === 'string' || typeof b === 'string') return fail('Join text with concat()');
  if (isDate(a) && isDate(b)) return fail("Two dates can't be added: take one from the other");
  if (isDate(a)) return { day: a.day + Math.round(toNumber(b)) };
  if (isDate(b)) return { day: b.day + Math.round(toNumber(a)) };
  return finite(toNumber(a) + toNumber(b));
}

function subtract(a: One, b: One): FormulaValue {
  if (typeof a === 'string' || typeof b === 'string') return fail("Text can't be taken away");
  if (isDate(a) && isDate(b)) return a.day - b.day;
  if (isDate(a)) return { day: a.day - Math.round(toNumber(b)) };
  if (isDate(b)) return fail("A date can't be taken from a number");
  return finite(toNumber(a) - toNumber(b));
}

// Two values in order: -1, 0 or 1; blank meets a number as 0 and text as "", text ignores case, dates by day.
function compare(a: One, b: One, op: Op): number {
  const x = a === null ? blankLike(b) : a;
  const y = b === null ? blankLike(a) : b;
  if (x === null && y === null) return 0;
  if (isDate(x) && isDate(y)) return Math.sign(x.day - y.day);
  if (typeof x === 'number' && typeof y === 'number') return Math.sign(x - y);
  if (typeof x === 'string' && typeof y === 'string') {
    const p = x.toLowerCase();
    const q = y.toLowerCase();
    return p < q ? -1 : p > q ? 1 : 0;
  }
  if (typeof x === 'boolean' && typeof y === 'boolean') return Number(x) - Number(y);
  // Different kinds are never equal, and have no order.
  if (op === '=' || op === '!=') return NaN;
  return fail(`Can't compare ${kindName(x)} with ${kindName(y)}`);
}

// What blank stands for beside a value of another kind.
function blankLike(other: One): One {
  if (typeof other === 'number') return 0;
  if (typeof other === 'string') return '';
  if (typeof other === 'boolean') return false;
  return null;
}

function binary(op: Op, a: FormulaValue, b: FormulaValue): FormulaValue {
  const x = single(a);
  const y = single(b);
  switch (op) {
    case '+':
      return add(x, y);
    case '-':
      return subtract(x, y);
    case '*':
      return finite(toNumber(x) * toNumber(y));
    case '/': {
      const d = toNumber(y);
      return d === 0 ? fail('Divides by 0') : finite(toNumber(x) / d);
    }
    case '=':
      return compare(x, y, op) === 0;
    case '!=':
      return compare(x, y, op) !== 0;
    case '<':
      return compare(x, y, op) < 0;
    case '<=':
      return compare(x, y, op) <= 0;
    case '>':
      return compare(x, y, op) > 0;
    case '>=':
      return compare(x, y, op) >= 0;
  }
}

// A tree's value; throws FormulaFail (caught by formulaOutcome) for a problem on this card.
export function evaluateTree(tree: FormulaNode, env: EvalEnv): FormulaValue {
  const fns: FunctionEnv = { run: (n) => run(n), today: env.today };
  function run(n: FormulaNode): FormulaValue {
    env.budget.left -= 1;
    if (env.budget.left < 0) fail('Too much to work out');
    switch (n.k) {
      case 'num':
      case 'str':
      case 'bool':
        return n.v;
      case 'ref':
        return env.read(n.name);
      case 'neg': {
        const v = single(run(n.x));
        return isDate(v) ? fail("A date can't be negative") : 0 - toNumber(v);
      }
      case 'bin':
        return binary(n.op, run(n.a), run(n.b));
      case 'call':
        return FUNCTIONS[n.fn].call(n.args, fns);
    }
  }
  return run(tree);
}
