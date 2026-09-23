'use client';

import { useRef, useState, type PointerEvent, type RefObject } from 'react';

// Drawing a box round a sticky the detector missed (spec/139 Phase 9): press
// on the photo, drag, let go.
//
// Everything here is in PERCENTAGES of the picture, read off the picture's
// on-screen rect — which already carries the zoom — so the drag lands under
// the pointer at any zoom without knowing there is one. The box is handed back
// in working-image pixels.

// A drag shorter than this on screen, either way, is a click.
const DRAW_MIN_SCREEN_PX = 6;

type Rect = { x1: number; y1: number; x2: number; y2: number };

export function useDrawBox(opts: {
  pictureRef: RefObject<HTMLDivElement | null>;
  frame: { width: number; height: number };
  onBox: (box: { x: number; y: number; w: number; h: number }) => void;
}) {
  // The REF is the source of truth (so a pointermove never reads a stale
  // state); the state only drives the dashed rectangle's render.
  const drawingRef = useRef<Rect | null>(null);
  const [drawing, setDrawing] = useState<Rect | null>(null);
  // Where the drag started ON SCREEN, to tell a click from a drag.
  const dragStart = useRef<{ x: number; y: number } | null>(null);

  const point = (e: PointerEvent<HTMLDivElement>) => {
    const rect = opts.pictureRef.current!.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    };
  };

  // Drop the box in progress: a second finger arrived, and this is a pinch.
  const cancel = () => {
    drawingRef.current = null;
    dragStart.current = null;
    setDrawing(null);
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button, input')) return;
    dragStart.current = { x: e.clientX, y: e.clientY };
    const p = point(e);
    drawingRef.current = { x1: p.x, y1: p.y, x2: p.x, y2: p.y };
    setDrawing({ ...drawingRef.current });
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!drawingRef.current) return;
    const p = point(e);
    drawingRef.current = { ...drawingRef.current, x2: p.x, y2: p.y };
    setDrawing({ ...drawingRef.current });
  };

  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const d = drawingRef.current;
    const start = dragStart.current;
    cancel();
    if (!d) return;
    // A click, not a box. Measured on SCREEN, because a fixed share of the
    // photo was a click at one zoom and a whole sticky at another: on a
    // three-hundred-note whiteboard a note is 1.5% of the photo, and a "2% is
    // a click" rule made those notes impossible to draw round.
    if (
      start &&
      (Math.abs(e.clientX - start.x) < DRAW_MIN_SCREEN_PX ||
        Math.abs(e.clientY - start.y) < DRAW_MIN_SCREEN_PX)
    ) {
      return;
    }
    const { width, height } = opts.frame;
    const x1 = Math.min(d.x1, d.x2);
    const y1 = Math.min(d.y1, d.y2);
    const x2 = Math.max(d.x1, d.x2);
    const y2 = Math.max(d.y1, d.y2);
    opts.onBox({
      x: Math.round((x1 / 100) * width),
      y: Math.round((y1 / 100) * height),
      w: Math.round(((x2 - x1) / 100) * width),
      h: Math.round(((y2 - y1) / 100) * height),
    });
  };

  return { drawing, cancel, handlers: { onPointerDown, onPointerMove, onPointerUp } };
}
