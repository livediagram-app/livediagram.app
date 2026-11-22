import { describe, expect, it } from 'vitest';
import { windowStartOf, WITHIN_REACH_USE_WINDOW_DAYS } from './home';

describe('the use window', () => {
  it('is the last 90 UTC days, today included, from midnight', () => {
    const now = Date.UTC(2026, 9, 3, 15, 30);
    const start = windowStartOf(now);
    expect(new Date(start).toISOString()).toBe('2026-07-06T00:00:00.000Z');
    // 2026-07-06 to 2026-10-03 inclusive is 90 days.
    expect(Math.round((Date.UTC(2026, 9, 3) - start) / 86_400_000) + 1).toBe(
      WITHIN_REACH_USE_WINDOW_DAYS,
    );
  });

  it('starts at the same midnight wherever in the day it is asked', () => {
    expect(windowStartOf(Date.UTC(2026, 9, 3, 0, 0))).toBe(
      windowStartOf(Date.UTC(2026, 9, 3, 23, 59)),
    );
  });
});
