// An api's half of "access changes end the sessions they affect" (each product's docs/specs/015-api/api.md) for a
// workbench pairing: ask an item's room to close the sockets it opened (./room-access.ts says which). Best-effort:
// the pairing's end is the change, and every later API call and room join is gated on it, so a room that can't be
// reached is logged rather than failing the request. Every other access change reaches the room through the index
// (a revoked link's revoke door) or its grants. Each api's room-access-client.ts hands in its room fetch.

import type { AccessCloseMatch } from './room-access';

// The api never waits on one room longer than this.
export const ROOM_ACCESS_CLOSE_TIMEOUT_MS = 3_000;

type RoomFetch<E> = (
  env: E,
  itemId: string,
  path: string,
  init: RequestInit | undefined,
  ms: number,
) => Promise<Response>;

export function createRoomAccessClient<E>(roomFetch: RoomFetch<E>) {
  async function closeRoomSessions(
    env: E,
    itemId: string,
    close: AccessCloseMatch,
  ): Promise<boolean> {
    try {
      const res = await roomFetch(
        env,
        itemId,
        '/close-sessions',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(close),
        },
        ROOM_ACCESS_CLOSE_TIMEOUT_MS,
      );
      if (!res.ok) throw new Error(`status ${res.status}`);
      return true;
    } catch (err) {
      console.warn('[room-access] close did not reach the room', {
        itemId,
        match: close.match,
        error: String(err),
      });
      return false;
    }
  }

  return {
    // The sockets one workbench pairing opened on the item, closed.
    closeWorkbenchSessions: (env: E, itemId: string, pairingId: string): Promise<boolean> =>
      closeRoomSessions(env, itemId, { match: 'workbench', pairingId }),
  };
}
