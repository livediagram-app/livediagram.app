import { describe, expect, it } from 'vitest';
import { STROKE_FIT_START_TOLERANCE_PX, fitStrokeToLimit } from './stroke-fit';
import { MAX_FREEHAND_POINTS } from './stroke-points';

// docs/specs/006-document/stroke-points.md "Limits": a stroke longer than a stroke can store is
// simplified to fit, never refused.

type Point = { x: number; y: number };

// Distance from `p` to the polyline `line`.
function distTo(p: Point, line: readonly Point[]): number {
  let best = Infinity;
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1]!;
    const b = line[i]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    const t =
      len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
    best = Math.min(best, Math.hypot(a.x + dx * t - p.x, a.y + dy * t - p.y));
  }
  return best;
}

describe('fitStrokeToLimit', () => {
  it('leaves a stroke that fits as it is', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ];
    expect(fitStrokeToLimit(points, [0.1, 0.2, 0.3])).toEqual({
      points,
      pressures: [0.1, 0.2, 0.3],
    });
    expect(fitStrokeToLimit(points)).toEqual({ points });
  });

  it('simplifies a long stroke just enough to fit, keeping its ends and its line', () => {
    // A long gentle curve, densely sampled: 25,000 samples a fifth of a pixel apart.
    const n = MAX_FREEHAND_POINTS + 5_000;
    const points = Array.from({ length: n }, (_, i) => ({ x: i * 0.2, y: Math.sin(i / 50) * 40 }));
    const pressures = points.map((_, i) => (i % 100) / 100);
    const out = fitStrokeToLimit(points, pressures);
    expect(out.points.length).toBeLessThanOrEqual(MAX_FREEHAND_POINTS);
    expect(out.points[0]).toBe(points[0]);
    expect(out.points.at(-1)).toBe(points.at(-1));
    // Each kept point carries its own pressure.
    expect(out.pressures).toHaveLength(out.points.length);
    for (let i = 0; i < out.points.length; i += 97) {
      const at = points.indexOf(out.points[i]!);
      expect(out.pressures![i]).toBe(pressures[at]);
    }
    // The drawn line stays where it was: every sample is within the first tolerance of what is kept.
    for (let i = 0; i < n; i += 131) {
      expect(distTo(points[i]!, out.points)).toBeLessThanOrEqual(STROKE_FIT_START_TOLERANCE_PX);
    }
  });

  it('thins evenly a scribble no tolerance tried can fit, keeping both ends', () => {
    // Every sample a sharp corner 100 px tall: no simplification within reach drops any.
    const points = Array.from({ length: 50 }, (_, i) => ({ x: i, y: i % 2 ? 100 : 0 }));
    const out = fitStrokeToLimit(points, undefined, 10);
    expect(out.points).toHaveLength(10);
    expect(out.points[0]).toBe(points[0]);
    expect(out.points.at(-1)).toBe(points.at(-1));
    expect(out.pressures).toBeUndefined();
  });

  it('fits a worst-case 60,000-sample scribble within a release budget', () => {
    const points = Array.from({ length: 60_000 }, (_, i) => ({
      x: (i % 400) + Math.sin(i) * 3,
      y: Math.floor(i / 400) * 2 + Math.cos(i * 1.7) * 3,
    }));
    const t0 = performance.now();
    const out = fitStrokeToLimit(points);
    const ms = performance.now() - t0;
    expect(out.points.length).toBeLessThanOrEqual(MAX_FREEHAND_POINTS);
    // Generous for a loaded CI machine; measured locally in the blueprint.
    expect(ms).toBeLessThan(1_000);
  });
});
