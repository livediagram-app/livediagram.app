// Send to Plan's wire (liveworkspace/docs/specs/004-index/send-to-plan.md, blueprint send-to-plan.md): a sticky, words,
// a thread or an action in any app made a liveplanner card as the person, the index's record of it (a send), the card's
// Sent From field, and the change call liveplanner makes so each source's chip stays live. Shapes and their readers
// only; the routes are the index's, the door liveplanner's.

import { isApp, type App } from './constants';

// The spec's Limits.
export const PLAN_SEND_CARDS_MAX = 20;
export const PLAN_SEND_CHECKLIST_MAX = 50;
export const PLAN_SEND_PLACES_MAX = 50;
export const PLAN_SENDS_PER_SOURCE_MAX = 500;
export const PLAN_SEND_READ_MAX = 200;
export const PLAN_SEND_PLANS_CHECKED_MAX = 20;
export const PLAN_CARDS_CHANGED_MAX = 100;
export const PLAN_SEND_SOURCES_SIGNAL_MAX = 50;
export const PLAN_CARDS_SETTLE_MS = 1_500;
export const PLAN_SEND_TITLE_MAX = 200;
export const PLAN_SEND_TEXT_MAX = 2_000;
export const PLAN_SEND_LABEL_MAX = 120;
export const PLAN_SEND_NAME_MAX = 120;

export const PLAN_SEND_KINDS = ['element', 'text', 'thread', 'action'] as const;
export type PlanSendKind = (typeof PLAN_SEND_KINDS)[number];

const ID_MAX = 200;
const PART_MAX = 64;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** One place a card is made from: the source item, what in it, and the words it holds. */
export type PlanSendPlace = {
  app: App;
  itemId: string;
  kind: PlanSendKind;
  tabId: string | null;
  elementId: string | null;
  // A thread's or an action's id; for picked words, `textPart` of them.
  part: string | null;
  // The tab's or page's name the place is on, for the card's line back ("Retro, Sprint 12").
  label: string;
  text: string;
};

/** One card a send makes: its title and fields, and the place or places it came from (several for a checklist). */
export type PlanSendCardInput = {
  title: string;
  // A plan person's name, matched by the plan ignoring case.
  assignee?: string;
  due?: string;
  checklist?: string[];
  places: PlanSendPlace[];
};

export type PlanSendAsk = {
  board: string;
  column: string;
  cards: PlanSendCardInput[];
  // Send a place again although it already has a live card in this plan.
  again?: boolean;
};

/** A send as a source's read answers it: the place and the card, as the plan last said. */
export type PlanSend = {
  id: string;
  ref: string;
  kind: PlanSendKind;
  plan: { id: string; title: string };
  card: { id: string; title: string; column: string; done: boolean };
  // Opens the card in liveplanner.
  link: string;
  at: number;
};

export type PlanSendsRead = { sends: PlanSend[] };

/** What a send answers: the sends it recorded, newest first. */
export type PlanSendAnswer = { sends: PlanSend[] };

/** One sent card's state, as liveplanner tells the index. */
export type PlanCardChange = { id: string; title: string; column: string; done: boolean; gone: boolean };

/** A card's Sent From field (`sentFrom`): where it came from, as the platform filled it in. */
export type SentFrom = {
  app: App;
  itemId: string;
  title: string;
  kind: PlanSendKind;
  label: string;
  text: string;
  link: string;
};

/** What the index asks liveplanner's door to make, the grant in X-Index-Grant. */
export type PlanSendDoorCall = {
  person: string;
  board: string;
  column: string;
  cards: {
    title: string;
    description: string;
    assignee?: string;
    due?: string;
    checklist?: string[];
    sentFrom: SentFrom;
  }[];
};

export type PlanSendRefusal = 'target_gone' | 'invalid' | 'full' | 'failed';

export type PlanSendDoorAnswer =
  | { ok: true; cards: { id: string; title: string; column: string; done: boolean }[] }
  | { ok: false; code: PlanSendRefusal; reason: string };

/** An agent's card with a source: what liveplanner asks the index to fill in and record. */
export type AgentSentFrom = {
  app: App;
  itemId: string;
  tabId?: string;
  elementId?: string;
  text: string;
};

export const planSendDoorPath = (itemId: string): string =>
  `/api/internal/items/${encodeURIComponent(itemId)}/plan-send`;

/** A place's ref, `kind:tab:element:part`, each empty when null: what a chip and a duplicate are matched by. */
export const planSendRef = (p: Pick<PlanSendPlace, 'kind' | 'tabId' | 'elementId' | 'part'>): string =>
  [p.kind, p.tabId ?? '', p.elementId ?? '', p.part ?? ''].join(':');

/** Picked words' key: a 32-bit FNV-1a of them, lower-cased with runs of white space folded, as 8 hex characters. */
export function textPart(words: string): string {
  let hash = 0x811c9dc5;
  let space = false;
  let started = false;
  for (const ch of words.toLowerCase()) {
    const blank = ch.trim() === '';
    if (blank) {
      space = started;
      continue;
    }
    if (space) hash = Math.imul(hash ^ 32, 0x01000193);
    space = false;
    started = true;
    for (let i = 0; i < ch.length; i++) hash = Math.imul(hash ^ ch.charCodeAt(i), 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown, max: number): v is string => typeof v === 'string' && v.length <= max;
const id = (v: unknown, max = ID_MAX): v is string => text(v, max) && v !== '';
const idOrNull = (v: unknown, max = ID_MAX): v is string | null => v === null || id(v, max);
const isKind = (v: unknown): v is PlanSendKind =>
  typeof v === 'string' && (PLAN_SEND_KINDS as readonly string[]).includes(v);
export const isPlanDay = (v: unknown): v is string => typeof v === 'string' && DAY.test(v);

function readPlace(v: unknown): PlanSendPlace | null {
  if (!isRecord(v) || !isApp(v.app) || !id(v.itemId) || !isKind(v.kind)) return null;
  if (!idOrNull(v.tabId) || !idOrNull(v.elementId) || !idOrNull(v.part, PART_MAX)) return null;
  if (!text(v.label, PLAN_SEND_LABEL_MAX) || !text(v.text, PLAN_SEND_TEXT_MAX)) return null;
  return {
    app: v.app,
    itemId: v.itemId,
    kind: v.kind,
    tabId: v.tabId,
    elementId: v.elementId,
    part: v.part,
    label: v.label,
    text: v.text,
  };
}

const isTextList = (v: unknown, max: number, each: number): v is string[] =>
  Array.isArray(v) && v.length <= max && v.every((t) => text(t, each));

function readCard(v: unknown): PlanSendCardInput | null {
  if (!isRecord(v) || !text(v.title, PLAN_SEND_TITLE_MAX) || v.title.trim() === '') return null;
  if (v.assignee !== undefined && !text(v.assignee, PLAN_SEND_NAME_MAX)) return null;
  if (v.due !== undefined && !isPlanDay(v.due)) return null;
  if (v.checklist !== undefined && !isTextList(v.checklist, PLAN_SEND_CHECKLIST_MAX, PLAN_SEND_TITLE_MAX))
    return null;
  const places = Array.isArray(v.places) ? v.places.map(readPlace) : [];
  if (places.length === 0 || places.length > PLAN_SEND_PLACES_MAX || places.some((p) => !p))
    return null;
  return {
    title: v.title.trim(),
    ...(v.assignee ? { assignee: v.assignee } : {}),
    ...(v.due ? { due: v.due } : {}),
    ...(v.checklist ? { checklist: v.checklist } : {}),
    places: places as PlanSendPlace[],
  };
}

/** A send's body, or null when anything in it is over a cap or of the wrong type. */
export function readPlanSendAsk(raw: unknown): PlanSendAsk | null {
  if (!isRecord(raw) || !id(raw.board) || !text(raw.column, PLAN_SEND_NAME_MAX)) return null;
  if (!Array.isArray(raw.cards) || raw.cards.length === 0 || raw.cards.length > PLAN_SEND_CARDS_MAX)
    return null;
  const cards = raw.cards.map(readCard);
  if (cards.some((c) => !c)) return null;
  return {
    board: raw.board,
    column: raw.column,
    cards: cards as PlanSendCardInput[],
    ...(raw.again === true ? { again: true } : {}),
  };
}

function readChange(v: unknown): PlanCardChange | null {
  if (!isRecord(v) || !id(v.id) || !text(v.title, PLAN_SEND_TITLE_MAX)) return null;
  if (!text(v.column, PLAN_SEND_NAME_MAX) || typeof v.done !== 'boolean') return null;
  if (typeof v.gone !== 'boolean') return null;
  return { id: v.id, title: v.title, column: v.column, done: v.done, gone: v.gone };
}

/** liveplanner's change call's cards, or null. */
export function readPlanCardChanges(raw: unknown): PlanCardChange[] | null {
  const cards = isRecord(raw) ? raw.cards : null;
  if (!Array.isArray(cards) || cards.length === 0 || cards.length > PLAN_CARDS_CHANGED_MAX)
    return null;
  const read = cards.map(readChange);
  return read.some((c) => !c) ? null : (read as PlanCardChange[]);
}

/** A card's Sent From as stored, or null for anything that is not one. */
export function readSentFrom(v: unknown): SentFrom | null {
  if (!isRecord(v) || !isApp(v.app) || !id(v.itemId) || !isKind(v.kind)) return null;
  if (!text(v.title, PLAN_SEND_TITLE_MAX) || !text(v.label, PLAN_SEND_LABEL_MAX)) return null;
  if (!text(v.text, PLAN_SEND_TEXT_MAX) || !text(v.link, 2048) || !/^https?:\/\//.test(v.link))
    return null;
  return {
    app: v.app,
    itemId: v.itemId,
    title: v.title,
    kind: v.kind,
    label: v.label,
    text: v.text,
    link: v.link,
  };
}

/** An agent's `sentFrom`, or null. */
export function readAgentSentFrom(v: unknown): AgentSentFrom | null {
  if (!isRecord(v) || !isApp(v.app) || !id(v.itemId) || !text(v.text, PLAN_SEND_TEXT_MAX))
    return null;
  if (v.tabId !== undefined && !id(v.tabId)) return null;
  if (v.elementId !== undefined && !id(v.elementId)) return null;
  return {
    app: v.app,
    itemId: v.itemId,
    ...(v.tabId ? { tabId: v.tabId } : {}),
    ...(v.elementId ? { elementId: v.elementId } : {}),
    text: v.text,
  };
}

/** The door's call, or null. */
export function readPlanSendDoorCall(raw: unknown): PlanSendDoorCall | null {
  if (!isRecord(raw) || !id(raw.person) || !id(raw.board) || !text(raw.column, PLAN_SEND_NAME_MAX))
    return null;
  if (!Array.isArray(raw.cards) || raw.cards.length === 0 || raw.cards.length > PLAN_SEND_CARDS_MAX)
    return null;
  const cards: PlanSendDoorCall['cards'] = [];
  for (const c of raw.cards) {
    if (!isRecord(c) || !text(c.title, PLAN_SEND_TITLE_MAX) || c.title.trim() === '') return null;
    if (!text(c.description, PLAN_SEND_TEXT_MAX * 2)) return null;
    if (c.assignee !== undefined && !text(c.assignee, PLAN_SEND_NAME_MAX)) return null;
    if (c.due !== undefined && !isPlanDay(c.due)) return null;
    if (
      c.checklist !== undefined &&
      !isTextList(c.checklist, PLAN_SEND_CHECKLIST_MAX, PLAN_SEND_TITLE_MAX)
    )
      return null;
    const sentFrom = readSentFrom(c.sentFrom);
    if (!sentFrom) return null;
    cards.push({
      title: c.title,
      description: c.description,
      ...(c.assignee ? { assignee: c.assignee } : {}),
      ...(c.due ? { due: c.due } : {}),
      ...(c.checklist ? { checklist: c.checklist } : {}),
      sentFrom,
    });
  }
  return { person: raw.person, board: raw.board, column: raw.column, cards };
}

/** The card's description: every word sent, then the line back to where it came from. */
export function planSendDescription(
  places: readonly Pick<PlanSendPlace, 'text'>[],
  from: { title: string; label: string; app: App; link: string },
): string {
  const words = places
    .map((p) => p.text.trim())
    .filter(Boolean)
    .join('\n\n');
  const where = [from.title || 'Untitled', from.label].filter(Boolean).join(', ');
  return [words, `From ${where} (${from.app}): ${from.link}`].filter(Boolean).join('\n\n');
}
