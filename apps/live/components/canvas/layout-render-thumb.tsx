'use client';

import { trustedHtml } from '@livediagram/ui';

// A layout's tile art, every page kind's (docs/specs/007-editor/illustrate-pages.md "Layouts",
// logo-pages.md "Logo layouts"): the layout built for this page and drawn by the export renderer,
// in the tab's theme and font on the page's own background, so the tile is exactly what pressing
// it puts on the page rather than a wireframe of it. The SVG is our own rendering of the
// layout's placeholder content (its text escaped by the renderer), set as markup.
import { useMemo } from 'react';
import type { LaidOutPage, Tab } from '@livediagram/document';
import type { PageLayoutId } from '@livediagram/templates';
import { useIconCatalogs } from '@/hooks/ui/useIconCatalogs';
import { renderTabToSvg } from '@/lib/export-tab';
import { buildPageLayout } from '@livediagram/templates';

/** The page with `layout` placed, as SVG markup: what lands, nothing else of the tab. */
export function layoutRenderSvg(tab: Tab, page: LaidOutPage, layout: PageLayoutId): string {
  const placed = buildPageLayout(layout, page);
  // A tile is a thumbnail: an animated background is drawn still (export-tab's `stillBackground`).
  return renderTabToSvg({ ...tab, elements: placed }, { page, stillBackground: true });
}

/** The tile, drawn with `tab`'s theme and font. */
export function LayoutRenderThumb({
  layout,
  page,
  width,
  tab,
}: {
  layout: PageLayoutId;
  page: LaidOutPage;
  width: number;
  tab: Tab;
}) {
  // The layouts' icon draws once the catalogues are in.
  const icons = useIconCatalogs();
  const { rect } = page;
  const markup = useMemo(
    () => layoutRenderSvg(tab, page, layout),
    // Redrawn for the page's place, size and paint, and the tab's look; not for its elements.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [layout, rect.x, rect.y, rect.width, rect.height, page.background, tab.theme, tab.font, icons],
  );
  return (
    <div
      data-layout-render-thumb={layout}
      aria-hidden
      className="overflow-hidden rounded-sm shadow-sm ring-1 ring-slate-900/10 dark:ring-white/10 [&>svg]:block [&>svg]:h-full [&>svg]:w-full"
      // Whole pixels, so the render is never resampled across a half pixel.
      style={{ width: Math.round(width), height: Math.round((width * rect.height) / rect.width) }}
      dangerouslySetInnerHTML={{ __html: trustedHtml(markup) }}
    />
  );
}
