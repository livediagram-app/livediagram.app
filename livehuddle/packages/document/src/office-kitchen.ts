// The office amenities' kitchenette (docs/specs/009-elements/office-amenities.md "Kitchenette"): a Kitchen Counter and a
// Kitchen Sink built as one run of units, a Fridge, and a Microwave and a Kettle that stand on a counter's worktop.
// Drawings in the furniture's vocabulary (seating.ts), upright from the room's camera, which both renderers paint. They
// join OFFICE_ART (office.ts). The footprints are @livehuddle/avatar's. Pure: no React, no DOM.

import type { FurnitureArt, FurnitureDrawing, FurniturePart } from './seating';
import { ellipse, path, rect } from './furniture-parts';

// Fixed colours: the units' sage paint and brass handles, the oak worktop, the white splashback tiles, steel, the
// fridge's drawing and magnets, the microwave's glass and clock, the kettle's red. An appliance's body has none: it
// takes the piece's own colour, else a wash of the theme's stroke.
export const KITCHEN_TONES = {
  sage: '#9cbf9a',
  sageDeep: '#6f9a6c',
  brass: '#d4a73a',
  oak: '#d9a066',
  oakDeep: '#b7793d',
  tile: '#f1f5f9',
  steel: '#cbd5e1',
  steelDeep: '#94a3b8',
  towel: '#f8fafc',
  towelStripe: '#ef4444',
  paper: '#fefce8',
  note: '#fde68a',
  sun: '#facc15',
  roof: '#ef4444',
  grass: '#22c55e',
  magnetBlue: '#3b82f6',
  magnetOrange: '#f97316',
  glass: '#1e293b',
  clockFace: '#0f172a',
  clock: '#4ade80',
  keypad: '#94a3b8',
  kettle: '#ef4444',
  kettleDeep: '#b91c1c',
  kettleBase: '#334155',
  water: '#bae6fd',
} as const;

const T = KITCHEN_TONES;

/** A kitchen unit's grid: both units are this size, so a Counter and a Sink side by side are one run. */
export const KITCHEN_UNIT = { width: 112, height: 88 } as const;
/** Where a unit's worktop starts, down its grid (the splashback above it). */
export const COUNTER_WORKTOP_Y = 14;
// The worktop's depth: a piece stands on it with its base at the worktop's middle.
const WORKTOP_H = 10;

// Where each counter-top piece's base is, down its own grid.
const BASE_Y = { microwave: 36, kettle: 33 } as const;

/**
 * The y a Microwave or a Kettle is placed at to stand on a counter whose top is at `counterY`: its base on the middle of
 * the worktop (docs/specs/009-elements/office-amenities.md "On a counter").
 */
export function counterTopY(kind: keyof typeof BASE_Y, counterY: number): number {
  return counterY + COUNTER_WORKTOP_Y + WORKTOP_H / 2 - BASE_Y[kind];
}

/**
 * A kitchen unit's side drawing (facing left): both units share it, a unit's length down the canvas, so units turned
 * onto a side wall and placed end to end are one run with one worktop line.
 */
export const KITCHEN_UNIT_SIDE = { width: 64, height: 112 } as const;
/** The worktop across a unit's side drawing: from x, this wide, the whole length of the unit. */
export const COUNTER_SIDE_WORKTOP = { x: 26, width: 28 } as const;

// Each counter-top piece's side drawing's width, and where its base is centred across it.
const SIDE_WIDTH_MICROWAVE = 32;
const SIDE_WIDTH_KETTLE = 28;
const SIDE_WIDTH = { microwave: SIDE_WIDTH_MICROWAVE, kettle: SIDE_WIDTH_KETTLE } as const;
const BASE_SIDE_X = { microwave: 16, kettle: 14 } as const;

/**
 * The x a turned Microwave or Kettle is placed at to stand on a counter turned the same way (docs/specs/009-elements/
 * office-amenities.md "On a counter"): the counter's box starts at `counterX` and both are drawn at `scale` canvas px
 * per grid unit; the piece's base is centred on the worktop, mirrored when both face right. Along the run it stands
 * wherever it is placed.
 */
export function counterSideX(
  kind: keyof typeof BASE_SIDE_X,
  counterX: number,
  scale = 1,
  mirrored = false,
): number {
  const worktop = COUNTER_SIDE_WORKTOP.x + COUNTER_SIDE_WORKTOP.width / 2;
  const width = SIDE_WIDTH[kind];
  const base = mirrored ? width - BASE_SIDE_X[kind] : BASE_SIDE_X[kind];
  const middle = mirrored ? KITCHEN_UNIT_SIDE.width - worktop : worktop;
  return counterX + (middle - base) * scale;
}

// The splashback's metro tiles, offset row by row, then the oak worktop and its front edge: every unit's top.
const unitTop: FurniturePart[] = [
  rect('panel', 2, 0, 108, 16, 1.5, T.tile),
  path(
    'rail',
    'M2 8H110' +
      [14, 30, 46, 62, 78, 94].map((x) => `M${x} 1V8`).join('') +
      [22, 38, 54, 70, 86, 102].map((x) => `M${x} 8V15`).join(''),
  ),
  rect('panel', 0, COUNTER_WORKTOP_Y, 112, WORKTOP_H, 2, T.oak),
  rect('panel', 0, COUNTER_WORKTOP_Y + WORKTOP_H - 1, 112, 5, 1.5, T.oakDeep),
];

// A shaker door: the panel, its inset, and a brass bar handle beside the middle.
const door = (x: number, y: number, h: number, handleX: number): FurniturePart[] => [
  rect('panel', x, y, 51, h, 2, T.sage),
  rect('rail', x + 4, y + 4, 43, h - 8, 1.5),
  rect('mark', handleX, y + 6, 2.5, 12, 1.25, T.brass),
];

// The carcass the doors hang on, so no paper shows between them, and the plinth under it.
const carcass: FurniturePart[] = [
  ellipse('shadow', 56, 85, 54, 3),
  rect('face', 6, 77, 100, 6, 1, T.sageDeep),
  rect('panel', 2, 26, 108, 53, 1.5, T.sageDeep),
];

// A unit on its side, facing left: the splashback's tiles against the wall on the right, the oak worktop from above
// with its front edge, and the unit's front cheated toward you down the left, its plinth at the far left. Nothing
// closes either end, so units end to end are one unbroken run.
const sideTop: FurniturePart[] = [
  ellipse('shadow', 32, 110, 30, 2),
  rect('panel', 54, 0, 10, 112, 1.5, T.tile),
  path(
    'rail',
    'M59 0V112' +
      [8, 24, 40, 56, 72, 88, 104].map((y) => `M54 ${y}H59`).join('') +
      [16, 32, 48, 64, 80, 96].map((y) => `M59 ${y}H64`).join(''),
  ),
  rect('panel', 2, 0, 24, 112, 1.5, T.sageDeep),
  rect('face', 2, 0, 5, 112, 1, T.sageDeep),
  rect('panel', COUNTER_SIDE_WORKTOP.x, 0, COUNTER_SIDE_WORKTOP.width, 112, 2, T.oak),
  rect('panel', 22, 0, 6, 112, 1.5, T.oakDeep),
];

// A shaker door on its side: the panel, its inset and the brass handle across it beside the middle of the run.
const sideDoor = (x: number, y: number, w: number, handleY: number): FurniturePart[] => [
  rect('panel', x, y, w, 52, 2, T.sage),
  rect('rail', x + 3, y + 4, w - 6, 44, 1.5),
  rect('mark', x + w - 9, handleY, 6, 2.5, 1.25, T.brass),
];

// Base units: two drawers over two cupboard doors, under the worktop.
const KITCHEN_COUNTER_VIEW: FurnitureDrawing = {
  ...KITCHEN_UNIT,
  parts: [
    ...carcass,
    ...unitTop,
    rect('panel', 4, 29, 51, 12, 2, T.sage),
    rect('panel', 57, 29, 51, 12, 2, T.sage),
    path('mark', 'M22.5 33.75h14v2.5h-14zM75.5 33.75h14v2.5h-14z', T.brass),
    ...door(4, 43, 34, 49),
    ...door(57, 43, 34, 60.5),
  ],
  seats: [],
  ring: { cx: 56, cy: 62, rx: 54, ry: 20 },
};

// A unit's back to you: the worktop from above at the same line as its front's, its back edge, and the carcass's plain
// back panel, so units back to back across a room still line up.
const backTop: FurniturePart[] = [
  ellipse('shadow', 56, 85, 54, 3),
  rect('panel', 2, 27, 108, 56, 1.5, T.sageDeep),
  path('rail', 'M56 31V79M6 50H106'),
  rect('panel', 0, COUNTER_WORKTOP_Y, 112, WORKTOP_H, 2, T.oak),
  rect('panel', 0, COUNTER_WORKTOP_Y + WORKTOP_H - 1, 112, 5, 1.5, T.oakDeep),
];

const KITCHEN_COUNTER_BACK: FurnitureDrawing = {
  ...KITCHEN_UNIT,
  parts: [...backTop],
  seats: [],
  ring: { cx: 56, cy: 62, rx: 54, ry: 20 },
};

// Facing left: the two drawers along the worktop's edge and the two doors beyond them, one above the other.
const KITCHEN_COUNTER_SIDE: FurnitureDrawing = {
  ...KITCHEN_UNIT_SIDE,
  parts: [
    ...sideTop,
    rect('panel', 16, 2, 7, 52, 2, T.sage),
    rect('panel', 16, 58, 7, 52, 2, T.sage),
    path('mark', 'M18.25 21h2.5v14h-2.5zM18.25 77h2.5v14h-2.5z', T.brass),
    ...sideDoor(5, 2, 11, 48),
    ...sideDoor(5, 58, 11, 61.5),
  ],
  seats: [],
  ring: { cx: 32, cy: 56, rx: 30, ry: 54 },
};

// The same unit with a steel sink in the worktop, a swan-neck tap and a tea towel over the cupboard door.
const KITCHEN_SINK_VIEW: FurnitureDrawing = {
  ...KITCHEN_UNIT,
  parts: [
    ...carcass,
    ...unitTop,
    rect('mark', 28, 15.5, 56, 7, 3, T.steel),
    rect('mark', 31, 17, 50, 4.5, 2, T.steelDeep),
    path('line', 'M56 16V7C56 3 64 3 64 7V10'),
    ellipse('mark', 49, 15, 2.4, 1.6, T.steelDeep),
    ellipse('mark', 63, 15, 2.4, 1.6, T.steelDeep),
    ...door(4, 29, 48, 49),
    ...door(57, 29, 48, 60.5),
    path('panel', 'M70 33H86V58L78 55L70 58Z', T.towel),
    path('mark', 'M70 44h16v2.5H70zM70 49h16v1.5H70z', T.towelStripe),
  ],
  seats: [],
  ring: { cx: 56, cy: 62, rx: 54, ry: 20 },
};

// The sink unit's back to you: the sink in the worktop beyond, the tap's back toward you, and the plain carcass back.
const KITCHEN_SINK_BACK: FurnitureDrawing = {
  ...KITCHEN_UNIT,
  parts: [
    ...backTop,
    rect('mark', 28, 15.5, 56, 7, 3, T.steel),
    rect('mark', 31, 17, 50, 4.5, 2, T.steelDeep),
    path('line', 'M56 23V12C56 8 48 8 48 12V15'),
    ellipse('mark', 49, 23, 2.4, 1.6, T.steelDeep),
    ellipse('mark', 63, 23, 2.4, 1.6, T.steelDeep),
  ],
  seats: [],
  ring: { cx: 56, cy: 62, rx: 54, ry: 20 },
};

// Facing left: the sink in the worktop from above, the tap reaching over it from the splashback, and the tea towel
// over the nearer of the two doors.
const KITCHEN_SINK_SIDE: FurnitureDrawing = {
  ...KITCHEN_UNIT_SIDE,
  parts: [
    ...sideTop,
    ...sideDoor(5, 2, 18, 48),
    ...sideDoor(5, 58, 18, 61.5),
    rect('mark', 30, 28, 20, 56, 3, T.steel),
    rect('mark', 32, 31, 16, 50, 2, T.steelDeep),
    path('line', 'M54 56H43C40 56 40 60 42 60'),
    ellipse('mark', 51, 49, 1.6, 2.4, T.steelDeep),
    ellipse('mark', 51, 63, 1.6, 2.4, T.steelDeep),
    path('panel', 'M7 70H24V86H7L10 78Z', T.towel),
    path('mark', 'M13 70h2.5v16H13zM18 70h1.5v16H18z', T.towelStripe),
  ],
  seats: [],
  ring: { cx: 32, cy: 56, rx: 30, ry: 54 },
};

// A tall fridge-freezer: the freezer door over the fridge door, long handles, a child's drawing and a note held up by
// magnets.
const FRIDGE_VIEW: FurnitureDrawing = {
  width: 72,
  height: 136,
  parts: [
    ellipse('shadow', 36, 133, 33, 3),
    path('line', 'M12 128v4M60 128v4'),
    rect('panel', 4, 4, 64, 125, 7),
    rect('panel', 8, 8, 56, 38, 4),
    rect('panel', 8, 49, 56, 76, 4),
    rect('mark', 55, 18, 3.5, 20, 1.75, T.steelDeep),
    rect('mark', 55, 56, 3.5, 32, 1.75, T.steelDeep),
    rect('panel', 15, 63, 24, 20, 1, T.paper),
    ellipse('mark', 21, 69, 2.6, 2.6, T.sun),
    path('mark', 'M27 80V74L32 70L37 74V80Z', T.roof),
    rect('mark', 16, 80, 22, 2, 0.5, T.grass),
    ellipse('mark', 27, 63, 2.4, 2.4, T.magnetBlue),
    rect('panel', 14, 95, 16, 14, 1, T.note),
    path('rail', 'M17 101h10M17 105h7'),
    ellipse('mark', 22, 95, 2.6, 2.6, T.magnetOrange),
    path('glint', 'M13 40V14M13 118V92'),
  ],
  seats: [],
  ring: { cx: 36, cy: 124, rx: 32, ry: 7 },
};

// Its back to you: the plain back panel, the condenser's coil, the compressor at its foot and its feet.
const FRIDGE_BACK: FurnitureDrawing = {
  width: 72,
  height: 136,
  parts: [
    ellipse('shadow', 36, 133, 33, 3),
    path('line', 'M12 128v4M60 128v4'),
    rect('panel', 4, 4, 64, 125, 7),
    rect('face', 4, 4, 64, 8, 4),
    path('rail', 'M16 36H56M16 46H56M16 56H56M16 66H56M16 76H56M16 86H56M16 36V86M56 36V86'),
    rect('mark', 24, 104, 24, 16, 4, T.steelDeep),
    path('glint', 'M60 18V30'),
  ],
  seats: [],
  ring: { cx: 36, cy: 124, rx: 32, ry: 7 },
};

// Facing left: tall and deep. Its top from above, its plain side panel nearest you, and its doors cheated toward you
// down the left, the freezer's over the fridge's, with their long handles and a corner of the drawing and the note.
const FRIDGE_SIDE: FurnitureDrawing = {
  width: 64,
  height: 156,
  parts: [
    ellipse('shadow', 34, 152, 28, 3),
    path('line', 'M22 146v4M52 146v4'),
    rect('panel', 18, 4, 40, 46, 6),
    rect('face', 18, 44, 40, 104, 6),
    path('glint', 'M52 54V80'),
    rect('panel', 4, 6, 18, 142, 5),
    rect('panel', 7, 9, 13, 44, 3),
    rect('panel', 7, 56, 13, 88, 3),
    rect('mark', 8.5, 20, 3, 22, 1.5, T.steelDeep),
    rect('mark', 8.5, 64, 3, 32, 1.5, T.steelDeep),
    rect('panel', 13, 102, 6, 18, 1, T.paper),
    ellipse('mark', 16, 102, 2.2, 2.2, T.magnetBlue),
    rect('panel', 13, 124, 6, 12, 1, T.note),
    ellipse('mark', 16, 124, 2.2, 2.2, T.magnetOrange),
  ],
  seats: [],
  ring: { cx: 34, cy: 144, rx: 28, ry: 8 },
};

// A microwave: a dark glass door with its glint, a control panel with a green clock and a keypad.
const MICROWAVE_VIEW: FurnitureDrawing = {
  width: 60,
  height: 40,
  parts: [
    ellipse('shadow', 30, 37.5, 27, 2),
    rect('panel', 2, 4, 56, BASE_Y.microwave - 4, 4),
    rect('mark', 6, 8, 36, 24, 2.5, T.glass),
    path('glint', 'M10 28L21 11M16 28L24 16'),
    path('rail', 'M44.5 7V33'),
    rect('mark', 47, 9, 8, 5, 1, T.clockFace),
    rect('mark', 48.5, 10.5, 5, 2, 0.5, T.clock),
    path(
      'mark',
      [18, 22.5, 27].map((y) => [48, 52].map((x) => `M${x} ${y}h3v2.5h-3z`).join('')).join(''),
      T.keypad,
    ),
  ],
  seats: [],
  ring: { cx: 30, cy: 36, rx: 28, ry: 4 },
};

// Its back to you: the plain back panel and its vent slits, its base at the same line as its front's.
const MICROWAVE_BACK: FurnitureDrawing = {
  width: 60,
  height: 40,
  parts: [
    ellipse('shadow', 30, 37.5, 27, 2),
    rect('panel', 2, 4, 56, BASE_Y.microwave - 4, 4),
    rect('face', 2, 4, 56, 5, 3),
    path('rail', [36, 40, 44, 48, 52].map((x) => `M${x} 14V30`).join('')),
    rect('mark', 8, 26, 10, 5, 1, T.steelDeep),
  ],
  seats: [],
  ring: { cx: 30, cy: 36, rx: 28, ry: 4 },
};

// Facing left: its top from above, its plain end nearest you, and its door and controls cheated toward you down the
// left: the dark glass beyond, the green clock and the keypad nearest you.
const MICROWAVE_SIDE: FurnitureDrawing = {
  width: SIDE_WIDTH_MICROWAVE,
  height: 68,
  parts: [
    ellipse('shadow', 17, 65.5, 14, 2),
    rect('panel', 9, 4, 21, 46, 4),
    rect('face', 9, 44, 21, 20, 4),
    rect('panel', 2, 6, 10, 58, 3),
    rect('mark', 4, 9, 6, 34, 2, T.glass),
    path('glint', 'M6 38L8 14'),
    rect('mark', 4, 46, 6, 5, 1, T.clockFace),
    rect('mark', 5.5, 47.5, 3, 2, 0.5, T.clock),
    path('mark', [53, 56.5, 60].map((y) => `M4.5 ${y}h5v2h-5z`).join(''), T.keypad),
  ],
  seats: [],
  ring: { cx: 17, cy: 62, rx: 15, ry: 4 },
};

// A red electric kettle on its dark base: spout, handle, lid knob and a water window.
const KETTLE_VIEW: FurnitureDrawing = {
  width: 32,
  height: 36,
  parts: [
    ellipse('shadow', 16, 34.5, 13, 1.5),
    rect('panel', 5, 29, 22, BASE_Y.kettle - 29, 2, T.kettleBase),
    path('line', 'M24 12.5C30 12.5 30 25.5 25 25.5'),
    path('panel', 'M10 13.5L4 9.5L5.2 7.5L10.5 10Z', T.kettle),
    path('panel', 'M8 29L9 12C9 9.5 11 8 13.5 8H19.5C22 8 24 9.5 24 12L25 29Z', T.kettle),
    rect('panel', 13.5, 4.5, 6, 4.5, 2, T.kettleBase),
    rect('mark', 18.5, 14, 3, 11, 1.5, T.water),
    path('glint', 'M12.5 13V26'),
  ],
  seats: [],
  ring: { cx: 16, cy: 32, rx: 13, ry: 3 },
};

// Its back to you: the handle on the left now, the spout on the right, and no water window (it is on the front).
const KETTLE_BACK: FurnitureDrawing = {
  width: 32,
  height: 36,
  parts: [
    ellipse('shadow', 16, 34.5, 13, 1.5),
    rect('panel', 5, 29, 22, BASE_Y.kettle - 29, 2, T.kettleBase),
    path('line', 'M8 12.5C2 12.5 2 25.5 7 25.5'),
    path('panel', 'M22 13.5L28 9.5L26.8 7.5L21.5 10Z', T.kettle),
    path('panel', 'M24 29L23 12C23 9.5 21 8 18.5 8H12.5C10 8 8 9.5 8 12L7 29Z', T.kettle),
    rect('panel', 12.5, 4.5, 6, 4.5, 2, T.kettleBase),
    path('glint', 'M12.5 13V26'),
  ],
  seats: [],
  ring: { cx: 16, cy: 32, rx: 13, ry: 3 },
};

// Facing left: its spout turned away from you, its handle toward you standing proud of the body, and the water window
// cheated toward you on the left.
const KETTLE_SIDE: FurnitureDrawing = {
  width: SIDE_WIDTH_KETTLE,
  height: 36,
  parts: [
    ellipse('shadow', 14, 34.5, 12, 1.5),
    rect('panel', 3, 29, 22, BASE_Y.kettle - 29, 2, T.kettleBase),
    path('panel', 'M16 9L17.5 4.5H20.5L20 9.5Z', T.kettleDeep),
    path('panel', 'M6 29L7 12C7 9.5 9 8 11.5 8H16.5C19 8 21 9.5 21 12L22 29Z', T.kettle),
    rect('panel', 11, 4.5, 6, 4.5, 2, T.kettleBase),
    rect('mark', 7.5, 14, 2.5, 11, 1.25, T.water),
    path('panel', 'M12 12.5H16.5V27H12Z', T.kettleDeep),
    path('glint', 'M19 13V24'),
  ],
  seats: [],
  ring: { cx: 14, cy: 32, rx: 12, ry: 3 },
};

/** The grid pieces this module draws, for OFFICE_ART. */
export const OFFICE_KITCHEN_ART = {
  'kitchen-counter': {
    front: KITCHEN_COUNTER_VIEW,
    back: KITCHEN_COUNTER_BACK,
    side: KITCHEN_COUNTER_SIDE,
  } satisfies FurnitureArt,
  'kitchen-sink': {
    front: KITCHEN_SINK_VIEW,
    back: KITCHEN_SINK_BACK,
    side: KITCHEN_SINK_SIDE,
  } satisfies FurnitureArt,
  fridge: { front: FRIDGE_VIEW, back: FRIDGE_BACK, side: FRIDGE_SIDE } satisfies FurnitureArt,
  microwave: {
    front: MICROWAVE_VIEW,
    back: MICROWAVE_BACK,
    side: MICROWAVE_SIDE,
  } satisfies FurnitureArt,
  kettle: { front: KETTLE_VIEW, back: KETTLE_BACK, side: KETTLE_SIDE } satisfies FurnitureArt,
} as const;
