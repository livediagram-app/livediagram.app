// The Room tile's presets (docs/specs/009-elements/office.md "Room presets"): six rooms to start from, each an ordinary
// Room placed at a size and a name, the shaped ones with their walls (a custom room's `roomOutline`) and the point their
// Door stands at. Nothing about a preset is stored. A LEAF module: types only.

import type { OutlinePoint } from '@liveworkspace/avatar/room-outline';
import type { ShapeElement } from './index';

type RoomPreset = {
  label: string;
  width: number;
  height: number;
  // A shaped preset's walls' centre line, in the preset's own px (its box, half a wall in), and the point on a wall
  // its Door stands at. A rectangle has neither: its Door is the new Room's own, in the front wall.
  outline?: readonly OutlinePoint[];
  door?: OutlinePoint;
};

// The Lounge's octagon: a 430 px square of centre line with its corners cut so every wall is the same length.
const OCT = 430 / (2 + Math.SQRT2);
const oct = (v: number) => Math.round(v * 100) / 100;

/** The Room presets after the plain Room (no variant), in palette order (DEFAULTS.md D220). */
export const ROOM_PRESETS: Readonly<Record<string, RoomPreset>> = {
  office: { label: 'Office', width: 280, height: 220 },
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
};

/** The room preset `variant` names, or null when it is none (the Restroom is a preset of its own, office-amenities). */
export function roomPreset(variant: string | undefined): RoomPreset | null {
  return variant && Object.hasOwn(ROOM_PRESETS, variant) ? ROOM_PRESETS[variant]! : null;
}

/** `room` placed as a preset: its size and name, and a shaped one's outline (a custom room: aspect locked, no
 *  built-in doorway). */
export function roomAsPreset(room: ShapeElement, preset: RoomPreset): ShapeElement {
  const sized: ShapeElement = {
    ...room,
    width: preset.width,
    height: preset.height,
    label: preset.label,
  };
  if (!preset.outline) return sized;
  return {
    ...sized,
    roomOutline: preset.outline.map((p) => ({ x: p.x / preset.width, y: p.y / preset.height })),
    roomDoor: 'none',
    aspectLocked: true,
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
