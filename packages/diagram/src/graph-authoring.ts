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
import { ARROW_THICKNESS_PX } from './arrow-style';
import { coerceShapeKind } from './validate';
// `Element` is defined on the barrel (index.ts); a type-only import back into
// it is erased at runtime, so the cycle is harmless — the package's sanctioned
// pattern (auto-layout.ts does the same).
import type { ArrowElement, Element } from './index';

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
  // Stroke flavour (spec/73): 'dashed' → a dashed stroke, 'thick' → the
  // thick width preset. Omitted = the default solid medium line.
  line?: 'solid' | 'dashed' | 'thick';
  // Arrowhead placement: which end(s) carry a head. Omitted = 'to', the
  // ordinary directed arrow.
  ends?: 'to' | 'none' | 'both' | 'from';
  // Head marker: 'circle' → hollow circle, 'cross' → the open-V head (the
  // closest marker to Mermaid's x terminal). Omitted = the filled triangle.
  head?: 'triangle' | 'circle' | 'cross';
};

// A named cluster of nodes (spec/73: a Mermaid subgraph). Rendered as a
// `frame` shape drawn around its members and laid out as one block — see
// layoutClusteredGraph (auto-layout-clusters.ts). Optional and additive:
// callers that don't speak clusters (the MCP today) ignore it.
export type GraphCluster = {
  // Referenceable id — an edge may point at a cluster; the arrow pins to
  // its frame. Must not collide with a node id.
  id: string;
  // The frame's header label. Omitted = the id.
  label?: string;
  // Member node ids. Unknown ids are ignored; a node listed in two
  // clusters belongs to the first.
  members: string[];
};

export type DiagramGraph = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  clusters?: GraphCluster[];
};

// One edge → one pinned arrow, carrying the edge's style onto the arrow
// element's real stroke/ends/head fields. Placeholder anchors — the layout's
// reanchorArrow rewrites them to the sides that actually face. Shared by
// graphToElements and the cluster layout so the mapping can't diverge.
export function edgeToArrow(e: GraphEdge, id: string): ArrowElement {
  return {
    id,
    type: 'arrow',
    from: { kind: 'pinned', elementId: e.from, anchor: 's' },
    to: { kind: 'pinned', elementId: e.to, anchor: 'n' },
    ...(e.label !== undefined ? { label: e.label } : {}),
    ...(e.line === 'dashed' ? { strokeStyle: 'dashed' as const } : {}),
    ...(e.line === 'thick' ? { strokeWidth: ARROW_THICKNESS_PX.thick } : {}),
    ...(e.ends && e.ends !== 'to' ? { arrowEnds: e.ends } : {}),
    ...(e.head === 'circle' ? { arrowheadShape: 'circle-hollow' as const } : {}),
    ...(e.head === 'cross' ? { arrowheadShape: 'line' as const } : {}),
  };
}

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
    .map((e) => edgeToArrow(e, makeEdgeId()));

  return [...nodes, ...arrows];
}
