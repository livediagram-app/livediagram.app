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

import {
  isBoxed,
  type Anchor,
  type ArrowElement,
  type Element,
  type ElementId,
  type Endpoint,
} from './index';
import { connectorBox, endpointPosition, type ElementIndex, type Point } from './geometry';
import { groupUnionBounds } from './groups';

// Gap between adjacent fanned heads, in canvas px. Clamped down when the
// fan would otherwise occupy more than SPREAD_EDGE_FRACTION of the target
// edge (many arrows into a small box).
const SPREAD_SPACING = 14;
const SPREAD_EDGE_FRACTION = 0.8;

// Which axis a fan runs along, per anchor: ends on the top / bottom edges
// slide horizontally, ends on the left / right edges vertically. Corner
// anchors belong to their horizontal edge.
function spreadAxis(anchor: Anchor): 'x' | 'y' {
  return anchor === 'e' || anchor === 'w' ? 'y' : 'x';
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
  if (endpoint.kind === 'pinned-group') return `gr:${endpoint.groupId}:${endpoint.anchor}`;
  return null;
}

// The edge length available to a fan, and the target's rotation (a rotated
// element rotates its edges, so the offsets must rotate with them).
function fanFrame(
  endpoint: Endpoint,
  elements: Element[],
  index: ElementIndex,
): { span: number; rotation: number; anchor: Anchor } | null {
  if (endpoint.kind === 'pinned') {
    const target = index.get(endpoint.elementId);
    if (!target || !isBoxed(target)) return null;
    const box = connectorBox(target);
    return {
      span: spreadAxis(endpoint.anchor) === 'x' ? box.width : box.height,
      rotation: target.rotation ?? 0,
      anchor: endpoint.anchor,
    };
  }
  if (endpoint.kind === 'pinned-group') {
    const bounds = groupUnionBounds(elements, endpoint.groupId);
    if (!bounds) return null;
    return {
      span: spreadAxis(endpoint.anchor) === 'x' ? bounds.width : bounds.height,
      rotation: 0,
      anchor: endpoint.anchor,
    };
  }
  return null;
}

// Compute every fanned end's offset for one element set. Keyed
// `${arrowId}:${end}`; ends that don't converge (or aren't pinned) are
// simply absent.
function computeSpreadMap(elements: Element[], index: ElementIndex): Map<string, Point> {
  const groups = new Map<string, ConvergingEnd[]>();
  const frames = new Map<string, { span: number; rotation: number; anchor: Anchor }>();
  for (const el of elements) {
    if (el.type !== 'arrow') continue;
    const arrow = el as ArrowElement;
    for (const end of ['from', 'to'] as const) {
      const endpoint = arrow[end];
      const key = pinKey(endpoint);
      if (!key) continue;
      if (!frames.has(key)) {
        const frame = fanFrame(endpoint, elements, index);
        if (!frame) continue;
        frames.set(key, frame);
      }
      const other = endpointPosition(end === 'from' ? arrow.to : arrow.from, index);
      const list = groups.get(key);
      if (list) list.push({ arrowId: arrow.id, end, other });
      else groups.set(key, [{ arrowId: arrow.id, end, other }]);
    }
  }

  const offsets = new Map<string, Point>();
  for (const [key, ends] of groups) {
    if (ends.length < 2) continue;
    const frame = frames.get(key);
    if (!frame) continue;
    const axis = spreadAxis(frame.anchor);
    const n = ends.length;
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
    const sorted = [...ends].sort(
      (a, b) =>
        (axis === 'x' ? a.other.x - b.other.x : a.other.y - b.other.y) ||
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
  return offsets;
}

// Per-collection memo so both render paths can call per arrow without
// recomputing the whole map each time. Keyed on the collection's identity;
// tab state is immutable, so a changed tab is a new array / index.
const spreadCache = new WeakMap<object, Map<string, Point>>();

function spreadMapFor(elements: Element[] | ElementIndex): Map<string, Point> {
  const key = elements as object;
  const cached = spreadCache.get(key);
  if (cached) return cached;
  const list = elements instanceof Map ? [...elements.values()] : (elements as Element[]);
  const index =
    elements instanceof Map
      ? (elements as ElementIndex)
      : new Map(list.map((el) => [el.id, el] as const));
  const map = computeSpreadMap(list, index);
  spreadCache.set(key, map);
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
