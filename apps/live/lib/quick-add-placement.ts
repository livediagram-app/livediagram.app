import { isBoxed, type Element } from '@livediagram/diagram';
import type { QuickConnectDirection } from '@/lib/canvas';

type Bounds = { x: number; y: number; width: number; height: number };

// Placement math for quick add (spec/09), lifted out of
// useElementSelectionActions' spawnConnectSelected: given the source
// selection's union bounds and a direction, resolve the canvas-px
// offset the new element should land at. Pure geometry — the hook owns
// the commit / selection / telemetry around it.
export function quickAddPlacement({
  elements,
  ids,
  baseBounds,
  direction,
}: {
  elements: Element[];
  // The source selection (the whole group when the source is grouped) —
  // excluded from both the gap scan and the overlap test.
  ids: Set<string>;
  baseBounds: Bounds;
  direction: QuickConnectDirection;
}): { dx: number; dy: number } {
  // Match the gap to the nearest in-line neighbour so a duplicated chain
  // keeps the same spacing as existing siblings, instead of always using a
  // fixed gap the user then has to nudge into line. "In-line" = an element
  // whose perpendicular extent overlaps the source's (the same row when
  // duplicating left/right, the same column when up/down); the gap is the
  // edge-to-edge distance to the nearest such element on either side. Falls
  // back to DEFAULT_GAP when the source stands alone in that direction.
  const DEFAULT_GAP = 40;
  const horizontal = direction === 'right' || direction === 'left';
  let nearestGap: number | null = null;
  for (const el of elements) {
    if (!isBoxed(el) || ids.has(el.id)) continue;
    if (horizontal) {
      const sharesRow = !(
        baseBounds.y + baseBounds.height <= el.y || el.y + el.height <= baseBounds.y
      );
      if (!sharesRow) continue;
      const g =
        el.x >= baseBounds.x + baseBounds.width
          ? el.x - (baseBounds.x + baseBounds.width)
          : baseBounds.x - (el.x + el.width);
      if (g >= 0 && (nearestGap === null || g < nearestGap)) nearestGap = g;
    } else {
      const sharesCol = !(
        baseBounds.x + baseBounds.width <= el.x || el.x + el.width <= baseBounds.x
      );
      if (!sharesCol) continue;
      const g =
        el.y >= baseBounds.y + baseBounds.height
          ? el.y - (baseBounds.y + baseBounds.height)
          : baseBounds.y - (el.y + el.height);
      if (g >= 0 && (nearestGap === null || g < nearestGap)) nearestGap = g;
    }
  }
  const gap = nearestGap ?? DEFAULT_GAP;
  const w = baseBounds.width + gap;
  const h = baseBounds.height + gap;
  const step = {
    x: direction === 'right' ? w : direction === 'left' ? -w : 0,
    y: direction === 'below' ? h : direction === 'above' ? -h : 0,
  };
  // Step further in the same direction until the new element's bounding
  // box doesn't overlap any existing element. Keeps long chains properly
  // spaced even if the user clicks faster than the selection visually
  // catches up.
  let dx = step.x;
  let dy = step.y;
  for (let attempt = 0; attempt < 20; attempt++) {
    const proposed = {
      x: baseBounds.x + dx,
      y: baseBounds.y + dy,
      width: baseBounds.width,
      height: baseBounds.height,
    };
    const overlaps = elements.some((el) => {
      if (!isBoxed(el) || ids.has(el.id)) return false;
      return !(
        proposed.x + proposed.width <= el.x ||
        el.x + el.width <= proposed.x ||
        proposed.y + proposed.height <= el.y ||
        el.y + el.height <= proposed.y
      );
    });
    if (!overlaps) break;
    dx += step.x;
    dy += step.y;
  }
  return { dx, dy };
}
