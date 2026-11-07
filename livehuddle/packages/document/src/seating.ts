// Seating (docs/specs/009-elements/chair.md "Facing", "Desk and sofa"): the furniture an Avatar-mode
// character sits down in. The chair, the desk and the two-seater sofa are drawn here, as one table of
// parts both renderers paint (the editor's FurnitureView and the headless svg-render-faces), so a desk
// on the canvas and a desk in an export are the same desk, and each has a drawing per facing rather
// than one drawing turned. Pure: no React, no DOM, safe in a worker.
//
// All three share `chairFacing` (where the furniture's back is) and the walk hook's arrival rule;
// what differs is the drawing, the facing it is drawn at, and how many seats it has.

import type { ChairFacing } from './collab-shapes';
import { MEETING_TABLE_ART } from './office';
import type { SeatingKind } from '@liveworkspace/avatar/office-geometry';
import { facingView, SEAT_GRIDS, type SeatGrid } from '@liveworkspace/avatar/seats';

// Which kinds seat a character, and where in each one, are the walk's questions too, so they are
// @liveworkspace/avatar's: every drawing below takes its grid and its seats from there.
export { isSeatingShape, type SeatingKind } from '@liveworkspace/avatar/office-geometry';
export {
  DEFAULT_SEATING_FACING,
  facingView,
  nearestSeat,
  seatingFacing,
  seatPoints,
} from '@liveworkspace/avatar/seats';

// The arithmetic of a turn is every piece's (furniture-facing.ts, over @liveworkspace/avatar's facing.ts).
export { facingSwapsBox, facingTurn } from '@liveworkspace/avatar/facing';

// How a part is painted, the same in both renderers:
//   shadow: the contact shadow (fixed slate, low opacity)
//   panel:  a top surface: the seat fill with the stroke round it (cushions, a desk top, a seat)
//   face:   a vertical face toward the room (a seat's front edge, a backrest's back): the panel, shaded
//   line:   an unfilled stroke (legs)
//   rail:   a faint stroke (a seam, a stand)
//   screen: the monitor's glass (the stroke colour, so it follows the theme)
//   glint:  a light reflection on the glass
//   floor:  a room's floor, in the element's fill, unstroked (docs/specs/009-elements/office.md)
//   mark:   a small unstroked mark in its own `fill`: a table's white line, a flame, a dark screen (social-pieces.md)
// A panel or face may carry its own `fill`: what keeps its colour whatever the theme (a leaf, water, coffee).
export type FurniturePartRole =
  'shadow' | 'panel' | 'face' | 'line' | 'rail' | 'screen' | 'glint' | 'floor' | 'mark';

export type FurniturePart = (
  | { tag: 'rect'; role: FurniturePartRole; x: number; y: number; w: number; h: number; rx: number }
  | { tag: 'ellipse'; role: FurniturePartRole; cx: number; cy: number; rx: number; ry: number }
  | { tag: 'path'; role: FurniturePartRole; d: string }
) & { fill?: string };

// One drawing of a piece, from the room's camera (docs/specs/009-elements/chair.md "Facing"): its grid and where
// a sitter's feet go on it, as fractions of the grid (the package's SeatGrid), and what is painted.
export type FurnitureDrawing = SeatGrid & {
  parts: readonly FurniturePart[];
  // The occupied ring, in grid units: under the seats.
  ring: { cx: number; cy: number; rx: number; ry: number };
  // Where the ring is painted among the parts: before `parts[ringUnder]`, so it lies on the seat and under
  // whatever stands nearer the camera (a backrest's back, the desk and its monitor, a sofa's arms). Left out,
  // over every part (a piece that never shows a ring: the meeting table and the office pieces).
  ringUnder?: number;
};

// A piece's three drawings: `front` with the sitter facing down the canvas ('n'), `back` facing up
// ('s'), `side` facing left ('e'); facing right ('w') is the side drawing mirrored. Nothing is ever
// rotated, so legs always stand under the piece and its shadow always falls below it.
export type FurnitureArt = {
  front: FurnitureDrawing;
  back: FurnitureDrawing;
  side: FurnitureDrawing;
};

const rect = (role: FurniturePartRole, x: number, y: number, w: number, h: number, rx: number) =>
  ({ tag: 'rect', role, x, y, w, h, rx }) as const;
const ellipse = (role: FurniturePartRole, cx: number, cy: number, rx: number, ry: number) =>
  ({ tag: 'ellipse', role, cx, cy, rx, ry }) as const;
const path = (role: FurniturePartRole, d: string) => ({ tag: 'path', role, d }) as const;

// A chair. Square enough to turn in place, so all three drawings share one grid.
export const CHAIR_ART: FurnitureArt = {
  // Facing you: the seat, its front edge, and the backrest standing behind it.
  front: {
    ...SEAT_GRIDS.chair.front,
    parts: [
      ellipse('shadow', 32, 66, 20, 4),
      path('line', 'M15 47v16M49 47v16'),
      path('rail', 'M15 57h34'),
      rect('panel', 17, 3, 30, 31, 4),
      path('rail', 'M32 8v21'),
      rect('panel', 10, 33, 44, 12, 3),
      rect('face', 10, 43, 44, 5, 2.5),
    ],
    ring: { cx: 32, cy: 40, rx: 24, ry: 10 },
    ringUnder: 6,
  },
  // Its back to you: the seat beyond, and the backrest's back nearest you, over it.
  back: {
    ...SEAT_GRIDS.chair.back,
    parts: [
      ellipse('shadow', 32, 66, 20, 4),
      path('line', 'M15 44v19M49 44v19'),
      path('rail', 'M15 57h34'),
      rect('panel', 10, 20, 44, 13, 3),
      rect('face', 17, 12, 30, 34, 4),
      path('rail', 'M32 17v24'),
    ],
    ring: { cx: 32, cy: 27, rx: 24, ry: 9 },
    ringUnder: 4,
  },
  // Facing left: the seat from above with its front edge, the backrest a bar along its right.
  side: {
    ...SEAT_GRIDS.chair.side,
    parts: [
      ellipse('shadow', 30, 66, 20, 4),
      path('line', 'M13 47v16M45 47v16'),
      path('rail', 'M13 57h32'),
      rect('panel', 8, 32, 38, 12, 3),
      rect('face', 8, 42, 38, 5, 2.5),
      rect('panel', 42, 4, 9, 43, 3),
      rect('face', 42, 41, 9, 6, 2),
    ],
    ring: { cx: 26, cy: 38, rx: 20, ry: 9 },
    ringUnder: 4,
  },
};

// A desk with a computer on it and a chair pulled up to it. Whoever sits faces the computer.
export const DESK_ART: FurnitureArt = {
  // The sitter faces you: the chair beyond the desk, the desk nearest you, and the monitor's back on it
  // (low and narrow, so the sitter is seen over it).
  front: {
    ...SEAT_GRIDS.desk.front,
    parts: [
      ellipse('shadow', 60, 102, 54, 5),
      // The chair beyond the desk: its backrest, then its seat.
      rect('panel', 41, 2, 38, 24, 5),
      path('rail', 'M60 7v14'),
      rect('panel', 32, 22, 56, 12, 3),
      // The desk: legs, its top, and the front edge toward you.
      path('line', 'M12 74v24M108 74v24'),
      rect('panel', 4, 50, 112, 16, 3),
      rect('face', 4, 64, 112, 10, 2),
      // The monitor's back on the desk, on its stand.
      rect('panel', 52, 54, 16, 4, 1.5),
      path('rail', 'M60 50v5'),
      rect('face', 40, 32, 40, 19, 4),
      path('rail', 'M48 38h24M48 44h24'),
      // A mug at the corner.
      rect('panel', 98, 46, 8, 9, 2),
    ],
    ring: { cx: 60, cy: 28, rx: 28, ry: 8 },
    ringUnder: 4,
  },
  // Its back to you: the desk at the back, the monitor's screen toward you, the chair's back nearest.
  back: {
    ...SEAT_GRIDS.desk.back,
    parts: [
      ellipse('shadow', 60, 78, 54, 5),
      path('line', 'M12 52v26M108 52v26'),
      rect('panel', 4, 38, 112, 15, 3),
      path('rail', 'M60 33v6'),
      rect('panel', 50, 37, 20, 3, 1.5),
      rect('panel', 32, 4, 56, 32, 3),
      rect('screen', 36, 8, 48, 24, 1.5),
      path('glint', 'M41 27l10-14M47 27l7-10'),
      rect('rail', 38, 42, 34, 7, 1.5),
      ellipse('rail', 82, 45.5, 3.2, 4),
      ellipse('shadow', 60, 107, 24, 3.5),
      rect('panel', 32, 66, 56, 12, 3),
      path('line', 'M42 96v10M78 96v10'),
      rect('face', 41, 74, 38, 26, 5),
      path('rail', 'M60 79v16'),
    ],
    ring: { cx: 60, cy: 72, rx: 28, ry: 9 },
    ringUnder: 13,
  },
  // Facing left: the desk a long top down the left with its near end toward you, the monitor side-on
  // and its screen toward the chair, the chair on the right with its backrest along its right.
  side: {
    ...SEAT_GRIDS.desk.side,
    parts: [
      ellipse('shadow', 56, 113, 50, 5),
      path('line', 'M12 102v14M40 102v14'),
      rect('panel', 6, 18, 40, 76, 3),
      rect('face', 6, 92, 40, 10, 2),
      // The monitor, turned toward the chair but cheated a little toward you so its screen reads: its
      // foot behind it, its body, and the glass.
      rect('panel', 9, 50, 8, 16, 2),
      path('rail', 'M13 58h4'),
      rect('panel', 15, 32, 16, 48, 3),
      rect('screen', 19, 35, 9, 42, 1.5),
      path('glint', 'M21 50l5-8M21 57l5-8'),
      // The keyboard and mouse by the chair, and a mug.
      rect('rail', 34, 44, 8, 30, 2),
      ellipse('rail', 38, 82, 3, 3.5),
      rect('panel', 33, 22, 9, 9, 2),
      // The chair.
      path('line', 'M56 82v24M88 82v24'),
      rect('panel', 52, 48, 36, 28, 4),
      rect('face', 52, 74, 36, 7, 3),
      rect('panel', 85, 34, 10, 44, 3),
      rect('face', 85, 74, 10, 7, 2),
    ],
    ring: { cx: 70, cy: 62, rx: 24, ry: 14 },
    ringUnder: 14,
  },
};

// A two-seater sofa: a long back, two arms and two cushions, so two characters sit side by side.
export const SOFA_ART: FurnitureArt = {
  // Facing you: the back behind, the arms either end, the cushions and their front edge.
  front: {
    ...SEAT_GRIDS.sofa.front,
    parts: [
      ellipse('shadow', 68, 70, 64, 4),
      path('line', 'M12 58v10M124 58v10'),
      rect('panel', 10, 4, 116, 32, 9),
      path('rail', 'M68 9v22'),
      rect('panel', 2, 24, 18, 36, 7),
      rect('panel', 116, 24, 18, 36, 7),
      rect('panel', 20, 33, 48, 16, 5),
      rect('panel', 68, 33, 48, 16, 5),
      rect('face', 20, 47, 96, 10, 4),
    ],
    ring: { cx: 68, cy: 44, rx: 56, ry: 12 },
    ringUnder: 8,
  },
  // Its back to you: the cushions beyond, the arms, and the back's broad back nearest you.
  back: {
    ...SEAT_GRIDS.sofa.back,
    parts: [
      ellipse('shadow', 68, 70, 64, 4),
      path('line', 'M12 58v10M124 58v10'),
      rect('panel', 20, 12, 48, 16, 5),
      rect('panel', 68, 12, 48, 16, 5),
      rect('panel', 2, 10, 18, 46, 7),
      rect('panel', 116, 10, 18, 46, 7),
      rect('face', 10, 22, 116, 38, 9),
      path('rail', 'M68 27v28'),
    ],
    ring: { cx: 68, cy: 20, rx: 56, ry: 10 },
    ringUnder: 4,
  },
  // Facing left: tall, its two cushions one above the other, the back a long bar on the right, the
  // arms at either end, and its legs only under its lower end.
  side: {
    ...SEAT_GRIDS.sofa.side,
    parts: [
      ellipse('shadow', 38, 131, 34, 4),
      path('line', 'M12 124v8M64 124v8'),
      rect('panel', 50, 6, 20, 114, 8),
      rect('panel', 14, 22, 38, 44, 5),
      rect('panel', 14, 66, 38, 44, 5),
      rect('panel', 6, 4, 64, 20, 7),
      rect('panel', 6, 106, 64, 16, 7),
      rect('face', 6, 118, 64, 7, 3),
    ],
    ring: { cx: 33, cy: 66, rx: 24, ry: 48 },
    ringUnder: 5,
  },
};

export const FURNITURE_ART: Record<SeatingKind, FurnitureArt> = {
  chair: CHAIR_ART,
  desk: DESK_ART,
  sofa: SOFA_ART,
  'meeting-table': MEETING_TABLE_ART,
};

// Stroke widths, in grid units.
export const FURNITURE_PANEL_STROKE = 2;
export const FURNITURE_LINE_STROKE = 2.5;
export const FURNITURE_RAIL_STROKE = 1.5;
export const FURNITURE_RAIL_OPACITY = 0.55;
export const FURNITURE_SHADOW = { fill: '#0f172a', opacity: 0.12 } as const;
export const FURNITURE_GLINT = { stroke: '#ffffff', opacity: 0.35 } as const;
// How much of the stroke colour shades a face toward the room, over the seat fill.
export const FURNITURE_FACE_SHADE = 0.22;

/** The drawing a piece shows at a facing: its grid as a viewBox, and the mirror for facing right. */
export function furnitureFrame(
  art: FurnitureArt,
  facing: ChairFacing,
): { viewBox: string; transform: string; view: FurnitureDrawing } {
  const { view: name, mirrored } = facingView(facing);
  const view = art[name];
  return {
    viewBox: `0 0 ${view.width} ${view.height}`,
    transform: mirrored ? `translate(${view.width} 0) scale(-1 1)` : '',
    view,
  };
}
