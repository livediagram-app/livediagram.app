// The page someone is on in Pages mode, its kind and its id (docs/specs/007-editor/wireframe-pages.md
// "The Elements palette"): set where the palette follows the page (useLogoPaletteSwitch), read by
// the palette, whose kind defaults to the page's (palette-kind.ts).
// One per browser tab; null off Pages mode or before any page is known.
import { useSyncExternalStore } from 'react';
import type { PageKind } from '@livepages/document';

let current: PageKind | null = null;
// The page's id too: what Select All selects in Pages mode (select-all-ids.ts).
let currentPageId: string | null = null;
const listeners = new Set<() => void>();

export function setCurrentPageKind(kind: PageKind | null, pageId: string | null = null): void {
  if (kind === current && pageId === currentPageId) return;
  currentPageId = pageId;
  current = kind;
  for (const l of listeners) l();
}

/** The id of the page someone is on, read when it is needed (a shortcut), never rendered. */
export function currentPageIdNow(): string | null {
  return currentPageId;
}

/** Listen for the page someone is on changing (its kind or its id). */
export function subscribeCurrentPage(listener: () => void): () => void {
  return subscribe(listener);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The id of the page someone is on, for what is chosen per page (the palette's kind). */
export function useCurrentPageId(): string | null {
  return useSyncExternalStore(
    subscribe,
    () => currentPageId,
    () => null,
  );
}

export function useCurrentPageKind(): PageKind | null {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => null,
  );
}
