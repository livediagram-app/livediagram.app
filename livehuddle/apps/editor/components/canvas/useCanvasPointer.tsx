'use client';

import { pointerToCanvas } from '@/lib/canvas';
import type { CanvasProps } from '@/components/canvas/Canvas.types';

type CanvasPointerInput = Pick<CanvasProps, 'onCanvasPointerMove'> & {
  wrapperRef: React.RefObject<HTMLDivElement | null>;
  viewportZoom: number;
};

// Where the pointer is over the canvas: the canvas-coords position broadcast to peers.
export function useCanvasPointer({ onCanvasPointerMove, wrapperRef, viewportZoom }: CanvasPointerInput) {
  // Broadcast the local pointer position to peers (canvas-coords).
  // Throttling lives in page.tsx so the Canvas stays prop-driven.
  const handlePointerMoveCanvas = (e: React.PointerEvent) => {
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) return;
    const { x: sx, y: sy } = pointerToCanvas(e.clientX, e.clientY, rect, viewportZoom);
    onCanvasPointerMove(sx, sy, e.target);
  };
  const handlePointerLeaveCanvas = () => {
    onCanvasPointerMove(null, null);
  };
  return {
    handlePointerMoveCanvas,
    handlePointerLeaveCanvas,
  };
}
