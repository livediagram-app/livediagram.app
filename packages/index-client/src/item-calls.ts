// Start a Call Here (liveworkspace/docs/specs/004-index/item-calls.md, its blueprint): a livehuddle call about any item,
// in a new browser tab. The shapes every side shares: the index's routes, livehuddle's room push and door, and the
// editors' button, pill and Meetings.

import type { App } from './constants';

/** How often a Space's room tells the index who is in its call: one push per settle of changes. */
export const ITEM_CALL_SETTLE_MS = 1_500;
/** Names a meeting keeps: everyone who joined, first come. */
export const ITEM_CALL_NAMES_MAX = 50;
/** A name's longest. */
export const ITEM_CALL_NAME_MAX = 80;
/** Meetings an item's read answers, newest first. */
export const ITEM_CALLS_READ_MAX = 20;
/** Knowledgebases and plans one read checks the reader's own access to. */
export const ITEM_CALL_CHECKS_MAX = 10;
/** People one Invite names. */
export const ITEM_CALL_INVITES_MAX = 10;
/** Days an invite stays in the Inbox. */
export const ITEM_CALL_INVITE_DAYS = 1;
/** A call nobody has joined yet is still the item's call for this long, so two quick presses never make two. */
export const ITEM_CALL_START_GRACE_MS = 120_000;
/** The livehuddle template a call's Space is made from: a pod where everyone hears everyone. */
export const ITEM_CALL_TEMPLATE = 'team-pod';
/** What a call's Space is called after its item's title. */
export const ITEM_CALL_NAME_SUFFIX = ' Call';
/** The summary page's longest body (CROSS_APP_BODY_MAX's bound) and title. */
export const ITEM_CALL_SUMMARY_MAX = 20_000;
export const ITEM_CALL_SUMMARY_TITLE_MAX = 200;
/** The app whose Spaces calls are. */
export const ITEM_CALL_APP = 'livehuddle' as const satisfies App;

/** A call as the item's readers see it: its Space, the link that lets them in, and who is in it now. */
export type ItemCall = {
  id: string;
  spaceId: string;
  // The Space's Participant link, the way in.
  link: string;
  people: number;
  names: string[];
  startedAt: number;
  endedAt: number | null;
  live: boolean;
};

/** A call as the item remembers it, with where its summary and actions went (each only for a reader who can open it). */
export type ItemMeeting = ItemCall & {
  summary: { title: string; link: string } | null;
  plan: { id: string; title: string; link: string } | null;
  // The reader started it.
  you: boolean;
};

export type ItemCallsRead = { live: ItemCall | null; meetings: ItemMeeting[] };
export type ItemCallStart = { call: ItemCall; started: boolean };

/** A Space's call, as livehuddle's editor shows it. `summaryDefault` is the host's alone. */
export type SpaceCall = {
  id: string;
  item: { app: App; id: string; title: string; link: string };
  host: boolean;
  live: boolean;
  startedAt: number;
  // Who came, first come: the summary's draft names them.
  names: string[];
  summary: { title: string; link: string } | null;
  summaryDefault: { id: string; title: string } | null;
};

/** livehuddle's room telling the index who is in a call. */
export type CallPeoplePush = { people: number; names: string[] };
export type CallSummaryAsk = { knowledgebase: string; title: string; body: string };
export type CallInviteAsk = { people: string[] };

/** One invite in the reader's Inbox (`InboxResponse.calls`). */
export type InboxCallInvite = {
  id: string;
  app: App;
  itemId: string;
  itemTitle: string;
  itemTeamId: string | null;
  byName: string;
  at: number;
  live: boolean;
};

const ID = /^[A-Za-z0-9_:-]{1,128}$/;
const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isId = (v: unknown): v is string => typeof v === 'string' && ID.test(v);

/** Names as a meeting keeps them: trimmed, cut, blanks and repeats dropped, at most ITEM_CALL_NAMES_MAX. */
export function callNames(raw: readonly unknown[]): string[] {
  const out: string[] = [];
  for (const v of raw) {
    if (typeof v !== 'string') continue;
    const name = v.trim().slice(0, ITEM_CALL_NAME_MAX);
    if (!name || out.includes(name)) continue;
    out.push(name);
    if (out.length === ITEM_CALL_NAMES_MAX) break;
  }
  return out;
}

/** The room's push, or null. */
export function readCallPeoplePush(raw: unknown): CallPeoplePush | null {
  if (!isRecord(raw)) return null;
  const { people, names } = raw;
  if (typeof people !== 'number' || !Number.isInteger(people) || people < 0 || people > 10_000)
    return null;
  if (!Array.isArray(names) || names.length > ITEM_CALL_NAMES_MAX * 4) return null;
  return { people, names: callNames(names) };
}

/** A Send Summary's body, or null. */
export function readCallSummaryAsk(raw: unknown): CallSummaryAsk | null {
  if (!isRecord(raw) || !isId(raw.knowledgebase)) return null;
  const { title, body } = raw;
  if (typeof title !== 'string' || typeof body !== 'string') return null;
  const t = title.trim();
  if (!t || t.length > ITEM_CALL_SUMMARY_TITLE_MAX) return null;
  if (!body.trim() || body.length > ITEM_CALL_SUMMARY_MAX) return null;
  return { knowledgebase: raw.knowledgebase, title: t, body };
}

/** An Invite's body, or null: 1 to ITEM_CALL_INVITES_MAX people, each once. */
export function readCallInviteAsk(raw: unknown): CallInviteAsk | null {
  const people = isRecord(raw) ? raw.people : null;
  if (!Array.isArray(people) || people.length === 0 || people.length > ITEM_CALL_INVITES_MAX)
    return null;
  if (!people.every(isId)) return null;
  return { people: [...new Set(people as string[])] };
}

/** The call's tab, named for its item: Call and Join bring it back rather than open another. */
export const itemCallTabName = (itemId: string): string => `lw-call-${itemId}`;
/** The item's own tab, which Open Item in the call brings back. */
export const itemTabName = (itemId: string): string => `lw-item-${itemId}`;

/** The pill's words: "3 in Call". */
export const inCallWords = (people: number): string => `${people} in Call`;

/** The pill's hover card: "Call in progress, 3 people: Ana, Bo and Cy". */
export function callInProgressWords(call: Pick<ItemCall, 'people' | 'names'>): string {
  const head = `Call in progress, ${call.people} ${call.people === 1 ? 'person' : 'people'}`;
  const names = call.names.slice(0, 8);
  if (names.length === 0) return head;
  const more = call.names.length - names.length;
  const list =
    more > 0
      ? `${names.join(', ')} and ${more} more`
      : names.length === 1
        ? names[0]!
        : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  return `${head}: ${list}`;
}
