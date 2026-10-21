'use client';

import type { ReactNode } from 'react';
import {
  chartPageGrounds,
  elementPageSurfaces,
  pageClipPathData,
  type Element,
  type LaidOutPage,
  type Layer,
} from '@liveplanner/document';
import { ChartGroundsProvider, PageSurfacesProvider } from './CanvasSurfaceContext';
import { usePageBackgroundPreview, withPreviewedBackgrounds } from '@/lib/page-background-preview';

// Pages mode cuts elements off at the page edges (docs/specs/007-editor/editor-modes.md "The
// pages"): whatever hangs off a page is hidden, and cannot be pressed, as if the pages were the
// only paper. A layer over the canvas world clipped to the pages, holding the element views only:
// the selection grips are portalled to their own layer above it, so an element hanging off a page
// still shows every handle. The layer takes no presses itself (globals.css [data-page-clip]), so a
// press on the empty canvas still reaches the canvas. It also inks each element for the page it is
// on (docs/specs/007-editor/pages-mode.md "A dark page has light ink").

/** The pages as one CSS clip path, in canvas coordinates (the world's origin): each page's sheet,
 *  a wireframe page's rounded screen (docs/specs/007-editor/wireframe-pages.md "The screen"). */
export function pagesClipPath(pages: readonly LaidOutPage[]): string {
  // No page to show through: a clip that hides everything (an empty path would clip nothing).
  if (pages.length === 0) return 'polygon(0 0, 0 0, 0 0)';
  const rects = pages.map((page) =>
    page.kind === 'wireframe'
      ? pageClipPathData(page)
      : `M${page.rect.x} ${page.rect.y}H${page.rect.x + page.rect.width}V${page.rect.y + page.rect.height}H${page.rect.x}Z`,
  );
  return `path('${rects.join('')}')`;
}

export function PageClip({
  pages,
  elements,
  layers,
  hiddenPageId = null,
  children,
}: {
  // Absent outside Pages mode, where nothing is clipped.
  pages: readonly LaidOutPage[] | null;
  elements: Element[];
  // The tab's layers, for the paint order a chart's ground is found in (what is drawn under it).
  layers?: Layer[];
  // A page whose content is hidden (left out of the clip): one under a layout preview.
  hiddenPageId?: string | null;
  children: ReactNode;
}) {
  // A background hovered in a page's panel inks the page's elements as the press would.
  const preview = usePageBackgroundPreview();
  if (!pages) return <>{children}</>;
  const shown = withPreviewedBackgrounds(pages, preview);
  return (
    <PageSurfacesProvider surfaces={elementPageSurfaces(elements, shown)}>
      <ChartGroundsProvider grounds={chartPageGrounds(elements, shown, layers)}>
        <div
          data-page-clip=""
          className="absolute inset-0 transition-[clip-path] duration-200 ease-out motion-reduce:transition-none"
          style={{ clipPath: pagesClipPath(pages.filter((p) => p.id !== hiddenPageId)) }}
        >
          {children}
        </div>
      </ChartGroundsProvider>
    </PageSurfacesProvider>
  );
}
