// The project's suggestion settings in its room (liveworkspace/docs/specs/014-suggestions/canvas-suggestions.md
// "Suggest Only" and "Live"): the shared room review (@liveworkspace/suggestions/room-review) bound to this room's
// `plan.review` column and its sockets, and the word to every Participant and Editor socket that a tab's
// suggestions changed (never a Viewer's: it sees no suggestion).
import { createRoomReview, type RoomReview } from '@liveworkspace/suggestions/room-review';
import type { SuggestionsRoomOp } from '@liveworkspace/suggestions/room-signal';
import type { SessionAttachment } from '../room-session';
import type { PlanRoom } from './plan-room';
import { ensureSchema } from './plan-room-content';
import { sendTo } from './plan-room-sockets';

const reviews = new WeakMap<PlanRoom, RoomReview<WebSocket>>();

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

/** The room's review, made on first use. */
export function roomReview(room: PlanRoom): RoomReview<WebSocket> {
  const hit = reviews.get(room);
  if (hit) return hit;
  const made = createRoomReview<WebSocket>({
    read: () => {
      if (!room.storedSchema()) return null;
      ensureSchema(room);
      const row = room.state.storage.sql.exec('SELECT review FROM plan LIMIT 1').toArray()[0];
      return typeof row?.review === 'string' ? row.review : null;
    },
    write: (text) => {
      if (!room.storedSchema()) return;
      room.state.storage.sql.exec('UPDATE plan SET review = ?', text);
    },
    sockets: () => room.state.getWebSockets(),
    sessionOf: (ws) => sessionOf(room.readSession(ws)),
    tell: (ws, suggestOnly) =>
      sendTo(room, ws, { kind: 'op', from: 'system', op: { kind: 'review', suggestOnly } }),
  });
  reviews.set(room, made);
  return made;
}

/** Whether a session is a Participant held to Suggest Only: its element changes are refused but for live fields. */
export function suggestsOnly(room: PlanRoom, session: SessionAttachment): boolean {
  const s = sessionOf(session);
  return s !== null && roomReview(room).suggestByOf(s) !== null;
}

/** A Participant said hello: noted for the Share dialog, and told whether it suggests. */
export function reviewJoined(room: PlanRoom, ws: WebSocket, session: SessionAttachment): void {
  const s = sessionOf(session);
  if (s) roomReview(room).joined(ws, s);
}

/** A tab's suggestions changed: every Participant and Editor socket hears it; a Viewer's never does. */
export function suggestionsChanged(room: PlanRoom, op: SuggestionsRoomOp): void {
  for (const ws of room.state.getWebSockets()) {
    const session = room.readSession(ws);
    const role = session?.presence?.role;
    // A tab-scoped session hears of its own tab only.
    if (session?.tabScope && session.tabScope !== op.tabId) continue;
    if (role === 'participate' || role === 'edit')
      sendTo(room, ws, { kind: 'op', from: 'system', op });
  }
}
