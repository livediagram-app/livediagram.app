// The office amenities' restroom (docs/specs/009-elements/office-amenities.md "Restroom"): a Toilet Cubicle, a
// Washbasin under its mirror and a Hand Dryer, drawings in the furniture's vocabulary (seating.ts), upright from the
// room's camera, which both renderers paint. They join OFFICE_ART (office.ts). The footprints are
// @liveworkspace/avatar's; the Restroom preset that places them is room-presets.ts. Pure: no React, no DOM.

import type { FurnitureDrawing } from './seating';
import { allSides, ellipse, path, rect } from './furniture-parts';

// Fixed colours: the cubicles' laminate and tiled stall, porcelain, steel, the mirror's glass, the soap and the lights.
// The hand dryer's and the mirror frame's bodies have none: they take the piece's own colour, else a wash of the
// theme's stroke.
export const RESTROOM_TONES = {
  laminate: '#6cc0ae',
  laminateDeep: '#3f9d8a',
  stall: '#e6f4f1',
  porcelain: '#f8fafc',
  porcelainShade: '#cbd5e1',
  steel: '#cbd5e1',
  steelDeep: '#94a3b8',
  paper: '#ffffff',
  vacant: '#22c55e',
  mirror: '#dbeafe',
  sheen: '#eff6ff',
  soap: '#a7f3d0',
  ready: '#22c55e',
} as const;

const T = RESTROOM_TONES;

// A cubicle from the front: its tiled stall, a toilet under its cistern, a roll of paper on the left panel, the door
// swung open against the right panel with its Vacant indicator, two side panels and a head rail.
const TOILET_CUBICLE_VIEW: FurnitureDrawing = {
  width: 96,
  height: 152,
  parts: [
    ellipse('shadow', 48, 149, 46, 2.5),
    rect('mark', 6, 9, 84, 135, 0, T.stall),
    path('rail', 'M7 40H89M7 72H89M7 104H89'),
    rect('panel', 31, 50, 34, 24, 4, T.porcelain),
    rect('mark', 45, 54, 6, 2.5, 1.25, T.steelDeep),
    path('panel', 'M40 112L38.5 126H57.5L56 112Z', T.porcelain),
    path('panel', 'M31 92C31 104 38 113 44 115H52C58 113 65 104 65 92Z', T.porcelain),
    rect('panel', 44, 73, 8, 12, 1.5, T.porcelain),
    ellipse('panel', 48, 91, 18, 7, T.porcelain),
    ellipse('mark', 48, 91, 11, 3.6, T.porcelainShade),
    rect('mark', 11, 80, 2.5, 10, 1, T.steelDeep),
    ellipse('panel', 17, 85, 4.5, 5, T.paper),
    ellipse('mark', 17, 85, 1.6, 1.8, T.porcelainShade),
    rect('panel', 0, 8, 7, 138, 1.5, T.laminate),
    rect('panel', 89, 8, 7, 138, 1.5, T.laminate),
    path('panel', 'M67 15L89 11V140L67 135Z', T.laminate),
    path('rail', 'M70.5 20V130'),
    rect('mark', 70, 66, 6, 4, 1, T.vacant),
    rect('mark', 70, 72, 2.5, 7, 1, T.laminateDeep),
    rect('panel', 0, 3, 96, 7, 2, T.steel),
    path('line', 'M3.5 146v3M92.5 146v3'),
  ],
  seats: [],
  ring: { cx: 48, cy: 136, rx: 46, ry: 10 },
};

// A white wall-hung basin on its pedestal, a tap and a soap pump on its rim, under a framed mirror with a sheen.
const WASHBASIN_VIEW: FurnitureDrawing = {
  width: 72,
  height: 112,
  parts: [
    ellipse('shadow', 36, 109, 18, 2.5),
    rect('panel', 10, 2, 52, 46, 5),
    rect('mark', 14, 6, 44, 38, 3, T.mirror),
    path('mark', 'M41 6H49L34 44H26Z', T.sheen),
    path('glint', 'M19 38L29 12'),
    path('panel', 'M30 80L28 106H44L42 80Z', T.porcelain),
    path('panel', 'M10 63H62V66C62 76 52 83 36 83C20 83 10 76 10 66Z', T.porcelain),
    rect('panel', 8, 59, 56, 6, 3, T.porcelain),
    ellipse('mark', 36, 62, 19, 1.6, T.porcelainShade),
    path('line', 'M36 60V54C36 51.5 42 51.5 42 54'),
    ellipse('mark', 31, 58, 2.4, 1.4, T.steelDeep),
    rect('panel', 51, 51, 7, 9, 2, T.soap),
    path('line', 'M54.5 51V48H51.5'),
  ],
  seats: [],
  ring: { cx: 36, cy: 102, rx: 22, ry: 6 },
};

// A wall-mounted hand dryer: its grille, the shaded lip, a nozzle and a green ready light.
const HAND_DRYER_VIEW: FurnitureDrawing = {
  width: 36,
  height: 44,
  parts: [
    rect('panel', 3, 3, 30, 30, 7),
    path('rail', 'M11 11H25M11 15H25M11 19H25'),
    rect('face', 3, 24, 30, 9, 4),
    path('panel', 'M13 33H23L21.5 40H14.5Z'),
    ellipse('mark', 27, 8, 1.6, 1.6, T.ready),
    path('glint', 'M8 9V20'),
  ],
  seats: [],
  ring: { cx: 18, cy: 38, rx: 14, ry: 4 },
};

/** The grid pieces this module draws, for OFFICE_ART. */
export const OFFICE_RESTROOM_ART = {
  'toilet-cubicle': allSides(TOILET_CUBICLE_VIEW),
  washbasin: allSides(WASHBASIN_VIEW),
  'hand-dryer': allSides(HAND_DRYER_VIEW),
} as const;
