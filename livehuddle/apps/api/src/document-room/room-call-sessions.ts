import { parseCallSession, type NudgeOp } from '@livehuddle/api-schema';
import { unverifiedPerson } from '../calls/call-meter';
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
  if (!current) return;
  // The owner's month of call minutes is used (call-minutes.md "When the minutes are used"): no connection holds a
  // call session until a join is admitted again, so a browser that ignores the room's word proves nothing here.
  if (!parsed.left && room.callMeter.paused) {
    console.warn('[calls] session refused: minutes used');
    return;
  }
  if (parsed.left) {
    // A metered call saying it left (docs/specs/012-collaboration/call-minutes.md "The wire"): no longer in the call,
    // and its session is closed at Realtime. With Pro off nobody sends one, and one sent is dropped.
    if (!room.callMeter.on) return;
    if (current.callSession === parsed.sessionId) {
      ws.serializeAttachment({ ...current, callSession: null });
    }
    room.callMeter.left(parsed.sessionId);
    return;
  }
  ws.serializeAttachment({ ...current, callSession: parsed.sessionId });
  room.callMeter.proved(parsed.sessionId, current.callSession ?? null);
}

// Who a session is to the call meter (calls/call-meter.ts; call-minutes.md "What counts"). Someone signed in to an
// account is their collab key, which the api derived from the account: one person across their tabs and reconnects.
// Nobody else is a person the room can count on, and each is held to the meter's cap on people without an account: a
// guest by their collab key (the api derived it from their guest id, so their tabs are one), a link visitor by the
// connection, never by the key their browser's own secret gave (visitors sharing one secret would be one person,
// never charged, and one visitor with many secrets would be many).
export function callPersonOf(session: SessionAttachment): string {
  const ownKey = session.collabKey && !session.keyMinted && !session.keyVisitor;
  if (ownKey && session.account) return session.collabKey!;
  return unverifiedPerson(ownKey ? session.collabKey! : session.presenceId);
}

// Every call session a connection holds now, with the person holding it (the call meter's count).
export function callSessionHolders(room: DocumentRoom): Map<string, string> {
  const held = new Map<string, string>();
  for (const ws of room.state.getWebSockets()) {
    const session = room.readSession(ws);
    if (session?.callSession) held.set(session.callSession, callPersonOf(session));
  }
  return held;
}

// Every connection lets go of its call session (the owner's month of call minutes is used): the hearing check then
// knows no subscriber, so nobody hears anybody until a join is admitted and a session proven again.
export function endCallSessions(room: DocumentRoom): void {
  for (const ws of room.state.getWebSockets()) {
    const session = room.readSession(ws);
    if (session?.callSession) ws.serializeAttachment({ ...session, callSession: null });
  }
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
