import { describe, expect, it } from 'vitest';
import { restingMotion, shortestTurn, stepArrow, type ArrowGoal } from './people-arrows-motion';

// docs/specs/008-canvas/people-arrows.md "Motion"
const goal = (over: Partial<ArrowGoal> = {}): ArrowGoal => ({
  x: 100,
  y: 50,
  angle: 0,
  scale: 1,
  opacity: 1,
  shown: true,
  ...over,
});

function settle(m: ReturnType<typeof restingMotion>, g: ArrowGoal, reduced = false) {
  const trace: number[] = [];
  let frames = 0;
  while (stepArrow(m, g, 16, reduced) && frames < 1000) {
    trace.push(m.scale);
    frames++;
  }
  return { frames, trace };
}

describe('an arrow arriving', () => {
  it('starts where it belongs, small and clear, then grows in with a slight overshoot', () => {
    const m = restingMotion();
    expect(stepArrow(m, goal(), 16, false)).toBe(true);
    expect(m).toMatchObject({ x: 100, y: 50, opacity: 0, placed: true });
    expect(m.scale).toBeLessThan(0.6);
    const { frames, trace } = settle(m, goal());
    expect(frames).toBeGreaterThan(5);
    expect(frames).toBeLessThan(200);
    expect(Math.max(...trace)).toBeGreaterThan(1);
    expect(Math.max(...trace)).toBeLessThan(1.15);
    expect(m).toMatchObject({ scale: 1, opacity: 1, scaleVelocity: 0 });
  });

  it('appears at once under reduced motion', () => {
    const m = restingMotion();
    expect(stepArrow(m, goal({ scale: 0.9, opacity: 0.8 }), 16, true)).toBe(false);
    expect(m).toMatchObject({ x: 100, y: 50, scale: 0.9, opacity: 0.8 });
  });

  it('does nothing for a person never out of view', () => {
    const m = restingMotion();
    expect(stepArrow(m, goal({ shown: false }), 16, false)).toBe(false);
    expect(m.placed).toBe(false);
  });
});

describe('an arrow following', () => {
  it('glides along the edge without jumping and settles exactly', () => {
    const m = restingMotion();
    settle(m, goal());
    const next = goal({ x: 400 });
    stepArrow(m, next, 16, false);
    expect(m.x).toBeGreaterThan(100);
    expect(m.x).toBeLessThan(250);
    settle(m, next);
    expect(m.x).toBe(400);
  });

  it('catches up after a stalled frame without overshooting the goal', () => {
    const m = restingMotion();
    settle(m, goal());
    stepArrow(m, goal({ x: 400 }), 1000, false);
    expect(m.x).toBeLessThanOrEqual(400);
  });

  it('turns the shorter way round', () => {
    expect(shortestTurn(Math.PI - 0.1, -Math.PI + 0.1)).toBeCloseTo(0.2);
    expect(shortestTurn(-Math.PI + 0.1, Math.PI - 0.1)).toBeCloseTo(-0.2);
    expect(shortestTurn(0, 3 * Math.PI)).toBeCloseTo(Math.PI);
    const m = restingMotion();
    settle(m, goal({ angle: Math.PI - 0.1 }));
    stepArrow(m, goal({ angle: -Math.PI + 0.1 }), 16, false);
    // Past π, not back through 0.
    expect(m.angle).toBeGreaterThan(Math.PI - 0.1);
  });

  it('snaps to each goal under reduced motion', () => {
    const m = restingMotion();
    stepArrow(m, goal(), 16, true);
    expect(stepArrow(m, goal({ x: 700, angle: 1 }), 16, true)).toBe(false);
    expect(m).toMatchObject({ x: 700, angle: 1 });
  });
});

describe('an arrow leaving', () => {
  it('shrinks and fades where it is as its person comes into view, then can arrive afresh', () => {
    const m = restingMotion();
    settle(m, goal());
    const leave = goal({ x: 900, shown: false, opacity: 0 });
    stepArrow(m, leave, 16, false);
    expect(m.x).toBe(100);
    settle(m, leave);
    expect(m).toMatchObject({ opacity: 0, placed: false });
    expect(m.scale).toBeLessThan(1);
    stepArrow(m, goal({ x: 300 }), 16, false);
    expect(m).toMatchObject({ x: 300, placed: true });
  });

  it('goes at once under reduced motion', () => {
    const m = restingMotion();
    stepArrow(m, goal(), 16, true);
    expect(stepArrow(m, goal({ shown: false }), 16, true)).toBe(false);
    expect(m).toMatchObject({ opacity: 0, placed: false });
  });
});
