'use client';

import { useEffect, useRef } from 'react';

// The presses a shield stops before anything else sees them: an open menu's outside-press close listens for these on
// the project, and the canvas for the wheel.
const STOPPED = [
  'pointerdown',
  'mousedown',
  'touchstart',
  'click',
  'dblclick',
  'contextmenu',
  'wheel',
] as const;

// A tour step's click shield (docs/specs/007-editor/editor-tour.md "The page waits"): over everything the tour shows
// (menus included), under its card. A press on the page goes nowhere: stopped on the window in the capture phase, ahead
// of every project listener, since a menu the step opened read a press on the shield as an outside press, closed, and
// was reopened by the step, flickering the page. The keyboard still reaches the card (Escape, the arrows).
export function TourShield() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const stop = (e: Event) => {
      if (e.target !== ref.current) return;
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    for (const type of STOPPED)
      window.addEventListener(type, stop, { capture: true, passive: false });
    return () => {
      for (const type of STOPPED) window.removeEventListener(type, stop, { capture: true });
    };
  }, []);
  return (
    <div
      ref={ref}
      aria-hidden
      data-tour-shield=""
      // The not-allowed cursor says the page is held while the step is up.
      className="pointer-events-auto fixed inset-0 z-[calc(var(--z-toast)-1)] cursor-not-allowed"
    />
  );
}
