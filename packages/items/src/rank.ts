// Fractional ranks (docs/specs/025-plan/blueprints/item-store.md "Rank").
// Base-36 keys compared as plain strings: a key strictly between any two
// always exists, so moving one item writes one item and nothing renumbers.
// Keys never end in '0' (the smallest digit), which keeps room below them.

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

// The shortest key strictly between `a` and `b` (null = open end).
export function rankBetween(a: string | null, b: string | null): string {
  if (a !== null && b !== null && compareRank(a, b) >= 0) {
    throw new RangeError(`rankBetween: ${a} is not below ${b}`);
  }
  if (a === null && b === null) return FIRST;
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
