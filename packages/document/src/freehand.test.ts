import { describe, expect, it } from 'vitest';
import {
  catmullRomToBezierPath,
  createFreehand,
  encodeStrokePoints,
  freehandGeometry,
  freehandNormalisedPoints,
  freehandPressures,
  simplifyPolyline,
} from './index';

// Three pure helpers underpin the pencil tool (docs/specs/008-canvas/canvas-and-palette.md Pencil
// (freehand) subsection):
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
    expect(el.packedPoints).toBe('AQA=');
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

  // Drawn ink stays still while a whiteboard pen stroke grows
  // (docs/specs/023-draw-mode/draw-mode.md "Pens"): the box sits on whole canvas px, so layout
  // never snaps it to a different sub-pixel offset as a sample moves its bounds.
  it('grows the padded box outwards to whole canvas px, however fractional the samples', () => {
    const raw = [
      { x: 10.3, y: 20.7 },
      { x: 25.55, y: 12.2 },
      { x: 40.01, y: 33.99 },
    ];
    const g = freehandGeometry(raw);
    expect(g).toMatchObject({ x: 9, y: 11, width: 33, height: 24 });
    for (const n of [g.x, g.y, g.width, g.height]) expect(Number.isInteger(n)).toBe(true);
    for (const [i, p] of g.points.entries()) {
      expect(g.x + p.nx * g.width).toBeCloseTo(raw[i]!.x, 9);
      expect(g.y + p.ny * g.height).toBeCloseTo(raw[i]!.y, 9);
    }
  });

  it('keeps the origin where it was while a growing stroke stays inside its pixel', () => {
    const raw = [
      { x: 100.4, y: 100.4 },
      { x: 110.2, y: 99.9 },
    ];
    const before = freehandGeometry(raw);
    const after = freehandGeometry([...raw, { x: 120.8, y: 99.6 }]);
    expect([after.x, after.y]).toEqual([before.x, before.y]);
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
    const points = freehandNormalisedPoints(el);
    for (const p of points) {
      expect(p.nx).toBeGreaterThanOrEqual(0);
      expect(p.nx).toBeLessThanOrEqual(1);
      expect(p.ny).toBeGreaterThanOrEqual(0);
      expect(p.ny).toBeLessThanOrEqual(1);
    }
    // First sample sits in the top-left padded slot; last in the
    // bottom-right padded slot.
    const first = points[0]!;
    const last = points[points.length - 1]!;
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
    for (const p of freehandNormalisedPoints(el)) {
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

describe('freehandGeometry', () => {
  it('is the geometry createFreehand gives the same points', () => {
    const points = [
      { x: 10.25, y: 20.5 },
      { x: 40.75, y: 20.5 },
      { x: 33.1, y: 60.9 },
    ];
    const { x, y, width, height, packedPoints } = createFreehand(points, false);
    const geometry = freehandGeometry(points);
    expect(geometry).toMatchObject({ x, y, width, height });
    expect(encodeStrokePoints(geometry.points)).toBe(packedPoints);
  });

  it('packs the pressures with the points', () => {
    const el = createFreehand(
      [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
      ],
      false,
      [0, 1],
    );
    expect(freehandPressures(el)).toEqual([0, 1]);
    expect(freehandPressures(createFreehand([{ x: 0, y: 0 }], false))).toBeUndefined();
  });

  it('gives no points a 1x1 box at the origin', () => {
    expect(freehandGeometry([])).toEqual({ x: 0, y: 0, width: 1, height: 1, points: [] });
  });
});
