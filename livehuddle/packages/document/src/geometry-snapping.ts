// Snapping + alignment/distribution guides, split out of geometry.ts to keep
// each file under the ~1000-line budget. Re-exported through the package
// barrel (index.ts) alongside geometry.
import { isBoxed, type Element, type ElementId } from './index';

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
