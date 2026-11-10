// Fan-out for converging arrow endpoints. When several arrows pin to the
// SAME anchor of the same element (a hub node with four children all
// pointing at its 's' anchor), every head resolves to the identical point
// and the arrowheads pile into an unreadable blur. This helper hands each
// such end a small tangential offset ALONG the target edge so the heads
// land side by side. Purely visual: the stored endpoints are untouched, so
// rebinding, snapping, and hit-testing still reason about the true anchor.
//
// Consumed by both render paths (the live canvas's arrow-view-frame and
// the SVG export's svgArrow), which is why it lives here rather than in
// the app.

import { isBoxed, type Anchor, type ArrowElement, type Element, type ElementId, type Endpoint, type ElementIndex } from './index';
import { anchorClass, anchorPrimarySide } from './anchors';
import { endpointPosition, isElementIndex, type Point } from './geometry';
import { connectorBox } from './shape-outline';

// Gap between adjacent fanned heads, in canvas px. Clamped down when the
// fan would otherwise occupy more than SPREAD_EDGE_FRACTION of the target
// edge (many arrows into a small box).
const SPREAD_SPACING = 14;
const SPREAD_EDGE_FRACTION = 0.8;
// A quarter's fan is centred on it and must stay between its corner and its
// edge's middle, so its room is half the edge
// (docs/specs/008-canvas/arrow-anchors.md).
const QUARTER_FAN_ROOM = 0.5;

// Which axis a fan runs along, per anchor: ends on the top / bottom edges
// slide horizontally, ends on the left / right edges vertically. Corner
// anchors belong to their horizontal edge (their primary side).
function spreadAxis(anchor: Anchor): 'x' | 'y' {
  const side = anchorPrimarySide(anchor);
  return side === 'e' || side === 'w' ? 'y' : 'x';
}

// Corner fans can't be centred on the anchor (half the heads would float
// off the box), so they march INWARD along the edge instead. Returns the
// inward sign for a corner anchor, or null for a face anchor (centred).
function cornerInwardSign(anchor: Anchor): 1 | -1 | null {
  switch (anchor) {
    case 'ne':
    case 'se':
      return -1;
    case 'nw':
    case 'sw':
      return 1;
    default:
      return null;
  }
}

type ConvergingEnd = {
  arrowId: ElementId;
  end: 'from' | 'to';
  // Where the arrow's OTHER endpoint sits, so the fan can order the slots
  // to match the incoming directions and the lines don't cross.
  other: Point;
};

function pinKey(endpoint: Endpoint): string | null {
  if (endpoint.kind === 'pinned') return `el:${endpoint.elementId}:${endpoint.anchor}`;
  return null;
}

// The edge length available to a fan, and the target's rotation (a rotated
// element rotates its edges, so the offsets must rotate with them).
function fanFrame(
  endpoint: Endpoint,
  index: ElementIndex,
): { span: number; rotation: number; anchor: Anchor } | null {
  if (endpoint.kind === 'pinned') {
    const target = index.get(endpoint.elementId);
    if (!target || !isBoxed(target)) return null;
    const box = connectorBox(target);
    const edge = spreadAxis(endpoint.anchor) === 'x' ? box.width : box.height;
    return {
      span: anchorClass(endpoint.anchor) === 'quarter' ? edge * QUARTER_FAN_ROOM : edge,
      rotation: target.rotation ?? 0,
      anchor: endpoint.anchor,
    };
  }
  return null;
}

// One end converging on a shared pin. The arrow itself is read from the index the fan is placed against.
type FanEnd = { arrowId: ElementId; end: 'from' | 'to'; endpoint: Endpoint };

// The arrow ends that converge on each pin, keyed `el:<id>:<anchor>`, in the order the elements list them, for the
// pins with a box to fan along (fanFrame). Which end joins which fan reads only the arrows' own ends, never a box's
// place.
function collectFans(elements: Iterable<Element>, index: ElementIndex): Map<string, FanEnd[]> {
  const groups = new Map<string, FanEnd[]>();
  const framed = new Set<string>();
  for (const el of elements) {
    if (el.type !== 'arrow') continue;
    const arrow = el;
    for (const end of ['from', 'to'] as const) {
      // An end set exactly at its anchor (exactStart, exactEnd) sits out of that anchor's fan.
      if (end === 'from' && arrow.exactStart === true) continue;
      if (end === 'to' && arrow.exactEnd === true) continue;
      const endpoint = arrow[end];
      const key = pinKey(endpoint);
      if (!key) continue;
      if (!framed.has(key)) {
        if (!fanFrame(endpoint, index)) continue;
        framed.add(key);
      }
      const list = groups.get(key);
      if (list) list.push({ arrowId: arrow.id, end, endpoint });
      else groups.set(key, [{ arrowId: arrow.id, end, endpoint }]);
    }
  }
  return groups;
}

// Places one pin's fan (two or more ends) against `index`, writing each end's offset into `offsets`.
function placeFan(ends: readonly FanEnd[], index: ElementIndex, offsets: Map<string, Point>): void {
  const n = ends.length;
  if (n < 2) return;
  // The pin's box, anchor and point, read through its first end, as they always were.
  const first = ends[0]!.endpoint;
  const frame = fanFrame(first, index);
  if (!frame) return;
  const at = endpointPosition(first, index);
  const converging: ConvergingEnd[] = ends.map((e) => {
    const arrow = index.get(e.arrowId) as ArrowElement;
    return {
      arrowId: e.arrowId,
      end: e.end,
      other: endpointPosition(e.end === 'from' ? arrow.to : arrow.from, index),
    };
  });
  const axis = spreadAxis(frame.anchor);
  const spacing = Math.min(SPREAD_SPACING, (frame.span * SPREAD_EDGE_FRACTION) / (n - 1));
  // Slot positions along the edge: centred on the anchor for a face,
  // marching inward from a corner.
  const inward = cornerInwardSign(frame.anchor);
  // `|| 0` normalises the -0 that `inward * spacing * 0` produces.
  const slots = Array.from({ length: n }, (_, i) =>
    inward === null ? (i - (n - 1) / 2) * spacing || 0 : inward * spacing * i || 0,
  ).sort((a, b) => a - b);
  // Match ascending slots to ends sorted by where they come FROM along
  // the same axis, so neighbouring arrows don't cross at the fan.
  // Ends coming from one place along the edge (two steps in one column) tie on that: the nearer takes the slot on
  // the side they come from, so its run stops short of the farther one's instead of crossing it.
  const along = (q: Point) => (axis === 'x' ? q.x : q.y);
  const across = (q: Point) => (axis === 'x' ? q.y : q.x);
  const nearness = (e: ConvergingEnd) =>
    Math.abs(across(e.other) - across(at)) * Math.sign(along(at) - along(e.other));
  // Whole pixels, so "level" is a consistent bucket: ties within a pixel either way (0, 0.8, 1.6) are not transitive,
  // and a sort given an inconsistent comparator ordered the fan by the arrows' order on the tab.
  const sorted = converging.sort(
    (a, b) =>
      Math.round(along(a.other)) - Math.round(along(b.other)) ||
      nearness(a) - nearness(b) ||
      (a.arrowId < b.arrowId ? -1 : 1),
  );
  const rad = (frame.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  sorted.forEach((e, i) => {
    const t = slots[i] ?? 0;
    const local = axis === 'x' ? { x: t, y: 0 } : { x: 0, y: t };
    // Rotate the tangential offset with the target so the fan stays on
    // the (rotated) edge.
    offsets.set(`${e.arrowId}:${e.end}`, {
      x: local.x * cos - local.y * sin,
      y: local.x * sin + local.y * cos,
    });
  });
}

// Compute every fanned end's offset for one element set. Keyed
// `${arrowId}:${end}`; ends that don't converge (or aren't pinned) are
// simply absent.
function computeSpreadMap(elements: Iterable<Element>, index: ElementIndex): Map<string, Point> {
  const offsets = new Map<string, Point>();
  for (const ends of collectFans(elements, index).values()) placeFan(ends, index, offsets);
  return offsets;
}

// Per-collection memo so both render paths can call per arrow without
// recomputing the whole map each time. Keyed on the collection's identity;
// tab state is immutable, so a changed tab is a new array / index.
const spreadCache = new WeakMap<object, Map<string, Point>>();

// What a board's fans read: each fan of two or more ends, and for each element id the fans that read it (the pin's
// box, each end's arrow, the box each end's other end is pinned to). A fan with an end whose other end sits on an
// arrow reads that arrow's ends in turn, so it is `volatile`: placed again whenever anything changed. Built once per
// board index.
type FanPlan = {
  fans: Map<string, FanEnd[]>;
  readers: Map<ElementId, string[]>;
  volatile: string[];
  // Each arrow's pins, as one key that changes when the fans it joins could.
  membership: Map<ElementId, string>;
};
const planCache = new WeakMap<ElementIndex, FanPlan>();

const membershipOf = (arrow: ArrowElement) =>
  `${arrow.exactStart === true ? '' : (pinKey(arrow.from) ?? '')}|${arrow.exactEnd === true ? '' : (pinKey(arrow.to) ?? '')}`;

function fanPlanFor(base: ElementIndex): FanPlan {
  const cached = planCache.get(base);
  if (cached) return cached;
  const plan: FanPlan = {
    fans: new Map(),
    readers: new Map(),
    volatile: [],
    membership: new Map(),
  };
  const read = (id: ElementId, key: string) => {
    const list = plan.readers.get(id);
    if (!list) plan.readers.set(id, [key]);
    else if (list[list.length - 1] !== key) list.push(key);
  };
  for (const el of base.values())
    if (el.type === 'arrow') plan.membership.set(el.id, membershipOf(el));
  for (const [key, ends] of collectFans(base.values(), base)) {
    if (ends.length < 2) continue;
    plan.fans.set(key, ends);
    const pin = ends[0]!.endpoint;
    if (pin.kind === 'pinned') read(pin.elementId, key);
    let volatile = false;
    for (const e of ends) {
      read(e.arrowId, key);
      const arrow = base.get(e.arrowId) as ArrowElement;
      const other = e.end === 'from' ? arrow.to : arrow.from;
      if (other.kind === 'pinned') read(other.elementId, key);
      else if (other.kind === 'on-arrow') volatile = true;
    }
    if (volatile) plan.volatile.push(key);
  }
  planCache.set(base, plan);
  return plan;
}

// Indexes laid over another (a drag preview's board): the base each was laid over and the ids it replaced.
const overlays = new WeakMap<ElementIndex, { base: ElementIndex; changed: readonly ElementId[] }>();

/**
 * Says that `index` is `base` with the elements of `changed` replaced, and nothing added or removed: a drag
 * preview's board, built once a frame. Its fans are then placed from base's, again only where a fan reads a changed
 * element, instead of over every arrow on the board; the offsets are the same as placing every fan over `index`.
 * Call it before the first arrowEndpointSpread over `index`.
 */
export function spreadOverBase(
  index: ElementIndex,
  base: ElementIndex,
  changed: Iterable<ElementId>,
): void {
  overlays.set(index, { base, changed: [...changed] });
}

// `index`'s offsets from its base's, or null when the overlay could change which ends fan where (an arrow's pins
// changed, an element came or went, a box stopped being one): then only placing every fan again is the same.
function spreadFromBase(index: ElementIndex): Map<string, Point> | null {
  const overlay = overlays.get(index);
  if (!overlay) return null;
  const { base, changed } = overlay;
  if (base.size !== index.size) return null;
  const plan = fanPlanFor(base);
  const dirty = new Set<string>();
  for (const id of changed) {
    const was = base.get(id);
    const now = index.get(id);
    if (!was || !now || was.type !== now.type || isBoxed(was) !== isBoxed(now)) return null;
    if (now.type === 'arrow' && plan.membership.get(id) !== membershipOf(now)) return null;
    for (const key of plan.readers.get(id) ?? []) dirty.add(key);
  }
  if (changed.length > 0) for (const key of plan.volatile) dirty.add(key);
  const offsets = new Map(spreadMapFor(base));
  for (const key of dirty) placeFan(plan.fans.get(key)!, index, offsets);
  return offsets;
}

function spreadMapFor(elements: Element[] | ElementIndex): Map<string, Point> {
  const cached = spreadCache.get(elements);
  if (cached) return cached;
  const map = isElementIndex(elements)
    ? (spreadFromBase(elements) ?? computeSpreadMap(elements.values(), elements))
    : computeSpreadMap(elements, new Map(elements.map((el) => [el.id, el] as const)));
  spreadCache.set(elements, map);
  return map;
}

// The visual offset for one arrow end: {0,0} unless this end converges on
// a shared pin with at least one other arrow end.
export function arrowEndpointSpread(
  arrowId: ElementId,
  end: 'from' | 'to',
  elements: Element[] | ElementIndex,
): Point {
  return spreadMapFor(elements).get(`${arrowId}:${end}`) ?? { x: 0, y: 0 };
}

/**
 * The two points an arrow's line runs between: its anchors, slid along the edge by the converging-fan
 * spread above. One resolution for the canvas and every export, so the two agree.
 */
export function spreadArrowEnds(
  arrow: { id: ElementId; from: Endpoint; to: Endpoint },
  elements: Element[] | ElementIndex,
): { from: Point; to: Point } {
  const from = endpointPosition(arrow.from, elements);
  const to = endpointPosition(arrow.to, elements);
  const fromSpread = arrowEndpointSpread(arrow.id, 'from', elements);
  const toSpread = arrowEndpointSpread(arrow.id, 'to', elements);
  return {
    from: { x: from.x + fromSpread.x, y: from.y + fromSpread.y },
    to: { x: to.x + toSpread.x, y: to.y + toSpread.y },
  };
}
