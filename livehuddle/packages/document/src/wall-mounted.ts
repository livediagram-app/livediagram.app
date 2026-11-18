// Pieces made for a wall (docs/specs/009-elements/wall-pieces.md): a Fireplace, a Bookshelf, a Screen, a Notice Board,
// a Room Sign and the rest only ever stand against a room's or a corridor's wall. Placed, dropped or moved, one lands on
// the nearest wall, its back to it, as a Door lands in one (room-builder.md "Door").
import { ROOM_BACK_FACE, ROOM_WALL } from '@livehuddle/avatar/office-geometry';
import type { SeatFacing } from '@livehuddle/avatar/facing';
import type { Element, ElementId, ShapeElement } from './index';
import { pieceFacing, turnPiece, turnsWithFacing } from './furniture-facing';
import { wallsOf } from './room-builder';

/** The kinds made for a wall. */
const WALL_MOUNTED: ReadonlySet<string> = new Set([
  'fireplace',
  'bookshelf',
  'screen',
  'notice-board',
  'room-sign',
  'world-clock',
  'dartboard',
  'calendar-wall',
  'photo-wall',
  'hand-dryer',
]);

/** Whether a piece of this kind only stands against a wall. */
export function mountsOnWall(kind: string): boolean {
  return WALL_MOUNTED.has(kind);
}

/** How far a mounted piece's back stands from its wall's centre line, in canvas px: the wall's half and a hair. */
export const WALL_MOUNT_GAP = ROOM_WALL;

type Side = {
  facing: SeatFacing;
  line: number;
  lo: number;
  hi: number;
  vertical: boolean;
  dir: 1 | -1;
  // How far up from the line a room's back wall's standing face reaches (its band in the plan), else 0.
  band: number;
};

/** How close to a wall's line a piece's box must come to count as on it, in canvas px. */
export const WALL_MOUNT_TOUCH = 24;

/** How far below the top of a room's back wall a hung piece's top sits, in canvas px (as the templates hang them). */
export const WALL_HANG_INSET = 4;

// Each straight wall's two faces a piece can stand against: which way its back points (its facing), the wall's line,
// its span, and the side (+1 below or right of the line, -1 above or left).
function sidesOf(elements: readonly Element[]): Side[] {
  const out: Side[] = [];
  for (const { a, b, room } of wallsOf(elements)) {
    if (Math.abs(a.y - b.y) < 0.5) {
      const lo = Math.min(a.x, b.x);
      const hi = Math.max(a.x, b.x);
      const back =
        room.shape === 'room' &&
        !room.roomOutline &&
        Math.abs(a.y - (room.y + ROOM_BACK_FACE - ROOM_WALL / 2)) < 0.5;
      const band = back ? a.y - room.y : 0;
      out.push({ facing: 'n', line: a.y, lo, hi, vertical: false, dir: 1, band });
      out.push({ facing: 's', line: a.y, lo, hi, vertical: false, dir: -1, band: 0 });
    } else if (Math.abs(a.x - b.x) < 0.5) {
      const lo = Math.min(a.y, b.y);
      const hi = Math.max(a.y, b.y);
      out.push({ facing: 'w', line: a.x, lo, hi, vertical: true, dir: 1, band: 0 });
      out.push({ facing: 'e', line: a.x, lo, hi, vertical: true, dir: -1, band: 0 });
    }
  }
  return out;
}

/**
 * A wall piece put against the nearest wall face (wall-pieces.md "Only on a wall"): turned so its back is to the wall
 * (a piece that cannot turn keeps facing the room's camera: on a side wall it stands out from it, like a blade sign),
 * slid along it to stay on it, and `WALL_MOUNT_GAP` off its line; a hung piece on a room's back wall hangs on its
 * standing face. Unchanged for one already on a wall, any other piece, or when the board has no wall.
 */
export function snapToWallFace(piece: ShapeElement, elements: readonly Element[]): ShapeElement {
  if (!mountsOnWall(piece.shape)) return piece;
  const turns = turnsWithFacing(piece.shape);
  const sides = sidesOf(elements);
  if (sides.some((side) => touches(piece, side, turns))) return piece;
  const cx = piece.x + piece.width / 2;
  const cy = piece.y + piece.height / 2;
  let best: { el: ShapeElement; dist: number } | null = null;
  for (const side of sides) {
    const turned = turns ? turnPiece(piece, side.facing) : piece;
    const { width: w, height: h } = turned;
    const across = side.vertical ? w : h;
    const along = side.vertical ? h : w;
    // Its back on the face: the near edge `WALL_MOUNT_GAP` past the line on this side; a hung piece on a room's back
    // wall hangs on its standing face instead, near its top.
    const back = side.line + side.dir * WALL_MOUNT_GAP;
    const hung = !turns && side.band > 0;
    const start = hung
      ? side.line - side.band + WALL_HANG_INSET
      : side.dir === 1
        ? back
        : back - across;
    const mid = side.vertical ? cy : cx;
    const span = side.hi - side.lo;
    const from =
      along <= span
        ? Math.max(side.lo, Math.min(side.hi - along, mid - along / 2))
        : side.lo + (span - along) / 2;
    const x = side.vertical ? start : from;
    const y = side.vertical ? from : start;
    const dist = Math.hypot(x + w / 2 - cx, y + h / 2 - cy);
    if (best && dist >= best.dist) continue;
    best = { el: { ...turned, x, y }, dist };
  }
  // A piece where it would land already touches its wall, so a found place always moves it.
  return best ? best.el : piece;
}

// Whether a piece already stands on this wall face: its box reaches the wall (or a back wall's standing face) with its
// middle along the wall's span, and a piece that turns has its back to it.
function touches(piece: ShapeElement, side: Side, turns: boolean): boolean {
  if (turns && pieceFacing(piece) !== side.facing) return false;
  const lo = side.vertical ? piece.x : piece.y;
  const hi = lo + (side.vertical ? piece.width : piece.height);
  const mid = side.vertical ? piece.y + piece.height / 2 : piece.x + piece.width / 2;
  if (mid < side.lo || mid > side.hi) return false;
  // On this face's side of the line (its middle past it, or on a back wall's standing face)...
  const centre = (lo + hi) / 2;
  if (side.dir === 1 ? centre < side.line - side.band : centre > side.line) return false;
  // ...with its box reaching the wall's band: over the line, against a face, or on a back wall's standing face.
  return hi >= side.line - side.band - WALL_MOUNT_TOUCH && lo <= side.line + WALL_MOUNT_TOUCH;
}

/** Each wall piece among `ids` put back against its nearest wall (one moved by a drag). Same array when none moved. */
export function snapMovedWallPieces(
  els: Element[],
  ids: { has(id: ElementId): boolean },
): Element[] {
  let changed = false;
  const out = els.map((el) => {
    if (!ids.has(el.id) || el.type !== 'shape' || !mountsOnWall(el.shape)) return el;
    const next = snapToWallFace(el, els);
    if (next !== el) changed = true;
    return next;
  });
  return changed ? out : els;
}
