// Statistics functions (docs/specs/029-sheets/formulas.md "Functions": Statistics).
import type { EvalValue, Frame } from '../../engine/frame';
import {
  MANY,
  arrayArg,
  flatScalars,
  flatValues,
  fn,
  numArg,
  numbersOf,
  opt,
  type FnDef,
} from '../fn';
import { dims, err, isError, type SheetError, type Value } from '../values';
import { criteriaMask, maskedNumbers, pairsFrom, sameSizeAs } from './conditional';

function mean(ns: number[]): number {
  let s = 0;
  for (const n of ns) s += n;
  return s / ns.length;
}

function variance(ns: number[], sample: boolean): number | SheetError {
  if (ns.length < (sample ? 2 : 1)) return err('#DIV/0!');
  const m = mean(ns);
  let s = 0;
  for (const n of ns) s += (n - m) ** 2;
  return s / (ns.length - (sample ? 1 : 0));
}

function sorted(ns: number[]): number[] {
  return [...ns].sort((a, b) => a - b);
}

function percentile(ns: number[], k: number): number | SheetError {
  if (ns.length === 0 || k < 0 || k > 1) return err('#NUM!');
  const s = sorted(ns);
  const pos = (s.length - 1) * k;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return s[lo]! + (s[hi]! - s[lo]!) * (pos - lo);
}

function aggregate(read: (ns: number[]) => Value) {
  return fn(1, MANY, (args, f) => {
    const ns = numbersOf(args, f);
    return isError(ns) ? ns : read(ns);
  });
}

function nth(largest: boolean): FnDef {
  return fn(2, 2, (args, f) => {
    const ns = numbersOf([args[0]!], f);
    if (isError(ns)) return ns;
    const k = numArg(args[1]!, f);
    if (isError(k)) return k;
    const i = Math.ceil(k) - 1;
    if (i < 0 || i >= ns.length) return err('#NUM!');
    const s = sorted(ns);
    return largest ? s[s.length - 1 - i]! : s[i]!;
  });
}

function ifs(kind: 'avg' | 'min' | 'max') {
  return fn(3, MANY, (args, f) => {
    const pairs = pairsFrom(args, 1);
    if (!pairs) return err('#N/A', 'Pairs of range and criterion are needed');
    const m = criteriaMask(pairs, f);
    if (isError(m)) return m;
    const values = arrayArg(args[0]!, f);
    const a = dims(values);
    const b = dims(m.shape);
    if (a.rows !== b.rows || a.cols !== b.cols)
      return err('#VALUE!', 'The ranges must be the same size');
    const ns = maskedNumbers(values, m.mask);
    if (isError(ns)) return ns;
    if (kind === 'avg') return ns.length === 0 ? err('#DIV/0!') : mean(ns);
    if (ns.length === 0) return 0;
    return kind === 'min' ? Math.min(...ns) : Math.max(...ns);
  });
}

function countIf(args: EvalValue[], f: Frame): Value {
  const pairs: [EvalValue, EvalValue][] = [];
  for (let i = 0; i + 1 < args.length; i += 2) pairs.push([args[i]!, args[i + 1]!]);
  if (pairs.length === 0 || args.length % 2 !== 0) return err('#N/A');
  const m = criteriaMask(pairs, f);
  if (isError(m)) return m;
  return m.mask.filter(Boolean).length;
}

export const STATS_FUNCTIONS: Record<string, FnDef> = {
  AVERAGE: aggregate((ns) => (ns.length === 0 ? err('#DIV/0!') : mean(ns))),
  AVERAGEIF: fn(2, 3, (args, f) => {
    const m = criteriaMask([[args[0]!, args[1]!]], f);
    if (isError(m)) return m;
    const values =
      args[2] !== undefined && args[2] !== null ? sameSizeAs(args[2], m.shape, f) : m.shape;
    const ns = maskedNumbers(values, m.mask);
    if (isError(ns)) return ns;
    return ns.length === 0 ? err('#DIV/0!') : mean(ns);
  }),
  AVERAGEIFS: ifs('avg'),
  MINIFS: ifs('min'),
  MAXIFS: ifs('max'),
  MEDIAN: aggregate((ns) => (ns.length === 0 ? err('#NUM!') : (percentile(ns, 0.5) as number))),
  MODE: aggregate((ns) => {
    const counts = new Map<number, number>();
    let best: number | null = null;
    let bestCount = 1;
    for (const n of ns) {
      const c = (counts.get(n) ?? 0) + 1;
      counts.set(n, c);
      if (c > bestCount) {
        bestCount = c;
        best = n;
      }
    }
    return best === null ? err('#N/A', 'No value repeats') : best;
  }),
  MIN: aggregate((ns) => (ns.length === 0 ? 0 : Math.min(...ns))),
  MAX: aggregate((ns) => (ns.length === 0 ? 0 : Math.max(...ns))),
  COUNT: fn(1, MANY, (args, f) => {
    let n = 0;
    for (const a of args) {
      for (const x of flatScalars([a], f)) if (typeof x === 'number') n++;
      // A number typed as text in the arguments themselves counts, as in Sheets.
      if (a !== null && typeof a === 'string' && !Number.isNaN(Number(a)) && a.trim() !== '') n++;
    }
    return n;
  }),
  COUNTA: fn(1, MANY, (args, f) => flatScalars(args, f).filter((x) => x !== null).length),
  COUNTBLANK: fn(
    1,
    1,
    (args, f) => flatValues(arrayArg(args[0]!, f)).filter((x) => x === null || x === '').length,
  ),
  COUNTIF: fn(2, 2, (args, f) => countIf(args, f)),
  COUNTIFS: fn(2, MANY, (args, f) => countIf(args, f)),
  LARGE: nth(true),
  SMALL: nth(false),
  RANK: fn(2, 3, (args, f) => {
    const v = numArg(args[0]!, f);
    if (isError(v)) return v;
    const ns = numbersOf([args[1]!], f);
    if (isError(ns)) return ns;
    const order = opt(args, 2, f, numArg, 0);
    if (isError(order)) return order;
    if (!ns.includes(v)) return err('#N/A', 'The value is not in the range');
    return 1 + ns.filter((n) => (order ? n < v : n > v)).length;
  }),
  PERCENTILE: fn(2, 2, (args, f) => {
    const ns = numbersOf([args[0]!], f);
    if (isError(ns)) return ns;
    const k = numArg(args[1]!, f);
    return isError(k) ? k : percentile(ns, k);
  }),
  QUARTILE: fn(2, 2, (args, f) => {
    const ns = numbersOf([args[0]!], f);
    if (isError(ns)) return ns;
    const q = numArg(args[1]!, f);
    if (isError(q)) return q;
    const k = Math.trunc(q);
    return k < 0 || k > 4 ? err('#NUM!') : percentile(ns, k / 4);
  }),
  STDEV: aggregate((ns) => {
    const v = variance(ns, true);
    return isError(v) ? v : Math.sqrt(v);
  }),
  'STDEV.P': aggregate((ns) => {
    const v = variance(ns, false);
    return isError(v) ? v : Math.sqrt(v);
  }),
  VAR: aggregate((ns) => variance(ns, true)),
  'VAR.P': aggregate((ns) => variance(ns, false)),
  CORREL: fn(2, 2, (args, f) => {
    const a = flatValues(arrayArg(args[0]!, f));
    const b = flatValues(arrayArg(args[1]!, f));
    if (a.length !== b.length) return err('#N/A', 'The ranges must be the same size');
    const xs: number[] = [];
    const ys: number[] = [];
    for (let i = 0; i < a.length; i++) {
      const x = a[i];
      const y = b[i];
      if (typeof x === 'number' && typeof y === 'number') {
        xs.push(x);
        ys.push(y);
      }
    }
    if (xs.length < 2) return err('#DIV/0!');
    const mx = mean(xs);
    const my = mean(ys);
    let sxy = 0;
    let sxx = 0;
    let syy = 0;
    for (let i = 0; i < xs.length; i++) {
      sxy += (xs[i]! - mx) * (ys[i]! - my);
      sxx += (xs[i]! - mx) ** 2;
      syy += (ys[i]! - my) ** 2;
    }
    if (sxx === 0 || syy === 0) return err('#DIV/0!');
    return sxy / Math.sqrt(sxx * syy);
  }),
};
