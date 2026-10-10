// What a function is, and the helpers every function family shares (blueprint sheets-engine.md "Functions"): reading
// arguments as numbers, text, booleans and arrays the way Sheets does, lifting scalar functions over arrays, and
// walking the numbers of a range for the aggregates.
import { isRef, type EvalValue, type Frame, type RangeRef } from '../engine/frame';
import { ARRAY_CELLS_MAX, RANGE_CELLS_MAX } from '../limits';
import {
  dims,
  err,
  isArray,
  isError,
  scalarOf,
  toBool,
  toNumber,
  toText,
  type Scalar,
  type SheetError,
  type Value,
  type ValueArray,
} from './values';

export type Thunk = () => EvalValue;

export type FnDef =
  | {
      min: number;
      max: number;
      lazy?: false;
      volatile?: true;
      impl: (args: EvalValue[], f: Frame) => EvalValue;
    }
  | {
      min: number;
      max: number;
      lazy: true;
      volatile?: true;
      impl: (args: Thunk[], f: Frame) => EvalValue;
    };

export const MANY = Number.POSITIVE_INFINITY;

export function fn(
  min: number,
  max: number,
  impl: (args: EvalValue[], f: Frame) => EvalValue,
): FnDef {
  return { min, max, impl };
}

export function lazyFn(
  min: number,
  max: number,
  impl: (args: Thunk[], f: Frame) => EvalValue,
): FnDef {
  return { min, max, lazy: true, impl };
}

export function volatileFn(
  min: number,
  max: number,
  impl: (args: EvalValue[], f: Frame) => EvalValue,
): FnDef {
  return { min, max, volatile: true, impl };
}

export function rangeCells(r: RangeRef): number {
  return (r.r2 - r.r1 + 1) * (r.c2 - r.c1 + 1);
}

// A reference read as a value: one cell's value, or the range as an array.
export function deref(v: EvalValue, f: Frame): Value {
  if (!isRef(v)) return v;
  const r = v.ref;
  if (r.r2 < r.r1 || r.c2 < r.c1) return { rows: [] };
  if (r.r1 === r.r2 && r.c1 === r.c2) return f.cell(r.sheetId, r.r1, r.c1);
  const n = rangeCells(r);
  if (n > RANGE_CELLS_MAX) return err('#NUM!', 'This range is too large to read at once');
  // Noted first: a cell cut short by the budget still hears when its range changes.
  f.noteRange(r);
  if (!f.spend(n)) return err('#NUM!', 'This sheet is too large to recalculate at once');
  const rows: Value[][] = [];
  for (let i = r.r1; i <= r.r2; i++) {
    const row: Value[] = [];
    for (let j = r.c1; j <= r.c2; j++) row.push(f.cell(r.sheetId, i, j, true));
    rows.push(row);
  }
  return { rows };
}

export function scalarArg(v: EvalValue, f: Frame): Scalar {
  return scalarOf(deref(v, f));
}

export function numArg(v: EvalValue, f: Frame): number | SheetError {
  return toNumber(deref(v, f));
}

export function textArg(v: EvalValue, f: Frame): string | SheetError {
  return toText(deref(v, f));
}

export function boolArg(v: EvalValue, f: Frame): boolean | SheetError {
  return toBool(deref(v, f));
}

export function intArg(v: EvalValue, f: Frame): number | SheetError {
  const n = numArg(v, f);
  return typeof n === 'number' ? Math.trunc(n) : n;
}

// An optional argument: absent or empty (`f(a,,b)` passes null) reads as the default.
export function opt<T>(
  args: EvalValue[],
  i: number,
  f: Frame,
  read: (v: EvalValue, f: Frame) => T | SheetError,
  fallback: T,
): T | SheetError {
  const a = args[i];
  if (a === undefined || a === null) return fallback;
  return read(a, f);
}

export function asArray(v: Value): ValueArray {
  return isArray(v) ? v : { rows: [[v]] };
}

export function arrayArg(v: EvalValue, f: Frame): ValueArray {
  return asArray(deref(v, f));
}

// The array is empty, or past the budget for a function's result.
export function tooBig(rows: number, cols: number): boolean {
  return rows * cols > ARRAY_CELLS_MAX;
}

// Apply a scalar function element-wise when any argument is an array (Sheets' ARRAYFORMULA lifting).
export function lift(values: Value[], each: (xs: Scalar[]) => Value): Value {
  const arrays = values.filter(isArray);
  if (arrays.length === 0) return each(values.map((v) => scalarOf(v)));
  let rows = 1;
  let cols = 1;
  for (const a of arrays) {
    const d = dims(a);
    rows = Math.max(rows, d.rows);
    cols = Math.max(cols, d.cols);
  }
  if (tooBig(rows, cols)) return err('#NUM!', 'The result is too large');
  const pick = (v: Value, i: number, j: number): Scalar => {
    if (!isArray(v)) return v;
    const d = dims(v);
    const ii = d.rows === 1 ? 0 : i;
    const jj = d.cols === 1 ? 0 : j;
    const x = v.rows[ii]?.[jj];
    return x === undefined ? err('#N/A', 'The arrays are different sizes') : scalarOf(x);
  };
  const out: Value[][] = [];
  for (let i = 0; i < rows; i++) {
    const row: Value[] = [];
    for (let j = 0; j < cols; j++) row.push(scalarOf(each(values.map((v) => pick(v, i, j)))));
    out.push(row);
  }
  return { rows: out };
}

// A function of fixed scalar arguments, lifted over arrays.
export function scalarFn(min: number, max: number, each: (xs: Scalar[], f: Frame) => Value): FnDef {
  return fn(min, max, (args, f) =>
    lift(
      args.map((a) => deref(a, f)),
      (xs) => each(xs, f),
    ),
  );
}

// A number function: each argument read as a number (an error is returned as it is).
export function numFn(min: number, max: number, each: (ns: number[]) => Value): FnDef {
  return scalarFn(min, max, (xs) => {
    const ns: number[] = [];
    for (const x of xs) {
      const n = toNumber(x);
      if (typeof n !== 'number') return n;
      ns.push(n);
    }
    return finite(each(ns));
  });
}

export function finite(v: Value): Value {
  if (typeof v === 'number' && !Number.isFinite(v)) return err('#NUM!');
  return v;
}

// The numbers of aggregate arguments, as SUM reads them: in a range, only numbers count (text and booleans are
// skipped); typed directly, text that reads as a number and booleans count. Any error stops it.
export function numbersOf(args: EvalValue[], f: Frame): number[] | SheetError {
  const out: number[] = [];
  for (const a of args) {
    if (a === null || a === undefined) continue;
    const fromRange = isRef(a) || isArray(a as Value);
    const v = deref(a, f);
    if (isArray(v)) {
      for (const row of v.rows)
        for (const x of row) {
          const s = scalarOf(x);
          if (isError(s)) return s;
          if (typeof s === 'number') out.push(s);
        }
      continue;
    }
    if (isError(v)) return v;
    if (fromRange) {
      if (typeof v === 'number') out.push(v);
      continue;
    }
    if (v === null) continue;
    const n = toNumber(v);
    if (typeof n !== 'number') return n;
    out.push(n);
  }
  return out;
}

// Every scalar of the arguments (arrays flattened), errors kept, for COUNTA, CONCAT, TEXTJOIN...
export function flatScalars(args: EvalValue[], f: Frame): Scalar[] {
  const out: Scalar[] = [];
  for (const a of args) {
    if (a === null || a === undefined) continue;
    const v = deref(a, f);
    if (isArray(v)) for (const row of v.rows) for (const x of row) out.push(scalarOf(x));
    else out.push(v);
  }
  return out;
}

// A reference argument (ROW, COLUMN, OFFSET, INDEX's result): null when it is not one.
export function refArg(v: EvalValue | undefined): RangeRef | null {
  return v !== undefined && v !== null && isRef(v) ? v.ref : null;
}

export function flatValues(v: ValueArray): Scalar[] {
  const out: Scalar[] = [];
  for (const row of v.rows) for (const x of row) out.push(scalarOf(x));
  return out;
}
