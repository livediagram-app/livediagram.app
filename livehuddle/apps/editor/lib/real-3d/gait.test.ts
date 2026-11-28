import { describe, expect, it } from 'vitest';
import { BODY } from './character';
import { cadence, gaitPose, legIK, LEG, runAmount, strideAmount } from './gait';

const WALK = 260 / 2.5;
const SHIN = BODY.shin - BODY.ankle;

/** The ankle a hip and knee put down, from the hip joint (y forward, z up), the inverse of legIK. */
function ankleOf(hip: number, knee: number): { y: number; z: number } {
  const shin = hip - knee;
  return {
    y: BODY.thigh * Math.sin(hip) + SHIN * Math.sin(shin),
    z: -BODY.thigh * Math.cos(hip) - SHIN * Math.cos(shin),
  };
}

describe('legIK', () => {
  it('reaches the ankle it is asked for, the knee bending forward', () => {
    for (const [y, z] of [
      [0, -5.5],
      [2, -5.2],
      [-2.5, -4.8],
      [1, -3.5],
    ] as const) {
      const { hip, knee } = legIK(y, z);
      const a = ankleOf(hip, knee);
      expect(a.y).toBeCloseTo(y, 5);
      expect(a.z).toBeCloseTo(z, 5);
      expect(knee).toBeGreaterThanOrEqual(0);
    }
  });

  it('straightens the leg toward a point out of reach rather than failing', () => {
    const { hip, knee } = legIK(0, -50);
    expect(knee).toBeCloseTo(0, 1);
    expect(hip).toBeCloseTo(0, 1);
  });
});

describe('cadence and gait', () => {
  it('quickens with speed, like a person (about 0.9 strides a second walking)', () => {
    expect(cadence(1.55 * LEG)).toBeCloseTo(0.9, 1);
    expect(cadence(WALK)).toBeGreaterThan(cadence(WALK / 2));
    expect(cadence(WALK * 1.9)).toBeGreaterThan(cadence(WALK));
  });

  it('walks slowly, runs at the walk speed, and stands still at 0', () => {
    expect(runAmount(1 * LEG)).toBe(0);
    expect(runAmount(WALK)).toBe(1);
    expect(strideAmount(0)).toBe(0);
    expect(strideAmount(WALK)).toBe(1);
  });

  it('stands straight when still', () => {
    const g = gaitPose(0.3, 0);
    expect([g.hipL, g.kneeL, g.hipR, g.kneeR, g.bodyZ]).toEqual([0, 0, 0, 0, 0]);
  });
});

describe('planted feet', () => {
  /** A foot's place on the floor, along the walk, at a time: the body's travel plus the ankle ahead of the hip. */
  const footOnFloor = (speed: number, t: number, side: 'L' | 'R') => {
    const g = gaitPose(t * cadence(speed), speed);
    const a = ankleOf(side === 'L' ? g.hipL : g.hipR, side === 'L' ? g.kneeL : g.kneeR);
    return {
      y: speed * t + a.y,
      z: BODY.hip + g.bodyZ + a.z,
      pitch: side === 'L' ? g.footL : g.footR,
    };
  };

  for (const [name, speed] of [
    ['a stroll', 1.2 * LEG],
    ['the walk speed', WALK],
    ['the run', WALK * 1.9],
  ] as const) {
    it(`never slides a flat foot on the floor at ${name}`, () => {
      const period = 1 / cadence(speed);
      let planted = 0;
      for (let i = 0; i < 400; i++) {
        const t = (i / 400) * period;
        const dt = period / 4000;
        const a = footOnFloor(speed, t, 'L');
        const b = footOnFloor(speed, t + dt, 'L');
        // On the floor and flat: it stays where it is.
        if (a.z < BODY.ankle + 0.01 && b.z < BODY.ankle + 0.01 && a.pitch === 0 && b.pitch === 0) {
          planted++;
          expect(Math.abs(b.y - a.y) / dt).toBeLessThan(speed * 0.02);
        }
        // Never through the floor.
        expect(a.z).toBeGreaterThan(BODY.ankle - 0.05);
      }
      // Running, a foot is flat on the floor for under a tenth of the stride.
      expect(planted).toBeGreaterThan(5);
    });
  }

  it('moves its joints smoothly through a stride (no jump between frames)', () => {
    const steps = 600;
    let prev = gaitPose(0, WALK);
    for (let i = 1; i <= steps; i++) {
      const g = gaitPose(i / steps, WALK);
      for (const k of ['hipL', 'kneeL', 'hipR', 'kneeR', 'footL', 'footR', 'bodyZ'] as const)
        expect(Math.abs(g[k] - prev[k])).toBeLessThan(0.12);
      prev = g;
    }
  });
});
