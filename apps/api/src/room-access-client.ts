// The api's half of "access changes end the sessions they affect" (docs/specs/015-api/api.md): ask
// a document's room to close the sessions an access change no longer admits. Best-effort, like the
// share-op broadcast: the D1 write before it is the change, and every later API call and room join
// is gated on it, so a room that can't be reached is logged rather than failing the request.

import { listDocumentsByTeam } from './db';
import { personTagFor } from './person-tag';
import type { AccessCloseMatch } from './room-access';
import { roomFetch } from './room-client';
import type { Env } from './types';

// The api never waits on one room longer than this.
export const ROOM_ACCESS_CLOSE_TIMEOUT_MS = 3_000;
// A team's documents are closed this many rooms at a time, so a large library is a steady trickle
// of small calls rather than one burst. Production's largest team holds 20 documents (2026-10-06).
export const TEAM_ROOM_CLOSE_CONCURRENCY = 10;
// The most rooms one member's departure touches: the team's most recently saved documents. A
// session on a document past the cap still ends at its next join, which the gates refuse.
export const TEAM_ROOM_CLOSE_MAX_DOCUMENTS = 500;

export async function closeRoomSessions(
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

// A share password was set: every session a share code admitted meets the gate again.
export function closeShareCodeSessions(env: Env, documentId: string): Promise<boolean> {
  return closeRoomSessions(env, documentId, { match: 'share-code' });
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

// A member left or was removed from a team: end their sessions on each of the team's documents.
// Matched by the per-document person tag their tickets carried, so no account id reaches a room.
export async function closeMemberTeamSessions(
  env: Env,
  teamId: string,
  userId: string,
): Promise<{ rooms: number; unreached: number; truncated: boolean }> {
  const documents = await listDocumentsByTeam(env, teamId);
  const ids = documents.slice(0, TEAM_ROOM_CLOSE_MAX_DOCUMENTS).map((d) => d.id);
  const truncated = documents.length > ids.length;
  let unreached = 0;
  for (let i = 0; i < ids.length; i += TEAM_ROOM_CLOSE_CONCURRENCY) {
    const batch = ids.slice(i, i + TEAM_ROOM_CLOSE_CONCURRENCY);
    const reached = await Promise.all(
      batch.map(async (id) =>
        closeRoomSessions(env, id, { match: 'person', personTag: await personTagFor(id, userId) }),
      ),
    );
    unreached += reached.filter((ok) => !ok).length;
  }
  console.info('[room-access] team member sessions closed', {
    teamId,
    rooms: ids.length,
    unreached,
    truncated,
  });
  return { rooms: ids.length, unreached, truncated };
}
