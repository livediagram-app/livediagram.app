// Whiteboard ink to livediagram strokes (docs/specs/020-import-export/blueprints/whiteboard-import.md "Ink").
// Whiteboard renders a stroke as `g.inkStroke` holding a filled OUTLINE path;
// thin strokes also carry their centreline in a hidden
// `polyline.inkHitTestOverlay` (docs/research/migration-readiness.md E-5).
// A centreline becomes an editable pen stroke; an outline alone is kept as a
// filled shape that looks the same.

import {
  BORDER_STROKE_PX,
  createFreehand,
  type BorderStroke,
  type FreehandElement,
} from '@livediagram/diagram';
import type { BoardItem } from './canvas';
import { readColour, type Colour } from './colour';
import {
  WHITEBOARD_BEZIER_STEP_PX,
  WHITEBOARD_CLAMP_WARN_PX,
  WHITEBOARD_MAX_WIDTH_PX,
  WHITEBOARD_MIN_WIDTH_PX,
} from './limits';
import { apply, compose, type Matrix, type Point } from './matrix';
import { innerMatrix, inlineStyle } from './placement';
import { flattenPath } from './svg-path';

export type InkPen = 'pen' | 'highlighter';

export type InkStroke = {
  /** Each closed outline sub-path, in board px. */
  outline: Point[][];
  /** The drawn line, in board px; null when the export does not carry it. */
  centreline: Point[] | null;
  widthPx: number;
  colour: Colour;
  pen: InkPen;
  /** A pattern-filled effect pen (galaxy, rainbow): its colour is not recoverable. */
  effect: boolean;
};

export type InkDegradation = 'ink-outline' | 'width-clamped' | 'effect-pen';

const BLACK = '#000000';

const polygonArea = (pts: Point[]) => {
  let twice = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % pts.length]!;
    twice += a.x * b.y - b.x * a.y;
  }
  return Math.abs(twice) / 2;
};

const pathLength = (pts: Point[], closed: boolean) => {
  let sum = 0;
  const n = closed ? pts.length : pts.length - 1;
  for (let i = 0; i < n; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % pts.length]!;
    sum += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return sum;
};

const clampWidth = (w: number) =>
  Number.isFinite(w) ? Math.min(WHITEBOARD_MAX_WIDTH_PX, Math.max(WHITEBOARD_MIN_WIDTH_PX, w)) : 1;

// An outline with round caps has area A = w·L + π·w²/4 around a centreline of
// length L; solved for w.
function widthFromCentreline(area: number, length: number): number {
  if (length <= 0) return clampWidth(2 * Math.sqrt(area / Math.PI));
  return clampWidth((-length + Math.sqrt(length * length + Math.PI * area)) / (Math.PI / 2));
}

// Without the centreline, the outline's perimeter P = 2·L + π·w, so
// π·w²/4 − P·w/2 + A = 0; the smaller root is the stroke's width.
function widthFromOutline(area: number, perimeter: number): number {
  const disc = (perimeter * perimeter) / 4 - Math.PI * area;
  return clampWidth((perimeter / 2 - Math.sqrt(Math.max(0, disc))) / (Math.PI / 2));
}

function fillOf(path: Element): string | null {
  return path.getAttribute('fill') ?? inlineStyle(path).get('fill') ?? null;
}

function readPoints(text: string): Point[] {
  const nums = text
    .trim()
    .split(/[\s,]+/)
    .filter((t) => t !== '')
    .map(Number);
  const out: Point[] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) {
    if (!Number.isFinite(nums[i]) || !Number.isFinite(nums[i + 1])) break;
    out.push({ x: nums[i]!, y: nums[i + 1]! });
  }
  return out;
}

function readStroke(g: Element, item: BoardItem, unknown: string[]): InkStroke | null {
  const paths = [...g.querySelectorAll('path')];
  const last = paths.at(-1);
  if (!last) return null;
  const inner = innerMatrix(last, item.anchor);
  unknown.push(...inner.unknown);
  const toBoard: Matrix = compose(item.matrix, inner.matrix);
  const outline = paths
    .flatMap((p) => flattenPath(p.getAttribute('d') ?? '', WHITEBOARD_BEZIER_STEP_PX))
    .map((sub) => sub.points.map((pt) => apply(toBoard, pt)))
    .filter((pts) => pts.length >= 3);
  if (outline.length === 0) return null;

  const polyline = g.querySelector('polyline.inkHitTestOverlay');
  const centrelineLocal = polyline ? readPoints(polyline.getAttribute('points') ?? '') : [];
  let centreline: Point[] | null = null;
  if (polyline && centrelineLocal.length > 0) {
    const polyToBoard = compose(item.matrix, innerMatrix(polyline, item.anchor).matrix);
    centreline = centrelineLocal.map((pt) => apply(polyToBoard, pt));
  }

  const area = outline.reduce((sum, pts) => sum + polygonArea(pts), 0);
  const widthPx = centreline
    ? widthFromCentreline(area, pathLength(centreline, false))
    : widthFromOutline(
        area,
        outline.reduce((sum, pts) => sum + pathLength(pts, true), 0),
      );

  const fill = fillOf(last) ?? '';
  const effect = fill.startsWith('url(');
  const opacity = Number(last.getAttribute('opacity') ?? '1');
  const colour: Colour = effect
    ? { hex: BLACK, alpha: Number.isFinite(opacity) ? opacity : 1 }
    : (readColour(fill) ?? { hex: BLACK, alpha: 1 });
  const blend = inlineStyle(g).get('mix-blend-mode');
  return {
    outline,
    centreline,
    widthPx,
    colour,
    pen: blend === 'darken' ? 'highlighter' : 'pen',
    effect,
  };
}

/** Every ink stroke of one board item, in board px, in drawing order. */
export function readInkStrokes(item: BoardItem): { strokes: InkStroke[]; unknown: string[] } {
  const unknown: string[] = [];
  const strokes = [...item.anchor.querySelectorAll('g.inkStroke')]
    .map((g) => readStroke(g, item, unknown))
    .filter((s): s is InkStroke => s !== null);
  return { strokes, unknown };
}

/** The nearest border preset to a width in px; a tie takes the thinner (D42). */
export function nearestStroke(widthPx: number): BorderStroke {
  let best: BorderStroke = 'thin';
  for (const preset of ['thin', 'medium', 'thick', 'extra-thick'] as const) {
    if (Math.abs(BORDER_STROKE_PX[preset] - widthPx) < Math.abs(BORDER_STROKE_PX[best] - widthPx)) {
      best = preset;
    }
  }
  return best;
}

// A stroke that never moved is still a mark: a dot as long as it is wide.
function dotted(points: Point[], widthPx: number): Point[] {
  const first = points[0]!;
  const moved = points.some((p) => p.x !== first.x || p.y !== first.y);
  if (moved) return points;
  return [first, { x: first.x + Math.max(1, widthPx / 2), y: first.y }];
}

const withOpacity = (alpha: number) => (alpha < 1 ? { opacity: alpha } : {});

/** The livediagram elements for one stroke and what was lost on the way. */
export function inkStrokeElements(stroke: InkStroke): {
  elements: FreehandElement[];
  degraded: InkDegradation[];
} {
  const degraded: InkDegradation[] = [];
  if (stroke.effect) degraded.push('effect-pen');
  const { hex, alpha } = stroke.colour;

  if (!stroke.centreline) {
    degraded.push('ink-outline');
    const elements = stroke.outline.map((pts): FreehandElement => ({
      ...createFreehand(pts, true),
      straightEdges: true,
      fillColor: hex,
      strokeColor: hex,
      strokeWidth: 'thin',
      ...withOpacity(alpha),
    }));
    return { elements, degraded };
  }

  const base = createFreehand(dotted(stroke.centreline, stroke.widthPx), false);
  if (stroke.pen === 'highlighter') {
    const element: FreehandElement = {
      ...base,
      pen: 'highlighter',
      penWidth: Math.round(stroke.widthPx),
      strokeColor: hex,
    };
    return { elements: [element], degraded };
  }
  if (stroke.widthPx > WHITEBOARD_CLAMP_WARN_PX) degraded.push('width-clamped');
  const element: FreehandElement = {
    ...base,
    strokeColor: hex,
    strokeWidth: nearestStroke(stroke.widthPx),
    ...withOpacity(alpha),
  };
  return { elements: [element], degraded };
}
