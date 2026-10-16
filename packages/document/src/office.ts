// The virtual office (docs/specs/009-elements/office.md): the Room, the Meeting Table, the Plant, the Bookshelf,
// the Water Cooler, the Coffee Machine and the Rug. Their drawings are tables of parts in the furniture's
// vocabulary (seating.ts), drawn upright from the room's camera, which both renderers paint (the editor's views
// and svg-render-faces), so an office on the canvas and in an export are the same office. Also the geometry the
// Avatar-mode walk needs: a room's walls and doorway, and the footprints of the scenery that blocks. Pure: no
// React, no DOM.

import type { ChairSitterFacing } from './collab-shapes';
import type { FurnitureArt, FurniturePart, FurniturePartRole, FurnitureDrawing } from './seating';
import type { ShapeKind } from './shape-kind';

export type OfficeKind =
  'room' | 'meeting-table' | 'plant' | 'bookshelf' | 'water-cooler' | 'coffee-machine' | 'rug';

export const OFFICE_KINDS: readonly OfficeKind[] = [
  'room',
  'meeting-table',
  'plant',
  'bookshelf',
  'water-cooler',
  'coffee-machine',
  'rug',
];

export function isOfficeShape(kind: string): kind is OfficeKind {
  return (OFFICE_KINDS as readonly string[]).includes(kind);
}

// The floor pieces: placed behind everything, never blocking, never a destination.
export function isFloorShape(kind: string): kind is 'room' | 'rug' {
  return kind === 'room' || kind === 'rug';
}

// Where you get a drink, and which.
export type DrinkKind = 'water' | 'coffee';
const DRINK_OF: Partial<Record<ShapeKind, DrinkKind>> = {
  'water-cooler': 'water',
  'coffee-machine': 'coffee',
};
export function drinkFrom(kind: string): DrinkKind | null {
  return DRINK_OF[kind as ShapeKind] ?? null;
}
// How long a drink is held, and how often a sip (docs/specs/009-elements/office.md "Using it").
export const DRINK_HOLD_MS = 60_000;
export const DRINK_SIP_EVERY_MS = 8_000;

// Fixed colours for what keeps its colour whatever the theme: leaves, water, coffee, terracotta, book spines.
// The outlines are still the theme's stroke, so every piece sits in the same drawing style.
export const OFFICE_TONES = {
  leaf: '#4ade80',
  leafDeep: '#22c55e',
  pot: '#ea580c',
  potDeep: '#c2410c',
  water: '#bae6fd',
  waterDeep: '#7dd3fc',
  coffee: '#78350f',
  glass: '#e2e8f0',
  cold: '#60a5fa',
  hot: '#f87171',
  books: ['#f87171', '#60a5fa', '#fbbf24', '#34d399', '#a78bfa'],
} as const;

type Part = FurniturePart;
const rect = (
  role: FurniturePartRole,
  x: number,
  y: number,
  w: number,
  h: number,
  rx: number,
  fill?: string,
): Part => ({ tag: 'rect', role, x, y, w, h, rx, ...(fill ? { fill } : {}) });
const ellipse = (
  role: FurniturePartRole,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  fill?: string,
): Part => ({ tag: 'ellipse', role, cx, cy, rx, ry, ...(fill ? { fill } : {}) });
const path = (role: FurniturePartRole, d: string, fill?: string): Part => ({
  tag: 'path',
  role,
  d,
  ...(fill ? { fill } : {}),
});

// A drawing that reads the same from every side, so every facing shows it.
const allSides = (view: FurnitureDrawing): FurnitureArt => ({
  front: view,
  back: view,
  side: view,
});

const T = OFFICE_TONES;

// A potted plant: five leaves fanned above a terracotta pot.
const PLANT_VIEW: FurnitureDrawing = {
  width: 56,
  height: 88,
  parts: [
    ellipse('shadow', 28, 84, 18, 3.5),
    path('panel', 'M27 61C18 62 9 56 4 48C13 46 22 52 27 61Z', T.leafDeep),
    path('panel', 'M29 61C38 62 47 56 52 48C43 46 34 52 29 61Z', T.leafDeep),
    path('panel', 'M27 60C14 54 6 40 7 26C17 32 24 44 27 60Z', T.leaf),
    path('panel', 'M29 60C42 54 50 40 49 26C39 32 32 44 29 60Z', T.leaf),
    path('panel', 'M28 60C20 44 20 24 28 8C36 24 36 44 28 60Z', T.leaf),
    path('rail', 'M28 56V16'),
    rect('panel', 12, 56, 32, 8, 3, T.pot),
    path('panel', 'M15 63H41L38 84H18Z', T.potDeep),
  ],
  seats: [],
  ring: { cx: 28, cy: 70, rx: 18, ry: 8 },
};

// Shelves of books: a frame, a dark interior, three shelves of coloured spines.
function bookRow(y: number, offset: number): Part[] {
  const widths = [8, 7, 9, 6, 8, 9, 7, 10, 7, 8];
  const heights = [24, 20, 26, 22, 24, 18, 20, 26, 22, 24];
  const out: Part[] = [];
  let x = 14;
  for (let i = 0; i < widths.length && x + widths[i]! <= 106; i += 1) {
    const w = widths[(i + offset) % widths.length]!;
    const h = heights[(i + offset * 3) % heights.length]!;
    // A gap on each shelf, so the rows do not read as a wall of spines.
    if (i === 5 - offset) {
      x += 10;
      continue;
    }
    out.push(rect('panel', x, y - h, w, h, 1, T.books[(i + offset) % T.books.length]));
    x += w + 1;
  }
  return out;
}

const BOOKSHELF_VIEW: FurnitureDrawing = {
  width: 120,
  height: 132,
  parts: [
    ellipse('shadow', 60, 128, 58, 4),
    rect('panel', 4, 4, 112, 122, 4),
    rect('face', 10, 12, 100, 108, 2),
    ...bookRow(42, 0),
    rect('panel', 10, 42, 100, 5, 1.5),
    ...bookRow(78, 1),
    rect('panel', 10, 78, 100, 5, 1.5),
    ...bookRow(114, 2),
    rect('panel', 10, 114, 100, 6, 1.5),
  ],
  seats: [],
  ring: { cx: 60, cy: 120, rx: 56, ry: 8 },
};

// A water cooler: a blue bottle upside down on a cooler with hot and cold taps.
const WATER_COOLER_VIEW: FurnitureDrawing = {
  width: 56,
  height: 112,
  parts: [
    ellipse('shadow', 28, 108, 20, 3.5),
    rect('face', 10, 44, 36, 60, 4),
    rect('panel', 8, 40, 40, 8, 3),
    rect('panel', 16, 56, 8, 6, 1.5, T.cold),
    rect('panel', 32, 56, 8, 6, 1.5, T.hot),
    rect('rail', 16, 72, 24, 4, 1.5),
    rect('panel', 23, 33, 10, 9, 2, T.waterDeep),
    rect('panel', 12, 4, 32, 32, 10, T.water),
    path('rail', 'M15 13h26'),
    path('glint', 'M18 30V14'),
  ],
  seats: [],
  ring: { cx: 28, cy: 100, rx: 22, ry: 7 },
};

// A coffee machine with a carafe, on a little counter, a mug beside it.
const COFFEE_MACHINE_VIEW: FurnitureDrawing = {
  width: 72,
  height: 96,
  parts: [
    ellipse('shadow', 36, 92, 32, 3.5),
    rect('face', 2, 64, 68, 24, 2),
    path('rail', 'M8 76h56'),
    rect('panel', 2, 58, 68, 8, 2),
    rect('face', 14, 14, 44, 44, 5),
    rect('panel', 14, 8, 44, 9, 3),
    rect('screen', 20, 20, 32, 8, 2),
    rect('panel', 32, 31, 8, 6, 1.5),
    rect('panel', 26, 40, 20, 18, 4, T.glass),
    rect('panel', 28, 48, 16, 8, 2, T.coffee),
    rect('panel', 58, 49, 10, 10, 2),
  ],
  seats: [],
  ring: { cx: 36, cy: 86, rx: 32, ry: 7 },
};

// A rug: an oval in the element's fill with a border, lying on the floor (no shadow: it is the floor).
const RUG_VIEW: FurnitureDrawing = {
  width: 200,
  height: 120,
  parts: [
    ellipse('panel', 100, 60, 96, 56),
    ellipse('rail', 100, 60, 84, 46),
    ellipse('rail', 100, 60, 60, 30),
    ellipse('rail', 100, 60, 34, 14),
  ],
  seats: [],
  ring: { cx: 100, cy: 60, rx: 96, ry: 56 },
};

// A seat round the meeting table: its point as fractions of the grid, and which way its sitter faces.
type TableSeat = { u: number; v: number; facing: ChairSitterFacing };

const TW = 232;
const TH = 168;
const far = (cx: number): Part[] => [
  rect('panel', cx - 17, 8, 34, 30, 4),
  path('rail', `M${cx} 13v20`),
  rect('panel', cx - 22, 34, 44, 12, 3),
];
const near = (cx: number): Part[] => [
  path('line', `M${cx - 17} 136v22M${cx + 17} 136v22`),
  rect('panel', cx - 22, 110, 44, 12, 3),
  rect('face', cx - 17, 102, 34, 36, 4),
  path('rail', `M${cx} 107v26`),
];

// Six chairs round a table, every seat facing it: two beyond (their sitters face you), two in front (their
// backs to you), one at each end in profile.
export const MEETING_TABLE_VIEW: FurnitureDrawing & { tableSeats: readonly TableSeat[] } = {
  width: TW,
  height: TH,
  parts: [
    ellipse('shadow', 116, 160, 110, 6),
    ...far(86),
    ...far(146),
    // The ends: seat, then the backrest on the outside.
    path('line', 'M10 80v18M32 80v18'),
    rect('panel', 6, 66, 30, 12, 3),
    rect('panel', 2, 44, 8, 36, 3),
    path('line', 'M200 80v18M222 80v18'),
    rect('panel', 196, 66, 30, 12, 3),
    rect('panel', 222, 44, 8, 36, 3),
    // The table: legs, its top, its front edge.
    path('line', 'M50 110v20M182 110v20'),
    rect('panel', 40, 56, 152, 44, 6),
    rect('face', 40, 96, 152, 12, 4),
    ...near(86),
    ...near(146),
  ],
  seats: [],
  tableSeats: [
    { u: 86 / TW, v: 40 / TH, facing: 'down' },
    { u: 146 / TW, v: 40 / TH, facing: 'down' },
    { u: 86 / TW, v: 116 / TH, facing: 'up' },
    { u: 146 / TW, v: 116 / TH, facing: 'up' },
    { u: 21 / TW, v: 72 / TH, facing: 'right' },
    { u: 211 / TW, v: 72 / TH, facing: 'left' },
  ],
  ring: { cx: 116, cy: 82, rx: 112, ry: 70 },
};

export const MEETING_TABLE_ART: FurnitureArt = allSides({
  ...MEETING_TABLE_VIEW,
  seats: MEETING_TABLE_VIEW.tableSeats.map(({ u, v }) => ({ u, v })),
});

// Every office piece but the room, which is drawn to its size (roomParts).
export const OFFICE_ART: Record<Exclude<OfficeKind, 'room'>, FurnitureArt> = {
  'meeting-table': MEETING_TABLE_ART,
  plant: allSides(PLANT_VIEW),
  bookshelf: allSides(BOOKSHELF_VIEW),
  'water-cooler': allSides(WATER_COOLER_VIEW),
  'coffee-machine': allSides(COFFEE_MACHINE_VIEW),
  rug: allSides(RUG_VIEW),
};

// --- Footprints ------------------------------------------------------------

type Box = { x: number; y: number; width: number; height: number };

// The part of a piece that blocks walking, as fractions of its box: the pot, the shelf's base.
const OFFICE_FOOTPRINT: Partial<
  Record<OfficeKind, { x0: number; x1: number; y0: number; y1: number }>
> = {
  plant: { x0: 15 / 56, x1: 41 / 56, y0: 63 / 88, y1: 84 / 88 },
  bookshelf: { x0: 0.03, x1: 0.97, y0: 0.75, y1: 0.96 },
};

/** The footprint of a piece that blocks, in canvas coordinates, or null for one that does not. */
export function officeFootprint(el: Box & { shape: string }): Box | null {
  const f = OFFICE_FOOTPRINT[el.shape as OfficeKind];
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
export const ROOM_DOOR_LABELS: Record<RoomDoor, string> = {
  n: 'Top',
  e: 'Right',
  s: 'Bottom',
  w: 'Left',
  none: 'None',
};
export function isRoomDoor(value: unknown): value is RoomDoor {
  return (ROOM_DOORS as readonly unknown[]).includes(value);
}

// Canvas px, whatever the room's size: a big room is a big floor, not thick walls.
export const ROOM_WALL = 10;
// The back wall's face, standing up, so the room reads from the front and above.
export const ROOM_BACK_FACE = 36;
export const ROOM_DOOR_WIDTH = 96;
// The floor's wash when the room has no fill of its own.
export const ROOM_FLOOR = '#f5f0e6';
export const RUG_FILL = '#fde68a';

/** The doorway's span along its wall, [from, to] from that wall's start, or null for no doorway. */
export function roomDoorSpan(length: number, door: RoomDoor): [number, number] | null {
  if (door === 'none') return null;
  const width = Math.max(0, Math.min(ROOM_DOOR_WIDTH, length - 2 * ROOM_WALL - 8));
  if (width <= 0) return null;
  const from = (length - width) / 2;
  return [from, from + width];
}

// A wall from a to b along one axis, broken by the doorway if it is on this wall.
function brokenRun(length: number, gap: [number, number] | null): [number, number][] {
  return gap ? [[0, gap[0]] as [number, number], [gap[1], length]] : [[0, length]];
}

/** A room's drawing, in its own px (0..width, 0..height): floor, walls and doorway mat. */
export function roomParts(width: number, height: number, door: RoomDoor): FurniturePart[] {
  const W = ROOM_WALL;
  const F = ROOM_BACK_FACE;
  const parts: FurniturePart[] = [rect('floor', 0, F - W, width, height - F + W, 3)];
  // The back wall: its top, then its face standing up from the floor.
  for (const [a, b] of brokenRun(width, door === 'n' ? roomDoorSpan(width, 'n') : null)) {
    parts.push(rect('panel', a, 0, b - a, W, 2));
    parts.push(rect('face', a, W - 1, b - a, F - W + 1, 1));
  }
  // The side walls and the front wall, which you see the top of.
  for (const [a, b] of brokenRun(height, door === 'w' ? roomDoorSpan(height, 'w') : null))
    parts.push(rect('panel', 0, a, W, b - a, 2));
  for (const [a, b] of brokenRun(height, door === 'e' ? roomDoorSpan(height, 'e') : null))
    parts.push(rect('panel', width - W, a, W, b - a, 2));
  for (const [a, b] of brokenRun(width, door === 's' ? roomDoorSpan(width, 's') : null))
    parts.push(rect('panel', a, height - W, b - a, W, 2));
  // A mat across the doorway.
  const span = door === 'n' || door === 's' ? roomDoorSpan(width, door) : null;
  const side = door === 'e' || door === 'w' ? roomDoorSpan(height, door) : null;
  if (span && door === 's')
    parts.push(rect('rail', span[0] + 6, height - W - 14, span[1] - span[0] - 12, 10, 2));
  if (span && door === 'n')
    parts.push(rect('rail', span[0] + 6, F + 4, span[1] - span[0] - 12, 10, 2));
  if (side && door === 'w')
    parts.push(rect('rail', W + 4, side[0] + 6, 10, side[1] - side[0] - 12, 2));
  if (side && door === 'e')
    parts.push(rect('rail', width - W - 14, side[0] + 6, 10, side[1] - side[0] - 12, 2));
  // A room shrunk past its walls has no floor or mat left to draw: a part of no size is dropped, never drawn with a
  // negative width or height (an SVG error on the canvas and in an export).
  return parts.filter((p) => p.tag !== 'rect' || (p.w > 0 && p.h > 0));
}

type WallSegment = { a: { x: number; y: number }; b: { x: number; y: number } };

/**
 * A room's walls as lines a character cannot cross, in canvas coordinates, broken at the doorway: along the
 * back wall's foot, down each side wall and along the front wall.
 */
export function roomWalls(el: Box & { roomDoor?: RoomDoor }): WallSegment[] {
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

/** The four edges of a box as wall segments (a footprint's outline). */
export function boxEdges(b: Box): WallSegment[] {
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
