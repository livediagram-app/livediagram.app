// One element drawn in the Sketch finish (docs/specs/008-canvas/finish.md "Sketch"): its outline as hand-drawn
// strokes, its fill as hatching or a solid area. In the element's own
// coordinates (0..width, 0..height), so moving an element never changes it and the canvas can memoise it on
// size alone. The canvas overlay and the SVG export both draw from this, so the two cannot disagree.
import { SELF_PAINTING_SHAPES } from './colors';
import {
  BORDER_DASH_ARRAY,
  BORDER_STROKE_PX,
  DEFAULT_BORDER_STYLE,
  DEFAULT_BOX_RADIUS_PX,
  cornerRadiusPx,
} from '@liveworkspace/model-core/border-style';
import {
  finishBorderStroke,
  finishCornerFallbackPx,
  finishHatches,
  finishOwnCorner,
  type Finish,
} from './finish';
import type { BoxedElement } from './index';
import {
  outlineOfRect,
  sketchAreaPath,
  sketchHatching,
  sketchSeed,
  sketchStrokes,
  type SketchOutline,
} from './sketch';

/** Path data for each layer of a sketched element; an empty string draws nothing. */
export type SketchDrawing = {
  /** Sketch's pencil (marker-element.ts draws Marker's felt-tip). */
  pen: 'pencil';
  /** The outline, in the stroke colour at the border width. */
  strokes: string;
  /** Pencil shading over the fill, in the stroke colour at `SKETCH_HATCH_OPACITY`. */
  hatch: string;
  /** The solid fill, in the fill colour, under the shading and the strokes. Every filled element keeps it, so
   *  its text keeps the contrast it was coloured for on either canvas (light or dark). */
  solid: string;
};

/** How strongly the pencil shading shows over a filled shape: enough to read as hand-shaded, faint enough
 *  that the label on it stays readable (docs/specs/008-canvas/finish.md "Sketch"). */
export const SKETCH_HATCH_OPACITY = 0.15;

type SketchElementOptions = {
  /** The border width in px (0 draws no outline). */
  strokePx: number;
  /** The corner the element's box draws at, px (box kinds only). */
  radiusPx: number;
  /** The resolved fill colour, which decides hatching against solid. */
  fill: string;
  /** Something sits on this shape (sketch-backdrop.ts): a solid fill, never hatching. */
  backdrop?: boolean;
};

export const isSeeThrough = (fill: string) =>
  fill === 'transparent' || fill === 'none' || fill === '';

/** The sketch of a boxed element, or null for a kind Sketch leaves as drawn (text, images, freehand,
 *  self-painting faces). */
function sketchElement(el: BoxedElement, o: SketchElementOptions): SketchDrawing | null {
  const seed = sketchSeed(el.id);
  const w = el.width;
  const h = el.height;
  if (!(w > 0) || !(h > 0)) return null;
  const outlinePx = Math.max(0, o.strokePx);
  const inset = outlinePx / 2;
  const fillIt = !isSeeThrough(o.fill);

  if (el.type === 'sticky') {
    // Paper stays paper: a solid sheet, its edge drawn once by hand.
    const box = boxOutline(w, h, 0, 0);
    return {
      pen: 'pencil',
      strokes: sketchStrokes(boxOutline(w, h, 0, 0.5), seed, 1),
      hatch: '',
      solid: sketchAreaPath(box.area!),
    };
  }
  if (el.type !== 'shape') return null;

  const hatches = finishHatches(el, o.fill, o.backdrop);
  const part = handDrawnOutline(el, inset, o.radiusPx);
  if (!part) return null;
  const { outline } = part;
  const filled = fillIt && outline.area;
  return {
    pen: 'pencil',
    strokes: outlinePx > 0 ? sketchStrokes(outline, part.seed) : '',
    hatch: filled && hatches ? sketchHatching(outline.area!, part.seed, outlinePx || 2) : '',
    solid: filled ? sketchAreaPath(outline.area!) : '',
  };
}

/** A box's outline in its own px, `inset` in from each edge, its corners rounded to `radiusPx` less the inset. */
export function boxOutline(
  width: number,
  height: number,
  radiusPx: number,
  inset: number,
): SketchOutline {
  return outlineOfRect(
    inset,
    inset,
    Math.max(0, width - inset * 2),
    Math.max(0, height - inset * 2),
    Math.max(0, radiusPx - inset),
  );
}

/** The outline a hand-drawn finish draws for a shape, with the seed its wobble grows from. */
export type HandDrawnOutline = { outline: SketchOutline; seed: number };

/** The outline a hand-drawn finish (Sketch, Marker) draws for a shape: its box, in its own px. The diagram shapes'
 *  drawn outlines left with them (docs/specs/002-project-scope/not-in-livehuddle.md "The element engine", part 5).
 *  `inset` keeps a stroke inside the box. Null for a kind drawn as it is (a self-painting face). */
export function handDrawnOutline(
  el: BoxedElement & { type: 'shape' },
  inset: number,
  radiusPx: number,
): HandDrawnOutline | null {
  if (SELF_PAINTING_SHAPES.has(el.shape)) return null;
  return { outline: boxOutline(el.width, el.height, radiusPx, inset), seed: sketchSeed(el.id) };
}

/** The width a sketched sticky's edge is drawn at, px. */
const STICKY_EDGE_PX = 1;

/** Everything the canvas and the export need to draw an element in a finish: the drawing, and the width and
 *  dash its outline is stroked at. The border, corner and width resolve exactly as an unsketched element's do
 *  in the same finish, so switching to Sketch keeps an element's weight. Null when the element is not
 *  sketched. */
export function sketchElementPaint(
  el: BoxedElement,
  finish: Finish,
  fill: string,
  backdrop = false,
): { drawing: SketchDrawing; strokePx: number; dash: string | null } | null {
  if (finish !== 'sketch') return null;
  let strokePx = 0;
  let dash: string | null = null;
  let radiusPx = 0;
  if (el.type === 'shape') {
    strokePx = BORDER_STROKE_PX[finishBorderStroke(el.strokeWidth, finish)];
    dash = BORDER_DASH_ARRAY[el.strokeStyle ?? DEFAULT_BORDER_STYLE];
    const kindDefault = DEFAULT_BOX_RADIUS_PX;
    radiusPx = cornerRadiusPx(
      finishOwnCorner(el, finish),
      el.width,
      el.height,
      finishCornerFallbackPx(kindDefault, finish),
    );
  } else if (el.type === 'sticky') strokePx = STICKY_EDGE_PX;
  const drawing = sketchElement(el, { strokePx, radiusPx, fill, backdrop });
  return drawing ? { drawing, strokePx, dash } : null;
}
