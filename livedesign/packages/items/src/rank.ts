// Fractional ranks (docs/specs/026-plan/blueprints/item-store.md "Rank").
// Base-36 keys compared as plain strings: a key strictly between any two
// always exists, so moving one item writes one item and nothing renumbers.
// Keys never end in '0' (the smallest digit), which keeps room below them.
// An open end (an append or a prepend) steps the key by one, as a counter of its own width, rather
// than halving the gap that is left: halving lets a key grow a digit every five or six appends,
// stepping keeps the width until every key of it is used, then doubles it, so n appends cost
// O(log n) digits (2000 appends: 8 digits, where halving reached 334).

const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz';
const BASE = DIGITS.length;
const FIRST = 'i';

function digit(s: string, i: number): number {
  return i < s.length ? DIGITS.indexOf(s[i]!) : 0;
}

export function isValidRank(r: unknown): r is string {
  return typeof r === 'string' && /^[0-9a-z]{1,64}$/.test(r) && !r.endsWith('0');
}

export function compareRank(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

const TOP = DIGITS[BASE - 1]!;

// The next key above `a` at its own width: the last digit runs 1..z (never 0), the others 0..z. When every
// digit is already z there is none at that width, so the key doubles its width with the smallest tail
// ('z' -> 'z1', 'zz' -> 'zz01'), which leaves a whole width's worth of steps above it.
function stepUp(a: string): string {
  const d = [...a].map((_, i) => digit(a, i));
  for (let i = d.length - 1; i >= 0; i--) {
    const floor = i === d.length - 1 ? 1 : 0;
    if (d[i]! < BASE - 1) {
      d[i] = d[i]! + 1;
      return d.map((x) => DIGITS[x]).join('');
    }
    d[i] = floor;
  }
  return a + '0'.repeat(a.length - 1) + '1';
}

// The next key below `b` at its own width, the mirror of stepUp. Below the smallest key of a width
// ('1', '01') it doubles the width with the largest tail ('1' -> '0z', '01' -> '00zz').
function stepDown(b: string): string {
  const d = [...b].map((_, i) => digit(b, i));
  for (let i = d.length - 1; i >= 0; i--) {
    const floor = i === d.length - 1 ? 1 : 0;
    if (d[i]! > floor) {
      d[i] = d[i]! - 1;
      return d.map((x) => DIGITS[x]).join('');
    }
    d[i] = BASE - 1;
  }
  return '0'.repeat(b.length) + TOP.repeat(b.length);
}

// A key strictly between `a` and `b` (null = open end): between two keys the shortest, at an open end the
// next step (stepUp, stepDown).
export function rankBetween(a: string | null, b: string | null): string {
  if (a !== null && b !== null && compareRank(a, b) >= 0) {
    throw new RangeError(`rankBetween: ${a} is not below ${b}`);
  }
  if (a === null && b === null) return FIRST;
  if (b === null) return stepUp(a!);
  if (a === null) return stepDown(b);
  let out = '';
  for (let i = 0; ; i++) {
    const lo = a === null ? 0 : digit(a, i);
    // Past b's end (or no b) the upper bound is open.
    const hi = b === null || i >= b.length ? BASE : digit(b, i);
    // Once out's prefix is already below b's prefix, hi is open from here on.
    const upper = b !== null && out < b.slice(0, i) ? BASE : hi;
    if (upper - lo > 1) {
      const mid = Math.floor((lo + upper) / 2);
      return out + DIGITS[mid];
    }
    out += DIGITS[lo];
  }
}

export function rankAfter(a: string | null): string {
  return rankBetween(a, null);
}

export function rankBefore(b: string | null): string {
  return rankBetween(null, b);
}
