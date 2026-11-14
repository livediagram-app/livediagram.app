// The proximity bubbles over a piece you stand at (docs/specs/009-elements/social-pieces.md "Arcade Machine",
// workday-pieces.md "Reception Desk"): Insert Coin with the machine's best, Welcome with Ring Bell. Each rises
// PIECE_BUBBLE.lift px above its piece, centred on it; where a Room Sign stands in that room (one placed by hand just
// above the piece), the bubble shows beside the piece instead (or below it, with neither side clear), so it never
// covers the sign (Work Tracker 615, 793).
// The signs are put in a coarse grid once per board change, so each bubble reads only the signs in the few cells its
// room touches, never every element on the board. Pure: no React, no DOM.

import type { Rect } from '@liveworkspace/model-core/geometry-primitives';

/**
 * The room a bubble takes, in canvas px: as wide as Insert Coin with a long best line under it (its 140 px cap,
 * padding and border), as tall as those two lines, lifted 6 px off the piece.
 */
export const PIECE_BUBBLE = { width: 160, height: 44, lift: 6 } as const;
/** The pieces that raise a proximity bubble. */
export const BUBBLE_PIECES: ReadonlySet<string> = new Set(['arcade-machine', 'reception-desk']);
// The side of a sign grid's cell, in canvas px: a few bubbles wide, so a bubble's room touches at most four cells.
const SIGN_CELL = 256;

/** Where a piece's bubble rises: PIECE_BUBBLE's room, centred above the piece. */
export function bubbleAbove(piece: Rect): Rect {
  return {
    x: piece.x + piece.width / 2 - PIECE_BUBBLE.width / 2,
    y: piece.y - PIECE_BUBBLE.lift - PIECE_BUBBLE.height,
    width: PIECE_BUBBLE.width,
    height: PIECE_BUBBLE.height,
  };
}

/** Whether two boxes overlap (edges that only touch do not). */
export function boxesOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

/** The board's Room Signs by grid cell. */
export type SignGrid = ReadonlyMap<string, readonly Rect[]>;

const cellKey = (cx: number, cy: number) => `${cx},${cy}`;

function eachCell(box: Rect, visit: (key: string) => void): void {
  const x0 = Math.floor(box.x / SIGN_CELL);
  const x1 = Math.floor((box.x + box.width) / SIGN_CELL);
  const y0 = Math.floor(box.y / SIGN_CELL);
  const y1 = Math.floor((box.y + box.height) / SIGN_CELL);
  for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) visit(cellKey(cx, cy));
}

/** The signs put in their cells: once per board change, linear in the signs. */
export function signGrid(signs: readonly Rect[]): SignGrid {
  const grid = new Map<string, Rect[]>();
  for (const sign of signs)
    eachCell(sign, (key) => {
      const list = grid.get(key);
      if (list) list.push(sign);
      else grid.set(key, [sign]);
    });
  return grid;
}

/** The signs in the cells a box touches: the only ones that can overlap it. */
export function signsNear(grid: SignGrid, box: Rect): Rect[] {
  if (grid.size === 0) return [];
  const near = new Set<Rect>();
  eachCell(box, (key) => {
    for (const sign of grid.get(key) ?? []) near.add(sign);
  });
  return [...near];
}

/** Where a piece's bubble shows against it. */
export type PieceBubbleSide = 'above' | 'left' | 'right' | 'below';

/** The bubble's room beside the piece, level with its top, PIECE_BUBBLE.lift off its side. */
export function bubbleBeside(piece: Rect, side: 'left' | 'right'): Rect {
  return {
    x:
      side === 'left'
        ? piece.x - PIECE_BUBBLE.lift - PIECE_BUBBLE.width
        : piece.x + piece.width + PIECE_BUBBLE.lift,
    y: piece.y,
    width: PIECE_BUBBLE.width,
    height: PIECE_BUBBLE.height,
  };
}

const clearOf = (grid: SignGrid, room: Rect) =>
  !signsNear(grid, room).some((sign) => boxesOverlap(room, sign));

// How far the floor beside the piece runs free of signs on one side, level with the bubble's room, out to two bubble
// widths (enough to rank the sides); only the signs in the cells that strip touches are read.
function roomBeside(piece: Rect, side: 'left' | 'right', grid: SignGrid): number {
  const reach = 2 * PIECE_BUBBLE.width;
  const strip: Rect = {
    x: side === 'left' ? piece.x - reach : piece.x + piece.width,
    y: piece.y,
    width: reach,
    height: PIECE_BUBBLE.height,
  };
  let room = reach;
  for (const sign of signsNear(grid, strip)) {
    if (!boxesOverlap(strip, sign)) continue;
    const gap =
      side === 'left' ? piece.x - (sign.x + sign.width) : sign.x - (piece.x + piece.width);
    room = Math.min(room, Math.max(0, gap));
  }
  return room;
}

/**
 * Where a piece's bubble shows (Work Tracker 793): above it while no Room Sign stands in that room; else beside it,
 * level with its top, on the side with the most free room (the right on a tie), clear of the people standing at its
 * front; below it only when neither side is clear.
 */
export function bubbleSide(piece: Rect, grid: SignGrid): PieceBubbleSide {
  if (grid.size === 0 || clearOf(grid, bubbleAbove(piece))) return 'above';
  const sides = (['right', 'left'] as const)
    .filter((side) => clearOf(grid, bubbleBeside(piece, side)))
    .map((side) => ({ side, room: roomBeside(piece, side, grid) }));
  if (sides.length === 0) return 'below';
  return sides.reduce((best, s) => (s.room > best.room ? s : best)).side;
}

/**
 * The side a bubble shows on once drawn: a bubble beside its piece that would leave the visible view (a wide
 * Reception Desk on a phone, where the screen holds the desk and little more) shows below instead, where it stays in
 * view under the piece. `bubble` and `view` are in the same space (screen px from the drawn bubble's box); above and
 * below are kept as they are.
 */
export function sideInView(side: PieceBubbleSide, bubble: Rect, view: Rect): PieceBubbleSide {
  if (side !== 'left' && side !== 'right') return side;
  const inside =
    bubble.x >= view.x &&
    bubble.x + bubble.width <= view.x + view.width &&
    bubble.y >= view.y &&
    bubble.y + bubble.height <= view.y + view.height;
  return inside ? side : 'below';
}
