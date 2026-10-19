// Outlines drawn on purpose in their finish (docs/specs/008-canvas/finish.md "Polygons and paths"): a Polygon-tool
// outline (docs/specs/008-canvas/polygon-tool.md), placed point by point, and a Path-tool curve
// (docs/specs/023-draw-mode/path-tool.md), placed node by node, are drawings like a shape's outline, not a hand's
// stroke, so they follow their finish as a shape does. Pen strokes, the highlighter and smoothed pencil strokes are
// already hand-drawn and stay as drawn.
import { BORDER_DASH_ARRAY, BORDER_STROKE_PX, DEFAULT_BORDER_STYLE } from './border-style';
import { MARKER_LINE_PX, finishBorderStroke, type Finish } from './finish';
import { freehandCanvasPoints } from './freehand-points';
import type { FreehandElement, PathElement } from './index';
import { isCompoundPath, pathElementD } from './path-element';
import { markerColouring, markerStrokes } from './marker';
import type { MarkerDrawing } from './marker-element';
import { isPenStroke } from './pen-stroke';
import {
  outlineOfPath,
  outlineOfPolygon,
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

/** A Path-tool curve drawn by hand, in its own px box, or null when its finish draws it as it is. Its line and its
 *  shading only: the path keeps its own fill (PathSvg, svgPathElementShape), so a combined shape's holes still show
 *  through, and a combined shape is not shaded (shading across a hole would fill it). */
export function handDrawnPathPaint(el: PathElement, finish: Finish, fill: string): HandDrawnOutline | null {
  if ((finish !== 'sketch' && finish !== 'marker') || el.nodes.length < 2) return null;
  const outline = outlineOfPath(pathElementD(el, { x: 0, y: 0 }));
  if (outline.segments.length === 0) return null;
  const seed = sketchSeed(el.id);
  const strokePx = polygonStrokePx({ strokeWidth: el.strokeWidth }, finish);
  const dash = BORDER_DASH_ARRAY[el.strokeStyle ?? DEFAULT_BORDER_STYLE] ?? null;
  const area =
    el.closed && !isCompoundPath(el) && fill !== 'transparent' && fill !== 'none' ? outline.area : null;
  if (finish === 'marker') {
    const colouring = area ? markerColouring(area, seed) : null;
    return {
      drawing: {
        pen: 'marker',
        ink: markerStrokes(outline, seed),
        details: '',
        solid: '',
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
      hatch: area ? sketchHatching(area, seed, strokePx) : '',
      solid: '',
    },
    strokePx,
    dash,
  };
}
