// Cross-axis placement for the layered flow layout (docs/specs/008-canvas/layout-cleanup.md "Nodes sit by
// their neighbours"). Ranks used to be packed and centred on the widest one,
// so a node sat wherever its rank's width put it rather than by the nodes it
// connects to, and a long edge's line landed on whatever was in the middle.
//
// Each node is pulled toward the weighted mean position of its neighbours in
// the adjacent rank, alternating downward and upward sweeps. A rank's order
// (already chosen to cross few edges) never changes, and boxes keep their gap:
// the pulled positions are made legal by isotonic regression (pool adjacent
// violators), which finds the closest positions to the wanted ones that keep
// the order and spacing.
//
// Weights follow the usual layered-layout choice: an edge between two lane
// nodes (auto-layout-long-edges.ts) pulls hardest, so a long edge runs
// straight; one lane end pulls harder than a plain edge.

import type { ElementId } from './index';
import type { Edge } from './auto-layout-shared';

const SWEEP_PAIRS = 4;

function edgeWeight(a: ElementId, b: ElementId, lanes: Set<ElementId>): number {
  const n = (lanes.has(a) ? 1 : 0) + (lanes.has(b) ? 1 : 0);
  return n === 2 ? 8 : n === 1 ? 2 : 1;
}

// Closest positions to `want` (least squares) that keep `rank` in order with
// `gap` between neighbouring boxes of cross size `size`.
function legalise(
  rank: ElementId[],
  want: Map<ElementId, number>,
  size: (id: ElementId) => number,
  gap: number,
): Map<ElementId, number> {
  // Shift out the spacing so the constraint becomes plain non-decreasing.
  const offset: number[] = [];
  rank.forEach((id, i) => {
    offset.push(i === 0 ? 0 : offset[i - 1]! + size(rank[i - 1]!) / 2 + gap + size(id) / 2);
  });
  const blocks: { sum: number; count: number }[] = [];
  rank.forEach((id, i) => {
    blocks.push({ sum: want.get(id)! - offset[i]!, count: 1 });
    while (blocks.length > 1) {
      const last = blocks[blocks.length - 1]!;
      const prev = blocks[blocks.length - 2]!;
      if (prev.sum / prev.count <= last.sum / last.count) break;
      prev.sum += last.sum;
      prev.count += last.count;
      blocks.pop();
    }
  });
  // Expand the blocks back out to one value per node.
  const out = new Map<ElementId, number>();
  let i = 0;
  for (const b of blocks) {
    const v = b.sum / b.count;
    for (let k = 0; k < b.count; k++, i++) out.set(rank[i]!, v + offset[i]!);
  }
  return out;
}

// Cross-axis CENTRE of every node, for ranks in the given order. `start` is
// the packed-and-centred placement the sweeps begin from.
export function placeCrossAxis(
  order: ElementId[][],
  edges: Edge[],
  size: (id: ElementId) => number,
  gap: number,
  lanes: Set<ElementId>,
  start: Map<ElementId, number>,
): Map<ElementId, number> {
  const pos = new Map(start);
  if (order.length < 2) return pos;
  const up = new Map<ElementId, { id: ElementId; w: number }[]>();
  const down = new Map<ElementId, { id: ElementId; w: number }[]>();
  const rankOf = new Map<ElementId, number>();
  order.forEach((rank, r) => rank.forEach((id) => rankOf.set(id, r)));
  for (const e of edges) {
    const a = rankOf.get(e.from);
    const b = rankOf.get(e.to);
    if (a === undefined || b === undefined || Math.abs(a - b) !== 1) continue;
    const [hi, lo] = a < b ? [e.from, e.to] : [e.to, e.from];
    const w = edgeWeight(e.from, e.to, lanes);
    (down.get(hi) ?? down.set(hi, []).get(hi)!).push({ id: lo, w });
    (up.get(lo) ?? up.set(lo, []).get(lo)!).push({ id: hi, w });
  }
  const pull = (rank: ElementId[], sides: Map<ElementId, { id: ElementId; w: number }[]>[]) => {
    const want = new Map<ElementId, number>();
    for (const id of rank) {
      let sum = 0;
      let wsum = 0;
      for (const side of sides)
        for (const n of side.get(id) ?? []) {
          sum += pos.get(n.id)! * n.w;
          wsum += n.w;
        }
      want.set(id, wsum > 0 ? sum / wsum : pos.get(id)!);
    }
    for (const [id, v] of legalise(rank, want, size, gap)) pos.set(id, v);
  };
  for (let s = 0; s < SWEEP_PAIRS; s++) {
    for (let r = 1; r < order.length; r++) pull(order[r]!, [up]);
    for (let r = order.length - 2; r >= 0; r--) pull(order[r]!, [down]);
  }
  for (const rank of order) pull(rank, [up, down]);
  // Straighten one-to-one links: a node whose only neighbour above has it as
  // its only neighbour below sits right under that neighbour when there is
  // room, so a plain chain (Paid, Shipped, Delivered) runs dead straight
  // instead of drifting a few pixels per rank.
  for (let r = 1; r < order.length; r++) {
    const rank = order[r]!;
    const want = new Map<ElementId, number>();
    for (const id of rank) {
      const above = up.get(id) ?? [];
      const only = above.length === 1 ? above[0]!.id : null;
      want.set(id, only && (down.get(only) ?? []).length === 1 ? pos.get(only)! : pos.get(id)!);
    }
    for (const [id, v] of legalise(rank, want, size, gap)) pos.set(id, v);
  }
  return pos;
}
