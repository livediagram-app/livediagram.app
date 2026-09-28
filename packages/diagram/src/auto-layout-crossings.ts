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

// How many pairs of adjacent-rank edges cross, for one full ordering.
export function countCrossings(
  order: ElementId[][],
  edges: Edge[],
  layerOf: Map<ElementId, number>,
): number {
  const index = new Map<ElementId, number>();
  order.forEach((rank) => rank.forEach((id, i) => index.set(id, i)));
  let crossings = 0;
  for (let r = 0; r + 1 < order.length; r++) {
    const span: [number, number][] = [];
    for (const e of edges) {
      const a = layerOf.get(e.from);
      const b = layerOf.get(e.to);
      if (a === undefined || b === undefined) continue;
      const rankA = order[r]!;
      const rankB = order[r + 1]!;
      if (rankA.includes(e.from) && rankB.includes(e.to))
        span.push([index.get(e.from)!, index.get(e.to)!]);
      else if (rankA.includes(e.to) && rankB.includes(e.from))
        span.push([index.get(e.to)!, index.get(e.from)!]);
    }
    for (let i = 0; i < span.length; i++)
      for (let j = i + 1; j < span.length; j++) {
        const [a1, b1] = span[i]!;
        const [a2, b2] = span[j]!;
        if ((a1 - a2) * (b1 - b2) < 0) crossings++;
      }
  }
  return crossings;
}

// Reorders each rank to cross fewer edges, or returns the order it was given
// when no sweep improves on it.
export function reduceCrossings(
  order: ElementId[][],
  edges: Edge[],
  layerOf: Map<ElementId, number>,
): ElementId[][] {
  if (order.length < 2) return order;
  const neighbours = (id: ElementId, rank: ElementId[]) => {
    const inRank = new Set(rank);
    const out: ElementId[] = [];
    for (const e of edges) {
      if (e.from === id && inRank.has(e.to)) out.push(e.to);
      else if (e.to === id && inRank.has(e.from)) out.push(e.from);
    }
    return out;
  };
  const reorder = (rank: ElementId[], against: ElementId[]) => {
    const pos = new Map(against.map((id, i) => [id, i] as const));
    const keyed = rank.map((id, i) => {
      const ns = neighbours(id, against);
      // A node with no neighbour there keeps its place.
      const bary = ns.length ? ns.reduce((sum, n) => sum + pos.get(n)!, 0) / ns.length : i;
      return { id, bary, i };
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
