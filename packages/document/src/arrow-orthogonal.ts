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
import type { Anchor, ArrowElement, Element } from './index';

// The bends for one arrow along `axis`, or undefined when its ends already
// line up (a straight run needs none) or aren't both pinned.
export function orthogonalBends(
  arrow: ArrowElement,
  elements: Element[],
  axis: 'TB' | 'LR',
): { dx: number; dy: number }[] | undefined {
  if (arrow.from.kind !== 'pinned' || arrow.to.kind !== 'pinned') return undefined;
  const raw = (end: 'from' | 'to') => {
    const p = endpointPosition(arrow[end], elements);
    const s = arrowEndpointSpread(arrow.id, end, elements);
    return { x: p.x + s.x, y: p.y + s.y };
  };
  const from = raw('from');
  const to = raw('to');
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
