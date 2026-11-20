'use client';

// A knowledgebase page's place on the surface (docs/specs/030-knowledgebase/page-surface.md "What a page looks
// like"): nothing is painted for the page itself, no sheet, border, shadow or edge, so the writing stands straight
// on the app's ground. What it keeps is the page's box (the engine finds the page it is on by this element), the
// breadcrumb above the Title, and the room under the last line. It replaces the fork's sheet and its title bar
// (CanvasPages, CanvasPageSheet), which a knowledgebase page never draws.
import { memo } from 'react';
import type { LaidOutPage } from '@liveknowledge/document';
import { PageBreadcrumb } from '@/components/page-tree/PageBreadcrumb';
import { PAGE_FOOT_ROOM } from '@/lib/page-surface/page-lock';

/** Canvas px the breadcrumb's row is tall, and the gap it keeps above the Title. */
export const BREADCRUMB_ROW = 28;
export const BREADCRUMB_GAP = 10;

export const PageSurfaceSheet = memo(function PageSurfaceSheet({
  page,
  zoom,
  margin,
  topMargin,
  bare,
  mobile,
}: {
  page: LaidOutPage;
  zoom: number;
  // The writing's side margin and top margin inside the page, canvas px: the breadcrumb lines up with the column
  // and ends just above the Title.
  margin: number;
  topMargin: number;
  // Zen: the writing alone.
  bare: boolean;
  // A phone's column has no room for the breadcrumb; the tree's sheet says where the page is.
  mobile: boolean;
}) {
  return (
    <div
      data-page={page.orientation}
      data-page-id={page.id}
      data-page-kind="article"
      data-page-surface=""
      className="pointer-events-none absolute"
      style={{
        left: page.rect.x,
        top: page.rect.y,
        width: page.rect.width,
        height: page.rect.height,
      }}
    >
      {bare || mobile ? null : (
        <div
          data-page-title-row=""
          className="absolute flex items-center"
          style={{
            left: margin,
            right: margin,
            top: Math.max(0, topMargin - BREADCRUMB_ROW - BREADCRUMB_GAP),
            height: BREADCRUMB_ROW,
          }}
        >
          {/* The page's ancestors, each a link; nothing for a top-level page (PageBreadcrumb). */}
          <PageBreadcrumb />
        </div>
      )}
      {/* The room under the page's foot: part of what scrolls, so the last line clears the window's edge. */}
      <div
        aria-hidden
        className="absolute left-0 w-px"
        style={{ top: '100%', height: PAGE_FOOT_ROOM / zoom }}
      />
    </div>
  );
});
