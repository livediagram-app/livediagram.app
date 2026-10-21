'use client';

import { useState } from 'react';
import { pointerToCanvas } from '@/lib/canvas';
import type { CanvasProps } from '@/components/canvas/Canvas.types';

type CanvasPointerInput = Pick<CanvasProps, 'canvasTool' | 'mainRef' | 'onCanvasPointerMove'> & {
  wrapperRef: React.RefObject<HTMLDivElement | null>;
  viewportZoom: number;
};

// Where the pointer is over the canvas: the eraser's brush ring in screen space, and the canvas-coords position
// broadcast to peers. One measurement serves both.
export function useCanvasPointer({
  canvasTool,
  mainRef,
  onCanvasPointerMove,
  wrapperRef,
  viewportZoom,
}: CanvasPointerInput) {
  // Where to draw the eraser's brush ring, in <main>-relative px. Null until
  // the pointer has been over the canvas — an eraser ring parked in the middle
  // of the screen would claim a brush that isn't there.
  const [eraserPos, setEraserPos] = useState<{ x: number; y: number } | null>(null);

  // Broadcast the local pointer position to peers (canvas-coords).
  // Throttling lives in page.tsx so the Canvas stays prop-driven.
  const handlePointerMoveCanvas = (e: React.PointerEvent) => {
    // The eraser's brush ring (docs/specs/008-canvas/eraser-panel.md) tracks the cursor in SCREEN space (px
    // relative to <main>), not canvas-coords: it must stay put on screen as the canvas pans / zooms under it.
    // <main> is `position: relative` with no border, so its content origin is its bounding-rect top-left.
    if (canvasTool === 'eraser') {
      const node = mainRef && 'current' in mainRef ? mainRef.current : null;
      const mr = node?.getBoundingClientRect();
      if (mr) setEraserPos({ x: e.clientX - mr.left, y: e.clientY - mr.top });
    }
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) return;
    const { x: sx, y: sy } = pointerToCanvas(e.clientX, e.clientY, rect, viewportZoom);
    onCanvasPointerMove(sx, sy, e.target);
  };
  const handlePointerLeaveCanvas = () => {
    onCanvasPointerMove(null, null);
  };
  return { eraserPos, handlePointerMoveCanvas, handlePointerLeaveCanvas };
}
