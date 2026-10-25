// /api/projects: a plan's content and what it knows of itself (name, owner, provenance), its tabs, comments,
// cards, sheets and forms, and the realtime room. Where a plan is filed, who may open it, its sharing and its
// Trash are the index's (liveworkspace/docs/one-explorer.md); the doors an API client still calls for those are
// answered from it (project-index-routes.ts).

import { readSeedItems, seedItems } from './item-routes';
import { readSeedSheets, seedSheets } from './sheet-routes';
import {
  catalogueWithBoardTypes,
  legacyCatalogue,
  validateItemTypeCatalogue,
  type ItemTypeCatalogue,
} from '@liveplanner/items';
import type { Tab } from '@liveplanner/project';
import { isValidTab, migrateIncomingTab, tabKindOf } from '@liveplanner/project';
import {
  createItemGrant,
  itemSourceOf,
  itemTabsOf,
  itemTabsRequest,
  itemTabsResponse,
  type ItemCreateRequest,
} from '@liveworkspace/index-app';
import { capStoredName } from '../names';
import { MAX_TAB_BYTES, TabTooLargeError, logTabRefused, tabDataBytes } from '../limits';
import {
  INDEX_GRANT_HEADER,
  indexIntentOf,
  INTENT_INVALID,
  MARK_USED_INVALID,
  readCreationIntent,
  readMarkUsed,
  type CreationIntent,
} from '@liveplanner/api-schema';
import { getProject, readReorderEntries, reorderTabs, seedTabs } from '../db';
import { badRequest, CORS_HEADERS, forbidden, json, notFound, payloadTooLarge } from '../responses';
import { projectDates, isProjectSource } from '@liveplanner/api-schema';
import { redactProjectForReader, redactProjectForScope } from '../redact-project';
import { answerOverview, parseViewQuery } from './project-views-route';
import { handleProjectSharedTabs } from './project-shared-tabs-route';
import { relayProjectRename } from '../room-client';
import { handleProjectRoomRoutes } from './project-room-routes';
import { handleProjectSubresources } from './project-subresource-routes';
import { compileSeededTabs, seedIntentOf } from './project-seed';
import { tokenTabsElementIssue } from './token-tab-elements';
import { hasTemplateSheets } from '@liveplanner/templates';
import { materialiseTemplateSheets } from '@liveplanner/templates/template-sheets';
import type { ProjectDTO } from '../types';
import { notifyMilestone } from '../email/notifications';
import { initPlan, readPlanMeta, readPlanTabs, renamePlan } from '../plan-room/plan-content';
import { identityOf } from '../plan-room/plan-route';
import { planRoom } from '../plan-client';
import { indexFor, indexService, linkCodeOf } from '../index-service';
import { handleProjectIndexRoutes, handleProjectList } from './project-index-routes';
import { resolvePlanGrant } from './plan-grant';
import {
  gateEdit,
  gateGrant,
  grantCallerOf,
  missingProject,
  requireOwner,
  type PlanRouteContext,
  type RouteContext,
  readBody,
} from './context';

function isPlanContext(ctx: RouteContext): ctx is PlanRouteContext {
  return 'PLAN_DB' in ctx.env;
}

// The longest plan id the worker names a Durable Object by. Ids are UUIDs; this only stops a hostile create from
// naming objects with megabyte ids.
const MAX_PLAN_ID = 200;

function intentRejected(): Response {
  return json({ error: INTENT_INVALID }, { status: 400 });
}

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
      if (made?.item) filed = { folderId: made.item.folderId, teamId: made.item.teamId };
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
// the Explorer and opened before its content was written) starts on its first read, as its grant's person's.
// Null when there is no grant to start it with, or the grant is a link visitor's.
async function startedProject(ctx: PlanRouteContext, id: string): Promise<ProjectDTO | null> {
  const found = await getProject(ctx.env, id);
  if (found) return found;
  const grant = ctx.grant;
  if (!grant || grant.item !== id || linkCodeOf(grant.sub)) return null;
  const now = Date.now();
  await initPlan(ctx.env, id, {
    name: 'Untitled',
    ownerId: grant.sub,
    teamId: grant.team,
    source: null,
    opensIn: null,
    tabKind: null,
    templateFamily: null,
    savedAt: now,
    createdAt: now,
  });
  console.info('[projects] started on open', { projectId: id });
  ctx.waitUntil?.(notifyMilestone(ctx.env, grant.sub));
  return getProject(ctx.env, id);
}

// /api/projects/<id>/tabs: the plan's tabs alone, `{ tabs: [{ id, name, kind }] }` (@liveworkspace/index-app
// tabs.ts), for the Share dialog's tab picker on liveworkspace.app, which would otherwise read the whole plan. Gated
// like a read: a miss is 404; a tab's share link sees its own tab alone. The kind is the plan's word for the tab
// (board, sheet, dashboard, form, or diagram for an ordinary tab).
async function projectTabs(ctx: PlanRouteContext, id: string): Promise<Response> {
  const grant = await gateGrant(ctx, id);
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
    if (request.method === 'POST') {
      const read = await readBody(ctx);
      if (read instanceof Response) return read;
      const body = read as Omit<Partial<ProjectDTO>, 'tabs'> & {
        tabs?: Tab[];
        intent?: unknown;
        markUsed?: unknown;
        items?: unknown;
        sheets?: unknown;
      };
      const owner = requireOwner(ctx);
      if (owner instanceof Response) return owner;
      if (!body.id || typeof body.name !== 'string') {
        return badRequest('missing id/name');
      }
      // The project's own dates (docs/specs/015-api/api.md "Project dates"), refused whole when
      // invalid, before anything is written.
      const dates = projectDates(body, Date.now());
      if (!dates.ok) return badRequest('invalid plan dates');
      // Seeded tabs given as a template are compiled first (docs/specs/015-api/api.md);
      // with no intent given, the first compiled tab supplies it, as the MCP derives it.
      let derivedIntent: CreationIntent | null = null;
      let templateElements: Tab['elements'] = [];
      if (Array.isArray(body.tabs)) {
        // An API token seeds Plan elements only, refused as the MCP refuses them (token-tab-elements.ts).
        const notPlan = ctx.token ? tokenTabsElementIssue(body.tabs) : null;
        if (notPlan) {
          console.warn('projects: rejected reason=not_plan_element');
          return badRequest(notPlan);
        }
        const seed = compileSeededTabs(body.tabs, body.id);
        if ('refusal' in seed) return json(seed.refusal.body, { status: seed.refusal.status });
        body.tabs = seed.tabs as Tab[];
        derivedIntent = seed.intent;
        templateElements = seed.templateElements;
      }
      // The creation intent (docs/specs/013-workspace/default-folders.md): which default folder a
      // create at the root of My Work lands in. Malformed, it refuses the create.
      const intent =
        body.intent === undefined && derivedIntent
          ? { ok: true as const, intent: derivedIntent }
          : readCreationIntent(body.intent);
      if (!intent.ok) {
        console.warn('projects: rejected reason=intent_invalid');
        return intentRejected();
      }
      // Whether making it is a use (docs/specs/015-api/api.md "Marking a project used"): absent
      // counts; anything but a boolean refuses the create before anything is written.
      const making = readMarkUsed(body.markUsed);
      if (!making.ok) {
        console.warn('projects: rejected reason=mark_used_invalid');
        return badRequest(MARK_USED_INVALID);
      }
      // Validate any seeded tabs up front (structure + per-tab byte cap) so a
      // create can't smuggle a malformed / oversized tab past the tab gate.
      if (Array.isArray(body.tabs)) {
        // Former stored shapes (an offline sync, an API-token script) are
        // migrated before validation, as every tab read migrates them (docs/specs/015-api/api.md).
        body.tabs = body.tabs.map((tab) => migrateIncomingTab(tab) as Tab);
        for (const tab of body.tabs) {
          if (!isValidTab(tab)) return badRequest('invalid tab');
          // The cap D1's row sets (docs/specs/015-api/api.md "Tab size"), measured as stored,
          // before anything is written, so a create never leaves a project without its tabs.
          const bytes = tabDataBytes(tab);
          if (bytes > MAX_TAB_BYTES) {
            logTabRefused('create', tab.id, bytes);
            return payloadTooLarge();
          }
        }
      }
      // A template's Sheets (docs/specs/029-sheets/sheet-store.md "Template starts"), however the tabs came (the
      // wizard, an agent, a template compiled above), on the validated tabs: made into seed sheets now, so the sheet exists the moment the
      // project does, the mark dropped from each Sheet. Validated with the rest of the seed sheets below.
      let templateSheets: unknown[] = [];
      if (Array.isArray(body.tabs) && hasTemplateSheets(body.tabs)) {
        const made = materialiseTemplateSheets(body.tabs, Date.now());
        body.tabs = made.tabs;
        templateSheets = made.sheets;
        console.info('[projects] template sheets made', {
          projectId: body.id,
          count: made.sheets.length,
        });
      }
      // Seed items (docs/specs/026-plan/items.md): an offline project's, on sync. Validated whole
      // before anything is written.
      const seedItemCreates = readSeedItems(body.items, owner);
      if (seedItemCreates instanceof Response) return seedItemCreates;
      // Seed sheets (docs/specs/029-sheets/sheet-store.md "Offline projects", "Copies"), validated the same way.
      // The request's own sheets, then the template's; anything that is not a list is refused below.
      const withTemplate = (asked: unknown): unknown => {
        if (templateSheets.length === 0) return asked;
        if (asked === undefined) return templateSheets;
        if (!Array.isArray(asked)) return asked;
        const own: readonly unknown[] = asked;
        return [...own, ...templateSheets];
      };
      const seedSheetCreates = readSeedSheets(withTemplate(body.sheets));
      if (seedSheetCreates instanceof Response) return seedSheetCreates;
      // A create is the index's item made a moment ago (or, for an API client, by the worker on its behalf): its
      // grant must be for this plan, at edit. A plan already started is a re-commit of its owner's own id, never
      // a way to take someone else's.
      if (!(await gateEdit(ctx, body.id))) return forbidden();
      const started = await getProject(env, body.id);
      const clash = started;
      if (clash && clash.ownerId !== owner) return forbidden();
      // The name cap (docs/specs/006-project/name-length.md): shortened here,
      // whoever the caller. A re-commit of the caller's own id compares against
      // what it already stores, so an unchanged pre-cap name is kept.
      const name = capStoredName(body.name, clash?.name ?? null, 'project');
      if (!name) return badRequest('missing id/name');
      const incomingTabs: Tab[] | null = Array.isArray(body.tabs)
        ? body.tabs.map((tab) => ({
            ...tab,
            name: capStoredName(
              tab.name,
              clash?.tabs.find((t) => t.id === tab.id)?.name ?? null,
              'tab',
            ),
          }))
        : null;
      // A type catalogue a copy or a sync carries (docs/specs/026-plan/item-types.md
      // "Storage and sync"), validated as the item-types route does; a bad one refuses the create.
      let itemTypes: ItemTypeCatalogue | null = null;
      if (body.itemTypes !== undefined && body.itemTypes !== null) {
        const checked = validateItemTypeCatalogue(body.itemTypes);
        if (!checked.ok)
          return json({ error: 'item_types_invalid', reason: checked.reason }, { status: 400 });
        itemTypes = checked.catalogue;
      }
      // A seeded Plan template's boards bring their card types (docs/specs/026-plan/item-types.md "The type
      // catalogue"): they join the catalogue given (none: they are its card types). Cards carried with no catalogue
      // come from a project made before card types started empty: they keep the default types (legacyCatalogue).
      itemTypes = legacyCatalogue(itemTypes, (seedItemCreates?.length ?? 0) > 0);
      const brought = catalogueWithBoardTypes(itemTypes, templateElements);
      // Checked as a catalogue the item-types route takes; one that would break a rule (its size) keeps the given one.
      if (brought && !validateItemTypeCatalogue(brought).ok) {
        console.warn('[item-types] brought invalid', { projectId: body.id });
      } else if (brought) {
        console.info('[item-types] brought', {
          projectId: body.id,
          chosen: itemTypes === null,
          types: brought.types.length,
        });
        itemTypes = brought;
      }
      // Tabs are the plan's own (each plan has its own store), so a seeded tab id can never name another
      // project's tab: a synced-back offline copy keeps its ids.
      const seeded = incomingTabs;
      // Only a genuine create takes the body's dates: a re-commit keeps the stored created date
      // (the upsert never rewrites it) and is modified now.
      const savedAt = clash ? Date.now() : dates.savedAt;
      // The plan's own row: what it knows of itself, its dates, and on a genuine create the type catalogue
      // (docs/specs/026-plan/item-types.md); a re-commit keeps its owner, team, provenance, intent and catalogue.
      await initPlan(env, body.id, {
        name,
        ownerId: owner,
        teamId: ctx.grant?.team ?? null,
        // Provenance (docs/specs/013-workspace/folders.md): only the closed set of generated sources
        // is accepted; anything else (or absent) is a user-made project.
        source: isProjectSource(body.source) ? body.source : null,
        // The creation intent, recorded once (docs/specs/013-workspace/default-folders.md "Recorded intent").
        opensIn: intent.intent?.mode ?? null,
        tabKind: intent.intent?.tabKind ?? null,
        templateFamily: intent.intent?.templateFamily ?? null,
        savedAt,
        createdAt: dates.createdAt,
        itemTypes: clash ? null : itemTypes,
      });
      // Seed tabs if the caller provided them. The editor app's
      // welcome flow uses this when it commits a fresh project
      // id — it ships the templated tab inline so the very
      // first per-tab fetch already has data.
      if (seeded) {
        try {
          await seedTabs(env, body.id, seeded, savedAt);
        } catch (error) {
          if (error instanceof TabTooLargeError) return payloadTooLarge();
          throw error;
        }
      }
      // Items only on a genuine create: a re-commit of an id never re-seeds its store.
      if (!clash && seedItemCreates.length > 0) {
        const refused = await seedItems(ctx, body.id, owner, seedItemCreates);
        if (refused) return refused;
      }
      if (!clash && seedSheetCreates.length > 0) {
        const refused = await seedSheets(ctx, body.id, owner, seedSheetCreates);
        if (refused) return refused;
      }
      const liveDoc = await getProject(env, body.id);
      if (!clash)
        console.info('[projects] created', { projectId: body.id, marked: making.markUsed });
      // A genuine create may be the owner's tenth plan (docs/specs/014-identity/transactional-email.md #6).
      if (!clash) ctx.waitUntil?.(notifyMilestone(env, owner));
      return json({ project: liveDoc }, { status: 201 });
    }
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
      const grant = await gateGrant(ctx, id);
      if (!grant) return notFound();
      const d = await startedProject(ctx, id);
      if (!d) return missingProject(ctx, id);
      // Redacted for every non-owner (redact-project.ts); a tab-scoped visitor
      // (docs/specs/013-workspace/tab-scoped-share-links.md) sees the other tabs locked.
      const reader = redactProjectForReader(d, ctx.resolveOwner());
      const liveDoc = redactProjectForScope(reader, grant.tabScope);
      // The overview view (docs/specs/024-agents/project-views.md), after the same gate and scope.
      if (view) return answerOverview(ctx, view, liveDoc, grant.tabScope);
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

  const subResp = await handleProjectSubresources(ctx);
  if (subResp) return subResp;

  return notFound();
}
