// Ending workbench access (docs/specs/013-workspace/blueprints/workbench-embeds.md "Ending access"): Unpair
// removes one pairing; revoking a token removes all of its pairings and its pending requests. Tickets and
// sessions cascade with their pairing. The D1 delete is the change; closing the rooms is best-effort, since
// every later request of a removed session already fails.

import { sessionPrefixOf } from './auth/workbench-session';
import { closeWorkbenchSessions, TEAM_ROOM_CLOSE_CONCURRENCY } from './room-access-client';
import type { Env } from './types';

export type WorkbenchEndScope = { pairingId: string } | { tokenId: string };
export type WorkbenchEndReason = 'unpaired' | 'revoked';

type SessionRow = { id: string; pairing_id: string; token_id: string; document_id: string };

export async function endWorkbenchAccess(
  env: Env,
  scope: WorkbenchEndScope,
  reason: WorkbenchEndReason,
): Promise<void> {
  const byToken = 'tokenId' in scope;
  const key = byToken ? scope.tokenId : scope.pairingId;
  const { results: pairings } = await env.DB.prepare(
    `SELECT id, token_id FROM workbench_pairings WHERE ${byToken ? 'token_id' : 'id'} = ?`,
  )
    .bind(key)
    .all<{ id: string; token_id: string }>();
  const { results: sessions } = await env.DB.prepare(
    `SELECT s.id, s.pairing_id, s.token_id, s.document_id FROM workbench_sessions s
      WHERE s.pairing_id IN (SELECT id FROM workbench_pairings WHERE ${byToken ? 'token_id' : 'id'} = ?)`,
  )
    .bind(key)
    .all<SessionRow>();

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
      documentId: session.document_id,
      tokenId: session.token_id,
      sessionPrefix: sessionPrefixOf(session.id),
    });
  }

  for (const pairing of pairings) {
    const documents = [
      ...new Set(sessions.filter((s) => s.pairing_id === pairing.id).map((s) => s.document_id)),
    ];
    let unreached = 0;
    for (let i = 0; i < documents.length; i += TEAM_ROOM_CLOSE_CONCURRENCY) {
      const batch = documents.slice(i, i + TEAM_ROOM_CLOSE_CONCURRENCY);
      const reached = await Promise.all(
        batch.map((doc) => closeWorkbenchSessions(env, doc, pairing.id)),
      );
      unreached += reached.filter((ok) => !ok).length;
    }
    console.log('[workbench] unpaired', {
      tokenId: pairing.token_id,
      pairingId: pairing.id,
      reason,
      rooms: documents.length,
      unreached,
    });
  }
}
