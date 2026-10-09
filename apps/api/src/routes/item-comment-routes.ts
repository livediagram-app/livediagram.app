// A Plan card's comment writes (docs/specs/026-plan/items.md "Comments", blueprint item-store.md "Comments"):
// add, delete, resolve and reopen under /api/documents/:id/items/:itemId/comments. The canvas's comment
// endpoints' rules, on an item: anyone who may comment (participate) adds, resolves and reopens; they delete
// their own comments, and an editor deletes any. Each is an item write (writeItem: the item as stored, guarded by
// its rev, relayed to the room without author ids), so concurrent comments never lose one another.

import { applyItemComment, itemThread, type ItemCommentChange } from '@livediagram/document';
import type { Item, ItemPerson } from '@livediagram/items';
import { forbidden, json, methodNotAllowed, noContent } from '../responses';
import { recordCommentResolved } from '../timeline';
import { afterCommentPosted, newComment } from './comment-routes';
import { gateEdit, readBody, type RouteContext } from './context';
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

// The caller as the canvas's comment helpers know them (the document and their owner id).
const asCommenter = (caller: ItemCaller) => ({ doc: caller.doc!, owner: caller.owner });

async function add(ctx: RouteContext, documentId: string, itemId: string): Promise<Response> {
  const caller = await itemCaller(ctx, documentId, 'participate');
  if (caller instanceof Response) return caller;
  const body = await readBody(ctx);
  if (body instanceof Response) return body;
  const comment = await newComment(ctx, caller.owner, body);
  if (comment instanceof Response) return comment;
  let reply = false;
  const change = commentWrite({ kind: 'add', comment });
  const res = await writeItem(ctx, caller, itemId, (item, by) => {
    reply = (itemThread(item)?.comments.length ?? 0) > 0;
    return change(item, by);
  });
  if (res.ok) {
    afterCommentPosted(ctx, asCommenter(caller), comment, reply);
    console.info('[items] comment added', { documentId, agent: ctx.token !== null });
  }
  return res;
}

// Delete-own for anyone who may comment; any comment for an editor (on the canvas, through the tab save).
async function remove(
  ctx: RouteContext,
  documentId: string,
  itemId: string,
  commentId: string,
): Promise<Response> {
  const caller = await itemCaller(ctx, documentId, 'participate');
  if (caller instanceof Response) return caller;
  const doc = caller.doc!;
  const tabId = ctx.url.searchParams.get('tabId') ?? undefined;
  const editor = await gateEdit(ctx, documentId, doc.ownerId, doc.teamId, tabId);
  const change = commentWrite({ kind: 'remove', commentId });
  const res = await writeItem(ctx, caller, itemId, (item, by) => {
    const target = itemThread(item)?.comments.find((c) => c.id === commentId);
    if (target && !editor && target.authorId !== caller.owner) return forbidden();
    return change(item, by);
  });
  if (res.ok)
    console.info('[items] comment deleted', { documentId, editor, agent: ctx.token !== null });
  return res;
}

async function setResolved(
  ctx: RouteContext,
  documentId: string,
  itemId: string,
  verb: Verb,
): Promise<Response> {
  const caller = await itemCaller(ctx, documentId, 'participate');
  if (caller instanceof Response) return caller;
  const resolved = verb === 'resolve';
  let opening: string | null = null;
  const change = commentWrite({ kind: 'resolve', resolved });
  const res = await writeItem(ctx, caller, itemId, (item, by) => {
    opening = itemThread(item)?.comments[0]?.text ?? null;
    return change(item, by);
  });
  // A 204 is a resolve that changed nothing (PR17 on the canvas): nothing written, nothing recorded.
  const changed = res.status === 200;
  if (changed && resolved)
    ctx.waitUntil?.(
      recordCommentResolved(
        ctx.env,
        caller.doc!,
        `${documentId}:item:${itemId}`,
        opening,
        caller.owner,
      ),
    );
  console.info(`[items] comments ${changed ? (resolved ? 'resolved' : 'reopened') : 'unchanged'}`, {
    documentId,
    agent: ctx.token !== null,
  });
  return res;
}

// POST .../comments (add), DELETE .../comments/:commentId, POST .../comments/resolve and .../comments/reopen.
export async function handleItemCommentRoutes(
  ctx: RouteContext,
  documentId: string,
  itemId: string,
): Promise<Response | null> {
  const { segments, request } = ctx;
  const method = request.method;
  if (segments.length === 6)
    return method === 'POST' ? add(ctx, documentId, itemId) : methodNotAllowed();
  if (segments.length !== 7) return null;
  if (segments[6] === 'resolve' || segments[6] === 'reopen')
    return method === 'POST'
      ? setResolved(ctx, documentId, itemId, segments[6] as Verb)
      : methodNotAllowed();
  return method === 'DELETE' ? remove(ctx, documentId, itemId, segments[6]!) : methodNotAllowed();
}
