// The Space's wayfinding pieces (docs/specs/009-elements/directory.md, elevator.md): the Directory stand and the
// Elevator, drawn as tables of parts in the furniture's vocabulary (seating.ts), upright from the room's camera like
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

export const WAYFINDING_ART = {
  directory: allSides(DIRECTORY_VIEW),
  elevator: allSides(ELEVATOR_VIEW),
} as const;
