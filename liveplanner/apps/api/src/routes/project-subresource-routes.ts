// /api/projects — project metadata, per-tab content, copy, folder
// assignment, tab linking, comments, share links, the realtime WS
// upgrade. The largest resource: every sub-path
// under a project id lives here.

import { broadcastShareOp } from '../room-client';
import { redactCommentAuthorIds } from '../comments';
import {
  deleteFormLinksForTab,
  deleteShareLinksForTab,
  deleteTabRow,
  getProject,
  getProjectForSave,
  getParticipant,
  getTab,
} from '../db';
import { conflict, forbidden, json, noContent, notFound } from '../responses';
import { recordVisitorOpened, retractTabComments } from '../timeline';
import { PROJECT_OPEN_HEADER, readProjectOpen, tabEtag } from '@liveplanner/api-schema';
import { recordProjectOpen } from '../home/record-open';
import { handleProjectShareRoutes } from './project-share-routes';
import { handleFormLinkRoutes } from './form-link-routes';
import { handleTabPut, refuseTokenTabPut } from './tab-put-route';
import { handleTabRename } from './tab-name-route';
import { handleTabForm } from './tab-form-route';
import { handleChangesetRoutes } from './changesets';
import { handleCommentRoutes } from './comment-routes';
import { handleAgentPresenceRoute } from './agent-presence-routes';
import { handleTabRender } from './tab-render-route';
import { handleItemRoutes } from './item-routes';
import { handleSheetRoutes } from './sheet-routes';
import { handleItemTypeRoutes } from './item-type-routes';
import { handlePlanRoute } from './plan-route';
import {
  deniedOnTab,
  gateEdit,
  gateGrant,
  missingProject,
  requireOwner,
  shareCodeOf,
  type PlanRouteContext,
} from './context';
import { answerTabView, parseViewQuery } from './project-views-route';
import { pauseFormsFeeding } from '../forms/form-tab';

// Tab-content sub-resource routes for /api/projects/<id>/...,
// split out of projects.ts. Returns a Response when it handles the path, or
// null to let the main dispatcher fall through to the remaining routes.
export async function handleProjectSubresources(ctx: PlanRouteContext): Promise<Response | null> {
  const { request, env, segments } = ctx;
  // Agent changesets (docs/specs/024-agents/agent-changesets.md).
  const changesets = await handleChangesetRoutes(ctx);
  if (changesets) return changesets;
  // /api/projects/<id>/tabs/<tabId>/form-link and form-seen (docs/specs/030-forms/forms.md).
  const formLink = await handleFormLinkRoutes(ctx);
  if (formLink) return formLink;
  // /api/projects/<id>/tabs/<tabId>
  //   GET    — full tab payload. READ access: owner or ANY valid
  //            share code (view OR edit) for this project, so
  //            view-only visitors can load tab content (docs/specs/014-identity/auth-and-guest-access.md +
  //            docs/specs/006-project/per-tab-storage.md). This is a viewer's only path to content:
  //            the share resolve returns summaries, and the
  //            realtime room relays ops, not snapshots.
  //   PUT    — upsert one tab. Body is a Tab. orderIndex falls
  //            through the existing row, or appends when new.
  //   DELETE — remove one tab.
  //   PUT / DELETE are writes: owner or edit-role only.
  // /api/projects/<id>/tabs/<tabId>/form: an agent's form write (docs/specs/030-forms/forms.md "Agents").
  if (
    segments.length === 6 &&
    segments[3] === 'tabs' &&
    segments[5] === 'form' &&
    ctx.request.method === 'POST'
  ) {
    return handleTabForm(ctx, segments[2]!, segments[4]!);
  }
  // /api/projects/<id>/tabs/<tabId>/name: a tab rename (docs/specs/024-agents/agent-changesets.md).
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
    // A save reads only what it needs of the project, in one query (getProjectForSave): it runs on
    // every autosave.
    if (request.method === 'PUT') {
      const saving = await getProjectForSave(env, id);
      if (!saving) return missingProject(ctx, id);
      // Owner or edit-role share visitor only, and a tab-scoped visitor on their own tab only.
      const allowed = await gateEdit(ctx, id, saving.ownerId, saving.teamId, tabId);
      if (!allowed) return forbidden();
      return handleTabPut(ctx, saving, tabId, owner);
    }
    const existing = await getProject(env, id);
    if (!existing) return missingProject(ctx, id);

    if (request.method === 'GET') {
      // A project view (docs/specs/024-agents/project-views.md): checked before any read, rendered
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
      // id. The project owner sees everything (viewerId === ownerId is a
      // no-op). Same anti-claim posture as redactOwner on the project.
      const safe =
        owner === existing.ownerId
          ? tab
          : { ...tab, elements: redactCommentAuthorIds(tab.elements, owner) };
      if (view) return answerTabView(ctx, view, existing, safe, owner);
      // docs/specs/013-workspace/timeline.md §4.3: somebody arrived through a SHARE LINK and opened this.
      // The tab read is the honest signal for "opened" — the project GET is hit
      // by link previews and polls, whereas fetching tab content means a person
      // is looking at the canvas. Coalesced per visitor per day inside the
      // emit, so a stranger with a link can't flood the owner's feed by
      // refreshing.
      //
      // Gated on a share code being PRESENT, not merely on the caller not being
      // the owner. The read gate also admits any joined member of the project's
      // team (docs/specs/013-workspace/team-shared-projects.md), who presents no code — so the looser test reported
      // teammates browsing their own library as visitors. The bubble reads
      // "opened by a visitor · Someone with the share link" and files under the
      // sharing filter, so an owner saw that for a project they had never
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
      if (readProjectOpen(request.headers.get(PROJECT_OPEN_HEADER))) {
        ctx.waitUntil?.(recordProjectOpen(env, existing, owner, Date.now()));
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
      // end its own link, and the project's structure isn't the visitor's.
      const grant = await gateGrant(ctx, id, existing.ownerId, existing.teamId);
      if (grant?.tabScope !== null) return forbidden();
      // A tab this project does not have deletes nothing: said, not answered as done.
      if (!existing.tabs.some((t) => t.id === tabId)) return notFound();
      // An agent or the CLI (a token) may not delete the last tab (docs/specs/015-api/mcp-server.md
      // §4.17). The editor is let through: its saves and deletes race, so adding a tab and deleting
      // the other in one save can reach here first.
      if (ctx.token && existing.tabs.length <= 1) return conflict('last_tab');
      const removed = await deleteTabRow(env, id, tabId);
      // Its comments' words leave this project's feed with it (docs/specs/013-workspace/timeline.md §4.3).
      if (removed) ctx.waitUntil?.(retractTabComments(env, id, removed));
      // The links scoped to it die with it (docs/specs/013-workspace/tab-scoped-share-links.md), and their
      // holders leave the editor as on a revoke.
      const revoked = await deleteShareLinksForTab(env, id, tabId);
      for (const code of revoked) {
        ctx.waitUntil?.(broadcastShareOp(env, id, { kind: 'share-revoked', code }));
      }
      // A Form tab's link goes with it, and a form whose board or sheet it was stops taking responses (its link kept)
      // (docs/specs/030-forms/forms.md "Publishing and the form link").
      await deleteFormLinksForTab(env, id, tabId);
      await pauseFormsFeeding(env, id, tabId);
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

  // The item store (docs/specs/026-plan/items.md).
  const items = await handleItemRoutes(ctx);
  if (items) return items;
  // The sheet store (docs/specs/029-sheets/sheet-store.md).
  const sheets = await handleSheetRoutes(ctx);
  if (sheets) return sheets;
  // The project's type catalogue (docs/specs/026-plan/item-types.md).
  const itemTypes = await handleItemTypeRoutes(ctx);
  if (itemTypes) return itemTypes;
  // The project's plan for agents (docs/specs/026-plan/plan-agents.md).
  const plan = await handlePlanRoute(ctx);
  if (plan) return plan;

  // /api/projects/<id>/tabs/<tabId>/link — owner only.
  // A tab belongs to exactly one plan (its Durable Object holds it), so there is no linking an existing tab into
  // another project any more: POST …/tabs/<tabId>/link is gone (docs/specs/015-api/api.md "Storage").

  // /api/projects/<id>/share* — the share-link family lives in
  // project-share-routes.ts.
  {
    const shareResp = await handleProjectShareRoutes(ctx);
    if (shareResp) return shareResp;
  }

  return null;
}

// A refused per-tab request. A caller holding SOME grant on the project was
// refused this tab because their link is scoped to another one
// (docs/specs/013-workspace/tab-scoped-share-links.md): the tab reads as missing, 404, so its existence
// doesn't leak. Anyone else gets the usual 403.
