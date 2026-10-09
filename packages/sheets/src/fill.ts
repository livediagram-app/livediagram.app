// The fill handle's series (docs/specs/029-sheets/sheet.md "Fill"): numbers and dates continue by their step, text
// ending in a number continues the number, month and day names continue, everything else is copied.
import { DAY_NAMES, MONTH_NAMES, dateFromSerial, serialFromDate } from './dates';
import type { CellInput } from './sheet';

export type SeriesSource = (CellInput | undefined)[];

type Series = (k: number) => CellInput | undefined; // k: 0-based index past the source's end

function arith(ns: number[]): Series | null {
  if (ns.length < 2) return null;
  const step = ns[1]! - ns[0]!;
  for (let i = 2; i < ns.length; i++) if (Math.abs(ns[i]! - ns[i - 1]! - step) > 1e-9) return null;
  const last = ns[ns.length - 1]!;
  return (k) => ({ n: Number((last + step * (k + 1)).toPrecision(15)) });
}

// The same day each month (the 31st clamps), when the source dates step by whole months.
function monthly(ns: number[]): Series | null {
  if (ns.length < 2 || ns.some((n) => !Number.isInteger(n))) return null;
  const parts = ns.map(dateFromSerial);
  const months = (p: { y: number; m: number }) => p.y * 12 + p.m;
  const step = months(parts[1]!) - months(parts[0]!);
  if (step === 0) return null;
  for (let i = 1; i < parts.length; i++)
    if (months(parts[i]!) - months(parts[i - 1]!) !== step || parts[i]!.d !== parts[0]!.d)
      return null;
  const last = parts[parts.length - 1]!;
  return (k) => {
    const total = months(last) + step * (k + 1) - 1;
    const y = Math.floor(total / 12);
    const m = (total % 12) + 1;
    const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return { n: serialFromDate(y, m, Math.min(parts[0]!.d, days)) };
  };
}

const TRAILING = /^(.*?)(\d+)$/;

function textNumbers(ts: string[], one: number): Series | null {
  const ms = ts.map((t) => TRAILING.exec(t));
  if (ms.some((m) => !m) || new Set(ms.map((m) => m![1])).size !== 1) return null;
  const prefix = ms[0]![1]!;
  const ns = ms.map((m) => Number(m![2]));
  const width = ms[ms.length - 1]![2]!.length;
  const step = ns.length >= 2 ? ns[1]! - ns[0]! : one;
  for (let i = 2; i < ns.length; i++) if (ns[i]! - ns[i - 1]! !== step) return null;
  const last = ns[ns.length - 1]!;
  return (k) => {
    const n = last + step * (k + 1);
    const digits = String(Math.abs(n)).padStart(width, '0');
    return { s: `${prefix}${n < 0 ? '-' : ''}${digits}` };
  };
}

function cyclic(ts: string[], names: readonly string[], one: number): Series | null {
  const full = names.map((n) => n.toLowerCase());
  const short = names.map((n) => n.slice(0, 3).toLowerCase());
  const idx = (t: string) => {
    const l = t.toLowerCase();
    const i = full.indexOf(l);
    return i >= 0
      ? { i, short: false }
      : short.indexOf(l) >= 0
        ? { i: short.indexOf(l), short: true }
        : null;
  };
  const found = ts.map(idx);
  if (found.some((f) => !f)) return null;
  const step =
    found.length >= 2
      ? (found[1]!.i - found[0]!.i + names.length) % names.length
      : (one + names.length) % names.length;
  const last = found[found.length - 1]!;
  const sample = ts[ts.length - 1]!;
  const upper = sample === sample.toUpperCase();
  const lower = sample === sample.toLowerCase();
  return (k) => {
    const name = names[(last.i + step * (k + 1)) % names.length]!;
    const text = last.short ? name.slice(0, 3) : name;
    return { s: upper ? text.toUpperCase() : lower ? text.toLowerCase() : text };
  };
}

// The values a drag of the fill handle makes past the source, `count` of them. `copy` is Ctrl/⌥ held: always copy,
// except one number, which then counts (Sheets' Ctrl-drag). `backward` is a fill up or left: a single value counts
// down (Mon, Sun, Sat). Formulas are copied by the caller (shifted).
export function fillSeries(
  source: SeriesSource,
  count: number,
  copy = false,
  dateLike = false,
  backward = false,
): (CellInput | undefined)[] {
  const one = backward ? -1 : 1;
  const out: (CellInput | undefined)[] = [];
  const nums = source.every((x) => x && 'n' in x)
    ? source.map((x) => (x as { n: number }).n)
    : null;
  const texts = source.every((x) => x && 's' in x)
    ? source.map((x) => (x as { s: string }).s)
    : null;
  let series: Series | null = null;
  if (copy) {
    if (nums && nums.length === 1) series = (k) => ({ n: nums[0]! + one * (k + 1) });
  } else if (nums) {
    series = (dateLike ? monthly(nums) : null) ?? arith(nums);
  } else if (texts) {
    series =
      cyclic(texts, MONTH_NAMES, one) ?? cyclic(texts, DAY_NAMES, one) ?? textNumbers(texts, one);
  }
  for (let k = 0; k < count; k++) out.push(series ? series(k) : source[k % source.length]);
  return out;
}
