// The workday pieces (docs/specs/009-elements/workday-pieces.md): the Nap Pod, the Treadmill and the Weight Bench, the
// Phone Booth, the Standing Desk and the Hot Desk, the Pet Bed and the Reception Desk. Drawings in the furniture's
// vocabulary (seating.ts), upright from the room's camera like the rest of the office, which both renderers paint (the
// editor's views and svg-render-faces). Their seats and the desk's footprint are @liveworkspace/avatar's; the live
// parts (the running belt, the booth's lamp, the hot desk's card, the bell's ring and the dog) are the editor's, laid
// over these at the grid spots named here. Pure: no React, no DOM.

import type { FurnitureDrawing } from './seating';
import { allSides, ellipse, path, rect } from './furniture-parts';
import {
  HOT_DESK_SEATS,
  NAP_POD_SEATS,
  PHONE_BOOTH_SEATS,
  STANDING_DESK_SEATS,
  TREADMILL_SEATS,
  WEIGHT_BENCH_SEATS,
} from '@liveworkspace/avatar/seats';

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
  leaf: '#4ade80',
  pot: '#ea580c',
  brass: '#e0b232',
  brassDeep: '#a16207',
} as const;

const T = WORKDAY_TONES;

const seatsOf = (grid: { seats: readonly { u: number; v: number }[] }) =>
  grid.seats.map(({ u, v }) => ({ u, v }));

// --- Rest -----------------------------------------------------------------------------------------------------------

// A cocoon lounger: a pale shell whose hood arches over a reclined cushion, a lining inside, a pillow, a blanket over
// the sitter's legs and a reading lamp in the hood.
const NAP_POD_VIEW: FurnitureDrawing = {
  width: NAP_POD_SEATS.width,
  height: NAP_POD_SEATS.height,
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
  seats: seatsOf(NAP_POD_SEATS),
  // Round the cushion, under the blanket, so it shows either side of a sitter.
  ring: { cx: 60, cy: 80, rx: 40, ry: 8 },
  ringUnder: 8,
};

// --- The gym corner -------------------------------------------------------------------------------------------------

/** The treadmill's belt on its grid: where the editor runs its stripes while someone is on it. */
export const TREADMILL_BELT = { x: 14, y: 44, w: 44, h: 56 } as const;

// A running machine seen from behind its user: a dark belt between two side rails, the uprights, the handlebar and the
// console with its readout at the top, and the rear roller nearest you.
const TREADMILL_VIEW: FurnitureDrawing = {
  width: TREADMILL_SEATS.width,
  height: TREADMILL_SEATS.height,
  parts: [
    ellipse('shadow', 36, 108, 34, 4),
    path('line', 'M14 42V20M58 42V20'),
    rect('panel', 8, 40, 56, 66, 6, T.frame),
    rect('mark', TREADMILL_BELT.x, TREADMILL_BELT.y, TREADMILL_BELT.w, TREADMILL_BELT.h, 3, T.belt),
    path('rail', 'M16 58H56M16 72H56M16 86H56'),
    rect('panel', 8, 40, 6, 66, 3, T.rail),
    rect('panel', 58, 40, 6, 66, 3, T.rail),
    rect('face', 8, 100, 56, 6, 3, T.frame),
    path('line', 'M6 24H66'),
    rect('panel', 12, 8, 48, 14, 4, T.console),
    rect('mark', 22, 11, 28, 7, 1.5, T.readout),
  ],
  seats: seatsOf(TREADMILL_SEATS),
  ring: { cx: 36, cy: 90, rx: 24, ry: 7 },
  ringUnder: 4,
};

// A padded flat bench with a barbell on a rack at its head, plates on each end, and a pair of dumbbells on the floor.
const WEIGHT_BENCH_VIEW: FurnitureDrawing = {
  width: WEIGHT_BENCH_SEATS.width,
  height: WEIGHT_BENCH_SEATS.height,
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
  seats: seatsOf(WEIGHT_BENCH_SEATS),
  ring: { cx: 80, cy: 58, rx: 30, ry: 7 },
  ringUnder: 8,
};

// --- Calls ----------------------------------------------------------------------------------------------------------

/** The phone booth's lamp on its grid: lit red by the editor while the booth is in use. */
export const PHONE_BOOTH_LAMP = { x: 18, y: 4, w: 44, h: 6 } as const;

// A booth for one: an oak roof with its lamp, oak sides, a felt back wall in acoustic panels, a shelf with a phone on
// it, a stool, an oak sill, and the glass front's glints.
const PHONE_BOOTH_VIEW: FurnitureDrawing = {
  width: PHONE_BOOTH_SEATS.width,
  height: PHONE_BOOTH_SEATS.height,
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
    path('glint', 'M16 40L28 28M16 58L40 34M54 120L66 108'),
  ],
  seats: seatsOf(PHONE_BOOTH_SEATS),
  ring: { cx: 40, cy: 112, rx: 22, ry: 5 },
  ringUnder: 7,
};

// --- Desks ----------------------------------------------------------------------------------------------------------

// A tall desk on a steel frame: two legs on wide feet and a crossbar, a pale wood top, a monitor and a keyboard on it,
// and its height buttons at the right.
const STANDING_DESK_VIEW: FurnitureDrawing = {
  width: STANDING_DESK_SEATS.width,
  height: STANDING_DESK_SEATS.height,
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
  seats: seatsOf(STANDING_DESK_SEATS),
  ring: { cx: 56, cy: 96, rx: 24, ry: 5 },
};

/** The hot desk's name card on its grid: the editor writes the sitter's name on it. */
export const HOT_DESK_CARD = { x: 72, y: 38, w: 40, h: 12 } as const;

// A desk with a chair in front of it: the top in the piece's own colour, a monitor and a laptop dock, a name card
// standing on its front edge, and the chair, its back toward you (its sitter faces the monitor).
const HOT_DESK_VIEW: FurnitureDrawing = {
  width: HOT_DESK_SEATS.width,
  height: HOT_DESK_SEATS.height,
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
    rect('panel', HOT_DESK_CARD.x, HOT_DESK_CARD.y, HOT_DESK_CARD.w, HOT_DESK_CARD.h, 2, T.card),
    path('line', 'M60 98V108'),
    rect('panel', 40, 76, 40, 10, 4),
    rect('panel', 42, 86, 36, 14, 5),
  ],
  seats: seatsOf(HOT_DESK_SEATS),
  ring: { cx: 60, cy: 84, rx: 26, ry: 6 },
  ringUnder: 12,
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

/** The reception desk's bell on its grid: where the editor rings out its ding. */
export const RECEPTION_BELL = { cx: 70, cy: 44 } as const;

// A curved front desk: a monitor and a plant behind it, a wood counter top that bows toward you, a pale front panel
// with a band in the piece's own colour, and a brass service bell on the counter.
const RECEPTION_DESK_VIEW: FurnitureDrawing = {
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
    ellipse('panel', RECEPTION_BELL.cx, RECEPTION_BELL.cy + 6, 9, 2.5, T.brassDeep),
    path(
      'panel',
      `M${RECEPTION_BELL.cx - 8} ${RECEPTION_BELL.cy + 5}Q${RECEPTION_BELL.cx - 8} ${RECEPTION_BELL.cy - 4} ${RECEPTION_BELL.cx} ${RECEPTION_BELL.cy - 4}Q${RECEPTION_BELL.cx + 8} ${RECEPTION_BELL.cy - 4} ${RECEPTION_BELL.cx + 8} ${RECEPTION_BELL.cy + 5}Z`,
      T.brass,
    ),
    ellipse('mark', RECEPTION_BELL.cx, RECEPTION_BELL.cy - 5.5, 1.8, 1.8, T.brassDeep),
    path(
      'glint',
      `M${RECEPTION_BELL.cx - 5} ${RECEPTION_BELL.cy + 2}Q${RECEPTION_BELL.cx - 4} ${RECEPTION_BELL.cy - 2} ${RECEPTION_BELL.cx - 1} ${RECEPTION_BELL.cy - 2.5}`,
    ),
  ],
  seats: [],
  ring: { cx: 100, cy: 100, rx: 96, ry: 8 },
};

/** The grid pieces this module draws, for OFFICE_ART. */
export const OFFICE_WORKDAY_ART = {
  'nap-pod': allSides(NAP_POD_VIEW),
  treadmill: allSides(TREADMILL_VIEW),
  'weight-bench': allSides(WEIGHT_BENCH_VIEW),
  'phone-booth': allSides(PHONE_BOOTH_VIEW),
  'standing-desk': allSides(STANDING_DESK_VIEW),
  'hot-desk': allSides(HOT_DESK_VIEW),
  'pet-bed': allSides(PET_BED_VIEW),
  'reception-desk': allSides(RECEPTION_DESK_VIEW),
} as const;
