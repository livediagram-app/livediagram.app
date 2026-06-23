// Pure geometry + frame-equality helpers for the canvas drag machine
// (useEditorDrag). Split out of the hook so the per-pointer-move math
// can be reasoned about (and unit-tested) on its own, away from the
// stateful React closure: alignment / distribution / snap-target list
// equality (used to bail the rAF setters out of redundant re-renders),
// the snap-target reveal computation, and point-to-segment distance for
// curve-point insertion. All stateless; nothing here touches React.

import {
  ALL_ANCHORS,
  anchorPosition,
  isBoxed,
  type AlignmentGuide,
  type Anchor,
  type DistributionGuide,
  type Element,
} from '@livediagram/diagram';
import type { SnapTarget } from '@/components/canvas/Canvas.types';

// Value-equality for two guide lists. Used to bail out of the
// snapGuides state update when the guides haven't changed: on the vast
// majority of drag frames `alignmentGuides` returns an empty list (no
// snap), and feeding a fresh `[]` to setState every pointermove would
// force a redundant re-render of the whole editor tree on top of the
// per-frame `tick`. Returning the previous reference from the setState
// updater lets React skip the render entirely (Object.is bail-out).
// Stable empty exclude-set for arrow-endpoint alignment: an arrow isn't a
// boxed element so it's never an alignment TARGET, and we want it to line
// up against every boxed element. Module-level so the per-frame snap /
// guide calls don't allocate a fresh Set each tick.
export const NO_ALIGN_EXCLUDE: Set<string> = new Set();

export function sameGuides(a: AlignmentGuide[], b: AlignmentGuide[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!;
    const y = b[i]!;
    if (x.axis !== y.axis || x.position !== y.position || x.start !== y.start || x.end !== y.end) {
      return false;
    }
  }
  return true;
}

// Value-equality for two distribution-guide lists (axis / gap / spans),
// so the rAF setter can bail when they haven't changed.
export function sameDistGuides(a: DistributionGuide[], b: DistributionGuide[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!;
    const y = b[i]!;
    if (x.axis !== y.axis || x.gap !== y.gap || x.spans.length !== y.spans.length) return false;
    for (let j = 0; j < x.spans.length; j++) {
      const s = x.spans[j]!;
      const t = y.spans[j]!;
      if (s.from !== t.from || s.to !== t.to || s.cross !== t.cross) return false;
    }
  }
  return true;
}

// Value-equality for two snap-target lists (position + active flag), so the
// rAF setter bails when the revealed markers haven't changed frame to frame.
export function sameTargets(a: SnapTarget[], b: SnapTarget[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!;
    const y = b[i]!;
    if (x.x !== y.x || x.y !== y.y || x.active !== y.active) return false;
  }
  return true;
}

// How far outside a shape's bounding box the cursor can be and still reveal
// that shape's connection points while dragging an arrow endpoint. A little
// generous so the anchors appear as you approach rather than only on contact.
const SNAP_TARGET_REVEAL_MARGIN = 44;

// The connection-point markers to show for the current arrow-endpoint drag:
// every anchor of each shape whose (margin-expanded) box the cursor is over,
// with the one the endpoint has snapped to flagged active. Arrows have no
// anchors and are skipped; so is the arrow being dragged.
export function computeSnapTargets(
  cursor: { x: number; y: number },
  elements: Element[],
  activeElementId: string | null,
  activeAnchor: Anchor | null,
): SnapTarget[] {
  const out: SnapTarget[] = [];
  for (const el of elements) {
    if (!isBoxed(el)) continue;
    const m = SNAP_TARGET_REVEAL_MARGIN;
    if (
      cursor.x < el.x - m ||
      cursor.x > el.x + el.width + m ||
      cursor.y < el.y - m ||
      cursor.y > el.y + el.height + m
    ) {
      continue;
    }
    for (const anchor of ALL_ANCHORS) {
      const p = anchorPosition(el, anchor);
      out.push({
        x: p.x,
        y: p.y,
        active: el.id === activeElementId && anchor === activeAnchor,
      });
    }
  }
  return out;
}

// Distance from point p to segment a-b (canvas coords). Used to pick which
// segment of a multi-bend curve a click lands on so a new control point is
// inserted in the right place.
export function distToSegment(
  p: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const lenSq = vx * vx + vy * vy;
  const t =
    lenSq < 1e-9 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / lenSq));
  const cx = a.x + t * vx;
  const cy = a.y + t * vy;
  return Math.hypot(p.x - cx, p.y - cy);
}
