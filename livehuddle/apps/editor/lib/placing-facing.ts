'use client';

import { useSyncExternalStore } from 'react';
import {
  CHAIR_FACING_LABELS,
  defaultPieceFacing,
  turnFacing,
  turnPiece,
  turnsWithFacing,
  type ChairFacing,
  type Element,
} from '@livehuddle/document';
import { createListeners } from '@liveworkspace/workbench/lib/listeners';

// The way the piece being placed faces (docs/specs/009-elements/furniture-facing.md "Turning while placing"): Space
// turns it while its tile is armed or carried onto the canvas, the preview draws it turned, and the click or the drop
// lands it turned. Module-level, as the palette drag's preview is (palette-drag-preview.ts): a placing is global,
// one at a time and transient, and the preview, the key handler and both commits read it without a prop chain.
//
// The turn belongs to one kind: placing another kind starts at that kind's default facing, and the placing's end
// (usePlacingTurnKeys) forgets it, so the next placing starts afresh.

type Placing = { kind: string; facing: ChairFacing } | null;

let current: Placing = null;
const listeners = createListeners();

/** The facing the piece of `kind` being placed has: its turn, or its default when it has not been turned. */
export function placingFacing(kind: string): ChairFacing {
  return current?.kind === kind ? current.facing : defaultPieceFacing(kind);
}

/** Turn the piece being placed a number of clockwise quarter turns; a kind that does not turn is left alone. */
export function turnPlacing(kind: string, quarters: number): ChairFacing | null {
  if (!turnsWithFacing(kind)) return null;
  const facing = turnFacing(placingFacing(kind), quarters);
  current = { kind, facing };
  listeners.notify();
  return facing;
}

/** Forget the turn: the placing ended. */
export function resetPlacingFacing(): void {
  if (current === null) return;
  current = null;
  listeners.notify();
}

/** The facing of the piece of `kind` being placed, re-rendering when Space turns it. */
export function usePlacingFacing(kind: string | null): ChairFacing {
  const placing = useSyncExternalStore(
    listeners.subscribe,
    () => current,
    () => null,
  );
  if (!kind) return 'n';
  return placing?.kind === kind ? placing.facing : defaultPieceFacing(kind);
}

/** Told whenever the piece being placed turns or the placing ends (the drag snap re-measures the turned piece). */
export const subscribePlacingFacing = listeners.subscribe;

/** The box a piece of `kind` takes at its own size `size`, turned the way it is being placed. */
export function placingSize(
  kind: string,
  size: { width: number; height: number },
): { width: number; height: number } {
  if (!turnsWithFacing(kind)) return size;
  const facing = placingFacing(kind);
  if (facing === defaultPieceFacing(kind)) return size;
  const { width, height } = turnPiece({ shape: kind, x: 0, y: 0, ...size }, facing);
  return { width, height };
}

/** A newly placed element turned the way its placing faced; anything else as it is. */
export function withPlacingFacing<E extends Element>(el: E): E {
  if (el.type !== 'shape' || !turnsWithFacing(el.shape)) return el;
  const facing = placingFacing(el.shape);
  return facing === defaultPieceFacing(el.shape) ? el : (turnPiece(el, facing) as E);
}

/** What a screen reader hears when Space turns the piece: "Facing left". */
export function facingAnnouncement(facing: ChairFacing): string {
  return CHAIR_FACING_LABELS[facing];
}
