// A fit clear of the Map (docs/specs/008-canvas/minimap.md "Fit leaves the Map clear"): the Map sits over a corner of
// the canvas, so a fit that fills the canvas can put the content's corner under it, where nothing shows. When the plain
// fit would, the content fits instead either beside the Map or above (or below) it, whichever keeps it larger.
// Pure: tabFitView measures the panel and hands it in.

import type { Offset } from './viewport';

/** A box in screen px, relative to the canvas's top-left corner. */
export type ScreenBox = { left: number; top: number; right: number; bottom: number };

/** Screen px a fit leaves out at each edge of the canvas (a panel laid over it). */
export type FitInsets = { left: number; right: number; top: number; bottom: number };

type Frame = { zoom: number; offset: Offset };
type Size = { width: number; height: number };
type Rect = { x: number; y: number; width: number; height: number };

// What the Map panel carries (components/canvas/Minimap.tsx), as the Contents sidebar carries its own.
export const MAP_PANEL_SELECTOR = '[data-tour-id="minimap"]';

// The room kept between the content and the Map, in screen px.
export const MAP_CLEARANCE_PX = 16;

/** Where `bbox` (canvas coords) lands on screen under `frame`: with the centred `scale(z) translate(offset)`
 *  transform a canvas x lands at `w/2 + z(x + offset.x - w/2)`. */
export function boxOnScreen(frame: Frame, size: Size, bbox: Rect): ScreenBox {
  const sx = (x: number) => size.width / 2 + frame.zoom * (x + frame.offset.x - size.width / 2);
  const sy = (y: number) => size.height / 2 + frame.zoom * (y + frame.offset.y - size.height / 2);
  return {
    left: sx(bbox.x),
    right: sx(bbox.x + bbox.width),
    top: sy(bbox.y),
    bottom: sy(bbox.y + bbox.height),
  };
}

function overlaps(a: ScreenBox, b: ScreenBox): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

// A whole, even number of px, as topChromeInset's: the fit centres in the band, shifting by half the inset.
const even = (px: number) => Math.max(0, Math.ceil(px / 2) * 2);

/** The fit `fitIn` gives with `base` left out, moved clear of `panel` when the content would land under it.
 *  `padding` is the room `fitIn` already keeps at every edge, so the panel needs only what reaches past it. */
export function fitClearOfPanel(
  size: Size,
  bbox: Rect,
  panel: ScreenBox | null,
  base: FitInsets,
  padding: number,
  fitIn: (insets: FitInsets) => Frame,
): Frame {
  const plain = fitIn(base);
  if (!panel) return plain;
  const keepOut = {
    left: panel.left - MAP_CLEARANCE_PX,
    right: panel.right + MAP_CLEARANCE_PX,
    top: panel.top - MAP_CLEARANCE_PX,
    bottom: panel.bottom + MAP_CLEARANCE_PX,
  };
  if (!overlaps(boxOnScreen(plain, size, bbox), keepOut)) return plain;
  const onLeft = (panel.left + panel.right) / 2 < size.width / 2;
  const onTop = (panel.top + panel.bottom) / 2 < size.height / 2;
  const beside = onLeft
    ? { ...base, left: Math.max(base.left, even(keepOut.right - padding)) }
    : { ...base, right: Math.max(base.right, even(size.width - keepOut.left - padding)) };
  const across = onTop
    ? { ...base, top: Math.max(base.top, even(keepOut.bottom - padding)) }
    : { ...base, bottom: Math.max(base.bottom, even(size.height - keepOut.top - padding)) };
  const a = fitIn(beside);
  const b = fitIn(across);
  return b.zoom > a.zoom ? b : a;
}

// The Map showing up after a fit (it shows from four elements on, and not while the start is open, so a template's
// fit runs before it): the editor fits again while the view is still the fit it made, so the content moves clear.
type MapShownListener = () => void;
const mapShownListeners = new Set<MapShownListener>();

export function notifyMapShown(): void {
  for (const l of mapShownListeners) l();
}

export function onMapShown(listener: MapShownListener): () => void {
  mapShownListeners.add(listener);
  return () => {
    mapShownListeners.delete(listener);
  };
}

/** Watches the Map's drawing and says the Map has shown once it has a box (again, after it was collapsed to none). */
export function watchMapBox(el: Element): () => void {
  if (typeof ResizeObserver === 'undefined') return () => {};
  let sized = false;
  const observer = new ResizeObserver(() => {
    const now = el.getBoundingClientRect().width > 0;
    if (now && !sized) notifyMapShown();
    sized = now;
  });
  observer.observe(el);
  return () => observer.disconnect();
}
