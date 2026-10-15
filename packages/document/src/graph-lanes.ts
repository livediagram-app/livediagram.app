// The lanes layout (docs/specs/015-api/mcp-server.md §4.7 `style: "lanes"`): a swimlane diagram from a graph. Each
// group is a lane, one under another, its label in the lane's header strip; a node outside every group gets an
// unnamed lane after them. The flow runs left to right on a column grid shared by every lane, a node's column its
// longest path from a start (edges back to an earlier column are left to the loop routing), so a hand-off between
// lanes drops or climbs in the gap between two columns, as the swimlane template's do.

import { BOLD_EM } from './article-layout-estimate';
import {
  edgeToArrow,
  glyphWidth,
  graphToElements,
  type DiagramGraph,
  type GraphLook,
} from './graph-authoring';
import { LABEL_FONT_PX } from './label-font';
import { reanchorArrow, type Pt } from './auto-layout-shared';
import { BRANCH_CLEAR } from './graph-branches';
import { labelWidth } from './graph-look';
import { isBoxed, type BoxedElement, type Element } from './index';

// The swimlane template's grid: header strip (as wide as the longest lane title needs, between the bounds), padding
// inside a lane, gaps between columns and lanes.
export const LANES_GUTTER = 176;
const LANES_GUTTER_MIN = 120;
const GUTTER_TEXT_PAD = 40;
const LANE_PAD = 28;
const COLUMN_GAP = 48;
const LANE_GAP = 36;
const STACK_GAP = 24;
const LANE_MIN_H = 120;
// Room a level line keeps beside its label for its arrowhead and a stub out of its step.
const LEVEL_LABEL_ROOM = 16;

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
  // The header strip as wide as its longest title, set bold at md, needs; never past the template's.
  const titlePx = LABEL_FONT_PX.md * BOLD_EM;
  const gutter = Math.round(
    Math.min(
      LANES_GUTTER,
      Math.max(
        LANES_GUTTER_MIN,
        ...lanes.map((l) => glyphWidth(l.label, titlePx) + GUTTER_TEXT_PAD),
      ),
    ),
  );
  const col = stairColumns(graph, laneOf);
  const columns = Math.max(0, ...col.values()) + 1;
  const colW = Array.from({ length: columns }, (_, c) =>
    Math.max(0, ...boxes.filter((b) => col.get(b.id) === c).map((b) => b.width)),
  );
  const colX = colW.map(
    (_, c) => gutter + LANE_PAD + colW.slice(0, c).reduce((s, w) => s + w + COLUMN_GAP, 0),
  );
  const laneWide =
    gutter + LANE_PAD * 2 + colW.reduce((s, w) => s + w, 0) + COLUMN_GAP * (columns - 1);

  // Each lane as tall as its tallest stack of nodes sharing a column, settled twice: the first placing tells each stack
  // where its members' feeders sit, the second orders the stack by them and lines up a hand-off within the lane.
  const stacksOf = (lane: (typeof lanes)[number]) => {
    const stacks = new Map<number, BoxedElement[]>();
    for (const id of lane.members) {
      const b = byId.get(id);
      if (!b) continue;
      const c = col.get(id)!;
      (stacks.get(c) ?? stacks.set(c, []).get(c)!).push(b);
    }
    return stacks;
  };
  const first = placeLanes(lanes.map(stacksOf), graph, byId, laneOf, colX, colW);
  const midY = new Map(first.placed.map((b) => [b.id, b.y + b.height / 2]));
  const feedersOf = (id: string) =>
    graph.edges.filter((e) => e.to === id && e.from !== id && midY.has(e.from)).map((e) => e.from);
  const pull = (b: BoxedElement) => {
    const ys = feedersOf(b.id).map((f) => midY.get(f)!);
    return ys.length ? ys.reduce((s, v) => s + v, 0) / ys.length : midY.get(b.id)!;
  };
  // A stack reads top to bottom as its feeders do (a step fed from the lane above sits over one fed from below), so
  // the lines into it do not cross on their way in.
  const ordered = lanes.map((lane) => {
    const stacks = stacksOf(lane);
    for (const [c, stack] of stacks)
      stacks.set(
        c,
        stack
          .map((b, k) => ({ b, k, at: pull(b) }))
          .sort((p, q) => p.at - q.at || p.k - q.k)
          .map((e) => e.b),
      );
    return stacks;
  });
  const lined = placeLanes(ordered, graph, byId, laneOf, colX, colW, true);
  const { laneRects, straight } = lined;
  // A labelled line running level across one gap ("Accept", a decision's point exit) needs the gap to hold its label:
  // each such gap widens, and every column after it moves along with it.
  const levelY = new Map(lined.placed.map((b) => [b.id, b.y + b.height / 2]));
  const boxOf = new Map(lined.placed.map((b) => [b.id, b]));
  const widen = new Array<number>(columns).fill(0);
  for (const e of graph.edges) {
    const [a, b] = [boxOf.get(e.from), boxOf.get(e.to)];
    if (!a || !b || !e.label?.trim() || laneOf.get(e.from) !== laneOf.get(e.to)) continue;
    const c = col.get(e.from)!;
    if (col.get(e.to) !== c + 1 || Math.abs(levelY.get(e.from)! - levelY.get(e.to)!) > 1) continue;
    const run = b.x - (a.x + a.width);
    widen[c] = Math.max(widen[c]!, Math.ceil(labelWidth(e.label) + LEVEL_LABEL_ROOM - run));
  }
  const shiftOf = (c: number) => widen.slice(0, c).reduce((s, w) => s + w, 0);
  const placed = lined.placed.map((b) => ({ ...b, x: b.x + shiftOf(col.get(b.id)!) }));
  const laneW = laneWide + shiftOf(columns);
  const laneEls: BoxedElement[] = lanes.map((lane, i) => ({
    id: lane.id,
    type: 'shape',
    shape: 'lane',
    x: 0,
    y: laneRects[i]!.y,
    width: laneW,
    height: laneRects[i]!.height,
    label: lane.label,
    // The swimlane template's lane title: a size up from the steps, so a role reads as a heading.
    textSize: 'md',
    textBold: true,
    textAlignX: 'left',
    textAlignY: 'top',
    headerSize: gutter,
    ...(i % 2 === 1 ? { colorPreset: 'soft' } : {}),
  }));

  const centers = new Map<string, Pt>(
    placed.map((b) => [b.id, { x: b.x + b.width / 2, y: b.y + b.height / 2 }]),
  );
  const arrows = graph.edges
    .filter((e) => centers.has(e.from) && centers.has(e.to))
    .map((e) => reanchorArrow(edgeToArrow(e, makeEdgeId()), centers, 'LR'))
    // A hand-off lined up along its lane keeps the middle of its next step's side, so another line into that side
    // moves to a quarter beside it (graph-branches.ts) rather than both fanning off the straight run.
    .map((a) =>
      a.from.kind === 'pinned' &&
      a.to.kind === 'pinned' &&
      straight.has(`${a.from.elementId}->${a.to.elementId}`)
        ? { ...a, exactEnd: true }
        : a,
    );
  // A step's exits leave by different sides (graph-branches.ts) once graph input knows its lines are angled: only an
  // elbow turns a side exit into a square line.
  return [...laneEls, ...placed, ...arrows];
}

// Places each lane's stacks, one lane under another. A stack sits centred on its lane's middle line unless `align`:
// then, column by column, a stack one of whose members a step of the same lane feeds from an earlier column, with
// nothing of the lane between them on that line, moves so the two share a middle and the hand-off runs straight
// (a decision's "no" straight along its lane into the rejection). The lane grows to hold what moved.
function placeLanes(
  laneStacks: Map<number, BoxedElement[]>[],
  graph: DiagramGraph,
  byId: ReadonlyMap<string, BoxedElement>,
  laneOf: ReadonlyMap<string, number>,
  colX: number[],
  colW: number[],
  align = false,
): {
  placed: BoxedElement[];
  laneRects: { y: number; height: number }[];
  straight: Set<string>;
} {
  const placed: BoxedElement[] = [];
  const straight = new Set<string>();
  const laneRects: { y: number; height: number }[] = [];
  let y = 0;
  laneStacks.forEach((stacks, i) => {
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
    // Each stack's top, from the lane's middle line; members' middles likewise.
    const top = new Map<number, number>();
    const mid = new Map<string, number>();
    const at = new Map<string, { c: number; b: BoxedElement }>();
    const columns = [...stacks.keys()].sort((p, q) => p - q);
    const feeds = (from: string, to: string) =>
      graph.edges.some((e) => e.from === from && e.to === to);
    for (const c of columns) {
      const stack = stacks.get(c)!;
      const midsFrom = (t: number) => {
        const out: number[] = [];
        for (const b of stack) {
          out.push(t + b.height / 2);
          t += b.height + gapOf(stack);
        }
        return out;
      };
      let t = -stackH(stack) / 2;
      if (align) {
        const mids = midsFrom(t);
        for (let k = 0; k < stack.length; k++) {
          const b = stack[k]!;
          const feeder = graph.edges
            .filter((e) => e.to === b.id && at.has(e.from) && at.get(e.from)!.c < c)
            // A step that feeds two of the stack (a decision's branches) keeps them spread about it, each exit leaving
            // by its own side.
            .filter((e) => stack.filter((o) => feeds(e.from, o.id)).length < 2)
            .map((e) => at.get(e.from)!)
            .find((f) => clearRun(f, mid.get(f.b.id)!, c, at, mid));
          if (!feeder) continue;
          t += mid.get(feeder.b.id)! - mids[k]!;
          straight.add(`${feeder.b.id}->${b.id}`);
          break;
        }
      }
      top.set(c, t);
      midsFrom(t).forEach((m, k) => {
        mid.set(stack[k]!.id, m);
        at.set(stack[k]!.id, { c, b: stack[k]! });
      });
    }
    const highest = Math.min(0, ...columns.map((c) => top.get(c)!));
    const lowest = Math.max(0, ...columns.map((c) => top.get(c)! + stackH(stacks.get(c)!)));
    const height = Math.max(LANE_MIN_H, LANE_PAD * 2 + lowest - highest);
    // The middle line, so what the lane holds sits centred in it.
    const middle = y + (height - (lowest - highest)) / 2 - highest;
    for (const c of columns) {
      let sy = middle + top.get(c)!;
      const stack = stacks.get(c)!;
      for (const b of stack) {
        placed.push({ ...b, x: colX[c]! + (colW[c]! - b.width) / 2, y: sy });
        sy += b.height + gapOf(stack);
      }
    }
    laneRects.push({ y, height });
    y += height + LANE_GAP;
  });
  return { placed, laneRects, straight };
}

// Whether a straight run along the lane at `level` (from the middle line), from a feeder's column to column `c`, keeps
// clear of every box of the lane in the columns between.
const RUN_CLEAR = 12;
function clearRun(
  feeder: { c: number; b: BoxedElement },
  level: number,
  c: number,
  at: ReadonlyMap<string, { c: number; b: BoxedElement }>,
  mid: ReadonlyMap<string, number>,
): boolean {
  for (const [id, o] of at) {
    if (o.c <= feeder.c || o.c >= c) continue;
    const m = mid.get(id)!;
    if (Math.abs(m - level) < o.b.height / 2 + RUN_CLEAR) return false;
  }
  return true;
}

// Columns with the staircase (docs/specs/015-api/mcp-server.md §4.7 "Lanes stay compact and their decisions branch"):
// a hand-off to the next lane that is its step's only way out and its next step's only way in keeps its column, unless
// its step was itself reached by such a drop. One
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
  // Never two drops in a row: a step a drop arrived at takes its next hand-off a column on, so the staircase steps right
  // as it climbs or falls and the flow still reads left to right (four drops in a row stood the first steps in one
  // column, read top to bottom).
  const arrivedByDrop = new Set<string>();
  for (const id of ids)
    for (const k of [...level].filter((key) => key.startsWith(`${id}->`))) {
      if (arrivedByDrop.has(id)) level.delete(k);
      else arrivedByDrop.add(k.slice(id.length + 2));
    }
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
