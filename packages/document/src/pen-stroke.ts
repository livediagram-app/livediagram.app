// The whiteboard pen's ink (docs/specs/023-whiteboard/whiteboard.md "Pens"): perfect-freehand
// (MIT) with pressure, drawn the way Excalidraw draws freedraw. A stroke is its raw points, a
// pressure per point when the pen reported one, its pen width and its streamline; one pure
// function turns that into a filled outline, for the stroke being drawn, the stroke that lands and
// the SVG export alike. `last: true` always, so the stroke being drawn is already the finished one
// and release reshapes nothing.

import { getStroke, getStrokePoints, type StrokeOptions } from 'perfect-freehand';
import type { Point } from './geometry-primitives';
import type { FreehandElement } from './element-types';

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
  pressures?: readonly number[];
  /** The pen's width in canvas px at the middle pressure. */
  width: number;
  streamline: number;
};

// Every point carries its pressure explicitly: perfect-freehand would give a
// pressureless FIRST point a quarter, thinning the start of a constant stroke.
function inputOf(stroke: PenStroke): number[][] {
  return stroke.points.map((p, i) => [p.x, p.y, stroke.pressures?.[i] ?? PEN_MID_PRESSURE]);
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

/** The stroke's outline polygon. */
export function penStrokeOutline(stroke: PenStroke): Point[] {
  if (stroke.points.length === 0) return [];
  return getStroke(inputOf(stroke), optionsOf(stroke)).map(([x, y]) => ({ x: x!, y: y! }));
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

/**
 * A pen stroke element as perfect-freehand input: its points in its own box, or on the canvas
 * from `origin` (the element's x, y). A stroke stored before pressure and streamline were
 * recorded was already smoothed when it landed, so it draws with no streamline at the middle
 * pressure.
 */
// The fields of a freehand its pen ink reads (so the live ink can pass its geometry).
export type PenStrokeSource = Pick<
  FreehandElement,
  'points' | 'width' | 'height' | 'pressures' | 'penWidth' | 'streamline'
>;

export function freehandPenStroke(el: PenStrokeSource, origin: Point = { x: 0, y: 0 }): PenStroke {
  const w = Math.max(el.width, 1);
  const h = Math.max(el.height, 1);
  return {
    points: el.points.map((p) => ({ x: origin.x + p.nx * w, y: origin.y + p.ny * h })),
    pressures: el.pressures,
    width: el.penWidth ?? 1,
    streamline: el.streamline ?? 0,
  };
}
