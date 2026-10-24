// /api/designs: a design's content and what it knows of itself (name, owner, provenance), its tabs, comments,
// cards, sheets and forms, and the realtime room. Where a design is filed, who may open it, its sharing and its
// Trash are the index's (liveworkspace/docs/one-explorer.md); the doors an API client still calls for those are
// answered from it (design-index-routes.ts).

import type { Tab } from '@livedesign/design';
import { isValidTab, migrateIncomingTab } from '@livedesign/design';
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
  MAX_DECK_LEN,
  MAX_TAB_BYTES,
  TabTooLargeError,
  logTabRefused,
  tabDataBytes,
} from '../limits';
import {
  INDEX_GRANT_HEADER,
  INTENT_INVALID,
  MARK_USED_INVALID,
  creationIntentOf,
  readCreationIntent,
  readMarkUsed,
  type CreationIntent,
} from '@livedesign/api-schema';
import { getDesign, readReorderEntries, reorderTabs, seedTabs } from '../db';
import { badRequest, CORS_HEADERS, forbidden, json, notFound, payloadTooLarge } from '../responses';
import { designDates, isDesignSource } from '@livedesign/api-schema';
import { redactDesignForReader, redactDesignForScope } from '../redact-design';
import { answerOverview, parseViewQuery } from './design-views-route';
import { handleDesignSharedTabs } from './design-shared-tabs-route';
import { relayDesignRename } from '../room-client';
import { handleDesignRoomRoutes } from './design-room-routes';
import { handleDesignSubresources } from './design-subresource-routes';
import { compileSeededTabs } from './design-seed';
import type { DesignDTO } from '../types';
import { notifyMilestone } from '../email/notifications';
import {
  initDesign,
  readDesignMeta,
  readDesignTabs,
  renameDesign,
  setDesignPresentation,
} from '../design-room/design-content';
import { identityOf } from '../design-room/design-route';
import { designRoom } from '../design-client';
import { indexFor, indexService, linkCodeOf } from '../index-service';
import { handleDesignIndexRoutes, handleDesignList } from './design-index-routes';
import { resolveDesignGrant } from './design-grant';
import {
  gateEdit,
  gateGrant,
  grantCallerOf,
  missingDesign,
  requireOwner,
  type DesignRouteContext,
  type RouteContext,
  readBody,
} from './context';

function isDesignContext(ctx: RouteContext): ctx is DesignRouteContext {
  return 'DESIGN_DB' in ctx.env;
}

// The longest design id the worker names a Durable Object by. Ids are UUIDs; this only stops a hostile create from
// naming objects with megabyte ids.
const MAX_DESIGN_ID = 200;

function intentRejected(): Response {
  return json({ error: INTENT_INVALID }, { status: 400 });
}

// /api/designs in the worker. The list and the index's doors (delete, copy, share) are answered from the index;
// the realtime room's ticket and upgrade here; everything else about one design, a create included, runs inside that
// design's Durable Object (docs/specs/015-api/api.md "Storage"), with the caller's identity and the index's grant as
// settled here.
export async function handleDesigns(ctx: RouteContext): Promise<Response> {
  const { request, segments } = ctx;
  if (segments[1] !== 'designs') return notFound();
  if (isDesignContext(ctx)) return handleDesignRequest(ctx);
  if (segments.length === 2 && request.method === 'GET') return handleDesignList(ctx);
  const indexResp = await handleDesignIndexRoutes(ctx);
  if (indexResp) return indexResp;
  const roomResp = await handleDesignRoomRoutes(ctx);
  if (roomResp) return roomResp;
  return forwardToDesign(ctx);
}

// Hand a request about one design to its Durable Object, with the index's grant on it. A create names its design in
// the body, read here from a copy so the request goes on whole.
async function forwardToDesign(ctx: RouteContext): Promise<Response> {
  const { request, segments } = ctx;
  let designId = segments[2] ?? '';
  let grant: Awaited<ReturnType<typeof resolveDesignGrant>>;
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
    designId = named;
    if (designId.length > MAX_DESIGN_ID) return notFound();
    if (request.headers.get(INDEX_GRANT_HEADER)) {
      grant = await resolveDesignGrant(ctx, designId);
    } else {
      // An API client's create: the worker makes the index's item for it, under the id it minted, and opens the
      // design with the grant that comes back. The id already taken is the same client re-committing its own
      // design: its grant decides.
      const create = createRequestOf(read);
      if (create instanceof Response) return create;
      const made = await createItemGrant(
        indexService,
        ctx.env,
        request,
        grantCallerOf(ctx),
        designId,
        create,
        (body, status) => json(body, { status }),
      );
      if (made instanceof Response) return made;
      grant = made?.grant ?? null;
      if (made?.item) filed = { folderId: made.item.folderId, teamId: made.item.teamId };
    }
  } else {
    if (!designId || designId.length > MAX_DESIGN_ID) return notFound();
    grant = await resolveDesignGrant(ctx, designId);
    // An API client's rename is the index's title too; the editor renames there itself.
    if (segments.length === 3 && request.method === 'PUT' && (ctx.token || ctx.workbench)) {
      const body = await readBody({ ...ctx, request: request.clone() });
      if (!(body instanceof Response) && typeof body.name === 'string') renamedTo = body.name;
    }
  }
  if (grant instanceof Response) return grant;
  const res = await designRoom(ctx.env, designId).route(request, identityOf({ ...ctx, grant }));
  if (renamedTo !== null && res.ok) {
    const title = capStoredName(renamedTo, null, 'design');
    const client = indexFor(ctx.env, grantCallerOf(ctx));
    if (title && client)
      ctx.waitUntil?.(
        client.updateItem(designId, { title }).catch((err: unknown) => {
          console.warn('[index] rename failed', { designId, error: String(err) });
        }),
      );
  }
  // An API client's create answers where the index filed it (the MCP names the folder it landed in).
  if (filed && res.status === 201) {
    const answer = (await res.json()) as { design?: DesignDTO | null };
    if (answer.design) answer.design = { ...answer.design, ...filed };
    return json(answer, { status: 201 });
  }
  return res;
}

// What an API client's create (POST /api/designs without a grant) asks the index for: the design's title, where it
// is filed (a folder or team named, else the index's default for its intent), its intent and provenance. A malformed
// intent refuses the create before the index makes anything.
function createRequestOf(body: Record<string, unknown>): ItemCreateRequest | Response {
  const read = body.intent === undefined ? null : readCreationIntent(body.intent);
  if (read && !read.ok) return intentRejected();
  // With no intent given, a seeded tab given as a template supplies it, as the design's own create does.
  const intent = read?.ok ? read.intent : seededIntentOf(body.tabs);
  const title =
    capStoredName(typeof body.name === 'string' ? body.name : '', null, 'design') || undefined;
  return {
    ...(title ? { title } : {}),
    // Left out, the index files it by its intent's default folder; a folder or team named is where it goes.
    ...(typeof body.folderId === 'string' || body.folderId === null
      ? { folderId: body.folderId }
      : {}),
    ...(typeof body.teamId === 'string' ? { teamId: body.teamId } : {}),
    // The intent as the index keeps it, one word for filters and defaults ("pages:diagram"), as the editor sends it.
    intent: intent ? [intent.mode, intent.tabKind].join(':') : null,
    source: itemSourceOf(body.source),
  };
}

// The intent a create's seeded tabs supply when its first tab is given as a template (design-seed.ts), read without
// compiling it.
function seededIntentOf(tabs: unknown): CreationIntent | null {
  if (!Array.isArray(tabs)) return null;
  const first: unknown = tabs[0];
  if (typeof first !== 'object' || first === null) return null;
  const tab = first as { template?: unknown; elements?: unknown };
  return tab.template !== undefined && tab.elements === undefined
    ? creationIntentOf(undefined)
    : null;
}

// A design the index knows (the caller holds its grant) that nothing has started yet (a copy, or an item made in
// the Explorer and opened before its content was written) starts on its first read, as its grant's person's.
// Null when there is no grant to start it with, or the grant is a link visitor's.
async function startedDesign(ctx: DesignRouteContext, id: string): Promise<DesignDTO | null> {
  const found = await getDesign(ctx.env, id);
  if (found) return found;
  const grant = ctx.grant;
  if (!grant || grant.item !== id || linkCodeOf(grant.sub)) return null;
  const now = Date.now();
  await initDesign(ctx.env, id, {
    name: 'Untitled',
    ownerId: grant.sub,
    teamId: grant.team,
    source: null,
    opensIn: null,
    tabKind: null,
    savedAt: now,
    createdAt: now,
  });
  console.info('[designs] started on open', { designId: id });
  ctx.waitUntil?.(notifyMilestone(ctx.env, grant.sub));
  return getDesign(ctx.env, id);
}

// /api/designs/<id>/tabs: the design's tabs alone (`{ tabs: [{ id, name, kind }] }`), for the Share dialog's tab picker
// on liveworkspace.app (@liveworkspace/index-app tabs.ts), gated by the grant like a read. A tab's share link sees its
// own tab alone. Read from the tab rows, never their content.
async function designTabs(ctx: DesignRouteContext, id: string): Promise<Response> {
  const grant = await gateGrant(ctx, id);
  if (!grant) return notFound();
  const rows = await readDesignTabs(ctx.env, id);
  if (rows.length === 0 && !(await readDesignMeta(ctx.env, id))) return notFound();
  return itemTabsResponse(itemTabsOf(rows, grant.tabScope), CORS_HEADERS);
}

// Everything about one design, inside its Durable Object (design-room/design-route.ts).
export async function handleDesignRequest(ctx: DesignRouteContext): Promise<Response> {
  const { request, env, segments } = ctx;
  if (segments[1] !== 'designs') return notFound();
  if (segments.length === 2) {
    if (request.method === 'POST') {
      const read = await readBody(ctx);
      if (read instanceof Response) return read;
      const body = read as Omit<Partial<DesignDTO>, 'tabs'> & {
        tabs?: Tab[];
        intent?: unknown;
        markUsed?: unknown;
      };
      const owner = requireOwner(ctx);
      if (owner instanceof Response) return owner;
      if (!body.id || typeof body.name !== 'string') {
        return badRequest('missing id/name');
      }
      // The design's own dates (docs/specs/015-api/api.md "Design dates"), refused whole when
      // invalid, before anything is written.
      const dates = designDates(body, Date.now());
      if (!dates.ok) return badRequest('invalid design dates');
      // Seeded tabs given as a template are compiled first (docs/specs/015-api/api.md);
      // with no intent given, the first compiled tab supplies it, as the MCP derives it.
      let derivedIntent: CreationIntent | null = null;
      if (Array.isArray(body.tabs)) {
        const seed = compileSeededTabs(body.tabs, body.id);
        if ('refusal' in seed) return json(seed.refusal.body, { status: seed.refusal.status });
        body.tabs = seed.tabs as Tab[];
        derivedIntent = seed.intent;
      }
      // The creation intent (docs/specs/013-workspace/default-folders.md): which default folder a
      // create at the root of My Work lands in. Malformed, it refuses the create.
      const intent =
        body.intent === undefined && derivedIntent
          ? { ok: true as const, intent: derivedIntent }
          : readCreationIntent(body.intent);
      if (!intent.ok) {
        console.warn('designs: rejected reason=intent_invalid');
        return intentRejected();
      }
      // Whether making it is a use (docs/specs/015-api/api.md "Marking a design used"): absent
      // counts; anything but a boolean refuses the create before anything is written.
      const making = readMarkUsed(body.markUsed);
      if (!making.ok) {
        console.warn('designs: rejected reason=mark_used_invalid');
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
          // before anything is written, so a create never leaves a design without its tabs.
          const bytes = tabDataBytes(tab);
          if (bytes > MAX_TAB_BYTES) {
            logTabRefused('create', tab.id, bytes);
            return payloadTooLarge();
          }
        }
      }
      // A create is the index's item made a moment ago (or, for an API client, by the worker on its behalf): its
      // grant must be for this design, at edit. A design already started is a re-commit of its owner's own id, never
      // a way to take someone else's.
      if (!(await gateEdit(ctx, body.id))) return forbidden();
      const clash = await getDesign(env, body.id);
      if (clash && clash.ownerId !== owner) return forbidden();
      // The name cap (docs/specs/006-design/name-length.md): shortened here,
      // whoever the caller. A re-commit of the caller's own id compares against
      // what it already stores, so an unchanged pre-cap name is kept.
      const name = capStoredName(body.name, clash?.name ?? null, 'design');
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
      if (typeof body.presentation === 'string' && body.presentation.length > MAX_DECK_LEN) {
        return badRequest('presentation too large');
      }
      // Tabs are the design's own (each design has its own store), so a seeded tab id can never name another
      // design's tab: a synced-back offline copy keeps its ids.
      const seeded = incomingTabs;
      // Only a genuine create takes the body's dates: a re-commit keeps the stored created date
      // (the upsert never rewrites it) and is modified now.
      const savedAt = clash ? Date.now() : dates.savedAt;
      // The design's own row: what it knows of itself, its dates, and on a genuine create the type catalogue
      // (docs/specs/015-api/api.md "Storage"); a re-commit keeps its owner, team, provenance, intent and catalogue.
      await initDesign(env, body.id, {
        name,
        ownerId: owner,
        teamId: ctx.grant?.team ?? null,
        // Usually none. An Offline Mode sync carries the deck it built offline (docs/specs/006-design/offline-mode.md),
        // and a copy its source's, which would otherwise be lost.
        presentation: typeof body.presentation === 'string' ? body.presentation : null,
        // Provenance (docs/specs/013-workspace/folders.md): only the closed set of generated sources
        // is accepted; anything else (or absent) is a user-made design.
        source: isDesignSource(body.source) ? body.source : null,
        // The creation intent, recorded once (docs/specs/013-workspace/default-folders.md "Recorded intent").
        opensIn: intent.intent?.mode ?? null,
        tabKind: intent.intent?.tabKind ?? null,
        savedAt,
        createdAt: dates.createdAt,
      });
      // Seed tabs if the caller provided them. The live app's
      // welcome flow uses this when it commits a fresh design
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
      const liveDoc = await getDesign(env, body.id);
      if (!clash) console.info('[designs] created', { designId: body.id, marked: making.markUsed });
      // A genuine create may be the owner's tenth design (docs/specs/014-identity/transactional-email.md #6).
      if (!clash) ctx.waitUntil?.(notifyMilestone(env, owner));
      return json({ design: liveDoc }, { status: 201 });
    }
  }

  // /api/designs/<id>/tabs
  const tabsOf = itemTabsRequest(request.method, segments, 'designs');
  if (tabsOf) return designTabs(ctx, tabsOf);

  // /api/designs/<id>
  if (segments.length === 3) {
    const id = segments[2]!;
    if (request.method === 'GET') {
      // Read access is the grant's (docs/specs/013-workspace/share-roles.md): a miss is 404, never 403, so a
      // guessed id can't probe existence.
      const view = parseViewQuery(new URL(request.url), 'design');
      if (view instanceof Response) return view;
      const grant = await gateGrant(ctx, id);
      if (!grant) return notFound();
      const d = await startedDesign(ctx, id);
      if (!d) return missingDesign(ctx, id);
      // Redacted for every non-owner (redact-design.ts); a tab-scoped visitor
      // (docs/specs/013-workspace/tab-scoped-share-links.md) sees the other tabs locked.
      const reader = redactDesignForReader(d, ctx.resolveOwner());
      const liveDoc = redactDesignForScope(reader, grant.tabScope);
      // The overview view (docs/specs/024-agents/design-views.md), after the same gate and scope.
      if (view) return answerOverview(ctx, view, liveDoc, grant.tabScope);
      return json({ design: liveDoc });
    }
    if (request.method === 'PUT') {
      // Body: { name?, tabIds?, tabs? }: name renames the design here (the index's title is the editor's own call,
      // or the worker's for an API client); `tabs` (preferred, docs/specs/006-design/tab-folders.md) reorders
      // and sets each tab's folder; `tabIds` is the legacy folder-less shape. All optional.
      const read = await readBody(ctx);
      if (read instanceof Response) return read;
      const body = read as {
        name?: string;
        tabIds?: unknown;
        tabs?: unknown;
        // Slide deck (docs/specs/012-collaboration/presentation-mode.md): serialised StoredPresentation, or null to
        // clear. Absent leaves the stored deck alone.
        presentation?: string | null;
      };
      const owner = requireOwner(ctx);
      if (owner instanceof Response) return owner;
      if (!(await gateEdit(ctx, id))) return (await gateGrant(ctx, id)) ? forbidden() : notFound();
      const existing = await startedDesign(ctx, id);
      if (!existing) return missingDesign(ctx, id);
      const order = Array.isArray(body.tabs)
        ? readReorderEntries(body.tabs)
        : Array.isArray(body.tabIds)
          ? readReorderEntries(body.tabIds)
          : undefined;
      if (order === null) return badRequest('invalid tabs');
      // A rename meets the name cap (docs/specs/006-design/name-length.md); a
      // name echoed back unchanged (a reorder) is kept even if it predates it.
      const name =
        typeof body.name === 'string'
          ? capStoredName(body.name, existing.name, 'design')
          : existing.name;
      if (!name) return badRequest('missing name');
      await renameDesign(env, id, name, Date.now());
      // The slide deck, only when the caller sent the field: `undefined` means "not my business", which is what a
      // rename sends, so a rename can never wipe it.
      if (body.presentation !== undefined) {
        if (typeof body.presentation === 'string' && body.presentation.length > MAX_DECK_LEN) {
          return badRequest('presentation too large');
        }
        await setDesignPresentation(env, id, body.presentation, Date.now());
      }
      if (order) await reorderTabs(env, id, order);
      const liveDoc = await getDesign(env, id);
      // An agent's rename reaches the open editors (docs/specs/024-agents/agent-changesets.md "Whole-tab saves and tab
      // renames"); an editor sends its own rename to the room itself.
      if (ctx.token && liveDoc && name !== existing.name)
        ctx.waitUntil?.(relayDesignRename(env, id, liveDoc.name, liveDoc.tabs));
      return json({ design: liveDoc ? redactDesignForReader(liveDoc, owner) : liveDoc });
    }
  }

  // /api/designs/<id>/shared-tabs — what a delete leaves behind in other
  // designs (docs/specs/006-design/tab-design-many-to-many.md).
  {
    const sharedTabsResp = await handleDesignSharedTabs(ctx);
    if (sharedTabsResp) return sharedTabsResp;
  }

  const subResp = await handleDesignSubresources(ctx);
  if (subResp) return subResp;

  return notFound();
}
