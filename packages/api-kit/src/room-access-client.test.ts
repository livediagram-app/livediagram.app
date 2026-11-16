import { describe, expect, it, vi } from 'vitest';
import { createRoomAccessClient, ROOM_ACCESS_CLOSE_TIMEOUT_MS } from './room-access-client';

describe('closeWorkbenchSessions', () => {
  it("asks the item's room to close the pairing's sessions, within the timeout", async () => {
    const roomFetch = vi.fn(async () => new Response(null, { status: 204 }));
    const { closeWorkbenchSessions } = createRoomAccessClient(roomFetch);
    expect(await closeWorkbenchSessions({ env: 1 }, 'd1', 'pair1')).toBe(true);
    expect(roomFetch).toHaveBeenCalledWith(
      { env: 1 },
      'd1',
      '/close-sessions',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ match: 'workbench', pairingId: 'pair1' }),
      },
      ROOM_ACCESS_CLOSE_TIMEOUT_MS,
    );
  });

  it("asks the item's room to close a revoked token's sockets", async () => {
    const roomFetch = vi.fn(async () => new Response(null, { status: 204 }));
    const { closeTokenSessions } = createRoomAccessClient(roomFetch);
    expect(await closeTokenSessions({ env: 1 }, 'd1', 'tok1')).toBe(true);
    expect(roomFetch).toHaveBeenCalledWith(
      { env: 1 },
      'd1',
      '/close-sessions',
      expect.objectContaining({ body: JSON.stringify({ match: 'token', tokenId: 'tok1' }) }),
      ROOM_ACCESS_CLOSE_TIMEOUT_MS,
    );
  });

  // trash.md "Open editors": the product's trashed op, through the room's own /broadcast.
  it("tells the item's room it was trashed, and answers false when it can't", async () => {
    const roomFetch = vi.fn(async () => new Response(null, { status: 204 }));
    const { tellTrashed } = createRoomAccessClient(roomFetch);
    expect(await tellTrashed({ env: 1 }, 'd1', 'design-trashed')).toBe(true);
    expect(roomFetch).toHaveBeenCalledWith(
      { env: 1 },
      'd1',
      '/broadcast',
      expect.objectContaining({ body: JSON.stringify({ op: { kind: 'design-trashed' } }) }),
      ROOM_ACCESS_CLOSE_TIMEOUT_MS,
    );
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const down = createRoomAccessClient(async () => {
      throw new Error('down');
    });
    expect(await down.tellTrashed({ env: 1 }, 'd1', 'document-trashed')).toBe(false);
    const refused = createRoomAccessClient(async () => new Response(null, { status: 500 }));
    expect(await refused.tellTrashed({ env: 1 }, 'd1', 'document-trashed')).toBe(false);
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });

  // Best-effort: the pairing is already ended, and every later join meets it.
  it('logs and answers false when the room refuses or cannot be reached', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const refused = createRoomAccessClient(async () => new Response(null, { status: 500 }));
    expect(await refused.closeWorkbenchSessions({}, 'd1', 'pair1')).toBe(false);
    expect(warn).toHaveBeenLastCalledWith('[room-access] close did not reach the room', {
      itemId: 'd1',
      match: 'workbench',
      error: 'Error: status 500',
    });
    const down = createRoomAccessClient(async () => {
      throw new TypeError('network down');
    });
    expect(await down.closeWorkbenchSessions({}, 'd2', 'pair1')).toBe(false);
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });
});
