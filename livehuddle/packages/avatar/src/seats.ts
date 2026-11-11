// Seat geometry (docs/specs/009-elements/chair.md "Seat point" and office.md "Meeting Table"): where a
// character's feet go when it sits in a chair, desk, sofa or meeting table, and which way it then faces. Each piece
// is drawn by the document package (its furniture-parts.ts and office pieces); every drawing takes its grid and its
// seats from here, so a seat and the cushion it is drawn on share one grid and cannot drift apart, and the walk seats a
// character without importing the document package. Pure: no React, no DOM.
import type { Rect } from '@liveworkspace/model-core/geometry-primitives';
import type { SitKind } from './office-geometry';
import { facingView, turnedSitterFacing, type SeatFacing, type SeatView } from './facing';
import type { AvatarFacing } from './walk';
import { LECTERN_SEATS, LECTERN_SEATS_BACK, LECTERN_SEATS_SIDE } from './lectern-seats';
import {
  BAR_STOOL_SEATS,
  BEAN_BAG_SEATS,
  BEAN_BAG_SEATS_BACK,
  BEAN_BAG_SEATS_SIDE,
  BENCH_SEATS,
  BENCH_SEATS_BACK,
  BENCH_SEATS_SIDE,
  HAMMOCK_SEATS,
  HAMMOCK_SEATS_SIDE,
  HOT_DESK_SEATS,
  HOT_DESK_SEATS_FRONT,
  HOT_DESK_SEATS_SIDE,
  NAP_POD_SEATS,
  NAP_POD_SEATS_BACK,
  NAP_POD_SEATS_SIDE,
  PHONE_BOOTH_SEATS,
  PHONE_BOOTH_SEATS_BACK,
  PHONE_BOOTH_SEATS_SIDE,
  PICNIC_TABLE_SEATS,
  PICNIC_TABLE_SEATS_BACK,
  PICNIC_TABLE_SEATS_SIDE,
  PING_PONG_SEATS,
  PING_PONG_SEATS_BACK,
  PING_PONG_SEATS_SIDE,
  POD_SEATS,
  POD_SEATS_BACK,
  POD_SEATS_SIDE,
  READING_NOOK_SEATS,
  READING_NOOK_SEATS_BACK,
  READING_NOOK_SEATS_SIDE,
  STANDING_DESK_SEATS,
  STANDING_DESK_SEATS_FRONT,
  STANDING_DESK_SEATS_SIDE,
  TREADMILL_SEATS,
  TREADMILL_SEATS_FRONT,
  TREADMILL_SEATS_SIDE,
  WEIGHT_BENCH_SEATS,
  WEIGHT_BENCH_SEATS_BACK,
  WEIGHT_BENCH_SEATS_SIDE,
} from './piece-seats';

export * from './piece-seats';

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
// stool is pulled up to (docs/specs/009-elements/furniture-facing.md "The camera").
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
  podium: 'n',
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

// The table turned (docs/specs/009-elements/furniture-facing.md "A turn"), its six seats in the same order
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

// An Office Pod (docs/specs/009-elements/office.md "Office Pod"): two benches facing each other across a
// table, inside the pod's walls (pod.ts draws the walls on this grid).
export function seatSpots(grid: FixedSeatGrid): SeatGrid {
  return {
    width: grid.width,
    height: grid.height,
    seats: grid.seats.map(({ u, v }) => ({ u, v })),
  };
}

/**
 * A piece's seats in each of its three drawings (docs/specs/009-elements/furniture-facing.md "A turn"):
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
  // The Podium's one speaker spot (lectern-seats.ts): its speaker faces the way its front does.
  podium: {
    facings: LECTERN_SEATS.seats.map((s) => s.facing),
    front: seatSpots(LECTERN_SEATS),
    back: LECTERN_SEATS_BACK,
    side: LECTERN_SEATS_SIDE,
  },
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
