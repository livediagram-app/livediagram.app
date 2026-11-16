// The Forum's routes (liveworkspace/docs/specs/007-community/community.md "Forum routes"; blueprint "The Forum"):
// `/api/community/forum/*`, one forum for every app. Reads are public; a read with an account token also answers the
// reader's own waiting posts. Every write but a report needs a signed-in account, then passes, in order, validation,
// the target's checks, the account's hourly count and the check before it is stored.

import {
  COMMUNITY_KEY_HEADER,
  FORUM_REACTIONS_PER_HOUR,
  FORUM_REPLIES_MAX,
  FORUM_WRITES_PER_HOUR,
  communityNetwork,
  isCommunityKey,
  isForumReaction,
  parseForumListQuery,
  validateForumAuthor,
  validateForumEdit,
  validateForumReply,
  validateForumTopic,
  type ForumPostState,
  type ForumReactions,
  type ForumTopicResponse,
  type ForumTopicsResponse,
} from '@liveworkspace/community';
import { readCappedBody } from '@liveworkspace/api-kit/request-body';
import { LIST_MAX_AGE_S, MAX_BODY_BYTES } from '../config';
import type { Env } from '../env';
import { badRequest, conflict, json, noContent, notFound } from '../http';
import { clientIp, networkHash } from '../network';
import { readReport } from '../public-routes';
import { forumAccountOf } from './account';
import { checkedText, checkForumText } from './check';
import { countAgainst, HOUR_MS } from './rate';
import {
  deleteForumPost,
  editForumPost,
  forumReply,
  forumTopic,
  getForumPost,
  insertForumPost,
  listTopics,
  ownWaitingTopics,
  reactionsFor,
  readReplies,
  recordForumReport,
  replyCountOf,
  setAnswer,
  setReaction,
  topicSummary,
  visibleTo,
  type ForumRow,
  type Verdict,
} from './store';

const STATE_OF: Record<Verdict, ForumPostState> = {
  pass: 'listed',
  refuse: 'refused',
  unavailable: 'pending',
};

const unauthorised = () => json({ error: 'sign_in_required' }, { status: 401 });
const rateLimited = () => json({ error: 'rate_limited' }, { status: 429 });

// A read with a token answers that person's own posts too, so only an anonymous one may be kept.
const cacheHeaders = (viewer: string | null): HeadersInit => ({
  'Cache-Control': viewer ? 'private, no-store' : `public, max-age=${LIST_MAX_AGE_S}`,
});

// Anyone can send a body here, so it is read through a byte counter: a chunked one declares no length.
async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const bytes =
      request.body &&
      (await readCappedBody(request.body as ReadableStream<Uint8Array>, MAX_BODY_BYTES));
    if (!bytes) return null;
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** `path` is what follows /api/community/forum. */
export async function handleForum(
  request: Request,
  env: Env,
  path: string,
  url: URL,
  now: number = Date.now(),
): Promise<Response> {
  const segments = path.split('/').filter(Boolean);
  const method = request.method;
  const [kind, id, action, extra] = segments;

  if (kind === 'posts' && id && action === 'report' && segments.length === 3 && method === 'POST') {
    return report(request, env, id, now);
  }

  // Everything else may name who is asking: a read to answer their own posts, a write to be allowed at all.
  const viewer = await forumAccountOf(request, env);

  if (kind === 'topics' && segments.length === 1) {
    if (method === 'GET') return list(env, url, viewer);
    if (method === 'POST') return createTopic(request, env, viewer, now);
    return notFound();
  }
  if (kind === 'topics' && id && segments.length === 2 && method === 'GET') {
    return readTopic(env, id, viewer);
  }
  if (
    kind === 'topics' &&
    id &&
    action === 'replies' &&
    segments.length === 3 &&
    method === 'POST'
  ) {
    return createReply(request, env, id, viewer, now);
  }
  if (kind === 'topics' && id && action === 'answer' && segments.length === 3) {
    if (method === 'PUT' || method === 'DELETE') return answer(request, env, id, viewer);
    return notFound();
  }
  if (kind === 'posts' && id && segments.length === 2) {
    if (method === 'PATCH') return edit(request, env, id, viewer, now);
    if (method === 'DELETE') return remove(env, id, viewer);
    return notFound();
  }
  if (kind === 'posts' && id && action === 'reactions' && segments.length === 4) {
    if (method === 'PUT' || method === 'DELETE') {
      return react(env, id, extra!, method === 'PUT', viewer, now);
    }
  }
  return notFound();
}

async function list(env: Env, url: URL, viewer: string | null): Promise<Response> {
  const query = parseForumListQuery(url.searchParams);
  const [{ rows, nextOffset }, own] = await Promise.all([
    listTopics(env, query),
    viewer && query.offset === 0 ? ownWaitingTopics(env, viewer, query.category) : [],
  ]);
  const body: ForumTopicsResponse = {
    topics: [...own, ...rows].map((row) => topicSummary(row, viewer)),
    nextOffset,
  };
  return json(body, { headers: cacheHeaders(viewer) });
}

async function readTopic(env: Env, id: string, viewer: string | null): Promise<Response> {
  const row = await getForumPost(env, id);
  if (!row || row.topic_id !== null || !visibleTo(row, viewer)) return notFound();
  const replies = await readReplies(env, row, viewer);
  const reactions = await reactionsFor(env, [row.id, ...replies.map((r) => r.id)], viewer);
  const answer = replies.find((r) => r.id === row.answer_id && r.state === 'listed') ?? null;
  // The answer first, then the rest as they were written.
  const ordered = answer ? [answer, ...replies.filter((r) => r !== answer)] : replies;
  const body: ForumTopicResponse = {
    topic: forumTopic(row, viewer, reactions.get(row.id), answer !== null),
    replies: ordered.map((r) => forumReply(r, viewer, reactions.get(r.id))),
  };
  return json(body, { headers: cacheHeaders(viewer) });
}

// The account's write budget for this hour; past it nothing more is checked or stored.
const underWriteLimit = (env: Env, account: string, now: number) =>
  countAgainst(env, `w:${account}`, HOUR_MS, FORUM_WRITES_PER_HOUR, now);

async function createTopic(
  request: Request,
  env: Env,
  account: string | null,
  now: number,
): Promise<Response> {
  if (!account) return unauthorised();
  const body = await readBody(request);
  if (!body) return badRequest('invalid_body');
  const input = validateForumTopic(body);
  if (!input.ok) return badRequest(input.error);
  const author = validateForumAuthor(body.author, account);
  if (!author.ok) return badRequest(author.error);
  if (!(await underWriteLimit(env, account, now))) return rateLimited();
  const { category, title, body: text } = input.value;
  const verdict = await checkForumText(env, checkedText(author.value.name, title, text), now);
  const row = await insertForumPost(
    env,
    {
      topicId: null,
      category,
      accountId: account,
      author: author.value,
      title,
      body: text,
      state: STATE_OF[verdict],
    },
    now,
  );
  console.info('[forum] posted', { kind: 'topic', state: row.state });
  return json({ topic: forumTopic(row, account) }, { status: 201 });
}

async function createReply(
  request: Request,
  env: Env,
  topicId: string,
  account: string | null,
  now: number,
): Promise<Response> {
  if (!account) return unauthorised();
  const body = await readBody(request);
  if (!body) return badRequest('invalid_body');
  const input = validateForumReply(body);
  if (!input.ok) return badRequest(input.error);
  const author = validateForumAuthor(body.author, account);
  if (!author.ok) return badRequest(author.error);
  // Replies go to a listed topic only: nobody else could read one under a waiting, refused or hidden topic.
  const topic = await getForumPost(env, topicId);
  if (!topic || topic.topic_id !== null || topic.state !== 'listed') return notFound();
  if ((await replyCountOf(env, topic.id)) >= FORUM_REPLIES_MAX) return conflict('topic_full');
  if (!(await underWriteLimit(env, account, now))) return rateLimited();
  const verdict = await checkForumText(
    env,
    checkedText(author.value.name, '', input.value.body),
    now,
  );
  const row = await insertForumPost(
    env,
    {
      topicId: topic.id,
      category: topic.category,
      accountId: account,
      author: author.value,
      title: '',
      body: input.value.body,
      state: STATE_OF[verdict],
    },
    now,
  );
  console.info('[forum] posted', { kind: 'reply', state: row.state });
  return json({ reply: forumReply(row, account) }, { status: 201 });
}

// The caller's own post, or null: someone else's answers 404, as one that isn't there.
async function ownPost(env: Env, id: string, account: string): Promise<ForumRow | null> {
  const row = await getForumPost(env, id);
  return row && row.author_id === account ? row : null;
}

async function edit(
  request: Request,
  env: Env,
  id: string,
  account: string | null,
  now: number,
): Promise<Response> {
  if (!account) return unauthorised();
  const row = await ownPost(env, id, account);
  if (!row) return notFound();
  if (row.state === 'hidden') return conflict('post_hidden');
  const body = await readBody(request);
  if (!body) return badRequest('invalid_body');
  const isTopic = row.topic_id === null;
  const input = validateForumEdit(body, isTopic);
  if (!input.ok) return badRequest(input.error);
  const author = validateForumAuthor(body.author, account);
  if (!author.ok) return badRequest(author.error);
  if (!(await underWriteLimit(env, account, now))) return rateLimited();
  const title = isTopic ? (input.value.title ?? row.title) : '';
  const verdict = await checkForumText(
    env,
    checkedText(author.value.name, title, input.value.body),
    now,
  );
  const after = await editForumPost(
    env,
    row,
    { title, body: input.value.body, author: author.value, state: STATE_OF[verdict] },
    now,
  );
  // Hidden after reports while the check ran: final, as if it had been hidden first.
  if (!after) return conflict('post_hidden');
  console.info('[forum] edited', { state: after.state });
  const reactions = (await reactionsFor(env, [after.id], account)).get(after.id);
  return json({
    post: isTopic ? forumTopic(after, account, reactions) : forumReply(after, account, reactions),
  });
}

async function remove(env: Env, id: string, account: string | null): Promise<Response> {
  if (!account) return unauthorised();
  const row = await ownPost(env, id, account);
  if (!row) return notFound();
  await deleteForumPost(env, row.id);
  console.info('[forum] deleted', { kind: row.topic_id ? 'reply' : 'topic' });
  return noContent();
}

async function answer(
  request: Request,
  env: Env,
  topicId: string,
  account: string | null,
): Promise<Response> {
  if (!account) return unauthorised();
  const topic = await ownPost(env, topicId, account);
  if (!topic || topic.topic_id !== null || topic.state !== 'listed') return notFound();
  if (request.method === 'DELETE') {
    await setAnswer(env, topic.id, null);
    return json({ answerId: null });
  }
  const body = await readBody(request);
  const replyId = typeof body?.reply === 'string' ? body.reply : null;
  if (!replyId) return badRequest('invalid_reply');
  const reply = await getForumPost(env, replyId);
  if (!reply || reply.topic_id !== topic.id || reply.state !== 'listed') return notFound();
  await setAnswer(env, topic.id, reply.id);
  console.info('[forum] answer marked');
  return json({ answerId: reply.id });
}

async function react(
  env: Env,
  postId: string,
  reaction: string,
  on: boolean,
  account: string | null,
  now: number,
): Promise<Response> {
  if (!account) return unauthorised();
  if (!isForumReaction(reaction)) return notFound();
  const row = await getForumPost(env, postId);
  if (!row || row.state !== 'listed') return notFound();
  if (!(await countAgainst(env, `r:${account}`, HOUR_MS, FORUM_REACTIONS_PER_HOUR, now))) {
    return rateLimited();
  }
  await setReaction(env, row.id, account, reaction, on, now);
  const reactions: ForumReactions | undefined = (await reactionsFor(env, [row.id], account)).get(
    row.id,
  );
  return json({
    reactions: reactions ?? { counts: { helpful: 0, thanks: 0, celebrate: 0 }, mine: [] },
  });
}

async function report(request: Request, env: Env, postId: string, now: number): Promise<Response> {
  const key = request.headers.get(COMMUNITY_KEY_HEADER);
  if (!isCommunityKey(key)) return badRequest('community_key_required');
  const ip = clientIp(request);
  // Anonymous, as a gallery report: each network gets the same budget.
  if (env.COMMUNITY_RATE_LIMITER) {
    const { success } = await env.COMMUNITY_RATE_LIMITER.limit({ key: communityNetwork(ip) });
    if (!success) return rateLimited();
  }
  const row = await getForumPost(env, postId);
  if (!row || row.state !== 'listed') return notFound();
  const body = await readReport(request);
  if (typeof body === 'string') return badRequest(body);
  const hidden = await recordForumReport(
    env,
    row.id,
    key,
    await networkHash(row.id, ip),
    body.reason,
    body.note,
    now,
  );
  if (hidden) console.info('[forum] auto-hidden', { postId: row.id });
  return noContent();
}
