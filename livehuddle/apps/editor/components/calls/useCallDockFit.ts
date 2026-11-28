'use client';

// Whether the Call dock stands on a line of its own above the cluster's buttons (docs/specs/008-canvas/avatar-mode.md
// "The Call dock", "Where"): measures the cluster row, the dock and the buttons and decides by callDockRowFit.
// Measured again whenever any of them changes size or the window resizes; state is set only when the outcome changes.

import { useLayoutEffect, useState, type RefObject } from 'react';
import { callDockRowFit } from './call-dock-row';

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
  scale,
}: {
  // The dock is in the row.
  active: boolean;
  rowRef: RefObject<HTMLElement | null>;
  scale: number;
}): { lifted: boolean } {
  const [lifted, setLifted] = useState(false);
  useLayoutEffect(() => {
    const row = rowRef.current;
    if (!active || !row) {
      setLifted(false);
      return;
    }
    const measure = () => {
      const dock = row.querySelector<HTMLElement>('[data-call-dock]');
      const buttons = row.querySelector<HTMLElement>('[data-cluster-buttons]');
      if (!dock || !buttons) return;
      setLifted(
        callDockRowFit({
          rowWidth: row.getBoundingClientRect().width,
          dockWidth: dock.getBoundingClientRect().width,
          buttonsWidth: spanOf(buttons),
          scale,
        }).lifted,
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(row);
    for (const el of row.querySelectorAll(
      '[data-call-dock], [data-cluster-buttons], [data-cluster-buttons] > *',
    ))
      observer.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [active, rowRef, scale]);
  return { lifted };
}
