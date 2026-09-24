'use client';

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

// The moving part of the Toolbar layout's strip (spec/148): the tiles of the
// current category plus its More button. Switching category can take the
// strip from three tiles to ten, so rather than snapping to the new size:
//
// - the rail's WIDTH eases to the new content's measured width (the strip is
//   centred, so it grows and shrinks from both sides evenly);
// - the new tiles pop in one after another, a short beat apart;
// - the outgoing tiles fade and shrink away on a layer laid over the top,
//   so they leave from where they were instead of vanishing.
//
// Keyed on the category, so re-renders within a category (a tile lighting up
// while its draw is armed) animate nothing. Reduced motion collapses all of
// it to instant through the global rules in globals.css.

// Beat between two incoming tiles. Shorter than the 40ms default of
// `.stagger-enter`: ten tiles at 40ms is nearly half a second of arriving.
const STAGGER_STEP = '22ms';

// How long the outgoing layer stays mounted: its pop-out, shortened.
export const RAIL_LEAVE_MS = 160;

export function ToolbarStripRail({
  railKey,
  items,
  leavingItems,
}: {
  // Identity of what is showing (the category id). A change is what animates.
  railKey: string;
  items: ReactNode[];
  // The previous category's items, while they are on their way out. The host
  // clears this after RAIL_LEAVE_MS.
  leavingItems: ReactNode[] | null;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number | null>(null);
  // Off for the first measured frame, so the strip doesn't animate itself
  // open on page load (the same gate PaletteTabBar uses for its height).
  const [animate, setAnimate] = useState(false);
  // Tiles pop in only once the category has CHANGED: the first set is just
  // there, like the rest of the chrome. Derived during render (React's
  // "adjusting state when a prop changes" pattern), not in an effect.
  const [seenKey, setSeenKey] = useState(railKey);
  const [switched, setSwitched] = useState(false);
  if (railKey !== seenKey) {
    setSeenKey(railKey);
    setSwitched(true);
  }

  useLayoutEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const measure = () => setWidth(el.scrollWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    const raf = requestAnimationFrame(() => setAnimate(true));
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [railKey]);

  return (
    <div
      // Clipped sideways only, so a shrinking rail hides the outgoing tiles
      // past its edge while pressed rings and the pop's overshoot still show.
      className={`relative flex items-center overflow-x-clip [overflow-clip-margin:3px]${
        animate ? ' transition-[width] duration-200 ease-out' : ''
      }`}
      style={{ width: width ?? undefined }}
    >
      <div key={railKey} ref={contentRef} className="flex w-max items-center gap-0.5">
        {items.map((item, i) => (
          <span
            // Index keys are right here: the whole set is replaced on a
            // category change (the parent div is keyed), and within one
            // category the order is fixed.
            key={i}
            className={`flex ${switched ? 'stagger-enter animate-pop-in' : ''}`}
            style={{ '--stagger-i': i, '--stagger-step': STAGGER_STEP } as React.CSSProperties}
          >
            {item}
          </span>
        ))}
      </div>
      {leavingItems ? (
        // Laid over the incoming set, inert, and gone in RAIL_LEAVE_MS.
        <div
          aria-hidden
          inert
          className="pointer-events-none absolute left-0 top-0 flex h-full w-max items-center gap-0.5"
        >
          {leavingItems.map((item, i) => (
            <span
              key={i}
              className="flex animate-pop-out"
              style={{ animationDuration: `${RAIL_LEAVE_MS}ms` }}
            >
              {item}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
