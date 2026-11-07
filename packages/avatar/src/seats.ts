// Seat geometry (livediagram's docs/specs/009-elements/chair.md "Seat point" and office.md "Meeting Table"): where a
// character's feet go when it sits in a chair, desk, sofa or meeting table, and which way it then faces. Each piece
// is drawn by its product (livediagram's seating.ts and office.ts); every drawing takes its grid and its seats from
// here, so a seat and the cushion it is drawn on share one grid and cannot drift apart, and another product seats a
// character without importing livediagram's document package. Pure: no React, no DOM.

import type { Rect } from '@liveworkspace/model-core/geometry-primitives';
import type { SitKind } from './office-geometry';
import { facingView, turnedSitterFacing, type SeatFacing, type SeatView } from './facing';
import type { AvatarFacing } from './walk';

// The facings and their drawings are every piece's, seats or none (facing.ts); re-exported here where the seats
// first had them.
export { facingView, type SeatFacing, type SeatView } from './facing';

/** Which way somebody sitting in a chair, desk or sofa looks: the seat points away from its back. */
export const SEAT_SITTER_FACING: Readonly<Record<SeatFacing, AvatarFacing>> = {
  n: 'down',
  e: 'left',
  s: 'up',
  w: 'right',
};

// Where a new one's back is. A chair and a sofa face the reader; a desk is placed with its desk at the top and its
// chair in front, so the sitter faces up, at the computer, with their back to you. So are the pieces whose sitter
// faces up at what they use: a treadmill's console, a standing desk's and a hot desk's monitor, and the bar a bar
// stool is pulled up to (livehuddle's docs/specs/009-elements/furniture-facing.md "The camera").
export const DEFAULT_SEATING_FACING: Readonly<Record<SitKind, SeatFacing>> = {
  chair: 'n',
  sofa: 'n',
  desk: 's',
  'meeting-table': 'n',
  'office-pod': 'n',
  'bar-stool': 's',
  'ping-pong-table': 'n',
  bench: 'n',
  'picnic-table': 'n',
  hammock: 'n',
  'bean-bag': 'n',
  'reading-nook': 'n',
  'nap-pod': 'n',
  treadmill: 's',
  'weight-bench': 'n',
  'phone-booth': 'n',
  'standing-desk': 's',
  'hot-desk': 's',
};

export function seatingFacing(el: { shape: SitKind; chairFacing?: SeatFacing }): SeatFacing {
  return el.chairFacing ?? DEFAULT_SEATING_FACING[el.shape];
}

/** Where a sitter's feet go on a drawing, as fractions of its grid. */
export type SeatSpot = { u: number; v: number };

/** One drawing's grid and where a sitter's feet go on it, as fractions of the grid. */
export type SeatGrid = {
  width: number;
  height: number;
  seats: readonly SeatSpot[];
};

// A chair: square enough to turn in place, so all three drawings share one grid.
const CHAIR_SEATS: Record<SeatView, SeatGrid> = {
  front: { width: 64, height: 72, seats: [{ u: 0.5, v: 0.62 }] },
  back: { width: 64, height: 72, seats: [{ u: 0.5, v: 0.38 }] },
  side: { width: 64, height: 72, seats: [{ u: 0.38, v: 0.5 }] },
};

// A desk with its chair: the sitter faces the computer.
const DESK_SEATS: Record<SeatView, SeatGrid> = {
  front: { width: 120, height: 112, seats: [{ u: 0.5, v: 0.26 }] },
  back: { width: 120, height: 112, seats: [{ u: 0.5, v: 0.68 }] },
  side: { width: 112, height: 120, seats: [{ u: 0.62, v: 0.52 }] },
};

// A two-seater sofa: two cushions side by side, stacked down it on its side.
const SOFA_SEATS: Record<SeatView, SeatGrid> = {
  front: {
    width: 136,
    height: 76,
    seats: [
      { u: 44 / 136, v: 0.58 },
      { u: 92 / 136, v: 0.58 },
    ],
  },
  back: {
    width: 136,
    height: 76,
    // Seat 0 is the same cushion in every view: turned half round, the left cushion is on the right.
    seats: [
      { u: 92 / 136, v: 0.27 },
      { u: 44 / 136, v: 0.27 },
    ],
  },
  side: {
    width: 76,
    height: 136,
    seats: [
      { u: 33 / 76, v: 44 / 136 },
      { u: 33 / 76, v: 88 / 136 },
    ],
  },
};

/** Every seating kind that turns with its facing: its three drawings' grids and seats. */
export const SEAT_GRIDS: Readonly<
  Record<'chair' | 'desk' | 'sofa', Readonly<Record<SeatView, SeatGrid>>>
> = { chair: CHAIR_SEATS, desk: DESK_SEATS, sofa: SOFA_SEATS };

/** A meeting table's seat, which also says which way its sitter faces: always toward the table. */
export type TableSeat = { u: number; v: number; facing: AvatarFacing };

const TW = 232;
const TH = 168;

// Six chairs round a table, every seat facing it: two beyond (their sitters face you), two in front (their backs to
// you), one at each end in profile: its front drawing.
export const MEETING_TABLE_SEATS: { width: number; height: number; seats: readonly TableSeat[] } = {
  width: TW,
  height: TH,
  seats: [
    { u: 86 / TW, v: 40 / TH, facing: 'down' },
    { u: 146 / TW, v: 40 / TH, facing: 'down' },
    { u: 86 / TW, v: 116 / TH, facing: 'up' },
    { u: 146 / TW, v: 116 / TH, facing: 'up' },
    { u: 21 / TW, v: 72 / TH, facing: 'right' },
    { u: 211 / TW, v: 72 / TH, facing: 'left' },
  ],
};

// The table turned (livehuddle's docs/specs/009-elements/furniture-facing.md "A turn"), its six seats in the same order
// as the front's. From behind it reads the same, so its back is the front's drawing with every chair a half turn round:
// the two beyond are now the two in front, and the ends swap. On its side it is a tall table: the two that sat beyond
// now sit down its right, the two in front down its left, the left end's chair at its top and the right end's at its
// foot.
export const MEETING_TABLE_SEATS_BACK: SeatGrid = {
  width: TW,
  height: TH,
  seats: [
    { u: 146 / TW, v: 116 / TH },
    { u: 86 / TW, v: 116 / TH },
    { u: 146 / TW, v: 40 / TH },
    { u: 86 / TW, v: 40 / TH },
    { u: 211 / TW, v: 72 / TH },
    { u: 21 / TW, v: 72 / TH },
  ],
};

export const MEETING_TABLE_SEATS_SIDE: SeatGrid = {
  width: TH,
  height: TW,
  seats: [
    { u: 147 / TH, v: 86 / TW },
    { u: 147 / TH, v: 134 / TW },
    { u: 21 / TH, v: 86 / TW },
    { u: 21 / TH, v: 134 / TW },
    { u: 84 / TH, v: 40 / TW },
    { u: 84 / TH, v: 186 / TW },
  ],
};

/** A drawing's grid and its seats, each with the way its sitter faces in it. */
export type FixedSeatGrid = { width: number; height: number; seats: readonly TableSeat[] };

/** The Meeting Table's long type (livehuddle's office.md "Long Table"): a boardroom table drawn to its length. */
export const LONG_TABLE_VARIANT = 'long';

// Where its chairs go: the side chairs between this far in from each end, this far apart at least.
const LONG_TABLE_SIDE_IN = 86;
const LONG_TABLE_PITCH = 60;

/** The x of each side chair along a long table's grid `width` (at least two, spaced evenly). */
export function longTableSideXs(width: number): number[] {
  const run = Math.max(0, width - 2 * LONG_TABLE_SIDE_IN);
  const n = Math.max(2, Math.floor(run / LONG_TABLE_PITCH) + 1);
  return Array.from({ length: n }, (_, i) => LONG_TABLE_SIDE_IN + (run * i) / (n - 1));
}

/**
 * A long table's length along its grid for a box: the Meeting Table's 168 px deep drawing as long as the box's
 * proportions allow (so it fills the box), measured across the box when it faces Down or Up and down it on its side
 * (livehuddle's furniture-facing.md "A turn").
 */
export function longTableLength(
  boxWidth: number,
  boxHeight: number,
  facing: SeatFacing = 'n',
): number {
  const onSide = facing === 'e' || facing === 'w';
  const along = onSide ? boxHeight : boxWidth;
  const across = onSide ? boxWidth : boxHeight;
  return Math.max(TW, Math.round((along * TH) / Math.max(1, across)));
}

/**
 * A long table's front grid for a box: its side chairs along both sides and one at each end, every seat facing the
 * table.
 */
export function longTableGrid(boxWidth: number, boxHeight: number): FixedSeatGrid {
  return longTableFront(longTableLength(boxWidth, boxHeight));
}

function longTableFront(width: number): FixedSeatGrid {
  const xs = longTableSideXs(width);
  return {
    width,
    height: TH,
    seats: [
      ...xs.map((x): TableSeat => ({ u: x / width, v: 40 / TH, facing: 'down' })),
      ...xs.map((x): TableSeat => ({ u: x / width, v: 116 / TH, facing: 'up' })),
      { u: 21 / width, v: 72 / TH, facing: 'right' },
      { u: (width - 21) / width, v: 72 / TH, facing: 'left' },
    ],
  };
}

/** Where a long table of `length` puts its side chairs down it on its side (the Meeting Table's 86 and 134 at 232). */
export function longTableSideYs(length: number): number[] {
  const k = (length - 184) / Math.max(1, length - 172);
  return longTableSideXs(length).map((x) => 86 + (x - 86) * k);
}

/**
 * A long table's seats in each of its drawings, `length` long (the Meeting Table's turn, stretched): from behind every
 * chair a half turn round, so the far row is the near one and the ends swap; on its side the far row down its right,
 * the near row down its left, the left end's chair at its top and the right end's at its foot.
 */
export function longTableSeatViews(length: number): SeatViews {
  const cached = longTableViews.get(length);
  if (cached) return cached;
  const views = buildLongTableViews(length);
  // A sitter's seat is read every walk frame; a table's length changes only on a resize, so keep the last few.
  if (longTableViews.size >= 16) longTableViews.clear();
  longTableViews.set(length, views);
  return views;
}

const longTableViews = new Map<number, SeatViews>();

function buildLongTableViews(length: number): SeatViews {
  const front = longTableFront(length);
  const xs = longTableSideXs(length);
  const ys = longTableSideYs(length);
  const L = length;
  return {
    facings: front.seats.map((s) => s.facing),
    front: seatSpots(front),
    back: {
      width: L,
      height: TH,
      seats: [
        ...xs.map((x) => ({ u: (L - x) / L, v: 116 / TH })),
        ...xs.map((x) => ({ u: (L - x) / L, v: 40 / TH })),
        { u: (L - 21) / L, v: 72 / TH },
        { u: 21 / L, v: 72 / TH },
      ],
    },
    side: {
      width: TH,
      height: L,
      seats: [
        ...ys.map((y) => ({ u: 147 / TH, v: y / L })),
        ...ys.map((y) => ({ u: 21 / TH, v: y / L })),
        { u: 84 / TH, v: 40 / L },
        { u: 84 / TH, v: (L - 46) / L },
      ],
    },
  };
}

// An Office Pod (livehuddle's docs/specs/009-elements/office.md "Office Pod"): two benches facing each other across a
// table, inside the pod's walls (pod.ts draws the walls on this grid).
export const POD_SEATS: FixedSeatGrid = {
  width: 176,
  height: 144,
  seats: [
    { u: 30 / 176, v: 104 / 144, facing: 'right' },
    { u: 146 / 176, v: 104 / 144, facing: 'left' },
  ],
};

// The pod turned: from behind its benches swap sides (its doorway now in the far wall); on its side the two benches
// run across it, one at the top and one at the foot, facing each other over the table (pod.ts turns its walls to match).
export const POD_SEATS_BACK: SeatGrid = {
  width: 176,
  height: 144,
  seats: [
    { u: 146 / 176, v: 104 / 144 },
    { u: 30 / 176, v: 104 / 144 },
  ],
};

export const POD_SEATS_SIDE: SeatGrid = {
  width: 144,
  height: 176,
  seats: [
    { u: 72 / 144, v: 68 / 176 },
    { u: 72 / 144, v: 142 / 176 },
  ],
};

// A Bar Stool (office.md "Bar, Bar Stool"): one seat, its sitter facing up the canvas, toward the bar.
export const BAR_STOOL_SEATS: FixedSeatGrid = {
  width: 44,
  height: 64,
  seats: [{ u: 0.5, v: 0.4, facing: 'up' }],
};

// livehuddle's social pieces (its docs/specs/009-elements/social-pieces.md): a player at each end of a ping-pong
// table facing the table, two side by side on a bench facing you, six round a picnic table facing it, one in a hammock.
export const PING_PONG_SEATS: FixedSeatGrid = {
  width: 184,
  height: 112,
  seats: [
    { u: 14 / 184, v: 70 / 112, facing: 'right' },
    { u: 170 / 184, v: 70 / 112, facing: 'left' },
  ],
};

// Its back to you, the same two players at swapped ends; on its side, the left seat at the far end (the top) and the
// right seat at the near end (the bottom).
export const PING_PONG_SEATS_BACK: SeatGrid = {
  width: 184,
  height: 112,
  seats: [
    { u: 170 / 184, v: 70 / 112 },
    { u: 14 / 184, v: 70 / 112 },
  ],
};

export const PING_PONG_SEATS_SIDE: SeatGrid = {
  width: 112,
  height: 184,
  seats: [
    { u: 56 / 112, v: 20 / 184 },
    { u: 56 / 112, v: 166 / 184 },
  ],
};

export const BENCH_SEATS: FixedSeatGrid = {
  width: 136,
  height: 64,
  seats: [
    { u: 44 / 136, v: 40 / 64, facing: 'down' },
    { u: 92 / 136, v: 40 / 64, facing: 'down' },
  ],
};

export const PICNIC_TABLE_SEATS: FixedSeatGrid = {
  width: 200,
  height: 152,
  seats: [
    { u: 50 / 200, v: 34 / 152, facing: 'down' },
    { u: 100 / 200, v: 34 / 152, facing: 'down' },
    { u: 150 / 200, v: 34 / 152, facing: 'down' },
    { u: 50 / 200, v: 120 / 152, facing: 'up' },
    { u: 100 / 200, v: 120 / 152, facing: 'up' },
    { u: 150 / 200, v: 120 / 152, facing: 'up' },
  ],
};

export const HAMMOCK_SEATS: FixedSeatGrid = {
  width: 152,
  height: 80,
  seats: [{ u: 0.5, v: 46 / 80, facing: 'down' }],
};

// Turned (furniture-facing.md "A turn"): seat i is the same cushion in every drawing. From behind a bench and a picnic
// table are turned half way round, so their seats swap ends; on its side a piece's left end is at the top, its front
// on the left. A hammock reads the same from behind.
export const BENCH_SEATS_BACK: SeatGrid = {
  width: 136,
  height: 64,
  seats: [
    { u: 92 / 136, v: 18 / 64 },
    { u: 44 / 136, v: 18 / 64 },
  ],
};

export const BENCH_SEATS_SIDE: SeatGrid = {
  width: 56,
  height: 164,
  seats: [
    { u: 22 / 56, v: 63 / 164 },
    { u: 22 / 56, v: 107 / 164 },
  ],
};

export const PICNIC_TABLE_SEATS_BACK: SeatGrid = {
  width: 200,
  height: 152,
  seats: [
    { u: 150 / 200, v: 120 / 152 },
    { u: 100 / 200, v: 120 / 152 },
    { u: 50 / 200, v: 120 / 152 },
    { u: 150 / 200, v: 34 / 152 },
    { u: 100 / 200, v: 34 / 152 },
    { u: 50 / 200, v: 34 / 152 },
  ],
};

export const PICNIC_TABLE_SEATS_SIDE: SeatGrid = {
  width: 144,
  height: 208,
  seats: [
    { u: 127 / 144, v: 50 / 208 },
    { u: 127 / 144, v: 100 / 208 },
    { u: 127 / 144, v: 150 / 208 },
    { u: 17 / 144, v: 50 / 208 },
    { u: 17 / 144, v: 100 / 208 },
    { u: 17 / 144, v: 150 / 208 },
  ],
};

export const HAMMOCK_SEATS_SIDE: SeatGrid = {
  width: 64,
  height: 200,
  seats: [{ u: 0.5, v: 100 / 200 }],
};

// The breakout seating (social-pieces.md "Bean Bag, Reading Nook"): one sitter sunk in a bean bag, one in a reading
// nook's armchair, both facing down the canvas.
export const BEAN_BAG_SEATS: FixedSeatGrid = {
  width: 64,
  height: 56,
  seats: [{ u: 0.5, v: 36 / 56, facing: 'down' }],
};

// From behind, the hollow beyond its raised back; on its side, the hollow on the left, the back rising on the right.
export const BEAN_BAG_SEATS_BACK: SeatGrid = {
  width: 64,
  height: 56,
  seats: [{ u: 0.5, v: 26 / 56 }],
};

export const BEAN_BAG_SEATS_SIDE: SeatGrid = {
  width: 64,
  height: 56,
  seats: [{ u: 26 / 64, v: 36 / 56 }],
};

export const READING_NOOK_SEATS: FixedSeatGrid = {
  width: 160,
  height: 112,
  seats: [{ u: 76 / 160, v: 64 / 112, facing: 'down' }],
};

// The nook from behind, the armchair's back nearest you (the set mirrored, the lamp now on the left), and facing left,
// the armchair in the middle of the rug, the side table beyond it and the lamp nearer you.
export const READING_NOOK_SEATS_BACK: SeatGrid = {
  width: 160,
  height: 112,
  seats: [{ u: 84 / 160, v: 40 / 112 }],
};

export const READING_NOOK_SEATS_SIDE: SeatGrid = {
  width: 112,
  height: 160,
  seats: [{ u: 58 / 112, v: 92 / 160 }],
};

// livehuddle's workday pieces (its docs/specs/009-elements/workday-pieces.md "How each one walks"): one seat each. A nap
// pod's sitter reclines facing you; a treadmill's stands on its belt, a standing desk's in front of it and a hot desk's
// sits in front of it, all three facing up the canvas (at the console or the monitor); a weight bench's sits on the
// bench and a phone booth's on its stool, facing you.
export const NAP_POD_SEATS: FixedSeatGrid = {
  width: 120,
  height: 112,
  seats: [{ u: 0.5, v: 78 / 112, facing: 'down' }],
};

export const TREADMILL_SEATS: FixedSeatGrid = {
  width: 72,
  height: 112,
  seats: [{ u: 0.5, v: 86 / 112, facing: 'up' }],
};

export const WEIGHT_BENCH_SEATS: FixedSeatGrid = {
  width: 136,
  height: 88,
  seats: [{ u: 80 / 136, v: 60 / 88, facing: 'down' }],
};

export const PHONE_BOOTH_SEATS: FixedSeatGrid = {
  width: 80,
  height: 136,
  seats: [{ u: 0.5, v: 112 / 136, facing: 'down' }],
};

export const STANDING_DESK_SEATS: FixedSeatGrid = {
  width: 112,
  height: 104,
  seats: [{ u: 0.5, v: 96 / 104, facing: 'up' }],
};

export const HOT_DESK_SEATS: FixedSeatGrid = {
  width: 120,
  height: 112,
  seats: [{ u: 0.5, v: 84 / 112, facing: 'up' }],
};

// The workday pieces turned (furniture-facing.md "A turn"): each seat on the piece's other drawings. A nap pod's sitter
// is under its hood from behind and reclines across it on its side; a treadmill's stands on the belt beyond its
// console, or along it; a weight bench's sits on the pad, its rack at the other end or at the top; a phone booth's stool
// stands near its glass, so beyond its back wall from behind and nearer the left on its side; the desks' sitters stand
// or sit beyond their desk, or to its right.
export const NAP_POD_SEATS_BACK: SeatGrid = {
  width: 120,
  height: 112,
  seats: [{ u: 0.5, v: 40 / 112 }],
};

export const NAP_POD_SEATS_SIDE: SeatGrid = {
  width: 112,
  height: 120,
  seats: [{ u: 56 / 112, v: 66 / 120 }],
};

export const TREADMILL_SEATS_FRONT: SeatGrid = {
  width: 72,
  height: 112,
  seats: [{ u: 0.5, v: 46 / 112 }],
};

export const TREADMILL_SEATS_SIDE: SeatGrid = {
  width: 112,
  height: 72,
  seats: [{ u: 64 / 112, v: 47 / 72 }],
};

export const WEIGHT_BENCH_SEATS_BACK: SeatGrid = {
  width: 136,
  height: 88,
  seats: [{ u: 56 / 136, v: 60 / 88 }],
};

export const WEIGHT_BENCH_SEATS_SIDE: SeatGrid = {
  width: 88,
  height: 136,
  seats: [{ u: 44 / 88, v: 77 / 136 }],
};

export const PHONE_BOOTH_SEATS_BACK: SeatGrid = {
  width: 80,
  height: 136,
  seats: [{ u: 0.5, v: 110 / 136 }],
};

export const PHONE_BOOTH_SEATS_SIDE: SeatGrid = {
  width: 80,
  height: 136,
  seats: [{ u: 36 / 80, v: 112 / 136 }],
};

export const STANDING_DESK_SEATS_FRONT: SeatGrid = {
  width: 112,
  height: 104,
  seats: [{ u: 0.5, v: 38 / 104 }],
};

export const STANDING_DESK_SEATS_SIDE: SeatGrid = {
  width: 104,
  height: 112,
  seats: [{ u: 70 / 104, v: 66 / 112 }],
};

export const HOT_DESK_SEATS_FRONT: SeatGrid = {
  width: 120,
  height: 112,
  seats: [{ u: 0.5, v: 28 / 112 }],
};

export const HOT_DESK_SEATS_SIDE: SeatGrid = {
  width: 112,
  height: 120,
  seats: [{ u: 70 / 112, v: 62 / 120 }],
};

/** The spots of a grid whose seats name their facing: the grid as a drawing reads it. */
export function seatSpots(grid: FixedSeatGrid): SeatGrid {
  return {
    width: grid.width,
    height: grid.height,
    seats: grid.seats.map(({ u, v }) => ({ u, v })),
  };
}

/**
 * A piece's seats in each of its three drawings (livehuddle's docs/specs/009-elements/furniture-facing.md "A turn"):
 * `facings` says which way each seat's sitter faces in the **front** drawing, and `front`, `back` and `side` say where
 * each seat lies on that drawing's grid, the same seats in the same order, so a seat claim (its index) holds the same
 * cushion at every facing. A sitter's facing in the other drawings is the front's turned (facing.ts
 * turnedSitterFacing); facing right is the side drawing mirrored, so it has no grid of its own.
 */
export type SeatViews = {
  facings: readonly AvatarFacing[];
  front: SeatGrid;
  back: SeatGrid;
  side: SeatGrid;
};

const OPPOSITE: Record<AvatarFacing, AvatarFacing> = {
  down: 'up',
  up: 'down',
  left: 'right',
  right: 'left',
};

// A piece first drawn from behind, its sitter facing up at what they use (a treadmill's console, a desk's monitor):
// that drawing is its `back`, and its front's sitters face the other way.
function drawnFromBehind(back: FixedSeatGrid, front: SeatGrid, side: SeatGrid): SeatViews {
  return {
    facings: back.seats.map((s) => OPPOSITE[s.facing]),
    front,
    back: seatSpots(back),
    side,
  };
}

const chairLike = (grids: Readonly<Record<SeatView, SeatGrid>>): SeatViews => ({
  facings: grids.front.seats.map(() => 'down' as const),
  ...grids,
});

/** Every piece that seats a character: its seats in each of its drawings. */
export const SEAT_VIEWS: Readonly<Record<SitKind, SeatViews>> = {
  chair: chairLike(CHAIR_SEATS),
  desk: chairLike(DESK_SEATS),
  sofa: chairLike(SOFA_SEATS),
  'meeting-table': {
    facings: MEETING_TABLE_SEATS.seats.map((s) => s.facing),
    front: seatSpots(MEETING_TABLE_SEATS),
    back: MEETING_TABLE_SEATS_BACK,
    side: MEETING_TABLE_SEATS_SIDE,
  },
  'office-pod': {
    facings: POD_SEATS.seats.map((s) => s.facing),
    front: seatSpots(POD_SEATS),
    back: POD_SEATS_BACK,
    side: POD_SEATS_SIDE,
  },
  'bar-stool': drawnFromBehind(
    BAR_STOOL_SEATS,
    seatSpots(BAR_STOOL_SEATS),
    seatSpots(BAR_STOOL_SEATS),
  ),
  'ping-pong-table': {
    facings: PING_PONG_SEATS.seats.map((s) => s.facing),
    front: seatSpots(PING_PONG_SEATS),
    back: PING_PONG_SEATS_BACK,
    side: PING_PONG_SEATS_SIDE,
  },
  bench: {
    facings: BENCH_SEATS.seats.map((s) => s.facing),
    front: seatSpots(BENCH_SEATS),
    back: BENCH_SEATS_BACK,
    side: BENCH_SEATS_SIDE,
  },
  'picnic-table': {
    facings: PICNIC_TABLE_SEATS.seats.map((s) => s.facing),
    front: seatSpots(PICNIC_TABLE_SEATS),
    back: PICNIC_TABLE_SEATS_BACK,
    side: PICNIC_TABLE_SEATS_SIDE,
  },
  hammock: {
    facings: HAMMOCK_SEATS.seats.map((s) => s.facing),
    front: seatSpots(HAMMOCK_SEATS),
    back: seatSpots(HAMMOCK_SEATS),
    side: HAMMOCK_SEATS_SIDE,
  },
  'bean-bag': {
    facings: BEAN_BAG_SEATS.seats.map((s) => s.facing),
    front: seatSpots(BEAN_BAG_SEATS),
    back: BEAN_BAG_SEATS_BACK,
    side: BEAN_BAG_SEATS_SIDE,
  },
  'reading-nook': {
    facings: ['down'],
    front: seatSpots(READING_NOOK_SEATS),
    back: READING_NOOK_SEATS_BACK,
    side: READING_NOOK_SEATS_SIDE,
  },
  'nap-pod': {
    facings: ['down'],
    front: seatSpots(NAP_POD_SEATS),
    back: NAP_POD_SEATS_BACK,
    side: NAP_POD_SEATS_SIDE,
  },
  treadmill: drawnFromBehind(TREADMILL_SEATS, TREADMILL_SEATS_FRONT, TREADMILL_SEATS_SIDE),
  'weight-bench': {
    facings: ['down'],
    front: seatSpots(WEIGHT_BENCH_SEATS),
    back: WEIGHT_BENCH_SEATS_BACK,
    side: WEIGHT_BENCH_SEATS_SIDE,
  },
  'phone-booth': {
    facings: ['down'],
    front: seatSpots(PHONE_BOOTH_SEATS),
    back: PHONE_BOOTH_SEATS_BACK,
    side: PHONE_BOOTH_SEATS_SIDE,
  },
  'standing-desk': drawnFromBehind(
    STANDING_DESK_SEATS,
    STANDING_DESK_SEATS_FRONT,
    STANDING_DESK_SEATS_SIDE,
  ),
  'hot-desk': drawnFromBehind(HOT_DESK_SEATS, HOT_DESK_SEATS_FRONT, HOT_DESK_SEATS_SIDE),
};

/** A seating piece as the seat geometry reads it: its box, its kind and where its back is. */
export type SeatedBox = Rect & { shape: SitKind; chairFacing?: SeatFacing; variant?: unknown };

/** A seat's feet point in canvas coordinates, and which way its sitter faces. */
export type Seat = { x: number; y: number; facing: AvatarFacing };

/** Every seat's feet point, in canvas coordinates, from the drawing its facing shows. */
export function seatPoints(el: SeatedBox): Seat[] {
  const facing = seatingFacing(el);
  const views =
    el.shape === 'meeting-table' && el.variant === LONG_TABLE_VARIANT
      ? longTableSeatViews(longTableLength(el.width, el.height, facing))
      : SEAT_VIEWS[el.shape];
  const { view: name, mirrored } = facingView(facing);
  const grid = views[name];
  const drawn = drawnRect(el, grid);
  return grid.seats.map(({ u, v }, i) => ({
    x: drawn.x + drawn.width * (mirrored ? 1 - u : u),
    y: drawn.y + drawn.height * v,
    facing: turnedSitterFacing(views.facings[i]!, facing),
  }));
}

// Where the drawing actually lies in the box: every renderer fits its grid whole and centred (preserveAspectRatio
// meet), so a box of other proportions (a quarter turn written without swapping the box, an aspect unlocked and
// stretched) letterboxes it, and a seat measured on the whole box would miss the drawn cushion.
export function drawnRect(box: Rect, view: { width: number; height: number }): Rect {
  const scale = Math.min(box.width / view.width, box.height / view.height);
  const width = view.width * scale;
  const height = view.height * scale;
  return {
    x: box.x + (box.width - width) / 2,
    y: box.y + (box.height - height) / 2,
    width,
    height,
  };
}

/** The seat nearest a point (where the character walked in), so a sofa seats you on your side. */
export function nearestSeat(el: SeatedBox, from: { x: number; y: number }): Seat {
  const seats = seatPoints(el);
  let best = seats[0]!;
  for (const seat of seats) {
    if (Math.hypot(seat.x - from.x, seat.y - from.y) < Math.hypot(best.x - from.x, best.y - from.y))
      best = seat;
  }
  return best;
}

/**
 * Where a character walking in from `from` sits, and which way it faces: the nearest seat, facing the way that seat
 * faces at the piece's facing. What a product's chair arrival hands `sitOn`.
 */
export function seatFor(
  el: SeatedBox,
  from: { x: number; y: number },
): { x: number; y: number; facing: AvatarFacing } {
  const seat = nearestSeat(el, from);
  return { x: seat.x, y: seat.y, facing: seat.facing };
}
