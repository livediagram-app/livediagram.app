'use client';

import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { VIEWPORT_EDGE_MARGIN as EDGE } from '@/lib/clamp-to-viewport';

type XY = { x: number; y: number };
type Bounds = { x: number; y: number; width: number; height: number };

// Positions a floating box that hovers above (or below, when there's no room)
// a canvas-space `bounds`, nudging it back inside the viewport when it would
// overflow an edge. Shared by FloatingToolbar + SelectionPopover so the subtle
// flip guard lives in one place.
//
// `placeAbove` flips above<->below at most ONCE per geometry (the flip guard):
// a box that fits neither side could otherwise ping-pong above<->below forever,
// an infinite synchronous re-render that trips React's "Maximum update depth".
// `adjust` is the one-shot edge nudge and is deliberately NOT an effect
// dependency, so the effect never re-enters on its own setAdjust. `zoom` is
// folded into the geometry signature (a zoom change earns a fresh flip
// decision) but kept out of the dep array — the effect re-runs on the
// bounds / offset / placeAbove changes that actually move the box.
//
// The box ref must be attached to the floating element so its measured rect can
// be checked against the viewport. `style` is the ready-to-spread placement:
// the box is horizontally centred over the selection and sits `gap` (in canvas
// units — the caller divides by zoom) above or below it, counter-scaled by
// 1/zoom so it stays a constant on-screen size. Callers still read `placeAbove`
// for any above/below-dependent chrome (e.g. a title badge's side).
export function useEdgeAwarePlacement(
  bounds: Bounds,
  canvasOffset: XY,
  zoom: number,
  gap: number,
): { ref: React.RefObject<HTMLDivElement | null>; placeAbove: boolean; style: CSSProperties } {
  const ref = useRef<HTMLDivElement>(null);
  const [adjust, setAdjust] = useState<XY>({ x: 0, y: 0 });
  const flipSigRef = useRef('');
  const flippedRef = useRef(false);
  const [placeAbove, setPlaceAbove] = useState(true);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const sig = `${bounds.x},${bounds.y},${bounds.width},${bounds.height},${canvasOffset.x},${canvasOffset.y},${zoom}`;
    if (flipSigRef.current !== sig) {
      flipSigRef.current = sig;
      flippedRef.current = false;
    }
    const rect = node.getBoundingClientRect();
    if (!flippedRef.current) {
      if (placeAbove && rect.top < EDGE) {
        flippedRef.current = true;
        setPlaceAbove(false);
        return;
      }
      if (!placeAbove && rect.bottom > window.innerHeight - EDGE) {
        flippedRef.current = true;
        setPlaceAbove(true);
        return;
      }
    }
    // The measured rect already carries the current nudge (it rendered
    // with `adjust` applied), so compute the fresh correction against
    // the UN-nudged position — measuring the nudged box and storing the
    // result as the absolute adjust made the toolbar alternate between
    // clamped and un-clamped while dragging along an edge. The style
    // applies `adjust` in canvas units inside the scale(zoom) wrapper,
    // so its on-screen effect is adjust·zoom (and the screen-space
    // correction below is divided back by zoom when stored).
    const left = rect.left - adjust.x * zoom;
    const right = rect.right - adjust.x * zoom;
    const top = rect.top - adjust.y * zoom;
    const bottom = rect.bottom - adjust.y * zoom;
    let dx = 0;
    let dy = 0;
    if (left < EDGE) dx = EDGE - left;
    else if (right > window.innerWidth - EDGE) dx = window.innerWidth - EDGE - right;
    if (top < EDGE) dy = EDGE - top;
    else if (bottom > window.innerHeight - EDGE) dy = window.innerHeight - EDGE - bottom;
    const nx = dx / zoom;
    const ny = dy / zoom;
    if (nx !== adjust.x || ny !== adjust.y) setAdjust({ x: nx, y: ny });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bounds.x, bounds.y, bounds.width, bounds.height, canvasOffset.x, canvasOffset.y, placeAbove]);

  const baseLeft = bounds.x + bounds.width / 2;
  const baseTop = placeAbove ? bounds.y - gap : bounds.y + bounds.height + gap;
  const style: CSSProperties = {
    left: baseLeft + adjust.x,
    top: baseTop + adjust.y,
    transform: `translate(-50%, ${placeAbove ? '-100%' : '0'}) scale(${1 / zoom})`,
    transformOrigin: placeAbove ? 'center bottom' : 'center top',
  };

  return { ref, placeAbove, style };
}
