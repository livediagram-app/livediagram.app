// /api/documents — document metadata, per-tab content, copy, folder
// assignment, tab linking, comments, share links, the realtime WS
// upgrade. The largest resource: every sub-path
// under a document id lives here.

import type { Tab } from '@livediagram/document';
import { isValidTab, migrateIncomingTab } from '@livediagram/document';
import { capStoredName } from '../names';
import {
  MAX_DECK_LEN,
  MAX_TAB_BYTES,
  TabTooLargeError,
  logTabRefused,
  tabDataBytes,
} from '../limits';
import {
  DOCUMENT_CONVERSION_HEADER,
  INTENT_INVALID,
  MARK_USED_INVALID,
  readCreationIntent,
  readDocumentConversion,
  readMarkUsed,
  TEAM_RECENT_INCLUDE,
  TEAM_RECENT_LIMIT,
  type CreationIntent,
} from '@livediagram/api-schema';
import {} from '../comments';
import {
  copyDocument,
  getDocument,
  getDocumentThumbMeta,
  getTrashedDocumentMeta,
  countDocumentsByOwner,
  listDocumentsByOwner,
  listRecentTeamDocuments,
  listSharedWith,
  readReorderEntries,
  reorderTabs,
  seedTabs,
  upsertDocumentMeta,
} from '../db';
import { getParticipant } from '../liveworkspace/profiles';
import {
  badRequest,
  documentTrashed,
  forbidden,
  json,
  notFound,
  payloadTooLarge,
  svgImage,
} from '../responses';
import { documentDates, isDocumentSource } from '@livediagram/api-schema';
import { clientIp } from '../client-ip';
import { documentImageSvg } from '../document-image';
import { countCommunityCopy } from '../community-service';
import { getCommunityLinkByShareCode } from '../db/community-links';
import {
  redactDocumentForCommunity,
  redactDocumentForReader,
  redactDocumentForScope,
} from '../redact-document';
import { answerOverview, parseViewQuery } from './document-views-route';
import { emailEnabled } from '../email/client';
import { notifyMilestone } from '../email/notifications';
import { reportOwnerActivity } from '../liveworkspace/activity';
import {
  recordDocumentCreated,
  recordDocumentDuplicated,
  recordDocumentSynced,
  recordVisitorCopied,
} from '../timeline';
import { handleDocumentDelete } from './document-delete-route';
import { handleDocumentPlacement } from './document-placement-route';
import { handleDocumentSharedTabs } from './document-shared-tabs-route';
import { handleCommunityOwnerRoutes } from './community-owner-routes';
import { relayDocumentRename } from '../room-client';
import { handleDocumentRoomRoutes } from './document-room-routes';
import { handleDocumentSubresources } from './document-subresource-routes';
import { compileSeededTabs } from './document-seed';
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
import type { DocumentDTO } from '../types';
import { initDocument, setDocumentPresentation } from '../document-room/document-content';
import { identityOf } from '../document-room/document-route';
import { documentRoom } from '../document-client';
import {
  gateEdit,
  COMMUNITY_CONTENT,
  gateGrant,
  missingDocument,
  requireOwner,
  shareCodeOf,
  sharePasswordOf,
  type DocumentRouteContext,
  type RouteContext,
  readBody,
} from './context';
import { sharePasswordOk } from '../auth/share-access';

function isDocumentContext(ctx: RouteContext): ctx is DocumentRouteContext {
  return 'DOCUMENT_DB' in ctx.env;
}

// The longest document id the worker names a Durable Object by. Ids are UUIDs; this only stops a hostile create from
// naming objects with megabyte ids.
const MAX_DOCUMENT_ID = 200;

// /api/documents in the worker. What reads no content is answered here: the document list (D1), a document's
// thumbnail (a fresh cache from R2; a stale one is drawn by the document) and the realtime room's ticket and upgrade.
// Everything else about one document, a create included, runs inside that document's Durable Object
// (docs/specs/015-api/api.md "Storage"), with the caller's identity as resolved here.
export async function handleDocuments(ctx: RouteContext): Promise<Response> {
  const { request, segments } = ctx;
  if (segments[1] !== 'documents') return notFound();
  if (segments.length === 2 && request.method === 'GET') return listDocuments(ctx);
  if (segments.length === 4 && segments[3] === 'thumbnail') return documentThumbnail(ctx);
  // Realtime-room admission (docs/specs/015-api/api.md): the one-time WS ticket mint +
  // the Durable Object upgrade — see document-room-routes.ts.
  const roomResp = await handleDocumentRoomRoutes(ctx);
  if (roomResp) return roomResp;
  if (isDocumentContext(ctx)) return handleDocumentRequest(ctx);
  return forwardToDocument(ctx);
}

// Hand a request about one document to its Durable Object. A create names its document in the body, read here from a copy
// so the request goes on whole; the answers for a body that names none are the create's own.
async function forwardToDocument(ctx: RouteContext): Promise<Response> {
  const { request, segments } = ctx;
  let documentId = segments[2] ?? '';
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
  }
  if (!documentId || documentId.length > MAX_DOCUMENT_ID) return notFound();
  return documentRoom(ctx.env, documentId).route(request, identityOf(ctx));
}

async function listDocuments(ctx: RouteContext): Promise<Response> {
  const { env } = ctx;
  const owner = requireOwner(ctx);
  if (owner instanceof Response) return owner;
  // `?include=team-recent` (docs/specs/019-marketing/returning-visitor.md): the newest documents of
  // the teams the caller has joined, for their recent diagrams. Membership is read from the
  // verified account only, never the guest header, which anyone can set to any id.
  if (ctx.url.searchParams.get('include') === TEAM_RECENT_INCLUDE) {
    const [liveDocs, teamRecent] = await Promise.all([
      listDocumentsByOwner(env, owner),
      ctx.verifiedUserId ? listRecentTeamDocuments(env, ctx.verifiedUserId, TEAM_RECENT_LIMIT) : [],
    ]);
    return json({ documents: liveDocs, teamRecent });
  }
  const liveDocs = await listDocumentsByOwner(env, owner);
  return json({ documents: liveDocs });
}

// /api/documents/<id>/thumbnail — cached SVG snapshot (docs/specs/006-document/document-snapshots.md). Read-
// gated exactly like GET /api/documents/<id>: the owner, a joined team
// member, or a valid share-code visitor. A native <img> can't send
// auth headers, so the editor app fetches this with headers and wraps
// the bytes in a blob URL; a miss (no document, no read access, no R2
// binding, empty document) is a 404 the row turns into its icon.
async function documentThumbnail(ctx: RouteContext): Promise<Response> {
  const { request, env, segments } = ctx;
  const id = segments[2]!;
  if (request.method !== 'GET') return notFound();
  // One query for the gate AND the cache-freshness check: this runs for
  // every preview in the Explorer grid, so its D1 round trips are the
  // floor on how fast a card can paint.
  const d = await getDocumentThumbMeta(env, id);
  if (!d) return notFound();
  const grant = await gateGrant(ctx, id, d.ownerId, d.teamId, COMMUNITY_CONTENT);
  if (!grant) return notFound();
  // A tab-scoped visitor (docs/specs/013-workspace/tab-scoped-share-links.md) gets their tab, never the
  // first-tab snapshot. A Community visitor's thumbnail is drawn from the redacted tab, never the owner's snapshot.
  const svg = await documentImageSvg(env, d, {
    tabId: grant.tabScope,
    community: grant.community === true,
  });
  // Nothing drawn (or no snapshot store). Past the gate, so this says
  // nothing about access, and the URL carries `?v=<savedAt>`: the answer
  // cannot change until the document does, so let the browser keep it
  // instead of re-asking on every Explorer visit.
  if (svg == null) {
    return json(
      { error: 'not_found' },
      { status: 404, headers: { 'Cache-Control': 'private, max-age=86400' } },
    );
  }
  // The client cache-busts via a `?v=<savedAt>` query param, so a
  // long private max-age is safe: a changed document changes the URL.
  return svgImage(svg, 'private, max-age=86400');
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
      // Placement (docs/specs/013-workspace/folders.md "Placement on create"): read up front so a
      // malformed one is refused before anything else is looked at.
      const requested = parsePlacement(body);
      if (!requested) {
        logPlacementRejected('placement_invalid', placementScope(body.teamId));
        return placementRejected('placement_invalid');
      }
      // Seeded tabs given as a graph, Mermaid or a template are compiled first (docs/specs/015-api/api.md);
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
        logPlacementRejected(INTENT_INVALID, placementScope(body.teamId));
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
        // Former stored shapes (a Google Drive copy, an offline sync, an API-token script) are
        // migrated before validation, as every tab read migrates them (docs/specs/015-api/api.md).
        body.tabs = body.tabs.map((tab) => migrateIncomingTab(tab) as Tab);
        for (const tab of body.tabs) {
          if (!isValidTab(tab)) return badRequest('invalid tab');
          // The cap D1's row sets (docs/specs/015-api/api.md "Tab size"), measured as stored,
          // before anything is written, so a create never leaves a document without its tabs.
          const bytes = tabDataBytes(tab);
          if (bytes > MAX_TAB_BYTES) {
            logTabRefused('create', tab.id, bytes);
            return payloadTooLarge();
          }
        }
      }
      // Ownership guard (security): upsertDocumentMeta is INSERT ... ON
      // CONFLICT(id) DO UPDATE owner_id = excluded.owner_id, so a POST with an
      // id that already exists under a DIFFERENT owner would silently transfer
      // ownership to the caller. Document ids are unguessable UUIDs but they
      // leak to every share-link visitor / team member, so refuse the create
      // when the id is already owned by someone else (legitimate updates go
      // through PUT, which gates on edit access).
      const clash = await getDocument(env, body.id);
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
      // An id in the Trash is taken just the same (docs/specs/013-workspace/trash.md):
      // its owner hears the deleted state, anyone else the same refusal.
      const binned = clash ? null : await getTrashedDocumentMeta(env, body.id);
      if (binned) return binned.ownerId === owner ? documentTrashed() : forbidden();
      if (typeof body.presentation === 'string' && body.presentation.length > MAX_DECK_LEN) {
        return badRequest('presentation too large');
      }
      // Where the document is filed, decided before the write and written by it
      // (docs/specs/013-workspace/folders.md "Placement on create"). An invalid placement refuses
      // the create by name; it never files the document somewhere else. A re-commit of the
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
      // Tab ids belong to the document (each lives in its own document's store), so seeded tabs are written
      // under the ids they carry.
      const seeded = incomingTabs;
      const presentation = typeof body.presentation === 'string' ? body.presentation : null;
      // Only a genuine create takes the body's dates: a re-commit keeps the stored created date
      // (the upsert never rewrites it) and is modified now.
      const savedAt = clash ? Date.now() : dates.savedAt;
      // Document meta first so the FK in tabs can resolve.
      await upsertDocumentMeta(env, {
        id: body.id,
        ownerId: owner,
        name,
        shareable: body.shareable ?? false,
        shareCode: body.shareCode ?? null,
        folderId: placement.folderId,
        teamId: placement.teamId,
        // Provenance (docs/specs/013-workspace/folders.md): only the closed set of generated sources
        // is accepted; anything else (or absent) is a user-made document.
        source: isDocumentSource(body.source) ? body.source : null,
        savedAt,
        createdAt: dates.createdAt,
        // The creation intent, recorded once (docs/specs/013-workspace/default-folders.md
        // "Recorded intent"); null without one. A re-commit's upsert never rewrites it.
        opensIn: intent.intent?.mode ?? null,
        tabKind: intent.intent?.tabKind ?? null,
        templateFamily: intent.intent?.templateFamily ?? null,
      });
      // The document's own row: its dates and, usually none, the slide deck an Offline Mode sync built
      // offline (docs/specs/006-document/offline-mode.md); a re-commit keeps the deck it has.
      await initDocument(env, body.id, {
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
      // docs/specs/013-workspace/timeline.md §4.2: only a GENUINE create earns a timeline event. A
      // POST that resolved to an existing row is the editor re-committing
      // an id it already owns, and "Diagram Created" twice for one
      // document is a lie the feed can't walk back.
      if (liveDoc && !clash) {
        // A sync (docs/specs/006-document/offline-mode.md) is a POST like any other, so the editor declares it:
        // undeclared, moving a document from this browser INTO the account was
        // reported as a document being created for the first time.
        const conversion = readDocumentConversion(request.headers.get(DOCUMENT_CONVERSION_HEADER));
        if (conversion === 'sync') {
          ctx.waitUntil?.(recordDocumentSynced(env, liveDoc, owner));
        } else {
          // Making it is a use of it for its maker, unless the create said not (a bulk import):
          // docs/specs/013-workspace/explorer-home.md "Making a document".
          console.info(`home: making doc=${liveDoc.id} marked=${making.markUsed}`);
          ctx.waitUntil?.(
            recordDocumentCreated(env, liveDoc, owner, { markUsed: making.markUsed }),
          );
        }
      }
      // docs/specs/014-identity/transactional-email.md (#6): on a genuine create (no prior row), check for a document
      // milestone. Count + send run in the background, off the response path.
      if (emailEnabled(env) && !clash) {
        ctx.waitUntil?.(
          countDocumentsByOwner(env, owner).then((count) => notifyMilestone(env, owner, count)),
        );
      }
      // liveworkspace's onboarding series: they made something (liveworkspace/activity.ts).
      const activity = reportOwnerActivity(env, owner, body.id);
      if (activity) ctx.waitUntil?.(activity);
      return json({ document: liveDoc }, { status: 201 });
    }
  }

  // /api/documents/<id>
  if (segments.length === 3) {
    const id = segments[2]!;
    if (request.method === 'GET') {
      // Read access (docs/specs/013-workspace/team-shared-documents.md): the owner, a valid share-code visitor,
      // OR a joined member of the document's team — the same gate the
      // tab-content read below uses, so a team member can open a team
      // document by raw id (not just via a share link). A miss returns
      // 404 (not 403) so a guessed UUID can't probe existence.
      const view = parseViewQuery(new URL(request.url), 'document');
      if (view instanceof Response) return view;
      const d = await getDocument(env, id);
      if (!d) return missingDocument(ctx, id);
      const grant = await gateGrant(ctx, id, d.ownerId, d.teamId, COMMUNITY_CONTENT);
      // Redacted for every non-owner, exactly as the share-code resolver
      // does (docs/specs/014-identity/auth-and-guest-access.md): the gate above admits any valid share code, view
      // or edit, so this is the same audience — and a guest owner's id IS
      // their credential. This door was returning it intact while the
      // share door blanked it. See redact-document.ts.
      // A tab-scoped visitor (docs/specs/013-workspace/tab-scoped-share-links.md) sees the other tabs locked.
      if (!grant) return notFound();
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
      // Metadata-only PUT now that tabs live in their own table.
      // Body: { name?, tabIds?, tabs? } — name renames the document;
      // `tabs` (preferred, docs/specs/006-document/tab-folders.md) reorders AND sets each tab's
      // per-document folder; `tabIds` is the legacy folder-less shape,
      // still accepted for older clients. All optional, at least one
      // must be present.
      const read = await readBody(ctx);
      if (read instanceof Response) return read;
      const body = read as {
        name?: string;
        tabIds?: unknown;
        tabs?: unknown;
        // Slide deck (docs/specs/012-collaboration/presentation-mode.md): serialised StoredPresentation, or null to
        // clear. Absent leaves the stored deck alone, so an ordinary rename
        // can never wipe it.
        presentation?: string | null;
      };
      const owner = requireOwner(ctx);
      if (owner instanceof Response) return owner;
      const existing = await getDocument(env, id);
      // Unknown id: 404. This PUT used to create-on-first-write (the legacy
      // localStorage-sync model), which let any stray meta write mint a
      // permanent zero-tab ghost row, e.g. a client path that missed the
      // Offline Mode dispatch (docs/specs/006-document/offline-mode.md) writing an offline document's id to
      // the server. Documents are only ever created via POST /documents now.
      if (!existing) return missingDocument(ctx, id);
      const now = Date.now();
      const ownerId = existing.ownerId;
      // Anyone with the document id could previously rewrite it.
      // We now gate on canEditDocument so only the owner or an
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
      // A rename meets the name cap (docs/specs/006-document/name-length.md); a
      // name echoed back unchanged (a reorder) is kept even if it predates it.
      const name =
        typeof body.name === 'string'
          ? capStoredName(body.name, existing.name, 'document')
          : existing.name;
      if (!name) return badRequest('missing name');
      await upsertDocumentMeta(env, {
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
      // Only when the caller actually sent the field: `undefined` means "not
      // my business", which is what every existing client sends.
      if (body.presentation !== undefined) {
        if (typeof body.presentation === 'string' && body.presentation.length > MAX_DECK_LEN) {
          return badRequest('presentation too large');
        }
        await setDocumentPresentation(env, id, body.presentation);
      }
      if (order) await reorderTabs(env, id, order);
      const liveDoc = await getDocument(env, id);
      // An agent's rename reaches the open editors (docs/specs/024-agents/agent-changesets.md "Whole-tab saves and tab
      // renames"); an editor sends its own rename to the room itself.
      if (ctx.token && liveDoc && name !== existing.name)
        ctx.waitUntil?.(relayDocumentRename(env, id, liveDoc.name, liveDoc.tabs));
      // A rename is not a timeline moment (docs/specs/013-workspace/timeline.md §4.2): the feed reads
      // every document's CURRENT name instead, so older entries follow it.
      // Redacted like the GET: an edit-role share visitor passes gateEdit, and
      // a guest owner's id is a credential (see redact-document.ts).
      return json({ document: liveDoc ? redactDocumentForReader(liveDoc, owner) : liveDoc });
    }
    if (request.method === 'DELETE') {
      // Trash, permanent delete and Take Offline: document-delete-route.ts
      // (docs/specs/013-workspace/trash.md).
      return handleDocumentDelete(ctx, id);
    }
  }

  // /api/documents/<id>/copy — duplicate this document into the
  // caller's own files. Accepted from (a) the owner — same as
  // any other "duplicate" path; (b) a visitor with an active
  // `shared_with` row for the source; (c) a visitor providing
  // a valid X-Share-Code for the source. Skips share_links on the
  // copy by design (docs/specs/014-identity/auth-and-guest-access.md) so
  // the new document reads as the visitor's own clean workspace.
  if (segments.length === 4 && segments[3] === 'copy') {
    const id = segments[2]!;
    if (request.method === 'POST') {
      const owner = requireOwner(ctx);
      if (owner instanceof Response) return owner;
      const source = await getDocument(env, id);
      if (!source) return missingDocument(ctx, id);
      // Authorisation: any of (a) owner, (b) holder of any
      // share code (view or edit) for this document, (c)
      // visitor with an active shared_with row for the source.
      // The owner + share-code legs are exactly canReadDocument
      // (view-role visitors can fork their own copy, so this
      // is a read check, not an edit check). The third leg is
      // copy-specific so it stays inline.
      //
      // Either way a tab-scoped visitor (docs/specs/013-workspace/tab-scoped-share-links.md) copies their tab
      // only: the share-code leg carries the link's scope, the shared_with
      // leg the scope recorded on their last visit.
      let scope: {
        tabScope: string | null;
        community?: boolean;
        shareCode?: string | null;
      } | null = await gateGrant(ctx, id, source.ownerId, source.teamId, COMMUNITY_CONTENT);
      if (!scope) {
        const sharedRow = (await listSharedWith(env, owner)).find((s) => s.id === id);
        // A past visit is no way round the document's share password
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
      // The copy's name meets the name cap (docs/specs/006-document/name-length.md),
      // including the default, which a long source name pushes past it.
      const requested =
        typeof body.name === 'string' ? capStoredName(body.name, null, 'document') : '';
      // A copy through a Community post's link is named after the post (docs/specs/025-community/community.md
      // "Making a copy"): its title is what the visitor chose, and the author's own document name was never published.
      const post =
        !requested && scope.community && scope.shareCode
          ? await getCommunityLinkByShareCode(env, scope.shareCode)
          : null;
      const newName =
        requested ||
        (post?.title ? capStoredName(post.title, null, 'document') : '') ||
        capStoredName(`Copy of ${source.name}`, null, 'document');
      const copy = await copyDocument(
        env,
        id,
        newId,
        owner,
        newName,
        scope.tabScope,
        scope.community === true,
        // Anyone but the owner copies the comments as the tab read serves them to them.
        owner === source.ownerId ? null : owner,
      );
      if (!copy) return notFound();
      // A copy through a Community post's link counts toward its copy count, once per person
      // (docs/specs/025-community/community.md).
      if (scope.community && scope.shareCode && owner !== source.ownerId) {
        ctx.waitUntil?.(countCommunityCopy(env, id, owner, clientIp(request)));
      }
      // A copy is one document made on purpose: always a use (docs/specs/015-api/api.md "Marking a
      // document used").
      ctx.waitUntil?.(recordDocumentDuplicated(env, copy, source.name, owner, { markUsed: true }));
      // A copy taken by someone who came in through a share link is news the
      // owner wants: their shared document was worth forking.
      //
      // Same gate as the visitor-open event, for the same reason: the copy
      // route's read check admits joined team members, who present no share
      // code, and telling an owner that a teammate duplicating a team-library
      // document was "copied by a visitor" is simply untrue.
      // Not for a Community copy: the copier is a stranger to the author (their copy is counted instead).
      if (owner !== source.ownerId && shareCodeOf(request) !== null && !scope.community) {
        ctx.waitUntil?.(
          getParticipant(env, owner).then((p) =>
            recordVisitorCopied(env, source, owner, p?.name ?? null),
          ),
        );
      }
      return json({ document: copy }, { status: 201 });
    }
  }

  // /api/documents/<id>/folder — placement (docs/specs/013-workspace/folders.md + docs/specs/013-workspace/team-shared-documents.md); the
  // scope-change policy lives in document-placement-route.ts.
  {
    const placementResp = await handleDocumentPlacement(ctx);
    if (placementResp) return placementResp;
  }

  // /api/documents/<id>/community: publish to, edit in or remove from Community
  // (docs/specs/025-community/community.md).
  {
    const communityResp = await handleCommunityOwnerRoutes(ctx);
    if (communityResp) return communityResp;
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
