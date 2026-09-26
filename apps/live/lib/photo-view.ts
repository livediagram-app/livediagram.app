// Zooming and panning the photograph under review (docs/specs/021-event-storming/event-storming.md Phase 9).
//
// The picture is laid out at its FITTED size — the whole photo in the window —
// and the view sits on top of that: a zoom and an offset, both in
// fitted-picture pixels, applied as `translate(x, y) scale(zoom)` from the
// top-left corner. Everything placed on the photo (the boxes, the drag that
// draws a missed note) is a percentage of the picture, so it rides along with
// the transform and never needs to know the view exists.
//
// Pure, so the maths is tested without a browser.

import { clamp } from '@livediagram/diagram';

export type PhotoView = { zoom: number; x: number; y: number };

// The whole photograph, as laid out.
export const FIT: PhotoView = { zoom: 1, x: 0, y: 0 };

// Deep enough that a sticky which is 15px across at fit — a whiteboard of
// three hundred notes — is 120px, which is room to see its edge and draw
// round it. Further in is only the photo's own pixels getting bigger.
export const PHOTO_ZOOM_MAX = 8;

type Size = { width: number; height: number };

// A photo is never pulled past its own edge: at zoom z the picture is z times
// the frame, so its top-left may travel from 0 (left edge on the frame's left
// edge) to frame − frame·z (right edge on the frame's right edge).
export function clampView(view: PhotoView, size: Size): PhotoView {
  const zoom = clamp(view.zoom, 1, PHOTO_ZOOM_MAX);
  const minX = Math.min(0, size.width - size.width * zoom);
  const minY = Math.min(0, size.height - size.height * zoom);
  return { zoom, x: clamp(view.x, minX, 0) || 0, y: clamp(view.y, minY, 0) || 0 };
}

// Zoom by `factor` about a point given in FRAME pixels (relative to the
// frame's top-left, as the pointer is). The picture point under that pixel
// stays under it.
export function zoomAt(
  view: PhotoView,
  size: Size,
  factor: number,
  at: { x: number; y: number },
): PhotoView {
  const zoom = clamp(view.zoom * factor, 1, PHOTO_ZOOM_MAX);
  // The picture point under the pointer, before the zoom…
  const px = (at.x - view.x) / view.zoom;
  const py = (at.y - view.y) / view.zoom;
  // …is put back under it after.
  return clampView({ zoom, x: at.x - px * zoom, y: at.y - py * zoom }, size);
}

// Move the photo by a pointer movement, in frame pixels.
export function panBy(view: PhotoView, size: Size, dx: number, dy: number): PhotoView {
  return clampView({ ...view, x: view.x + dx, y: view.y + dy }, size);
}

type Point = { x: number; y: number };
type Fingers = { a: Point; b: Point };

const between = (f: Fingers): Point => ({ x: (f.a.x + f.b.x) / 2, y: (f.a.y + f.b.y) / 2 });
const spread = (f: Fingers) => Math.hypot(f.a.x - f.b.x, f.a.y - f.b.y);

// One movement of a two-finger pinch, in frame pixels: the change in spread
// zooms about the point between the fingers, and the travel of that point
// pans — so the photo stays pinned under both fingers, as on any phone.
export function pinchStep(view: PhotoView, size: Size, before: Fingers, after: Fingers): PhotoView {
  const from = spread(before);
  const to = spread(after);
  if (from === 0 || to === 0) return view;
  const mid = between(before);
  const next = between(after);
  const zoomed = zoomAt(view, size, to / from, mid);
  return panBy(zoomed, size, next.x - mid.x, next.y - mid.y);
}
