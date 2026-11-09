// The workday pieces (docs/specs/009-elements/workday-pieces.md): the Nap Pod, the Treadmill and the Weight Bench, the
// Phone Booth, the Standing Desk and the Hot Desk, the Pet Bed and the Reception Desk. Drawings in the furniture's
// vocabulary (seating.ts), upright from the room's camera like the rest of the office, which both renderers paint (the
// editor's views and svg-render-faces). Each piece that turns (furniture-facing.md) has a front, a back and a side
// drawing; facing right is the side mirrored. Their seats and the desk's footprint are @livehuddle/avatar's; the live
// parts (the running belt, the booth's lamp, the hot desk's card, the bell's ring and the dog) are the editor's, laid
// over these at the grid spots named here, per drawing. Pure: no React, no DOM.

import type { FurnitureDrawing, FurniturePart } from './seating';
import { allSides, ellipse, path, rect } from './furniture-parts';
import type { SeatView } from '@livehuddle/avatar/facing';
import {
  HOT_DESK_SEATS,
  HOT_DESK_SEATS_FRONT,
  HOT_DESK_SEATS_SIDE,
  NAP_POD_SEATS,
  NAP_POD_SEATS_BACK,
  NAP_POD_SEATS_SIDE,
  PHONE_BOOTH_SEATS,
  PHONE_BOOTH_SEATS_BACK,
  PHONE_BOOTH_SEATS_SIDE,
  STANDING_DESK_SEATS,
  STANDING_DESK_SEATS_FRONT,
  STANDING_DESK_SEATS_SIDE,
  TREADMILL_SEATS,
  TREADMILL_SEATS_FRONT,
  TREADMILL_SEATS_SIDE,
  WEIGHT_BENCH_SEATS,
  WEIGHT_BENCH_SEATS_BACK,
  WEIGHT_BENCH_SEATS_SIDE,
  seatSpots,
  type SeatGrid,
} from '@livehuddle/avatar/seats';

// Fixed colours, as VENUE_TONES: the pod's shell and lining, the gym's steel and vinyl, the booth's oak and felt, the
// desks' wood and screens, the bed and the dog, the reception's brass. A hot desk's top and a reception desk's band have
// none: they take the piece's own colour, else a wash of the theme's stroke.
export const WORKDAY_TONES = {
  shell: '#f1ede4',
  shellDeep: '#d9d2c3',
  lining: '#475569',
  cushion: '#c7d2fe',
  pillow: '#eef2ff',
  blanket: '#818cf8',
  lamp: '#fde68a',
  frame: '#334155',
  belt: '#111827',
  rail: '#64748b',
  console: '#1f2937',
  readout: '#34d399',
  steel: '#94a3b8',
  plate: '#1f2937',
  vinyl: '#dc2626',
  oak: '#c08a52',
  oakDeep: '#8a5a2b',
  felt: '#3f4b5e',
  lampOff: '#e5e7eb',
  lampOn: '#ef4444',
  stool: '#f97316',
  desk: '#e7c79a',
  screen: '#93c5fd',
  keys: '#e5e7eb',
  laptop: '#cbd5e1',
  card: '#ffffff',
  bed: '#c2703d',
  bedCushion: '#f5e6c8',
  bone: '#ffffff',
  dog: '#d9a66b',
  dogDeep: '#8a5a2b',
  dogNose: '#1f2937',
  wood: '#b7793f',
  front: '#f8f5ef',
  knee: '#d6cfc0',
  leaf: '#4ade80',
  pot: '#ea580c',
  brass: '#e0b232',
  brassDeep: '#a16207',
} as const;

const T = WORKDAY_TONES;

// A drawing's grid and seats from its seat grid, so the seat and the cushion share one grid.
const gridOf = (grid: SeatGrid) => ({
  width: grid.width,
  height: grid.height,
  seats: grid.seats.map(({ u, v }) => ({ u, v })),
});

/** A spot on each of a piece's three drawings: where the editor lays a live part at that drawing. */
export type PerView<S> = Readonly<Record<SeatView, S>>;
type GridRect = { readonly x: number; readonly y: number; readonly w: number; readonly h: number };

// --- Rest -----------------------------------------------------------------------------------------------------------

// A cocoon lounger: a pale shell whose hood arches over a reclined cushion, a lining inside, a pillow, a blanket over
// the sitter's legs and a reading lamp in the hood.
const NAP_POD_FRONT: FurnitureDrawing = {
  ...gridOf(seatSpots(NAP_POD_SEATS)),
  parts: [
    ellipse('shadow', 60, 108, 56, 4),
    rect('panel', 12, 88, 96, 18, 8, T.shellDeep),
    path('panel', 'M8 94C4 60 16 20 60 8C104 20 116 60 112 94Z', T.shell),
    path('mark', 'M20 92C18 64 30 30 60 22C90 30 102 64 100 92Z', T.lining),
    path('rail', 'M14 92C12 60 24 24 60 14C96 24 108 60 106 92'),
    ellipse('mark', 60, 30, 7, 3, T.lamp),
    rect('panel', 42, 54, 36, 12, 6, T.pillow),
    rect('panel', 22, 66, 76, 20, 9, T.cushion),
    path('panel', 'M24 86C40 78 80 78 96 86V94H24Z', T.blanket),
    rect('face', 10, 92, 100, 8, 4, T.shellDeep),
    path('glint', 'M18 70C18 52 26 36 38 26'),
  ],
  // Round the cushion, under the blanket, so it shows either side of a sitter.
  ring: { cx: 60, cy: 80, rx: 40, ry: 8 },
  ringUnder: 8,
};

// From behind: the hood's smooth back nearest you, a seam down it, and beyond it the open foot end, its lining and the
// blanket over the sitter's legs.
const NAP_POD_BACK: FurnitureDrawing = {
  ...gridOf(NAP_POD_SEATS_BACK),
  parts: [
    ellipse('shadow', 60, 108, 56, 4),
    rect('panel', 12, 88, 96, 18, 8, T.shellDeep),
    rect('panel', 14, 6, 92, 44, 18, T.shell),
    rect('mark', 22, 12, 76, 30, 13, T.lining),
    rect('panel', 28, 14, 64, 22, 10, T.blanket),
    path('panel', 'M8 96C6 64 18 30 60 22C102 30 114 64 112 96Z', T.shell),
    path('rail', 'M60 28V90'),
    rect('face', 10, 92, 100, 8, 4, T.shellDeep),
    path('glint', 'M22 78C22 60 30 46 42 38'),
  ],
  // The sitter is under the hood: the ring lies beneath it, showing either side.
  ring: { cx: 60, cy: 40, rx: 34, ry: 7 },
  ringUnder: 5,
};

// Facing left: the long tub on its plinth with its lining, the cushion reclined along it and the blanket at the open
// foot end on the left, and the hood arching over the head end on the right, its lining and lamp showing at its brim.
const NAP_POD_SIDE: FurnitureDrawing = {
  ...gridOf(NAP_POD_SEATS_SIDE),
  parts: [
    ellipse('shadow', 56, 116, 52, 4),
    rect('panel', 10, 98, 92, 16, 8, T.shellDeep),
    rect('panel', 4, 42, 104, 60, 18, T.shell),
    rect('mark', 12, 48, 88, 40, 14, T.lining),
    rect('panel', 16, 52, 80, 30, 10, T.cushion),
    rect('panel', 12, 50, 36, 34, 9, T.blanket),
    path('panel', 'M66 98C64 60 76 18 98 12C112 14 112 40 110 98Z', T.shell),
    path('mark', 'M70 92C68 62 76 34 90 22C84 40 80 64 82 92Z', T.lining),
    ellipse('mark', 80, 40, 3, 6, T.lamp),
    rect('face', 6, 94, 100, 8, 4, T.shellDeep),
    path('glint', 'M98 24C104 34 106 52 106 70'),
  ],
  ring: { cx: 56, cy: 66, rx: 18, ry: 12 },
  ringUnder: 5,
};

// --- The gym corner -------------------------------------------------------------------------------------------------

/**
 * The treadmill's belt on each drawing: where the editor runs its stripes while someone is on it, the part of the belt
 * in view (on the front the console stands over its near end).
 */
export const TREADMILL_BELTS: PerView<GridRect> = {
  front: { x: 14, y: 24, w: 44, h: 32 },
  back: { x: 14, y: 44, w: 44, h: 56 },
  side: { x: 24, y: 34, w: 78, h: 24 },
};
/** The belt on the drawing an unturned treadmill shows (its back: the runner faces up at the console). */
export const TREADMILL_BELT = TREADMILL_BELTS.back;

// The runner faces you: the belt beyond, the motor hood at the near end, and over it the uprights, the handlebar and
// the console's back toward you, low enough to see the runner over it.
const TREADMILL_FRONT: FurnitureDrawing = {
  ...gridOf(TREADMILL_SEATS_FRONT),
  parts: [
    ellipse('shadow', 36, 108, 34, 4),
    rect('panel', 8, 18, 56, 88, 6, T.frame),
    rect('mark', 14, 24, 44, 62, 3, T.belt),
    path('rail', 'M16 38H56M16 50H56'),
    rect('panel', 8, 18, 6, 88, 3, T.rail),
    rect('panel', 58, 18, 6, 88, 3, T.rail),
    rect('panel', 10, 84, 52, 18, 4, T.console),
    rect('face', 8, 100, 56, 6, 3, T.frame),
    path('line', 'M14 90V66M58 90V66'),
    path('line', 'M6 70H66'),
    rect('panel', 12, 56, 48, 14, 4, T.console),
    path('rail', 'M24 63H48'),
  ],
  ring: { cx: 36, cy: 46, rx: 24, ry: 7 },
  ringUnder: 3,
};

// A running machine seen from behind its user: a dark belt between two side rails, the uprights, the handlebar and the
// console with its readout at the top, and the rear roller nearest you.
const TREADMILL_BACK: FurnitureDrawing = {
  ...gridOf(seatSpots(TREADMILL_SEATS)),
  parts: [
    ellipse('shadow', 36, 108, 34, 4),
    path('line', 'M14 42V20M58 42V20'),
    rect('panel', 8, 40, 56, 66, 6, T.frame),
    rect(
      'mark',
      TREADMILL_BELTS.back.x,
      TREADMILL_BELTS.back.y,
      TREADMILL_BELTS.back.w,
      TREADMILL_BELTS.back.h,
      3,
      T.belt,
    ),
    path('rail', 'M16 58H56M16 72H56M16 86H56'),
    rect('panel', 8, 40, 6, 66, 3, T.rail),
    rect('panel', 58, 40, 6, 66, 3, T.rail),
    rect('face', 8, 100, 56, 6, 3, T.frame),
    path('line', 'M6 24H66'),
    rect('panel', 12, 8, 48, 14, 4, T.console),
    rect('mark', 22, 11, 28, 7, 1.5, T.readout),
  ],
  ring: { cx: 36, cy: 90, rx: 24, ry: 7 },
  ringUnder: 4,
};

// Facing left: the deck along the canvas between its two rails, the belt's slats across it, its near side toward you,
// and at the left end the motor hood, the uprights and the console side on, its readout's edge toward the runner, with
// the handrails running back from it.
const TREADMILL_SIDE: FurnitureDrawing = {
  ...gridOf(TREADMILL_SEATS_SIDE),
  parts: [
    ellipse('shadow', 56, 68, 52, 4),
    rect('panel', 6, 28, 100, 36, 6, T.frame),
    rect(
      'mark',
      TREADMILL_BELTS.side.x,
      TREADMILL_BELTS.side.y,
      TREADMILL_BELTS.side.w,
      TREADMILL_BELTS.side.h,
      3,
      T.belt,
    ),
    path('rail', 'M42 36V56M58 36V56M74 36V56M90 36V56'),
    rect('panel', 6, 28, 100, 6, 3, T.rail),
    rect('panel', 6, 58, 100, 6, 3, T.rail),
    rect('face', 6, 62, 100, 6, 3, T.frame),
    rect('panel', 6, 30, 18, 32, 4, T.console),
    path('line', 'M12 32V12M16 58V32'),
    path('line', 'M14 12H34M18 32H38'),
    rect('panel', 6, 6, 14, 30, 4, T.console),
    rect('mark', 15, 10, 3, 22, 1, T.readout),
  ],
  ring: { cx: 64, cy: 47, rx: 20, ry: 8 },
  ringUnder: 3,
};

// A padded flat bench with a barbell on a rack at its head, plates on each end, and a pair of dumbbells on the floor.
const WEIGHT_BENCH_FRONT: FurnitureDrawing = {
  ...gridOf(seatSpots(WEIGHT_BENCH_SEATS)),
  parts: [
    ellipse('shadow', 68, 84, 64, 4),
    path('line', 'M16 66V18M44 66V18M12 66H20M40 66H48'),
    rect('mark', 0, 20, 60, 4, 2, T.steel),
    rect('panel', 4, 10, 7, 24, 2, T.plate),
    rect('panel', 49, 10, 7, 24, 2, T.plate),
    path('line', 'M34 64V78M114 64V78'),
    rect('face', 26, 60, 94, 6, 2, T.frame),
    rect('panel', 22, 48, 104, 14, 6, T.vinyl),
    path('glint', 'M30 52H70'),
    rect('mark', 98, 77, 24, 3, 1.5, T.steel),
    rect('panel', 94, 73, 7, 11, 2, T.plate),
    rect('panel', 119, 73, 7, 11, 2, T.plate),
  ],
  ring: { cx: 80, cy: 58, rx: 30, ry: 7 },
  ringUnder: 8,
};

// From behind: the same bench end for end, its rack and barbell now at the right, and the dumbbells on the floor beyond
// it, half hidden by the pad.
const WEIGHT_BENCH_BACK: FurnitureDrawing = {
  ...gridOf(WEIGHT_BENCH_SEATS_BACK),
  parts: [
    ellipse('shadow', 68, 84, 64, 4),
    rect('mark', 18, 39, 24, 3, 1.5, T.steel),
    rect('panel', 14, 35, 7, 11, 2, T.plate),
    rect('panel', 39, 35, 7, 11, 2, T.plate),
    path('line', 'M120 66V18M92 66V18M116 66H124M88 66H96'),
    rect('mark', 76, 20, 60, 4, 2, T.steel),
    rect('panel', 125, 10, 7, 24, 2, T.plate),
    rect('panel', 80, 10, 7, 24, 2, T.plate),
    path('line', 'M102 64V78M22 64V78'),
    rect('face', 16, 60, 94, 6, 2, T.frame),
    rect('panel', 10, 48, 104, 14, 6, T.vinyl),
    path('glint', 'M66 52H106'),
  ],
  ring: { cx: 56, cy: 58, rx: 30, ry: 7 },
  ringUnder: 11,
};

// Facing left: the pad down the canvas, its rack at the head with the barbell across it, its near end and legs toward
// you, and the dumbbells on the floor by its foot.
const WEIGHT_BENCH_SIDE: FurnitureDrawing = {
  ...gridOf(WEIGHT_BENCH_SEATS_SIDE),
  parts: [
    ellipse('shadow', 44, 132, 40, 4),
    path('line', 'M22 46V14M66 46V14M18 46H26M62 46H70'),
    rect('mark', 14, 16, 60, 4, 2, T.steel),
    rect('panel', 8, 6, 7, 24, 2, T.plate),
    rect('panel', 73, 6, 7, 24, 2, T.plate),
    path('line', 'M34 116V128M54 116V128'),
    rect('face', 30, 112, 28, 6, 2, T.frame),
    rect('panel', 30, 30, 28, 86, 6, T.vinyl),
    path('glint', 'M36 38V72'),
    rect('mark', 8, 125, 18, 3, 1.5, T.steel),
    rect('panel', 4, 121, 7, 11, 2, T.plate),
    rect('panel', 23, 121, 7, 11, 2, T.plate),
  ],
  ring: { cx: 44, cy: 77, rx: 16, ry: 12 },
  ringUnder: 8,
};

// --- Calls ----------------------------------------------------------------------------------------------------------

/** The phone booth's lamp on its grid: lit red by the editor while the booth is in use. On its roof, so every drawing. */
export const PHONE_BOOTH_LAMP = { x: 18, y: 4, w: 44, h: 6 } as const;

// The roof every drawing shares: its oak, its trim and the lamp on top.
const BOOTH_ROOF: readonly FurniturePart[] = [
  rect('panel', 0, 10, 80, 16, 4, T.oak),
  rect('mark', 14, 15, 52, 6, 2, T.oakDeep),
  rect(
    'panel',
    PHONE_BOOTH_LAMP.x,
    PHONE_BOOTH_LAMP.y,
    PHONE_BOOTH_LAMP.w,
    PHONE_BOOTH_LAMP.h,
    3,
    T.lampOff,
  ),
];

// A booth for one: an oak roof with its lamp, oak sides, a felt back wall in acoustic panels, a shelf with a phone on
// it, a stool, an oak sill, and the glass front's glints.
const PHONE_BOOTH_FRONT: FurnitureDrawing = {
  ...gridOf(seatSpots(PHONE_BOOTH_SEATS)),
  parts: [
    ellipse('shadow', 40, 133, 38, 3),
    rect('mark', 10, 24, 60, 104, 0, T.felt),
    path('rail', 'M10 48H70M10 72H70M10 96H70M40 24V128'),
    rect('panel', 14, 76, 52, 5, 1.5, T.oak),
    rect('mark', 20, 72, 12, 4, 1, T.console),
    path('line', 'M40 110V126'),
    rect('panel', 28, 104, 24, 7, 3.5, T.stool),
    rect('panel', 2, 14, 8, 118, 2, T.oak),
    rect('panel', 70, 14, 8, 118, 2, T.oak),
    rect('face', 2, 126, 76, 8, 2, T.oakDeep),
    ...BOOTH_ROOF,
    path('glint', 'M16 40L28 28M16 58L40 34M54 120L66 108'),
  ],
  ring: { cx: 40, cy: 112, rx: 22, ry: 5 },
  ringUnder: 7,
};

// From behind: its solid oak back nearest you in three raised panels between the corner posts, the sill and the roof.
const PHONE_BOOTH_BACK: FurnitureDrawing = {
  ...gridOf(PHONE_BOOTH_SEATS_BACK),
  parts: [
    ellipse('shadow', 40, 133, 38, 3),
    rect('face', 2, 22, 76, 106, 2, T.oak),
    rect('rail', 14, 32, 52, 24, 2),
    rect('rail', 14, 62, 52, 28, 2),
    rect('rail', 14, 96, 52, 24, 2),
    rect('panel', 2, 14, 8, 118, 2, T.oak),
    rect('panel', 70, 14, 8, 118, 2, T.oak),
    rect('face', 2, 126, 76, 8, 2, T.oakDeep),
    ...BOOTH_ROOF,
  ],
  // Its sitter is inside, beyond the back wall, which covers the ring.
  ring: { cx: 40, cy: 110, rx: 22, ry: 5 },
  ringUnder: 1,
};

// Facing left: through its glass side the felt of the far wall, the back wall edge on at the right with the shelf and
// phone standing out from it, the stool by the glass front, and the oak posts, sill and roof.
const PHONE_BOOTH_SIDE: FurnitureDrawing = {
  ...gridOf(PHONE_BOOTH_SEATS_SIDE),
  parts: [
    ellipse('shadow', 40, 133, 38, 3),
    rect('mark', 10, 24, 60, 104, 0, T.felt),
    path('rail', 'M10 48H58M10 72H58M10 96H58'),
    rect('mark', 58, 24, 12, 104, 0, T.frame),
    rect('panel', 42, 76, 24, 5, 1.5, T.oak),
    rect('mark', 48, 72, 12, 4, 1, T.console),
    path('line', 'M34 110V126'),
    rect('panel', 22, 104, 24, 7, 3.5, T.stool),
    rect('panel', 2, 14, 8, 118, 2, T.oak),
    rect('panel', 70, 14, 8, 118, 2, T.oak),
    rect('face', 2, 126, 76, 8, 2, T.oakDeep),
    ...BOOTH_ROOF,
    path('glint', 'M16 44L30 30M16 64L44 36M50 122L60 112'),
  ],
  ring: { cx: 34, cy: 112, rx: 20, ry: 5 },
  ringUnder: 8,
};

// --- Desks ----------------------------------------------------------------------------------------------------------

// The stander faces you: the desk nearest you on its steel frame, its height buttons at their right (your left), and
// the monitor's back on its stand, low enough to see them over it.
const STANDING_DESK_FRONT: FurnitureDrawing = {
  ...gridOf(STANDING_DESK_SEATS_FRONT),
  parts: [
    ellipse('shadow', 56, 100, 52, 4),
    rect('panel', 6, 88, 22, 6, 3, T.steel),
    rect('panel', 84, 88, 22, 6, 3, T.steel),
    rect('panel', 14, 54, 6, 36, 2, T.steel),
    rect('panel', 92, 54, 6, 36, 2, T.steel),
    path('line', 'M20 76H92'),
    rect('panel', 4, 42, 104, 12, 3, T.desk),
    rect('face', 4, 52, 104, 5, 1.5, T.desk),
    rect('mark', 10, 45, 8, 4, 1, T.console),
    rect('panel', 48, 44, 16, 4, 1.5, T.steel),
    path('rail', 'M56 40V45'),
    rect('panel', 34, 20, 44, 21, 3, T.console),
    path('rail', 'M42 27H70M42 33H70'),
  ],
  ring: { cx: 56, cy: 38, rx: 24, ry: 5 },
  ringUnder: 1,
};

// A tall desk on a steel frame: two legs on wide feet and a crossbar, a pale wood top, a monitor and a keyboard on it,
// and its height buttons at the right. Seen from behind its stander, who faces the monitor.
const STANDING_DESK_BACK: FurnitureDrawing = {
  ...gridOf(seatSpots(STANDING_DESK_SEATS)),
  parts: [
    ellipse('shadow', 56, 100, 52, 4),
    rect('panel', 6, 88, 22, 6, 3, T.steel),
    rect('panel', 84, 88, 22, 6, 3, T.steel),
    rect('panel', 14, 40, 6, 50, 2, T.steel),
    rect('panel', 92, 40, 6, 50, 2, T.steel),
    path('line', 'M20 70H92'),
    path('line', 'M56 26V31'),
    rect('panel', 32, 4, 48, 22, 2, T.console),
    rect('mark', 35, 7, 42, 16, 1, T.screen),
    rect('panel', 4, 30, 104, 10, 3, T.desk),
    rect('face', 4, 38, 104, 5, 1.5, T.desk),
    rect('panel', 38, 31, 36, 6, 1.5, T.keys),
    rect('mark', 94, 32, 8, 4, 1, T.console),
  ],
  ring: { cx: 56, cy: 96, rx: 24, ry: 5 },
};

// Facing left: the top a long board down the left on its near leg and foot, the monitor side on with its glass cheated
// toward the stander on the right, the keyboard by them and the height buttons at their right (up the canvas).
const STANDING_DESK_SIDE: FurnitureDrawing = {
  ...gridOf(STANDING_DESK_SEATS_SIDE),
  parts: [
    ellipse('shadow', 40, 106, 36, 4),
    rect('panel', 10, 100, 32, 6, 3, T.steel),
    rect('panel', 23, 76, 6, 26, 2, T.steel),
    rect('panel', 6, 6, 40, 68, 3, T.desk),
    rect('face', 6, 72, 40, 5, 1.5, T.desk),
    rect('mark', 36, 10, 6, 6, 1, T.console),
    rect('panel', 32, 24, 8, 34, 1.5, T.keys),
    rect('panel', 8, 32, 8, 16, 2, T.steel),
    path('rail', 'M12 40H16'),
    rect('panel', 13, 16, 14, 46, 3, T.console),
    rect('mark', 19, 19, 6, 40, 1, T.screen),
  ],
  ring: { cx: 70, cy: 66, rx: 22, ry: 6 },
};

/**
 * The hot desk's name card on each drawing: the editor writes the sitter's name on it. On the desk's front edge, toward
 * whoever walks up (on its side, across the near end of the top, so its words still read).
 */
export const HOT_DESK_CARDS: PerView<GridRect> = {
  front: { x: 10, y: 50, w: 40, h: 12 },
  back: { x: 72, y: 38, w: 40, h: 12 },
  side: { x: 8, y: 80, w: 36, h: 11 },
};
/** The card on the drawing an unturned hot desk shows (its back: the sitter faces up at the monitor). */
export const HOT_DESK_CARD = HOT_DESK_CARDS.back;

const card = (r: GridRect) => rect('panel', r.x, r.y, r.w, r.h, 2, T.card);

// The sitter faces you: the chair beyond the desk, the desk in the piece's own colour nearest you, the laptop dock at
// the sitter's left (your right), the monitor's back on its stand and the name card on the near edge.
const HOT_DESK_FRONT: FurnitureDrawing = {
  ...gridOf(HOT_DESK_SEATS_FRONT),
  parts: [
    ellipse('shadow', 60, 108, 56, 4),
    path('line', 'M60 30V40'),
    rect('panel', 42, 2, 36, 20, 5),
    rect('panel', 38, 20, 44, 13, 4),
    path('line', 'M14 72V102M106 72V102'),
    rect('panel', 6, 42, 108, 24, 4),
    rect('face', 6, 64, 108, 10, 3),
    rect('panel', 82, 45, 24, 13, 2, T.laptop),
    path('rail', 'M86 51H102'),
    rect('panel', 52, 48, 16, 4, 1.5),
    path('rail', 'M60 44V49'),
    rect('panel', 42, 24, 36, 21, 3, T.console),
    path('rail', 'M48 30H72M48 36H72'),
    card(HOT_DESK_CARDS.front),
  ],
  ring: { cx: 60, cy: 28, rx: 26, ry: 7 },
  ringUnder: 4,
};

// A desk with a chair in front of it: the top in the piece's own colour, a monitor and a laptop dock, a name card
// standing on its front edge, and the chair, its back toward you (its sitter faces the monitor).
const HOT_DESK_BACK: FurnitureDrawing = {
  ...gridOf(seatSpots(HOT_DESK_SEATS)),
  parts: [
    ellipse('shadow', 60, 108, 56, 4),
    path('line', 'M14 64V96M106 64V96'),
    path('line', 'M60 28V32'),
    rect('panel', 40, 6, 40, 22, 2, T.console),
    rect('mark', 43, 9, 34, 15, 1, T.screen),
    rect('panel', 6, 30, 108, 28, 4),
    rect('face', 6, 56, 108, 10, 3),
    rect('panel', 14, 36, 24, 13, 2, T.laptop),
    path('rail', 'M18 44H34'),
    card(HOT_DESK_CARDS.back),
    path('line', 'M60 98V108'),
    rect('panel', 40, 76, 40, 10, 4),
    rect('panel', 42, 86, 36, 14, 5),
  ],
  ring: { cx: 60, cy: 84, rx: 26, ry: 6 },
  ringUnder: 12,
};

// Facing left: the desk a long top down the left with its near end toward you, the monitor side on with its glass
// toward the chair, the laptop dock at the sitter's left (down the canvas), the name card across the near end, and the
// chair on the right with its backrest along its right.
const HOT_DESK_SIDE: FurnitureDrawing = {
  ...gridOf(HOT_DESK_SEATS_SIDE),
  parts: [
    ellipse('shadow', 56, 113, 50, 5),
    path('line', 'M12 102V116M40 102V116'),
    rect('panel', 6, 18, 40, 76, 3),
    rect('face', 6, 92, 40, 10, 2),
    rect('panel', 9, 38, 8, 16, 2),
    path('rail', 'M13 46H17'),
    rect('panel', 15, 22, 14, 40, 3, T.console),
    rect('mark', 21, 25, 6, 34, 1, T.screen),
    rect('panel', 32, 58, 11, 18, 2, T.laptop),
    path('rail', 'M37.5 62V72'),
    card(HOT_DESK_CARDS.side),
    path('line', 'M70 81V104M62 104H78'),
    rect('panel', 52, 48, 36, 28, 4),
    rect('face', 52, 74, 36, 7, 3),
    rect('panel', 85, 34, 10, 44, 3),
    rect('face', 85, 74, 10, 7, 2),
  ],
  ring: { cx: 70, cy: 62, rx: 24, ry: 14 },
  ringUnder: 14,
};

// --- The office dog -------------------------------------------------------------------------------------------------

// A round cushioned dog bed with a bone toy in front. The dog is the editor's, live: it wanders, so it is never part of
// the bed's drawing.
const PET_BED_VIEW: FurnitureDrawing = {
  width: 72,
  height: 48,
  parts: [
    ellipse('shadow', 36, 44, 34, 3),
    ellipse('panel', 36, 30, 34, 15, T.bed),
    ellipse('mark', 36, 31, 25, 10, T.bedCushion),
    path('rail', 'M14 24C22 18 50 18 58 24'),
    path(
      'mark',
      'M52 40.5a2.2 2.2 0 1 1 2.2-2.2h7.6a2.2 2.2 0 1 1 2.2 2.2a2.2 2.2 0 1 1-2.2 2.2h-7.6a2.2 2.2 0 1 1-2.2-2.2Z',
      T.bone,
    ),
  ],
  seats: [],
  ring: { cx: 36, cy: 32, rx: 30, ry: 10 },
};

// --- Arrival --------------------------------------------------------------------------------------------------------

/** The reception desk's bell on each drawing: where the editor rings out its ding. On the counter, so every drawing. */
export const RECEPTION_BELLS: PerView<{ readonly cx: number; readonly cy: number }> = {
  front: { cx: 70, cy: 44 },
  back: { cx: 130, cy: 31 },
  side: { cx: 28, cy: 56 },
};
/** The bell on the front drawing, the one an unturned desk shows. */
export const RECEPTION_BELL = RECEPTION_BELLS.front;

// The brass service bell: its base, its dome, the button on top and the dome's sheen.
function bell({ cx, cy }: { cx: number; cy: number }): FurniturePart[] {
  return [
    ellipse('panel', cx, cy + 6, 9, 2.5, T.brassDeep),
    path(
      'panel',
      `M${cx - 8} ${cy + 5}Q${cx - 8} ${cy - 4} ${cx} ${cy - 4}Q${cx + 8} ${cy - 4} ${cx + 8} ${cy + 5}Z`,
      T.brass,
    ),
    ellipse('mark', cx, cy - 5.5, 1.8, 1.8, T.brassDeep),
    path('glint', `M${cx - 5} ${cy + 2}Q${cx - 4} ${cy - 2} ${cx - 1} ${cy - 2.5}`),
  ];
}

// A curved front desk: a monitor and a plant behind it, a wood counter top that bows toward you, a pale front panel
// with a band in the piece's own colour, and a brass service bell on the counter.
const RECEPTION_DESK_FRONT: FurnitureDrawing = {
  width: 200,
  height: 112,
  parts: [
    ellipse('shadow', 100, 108, 96, 4),
    path('line', 'M144 38V46'),
    rect('panel', 124, 14, 40, 24, 2, T.console),
    rect('mark', 127, 17, 34, 18, 1, T.screen),
    ellipse('panel', 30, 30, 14, 12, T.leaf),
    rect('panel', 22, 38, 16, 12, 2, T.pot),
    path('panel', 'M4 62V104Q100 114 196 104V62Z', T.front),
    path('panel', 'M4 74H196V84H4Z'),
    path('rail', 'M50 88V104M100 89V108M150 88V104'),
    path('panel', 'M2 54Q100 36 198 54V64Q100 48 2 64Z', T.wood),
    ...bell(RECEPTION_BELLS.front),
  ],
  seats: [],
  ring: { cx: 100, cy: 100, rx: 96, ry: 8 },
};

// From behind, the receptionist's side: the counter's high ledge beyond, bowing away, with the bell on it; the work top
// nearer with the monitor's screen and the keyboard toward you and the plant at the far end; and the desk's back
// nearest you, two drawer pedestals either side of the knee space.
const RECEPTION_DESK_BACK: FurnitureDrawing = {
  width: 200,
  height: 112,
  parts: [
    ellipse('shadow', 100, 108, 96, 4),
    path('panel', 'M2 40Q100 18 198 40V50Q100 30 2 50Z', T.wood),
    ...bell(RECEPTION_BELLS.back),
    path('panel', 'M4 58Q100 44 196 58V72Q100 58 4 72Z', T.desk),
    path('line', 'M56 52V60'),
    rect('panel', 36, 26, 40, 26, 2, T.console),
    rect('mark', 39, 29, 34, 20, 1, T.screen),
    path('glint', 'M44 45L52 33M50 45L56 36'),
    rect('panel', 82, 58, 32, 6, 1.5, T.keys),
    ellipse('panel', 170, 38, 14, 12, T.leaf),
    rect('panel', 162, 46, 16, 12, 2, T.pot),
    path('panel', 'M4 70Q100 58 196 70V104Q100 96 4 104Z', T.front),
    path('mark', 'M64 66Q100 61 136 66V99Q100 95 64 99Z', T.knee),
    path('rail', 'M10 86H58M142 86H190'),
    rect('mark', 28, 77, 12, 2, 1, T.brassDeep),
    rect('mark', 160, 77, 12, 2, 1, T.brassDeep),
    rect('mark', 28, 93, 12, 2, 1, T.brassDeep),
    rect('mark', 160, 93, 12, 2, 1, T.brassDeep),
  ],
  seats: [],
  ring: { cx: 100, cy: 100, rx: 96, ry: 8 },
};

// Facing left: tall, its length down the canvas. The work top behind the counter, its near end toward you, the plant
// at its far end and the monitor near, turned to the right with the keyboard by it; along the left the curved front
// panel cheated toward you with its band, and the counter's ledge over it, the bell on it.
const RECEPTION_DESK_SIDE: FurnitureDrawing = {
  width: 112,
  height: 200,
  parts: [
    ellipse('shadow', 48, 196, 44, 4),
    rect('face', 20, 168, 64, 26, 3, T.front),
    rect('panel', 20, 20, 64, 152, 4, T.desk),
    ellipse('panel', 62, 28, 13, 11, T.leaf),
    rect('panel', 54, 36, 16, 12, 2, T.pot),
    rect('panel', 60, 132, 8, 16, 2, T.steel),
    rect('panel', 44, 116, 14, 46, 3, T.console),
    rect('mark', 51, 119, 6, 40, 1, T.screen),
    rect('panel', 68, 118, 8, 32, 1.5, T.keys),
    path('panel', 'M16 14Q-4 104 16 194H30V14Z', T.front),
    path('panel', 'M12 44Q0 104 12 164H19Q7 104 19 44Z'),
    path('panel', 'M26 8Q14 94 26 180H40Q28 94 40 8Z', T.wood),
    ...bell(RECEPTION_BELLS.side),
  ],
  seats: [],
  ring: { cx: 52, cy: 186, rx: 44, ry: 8 },
};

/** The grid pieces this module draws, for OFFICE_ART. */
export const OFFICE_WORKDAY_ART = {
  'nap-pod': { front: NAP_POD_FRONT, back: NAP_POD_BACK, side: NAP_POD_SIDE },
  treadmill: { front: TREADMILL_FRONT, back: TREADMILL_BACK, side: TREADMILL_SIDE },
  'weight-bench': { front: WEIGHT_BENCH_FRONT, back: WEIGHT_BENCH_BACK, side: WEIGHT_BENCH_SIDE },
  'phone-booth': { front: PHONE_BOOTH_FRONT, back: PHONE_BOOTH_BACK, side: PHONE_BOOTH_SIDE },
  'standing-desk': {
    front: STANDING_DESK_FRONT,
    back: STANDING_DESK_BACK,
    side: STANDING_DESK_SIDE,
  },
  'hot-desk': { front: HOT_DESK_FRONT, back: HOT_DESK_BACK, side: HOT_DESK_SIDE },
  // The bed is round: it reads the same from every side, and does not turn.
  'pet-bed': allSides(PET_BED_VIEW),
  'reception-desk': {
    front: RECEPTION_DESK_FRONT,
    back: RECEPTION_DESK_BACK,
    side: RECEPTION_DESK_SIDE,
  },
} as const;
