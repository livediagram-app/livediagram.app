'use client';

// The marquee selection rectangle (docs/specs/008-canvas/canvas-performance.md "A sweep moves one layer"): the drag
// a selection sweeps out on a bare canvas, in client coordinates. Its rect lives in a store written outside React
// on each frame of the sweep, and only this reads it, so a frame renders this one node and never the canvas, the
// element layer or the chrome around it. It sits on a compositing layer of its own (`will-change: transform`) and
// moves by `transform`, so a frame repaints the rectangle and not the board it floats over.

import { useStoreSlice } from '../../hooks/ui/useStoreSlice';
import type { ReadableStore } from '../../lib/state-store';

export type MarqueeState = { startX: number; startY: number; currentX: number; currentY: number };

const whole = <T,>(s: T) => s;

export function MarqueeRect<M extends MarqueeState>({
  store,
  stroke,
  fill,
}: {
  store: ReadableStore<M | null>;
  stroke: string;
  fill: string;
}) {
  const marquee = useStoreSlice(store, whole);
  if (!marquee) return null;
  const left = Math.min(marquee.startX, marquee.currentX);
  const top = Math.min(marquee.startY, marquee.currentY);
  return (
    <div
      aria-hidden
      data-marquee=""
      // Border + faint fill take the active tab theme's accent, softened on dark paper (each editor's
      // selectionBoxColors, shared with the Map's view window).
      className="pointer-events-none fixed left-0 top-0 z-[var(--z-chrome)] rounded-sm border"
      style={{
        transform: `translate(${left}px, ${top}px)`,
        willChange: 'transform',
        width: Math.abs(marquee.currentX - marquee.startX),
        height: Math.abs(marquee.currentY - marquee.startY),
        borderColor: stroke,
        backgroundColor: fill,
      }}
    />
  );
}
