// /api/designs — design metadata, per-tab content, copy, folder
// assignment, tab linking, comments, share links, the realtime WS
// upgrade. The largest resource: every sub-path
// under a design id lives here.

import { broadcastShareOp } from '../room-client';
import { redactCommentAuthorIds } from '../comments';
import {
  deleteShareLinksForTab,
  deleteTabRow,
  designsContainingTab,
  getDesign,
  getDesignForSave,
  getTab,
  linkTabToDesign,
  tabLinkedToOwnedDesign,
} from '../db';
import { getParticipant } from '../accounts/profiles';
import { conflict, forbidden, json, noContent, notFound } from '../responses';
import { recordVisitorOpened, retractTabComments } from '../timeline';
import { DESIGN_OPEN_HEADER, readDesignOpen, tabEtag } from '@livedesign/api-schema';
import { recordDesignOpen } from '../home/record-open';
import { handleDesignShareRoutes } from './design-share-routes';
import { handlePhotoBlobRoutes } from './photo-blob-routes';
import { handleTabPut, refuseTokenTabPut } from './tab-put-route';
import { handleTabRename } from './tab-name-route';
import { handleTabPages } from './tab-pages-route';
import { handleChangesetRoutes } from './changesets';
import { handleCommentRoutes } from './comment-routes';
import { handleAgentPresenceRoute } from './agent-presence-routes';
import { handleTabRender } from './tab-render-route';
import {
  deniedOnTab,
  gateEdit,
  gateGrant,
  missingDesign,
  ownsDesign,
  requireOwner,
  shareCodeOf,
  type RouteContext,
} from './context';
import { answerTabView, parseViewQuery } from './design-views-route';

// Tab-content sub-resource routes for /api/designs/<id>/...,
// split out of designs.ts. Returns a Response when it handles the path, or
// null to let the main dispatcher fall through to the remaining routes.
export async function handleDesignSubresources(ctx: RouteContext): Promise<Response | null> {
  const { request, env, segments } = ctx;
  // Agent changesets (docs/specs/024-agents/agent-changesets.md).
  const changesets = await handleChangesetRoutes(ctx);
  if (changesets) return changesets;
  // /api/designs/<id>/tabs/<tabId>/photo-blobs[-held|-adopt][/<blob>] (docs/specs/031-photo/photo-store.md "The routes").
  const photoBlobs = await handlePhotoBlobRoutes(ctx);
  if (photoBlobs) return photoBlobs;
  // /api/designs/<id>/tabs/<tabId>
  //   GET    — full tab payload. READ access: owner or ANY valid
  //            share code (view OR edit) for this design, so
  //            view-only visitors can load tab content (docs/specs/014-identity/auth-and-guest-access.md +
  //            docs/specs/006-design/per-tab-storage.md). This is a viewer's only path to content:
  //            the share resolve returns summaries, and the
  //            realtime room relays ops, not snapshots.
  //   PUT    — upsert one tab. Body is a Tab. orderIndex falls
  //            through the existing row, or appends when new.
  //   DELETE — remove one tab.
  //   PUT / DELETE are writes: owner or edit-role only.
  // /api/designs/<id>/tabs/<tabId>/name: a tab rename (docs/specs/024-agents/agent-changesets.md).
  if (
    segments.length === 6 &&
    segments[3] === 'tabs' &&
    segments[5] === 'pages' &&
    ctx.request.method === 'POST'
  ) {
    return handleTabPages(ctx, segments[2]!, segments[4]!);
  }
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
    // A save reads only what it needs of the design, in one query (getDesignForSave): it runs on
    // every autosave.
    if (request.method === 'PUT') {
      const saving = await getDesignForSave(env, id);
      if (!saving) return missingDesign(ctx, id);
      // Owner or edit-role share visitor only, and a tab-scoped visitor on their own tab only.
      const allowed = await gateEdit(ctx, id, saving.ownerId, saving.teamId, tabId);
      if (!allowed) return forbidden();
      return handleTabPut(ctx, saving, tabId, owner);
    }
    const existing = await getDesign(env, id);
    if (!existing) return missingDesign(ctx, id);

    if (request.method === 'GET') {
      // A design view (docs/specs/024-agents/design-views.md): checked before any read, rendered
      // after the same gate and redaction as the plain tab.
      const view = parseViewQuery(new URL(request.url), 'tab');
      if (view instanceof Response) return view;
      // Naming the tab confines a tab-scoped link to its own tab
      // (docs/specs/013-workspace/tab-scoped-share-links.md). Every other tab reads as missing: 404, no
      // existence leak.
      const grant = await gateGrant(ctx, id, existing.ownerId, existing.teamId);
      if (!grant || (grant.tabScope !== null && grant.tabScope !== tabId)) {
        return deniedOnTab(ctx, existing);
      }
      const tab = await getTab(env, id, tabId);
      if (!tab) return notFound();
      // Blank other people's comment author ids before handing the tab
      // to a non-owner: a visitor should only ever see their OWN author
      // id (so they can delete-own), never another participant's owner
      // id. The design owner sees everything (viewerId === ownerId is a
      // no-op). Same anti-claim posture as redactOwner on the design.
      const safe =
        owner === existing.ownerId
          ? tab
          : { ...tab, elements: redactCommentAuthorIds(tab.elements, owner) };
      if (view) return answerTabView(ctx, view, existing, safe, owner);
      // docs/specs/013-workspace/timeline.md §4.3: somebody arrived through a SHARE LINK and opened this.
      // The tab read is the honest signal for "opened" — the design GET is hit
      // by link previews and polls, whereas fetching tab content means a person
      // is looking at the canvas. Coalesced per visitor per day inside the
      // emit, so a stranger with a link can't flood the owner's feed by
      // refreshing.
      //
      // Gated on a share code being PRESENT, not merely on the caller not being
      // the owner. The read gate also admits any joined member of the design's
      // team (docs/specs/013-workspace/team-shared-designs.md), who presents no code — so the looser test reported
      // teammates browsing their own library as visitors. The bubble reads
      // "opened by a visitor · Someone with the share link" and files under the
      // sharing filter, so an owner saw that for a design they had never
      // shared a link for, once per teammate per day.
      if (owner !== existing.ownerId && shareCodeOf(request) !== null) {
        ctx.waitUntil?.(
          getParticipant(env, owner).then((p) =>
            recordVisitorOpened(env, existing, owner, p?.name ?? null),
          ),
        );
      }
      // docs/specs/013-workspace/explorer-home.md "Opens": the reader's own open, for their Home.
      // Only when the editor declares this read an open: a resync, a duplicate, Take Offline and
      // an embed read the same tab and are not opens. The read gate above has
      // already admitted the reader, and the open is theirs whoever they are.
      if (readDesignOpen(request.headers.get(DESIGN_OPEN_HEADER))) {
        ctx.waitUntil?.(recordDesignOpen(env, existing, owner, Date.now()));
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
      // end its own link, and the design's structure isn't the visitor's.
      const grant = await gateGrant(ctx, id, existing.ownerId, existing.teamId);
      if (grant?.tabScope !== null) return forbidden();
      // A tab this design does not have deletes nothing: said, not answered as done.
      if (!existing.tabs.some((t) => t.id === tabId)) return notFound();
      // An agent or the CLI (a token) may not delete the last tab (docs/specs/015-api/mcp-server.md
      // §4.17). The editor is let through: its saves and deletes race, so adding a tab and deleting
      // the other in one save can reach here first.
      if (ctx.token && existing.tabs.length <= 1) return conflict('last_tab');
      const removed = await deleteTabRow(env, id, tabId);
      // Its comments' words leave this design's feed with it (docs/specs/013-workspace/timeline.md §4.3).
      if (removed) ctx.waitUntil?.(retractTabComments(env, id, removed));
      // The links scoped to it die with it (docs/specs/013-workspace/tab-scoped-share-links.md), and their
      // holders leave the editor as on a revoke.
      const revoked = await deleteShareLinksForTab(env, id, tabId);
      for (const code of revoked) {
        ctx.waitUntil?.(broadcastShareOp(env, id, { kind: 'share-revoked', code }));
      }
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

  // /api/designs/<id>/tabs/<tabId>/link — owner only.
  //   POST — add an existing tab to this design (docs/specs/006-design/tab-design-many-to-many.md).
  // Auth: the caller must own this design AND own at least
  // one design that already contains the tab. The second
  // half stops a stranger from grafting a tab they have no
  // read access to. The `existing.ownerId !== owner` guard
  // above the dispatch (canEditDesign on this design) only
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
    const existing = await getDesign(env, id);
    if (!existing) return missingDesign(ctx, id);
    // `ownsDesign`, not a bare id compare: on a TEAM design the owner id is
    // an account id every teammate can read, so it must be proven with a verified
    // account id rather than the X-Owner-Id header (see routes/context.ts).
    // The second half of this route's auth doesn't help here — it re-uses the
    // SAME resolved owner, so a forged identity satisfies it with the victim's
    // own designs.
    if (!(await ownsDesign(ctx, existing))) return forbidden();
    // The tab must already live in at least one of the caller's
    // owned designs. One JOIN answers that (LIMIT 1 on the first
    // owned match). On the failure path we fall back to listing the
    // containing designs once, purely to tell "tab doesn't exist
    // anywhere" (404) apart from "exists but you don't own it" (403).
    if (!(await tabLinkedToOwnedDesign(env, tabId, owner))) {
      const sourceIds = await designsContainingTab(env, tabId);
      return sourceIds.length === 0 ? notFound() : forbidden();
    }
    await linkTabToDesign(env, id, tabId);
    // Return the tab summary the client uses to render the
    // new pill in its TabBar without re-fetching the whole
    // design. Pulled fresh so the order_index reflects the
    // append we just performed.
    const tab = await getTab(env, id, tabId);
    return tab ? json({ tab }) : notFound();
  }

  // /api/designs/<id>/share* — the share-link family lives in
  // design-share-routes.ts.
  {
    const shareResp = await handleDesignShareRoutes(ctx);
    if (shareResp) return shareResp;
  }

  return null;
}

// A refused per-tab request. A caller holding SOME grant on the design was
// refused this tab because their link is scoped to another one
// (docs/specs/013-workspace/tab-scoped-share-links.md): the tab reads as missing, 404, so its existence
// doesn't leak. Anyone else gets the usual 403.
