// The editor's Tidy Up flow layout for one component (docs/specs/008-canvas/layout-cleanup.md "Tidy
// Up keeps a flowchart a flowchart"). The same layered pipeline as the graph-input flow
// (auto-layout.ts), fed the tidy ranking (auto-layout-tidy-rank.ts): side steps share their
// decision's rank and are kept right beside it, and the gaps are sized to the arrow labels that
// have to fit in them rather than one constant.

import type { ElementId } from './index';
import type { Edge, PlacedComponent, Pt, Size } from './auto-layout-shared';
import { pushTo } from './auto-layout-shared';
import { reduceCrossings } from './auto-layout-crossings';
import { LANE_WIDTH, laneId, splitLongEdges } from './auto-layout-long-edges';
import { placeCrossAxis } from './auto-layout-placement';
import { rankTidyComponent, type SideSpec } from './auto-layout-tidy-rank';

// Gaps in a tidied flow. A hand-drawn flowchart sits tighter than graph input's 90 / 56: the
// checkout template's rows are 44 apart and its side column 110 (a labelled exit).
export const TIDY_RANK_GAP = 56;
export const TIDY_SIBLING_GAP = 48;
// Room a label needs either side of it along its line, and the width one character takes at the
// label's default 12 px (a measured average; a label is a word or two, so an estimate is enough).
export const LABEL_PAD = 28;
const LABEL_CHAR_PX = 6.6;
const LABEL_MAX_PX = 160;
const LABEL_LINE_PX = 18;

export const labelRoom = (label: string | undefined): { w: number; h: number } => {
  const text = label?.trim() ?? '';
  if (!text) return { w: 0, h: 0 };
  return {
    w: Math.min(LABEL_MAX_PX, text.length * LABEL_CHAR_PX) + LABEL_PAD * 2,
    h: LABEL_LINE_PX,
  };
};

export type TidyFlowComponent = PlacedComponent & {
  side: Map<ElementId, SideSpec>;
  back: Edge[];
  /** Each long forward edge's lane centres on the cross axis, one per rank it passes, keyed `from->to`. */
  lanes: Map<string, number[]>;
};

export function positionTidyFlowComponent(
  realIds: ElementId[],
  realEdges: Edge[],
  size: Map<ElementId, Size>,
  centers: Map<ElementId, Pt>,
  dir: 'TB' | 'LR',
  isDecision: (id: ElementId) => boolean,
  labelOf: (e: Edge) => string | undefined,
): TidyFlowComponent {
  const {
    layer: realLayer,
    forward,
    back,
    side,
  } = rankTidyComponent({
    ids: realIds,
    edges: realEdges,
    centers,
    size,
    dir,
    isDecision,
  });
  const { ids, edges, layer, lanes } = splitLongEdges(realIds, forward, realLayer);
  const crossOfNode = (id: ElementId) => (dir === 'TB' ? centers.get(id)!.x : centers.get(id)!.y);
  const mainSize = (id: ElementId) =>
    lanes.has(id) ? 0 : dir === 'TB' ? size.get(id)!.h : size.get(id)!.w;
  const crossSize = (id: ElementId) =>
    lanes.has(id) ? LANE_WIDTH : dir === 'TB' ? size.get(id)!.w : size.get(id)!.h;

  // A side step travels with the node it sits beside: ordering sees one block per column node.
  const rootOf = (id: ElementId): ElementId => {
    let r = id;
    while (side.has(r)) r = side.get(r)!.parent;
    return r;
  };
  const laneSource = new Map<ElementId, ElementId>();
  for (const e of edges)
    if (lanes.has(e.to)) laneSource.set(e.to, laneSource.get(e.from) ?? e.from);
  const crossOf = (id: ElementId) => crossOfNode(laneSource.get(id) ?? id);

  const byLayer = new Map<number, ElementId[]>();
  for (const id of ids) if (!side.has(id)) pushTo(byLayer, layer.get(id)!, id);
  const layers = [...new Set(ids.map((id) => layer.get(id)!))].sort((a, b) => a - b);
  for (const L of layers)
    (byLayer.get(L) ?? byLayer.set(L, []).get(L)!).sort((a, b) => crossOf(a) - crossOf(b));
  const blockEdges: Edge[] = [];
  for (const e of edges) {
    const from = rootOf(e.from);
    const to = rootOf(e.to);
    if (from !== to) blockEdges.push({ from, to });
  }
  const refined = reduceCrossings(
    layers.map((L) => byLayer.get(L)!),
    blockEdges,
    layer,
  );
  // Expand each block back out: side steps before their node farthest first, after it nearest first.
  const depthOf = (id: ElementId) => {
    let d = 0;
    for (let r = id; side.has(r); r = side.get(r)!.parent) d++;
    return d;
  };
  const members = new Map<ElementId, ElementId[]>();
  for (const id of side.keys()) pushTo(members, rootOf(id), id);
  const order = refined.map((rank) =>
    rank.flatMap((root) => {
      const steps = members.get(root) ?? [];
      const before = steps
        .filter((s) => side.get(s)!.sign === -1)
        .sort((a, b) => depthOf(b) - depthOf(a));
      const after = steps
        .filter((s) => side.get(s)!.sign === 1)
        .sort((a, b) => depthOf(a) - depthOf(b));
      return [...before, root, ...after];
    }),
  );

  // The gap after each rank fits the labels of the edges crossing it (LR: a label's width; TB: its
  // line height under the jog a square route makes there).
  const rankIndex = new Map<ElementId, number>();
  order.forEach((rank, i) => rank.forEach((id) => rankIndex.set(id, i)));
  const rankGap = order.map(() => TIDY_RANK_GAP);
  for (const e of realEdges) {
    const room = labelRoom(labelOf(e));
    if (!room.w) continue;
    const a = rankIndex.get(e.from);
    const b = rankIndex.get(e.to);
    if (a === undefined || b === undefined || a === b) continue;
    const need = (dir === 'LR' ? room.w : room.h * 2 + LABEL_PAD) as number;
    for (let r = Math.min(a, b); r < Math.max(a, b); r++) rankGap[r] = Math.max(rankGap[r]!, need);
  }
  // Beside a node, the gap fits the label of a side edge between them.
  const sideLabel = new Map<string, number>();
  for (const e of realEdges) {
    const room = labelRoom(labelOf(e));
    const w = dir === 'TB' ? room.w : room.h * 2 + LABEL_PAD;
    if (!w) continue;
    for (const key of [`${e.from}|${e.to}`, `${e.to}|${e.from}`])
      sideLabel.set(key, Math.max(sideLabel.get(key) ?? 0, w));
  }
  const gapBetween = (a: ElementId, b: ElementId) =>
    Math.max(TIDY_SIBLING_GAP, sideLabel.get(`${a}|${b}`) ?? 0);

  const start = new Map<ElementId, number>();
  for (const rank of order) {
    let c = 0;
    rank.forEach((id, i) => {
      if (i > 0) c += gapBetween(rank[i - 1]!, id);
      start.set(id, c + crossSize(id) / 2);
      c += crossSize(id);
    });
  }
  const centre = placeCrossAxis(order, edges, crossSize, TIDY_SIBLING_GAP, lanes, start, {
    gapBetween,
    side,
  });

  let minCross = Infinity;
  let maxCross = -Infinity;
  for (const id of realIds) {
    minCross = Math.min(minCross, centre.get(id)! - crossSize(id) / 2);
    maxCross = Math.max(maxCross, centre.get(id)! + crossSize(id) / 2);
  }
  const pos = new Map<ElementId, Pt>();
  let mainCursor = 0;
  order.forEach((rank, r) => {
    const lm = Math.max(0, ...rank.map(mainSize));
    for (const id of rank) {
      if (lanes.has(id)) continue;
      const mainPos = mainCursor + (lm - mainSize(id)) / 2;
      const crossPos = centre.get(id)! - crossSize(id) / 2 - minCross;
      pos.set(id, dir === 'TB' ? { x: crossPos, y: mainPos } : { x: mainPos, y: crossPos });
    }
    mainCursor += lm + (r < order.length - 1 ? rankGap[r]! : 0);
  });

  // Lane centres per long edge, in the component's local cross coordinates.
  const laneCentres = new Map<string, number[]>();
  forward.forEach((e, i) => {
    const a = realLayer.get(e.from)!;
    const b = realLayer.get(e.to)!;
    const chain: number[] = [];
    for (let r = a + 1; r < b; r++) chain.push(centre.get(laneId(i, r))! - minCross);
    if (chain.length) laneCentres.set(`${e.from}->${e.to}`, chain);
  });
  const crossExtent = maxCross - minCross;
  return {
    pos,
    width: dir === 'TB' ? crossExtent : mainCursor,
    height: dir === 'TB' ? mainCursor : crossExtent,
    side,
    back,
    lanes: laneCentres,
  };
}
