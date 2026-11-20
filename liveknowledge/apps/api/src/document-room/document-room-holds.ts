// A session's paragraph hold in the room (docs/specs/007-editor/article-pages.md "Holding a paragraph"): an
// `article-hold` claim judged (first claim wins, room-article-holds.ts), kept on the session's socket attachment
// and relayed once given, or the holder's hold sent back to the claimant alone; a release cleared and relayed.
// A claim sent with a `ref` is answered with a `cursor` frame echoing it, after any refusal, so the claimant's
// `sequence(op)` settles once it knows. Each takes the room.
import {
  isRoomOpRef,
  levelAtLeast,
  parseArticleHold,
  parseStoredLevel,
} from '@liveknowledge/api-schema';
import {
  holdOp,
  judgeArticleHold,
  liveHoldsOn,
  type HoldingSession,
  type StoredArticleHold,
} from '../room-article-holds';
import type { ParticipantPresence } from '../types';
import { type SessionAttachment } from '../room-session';
import type { DocumentRoom } from './document-room';
import { sendTo } from './document-room-sockets';

/** Every hello'd session with a live socket, and the hold on its attachment. */
export function holdingSessions(room: DocumentRoom): HoldingSession[] {
  const out: HoldingSession[] = [];
  for (const ws of room.state.getWebSockets()) {
    const session = room.readSession(ws);
    const p = session?.presence;
    if (!p) continue;
    out.push({ presenceId: p.id, name: p.name, color: p.color, hold: session.articleHold });
  }
  return out;
}

/** The live holds on a tab, for the api's held check (`GET /holds`). */
export function readHolds(room: DocumentRoom, tabId: string, now = Date.now()) {
  return liveHoldsOn(tabId, holdingSessions(room), now);
}

function store(ws: WebSocket, session: SessionAttachment, hold: StoredArticleHold | null): void {
  const { articleHold: _was, ...rest } = session;
  ws.serializeAttachment({
    ...rest,
    ...(hold ? { articleHold: hold } : {}),
  } satisfies SessionAttachment);
}

/** One `article-hold` op from a session: never from a Viewer, who holds nothing, and dropped when malformed. */
export function answerArticleHold(
  room: DocumentRoom,
  ws: WebSocket,
  session: SessionAttachment,
  sender: ParticipantPresence,
  op: unknown,
  ref: unknown,
  now = Date.now(),
): void {
  if (!levelAtLeast(parseStoredLevel(sender.role), 'participate')) return;
  const hold = parseArticleHold(op);
  if (!hold) return;
  const relayRelease = (tabId: string) =>
    room.broadcast(
      { kind: 'op', from: sender.id, op: { kind: 'article-hold', tabId, flow: null } },
      ws,
    );
  if (hold.flow === null) {
    if (session.articleHold) {
      store(ws, session, null);
      relayRelease(session.articleHold.tabId);
    }
  } else {
    const verdict = judgeArticleHold(hold, sender.id, holdingSessions(room), now);
    if (verdict.kind === 'refused') {
      // The claimant left wherever it held before; it holds nothing now, and hears who holds this place.
      if (session.articleHold) {
        store(ws, session, null);
        relayRelease(session.articleHold.tabId);
      }
      sendTo(room, ws, {
        kind: 'op',
        from: verdict.holder.presenceId,
        op: holdOp(verdict.holder.hold),
      });
      console.info('[room] hold refused', { tabId: hold.tabId });
    } else {
      const stored: StoredArticleHold = { ...hold, at: now };
      store(ws, session, stored);
      room.broadcast({ kind: 'op', from: sender.id, op: holdOp(stored) }, ws);
    }
  }
  if (isRoomOpRef(ref)) sendTo(room, ws, { kind: 'cursor', epoch: room.epoch, seq: room.seq, ref });
}
