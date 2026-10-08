// The whiteboard pen's ink (docs/specs/023-draw-mode/draw-mode.md "Pens"): perfect-freehand
// (MIT) with pressure, drawn the way Excalidraw draws freedraw. A stroke is its raw points, a
// pressure per point when the pen reported one, its pen width and its streamline; one pure
// function turns that into a filled outline, for the stroke being drawn, the stroke that lands and
// the SVG export alike. `last: true` always, so the stroke being drawn is already the finished one
// and release reshapes nothing. Ink the smoothing has settled never moves as samples arrive: only
// the tip, from the last streamlined point to the pointer with its end cap, reshapes.

import {
  getStrokeOutlinePoints,
  getStrokePoints,
  type StrokeOptions,
  type StrokePoint,
} from 'perfect-freehand';
import type { Point } from './geometry-primitives';
import type { FreehandElement } from './element-types';
import { decodeStrokePoints } from './stroke-points-cache';
import type { NormalisedPoint, StrokePoints } from './stroke-points';

export type PenPointerKind = 'pen' | 'mouse' | 'touch';

// How far perfect-freehand drags each point towards the last: Excalidraw's
// DEFAULT_STROKE_STREAMLINE for a mouse, its precise value for a pen or a finger,
// whose samples are denser and steadier.
export const PEN_STREAMLINE: Readonly<Record<PenPointerKind, number>> = {
  mouse: 0.5,
  pen: 0.2,
  touch: 0.2,
};
// Excalidraw's freedraw recipe: how much pressure thins the line, and how much
// the outline is smoothed.
export const PEN_THINNING = 0.6;
export const PEN_SMOOTHING = 0.5;
// The pressure a stroke without one draws at: every mouse stroke, a finger
// without force, and pen strokes drawn before pressure was recorded.
export const PEN_MID_PRESSURE = 0.5;
// perfect-freehand's END_NOISE_THRESHOLD (canvas px, not exported): it leaves out of the outline
// every point closer than this to the end of the line, so while a stroke is drawn slowly the
// settled points behind the tip dropped out and came back as each sample moved the end. The
// outline cancels it by carrying the last point this much further along the line.
export const PERFECT_FREEHAND_END_NOISE = 3;

const easing = (t: number) => Math.sin((t * Math.PI) / 2);

/** The settings row for a `PointerEvent.pointerType`: anything unknown is a mouse. */
export function penPointerKind(pointerType: string | undefined): PenPointerKind {
  return pointerType === 'pen' || pointerType === 'touch' ? pointerType : 'mouse';
}

/**
 * perfect-freehand's `size` for a pen `width`: its radius at pressure p is
 * `size * easing(0.5 - thinning * (0.5 - p))`, so at the middle pressure the line is
 * `2 * size * easing(0.5)` wide, and that is the preset width.
 */
export function penStrokeSize(width: number): number {
  return width / (2 * easing(PEN_MID_PRESSURE));
}

/** How wide a `width` pen draws at `pressure` (0 to 1): the preset width at the middle pressure. */
export function penPressureWidth(width: number, pressure: number): number {
  return 2 * penStrokeSize(width) * easing(0.5 - PEN_THINNING * (0.5 - pressure));
}

export type PenStroke = {
  points: readonly Point[];
  /** One per point, 0 to 1; absent when the pointer reported none (a constant width). */
  pressures?: ArrayLike<number>;
  /** The pen's width in canvas px at the middle pressure. */
  width: number;
  streamline: number;
};

// Every point carries its pressure explicitly: perfect-freehand would give a
// pressureless FIRST point a quarter, thinning the start of a constant stroke.
// A lone point (a tap) is given twice: alone, perfect-freehand would draw a stub to the point 1 px
// right and down of it; twice, the centre line is that one point and the outline a round dot.
function inputOf(stroke: PenStroke): number[][] {
  const input = stroke.points.map((p, i) => [p.x, p.y, stroke.pressures?.[i] ?? PEN_MID_PRESSURE]);
  return input.length === 1 ? [input[0]!, input[0]!] : input;
}

function optionsOf(stroke: PenStroke): StrokeOptions {
  return {
    size: penStrokeSize(stroke.width),
    thinning: PEN_THINNING,
    smoothing: PEN_SMOOTHING,
    streamline: stroke.streamline,
    easing,
    simulatePressure: false,
    last: true,
  };
}

// The centre line with its end trim cancelled: the last point's running length is the only one
// the outline compares against END_NOISE (no taper reads it), so moving it on by the threshold
// keeps every earlier point in the outline.
function untrimmed(points: StrokePoint[]): StrokePoint[] {
  const last = points[points.length - 1];
  if (!last || points.length < 2) return points;
  return [
    ...points.slice(0, -1),
    { ...last, runningLength: last.runningLength + PERFECT_FREEHAND_END_NOISE },
  ];
}

/** The stroke's outline polygon: perfect-freehand's getStroke, without its end trim. */
export function penStrokeOutline(stroke: PenStroke): Point[] {
  if (stroke.points.length === 0) return [];
  const options = optionsOf(stroke);
  return getStrokeOutlinePoints(untrimmed(getStrokePoints(inputOf(stroke), options)), options).map(
    ([x, y]) => ({ x: x!, y: y! }),
  );
}

/**
 * The outline as a filled SVG path: quadratic curves through the midpoints of the outline's
 * points, closed (Excalidraw's getSvgPathFromStroke). `fmt` shapes every number written.
 */
export function penStrokePath(stroke: PenStroke, fmt: (n: number) => number = (n) => n): string {
  const pts = penStrokeOutline(stroke);
  if (pts.length === 0) return '';
  const xy = (p: Point) => `${fmt(p.x)} ${fmt(p.y)}`;
  const mid = (a: Point, b: Point) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const first = pts[0]!;
  const out = [`M ${xy(first)} Q`];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!;
    const next = pts[i + 1] ?? first;
    out.push(`${xy(p)} ${xy(mid(p, next))}`);
  }
  out.push(`L ${xy(first)} Z`);
  return out.join(' ');
}

/** The streamlined centre line the outline is drawn around: what shape recognition reads. */
export function penStrokeCentreline(stroke: PenStroke): Point[] {
  if (stroke.points.length === 0) return [];
  return getStrokePoints(inputOf(stroke), optionsOf(stroke)).map(({ point: [x, y] }) => ({
    x: x!,
    y: y!,
  }));
}

/** A whiteboard pen stroke: a freehand with a pen width that is not a highlight. */
export function isPenStroke(el: FreehandElement): boolean {
  return el.penWidth !== undefined && el.pen !== 'highlighter';
}

// What a pen stroke's ink reads: an element's packed points, or the live ink's freehand geometry
// (its raw samples laid out in the box they land in, and the pen's pressures), unpacked: the
// stroke being drawn never re-quantises its settled ink as its box grows.
export type PenStrokeSource = Pick<
  FreehandElement,
  'width' | 'height' | 'penWidth' | 'streamline'
> &
  (
    | Pick<FreehandElement, 'packedPoints'>
    | { points: readonly NormalisedPoint[]; pressures?: readonly number[] }
  );

function sourcePoints(el: PenStrokeSource): StrokePoints {
  if ('packedPoints' in el) return decodeStrokePoints(el.packedPoints);
  return {
    count: el.points.length,
    nx: Float64Array.from(el.points, (p) => p.nx),
    ny: Float64Array.from(el.points, (p) => p.ny),
    pressures: el.pressures ? Float64Array.from(el.pressures) : null,
  };
}

/**
 * A pen stroke element as perfect-freehand input: its points in its own box, or on the canvas
 * from `origin` (the element's x, y). A stroke stored before pressure and streamline were
 * recorded was already smoothed when it landed, so it draws with no streamline at the middle
 * pressure.
 */
export function freehandPenStroke(el: PenStrokeSource, origin: Point = { x: 0, y: 0 }): PenStroke {
  const w = Math.max(el.width, 1);
  const h = Math.max(el.height, 1);
  const { count, nx, ny, pressures } = sourcePoints(el);
  const points = new Array<Point>(count);
  for (let i = 0; i < count; i++)
    points[i] = { x: origin.x + nx[i]! * w, y: origin.y + ny[i]! * h };
  return {
    points,
    pressures: pressures ?? undefined,
    width: el.penWidth ?? 1,
    streamline: el.streamline ?? 0,
  };
}

/**
 * The svg a pen stroke element draws in, on the canvas and while it is drawn (LiveInk): a viewBox
 * on the element's own box in canvas coordinates, one unit a canvas px, and the outline where it is
 * on the board. So the path's numbers never depend on where the box is: as a stroke grows and its
 * box moves, the ink already drawn reaches the rasteriser at the same coordinates.
 */
export function penStrokeSvg(el: PenStrokeSource & Pick<FreehandElement, 'x' | 'y'>): {
  viewBox: string;
  d: string;
} {
  return {
    viewBox: `${el.x} ${el.y} ${Math.max(el.width, 1)} ${Math.max(el.height, 1)}`,
    d: penStrokePath(freehandPenStroke(el, { x: el.x, y: el.y })),
  };
}
