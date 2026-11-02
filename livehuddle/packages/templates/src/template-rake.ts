// Two-elbow connector geometry for the tree-shaped templates (the
// opportunity solution tree). Waypoints are chord-midpoint-relative, the
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
