'use client';

import { useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import type { Layer } from '@livediagram/diagram';

// Drag a layer row onto another to take its slot (spec/74).
//
// Deliberately POINTER events, not HTML5 drag-and-drop: the tab bar reorders
// with the latter (useTabReorderDrag), but spec/74 rules it out here because
// it is unreliable inside the panel and dead on touch. The two look like the
// same feature and are not the same mechanism, so they stay separate hooks.
//
// The drag engages only after a few px of travel, which is what lets a plain
// click still activate a row and a double-click still rename it.
export function useLayerRowDrag({
  listRef,
  layers,
  renamingId,
  onReorderLayer,
}: {
  // The <ul> the rows live in. Owned by the panel (its row menu measures
  // against the same element), so it is passed in rather than created here.
  listRef: RefObject<HTMLUListElement | null>;
  // Bottom -> top, the data order, which is what onReorderLayer indexes into.
  layers: readonly Layer[];
  // A row being renamed must not start a drag: the caret and the text
  // selection inside the input are the gesture then.
  renamingId: string | null;
  onReorderLayer: (layerId: string, toIndex: number) => void;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  // Which row the pointer is over, by live geometry (rows carry their
  // layer id in a data attribute).
  const rowLayerIdAt = (clientY: number): string | null => {
    const list = listRef.current;
    if (!list) return null;
    for (const child of Array.from(list.children)) {
      const r = child.getBoundingClientRect();
      if (clientY >= r.top && clientY <= r.bottom) {
        return (child as HTMLElement).dataset.layerId ?? null;
      }
    }
    return null;
  };

  // Drag-to-restack starts from ANYWHERE on a row (the grip stays as
  // the visual affordance): pointerdown records the press, and the drag
  // only engages once the pointer travels a few px — so plain clicks
  // (activate) and double-clicks (rename) still work. Presses on the
  // row's buttons / rename input keep their own gestures. Pointer
  // capture on the row keeps move / up flowing during the drag.
  const pressRef = useRef<{ id: string; x: number; y: number } | null>(null);
  const rowPointerDown = (layerId: string) => (e: ReactPointerEvent<HTMLElement>) => {
    if (e.button !== 0 || renamingId === layerId) return;
    if (e.target instanceof HTMLElement && e.target.closest('button, input')) return;
    pressRef.current = { id: layerId, x: e.clientX, y: e.clientY };
  };
  const rowPointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    const press = pressRef.current;
    if (press && !dragId) {
      if (Math.hypot(e.clientX - press.x, e.clientY - press.y) > 4) {
        e.currentTarget.setPointerCapture(e.pointerId);
        setDragId(press.id);
      }
      return;
    }
    if (dragId) {
      const over = rowLayerIdAt(e.clientY);
      setDropTargetId(over && over !== dragId ? over : null);
    }
  };
  const rowPointerUp = () => {
    pressRef.current = null;
    if (!dragId) return;
    if (dropTargetId) {
      // Dropping ON a row means "take that row's slot": convert the
      // target's position back to the bottom->top data index.
      const toIndex = layers.findIndex((l) => l.id === dropTargetId);
      if (toIndex >= 0) onReorderLayer(dragId, toIndex);
    }
    setDragId(null);
    setDropTargetId(null);
  };

  return { dragId, dropTargetId, rowPointerDown, rowPointerMove, rowPointerUp };
}
