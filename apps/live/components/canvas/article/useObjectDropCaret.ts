'use client';

// The drop caret while an object in the writing is dragged (docs/specs/007-editor/article-pages.md
// "Zones"): once the object's centre leaves its zone over its own article's pages, the caret shows
// the block boundary its zone would move to on release (useArticleIntake does the move, from the
// same centre). Read from the object's own box on screen each frame, so it follows the drag
// whatever draws it.
import { useEffect, useRef, useState } from 'react';
import type { ArticleZoneBlock, LaidOutPage, PageRect } from '@livediagram/document';
import { useCanvasGesture } from '@/lib/canvas-gesture';
import { articleHandleOf } from '@/lib/article/article-editor-store';
import { screenToCanvasBySheet, type DropCaret } from './useZoneDrag';

type Held = { flow: string; zone: ArticleZoneBlock; rect: PageRect; elementId: string };

export function useObjectDropCaret({
  target,
  selectedIds,
  zoom,
  pagesOf,
}: {
  // The zone the selection is in now (ArticleFlows' zone target).
  target: { flow: string; zone: ArticleZoneBlock; rect: PageRect } | null;
  selectedIds: ReadonlySet<string>;
  zoom: number;
  pagesOf: (flow: string) => readonly LaidOutPage[] | undefined;
}): DropCaret | null {
  const gesture = useCanvasGesture();
  const [caret, setCaret] = useState<DropCaret | null>(null);
  // The object in hand, taken when the move starts (its zone no longer holds it once it leaves).
  const held = useRef<Held | null>(null);
  const latest = useRef({ target, selectedIds, zoom, pagesOf });
  useEffect(() => {
    latest.current = { target, selectedIds, zoom, pagesOf };
  });

  useEffect(() => {
    if (gesture !== 'move') {
      held.current = null;
      setCaret(null);
      return;
    }
    const { target: t, selectedIds: ids } = latest.current;
    if (!t || t.zone.zone !== 'object' || ids.size !== 1) return;
    held.current = { ...t, elementId: [...ids][0]! };
    let lastLeft = NaN;
    let lastTop = NaN;
    let frame = requestAnimationFrame(function look() {
      frame = requestAnimationFrame(look);
      const h = held.current;
      const pages = h ? latest.current.pagesOf(h.flow) : undefined;
      const el = h
        ? document.querySelector(`[data-element-id="${CSS.escape(h.elementId)}"]`)
        : null;
      if (!h || !pages?.length || !el) return;
      const r = el.getBoundingClientRect();
      // Held still: nothing to look up again (the search runs over every block).
      if (r.left === lastLeft && r.top === lastTop) return;
      lastLeft = r.left;
      lastTop = r.top;
      const at = screenToCanvasBySheet(
        pages[0]!,
        latest.current.zoom,
        r.left + r.width / 2,
        r.top + r.height / 2,
      );
      const within = (b: PageRect) =>
        !!at && at.x >= b.x && at.x <= b.x + b.width && at.y >= b.y && at.y <= b.y + b.height;
      const next =
        at && !within(h.rect) && pages.some((p) => within(p.rect))
          ? (articleHandleOf(h.flow)?.boundaryNear(at, h.zone.id)?.caret ?? null)
          : null;
      setCaret((c) =>
        c === next || (c && next && c.x === next.x && c.y === next.y && c.width === next.width)
          ? c
          : next,
      );
    });
    return () => cancelAnimationFrame(frame);
  }, [gesture]);

  return caret;
}
