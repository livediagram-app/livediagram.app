// The card faces' comment counts (docs/specs/026-plan/items.md "Comments": the comments in a card's open threads, and
// in each Comments field a thread names, under `fieldCountKey`), as a store each face subscribes to by its own card: a thread write tells only the cards whose count it moved, so a
// busy board re-renders one or two faces, never all of them.

import { useCallback, useSyncExternalStore } from 'react';
import {
  COMMENTS_FIELD,
  commentsFieldsOf,
  threadFieldOn,
  type ItemTypeDef,
} from '@liveplanner/items';
import { fieldCountKey } from '@liveplanner/project';

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

/** A card's comment count in one of its type's Comments fields (docs/specs/026-plan/item-types.md "Comments and Votes
 *  fields"): a field's own threads, the threads its field the type does not offer landing in the field they show
 *  under (the built-in, else the first). Re-renders only when one of the card's counts changes. */
export function useFieldThreadCount(
  store: ThreadStore | null | undefined,
  itemId: string,
  type: Pick<ItemTypeDef, 'fields' | 'custom'>,
  field: string,
): number {
  const s = store ?? NO_STORE;
  const fields = commentsFieldsOf(type);
  // The field a thread naming no field of this type shows under: it takes the whole, less the type's other fields.
  const fallback = threadFieldOn({}, type);
  const others = fields.filter((f) => f !== fallback && f !== COMMENTS_FIELD);
  const keys = (field === fallback ? others : [field]).map((f) => fieldCountKey(itemId, f));
  // The keys heard: the whole (the fallback's) and each field's, joined so the subscription is stable across renders.
  const heard = [itemId, ...keys].join('\n');
  const subscribe = useCallback(
    (onChange: () => void) => {
      const offs = heard.split('\n').map((k) => s.subscribe(k, onChange));
      return () => offs.forEach((off) => off());
    },
    [s, heard],
  );
  const read = () => {
    const own = keys.reduce((n, k) => n + s.count(k), 0);
    return field === fallback ? s.count(itemId) - own : own;
  };
  return useSyncExternalStore(subscribe, read, read);
}

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
