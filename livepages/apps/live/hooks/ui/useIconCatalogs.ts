import { useEffect, useSyncExternalStore } from 'react';

import {
  ensureIconCatalogs,
  isIconCatalogsLoaded,
  subscribeIconCatalogs,
} from '@/lib/icon-registry';

// Subscribes a component to the async icon catalogues (lib/icon-registry.ts)
// and returns whether they have loaded. Used by every surface that renders
// catalogue DATA — the canvas glyph renderers, the palette Icons / Technology
// tabs, and the global search's palette items — so each re-renders exactly
// once when the ~60 kB data chunk lands and can show a placeholder / loading
// state until then. Surfaces that only touch the sync API (MIME constants,
// `isTechIconId`, types) don't need it.
export function useIconCatalogs(): boolean {
  // Kick the load from the first mount of any consumer. The editor page also
  // kicks it eagerly (so the fetch overlaps hydration), but this keeps every
  // catalogue-rendering surface self-sufficient — mounting one is enough to
  // fetch the data it needs, no matter who composes it. `ensureIconCatalogs`
  // is memoized and never rejects, so repeated calls are free and `void` is
  // safe (a failed fetch logs, leaves placeholders up, and retries on the
  // next call).
  useEffect(() => {
    void ensureIconCatalogs();
  }, []);
  // getServerSnapshot returns false: the static export prerenders (and the
  // client hydrates) the placeholder state, then flips to the real glyphs in
  // the post-load re-render — no hydration mismatch.
  return useSyncExternalStore(subscribeIconCatalogs, isIconCatalogsLoaded, () => false);
}
