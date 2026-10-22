// One element drawn in the Marker finish (docs/specs/008-canvas/finish.md "Marker"): its outline as felt-tip strokes
// in two layers of see-through ink, its fill solid with the colouring's streaks over it, its thin chrome as one
// layer. In the element's own coordinates, so it is memoised on size alone, as Sketch's drawing is
// (sketch-element.ts, which it shares its outlines with). The canvas overlay and the SVG export both draw from this.
import { ARROWHEAD_SIZE_PX, type ArrowheadShape } from './arrow-style';
import {
  BORDER_DASH_ARRAY,
  BORDER_STROKE_PX,
  DEFAULT_BORDER_STYLE,
  DEFAULT_BOX_RADIUS_PX,
  cornerRadiusPx,
} from './border-style';
import { MARKER_LINE_PX, finishCornerFallbackPx, finishHatches } from './finish';
import type { BoxedElement } from './index';
import {
  markerArrowHead,
  markerColouring,
  markerStrokes,
  trimOutline,
  type MarkerLayers,
} from './marker';
import { outlineOfBox, outlineOfPath, pathEndTangents, sketchAreaPath, sketchSeed } from './sketch';
import { FILLED_ROLES } from './shape-hit';
import { handDrawnOutlines, isSeeThrough } from './sketch-element';

/** Path data for each layer of an element in marker; an empty string draws nothing. */
export type MarkerDrawing = {
  pen: 'marker';
  /** The outline in two layers, in the stroke colour at the border width and MARKER_INK_OPACITY. */
  ink: MarkerLayers;
  /** Thin chrome (bezels, keys, creases), in the stroke colour at the detail width, the same ink. */
  details: string;
  /** The solid fill, in the fill colour, under everything. */
  solid: string;
  /** The solid layer is a combined path whose holes show through (a Path-tool shape): filled even-odd. */
  solidEvenOdd?: boolean;
  /** The colouring's rows in two layers over the fill, in the stroke colour at MARKER_STREAK_OPACITY, `nibPx` wide. */
  streaks: MarkerLayers;
  nibPx: number;
};

/** The width a table's frame is drawn at in marker, px: bold enough to read as marker over the grid's own rules. */
const MARKER_TABLE_FRAME_PX = 2.5;

/** An element in marker, with the width and dash its outline is stroked at; null for a kind Marker leaves as drawn
 *  (a sticky, which stays paper; text, images, freehand and self-painting faces). An unset or Thin border is drawn
 *  at MARKER_LINE_PX; Medium and wider are drawn as picked. */
export function markerElementPaint(
  el: BoxedElement,
  fill: string,
  // Kept for the shared hand-drawn signature (handDrawnElementPaint); Marker colours in backdrops too.
  _backdrop = false,
): { drawing: MarkerDrawing; strokePx: number; dash: string | null } | null {
  const w = el.width;
  const h = el.height;
  if (!(w > 0) || !(h > 0)) return null;
  const seed = sketchSeed(el.id);
  if (el.type === 'table') {
    const strokePx = MARKER_TABLE_FRAME_PX;
    const drawing: MarkerDrawing = {
      pen: 'marker',
      ink: markerStrokes(outlineOfBox('square', w, h, 0, strokePx / 2), seed),
      details: '',
      solid: '',
      streaks: ['', ''],
      nibPx: 0,
    };
    return { drawing, strokePx, dash: null };
  }
  // A sticky stays paper, its peel and no outline (a note on a wall is written on, never outlined), but is coloured
  // in like any filled body (docs/specs/008-canvas/finish.md "Marker"); the canvas draws the streaks over the paper.
  if (el.type === 'sticky') {
    const area = outlineOfBox('square', w, h, 0, 0).area;
    if (!area || fill === 'transparent' || fill === 'none') return null;
    const { streaks, nibPx } = markerColouring(area, seed);
    // Its paper as the solid layer, so an export (which draws this in place of the box) keeps it.
    const drawing: MarkerDrawing = {
      pen: 'marker',
      ink: ['', ''],
      details: '',
      solid: sketchAreaPath(area),
      streaks,
      nibPx,
    };
    return { drawing, strokePx: 0, dash: null };
  }
  if (el.type !== 'shape') return null;
  // A marker has no fine-liner: Thin draws at the nib like an unset border (templates set Thin on purpose).
  const strokePx =
    el.strokeWidth && el.strokeWidth !== 'thin' ? BORDER_STROKE_PX[el.strokeWidth] : MARKER_LINE_PX;
  const dash = BORDER_DASH_ARRAY[el.strokeStyle ?? DEFAULT_BORDER_STYLE];
  const kindDefault = DEFAULT_BOX_RADIUS_PX;
  const radiusPx = cornerRadiusPx(
    el.borderRadius,
    w,
    h,
    finishCornerFallbackPx(kindDefault, 'marker'),
  );
  const parts = handDrawnOutlines(el, strokePx / 2, radiusPx);
  if (!parts) return null;
  const fillIt = !isSeeThrough(fill);
  // Marker colours in every filled body, backdrops too (docs/specs/008-canvas/finish.md "Marker"): its streaks are
  // light enough to read over, and a shape left solid because something sits on it read as missed.
  const colours = finishHatches(el, fill, false);
  const ink: [string[], string[]] = [[], []];
  const streaks: [string[], string[]] = [[], []];
  const details: string[] = [];
  const solid: string[] = [];
  let nibPx = 0;
  for (const { outline, role, seed: partSeed } of parts) {
    if (role === 'detail') {
      details.push(...markerStrokes(outline, partSeed).filter(Boolean));
      continue;
    }
    if (strokePx > 0) {
      const [a, b] = markerStrokes(outline, partSeed);
      if (a) ink[0].push(a);
      if (b) ink[1].push(b);
    }
    if (!fillIt || !FILLED_ROLES.has(role) || !outline.area) continue;
    solid.push(sketchAreaPath(outline.area));
    if (!colours) continue;
    const colouring = markerColouring(outline.area, partSeed);
    if (colouring.streaks[0]) streaks[0].push(colouring.streaks[0]);
    if (colouring.streaks[1]) streaks[1].push(colouring.streaks[1]);
    // Parts share one nib width: the broadest any of them needs.
    nibPx = Math.max(nibPx, colouring.nibPx);
  }
  const drawing: MarkerDrawing = {
    pen: 'marker',
    ink: [ink[0].join(' '), ink[1].join(' ')],
    details: details.join(' '),
    solid: solid.join(' '),
    streaks: [streaks[0].join(' '), streaks[1].join(' ')],
    nibPx,
  };
  return { drawing, strokePx: strokePx > 0 ? strokePx : 0, dash };
}

/** The arrowhead shapes Marker redraws: a line head as one chevron stroke, a triangle as a solid wedge, a hollow
 *  triangle as a closed outline. Circles and diamonds keep their marks, as under Sketch. */
const MARKER_HEAD_SHAPES: ReadonlySet<ArrowheadShape> = new Set([
  'triangle',
  'triangle-hollow',
  'line',
]);

/** A marker head is sized like the line it ends, but never past a 2.5 px line's: a 3 px nib's head drawn at full
 *  scale swamps the line (medium is 15 px long, not 18). */
const MARKER_HEAD_SCALE_MAX_PX = 2.5;

/** An arrow in marker: its line in two layers (one when `oneLayer`, so a flow's dash and draw maths hold), and its
 *  heads when Marker redraws their shape. Null for a line too short to draw. */
export function markerArrow(
  id: string,
  pathD: string,
  o: {
    strokePx: number;
    headSize: keyof typeof ARROWHEAD_SIZE_PX;
    headShape: ArrowheadShape;
    startHead: boolean;
    endHead: boolean;
    oneLayer: boolean;
  },
): { line: MarkerLayers; heads: string; drawnHeads: boolean; headFill: boolean } | null {
  const tangents = pathEndTangents(pathD);
  if (!tangents) return null;
  const seed = sketchSeed(id);
  const drawnHeads = MARKER_HEAD_SHAPES.has(o.headShape);
  const length = ARROWHEAD_SIZE_PX[o.headSize] * Math.min(o.strokePx, MARKER_HEAD_SCALE_MAX_PX);
  const closed = o.headShape !== 'line';
  // A hollow head's line stops at its base, so the triangle reads empty.
  const hollow = drawnHeads && o.headShape === 'triangle-hollow';
  const outline = hollow
    ? trimOutline(
        outlineOfPath(pathD),
        o.startHead ? length * 0.9 : 0,
        o.endHead ? length * 0.9 : 0,
      )
    : outlineOfPath(pathD);
  const [a, b] = markerStrokes(outline, seed, { pinEnds: true });
  const line: MarkerLayers = o.oneLayer ? [[a, b].filter(Boolean).join(' '), ''] : [a, b];
  if (!drawnHeads) return { line, heads: '', drawnHeads, headFill: false };
  // The tip sits a tenth of the head's length past the path's end, as the markers' does (refX 9 of 10).
  const head = (at: { x: number; y: number }, dir: { x: number; y: number }, s: number) =>
    markerArrowHead(
      { x: at.x + dir.x * length * 0.1, y: at.y + dir.y * length * 0.1 },
      dir,
      length,
      s,
      closed,
    );
  const heads = [
    o.startHead ? head(tangents.start.at, tangents.start.dir, seed + 1) : '',
    o.endHead ? head(tangents.end.at, tangents.end.dir, seed + 2) : '',
  ]
    .filter(Boolean)
    .join(' ');
  return { line, heads, drawnHeads, headFill: o.headShape === 'triangle' };
}
