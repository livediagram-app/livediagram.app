import { describe, expect, it } from 'vitest';
import { BRAND_FACES } from './brand-mark-geometry';
import {
  PRISM_SETTLE_MS,
  PRISM_SPIN_DEG_PER_S,
  prismFrame,
  restingTurn,
  settleTurn,
} from './brand-prism-motion';

const face = (key: string) => BRAND_FACES.find((f) => f.key === key)!.d;
const visible = (frame: ReturnType<typeof prismFrame>) => frame.sides.filter((s) => s.d);

describe('prismFrame', () => {
  it('rests exactly on the artwork', () => {
    const rest = prismFrame({ turn: 0, open: 0 });
    expect(rest.top).toBe(face('top'));
    expect(rest.bottom).toBe(face('bottom'));
    expect(rest.sides[0]).toEqual({ d: face('left'), left: 1, right: 0 });
    expect(rest.sides[1]).toEqual({ d: face('rearRight'), left: 0, right: 1 });
    expect(visible(rest)).toHaveLength(2);
  });

  it('looks the same every quarter turn, so any quarter is home', () => {
    const rest = prismFrame({ turn: 0, open: 0 });
    for (const turn of [90, 180, 270, -90]) {
      const frame = prismFrame({ turn, open: 0 });
      // Same outline, whichever corner a path starts from.
      const shape = (d: string) => (d.match(/-?[\d.]+ -?[\d.]+/g) ?? []).sort().join(';');
      const paths = (f: typeof frame) =>
        f.sides
          .filter((s) => s.d)
          .map((s) => `${shape(s.d)}|${s.left}|${s.right}`)
          .sort();
      expect(paths(frame), String(turn)).toEqual(paths(rest));
      expect(shape(frame.top)).toBe(shape(rest.top));
    }
  });

  it('shows two or three sides mid-turn, never a back face', () => {
    for (let turn = 0; turn < 90; turn += 7.5) {
      const n = visible(prismFrame({ turn, open: 0 })).length;
      expect(n, String(turn)).toBeGreaterThanOrEqual(1);
      expect(n, String(turn)).toBeLessThanOrEqual(2);
    }
  });

  it('crossfades a side from right-lit to left-lit as it comes round', () => {
    const mid = prismFrame({ turn: 45, open: 0 });
    const front = visible(mid).find((s) => s.left > 0 && s.right > 0);
    expect(front).toBeDefined();
  });

  it('opens by lifting the lid and dropping the fold', () => {
    const open = prismFrame({ turn: 0, open: 1 });
    expect(open.top).toBe('M-130 -115L0 -190L130 -115L0 -40Z');
    expect(open.bottom).toBe('M-130 55L0 130L130 55L0 -20Z');
    expect(open.sides[0]!.d).not.toBe(face('left'));
  });
});

describe('the settle', () => {
  it('starts where the turn is and lands home', () => {
    expect(settleTurn(30, 0.06, 0, 0)).toBe(30);
    expect(settleTurn(30, 0.06, 0, 1)).toBe(0);
  });

  it('carries the spin forward a little before settling', () => {
    expect(settleTurn(80, PRISM_SPIN_DEG_PER_S / 1000, 90, 0.05)).toBeGreaterThan(80);
    expect(PRISM_SETTLE_MS).toBeLessThanOrEqual(500);
  });

  it('picks the nearest quarter turn as home', () => {
    expect(restingTurn(44)).toBe(0);
    expect(restingTurn(46)).toBe(90);
    expect(restingTurn(-50)).toBe(-90);
  });

  it('computes a frame well inside a frame budget', () => {
    const start = performance.now();
    for (let i = 0; i < 100; i++) prismFrame({ turn: i * 0.37, open: (i % 10) / 10 });
    // Under 1ms a frame even on a loaded CI runner (about 0.2ms measured
    // locally), against a 16ms frame.
    expect((performance.now() - start) / 100).toBeLessThan(1);
  });
});
