'use client';

import {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from 'react';
import { VIEWPORT_EDGE_MARGIN as EDGE } from '../../lib/clamp-to-viewport';
import type { Rect } from '@liveworkspace/model-core/geometry-primitives';
import { TOOLBAR_OBSTACLE_EVENT } from './toolbar-obstacle';

type XY = { x: number; y: number };

// The floating chrome over the canvas a selection's toolbar keeps off: the palette, the panels, the top-centre toolbar
// (`data-floating-panel`), and a panel that is no floating panel but must not be covered either (`data-toolbar-obstacle`:
// livediagram's Quick Style panel, which sits at the canvas's left edge beside whatever is selected there).
const CHROME = '[data-floating-panel], [data-toolbar-obstacle]';

type Box = { left: number; right: number; top: number; bottom: number };

const overlaps = (r: Box, b: Box) =>
  r.left < b.right && r.right > b.left && r.top < b.bottom && r.bottom > b.top;

// The chrome's boxes on screen, other than one the box sits in.
function chromeBoxes(self: Element): Box[] {
  const boxes: Box[] = [];
  for (const el of document.querySelectorAll(CHROME)) {
    if (el.contains(self)) continue;
    // Drawn but hidden (the Quick Style panel waits at the corner, hidden, until its spot is measured): no obstacle.
    if (el.checkVisibility?.({ visibilityProperty: true }) === false) continue;
    const b = el.getBoundingClientRect();
    if (b.width === 0 || b.height === 0) continue;
    boxes.push(b);
  }
  return boxes;
}

// Whether a box overlaps any floating chrome over the canvas, other than one it sits in.
export function overlapsChrome(r: DOMRect, self: Element): boolean {
  return chromeBoxes(self).some((b) => overlaps(r, b));
}

/** How far to slide `r` sideways, in screen px, so it covers none of `chrome` and stays `EDGE` inside `area`: the
 *  shorter way past an obstacle it sits on, or 0 when it sits on none, or no slide clears them all. Used once the
 *  above/below flip has had its turn and the box still covers chrome (an element under a panel at the canvas's left
 *  edge, the panel taller than the room above and below it). */
export function sidewaysClear(
  r: Box,
  chrome: readonly Box[],
  area: { left: number; right: number },
): number {
  const hit = chrome.filter((b) => overlaps(r, b));
  if (hit.length === 0) return 0;
  const moves = hit
    .flatMap((b) => [b.right + EDGE - r.left, b.left - EDGE - r.right])
    .sort((a, b) => Math.abs(a) - Math.abs(b));
  for (const dx of moves) {
    const moved = { ...r, left: r.left + dx, right: r.right + dx };
    if (moved.left < area.left + EDGE || moved.right > area.right - EDGE) continue;
    if (chrome.some((b) => overlaps(moved, b))) continue;
    return dx;
  }
  return 0;
}

// Every editor's FloatingToolbar and SelectionPopover place with this one hook (it was five copies).
// Positions a floating box that hovers above (or below, when there's no room)
// a canvas-space `bounds`, nudging it back inside the viewport when it would
// overflow an edge. Shared by FloatingToolbar + SelectionPopover so the subtle
// flip guard lives in one place.
//
// `placeAbove` flips above<->below at most ONCE per geometry (the flip guard):
// a box that fits neither side could otherwise ping-pong above<->below forever,
// an infinite synchronous re-render that trips React's "Maximum update depth".
// `adjust` is the one-shot edge nudge and is deliberately NOT an effect
// trigger, so the effect never re-enters on its own setAdjust. The effect
// re-runs on the bounds / offset / zoom / placeAbove changes that move the box
// on screen (a pinch or zoom shortcut with the selection kept moves it with no
// bounds or offset change, Work Tracker 898), and `zoom` is folded into the
// geometry signature so a zoom change earns a fresh flip decision. The
// placement itself is an effect event reading the newest nudge.
//
// The box ref must be attached to the floating element so its measured rect can
// be checked against the viewport. `style` is the ready-to-spread placement:
// the box is horizontally centred over the selection and sits `gap` (in canvas
// units — the caller divides by zoom) above or below it, counter-scaled by
// 1/zoom so it stays a constant on-screen size. Callers still read `placeAbove`
// for any above/below-dependent chrome (e.g. a title badge's side).
//
// `avoid` (canvas-space, optional) is a box the floating box should keep off: livehuddle passes the piece a fresh
// duplicate was copied from (its docs/specs/008-canvas/canvas-and-palette.md "Selection popover", Work Tracker 849). When
// the box on its side would sit on it and the other side would not, and the other side fits the canvas area, it flips
// there, under the same once-per-geometry flip guard. Without it, nothing changes.
export function useEdgeAwarePlacement(
  bounds: Rect,
  canvasOffset: XY,
  zoom: number,
  gap: number,
  // While the selection moves the box is hidden and measures nothing: a gesture frame never reads
  // layout (docs/specs/008-canvas/canvas-performance.md). It places once on resuming.
  suspended = false,
  avoid: Rect | null = null,
): { ref: RefObject<HTMLDivElement | null>; placeAbove: boolean; style: CSSProperties } {
  const ref = useRef<HTMLDivElement>(null);
  const [adjust, setAdjust] = useState<XY>({ x: 0, y: 0 });
  const flipSigRef = useRef('');
  const flippedRef = useRef(false);
  const [placeAbove, setPlaceAbove] = useState(true);

  // Whether the box sits on `keepOff` where it is and would not on the selection's other side, which has room inside
  // the canvas area: worked out in canvas units from the box's measured size (it renders at 1/zoom inside the zoomed
  // wrapper), centred on the selection with the current sideways nudge.
  const coversOnlyThisSide = (
    keepOff: Rect,
    rect: DOMRect,
    area: { top: number; bottom: number },
  ): boolean => {
    const w = rect.width / zoom;
    const h = rect.height / zoom;
    const left = bounds.x + bounds.width / 2 + adjust.x - w / 2;
    const aboveTop = bounds.y - gap - h;
    const belowTop = bounds.y + bounds.height + gap;
    const sitsOn = (top: number) =>
      left < keepOff.x + keepOff.width &&
      left + w > keepOff.x &&
      top < keepOff.y + keepOff.height &&
      top + h > keepOff.y;
    const here = placeAbove ? aboveTop : belowTop;
    const there = placeAbove ? belowTop : aboveTop;
    if (!sitsOn(here) || sitsOn(there)) return false;
    // The other side on screen: the measured box moved by the distance between the two sides.
    const top = rect.top - adjust.y * zoom + (there - here) * zoom;
    return top >= area.top + EDGE && top + rect.height <= area.bottom - EDGE;
  };

  const place = useEffectEvent(() => {
    const node = ref.current;
    if (!node) return;
    const sig = `${bounds.x},${bounds.y},${bounds.width},${bounds.height},${canvasOffset.x},${canvasOffset.y},${zoom}`;
    if (flipSigRef.current !== sig) {
      flipSigRef.current = sig;
      flippedRef.current = false;
    }
    const rect = node.getBoundingClientRect();
    // The flip / nudge boundaries are the CANVAS AREA's edges, not the raw
    // viewport: the header band sits above <main> and the tab bar below it,
    // so a viewport-relative test let the box pass while tucked under the
    // header (the reported stuck-under-the-header toolbar). Measured live,
    // so zen mode (no header) naturally widens the area back out.
    const host = node.closest('main');
    const area = host
      ? host.getBoundingClientRect()
      : { top: 0, bottom: window.innerHeight, left: 0, right: window.innerWidth };
    if (!flippedRef.current) {
      // The floating chrome over the canvas (the palette, the panels) counts as an edge too: a box that would
      // sit on it flips to the selection's other side, as it does at the header.
      if (placeAbove && (rect.top < area.top + EDGE || overlapsChrome(rect, node))) {
        flippedRef.current = true;
        setPlaceAbove(false);
        return;
      }
      if (!placeAbove && (rect.bottom > area.bottom - EDGE || overlapsChrome(rect, node))) {
        flippedRef.current = true;
        setPlaceAbove(true);
        return;
      }
      if (avoid && coversOnlyThisSide(avoid, rect, area)) {
        flippedRef.current = true;
        setPlaceAbove(!placeAbove);
        return;
      }
    }
    // The measured rect already carries the current nudge (it rendered
    // with `adjust` applied), so compute the fresh correction against
    // the UN-nudged position — measuring the nudged box and storing the
    // result as the absolute adjust made the toolbar alternate between
    // clamped and un-clamped while dragging along an edge. The style
    // applies `adjust` in canvas units inside the scale(zoom) wrapper,
    // so its on-screen effect is adjust·zoom (and the screen-space
    // correction below is divided back by zoom when stored).
    const left = rect.left - adjust.x * zoom;
    const right = rect.right - adjust.x * zoom;
    const top = rect.top - adjust.y * zoom;
    const bottom = rect.bottom - adjust.y * zoom;
    let dx = 0;
    let dy = 0;
    if (left < area.left + EDGE) dx = area.left + EDGE - left;
    else if (right > area.right - EDGE) dx = area.right - EDGE - right;
    if (top < area.top + EDGE) dy = area.top + EDGE - top;
    else if (bottom > area.bottom - EDGE) dy = area.bottom - EDGE - bottom;
    // Still on the chrome after the flip had its turn (both sides cover it): slide sideways off it, where that fits.
    // Worked from the un-nudged place every time, so a box kept clear stays clear as the view moves.
    dx += sidewaysClear(
      { left: left + dx, right: right + dx, top: top + dy, bottom: bottom + dy },
      chromeBoxes(node),
      area,
    );
    const nx = dx / zoom;
    const ny = dy / zoom;
    if (nx !== adjust.x || ny !== adjust.y) setAdjust({ x: nx, y: ny });
  });
  // An obstacle arriving, resizing, moving or going (toolbar-obstacle.ts) places the box again, with a fresh flip:
  // the Quick Style panel mounts after a fresh selection's toolbar has placed. Not while suspended for a drag.
  useEffect(() => {
    if (suspended) return;
    const onObstacle = () => {
      flipSigRef.current = '';
      place();
    };
    window.addEventListener(TOOLBAR_OBSTACLE_EVENT, onObstacle);
    return () => window.removeEventListener(TOOLBAR_OBSTACLE_EVENT, onObstacle);
  }, [suspended]);
  useLayoutEffect(() => {
    if (!suspended) place();
  }, [
    bounds.x,
    bounds.y,
    bounds.width,
    bounds.height,
    canvasOffset.x,
    canvasOffset.y,
    zoom,
    placeAbove,
    suspended,
  ]);

  const baseLeft = bounds.x + bounds.width / 2;
  const baseTop = placeAbove ? bounds.y - gap : bounds.y + bounds.height + gap;
  const style: CSSProperties = {
    left: baseLeft + adjust.x,
    top: baseTop + adjust.y,
    transform: `translate(-50%, ${placeAbove ? '-100%' : '0'}) scale(${1 / zoom})`,
    transformOrigin: placeAbove ? 'center bottom' : 'center top',
  };

  return { ref, placeAbove, style };
}
