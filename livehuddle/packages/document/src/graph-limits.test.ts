import { describe, expect, it } from 'vitest';
import { resolveGraphInput } from './graph-input';
import { GRAPH_LAYOUT_MAX_EDGES, GRAPH_LAYOUT_MAX_NODES, graphTooLargeError } from './graph-limits';

// The layout's caps (graph-limits.ts): a graph past them is refused before anything lays it out.

describe('graph layout caps', () => {
  it('refuses an MCP graph input past either cap, and passes one within', () => {
    const nodes = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `n${i}` }));
    expect(
      resolveGraphInput({ graph: { nodes: nodes(GRAPH_LAYOUT_MAX_NODES + 1), edges: [] } }).error,
    ).toMatch(/too large/);
    const edges = Array.from({ length: GRAPH_LAYOUT_MAX_EDGES + 1 }, () => ({
      from: 'n0',
      to: 'n1',
    }));
    expect(resolveGraphInput({ graph: { nodes: nodes(2), edges } }).error).toMatch(/too large/);
    expect(resolveGraphInput({ graph: { nodes: nodes(2), edges: [] } }).graph).toBeDefined();
  });

  it('answers null at the caps exactly', () => {
    expect(graphTooLargeError(GRAPH_LAYOUT_MAX_NODES, GRAPH_LAYOUT_MAX_EDGES)).toBeNull();
  });
});
