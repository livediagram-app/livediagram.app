// Diagrams and Plans' wire (liveworkspace/docs/specs/004-index/diagrams-and-plans.md, blueprint diagrams-and-plans.md):
// Make Plan Cards (a diagram's shapes made cards, as the person), View As Diagram (a board drawn as a live diagram), the
// changes a drawn diagram offers back, and the doors each app opens to the index for them. Shapes and their readers
// only, every reader a capped walk; the routes are the index's, the doors liveplanner's and livediagram's.

import { isPlanDay, type PlanSend, type SentFrom } from './plan-sends';

// The spec's Limits.
export const PLAN_MAKE_CARDS_MAX = 500;
export const PLAN_MAKE_LINKS_MAX = 1_000;
export const PLAN_VIEW_CARDS_MAX = 500;
export const PLAN_VIEW_LINKS_MAX = 1_000;
export const PLAN_VIEWS_PER_PLAN_MAX = 10;
export const PLAN_VIEW_SETTLE_MS = 2_000;
export const PLAN_EDITS_MAX = 20;
export const PLAN_DIAGRAM_LABEL_MAX = 120;
export const PLAN_MAKE_TITLE_MAX = 200;
export const PLAN_MAKE_TEXT_MAX = 2_000;
export const PLAN_MAKE_LABELS_MAX = 12;
export const PLAN_MAKE_LABEL_MAX = 32;
const ID_MAX = 200;
const NAME_MAX = 120;

/** One card a shape makes (or updates): `element` is the shape's id, its key in the ask. */
export type PlanMakeCard = {
  element: string;
  title: string;
  text: string;
  // A board column's name; absent, the ask's column.
  column?: string;
  labels?: string[];
  start?: string;
  due?: string;
  // The elements of the shapes this one waits on, in the same ask.
  blockedBy?: string[];
};

export type PlanMakeSource = { itemId: string; tabId: string; label: string };

export type PlanMakeAsk = {
  board: string;
  column: string;
  source: PlanMakeSource;
  cards: PlanMakeCard[];
  // Live cards this source's earlier sends made in this plan, to move to the Trash.
  trash?: string[];
};

export type PlanMakeAnswer = {
  sends: PlanSend[];
  made: number;
  updated: number;
  trashed: number;
  // Blocked By links left out because they would close a loop.
  skipped: number;
};

/** A lane of a drawn board: a column holding a drawn card. */
export type PlanDiagramLane = { id: string; label: string };

/** A drawn card: its box, the lane it sits in, and whether it is done or on the critical path. */
export type PlanDiagramNode = {
  card: string;
  label: string;
  lane: string;
  done: boolean;
  critical: boolean;
  // The card's own address in liveplanner.
  link: string;
};

/** A Blocked By link between two drawn cards: from the blocker to the card that waits. */
export type PlanDiagramEdge = { from: string; to: string; critical: boolean };

export type PlanDiagramGraph = {
  // The board's title: the drawing's heading.
  title: string;
  lanes: PlanDiagramLane[];
  nodes: PlanDiagramNode[];
  edges: PlanDiagramEdge[];
  // How many cards the board (or its filter) holds: more than `nodes` when the draw was cut at PLAN_VIEW_CARDS_MAX.
  total: number;
};

export type PlanViewAsk = {
  board: string;
  // Only the cards the board's own filter shows.
  filtered?: boolean;
  name: string;
};

export type PlanViewAnswer = {
  // `link` opens the diagram on its drawn tab in livediagram.
  diagram: { id: string; title: string; tabId: string; link: string };
  cards: number;
  links: number;
  critical: number;
};

export type PlanEdit =
  { kind: 'block'; card: string; blocker: string } | { kind: 'move'; card: string; column: string };

export type PlanEditResult = { status: 'applied' } | { status: 'refused'; reason: string };

export type PlanEditsAnswer = { results: PlanEditResult[] };

/** liveplanner's door: one call, one op, the person's grant in X-Index-Grant. */
export type PlanDiagramDoorCall =
  | {
      op: 'make';
      person: string;
      board: string;
      column: string;
      cards: (Omit<PlanMakeCard, 'text'> & {
        // The card this shape made before, when it is still live: updated, never made again.
        cardId?: string;
        description: string;
        sentFrom: SentFrom;
      })[];
      trash: string[];
    }
  | { op: 'graph'; person: string; board: string; filtered: boolean }
  | {
      op: 'watch';
      person: string;
      board: string;
      filtered: boolean;
      diagramId: string;
      tabId: string;
    }
  | { op: 'edit'; person: string; edits: PlanEdit[] };

export type PlanMakeDoorAnswer =
  | {
      ok: true;
      cards: {
        element: string;
        id: string;
        title: string;
        column: string;
        done: boolean;
        made: boolean;
      }[];
      trashed: number;
      skipped: number;
    }
  | { ok: false; code: 'target_gone' | 'invalid' | 'full' | 'failed'; reason: string };

export type PlanGraphDoorAnswer =
  | { ok: true; graph: PlanDiagramGraph; title: string }
  | { ok: false; code: 'target_gone' | 'failed'; reason: string };

/** livediagram's door: a new diagram of `owner`'s drawn from the graph, or (`itemId`, `tabId`) that tab redrawn. */
export type PlanDiagramDraw = {
  owner: string;
  name: string;
  graph: PlanDiagramGraph;
  // The line under the title, linked to the plan's board.
  caption: string;
  link: string;
  itemId?: string;
  tabId?: string;
};

/** One live view liveplanner asks the index to redraw: the diagram's tab, its maker, the board's graph now. */
export type PlanViewRedraw = {
  diagramId: string;
  tabId: string;
  person: string;
  graph: PlanDiagramGraph;
};

export type PlanViewRedrawStatus = 'ok' | 'gone' | 'failed';

export const planDiagramDoorPath = (itemId: string): string =>
  `/api/internal/items/${encodeURIComponent(itemId)}/plan-diagram`;

/** The element id livediagram gives a drawn card's box, a lane and a Blocked By arrow. */
export const planCardElementId = (lane: string, card: string): string => `card:${lane}:${card}`;
export const planLaneElementId = (lane: string): string => `lane:${lane}`;
export const planDepElementId = (blocker: string, card: string): string => `dep:${blocker}:${card}`;

/** A drawn element's id read back: what card or lane it is, or null for anything a person drew. */
export function readPlanElementId(
  id: string,
):
  | { kind: 'card'; lane: string; card: string }
  | { kind: 'lane'; lane: string }
  | { kind: 'dep'; blocker: string; card: string }
  | null {
  const parts = id.split(':');
  if (parts[0] === 'card' && parts.length === 3 && parts[1] && parts[2])
    return { kind: 'card', lane: parts[1], card: parts[2] };
  if (parts[0] === 'lane' && parts.length === 2 && parts[1])
    return { kind: 'lane', lane: parts[1] };
  if (parts[0] === 'dep' && parts.length === 3 && parts[1] && parts[2])
    return { kind: 'dep', blocker: parts[1], card: parts[2] };
  return null;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown, max: number): v is string => typeof v === 'string' && v.length <= max;
// An id that can sit inside an element id: no colon, never empty.
const id = (v: unknown, max = ID_MAX): v is string => text(v, max) && v !== '' && !v.includes(':');
const idList = (v: unknown, max: number): v is string[] =>
  Array.isArray(v) && v.length <= max && v.every((x) => id(x));

function readMakeCard(v: unknown): PlanMakeCard | null {
  if (!isRecord(v) || !id(v.element) || !text(v.title, PLAN_MAKE_TITLE_MAX) || !v.title.trim())
    return null;
  if (!text(v.text, PLAN_MAKE_TEXT_MAX)) return null;
  if (v.column !== undefined && (!text(v.column, NAME_MAX) || !v.column.trim())) return null;
  if (
    v.labels !== undefined &&
    !(
      Array.isArray(v.labels) &&
      v.labels.length <= PLAN_MAKE_LABELS_MAX &&
      v.labels.every((l) => text(l, PLAN_MAKE_LABEL_MAX) && l.trim() !== '')
    )
  )
    return null;
  if (v.start !== undefined && !isPlanDay(v.start)) return null;
  if (v.due !== undefined && !isPlanDay(v.due)) return null;
  if (v.blockedBy !== undefined && !idList(v.blockedBy, PLAN_MAKE_CARDS_MAX)) return null;
  return {
    element: v.element,
    title: v.title.trim(),
    text: v.text,
    ...(v.column ? { column: v.column } : {}),
    ...(v.labels ? { labels: v.labels as string[] } : {}),
    ...(v.start ? { start: v.start } : {}),
    ...(v.due ? { due: v.due } : {}),
    ...(v.blockedBy && (v.blockedBy as string[]).length
      ? { blockedBy: v.blockedBy as string[] }
      : {}),
  };
}

/** A make's body, or null when anything is over a cap, of the wrong type, or names a shape twice. */
export function readPlanMakeAsk(raw: unknown): PlanMakeAsk | null {
  if (!isRecord(raw) || !id(raw.board) || !text(raw.column, NAME_MAX)) return null;
  const s = raw.source;
  if (!isRecord(s) || !id(s.itemId) || !id(s.tabId) || !text(s.label, NAME_MAX)) return null;
  if (!Array.isArray(raw.cards) || raw.cards.length > PLAN_MAKE_CARDS_MAX) return null;
  const trash = raw.trash === undefined ? [] : raw.trash;
  if (!idList(trash, PLAN_MAKE_CARDS_MAX)) return null;
  if (raw.cards.length === 0 && trash.length === 0) return null;
  const cards: PlanMakeCard[] = [];
  const seen = new Set<string>();
  let links = 0;
  for (const c of raw.cards) {
    const card = readMakeCard(c);
    if (!card || seen.has(card.element)) return null;
    seen.add(card.element);
    links += card.blockedBy?.length ?? 0;
    cards.push(card);
  }
  if (links > PLAN_MAKE_LINKS_MAX) return null;
  // A link names a shape in this ask, never itself.
  for (const c of cards) if (c.blockedBy?.some((b) => b === c.element || !seen.has(b))) return null;
  return {
    board: raw.board,
    column: raw.column,
    source: { itemId: s.itemId, tabId: s.tabId, label: s.label },
    cards,
    ...(trash.length ? { trash: [...new Set(trash)] } : {}),
  };
}

/** A view's body, or null. */
export function readPlanViewAsk(raw: unknown): PlanViewAsk | null {
  if (!isRecord(raw) || !id(raw.board) || !text(raw.name, NAME_MAX) || !raw.name.trim())
    return null;
  if (raw.filtered !== undefined && typeof raw.filtered !== 'boolean') return null;
  return { board: raw.board, name: raw.name.trim(), ...(raw.filtered ? { filtered: true } : {}) };
}

function readEdit(v: unknown): PlanEdit | null {
  if (!isRecord(v) || !id(v.card)) return null;
  if (v.kind === 'block' && id(v.blocker) && v.blocker !== v.card)
    return { kind: 'block', card: v.card, blocker: v.blocker };
  if (v.kind === 'move' && text(v.column, NAME_MAX) && v.column.trim())
    return { kind: 'move', card: v.card, column: v.column };
  return null;
}

/** The edits a diagram offers, or null. */
export function readPlanEdits(raw: unknown): PlanEdit[] | null {
  const edits = isRecord(raw) ? raw.edits : null;
  if (!Array.isArray(edits) || edits.length === 0 || edits.length > PLAN_EDITS_MAX) return null;
  const read = edits.map(readEdit);
  return read.some((e) => !e) ? null : (read as PlanEdit[]);
}

const isWebLink = (v: unknown): v is string => text(v, 2048) && /^https?:\/\//.test(v);

/** A drawn board's graph, or null when anything is over a cap or names what is not in it. */
export function readPlanDiagramGraph(raw: unknown): PlanDiagramGraph | null {
  if (!isRecord(raw) || !Array.isArray(raw.lanes) || !Array.isArray(raw.nodes)) return null;
  if (!text(raw.title, PLAN_DIAGRAM_LABEL_MAX)) return null;
  if (!Array.isArray(raw.edges) || !Number.isInteger(raw.total) || (raw.total as number) < 0)
    return null;
  if (raw.nodes.length > PLAN_VIEW_CARDS_MAX || raw.edges.length > PLAN_VIEW_LINKS_MAX) return null;
  if (raw.lanes.length > PLAN_VIEW_CARDS_MAX) return null;
  const lanes: PlanDiagramLane[] = [];
  const laneIds = new Set<string>();
  for (const l of raw.lanes) {
    if (!isRecord(l) || !id(l.id) || !text(l.label, PLAN_DIAGRAM_LABEL_MAX) || laneIds.has(l.id))
      return null;
    laneIds.add(l.id);
    lanes.push({ id: l.id, label: l.label });
  }
  const nodes: PlanDiagramNode[] = [];
  const cards = new Set<string>();
  for (const n of raw.nodes) {
    if (!isRecord(n) || !id(n.card) || cards.has(n.card) || !text(n.label, PLAN_DIAGRAM_LABEL_MAX))
      return null;
    if (typeof n.lane !== 'string' || !laneIds.has(n.lane)) return null;
    if (typeof n.done !== 'boolean' || typeof n.critical !== 'boolean' || !isWebLink(n.link))
      return null;
    cards.add(n.card);
    nodes.push({
      card: n.card,
      label: n.label,
      lane: n.lane,
      done: n.done,
      critical: n.critical,
      link: n.link,
    });
  }
  const edges: PlanDiagramEdge[] = [];
  for (const e of raw.edges) {
    if (!isRecord(e) || typeof e.from !== 'string' || typeof e.to !== 'string') return null;
    if (!cards.has(e.from) || !cards.has(e.to) || e.from === e.to) return null;
    if (typeof e.critical !== 'boolean') return null;
    edges.push({ from: e.from, to: e.to, critical: e.critical });
  }
  return {
    title: raw.title,
    lanes,
    nodes,
    edges,
    total: Math.max(raw.total as number, nodes.length),
  };
}

/** livediagram's draw call, or null. */
export function readPlanDiagramDraw(raw: unknown): PlanDiagramDraw | null {
  if (!isRecord(raw) || !id(raw.owner) || !text(raw.name, NAME_MAX) || !raw.name.trim())
    return null;
  if (!text(raw.caption, PLAN_DIAGRAM_LABEL_MAX * 2) || !isWebLink(raw.link)) return null;
  const graph = readPlanDiagramGraph(raw.graph);
  if (!graph) return null;
  if ((raw.itemId === undefined) !== (raw.tabId === undefined)) return null;
  if (raw.itemId !== undefined && (!id(raw.itemId) || !id(raw.tabId))) return null;
  return {
    owner: raw.owner,
    name: raw.name.trim(),
    graph,
    caption: raw.caption,
    link: raw.link,
    ...(raw.itemId ? { itemId: raw.itemId as string, tabId: raw.tabId as string } : {}),
  };
}

/** liveplanner's redraw call's views, or null. */
export function readPlanViewRedraws(raw: unknown): PlanViewRedraw[] | null {
  const views = isRecord(raw) ? raw.views : null;
  if (!Array.isArray(views) || views.length === 0 || views.length > PLAN_VIEWS_PER_PLAN_MAX)
    return null;
  const out: PlanViewRedraw[] = [];
  for (const v of views) {
    if (!isRecord(v) || !id(v.diagramId) || !id(v.tabId) || !id(v.person)) return null;
    const graph = readPlanDiagramGraph(v.graph);
    if (!graph) return null;
    out.push({ diagramId: v.diagramId, tabId: v.tabId, person: v.person, graph });
  }
  return out;
}

/** liveplanner's door call, or null. Each op's own fields are read here; the make's Sent From by its own reader. */
export function readPlanDiagramDoorCall(
  raw: unknown,
  readSentFrom: (v: unknown) => SentFrom | null,
): PlanDiagramDoorCall | null {
  if (!isRecord(raw) || !id(raw.person)) return null;
  const person = raw.person;
  if (raw.op === 'graph' || raw.op === 'watch') {
    if (!id(raw.board) || typeof raw.filtered !== 'boolean') return null;
    if (raw.op === 'graph')
      return { op: 'graph', person, board: raw.board, filtered: raw.filtered };
    if (!id(raw.diagramId) || !id(raw.tabId)) return null;
    return {
      op: 'watch',
      person,
      board: raw.board,
      filtered: raw.filtered,
      diagramId: raw.diagramId,
      tabId: raw.tabId,
    };
  }
  if (raw.op === 'edit') {
    const edits = readPlanEdits(raw);
    return edits ? { op: 'edit', person, edits } : null;
  }
  if (raw.op !== 'make' || !id(raw.board) || !text(raw.column, NAME_MAX)) return null;
  if (!Array.isArray(raw.cards) || raw.cards.length > PLAN_MAKE_CARDS_MAX) return null;
  if (!idList(raw.trash, PLAN_MAKE_CARDS_MAX)) return null;
  const cards: Extract<PlanDiagramDoorCall, { op: 'make' }>['cards'] = [];
  for (const c of raw.cards) {
    if (!isRecord(c)) return null;
    const card = readMakeCard({ ...c, text: '' });
    const sentFrom = readSentFrom(c.sentFrom);
    if (!card || !sentFrom || !text(c.description, PLAN_MAKE_TEXT_MAX * 2)) return null;
    if (c.cardId !== undefined && !id(c.cardId)) return null;
    const { text: _text, ...rest } = card;
    cards.push({
      ...rest,
      ...(c.cardId ? { cardId: c.cardId as string } : {}),
      description: c.description,
      sentFrom,
    });
  }
  return { op: 'make', person, board: raw.board, column: raw.column, cards, trash: raw.trash };
}
