// /api/documents: a canvas's content and what it knows of itself (name, owner, provenance), its tabs, comments and
// slide deck, and the realtime room. Where a canvas is filed, who may open it, its sharing and its Trash are the
// index's (liveworkspace/docs/specs/004-index/one-explorer.md); the doors an API client still calls for those are answered from it
// (document-index-routes.ts).

import type { Tab } from '@livediagram/document';
import { isValidTab, migrateIncomingTab } from '@livediagram/document';
import {
  createItemGrant,
  itemSourceOf,
  itemTabsOf,
  itemTabsRequest,
  itemTabsResponse,
  ITEM_GRANT_HEADER,
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
  INTENT_INVALID,
  MARK_USED_INVALID,
  indexIntentOf,
  readCreationIntent,
  readMarkUsed,
} from '@livediagram/api-schema';
import { getDocument, readReorderEntries, reorderTabs, seedTabs } from '../db';
import {
  badRequest,
  CORS_HEADERS,
  documentTrashed,
  forbidden,
  json,
  notFound,
  payloadTooLarge,
} from '../responses';
import { documentDates, isDocumentSource } from '@livediagram/api-schema';
import {
  redactDocumentForCommunity,
  redactDocumentForReader,
  redactDocumentForScope,
} from '../redact-document';
import { answerOverview, parseViewQuery } from './document-views-route';
import { notifyMilestone } from '../email/notifications';
import { reportOwnerActivity } from '../liveworkspace/activity';
import { handleDocumentSharedTabs } from './document-shared-tabs-route';
import { handleCommunityOwnerRoutes } from './community-owner-routes';
import { relayDocumentRename } from '../room-client';
import { handleDocumentRoomRoutes } from './document-room-routes';
import { handleDocumentSubresources } from './document-subresource-routes';
import { compileSeededTabs, seedIntentOf } from './document-seed';
import type { DocumentDTO } from '../types';
import {
  initDocument,
  readDocumentMeta,
  readDocumentTabs,
  renameDocument,
  setDocumentPresentation,
} from '../document-room/document-content';
import { identityOf } from '../document-room/document-route';
import { documentRoom } from '../document-client';
import { indexFor, indexService, linkCodeOf } from '../index-service';
import { handleDocumentIndexRoutes, handleDocumentList } from './document-index-routes';
import { resolveDocumentGrant } from './document-grant';
import {
  COMMUNITY_CONTENT,
  gateEdit,
  gateGrant,
  grantCallerOf,
  missingDocument,
  requireOwner,
  type DocumentRouteContext,
  type RouteContext,
  readBody,
} from './context';

function isDocumentContext(ctx: RouteContext): ctx is DocumentRouteContext {
  return 'DOCUMENT_DB' in ctx.env;
}

// The longest document id the worker names a Durable Object by. Ids are UUIDs; this only stops a hostile create from
// naming objects with megabyte ids.
const MAX_DOCUMENT_ID = 200;

function intentRejected(): Response {
  return json({ error: INTENT_INVALID }, { status: 400 });
}

// /api/documents in the worker. The list and the index's doors (delete, copy, share) are answered from the index;
// the realtime room's ticket and upgrade here; everything else about one canvas, a create included, runs inside that
// canvas's Durable Object (docs/specs/015-api/api.md "Storage"), with the caller's identity and the index's grant as
// settled here.
export async function handleDocuments(ctx: RouteContext): Promise<Response> {
  const { request, segments } = ctx;
  if (segments[1] !== 'documents') return notFound();
  if (isDocumentContext(ctx)) return handleDocumentRequest(ctx);
  if (segments.length === 2 && request.method === 'GET') return handleDocumentList(ctx);
  const indexResp = await handleDocumentIndexRoutes(ctx);
  if (indexResp) return indexResp;
  const roomResp = await handleDocumentRoomRoutes(ctx);
  if (roomResp) return roomResp;
  return forwardToDocument(ctx);
}

// Hand a request about one canvas to its Durable Object, with the index's grant on it. A create names its canvas in
// the body, read here from a copy so the request goes on whole.
async function forwardToDocument(ctx: RouteContext): Promise<Response> {
  const { request, segments } = ctx;
  let documentId = segments[2] ?? '';
  let grant: Awaited<ReturnType<typeof resolveDocumentGrant>>;
  let renamedTo: string | null = null;
  // Where the index filed an API client's create, for its answer.
  let filed: { folderId: string | null; teamId: string | null } | null = null;
  // An API client's create that is a use of the canvas (docs/specs/015-api/api.md "Marking a document used").
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
    documentId = named;
    if (documentId.length > MAX_DOCUMENT_ID) return notFound();
    if (request.headers.get(ITEM_GRANT_HEADER)) {
      grant = await resolveDocumentGrant(ctx, documentId);
    } else {
      const create = createRequestOf(read);
      if (create instanceof Response) return create;
      const made = await createItemGrant(
        indexService,
        ctx.env,
        request,
        grantCallerOf(ctx),
        documentId,
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
    if (!documentId || documentId.length > MAX_DOCUMENT_ID) return notFound();
    grant = await resolveDocumentGrant(ctx, documentId);
    // An API client's rename is the index's title too; the editor renames there itself.
    if (segments.length === 3 && request.method === 'PUT' && (ctx.token || ctx.workbench)) {
      const body = await readBody({ ...ctx, request: request.clone() });
      if (!(body instanceof Response) && typeof body.name === 'string') renamedTo = body.name;
    }
  }
  if (grant instanceof Response) return grant;
  const res = await documentRoom(ctx.env, documentId).route(request, identityOf({ ...ctx, grant }));
  // Making it is a use for the caller, recorded at the index beside the create as the editor records its own; never
  // waited on. The room's 400 for a markUsed that is not a boolean made nothing, so it records nothing.
  if (marksUse && res.status === 201) {
    const client = indexFor(ctx.env, grantCallerOf(ctx));
    if (client)
      ctx.waitUntil?.(
        client.recordOpen(documentId, null).catch((err: unknown) => {
          console.warn('[documents] use not recorded', { documentId, error: String(err) });
        }),
      );
  }
  if (renamedTo !== null && res.ok) {
    const title = capStoredName(renamedTo, null, 'document');
    const client = indexFor(ctx.env, grantCallerOf(ctx));
    if (title && client)
      ctx.waitUntil?.(
        client.updateItem(documentId, { title }).catch((err: unknown) => {
          console.warn('[index] rename failed', { documentId, error: String(err) });
        }),
      );
  }
  // An API client's create answers where the index filed it (the MCP names the folder it landed in).
  if (filed && res.status === 201) {
    const answer = (await res.json()) as { document?: DocumentDTO | null };
    if (answer.document) answer.document = { ...answer.document, ...filed };
    return json(answer, { status: 201 });
  }
  return res;
}

// What an API client's create (POST /api/documents without a grant) asks the index for: the canvas's title, where it
// is filed (a folder or team named, else the index's default for its intent), its intent and provenance. A malformed
// intent refuses the create before the index makes anything.
function createRequestOf(body: Record<string, unknown>): ItemCreateRequest | Response {
  const intent = body.intent === undefined ? null : readCreationIntent(body.intent);
  if (intent && !intent.ok) return intentRejected();
  const title =
    capStoredName(typeof body.name === 'string' ? body.name : '', null, 'document') || undefined;
  return {
    ...(title ? { title } : {}),
    // Left out, the index files it by its intent's default folder; a folder or team named is where it goes.
    ...(typeof body.folderId === 'string' || body.folderId === null
      ? { folderId: body.folderId }
      : {}),
    ...(typeof body.teamId === 'string' ? { teamId: body.teamId } : {}),
    intent: intent ? indexIntentOf(intent.intent) : seedIntentOf(body.tabs),
    source: itemSourceOf(body.source),
  };
}

// A canvas the index knows (the caller holds its grant) that nothing has started yet (an item made in the Explorer
// and opened before its content was written) starts on its first read, as its grant's owner's. Null when there is
// no grant to start it with, or the grant is a link visitor's on a canvas never started.
async function startedDocument(ctx: DocumentRouteContext, id: string): Promise<DocumentDTO | null> {
  const found = await getDocument(ctx.env, id);
  if (found) return found;
  const grant = ctx.grant;
  if (!grant || grant.item !== id) return null;
  const ownerId = grant.owner ?? (linkCodeOf(grant.sub) ? null : grant.sub);
  if (!ownerId) return null;
  const now = Date.now();
  await initDocument(ctx.env, id, {
    name: 'Untitled',
    ownerId,
    teamId: grant.team,
    source: null,
    savedAt: now,
    createdAt: now,
  });
  console.info('[documents] started on open', { documentId: id });
  if (ownerId === grant.sub) ctx.waitUntil?.(notifyMilestone(ctx.env, ownerId));
  return getDocument(ctx.env, id);
}

// /api/documents/<id>/tabs: the canvas's tabs alone, `{ tabs: [{ id, name, kind }] }` (@liveworkspace/index-app
// tabs.ts), for the Share dialog's tab picker on liveworkspace.app, which would otherwise read the whole canvas.
// Gated like a read: a miss is 404; a tab's share link sees its own tab alone.
async function documentTabs(ctx: DocumentRouteContext, id: string): Promise<Response> {
  const grant = await gateGrant(ctx, id);
  if (!grant) return notFound();
  const rows = await readDocumentTabs(ctx.env, id);
  if (rows.length === 0 && !(await readDocumentMeta(ctx.env, id))) return notFound();
  return itemTabsResponse(itemTabsOf(rows, grant.tabScope), CORS_HEADERS);
}

// Everything about one canvas, inside its Durable Object (document-room/document-route.ts).
export async function handleDocumentRequest(ctx: DocumentRouteContext): Promise<Response> {
  const { request, env, segments } = ctx;
  if (segments[1] !== 'documents') return notFound();
  // A canvas in the Trash answers its owner and team 410 `document_trashed`, as the index's grant says
  // (docs/specs/013-workspace/trash.md). Its preview still shows in the Trash's rows: that is liveworkspace's
  // (liveworkspace/docs/specs/006-media/previews.md), behind the index, which lets its owner and team see it.
  if (ctx.grant?.trashed && segments.length >= 3) return documentTrashed();
  if (segments.length === 2) {
    if (request.method === 'POST') {
      const read = await readBody(ctx);
      if (read instanceof Response) return read;
      const body = read as Omit<Partial<DocumentDTO>, 'tabs'> & {
        tabs?: Tab[];
        intent?: unknown;
        markUsed?: unknown;
      };
      const owner = requireOwner(ctx);
      if (owner instanceof Response) return owner;
      if (!body.id || typeof body.name !== 'string') {
        return badRequest('missing id/name');
      }
      // The canvas's own dates (docs/specs/015-api/api.md "Document dates"), refused whole when invalid, before
      // anything is written.
      const dates = documentDates(body, Date.now());
      if (!dates.ok) return badRequest('invalid document dates');
      // Seeded tabs given as a graph, Mermaid or a template are compiled first (docs/specs/015-api/api.md).
      if (Array.isArray(body.tabs)) {
        const seed = compileSeededTabs(body.tabs, body.id);
        if ('refusal' in seed) return json(seed.refusal.body, { status: seed.refusal.status });
        body.tabs = seed.tabs as Tab[];
      }
      // The creation intent (docs/specs/013-workspace/default-folders.md) is the index's, which filed the canvas
      // by it; a malformed one still refuses the create.
      if (body.intent !== undefined && !readCreationIntent(body.intent).ok) {
        console.warn('documents: rejected reason=intent_invalid');
        return intentRejected();
      }
      // Whether making it is a use (docs/specs/015-api/api.md "Marking a document used"): absent counts; anything
      // but a boolean refuses the create before anything is written.
      const making = readMarkUsed(body.markUsed);
      if (!making.ok) {
        console.warn('documents: rejected reason=mark_used_invalid');
        return badRequest(MARK_USED_INVALID);
      }
      // Validate any seeded tabs up front (structure + per-tab byte cap) so a create can't smuggle a malformed or
      // oversized tab past the tab gate.
      if (Array.isArray(body.tabs)) {
        // Former stored shapes (a Google Drive copy, an offline sync, an API-token script) are migrated before
        // validation, as every tab read migrates them (docs/specs/015-api/api.md).
        body.tabs = body.tabs.map((tab) => migrateIncomingTab(tab) as Tab);
        for (const tab of body.tabs) {
          if (!isValidTab(tab)) return badRequest('invalid tab');
          // The tab size cap (docs/specs/015-api/api.md "Tab size"), measured as stored, before anything is
          // written, so a create never leaves a canvas without its tabs.
          const bytes = tabDataBytes(tab);
          if (bytes > MAX_TAB_BYTES) {
            logTabRefused('create', tab.id, bytes);
            return payloadTooLarge();
          }
        }
      }
      // A create is the index's item made a moment ago (by the editor, or by the worker for an API client): its
      // grant must be for this canvas, at edit. A canvas already started is a re-commit of its owner's own id,
      // never a way to take someone else's.
      if (!(await gateEdit(ctx, body.id))) return forbidden();
      const clash = await getDocument(env, body.id);
      if (clash && clash.ownerId !== owner) return forbidden();
      // The name cap (docs/specs/006-document/name-length.md): shortened here, whoever the caller. A re-commit of
      // the caller's own id compares against what it already stores, so an unchanged pre-cap name is kept.
      const name = capStoredName(body.name, clash?.name ?? null, 'document');
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
      const presentation = typeof body.presentation === 'string' ? body.presentation : null;
      // Only a genuine create takes the body's dates: a re-commit keeps the stored created date and is modified now.
      const savedAt = clash ? Date.now() : dates.savedAt;
      // The canvas's own row: what it knows of itself, its dates and, usually none, the slide deck an Offline Mode
      // sync built offline (docs/specs/006-document/offline-mode.md); a re-commit keeps its owner, team,
      // provenance and deck.
      await initDocument(env, body.id, {
        name,
        ownerId: owner,
        teamId: ctx.grant?.team ?? null,
        // Provenance (docs/specs/013-workspace/folders.md): only the closed set of generated sources is
        // accepted; anything else (or absent) is a user-made canvas.
        source: isDocumentSource(body.source) ? body.source : null,
        savedAt,
        createdAt: dates.createdAt,
        presentation: clash ? null : presentation,
      });
      // Tab ids belong to the canvas (each lives in its own canvas's store), so seeded tabs are written under the
      // ids they carry: the editor's welcome flow ships the templated tab inline so the first per-tab fetch
      // already has data.
      if (incomingTabs) {
        try {
          await seedTabs(env, body.id, incomingTabs, savedAt);
        } catch (error) {
          if (error instanceof TabTooLargeError) return payloadTooLarge();
          throw error;
        }
      }
      const liveDoc = await getDocument(env, body.id);
      if (!clash)
        console.info('[documents] created', { documentId: body.id, marked: making.markUsed });
      // A genuine create may be the owner's tenth canvas (docs/specs/014-identity/transactional-email.md #6).
      if (!clash) ctx.waitUntil?.(notifyMilestone(env, owner));
      // liveworkspace's onboarding series: they made something (liveworkspace/activity.ts).
      if (!clash) ctx.waitUntil?.(reportOwnerActivity(env, owner, Date.now()));
      return json({ document: liveDoc }, { status: 201 });
    }
  }

  // /api/documents/<id>/tabs
  const tabsOf = itemTabsRequest(request.method, segments, 'documents');
  if (tabsOf) return documentTabs(ctx, tabsOf);

  // /api/documents/<id>
  if (segments.length === 3) {
    const id = segments[2]!;
    if (request.method === 'GET') {
      // Read access is the grant's (docs/specs/013-workspace/share-roles.md): a miss is 404, never 403, so a
      // guessed id can't probe existence.
      const view = parseViewQuery(new URL(request.url), 'document');
      if (view instanceof Response) return view;
      const grant = await gateGrant(ctx, id, null, null, COMMUNITY_CONTENT);
      if (!grant) return notFound();
      const d = await startedDocument(ctx, id);
      if (!d) return missingDocument(ctx, id);
      // Redacted for every non-owner (redact-document.ts); a Community visitor sees the post's redactions; a
      // tab-scoped visitor (docs/specs/013-workspace/tab-scoped-share-links.md) sees the other tabs locked.
      const reader = redactDocumentForReader(d, ctx.resolveOwner());
      const liveDoc = redactDocumentForScope(
        grant.community ? redactDocumentForCommunity(reader) : reader,
        grant.tabScope,
      );
      // The overview view (docs/specs/024-agents/document-views.md), after the same gate and scope.
      if (view) return answerOverview(ctx, view, liveDoc, grant.tabScope, grant.community);
      return json({ document: liveDoc });
    }
    if (request.method === 'PUT') {
      // Body: { name?, tabIds?, tabs?, presentation? }: name renames the canvas here (the index's title is the
      // editor's own call, or the worker's for an API client); `tabs` (preferred,
      // docs/specs/006-document/tab-folders.md) reorders and sets each tab's folder; `tabIds` is the legacy
      // folder-less shape. All optional.
      const read = await readBody(ctx);
      if (read instanceof Response) return read;
      const body = read as {
        name?: string;
        tabIds?: unknown;
        tabs?: unknown;
        // Slide deck (docs/specs/012-collaboration/presentation-mode.md): serialised StoredPresentation, or null to
        // clear. Absent leaves the stored deck alone, so an ordinary rename can never wipe it.
        presentation?: string | null;
      };
      const owner = requireOwner(ctx);
      if (owner instanceof Response) return owner;
      if (!(await gateEdit(ctx, id))) return (await gateGrant(ctx, id)) ? forbidden() : notFound();
      const existing = await startedDocument(ctx, id);
      if (!existing) return missingDocument(ctx, id);
      // The tab order, read whole before anything is written: one malformed entry refuses the request, rename and
      // all.
      const order = Array.isArray(body.tabs)
        ? readReorderEntries(body.tabs)
        : Array.isArray(body.tabIds)
          ? readReorderEntries(body.tabIds)
          : undefined;
      if (order === null) return badRequest('invalid tabs');
      // A rename meets the name cap (docs/specs/006-document/name-length.md); a name echoed back unchanged (a
      // reorder) is kept even if it predates it.
      const name =
        typeof body.name === 'string'
          ? capStoredName(body.name, existing.name, 'document')
          : existing.name;
      if (!name) return badRequest('missing name');
      if (
        body.presentation !== undefined &&
        body.presentation !== null &&
        (typeof body.presentation !== 'string' || body.presentation.length > MAX_DECK_LEN)
      ) {
        return badRequest('presentation too large');
      }
      await renameDocument(env, id, name, Date.now());
      // Only when the caller actually sent the field: `undefined` means "not my business", which is what every
      // existing client sends.
      if (body.presentation !== undefined)
        await setDocumentPresentation(env, id, body.presentation);
      if (order) await reorderTabs(env, id, order);
      const liveDoc = await getDocument(env, id);
      // An agent's rename reaches the open editors (docs/specs/024-agents/agent-changesets.md "Whole-tab saves and
      // tab renames"); an editor sends its own rename to the room itself.
      if (ctx.token && liveDoc && name !== existing.name)
        ctx.waitUntil?.(relayDocumentRename(env, id, liveDoc.name, liveDoc.tabs));
      // Redacted like the GET: an edit-role share visitor passes gateEdit (see redact-document.ts).
      return json({ document: liveDoc ? redactDocumentForReader(liveDoc, owner) : liveDoc });
    }
  }

  // /api/documents/<id>/community: publish to, edit in or remove from Community
  // (docs/specs/025-community/community.md).
  {
    const communityResp = await handleCommunityOwnerRoutes(ctx);
    if (communityResp) return communityResp;
  }

  // /api/documents/<id>/shared-tabs: what a delete leaves behind in other canvases
  // (docs/specs/006-document/tab-document-many-to-many.md).
  {
    const sharedTabsResp = await handleDocumentSharedTabs(ctx);
    if (sharedTabsResp) return sharedTabsResp;
  }

  const subResp = await handleDocumentSubresources(ctx);
  if (subResp) return subResp;

  return notFound();
}
