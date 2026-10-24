// Ranking for the editor's Tidy Up flow layout (docs/specs/008-canvas/layout-cleanup.md "Tidy Up
// keeps a flowchart a flowchart"). Three steps the auto-layout flow does not take, because an
// author's drawing carries intent a generated graph does not:
//
//   1. Loops are broken the way the drawing reads. A depth-first walk from the sources, children
//      taken in their drawn order down the flow, marks an edge that returns to a node still on the
//      walk as the loop's way back ("Try again"). The first-come order of the old Kahn walk could
//      pick a step of the happy path instead.
//   2. A decision's other exits sit BESIDE it. A flowchart steps a No out to a side column level
//      with the question rather than a rank below; one exit per side. Only a diamond with one exit
//      drawn straight below it (that one continues the column), or an exit the author already
//      drew level with its node, takes the side: a yes / no tree drawn with both answers below
//      stays a tree, and an org chart's reports stay below their manager.
//   3. Layering is longest-path with those side edges zero long, so a side step shares its
//      decision's rank and what follows it still lands below.
//
// Pure; mutates nothing it is given.

import type { ElementId } from './index';
import type { Edge, Pt, Size } from './auto-layout-shared';

/** A side step: which node it sits beside, and on which side of the cross axis (-1 before, 1 after). */
export type SideSpec = { parent: ElementId; sign: 1 | -1 };

// How far off a node's centre line an exit may sit and still read as continuing its column.
const IN_LINE_PX = 12;

type TidyRanking = {
  layer: Map<ElementId, number>;
  /** Edges that run with the flow (including side edges), in input order. */
  forward: Edge[];
  /** The loops' ways back, drawn against the flow. */
  back: Edge[];
  side: Map<ElementId, SideSpec>;
};

type TidyRankInput = {
  ids: ElementId[];
  edges: Edge[];
  /** Where each node is drawn now, to read the author's order from. */
  centers: Map<ElementId, Pt>;
  size: Map<ElementId, Size>;
  dir: 'TB' | 'LR';
  /** A decision (a diamond): its extra exits always take the side. */
  isDecision: (id: ElementId) => boolean;
};

export function rankTidyComponent(input: TidyRankInput): TidyRanking {
  const { ids, centers, size, dir, isDecision } = input;
  const idset = new Set(ids);
  const edges = input.edges.filter((e) => idset.has(e.from) && idset.has(e.to));
  const main = (id: ElementId) => (dir === 'TB' ? centers.get(id)!.y : centers.get(id)!.x);
  const cross = (id: ElementId) => (dir === 'TB' ? centers.get(id)!.x : centers.get(id)!.y);
  const mainSize = (id: ElementId) => (dir === 'TB' ? size.get(id)!.h : size.get(id)!.w);
  const drawn = (a: ElementId, b: ElementId) => main(a) - main(b) || cross(a) - cross(b);

  const isBack = findBackEdges(ids, edges, drawn);
  const forward: Edge[] = [];
  const back: Edge[] = [];
  edges.forEach((e, i) => (isBack[i] ? back : forward).push(e));

  const outs = new Map<ElementId, ElementId[]>(ids.map((id) => [id, []]));
  const indeg = new Map<ElementId, number>(ids.map((id) => [id, 0]));
  for (const e of forward) {
    outs.get(e.from)!.push(e.to);
    indeg.set(e.to, indeg.get(e.to)! + 1);
  }
  const topo = topoOrder(ids, outs, indeg, drawn);

  // Side steps, decided in flow order so a side step's own exits inherit its side.
  const side = new Map<ElementId, SideSpec>();
  for (const u of topo) {
    const kids = [...new Set(outs.get(u))];
    if (kids.length < 2) continue;
    // The exit most in line with its node continues the column.
    const primary = [...kids].sort(
      (a, b) => Math.abs(cross(a) - cross(u)) - Math.abs(cross(b) - cross(u)) || drawn(a, b),
    )[0]!;
    const inherited = side.get(u)?.sign;
    const taken = new Set<number>();
    const candidates = kids
      .filter((v) => v !== primary && indeg.get(v) === 1)
      .sort((a, b) => Math.abs(main(a) - main(u)) - Math.abs(main(b) - main(u)) || drawn(a, b));
    // In line means drawn in line: a few px of hand drift, not a layout's lean toward a subtree.
    const inLine = (v: ElementId) => Math.abs(cross(v) - cross(u)) <= IN_LINE_PX;
    for (const v of candidates) {
      const level = Math.abs(main(v) - main(u)) < mainSize(u) / 2;
      // A decision's other exit steps aside only when one exit already continues its column: a
      // yes / no tree drawn with both answers below stays a tree.
      if (!level && !(isDecision(u) && inLine(primary) && !inLine(v))) continue;
      let sign: 1 | -1 = inherited ?? (cross(v) >= cross(u) ? 1 : -1);
      if (taken.has(sign)) {
        if (inherited !== undefined) continue;
        sign = sign === 1 ? -1 : 1;
        if (taken.has(sign)) continue;
      }
      taken.add(sign);
      side.set(v, { parent: u, sign });
    }
  }

  const layer = new Map<ElementId, number>(ids.map((id) => [id, 0]));
  for (const u of topo)
    for (const v of outs.get(u)!) {
      const len = side.get(v)?.parent === u ? 0 : 1;
      layer.set(v, Math.max(layer.get(v)!, layer.get(u)! + len));
    }
  return { layer, forward, back, side };
}

// Edges that close a loop, by an iterative depth-first walk from the sources (then any node left,
// for a component that is all loop) in drawn order. `isBack[i]` is true for edges[i].
function findBackEdges(
  ids: ElementId[],
  edges: Edge[],
  drawn: (a: ElementId, b: ElementId) => number,
): boolean[] {
  const out = new Map<ElementId, number[]>(ids.map((id) => [id, []]));
  const indeg = new Map<ElementId, number>(ids.map((id) => [id, 0]));
  edges.forEach((e, i) => {
    out.get(e.from)?.push(i);
    if (indeg.has(e.to)) indeg.set(e.to, indeg.get(e.to)! + 1);
  });
  for (const list of out.values()) list.sort((a, b) => drawn(edges[a]!.to, edges[b]!.to));
  const isBack = edges.map(() => false);
  const state = new Map<ElementId, 0 | 1 | 2>(ids.map((id) => [id, 0]));
  const starts = [...ids].sort((a, b) => indeg.get(a)! - indeg.get(b)! || drawn(a, b));
  for (const s of starts) {
    if (state.get(s) !== 0) continue;
    const stack: { id: ElementId; next: number }[] = [{ id: s, next: 0 }];
    state.set(s, 1);
    while (stack.length) {
      const top = stack[stack.length - 1]!;
      const list = out.get(top.id)!;
      if (top.next >= list.length) {
        state.set(top.id, 2);
        stack.pop();
        continue;
      }
      const i = list[top.next++]!;
      const v = edges[i]!.to;
      const st = state.get(v);
      if (st === 1) isBack[i] = true;
      else if (st === 0) {
        state.set(v, 1);
        stack.push({ id: v, next: 0 });
      }
    }
  }
  return isBack;
}

// Kahn's order over the forward (acyclic) edges, ties taken in drawn order.
function topoOrder(
  ids: ElementId[],
  outs: Map<ElementId, ElementId[]>,
  indeg: Map<ElementId, number>,
  drawn: (a: ElementId, b: ElementId) => number,
): ElementId[] {
  const work = new Map(indeg);
  const ready = ids.filter((id) => work.get(id) === 0).sort(drawn);
  const order: ElementId[] = [];
  while (ready.length) {
    const u = ready.shift()!;
    order.push(u);
    for (const v of outs.get(u)!) {
      work.set(v, work.get(v)! - 1);
      if (work.get(v) === 0) {
        ready.push(v);
        ready.sort(drawn);
      }
    }
  }
  return order;
}
