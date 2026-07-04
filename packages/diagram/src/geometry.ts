import { isTechIconId } from '@livediagram/icons';
import {
  arrowLabelAnchor,
  arrowStyleOf,
  boundsAnchorPoint,
  groupUnionBounds,
  isBoxed,
  type Anchor,
  type BoxedElement,
  type Element,
  type ElementId,
  type Endpoint,
} from './index';
import { techIconMarkBounds } from './icon-size';

// --- Geometry helpers ------------------------------------------------------

export type Point = { x: number; y: number };

// Rotate `p` clockwise about `center` by `deg` degrees, matching the
// CSS `transform: rotate(deg)` the canvas applies to a rotated element
// (positive = clockwise in the y-down canvas space). Pure helper shared
// by anchorPosition + the face selection in anchor-choice.ts.
export function rotatePoint(p: Point, center: Point, deg: number): Point {
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = p.x - center.x;
  const dy = p.y - center.y;
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
  };
}

// The anchor point on the element's UNROTATED axis-aligned box.
function localAnchorPosition(
  x: number,
  y: number,
  width: number,
  height: number,
  anchor: Anchor,
): Point {
  switch (anchor) {
    case 'nw':
      return { x, y };
    case 'n':
      return { x: x + width / 2, y };
    case 'ne':
      return { x: x + width, y };
    case 'e':
      return { x: x + width, y: y + height / 2 };
    case 'se':
      return { x: x + width, y: y + height };
    case 's':
      return { x: x + width / 2, y: y + height };
    case 'sw':
      return { x, y: y + height };
    case 'w':
      return { x, y: y + height / 2 };
  }
}

// Outline polygons for the SVG-rendered shapes whose drawn edge differs
// from their bounding box, in the shared 0..100 viewBox the overlay paints
// in (apps/live/components/shape-svg-overlay.tsx). Kept in lock-step with
// that file: an anchor projected onto these vertices lands on the line the
// user actually sees. Convex only — the ray-exit test below assumes one
// boundary crossing, so non-convex shapes (star, cloud, speech-bubble) are
// deliberately absent and fall back to the bounding box.
const SHAPE_OUTLINES: Partial<Record<string, readonly [number, number][]>> = {
  diamond: [
    [50, 0],
    [100, 50],
    [50, 100],
    [0, 50],
  ],
  parallelogram: [
    [20, 0],
    [100, 0],
    [80, 100],
    [0, 100],
  ],
  hexagon: [
    [25, 0],
    [75, 0],
    [100, 50],
    [75, 100],
    [25, 100],
    [0, 50],
  ],
  triangle: [
    [50, 2],
    [98, 98],
    [2, 98],
  ],
  trapezoid: [
    [22, 4],
    [78, 4],
    [98, 96],
    [2, 96],
  ],
};

// Project a bounding-box anchor onto the shape's actual drawn outline, so a
// connector meets a diamond's slanted edge or a circle's curve instead of
// floating in the empty bounding-box corner. Returns the point where the ray
// from the shape centre through the bbox anchor exits the shape, or null when
// the shape's outline IS its box (square, devices, text/table/sticky/image)
// so the caller keeps the plain anchor. Works in the element's local
// (unrotated) px space; the caller rotates the result out to world space.
function projectAnchorToShape(
  shape: string,
  x: number,
  y: number,
  width: number,
  height: number,
  p: Point,
): Point | null {
  if (width <= 0 || height <= 0) return null;
  const cx = x + width / 2;
  const cy = y + height / 2;
  const dx = p.x - cx;
  const dy = p.y - cy;
  if (Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9) return null;

  // Circle renders as an ellipse filling the box; intersect the centre->anchor
  // ray with that ellipse directly (cheaper + exact vs polygonising it).
  if (shape === 'circle') {
    const hx = width / 2;
    const hy = height / 2;
    const t = 1 / Math.sqrt((dx / hx) ** 2 + (dy / hy) ** 2);
    return { x: cx + dx * t, y: cy + dy * t };
  }

  const outline = SHAPE_OUTLINES[shape];
  if (!outline) return null;

  // Vertices mapped from the 0..100 viewBox into local px.
  const verts = outline.map(([vx, vy]) => ({
    x: x + (vx / 100) * width,
    y: y + (vy / 100) * height,
  }));
  // Smallest positive t where the ray centre + t*(dx,dy) crosses an edge.
  let bestT = Infinity;
  for (let i = 0; i < verts.length; i++) {
    const a = verts[i]!;
    const b = verts[(i + 1) % verts.length]!;
    const ex = b.x - a.x;
    const ey = b.y - a.y;
    const det = ex * dy - dx * ey;
    if (Math.abs(det) < 1e-9) continue; // ray parallel to this edge
    const rx = a.x - cx;
    const ry = a.y - cy;
    const t = (ex * ry - rx * ey) / det;
    const s = (dx * ry - rx * dy) / det;
    if (t > 1e-6 && s >= -1e-6 && s <= 1 + 1e-6 && t < bestT) bestT = t;
  }
  if (!Number.isFinite(bestT)) return null;
  return { x: cx + dx * bestT, y: cy + dy * bestT };
}

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
  let local = localAnchorPosition(box.x, box.y, box.width, box.height, anchor);
  // Project onto the shape's real outline only when the connector box IS the
  // element box — a Technology icon's mark is a plain rounded square, so its
  // rect anchors are already on the visible edge.
  if (element.type === 'shape' && box === element) {
    const projected = projectAnchorToShape(
      element.shape,
      element.x,
      element.y,
      element.width,
      element.height,
      local,
    );
    if (projected) local = projected;
  } else if (box !== element && element.label) {
    // Tech icon with a caption: the caption sits between the mark and the
    // element edge on its side, so the anchors on THAT side push out to the
    // element edge — a connector leaving toward the caption starts past the
    // text (under a bottom caption, above a top one, beyond a left/right
    // one) instead of crossing it. The other sides stay on the chip.
    const alignX = element.textAlignX ?? 'center';
    const alignY = element.textAlignY ?? 'bottom';
    if (alignX === 'left' && (anchor === 'w' || anchor === 'nw' || anchor === 'sw')) {
      local = { x: element.x, y: local.y };
    } else if (alignX === 'right' && (anchor === 'e' || anchor === 'ne' || anchor === 'se')) {
      local = { x: element.x + element.width, y: local.y };
    } else if (
      alignX === 'center' &&
      alignY === 'bottom' &&
      (anchor === 's' || anchor === 'se' || anchor === 'sw')
    ) {
      local = { x: local.x, y: element.y + element.height };
    } else if (
      alignX === 'center' &&
      alignY !== 'bottom' &&
      (anchor === 'n' || anchor === 'ne' || anchor === 'nw')
    ) {
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

// The box connectors treat as an element's visual body: a Technology
// icon's fixed-size mark (spec/41 — the element box can be much larger
// than the visible chip, so box-edge anchors would float in whitespace
// and face selection would answer for the wrong rectangle), the element
// itself otherwise. Returns the element identity for the common case so
// callers can cheaply tell the two apart. Shared with the face selection
// in anchor-choice.ts.
export function connectorBox(el: BoxedElement): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  if (el.type === 'shape' && el.shape === 'icon' && isTechIconId(el.iconId)) {
    return techIconMarkBounds(el);
  }
  return el;
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
  // Group-pinned (spec/09 group quick-connect): the anchor point of the
  // group's LIVE union bounds, so the arrow tracks the group as it moves /
  // resizes / changes membership. A dissolved group resolves to the origin
  // like any dangling reference — the ungroup / delete paths convert these
  // ends to free before that can be observed.
  if (endpoint.kind === 'pinned-group') {
    const list = elements instanceof Map ? [...elements.values()] : (elements as Element[]);
    const bounds = groupUnionBounds(list, endpoint.groupId);
    return bounds ? boundsAnchorPoint(bounds, endpoint.anchor) : { x: 0, y: 0 };
  }
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

export function elementBounds(
  element: Element,
  elements: Element[],
): { x: number; y: number; width: number; height: number } {
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
export function unionElementBounds(
  elements: Element[],
  ids: Set<ElementId>,
): { x: number; y: number; width: number; height: number } | null {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  let found = false;
  for (const el of elements) {
    if (!ids.has(el.id)) continue;
    found = true;
    const b = elementBounds(el, elements);
    if (b.x < minX) minX = b.x;
    if (b.y < minY) minY = b.y;
    if (b.x + b.width > maxX) maxX = b.x + b.width;
    if (b.y + b.height > maxY) maxY = b.y + b.height;
  }
  if (!found) return null;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
