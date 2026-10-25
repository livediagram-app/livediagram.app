import { describe, expect, it } from 'vitest';
import {
  backoffFactor,
  backoffHit,
  fallbackCheckMs,
  NO_BACKOFF,
  writeIntervalMs,
  type Backoff,
} from './backoff';
import {
  DRIVE_BACKOFF_CALM_MS,
  DRIVE_BACKOFF_MAX_LEVEL,
  DRIVE_FALLBACK_CHECK_MAX_MS,
  DRIVE_FALLBACK_CHECK_MS,
  DRIVE_FALLBACK_CHECK_WATCHED_MS,
  DRIVE_ITEM_MIN_WRITE_INTERVAL_MAX_MS,
  DRIVE_ITEM_MIN_WRITE_INTERVAL_MS,
} from './constants';

const MIN = 60_000;

const hits = (n: number, from = 0): Backoff => {
  let b = NO_BACKOFF;
  for (let t = from; t < from + n; t++) b = backoffHit(b, t);
  return b;
};

describe('backoff', () => {
  it('starts at the base intervals', () => {
    expect(backoffFactor(NO_BACKOFF, 0)).toBe(1);
    expect(writeIntervalMs(NO_BACKOFF, 0)).toBe(DRIVE_ITEM_MIN_WRITE_INTERVAL_MS);
    expect(fallbackCheckMs(NO_BACKOFF, 0, DRIVE_FALLBACK_CHECK_MS)).toBe(DRIVE_FALLBACK_CHECK_MS);
  });

  it('doubles the intervals per rate-limit hit, capped', () => {
    const one = backoffHit(NO_BACKOFF, 0);
    expect(one).toEqual({ level: 1, lastErrorAt: 0 });
    expect(writeIntervalMs(one, 1)).toBe(10 * MIN);
    expect(fallbackCheckMs(one, 1, DRIVE_FALLBACK_CHECK_MS)).toBe(60 * MIN);
    const many = hits(10);
    expect(writeIntervalMs(many, 10)).toBe(DRIVE_ITEM_MIN_WRITE_INTERVAL_MAX_MS);
    expect(fallbackCheckMs(many, 10, DRIVE_FALLBACK_CHECK_MS)).toBe(DRIVE_FALLBACK_CHECK_MAX_MS);
  });

  it('stops counting at the top level', () => {
    expect(hits(20).level).toBe(DRIVE_BACKOFF_MAX_LEVEL);
    expect(backoffFactor(hits(20), 20)).toBe(2 ** DRIVE_BACKOFF_MAX_LEVEL);
  });

  it('never stretches a base already at the ceiling past it', () => {
    expect(fallbackCheckMs(hits(3), 3, DRIVE_FALLBACK_CHECK_WATCHED_MS)).toBe(
      DRIVE_FALLBACK_CHECK_WATCHED_MS,
    );
  });

  it('returns to normal after an hour without errors', () => {
    const b = backoffHit(NO_BACKOFF, 0);
    expect(backoffFactor(b, DRIVE_BACKOFF_CALM_MS - 1)).toBe(2);
    expect(backoffFactor(b, DRIVE_BACKOFF_CALM_MS)).toBe(1);
    expect(writeIntervalMs(b, DRIVE_BACKOFF_CALM_MS)).toBe(DRIVE_ITEM_MIN_WRITE_INTERVAL_MS);
  });

  it('starts again from one after a calm spell, not where it left off', () => {
    const b = hits(4);
    expect(backoffHit(b, 3 + DRIVE_BACKOFF_CALM_MS)).toEqual({
      level: 1,
      lastErrorAt: 3 + DRIVE_BACKOFF_CALM_MS,
    });
    // Within the hour it keeps climbing.
    expect(backoffHit(b, 3 + DRIVE_BACKOFF_CALM_MS - 1).level).toBe(5);
  });

  it('is plain data that survives a JSON round trip, never mutated', () => {
    const b = hits(2);
    const stored = JSON.parse(JSON.stringify(b)) as Backoff;
    expect(writeIntervalMs(stored, 2)).toBe(writeIntervalMs(b, 2));
    const before = { ...b };
    backoffHit(b, 5);
    expect(b).toEqual(before);
    expect(NO_BACKOFF).toEqual({ level: 0, lastErrorAt: null });
  });
});
