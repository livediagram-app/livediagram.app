// An api's half of "access changes end the sessions they affect" (each product's docs/specs/015-api/api.md) for a
// workbench pairing or a revoked API token: ask an item's room to close the sockets it opened (./room-access.ts says which). Best-effort:
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
    // The sockets one API token's room tickets opened on the item (its live views), closed: the token was revoked.
    closeTokenSessions: (env: E, itemId: string, tokenId: string): Promise<boolean> =>
      closeRoomSessions(env, itemId, { match: 'token', tokenId }),
    // Every socket on the item, closed with ITEM_ARCHIVED_CLOSE: it was archived from anywhere (liveworkspace/docs/
    // specs/004-index/one-explorer.md "Archived from elsewhere while open"). Told off the archive's path, best effort.
    closeArchivedSessions: (env: E, itemId: string): Promise<boolean> =>
      closeRoomSessions(env, itemId, { match: 'archived' }),
    // The item moved to the Trash (each product's docs/specs/013-workspace/trash.md "Open editors"): its room sends the
    // product's trashed op (`kind`) to every session and closes each, as its /broadcast does for that op. The index
    // tells the app off the trash's own path (its standing push), so this never slows a trash. Nothing is kept: a
    // restored item's room opens as before. Best effort, logged.
    tellTrashed: async (env: E, itemId: string, kind: string): Promise<boolean> => {
      try {
        const res = await roomFetch(
          env,
          itemId,
          '/broadcast',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ op: { kind } }),
          },
          ROOM_ACCESS_CLOSE_TIMEOUT_MS,
        );
        if (!res.ok) throw new Error(`status ${res.status}`);
        return true;
      } catch (err) {
        console.warn('[room-access] trashed did not reach the room', {
          itemId,
          error: String(err),
        });
        return false;
      }
    },
  };
}
