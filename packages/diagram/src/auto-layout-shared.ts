// Graph plumbing shared by the auto-layout styles (spec/47): the layered
// flow layout (auto-layout.ts), the tidy tree (auto-layout-tree.ts) and the
// radial mindmap (auto-layout-mindmap.ts) all consume the same node sizing,
// edge extraction, component split, and arrow re-anchoring. Internal module,
// not re-exported from the package index.

import { type Anchor, type ArrowElement, type BoxedElement, type ElementId } from './index';

export const LAYER_GAP = 90; // gap between consecutive ranks (main axis)
export const SIBLING_GAP = 56; // gap between peers within a rank (cross axis)
export const COMPONENT_GAP = 120; // gap between disconnected sub-diagrams

// Shapes whose silhouette assumes a 1:1 aspect ratio — sized as a square.
const SQUARE_SHAPES = new Set(['circle', 'diamond']);

const round10 = (n: number) => Math.round(n / 10) * 10;
export const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export type Size = { w: number; h: number };
export type Pt = { x: number; y: number };
export type Edge = { from: ElementId; to: ElementId };

// A positioned component in local coords (top-left per node, block starting
// at 0,0) plus its bounding box, ready for the orchestrator to stack.
export type PlacedComponent = {
  pos: Map<ElementId, Pt>;
  width: number;
  height: number;
};

// Peers share a tier when they're the same shape at the same text level (or,
// for non-shapes, the same element type). Sizing within a tier is unified.
function tierKey(el: BoxedElement): string {
  if (el.type === 'shape') return `shape:${el.shape}:${el.textSize ?? 'md'}`;
  return `type:${el.type}`;
}

export function pushTo<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const arr = map.get(key);
  if (arr) arr.push(value);
  else map.set(key, [value]);
}

// Uniform per-tier sizes so peers match. Uses the tier's max dimension (so
// the longest label still fits), clamped to a sane range; square shapes are
// forced to a 1:1 box.
export function normalizeSizes(nodes: BoxedElement[]): Map<ElementId, Size> {
  const groups = new Map<string, BoxedElement[]>();
  for (const n of nodes) pushTo(groups, tierKey(n), n);
  const out = new Map<ElementId, Size>();
  for (const group of groups.values()) {
    const w = clamp(round10(Math.max(...group.map((g) => g.width))), 80, 360);
    const h = clamp(round10(Math.max(...group.map((g) => g.height))), 40, 220);
    for (const n of group) {
      if (n.type === 'shape' && SQUARE_SHAPES.has(n.shape)) {
        const s = Math.max(w, h);
        out.set(n.id, { w: s, h: s });
      } else {
        out.set(n.id, { w, h });
      }
    }
  }
  return out;
}

// Directed edges between two nodes in the set (dedup, no self-loops). Only
// pinned→pinned arrows define graph structure; free endpoints are layout-
// irrelevant.
export function buildEdges(arrows: ArrowElement[], nodeIds: Set<ElementId>): Edge[] {
  const seen = new Set<string>();
  const edges: Edge[] = [];
  for (const a of arrows) {
    if (a.from.kind !== 'pinned' || a.to.kind !== 'pinned') continue;
    const f = a.from.elementId;
    const t = a.to.elementId;
    if (f === t || !nodeIds.has(f) || !nodeIds.has(t)) continue;
    const key = `${f}->${t}`;
    if (seen.has(key)) continue;
    seen.add(key);
    edges.push({ from: f, to: t });
  }
  return edges;
}

// Connected components over the UNDIRECTED edge set (union-find).
export function components(nodeIds: ElementId[], edges: Edge[]): ElementId[][] {
  const parent = new Map<ElementId, ElementId>(nodeIds.map((id) => [id, id]));
  const find = (x: ElementId): ElementId => {
    let r = x;
    while (parent.get(r) !== r) r = parent.get(r)!;
    let c = x;
    while (parent.get(c) !== r) {
      const next = parent.get(c)!;
      parent.set(c, r);
      c = next;
    }
    return r;
  };
  for (const e of edges) {
    const ra = find(e.from);
    const rb = find(e.to);
    if (ra !== rb) parent.set(ra, rb);
  }
  const groups = new Map<ElementId, ElementId[]>();
  for (const id of nodeIds) pushTo(groups, find(id), id);
  return [...groups.values()];
}

// Deterministic spanning forest over a component: BFS from the given roots
// (in order) across the UNDIRECTED adjacency, children kept in edge input
// order. Tree + mindmap both hang their geometry off this: extra in-edges
// and cycles simply aren't part of the skeleton; their arrows re-anchor
// across it afterwards, so a non-tree graph degrades gracefully instead of
// erroring.
export function spanningForest(
  ids: ElementId[],
  edges: Edge[],
  roots: ElementId[],
): Map<ElementId, ElementId[]> {
  const idset = new Set(ids);
  const adj = new Map<ElementId, ElementId[]>(ids.map((id) => [id, []]));
  for (const e of edges) {
    if (!idset.has(e.from) || !idset.has(e.to)) continue;
    adj.get(e.from)!.push(e.to);
    adj.get(e.to)!.push(e.from);
  }
  const children = new Map<ElementId, ElementId[]>(ids.map((id) => [id, []]));
  const visited = new Set<ElementId>(roots);
  const queue = [...roots];
  while (queue.length) {
    const u = queue.shift()!;
    for (const v of adj.get(u)!) {
      if (visited.has(v)) continue;
      visited.add(v);
      children.get(u)!.push(v);
      queue.push(v);
    }
  }
  // A component is connected, so everything is reachable from any root; the
  // guard below only matters if a caller passes a partial root set.
  for (const id of ids) {
    if (!visited.has(id)) {
      visited.add(id);
      children.get(roots[0]!)!.push(id);
    }
  }
  return children;
}

// Choose anchor faces + a straight style from the final relative position of
// the two endpoints (the load-bearing visual fix: arrows point the right way).
export function reanchorArrow(a: ArrowElement, centers: Map<ElementId, Pt>): ArrowElement {
  if (a.from.kind !== 'pinned' || a.to.kind !== 'pinned') return a;
  const s = centers.get(a.from.elementId);
  const t = centers.get(a.to.elementId);
  if (!s || !t) return a;
  const dx = t.x - s.x;
  const dy = t.y - s.y;
  let fromA: Anchor;
  let toA: Anchor;
  if (Math.abs(dy) >= Math.abs(dx)) {
    [fromA, toA] = dy >= 0 ? ['s', 'n'] : ['n', 's'];
  } else {
    [fromA, toA] = dx >= 0 ? ['e', 'w'] : ['w', 'e'];
  }
  return {
    ...a,
    from: { kind: 'pinned', elementId: a.from.elementId, anchor: fromA },
    to: { kind: 'pinned', elementId: a.to.elementId, anchor: toA },
    arrowStyle: 'straight',
  };
}
