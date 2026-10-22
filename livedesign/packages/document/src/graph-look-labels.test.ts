import { describe, expect, it } from 'vitest';
import { labelRoom } from './auto-layout-tidy-flow';
import { layoutGraph, type GraphInput } from './graph-input';
import type { BoxedElement } from './index';

// Edge labels in the graph look (docs/specs/015-api/mcp-server.md §4.7 "Flow lines are elbows"): the gap between two
// ranks fits the widest label crossing it. Labels clear of boxes are held by the routing fixtures' collision ceiling
// (packages/diagram-lint/src/fixtures/routing-baseline.json).

let n = 0;
const lay = (g: GraphInput) => layoutGraph(g, { makeEdgeId: () => `e${n++}` });

describe('edge labels', () => {
  it('widens the gap between ranks to fit a long label left to right', () => {
    const els = lay({
      direction: 'right',
      lines: 'angled',
      nodes: [
        { id: 'a', label: 'Order' },
        { id: 'b', label: 'Invoice' },
      ],
      edges: [{ from: 'a', to: 'b', label: 'raises one invoice per shipment' }],
    });
    const [a, b] = ['a', 'b'].map((id) => els.find((e) => e.id === id) as BoxedElement);
    expect(b!.x - (a!.x + a!.width)).toBeGreaterThanOrEqual(
      labelRoom('raises one invoice per shipment').w,
    );
  });
});
