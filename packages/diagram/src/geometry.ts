import {
  ALL_ANCHORS,
  isBoxed,
  type Anchor,
  type BoxedElement,
  type Element,
  type ElementId,
  type Endpoint,
} from './index';

// --- Geometry helpers ------------------------------------------------------

export type Point = { x: number; y: number };

// Works on any boxed element since they share x/y/width/height.
export function anchorPosition(element: BoxedElement, anchor: Anchor): Point {
  const { x, y, width, height } = element;
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

// Pick the anchor on `element` that faces `towards` most naturally.
// Used during drag to keep an arrow visually attached as one of its
// connected elements moves: e.g. if A's arrow ends at B's west side,
// and the user drags B to be above and right of A, the arrow's
// endpoint should re-pin to B's south-west or south so the line
// still arrives at a sensible face.
//
// Biased toward cardinals (n / e / s / w): if either axis dominates
// the direction by 2x or more, we pick the matching cardinal even
// though the corner anchor is geometrically closer. Cardinals read
// as the "middle of a side", which the user has explicitly preferred
// over corners.
// Re-pin arrows whose either endpoint is anchored to a moved box,
// pointing each end at the face that now reads most naturally
// (cardinals preferred via bestAnchorTowards). Pure: takes the
// already-translated element list and the set of ids that just
// moved, returns the same list with each affected arrow's
// from/to anchors recomputed.
//
// Only re-anchors arrows where BOTH ends are pinned to a box.
// from/to pairs that mix free + pinned (one floating end) keep
// their anchors as-is; the freely-positioned end already
// dictates the visual direction, and rebinding the pinned end
// against a free point would jitter as the user drags.
export function rebindArrowAnchorsAfterMove(
  elements: Element[],
  movingIds: ReadonlySet<ElementId> | Map<ElementId, unknown>,
): Element[] {
  const includes = (id: ElementId) =>
    movingIds instanceof Map ? movingIds.has(id) : movingIds.has(id);
  return elements.map((el) => {
    if (el.type !== 'arrow') return el;
    const fromMoved = el.from.kind === 'pinned' && includes(el.from.elementId);
    const toMoved = el.to.kind === 'pinned' && includes(el.to.elementId);
    if (!fromMoved && !toMoved) return el;
    if (el.from.kind !== 'pinned' || el.to.kind !== 'pinned') return el;
    const fromEnd = el.from;
    const toEnd = el.to;
    const fromEl = elements.find((e) => e.id === fromEnd.elementId);
    const toEl = elements.find((e) => e.id === toEnd.elementId);
    if (!fromEl || !isBoxed(fromEl) || !toEl || !isBoxed(toEl)) return el;
    const toCenter = { x: toEl.x + toEl.width / 2, y: toEl.y + toEl.height / 2 };
    const fromCenter = { x: fromEl.x + fromEl.width / 2, y: fromEl.y + fromEl.height / 2 };
    return {
      ...el,
      from: { ...fromEnd, anchor: bestAnchorTowards(fromEl, toCenter) },
      to: { ...toEnd, anchor: bestAnchorTowards(toEl, fromCenter) },
    };
  });
}

export function bestAnchorTowards(element: BoxedElement, towards: Point): Anchor {
  const cx = element.x + element.width / 2;
  const cy = element.y + element.height / 2;
  const dx = towards.x - cx;
  const dy = towards.y - cy;
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  // Cardinal-dominant zones: one axis at least 2x the other.
  if (ax >= 2 * ay) return dx >= 0 ? 'e' : 'w';
  if (ay >= 2 * ax) return dy >= 0 ? 's' : 'n';
  // Diagonal: pick the corner matching the quadrant.
  if (dx >= 0 && dy >= 0) return 'se';
  if (dx >= 0 && dy < 0) return 'ne';
  if (dx < 0 && dy >= 0) return 'sw';
  return 'nw';
}

export function endpointPosition(endpoint: Endpoint, elements: Element[]): Point {
  if (endpoint.kind === 'free') return { x: endpoint.x, y: endpoint.y };
  const target = elements.find((el) => el.id === endpoint.elementId);
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

// Alignment snapping: when dragging an element, snap its edges/centre to
// match nearby OTHER elements' edges/centres on the same axis. Returns the
// delta (dx, dy) to apply to the candidate position.
//
// Considers six lines per element: left / centre-x / right (X axis) and
// top / centre-y / bottom (Y axis). For each axis, picks the nearest
// candidate-target pair within `threshold` pixels.
export function snapToAlignment(
  candidate: { x: number; y: number; width: number; height: number },
  elements: Element[],
  excludeIds: Set<ElementId>,
  threshold: number,
): { dx: number; dy: number } {
  const xs = [candidate.x, candidate.x + candidate.width / 2, candidate.x + candidate.width];
  const ys = [candidate.y, candidate.y + candidate.height / 2, candidate.y + candidate.height];

  let bestX: number | null = null;
  let bestY: number | null = null;

  for (const el of elements) {
    if (!isBoxed(el) || excludeIds.has(el.id)) continue;
    const targetXs = [el.x, el.x + el.width / 2, el.x + el.width];
    const targetYs = [el.y, el.y + el.height / 2, el.y + el.height];
    for (const cx of xs) {
      for (const tx of targetXs) {
        const delta = tx - cx;
        if (Math.abs(delta) <= threshold && (bestX === null || Math.abs(delta) < Math.abs(bestX))) {
          bestX = delta;
        }
      }
    }
    for (const cy of ys) {
      for (const ty of targetYs) {
        const delta = ty - cy;
        if (Math.abs(delta) <= threshold && (bestY === null || Math.abs(delta) < Math.abs(bestY))) {
          bestY = delta;
        }
      }
    }
  }

  return { dx: bestX ?? 0, dy: bestY ?? 0 };
}

// Snap candidate bounds during a resize to align with other elements'
// edges, centres, and dimensions. Mirrors `snapToAlignment` but only
// nudges the edges that the active resize handle actually moves
// (the opposite corner is anchored and must not drift). Threshold
// is in canvas px.
//
// Two snap modes combine on each axis, with the smaller delta winning
// when they conflict:
//   1. Edge alignment: the active edge lines up with another element's
//      left / centre / right (or top / centre / bottom).
//   2. Dimension match: the candidate's width (or height) matches
//      another element's width (or height), so the user can size a
//      shape to be visually identical to a nearby one without
//      pixel-fiddling.
//
// `mode` is the corner being dragged ("se" = bottom-right handle =
// right + bottom edges move; etc.).
export function snapResizeBounds(
  candidate: { x: number; y: number; width: number; height: number },
  mode: 'se' | 'sw' | 'ne' | 'nw',
  elements: Element[],
  excludeIds: Set<ElementId>,
  threshold: number,
  minSize: number,
): { x: number; y: number; width: number; height: number } {
  const movesRight = mode === 'se' || mode === 'ne';
  const movesLeft = mode === 'sw' || mode === 'nw';
  const movesBottom = mode === 'se' || mode === 'sw';
  const movesTop = mode === 'ne' || mode === 'nw';

  // Anchored coordinates, the corner that should NOT move.
  const anchorRight = movesLeft ? candidate.x + candidate.width : null;
  const anchorLeft = movesRight ? candidate.x : null;
  const anchorBottom = movesTop ? candidate.y + candidate.height : null;
  const anchorTop = movesBottom ? candidate.y : null;

  // The active edge positions we'll try to snap.
  const activeX = movesRight ? candidate.x + candidate.width : candidate.x;
  const activeY = movesBottom ? candidate.y + candidate.height : candidate.y;

  let bestDx: number | null = null;
  let bestDy: number | null = null;

  for (const el of elements) {
    if (!isBoxed(el) || excludeIds.has(el.id)) continue;
    const targetXs = [el.x, el.x + el.width / 2, el.x + el.width];
    const targetYs = [el.y, el.y + el.height / 2, el.y + el.height];
    if (movesLeft || movesRight) {
      for (const tx of targetXs) {
        const delta = tx - activeX;
        if (
          Math.abs(delta) <= threshold &&
          (bestDx === null || Math.abs(delta) < Math.abs(bestDx))
        ) {
          bestDx = delta;
        }
      }
      // Dimension match: translate "candidate.width should equal
      // el.width" into a delta on the active X edge. movesRight
      // pushes the active edge to anchorLeft + el.width; movesLeft
      // pulls it to anchorRight - el.width. Skip degenerate sources
      // (zero-width elements would always be within threshold and
      // confuse the user).
      if (el.width > 0) {
        const targetActiveX =
          movesRight && anchorLeft !== null
            ? anchorLeft + el.width
            : movesLeft && anchorRight !== null
              ? anchorRight - el.width
              : null;
        if (targetActiveX !== null) {
          const delta = targetActiveX - activeX;
          if (
            Math.abs(delta) <= threshold &&
            (bestDx === null || Math.abs(delta) < Math.abs(bestDx))
          ) {
            bestDx = delta;
          }
        }
      }
    }
    if (movesTop || movesBottom) {
      for (const ty of targetYs) {
        const delta = ty - activeY;
        if (
          Math.abs(delta) <= threshold &&
          (bestDy === null || Math.abs(delta) < Math.abs(bestDy))
        ) {
          bestDy = delta;
        }
      }
      if (el.height > 0) {
        const targetActiveY =
          movesBottom && anchorTop !== null
            ? anchorTop + el.height
            : movesTop && anchorBottom !== null
              ? anchorBottom - el.height
              : null;
        if (targetActiveY !== null) {
          const delta = targetActiveY - activeY;
          if (
            Math.abs(delta) <= threshold &&
            (bestDy === null || Math.abs(delta) < Math.abs(bestDy))
          ) {
            bestDy = delta;
          }
        }
      }
    }
  }

  let { x, y, width, height } = candidate;
  if (bestDx !== null) {
    if (movesRight && anchorLeft !== null) {
      width = Math.max(minSize, activeX + bestDx - anchorLeft);
    } else if (movesLeft && anchorRight !== null) {
      const newX = activeX + bestDx;
      const newWidth = Math.max(minSize, anchorRight - newX);
      x = anchorRight - newWidth;
      width = newWidth;
    }
  }
  if (bestDy !== null) {
    if (movesBottom && anchorTop !== null) {
      height = Math.max(minSize, activeY + bestDy - anchorTop);
    } else if (movesTop && anchorBottom !== null) {
      const newY = activeY + bestDy;
      const newHeight = Math.max(minSize, anchorBottom - newY);
      y = anchorBottom - newHeight;
      height = newHeight;
    }
  }
  return { x, y, width, height };
}

// Nearest boxed-element anchor to a canvas point. Returns the pinning
// reference if one is within `threshold` pixels; otherwise null.
export function snapToAnchor(
  point: Point,
  elements: Element[],
  threshold: number,
): { elementId: ElementId; anchor: Anchor } | null {
  let best: { elementId: ElementId; anchor: Anchor; dist: number } | null = null;
  for (const el of elements) {
    if (!isBoxed(el)) continue;
    for (const anchor of ALL_ANCHORS) {
      const pos = anchorPosition(el, anchor);
      const dist = Math.hypot(pos.x - point.x, pos.y - point.y);
      if (dist <= threshold && (best === null || dist < best.dist)) {
        best = { elementId: el.id, anchor, dist };
      }
    }
  }
  if (!best) return null;
  return { elementId: best.elementId, anchor: best.anchor };
}
