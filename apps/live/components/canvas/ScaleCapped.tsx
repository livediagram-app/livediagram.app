'use client';

// A screen inside an element (Setup Board, Setup Sheet, a Sheet loading) that zooms with the canvas, but only so far
// (docs/specs/008-canvas/canvas-and-palette.md "Screens inside an element"): zoomed out it shrinks with its element,
// so it never blocks the view; zoomed in past SCREEN_SCALE_MAX it stops growing, so it never reads as comically
// large. The scale is measured as drawn, so a maximised element (drawn at screen size) is left alone.
import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useCanvasZoom } from './CanvasZoomContext';

// How large such a screen may draw, as a multiple of its own size.
export const SCREEN_SCALE_MAX = 1.25;

export function ScaleCapped({
  className,
  style,
  children,
}: {
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  // Read only to measure again when the zoom moves; the scale itself is measured.
  const zoom = useCanvasZoom();
  const ref = useRef<HTMLDivElement>(null);
  const [cap, setCap] = useState(1);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !el.offsetWidth) return;
    // The drawn scale without this cap: what it draws at now, undone by the cap it has.
    const drawn = el.getBoundingClientRect().width / el.offsetWidth / cap;
    const next = drawn > SCREEN_SCALE_MAX ? SCREEN_SCALE_MAX / drawn : 1;
    if (Math.abs(next - cap) > 0.001) setCap(next);
  }, [zoom, cap]);
  return (
    <div
      ref={ref}
      className={className}
      style={
        cap === 1 ? style : { ...style, transform: `scale(${cap})`, transformOrigin: 'center' }
      }
    >
      {children}
    </div>
  );
}
