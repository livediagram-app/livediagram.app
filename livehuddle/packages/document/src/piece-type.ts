// A placed piece's type changed in place (docs/specs/009-elements/office.md "A piece's type"): a Door into a Double
// Door, an Oval rug into a Persian, a Straight corridor into a Corner, a Meeting Table into a Long Table. The piece
// keeps everything but its type, its box (the new type's own size, turned to its facing, about the old centre) and its
// aspect lock, which become what placing that type would give it. Pure: no React, no DOM.

import type { Element, ShapeElement } from './index';
import { createShape } from './shape-factory';
import { applyShapeVariant } from './shape-variants';
import { pieceVariant, variantsOf } from './piece-variants';
import { pieceFacing, turnPiece, turnsWithFacing } from './furniture-facing';
import { snapDoorToWall, wallUnder } from './room-builder';

/** The kinds whose type the element menu changes. A Room's `variant` is its walls, set from its own Walls section. */
export const RETYPED_KINDS = ['door', 'rug', 'corridor', 'meeting-table'] as const;

const RETYPED = new Set<string>(RETYPED_KINDS);

/** Whether a kind's type is changed from the element menu's Type section. */
export function changesType(kind: string): boolean {
  return RETYPED.has(kind);
}

/**
 * `el` as `type`, or `el` itself when its kind is not retyped, does not take `type`, or already is it. The kind's first
 * type clears `variant`, as its plain palette tile places it.
 */
export function withPieceType(el: ShapeElement, type: string): ShapeElement {
  const types = variantsOf(el.shape);
  if (!changesType(el.shape) || !types.includes(type) || pieceVariant(el) === type) return el;
  const plain = type === types[0];
  // The type as its palette card places it, then turned to the piece's facing (a rug, a table on its side).
  const fresh = applyShapeVariant(createShape(el.shape, 0, 0), plain ? undefined : type);
  const facing = pieceFacing(el);
  const box =
    turnsWithFacing(el.shape) && facing !== pieceFacing(fresh) ? turnPiece(fresh, facing) : fresh;
  const { variant: _variant, aspectLocked: _locked, ...kept } = el;
  const cx = el.x + el.width / 2;
  const cy = el.y + el.height / 2;
  return {
    ...kept,
    ...(plain ? {} : { variant: type }),
    ...(fresh.aspectLocked ? { aspectLocked: true } : {}),
    x: cx - box.width / 2,
    y: cy - box.height / 2,
    width: box.width,
    height: box.height,
  };
}

// The length of the wall a door stands on among `elements`, or null for a door standing free (or any other piece).
function wallLengthUnder(el: ShapeElement, elements: readonly Element[]): number | null {
  if (el.shape !== 'door') return null;
  const wall = wallUnder(el, elements);
  return wall ? Math.hypot(wall.b.x - wall.a.x, wall.b.y - wall.a.y) : null;
}

/**
 * Whether `el` can become `type` where it stands (office.md "A piece's type"): a Door on a wall only as a type no wider
 * than that wall, so it never sticks out past the wall's end. Every other piece, and a free-standing door, always can.
 */
export function pieceTypeFits(
  el: ShapeElement,
  type: string,
  elements: readonly Element[],
): boolean {
  const length = wallLengthUnder(el, elements);
  return length === null || withPieceType(el, type).width <= length;
}

/**
 * `el` as `type` where it stands among `elements`: `withPieceType`, then a Door on a wall kept inside that wall (slid
 * along it clear of its ends, `snapDoorToWall`). A door whose new type is wider than its wall stays as it was.
 */
export function retypePiece(
  el: ShapeElement,
  type: string,
  elements: readonly Element[],
): ShapeElement {
  const next = withPieceType(el, type);
  const length = next === el ? null : wallLengthUnder(el, elements);
  if (length === null) return next;
  if (next.width > length) return el;
  return snapDoorToWall(next, elements);
}
