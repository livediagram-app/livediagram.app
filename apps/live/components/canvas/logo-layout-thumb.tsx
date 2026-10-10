'use client';

// A logo layout's tile art (docs/specs/007-editor/logo-pages.md "Logo layouts"): the layout built
// for this page and drawn by the export renderer, in the tab's theme and font on the page's own
// background, so the tile is exactly what pressing it puts on the page (a logo is small and
// graphic: a wireframe of it reads as nothing like it). The SVG is our own rendering of the
// layout's placeholder content (its text escaped by the renderer), set as markup.
import { useMemo } from 'react';
import type { LaidOutPage, Tab } from '@livediagram/document';
import type { PageLayoutId } from '@livediagram/templates';
import { useIconCatalogs } from '@/hooks/ui/useIconCatalogs';
import { renderTabToSvg } from '@/lib/export-tab';
import { buildPageLayout } from '@livediagram/templates';

/** The page with `layout` placed, as SVG markup: what lands, nothing else of the tab. */
export function logoLayoutSvg(tab: Tab, page: LaidOutPage, layout: PageLayoutId): string {
  const placed = buildPageLayout(layout, page);
  return renderTabToSvg({ ...tab, elements: placed }, { page });
}

/** The tile, drawn with `tab`'s theme and font. */
export function LogoLayoutThumb({
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
    () => logoLayoutSvg(tab, page, layout),
    // Redrawn for the page's place, size and paint, and the tab's look; not for its elements.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [layout, rect.x, rect.y, rect.width, rect.height, page.background, tab.theme, tab.font, icons],
  );
  return (
    <div
      data-logo-layout-thumb={layout}
      aria-hidden
      className="overflow-hidden rounded-sm shadow-sm ring-1 ring-slate-900/10 dark:ring-white/10 [&>svg]:block [&>svg]:h-full [&>svg]:w-full"
      style={{ width, height: (width * rect.height) / rect.width }}
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}
