// The lanes layout (docs/specs/015-api/mcp-server.md §4.7 `style: "lanes"`): a swimlane diagram from a graph. Each
// group is a lane, one under another, its label in the lane's header strip; a node outside every group gets an
// unnamed lane after them. The flow runs left to right on a column grid shared by every lane, a node's column its
// longest path from a start (edges back to an earlier column are left to the loop routing), so a hand-off between
// lanes drops or climbs in the gap between two columns, as the swimlane template's do.

import { edgeToArrow, graphToElements, type DiagramGraph, type GraphLook } from './graph-authoring';
import { reanchorArrow, type Pt } from './auto-layout-shared';
import { isBoxed, type BoxedElement, type Element } from './index';

// The swimlane template's grid: header strip, padding inside a lane, gaps between columns and lanes.
export const LANES_GUTTER = 176;
const LANE_PAD = 28;
const COLUMN_GAP = 72;
const LANE_GAP = 36;
const STACK_GAP = 24;
const LANE_MIN_H = 120;

// Each node's column: its longest path from a node nothing enters, cycles cut where they close (input order).
function columnsOf(ids: string[], edges: { from: string; to: string }[]): Map<string, number> {
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
      if (at.get(u)! < at.get(v)!) col.set(v, Math.max(col.get(v)!, col.get(u)! + 1));
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
  const col = columnsOf(
    graph.nodes.map((n) => n.id),
    graph.edges,
  );
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
    const stackH = (s: BoxedElement[]) =>
      s.reduce((h, b) => h + b.height, 0) + STACK_GAP * (s.length - 1);
    const height = Math.max(
      LANE_MIN_H,
      LANE_PAD * 2 + Math.max(0, ...[...stacks.values()].map(stackH)),
    );
    for (const [c, stack] of stacks) {
      let sy = y + (height - stackH(stack)) / 2;
      for (const b of stack) {
        placed.push({ ...b, x: colX[c]! + (colW[c]! - b.width) / 2, y: sy });
        sy += b.height + STACK_GAP;
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
  return [...laneEls, ...placed, ...arrows];
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
