import { describe, expect, it } from 'vitest';
import { cpuMsOf } from '@livediagram/vitest-config/cpu-time';
import { layoutGraph, type GraphInput } from './graph-input';
import { GRAPH_LAYOUT_MAX_EDGES, GRAPH_LAYOUT_MAX_NODES } from './graph-limits';

// docs/specs/015-api/mcp-server.md §4.7 "The graph look": the look's passes (side steps, the spine, loops and
// detours, the title and key) on top of the layered layout keep the largest graph allowed inside the one-second
// budget graph-limits.ts sets for the worst shape. Measured 2026-10-13: 500 nodes / 998 edges laid out in 314 ms
// (the layout alone 187 ms), and a 150-node graph laid out both ways for auto direction in 31 ms.

function randomGraph(nodes: number, edges: number): GraphInput {
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const graph: GraphInput = {
    title: 'Worst case',
    key: true,
    nodes: Array.from({ length: nodes }, (_, i) => ({
      id: `n${i}`,
      label: `Node number ${i}`,
      ...(i % 9 === 0 ? { shape: 'diamond' } : {}),
    })),
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

describe('graph look cost', () => {
  it('lays out the largest graph allowed in under a second of CPU', () => {
    const graph = randomGraph(GRAPH_LAYOUT_MAX_NODES, GRAPH_LAYOUT_MAX_EDGES);
    expect(cpuMsOf(() => layoutGraph(graph))).toBeLessThan(1000);
  }, 30_000);

  it('lays a 150-node graph out both ways for auto direction in under 250 ms of CPU', () => {
    const graph = randomGraph(150, 250);
    expect(cpuMsOf(() => layoutGraph(graph))).toBeLessThan(250);
  });
});
