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
