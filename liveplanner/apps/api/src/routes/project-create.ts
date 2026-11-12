// Making a plan (projects.ts, docs/specs/015-api/api.md): POST /api/projects inside the plan's Durable Object,
// its seeded tabs, items, sheets and card types checked whole before anything is written. projects.ts routes to it.

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
  INTENT_INVALID,
  MARK_USED_INVALID,
  readCreationIntent,
  readMarkUsed,
  type CreationIntent,
} from '@liveplanner/api-schema';
import { getProject, seedTabs } from '../db';
import { badRequest, forbidden, json, payloadTooLarge } from '../responses';
import { projectDates, isProjectSource } from '@liveplanner/api-schema';
import { compileSeededTabs } from './project-seed';
import { tokenTabsElementIssue } from './token-tab-elements';
import { hasTemplateSheets } from '@liveplanner/templates';
import { materialiseTemplateSheets } from '@liveplanner/templates/template-sheets';
import type { ProjectDTO } from '../types';
import { notifyMilestone } from '../email/notifications';
import { initPlan } from '../plan-room/plan-content';
import { gateEdit, requireOwner, type PlanRouteContext, readBody } from './context';

export function intentRejected(): Response {
  return json({ error: INTENT_INVALID }, { status: 400 });
}

// POST /api/projects: a create (or a re-commit of the owner's own id), its seeded tabs, items and sheets checked
// whole before anything is written.
export async function createProject(ctx: PlanRouteContext): Promise<Response> {
  const { env } = ctx;
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
        // An agent's or the API's tab write keeps no connection (connected-tabs.md "Agents and the CLI").
        ...(ctx.token ? { connection: undefined } : {}),
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
    const checked = validateItemTypeCatalogue(body.itemTypes, { newerFields: 'refuse' });
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
  // id: it ships the templated tab inline so the very
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
  if (!clash) console.info('[projects] created', { projectId: body.id, marked: making.markUsed });
  // A genuine create may be the owner's tenth plan (docs/specs/014-identity/transactional-email.md #6).
  if (!clash) ctx.waitUntil?.(notifyMilestone(env, owner));
  return json({ project: liveDoc }, { status: 201 });
}
