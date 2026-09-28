import { describe, expect, it } from 'vitest';
import { Backoff } from './backoff';
import { DRIVE_BACKOFF_CALM_MS } from './cadence';

const MIN = 60_000;

describe('Backoff', () => {
  it('doubles the intervals per rate-limit hit, capped', () => {
    const b = new Backoff();
    expect(b.pollIntervalMs(0)).toBe(20 * MIN);
    expect(b.writeIntervalMs(0)).toBe(5 * MIN);
    b.hit(0);
    expect(b.pollIntervalMs(1)).toBe(40 * MIN);
    expect(b.writeIntervalMs(1)).toBe(10 * MIN);
    b.hit(2);
    b.hit(3);
    b.hit(4);
    expect(b.pollIntervalMs(5)).toBe(60 * MIN);
    expect(b.writeIntervalMs(5)).toBe(30 * MIN);
  });

  it('returns to normal after an hour without errors', () => {
    const b = new Backoff();
    b.hit(0);
    expect(b.active(DRIVE_BACKOFF_CALM_MS - 1)).toBe(true);
    expect(b.active(DRIVE_BACKOFF_CALM_MS)).toBe(false);
    expect(b.pollIntervalMs(DRIVE_BACKOFF_CALM_MS)).toBe(20 * MIN);
  });
});
