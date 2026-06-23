'use client';

import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

// Touch long-press detector. Touch devices never fire `contextmenu`, so a
// press-and-hold is the conventional way to open an element's context menu
// on a phone / tablet (spec/09). Returns an `onPointerDown` to spread onto
// the element: on a TOUCH press it arms a timer and, if the finger neither
// moves past a small slop nor lifts before it fires, calls `onLongPress`
// with the press coordinates. Mouse / pen presses are ignored (they have
// right-click), so this never interferes with desktop drag / select.
//
// Movement cancels it (the press became a drag), as does lifting early, so
// it composes with the existing drag handlers: spread this BEFORE the
// element's own onPointerDown and both run.
const LONG_PRESS_MS = 500;
const MOVE_SLOP_PX = 10;
// Hold this long before the "hold" indicator appears, so a quick tap never
// flashes it — only a deliberate press shows the ring, which then completes as
// the long-press fires at LONG_PRESS_MS.
const REVEAL_DELAY_MS = 180;

export function useLongPress(onLongPress: (clientX: number, clientY: number) => void): {
  onPointerDown: (e: ReactPointerEvent) => void;
  // Screen coords of an in-progress press once it has been held past the
  // reveal delay, for the caller to render a "hold" affordance. null when no
  // press is being held (or it is still within the quick-tap window).
  pressPoint: { x: number; y: number } | null;
} {
  const timers = useRef<{
    fire: ReturnType<typeof setTimeout> | null;
    reveal: ReturnType<typeof setTimeout> | null;
  }>({ fire: null, reveal: null });
  const [pressPoint, setPressPoint] = useState<{ x: number; y: number } | null>(null);
  // Read the latest callback without re-arming listeners each render.
  const cbRef = useRef(onLongPress);
  cbRef.current = onLongPress;

  const clearTimers = () => {
    if (timers.current.fire !== null) clearTimeout(timers.current.fire);
    if (timers.current.reveal !== null) clearTimeout(timers.current.reveal);
    timers.current = { fire: null, reveal: null };
  };

  // Clear any pending timer on unmount so a press that outlives the element
  // (deleted mid-hold) never fires into a stale callback.
  useEffect(() => () => clearTimers(), []);

  const onPointerDown = (e: ReactPointerEvent) => {
    if (e.pointerType !== 'touch') return;
    const startX = e.clientX;
    const startY = e.clientY;
    clearTimers();
    const cancelOnMove = (ev: PointerEvent) => {
      if (
        Math.abs(ev.clientX - startX) > MOVE_SLOP_PX ||
        Math.abs(ev.clientY - startY) > MOVE_SLOP_PX
      )
        cleanup();
    };
    const cleanup = () => {
      clearTimers();
      setPressPoint(null);
      window.removeEventListener('pointermove', cancelOnMove);
      window.removeEventListener('pointerup', cleanup);
      window.removeEventListener('pointercancel', cleanup);
    };
    window.addEventListener('pointermove', cancelOnMove);
    window.addEventListener('pointerup', cleanup);
    window.addEventListener('pointercancel', cleanup);
    timers.current.reveal = setTimeout(
      () => setPressPoint({ x: startX, y: startY }),
      REVEAL_DELAY_MS,
    );
    timers.current.fire = setTimeout(() => {
      cleanup();
      cbRef.current(startX, startY);
    }, LONG_PRESS_MS);
  };

  return { onPointerDown, pressPoint };
}
