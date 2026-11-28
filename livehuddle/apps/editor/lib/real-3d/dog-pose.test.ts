import { describe, expect, it } from 'vitest';
import {
  boxHit,
  breath,
  DOG_FEET,
  DOG_PAT_MS,
  DOG_STRIDE,
  dogLimbs,
  easeToward,
  heartAt,
  readDog,
  stepPhase,
  wagHz,
} from './dog-pose';

const marks = { pet: 'awake', floor: true, trot: false, left: false };

describe('readDog', () => {
  it('puts its feet where the drawing stands them on the canvas', () => {
    const r = readDog({ x: 100, y: 200 }, 40, -10, marks);
    expect(r.feet).toEqual({ x: 100 + 40 + DOG_FEET.x, y: 200 - 10 + DOG_FEET.y });
    expect(r.asleep).toBe(false);
    expect(r.home).toBe(false);
  });

  it('is home only asleep and not out on the floor', () => {
    expect(readDog({ x: 0, y: 0 }, 0, 0, { ...marks, pet: 'asleep', floor: false }).home).toBe(
      true,
    );
    // Resting at a spot: lying down, but out of its bed.
    const out = readDog({ x: 0, y: 0 }, 0, 0, { ...marks, pet: 'asleep', floor: true });
    expect(out.asleep).toBe(true);
    expect(out.home).toBe(false);
  });

  it('carries the trot and facing marks', () => {
    const r = readDog({ x: 0, y: 0 }, 0, 0, { ...marks, trot: true, left: true });
    expect(r.trotting).toBe(true);
    expect(r.left).toBe(true);
  });
});

describe('easeToward', () => {
  it('moves by dt over the span and never past the goal', () => {
    expect(easeToward(0, 1, 0.1, 0.5)).toBeCloseTo(0.2);
    expect(easeToward(0.9, 1, 0.5, 0.5)).toBe(1);
    expect(easeToward(1, 0, 0.25, 0.5)).toBeCloseTo(0.5);
    expect(easeToward(0.1, 0, 1, 0.5)).toBe(0);
  });
});

describe('stepPhase', () => {
  it('turns one full step per stride travelled', () => {
    const p = stepPhase(0, DOG_STRIDE / 2, 1);
    expect(p).toBeCloseTo(Math.PI);
    expect(stepPhase(0, 0, 1)).toBe(0);
  });
});

describe('dogLimbs', () => {
  it('swings the diagonal pairs opposite ways while trotting', () => {
    const l = dogLimbs(Math.PI / 2, 1, 0, 0, 3);
    expect(l.a).toBeGreaterThan(0.5);
    expect(l.b).toBeCloseTo(-l.a);
    expect(l.bob).toBeGreaterThan(1);
  });

  it('keeps its legs and body still standing or lying', () => {
    const standing = dogLimbs(Math.PI / 2, 0, 0, 0, 0);
    expect(standing.a).toBe(0);
    expect(standing.bob).toBe(0);
    const lying = dogLimbs(Math.PI / 2, 1, 1, 0, 0);
    expect(lying.a).toBeCloseTo(0);
    expect(lying.bob).toBe(0);
    expect(lying.tailUp).toBe(0);
    expect(lying.wag).toBe(0);
  });
});

describe('wagHz', () => {
  it('wags fast for a pat, briskly trotting, never lying at rest', () => {
    expect(wagHz(true, 0, 1)).toBeGreaterThan(wagHz(false, 1, 0));
    expect(wagHz(false, 1, 0)).toBeGreaterThan(wagHz(false, 0, 0));
    expect(wagHz(false, 0, 1)).toBe(0);
  });
});

describe('breath', () => {
  it('breathes only lying down', () => {
    expect(breath(1.3, 0)).toBe(0);
    for (const t of [0, 0.7, 1.9, 3.1]) {
      expect(breath(t, 1)).toBeGreaterThanOrEqual(0);
      expect(breath(t, 1)).toBeLessThanOrEqual(1);
    }
  });
});

describe('boxHit', () => {
  const pts = [
    { x: 10, y: 10 },
    { x: 30, y: 40 },
  ];
  it('hits inside the box round the points, grown by the pad', () => {
    expect(boxHit(pts, 20, 20, 0)).toBe(true);
    expect(boxHit(pts, 32, 20, 0)).toBe(false);
    expect(boxHit(pts, 32, 20, 4)).toBe(true);
  });
  it('never hits with no points', () => {
    expect(boxHit([], 0, 0, 10)).toBe(false);
  });
});

describe('heartAt', () => {
  it('rises and fades over the pat, then is gone', () => {
    const start = heartAt(0, false)!;
    const late = heartAt(DOG_PAT_MS * 0.9, false)!;
    expect(late.rise).toBeGreaterThan(start.rise);
    expect(start.opacity).toBe(1);
    expect(late.opacity).toBeLessThan(0.5);
    expect(heartAt(DOG_PAT_MS + 1, false)).toBeNull();
    expect(heartAt(-1, false)).toBeNull();
  });
  it('does not rise under reduced motion', () => {
    expect(heartAt(DOG_PAT_MS * 0.8, true)!.rise).toBe(heartAt(0, true)!.rise);
  });
});
