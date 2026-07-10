// Cluster-aware graph layout (spec/73): lay out a DiagramGraph whose
// clusters (Mermaid subgraphs) must render as frames drawn around their
// member nodes. The flow layout (auto-layout.ts) knows nothing about
// containment, so this module composes it twice: each cluster's members are
// laid out among themselves, the cluster is contracted to a single node the
// exact size of that block (kept intact via autoLayoutElements'
// fixedSizeIds), the contracted graph is laid out, and the members then
// shift into the placed frame. Import-path module — the editor's own Tidy
// Up never runs this.

import { autoLayoutElements, type LayoutDirection } from './auto-layout';
import { LAYER_GAP, SIBLING_GAP, reanchorArrow, type Pt } from './auto-layout-shared';
import {
  edgeToArrow,
  graphToElements,
  type DiagramGraph,
  type GraphCluster,
} from './graph-authoring';
import { isBoxed, type ArrowElement, type BoxedElement, type Element } from './index';

// Space between a frame's border and its members: the top band is deeper so
// the frame's header label doesn't sit on a member node.
const FRAME_PAD = 32;
const FRAME_TOP = 64;

export type ClusteredLayoutOptions = {
  direction?: LayoutDirection;
  makeEdgeId?: () => string;
};

function bbox(els: BoxedElement[]): { minX: number; minY: number; maxX: number; maxY: number } {
  return {
    minX: Math.min(...els.map((e) => e.x)),
    minY: Math.min(...els.map((e) => e.y)),
    maxX: Math.max(...els.map((e) => e.x + e.width)),
    maxY: Math.max(...els.map((e) => e.y + e.height)),
  };
}

// autoLayoutElements only positions nodes an arrow touches; edgeless nodes
// keep their given position, which for graph imports means piled at the
// origin (everything starts at 0,0). Sweep them into rows below the placed
// content instead. Lives here (the import path) on purpose: for the MCP's
// element authoring, leaving edgeless content alone is load-bearing
// (spec/62 §4.3) — for a parsed graph there is no hand-placed content.
// `exempt` ids are deliberately-placed nodes the sweep must leave alone but
// still avoid (frames and their members in the clustered pass).
export function sweepEdgelessNodes(elements: Element[], exempt?: Set<string>): Element[] {
  const touched = new Set<string>();
  for (const el of elements) {
    if (el.type !== 'arrow') continue;
    if (el.from.kind === 'pinned') touched.add(el.from.elementId);
    if (el.to.kind === 'pinned') touched.add(el.to.elementId);
  }
  const anchored = (id: string) => touched.has(id) || (exempt?.has(id) ?? false);
  const loose = elements.filter((el): el is BoxedElement => isBoxed(el) && !anchored(el.id));
  if (loose.length === 0) return elements;
  const placed = elements.filter((el): el is BoxedElement => isBoxed(el) && anchored(el.id));

  // Row-wrap the loose nodes below the placed block (or from the origin when
  // everything is loose), capping rows at the block's width so the sweep
  // doesn't sprawl into a single endless line.
  const start = placed.length
    ? { x: bbox(placed).minX, y: bbox(placed).maxY + LAYER_GAP }
    : { x: 0, y: 0 };
  const rowCap = Math.max(placed.length ? bbox(placed).maxX - bbox(placed).minX : 0, 600);
  const pos = new Map<string, Pt>();
  let x = 0;
  let y = start.y;
  let rowH = 0;
  for (const el of loose) {
    if (x > 0 && x + el.width > rowCap) {
      x = 0;
      y += rowH + SIBLING_GAP;
      rowH = 0;
    }
    pos.set(el.id, { x: start.x + x, y });
    x += el.width + SIBLING_GAP;
    rowH = Math.max(rowH, el.height);
  }
  return elements.map((el) => {
    const p = pos.get(el.id);
    return p && isBoxed(el) ? { ...el, x: p.x, y: p.y } : el;
  });
}

// Keep only real, non-colliding clusters: members must name known nodes, a
// node belongs to its first cluster, and a cluster whose id collides with a
// node id is dropped (its frame could not be referenced unambiguously).
function sanitizeClusters(graph: DiagramGraph): GraphCluster[] {
  const nodeIds = new Set(graph.nodes.map((n) => n.id));
  const claimed = new Set<string>();
  const out: GraphCluster[] = [];
  for (const c of graph.clusters ?? []) {
    if (nodeIds.has(c.id)) continue;
    const members = c.members.filter((m) => nodeIds.has(m) && !claimed.has(m));
    if (members.length === 0) continue;
    for (const m of members) claimed.add(m);
    out.push({ ...c, members });
  }
  return out;
}

// Lay out `graph` into placed elements, drawing a frame around each cluster.
// Without clusters this is exactly graphToElements + autoLayoutElements
// (plus the edgeless sweep) — the plain path every flowchart without
// subgraphs takes.
export function layoutClusteredGraph(
  graph: DiagramGraph,
  opts: ClusteredLayoutOptions = {},
): Element[] {
  const makeEdgeId = opts.makeEdgeId ?? (() => crypto.randomUUID());
  const direction = opts.direction;
  const clusters = sanitizeClusters(graph);

  if (clusters.length === 0) {
    return sweepEdgelessNodes(
      autoLayoutElements(graphToElements(graph, makeEdgeId), { direction }),
    );
  }

  const clusterOf = new Map<string, string>();
  for (const c of clusters) for (const m of c.members) clusterOf.set(m, c.id);

  // 1. Lay out each cluster's members among themselves (intra edges only).
  const memberEls = new Map<string, BoxedElement[]>();
  for (const c of clusters) {
    const memberSet = new Set(c.members);
    const induced: DiagramGraph = {
      nodes: graph.nodes.filter((n) => memberSet.has(n.id)),
      edges: graph.edges.filter((e) => memberSet.has(e.from) && memberSet.has(e.to)),
    };
    const laid = sweepEdgelessNodes(
      autoLayoutElements(
        graphToElements(induced, () => `tmp-${makeEdgeId()}`),
        { direction },
      ),
    );
    memberEls.set(c.id, laid.filter(isBoxed));
  }

  // 2. Contract: one frame element per cluster, sized to its members' block,
  // plus the free nodes, joined by the edges projected through the clusters.
  const frames: BoxedElement[] = clusters.map((c) => {
    const b = bbox(memberEls.get(c.id)!);
    return {
      id: c.id,
      type: 'shape' as const,
      shape: 'frame' as const,
      x: 0,
      y: 0,
      width: b.maxX - b.minX + 2 * FRAME_PAD,
      height: b.maxY - b.minY + FRAME_TOP + FRAME_PAD,
      label: c.label ?? c.id,
    };
  });
  const freeNodes = graphToElements(
    { nodes: graph.nodes.filter((n) => !clusterOf.has(n.id)), edges: [] },
    makeEdgeId,
  ).filter(isBoxed);

  const frameIds = new Set(frames.map((f) => f.id));
  const project = (id: string) => clusterOf.get(id) ?? id;
  const contractedArrows: Element[] = [];
  graph.edges.forEach((e, i) => {
    const from = project(e.from);
    const to = project(e.to);
    if (from === to) return;
    contractedArrows.push(edgeToArrow({ from, to }, `contracted-${i}`));
  });

  const contracted = autoLayoutElements([...frames, ...freeNodes, ...contractedArrows], {
    direction,
    fixedSizeIds: frameIds,
  });
  const placedById = new Map(contracted.filter(isBoxed).map((el) => [el.id, el]));

  // 3. Expand: shift each cluster's members into its placed frame.
  const placedNodes: BoxedElement[] = freeNodes.map((n) => placedById.get(n.id) ?? n);
  const placedFrames: BoxedElement[] = [];
  for (const c of clusters) {
    const frame = placedById.get(c.id)!;
    placedFrames.push(frame);
    const members = memberEls.get(c.id)!;
    const b = bbox(members);
    const dx = frame.x + FRAME_PAD - b.minX;
    const dy = frame.y + FRAME_TOP - b.minY;
    for (const m of members) placedNodes.push({ ...m, x: m.x + dx, y: m.y + dy });
  }

  // 4. Real arrows over the final geometry: every edge whose endpoints name
  // a node or a frame, re-anchored to the sides that face. Self-loops are
  // kept (the clusterless graphToElements path keeps them, and dropping
  // them here made a diagram lose its self-edges the moment it gained a
  // subgraph); reanchorArrow degrades to the same s -> n anchors the plain
  // path uses when both centers coincide.
  const known = new Set([...placedNodes.map((n) => n.id), ...frameIds]);
  const centers = new Map<string, Pt>(
    [...placedNodes, ...placedFrames].map((el) => [
      el.id,
      { x: el.x + el.width / 2, y: el.y + el.height / 2 },
    ]),
  );
  const arrows: ArrowElement[] = graph.edges
    .filter((e) => known.has(e.from) && known.has(e.to))
    .map((e) => reanchorArrow(edgeToArrow(e, makeEdgeId()), centers));

  // Frames first so they render behind their members. The final sweep only
  // catches free nodes with no edges at all — frames and cluster members
  // are deliberately placed, so they're exempt.
  const deliberate = new Set([...frameIds, ...clusterOf.keys()]);
  return sweepEdgelessNodes([...placedFrames, ...placedNodes, ...arrows], deliberate);
}
