// The virtual office's geometry the Avatar-mode walk needs (livediagram's docs/specs/009-elements/office.md and
// chair.md): which pieces are floor, which give a drink, which seat a character, a room's walls and doorway, and the
// footprints of the scenery that blocks. The pieces themselves (their drawings, tones and parts) stay in each
// product's model package beside its element union, which re-exports this module. Pure: no React, no DOM.

import type { Rect } from '@liveworkspace/model-core/geometry-primitives';

// The floor pieces: placed behind everything, never blocking, never a destination. An Avatar Pad
// (docs/specs/009-elements/avatar-pad.md) lies on the floor too: characters stand on it, furniture over it.
export function isFloorShape(kind: string): kind is 'room' | 'rug' | 'avatar-pad' {
  return kind === 'room' || kind === 'rug' || kind === 'avatar-pad';
}

// The furniture a character sits down in (docs/specs/009-elements/chair.md "Desk and sofa").
export type SeatingKind = 'chair' | 'desk' | 'sofa' | 'meeting-table';

export function isSeatingShape(kind: string): kind is SeatingKind {
  return kind === 'chair' || kind === 'desk' || kind === 'sofa' || kind === 'meeting-table';
}

// Where you get a drink, and which.
export type DrinkKind = 'water' | 'coffee';
const DRINK_OF: Partial<Record<string, DrinkKind>> = {
  'water-cooler': 'water',
  'coffee-machine': 'coffee',
};
export function drinkFrom(kind: string): DrinkKind | null {
  return DRINK_OF[kind] ?? null;
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
};

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
export function roomWalls(el: Rect & { roomDoor?: RoomDoor }): WallSegment[] {
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
