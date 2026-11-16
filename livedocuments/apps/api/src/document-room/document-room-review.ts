// The document's review settings in its room (docs/specs/007-editor/suggestions.md "Suggest Only"): read from the
// `document.review` column (cached until an Editor changes them), the people who join as Participants noted for
// the Share dialog, and each Participant session told whether it suggests. The rule itself is the document
// package's (suggestionRuleHolds); this says whose writing it applies to.
import {
  NO_REVIEW,
  parseStoredReview,
  suggestOnlyFor,
  withReviewPinned,
  withReviewSeen,
  type StoredReview,
} from '@livedocuments/api-schema';
import type { ParticipantPresence } from '@liveworkspace/api-schema/participants';
import type { SessionAttachment } from '../room-session';
import { ensureSchema } from './document-room-content';
import { sendTo } from './document-room-sockets';
import type { DocumentRoom } from './document-room';

const cache = new WeakMap<DocumentRoom, StoredReview>();

/** The document's review settings, read once and kept until reviewChanged. */
export function readRoomReview(room: DocumentRoom): StoredReview {
  const hit = cache.get(room);
  if (hit) return hit;
  let review = NO_REVIEW;
  if (room.storedSchema()) {
    ensureSchema(room);
    const row = room.state.storage.sql.exec('SELECT review FROM document LIMIT 1').toArray()[0];
    review = parseStoredReview(typeof row?.review === 'string' ? row.review : null);
  }
  cache.set(room, review);
  return review;
}

// A session's collab key: what its suggestions carry as their author.
const keyOf = (session: SessionAttachment): string | null =>
  session.collabKey ?? session.presence?.key ?? null;

/** Whose suggestions a Participant session's writing must be, when it is on Suggest Only: its collab key (a session
 *  with none may write nothing, which no suggestion's author matches). Null for anyone else. */
export function suggestByOf(room: DocumentRoom, session: SessionAttachment): string | null {
  if (session.presence?.role !== 'participate') return null;
  const key = keyOf(session);
  const review = readRoomReview(room);
  const at = {
    shareCode: session.shareCode,
    collabKey: key,
    verifiedKey: session.collabKey ?? null,
  };
  if (!suggestOnlyFor(review, at)) return null;
  return key ?? '\u0000';
}

// The room's word to one socket, as a system op (never relayed, never sequenced).
const tellSuggestOnly = (room: DocumentRoom, ws: WebSocket, suggestOnly: boolean) =>
  sendTo(room, ws, { kind: 'op', from: 'system', op: { kind: 'review', suggestOnly } });

/** A Participant said hello: noted for the Share dialog's list, pinned to Suggest Only when it came through a Suggest
 *  Only link with a verified collab key (one write when either is new), and told whether it suggests. */
export function participantJoined(
  room: DocumentRoom,
  ws: WebSocket,
  session: SessionAttachment,
  presence: ParticipantPresence,
): void {
  if (presence.role !== 'participate') return;
  const key = keyOf(session);
  const review = readRoomReview(room);
  if (key) {
    const now = Date.now();
    const seen = withReviewSeen(review, { key, name: presence.name }, now);
    // Pinned by the server-verified key alone: a key the client named could be changed to slip the pin.
    const next =
      session.collabKey && session.shareCode
        ? withReviewPinned(seen, session.collabKey, session.shareCode, now)
        : seen;
    if (next !== review && room.storedSchema()) {
      room.state.storage.sql.exec('UPDATE document SET review = ?', JSON.stringify(next));
      cache.set(room, next);
    }
  }
  tellSuggestOnly(room, ws, suggestByOf(room, { ...session, presence }) !== null);
}

/** An Editor changed the settings (the review route wrote them): read again, and every Participant session told
 *  where it now stands. */
export function reviewChanged(room: DocumentRoom): void {
  cache.delete(room);
  for (const ws of room.state.getWebSockets()) {
    const session = room.readSession(ws);
    if (session?.presence?.role !== 'participate') continue;
    tellSuggestOnly(room, ws, suggestByOf(room, session) !== null);
  }
}
