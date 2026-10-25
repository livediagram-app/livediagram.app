// What the person has just changed, laid over every list the Explorer has loaded. A rename, a favourite, a
// move or a delete patches the item here at once (optimistic), and every mounted list shows it on the next
// render without refetching; when the index refuses, the patch is taken back and the lists show the item as
// it was. Items a list loaded keep their identity unless patched, so memoised rows re-render only for the
// item that changed.

import type { Item } from '@liveworkspace/index-client';

// `gone`: purged, or dismissed from Shared With Me, so no list shows it.
export type ItemPatch = Partial<Item> & { gone?: boolean };
export type ShownItem = Item & { gone?: boolean };

export type ItemOverlay = {
  /** Lays `patch` over the item; answers a function that takes exactly this patch back. */
  patch: (id: string, patch: ItemPatch) => () => void;
  apply: (item: Item) => ShownItem;
  /** The overlay's version: it changes with every patch, for memos and useSyncExternalStore. */
  version: () => number;
  subscribe: (listener: () => void) => () => void;
  /** Drops every patch, after a reload has brought the index's own answer. */
  clear: () => void;
};

export function createItemOverlay(): ItemOverlay {
  const patches = new Map<string, ItemPatch>();
  const listeners = new Set<() => void>();
  let version = 0;
  const changed = () => {
    version++;
    for (const fn of listeners) fn();
  };
  return {
    patch(id, patch) {
      const before = patches.get(id);
      const after = { ...before, ...patch };
      patches.set(id, after);
      changed();
      return () => {
        const now = patches.get(id);
        if (!now) return;
        // Only this patch's keys go back to what they were; a later patch's other keys stay.
        const restored: ItemPatch = { ...now };
        for (const key of Object.keys(patch) as (keyof ItemPatch)[]) {
          if (before && key in before) (restored as Record<string, unknown>)[key] = before[key];
          else delete restored[key];
        }
        if (Object.keys(restored).length === 0) patches.delete(id);
        else patches.set(id, restored);
        changed();
      };
    },
    apply(item) {
      const p = patches.get(item.id);
      return p ? { ...item, ...p } : item;
    },
    version: () => version,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    clear() {
      if (patches.size === 0) return;
      patches.clear();
      changed();
    },
  };
}
