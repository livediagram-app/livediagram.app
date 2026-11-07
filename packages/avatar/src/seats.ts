// Seat geometry (livediagram's docs/specs/009-elements/chair.md "Seat point" and office.md "Meeting Table"): where a
// character's feet go when it sits in a chair, desk, sofa or meeting table, and which way it then faces. Each piece
// is drawn by its product (livediagram's seating.ts and office.ts); every drawing takes its grid and its seats from
// here, so a seat and the cushion it is drawn on share one grid and cannot drift apart, and another product seats a
// character without importing livediagram's document package. Pure: no React, no DOM.

import type { Rect } from '@liveworkspace/model-core/geometry-primitives';
import { isFixedSeatShape, type FixedSeatKind, type SitKind } from './office-geometry';
import type { AvatarFacing } from './walk';

/** Where a piece's back is: 'n' at the top, so its sitter faces down the canvas. */
export type SeatFacing = 'n' | 'e' | 's' | 'w';

/** Which way somebody sitting in a piece looks: the seat points away from its back. */
export const SEAT_SITTER_FACING: Readonly<Record<SeatFacing, AvatarFacing>> = {
  n: 'down',
  e: 'left',
  s: 'up',
  w: 'right',
};

// Where a new one's back is. A chair and a sofa face the reader; a desk is placed with its desk at the top and its
// chair in front, so the sitter faces up, at the computer, with their back to you. The meeting table reads the same
// from every side and does not turn.
export const DEFAULT_SEATING_FACING: Readonly<Record<SitKind, SeatFacing>> = {
  chair: 'n',
  sofa: 'n',
  desk: 's',
  'meeting-table': 'n',
  // The fixed seats never turn; every seat names its own facing.
  'office-pod': 'n',
  'bar-stool': 'n',
  'ping-pong-table': 'n',
  bench: 'n',
  'picnic-table': 'n',
  hammock: 'n',
  'bean-bag': 'n',
  'reading-nook': 'n',
  'nap-pod': 'n',
  treadmill: 'n',
  'weight-bench': 'n',
  'phone-booth': 'n',
  'standing-desk': 'n',
  'hot-desk': 'n',
};

export function seatingFacing(el: { shape: SitKind; chairFacing?: SeatFacing }): SeatFacing {
  return el.chairFacing ?? DEFAULT_SEATING_FACING[el.shape];
}

// A piece's three drawings: `front` with the sitter facing down the canvas ('n'), `back` facing up ('s'), `side`
// facing left ('e'); facing right ('w') is the side drawing mirrored. Nothing is ever rotated.
export type SeatView = 'front' | 'back' | 'side';

/** Which drawing a facing shows, and whether it is the mirrored side. */
export function facingView(facing: SeatFacing): { view: SeatView; mirrored: boolean } {
  switch (facing) {
    case 's':
      return { view: 'back', mirrored: false };
    case 'e':
      return { view: 'side', mirrored: false };
    case 'w':
      return { view: 'side', mirrored: true };
    default:
      return { view: 'front', mirrored: false };
  }
}

/** One drawing's grid and where a sitter's feet go on it, as fractions of the grid. */
export type SeatGrid = {
  width: number;
  height: number;
  seats: readonly { u: number; v: number }[];
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
    seats: [
      { u: 44 / 136, v: 0.27 },
      { u: 92 / 136, v: 0.27 },
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
// you), one at each end in profile. The table never turns, so this one grid serves every facing.
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

/** The Meeting Table's long type (livehuddle's office.md "Long Table"): a boardroom table drawn to its width. */
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
 * A long table's grid for a box: the Meeting Table's 168 px deep drawing as wide as the box's proportions allow (so
 * it fills the box), its side chairs along both sides and one at each end, every seat facing the table.
 */
export function longTableGrid(boxWidth: number, boxHeight: number): FixedSeatGrid {
  const width = Math.max(TW, Math.round((boxWidth * TH) / Math.max(1, boxHeight)));
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

/** A piece that never turns: its grid and its seats, each with the way its sitter faces. */
export type FixedSeatGrid = { width: number; height: number; seats: readonly TableSeat[] };

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

// The breakout seating (social-pieces.md "Bean Bag, Reading Nook"): one sitter sunk in a bean bag, one in a reading
// nook's armchair, both facing down the canvas.
export const BEAN_BAG_SEATS: FixedSeatGrid = {
  width: 64,
  height: 56,
  seats: [{ u: 0.5, v: 36 / 56, facing: 'down' }],
};

export const READING_NOOK_SEATS: FixedSeatGrid = {
  width: 160,
  height: 112,
  seats: [{ u: 76 / 160, v: 64 / 112, facing: 'down' }],
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

const FIXED_SEATS: Readonly<Record<FixedSeatKind, FixedSeatGrid>> = {
  'office-pod': POD_SEATS,
  'bar-stool': BAR_STOOL_SEATS,
  'ping-pong-table': PING_PONG_SEATS,
  bench: BENCH_SEATS,
  'picnic-table': PICNIC_TABLE_SEATS,
  hammock: HAMMOCK_SEATS,
  'bean-bag': BEAN_BAG_SEATS,
  'reading-nook': READING_NOOK_SEATS,
  'nap-pod': NAP_POD_SEATS,
  treadmill: TREADMILL_SEATS,
  'weight-bench': WEIGHT_BENCH_SEATS,
  'phone-booth': PHONE_BOOTH_SEATS,
  'standing-desk': STANDING_DESK_SEATS,
  'hot-desk': HOT_DESK_SEATS,
};

/** A seating piece as the seat geometry reads it: its box, its kind and where its back is. */
export type SeatedBox = Rect & { shape: SitKind; chairFacing?: SeatFacing; variant?: unknown };

/** A seat's feet point in canvas coordinates; a meeting table's seat also says which way its sitter faces. */
export type Seat = { x: number; y: number; facing?: AvatarFacing };

/** Every seat's feet point, in canvas coordinates, from the drawing its facing shows. */
export function seatPoints(el: SeatedBox): Seat[] {
  const shape = el.shape;
  if (shape === 'meeting-table' || isFixedSeatShape(shape)) {
    const grid =
      shape !== 'meeting-table'
        ? FIXED_SEATS[shape]
        : el.variant === LONG_TABLE_VARIANT
          ? longTableGrid(el.width, el.height)
          : MEETING_TABLE_SEATS;
    const drawn = drawnRect(el, grid);
    return grid.seats.map(({ u, v, facing }) => ({
      x: drawn.x + drawn.width * u,
      y: drawn.y + drawn.height * v,
      facing,
    }));
  }
  const { view: name, mirrored } = facingView(seatingFacing(el));
  const view = SEAT_GRIDS[shape][name];
  const drawn = drawnRect(el, view);
  return view.seats.map(({ u, v }) => ({
    x: drawn.x + drawn.width * (mirrored ? 1 - u : u),
    y: drawn.y + drawn.height * v,
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
 * says (a meeting table's) or else away from the piece's back. What a product's chair arrival hands `sitOn`.
 */
export function seatFor(
  el: SeatedBox,
  from: { x: number; y: number },
): { x: number; y: number; facing: AvatarFacing } {
  const seat = nearestSeat(el, from);
  return { x: seat.x, y: seat.y, facing: seat.facing ?? SEAT_SITTER_FACING[seatingFacing(el)] };
}
