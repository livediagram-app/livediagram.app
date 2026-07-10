// Mindmap layout style (spec/47 "Layout styles"): radial. The hub (highest-
// degree node) sits at the centre and its subtrees fan out around it: each
// subtree owns an angular wedge proportional to its leaf count, and depth
// maps to ring radius. Rings grow when a level is crowded so labels don't
// collide on dense maps.
//
// Like the tree style, geometry hangs off a BFS spanning tree; non-tree
// edges just re-anchor across the placed nodes.

import { type ElementId } from './index';
import {
  LAYER_GAP,
  SIBLING_GAP,
  pushTo,
  spanningForest,
  type Edge,
  type PlacedComponent,
  type Pt,
  type Size,
} from './auto-layout-shared';

// The mindmap hub: the node the most arrows touch (undirected degree),
// ties broken by input order so the pick is deterministic.
function hubOf(ids: ElementId[], edges: Edge[]): ElementId {
  const degree = new Map<ElementId, number>(ids.map((id) => [id, 0]));
  for (const e of edges) {
    degree.set(e.from, (degree.get(e.from) ?? 0) + 1);
    degree.set(e.to, (degree.get(e.to) ?? 0) + 1);
  }
  let best = ids[0]!;
  for (const id of ids) {
    if (degree.get(id)! > degree.get(best)!) best = id;
  }
  return best;
}

// Place one component as a radial mindmap around its hub.
export function positionMindmapComponent(
  ids: ElementId[],
  edges: Edge[],
  size: Map<ElementId, Size>,
  centers: Map<ElementId, Pt>,
): PlacedComponent {
  const hub = hubOf(ids, edges);
  const children = spanningForest(ids, edges, [hub]);
  // Deterministic branch order following the user's rough angular intent
  // (angle of each child's current position around the hub).
  const hubC = centers.get(hub)!;
  const angleOf = (id: ElementId) => {
    const c = centers.get(id)!;
    return Math.atan2(c.y - hubC.y, c.x - hubC.x);
  };
  for (const kids of children.values()) kids.sort((a, b) => angleOf(a) - angleOf(b));

  // Leaves under each node — a subtree's angular share. min 1 so a bare
  // child still gets a wedge.
  const leaves = new Map<ElementId, number>();
  const countLeaves = (id: ElementId): number => {
    const kids = children.get(id)!;
    const n = kids.length === 0 ? 1 : kids.reduce((s, k) => s + countLeaves(k), 0);
    leaves.set(id, n);
    return n;
  };
  countLeaves(hub);

  const depth = new Map<ElementId, number>();
  const walkDepth = (id: ElementId, d: number) => {
    depth.set(id, d);
    for (const k of children.get(id)!) walkDepth(k, d + 1);
  };
  walkDepth(hub, 0);

  // Ring radii: each ring clears the previous by the largest node on it plus
  // a gap, and additionally grows until its circumference fits every node on
  // that ring (footprint + sibling gap), the anti-collision guarantee.
  const byDepth = new Map<number, ElementId[]>();
  for (const id of ids) pushTo(byDepth, depth.get(id)!, id);
  const footprint = (id: ElementId) => Math.max(size.get(id)!.w, size.get(id)!.h);
  const radius = new Map<number, number>();
  radius.set(0, 0);
  let prev = 0;
  let prevMax = footprint(hub);
  for (let d = 1; byDepth.has(d); d++) {
    const ring = byDepth.get(d)!;
    const ringMax = Math.max(...ring.map(footprint));
    const clearPrev = prev + prevMax / 2 + ringMax / 2 + LAYER_GAP;
    const needed = ring.reduce((s, id) => s + footprint(id) + SIBLING_GAP, 0);
    const r = Math.max(clearPrev, needed / (2 * Math.PI));
    radius.set(d, r);
    prev = r;
    prevMax = ringMax;
  }

  // Wedge assignment: the hub's children split the full circle by leaf
  // count; every descendant recursively splits its parent's wedge and sits
  // at the wedge's bisector on its depth's ring. Positions are node centres
  // for now; normalised to top-left local coords at the end.
  const centerPos = new Map<ElementId, Pt>();
  centerPos.set(hub, { x: 0, y: 0 });
  const placeWedge = (id: ElementId, start: number, span: number) => {
    const kids = children.get(id)!;
    let a = start;
    for (const k of kids) {
      const share = (span * leaves.get(k)!) / leaves.get(id)!;
      const mid = a + share / 2;
      const r = radius.get(depth.get(k)!)!;
      centerPos.set(k, { x: r * Math.cos(mid), y: r * Math.sin(mid) });
      placeWedge(k, a, share);
      a += share;
    }
  };
  placeWedge(hub, -Math.PI / 2, 2 * Math.PI); // first branch starts at 12 o'clock

  // Normalise to local top-left coords with the block starting at 0,0.
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const id of ids) {
    const c = centerPos.get(id)!;
    const s = size.get(id)!;
    minX = Math.min(minX, c.x - s.w / 2);
    minY = Math.min(minY, c.y - s.h / 2);
    maxX = Math.max(maxX, c.x + s.w / 2);
    maxY = Math.max(maxY, c.y + s.h / 2);
  }
  const pos = new Map<ElementId, Pt>();
  for (const id of ids) {
    const c = centerPos.get(id)!;
    const s = size.get(id)!;
    pos.set(id, { x: c.x - s.w / 2 - minX, y: c.y - s.h / 2 - minY });
  }
  return { pos, width: maxX - minX, height: maxY - minY };
}
