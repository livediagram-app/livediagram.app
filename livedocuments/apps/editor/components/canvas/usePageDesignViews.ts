'use client';

// Each drawn page's design view (lib/page-design-views.ts), worked out once per change of what it reads: the tab's
// design, the pages, the settled elements (never a drag frame), the theme, the chrome's light or dark and a hovered
// background. While a Fine Tune control moves, only the pages on screen redraw. A page whose view is unchanged keeps its object (pageDesignViews' reuse), so its sheet skips the render.
import { useMemo } from 'react';
import { useAppearance } from '@livedocuments/ui';
import type { Element } from '@livedocuments/document';
import type { PagesModeView } from '@/hooks/editor/usePagesMode';
import { pageDesignViews, type PageDesignView } from '@/lib/page-design-views';
import { previewedBackground, usePageBackgroundPreview } from '@/lib/page-background-preview';
import { useDesignTuning } from '@/lib/page-design-tuning';

// How far past the screen a page still counts as on screen while a Fine Tune control moves.
const ON_SCREEN_MARGIN = 200;

/** The ids of the page sheets on screen (or within the margin), read once from their rectangles. */
export function pagesOnScreen(margin = ON_SCREEN_MARGIN): ReadonlySet<string> {
  const out = new Set<string>();
  if (typeof document === 'undefined') return out;
  const w = window.innerWidth;
  const h = window.innerHeight;
  for (const el of document.querySelectorAll<HTMLElement>('[data-page-id]')) {
    const r = el.getBoundingClientRect();
    if (r.right >= -margin && r.left <= w + margin && r.bottom >= -margin && r.top <= h + margin) {
      out.add(el.dataset.pageId!);
    }
  }
  return out;
}

export function usePageDesignViews(
  view: Pick<PagesModeView, 'pages' | 'rowPages' | 'pageDesign' | 'theme' | 'tabFont'>,
  settled: readonly Element[],
  preview: ReturnType<typeof usePageBackgroundPreview>,
): ReadonlyMap<string, PageDesignView> {
  const { appearance } = useAppearance();
  const { pages, rowPages, pageDesign, theme, tabFont } = view;
  // A Fine Tune gesture redraws only the pages on screen, read once as it starts; the rest catch up as it settles.
  const tuning = useDesignTuning();
  const redraw = useMemo(() => (tuning ? pagesOnScreen() : undefined), [tuning]);
  return useMemo(
    () =>
      pageDesignViews({
        tabDesign: pageDesign,
        pages,
        row: rowPages ?? pages,
        elements: settled,
        theme: theme ?? {},
        paperDark: appearance === 'dark',
        tabFont,
        backgroundOf: (page) => previewedBackground(page, pages, preview),
        ...(redraw ? { redraw } : {}),
      }),
    [pageDesign, pages, rowPages, settled, theme, appearance, tabFont, preview, redraw],
  );
}
