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
  const measureRef = useRef<(() => void) | null>(null);

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
      if (outer) outer.style.width = `${w}px`;
      setWidth((prev) => (prev === w ? prev : w));
    };
    measureRef.current = measure;
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(inner);
    if (matchParentParity && parent) ro.observe(parent);
    return () => {
      measureRef.current = null;
      ro.disconnect();
    };
  }, [matchParentParity]);
  // And again on every render of the box, in the same commit: content its host re-rendered (a strip's names
  // going, a strip just shown) is measured before anything else in that frame reads where the box sits, where
  // the observer alone reports it later in the frame. One rect read, only when the host renders.
  useLayoutEffect(() => {
    measureRef.current?.();
  });

  return (
    <div ref={outerRef} className={`shrink-0 ${className}`} style={{ width: width ?? undefined }}>
      <div ref={innerRef} className="w-max">
        {children}
      </div>
    </div>
  );
}
