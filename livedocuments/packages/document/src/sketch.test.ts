import { describe, expect, it, vi } from 'vitest';
import {
  SKETCH_HATCH_MAX_LINES,
  outlineOfBox,
  outlineOfEllipse,
  outlineOfPart,
  outlineOfPath,
  outlineOfPolygon,
  outlineOfRect,
  pathEndTangents,
  sketchArrowHead,
  sketchHatchGap,
  sketchHatching,
  sketchRandom,
  sketchSeed,
  sketchStrokes,
  type Pt,
} from './sketch';

// docs/specs/008-canvas/finish.md "Sketch", blueprint docs/specs/008-canvas/blueprints/finish.md
const numbersOf = (d: string) => (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
const pointsOf = (d: string): Pt[] => {
  const n = numbersOf(d);
  const out: Pt[] = [];
  for (let i = 0; i + 1 < n.length; i += 2) out.push({ x: n[i]!, y: n[i + 1]! });
  return out;
};
const count = (d: string, re: RegExp) => (d.match(re) ?? []).length;

describe('seeded randomness', () => {
  it('is stable for an id and differs between ids', () => {
    expect(sketchSeed('abc')).toBe(sketchSeed('abc'));
    expect(sketchSeed('abc')).not.toBe(sketchSeed('abd'));
    const a = sketchRandom(42);
    const b = sketchRandom(42);
    const seq = Array.from({ length: 5 }, () => a());
    expect(Array.from({ length: 5 }, () => b())).toEqual(seq);
    for (const v of seq) expect(v >= 0 && v < 1).toBe(true);
  });
});

describe('sketchStrokes', () => {
  const box = outlineOfRect(0, 0, 200, 100, 0);

  it('is deterministic for a seed and changes with it', () => {
    expect(sketchStrokes(box, 7)).toBe(sketchStrokes(box, 7));
    expect(sketchStrokes(box, 7)).not.toBe(sketchStrokes(box, 8));
  });

  it('draws two strokes per edge by default, one when asked', () => {
    expect(count(sketchStrokes(box, 1), /M /g)).toBe(8);
    expect(count(sketchStrokes(box, 1, 1), /M /g)).toBe(4);
  });

  it('stays within a few px of the true outline', () => {
    for (const p of pointsOf(sketchStrokes(box, 3))) {
      expect(p.x).toBeGreaterThan(-6);
      expect(p.x).toBeLessThan(206);
      expect(p.y).toBeGreaterThan(-6);
      expect(p.y).toBeLessThan(106);
    }
  });

  it('draws a curve as a spline that stays near the ellipse', () => {
    const d = sketchStrokes(outlineOfEllipse(50, 50, 40, 20), 5);
    expect(d).toContain('C ');
    for (const p of pointsOf(d)) {
      const r = ((p.x - 50) / 40) ** 2 + ((p.y - 50) / 20) ** 2;
      expect(r).toBeGreaterThan(0.75);
      expect(r).toBeLessThan(1.3);
    }
  });
});

describe('outlines', () => {
  it('a sharp rectangle is four lines with a four-corner area', () => {
    const o = outlineOfRect(0, 0, 10, 10, 0);
    expect(o.segments.every((s) => s.kind === 'line')).toBe(true);
    expect(o.segments).toHaveLength(4);
    expect(o.area).toHaveLength(4);
  });

  it('a rounded rectangle alternates straight edges and corner arcs, the radius clamped', () => {
    const o = outlineOfRect(0, 0, 40, 20, 99);
    expect(o.segments.filter((s) => s.kind === 'curve')).toHaveLength(4);
    expect(o.segments[0]!.kind).toBe('line');
    for (const p of o.area!) expect(p.y).toBeGreaterThanOrEqual(-1e-9);
  });

  it('a box kind: circle is an ellipse, stadium a pill, others the given corner, inset kept', () => {
    expect(outlineOfBox('circle', 100, 50, 0, 1).segments[0]!.kind).toBe('curve');
    expect(outlineOfBox('stadium', 100, 40, 0, 1).segments.some((s) => s.kind === 'curve')).toBe(
      true,
    );
    const sq = outlineOfBox('square', 100, 40, 0, 2);
    expect(sq.area![0]).toEqual({ x: 2, y: 2 });
  });

  it('parses a path’s lines, curves, arcs and close', () => {
    const o = outlineOfPath('M 0 15 L 100 15 L 100 85 A 50 12 0 0 1 0 85 Z');
    expect(o.segments.map((s) => s.kind)).toEqual(['line', 'line', 'curve', 'line']);
    expect(o.area).not.toBeNull();
    // The arc bows down to y = 97 at its middle.
    const ys = o.area!.map((p) => p.y);
    expect(Math.max(...ys)).toBeCloseTo(97, 0);
  });

  it('reads relative and H / V commands', () => {
    const o = outlineOfPath('m 10 10 h 20 v 20 l -20 0 z');
    expect(o.area!.slice(0, 4)).toEqual([
      { x: 10, y: 10 },
      { x: 30, y: 10 },
      { x: 30, y: 30 },
      { x: 10, y: 30 },
    ]);
  });

  it('stops at an unsupported command, keeping what came before, and logs it once', () => {
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const o = outlineOfPath('M 0 0 L 10 0 S 20 20 30 30');
    outlineOfPath('M 0 0 S 1 1 2 2');
    expect(o.segments).toHaveLength(1);
    expect(
      debug.mock.calls.filter((c) => c[0] === '[sketch] unsupported path command'),
    ).toHaveLength(1);
    debug.mockRestore();
  });

  it('an open path has no area', () => {
    expect(outlineOfPath('M 0 0 L 50 50').area).toBeNull();
  });

  it('maps every part tag', () => {
    expect(
      outlineOfPart({ tag: 'rect', role: 'main', x: 0, y: 0, width: 10, height: 10 }).segments,
    ).toHaveLength(4);
    expect(
      outlineOfPart({ tag: 'circle', role: 'main', cx: 5, cy: 5, r: 5 }).segments[0]!.kind,
    ).toBe('curve');
    expect(
      outlineOfPart({ tag: 'ellipse', role: 'main', cx: 5, cy: 5, rx: 5, ry: 3 }).area,
    ).not.toBeNull();
    expect(
      outlineOfPart({ tag: 'polygon', role: 'main', points: '0,0 10,0 5,8' }).segments,
    ).toHaveLength(3);
    expect(outlineOfPart({ tag: 'path', role: 'main', d: 'M 0 0 L 1 1' }).segments).toHaveLength(1);
  });

  it('a polygon closes back to its first point', () => {
    const o = outlineOfPolygon([
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 0, y: 3 },
    ]);
    const last = o.segments[2]!;
    expect(last.kind === 'line' && last.to).toEqual({ x: 0, y: 0 });
  });
});

describe('sketchHatching', () => {
  const square = outlineOfRect(0, 0, 100, 100, 0).area!;

  it('fills the area with strokes that stay about inside it', () => {
    const d = sketchHatching(square, 1, 2);
    expect(count(d, /M /g)).toBeGreaterThan(10);
    for (const p of pointsOf(d)) {
      expect(p.x).toBeGreaterThan(-3);
      expect(p.x).toBeLessThan(103);
      expect(p.y).toBeGreaterThan(-3);
      expect(p.y).toBeLessThan(103);
    }
  });

  it('is deterministic for a seed', () => {
    expect(sketchHatching(square, 4, 2)).toBe(sketchHatching(square, 4, 2));
  });

  it('spaces lines by the border width, between 6 and 12 px', () => {
    expect(sketchHatchGap(1)).toBe(6);
    expect(sketchHatchGap(2)).toBe(8);
    expect(sketchHatchGap(7)).toBe(12);
  });

  it('caps the line count on a huge area', () => {
    const huge = outlineOfRect(0, 0, 20000, 20000, 0).area!;
    expect(count(sketchHatching(huge, 1, 2), /M /g)).toBeLessThanOrEqual(
      SKETCH_HATCH_MAX_LINES + 1,
    );
  });

  it('draws nothing for a degenerate area', () => {
    expect(
      sketchHatching(
        [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ],
        1,
        2,
      ),
    ).toBe('');
    expect(
      sketchHatching(
        [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 2, y: 0 },
        ],
        1,
        2,
      ),
    ).toBe('');
  });
});

describe('arrows', () => {
  it('finds where a path ends and which way it faces', () => {
    const t = pathEndTangents('M 0 0 L 100 0')!;
    expect(t.start.at).toEqual({ x: 0, y: 0 });
    expect(t.start.dir.x).toBeCloseTo(-1);
    expect(t.end.at).toEqual({ x: 100, y: 0 });
    expect(t.end.dir.x).toBeCloseTo(1);
  });

  it('follows a curve’s last direction', () => {
    const t = pathEndTangents('M 0 0 Q 100 0 100 100')!;
    expect(t.end.dir.y).toBeGreaterThan(0.9);
  });

  it('has no tangents for a dot', () => {
    expect(pathEndTangents('M 5 5 L 5 5')).toBeNull();
  });

  it('a sketched head is two strokes meeting near the tip, behind it', () => {
    const d = sketchArrowHead({ x: 100, y: 0 }, { x: 1, y: 0 }, 12, 3);
    expect(count(d, /M /g)).toBe(2);
    for (const p of pointsOf(d)) expect(p.x).toBeLessThan(103);
    const starts = pointsOf(d).filter((_, i) => i % 3 === 0);
    for (const p of starts) expect(p.x).toBeLessThan(92);
  });
});
