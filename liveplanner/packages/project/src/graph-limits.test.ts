import { describe, expect, it } from 'vitest';
import { resolveGraphInput } from './graph-input';
import { GRAPH_LAYOUT_MAX_EDGES, GRAPH_LAYOUT_MAX_NODES, graphTooLargeError } from './graph-limits';
import { parseMermaid } from './mermaid';

// The layout's caps (docs/specs/020-import-export/mermaid.md "Limits"): a graph past them is refused
// before anything lays it out. `a0&...&a119 --> b0&...&b119` used to become 14,400 edges and a 21 s
// layout from one line.

const fan = (n: number) => {
  const side = (p: string) => Array.from({ length: n }, (_, i) => `${p}${i}`).join(' & ');
  return `flowchart TD\n${side('a')} --> ${side('b')}`;
};

describe('graph layout caps', () => {
  it('refuses a fan-out past the edge cap, quickly and before building every pair', () => {
    const started = performance.now();
    const parsed = parseMermaid(fan(120));
    expect(performance.now() - started).toBeLessThan(200);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.error).toContain(`${GRAPH_LAYOUT_MAX_EDGES} connections`);
  });

  it('keeps a fan-out within the cap', () => {
    const parsed = parseMermaid(fan(31));
    expect(parsed.ok && parsed.graph.edges.length).toBe(961);
  });

  it('refuses a Mermaid graph past the node cap', () => {
    const lines = Array.from(
      { length: GRAPH_LAYOUT_MAX_NODES + 1 },
      (_, i) => `  n${i}[Node ${i}]`,
    );
    const parsed = parseMermaid(`flowchart TD\n${lines.join('\n')}\n  n0 --> n1`);
    expect(parsed.ok).toBe(false);
  });

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
