'use client';

// The Tab Style hover preview (docs/specs/011-theme/canvas-and-theme-dialog.md "Hover to preview"): while the pointer
// rests on a look, a theme, a finish, a typeface, a size or a pattern, the canvas draws the active tab as that choice
// would make it. Render only: nothing is written, saved, broadcast or added to undo, so leaving puts the tab back at
// once, and a click commits through the ordinary setter (the same transform, lib/tab-style-transforms.ts). Each change
// of what the canvas shows, previewed or committed, eases colours over a short transition (STYLE_TRANSITION_MS).
import { useMemo, useSyncExternalStore } from 'react';
import type { Tab } from '@livediagram/document';

type Transform = (tab: Tab) => Tab;

let preview: { tabId: string; transform: Transform } | null = null;
const listeners = new Set<() => void>();

/** How long a style change eases its colours (the long motion token). */
export const STYLE_TRANSITION_MS = 250;
const TRANSITION_CLASS = 'lvd-style-transition';
let transitionTimer: ReturnType<typeof setTimeout> | null = null;

/** Eases the canvas's colours into whatever it draws next (a preview, its end, or a commit). Reduced motion turns
 *  the transition off in CSS. */
export function easeNextStyleChange(): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.add(TRANSITION_CLASS);
  if (transitionTimer) clearTimeout(transitionTimer);
  transitionTimer = setTimeout(() => {
    root.classList.remove(TRANSITION_CLASS);
    transitionTimer = null;
  }, STYLE_TRANSITION_MS + 50);
}

/** Draws the tab as `transform` makes it, until cleared (null). */
export function setTabStylePreview(tabId: string, transform: Transform | null): void {
  if (!transform && !preview) return;
  preview = transform ? { tabId, transform } : null;
  easeNextStyleChange();
  for (const l of listeners) l();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

/** The tab as the canvas should draw it: the preview's transform of it while one is up for this tab, else itself. */
export function useTabAsPreviewed(tab: Tab): Tab {
  const current = useSyncExternalStore(
    subscribe,
    () => preview,
    () => null,
  );
  const transform = current && current.tabId === tab.id ? current.transform : null;
  return useMemo(() => (transform ? transform(tab) : tab), [transform, tab]);
}
