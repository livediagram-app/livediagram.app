'use client';

import { useEffect, useRef } from 'react';
import { pointerToCanvas } from '@/lib/canvas';
import type { CanvasProps } from '@/components/canvas/Canvas.types';

type CanvasPointerInput = Pick<CanvasProps, 'onCanvasPointerMove'> & {
  wrapperRef: React.RefObject<HTMLDivElement | null>;
  viewportZoom: number;
};

// Where the pointer is over the canvas: the canvas-coords position broadcast to peers.
export function useCanvasPointer({
  onCanvasPointerMove,
  wrapperRef,
  viewportZoom,
}: CanvasPointerInput) {
  // Broadcast the local pointer position to peers (canvas-coords).
  // Throttling lives in page.tsx so the Canvas stays prop-driven.
  // The canvas's box, measured when it moves or resizes rather than on every pointer move: measuring there forced a
  // layout of the whole page each move (the owner, 2026-11-27, asked for top-notch performance; 3d-engine.md
  // "Performance").
  const rectRef = useRef<DOMRect | null>(null);
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const stale = () => {
      rectRef.current = null;
    };
    const ro = new ResizeObserver(stale);
    ro.observe(el);
    ro.observe(document.documentElement);
    window.addEventListener('scroll', stale, { capture: true, passive: true });
    window.addEventListener('resize', stale);
    return () => {
      ro.disconnect();
      window.removeEventListener('scroll', stale, { capture: true });
      window.removeEventListener('resize', stale);
    };
  }, [wrapperRef]);
  const handlePointerMoveCanvas = (e: React.PointerEvent) => {
    const rect = (rectRef.current ??= wrapperRef.current?.getBoundingClientRect() ?? null);
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
