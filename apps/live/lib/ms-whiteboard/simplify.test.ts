import { describe, expect, it } from 'vitest';
import { SIMPLIFY_TOLERANCE_PX, simplifyStroke } from './simplify';

// docs/specs/020-import-export/whiteboard-import.md "Pen strokes".
describe('simplifyStroke', () => {
  it('drops points on a straight line, keeping both ends', () => {
    const line = Array.from({ length: 50 }, (_, i) => ({ x: i, y: 2 * i, p: 0.5 }));
    expect(simplifyStroke(line, 4)).toEqual([line[0], line[49]]);
  });

  it('keeps a corner and every point a curve needs beyond the tolerance', () => {
    const corner = [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 5 },
      { x: 10, y: 10 },
    ];
    expect(simplifyStroke(corner, 4)).toEqual([corner[0], corner[2], corner[4]]);
    const arc = Array.from({ length: 200 }, (_, i) => {
      const a = (i / 199) * Math.PI;
      return { x: 100 * Math.cos(a), y: 100 * Math.sin(a) };
    });
    const kept = simplifyStroke(arc, 4);
    expect(kept.length).toBeLessThan(arc.length);
    // Every dropped point lies within the tolerance of the kept polyline.
    for (const p of arc) {
      const d = Math.min(
        ...kept.slice(1).map((b, i) => {
          const a = kept[i]!;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const t = Math.max(
            0,
            Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)),
          );
          return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
        }),
      );
      expect(d).toBeLessThanOrEqual(SIMPLIFY_TOLERANCE_PX + 1e-9);
    }
  });

  it('drops a point within half a px of the line and keeps one further off', () => {
    expect(SIMPLIFY_TOLERANCE_PX).toBe(0.5);
    const near = [
      { x: 0, y: 0 },
      { x: 5, y: 0.45 },
      { x: 10, y: 0 },
    ];
    const far = [
      { x: 0, y: 0 },
      { x: 5, y: 0.55 },
      { x: 10, y: 0 },
    ];
    expect(simplifyStroke(near, 4)).toEqual([near[0], near[2]]);
    expect(simplifyStroke(far, 4)).toEqual(far);
  });

  it('keeps a pressure swing on a straight line', () => {
    const swing = [
      { x: 0, y: 0, p: 0.2 },
      { x: 5, y: 0, p: 1 },
      { x: 10, y: 0, p: 0.2 },
    ];
    expect(simplifyStroke(swing, 4)).toEqual(swing);
  });

  it('leaves dots and two-point strokes alone', () => {
    expect(simplifyStroke([{ x: 1, y: 1 }], 4)).toEqual([{ x: 1, y: 1 }]);
    expect(simplifyStroke([], 4)).toEqual([]);
  });
});
