'use client';

import { useLayoutEffect, useRef } from 'react';

// While `active`, remembers what had keyboard focus as it began; when it ends, puts focus back there, or on
// `fallback()` when that control has gone or is hidden. A presentation left by Escape dropped focus on the page
// itself, and a keyboard user had to Tab in again from the top (docs/specs/012-collaboration/presentation-mode.md
// "Exiting").
export function useFocusReturn(active: boolean, fallback: () => HTMLElement | null): void {
  const opener = useRef<HTMLElement | null>(null);
  const was = useRef(false);
  // Read when the frame runs, not an effect dependency: a new fallback on the render that brings the chrome back
  // re-ran the effect, whose cleanup cancelled the pending frame, so focus never came back.
  const fallbackRef = useRef(fallback);
  useLayoutEffect(() => {
    fallbackRef.current = fallback;
  }, [fallback]);
  useLayoutEffect(() => {
    if (active === was.current) return;
    was.current = active;
    if (active) {
      const el = document.activeElement;
      opener.current = el instanceof HTMLElement && el !== document.body ? el : null;
      return;
    }
    const back = opener.current;
    opener.current = null;
    // After the frame that brings the chrome back, so a control hidden while it ran can take focus again.
    const frame = requestAnimationFrame(() => {
      const target =
        back?.isConnected && back.getClientRects().length > 0 ? back : fallbackRef.current();
      target?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [active]);
}
