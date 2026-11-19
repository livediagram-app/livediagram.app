// What an editor sends before its room client exists (each product's docs/specs/012-collaboration/
// collab-race-hardening.md "Sent before the room client exists"). The room client's own outbox (room-client.ts, or a
// product's lib/api/room.ts) holds what is sent while its socket is down, but there is no room client at all until
// useRoomConnection makes one: the first moment after a page opens, while the item is still being confirmed as saved
// on the server, `roomRef.current` is null, and a live poll answer, an element edit or a dot sent then reached nobody.
// This holds those sends for the item the page is on and hands them to the room client the moment it is made, whose
// outbox then carries them over the socket's hello like any other held op.
//
// Only what the room client's outbox would hold is held (`holds`, the product's own rule): a cursor, a laser, a
// viewport or a reaction from before the room existed means nothing now and is dropped, as it is while the socket is
// down. Each held send is sent exactly once: a flush empties the box before it sends, so a second room made for the
// same item replays nothing, and moving to another item drops what was held for the last one.

/** Most sends held at once; past it the newest are dropped, as the room client's outbox does past its own bound. A
 *  first moment holds a handful (a dot, an answer, a tick): 100 is room to spare. Safe range: 20 to 500. */
export const PRE_ROOM_OUTBOX_MAX = 100;
/** Oldest a held send may be when its room is made; older ones are dropped. The save has carried the change to the
 *  server by then, so a peer who joins later already has it, and an additive op (a dot) replayed that late could
 *  count twice. A room is normally made within a second or two of the page opening. Safe range: 5 s to 120 s. */
export const PRE_ROOM_HOLD_MS = 30_000;

/** Any message a room client sends: an op frame carries its op. */
type RoomMessage = { kind: string };

export type PreRoomOutbox<M extends RoomMessage = RoomMessage> = {
  // The item the page is on (aimPreRoomOutbox), or null: with no item there is nobody to tell.
  itemId: string | null;
  held: { msg: M; at: number }[];
  // Whether a send means something once late (the room client's outbox rule).
  holds: (msg: M) => boolean;
};

/** The room client's outbox rule from a product's op-kind test: an op frame whose op kind the test accepts. */
export function holdsOpKinds(
  isHeldKind: (kind: unknown) => boolean,
): (msg: RoomMessage) => boolean {
  return (msg) => msg.kind === 'op' && isHeldKind((msg as { op?: { kind?: unknown } }).op?.kind);
}

export function createPreRoomOutbox<M extends RoomMessage>(
  holds: (msg: M) => boolean,
): PreRoomOutbox<M> {
  return { itemId: null, held: [], holds };
}

/** The page is on `itemId` now (null: none). Anything held for another item is dropped: that one was left. */
export function aimPreRoomOutbox<M extends RoomMessage>(
  box: PreRoomOutbox<M>,
  itemId: string | null,
): void {
  if (box.itemId === itemId) return;
  box.itemId = itemId;
  box.held = [];
}

/** Say `msg` to the room, or, before the room exists, hold it for the room the page's item is about to open. */
export function sendOrHold<M extends RoomMessage>(
  box: PreRoomOutbox<M>,
  room: { send: (msg: M) => void } | null,
  msg: M,
  now: number = Date.now(),
): void {
  if (room) {
    room.send(msg);
    return;
  }
  if (box.itemId === null || !box.holds(msg)) return;
  if (box.held.length < PRE_ROOM_OUTBOX_MAX) box.held.push({ msg, at: now });
}

/** Hand what was held for `itemId` to its room, once, oldest first, leaving out what is older than PRE_ROOM_HOLD_MS. */
export function flushPreRoomOutbox<M extends RoomMessage>(
  box: PreRoomOutbox<M>,
  room: { send: (msg: M) => void },
  itemId: string,
  now: number = Date.now(),
): void {
  const held = box.itemId === itemId ? box.held : [];
  box.held = [];
  for (const { msg, at } of held) if (now - at <= PRE_ROOM_HOLD_MS) room.send(msg);
}

/** Drop everything held (the room was closed); the item stays aimed. */
export function clearPreRoomOutbox<M extends RoomMessage>(box: PreRoomOutbox<M>): void {
  box.held = [];
}
