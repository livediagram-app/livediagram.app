'use client';

import { useEffect, useRef, type RefObject } from 'react';
import { ZOOM_MIN, ZOOM_MAX } from '@/lib/canvas';

// Wheel + touch viewport gestures on the canvas:
//   - Pinch-to-zoom on touch screens + trackpad pinch / Ctrl- or
//     Cmd-scroll on desktop.
//   - Two-finger trackpad drag (a plain, modifier-free wheel event) pans
//     the canvas, matching Figma / Excalidraw. Pointer-driven panning
//     (hold-space drag) lives in useCanvasPanAndMarquee; this is the
//     wheel half of the same behaviour.
//
// All listeners are registered on `document` rather than on the canvas
// element so registration never depends on canvasMainRef.current being
// populated at mount time. The handlers look up the element via depsRef
// at call time and guard with canvasEl.contains(e.target) so events
// outside the canvas are ignored.
//
// Zoom formula — the canvas transform is:
//   scale(z) translate(tx, ty)  with transform-origin: center
// which places canvas point (cx, cy) at:
//   screen_x = rect.left + cx * z   (rect = post-transform getBCR of wrapper)
// The fixed wrapper centre wCX = canvasMain.left + canvasMain.width/2
// (no transform on <main> itself). Keeping focal point at screen px:
//   tx2 = (px - wCX) * (1/z2 - 1/z1) + tx1

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

type Deps = {
  canvasMainRef: React.RefObject<HTMLElement | null>;
  viewportZoom: number;
  setViewportZoom: (z: number) => void;
  viewportOffset: { x: number; y: number };
  setViewportOffset: (o: { x: number; y: number }) => void;
};

type Api = {
  // True while a 2-finger pinch is active. The pan/marquee hook
  // reads this to suppress pointer-driven panning so the two systems
  // don't fight over viewportOffset during a pinch gesture.
  isPinchingRef: RefObject<boolean>;
};

export function useCanvasPinchZoom(deps: Deps): Api {
  const depsRef = useRef(deps);
  depsRef.current = deps;
  const isPinchingRef = useRef(false);

  useEffect(() => {
    // Per-gesture state for the 2-finger pinch.
    let pinch: {
      startDist: number;
      startZoom: number;
      startOffset: { x: number; y: number };
      midX: number;
      midY: number;
    } | null = null;

    const wrapperCenter = () => {
      const r = depsRef.current.canvasMainRef.current?.getBoundingClientRect();
      return {
        wCX: (r?.left ?? 0) + (r?.width ?? 0) / 2,
        wCY: (r?.top ?? 0) + (r?.height ?? 0) / 2,
      };
    };

    const touchDist = (a: Touch, b: Touch) => {
      const dx = a.clientX - b.clientX;
      const dy = a.clientY - b.clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };

    const zoomAtFocal = (
      newZoom: number,
      focalX: number,
      focalY: number,
      fromZoom: number,
      fromOffset: { x: number; y: number },
    ) => {
      const clamped = clamp(newZoom, ZOOM_MIN, ZOOM_MAX);
      const { wCX, wCY } = wrapperCenter();
      const k = 1 / clamped - 1 / fromZoom;
      depsRef.current.setViewportZoom(clamped);
      depsRef.current.setViewportOffset({
        x: (focalX - wCX) * k + fromOffset.x,
        y: (focalY - wCY) * k + fromOffset.y,
      });
    };

    // ── Touch (mobile pinch) ──────────────────────────────────────────
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      const canvasEl = depsRef.current.canvasMainRef.current;
      if (!canvasEl || !canvasEl.contains(e.target as Node)) return;
      // Prevent the pointer events that would otherwise fire for these
      // touches and trigger a pan / select gesture simultaneously.
      e.preventDefault();
      isPinchingRef.current = true;
      const t0 = e.touches[0]!;
      const t1 = e.touches[1]!;
      pinch = {
        startDist: touchDist(t0, t1),
        startZoom: depsRef.current.viewportZoom,
        startOffset: { ...depsRef.current.viewportOffset },
        midX: (t0.clientX + t1.clientX) / 2,
        midY: (t0.clientY + t1.clientY) / 2,
      };
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!pinch || e.touches.length !== 2) return;
      e.preventDefault();
      const currentDist = touchDist(e.touches[0]!, e.touches[1]!);
      const rawZoom = pinch.startZoom * (currentDist / pinch.startDist);
      zoomAtFocal(rawZoom, pinch.midX, pinch.midY, pinch.startZoom, pinch.startOffset);
    };

    const onTouchEnd = () => {
      pinch = null;
      isPinchingRef.current = false;
    };

    // ── Wheel (trackpad pinch / Ctrl- or Cmd-scroll = zoom; plain
    //    two-finger drag = pan) ─────────────────────────────────────────
    // Capture phase on document beats the browser's built-in page zoom /
    // scroll. We only act when the cursor is over the canvas so a
    // scroll elsewhere (address bar, DevTools, a side panel) keeps normal
    // browser behaviour.

    // Pan commits coalesced to one per frame, accumulating across the
    // wheel events that fire within a frame. Reading viewportOffset off
    // depsRef per event would lose deltas (every event in a burst shares
    // the same stale base before React re-renders); basing each event on
    // the pending value instead accumulates correctly. Mirrors the
    // pointer-pan rAF flush in useCanvasPanAndMarquee.
    let panRaf: number | null = null;
    let pendingPan: { x: number; y: number } | null = null;
    const flushPan = () => {
      panRaf = null;
      if (pendingPan) {
        depsRef.current.setViewportOffset(pendingPan);
        pendingPan = null;
      }
    };

    const onWheel = (e: WheelEvent) => {
      const canvasEl = depsRef.current.canvasMainRef.current;
      if (!canvasEl || !canvasEl.contains(e.target as Node)) return;
      // Ctrl covers trackpad pinch (synthesised ctrlKey) and the Windows /
      // Linux zoom modifier; Cmd (metaKey) is the Mac mouse-wheel modifier.
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const { viewportZoom, viewportOffset } = depsRef.current;
        // deltaY > 0 = pinch-close / scroll-down = zoom out; < 0 = zoom in.
        const factor = Math.exp(-e.deltaY / 200);
        const newZoom = clamp(viewportZoom * factor, ZOOM_MIN, ZOOM_MAX);
        zoomAtFocal(newZoom, e.clientX, e.clientY, viewportZoom, viewportOffset);
        return;
      }
      // No modifier: a two-finger trackpad drag (or wheel scroll) pans.
      // Translate the viewport opposite the scroll delta so content
      // follows the fingers. Offset is canvas-coords, delta is screen px,
      // so divide by zoom (a 100px drag pans 100/zoom canvas px), matching
      // the pointer-pan maths.
      e.preventDefault();
      const { viewportZoom } = depsRef.current;
      const base = pendingPan ?? depsRef.current.viewportOffset;
      pendingPan = {
        x: base.x - e.deltaX / viewportZoom,
        y: base.y - e.deltaY / viewportZoom,
      };
      if (panRaf === null) panRaf = requestAnimationFrame(flushPan);
    };

    document.addEventListener('touchstart', onTouchStart, { passive: false });
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd);
    document.addEventListener('touchcancel', onTouchEnd);
    document.addEventListener('wheel', onWheel, { passive: false, capture: true });

    return () => {
      if (panRaf !== null) cancelAnimationFrame(panRaf);
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
      document.removeEventListener('touchcancel', onTouchEnd);
      document.removeEventListener('wheel', onWheel, { capture: true });
    };
  }, []); // stable — all mutable state read through depsRef at call time

  return { isPinchingRef };
}
