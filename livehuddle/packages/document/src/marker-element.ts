// One element drawn in the Marker finish (docs/specs/008-canvas/finish.md "Marker"): its outline as felt-tip strokes
// in two layers of see-through ink, its fill solid with the colouring's streaks over it, its thin chrome as one
// layer. In the element's own coordinates, so it is memoised on size alone, as Sketch's drawing is
// (sketch-element.ts, which it shares its outlines with). The canvas overlay and the SVG export both draw from this.
import {
  BORDER_DASH_ARRAY,
  BORDER_STROKE_PX,
  DEFAULT_BORDER_STYLE,
  DEFAULT_BOX_RADIUS_PX,
  cornerRadiusPx,
} from '@liveworkspace/model-core/border-style';
import { MARKER_LINE_PX, finishCornerFallbackPx, finishHatches } from './finish';
import type { BoxedElement } from './index';
import { markerColouring, markerStrokes, type MarkerLayers } from './marker';
import { sketchAreaPath, sketchSeed } from './sketch';
import { boxOutline, handDrawnOutline, isSeeThrough } from './sketch-element';

/** Path data for each layer of an element in marker; an empty string draws nothing. */
export type MarkerDrawing = {
  pen: 'marker';
  /** The outline in two layers, in the stroke colour at the border width and MARKER_INK_OPACITY. */
  ink: MarkerLayers;
  /** The solid fill, in the fill colour, under everything. */
  solid: string;
  /** The colouring's rows in two layers over the fill, in the stroke colour at MARKER_STREAK_OPACITY, `nibPx` wide. */
  streaks: MarkerLayers;
  nibPx: number;
};

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
  // A sticky stays paper, its peel and no outline (a note on a wall is written on, never outlined), but is coloured
  // in like any filled body (docs/specs/008-canvas/finish.md "Marker"); the canvas draws the streaks over the paper.
  if (el.type === 'sticky') {
    const area = boxOutline(w, h, 0, 0).area;
    if (!area || fill === 'transparent' || fill === 'none') return null;
    const { streaks, nibPx } = markerColouring(area, seed);
    // Its paper as the solid layer, so an export (which draws this in place of the box) keeps it.
    const drawing: MarkerDrawing = {
      pen: 'marker',
      ink: ['', ''],
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
  const part = handDrawnOutline(el, strokePx / 2, radiusPx);
  if (!part) return null;
  const fillIt = !isSeeThrough(fill);
  // Marker colours in every filled body, backdrops too (docs/specs/008-canvas/finish.md "Marker"): its streaks are
  // light enough to read over, and a shape left solid because something sits on it read as missed.
  const colours = finishHatches(el, fill, false);
  const { outline, seed: partSeed } = part;
  const ink: MarkerLayers = strokePx > 0 ? markerStrokes(outline, partSeed) : ['', ''];
  const filled = fillIt && outline.area;
  const colouring = filled && colours ? markerColouring(outline.area!, partSeed) : null;
  const drawing: MarkerDrawing = {
    pen: 'marker',
    ink,
    solid: filled ? sketchAreaPath(outline.area!) : '',
    streaks: colouring ? colouring.streaks : ['', ''],
    nibPx: colouring ? colouring.nibPx : 0,
  };
  return { drawing, strokePx: strokePx > 0 ? strokePx : 0, dash };
}
