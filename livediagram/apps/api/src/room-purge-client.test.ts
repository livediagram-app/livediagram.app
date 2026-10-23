import { afterEach, describe, expect, it, vi } from 'vitest';
import { purgeRooms, ROOM_PURGE_CONCURRENCY } from './room-purge-client';

afterEach(() => vi.restoreAllMocks());

// A DOCUMENT_ROOM namespace whose stubs' purge() runs `purge(documentId)`.
function envWith(purge: (documentId: string) => Promise<void>) {
  return {
    DOCUMENT_ROOM: {
      idFromName: (name: string) => name,
      get: (id: string) => ({
        purge: (documentId: string) => (expect(documentId).toBe(id), purge(documentId)),
      }),
    },
  } as never;
}

// docs/specs/015-api/api.md "Purging a room"
describe('purgeRooms', () => {
  it("asks each document's document to purge, a bounded batch at a time", async () => {
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

  it('counts a document it cannot reach, and never throws', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const env = envWith(async (id) => {
      if (id !== 'c') throw new Error('room unreachable');
    });
    const out = await purgeRooms(env, ['a', 'b', 'c']);
    expect(out).toEqual({ rooms: 3, unreached: 2 });
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('gives up on a document that does not answer in time', async () => {
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

  it('does nothing for no documents', async () => {
    const purge = vi.fn(async () => {});
    expect(await purgeRooms(envWith(purge), [])).toEqual({ rooms: 0, unreached: 0 });
    expect(purge).not.toHaveBeenCalled();
  });
});
