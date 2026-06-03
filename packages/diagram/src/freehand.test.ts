import { describe, expect, it } from 'vitest';
import { catmullRomToBezierPath, createFreehand, simplifyPolyline } from './index';

// Three pure helpers underpin the Pen tool (spec/09 Pen subsection):
// simplifyPolyline (Ramer-Douglas-Peucker), catmullRomToBezierPath
// (smooth SVG `d` builder), and createFreehand (bounding box +
// normalisation). They're called from editor-page on commit and from
// BoxedElementView on render, so a regression silently produces
// wrong-shaped sketches with no other surface signal. Cover the
// invariants that matter at each layer.

describe('simplifyPolyline', () => {
  it('passes short polylines through untouched (< 3 points has nothing to simplify)', () => {
    expect(simplifyPolyline([], 1)).toEqual([]);
    const one = [{ x: 0, y: 0 }];
    expect(simplifyPolyline(one, 1)).toEqual(one);
    const two = [
      { x: 0, y: 0 },
      { x: 10, y: 10 },
    ];
    expect(simplifyPolyline(two, 1)).toEqual(two);
  });

  it('drops collinear intermediate samples (perfect line collapses to its endpoints)', () => {
    // Five samples on a straight diagonal. Every interior point sits
    // exactly on the line between its neighbours, so RDP at any
    // positive tolerance should drop all three.
    const line = [
      { x: 0, y: 0 },
      { x: 5, y: 5 },
      { x: 10, y: 10 },
      { x: 15, y: 15 },
      { x: 20, y: 20 },
    ];
    expect(simplifyPolyline(line, 0.5)).toEqual([
      { x: 0, y: 0 },
      { x: 20, y: 20 },
    ]);
  });

  it('keeps the bend in a deliberate L-turn (perpendicular distance exceeds tolerance)', () => {
    // Three corners with one interior point at the apex. Tolerance
    // 1 px is below the apex's perpendicular distance to the chord,
    // so the apex must survive.
    const lShape = [
      { x: 0, y: 0 },
      { x: 50, y: 50 }, // apex
      { x: 100, y: 0 },
    ];
    const out = simplifyPolyline(lShape, 1);
    expect(out).toEqual(lShape);
  });

  it('returns a new array (input is not mutated)', () => {
    // RDP is called from a pointer-up handler where the caller may
    // still hold the raw points in scope (for telemetry, undo, etc).
    // Mutating the input would surprise that caller.
    const input = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 20, y: 0 },
    ];
    const out = simplifyPolyline(input, 1);
    expect(out).not.toBe(input);
    expect(input).toHaveLength(3); // unchanged
  });

  it('handles a tight loop where endpoints coincide (zero-length chord)', () => {
    // A closed-loop polyline ends near where it started; RDP's
    // line-distance math has a divide-by-zero branch for
    // start === end. Cover it explicitly so the implementation
    // can't regress into NaN-emitting code.
    const loop = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
      { x: 0, y: 0 },
    ];
    const out = simplifyPolyline(loop, 0.5);
    expect(out.length).toBeGreaterThanOrEqual(2);
    expect(out.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(true);
  });
});

describe('catmullRomToBezierPath', () => {
  it('returns empty string for an empty input', () => {
    expect(catmullRomToBezierPath([], false)).toBe('');
    expect(catmullRomToBezierPath([], true)).toBe('');
  });

  it('returns a bare M command for a single point (no segments to draw)', () => {
    expect(catmullRomToBezierPath([{ x: 7, y: 11 }], false)).toBe('M 7 11');
  });

  it('emits one C segment per inter-point span for an open path', () => {
    // Three points = two C segments between them. Open path: no Z.
    const d = catmullRomToBezierPath(
      [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
        { x: 20, y: 0 },
      ],
      false,
    );
    expect(d.startsWith('M 0 0 ')).toBe(true);
    const cCount = (d.match(/C /g) ?? []).length;
    expect(cCount).toBe(2);
    expect(d.endsWith(' Z')).toBe(false);
  });

  it('adds the closing tangent segment + Z for a closed path', () => {
    // Three-point closed path: three C segments (including the
    // wrap-around back to the start) plus a trailing Z.
    const d = catmullRomToBezierPath(
      [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
        { x: 20, y: 0 },
      ],
      true,
    );
    const cCount = (d.match(/C /g) ?? []).length;
    expect(cCount).toBe(3);
    expect(d.endsWith(' Z')).toBe(true);
  });

  it('passes through every input point (each one shows up as a C segment endpoint)', () => {
    // The Catmull-Rom-to-Bezier conversion guarantees the curve
    // interpolates each control point. Verify that by checking
    // every point appears as the endpoint of one of the C
    // segments in the emitted `d` string.
    const points = [
      { x: 0, y: 0 },
      { x: 5, y: 7 },
      { x: 12, y: 3 },
      { x: 20, y: 9 },
    ];
    const d = catmullRomToBezierPath(points, false);
    for (let i = 1; i < points.length; i++) {
      expect(d).toContain(`${points[i]!.x} ${points[i]!.y}`);
    }
  });
});

describe('createFreehand', () => {
  it('mints an empty-points element with a 1x1 box for an empty raw input', () => {
    // The caller (editor-page commitFreehand) already short-
    // circuits when raw.length < 2, but the factory itself must
    // also handle the empty case so a future caller can't divide
    // by zero on the bounds.
    const el = createFreehand([], false);
    expect(el.type).toBe('freehand');
    expect(el.points).toEqual([]);
    expect(el.width).toBe(1);
    expect(el.height).toBe(1);
  });

  it('places the bounding box around the input + a 1px pad on each side', () => {
    // Square gesture from (10, 20) to (40, 60). Padded box should
    // be (9, 19) to (41, 61) so the path has breathing room from
    // the wrapper edges (and so a straight line still has a
    // non-zero dimension to normalise against).
    const el = createFreehand(
      [
        { x: 10, y: 20 },
        { x: 40, y: 20 },
        { x: 40, y: 60 },
        { x: 10, y: 60 },
      ],
      false,
    );
    expect(el.x).toBe(9);
    expect(el.y).toBe(19);
    expect(el.width).toBe(32); // 40 - 10 + 2px pad
    expect(el.height).toBe(42); // 60 - 20 + 2px pad
  });

  it('normalises every point into [0..1] across the bounding box', () => {
    const el = createFreehand(
      [
        { x: 10, y: 20 },
        { x: 30, y: 30 },
        { x: 50, y: 40 },
      ],
      false,
    );
    for (const p of el.points) {
      expect(p.nx).toBeGreaterThanOrEqual(0);
      expect(p.nx).toBeLessThanOrEqual(1);
      expect(p.ny).toBeGreaterThanOrEqual(0);
      expect(p.ny).toBeLessThanOrEqual(1);
    }
    // First sample sits in the top-left padded slot; last in the
    // bottom-right padded slot.
    const first = el.points[0]!;
    const last = el.points[el.points.length - 1]!;
    expect(first.nx).toBeLessThan(0.1);
    expect(first.ny).toBeLessThan(0.1);
    expect(last.nx).toBeGreaterThan(0.9);
    expect(last.ny).toBeGreaterThan(0.9);
  });

  it('survives a perfectly horizontal stroke (zero-height bounding box would otherwise NaN)', () => {
    // Without the 1px pad, a horizontal stroke has height 0 and
    // normalising y divides by zero. The factory must keep all
    // ny values finite.
    const el = createFreehand(
      [
        { x: 0, y: 5 },
        { x: 10, y: 5 },
        { x: 20, y: 5 },
      ],
      false,
    );
    expect(el.height).toBeGreaterThan(0);
    for (const p of el.points) {
      expect(Number.isFinite(p.nx)).toBe(true);
      expect(Number.isFinite(p.ny)).toBe(true);
    }
  });

  it('records the closed flag on the element verbatim', () => {
    const open = createFreehand(
      [
        { x: 0, y: 0 },
        { x: 5, y: 5 },
      ],
      false,
    );
    expect(open.closed).toBe(false);
    const closed = createFreehand(
      [
        { x: 0, y: 0 },
        { x: 5, y: 5 },
      ],
      true,
    );
    expect(closed.closed).toBe(true);
  });

  it('mints a distinct id on every call (no accidental dedup of two sketches)', () => {
    const a = createFreehand(
      [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ],
      false,
    );
    const b = createFreehand(
      [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ],
      false,
    );
    expect(a.id).not.toBe(b.id);
  });
});
