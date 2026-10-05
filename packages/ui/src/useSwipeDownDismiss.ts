'use client';

import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

// Dragging a bottom sheet down by its grab handle (docs/specs/007-editor/live-app.md "Mobile chrome"):
// the sheet follows the finger (never above where it rests), and letting go past DISMISS_PX, or
// with a quick downward flick, closes it; anything less springs it back.
export const DISMISS_PX = 80;
const FLICK_PX_PER_MS = 0.5;

export function useSwipeDownDismiss(onDismiss: () => void): {
  offset: number;
  dragging: boolean;
  handleProps: {
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void;
    onPointerMove: (e: ReactPointerEvent<HTMLElement>) => void;
    onPointerUp: (e: ReactPointerEvent<HTMLElement>) => void;
    onPointerCancel: () => void;
  };
} {
  const start = useRef<{ y: number; t: number } | null>(null);
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);

  const end = () => {
    start.current = null;
    setDragging(false);
    setOffset(0);
  };

  return {
    offset,
    dragging,
    handleProps: {
      onPointerDown: (e) => {
        start.current = { y: e.clientY, t: e.timeStamp };
        setDragging(true);
        e.currentTarget.setPointerCapture?.(e.pointerId);
      },
      onPointerMove: (e) => {
        if (!start.current) return;
        setOffset(Math.max(0, e.clientY - start.current.y));
      },
      onPointerUp: (e) => {
        const s = start.current;
        if (!s) return;
        const dy = e.clientY - s.y;
        const speed = dy / Math.max(1, e.timeStamp - s.t);
        end();
        if (dy > DISMISS_PX || (dy > 16 && speed > FLICK_PX_PER_MS)) onDismiss();
      },
      onPointerCancel: end,
    },
  };
}
