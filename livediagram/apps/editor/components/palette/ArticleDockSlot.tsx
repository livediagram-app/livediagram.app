'use client';

// The Toolbar strip's slot for an article's formatting (docs/specs/007-editor/article-pages.md "The
// page toolbar"): while the palette's kind is Article the page toolbar renders its controls here,
// at the strip's own sizes, rather than over the page (lib/article/article-dock.ts).
import { useCallback } from 'react';
import { setArticleDock } from '@/lib/article/article-dock';
import { STRIP_RAIL_SCROLL } from '@/components/chrome/toolbar-surface';

export function ArticleDockSlot() {
  const ref = useCallback((el: HTMLDivElement | null) => setArticleDock(el), []);
  // The strip's rail: on a phone's row it gives way and scrolls, as the category bar does.
  return (
    <div
      ref={ref}
      data-article-dock=""
      data-strip-rail=""
      className={`flex items-center ${STRIP_RAIL_SCROLL}`}
    />
  );
}
