'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import { endpointPosition, isBoxed, type Element } from '@livediagram/diagram';

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

export type PanState = {
  startClientX: number;
  startClientY: number;
  startOffsetX: number;
  startOffsetY: number;
  movedRef: { current: boolean };
};

export type MarqueeState = {
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
    const onMove = (e: PointerEvent) => {
      // Pinch zoom is active — let the pinch hook own viewportOffset.
      if (deps.isPinchingRef?.current) return;
      // Pan offset is stored in canvas-coords; mouse delta is
      // screen-coords. Divide by zoom so a 100px screen drag
      // produces 100/zoom canvas-pixels of pan.
      const dx = (e.clientX - pan.startClientX) / deps.viewportZoom;
      const dy = (e.clientY - pan.startClientY) / deps.viewportZoom;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) pan.movedRef.current = true;
      deps.setViewportOffset({ x: pan.startOffsetX + dx, y: pan.startOffsetY + dy });
    };
    const onUp = () => {
      if (!pan.movedRef.current) deps.onDeselect();
      setPan(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [pan, deps]);

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
      const dragWidth = Math.abs(m.currentX - m.startX);
      const dragHeight = Math.abs(m.currentY - m.startY);
      if (dragWidth < 4 && dragHeight < 4) {
        deps.onDeselect();
        setMarquee(null);
        return;
      }
      const wrapper = deps.wrapperRef.current;
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
        const toCanvasX = (sx: number) => (sx - rect.left) / deps.viewportZoom;
        const toCanvasY = (sy: number) => (sy - rect.top) / deps.viewportZoom;
        const minX = Math.min(toCanvasX(m.startX), toCanvasX(m.currentX));
        const maxX = Math.max(toCanvasX(m.startX), toCanvasX(m.currentX));
        const minY = Math.min(toCanvasY(m.startY), toCanvasY(m.currentY));
        const maxY = Math.max(toCanvasY(m.startY), toCanvasY(m.currentY));
        const hits = new Set<string>();
        for (const el of deps.elements) {
          if (el.type === 'arrow') {
            // Arrow AABB: bounds of the (from, to) segment. Good
            // enough for marquee inclusion: connecting two
            // selected shapes always intersects the marquee they
            // sit inside, and lone arrows are caught when their
            // bbox overlaps.
            const from = endpointPosition(el.from, deps.elements);
            const to = endpointPosition(el.to, deps.elements);
            const aMinX = Math.min(from.x, to.x);
            const aMaxX = Math.max(from.x, to.x);
            const aMinY = Math.min(from.y, to.y);
            const aMaxY = Math.max(from.y, to.y);
            if (aMinX < maxX && aMaxX > minX && aMinY < maxY && aMaxY > minY) {
              hits.add(el.id);
            }
            continue;
          }
          if (!isBoxed(el)) continue;
          // Standard rect-rect intersection test (open intervals).
          if (el.x < maxX && el.x + el.width > minX && el.y < maxY && el.y + el.height > minY) {
            hits.add(el.id);
          }
        }
        deps.onSelectMarquee(hits);
      }
      setMarquee(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [marquee, deps]);

  return { pan, setPan, marquee, setMarquee, spaceHeldRef };
}
