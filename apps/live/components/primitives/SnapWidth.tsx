'use client';

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

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

  useLayoutEffect(() => {
    const inner = innerRef.current;
    const parent = outerRef.current?.parentElement;
    if (!inner) return;
    const measure = () => {
      let w = Math.ceil(inner.getBoundingClientRect().width);
      if (matchParentParity && parent) {
        const pw = Math.round(parent.getBoundingClientRect().width);
        if ((pw - w) % 2 !== 0) w += 1;
      }
      setWidth((prev) => (prev === w ? prev : w));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(inner);
    if (matchParentParity && parent) ro.observe(parent);
    return () => ro.disconnect();
  }, [matchParentParity]);

  return (
    <div ref={outerRef} className={`shrink-0 ${className}`} style={{ width: width ?? undefined }}>
      <div ref={innerRef} className="w-max">
        {children}
      </div>
    </div>
  );
}
