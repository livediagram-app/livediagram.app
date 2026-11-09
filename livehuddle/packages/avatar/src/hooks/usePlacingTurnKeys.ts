'use client';

import { useEffect } from 'react';
import { isInMenuSurface } from '@liveworkspace/ui';
import { announce } from '@liveworkspace/workbench/lib/announcer';
import { anyModalOpen } from '@liveworkspace/workbench/lib/modal-guard';
import { isTypingTarget } from '@liveworkspace/workbench/lib/typing-target';

// Space while placing (docs/specs/009-elements/furniture-facing.md "Turning while placing"): while a
// piece that turns is being placed (its tile armed, or carried from the palette), Space turns it a quarter clockwise
// and Shift+Space anticlockwise, and does nothing else: it neither pans the canvas nor starts editing the selection's
// label. Listened for on the window in the capture phase, ahead of the pan and the label key, which never hear the
// press, its repeats or its release. The focused palette tile is not pressed by it either, so the tile stays armed. A
// field being typed in, a menu and a dialog keep their Space.
//
// What turns, the turn itself and what a screen reader hears are the product's (its lib/placing-facing.ts), handed in
// once; the hook made takes `kind`, what is being placed, or null. When it changes or the placing ends, the turn is
// forgotten.

export type PlacingTurnKeysConfig<F extends string> = {
  turns: (kind: string) => boolean;
  turnPlacing: (kind: string, quarters: number) => F | null;
  resetPlacingFacing: () => void;
  /** What a screen reader hears when Space turns the piece: "Facing left". */
  facingAnnouncement: (facing: F) => string;
};

export function createPlacingTurnKeys<F extends string>(
  config: PlacingTurnKeysConfig<F>,
): (kind: string | null) => void {
  const { turns, turnPlacing, resetPlacingFacing, facingAnnouncement } = config;
  return function usePlacingTurnKeys(kind: string | null): void {
    useEffect(() => {
      if (!kind) return;
      return () => resetPlacingFacing();
    }, [kind]);

    const turning = !!kind && turns(kind);
    useEffect(() => {
      if (!turning || !kind) return;
      // Whether the press now down was ours, so its release is swallowed too (a button activates on Space's keyup).
      let ours = false;
      const down = (e: KeyboardEvent) => {
        if (e.code !== 'Space' || e.metaKey || e.ctrlKey || e.altKey) return;
        if (isTypingTarget(e.target) || isInMenuSurface(e.target) || anyModalOpen()) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        ours = true;
        // Holding Space turns it once, not round and round.
        if (e.repeat) return;
        const facing = turnPlacing(kind, e.shiftKey ? -1 : 1);
        if (facing) announce(facingAnnouncement(facing));
      };
      const up = (e: KeyboardEvent) => {
        if (e.code !== 'Space' || !ours) return;
        ours = false;
        e.preventDefault();
        e.stopImmediatePropagation();
      };
      window.addEventListener('keydown', down, true);
      window.addEventListener('keyup', up, true);
      return () => {
        window.removeEventListener('keydown', down, true);
        window.removeEventListener('keyup', up, true);
      };
    }, [kind, turning]);
  };
}
