// How large a graph the layered layout is asked to arrange (docs/specs/020-import-export/mermaid.md
// "Limits"). Every path that lays out a bare node/edge graph applies these before the layout runs:
// the Mermaid parser, the MCP's graph input and draw.io's graph-only JSON export.
//
// Provenance (measured 2026-10-10, layoutClusteredGraph on an Apple-silicon laptop): the layout's
// crossing reduction grows faster than linearly with the edges. A random 500-node / 1,000-edge graph
// took 1.3 s, 1,000 / 1,000 took 2.5 s, 2,000 / 2,000 took 9.4 s, and the 14,400 edges of
// `a0&...&a119 --> b0&...&b119` took 21 s; a 12,000-node draw.io export froze the tab for 58 s.
// The caps keep the worst measured shape near one second, far beyond any diagram a person reads.
// Safe range: raise only with a fresh measurement of the worst shapes above.

/** The most nodes one laid-out graph holds. */
export const GRAPH_LAYOUT_MAX_NODES = 500;

/** The most edges one laid-out graph holds (a Mermaid `&` fan-out counts every pair). */
export const GRAPH_LAYOUT_MAX_EDGES = 1_000;

/** The refusal for a graph over either cap, naming both limits; null when it fits. */
export function graphTooLargeError(nodes: number, edges: number): string | null {
  if (nodes <= GRAPH_LAYOUT_MAX_NODES && edges <= GRAPH_LAYOUT_MAX_EDGES) return null;
  return (
    `The diagram is too large to lay out (${nodes} nodes, ${edges} connections): up to ` +
    `${GRAPH_LAYOUT_MAX_NODES} nodes and ${GRAPH_LAYOUT_MAX_EDGES} connections are supported. ` +
    'Split it into several diagrams.'
  );
}
