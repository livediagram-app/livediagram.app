'use client';

import type { ReactNode } from 'react';
import { elementPageSurfaces, type Element, type LaidOutPage } from '@livediagram/document';
import { PageSurfacesProvider } from './CanvasSurfaceContext';
import { usePageBackgroundPreview, withPreviewedBackgrounds } from '@/lib/page-background-preview';

// Illustrate mode cuts elements off at the page edges (docs/specs/007-editor/editor-modes.md "The
// pages"): whatever hangs off a page is hidden, and cannot be pressed, as if the pages were the
// only paper. A layer over the canvas world clipped to the pages, holding the element views only:
// the selection grips are portalled to their own layer above it, so an element hanging off a page
// still shows every handle. The layer takes no presses itself (globals.css [data-page-clip]), so a
// press on the empty canvas still reaches the canvas. It also inks each element for the page it is
// on (docs/specs/007-editor/illustrate-pages.md "A dark page has light ink").

/** The pages as one CSS clip path, in canvas coordinates (the world's origin). */
export function pagesClipPath(pages: readonly LaidOutPage[]): string {
  // No page to show through: a clip that hides everything (an empty path would clip nothing).
  if (pages.length === 0) return 'polygon(0 0, 0 0, 0 0)';
  const rects = pages.map(
    ({ rect: r }) => `M${r.x} ${r.y}H${r.x + r.width}V${r.y + r.height}H${r.x}Z`,
  );
  return `path('${rects.join('')}')`;
}

export function IllustratePageClip({
  pages,
  elements,
  hiddenPageId = null,
  children,
}: {
  // Absent outside Illustrate mode, where nothing is clipped.
  pages: readonly LaidOutPage[] | null;
  elements: Element[];
  // A page whose content is hidden (left out of the clip): one under a layout preview.
  hiddenPageId?: string | null;
  children: ReactNode;
}) {
  // A background hovered in a page's panel inks the page's elements as the press would.
  const preview = usePageBackgroundPreview();
  if (!pages) return <>{children}</>;
  return (
    <PageSurfacesProvider
      surfaces={elementPageSurfaces(elements, withPreviewedBackgrounds(pages, preview))}
    >
      <div
        data-page-clip=""
        className="absolute inset-0 transition-[clip-path] duration-200 ease-out motion-reduce:transition-none"
        style={{ clipPath: pagesClipPath(pages.filter((p) => p.id !== hiddenPageId)) }}
      >
        {children}
      </div>
    </PageSurfacesProvider>
  );
}
