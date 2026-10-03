'use client';

import { useEffect, useRef } from 'react';

// A delayed close for a hover-opened flyout (docs/specs/023-draw-mode/draw-mode.md "What a whiteboard
// shows"): `schedule` closes after `ms` unless `cancel` runs first, so the
// pointer can cross the gap between a button and its flyout without losing it.
export function useHoverClose(ms: number): {
  schedule: (close: () => void) => void;
  cancel: () => void;
} {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancel = () => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => cancel, []);
  const schedule = (close: () => void) => {
    cancel();
    timer.current = setTimeout(() => {
      timer.current = null;
      close();
    }, ms);
  };
  return { schedule, cancel };
}
