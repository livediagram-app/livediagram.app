'use client';

import { useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';

// Drag a list row onto another (docs/specs/006-document/layers.md, docs/specs/031-photo/photo-layers.md "The
// Layers tab"): the canvas's Layers panel and a photo's Layers tab both restack this way.
//
// Deliberately POINTER events, not HTML5 drag-and-drop: the layers spec rules the latter out because it is
// unreliable inside a panel and dead on touch (the tab bar's reorder, useTabReorderDrag, uses it and is a
// different mechanism).
//
// The drag engages only after a few px of travel, so a plain click still activates a row and a double-click
// still renames it; presses on a row's buttons and inputs keep their own gestures. Rows carry their id as
// `data-layer-id`, read by live geometry while dragging.

/** Where a drop lands on the row under the pointer: above it, below it, or into it (a row that holds others). */
export type RowDropAt = 'above' | 'below' | 'into';

// Past this travel, in px, a press is a drag.
const DRAG_FROM_PX = 4;

export function useRowPointerDrag({
  listRef,
  renamingId,
  canHold,
  onDrop,
}: {
  // The element the rows are the children of.
  listRef: RefObject<HTMLElement | null>;
  // A row being renamed must not start a drag: the caret and the selection are the gesture then.
  renamingId: string | null;
  // Whether a row takes a drop into it (a photo's group); none do by default.
  canHold?: (id: string) => boolean;
  onDrop: (dragId: string, targetId: string, at: RowDropAt) => void;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<{ id: string; at: RowDropAt } | null>(null);
  const rowAt = (clientY: number): { id: string; at: RowDropAt } | null => {
    const list = listRef.current;
    if (!list) return null;
    for (const child of Array.from(list.children)) {
      const r = child.getBoundingClientRect();
      if (clientY < r.top || clientY > r.bottom) continue;
      const id = (child as HTMLElement).dataset.layerId;
      if (!id) return null;
      const f = r.height > 0 ? (clientY - r.top) / r.height : 0.5;
      const at: RowDropAt =
        canHold?.(id) && f > 0.3 && f < 0.7 ? 'into' : f < 0.5 ? 'above' : 'below';
      return { id, at };
    }
    return null;
  };

  const pressRef = useRef<{ id: string; x: number; y: number } | null>(null);
  const rowPointerDown = (id: string) => (e: ReactPointerEvent<HTMLElement>) => {
    if (e.button !== 0 || renamingId === id) return;
    if (e.target instanceof HTMLElement && e.target.closest('button, input')) return;
    pressRef.current = { id, x: e.clientX, y: e.clientY };
  };
  const rowPointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    const press = pressRef.current;
    if (press && !dragId) {
      if (Math.hypot(e.clientX - press.x, e.clientY - press.y) > DRAG_FROM_PX) {
        e.currentTarget.setPointerCapture(e.pointerId);
        setDragId(press.id);
      }
      return;
    }
    if (dragId) {
      const next = rowAt(e.clientY);
      setOver(next && next.id !== dragId ? next : null);
    }
  };
  const rowPointerUp = () => {
    pressRef.current = null;
    if (!dragId) return;
    if (over) onDrop(dragId, over.id, over.at);
    setDragId(null);
    setOver(null);
  };
  // A cancelled pointer (the system took it) drops nothing.
  const rowPointerCancel = () => {
    pressRef.current = null;
    setDragId(null);
    setOver(null);
  };

  return { dragId, over, rowPointerDown, rowPointerMove, rowPointerUp, rowPointerCancel };
}
