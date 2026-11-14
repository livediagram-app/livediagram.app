// A placed piece's type changed in place (docs/specs/009-elements/office.md "A piece's type"): a Door into a Double
// Door, an Oval rug into a Persian, a Straight corridor into a Corner, a Meeting Table into a Long Table. The piece
// keeps everything but its type, its box (the new type's own size, turned to its facing, about the old centre) and its
// aspect lock, which become what placing that type would give it. Pure: no React, no DOM.

import type { ShapeElement } from './index';
import { createShape } from './shape-factory';
import { applyShapeVariant } from './shape-variants';
import { pieceVariant, variantsOf } from './piece-variants';
import { pieceFacing, turnPiece, turnsWithFacing } from './furniture-facing';

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
