// Room presets (docs/specs/009-elements/office-amenities.md "The Restroom preset", office.md "Room presets"): a palette
// tile that places a Room already furnished. The Restroom brings two Toilet Cubicles, a Hand Dryer, two Washbasins and
// a Room Sign outside by the door; the Room tile's presets bring what each room is for (a desk in the Office, a long
// table in the Boardroom, desk pods in the Open Plan, a kitchen along the Kitchen's back wall, sofas round a fire in the
// Lounge). Placed in one change with the Room and its Door (`withDoorPiece`, room-builder.ts). Pure: no React, no DOM.

import { ROOM_DOOR_WIDTH } from '@liveworkspace/avatar/office-geometry';
import type { ChairFacing, ShapeElement, ShapeKind } from './index';
import { createShape } from './shape-factory';
import { RESTROOM_VARIANT, applyShapeVariant } from './shape-variants';
import { roomPreset } from './room-preset-shapes';
import { turnPiece, turnsWithFacing } from './furniture-facing';

/** A piece a preset furnishes its room with: its kind, its top-left room-relative (px, for the room at the preset's
 *  own size), and, for seating, which way it faces; for a rug, its type. */
type PresetPiece = {
  kind: ShapeKind;
  x: number;
  y: number;
  facing?: ChairFacing;
  variant?: string;
  // A width other than the kind's own (an aspect-locked piece keeps its proportions).
  width?: number;
};

/** Where the Restroom's pieces stand, room-relative, for a room at its default 480 × 320: on the floor in front of the
 *  back wall (whose face, and the room's name plate on it, stay in view), clear of the doorway in the front wall. */
export const RESTROOM_LAYOUT: readonly PresetPiece[] = [
  { kind: 'toilet-cubicle', x: 16, y: 40 },
  { kind: 'toilet-cubicle', x: 112, y: 40 },
  { kind: 'hand-dryer', x: 230, y: 64 },
  { kind: 'washbasin', x: 290, y: 44 },
  { kind: 'washbasin', x: 370, y: 44 },
];

/**
 * Each furnished preset's pieces, in drawing order (a rug first, so its sofas stand on it), laid out clear of its Door's
 * swing and inside its walls (DEFAULTS.md D226). A seat faces its kind's default (a desk `s`, its sitter at the
 * monitor; a sofa `n`) unless it says; one on its side (`e`, `w`) takes its turned box, whose top-left is the `x`, `y` given.
 */
export const ROOM_PRESET_LAYOUTS: Readonly<Record<string, readonly PresetPiece[]>> = {
  [RESTROOM_VARIANT]: RESTROOM_LAYOUT,
  // A desk against the back wall, a plant and a bookshelf beside it.
  office: [
    { kind: 'desk', x: 16, y: 40 },
    { kind: 'plant', x: 152, y: 52 },
    { kind: 'bookshelf', x: 224, y: 36 },
  ],
  // A Long Table for sixteen down the middle under a Screen on the back wall, plants in the back corners, drinks in the
  // front corners clear of the door.
  boardroom: [
    { kind: 'plant', x: 20, y: 40 },
    { kind: 'plant', x: 724, y: 40 },
    { kind: 'screen', x: 336, y: 32, width: 128 },
    { kind: 'meeting-table', x: 120, y: 120, variant: 'long' },
    { kind: 'water-cooler', x: 24, y: 276 },
    { kind: 'coffee-machine', x: 704, y: 290 },
  ],
  // Five pods of two desks face to face across the wide floor, the shared kit and plants in the wing.
  'open-plan': [
    ...[24, 148, 300, 424, 548].flatMap((x): PresetPiece[] => [
      { kind: 'desk', x, y: 36, facing: 'n' },
      { kind: 'desk', x, y: 148 },
    ]),
    { kind: 'printer', x: 24, y: 310 },
    { kind: 'coffee-machine', x: 112, y: 300 },
    { kind: 'plant', x: 208, y: 306 },
    { kind: 'water-cooler', x: 24, y: 400 },
    { kind: 'plant', x: 208, y: 408 },
  ],
  // A fridge, a sink, a counter with a microwave and a coffee machine along the back wall, bar stools at the counter.
  kitchen: [
    { kind: 'fridge', x: 16, y: 28 },
    { kind: 'kitchen-sink', x: 96, y: 76 },
    { kind: 'kitchen-counter', x: 212, y: 76 },
    { kind: 'microwave', x: 238, y: 66 },
    { kind: 'coffee-machine', x: 336, y: 68 },
    { kind: 'bar-stool', x: 122, y: 196 },
    { kind: 'bar-stool', x: 182, y: 196 },
    { kind: 'bar-stool', x: 242, y: 196 },
    { kind: 'water-cooler', x: 20, y: 196 },
  ],
  // A fire on the back wall, a bordered rug before it, two sofas facing in across it, plants either side of the door.
  lounge: [
    { kind: 'rug', x: 100, y: 170, variant: 'bordered' },
    { kind: 'fireplace', x: 156, y: 44 },
    { kind: 'sofa', x: 36, y: 174, facing: 'w' },
    { kind: 'sofa', x: 319, y: 174, facing: 'e' },
    { kind: 'plant', x: 110, y: 324 },
    { kind: 'plant', x: 274, y: 324 },
  ],
  // A glass booth (office.md "Glass walls"): a Screen on the back wall, a Meeting Table for six, a plant in a corner.
  'meeting-booth': [
    { kind: 'screen', x: 164, y: 26, width: 112 },
    { kind: 'meeting-table', x: 44, y: 100 },
    { kind: 'plant', x: 290, y: 40 },
  ],
};

/** The Restroom's door sign: a Room Sign this wide (aspect locked), beside the Door, this far below the front wall. */
export const RESTROOM_SIGN = { width: 88, gap: 10, beside: 16 } as const;

// A piece made at its place: a seat turned to its facing (a desk or sofa on its side taking its turned box), a rug
// given its type.
function presetPiece({ kind, x, y, facing, variant, width }: PresetPiece): ShapeElement {
  const base = applyShapeVariant(createShape(kind, x, y), variant);
  const made = width
    ? { ...base, width, height: Math.round((base.height * width) / base.width) }
    : base;
  if (!facing || !turnsWithFacing(made.shape)) return made;
  // Turned in place (furniture-facing.md "A turn"), then put back at its place: its corner, not its centre.
  const turned = turnPiece(made, facing);
  return { ...turned, x: made.x, y: made.y };
}

/**
 * The pieces a room preset places with its room, in canvas px, each in the room's stroke when it has one (as its Door
 * is), the Restroom's Room Sign last. A room placed larger or smaller than its preset spreads them with it (each keeps
 * its own size). None for a room with no furnished preset, or anything that is not a room.
 */
export function roomPresetCompanions(room: ShapeElement, variant?: string): ShapeElement[] {
  if (room.shape !== 'room' || !variant || !Object.hasOwn(ROOM_PRESET_LAYOUTS, variant)) return [];
  const ink = room.strokeColor ? { strokeColor: room.strokeColor } : {};
  const size = roomPreset(variant) ?? createShape('room', 0, 0);
  const sx = room.width / size.width;
  const sy = room.height / size.height;
  const pieces = ROOM_PRESET_LAYOUTS[variant]!.map((p) => {
    const made = presetPiece(p);
    return { ...made, x: room.x + p.x * sx, y: room.y + p.y * sy, ...ink };
  });
  if (variant !== RESTROOM_VARIANT) return pieces;
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
