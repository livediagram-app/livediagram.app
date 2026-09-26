// The anchor table (docs/specs/008-canvas/arrow-anchors.md): for each of the
// sixteen anchors, its position class, the side(s) it lies on, where it sits
// on the connector box and which way a connector leaves it. Every rule about
// anchors (positions, the auto-rebind, fans, elbows) reads this one table.

import type { Anchor } from './arrow-types';
import type { Point } from './geometry-primitives';

export type Side = 'n' | 'e' | 's' | 'w';
export type AnchorClass = 'corner' | 'quarter' | 'middle';

type AnchorInfo = {
  cls: AnchorClass;
  // A corner lists its horizontal side first: that is its primary side.
  sides: readonly Side[];
  fx: number;
  fy: number;
  outward: Point;
};

const D = Math.SQRT1_2;

const TABLE: Record<Anchor, AnchorInfo> = {
  n: { cls: 'middle', sides: ['n'], fx: 0.5, fy: 0, outward: { x: 0, y: -1 } },
  nne: { cls: 'quarter', sides: ['n'], fx: 0.75, fy: 0, outward: { x: 0, y: -1 } },
  ne: { cls: 'corner', sides: ['n', 'e'], fx: 1, fy: 0, outward: { x: D, y: -D } },
  ene: { cls: 'quarter', sides: ['e'], fx: 1, fy: 0.25, outward: { x: 1, y: 0 } },
  e: { cls: 'middle', sides: ['e'], fx: 1, fy: 0.5, outward: { x: 1, y: 0 } },
  ese: { cls: 'quarter', sides: ['e'], fx: 1, fy: 0.75, outward: { x: 1, y: 0 } },
  se: { cls: 'corner', sides: ['s', 'e'], fx: 1, fy: 1, outward: { x: D, y: D } },
  sse: { cls: 'quarter', sides: ['s'], fx: 0.75, fy: 1, outward: { x: 0, y: 1 } },
  s: { cls: 'middle', sides: ['s'], fx: 0.5, fy: 1, outward: { x: 0, y: 1 } },
  ssw: { cls: 'quarter', sides: ['s'], fx: 0.25, fy: 1, outward: { x: 0, y: 1 } },
  sw: { cls: 'corner', sides: ['s', 'w'], fx: 0, fy: 1, outward: { x: -D, y: D } },
  wsw: { cls: 'quarter', sides: ['w'], fx: 0, fy: 0.75, outward: { x: -1, y: 0 } },
  w: { cls: 'middle', sides: ['w'], fx: 0, fy: 0.5, outward: { x: -1, y: 0 } },
  wnw: { cls: 'quarter', sides: ['w'], fx: 0, fy: 0.25, outward: { x: -1, y: 0 } },
  nw: { cls: 'corner', sides: ['n', 'w'], fx: 0, fy: 0, outward: { x: -D, y: -D } },
  nnw: { cls: 'quarter', sides: ['n'], fx: 0.25, fy: 0, outward: { x: 0, y: -1 } },
};

const ORDER = Object.keys(TABLE) as Anchor[];

export function anchorClass(a: Anchor): AnchorClass {
  return TABLE[a].cls;
}

export function anchorSides(a: Anchor): readonly Side[] {
  return TABLE[a].sides;
}

export function anchorPrimarySide(a: Anchor): Side {
  return TABLE[a].sides[0]!;
}

export function anchorLiesOn(a: Anchor, side: Side): boolean {
  return TABLE[a].sides.includes(side);
}

// The anchors of one position class on one side, in table order: one middle,
// two quarters or two corners.
export function anchorsOf(side: Side, cls: AnchorClass): readonly Anchor[] {
  return ORDER.filter((a) => TABLE[a].cls === cls && TABLE[a].sides.includes(side));
}

// Where the anchor sits on its (unrotated) connector box, as fractions of
// the width and height from the top-left corner.
export function anchorFraction(a: Anchor): { fx: number; fy: number } {
  const { fx, fy } = TABLE[a];
  return { fx, fy };
}

// The unit direction a connector leaves the anchor in (unrotated).
export function anchorOutward(a: Anchor): Point {
  return TABLE[a].outward;
}
