'use client';

import { useMemo, type Ref } from 'react';
import { isBoxed, unionBoxedBounds, type Element } from '@livediagram/diagram';
import { isoPivot, isoTransform } from '@/lib/isometric';
import { useIsometricCamera } from '@/hooks/canvas/useIsometricCamera';
import type { CanvasTool } from '@/components/palette/CommandPalette';

// The isometric-view slice (spec/45), lifted out of Canvas: the
// orbit-able camera, the content-centre pivot the tilt rotates around,
// and the transform fragment the canvas wrapper appends innermost.
// Everything is local view state — nothing persists or syncs.
export function useIsometricView({
  canvasTool,
  elements,
  mainRef,
}: {
  canvasTool: CanvasTool;
  elements: Element[];
  mainRef: Ref<HTMLElement>;
}) {
  // Isometric camera (spec/45): the orbit-able view angle. Local, non-synced
  // view state; Shift-drag on the canvas spins / tilts it (the <main>
  // pointerdown handler routes to `isoCamera.startOrbit`).
  const isoCamera = useIsometricCamera();

  // Centre of the boxed content, in canvas px — the point the isometric
  // tilt pivots around so the diagram tilts in place (and stays put as you
  // orbit) instead of swinging off-screen. Only computed while the tool is
  // active; null when there's no boxed element to centre on.
  const isoContentCenter = useMemo(() => {
    if (canvasTool !== 'isometric') return null;
    const boxedIds = new Set(elements.filter(isBoxed).map((el) => el.id));
    if (boxedIds.size === 0) return null;
    const bb = unionBoxedBounds(elements, boxedIds);
    if (!bb) return null;
    return { x: bb.x + bb.width / 2, y: bb.y + bb.height / 2 };
  }, [canvasTool, elements]);

  // Isometric tilt fragment, appended innermost to the wrapper transform.
  // The pivot (content centre relative to the wrapper centre) makes the
  // tilt rotate around the diagram rather than the wrapper centre, so the
  // content tilts in place and stays centred as the camera orbits. The
  // wrapper's unscaled size = the main canvas rect (it's `absolute inset-0`
  // and untransformed itself), read here rather than tracked in state
  // because the transform recomputes on every pan / orbit render anyway.
  let isoFragment = '';
  if (canvasTool === 'isometric') {
    const node = mainRef && 'current' in mainRef ? mainRef.current : null;
    const rect = node?.getBoundingClientRect();
    const pivot = rect
      ? isoPivot(isoContentCenter, { width: rect.width, height: rect.height })
      : null;
    isoFragment = ` ${isoTransform(isoCamera.azimuth, isoCamera.elevation, pivot ?? undefined)}`;
  }

  return { isoCamera, isoFragment };
}
