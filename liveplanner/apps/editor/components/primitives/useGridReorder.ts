'use client';

// Reorder a grid of tiles by dragging one (docs/specs/026-plan/item-types.md "Image fields": a Several Images field's
// thumbnails), useHandleReorder's two-way cousin. Pointer events, so a mouse, a pen and a finger move a tile the same
// way: a tile may be dragged itself (a mouse or a pen; a few pixels of travel first, so a press still opens it) or by
// a handle that sets `touch-action: none` (HANDLE_TOUCH), so a finger moves the tile instead of scrolling. While
// dragging, the tile follows the pointer and the others slide to where they will be; release places it, Escape or a
// cancelled pointer puts it back. Tiles are found by `data-reorder-id` inside the dragged element's list; every tile
// is measured once, when the drag starts.
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { prefersReducedMotion } from './useHandleReorder';

// How far a pointer travels before a press becomes a drag.
export const GRID_DRAG_THRESHOLD_PX = 4;

type Point = { x: number; y: number };

type Drag = {
  id: string;
  from: number;
  over: number;
  start: Point;
  dx: number;
  dy: number;
  // Past the threshold: a drag, not a press.
  live: boolean;
  // Each tile's top left and middle, measured when the press started.
  corners: Point[];
  centres: Point[];
};

/** The slot the dragged tile lands in: the one whose middle is nearest its own middle as it is now. */
export function gridSlot(centres: readonly Point[], from: number, dx: number, dy: number): number {
  const c = centres[from];
  if (!c) return from;
  const x = c.x + dx;
  const y = c.y + dy;
  let best = from;
  let nearest = Infinity;
  centres.forEach((p, i) => {
    const d = (p.x - x) ** 2 + (p.y - y) ** 2;
    if (d < nearest) {
      nearest = d;
      best = i;
    }
  });
  return best;
}

/** Where tile `i` stands once the tile at `from` moves to `over`. */
export function slotAfterMove(i: number, from: number, over: number): number {
  if (i === from) return over;
  if (from < over && i > from && i <= over) return i - 1;
  if (from > over && i >= over && i < from) return i + 1;
  return i;
}

export function useGridReorder(ids: readonly string[], onPlace: (id: string, to: number) => void) {
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  // A drag ends in a click on the tile it started on; that click is the drag's, not a press.
  const swallowClick = useRef(false);
  const set = (next: Drag | null) => {
    dragRef.current = next;
    setDrag(next);
  };
  const live = drag?.live === true;

  useEffect(() => {
    if (!live) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      set(null);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [live]);

  const dragProps = (id: string) => ({
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => {
      if (e.button !== 0 || ids.length < 2) return;
      const list = e.currentTarget.closest('ul, ol');
      if (!list) return;
      const tiles = ids.map((t) =>
        list.querySelector<HTMLElement>(`[data-reorder-id="${CSS.escape(t)}"]`),
      );
      if (tiles.some((t) => !t)) return;
      const from = ids.indexOf(id);
      if (from < 0) return;
      const boxes = tiles.map((t) => t!.getBoundingClientRect());
      swallowClick.current = false;
      // Capture keeps the drag on the tile as the pointer leaves it.
      try {
        e.currentTarget.setPointerCapture?.(e.pointerId);
      } catch {
        // Not capturable (already gone): carry on uncaptured.
      }
      set({
        id,
        from,
        over: from,
        start: { x: e.clientX, y: e.clientY },
        dx: 0,
        dy: 0,
        live: false,
        corners: boxes.map((b) => ({ x: b.left, y: b.top })),
        centres: boxes.map((b) => ({ x: b.left + b.width / 2, y: b.top + b.height / 2 })),
      });
    },
    onPointerMove: (e: ReactPointerEvent<HTMLElement>) => {
      const d = dragRef.current;
      if (!d || d.id !== id) return;
      const dx = e.clientX - d.start.x;
      const dy = e.clientY - d.start.y;
      if (!d.live && Math.hypot(dx, dy) < GRID_DRAG_THRESHOLD_PX) return;
      set({ ...d, dx, dy, live: true, over: gridSlot(d.centres, d.from, dx, dy) });
    },
    onPointerUp: () => {
      const d = dragRef.current;
      if (!d || d.id !== id) return;
      set(null);
      if (!d.live) return;
      swallowClick.current = true;
      if (d.over !== d.from) onPlace(d.id, d.over);
    },
    onPointerCancel: () => set(null),
    onClickCapture: (e: ReactMouseEvent<HTMLElement>) => {
      if (!swallowClick.current) return;
      swallowClick.current = false;
      e.preventDefault();
      e.stopPropagation();
    },
  });

  // A tile's offset while a drag is on: the dragged one follows the pointer, the rest move to their places after it.
  const tileStyle = (id: string): CSSProperties | undefined => {
    if (!drag?.live) return undefined;
    if (id === drag.id)
      return {
        transform: `translate(${drag.dx}px, ${drag.dy}px)`,
        position: 'relative',
        zIndex: 2,
      };
    const i = ids.indexOf(id);
    const to = slotAfterMove(i, drag.from, drag.over);
    const at = drag.corners[i];
    const goes = drag.corners[to];
    const shift = at && goes ? { x: goes.x - at.x, y: goes.y - at.y } : { x: 0, y: 0 };
    return {
      transform: shift.x || shift.y ? `translate(${shift.x}px, ${shift.y}px)` : undefined,
      transition: prefersReducedMotion() ? undefined : 'transform 140ms ease',
    };
  };

  return { draggingId: live ? drag.id : null, dragProps, tileStyle };
}
