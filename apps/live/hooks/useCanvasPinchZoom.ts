'use client';

import { useEffect, useRef, type RefObject } from 'react';

// Pinch-to-zoom on touch screens + trackpad pinch / Ctrl+scroll on desktop.
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

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5;
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
      return { wCX: (r?.left ?? 0) + (r?.width ?? 0) / 2, wCY: (r?.top ?? 0) + (r?.height ?? 0) / 2 };
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
      const clamped = clamp(newZoom, MIN_ZOOM, MAX_ZOOM);
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

    // ── Wheel (trackpad pinch / Ctrl+scroll on desktop) ───────────────
    // Capture phase on document beats the browser's built-in page zoom.
    // We only act when the cursor is over the canvas so Ctrl+scroll
    // elsewhere (address bar, DevTools) keeps normal browser behaviour.
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      const canvasEl = depsRef.current.canvasMainRef.current;
      if (!canvasEl || !canvasEl.contains(e.target as Node)) return;
      e.preventDefault();
      const { viewportZoom, viewportOffset } = depsRef.current;
      // deltaY > 0 = pinch-close / scroll-down = zoom out; < 0 = zoom in.
      const factor = Math.exp(-e.deltaY / 200);
      const newZoom = clamp(viewportZoom * factor, MIN_ZOOM, MAX_ZOOM);
      zoomAtFocal(newZoom, e.clientX, e.clientY, viewportZoom, viewportOffset);
    };

    document.addEventListener('touchstart', onTouchStart, { passive: false });
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd);
    document.addEventListener('touchcancel', onTouchEnd);
    document.addEventListener('wheel', onWheel, { passive: false, capture: true });

    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
      document.removeEventListener('touchcancel', onTouchEnd);
      document.removeEventListener('wheel', onWheel, { capture: true });
    };
  }, []); // stable — all mutable state read through depsRef at call time

  return { isPinchingRef };
}
