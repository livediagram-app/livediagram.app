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

// Rotate `p` clockwise about `center` by `deg` degrees, matching the
// CSS `transform: rotate(deg)` the canvas applies to a rotated element
// (positive = clockwise in the y-down canvas space). Pure helper shared
// by anchorPosition + bestAnchorTowards.
function rotatePoint(p: Point, center: Point, deg: number): Point {
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

// Works on any boxed element since they share x/y/width/height. When the
// element carries a `rotation`, the anchor is rotated about the
// element's centre so a pinned arrow lands on the visually-rotated edge,
// not the pre-rotation position. Every pinned endpoint (rendering) and
// snapToAnchor (pinning) resolve through here, so they stay consistent.
export function anchorPosition(element: BoxedElement, anchor: Anchor): Point {
  const { x, y, width, height } = element;
  const local = localAnchorPosition(x, y, width, height, anchor);
  const rotation = element.rotation ?? 0;
  if (!rotation) return local;
  return rotatePoint(local, { x: x + width / 2, y: y + height / 2 }, rotation);
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

// Pick the edge-midpoint anchor (n/e/s/w) whose actual position is
// closest to `towards` (the other endpoint / element centre). This is
// the auto-anchor used when an arrow's pinned end is (re)bound. It uses
// real anchor positions rather than a centre-direction heuristic, so it
// never picks the far edge when a nearer one faces the target — the bug
// where a tall/offset neighbour got its bottom anchor when the top was
// closer. Corners are intentionally not auto-chosen: the manual anchor
// dots are cardinal-only too, and arrows read cleaner from edge middles.
// anchorPosition already accounts for rotation, so a rotated element's
// faces are compared in world space.
export function bestAnchorTowards(element: BoxedElement, towards: Point): Anchor {
  const cardinals: Anchor[] = ['n', 'e', 's', 'w'];
  let best: Anchor = 'n';
  let bestDistSq = Infinity;
  for (const anchor of cardinals) {
    const p = anchorPosition(element, anchor);
    const distSq = (p.x - towards.x) ** 2 + (p.y - towards.y) ** 2;
    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      best = anchor;
    }
  }
  return best;
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
): { dx: number; dy: number; snappedX: boolean; snappedY: boolean } {
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

  // snappedX/Y report whether an alignment was FOUND on that axis, which
  // a 0 delta can't convey (an exact alignment and "nothing in range"
  // both yield dx 0). Callers that layer another snap (e.g. distribution)
  // use these to tell "already aligned, leave it" from "free, go ahead".
  return { dx: bestX ?? 0, dy: bestY ?? 0, snappedX: bestX !== null, snappedY: bestY !== null };
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

// A faint line the canvas draws while an element is being dragged /
// resized to show WHY it snapped to a given position: it lies along an
// edge / centre line the dragged element now shares with one or more
// neighbours. `axis: 'x'` is a vertical line at constant x; `axis: 'y'`
// is a horizontal line at constant y. `start`/`end` are the inclusive
// span on the perpendicular axis (top→bottom for a vertical line,
// left→right for a horizontal one) so the guide bridges only the
// aligned elements rather than crossing the whole canvas.
export type AlignmentGuide = {
  axis: 'x' | 'y';
  position: number;
  start: number;
  end: number;
};

// Derive the alignment guides for an element at `candidate` bounds
// against its neighbours. Decoupled from snapToAlignment /
// snapResizeBounds on purpose: callers pass the ALREADY-SNAPPED bounds,
// and this reports every candidate line (left / centre-x / right on X,
// top / centre-y / bottom on Y) that now coincides with a neighbour's
// line within `epsilon` pixels. Because it keys off the snapped
// position, a guide surfaces exactly when a snap is in effect — there's
// no separate "is the snap active" flag to keep in sync.
//
// `excludeIds` skips the dragged elements (so a group drag never guides
// against itself). Each returned guide spans the union extent of the
// candidate plus every matched neighbour on the perpendicular axis.
// Lines at the same axis + position are merged into one.
export function alignmentGuides(
  candidate: { x: number; y: number; width: number; height: number },
  elements: Element[],
  excludeIds: Set<ElementId>,
  epsilon = 0.5,
): AlignmentGuide[] {
  const candidateXs = [
    candidate.x,
    candidate.x + candidate.width / 2,
    candidate.x + candidate.width,
  ];
  const candidateYs = [
    candidate.y,
    candidate.y + candidate.height / 2,
    candidate.y + candidate.height,
  ];
  const candidateTop = candidate.y;
  const candidateBottom = candidate.y + candidate.height;
  const candidateLeft = candidate.x;
  const candidateRight = candidate.x + candidate.width;

  // Keyed by `${axis}:${roundedPosition}` so duplicate lines (e.g. left
  // edge AND centre landing on the same x) collapse and their spans merge.
  const guides = new Map<string, AlignmentGuide>();

  const record = (axis: 'x' | 'y', position: number, start: number, end: number) => {
    const key = `${axis}:${Math.round(position)}`;
    const existing = guides.get(key);
    if (existing) {
      existing.start = Math.min(existing.start, start);
      existing.end = Math.max(existing.end, end);
    } else {
      guides.set(key, { axis, position, start, end });
    }
  };

  for (const lineX of candidateXs) {
    let start = candidateTop;
    let end = candidateBottom;
    let matched = false;
    for (const el of elements) {
      if (!isBoxed(el) || excludeIds.has(el.id)) continue;
      const targetXs = [el.x, el.x + el.width / 2, el.x + el.width];
      if (targetXs.some((tx) => Math.abs(tx - lineX) <= epsilon)) {
        matched = true;
        start = Math.min(start, el.y);
        end = Math.max(end, el.y + el.height);
      }
    }
    if (matched) record('x', lineX, start, end);
  }

  for (const lineY of candidateYs) {
    let start = candidateLeft;
    let end = candidateRight;
    let matched = false;
    for (const el of elements) {
      if (!isBoxed(el) || excludeIds.has(el.id)) continue;
      const targetYs = [el.y, el.y + el.height / 2, el.y + el.height];
      if (targetYs.some((ty) => Math.abs(ty - lineY) <= epsilon)) {
        matched = true;
        start = Math.min(start, el.x);
        end = Math.max(end, el.x + el.width);
      }
    }
    if (matched) record('y', lineY, start, end);
  }

  return [...guides.values()];
}

// Equal-spacing ("distribution") guide: the equal gaps the moving element
// shares with its neighbours along one axis — Figma's pink equal-distance
// guides. `gap` is the matched spacing; `spans` are the gap segments to
// draw (each runs `from`->`to` along `axis` at the perpendicular `cross`),
// tick-capped so the equal gaps read at a glance.
export type DistributionGuide = {
  axis: 'x' | 'y';
  gap: number;
  spans: { from: number; to: number; cross: number }[];
};

type DistAxisItem = { low: number; high: number; crossLow: number; crossHigh: number };
type DistAxisResult = { delta: number; gap: number; spans: { from: number; to: number }[] };

// Per-axis equal-spacing search. `cand` is the moving element's interval
// on the primary axis (low + size) plus its span on the cross axis;
// `items` are the other elements' intervals. Only neighbours that overlap
// the candidate on the cross axis count (so X-spacing considers a
// horizontal row, Y-spacing a vertical column). Returns the smallest snap
// within `threshold` that makes a gap equal, or null.
function distributeAxis(
  cand: { low: number; size: number; crossLow: number; crossHigh: number },
  items: DistAxisItem[],
  threshold: number,
): DistAxisResult | null {
  const row = items.filter((n) => n.crossLow < cand.crossHigh && n.crossHigh > cand.crossLow);
  const cHigh = cand.low + cand.size;
  let best: DistAxisResult | null = null;
  const consider = (delta: number, gap: number, spans: { from: number; to: number }[]) => {
    if (gap < 1 || Math.abs(delta) > threshold) return;
    if (!best || Math.abs(delta) < Math.abs(best.delta)) best = { delta, gap, spans };
  };
  // Equidistant: a neighbour P to the left and Q to the right; centre the
  // candidate in the gap so the two facing gaps are equal.
  for (const P of row) {
    if (P.high > cand.low + threshold) continue;
    for (const Q of row) {
      if (Q.low < cHigh - threshold || Q.low <= P.high) continue;
      const gap = (Q.low - P.high - cand.size) / 2;
      const targetLow = P.high + gap;
      consider(targetLow - cand.low, gap, [
        { from: P.high, to: targetLow },
        { from: targetLow + cand.size, to: Q.low },
      ]);
    }
  }
  // Equal extension: an adjacent neighbour pair (P, Q) defines a gap;
  // snap the candidate one gap beyond Q (to the right) or before P (left).
  const sorted = [...row].sort((a, b) => a.low - b.low);
  for (let i = 0; i + 1 < sorted.length; i++) {
    const P = sorted[i]!;
    const Q = sorted[i + 1]!;
    if (Q.low <= P.high) continue;
    const gap = Q.low - P.high;
    if (cand.low + cand.size / 2 > Q.high) {
      const targetLow = Q.high + gap;
      consider(targetLow - cand.low, gap, [
        { from: P.high, to: Q.low },
        { from: Q.high, to: targetLow },
      ]);
    }
    if (cand.low + cand.size / 2 < P.low) {
      const targetLow = P.low - gap - cand.size;
      consider(targetLow - cand.low, gap, [
        { from: targetLow + cand.size, to: P.low },
        { from: P.high, to: Q.low },
      ]);
    }
  }
  return best;
}

// Snap a dragged element to EQUAL spacing with its neighbours (so three
// elements end up evenly spread) and report the gap segments to draw.
// Pure; mirrors snapToAlignment's shape (a dx/dy nudge) but for
// inter-element spacing rather than edge/centre alignment. Each axis is
// considered independently.
export function distributionSnap(
  candidate: { x: number; y: number; width: number; height: number },
  elements: Element[],
  excludeIds: Set<ElementId>,
  threshold: number,
): { dx: number; dy: number; guides: DistributionGuide[] } {
  const boxed = elements.filter((el): el is BoxedElement => isBoxed(el) && !excludeIds.has(el.id));
  const xs = distributeAxis(
    {
      low: candidate.x,
      size: candidate.width,
      crossLow: candidate.y,
      crossHigh: candidate.y + candidate.height,
    },
    boxed.map((el) => ({
      low: el.x,
      high: el.x + el.width,
      crossLow: el.y,
      crossHigh: el.y + el.height,
    })),
    threshold,
  );
  const ys = distributeAxis(
    {
      low: candidate.y,
      size: candidate.height,
      crossLow: candidate.x,
      crossHigh: candidate.x + candidate.width,
    },
    boxed.map((el) => ({
      low: el.y,
      high: el.y + el.height,
      crossLow: el.x,
      crossHigh: el.x + el.width,
    })),
    threshold,
  );
  const dx = xs?.delta ?? 0;
  const dy = ys?.delta ?? 0;
  const guides: DistributionGuide[] = [];
  if (xs) {
    const cross = candidate.y + dy + candidate.height / 2;
    guides.push({ axis: 'x', gap: xs.gap, spans: xs.spans.map((s) => ({ ...s, cross })) });
  }
  if (ys) {
    const cross = candidate.x + dx + candidate.width / 2;
    guides.push({ axis: 'y', gap: ys.gap, spans: ys.spans.map((s) => ({ ...s, cross })) });
  }
  return { dx, dy, guides };
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
