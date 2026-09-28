// Cluster-aware graph layout (docs/specs/020-import-export/mermaid.md): lay out a DiagramGraph whose
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
import { unionRects, type Rect } from './geometry-primitives';
import { isBoxed, type ArrowElement, type BoxedElement, type Element } from './index';

// Space between a frame's border and its members: the top band is deeper so
// the frame's header label doesn't sit on a member node.
const FRAME_PAD = 32;
const FRAME_TOP = 64;

export type ClusteredLayoutOptions = {
  direction?: LayoutDirection;
  makeEdgeId?: () => string;
};

// Every caller passes a non-empty block (placed nodes, or a cluster's
// members, which sanitizeClusters guarantees), so the union is never null.
const bbox = (els: BoxedElement[]): Rect => unionRects(els)!;

// autoLayoutElements only positions nodes an arrow touches; edgeless nodes
// keep their given position, which for graph imports means piled at the
// origin (everything starts at 0,0). Sweep them into rows below the placed
// content instead. Lives here (the import path) on purpose: for the MCP's
// element authoring, leaving edgeless content alone is load-bearing
// (docs/specs/015-api/mcp-server.md §4.3) — for a parsed graph there is no hand-placed content.
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
  const block = placed.length ? bbox(placed) : null;
  const start = block ? { x: block.x, y: block.y + block.height + LAYER_GAP } : { x: 0, y: 0 };
  const rowCap = Math.max(block ? block.width : 0, 600);
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

  // Every node arrives sized to its own label (graphToElements), so the
  // layout keeps those sizes rather than stretching each box to its widest
  // peer: one long label no longer inflates every box, and a dot stays a dot.
  const sized = new Set(graph.nodes.map((n) => n.id));

  if (clusters.length === 0) {
    return sweepEdgelessNodes(
      autoLayoutElements(graphToElements(graph, makeEdgeId), { direction, fixedSizeIds: sized }),
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
    const laid = lineUpLoose(
      autoLayoutElements(
        graphToElements(induced, () => `tmp-${makeEdgeId()}`),
        { direction, fixedSizeIds: sized },
      ).filter(isBoxed),
      new Set(induced.edges.flatMap((e) => [e.from, e.to])),
      direction ?? 'TB',
    );
    memberEls.set(c.id, laid);
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
      width: b.width + 2 * FRAME_PAD,
      height: b.height + FRAME_TOP + FRAME_PAD,
      label: c.label ?? c.id,
      // A header in the band FRAME_TOP reserves: top-left, bold, at the nodes'
      // own size. Left at the shape defaults it was centred and scaled to fill
      // the frame, a giant word across its members (docs/specs/020-import-export/mermaid.md).
      textAlignY: 'top' as const,
      textAlignX: 'left' as const,
      textSize: 'sm' as const,
      textBold: true,
      padding: 'lg' as const,
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
    fixedSizeIds: new Set([...frameIds, ...sized]),
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
    const dx = frame.x + FRAME_PAD - b.x;
    const dy = frame.y + FRAME_TOP - b.y;
    for (const m of members) placedNodes.push({ ...m, x: m.x + dx, y: m.y + dy });
  }

  // 3b. Within each group, order members that share a rank by where their
  // outside neighbours ended up, so edges into the group don't cross it.
  orderMembersByNeighbours(clusters, placedNodes, placedFrames, graph, direction ?? 'TB');

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
    .map((e) => reanchorArrow(edgeToArrow(e, makeEdgeId()), centers, direction ?? 'TB'));

  // Frames first so they render behind their members. The final sweep only
  // catches free nodes with no edges at all — frames and cluster members
  // are deliberately placed, so they're exempt.
  const deliberate = new Set([...frameIds, ...clusterOf.keys()]);
  return sweepEdgelessNodes([...placedFrames, ...placedNodes, ...arrows], deliberate);
}

// A group's members that no arrow inside the group touches (the usual case: a
// "Core services" box of peers wired only to things outside it). Row-wrapping
// them like loose content scattered them into a grid; line them up across the
// flow instead, beside whatever the group's own arrows placed, so arrows from
// outside reach each one without crossing another.
function lineUpLoose(
  members: BoxedElement[],
  wired: Set<string>,
  direction: LayoutDirection,
): BoxedElement[] {
  const placed = members.filter((m) => wired.has(m.id));
  const loose = members.filter((m) => !wired.has(m.id));
  if (loose.length === 0) return members;
  const block = placed.length ? bbox(placed) : null;
  const pos = new Map<string, Pt>();
  let cursor = block
    ? (direction === 'TB' ? block.x + block.width : block.y + block.height) + SIBLING_GAP
    : 0;
  const main = block ? (direction === 'TB' ? block.y : block.x) : 0;
  for (const m of loose) {
    pos.set(m.id, direction === 'TB' ? { x: cursor, y: main } : { x: main, y: cursor });
    cursor += (direction === 'TB' ? m.width : m.height) + SIBLING_GAP;
  }
  return members.map((m) => {
    const p = pos.get(m.id);
    return p ? { ...m, x: p.x, y: p.y } : m;
  });
}

// Reorders, in place, each group's members that share a rank (same main-axis
// centre) by the mean cross position of their neighbours outside the group.
// The slots stay where they are: the members are re-packed into the same span
// with the same gaps, so the frame still fits.
function orderMembersByNeighbours(
  clusters: GraphCluster[],
  nodes: BoxedElement[],
  frames: BoxedElement[],
  graph: DiagramGraph,
  direction: LayoutDirection,
): void {
  const index = new Map(nodes.map((n, i) => [n.id, i]));
  const byId = new Map([...nodes, ...frames].map((el) => [el.id, el]));
  const cross = (el: BoxedElement) =>
    direction === 'TB' ? el.x + el.width / 2 : el.y + el.height / 2;
  const mainOf = (el: BoxedElement) =>
    Math.round(direction === 'TB' ? el.y + el.height / 2 : el.x + el.width / 2);
  const crossStart = (el: BoxedElement) => (direction === 'TB' ? el.x : el.y);
  const crossLen = (el: BoxedElement) => (direction === 'TB' ? el.width : el.height);
  for (const c of clusters) {
    const inside = new Set(c.members);
    const ranks = new Map<number, BoxedElement[]>();
    for (const id of c.members) {
      const el = nodes[index.get(id)!]!;
      const k = mainOf(el);
      (ranks.get(k) ?? ranks.set(k, []).get(k)!).push(el);
    }
    for (const rank of ranks.values()) {
      if (rank.length < 2) continue;
      rank.sort((a, b) => crossStart(a) - crossStart(b));
      const gaps = rank
        .slice(1)
        .map((el, i) => crossStart(el) - crossStart(rank[i]!) - crossLen(rank[i]!));
      const keyed = rank.map((el, i) => {
        const outside: number[] = [];
        for (const e of graph.edges) {
          const other = e.from === el.id ? e.to : e.to === el.id ? e.from : null;
          if (other === null || inside.has(other)) continue;
          const o = byId.get(other);
          if (o) outside.push(cross(o));
        }
        const key = outside.length
          ? outside.reduce((a, b) => a + b, 0) / outside.length
          : cross(el);
        return { el, key, i };
      });
      keyed.sort((a, b) => a.key - b.key || a.i - b.i);
      let cursor = crossStart(rank[0]!);
      keyed.forEach(({ el }, k) => {
        const moved = direction === 'TB' ? { ...el, x: cursor } : { ...el, y: cursor };
        nodes[index.get(el.id)!] = moved;
        byId.set(el.id, moved);
        cursor += crossLen(el) + (gaps[k] ?? 0);
      });
    }
  }
}
