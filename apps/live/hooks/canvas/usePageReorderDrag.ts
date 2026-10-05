// Dragging an Illustrate page's label to reorder the pages (docs/specs/007-editor/
// illustrate-pages.md "Getting around the pages"). A press that travels less than the drag
// threshold stays a click (the label frames its page); past it, the gesture is a reorder: the drop
// slot follows the pointer (where the dragged page's centre would land among the others), drawn
// as a marker in the gap, and the release moves the page there with its content. Escape cancels.
// An article page drags its whole article: the row is moved in units (a page, or an article), so
// no slot falls inside an article.
import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import { pageUnits, unionRects, type LaidOutPage, type PageRect } from '@livediagram/document';

// Screen px a press must travel before it is a drag rather than a click.
const DRAG_THRESHOLD = 6;

// The dragged page and its unit's pages (it, or its whole document), and the slot among the other
// units it would land in.
export type PageReorder = { pageId: string; pageIds: readonly string[]; slot: number };

/** The row's units laid out: each a page or a whole document, with the rect its sheets span. */
export function laidOutUnits(
  pages: readonly LaidOutPage[],
): { pageIds: string[]; rect: PageRect }[] {
  const byId = new Map(pages.map((p) => [p.id, p.rect]));
  return pageUnits(pages).map(({ pageIds }) => {
    return { pageIds, rect: unionRects(pageIds.map((id) => byId.get(id)!))! };
  });
}

/** The slot (0 first) a page's unit lands in when its centre is at `centreX`: after every other
 *  unit whose centre lies left of it. */
export function reorderSlot(
  pages: readonly LaidOutPage[],
  pageId: string,
  centreX: number,
): number {
  return laidOutUnits(pages).filter(
    (u) => !u.pageIds.includes(pageId) && u.rect.x + u.rect.width / 2 < centreX,
  ).length;
}

export function usePageReorderDrag({
  pages,
  zoom,
  onMove,
}: {
  pages: readonly LaidOutPage[];
  zoom: number;
  onMove?: (pageId: string, index: number) => void;
}) {
  const [reorder, setReorder] = useState<PageReorder | null>(null);
  const press = useRef<{ pageId: string; x: number; dragging: boolean } | null>(null);
  // Set by a drag's release (or its cancel), so the click that follows it is not taken as a click
  // on the label.
  const dragged = useRef(false);

  // Escape (or a cancelled pointer): no move. A drag under way is marked done, so the click that
  // ends it is not taken as a click on the label either.
  const cancel = useCallback(() => {
    if (press.current?.dragging) dragged.current = true;
    press.current = null;
    setReorder(null);
  }, []);
  useEffect(() => {
    if (!reorder) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      cancel();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [reorder, cancel]);

  const unitOf = (pageId: string) => laidOutUnits(pages).find((u) => u.pageIds.includes(pageId));
  const slotAt = (pageId: string, screenDx: number) => {
    const unit = unitOf(pageId);
    if (!unit) return 0;
    return reorderSlot(pages, pageId, unit.rect.x + unit.rect.width / 2 + screenDx / zoom);
  };

  const handlers = (pageId: string) => ({
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      e.stopPropagation();
      if (e.button !== 0) return;
      // A fresh press: whatever ended the last one has been had.
      dragged.current = false;
      press.current = { pageId, x: e.clientX, dragging: false };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    onPointerMove: (e: PointerEvent<HTMLElement>) => {
      const p = press.current;
      if (!p || p.pageId !== pageId || !onMove || laidOutUnits(pages).length < 2) return;
      const dx = e.clientX - p.x;
      if (!p.dragging && Math.abs(dx) < DRAG_THRESHOLD) return;
      p.dragging = true;
      setReorder({
        pageId,
        pageIds: unitOf(pageId)?.pageIds ?? [pageId],
        slot: slotAt(pageId, dx),
      });
    },
    onPointerUp: (e: PointerEvent<HTMLElement>) => {
      const p = press.current;
      press.current = null;
      if (!p || p.pageId !== pageId || !p.dragging) return;
      dragged.current = true;
      const slot = slotAt(pageId, e.clientX - p.x);
      setReorder(null);
      onMove?.(pageId, slot);
    },
    onPointerCancel: cancel,
  });
  /** Whether the click now arriving ends a drag (and so is no click); clears the mark. */
  const endsDrag = () => {
    const was = dragged.current;
    dragged.current = false;
    return was;
  };

  return { reorder, handlers, endsDrag };
}
