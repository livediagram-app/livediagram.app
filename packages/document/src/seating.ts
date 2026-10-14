// Seating (docs/specs/009-elements/chair.md "Desk and sofa"): the furniture an Avatar-mode character
// sits down in. The chair keeps its own drawing (shape-geometry.ts CHAIR_GEOMETRY); the desk and the
// two-seater sofa are drawn here, as one table of parts both renderers paint (the editor's
// FurnitureView and the headless svg-render-faces), so a desk on the canvas and a desk in an export
// are the same desk. Pure: no React, no DOM, safe in a worker.
//
// All three share `chairFacing` (where the furniture's back is) and the walk hook's arrival rule;
// what differs is the drawing, the facing it is drawn at, and how many seats it has.

import { chairSeatPoint, DEFAULT_CHAIR_FACING, type ChairFacing } from './collab-shapes';
import type { ShapeKind } from './shape-kind';

export type SeatingKind = 'chair' | 'desk' | 'sofa';
export type FurnitureKind = 'desk' | 'sofa';

export function isSeatingShape(kind: ShapeKind | string): kind is SeatingKind {
  return kind === 'chair' || kind === 'desk' || kind === 'sofa';
}

export function isFurnitureShape(kind: ShapeKind | string): kind is FurnitureKind {
  return kind === 'desk' || kind === 'sofa';
}

// Where a new one's back is. A chair and a sofa face the reader; a desk is placed with its desk at
// the top and its chair in front, so the sitter faces up, at the computer, with their back to you.
export const DEFAULT_SEATING_FACING: Record<SeatingKind, ChairFacing> = {
  chair: DEFAULT_CHAIR_FACING,
  sofa: 'n',
  desk: 's',
};

export function seatingFacing(el: { shape: SeatingKind; chairFacing?: ChairFacing }): ChairFacing {
  return el.chairFacing ?? DEFAULT_SEATING_FACING[el.shape];
}

// The turn, in clockwise degrees, from one facing to another.
const FACING_DEGREES: Record<ChairFacing, number> = { n: 0, e: 90, s: 180, w: 270 };

export function facingTurn(from: ChairFacing, to: ChairFacing): 0 | 90 | 180 | 270 {
  return ((FACING_DEGREES[to] - FACING_DEGREES[from] + 360) % 360) as 0 | 90 | 180 | 270;
}

// Whether a facing lays the furniture on its side relative to another (a quarter turn), which is
// when its box swaps width for height.
export function facingSwapsBox(from: ChairFacing, to: ChairFacing): boolean {
  const turn = facingTurn(from, to);
  return turn === 90 || turn === 270;
}

// How a part is painted, the same in both renderers:
//   shadow: the contact shadow (fixed slate, low opacity)
//   panel:  the seat fill with the stroke round it (cushions, desk top, chair back)
//   line:   an unfilled stroke (legs)
//   rail:   a faint stroke (a seam, a stand)
//   screen: the monitor's glass (the stroke colour, so it follows the theme)
//   glint:  a light reflection on the glass
export type FurniturePartRole = 'shadow' | 'panel' | 'line' | 'rail' | 'screen' | 'glint';

export type FurniturePart =
  | { tag: 'rect'; role: FurniturePartRole; x: number; y: number; w: number; h: number; rx: number }
  | { tag: 'ellipse'; role: FurniturePartRole; cx: number; cy: number; rx: number; ry: number }
  | { tag: 'path'; role: FurniturePartRole; d: string };

export type FurnitureArt = {
  // The drawing grid, at `drawnFacing`.
  width: number;
  height: number;
  drawnFacing: ChairFacing;
  parts: readonly FurniturePart[];
  // Where a sitter's feet go, as fractions of the grid at `drawnFacing`.
  seats: readonly { u: number; v: number }[];
  // The occupied ring, in grid units: under the seats.
  ring: { cx: number; cy: number; rx: number; ry: number };
};

const rect = (role: FurniturePartRole, x: number, y: number, w: number, h: number, rx: number) =>
  ({ tag: 'rect', role, x, y, w, h, rx }) as const;
const ellipse = (role: FurniturePartRole, cx: number, cy: number, rx: number, ry: number) =>
  ({ tag: 'ellipse', role, cx, cy, rx, ry }) as const;
const path = (role: FurniturePartRole, d: string) => ({ tag: 'path', role, d }) as const;

// A desk with a computer on it and a chair pulled up in front, drawn the way the room sees it: the
// desk at the back, the monitor's screen toward you, and the chair with its back to you, so whoever
// sits in it is looking at the computer.
export const DESK_ART: FurnitureArt = {
  width: 120,
  height: 112,
  drawnFacing: 's',
  parts: [
    ellipse('shadow', 60, 78, 54, 5),
    // Legs, then the desk top over them.
    path('line', 'M12 52v26M108 52v26'),
    rect('panel', 4, 38, 112, 15, 3),
    // The monitor: stand and foot, then the bezel and its glass.
    path('rail', 'M60 33v6'),
    rect('panel', 50, 37, 20, 3, 1.5),
    rect('panel', 32, 4, 56, 32, 3),
    rect('screen', 36, 8, 48, 24, 1.5),
    path('glint', 'M41 27l10-14M47 27l7-10'),
    // Keyboard and mouse on the desk top.
    rect('rail', 38, 42, 34, 7, 1.5),
    ellipse('rail', 82, 45.5, 3.2, 4),
    // The chair in front: its shadow, seat, and the back nearest you.
    ellipse('shadow', 60, 107, 24, 3.5),
    rect('panel', 32, 66, 56, 12, 3),
    path('line', 'M42 96v10M78 96v10'),
    rect('panel', 41, 74, 38, 26, 5),
    path('rail', 'M60 79v16'),
  ],
  seats: [{ u: 0.5, v: 0.68 }],
  ring: { cx: 60, cy: 72, rx: 28, ry: 9 },
};

// A two-seater sofa seen from the front: a long back, two arms and two seat cushions, so two
// characters can sit side by side.
export const SOFA_ART: FurnitureArt = {
  width: 136,
  height: 76,
  drawnFacing: 'n',
  parts: [
    ellipse('shadow', 68, 70, 64, 4),
    path('line', 'M12 58v10M124 58v10'),
    rect('panel', 10, 4, 116, 32, 9),
    path('rail', 'M68 9v22'),
    rect('panel', 2, 24, 18, 36, 7),
    rect('panel', 116, 24, 18, 36, 7),
    rect('panel', 20, 34, 48, 22, 5),
    rect('panel', 68, 34, 48, 22, 5),
  ],
  seats: [
    { u: 44 / 136, v: 0.62 },
    { u: 92 / 136, v: 0.62 },
  ],
  ring: { cx: 68, cy: 46, rx: 56, ry: 13 },
};

export const FURNITURE_ART: Record<FurnitureKind, FurnitureArt> = {
  desk: DESK_ART,
  sofa: SOFA_ART,
};

// Stroke widths, in grid units.
export const FURNITURE_PANEL_STROKE = 2;
export const FURNITURE_LINE_STROKE = 2.5;
export const FURNITURE_RAIL_STROKE = 1.5;
export const FURNITURE_RAIL_OPACITY = 0.55;
export const FURNITURE_SHADOW = { fill: '#0f172a', opacity: 0.12 } as const;
export const FURNITURE_GLINT = { stroke: '#ffffff', opacity: 0.35 } as const;

/**
 * How to draw furniture turned to a facing: the viewBox for the turned drawing and the transform
 * that turns the grid into it. A quarter turn swaps the viewBox's sides, which is why turning a desk
 * or a sofa onto its side also swaps its box.
 */
export function furnitureFrame(
  art: FurnitureArt,
  facing: ChairFacing,
): { viewBox: string; transform: string } {
  const { width: w, height: h } = art;
  switch (facingTurn(art.drawnFacing, facing)) {
    case 90:
      return { viewBox: `0 0 ${h} ${w}`, transform: `translate(${h} 0) rotate(90)` };
    case 180:
      return { viewBox: `0 0 ${w} ${h}`, transform: `translate(${w} ${h}) rotate(180)` };
    case 270:
      return { viewBox: `0 0 ${h} ${w}`, transform: `translate(0 ${w}) rotate(270)` };
    default:
      return { viewBox: `0 0 ${w} ${h}`, transform: '' };
  }
}

/**
 * The parts to paint at a facing. The contact shadows sit under the furniture as drawn; turned, they
 * would float above or beside it, so a turned piece goes without.
 */
export function furnitureParts(art: FurnitureArt, facing: ChairFacing): readonly FurniturePart[] {
  return facingTurn(art.drawnFacing, facing) === 0
    ? art.parts
    : art.parts.filter((p) => p.role !== 'shadow');
}

// A point on the grid (as fractions) after the drawing is turned, still as fractions of the box.
function turnFraction(u: number, v: number, turn: 0 | 90 | 180 | 270): { u: number; v: number } {
  switch (turn) {
    case 90:
      return { u: 1 - v, v: u };
    case 180:
      return { u: 1 - u, v: 1 - v };
    case 270:
      return { u: v, v: 1 - u };
    default:
      return { u, v };
  }
}

type Box = { x: number; y: number; width: number; height: number };

/** Every seat's feet point, in canvas coordinates, turned with the furniture's facing. */
export function seatPoints(
  el: Box & { shape: SeatingKind; chairFacing?: ChairFacing },
): { x: number; y: number }[] {
  const facing = seatingFacing(el);
  if (el.shape === 'chair') return [chairSeatPoint(el, facing)];
  const art = FURNITURE_ART[el.shape];
  const turn = facingTurn(art.drawnFacing, facing);
  return art.seats.map((seat) => {
    const { u, v } = turnFraction(seat.u, seat.v, turn);
    return { x: el.x + el.width * u, y: el.y + el.height * v };
  });
}

/** The seat nearest a point (where the character walked in), so a sofa seats you on your side. */
export function nearestSeat(
  el: Box & { shape: SeatingKind; chairFacing?: ChairFacing },
  from: { x: number; y: number },
): { x: number; y: number } {
  const seats = seatPoints(el);
  let best = seats[0]!;
  for (const seat of seats) {
    if (Math.hypot(seat.x - from.x, seat.y - from.y) < Math.hypot(best.x - from.x, best.y - from.y))
      best = seat;
  }
  return best;
}

/**
 * The box a desk or sofa takes when turned from one facing to another: the same centre, its sides
 * swapped on a quarter turn so the drawing keeps its proportions. A chair is square enough to turn
 * in place.
 */
export function turnedSeatingBox(
  el: Box & { shape: SeatingKind },
  from: ChairFacing,
  to: ChairFacing,
): Box {
  if (el.shape === 'chair' || !facingSwapsBox(from, to)) return { ...el };
  const cx = el.x + el.width / 2;
  const cy = el.y + el.height / 2;
  return { x: cx - el.height / 2, y: cy - el.width / 2, width: el.height, height: el.width };
}
