// Shape recognition on a whiteboard (docs/specs/023-whiteboard/whiteboard.md "Shape recognition"):
// the one test a stroke passes to become a clean shape, shared by the preview shown while the pen
// holds still and the commit on release, so the preview is exactly what lands.
import {
  penStrokeCentreline,
  recogniseShape,
  type PenStroke,
  type RecognisedShape,
} from '@livediagram/document';

type Point = { x: number; y: number };

// The Shape Pen's bar (docs/specs/008-canvas/two-pens.md): choosing recognition is the opt-in.
export const RECOGNITION_THRESHOLD = 0.4;
// How long the pen holds still, still pressed, before the shape shows: long enough that a
// pause mid-letter does not trigger it, short enough to feel like an answer. Procreate's
// QuickShape and GoodNotes' shape snapping sit around half a second.
export const RECOGNITION_PREVIEW_DWELL_MS = 500;
// "Still", in SCREEN px: a resting hand wobbles a little at any zoom.
export const RECOGNITION_PREVIEW_STILL_PX = 4;

/** The shape a pen stroke reads as, or null: read off its streamlined centre line. */
export function recogniseBoardStroke(stroke: PenStroke): RecognisedShape | null {
  const detected = recogniseShape(penStrokeCentreline(stroke));
  return detected && detected.confidence >= RECOGNITION_THRESHOLD ? detected : null;
}

/** Whether every sample from `from` up to `count` stays within the still radius of `anchor`, on screen. */
export function stillSince(
  sample: (i: number) => Point,
  from: number,
  count: number,
  anchor: Point,
  zoom: number,
): boolean {
  const r = RECOGNITION_PREVIEW_STILL_PX / (zoom || 1);
  for (let i = Math.max(0, from); i < count; i++) {
    const p = sample(i);
    if (Math.hypot(p.x - anchor.x, p.y - anchor.y) > r) return false;
  }
  return true;
}

// Once a shape shows, the pen keeps shaping it (docs/specs/023-whiteboard/whiteboard.md "Shape
// recognition"): dragging on moves the part of the shape the pen rested near, by as much as the
// pen has moved since, and keeps the rest. A line moves its nearer end; a box moves its nearer
// corner and keeps the opposite one, flipping cleanly past it. `ratio` (Shift held, see
// `shiftRatio`) makes it perfect: a box keeps width over height at `ratio`, its corner following
// whichever of the two distances from the fixed corner is the larger at that ratio, and a line's
// moving end snaps to 45 degree steps about its fixed end.
export function adjustRecognised(
  shape: RecognisedShape,
  grab: Point,
  pointer: Point,
  ratio?: number,
): RecognisedShape {
  const constrain = ratio !== undefined;
  const dx = pointer.x - grab.x;
  const dy = pointer.y - grab.y;
  if (dx === 0 && dy === 0 && !constrain) return shape;
  if (shape.kind === 'line') {
    const from = shape.from ?? { x: shape.bbox.x, y: shape.bbox.y };
    const to = shape.to ?? {
      x: shape.bbox.x + shape.bbox.width,
      y: shape.bbox.y + shape.bbox.height,
    };
    const movesTo =
      Math.hypot(grab.x - to.x, grab.y - to.y) <= Math.hypot(grab.x - from.x, grab.y - from.y);
    const fixed = movesTo ? from : to;
    const end = movesTo ? to : from;
    const moved = { x: end.x + dx, y: end.y + dy };
    const free = constrain ? snapToEighth(fixed, moved) : moved;
    const a = movesTo ? from : free;
    const b = movesTo ? free : to;
    return { ...shape, from: a, to: b, bbox: boxOf(a, b) };
  }
  const { x, y, width, height } = shape.bbox;
  const right = grab.x >= x + width / 2;
  const bottom = grab.y >= y + height / 2;
  const fixed = { x: right ? x : x + width, y: bottom ? y : y + height };
  const moving = { x: (right ? x + width : x) + dx, y: (bottom ? y + height : y) + dy };
  const corner = constrain ? atRatio(fixed, moving, ratio, right, bottom) : moving;
  return { ...shape, bbox: boxOf(fixed, corner) };
}

// The ratios Shift snaps a recognised rectangle to, width over height: a square, a landscape 5:3
// and a portrait 3:5 (docs/specs/023-whiteboard/whiteboard.md "Shape recognition"). Every other
// boxed shape keeps 1:1 (a true circle).
export const SHIFT_RECTANGLE_RATIOS = [1, 5 / 3, 3 / 5] as const;

/**
 * The width over height Shift holds `shape` to, read off it as it is when Shift takes effect: for a
 * rectangle the nearest of `SHIFT_RECTANGLE_RATIOS` by |log(width / height) - log(ratio)| (1:1 on
 * a tie), a flat one landscape and a thin one portrait; for anything else 1.
 */
export function shiftRatio(shape: RecognisedShape): number {
  if (shape.kind !== 'square') return 1;
  const { width, height } = shape.bbox;
  if (width <= 0 || height <= 0) return width > 0 ? 5 / 3 : height > 0 ? 3 / 5 : 1;
  const own = Math.log(width / height);
  let best: number = SHIFT_RECTANGLE_RATIOS[0];
  for (const r of SHIFT_RECTANGLE_RATIOS) {
    if (Math.abs(own - Math.log(r)) < Math.abs(own - Math.log(best))) best = r;
  }
  return best;
}

/**
 * `moving` pushed out from `fixed` to a box of width over height `ratio`, following the larger of
 * its two distances at that ratio, on the side it is on.
 */
function atRatio(
  fixed: Point,
  moving: Point,
  ratio: number,
  right: boolean,
  bottom: boolean,
): Point {
  const w = moving.x - fixed.x;
  const h = moving.y - fixed.y;
  const byWidth = Math.abs(w) >= Math.abs(h) * ratio;
  const width = byWidth ? Math.abs(w) : Math.abs(h) * ratio;
  const height = byWidth ? Math.abs(w) / ratio : Math.abs(h);
  // Lined up with the fixed corner on an axis: keep the side the box had.
  const sx = w === 0 ? (right ? 1 : -1) : Math.sign(w);
  const sy = h === 0 ? (bottom ? 1 : -1) : Math.sign(h);
  return { x: fixed.x + sx * width, y: fixed.y + sy * height };
}

/** `moving` on the nearest 45 degree ray from `fixed`: the point on that ray nearest `moving`. */
function snapToEighth(fixed: Point, moving: Point): Point {
  const vx = moving.x - fixed.x;
  const vy = moving.y - fixed.y;
  const step = Math.round(Math.atan2(vy, vx) / (Math.PI / 4));
  // The ray in whole steps (-1, 0 or 1 each way), so an axis snap is exact.
  const ux = Math.round(Math.cos((step * Math.PI) / 4));
  const uy = Math.round(Math.sin((step * Math.PI) / 4));
  const t = (vx * ux + vy * uy) / (ux * ux + uy * uy);
  return { x: fixed.x + t * ux, y: fixed.y + t * uy };
}

function boxOf(a: Point, b: Point) {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(b.x - a.x),
    height: Math.abs(b.y - a.y),
  };
}
