// A card's comment threads (docs/specs/026-plan/items.md "Comments", blueprint item-store.md "REST"): list, start,
// reply, edit and delete a comment, react to one, resolve, reopen, rename, add to another card and delete, under
// /api/projects/:id/threads and /api/projects/:id/items/:itemId/threads. `:id` is the plan the caller views the
// thread through: their role there decides (a Participant or an Editor writes, a Viewer reads), and the thread must
// be on a card of it the caller reaches. The write itself is the home plan's (plan-room/card-thread-store.ts),
// directly when that is this plan, else over its `threadWrite`.

import {
  CARD_THREADS_MAX,
  isThreadFieldId,
  REACTION_BY_MAX,
  isReactionId,
  isThreadId,
  newThreadId,
  readThreadTitle,
  sanitizeMentions,
  startThread,
  threadForViewer,
  type CardRef,
  type CardThread,
  type ThreadChange,
} from '@liveplanner/project';
import {
  commentsFieldsOf,
  customFieldOf,
  typeIn,
  typesOf,
  type Item,
  type ItemTypeDef,
} from '@liveplanner/items';
import {
  COMMENT_TEXT_MAX,
  type CardThreadWriteResponse,
  type CardThreadsResponse,
} from '@liveplanner/api-schema';
import {
  linksOfPlan,
  linksOfThread,
  readThread,
  threadCountOfItem,
  type ThreadLink,
} from '../db/card-threads';
import { readItem } from '../db';
import { getParticipant } from '../person/profiles';
import { planRoom } from '../plan-client';
import {
  insertThread,
  linkThread,
  planThreads,
  unlinkThread,
  writeThread,
  type ThreadActor,
  type ThreadOp,
  type ThreadWriteResult,
} from '../plan-room/card-thread-store';
import { badRequest, json, methodNotAllowed, noContent } from '../responses';
import { afterCommentPosted, newComment } from './comment-routes';
import { gateEdit, readBody, type PlanRouteContext } from './context';
import { itemCaller, itemNotFound, type ItemCaller } from './item-route-kit';

const threadNotFound = () => json({ error: 'thread_not_found' }, { status: 404 });

// Each refusal of a write, by its name.
const REFUSALS: Record<string, number> = {
  thread_not_found: 404,
  comment_not_found: 404,
  item_not_found: 404,
  forbidden: 403,
  comments_full: 413,
  threads_full: 413,
  thread_cards_full: 413,
  title_too_long: 400,
  thread_on_card: 409,
  thread_busy: 409,
  // A thread holding anyone else's comment is resolved, never deleted (items.md "Deleting a thread").
  thread_has_others: 409,
  thread_other_plan: 400,
};

function refusal(error: string): Response {
  if (error === 'unchanged') return noContent();
  console.info('[threads] refused', { error });
  return json({ error }, { status: REFUSALS[error] ?? 400 });
}

const defer = (ctx: PlanRouteContext) => (p: Promise<unknown>) => {
  if (ctx.waitUntil) ctx.waitUntil(p);
  else void p;
};

// The partId a mention email names (email/templates.ts mentionedEmail): the card, and the thread its button opens.
const mentionPart = (itemId: string, threadId: string) => `${itemId}/${threadId}`;

// The thread as this caller reads it: author ids on their own comments only, and (a link confined to one tab) only
// the cards of this plan that tab shows, so it names no card beyond the link's reach.
function threadForCaller(thread: CardThread, caller: ItemCaller): CardThread {
  const seen = threadForViewer(thread, caller.owner);
  if (!caller.scope) return seen;
  const scope = caller.scope;
  return {
    ...seen,
    cards: seen.cards.filter((c) => c.projectId === caller.projectId && scope.has(c.itemId)),
  };
}

function answer(caller: ItemCaller, thread: CardThread | null, commentId?: string): Response {
  const body: CardThreadWriteResponse = {
    thread: thread ? threadForCaller(thread, caller) : null,
    ...(commentId ? { commentId } : {}),
  };
  return json(body);
}

// Whether the caller is an Editor here (on the plan, or on the one tab a link confines them to).
async function editorHere(ctx: PlanRouteContext, caller: ItemCaller): Promise<boolean> {
  const tabId = ctx.url.searchParams.get('tabId') ?? undefined;
  return (
    (await gateEdit(ctx, caller.projectId)) ||
    (!!tabId && (await gateEdit(ctx, caller.projectId, undefined, undefined, tabId)))
  );
}

type Reached = { caller: ItemCaller; links: ThreadLink[]; home: string };

// The caller, with the links naming this thread on the cards they reach here; 404 when there are none.
async function reach(
  ctx: PlanRouteContext,
  projectId: string,
  threadId: string,
  level: 'read' | 'participate',
): Promise<Reached | Response> {
  const caller = await itemCaller(ctx, projectId, level);
  if (caller instanceof Response) return caller;
  if (!isThreadId(threadId)) return threadNotFound();
  const links = (await linksOfThread(ctx.env, projectId, threadId)).filter(
    (l) => !caller.scope || caller.scope.has(l.itemId),
  );
  if (links.length === 0) return threadNotFound();
  return { caller, links, home: links[0]!.home };
}

// One write on the thread through its home.
function throughHome(
  ctx: PlanRouteContext,
  reached: Reached,
  threadId: string,
  op: ThreadOp,
): Promise<ThreadWriteResult> {
  const { caller, home } = reached;
  return home === caller.projectId
    ? writeThread(ctx.env, home, threadId, op, caller.projectId, defer(ctx))
    : planRoom(ctx.env, home).threadWrite(threadId, op, caller.projectId);
}

async function actorOf(
  ctx: PlanRouteContext,
  caller: ItemCaller,
  needsEditor: boolean,
): Promise<ThreadActor> {
  return {
    owner: caller.owner,
    editor: needsEditor ? await editorHere(ctx, caller) : false,
    agent: ctx.token !== null,
  };
}

const asCommenter = (caller: ItemCaller) => ({ doc: caller.doc!, owner: caller.owner });

// ---------- GET /threads -----------------------------------------------------------------------------------

async function list(ctx: PlanRouteContext, projectId: string): Promise<Response> {
  const caller = await itemCaller(ctx, projectId, 'read');
  if (caller instanceof Response) return caller;
  const only = ctx.url.searchParams.get('item');
  const links = (await linksOfPlan(ctx.env, projectId)).filter(
    (l) => (!caller.scope || caller.scope.has(l.itemId)) && (only === null || l.itemId === only),
  );
  const threads = await planThreads(ctx.env, projectId, links);
  console.info('[threads] listed', { count: threads.length, agent: ctx.token !== null });
  const body: CardThreadsResponse = { threads: threads.map((t) => threadForCaller(t, caller)) };
  return json(body);
}

// ---------- POST /items/:itemId/threads ----------------------------------------------------------------------

// The Comments field a new thread starts in (items.md "Comments", item-types.md "Comments and Votes fields"): absent
// is the built-in; else one of the card's type's Comments fields, or `field_invalid` naming the ones there are.
function readThreadField(
  body: Record<string, unknown>,
  type: ItemTypeDef,
): string | undefined | Response {
  if (body.field === undefined) return undefined;
  const fields = commentsFieldsOf(type);
  if (isThreadFieldId(body.field) && fields.includes(body.field)) return body.field;
  const names = fields.map((f) =>
    f === 'comments' ? 'comments (Comments)' : `${f} (${customFieldOf(type, f)?.label ?? f})`,
  );
  console.info('[threads] refused', { error: 'field_invalid' });
  return json(
    {
      error: 'field_invalid',
      message: names.length
        ? `field names a Comments field of the card's type ${type.label}: ${names.join(', ')}`
        : `a ${type.label} card has no Comments field to start a thread in`,
    },
    { status: 400 },
  );
}

const typeOfItem = (caller: ItemCaller, item: Item): ItemTypeDef =>
  typeIn(typesOf(caller.doc?.itemTypes), item.type);

export async function startOnCard(
  ctx: PlanRouteContext,
  projectId: string,
  itemId: string,
): Promise<Response> {
  const caller = await itemCaller(ctx, projectId, 'participate');
  if (caller instanceof Response) return caller;
  if (caller.scope && !caller.scope.has(itemId)) return itemNotFound();
  const body = await readBody(ctx);
  if (body instanceof Response) return body;
  const title = body.title === undefined ? '' : readThreadTitle(body.title);
  if (title === null) return refusal('title_too_long');
  const item = await readItem(ctx.env, projectId, itemId);
  if (!item) return itemNotFound();
  const field = readThreadField(body, typeOfItem(caller, item));
  if (field instanceof Response) return field;
  if ((await threadCountOfItem(ctx.env, projectId, itemId)) >= CARD_THREADS_MAX)
    return refusal('threads_full');
  const comment = await newComment(ctx, caller.owner, body);
  if (comment instanceof Response) return comment;
  const now = Date.now();
  const thread = startThread({
    id: newThreadId(() => crypto.getRandomValues(new Uint32Array(1))[0]! / 2 ** 32),
    home: projectId,
    card: { projectId, itemId, key: item.key },
    comment,
    title,
    ...(field ? { field } : {}),
    now,
  });
  await insertThread(ctx.env, thread, defer(ctx));
  afterCommentPosted(ctx, asCommenter(caller), comment, mentionPart(itemId, thread.id));
  console.info('[threads] started', { agent: ctx.token !== null });
  const res = answer(caller, thread, comment.id);
  return new Response(res.body, { status: 201, headers: res.headers });
}

// ---------- The writes on one thread ------------------------------------------------------------------------

// A comment's text and mentions, as a post's (newComment's checks).
function readText(body: Record<string, unknown>): { text: string } | Response {
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!text) return badRequest('missing text');
  if (text.length > COMMENT_TEXT_MAX) return badRequest('text too long');
  return { text };
}

async function reply(ctx: PlanRouteContext, r: Reached, threadId: string): Promise<Response> {
  const body = await readBody(ctx);
  if (body instanceof Response) return body;
  const comment = await newComment(ctx, r.caller.owner, body);
  if (comment instanceof Response) return comment;
  const actor = await actorOf(ctx, r.caller, false);
  const out = await throughHome(ctx, r, threadId, {
    kind: 'change',
    change: { kind: 'add', comment },
    actor,
  });
  if (!out.ok) return refusal(out.error);
  afterCommentPosted(
    ctx,
    asCommenter(r.caller),
    comment,
    mentionPart(r.links[0]!.itemId, threadId),
  );
  console.info('[threads] replied', { agent: actor.agent });
  return answer(r.caller, out.thread, comment.id);
}

async function edit(
  ctx: PlanRouteContext,
  r: Reached,
  threadId: string,
  commentId: string,
): Promise<Response> {
  const body = await readBody(ctx);
  if (body instanceof Response) return body;
  const read = readText(body);
  if (read instanceof Response) return read;
  const mentions = sanitizeMentions(body.mentions);
  const change: ThreadChange = {
    kind: 'edit',
    commentId,
    text: read.text,
    ...(mentions ? { mentions } : {}),
  };
  const actor = await actorOf(ctx, r.caller, false);
  const out = await throughHome(ctx, r, threadId, { kind: 'change', change, actor });
  if (!out.ok) return refusal(out.error);
  console.info('[threads] comment.edited', { agent: actor.agent });
  return answer(r.caller, out.thread, commentId);
}

async function removeComment(
  ctx: PlanRouteContext,
  r: Reached,
  threadId: string,
  commentId: string,
): Promise<Response> {
  const actor = await actorOf(ctx, r.caller, true);
  const out = await throughHome(ctx, r, threadId, {
    kind: 'change',
    change: { kind: 'remove', commentId },
    actor,
  });
  if (!out.ok) return refusal(out.error);
  console.info('[threads] comment.deleted', { editor: actor.editor, agent: actor.agent });
  return answer(r.caller, out.thread);
}

// POST .../threads/:threadId/comments/:commentId/reactions { emoji, on, key }: the caller's own reaction on one
// comment (docs/specs/012-collaboration/comment-reactions.md), taking part like a reply. `key` is the caller's
// public collab key, the id the editor marks its own reactions by; the name is the server's, from their profile.
async function react(
  ctx: PlanRouteContext,
  r: Reached,
  threadId: string,
  commentId: string,
): Promise<Response> {
  const body = await readBody(ctx);
  if (body instanceof Response) return body;
  const { emoji, on, key } = body;
  if (!isReactionId(emoji)) return badRequest('unknown emoji');
  if (typeof on !== 'boolean') return badRequest('missing on');
  if (typeof key !== 'string' || !key || key.length > REACTION_BY_MAX)
    return badRequest('missing key');
  const actor = await actorOf(ctx, r.caller, false);
  const name = (await getParticipant(ctx.env, r.caller.owner))?.name ?? 'Someone';
  const out = await throughHome(ctx, r, threadId, {
    kind: 'change',
    change: { kind: 'react', commentId, emoji, by: key, name, on },
    actor,
  });
  if (!out.ok) return refusal(out.error);
  console.info('[threads] comment.reacted', { on, agent: actor.agent });
  return answer(r.caller, out.thread, commentId);
}

async function setResolved(
  ctx: PlanRouteContext,
  r: Reached,
  threadId: string,
  resolved: boolean,
): Promise<Response> {
  const actor = await actorOf(ctx, r.caller, false);
  const by = (await getParticipant(ctx.env, r.caller.owner))?.name ?? 'Someone';
  const out = await throughHome(ctx, r, threadId, {
    kind: 'change',
    change: { kind: 'resolve', resolved, by },
    actor,
  });
  if (!out.ok) return refusal(out.error);
  console.info(`[threads] ${resolved ? 'resolved' : 'reopened'}`, { agent: actor.agent });
  return answer(r.caller, out.thread);
}

async function rename(ctx: PlanRouteContext, r: Reached, threadId: string): Promise<Response> {
  const body = await readBody(ctx);
  if (body instanceof Response) return body;
  const title = readThreadTitle(body.title);
  if (title === null) return refusal('title_too_long');
  const actor = await actorOf(ctx, r.caller, false);
  const out = await throughHome(ctx, r, threadId, {
    kind: 'change',
    change: { kind: 'rename', title },
    actor,
  });
  if (!out.ok) return refusal(out.error);
  console.info('[threads] renamed', { cleared: title === '' });
  return answer(r.caller, out.thread);
}

// The thread as the caller reaches it now, from its home.
async function currentThread(
  ctx: PlanRouteContext,
  r: Reached,
  threadId: string,
): Promise<CardThread | null> {
  if (r.home === r.caller.projectId) return readThread(ctx.env, r.home, threadId);
  const [t] = await planRoom(ctx.env, r.home).threadsFor([threadId], r.caller.projectId);
  return t ?? null;
}

// Add Thread to Card: another card of this plan, never one in another plan (docs/specs/026-plan/items.md "Stored
// once, on every card"). The card takes the link first, then the home lists it; a home that refuses has the link
// taken back. A thread shared in before that rule has another home, which is asked as for any other write.
async function addToCard(ctx: PlanRouteContext, r: Reached, threadId: string): Promise<Response> {
  if (ctx.token) return refusal('forbidden');
  const body = await readBody(ctx);
  if (body instanceof Response) return body;
  const itemId = typeof body.itemId === 'string' ? body.itemId : '';
  if (!itemId) return badRequest('missing itemId');
  const here = r.caller.projectId;
  const named = body.projectId;
  if (typeof named === 'string' && named && named !== here) return refusal('thread_other_plan');
  if (r.caller.scope && !r.caller.scope.has(itemId)) return itemNotFound();
  const thread = await currentThread(ctx, r, threadId);
  if (!thread) return threadNotFound();
  const link = {
    threadId,
    home: r.home,
    itemId,
    openComments: thread.resolved ? 0 : thread.comments.length,
  };
  const linked = await linkThread(ctx.env, here, link);
  if (!linked.ok) return refusal(linked.error);
  const card: CardRef = { projectId: here, itemId, key: linked.key };
  const actor = await actorOf(ctx, r.caller, false);
  const out = await throughHome(ctx, r, threadId, {
    kind: 'change',
    change: { kind: 'addCard', card },
    actor,
  });
  if (!out.ok) {
    await unlinkThread(ctx.env, here, threadId, itemId);
    return refusal(out.error);
  }
  console.info('[threads] added to card');
  return answer(r.caller, out.thread);
}

async function deleteThread(
  ctx: PlanRouteContext,
  r: Reached,
  threadId: string,
): Promise<Response> {
  const actor = await actorOf(ctx, r.caller, true);
  const out = await throughHome(ctx, r, threadId, { kind: 'delete', actor });
  if (!out.ok) return refusal(out.error);
  console.info('[threads] deleted', { editor: actor.editor });
  return noContent();
}

// ---------- Dispatch ---------------------------------------------------------------------------------------

// /api/projects/:id/threads[...]: segments[3] === 'threads'. Null for a path that is not one of these.
export async function handleThreadRoutes(ctx: PlanRouteContext): Promise<Response | null> {
  const { segments, request } = ctx;
  if (segments[3] !== 'threads') return null;
  const projectId = segments[2]!;
  const method = request.method;
  if (segments.length === 4) return method === 'GET' ? list(ctx, projectId) : methodNotAllowed();
  const threadId = segments[4]!;
  const write = async (run: (r: Reached) => Promise<Response>): Promise<Response> => {
    const r = await reach(ctx, projectId, threadId, 'participate');
    return r instanceof Response ? r : run(r);
  };
  const post = (run: (r: Reached) => Promise<Response>) =>
    method === 'POST' ? write(run) : methodNotAllowed();
  if (segments.length === 5)
    return method === 'DELETE' ? write((r) => deleteThread(ctx, r, threadId)) : methodNotAllowed();
  if (segments.length === 6) {
    if (segments[5] === 'comments') return post((r) => reply(ctx, r, threadId));
    if (segments[5] === 'resolve') return post((r) => setResolved(ctx, r, threadId, true));
    if (segments[5] === 'reopen') return post((r) => setResolved(ctx, r, threadId, false));
    if (segments[5] === 'cards') return post((r) => addToCard(ctx, r, threadId));
    if (segments[5] === 'title')
      return method === 'PUT' ? write((r) => rename(ctx, r, threadId)) : methodNotAllowed();
    return null;
  }
  if (segments.length === 7 && segments[5] === 'comments') {
    const commentId = segments[6]!;
    if (method === 'PUT') return write((r) => edit(ctx, r, threadId, commentId));
    if (method === 'DELETE') return write((r) => removeComment(ctx, r, threadId, commentId));
    return methodNotAllowed();
  }
  if (segments.length === 8 && segments[5] === 'comments' && segments[7] === 'reactions')
    return post((r) => react(ctx, r, threadId, segments[6]!));
  return null;
}
