'use client';

import { useEffect, useRef } from 'react';

// The delay that lets a pointer cross the gap between a trigger and the menu
// it opened without the menu closing underneath it. Hover-open surfaces all
// want this, and all of them got it slightly differently: 120ms in the zoom
// menu, 160ms on the quick-connect ring, 260ms on the Explorer's New menu.
//
// One hook, one timer, and one thing the copies disagreed about: two cleared
// the pending timer when the surface unmounted and one did not, so a menu
// unmounted mid-hover left a timeout to fire setState on a component that had
// gone. The effect below is that guard, so a caller cannot forget it.
//
// The caller keeps the open/closed state. This only decides WHEN the close
// happens: `cancel` on the way in, `scheduleClose` on the way out.
export function useHoverCloseTimer(
  close: () => void,
  delayMs: number,
): { cancel: () => void; scheduleClose: () => void } {
  const timer = useRef<number | null>(null);
  // Latest-callback ref, so a fresh `close` identity each render doesn't have
  // to re-arm anything (the same convention useClickOutside and useEscape use).
  const latest = useRef(close);
  latest.current = close;

  const cancel = () => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  };

  const scheduleClose = () => {
    cancel();
    timer.current = window.setTimeout(() => {
      timer.current = null;
      latest.current();
    }, delayMs);
  };

  // Clearing on unmount is the whole reason this is a hook rather than two
  // functions: it is the step that was missing from one of the three copies.
  useEffect(() => cancel, []);

  return { cancel, scheduleClose };
}
