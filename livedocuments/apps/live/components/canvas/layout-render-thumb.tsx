'use client';

// A layout's tile art, every page kind's (docs/specs/007-editor/pages-mode.md "Layouts",
// logo-pages.md "Logo layouts"): the layout built for this page and drawn by the export renderer,
// in the tab's theme and font on the page's own background, so the tile is exactly what pressing
// it puts on the page rather than a wireframe of it. The SVG is our own rendering of the
// layout's placeholder content (its text escaped by the renderer), set as markup.
//
// Drawn as the viewer sees the page, not as an export prints it: placed as a press places it (in the
// tab's theme, themedForTab), then drawn in the viewer's half (elementAsSeen), and on a dark-chrome
// viewer's plain page on the dark paper the canvas shows (PAGE_PAPER_DARK), not an export's white.
import { useMemo } from 'react';
import {
  pageIsDark,
  themedForTab,
  type Appearance,
  type LaidOutPage,
  type Tab,
} from '@livedocuments/document';
import type { PageLayoutId } from '@livedocuments/templates';
import { trustedHtml, useAppearance } from '@livedocuments/ui';
import { useIconCatalogs } from '@/hooks/ui/useIconCatalogs';
import { renderTabToSvg } from '@/lib/export-tab';
import { elementAsSeen } from '@/lib/stock-colour-projector';
import { themeViewMap } from '@/lib/themes';
import { buildPageLayout } from '@livedocuments/templates';
import { withSamplePictures } from './layout-sample-pictures';

// A plain page's paper in dark chrome, as CanvasPages paints it (dark:bg-slate-900).
export const PAGE_PAPER_DARK = '#0f172a';

/** The page as the viewer sees it: a plain page in dark chrome takes the dark paper. */
function pageAsSeen(page: LaidOutPage, appearance: Appearance): LaidOutPage {
  if (appearance !== 'dark' || page.background?.fill) return page;
  return {
    ...page,
    background: { ...page.background, fill: { kind: 'solid', color: PAGE_PAPER_DARK } },
  };
}

/** The page with `layout` placed, as SVG markup: what lands, as the viewer sees it, nothing else
 *  of the tab, save that each picture it leaves for the author shows a sample one
 *  (withSamplePictures). */
export function layoutRenderSvg(
  tab: Tab,
  page: LaidOutPage,
  layout: PageLayoutId,
  appearance: Appearance = 'light',
): string {
  const placed = themedForTab(buildPageLayout(layout, page), tab.theme, {
    dark: pageIsDark(page),
  });
  const seen = pageAsSeen(page, appearance);
  // Elements are drawn for what they sit on: the page's own fill, else the chrome's paper.
  const surface: Appearance = seen.background?.fill
    ? pageIsDark(seen)
      ? 'dark'
      : 'light'
    : appearance;
  const map = themeViewMap(tab.theme, surface);
  const { elements, pictures } = withSamplePictures(
    placed.map((el) => elementAsSeen(el, surface, map)),
  );
  // A tile is a thumbnail: an animated background is drawn still (export-tab's `stillBackground`).
  return renderTabToSvg(
    { ...tab, elements },
    { page: seen, stillBackground: true, images: pictures },
  );
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
  const { appearance } = useAppearance();
  const { rect } = page;
  const markup = useMemo(
    () => layoutRenderSvg(tab, page, layout, appearance),
    // Redrawn for the page's place, size and paint, and the tab's look; not for its elements.
    // oxlint-disable-next-line react/exhaustive-deps
    [
      layout,
      rect.x,
      rect.y,
      rect.width,
      rect.height,
      page.background,
      tab.theme,
      tab.font,
      icons,
      appearance,
    ],
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
