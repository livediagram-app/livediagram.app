import { describe, expect, it } from 'vitest';
import { cpuMsOf } from '@livediagram/vitest-config/cpu-time';
import { layoutGraph, type GraphInput } from './graph-input';
import { GRAPH_LAYOUT_MAX_EDGES, GRAPH_LAYOUT_MAX_NODES } from './graph-limits';

// docs/specs/015-api/mcp-server.md §4.7 "The graph look": the look's passes (side steps, the spine, loops and
// detours, the title and key) on top of the layered layout keep the largest graph allowed inside the one-second
// budget graph-limits.ts sets for the worst shape. Measured 2026-10-13: 500 nodes / 998 edges laid out in 314 ms
// (the layout alone 187 ms), and a 150-node graph laid out both ways for auto direction in 31 ms. Indexing the
// solid boxes by place for the loop and detour check (rectGrid) took the largest graph from 222 to 166 ms, best of
// three warm passes.

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

// Untimed warm-ups, then the fastest of three: `cpuUsage` bills the whole process, so a cold pass also pays for V8
// compiling the layout on its background threads. Under coverage on a CI runner one cold pass of the largest graph
// read 1,773 ms; warm it is about 320 ms locally under coverage. Same pattern as mind-connector-route.perf.test.ts.
const WARM_UP_PASSES = 2;
const fastest = (graph: GraphInput) => {
  for (let pass = 0; pass < WARM_UP_PASSES; pass++) layoutGraph(graph);
  return Math.min(...[0, 1, 2].map(() => cpuMsOf(() => layoutGraph(graph))));
};

describe('graph look cost', () => {
  it('lays out the largest graph allowed in under a second of CPU', () => {
    const graph = randomGraph(GRAPH_LAYOUT_MAX_NODES, GRAPH_LAYOUT_MAX_EDGES);
    expect(fastest(graph)).toBeLessThan(1000);
  }, 60_000);

  it('lays a 150-node graph out both ways for auto direction in under 250 ms of CPU', () => {
    const graph = randomGraph(150, 250);
    expect(fastest(graph)).toBeLessThan(250);
  });
});
