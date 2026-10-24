// The api's half of "access changes end the sessions they affect" (docs/specs/015-api/api.md): ask
// a design's room to close the sessions an access change no longer admits (a workbench pairing ended).
// Best-effort: every later API call and room join is gated on the change, so a room that can't be reached is
// logged rather than failing the request. Sharing and team changes are the index's: it tells the room itself
// (`/api/internal/items/:id/revoke`), and a removed member's grant lapses within ten minutes.

import type { AccessCloseMatch } from './room-access';
import { roomFetch } from './room-client';
import type { Env } from './types';

// The api never waits on one room longer than this.
const ROOM_ACCESS_CLOSE_TIMEOUT_MS = 3_000;

async function closeRoomSessions(
  env: Env,
  designId: string,
  close: AccessCloseMatch,
): Promise<boolean> {
  try {
    const res = await roomFetch(
      env,
      designId,
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
      designId,
      match: close.match,
      error: String(err),
    });
    return false;
  }
}

// A workbench pairing ended (unpaired, or its token revoked): close the sockets it opened on one design
// (docs/specs/013-workspace/workbench-embeds.md), with WORKBENCH_ENDED_CLOSE.
export function closeWorkbenchSessions(
  env: Env,
  designId: string,
  pairingId: string,
): Promise<boolean> {
  return closeRoomSessions(env, designId, { match: 'workbench', pairingId });
}
