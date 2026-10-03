// Dragging an Infographic page's label to reorder the pages (docs/specs/007-editor/
// infographic-pages.md "Getting around the pages"). A press that travels less than the drag
// threshold stays a click (the label frames its page); past it, the gesture is a reorder: the drop
// slot follows the pointer (where the dragged page's centre would land among the others), drawn
// as a marker in the gap, and the release moves the page there with its content. Escape cancels.
import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import type { LaidOutPage } from '@livediagram/document';

// Screen px a press must travel before it is a drag rather than a click.
const DRAG_THRESHOLD = 6;

export type PageReorder = { pageId: string; slot: number };

/** The slot (0 first) a page lands in when its centre is at `centreX`: after every other page
 *  whose centre lies left of it. */
export function reorderSlot(
  pages: readonly LaidOutPage[],
  pageId: string,
  centreX: number,
): number {
  return pages.filter((p) => p.id !== pageId && p.rect.x + p.rect.width / 2 < centreX).length;
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

  const slotAt = (pageId: string, screenDx: number) => {
    const page = pages.find((p) => p.id === pageId);
    if (!page) return 0;
    return reorderSlot(pages, pageId, page.rect.x + page.rect.width / 2 + screenDx / zoom);
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
      if (!p || p.pageId !== pageId || !onMove || pages.length < 2) return;
      const dx = e.clientX - p.x;
      if (!p.dragging && Math.abs(dx) < DRAG_THRESHOLD) return;
      p.dragging = true;
      setReorder({ pageId, slot: slotAt(pageId, dx) });
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
