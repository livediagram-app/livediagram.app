import type { CueRect } from './model-cues';

// The rectangle arithmetic every stage and calibration script scores boxes
// with, in one place so a guard fixed here is fixed everywhere. Photo pixels,
// `{ x, y, w, h }`: a detected Box, a model cue and a labelled note all fit.

// How much of `a` and `b` overlap, in square pixels (0 when they don't).
export function overlapArea(a: CueRect, b: CueRect): number {
  const ix = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const iy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  return ix * iy;
}

// Intersection over union. The union is floored at one square pixel, so two
// empty boxes score 0 rather than NaN.
export function iou(a: CueRect, b: CueRect): number {
  const i = overlapArea(a, b);
  return i / Math.max(1, a.w * a.h + b.w * b.h - i);
}

// Does `r` hold the point? INCLUSIVE: a point on the edge counts.
export function holdsPoint(r: CueRect, x: number, y: number): boolean {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}
