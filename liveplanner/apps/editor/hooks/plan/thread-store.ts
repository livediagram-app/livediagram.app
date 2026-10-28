// The card faces' comment counts (docs/specs/026-plan/items.md "Comments": the comments in a card's open threads), as
// a store each face subscribes to by its own card: a thread write tells only the cards whose count it moved, so a
// busy board re-renders one or two faces, never all of them.

import { useSyncExternalStore } from 'react';

export type ThreadStore = {
  count: (itemId: string) => number;
  subscribe: (itemId: string, onChange: () => void) => () => void;
  setCounts: (counts: ReadonlyMap<string, number>) => void;
  // Every card's count, for an export (its faces are drawn from items, not this store).
  counts: () => ReadonlyMap<string, number>;
};

export function createThreadStore(): ThreadStore {
  let current: ReadonlyMap<string, number> = new Map();
  const listeners = new Map<string, Set<() => void>>();
  return {
    count: (itemId) => current.get(itemId) ?? 0,
    counts: () => current,
    subscribe: (itemId, onChange) => {
      const set = listeners.get(itemId) ?? new Set();
      set.add(onChange);
      listeners.set(itemId, set);
      return () => {
        set.delete(onChange);
        if (set.size === 0) listeners.delete(itemId);
      };
    },
    setCounts: (next) => {
      const before = current;
      current = next;
      for (const [itemId, set] of listeners) {
        if ((before.get(itemId) ?? 0) !== (next.get(itemId) ?? 0)) for (const l of set) l();
      }
    },
  };
}

/** The items as an export draws them: each card with its comment count (an item carries none of its own). */
export function itemsWithCounts<I extends { id: string; openComments?: number }>(
  items: ReadonlyMap<string, I>,
  counts: ReadonlyMap<string, number>,
): ReadonlyMap<string, I> {
  if (counts.size === 0) return items;
  const out = new Map<string, I>();
  for (const [id, item] of items) {
    const n = counts.get(id);
    out.set(id, n ? { ...item, openComments: n } : item);
  }
  return out;
}

const NO_STORE: ThreadStore = createThreadStore();

/** A card's comment count, re-rendering only when that card's count changes. Zero with no store (an export, the
 *  share view). */
export function useThreadCount(store: ThreadStore | null | undefined, itemId: string): number {
  const s = store ?? NO_STORE;
  return useSyncExternalStore(
    (onChange) => s.subscribe(itemId, onChange),
    () => s.count(itemId),
    () => s.count(itemId),
  );
}
