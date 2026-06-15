// Deterministic auto-layout for AI-generated diagrams (spec/25).
//
// The model is good at deciding WHAT nodes and edges a diagram needs but poor
// at geometry: it scatters sizes, mis-anchors arrows, and spaces nodes
// unevenly, so raw generate output looks broken. This pass takes the model's
// graph (nodes + the arrows between them) and re-derives clean geometry:
//
//   1. Uniform per-tier sizing — peers (same shape + text level) get one size.
//   2. A layered (Sugiyama-lite) layout — sources at the top (or left), each
//      successive rank below (or right), nodes evenly spaced + centred.
//   3. Re-anchored straight arrows — face chosen from the final relative
//      positions (down → s→n, right → e→w, ...).
//
// Pure + framework-free so it can be unit-tested and reused (e.g. a future
// "tidy layout" command). Direction is auto-detected from the model's rough
// positioning unless forced. Disconnected pieces are laid out independently
// and arranged side by side.

import {
  isBoxed,
  type Anchor,
  type ArrowElement,
  type BoxedElement,
  type Element,
  type ElementId,
} from './index';

export type LayoutDirection = 'TB' | 'LR';

export type AutoLayoutOptions = {
  // Top-left of the laid-out block in canvas space (defaults to 0,0).
  originX?: number;
  originY?: number;
  // Force a flow direction; omit to auto-detect from the model's positions.
  direction?: LayoutDirection;
};

const LAYER_GAP = 90; // gap between consecutive ranks (main axis)
const SIBLING_GAP = 56; // gap between peers within a rank (cross axis)
const COMPONENT_GAP = 120; // gap between disconnected sub-diagrams

// Shapes whose silhouette assumes a 1:1 aspect ratio — sized as a square.
const SQUARE_SHAPES = new Set(['circle', 'diamond']);

const round10 = (n: number) => Math.round(n / 10) * 10;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

type Size = { w: number; h: number };
type Pt = { x: number; y: number };
type Edge = { from: ElementId; to: ElementId };

// Peers share a tier when they're the same shape at the same text level (or,
// for non-shapes, the same element type). Sizing within a tier is unified.
function tierKey(el: BoxedElement): string {
  if (el.type === 'shape') return `shape:${el.shape}:${el.textSize ?? 'md'}`;
  return `type:${el.type}`;
}

function pushTo<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const arr = map.get(key);
  if (arr) arr.push(value);
  else map.set(key, [value]);
}

// Uniform per-tier sizes so peers match. Uses the tier's max dimension (so
// the longest label still fits), clamped to a sane range; square shapes are
// forced to a 1:1 box.
function normalizeSizes(nodes: BoxedElement[]): Map<ElementId, Size> {
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
function buildEdges(arrows: ArrowElement[], nodeIds: Set<ElementId>): Edge[] {
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
function components(nodeIds: ElementId[], edges: Edge[]): ElementId[][] {
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

// TB when the model's edges trend more vertical than horizontal, else LR.
function detectDirection(centers: Map<ElementId, Pt>, edges: Edge[]): LayoutDirection {
  let vx = 0;
  let vy = 0;
  for (const e of edges) {
    const a = centers.get(e.from)!;
    const b = centers.get(e.to)!;
    vx += Math.abs(b.x - a.x);
    vy += Math.abs(b.y - a.y);
  }
  if (vx === 0 && vy === 0) return 'TB';
  return vy >= vx ? 'TB' : 'LR';
}

// Longest-path layering: sources at rank 0, each node one rank past its
// deepest predecessor. Cycles are broken by ignoring back edges (relax only
// along the topological order; remaining cycle nodes are appended in input
// order so the result is deterministic).
function layerComponent(ids: ElementId[], edges: Edge[]): Map<ElementId, number> {
  const idset = new Set(ids);
  const out = new Map<ElementId, ElementId[]>(ids.map((id) => [id, []]));
  const indeg = new Map<ElementId, number>(ids.map((id) => [id, 0]));
  for (const e of edges) {
    if (!idset.has(e.from) || !idset.has(e.to)) continue;
    out.get(e.from)!.push(e.to);
    indeg.set(e.to, indeg.get(e.to)! + 1);
  }
  const work = new Map(indeg);
  const queue = ids.filter((id) => work.get(id) === 0);
  const topo: ElementId[] = [];
  while (queue.length) {
    const u = queue.shift()!;
    topo.push(u);
    for (const v of out.get(u)!) {
      work.set(v, work.get(v)! - 1);
      if (work.get(v) === 0) queue.push(v);
    }
  }
  if (topo.length < ids.length) {
    const inTopo = new Set(topo);
    for (const id of ids) if (!inTopo.has(id)) topo.push(id);
  }
  const topoIndex = new Map(topo.map((id, i) => [id, i]));
  const layer = new Map<ElementId, number>(ids.map((id) => [id, 0]));
  for (const u of topo) {
    for (const v of out.get(u)!) {
      if (topoIndex.get(u)! < topoIndex.get(v)!) {
        layer.set(v, Math.max(layer.get(v)!, layer.get(u)! + 1));
      }
    }
  }
  return layer;
}

// Place one component into local coords (top-left per node). Ranks stack along
// the main axis; within a rank, nodes lay out along the cross axis and each
// rank is centred against the widest one. Within-rank order follows the
// model's original cross position (cheap crossing reduction that respects its
// spatial intent).
function positionComponent(
  ids: ElementId[],
  layer: Map<ElementId, number>,
  size: Map<ElementId, Size>,
  centers: Map<ElementId, Pt>,
  dir: LayoutDirection,
): { pos: Map<ElementId, Pt>; width: number; height: number } {
  const byLayer = new Map<number, ElementId[]>();
  for (const id of ids) pushTo(byLayer, layer.get(id)!, id);
  const layers = [...byLayer.keys()].sort((a, b) => a - b);

  const crossOf = (id: ElementId) => (dir === 'TB' ? centers.get(id)!.x : centers.get(id)!.y);
  for (const L of layers) byLayer.get(L)!.sort((a, b) => crossOf(a) - crossOf(b));

  const mainSize = (id: ElementId) => (dir === 'TB' ? size.get(id)!.h : size.get(id)!.w);
  const crossSize = (id: ElementId) => (dir === 'TB' ? size.get(id)!.w : size.get(id)!.h);

  const layerMainStart = new Map<number, number>();
  const layerMainSize = new Map<number, number>();
  let mainCursor = 0;
  for (const L of layers) {
    const lm = Math.max(...byLayer.get(L)!.map(mainSize));
    layerMainSize.set(L, lm);
    layerMainStart.set(L, mainCursor);
    mainCursor += lm + LAYER_GAP;
  }

  const crossPosLocal = new Map<ElementId, number>();
  const layerCrossTotal = new Map<number, number>();
  for (const L of layers) {
    let c = 0;
    for (const id of byLayer.get(L)!) {
      crossPosLocal.set(id, c);
      c += crossSize(id) + SIBLING_GAP;
    }
    layerCrossTotal.set(L, Math.max(0, c - SIBLING_GAP));
  }
  const maxCross = Math.max(0, ...layers.map((L) => layerCrossTotal.get(L)!));

  const pos = new Map<ElementId, Pt>();
  for (const L of layers) {
    const offset = (maxCross - layerCrossTotal.get(L)!) / 2;
    const lm = layerMainSize.get(L)!;
    for (const id of byLayer.get(L)!) {
      const mainPos = layerMainStart.get(L)! + (lm - mainSize(id)) / 2;
      const crossPos = offset + crossPosLocal.get(id)!;
      pos.set(id, dir === 'TB' ? { x: crossPos, y: mainPos } : { x: mainPos, y: crossPos });
    }
  }
  const mainExtent = mainCursor - LAYER_GAP;
  return {
    pos,
    width: dir === 'TB' ? maxCross : mainExtent,
    height: dir === 'TB' ? mainExtent : maxCross,
  };
}

// Choose anchor faces + a straight style from the final relative position of
// the two endpoints (the load-bearing visual fix: arrows point the right way).
function reanchorArrow(a: ArrowElement, centers: Map<ElementId, Pt>): ArrowElement {
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

// True when `elements` look like a generated diagram worth re-laying-out: at
// least 3 connected boxed nodes. Small additive edits ("add a step") fall
// below this and keep the model's placement.
export function isLayoutCandidate(elements: Element[]): boolean {
  const nodes = elements.filter(isBoxed);
  if (nodes.length < 3) return false;
  const nodeIds = new Set(nodes.map((n) => n.id));
  const arrows = elements.filter((e): e is ArrowElement => e.type === 'arrow');
  return buildEdges(arrows, nodeIds).length >= 1;
}

// Re-lay-out a self-contained set of elements (the nodes + the arrows between
// them). Non-boxed, non-arrow elements and arrows with free / external
// endpoints pass through with only their position untouched.
export function autoLayoutElements(elements: Element[], opts: AutoLayoutOptions = {}): Element[] {
  const nodes = elements.filter(isBoxed);
  if (nodes.length === 0) return elements;
  const arrows = elements.filter((e): e is ArrowElement => e.type === 'arrow');

  const nodeIds = new Set(nodes.map((n) => n.id));
  const size = normalizeSizes(nodes);
  const edges = buildEdges(arrows, nodeIds);
  const centers = new Map<ElementId, Pt>(
    nodes.map((n) => [n.id, { x: n.x + n.width / 2, y: n.y + n.height / 2 }]),
  );
  const dir = opts.direction ?? detectDirection(centers, edges);

  const comps = components(
    nodes.map((n) => n.id),
    edges,
  );
  // Deterministic order: by each component's leading cross position.
  const compCross = (comp: ElementId[]) =>
    Math.min(...comp.map((id) => (dir === 'TB' ? centers.get(id)!.x : centers.get(id)!.y)));
  comps.sort((a, b) => compCross(a) - compCross(b));

  const localPos = new Map<ElementId, Pt>();
  let crossCursor = 0;
  for (const comp of comps) {
    const layer = layerComponent(comp, edges);
    const { pos, width, height } = positionComponent(comp, layer, size, centers, dir);
    for (const id of comp) {
      const p = pos.get(id)!;
      localPos.set(
        id,
        dir === 'TB' ? { x: p.x + crossCursor, y: p.y } : { x: p.x, y: p.y + crossCursor },
      );
    }
    crossCursor += (dir === 'TB' ? width : height) + COMPONENT_GAP;
  }

  // Translate the whole block to the requested origin.
  const minX = Math.min(...nodes.map((n) => localPos.get(n.id)!.x));
  const minY = Math.min(...nodes.map((n) => localPos.get(n.id)!.y));
  const dx = (opts.originX ?? 0) - minX;
  const dy = (opts.originY ?? 0) - minY;

  const finalCenters = new Map<ElementId, Pt>();
  for (const n of nodes) {
    const p = localPos.get(n.id)!;
    const s = size.get(n.id)!;
    finalCenters.set(n.id, { x: p.x + dx + s.w / 2, y: p.y + dy + s.h / 2 });
  }

  return elements.map((el) => {
    if (isBoxed(el)) {
      const p = localPos.get(el.id);
      const s = size.get(el.id);
      if (!p || !s) return el;
      return { ...el, x: p.x + dx, y: p.y + dy, width: s.w, height: s.h };
    }
    if (el.type === 'arrow') return reanchorArrow(el, finalCenters);
    return el;
  });
}
