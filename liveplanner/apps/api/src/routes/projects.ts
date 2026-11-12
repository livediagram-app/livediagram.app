// /api/projects: a plan's content and what it knows of itself (name, owner, provenance), its tabs, comments,
// cards, sheets and forms, and the realtime room. Where a plan is filed, who may open it, its sharing and its
// Trash are the index's (liveworkspace/docs/specs/004-index/one-explorer.md); the doors an API client still calls for those are
// answered from it (project-index-routes.ts).

import { tabKindOf } from '@liveplanner/project';
import {
  createItemGrant,
  itemSourceOf,
  itemTabsOf,
  itemTabsRequest,
  itemTabsResponse,
  type ItemCreateRequest,
} from '@liveworkspace/index-app';
import { capStoredName } from '../names';
import {
  INDEX_GRANT_HEADER,
  indexIntentOf,
  readCreationIntent,
  readMarkUsed,
} from '@liveplanner/api-schema';
import { getProject, readReorderEntries, reorderTabs } from '../db';
import { badRequest, CORS_HEADERS, forbidden, json, notFound } from '../responses';
import {
  redactProjectForCommunity,
  redactProjectForReader,
  redactProjectForScope,
} from '../redact-project';
import { handleCommunityOwnerRoutes } from './community-owner-routes';
import { readOwnerCommunityState } from '../plan-room/community-post';
import { answerOverview, parseViewQuery } from './project-views-route';
import { handleProjectSharedTabs } from './project-shared-tabs-route';
import { relayProjectRename } from '../room-client';
import { handleProjectRoomRoutes } from './project-room-routes';
import { handleProjectSubresources } from './project-subresource-routes';
import { seedIntentOf } from './project-seed';
import type { ProjectDTO } from '../types';
import { notifyMilestone } from '../email/notifications';
import { initPlan, readPlanMeta, readPlanTabs, renamePlan } from '../plan-room/plan-content';
import { identityOf } from '../plan-room/plan-route';
import { planRoom } from '../plan-client';
import { indexFor, indexService, linkCodeOf } from '../index-service';
import { handleProjectIndexRoutes, handleProjectList } from './project-index-routes';
import { resolvePlanGrant } from './plan-grant';
import {
  COMMUNITY_CONTENT,
  gateEdit,
  gateGrant,
  grantCallerOf,
  missingProject,
  requireOwner,
  type PlanRouteContext,
  type RouteContext,
  readBody,
} from './context';
import { intentRejected, createProject } from './project-create';

function isPlanContext(ctx: RouteContext): ctx is PlanRouteContext {
  return 'PLAN_DB' in ctx.env;
}

// The longest plan id the worker names a Durable Object by. Ids are UUIDs; this only stops a hostile create from
// naming objects with megabyte ids.
const MAX_PLAN_ID = 200;

// /api/projects in the worker. The list and the index's doors (delete, copy, share) are answered from the index;
// the realtime room's ticket and upgrade here; everything else about one plan, a create included, runs inside that
// plan's Durable Object (docs/specs/015-api/api.md "Storage"), with the caller's identity and the index's grant as
// settled here.
export async function handleProjects(ctx: RouteContext): Promise<Response> {
  const { request, segments } = ctx;
  if (segments[1] !== 'projects') return notFound();
  if (isPlanContext(ctx)) return handlePlanRequest(ctx);
  if (segments.length === 2 && request.method === 'GET') return handleProjectList(ctx);
  const indexResp = await handleProjectIndexRoutes(ctx);
  if (indexResp) return indexResp;
  const roomResp = await handleProjectRoomRoutes(ctx);
  if (roomResp) return roomResp;
  return forwardToPlan(ctx);
}

// Hand a request about one plan to its Durable Object, with the index's grant on it. A create names its plan in
// the body, read here from a copy so the request goes on whole.
async function forwardToPlan(ctx: RouteContext): Promise<Response> {
  const { request, segments } = ctx;
  let planId = segments[2] ?? '';
  let grant: Awaited<ReturnType<typeof resolvePlanGrant>>;
  let renamedTo: string | null = null;
  // Where the index filed an API client's create, for its answer.
  let filed: { folderId: string | null; teamId: string | null } | null = null;
  // An API client's create that is a use of the plan (docs/specs/015-api/api.md "Marking a project used").
  let marksUse = false;
  if (segments.length === 2) {
    if (request.method !== 'POST') return notFound();
    const read = await readBody({ ...ctx, request: request.clone() });
    if (read instanceof Response) return read;
    const owner = requireOwner(ctx);
    if (owner instanceof Response) return owner;
    const { id: named, name } = read;
    if (typeof named !== 'string' || !named || typeof name !== 'string') {
      return badRequest('missing id/name');
    }
    planId = named;
    if (planId.length > MAX_PLAN_ID) return notFound();
    if (request.headers.get(INDEX_GRANT_HEADER)) {
      grant = await resolvePlanGrant(ctx, planId);
    } else {
      // An API client's create (no grant): the index makes the item under the id the client minted, and the plan
      // opens with the grant that comes back. The id already taken is the same client re-committing its own plan:
      // the grant it holds decides (@liveworkspace/index-app createItemGrant).
      const create = createRequestOf(read, planId);
      if (create instanceof Response) return create;
      const made = await createItemGrant(
        indexService,
        ctx.env,
        request,
        grantCallerOf(ctx),
        planId,
        create,
        (body, status) => json(body, { status }),
      );
      if (made instanceof Response) return made;
      grant = made?.grant ?? null;
      // The index made the item now: a making (an id it already held is a re-commit, which is none).
      if (made?.item) {
        filed = { folderId: made.item.folderId, teamId: made.item.teamId };
        const making = readMarkUsed(read.markUsed);
        marksUse = making.ok && making.markUsed;
      }
    }
  } else {
    if (!planId || planId.length > MAX_PLAN_ID) return notFound();
    grant = await resolvePlanGrant(ctx, planId);
    // An API client's rename is the index's title too; the editor renames there itself.
    if (segments.length === 3 && request.method === 'PUT' && (ctx.token || ctx.workbench)) {
      const body = await readBody({ ...ctx, request: request.clone() });
      if (!(body instanceof Response) && typeof body.name === 'string') renamedTo = body.name;
    }
  }
  if (grant instanceof Response) return grant;
  const res = await planRoom(ctx.env, planId).route(request, identityOf({ ...ctx, grant }));
  // Making it is a use for the caller, recorded at the index beside the create as the editor records its own; never
  // waited on. The room's 400 for a markUsed that is not a boolean made nothing, so it records nothing.
  if (marksUse && res.status === 201) {
    const client = indexFor(ctx.env, grantCallerOf(ctx));
    if (client)
      ctx.waitUntil?.(
        client.recordOpen(planId, null).catch((err: unknown) => {
          console.warn('[projects] use not recorded', { planId, error: String(err) });
        }),
      );
  }
  if (renamedTo !== null && res.ok) {
    const title = capStoredName(renamedTo, null, 'project');
    const client = indexFor(ctx.env, grantCallerOf(ctx));
    if (title && client)
      ctx.waitUntil?.(
        client.updateItem(planId, { title }).catch((err: unknown) => {
          console.warn('[index] rename failed', { planId, error: String(err) });
        }),
      );
  }
  // An API client's create answers where the index filed it (the MCP names the folder it landed in).
  if (filed && res.status === 201) {
    const answer = (await res.json()) as { project?: ProjectDTO | null };
    if (answer.project) answer.project = { ...answer.project, ...filed };
    return json(answer, { status: 201 });
  }
  return res;
}

// What an API client's create (POST /api/projects without a grant) asks the index for: the plan's title, where it
// is filed (a folder or team named, else the index's default folder for its intent), its intent and provenance.
// The intent is the one the plan records: the body's, else its first seeded tab's. A malformed intent refuses the
// create before the index makes anything.
function createRequestOf(
  body: Record<string, unknown>,
  planId: string,
): ItemCreateRequest | Response {
  const given = body.intent === undefined ? null : readCreationIntent(body.intent);
  if (given && !given.ok) return intentRejected();
  const intent = given ? given.intent : seedIntentOf(body.tabs, planId);
  const title =
    capStoredName(typeof body.name === 'string' ? body.name : '', null, 'project') || undefined;
  return {
    ...(title ? { title } : {}),
    // Left out, the index files it by its intent's default folder; a folder or team named is where it goes.
    ...(typeof body.folderId === 'string' || body.folderId === null
      ? { folderId: body.folderId }
      : {}),
    ...(typeof body.teamId === 'string' ? { teamId: body.teamId } : {}),
    intent: indexIntentOf(intent),
    source: itemSourceOf(body.source),
  };
}

// A plan the index knows (the caller holds its grant) that nothing has started yet (a copy, or an item made in
// the Explorer and opened before its content was written) starts on its first read, as the owner the grant names
// (the index decides the owner, docs/specs/015-api/api.md "Storage"). A grant from before the index named it falls
// back to its person, unless that person came in through a share link: a visitor, signed in or not, is never
// recorded as the owner. Null when there is no grant to start it with, or no owner to start it as.
async function startedProject(ctx: PlanRouteContext, id: string): Promise<ProjectDTO | null> {
  const found = await getProject(ctx.env, id);
  if (found) return found;
  const grant = ctx.grant;
  if (!grant || grant.item !== id) return null;
  const ownerId = grant.owner ?? (linkCodeOf(grant.sub) || grant.shareCode ? null : grant.sub);
  if (!ownerId) return null;
  const now = Date.now();
  await initPlan(ctx.env, id, {
    name: 'Untitled',
    ownerId,
    teamId: grant.team,
    source: null,
    opensIn: null,
    tabKind: null,
    templateFamily: null,
    savedAt: now,
    createdAt: now,
  });
  console.info('[projects] started on open', { projectId: id });
  if (ownerId === grant.sub) ctx.waitUntil?.(notifyMilestone(ctx.env, ownerId));
  return getProject(ctx.env, id);
}

// /api/projects/<id>/tabs: the plan's tabs alone, `{ tabs: [{ id, name, kind }] }` (@liveworkspace/index-app
// tabs.ts), for the Share dialog's tab picker on liveworkspace.app, which would otherwise read the whole plan. Gated
// like a read: a miss is 404; a tab's share link sees its own tab alone. The kind is the plan's word for the tab
// (board, sheet, dashboard, form, or diagram for an ordinary tab). A Community post's link lists every tab.
async function projectTabs(ctx: PlanRouteContext, id: string): Promise<Response> {
  const grant = await gateGrant(ctx, id, null, null, COMMUNITY_CONTENT);
  if (!grant) return notFound();
  const rows = await readPlanTabs(ctx.env, id);
  if (rows.length === 0 && !(await readPlanMeta(ctx.env, id))) return notFound();
  const tabs = rows.map((r) => ({
    id: r.id,
    name: r.name,
    kind: tabKindOf({ kind: r.kind ?? undefined }),
  }));
  return itemTabsResponse(itemTabsOf(tabs, grant.tabScope), CORS_HEADERS);
}

// Everything about one plan, inside its Durable Object (plan-room/plan-route.ts).
export async function handlePlanRequest(ctx: PlanRouteContext): Promise<Response> {
  const { request, env, segments } = ctx;
  if (segments[1] !== 'projects') return notFound();
  if (segments.length === 2) {
    if (request.method === 'POST') return createProject(ctx);
  }

  // /api/projects/<id>/tabs
  const tabsOf = itemTabsRequest(request.method, segments, 'projects');
  if (tabsOf) return projectTabs(ctx, tabsOf);

  // /api/projects/<id>
  if (segments.length === 3) {
    const id = segments[2]!;
    if (request.method === 'GET') {
      // Read access is the grant's (docs/specs/013-workspace/share-roles.md): a miss is 404, never 403, so a
      // guessed id can't probe existence.
      const view = parseViewQuery(new URL(request.url), 'project');
      if (view instanceof Response) return view;
      const grant = await gateGrant(ctx, id, null, null, COMMUNITY_CONTENT);
      if (!grant) return notFound();
      const d = await startedProject(ctx, id);
      if (!d) return missingProject(ctx, id);
      // Redacted for every non-owner (redact-project.ts); a Community visitor sees the post's redactions
      // (docs/specs/025-community/community.md "Viewing a post's plan"); a tab-scoped visitor
      // (docs/specs/013-workspace/tab-scoped-share-links.md) sees the other tabs locked.
      // The owner's read carries their post's state, for the header's Public badge after a reload.
      const caller = ctx.resolveOwner();
      const own =
        caller !== null && caller === d.ownerId
          ? { ...d, communityState: await readOwnerCommunityState(ctx.env) }
          : d;
      const reader = redactProjectForReader(own, caller);
      const liveDoc = redactProjectForScope(
        grant.community ? redactProjectForCommunity(reader) : reader,
        grant.tabScope,
      );
      // The overview view (docs/specs/024-agents/project-views.md), after the same gate and scope.
      if (view) return answerOverview(ctx, view, liveDoc, grant.tabScope, grant.community);
      return json({ project: liveDoc });
    }
    if (request.method === 'PUT') {
      // Body: { name?, tabIds?, tabs? }: name renames the plan here (the index's title is the editor's own call,
      // or the worker's for an API client); `tabs` (preferred, docs/specs/006-project/tab-folders.md) reorders
      // and sets each tab's folder; `tabIds` is the legacy folder-less shape. All optional.
      const read = await readBody(ctx);
      if (read instanceof Response) return read;
      const body = read as { name?: string; tabIds?: unknown; tabs?: unknown };
      const owner = requireOwner(ctx);
      if (owner instanceof Response) return owner;
      if (!(await gateEdit(ctx, id))) return (await gateGrant(ctx, id)) ? forbidden() : notFound();
      const existing = await startedProject(ctx, id);
      if (!existing) return missingProject(ctx, id);
      const order = Array.isArray(body.tabs)
        ? readReorderEntries(body.tabs)
        : Array.isArray(body.tabIds)
          ? readReorderEntries(body.tabIds)
          : undefined;
      if (order === null) return badRequest('invalid tabs');
      // A rename meets the name cap (docs/specs/006-project/name-length.md); a
      // name echoed back unchanged (a reorder) is kept even if it predates it.
      const name =
        typeof body.name === 'string'
          ? capStoredName(body.name, existing.name, 'project')
          : existing.name;
      if (!name) return badRequest('missing name');
      await renamePlan(env, id, name, Date.now());
      if (order) await reorderTabs(env, id, order);
      const liveDoc = await getProject(env, id);
      // An agent's rename reaches the open editors (docs/specs/024-agents/agent-changesets.md "Whole-tab saves and tab
      // renames"); an editor sends its own rename to the room itself.
      if (ctx.token && liveDoc && name !== existing.name)
        ctx.waitUntil?.(relayProjectRename(env, id, liveDoc.name, liveDoc.tabs));
      return json({ project: liveDoc ? redactProjectForReader(liveDoc, owner) : liveDoc });
    }
  }

  // /api/projects/<id>/shared-tabs — what taking the plan offline leaves behind in other
  // plans (docs/specs/006-project/tab-project-many-to-many.md).
  {
    const sharedTabsResp = await handleProjectSharedTabs(ctx);
    if (sharedTabsResp) return sharedTabsResp;
  }

  // /api/projects/<id>/community: publish to, edit in or remove from Community
  // (docs/specs/025-community/community.md "Publishing").
  {
    const communityResp = await handleCommunityOwnerRoutes(ctx);
    if (communityResp) return communityResp;
  }

  const subResp = await handleProjectSubresources(ctx);
  if (subResp) return subResp;

  return notFound();
}
