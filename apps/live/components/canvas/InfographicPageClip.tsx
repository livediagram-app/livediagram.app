'use client';

import type { ReactNode } from 'react';
import type { LaidOutPage } from '@livediagram/document';

// Infographic mode cuts elements off at the page edges (docs/specs/007-editor/editor-modes.md "The
// pages"): whatever hangs off a page is hidden, and cannot be pressed, as if the pages were the
// only paper. A layer over the canvas world clipped to the pages, holding the element views only:
// the selection grips are portalled to their own layer above it, so an element hanging off a page
// still shows every handle. The layer takes no presses itself (globals.css [data-page-clip]), so a
// press on the empty canvas still reaches the canvas.

/** The pages as one CSS clip path, in canvas coordinates (the world's origin). */
export function pagesClipPath(pages: readonly LaidOutPage[]): string {
  const rects = pages.map(
    ({ rect: r }) => `M${r.x} ${r.y}H${r.x + r.width}V${r.y + r.height}H${r.x}Z`,
  );
  return `path('${rects.join('')}')`;
}

export function InfographicPageClip({
  pages,
  children,
}: {
  // Absent outside Infographic mode, where nothing is clipped.
  pages: readonly LaidOutPage[] | null;
  children: ReactNode;
}) {
  if (!pages) return <>{children}</>;
  return (
    <div
      data-page-clip=""
      className="absolute inset-0 transition-[clip-path] duration-200 ease-out motion-reduce:transition-none"
      style={{ clipPath: pagesClipPath(pages) }}
    >
      {children}
    </div>
  );
}
