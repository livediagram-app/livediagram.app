// A face's own parts drawn in marker (docs/specs/008-canvas/finish.md "Marker", "Faces: frames and shapes"): which
// part of a face is a frame, a shape or a line, and its marker drawing. Pure; the canvas (MarkerFace, reading the
// live face) and the export (svgMarkerFace, reading the face's markup) both describe a part and call
// markerFacePartSvg, so the two draw the same parts the same way.
import { MARKER_LINE_PX } from './finish';
import { isPillRect } from './face-finish';
import { MARKER_INK_OPACITY, MARKER_STREAK_OPACITY, markerColouring, markerStrokes } from './marker';
import {
  outlineOfEllipse,
  outlineOfPath,
  outlineOfRect,
  sketchSeed,
  type Pt,
  type SketchOutline,
} from './sketch';
import { xmlEscape } from './svg-render-primitives';

/** An outlined box counts as a frame (a card, a column, a panel) when both its sides are at least this, px. */
export const MARKER_FACE_FRAME_MIN_PX = 40;
/** A part is drawn in marker only when its longest side is past this, px: glyphs, ticks and dots stay plain. */
export const MARKER_FACE_SHAPE_MIN_PX = 24;
/** ... and its shortest side at least this, px: hairline rules and slivers stay plain. */
export const MARKER_FACE_SHAPE_THIN_PX = 6;
/** A part covering at least this share of its face is the face's backdrop, drawn as it is. */
export const MARKER_FACE_BACKDROP_SHARE = 0.6;
/** Most parts one face draws in marker (document order), bounding a busy face's cost. */
export const MARKER_FACE_MAX_PARTS = 120;
/** A frame's marker line, px: the table frame's weight, a touch under a body's nib so a board of cards stays calm. */
export const MARKER_FACE_FRAME_PX = 2.5;
/** A line thicker than this (a donut chart's ring) is drawn at its own width; thinner ones at the nib. */
export const MARKER_FACE_BAND_PX = 6;

/** A part's geometry, in its own user units. */
export type FacePartShape =
  | { kind: 'rect'; x: number; y: number; width: number; height: number; rx: number }
  | { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number }
  | { kind: 'path'; d: string };

/** How a part is painted: colours as CSS colours or null for none, its line width, its own opacity. */
export type FacePartPaint = {
  fill: string | null;
  stroke: string | null;
  strokePx: number;
  opacity?: number;
};

/** What a part is under Marker: a frame (outlined, its fill kept solid), a shape (coloured in and outlined in its
 *  colour), a line (one marker stroke along it). */
export type FacePartRole = 'frame' | 'shape' | 'line';

export type FacePartDrawing = { role: FacePartRole; svg: string };

/** Whether a colour paints anything: not absent, none, transparent, a fully clear rgba, or a paint server. */
export function isInkColour(c: string | null | undefined): c is string {
  if (!c) return false;
  const v = c.trim().toLowerCase();
  if (v === 'none' || v === 'transparent' || v.startsWith('url(')) return false;
  return !/^rgba\(.*,\s*0(\.0+)?\s*\)$/.test(v) && !/\/\s*0%?\s*\)$/.test(v);
}

function outlineOf(shape: FacePartShape): SketchOutline {
  switch (shape.kind) {
    case 'rect':
      return outlineOfRect(shape.x, shape.y, shape.width, shape.height, shape.rx);
    case 'ellipse':
      return outlineOfEllipse(shape.cx, shape.cy, shape.rx, shape.ry);
    case 'path':
      return outlineOfPath(shape.d);
  }
}

function boundsOf(outline: SketchOutline): { w: number; h: number } | null {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  const see = (p: Pt) => {
    if (p.x < x0) x0 = p.x;
    if (p.x > x1) x1 = p.x;
    if (p.y < y0) y0 = p.y;
    if (p.y > y1) y1 = p.y;
  };
  for (const s of outline.segments) {
    if (s.kind === 'line') {
      see(s.from);
      see(s.to);
    } else s.points.forEach(see);
  }
  return Number.isFinite(x0) ? { w: x1 - x0, h: y1 - y0 } : null;
}

/** What a part is under Marker, or null when it keeps its plain look (too small, a pill, the backdrop, unpainted). */
export function facePartRole(
  shape: FacePartShape,
  outline: SketchOutline,
  paint: FacePartPaint,
  face: { width: number; height: number },
): FacePartRole | null {
  if (shape.kind === 'rect' && isPillRect(shape.width, shape.height, shape.rx)) return null;
  const b = boundsOf(outline);
  if (!b) return null;
  const long = Math.max(b.w, b.h);
  const short = Math.min(b.w, b.h);
  if (long <= MARKER_FACE_SHAPE_MIN_PX) return null;
  const stroked = isInkColour(paint.stroke) && paint.strokePx > 0;
  const filled = isInkColour(paint.fill);
  const closed = shape.kind !== 'path' || outline.area !== null;
  // An outlined box is a frame at any size: the panel's own frame, as well as a card in it.
  if (stroked && closed && shape.kind === 'rect' && short >= MARKER_FACE_FRAME_MIN_PX) return 'frame';
  // An unoutlined fill across most of the face is what the face sits on.
  if (b.w * b.h >= MARKER_FACE_BACKDROP_SHARE * face.width * face.height) return null;
  if (filled && closed) return short >= MARKER_FACE_SHAPE_THIN_PX ? 'shape' : null;
  if (stroked) return 'line';
  return null;
}

const LINE_ATTRS = ' fill="none" stroke-linecap="round" stroke-linejoin="round"';

/** One part of a face in marker, or null when it keeps its plain look. `seed` is the face's (markerFaceSeed) and
 *  `index` the part's place among the face's drawn parts. */
export function markerFacePart(
  shape: FacePartShape,
  paint: FacePartPaint,
  face: { width: number; height: number },
  seed: number,
  index: number,
): FacePartDrawing | null {
  const outline = outlineOf(shape);
  const role = facePartRole(shape, outline, paint, face);
  if (!role) return null;
  const partSeed = (seed ^ Math.imul(index + 1, 0x9e3779b1)) >>> 0;
  const colour = xmlEscape(role === 'shape' && !isInkColour(paint.stroke) ? paint.fill! : paint.stroke!);
  const px =
    role === 'frame'
      ? MARKER_FACE_FRAME_PX
      : role === 'line' && paint.strokePx > MARKER_FACE_BAND_PX
        ? paint.strokePx
        : MARKER_LINE_PX;
  const parts: string[] = [];
  if (role === 'shape' && outline.area) {
    const { streaks, nibPx } = markerColouring(outline.area, partSeed);
    for (const d of streaks)
      if (d)
        parts.push(
          `<path d="${d}" stroke="${colour}" stroke-opacity="${MARKER_STREAK_OPACITY}" stroke-width="${nibPx}"${LINE_ATTRS}/>`,
        );
  }
  for (const d of markerStrokes(outline, partSeed))
    if (d)
      parts.push(
        `<path d="${d}" stroke="${colour}" stroke-opacity="${MARKER_INK_OPACITY}" stroke-width="${px}"${LINE_ATTRS}/>`,
      );
  if (parts.length === 0) return null;
  const opacity = paint.opacity !== undefined && paint.opacity < 1 ? ` opacity="${paint.opacity}"` : '';
  return { role, svg: `<g data-marker-part="${role}"${opacity}>${parts.join('')}</g>` };
}

/** A face's marker seed: its element's, on a stream of its own so its parts never repeat its body's wobble. */
export function markerFaceSeed(elementId: string): number {
  return (sketchSeed(elementId) ^ 0x5f3759df) >>> 0;
}
