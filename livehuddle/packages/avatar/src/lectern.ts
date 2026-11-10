// Speaking from the Podium (livehuddle's docs/specs/009-elements/venue-pieces.md "Speaking from the Podium"): the
// lectern is held like a seat (seat-claims.ts) with one speaker spot (lectern-seats.ts), stood at rather than sat in.
// This module is what it adds to a seat: where a click walks you (its spot), the area your feet are "on" it (its box
// and its spot, which can lie just outside the box), and where you stop when somebody already speaks from it (a step
// to their side). Pure: no React, no DOM.

import type { Rect } from '@liveworkspace/model-core/geometry-primitives';
import { seatPoints, type Seat, type SeatedBox } from './seats';
import type { AvatarPoint } from './walk';

/** The Podium's shape kind. */
export const LECTERN_KIND = 'podium';

export function isLecternShape(kind: string | null | undefined): kind is 'podium' {
  return kind === LECTERN_KIND;
}

/** How far round its speaker spot a character's feet count as at the Podium, in canvas px. */
export const LECTERN_CATCH = 16;

/** How far to the speaker's side a character stops when the Podium is taken: one Regular character's width and a bit. */
export const LECTERN_ASIDE = 64;

/** A Podium as the walk reads it: its box and its facing (a rotation stored on it is ignored, as its drawing does). */
export type LecternBox = Rect & { chairFacing?: SeatedBox['chairFacing'] };

const asSeated = (el: LecternBox): SeatedBox => ({
  x: el.x,
  y: el.y,
  width: el.width,
  height: el.height,
  shape: 'podium',
  ...(el.chairFacing ? { chairFacing: el.chairFacing } : {}),
});

/** The speaker spot: where the speaker's feet go and the way they face, at the Podium's facing. */
export function lecternSpot(el: LecternBox): Seat {
  return seatPoints(asSeated(el))[0]!;
}

/**
 * The area a character's feet are at the Podium: its box, grown to take in LECTERN_CATCH round its speaker spot (the
 * spot lies outside the box when the Podium faces up or sideways), so walking to the spot arrives on it.
 */
export function lecternArea(el: LecternBox): Rect {
  const spot = lecternSpot(el);
  const x0 = Math.min(el.x, spot.x - LECTERN_CATCH);
  const y0 = Math.min(el.y, spot.y - LECTERN_CATCH);
  const x1 = Math.max(el.x + el.width, spot.x + LECTERN_CATCH);
  const y1 = Math.max(el.y + el.height, spot.y + LECTERN_CATCH);
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

/**
 * The area a piece's feet test reads: a Podium's lecternArea, any other piece its own box. What `elementUnderFeet` and
 * the chair arrival's "the piece you are going to" both measure, so they agree.
 */
export function catchArea<
  E extends Rect & { shape?: string; chairFacing?: SeatedBox['chairFacing'] },
>(el: E): Rect {
  return isLecternShape(el.shape) ? lecternArea(el) : el;
}

/**
 * Where a character stops when somebody already stands at the Podium: LECTERN_ASIDE to the side of the speaker spot,
 * along the Podium's front line (across the canvas when the speaker faces up or down, down it when they face left or
 * right), on the side nearer `from`; straight on, the canvas's right (or lower) side.
 */
export function lecternAside(spot: Seat, from: AvatarPoint, gap = LECTERN_ASIDE): AvatarPoint {
  if (spot.facing === 'down' || spot.facing === 'up')
    return { x: spot.x + (from.x < spot.x ? -gap : gap), y: spot.y };
  return { x: spot.x, y: spot.y + (from.y < spot.y ? -gap : gap) };
}
