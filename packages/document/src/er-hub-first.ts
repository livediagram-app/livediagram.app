// ER relationships hub first (docs/specs/020-import-export/mermaid.md "Hub first"): the layered layout reads an
// edge's direction as the flow, which an ER model does not have, so the hub could rank last with every line reaching
// back to it. Only the layout sees the turn: turnBack restores each laid-out arrow to the way it was written.

import type { GraphEdge } from './graph-authoring';
import type { ArrowElement, Element } from './index';

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
          turned: true as const,
        }
      : e,
  );
}

// The same arrow drawn the other way: its ends, heads, bends and label place swapped, so the picture is unchanged.
export function reversedArrow(a: ArrowElement): ArrowElement {
  const startShape = a.arrowheadStartShape ?? a.arrowheadShape;
  const {
    arrowheadShape: _end,
    arrowheadStartShape: _start,
    exactStart,
    exactEnd,
    curvePoints,
    labelOffset,
    ...rest
  } = a;
  return {
    ...rest,
    from: a.to,
    to: a.from,
    ...(startShape ? { arrowheadShape: startShape } : {}),
    ...(a.arrowheadShape && a.arrowheadShape !== startShape
      ? { arrowheadStartShape: a.arrowheadShape }
      : {}),
    ...(exactEnd ? { exactStart: exactEnd } : {}),
    ...(exactStart ? { exactEnd: exactStart } : {}),
    ...(a.arrowEnds === 'to' ? { arrowEnds: 'from' as const } : {}),
    ...(a.arrowEnds === 'from' ? { arrowEnds: 'to' as const } : {}),
    ...(curvePoints ? { curvePoints: [...curvePoints].reverse() } : {}),
    ...(labelOffset ? { labelOffset: { t: 1 - labelOffset.t, offset: -labelOffset.offset } } : {}),
  };
}

// Each laid-out arrow of a turned edge (matched by its pinned ends) turned back to the way it was written.
export function turnBack(elements: Element[], edges: readonly GraphEdge[]): Element[] {
  const pending = new Map<string, number>();
  for (const e of edges)
    if (e.turned) pending.set(`${e.from}>${e.to}`, (pending.get(`${e.from}>${e.to}`) ?? 0) + 1);
  if (pending.size === 0) return elements;
  return elements.map((el) => {
    if (el.type !== 'arrow' || el.from.kind !== 'pinned' || el.to.kind !== 'pinned') return el;
    const key = `${el.from.elementId}>${el.to.elementId}`;
    const left = pending.get(key) ?? 0;
    if (left === 0) return el;
    pending.set(key, left - 1);
    return reversedArrow(el);
  });
}
