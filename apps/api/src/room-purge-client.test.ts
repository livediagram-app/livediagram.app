import { afterEach, describe, expect, it, vi } from 'vitest';

const roomFetch = vi.fn();
vi.mock('./room-client', () => ({ roomFetch: (...args: unknown[]) => roomFetch(...args) }));
const { purgeRooms, ROOM_PURGE_CONCURRENCY } = await import('./room-purge-client');

afterEach(() => {
  roomFetch.mockReset();
  vi.restoreAllMocks();
});

// docs/specs/015-api/api.md "Purging a room"
describe('purgeRooms', () => {
  it("asks each document's room to purge, a bounded batch at a time", async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    let inFlight = 0;
    let peak = 0;
    roomFetch.mockImplementation(async () => {
      peak = Math.max(peak, ++inFlight);
      await Promise.resolve();
      inFlight--;
      return new Response(null, { status: 204 });
    });
    const ids = Array.from({ length: 25 }, (_, i) => `doc-${i}`);
    const out = await purgeRooms({} as never, ids);
    expect(out).toEqual({ rooms: 25, unreached: 0 });
    expect(roomFetch).toHaveBeenCalledTimes(25);
    expect(roomFetch.mock.calls[0]?.slice(1, 3)).toEqual(['doc-0', '/purge']);
    expect(peak).toBeLessThanOrEqual(ROOM_PURGE_CONCURRENCY);
  });

  it('counts a room it cannot reach, and never throws', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    roomFetch
      .mockRejectedValueOnce(new Error('room timeout'))
      .mockResolvedValueOnce(new Response('no', { status: 500 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const out = await purgeRooms({} as never, ['a', 'b', 'c']);
    expect(out).toEqual({ rooms: 3, unreached: 2 });
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('does nothing for no documents', async () => {
    expect(await purgeRooms({} as never, [])).toEqual({ rooms: 0, unreached: 0 });
    expect(roomFetch).not.toHaveBeenCalled();
  });
});
