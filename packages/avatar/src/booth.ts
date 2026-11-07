// livehuddle's Phone Booth (its docs/specs/009-elements/workday-pieces.md "Phone Booth"): a booth for one whose inside is
// a call of its own. The floor inside its frame, from the seat grid (seats.ts SEAT_VIEWS) of the drawing its facing
// shows, so the call is exactly the booth you see. Every drawing of the booth stands on the same square floor between
// the same posts, so a turned booth keeps its call where it stands (furniture-facing.md "A turn"). Pure: no React, no
// DOM.

import type { Rect } from '@liveworkspace/model-core/geometry-primitives';
import { facingView, type SeatFacing } from './facing';
import { drawnRect, SEAT_VIEWS } from './seats';

// On each of the booth's grids (80 x 136): its frame's posts, the foot of its roof and the sill under it.
const BOOTH_SIDE = 6;
const BOOTH_ROOF = 40;
const BOOTH_SILL = 6;

/** The floor inside a phone booth's frame, at its facing: where a character counts as in the booth's call. */
export function boothInterior(el: Rect, facing: SeatFacing = 'n'): Rect {
  const grid = SEAT_VIEWS['phone-booth'][facingView(facing).view];
  const d = drawnRect(el, grid);
  const s = d.width / grid.width;
  return {
    x: d.x + BOOTH_SIDE * s,
    y: d.y + BOOTH_ROOF * s,
    width: (grid.width - 2 * BOOTH_SIDE) * s,
    height: (grid.height - BOOTH_ROOF - BOOTH_SILL) * s,
  };
}
