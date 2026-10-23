import { afterEach, describe, expect, it, vi } from 'vitest';
import { purgeRooms, ROOM_PURGE_CONCURRENCY } from './room-purge-client';

afterEach(() => vi.restoreAllMocks());

// A PLAN_ROOM namespace whose stubs' purge() runs `purge(planId)`.
function envWith(purge: (planId: string) => Promise<void>) {
  return {
    PLAN_ROOM: {
      idFromName: (name: string) => name,
      get: (id: string) => ({ purge: (planId: string) => (expect(planId).toBe(id), purge(planId)) }),
    },
  } as never;
}

// docs/specs/015-api/api.md "Purging a room"
describe('purgeRooms', () => {
  it("asks each project's plan to purge, a bounded batch at a time", async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    let inFlight = 0;
    let peak = 0;
    const purged: string[] = [];
    const env = envWith(async (id) => {
      peak = Math.max(peak, ++inFlight);
      await Promise.resolve();
      inFlight--;
      purged.push(id);
    });
    const ids = Array.from({ length: 25 }, (_, i) => `doc-${i}`);
    const out = await purgeRooms(env, ids);
    expect(out).toEqual({ rooms: 25, unreached: 0 });
    expect(purged).toHaveLength(25);
    expect(purged[0]).toBe('doc-0');
    expect(peak).toBeLessThanOrEqual(ROOM_PURGE_CONCURRENCY);
  });

  it('counts a plan it cannot reach, and never throws', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const env = envWith(async (id) => {
      if (id !== 'c') throw new Error('room unreachable');
    });
    const out = await purgeRooms(env, ['a', 'b', 'c']);
    expect(out).toEqual({ rooms: 3, unreached: 2 });
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('gives up on a plan that does not answer in time', async () => {
    vi.useFakeTimers();
    try {
      vi.spyOn(console, 'info').mockImplementation(() => {});
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const env = envWith(() => new Promise<void>(() => {}));
      const out = purgeRooms(env, ['slow']);
      await vi.advanceTimersByTimeAsync(3_000);
      expect(await out).toEqual({ rooms: 1, unreached: 1 });
    } finally {
      vi.useRealTimers();
    }
  });

  it('does nothing for no projects', async () => {
    const purge = vi.fn(async () => {});
    expect(await purgeRooms(envWith(purge), [])).toEqual({ rooms: 0, unreached: 0 });
    expect(purge).not.toHaveBeenCalled();
  });
});
