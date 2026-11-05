// The Recreation Spaces (docs/specs/012-collaboration/virtual-office-template.md "Spaces"): a Rooftop Bar and a Cafe,
// somewhere to unwind together, furnished from the bar pieces (a Bar, Bar Stools, a Drinks Cabinet and a Drinks
// Fridge), sofas and chairs. Built with spacePlan (template-office-parts.ts).
//
// Each builder is pure: it takes a centre (cx, cy) and returns a fresh Element[], floors first.

import type { Element } from '@livehuddle/document';
import {
  SPACE_BELOW,
  SPACE_HEAD,
  spacePlan,
  walkIn,
  type OfficePiece,
  type OfficeRoom,
} from './template-office-parts';

// A row of Bar Stools in front of a bar along the back wall, `y` just clear of its front: a stool's sitter faces up
// the canvas, toward the bar.
function stools(xs: readonly number[], y: number): OfficePiece[] {
  return xs.map((x) => ({ kind: 'bar-stool', x, y }));
}

// A sofa on its rug with a chair turned to it, the rug's top left at (x, y); the chair on the `side` given, close
// beside the sofa as one seating group, so no gap between them is a squeeze to walk through
// (docs/specs/007-editor/templates-by-mode.md "Every Space is roomy").
function lounge(x: number, y: number, side: 'left' | 'right'): OfficePiece[] {
  return [
    { kind: 'rug', x, y },
    { kind: 'sofa', x: x + 24, y: y + 20, facing: 'n' },
    side === 'right'
      ? { kind: 'chair', x: x + 188, y: y + 20, facing: 'e' }
      : { kind: 'chair', x: x - 64, y: y + 20, facing: 'w' },
  ];
}

// --- Rooftop Bar -------------------------------------------------------------------

const ROOF_W = 1100;
const ROOF_H = 620;

export function buildRooftopBar(cx: number, cy: number): Element[] {
  const width = ROOF_W;
  const height = SPACE_HEAD + ROOF_H + SPACE_BELOW;
  const x0 = cx - width / 2;
  const y0 = cy - height / 2;
  const rooms: OfficeRoom[] = [
    {
      name: 'Rooftop Bar',
      x: 0,
      y: 0,
      w: ROOF_W,
      h: ROOF_H,
      door: 's',
      pieces: [
        // The bar along the back: two counters end to end, the cabinet and the fridge either side, a tree in each
        // corner.
        { kind: 'tree', x: 24, y: 30 },
        { kind: 'drinks-cabinet', x: 190, y: 40 },
        { kind: 'bar', x: 310, y: 40 },
        { kind: 'bar', x: 550, y: 40 },
        { kind: 'drinks-fridge', x: 820, y: 36 },
        { kind: 'tree', x: 956, y: 30 },
        ...stools([330, 390, 450, 510, 570, 630, 690, 750], 170),
        // Two lounges either side of the doorway, well clear of it.
        ...lounge(60, 400, 'right'),
        ...lounge(840, 400, 'left'),
        { kind: 'outdoor-plant', x: 40, y: 240 },
        { kind: 'outdoor-plant', x: 988, y: 240 },
        // A planter either side of the way in.
        { kind: 'outdoor-plant', x: 420, y: 530 },
        { kind: 'outdoor-plant', x: 610, y: 530 },
      ],
    },
  ];
  return spacePlan(
    x0,
    y0,
    width,
    rooms,
    {
      text: 'Rooftop Bar',
      width: 260,
      sticker: 'emoji-clinking-glasses',
      subtitle:
        'Drinks after work: pull up a stool at the bar, or sink into a sofa under the trees.',
    },
    walkIn(
      x0 + width,
      y0 + SPACE_HEAD + ROOF_H + SPACE_BELOW / 2,
      'Press Walk In (or W) to come up. A stool or a sofa seats you, and the cabinet or the fridge gets you a drink.',
    ),
  );
}

// --- Cafe --------------------------------------------------------------------------

const CAFE_W = 1000;
const CAFE_H = 580;

export function buildCafe(cx: number, cy: number): Element[] {
  const width = CAFE_W;
  const height = SPACE_HEAD + CAFE_H + SPACE_BELOW;
  const x0 = cx - width / 2;
  const y0 = cy - height / 2;
  const rooms: OfficeRoom[] = [
    {
      name: 'Cafe',
      x: 0,
      y: 0,
      w: CAFE_W,
      h: CAFE_H,
      door: 's',
      pieces: [
        // The counter, its stools, and the coffee machine and the fridge behind the end of it.
        { kind: 'bar', x: 40, y: 40 },
        ...stools([60, 120, 180, 240], 170),
        { kind: 'coffee-machine', x: 310, y: 48 },
        { kind: 'drinks-fridge', x: 400, y: 36 },
        // Two tables to share on the right, and a table for two (a pair of chairs facing each other).
        // An aisle between the two tables (docs/specs/007-editor/templates-by-mode.md "Every Space is roomy").
        { kind: 'meeting-table', x: 640, y: 60 },
        { kind: 'meeting-table', x: 640, y: 348 },
        { kind: 'chair', x: 330, y: 300, facing: 'w' },
        { kind: 'chair', x: 418, y: 300, facing: 'e' },
        // The sofa nook.
        { kind: 'rug', x: 60, y: 420 },
        { kind: 'sofa', x: 84, y: 440, facing: 'n' },
        { kind: 'plant', x: 920, y: 50 },
        { kind: 'plant', x: 920, y: 480 },
      ],
    },
  ];
  return spacePlan(
    x0,
    y0,
    width,
    rooms,
    {
      text: 'Cafe',
      width: 200,
      sticker: 'emoji-coffee',
      subtitle:
        'Meet for a coffee: a seat at the counter, a table to share, or the sofa in the corner.',
    },
    walkIn(
      x0 + width,
      y0 + SPACE_HEAD + CAFE_H + SPACE_BELOW / 2,
      'Press Walk In (or W) to come in. The coffee machine makes a coffee, and any seat is yours.',
    ),
  );
}
