// A card thread's shape, limits, ids, titles and checks (card-threads.ts, docs/specs/026-plan/items.md
// "Comments", "Limits"): what the writes, reads and redaction there build on. card-threads.ts re-exports it all.

import { CUSTOM_FIELD_ID_PATTERN } from '@liveplanner/items';
import { type Comment } from './comments';
import { isComment } from './element-deltas';

// ---------- Shape --------------------------------------------------------------------------------------------

/** One card a thread is on: its plan and id, its number, and (a card in another plan) that plan's name when the
 *  thread was added there. */
export type CardRef = {
  projectId: string;
  itemId: string;
  key: number | null;
  projectName?: string;
};

/** Who started a thread: their name and colour, and (to themselves alone) their owner id. */
export type ThreadPerson = { name: string; color: string; authorId?: string };

export type CardThread = {
  id: string;
  // '' for a thread moved from a card's old single thread: its title is worked out (threadTitle).
  title: string;
  resolved: boolean;
  // Who resolved it and when, while resolved: their name, and their hashed person id (itemPersonId, public as a
  // card's makers' are) so a closed account's anonymising finds them. A thread resolved before it was kept has none.
  resolvedBy?: string;
  resolvedById?: string;
  resolvedAt?: number;
  // Oldest first, never empty.
  comments: Comment[];
  createdAt: number;
  createdBy: ThreadPerson;
  // Its last activity: a comment added or edited, a resolve, a reopen or a rename.
  updatedAt: number;
  // The plan that stores it.
  home: string;
  // Every card it is on, the card it was started on first.
  cards: CardRef[];
  // The Comments field it belongs to (docs/specs/026-plan/item-types.md "Comments and Votes fields"), set when it is
  // started; absent is the built-in Comments (every thread from before).
  field?: string;
  rev: number;
};

// ---------- Constants (docs/specs/026-plan/items.md "Limits") -------------------------------------------------

// A thread's comments and their size: the old per-card thread's budget, now per thread.
export const THREAD_COMMENTS_MAX = 200;
export const THREAD_BYTES = 131_072;
// Threads one card is on: the panel is drawn for about five; this is a ceiling, not a target.
export const CARD_THREADS_MAX = 50;
// Cards one thread is on: each is a plan to tell of every write, so it stays small (a tab's holders cap is 20 too).
export const THREAD_CARDS_MAX = 20;
export const THREAD_TITLE_MAX = 120;
// How much of the first comment an automatic title takes, before it is cut at a word.
export const THREAD_OPENING_MAX = 60;
export const THREAD_ID_PREFIX = 'th-';
// The id a card's old single thread takes when it moves: one per card, so a second move of it is a no-op.
export const LEGACY_THREAD_PREFIX = 'c-';
// A comment's text, as a posted comment's (api-schema COMMENT_TEXT_MAX).
export const THREAD_COMMENT_TEXT_MAX = 2_000;

const THREAD_ID = /^th-[a-z0-9]{16}$/;
const LEGACY_ID = /^c-[A-Za-z0-9_-]{1,64}$/;

/** Whether `value` can name a thread's Comments field: the built-in's id or a custom field's (`f-` and a slug). */
export function isThreadFieldId(value: unknown): value is string {
  return typeof value === 'string' && (value === 'comments' || CUSTOM_FIELD_ID_PATTERN.test(value));
}

export function isThreadId(value: unknown): value is string {
  return typeof value === 'string' && (THREAD_ID.test(value) || LEGACY_ID.test(value));
}

const ID_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';

/** A new thread id, unique across every plan: `th-` and 16 letters and digits. */
export function newThreadId(random: () => number = Math.random): string {
  let id = THREAD_ID_PREFIX;
  for (let i = 0; i < 16; i += 1) id += ID_CHARS[Math.floor(random() * ID_CHARS.length)]!;
  return id;
}

// ---------- Titles -------------------------------------------------------------------------------------------

// The first line of `text`, cut at a word to at most `max` characters with an ellipsis.
function opening(text: string, max: number): string {
  const line = (text.split(/\r?\n/).find((l) => l.trim()) ?? '').trim().replace(/\s+/g, ' ');
  if (line.length <= max) return line;
  const cut = line.slice(0, max);
  const space = cut.lastIndexOf(' ');
  // A word longer than most of the room is cut where it is rather than leaving almost nothing.
  const at = space > max * 0.5 ? space : max;
  return `${cut.slice(0, at).replace(/[\s.,;:!?-]+$/, '')}…`;
}

/** The title a thread is given when it starts: `{name}: {opening}` ("Gentle Falcon: Basket empties after
 *  switching restaurants"), the opening the first comment's first line cut at a word. */
export function autoThreadTitle(name: string, text: string): string {
  const who = name.trim() || 'Someone';
  const what = opening(text, THREAD_OPENING_MAX);
  const title = what ? `${who}: ${what}` : who;
  return title.length <= THREAD_TITLE_MAX ? title : `${title.slice(0, THREAD_TITLE_MAX - 1)}…`;
}

/** What a thread is called: its title, or (a moved thread, a title cleared) the automatic one. */
export function threadTitle(thread: Pick<CardThread, 'title' | 'createdBy' | 'comments'>): string {
  return thread.title || autoThreadTitle(thread.createdBy.name, thread.comments[0]?.text ?? '');
}

/** A title as a rename gives it: trimmed and on one line; '' (the automatic one) or the title, or null past the cap. */
export function readThreadTitle(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const title = raw.replace(/\s+/g, ' ').trim();
  return title.length > THREAD_TITLE_MAX ? null : title;
}

// ---------- Checks -------------------------------------------------------------------------------------------

function isCardRef(v: unknown): v is CardRef {
  if (!v || typeof v !== 'object') return false;
  const c = v as Record<string, unknown>;
  return (
    typeof c.projectId === 'string' &&
    typeof c.itemId === 'string' &&
    (c.key === null || typeof c.key === 'number') &&
    (c.projectName === undefined || typeof c.projectName === 'string')
  );
}

/** Whether `v` is a thread as stored: its shape and its caps. */
export function isCardThread(v: unknown): v is CardThread {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const t = v as Record<string, unknown>;
  const by = t.createdBy as Record<string, unknown> | undefined;
  return (
    isThreadId(t.id) &&
    typeof t.title === 'string' &&
    t.title.length <= THREAD_TITLE_MAX &&
    typeof t.resolved === 'boolean' &&
    Array.isArray(t.comments) &&
    t.comments.length > 0 &&
    t.comments.length <= THREAD_COMMENTS_MAX &&
    t.comments.every(isComment) &&
    typeof t.createdAt === 'number' &&
    typeof t.updatedAt === 'number' &&
    !!by &&
    typeof by.name === 'string' &&
    typeof by.color === 'string' &&
    typeof t.home === 'string' &&
    Array.isArray(t.cards) &&
    t.cards.length <= THREAD_CARDS_MAX &&
    t.cards.every(isCardRef) &&
    (t.field === undefined || isThreadFieldId(t.field)) &&
    typeof t.rev === 'number'
  );
}

/** The comments' size, as the thread's budget counts it. */
export function threadBytes(comments: readonly Comment[]): number {
  return JSON.stringify(comments).length;
}
