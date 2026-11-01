// Two-elbow connector geometry shared by the tree-shaped templates (org
// chart, OKR tree, sitemap). Waypoints are chord-midpoint-relative, the
// shape an arrow's `curvePoints` expects.

import type { Anchor } from '@livehuddle/document';

type Point = { x: number; y: number };

// Three exits along a parent's bottom edge. Lines sharing one anchor are
// fanned apart at render time, which would skew a rake's first leg, so each
// child line leaves from its own point instead.
export const BOTTOM_EXITS: [Anchor, number][] = [
  ['ssw', 0.25],
  ['s', 0.5],
  ['sse', 0.75],
];

// Down, across, down: elbows on the chord's mid-height, so the line arrives
// square on the child's top.
export const rake = (from: Point, to: Point) => {
  const mx = (from.x + to.x) / 2;
  return [
    { dx: from.x - mx, dy: 0 },
    { dx: to.x - mx, dy: 0 },
  ];
};

// Across, up or down, across: the horizontal twin of `rake`, turning at `atX`.
export const sideRake = (from: Point, to: Point, atX: number) => {
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;
  return [
    { dx: atX - mx, dy: from.y - my },
    { dx: atX - mx, dy: to.y - my },
  ];
};

// The sixteen compass anchors, clockwise from north, as Anchor lists them.
const COMPASS: readonly Anchor[] = [
  'n',
  'nne',
  'ne',
  'ene',
  'e',
  'ese',
  'se',
  'sse',
  's',
  'ssw',
  'sw',
  'wsw',
  'w',
  'wnw',
  'nw',
  'nnw',
];

// The anchor on a box at `from` that faces `to` (both centres): a straight line between two boxes leaves and
// arrives on the sides that face each other (the Wardley map's needs, the threat model's flows).
export function anchorToward(from: Point, to: Point): Anchor {
  // Clockwise from north, in sixteenths of a turn (canvas y grows downward).
  const turn = Math.atan2(to.x - from.x, from.y - to.y) / (2 * Math.PI);
  return COMPASS[(Math.round(turn * 16) + 16) % 16]!;
}
