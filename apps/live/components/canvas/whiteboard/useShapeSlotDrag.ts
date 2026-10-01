'use client';

// Dragging a shape onto the pinned side, or off it (docs/specs/023-whiteboard/whiteboard.md "Shape
// slots"): a slot or search result from the Shapes flyout, or a pinned shape on the bar. A press
// becomes a drag after SHAPE_SLOT_DRAG_PX, so a press still picks. The bar is measured once, when
// the drag starts; the pure rules (lib/whiteboard-shape-slots) say where it lands. Escape or a
// cancelled pointer drops nothing.

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
  slotDropTarget,
  type SlotDropTarget,
  type SlotLayout,
  type SlotSource,
} from '@/lib/whiteboard-shape-slots';
import type { WhiteboardShapeKey } from '@/lib/whiteboard-shape-catalogue';

// Screen px of travel before a press becomes a drag (the spec's 6 px; wider than the chrome's
// PRESS_DRAG_SLOP_PX so a press on a small dock button never turns into a drag by accident).
export const SHAPE_SLOT_DRAG_PX = 6;

export type SlotDrag = {
  source: SlotSource;
  x: number;
  y: number;
  target: SlotDropTarget;
  layout: SlotLayout;
};

// The Shapes bar, its pinned shapes and the separator after them, in client px.
function measureBar(): SlotLayout | null {
  const bar = document.querySelector('[data-whiteboard-dock] [data-dock-group="shapes"]');
  const sep = bar?.querySelector('[data-pinned-separator]')?.getBoundingClientRect();
  if (!bar || !sep) return null;
  const { left, right, top, bottom } = bar.getBoundingClientRect();
  const pinned = Array.from(bar.querySelectorAll<HTMLElement>('[data-pinned-slot]')).map((el) => {
    const r = el.getBoundingClientRect();
    return { key: el.dataset.slotKey as WhiteboardShapeKey, left: r.left, right: r.right };
  });
  return { boundaryX: sep.left + sep.width / 2, bar: { left, right, top, bottom }, pinned };
}

export function useShapeSlotDrag({
  onStart,
  onDrop,
}: {
  // The drag began (the Shapes flyout stays open for it).
  onStart?: (source: SlotSource) => void;
  onDrop: (source: SlotSource, target: SlotDropTarget) => void;
}) {
  const [drag, setDrag] = useState<SlotDrag | null>(null);
  const dragging = useRef(false);
  const suppressClick = useRef(false);
  const stop = useRef<(() => void) | null>(null);

  useEffect(() => () => stop.current?.(), []);

  const onSlotPointerDown = (e: ReactPointerEvent, source: SlotSource) => {
    if (e.button !== 0) return;
    stop.current?.();
    const startX = e.clientX;
    const startY = e.clientY;
    let layout: SlotLayout | null = null;

    const cleanup = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      window.removeEventListener('keydown', escape, true);
      stop.current = null;
      dragging.current = false;
      setDrag(null);
    };
    const move = (ev: PointerEvent) => {
      if (!layout) {
        if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < SHAPE_SLOT_DRAG_PX) return;
        layout = measureBar();
        if (!layout) {
          console.warn('[whiteboard-dock] shape drag: no Shapes bar to measure');
          cleanup();
          return;
        }
        dragging.current = true;
        console.debug('[whiteboard-dock] shape drag started', source);
        onStart?.(source);
      }
      ev.preventDefault();
      const target = slotDropTarget(ev.clientX, ev.clientY, layout);
      setDrag({ source, x: ev.clientX, y: ev.clientY, target, layout });
    };
    const up = (ev: PointerEvent) => {
      const measured = layout;
      cleanup();
      if (!measured) return;
      // The click that follows this release is the end of the drag, not a pick.
      suppressClick.current = true;
      setTimeout(() => {
        suppressClick.current = false;
      }, 0);
      const target = slotDropTarget(ev.clientX, ev.clientY, measured);
      console.debug('[whiteboard-dock] shape dropped', source, target);
      onDrop(source, target);
    };
    const cancel = () => cleanup();
    const escape = (ev: KeyboardEvent) => {
      if (ev.key !== 'Escape' || !dragging.current) return;
      ev.stopPropagation();
      console.debug('[whiteboard-dock] shape drag cancelled');
      cleanup();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    window.addEventListener('keydown', escape, true);
    stop.current = cleanup;
  };

  // True once, for the click that ends a drag: the shape skips its pick.
  const consumeClick = () => {
    if (!suppressClick.current) return false;
    suppressClick.current = false;
    return true;
  };

  return { drag, onSlotPointerDown, consumeClick, isDragging: () => dragging.current };
}

export type ShapeSlotDragApi = ReturnType<typeof useShapeSlotDrag>;
