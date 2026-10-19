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
  outlineOfPolygon,
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
/** A rectangle within this of the face's own box, px, on both sides, is the face's box itself. */
export const MARKER_FACE_BODY_SLACK_PX = 6;
/** An unoutlined rectangle covering at least this share of its face is the face's backdrop, drawn as it is. */
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
  | { kind: 'path'; d: string }
  | { kind: 'polygon'; points: Pt[] }
  | { kind: 'polyline'; points: Pt[] };

/** How a part is painted: colours as CSS colours or null for none, its line width, its own opacity. */
export type FacePartPaint = {
  fill: string | null;
  stroke: string | null;
  strokePx: number;
  opacity?: number;
  // The line is dashed (a progress arc is a dashed ring): redrawn whole it would close, so it keeps its look.
  dashed?: boolean;
};

/** What a part is under Marker: a frame (outlined, its fill kept solid), a shape (coloured in and outlined in its
 *  colour), a line (one marker stroke along it). */
export type FacePartRole = 'frame' | 'shape' | 'line';

export type FacePartDrawing = { role: FacePartRole; svg: string };

/** How far a frame's ink is pulled from its fill, 0..1: a card's hairline border is a pale grey that, drawn as is,
 *  reads as no marker at all; pulled this far toward black on a light card (white on a dark one) it reads as felt-tip
 *  while keeping the border's hue. */
export const MARKER_FACE_FRAME_INK_SHIFT = 0.45;

type Rgba = { r: number; g: number; b: number; a: number };

// `#rgb`, `#rrggbb`, `rgb()` and `rgba()` (comma or space separated), or null for anything else.
function parseColour(c: string): Rgba | null {
  const v = c.trim().toLowerCase();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(v);
  if (hex) {
    const h = hex[1]!.length === 3 ? [...hex[1]!].map((d) => d + d).join('') : hex[1]!;
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: 1 };
  }
  const fn = /^rgba?\(([^)]+)\)$/.exec(v);
  if (!fn) return null;
  const n = fn[1]!.split(/[\s,/]+/).filter(Boolean).map(Number);
  if (n.length < 3 || n.some((x) => !Number.isFinite(x))) return null;
  return { r: n[0]!, g: n[1]!, b: n[2]!, a: n[3] ?? 1 };
}

const hexOf = ({ r, g, b }: { r: number; g: number; b: number }) =>
  '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');

/** A frame's marker ink: its border colour as it shows on its fill (a see-through border laid over it), pulled
 *  MARKER_FACE_FRAME_INK_SHIFT toward black on a light fill or white on a dark one. A colour it cannot read is
 *  drawn as it is. */
export function markerFrameInk(stroke: string, fill: string | null): string {
  const s = parseColour(stroke);
  if (!s) return stroke;
  const f = (fill && parseColour(fill)) || null;
  const under = f && f.a > 0 ? f : { r: 255, g: 255, b: 255, a: 1 };
  const shown = {
    r: s.r * s.a + under.r * (1 - s.a),
    g: s.g * s.a + under.g * (1 - s.a),
    b: s.b * s.a + under.b * (1 - s.a),
  };
  const light = (under.r * 299 + under.g * 587 + under.b * 114) / 1000 > 128;
  const to = light ? 0 : 255;
  const k = MARKER_FACE_FRAME_INK_SHIFT;
  return hexOf({ r: shown.r + (to - shown.r) * k, g: shown.g + (to - shown.g) * k, b: shown.b + (to - shown.b) * k });
}

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
    case 'polygon':
      return outlineOfPolygon(shape.points);
    case 'polyline':
      return {
        segments: shape.points.slice(1).map((to, i) => ({ kind: 'line' as const, from: shape.points[i]!, to })),
        area: null,
      };
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
  if (paint.dashed) return null;
  const b = boundsOf(outline);
  if (!b) return null;
  const long = Math.max(b.w, b.h);
  const short = Math.min(b.w, b.h);
  if (long <= MARKER_FACE_SHAPE_MIN_PX) return null;
  const stroked = isInkColour(paint.stroke) && paint.strokePx > 0;
  const filled = isInkColour(paint.fill);
  const closed = (shape.kind !== 'path' && shape.kind !== 'polyline') || outline.area !== null;
  if (shape.kind === 'rect') {
    // The face's own box (a banner, a timer, a panel): its edge in marker, whether it is outlined or only filled.
    const body =
      Math.abs(shape.width - face.width) <= MARKER_FACE_BODY_SLACK_PX &&
      Math.abs(shape.height - face.height) <= MARKER_FACE_BODY_SLACK_PX;
    if (body && (stroked || filled)) return 'frame';
    // An outlined box is a frame: a card, a column, an input big enough to be one.
    if (stroked && short >= MARKER_FACE_FRAME_MIN_PX) return 'frame';
    // An unoutlined fill across most of the face is what the face sits on.
    if (b.w * b.h >= MARKER_FACE_BACKDROP_SHARE * face.width * face.height) return null;
  }
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
  // A line in its own colour; an edge with no line of its own (a filled band, a bar, a banner) in a deeper shade of
  // its fill, which on the fill itself would not show; a frame's line pulled from its fill (markerFrameInk).
  const stroked = isInkColour(paint.stroke);
  const colour = xmlEscape(
    role === 'line'
      ? paint.stroke!
      : !stroked
        ? markerFrameInk(paint.fill!, paint.fill)
        : role === 'frame'
          ? markerFrameInk(paint.stroke!, paint.fill)
          : paint.stroke!,
  );
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

/** A polygon's or polyline's `points` attribute as points (numbers in pairs, comma or space separated); null for
 *  fewer than 2. */
export function polygonPoints(attr: string): Pt[] | null {
  const n = attr.trim().split(/[\s,]+/).map(Number);
  if (n.some((v) => !Number.isFinite(v))) return null;
  const points: Pt[] = [];
  for (let i = 0; i + 1 < n.length; i += 2) points.push({ x: n[i]!, y: n[i + 1]! });
  return points.length >= 2 ? points : null;
}
