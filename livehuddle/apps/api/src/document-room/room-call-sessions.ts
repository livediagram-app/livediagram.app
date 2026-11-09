import { parseCallSession, type NudgeOp } from '@livehuddle/api-schema';
import { openSessionToken } from '../calls/call-tokens';
import type { CallSessionHolder } from '../calls/room-calls';
import { decideNudge } from '../room-nudge';
import type { SessionAttachment } from '../room-session';
import type { DocumentRoom } from './document-room';

// The room's side of a call and of a nudge (document-room.ts, calls/room-calls.ts): the sessions a call reads, the
// proof a call session carries, and a nudge's delivery. Each function takes the room it acts for.

// Deliver a nudge to its target, refuse it to its sender, or drop it (room-nudge.ts decides).
export function relayNudge(
  room: DocumentRoom,
  ws: WebSocket,
  session: SessionAttachment,
  op: NudgeOp,
): void {
  const sender = session.presence;
  if (!sender) return;
  let target: SessionAttachment | null = null;
  for (const peer of room.state.getWebSockets()) {
    if (peer === ws) continue;
    const attachment = peer.deserializeAttachment() as SessionAttachment | null;
    if (attachment?.presence?.id === op.targetId) {
      target = attachment;
      break;
    }
  }
  const decision = decideNudge({
    op,
    sender: session,
    target,
    ledger: room.nudges,
    now: Date.now(),
  });
  if (decision.kind === 'deliver') {
    room.sendToPresence(op.targetId, { kind: 'op', from: sender.id, op }, ws);
  } else if (decision.kind === 'refuse') {
    console.warn('[nudge] refused', { retryInMs: decision.retryInMs });
    room.sendTo(ws, {
      kind: 'op',
      from: op.targetId,
      op: { kind: 'nudge-refused', targetId: op.targetId, retryInMs: decision.retryInMs },
    });
  }
}

// A call's `call-session` op: kept on the connection once its token proves the session is this caller's here.
export async function noteCallSession(
  room: DocumentRoom,
  ws: WebSocket,
  op: unknown,
): Promise<void> {
  const parsed = parseCallSession(op);
  const secret = room.roomEnv?.REALTIME_APP_TOKEN;
  const documentId = room.readSession(ws)?.documentId ?? room.documentId;
  if (!parsed || !secret || !documentId) return;
  const role = await openSessionToken(secret, documentId, parsed.sessionId, parsed.sessionToken);
  if (!role) {
    console.warn('[calls] token', 'room');
    return;
  }
  const current = room.readSession(ws);
  if (current) ws.serializeAttachment({ ...current, callSession: parsed.sessionId });
}

// Every hello'd session as the calls read it. A closing socket's position went with its close (dropSession).
export function* callSessions(room: DocumentRoom): Iterable<CallSessionHolder> {
  for (const ws of room.state.getWebSockets()) {
    const session = room.readSession(ws);
    const presence = session?.presence;
    if (presence) {
      yield {
        presenceId: presence.id,
        role: presence.role,
        callSession: session.callSession,
        key: presence.key ?? null,
      };
    }
  }
}

// A tab's stored revision, and its body when that moved from `knownRev`; one primary-key read either way.
export function storedTabRev(
  room: DocumentRoom,
  tabId: string,
  knownRev: number | null,
): { rev: number; data: string | null } | null {
  const sql = room.state.storage.sql;
  if (!sql || !room.hasSchema()) return null;
  const row = sql.exec<{ rev: number }>('SELECT rev FROM tabs WHERE id = ?', tabId).toArray()[0];
  if (!row) return null;
  if (row.rev === knownRev) return { rev: row.rev, data: null };
  const body = sql.exec<{ data: string }>('SELECT data FROM tabs WHERE id = ?', tabId).toArray()[0];
  return { rev: row.rev, data: body?.data ?? null };
}
