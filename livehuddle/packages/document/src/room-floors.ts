// A room's floor type (docs/specs/009-elements/office.md "Floors"): Floorboards (absent, the boards every room had),
// Tiles, Carpet, Stone or Concrete, drawn as light and shade over the room's fill so every type works in every colour.
// One pattern description, which the canvas (RoomFloorPattern) and the export (roomFloorSvg) both paint, its seams
// fixed in canvas px whatever the room's size. Pure: no React, no DOM.

import { xmlEscape } from './svg-render-primitives';

export const ROOM_FLOORS = ['boards', 'tiles', 'carpet', 'stone', 'concrete'] as const;
export type RoomFloor = (typeof ROOM_FLOORS)[number];

export const ROOM_FLOOR_LABELS: Record<RoomFloor, string> = {
  boards: 'Floorboards',
  tiles: 'Tiles',
  carpet: 'Carpet',
  stone: 'Stone',
  concrete: 'Concrete',
};

/** Whether a value is a floor type a room stores (`boards` is never stored: it is the absent default). */
export function isRoomFloor(v: unknown): v is RoomFloor {
  return typeof v === 'string' && (ROOM_FLOORS as readonly string[]).includes(v);
}

/** A room's floor type: what it stores, else Floorboards (an unknown value draws as boards). */
export function roomFloorOf(el: { floor?: unknown }): RoomFloor {
  return isRoomFloor(el.floor) ? el.floor : 'boards';
}

/** The floor colours the Floor section offers, each setting the room's fill. */
export const ROOM_FLOOR_COLOURS: readonly { name: string; hex: string }[] = [
  { name: 'Oak', hex: '#d9b98a' },
  { name: 'Walnut', hex: '#a2764e' },
  { name: 'Ash', hex: '#e9dfcc' },
  { name: 'Cream', hex: '#f3ecdc' },
  { name: 'Slate', hex: '#a3adb8' },
  { name: 'Charcoal', hex: '#5f6873' },
  { name: 'Sage', hex: '#b9c9a9' },
  { name: 'Navy', hex: '#41597a' },
  { name: 'Berry', hex: '#8e4c57' },
];

/** One mark of a floor's tile: a path in light (white) or shade (black) at an opacity. */
export type FloorMark = { d: string; light: boolean; opacity: number };
/** A floor type's repeating tile, in canvas px. */
export type FloorTile = { w: number; h: number; marks: readonly FloorMark[] };

const shade = (d: string, opacity: number): FloorMark => ({ d, light: false, opacity });
const light = (d: string, opacity: number): FloorMark => ({ d, light: true, opacity });

/** The tile each patterned floor repeats; Floorboards are the room's own boards (office.ts floorBoards). */
export const FLOOR_TILES: Record<Exclude<RoomFloor, 'boards'>, FloorTile> = {
  // Square tiles 32 px, pale grout, each a touch darker at its foot.
  tiles: {
    w: 32,
    h: 32,
    marks: [
      shade('M1 29h31v3h-31z', 0.05),
      light('M0 0h32v1.5h-32zM0 0h1.5v32h-1.5z', 0.55),
      shade('M0 1.5h32v0.6h-32zM1.5 0h0.6v32h-0.6z', 0.08),
    ],
  },
  // A soft woven fleck: a few darker and lighter flecks in every 10 px.
  carpet: {
    w: 10,
    h: 10,
    marks: [
      shade('M1 1h1.2v1.2h-1.2zM6 3h1.2v1.2h-1.2zM3 7h1.2v1.2h-1.2zM8.5 8h1v1h-1z', 0.09),
      light('M4 2h1v1h-1zM8 5h1.2v1.2h-1.2zM1.5 5h1v1h-1zM6 8.5h1v1h-1z', 0.12),
    ],
  },
  // Flags 64 by 32 laid in offset rows, darker grout, a light catch on each flag's top edge.
  stone: {
    w: 64,
    h: 64,
    marks: [
      light('M2 2h60v1.2h-60zM2 34h28v1.2h-28zM34 34h28v1.2h-28z', 0.18),
      shade('M2 28h60v3h-60zM2 60h28v3h-28zM34 60h28v3h-28z', 0.05),
      shade('M0 0h64v1.6h-64zM0 32h64v1.6h-64zM0 0h1.6v32h-1.6zM32 32h1.6v32h-1.6z', 0.16),
    ],
  },
  // Wide poured panels 128 px with a faint seam and a few pores.
  concrete: {
    w: 128,
    h: 128,
    marks: [
      shade('M0 0h128v1h-128zM0 0h1v128h-1z', 0.1),
      shade(
        'M30 40h2v2h-2zM86 22h1.5v1.5h-1.5zM70 96h2v2h-2zM14 104h1.5v1.5h-1.5zM108 70h2v2h-2z',
        0.08,
      ),
      light('M48 60h3v1h-3zM100 110h3v1h-3zM20 18h2v1h-2z', 0.18),
    ],
  },
};

/**
 * A room's floor pattern over `d` (its floor area, in the room's own px) for the export: its tile as an SVG pattern
 * and the area filled with it, or '' for Floorboards (the room draws its own boards).
 */
export function roomFloorSvg(id: string, floor: RoomFloor, d: string): string {
  if (floor === 'boards') return '';
  const t = FLOOR_TILES[floor];
  const pid = `floor-${xmlEscape(id)}`;
  const marks = t.marks
    .map(
      (m) => `<path d="${m.d}" fill="${m.light ? '#fff' : '#000'}" fill-opacity="${m.opacity}"/>`,
    )
    .join('');
  return (
    `<defs><pattern id="${pid}" width="${t.w}" height="${t.h}" patternUnits="userSpaceOnUse">${marks}</pattern></defs>` +
    `<path d="${d}" fill="url(#${pid})"/>`
  );
}

/** A rectangle as a path, for a rectangular room's floor area. */
export function rectPath(x: number, y: number, w: number, h: number): string {
  return w > 0 && h > 0 ? `M${x} ${y}h${w}v${h}h${-w}Z` : '';
}
