import { useRef, useState } from 'react';
import { isDragTravel } from '@/lib/press-gestures';
import { useLatest } from './useLatest';

// A list's rows dragged to reorder them (the Slide Deck's slides, docs/specs/012-collaboration/presentation-mode.md;
// Contents' pages, docs/specs/007-editor/illustrate-pages.md "Contents"). The order does NOT change while you drag:
// a caret shows where the row will land and the move commits on release. Reordering live meant the list reshuffled
// under the pointer, which moved the very row you were aiming at; the tab bar settled this already
// (docs/specs/006-document/tab-folders.md) and this follows it, with pointer events instead of HTML5 dnd so it works
// on touch. Each row carries `data-<slot>={index}`; the caller says what a drop means.

/** Where a dropped row lands: beside the row at `index`, in the half the pointer is over. */
export type RowDrop = { index: number; side: 'before' | 'after' };

/** The index a single row moved from `from` takes when dropped at `drop` in a list of `count`, or
 *  null when it stays put. The caret sits BETWEEN rows, so 'after' is the slot below; pulling the
 *  row out first shifts everything below it up by one, which is why a downward move loses a step. */
export function rowDropIndex(from: number, drop: RowDrop, count: number): number | null {
  let to = drop.side === 'before' ? drop.index : drop.index + 1;
  if (from < to) to -= 1;
  const clamped = Math.max(0, Math.min(count - 1, to));
  return from >= 0 && clamped !== from ? clamped : null;
}

export function useRowReorderDrag({
  slot,
  count,
  disabled = false,
  onDrop,
}: {
  // The rows' data attribute, without `data-` ("slide-slot" for `data-slide-slot`).
  slot: string;
  count: number;
  disabled?: boolean;
  onDrop: (id: string, drop: RowDrop) => void;
}) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);
  const [dropAt, setDropAt] = useState<RowDrop | null>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const dragging = useRef(false);
  // A drag's release is followed by the row's click: it is the drag's, not a press of the row.
  const dragEnded = useRef(false);
  const dropRef = useLatest<RowDrop | null>(dropAt);

  const slotUnder = (x: number, y: number): RowDrop | null => {
    const el = document.elementFromPoint(x, y)?.closest(`[data-${slot}]`);
    const raw = el?.getAttribute(`data-${slot}`);
    if (!el || raw === null || raw === undefined) return null;
    const rect = el.getBoundingClientRect();
    // Which half the pointer is in decides the side, so the caret sits exactly where the row lands.
    return { index: Number(raw), side: y < rect.top + rect.height / 2 ? 'before' : 'after' };
  };

  const beginDrag = (e: React.PointerEvent, id: string) => {
    if (e.button !== 0 || disabled) return;
    origin.current = { x: e.clientX, y: e.clientY };
    dragging.current = false;
    dragEnded.current = false;
    setMoving(false);
    setDraggingId(id);
    // NOT captured here. A row carries a press target and buttons, and capturing on pointer-down
    // redirects every later event to the row, so the click those needed never arrives. Capture
    // happens once it IS a drag.
  };

  const moveDrag = (e: React.PointerEvent) => {
    if (!draggingId || !origin.current) return;
    if (!dragging.current) {
      if (!isDragTravel(e.clientX - origin.current.x, e.clientY - origin.current.y)) return;
      dragging.current = true;
      setMoving(true);
      e.currentTarget.setPointerCapture?.(e.pointerId);
    }
    // elementFromPoint, not the event target: pointer capture keeps every move on the row the drag
    // started from.
    setDropAt(slotUnder(e.clientX, e.clientY));
  };

  const endDrag = (e: React.PointerEvent) => {
    if (dragging.current && e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    const target = dropRef.current;
    if (dragging.current && draggingId && target) onDrop(draggingId, target);
    dragEnded.current = dragging.current;
    setDraggingId(null);
    setMoving(false);
    setDropAt(null);
    dragging.current = false;
    origin.current = null;
  };

  /** Whether the caret shows above row `i`. */
  const caretBefore = (i: number) =>
    moving &&
    dropAt !== null &&
    (dropAt.side === 'before' ? dropAt.index === i : dropAt.index === i - 1);
  /** Whether the caret shows past the last row, for a drop below everything. */
  const caretAfterLast = moving && dropAt?.side === 'after' && dropAt.index === count - 1;
  /** True once, for the click that follows a drag's release: the row should not act on it. */
  const consumeDragClick = () => {
    const was = dragEnded.current;
    dragEnded.current = false;
    return was;
  };

  return {
    draggingId,
    moving,
    beginDrag,
    moveDrag,
    endDrag,
    caretBefore,
    caretAfterLast,
    consumeDragClick,
  };
}
