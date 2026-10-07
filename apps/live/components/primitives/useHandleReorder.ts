'use client';

// Reorder a list by dragging a row's handle (docs/specs/026-plan/item-types.md "Editing a type": a field's
// handle). Pointer events, not HTML5 drag-and-drop, so it works the same with a mouse, a pen and a finger: the
// handle sets `touch-action: none` (HANDLE_TOUCH) so a touch drag moves the row instead of scrolling, and
// captures the pointer so the drag follows it outside the handle. While dragging, the row follows the pointer
// and the rows it passes slide aside to show where it will land; release places it, Escape or a cancelled
// pointer puts it back. Rows are found by `data-reorder-id` inside the handle's list.
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';

export const HANDLE_TOUCH = 'touch-none select-none';

type Drag = {
  id: string;
  from: number;
  over: number;
  startY: number;
  dy: number;
  // Each row's middle and the dragged row's height plus the gap, measured once when the drag starts.
  mids: number[];
  step: number;
};

// The slot the dragged row lands in: how many other rows' middles its own middle has passed.
export function reorderSlot(mids: readonly number[], from: number, dy: number): number {
  const centre = mids[from]! + dy;
  let slot = 0;
  mids.forEach((m, i) => {
    if (i !== from && centre > m) slot += 1;
  });
  return slot;
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

export function useHandleReorder(
  ids: readonly string[],
  onPlace: (id: string, to: number) => void,
) {
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const set = (next: Drag | null) => {
    dragRef.current = next;
    setDrag(next);
  };

  useEffect(() => {
    if (!drag) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      set(null);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [drag]);

  const handleProps = (id: string) => ({
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => {
      if (e.button !== 0 || ids.length < 2) return;
      const list = e.currentTarget.closest('ul, ol');
      if (!list) return;
      const rows = ids.map((r) =>
        list.querySelector<HTMLElement>(`[data-reorder-id="${CSS.escape(r)}"]`),
      );
      if (rows.some((r) => !r)) return;
      const boxes = rows.map((r) => r!.getBoundingClientRect());
      const from = ids.indexOf(id);
      if (from < 0) return;
      const gap = boxes.length > 1 ? Math.max(0, boxes[1]!.top - boxes[0]!.bottom) : 0;
      e.preventDefault();
      // Capture keeps the drag on the handle as the pointer leaves it; a pointer that cannot be captured (already
      // gone) still drags while it stays over the handle.
      try {
        e.currentTarget.setPointerCapture?.(e.pointerId);
      } catch {
        // Not capturable: carry on uncaptured.
      }
      set({
        id,
        from,
        over: from,
        startY: e.clientY,
        dy: 0,
        mids: boxes.map((b) => b.top + b.height / 2),
        step: boxes[from]!.height + gap,
      });
    },
    onPointerMove: (e: ReactPointerEvent<HTMLElement>) => {
      const d = dragRef.current;
      if (!d || d.id !== id) return;
      const dy = e.clientY - d.startY;
      set({ ...d, dy, over: reorderSlot(d.mids, d.from, dy) });
    },
    onPointerUp: () => {
      const d = dragRef.current;
      if (!d || d.id !== id) return;
      set(null);
      if (d.over !== d.from) onPlace(d.id, d.over);
    },
    onPointerCancel: () => set(null),
  });

  // The row's offset while a drag is on: the dragged row follows the pointer, the rows between where it came
  // from and where it will land slide one step the other way.
  const rowStyle = (id: string): CSSProperties | undefined => {
    if (!drag) return undefined;
    if (id === drag.id) {
      return { transform: `translateY(${drag.dy}px)`, position: 'relative', zIndex: 2 };
    }
    const i = ids.indexOf(id);
    const shift =
      drag.from < drag.over && i > drag.from && i <= drag.over
        ? -drag.step
        : drag.from > drag.over && i >= drag.over && i < drag.from
          ? drag.step
          : 0;
    return {
      transform: shift ? `translateY(${shift}px)` : undefined,
      transition: prefersReducedMotion() ? undefined : 'transform 120ms ease',
    };
  };

  return { draggingId: drag?.id ?? null, handleProps, rowStyle };
}
