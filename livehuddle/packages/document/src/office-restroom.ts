// The office amenities' restroom (docs/specs/009-elements/office-amenities.md "Restroom"): a Toilet Cubicle, a
// Washbasin under its mirror and a Hand Dryer, drawings in the furniture's vocabulary (seating.ts), upright from the
// room's camera, which both renderers paint. They join OFFICE_ART (office.ts). The footprints are
// @liveworkspace/avatar's; the Restroom preset that places them is room-presets.ts. Pure: no React, no DOM.

import type { FurnitureArt, FurnitureDrawing } from './seating';
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

// Its back to you: the cubicle's laminate back between its two side panels, under the head rail, on its feet.
const TOILET_CUBICLE_BACK: FurnitureDrawing = {
  width: 96,
  height: 152,
  parts: [
    ellipse('shadow', 48, 149, 46, 2.5),
    rect('panel', 0, 3, 96, 7, 2, T.steel),
    rect('panel', 6, 9, 84, 136, 1.5, T.laminate),
    path('rail', 'M48 14V140M10 132H86'),
    rect('panel', 0, 8, 7, 138, 1.5, T.laminate),
    rect('panel', 89, 8, 7, 138, 1.5, T.laminate),
    path('line', 'M3.5 146v3M92.5 146v3'),
  ],
  seats: [],
  ring: { cx: 48, cy: 136, rx: 46, ry: 10 },
};

// Facing left, as one of a row down a side wall: seen from above, its tiled floor between the far and near partitions,
// the toilet under its cistern against the wall on the right, the roll of paper on the far partition, the door swung
// open against the near one with its Vacant indicator, and the head rail down the left over its open front. Nothing
// closes either end beyond its partitions, so cubicles end to end make one row.
const TOILET_CUBICLE_SIDE: FurnitureDrawing = {
  width: 100,
  height: 120,
  parts: [
    ellipse('shadow', 50, 117, 46, 2.5),
    rect('mark', 6, 8, 90, 92, 0, T.stall),
    path('rail', 'M6 32H96M6 56H96M6 80H96M30 8V100M54 8V100M78 8V100'),
    rect('face', 4, 8, 94, 10, 1.5, T.laminate),
    rect('mark', 34, 13, 10, 2.5, 1, T.steelDeep),
    ellipse('panel', 39, 22, 5, 4.5, T.paper),
    ellipse('mark', 39, 22, 1.8, 1.6, T.porcelainShade),
    rect('panel', 80, 36, 14, 30, 4, T.porcelain),
    rect('mark', 85.5, 46, 3, 8, 1.25, T.steelDeep),
    rect('panel', 70, 45, 11, 12, 2, T.porcelain),
    path('panel', 'M42 51C42 61 48 67 57 67C66 67 72 61 72 51Z', T.porcelain),
    ellipse('panel', 57, 51, 15, 12, T.porcelain),
    ellipse('mark', 55, 51, 9, 7, T.porcelainShade),
    path('panel', 'M9 92L44 84V96L9 99Z', T.laminate),
    rect('mark', 37, 87, 5, 3.5, 1, T.vacant),
    rect('panel', 4, 2, 94, 8, 1.5, T.laminate),
    rect('panel', 4, 96, 94, 8, 1.5, T.laminate),
    rect('face', 4, 102, 94, 12, 1.5, T.laminate),
    rect('panel', 0, 0, 7, 106, 2, T.steel),
    path('line', 'M10 114v3M92 114v3'),
  ],
  seats: [],
  ring: { cx: 50, cy: 108, rx: 46, ry: 8 },
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

// Its back to you: the mirror's plain back on its hanging wire, and the basin from behind on its pedestal, the tap
// nearest you and the soap pump on the left.
const WASHBASIN_BACK: FurnitureDrawing = {
  width: 72,
  height: 112,
  parts: [
    ellipse('shadow', 36, 109, 18, 2.5),
    rect('face', 10, 2, 52, 46, 5),
    path('rail', 'M18 12L36 6L54 12'),
    path('panel', 'M30 80L28 106H44L42 80Z', T.porcelain),
    rect('panel', 14, 51, 7, 9, 2, T.soap),
    path('line', 'M17.5 51V48H20.5'),
    path('panel', 'M10 63H62V66C62 76 52 83 36 83C20 83 10 76 10 66Z', T.porcelain),
    rect('panel', 8, 59, 56, 6, 3, T.porcelain),
    path('line', 'M36 63V55C36 52.5 30 52.5 30 55'),
    ellipse('mark', 41, 61, 2.4, 1.4, T.steelDeep),
  ],
  seats: [],
  ring: { cx: 36, cy: 102, rx: 22, ry: 6 },
};

// Facing left: the mirror on the side wall to the right, seen edge on and cheated toward you so its glass still
// shows; the basin from above with its back to that wall, the tap reaching over it and the soap pump nearest you; and
// its pedestal below.
const WASHBASIN_SIDE: FurnitureDrawing = {
  width: 64,
  height: 116,
  parts: [
    ellipse('shadow', 34, 113, 14, 2.5),
    path('panel', 'M46 8L60 2V56L46 62Z'),
    path('mark', 'M48.5 10L57.5 6V53L48.5 58Z', T.mirror),
    path('mark', 'M48.5 30L57.5 20V30L48.5 40Z', T.sheen),
    path('glint', 'M51 52L55 14'),
    path('panel', 'M31 92L29 112H43L41 92Z', T.porcelain),
    path('panel', 'M16 82H56V84C56 92 47 98 36 98C25 98 16 92 16 84Z', T.porcelain),
    rect('panel', 14, 52, 44, 36, 12, T.porcelain),
    ellipse('mark', 34, 70, 12, 13, T.porcelainShade),
    ellipse('mark', 53, 61, 1.4, 2.4, T.steelDeep),
    path('line', 'M55 69H45C42.5 69 42.5 73 43 74'),
    rect('panel', 46, 76, 8, 9, 2, T.soap),
    path('line', 'M50 76V73H46.5'),
  ],
  seats: [],
  ring: { cx: 34, cy: 106, rx: 18, ry: 6 },
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
  'toilet-cubicle': {
    front: TOILET_CUBICLE_VIEW,
    back: TOILET_CUBICLE_BACK,
    side: TOILET_CUBICLE_SIDE,
  } satisfies FurnitureArt,
  washbasin: {
    front: WASHBASIN_VIEW,
    back: WASHBASIN_BACK,
    side: WASHBASIN_SIDE,
  } satisfies FurnitureArt,
  // The Hand Dryer hangs on the back wall and does not turn (furniture-facing.md "What does not turn").
  'hand-dryer': allSides(HAND_DRYER_VIEW),
} as const;
