// Fits a drawn stroke to what a freehand element can store (docs/specs/006-document/stroke-points.md
// "Limits"): a stroke with more samples than MAX_FREEHAND_POINTS is simplified, never refused, so a
// long stroke is kept rather than lost on release. Pure.

import { simplifyPolylineSurvival } from './polyline';
import { MAX_FREEHAND_POINTS } from './stroke-points';

type Point = { x: number; y: number };

/**
 * The first simplification tolerance tried, in canvas px. A tenth of a pixel: at zoom 1 nothing
 * moves visibly, and on a dense stroke it already drops the many samples that sit on the line
 * between their neighbours. Safe range: above 0 and well under 1 screen px.
 */
export const STROKE_FIT_START_TOLERANCE_PX = 0.1;

/**
 * The tolerance doubles until the stroke fits, at most this many times (0.1 px up to 0.1 * 2^7 =
 * 12.8 px). A stroke still too long after that (a dense scribble with no straight run) keeps evenly
 * spaced samples instead. Safe range: 4 to 10; each pass is one O(n) count over a single
 * simplification shared by every pass.
 */
export const STROKE_FIT_MAX_PASSES = 8;

export type FittedStroke = { points: Point[]; pressures?: number[] };

/**
 * `points` (and their `pressures`, one each) with at most `max` points: unchanged when they fit,
 * otherwise simplified with the smallest doubling tolerance that fits, else evenly thinned. The
 * first and last points are always kept.
 */
export function fitStrokeToLimit(
  points: readonly Point[],
  pressures?: readonly number[],
  max: number = MAX_FREEHAND_POINTS,
): FittedStroke {
  const take = (keep: (i: number) => boolean): FittedStroke => {
    const out: Point[] = [];
    const outPressures: number[] = [];
    for (let i = 0; i < points.length; i++) {
      if (!keep(i)) continue;
      out.push(points[i]!);
      if (pressures) outPressures.push(pressures[i]!);
    }
    return pressures ? { points: out, pressures: outPressures } : { points: out };
  };
  if (points.length <= max) return take(() => true);
  // One simplification answers every tolerance: a point is kept at `t` while survival > t².
  const survival = simplifyPolylineSurvival(points);
  let tolerance = STROKE_FIT_START_TOLERANCE_PX;
  for (let pass = 0; pass < STROKE_FIT_MAX_PASSES; pass++, tolerance *= 2) {
    const tol2 = tolerance * tolerance;
    let kept = 0;
    for (const s of survival) if (s > tol2) kept++;
    if (kept <= max) return take((i) => survival[i]! > tol2);
  }
  // Evenly spaced samples, the last always among them.
  const last = points.length - 1;
  const step = last / (max - 1);
  const keep = new Set<number>();
  for (let k = 0; k < max; k++) keep.add(Math.round(k * step));
  return take((i) => keep.has(i));
}
