// The furniture's drawings (docs/specs/009-elements/furniture-facing.md, chair.md
// "Facing"): one table of parts per piece, drawn upright from the room's camera, which every renderer paints (each
// editor's FurnitureView and the headless svg-render-faces), so a piece on the canvas and in an export is
// the same piece. A piece has a `front`, a `back` and a `side` drawing, and facing right is the side mirrored. The
// shared pieces live here (the Chair, Desk, Sofa, Meeting Table, Plant, Bookshelf, Water Cooler, Coffee
// Machine and Rug); a product's own pieces stay in its document package, drawn with the same vocabulary. Pure: no
// React, no DOM, safe in a worker.

import type { Rect } from '@liveworkspace/model-core/geometry-primitives';
import { facingView, turnedBox, type SeatFacing, type SeatView } from './facing';
import {
  longTableLength,
  longTableSeatViews,
  longTableSideXs,
  longTableSideYs,
  MEETING_TABLE_SEATS,
  MEETING_TABLE_SEATS_BACK,
  MEETING_TABLE_SEATS_SIDE,
  SEAT_GRIDS,
  type SeatGrid,
  type TableSeat,
} from './seats';

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
//   tint:   a pattern woven darker into the fill: the stroke, faint, unstroked (a rug's bands, office.md "Rug types")
//   sheen:  a pattern woven lighter into the fill: white, faint, unstroked
//   dye:    a pattern in its own `fill`, half seen through the rug's fill, unstroked (a Persian's crimson)
// A panel or face may carry its own `fill`: what keeps its colour whatever the theme (a leaf, water, coffee).
export type FurniturePartRole =
  | 'shadow'
  | 'panel'
  | 'face'
  | 'line'
  | 'rail'
  | 'screen'
  | 'glint'
  | 'floor'
  | 'mark'
  | 'tint'
  | 'sheen'
  | 'dye';

export type FurniturePart = (
  | { tag: 'rect'; role: FurniturePartRole; x: number; y: number; w: number; h: number; rx: number }
  | { tag: 'ellipse'; role: FurniturePartRole; cx: number; cy: number; rx: number; ry: number }
  | { tag: 'path'; role: FurniturePartRole; d: string }
) & { fill?: string };

// One drawing of a piece, from the room's camera (docs/specs/009-elements/chair.md "Facing"): its grid and where
// a sitter's feet go on it, as fractions of the grid (the package's SeatGrid), and what is painted.
export type FurnitureDrawing = SeatGrid & {
  parts: readonly FurniturePart[];
  /** How the 3D view builds it rather than standing it up whole (furniture-rows.ts); absent: it stands whole. */
  rows3D?: readonly FurnitureRow3D[];
};

/**
 * One row of a piece built in the 3D view (livehuddle 3d-view.md "Tables are built, not stood"), by part index: a
 * `stand` row (a chair) stands up about its own lowest point; a `top` row lies its `slab` (a table's top, a bench's
 * seat) level at its height, held up by its `skirt` (its front edge and legs), which stands from the floor to it.
 */
export type FurnitureRow3D =
  | { kind: 'stand'; parts: readonly number[] }
  | { kind: 'top'; slab: readonly number[]; skirt: readonly number[] };

// A piece's three drawings: `front` with the sitter facing down the canvas ('n'), `back` facing up
// ('s'), `side` facing left ('e'); facing right ('w') is the side drawing mirrored. Nothing is ever
// rotated, so legs always stand under the piece and its shadow always falls below it.
export type FurnitureArt = {
  front: FurnitureDrawing;
  back: FurnitureDrawing;
  side: FurnitureDrawing;
};

// The part builders every drawing is written with: one rect, ellipse or path in the vocabulary above, with its own
// fill or none (the seat's colour).
export const rect = (
  role: FurniturePartRole,
  x: number,
  y: number,
  w: number,
  h: number,
  rx: number,
  fill?: string,
): FurniturePart => ({ tag: 'rect', role, x, y, w, h, rx, ...(fill ? { fill } : {}) });

export const ellipse = (
  role: FurniturePartRole,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  fill?: string,
): FurniturePart => ({ tag: 'ellipse', role, cx, cy, rx, ry, ...(fill ? { fill } : {}) });

export const path = (role: FurniturePartRole, d: string, fill?: string): FurniturePart => ({
  tag: 'path',
  role,
  d,
  ...(fill ? { fill } : {}),
});

// Pieces the 3D view builds row by row (furniture-rows.ts): a drawing written as groups, each a row, so its paint
// order is the flat plan's and the 3D view knows which parts stand where.
/** One group of a drawing: lying on the floor (`flat`, a shadow), a chair (`stand`) or a top on legs (`top`). */
export type FurnitureGroup =
  | { flat: readonly FurniturePart[] }
  | { stand: readonly FurniturePart[] }
  | {
      top: readonly FurniturePart[];
    };

// In a top's group its front edge and its legs hold it up; the rest (its top, what lies on it) is the slab.
const holdsUp = (p: FurniturePart) => p.role === 'face' || p.role === 'line';

/** The drawing's parts in the groups' order, and its rows. */
export function rowed(groups: readonly FurnitureGroup[]): {
  parts: FurniturePart[];
  rows3D: FurnitureRow3D[];
} {
  const parts: FurniturePart[] = [];
  const rows3D: FurnitureRow3D[] = [];
  for (const g of groups) {
    const from = parts.length;
    if ('flat' in g) {
      parts.push(...g.flat);
    } else if ('stand' in g) {
      parts.push(...g.stand);
      rows3D.push({ kind: 'stand', parts: g.stand.map((_, i) => from + i) });
    } else {
      parts.push(...g.top);
      const slab: number[] = [];
      const skirt: number[] = [];
      g.top.forEach((p, i) => (holdsUp(p) ? skirt : slab).push(from + i));
      rows3D.push({ kind: 'top', slab, skirt });
    }
  }
  return { parts, rows3D };
}

/** A drawing that reads the same from every side, so every facing shows it. */
export const allSides = (view: FurnitureDrawing): FurnitureArt => ({
  front: view,
  back: view,
  side: view,
});

// The seating's materials (docs/specs/009-elements/furniture-art-style.md "Materials"): what stays its own colour
// whatever the theme. The upholstery is the seat colour (the element's fill, or the kind's fabric when it has none:
// SEAT_FABRIC), so recolouring a chair recolours its cushions and never its wood.
export const SEATING_TONES = {
  wood: '#b98352',
  woodLight: '#cf9d6b',
  woodDeep: '#7c4f2c',
  metal: '#59616d',
  metalDeep: '#3a4049',
  monitor: '#363c46',
  screen: '#1d3557',
  screenLit: '#5b9bd5',
  paper: '#f4efe4',
  mug: '#ece6da',
  coffee: '#6b4423',
  keys: '#d6dae0',
  pillow: '#e0a943',
} as const;

/** Each seating kind's upholstery when the element has no fill of its own. */
export const SEAT_FABRIC = {
  chair: '#6a87ad',
  desk: '#4d5664',
  sofa: '#61809f',
  'meeting-table': '#4d5664',
} as const;

const S = SEATING_TONES;

/** A seating piece's upholstery: the element's own fill, or its kind's fabric when it has none (or `transparent`). */
export function seatFabric(kind: keyof typeof SEAT_FABRIC, fillColor: string | undefined): string {
  return fillColor && fillColor !== 'transparent' ? fillColor : SEAT_FABRIC[kind];
}

// A chair: a wooden frame with an upholstered seat and backrest. Square enough to turn in place, so all three
// drawings share one grid.
export const CHAIR_ART: FurnitureArt = {
  // Facing you: the back legs, the backrest's frame and cushion, the seat, its wooden apron and the front legs.
  front: {
    ...SEAT_GRIDS.chair.front,
    parts: [
      ellipse('shadow', 32, 66, 22, 4.5),
      path('line', 'M17 46v16M47 46v16', S.woodDeep),
      rect('panel', 15, 2, 34, 33, 6, S.wood),
      rect('panel', 19, 6, 26, 25, 4.5),
      path('rail', 'M32 10v17'),
      rect('panel', 9, 32, 46, 13, 4.5),
      rect('face', 9, 43, 46, 6, 3, S.wood),
      path('glint', 'M15 34.5h34M23 8h18'),
      path('line', 'M13 48v16M51 48v16', S.wood),
    ],
  },
  // Its back to you: the seat beyond, and the backrest's wooden back nearest you, over it.
  back: {
    ...SEAT_GRIDS.chair.back,
    parts: [
      ellipse('shadow', 32, 66, 22, 4.5),
      path('line', 'M14 44v18M50 44v18', S.woodDeep),
      rect('panel', 10, 20, 44, 13, 4.5),
      rect('face', 10, 31, 44, 5, 2.5, S.wood),
      rect('face', 15, 10, 34, 36, 6, S.wood),
      path('rail', 'M22 17v22M32 17v22M42 17v22', S.woodDeep),
      path('glint', 'M19 12.5h26'),
      path('line', 'M18 46v17M46 46v17', S.wood),
    ],
  },
  // Facing left: the seat from above with its apron, the backrest a bar of wood and cushion along its right.
  side: {
    ...SEAT_GRIDS.chair.side,
    parts: [
      ellipse('shadow', 30, 66, 22, 4.5),
      path('line', 'M15 47v15M43 47v15', S.woodDeep),
      rect('panel', 8, 32, 38, 12, 4),
      rect('face', 8, 42, 38, 5, 2.5, S.wood),
      rect('panel', 42, 4, 10, 43, 4, S.wood),
      rect('panel', 43.5, 8, 6, 30, 3),
      rect('face', 42, 41, 10, 6, 2.5, S.wood),
      path('glint', 'M12 34h30'),
      path('line', 'M11 47v17M47 47v17', S.wood),
    ],
  },
};

// A desk with a computer on it and an office chair pulled up to it. Whoever sits faces the computer. The desk is
// wood on steel legs; the chair is upholstered in the seat colour.
export const DESK_ART: FurnitureArt = {
  // The sitter faces you: the chair beyond the desk, the desk nearest you, and the monitor's back on it (low and
  // narrow, so the sitter is seen over it), a notebook and a mug.
  front: {
    ...SEAT_GRIDS.desk.front,
    parts: [
      ellipse('shadow', 60, 102, 56, 5.5),
      rect('panel', 41, 2, 38, 25, 7),
      path('rail', 'M60 7v15'),
      rect('panel', 32, 22, 56, 12, 4.5),
      path('line', 'M12 72v26M108 72v26', S.metal),
      rect('panel', 4, 50, 112, 16, 3, S.woodLight),
      rect('face', 4, 64, 112, 10, 2, S.wood),
      path('glint', 'M8 52h104'),
      rect('panel', 14, 52, 20, 11, 1.5, S.paper),
      path('rail', 'M18 56h12M18 59h9'),
      rect('panel', 52, 55, 16, 4, 1.5, S.monitor),
      rect('panel', 58, 46, 4, 10, 1, S.monitor),
      rect('face', 38, 29, 44, 21, 4, S.monitor),
      path('rail', 'M48 36h24M48 41h24', S.metalDeep),
      rect('panel', 97, 45, 9, 10, 2.5, S.mug),
      ellipse('mark', 101.5, 46.2, 3.3, 1.1, S.coffee),
    ],
  },
  // Its back to you: the desk at the back with the monitor's lit screen toward you, the keyboard and mouse, and the
  // chair's back nearest.
  back: {
    ...SEAT_GRIDS.desk.back,
    parts: [
      ellipse('shadow', 60, 78, 56, 5),
      path('line', 'M12 52v26M108 52v26', S.metal),
      rect('panel', 4, 38, 112, 15, 3, S.woodLight),
      rect('face', 4, 51, 112, 6, 2, S.wood),
      rect('panel', 58, 31, 4, 8, 1, S.monitor),
      rect('panel', 50, 37, 20, 3, 1.5, S.monitor),
      rect('panel', 32, 4, 56, 32, 3.5, S.monitor),
      rect('screen', 35.5, 7.5, 49, 25, 1.5, S.screen),
      rect('mark', 39, 11, 20, 2.5, 1, S.screenLit),
      rect('mark', 39, 16, 30, 1.6, 0.8, '#9cc3e6'),
      rect('mark', 39, 20, 24, 1.6, 0.8, '#9cc3e6'),
      path('glint', 'M44 30l12-20M52 30l8-13'),
      rect('panel', 38, 42, 34, 7, 1.5, S.keys),
      path('rail', 'M41 44.5h28M41 46.8h28', S.metalDeep),
      ellipse('panel', 82, 45.5, 3.2, 4, S.keys),
      ellipse('shadow', 60, 107, 24, 3.5),
      path('line', 'M60 92v10M46 105h28', S.metalDeep),
      rect('panel', 32, 66, 56, 12, 4.5),
      rect('face', 41, 74, 38, 26, 7),
      path('rail', 'M60 79v16'),
      path('glint', 'M46 76.5h28'),
    ],
  },
  // Facing left: the desk a long top down the left with its near end toward you, the monitor side-on and its screen
  // toward the chair (cheated a little toward you so it reads), the keyboard, a mug, and the chair on the right.
  side: {
    ...SEAT_GRIDS.desk.side,
    parts: [
      ellipse('shadow', 56, 113, 52, 5),
      path('line', 'M12 102v14M40 102v14', S.metal),
      rect('panel', 6, 18, 40, 76, 3, S.woodLight),
      rect('face', 6, 92, 40, 10, 2, S.wood),
      path('glint', 'M8.5 22v66'),
      rect('panel', 9, 50, 8, 16, 2, S.monitor),
      rect('panel', 15, 32, 16, 48, 3, S.monitor),
      rect('screen', 19, 35, 9, 42, 1.5, S.screen),
      rect('mark', 20.5, 38, 6, 8, 0.8, S.screenLit),
      path('glint', 'M21 54l5-8M21 61l5-8'),
      rect('panel', 34, 44, 8, 30, 2, S.keys),
      ellipse('panel', 38, 82, 3, 3.5, S.keys),
      rect('panel', 33, 22, 9, 10, 2.5, S.mug),
      ellipse('mark', 37.5, 23.2, 3.3, 1.1, S.coffee),
      path('line', 'M70 80v24M58 106h26', S.metalDeep),
      rect('panel', 52, 48, 36, 28, 4.5),
      rect('face', 52, 74, 36, 7, 3),
      rect('panel', 85, 30, 11, 48, 4),
      rect('face', 85, 74, 11, 7, 2.5),
      path('glint', 'M56 50.5h28'),
    ],
  },
};

// A two-seater sofa: a padded back with its own cushions, two rolled arms, two seat cushions on wooden feet, and a
// throw pillow, so two characters sit side by side.
export const SOFA_ART: FurnitureArt = {
  // Facing you: the back and its cushions behind, the arms either end, the seat cushions and their front.
  front: {
    ...SEAT_GRIDS.sofa.front,
    parts: [
      ellipse('shadow', 68, 70, 66, 4.5),
      path('line', 'M14 62v7M122 62v7', S.woodDeep),
      rect('panel', 10, 3, 116, 33, 11),
      rect('panel', 20, 8, 47, 27, 8),
      rect('panel', 69, 8, 47, 27, 8),
      rect('panel', 24, 21, 17, 15, 5, S.pillow),
      rect('panel', 2, 23, 19, 38, 9),
      rect('panel', 115, 23, 19, 38, 9),
      rect('panel', 20, 33, 48, 16, 5.5),
      rect('panel', 68, 33, 48, 16, 5.5),
      rect('face', 20, 47, 96, 11, 4.5),
      rect('face', 2, 55, 19, 7, 3.5),
      rect('face', 115, 55, 19, 7, 3.5),
      path('glint', 'M26 35.5h36M74 35.5h36M26 10.5h35M75 10.5h35M6 26h11M119 26h11'),
    ],
  },
  // Its back to you: the cushions beyond, the arms, and the back's broad padded back nearest you.
  back: {
    ...SEAT_GRIDS.sofa.back,
    parts: [
      ellipse('shadow', 68, 70, 66, 4.5),
      path('line', 'M14 60v8M122 60v8', S.woodDeep),
      rect('panel', 20, 12, 48, 16, 5.5),
      rect('panel', 68, 12, 48, 16, 5.5),
      rect('panel', 2, 10, 19, 47, 9),
      rect('panel', 115, 10, 19, 47, 9),
      rect('face', 10, 22, 116, 38, 11),
      path('rail', 'M68 27v28M18 28h100'),
      path('glint', 'M22 24.5h92M6 13h11M119 13h11'),
    ],
  },
  // Facing left: tall, its two cushions one above the other, the back a long bar on the right, the arms at either
  // end, and its feet only under its lower end.
  side: {
    ...SEAT_GRIDS.sofa.side,
    parts: [
      ellipse('shadow', 38, 131, 36, 4.5),
      path('line', 'M12 124v8M64 124v8', S.woodDeep),
      rect('panel', 50, 6, 21, 114, 9),
      rect('panel', 14, 22, 38, 44, 5.5),
      rect('panel', 14, 66, 38, 44, 5.5),
      rect('panel', 6, 3, 65, 21, 8),
      rect('panel', 6, 105, 65, 17, 8),
      rect('face', 6, 118, 65, 7, 3.5),
      path('glint', 'M18 25h30M18 69h30M10 6h57'),
    ],
  },
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
// A woven pattern's strength over the fill: the stroke's tint, white's sheen, a dye's own colour.
export const FURNITURE_WEAVE = { tint: 0.2, sheen: 0.32, dye: 0.7 } as const;

/** The drawing a piece shows at a facing: its grid as a viewBox, and the mirror for facing right. */
export function furnitureFrame(
  art: FurnitureArt,
  facing: SeatFacing,
): { viewBox: string; transform: string; view: FurnitureDrawing } {
  const { view: name, mirrored } = facingView(facing);
  const view = art[name];
  return {
    viewBox: `0 0 ${view.width} ${view.height}`,
    transform: mirrored ? `translate(${view.width} 0) scale(-1 1)` : '',
    view,
  };
}

// Fixed colours for what keeps its colour whatever the theme: leaves, water, coffee, terracotta, book spines.
// The outlines are still the theme's stroke, so every piece sits in the same drawing style.
export const OFFICE_TONES = {
  leaf: '#63ad5c',
  leafDeep: '#428c46',
  pot: '#c96a3f',
  potDeep: '#a3522e',
  water: '#cfe8f6',
  waterDeep: '#9fd0ee',
  coffee: '#5e3a1e',
  glass: '#dde5ec',
  cold: '#5a95d6',
  hot: '#d9645c',
  books: ['#b5524a', '#3f74a8', '#d4a23f', '#4d9a78', '#7b65a8'],
} as const;

type Part = FurniturePart;

const T = OFFICE_TONES;

// A potted plant: five leaves fanned above a terracotta pot.
const PLANT_VIEW: FurnitureDrawing = {
  width: 56,
  height: 88,
  parts: [
    ellipse('shadow', 28, 84, 18, 3.5),
    path('panel', 'M27 61C18 62 9 56 4 48C13 46 22 52 27 61Z', T.leafDeep),
    path('panel', 'M29 61C38 62 47 56 52 48C43 46 34 52 29 61Z', T.leafDeep),
    path('panel', 'M27 60C14 54 6 40 7 26C17 32 24 44 27 60Z', T.leaf),
    path('panel', 'M29 60C42 54 50 40 49 26C39 32 32 44 29 60Z', T.leaf),
    path('panel', 'M28 60C20 44 20 24 28 8C36 24 36 44 28 60Z', T.leaf),
    path('rail', 'M28 56V16'),
    rect('panel', 12, 56, 32, 8, 3, T.pot),
    path('panel', 'M15 63H41L38 84H18Z', T.potDeep),
  ],
  seats: [],
};

// Shelves of books: a frame, a dark interior, three shelves of coloured spines.
function bookRow(y: number, offset: number): Part[] {
  const widths = [8, 7, 9, 6, 8, 9, 7, 10, 7, 8];
  const heights = [24, 20, 26, 22, 24, 18, 20, 26, 22, 24];
  const out: Part[] = [];
  let x = 14;
  for (let i = 0; i < widths.length && x + widths[i]! <= 106; i += 1) {
    const w = widths[(i + offset) % widths.length]!;
    const h = heights[(i + offset * 3) % heights.length]!;
    // A gap on each shelf, so the rows do not read as a wall of spines.
    if (i === 5 - offset) {
      x += 10;
      continue;
    }
    out.push(rect('panel', x, y - h, w, h, 1, T.books[(i + offset) % T.books.length]));
    x += w + 1;
  }
  return out;
}

const BOOKSHELF_VIEW: FurnitureDrawing = {
  width: 120,
  height: 132,
  parts: [
    ellipse('shadow', 60, 128, 58, 4),
    rect('panel', 4, 4, 112, 122, 4),
    rect('face', 10, 12, 100, 108, 2),
    ...bookRow(42, 0),
    rect('panel', 10, 42, 100, 5, 1.5),
    ...bookRow(78, 1),
    rect('panel', 10, 78, 100, 5, 1.5),
    ...bookRow(114, 2),
    rect('panel', 10, 114, 100, 6, 1.5),
  ],
  seats: [],
};

// Its back to you: the top seen from above, then the back's boards from the top to the floor.
const BOOKSHELF_BACK: FurnitureDrawing = {
  width: 120,
  height: 132,
  parts: [
    ellipse('shadow', 60, 128, 58, 4),
    rect('panel', 4, 4, 112, 12, 3),
    rect('face', 4, 14, 112, 112, 3),
    path('rail', 'M32 20V118M60 20V118M88 20V118'),
    path('rail', 'M8 118H112'),
  ],
  seats: [],
};

// Books end on in a strip, as the front's cheated toward you: a column of spines in three shelves.
function bookColumn(from: number, to: number, offset: number): Part[] {
  const heights = [6, 5, 7, 4, 6, 5, 7];
  const out: Part[] = [];
  let y = from;
  for (let i = 0; y + heights[(i + offset) % heights.length]! <= to; i += 1) {
    const h = heights[(i + offset) % heights.length]!;
    // A gap on each shelf, as the front's.
    if (i === 3) {
      y += 6;
      continue;
    }
    out.push(rect('panel', 8, y, 6, h, 1, T.books[(i + offset) % T.books.length]));
    y += h + 1;
  }
  return out;
}

// Facing left: narrow and long, its top running away from you down to its near end, and its front cheated toward
// you down its left, the books end on in three shelves.
const BOOKSHELF_SIDE: FurnitureDrawing = {
  width: 52,
  height: 196,
  parts: [
    ellipse('shadow', 28, 192, 25, 4),
    rect('panel', 16, 4, 32, 70, 3),
    rect('face', 16, 72, 32, 118, 3),
    rect('panel', 4, 6, 14, 184, 3),
    rect('face', 7, 12, 8, 172, 1.5),
    ...bookColumn(14, 66, 0),
    rect('panel', 6, 67, 10, 4, 1.5),
    ...bookColumn(73, 124, 1),
    rect('panel', 6, 125, 10, 4, 1.5),
    ...bookColumn(131, 182, 2),
  ],
  seats: [],
};

// A water cooler: a blue bottle upside down on a cooler with hot and cold taps.
const WATER_COOLER_VIEW: FurnitureDrawing = {
  width: 56,
  height: 112,
  parts: [
    ellipse('shadow', 28, 108, 20, 3.5),
    rect('face', 10, 44, 36, 60, 4),
    rect('panel', 8, 40, 40, 8, 3),
    rect('panel', 16, 56, 8, 6, 1.5, T.cold),
    rect('panel', 32, 56, 8, 6, 1.5, T.hot),
    rect('rail', 16, 72, 24, 4, 1.5),
    rect('panel', 23, 33, 10, 9, 2, T.waterDeep),
    rect('panel', 12, 4, 32, 32, 10, T.water),
    path('rail', 'M15 13h26'),
    path('glint', 'M18 30V14'),
  ],
  seats: [],
};

// Its back to you: the same bottle on top, the cooler's back with a vent and no taps.
const WATER_COOLER_BACK: FurnitureDrawing = {
  width: 56,
  height: 112,
  parts: [
    ellipse('shadow', 28, 108, 20, 3.5),
    rect('face', 10, 44, 36, 60, 4),
    rect('panel', 8, 40, 40, 8, 3),
    rect('rail', 17, 58, 22, 18, 2),
    path('rail', 'M21 63h14M21 67h14M21 71h14'),
    rect('panel', 23, 33, 10, 9, 2, T.waterDeep),
    rect('panel', 12, 4, 32, 32, 10, T.water),
    path('rail', 'M15 13h26'),
    path('glint', 'M18 30V14'),
  ],
  seats: [],
};

// Facing left: the cooler's side toward you, its front cheated down its left with the two taps and the drip tray.
const WATER_COOLER_SIDE: FurnitureDrawing = {
  width: 56,
  height: 112,
  parts: [
    ellipse('shadow', 29, 108, 21, 3.5),
    rect('face', 14, 44, 32, 60, 4),
    rect('panel', 12, 40, 36, 8, 3),
    rect('face', 8, 46, 8, 56, 2),
    rect('panel', 3, 54, 9, 6, 1.5, T.cold),
    rect('panel', 5, 61, 9, 6, 1.5, T.hot),
    rect('rail', 4, 74, 9, 4, 1.5),
    rect('panel', 25, 33, 10, 9, 2, T.waterDeep),
    rect('panel', 14, 4, 32, 32, 10, T.water),
    path('rail', 'M17 13h26'),
    path('glint', 'M20 30V14'),
  ],
  seats: [],
};

// A coffee machine with a carafe, on a little counter, a mug beside it.
const COFFEE_MACHINE_VIEW: FurnitureDrawing = {
  width: 72,
  height: 96,
  parts: [
    ellipse('shadow', 36, 92, 32, 3.5),
    rect('face', 2, 64, 68, 24, 2),
    path('rail', 'M8 76h56'),
    rect('panel', 2, 58, 68, 8, 2),
    rect('face', 14, 14, 44, 44, 5),
    rect('panel', 14, 8, 44, 9, 3),
    rect('screen', 20, 20, 32, 8, 2),
    rect('panel', 32, 31, 8, 6, 1.5),
    rect('panel', 26, 40, 20, 18, 4, T.glass),
    rect('panel', 28, 48, 16, 8, 2, T.coffee),
    rect('panel', 58, 49, 10, 10, 2),
  ],
  seats: [],
};

// Its back to you: the counter's plain back, the machine's back with its vents, the mug now at its left.
const COFFEE_MACHINE_BACK: FurnitureDrawing = {
  width: 72,
  height: 96,
  parts: [
    ellipse('shadow', 36, 92, 32, 3.5),
    rect('face', 2, 64, 68, 24, 2),
    rect('panel', 2, 58, 68, 8, 2),
    rect('panel', 4, 49, 10, 10, 2),
    rect('face', 14, 14, 44, 44, 5),
    rect('panel', 14, 8, 44, 9, 3),
    path('rail', 'M24 26h24M24 32h24M24 38h24'),
  ],
  seats: [],
};

// Facing left: the counter running away from you, the machine's side on it, its front cheated down its left with
// the screen and the carafe under the spout, the mug at the near end.
const COFFEE_MACHINE_SIDE: FurnitureDrawing = {
  width: 56,
  height: 104,
  parts: [
    ellipse('shadow', 29, 100, 26, 3.5),
    rect('face', 6, 74, 46, 22, 2),
    path('rail', 'M12 84h34'),
    rect('panel', 6, 44, 46, 32, 2),
    rect('face', 12, 22, 32, 46, 5),
    rect('panel', 12, 6, 32, 18, 4),
    rect('face', 7, 12, 8, 52, 2),
    rect('screen', 8, 17, 5, 13, 1.5),
    rect('panel', 6, 33, 5, 5, 1.5),
    rect('panel', 2, 40, 12, 20, 4, T.glass),
    rect('panel', 3, 50, 10, 8, 2, T.coffee),
    rect('panel', 26, 64, 9, 10, 2),
  ],
  seats: [],
};

// A rug: an oval in the element's fill with a border, lying on the floor (no shadow: it is the floor).
const RUG_VIEW: FurnitureDrawing = {
  width: 200,
  height: 120,
  parts: [
    ellipse('panel', 100, 60, 96, 56),
    ellipse('rail', 100, 60, 84, 46),
    ellipse('rail', 100, 60, 60, 30),
    ellipse('rail', 100, 60, 34, 14),
  ],
  seats: [],
};

// Turned on its side: the same oval on a grid with its sides swapped, its pattern running down it.
const RUG_SIDE: FurnitureDrawing = {
  width: 120,
  height: 200,
  parts: [
    ellipse('panel', 60, 100, 56, 96),
    ellipse('rail', 60, 100, 46, 84),
    ellipse('rail', 60, 100, 30, 60),
    ellipse('rail', 60, 100, 14, 34),
  ],
  seats: [],
};

// A notebook in front of each place, at the far edge and the near edge of the top.
const tablePapers = (xs: readonly number[], farY: number, nearY: number): Part[] =>
  xs.flatMap((x) => [
    rect('panel', x - 9, farY, 18, 11, 1.5, S.paper),
    rect('panel', x - 9, nearY, 18, 11, 1.5, S.paper),
    path('rail', `M${x - 6} ${farY + 4}h12M${x - 6} ${nearY + 4}h12`),
  ]);
// A glass jug of water in the middle of the table.
const jug = (cx: number, cy: number): Part[] => [
  ellipse('shadow', cx, cy + 9, 7, 2),
  rect('panel', cx - 5, cy - 6, 10, 15, 3.5, '#d5ecf7'),
  rect('mark', cx - 3.6, cy, 7.2, 7.5, 2.4, '#8fc9ea'),
  path('glint', `M${cx - 2.6} ${cy - 3}v9`),
];

const far = (cx: number): Part[] => [
  rect('panel', cx - 17, 8, 34, 30, 6),
  path('rail', `M${cx} 13v20`),
  rect('panel', cx - 22, 34, 44, 12, 4),
];
const near = (cx: number, dy = 0): Part[] => [
  path('line', `M${cx - 17} ${136 + dy}v22M${cx + 17} ${136 + dy}v22`, S.metal),
  rect('panel', cx - 22, 110 + dy, 44, 12, 3),
  rect('face', cx - 17, 102 + dy, 34, 36, 6),
  path('rail', `M${cx} ${107 + dy}v26`),
  path('glint', `M${cx - 12} ${104.5 + dy}h24`),
];
// A chair in profile at a side of the table, its seat's middle at `cy`: its backrest on the outside, at the left for
// a sitter facing right, at the right for one facing left.
const profile = (cy: number, facingRight: boolean): Part[] => {
  const x = (gx: number, w = 0) => (facingRight ? gx : MEETING_TABLE_SEATS.height - gx - w);
  return [
    path('line', `M${x(10)} ${cy + 8}v18M${x(32)} ${cy + 8}v18`, S.metal),
    rect('panel', x(6, 30), cy - 6, 30, 12, 4),
    rect('panel', x(2, 8), cy - 28, 8, 36, 3.5),
  ];
};

// Six chairs round a table, every seat facing it: two beyond (their sitters face you), two in front (their
// backs to you), one at each end in profile. Its grid and its seats (each with the way its sitter faces) are
// @livehuddle/avatar/seats', so a sitter lands on the chairs drawn here.
export const MEETING_TABLE_VIEW: FurnitureDrawing & { tableSeats: readonly TableSeat[] } = {
  width: MEETING_TABLE_SEATS.width,
  height: MEETING_TABLE_SEATS.height,
  // Each chair a row of its own and the top on its legs, so the 3D view builds it (furniture-rows.ts).
  ...rowed([
    { flat: [ellipse('shadow', 116, 160, 110, 6)] },
    { stand: far(86) },
    { stand: far(146) },
    // The ends: seat, then the backrest on the outside.
    {
      stand: [
        path('line', 'M10 80v18M32 80v18', S.metal),
        rect('panel', 6, 66, 30, 12, 4),
        rect('panel', 2, 44, 8, 36, 3.5),
      ],
    },
    {
      stand: [
        path('line', 'M200 80v18M222 80v18', S.metal),
        rect('panel', 196, 66, 30, 12, 4),
        rect('panel', 222, 44, 8, 36, 3.5),
      ],
    },
    // The table: legs, its wooden top and front edge, a notebook at each place and a jug of water.
    {
      top: [
        path('line', 'M50 110v20M182 110v20', S.metal),
        rect('panel', 40, 56, 152, 44, 6, S.woodLight),
        rect('face', 40, 96, 152, 12, 4, S.wood),
        path('glint', 'M48 59h136'),
        ...tablePapers([86, 146], 60, 84),
        ...jug(116, 72),
      ],
    },
    { stand: near(86) },
    { stand: near(146) },
  ]),
  seats: [],
  tableSeats: MEETING_TABLE_SEATS.seats,
};

// Turned on its side: a tall table, the left end's chair beyond it, two chairs in profile down each side and the right
// end's chair nearest you, its back to you.
const MEETING_TABLE_SIDE: FurnitureDrawing = {
  ...MEETING_TABLE_SEATS_SIDE,
  ...rowed([
    { flat: [ellipse('shadow', 84, 228, 78, 4)] },
    { stand: far(84) },
    { stand: profile(86, true) },
    { stand: profile(134, true) },
    { stand: profile(86, false) },
    { stand: profile(134, false) },
    {
      top: [
        path('line', 'M56 178v20M112 178v20', S.metal),
        rect('panel', 46, 50, 76, 120, 6, S.woodLight),
        rect('face', 46, 166, 76, 12, 4, S.wood),
        path('glint', 'M50 53.5h68'),
        ...jug(84, 104),
      ],
    },
    { stand: near(84, 70) },
  ]),
};

// From behind, a table with six chairs reads the same, so its back is its front's drawing; only its seats have turned.
export const MEETING_TABLE_ART: FurnitureArt = {
  front: {
    ...MEETING_TABLE_VIEW,
    seats: MEETING_TABLE_VIEW.tableSeats.map(({ u, v }) => ({ u, v })),
  },
  back: { ...MEETING_TABLE_VIEW, ...MEETING_TABLE_SEATS_BACK },
  side: MEETING_TABLE_SIDE,
};

// The last few Long Tables' drawings, by length: a table is redrawn on every render, its length changes only on a
// resize or a turn.
const longTables = new Map<number, FurnitureArt>();

const r1 = (v: number) => Math.round(v * 10) / 10;

/**
 * A Long Table's drawings for its box at its facing (livehuddle's office.md "Long Table"): the Meeting Table's chairs
 * and top stretched to the length its box allows (seats.ts longTableLength), so a sitter lands on a drawn chair. From
 * behind it reads the same, so its back is its front's drawing with the seats turned; on its side it is a tall table,
 * the Meeting Table's side drawing stretched, its side chairs in profile down both sides (furniture-facing.md "A turn").
 */
export function longTableArt(
  width: number,
  height: number,
  facing: SeatFacing = 'n',
): FurnitureArt {
  const L = longTableLength(width, height, facing);
  const cached = longTables.get(L);
  if (cached) return cached;
  const seats = longTableSeatViews(L);
  const sides = longTableSideXs(L).map(r1);
  const end = L - MEETING_TABLE_SEATS.width;
  const front: FurnitureDrawing = {
    ...seats.front,
    ...rowed([
      { flat: [ellipse('shadow', L / 2, 160, L / 2 - 6, 6)] },
      ...sides.map((x) => ({ stand: far(x) })),
      {
        stand: [
          path('line', 'M10 80v18M32 80v18', S.metal),
          rect('panel', 6, 66, 30, 12, 4),
          rect('panel', 2, 44, 8, 36, 3.5),
        ],
      },
      {
        stand: [
          path('line', `M${200 + end} 80v18M${222 + end} 80v18`, S.metal),
          rect('panel', 196 + end, 66, 30, 12, 4),
          rect('panel', 222 + end, 44, 8, 36, 3.5),
        ],
      },
      {
        top: [
          path('line', `M50 110v20M${L / 2} 110v20M${L - 50} 110v20`, S.metal),
          rect('panel', 40, 56, L - 80, 44, 6, S.woodLight),
          rect('face', 40, 96, L - 80, 12, 4, S.wood),
          path('glint', `M48 59h${L - 96}`),
          ...tablePapers(sides, 60, 84),
        ],
      },
      ...sides.map((x) => ({ stand: near(x) })),
    ]),
  };
  const ys = longTableSideYs(L).map(r1);
  const side: FurnitureDrawing = {
    ...seats.side,
    ...rowed([
      { flat: [ellipse('shadow', 84, L - 4, 78, 4)] },
      { stand: far(84) },
      ...ys.map((y) => ({ stand: profile(y, true) })),
      ...ys.map((y) => ({ stand: profile(y, false) })),
      {
        top: [
          path('line', `M56 ${L - 54}v20M112 ${L - 54}v20`, S.metal),
          rect('panel', 46, 50, 76, L - 112, 6, S.woodLight),
          rect('face', 46, L - 66, 76, 12, 4, S.wood),
          path('glint', 'M50 53.5h68'),
        ],
      },
      { stand: near(84, L - 162) },
    ]),
  };
  const art: FurnitureArt = { front, back: { ...front, ...seats.back }, side };
  if (longTables.size >= 16) longTables.clear();
  longTables.set(L, art);
  return art;
}

/** Where a machine's answer plays on one drawing: each bubble or drip's spot, on that drawing's grid. */
export type MachineAnswerSpot = { x: number; y: number };

/**
 * Where a machine answers a drink on each of its drawings (office.md "Using it", furniture-facing.md "Live faces"):
 * the cooler's bubbles rise in its bottle, which stands on top and shows from every side; the coffee drips from the
 * spout into the carafe, at the front, so on its side it drips at the carafe cheated down its left and from behind,
 * where the machine hides its carafe, it plays nowhere (null).
 */
export const MACHINE_ANSWER_AT: Readonly<
  Record<
    'water-cooler' | 'coffee-machine',
    Readonly<Record<SeatView, readonly MachineAnswerSpot[] | null>>
  >
> = {
  'water-cooler': {
    front: [
      { x: 20, y: 30 },
      { x: 28, y: 28 },
      { x: 35, y: 26 },
    ],
    back: [
      { x: 20, y: 30 },
      { x: 28, y: 28 },
      { x: 35, y: 26 },
    ],
    side: [
      { x: 22, y: 30 },
      { x: 30, y: 28 },
      { x: 37, y: 26 },
    ],
  },
  'coffee-machine': {
    front: [
      { x: 36, y: 38 },
      { x: 36, y: 38 },
      { x: 36, y: 38 },
    ],
    back: null,
    side: [
      { x: 8.5, y: 39 },
      { x: 8.5, y: 39 },
      { x: 8.5, y: 39 },
    ],
  },
};

/** The office pieces drawn from a grid, by kind. */
export const SHARED_OFFICE_ART = {
  'meeting-table': MEETING_TABLE_ART,
  plant: allSides(PLANT_VIEW),
  bookshelf: { front: BOOKSHELF_VIEW, back: BOOKSHELF_BACK, side: BOOKSHELF_SIDE },
  'water-cooler': { front: WATER_COOLER_VIEW, back: WATER_COOLER_BACK, side: WATER_COOLER_SIDE },
  'coffee-machine': {
    front: COFFEE_MACHINE_VIEW,
    back: COFFEE_MACHINE_BACK,
    side: COFFEE_MACHINE_SIDE,
  },
  // A rug is flat: from behind it is the same pattern.
  rug: { front: RUG_VIEW, back: RUG_VIEW, side: RUG_SIDE },
} as const satisfies Record<string, FurnitureArt>;

/** The seating pieces, by kind. */
export const SHARED_SEATING_ART = {
  chair: CHAIR_ART,
  desk: DESK_ART,
  sofa: SOFA_ART,
  'meeting-table': MEETING_TABLE_ART,
} as const satisfies Record<string, FurnitureArt>;

/**
 * A piece turned from one facing to another, given its drawings (furniture-facing.md "A turn"): its box keeps its
 * centre and scale and takes the turned drawing's proportions, its facing is `to`, and any rotation stored before
 * furniture stopped rotating is dropped, so it stands upright. Which kinds turn, and a piece's current facing, are each
 * product's (its furniture-facing.ts), which calls this.
 */
export function turnWithArt<E extends Rect & { chairFacing?: SeatFacing; rotation?: number }>(
  el: E,
  art: FurnitureArt,
  from: SeatFacing,
  to: SeatFacing,
): E {
  const { x, y, width, height } = turnedBox(
    { x: el.x, y: el.y, width: el.width, height: el.height },
    art[facingView(from).view],
    art[facingView(to).view],
  );
  const { rotation: _dropped, ...rest } = el;
  return { ...rest, x, y, width, height, chairFacing: to } as E;
}
