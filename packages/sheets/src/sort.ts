// Sorting (docs/specs/029-sheets/sheet.md "Sort"): numbers ascending, then text ignoring case (numerals in text by
// value), then booleans, then errors, and empty cells last whichever way. Stable.
import { isError, type Scalar } from './formula/values';

function rank(v: Scalar): number {
  if (typeof v === 'number') return 0;
  if (typeof v === 'string') return v === '' ? 4 : 1;
  if (typeof v === 'boolean') return 2;
  if (v === null) return 4;
  return 3;
}

const COLLATOR = new Intl.Collator('en', { sensitivity: 'base', numeric: true });

export function sortKeyCompare(a: Scalar, b: Scalar, ascending = true): number {
  const ra = rank(a);
  const rb = rank(b);
  // Empty cells stay last both ways.
  if (ra === 4 || rb === 4) return ra === rb ? 0 : ra === 4 ? 1 : -1;
  let c: number;
  if (ra !== rb) c = ra - rb;
  else if (typeof a === 'number' && typeof b === 'number') c = a - b;
  else if (typeof a === 'string' && typeof b === 'string') c = COLLATOR.compare(a, b);
  else if (typeof a === 'boolean' && typeof b === 'boolean') c = Number(a) - Number(b);
  else if (isError(a) && isError(b)) c = a.e < b.e ? -1 : a.e > b.e ? 1 : 0;
  else c = 0;
  return ascending ? Math.sign(c) : -Math.sign(c);
}

export type SortKey = { col: number; ascending: boolean };

// The order of `rows` (indexes) by their values under `keys`, stable.
export function sortedOrder(
  count: number,
  valueAt: (row: number, col: number) => Scalar,
  keys: readonly SortKey[],
): number[] {
  const index = Array.from({ length: count }, (_, i) => i);
  index.sort((x, y) => {
    for (const k of keys) {
      const c = sortKeyCompare(valueAt(x, k.col), valueAt(y, k.col), k.ascending);
      if (c !== 0) return c;
    }
    return x - y;
  });
  return index;
}
