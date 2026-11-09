// A Room's glass walls (docs/specs/009-elements/office.md "Glass walls"): the drawing both renderers paint (the
// canvas's GlassRoomView and the export's glassRoomSvg) for a room whose `variant` is `glass`. The walls stand where a
// solid room's do (roomWalls' centre lines, ROOM_WALL thick), so walking, pathing and the room's call are a room's;
// only the paint differs: a faint band of the stroke you see through, a pane line along its middle, a mullion about
// every 64 px, and a rectangle's back wall face as a tall pane with two glints. Pure: no React, no DOM.

import {
  brokenRun,
  DEFAULT_ROOM_DOOR,
  ROOM_BACK_FACE,
  ROOM_WALL,
  roomDoorSpan,
  roomWalls,
  type RoomDoor,
} from '@livehuddle/avatar/office-geometry';
import { pieceVariant, ROOM_WALL_VARIANTS } from './piece-variants';

/** The `variant` a glass-walled room stores (office.md "Glass walls"). */
export const GLASS_ROOM_VARIANT = 'glass';

/** A room's wall styles, in the element menu's order (Solid first: what an absent `variant` draws). */
export type RoomWalls = (typeof ROOM_WALL_VARIANTS)[number];
export const ROOM_WALLS: readonly RoomWalls[] = ROOM_WALL_VARIANTS;
export const ROOM_WALLS_LABELS: Record<RoomWalls, string> = { solid: 'Solid', glass: 'Glass' };

/** A room's wall style: Glass when it stores `glass`, else Solid. */
export function roomWallsOf(el: { shape: string; variant?: unknown }): RoomWalls {
  return isGlassRoom(el) ? 'glass' : 'solid';
}

/** Whether a piece is a Room with glass walls (an unknown `variant` is Solid). */
export function isGlassRoom(el: { shape: string; variant?: unknown }): boolean {
  return el.shape === 'room' && pieceVariant(el) === GLASS_ROOM_VARIANT;
}

/** How glass walls are painted (DEFAULTS.md D229): opacities of the stroke, the mullions' spacing and cap. */
export const GLASS_WALL = {
  band: 0.22,
  pane: 0.6,
  mullion: 0.6,
  mullionWidth: 1.25,
  face: 0.1,
  glint: 0.55,
  glintDark: 0.2,
  mullionEvery: 64,
  mullionsMax: 32,
} as const;

export type GlassRoomArt = {
  /** The floor, a closed path in the room's own px. */
  floor: string;
  /** The walls' centre lines: each wall a subpath (a custom room's one closed outline). */
  walls: string;
  /** Short ticks across the wall's band. */
  mullions: string;
  /** A rectangle's back wall face: the panes standing up above its back wall line (none on a custom room). */
  faces: { x: number; y: number; w: number; h: number }[];
  /** The glints on the faces. */
  glints: string;
};

const r2 = (v: number) => Math.round(v * 100) / 100;

// Ticks across one wall's band, about every GLASS_WALL.mullionEvery px, never at its ends.
function mullionsOn(a: { x: number; y: number }, b: { x: number; y: number }): string {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  const n = Math.min(GLASS_WALL.mullionsMax, Math.round(len / GLASS_WALL.mullionEvery));
  if (n < 2) return '';
  const ux = dx / len;
  const uy = dy / len;
  const half = ROOM_WALL / 2 + 1;
  let d = '';
  for (let k = 1; k < n; k += 1) {
    const cx = a.x + (dx * k) / n;
    const cy = a.y + (dy * k) / n;
    d += `M${r2(cx - uy * half)} ${r2(cy + ux * half)}L${r2(cx + uy * half)} ${r2(cy - ux * half)}`;
  }
  return d;
}

/**
 * A glass room's drawing in its own px (0..width, 0..height): a rectangle's floor below its back wall face, or a custom
 * room's outline; the walls' centre lines (an older room's built-in doorway left open); the mullions; and a
 * rectangle's back wall face with its glints.
 */
export function glassRoomArt(el: {
  width: number;
  height: number;
  roomDoor?: RoomDoor;
  roomOutline?: readonly { x: number; y: number }[];
}): GlassRoomArt {
  const { width, height } = el;
  const local = { x: 0, y: 0, width, height, roomDoor: el.roomDoor, roomOutline: el.roomOutline };
  const segments = roomWalls(local);
  const mullions = segments.map((s) => mullionsOn(s.a, s.b)).join('');
  if (el.roomOutline && el.roomOutline.length >= 3) {
    const d =
      el.roomOutline
        .map((p, i) => `${i === 0 ? 'M' : 'L'}${r2(p.x * width)} ${r2(p.y * height)}`)
        .join(' ') + ' Z';
    return { floor: d, walls: d, mullions, faces: [], glints: '' };
  }
  const W = ROOM_WALL;
  const F = ROOM_BACK_FACE;
  const floor = `M0 ${F - W}H${r2(width)}V${r2(height)}H0Z`;
  const walls = segments
    .map((s) => `M${r2(s.a.x)} ${r2(s.a.y)}L${r2(s.b.x)} ${r2(s.b.y)}`)
    .join('');
  const door = el.roomDoor ?? DEFAULT_ROOM_DOOR;
  const faceH = F - W / 2;
  const faces = brokenRun(width, door === 'n' ? roomDoorSpan(width, 'n') : null)
    .filter(([a, b]) => b - a > 0)
    .map(([a, b]) => ({ x: r2(a), y: 0, w: r2(b - a), h: faceH }));
  // Two slanted glints a third of the way along each face wide enough to take them.
  const glints = faces
    .filter((f) => f.w >= 48)
    .map((f) => {
      const x = f.x + Math.min(f.w * 0.3, 96);
      return `M${r2(x)} 5L${r2(x - 12)} ${faceH - 5}M${r2(x + 9)} 5L${r2(x + 3)} ${r2(faceH / 2)}`;
    })
    .join('');
  return { floor, walls, mullions, faces, glints };
}
