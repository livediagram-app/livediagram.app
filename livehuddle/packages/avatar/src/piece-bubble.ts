// The proximity bubbles over a piece you stand at (docs/specs/009-elements/social-pieces.md "Arcade Machine",
// workday-pieces.md "Reception Desk"): Insert Coin with the machine's best, Welcome with Ring Bell. Each rises
// PIECE_BUBBLE.lift px above its piece, centred on it; where a Room Sign stands in that room (one placed by hand just
// above the piece), the bubble shows below the piece instead, so it never covers the sign (Work Tracker 615, 793).
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

/** Whether a piece's bubble shows below it: a Room Sign stands where it would rise. */
export function bubbleBelow(piece: Rect, grid: SignGrid): boolean {
  const room = bubbleAbove(piece);
  return signsNear(grid, room).some((sign) => boxesOverlap(room, sign));
}
