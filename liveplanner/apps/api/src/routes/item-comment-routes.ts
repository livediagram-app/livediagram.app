// A Plan card's comment writes (docs/specs/026-plan/items.md "Comments", blueprint item-store.md "Comments"):
// add, delete, resolve and reopen under /api/projects/:id/items/:itemId/comments. The canvas's comment
// endpoints' rules, on an item: anyone who may comment (a Participant or an Editor; a Viewer only looks) adds, resolves and reopens; they delete
// their own comments, and an editor deletes any. Each is an item write (writeItem: the item as stored, guarded by
// its rev, relayed to the room without author ids), so concurrent comments never lose one another.

import { applyItemComment, itemThread, type ItemCommentChange } from '@liveplanner/project';
import type { ItemCommentAddResponse, ItemResponse } from '@liveplanner/api-schema';
import type { Item, ItemPerson } from '@liveplanner/items';
import { forbidden, json, methodNotAllowed, noContent } from '../responses';
import { afterCommentPosted, newComment } from './comment-routes';
import { gateEdit, readBody, type PlanRouteContext } from './context';
import { itemCaller, type ItemCaller } from './item-route-kit';
import { writeItem } from './item-routes';

type Verb = 'resolve' | 'reopen';

// One comment change against the item as stored, or the refusal: a full thread, a missing comment, or (a
// resolve that changes nothing) an empty answer with nothing written.
function commentWrite(change: ItemCommentChange): (item: Item, by: ItemPerson) => Item | Response {
  return (item, by) => {
    const result = applyItemComment(item, change, { now: Date.now(), by });
    if (result.ok) return result.item;
    if (result.reason === 'comments_full') {
      console.info('[items] comments.full', { itemId: item.id });
      return json(
        { error: 'comments_full', message: 'this card holds the most comments it can' },
        { status: 413 },
      );
    }
    if (result.reason === 'comment_not_found')
      return json({ error: 'comment_not_found' }, { status: 404 });
    return noContent();
  };
}

// The caller as the canvas's comment helpers know them (the project and their owner id).
const asCommenter = (caller: ItemCaller) => ({ doc: caller.doc!, owner: caller.owner });

async function add(ctx: PlanRouteContext, projectId: string, itemId: string): Promise<Response> {
  const caller = await itemCaller(ctx, projectId, 'participate');
  if (caller instanceof Response) return caller;
  const body = await readBody(ctx);
  if (body instanceof Response) return body;
  const comment = await newComment(ctx, caller.owner, body);
  if (comment instanceof Response) return comment;
  const change = commentWrite({ kind: 'add', comment });
  const res = await writeItem(ctx, caller, itemId, change);
  if (res.status !== 200) return res;
  afterCommentPosted(ctx, asCommenter(caller), comment, itemId);
  console.info('[items] comment added', { projectId, agent: ctx.token !== null });
  // The comment's id, for the editor to find it in the card's thread.
  const answer: ItemCommentAddResponse = {
    ...(await res.json<ItemResponse>()),
    commentId: comment.id,
  };
  return json(answer);
}

// Delete-own for anyone who may comment; any comment for an editor (on the canvas, through the tab save).
async function remove(
  ctx: PlanRouteContext,
  projectId: string,
  itemId: string,
  commentId: string,
): Promise<Response> {
  const caller = await itemCaller(ctx, projectId, 'participate');
  if (caller instanceof Response) return caller;
  const doc = caller.doc!;
  const tabId = ctx.url.searchParams.get('tabId') ?? undefined;
  const editor = await gateEdit(ctx, projectId, doc.ownerId, doc.teamId, tabId);
  const change = commentWrite({ kind: 'remove', commentId });
  const res = await writeItem(ctx, caller, itemId, (item, by) => {
    const comments = itemThread(item)?.comments;
    const target = comments?.find((c) => c.id === commentId);
    if (target && !editor && target.authorId !== caller.owner) return forbidden();
    return change(item, by);
  });
  if (res.ok) {
    console.info('[items] comment deleted', { projectId, editor, agent: ctx.token !== null });
  }
  return res;
}

async function setResolved(
  ctx: PlanRouteContext,
  projectId: string,
  itemId: string,
  verb: Verb,
): Promise<Response> {
  const caller = await itemCaller(ctx, projectId, 'participate');
  if (caller instanceof Response) return caller;
  const resolved = verb === 'resolve';
  const change = commentWrite({ kind: 'resolve', resolved });
  const res = await writeItem(ctx, caller, itemId, change);
  // A 204 is a resolve that changed nothing (PR17 on the canvas): nothing written.
  const changed = res.status === 200;
  console.info(`[items] comments ${changed ? (resolved ? 'resolved' : 'reopened') : 'unchanged'}`, {
    projectId,
    agent: ctx.token !== null,
  });
  return res;
}

// POST .../comments (add), DELETE .../comments/:commentId, POST .../comments/resolve and .../comments/reopen.
export async function handleItemCommentRoutes(
  ctx: PlanRouteContext,
  projectId: string,
  itemId: string,
): Promise<Response | null> {
  const { segments, request } = ctx;
  const method = request.method;
  if (segments.length === 6)
    return method === 'POST' ? add(ctx, projectId, itemId) : methodNotAllowed();
  if (segments.length !== 7) return null;
  if (segments[6] === 'resolve' || segments[6] === 'reopen')
    return method === 'POST'
      ? setResolved(ctx, projectId, itemId, segments[6])
      : methodNotAllowed();
  return method === 'DELETE' ? remove(ctx, projectId, itemId, segments[6]!) : methodNotAllowed();
}
