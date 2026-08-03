// Floor plan template: a two-bedroom flat drawn to a real metric scale,
// with the Furniture icons (spec/09's top-down room symbols) laid out
// inside each room.
//
// The whole plan is authored in METRES and converted once, at the
// bottom, by PX_PER_M. That is the only way the proportions hold up:
// hand-picked pixel sizes drift into a bathtub the size of a sofa, and
// "sensible proportions" is the entire point of a floor plan. Room
// dimensions and furniture footprints below are real-world numbers you
// can check against a tape measure, and the scale is captioned on the
// canvas so anything the user adds later can match it.
//
// Furniture boxes are SQUARE. A curated icon renders its 0..24 artwork
// with `preserveAspectRatio="xMidYMid meet"` (see IconGlyph), so a
// non-square box would letterbox the glyph and draw it SMALLER than the
// footprint it is meant to occupy, not stretch it to fill. So each piece
// is a square whose side is its longest real dimension (a 1.9 m sofa is
// a 1.9 m box), and the glyph's own inset supplies the shallower depth:
// the sofa artwork spans 20/24 of its box across and 12/24 down, which
// lands almost exactly on a real 1.6 x 1.0 m two-seater.
//
// Pure like every other builder: takes a centre (cx, cy), returns a
// fresh Element[]. See spec/09 "Templates" for the catalogue.

import { createShape, createText, type Element } from '@livediagram/diagram';
import { TEMPLATE_CONTENT_LAYER_ID, TEMPLATE_SCAFFOLD_LAYER_ID } from './template-layers';

// One metre of floor, in canvas pixels. 80 keeps a 0.8 m toilet at a
// still-clickable 64px while the whole 10.2 x 7.4 m flat (816 x 592px)
// stays inside a laptop viewport at 100% zoom, so the plan lands
// readable without anyone reaching for the zoom control.
const PX_PER_M = 80;

// The flat's outer dimensions. Every room below tiles this rectangle
// edge to edge (shared walls, no gaps), so the plan reads as one
// dwelling rather than a scatter of boxes.
const FLAT_W = 10.2;
const FLAT_H = 7.4;

// A piece of furniture, positioned by its CENTRE in room-local metres
// (from the room's top-left corner) with a square footprint.
type Piece = {
  icon: string;
  cx: number;
  cy: number;
  // Footprint: the piece's longest real dimension, in metres.
  size: number;
  // Degrees clockwise. Used to turn a piece so its back is against the
  // wall it stands on: the artwork is drawn facing "down the page", so
  // 180 puts a sofa's back to the SOUTH wall, 90 to the WEST wall.
  rotation?: number;
};

type Room = {
  name: string;
  // Top-left corner + size in metres, from the flat's top-left corner.
  x: number;
  y: number;
  w: number;
  h: number;
  // How far in from the room's left wall the caption starts, in metres.
  // Defaults to CAPTION_INSET; the hall pushes it clear of the front
  // door, which lands in the corner a caption would otherwise take.
  captionX?: number;
  furniture: Piece[];
};

// The plan: three rooms across the top, a spine hallway, three across
// the bottom. A central corridor is the standard apartment arrangement
// and it gives every room one obvious wall to hang its door on.
const ROOMS: Room[] = [
  {
    name: 'Living room',
    x: 0,
    y: 0,
    w: 4.4,
    h: 3.4,
    furniture: [
      // Sofa backed onto the north wall with the coffee table in front
      // of it, facing a TV on the opposite wall: the arrangement almost
      // every living room actually has.
      { icon: 'sofa', cx: 1.3, cy: 1.15, size: 2.0 },
      { icon: 'coffee-table', cx: 1.3, cy: 2.75, size: 1.2 },
      { icon: 'tv', cx: 3.6, cy: 2.8, size: 1.1, rotation: 180 },
      { icon: 'armchair', cx: 3.5, cy: 1.4, size: 1.0, rotation: 180 },
      { icon: 'plant', cx: 4.0, cy: 0.4, size: 0.7 },
    ],
  },
  {
    name: 'Bedroom',
    x: 4.4,
    y: 0,
    w: 3.2,
    h: 3.4,
    furniture: [
      // A 1.9 m box draws a double bed (the artwork's 18/24 inset lands
      // on ~1.4 x 1.4 m of mattress) with its headboard to the wall.
      { icon: 'bed', cx: 1.05, cy: 1.05, size: 1.85 },
      { icon: 'wardrobe', cx: 2.5, cy: 2.7, size: 1.3 },
    ],
  },
  {
    name: 'Guest room',
    x: 7.6,
    y: 0,
    w: 2.6,
    h: 3.4,
    furniture: [
      { icon: 'bed', cx: 0.9, cy: 1.0, size: 1.6 },
      { icon: 'wardrobe', cx: 1.9, cy: 2.7, size: 1.2 },
    ],
  },
  {
    name: 'Hall',
    x: 0,
    y: 3.4,
    w: 10.2,
    h: 1.2,
    captionX: 1.15,
    // A 1.2 m corridor only has room for something against the wall, and
    // the far end is the one spot in it nothing else wants.
    furniture: [{ icon: 'plant', cx: 9.6, cy: 0.6, size: 0.7 }],
  },
  {
    name: 'Kitchen',
    x: 0,
    y: 4.6,
    w: 4.4,
    h: 2.8,
    furniture: [
      // Run of units along the south wall (stove, sink, fridge) with the
      // dining table and its two chairs in the floor space above. The
      // units deliberately avoid the north wall: that is where the door
      // from the hall opens, and it is where the room caption sits.
      { icon: 'stove', cx: 0.55, cy: 2.25, size: 0.9 },
      { icon: 'sink', cx: 1.5, cy: 2.25, size: 0.9 },
      { icon: 'fridge', cx: 2.6, cy: 2.25, size: 1.0 },
      { icon: 'dining-table', cx: 2.6, cy: 0.9, size: 1.6 },
      { icon: 'chair', cx: 1.35, cy: 1.0, size: 0.6, rotation: 90 },
      { icon: 'chair', cx: 3.85, cy: 1.0, size: 0.6, rotation: 270 },
    ],
  },
  {
    name: 'Bathroom',
    x: 4.4,
    y: 4.6,
    w: 2.4,
    h: 2.8,
    furniture: [
      { icon: 'bathtub', cx: 1.05, cy: 0.95, size: 1.7 },
      { icon: 'toilet', cx: 0.6, cy: 2.3, size: 0.8 },
      { icon: 'sink', cx: 1.7, cy: 2.3, size: 0.8 },
    ],
  },
  {
    name: 'Study',
    x: 6.8,
    y: 4.6,
    w: 3.4,
    h: 2.8,
    furniture: [
      { icon: 'desk', cx: 1.1, cy: 0.95, size: 1.6 },
      { icon: 'chair', cx: 1.1, cy: 2.1, size: 0.7, rotation: 180 },
      { icon: 'plant', cx: 3.0, cy: 0.5, size: 0.7 },
    ],
  },
];

// Doorways. Each is given the point ON the wall it pierces plus the
// direction it opens, and the builder derives the rest, because a door
// symbol cannot simply be centred on its wall: the `door` glyph draws
// its closed leaf across the BOTTOM of the artwork (y = 20 of 24) with
// the swing arc above it, so a box centred on the wall parks the whole
// symbol a third of its size into the wrong room. Every door here
// opens into the room it serves, never back across the corridor.
const DOOR_SIZE = 0.9;
// The glyph's wall line sits 20/24 down its box, so the box centre has
// to stand off the wall by exactly (20/24 - 1/2) = 1/3 of its size, in
// the direction the door opens.
const DOOR_STANDOFF = DOOR_SIZE / 3;
// Rotation (clockwise, the artwork opens north unrotated) per opening
// direction, plus the axis offset that lands the leaf on the wall.
const DOOR_SWING = {
  north: { rotation: 0, dx: 0, dy: -DOOR_STANDOFF },
  south: { rotation: 180, dx: 0, dy: DOOR_STANDOFF },
  east: { rotation: 90, dx: DOOR_STANDOFF, dy: 0 },
  west: { rotation: 270, dx: -DOOR_STANDOFF, dy: 0 },
} as const;

const DOORS: { cx: number; cy: number; opens: keyof typeof DOOR_SWING }[] = [
  // Hall's north wall: living room, bedroom, guest room.
  { cx: 2.6, cy: 3.4, opens: 'north' },
  { cx: 6.0, cy: 3.4, opens: 'north' },
  { cx: 9.0, cy: 3.4, opens: 'north' },
  // Hall's south wall: kitchen, bathroom, study.
  { cx: 3.85, cy: 4.6, opens: 'south' },
  // Hard against the bathroom's east side: anywhere further left and
  // the swing crosses either the bath or the room caption.
  { cx: 6.35, cy: 4.6, opens: 'south' },
  { cx: 8.4, cy: 4.6, opens: 'south' },
  // Front door, in the west outer wall at the end of the hall.
  { cx: 0, cy: 4.0, opens: 'east' },
];

// Total floor area, summed from the room table rather than typed out,
// so the title can't drift when a room is resized.
const totalArea = (): number => ROOMS.reduce((sum, r) => sum + r.w * r.h, 0);

// Room caption: name + area, on one line in the room's top-left corner
// (the middle belongs to the furniture). Areas are computed, never
// written down, for the same reason as the total.
const CAPTION_INSET = 0.15;
const CAPTION_H = 0.32;

export function buildFloorPlan(cx: number, cy: number): Element[] {
  const px = (metres: number) => metres * PX_PER_M;
  // The flat is centred on the canvas point, so the plan lands where
  // the user clicked rather than hanging off one corner of it.
  const left = cx - px(FLAT_W) / 2;
  const top = cy - px(FLAT_H) / 2;
  const X = (metres: number) => left + px(metres);
  const Y = (metres: number) => top + px(metres);

  const elements: Element[] = [];

  // Title above the plan, scale caption below it. The scale line is the
  // template's contract with the user: keep adding at 80px per metre and
  // everything stays in proportion.
  elements.push({
    ...createText(X(0), Y(0) - 76),
    width: px(FLAT_W),
    height: 40,
    label: `Floor plan · two-bedroom flat · ${Math.round(totalArea())} m²`,
    textSize: 'lg',
    textBold: true,
    layerId: TEMPLATE_SCAFFOLD_LAYER_ID,
  });

  // Outer wall: a frame, so its body stays transparent and the rooms
  // inside show through. Extra-thick reads as the load-bearing shell
  // against the medium-weight partition walls.
  elements.push({
    ...createShape('frame', X(0), Y(0)),
    width: px(FLAT_W),
    height: px(FLAT_H),
    // A frame ships labelled "Frame" in its top-right corner; a floor
    // plan's outer wall is a wall, not a captioned section.
    label: '',
    strokeWidth: 'extra-thick',
    borderRadius: 'none',
    layerId: TEMPLATE_SCAFFOLD_LAYER_ID,
  });

  for (const room of ROOMS) {
    // Rooms tile edge to edge, so adjacent borders draw the shared
    // partition wall between them. Square corners: rounded rooms would
    // leave gaps at every junction.
    elements.push({
      ...createShape('square', X(room.x), Y(room.y)),
      width: px(room.w),
      height: px(room.h),
      borderRadius: 'none',
      layerId: TEMPLATE_SCAFFOLD_LAYER_ID,
    });

    elements.push({
      ...createText(X(room.x + (room.captionX ?? CAPTION_INSET)), Y(room.y + CAPTION_INSET)),
      width: px(room.w - (room.captionX ?? CAPTION_INSET) - CAPTION_INSET),
      height: px(CAPTION_H),
      label: `${room.name} · ${(room.w * room.h).toFixed(1)} m²`,
      textSize: 'sm',
      textAlignX: 'left',
      layerId: TEMPLATE_SCAFFOLD_LAYER_ID,
    });

    for (const piece of room.furniture) {
      elements.push({
        ...createShape(
          'icon',
          X(room.x + piece.cx - piece.size / 2),
          Y(room.y + piece.cy - piece.size / 2),
        ),
        width: px(piece.size),
        height: px(piece.size),
        iconId: piece.icon,
        // No caption: a plan symbol says what it is by its outline, and
        // a label under every piece would bury the room names. The
        // caption band an icon reserves for a label would also shrink
        // the glyph out of proportion with its footprint.
        label: '',
        ...(piece.rotation ? { rotation: piece.rotation } : {}),
        layerId: TEMPLATE_CONTENT_LAYER_ID,
      });
    }
  }

  for (const door of DOORS) {
    const swing = DOOR_SWING[door.opens];
    elements.push({
      ...createShape(
        'icon',
        X(door.cx + swing.dx - DOOR_SIZE / 2),
        Y(door.cy + swing.dy - DOOR_SIZE / 2),
      ),
      width: px(DOOR_SIZE),
      height: px(DOOR_SIZE),
      iconId: 'door',
      label: '',
      ...(swing.rotation ? { rotation: swing.rotation } : {}),
      // Doors are part of the shell, not the furnishings: they belong
      // with the walls on the scaffold layer so locking it pins the
      // openings too.
      layerId: TEMPLATE_SCAFFOLD_LAYER_ID,
    });
  }

  elements.push({
    ...createText(X(0), Y(FLAT_H) + 16),
    width: px(FLAT_W),
    height: 32,
    label: `Scale: 1 m = ${PX_PER_M} px · rooms and furniture are drawn to it`,
    textSize: 'sm',
    textAlignX: 'left',
    layerId: TEMPLATE_SCAFFOLD_LAYER_ID,
  });

  return elements;
}
