// Who is sitting in each chair, from presence, never from the document (docs/specs/008-canvas/avatar-mode.md):
// our own character plus every seated peer, keyed by chair id, each on the seat they hold; and where a piece marks
// them (docs/specs/009-elements/chair.md "Occupancy is presence"): a ring on each taken seat of a piece
// with several, and the name pill clear of the highest head. Pure: no React, no DOM.

import type { Rect } from '@liveworkspace/model-core/geometry-primitives';
import { avatarScale, peerAvatarConfig } from './config';
import { seatsACharacter } from './office-geometry';
import { isSceneShape, type AvatarSceneElement } from './scene';
import { claimOf, type SeatClaim } from './seat-claims';
import { drawnRect, seatPoints, type Seat, type SeatGrid } from './seats';
import { AVATAR_HEAD_CHROME, AVATAR_HEIGHT } from './walk';

/**
 * Somebody sitting on a piece: their name and colour, which of its seats they hold (its `seatPoints` index, absent
 * when the piece is not on the board) and the size their character draws at (avatarScale; absent, Regular's).
 */
export type Sitter = { name: string; color: string; seat?: number; scale?: number };
type ChairSitters = ReadonlyMap<string, readonly Sitter[]>;

/** A character as the sitters read it: where it sits, its claim on the seat, where its feet are and its size. */
export type SitterSource = {
  name: string;
  color: string;
  seatedOn?: string | null;
  seat?: SeatClaim | null;
  x?: number;
  y?: number;
  scale?: number;
};

/** A piece's seats by id, from the board: null for a piece that is gone or seats nobody. */
export type SeatsOf = (pieceId: string) => readonly Seat[] | null;

/**
 * `SeatsOf` over a board: a piece's seats, looked up and worked out the first time they are asked for and kept, so a
 * board nobody sits on costs nothing and a packet costs a map lookup per sitter. Made once per board (a useMemo).
 */
export function seatsOnBoard(elements: readonly AvatarSceneElement[]): SeatsOf {
  const seats = new Map<string, readonly Seat[] | null>();
  return (id) => {
    if (seats.has(id)) return seats.get(id)!;
    const el = elements.find((e) => e.id === id);
    const points =
      el && isSceneShape(el) && seatsACharacter(el.shape)
        ? seatPoints({ ...el, shape: el.shape })
        : null;
    seats.set(id, points);
    return points;
  };
}

// The seat a sitter holds: their claim, or (an older client, a claim on a seat the piece no longer has) the seat
// nearest their feet, by the same rule the seat claims settle on (seat-claims.ts claimOf).
function seatIndex(source: SitterSource, seats: readonly Seat[] | null): number | undefined {
  if (!seats || seats.length === 0) return source.seat?.index;
  return claimOf(seats, { x: source.x ?? 0, y: source.y ?? 0, seat: source.seat }).index;
}

/** A peer's character as the sitters read it, from their presence: their size is parsed only while they sit. */
export function seatedPeer(peer: {
  name: string;
  color: string;
  avatar: {
    x: number;
    y: number;
    seatedOn?: string | null;
    seat?: SeatClaim | null;
    config?: unknown;
  };
}): SitterSource {
  const { avatar } = peer;
  if (!avatar.seatedOn) return { name: peer.name, color: peer.color };
  return {
    name: peer.name,
    color: peer.color,
    seatedOn: avatar.seatedOn,
    seat: avatar.seat,
    x: avatar.x,
    y: avatar.y,
    scale: avatarScale(peerAvatarConfig(avatar.config).size),
  };
}

/**
 * Every seated character by the piece it sits on (ours named "You" by the caller), each list in seat order (so a pill's names read
 * the way the seats run). `seatsOf` finds each piece's seats; without it a sitter keeps only their claim's index.
 */
export function sittersByChair(
  self: SitterSource | null,
  peers: readonly SitterSource[],
  seatsOf?: SeatsOf,
): Map<string, Sitter[]> {
  const byChair = new Map<string, Sitter[]>();
  const add = (source: SitterSource) => {
    const chairId = source.seatedOn;
    if (!chairId) return;
    const sitter: Sitter = { name: source.name, color: source.color };
    const seat = seatIndex(source, seatsOf?.(chairId) ?? null);
    if (seat !== undefined) sitter.seat = seat;
    if (source.scale !== undefined) sitter.scale = source.scale;
    const list = byChair.get(chairId);
    if (list) list.push(sitter);
    else byChair.set(chairId, [sitter]);
  };
  if (self) add(self);
  for (const peer of peers) add(peer);
  for (const list of byChair.values())
    if (list.length > 1) list.sort((a, b) => (a.seat ?? Infinity) - (b.seat ?? Infinity));
  return byChair;
}

export function sameSitters(a: ChairSitters, b: ChairSitters): boolean {
  if (a.size !== b.size) return false;
  for (const [chair, list] of a) {
    const other = b.get(chair);
    if (!other || other.length !== list.length) return false;
    if (
      list.some((s, i) => {
        const o = other[i]!;
        return s.name !== o.name || s.color !== o.color || s.seat !== o.seat || s.scale !== o.scale;
      })
    )
      return false;
  }
  return true;
}

/** An occupied ring, in a drawing's grid units. */
export type SeatRing = { cx: number; cy: number; rx: number; ry: number };

// The ring round one seat: a flat ellipse on the floor at the sitter's feet, the size of a chair's, never so wide
// that it runs into the ring of a seat beside it.
const SEAT_RING_RX = 20;
const SEAT_RING_RY = 8;
const SEAT_RING_SHARE = 0.45;

/** The ring round seat `index` of a drawing (its seats as fractions of its grid), or null for a seat it lacks. */
export function seatRing(grid: SeatGrid, index: number | undefined): SeatRing | null {
  const seat = index === undefined ? undefined : grid.seats[index];
  if (!seat) return null;
  const cx = seat.u * grid.width;
  const cy = seat.v * grid.height;
  let rx = SEAT_RING_RX;
  grid.seats.forEach((other, i) => {
    if (i === index) return;
    const dy = Math.abs(other.v * grid.height - cy);
    // A seat beside this one (on its row, not above or below it) narrows the ring to its share of the gap.
    if (dy < SEAT_RING_RY * 2)
      rx = Math.min(rx, Math.abs(other.u * grid.width - cx) * SEAT_RING_SHARE);
  });
  return { cx, cy, rx, ry: SEAT_RING_RY };
}

/** The gap between the name pill and the chrome over the highest head, in canvas px. */
export const SEAT_PILL_GAP = 3;

/**
 * Where a piece's name pill ends (its bottom edge), in canvas px down from the top of the piece's box: above the
 * highest sitter's head and the name chip and status over it (AVATAR_HEAD_CHROME), from each sitter's seat in the
 * drawing (fitted whole and centred in the box, as every renderer draws it) and their size; never below the box's top.
 * A sitter without a seat in the drawing is taken at its first.
 */
export function seatPillBottom(
  box: Rect,
  grid: SeatGrid,
  sitters: readonly Pick<Sitter, 'seat' | 'scale'>[],
): number {
  const drawn = drawnRect(box, grid);
  let top = 0;
  for (const sitter of sitters) {
    const seat = grid.seats[sitter.seat ?? 0] ?? grid.seats[0];
    if (!seat) continue;
    const feet = drawn.y - box.y + drawn.height * seat.v;
    top = Math.min(
      top,
      feet - (AVATAR_HEIGHT * (sitter.scale ?? avatarScale('regular')) + AVATAR_HEAD_CHROME),
    );
  }
  return top - SEAT_PILL_GAP;
}
