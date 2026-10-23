// /api/projects — project metadata, per-tab content, copy, folder
// assignment, tab linking, comments, share links, the realtime WS
// upgrade. The largest resource: every sub-path
// under a project id lives here.

import { readSeedItems, seedItems } from './item-routes';
import { readSeedSheets, seedSheets } from './sheet-routes';
import {
  catalogueWithBoardTypes,
  legacyCatalogue,
  validateItemTypeCatalogue,
  type ItemTypeCatalogue,
} from '@liveplanner/items';
import type { Tab } from '@liveplanner/project';
import { isValidTab, migrateIncomingTab } from '@liveplanner/project';
import { capStoredName } from '../names';
import { MAX_TAB_BYTES, TabTooLargeError, logTabRefused, tabDataBytes } from '../limits';
import {
  PROJECT_CONVERSION_HEADER,
  INTENT_INVALID,
  MARK_USED_INVALID,
  readCreationIntent,
  readProjectConversion,
  readMarkUsed,
  TEAM_RECENT_INCLUDE,
  TEAM_RECENT_LIMIT,
  type CreationIntent,
} from '@liveplanner/api-schema';
import {} from '../comments';
import {
  copyProject,
  getProject,
  getProjectThumbMeta,
  getTrashedProjectMeta,
  countProjectsByOwner,
  getParticipant,
  listProjectsByOwner,
  listRecentTeamProjects,
  listSharedWith,
  readReorderEntries,
  reorderTabs,
  seedTabs,
  upsertProjectMeta,
} from '../db';
import {
  badRequest,
  projectTrashed,
  forbidden,
  json,
  notFound,
  payloadTooLarge,
  svgImage,
} from '../responses';
import { projectDates, isProjectSource } from '@liveplanner/api-schema';
import { projectImageSvg } from '../project-image';
import { redactProjectForReader, redactProjectForScope } from '../redact-project';
import { answerOverview, parseViewQuery } from './project-views-route';
import { emailEnabled } from '../email/client';
import { notifyMilestone } from '../email/notifications';
import {
  recordProjectCreated,
  recordProjectDuplicated,
  recordProjectSynced,
  recordVisitorCopied,
} from '../timeline';
import { handleProjectDelete } from './project-delete-route';
import { handleProjectPlacement } from './project-placement-route';
import { handleProjectSharedTabs } from './project-shared-tabs-route';
import { relayProjectRename } from '../room-client';
import { handleProjectRoomRoutes } from './project-room-routes';
import { handleProjectSubresources } from './project-subresource-routes';
import { compileSeededTabs } from './project-seed';
import { hasTemplateSheets } from '@liveplanner/templates';
import { materialiseTemplateSheets } from '@liveplanner/templates/template-sheets';
import { parsePlacement, resolvePlacement } from '../placement/resolve-placement';
import { placementLookups } from '../placement/placement-lookups';
import {
  logDefaultSkipped,
  logPlacementRejected,
  logPlacementResolved,
  logPlacementSkipped,
  placementScope,
} from '../placement/placement-log';
import { intentRejected, placementRejected } from '../placement/placement-response';
import type { ProjectDTO } from '../types';
import { initPlan } from '../plan-room/plan-content';
import { identityOf } from '../plan-room/plan-route';
import { planRoom } from '../plan-client';
import {
  gateEdit,
  gateGrant,
  missingProject,
  requireOwner,
  shareCodeOf,
  sharePasswordOf,
  type PlanRouteContext,
  type RouteContext,
  readBody,
} from './context';
import { sharePasswordOk } from '../auth/share-access';

function isPlanContext(ctx: RouteContext): ctx is PlanRouteContext {
  return 'PLAN_DB' in ctx.env;
}

// The longest plan id the worker names a Durable Object by. Ids are UUIDs; this only stops a hostile create from
// naming objects with megabyte ids.
const MAX_PLAN_ID = 200;

// /api/projects in the worker. What reads no content is answered here: the project list (D1), a project's
// thumbnail (a fresh cache from R2; a stale one is drawn by the plan) and the realtime room's ticket and upgrade.
// Everything else about one plan, a create included, runs inside that plan's Durable Object
// (docs/specs/015-api/api.md "Storage"), with the caller's identity as resolved here.
export async function handleProjects(ctx: RouteContext): Promise<Response> {
  const { request, segments } = ctx;
  if (segments[1] !== 'projects') return notFound();
  if (segments.length === 2 && request.method === 'GET') return listProjects(ctx);
  if (segments.length === 4 && segments[3] === 'thumbnail') return projectThumbnail(ctx);
  // Realtime-room admission (docs/specs/015-api/api.md): the one-time WS ticket mint +
  // the Durable Object upgrade — see project-room-routes.ts.
  const roomResp = await handleProjectRoomRoutes(ctx);
  if (roomResp) return roomResp;
  if (isPlanContext(ctx)) return handlePlanRequest(ctx);
  return forwardToPlan(ctx);
}

// Hand a request about one plan to its Durable Object. A create names its plan in the body, read here from a copy
// so the request goes on whole; the answers for a body that names none are the create's own.
async function forwardToPlan(ctx: RouteContext): Promise<Response> {
  const { request, segments } = ctx;
  let planId = segments[2] ?? '';
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
  }
  if (!planId || planId.length > MAX_PLAN_ID) return notFound();
  return planRoom(ctx.env, planId).route(request, identityOf(ctx));
}

async function listProjects(ctx: RouteContext): Promise<Response> {
  const { env } = ctx;
  const owner = requireOwner(ctx);
  if (owner instanceof Response) return owner;
  // `?include=team-recent` (docs/specs/019-marketing/returning-visitor.md): the newest projects of
  // the teams the caller has joined, for their recent diagrams. Membership is read from the
  // verified account only, never the guest header, which anyone can set to any id.
  if (ctx.url.searchParams.get('include') === TEAM_RECENT_INCLUDE) {
    const [liveDocs, teamRecent] = await Promise.all([
      listProjectsByOwner(env, owner),
      ctx.verifiedUserId
        ? listRecentTeamProjects(env, ctx.verifiedUserId, TEAM_RECENT_LIMIT)
        : [],
    ]);
    return json({ projects: liveDocs, teamRecent });
  }
  const liveDocs = await listProjectsByOwner(env, owner);
  return json({ projects: liveDocs });
}

// /api/projects/<id>/thumbnail — cached SVG snapshot (docs/specs/006-project/project-snapshots.md). Read-
// gated exactly like GET /api/projects/<id>: the owner, a joined team
// member, or a valid share-code visitor. A native <img> can't send
// auth headers, so the editor app fetches this with headers and wraps
// the bytes in a blob URL; a miss (no project, no read access, no R2
// binding, empty project) is a 404 the row turns into its icon.
async function projectThumbnail(ctx: RouteContext): Promise<Response> {
  const { request, env, segments } = ctx;
  const id = segments[2]!;
  if (request.method !== 'GET') return notFound();
  // One query for the gate AND the cache-freshness check: this runs for
  // every preview in the Explorer grid, so its D1 round trips are the
  // floor on how fast a card can paint.
  const d = await getProjectThumbMeta(env, id);
  if (!d) return notFound();
  const grant = await gateGrant(ctx, id, d.ownerId, d.teamId);
  if (!grant) return notFound();
  // A tab-scoped visitor (docs/specs/013-workspace/tab-scoped-share-links.md) gets their tab, never the
  // first-tab snapshot.
  const svg = await projectImageSvg(env, d, grant.tabScope);
  // Nothing drawn (or no snapshot store). Past the gate, so this says
  // nothing about access, and the URL carries `?v=<savedAt>`: the answer
  // cannot change until the project does, so let the browser keep it
  // instead of re-asking on every Explorer visit.
  if (svg == null) {
    return json(
      { error: 'not_found' },
      { status: 404, headers: { 'Cache-Control': 'private, max-age=86400' } },
    );
  }
  // The client cache-busts via a `?v=<savedAt>` query param, so a
  // long private max-age is safe: a changed project changes the URL.
  return svgImage(svg, 'private, max-age=86400');
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
      // Placement (docs/specs/013-workspace/folders.md "Placement on create"): read up front so a
      // malformed one is refused before anything else is looked at.
      const requested = parsePlacement(body);
      if (!requested) {
        logPlacementRejected('placement_invalid', placementScope(body.teamId));
        return placementRejected('placement_invalid');
      }
      // Seeded tabs given as a template are compiled first (docs/specs/015-api/api.md);
      // with no intent given, the first compiled tab supplies it, as the MCP derives it.
      let derivedIntent: CreationIntent | null = null;
      let templateElements: Tab['elements'] = [];
      if (Array.isArray(body.tabs)) {
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
        logPlacementRejected(INTENT_INVALID, placementScope(body.teamId));
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
      // Ownership guard (security): upsertProjectMeta is INSERT ... ON
      // CONFLICT(id) DO UPDATE owner_id = excluded.owner_id, so a POST with an
      // id that already exists under a DIFFERENT owner would silently transfer
      // ownership to the caller. Project ids are unguessable UUIDs but they
      // leak to every share-link visitor / team member, so refuse the create
      // when the id is already owned by someone else (legitimate updates go
      // through PUT, which gates on edit access).
      const clash = await getProject(env, body.id);
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
      // An id in the Trash is taken just the same (docs/specs/013-workspace/trash.md):
      // its owner hears the deleted state, anyone else the same refusal.
      const binned = clash ? null : await getTrashedProjectMeta(env, body.id);
      if (binned) return binned.ownerId === owner ? projectTrashed() : forbidden();
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
      // Where the project is filed, decided before the write and written by it
      // (docs/specs/013-workspace/folders.md "Placement on create"). An invalid placement refuses
      // the create by name; it never files the project somewhere else. A re-commit of the
      // caller's own id keeps the placement it already has.
      let placement = { teamId: clash?.teamId ?? null, folderId: clash?.folderId ?? null };
      if (clash) {
        logPlacementSkipped();
      } else {
        const outcome = await resolvePlacement(
          requested,
          { ownerId: owner, verifiedUserId: ctx.verifiedUserId },
          placementLookups(env),
          intent.intent,
        );
        if (!outcome.ok) {
          logPlacementRejected(outcome.rejection, placementScope(requested.teamId));
          return placementRejected(outcome.rejection);
        }
        for (const skip of outcome.skipped) logDefaultSkipped(skip);
        logPlacementResolved(outcome.placement, outcome);
        placement = outcome.placement;
      }
      // Tabs are the plan's own (each plan has its own store), so a seeded tab id can never name another
      // project's tab: a synced-back offline copy keeps its ids.
      const seeded = incomingTabs;
      // Only a genuine create takes the body's dates: a re-commit keeps the stored created date
      // (the upsert never rewrites it) and is modified now.
      const savedAt = clash ? Date.now() : dates.savedAt;
      // Project meta first so the FK in tabs can resolve.
      await upsertProjectMeta(env, {
        id: body.id,
        ownerId: owner,
        name,
        shareable: body.shareable ?? false,
        shareCode: body.shareCode ?? null,
        folderId: placement.folderId,
        teamId: placement.teamId,
        // Provenance (docs/specs/013-workspace/folders.md): only the closed set of generated sources
        // is accepted; anything else (or absent) is a user-made project.
        source: isProjectSource(body.source) ? body.source : null,
        savedAt,
        createdAt: dates.createdAt,
        // The creation intent, recorded once (docs/specs/013-workspace/default-folders.md
        // "Recorded intent"); null without one. A re-commit's upsert never rewrites it.
        opensIn: intent.intent?.mode ?? null,
        tabKind: intent.intent?.tabKind ?? null,
        templateFamily: intent.intent?.templateFamily ?? null,
      });
      // The plan's own row: its dates, and on a genuine create the type catalogue
      // (docs/specs/026-plan/item-types.md); a re-commit keeps the one it has.
      await initPlan(env, body.id, {
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
      // docs/specs/013-workspace/timeline.md §4.2: only a GENUINE create earns a timeline event. A
      // POST that resolved to an existing row is the editor re-committing
      // an id it already owns, and "Diagram Created" twice for one
      // project is a lie the feed can't walk back.
      if (liveDoc && !clash) {
        // A sync (docs/specs/006-project/offline-mode.md) is a POST like any other, so the editor declares it:
        // undeclared, moving a project from this browser INTO the account was
        // reported as a project being created for the first time.
        const conversion = readProjectConversion(request.headers.get(PROJECT_CONVERSION_HEADER));
        if (conversion === 'sync') {
          ctx.waitUntil?.(recordProjectSynced(env, liveDoc, owner));
        } else {
          // Making it is a use of it for its maker, unless the create said not (a bulk import):
          // docs/specs/013-workspace/explorer-home.md "Making a project".
          console.info(`home: making doc=${liveDoc.id} marked=${making.markUsed}`);
          ctx.waitUntil?.(recordProjectCreated(env, liveDoc, owner, { markUsed: making.markUsed }));
        }
      }
      // docs/specs/014-identity/transactional-email.md (#6): on a genuine create (no prior row), check for a project
      // milestone. Count + send run in the background, off the response path.
      if (emailEnabled(env) && !clash) {
        ctx.waitUntil?.(
          countProjectsByOwner(env, owner).then((count) => notifyMilestone(env, owner, count)),
        );
      }
      return json({ project: liveDoc }, { status: 201 });
    }
  }

  // /api/projects/<id>
  if (segments.length === 3) {
    const id = segments[2]!;
    if (request.method === 'GET') {
      // Read access (docs/specs/013-workspace/team-shared-projects.md): the owner, a valid share-code visitor,
      // OR a joined member of the project's team — the same gate the
      // tab-content read below uses, so a team member can open a team
      // project by raw id (not just via a share link). A miss returns
      // 404 (not 403) so a guessed UUID can't probe existence.
      const view = parseViewQuery(new URL(request.url), 'project');
      if (view instanceof Response) return view;
      const d = await getProject(env, id);
      if (!d) return missingProject(ctx, id);
      const grant = await gateGrant(ctx, id, d.ownerId, d.teamId);
      // Redacted for every non-owner, exactly as the share-code resolver
      // does (docs/specs/014-identity/auth-and-guest-access.md): the gate above admits any valid share code, view
      // or edit, so this is the same audience — and a guest owner's id IS
      // their credential. This door was returning it intact while the
      // share door blanked it. See redact-project.ts.
      // A tab-scoped visitor (docs/specs/013-workspace/tab-scoped-share-links.md) sees the other tabs locked.
      if (!grant) return notFound();
      const reader = redactProjectForReader(d, ctx.resolveOwner());
      const liveDoc = redactProjectForScope(reader, grant.tabScope);
      // The overview view (docs/specs/024-agents/project-views.md), after the same gate and scope.
      if (view) return answerOverview(ctx, view, liveDoc, grant.tabScope);
      return json({ project: liveDoc });
    }
    if (request.method === 'PUT') {
      // Metadata-only PUT now that tabs live in their own table.
      // Body: { name?, tabIds?, tabs? } — name renames the project;
      // `tabs` (preferred, docs/specs/006-project/tab-folders.md) reorders AND sets each tab's
      // per-project folder; `tabIds` is the legacy folder-less shape,
      // still accepted for older clients. All optional, at least one
      // must be present.
      const read = await readBody(ctx);
      if (read instanceof Response) return read;
      const body = read as {
        name?: string;
        tabIds?: unknown;
        tabs?: unknown;
      };
      const owner = requireOwner(ctx);
      if (owner instanceof Response) return owner;
      const existing = await getProject(env, id);
      // Unknown id: 404. This PUT used to create-on-first-write (the legacy
      // localStorage-sync model), which let any stray meta write mint a
      // permanent zero-tab ghost row, e.g. a client path that missed the
      // Offline Mode dispatch (docs/specs/006-project/offline-mode.md) writing an offline project's id to
      // the server. Projects are only ever created via POST /projects now.
      if (!existing) return missingProject(ctx, id);
      const now = Date.now();
      const ownerId = existing.ownerId;
      // Anyone with the project id could previously rewrite it.
      // We now gate on canEditProject so only the owner or an
      // edit-role share visitor can touch metadata.
      const allowed = await gateEdit(ctx, id, ownerId, existing.teamId);
      if (!allowed) return forbidden();
      // The tab order, read whole before anything is written: one malformed entry refuses the request, rename and
      // all. Prefer the folder-carrying `tabs` shape; fall back to the legacy `tabIds` (treated as loose) so older
      // clients keep working.
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
      await upsertProjectMeta(env, {
        id,
        ownerId,
        name,
        shareable: existing.shareable,
        shareCode: existing.shareCode ?? null,
        folderId: existing.folderId ?? null,
        teamId: existing.teamId ?? null,
        // Preserve provenance (the upsert never rewrites it anyway, but
        // pass the existing value so the DTO is complete).
        source: existing.source ?? null,
        savedAt: now,
        createdAt: existing.createdAt,
      });
      if (order) await reorderTabs(env, id, order);
      const liveDoc = await getProject(env, id);
      // An agent's rename reaches the open editors (docs/specs/024-agents/agent-changesets.md "Whole-tab saves and tab
      // renames"); an editor sends its own rename to the room itself.
      if (ctx.token && liveDoc && name !== existing.name)
        ctx.waitUntil?.(relayProjectRename(env, id, liveDoc.name, liveDoc.tabs));
      // A rename is not a timeline moment (docs/specs/013-workspace/timeline.md §4.2): the feed reads
      // every project's CURRENT name instead, so older entries follow it.
      // Redacted like the GET: an edit-role share visitor passes gateEdit, and
      // a guest owner's id is a credential (see redact-project.ts).
      return json({ project: liveDoc ? redactProjectForReader(liveDoc, owner) : liveDoc });
    }
    if (request.method === 'DELETE') {
      // Trash, permanent delete and Take Offline: project-delete-route.ts
      // (docs/specs/013-workspace/trash.md).
      return handleProjectDelete(ctx, id);
    }
  }

  // /api/projects/<id>/copy — duplicate this project into the
  // caller's own files. Accepted from (a) the owner — same as
  // any other "duplicate" path; (b) a visitor with an active
  // `shared_with` row for the source; (c) a visitor providing
  // a valid X-Share-Code for the source. Skips share_links on the
  // copy by design (docs/specs/014-identity/auth-and-guest-access.md) so
  // the new project reads as the visitor's own clean workspace.
  if (segments.length === 4 && segments[3] === 'copy') {
    const id = segments[2]!;
    if (request.method === 'POST') {
      const owner = requireOwner(ctx);
      if (owner instanceof Response) return owner;
      const source = await getProject(env, id);
      if (!source) return missingProject(ctx, id);
      // Authorisation: any of (a) owner, (b) holder of any
      // share code (view or edit) for this project, (c)
      // visitor with an active shared_with row for the source.
      // The owner + share-code legs are exactly canReadProject
      // (view-role visitors can fork their own copy, so this
      // is a read check, not an edit check). The third leg is
      // copy-specific so it stays inline.
      //
      // Either way a tab-scoped visitor (docs/specs/013-workspace/tab-scoped-share-links.md) copies their tab
      // only: the share-code leg carries the link's scope, the shared_with
      // leg the scope recorded on their last visit.
      let scope: { tabScope: string | null } | null = await gateGrant(
        ctx,
        id,
        source.ownerId,
        source.teamId,
      );
      if (!scope) {
        const sharedRow = (await listSharedWith(env, owner)).find((s) => s.id === id);
        // A past visit is no way round the project's share password
        // (docs/specs/013-workspace/share-password.md): it must be given here as on every share-link read.
        if (sharedRow && (await sharePasswordOk(env, id, sharePasswordOf(request))))
          scope = { tabScope: sharedRow.tabId };
      }
      if (!scope) return forbidden();
      // A body is optional here, and a JSON `null` is as good as none.
      const body = ((await request.json().catch(() => null)) ?? {}) as {
        name?: unknown;
      };
      const newId = crypto.randomUUID();
      // The copy's name meets the name cap (docs/specs/006-project/name-length.md),
      // including the default, which a long source name pushes past it.
      const requested =
        typeof body.name === 'string' ? capStoredName(body.name, null, 'project') : '';
      const newName = requested || capStoredName(`Copy of ${source.name}`, null, 'project');
      const copy = await copyProject(
        env,
        id,
        newId,
        owner,
        newName,
        scope.tabScope,
        // Anyone but the owner copies the comments as the tab read serves them to them.
        owner === source.ownerId ? null : owner,
      );
      if (!copy) return notFound();
      // A copy is one project made on purpose: always a use (docs/specs/015-api/api.md "Marking a
      // project used").
      ctx.waitUntil?.(recordProjectDuplicated(env, copy, source.name, owner, { markUsed: true }));
      // A copy taken by someone who came in through a share link is news the
      // owner wants: their shared project was worth forking.
      //
      // Same gate as the visitor-open event, for the same reason: the copy
      // route's read check admits joined team members, who present no share
      // code, and telling an owner that a teammate duplicating a team-library
      // project was "copied by a visitor" is simply untrue.
      if (owner !== source.ownerId && shareCodeOf(request) !== null) {
        ctx.waitUntil?.(
          getParticipant(env, owner).then((p) =>
            recordVisitorCopied(env, source, owner, p?.name ?? null),
          ),
        );
      }
      return json({ project: copy }, { status: 201 });
    }
  }

  // /api/projects/<id>/folder — placement (docs/specs/013-workspace/folders.md + docs/specs/013-workspace/team-shared-projects.md); the
  // scope-change policy lives in project-placement-route.ts.
  {
    const placementResp = await handleProjectPlacement(ctx);
    if (placementResp) return placementResp;
  }

  // /api/projects/<id>/shared-tabs — what a delete leaves behind in other
  // projects (docs/specs/006-project/tab-project-many-to-many.md).
  {
    const sharedTabsResp = await handleProjectSharedTabs(ctx);
    if (sharedTabsResp) return sharedTabsResp;
  }

  const subResp = await handleProjectSubresources(ctx);
  if (subResp) return subResp;

  return notFound();
}
