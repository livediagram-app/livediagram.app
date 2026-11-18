// Room presets (docs/specs/009-elements/office-amenities.md "The Restroom preset", office.md "Room presets"): a palette
// tile that places a Room already furnished. The Restroom brings two Toilet Cubicles, a Hand Dryer, two Washbasins and
// a Room Sign outside by the door; the Room tile's other presets are empty shapes and sizes (room-preset-shapes.ts).
// Placed in one change with the Room and its Door (`withDoorPiece`, room-builder.ts). Pure: no React, no DOM.

import { ROOM_BACK_FACE, ROOM_DOOR_WIDTH } from '@livehuddle/avatar/office-geometry';
import type { ChairFacing, ShapeElement, ShapeKind } from './index';
import { createShape } from './shape-factory';
import { RESTROOM_VARIANT, applyShapeVariant } from './shape-variants';
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

/** Where a preset's Screen starts, room-relative: just below the back wall's face (ROOM_BACK_FACE), which carries the
 *  room's name band, so the Screen never covers the name (Work Tracker 638). */
export const PRESET_SCREEN_TOP = ROOM_BACK_FACE + 2;

/**
 * Each furnished preset's pieces, in drawing order (a rug first, so its sofas stand on it), laid out clear of its Door's
 * swing and inside its walls (DEFAULTS.md D226). A seat faces its kind's default (a desk `s`, its sitter at the
 * monitor; a sofa `n`) unless it says; one on its side (`e`, `w`) takes its turned box, whose top-left is the `x`, `y` given.
 */
export const ROOM_PRESET_LAYOUTS: Readonly<Record<string, readonly PresetPiece[]>> = {
  [RESTROOM_VARIANT]: RESTROOM_LAYOUT,
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
 * The pieces a room preset places with its room, in canvas px from the room's top left, each in the room's stroke when
 * it has one (as its Door is), the Restroom's Room Sign last. A preset always lands at its own size (office.md "Room
 * presets": a Room is dropped, then sized), so each piece stands where its layout puts it. None for a room with no
 * furnished preset, or anything that is not a room.
 */
export function roomPresetCompanions(room: ShapeElement, variant?: string): ShapeElement[] {
  if (room.shape !== 'room' || !variant || !Object.hasOwn(ROOM_PRESET_LAYOUTS, variant)) return [];
  const ink = room.strokeColor ? { strokeColor: room.strokeColor } : {};
  const pieces = ROOM_PRESET_LAYOUTS[variant]!.map((p) => {
    const made = presetPiece(p);
    return { ...made, x: room.x + p.x, y: room.y + p.y, ...ink };
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
