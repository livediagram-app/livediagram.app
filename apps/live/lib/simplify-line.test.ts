import { describe, expect, it } from 'vitest';
import { simplifyLine } from './simplify-line';

describe('simplifyLine', () => {
  it('keeps the corners that shape a line, within the tolerance', () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 50, y: 0.5 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ];
    expect(simplifyLine(pts, 2)).toEqual([pts[0], pts[2], pts[3]]);
  });

  it('keeps a loop drawn back to its start (its ends meet), rather than collapsing it', () => {
    const loop = Array.from({ length: 41 }, (_, i) => {
      const t = (i / 40) * Math.PI * 2;
      return { x: Math.sin(t) * 100, y: -Math.cos(t) * 100 };
    });
    const out = simplifyLine(loop, 5);
    expect(out.length).toBeGreaterThan(4);
    const xs = out.map((p) => p.x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(190);
  });
});
