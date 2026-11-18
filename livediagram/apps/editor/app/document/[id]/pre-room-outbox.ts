import type { RoomOutgoing } from '@livediagram/api-schema';

// Dots cast before the room exists (docs/specs/012-collaboration/session-tools.md "A dot cast before the room
// opens"). The room client's own outbox (lib/api/room.ts) holds what is sent while its socket is down, but there is
// no room client at all until useRoomConnection makes one: the first moment after the page opens, while the
// document is still being fetched, `roomRef.current` is null and a dot sent then reached nobody. This holds those
// sends, for the document they were cast on, and hands them to the room client the moment it is made
// (useRoomConnection), whose outbox then carries them over the socket's hello like any other held op.
//
// Bounded: a vote budget is a handful of dots, so past PRE_ROOM_OUTBOX_MAX the newest are dropped, as the room
// client's outbox does past its own bound. Safe range: 20 to 500. Each held op is sent exactly once: a flush empties
// the box before it sends, so a second room made for the same document replays nothing.
export const PRE_ROOM_OUTBOX_MAX = 50;

export type PreRoomOutbox = {
  documentId: string | null;
  held: RoomOutgoing[];
};

export const createPreRoomOutbox = (): PreRoomOutbox => ({ documentId: null, held: [] });

/** Say `msg` to the room, or hold it for the room `documentId` is about to open. */
export function sendOrHold(
  box: PreRoomOutbox,
  room: { send: (msg: RoomOutgoing) => void } | null,
  documentId: string | null,
  msg: RoomOutgoing,
): void {
  if (room) {
    room.send(msg);
    return;
  }
  // No document, nothing to hold it for: the dot is on this screen alone, as before.
  if (!documentId) return;
  // Held for another document: that one was left, and what was cast on it goes with it.
  if (box.documentId !== documentId) {
    box.documentId = documentId;
    box.held = [];
  }
  if (box.held.length < PRE_ROOM_OUTBOX_MAX) box.held.push(msg);
}

/** Hand what was held for `documentId` to its room, once. Anything held for another document is dropped. */
export function flushPreRoomOutbox(
  box: PreRoomOutbox,
  room: { send: (msg: RoomOutgoing) => void },
  documentId: string,
): void {
  const held = box.documentId === documentId ? box.held : [];
  clearPreRoomOutbox(box);
  for (const msg of held) room.send(msg);
}

/** Drop everything held: the document was left. */
export function clearPreRoomOutbox(box: PreRoomOutbox): void {
  box.documentId = null;
  box.held = [];
}
