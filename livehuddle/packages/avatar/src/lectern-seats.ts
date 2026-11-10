// The Podium's speaker spot on each of its drawings (livehuddle's docs/specs/009-elements/venue-pieces.md "Speaking
// from the Podium"): where the speaker's feet go, as fractions of the drawing's grid, the grids the document package
// draws the Podium on (office-venue.ts PODIUM_VIEW, PODIUM_BACK, PODIUM_SIDE). Kept apart from seats.ts, which reads
// them into SEAT_VIEWS, so lectern.ts can use the seats without a cycle. Pure: no React, no DOM.
//
// The rule: the speaker faces the way the Podium's front faces and stands on the other side of it, always clear of
// the foot that blocks (office-geometry.ts OFFICE_FOOTPRINT podium, y 74..86 / 88) by more than a Tall character's
// reach (collision.ts fenceReachFor), so standing there never starts a character inside it.

import type { FixedSeatGrid, SeatGrid } from './seats';

/** From the front (facing Down): behind it, up the canvas, just above its sloping top, facing down at the room. */
export const LECTERN_SEATS: FixedSeatGrid = {
  width: 56,
  height: 88,
  seats: [{ u: 0.5, v: 20 / 88, facing: 'down' }],
};

/** From behind (facing Up): the speaker's side nearest the camera, just below its foot, facing up at the room. */
export const LECTERN_SEATS_BACK: SeatGrid = {
  width: 56,
  height: 88,
  seats: [{ u: 0.5, v: 104 / 88 }],
};

/** On its side (facing Left, mirrored for Right): at its right, at its foot's depth, clear of the foot, facing left. */
export const LECTERN_SEATS_SIDE: SeatGrid = {
  width: 44,
  height: 88,
  seats: [{ u: 58 / 44, v: 80 / 88 }],
};
