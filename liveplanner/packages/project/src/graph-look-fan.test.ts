import { describe, expect, it } from 'vitest';
import { arrowEndpointSpread } from './arrow-endpoint-spread';
import { fanNeighbourhood } from './graph-look';
import { layoutGraph, type GraphInput } from './graph-input';
import type { ArrowElement } from './index';

// singleBend fans an arrow's ends on the neighbourhood of its two boxes (graph-look.ts fanNeighbourhood): the same
// offsets the whole drawing gives, for every arrow end of a dense graph.
function denseGraph(nodes: number, edges: number): GraphInput {
  let seed = 11;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const graph: GraphInput = {
    nodes: Array.from({ length: nodes }, (_, i) => ({ id: `n${i}` })),
    edges: [],
  };
  for (let i = 1; i < nodes; i++)
    graph.edges.push({ from: `n${Math.floor(rnd() * i)}`, to: `n${i}` });
  while (graph.edges.length < edges)
    graph.edges.push({
      from: `n${Math.floor(rnd() * nodes)}`,
      to: `n${Math.floor(rnd() * nodes)}`,
    });
  return graph;
}

describe('fanNeighbourhood', () => {
  it('fans every end exactly as the whole drawing does', () => {
    const elements = layoutGraph(denseGraph(60, 140));
    const arrows = elements.filter((el): el is ArrowElement => el.type === 'arrow');
    expect(arrows.length).toBeGreaterThan(100);
    for (const arrow of arrows) {
      const ends = [arrow.from, arrow.to].map((e) => (e.kind === 'pinned' ? e.elementId : ''));
      const near = fanNeighbourhood(elements, ends[0]!, ends[1]!);
      for (const end of ['from', 'to'] as const)
        expect(arrowEndpointSpread(arrow.id, end, near), `${arrow.id}.${end}`).toEqual(
          arrowEndpointSpread(arrow.id, end, elements),
        );
    }
  });
});
