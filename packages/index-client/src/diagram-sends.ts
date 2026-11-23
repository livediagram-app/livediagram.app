// Send to Diagram's wire (liveworkspace/docs/specs/004-index/send-to-diagram.md): words in any app drawn as a new
// livediagram diagram of the person's own. The graph an app's AI drafts, the ask the index takes, and the door's body.
// Shapes and their readers only; the route is the index's, the door livediagram's.

import { isApp, type App } from './constants';
import type { Item } from './types';

// The spec's Limits.
export const DIAGRAM_SEND_WORDS_MAX = 8_000;
export const DIAGRAM_SEND_NODES_MAX = 60;
export const DIAGRAM_SEND_EDGES_MAX = 120;
export const DIAGRAM_SEND_GROUPS_MAX = 12;
export const DIAGRAM_SEND_LABEL_MAX = 120;
export const DIAGRAM_SEND_NOTE_MAX = 400;
/** A source's newest sends one read takes, for its chips. */
export const DIAGRAM_SEND_READ_MAX = 200;
/** Distinct diagrams one read checks the reader's access on. */
export const DIAGRAM_SEND_DIAGRAMS_CHECKED_MAX = 20;

const ID_MAX = 64;
const ITEM_ID_MAX = 200;

/** The kinds the picker offers: Auto lets the model choose. */
export const DIAGRAM_SEND_KINDS = [
  'auto',
  'flowchart',
  'sequence',
  'mindmap',
  'orgchart',
  'architecture',
  'timeline',
] as const;
export type DiagramSendKind = (typeof DIAGRAM_SEND_KINDS)[number];

export const isDiagramSendKind = (v: unknown): v is DiagramSendKind =>
  typeof v === 'string' && (DIAGRAM_SEND_KINDS as readonly string[]).includes(v);

/** The box shapes a graph may name; anything else is drawn as a plain box. */
export const DIAGRAM_SEND_SHAPES = [
  'square',
  'circle',
  'diamond',
  'cylinder',
  'parallelogram',
  'hexagon',
  'document',
] as const;
export type DiagramSendShape = (typeof DIAGRAM_SEND_SHAPES)[number];

export type DiagramSendNode = {
  id: string;
  label: string;
  shape?: DiagramSendShape;
  note?: string;
  // A person's role: the node draws as an org chart's person card.
  role?: string;
  group?: string;
};

export type DiagramSendEdge = {
  from: string;
  to: string;
  label?: string;
  line?: 'solid' | 'dashed';
};

export type DiagramSendGroup = { id: string; label: string };

export type DiagramSendGraph = {
  title?: string;
  // `sequence`: the nodes are its participants and the edges its messages, in order.
  style?: 'flow' | 'tree' | 'mindmap' | 'sequence';
  direction?: 'down' | 'right';
  nodes: DiagramSendNode[];
  edges: DiagramSendEdge[];
  groups?: DiagramSendGroup[];
};

/** Where the words came from: the diagram's caption links back to it. */
export type DiagramSendSource = {
  app: App;
  itemId: string;
  tabId: string | null;
  elementId: string | null;
  // The place's name ("Onboarding" for a page), for the caption.
  label: string;
};

/** Where an existing diagram takes the graph: a new tab at its end, or (with `tabId`) that tab redrawn. */
export type DiagramSendTarget = { itemId: string; tabId?: string | null };

/** What the editor asks the index: a diagram (new, or a tab of one the person may edit), drawn from the graph. */
export type DiagramSendAsk = {
  name: string;
  graph: DiagramSendGraph;
  source: DiagramSendSource;
  target?: DiagramSendTarget;
};

/** One place's send, as its chip shows it: the diagram (its current name) and the tab drawn. */
export type DiagramSend = {
  id: string;
  // `tab:element` of the source place.
  ref: string;
  diagram: { id: string; title: string };
  tabId: string;
  // The diagram, opened on its tab.
  link: string;
  at: number;
};

export type DiagramSendAnswer = { item: Item; link: string; send: DiagramSend };
export type DiagramSendsRead = { sends: DiagramSend[] };

/** A place's key among a source's sends. */
export const diagramSendRef = (tabId: string | null, elementId: string | null): string =>
  `${tabId ?? ''}:${elementId ?? ''}`;

/** The element a send's ref names. */
export const diagramSendElement = (ref: string): string => ref.split(':')[1] ?? '';

/** What the index asks livediagram's door to make, for `owner`. */
export type DiagramFromGraphInput = {
  owner: string;
  name: string;
  graph: DiagramSendGraph;
  // The caption under the title, and the address it links to.
  caption: string;
  link: string;
  // An existing diagram: a new tab named `name` at its end, or `tabId` redrawn.
  itemId?: string;
  tabId?: string;
};

export const DIAGRAM_FROM_GRAPH_PATH = '/api/internal/items/from-graph';

const isRecord = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const clean = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string') return null;
  const s = v.replace(/\s+/g, ' ').trim();
  return s ? s.slice(0, max) : null;
};
const idOf = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() && v.length <= ID_MAX ? v.trim() : null;

/**
 * A graph as the index and the door take it, or null when it holds no box. Lenient where a model is loose (labels
 * cut to their caps, an unknown shape dropped, an edge to no node dropped, a repeated id kept once) and strict where
 * it matters (at most the caps of boxes, arrows and groups, every label plain text).
 */
export function readDiagramSendGraph(v: unknown): DiagramSendGraph | null {
  if (!isRecord(v) || !Array.isArray(v.nodes)) return null;
  // A sequence's messages may repeat between the same two, and it has no groups.
  const sequence = v.style === 'sequence';
  const groups: DiagramSendGroup[] = [];
  const groupIds = new Set<string>();
  if (Array.isArray(v.groups) && !sequence) {
    for (const g of v.groups) {
      if (groups.length >= DIAGRAM_SEND_GROUPS_MAX) break;
      if (!isRecord(g)) continue;
      const id = idOf(g.id);
      if (!id || groupIds.has(id)) continue;
      groupIds.add(id);
      groups.push({ id, label: clean(g.label, DIAGRAM_SEND_LABEL_MAX) ?? id });
    }
  }
  const nodes: DiagramSendNode[] = [];
  const nodeIds = new Set<string>();
  for (const n of v.nodes) {
    if (nodes.length >= DIAGRAM_SEND_NODES_MAX) break;
    if (!isRecord(n)) continue;
    const id = idOf(n.id);
    const label = clean(n.label, DIAGRAM_SEND_LABEL_MAX);
    if (!id || !label || nodeIds.has(id) || groupIds.has(id)) continue;
    nodeIds.add(id);
    const shape = (DIAGRAM_SEND_SHAPES as readonly unknown[]).includes(n.shape)
      ? (n.shape as DiagramSendShape)
      : undefined;
    const note = clean(n.note, DIAGRAM_SEND_NOTE_MAX);
    const role = clean(n.role, DIAGRAM_SEND_LABEL_MAX);
    const group = typeof n.group === 'string' && groupIds.has(n.group) ? n.group : undefined;
    nodes.push({
      id,
      label,
      ...(shape && shape !== 'square' ? { shape } : {}),
      ...(note ? { note } : {}),
      ...(role ? { role } : {}),
      ...(group ? { group } : {}),
    });
  }
  if (nodes.length === 0) return null;
  const edges: DiagramSendEdge[] = [];
  const seen = new Set<string>();
  if (Array.isArray(v.edges)) {
    for (const e of v.edges) {
      if (edges.length >= DIAGRAM_SEND_EDGES_MAX) break;
      if (!isRecord(e)) continue;
      const from = idOf(e.from);
      const to = idOf(e.to);
      if (!from || !to || from === to || !nodeIds.has(from) || !nodeIds.has(to)) continue;
      const key = `${from}\u0000${to}`;
      if (!sequence && seen.has(key)) continue;
      seen.add(key);
      const label = clean(e.label, DIAGRAM_SEND_LABEL_MAX);
      edges.push({
        from,
        to,
        ...(label ? { label } : {}),
        ...(e.line === 'dashed' ? { line: 'dashed' as const } : {}),
      });
    }
  }
  const title = clean(v.title, DIAGRAM_SEND_LABEL_MAX);
  const style =
    v.style === 'flow' || v.style === 'tree' || v.style === 'mindmap' || sequence
      ? (v.style as DiagramSendGraph['style'])
      : undefined;
  const direction = v.direction === 'down' || v.direction === 'right' ? v.direction : undefined;
  const used = new Set(nodes.map((n) => n.group).filter(Boolean));
  const kept = groups.filter((g) => used.has(g.id));
  return {
    ...(title ? { title } : {}),
    ...(style ? { style } : {}),
    ...(direction ? { direction } : {}),
    nodes,
    edges,
    ...(kept.length > 0 ? { groups: kept } : {}),
  };
}

function readSource(v: unknown): DiagramSendSource | null {
  if (!isRecord(v) || !isApp(v.app)) return null;
  if (typeof v.itemId !== 'string' || !v.itemId || v.itemId.length > ITEM_ID_MAX) return null;
  const optId = (x: unknown): string | null | undefined =>
    x === null || x === undefined
      ? null
      : typeof x === 'string' && x && x.length <= ITEM_ID_MAX
        ? x
        : undefined;
  const tabId = optId(v.tabId);
  const elementId = optId(v.elementId);
  if (tabId === undefined || elementId === undefined) return null;
  return {
    app: v.app,
    itemId: v.itemId,
    tabId,
    elementId,
    label: clean(v.label, DIAGRAM_SEND_LABEL_MAX) ?? '',
  };
}

const itemIdOf = (x: unknown): string | null =>
  typeof x === 'string' && x && x.length <= ITEM_ID_MAX ? x : null;

// `undefined` for no target, null for one that does not read.
function readTarget(v: unknown): DiagramSendTarget | null | undefined {
  if (v === undefined || v === null) return undefined;
  if (!isRecord(v)) return null;
  const itemId = itemIdOf(v.itemId);
  if (!itemId) return null;
  if (v.tabId === undefined || v.tabId === null) return { itemId };
  const tabId = itemIdOf(v.tabId);
  return tabId ? { itemId, tabId } : null;
}

/** The editor's ask as the index takes it, or null. */
export function readDiagramSendAsk(v: unknown): DiagramSendAsk | null {
  if (!isRecord(v)) return null;
  const name = clean(v.name, DIAGRAM_SEND_LABEL_MAX);
  const graph = readDiagramSendGraph(v.graph);
  const source = readSource(v.source);
  const target = readTarget(v.target);
  if (!name || !graph || !source || target === null) return null;
  return { name, graph, source, ...(target ? { target } : {}) };
}

/** The door's body as livediagram takes it, or null. */
export function readDiagramFromGraphInput(v: unknown): DiagramFromGraphInput | null {
  if (!isRecord(v) || typeof v.owner !== 'string' || !v.owner) return null;
  const name = clean(v.name, DIAGRAM_SEND_LABEL_MAX);
  const graph = readDiagramSendGraph(v.graph);
  const caption = clean(v.caption, DIAGRAM_SEND_LABEL_MAX * 2);
  const link =
    typeof v.link === 'string' && /^https?:\/\//.test(v.link) && v.link.length <= 2_000
      ? v.link
      : null;
  if (!name || !graph || !caption || !link) return null;
  const itemId = v.itemId === undefined ? undefined : itemIdOf(v.itemId);
  const tabId = v.tabId === undefined ? undefined : itemIdOf(v.tabId);
  if (itemId === null || tabId === null || (tabId && !itemId)) return null;
  return {
    owner: v.owner,
    name,
    graph,
    caption,
    link,
    ...(itemId ? { itemId } : {}),
    ...(tabId ? { tabId } : {}),
  };
}
