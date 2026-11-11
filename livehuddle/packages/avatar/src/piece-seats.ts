// The seat grids of the office's other sitting pieces (docs/specs/009-elements/office.md): pods, stools, the
// ping-pong table, benches, the picnic table, the hammock, bean bags, the reading nook, nap pods, the treadmill,
// weight bench, phone booth, standing and hot desks. Each a front grid and its back and side views. Re-exported
// from ./seats, which builds every piece's views from them. Pure: no React, no DOM.
import type { FixedSeatGrid, SeatGrid } from './seats';

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
