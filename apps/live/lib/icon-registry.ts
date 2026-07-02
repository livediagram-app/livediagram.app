// Async loader + tiny subscription store for the two icon catalogues: the
// line-art glyphs (icon-catalog-1/2.ts, spec/09 "Icons") and the Technology
// brand marks (tech-icons-data.ts, spec/41). Together they are ~60 kB of pure
// data that almost no first paint needs — a diagram with no icon elements
// never touches them — so they are dynamic-imported here into an async chunk
// instead of riding the editor's first-load JS.
//
// Shape of the module:
// - `ensureIconCatalogs()` kicks (or joins) the one memoized load. The editor
//   page calls it on mount so the fetch overlaps hydration; every rendering /
//   picking surface also calls it via `useIconCatalogs()` as a belt-and-braces
//   fallback (e.g. a future surface that mounts outside the editor page).
// - `subscribeIconCatalogs` + `isIconCatalogsLoaded` are a
//   useSyncExternalStore-compatible pair, so components re-render exactly once
//   when the data arrives and can show a placeholder until then.
// - The `get*Loaded` lookups are SYNCHRONOUS and return undefined until the
//   chunk lands — callers fall back to a placeholder glyph / skeleton tile,
//   never a blank, and never block render on a promise.

import type { IconDef } from './icon-types';
import type { TechIconDef } from './tech-icons';

// Everything derived from the loaded chunks, assembled once. Kept in one
// object (not four nullable module vars) so "loaded" is a single state flip —
// a subscriber can never observe icons without tech icons or vice versa.
type LoadedCatalogs = {
  icons: IconDef[];
  iconById: Map<string, IconDef>;
  techIcons: TechIconDef[];
  techIconById: Map<string, TechIconDef>;
};

let loaded: LoadedCatalogs | null = null;
let loadPromise: Promise<void> | null = null;
const listeners = new Set<() => void>();

// Starts (or joins) the catalogue load. Memoized: every caller after the
// first gets the same in-flight promise, so the chunk is fetched once.
//
// Deliberately NEVER rejects: callers are fire-and-forget (`void
// ensureIconCatalogs()` from render effects), so a rejection would surface as
// an unhandled-rejection noise rather than anything actionable. On a failed
// chunk fetch (flaky network mid-session) we log, clear the memo, and resolve
// — placeholders stay up, and the NEXT call (opening the palette, another
// glyph mounting) retries the fetch instead of being locked out forever.
export function ensureIconCatalogs(): Promise<void> {
  if (!loadPromise) {
    loadPromise = Promise.all([
      import('./icon-catalog-1'),
      import('./icon-catalog-2'),
      import('./tech-icons-data'),
    ])
      .then(([part1, part2, tech]) => {
        // Order matters for the line-art catalogue: part 1 then part 2, so
        // the first entry stays the default icon (same rule the old static
        // concatenation in icons.ts followed).
        const icons = [...part1.ICON_CATALOG_1, ...part2.ICON_CATALOG_2];
        loaded = {
          icons,
          iconById: new Map(icons.map((i) => [i.id, i])),
          techIcons: tech.TECH_ICON_CATALOG,
          techIconById: new Map(tech.TECH_ICON_CATALOG.map((i) => [i.id, i])),
        };
        // Snapshot the listener set: a notified component may unsubscribe /
        // resubscribe synchronously and Set iteration mid-mutation is fragile.
        for (const listener of [...listeners]) listener();
      })
      .catch((err) => {
        console.error('livediagram: failed to load the icon catalogues', err);
        loadPromise = null;
      });
  }
  return loadPromise;
}

// useSyncExternalStore snapshot: flips false → true exactly once per session
// (barring a failed load, which never flips it).
export function isIconCatalogsLoaded(): boolean {
  return loaded !== null;
}

// useSyncExternalStore subscribe: notifies when the catalogues arrive.
export function subscribeIconCatalogs(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// Sync line-art lookup: undefined until the chunk lands (or for an unknown
// id). icons.ts's `getIcon` layers the placeholder fallback on top.
export function getIconLoaded(id: string | undefined): IconDef | undefined {
  return id ? loaded?.iconById.get(id) : undefined;
}

// Sync tech-icon lookup: undefined until the chunk lands (or for an unknown
// id). Note `isTechIconId` (tech-icons.ts) stays truthful BEFORE load via its
// lightweight id set — only the heavy colour/glyph data waits on the chunk.
export function getTechIconLoaded(id: string | undefined): TechIconDef | undefined {
  return id ? loaded?.techIconById.get(id) : undefined;
}

// Whole-catalogue views for the pickers / search. Empty until loaded — the
// callers subscribe (useIconCatalogs) and re-run when the data lands, so an
// empty array only ever paints a brief loading state, not a dead end.
export function getLoadedIconCatalog(): IconDef[] {
  return loaded?.icons ?? [];
}

export function getLoadedTechIconCatalog(): TechIconDef[] {
  return loaded?.techIcons ?? [];
}
