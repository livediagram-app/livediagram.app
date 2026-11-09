'use client';

import { useSyncExternalStore } from 'react';
import { createListeners } from '@liveworkspace/workbench/lib/listeners';

// The way the piece being placed faces (docs/specs/009-elements/furniture-facing.md "Turning while
// placing"): Space turns it while its tile is armed or carried onto the canvas, the preview draws it turned, and the
// click or the drop lands it turned. Module-level per product, as the palette drag's preview is: a placing is global,
// one at a time and transient, and the preview, the key handler and both commits read it without a prop chain.
//
// The turn belongs to one kind: placing another kind starts at that kind's default facing, and the placing's end
// (usePlacingTurnKeys) forgets it, so the next placing starts afresh. What turns, a kind's default facing and a turn
// itself are the product's (its document package's furniture-facing.ts), handed in.

export type PlacingSize = { width: number; height: number };

export type PlacingFacingConfig<F extends string, E> = {
  /** Whether a kind takes a facing. */
  turns: (kind: string) => boolean;
  /** A new piece's facing. */
  defaultFacing: (kind: string) => F;
  /** The facing read while nothing is being placed (Down). */
  restingFacing: F;
  /** The facing a number of clockwise quarter turns away. */
  turnFacing: (facing: F, quarters: number) => F;
  /** The box a piece of `kind` at `size`, at its default facing, takes turned to `facing`. */
  turnedSize: (kind: string, size: PlacingSize, facing: F) => PlacingSize;
  /** The kind a newly placed element is, when it is a piece (a shape), else null. */
  kindOf: (el: E) => string | null;
  /** A newly placed element turned to face `facing`. */
  turnElement: <T extends E>(el: T, facing: F) => T;
};

export type PlacingFacing<F extends string, E> = {
  placingFacing: (kind: string) => F;
  turnPlacing: (kind: string, quarters: number) => F | null;
  resetPlacingFacing: () => void;
  usePlacingFacing: (kind: string | null) => F;
  subscribePlacingFacing: (listener: () => void) => () => void;
  placingSize: (kind: string, size: PlacingSize) => PlacingSize;
  withPlacingFacing: <T extends E>(el: T) => T;
};

export function createPlacingFacing<F extends string, E>(
  config: PlacingFacingConfig<F, E>,
): PlacingFacing<F, E> {
  let current: { kind: string; facing: F } | null = null;
  const listeners = createListeners();

  // The facing the piece of `kind` being placed has: its turn, or its default when it has not been turned.
  const placingFacing = (kind: string): F =>
    current?.kind === kind ? current.facing : config.defaultFacing(kind);

  return {
    placingFacing,

    // Turn the piece being placed a number of clockwise quarter turns; a kind that does not turn is left alone.
    turnPlacing: (kind, quarters) => {
      if (!config.turns(kind)) return null;
      const facing = config.turnFacing(placingFacing(kind), quarters);
      current = { kind, facing };
      listeners.notify();
      return facing;
    },

    // Forget the turn: the placing ended.
    resetPlacingFacing: () => {
      if (current === null) return;
      current = null;
      listeners.notify();
    },

    // The facing of the piece of `kind` being placed, re-rendering when Space turns it.
    usePlacingFacing: (kind) => {
      const placing = useSyncExternalStore(
        listeners.subscribe,
        () => current,
        () => null,
      );
      if (!kind) return config.restingFacing;
      return placing?.kind === kind ? placing.facing : config.defaultFacing(kind);
    },

    // Told whenever the piece being placed turns or the placing ends (the drag snap re-measures the turned piece).
    subscribePlacingFacing: listeners.subscribe,

    // The box a piece of `kind` takes at its own size `size`, turned the way it is being placed.
    placingSize: (kind, size) => {
      if (!config.turns(kind)) return size;
      const facing = placingFacing(kind);
      if (facing === config.defaultFacing(kind)) return size;
      return config.turnedSize(kind, size, facing);
    },

    // A newly placed element turned the way its placing faced; anything else as it is.
    withPlacingFacing: (el) => {
      const kind = config.kindOf(el);
      if (kind === null || !config.turns(kind)) return el;
      const facing = placingFacing(kind);
      return facing === config.defaultFacing(kind) ? el : config.turnElement(el, facing);
    },
  };
}
