// Room presets (docs/specs/009-elements/office-amenities.md "The Restroom preset"): a palette tile that places a Room
// already furnished. The Restroom is the first: a Room named Restroom (shape-variants.ts names it), its Door, two
// Toilet Cubicles, a Hand Dryer, two Washbasins and a Room Sign outside by the door. Placed in one change with the Room
// and its Door (`withDoorPiece`, room-builder.ts). Pure: no React, no DOM.

import { ROOM_DOOR_WIDTH } from '@liveworkspace/avatar/office-geometry';
import type { ShapeElement, ShapeKind } from './index';
import { createShape } from './shape-factory';
import { RESTROOM_VARIANT } from './shape-variants';

/** Where the Restroom's pieces stand, room-relative, for a room at its default 480 × 320: on the floor in front of the
 *  back wall (whose face, and the room's name plate on it, stay in view), clear of the doorway in the front wall. */
export const RESTROOM_LAYOUT: readonly { kind: ShapeKind; x: number; y: number }[] = [
  { kind: 'toilet-cubicle', x: 16, y: 40 },
  { kind: 'toilet-cubicle', x: 112, y: 40 },
  { kind: 'hand-dryer', x: 230, y: 64 },
  { kind: 'washbasin', x: 290, y: 44 },
  { kind: 'washbasin', x: 370, y: 44 },
];

/** The Restroom's door sign: a Room Sign this wide (aspect locked), beside the Door, this far below the front wall. */
export const RESTROOM_SIGN = { width: 88, gap: 10, beside: 16 } as const;

/**
 * The pieces a room preset places with its room, in canvas px, each in the room's stroke when it has one (as its Door
 * is), the Room Sign last. None for a room with no preset, or anything that is not a room.
 */
export function roomPresetCompanions(room: ShapeElement, variant?: string): ShapeElement[] {
  if (room.shape !== 'room' || variant !== RESTROOM_VARIANT) return [];
  const ink = room.strokeColor ? { strokeColor: room.strokeColor } : {};
  const pieces = RESTROOM_LAYOUT.map(({ kind, x, y }) => ({
    ...createShape(kind, room.x + x, room.y + y),
    ...ink,
  }));
  const base = createShape('room-sign', 0, 0);
  const height = Math.round((RESTROOM_SIGN.width * base.height) / base.width);
  const sign: ShapeElement = {
    ...base,
    x: room.x + room.width / 2 + ROOM_DOOR_WIDTH / 2 + RESTROOM_SIGN.beside,
    y: room.y + room.height + RESTROOM_SIGN.gap,
    width: RESTROOM_SIGN.width,
    height,
    ...ink,
  };
  return [...pieces, sign];
}
