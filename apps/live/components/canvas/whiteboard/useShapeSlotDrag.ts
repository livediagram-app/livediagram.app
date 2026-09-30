'use client';

// Dragging a shape slot to pin or unpin it (docs/specs/023-whiteboard/whiteboard.md "Shape slots"): a
// press becomes a drag after SHAPE_SLOT_DRAG_PX, so a press still picks. The group's slots and
// separator are measured once, when the drag starts; the pure rules (lib/whiteboard-shape-slots)
// say where it lands. Escape or a cancelled pointer drops nothing.

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
  slotDropTarget,
  type SlotDropTarget,
  type SlotLayout,
  type SlotSource,
} from '@/lib/whiteboard-shape-slots';
import type { WhiteboardShapeKey } from '@/lib/whiteboard-shape-catalogue';

// Screen px of travel before a press on a slot becomes a drag (the spec's 6 px; wider than the
// chrome's PRESS_DRAG_SLOP_PX so a press on a small dock button never turns into a drag by accident).
export const SHAPE_SLOT_DRAG_PX = 6;

export type SlotDrag = {
  source: SlotSource;
  x: number;
  y: number;
  target: SlotDropTarget;
  layout: SlotLayout;
  // The group's left edge, in client px, for placing the drop indicator inside it.
  groupLeft: number;
};

// The group's pinned slots and separator, in client px.
function measureSlots(group: HTMLElement | null): SlotLayout | null {
  const sep = group?.querySelector('[data-slot-separator]')?.getBoundingClientRect();
  if (!group || !sep) return null;
  const pinned = Array.from(group.querySelectorAll<HTMLElement>('[data-pinned-slot]')).map((el) => {
    const r = el.getBoundingClientRect();
    return { key: el.dataset.slotKey as WhiteboardShapeKey, left: r.left, right: r.right };
  });
  return { separatorX: sep.left + sep.width / 2, pinned };
}

export function useShapeSlotDrag({
  groupRef,
  onDrop,
}: {
  groupRef: React.RefObject<HTMLElement | null>;
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
    let groupLeft = 0;

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
        layout = measureSlots(groupRef.current);
        if (!layout) {
          console.warn('[whiteboard-dock] slot drag: no separator to measure');
          cleanup();
          return;
        }
        groupLeft = groupRef.current?.getBoundingClientRect().left ?? 0;
        dragging.current = true;
        console.debug('[whiteboard-dock] slot drag started', source);
      }
      ev.preventDefault();
      const target = slotDropTarget(ev.clientX, layout);
      setDrag({ source, x: ev.clientX, y: ev.clientY, target, layout, groupLeft });
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
      const target = slotDropTarget(ev.clientX, measured);
      console.debug('[whiteboard-dock] slot dropped', source, target);
      onDrop(source, target);
    };
    const cancel = () => cleanup();
    const escape = (ev: KeyboardEvent) => {
      if (ev.key !== 'Escape' || !dragging.current) return;
      ev.stopPropagation();
      console.debug('[whiteboard-dock] slot drag cancelled');
      cleanup();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    window.addEventListener('keydown', escape, true);
    stop.current = cleanup;
  };

  // True once, for the click that ends a drag: the slot skips its pick.
  const consumeClick = () => {
    if (!suppressClick.current) return false;
    suppressClick.current = false;
    return true;
  };

  return { drag, onSlotPointerDown, consumeClick, isDragging: () => dragging.current };
}
