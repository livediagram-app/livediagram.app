// Graph-first authoring (docs/specs/015-api/mcp-server.md §4.7): turn a plain node/edge graph into
// canvas Element[] so a caller can express only the CONNECTION GRAPH —
// which nodes exist and what points at what — and let the layout engine
// (autoLayoutElements, run by the caller after this) do all positioning.
// This is the lowest-burden authoring path: no x/y/width/height, no anchor
// vocabulary, no arrow-endpoint shapes. Pure + reusable (the MCP server
// today; the public API can adopt it), so it lives in the document package
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
import { ENTITY_MAX_FIELDS, ENTITY_MAX_TEXT, type EntityField } from './data-shapes';
import { entityHeight } from './entity-geometry';
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
  // Optional web address — becomes the element's URL link (docs/specs/020-import-export/mermaid.md:
  // Mermaid `click A "https://…"`).
  link?: string;
  // Optional detail behind the heading: becomes the element's note, which the
  // editor shows on the element (docs/specs/015-api/mcp-server.md §4.7).
  note?: string;
  // Field rows: the node becomes an entity (docs/specs/009-elements/entity.md), a titled record box, with
  // `label` as its title. What an ER import makes of each table
  // (docs/specs/020-import-export/mermaid.md).
  fields?: EntityField[];
};

export type GraphEdge = {
  // Node ids. An edge to/from an id with no matching node is dropped.
  from: string;
  to: string;
  // Optional edge label rendered on the arrow.
  label?: string;
  // Stroke flavour (docs/specs/020-import-export/mermaid.md): 'dashed' → a dashed stroke, 'thick' → the
  // thick width preset. Omitted = the default solid medium line.
  line?: 'solid' | 'dashed' | 'thick';
  // Arrowhead placement: which end(s) carry a head. Omitted = 'to', the
  // ordinary directed arrow.
  ends?: 'to' | 'none' | 'both' | 'from';
  // Head marker: 'circle' → hollow circle, 'cross' → the open-V head (the
  // closest marker to Mermaid's x terminal). Omitted = the filled triangle.
  head?: 'triangle' | 'circle' | 'cross';
};

// A named cluster of nodes (docs/specs/020-import-export/mermaid.md: a Mermaid subgraph). Rendered as a
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
// A box that fits its label (docs/specs/015-api/mcp-server.md §4.7 "Boxes fit their labels"): the
// shape's default size at least, widened to the label's estimated one-line
// width up to a cap, then taller by a line for each wrap past it. An estimate
// (no DOM here), tuned to the default label face at its default size; the
// layout's peer sizing then gives a whole tier the size its longest label
// needs. A diamond's text only fits its inner half, so it gets more room.
// The side of an unlabelled circle node (see graphToElements).
export const DOT_SIZE = 28;
const CHAR_PX = 7.4;
// Capitals set about 30% wider than the average glyph CHAR_PX assumes, so an
// all-caps name ("TEAM_MEMBER", an ER table) was sized short and wrapped
// mid-word. Text length in average-glyph units.
const CAPS_WIDTH = 1.3;
const glyphUnits = (text: string) =>
  [...text].reduce((sum, ch) => sum + (ch >= 'A' && ch <= 'Z' ? CAPS_WIDTH : 1), 0);
const LINE_PX = 19;
const PAD_PX = 40;
const MAX_BOX_W = 240;

export function labelBoxSize(
  label: string | undefined,
  shape: string,
): { width: number; height: number } {
  const base = SHAPE_DEFAULT_SIZE[coerceShapeKind(shape)];
  const text = (label ?? '').trim();
  if (!text) return { width: base.width, height: base.height };
  const roomy = shape === 'diamond' ? 1.45 : 1;
  const units = glyphUnits(text);
  const oneLine = units * CHAR_PX * roomy + PAD_PX;
  const width = Math.round(Math.min(MAX_BOX_W * roomy, Math.max(base.width, oneLine)));
  const lines = Math.max(1, Math.ceil((units * CHAR_PX * roomy) / (width - PAD_PX)));
  const height = Math.round(Math.max(base.height, lines * LINE_PX + 28) * (lines > 1 ? roomy : 1));
  return { width, height };
}

// An entity node: title-aligned top-left (the title otherwise sits centred over
// the rows), wide enough for its longest row, tall enough for every row.
function entityNode(n: GraphNode, raw: EntityField[]): Element {
  const clip = (t: string) => t.slice(0, ENTITY_MAX_TEXT);
  const fields = raw
    .slice(0, ENTITY_MAX_FIELDS)
    .map((f) => ({ name: clip(f.name), ...(f.type ? { type: clip(f.type) } : {}) }));
  const widest = Math.max(
    glyphUnits(n.label ?? ''),
    ...fields.map((f) => glyphUnits(f.name) + glyphUnits(f.type ?? '') + 2),
  );
  return {
    id: n.id,
    type: 'shape' as const,
    shape: 'entity' as const,
    x: 0,
    y: 0,
    width: Math.round(Math.min(360, Math.max(200, widest * CHAR_PX + PAD_PX))),
    height: entityHeight(fields.length, 'sm'),
    textSize: 'sm' as const,
    textAlignX: 'left' as const,
    textAlignY: 'top' as const,
    ...(n.label !== undefined ? { label: n.label } : {}),
    entityFields: fields,
    ...(n.note ? { note: n.note } : {}),
  };
}

export function graphToElements(
  graph: DiagramGraph,
  makeEdgeId: () => string = () => crypto.randomUUID(),
): Element[] {
  const nodeIds = new Set(graph.nodes.map((n) => n.id));

  const nodes: Element[] = graph.nodes.map((n) => {
    const shape = coerceShapeKind(n.shape);
    // An unlabelled circle is a dot: a state diagram's start / end, or a
    // junction. Drawn at the default circle size it read as an empty box
    // waiting for text. Solid in the theme's accent via the preset binding,
    // which a theme walk resolves (docs/specs/020-import-export/mermaid.md).
    if (n.fields) return entityNode(n, n.fields);
    if (shape === 'circle' && !(n.label ?? '').trim()) {
      return {
        id: n.id,
        type: 'shape' as const,
        shape,
        x: 0,
        y: 0,
        width: DOT_SIZE,
        height: DOT_SIZE,
        colorPreset: 'solid',
        ...(n.note ? { note: n.note } : {}),
      };
    }
    const { width, height } = labelBoxSize(n.label, shape);
    return {
      id: n.id,
      type: 'shape' as const,
      shape,
      x: 0,
      y: 0,
      width,
      height,
      // One fixed size for every node's text, the size labelBoxSize measures
      // against. The default 'scale' fills each box, so a short heading came
      // out huge beside a long one set small.
      textSize: 'sm' as const,
      ...(n.label !== undefined ? { label: n.label } : {}),
      ...(n.link !== undefined ? { link: { kind: 'url' as const, url: n.link } } : {}),
      ...(n.note ? { note: n.note } : {}),
    };
  });

  const arrows: Element[] = graph.edges
    .filter((e) => nodeIds.has(e.from) && nodeIds.has(e.to))
    .map((e) => edgeToArrow(e, makeEdgeId()));

  return [...nodes, ...arrows];
}
