// Placing a template's pieces for the 3D view (docs/specs/007-editor/templates-by-mode.md "Made for 3D"): in 3D a
// piece's model stands on its footprint at its facing (docs/specs/008-canvas/3d-engine.md "Block models"), often only
// the front part of its drawn box, so a piece is placed by where its model stands, not by its box. `against` stands
// a piece with its back flush on a room's wall facing into the room; `standAt` stands one with its model's middle on
// a point. Coordinates are room-relative (or site-relative for open pieces), drawn at the template's final size.
//
// Pure: each call returns a fresh OfficePiece.

import {
  SHAPE_DEFAULT_SIZE,
  footprintFractions,
  mountsOnWall,
  turnPiece,
  turnsWithFacing,
  type ChairFacing,
  type ShapeKind,
} from '@livehuddle/document';
import type { OfficePiece } from './template-office-parts';

export type WallSide = 'n' | 'e' | 's' | 'w';

// A Room's walls in 3D (scene-walls.ts: 8 px plaster on the wall lines): the back wall's line 31 px down its box, the
// others half a wall (5 px) in, so the room's inner faces are 35 px down and 9 px in. A piece stands a hair off them.
const BACK_FACE_3D = 35;
const SIDE_FACE_3D = 9;
const HAIR = 1;
// How far below the top of a room's back wall a hung piece's top sits (wall-mounted.ts WALL_HANG_INSET).
const HANG_INSET = 4;
// The pieces that hang flat on a wall and do not turn (wall-mounted.ts): a hung one is placed by its box.
const HUNG = new Set([
  'screen',
  'notice-board',
  'room-sign',
  'world-clock',
  'dartboard',
  'calendar-wall',
  'photo-wall',
  'hand-dryer',
]);

const OPPOSITE: Record<WallSide, ChairFacing> = { n: 's', s: 'n', e: 'w', w: 'e' };

const QUARTER: Record<ChairFacing, number> = { n: 0, e: 1, s: 2, w: 3 };

/** A piece's box at a facing: its turned drawing's size, as turning it in the editor gives it. */
export function boxAt(kind: ShapeKind, facing: ChairFacing = 'n'): { w: number; h: number } {
  // From the kind's default size, never createShape: a template's tables may be built at a module's top level, where
  // a Worker forbids the random id createShape draws.
  const made = { shape: kind, x: 0, y: 0, ...SHAPE_DEFAULT_SIZE[kind] };
  const turned = turnsWithFacing(kind) ? turnPiece(made, facing) : made;
  return { w: Math.round(turned.width), h: Math.round(turned.height) };
}

/**
 * Where a piece's model stands inside its box, from the box's top left (piece-frame.ts pieceFrame): the front
 * drawing's footprint, in a frame `W` across and `D` deep, turned to the facing about the box's middle.
 */
export function footIn(
  kind: ShapeKind,
  facing: ChairFacing,
  w: number,
  h: number,
): { x0: number; y0: number; x1: number; y1: number } {
  const turns = turnsWithFacing(kind);
  const q = turns ? QUARTER[facing] : 0;
  const across = q % 2 === 1;
  const W = across ? h : w;
  const D = across ? w : h;
  const fr = footprintFractions(kind, 'n');
  let fx0 = 0;
  let fy0 = 0;
  let fx1 = 1;
  let fy1 = 1;
  if (fr.length > 0) {
    fx0 = Math.min(...fr.map((f) => f.x0));
    fy0 = Math.min(...fr.map((f) => f.y0));
    fx1 = Math.max(...fr.map((f) => f.x1));
    fy1 = Math.max(...fr.map((f) => f.y1));
  }
  const corners = [
    [(fx0 - 0.5) * W, (fy0 - 0.5) * D],
    [(fx1 - 0.5) * W, (fy1 - 0.5) * D],
  ] as const;
  const yaw = (q * Math.PI) / 2;
  const c = Math.round(Math.cos(yaw));
  const s = Math.round(Math.sin(yaw));
  const pts = corners.map(([x, y]) => ({ x: w / 2 + x * c - y * s, y: h / 2 + x * s + y * c }));
  return {
    x0: Math.min(pts[0]!.x, pts[1]!.x),
    y0: Math.min(pts[0]!.y, pts[1]!.y),
    x1: Math.max(pts[0]!.x, pts[1]!.x),
    y1: Math.max(pts[0]!.y, pts[1]!.y),
  };
}

type Extra = Omit<Partial<OfficePiece>, 'kind' | 'x' | 'y' | 'w' | 'h' | 'facing'>;

const piece = (
  kind: ShapeKind,
  x: number,
  y: number,
  facing: ChairFacing | undefined,
  extra: Extra,
): OfficePiece => ({
  kind,
  x: Math.round(x),
  y: Math.round(y),
  // Its default size: furnishRooms turns it to its facing as the editor does, its box taking the turned size (boxAt).
  ...(facing && turnsWithFacing(kind) ? { facing } : {}),
  ...extra,
});

// A piece made for a wall (wall-mounted.ts mountsOnWall: a Bookshelf, a Fireplace, a Screen, a board, a sign) is
// placed as the editor snaps one: its box's back WALL_MOUNT_GAP (10 px) past the wall's line, a hung one on a room's
// back wall on its standing face, and the 3D view hangs it on the wall's face from there (3d-engine.md "Wall pieces
// sit on their wall"). Lines: the back wall's 31 px down a room's box, the others 5 px in.
const BACK_LINE = 31;
const SIDE_LINE = 5;
const MOUNT_GAP = 10;

type Room = { w: number; h: number };
type Placed = { x: number; y: number };

// Where a piece's box goes with its back to the `side` wall of a room at the origin, `inward` into the room or out.
function onWall(
  kind: ShapeKind,
  side: WallSide,
  at: number,
  room: Room,
  inward: boolean,
): Placed & { facing: ChairFacing; size: { w: number; h: number } } {
  const facing: ChairFacing = inward ? side : OPPOSITE[side];
  const size = boxAt(kind, facing);
  if (mountsOnWall(kind)) {
    const hung = HUNG.has(kind);
    const along = side === 'n' || side === 's' ? at - size.w / 2 : at - size.h / 2;
    const across = (() => {
      switch (side) {
        case 'n':
          if (!inward) return BACK_LINE - MOUNT_GAP - size.h;
          return hung ? HANG_INSET : BACK_LINE + MOUNT_GAP;
        case 's':
          return inward ? room.h - SIDE_LINE - MOUNT_GAP - size.h : room.h - SIDE_LINE + MOUNT_GAP;
        case 'w':
          return inward ? SIDE_LINE + MOUNT_GAP : SIDE_LINE - MOUNT_GAP - size.w;
        case 'e':
          return inward ? room.w - SIDE_LINE - MOUNT_GAP - size.w : room.w - SIDE_LINE + MOUNT_GAP;
      }
    })();
    return side === 'n' || side === 's'
      ? { x: along, y: across, facing, size }
      : { x: across, y: along, facing, size };
  }
  const foot = footIn(kind, facing, size.w, size.h);
  const midX = (foot.x0 + foot.x1) / 2;
  const midY = (foot.y0 + foot.y1) / 2;
  const face = {
    n: inward ? BACK_FACE_3D + HAIR : BACK_OUTER_3D - HAIR,
    s: inward ? room.h - SIDE_FACE_3D - HAIR : room.h - SIDE_OUTER_3D + HAIR,
    w: inward ? SIDE_FACE_3D + HAIR : SIDE_OUTER_3D - HAIR,
    e: inward ? room.w - SIDE_FACE_3D - HAIR : room.w - SIDE_OUTER_3D + HAIR,
  }[side];
  // The model's edge nearest the wall on the face.
  switch (side) {
    case 'n':
      return { x: at - midX, y: inward ? face - foot.y0 : face - foot.y1, facing, size };
    case 's':
      return { x: at - midX, y: inward ? face - foot.y1 : face - foot.y0, facing, size };
    case 'w':
      return { x: inward ? face - foot.x0 : face - foot.x1, y: at - midY, facing, size };
    case 'e':
      return { x: inward ? face - foot.x1 : face - foot.x0, y: at - midY, facing, size };
  }
}

/**
 * A piece with its back to a room's `side` wall, facing into the room, its model flush on the wall's inner face; `at`
 * is its model's middle along the wall (room-relative).
 */
export function against(
  kind: ShapeKind,
  side: WallSide,
  at: number,
  room: Room,
  extra: Extra = {},
): OfficePiece {
  const p = onWall(kind, side, at, room, true);
  return piece(kind, p.x, p.y, p.facing, extra);
}

// A room's walls' outer faces in 3D: the back wall's 27 px down its box, the others a hair inside it.
const BACK_OUTER_3D = 27;
const SIDE_OUTER_3D = 1;

/**
 * A piece outside a room (on the open floor or the lawn) with its back to the room's `side` wall, facing away from
 * it, its model flush on the wall's outer face; `at` is its model's middle along the wall (room-relative). Site
 * coordinates out, as the room's are.
 */
export function outside(
  kind: ShapeKind,
  room: { x: number; y: number; w: number; h: number },
  side: WallSide,
  at: number,
  extra: Extra = {},
): OfficePiece {
  const p = onWall(kind, side, at, room, false);
  return piece(kind, room.x + p.x, room.y + p.y, p.facing, extra);
}

/** A piece standing with its model's middle on (x, y), at `facing`. */
export function standAt(
  kind: ShapeKind,
  x: number,
  y: number,
  facing: ChairFacing = 'n',
  extra: Extra = {},
): OfficePiece {
  const size = boxAt(kind, facing);
  const foot = footIn(kind, facing, size.w, size.h);
  return piece(kind, x - (foot.x0 + foot.x1) / 2, y - (foot.y0 + foot.y1) / 2, facing, extra);
}

/** Where a room `b` stands to share its left neighbour `a`'s right wall (docs/specs/009-elements/office.md "Rooms line up"). */
export const besideX = (a: { x: number; w: number }) => a.x + a.w - 10;
/** Where a room stands to share the front wall of the room `a` above it, its back wall on that line. */
export const belowY = (a: { y: number; h: number }) => a.y + a.h - 36;

// A Room Sign at the campus size (template-campus-parts.ts CAMPUS_SIGN_W): 88 wide, its drawing's proportion kept.
const SIGN_W = 88;
const SIGN_H = 47;
// How far along the wall a sign stands from its Door's middle: past the Door's half and a little wall.
const SIGN_BESIDE = 48 + 18 + SIGN_W / 2;

/**
 * A room's Room Sign on the inside face of its Door's wall, beside the Door (`sign` -1 before it along the wall, 1
 * after it): a room opening onto another room (a floor, a hall) hangs its sign inside its own box, so it reads its
 * own room (virtual-office-template.md "Every room has a reason").
 */
export function signInside(
  box: { w: number; h: number },
  door: { side: WallSide; at: number; sign: -1 | 1 },
): OfficePiece {
  const at = door.at + door.sign * SIGN_BESIDE;
  const vertical = door.side === 'e' || door.side === 'w';
  const p = onWall('room-sign', door.side, at, box, true);
  const size = boxAt('room-sign');
  // At the campus size: shrunk about the spot it was placed for at full size.
  const dx = vertical ? 0 : (size.w - SIGN_W) / 2;
  const dy = vertical ? (size.h - SIGN_H) / 2 : door.side === 's' ? size.h - SIGN_H : 0;
  const ex = door.side === 'e' ? size.w - SIGN_W : 0;
  return { kind: 'room-sign', x: Math.round(p.x + dx + ex), y: Math.round(p.y + dy), w: SIGN_W };
}

/** Rooms each given its Room Sign inside, beside its Door (signInside), for a site built with `signs: false`. */
export function withSigns<
  R extends {
    w: number;
    h: number;
    pieces: OfficePiece[];
    door: { side: WallSide; at: number; sign: -1 | 1 };
  },
>(rooms: readonly R[]): R[] {
  return rooms.map((r) => ({ ...r, pieces: [...r.pieces, signInside(r, r.door)] }));
}

// How far a lounge's rug runs in under its sofa's front, so the sofa stands on it.
const RUG_UNDER = 24;

/**
 * A sofa with its back to a room's `side` wall (as `against`), on a rug that runs out in front of it into the room, its
 * near edge in under the sofa's front: the rug `w` along the wall and `h` deep (its default size, turned to a side
 * wall, unless given).
 */
export function sofaOnRug(
  side: WallSide,
  at: number,
  room: Room,
  rug: { w?: number; h?: number; variant?: OfficePiece['variant'] } = {},
): OfficePiece[] {
  const sofa = against('sofa', side, at, room);
  const size = boxAt('sofa', side);
  const base = SHAPE_DEFAULT_SIZE.rug;
  const across = side === 'e' || side === 'w';
  const w = rug.w ?? (across ? base.height : base.width);
  const h = rug.h ?? (across ? base.width : base.height);
  const { x, y } = {
    n: { x: at - w / 2, y: sofa.y + size.h - RUG_UNDER },
    s: { x: at - w / 2, y: sofa.y - h + RUG_UNDER },
    w: { x: sofa.x + size.w - RUG_UNDER, y: at - h / 2 },
    e: { x: sofa.x - w + RUG_UNDER, y: at - h / 2 },
  }[side];
  return [
    {
      kind: 'rug',
      x: Math.round(x),
      y: Math.round(y),
      w,
      h,
      ...(rug.variant ? { variant: rug.variant } : {}),
    },
    sofa,
  ];
}
