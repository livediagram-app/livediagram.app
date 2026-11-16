// The document's review settings in its room (docs/specs/007-editor/suggestions.md "Suggest Only";
// liveworkspace/docs/specs/015-suggestions/canvas-suggestions.md): the shared room review
// (@liveworkspace/suggestions/room-review) bound to the `document.review` column and this room's sockets. It reads the
// settings (cached until an Editor changes them), notes the people who join as Participants for the Share dialog,
// and tells each Participant session whether it suggests. The article rule itself is the document package's
// (suggestionRuleHolds); this says whose writing it applies to. Also the word to every Participant and Editor socket
// that a tab's canvas suggestions changed (never a Viewer's).
import { createRoomReview, type RoomReview } from '@liveworkspace/suggestions/room-review';
import type { SuggestionsRoomOp } from '@liveworkspace/suggestions/room-signal';
import type { StoredReview } from '@livedocuments/api-schema';
import type { ParticipantPresence } from '@liveworkspace/api-schema/participants';
import type { SessionAttachment } from '../room-session';
import { ensureSchema } from './document-room-content';
import { sendTo } from './document-room-sockets';
import type { DocumentRoom } from './document-room';

const reviews = new WeakMap<DocumentRoom, RoomReview<WebSocket>>();

const sessionOf = (session: SessionAttachment | null) =>
  session?.presence
    ? {
        role: session.presence.role ?? null,
        collabKey: session.collabKey ?? null,
        presenceKey: session.presence.key ?? null,
        shareCode: session.shareCode ?? null,
        name: session.presence.name ?? '',
      }
    : null;

function roomReview(room: DocumentRoom): RoomReview<WebSocket> {
  const hit = reviews.get(room);
  if (hit) return hit;
  const made = createRoomReview<WebSocket>({
    read: () => {
      if (!room.storedSchema()) return null;
      ensureSchema(room);
      const row = room.state.storage.sql.exec('SELECT review FROM document LIMIT 1').toArray()[0];
      return typeof row?.review === 'string' ? row.review : null;
    },
    write: (text) => {
      if (!room.storedSchema()) return;
      room.state.storage.sql.exec('UPDATE document SET review = ?', text);
    },
    sockets: () => room.state.getWebSockets(),
    sessionOf: (ws) => sessionOf(room.readSession(ws)),
    tell: (ws, suggestOnly) =>
      sendTo(room, ws, { kind: 'op', from: 'system', op: { kind: 'review', suggestOnly } }),
  });
  reviews.set(room, made);
  return made;
}

/** The document's review settings, read once and kept until reviewChanged. */
export function readRoomReview(room: DocumentRoom): StoredReview {
  return roomReview(room).review();
}

/** Whose suggestions a Participant session's writing must be, when it is on Suggest Only: its collab key (a session
 *  with none may write nothing, which no suggestion's author matches). Null for anyone else. */
export function suggestByOf(room: DocumentRoom, session: SessionAttachment): string | null {
  const s = sessionOf(session);
  return s ? roomReview(room).suggestByOf(s) : null;
}

/** A Participant said hello: noted for the Share dialog's list, pinned to Suggest Only when it came through a Suggest
 *  Only link with a verified collab key (one write when either is new), and told whether it suggests. */
export function participantJoined(
  room: DocumentRoom,
  ws: WebSocket,
  session: SessionAttachment,
  presence: ParticipantPresence,
): void {
  const s = sessionOf({ ...session, presence });
  if (s) roomReview(room).joined(ws, s);
}

/** An Editor changed the settings (the review route wrote them): read again, and every Participant session told
 *  where it now stands. */
export function reviewChanged(room: DocumentRoom): void {
  roomReview(room).changed();
}

/** A tab's canvas suggestions changed: every Participant and Editor socket on it hears; a Viewer's never does. */
export function suggestionsChanged(room: DocumentRoom, op: SuggestionsRoomOp): void {
  for (const ws of room.state.getWebSockets()) {
    const session = room.readSession(ws);
    const role = session?.presence?.role;
    if (session?.tabScope && session.tabScope !== op.tabId) continue;
    if (role === 'participate' || role === 'edit')
      sendTo(room, ws, { kind: 'op', from: 'system', op });
  }
}
