import { isBoxed, type Element, type ElementId } from './index';

// Snapping for a lane's title seam (docs/specs/009-elements/lane.md), the line between its heading
// and its body that you drag to resize the heading.
//
// The seam is a 1-D problem: it slides along one axis, so it snaps to
// coordinates rather than to boxes. Two families of target, and the second is
// the one that matters:
//
//  - Element edges and centres, the same alignment grid dragging an element
//    already snaps to, so a heading can be sized to line up with whatever is
//    sitting next to the lane.
//  - OTHER LANES' SEAMS. A stack of swimlanes with headings of slightly
//    different widths is the thing that makes a board look untidy, and it is
//    almost impossible to fix by eye: the seams are far apart vertically, so
//    a few pixels of difference never sits in one glance. Snapping to them
//    makes "line these up" a gesture rather than a fiddle.

/** How near a seam must come to a target before it jumps to it, in element px. */
export const SEAM_SNAP_THRESHOLD = 8;

/**
 * Where another lane's seam sits, in absolute canvas coordinates, on `axis`.
 *
 * A lane whose heading runs down its LEFT has its seam at `x + size`; one on
 * the right at `x + width - size`, and the same on the other axis. Only lanes
 * whose heading runs along the same axis are comparable: a column's seam and
 * a row's seam are different lines and lining them up would mean nothing.
 */
export function laneSeamCoordinates(
  elements: Element[],
  axis: 'x' | 'y',
  excludeId: ElementId,
  edgeOf: (el: Element) => 'left' | 'right' | 'top' | 'bottom' | 'centre-x',
  sizeOf: (el: Element) => number,
): number[] {
  const out: number[] = [];
  for (const el of elements) {
    if (el.id === excludeId) continue;
    if (!(el.type === 'shape' && el.shape === 'lane')) continue;
    const edge = edgeOf(el);
    const size = sizeOf(el);
    if (axis === 'x') {
      if (edge === 'left') out.push(el.x + size);
      else if (edge === 'right') out.push(el.x + el.width - size);
    } else {
      if (edge === 'top') out.push(el.y + size);
      else if (edge === 'bottom') out.push(el.y + el.height - size);
    }
  }
  return out;
}

/** Element edges and centres on one axis: the ordinary alignment grid. */
export function alignmentCoordinates(
  elements: Element[],
  axis: 'x' | 'y',
  excludeId: ElementId,
): number[] {
  const out: number[] = [];
  for (const el of elements) {
    if (el.id === excludeId || !isBoxed(el)) continue;
    if (axis === 'x') out.push(el.x, el.x + el.width / 2, el.x + el.width);
    else out.push(el.y, el.y + el.height / 2, el.y + el.height);
  }
  return out;
}

/**
 * Snap a seam coordinate to the nearest target within the threshold, or leave
 * it alone. Returns the coordinate to use AND which target it took, so the
 * caller can draw a guide for it.
 *
 * Lane seams are offered FIRST at equal distance: when a seam could line up
 * with either a passing element's edge or the lane above's seam, the seam is
 * what the user meant.
 */
export function snapSeamCoordinate(
  candidate: number,
  targets: { seams: number[]; alignment: number[] },
  threshold: number = SEAM_SNAP_THRESHOLD,
): { value: number; snappedTo: number | null } {
  let best: number | null = null;
  let bestDistance = Infinity;
  const consider = (target: number, tieBreakWins: boolean) => {
    const distance = Math.abs(target - candidate);
    if (distance > threshold) return;
    if (distance < bestDistance || (distance === bestDistance && tieBreakWins)) {
      best = target;
      bestDistance = distance;
    }
  };
  for (const t of targets.alignment) consider(t, false);
  for (const t of targets.seams) consider(t, true);
  return best === null ? { value: candidate, snappedTo: null } : { value: best, snappedTo: best };
}
