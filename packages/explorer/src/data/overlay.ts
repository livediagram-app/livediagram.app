// What the person has just changed, laid over every list the Explorer has loaded. A rename, a favourite, a
// move or a delete patches the item here at once (optimistic), and every mounted list shows it on the next
// render without refetching; when the index refuses, the patch is taken back and the lists show the item as
// it was. Items a list loaded keep their identity unless patched, so memoised rows re-render only for the
// item that changed.
//
// A patch does not outlive what it stands in for. Once the index has taken it (`settle`), the first read that
// started after that is the index's own answer: `observe` retires the patch and keeps that answer for the keys
// it touched, so a list still holding an older copy shows the newer one, and a later change made elsewhere
// (a folder deleted and its items moved up) is no longer hidden behind a stale patch. A move into a folder
// that is deleted is dropped at once (`dropFolder`).
//
// A read can also race a move the other way: started after a move was laid but before the index took it, a folder's
// read comes back without the item moving into it, and no patch can add a row a list never loaded. `raced` names
// such a read, so its list reads itself again once.

import type { Item } from '@liveworkspace/index-client';

// `gone`: purged, or dismissed from Shared With Me, so no list shows it.
export type ItemPatch = Partial<Item> & { gone?: boolean };
export type ShownItem = Item & { gone?: boolean };

/** Takes the patch back (a refusal). `settle` says the index took it, so a later read may retire it. */
export type PatchHandle = (() => void) & { settle: () => void };

export type ItemOverlay = {
  /** Lays `patch` over the item; answers a function that takes exactly this patch back. */
  patch: (id: string, patch: ItemPatch) => PatchHandle;
  apply: (item: Item) => ShownItem;
  /** A read's start, for `observe`: take it before asking the index. */
  stamp: () => number;
  /** What a read that started at `startedAt` brought back: retires every patch settled before it. */
  observe: (items: readonly Item[], startedAt: number) => void;
  /** Whether a read that started at `startedAt` raced a change of place (a move, Trash, restore or purge): it started
   *  after the change was laid and before the index took it, so it may lack what the change brought in. */
  raced: (startedAt: number) => boolean;
  /** A folder is gone: a move into it no longer stands for anything. */
  dropFolder: (folderId: string) => void;
  /** The overlay's version: it changes with every patch, for memos and useSyncExternalStore. */
  version: () => number;
  subscribe: (listener: () => void) => () => void;
  /** Drops every patch, after a reload has brought the index's own answer. */
  clear: () => void;
  /** How many items it holds anything for. */
  size: () => number;
};

type Layer = { patch: ItemPatch; laidAt: number; settledAt: number | null };
// A change of place the index took: when it was laid and when it settled, for `raced`.
type Placement = { laidAt: number; settledAt: number };
// The index's latest word on the keys the person changed, and when the read that brought it started.
type Base = { values: ItemPatch; seenAt: number };

// The most items whose latest word is kept. Past it the oldest goes; a list still holding that item's older
// copy then shows it as loaded, as it would have had the person never touched it.
export const OVERLAY_BASE_MAX = 500;
// The changes of place `raced` remembers: a read only races the ones settled while it was out, so the last few do.
export const OVERLAY_PLACEMENTS_MAX = 20;
const PLACE_KEYS = ['folderId', 'teamId', 'trashedAt', 'gone'] as const;

export function createItemOverlay(): ItemOverlay {
  // Each item's patches in the order they were laid, and what they come to together. Taking one back removes
  // just that layer: a later patch on the same key keeps its value whichever call settles first (a refused
  // rename no longer wipes a newer one that the index took).
  const layers = new Map<string, Layer[]>();
  const bases = new Map<string, Base>();
  const patches = new Map<string, ItemPatch>();
  const listeners = new Set<() => void>();
  const placements: Placement[] = [];
  let version = 0;
  // Orders settles against read starts.
  let clock = 0;
  const changed = () => {
    version++;
    for (const fn of listeners) fn();
  };
  const merge = (id: string) => {
    const list = layers.get(id);
    if (list && list.length === 0) layers.delete(id);
    const base = bases.get(id);
    if ((!list || list.length === 0) && !base) {
      patches.delete(id);
      return;
    }
    patches.set(
      id,
      Object.assign({}, base?.values, ...(list ?? []).map((l) => l.patch)) as ItemPatch,
    );
  };
  return {
    patch(id, patch) {
      const layer: Layer = { patch: { ...patch }, laidAt: ++clock, settledAt: null };
      const list = layers.get(id);
      if (list) list.push(layer);
      else layers.set(id, [layer]);
      merge(id);
      changed();
      const undo = () => {
        const now = layers.get(id);
        const at = now ? now.indexOf(layer) : -1;
        if (!now || at < 0) return;
        now.splice(at, 1);
        merge(id);
        changed();
      };
      return Object.assign(undo, {
        settle: () => {
          if (layer.settledAt !== null) return;
          layer.settledAt = ++clock;
          if (!PLACE_KEYS.some((k) => k in layer.patch)) return;
          placements.push({ laidAt: layer.laidAt, settledAt: layer.settledAt });
          if (placements.length > OVERLAY_PLACEMENTS_MAX) placements.shift();
          // Lists check whether their read raced it.
          changed();
        },
      });
    },
    apply(item) {
      const p = patches.get(item.id);
      return p ? { ...item, ...p } : item;
    },
    stamp: () => ++clock,
    observe(items, startedAt) {
      // Nothing patched: a list's read costs one size check.
      if (layers.size === 0 && bases.size === 0) return;
      let any = false;
      for (const item of items) {
        const list = layers.get(item.id);
        const base = bases.get(item.id);
        if (!list && !base) continue;
        const retired = list
          ? list.filter((l) => l.settledAt !== null && l.settledAt < startedAt)
          : [];
        const fresher = base !== undefined && base.seenAt < startedAt;
        if (retired.length === 0 && !fresher) continue;
        // The keys the index has now answered for: the retired patches' and the ones already kept.
        const keys = new Set<string>(base ? Object.keys(base.values) : []);
        for (const l of retired) for (const k of Object.keys(l.patch)) keys.add(k);
        const read = item as unknown as Record<string, unknown>;
        const values: Record<string, unknown> = {};
        // `gone` is not a field the index answers with: an item it lists is there.
        for (const k of keys) if (k !== 'gone') values[k] = read[k];
        if (list && retired.length > 0) {
          layers.set(
            item.id,
            list.filter((l) => !retired.includes(l)),
          );
        }
        // Re-inserted, so the Map's order is oldest word first.
        bases.delete(item.id);
        bases.set(item.id, {
          values: values as ItemPatch,
          seenAt: base && !fresher ? base.seenAt : startedAt,
        });
        if (bases.size > OVERLAY_BASE_MAX) {
          const oldest = bases.keys().next().value as string;
          bases.delete(oldest);
          merge(oldest);
        }
        merge(item.id);
        any = true;
      }
      if (any) changed();
    },
    raced: (startedAt) => placements.some((p) => p.laidAt < startedAt && startedAt < p.settledAt),
    dropFolder(folderId) {
      let any = false;
      for (const [id, list] of layers) {
        const kept = list.filter((l) => l.patch.folderId !== folderId);
        if (kept.length === list.length) continue;
        layers.set(id, kept);
        merge(id);
        any = true;
      }
      if (any) changed();
    },
    version: () => version,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    clear() {
      if (patches.size === 0) return;
      layers.clear();
      bases.clear();
      placements.length = 0;
      patches.clear();
      changed();
    },
    size: () => patches.size,
  };
}
