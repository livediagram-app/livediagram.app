// The virtual office (docs/specs/009-elements/office.md): the Room, the Meeting Table, the Plant, the Bookshelf,
// the Water Cooler, the Coffee Machine and the Rug. Their drawings are tables of parts in the furniture's
// vocabulary (seating.ts), drawn upright from the room's camera, which both renderers paint (the editor's views
// and svg-render-faces), so an office on the canvas and in an export are the same office. The geometry the
// Avatar-mode walk needs (a room's walls and doorway, the footprints of the scenery that blocks) is
// @liveworkspace/avatar/office-geometry, re-exported here. Pure: no React, no DOM.

import type { FurnitureArt, FurniturePart } from './seating';
import { rect, SHARED_OFFICE_ART } from '@liveworkspace/avatar/furniture-art';
import {
  brokenRun,
  roomDoorSpan,
  ROOM_BACK_FACE,
  ROOM_WALL,
  type RoomDoor,
} from '@liveworkspace/avatar/office-geometry';

// The geometry the Avatar-mode walk reads (floors, drinks, seats, a room's walls and doorway, the scenery's
// footprints) is @liveworkspace/avatar's, shared with every product that has Avatar mode.
export * from '@liveworkspace/avatar/office-geometry';

export type OfficeKind =
  'room' | 'meeting-table' | 'plant' | 'bookshelf' | 'water-cooler' | 'coffee-machine' | 'rug';

export const OFFICE_KINDS: readonly OfficeKind[] = [
  'room',
  'meeting-table',
  'plant',
  'bookshelf',
  'water-cooler',
  'coffee-machine',
  'rug',
];

export function isOfficeShape(kind: string): kind is OfficeKind {
  return (OFFICE_KINDS as readonly string[]).includes(kind);
}
/** The pieces drawn from a fixed grid (OFFICE_ART): every office piece but the Room, which is drawn to its size. */
export type GridOfficeKind = Exclude<OfficeKind, 'room'>;
export function isGridOfficeShape(kind: string): kind is GridOfficeKind {
  return isOfficeShape(kind) && kind !== 'room';
}

// The drawings, the fixed colours they keep whatever the theme, and where a machine answers a drink on each of its
// drawings are shared with livehuddle: @liveworkspace/avatar/furniture-art, re-exported here under the same names.
export {
  MACHINE_ANSWER_AT,
  MEETING_TABLE_ART,
  MEETING_TABLE_VIEW,
  OFFICE_TONES,
  type MachineAnswerSpot,
} from '@liveworkspace/avatar/furniture-art';

// Every office piece but the room, which is drawn to its size (roomParts).
export const OFFICE_ART: Record<GridOfficeKind, FurnitureArt> = SHARED_OFFICE_ART;

// --- The room ----------------------------------------------------------------

export const ROOM_DOOR_LABELS: Record<RoomDoor, string> = {
  n: 'Top',
  e: 'Right',
  s: 'Bottom',
  w: 'Left',
  none: 'None',
};
// The floor's wash when the room has no fill of its own.
export const ROOM_FLOOR = '#f5f0e6';
export const RUG_FILL = '#fde68a';

/** A room's drawing, in its own px (0..width, 0..height): floor, walls and doorway mat. */
export function roomParts(width: number, height: number, door: RoomDoor): FurniturePart[] {
  const W = ROOM_WALL;
  const F = ROOM_BACK_FACE;
  const parts: FurniturePart[] = [rect('floor', 0, F - W, width, height - F + W, 3)];
  // The back wall: its top, then its face standing up from the floor.
  for (const [a, b] of brokenRun(width, door === 'n' ? roomDoorSpan(width, 'n') : null)) {
    parts.push(rect('panel', a, 0, b - a, W, 2));
    parts.push(rect('face', a, W - 1, b - a, F - W + 1, 1));
  }
  // The side walls and the front wall, which you see the top of.
  for (const [a, b] of brokenRun(height, door === 'w' ? roomDoorSpan(height, 'w') : null))
    parts.push(rect('panel', 0, a, W, b - a, 2));
  for (const [a, b] of brokenRun(height, door === 'e' ? roomDoorSpan(height, 'e') : null))
    parts.push(rect('panel', width - W, a, W, b - a, 2));
  for (const [a, b] of brokenRun(width, door === 's' ? roomDoorSpan(width, 's') : null))
    parts.push(rect('panel', a, height - W, b - a, W, 2));
  // A mat across the doorway.
  const span = door === 'n' || door === 's' ? roomDoorSpan(width, door) : null;
  const side = door === 'e' || door === 'w' ? roomDoorSpan(height, door) : null;
  if (span && door === 's')
    parts.push(rect('rail', span[0] + 6, height - W - 14, span[1] - span[0] - 12, 10, 2));
  if (span && door === 'n')
    parts.push(rect('rail', span[0] + 6, F + 4, span[1] - span[0] - 12, 10, 2));
  if (side && door === 'w')
    parts.push(rect('rail', W + 4, side[0] + 6, 10, side[1] - side[0] - 12, 2));
  if (side && door === 'e')
    parts.push(rect('rail', width - W - 14, side[0] + 6, 10, side[1] - side[0] - 12, 2));
  // A room shrunk past its walls has no floor or mat left to draw: a part of no size is dropped, never drawn with a
  // negative width or height (an SVG error on the canvas and in an export).
  return parts.filter((p) => p.tag !== 'rect' || (p.w > 0 && p.h > 0));
}
