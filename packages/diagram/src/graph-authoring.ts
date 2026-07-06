// Graph-first authoring (spec/62 §4.7): turn a plain node/edge graph into
// canvas Element[] so a caller can express only the CONNECTION GRAPH —
// which nodes exist and what points at what — and let the layout engine
// (autoLayoutElements, run by the caller after this) do all positioning.
// This is the lowest-burden authoring path: no x/y/width/height, no anchor
// vocabulary, no arrow-endpoint shapes. Pure + reusable (the MCP server
// today; the public API can adopt it), so it lives in the diagram package
// beside the layout it feeds.
//
// Nodes become `shape` boxes at the origin (autoLayout repositions every
// connected node); edges become pinned arrows whose placeholder anchors
// autoLayout's reanchorArrow replaces with the best-facing sides. An edge
// referencing an unknown node id is dropped rather than producing an arrow
// to nowhere.

import { SHAPE_DEFAULT_SIZE } from './factories';
import { coerceShapeKind } from './validate';
// `Element` is defined on the barrel (index.ts); a type-only import back into
// it is erased at runtime, so the cycle is harmless — the package's sanctioned
// pattern (auto-layout.ts does the same).
import type { Element } from './index';

export type GraphNode = {
  // Stable id the edges reference. Must be unique within the graph.
  id: string;
  // The box's text. Optional — an unlabelled node is a bare box.
  label?: string;
  // A shape kind (square, diamond, cylinder, …). Off-vocabulary values
  // (e.g. "rectangle") are coerced to the nearest real kind; omitted =
  // "square", the default box.
  shape?: string;
};

export type GraphEdge = {
  // Node ids. An edge to/from an id with no matching node is dropped.
  from: string;
  to: string;
  // Optional edge label rendered on the arrow.
  label?: string;
};

export type DiagramGraph = {
  nodes: GraphNode[];
  edges: GraphEdge[];
};

// `makeEdgeId` mints each arrow's id (defaults to crypto.randomUUID, which
// exists in both the Worker and Node runtimes); injectable for
// deterministic tests.
export function graphToElements(
  graph: DiagramGraph,
  makeEdgeId: () => string = () => crypto.randomUUID(),
): Element[] {
  const nodeIds = new Set(graph.nodes.map((n) => n.id));

  const nodes: Element[] = graph.nodes.map((n) => {
    const shape = coerceShapeKind(n.shape);
    const { width, height } = SHAPE_DEFAULT_SIZE[shape];
    return {
      id: n.id,
      type: 'shape' as const,
      shape,
      x: 0,
      y: 0,
      width,
      height,
      ...(n.label !== undefined ? { label: n.label } : {}),
    };
  });

  const arrows: Element[] = graph.edges
    .filter((e) => nodeIds.has(e.from) && nodeIds.has(e.to))
    .map((e) => ({
      id: makeEdgeId(),
      type: 'arrow' as const,
      // Placeholder anchors — autoLayout's reanchorArrow rewrites them to
      // the sides that actually face after positioning.
      from: { kind: 'pinned' as const, elementId: e.from, anchor: 's' as const },
      to: { kind: 'pinned' as const, elementId: e.to, anchor: 'n' as const },
      ...(e.label !== undefined ? { label: e.label } : {}),
    }));

  return [...nodes, ...arrows];
}
