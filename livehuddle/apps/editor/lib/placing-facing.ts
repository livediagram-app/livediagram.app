'use client';

import {
  CHAIR_FACING_LABELS,
  defaultPieceFacing,
  turnFacing,
  turnPiece,
  turnsWithFacing,
  type ChairFacing,
  type Element,
} from '@livehuddle/document';
import { createPlacingFacing } from '@livehuddle/avatar/placing-facing';

// The way the piece being placed faces (docs/specs/009-elements/furniture-facing.md "Turning while placing"): Space
// turns it while its tile is armed or carried onto the canvas, and the click or the drop lands it turned. The store is
// @liveworkspace/workbench's, shared with every product that turns furniture; what turns, a kind's default facing and
// the turn are this product's (@livehuddle/document's furniture-facing.ts).

// A newly placed element turned to face `facing`: a piece of furniture that turns; anything else as it is.
function turnElement<E extends Element>(el: E, facing: ChairFacing): E {
  return el.type === 'shape' ? (turnPiece(el, facing) as E) : el;
}

export const {
  placingFacing,
  turnPlacing,
  resetPlacingFacing,
  usePlacingFacing,
  subscribePlacingFacing,
  placingSize,
  withPlacingFacing,
} = createPlacingFacing<ChairFacing, Element>({
  turns: turnsWithFacing,
  defaultFacing: defaultPieceFacing,
  restingFacing: 'n',
  turnFacing,
  turnedSize: (kind, size, facing) => {
    const { width, height } = turnPiece({ shape: kind, x: 0, y: 0, ...size }, facing);
    return { width, height };
  },
  kindOf: (el) => (el.type === 'shape' ? el.shape : null),
  turnElement,
});

/** What a screen reader hears when Space turns the piece: "Facing left". */
export function facingAnnouncement(facing: ChairFacing): string {
  return CHAIR_FACING_LABELS[facing];
}
