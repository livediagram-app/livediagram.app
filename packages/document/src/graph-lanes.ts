// The lanes layout (docs/specs/015-api/mcp-server.md §4.7 `style: "lanes"`): a swimlane diagram from a graph. Each
// group is a lane, one under another, its label in the lane's header strip; a node outside every group gets an
// unnamed lane after them. The flow runs left to right on a column grid shared by every lane, a node's column its
// longest path from a start (edges back to an earlier column are left to the loop routing), so a hand-off between
// lanes drops or climbs in the gap between two columns, as the swimlane template's do.

import { edgeToArrow, graphToElements, type DiagramGraph, type GraphLook } from './graph-authoring';
import { reanchorArrow, type Pt } from './auto-layout-shared';
import { BRANCH_CLEAR, branchExits } from './graph-branches';
import { isBoxed, type BoxedElement, type Element } from './index';

// The swimlane template's grid: header strip, padding inside a lane, gaps between columns and lanes.
export const LANES_GUTTER = 176;
const LANE_PAD = 28;
const COLUMN_GAP = 72;
const LANE_GAP = 36;
const STACK_GAP = 24;
const LANE_MIN_H = 120;

// Each node's column: its longest path from a node nothing enters, cycles cut where they close (input order). An edge
// `level` names (a staircase hand-off) keeps its target in its source's column.
function columnsOf(
  ids: string[],
  edges: { from: string; to: string }[],
  level: ReadonlySet<string> = new Set(),
): Map<string, number> {
  const known = new Set(ids);
  const out = new Map(ids.map((id) => [id, [] as string[]]));
  const indeg = new Map(ids.map((id) => [id, 0]));
  for (const e of edges) {
    if (!known.has(e.from) || !known.has(e.to) || e.from === e.to) continue;
    out.get(e.from)!.push(e.to);
    indeg.set(e.to, indeg.get(e.to)! + 1);
  }
  const order: string[] = [];
  const queue = ids.filter((id) => indeg.get(id) === 0);
  const left = new Map(indeg);
  while (queue.length) {
    const u = queue.shift()!;
    order.push(u);
    for (const v of out.get(u)!) {
      left.set(v, left.get(v)! - 1);
      if (left.get(v) === 0) queue.push(v);
    }
  }
  for (const id of ids) if (!order.includes(id)) order.push(id);
  const at = new Map(order.map((id, i) => [id, i]));
  const col = new Map(ids.map((id) => [id, 0]));
  for (const u of order)
    for (const v of out.get(u)!)
      if (at.get(u)! < at.get(v)!)
        col.set(v, Math.max(col.get(v)!, col.get(u)! + (level.has(`${u}->${v}`) ? 0 : 1)));
  return col;
}

export function layoutLanes(
  graph: DiagramGraph,
  opts: { look: GraphLook; makeEdgeId?: (() => string) | undefined },
): Element[] {
  const makeEdgeId = opts.makeEdgeId ?? (() => crypto.randomUUID());
  const lanes = (graph.clusters ?? []).map((c) => ({
    id: c.id,
    label: c.label ?? c.id,
    members: [...c.members],
  }));
  const laneOf = new Map<string, number>();
  lanes.forEach((l, i) => l.members.forEach((m) => laneOf.has(m) || laneOf.set(m, i)));
  const loose = graph.nodes.filter((n) => !laneOf.has(n.id)).map((n) => n.id);
  if (loose.length) {
    lanes.push({ id: uniqueLaneId(graph), label: '', members: loose });
    loose.forEach((m) => laneOf.set(m, lanes.length - 1));
  }
  const boxes = graphToElements({ nodes: graph.nodes, edges: [] }, makeEdgeId, opts.look).filter(
    isBoxed,
  );
  const byId = new Map(boxes.map((b) => [b.id, b]));
  const col = stairColumns(graph, laneOf);
  const columns = Math.max(0, ...col.values()) + 1;
  const colW = Array.from({ length: columns }, (_, c) =>
    Math.max(0, ...boxes.filter((b) => col.get(b.id) === c).map((b) => b.width)),
  );
  const colX = colW.map(
    (_, c) => LANES_GUTTER + LANE_PAD + colW.slice(0, c).reduce((s, w) => s + w + COLUMN_GAP, 0),
  );
  const laneW =
    LANES_GUTTER + LANE_PAD * 2 + colW.reduce((s, w) => s + w, 0) + COLUMN_GAP * (columns - 1);

  // Each lane as tall as its tallest stack of nodes sharing a column.
  const placed: BoxedElement[] = [];
  const laneEls: BoxedElement[] = [];
  let y = 0;
  lanes.forEach((lane, i) => {
    const stacks = new Map<number, BoxedElement[]>();
    for (const id of lane.members) {
      const b = byId.get(id);
      if (!b) continue;
      const c = col.get(id)!;
      (stacks.get(c) ?? stacks.set(c, []).get(c)!).push(b);
    }
    // A stack every member of which one step of this lane feeds (a decision's yes and no, side by side in the next
    // column) spreads until its first and last clear that step's points by BRANCH_CLEAR, so its exits can leave by
    // the top and the bottom rather than as stubs from one point.
    const gapOf = (stack: BoxedElement[]) => {
      if (stack.length < 2) return STACK_GAP;
      const sources = new Set(
        stack.map((b) => {
          const feeds = graph.edges.filter((e) => e.to === b.id).map((e) => e.from);
          return feeds.length === 1 ? feeds[0]! : '';
        }),
      );
      const [only] = [...sources];
      const source = sources.size === 1 && only ? byId.get(only) : undefined;
      if (!source || laneOf.get(only!) !== i) return STACK_GAP;
      // A few px past the threshold, which branchExits reads strictly.
      const span = source.height + 2 * BRANCH_CLEAR + 4;
      const inner =
        stack.reduce((h, b) => h + b.height, 0) - stack[0]!.height / 2 - stack.at(-1)!.height / 2;
      return Math.max(STACK_GAP, Math.ceil((span - inner) / (stack.length - 1)));
    };
    const stackH = (s: BoxedElement[]) =>
      s.reduce((h, b) => h + b.height, 0) + gapOf(s) * (s.length - 1);
    const height = Math.max(
      LANE_MIN_H,
      LANE_PAD * 2 + Math.max(0, ...[...stacks.values()].map(stackH)),
    );
    for (const [c, stack] of stacks) {
      let sy = y + (height - stackH(stack)) / 2;
      for (const b of stack) {
        placed.push({ ...b, x: colX[c]! + (colW[c]! - b.width) / 2, y: sy });
        sy += b.height + gapOf(stack);
      }
    }
    laneEls.push({
      id: lane.id,
      type: 'shape',
      shape: 'lane',
      x: 0,
      y,
      width: laneW,
      height,
      label: lane.label,
      textSize: opts.look.textSize,
      textBold: true,
      textAlignX: 'left',
      textAlignY: 'top',
      headerSize: LANES_GUTTER,
      ...(i % 2 === 1 ? { colorPreset: 'soft' } : {}),
    });
    y += height + LANE_GAP;
  });

  const centers = new Map<string, Pt>(
    placed.map((b) => [b.id, { x: b.x + b.width / 2, y: b.y + b.height / 2 }]),
  );
  const arrows = graph.edges
    .filter((e) => centers.has(e.from) && centers.has(e.to))
    .map((e) => reanchorArrow(edgeToArrow(e, makeEdgeId()), centers, 'LR'));
  // A step's exits leave by different sides (graph-branches.ts): a decision's, or any step's that branches.
  return branchExits([...laneEls, ...placed, ...arrows], { axis: 'LR' });
}

// Columns with the staircase (docs/specs/015-api/mcp-server.md §4.7 "Lanes stay compact and their decisions branch"):
// a hand-off to the next lane that is its step's only way out and its next step's only way in keeps its column. One
// whose step, or next step, then shares that column with another node of its lane takes a column after all, so the
// drop never runs over a box; settled in a few rounds, as each round only ever gives a hand-off its column back.
const STAIR_ROUNDS = 4;
function stairColumns(
  graph: DiagramGraph,
  laneOf: ReadonlyMap<string, number>,
): Map<string, number> {
  const ids = graph.nodes.map((n) => n.id);
  const real = graph.edges.filter((e) => e.from !== e.to && laneOf.has(e.from) && laneOf.has(e.to));
  const count = (key: 'from' | 'to') => {
    const m = new Map<string, number>();
    for (const e of real) m.set(e[key], (m.get(e[key]) ?? 0) + 1);
    return m;
  };
  const [outs, ins] = [count('from'), count('to')];
  const level = new Set(
    real
      .filter(
        (e) =>
          Math.abs(laneOf.get(e.from)! - laneOf.get(e.to)!) === 1 &&
          outs.get(e.from) === 1 &&
          ins.get(e.to) === 1,
      )
      .map((e) => `${e.from}->${e.to}`),
  );
  let col = columnsOf(ids, graph.edges, level);
  for (let round = 0; round < STAIR_ROUNDS && level.size; round++) {
    const crowded = (id: string) =>
      ids.some((o) => o !== id && laneOf.get(o) === laneOf.get(id) && col.get(o) === col.get(id));
    const back = [...level].filter((k) => {
      const [from, to] = k.split('->') as [string, string];
      return col.get(from) !== col.get(to) || crowded(from) || crowded(to);
    });
    if (back.length === 0) break;
    back.forEach((k) => level.delete(k));
    col = columnsOf(ids, graph.edges, level);
  }
  return col;
}

// An id for the unnamed lane that no node or group already holds.
function uniqueLaneId(graph: DiagramGraph): string {
  const taken = new Set([
    ...graph.nodes.map((n) => n.id),
    ...(graph.clusters ?? []).map((c) => c.id),
  ]);
  let id = 'lane-other';
  for (let i = 2; taken.has(id); i++) id = `lane-other-${i}`;
  return id;
}
