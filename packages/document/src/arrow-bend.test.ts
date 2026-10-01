import { describe, expect, it } from 'vitest';
import { BEND_T_MIN, applyArrowBend, planArrowBend } from './arrow-bend';
import type { ArrowElement } from './index';

const free = (x: number, y: number) => ({ kind: 'free' as const, x, y });
const arrow = (
  from: [number, number],
  to: [number, number],
  over: Partial<ArrowElement> = {},
): ArrowElement => ({ id: 'a', type: 'arrow', from: free(...from), to: free(...to), ...over });

// Point on the quadratic through `c` at t.
const quad = (
  f: { x: number; y: number },
  c: { x: number; y: number },
  g: { x: number; y: number },
  t: number,
) => ({
  x: (1 - t) ** 2 * f.x + 2 * t * (1 - t) * c.x + t * t * g.x,
  y: (1 - t) ** 2 * f.y + 2 * t * (1 - t) * c.y + t * t * g.y,
});

describe('planArrowBend', () => {
  it('bows a straight arrow at the grabbed fraction', () => {
    const plan = planArrowBend(arrow([0, 0], [200, 0]), [], { x: 100, y: 0 });
    expect(plan.kind).toBe('bow');
    if (plan.kind === 'bow') expect(plan.t).toBeCloseTo(0.5);
  });

  it('keeps the grab a little way in from the ends', () => {
    const plan = planArrowBend(arrow([0, 0], [200, 0]), [], { x: 5, y: 0 });
    if (plan.kind !== 'bow') throw new Error('expected a bow');
    expect(plan.t).toBe(BEND_T_MIN);
  });

  it('inserts a point on a curve that already has bend points', () => {
    const a = arrow([0, 0], [400, 0], {
      arrowStyle: 'curved',
      curvePoints: [
        { dx: -100, dy: -80 },
        { dx: 100, dy: -80 },
      ],
    });
    const plan = planArrowBend(a, [], { x: 350, y: -40 });
    expect(plan.kind).toBe('insert');
    if (plan.kind === 'insert') expect(plan.index).toBe(2);
  });

  it('slides the nearest segment of an angled arrow', () => {
    const plan = planArrowBend(arrow([0, 0], [200, 100], { arrowStyle: 'angled' }), [], {
      x: 200,
      y: 50,
    });
    expect(plan.kind).toBe('slide');
    if (plan.kind === 'slide') expect(plan.segment).toBe(1);
  });

  it('inserts one point on a zero-length arrow rather than bowing', () => {
    expect(planArrowBend(arrow([10, 10], [10, 10]), [], { x: 10, y: 10 }).kind).toBe('insert');
  });
});

describe('applyArrowBend', () => {
  it('bows a straight arrow so the curve passes through the pointer at the grab', () => {
    const plan = planArrowBend(arrow([0, 0], [200, 0]), [], { x: 60, y: 0 });
    const patch = applyArrowBend(plan, { x: 0, y: -50 });
    expect(patch.arrowStyle).toBe('curved');
    const c = { x: 100 + patch.curveOffset!.dx, y: patch.curveOffset!.dy };
    if (plan.kind !== 'bow') throw new Error('expected a bow');
    const p = quad({ x: 0, y: 0 }, c, { x: 200, y: 0 }, plan.t);
    expect(p.x).toBeCloseTo(60);
    expect(p.y).toBeCloseTo(-50);
  });

  // docs/specs/008-canvas/arrow-bending.md "Curved arrow with a single bow": grabbing its line
  // adds a point. The bow becomes a bend point at its apex and the grab is inserted beside it.
  it('turns a single bow into its apex plus a new point where the line was grabbed', () => {
    const a = arrow([0, 0], [200, 0], { arrowStyle: 'curved', curveOffset: { dx: 0, dy: -80 } });
    // Control (100, -80): the apex (t = 0.5) is at (100, -40), so its delta from the chord
    // middle (100, 0) is (0, -40). Grabbing at t = 0.25, (50, -30), puts the new point first.
    const grab = quad({ x: 0, y: 0 }, { x: 100, y: -80 }, { x: 200, y: 0 }, 0.25);
    const plan = planArrowBend(a, [], grab);
    const patch = applyArrowBend(plan, { x: 0, y: -10 });
    expect(patch.arrowStyle).toBe('curved');
    expect(patch.curveOffset).toBeUndefined();
    expect(patch.curvePoints).toHaveLength(2);
    expect(patch.curvePoints![0]!.dx).toBeCloseTo(grab.x - 100);
    expect(patch.curvePoints![0]!.dy).toBeCloseTo(grab.y - 10);
    expect(patch.curvePoints![1]).toEqual({ dx: 0, dy: -40 });
  });

  it('inserts after the apex when grabbed past the middle', () => {
    const a = arrow([0, 0], [200, 0], { arrowStyle: 'curved', curveOffset: { dx: 0, dy: -80 } });
    const grab = quad({ x: 0, y: 0 }, { x: 100, y: -80 }, { x: 200, y: 0 }, 0.75);
    const patch = applyArrowBend(planArrowBend(a, [], grab), { x: 0, y: 0 });
    expect(patch.curvePoints![0]).toEqual({ dx: 0, dy: -40 });
    expect(patch.curvePoints![1]!.dx).toBeCloseTo(grab.x - 100);
  });

  it('inserts the new point under the pointer, relative to the chord middle', () => {
    const a = arrow([0, 0], [400, 0], {
      arrowStyle: 'curved',
      curvePoints: [{ dx: -100, dy: -80 }],
    });
    const plan = planArrowBend(a, [], { x: 300, y: -30 });
    const patch = applyArrowBend(plan, { x: 10, y: -20 });
    expect(patch.curvePoints).toEqual([
      { dx: -100, dy: -80 },
      { dx: 110, dy: -50 },
    ]);
  });

  it('slides an end segment sideways, keeping the endpoint with a new jog', () => {
    // Auto elbow at (200, 0): 200 across, 100 down. Grab the first leg.
    const plan = planArrowBend(arrow([0, 0], [200, 100], { arrowStyle: 'angled' }), [], {
      x: 100,
      y: 0,
    });
    const patch = applyArrowBend(plan, { x: 30, y: 20 });
    expect(patch.arrowStyle).toBe('angled');
    expect(patch.elbowOffset).toBeUndefined();
    expect('elbowOffset' in patch).toBe(true);
    // Chord middle (100, 50): vertices (0, 20), (200, 20).
    expect(patch.curvePoints).toEqual([
      { dx: -100, dy: -30 },
      { dx: 100, dy: -30 },
    ]);
  });

  it('slides an interior segment without adding vertices', () => {
    // Z through (100, 0) and (100, 200); chord middle (150, 100).
    const a = arrow([0, 0], [300, 200], {
      arrowStyle: 'angled',
      curvePoints: [
        { dx: -50, dy: -100 },
        { dx: -50, dy: 100 },
      ],
    });
    const plan = planArrowBend(a, [], { x: 100, y: 100 });
    const patch = applyArrowBend(plan, { x: 15, y: 40 });
    expect(patch.curvePoints).toEqual([
      { dx: -35, dy: -100 },
      { dx: -35, dy: 100 },
    ]);
  });
});
