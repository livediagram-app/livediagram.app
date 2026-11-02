// /api/documents — document metadata, per-tab content, copy, folder
// assignment, tab linking, comments, share links, the realtime WS
// upgrade. The largest resource: every sub-path
// under a document id lives here.

import { redactCommentAuthorIds } from '../comments';
import { redactTabForCommunity } from '../community-redact';
import { deleteTabRow, getDocument, getDocumentForSave, getTab } from '../db';
import { indexFor } from '../index-service';
import { conflict, forbidden, json, noContent, notFound } from '../responses';
import { DOCUMENT_OPEN_HEADER, readDocumentOpen, tabEtag } from '@livehuddle/api-schema';
import { handleQaBoardRoute } from './qa-board-routes';
import { handleTabPut, refuseTokenTabPut } from './tab-put-route';
import { handleTabRename } from './tab-name-route';
import { handleChangesetRoutes, refreshAfterRead } from './changesets';
import { handleCommentRoutes } from './comment-routes';
import { handleAgentPresenceRoute } from './agent-presence-routes';
import { handleTabRender } from './tab-render-route';
import {
  deniedOnTab,
  gateEdit,
  gateGrant,
  missingDocument,
  requireOwner,
  grantCallerOf,
  shareAccessOf,
  COMMUNITY_CONTENT,
  type DocumentRouteContext,
} from './context';
import { answerTabView, parseViewQuery } from './document-views-route';
import { handleTabLink } from './tab-link-route';

// Tab-content sub-resource routes for /api/documents/<id>/...,
// split out of documents.ts. Returns a Response when it handles the path, or
// null to let the main dispatcher fall through to the remaining routes.
export async function handleDocumentSubresources(
  ctx: DocumentRouteContext,
): Promise<Response | null> {
  const { request, env, segments } = ctx;
  // Agent changesets (docs/specs/024-agents/agent-changesets.md).
  const changesets = await handleChangesetRoutes(ctx);
  if (changesets) return changesets;
  // /api/documents/<id>/tabs/<tabId>/qa — a Q&A board action (docs/specs/012-collaboration/qa-board.md).
  const qa = await handleQaBoardRoute(ctx);
  if (qa) return qa;
  // /api/documents/<id>/tabs/<tabId>
  //   GET    — full tab payload. READ access: owner or ANY valid
  //            share code (view OR edit) for this document, so
  //            view-only visitors can load tab content (docs/specs/014-identity/auth-and-guest-access.md +
  //            docs/specs/006-document/per-tab-storage.md). This is a viewer's only path to content:
  //            the share resolve returns summaries, and the
  //            realtime room relays ops, not snapshots.
  //   PUT    — upsert one tab. Body is a Tab. orderIndex falls
  //            through the existing row, or appends when new.
  //   DELETE — remove one tab.
  //   PUT / DELETE are writes: owner or edit-role only.
  // /api/documents/<id>/tabs/<tabId>/name: a tab rename (docs/specs/024-agents/agent-changesets.md).
  if (
    segments.length === 6 &&
    segments[3] === 'tabs' &&
    segments[5] === 'name' &&
    request.method === 'PUT'
  ) {
    return handleTabRename(ctx, segments[2]!, segments[4]!);
  }
  if (segments.length === 5 && segments[3] === 'tabs') {
    const id = segments[2]!;
    const tabId = segments[4]!;
    if (request.method === 'PUT') {
      const refused = refuseTokenTabPut(ctx, id, tabId);
      if (refused) return refused;
    }
    const owner = requireOwner(ctx);
    if (owner instanceof Response) return owner;
    // A save reads only what it needs of the document, in one query (getDocumentForSave): it runs on
    // every autosave.
    if (request.method === 'PUT') {
      const saving = await getDocumentForSave(env, id);
      if (!saving) return missingDocument(ctx, id);
      // Owner or edit-role share visitor only, and a tab-scoped visitor on their own tab only.
      const allowed = await gateEdit(ctx, id, saving.ownerId, saving.teamId, tabId);
      if (!allowed) return forbidden();
      return handleTabPut(ctx, saving, tabId, owner);
    }
    const existing = await getDocument(env, id);
    if (!existing) return missingDocument(ctx, id);

    if (request.method === 'GET') {
      // A document view (docs/specs/024-agents/document-views.md): checked before any read, rendered
      // after the same gate and redaction as the plain tab.
      const view = parseViewQuery(new URL(request.url), 'tab');
      if (view instanceof Response) return view;
      // Naming the tab confines a tab-scoped link to its own tab
      // (docs/specs/013-workspace/tab-scoped-share-links.md). Every other tab reads as missing: 404, no
      // existence leak.
      // The grant itself, not a yes/no: it already says whether the visitor came through a Community
      // link, so that is not looked up a second time below.
      const grant = await gateGrant(ctx, id, existing.ownerId, existing.teamId, COMMUNITY_CONTENT);
      if (!grant || (grant.tabScope !== null && grant.tabScope !== tabId)) {
        return deniedOnTab(ctx, existing);
      }
      const tab = await getTab(env, id, tabId);
      if (!tab) return notFound();
      // An agent's read shows it on this tab (docs/specs/024-agents/agent-presence.md "Presence").
      refreshAfterRead(ctx, existing, tabId, owner);
      // Blank other people's comment author ids before handing the tab
      // to a non-owner: a visitor should only ever see their OWN author
      // id (so they can delete-own), never another participant's owner
      // id. The document owner sees everything (viewerId === ownerId is a
      // no-op). Same anti-claim posture as redactOwner on the document.
      //
      // A Community visitor gets the board without its conversation or its people
      // (docs/specs/025-community/community.md, community-redact.ts).
      const communityVisit = owner !== existing.ownerId && grant.community;
      const safe =
        owner === existing.ownerId
          ? tab
          : communityVisit
            ? redactTabForCommunity(tab)
            : { ...tab, elements: redactCommentAuthorIds(tab.elements, owner) };
      if (view) return answerTabView(ctx, view, existing, safe, owner);
      // docs/specs/013-workspace/explorer-home.md "Opens": the reader's own open, for their Home and Most Used, at the
      // index. Only when the editor declares this read an open: a resync, a duplicate, Take Offline, the Drive
      // mirror and an embed read the same tab and are not opens. The read gate above has already admitted the
      // reader, and the open is theirs whoever they are. Not for a Community visit, whose strangers have no Home here.
      if (!communityVisit && readDocumentOpen(request.headers.get(DOCUMENT_OPEN_HEADER))) {
        const client = indexFor(env, grantCallerOf(ctx));
        if (client)
          ctx.waitUntil?.(
            client
              .recordOpen(id, shareAccessOf(request))
              .catch((err: unknown) =>
                console.warn('[documents] open not recorded', { error: String(err) }),
              ),
          );
      }
      // The revision as a weak ETag too (docs/specs/024-agents/agent-changesets.md "The tab
      // revision", CS5): what an agent read, for its changeset base.
      return json({ tab: safe }, { headers: { ETag: tabEtag(tab.rev) } });
    }

    // Writes below: owner or edit-role share visitor only, and a tab-scoped
    // visitor on their own tab only.
    const allowed = await gateEdit(ctx, id, existing.ownerId, existing.teamId, tabId);
    if (!allowed) return forbidden();
    if (request.method === 'DELETE') {
      // A tab-scoped link can't delete the tab it is scoped to: that would
      // end its own link, and the document's structure isn't the visitor's.
      const grant = await gateGrant(ctx, id, existing.ownerId, existing.teamId);
      if (grant?.tabScope !== null) return forbidden();
      // A tab this document does not have deletes nothing: said, not answered as done.
      if (!existing.tabs.some((t) => t.id === tabId)) return notFound();
      // An agent or the CLI (a token) may not delete the last tab (docs/specs/015-api/mcp-server.md
      // §4.17). The editor is let through: its saves and deletes race, so adding a tab and deleting
      // the other in one save can reach here first.
      if (ctx.token && existing.tabs.length <= 1) return conflict('last_tab');
      await deleteTabRow(env, id, tabId);
      // The links scoped to it go with it (docs/specs/013-workspace/tab-scoped-share-links.md): the index revokes
      // them and their holders leave the editor as on a revoke. Asked as the caller, off the response path; a link
      // the index keeps opens nothing here meanwhile, since the tab reads as missing.
      const client = indexFor(env, grantCallerOf(ctx));
      if (client)
        ctx.waitUntil?.(
          client
            .listShareLinks(id)
            .then(({ links }) =>
              Promise.all(
                links.filter((l) => l.tabId === tabId).map((l) => client.revokeShareLink(l.code)),
              ),
            )
            .catch((err: unknown) =>
              console.warn('[documents] tab links not revoked', { error: String(err) }),
            ),
        );
      return noContent();
    }
  }

  // The comment endpoints (docs/specs/024-agents/agent-presence.md "Comments").
  const comments = await handleCommentRoutes(ctx);
  if (comments) return comments;
  // Agent presence (docs/specs/024-agents/agent-presence.md "Presence").
  const presence = await handleAgentPresenceRoute(ctx);
  if (presence) return presence;
  // One tab drawn by the shared renderer (docs/specs/015-api/api.md).
  const rendered = await handleTabRender(ctx);
  if (rendered) return rendered;

  // /api/documents/<id>/tabs/<tabId>/link — owner only.
  // A tab belongs to exactly one document (its Durable Object holds it), so there is no linking an existing tab into
  // another document any more: POST …/tabs/<tabId>/link is gone (docs/specs/015-api/api.md "Storage").

  // /api/documents/<id>/tabs/<tabId>/link — share a tab from another of the caller's documents into this one.
  const linked = await handleTabLink(ctx);
  if (linked) return linked;

  return null;
}

// A refused per-tab request. A caller holding SOME grant on the document was
// refused this tab because their link is scoped to another one
// (docs/specs/013-workspace/tab-scoped-share-links.md): the tab reads as missing, 404, so its existence
// doesn't leak. Anyone else gets the usual 403.
