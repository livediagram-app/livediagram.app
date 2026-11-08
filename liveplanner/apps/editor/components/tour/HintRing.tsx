'use client';

// A hint's ring (docs/specs/026-plan/plan-tour.md "Hints climb"): a brand outline round the place a hint means, a
// column, a cell, a divider. It takes no pointer and dims nothing, so the thing it rings is used as ever. It follows
// its target (re-measured every TRACK_MS, as the tour engine's ring is) and lets go when the target is gone.

import { useEffect, useState } from 'react';

const TRACK_MS = 150;
// The ring sits this far outside its target.
const RING_PAD_PX = 4;

type Box = { left: number; top: number; width: number; height: number };

// The first of `selectors` drawn on screen, read again at every measure, so the ring moves on as the page changes.
function firstDrawn(selectors: readonly string[]): DOMRect | null {
  for (const s of selectors) {
    const r = document.querySelector(s)?.getBoundingClientRect();
    if (r && (r.width > 0 || r.height > 0)) return r;
  }
  return null;
}

export function HintRing({ selector }: { selector: string | readonly string[] }) {
  const [box, setBox] = useState<Box | null>(null);
  // One string, so a fresh array of the same selectors does not restart the measure.
  const key = typeof selector === 'string' ? selector : selector.join('\n');
  useEffect(() => {
    const selectors = key.split('\n');
    const measure = () => {
      const r = firstDrawn(selectors);
      setBox((prev) => {
        if (!r || (r.width === 0 && r.height === 0)) return null;
        const next = {
          left: r.left - RING_PAD_PX,
          top: r.top - RING_PAD_PX,
          width: r.width + RING_PAD_PX * 2,
          height: r.height + RING_PAD_PX * 2,
        };
        return prev &&
          prev.left === next.left &&
          prev.top === next.top &&
          prev.width === next.width &&
          prev.height === next.height
          ? prev
          : next;
      });
    };
    measure();
    const id = window.setInterval(measure, TRACK_MS);
    return () => window.clearInterval(id);
  }, [key]);
  if (!box) return null;
  return (
    <span
      aria-hidden
      data-hint-ring=""
      className="pointer-events-none fixed z-[var(--z-toast)] animate-fade-in rounded-[10px] border-2 border-brand-500 shadow-[0_0_0_4px_color-mix(in_srgb,var(--color-brand-500)_22%,transparent)] dark:border-brand-400"
      style={box}
    />
  );
}
