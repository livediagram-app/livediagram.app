// Deterministic auto-layout for agent-built diagrams (a graph an MCP or CLI caller hands over) and the
// editor's Auto Layout / "Tidy up" (docs/specs/008-canvas/layout-cleanup.md).
//
// The model is good at deciding WHAT nodes and edges a diagram needs but poor
// at geometry: it scatters sizes, mis-anchors arrows, and spaces nodes
// unevenly, so raw generate output looks broken. This pass takes the model's
// graph (nodes + the arrows between them) and re-derives clean geometry:
//
//   1. Uniform per-tier sizing — peers (same shape + text level) get one size.
//   2. Per-component positioning in the requested STYLE (docs/specs/008-canvas/layout-cleanup.md "Layout
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
import { LABEL_PAD as LABEL_GAP_PAD, labelRoom } from './auto-layout-tidy-flow';
import { reduceCrossings } from './auto-layout-crossings';
import { LANE_WIDTH, splitLongEdges } from './auto-layout-long-edges';
import { placeCrossAxis } from './auto-layout-placement';
import { positionMindmapComponent } from './auto-layout-mindmap';

export type LayoutDirection = 'TB' | 'LR';

// How each connected component's nodes are positioned (docs/specs/008-canvas/layout-cleanup.md "Layout
// styles"). 'flow' is the layered layout every existing caller gets.
export type LayoutStyle = 'flow' | 'tree' | 'mindmap';

export type AutoLayoutOptions = {
  // Top-left of the laid-out block in canvas space (defaults to 0,0).
  originX?: number;
  originY?: number;
  // Force a direction; omit to auto-detect from the model's positions (flow) or run down (tree).
  // Meaningful for 'flow' and 'tree'; a mindmap is radial (docs/specs/015-api/mcp-server.md §4.7 "Layout choices").
  direction?: LayoutDirection;
  // Positioning style; omit for the layered flow (the long-standing default).
  style?: LayoutStyle;
  // Nodes whose given width/height must survive layout untouched, exempt
  // from peer-size normalisation (the edit operations' layout keeps each box
  // the size it was given; normalizeSizes would clamp it to the shape tier's size).
  fixedSizeIds?: Set<ElementId>;
  // Elements that keep their place and size (docs/specs/008-canvas/layout-cleanup.md "Locked elements
  // stay put"): the editor passes its locked elements and everything on a locked layer. A locked
  // box is not a graph node, so arrows to it are not edges, and a locked arrow keeps its anchors.
  lockedIds?: ReadonlySet<ElementId>;
  // Edges (`from->to`) whose target ranks level with its source and sits just after it across the flow: a
  // decision's side step (docs/specs/015-api/mcp-server.md §4.7 "Side steps sit level with their decision").
  // Graph input only; Tidy Up never passes it.
  flatEdges?: ReadonlySet<string>;
  // Tree style: parents whose leaf children stack in a column under them (auto-layout-tree.ts). Graph input only;
  // a tree run left to right stacks none (its families are already columns).
  stackedParents?: ReadonlySet<ElementId>;
};

export const edgeKey = (from: ElementId, to: ElementId) => `${from}->${to}`;

// The axis swap a tree run left to right is laid out through (docs/specs/015-api/mcp-server.md §4.7).
function transposedSizes(size: Map<ElementId, Size>): Map<ElementId, Size> {
  const out = new Map<ElementId, Size>();
  for (const [id, s] of size) out.set(id, { w: s.h, h: s.w });
  return out;
}
function transposedPoints(points: Map<ElementId, Pt>): Map<ElementId, Pt> {
  const out = new Map<ElementId, Pt>();
  for (const [id, p] of points) out.set(id, { x: p.y, y: p.x });
  return out;
}
function transposedPlacement(placed: PlacedComponent): PlacedComponent {
  return { pos: transposedPoints(placed.pos), width: placed.height, height: placed.width };
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

// The flow direction `autoLayoutElements` detects for these elements when none is given.
export function flowDirectionOf(elements: readonly Element[]): LayoutDirection {
  const boxed = elements.filter(isBoxed);
  const arrows = elements.filter((e): e is ArrowElement => e.type === 'arrow');
  const centers = new Map<ElementId, Pt>(
    boxed.map((n) => [n.id, { x: n.x + n.width / 2, y: n.y + n.height / 2 }]),
  );
  return detectDirection(centers, buildEdges(arrows, new Set(centers.keys())));
}

// Longest-path layering: sources at rank 0, each node one rank past its
// deepest predecessor. Cycles are broken by ignoring back edges (relax only
// along the topological order; remaining cycle nodes are appended in input
// order so the result is deterministic).
export function layerComponent(
  ids: ElementId[],
  edges: Edge[],
  flat?: ReadonlySet<string>,
): Map<ElementId, number> {
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
  const inTopo = new Set<ElementId>();
  while (topo.length < ids.length) {
    // A cycle stalls the order: it goes on from a loop's entry, the waiting node some placed node already feeds,
    // with the fewest predecessors still to come (its one unmet edge the loop back), earliest in input order on a
    // tie. Appended wholesale in input order, a group laid out before the nodes that feed it took rank 0, and its
    // line ran back up the page.
    if (queue.length === 0) {
      const rank = (id: ElementId) =>
        [work.get(id)! < indeg.get(id)! ? 0 : 1, work.get(id)!] as const;
      let pick: ElementId | null = null;
      for (const id of ids) {
        if (inTopo.has(id)) continue;
        if (pick === null) {
          pick = id;
          continue;
        }
        const [a, b] = [rank(id), rank(pick)];
        if (a[0] < b[0] || (a[0] === b[0] && a[1] < b[1])) pick = id;
      }
      queue.push(pick!);
    }
    const u = queue.shift()!;
    if (inTopo.has(u)) continue;
    topo.push(u);
    inTopo.add(u);
    for (const v of out.get(u)!) {
      work.set(v, work.get(v)! - 1);
      if (work.get(v) === 0 && !inTopo.has(v)) queue.push(v);
    }
  }
  const topoIndex = new Map(topo.map((id, i) => [id, i]));
  const layer = new Map<ElementId, number>(ids.map((id) => [id, 0]));
  for (const u of topo) {
    for (const v of out.get(u)!) {
      if (topoIndex.get(u)! < topoIndex.get(v)!) {
        const step = flat?.has(edgeKey(u, v)) ? 0 : 1;
        layer.set(v, Math.max(layer.get(v)!, layer.get(u)! + step));
      }
    }
  }
  return layer;
}

// Place one component into local coords (top-left per node). Ranks stack along
// the main axis; within a rank, nodes lay out along the cross axis. Long edges
// are split into lane nodes first (auto-layout-long-edges.ts) so they reserve
// a path. Within-rank order starts from the model's original cross position
// (respecting its spatial intent) and is then refined to cross fewer edges
// (auto-layout-crossings.ts); each node then settles by its neighbours
// (auto-layout-placement.ts) instead of wherever its rank's width puts it.
function positionComponent(
  realIds: ElementId[],
  realLayer: Map<ElementId, number>,
  size: Map<ElementId, Size>,
  centers: Map<ElementId, Pt>,
  dir: LayoutDirection,
  realEdges: Edge[],
  flat?: ReadonlySet<string>,
  labelOf: (e: Edge) => string | undefined = () => undefined,
): PlacedComponent {
  const { ids, edges, layer, lanes } = splitLongEdges(realIds, realEdges, realLayer);
  const byLayer = new Map<number, ElementId[]>();
  for (const id of ids) pushTo(byLayer, layer.get(id)!, id);
  const layers = [...byLayer.keys()].sort((a, b) => a - b);

  // A lane starts where its edge's source is, so the first order keeps it
  // beside the nodes it runs between.
  const laneSource = new Map<ElementId, ElementId>();
  for (const e of edges)
    if (lanes.has(e.to)) laneSource.set(e.to, laneSource.get(e.from) ?? e.from);
  const crossOf = (id: ElementId): number => {
    const c = centers.get(laneSource.get(id) ?? id)!;
    return dir === 'TB' ? c.x : c.y;
  };
  for (const L of layers) byLayer.get(L)!.sort((a, b) => crossOf(a) - crossOf(b));
  const refined = reduceCrossings(
    layers.map((L) => byLayer.get(L)!),
    edges,
    layer,
  );
  layers.forEach((L, i) => byLayer.set(L, refined[i]!));
  // A side step sits just after the node that sends it out, on the same rank.
  if (flat?.size) {
    for (const e of edges) {
      if (!flat.has(edgeKey(e.from, e.to)) || layer.get(e.from) !== layer.get(e.to)) continue;
      const rank = byLayer.get(layer.get(e.from)!)!;
      rank.splice(rank.indexOf(e.to), 1);
      rank.splice(rank.indexOf(e.from) + 1, 0, e.to);
    }
  }

  const mainSize = (id: ElementId) =>
    lanes.has(id) ? 0 : dir === 'TB' ? size.get(id)!.h : size.get(id)!.w;
  const crossSize = (id: ElementId) =>
    lanes.has(id) ? LANE_WIDTH : dir === 'TB' ? size.get(id)!.w : size.get(id)!.h;

  // The gap after each rank fits the labels of the edges crossing it, as Tidy Up's does (auto-layout-tidy-flow.ts):
  // left to right, a label's width; top to bottom, its line height either side of the jog there. A label longer
  // than the gap otherwise sat on the box it pointed at. Top to bottom one line (64 px) fits LAYER_GAP (90) today,
  // so only a left-to-right layout widens; the rule is kept so a narrower gap stays safe.
  const gapAfter = new Map<number, number>();
  for (const e of realEdges) {
    const room = labelRoom(labelOf(e));
    const [a, b] = [realLayer.get(e.from), realLayer.get(e.to)];
    if (!room.w || a === undefined || b === undefined || a === b) continue;
    const need = dir === 'LR' ? room.w : room.h * 2 + LABEL_GAP_PAD;
    for (let L = Math.min(a, b); L < Math.max(a, b); L++)
      gapAfter.set(L, Math.max(gapAfter.get(L) ?? LAYER_GAP, need));
  }
  const layerMainStart = new Map<number, number>();
  const layerMainSize = new Map<number, number>();
  let mainCursor = 0;
  for (const L of layers) {
    const lm = Math.max(...byLayer.get(L)!.map(mainSize));
    layerMainSize.set(L, lm);
    layerMainStart.set(L, mainCursor);
    mainCursor += lm + (gapAfter.get(L) ?? LAYER_GAP);
  }

  // Start packed and centred against the widest rank, then let each node
  // settle by its neighbours.
  const layerCrossTotal = new Map<number, number>();
  for (const L of layers) {
    const rank = byLayer.get(L)!;
    const total =
      rank.reduce((sum, id) => sum + crossSize(id), 0) + SIBLING_GAP * (rank.length - 1);
    layerCrossTotal.set(L, total);
  }
  const widest = Math.max(0, ...layerCrossTotal.values());
  const start = new Map<ElementId, number>();
  for (const L of layers) {
    let c = (widest - layerCrossTotal.get(L)!) / 2;
    for (const id of byLayer.get(L)!) {
      start.set(id, c + crossSize(id) / 2);
      c += crossSize(id) + SIBLING_GAP;
    }
  }
  const centre = placeCrossAxis(
    layers.map((L) => byLayer.get(L)!),
    edges,
    crossSize,
    SIBLING_GAP,
    lanes,
    start,
  );
  let minCross = Infinity;
  let maxCross = -Infinity;
  for (const id of realIds) {
    minCross = Math.min(minCross, centre.get(id)! - crossSize(id) / 2);
    maxCross = Math.max(maxCross, centre.get(id)! + crossSize(id) / 2);
  }

  const pos = new Map<ElementId, Pt>();
  for (const L of layers) {
    const lm = layerMainSize.get(L)!;
    for (const id of byLayer.get(L)!) {
      if (lanes.has(id)) continue;
      const mainPos = layerMainStart.get(L)! + (lm - mainSize(id)) / 2;
      const crossPos = centre.get(id)! - crossSize(id) / 2 - minCross;
      pos.set(id, dir === 'TB' ? { x: crossPos, y: mainPos } : { x: mainPos, y: crossPos });
    }
  }
  const mainExtent = mainCursor - LAYER_GAP;
  const crossExtent = maxCross - minCross;
  return {
    pos,
    width: dir === 'TB' ? crossExtent : mainExtent,
    height: dir === 'TB' ? mainExtent : crossExtent,
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
// to place things (docs/specs/015-api/mcp-server.md §4.3: the calling LLM decides the layout).
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
  const locked = opts.lockedIds;
  const allBoxed = elements.filter(isBoxed).filter((n) => !locked?.has(n.id));
  const arrows = elements.filter((e): e is ArrowElement => e.type === 'arrow');

  // Only boxed elements an arrow touches are graph nodes. Edgeless boxed
  // content — titles, captions, per-stage descriptions, legends, loose notes —
  // is NOT a node: it passes through at the position it was given rather than
  // being raked into a disconnected-component column beside the graph (which
  // detached and scrambled the frog-lifecycle descriptions, docs/specs/015-api/mcp-server.md §4.3).
  const connected = new Set<ElementId>();
  for (const e of buildEdges(arrows, new Set(allBoxed.map((n) => n.id)))) {
    connected.add(e.from);
    connected.add(e.to);
  }
  const nodes = allBoxed.filter((n) => connected.has(n.id));
  if (nodes.length === 0) return elements;

  const style = opts.style ?? 'flow';
  const nodeIds = new Set(nodes.map((n) => n.id));
  const fixed = opts.fixedSizeIds;
  const size = normalizeSizes(fixed ? nodes.filter((n) => !fixed.has(n.id)) : nodes);
  if (fixed) {
    for (const n of nodes) {
      if (fixed.has(n.id)) size.set(n.id, { w: n.width, h: n.height });
    }
  }
  const edges = buildEdges(arrows, nodeIds);
  // Each edge's label, for the gap it crosses to fit.
  const labels = new Map<string, string>();
  for (const a of arrows)
    if (a.label?.trim() && a.from.kind === 'pinned' && a.to.kind === 'pinned')
      labels.set(`${a.from.elementId}->${a.to.elementId}`, a.label);
  const centers = new Map<ElementId, Pt>(
    nodes.map((n) => [n.id, { x: n.x + n.width / 2, y: n.y + n.height / 2 }]),
  );
  // A flow detects its axis; a tree runs down unless asked across; a mindmap has none, and its components stack
  // horizontally, the same as a TB flow.
  const dir =
    style === 'flow'
      ? (opts.direction ?? detectDirection(centers, edges))
      : style === 'tree'
        ? (opts.direction ?? 'TB')
        : 'TB';
  // A tree across the page is the tree down it with the axes swapped: laid out on transposed boxes, then turned
  // back (transposed once here, not per component).
  const across = style === 'tree' && dir === 'LR';
  const treeSize = across ? transposedSizes(size) : size;
  const treeCenters = across ? transposedPoints(centers) : centers;

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
      placed = across
        ? transposedPlacement(positionTreeComponent(comp, edges, treeSize, treeCenters))
        : positionTreeComponent(comp, edges, size, centers, opts.stackedParents);
    } else if (style === 'mindmap') {
      placed = positionMindmapComponent(comp, edges, size, centers);
    } else {
      placed = positionComponent(
        comp,
        layerComponent(comp, edges, opts.flatEdges),
        size,
        centers,
        dir,
        edges,
        opts.flatEdges,
        (e) => labels.get(`${e.from}->${e.to}`),
      );
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
    // Mindmap spokes run every way, so only flow and tree have an axis.
    if (el.type === 'arrow' && !locked?.has(el.id))
      return reanchorArrow(el, finalCenters, style === 'mindmap' ? undefined : dir);
    return el;
  });
}
