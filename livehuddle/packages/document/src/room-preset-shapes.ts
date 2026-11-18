// The Room tile's presets (docs/specs/009-elements/office.md "Room presets"): rooms of different shapes and sizes to
// start from, each an ordinary empty Room placed at a size and a name, the shaped ones with their walls (a custom
// room's `roomOutline`) and the point their Door stands at. Nothing about a preset is stored but the Glass Room's
// walls, which are the room's own wall style. A LEAF module: types and the avatar's outline
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

// Each shape's walls' centre line is drawn half a wall (5 px) in from its box, so the walls sit inside it.
const IN = 5;
const r2 = (v: number) => Math.round(v * 100) / 100;

/** An octagon in a `size` square box: every wall the same length. */
function octagon(size: number): OutlinePoint[] {
  const side = size - 2 * IN;
  const cut = r2(side / (2 + Math.SQRT2));
  const lo = IN;
  const hi = size - IN;
  return [
    { x: r2(lo + cut), y: lo },
    { x: r2(hi - cut), y: lo },
    { x: hi, y: r2(lo + cut) },
    { x: hi, y: r2(hi - cut) },
    { x: r2(hi - cut), y: hi },
    { x: r2(lo + cut), y: hi },
    { x: lo, y: r2(hi - cut) },
    { x: lo, y: r2(lo + cut) },
  ];
}

/** A hexagon with flat top and bottom walls in a `width` by `height` box: its points at the left and right. */
function hexagon(width: number, height: number): OutlinePoint[] {
  const q = r2((width - 2 * IN) / 4);
  return [
    { x: IN + q, y: IN },
    { x: width - IN - q, y: IN },
    { x: width - IN, y: height / 2 },
    { x: width - IN - q, y: height - IN },
    { x: IN + q, y: height - IN },
    { x: IN, y: height / 2 },
  ];
}

/**
 * The Room presets after the plain Room (no variant), in palette order (DEFAULTS.md D224): rooms of different shapes
 * and sizes, empty, to furnish (the owner, 2026-11-18: "I also didn't want the room types in the palette to be fully
 * furnished, but different shapes and sizes of rooms, like maybe I wanted a hexagon shaped room").
 */
export const ROOM_PRESETS: Readonly<Record<string, RoomPreset>> = {
  // The plain Room (no preset) is the small one, 480 by 320.
  medium: { label: 'Room', width: 640, height: 440 },
  large: { label: 'Large Room', width: 960, height: 640 },
  long: { label: 'Long Room', width: 1080, height: 400 },
  // An L: a wide floor along the top and a wing down the left, its Door in the wing's front wall.
  'l-shape': {
    label: 'L-Shaped Room',
    width: 880,
    height: 640,
    outline: [
      { x: IN, y: IN },
      { x: 880 - IN, y: IN },
      { x: 880 - IN, y: 360 },
      { x: 400, y: 360 },
      { x: 400, y: 640 - IN },
      { x: IN, y: 640 - IN },
    ],
    door: { x: 200, y: 640 - IN },
  },
  hexagon: {
    label: 'Hexagon Room',
    width: 680,
    height: 560,
    outline: hexagon(680, 560),
    door: { x: 340, y: 560 - IN },
  },
  octagon: {
    label: 'Octagon Room',
    width: 600,
    height: 600,
    outline: octagon(600),
    door: { x: 300, y: 600 - IN },
  },
  // A rectangle with its front right corner cut at 45 degrees, its Door in the cut.
  'cut-corner': {
    label: 'Cut Corner Room',
    width: 720,
    height: 520,
    outline: [
      { x: IN, y: IN },
      { x: 720 - IN, y: IN },
      { x: 720 - IN, y: 340 },
      { x: 540, y: 520 - IN },
      { x: IN, y: 520 - IN },
    ],
    door: { x: 627.5, y: 427.5 },
  },
  // A room in glass (office.md "Glass walls", DEFAULTS.md D230): seen into from outside, a call of its own.
  glass: { label: 'Glass Room', width: 640, height: 440, variant: 'glass' },
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
