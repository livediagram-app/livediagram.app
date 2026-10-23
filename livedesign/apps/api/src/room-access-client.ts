// The api's half of "access changes end the sessions they affect" (docs/specs/015-api/api.md): ask
// a design's room to close the sessions an access change no longer admits. Best-effort, like the
// share-op broadcast: the D1 write before it is the change, and every later API call and room join
// is gated on it, so a room that can't be reached is logged rather than failing the request.

import { listDesignsByTeam } from './db';
import { personTagFor } from './person-tag';
import type { AccessCloseMatch } from './room-access';
import { roomFetch } from './room-client';
import type { Env } from './types';

// The api never waits on one room longer than this.
const ROOM_ACCESS_CLOSE_TIMEOUT_MS = 3_000;
// A team's designs are closed this many rooms at a time, so a large library is a steady trickle
// of small calls rather than one burst. Production's largest team holds 20 designs (2026-10-06).
export const TEAM_ROOM_CLOSE_CONCURRENCY = 10;
// The most rooms one member's departure touches: the team's most recently saved designs. A
// session on a design past the cap still ends at its next join, which the gates refuse.
export const TEAM_ROOM_CLOSE_MAX_DESIGNS = 500;

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

// A share password was set: every session a share code admitted meets the gate again.
export function closeShareCodeSessions(env: Env, designId: string): Promise<boolean> {
  return closeRoomSessions(env, designId, { match: 'share-code' });
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

// A member left or was removed from a team: end their sessions on each of the team's designs.
// Matched by the per-design person tag their tickets carried, so no account id reaches a room.
export async function closeMemberTeamSessions(
  env: Env,
  teamId: string,
  userId: string,
): Promise<{ rooms: number; unreached: number; truncated: boolean }> {
  const designs = await listDesignsByTeam(env, teamId);
  const ids = designs.slice(0, TEAM_ROOM_CLOSE_MAX_DESIGNS).map((d) => d.id);
  const truncated = designs.length > ids.length;
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
