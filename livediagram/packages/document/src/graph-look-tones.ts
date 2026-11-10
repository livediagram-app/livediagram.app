// The graph look's roles and tones (graph-look.ts): which decision exits step aside, and the start, end and decision
// tones a flowchart's nodes draw with. Also the small edge counts the later passes walk the graph with.

import { edgeKey } from './auto-layout';
import type { GraphEdge, GraphNode } from './graph-authoring';
import type { Element } from './index';

export type GraphTone = 'strong' | 'soft' | 'muted' | 'plain';
export type LookNode = GraphNode & { tone?: GraphTone; icon?: string };

// A decision's exit that reads as the way on: it stays on the spine.
export const MAIN_EXIT =
  /^(yes|y|ok|okay|true|pass|passed|success|succeeds|approved|valid|healthy|accept|accepted)\b/i;

// The colour preset each tone draws with; plain draws with none.
export const TONE_PRESET: Readonly<Record<Exclude<GraphTone, 'plain'>, string>> = {
  strong: 'bold',
  soft: 'soft',
  muted: 'outline',
};

export const outEdges = (edges: readonly GraphEdge[], id: string) =>
  edges.filter((e) => e.from === id);
export const inCount = (edges: readonly GraphEdge[], id: string) =>
  edges.reduce((n, e) => n + (e.to === id && e.from !== id ? 1 : 0), 0);

// How far each node leads: the longest run of edges from it to a node with no way on, a cycle cut where it closes.
// One depth-first walk with memory, so linear in the graph.
export function reachOf(edges: readonly GraphEdge[]): (id: string) => number {
  const out = new Map<string, string[]>();
  for (const e of edges) (out.get(e.from) ?? out.set(e.from, []).get(e.from)!).push(e.to);
  const memo = new Map<string, number>();
  const open = new Set<string>();
  const walk = (id: string): number => {
    const known = memo.get(id);
    if (known !== undefined) return known;
    if (open.has(id)) return 0;
    open.add(id);
    let best = 0;
    for (const to of out.get(id) ?? []) best = Math.max(best, 1 + walk(to));
    open.delete(id);
    memo.set(id, best);
    return best;
  };
  return walk;
}

// The edges whose target ranks level with its decision, beside it: for each diamond with two or more exits, one
// exit off the spine whose target nothing else enters. The spine exit is the one labelled like a yes, else the one
// leading furthest; a self-loop or an exit back to where the flow came from is never a side step.
export function sideStepEdges(
  nodes: readonly LookNode[],
  edges: readonly GraphEdge[],
): Set<string> {
  const flat = new Set<string>();
  const reach = reachOf(edges);
  const out = new Map<string, string[]>();
  for (const e of edges) (out.get(e.from) ?? out.set(e.from, []).get(e.from)!).push(e.to);
  // Where the flow starts: the nodes nothing enters, or the first written when every node is on a loop.
  const roots = nodes.filter((n) => inCount(edges, n.id) === 0).map((n) => n.id);
  if (roots.length === 0 && nodes[0]) roots.push(nodes[0].id);
  // The nodes the flow reaches before `decision`, walking from the roots without passing through it: an exit into
  // one goes back to where the flow came from, a loop, never a step aside. Linear in the graph per decision.
  const before = (decision: string) => {
    const seen = new Set(roots.filter((r) => r !== decision));
    const stack = [...seen];
    while (stack.length)
      for (const to of out.get(stack.pop()!) ?? []) {
        if (to === decision || seen.has(to)) continue;
        seen.add(to);
        stack.push(to);
      }
    return seen;
  };
  for (const n of nodes) {
    if (n.shape !== 'diamond') continue;
    const exits = outEdges(edges, n.id).filter((e) => e.to !== n.id);
    if (exits.length < 2) continue;
    const main =
      exits.find((e) => MAIN_EXIT.test((e.label ?? '').trim())) ??
      [...exits].sort((a, b) => reach(b.to) - reach(a.to))[0]!;
    // A retry back to a step before the decision may be entered only once (the start, say), yet it is the way back.
    const candidates = exits.filter((e) => e !== main && inCount(edges, e.to) === 1);
    const earlier = candidates.length ? before(n.id) : null;
    const side = candidates.find((e) => !earlier!.has(e.to));
    if (side) flat.add(edgeKey(side.from, side.to));
  }
  return flat;
}

// Whether the graph is a flowchart: it uses the notation (a decision or a terminator).
export function isFlowchart(nodes: readonly LookNode[]): boolean {
  return nodes.some((n) => n.shape === 'diamond' || n.shape === 'stadium');
}

// Each node's tone and icon onto its box: a node's own tone first; else, in a flowchart, a stadium the flow starts
// from is strong, one it ends on soft, and a decision soft.
export function withTones(
  elements: Element[],
  nodes: readonly LookNode[],
  edges: readonly GraphEdge[],
): Element[] {
  const flowchart = isFlowchart(nodes);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const toneOf = (n: LookNode): GraphTone | undefined => {
    if (n.tone) return n.tone;
    if (!flowchart) return undefined;
    if (n.shape === 'diamond') return 'soft';
    if (n.shape !== 'stadium') return undefined;
    if (inCount(edges, n.id) === 0) return 'strong';
    if (outEdges(edges, n.id).length === 0) return 'soft';
    return undefined;
  };
  return elements.map((el) => {
    if (el.type !== 'shape') return el;
    const n = byId.get(el.id);
    if (!n) return el;
    const tone = toneOf(n);
    const preset = tone && tone !== 'plain' ? TONE_PRESET[tone] : undefined;
    return {
      ...el,
      ...(preset ? { colorPreset: preset } : {}),
      ...(n.icon ? { iconId: n.icon } : {}),
    };
  });
}
