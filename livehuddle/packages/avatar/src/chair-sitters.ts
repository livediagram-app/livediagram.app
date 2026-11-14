// Who is sitting in each chair, from presence, never from the document (docs/specs/008-canvas/avatar-mode.md):
// our own character plus every seated peer, keyed by chair id, each on the seat they hold; and where a piece marks
// them (docs/specs/009-elements/chair.md "Occupancy is presence"): a ring on each taken seat of a piece
// with several, and the name pill clear of the highest head. Pure: no React, no DOM.

import type { Rect } from '@liveworkspace/model-core/geometry-primitives';
import { avatarScale, peerAvatarConfig } from './config';
import { seatsACharacter } from './office-geometry';
import { isSceneShape, type AvatarSceneElement } from './scene';
import { claimOf, type SeatClaim } from './seat-claims';
import { avatarStatusLabel, parseAvatarStatus } from './status';
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

// --- Neighbours' name chips, seated or standing (docs/specs/008-canvas/avatar-mode.md "Seated neighbours' chips never
// cover each other", Work Tracker #597, 799) ------------------------------------------------------------------------

// A chip's measures in canvas px (AvatarWalker): 10 px semibold text, 6 px padding each side, a peer's chip at most 120
// wide (180 with a status), the status dot 8 wide with a 4 px gap. A character's width is taken a touch wide (Inter's
// semibold averages under 6 px at 10 px), so a spread never leaves two chips touching.
const CHIP_PAD = 12;
const CHIP_CHAR = 6;
const CHIP_DOT = 12;
const CHIP_NAME_MAX = 120;
const CHIP_STATUS_MAX = 180;
// A chip's height: chips whose tops are closer than this share a row and can cover each other.
export const NAME_CHIP_HEIGHT = 16;
/** The space kept between two spread chips, in canvas px. */
export const NAME_CHIP_GAP = 4;

/**
 * How wide a character's chip draws, in canvas px: a peer's name (and status label, "· Busy"), or your own status chip
 * (no name), at the widths AvatarWalker caps them to.
 */
export function nameChipWidth(
  name: string | null | undefined,
  status: string | null | undefined,
): number {
  if (!name) return status ? CHIP_PAD + CHIP_DOT + (status.length + 2) * CHIP_CHAR : 0;
  if (!status) return Math.min(CHIP_NAME_MAX, CHIP_PAD + name.length * CHIP_CHAR);
  return Math.min(
    CHIP_STATUS_MAX,
    CHIP_PAD + CHIP_DOT + (name.length + status.length + 3) * CHIP_CHAR,
  );
}

/** A chip as the spread reads it: where its middle stands (over the head), its top, and its width, in canvas px. */
export type NameChip = { key: string; x: number; top: number; width: number };

/**
 * How far each chip moves sideways so no two in a row cover each other, by key (only the chips that move). Chips
 * whose tops are within NAME_CHIP_HEIGHT share a row; in a row, chips that would overlap (or come closer than
 * NAME_CHIP_GAP) pack side by side in the order their middles run, the packed run centred where its chips' middles
 * want it (the least total move), merging with a neighbouring run it then reaches.
 */
export function spreadNameChips(chips: readonly NameChip[]): Map<string, number> {
  const shifts = new Map<string, number>();
  if (chips.length < 2) return shifts;
  const byTop = [...chips].sort((a, b) => a.top - b.top);
  let row: NameChip[] = [];
  for (const chip of byTop) {
    if (row.length > 0 && chip.top - row[0]!.top >= NAME_CHIP_HEIGHT) {
      spreadRow(row, shifts);
      row = [];
    }
    row.push(chip);
  }
  spreadRow(row, shifts);
  return shifts;
}

// A run of chips packed side by side: its chips in order, its packed width, its left edge, and the sum of the left
// edge each chip wants the run to have (their mean is where the run stands).
type ChipRun = { chips: NameChip[]; width: number; left: number; wantSum: number };

function spreadRow(row: readonly NameChip[], shifts: Map<string, number>) {
  if (row.length < 2) return;
  const sorted = [...row].sort((a, b) => a.x - b.x || a.key.localeCompare(b.key));
  const runs: ChipRun[] = [];
  for (const chip of sorted) {
    const want = chip.x - chip.width / 2;
    let run: ChipRun = { chips: [chip], width: chip.width, left: want, wantSum: want };
    // Merge back while the run before reaches this one.
    while (runs.length > 0) {
      const prev = runs[runs.length - 1]!;
      if (prev.left + prev.width + NAME_CHIP_GAP <= run.left) break;
      runs.pop();
      const offset = prev.width + NAME_CHIP_GAP;
      const chips = [...prev.chips, ...run.chips];
      // This run's chips now stand `offset` further into the merged run, so each wants its left that much less.
      const wantSum = prev.wantSum + run.wantSum - offset * run.chips.length;
      run = { chips, width: offset + run.width, wantSum, left: wantSum / chips.length };
    }
    runs.push(run);
  }
  for (const run of runs) {
    if (run.chips.length < 2) continue;
    let at = run.left;
    for (const chip of run.chips) {
      const shift = at + chip.width / 2 - chip.x;
      if (Math.abs(shift) > 1e-6) shifts.set(chip.key, shift);
      at += chip.width + NAME_CHIP_GAP;
    }
  }
}

/**
 * A character as the chip spread reads it: its feet, its size, whether it sits or stands still, and what its chip
 * shows.
 */
export type ChipBearer = {
  key: string;
  x: number;
  y: number;
  scale?: number;
  seated: boolean;
  // Standing still anywhere (avatar-mode.md "Standing neighbours' chips", Work Tracker 799): on an Avatar Pad, where
  // everyone arrives on the same spot, beside a full bench, shoulder to shoulder at an Arcade Machine or a desk.
  still?: boolean;
  // A peer's name; none for your own character, whose chip is its status alone.
  name?: string | null;
  // The status's label ("Busy"), or none.
  status?: string | null;
};

/** How wide a chip draws, from its name and status: the measure (chip-widths.ts), or the estimate. */
export type ChipWidthOf = (
  name: string | null | undefined,
  status: string | null | undefined,
) => number;

/**
 * The sideways move of each chip over a seated character or one standing still, by key, so neighbours' chips never
 * cover each other: only chips that would come within NAME_CHIP_GAP of another move. A walking character's chip
 * stays over its head (it moves on at once), and a character with no chip takes no room. `widthOf` is each chip's
 * width: the measured one where the caller has it.
 */
export function seatedChipShifts(
  bearers: readonly ChipBearer[],
  widthOf: ChipWidthOf = nameChipWidth,
): Map<string, number> {
  const chips: NameChip[] = [];
  for (const b of bearers) {
    if (!b.seated && !b.still) continue;
    const width = widthOf(b.name, b.status);
    if (width === 0) continue;
    const scale = b.scale ?? avatarScale('regular');
    chips.push({ key: b.key, x: b.x, top: b.y - AVATAR_HEIGHT * scale, width });
  }
  return spreadNameChips(chips);
}

/** A peer's character as the chip spread reads it, from their presence. */
export type ChipPeer = {
  id: string;
  name: string;
  avatar: {
    x: number;
    y: number;
    walking?: boolean;
    seatedOn?: string | null;
    status?: unknown;
    config?: unknown;
  };
};

/**
 * The chip bearers among peers: everyone seated or standing still, keyed by peer id. A walker is passed over before
 * anything is parsed, so a room of walkers costs a flag read each per frame; a costume is parsed once per costume
 * (peerAvatarConfig keeps them).
 */
export function peerChipBearers(peers: readonly ChipPeer[]): ChipBearer[] {
  const bearers: ChipBearer[] = [];
  for (const peer of peers) {
    const { avatar } = peer;
    const seated = !!avatar.seatedOn;
    if (!seated && avatar.walking) continue;
    const status = parseAvatarStatus(avatar.status);
    bearers.push({
      key: peer.id,
      x: avatar.x,
      y: avatar.y,
      scale: avatarScale(peerAvatarConfig(avatar.config).size),
      seated,
      still: !seated,
      name: peer.name,
      status: status ? avatarStatusLabel(status) : null,
    });
  }
  return bearers;
}
