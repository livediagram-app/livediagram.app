// The virtual office (docs/specs/009-elements/office.md): the Room, the Meeting Table, the Plant, the Bookshelf,
// the Water Cooler, the Coffee Machine, the Rug and the Stage. Their drawings are tables of parts in the furniture's
// vocabulary (seating.ts), drawn upright from the room's camera, which both renderers paint (the editor's views
// and svg-render-faces), so an office on the canvas and in an export are the same office. The geometry the
// Avatar-mode walk needs (a room's walls and doorway, the footprints of the scenery that blocks) is
// @liveworkspace/avatar/office-geometry, re-exported here. Pure: no React, no DOM.

import type { Rect } from '@liveworkspace/model-core/geometry-primitives';
import type { FurnitureArt, FurniturePart } from './seating';
import { path, rect } from './furniture-parts';
import { SHARED_OFFICE_ART } from '@liveworkspace/avatar/furniture-art';
import {
  brokenRun,
  roomDoorSpan,
  ROOM_BACK_FACE,
  ROOM_WALL,
  type RoomDoor,
} from '@liveworkspace/avatar/office-geometry';
import { LONG_TABLE_VARIANT } from '@liveworkspace/avatar/seats';
import { OFFICE_EXTRA_ART } from './office-garden';
import { OFFICE_SOCIAL_ART } from './office-social';
import { OFFICE_RECREATION_ART } from './office-recreation';
import { OFFICE_WORKPLACE_ART } from './office-workplace';
import { OFFICE_KITCHEN_ART } from './office-kitchen';
import { OFFICE_RESTROOM_ART } from './office-restroom';
import { OFFICE_VENUE_ART } from './office-venue';
import { OFFICE_WORKDAY_ART } from './office-workday';
import { WAYFINDING_ART } from './office-wayfinding';
import { OFFICE_TEAM_ART } from './office-team';

// The geometry the Avatar-mode walk reads (floors, drinks, seats, a room's walls and doorway, the scenery's
// footprints) is @liveworkspace/avatar's, shared with every product that has Avatar mode.
export * from '@liveworkspace/avatar/office-geometry';

export type OfficeKind =
  | 'room'
  // The Corridor (docs/specs/009-elements/corridor.md).
  | 'corridor'
  | 'meeting-table'
  | 'plant'
  | 'bookshelf'
  | 'water-cooler'
  | 'coffee-machine'
  | 'rug'
  | 'stage'
  // The pod, the bar and the garden (docs/specs/009-elements/office.md "Office Pod" to "Garden Fence").
  | 'office-pod'
  | 'bar'
  | 'bar-stool'
  | 'drinks-cabinet'
  | 'drinks-fridge'
  | 'outdoor-plant'
  | 'tree'
  | 'garden-path'
  | 'grass'
  | 'garden-fence'
  // The Door (docs/specs/009-elements/room-builder.md "Door").
  | 'door'
  // The Window (docs/specs/009-elements/room-builder.md "Window").
  | 'window'
  // Wayfinding (docs/specs/009-elements/directory.md, elevator.md).
  | 'directory'
  | 'elevator'
  | 'stairs'
  // The social pieces (docs/specs/009-elements/social-pieces.md).
  | 'notice-board'
  | 'world-clock'
  | 'jukebox'
  | 'ping-pong-table'
  | 'arcade-machine'
  | 'fireplace'
  | 'campfire'
  | 'bench'
  | 'picnic-table'
  | 'hammock'
  | 'garden-umbrella'
  | 'fountain'
  | 'pond'
  // The social pieces' second set (docs/specs/009-elements/social-pieces.md).
  | 'pool-table'
  | 'foosball-table'
  | 'dartboard'
  | 'vending-machine'
  | 'bean-bag'
  | 'reading-nook'
  // The office amenities (docs/specs/009-elements/office-amenities.md).
  | 'printer'
  | 'copier'
  | 'lockers'
  | 'coat-rack'
  | 'umbrella-stand'
  | 'kitchen-counter'
  | 'kitchen-sink'
  | 'fridge'
  | 'microwave'
  | 'kettle'
  | 'toilet-cubicle'
  | 'washbasin'
  | 'hand-dryer'
  // The venue pieces (docs/specs/009-elements/venue-pieces.md).
  | 'pillar'
  | 'column'
  | 'car-park'
  | 'bike-rack'
  | 'swimming-pool'
  | 'stage-curtains'
  | 'podium'
  // The workday pieces (docs/specs/009-elements/workday-pieces.md).
  | 'nap-pod'
  | 'treadmill'
  | 'weight-bench'
  | 'phone-booth'
  | 'standing-desk'
  | 'hot-desk'
  | 'pet-bed'
  | 'reception-desk'
  // The team pieces (docs/specs/009-elements/team-pieces.md).
  | 'calendar-wall'
  | 'suggestion-box'
  | 'signpost'
  | 'photo-wall';

export const OFFICE_KINDS: readonly OfficeKind[] = [
  'room',
  'corridor',
  'meeting-table',
  'plant',
  'bookshelf',
  'water-cooler',
  'coffee-machine',
  'rug',
  'stage',
  'office-pod',
  'bar',
  'bar-stool',
  'drinks-cabinet',
  'drinks-fridge',
  'outdoor-plant',
  'tree',
  'garden-path',
  'grass',
  'garden-fence',
  'door',
  'window',
  'directory',
  'elevator',
  'stairs',
  'notice-board',
  'world-clock',
  'jukebox',
  'ping-pong-table',
  'arcade-machine',
  'fireplace',
  'campfire',
  'bench',
  'picnic-table',
  'hammock',
  'garden-umbrella',
  'fountain',
  'pond',
  'pool-table',
  'foosball-table',
  'dartboard',
  'vending-machine',
  'bean-bag',
  'reading-nook',
  'printer',
  'copier',
  'lockers',
  'coat-rack',
  'umbrella-stand',
  'kitchen-counter',
  'kitchen-sink',
  'fridge',
  'microwave',
  'kettle',
  'toilet-cubicle',
  'washbasin',
  'hand-dryer',
  'pillar',
  'column',
  'car-park',
  'bike-rack',
  'swimming-pool',
  'stage-curtains',
  'podium',
  'nap-pod',
  'treadmill',
  'weight-bench',
  'phone-booth',
  'standing-desk',
  'hot-desk',
  'pet-bed',
  'reception-desk',
  'calendar-wall',
  'suggestion-box',
  'signpost',
  'photo-wall',
];

/** The pieces drawn to their own size, never scaled, so their walls and edges keep their thickness. */
export type SizedOfficeKind =
  | 'room'
  | 'corridor'
  | 'stage'
  | 'garden-path'
  | 'grass'
  | 'garden-fence'
  | 'door'
  | 'window'
  | 'pond'
  | 'swimming-pool';
const SIZED_OFFICE_KINDS: readonly string[] = [
  'room',
  // The Corridor (docs/specs/009-elements/corridor.md): its walls keep their thickness.
  'corridor',
  'stage',
  'garden-path',
  'grass',
  'garden-fence',
  'door',
  // The Window (room-builder.md "Window"): its light falls past its box, drawn to its size.
  'window',
  // The pond (docs/specs/009-elements/social-pieces.md "Pond"): resizable, drawn to its size like grass.
  'pond',
  // The Swimming Pool (docs/specs/009-elements/venue-pieces.md "Swimming Pool"): resizable, drawn to its size like the pond.
  'swimming-pool',
];
/** The pieces drawn from a fixed grid (OFFICE_ART). */
export type GridOfficeKind = Exclude<OfficeKind, SizedOfficeKind>;
export function isGridOfficeShape(kind: string): kind is GridOfficeKind {
  return isOfficeShape(kind) && !SIZED_OFFICE_KINDS.includes(kind);
}

export function isOfficeShape(kind: string): kind is OfficeKind {
  return (OFFICE_KINDS as readonly string[]).includes(kind);
}

// The pieces livediagram draws too (the Meeting Table, the Plant, the Bookshelf, the Water Cooler, the Coffee Machine,
// the Rug) and the fixed colours they keep whatever the theme are @liveworkspace/avatar/furniture-art's, shared.
// The machines' answers sit on those drawings, so they are shared with them.
export {
  MACHINE_ANSWER_AT,
  MEETING_TABLE_ART,
  MEETING_TABLE_VIEW,
  OFFICE_TONES,
  type MachineAnswerSpot,
} from '@liveworkspace/avatar/furniture-art';

/** Whether a piece is a Long Table (office.md "Long Table"): a Meeting Table of the `long` type. */
export function isLongTable(el: { shape: string; variant?: unknown }): boolean {
  return el.shape === 'meeting-table' && el.variant === LONG_TABLE_VARIANT;
}

// A Long Table's drawings, built for its box at its facing, are shared with the Meeting Table's
// (@liveworkspace/avatar/furniture-art).
export { longTableArt } from '@liveworkspace/avatar/furniture-art';

// Every office piece but the room and the stage, which are drawn to their size (roomParts, stageParts).
export const OFFICE_ART: Record<GridOfficeKind, FurnitureArt> = {
  ...SHARED_OFFICE_ART,
  ...OFFICE_EXTRA_ART,
  ...OFFICE_SOCIAL_ART,
  ...OFFICE_RECREATION_ART,
  ...OFFICE_WORKPLACE_ART,
  ...OFFICE_KITCHEN_ART,
  ...OFFICE_RESTROOM_ART,
  ...OFFICE_VENUE_ART,
  ...OFFICE_WORKDAY_ART,
  ...WAYFINDING_ART,
  ...OFFICE_TEAM_ART,
};

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

// --- The stage (docs/specs/009-elements/office.md "Stage") ------------------

/** Who may speak from a stage (docs/specs/012-collaboration/meeting-rooms-and-stage.md "Share roles"). */
export type StageSpeakers = 'edit' | 'take-part';
export const STAGE_SPEAKERS: readonly StageSpeakers[] = ['edit', 'take-part'];
export const DEFAULT_STAGE_SPEAKERS: StageSpeakers = 'edit';
/** Who Can Speak's tiles in the element menu (docs/specs/012-collaboration/meeting-rooms-and-stage.md part 4). */
export const STAGE_SPEAKER_LABELS: Record<StageSpeakers, string> = {
  edit: 'Editors',
  'take-part': 'Editors and Participants',
};
export function isStageSpeakers(v: unknown): v is StageSpeakers {
  return v === 'edit' || v === 'take-part';
}
/** The front edge's height: the face you see below the stage's top. */
export const STAGE_FRONT = 24;
// The stage's top when it has no fill of its own: honey boards on light paper, a deep brown on dark
// (docs/specs/009-elements/venue-pieces.md "The stronger Stage").
export const STAGE_FLOOR = '#ecc98f';
export const STAGE_FLOOR_DARK = '#4a3628';
// The fixed woods: the nosing along the top's front lip and the front edge's stained skirt; and the footlights.
export const STAGE_TONES = {
  nosing: '#9a6a35',
  skirt: '#7c4a2a',
  lamp: '#fcd34d',
  lampGlow: '#fffbeb',
} as const;
// The plate on the front edge: 40% of the stage's width, between these.
const STAGE_PLATE_MIN = 64;
const STAGE_PLATE_MAX = 160;
const STAGE_PLATE_INSET = 5;
// The boards: a plank line about every STAGE_PLANK px down the top, at most STAGE_PLANKS_MAX rows, their butt joints
// every STAGE_JOINT px along a row, each row's starting at its own offset.
const STAGE_PLANK = 24;
const STAGE_PLANKS_MAX = 8;
const STAGE_JOINT = 104;
// Each row's joints start this far along, so the boards are laid at random-looking lengths, never in a brick bond.
const STAGE_JOINT_OFFSETS = [0, 58, 22, 80, 40, 6, 66, 30] as const;
// The nosing's height, and the footlights: one about every STAGE_LAMP px along the front edge, clear of the plate.
const STAGE_NOSING = 5;
const STAGE_LAMP = 40;

/** Where feet stand on a stage: its top, above the front edge (the box may be empty on a stage too short). */
export function stageTop(el: Rect): Rect {
  return { x: el.x, y: el.y, width: el.width, height: el.height - STAGE_FRONT };
}

/** The plate's span along the front edge, [x, width], in the stage's own px. */
function stagePlate(width: number): [number, number] {
  const plate = Math.min(
    width - 16,
    Math.max(STAGE_PLATE_MIN, Math.min(STAGE_PLATE_MAX, width * 0.4)),
  );
  return [Math.round((width - plate) / 2), Math.round(plate)];
}

// The boards' one path: plank lines across the top, then each row's butt joints, staggered.
function stageBoards(width: number, top: number): string {
  if (width <= 16) return '';
  const rows = Math.min(STAGE_PLANKS_MAX, Math.max(1, Math.round(top / STAGE_PLANK)));
  const ys = Array.from({ length: rows + 1 }, (_, k) => Math.round((top * k) / rows));
  let d = ys
    .slice(1, -1)
    .filter((y) => y > 4 && y < top - STAGE_NOSING - 2)
    .map((y) => `M6 ${y}H${width - 6}`)
    .join('');
  for (let r = 0; r < rows; r += 1) {
    const y0 = ys[r]! + 3;
    const y1 = Math.min(ys[r + 1]!, top - STAGE_NOSING) - 3;
    if (y1 - y0 < 4) continue;
    for (
      let x = 30 + STAGE_JOINT_OFFSETS[r % STAGE_JOINT_OFFSETS.length]!;
      x < width - 24;
      x += STAGE_JOINT
    )
      d += `M${x} ${y0}V${y1}`;
  }
  return d;
}

// The footlights along the front edge, clear of the plate: the lamps' path and their glints' path.
function stageFootlights(width: number, top: number, plate: [number, number]): [string, string] {
  const count = Math.max(0, Math.floor((width - 16) / STAGE_LAMP));
  const step = count > 0 ? (width - 16) / count : 0;
  let lamps = '';
  let glows = '';
  for (let i = 0; i < count; i += 1) {
    const x = Math.round((8 + step * (i + 0.5)) * 10) / 10;
    if (x > plate[0] - 8 && x < plate[0] + plate[1] + 8) continue;
    lamps += `M${x - 3.5} ${top + 5}a3.5 2.4 0 1 0 7 0a3.5 2.4 0 1 0-7 0Z`;
    glows += `M${x - 1.4} ${top + 4.4}a1.4 1 0 1 0 2.8 0a1.4 1 0 1 0-2.8 0Z`;
  }
  return [lamps, glows];
}

/**
 * A stage's drawing, in its own px (0..width, 0..height): its top laid in boards (plank lines and staggered joints, one
 * path), a nosing along its front lip, the front edge's stained skirt with a row of footlights, and the name plate in
 * the top's fill (docs/specs/009-elements/venue-pieces.md "The stronger Stage"). A fixed handful of shapes however big.
 */
export function stageParts(width: number, height: number): FurniturePart[] {
  const F = STAGE_FRONT;
  const top = height - F;
  const parts: FurniturePart[] = [rect('panel', 0, 0, width, top + 1, 4)];
  const boards = stageBoards(width, top);
  if (boards) parts.push(path('rail', boards));
  if (top > STAGE_NOSING)
    parts.push(
      rect('panel', 0, top - STAGE_NOSING, width, STAGE_NOSING + 1, 2, STAGE_TONES.nosing),
    );
  parts.push(rect('face', 0, top, width, F, 3, STAGE_TONES.skirt));
  const plate = stagePlate(width);
  const [lamps, glows] = stageFootlights(width, top, plate);
  if (lamps)
    parts.push(path('mark', lamps, STAGE_TONES.lamp), path('mark', glows, STAGE_TONES.lampGlow));
  parts.push(
    rect('panel', plate[0], top + STAGE_PLATE_INSET, plate[1], F - STAGE_PLATE_INSET * 2, 3),
  );
  // A stage shrunk past its edge draws only what has a size, never a negative one.
  return parts.filter((p) => p.tag !== 'rect' || (p.w > 0 && p.h > 0));
}
