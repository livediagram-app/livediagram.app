// Values and errors (docs/specs/029-sheets/formulas.md "Values", "Errors"; blueprint "Values and coercion").
import { parsePlainNumber } from '../input';

export type ErrorCode =
  '#DIV/0!' | '#VALUE!' | '#REF!' | '#NAME?' | '#N/A' | '#NUM!' | '#SPILL!' | '#ERROR!';

export const ERROR_CODES: readonly ErrorCode[] = [
  '#DIV/0!',
  '#VALUE!',
  '#REF!',
  '#NAME?',
  '#N/A',
  '#NUM!',
  '#SPILL!',
  '#ERROR!',
];

// An error carries why, for the hover ("Division by zero", "Circular reference: B2 → C2 → B2").
export type SheetError = { e: ErrorCode; why?: string };
export type ValueArray = { rows: Value[][] };
// `null` is an empty cell.
export type Scalar = number | string | boolean | null | SheetError;
export type Value = Scalar | ValueArray;

// A card function before the cards have arrived: drawn as "Loading…", never an error.
export const PENDING: SheetError = { e: '#N/A', why: 'pending' };

export function err(e: ErrorCode, why?: string): SheetError {
  return why ? { e, why } : { e };
}

export const DEFAULT_WHY: Record<ErrorCode, string> = {
  '#DIV/0!': 'Division by zero',
  '#VALUE!': 'A value of the wrong kind',
  '#REF!': 'A reference to a cell that is not there',
  '#NAME?': 'Unknown function or name',
  '#N/A': 'Value not available',
  '#NUM!': 'A number out of range',
  '#SPILL!': 'The result would overwrite other cells',
  '#ERROR!': "This formula can't be read",
};

export function isError(v: unknown): v is SheetError {
  return typeof v === 'object' && v !== null && 'e' in v;
}

export function isArray(v: Value): v is ValueArray {
  return typeof v === 'object' && v !== null && 'rows' in v;
}

export function isPending(v: Value): boolean {
  return isError(v) && v.why === 'pending';
}

// The top-left value of an array (a scalar context reading an array, as Sheets does), else the value.
export function scalarOf(v: Value): Scalar {
  if (!isArray(v)) return v;
  const first = v.rows[0]?.[0];
  return first === undefined ? null : scalarOf(first);
}

// Numbers in text keep 15 significant digits, so 0.1 + 0.2 reads 0.3.
export function roundSignificant(n: number): number {
  if (n === 0 || !Number.isFinite(n)) return n;
  return Number(n.toPrecision(15));
}

export function numberText(n: number): string {
  const r = roundSignificant(n);
  if (Number.isInteger(r) && Math.abs(r) < 1e21) return String(r);
  const abs = Math.abs(r);
  if (abs !== 0 && (abs < 1e-9 || abs >= 1e15)) {
    return r
      .toExponential()
      .replace(/\.?0+e/, 'e')
      .replace('e+', 'E+')
      .replace('e-', 'E-');
  }
  // JavaScript's own text turns to exponent form below 1e-6: written as a spreadsheet does, with a capital E.
  return String(r).replace('e-', 'E-').replace('e+', 'E+');
}

export function toNumber(v: Value): number | SheetError {
  const s = scalarOf(v);
  if (s === null) return 0;
  if (typeof s === 'number') return s;
  if (typeof s === 'boolean') return s ? 1 : 0;
  if (typeof s === 'string') {
    if (s.trim() === '') return 0;
    const n = parsePlainNumber(s);
    if (n !== null) return n;
    const pct = /^(.*)%$/.exec(s.trim());
    if (pct) {
      const p = parsePlainNumber(pct[1]!);
      if (p !== null) return p / 100;
    }
    return err('#VALUE!', `"${s.length > 20 ? `${s.slice(0, 20)}…` : s}" is not a number`);
  }
  return s;
}

export function toText(v: Value): string | SheetError {
  const s = scalarOf(v);
  if (s === null) return '';
  if (typeof s === 'string') return s;
  if (typeof s === 'number') return numberText(s);
  if (typeof s === 'boolean') return s ? 'TRUE' : 'FALSE';
  return s;
}

export function toBool(v: Value): boolean | SheetError {
  const s = scalarOf(v);
  if (s === null) return false;
  if (typeof s === 'boolean') return s;
  if (typeof s === 'number') return s !== 0;
  if (typeof s === 'string') {
    const l = s.trim().toLowerCase();
    if (l === 'true') return true;
    if (l === 'false') return false;
    return err('#VALUE!', `"${s}" is not TRUE or FALSE`);
  }
  return s;
}

// Kind order across kinds when comparing (as Sheets): numbers < text < booleans; empty compares as 0 or "".
function kindRank(s: Scalar): number {
  if (typeof s === 'number') return 0;
  if (typeof s === 'string') return 1;
  return 2;
}

// -1, 0 or 1 for the comparison operators. Text compares ignoring case. Errors are handled by the caller.
export function compareScalars(a: Scalar, b: Scalar): number {
  let x = a;
  let y = b;
  if (x === null) x = typeof y === 'string' ? '' : typeof y === 'boolean' ? false : 0;
  if (y === null) y = typeof x === 'string' ? '' : typeof x === 'boolean' ? false : 0;
  const kx = kindRank(x);
  const ky = kindRank(y);
  if (kx !== ky) return kx < ky ? -1 : 1;
  if (typeof x === 'number' && typeof y === 'number') {
    // To 15 significant digits, as spreadsheets compare: 0.1 + 0.2 equals 0.3.
    const a = roundSignificant(x);
    const b = roundSignificant(y);
    return a === b ? 0 : a < b ? -1 : 1;
  }
  if (typeof x === 'string' && typeof y === 'string') {
    const lx = x.toLowerCase();
    const ly = y.toLowerCase();
    return lx === ly ? 0 : lx < ly ? -1 : 1;
  }
  const bx = x ? 1 : 0;
  const by = y ? 1 : 0;
  return bx === by ? 0 : bx < by ? -1 : 1;
}

// Every scalar of a value, row by row (an array flattened; a scalar alone).
export function* scalars(v: Value): Generator<Scalar> {
  if (isArray(v)) {
    for (const row of v.rows) for (const x of row) yield* scalars(x);
  } else {
    yield v;
  }
}

export function arrayOf(rows: Value[][]): ValueArray {
  return { rows };
}

export function dims(v: Value): { rows: number; cols: number } {
  if (!isArray(v)) return { rows: 1, cols: 1 };
  return { rows: v.rows.length, cols: v.rows[0]?.length ?? 0 };
}
