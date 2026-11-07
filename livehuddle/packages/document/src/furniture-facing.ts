// Turning furniture (docs/specs/009-elements/furniture-facing.md): which pieces take a facing, the drawing a piece
// shows at its facing, and a turn, which keeps the piece's centre and scale and gives its box the turned drawing's
// proportions. The arithmetic of a facing (its drawing, a quarter turn, a sitter's turn, the turned box) is
// @liveworkspace/avatar's facing.ts, shared with the walk that reads a piece's seats and footprint. Pure.

import type { Rect } from '@liveworkspace/model-core/geometry-primitives';
import { facingView, turnedBox, turnFacing, type SeatFacing } from '@liveworkspace/avatar/facing';
import { DEFAULT_SEATING_FACING } from '@liveworkspace/avatar/seats';
import { seatsACharacter } from '@liveworkspace/avatar/office-geometry';
import { FURNITURE_ART, isSeatingShape, type FurnitureArt } from './seating';
import { isGridOfficeShape, OFFICE_ART } from './office';

/** The facing a number of clockwise quarter turns away, for the editor's turn while placing. */
export { turnFacing };

// Every piece with a front that faces somewhere (furniture-facing.md "What turns"), in the palette's order.
const TURNING_KINDS = [
  // Seats.
  'chair',
  'desk',
  'sofa',
  'meeting-table',
  'bench',
  'picnic-table',
  'hammock',
  'bean-bag',
  'reading-nook',
  // The pod and the bar.
  'office-pod',
  'bar',
  'bar-stool',
  'drinks-cabinet',
  'drinks-fridge',
  // Office.
  'bookshelf',
  'printer',
  'copier',
  'lockers',
  'reception-desk',
  'hot-desk',
  'standing-desk',
  'phone-booth',
  // Kitchen.
  'water-cooler',
  'coffee-machine',
  'vending-machine',
  'kitchen-counter',
  'kitchen-sink',
  'fridge',
  'microwave',
  'kettle',
  // Restroom.
  'toilet-cubicle',
  'washbasin',
  // Play and rest.
  'ping-pong-table',
  'pool-table',
  'foosball-table',
  'jukebox',
  'arcade-machine',
  'fireplace',
  'nap-pod',
  'treadmill',
  'weight-bench',
  // Venue and wayfinding.
  'podium',
  'car-park',
  'bike-rack',
  'stairs',
  'suggestion-box',
  'rug',
] as const;

/** A piece of furniture that takes a facing. */
export type TurningKind = (typeof TURNING_KINDS)[number];

export const TURNING_SHAPES: readonly TurningKind[] = TURNING_KINDS;

const TURNING = new Set<string>(TURNING_KINDS);

/** Whether a kind takes a facing: the Rotate buttons, Space while placing, its turned drawings, seats and footprint. */
export function turnsWithFacing(kind: string): kind is TurningKind {
  return TURNING.has(kind);
}

/**
 * Whether a kind is furniture drawn from a fixed grid (a seat, an office piece): drawn upright from the room's
 * camera, so it never takes the ordinary rotation (docs/specs/009-elements/furniture-facing.md "No free rotation").
 */
export function isFurnitureShape(kind: string): boolean {
  return isSeatingShape(kind) || isGridOfficeShape(kind);
}

/** A piece's drawings, or null for a kind that is not furniture. */
export function pieceArt(kind: string): FurnitureArt | null {
  if (isSeatingShape(kind)) return FURNITURE_ART[kind];
  if (isGridOfficeShape(kind)) return OFFICE_ART[kind];
  return null;
}

/** A new piece's facing: Down for every piece but those placed with their sitter facing up at what they use. */
export function defaultPieceFacing(kind: string): SeatFacing {
  return seatsACharacter(kind) ? DEFAULT_SEATING_FACING[kind] : 'n';
}

/** The facing a piece is drawn at: its own when it turns, its default when unset, Down for a piece that never turns. */
export function pieceFacing(el: { shape: string; chairFacing?: SeatFacing }): SeatFacing {
  if (!turnsWithFacing(el.shape)) return 'n';
  return el.chairFacing ?? defaultPieceFacing(el.shape);
}

type Turnable = Rect & { shape: string; chairFacing?: SeatFacing; rotation?: number };

/**
 * A piece turned to face `to` (furniture-facing.md "A turn"): its box keeps its centre and scale and takes the turned
 * drawing's proportions, and any rotation stored before furniture stopped rotating is dropped, so it stands upright.
 * A piece that does not turn comes back as it was.
 */
export function turnPiece<E extends Turnable>(el: E, to: SeatFacing): E {
  const art = pieceArt(el.shape);
  if (!art || !turnsWithFacing(el.shape)) return el;
  const from = pieceFacing(el);
  const { x, y, width, height } = turnedBox(
    { x: el.x, y: el.y, width: el.width, height: el.height },
    art[facingView(from).view],
    art[facingView(to).view],
  );
  const { rotation: _dropped, ...rest } = el;
  return { ...rest, x, y, width, height, chairFacing: to } as E;
}

/** A piece turned a number of clockwise quarter turns (Rotate Right is +1, Rotate Left -1). */
export function turnPieceBy<E extends Turnable>(el: E, quarters: number): E {
  if (!turnsWithFacing(el.shape)) return el;
  return turnPiece(el, turnFacing(pieceFacing(el), quarters));
}
