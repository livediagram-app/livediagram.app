// The office amenities' kitchenette (docs/specs/009-elements/office-amenities.md "Kitchenette"): a Kitchen Counter and a
// Kitchen Sink built as one run of units, a Fridge, and a Microwave and a Kettle that stand on a counter's worktop.
// Drawings in the furniture's vocabulary (seating.ts), upright from the room's camera, which both renderers paint. They
// join OFFICE_ART (office.ts). The footprints are @liveworkspace/avatar's. Pure: no React, no DOM.

import type { FurnitureDrawing, FurniturePart } from './seating';
import { allSides, ellipse, path, rect } from './furniture-parts';

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

/** The grid pieces this module draws, for OFFICE_ART. */
export const OFFICE_KITCHEN_ART = {
  'kitchen-counter': allSides(KITCHEN_COUNTER_VIEW),
  'kitchen-sink': allSides(KITCHEN_SINK_VIEW),
  fridge: allSides(FRIDGE_VIEW),
  microwave: allSides(MICROWAVE_VIEW),
  kettle: allSides(KETTLE_VIEW),
} as const;
