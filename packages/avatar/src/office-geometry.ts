// The virtual office's geometry the Avatar-mode walk needs (livediagram's docs/specs/009-elements/office.md and
// chair.md): which pieces are floor, which give a drink, which seat a character, a room's walls and doorway, and the
// footprints of the scenery that blocks. The pieces themselves (their drawings, tones and parts) stay in each
// product's model package beside its element union, which re-exports this module. Pure: no React, no DOM.

import type { Rect } from '@liveworkspace/model-core/geometry-primitives';
import { outlineWalls } from './room-outline';

// The floor pieces: placed behind everything, never blocking, never a destination. An Avatar Pad
// (docs/specs/009-elements/avatar-pad.md) lies on the floor too: characters stand on it, furniture over it. So does
// livehuddle's Stage (its docs/specs/012-collaboration/meeting-rooms-and-stage.md): a platform people stand on. And
// livehuddle's Garden Path and Grass (its docs/specs/009-elements/office.md "Garden Path", "Grass"): stones laid
// in the ground, and a lawn.
export function isFloorShape(
  kind: string,
): kind is 'room' | 'rug' | 'avatar-pad' | 'stage' | 'garden-path' | 'grass' {
  return (
    kind === 'room' ||
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

// Seats that never turn, each seat saying which way its sitter faces (livehuddle's docs/specs/009-elements/office.md
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
  | 'reading-nook';

const FIXED_SEAT_KINDS: readonly string[] = [
  'office-pod',
  'bar-stool',
  'ping-pong-table',
  'bench',
  'picnic-table',
  'hammock',
  'bean-bag',
  'reading-nook',
];

export function isFixedSeatShape(kind: string): kind is FixedSeatKind {
  return FIXED_SEAT_KINDS.includes(kind);
}

// Pieces that hang on a wall (livehuddle's social-pieces.md "How each one walks"): walked past, never blocking and
// never a destination.
export function isWallPieceShape(kind: string): boolean {
  return kind === 'notice-board' || kind === 'world-clock' || kind === 'dartboard';
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
const OFFICE_FOOTPRINT: Partial<
  Record<string, { x0: number; x1: number; y0: number; y1: number }>
> = {
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
};

/** Scenery: blocks with its footprint and is never a destination (walking up to it rings nothing). */
export function isSceneryShape(kind: string): boolean {
  return kind in OFFICE_FOOTPRINT;
}

/** The footprint of a piece that blocks, in canvas coordinates, or null for one that does not. */
export function officeFootprint(el: Rect & { shape: string }): Rect | null {
  const f = OFFICE_FOOTPRINT[el.shape];
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
 * on that line): where a character counts as in the room (livehuddle's docs/specs/012-collaboration/
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
