import { describe, expect, it } from 'vitest';
import { timerDisplayMs, timerDone, type TabTimer } from './session';

describe('timerDisplayMs / timerDone', () => {
  it('countdown running shows remaining off the absolute end-time, floored at 0', () => {
    const t: TabTimer = { mode: 'countdown', running: true, durationMs: 60_000, anchorAt: 100_000 };
    expect(timerDisplayMs(t, 70_000)).toBe(30_000); // 30s left
    expect(timerDisplayMs(t, 100_000)).toBe(0);
    expect(timerDisplayMs(t, 105_000)).toBe(0); // never negative
    expect(timerDone(t, 99_000)).toBe(false);
    expect(timerDone(t, 100_000)).toBe(true);
  });

  it('countdown paused shows the frozen remaining (or the duration before any run)', () => {
    expect(
      timerDisplayMs(
        { mode: 'countdown', running: false, durationMs: 60_000, frozenMs: 42_000 },
        0,
      ),
    ).toBe(42_000);
    // Never started: fall back to the configured duration.
    expect(timerDisplayMs({ mode: 'countdown', running: false, durationMs: 60_000 }, 0)).toBe(
      60_000,
    );
  });

  it('stopwatch running counts up from the anchor; paused shows the frozen elapsed', () => {
    expect(timerDisplayMs({ mode: 'stopwatch', running: true, anchorAt: 5_000 }, 12_000)).toBe(
      7_000,
    );
    expect(timerDisplayMs({ mode: 'stopwatch', running: false, frozenMs: 7_000 }, 99_000)).toBe(
      7_000,
    );
    // A stopwatch is never "done".
    expect(timerDone({ mode: 'stopwatch', running: true, anchorAt: 0 }, 9_999)).toBe(false);
  });
});
