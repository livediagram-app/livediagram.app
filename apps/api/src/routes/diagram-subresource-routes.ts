// /api/diagrams — diagram metadata, per-tab content, copy, folder
// assignment, tab linking, comments, share links, the realtime WS
// upgrade, and the change-log. The largest resource: every sub-path
// under a diagram id lives here.

import type { Tab } from '@livediagram/diagram';
import { isValidTab } from '@livediagram/diagram';
import { MAX_TAB_BYTES, MAX_PASSWORD_LEN, byteLength } from '../limits';
import {
  findComment,
  redactCommentAuthorIds,
  removeComment,
  rewriteCommentAuthors,
} from '../comments';
import {
  createShareLink,
  deleteShareLink,
  deleteTabRow,
  diagramsContainingTab,
  extendShareLink,
  generateShareCode,
  getDiagram,
  getDiagramSharePassword,
  getParticipant,
  getShareLinkIncludingExpired,
  getTab,
  linkTabToDiagram,
  listShareLinks,
  setDiagramShare,
  setDiagramSharePassword,
  tabLinkedToOwnedDiagram,
  upsertTab,
} from '../db';
import { badRequest, conflict, forbidden, json, noContent, notFound } from '../responses';
import type { ShareLinkExpiry } from '@livediagram/api-schema';
import type { ShareRole } from '../types';
import {
  gateEdit,
  gateRead,
  requireOwnedDiagram,
  requireOwner,
  type RouteContext,
} from './context';

// Tab-content + share-link sub-resource routes for /api/diagrams/<id>/...,
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
      // this bounds one tab's element + comment tree specifically).
      if (byteLength(JSON.stringify(body)) > MAX_TAB_BYTES) {
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
      const writerParticipant = await getParticipant(env, owner);
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
      const tab = await getTab(env, id, tabId);
      return tab ? json({ tab }) : notFound();
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

  // /api/diagrams/<id>/share — owner-only.
  //   GET     — list every share link for this diagram.
  //   POST    — mint a new link. Body: { role: 'edit' | 'view' }
  //   DELETE  — revoke every link (back-compat with the
  //             single-code era).
  if (segments.length === 4 && segments[3] === 'share') {
    const id = segments[2]!;
    const access = await requireOwnedDiagram(ctx, id);
    if (access instanceof Response) return access;

    if (request.method === 'GET') {
      // Owner-only response, so it's safe to return the share password
      // in the clear — this is how the Share dialog shows it (spec/24).
      const links = await listShareLinks(env, id);
      const password = await getDiagramSharePassword(env, id);
      return json({ links, password });
    }
    if (request.method === 'POST') {
      const body = (await request.json().catch(() => ({}))) as {
        role?: ShareRole;
        expiry?: ShareLinkExpiry;
      };
      // Reject a garbage role rather than silently granting edit (the prior
      // `=== 'view' ? 'view' : 'edit'` turned any typo into an edit link).
      // An OMITTED role still defaults to 'edit', the documented behaviour.
      if (body.role !== undefined && body.role !== 'view' && body.role !== 'edit') {
        return badRequest('invalid role');
      }
      const role: ShareRole = body.role === 'view' ? 'view' : 'edit';
      // Expiry (spec/34): unknown / missing value falls back to the
      // pre-expiry behaviour, a link that works until revoked.
      const expiry: ShareLinkExpiry =
        body.expiry === 'week' || body.expiry === 'month' || body.expiry === 'sixMonths'
          ? body.expiry
          : 'never';
      const code = generateShareCode();
      const link = await createShareLink(env, id, code, role, expiry);
      return json({ link }, { status: 201 });
    }
    if (request.method === 'DELETE') {
      // Bulk-revoke: drop every link AND flip legacy shareable
      // off so the live app stops opening the room.
      const links = await listShareLinks(env, id);
      for (const link of links) await deleteShareLink(env, link.code);
      await setDiagramShare(env, id, false);
      return json({ shareable: false, shareCode: null });
    }
  }

  // /api/diagrams/<id>/share-password — owner-only get/set of the
  // diagram's optional share password (spec/24). PUT body
  // { password: string | null }; null / empty clears it.
  if (segments.length === 4 && segments[3] === 'share-password') {
    const id = segments[2]!;
    const access = await requireOwnedDiagram(ctx, id);
    if (access instanceof Response) return access;

    if (request.method === 'PUT') {
      const body = (await request.json().catch(() => ({}))) as { password?: string | null };
      const password = typeof body.password === 'string' ? body.password : null;
      if (password !== null && password.length > MAX_PASSWORD_LEN) {
        return badRequest('password too long');
      }
      await setDiagramSharePassword(env, id, password);
      // Echo back the stored value (normalised: whitespace-only ->
      // null) so the dialog reflects exactly what gates access.
      return json({ password: await getDiagramSharePassword(env, id) });
    }
  }

  // /api/diagrams/<id>/share/<code> — revoke one specific link.
  if (segments.length === 5 && segments[3] === 'share') {
    const id = segments[2]!;
    const code = segments[4]!;
    const access = await requireOwnedDiagram(ctx, id);
    if (access instanceof Response) return access;

    if (request.method === 'DELETE') {
      await deleteShareLink(env, code);
      // Tell every connected peer in this diagram's room that
      // the code just got revoked so any viewer / editor who
      // hydrated with `X-Share-Code: <code>` can hard-redirect
      // instead of continuing to read a diagram they no longer
      // have access to. Fire-and-forget: the persistence above
      // is the authoritative revoke, the broadcast is UX.
      const stub = env.DIAGRAM_ROOM.get(env.DIAGRAM_ROOM.idFromName(id));
      stub
        .fetch('https://room/broadcast', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ op: { kind: 'share-revoked', code } }),
        })
        .catch(() => {});
      return noContent();
    }
  }

  // /api/diagrams/<id>/share/<code>/extend — re-arm an expiring link
  // for another round of its creation-time duration (spec/34).
  // Owner-only; works whether the link is currently active or expired
  // (extending an active link pushes the deadline out from now); 400
  // on a never-expiring link (nothing to extend).
  if (segments.length === 6 && segments[3] === 'share' && segments[5] === 'extend') {
    const id = segments[2]!;
    const code = segments[4]!;
    const access = await requireOwnedDiagram(ctx, id);
    if (access instanceof Response) return access;

    if (request.method === 'POST') {
      const existing = await getShareLinkIncludingExpired(env, code);
      if (!existing || existing.diagramId !== id) return notFound();
      const link = await extendShareLink(env, code);
      if (!link) return badRequest('link never expires');
      return json({ link });
    }
  }
  return null;
}
