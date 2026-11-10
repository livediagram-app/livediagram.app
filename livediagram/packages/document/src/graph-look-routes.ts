// The graph look's routing kit (graph-look.ts): routed arrows' points from their fanned ends, and the detour search,
// box tests and one-bend routes the loop, spine and channel passes share.

import { anchorPrimarySide } from './anchors';
import { isContainerKind } from './containment';
import { arrowEndpointSpread } from './arrow-endpoint-spread';
import type { RectGrid } from '@liveworkspace/model-core/auto-layout-route-grid';
import { anchorPosition, endpointPosition } from './geometry';
import {
  routeOrthogonal,
  type Pt as RoutePt,
  type RouterBudget,
  type Run,
  type Side,
} from './orthogonal-router';
import type { Anchor, ArrowElement, BoxedElement, Element } from './index';

export type Pt = { x: number; y: number };

// Where an arrow end sits once fanned, as the renderers draw it.
export function endAt(arrow: ArrowElement, end: 'from' | 'to', elements: Element[]): Pt {
  const p = endpointPosition(arrow[end], elements);
  const s = arrowEndpointSpread(arrow.id, end, elements);
  return { x: p.x + s.x, y: p.y + s.y };
}

// An angled arrow through `points`, stored as chord-midpoint deltas (arrow-orthogonal.ts does the same).
export function through(arrow: ArrowElement, points: Pt[], elements: Element[]): ArrowElement {
  const from = endAt(arrow, 'from', elements);
  const to = endAt(arrow, 'to', elements);
  const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
  return {
    ...arrow,
    arrowStyle: 'angled',
    curvePoints: points.map((p) => ({ dx: p.x - mid.x, dy: p.y - mid.y })),
  };
}

export const pinnedId = (end: ArrowElement['from']) =>
  end.kind === 'pinned' ? end.elementId : null;

// How a routed arrow bends, worked out into points only once every pass has chosen its anchors (applyRoutes), since
// an anchor one pass picks moves the fanned ends of every arrow sharing it: a track, two bends at one cross position;
// or a corner, one bend, vertical first ('v': down then across) or horizontal first ('h').
export type Route =
  | { kind: 'track'; axis: 'TB' | 'LR'; at: number }
  | { kind: 'corner'; first: 'v' | 'h' }
  | { kind: 'path'; corners: RoutePt[] };
export type Routes = Map<string, Route>;

// Every routed arrow given its points from its final, fanned ends.
export function applyRoutes(elements: Element[], routes: Routes): Element[] {
  if (routes.size === 0) return elements;
  return elements.map((el) => {
    const route = el.type === 'arrow' ? routes.get(el.id) : undefined;
    if (!route || el.type !== 'arrow') return el;
    const from = endAt(el, 'from', elements);
    const to = endAt(el, 'to', elements);
    const points =
      route.kind === 'path'
        ? route.corners
        : route.kind === 'corner'
          ? [route.first === 'v' ? { x: from.x, y: to.y } : { x: to.x, y: from.y }]
          : route.axis === 'TB'
            ? [
                { x: route.at, y: from.y },
                { x: route.at, y: to.y },
              ]
            : [
                { x: from.x, y: route.at },
                { x: to.x, y: route.at },
              ];
    return through(el, points, elements);
  });
}

// Up to this many boxes a detour is searched for (orthogonal-router.ts); past it, the outside track.
export const ROUTER_MAX_BOXES = 120;
const SIDES: readonly Side[] = ['n', 'e', 's', 'w'];

// A side's anchors, its middle first then its quarters.
const SIDE_ANCHORS: Readonly<Record<Side, readonly Anchor[]>> = {
  n: ['n', 'nnw', 'nne'],
  e: ['e', 'ene', 'ese'],
  s: ['s', 'ssw', 'sse'],
  w: ['w', 'wnw', 'wsw'],
};

// The anchors on each element some arrow already ends at, once per end.
export function anchorsInUse(elements: readonly Element[]): Map<string, Anchor[]> {
  const used = new Map<string, Anchor[]>();
  for (const el of elements) {
    if (el.type !== 'arrow') continue;
    for (const end of [el.from, el.to])
      if (end.kind === 'pinned')
        (used.get(end.elementId) ?? used.set(end.elementId, []).get(end.elementId)!).push(
          end.anchor,
        );
  }
  return used;
}

// What a route pays per line already ending on a side it leaves or enters: two or three lines bunched on one side
// read as one, so a route takes a free side for a bend or two more (a third "no" into one rejection drops in by its
// top rather than squeezing in beside the other two).
const ROUTER_SIDE_LOAD_COST = 150;

// The cheapest clean route between two boxes over every pair of sides, or null. Each end takes its side's middle,
// or a quarter of that side when another arrow already ends at the middle, so two arrows never meet in one point.
export function bestRoute(
  src: BoxedElement,
  dst: BoxedElement,
  solid: readonly BoxedElement[],
  taken: readonly Run[],
  used: ReadonlyMap<string, readonly Anchor[]>,
  budget: RouterBudget,
): { fromAnchor: Anchor; toAnchor: Anchor; from: RoutePt; to: RoutePt; corners: RoutePt[] } | null {
  // The anchors free on a side: its middle when free, else its free quarters (the middle when none is free).
  const freeOn = (b: BoxedElement, side: Side): readonly Anchor[] => {
    const free = SIDE_ANCHORS[side].filter((a) => !used.get(b.id)?.includes(a));
    if (free[0] === SIDE_ANCHORS[side][0]) return [free[0]!];
    return free.length ? free : [SIDE_ANCHORS[side][0]!];
  };
  const load = (b: BoxedElement, side: Side) =>
    (used.get(b.id) ?? []).filter((a) => anchorPrimarySide(a) === side).length;
  let best: {
    fromAnchor: Anchor;
    toAnchor: Anchor;
    from: RoutePt;
    to: RoutePt;
    corners: RoutePt[];
    cost: number;
  } | null = null;
  for (const fromSide of SIDES)
    for (const toSide of SIDES)
      for (const fromAnchor of freeOn(src, fromSide))
        for (const toAnchor of freeOn(dst, toSide)) {
          const from = anchorPosition(src, fromAnchor);
          const to = anchorPosition(dst, toAnchor);
          const route = routeOrthogonal(from, fromSide, to, toSide, solid, taken, budget);
          if (!route) continue;
          const cost =
            route.cost + (load(src, fromSide) + load(dst, toSide)) * ROUTER_SIDE_LOAD_COST;
          if (!best || cost < best.cost)
            best = { fromAnchor, toAnchor, from, to, corners: route.corners, cost };
        }
  return best;
}

// Whether an arrow's drawn path (its ends and bends) passes through a box it does not connect.
export function crossesABox(
  arrow: ArrowElement,
  elements: Element[],
  solid: RectGrid,
  // Boxes the path may pass through (a frame holding one of its ends).
  skip?: (box: BoxedElement) => boolean,
): boolean {
  const from = endAt(arrow, 'from', elements);
  const to = endAt(arrow, 'to', elements);
  const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
  const bends = arrow.arrowStyle === 'angled' ? (arrow.curvePoints ?? []) : [];
  const path = [from, ...bends.map((p) => ({ x: mid.x + p.dx, y: mid.y + p.dy })), to];
  const ends = new Set([pinnedId(arrow.from), pinnedId(arrow.to)]);
  return path.slice(1).some((p, i) => {
    const a = path[i]!;
    const near = solid.near(
      Math.min(a.x, p.x),
      Math.min(a.y, p.y),
      Math.max(a.x, p.x),
      Math.max(a.y, p.y),
    ) as BoxedElement[];
    return near.some((b) => !ends.has(b.id) && !skip?.(b) && segmentHitsBox(a, p, b));
  });
}

// Whether the segment a→b passes through `box` shrunk by `inset` (positive: grazing is not hitting; negative: the
// box grown, a clearance).
export function segmentHitsBox(a: Pt, b: Pt, box: BoxedElement, inset = 4): boolean {
  const x0 = box.x + inset;
  const x1 = box.x + box.width - inset;
  const y0 = box.y + inset;
  const y1 = box.y + box.height - inset;
  // Most boxes lie wholly off the segment's own bounds: rejected before any clipping. A hot path (every routed arrow
  // against every box), so no arrays are made per call.
  if (Math.max(a.x, b.x) < x0 || Math.min(a.x, b.x) > x1) return false;
  if (Math.max(a.y, b.y) < y0 || Math.min(a.y, b.y) > y1) return false;
  // Liang-Barsky clip of the segment against the inset rectangle.
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  let t0 = 0;
  let t1 = 1;
  const clip = (p: number, q: number): boolean => {
    if (p === 0) return q >= 0;
    const r = q / p;
    if (p < 0) t0 = Math.max(t0, r);
    else t1 = Math.min(t1, r);
    return t0 <= t1;
  };
  return clip(-dx, a.x - x0) && clip(dx, x1 - a.x) && clip(-dy, a.y - y0) && clip(dy, y1 - a.y);
}

// A container (a frame, lane or boundary) is a backdrop the loop may cross; it never pushes the track out.
export const isBackdrop = (b: BoxedElement) => b.type === 'shape' && isContainerKind(b.shape);

// The one-bend route for a loop whose source sits clear beyond its target's outer side, or null: up (TB) from the
// source's top to the target's middle, then into the target's outer side. Null when a box stands on either leg.
// The elements a fan at `a` or `b` depends on: those two boxes, every arrow pinned to either, and the elements at
// those arrows' far ends; in their drawing order, so the fan is the one the whole drawing gives.
export function fanNeighbourhood(elements: Element[], a: string, b: string): Element[] {
  const ids = new Set([a, b]);
  for (const el of elements) {
    if (el.type !== 'arrow') continue;
    const [f, t] = [pinnedId(el.from), pinnedId(el.to)];
    if (f !== a && f !== b && t !== a && t !== b) continue;
    ids.add(el.id);
    if (f) ids.add(f);
    if (t) ids.add(t);
  }
  return elements.filter((el) => ids.has(el.id));
}

export function singleBend(
  arrow: ArrowElement,
  src: BoxedElement,
  dst: BoxedElement,
  boxes: BoxedElement[],
  axis: 'TB' | 'LR',
  elements: Element[],
): ArrowElement | null {
  const clear = axis === 'TB' ? src.x > dst.x + dst.width + 20 : src.y > dst.y + dst.height + 20;
  if (!clear) return null;
  const turned: ArrowElement = {
    ...arrow,
    from: { kind: 'pinned', elementId: src.id, anchor: axis === 'TB' ? 'n' : 'w' },
    to: { kind: 'pinned', elementId: dst.id, anchor: axis === 'TB' ? 'e' : 's' },
    exactStart: true,
    exactEnd: false,
  };
  // A fanned end moves only with the arrows pinned to its own box, so the ends are worked out on just those boxes,
  // the arrows touching them and the boxes at their far ends, in drawing order: the same fan, without fanning the
  // whole drawing once for every loop tried.
  const near = fanNeighbourhood(
    elements.map((el) => (el.id === arrow.id ? turned : el)),
    src.id,
    dst.id,
  );
  const from = endAt(turned, 'from', near);
  const to = endAt(turned, 'to', near);
  const corner = axis === 'TB' ? { x: from.x, y: to.y } : { x: to.x, y: from.y };
  const hits = (a: Pt, b: Pt) =>
    boxes.some((box) => {
      if (box.id === src.id || box.id === dst.id || isBackdrop(box)) return false;
      const [x0, x1] = [Math.min(a.x, b.x), Math.max(a.x, b.x)];
      const [y0, y1] = [Math.min(a.y, b.y), Math.max(a.y, b.y)];
      return (
        box.x < x1 + 4 &&
        box.x + box.width > x0 - 4 &&
        box.y < y1 + 4 &&
        box.y + box.height > y0 - 4
      );
    });
  if (hits(from, corner) || hits(corner, to)) return null;
  return turned;
}
