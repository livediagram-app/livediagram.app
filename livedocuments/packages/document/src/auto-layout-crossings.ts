// Crossing reduction for the layered flow layout (docs/specs/008-canvas/layout-cleanup.md "Fewer
// crossings"). The first order in each rank follows the nodes' current
// positions, which respects a drawing someone already arranged; this refines it
// with alternating barycentre sweeps (each node pulled toward the average
// position of its neighbours in the adjacent rank) and keeps the refinement
// only if it crosses fewer edges. Graph input, whose nodes all start at one
// point, gets a readable order instead of its input order.
//
// Only edges between ADJACENT ranks take part: a long edge skips ranks and has
// no neighbour order to pull toward. Pure; mutates nothing it is given.

import type { ElementId } from './index';
import type { Edge } from './auto-layout-shared';

const SWEEPS = 6;

// How many pairs of adjacent-rank edges cross, for one full ordering. Edges are bucketed by the
// pair of ranks they join in one pass, and each bucket's crossings are counted as inversions, so the
// cost is E log V rather than every pair of edges between two ranks.
export function countCrossings(
  order: ElementId[][],
  edges: Edge[],
  layerOf: Map<ElementId, number>,
): number {
  const index = new Map<ElementId, number>();
  const rankOf = new Map<ElementId, number>();
  order.forEach((rank, r) =>
    rank.forEach((id, i) => {
      index.set(id, i);
      rankOf.set(id, r);
    }),
  );
  const spans: [number, number][][] = order.map(() => []);
  for (const e of edges) {
    if (!layerOf.has(e.from) || !layerOf.has(e.to)) continue;
    const a = rankOf.get(e.from);
    const b = rankOf.get(e.to);
    if (a === undefined || b === undefined || Math.abs(a - b) !== 1) continue;
    const [top, bottom] = a < b ? [e.from, e.to] : [e.to, e.from];
    spans[Math.min(a, b)]!.push([index.get(top)!, index.get(bottom)!]);
  }
  let crossings = 0;
  for (let r = 0; r + 1 < order.length; r++)
    crossings += crossingPairs(spans[r]!, order[r + 1]!.length);
  return crossings;
}

// Pairs of edges [top, bottom] that cross: one strictly left of the other at the top and strictly
// right of it at the bottom. Edges are taken left to right by their top end, and a Fenwick tree over
// the bottom positions counts, for each, the earlier ones that land strictly right of it; edges
// sharing a top end are counted before any of them is added, so they never cross each other.
function crossingPairs(span: [number, number][], width: number): number {
  if (span.length < 2) return 0;
  const sorted = [...span].sort((p, q) => p[0] - q[0]);
  const tree = new Int32Array(width + 1);
  const add = (i: number) => {
    for (let k = i + 1; k <= width; k += k & -k) tree[k]!++;
  };
  // How many added edges land at or left of bottom position i.
  const upTo = (i: number) => {
    let n = 0;
    for (let k = i + 1; k > 0; k -= k & -k) n += tree[k]!;
    return n;
  };
  let pairs = 0;
  let added = 0;
  for (let i = 0; i < sorted.length;) {
    let j = i;
    while (j < sorted.length && sorted[j]![0] === sorted[i]![0]) j++;
    for (let k = i; k < j; k++) pairs += added - upTo(sorted[k]![1]);
    for (let k = i; k < j; k++) add(sorted[k]![1]);
    added += j - i;
    i = j;
  }
  return pairs;
}

// Reorders each rank to cross fewer edges, or returns the order it was given
// when no sweep improves on it.
export function reduceCrossings(
  order: ElementId[][],
  edges: Edge[],
  layerOf: Map<ElementId, number>,
): ElementId[][] {
  if (order.length < 2) return order;
  // Each node's neighbours, built once: a sweep then costs each node's degree, not every edge.
  const adjacent = new Map<ElementId, ElementId[]>();
  const link = (a: ElementId, b: ElementId) => {
    const list = adjacent.get(a);
    if (list) list.push(b);
    else adjacent.set(a, [b]);
  };
  for (const e of edges) {
    link(e.from, e.to);
    link(e.to, e.from);
  }
  const reorder = (rank: ElementId[], against: ElementId[]) => {
    const pos = new Map(against.map((id, i) => [id, i] as const));
    const keyed = rank.map((id, i) => {
      let sum = 0;
      let count = 0;
      for (const n of adjacent.get(id) ?? []) {
        const p = pos.get(n);
        if (p === undefined) continue;
        sum += p;
        count++;
      }
      // A node with no neighbour there keeps its place.
      return { id, bary: count ? sum / count : i, i };
    });
    keyed.sort((a, b) => a.bary - b.bary || a.i - b.i);
    return keyed.map((k) => k.id);
  };

  let best = order.map((rank) => [...rank]);
  let bestCount = countCrossings(best, edges, layerOf);
  if (bestCount === 0) return order;
  const current = best.map((rank) => [...rank]);
  for (let sweep = 0; sweep < SWEEPS; sweep++) {
    if (sweep % 2 === 0)
      for (let r = 1; r < current.length; r++) current[r] = reorder(current[r]!, current[r - 1]!);
    else
      for (let r = current.length - 2; r >= 0; r--)
        current[r] = reorder(current[r]!, current[r + 1]!);
    const count = countCrossings(current, edges, layerOf);
    if (count < bestCount) {
      best = current.map((rank) => [...rank]);
      bestCount = count;
      if (count === 0) break;
    }
  }
  return best;
}
