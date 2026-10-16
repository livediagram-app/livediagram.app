// What a stored rule may be (blueprint sheet-rules.md "Validation"): every viewer draws a stored rule, so a malformed
// one would break the sheet for all of them. Closed lists, bounded text and counts, ranges on the sheet.
import { isColour, validFormatValue } from '../format';
import { isAxisId } from '../ids';
import { layoutIndex } from '../layout';
import { CONDITION_OPS } from '../filter';
import { storedAst } from '../formula/stored';
import { tokenize } from '../formula/tokens';
import {
  DROPDOWN_OPTIONS_MAX,
  DROPDOWN_OPTION_MAX,
  FORMAT_RULE_FORMULA_MAX,
  VALIDATION_HELP_MAX,
} from '../limits';
import type { SheetLayout, StoredFormula } from '../sheet';

const NUM_OPS = new Set(['between', 'notBetween', 'gt', 'gte', 'lt', 'lte', 'eq', 'neq']);
const DATE_OPS = new Set([
  'valid',
  'before',
  'onOrBefore',
  'after',
  'onOrAfter',
  'on',
  'between',
  'notBetween',
]);
const TEXT_OPS = new Set(['contains', 'notContains', 'exactly', 'email', 'url']);
const TWO_VALUE = new Set(['between', 'notBetween']);
const VALIDATION_KEYS = new Set([
  'id',
  'r1',
  'c1',
  'r2',
  'c2',
  'is',
  'opts',
  'src',
  'show',
  'op',
  'a',
  'b',
  'warn',
  'help',
]);
const FORMAT_RULE_KEYS = new Set([
  'id',
  'r1',
  'c1',
  'r2',
  'c2',
  'is',
  'op',
  'a',
  'b',
  'fx',
  'style',
  'min',
  'mid',
  'max',
]);
const STYLE_KEYS = new Set(['b', 'i', 'u', 'st', 'fc', 'bg']);
const OPERAND_MAX = 255;

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

// A rectangle whose corners are rows and columns of the sheet.
export function rangeOnSheet(r: unknown, layout: SheetLayout): boolean {
  if (!isObj(r)) return false;
  const ix = layoutIndex(layout);
  return (
    isAxisId(r.r1) &&
    isAxisId(r.r2) &&
    isAxisId(r.c1) &&
    isAxisId(r.c2) &&
    ix.rowPos.has(r.r1) &&
    ix.rowPos.has(r.r2) &&
    ix.colPos.has(r.c1) &&
    ix.colPos.has(r.c2)
  );
}

function optionsOk(v: unknown): boolean {
  if (!Array.isArray(v) || v.length === 0 || v.length > DROPDOWN_OPTIONS_MAX) return false;
  const seen = new Set<string>();
  for (const o of v) {
    if (!isObj(o) || Object.keys(o).some((k) => k !== 'v' && k !== 'c')) return false;
    if (typeof o.v !== 'string' || o.v.trim().length === 0 || o.v.length > DROPDOWN_OPTION_MAX)
      return false;
    if (o.c !== undefined && !isColour(o.c)) return false;
    const key = o.v.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
  }
  return true;
}

// Whether `v` is a validation rule a write may store on this layout, with the id it names.
export function isValidationRule(v: unknown, id: string, layout: SheetLayout): boolean {
  if (!isObj(v) || v.id !== id || !isAxisId(id)) return false;
  if (!Object.keys(v).every((k) => VALIDATION_KEYS.has(k))) return false;
  if (!rangeOnSheet(v, layout)) return false;
  if (v.warn !== undefined && v.warn !== true) return false;
  if (v.help !== undefined && (typeof v.help !== 'string' || v.help.length > VALIDATION_HELP_MAX))
    return false;
  const dropdown = v.is === 'list' || v.is === 'range';
  if (v.show !== undefined && !(dropdown && (v.show === 'arrow' || v.show === 'plain')))
    return false;
  if (v.is !== 'list' && v.opts !== undefined) return false;
  if (v.is !== 'range' && v.src !== undefined) return false;
  const noOperands = v.op === undefined && v.a === undefined && v.b === undefined;
  switch (v.is) {
    case 'list':
      return optionsOk(v.opts) && noOperands;
    case 'range':
      return rangeOnSheet(v.src, layout) && noOperands;
    case 'check':
      return noOperands;
    case 'num':
    case 'date': {
      const ops = v.is === 'num' ? NUM_OPS : DATE_OPS;
      if (typeof v.op !== 'string' || !ops.has(v.op)) return false;
      if (v.op === 'valid') return v.a === undefined && v.b === undefined;
      if (!finite(v.a)) return false;
      return TWO_VALUE.has(v.op) ? finite(v.b) : v.b === undefined;
    }
    case 'text':
      if (typeof v.op !== 'string' || !TEXT_OPS.has(v.op) || v.b !== undefined) return false;
      return v.op === 'email' || v.op === 'url'
        ? v.a === undefined
        : typeof v.a === 'string' && v.a.length > 0 && v.a.length <= OPERAND_MAX;
    default:
      return false;
  }
}

function styleOk(v: unknown): boolean {
  if (!isObj(v)) return false;
  const keys = Object.keys(v);
  return keys.length > 0 && keys.every((k) => STYLE_KEYS.has(k) && validFormatValue(k, v[k]));
}

function pointOk(v: unknown, end: 'min' | 'mid' | 'max'): boolean {
  if (!isObj(v) || !isColour(v.c)) return false;
  if (Object.keys(v).some((k) => k !== 'c' && k !== 'at' && k !== 'v')) return false;
  switch (v.at) {
    case 'min':
    case 'max':
      return v.at === end && v.v === undefined;
    case 'num':
      return finite(v.v);
    case 'pct':
    case 'pctile':
      return finite(v.v) && v.v >= 0 && v.v <= 100;
    default:
      return false;
  }
}

// A stored formula that reads, as a cell's formula input must (validate.ts inputProblem).
export function storedFormulaOk(f: unknown): f is StoredFormula {
  if (!isObj(f) || typeof f.t !== 'string' || !Array.isArray(f.r)) return false;
  if (Object.keys(f).some((k) => k !== 't' && k !== 'r')) return false;
  if (f.t.length > FORMAT_RULE_FORMULA_MAX) return false;
  const used = tokenize(f.t, 0, true)
    .filter((t) => t.k === 'stored')
    .map((t) => Number(t.v));
  if (used.some((i) => i >= (f.r as unknown[]).length)) return false;
  if (new Set(used).size !== (f.r as unknown[]).length) return false;
  return storedAst(f as StoredFormula) !== null;
}

// Whether `v` is a format rule a write may store on this layout. `refsOk` checks a custom formula's references
// (validate.ts isStoredRef), passed in so this module does not import validate.ts.
export function isFormatRule(
  v: unknown,
  id: string,
  layout: SheetLayout,
  refsOk: (refs: unknown[]) => boolean,
): boolean {
  if (!isObj(v) || v.id !== id || !isAxisId(id)) return false;
  if (!Object.keys(v).every((k) => FORMAT_RULE_KEYS.has(k))) return false;
  if (!rangeOnSheet(v, layout)) return false;
  const text = (x: unknown) =>
    x === undefined || (typeof x === 'string' && x.length <= OPERAND_MAX);
  if (v.is === 'when') {
    if (v.min !== undefined || v.mid !== undefined || v.max !== undefined) return false;
    if (!styleOk(v.style)) return false;
    if (v.op === 'formula')
      return v.a === undefined && v.b === undefined && storedFormulaOk(v.fx) && refsOk(v.fx.r);
    return (
      (CONDITION_OPS as readonly unknown[]).includes(v.op) &&
      v.fx === undefined &&
      text(v.a) &&
      text(v.b)
    );
  }
  if (v.is === 'scale')
    return (
      v.op === undefined &&
      v.a === undefined &&
      v.b === undefined &&
      v.fx === undefined &&
      v.style === undefined &&
      pointOk(v.min, 'min') &&
      pointOk(v.max, 'max') &&
      (v.mid === undefined || pointOk(v.mid, 'mid'))
    );
  return false;
}
