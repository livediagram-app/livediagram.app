'use client';

// A page background hovered in its panel (docs/specs/007-editor/illustrate-pages.md "The page
// panel", Hover previews): shown on the sheet AND on what is drawn on it, so the ink the page would
// take (an article's writing, the elements without colours of their own) is previewed with it, not
// only after the press. On an article page the preview covers every page of its article, as the
// press would.
import { useSyncExternalStore } from 'react';
import type { LaidOutPage, PageBackground } from '@livediagram/document';
import { withBackgroundPatch } from './illustrate-page-paint';

export type PageBackgroundPreview = { pageId: string; patch: Partial<PageBackground> } | null;

let current: PageBackgroundPreview = null;
const listeners = new Set<() => void>();

export function setPageBackgroundPreview(next: PageBackgroundPreview): void {
  if (current === next) return;
  current = next;
  for (const l of listeners) l();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function usePageBackgroundPreview(): PageBackgroundPreview {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => null,
  );
}

/** A page's background as shown now: the preview's, when it is for this page (or this page's
 *  document), else its own. */
export function previewedBackground(
  page: LaidOutPage,
  pages: readonly LaidOutPage[],
  preview: PageBackgroundPreview,
): PageBackground | undefined {
  if (!preview) return page.background;
  const target = pages.find((p) => p.id === preview.pageId);
  const covers = preview.pageId === page.id || (!!page.flow && target?.flow === page.flow);
  return covers ? withBackgroundPatch(page, preview.patch) : page.background;
}

/** The pages with the preview's background on the pages it covers (the same array when none). */
export function withPreviewedBackgrounds(
  pages: readonly LaidOutPage[],
  preview: PageBackgroundPreview,
): readonly LaidOutPage[] {
  if (!preview) return pages;
  return pages.map((p) => {
    const background = previewedBackground(p, pages, preview);
    if (background === p.background) return p;
    const { background: _drop, ...rest } = p;
    void _drop;
    return background ? { ...rest, background } : rest;
  });
}
