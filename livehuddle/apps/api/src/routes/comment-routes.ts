// The comment endpoints (docs/specs/024-agents/agent-presence.md "Comments", blueprint "REST"). livehuddle has no
// comments any more (docs/specs/002-project-scope/not-in-livehuddle.md "Comments, actions, links and notes"): the
// thread listing across a document still answers what is stored, and every write (add, delete-own, reply, resolve,
// reopen on a tab) answers 410 `comments_gone`, so stored threads stay exactly as they are.

import { logRefusal } from '@liveworkspace/api-kit/refusal-log';
import {
  isCommentListStatus,
  type DocumentCommentThread,
  type DocumentCommentsResponse,
} from '@livehuddle/api-schema';
import { threadsOfTab } from '../comments';
import { getDocument, getTab, tabIdsWithComments } from '../db';
import { json, methodNotAllowed } from '../responses';
import {
  deniedOnTab,
  gateRead,
  grantOn,
  missingDocument,
  type DocumentRouteContext,
} from './context';

// Which comment route a path of this many segments is; a thread verb names itself (its last segment).
const COMMENT_ROUTE_NAMES: Record<number, string> = { 4: 'list', 6: 'add', 7: 'delete' };

// The thread verbs a tab's comment path once took (its last segment).
const THREAD_VERBS: ReadonlySet<string> = new Set(['reply', 'resolve', 'reopen']);

// A comment write: livehuddle takes none.
const commentsGone = () =>
  json(
    {
      error: 'comments_gone',
      message: 'livehuddle has no comments; existing threads stay readable',
    },
    { status: 410 },
  );

// GET /api/documents/:id/comments?status=: the threads across the document, one tab read at a time (PR21). A
// grant confined to one tab lists that tab only.
async function listThreads(ctx: DocumentRouteContext, id: string): Promise<Response> {
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
  // A grant confined to a tab with no comments yet still reads that tab: an empty list, as a whole-canvas reader
  // gets, rather than the refusal a caller with no grant at all gets.
  const scope = whole || readable ? null : (grantOn(ctx, id)?.tabScope ?? null);
  if (scope !== null && (await gateRead(ctx, id, doc.ownerId, doc.teamId, scope))) readable = true;
  if (!readable) return deniedOnTab(ctx, doc);
  console.info('[comments] listed', { documentId: id, status, tabsRead, threads: threads.length });
  const body: DocumentCommentsResponse = { threads };
  return json(body);
}

// The comment routes, or null for a path that is not theirs. Every refusal is logged here, once, with its code.
export async function handleCommentRoutes(ctx: DocumentRouteContext): Promise<Response | null> {
  const answered = await commentRoute(ctx);
  if (answered && answered.status >= 400)
    await logRefusal('[comments] refused', answered, {
      documentId: ctx.segments[2],
      tabId: ctx.segments[4] ?? null,
      route: COMMENT_ROUTE_NAMES[ctx.segments.length] ?? ctx.segments[7] ?? 'comments',
      agent: ctx.token !== null,
    });
  return answered;
}

function commentRoute(ctx: DocumentRouteContext): Promise<Response> | Response | null {
  const { segments, request } = ctx;
  const id = segments[2]!;
  if (segments.length === 4 && segments[3] === 'comments')
    return request.method === 'GET' ? listThreads(ctx, id) : methodNotAllowed();
  if (segments[3] !== 'tabs' || segments[5] !== 'comments') return null;
  if (segments.length === 6 && request.method === 'POST') return commentsGone();
  if (segments.length === 7 && request.method === 'DELETE') return commentsGone();
  if (segments.length === 8 && THREAD_VERBS.has(segments[7]!))
    return request.method === 'POST' ? commentsGone() : methodNotAllowed();
  return null;
}
