// View As Diagram's graph (docs/specs/026-plan/view-as-diagram.md "What is drawn"; liveworkspace's
// diagrams-and-plans.md "The graph"): a board's cards as boxes in their columns' lanes, its Blocked By links as arrows,
// and the critical path, worked out once from the board's projection. Pure, and linear in cards plus links but for
// the projection's own sort, so a 500-card board draws in a few milliseconds (plan-diagram-graph.perf.test.ts).
import type { Item } from './item';
import { itemTitle } from './item';
import { projectBoard } from './board';
import { blockerIdsOf } from './blocked-by';
import type { PlanBoardSetup, QuickFilter } from './board-model';
import { isDoneColumn } from './done-columns';
import type { ItemTypeDef } from './item-types';
import { typeIn } from './type-catalogue';
import { cardRefTitle } from './card-prefix';
import { dayNumber } from './plan-view-dates';

export const PLAN_GRAPH_CARDS_MAX = 500;
export const PLAN_GRAPH_LINKS_MAX = 1_000;
export const PLAN_GRAPH_LABEL_MAX = 120;

export type PlanGraphLane = { id: string; label: string };
export type PlanGraphNode = {
  card: string;
  label: string;
  lane: string;
  done: boolean;
  critical: boolean;
  link: string;
};
export type PlanGraphEdge = { from: string; to: string; critical: boolean };
export type PlanGraph = {
  title: string;
  lanes: PlanGraphLane[];
  nodes: PlanGraphNode[];
  edges: PlanGraphEdge[];
  total: number;
};

const cutLabel = (s: string) =>
  s.length > PLAN_GRAPH_LABEL_MAX ? `${s.slice(0, PLAN_GRAPH_LABEL_MAX - 1).trimEnd()}…` : s;

// A card's weight on the critical path: its days from Start to Due, one when it has neither or they run backwards.
function daysOf(item: Item): number {
  const start = dayNumber(item.fields['start']);
  const due = dayNumber(item.fields['due']);
  if (start === undefined || due === undefined || due < start) return 1;
  return due - start + 1;
}

/**
 * The critical path: the heaviest chain of open cards through their links (`from` blocks `to`), each card weighing
 * `weight(id)`. One topological pass (Kahn's) over the open cards; a card in a loop (which writes refuse, but stored
 * data may hold) is never reached, so it is never critical. Answers the chain's cards in order, or none when no card
 * blocks another.
 */
export function criticalPathOf(
  ids: readonly string[],
  edges: readonly { from: string; to: string }[],
  weight: (id: string) => number,
): string[] {
  if (edges.length === 0) return [];
  const inDegree = new Map<string, number>(ids.map((id) => [id, 0]));
  const out = new Map<string, string[]>();
  for (const e of edges) {
    if (!inDegree.has(e.from) || !inDegree.has(e.to)) continue;
    inDegree.set(e.to, inDegree.get(e.to)! + 1);
    const list = out.get(e.from);
    if (list) list.push(e.to);
    else out.set(e.from, [e.to]);
  }
  const best = new Map<string, number>();
  const prev = new Map<string, string>();
  const queue: string[] = [];
  for (const id of ids)
    if (inDegree.get(id) === 0) {
      queue.push(id);
      best.set(id, weight(id));
    }
  for (let head = 0; head < queue.length; head++) {
    const id = queue[head]!;
    const here = best.get(id)!;
    for (const next of out.get(id) ?? []) {
      const through = here + weight(next);
      if (through > (best.get(next) ?? -1)) {
        best.set(next, through);
        prev.set(next, id);
      }
      const left = inDegree.get(next)! - 1;
      inDegree.set(next, left);
      if (left === 0) queue.push(next);
    }
  }
  let end: string | undefined;
  for (const id of queue) if (end === undefined || best.get(id)! > best.get(end)!) end = id;
  if (end === undefined || !prev.has(end)) return [];
  const chain: string[] = [end];
  for (let at = prev.get(end); at !== undefined; at = prev.get(at)) chain.push(at);
  return chain.reverse();
}

export type PlanGraphInput = {
  setup: PlanBoardSetup;
  items: ReadonlyMap<string, Item>;
  types: readonly ItemTypeDef[];
  // The board's own filter as it reads for this person today; none draws every card.
  quick?: QuickFilter;
  // The card's address.
  link: (cardId: string) => string;
  max?: number;
};

/** The board as a graph: lanes in column order (those holding a drawn card), boxes in board order, arrows, the path. */
export function planDiagramGraph({
  setup,
  items,
  types,
  quick,
  link,
  max = PLAN_GRAPH_CARDS_MAX,
}: PlanGraphInput): PlanGraph {
  const projection = projectBoard(setup, items, quick, types);
  const placed: { item: Item; lane: string; done: boolean }[] = [];
  const lanes: PlanGraphLane[] = [];
  let total = 0;
  projection.columns.forEach((col, i) => {
    // A lane's id is its column's place on the board: always safe inside an element id.
    const lane = `c${i}`;
    const done = isDoneColumn(setup, col.column);
    const seen = new Set<string>();
    let any = false;
    for (const l of col.lanes)
      for (const item of l.items) {
        if (seen.has(item.id)) continue;
        seen.add(item.id);
        total += 1;
        if (placed.length >= max) continue;
        placed.push({ item, lane, done });
        any = true;
      }
    if (any) lanes.push({ id: lane, label: cutLabel(col.column.name || 'Untitled') });
  });
  const drawn = new Set(placed.map((p) => p.item.id));
  const edges: PlanGraphEdge[] = [];
  for (const { item } of placed) {
    for (const blocker of blockerIdsOf(item, typeIn(types, item.type))) {
      if (!drawn.has(blocker) || edges.length >= PLAN_GRAPH_LINKS_MAX) continue;
      edges.push({ from: blocker, to: item.id, critical: false });
    }
  }
  const open = placed.filter((p) => !p.done).map((p) => p.item.id);
  const openSet = new Set(open);
  const path = criticalPathOf(
    open,
    edges.filter((e) => openSet.has(e.from) && openSet.has(e.to)),
    (id) => daysOf(items.get(id)!),
  );
  const onPath = new Set(path);
  const pathLinks = new Set(path.slice(1).map((id, i) => `${path[i]}>${id}`));
  for (const e of edges) e.critical = pathLinks.has(`${e.from}>${e.to}`);
  const nodes: PlanGraphNode[] = placed.map(({ item, lane, done }) => ({
    card: item.id,
    label: cutLabel(cardRefTitle(item, itemTitle(item).trim() || 'Untitled', types)),
    lane,
    done,
    critical: onPath.has(item.id),
    link: link(item.id),
  }));
  return { title: cutLabel(setup.title.trim() || 'Board'), lanes, nodes, edges, total };
}

/** The critical path's cards in order, by their drawn labels: what the dialog's preview names. */
export function criticalPathLabels(graph: PlanGraph): string[] {
  const byId = new Map(graph.nodes.map((n) => [n.card, n]));
  const critical = graph.nodes.filter((n) => n.critical).map((n) => n.card);
  if (critical.length === 0) return [];
  const next = new Map<string, string>();
  const hasPrev = new Set<string>();
  for (const e of graph.edges)
    if (e.critical) {
      next.set(e.from, e.to);
      hasPrev.add(e.to);
    }
  const start = critical.find((id) => !hasPrev.has(id));
  const out: string[] = [];
  for (let at = start; at !== undefined && out.length < critical.length; at = next.get(at))
    out.push(byId.get(at)!.label);
  return out;
}

/** A graph's fingerprint: what a redraw compares, so a change that alters nothing drawn draws nothing. */
export function planGraphHash(graph: PlanGraph): string {
  // FNV-1a over the JSON: cheap, and the graph is capped.
  const text = JSON.stringify(graph);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193);
  return `${(hash >>> 0).toString(16)}:${text.length}`;
}
