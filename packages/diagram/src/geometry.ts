import {
  arrowLabelAnchor,
  arrowStyleOf,
  isBoxed,
  type Anchor,
  type BoxedElement,
  type Element,
  type ElementId,
  type Endpoint,
} from './index';
import { anchorLayoutPoint } from './anchor-layouts';
import { anchorFraction, anchorLiesOn, offeredAnchors } from './anchors';
import { rotatePoint, unionRects, type Point, type Rect } from './geometry-primitives';
import { anchorOutline, connectorBox, projectOntoOutline } from './shape-outline';

// --- Geometry helpers ------------------------------------------------------

// The dependency-free primitives (Point, Rect, clamp, rect tests, unions)
// live in a leaf module so modules that must not import the barrel at
// runtime (shadow.ts, web-components.ts) can still share them.
export * from './geometry-primitives';

// Works on any boxed element since they share x/y/width/height. When the
// element carries a `rotation`, the anchor is rotated about the
// element's centre so a pinned arrow lands on the visually-rotated edge,
// not the pre-rotation position. Every pinned endpoint (rendering) and
// snapToAnchor (pinning) resolve through here, so they stay consistent.
//
// For non-rectangular shapes the anchor is first projected onto the shape's
// real outline (so a connector touches a diamond's edge, not the empty bbox
// corner) before any rotation is applied.
export function anchorPosition(element: BoxedElement, anchor: Anchor): Point {
  const box = connectorBox(element);
  const { fx, fy } = anchorFraction(anchor);
  let local: Point = { x: box.x + fx * box.width, y: box.y + fy * box.height };
  // A face-placed anchor (triangle, hexagon, parallelogram, trapezoid) sits
  // at its own point along a drawn face, already on the outline.
  const placed =
    box === element && element.type === 'shape' ? anchorLayoutPoint(element.shape, anchor) : null;
  // Project onto the shape's real outline only when the connector box IS the
  // element box: a Technology icon's mark is a plain rounded square, so its
  // box anchors are already on the visible edge.
  const outline = box === element && !placed ? anchorOutline(element) : null;
  if (placed) {
    local = { x: box.x + (placed[0] / 100) * box.width, y: box.y + (placed[1] / 100) * box.height };
  } else if (outline) {
    const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    const projected = projectOntoOutline(outline, centre, local);
    if (projected) local = projected;
  } else if (box !== element && element.label) {
    // Tech icon with a caption: the caption sits between the mark and the
    // element edge on its side, so the anchors on THAT side push out to the
    // element edge — a connector leaving toward the caption starts past the
    // text (under a bottom caption, above a top one, beyond a left/right
    // one) instead of crossing it. The other sides stay on the chip.
    const alignX = element.textAlignX ?? 'center';
    const alignY = element.textAlignY ?? 'bottom';
    if (alignX === 'left' && anchorLiesOn(anchor, 'w')) {
      local = { x: element.x, y: local.y };
    } else if (alignX === 'right' && anchorLiesOn(anchor, 'e')) {
      local = { x: element.x + element.width, y: local.y };
    } else if (alignX === 'center' && alignY === 'bottom' && anchorLiesOn(anchor, 's')) {
      local = { x: local.x, y: element.y + element.height };
    } else if (alignX === 'center' && alignY !== 'bottom' && anchorLiesOn(anchor, 'n')) {
      local = { x: local.x, y: element.y };
    }
  }
  const rotation = element.rotation ?? 0;
  if (!rotation) return local;
  // Rotation is about the ELEMENT's centre (that's how the canvas rotates
  // the whole box, mark included), not the connector box's own centre.
  return rotatePoint(
    local,
    { x: element.x + element.width / 2, y: element.y + element.height / 2 },
    rotation,
  );
}

// `anchor` when the element offers it, else the offered anchor nearest its
// point (first in table order on a tie): what a quick-connect from a side
// without anchors, such as a triangle's top, pins to.
export function nearestOfferedAnchor(element: BoxedElement, anchor: Anchor): Anchor {
  const offered = offeredAnchors(element);
  if (offered.includes(anchor)) return anchor;
  const from = anchorPosition(element, anchor);
  let best = offered[0] ?? anchor;
  let bestD = Infinity;
  for (const a of offered) {
    const p = anchorPosition(element, a);
    const d = (p.x - from.x) ** 2 + (p.y - from.y) ** 2;
    if (d < bestD - 1e-9) {
      bestD = d;
      best = a;
    }
  }
  return best;
}

export function centreOf(el: BoxedElement): Point {
  const box = connectorBox(el);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

// An id -> element lookup. Callers that resolve many endpoints over
// the same element set (every arrow on a render, every arrow on a
// marquee sweep) build this once and pass it instead of the raw
// array, turning each endpoint resolution from an O(n) `find` into an
// O(1) `get`.
export type ElementIndex = ReadonlyMap<ElementId, Element>;

export function buildElementIndex(elements: Element[]): Map<ElementId, Element> {
  const index = new Map<ElementId, Element>();
  for (const el of elements) index.set(el.id, el);
  return index;
}

// Accepts either the raw element array or a prebuilt index. The array
// overload stays for one-off resolutions (a single drag handle);
// per-element loops should pass an index so the whole pass is O(n)
// rather than O(n^2).
export function endpointPosition(
  endpoint: Endpoint,
  elements: Element[] | ElementIndex,
  // Internal recursion guard: an `on-arrow` endpoint resolves through the
  // target arrow's own endpoints, which could themselves be `on-arrow`. Bail
  // after a few hops so a pathological cycle can't recurse forever.
  depth = 0,
): Point {
  if (endpoint.kind === 'free') return { x: endpoint.x, y: endpoint.y };
  const lookup = (id: ElementId): Element | undefined =>
    elements instanceof Map ? elements.get(id) : (elements as Element[]).find((el) => el.id === id);
  if (endpoint.kind === 'on-arrow') {
    if (depth > 4) return { x: 0, y: 0 };
    const target = lookup(endpoint.arrowId);
    if (!target || target.type !== 'arrow') return { x: 0, y: 0 };
    const from = endpointPosition(target.from, elements, depth + 1);
    const to = endpointPosition(target.to, elements, depth + 1);
    return arrowLabelAnchor(
      arrowStyleOf(target),
      from,
      to,
      target.from,
      target.to,
      target.curveOffset,
      target.elbowOffset,
      { t: endpoint.t, offset: 0 },
      target.curvePoints,
    );
  }
  const target = lookup(endpoint.elementId);
  if (!target || !isBoxed(target)) return { x: 0, y: 0 };
  return anchorPosition(target, endpoint.anchor);
}

export function elementBounds(element: Element, elements: Element[]): Rect {
  if (isBoxed(element)) {
    return { x: element.x, y: element.y, width: element.width, height: element.height };
  }
  const from = endpointPosition(element.from, elements);
  const to = endpointPosition(element.to, elements);
  return {
    x: Math.min(from.x, to.x),
    y: Math.min(from.y, to.y),
    width: Math.abs(to.x - from.x),
    height: Math.abs(to.y - from.y),
  };
}

// Union bounding box of any selection, INCLUDING arrows (their endpoint
// AABB). Unlike `unionBoxedBounds`, which only spans boxed elements, this
// covers arrow-only / mixed selections — used to anchor the floating
// selection toolbar over a marquee that grabbed arrows. Returns null when
// no listed id matches.
export function unionElementBounds(elements: Element[], ids: Set<ElementId>): Rect | null {
  return unionRects(
    elements.filter((el) => ids.has(el.id)).map((el) => elementBounds(el, elements)),
  );
}
