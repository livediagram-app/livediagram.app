// One sitter per seat (docs/specs/009-elements/chair.md "Sitting" and "Occupancy is presence"), from
// presence alone: which seats of a piece peers hold, where an arriving character sits or stops, and which of two
// people who sat on one seat at once keeps it. Every machine runs the same pure rules on the same presence, so they
// agree on the sitter without a lock. Pure: no React, no DOM.

import type { Rect } from '@liveworkspace/model-core/geometry-primitives';
import { seatsACharacter } from './office-geometry';
import { isSceneShape, type AvatarSceneElement } from './scene';
import { seatPoints, type Seat, type SeatedBox } from './seats';
import { isLecternShape, lecternAside } from './lectern';
import type { AvatarFacing, AvatarPoint } from './walk';

/** Which seat a sitter holds (its `seatPoints` index), when they sat (their epoch ms) and their random tiebreak. */
export type SeatClaim = { index: number; at: number; tie: number };

/** Our claim on sitting down now: the seat, this moment and a fresh random tiebreak. */
export function newSeatClaim(index: number, at = Date.now(), tie = Math.random()): SeatClaim {
  return { index, at, tie };
}

/** A peer as the seat rules read their presence: where their feet are, what they sit on and their claim. */
export type SeatHolder = {
  x: number;
  y: number;
  seatedOn?: string | null;
  seat?: SeatClaim | null;
};

/** How far outside a piece a character stops when it cannot sit there, in canvas px. */
export const BESIDE_GAP = 12;

function nearestIndex(
  seats: readonly Seat[],
  from: AvatarPoint,
  among: (i: number) => boolean,
): number {
  let best = -1;
  let bestDistance = Infinity;
  seats.forEach((seat, i) => {
    if (!among(i)) return;
    const distance = Math.hypot(seat.x - from.x, seat.y - from.y);
    if (distance < bestDistance) {
      best = i;
      bestDistance = distance;
    }
  });
  return best;
}

const ANY = () => true;

/**
 * A peer's claim on a piece it sits on. A packet without one (an older client) holds the seat nearest its feet and
 * counts as the earliest, since that client never gives a seat up; so does a claim on a seat the piece no longer has.
 */
export function claimOf(seats: readonly Seat[], holder: SeatHolder): SeatClaim {
  const claim = holder.seat;
  if (claim && Number.isInteger(claim.index) && claim.index >= 0 && claim.index < seats.length)
    return claim;
  return { index: nearestIndex(seats, holder, ANY), at: 0, tie: 0 };
}

/** The seat indices of `el` the peers sitting on it hold. */
export function takenSeats(
  el: SeatedBox & { id: string },
  peers: readonly SeatHolder[],
): Set<number> {
  const seats = seatPoints(el);
  const taken = new Set<number>();
  for (const peer of peers) if (peer.seatedOn === el.id) taken.add(claimOf(seats, peer).index);
  return taken;
}

/** Whether claim `a` keeps a seat over claim `b`: the earlier sitter, then the lower tiebreak. */
export function claimBeats(a: SeatClaim, b: SeatClaim): boolean {
  return a.at !== b.at ? a.at < b.at : a.tie < b.tie;
}

/** A point `gap` outside the box, off the edge nearest `from` (or straight out from it, when `from` is outside). */
export function besideBox(box: Rect, from: AvatarPoint, gap = BESIDE_GAP): AvatarPoint {
  const x = Math.min(Math.max(from.x, box.x), box.x + box.width);
  const y = Math.min(Math.max(from.y, box.y), box.y + box.height);
  const edges = [
    { d: from.x - box.x, at: { x: box.x - gap, y } },
    { d: box.x + box.width - from.x, at: { x: box.x + box.width + gap, y } },
    { d: from.y - box.y, at: { x, y: box.y - gap } },
    { d: box.y + box.height - from.y, at: { x, y: box.y + box.height + gap } },
  ];
  let best = edges[0]!;
  for (const edge of edges) if (edge.d < best.d) best = edge;
  return best.at;
}

/**
 * Where a character stops when it cannot have a piece's seat: a step to the speaker's side at a Podium (venue-pieces.md
 * "Speaking from the Podium"), beside the piece off the edge nearest `from` for every other piece.
 */
function stopBeside(el: SeatedBox, seat: Seat, from: AvatarPoint): AvatarPoint {
  return isLecternShape(el.shape) ? lecternAside(seat, from) : besideBox(el, from);
}

/** Where a character sits: a seat's feet point, the way it then faces, and which seat it is. */
export type SeatChoice = { x: number; y: number; facing: AvatarFacing; index: number };

/**
 * What a character walking into a seating piece at `feet` does: sit on the free seat nearest where it arrived,
 * facing the way that seat says (a meeting table's) or else away from the piece's back; or, with every seat taken,
 * stop beside the piece.
 */
export function seatOnArrival(
  el: SeatedBox & { id: string },
  feet: AvatarPoint,
  peers: readonly SeatHolder[],
): { sit: SeatChoice } | { stopAt: AvatarPoint } {
  const seats = seatPoints(el);
  const taken = takenSeats(el, peers);
  const index = nearestIndex(seats, feet, (i) => !taken.has(i));
  if (index < 0) return { stopAt: stopBeside(el, seats[0]!, feet) };
  const seat = seats[index]!;
  return {
    sit: {
      x: seat.x,
      y: seat.y,
      facing: seat.facing,
      index,
    },
  };
}

/**
 * Whether our own claim on `el` loses to a peer's on the same seat (two people who sat at once), and if so where we
 * stand: beside the piece, off the edge nearest our seat. Null while we keep the seat.
 */
export function seatToYield(
  el: SeatedBox & { id: string },
  own: SeatClaim,
  peers: readonly SeatHolder[],
): AvatarPoint | null {
  const seats = seatPoints(el);
  for (const peer of peers) {
    if (peer.seatedOn !== el.id) continue;
    const theirs = claimOf(seats, peer);
    // A peer's claim always names a seat the piece has, so a match is our seat too.
    if (theirs.index === own.index && claimBeats(theirs, own))
      return stopBeside(el, seats[own.index]!, seats[own.index]!);
  }
  return null;
}

/**
 * `seatToYield` for whatever we sit on, looked up on the board: null while standing, while the piece is gone or is
 * not a seat (nothing to give up), or while we keep it.
 */
export function yieldFrom<E extends AvatarSceneElement>(
  elements: readonly E[],
  seatedOn: string | null,
  own: SeatClaim | null,
  peers: readonly SeatHolder[],
): AvatarPoint | null {
  if (!seatedOn || !own) return null;
  const el = elements.find((e) => e.id === seatedOn);
  if (!el || !isSceneShape(el) || !seatsACharacter(el.shape)) return null;
  return seatToYield({ ...el, shape: el.shape }, own, peers);
}
