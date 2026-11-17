'use client';

// Keeps the Call dock clear of the bottom-left panels (docs/specs/008-canvas/avatar-mode.md "The Call dock", "Where";
// Work Tracker 1041): measures the cluster row, the dock, the cluster's buttons and the bottom-left corner's stack (the
// Map) and decides, by callDockRowFit, the row's left column and whether the dock stands on a line of its own above
// the buttons. Measured again whenever any of them changes size, the window resizes, or the stack comes or goes
// (`stackKey`); state is set only when the outcome changes.

import { useLayoutEffect, useState, type RefObject } from 'react';
import { callDockRowFit } from './call-dock-row';

const NONE = { clear: 0, lifted: false };

// What the buttons take: from the first one's left to the last one's right. The wrapper itself stretches to its grid
// column, so its own width is the room it was given, not the room it needs.
function spanOf(wrapper: HTMLElement): number {
  const boxes = [...wrapper.children]
    .map((c) => c.getBoundingClientRect())
    .filter((r) => r.width > 0);
  if (boxes.length === 0) return 0;
  return Math.max(...boxes.map((r) => r.right)) - Math.min(...boxes.map((r) => r.left));
}

export function useCallDockFit({
  active,
  rowRef,
  stack,
  stackKey,
  scale,
}: {
  // The dock is in the row.
  active: boolean;
  rowRef: RefObject<HTMLElement | null>;
  // The bottom-left corner's stack, when it shows.
  stack: () => HTMLElement | null;
  // Changes when the stack mounts, unmounts or changes what it holds.
  stackKey: string;
  scale: number;
}): { clear: number; lifted: boolean } {
  const [fit, setFit] = useState(NONE);
  useLayoutEffect(() => {
    const row = rowRef.current;
    if (!active || !row) {
      // The same object bails out of a render when it is already NONE.
      setFit(NONE);
      return;
    }
    const panels = stack();
    const measure = () => {
      const dock = row.querySelector<HTMLElement>('[data-call-dock]');
      const buttons = row.querySelector<HTMLElement>('[data-cluster-buttons]');
      if (!dock || !buttons) return;
      const r = row.getBoundingClientRect();
      const p = panels?.getBoundingClientRect();
      // Only panels standing beside the row's line count (a stack ending above it leaves the line free).
      const beside = p && p.width > 0 && p.bottom > r.top ? p.right : null;
      const next = callDockRowFit({
        rowLeft: r.left,
        rowWidth: r.width,
        panelsRight: beside,
        dockWidth: dock.getBoundingClientRect().width,
        buttonsWidth: spanOf(buttons),
        scale,
      });
      setFit((prev) => (prev.clear === next.clear && prev.lifted === next.lifted ? prev : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(row);
    for (const el of row.querySelectorAll(
      '[data-call-dock], [data-cluster-buttons], [data-cluster-buttons] > *',
    ))
      observer.observe(el);
    if (panels) observer.observe(panels);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [active, rowRef, stack, stackKey, scale]);
  return fit;
}
