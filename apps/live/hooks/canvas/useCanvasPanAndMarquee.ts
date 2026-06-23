'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import { buildElementIndex, endpointPosition, isBoxed, type Element } from '@livediagram/diagram';
import { pointerToCanvas } from '@/lib/canvas';

// Pan + marquee gesture machinery lifted out of Canvas.tsx so the
// component file stays focused on JSX + per-element wiring. The
// three concerns this hook owns:
//
//   - Pan state. The pointerdown handler in Canvas writes `pan`
//     with the gesture start coords; this hook's effect attaches
//     window-level move + up listeners that translate the cursor
//     delta into a viewport-offset update + signal "moved" via the
//     supplied ref so the Canvas pointerdown can distinguish
//     click-to-deselect from real pan.
//
//   - Marquee state. Stored in client (screen) coords; the
//     pointerup effect runs the rect-vs-element intersection in
//     canvas-coords and reports the hit set up via
//     `onSelectMarquee`. Sub-4-pixel marquees collapse to a plain
//     deselect (matches the user's expectation that a tiny stray
//     drag isn't a selection gesture).
//
//   - Space-held modifier. Document-level keydown / keyup listener
//     flips a ref that the Canvas's pointerdown handler reads to
//     decide pan vs marquee when the canvas tool is otherwise
//     "select" (mirrors Figma / Excalidraw's hold-space-to-pan).

type PanState = {
  startClientX: number;
  startClientY: number;
  startOffsetX: number;
  startOffsetY: number;
  movedRef: { current: boolean };
};

type MarqueeState = {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
};

type Deps = {
  viewportZoom: number;
  setViewportOffset: (offset: { x: number; y: number }) => void;
  elements: Element[];
  // Canvas wrapper ref (the panned + zoomed transform target). Used
  // at marquee-up time to compute the intersection rect in
  // canvas-coords via getBoundingClientRect.
  wrapperRef: RefObject<HTMLDivElement | null>;
  // Called when a pan ended without movement (a plain click) and
  // when a marquee was too small to count as a selection. Drives
  // the canvas-empty deselect path.
  onDeselect: () => void;
  onSelectMarquee: (hits: Set<string>) => void;
  // Suppresses pointer-driven pan updates while a 2-finger pinch is
  // active so the pan and pinch hooks don't fight over viewportOffset.
  isPinchingRef?: RefObject<boolean>;
};

type Api = {
  pan: PanState | null;
  setPan: (next: PanState | null) => void;
  marquee: MarqueeState | null;
  setMarquee: React.Dispatch<React.SetStateAction<MarqueeState | null>>;
  // `spaceHeldRef.current === true` while the user holds Space and
  // the document focus isn't in an input. Canvas's pointerdown
  // reads this to decide pan vs marquee.
  spaceHeldRef: RefObject<boolean>;
};

export function useCanvasPanAndMarquee(deps: Deps): Api {
  const [pan, setPan] = useState<PanState | null>(null);
  const [marquee, setMarquee] = useState<MarqueeState | null>(null);

  // The caller passes a fresh `deps` object literal every render. Keep it
  // in a ref (refreshed each render) so the pan / marquee effects can
  // depend ONLY on the gesture state (`pan` / `marquee`) and still read
  // the latest deps. Depending on `deps` directly re-ran the effects on
  // every render; paired with the move handler's setViewportOffset that
  // tripped React's "Maximum update depth exceeded" loop (re-subscribe →
  // setState → re-render → re-subscribe).
  const depsRef = useRef(deps);
  depsRef.current = deps;

  // Held-Space modifier turns canvas drag into a pan instead of a
  // marquee. Tracked via a ref so the pointerdown handler always
  // sees the current value without re-binding when state changes.
  const spaceHeldRef = useRef(false);
  useEffect(() => {
    const isTypingTarget = (t: EventTarget | null) =>
      t instanceof HTMLInputElement ||
      t instanceof HTMLTextAreaElement ||
      (t instanceof HTMLElement && t.isContentEditable);
    const down = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      if (isTypingTarget(e.target)) return;
      // Stop the page from scroll-jumping while space is held over
      // the canvas. Doesn't affect inputs because we return above
      // for those.
      e.preventDefault();
      spaceHeldRef.current = true;
    };
    const up = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      spaceHeldRef.current = false;
    };
    document.addEventListener('keydown', down);
    document.addEventListener('keyup', up);
    return () => {
      document.removeEventListener('keydown', down);
      document.removeEventListener('keyup', up);
    };
  }, []);

  useEffect(() => {
    if (!pan) return;
    // Coalesce offset commits to one per animation frame. pointermove
    // fires faster than React can paint, and committing viewportOffset
    // synchronously on every event drove a re-render storm that, with
    // the canvas's layout-effect-positioned overlays re-measuring each
    // time, tripped React's "Maximum update depth exceeded". Writing
    // the latest target to a ref and flushing it from a single rAF
    // commits at most once per frame, OUTSIDE the pointermove handler's
    // synchronous flush, which breaks the cascade and smooths panning.
    let rafId: number | null = null;
    let pending: { x: number; y: number } | null = null;
    const flush = () => {
      rafId = null;
      if (pending) depsRef.current.setViewportOffset(pending);
    };
    const onMove = (e: PointerEvent) => {
      const d = depsRef.current;
      // Pinch zoom is active — let the pinch hook own viewportOffset.
      if (d.isPinchingRef?.current) return;
      // Pan offset is stored in canvas-coords; mouse delta is
      // screen-coords. Divide by zoom so a 100px screen drag
      // produces 100/zoom canvas-pixels of pan.
      const dx = (e.clientX - pan.startClientX) / d.viewportZoom;
      const dy = (e.clientY - pan.startClientY) / d.viewportZoom;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) pan.movedRef.current = true;
      pending = { x: pan.startOffsetX + dx, y: pan.startOffsetY + dy };
      if (rafId === null) rafId = requestAnimationFrame(flush);
    };
    const onUp = () => {
      // Land on the final pointer position even if it arrived in the
      // same frame as a pending rAF (which the cleanup cancels).
      if (pending) depsRef.current.setViewportOffset(pending);
      if (!pan.movedRef.current) depsRef.current.onDeselect();
      setPan(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [pan]);

  // Marquee drag: track the current pointer position and, on
  // release, convert the screen-coord rect to canvas coords and
  // test each element's bounding box for intersection. Sub-4-pixel
  // marquees are treated as plain clicks (just deselect).
  useEffect(() => {
    if (!marquee) return;
    const onMove = (e: PointerEvent) => {
      setMarquee((m) => (m ? { ...m, currentX: e.clientX, currentY: e.clientY } : null));
    };
    const onUp = () => {
      const m = marquee;
      if (!m) return;
      const d = depsRef.current;
      const dragWidth = Math.abs(m.currentX - m.startX);
      const dragHeight = Math.abs(m.currentY - m.startY);
      if (dragWidth < 4 && dragHeight < 4) {
        d.onDeselect();
        setMarquee(null);
        return;
      }
      const wrapper = d.wrapperRef.current;
      if (wrapper) {
        const rect = wrapper.getBoundingClientRect();
        // Wrapper has `transform: scale(z) translate(ox, oy)` with
        // origin: center. getBoundingClientRect returns the
        // post-transform box, which ALREADY accounts for the
        // translate. Working through the matrix:
        //   screen.x = rect.left + z * cx
        // so the inverse is (screen.x - rect.left) / z (no extra
        // `- ox`). The old version subtracted the offset on top of
        // the rect that already had it baked in, throwing
        // intersection bounds off by the pan amount and making the
        // marquee silently miss every element on a panned canvas.
        // Marquee start + current are two screen points; convert both with the
        // shared transform (same one Canvas.tsx's pointer handlers use), then
        // take their bounding box.
        const start = pointerToCanvas(m.startX, m.startY, rect, d.viewportZoom);
        const current = pointerToCanvas(m.currentX, m.currentY, rect, d.viewportZoom);
        const minX = Math.min(start.x, current.x);
        const maxX = Math.max(start.x, current.x);
        const minY = Math.min(start.y, current.y);
        const maxY = Math.max(start.y, current.y);
        const hits = new Set<string>();
        // Index once up front: resolving each arrow's endpoints inside
        // the element loop would otherwise be O(elements^2) per sweep.
        const byId = buildElementIndex(d.elements);
        for (const el of d.elements) {
          if (el.type === 'arrow') {
            // Arrow AABB: bounds of the (from, to) segment. The whole
            // bbox must sit INSIDE the marquee (containment), matching
            // the boxed-element rule below so a partial sweep doesn't
            // grab an arrow it only clipped.
            const from = endpointPosition(el.from, byId);
            const to = endpointPosition(el.to, byId);
            const aMinX = Math.min(from.x, to.x);
            const aMaxX = Math.max(from.x, to.x);
            const aMinY = Math.min(from.y, to.y);
            const aMaxY = Math.max(from.y, to.y);
            if (aMinX >= minX && aMaxX <= maxX && aMinY >= minY && aMaxY <= maxY) {
              hits.add(el.id);
            }
            continue;
          }
          if (!isBoxed(el)) continue;
          // Containment, not intersection: the element must be FULLY
          // enclosed by the marquee to be selected (the user has to
          // sweep right over it, not just clip an edge).
          if (el.x >= minX && el.x + el.width <= maxX && el.y >= minY && el.y + el.height <= maxY) {
            hits.add(el.id);
          }
        }
        d.onSelectMarquee(hits);
      }
      setMarquee(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [marquee]);

  return { pan, setPan, marquee, setMarquee, spaceHeldRef };
}
