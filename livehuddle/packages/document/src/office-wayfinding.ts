// The Space's wayfinding pieces (docs/specs/009-elements/directory.md, elevator.md, stairs.md): the Directory stand,
// the Elevator and the Stairs, drawn as tables of parts in the furniture's vocabulary (seating.ts), upright from the room's camera like
// the rest of the office, so the canvas (FurnitureView) and an export (svg-render-faces) paint the same piece. What
// they do (the list of rooms, the floor panel) is the editor's. Pure: no React, no DOM.

import type { FurnitureDrawing } from './seating';
import { allSides, ellipse, path, rect } from './furniture-parts';

// Fixed colours, as OFFICE_TONES: the sign's blue, the room dots, the elevator's steel and its display. Outlines
// stay the theme's stroke, so both pieces sit in the same drawing style on light and dark paper.
export const WAYFINDING_TONES = {
  sign: '#2563eb',
  dots: ['#f59e0b', '#10b981', '#8b5cf6', '#ef4444'],
  white: '#ffffff',
  steel: '#cbd5e1',
  steelDeep: '#94a3b8',
  steelDark: '#64748b',
  display: '#1e293b',
  lamp: '#fbbf24',
  // The Stairs' stone: a tread's top lit, a riser's front in shade.
  tread: '#f5f5f4',
  riser: '#c7c2bd',
} as const;

const T = WAYFINDING_TONES;

// The Directory: a freestanding stand on a post and a plinth, a blue sign across its head with an "i" dot and a
// title, and a board of rooms, each a coloured dot and a line of text.
const DIRECTORY_ROWS = [36, 48, 60, 72] as const;
const DIRECTORY_ROW_ENDS = [58, 52, 56, 48] as const;
const DIRECTORY_VIEW: FurnitureDrawing = {
  width: 72,
  height: 124,
  parts: [
    ellipse('shadow', 36, 120, 26, 3.5),
    rect('face', 16, 108, 40, 10, 3),
    rect('face', 31, 86, 10, 24, 2),
    rect('panel', 4, 6, 64, 84, 6),
    path('panel', 'M10 6h52a6 6 0 0 1 6 6v14H4V12a6 6 0 0 1 6-6z', T.sign),
    ellipse('panel', 14, 16, 4.5, 4.5, T.white),
    path('line', 'M14 15v3.5'),
    path('glint', 'M24 13.5h30M24 18.5h20'),
    ...DIRECTORY_ROWS.flatMap((y, i) => [
      ellipse('panel', 14, y, 3, 3, T.dots[i]),
      path('rail', `M22 ${y}H${DIRECTORY_ROW_ENDS[i]}`),
    ]),
    path('rail', 'M10 82h52'),
  ],
  seats: [],
  ring: { cx: 36, cy: 114, rx: 30, ry: 7 },
};

// The Elevator: a lift set into a wall, seen from the front: its surround, a floor display with an up arrow over
// the doors, two brushed-steel doors meeting in the middle, a call panel beside them and the threshold.
const ELEVATOR_VIEW: FurnitureDrawing = {
  width: 112,
  height: 140,
  parts: [
    ellipse('shadow', 56, 136, 50, 3.5),
    rect('face', 6, 14, 100, 120, 4),
    rect('panel', 34, 2, 44, 16, 4, T.display),
    path('panel', 'M41 13l4-6 4 6z', T.lamp),
    rect('panel', 54, 7, 16, 6, 1.5, T.lamp),
    rect('panel', 14, 22, 72, 112, 2, T.steelDark),
    rect('panel', 17, 25, 32, 109, 1, T.steel),
    rect('panel', 51, 25, 32, 109, 1, T.steel),
    path('rail', 'M50 25v109'),
    path('glint', 'M24 34v44M58 34v44'),
    rect('panel', 90, 62, 10, 26, 3, T.steel),
    ellipse('panel', 95, 69, 2.6, 2.6, T.lamp),
    ellipse('panel', 95, 80, 2.6, 2.6, T.white),
    rect('panel', 12, 130, 76, 5, 1.5, T.steelDeep),
  ],
  seats: [],
  ring: { cx: 56, cy: 128, rx: 50, ry: 8 },
};

// The Stairs (docs/specs/009-elements/stairs.md): a flight of seven steps rising away from you, narrowing as it goes,
// between two side walls that lean in with it, each step a lit tread over a shaded riser, a handrail along each wall
// with a newel cap at its foot, the landing at the top opening dark onto the floor above, and a blue sign over it with
// an up and a down arrow.
const STAIRS_STEPS = 7;
const STAIRS_LANDING = 28;
const STAIRS_STEP = 13;
const STAIRS_FOOT = STAIRS_LANDING + STAIRS_STEPS * STAIRS_STEP;
// The flight's sides: 16..80 at its foot, 26..70 at the landing, straight between.
const stairsSide = (y: number): [number, number] => {
  const t = (STAIRS_FOOT - y) / (STAIRS_FOOT - STAIRS_LANDING);
  return [16 + 10 * t, 80 - 10 * t];
};
// One band of the flight between two heights, as wide as the flight there.
const band = (y0: number, y1: number): string => {
  const [a0, b0] = stairsSide(y0);
  const [a1, b1] = stairsSide(y1);
  return `M${a0} ${y0}H${b0}L${b1} ${y1}H${a1}z`;
};
const STAIRS_VIEW: FurnitureDrawing = {
  width: 96,
  height: 128,
  parts: [
    ellipse('shadow', 48, 124, 44, 3.5),
    path('face', 'M4 122h12l10-108h-8z'),
    path('face', 'M92 122h-12l-10-108h8z'),
    rect('panel', 24, 14, 48, STAIRS_LANDING - 14, 1, T.display),
    ...Array.from({ length: STAIRS_STEPS }, (_, k) => {
      const y = STAIRS_LANDING + k * STAIRS_STEP;
      return [path('panel', band(y, y + 5), T.tread), path('face', band(y + 5, y + 13), T.riser)];
    }).flat(),
    path('line', 'M10 116l11-96M86 116l-11-96'),
    ellipse('panel', 10, 116, 3.5, 3.5),
    ellipse('panel', 86, 116, 3.5, 3.5),
    rect('panel', 32, 2, 32, 14, 4, T.sign),
    path('mark', 'M37.5 12l4.5-6.5 4.5 6.5z', T.white),
    path('mark', 'M49.5 5.5l4.5 6.5 4.5-6.5z', T.white),
  ],
  seats: [],
  ring: { cx: 48, cy: 118, rx: 42, ry: 7 },
};

/** Where a character climbing the Stairs ends up: its feet on the flight's second step from the top, as a share of
 * the piece's height (the drawing's 128 grid), centred across it. */
export const STAIRS_TOP_SHARE = (STAIRS_LANDING + STAIRS_STEP + 5) / 128;

export const WAYFINDING_ART = {
  directory: allSides(DIRECTORY_VIEW),
  elevator: allSides(ELEVATOR_VIEW),
  stairs: allSides(STAIRS_VIEW),
} as const;
