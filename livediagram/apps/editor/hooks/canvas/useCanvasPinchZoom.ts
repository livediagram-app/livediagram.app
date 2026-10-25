'use client';

import type { ViewportStore } from '@liveworkspace/workbench/lib/viewport-store';
import { useEffect, useRef, type RefObject } from 'react';
import { clamp } from '@livediagram/document';
import { ZOOM_MIN, ZOOM_MAX } from '@/lib/canvas';
import { WHEEL_SETTLE_MS, beginCanvasGesture } from '@/lib/canvas-gesture';
import { useLatest } from '@/hooks/ui/useLatest';

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

type Deps = {
  canvasMainRef: React.RefObject<HTMLElement | null>;
  // The view, read when a gesture fires and written back (docs/specs/008-canvas/blueprints/viewport-store.md).
  viewport: ViewportStore;
};

type Api = {
  // True while a 2-finger pinch is active. The pan/marquee hook
  // reads this to suppress pointer-driven panning so the two systems
  // don't fight over viewportOffset during a pinch gesture.
  isPinchingRef: RefObject<boolean>;
};

export function useCanvasPinchZoom(deps: Deps): Api {
  const depsRef = useLatest(deps);
  const isPinchingRef = useRef(false);

  useEffect(() => {
    // Per-gesture state for the 2-finger pinch. The wrapper's centre is measured once, at the start:
    // reading layout on every move, straight after the last move wrote the view, forced a layout per
    // touch event.
    let pinch: {
      startDist: number;
      startZoom: number;
      startOffset: { x: number; y: number };
      midX: number;
      midY: number;
      wCX: number;
      wCY: number;
    } | null = null;
    // The latest finger positions, applied once per frame (touch events can outrun the display).
    let pinchRaf: number | null = null;
    let pendingPinch: { dist: number; midX: number; midY: number } | null = null;

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
      // One change of the view: zoom and offset together.
      depsRef.current.viewport.setView({
        zoom: clamped,
        offset: { x: (focalX - wCX) * k + fromOffset.x, y: (focalY - wCY) * k + fromOffset.y },
      });
    };

    // The canvas gestures (docs/specs/008-canvas/canvas-performance.md): a touch pinch is a zoom from
    // its start to its end; a wheel has no end, so its pan or zoom closes WHEEL_SETTLE_MS after the
    // last wheel event, and a switch between the two closes the one in flight.
    let endPinchGesture: (() => void) | null = null;
    let wheelGesture: { kind: 'pan' | 'zoom'; end: () => void; timer: number } | null = null;
    const endWheelGesture = () => {
      if (!wheelGesture) return;
      window.clearTimeout(wheelGesture.timer);
      wheelGesture.end();
      wheelGesture = null;
    };
    const noteWheel = (kind: 'pan' | 'zoom') => {
      if (wheelGesture && wheelGesture.kind !== kind) endWheelGesture();
      wheelGesture ??= { kind, end: beginCanvasGesture(kind), timer: 0 };
      window.clearTimeout(wheelGesture.timer);
      wheelGesture.timer = window.setTimeout(endWheelGesture, WHEEL_SETTLE_MS);
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
      endPinchGesture ??= beginCanvasGesture('zoom');
      const t0 = e.touches[0]!;
      const t1 = e.touches[1]!;
      pinch = {
        startDist: touchDist(t0, t1),
        startZoom: depsRef.current.viewport.get().zoom,
        startOffset: { ...depsRef.current.viewport.get().offset },
        midX: (t0.clientX + t1.clientX) / 2,
        midY: (t0.clientY + t1.clientY) / 2,
        ...wrapperCenter(),
      };
    };

    // The pinch as it stands: the zoom the fingers' spread asks for, with the canvas point that was
    // between the fingers at the start kept between them now, so the board zooms about the fingers
    // and follows them as they move together (docs/specs/008-canvas/canvas-and-palette.md "Touch").
    const flushPinch = () => {
      pinchRaf = null;
      const at = pendingPinch;
      pendingPinch = null;
      if (!pinch || !at) return;
      const zoom = clamp(pinch.startZoom * (at.dist / pinch.startDist), ZOOM_MIN, ZOOM_MAX);
      depsRef.current.viewport.setView({
        zoom,
        offset: pinchOffset(pinch, zoom, at.midX, at.midY),
      });
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!pinch || e.touches.length !== 2) return;
      e.preventDefault();
      const t0 = e.touches[0]!;
      const t1 = e.touches[1]!;
      pendingPinch = {
        dist: touchDist(t0, t1),
        midX: (t0.clientX + t1.clientX) / 2,
        midY: (t0.clientY + t1.clientY) / 2,
      };
      pinchRaf ??= requestAnimationFrame(flushPinch);
    };

    const onTouchEnd = () => {
      // Land on the last finger positions, even when they arrived inside the frame now ending.
      if (pinchRaf !== null) {
        cancelAnimationFrame(pinchRaf);
        flushPinch();
      }
      pinch = null;
      isPinchingRef.current = false;
      endPinchGesture?.();
      endPinchGesture = null;
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
        depsRef.current.viewport.setOffset(pendingPan);
        pendingPan = null;
      }
    };

    const onWheel = (e: WheelEvent) => {
      const canvasEl = depsRef.current.canvasMainRef.current;
      if (!canvasEl || !canvasEl.contains(e.target as Node)) return;
      // Floating panels (palette, etc.) render over the canvas but own
      // their own scroll — don't hijack their wheel to pan/zoom the canvas
      // (the canvas pointer handlers guard the same way).
      if ((e.target as Element | null)?.closest?.('[data-floating-panel]')) return;
      // An element that scrolls sideways itself (the Gantt chart's timeline, data-own-wheel-x) keeps a
      // sideways or Shift wheel; a plain vertical wheel over it still pans the canvas.
      if (
        !e.ctrlKey &&
        !e.metaKey &&
        (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) &&
        (e.target as Element | null)?.closest?.('[data-own-wheel-x]')
      )
        return;
      // Ctrl covers trackpad pinch (synthesised ctrlKey) and the Windows /
      // Linux zoom modifier; Cmd (metaKey) is the Mac mouse-wheel modifier. Checked before the scrollable
      // bail below: a Ctrl or Cmd wheel never scrolls an element, so it zooms the canvas wherever the cursor is.
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        noteWheel('zoom');
        const { zoom: viewportZoom, offset: viewportOffset } = depsRef.current.viewport.get();
        // deltaY > 0 = pinch-close / scroll-down = zoom out; < 0 = zoom in.
        const factor = Math.exp(-e.deltaY / 200);
        const newZoom = clamp(viewportZoom * factor, ZOOM_MIN, ZOOM_MAX);
        zoomAtFocal(newZoom, e.clientX, e.clientY, viewportZoom, viewportOffset);
        return;
      }
      // Belt-and-braces: also bail if the cursor is over ANY element that
      // can scroll on its own (a panel's icon list, a dropdown, a menu),
      // so the wheel scrolls THAT rather than panning the canvas behind it.
      if (scrollsItself(e.target as Element | null, canvasEl)) return;
      // No modifier: a two-finger trackpad drag (or wheel scroll) pans.
      // Translate the viewport opposite the scroll delta so content
      // follows the fingers. Offset is canvas-coords, delta is screen px,
      // so divide by zoom (a 100px drag pans 100/zoom canvas px), matching
      // the pointer-pan maths.
      e.preventDefault();
      noteWheel('pan');
      const { zoom: viewportZoom, offset: current } = depsRef.current.viewport.get();
      const base = pendingPan ?? current;
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
      if (pinchRaf !== null) cancelAnimationFrame(pinchRaf);
      endWheelGesture();
      endPinchGesture?.();
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
      document.removeEventListener('touchcancel', onTouchEnd);
      document.removeEventListener('wheel', onWheel, { capture: true });
    };
  }, [depsRef]); // stable — all mutable state read through depsRef at call time

  return { isPinchingRef };
}

/**
 * The offset that puts the canvas point between a pinch's fingers at its start (`midX`, `midY` at
 * `startZoom` and `startOffset`) between them now (`toX`, `toY`) at `zoom`. The transform is
 * `scale(z) translate(t)` about the wrapper's centre (wCX, wCY), so a screen point s shows canvas
 * point (s - wC) / z - t; holding that point fixed across the change gives
 * t2 = (to - wC) / z2 - (mid - wC) / z1 + t1.
 */
function pinchOffset(
  pinch: {
    startZoom: number;
    startOffset: { x: number; y: number };
    midX: number;
    midY: number;
    wCX: number;
    wCY: number;
  },
  zoom: number,
  toX: number,
  toY: number,
): { x: number; y: number } {
  return {
    x: (toX - pinch.wCX) / zoom - (pinch.midX - pinch.wCX) / pinch.startZoom + pinch.startOffset.x,
    y: (toY - pinch.wCY) / zoom - (pinch.midY - pinch.wCY) / pinch.startZoom + pinch.startOffset.y,
  };
}

// Whether `target`, or an element between it and the canvas, scrolls on its own: the wheel is its.
function scrollsItself(target: Element | null, canvasEl: Element): boolean {
  for (let node = target; node && node !== canvasEl; node = node.parentElement) {
    if (node.scrollHeight > node.clientHeight) {
      const oy = getComputedStyle(node).overflowY;
      if (oy === 'auto' || oy === 'scroll') return true;
    }
  }
  return false;
}
