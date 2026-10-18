// Pure viewport math used by useEditorViewport. Lives in lib/ so the
// fit-to-screen calculation can be reasoned about (and tested)
// without booting React or simulating a DOM. The hook handles only
// the state plumbing and `getBoundingClientRect` measurement; the
// formulas land here.

import type { Rect } from '@livediagram/document';

// Padding (in canvas-space pixels) kept between the elements'
// bounding box and the viewport edges when fit-to-screen runs. 60
// matches the previous hard-coded value.
export const FIT_TO_SCREEN_PADDING = 60;

// Zoom clamps. The 5x ceiling stops a sparse canvas from blowing up;
// the 0.1 floor stops massive scaffolds from shrinking below the "I
// can see it" threshold. Cap at 1.0 too so fit-to-screen never
// magnifies past 100% (the user can zoom further manually).
export const FIT_TO_SCREEN_MIN = 0.1;
export const FIT_TO_SCREEN_MAX = 5;
export const FIT_TO_SCREEN_MAX_AT_FIT = 1;

// The viewport's measured size.
type ViewportSize = { width: number; height: number };
export type Offset = { x: number; y: number };

// Given the viewport's bounding rect and the elements' bounding box
// (canvas-coords), compute the zoom + offset that fits the bbox
// inside the viewport with `FIT_TO_SCREEN_PADDING` on every side.
// The offset centres the bbox in the viewport: with the canvas
// transform `translate(offset) scale(zoom)` applied (scale centred
// on the wrapper), centring on the viewport centre is `viewport-
// centre minus bbox-centre`.
// `maxZoom` exists for presenting (docs/specs/012-collaboration/presentation-mode.md). The editor's own fit caps at
// 100% (FIT_TO_SCREEN_MAX_AT_FIT), which is right for "fit this canvas": a
// four-box diagram blown up to 300% looks broken in a workspace. A SLIDE is
// the opposite case — it is the only thing on a projector, and a slide holding
// one box should fill the screen rather than sit tiny in the middle of it.
// `padding` is 0 for a page slide presenting: the page is the slide, edge to edge.
export function computeFitToScreen(
  rect: ViewportSize,
  bbox: Rect,
  maxZoom: number = FIT_TO_SCREEN_MAX_AT_FIT,
  padding: number = FIT_TO_SCREEN_PADDING,
): { zoom: number; offset: Offset } {
  const zoom = Math.max(
    FIT_TO_SCREEN_MIN,
    Math.min(
      FIT_TO_SCREEN_MAX,
      (rect.width - 2 * padding) / Math.max(1, bbox.width),
      (rect.height - 2 * padding) / Math.max(1, bbox.height),
      maxZoom,
    ),
  );
  const offset = {
    x: rect.width / 2 - (bbox.x + bbox.width / 2),
    y: rect.height / 2 - (bbox.y + bbox.height / 2),
  };
  return { zoom, offset };
}

// Fit to the part of the canvas below `insetTop` screen px (a toolbar laid over the canvas's top
// edge): the zoom fits the box into the remaining height, and the box centres in that band rather
// than in the whole canvas. With the centred `scale(z) translate(offset)` transform a canvas y `c`
// lands at screen `h/2 + z(c + offset.y - h/2)`, so centring on the band adds `insetTop / 2z`.
export function computeFitBelow(
  rect: ViewportSize,
  bbox: Rect,
  insetTop: number,
  maxZoom: number = FIT_TO_SCREEN_MAX_AT_FIT,
): { zoom: number; offset: Offset } {
  const inset = Math.max(0, Math.min(insetTop, rect.height / 2));
  // Fields read one by one, never spread: a DOMRect's are prototype getters a spread drops.
  const { zoom } = computeFitToScreen(
    { width: rect.width, height: rect.height - inset },
    bbox,
    maxZoom,
  );
  return {
    zoom,
    offset: {
      x: rect.width / 2 - (bbox.x + bbox.width / 2),
      y: rect.height / 2 - (bbox.y + bbox.height / 2) + inset / (2 * zoom),
    },
  };
}

// A frame computed for the canvas less `insets.left` and `insets.right` screen px at its sides (the
// Contents panel laid over it: docs/specs/007-editor/pages-mode.md "Contents"), moved so it lands
// in the band between them rather than in the whole canvas. Compute the frame on `{ width: w - left -
// right, height }`; with the centred transform a canvas x lands at `w/2 + z(x + offset.x - w/2)`, so
// the band's middle (`(left - right)/2` right of the canvas's) adds `(left + right)/2` for the
// narrower width's centre and `(left - right) / 2z`.
export function besideSideInsets(
  frame: { zoom: number; offset: Offset },
  insets: { left: number; right: number },
): { zoom: number; offset: Offset } {
  const { left, right } = insets;
  if (left <= 0 && right <= 0) return frame;
  return {
    zoom: frame.zoom,
    offset: {
      x: frame.offset.x + (left + right) / 2 + (left - right) / (2 * frame.zoom),
      y: frame.offset.y,
    },
  };
}

// How much of the canvas's top a floating toolbar covers (the Palette strip laid over it), in screen px, plus a
// small gap: what a fit leaves clear so nothing lands under the strip. 0 when there is no strip or it sits outside
// the canvas.
export const FIT_TOOLBAR_GAP = 8;
export function topChromeInset(
  canvas: { top: number; bottom: number },
  strip: { top: number; bottom: number } | null,
): number {
  if (!strip || strip.bottom <= canvas.top || strip.top >= canvas.bottom) return 0;
  // A whole, even number of px: the fit centres the content in the band below, shifting it by half the inset, so
  // an odd or fractional inset would land every element on a half pixel and blur its edges.
  return Math.ceil((Math.max(0, strip.bottom - canvas.top) + FIT_TOOLBAR_GAP) / 2) * 2;
}

// Canvas-coord position of the viewport centre. With transform
// `scale(z) translate(offset)` centred on the wrapper, the canvas-
// coord at viewport centre is just (canvasCentre - offset), because
// scale is centred on the same point so zoom doesn't enter the
// equation. Used as the drop point for "add a shape from the
// palette".
export function computeViewportCenter(
  rect: ViewportSize,
  offset: Offset,
): { x: number; y: number } {
  return {
    x: rect.width / 2 - offset.x,
    y: rect.height / 2 - offset.y,
  };
}

// The canvas-coord rectangle the viewport shows at the current pan / zoom: the
// viewport centre, spread by the screen size divided by the zoom. A paste whose
// usual spot is outside it lands in the middle of it instead.
export function computeViewportCanvasRect(rect: ViewportSize, offset: Offset, zoom: number): Rect {
  const centre = computeViewportCenter(rect, offset);
  const width = rect.width / zoom;
  const height = rect.height / zoom;
  return { x: centre.x - width / 2, y: centre.y - height / 2, width, height };
}

// True when the elements' bounding box is entirely outside the viewport at
// the current pan / zoom — i.e. nothing on the tab is in view. Projects the
// canvas-coord bbox to screen pixels through the same centred-scale transform
// as computeViewportCenter (canvas point `cx` lands at `rect.w/2 + zoom *
// (cx - viewportCentreCanvasX)`), then reports a gap on any side. Callers
// must first confirm there is at least one element to bound: an empty tab is
// not "off-screen". Used to nudge the user toward Fit to screen.
export function isContentOffScreen(
  rect: ViewportSize,
  bbox: Rect,
  offset: Offset,
  zoom: number,
): boolean {
  const centre = computeViewportCenter(rect, offset);
  const left = rect.width / 2 + zoom * (bbox.x - centre.x);
  const right = rect.width / 2 + zoom * (bbox.x + bbox.width - centre.x);
  const top = rect.height / 2 + zoom * (bbox.y - centre.y);
  const bottom = rect.height / 2 + zoom * (bbox.y + bbox.height - centre.y);
  return right <= 0 || left >= rect.width || bottom <= 0 || top >= rect.height;
}

// Screen px left clear above an article page for its page toolbar and title bar, and either side.
export const READING_TOP_ROOM = 104;
const READING_SIDE_ROOM = 32;

/**
 * The view that reads an article page (docs/specs/007-editor/article-pages.md "Getting around"):
 * its width filling the canvas (never past 100%), room above it for the page toolbar; a page that
 * fits sits in the middle of the room below, a taller one shows its top.
 */
export function computeReadingFrame(
  rect: ViewportSize,
  page: Rect,
  insetTop: number,
  // The page's side margin: given, the text column (the page less its margins) fills the width,
  // the margins off screen, so the text reads larger on a narrow screen.
  margin = 0,
): { zoom: number; offset: Offset } {
  const top = Math.min(rect.height / 2, insetTop + READING_TOP_ROOM);
  const zoom = Math.max(
    0.1,
    Math.min(1, (rect.width - 2 * READING_SIDE_ROOM) / Math.max(1, page.width - 2 * margin)),
  );
  const room = rect.height - top - 16;
  const screenTop = page.height * zoom <= room ? top + (room - page.height * zoom) / 2 : top;
  return {
    zoom,
    offset: {
      x: rect.width / 2 - (page.x + page.width / 2),
      y: (screenTop - rect.height / 2) / zoom + rect.height / 2 - page.y,
    },
  };
}
