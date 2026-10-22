// Ending workbench access (docs/specs/013-workspace/blueprints/workbench-embeds.md "Ending access"): Unpair
// removes one pairing; revoking a token removes all of its pairings and its pending requests. Tickets and
// sessions cascade with their pairing. The D1 delete is the change; closing the rooms is best-effort, since
// every later request of a removed session already fails. A project session's room is its project; a
// workspace session's rooms are the ones it joined (`workbench_session_rooms`, WB55).

import type { WorkbenchScope } from '@liveplanner/api-schema';
import { sessionPrefixOf } from './auth/workbench-session';
import { closeWorkbenchSessions, TEAM_ROOM_CLOSE_CONCURRENCY } from './room-access-client';
import type { Env } from './types';

// Whose access ends: one pairing, or every pairing of a token.
type WorkbenchEndTarget = { pairingId: string } | { tokenId: string };
export type WorkbenchEndReason = 'unpaired' | 'revoked';

type SessionRow = {
  id: string;
  pairing_id: string;
  token_id: string;
  scope: WorkbenchScope;
  project_id: string | null;
};

export async function endWorkbenchAccess(
  env: Env,
  target: WorkbenchEndTarget,
  reason: WorkbenchEndReason,
): Promise<void> {
  const byToken = 'tokenId' in target;
  const key = byToken ? target.tokenId : target.pairingId;
  const pairingsOfTarget = `SELECT id FROM workbench_pairings WHERE ${byToken ? 'token_id' : 'id'} = ?`;
  const { results: pairings } = await env.DB.prepare(
    `SELECT id, token_id, scope FROM workbench_pairings WHERE ${byToken ? 'token_id' : 'id'} = ?`,
  )
    .bind(key)
    .all<{ id: string; token_id: string; scope: WorkbenchScope }>();
  const { results: sessions } = await env.DB.prepare(
    `SELECT s.id, s.pairing_id, s.token_id, s.scope, s.project_id FROM workbench_sessions s
      WHERE s.pairing_id IN (${pairingsOfTarget})`,
  )
    .bind(key)
    .all<SessionRow>();
  const { results: rooms } = await env.DB.prepare(
    `SELECT s.pairing_id, r.project_id FROM workbench_session_rooms r
       JOIN workbench_sessions s ON s.id = r.session_id
      WHERE s.pairing_id IN (${pairingsOfTarget})`,
  )
    .bind(key)
    .all<{ pairing_id: string; project_id: string }>();

  const deletes = [
    env.DB.prepare(`DELETE FROM workbench_pairings WHERE ${byToken ? 'token_id' : 'id'} = ?`).bind(
      key,
    ),
  ];
  if (byToken)
    deletes.push(
      env.DB.prepare('DELETE FROM workbench_pairing_requests WHERE token_id = ?').bind(key),
    );
  await env.DB.batch(deletes);

  for (const session of sessions) {
    console.log('[workbench] session-ended', {
      reason,
      scope: session.scope,
      projectId: session.project_id,
      tokenId: session.token_id,
      sessionPrefix: sessionPrefixOf(session.id),
    });
  }

  for (const pairing of pairings) {
    const projects = [
      ...new Set([
        ...sessions.flatMap((s) =>
          s.pairing_id === pairing.id && s.project_id !== null ? [s.project_id] : [],
        ),
        ...rooms.filter((r) => r.pairing_id === pairing.id).map((r) => r.project_id),
      ]),
    ];
    let unreached = 0;
    for (let i = 0; i < projects.length; i += TEAM_ROOM_CLOSE_CONCURRENCY) {
      const batch = projects.slice(i, i + TEAM_ROOM_CLOSE_CONCURRENCY);
      const reached = await Promise.all(
        batch.map((doc) => closeWorkbenchSessions(env, doc, pairing.id)),
      );
      unreached += reached.filter((ok) => !ok).length;
    }
    console.log('[workbench] unpaired', {
      tokenId: pairing.token_id,
      pairingId: pairing.id,
      scope: pairing.scope,
      reason,
      rooms: projects.length,
      unreached,
    });
  }
}
