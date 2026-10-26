// /api/documents: a document's content and what it knows of itself (name, owner, provenance), its tabs, pages,
// comments and slide deck, and the realtime room. Where a document is filed, who may open it, its sharing and its
// Trash are the index's (liveworkspace/docs/specs/004-index/one-explorer.md); the doors an API client still calls for those are
// answered from it (document-index-routes.ts).

import type { Tab } from '@livedocuments/document';
import { isValidTab, migrateIncomingTab } from '@livedocuments/document';
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
  indexIntentOf,
  INTENT_INVALID,
  MARK_USED_INVALID,
  readCreationIntent,
  readMarkUsed,
  type CreationIntent,
} from '@livedocuments/api-schema';
import { getDocument, readReorderEntries, reorderTabs, seedTabs } from '../db';
import { badRequest, CORS_HEADERS, forbidden, json, notFound, payloadTooLarge } from '../responses';
import { documentDates, isDocumentSource } from '@livedocuments/api-schema';
import { redactDocumentForReader, redactDocumentForScope } from '../redact-document';
import { answerOverview, parseViewQuery } from './document-views-route';
import { handleDocumentSharedTabs } from './document-shared-tabs-route';
import { relayDocumentRename } from '../room-client';
import { handleDocumentRoomRoutes } from './document-room-routes';
import { handleDocumentSubresources } from './document-subresource-routes';
import { compileSeededTabs, seedIntentOf } from './document-seed';
import type { DocumentDTO } from '../types';
import { notifyMilestone } from '../email/notifications';
import { reportOwnerActivity } from '../person/account-app';
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
// the realtime room's ticket and upgrade here; everything else about one document, a create included, runs inside that
// document's Durable Object (docs/specs/015-api/api.md "Storage"), with the caller's identity and the index's grant as
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

// Hand a request about one document to its Durable Object, with the index's grant on it. A create names its document in
// the body, read here from a copy so the request goes on whole.
async function forwardToDocument(ctx: RouteContext): Promise<Response> {
  const { request, segments } = ctx;
  let documentId = segments[2] ?? '';
  let grant: Awaited<ReturnType<typeof resolveDocumentGrant>>;
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
    documentId = named;
    if (documentId.length > MAX_DOCUMENT_ID) return notFound();
    if (request.headers.get(INDEX_GRANT_HEADER)) {
      grant = await resolveDocumentGrant(ctx, documentId);
    } else {
      // An API client's create (no grant): the index makes the item under the id the client minted, and the
      // document opens with the grant that comes back. The id already taken is the same client re-committing its
      // own document: the grant it holds decides (@liveworkspace/index-app createItemGrant).
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
      if (made?.item) filed = { folderId: made.item.folderId, teamId: made.item.teamId };
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

// What an API client's create (POST /api/documents without a grant) asks the index for: the document's title,
// where it is filed (a folder or team named, else the index's default folder for its intent), its intent and
// provenance. The intent is the one the document records: the body's, else its seeded tabs'. A malformed intent
// refuses the create before the index makes anything.
function createRequestOf(body: Record<string, unknown>): ItemCreateRequest | Response {
  const given = body.intent === undefined ? null : readCreationIntent(body.intent);
  if (given && !given.ok) return intentRejected();
  const intent = given ? given.intent : seedIntentOf(body.tabs);
  const title =
    capStoredName(typeof body.name === 'string' ? body.name : '', null, 'document') || undefined;
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

// A document the index knows (the caller holds its grant) that nothing has started yet (a copy, or an item made in
// the Explorer and opened before its content was written) starts on its first read, as its grant's person's.
// Null when there is no grant to start it with, or the grant is a link visitor's.
async function startedDocument(ctx: DocumentRouteContext, id: string): Promise<DocumentDTO | null> {
  const found = await getDocument(ctx.env, id);
  if (found) return found;
  const grant = ctx.grant;
  if (!grant || grant.item !== id || linkCodeOf(grant.sub)) return null;
  const now = Date.now();
  await initDocument(ctx.env, id, {
    name: 'Untitled',
    ownerId: grant.sub,
    teamId: grant.team,
    source: null,
    savedAt: now,
    createdAt: now,
  });
  console.info('[documents] started on open', { documentId: id });
  ctx.waitUntil?.(notifyMilestone(ctx.env, grant.sub));
  return getDocument(ctx.env, id);
}

// /api/documents/<id>/tabs: the document's tabs alone, `{ tabs: [{ id, name, kind: null }] }` (@liveworkspace/index-app
// tabs.ts), for the Share dialog's tab picker on liveworkspace.app, which would otherwise read the whole document.
// Gated like a read: a miss is 404; a tab's share link sees its own tab alone.
async function documentTabs(ctx: DocumentRouteContext, id: string): Promise<Response> {
  const grant = await gateGrant(ctx, id);
  if (!grant) return notFound();
  const rows = await readDocumentTabs(ctx.env, id);
  if (rows.length === 0 && !(await readDocumentMeta(ctx.env, id))) return notFound();
  return itemTabsResponse(itemTabsOf(rows, grant.tabScope), CORS_HEADERS);
}

// Everything about one document, inside its Durable Object (document-room/document-route.ts).
export async function handleDocumentRequest(ctx: DocumentRouteContext): Promise<Response> {
  const { request, env, segments } = ctx;
  if (segments[1] !== 'documents') return notFound();
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
      // The document's own dates (docs/specs/015-api/api.md "Document dates"), refused whole when
      // invalid, before anything is written.
      const dates = documentDates(body, Date.now());
      if (!dates.ok) return badRequest('invalid document dates');
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
        console.warn('documents: rejected reason=intent_invalid');
        return intentRejected();
      }
      // Whether making it is a use (docs/specs/015-api/api.md "Marking a document used"): absent
      // counts; anything but a boolean refuses the create before anything is written.
      const making = readMarkUsed(body.markUsed);
      if (!making.ok) {
        console.warn('documents: rejected reason=mark_used_invalid');
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
          // The tab size cap (docs/specs/015-api/api.md "Tab size"), measured as stored,
          // before anything is written, so a create never leaves a document without its tabs.
          const bytes = tabDataBytes(tab);
          if (bytes > MAX_TAB_BYTES) {
            logTabRefused('create', tab.id, bytes);
            return payloadTooLarge();
          }
        }
      }
      // A create is the index's item made a moment ago (or, for an API client, by the worker on its behalf): its
      // grant must be for this document, at edit. A document already started is a re-commit of its owner's own id, never
      // a way to take someone else's.
      if (!(await gateEdit(ctx, body.id))) return forbidden();
      const started = await getDocument(env, body.id);
      const clash = started;
      if (clash && clash.ownerId !== owner) return forbidden();
      // The name cap (docs/specs/006-document/name-length.md): shortened here,
      // whoever the caller. A re-commit of the caller's own id compares against
      // what it already stores, so an unchanged pre-cap name is kept.
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
      // Tabs are the document's own (each document has its own store), so a seeded tab id can never name another
      // document's tab: a synced-back offline copy keeps its ids.
      const seeded = incomingTabs;
      const presentation = typeof body.presentation === 'string' ? body.presentation : null;
      // Only a genuine create takes the body's dates: a re-commit keeps the stored created date
      // (the upsert never rewrites it) and is modified now.
      const savedAt = clash ? Date.now() : dates.savedAt;
      // The document's own row: what it knows of itself, its dates and, usually none, the slide deck an Offline Mode
      // sync built offline (docs/specs/006-document/offline-mode.md); a re-commit keeps its owner, team, provenance
      // and deck.
      await initDocument(env, body.id, {
        name,
        ownerId: owner,
        teamId: ctx.grant?.team ?? null,
        // Provenance (docs/specs/013-workspace/folders.md): only the closed set of generated sources
        // is accepted; anything else (or absent) is a user-made document.
        source: isDocumentSource(body.source) ? body.source : null,
        savedAt,
        createdAt: dates.createdAt,
        presentation: clash ? null : presentation,
      });
      // Seed tabs if the caller provided them. The editor app's
      // welcome flow uses this when it commits a fresh document
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
      const liveDoc = await getDocument(env, body.id);
      if (!clash)
        console.info('[documents] created', { documentId: body.id, marked: making.markUsed });
      // Made but not used: one of a batch, say. Its first open or edit is what brings it to Jump Back In.
      if (!making.markUsed) ctx.notAUse?.();
      // A genuine create may be the owner's tenth document (docs/specs/014-identity/transactional-email.md #6).
      if (!clash) ctx.waitUntil?.(notifyMilestone(env, owner));
      // Making a document is activity for liveworkspace's onboarding series (it has made something), even before
      // any content reaches its summary push. A guest's is not sent.
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
      const grant = await gateGrant(ctx, id);
      if (!grant) return notFound();
      const d = await startedDocument(ctx, id);
      if (!d) return missingDocument(ctx, id);
      // Redacted for every non-owner (redact-document.ts); a tab-scoped visitor
      // (docs/specs/013-workspace/tab-scoped-share-links.md) sees the other tabs locked.
      const reader = redactDocumentForReader(d, ctx.resolveOwner());
      const liveDoc = redactDocumentForScope(reader, grant.tabScope);
      // The overview view (docs/specs/024-agents/document-views.md), after the same gate and scope.
      if (view) return answerOverview(ctx, view, liveDoc, grant.tabScope);
      return json({ document: liveDoc });
    }
    if (request.method === 'PUT') {
      // Body: { name?, tabIds?, tabs?, presentation? }: name renames the document here (the index's title is the editor's own call,
      // or the worker's for an API client); `tabs` (preferred, docs/specs/006-document/tab-folders.md) reorders
      // and sets each tab's folder; `tabIds` is the legacy folder-less shape. All optional.
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
      const order = Array.isArray(body.tabs)
        ? readReorderEntries(body.tabs)
        : Array.isArray(body.tabIds)
          ? readReorderEntries(body.tabIds)
          : undefined;
      if (order === null) return badRequest('invalid tabs');
      // A rename meets the name cap (docs/specs/006-document/name-length.md); a
      // name echoed back unchanged (a reorder) is kept even if it predates it.
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
      // An agent's rename reaches the open editors (docs/specs/024-agents/agent-changesets.md "Whole-tab saves and tab
      // renames"); an editor sends its own rename to the room itself.
      if (ctx.token && liveDoc && name !== existing.name)
        ctx.waitUntil?.(relayDocumentRename(env, id, liveDoc.name, liveDoc.tabs));
      return json({ document: liveDoc ? redactDocumentForReader(liveDoc, owner) : liveDoc });
    }
  }

  // /api/documents/<id>/shared-tabs — what a delete leaves behind in other
  // documents (docs/specs/006-document/tab-document-many-to-many.md).
  {
    const sharedTabsResp = await handleDocumentSharedTabs(ctx);
    if (sharedTabsResp) return sharedTabsResp;
  }

  const subResp = await handleDocumentSubresources(ctx);
  if (subResp) return subResp;

  return notFound();
}
