// Maths functions (docs/specs/029-sheets/formulas.md "Functions": Maths).
import type { FnDef } from '../fn';
import { MANY, arrayArg, fn, numArg, numFn, numbersOf, volatileFn } from '../fn';
import { err, isError, scalarOf, type Value } from '../values';
import { criteriaMask, maskedNumbers, pairsFrom, sameSizeAs } from './conditional';
import { dims } from '../values';

// Round half away from zero, as spreadsheets do, without float drift (2.675 → 2.68).
export function roundHalfAway(x: number, digits: number): number {
  const m = 10 ** digits;
  const scaled = Math.abs(x) * m;
  const r = Math.round(Number(scaled.toPrecision(15)));
  return (Math.sign(x) * r) / m;
}

function roundDir(x: number, digits: number, up: boolean): number {
  const m = 10 ** digits;
  const scaled = Number((Math.abs(x) * m).toPrecision(15));
  const r = up ? Math.ceil(scaled) : Math.floor(scaled);
  return (Math.sign(x) * r) / m;
}

function gcd(a: number, b: number): number {
  let x = a;
  let y = b;
  while (y) [x, y] = [y, x % y];
  return x;
}

function toMultiple(x: number, factor: number, up: boolean): Value {
  if (factor === 0) return 0;
  if (x > 0 && factor < 0) return err('#NUM!', 'The factor must have the same sign as the value');
  const q = Number((x / factor).toPrecision(15));
  return (up ? Math.ceil(q) : Math.floor(q)) * factor;
}

function sum(ns: number[]): number {
  let s = 0;
  for (const n of ns) s += n;
  return Number(s.toPrecision(15));
}

export const MATH_FUNCTIONS: Record<string, FnDef> = {
  SUM: fn(1, MANY, (args, f) => {
    const ns = numbersOf(args, f);
    return isError(ns) ? ns : sum(ns);
  }),
  PRODUCT: fn(1, MANY, (args, f) => {
    const ns = numbersOf(args, f);
    if (isError(ns)) return ns;
    return ns.reduce((p, n) => p * n, 1);
  }),
  SUMIF: fn(2, 3, (args, f) => {
    const m = criteriaMask([[args[0]!, args[1]!]], f);
    if (isError(m)) return m;
    const values =
      args[2] !== undefined && args[2] !== null ? sameSizeAs(args[2], m.shape, f) : m.shape;
    const ns = maskedNumbers(values, m.mask);
    return isError(ns) ? ns : sum(ns);
  }),
  SUMIFS: fn(3, MANY, (args, f) => {
    const pairs = pairsFrom(args, 1);
    if (!pairs) return err('#N/A', 'SUMIFS takes a sum range then pairs of range and criterion');
    const m = criteriaMask(pairs, f);
    if (isError(m)) return m;
    const values = arrayArg(args[0]!, f);
    const a = dims(values);
    const b = dims(m.shape);
    if (a.rows !== b.rows || a.cols !== b.cols)
      return err('#VALUE!', 'The ranges must be the same size');
    const ns = maskedNumbers(values, m.mask);
    return isError(ns) ? ns : sum(ns);
  }),
  SUMPRODUCT: fn(1, MANY, (args, f) => {
    const arrays = args.map((a) => arrayArg(a!, f));
    const d = dims(arrays[0]!);
    if (arrays.some((a) => dims(a).rows !== d.rows || dims(a).cols !== d.cols))
      return err('#VALUE!', 'The arrays must be the same size');
    let total = 0;
    for (let i = 0; i < d.rows; i++)
      for (let j = 0; j < d.cols; j++) {
        let p = 1;
        for (const a of arrays) {
          const x = scalarOf(a.rows[i]![j]!);
          if (isError(x)) return x;
          p *= typeof x === 'number' ? x : 0;
        }
        total += p;
      }
    return Number(total.toPrecision(15));
  }),
  ABS: numFn(1, 1, ([x]) => Math.abs(x!)),
  ROUND: numFn(1, 2, ([x, d = 0]) => roundHalfAway(x!, Math.trunc(d))),
  ROUNDUP: numFn(1, 2, ([x, d = 0]) => roundDir(x!, Math.trunc(d), true)),
  ROUNDDOWN: numFn(1, 2, ([x, d = 0]) => roundDir(x!, Math.trunc(d), false)),
  INT: numFn(1, 1, ([x]) => Math.floor(x!)),
  TRUNC: numFn(1, 2, ([x, d = 0]) => roundDir(x!, Math.trunc(d), false)),
  MOD: numFn(2, 2, ([a, b]) => {
    if (b === 0) return err('#DIV/0!');
    const r = a! - b! * Math.floor(a! / b!);
    return Number(r.toPrecision(15));
  }),
  POWER: numFn(2, 2, ([a, b]) => {
    if (a === 0 && b! < 0) return err('#DIV/0!');
    const r = a! ** b!;
    return Number.isNaN(r) ? err('#NUM!') : r;
  }),
  SQRT: numFn(1, 1, ([x]) => (x! < 0 ? err('#NUM!', 'SQRT of a negative number') : Math.sqrt(x!))),
  EXP: numFn(1, 1, ([x]) => Math.exp(x!)),
  LN: numFn(1, 1, ([x]) => (x! <= 0 ? err('#NUM!') : Math.log(x!))),
  LOG: numFn(1, 2, ([x, base = 10]) =>
    x! <= 0 || base <= 0 || base === 1 ? err('#NUM!') : Math.log(x!) / Math.log(base),
  ),
  LOG10: numFn(1, 1, ([x]) => (x! <= 0 ? err('#NUM!') : Math.log10(x!))),
  PI: fn(0, 0, () => Math.PI),
  SIGN: numFn(1, 1, ([x]) => Math.sign(x!)),
  CEILING: numFn(1, 2, ([x, factor = 1]) => toMultiple(x!, factor, true)),
  FLOOR: numFn(1, 2, ([x, factor = 1]) => toMultiple(x!, factor, false)),
  MROUND: numFn(2, 2, ([x, m]) => {
    if (m === 0) return 0;
    if (Math.sign(x!) !== Math.sign(m!) && x !== 0) return err('#NUM!');
    return roundHalfAway(x! / m!, 0) * m!;
  }),
  QUOTIENT: numFn(2, 2, ([a, b]) => (b === 0 ? err('#DIV/0!') : Math.trunc(a! / b!))),
  GCD: fn(1, MANY, (args, f) => {
    const ns = numbersOf(args, f);
    if (isError(ns)) return ns;
    if (ns.some((n) => n < 0)) return err('#NUM!');
    return ns.map(Math.trunc).reduce((g, n) => gcd(g, n), 0);
  }),
  LCM: fn(1, MANY, (args, f) => {
    const ns = numbersOf(args, f);
    if (isError(ns)) return ns;
    if (ns.some((n) => n < 0)) return err('#NUM!');
    return ns.map(Math.trunc).reduce((l, n) => (l === 0 || n === 0 ? 0 : (l * n) / gcd(l, n)), 1);
  }),
  FACT: numFn(1, 1, ([x]) => {
    const n = Math.trunc(x!);
    if (n < 0 || n > 170) return err('#NUM!');
    let r = 1;
    for (let i = 2; i <= n; i++) r *= i;
    return r;
  }),
  RAND: volatileFn(0, 0, (_args, f) => f.rand()),
  RANDBETWEEN: volatileFn(2, 2, (args, f) => {
    const lo = numArg(args[0]!, f);
    const hi = numArg(args[1]!, f);
    if (isError(lo)) return lo;
    if (isError(hi)) return hi;
    const a = Math.ceil(lo);
    const b = Math.floor(hi);
    if (b < a) return err('#NUM!');
    return a + Math.floor(f.rand() * (b - a + 1));
  }),
};
