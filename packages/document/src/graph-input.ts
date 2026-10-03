// The MCP's graph-first input (docs/specs/015-api/mcp-server.md §4.7): a node/edge graph, or the same
// thing written as Mermaid, turned into laid-out elements. Three things happen
// here that the shared graph code doesn't do on its own:
//
//  - Labels are capped (GRAPH_LABEL_MAX). A label is the heading in the box;
//    a longer one is cut at a word boundary with an ellipsis and its full text
//    moves into the node's note, so a verbose model's detail lands somewhere
//    useful instead of filling the box. The editor's own Mermaid import never
//    does this: what a person typed is theirs.
//  - The layout is chosen: flow (with or without groups, through the
//    clustered layout), tree or mindmap, in the requested direction.
//  - The arrows get their routing (lines), defaulting per style.

import { autoLayoutElements, type LayoutStyle } from './auto-layout';
import { layoutClusteredGraph, sweepEdgelessNodes } from './auto-layout-clusters';
import { withOrthogonalBends } from './arrow-orthogonal';
import type { ArrowStyle } from './arrow-style';
import {
  graphToElements,
  type GraphCluster,
  type GraphEdge,
  type GraphNode,
} from './graph-authoring';
import { parseMermaid } from './mermaid';
import type { Element } from './index';

export const GRAPH_LABEL_MAX = 40;

// A node may name its group itself (`group`), as well as or instead of being
// listed in the group's `members`: the natural shape for a model to write.
export type GraphInputNode = GraphNode & { group?: string };

export type GraphInput = {
  nodes: GraphInputNode[];
  edges: GraphEdge[];
  groups?: (Omit<GraphCluster, 'members'> & { members?: string[] })[];
  direction?: 'down' | 'right';
  style?: LayoutStyle;
  lines?: ArrowStyle;
};

// The words that start a clause after a noun phrase: "Orders service WHICH
// creates orders", "Message queue FOR async events". The part before the first
// one is the heading a person would have written.
const CLAUSE_START =
  /\s(?:which|that|who|whom|whose|where|when|for|to|with|by|holding|sending|serving|served|handling|storing|running|using|used|responsible)\s/i;

// A label within `max` characters. When it runs over, bracketed asides go
// first ("Web client (React SPA served from the CDN)" is "Web client"); then
// the heading is the noun phrase before the first clause word, if there is one
// of at least two words; otherwise the text is cut at a word boundary and
// marked with an ellipsis. Returns the text unchanged when it already fits.
export function capLabel(text: string, max = GRAPH_LABEL_MAX): { label: string; cut: boolean } {
  const whole = text.replace(/\s+/g, ' ').trim();
  if (whole.length <= max) return { label: whole, cut: false };
  const clean = whole.replace(/\s*[([][^)\]]*[)\]]/g, '').trim() || whole;
  if (clean.length <= max) return { label: clean, cut: true };
  const clause = CLAUSE_START.exec(clean);
  if (clause) {
    const head = clean.slice(0, clause.index).replace(/[\s,;:.-]+$/, '');
    if (head.length <= max && head.includes(' ')) return { label: head, cut: true };
  }
  const room = clean.slice(0, max - 1);
  const space = room.lastIndexOf(' ');
  const head = space > max * 0.5 ? room.slice(0, space) : room;
  return { label: `${head.replace(/[\s,;:.-]+$/, '')}…`, cut: true };
}

// The graph with every label within the cap: an over-long node label keeps its
// heading and hands its full text to the note (ahead of any note given); an
// over-long edge label is simply cut, an arrow having no note.
export function conciseGraph(input: GraphInput): GraphInput {
  return {
    ...input,
    groups: withNodeGroups(input)?.map((g) =>
      g.label ? { ...g, label: capLabel(g.label).label } : g,
    ),
    nodes: input.nodes.map(({ group: _group, ...n }) => {
      if (!n.label) return n;
      const { label, cut } = capLabel(n.label);
      if (!cut) return { ...n, label };
      const full = n.label.replace(/\s+/g, ' ').trim();
      return { ...n, label, note: n.note ? `${full}\n\n${n.note}` : full };
    }),
    edges: input.edges.map((e) => (e.label ? { ...e, label: capLabel(e.label).label } : e)),
  };
}

// The groups with every node's own `group` folded into its members. A group id
// no group declares is created, labelled with the id.
function withNodeGroups(input: GraphInput): GraphCluster[] | undefined {
  const tagged = input.nodes.filter((n) => n.group);
  if (!input.groups && tagged.length === 0) return undefined;
  const groups = (input.groups ?? []).map((g) => ({ ...g, members: [...(g.members ?? [])] }));
  for (const n of tagged) {
    let g = groups.find((x) => x.id === n.group);
    if (!g) {
      g = { id: n.group!, label: n.group!, members: [] };
      groups.push(g);
    }
    if (!g.members.includes(n.id)) g.members.push(n.id);
  }
  return groups;
}

const DEFAULT_LINES: Record<LayoutStyle, ArrowStyle> = {
  flow: 'straight',
  tree: 'angled',
  mindmap: 'curved',
};

// Laid-out elements for a graph: capped, positioned in the chosen style and
// direction, arrows routed. Groups force the flow style (the clustered layout
// is layered).
export function layoutGraph(input: GraphInput): Element[] {
  const g = conciseGraph(input);
  const direction =
    g.direction === 'right'
      ? ('LR' as const)
      : g.direction === 'down'
        ? ('TB' as const)
        : undefined;
  const style: LayoutStyle = g.groups?.length ? 'flow' : (g.style ?? 'flow');
  const graph = {
    nodes: g.nodes,
    edges: g.edges,
    clusters: g.groups as GraphCluster[] | undefined,
  };
  const laid =
    style === 'flow'
      ? layoutClusteredGraph(graph, { direction })
      : sweepEdgelessNodes(
          autoLayoutElements(graphToElements(graph), {
            direction,
            style,
            // Boxes keep their label-fitted sizes, as in the flow layout.
            fixedSizeIds: new Set(graph.nodes.map((n) => n.id)),
          }),
        );
  const lines = g.lines ?? DEFAULT_LINES[style];
  if (lines === 'straight') return laid;
  const styled = laid.map((el) => (el.type === 'arrow' ? { ...el, arrowStyle: lines } : el));
  // Angled lines bend twice (down, across, down), the org-chart shape, along
  // the flow; a tree always flows down, and so does a flow left on auto.
  return lines === 'angled' ? withOrthogonalBends(styled, direction ?? 'TB') : styled;
}

// The same graph from Mermaid, through the editor's own importer: its direction
// and subgraphs become `direction` and `groups`.
export function graphFromMermaid(
  text: string,
): { ok: true; graph: GraphInput } | { ok: false; error: string } {
  const parsed = parseMermaid(text);
  if (!parsed.ok) return parsed;
  return {
    ok: true,
    graph: {
      nodes: parsed.graph.nodes,
      edges: parsed.graph.edges,
      groups: parsed.graph.clusters,
      direction: parsed.direction === 'LR' ? 'right' : 'down',
    },
  };
}

// A tool's graph-shaped input, from whichever of `graph` / `mermaid` it gave:
// the graph, nothing (the call used elements or a template), or an error that
// names what Mermaid supports.
export function resolveGraphInput(args: { graph?: GraphInput; mermaid?: string }): {
  graph?: GraphInput;
  error?: string;
} {
  if (args.graph) return { graph: args.graph };
  if (args.mermaid === undefined) return {};
  const parsed = graphFromMermaid(args.mermaid);
  return parsed.ok
    ? { graph: parsed.graph }
    : { error: `Could not read the Mermaid: ${parsed.error}` };
}
