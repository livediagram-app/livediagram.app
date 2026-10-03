import { describe, expect, it } from 'vitest';
import {
  FRECENCY_HALF_LIFE_MS,
  frecencyScore,
  mergeFrecencyKeys,
  nextFrecencyKey,
  utcDay,
} from './frecency';

// Frecency (docs/specs/013-workspace/blueprints/explorer-home.md "Frecency"): each open day adds
// one, each day's weight halves every half-life, and the stored key is the instant the score
// decays to one.

const DAY = 24 * 60 * 60 * 1000;
const T0 = 1_700_000_000_000;

describe('nextFrecencyKey', () => {
  it('keys a first open at the open itself', () => {
    expect(nextFrecencyKey(null, T0)).toBe(T0);
    expect(frecencyScore(nextFrecencyKey(null, T0), T0)).toBe(1);
  });

  it('adds one to the decayed score on a later open day', () => {
    const first = nextFrecencyKey(null, T0);
    const second = nextFrecencyKey(first, T0 + FRECENCY_HALF_LIFE_MS);
    // One open a half-life ago weighs a half; today's weighs one.
    expect(frecencyScore(second, T0 + FRECENCY_HALF_LIFE_MS)).toBeCloseTo(1.5, 6);
  });

  it('ranks ten daily opens above one open yesterday for about six weeks', () => {
    let key: number | null = null;
    for (let d = 9; d >= 0; d -= 1) key = nextFrecencyKey(key, T0 - d * DAY);
    const yesterday = nextFrecencyKey(null, T0 - DAY);
    expect(frecencyScore(key!, T0)).toBeCloseTo(8.085, 2);
    expect((key! - T0) / DAY).toBeCloseTo(42.2, 1);
    expect(key!).toBeGreaterThan(yesterday);
  });

  it('lets a fresh single open overtake a stale habit once it has decayed', () => {
    let habit: number | null = null;
    for (let d = 0; d < 5; d += 1) habit = nextFrecencyKey(habit, T0 + d * DAY);
    const later = T0 + 120 * DAY;
    expect(nextFrecencyKey(null, later)).toBeGreaterThan(habit!);
  });

  it('keeps whole milliseconds', () => {
    const key = nextFrecencyKey(nextFrecencyKey(null, T0), T0 + 3 * DAY + 17);
    expect(Number.isInteger(key)).toBe(true);
  });
});

describe('frecencyScore', () => {
  it('halves every half-life', () => {
    expect(frecencyScore(T0, T0 + FRECENCY_HALF_LIFE_MS)).toBeCloseTo(0.5, 9);
    expect(frecencyScore(T0, T0 + 2 * FRECENCY_HALF_LIFE_MS)).toBeCloseTo(0.25, 9);
  });

  it('orders as the key orders, at any instant', () => {
    const a = T0 + 3 * DAY;
    const b = T0 + 5 * DAY;
    for (const at of [T0, T0 + 30 * DAY, T0 + 400 * DAY]) {
      expect(frecencyScore(b, at)).toBeGreaterThan(frecencyScore(a, at));
    }
  });
});

describe('mergeFrecencyKeys', () => {
  it('adds the two scores at the merge instant', () => {
    const guest = nextFrecencyKey(nextFrecencyKey(null, T0), T0 + DAY);
    const account = nextFrecencyKey(null, T0 + 2 * DAY);
    const at = T0 + 10 * DAY;
    const merged = mergeFrecencyKeys(guest, account, at);
    expect(frecencyScore(merged, at)).toBeCloseTo(
      frecencyScore(guest, at) + frecencyScore(account, at),
      6,
    );
  });

  it('is symmetric', () => {
    expect(mergeFrecencyKeys(T0, T0 + DAY, T0 + 2 * DAY)).toBe(
      mergeFrecencyKeys(T0 + DAY, T0, T0 + 2 * DAY),
    );
  });
});

describe('utcDay', () => {
  it('is the UTC calendar day', () => {
    // 2023-11-14 22:13:20 UTC.
    expect(utcDay(1_700_000_000_000)).toBe('2023-11-14');
  });
});
