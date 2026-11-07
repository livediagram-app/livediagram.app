'use client';

import { turnsWithFacing } from '@livediagram/document';
import { createPlacingTurnKeys } from '@liveworkspace/workbench/hooks/canvas/usePlacingTurnKeys';
import { facingAnnouncement, resetPlacingFacing, turnPlacing } from '@/lib/placing-facing';

// Space while placing (docs/specs/009-elements/furniture-facing.md "Turning while placing"): @liveworkspace/workbench's
// key handler, over this product's turning pieces and its placing facing (lib/placing-facing.ts). `kind` is what is
// being placed, or null; when it changes or the placing ends, the turn is forgotten.
export const usePlacingTurnKeys = createPlacingTurnKeys({
  turns: turnsWithFacing,
  turnPlacing,
  resetPlacingFacing,
  facingAnnouncement,
});
