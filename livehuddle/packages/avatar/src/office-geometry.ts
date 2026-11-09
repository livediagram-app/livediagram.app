// The virtual office's geometry the Avatar-mode walk needs (docs/specs/009-elements/office.md and
// chair.md): which pieces are floor, which give a drink, which seat a character, a room's walls and doorway, and the
// footprints of the scenery that blocks. The pieces themselves (their drawings, tones and parts) stay in each
// product's model package beside its element union, which re-exports this module. Pure: no React, no DOM.

import type { Rect } from '@liveworkspace/model-core/geometry-primitives';
import { facingView, mirrorFraction, type GridFraction, type SeatFacing } from './facing';
import { outlineWalls } from './room-outline';

// The floor pieces: placed behind everything, never blocking, never a destination. An Avatar Pad
// (docs/specs/009-elements/avatar-pad.md) lies on the floor too: characters stand on it, furniture over it. So does
// livehuddle's Stage (its docs/specs/012-collaboration/meeting-rooms-and-stage.md): a platform people stand on. And
// livehuddle's Garden Path and Grass (its docs/specs/009-elements/office.md "Garden Path", "Grass"): stones laid
// in the ground, and a lawn.
export function isFloorShape(
  kind: string,
): kind is 'room' | 'corridor' | 'rug' | 'avatar-pad' | 'stage' | 'garden-path' | 'grass' {
  return (
    kind === 'room' ||
    // livehuddle's Corridor (its docs/specs/009-elements/corridor.md): a passage of floor between rooms.
    kind === 'corridor' ||
    kind === 'rug' ||
    kind === 'avatar-pad' ||
    kind === 'stage' ||
    kind === 'garden-path' ||
    kind === 'grass'
  );
}

// The furniture a character sits down in (docs/specs/009-elements/chair.md "Desk and sofa").
export type SeatingKind = 'chair' | 'desk' | 'sofa' | 'meeting-table';

export function isSeatingShape(kind: string): kind is SeatingKind {
  return kind === 'chair' || kind === 'desk' || kind === 'sofa' || kind === 'meeting-table';
}

// Seats that never turn, each seat saying which way its sitter faces (docs/specs/009-elements/office.md
// "Office Pod", "Bar, Bar Stool"). Kept apart from SeatingKind, whose pieces a product draws per facing.
// livehuddle's social pieces (its docs/specs/009-elements/social-pieces.md) seat people too: a ping-pong table's two
// ends, a bench, a picnic table and a hammock, and the breakout seating: a bean bag and a reading nook's armchair.
export type FixedSeatKind =
  | 'office-pod'
  | 'bar-stool'
  | 'ping-pong-table'
  | 'bench'
  | 'picnic-table'
  | 'hammock'
  | 'bean-bag'
  | 'reading-nook'
  // livehuddle's workday pieces (its docs/specs/009-elements/workday-pieces.md): a nap pod, a treadmill and a weight
  // bench, a phone booth, a standing desk and a hot desk, one seat each.
  | 'nap-pod'
  | 'treadmill'
  | 'weight-bench'
  | 'phone-booth'
  | 'standing-desk'
  | 'hot-desk';

const FIXED_SEAT_KINDS: readonly string[] = [
  'office-pod',
  'bar-stool',
  'ping-pong-table',
  'bench',
  'picnic-table',
  'hammock',
  'bean-bag',
  'reading-nook',
  'nap-pod',
  'treadmill',
  'weight-bench',
  'phone-booth',
  'standing-desk',
  'hot-desk',
];

export function isFixedSeatShape(kind: string): kind is FixedSeatKind {
  return FIXED_SEAT_KINDS.includes(kind);
}

// Seats you stand at rather than sit in (livehuddle's workday-pieces.md "How each one walks"): held like any seat, the
// character there drawn standing.
const STANDING_SEAT_KINDS: readonly string[] = ['treadmill', 'standing-desk'];
export function isStandingSeatShape(kind: string): boolean {
  return STANDING_SEAT_KINDS.includes(kind);
}

// Pieces that hang on a wall (livehuddle's social-pieces.md "How each one walks"): walked past, never blocking and
// never a destination. livehuddle's office amenities (its office-amenities.md "How each one walks") add the hand dryer,
// and the microwave and kettle, which stand on a counter (the counter under them blocks) and so walk as wall pieces.
const WALL_PIECE_KINDS: readonly string[] = [
  'notice-board',
  'world-clock',
  'dartboard',
  'hand-dryer',
  'microwave',
  'kettle',
  // livehuddle's venue pieces (its venue-pieces.md "How each one walks"): Stage Curtains hang over a stage, walked
  // between and in front of, never into.
  'stage-curtains',
  // livehuddle's team pieces (its team-pieces.md "How each one walks"): the Calendar Wall and the Team Photo Wall.
  'calendar-wall',
  'photo-wall',
];
export function isWallPieceShape(kind: string): boolean {
  return WALL_PIECE_KINDS.includes(kind);
}

/** Every piece a character sits down in: the seating that turns and the fixed seats. */
export type SitKind = SeatingKind | FixedSeatKind;

/** Whether walking onto a piece sits a character down in it (the walk's chair arrival). */
export function seatsACharacter(kind: string): kind is SitKind {
  return isSeatingShape(kind) || isFixedSeatShape(kind);
}

// Where you get a drink, and which.
export type DrinkKind = 'water' | 'coffee' | 'juice' | 'soda';
export const DRINK_KINDS: readonly DrinkKind[] = ['water', 'coffee', 'juice', 'soda'];
const DRINK_OF: Partial<Record<string, DrinkKind>> = {
  'water-cooler': 'water',
  'coffee-machine': 'coffee',
  // livehuddle's bar (its docs/specs/009-elements/office.md "Drinks Cabinet, Drinks Fridge").
  'drinks-cabinet': 'juice',
  'drinks-fridge': 'soda',
};
export function drinkFrom(kind: string): DrinkKind | null {
  return DRINK_OF[kind] ?? null;
}
/** Whether a value is a drink a character may hold: what a receiver accepts of a peer's `holding`. */
export function isDrinkKind(value: unknown): value is DrinkKind {
  return (DRINK_KINDS as readonly unknown[]).includes(value);
}
// How long a drink is held, and how often a sip (docs/specs/009-elements/office.md "Using it").
export const DRINK_HOLD_MS = 60_000;
export const DRINK_SIP_EVERY_MS = 8_000;

// The part of a piece that blocks walking, as fractions of its box: the pot, the shelf's base.
// These are each piece's front drawing ('n'); a piece that turns has its back and side drawings' footprints in
// OFFICE_FOOTPRINT_TURNED below.
const OFFICE_FOOTPRINT: Partial<Record<string, GridFraction>> = {
  plant: { x0: 15 / 56, x1: 41 / 56, y0: 63 / 88, y1: 84 / 88 },
  bookshelf: { x0: 0.03, x1: 0.97, y0: 0.75, y1: 0.96 },
  // livehuddle's bar and garden (its docs/specs/009-elements/office.md): the counter, the planter, the trunk's base.
  bar: { x0: 0.02, x1: 0.98, y0: 0.5, y1: 0.92 },
  'outdoor-plant': { x0: 14 / 72, x1: 58 / 72, y0: 56 / 80, y1: 76 / 80 },
  tree: { x0: 48 / 120, x1: 72 / 120, y0: 136 / 160, y1: 152 / 160 },
  // livehuddle's social pieces (its docs/specs/009-elements/social-pieces.md): a base, a hearth, a basin, the water.
  jukebox: { x0: 6 / 72, x1: 66 / 72, y0: 84 / 112, y1: 108 / 112 },
  'arcade-machine': { x0: 6 / 64, x1: 58 / 64, y0: 88 / 112, y1: 108 / 112 },
  fireplace: { x0: 4 / 128, x1: 124 / 128, y0: 96 / 120, y1: 116 / 120 },
  'garden-umbrella': { x0: 50 / 120, x1: 70 / 120, y0: 138 / 152, y1: 148 / 152 },
  fountain: { x0: 8 / 136, x1: 128 / 136, y0: 72 / 120, y1: 112 / 120 },
  pond: { x0: 0.06, x1: 0.94, y0: 0.1, y1: 0.92 },
  campfire: { x0: 10 / 80, x1: 70 / 80, y0: 40 / 72, y1: 66 / 72 },
  // The games corner and the break room: a table from the middle of its top to its feet, a machine's base.
  'pool-table': { x0: 8 / 200, x1: 192 / 200, y0: 50 / 128, y1: 120 / 128 },
  'foosball-table': { x0: 12 / 168, x1: 156 / 168, y0: 44 / 104, y1: 98 / 104 },
  'vending-machine': { x0: 4 / 72, x1: 68 / 72, y0: 96 / 128, y1: 124 / 128 },
  // livehuddle's office amenities (its office-amenities.md): a cabinet, a base, a plinth, a foot, the units' cupboards
  // full width (so a run of them is one barrier), a cubicle's floor and a basin's pedestal.
  printer: { x0: 8 / 72, x1: 64 / 72, y0: 60 / 80, y1: 76 / 80 },
  copier: { x0: 8 / 104, x1: 96 / 104, y0: 104 / 128, y1: 124 / 128 },
  lockers: { x0: 0.03, x1: 0.97, y0: 0.8, y1: 0.96 },
  'coat-rack': { x0: 14 / 56, x1: 42 / 56, y0: 114 / 128, y1: 126 / 128 },
  'umbrella-stand': { x0: 6 / 40, x1: 34 / 40, y0: 50 / 64, y1: 62 / 64 },
  'kitchen-counter': { x0: 0, x1: 1, y0: 44 / 88, y1: 84 / 88 },
  'kitchen-sink': { x0: 0, x1: 1, y0: 44 / 88, y1: 84 / 88 },
  fridge: { x0: 4 / 72, x1: 68 / 72, y0: 108 / 136, y1: 132 / 136 },
  'toilet-cubicle': { x0: 0, x1: 1, y0: 0.6, y1: 0.96 },
  washbasin: { x0: 26 / 72, x1: 46 / 72, y0: 96 / 112, y1: 110 / 112 },
  // livehuddle's venue pieces (its venue-pieces.md): a pillar's base full width, a column's plinth, the car park's bays
  // full width (so a row of them is one barrier), the bike rack's stands and bikes, and the podium's foot.
  pillar: { x0: 0, x1: 1, y0: 134 / 152, y1: 150 / 152 },
  column: { x0: 4 / 64, x1: 60 / 64, y0: 148 / 168, y1: 164 / 168 },
  'car-park': { x0: 0, x1: 1, y0: 44 / 128, y1: 124 / 128 },
  'bike-rack': { x0: 4 / 136, x1: 132 / 136, y0: 52 / 80, y1: 76 / 80 },
  podium: { x0: 8 / 56, x1: 48 / 56, y0: 74 / 88, y1: 86 / 88 },
  // livehuddle's workday pieces (its workday-pieces.md): the reception desk's counter, from the middle of its top down to
  // its foot, full width.
  'reception-desk': { x0: 0.02, x1: 0.98, y0: 52 / 112, y1: 106 / 112 },
  // livehuddle's team pieces (its team-pieces.md): the Suggestion Box's foot and the Signpost's post at the ground.
  'suggestion-box': { x0: 14 / 64, x1: 50 / 64, y0: 98 / 112, y1: 108 / 112 },
  signpost: { x0: 50 / 120, x1: 70 / 120, y0: 126 / 144, y1: 138 / 144 },
};

/**
 * The footprint of a piece that turns, in its back and side drawings, as fractions of that drawing's grid
 * (docs/specs/009-elements/furniture-facing.md "A turn": what blocks turns with it). Facing right is the
 * side drawing mirrored, so its footprint is the side's mirrored. A back drawing left out blocks where the front does
 * (its base stands on the same ground under the same camera).
 */
export const OFFICE_FOOTPRINT_TURNED: Partial<
  Record<string, { back?: GridFraction; side: GridFraction }>
> = {
  // The office, the pod and the bar (livehuddle's office.md). The bookshelf on its side: its base, the length of its
  // top from its far end's foot to its near end's. The bar from behind: its counter beyond the back shelf, from just
  // below its top to its foot; on its side, the counter and its foot rail down its whole length.
  bookshelf: { side: { x0: 4 / 52, x1: 48 / 52, y0: 120 / 196, y1: 190 / 196 } },
  bar: {
    back: { x0: 0.02, x1: 0.98, y0: 14 / 120, y1: 54 / 120 },
    side: { x0: 2 / 104, x1: 46 / 104, y0: 56 / 232, y1: 222 / 232 },
  },
  // The social pieces (social-pieces.md). From behind each stands on the same base as its front; on its side, the
  // base under its side and its front's strip.
  jukebox: { side: { x0: 3 / 56, x1: 53 / 56, y0: 84 / 112, y1: 108 / 112 } },
  'arcade-machine': { side: { x0: 10 / 60, x1: 56 / 60, y0: 88 / 112, y1: 108 / 112 } },
  fireplace: { side: { x0: 2 / 48, x1: 46 / 48, y0: 96 / 120, y1: 116 / 120 } },
  'vending-machine': { side: { x0: 2 / 60, x1: 58 / 60, y0: 96 / 128, y1: 124 / 128 } },
  // The games, the garden seats, the venue, the stairs and the team pieces.
  // A table from the middle of its top to its feet, down its length; the car park's bays full length (a column of
  // them is one barrier); the rack's pad; the podium's and the suggestion box's foot.
  'pool-table': { side: { x0: 8 / 88, x1: 84 / 88, y0: 44 / 240, y1: 232 / 240 } },
  'foosball-table': { side: { x0: 22 / 84, x1: 76 / 84, y0: 30 / 190, y1: 184 / 190 } },
  'car-park': {
    back: { x0: 0, x1: 1, y0: 8 / 128, y1: 104 / 128 },
    side: { x0: 4 / 128, x1: 108 / 128, y0: 0, y1: 1 },
  },
  'bike-rack': { side: { x0: 4 / 56, x1: 52 / 56, y0: 24 / 152, y1: 144 / 152 } },
  podium: { side: { x0: 4 / 44, x1: 40 / 44, y0: 74 / 88, y1: 86 / 88 } },
  'suggestion-box': { side: { x0: 10 / 48, x1: 38 / 48, y0: 104 / 120, y1: 114 / 120 } },
  // The amenities: the print corner, the lockers, the kitchenette and the restroom (office-amenities.md).
  printer: { side: { x0: 8 / 60, x1: 52 / 60, y0: 64 / 100, y1: 96 / 100 } },
  copier: { side: { x0: 8 / 80, x1: 74 / 80, y0: 90 / 156, y1: 150 / 156 } },
  lockers: { side: { x0: 4 / 56, x1: 52 / 56, y0: 106 / 204, y1: 198 / 204 } },
  'kitchen-counter': { side: { x0: 2 / 64, x1: 54 / 64, y0: 0, y1: 1 } },
  'kitchen-sink': { side: { x0: 2 / 64, x1: 54 / 64, y0: 0, y1: 1 } },
  fridge: { side: { x0: 4 / 64, x1: 58 / 64, y0: 104 / 156, y1: 150 / 156 } },
  'toilet-cubicle': { side: { x0: 0, x1: 1, y0: 0, y1: 1 } },
  washbasin: { side: { x0: 28 / 64, x1: 44 / 64, y0: 98 / 116, y1: 112 / 116 } },
  // The workday pieces (workday-pieces.md). The reception desk on its side: its counter and the work top behind it,
  // from the foot of its far end to the foot of its near one; from behind it stands on the same ground as from the front.
  'reception-desk': { side: { x0: 4 / 112, x1: 84 / 112, y0: 44 / 200, y1: 194 / 200 } },
};

/** A piece's footprint as fractions of the drawing its facing shows, or undefined for a piece that does not block. */
export function footprintFraction(
  shape: string,
  facing: SeatFacing = 'n',
): GridFraction | undefined {
  const front = OFFICE_FOOTPRINT[shape];
  if (!front) return undefined;
  const turned = OFFICE_FOOTPRINT_TURNED[shape];
  if (!turned) return front;
  const { view, mirrored } = facingView(facing);
  if (view === 'front') return front;
  if (view === 'back') return turned.back ?? front;
  return mirrored ? mirrorFraction(turned.side) : turned.side;
}

// livehuddle's Swimming Pool (its venue-pieces.md "How each one walks"): drawn to its size, its deck a fixed band, so
// its footprint is the water: the pool less its deck, in px rather than fractions, matching the drawing at any size.
export const POOL_DECK = 14;
/** The deck's width round a pool of this size: POOL_DECK, or a tenth of its shorter side when that is less. */
export function poolDeck(width: number, height: number): number {
  return Math.max(0, Math.min(POOL_DECK, Math.min(width, height) / 10));
}
const INSET_FOOTPRINT_KINDS: readonly string[] = ['swimming-pool'];

/** Scenery: blocks with its footprint and is never a destination (walking up to it rings nothing). */
export function isSceneryShape(kind: string): boolean {
  return kind in OFFICE_FOOTPRINT || INSET_FOOTPRINT_KINDS.includes(kind);
}

/** The footprint of a piece that blocks, in canvas coordinates, at its facing, or null for one that does not. */
export function officeFootprint(
  el: Rect & { shape: string; chairFacing?: SeatFacing },
): Rect | null {
  if (INSET_FOOTPRINT_KINDS.includes(el.shape)) {
    const d = poolDeck(el.width, el.height);
    return {
      x: el.x + d,
      y: el.y + d,
      width: Math.max(0, el.width - 2 * d),
      height: Math.max(0, el.height - 2 * d),
    };
  }
  const f = footprintFraction(el.shape, el.chairFacing);
  if (!f) return null;
  return {
    x: el.x + el.width * f.x0,
    y: el.y + el.height * f.y0,
    width: el.width * (f.x1 - f.x0),
    height: el.height * (f.y1 - f.y0),
  };
}

// --- The room ----------------------------------------------------------------

export type RoomDoor = 'n' | 'e' | 's' | 'w' | 'none';
export const ROOM_DOORS: readonly RoomDoor[] = ['n', 'e', 's', 'w', 'none'];
export const DEFAULT_ROOM_DOOR: RoomDoor = 's';
export function isRoomDoor(value: unknown): value is RoomDoor {
  return (ROOM_DOORS as readonly unknown[]).includes(value);
}

// Canvas px, whatever the room's size: a big room is a big floor, not thick walls.
export const ROOM_WALL = 10;
// The back wall's face, standing up, so the room reads from the front and above.
export const ROOM_BACK_FACE = 36;
export const ROOM_DOOR_WIDTH = 96;

/** The doorway's span along its wall, [from, to] from that wall's start, or null for no doorway. */
export function roomDoorSpan(length: number, door: RoomDoor): [number, number] | null {
  if (door === 'none') return null;
  const width = Math.max(0, Math.min(ROOM_DOOR_WIDTH, length - 2 * ROOM_WALL - 8));
  if (width <= 0) return null;
  const from = (length - width) / 2;
  return [from, from + width];
}

/** A wall from 0 to `length` along one axis, broken by the doorway if it is on this wall. */
export function brokenRun(length: number, gap: [number, number] | null): [number, number][] {
  return gap ? [[0, gap[0]] as [number, number], [gap[1], length]] : [[0, length]];
}

export type WallSegment = { a: { x: number; y: number }; b: { x: number; y: number } };

/**
 * A room's walls as lines a character cannot cross, in canvas coordinates, broken at the doorway: along the
 * back wall's foot, down each side wall and along the front wall.
 */
export function roomWalls(
  el: Rect & { roomDoor?: RoomDoor; roomOutline?: readonly { x: number; y: number }[] },
): WallSegment[] {
  // A room drawn wall by wall (room-builder.md): its outline's walls, with no doorway of its own.
  if (el.roomOutline && el.roomOutline.length >= 3) return outlineWalls(el, el.roomOutline);
  const door = el.roomDoor ?? DEFAULT_ROOM_DOOR;
  const { x, y, width: w, height: h } = el;
  const half = ROOM_WALL / 2;
  const back = y + ROOM_BACK_FACE - half;
  const front = y + h - half;
  const left = x + half;
  const right = x + w - half;
  const out: WallSegment[] = [];
  const along = (
    gap: [number, number] | null,
    at: (t: number) => { x: number; y: number },
    len: number,
  ) => {
    for (const [a, b] of brokenRun(len, gap)) if (b - a > 0) out.push({ a: at(a), b: at(b) });
  };
  along(door === 'n' ? roomDoorSpan(w, 'n') : null, (t) => ({ x: x + t, y: back }), w);
  along(door === 's' ? roomDoorSpan(w, 's') : null, (t) => ({ x: x + t, y: front }), w);
  along(door === 'w' ? roomDoorSpan(h, 'w') : null, (t) => ({ x: left, y: y + t }), h);
  along(door === 'e' ? roomDoorSpan(h, 'e') : null, (t) => ({ x: right, y: y + t }), h);
  return out;
}

/**
 * The floor inside a room's walls, bounded by the same centre lines `roomWalls` draws (and the doorway's threshold
 * on that line): where a character counts as in the room (docs/specs/012-collaboration/
 * meeting-rooms-and-stage.md "Rooms are calls"). Empty (zero or negative size) for a room too small to stand in.
 */
export function roomInterior(el: Rect): Rect {
  const half = ROOM_WALL / 2;
  const top = el.y + ROOM_BACK_FACE - half;
  return {
    x: el.x + half,
    y: top,
    width: el.width - ROOM_WALL,
    height: el.y + el.height - half - top,
  };
}

/** The four edges of a box as wall segments (a footprint's outline). */
export function boxEdges(b: Rect): WallSegment[] {
  const tl = { x: b.x, y: b.y };
  const tr = { x: b.x + b.width, y: b.y };
  const br = { x: b.x + b.width, y: b.y + b.height };
  const bl = { x: b.x, y: b.y + b.height };
  return [
    { a: tl, b: tr },
    { a: tr, b: br },
    { a: br, b: bl },
    { a: bl, b: tl },
  ];
}
