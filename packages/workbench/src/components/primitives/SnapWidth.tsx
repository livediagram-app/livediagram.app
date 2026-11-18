'use client';

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { cssZoomOf } from '../../lib/ui-scale';

// Rounds a content-sized box UP to a whole-pixel width, so whatever sits
// after it (or inside a centred parent) lands on the pixel grid.
//
// Text-sized controls are fractional wide (a label measures 61.39px), and in
// a row of icons that fraction pushes every later icon onto a sub-pixel
// position, where its 1.5px strokes anti-alias to a smear. Rounding the box
// that holds the text stops the fraction there.
//
// The width is a floor (`min-width`), not a fixed size: content that grows in
// a commit (a strip's names coming back) widens its box in that same layout,
// rather than hanging off one side of a box still at the old width until the
// observer runs (Work Tracker 911 took the per-commit read out); only the
// rounding up waits for the observer.
//
// `matchParentParity` also nudges the width by a pixel so its parity matches
// the parent's: a box centred in its parent sits (parent - box) / 2 in, which
// is half a pixel off whenever one width is odd and the other even.
export function SnapWidth({
  children,
  matchParentParity = false,
  className = '',
}: {
  children: ReactNode;
  matchParentParity?: boolean;
  className?: string;
}) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number | null>(null);

  useLayoutEffect(() => {
    const inner = innerRef.current;
    const parent = outerRef.current?.parentElement;
    if (!inner) return;
    const measure = () => {
      // Inside a UI-scaled surface (docs/specs/007-editor/ui-scale.md) the
      // rects are screen px and the width written is the zoomed box's own px.
      // 1 where the browser predates `currentCSSZoom`.
      const zoom = cssZoomOf(inner) ?? 1;
      const box = inner.getBoundingClientRect();
      // Not drawn (a strip hidden while another stands in): keep the width it had, so the box comes back where
      // it was rather than a frame at zero, its content hanging off one side until the next measure.
      if (box.width === 0 && inner.getClientRects().length === 0) return;
      let w = Math.ceil(box.width / zoom);
      if (matchParentParity && parent) {
        const pw = Math.round(parent.getBoundingClientRect().width / zoom);
        if ((pw - w) % 2 !== 0) w += 1;
      }
      // Written straight onto the box as well: a ResizeObserver runs before the paint but its state lands a frame
      // later, and for that frame a content grown past the old width hung off one side of its centred box.
      const outer = outerRef.current;
      if (outer) outer.style.minWidth = `${w}px`;
      setWidth((prev) => (prev === w ? prev : w));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(inner);
    if (matchParentParity && parent) ro.observe(parent);
    return () => ro.disconnect();
  }, [matchParentParity]);
  // Nothing more on a render of the box: content its host re-rendered (a strip's names going, a strip just shown) is
  // measured by the observer, after the frame's layout and before its paint, so the box is never drawn at a stale
  // width. A read in every commit instead made the browser lay out the whole page inside React's commit, and the
  // toolbar renders on every drop of a canvas element: on a 1,000-element board that layout was the drop's largest
  // cost after React (docs/specs/008-canvas/canvas-performance.md "Chrome after a gesture", Work Tracker 911).

  return (
    <div
      ref={outerRef}
      className={`shrink-0 ${className}`}
      style={{ minWidth: width ?? undefined }}
    >
      <div ref={innerRef} className="w-max">
        {children}
      </div>
    </div>
  );
}
