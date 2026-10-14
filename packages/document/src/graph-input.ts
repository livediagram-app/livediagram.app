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

import { autoLayoutElements, type LayoutDirection, type LayoutStyle } from './auto-layout';
import { layoutClusteredGraph, sweepEdgelessNodes } from './auto-layout-clusters';
import { withOrthogonalBends } from './arrow-orthogonal';
import { withoutNotches } from './graph-notches';
import type { ArrowStyle } from './arrow-style';
import {
  graphToElements,
  type GraphCluster,
  type GraphEdge,
  type GraphLook,
} from './graph-authoring';
import {
  applyRoutes,
  isFlowchart,
  placeElbowLabels,
  routeLoops,
  sideRejoins,
  sideStepEdges,
  spreadChannels,
  stackBuses,
  stackedParents,
  straightenSpine,
  withTones,
  type LookNode,
  type Routes,
} from './graph-look';
import { unionRects } from './geometry-primitives';
import { isBoxed } from './index';
import { withHeaderAndKey, type GraphKey } from './graph-header';
import { layoutLanes } from './graph-lanes';
import { branchExits, withExactEnds } from './graph-branches';
import { layoutCycle } from './graph-cycle';
import { layoutMindmapGraph } from './graph-mindmap';
import { layoutStormGraph } from './graph-storm';
import { parseMermaid } from './mermaid';
import {
  afterWord,
  isSequenceDiagram,
  parseSequenceDiagram,
  type SequenceDiagram,
} from './mermaid-sequence';
import { layoutSequence } from './sequence-layout';
import { graphTooLargeError } from './graph-limits';
import type { Element } from './index';

export const GRAPH_LABEL_MAX = 40;

// A node may name its group itself (`group`), as well as or instead of being
// listed in the group's `members`: the natural shape for a model to write.
export type GraphInputNode = LookNode & { group?: string; esKind?: string };

// The layouts graph input offers: the editor's three, and two of its own (docs/specs/015-api/mcp-server.md §4.7).
export type GraphStyle = LayoutStyle | 'lanes' | 'cycle' | 'storm' | 'sequence';

export type GraphInput = {
  // A heading and a muted caption above the drawing, and a key of the shapes it uses (graph-header.ts).
  title?: string;
  subtitle?: string;
  key?: GraphKey;
  nodes: GraphInputNode[];
  edges: GraphEdge[];
  groups?: (Omit<GraphCluster, 'members'> & { members?: string[] })[];
  direction?: 'down' | 'right';
  style?: GraphStyle;
  lines?: ArrowStyle;
  // A sequence diagram read from Mermaid (mermaid-sequence.ts); style sequence draws it, else its nodes and edges.
  sequence?: SequenceDiagram;
};

// Up to this many nodes a graph's text is `md`, the template's size; past it `sm`, so a large system still fits.
export const LOOK_MD_MAX_NODES = 12;
// Auto direction lays a graph out both ways up to this size (two layouts' cost) and keeps the one whose aspect is
// nearer LANDSCAPE; past it, down.
export const AUTO_DIRECTION_MAX_NODES = 150;
const LANDSCAPE = 1.5;

// The words that start a clause after a noun phrase: "Orders service WHICH
// creates orders", "Message queue FOR async events". The part before the first
// one is the heading a person would have written.
const CLAUSE_START =
  /\s(?:which|that|who|whom|whose|where|when|for|to|with|by|holding|sending|serving|served|handling|storing|running|using|used|responsible)\s/i;

// Whether `s` is at most `max` characters (code points, as names count them in truncateName: an
// emoji is one, never two). Stops counting past `max`, so a long label costs no more than a short one.
function fitsIn(s: string, max: number): boolean {
  if (s.length <= max) return true;
  let n = 0;
  for (const _ of s) if (++n > max) return false;
  return true;
}

// The first `k` characters of `s`, never ending on half a surrogate pair.
function firstChars(s: string, k: number): string {
  let out = '';
  let n = 0;
  for (const ch of s) {
    if (n++ >= k) break;
    out += ch;
  }
  return out;
}

// A label within `max` characters. When it runs over, bracketed asides go
// first ("Web client (React SPA served from the CDN)" is "Web client"); then
// the heading is the noun phrase before the first clause word, if there is one
// of at least two words; otherwise the text is cut at a word boundary and
// marked with an ellipsis. Returns the text unchanged when it already fits.
//
// The text is untrusted (any API token's changeset reaches it), so every pass is a linear scan:
// the regular expressions these replace backtracked quadratically over a long run of spaces,
// brackets or punctuation.
export function capLabel(text: string, max = GRAPH_LABEL_MAX): { label: string; cut: boolean } {
  // A label that fits keeps the line breaks it was written with ("App tasks\nECS Fargate"), runs of other space
  // made one; one that is cut is read as one line.
  const lines = text
    .replace(/[^\S\n]+/g, ' ')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .join('\n');
  if (fitsIn(lines, max)) return { label: lines, cut: false };
  const whole = text.replace(/\s+/g, ' ').trim();
  const clean = withoutAsides(whole).trim() || whole;
  if (fitsIn(clean, max)) return { label: clean, cut: true };
  const clause = CLAUSE_START.exec(clean);
  if (clause) {
    const head = trimTrailingPunctuation(clean.slice(0, clause.index));
    if (fitsIn(head, max) && head.includes(' ')) return { label: head, cut: true };
  }
  // Cut by characters, so a surrogate pair is never split into a lone half.
  const room = firstChars(clean, max - 1);
  const space = room.lastIndexOf(' ');
  const head = space > max * 0.5 ? room.slice(0, space) : room;
  return { label: `${trimTrailingPunctuation(head)}…`, cut: true };
}

const OPENERS = new Set(['(', '[']);
const CLOSERS = new Set([')', ']']);
const TRAILING = new Set([',', ';', ':', '.', '-']);
const isSpace = (ch: string) => /\s/.test(ch);

// Every bracketed aside with the whitespace before it: an opener up to the first closer after it,
// of either kind, as `\s*[([][^)\]]*[)\]]` matched. An opener with no closer after it stays.
function withoutAsides(text: string): string {
  const nextCloser = new Array<number>(text.length + 1).fill(-1);
  for (let i = text.length - 1; i >= 0; i -= 1) {
    nextCloser[i] = CLOSERS.has(text[i + 1] ?? '') ? i + 1 : nextCloser[i + 1]!;
  }
  // Characters kept so far; popping the whitespace before an aside costs only what it removes.
  const out: string[] = [];
  for (let i = 0; i < text.length; i += 1) {
    const close = OPENERS.has(text[i]!) ? nextCloser[i]! : -1;
    if (close === -1) {
      out.push(text[i]!);
      continue;
    }
    while (out.length > 0 && isSpace(out[out.length - 1]!)) out.pop();
    i = close;
  }
  return out.join('');
}

// The text without trailing whitespace and `, ; : . -`, as `[\s,;:.-]+$` removed them.
function trimTrailingPunctuation(text: string): string {
  let end = text.length;
  while (end > 0 && (TRAILING.has(text[end - 1]!) || isSpace(text[end - 1]!))) end -= 1;
  return text.slice(0, end);
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

const DEFAULT_LINES: Record<GraphStyle, ArrowStyle> = {
  flow: 'angled',
  tree: 'angled',
  mindmap: 'curved',
  lanes: 'angled',
  cycle: 'curved',
  storm: 'straight',
  sequence: 'straight',
};

// Laid-out elements for a graph: capped, positioned in the chosen style and direction, worn in the template look
// (graph-look.ts: sizes, tones, side steps, loops round the outside, elbows), with its title and key. Groups force the
// flow style (the clustered layout is layered) unless the style is lanes, where each group is a lane.
// `makeEdgeId` names the arrows the edges become; random ids when omitted.
export function layoutGraph(
  input: GraphInput,
  options: { makeEdgeId?: () => string } = {},
): Element[] {
  const { makeEdgeId } = options;
  // A sequence diagram: lifelines and messages in order (sequence-layout.ts), from Mermaid or the graph itself.
  if (input.style === 'sequence') {
    const diagram = input.sequence ?? sequenceFromGraph(input);
    return layoutSequence(input.title ? { ...diagram, title: input.title } : diagram, {
      ...(input.subtitle ? { subtitle: input.subtitle } : {}),
      ...(makeEdgeId ? { makeId: makeEdgeId } : {}),
    });
  }
  // An event-storming board is paper only: notes on lanes, no arrows, no heading (graph-storm.ts). A note's label is
  // its content, kept whole as a sticky's always is, so it skips the heading cap.
  if (input.style === 'storm') return layoutStormGraph(input);
  const g = conciseGraph(input);
  const direction =
    g.direction === 'right'
      ? ('LR' as const)
      : g.direction === 'down'
        ? ('TB' as const)
        : undefined;
  const asked = g.style ?? 'flow';
  const style: GraphStyle = g.groups?.length && asked !== 'lanes' ? 'flow' : asked;
  const look: GraphLook = { textSize: g.nodes.length <= LOOK_MD_MAX_NODES ? 'md' : 'sm' };
  const graph = {
    nodes: g.nodes,
    edges: g.edges,
    clusters: g.groups as GraphCluster[] | undefined,
  };
  const flat = style === 'flow' ? sideStepEdges(g.nodes, g.edges) : new Set<string>();
  // A tree's leaf groups stack under their parent, the compact org chart (graph-look.ts).
  const stacked = style === 'tree' ? stackedParents(g.nodes, g.edges) : new Set<string>();
  const flowLayout = (dir: LayoutDirection) =>
    layoutClusteredGraph(graph, {
      direction: dir,
      look,
      flatEdges: flat,
      ...(makeEdgeId ? { makeEdgeId } : {}),
    });
  let flowDir: LayoutDirection = direction ?? 'TB';
  let laid: Element[];
  if (style === 'mindmap') laid = layoutMindmapGraph(graph, { look, makeEdgeId });
  else if (style === 'lanes') laid = layoutLanes(graph, { look, makeEdgeId });
  else if (style === 'cycle') laid = layoutCycle(graph, { look, makeEdgeId });
  else if (style === 'flow') {
    // Auto direction: a flowchart reads down the page, as the template does; anything else takes whichever
    // direction lands nearer a landscape page (docs/specs/015-api/mcp-server.md §4.7 "Layout choices").
    if (direction || isFlowchart(g.nodes) || g.nodes.length > AUTO_DIRECTION_MAX_NODES)
      laid = flowLayout(flowDir);
    else {
      const down = flowLayout('TB');
      const across = flowLayout('LR');
      const off = (els: Element[]) => {
        const b = unionRects(els.filter(isBoxed));
        return b ? Math.abs(Math.log(b.width / Math.max(1, b.height) / LANDSCAPE)) : 0;
      };
      if (off(across) < off(down)) [laid, flowDir] = [across, 'LR'];
      else laid = down;
    }
  } else
    laid = sweepEdgelessNodes(
      autoLayoutElements(graphToElements(graph, makeEdgeId, look), {
        direction,
        // The one style left by here (storm returned early; flow, mindmap, lanes and cycle have their own).
        style: 'tree',
        stackedParents: stacked,
        // Boxes keep their label-fitted sizes, as in the flow layout.
        fixedSizeIds: new Set(graph.nodes.map((n) => n.id)),
      }),
    );
  // A flow without groups runs its main path down one line, side steps beside it.
  if (style === 'flow' && !g.groups?.length)
    laid = straightenSpine(laid, g.nodes, g.edges, flat, flowDir);
  laid = withTones(laid, g.nodes, g.edges);
  // A tree shows belonging, not flow: its lines carry no heads, as the org-chart template's do, unless an edge asks.
  if (style === 'tree') {
    const asked = new Set(g.edges.filter((e) => e.ends).map((e) => `${e.from}->${e.to}`));
    laid = laid.map((el) =>
      el.type === 'arrow' &&
      el.from.kind === 'pinned' &&
      el.to.kind === 'pinned' &&
      !asked.has(`${el.from.elementId}->${el.to.elementId}`)
        ? { ...el, arrowEnds: 'none' as const }
        : el,
    );
  }
  const lines = g.lines ?? DEFAULT_LINES[style];
  // A mind map and a cycle draw their own connectors.
  if (lines !== 'straight' && style !== 'cycle' && style !== 'mindmap')
    laid = laid.map((el) => (el.type === 'arrow' ? { ...el, arrowStyle: lines } : el));
  // Angled lines bend twice (down, across, down), the org-chart shape, along the flow; edges back to an earlier
  // rank then go round the outside instead.
  const axis = style === 'lanes' ? 'LR' : flowDir;
  if (lines === 'angled') {
    // Trunks and buses (graph-branches.ts); then, down a flow, a step's exits that keep their own start
    // leave by different sides.
    laid = withExactEnds(laid);
    if (style === 'flow') laid = branchExits(laid, { axis, eligible: (a) => !a.exactStart });
    laid = spreadChannels(withOrthogonalBends(laid, axis), axis);
    // Anchors first, every pass; then each routed arrow's bends from its final, fanned ends.
    const routes: Routes = new Map();
    if (style === 'flow' && !g.groups?.length && isFlowchart(g.nodes))
      laid = sideRejoins(laid, axis, routes);
    if (stacked.size) laid = stackBuses(laid, stacked, routes);
    if (style === 'flow' || style === 'lanes') laid = routeLoops(laid, axis, flat, routes);
    laid = withoutNotches(placeElbowLabels(applyRoutes(laid, routes)));
  }
  return withHeaderAndKey(laid, {
    ...(g.title ? { title: g.title } : {}),
    ...(g.subtitle ? { subtitle: g.subtitle } : {}),
    ...(g.key ? { key: g.key, flowchart: isFlowchart(g.nodes) } : {}),
    ...(makeEdgeId ? { makeId: makeEdgeId } : {}),
  });
}

// The same graph from Mermaid, through the editor's own importer: its direction
// and subgraphs become `direction` and `groups`.
export function graphFromMermaid(
  text: string,
): { ok: true; graph: GraphInput } | { ok: false; error: string } {
  if (isSequenceDiagram(text)) {
    const read = parseSequenceDiagram(text);
    return read.ok
      ? { ok: true, graph: { nodes: [], edges: [], style: 'sequence', sequence: read.diagram } }
      : read;
  }
  // Mermaid's front matter (`---` / `title: …` / `---`) heads the diagram, as `title` does on a graph.
  const front = /^\s*---\r?\n([\s\S]*?)\r?\n---\s*\r?\n/.exec(text);
  const title = front
    ? front[1]!
        .split(/\r?\n/)
        .map((l) => afterWord(l.trim(), 'title', ':'))
        .find((t) => !!t)
        ?.replace(/^["']|["']$/g, '')
    : undefined;
  const parsed = parseMermaid(front ? text.slice(front[0].length) : text);
  if (!parsed.ok) return parsed;
  return {
    ok: true,
    graph: {
      ...(title ? { title: title.slice(0, 120) } : {}),
      nodes: parsed.graph.nodes,
      edges: parsed.graph.edges,
      groups: parsed.graph.clusters,
      direction: parsed.direction === 'LR' ? 'right' : 'down',
    },
  };
}

// A sequence from a graph: its nodes the participants (a node shaped actor a stick figure), its edges the messages in
// order, a dashed edge a reply.
export function sequenceFromGraph(input: GraphInput): SequenceDiagram {
  return {
    participants: input.nodes.map((n) => ({
      id: n.id,
      label: n.label ?? n.id,
      ...(n.shape === 'actor' ? { actor: true } : {}),
      ...(n.icon ? { icon: n.icon } : {}),
    })),
    items: input.edges.map((e) => ({
      kind: 'message' as const,
      from: e.from,
      to: e.to,
      label: e.label ?? '',
      style: e.line === 'dashed' ? ('reply' as const) : ('call' as const),
    })),
  };
}

// A tool's graph-shaped input, from whichever of `graph` / `mermaid` it gave:
// the graph, nothing (the call used elements or a template), or an error that
// names what Mermaid supports.
// What a graph asks that it cannot be drawn as, said rather than dropped: a group listed as another's member (groups
// do not nest, and the member was silently left out), and a node in no lane on a lanes graph (it went to an
// unlabelled lane of its own).
export function graphShapeError(graph: GraphInput): string | undefined {
  const groupIds = new Set((graph.groups ?? []).map((g) => g.id));
  for (const g of graph.groups ?? []) {
    const nested = (g.members ?? []).find((m) => groupIds.has(m));
    if (nested)
      return `group "${g.id}" lists group "${nested}" as a member: groups do not nest; list nodes, one group each`;
  }
  if (graph.style !== 'lanes') return undefined;
  const laned = new Set((withNodeGroups(graph) ?? []).flatMap((g) => g.members));
  const loose = graph.nodes.filter((n) => !laned.has(n.id)).map((n) => `"${n.id}"`);
  return loose.length
    ? `a lanes graph puts every node in a lane: ${loose.slice(0, 5).join(', ')}${loose.length > 5 ? ` and ${loose.length - 5} more` : ''} in no group`
    : undefined;
}

export function resolveGraphInput(args: { graph?: GraphInput; mermaid?: string }): {
  graph?: GraphInput;
  error?: string;
} {
  if (args.graph) {
    // The MCP schema caps these too; this holds for every caller (graph-limits.ts).
    const tooLarge = graphTooLargeError(args.graph.nodes.length, args.graph.edges.length);
    const shape = tooLarge ?? graphShapeError(args.graph);
    return shape ? { error: shape } : { graph: args.graph };
  }
  if (args.mermaid === undefined) return {};
  const parsed = graphFromMermaid(args.mermaid);
  return parsed.ok
    ? { graph: parsed.graph }
    : { error: `Could not read the Mermaid: ${parsed.error}` };
}
