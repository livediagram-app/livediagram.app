// A card's comment threads in the plan's SQLite (docs/specs/026-plan/items.md "Comments", blueprint item-store.md
// "Comments", plan-room/card-thread-schema.ts): the threads this plan stores (`card_threads`, as their home) and the
// links naming the threads each of its cards is on (`card_thread_links`, wherever the thread is stored). A thread
// write is guarded by the thread's own `rev`, as an item write is by the item's.

import {
  isSafeColourValue,
  threadTitle,
  type CardRef,
  type CardThread,
  type Comment,
} from '@liveplanner/project';
import type { PlanEnv } from '../types';

type ThreadRow = {
  id: string;
  plan_id: string;
  title: string;
  resolved: number;
  resolved_by: string | null;
  resolved_at: number | null;
  comments: string;
  created_at: number;
  created_by: string;
  updated_at: number;
  rev: number;
  cards: string;
};

const COLUMNS =
  'plan_id, id, title, resolved, resolved_by, resolved_at, comments, created_at, created_by, updated_at, rev, cards';

function parseArray<T>(text: string): T[] {
  try {
    const v: unknown = JSON.parse(text);
    return Array.isArray(v) ? (v as T[]) : [];
  } catch {
    return [];
  }
}

// Who started it: a name and a safe colour, and the author id when there is one (a moved thread's is null).
function parseStarter(text: string): CardThread['createdBy'] {
  try {
    const p = JSON.parse(text) as { name?: unknown; color?: unknown; authorId?: unknown };
    const name = typeof p.name === 'string' ? p.name : 'Someone';
    const color = typeof p.color === 'string' && isSafeColourValue(p.color) ? p.color : '#94a3b8';
    return typeof p.authorId === 'string' ? { name, color, authorId: p.authorId } : { name, color };
  } catch {
    return { name: 'Someone', color: '#94a3b8' };
  }
}

function threadFromRow(row: ThreadRow): CardThread {
  const comments = parseArray<Comment>(row.comments);
  const createdBy = parseStarter(row.created_by);
  return {
    id: row.id,
    // A moved thread is stored untitled: it reads as its automatic title everywhere.
    title: row.title || threadTitle({ title: '', createdBy, comments }),
    resolved: row.resolved === 1,
    ...(row.resolved === 1 && row.resolved_by !== null ? { resolvedBy: row.resolved_by } : {}),
    ...(row.resolved === 1 && row.resolved_at !== null ? { resolvedAt: row.resolved_at } : {}),
    comments,
    createdAt: row.created_at,
    createdBy,
    updatedAt: row.updated_at,
    home: row.plan_id,
    cards: parseArray<CardRef>(row.cards),
    rev: row.rev,
  };
}

/** The threads of `ids` this plan stores, in no set order: one query however many. */
export async function readThreads(
  env: PlanEnv,
  home: string,
  ids: readonly string[],
): Promise<CardThread[]> {
  if (ids.length === 0) return [];
  const res = await env.PLAN_DB.prepare(
    `SELECT ${COLUMNS} FROM card_threads WHERE plan_id = ? AND id IN (SELECT value FROM json_each(?))`,
  )
    .bind(home, JSON.stringify(ids))
    .all<ThreadRow>();
  // A thread with no comments left (never written so, but a row edited by hand) is no thread.
  return (res.results ?? []).map(threadFromRow).filter((t) => t.comments.length > 0);
}

export async function readThread(
  env: PlanEnv,
  home: string,
  id: string,
): Promise<CardThread | null> {
  return (await readThreads(env, home, [id]))[0] ?? null;
}

/** Every thread this plan stores (a copy's, a Drive file's). */
export async function listHomeThreads(env: PlanEnv, home: string): Promise<CardThread[]> {
  const res = await env.PLAN_DB.prepare(`SELECT ${COLUMNS} FROM card_threads WHERE plan_id = ?`)
    .bind(home)
    .all<ThreadRow>();
  return (res.results ?? []).map(threadFromRow).filter((t) => t.comments.length > 0);
}

/** How many threads this plan stores: the plan's cap on them is its cards' (CARD_THREADS_MAX each). */
export async function countThreads(env: PlanEnv, home: string): Promise<number> {
  const row = await env.PLAN_DB.prepare('SELECT COUNT(*) AS n FROM card_threads WHERE plan_id = ?')
    .bind(home)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

const values = (t: CardThread) => [
  t.title,
  t.resolved ? 1 : 0,
  t.resolved ? (t.resolvedBy ?? null) : null,
  t.resolved ? (t.resolvedAt ?? null) : null,
  JSON.stringify(t.comments),
  t.createdAt,
  JSON.stringify(t.createdBy),
  t.updatedAt,
  t.rev,
  JSON.stringify(t.cards),
];

export function insertThreadStatement(env: PlanEnv, t: CardThread): D1PreparedStatement {
  return env.PLAN_DB.prepare(
    `INSERT INTO card_threads (title, resolved, resolved_by, resolved_at, comments, created_at, created_by,
                               updated_at, rev, cards, plan_id, id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(...values(t), t.home, t.id);
}

/** `next` over the thread stored at `expectedRev`, or false when it moved on (or went) since it was read. */
export function updateThreadStatement(
  env: PlanEnv,
  next: CardThread,
  expectedRev: number,
): D1PreparedStatement {
  return env.PLAN_DB.prepare(
    `UPDATE card_threads SET title = ?, resolved = ?, resolved_by = ?, resolved_at = ?, comments = ?, created_at = ?,
                             created_by = ?, updated_at = ?, rev = ?, cards = ?
      WHERE plan_id = ? AND id = ? AND rev = ?`,
  ).bind(...values(next), next.home, next.id, expectedRev);
}

export function deleteThreadStatement(env: PlanEnv, home: string, id: string): D1PreparedStatement {
  return env.PLAN_DB.prepare('DELETE FROM card_threads WHERE plan_id = ? AND id = ?').bind(
    home,
    id,
  );
}

// ---------- Links: the threads each card of this plan is on ---------------------------------------------------

export type ThreadLink = {
  itemId: string;
  threadId: string;
  // The plan storing the thread (this one's own id for a thread it stores).
  home: string;
  addedAt: number;
  openComments: number;
};

type LinkRow = {
  item_id: string;
  thread_id: string;
  home: string;
  added_at: number;
  open_comments: number;
};

const linkFromRow = (r: LinkRow): ThreadLink => ({
  itemId: r.item_id,
  threadId: r.thread_id,
  home: r.home,
  addedAt: r.added_at,
  openComments: r.open_comments,
});

const LINK_COLUMNS = 'item_id, thread_id, home, added_at, open_comments';

export async function linksOfPlan(env: PlanEnv, plan: string): Promise<ThreadLink[]> {
  const res = await env.PLAN_DB.prepare(
    `SELECT ${LINK_COLUMNS} FROM card_thread_links WHERE plan_id = ? ORDER BY added_at`,
  )
    .bind(plan)
    .all<LinkRow>();
  return (res.results ?? []).map(linkFromRow);
}

export async function linksOfItem(
  env: PlanEnv,
  plan: string,
  itemId: string,
): Promise<ThreadLink[]> {
  const res = await env.PLAN_DB.prepare(
    `SELECT ${LINK_COLUMNS} FROM card_thread_links WHERE plan_id = ? AND item_id = ? ORDER BY added_at`,
  )
    .bind(plan, itemId)
    .all<LinkRow>();
  return (res.results ?? []).map(linkFromRow);
}

export async function linksOfThread(
  env: PlanEnv,
  plan: string,
  threadId: string,
): Promise<ThreadLink[]> {
  const res = await env.PLAN_DB.prepare(
    `SELECT ${LINK_COLUMNS} FROM card_thread_links WHERE plan_id = ? AND thread_id = ? ORDER BY added_at`,
  )
    .bind(plan, threadId)
    .all<LinkRow>();
  return (res.results ?? []).map(linkFromRow);
}

export function insertLinkStatement(
  env: PlanEnv,
  plan: string,
  link: Omit<ThreadLink, 'addedAt'> & { addedAt?: number },
): D1PreparedStatement {
  return env.PLAN_DB.prepare(
    `INSERT OR IGNORE INTO card_thread_links (plan_id, item_id, thread_id, home, added_at, open_comments)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).bind(
    plan,
    link.itemId,
    link.threadId,
    link.home,
    link.addedAt ?? Date.now(),
    link.openComments,
  );
}

/** Every link of a thread in this plan, or (itemIds) only those cards'. */
export function deleteLinksStatement(
  env: PlanEnv,
  plan: string,
  threadId: string,
  itemIds?: readonly string[],
): D1PreparedStatement {
  return itemIds === undefined
    ? env.PLAN_DB.prepare('DELETE FROM card_thread_links WHERE plan_id = ? AND thread_id = ?').bind(
        plan,
        threadId,
      )
    : env.PLAN_DB.prepare(
        `DELETE FROM card_thread_links WHERE plan_id = ? AND thread_id = ?
           AND item_id IN (SELECT value FROM json_each(?))`,
      ).bind(plan, threadId, JSON.stringify(itemIds));
}

/** The thread's face count on this plan's cards. Always written (even unchanged): the link's update keys the Inbox
 *  push (`~cards`), which follows the thread's title and latest comment too. */
export function openCommentsStatement(
  env: PlanEnv,
  plan: string,
  thread: Pick<CardThread, 'id' | 'resolved' | 'comments'>,
): D1PreparedStatement {
  return env.PLAN_DB.prepare(
    'UPDATE card_thread_links SET open_comments = ? WHERE plan_id = ? AND thread_id = ?',
  ).bind(thread.resolved ? 0 : thread.comments.length, plan, thread.id);
}

/** How many threads a card of this plan is on. */
export async function threadCountOfItem(
  env: PlanEnv,
  plan: string,
  itemId: string,
): Promise<number> {
  const row = await env.PLAN_DB.prepare(
    'SELECT COUNT(*) AS n FROM card_thread_links WHERE plan_id = ? AND item_id = ?',
  )
    .bind(plan, itemId)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

/** Each card's face count (the comments in its open threads), from the links: no thread is read. */
export async function openCommentCountsOfPlan(
  env: PlanEnv,
  plan: string,
): Promise<Map<string, number>> {
  const res = await env.PLAN_DB.prepare(
    `SELECT item_id, SUM(open_comments) AS n FROM card_thread_links
      WHERE plan_id = ? GROUP BY item_id HAVING n > 0`,
  )
    .bind(plan)
    .all<{ item_id: string; n: number }>();
  return new Map((res.results ?? []).map((r) => [r.item_id, r.n]));
}
