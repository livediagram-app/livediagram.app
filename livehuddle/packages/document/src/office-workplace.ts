// The office amenities' workplace kit (docs/specs/009-elements/office-amenities.md "Printer, Copier", "Lockers, Coat
// Rack, Umbrella Stand"): drawings in the furniture's vocabulary (seating.ts), upright from the room's camera like the
// rest of the office, which both renderers paint (the editor's views and svg-render-faces). They join OFFICE_ART
// (office.ts). The footprints are @liveworkspace/avatar's. Pure: no React, no DOM.

import type { FurnitureDrawing, FurniturePart } from './seating';
import { allSides, ellipse, path, rect } from './furniture-parts';

// Fixed colours, as SOCIAL_TONES: paper, the lit screens, the lockers' paint, wood, cloth and the umbrellas' canopies.
// A machine's body has none: it takes the piece's own colour, else a wash of the theme's stroke.
export const WORKPLACE_TONES = {
  paper: '#ffffff',
  screen: '#0f172a',
  lit: '#38bdf8',
  ready: '#22c55e',
  handle: '#334155',
  lockerA: '#60a5fa',
  lockerB: '#3b82f6',
  plate: '#f8fafc',
  wood: '#c2894b',
  woodDeep: '#92400e',
  navy: '#1e3a8a',
  camel: '#c8924f',
  scarf: '#dc2626',
  stripe: '#fde68a',
  hat: '#57534e',
  umbrellaRed: '#ef4444',
  umbrellaNavy: '#1d4ed8',
  umbrellaYellow: '#facc15',
} as const;

const T = WORKPLACE_TONES;

// --- The print corner ---------------------------------------------------------------------------------------------

// A desktop laser printer on a small two-drawer cabinet: a printed sheet rising from its output well, a status screen
// and a green light.
const PRINTER_VIEW: FurnitureDrawing = {
  width: 72,
  height: 80,
  parts: [
    ellipse('shadow', 36, 77, 31, 3),
    rect('face', 10, 44, 52, 31, 3),
    path('rail', 'M14 59.5h44'),
    rect('mark', 30, 50, 12, 2.5, 1.25, T.handle),
    rect('mark', 30, 65, 12, 2.5, 1.25, T.handle),
    path('panel', 'M19 4H47L50 22H16Z', T.paper),
    path('rail', 'M22 9H40M21.5 13H44M21 17H35'),
    rect('panel', 6, 20, 60, 26, 5),
    rect('face', 12, 20, 48, 6, 2),
    path('rail', 'M13 38H42'),
    rect('mark', 46, 30, 14, 7, 1.5, T.screen),
    rect('mark', 48, 32, 7, 2, 0.75, T.lit),
    ellipse('mark', 53, 41, 1.6, 1.6, T.ready),
    path('glint', 'M10 32V26'),
  ],
  seats: [],
  ring: { cx: 36, cy: 70, rx: 30, ry: 7 },
};

// A floor-standing copier: originals on the lid, a control panel with a lit touch screen, a stack of copies in the
// output bay and three paper trays on small feet.
const COPIER_VIEW: FurnitureDrawing = {
  width: 104,
  height: 128,
  parts: [
    ellipse('shadow', 52, 124, 46, 3.5),
    path('line', 'M18 118v4M86 118v4'),
    rect('panel', 12, 62, 80, 56, 4),
    ...[66, 83, 100].flatMap((y) => [
      rect('face', 16, y, 72, 14, 2),
      rect('mark', 44, y + 5, 16, 3, 1.5, T.handle),
    ]),
    rect('panel', 8, 30, 88, 34, 5),
    rect('face', 16, 38, 50, 18, 3),
    rect('panel', 22, 46, 38, 7, 1, T.paper),
    path('rail', 'M25 49.5H57'),
    rect('panel', 6, 18, 76, 14, 4),
    rect('panel', 16, 8, 46, 11, 2, T.paper),
    path('rail', 'M20 12H52M20 15.5H44'),
    path('glint', 'M12 22H40'),
    rect('panel', 72, 20, 28, 20, 3),
    rect('mark', 76, 23, 20, 12, 2, T.screen),
    rect('mark', 78, 25, 11, 3, 1, T.lit),
    rect('mark', 78, 30, 7, 2.5, 1, T.lit),
    ellipse('mark', 92, 31, 1.6, 1.6, T.ready),
  ],
  seats: [],
  ring: { cx: 52, cy: 112, rx: 46, ry: 9 },
};

// --- By the door --------------------------------------------------------------------------------------------------

// The four lockers' left edges, each 28 wide.
const LOCKER_DOORS = [9, 39, 69, 99] as const;

// A bank of four tall lockers in alternating blues on a plinth: vent slits, a number plate and a handle on each door.
const LOCKERS_VIEW: FurnitureDrawing = {
  width: 136,
  height: 132,
  parts: [
    ellipse('shadow', 68, 128, 64, 4),
    rect('panel', 4, 4, 128, 118, 3),
    ...LOCKER_DOORS.map((x, i) => rect('panel', x, 9, 28, 104, 2, i % 2 ? T.lockerB : T.lockerA)),
    path('rail', LOCKER_DOORS.map((x) => `M${x + 6} 17h16M${x + 6} 21h16M${x + 6} 25h16`).join('')),
    path('mark', LOCKER_DOORS.map((x) => `M${x + 9} 33h10v6h-10z`).join(''), T.plate),
    path('mark', LOCKER_DOORS.map((x) => `M${x + 21} 58h3v15h-3z`).join(''), T.handle),
    path('glint', LOCKER_DOORS.map((x) => `M${x + 4} 106V46`).join('')),
    rect('face', 4, 113, 128, 9, 2),
  ],
  seats: [],
  ring: { cx: 68, cy: 118, rx: 64, ry: 8 },
};

// A wooden coat stand on a cross foot: a navy coat and a camel coat on its hooks, a striped scarf over the pole and a
// hat on top.
const COAT_RACK_VIEW: FurnitureDrawing = {
  width: 56,
  height: 128,
  parts: [
    ellipse('shadow', 28, 125, 22, 2.5),
    path('line', 'M10 125L28 114L46 125'),
    rect('panel', 26, 12, 4, 106, 2, T.wood),
    path('line', 'M28 22C21 22 17 25 17 30M28 22C35 22 39 25 39 30'),
    path(
      'panel',
      'M17 27C12 27 9 31 9 37L7 87C7 90 9 91 12 91H23C26 91 27 89 26 86L23 35C22.5 30 20 27 17 27Z',
      T.navy,
    ),
    path('rail', 'M18 32L20 88'),
    path(
      'panel',
      'M39 27C44 27 47 31 47 37L49 83C49 86 47 87 44 87H33C31 87 30 85 31 82L34 35C34.5 30 36 27 39 27Z',
      T.camel,
    ),
    path('mark', 'M38 46h2.5v2.5H38zM38.5 58h2.5v2.5h-2.5zM39 70h2.5v2.5H39z', T.woodDeep),
    path('panel', 'M13.5 27H20.5V54L17 51.5L13.5 54Z', T.scarf),
    path('mark', 'M13.5 38h7v2.5h-7zM13.5 45h7v2.5h-7z', T.stripe),
    rect('panel', 20, 3, 16, 9, 4, T.hat),
    ellipse('panel', 28, 12, 13, 2.5, T.hat),
  ],
  seats: [],
  ring: { cx: 28, cy: 118, rx: 20, ry: 6 },
};

// One furled umbrella: its canopy from the stand up to its tip, its shaft and a hooked handle.
const umbrella = (canopy: string, handle: string, fill: string): FurniturePart[] => [
  path('panel', canopy, fill),
  path('line', handle),
];

// A round stand with three furled umbrellas (red, navy and yellow), their hooked handles up.
const UMBRELLA_STAND_VIEW: FurnitureDrawing = {
  width: 40,
  height: 64,
  parts: [
    ellipse('shadow', 20, 61, 16, 2.5),
    ...umbrella('M13 36L8.5 15L12.5 13.5L17 35Z', 'M10.5 14.5L9 9C8 5 3 6 4 10', T.umbrellaRed),
    ...umbrella('M18 36L18.5 12H22L22.5 36Z', 'M20.25 12V6C20.25 2.5 26 2.5 26 6', T.umbrellaNavy),
    ...umbrella(
      'M23 36L28 15L32 16.5L27 37Z',
      'M30 15.5L31.5 10C32.5 6.5 37 7.5 36 11',
      T.umbrellaYellow,
    ),
    rect('panel', 8, 31, 24, 28, 4),
    ellipse('face', 20, 32, 12, 3),
    path('rail', 'M9 51H31'),
    path('glint', 'M12 37V48'),
  ],
  seats: [],
  ring: { cx: 20, cy: 56, rx: 15, ry: 5 },
};

/** The grid pieces this module draws, for OFFICE_ART. */
export const OFFICE_WORKPLACE_ART = {
  printer: allSides(PRINTER_VIEW),
  copier: allSides(COPIER_VIEW),
  lockers: allSides(LOCKERS_VIEW),
  'coat-rack': allSides(COAT_RACK_VIEW),
  'umbrella-stand': allSides(UMBRELLA_STAND_VIEW),
} as const;
