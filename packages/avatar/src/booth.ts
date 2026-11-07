// livehuddle's Phone Booth (its docs/specs/009-elements/workday-pieces.md "Phone Booth"): a booth for one whose inside is
// a call of its own. The floor inside its frame, from the seat grid (seats.ts PHONE_BOOTH_SEATS) the drawing uses, so
// the call is exactly the booth you see. Pure: no React, no DOM.

import type { Rect } from '@liveworkspace/model-core/geometry-primitives';
import { drawnRect, PHONE_BOOTH_SEATS } from './seats';

// On the booth's grid (80 x 136): its frame's sides, the foot of its roof and the sill under its glass.
const BOOTH_SIDE = 6;
const BOOTH_ROOF = 40;
const BOOTH_SILL = 6;

/** The floor inside a phone booth's frame: where a character counts as in the booth's call. */
export function boothInterior(el: Rect): Rect {
  const d = drawnRect(el, PHONE_BOOTH_SEATS);
  const s = d.width / PHONE_BOOTH_SEATS.width;
  return {
    x: d.x + BOOTH_SIDE * s,
    y: d.y + BOOTH_ROOF * s,
    width: (PHONE_BOOTH_SEATS.width - 2 * BOOTH_SIDE) * s,
    height: (PHONE_BOOTH_SEATS.height - BOOTH_ROOF - BOOTH_SILL) * s,
  };
}
