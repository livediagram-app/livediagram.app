// The anchor table (docs/specs/008-canvas/arrow-anchors.md): for each of the
// sixteen anchors, its position class, the side(s) it lies on, where it sits
// on the connector box and which way a connector leaves it. Every rule about
// anchors (positions, the auto-rebind, fans, elbows) reads this one table.

import type { Anchor } from './arrow-types';
import type { BoxedElement } from './index';
import type { ShapeKind } from './shape-kind';
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

// ANCHOR SETS (docs/specs/008-canvas/arrow-anchors.md "Anchor sets"): the
// position classes an element offers. Every set holds the middles (the
// creation anchors and the anchor dots). Kinds absent from the map get the
// full sixteen.
export const FULL_ANCHOR_SET: readonly AnchorClass[] = ['corner', 'quarter', 'middle'];
const COMPASS_ANCHOR_SET: readonly AnchorClass[] = ['corner', 'middle'];

const ANCHOR_SETS: Partial<Record<ShapeKind, readonly AnchorClass[]>> = {
  circle: COMPASS_ANCHOR_SET,
};

export function anchorSetOf(el: BoxedElement): readonly AnchorClass[] {
  return (el.type === 'shape' && ANCHOR_SETS[el.shape]) || FULL_ANCHOR_SET;
}

const offeredCache = new Map<readonly AnchorClass[], readonly Anchor[]>();

// The anchors an element offers, in table order (clockwise from north).
export function offeredAnchors(el: BoxedElement): readonly Anchor[] {
  const set = anchorSetOf(el);
  let anchors = offeredCache.get(set);
  if (!anchors) {
    anchors = ORDER.filter((a) => set.includes(TABLE[a].cls));
    offeredCache.set(set, anchors);
  }
  return anchors;
}

// The class an end takes on this element: its own when offered, else the
// nearest offered one. The middle is always offered, so this always lands.
const FALLBACK: Record<AnchorClass, readonly AnchorClass[]> = {
  quarter: ['quarter', 'corner', 'middle'],
  corner: ['corner', 'quarter', 'middle'],
  middle: ['middle'],
};

export function offeredClass(el: BoxedElement, cls: AnchorClass): AnchorClass {
  const set = anchorSetOf(el);
  return FALLBACK[cls].find((c) => set.includes(c)) ?? 'middle';
}
