// Deterministic auto-layout for AI-generated diagrams (spec/25) and the
// editor's Auto Layout / "Tidy up" (spec/47).
//
// The model is good at deciding WHAT nodes and edges a diagram needs but poor
// at geometry: it scatters sizes, mis-anchors arrows, and spaces nodes
// unevenly, so raw generate output looks broken. This pass takes the model's
// graph (nodes + the arrows between them) and re-derives clean geometry:
//
//   1. Uniform per-tier sizing — peers (same shape + text level) get one size.
//   2. Per-component positioning in the requested STYLE (spec/47 "Layout
//      styles"): the default layered (Sugiyama-lite) flow — sources at the
//      top (or left), each successive rank below (or right) — or the tidy
//      tree (auto-layout-tree.ts) or radial mindmap (auto-layout-mindmap.ts).
//   3. Re-anchored straight arrows — face chosen from the final relative
//      positions (down → s→n, right → e→w, ...).
//
// Pure + framework-free so it can be unit-tested and reused. Flow direction
// is auto-detected from the model's rough positioning unless forced.
// Disconnected pieces are laid out independently and arranged side by side.

import { isBoxed, type ArrowElement, type Element, type ElementId } from './index';
import {
  COMPONENT_GAP,
  LAYER_GAP,
  SIBLING_GAP,
  buildEdges,
  components,
  normalizeSizes,
  pushTo,
  reanchorArrow,
  type Edge,
  type PlacedComponent,
  type Pt,
  type Size,
} from './auto-layout-shared';
import { positionTreeComponent } from './auto-layout-tree';
import { positionMindmapComponent } from './auto-layout-mindmap';

export type LayoutDirection = 'TB' | 'LR';

// How each connected component's nodes are positioned (spec/47 "Layout
// styles"). 'flow' is the layered layout every existing caller gets.
export type LayoutStyle = 'flow' | 'tree' | 'mindmap';

export type AutoLayoutOptions = {
  // Top-left of the laid-out block in canvas space (defaults to 0,0).
  originX?: number;
  originY?: number;
  // Force a flow direction; omit to auto-detect from the model's positions.
  // Only meaningful for the 'flow' style (tree is always TB, mindmap radial).
  direction?: LayoutDirection;
  // Positioning style; omit for the layered flow (the long-standing default).
  style?: LayoutStyle;
};

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
): PlacedComponent {
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

// True when the boxed elements carry no meaningful arrangement — piled at
// roughly one point (e.g. everything left at 0,0) — i.e. the model left
// placement to us. Lets a caller PRESERVE a real layout the model produced (a
// ring for a cycle, a tree, a grid) and only auto-lay-out when it didn't bother
// to place things (spec/62 §4.3: the calling LLM decides the layout).
export function nodesLookUnplaced(elements: Element[]): boolean {
  const boxed = elements.filter(isBoxed);
  if (boxed.length < 2) return true; // nothing meaningful to preserve
  const xs = boxed.map((n) => n.x);
  const ys = boxed.map((n) => n.y);
  const spreadX = Math.max(...xs) - Math.min(...xs);
  const spreadY = Math.max(...ys) - Math.min(...ys);
  const avgW = boxed.reduce((s, n) => s + n.width, 0) / boxed.length;
  const avgH = boxed.reduce((s, n) => s + n.height, 0) / boxed.length;
  // Unplaced if the whole set sits within roughly a single node's footprint.
  return spreadX < avgW && spreadY < avgH;
}

// Re-lay-out a self-contained set of elements (the nodes + the arrows between
// them). Non-boxed, non-arrow elements, edgeless boxed content, and arrows with
// free / external endpoints pass through with only their position untouched.
export function autoLayoutElements(elements: Element[], opts: AutoLayoutOptions = {}): Element[] {
  const allBoxed = elements.filter(isBoxed);
  const arrows = elements.filter((e): e is ArrowElement => e.type === 'arrow');

  // Only boxed elements an arrow touches are graph nodes. Edgeless boxed
  // content — titles, captions, per-stage descriptions, legends, loose notes —
  // is NOT a node: it passes through at the position it was given rather than
  // being raked into a disconnected-component column beside the graph (which
  // detached and scrambled the frog-lifecycle descriptions, spec/62 §4.3).
  const connected = new Set<ElementId>();
  for (const e of buildEdges(arrows, new Set(allBoxed.map((n) => n.id)))) {
    connected.add(e.from);
    connected.add(e.to);
  }
  const nodes = allBoxed.filter((n) => connected.has(n.id));
  if (nodes.length === 0) return elements;

  const style = opts.style ?? 'flow';
  const nodeIds = new Set(nodes.map((n) => n.id));
  const size = normalizeSizes(nodes);
  const edges = buildEdges(arrows, nodeIds);
  const centers = new Map<ElementId, Pt>(
    nodes.map((n) => [n.id, { x: n.x + n.width / 2, y: n.y + n.height / 2 }]),
  );
  // Tree and mindmap have no flow axis; components stack horizontally, the
  // same as a TB flow.
  const dir = style === 'flow' ? (opts.direction ?? detectDirection(centers, edges)) : 'TB';

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
    let placed: PlacedComponent;
    if (style === 'tree') {
      placed = positionTreeComponent(comp, edges, size, centers);
    } else if (style === 'mindmap') {
      placed = positionMindmapComponent(comp, edges, size, centers);
    } else {
      placed = positionComponent(comp, layerComponent(comp, edges), size, centers, dir);
    }
    for (const id of comp) {
      const p = placed.pos.get(id)!;
      localPos.set(
        id,
        dir === 'TB' ? { x: p.x + crossCursor, y: p.y } : { x: p.x, y: p.y + crossCursor },
      );
    }
    crossCursor += (dir === 'TB' ? placed.width : placed.height) + COMPONENT_GAP;
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
