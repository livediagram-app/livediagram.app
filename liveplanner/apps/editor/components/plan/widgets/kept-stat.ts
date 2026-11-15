// A board widget's count, kept per list of cards (docs/specs/026-plan/board-widgets.md "The board's filter"; blueprint
// "Performance and limits"): the header draws again whenever the board's filter changes, a teammate's change included,
// but the cards its widgets count (the board's, before the filter) are the same list, so their counts are read back
// rather than counted again over every card. Keyed by the list itself (a WeakMap: a list no longer shown is let go), by
// what else the count reads as a string (the done columns, the day, the type order), and by an object it reads whole
// (the card types), matched by identity. A list kept on screen for hours sees a new day or minute in some keys, so each
// list keeps at most KEPT_PER_LIST counts, starting over past that.
import type { Item } from '@liveplanner/items';

type Kept = { reads: object | undefined; value: unknown };
export const KEPT_PER_LIST = 32;
const kept = new WeakMap<readonly Item[], Map<string, Kept>>();

export function keptStat<T>(
  items: readonly Item[],
  key: string,
  count: () => T,
  reads?: object,
): T {
  let byKey = kept.get(items);
  if (!byKey) {
    byKey = new Map();
    kept.set(items, byKey);
  }
  const hit = byKey.get(key);
  if (hit && hit.reads === reads) return hit.value as T;
  const value = count();
  if (!hit && byKey.size >= KEPT_PER_LIST) byKey.clear();
  byKey.set(key, { reads, value });
  return value;
}
