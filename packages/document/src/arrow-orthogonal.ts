// Two-bend orthogonal routing for laid-out graphs (docs/specs/008-canvas/layout-cleanup.md "Angled
// lines bend twice"). An angled arrow on its own bends once, an L: from a
// parent's bottom to a child's top it runs down to the child's level and then
// across, meeting the child's top edge sideways. An org chart or a flowchart
// wants the other shape: down to halfway, across, then down into the child.
// That is an angled arrow threaded through two points (`curvePoints`), which
// the canvas and the export already draw as a polyline.
//
// The points are chord-midpoint deltas (curveAnchorPoints), worked out from
// the same fanned endpoints the renderers resolve, so the bends land square.

import { anchorPrimarySide } from './anchors';
import { arrowEndpointSpread } from './arrow-endpoint-spread';
import { endpointPosition } from './geometry';
import { isContainer } from './containment';
import { isBoxed, type Anchor, type ArrowElement, type Element } from './index';

// An arrow's end where the renderers draw it: its anchor, fanned (arrowEndpointSpread).
function spreadEnd(arrow: ArrowElement, end: 'from' | 'to', elements: Element[]) {
  const p = endpointPosition(arrow[end], elements);
  const s = arrowEndpointSpread(arrow.id, end, elements);
  return { x: p.x + s.x, y: p.y + s.y };
}

// The bends for one arrow along `axis`, or undefined when its ends already
// line up (a straight run needs none) or aren't both pinned.
export function orthogonalBends(
  arrow: ArrowElement,
  elements: Element[],
  axis: 'TB' | 'LR',
): { dx: number; dy: number }[] | undefined {
  if (arrow.from.kind !== 'pinned' || arrow.to.kind !== 'pinned') return undefined;
  const from = spreadEnd(arrow, 'from', elements);
  const to = spreadEnd(arrow, 'to', elements);
  // One end on a side across the flow (a group's edge leaving its frame's side, auto-layout-cluster-seats.ts), the
  // other along it: one bend, out of the side first, so the line meets each end square.
  const across = (anchor: Anchor) => {
    const side = anchorPrimarySide(anchor);
    return axis === 'TB' ? side === 'e' || side === 'w' : side === 'n' || side === 's';
  };
  const fromAcross = across(arrow.from.anchor);
  if (fromAcross !== across(arrow.to.anchor)) {
    const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
    const bend = fromAcross === (axis === 'TB') ? { x: to.x, y: from.y } : { x: from.x, y: to.y };
    if (Math.abs(from.x - to.x) < 1 || Math.abs(from.y - to.y) < 1) return undefined;
    return [{ dx: bend.x - mid.x, dy: bend.y - mid.y }];
  }
  const half = axis === 'TB' ? (to.x - from.x) / 2 : (to.y - from.y) / 2;
  if (Math.abs(half) < 1) return undefined;
  return axis === 'TB'
    ? [
        { dx: -half, dy: 0 },
        { dx: half, dy: 0 },
      ]
    : [
        { dx: 0, dy: -half },
        { dx: 0, dy: half },
      ];
}

// Every angled arrow in `elements` given its two bends. One whose pinned ends
// already line up runs straight: an angled style with nothing to bend drew a
// zero-length elbow and turned its head sideways.
export function withOrthogonalBends(elements: Element[], axis: 'TB' | 'LR'): Element[] {
  return elements.map((el) => {
    if (el.type !== 'arrow' || el.arrowStyle !== 'angled') return el;
    const curvePoints = orthogonalBends(el, elements, axis);
    if (curvePoints) return { ...el, curvePoints };
    return el.from.kind === 'pinned' && el.to.kind === 'pinned'
      ? { ...el, arrowStyle: 'straight' as const }
      : el;
  });
}

// The flow an angled arrow's ends face each other along, or null: a bottom to a lower top, a top to a higher bottom
// (TB), a right side to a box further right, a left side to one further left (LR).
function facingAxis(arrow: ArrowElement, elements: Element[]): 'TB' | 'LR' | null {
  if (arrow.from.kind !== 'pinned' || arrow.to.kind !== 'pinned') return null;
  const [fs, ts] = [anchorPrimarySide(arrow.from.anchor), anchorPrimarySide(arrow.to.anchor)];
  const from = endpointPosition(arrow.from, elements);
  const to = endpointPosition(arrow.to, elements);
  if ((fs === 's' && ts === 'n' && to.y > from.y) || (fs === 'n' && ts === 's' && to.y < from.y))
    return 'TB';
  if ((fs === 'e' && ts === 'w' && to.x > from.x) || (fs === 'w' && ts === 'e' && to.x < from.x))
    return 'LR';
  return null;
}

// How far a facing arrow's cross run keeps off its own ends, off another box and off a container's border, and the
// band under a container's top edge its heading takes.
const FACING_END_CLEAR = 12;
const FACING_BOX_CLEAR = 8;
const FACING_HEADING_BAND = 32;

// Where a facing arrow's cross run sits along its flow: half way between its ends when that is clear, else the clear
// level nearest half way, where clear means off every other box, off every container's border and its heading band
// (a frame's title, a subnet's CIDR), so the run never strikes text; half way when no level is clear.
function crossLevel(
  axis: 'TB' | 'LR',
  from: { x: number; y: number },
  to: { x: number; y: number },
  arrow: ArrowElement,
  elements: Element[],
): number {
  const tb = axis === 'TB';
  const [a, b] = tb ? [from.y, to.y] : [from.x, to.x];
  const [lo, hi] = [Math.min(a, b) + FACING_END_CLEAR, Math.max(a, b) - FACING_END_CLEAR];
  const mid = (a + b) / 2;
  if (lo > hi) return mid;
  const [c0, c1] = tb
    ? [Math.min(from.x, to.x), Math.max(from.x, to.x)]
    : [Math.min(from.y, to.y), Math.max(from.y, to.y)];
  const ends = new Set([arrow.from, arrow.to].map((e) => (e.kind === 'pinned' ? e.elementId : '')));
  const blocked: [number, number][] = [];
  for (const el of elements) {
    if (!isBoxed(el) || ends.has(el.id)) continue;
    const [p0, p1] = tb ? [el.y, el.y + el.height] : [el.x, el.x + el.width];
    const [q0, q1] = tb ? [el.x, el.x + el.width] : [el.y, el.y + el.height];
    if (q1 <= c0 || q0 >= c1) continue;
    if (!isContainer(el)) blocked.push([p0 - FACING_BOX_CLEAR, p1 + FACING_BOX_CLEAR]);
    else
      blocked.push(
        [p0 - FACING_BOX_CLEAR, p0 + (tb ? FACING_HEADING_BAND : FACING_BOX_CLEAR)],
        [p1 - FACING_BOX_CLEAR, p1 + FACING_BOX_CLEAR],
      );
  }
  const free = (v: number) => blocked.every(([s0, s1]) => v <= s0 || v >= s1);
  if (free(mid)) return mid;
  // The clear levels nearest half way lie on the edges of what blocks it.
  const candidates = blocked
    .flat()
    .filter((v) => v >= lo && v <= hi && free(v))
    .sort((u, v) => Math.abs(u - mid) - Math.abs(v - mid));
  return candidates[0] ?? mid;
}

// An agent's own elements (docs/specs/008-canvas/layout-cleanup.md "Angled lines bend twice"): every angled arrow
// given no curve points whose ends face each other takes two bends, its cross run at a clear level (crossLevel), or
// runs straight when its ends line up. Its plain L ran its last stretch along the far box's edge.
export function withFacingBends(elements: Element[]): Element[] {
  return elements.map((el) => {
    if (el.type !== 'arrow' || el.arrowStyle !== 'angled' || el.curvePoints?.length) return el;
    const axis = facingAxis(el, elements);
    if (!axis) return el;
    const from = spreadEnd(el, 'from', elements);
    const to = spreadEnd(el, 'to', elements);
    if (axis === 'TB' ? Math.abs(to.x - from.x) < 1 : Math.abs(to.y - from.y) < 1)
      return { ...el, arrowStyle: 'straight' as const };
    const level = crossLevel(axis, from, to, el, elements);
    const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
    const points =
      axis === 'TB'
        ? [
            { x: from.x, y: level },
            { x: to.x, y: level },
          ]
        : [
            { x: level, y: from.y },
            { x: level, y: to.y },
          ];
    return { ...el, curvePoints: points.map((p) => ({ dx: p.x - mid.x, dy: p.y - mid.y })) };
  });
}
