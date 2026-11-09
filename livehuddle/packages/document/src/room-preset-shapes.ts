// The Room tile's presets (docs/specs/009-elements/office.md "Room presets"): six rooms to start from, each an ordinary
// Room placed at a size and a name, the shaped ones with their walls (a custom room's `roomOutline`) and the point their
// Door stands at; the pieces each is furnished with are room-presets.ts's. Nothing about a preset is stored but the
// Meeting Booth's glass walls, which are the room's own wall style. A LEAF module: types and the avatar's outline
// geometry only.

import { pointInPolygon, type OutlinePoint } from '@livehuddle/avatar/room-outline';
import type { ShapeElement } from './index';

type RoomPreset = {
  label: string;
  width: number;
  height: number;
  // A shaped preset's walls' centre line, in the preset's own px (its box, half a wall in), and the point on a wall
  // its Door stands at. A rectangle has neither: its Door is the new Room's own, in the front wall.
  outline?: readonly OutlinePoint[];
  door?: OutlinePoint;
  // A wall style the room keeps (office.md "Glass walls"): the one thing a preset stores.
  variant?: 'glass';
};

// The Lounge's octagon: a 430 px square of centre line with its corners cut so every wall is the same length.
const OCT = 430 / (2 + Math.SQRT2);
const oct = (v: number) => Math.round(v * 100) / 100;

/** The Room presets after the plain Room (no variant), in palette order (DEFAULTS.md D224). */
export const ROOM_PRESETS: Readonly<Record<string, RoomPreset>> = {
  office: { label: 'Office', width: 360, height: 240 },
  boardroom: { label: 'Boardroom', width: 800, height: 400 },
  // An L: a wide floor along the top and a wing down the left, its Door in the wing's front wall.
  'open-plan': {
    label: 'Open Plan',
    width: 720,
    height: 520,
    outline: [
      { x: 5, y: 5 },
      { x: 715, y: 5 },
      { x: 715, y: 300 },
      { x: 285, y: 300 },
      { x: 285, y: 515 },
      { x: 5, y: 515 },
    ],
    door: { x: 145, y: 515 },
  },
  // A rectangle with its front right corner cut at 45 degrees, its Door in the cut.
  kitchen: {
    label: 'Kitchen',
    width: 440,
    height: 340,
    outline: [
      { x: 5, y: 5 },
      { x: 435, y: 5 },
      { x: 435, y: 215 },
      { x: 315, y: 335 },
      { x: 5, y: 335 },
    ],
    door: { x: 375, y: 275 },
  },
  lounge: {
    label: 'Lounge',
    width: 440,
    height: 440,
    outline: [
      { x: oct(5 + OCT), y: 5 },
      { x: oct(435 - OCT), y: 5 },
      { x: 435, y: oct(5 + OCT) },
      { x: 435, y: oct(435 - OCT) },
      { x: oct(435 - OCT), y: 435 },
      { x: oct(5 + OCT), y: 435 },
      { x: 5, y: oct(435 - OCT) },
      { x: 5, y: oct(5 + OCT) },
    ],
    door: { x: 220, y: 435 },
  },
  // A meeting room in glass (office.md "Glass walls", DEFAULTS.md D230): seen into from outside, a call of its own.
  'meeting-booth': { label: 'Meeting Booth', width: 360, height: 300, variant: 'glass' },
};

/** The room preset `variant` names, or null when it is none (the Restroom is a preset of its own, office-amenities). */
export function roomPreset(variant: string | undefined): RoomPreset | null {
  return variant && Object.hasOwn(ROOM_PRESETS, variant) ? ROOM_PRESETS[variant]! : null;
}

// How far in from the box's top-left a room's name sits, and how far down from its top (px).
const NAME_IN = { x: 64, y: 18 } as const;

/**
 * Where a custom room's name sits so it reads inside its walls (office.md "Room presets"): at the top left, as on any
 * room, when the outline's floor is there; else centred along the top when the floor is there (an octagon's top wall);
 * else in the middle. `outline` is the room's `roomOutline`, a fraction of its box.
 */
export function outlineNameAlign(
  outline: readonly OutlinePoint[],
  width: number,
  height: number,
): Pick<ShapeElement, 'textAlignX' | 'textAlignY'> {
  const inside = (x: number, y: number) =>
    pointInPolygon({ x: x / width, y: y / height }, outline) &&
    pointInPolygon({ x: (x + NAME_IN.x) / width, y: y / height }, outline);
  if (inside(NAME_IN.y, NAME_IN.y)) return { textAlignX: 'left', textAlignY: 'top' };
  if (inside(width / 2 - NAME_IN.x / 2, NAME_IN.y))
    return { textAlignX: 'center', textAlignY: 'top' };
  return { textAlignX: 'center', textAlignY: 'middle' };
}

/** `room` placed as a preset: its size and name, and a shaped one's outline (a custom room: aspect locked, no
 *  built-in doorway, its name where the floor is). */
export function roomAsPreset(room: ShapeElement, preset: RoomPreset): ShapeElement {
  const sized: ShapeElement = {
    ...room,
    width: preset.width,
    height: preset.height,
    label: preset.label,
    ...(preset.variant ? { variant: preset.variant } : {}),
  };
  if (!preset.outline) return sized;
  const roomOutline = preset.outline.map((p) => ({
    x: p.x / preset.width,
    y: p.y / preset.height,
  }));
  return {
    ...sized,
    roomOutline,
    roomDoor: 'none',
    aspectLocked: true,
    ...outlineNameAlign(roomOutline, preset.width, preset.height),
  };
}

/** Where a shaped preset's Door stands, in canvas px, for `room` placed from it; null for a rectangle (its Door is
 *  the new Room's own) or no preset. Scaled with the room, so a resized preset keeps its Door's place. */
export function roomPresetDoorAt(
  room: ShapeElement,
  variant: string | undefined,
): OutlinePoint | null {
  const preset = roomPreset(variant);
  if (!preset?.door || room.shape !== 'room') return null;
  return {
    x: room.x + (preset.door.x / preset.width) * room.width,
    y: room.y + (preset.door.y / preset.height) * room.height,
  };
}
