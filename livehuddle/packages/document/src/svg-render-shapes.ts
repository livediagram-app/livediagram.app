// Headless SVG emitters for the shape silhouettes and freehand sketches the
// generic renderer used to flatten into plain rectangles. The silhouettes
// come from the shared geometry table (shape-geometry.ts), the same data the
// editor's ShapeSvgOverlay draws from, mapped into the element box
// (svg-shape-fit.ts) with the same fit the canvas uses (stretched for most,
// `meet` for the proportional actor), so they match it at any aspect ratio
// without a scaled stroke. A silhouette changes in the table, never here.
import { BORDER_DASH_ARRAY, BORDER_STROKE_PX } from '@liveworkspace/model-core/border-style';
import { actorFigureRect } from './actor-figure';
import { finishBorderStroke, type Finish } from './finish';
import type { BoxedElement, FreehandElement, PathElement, ShapeKind } from './index';
import { isCompoundPath, pathElementD } from './path-element';
import { r2, xmlEscape } from './svg-render-primitives';
import { boxFit, fitShapePart } from './svg-shape-fit';
import { catmullRomToBezierPath } from './polyline';
import { freehandPenStroke, isPenStroke, penStrokePath } from './pen-stroke';
import { isFilledPenLoop, penLoopFillPath } from './stroke-loop-fill';
import { freehandCanvasPoints, freehandStrokePoints } from './freehand-points';
import { isPolygonOutline, polygonStrokePx } from './drawn-outline-finish';
import {
  SHAPE_DETAIL_STROKE_PX,
  shapeGeometry,
  type ShapePart,
  type ShapePartRole,
} from './shape-geometry';

// The kinds this module draws: every kind in the geometry table except the
// diamond, which svgBoxed draws as a native polygon at element coordinates
// (from the same table points, see scaledPolygonPoints). square / circle /
// stadium / browser render natively too (plain rects / ellipses); the
// self-drawing shapes and icons are handled elsewhere.
export function hasShapeSilhouette(kind: string): boolean {
  return kind !== 'diamond' && shapeGeometry(kind as ShapeKind) !== null;
}

// Each role's paint, matching the overlay's props for the same role.
// vector-effect keeps the stroke weight even under the stretched viewBox,
// supported by browsers and resvg alike.
function roleAttrs(
  role: ShapePartRole,
  fill: string,
  stroke: string,
  strokeWidth: number,
  dash?: string,
): string {
  const f = xmlEscape(fill);
  const s = xmlEscape(stroke);
  const d = dash ? ` stroke-dasharray="${dash}"` : '';
  switch (role) {
    case 'main':
      return ` fill="${f}" stroke="${s}" stroke-width="${strokeWidth}"${d} stroke-linejoin="round" vector-effect="non-scaling-stroke"`;
    case 'outline':
      return ` fill="${f}" stroke="${s}" stroke-width="${strokeWidth}"${d} vector-effect="non-scaling-stroke"`;
    case 'detail':
      return ` fill="none" stroke="${s}" stroke-width="${SHAPE_DETAIL_STROKE_PX}" stroke-linejoin="round" vector-effect="non-scaling-stroke"`;
    case 'limb':
    case 'head':
      return ` fill="${role === 'head' ? f : 'none'}" stroke="${s}" stroke-width="${strokeWidth}"${d} stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"`;
  }
}

// One table part as markup, in its viewBox space.
function svgShapePart(
  part: ShapePart,
  fill: string,
  stroke: string,
  strokeWidth: number,
  dash?: string,
): string {
  const paint = roleAttrs(part.role, fill, stroke, strokeWidth, dash);
  switch (part.tag) {
    case 'path':
      return `<path d="${part.d}"${paint}/>`;
    case 'polygon':
      return `<polygon points="${part.points}"${paint}/>`;
    case 'rect':
      return (
        `<rect x="${r2(part.x)}" y="${r2(part.y)}" width="${r2(part.width)}" height="${r2(part.height)}"` +
        `${part.rx !== undefined ? ` rx="${r2(part.rx)}"` : ''}` +
        `${part.ry !== undefined ? ` ry="${r2(part.ry)}"` : ''}${paint}/>`
      );
    case 'ellipse':
      return `<ellipse cx="${r2(part.cx)}" cy="${r2(part.cy)}" rx="${r2(part.rx)}" ry="${r2(part.ry)}"${paint}/>`;
    case 'circle':
      return `<circle cx="${r2(part.cx)}" cy="${r2(part.cy)}" r="${r2(part.r)}"${paint}/>`;
  }
}

// A table polygon's 0..100 points mapped into an element box, for the kinds
// drawn natively at element coordinates rather than as a nested <svg>.
export function scaledPolygonPoints(
  points: string,
  x: number,
  y: number,
  width: number,
  height: number,
): string {
  return points
    .split(' ')
    .map((pt) => {
      const [px, py] = pt.split(',').map(Number) as [number, number];
      return `${r2(x + (px / 100) * width)},${r2(y + (py / 100) * height)}`;
    })
    .join(' ');
}

// A shape's silhouette as a nested <svg> over the element box, or null when
// the kind renders natively. `fill` / `stroke` are the element's resolved
// colours; the border presets ride along like the editor.
export function svgShapeSilhouette(
  el: BoxedElement & { type: 'shape' },
  fill: string,
  stroke: string,
  finish: Finish = 'flexible',
): string | null {
  if (!hasShapeSilhouette(el.shape)) return null;
  const geometry = shapeGeometry(el.shape);
  if (!geometry) return null;
  const strokeWidth = BORDER_STROKE_PX[finishBorderStroke(el.strokeWidth, finish)] || 2;
  const dash = BORDER_DASH_ARRAY[el.strokeStyle ?? 'solid'] ?? undefined;
  // Mapped into the box rather than nested in a stretched <svg>, so no
  // renderer scales the stroke (svg-shape-fit.ts).
  // A stroke-inside silhouette lands in the box inset by half the stroke, so
  // its outline stays inside the box like the canvas overlay's.
  const inset = geometry.strokeInside ? strokeWidth / 2 : 0;
  // An actor's figure has its own rect, clear of its name (actor-figure.ts).
  const area =
    el.shape === 'actor' ? actorFigureRect(el) : { x: 0, y: 0, width: el.width, height: el.height };
  const fit = boxFit(geometry, {
    x: el.x + area.x + inset,
    y: el.y + area.y + inset,
    width: Math.max(0, area.width - 2 * inset),
    height: Math.max(0, area.height - 2 * inset),
  });
  return `<g data-silhouette="${el.shape}">${geometry.parts
    .map((part) => svgShapePart(fitShapePart(part, fit), fill, stroke, strokeWidth, dash))
    .join('')}</g>`;
}

// A freehand sketch's real path (normalised points scaled to the box), drawn
// the way FreehandSvg draws it on the canvas: a pen stroke through the same
// Catmull-Rom smoothing, a polygon-tool path (docs/specs/008-canvas/polygon-tool.md) with its straight
// edges, and nothing for a lone point. Closed paths fill like the canvas;
// open ones render stroke-only.
export function svgFreehandShape(
  el: FreehandElement,
  stroke: string,
  fill: string,
  finish: Finish = 'flexible',
): string {
  if (freehandStrokePoints(el).count < 2) return '';
  // A whiteboard pen stroke (docs/specs/023-draw-mode/draw-mode.md "Pens"): the filled
  // perfect-freehand outline FreehandSvg draws, from the same function (pen-stroke.ts).
  if (isPenStroke(el)) {
    const ink = penStrokePath(freehandPenStroke(el, { x: el.x, y: el.y }), r2);
    // A marker loop the Fill tool closed (docs/specs/023-draw-mode/fill-tool.md "Export"): its fill
    // under its ink, along the centre line, as the canvas draws it.
    const under = isFilledPenLoop(el)
      ? `<path d="${penLoopFillPath(el, r2)}" fill="${xmlEscape(fill)}" stroke="none"/>`
      : '';
    return `${under}<path d="${ink}" fill="${xmlEscape(stroke)}" stroke="none"/>`;
  }
  const pts = freehandCanvasPoints(el);
  const d = el.straightEdges
    ? pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${r2(p.x)} ${r2(p.y)}`).join(' ') +
      (el.closed ? ' Z' : '')
    : catmullRomToBezierPath(pts, el.closed, r2);
  // Highlighter recipe (docs/specs/008-canvas/highlighter.md): the marker owns width + translucency
  // (a fixed wide round stroke, multiply blend, never filled); the
  // border presets don't apply. Mirrors FreehandSvg in the editor so
  // thumbnails / MCP renders match the canvas.
  if (el.pen === 'highlighter') {
    return (
      `<path d="${d}" fill="none" stroke="${xmlEscape(stroke)}" stroke-width="${r2(el.penWidth ?? 14)}"` +
      ` stroke-opacity="0.45" style="mix-blend-mode:multiply"` +
      ` stroke-linecap="round" stroke-linejoin="round"/>`
    );
  }
  // A recorded pen width (a whiteboard pen, docs/specs/023-draw-mode/draw-mode.md) wins over the preset; a
  // Polygon-tool outline's unset width follows its finish (Professional's Thin).
  const strokeWidth = isPolygonOutline(el)
    ? polygonStrokePx(el, finish)
    : (el.penWidth ??
      (BORDER_STROKE_PX[
        (el as { strokeWidth?: keyof typeof BORDER_STROKE_PX }).strokeWidth ?? 'medium'
      ] ||
        2));
  const dash =
    BORDER_DASH_ARRAY[
      (el as { strokeStyle?: keyof typeof BORDER_DASH_ARRAY }).strokeStyle ?? 'solid'
    ] ?? undefined;
  const fillAttr = el.closed && fill !== 'transparent' ? xmlEscape(fill) : 'none';
  return (
    `<path d="${d}" fill="${fillAttr}" stroke="${xmlEscape(stroke)}" stroke-width="${strokeWidth}"` +
    `${dash ? ` stroke-dasharray="${dash}"` : ''} stroke-linecap="round" stroke-linejoin="round"/>`
  );
}

// A path (docs/specs/023-draw-mode/path-tool.md): the headless twin of the canvas PathSvg, the same
// curve from the same function at the border preset width, filled only when closed.
export function svgPathElementShape(
  el: PathElement,
  stroke: string,
  fill: string,
  finish: Finish = 'flexible',
): string {
  if (el.nodes.length < 2) return '';
  const d = pathElementD(el, undefined, r2);
  // An unset width follows the finish (Professional's Thin).
  const width = polygonStrokePx({ strokeWidth: el.strokeWidth }, finish);
  const dash = BORDER_DASH_ARRAY[el.strokeStyle ?? 'solid'];
  const fillAttr = el.closed && fill !== 'transparent' ? xmlEscape(fill) : 'none';
  // A combined shape's holes show through (docs/specs/007-editor/editor-modes.md "Pages moved to livedocuments").
  const rule = isCompoundPath(el) ? ' fill-rule="evenodd"' : '';
  return (
    `<path d="${d}" fill="${fillAttr}"${rule} stroke="${xmlEscape(stroke)}" stroke-width="${width}"` +
    `${dash ? ` stroke-dasharray="${dash}"` : ''} stroke-linecap="round" stroke-linejoin="round"/>`
  );
}
