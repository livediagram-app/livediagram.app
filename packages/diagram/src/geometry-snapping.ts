// Snapping + alignment/distribution guides, split out of geometry.ts to keep
// each file under the ~1000-line budget. Depends on the core geometry helpers
// (anchorPosition, Point) which stay in geometry.ts. Re-exported through the
// package barrel (index.ts) alongside geometry.
import { anchorPosition, type Point } from './geometry';
import type { AlignmentGuide } from './geometry-guides';
import { ALL_ANCHORS, isBoxed, type Anchor, type Element, type ElementId } from './index';

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

// Snap a dragged arrow control point (a curve bend, the single-bow control,
// or an angled elbow) to the alignment lines around it, so bends square up
// instead of landing at arbitrary sub-pixel positions. Two families of
// candidate line, both per axis, nearest-within-`threshold` wins:
//   1. `neighbours` — the point's adjacent vertices on the rendered line
//      (the previous + next vertex). Snapping x to a neighbour's x makes that
//      segment vertical; snapping y makes it horizontal. Hitting one on each
//      axis squares the bend to a right angle.
//   2. Other elements' left / centre / right (x) and top / centre / bottom
//      (y), so a bend lines up with nearby shapes the same way a moved box
//      does.
// Returns the snapped point plus the guide lines now in effect (same shape as
// `alignmentGuides`, so the caller renders them through the existing overlay).
// `excludeIds` are elements the arrow's own endpoints sit on, skipped so a
// pinned arrow doesn't snap its bend to the very box it connects.
export function snapArrowPoint(
  point: Point,
  neighbours: Point[],
  elements: Element[],
  threshold: number,
  excludeIds: Set<ElementId> = new Set(),
): { point: Point; guides: AlignmentGuide[] } {
  // Each candidate carries the perpendicular coordinate of whatever it lines
  // up with, so the emitted guide spans from the point to that reference.
  const xLines: { pos: number; ref: number }[] = [];
  const yLines: { pos: number; ref: number }[] = [];
  for (const n of neighbours) {
    xLines.push({ pos: n.x, ref: n.y });
    yLines.push({ pos: n.y, ref: n.x });
  }
  for (const el of elements) {
    if (!isBoxed(el) || excludeIds.has(el.id)) continue;
    const cx = el.x + el.width / 2;
    const cy = el.y + el.height / 2;
    for (const x of [el.x, cx, el.x + el.width]) xLines.push({ pos: x, ref: cy });
    for (const y of [el.y, cy, el.y + el.height]) yLines.push({ pos: y, ref: cx });
  }
  const nearest = (lines: { pos: number; ref: number }[], v: number) => {
    let best: { pos: number; ref: number } | null = null;
    for (const c of lines) {
      const d = Math.abs(c.pos - v);
      if (d <= threshold && (best === null || d < Math.abs(best.pos - v))) best = c;
    }
    return best;
  };
  const bestX = nearest(xLines, point.x);
  const bestY = nearest(yLines, point.y);
  const sx = bestX ? bestX.pos : point.x;
  const sy = bestY ? bestY.pos : point.y;
  const guides: AlignmentGuide[] = [];
  if (bestX) {
    guides.push({
      axis: 'x',
      position: sx,
      start: Math.min(sy, bestX.ref),
      end: Math.max(sy, bestX.ref),
    });
  }
  if (bestY) {
    guides.push({
      axis: 'y',
      position: sy,
      start: Math.min(sx, bestY.ref),
      end: Math.max(sx, bestY.ref),
    });
  }
  return { point: { x: sx, y: sy }, guides };
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
  // Corner modes move two edges; single-edge modes (n/s/e/w) move one,
  // snapping (and dimension-matching) on that axis only.
  mode: 'se' | 'sw' | 'ne' | 'nw' | 'n' | 's' | 'e' | 'w',
  elements: Element[],
  excludeIds: Set<ElementId>,
  threshold: number,
  minSize: number,
): { x: number; y: number; width: number; height: number } {
  const movesRight = mode === 'se' || mode === 'ne' || mode === 'e';
  const movesLeft = mode === 'sw' || mode === 'nw' || mode === 'w';
  const movesBottom = mode === 'se' || mode === 'sw' || mode === 's';
  const movesTop = mode === 'ne' || mode === 'nw' || mode === 'n';

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

// Nearest boxed-element anchor to a canvas point. Returns the pinning
// reference if one is within `threshold` pixels; otherwise null.
export function snapToAnchor(
  point: Point,
  elements: Element[],
  threshold: number,
): { elementId: ElementId; anchor: Anchor } | null {
  // Compare squared distances throughout (Math.hypot is markedly
  // slower and we only need the ordering / the threshold test).
  const thresholdSq = threshold * threshold;
  let best: { elementId: ElementId; anchor: Anchor; distSq: number } | null = null;
  for (const el of elements) {
    if (!isBoxed(el)) continue;
    // Bounding-radius pre-reject: every anchor (corner, edge-mid, or
    // centre) sits within R = half the element's diagonal of its
    // centre, for ANY rotation. So if the point is farther than
    // R + threshold from the centre, no anchor can be in range — skip
    // the 8-anchor inner loop entirely. Conservative, so it never
    // changes the result, only avoids work on distant elements.
    const cx = el.x + el.width / 2;
    const cy = el.y + el.height / 2;
    const radius = Math.hypot(el.width, el.height) / 2;
    const reach = radius + threshold;
    const dcx = cx - point.x;
    const dcy = cy - point.y;
    if (dcx * dcx + dcy * dcy > reach * reach) continue;
    for (const anchor of ALL_ANCHORS) {
      const pos = anchorPosition(el, anchor);
      const dx = pos.x - point.x;
      const dy = pos.y - point.y;
      const distSq = dx * dx + dy * dy;
      if (distSq <= thresholdSq && (best === null || distSq < best.distSq)) {
        best = { elementId: el.id, anchor, distSq };
      }
    }
  }
  if (!best) return null;
  return { elementId: best.elementId, anchor: best.anchor };
}
