// A whiteboard shape's hit outline (docs/specs/023-draw-mode/draw-mode.md
// "Selecting" and "Eraser"): the line the shape is drawn with, as polylines in
// the element's local, unrotated px (0..width, 0..height), plus the regions a
// visible fill covers. Selecting draws these polylines as the shape's
// invisible hit path; the eraser measures its brush against the same
// polylines, so a click and a brush agree on what counts as the shape.
//
// The drawn kinds read the shared shape-geometry table fitted into the box
// exactly as ShapeSvgOverlay draws it; the CSS-drawn kinds (square, circle,
// stadium, browser, page) trace their border's centre line, half the border
// width inside the box, with the corner radius the CSS gives them. A kind that
// paints its own face (a chart, a panel, a web component, an icon) is its box.
// Pure; no DOM.

import { BORDER_STROKE_PX, DEFAULT_BORDER_STROKE, cornerRadiusPx } from './border-style';
import { actorFigureRect } from './actor-figure';
import { defaultFillColor } from './colors';
import { rotatePoint, type Point } from './geometry-primitives';
import type { Element, ShapeElement } from './index';
import {
  BROWSER_CHROME,
  SHAPE_GEOMETRY_KINDS,
  shapeGeometry,
  type ShapePart,
  type ShapePartRole,
} from './shape-geometry';
import type { ShapeKind } from './shape-kind';
import { boxFit } from './svg-shape-fit';
import { PATH_ARC_SEGMENTS, svgPathSubpaths } from './svg-path-outline';
import { insidePolygon, segmentDistance } from './whiteboard-stroke';

export type HitLine = { readonly points: readonly Point[]; readonly closed: boolean };

export type ShapeHitOutline = {
  // Every drawn line, as the shape draws it.
  lines: readonly HitLine[];
  // The closed regions a visible fill paints; empty when the fill is not visible.
  fills: readonly (readonly Point[])[];
  // Half the drawn line's width, in canvas px.
  halfWidth: number;
};

// The CSS-drawn kinds whose whole drawing is their border.
const CSS_OUTLINE_KINDS: ReadonlySet<ShapeKind> = new Set<ShapeKind>([
  'square',
  'circle',
  'stadium',
  'browser',
  'page',
]);
const DRAWN_KINDS: ReadonlySet<ShapeKind> = new Set(SHAPE_GEOMETRY_KINDS);
// The corner a CSS-drawn box gets with no radius of its own (element-variant.ts).
const CSS_DEFAULT_RADIUS_PX = 8;
// The parts that take the element's fill (shape-geometry.ts roles).
const FILLED_ROLES: ReadonlySet<ShapePartRole> = new Set<ShapePartRole>([
  'main',
  'outline',
  'head',
]);
// No drawn outline reaches further from the centre than this many half
// diagonals of its box (the speech bubble's tail hangs to 120% of the height),
// so a brush beyond it is skipped without building the outline.
const OUTLINE_REACH_FACTOR = 1.5;

/** Whether the whiteboard picks this element by its drawn outline rather than its box. */
export function pickedByOutline(el: Element): el is ShapeElement {
  return el.type === 'shape' && (CSS_OUTLINE_KINDS.has(el.shape) || DRAWN_KINDS.has(el.shape));
}

/** Whether the shape's fill paints anything: an explicit colour, or a theme default that does. */
export function hasVisibleFill(el: ShapeElement): boolean {
  const fill = el.fillColor ?? defaultFillColor(el);
  return fill !== 'transparent' && fill !== 'none' && fill !== '';
}

function strokePx(el: ShapeElement): number {
  return BORDER_STROKE_PX[el.strokeWidth ?? DEFAULT_BORDER_STROKE];
}

// A rectangle with elliptical corners, clockwise from the top edge.
function roundedRect(x: number, y: number, w: number, h: number, rxIn: number, ryIn: number) {
  const rx = Math.max(0, Math.min(rxIn, w / 2));
  const ry = Math.max(0, Math.min(ryIn, h / 2));
  if (rx === 0 || ry === 0) {
    return [
      { x, y },
      { x: x + w, y },
      { x: x + w, y: y + h },
      { x, y: y + h },
    ];
  }
  const quarter = PATH_ARC_SEGMENTS / 2;
  const corners: [number, number, number][] = [
    [x + w - rx, y + ry, -Math.PI / 2],
    [x + w - rx, y + h - ry, 0],
    [x + rx, y + h - ry, Math.PI / 2],
    [x + rx, y + ry, Math.PI],
  ];
  return corners.flatMap(([cx, cy, from]) =>
    Array.from({ length: quarter + 1 }, (_, i) => {
      const a = from + (Math.PI / 2) * (i / quarter);
      return { x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) };
    }),
  );
}

function ellipse(cx: number, cy: number, rx: number, ry: number): Point[] {
  const n = PATH_ARC_SEGMENTS * 2;
  return Array.from({ length: n }, (_, i) => {
    const a = (2 * Math.PI * i) / n;
    return { x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) };
  });
}

// A table part's lines in its own viewBox units.
function partLines(part: ShapePart): HitLine[] {
  switch (part.tag) {
    case 'path':
      return svgPathSubpaths(part.d) ?? [];
    case 'polygon':
      return [
        {
          closed: true,
          points: part.points
            .trim()
            .split(/\s+/)
            .map((pt) => {
              const [x, y] = pt.split(',').map(Number) as [number, number];
              return { x, y };
            }),
        },
      ];
    case 'rect':
      return [
        {
          closed: true,
          points: roundedRect(
            part.x,
            part.y,
            part.width,
            part.height,
            part.rx ?? 0,
            part.ry ?? part.rx ?? 0,
          ),
        },
      ];
    case 'ellipse':
      return [{ closed: true, points: ellipse(part.cx, part.cy, part.rx, part.ry) }];
    case 'circle':
      return [{ closed: true, points: ellipse(part.cx, part.cy, part.r, part.r) }];
  }
}

// A drawn kind: every part of its table geometry, fitted into the box as drawn.
function drawnOutline(el: ShapeElement, filled: boolean): Omit<ShapeHitOutline, 'halfWidth'> {
  const geometry = shapeGeometry(el.shape, el.width / el.height);
  if (!geometry) return { lines: [], fills: [] };
  const area =
    el.shape === 'actor' ? actorFigureRect(el) : { x: 0, y: 0, width: el.width, height: el.height };
  const fit = boxFit(geometry, area);
  const place = (p: Point): Point => ({ x: fit.ox + p.x * fit.sx, y: fit.oy + p.y * fit.sy });
  const lines: HitLine[] = [];
  const fills: Point[][] = [];
  for (const part of geometry.parts) {
    for (const line of partLines(part)) {
      const placed = { closed: line.closed, points: line.points.map(place) };
      lines.push(placed);
      if (filled && placed.closed && FILLED_ROLES.has(part.role)) fills.push(placed.points);
    }
  }
  return { lines, fills };
}

// A CSS-drawn kind: its border's centre line, half the border inside the box.
function cssOutline(el: ShapeElement, filled: boolean): Omit<ShapeHitOutline, 'halfWidth'> {
  const inset = strokePx(el) / 2;
  const w = Math.max(0, el.width - 2 * inset);
  const h = Math.max(0, el.height - 2 * inset);
  let ring: Point[];
  if (el.shape === 'circle') {
    ring = ellipse(el.width / 2, el.height / 2, w / 2, h / 2);
  } else {
    // CSS clamps a radius to half the box; the border's centre line runs inside it.
    const outer =
      el.shape === 'stadium'
        ? Infinity
        : cornerRadiusPx(el.borderRadius, el.width, el.height, CSS_DEFAULT_RADIUS_PX);
    const r = Math.max(0, Math.min(outer, el.width / 2, el.height / 2) - inset);
    ring = roundedRect(inset, inset, w, h, r, r);
  }
  const lines: HitLine[] = [{ closed: true, points: ring }];
  // The browser's chrome strip ends in a 1px rule (boxed-element-overlays.tsx BrowserChrome).
  const rule = 2 * inset + BROWSER_CHROME.heightPx - 0.5;
  if (el.shape === 'browser' && rule < el.height) {
    lines.push({
      closed: false,
      points: [
        { x: 2 * inset, y: rule },
        { x: el.width - 2 * inset, y: rule },
      ],
    });
  }
  return { lines, fills: filled ? [ring] : [] };
}

const outlines = new WeakMap<ShapeElement, ShapeHitOutline>();

/** The shape's hit outline in its local, unrotated px. A kind that paints its own face is its box, filled. */
export function shapeHitOutline(el: ShapeElement): ShapeHitOutline {
  const known = outlines.get(el);
  if (known) return known;
  let outline: ShapeHitOutline;
  if (!pickedByOutline(el) || el.width <= 0 || el.height <= 0) {
    const box = roundedRect(0, 0, Math.max(el.width, 0), Math.max(el.height, 0), 0, 0);
    outline = { lines: [{ closed: true, points: box }], fills: [box], halfWidth: 0 };
  } else {
    const filled = hasVisibleFill(el);
    const parts = CSS_OUTLINE_KINDS.has(el.shape)
      ? cssOutline(el, filled)
      : drawnOutline(el, filled);
    outline = { ...parts, halfWidth: strokePx(el) / 2 };
  }
  outlines.set(el, outline);
  return outline;
}

const round = (v: number) => Math.round(v * 100) / 100;

/** The lines as one SVG path `d`, each a subpath, the closed ones closed. */
export function hitOutlinePathData(lines: readonly HitLine[]): string {
  return lines
    .filter((line) => line.points.length > 0)
    .map(
      (line) =>
        line.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${round(p.x)} ${round(p.y)}`).join(' ') +
        (line.closed ? ' Z' : ''),
    )
    .join(' ');
}

/**
 * True when a brush of radius `r` swept from `a` to `b` (canvas coords) touches
 * the shape where it is drawn: within `r` of its line, or on its visible fill.
 */
export function shapeTouchesBrush(el: ShapeElement, a: Point, b: Point, r: number): boolean {
  const centre = { x: el.x + el.width / 2, y: el.y + el.height / 2 };
  const toLocal = (p: Point): Point => {
    const q = el.rotation ? rotatePoint(p, centre, -el.rotation) : p;
    return { x: q.x - el.x, y: q.y - el.y };
  };
  const la = toLocal(a);
  const lb = toLocal(b);
  const mid = { x: el.width / 2, y: el.height / 2 };
  const bound = (Math.hypot(el.width, el.height) / 2) * OUTLINE_REACH_FACTOR;
  const { lines, fills, halfWidth } = shapeHitOutline(el);
  const reach = r + halfWidth;
  if (segmentDistance(la, lb, mid, mid) > bound + reach) return false;
  for (const { points, closed } of lines) {
    if (points.length === 1 && segmentDistance(la, lb, points[0]!, points[0]!) <= reach) {
      return true;
    }
    const last = closed ? points.length : points.length - 1;
    for (let i = 0; i < last; i++) {
      const next = points[(i + 1) % points.length]!;
      if (segmentDistance(points[i]!, next, la, lb) <= reach) return true;
    }
  }
  return fills.some((fill) => insidePolygon(la, fill) || insidePolygon(lb, fill));
}
