// The Forum's storage (liveworkspace/docs/specs/007-community/community.md "The Forum"; blueprint "The Forum"): topics
// and replies in one table, reactions, reports, and what a post answers to whoever reads it. An account id never
// leaves this file except as `own`.

import {
  COMMUNITY_AUTO_HIDE_REPORTERS,
  FORUM_MAX_OFFSET,
  FORUM_PAGE_SIZE,
  FORUM_REACTIONS,
  FORUM_POPULAR_WINDOW_MS,
  FORUM_REPLIES_MAX,
  forumExcerpt,
  isCommunityApp,
  isForumCategory,
  isForumReaction,
  noForumReactions,
  type CommunityReportReason,
  type ForumAuthor,
  type ForumListQuery,
  type ForumPostState,
  type ForumReaction,
  type ForumReactions,
  type ForumReply,
  type ForumTopic,
  type ForumTopicSummary,
} from '@liveworkspace/community';
import type { Env } from '../env';
import { newPostId } from '../rows';

export type ForumRow = {
  id: string;
  topic_id: string | null;
  category: string;
  app: string | null;
  author_id: string;
  author_name: string;
  author_color: string;
  title: string;
  body: string;
  state: ForumPostState;
  answer_id: string | null;
  check_tries: number;
  checked_at: number;
  created_at: number;
  edited_at: number | null;
  activity_at: number;
};

type TopicRow = ForumRow & { reply_count: number; answered: number };

const COLS =
  'id, topic_id, category, app, author_id, author_name, author_color, title, body, state, answer_id, check_tries, checked_at, created_at, edited_at, activity_at';
const T_COLS = COLS.split(', ')
  .map((c) => `t.${c}`)
  .join(', ');

// A topic's listed replies, and whether its answer is one of them: correlated reads on idx_forum_replies and the key.
const TOPIC_EXTRAS = `(SELECT COUNT(*) FROM forum_posts r WHERE r.topic_id = t.id AND r.state = 'listed') AS reply_count,
  EXISTS (SELECT 1 FROM forum_posts a WHERE a.id = t.answer_id AND a.state = 'listed') AS answered`;
const UNANSWERED = `NOT EXISTS (SELECT 1 FROM forum_posts a WHERE a.id = t.answer_id AND a.state = 'listed')`;

const authorOf = (row: ForumRow): ForumAuthor => ({
  name: row.author_name,
  color: row.author_color,
});
const categoryOf = (row: ForumRow) => (isForumCategory(row.category) ? row.category : 'general');
const appOf = (row: ForumRow) => (isCommunityApp(row.app) ? row.app : null);
const isOwn = (row: ForumRow, viewer: string | null) => viewer !== null && row.author_id === viewer;

export function topicSummary(row: TopicRow, viewer: string | null): ForumTopicSummary {
  return {
    id: row.id,
    category: categoryOf(row),
    app: appOf(row),
    title: row.title,
    excerpt: forumExcerpt(row.body),
    author: authorOf(row),
    replyCount: row.reply_count,
    answered: row.answered === 1,
    createdAt: row.created_at,
    activityAt: row.activity_at,
    state: row.state,
    own: isOwn(row, viewer),
  };
}

const EMPTY_REACTIONS: ForumReactions = { counts: noForumReactions(), mine: [] };

export function forumReply(
  row: ForumRow,
  viewer: string | null,
  reactions: ForumReactions = EMPTY_REACTIONS,
): ForumReply {
  return {
    id: row.id,
    topicId: row.topic_id ?? '',
    body: row.body,
    author: authorOf(row),
    createdAt: row.created_at,
    editedAt: row.edited_at,
    state: row.state,
    own: isOwn(row, viewer),
    reactions,
  };
}

export function forumTopic(
  row: ForumRow,
  viewer: string | null,
  reactions: ForumReactions = EMPTY_REACTIONS,
  answerListed = false,
): ForumTopic {
  return {
    ...forumReply(row, viewer, reactions),
    topicId: null,
    category: categoryOf(row),
    app: appOf(row),
    title: row.title,
    answerId: answerListed ? row.answer_id : null,
  };
}

/** One post, topic or reply, whatever its state. */
export async function getForumPost(env: Env, id: string): Promise<ForumRow | null> {
  return env.COMMUNITY_DB.prepare(`SELECT ${COLS} FROM forum_posts WHERE id = ?`)
    .bind(id)
    .first<ForumRow>();
}

/** Whether a reader may see a post: listed, or their own. */
export const visibleTo = (row: ForumRow, viewer: string | null) =>
  row.state === 'listed' || isOwn(row, viewer);

/** A page of listed topics. */
export async function listTopics(
  env: Env,
  query: ForumListQuery,
  now = Date.now(),
): Promise<{ rows: TopicRow[]; nextOffset: number | null }> {
  const where = ["t.topic_id IS NULL AND t.state = 'listed'"];
  const binds: unknown[] = [];
  if (query.category) {
    where.push('t.category = ?');
    binds.push(query.category);
  }
  if (query.app) {
    where.push('t.app = ?');
    binds.push(query.app);
  }
  // Unanswered is a Question with no marked answer: other kinds of post have no answer to wait for.
  if (query.sort === 'unanswered') where.push(`t.category = 'question'`, UNANSWERED);
  // Popular: replies and reactions on the topic, among the topics active in the window (idx_forum_topics_active
  // bounds the scan; each count is a key-prefix read).
  if (query.sort === 'popular') {
    where.push('t.activity_at >= ?');
    binds.push(now - FORUM_POPULAR_WINDOW_MS);
  }
  const order =
    query.sort === 'active'
      ? 't.activity_at DESC, t.id'
      : query.sort === 'popular'
        ? `reply_count + (SELECT COUNT(*) FROM forum_reactions x WHERE x.post_id = t.id) DESC, t.activity_at DESC, t.id`
        : 't.created_at DESC, t.id';
  const result = await env.COMMUNITY_DB.prepare(
    `SELECT ${T_COLS}, ${TOPIC_EXTRAS} FROM forum_posts t WHERE ${where.join(' AND ')}
      ORDER BY ${order} LIMIT ? OFFSET ?`,
  )
    .bind(...binds, FORUM_PAGE_SIZE + 1, query.offset)
    .all<TopicRow>();
  const rows = result.results ?? [];
  const more = rows.length > FORUM_PAGE_SIZE && query.offset + FORUM_PAGE_SIZE <= FORUM_MAX_OFFSET;
  return {
    rows: rows.slice(0, FORUM_PAGE_SIZE),
    nextOffset: more ? query.offset + FORUM_PAGE_SIZE : null,
  };
}

/** A reader's own topics nobody else sees yet (waiting, refused or hidden), newest first, in the list's category and
 *  app. */
export async function ownWaitingTopics(
  env: Env,
  viewer: string,
  { category, app }: Pick<ForumListQuery, 'category' | 'app'>,
): Promise<TopicRow[]> {
  const result = await env.COMMUNITY_DB.prepare(
    `SELECT ${T_COLS}, ${TOPIC_EXTRAS} FROM forum_posts t
      WHERE t.author_id = ?1 AND t.topic_id IS NULL AND t.state <> 'listed' AND (?2 IS NULL OR t.category = ?2)
        AND (?4 IS NULL OR t.app = ?4)
      ORDER BY t.created_at DESC, t.id LIMIT ?3`,
  )
    .bind(viewer, category, FORUM_PAGE_SIZE, app)
    .all<TopicRow>();
  return result.results ?? [];
}

/** A topic's replies a reader may see (listed, or their own), oldest first, and whether its answer is listed. */
export async function readReplies(
  env: Env,
  topic: ForumRow,
  viewer: string | null,
): Promise<ForumRow[]> {
  const result = await env.COMMUNITY_DB.prepare(
    `SELECT ${COLS} FROM forum_posts WHERE topic_id = ?1 AND (state = 'listed' OR author_id = ?2)
      ORDER BY created_at, id LIMIT ?3`,
  )
    .bind(topic.id, viewer ?? '', FORUM_REPLIES_MAX)
    .all<ForumRow>();
  return result.results ?? [];
}

/** Every reaction on `postIds`, counted by kind, with the reader's own. One read for a whole topic. */
export async function reactionsFor(
  env: Env,
  postIds: string[],
  viewer: string | null,
): Promise<Map<string, ForumReactions>> {
  const out = new Map<string, ForumReactions>();
  if (postIds.length === 0) return out;
  const result = await env.COMMUNITY_DB.prepare(
    `SELECT post_id, reaction, COUNT(*) AS n, MAX(account_id = ?2) AS mine FROM forum_reactions
      WHERE post_id IN (SELECT value FROM json_each(?1)) GROUP BY post_id, reaction`,
  )
    .bind(JSON.stringify(postIds), viewer ?? '')
    .all<{ post_id: string; reaction: string; n: number; mine: number }>();
  for (const row of result.results ?? []) {
    if (!isForumReaction(row.reaction)) continue;
    let entry = out.get(row.post_id);
    if (!entry) {
      entry = { counts: noForumReactions(), mine: [] };
      out.set(row.post_id, entry);
    }
    entry.counts[row.reaction] = row.n;
    if (row.mine === 1) entry.mine.push(row.reaction);
  }
  // The reader's own in display order, whatever order the rows came in.
  for (const entry of out.values()) {
    entry.mine = FORUM_REACTIONS.map((r) => r.id).filter((id) => entry.mine.includes(id));
  }
  return out;
}

export async function replyCountOf(env: Env, topicId: string): Promise<number> {
  const row = await env.COMMUNITY_DB.prepare(
    'SELECT COUNT(*) AS n FROM forum_posts WHERE topic_id = ?',
  )
    .bind(topicId)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

const bumpTopic = (env: Env, topicId: string, now: number) =>
  env.COMMUNITY_DB.prepare(
    'UPDATE forum_posts SET activity_at = ?2 WHERE id = ?1 AND activity_at < ?2',
  ).bind(topicId, now);

export type NewForumPost = {
  topicId: string | null;
  category: string;
  app: string | null;
  accountId: string;
  author: ForumAuthor;
  title: string;
  body: string;
  state: ForumPostState;
};

/** A new topic or reply, in the state its check gave; a listed reply moves its topic up the list in the same batch. */
export async function insertForumPost(
  env: Env,
  post: NewForumPost,
  now: number,
): Promise<ForumRow> {
  const id = newPostId();
  const statements = [
    env.COMMUNITY_DB.prepare(
      `INSERT INTO forum_posts (id, topic_id, category, app, author_id, author_name, author_color, title, body, state,
         check_tries, checked_at, created_at, activity_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
    ).bind(
      id,
      post.topicId,
      post.category,
      post.app,
      post.accountId,
      post.author.name,
      post.author.color,
      post.title,
      post.body,
      post.state,
      now,
      now,
      now,
    ),
  ];
  if (post.topicId && post.state === 'listed') statements.push(bumpTopic(env, post.topicId, now));
  await env.COMMUNITY_DB.batch(statements);
  return (await getForumPost(env, id))!;
}

/** An edit by its author, in the state its check gave. Never a hidden post's. */
export async function editForumPost(
  env: Env,
  row: ForumRow,
  edit: { title?: string; body: string; author: ForumAuthor; state: ForumPostState },
  now: number,
): Promise<ForumRow | null> {
  const statements = [
    env.COMMUNITY_DB.prepare(
      `UPDATE forum_posts SET title = COALESCE(?2, title), body = ?3, author_name = ?4, author_color = ?5, state = ?6,
         edited_at = ?7, checked_at = ?7, check_tries = 1
       WHERE id = ?1 AND author_id = ?8 AND state <> 'hidden'`,
    ).bind(
      row.id,
      row.topic_id ? null : (edit.title ?? null),
      edit.body,
      edit.author.name,
      edit.author.color,
      edit.state,
      now,
      row.author_id,
    ),
  ];
  if (row.topic_id && edit.state === 'listed' && row.state !== 'listed') {
    statements.push(bumpTopic(env, row.topic_id, now));
  }
  await env.COMMUNITY_DB.batch(statements);
  const after = await getForumPost(env, row.id);
  return after && after.state !== 'hidden' ? after : null;
}

/** Deletes a post: a topic takes its replies, and a deleted answer clears its topic's mark (the foreign keys). */
export async function deleteForumPost(env: Env, id: string): Promise<void> {
  await env.COMMUNITY_DB.prepare('DELETE FROM forum_posts WHERE id = ?').bind(id).run();
}

/** Marks a topic's answer, or clears it (null). */
export async function setAnswer(env: Env, topicId: string, replyId: string | null): Promise<void> {
  await env.COMMUNITY_DB.prepare('UPDATE forum_posts SET answer_id = ? WHERE id = ?')
    .bind(replyId, topicId)
    .run();
}

/** Gives or takes back one reaction, idempotently. */
export async function setReaction(
  env: Env,
  postId: string,
  accountId: string,
  reaction: ForumReaction,
  on: boolean,
  now: number,
): Promise<void> {
  const statement = on
    ? env.COMMUNITY_DB.prepare(
        'INSERT OR IGNORE INTO forum_reactions (post_id, account_id, reaction, created_at) VALUES (?, ?, ?, ?)',
      ).bind(postId, accountId, reaction, now)
    : env.COMMUNITY_DB.prepare(
        'DELETE FROM forum_reactions WHERE post_id = ? AND account_id = ? AND reaction = ?',
      ).bind(postId, accountId, reaction);
  await statement.run();
}

/** A report, once per community key per post; three keys on three networks hide the post for good. Answers whether
 *  this report hid it. */
export async function recordForumReport(
  env: Env,
  postId: string,
  reporterKey: string,
  networkHash: string,
  reason: CommunityReportReason,
  note: string | null,
  now: number,
): Promise<boolean> {
  const inserted = await env.COMMUNITY_DB.prepare(
    `INSERT OR IGNORE INTO forum_reports (post_id, reporter_key, network_hash, reason, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(postId, reporterKey, networkHash, reason, note, now)
    .run();
  if (!inserted.meta?.changes) return false;
  const hidden = await env.COMMUNITY_DB.prepare(
    `UPDATE forum_posts SET state = 'hidden', hidden_at = ?3
      WHERE id = ?1 AND state = 'listed'
        AND (SELECT COUNT(DISTINCT reporter_key) FROM forum_reports WHERE post_id = ?1) >= ?2
        AND (SELECT COUNT(DISTINCT network_hash) FROM forum_reports WHERE post_id = ?1) >= ?2`,
  )
    .bind(postId, COMMUNITY_AUTO_HIDE_REPORTERS, now)
    .run();
  return (hidden.meta?.changes ?? 0) > 0;
}

/** Drops the reports made before `before`, and any whose post is gone. A post the reports hid stays hidden: the state is
 *  on the post, and reports are only counted while the post is listed. Answers how many went. */
export async function pruneForumReports(env: Env, before: number): Promise<number> {
  const result = await env.COMMUNITY_DB.prepare(
    `DELETE FROM forum_reports
      WHERE created_at < ?1
         OR NOT EXISTS (SELECT 1 FROM forum_posts p WHERE p.id = forum_reports.post_id)`,
  )
    .bind(before)
    .run();
  return result.meta?.changes ?? 0;
}

/** A closed account: every topic (with its replies), reply and reaction it wrote in the Forum, and its counters. */
export async function forgetForumAuthor(env: Env, accountId: string): Promise<void> {
  await env.COMMUNITY_DB.batch([
    env.COMMUNITY_DB.prepare('DELETE FROM forum_reactions WHERE account_id = ?').bind(accountId),
    env.COMMUNITY_DB.prepare('DELETE FROM forum_posts WHERE author_id = ?').bind(accountId),
    env.COMMUNITY_DB.prepare('DELETE FROM forum_counters WHERE subject IN (?1, ?2)').bind(
      `w:${accountId}`,
      `r:${accountId}`,
    ),
  ]);
}

/** The posts waiting for the check that are due another try, the longest waiting first. */
export async function pendingDue(env: Env, before: number, limit: number): Promise<ForumRow[]> {
  const result = await env.COMMUNITY_DB.prepare(
    `SELECT ${COLS} FROM forum_posts WHERE state = 'pending' AND checked_at <= ? ORDER BY checked_at LIMIT ?`,
  )
    .bind(before, limit)
    .all<ForumRow>();
  return result.results ?? [];
}

export type Verdict = 'pass' | 'refuse' | 'unavailable';

/** A waiting post's retried check, applied only if nothing (an edit) changed it since it was read. */
export async function settleCheck(
  env: Env,
  row: ForumRow,
  verdict: Verdict,
  now: number,
): Promise<void> {
  const guard = `WHERE id = ?1 AND state = 'pending' AND checked_at = ?2`;
  if (verdict === 'unavailable') {
    await env.COMMUNITY_DB.prepare(
      `UPDATE forum_posts SET checked_at = ?3, check_tries = check_tries + 1 ${guard}`,
    )
      .bind(row.id, row.checked_at, now)
      .run();
    return;
  }
  const state: ForumPostState = verdict === 'pass' ? 'listed' : 'refused';
  const statements = [
    env.COMMUNITY_DB.prepare(
      `UPDATE forum_posts SET state = ?3, checked_at = ?4, check_tries = check_tries + 1 ${guard}`,
    ).bind(row.id, row.checked_at, state, now),
  ];
  if (row.topic_id && state === 'listed') statements.push(bumpTopic(env, row.topic_id, now));
  await env.COMMUNITY_DB.batch(statements);
}
