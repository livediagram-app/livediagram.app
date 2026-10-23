import { afterEach, describe, expect, it, vi } from 'vitest';
import { purgeEach, ROOM_PURGE_CONCURRENCY } from './purge';

afterEach(() => vi.restoreAllMocks());

describe('purgeEach', () => {
  it('purges every item, a bounded batch at a time', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    let inFlight = 0;
    let peak = 0;
    const ids = Array.from({ length: 25 }, (_, i) => `i-${i}`);
    const out = await purgeEach(ids, async () => {
      peak = Math.max(peak, ++inFlight);
      await Promise.resolve();
      inFlight--;
    });
    expect(out.purged).toHaveLength(25);
    expect(out.unreached).toEqual([]);
    expect(peak).toBeLessThanOrEqual(ROOM_PURGE_CONCURRENCY);
  });

  it('names the rooms it cannot reach, and never throws', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const out = await purgeEach(['a', 'b', 'c'], async (id) => {
      if (id !== 'c') throw new Error('unreachable');
    });
    expect(out).toEqual({ purged: ['c'], unreached: ['a', 'b'] });
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('gives up on a room that does not answer in time', async () => {
    vi.useFakeTimers();
    try {
      vi.spyOn(console, 'info').mockImplementation(() => {});
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const out = purgeEach(['slow'], () => new Promise<void>(() => {}));
      await vi.advanceTimersByTimeAsync(3_000);
      expect(await out).toEqual({ purged: [], unreached: ['slow'] });
    } finally {
      vi.useRealTimers();
    }
  });
});
