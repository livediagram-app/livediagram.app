// Outlines drawn on purpose in their finish (docs/specs/008-canvas/finish.md "Polygons"): a Polygon-tool
// outline (docs/specs/008-canvas/polygon-tool.md), placed point by point, is a drawing like a shape's outline, not a
// hand's stroke, so it follows its finish as a shape does. Pen strokes and smoothed pencil strokes are already
// hand-drawn and stay as drawn.
import {
  BORDER_DASH_ARRAY,
  BORDER_STROKE_PX,
  DEFAULT_BORDER_STYLE,
  IMAGE_DEFAULT_RADIUS_PX,
  cornerRadiusPx,
} from './border-style';
import { MARKER_LINE_PX, finishBorderStroke, finishCornerFallbackPx, type Finish } from './finish';
import { freehandCanvasPoints } from './freehand-points';
import type { FreehandElement, ImageElement } from './index';
import { markerColouring, markerStrokes } from './marker';
import type { MarkerDrawing } from './marker-element';
import { isPenStroke } from './pen-stroke';
import {
  outlineOfEllipse,
  outlineOfPolygon,
  outlineOfRect,
  sketchAreaPath,
  sketchHatching,
  sketchSeed,
  sketchStrokes,
  type Pt,
  type SketchOutline,
} from './sketch';
import type { SketchDrawing } from './sketch-element';

/** Whether a freehand is a Polygon-tool outline: straight edges, not a pen stroke or the highlighter. */
export function isPolygonOutline(el: FreehandElement): boolean {
  return !!el.straightEdges && !isPenStroke(el) && el.pen !== 'highlighter';
}

/** A drawn outline's line width in its finish, px: a width of its own (a recorded pen width, a picked border)
 *  wins; unset draws Professional's Thin, and Marker's nib for unset or Thin. */
export function polygonStrokePx(
  el: Pick<FreehandElement, 'penWidth' | 'strokeWidth'>,
  finish: Finish,
): number {
  if (el.penWidth !== undefined) return el.penWidth;
  if (finish === 'marker' && (!el.strokeWidth || el.strokeWidth === 'thin')) return MARKER_LINE_PX;
  return BORDER_STROKE_PX[finishBorderStroke(el.strokeWidth, finish)];
}

// The outline in the element's own px box: closed, one stroke per edge round the area; open, one per edge.
function polygonOutline(el: FreehandElement): SketchOutline | null {
  const pts: Pt[] = freehandCanvasPoints({ ...el, x: 0, y: 0 });
  if (pts.length < 2) return null;
  if (el.closed && pts.length >= 3) return outlineOfPolygon(pts);
  return {
    segments: pts.slice(1).map((to, i) => ({ kind: 'line' as const, from: pts[i]!, to })),
    area: null,
  };
}

/** A polygon outline drawn by hand (Sketch's pencil or Marker's felt-tip), in its own px box, or null when its
 *  finish draws it as it is or it is not a polygon outline. `fill` is the resolved fill, used only when closed. */
export function handDrawnPolygonPaint(
  el: FreehandElement,
  finish: Finish,
  fill: string,
):
  | { drawing: SketchDrawing; strokePx: number; dash: string | null }
  | { drawing: MarkerDrawing; strokePx: number; dash: string | null }
  | null {
  if ((finish !== 'sketch' && finish !== 'marker') || !isPolygonOutline(el)) return null;
  const outline = polygonOutline(el);
  if (!outline) return null;
  const seed = sketchSeed(el.id);
  const strokePx = polygonStrokePx(el, finish);
  const dash = BORDER_DASH_ARRAY[el.strokeStyle ?? DEFAULT_BORDER_STYLE] ?? null;
  const filled = !!outline.area && fill !== 'transparent' && fill !== 'none';
  const solid = filled ? sketchAreaPath(outline.area!) : '';
  if (finish === 'marker') {
    const colouring = filled ? markerColouring(outline.area!, seed) : null;
    return {
      drawing: {
        pen: 'marker',
        ink: markerStrokes(outline, seed),
        details: '',
        solid,
        streaks: colouring?.streaks ?? ['', ''],
        nibPx: colouring?.nibPx ?? 0,
      },
      strokePx,
      dash,
    };
  }
  return {
    drawing: {
      pen: 'pencil',
      strokes: sketchStrokes(outline, seed),
      details: '',
      hatch: filled ? sketchHatching(outline.area!, seed, strokePx) : '',
      solid,
    },
    strokePx,
    dash,
  };
}

type HandDrawnOutline =
  | { drawing: SketchDrawing; strokePx: number; dash: string | null }
  | { drawing: MarkerDrawing; strokePx: number; dash: string | null };

/** An image's corner in its finish: its own, else the image default, square under Professional. */
export function imageCornerPx(
  el: Pick<ImageElement, 'borderRadius' | 'width' | 'height'>,
  finish: Finish,
): number {
  return cornerRadiusPx(
    el.borderRadius,
    el.width,
    el.height,
    finishCornerFallbackPx(IMAGE_DEFAULT_RADIUS_PX, finish),
  );
}

/** An image's edge drawn by hand (docs/specs/008-canvas/finish.md "Images"): the photo stays as it is, a pencil or a
 *  marker line goes round it, a circle round an avatar. Line only, no fill: null in another finish. */
export function handDrawnImagePaint(el: ImageElement, finish: Finish): HandDrawnOutline | null {
  if (finish !== 'sketch' && finish !== 'marker') return null;
  const strokePx = polygonStrokePx({ strokeWidth: el.strokeWidth }, finish);
  const inset = strokePx / 2;
  const w = el.width - strokePx;
  const h = el.height - strokePx;
  if (w <= 0 || h <= 0) return null;
  const outline =
    el.borderRadius === 'full'
      ? outlineOfEllipse(el.width / 2, el.height / 2, w / 2, h / 2)
      : outlineOfRect(inset, inset, w, h, Math.max(0, imageCornerPx(el, finish) - inset));
  const seed = sketchSeed(el.id);
  const dash = BORDER_DASH_ARRAY[el.strokeStyle ?? DEFAULT_BORDER_STYLE] ?? null;
  if (finish === 'marker')
    return {
      drawing: {
        pen: 'marker',
        ink: markerStrokes(outline, seed),
        details: '',
        solid: '',
        streaks: ['', ''],
        nibPx: 0,
      },
      strokePx,
      dash,
    };
  return {
    drawing: {
      pen: 'pencil',
      strokes: sketchStrokes(outline, seed),
      details: '',
      hatch: '',
      solid: '',
    },
    strokePx,
    dash,
  };
}
