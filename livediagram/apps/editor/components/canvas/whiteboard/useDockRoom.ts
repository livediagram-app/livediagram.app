'use client';

import { useLayoutEffect, useState, type RefObject } from 'react';

// The room the whiteboard dock may take (docs/specs/023-draw-mode/draw-mode.md "When the bar is too
// wide"), in dock px: the width of an invisible probe that carries the dock wrapper's own placement
// classes and zoom, at full width, so it measures the wrapper's max width (the window or pane less the
// menu card's clearance) whatever the breakpoint or position. Folding the bar never resizes the probe,
// so the fit it feeds cannot oscillate. Null until measured, and while inactive (a phone, whose dock
// scrolls sideways instead).
export function useDockRoom(
  probe: RefObject<HTMLElement | null>,
  scale: number,
  active: boolean,
): number | null {
  const [room, setRoom] = useState<number | null>(null);
  useLayoutEffect(() => {
    const node = probe.current;
    if (!active || !node) return;
    const measure = () => {
      const width = node.getBoundingClientRect().width;
      // Not laid out (hidden, or not yet painted): keep the last answer rather than fold everything.
      if (width <= 0) return;
      const next = Math.round(width / (scale > 0 ? scale : 1));
      setRoom((prev) => (prev === next ? prev : next));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    // The window, a split pane and the menu card's clearance all resize the probe: one observer.
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [probe, scale, active]);
  return active ? room : null;
}
