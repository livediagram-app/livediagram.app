// One element drawn in the Sketch finish (docs/specs/008-canvas/finish.md "Sketch"): its outline as hand-drawn
// strokes, its fill as hatching or a solid area, its thin chrome as single strokes. In the element's own
// coordinates (0..width, 0..height), so moving an element never changes it and the canvas can memoise it on
// size alone. The canvas overlay and the SVG export both draw from this, so the two cannot disagree.
import { actorFigureRect } from './actor-figure';
import { ARROWHEAD_SIZE_PX, type ArrowheadShape, type ArrowheadSize } from './arrow-style';
import { SELF_PAINTING_SHAPES } from './colors';
import {
  BORDER_DASH_ARRAY,
  BORDER_STROKE_PX,
  DEFAULT_BORDER_STYLE,
  DEFAULT_BOX_RADIUS_PX,
  MIND_NODE_RADIUS_PX,
  cornerRadiusPx,
} from './border-style';
import { finishBorderStroke, finishCornerFallbackPx, finishHatches, type Finish } from './finish';
import type { BoxedElement, ShapeKind } from './index';
import { shapeGeometry, type ShapePartRole } from './shape-geometry';
import {
  outlineOfBox,
  outlineOfPart,
  outlineOfPath,
  pathEndTangents,
  sketchArrowHead,
  sketchAreaPath,
  sketchHatching,
  sketchSeed,
  sketchStrokes,
} from './sketch';
import { boxFit, fitShapePart } from './svg-shape-fit';

/** Path data for each layer of a sketched element; an empty string draws nothing. */
export type SketchDrawing = {
  /** The outline, in the stroke colour at the border width. */
  strokes: string;
  /** Thin chrome (bezels, keys, creases), in the stroke colour at the detail width. */
  details: string;
  /** Pencil hatching, in the fill colour. */
  hatch: string;
  /** A solid fill (stickies, containers), in the fill colour, under the strokes. */
  solid: string;
};

export type SketchElementOptions = {
  /** The border width in px (0 draws no outline). */
  strokePx: number;
  /** The corner the element's box draws at, px (box kinds only). */
  radiusPx: number;
  /** The resolved fill colour, which decides hatching against solid. */
  fill: string;
  /** Something sits on this shape (sketch-backdrop.ts): a solid fill, never hatching. */
  backdrop?: boolean;
};

const FILLED_ROLES: ReadonlySet<ShapePartRole> = new Set(['main', 'outline', 'head']);

const isSeeThrough = (fill: string) => fill === 'transparent' || fill === 'none' || fill === '';

/** The sketch of a boxed element, or null for a kind Sketch leaves as drawn (text, images, freehand,
 *  self-painting faces). */
export function sketchElement(el: BoxedElement, o: SketchElementOptions): SketchDrawing | null {
  const seed = sketchSeed(el.id);
  const w = el.width;
  const h = el.height;
  if (!(w > 0) || !(h > 0)) return null;
  const outlinePx = Math.max(0, o.strokePx);
  const inset = outlinePx / 2;
  const fillIt = !isSeeThrough(o.fill);

  if (el.type === 'sticky') {
    // Paper stays paper: a solid sheet, its edge drawn once by hand.
    const box = outlineOfBox('square', w, h, 0, 0);
    return {
      strokes: sketchStrokes(outlineOfBox('square', w, h, 0, 0.5), seed, 1),
      details: '',
      hatch: '',
      solid: sketchAreaPath(box.area!),
    };
  }
  if (el.type === 'table') {
    // The grid draws its own cells; the sketch is its frame.
    return {
      strokes: outlinePx > 0 ? sketchStrokes(outlineOfBox('square', w, h, 0, inset), seed) : '',
      details: '',
      hatch: '',
      solid: '',
    };
  }
  if (el.type !== 'shape') return null;
  // A comment pin draws its own bubble and no box (docs/specs/012-collaboration/comment-pin.md).
  if (el.shape === 'comment-pin') return null;

  const hatches = finishHatches(el, o.fill, o.backdrop);
  const geometry = shapeGeometry(el.shape as ShapeKind, w / h);
  if (geometry) {
    const area = el.shape === 'actor' ? actorFigureRect(el) : { x: 0, y: 0, width: w, height: h };
    const pad = geometry.strokeInside ? inset : 0;
    const fit = boxFit(geometry, {
      x: area.x + pad,
      y: area.y + pad,
      width: Math.max(0, area.width - 2 * pad),
      height: Math.max(0, area.height - 2 * pad),
    });
    const strokes: string[] = [];
    const details: string[] = [];
    const hatch: string[] = [];
    const solid: string[] = [];
    geometry.parts.forEach((part, i) => {
      const outline = outlineOfPart(fitShapePart(part, fit));
      const partSeed = seed + i * 31;
      if (part.role === 'detail') {
        details.push(sketchStrokes(outline, partSeed, 1));
        return;
      }
      if (outlinePx > 0) strokes.push(sketchStrokes(outline, partSeed));
      if (fillIt && FILLED_ROLES.has(part.role) && outline.area) {
        if (hatches) hatch.push(sketchHatching(outline.area, partSeed, outlinePx || 2));
        else solid.push(sketchAreaPath(outline.area));
      }
    });
    return {
      strokes: strokes.join(' '),
      details: details.join(' '),
      hatch: hatch.join(' '),
      solid: solid.join(' '),
    };
  }
  if (SELF_PAINTING_SHAPES.has(el.shape)) return null;

  // A box kind (square, circle, stadium, mind node, the rectangular frames).
  const outline = outlineOfBox(el.shape, w, h, o.radiusPx, inset);
  const area = outline.area;
  return {
    strokes: outlinePx > 0 ? sketchStrokes(outline, seed) : '',
    details: '',
    hatch: fillIt && hatches && area ? sketchHatching(area, seed, outlinePx || 2) : '',
    solid: fillIt && !hatches && area ? sketchAreaPath(area) : '',
  };
}

/** The width a sketched table's frame and a sticky's edge are drawn at, px. */
const TABLE_FRAME_PX = 1.5;
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
    const kindDefault = el.shape === 'mind-node' ? MIND_NODE_RADIUS_PX : DEFAULT_BOX_RADIUS_PX;
    radiusPx = cornerRadiusPx(
      el.borderRadius,
      el.width,
      el.height,
      finishCornerFallbackPx(kindDefault, finish),
    );
  } else if (el.type === 'table') strokePx = TABLE_FRAME_PX;
  else if (el.type === 'sticky') strokePx = STICKY_EDGE_PX;
  const drawing = sketchElement(el, { strokePx, radiusPx, fill, backdrop });
  return drawing ? { drawing, strokePx, dash } : null;
}

/** The arrowhead shapes Sketch redraws as two loose strokes; circles and diamonds keep their marks because
 *  they carry meaning (UML composition, ER cardinality). */
export const SKETCHED_HEAD_SHAPES: ReadonlySet<ArrowheadShape> = new Set([
  'triangle',
  'triangle-hollow',
  'line',
]);

export type SketchArrowOptions = {
  /** The line's width, px. */
  strokePx: number;
  /** The head preset and shape, sized like the marker: `ARROWHEAD_SIZE_PX[size]` line widths long. */
  headSize: ArrowheadSize;
  headShape: ArrowheadShape;
  /** Which ends carry a head. */
  startHead: boolean;
  endHead: boolean;
  /** One pass while a flow animation runs, so its dash and draw maths hold. */
  passes: 1 | 2;
};

/** A sketched arrow: its line, and its heads when their shape is redrawn (`heads` empty otherwise, the
 *  caller keeps the markers). Null for a line too short to sketch. */
export function sketchArrow(
  id: string,
  pathD: string,
  o: SketchArrowOptions,
): { line: string; heads: string; sketchedHeads: boolean } | null {
  const tangents = pathEndTangents(pathD);
  if (!tangents) return null;
  const seed = sketchSeed(id);
  const line = sketchStrokes(outlineOfPath(pathD), seed, o.passes);
  const sketchedHeads = SKETCHED_HEAD_SHAPES.has(o.headShape);
  if (!sketchedHeads) return { line, heads: '', sketchedHeads };
  // The marker's tip sits a tenth of its length past the path's end (refX 9 of a 10-unit box).
  const length = ARROWHEAD_SIZE_PX[o.headSize] * o.strokePx;
  const head = (at: { x: number; y: number }, dir: { x: number; y: number }, s: number) =>
    sketchArrowHead(
      { x: at.x + dir.x * length * 0.1, y: at.y + dir.y * length * 0.1 },
      dir,
      length,
      s,
    );
  const heads = [
    o.startHead ? head(tangents.start.at, tangents.start.dir, seed + 1) : '',
    o.endHead ? head(tangents.end.at, tangents.end.dir, seed + 2) : '',
  ]
    .filter(Boolean)
    .join(' ');
  return { line, heads, sketchedHeads };
}
