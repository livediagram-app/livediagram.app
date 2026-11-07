// The Office Pod, the bar and the garden (docs/specs/009-elements/office.md "Office Pod" to "Garden Fence"): their
// drawings, as tables of parts in the furniture's vocabulary (seating.ts), drawn upright from the room's camera like
// the rest of the office, which both renderers paint (the editor's views and svg-render-faces). The grid pieces join
// OFFICE_ART (office.ts); the garden path, grass and the garden fence are drawn to their own size, as a room is. The
// geometry the walk needs (the pod's seats, walls and door, the footprints) is @liveworkspace/avatar's. Pure: no React, no DOM.

import type { FurnitureDrawing, FurniturePart } from './seating';
import { allSides, ellipse, path, rect } from './furniture-parts';
import {
  BAR_STOOL_SEATS,
  POD_SEATS,
  POD_SEATS_BACK,
  POD_SEATS_SIDE,
  type SeatView,
} from '@liveworkspace/avatar/seats';
import { fenceRun } from '@liveworkspace/avatar/fence';
import { POD_DOOR_SPAN, POD_SIDE_DOOR_SPAN } from '@liveworkspace/avatar/pod';

// Fixed colours for what keeps its colour whatever the theme, as OFFICE_TONES: leaves, bark, stone, wood, glass,
// bottles and cans. Outlines stay the theme's stroke.
export const GARDEN_TONES = {
  leaf: '#4ade80',
  leafDeep: '#22c55e',
  leafDark: '#16a34a',
  bark: '#a16207',
  barkDeep: '#854d0e',
  stone: '#e7e5e4',
  stoneDeep: '#a8a29e',
  pink: '#f472b6',
  yellow: '#facc15',
  wood: '#c2894b',
  woodDeep: '#92400e',
  counter: '#57534e',
  glass: '#e2e8f0',
  glassDeep: '#cbd5e1',
  cushion: '#a5b4fc',
  cushionDeep: '#818cf8',
  picket: '#ffffff',
  bottles: ['#16a34a', '#b45309', '#dc2626', '#0ea5e9', '#a855f7', '#facc15'],
  cans: ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b'],
} as const;

/** A garden path's gravel when it has no fill of its own: a warm sand, and its deep twin on dark paper. */
export const GARDEN_PATH_FILL = '#e7dcc4';
export const GARDEN_PATH_FILL_DARK = '#57534e';

/** Grass's lawn when it has no fill of its own: a fresh green, and its deep twin on dark paper. */
export const GRASS_FILL = '#9bd27a';
export const GRASS_FILL_DARK = '#2f4a2c';

const T = GARDEN_TONES;

// --- The Office Pod -------------------------------------------------------------------------------------------

const [DOOR_FROM, DOOR_TO] = POD_DOOR_SPAN;
const [SIDE_DOOR_FROM, SIDE_DOOR_TO] = POD_SIDE_DOOR_SPAN;

/**
 * The pod's sliding door on a drawing's grid, shut: a glass panel across the doorway, and the way it slides open
 * (`open`, in grid units) to sit behind the wall. The views slide it open. In the front drawing it is the front
 * wall's top seen from above and slides right; from behind it stands in the far wall's face, seen face on, and slides
 * to your left (the front's right, turned round); on its side it runs down the left wall and slides toward you.
 */
export type PodDoorView = {
  x: number;
  y: number;
  w: number;
  h: number;
  open: { x: number; y: number };
};
export const POD_DOORS: Readonly<Record<SeatView, PodDoorView>> = {
  front: {
    x: DOOR_FROM,
    y: 134,
    w: DOOR_TO - DOOR_FROM,
    h: 9,
    open: { x: DOOR_TO - DOOR_FROM, y: 0 },
  },
  back: {
    x: DOOR_FROM,
    y: 7,
    w: DOOR_TO - DOOR_FROM,
    h: 30,
    open: { x: DOOR_FROM - DOOR_TO, y: 0 },
  },
  side: {
    x: 0,
    y: SIDE_DOOR_FROM,
    w: 9,
    h: SIDE_DOOR_TO - SIDE_DOOR_FROM,
    open: { x: 0, y: SIDE_DOOR_TO - SIDE_DOOR_FROM },
  },
};
/** The front drawing's door. */
export const POD_DOOR = POD_DOORS.front;

// A booth for two: a back wall with a window in its face, side walls, a front wall with a doorway, two padded
// benches facing each other across a little table. The door is not a part: it moves with who sits in it.
export const OFFICE_POD_VIEW: FurnitureDrawing = {
  width: POD_SEATS.width,
  height: POD_SEATS.height,
  parts: [
    ellipse('shadow', 88, 141, 86, 4),
    rect('floor', 6, 30, 164, 108, 2),
    // The back wall: its top, its face with a window.
    rect('panel', 0, 0, 176, 8, 2),
    rect('face', 0, 7, 176, 30, 1),
    rect('panel', 58, 12, 60, 18, 3, T.glass),
    path('glint', 'M64 26L72 16M72 26L80 16'),
    // The benches, each a backrest against its side wall and a cushion.
    rect('panel', 9, 54, 9, 56, 3, T.cushionDeep),
    rect('panel', 16, 60, 30, 48, 5, T.cushion),
    path('rail', 'M20 84H42'),
    rect('panel', 158, 54, 9, 56, 3, T.cushionDeep),
    rect('panel', 130, 60, 30, 48, 5, T.cushion),
    path('rail', 'M134 84H156'),
    // The table between them, a mug on it.
    path('line', 'M74 100v14M102 100v14'),
    rect('panel', 64, 66, 48, 30, 4),
    rect('face', 64, 94, 48, 8, 3),
    rect('panel', 82, 72, 8, 9, 2, T.glass),
    // The side walls, then the front wall either side of the doorway, its frame posts.
    rect('panel', 0, 0, 8, 144, 2),
    rect('panel', 168, 0, 8, 144, 2),
    rect('panel', 0, 136, DOOR_FROM, 8, 2),
    rect('panel', DOOR_TO, 136, 176 - DOOR_TO, 8, 2),
    rect('panel', DOOR_FROM - 4, 128, 6, 16, 2),
    rect('panel', DOOR_TO - 2, 128, 6, 16, 2),
  ],
  seats: POD_SEATS.seats.map(({ u, v }) => ({ u, v })),
  ring: { cx: 88, cy: 84, rx: 80, ry: 52 },
};

// Its back to you: the doorway now in the far wall, its face broken by it and the ground outside showing through;
// the benches have swapped sides; the window wall nearest you, seen from above, its glass along its top.
const OFFICE_POD_BACK: FurnitureDrawing = {
  ...POD_SEATS_BACK,
  parts: [
    ellipse('shadow', 88, 141, 86, 4),
    rect('floor', 6, 30, 164, 108, 2),
    rect('floor', DOOR_FROM, 4, DOOR_TO - DOOR_FROM, 30, 0),
    // The far wall either side of the doorway: its top, its face, and the doorway's posts.
    rect('panel', 0, 0, DOOR_FROM, 8, 2),
    rect('panel', DOOR_TO, 0, 176 - DOOR_TO, 8, 2),
    rect('face', 0, 7, DOOR_FROM, 30, 1),
    rect('face', DOOR_TO, 7, 176 - DOOR_TO, 30, 1),
    // The benches.
    rect('panel', 9, 54, 9, 56, 3, T.cushionDeep),
    rect('panel', 16, 60, 30, 48, 5, T.cushion),
    path('rail', 'M20 84H42'),
    rect('panel', 158, 54, 9, 56, 3, T.cushionDeep),
    rect('panel', 130, 60, 30, 48, 5, T.cushion),
    path('rail', 'M134 84H156'),
    // The table, its mug at the other end.
    path('line', 'M74 100v14M102 100v14'),
    rect('panel', 64, 66, 48, 30, 4),
    rect('face', 64, 94, 48, 8, 3),
    rect('panel', 86, 72, 8, 9, 2, T.glass),
    // The side walls, the near wall with its window, the doorway's posts.
    rect('panel', 0, 0, 8, 144, 2),
    rect('panel', 168, 0, 8, 144, 2),
    rect('panel', 0, 136, 176, 8, 2),
    rect('panel', 58, 138, 60, 4, 1.5, T.glass),
    rect('panel', DOOR_FROM - 4, 0, 6, 38, 2),
    rect('panel', DOOR_TO - 2, 0, 6, 38, 2),
  ],
  ring: { cx: 88, cy: 84, rx: 80, ry: 52 },
};

// Facing left: the doorway down its left wall, the window wall down its right, the far wall's face along its top;
// the benches run across it, one under the far wall facing you, one against the near wall with its back to you, the
// table between them.
const OFFICE_POD_SIDE: FurnitureDrawing = {
  ...POD_SEATS_SIDE,
  parts: [
    ellipse('shadow', 72, 173, 70, 4),
    rect('floor', 6, 30, 132, 140, 2),
    // The far wall: its top, its face.
    rect('panel', 0, 0, 144, 8, 2),
    rect('face', 0, 7, 144, 30, 1),
    // The far bench: its backrest standing against the wall, its cushion.
    rect('panel', 44, 26, 56, 22, 4, T.cushionDeep),
    rect('panel', 46, 42, 52, 28, 5, T.cushion),
    path('rail', 'M72 46V66'),
    // The table, a mug on it.
    path('line', 'M56 118v12M88 118v12'),
    rect('panel', 50, 84, 44, 30, 4),
    rect('face', 50, 112, 44, 8, 3),
    rect('panel', 58, 90, 8, 9, 2, T.glass),
    // The near bench: its cushion beyond, its backrest's back nearest you.
    rect('panel', 46, 132, 52, 22, 5, T.cushion),
    path('rail', 'M72 136V150'),
    rect('face', 44, 148, 56, 18, 4, T.cushionDeep),
    // The window wall, the near wall, the doorway's wall either side of it and its posts.
    rect('panel', 136, 0, 8, 176, 2),
    rect('panel', 138, 62, 4, 72, 1.5, T.glass),
    rect('panel', 0, 168, 144, 8, 2),
    rect('panel', 0, 0, 8, SIDE_DOOR_FROM, 2),
    rect('panel', 0, SIDE_DOOR_TO, 8, 176 - SIDE_DOOR_TO, 2),
    rect('panel', 0, SIDE_DOOR_FROM - 4, 16, 6, 2),
    rect('panel', 0, SIDE_DOOR_TO - 2, 16, 6, 2),
  ],
  ring: { cx: 72, cy: 102, rx: 66, ry: 66 },
};

// --- The bar --------------------------------------------------------------------------------------------------

function bottleRow(y: number, from: number, to: number, offset: number): FurniturePart[] {
  const out: FurniturePart[] = [];
  const heights = [16, 12, 18, 14, 10, 16, 13];
  let x = from;
  let i = 0;
  while (x + 7 <= to) {
    const h = heights[(i + offset) % heights.length]!;
    const fill = T.bottles[(i + offset) % T.bottles.length];
    out.push(rect('panel', x, y - h, 7, h, 2, fill));
    out.push(rect('panel', x + 2, y - h - 4, 3, 5, 1, fill));
    x += i % 3 === 2 ? 16 : 11;
    i += 1;
  }
  return out;
}

// A long counter with a dark top, bottles on a back shelf behind it, glasses on the counter, a foot rail.
const BAR_VIEW: FurnitureDrawing = {
  width: 240,
  height: 120,
  parts: [
    ellipse('shadow', 120, 116, 118, 4),
    rect('face', 8, 2, 224, 50, 3),
    ...bottleRow(24, 16, 224, 0),
    rect('panel', 12, 24, 216, 4, 1.5, T.wood),
    ...bottleRow(46, 20, 224, 3),
    rect('panel', 4, 56, 232, 46, 3, T.wood),
    path('rail', 'M60 62v34M120 62v34M180 62v34'),
    rect('panel', 0, 50, 240, 12, 4, T.counter),
    rect('panel', 46, 40, 8, 11, 2, T.glass),
    rect('panel', 150, 42, 7, 9, 2, T.glass),
    rect('panel', 184, 40, 8, 11, 2, T.glass),
    path('line', 'M12 108H228'),
  ],
  seats: [],
  ring: { cx: 120, cy: 96, rx: 116, ry: 14 },
};

// Bottle necks over a shelf's top, seen from behind it.
function bottleNecks(y: number, from: number, to: number, offset: number): FurniturePart[] {
  const out: FurniturePart[] = [];
  for (let x = from, i = 0; x + 3 <= to; x += i % 3 === 2 ? 16 : 11, i += 1)
    out.push(
      rect(
        'panel',
        x,
        y - 2 * ((i + offset) % 3),
        3,
        8,
        1,
        T.bottles[(i + offset) % T.bottles.length],
      ),
    );
  return out;
}

// Bottles standing in a column down a strip: the shelf's front cheated toward you on the turned bar.
function bottleColumn(x: number, from: number, to: number, offset: number): FurniturePart[] {
  const out: FurniturePart[] = [];
  for (let y = from, i = 0; y + 5 <= to; y += i % 3 === 2 ? 11 : 8, i += 1)
    out.push(rect('panel', x, y, 7, 6, 2, T.bottles[(i + offset) % T.bottles.length]));
  return out;
}

// From the bartender's side: the counter beyond, its dark top with the glasses and a shelf of glasses under it; the
// back shelf nearest you, its back to you, the bottles' necks over its top.
const BAR_BACK: FurnitureDrawing = {
  width: 240,
  height: 120,
  parts: [
    ellipse('shadow', 120, 116, 118, 4),
    rect('face', 6, 18, 228, 34, 3, T.wood),
    path('rail', 'M10 36H230'),
    rect('panel', 30, 38, 7, 8, 2, T.glass),
    rect('panel', 42, 38, 7, 8, 2, T.glass),
    rect('panel', 190, 38, 7, 8, 2, T.glass),
    rect('panel', 0, 10, 240, 12, 4, T.counter),
    rect('panel', 186, 2, 8, 11, 2, T.glass),
    rect('panel', 83, 4, 7, 9, 2, T.glass),
    rect('panel', 48, 2, 8, 11, 2, T.glass),
    ...bottleNecks(52, 18, 224, 0),
    rect('face', 8, 56, 224, 48, 3),
    path('rail', 'M64 62V98M120 62V98M176 62V98'),
    rect('panel', 4, 102, 232, 6, 2, T.wood),
  ],
  seats: [],
  ring: { cx: 120, cy: 96, rx: 116, ry: 14 },
};

// Facing left: long and narrow, the counter down its left with its wooden front cheated toward you and its foot rail
// along it, the glasses on its dark top; the back shelf down its right, its bottles toward the counter.
const BAR_SIDE: FurnitureDrawing = {
  width: 104,
  height: 232,
  parts: [
    ellipse('shadow', 52, 228, 50, 4),
    // The back shelf: its top, its near end, its bottles cheated toward the counter.
    rect('panel', 70, 12, 28, 160, 3),
    rect('face', 70, 170, 28, 52, 3),
    rect('face', 62, 14, 10, 206, 2),
    ...bottleColumn(63, 18, 214, 0),
    // The counter: its front, its dark top with the glasses, its near end.
    rect('panel', 8, 12, 12, 210, 3, T.wood),
    path('rail', 'M10 64h8M10 118h8M10 172h8'),
    rect('panel', 18, 12, 28, 162, 4, T.counter),
    rect('panel', 28, 32, 8, 11, 2, T.glass),
    rect('panel', 28, 102, 7, 9, 2, T.glass),
    rect('panel', 28, 124, 8, 11, 2, T.glass),
    rect('face', 18, 172, 28, 50, 3, T.wood),
    path('line', 'M4 24V220'),
  ],
  seats: [],
  ring: { cx: 52, cy: 200, rx: 48, ry: 14 },
};

// A round padded seat on a tall stem with a foot ring: its sitter faces the bar.
export const BAR_STOOL_VIEW: FurnitureDrawing = {
  width: BAR_STOOL_SEATS.width,
  height: BAR_STOOL_SEATS.height,
  parts: [
    ellipse('shadow', 22, 61, 14, 2.5),
    ellipse('panel', 22, 59, 11, 3),
    path('line', 'M22 30V58'),
    ellipse('rail', 22, 46, 10, 3),
    ellipse('face', 22, 28, 17, 6),
    ellipse('panel', 22, 25, 17, 6.5),
  ],
  seats: BAR_STOOL_SEATS.seats.map(({ u, v }) => ({ u, v })),
  ring: { cx: 22, cy: 25, rx: 19, ry: 8 },
  ringUnder: 5,
};

// A wooden cabinet with glass doors, bottles inside, drawers below.
const DRINKS_CABINET_VIEW: FurnitureDrawing = {
  width: 88,
  height: 120,
  parts: [
    ellipse('shadow', 44, 117, 40, 3),
    path('line', 'M12 108v8M76 108v8'),
    rect('panel', 4, 4, 80, 106, 4, T.wood),
    rect('panel', 10, 12, 32, 64, 2, T.glass),
    rect('panel', 46, 12, 32, 64, 2, T.glass),
    ...bottleRow(42, 13, 40, 1),
    ...bottleRow(42, 49, 76, 4),
    path('rail', 'M10 44H42M46 44H78'),
    ...bottleRow(72, 13, 40, 2),
    ...bottleRow(72, 49, 76, 5),
    path('glint', 'M16 70L28 18M52 70L64 18'),
    rect('panel', 10, 82, 68, 22, 2, T.woodDeep),
    path('rail', 'M38 93h12'),
  ],
  seats: [],
  ring: { cx: 44, cy: 108, rx: 40, ry: 7 },
};

// Its back to you: the top seen from above, the back's boards, its legs.
const DRINKS_CABINET_BACK: FurnitureDrawing = {
  width: 88,
  height: 120,
  parts: [
    ellipse('shadow', 44, 117, 40, 3),
    path('line', 'M12 108v8M76 108v8'),
    rect('panel', 4, 4, 80, 10, 3, T.wood),
    rect('face', 4, 12, 80, 98, 4, T.wood),
    path('rail', 'M24 18V104M44 18V104M64 18V104'),
  ],
  seats: [],
  ring: { cx: 44, cy: 108, rx: 40, ry: 7 },
};

// Facing left: its top running away to its near end, its front cheated down its left: the glass doors with their
// bottles, and the drawers below.
const DRINKS_CABINET_SIDE: FurnitureDrawing = {
  width: 48,
  height: 176,
  parts: [
    ellipse('shadow', 26, 172, 22, 3),
    path('line', 'M20 160v10M42 160v10'),
    rect('panel', 14, 4, 32, 56, 3, T.wood),
    rect('face', 14, 58, 32, 104, 4, T.wood),
    rect('panel', 4, 6, 12, 156, 3, T.wood),
    rect('panel', 6, 10, 8, 102, 2, T.glass),
    ...bottleColumn(6.5, 14, 58, 1),
    path('rail', 'M6 61h8'),
    ...bottleColumn(6.5, 64, 108, 4),
    path('glint', 'M8 104L12 20'),
    rect('panel', 6, 116, 8, 42, 2, T.woodDeep),
    path('rail', 'M10 130v12'),
  ],
  seats: [],
  ring: { cx: 26, cy: 162, rx: 22, ry: 7 },
};

function canRow(y: number, offset: number): FurniturePart[] {
  const out: FurniturePart[] = [];
  for (let i = 0; i < 5; i += 1)
    out.push(rect('panel', 13 + i * 9.4, y - 12, 7, 12, 1.5, T.cans[(i + offset) % T.cans.length]));
  return out;
}

// A tall glass-fronted fridge of coloured cans.
const DRINKS_FRIDGE_VIEW: FurnitureDrawing = {
  width: 72,
  height: 128,
  parts: [
    ellipse('shadow', 36, 125, 33, 3),
    rect('panel', 4, 4, 64, 118, 6),
    rect('screen', 10, 9, 52, 6, 2),
    rect('panel', 9, 19, 54, 96, 3, T.glassDeep),
    ...canRow(44, 0),
    path('rail', 'M10 45H62'),
    ...canRow(72, 1),
    path('rail', 'M10 73H62'),
    ...canRow(100, 2),
    path('rail', 'M10 101H62'),
    path('glint', 'M16 110L34 24'),
    path('line', 'M58 48V88'),
  ],
  seats: [],
  ring: { cx: 36, cy: 116, rx: 32, ry: 7 },
};

// Its back to you: the top seen from above, its back, and the cooling coil's grille low down.
const DRINKS_FRIDGE_BACK: FurnitureDrawing = {
  width: 72,
  height: 128,
  parts: [
    ellipse('shadow', 36, 125, 33, 3),
    rect('panel', 4, 4, 64, 10, 4),
    rect('face', 4, 12, 64, 110, 6),
    rect('rail', 12, 78, 48, 34, 2),
    path('rail', 'M16 86h40M16 94h40M16 102h40'),
  ],
  seats: [],
  ring: { cx: 36, cy: 116, rx: 32, ry: 7 },
};

// Cans standing in a column down the turned fridge's glass.
function canColumn(from: number, to: number, offset: number): FurniturePart[] {
  const out: FurniturePart[] = [];
  for (let y = from, i = 0; y + 7 <= to; y += 9, i += 1)
    out.push(rect('panel', 8, y, 6, 7, 1.5, T.cans[(i + offset) % T.cans.length]));
  return out;
}

// Facing left: tall and narrow, its top running away to its near side, its glass front cheated down its left with
// the lit header, the cans on their shelves and the handle at its near end.
const DRINKS_FRIDGE_SIDE: FurnitureDrawing = {
  width: 56,
  height: 168,
  parts: [
    ellipse('shadow', 32, 164, 26, 3),
    rect('panel', 16, 4, 36, 42, 4),
    rect('face', 16, 44, 36, 118, 6),
    rect('panel', 4, 6, 14, 156, 4),
    rect('screen', 7, 10, 8, 7, 2),
    rect('panel', 7, 20, 8, 136, 3, T.glassDeep),
    ...canColumn(22, 64, 0),
    path('rail', 'M8 65h6'),
    ...canColumn(67, 109, 1),
    path('rail', 'M8 110h6'),
    ...canColumn(112, 154, 2),
    path('glint', 'M9 150L13 30'),
    path('line', 'M4 116V146'),
  ],
  seats: [],
  ring: { cx: 32, cy: 156, rx: 26, ry: 7 },
};

// --- The garden -----------------------------------------------------------------------------------------------

// A round leafy shrub with a few flowers, in a stone planter.
const OUTDOOR_PLANT_VIEW: FurnitureDrawing = {
  width: 72,
  height: 80,
  parts: [
    ellipse('shadow', 36, 77, 26, 3),
    ellipse('panel', 36, 36, 31, 22, T.leafDeep),
    ellipse('panel', 22, 32, 15, 13, T.leaf),
    ellipse('panel', 50, 30, 15, 13, T.leaf),
    ellipse('panel', 36, 20, 16, 13, T.leaf),
    ellipse('panel', 24, 24, 3, 3, T.pink),
    ellipse('panel', 46, 18, 3, 3, T.yellow),
    ellipse('panel', 54, 34, 3, 3, T.pink),
    ellipse('panel', 32, 40, 3, 3, T.yellow),
    rect('panel', 12, 52, 48, 8, 3, T.stone),
    path('panel', 'M15 59H57L53 76H19Z', T.stoneDeep),
  ],
  seats: [],
  ring: { cx: 36, cy: 66, rx: 24, ry: 8 },
};

// A trunk under a full round canopy, a soft shadow on the ground.
const TREE_VIEW: FurnitureDrawing = {
  width: 120,
  height: 160,
  parts: [
    ellipse('shadow', 60, 151, 46, 6),
    path('panel', 'M51 152C54 130 55 112 51 92H69C65 112 66 130 69 152Z', T.bark),
    path('rail', 'M58 140V104M63 132V112'),
    path('panel', 'M51 152C46 152 42 154 40 156H80C78 154 74 152 69 152Z', T.barkDeep),
    ellipse('panel', 60, 64, 54, 46, T.leafDark),
    ellipse('panel', 38, 62, 26, 24, T.leafDeep),
    ellipse('panel', 82, 60, 26, 24, T.leafDeep),
    ellipse('panel', 60, 40, 34, 28, T.leaf),
    ellipse('panel', 42, 36, 16, 14, T.leaf),
    ellipse('panel', 78, 34, 16, 14, T.leaf),
    path('glint', 'M48 30C52 24 58 22 64 22'),
  ],
  seats: [],
  ring: { cx: 60, cy: 148, rx: 30, ry: 8 },
};

/** The grid pieces this module draws, for OFFICE_ART. */
export const OFFICE_EXTRA_ART = {
  'office-pod': { front: OFFICE_POD_VIEW, back: OFFICE_POD_BACK, side: OFFICE_POD_SIDE },
  bar: { front: BAR_VIEW, back: BAR_BACK, side: BAR_SIDE },
  // Round: it reads the same from every side, and only its sitter turns (seats.ts SEAT_VIEWS).
  'bar-stool': allSides(BAR_STOOL_VIEW),
  'drinks-cabinet': {
    front: DRINKS_CABINET_VIEW,
    back: DRINKS_CABINET_BACK,
    side: DRINKS_CABINET_SIDE,
  },
  'drinks-fridge': {
    front: DRINKS_FRIDGE_VIEW,
    back: DRINKS_FRIDGE_BACK,
    side: DRINKS_FRIDGE_SIDE,
  },
  'outdoor-plant': allSides(OUTDOOR_PLANT_VIEW),
  tree: allSides(TREE_VIEW),
} as const;

// --- Drawn to their size --------------------------------------------------------------------------------------

// A path whose longer side is at most this times its shorter is a round plaza (docs/specs/009-elements/office.md
// "Garden Path").
export const PLAZA_RATIO = 1.25;
// Every stone stays this share of the path's width in from each end, so its rounded ends are bare gravel and a path
// ending under another never shows a stone there.
export const PATH_STONE_INSET = 0.7;

/** Whether a path of this size draws as a round plaza. */
export function isPlazaPath(width: number, height: number): boolean {
  return Math.max(width, height) <= PLAZA_RATIO * Math.min(width, height);
}

/**
 * A garden path's drawing, in its own px (docs/specs/009-elements/office.md "Garden Path"): a rounded strip of gravel in
 * the element's fill (the floor), stepping stones evenly along its longer side, each the same size however long the
 * path and every one whole, kept back from both ends. About square, it is a round plaza instead (plazaParts).
 */
export function gardenPathParts(width: number, height: number): FurniturePart[] {
  if (width <= 0 || height <= 0) return [];
  if (isPlazaPath(width, height)) return plazaParts(width, height);
  const { horizontal, length, thickness } = fenceRun({ width, height });
  const parts: FurniturePart[] = [rect('floor', 0, 0, width, height, thickness / 2)];
  const rx = thickness * 0.3;
  const ry = thickness * 0.24;
  const pitch = thickness * 0.95;
  // The first and last stone's middles: each stone's end PATH_STONE_INSET widths in from the path's end.
  const first = thickness * PATH_STONE_INSET + rx;
  const last = length - first;
  // Spaced at least 0.7 of a pitch, so the stones never touch; a path with no room for two holds one in its middle.
  const count = last - first >= pitch * 0.7 ? Math.round((last - first) / pitch) + 1 : 1;
  const step = count > 1 ? (last - first) / (count - 1) : 0;
  for (let i = 0; i < count; i += 1) {
    const along = count > 1 ? first + step * i : length / 2;
    // Every other stone sits a little off the middle, so the stones read as laid by hand.
    const across = thickness / 2 + (i % 2 === 0 ? -1 : 1) * thickness * 0.06;
    const [cx, cy] = horizontal ? [along, across] : [across, along];
    parts.push(ellipse('panel', cx, cy, horizontal ? rx : ry, horizontal ? ry : rx, T.stone));
  }
  return parts;
}

/**
 * A round plaza filling the box: paving in the element's fill, a kerb just inside the rim, an inner ring and a ring of
 * small setts between them, the middle left open. The setts are whole and evenly spaced round the ring, however big.
 */
function plazaParts(width: number, height: number): FurniturePart[] {
  const cx = width / 2;
  const cy = height / 2;
  const rx = width / 2;
  const ry = height / 2;
  const kerb = Math.min(6, Math.min(rx, ry) * 0.08);
  const parts: FurniturePart[] = [
    ellipse('floor', cx, cy, rx, ry),
    ellipse('rail', cx, cy, rx - kerb, ry - kerb),
    ellipse('rail', cx, cy, rx * 0.62, ry * 0.62),
  ];
  // The setts' ring halfway between the inner ring and the kerb.
  const ring = (0.62 + (1 - kerb / Math.min(rx, ry))) / 2;
  const size = Math.min(rx, ry) * 0.07;
  const around = Math.PI * (rx + ry) * ring;
  const count = Math.max(6, Math.floor(around / (size * 4)));
  for (let i = 0; i < count; i += 1) {
    const a = (2 * Math.PI * i) / count;
    parts.push(
      ellipse(
        'panel',
        cx + Math.cos(a) * rx * ring,
        cy + Math.sin(a) * ry * ring,
        size,
        size,
        T.stone,
      ),
    );
  }
  return parts;
}

/**
 * Grass's outline, as SVG path data in its own px: a rounded lawn whose sides swell gently to the element's edge, so
 * it reads as grown rather than cut. A fixed handful of curves whatever its size. Empty when it has no area.
 */
export function grassEdgePath(width: number, height: number): string {
  if (width <= 0 || height <= 0) return '';
  const w = width;
  const h = height;
  const r = Math.min(28, Math.min(w, h) * 0.22);
  // How far the corners sit in from the edge the sides swell out to.
  const b = Math.min(3, Math.min(w, h) * 0.04);
  const n = (v: number) => Math.round(v * 100) / 100;
  return (
    `M${n(r)} ${n(b)}Q${n(w / 2)} ${n(-b)} ${n(w - r)} ${n(b)}` +
    `Q${n(w - b)} ${n(b)} ${n(w - b)} ${n(r)}` +
    `Q${n(w + b)} ${n(h / 2)} ${n(w - b)} ${n(h - r)}` +
    `Q${n(w - b)} ${n(h - b)} ${n(w - r)} ${n(h - b)}` +
    `Q${n(w / 2)} ${n(h + b)} ${n(r)} ${n(h - b)}` +
    `Q${n(b)} ${n(h - b)} ${n(b)} ${n(h - r)}` +
    `Q${n(-b)} ${n(h / 2)} ${n(b)} ${n(r)}` +
    `Q${n(b)} ${n(b)} ${n(r)} ${n(b)}Z`
  );
}

/** One tuft of grass rooted at (x, y): three blades `tall` px high, leaning out from the middle. */
function grassTuft(x: number, y: number, tall: number): string {
  const lean = tall * 0.45;
  const n = (v: number) => Math.round(v * 100) / 100;
  return (
    `M${x} ${y}q${n(-lean * 0.3)} ${n(-tall * 0.55)} ${n(-lean)} ${n(-tall * 0.8)}` +
    `M${x} ${y}q${n(lean * 0.1)} ${n(-tall * 0.6)} 0 ${n(-tall)}` +
    `M${x} ${y}q${n(lean * 0.35)} ${n(-tall * 0.5)} ${n(lean)} ${n(-tall * 0.75)}`
  );
}

/** A repeating tile of grass texture: its side in canvas px, its shaded blades and its sunlit blades as path data. */
export interface GrassTile {
  size: number;
  shade: string;
  light: string;
}

/**
 * Grass's texture: two pattern tiles of tufts laid over its fill, sized so their repeats rarely line up (36 and 52
 * px), which hides the grid on a large lawn. The blades sit wholly inside each tile, so none is cut at its seam. A
 * lawn of any size paints these same few strokes through an SVG pattern: nothing grows with its size.
 */
export const GRASS_TILES: readonly GrassTile[] = [
  {
    size: 36,
    shade: [
      grassTuft(7, 13, 7),
      grassTuft(25, 9, 6),
      grassTuft(29, 31, 8),
      grassTuft(12, 30, 5),
    ].join(''),
    light: [grassTuft(18, 21, 5), grassTuft(4, 33, 4)].join(''),
  },
  {
    size: 52,
    shade: [grassTuft(40, 18, 9), grassTuft(15, 44, 8)].join(''),
    light: [grassTuft(30, 40, 6), grassTuft(10, 15, 6), grassTuft(45, 47, 5)].join(''),
  },
];

/** How the blades are painted over the lawn's fill: tints, so they suit any fill and either paper. */
export const GRASS_BLADES = {
  shade: '#14532d',
  shadeOpacity: 0.3,
  light: '#f0fdf4',
  lightOpacity: 0.26,
  width: 1.2,
  // The lawn's edge: a faint darker rim so a patch reads against the floor round it.
  rimOpacity: 0.22,
  rimWidth: 1.5,
} as const;

// Roughly how far apart the pickets stand, in canvas px.
const PICKET_PITCH = 14;

/**
 * A garden fence's drawing, in its own px: two rails along its longer side and pointed white pickets across them,
 * evenly spaced end to end. A tall (vertical) one is seen from above: its pickets are their tops on the rails.
 */
export function gardenFenceParts(width: number, height: number): FurniturePart[] {
  if (width <= 0 || height <= 0) return [];
  const { horizontal, length, thickness } = fenceRun({ width, height });
  const count = Math.max(2, Math.round(length / PICKET_PITCH) + 1);
  const pw = Math.min(thickness * 0.4, PICKET_PITCH * 0.6);
  const step = (length - pw) / (count - 1);
  const parts: FurniturePart[] = [];
  if (horizontal) {
    parts.push(ellipse('shadow', length / 2, thickness - 2, length / 2, 2.5));
    for (const top of [0.34, 0.64])
      parts.push(rect('panel', 0, thickness * top, length, thickness * 0.12, 1, T.picket));
    const point = Math.min(pw * 0.6, thickness * 0.2);
    for (let i = 0; i < count; i += 1) {
      const x = i * step;
      parts.push(
        path(
          'panel',
          `M${x} ${point}L${x + pw / 2} 0L${x + pw} ${point}V${thickness - 3}H${x}Z`,
          T.picket,
        ),
      );
    }
    return parts;
  }
  for (const left of [0.3, 0.58])
    parts.push(rect('panel', thickness * left, 0, thickness * 0.12, length, 1, T.picket));
  for (let i = 0; i < count; i += 1)
    parts.push(rect('panel', thickness * 0.25, i * step, thickness * 0.5, pw, 1.5, T.picket));
  return parts;
}
