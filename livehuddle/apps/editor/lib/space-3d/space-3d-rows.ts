// The rows of a piece the 3D view builds rather than stands up whole (docs/specs/008-canvas/3d-view.md "Tables are
// built, not stood"): which drawing it shows, its rows laid out, and the row a sitter sits on. Pure.

import {
  FURNITURE_ART,
  furnitureFrame,
  isLongTable,
  isSeatingShape,
  longTableArt,
  OFFICE_ART,
  pieceFacing,
  type Element,
  type FurnitureArt,
  type GridOfficeKind,
} from '@livehuddle/document';
import { rowLayouts, type RowLayout } from '@livehuddle/avatar/furniture-rows';
import { facingView } from '@livehuddle/avatar/facing';

type Shape = Extract<Element, { type: 'shape' }>;

/** A piece's drawings: a Long Table's for its box, a seat's, or an office piece's. */
export function pieceArt(el: Shape): FurnitureArt | undefined {
  if (isLongTable(el)) return longTableArt(el.width, el.height, pieceFacing(el));
  if (isSeatingShape(el.shape)) return FURNITURE_ART[el.shape];
  return OFFICE_ART[el.shape as GridOfficeKind];
}

// The last few layouts, by drawing: a drawing's rows never change.
const layouts = new WeakMap<object, RowLayout[]>();

/** The rows of the drawing a piece shows, laid out on its grid, or null for a piece that stands whole. */
export function pieceRows(el: Shape): { rows: RowLayout[]; width: number; height: number } | null {
  const art = pieceArt(el);
  if (!art) return null;
  const { view } = furnitureFrame(art, pieceFacing(el));
  if (!view.rows3D) return null;
  let rows = layouts.get(view);
  if (!rows) {
    rows = rowLayouts(view.parts, view.rows3D);
    layouts.set(view, rows);
  }
  return { rows, width: view.width, height: view.height };
}

type Box = { x: number; y: number; width: number; height: number };

/**
 * The box, in canvas px, of the row a sitter's feet are on (the chair, the bench), so the sitter is lifted to its
 * front rather than the whole table's; the piece's own box when no row holds them. Marked `rows`, so no legs are
 * hidden by hand: the table in front hides them.
 */
export function seatRowBox(el: Shape, feet: { x: number; y: number }): Box & { rows?: true } {
  const laid = pieceRows(el);
  if (!laid) return el;
  const sx = el.width / laid.width;
  const sy = el.height / laid.height;
  // Mirrored facings draw the side drawing flipped across: the feet are read on the drawing's own grid.
  const { mirrored } = facingView(pieceFacing(el));
  const gx = (mirrored ? el.x + el.width - feet.x : feet.x - el.x) / sx;
  const gy = (feet.y - el.y) / sy;
  for (const r of laid.rows) {
    const b = r.box;
    if (gx < b.left - 2 || gx > b.right + 2 || gy < b.top - 2 || gy > b.bottom + 2) continue;
    const left = mirrored ? laid.width - b.right : b.left;
    return {
      x: el.x + left * sx,
      y: el.y + b.top * sy,
      width: (b.right - b.left) * sx,
      height: (r.foot - b.top) * sy,
      rows: true,
    };
  }
  return { ...el, rows: true };
}
