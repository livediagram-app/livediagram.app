'use client';

// Each drawn page's design view (lib/page-design-views.ts), worked out once per change of what it reads: the tab's
// design, the pages, the settled elements (never a drag frame), the theme, the chrome's light or dark and a hovered
// background. A page whose view is unchanged keeps its object (pageDesignViews' reuse), so its sheet skips the render.
import { useMemo } from 'react';
import { useAppearance } from '@livedocuments/ui';
import type { Element } from '@livedocuments/document';
import type { PagesModeView } from '@/hooks/editor/usePagesMode';
import { pageDesignViews, type PageDesignView } from '@/lib/page-design-views';
import { previewedBackground, usePageBackgroundPreview } from '@/lib/page-background-preview';

export function usePageDesignViews(
  view: Pick<PagesModeView, 'pages' | 'rowPages' | 'pageDesign' | 'theme' | 'tabFont'>,
  settled: readonly Element[],
  preview: ReturnType<typeof usePageBackgroundPreview>,
): ReadonlyMap<string, PageDesignView> {
  const { appearance } = useAppearance();
  const { pages, rowPages, pageDesign, theme, tabFont } = view;
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
      }),
    [pageDesign, pages, rowPages, settled, theme, appearance, tabFont, preview],
  );
}
