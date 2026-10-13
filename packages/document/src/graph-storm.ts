// Graph input's storm style (docs/specs/015-api/mcp-server.md §4.7, docs/specs/021-event-storming/event-storming.md
// "Agents"): an event-storming board from a graph of notes, laid out as a facilitator would leave the wall. Each node
// is a workshop note of its `esKind`; the edges say what leads to what (an actor issues a command, a command makes an
// event, a policy reacts to an event and issues the next command) and only place the notes: the board carries no
// arrows, adjacency is the notation.
//
// Time runs left to right, one column per domain event in the order the edges imply. A command, actor, read model,
// aggregate or external system joins the column of the event it leads to; a policy or hotspot the column of the event
// it follows; a note no event touches takes a column of its own in edge order. Each kind used takes a lane, in the
// method's reading order top to bottom, every note on its lane's centre line, real stationery: the catalogue's fill
// and silhouette, fixed size, text fitted, a slight hand-placed tilt, on the board's one layer.

import { createSticky } from './factories';
import {
  ES_BOARD_LAYER_ID,
  ES_MAX_TILT_DEG,
  eventStormingNote,
  eventStormingNoteSize,
  type EventStormingNoteKind,
} from './event-storming';
import { ES_LANES, ES_NOTE_GAP, laneCentre } from './event-storming-lanes';
import type { GraphEdge, GraphNode } from './graph-authoring';
import type { Element } from './index';

// The lanes, top to bottom: who and what they look at, what they ask for, what it acts on, what happened, how the
// business reacts, and the open questions underneath.
export const STORM_LANE_ORDER: readonly EventStormingNoteKind[] = [
  'actor',
  'read-model',
  'command',
  'aggregate',
  'external-system',
  'domain-event',
  'policy',
  'hotspot',
];

// Kinds that sit before the event they lead to, and those after the event they follow.
const LEADS: ReadonlySet<EventStormingNoteKind> = new Set([
  'actor',
  'read-model',
  'command',
  'aggregate',
  'external-system',
]);
// The space between two columns: a note's worth of the board's gutter, so each moment reads apart.
export const STORM_COLUMN_GAP = ES_NOTE_GAP * 3;

export type StormNode = GraphNode & { esKind?: string };

const isKind = (k: string | undefined): k is EventStormingNoteKind =>
  STORM_LANE_ORDER.includes(k as EventStormingNoteKind);

export function layoutStormGraph(graph: {
  nodes: readonly StormNode[];
  edges: readonly GraphEdge[];
}): Element[] {
  const kindOf = (n: StormNode): EventStormingNoteKind =>
    isKind(n.esKind) ? n.esKind : 'domain-event';
  const nodes = graph.nodes;
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const edges = graph.edges.filter((e) => e.from !== e.to && byId.has(e.from) && byId.has(e.to));
  // Edge order: a topological order with cycles cut where they close, input order breaking ties.
  const indeg = new Map(nodes.map((n) => [n.id, 0]));
  for (const e of edges) indeg.set(e.to, indeg.get(e.to)! + 1);
  const order: string[] = [];
  const queue = nodes.filter((n) => indeg.get(n.id) === 0).map((n) => n.id);
  const left = new Map(indeg);
  while (queue.length) {
    const id = queue.shift()!;
    order.push(id);
    for (const e of edges.filter((x) => x.from === id)) {
      left.set(e.to, left.get(e.to)! - 1);
      if (left.get(e.to) === 0) queue.push(e.to);
    }
  }
  for (const n of nodes) if (!order.includes(n.id)) order.push(n.id);
  const rank = new Map(order.map((id, i) => [id, i]));

  // The event a note belongs with: the nearest event downstream for a lead, upstream for a reaction.
  const nearestEvent = (id: string, down: boolean): string | null => {
    const seen = new Set([id]);
    let frontier = [id];
    while (frontier.length) {
      const next: string[] = [];
      for (const at of frontier)
        for (const e of edges) {
          const other = down ? (e.from === at ? e.to : null) : e.to === at ? e.from : null;
          if (!other || seen.has(other)) continue;
          if (kindOf(byId.get(other)!) === 'domain-event') return other;
          seen.add(other);
          next.push(other);
        }
      frontier = next.sort((a, b) => rank.get(a)! - rank.get(b)!);
    }
    return null;
  };
  // Columns: each event its own, in edge order; every other note with its event, or alone.
  const columnOf = new Map<string, string>();
  for (const id of order) {
    const n = byId.get(id)!;
    const kind = kindOf(n);
    if (kind === 'domain-event') {
      columnOf.set(id, id);
      continue;
    }
    const event = nearestEvent(id, LEADS.has(kind)) ?? nearestEvent(id, !LEADS.has(kind));
    columnOf.set(id, event ?? id);
  }
  const columns = [...new Set(order.map((id) => columnOf.get(id)!))].sort(
    (a, b) => rank.get(a)! - rank.get(b)!,
  );
  const lanes = STORM_LANE_ORDER.filter((k) => nodes.some((n) => kindOf(n) === k));
  const laneOf = (kind: EventStormingNoteKind) => lanes.indexOf(kind);

  // Each column as wide as its widest lane, notes sharing a lane and column side by side.
  const cell = (col: string, kind: EventStormingNoteKind) =>
    order.filter((id) => columnOf.get(id) === col && kindOf(byId.get(id)!) === kind);
  const widthOf = (ids: string[]) =>
    ids.reduce((w, id) => w + eventStormingNoteSize(kindOf(byId.get(id)!)).width, 0) +
    ES_NOTE_GAP * Math.max(0, ids.length - 1);
  const out: Element[] = [];
  let x = 0;
  let tilt = 0;
  for (const col of columns) {
    const width = Math.max(...lanes.map((k) => widthOf(cell(col, k))));
    for (const kind of lanes) {
      const ids = cell(col, kind);
      let cx = x + (width - widthOf(ids)) / 2;
      for (const id of ids) {
        const size = eventStormingNoteSize(kind);
        const centreY = laneCentre(laneOf(kind), ES_LANES);
        // A deterministic hand-placed tilt, alternating within the board's limit.
        const rotation = Number((((tilt++ % 5) - 2) * (ES_MAX_TILT_DEG / 2)).toFixed(2));
        out.push({
          ...createSticky(cx, centreY - size.height / 2),
          id,
          width: size.width,
          height: size.height,
          label: byId.get(id)!.label ?? '',
          fillColor: eventStormingNote(kind).fill,
          esKind: kind,
          fixedSize: true,
          textSize: 'scale',
          textAlignX: 'center',
          textAlignY: 'middle',
          layerId: ES_BOARD_LAYER_ID,
          ...(rotation ? { rotation } : {}),
          ...(byId.get(id)!.note ? { note: byId.get(id)!.note } : {}),
        });
        cx += size.width + ES_NOTE_GAP;
      }
    }
    x += width + STORM_COLUMN_GAP;
  }
  return out;
}
