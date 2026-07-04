// /api/diagrams — diagram metadata, per-tab content, copy, folder
// assignment, tab linking, comments, share links, the realtime WS
// upgrade, and the change-log. The largest resource: every sub-path
// under a diagram id lives here.

import type { Tab } from '@livediagram/diagram';
import { isValidTab } from '@livediagram/diagram';
import { MAX_TAB_BYTES, byteLength } from '../limits';
import {
  findComment,
  hasNewComments,
  redactCommentAuthorIds,
  removeComment,
  rewriteCommentAuthors,
} from '../comments';
import { emailEnabled } from '../email/client';
import { notifyNewComment } from '../email/notifications';
import {
  deleteTabRow,
  diagramsContainingTab,
  getDiagram,
  getParticipant,
  getTab,
  linkTabToDiagram,
  tabLinkedToOwnedDiagram,
  upsertTab,
} from '../db';
import { badRequest, conflict, forbidden, json, noContent, notFound } from '../responses';
import { handleDiagramShareRoutes } from './diagram-share-routes';
import { gateEdit, gateRead, requireOwner, type RouteContext } from './context';

// Tab-content sub-resource routes for /api/diagrams/<id>/...,
// split out of diagrams.ts. Returns a Response when it handles the path, or
// null to let the main dispatcher fall through to the remaining routes.
export async function handleDiagramSubresources(ctx: RouteContext): Promise<Response | null> {
  const { request, env, segments } = ctx;
  // /api/diagrams/<id>/tabs/<tabId>
  //   GET    — full tab payload. READ access: owner or ANY valid
  //            share code (view OR edit) for this diagram, so
  //            view-only visitors can load tab content (spec/04 +
  //            spec/13). This is a viewer's only path to content:
  //            the share resolve returns summaries, and the
  //            realtime room relays ops, not snapshots.
  //   PUT    — upsert one tab. Body is a Tab. orderIndex falls
  //            through the existing row, or appends when new.
  //   DELETE — remove one tab.
  //   PUT / DELETE are writes: owner or edit-role only.
  if (segments.length === 5 && segments[3] === 'tabs') {
    const id = segments[2]!;
    const tabId = segments[4]!;
    const owner = requireOwner(ctx);
    if (owner instanceof Response) return owner;
    const existing = await getDiagram(env, id);
    if (!existing) return notFound();

    if (request.method === 'GET') {
      const allowed = await gateRead(ctx, id, existing.ownerId, existing.teamId);
      if (!allowed) return forbidden();
      const tab = await getTab(env, id, tabId);
      if (!tab) return notFound();
      // Blank other people's comment author ids before handing the tab
      // to a non-owner: a visitor should only ever see their OWN author
      // id (so they can delete-own), never another participant's owner
      // id. The diagram owner sees everything (viewerId === ownerId is a
      // no-op). Same anti-claim posture as redactOwner on the diagram.
      const safe =
        owner === existing.ownerId
          ? tab
          : { ...tab, elements: redactCommentAuthorIds(tab.elements, owner) };
      return json({ tab: safe });
    }

    // Writes below: owner or edit-role share visitor only.
    const allowed = await gateEdit(ctx, id, existing.ownerId, existing.teamId);
    if (!allowed) return forbidden();
    if (request.method === 'PUT') {
      const body = (await request.json()) as Tab;
      // Structural schema gate (shared with the app, @livediagram/diagram):
      // discriminant, required fields, endpoints, array bounds + unique ids.
      if (!isValidTab(body)) {
        return badRequest('invalid tab');
      }
      // Byte cap on the single tab (the body cap bounds the whole request;
      // this bounds one tab's element + comment tree specifically). The
      // request body IS the tab JSON, so a declared Content-Length is the
      // exact byte count — using it skips a full re-stringify + encode of
      // up to 4 MB on the hottest write path (one PUT per 600ms per
      // editor). Chunked bodies (no header) keep the stringify fallback.
      const declaredLen = Number(request.headers.get('content-length'));
      const tabBytes = Number.isFinite(declaredLen)
        ? declaredLen
        : byteLength(JSON.stringify(body));
      if (tabBytes > MAX_TAB_BYTES) {
        return json({ error: 'payload_too_large' }, { status: 413 });
      }
      // Find the existing order index; append if new.
      const existingTab = await getTab(env, id, tabId);
      // Data-loss backstop (spec/13). Refuse to blank a tab that
      // currently holds content unless the client explicitly marks the
      // empty write intentional via `X-Allow-Empty: 1`. The live editor
      // sets that header only when it had the tab's content
      // authoritatively loaded — so a real reset-canvas / delete-all (on
      // the active, loaded tab) passes, while the lazy-load wipe (a
      // never-opened placeholder PUT carrying no such header) is rejected
      // and the stored row survives. Independent of the client-side
      // autosave guard — belt and suspenders, and it also protects older
      // clients that predate that guard. A legitimately-empty incoming
      // tab over an already-empty (or new) row is untouched by this.
      if (
        body.elements.length === 0 &&
        existingTab &&
        existingTab.elements.length > 0 &&
        request.headers.get('X-Allow-Empty') !== '1'
      ) {
        return conflict('empty_tab_overwrite_blocked');
      }
      const orderIndex = existingTab?.orderIndex ?? existing.tabs.length; // tabs[] is already summaries
      // Rewrite the author fields on any newly-added comment to
      // match the resolved owner's participant record. Without
      // this the client can claim any authorName / authorColor
      // and impersonate another participant in the comment
      // thread (see the spec/04 + spec/12 security audit
      // thread). Existing comments preserve their original
      // authors (compared by id against the prior tab).
      // getDiagram already joined the owner's participant row — reuse it
      // when the writer IS the owner (the common autosave case) instead
      // of re-fetching the same row every 600ms.
      const writerParticipant =
        owner === existing.ownerId && existing.ownerName !== null
          ? {
              id: owner,
              name: existing.ownerName,
              color: existing.ownerColor ?? '#0ea5e9',
              // createdAt satisfies the ParticipantRecord shape; the
              // rewrite only reads id/name/color.
              createdAt: existing.createdAt,
            }
          : await getParticipant(env, owner);
      const sanitised = writerParticipant
        ? {
            ...body,
            elements: rewriteCommentAuthors(
              body.elements,
              existingTab?.elements ?? [],
              writerParticipant,
            ),
          }
        : body;
      await upsertTab(env, id, { ...sanitised, id: tabId }, orderIndex);
      // spec/64 (#1): an edit-role visitor (not the owner) adding a comment
      // notifies the owner immediately. Best-effort, off the request path.
      if (
        emailEnabled(env) &&
        owner !== existing.ownerId &&
        hasNewComments(body.elements, existingTab?.elements ?? [])
      ) {
        ctx.waitUntil?.(
          notifyNewComment(
            env,
            { id, ownerId: existing.ownerId, name: existing.name },
            writerParticipant?.name ?? null,
          ),
        );
      }
      // Echo what was just written instead of reading it back: the
      // response contract (OpenAPI `Tab`) is unchanged, but the extra
      // SELECT + JSON.parse of the full blob per autosave is gone. The
      // row-derived fields are known here (folder is link metadata the
      // client strips before persisting, so it is absent by design —
      // matching what a read-back of a fresh write returns).
      return json({
        tab: {
          ...sanitised,
          id: tabId,
          name: body.name,
          diagramId: id,
          orderIndex,
          updatedAt: Date.now(),
        },
      });
    }
    if (request.method === 'DELETE') {
      await deleteTabRow(env, id, tabId);
      return noContent();
    }
  }

  // /api/diagrams/<id>/tabs/<tabId>/comments — append a comment
  // to an element's thread. Read-role visitors are allowed here
  // (the only write path open to view-role) so view-only
  // collaborators can chime in on a thread without being
  // promoted to edit. Owner / edit-role roles already get this
  // via the normal tab autosave; this endpoint short-circuits
  // that path so a view-role visitor's autosave (blocked) isn't
  // their only way to persist.
  if (
    segments.length === 6 &&
    segments[3] === 'tabs' &&
    segments[5] === 'comments' &&
    request.method === 'POST'
  ) {
    const id = segments[2]!;
    const tabId = segments[4]!;
    const owner = requireOwner(ctx);
    if (owner instanceof Response) return owner;
    const existing = await getDiagram(env, id);
    if (!existing) return notFound();
    const allowed = await gateRead(ctx, id, existing.ownerId, existing.teamId);
    if (!allowed) return forbidden();
    let body: { elementId?: unknown; text?: unknown };
    try {
      body = (await request.json()) as { elementId?: unknown; text?: unknown };
    } catch {
      return badRequest('invalid json');
    }
    const elementId = typeof body.elementId === 'string' ? body.elementId : null;
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    if (!elementId) return badRequest('missing elementId');
    if (!text) return badRequest('missing text');
    if (text.length > 2000) return badRequest('text too long');
    const tab = await getTab(env, id, tabId);
    if (!tab) return notFound();
    const target = tab.elements.find((el) => el.id === elementId);
    if (!target || target.type === 'arrow') return notFound();
    const writer = await getParticipant(env, owner);
    const authorName = writer?.name ?? 'Anonymous';
    const authorColor = writer?.color ?? '#94a3b8';
    const comment = {
      id: crypto.randomUUID(),
      text,
      createdAt: Date.now(),
      authorName,
      authorColor,
      // Stamp the writer's stable id so they (and only they) can later
      // delete this comment via the DELETE endpoint below. Server-set,
      // never read from the client.
      authorId: owner,
    };
    const updatedElements = tab.elements.map((el) => {
      if (el.id !== elementId || el.type === 'arrow') return el;
      const thread = (el as { commentThread?: { comments: (typeof comment)[]; resolved: boolean } })
        .commentThread ?? { comments: [], resolved: false };
      return {
        ...el,
        commentThread: {
          comments: [...thread.comments, comment],
          // Adding a comment unresolves a resolved thread; same
          // rule as the editor's local addComment.
          resolved: false,
        },
      };
    });
    await upsertTab(env, id, { ...tab, elements: updatedElements }, tab.orderIndex);
    // spec/64 (#1): a view-role visitor's comment notifies the owner immediately.
    if (emailEnabled(env) && owner !== existing.ownerId) {
      ctx.waitUntil?.(
        notifyNewComment(env, { id, ownerId: existing.ownerId, name: existing.name }, authorName),
      );
    }
    return json({ comment });
  }

  // DELETE /api/diagrams/<id>/tabs/<tabId>/comments/<commentId> —
  // delete a SINGLE comment you authored. Read-role visitors are
  // allowed (gateRead, like the POST above) so a view-only collaborator
  // can remove their own comment without edit rights — but only their
  // own: the comment's server-stamped authorId must equal the caller.
  // Owners / edit-role visitors also use this for delete-own; deleting
  // SOMEONE ELSE'S comment still goes through the edit-gated tab PUT.
  if (
    segments.length === 7 &&
    segments[3] === 'tabs' &&
    segments[5] === 'comments' &&
    request.method === 'DELETE'
  ) {
    const id = segments[2]!;
    const tabId = segments[4]!;
    const commentId = segments[6]!;
    const owner = requireOwner(ctx);
    if (owner instanceof Response) return owner;
    const existing = await getDiagram(env, id);
    if (!existing) return notFound();
    const allowed = await gateRead(ctx, id, existing.ownerId, existing.teamId);
    if (!allowed) return forbidden();
    const tab = await getTab(env, id, tabId);
    if (!tab) return notFound();
    // Locate the comment + confirm authorship before mutating anything.
    const found = findComment(tab.elements, commentId);
    if (!found) return notFound();
    // Delete-own only. The diagram owner may also delete their own
    // comments here; removing other people's requires the edit-gated
    // tab PUT. Mismatched author is forbidden (not 404) — the caller
    // can see the comment exists, they just can't delete it.
    if (found.authorId !== owner) return forbidden();
    const updatedElements = removeComment(tab.elements, commentId);
    await upsertTab(env, id, { ...tab, elements: updatedElements }, tab.orderIndex);
    return noContent();
  }

  // /api/diagrams/<id>/tabs/<tabId>/link — owner only.
  //   POST — add an existing tab to this diagram (spec/17).
  // Auth: the caller must own this diagram AND own at least
  // one diagram that already contains the tab. The second
  // half stops a stranger from grafting a tab they have no
  // read access to. The `existing.ownerId !== owner` guard
  // above the dispatch (canEditDiagram on this diagram) only
  // covers the destination side.
  if (
    segments.length === 6 &&
    segments[3] === 'tabs' &&
    segments[5] === 'link' &&
    request.method === 'POST'
  ) {
    const id = segments[2]!;
    const tabId = segments[4]!;
    const owner = requireOwner(ctx);
    if (owner instanceof Response) return owner;
    const existing = await getDiagram(env, id);
    if (!existing) return notFound();
    if (existing.ownerId !== owner) return forbidden();
    // The tab must already live in at least one of the caller's
    // owned diagrams. One JOIN answers that (LIMIT 1 on the first
    // owned match). On the failure path we fall back to listing the
    // containing diagrams once, purely to tell "tab doesn't exist
    // anywhere" (404) apart from "exists but you don't own it" (403).
    if (!(await tabLinkedToOwnedDiagram(env, tabId, owner))) {
      const sourceIds = await diagramsContainingTab(env, tabId);
      return sourceIds.length === 0 ? notFound() : forbidden();
    }
    await linkTabToDiagram(env, id, tabId);
    // Return the tab summary the client uses to render the
    // new pill in its TabBar without re-fetching the whole
    // diagram. Pulled fresh so the order_index reflects the
    // append we just performed.
    const tab = await getTab(env, id, tabId);
    return tab ? json({ tab }) : notFound();
  }

  // /api/diagrams/<id>/share* — the share-link family lives in
  // diagram-share-routes.ts.
  {
    const shareResp = await handleDiagramShareRoutes(ctx);
    if (shareResp) return shareResp;
  }

  return null;
}
