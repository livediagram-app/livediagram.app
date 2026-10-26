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
  // Each item's patches in the order they were laid, and what they come to together. Taking one back removes
  // just that layer: a later patch on the same key keeps its value whichever call settles first (a refused
  // rename no longer wipes a newer one that the index took).
  const layers = new Map<string, ItemPatch[]>();
  const patches = new Map<string, ItemPatch>();
  const listeners = new Set<() => void>();
  let version = 0;
  const changed = () => {
    version++;
    for (const fn of listeners) fn();
  };
  const merge = (id: string) => {
    const list = layers.get(id);
    if (!list || list.length === 0) {
      layers.delete(id);
      patches.delete(id);
    } else {
      patches.set(id, Object.assign({}, ...list) as ItemPatch);
    }
  };
  return {
    patch(id, patch) {
      const layer = { ...patch };
      const list = layers.get(id);
      if (list) list.push(layer);
      else layers.set(id, [layer]);
      merge(id);
      changed();
      return () => {
        const now = layers.get(id);
        const at = now ? now.indexOf(layer) : -1;
        if (!now || at < 0) return;
        now.splice(at, 1);
        merge(id);
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
      layers.clear();
      patches.clear();
      changed();
    },
  };
}
