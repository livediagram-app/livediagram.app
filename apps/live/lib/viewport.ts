// Pure viewport math used by useEditorViewport. Lives in lib/ so the
// fit-to-screen calculation can be reasoned about (and tested)
// without booting React or simulating a DOM. The hook handles only
// the state plumbing and `getBoundingClientRect` measurement; the
// formulas land here.

// Padding (in canvas-space pixels) kept between the elements'
// bounding box and the viewport edges when fit-to-screen runs. 60
// matches the previous hard-coded value.
export const FIT_TO_SCREEN_PADDING = 60;

// Zoom clamps. The 5x ceiling stops tiny diagrams from blowing up;
// the 0.1 floor stops massive scaffolds from shrinking below the "I
// can see it" threshold. Cap at 1.0 too so fit-to-screen never
// magnifies past 100% (the user can zoom further manually).
export const FIT_TO_SCREEN_MIN = 0.1;
export const FIT_TO_SCREEN_MAX = 5;
export const FIT_TO_SCREEN_MAX_AT_FIT = 1;

export type Rect = { width: number; height: number };
export type BBox = { x: number; y: number; width: number; height: number };
export type Offset = { x: number; y: number };

// Given the viewport's bounding rect and the elements' bounding box
// (canvas-coords), compute the zoom + offset that fits the bbox
// inside the viewport with `FIT_TO_SCREEN_PADDING` on every side.
// The offset centres the bbox in the viewport: with the canvas
// transform `translate(offset) scale(zoom)` applied (scale centred
// on the wrapper), centring on the viewport centre is `viewport-
// centre minus bbox-centre`.
// `maxZoom` exists for presenting (spec/31). The editor's own fit caps at
// 100% (FIT_TO_SCREEN_MAX_AT_FIT), which is right for "fit this diagram": a
// four-box diagram blown up to 300% looks broken in a workspace. A SLIDE is
// the opposite case — it is the only thing on a projector, and a slide holding
// one box should fill the screen rather than sit tiny in the middle of it.
export function computeFitToScreen(
  rect: Rect,
  bbox: BBox,
  maxZoom: number = FIT_TO_SCREEN_MAX_AT_FIT,
): { zoom: number; offset: Offset } {
  const zoom = Math.max(
    FIT_TO_SCREEN_MIN,
    Math.min(
      FIT_TO_SCREEN_MAX,
      (rect.width - 2 * FIT_TO_SCREEN_PADDING) / Math.max(1, bbox.width),
      (rect.height - 2 * FIT_TO_SCREEN_PADDING) / Math.max(1, bbox.height),
      maxZoom,
    ),
  );
  const offset = {
    x: rect.width / 2 - (bbox.x + bbox.width / 2),
    y: rect.height / 2 - (bbox.y + bbox.height / 2),
  };
  return { zoom, offset };
}

// Canvas-coord position of the viewport centre. With transform
// `scale(z) translate(offset)` centred on the wrapper, the canvas-
// coord at viewport centre is just (canvasCentre - offset), because
// scale is centred on the same point so zoom doesn't enter the
// equation. Used as the drop point for "add a shape from the
// palette".
export function computeViewportCenter(rect: Rect, offset: Offset): { x: number; y: number } {
  return {
    x: rect.width / 2 - offset.x,
    y: rect.height / 2 - offset.y,
  };
}

// True when the elements' bounding box is entirely outside the viewport at
// the current pan / zoom — i.e. nothing on the tab is in view. Projects the
// canvas-coord bbox to screen pixels through the same centred-scale transform
// as computeViewportCenter (canvas point `cx` lands at `rect.w/2 + zoom *
// (cx - viewportCentreCanvasX)`), then reports a gap on any side. Callers
// must first confirm there is at least one element to bound: an empty tab is
// not "off-screen". Used to nudge the user toward Fit to screen.
export function isContentOffScreen(rect: Rect, bbox: BBox, offset: Offset, zoom: number): boolean {
  const centre = computeViewportCenter(rect, offset);
  const left = rect.width / 2 + zoom * (bbox.x - centre.x);
  const right = rect.width / 2 + zoom * (bbox.x + bbox.width - centre.x);
  const top = rect.height / 2 + zoom * (bbox.y - centre.y);
  const bottom = rect.height / 2 + zoom * (bbox.y + bbox.height - centre.y);
  return right <= 0 || left >= rect.width || bottom <= 0 || top >= rect.height;
}
