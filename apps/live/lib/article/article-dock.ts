// Where the page toolbar docks (docs/specs/007-editor/article-pages.md "The page toolbar"): while
// the palette's kind is Article, the Toolbar strip holds a slot for it (ToolbarPalette), and the
// toolbar renders its controls there instead of over the page.
import { useSyncExternalStore } from 'react';

let dock: HTMLElement | null = null;
const listeners = new Set<() => void>();

/** The strip's slot mounting (an element) or unmounting (null). */
export function setArticleDock(el: HTMLElement | null): void {
  if (el === dock) return;
  dock = el;
  for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useArticleDock(): HTMLElement | null {
  return useSyncExternalStore(
    subscribe,
    () => dock,
    () => null,
  );
}
