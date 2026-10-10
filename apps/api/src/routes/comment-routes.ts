// The comment endpoints (docs/specs/024-agents/agent-presence.md "Comments", blueprint "REST"): add, delete-own,
// reply, resolve and reopen on a tab, and the thread listing across a document. People and agents use the same
// endpoints, gated by participation; every write goes through the tab's revision (I8), retried once on a lost
// race, and reaches the room as an `el-delta` without author or token ids.

import { logRefusal } from './refusal-log';
import {
  COMMENT_TEXT_MAX,
  isCommentListStatus,
  type DocumentCommentThread,
  type DocumentCommentsResponse,
} from '@livediagram/api-schema';
import {
  applyElementDelta,
  sanitizeMentions,
  type Comment,
  type CommentThread,
  type Element,
  type ElementDelta,
} from '@livediagram/document';
import { findCommentHost, removeComment, threadsOfTab } from '../comments';
import {
  getDocument,
  getParticipant,
  getTab,
  isTabRevStale,
  tabIdsWithComments,
  upsertTabAtRev,
} from '../db';
import { emailEnabled } from '../email/client';
import { notifyNewComment } from '../email/notifications';
import { storeTab } from '../limits';
import {
  badRequest,
  forbidden,
  json,
  methodNotAllowed,
  noContent,
  notFound,
  payloadTooLarge,
} from '../responses';
import { relayElementDelta } from '../room-client';
import { recordCommentAdded, recordCommentResolved, retractComments } from '../timeline';
import type { TabDTO } from '../types';
import {
  deniedOnTab,
  deniedParticipate,
  gateParticipate,
  gateRead,
  missingDocument,
  readBody,
  requireOwner,
  type RouteContext,
} from './context';

type ThreadVerb = 'reply' | 'resolve' | 'reopen';

type Doc = NonNullable<Awaited<ReturnType<typeof getDocument>>>;
export type CommentCaller = { doc: Doc; owner: string };
type Caller = CommentCaller;

const threadOf = (el: Element) => (el as { commentThread?: CommentThread }).commentThread;

// The caller and the document, when the caller may take part on the tab.
async function participant(
  ctx: RouteContext,
  id: string,
  tabId: string,
): Promise<Caller | Response> {
  const owner = requireOwner(ctx);
  if (owner instanceof Response) return owner;
  const doc = await getDocument(ctx.env, id);
  if (!doc) return missingDocument(ctx, id);
  // Commenting is a Participant's (docs/specs/013-workspace/share-roles.md): a Viewer only looks.
  if (!(await gateParticipate(ctx, id, doc.ownerId, doc.teamId, tabId)))
    return deniedParticipate(ctx, doc, tabId);
  return { doc, owner };
}

// What a verb does to the tab it read: new elements and the delta the room hears, nothing to write, or a refusal.
type Change = { elements: Element[]; elementId: string; delta: ElementDelta };
type Mutation = Change | 'unchanged' | Response;

// Reads the tab, applies `mutate` and writes at the revision read; a lost race re-reads and repeats once, then
// answers 409 `tab_busy` (PR22). The delta is relayed after the write lands.
async function writeTab(
  ctx: RouteContext,
  id: string,
  tabId: string,
  mutate: (tab: TabDTO) => Mutation,
): Promise<{ tab: TabDTO; change: Change | null } | Response> {
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const tab = await getTab(ctx.env, id, tabId);
    if (!tab) return notFound();
    const change = mutate(tab);
    if (change instanceof Response) return change;
    if (change === 'unchanged') return { tab, change: null };
    try {
      const write = () =>
        upsertTabAtRev(ctx.env, id, { ...tab, elements: change.elements }, tab.orderIndex, tab.rev);
      if (!(await storeTab(write))) return payloadTooLarge();
    } catch (err) {
      if (!isTabRevStale(err)) throw err;
      console.info('[comments] lost race', { documentId: id, tabId, attempt });
      continue;
    }
    ctx.waitUntil?.(relayElementDelta(ctx.env, id, tabId, change.elementId, change.delta));
    return { tab, change };
  }
  return json({ error: 'tab_busy', message: 'the tab kept changing; try again' }, { status: 409 });
}

// A new comment from the caller, its author fields server-stamped (and the token id, for an agent: PR23). A
// Plan card's comment writes (item-routes.ts) post through it too (docs/specs/026-plan/items.md "Comments").
export async function newComment(
  ctx: RouteContext,
  owner: string,
  body: Record<string, unknown>,
): Promise<Comment | Response> {
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!text) return badRequest('missing text');
  if (text.length > COMMENT_TEXT_MAX) return badRequest('text too long');
  const mentions = sanitizeMentions(body.mentions);
  const writer = await getParticipant(ctx.env, owner);
  return {
    id: crypto.randomUUID(),
    text,
    createdAt: Date.now(),
    authorName: writer?.name ?? 'Anonymous',
    authorColor: writer?.color ?? '#94a3b8',
    authorId: owner,
    ...(ctx.token ? { tokenId: ctx.token.id } : {}),
    ...(mentions ? { mentions } : {}),
  };
}

// Which comment route a path of this many segments is; a thread verb names itself (its last segment).
const COMMENT_ROUTE_NAMES: Record<number, string> = { 4: 'list', 6: 'add', 7: 'delete' };

// Appends `comment` to the thread of `elementId`, as the editor does (it unresolves a resolved thread).
function appended(tab: TabDTO, elementId: string, comment: Comment): Mutation {
  const target = tab.elements.find((el) => el.id === elementId);
  if (!target || target.type === 'arrow') return notFound();
  const { authorId: _a, tokenId: _t, ...publicComment } = comment;
  return {
    elements: tab.elements.map((el) =>
      el.id === elementId ? applyElementDelta(el, { kind: 'comment-add', comment }) : el,
    ),
    elementId,
    delta: { kind: 'comment-add', comment: publicComment },
  };
}

// The timeline and the owner's email for a posted comment (add and reply alike, on the canvas or on a card).
export function afterCommentPosted(
  ctx: RouteContext,
  caller: Caller,
  comment: Comment,
  reply: boolean,
): void {
  const { doc, owner } = caller;
  ctx.waitUntil?.(
    recordCommentAdded(
      ctx.env,
      doc,
      {
        id: comment.id,
        text: comment.text,
        authorName: comment.authorName,
        authorColor: comment.authorColor,
        reply,
      },
      owner,
    ),
  );
  if (emailEnabled(ctx.env) && owner !== doc.ownerId)
    ctx.waitUntil?.(
      notifyNewComment(
        ctx.env,
        { id: doc.id, ownerId: doc.ownerId, name: doc.name },
        comment.authorName,
      ),
    );
}

async function addComment(ctx: RouteContext, id: string, tabId: string): Promise<Response> {
  const caller = await participant(ctx, id, tabId);
  if (caller instanceof Response) return caller;
  const body = await readBody(ctx);
  if (body instanceof Response) return body;
  const elementId = typeof body.elementId === 'string' ? body.elementId : null;
  if (!elementId) return badRequest('missing elementId');
  const comment = await newComment(ctx, caller.owner, body);
  if (comment instanceof Response) return comment;
  let reply = false;
  const written = await writeTab(ctx, id, tabId, (tab) => {
    const target = tab.elements.find((el) => el.id === elementId);
    reply = (target ? (threadOf(target)?.comments.length ?? 0) : 0) > 0;
    return appended(tab, elementId, comment);
  });
  if (written instanceof Response) return written;
  afterCommentPosted(ctx, caller, comment, reply);
  console.info('[comments] added', { documentId: id, tabId, agent: ctx.token !== null });
  return json({ comment }, { status: 201 });
}

// Delete-own only: removing someone else's comment goes through the edit-gated tab save.
async function deleteOwn(
  ctx: RouteContext,
  id: string,
  tabId: string,
  commentId: string,
): Promise<Response> {
  const caller = await participant(ctx, id, tabId);
  if (caller instanceof Response) return caller;
  let threadKey: string | null = null;
  const written = await writeTab(ctx, id, tabId, (tab) => {
    const host = findCommentHost(tab.elements, commentId);
    if (!host) return notFound();
    if (host.comment.authorId !== caller.owner) return forbidden();
    const el = tab.elements.find((e) => e.id === host.elementId)!;
    // The opening comment's text is what the thread's resolved event says.
    threadKey = threadOf(el)?.comments[0]?.id === commentId ? `${id}:${host.elementId}` : null;
    return {
      elements: removeComment(tab.elements, commentId),
      elementId: host.elementId,
      delta: { kind: 'comment-remove', commentId },
    };
  });
  if (written instanceof Response) return written;
  ctx.waitUntil?.(retractComments(ctx.env, id, [{ id: commentId, threadKey }]));
  console.info('[comments] deleted', { documentId: id, tabId, agent: ctx.token !== null });
  return noContent();
}

async function threadVerb(
  ctx: RouteContext,
  id: string,
  tabId: string,
  commentId: string,
  verb: ThreadVerb,
): Promise<Response> {
  const caller = await participant(ctx, id, tabId);
  if (caller instanceof Response) return caller;
  if (verb === 'reply') {
    const body = await readBody(ctx);
    if (body instanceof Response) return body;
    const comment = await newComment(ctx, caller.owner, body);
    if (comment instanceof Response) return comment;
    const written = await writeTab(ctx, id, tabId, (tab) => {
      const host = findCommentHost(tab.elements, commentId);
      return host ? appended(tab, host.elementId, comment) : notFound();
    });
    if (written instanceof Response) return written;
    afterCommentPosted(ctx, caller, comment, true);
    console.info('[comments] replied', { documentId: id, tabId, agent: ctx.token !== null });
    return json({ comment }, { status: 201 });
  }
  const resolved = verb === 'resolve';
  let opening: string | null = null;
  const written = await writeTab(ctx, id, tabId, (tab) => {
    const host = findCommentHost(tab.elements, commentId);
    if (!host) return notFound();
    const el = tab.elements.find((e) => e.id === host.elementId)!;
    const thread = threadOf(el)!;
    opening = thread.comments[0]?.text ?? null;
    // Resolving a resolved thread, or reopening an open one, writes and relays nothing (PR17).
    if (thread.resolved === resolved) return 'unchanged';
    const delta: ElementDelta = { kind: 'comment-resolve', resolved };
    return {
      elements: tab.elements.map((e) => (e.id === el.id ? applyElementDelta(e, delta) : e)),
      elementId: el.id,
      delta,
    };
  });
  if (written instanceof Response) return written;
  if (written.change && resolved)
    ctx.waitUntil?.(
      recordCommentResolved(
        ctx.env,
        caller.doc,
        `${id}:${written.change.elementId}`,
        opening,
        caller.owner,
      ),
    );
  console.info(
    `[comments] ${written.change ? (resolved ? 'resolved' : 'reopened') : `${verb} unchanged`}`,
    {
      documentId: id,
      tabId,
      agent: ctx.token !== null,
    },
  );
  return noContent();
}

// GET /api/documents/:id/comments?status=: the threads across the document, one tab read at a time (PR21). A
// grant confined to one tab lists that tab only.
async function listThreads(ctx: RouteContext, id: string): Promise<Response> {
  const status = ctx.url.searchParams.get('status') ?? 'open';
  if (!isCommentListStatus(status)) return json({ error: 'invalid_status' }, { status: 400 });
  const doc = await getDocument(ctx.env, id);
  if (!doc) return missingDocument(ctx, id);
  const whole = await gateRead(ctx, id, doc.ownerId, doc.teamId);
  const viewer = ctx.resolveOwner();
  const threads: DocumentCommentThread[] = [];
  let readable = whole;
  let tabsRead = 0;
  for (const tabId of await tabIdsWithComments(ctx.env, id)) {
    if (!whole && !(await gateRead(ctx, id, doc.ownerId, doc.teamId, tabId))) continue;
    readable = true;
    // A tab whose body does not parse is left out of the list, not the whole list refused (E21).
    try {
      const tab = await getTab(ctx.env, id, tabId);
      if (tab) threads.push(...threadsOfTab(tab, status, viewer));
      tabsRead++;
    } catch (err) {
      console.warn('[comments] list skipped tab', { documentId: id, tabId, error: String(err) });
    }
  }
  if (!readable) return deniedOnTab(ctx, doc);
  console.info('[comments] listed', { documentId: id, status, tabsRead, threads: threads.length });
  const body: DocumentCommentsResponse = { threads };
  return json(body);
}

// The comment routes, or null for a path that is not theirs. Every refusal is logged here, once, with its code.
export async function handleCommentRoutes(ctx: RouteContext): Promise<Response | null> {
  const res = await commentRoute(ctx);
  if (res && res.status >= 400)
    await logRefusal('[comments] refused', res, {
      documentId: ctx.segments[2],
      tabId: ctx.segments[4] ?? null,
      route: COMMENT_ROUTE_NAMES[ctx.segments.length] ?? ctx.segments[7] ?? 'comments',
      agent: ctx.token !== null,
    });
  return res;
}

async function commentRoute(ctx: RouteContext): Promise<Response | null> {
  const { segments, request } = ctx;
  const id = segments[2]!;
  if (segments.length === 4 && segments[3] === 'comments')
    return request.method === 'GET' ? listThreads(ctx, id) : methodNotAllowed();
  if (segments[3] !== 'tabs' || segments[5] !== 'comments') return null;
  const tabId = segments[4]!;
  if (segments.length === 6 && request.method === 'POST') return addComment(ctx, id, tabId);
  if (segments.length === 7 && request.method === 'DELETE')
    return deleteOwn(ctx, id, tabId, segments[6]!);
  const verb: ThreadVerb | null =
    segments[7] === 'reply'
      ? 'reply'
      : segments[7] === 'resolve'
        ? 'resolve'
        : segments[7] === 'reopen'
          ? 'reopen'
          : null;
  if (segments.length === 8 && verb)
    return request.method === 'POST'
      ? threadVerb(ctx, id, tabId, segments[6]!, verb)
      : methodNotAllowed();
  return null;
}
