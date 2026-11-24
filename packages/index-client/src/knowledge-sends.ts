// Send to Knowledge Base's wire (liveworkspace/docs/specs/004-index/send-to-knowledge.md; blueprint
// send-to-knowledge.md): a selection in one app documented on a liveknowledge page. The selection the source app
// captures, the model's material made from it and the list written without a summary, the ask the index takes, the
// door's call and answer, and the reads for both sides' chips. Shapes and their readers only: pure and linear.

import { isApp, type App } from './constants';

// The spec's Limits.
export const KNOWLEDGE_SEND_ITEMS_MAX = 80;
export const KNOWLEDGE_SEND_LINKS_MAX = 120;
export const KNOWLEDGE_SEND_TEXT_MAX = 12_000;
export const KNOWLEDGE_SEND_LABEL_MAX = 300;
export const KNOWLEDGE_SEND_NOTE_MAX = 600;
export const KNOWLEDGE_SEND_KIND_MAX = 40;
export const KNOWLEDGE_SEND_FOCUS_MAX = 300;
export const KNOWLEDGE_SEND_SUMMARY_MAX = 6_000;
export const KNOWLEDGE_SEND_MARKDOWN_MAX = 12_000;
export const KNOWLEDGE_SEND_HEADING_MAX = 200;
export const KNOWLEDGE_SEND_PICTURE_BYTES_MAX = 300_000;
/** The most pixels a side of the picture may be. */
export const KNOWLEDGE_SEND_PICTURE_SIDE_MAX = 4_096;
/** A source's, or a knowledgebase's, newest sends one read takes. */
export const KNOWLEDGE_SEND_READ_MAX = 200;
/** Distinct items one read checks the reader's access on. */
export const KNOWLEDGE_SEND_ITEMS_CHECKED_MAX = 20;
/** The longest base64 a picture of at most KNOWLEDGE_SEND_PICTURE_BYTES_MAX bytes takes. */
export const KNOWLEDGE_SEND_PICTURE_BASE64_MAX =
  Math.ceil(KNOWLEDGE_SEND_PICTURE_BYTES_MAX / 3) * 4;

const ID_MAX = 200;

/** One element of the selection, as the person sees it. `in`: the picked frame it sits in. */
export type KnowledgeSendItem = {
  id: string;
  kind: string;
  label: string;
  note?: string;
  in?: string;
};
/** One arrow: its ends' item ids, or null for an end outside the selection (never named). */
export type KnowledgeSendLink = { from: string | null; to: string | null; label?: string };
/** What the source app sends for a summary. `cut`: the editor left items out to keep to the caps. */
export type KnowledgeSendSelection = {
  items: KnowledgeSendItem[];
  links: KnowledgeSendLink[];
  cut?: boolean;
};

/** Where the section goes: an existing page (at its end, or at the end of a heading's part), or a new page. */
export type KnowledgeSendPlace =
  { page: string; after?: string } | { newPage: { title: string; parent: string | null } };

/** The picture of the selection: a PNG, base64, and its size in pixels. */
export type KnowledgeSendPicture = { png: string; width: number; height: number };

export type KnowledgeSendSource = {
  app: App;
  itemId: string;
  tabId: string | null;
  elementIds: string[];
};

/** What the editor asks the index: the section, written on a page of the knowledgebase as the person. */
export type KnowledgeSendAsk = {
  knowledgebase: string;
  place: KnowledgeSendPlace;
  heading: string;
  markdown: string;
  picture?: KnowledgeSendPicture;
  source: KnowledgeSendSource;
};

/** One send, as the source's chips show it. */
export type KnowledgeSend = {
  id: string;
  tabId: string;
  elementIds: string[];
  knowledgebase: { id: string; title: string };
  page: { id: string; title: string };
  // The page in liveknowledge.
  link: string;
  at: number;
};

/** One send a knowledgebase received, as its pages' Sent From chips show it. */
export type KnowledgeReceived = {
  id: string;
  page: string;
  // The link back the Sent From line holds.
  place: string;
  source: { app: App; id: string; title: string };
};

export type KnowledgeSendAnswer = { send: KnowledgeSend; link: string };
export type KnowledgeSendsRead = { sends: KnowledgeSend[] };
export type KnowledgeReceivedRead = { received: KnowledgeReceived[] };
export type KnowledgeHeading = { id: string; level: 1 | 2 | 3; text: string };
export type KnowledgeOutlineRead = { headings: KnowledgeHeading[] };

/** Where the Sent From line links back to, and what it says. */
export type KnowledgeSentFrom = { app: App; title: string; link: string };

/** The door's call (POST /api/internal/items/:kb/knowledge-send), with the person's grant. */
export type KnowledgeSendDoorCall =
  | { op: 'outline'; person: string; page: string }
  | {
      op: 'write';
      person: string;
      place: KnowledgeSendPlace;
      heading: string;
      markdown: string;
      picture?: KnowledgeSendPicture;
      sentFrom: KnowledgeSentFrom;
    };

export type KnowledgeSendDoorAnswer =
  | { ok: true; page: { id: string; title: string }; link: string }
  | { ok: true; headings: KnowledgeHeading[] }
  | { ok: false; code: string; reason: string };

export const knowledgeSendDoorPath = (kbId: string): string =>
  `/api/internal/items/${encodeURIComponent(kbId)}/knowledge-send`;

/** What liveknowledge asks the index to record for an agent's write with a source (`POST /app/items/:kb/knowledge-sends`). */
export type AgentKnowledgeSend = {
  person: string;
  source: { app: App; itemId: string; tabId: string | null; elementIds: string[] };
  page: { id: string; title: string };
};

const isRecord = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
// Whitespace runs to one space, by hand: a regular expression over a model's or a person's text is never needed here.
function oneLine(v: string): string {
  let out = '';
  let space = false;
  for (const ch of v) {
    if (ch === ' ' || ch === '\n' || ch === '\t' || ch === '\r') {
      space = out.length > 0;
      continue;
    }
    if (space) out += ' ';
    space = false;
    out += ch;
  }
  return out;
}
const clean = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string') return null;
  const s = oneLine(v.slice(0, max * 4));
  return s ? s.slice(0, max) : null;
};
const idOf = (v: unknown): string | null =>
  typeof v === 'string' && v.length > 0 && v.length <= ID_MAX ? v : null;

/**
 * A selection as a server takes it, or null when it holds no item. Cut to the caps (items, arrows, characters in
 * all), a repeated id kept once, an arrow end naming no item read as outside the selection, an `in` naming no item
 * dropped.
 */
export function readKnowledgeSendSelection(v: unknown): KnowledgeSendSelection | null {
  if (!isRecord(v) || !Array.isArray(v.items)) return null;
  const items: KnowledgeSendItem[] = [];
  const ids = new Set<string>();
  let chars = 0;
  let cut = v.cut === true;
  for (const raw of v.items) {
    if (items.length >= KNOWLEDGE_SEND_ITEMS_MAX) {
      cut = true;
      break;
    }
    if (!isRecord(raw)) continue;
    const id = idOf(raw.id);
    if (!id || ids.has(id)) continue;
    const kind = clean(raw.kind, KNOWLEDGE_SEND_KIND_MAX) ?? 'item';
    const label = clean(raw.label, KNOWLEDGE_SEND_LABEL_MAX) ?? '';
    const note = clean(raw.note, KNOWLEDGE_SEND_NOTE_MAX);
    const size = kind.length + label.length + (note?.length ?? 0);
    if (chars + size > KNOWLEDGE_SEND_TEXT_MAX) {
      cut = true;
      break;
    }
    chars += size;
    ids.add(id);
    items.push({
      id,
      kind,
      label,
      ...(note ? { note } : {}),
      ...(typeof raw.in === 'string' ? { in: raw.in } : {}),
    });
  }
  if (items.length === 0) return null;
  // A frame named that is not sent is no frame here.
  for (const item of items) if (item.in !== undefined && !ids.has(item.in)) delete item.in;
  const links: KnowledgeSendLink[] = [];
  if (Array.isArray(v.links)) {
    for (const raw of v.links) {
      if (links.length >= KNOWLEDGE_SEND_LINKS_MAX) {
        cut = true;
        break;
      }
      if (!isRecord(raw)) continue;
      const end = (x: unknown) => {
        const id = idOf(x);
        return id && ids.has(id) ? id : null;
      };
      const from = end(raw.from);
      const to = end(raw.to);
      // An arrow with neither end picked says nothing about the selection.
      if (from === null && to === null) continue;
      const label = clean(raw.label, KNOWLEDGE_SEND_LABEL_MAX);
      links.push({ from, to, ...(label ? { label } : {}) });
    }
  }
  return { items, links, ...(cut ? { cut: true } : {}) };
}

const quoted = (s: string) => `"${s.replaceAll('"', "'")}"`;

/**
 * The selection as the model reads it: one line an item, then one an arrow, each item by its number. Never more than
 * the selection holds; an end outside it is said as such and never named.
 */
export function knowledgeSelectionText(selection: KnowledgeSendSelection): string {
  const number = new Map(selection.items.map((item, i) => [item.id, i + 1]));
  const lines: string[] = ['Items:'];
  for (const item of selection.items) {
    const n = number.get(item.id)!;
    let line = `[${n}] ${item.kind}`;
    if (item.label) line += ` ${quoted(item.label)}`;
    if (item.note) line += ` (note: ${quoted(item.note)})`;
    if (item.in !== undefined) line += ` inside [${number.get(item.in)}]`;
    lines.push(line);
  }
  if (selection.links.length > 0) {
    lines.push('', 'Arrows:');
    const end = (id: string | null) =>
      id === null ? 'something outside the selection' : `[${number.get(id)}]`;
    for (const link of selection.links) {
      let line = `${end(link.from)} -> ${end(link.to)}`;
      if (link.label) line += ` ${quoted(link.label)}`;
      lines.push(line);
    }
  }
  return lines.join('\n');
}

// A label as one line of Markdown text: the characters Markdown reads as structure escaped, so a label is never a
// heading, a link or a list of its own.
function mdText(s: string): string {
  let out = '';
  for (const ch of s) out += '\\`*_[]<>#|'.includes(ch) ? `\\${ch}` : ch;
  return out;
}

const article = (kind: string) => (/^[aeiou]/i.test(kind) ? `An ${kind}` : `A ${kind}`);

/** The section's words without a summary (Add Without Summary): the items' labels as a list, a frame's contents under
 *  it, and how many arrows connect them. Nothing but what the selection holds. */
export function knowledgeSendFallback(selection: KnowledgeSendSelection): string {
  const lines: string[] = [];
  const under = new Map<string, KnowledgeSendItem[]>();
  for (const item of selection.items)
    if (item.in !== undefined) under.set(item.in, [...(under.get(item.in) ?? []), item]);
  const line = (item: KnowledgeSendItem, depth: number) => {
    const words = item.label ? mdText(item.label) : article(item.kind);
    const note = item.note ? `: ${mdText(item.note)}` : '';
    lines.push(`${'  '.repeat(depth)}- ${words}${note}`);
    for (const child of under.get(item.id) ?? []) line(child, depth + 1);
  };
  for (const item of selection.items) if (item.in === undefined) line(item, 0);
  const arrows = selection.links.length;
  if (arrows > 0)
    lines.push('', `${arrows} arrow${arrows === 1 ? ' connects' : 's connect'} them.`);
  return lines.join('\n');
}

function readPicture(v: unknown): KnowledgeSendPicture | null | undefined {
  if (v === undefined || v === null) return undefined;
  if (!isRecord(v) || typeof v.png !== 'string') return null;
  const { png, width, height } = v;
  if (!png || png.length > KNOWLEDGE_SEND_PICTURE_BASE64_MAX) return null;
  const side = (n: unknown): n is number =>
    typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= KNOWLEDGE_SEND_PICTURE_SIDE_MAX;
  if (!side(width) || !side(height)) return null;
  return { png, width, height };
}

function readPlace(v: unknown): KnowledgeSendPlace | null {
  if (!isRecord(v)) return null;
  if (isRecord(v.newPage)) {
    const title = clean(v.newPage.title, KNOWLEDGE_SEND_HEADING_MAX);
    const parent =
      v.newPage.parent === null || v.newPage.parent === undefined ? null : idOf(v.newPage.parent);
    if (!title || (v.newPage.parent && !parent)) return null;
    return { newPage: { title, parent } };
  }
  const page = idOf(v.page);
  if (!page) return null;
  if (v.after === undefined || v.after === null) return { page };
  const after = idOf(v.after);
  return after ? { page, after } : null;
}

function readSource(v: unknown): KnowledgeSendSource | null {
  if (!isRecord(v) || !isApp(v.app)) return null;
  const itemId = idOf(v.itemId);
  const tabId = v.tabId === null || v.tabId === undefined ? null : idOf(v.tabId);
  if (!itemId || (v.tabId && !tabId) || !Array.isArray(v.elementIds)) return null;
  const elementIds = [...new Set(v.elementIds.map(idOf))].filter((x): x is string => x !== null);
  if (elementIds.length === 0 || elementIds.length > KNOWLEDGE_SEND_ITEMS_MAX) return null;
  return { app: v.app, itemId, tabId, elementIds };
}

const markdownOf = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() && v.length <= KNOWLEDGE_SEND_MARKDOWN_MAX ? v : null;

/** The editor's ask as the index takes it, or null. */
export function readKnowledgeSendAsk(v: unknown): KnowledgeSendAsk | null {
  if (!isRecord(v)) return null;
  const knowledgebase = idOf(v.knowledgebase);
  const place = readPlace(v.place);
  const markdown = markdownOf(v.markdown);
  const picture = readPicture(v.picture);
  const source = readSource(v.source);
  const heading = clean(v.heading, KNOWLEDGE_SEND_HEADING_MAX) ?? '';
  if (!knowledgebase || !place || !markdown || picture === null || !source) return null;
  return { knowledgebase, place, heading, markdown, ...(picture ? { picture } : {}), source };
}

/** The door's call as liveknowledge takes it, or null. */
export function readKnowledgeSendDoorCall(v: unknown): KnowledgeSendDoorCall | null {
  if (!isRecord(v)) return null;
  const person = idOf(v.person);
  if (!person) return null;
  if (v.op === 'outline') {
    const page = idOf(v.page);
    return page ? { op: 'outline', person, page } : null;
  }
  if (v.op !== 'write') return null;
  const place = readPlace(v.place);
  const markdown = markdownOf(v.markdown);
  const picture = readPicture(v.picture);
  const heading = clean(v.heading, KNOWLEDGE_SEND_HEADING_MAX) ?? '';
  const from = isRecord(v.sentFrom) ? v.sentFrom : null;
  const title = from ? clean(from.title, KNOWLEDGE_SEND_HEADING_MAX) : null;
  const link =
    from &&
    typeof from.link === 'string' &&
    /^https?:\/\//.test(from.link) &&
    from.link.length <= 2_000
      ? from.link
      : null;
  if (!place || !markdown || picture === null || !from || !isApp(from.app) || !title || !link)
    return null;
  return {
    op: 'write',
    person,
    place,
    heading,
    markdown,
    ...(picture ? { picture } : {}),
    sentFrom: { app: from.app, title, link },
  };
}

/** What liveknowledge sends the index for an agent's write with a source, or null. */
export function readAgentKnowledgeSend(v: unknown): AgentKnowledgeSend | null {
  if (!isRecord(v) || !isRecord(v.source) || !isRecord(v.page)) return null;
  const { source } = v;
  const person = idOf(v.person);
  // An agent may name the item alone: its tab and elements are optional.
  const itemId = idOf(source.itemId);
  const pageId = idOf(v.page.id);
  if (!person || !itemId || !isApp(source.app) || !pageId) return null;
  const tabId = idOf(source.tabId);
  const elementIds = Array.isArray(source.elementIds)
    ? [...new Set(source.elementIds.map(idOf))]
        .filter((x): x is string => x !== null)
        .slice(0, KNOWLEDGE_SEND_ITEMS_MAX)
    : [];
  return {
    person,
    source: { app: source.app, itemId, tabId, elementIds },
    page: { id: pageId, title: clean(v.page.title, KNOWLEDGE_SEND_HEADING_MAX) ?? '' },
  };
}

/** The words the Sent From line ends a section with: "Sent from <title> in <app>", the title a link back. */
export function knowledgeSentFromLine(from: KnowledgeSentFrom): string {
  return `Sent from [${mdText(from.title)}](${from.link}) in ${from.app}`;
}
