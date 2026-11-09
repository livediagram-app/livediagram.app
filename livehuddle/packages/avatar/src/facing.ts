// Which way a piece of furniture faces (docs/specs/009-elements/furniture-facing.md, livediagram's
// docs/specs/009-elements/chair.md "Facing"): the four facings, the drawing each one shows, and the arithmetic of a
// quarter turn, for a piece's drawing, its seats and its footprint alike. Pure: no React, no DOM.
//
// Every piece is drawn from the room's camera, so a turn never rotates a drawing: a piece has a `front` drawing (its
// front toward you), a `back` and a `side` (facing left), and facing right is the side drawing mirrored.

import type { Rect } from '@liveworkspace/model-core/geometry-primitives';
import type { AvatarFacing } from './walk';

/** Where a piece's back is: 'n' at the top, so its front (and its sitter) faces down the canvas. */
export type SeatFacing = 'n' | 'e' | 's' | 'w';

export const SEAT_FACINGS: readonly SeatFacing[] = ['n', 'e', 's', 'w'];

export function isSeatFacing(value: unknown): value is SeatFacing {
  return (SEAT_FACINGS as readonly unknown[]).includes(value);
}

/** One of a piece's three drawings. */
export type SeatView = 'front' | 'back' | 'side';

/** Which drawing a facing shows, and whether it is the mirrored side. */
export function facingView(facing: SeatFacing): { view: SeatView; mirrored: boolean } {
  switch (facing) {
    case 's':
      return { view: 'back', mirrored: false };
    case 'e':
      return { view: 'side', mirrored: false };
    case 'w':
      return { view: 'side', mirrored: true };
    default:
      return { view: 'front', mirrored: false };
  }
}

// Clockwise quarter turns from Down ('n'): Down, Left, Up, Right.
const QUARTERS: Record<SeatFacing, number> = { n: 0, e: 1, s: 2, w: 3 };

/** The facing a number of clockwise quarter turns away (negative turns anticlockwise): Rotate Right is +1. */
export function turnFacing(facing: SeatFacing, quarters: number): SeatFacing {
  return SEAT_FACINGS[(((QUARTERS[facing] + quarters) % 4) + 4) % 4]!;
}

/** The turn, in clockwise degrees, from one facing to another. */
export function facingTurn(from: SeatFacing, to: SeatFacing): 0 | 90 | 180 | 270 {
  return (((((QUARTERS[to] - QUARTERS[from]) % 4) + 4) % 4) * 90) as 0 | 90 | 180 | 270;
}

/** Whether going from one facing to another lays the piece on its side (a quarter turn), changing its box. */
export function facingSwapsBox(from: SeatFacing, to: SeatFacing): boolean {
  const turn = facingTurn(from, to);
  return turn === 90 || turn === 270;
}

// A character's facing a quarter turn clockwise on the screen: down, left, up, right.
const AVATAR_CLOCKWISE: Record<AvatarFacing, AvatarFacing> = {
  down: 'left',
  left: 'up',
  up: 'right',
  right: 'down',
};
const AVATAR_MIRROR: Record<AvatarFacing, AvatarFacing> = {
  down: 'down',
  up: 'up',
  left: 'right',
  right: 'left',
};

/**
 * Which way a sitter faces in a turned piece, given the way they face in its front drawing. The side drawing is the
 * front turned a quarter clockwise, and facing right is that drawing mirrored (left and right swap, up and down stay),
 * so a seat is read off the drawing it is drawn on rather than turned three quarters.
 */
export function turnedSitterFacing(front: AvatarFacing, facing: SeatFacing): AvatarFacing {
  switch (facing) {
    case 's':
      return AVATAR_CLOCKWISE[AVATAR_CLOCKWISE[front]];
    case 'e':
      return AVATAR_CLOCKWISE[front];
    case 'w':
      return AVATAR_MIRROR[AVATAR_CLOCKWISE[front]];
    default:
      return front;
  }
}

/** A drawing's grid: what its viewBox is, in grid units. */
export type ViewGrid = { width: number; height: number };

/** A box as fractions of a drawing's grid: what a footprint is drawn as. */
export type GridFraction = { x0: number; x1: number; y0: number; y1: number };

/** A fraction of the side drawing as the mirrored side (facing right) has it. */
export function mirrorFraction(f: GridFraction): GridFraction {
  return { x0: 1 - f.x1, x1: 1 - f.x0, y0: f.y0, y1: f.y1 };
}

/**
 * The box a piece takes when it turns from one drawing to another: the same centre and the same scale, its sides the
 * new drawing's proportions. The scale is the one the current box draws its current drawing at (fitted whole, as every
 * renderer fits it), so a piece that was letterboxed keeps its drawn size rather than growing into its box.
 */
export function turnedBox(box: Rect, from: ViewGrid, to: ViewGrid): Rect {
  const scale = Math.min(box.width / from.width, box.height / from.height);
  if (!(scale > 0) || !Number.isFinite(scale)) return { ...box };
  const width = to.width * scale;
  const height = to.height * scale;
  // Same drawing proportions both ways (a chair, a quarter turn of a piece drawn square): the box is kept as it is.
  if (Math.abs(to.width / to.height - from.width / from.height) < 1e-9) return { ...box };
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  return { x: cx - width / 2, y: cy - height / 2, width, height };
}
