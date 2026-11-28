// Where the 3D view stands a template's pieces (docs/specs/008-canvas/3d-engine.md "Block models"): a piece's model on
// its front drawing's footprint, turned to its facing, on its box (apps/editor's piece-frame.ts). Since the Space is
// always 3D (3d-view.md), this, not the drawing's box, is where a piece stands against a wall
// (docs/specs/007-editor/templates-by-mode.md "Made for 3D"). Pure: no React, no DOM.

import {
  footprintFractions,
  pieceFacing,
  turnsWithFacing,
  type ShapeElement,
} from '@livehuddle/document';
import type { SeatFacing } from '@livehuddle/avatar/facing';

type Box = { x: number; y: number; width: number; height: number };
type Fraction = { x0: number; y0: number; x1: number; y1: number };

/** Pieces made to stand with their back against a wall (a hung one is `mountsOnWall`'s). */
export const STANDS_AGAINST_A_WALL: ReadonlySet<string> = new Set([
  'kitchen-counter',
  'kitchen-sink',
  'fridge',
  'drinks-fridge',
  'drinks-cabinet',
  'lockers',
  'vending-machine',
  'arcade-machine',
  'jukebox',
  'copier',
  'printer',
  'coffee-machine',
  'water-cooler',
  'phone-booth',
]);

// Pieces whose 3D model stands on part of its box but which keep no walk footprint (a seat's model fills its box
// otherwise): the Phone Booth stands only on its front 56 px, its back wall just behind the stool, the top of its box
// empty floor (3d-engine.md "Block models").
const MODEL_ONLY: Readonly<Record<string, Fraction>> = {
  'phone-booth': { x0: 0, y0: 80 / 136, x1: 1, y1: 1 },
};

/** The way a piece's front looks, as a unit step on the canvas (piece-frame.ts: 'n' is +y, 'w' is +x). */
export const FRONT: Record<SeatFacing, { x: number; y: number }> = {
  n: { x: 0, y: 1 },
  s: { x: 0, y: -1 },
  e: { x: -1, y: 0 },
  w: { x: 1, y: 0 },
};

/** A front-drawing fraction turned to `facing`, as the model is (office-geometry's turnFraction). */
function turnFraction(f: Fraction, facing: SeatFacing): Fraction {
  if (facing === 'e') return { x0: 1 - f.y1, x1: 1 - f.y0, y0: f.x0, y1: f.x1 };
  if (facing === 's') return { x0: 1 - f.x1, x1: 1 - f.x0, y0: 1 - f.y1, y1: 1 - f.y0 };
  if (facing === 'w') return { x0: f.y0, x1: f.y1, y0: 1 - f.x1, y1: 1 - f.x0 };
  return f;
}

/**
 * Where a piece's model stands on the floor: its front drawing's footprint turned to its facing, on its box; the whole
 * box for a piece with no footprint (a seat or a table, whose model fills it).
 */
export function modelFloorBox(el: ShapeElement): Box {
  const only = MODEL_ONLY[el.shape];
  const fr = only ? [only] : footprintFractions(el.shape, 'n');
  if (fr.length === 0) return { x: el.x, y: el.y, width: el.width, height: el.height };
  let f: Fraction = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  for (const g of fr)
    f = {
      x0: Math.min(f.x0, g.x0),
      y0: Math.min(f.y0, g.y0),
      x1: Math.max(f.x1, g.x1),
      y1: Math.max(f.y1, g.y1),
    };
  const t = turnFraction(f, turnsWithFacing(el.shape) ? pieceFacing(el) : 'n');
  return {
    x: el.x + el.width * t.x0,
    y: el.y + el.height * t.y0,
    width: el.width * (t.x1 - t.x0),
    height: el.height * (t.y1 - t.y0),
  };
}

/** How far a model's back side is from the box's matching edge, so a builder can stand it on a wall's face. */
export function modelBackInset(el: ShapeElement): number {
  const m = modelFloorBox({ ...el, x: 0, y: 0 });
  switch (pieceFacing(el)) {
    case 'n':
      return m.y;
    case 's':
      return el.height - (m.y + m.height);
    case 'w':
      return m.x;
    case 'e':
      return el.width - (m.x + m.width);
  }
}
