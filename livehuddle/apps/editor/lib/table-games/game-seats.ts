// Who plays at a game piece (docs/specs/009-elements/social-pieces.md "A game"): the sitter on each of its seats, from
// presence alone, never the document, and only an Editor or a Participant. A Viewer sitting there sits, and their seat
// counts as empty for the game. Any piece that hosts a game reads its players here (the Ping-Pong Table now, the Arcade
// Machine next, Work Tracker #529), so nothing in this file knows a game's rules. Pure: no React, no DOM.

/** Someone on the tab as the game seats read them: where they sit, on which seat, and whether they may play. */
export type GameSeatSource = {
  id: string;
  name: string;
  color: string;
  /** The piece they sit on, if any. */
  seatedOn: string | null;
  /** The seat they hold on it (its seat index), if known. */
  seat: number | null;
  /** An Editor or a Participant. */
  plays: boolean;
};

/** A player at a seat. `self` marks this screen's own person. */
export type GamePlayer = { id: string; name: string; color: string; self: boolean };

/** Each of a piece's `seats` seats: its player, or null. */
export type GameSeats = readonly (GamePlayer | null)[];

/**
 * The players at `pieceId`, seat by seat. `sources` lists this screen's own person first, then the peers: on the rare
 * double claim of a seat (two people sat at once, before the later one yields, chair.md) the first listed holds it.
 */
export function gameSeats(
  pieceId: string,
  seats: number,
  selfId: string,
  sources: readonly GameSeatSource[],
): GameSeats {
  const out: (GamePlayer | null)[] = Array.from({ length: seats }, () => null);
  for (const s of sources) {
    if (s.seatedOn !== pieceId || !s.plays || s.seat === null) continue;
    if (!Number.isInteger(s.seat) || s.seat < 0 || s.seat >= seats || out[s.seat]) continue;
    out[s.seat] = { id: s.id, name: s.name, color: s.color, self: s.id === selfId };
  }
  return out;
}

/** Whether two seatings hold the same people in the same colours: a step elsewhere re-renders no table. */
export function sameGameSeats(a: GameSeats, b: GameSeats): boolean {
  if (a.length !== b.length) return false;
  return a.every((p, i) => {
    const q = b[i];
    if (!p || !q) return p === q;
    return p.id === q.id && p.name === q.name && p.color === q.color && p.self === q.self;
  });
}

/** The seat this screen's own person plays on, or null. */
export function selfSeat(seats: GameSeats): number | null {
  const i = seats.findIndex((p) => p?.self);
  return i < 0 ? null : i;
}
