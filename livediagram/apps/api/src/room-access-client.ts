// The api's half of "access changes end the sessions they affect" (docs/specs/015-api/api.md) for a workbench
// pairing: ask a canvas's room to close the sockets it opened. Best-effort: the pairing's end is the change, and
// every later API call and room join is gated on it, so a room that can't be reached is logged rather than failing
// the request. Every other access change reaches the room through the index (a revoked link's revoke door) or its
// grants (a session's grant is renewed before it lapses, and one the index refuses closes it).

import type { AccessCloseMatch } from './room-access';
import { roomFetch } from './room-client';
import type { Env } from './types';

// The api never waits on one room longer than this.
const ROOM_ACCESS_CLOSE_TIMEOUT_MS = 3_000;

async function closeRoomSessions(
  env: Env,
  documentId: string,
  close: AccessCloseMatch,
): Promise<boolean> {
  try {
    const res = await roomFetch(
      env,
      documentId,
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
      documentId,
      match: close.match,
      error: String(err),
    });
    return false;
  }
}

// A workbench pairing ended (unpaired, or its token revoked): close the sockets it opened on one document
// (docs/specs/013-workspace/workbench-embeds.md), with WORKBENCH_ENDED_CLOSE.
export function closeWorkbenchSessions(
  env: Env,
  documentId: string,
  pairingId: string,
): Promise<boolean> {
  return closeRoomSessions(env, documentId, { match: 'workbench', pairingId });
}
