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

import { arrowEndpointSpread } from './arrow-endpoint-spread';
import { endpointPosition } from './geometry';
import type { ArrowElement, Element } from './index';

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
