'use client';

// A page background hovered in its panel (docs/specs/007-editor/pages-mode.md "The page
// panel", Hover previews): shown on the sheet AND on what is drawn on it, so the ink the page would
// take (the elements without colours of their own) is previewed with it, not only after the press.
import { useSyncExternalStore } from 'react';
import type { LaidOutPage, PageBackground } from '@livedesign/design';
import { withBackgroundPatch } from './page-paint';
import { createListeners } from '@liveworkspace/workbench/lib/listeners';

type PageBackgroundPreview = { pageId: string; patch: Partial<PageBackground> } | null;

let current: PageBackgroundPreview = null;
const listeners = createListeners();

export function setPageBackgroundPreview(next: PageBackgroundPreview): void {
  if (current === next) return;
  current = next;
  listeners.notify();
}

export function usePageBackgroundPreview(): PageBackgroundPreview {
  return useSyncExternalStore(
    listeners.subscribe,
    () => current,
    () => null,
  );
}

/** A page's background as shown now: the preview's, when it is for this page, else its own. */
export function previewedBackground(
  page: LaidOutPage,
  preview: PageBackgroundPreview,
): PageBackground | undefined {
  if (!preview || preview.pageId !== page.id) return page.background;
  return withBackgroundPatch(page, preview.patch);
}

/** The pages with the preview's background on the pages it covers (the same array when none). */
export function withPreviewedBackgrounds(
  pages: readonly LaidOutPage[],
  preview: PageBackgroundPreview,
): readonly LaidOutPage[] {
  if (!preview) return pages;
  return pages.map((p) => {
    const background = previewedBackground(p, preview);
    if (background === p.background) return p;
    const { background: _drop, ...rest } = p;
    void _drop;
    return background ? { ...rest, background } : rest;
  });
}
