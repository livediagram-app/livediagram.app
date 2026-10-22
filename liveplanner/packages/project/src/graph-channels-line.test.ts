// Only lines drawn alike share a run across a gap (docs/specs/015-api/mcp-server.md "Flow lines are elbows"): a source's
// solid call and dashed event line each take their own channel, so the dashed line never rides the solid one's run.
import { describe, expect, it } from 'vitest';
import { layoutGraph } from './graph-input';
import { arrowPolyline } from './arrow-path-hits';
import { elementIndexFor } from './geometry';
import type { ArrowElement, Element } from './index';

let n = 0;
const arrowTo = (els: Element[], to: string) =>
  els.find(
    (e) => e.type === 'arrow' && e.to.kind === 'pinned' && e.to.elementId === to,
  ) as ArrowElement;
// The y of an arrow's runs across the page.
const acrossAt = (els: Element[], a: ArrowElement) => {
  const pts = arrowPolyline(a, elementIndexFor(els));
  return pts
    .slice(1)
    .flatMap((p, i) =>
      Math.abs(p.y - pts[i]!.y) < 0.5 && Math.abs(p.x - pts[i]!.x) > 1 ? [p.y] : [],
    );
};

describe('channels by line', () => {
  it("gives a source's solid and dashed lines their own runs across the gap", () => {
    const els = layoutGraph(
      {
        style: 'flow',
        direction: 'down',
        nodes: [
          { id: 'pay', label: 'Payments' },
          { id: 'x', label: 'Other' },
          { id: 'stripe', label: 'Stripe' },
          { id: 'bus', label: 'Event bus' },
          { id: 'y', label: 'Third' },
        ],
        edges: [
          { from: 'pay', to: 'stripe' },
          { from: 'pay', to: 'bus', line: 'dashed' },
          { from: 'x', to: 'bus', line: 'dashed' },
          { from: 'x', to: 'y' },
        ],
      },
      { makeEdgeId: () => `e${n++}` },
    );
    const solid = acrossAt(els, arrowTo(els, 'stripe'));
    const dashed = acrossAt(
      els,
      els.find(
        (e) =>
          e.type === 'arrow' &&
          e.strokeStyle === 'dashed' &&
          e.from.kind === 'pinned' &&
          e.from.elementId === 'pay',
      ) as ArrowElement,
    );
    expect(solid.length).toBeGreaterThan(0);
    expect(dashed.length).toBeGreaterThan(0);
    for (const y of solid) expect(dashed.every((d) => Math.abs(d - y) >= 1)).toBe(true);
  });
});
