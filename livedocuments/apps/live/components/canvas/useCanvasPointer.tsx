'use client';

import { pointerToCanvas } from '@/lib/canvas';
import { useSpotlight } from '@/hooks/canvas/useSpotlight';
import { useSpotlightConfig } from '@/hooks/canvas/useSpotlightConfig';
import { spotlightRadius } from '@/lib/spotlight-config';
import type { CanvasProps } from '@/components/canvas/Canvas.types';

type CanvasPointerInput = Pick<CanvasProps, 'canvasTool' | 'mainRef' | 'onCanvasPointerMove'> & {
  wrapperRef: React.RefObject<HTMLDivElement | null>;
  viewportZoom: number;
};

// Where the pointer is over the canvas: the spotlight's light in screen space, and the canvas-coords position
// broadcast to peers. One measurement serves both.
export function useCanvasPointer({
  canvasTool,
  mainRef,
  onCanvasPointerMove,
  wrapperRef,
  viewportZoom,
}: CanvasPointerInput) {
  // Spotlight presenter tool (docs/specs/008-canvas/canvas-and-palette.md): screen-space light position +
  // radius. Local to Canvas so the click handlers, the pointer tracker, and
  // the overlay share one source of truth; survives Pan/Select detours
  // because Canvas stays mounted.
  // The spotlight's look (docs/specs/008-canvas/spotlight-panel.md): persisted per browser, read by the
  // overlay and edited from the Spotlight Panel down in the chrome. The light opens at its saved Size.
  const spotlightLook = useSpotlightConfig();
  const spotlight = useSpotlight(spotlightRadius(spotlightLook.config.size));

  // Broadcast the local pointer position to peers (canvas-coords).
  // Throttling lives in page.tsx so the Canvas stays prop-driven.
  const handlePointerMoveCanvas = (e: React.PointerEvent) => {
    // Spotlight tracks the cursor in SCREEN space (px relative to <main>),
    // not canvas-coords: its light must stay put on screen as the canvas
    // pans / zooms under it. <main> is `position: relative` with no border,
    // so its content origin is its bounding-rect top-left.
    if (canvasTool === 'spotlight') {
      const node = mainRef && 'current' in mainRef ? mainRef.current : null;
      const mr = node?.getBoundingClientRect();
      if (mr) spotlight.setPos({ x: e.clientX - mr.left, y: e.clientY - mr.top });
    }
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) return;
    const { x: sx, y: sy } = pointerToCanvas(e.clientX, e.clientY, rect, viewportZoom);
    onCanvasPointerMove(sx, sy, e.target);
  };
  const handlePointerLeaveCanvas = () => {
    onCanvasPointerMove(null, null);
  };
  return {
    spotlightLook,
    spotlight,
    handlePointerMoveCanvas,
    handlePointerLeaveCanvas,
  };
}
