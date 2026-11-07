'use client';

import { SHAPE_DEFAULT_SIZE, turnsWithFacing, type ShapeKind } from '@livehuddle/document';
import {
  createPaletteCarry,
  type CarryDrop as SharedCarryDrop,
} from '@liveworkspace/workbench/lib/palette-carry';
import { setPaletteDragPreview } from '@/lib/palette-drag-preview';

// Carrying a palette tile onto the canvas by the pointer (docs/specs/009-elements/furniture-facing.md "Turning while
// placing"), so Space can turn a piece on its way: @liveworkspace/workbench's carry, over this product's turning
// pieces, their default sizes and its palette drag preview (palette-drag-preview.ts, `carried`). A touch keeps the
// browser's drag.

/** What a carry released over the canvas hands the drop: the kind, the tile's choice, and the release point. */
export type CarryDrop = SharedCarryDrop<ShapeKind>;

export const {
  carriesByPointer,
  carryPressed,
  subscribeCarryDrop,
  lastCarryDrop,
  startCarry,
  endCarry,
  cancelDragUnderCarry,
} = createPaletteCarry<ShapeKind>({
  carries: turnsWithFacing,
  sizeOf: (kind) => SHAPE_DEFAULT_SIZE[kind],
  setPreview: setPaletteDragPreview,
});
