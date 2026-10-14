// ER relationships hub first (docs/specs/020-import-export/mermaid.md "Hub first"): the layered layout reads an
// edge's direction as the flow, which an ER model does not have, so the hub could rank last with every line reaching
// back to it.

import type { GraphEdge } from './graph-authoring';

// Relationships oriented away from the best-connected entity, by distance from it, so the layered layout ranks the
// hub first and its neighbours round it, not the hub last with every line reaching back to it. A relationship has an
// end at each table, so flipping one (its ER ends swapped with it) draws the same thing.
export function hubFirst(ids: readonly string[], edges: readonly GraphEdge[]): GraphEdge[] {
  const near = new Map<string, string[]>(ids.map((id) => [id, []]));
  for (const e of edges) {
    if (e.from === e.to || !near.has(e.from) || !near.has(e.to)) continue;
    near.get(e.from)!.push(e.to);
    near.get(e.to)!.push(e.from);
  }
  const rank = new Map<string, number>();
  const byDegree = [...ids].sort((a, b) => near.get(b)!.length - near.get(a)!.length);
  for (const root of byDegree) {
    if (rank.has(root)) continue;
    rank.set(root, 0);
    const queue = [root];
    for (let i = 0; i < queue.length; i++) {
      const id = queue[i]!;
      for (const next of near.get(id)!)
        if (!rank.has(next)) {
          rank.set(next, rank.get(id)! + 1);
          queue.push(next);
        }
    }
  }
  return edges.map((e) =>
    (rank.get(e.from) ?? 0) > (rank.get(e.to) ?? 0)
      ? {
          ...e,
          from: e.to,
          to: e.from,
          ...(e.er ? { er: { from: e.er.to, to: e.er.from } } : {}),
        }
      : e,
  );
}
