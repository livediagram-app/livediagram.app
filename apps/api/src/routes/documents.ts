// /api/documents — document metadata, per-tab content, copy, folder
// assignment, tab linking, comments, share links, the realtime WS
// upgrade, and the change-log. The largest resource: every sub-path
// under a document id lives here.

import type { Tab } from '@livediagram/document';
import { isValidTab, migrateIncomingTab } from '@livediagram/document';
import { capStoredName } from '../names';
import {
  MAX_CHANGE_LOG_ENTRY_BYTES,
  MAX_DECK_LEN,
  MAX_TAB_BYTES,
  byteLength,
  bodyExceedsCap,
  declaredBodyBytes,
} from '../limits';
import {
  CHANGE_LOG_TAB_NOT_SAVED,
  DOCUMENT_CONVERSION_HEADER,
  readDocumentConversion,
} from '@livediagram/api-schema';
import { parseChangeLogEntryBody } from '../change-log-body';
import {} from '../comments';
import {
  copyDocument,
  deleteChangeLogEntry,
  deleteChangeLogForTab,
  getDocument,
  getDocumentThumbMeta,
  getTrashedDocumentMeta,
  getFolder,
  countDocumentsByOwner,
  getParticipant,
  insertChangeLogEntry,
  listChangeLog,
  listDocumentsByOwner,
  listSharedWith,
  reorderTabs,
  seedTabs,
  setDocumentPresentation,
  tabIdsHeldElsewhere,
  upsertDocumentMeta,
} from '../db';
import {
  badRequest,
  conflict,
  documentTrashed,
  forbidden,
  json,
  noContent,
  notFound,
  payloadTooLarge,
  svgImage,
} from '../responses';
import { documentDates } from '../document-dates';
import { getDocumentTabImageSvg, getDocumentThumbnailSvg } from '../thumbnail';
import { redactDocumentForReader, redactDocumentForScope } from '../redact-document';
import { emailEnabled } from '../email/client';
import { notifyMilestone } from '../email/notifications';
import {
  recordDocumentCreated,
  recordDocumentDuplicated,
  recordDocumentSynced,
  recordVisitorCopied,
} from '../timeline';
import { handleDocumentDelete } from './document-delete-route';
import { handleDocumentPlacement } from './document-placement-route';
import { handleDocumentSharedTabs } from './document-shared-tabs-route';
import { forkTakenTabIds } from '../tab-id-fork';
import { handleDocumentRoomRoutes } from './document-room-routes';
import { handleDocumentSubresources } from './document-subresource-routes';
import type { ChangeLogEntryDTO, DocumentDTO } from '../types';
import {
  gateEdit,
  gateGrant,
  missingDocument,
  requireDocumentGrant,
  requireOwnedDocument,
  requireOwner,
  shareCodeOf,
  type RouteContext,
} from './context';

export async function handleDocuments(ctx: RouteContext): Promise<Response> {
  const { request, env, segments } = ctx;
  if (segments[1] !== 'documents') return notFound();
  if (segments.length === 2) {
    if (request.method === 'GET') {
      const owner = requireOwner(ctx);
      if (owner instanceof Response) return owner;
      const liveDocs = await listDocumentsByOwner(env, owner);
      return json({ documents: liveDocs });
    }
    if (request.method === 'POST') {
      const body = (await request.json()) as Omit<Partial<DocumentDTO>, 'tabs'> & {
        tabs?: Tab[];
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
      // Validate any seeded tabs up front (structure + per-tab byte cap) so a
      // create can't smuggle a malformed / oversized tab past the tab gate.
      if (Array.isArray(body.tabs)) {
        // Former stored shapes (a Google Drive copy, an offline sync, an API-token script) are
        // migrated before validation, as every tab read migrates them (docs/specs/015-api/api.md).
        body.tabs = body.tabs.map((tab) => migrateIncomingTab(tab) as Tab);
        for (const tab of body.tabs) {
          if (!isValidTab(tab)) return badRequest('invalid tab');
          if (byteLength(JSON.stringify(tab)) > MAX_TAB_BYTES) {
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
      // A seeded folder must be one of the caller's own personal folders, the
      // same scope rule PUT /folder applies. Anything else (a folder deleted
      // since an offline document was filed in it, someone else's) lands the
      // document in Unsorted rather than failing the create: this is how an
      // Offline Mode sync carries its placement (docs/specs/006-document/offline-mode.md).
      let folderId = typeof body.folderId === 'string' ? body.folderId : null;
      if (folderId !== null) {
        const folder = await getFolder(env, folderId);
        if (!folder || folder.teamId !== null || folder.ownerId !== owner) folderId = null;
      }
      // A seeded tab whose id another document holds is created under a fresh
      // id, never upserted over it: that is how a synced-back offline copy of a
      // shared tab forks (docs/specs/006-document/offline-mode.md), and why a
      // create can't rewrite someone else's tab by naming its id.
      const seeded = incomingTabs
        ? forkTakenTabIds(
            incomingTabs,
            typeof body.presentation === 'string' ? body.presentation : null,
            await tabIdsHeldElsewhere(
              env,
              body.id,
              incomingTabs.map((t) => t.id),
            ),
          )
        : null;
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
        folderId,
        // Documents are always created personal; they move into a
        // team library via PUT /folder afterwards (docs/specs/013-workspace/team-shared-documents.md).
        teamId: null,
        // Usually none. An Offline Mode sync carries the deck it built
        // offline (docs/specs/006-document/offline-mode.md), which would otherwise be lost with the local copy.
        presentation:
          seeded?.presentation ??
          (typeof body.presentation === 'string' ? body.presentation : null),
        // Provenance (docs/specs/013-workspace/folders.md): only the closed set of generated sources
        // is accepted; anything else (or absent) is a user-made document.
        source: body.source === 'ai' || body.source === 'mcp' ? body.source : null,
        savedAt,
        createdAt: dates.createdAt,
      });
      // Seed tabs if the caller provided them. The live app's
      // welcome flow uses this when it commits a fresh document
      // id — it ships the templated tab inline so the very
      // first per-tab fetch already has data.
      if (seeded) {
        await seedTabs(env, body.id, seeded.tabs, savedAt);
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
        ctx.waitUntil?.(
          conversion === 'sync'
            ? recordDocumentSynced(env, liveDoc, owner)
            : recordDocumentCreated(env, liveDoc, owner),
        );
      }
      // docs/specs/014-identity/transactional-email.md (#6): on a genuine create (no prior row), check for a document
      // milestone. Count + send run in the background, off the response path.
      if (emailEnabled(env) && !clash) {
        ctx.waitUntil?.(
          countDocumentsByOwner(env, owner).then((count) => notifyMilestone(env, owner, count)),
        );
      }
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
      const d = await getDocument(env, id);
      if (!d) return missingDocument(ctx, id);
      const grant = await gateGrant(ctx, id, d.ownerId, d.teamId);
      // Redacted for every non-owner, exactly as the share-code resolver
      // does (docs/specs/014-identity/auth-and-guest-access.md): the gate above admits any valid share code, view
      // or edit, so this is the same audience — and a guest owner's id IS
      // their credential. This door was returning it intact while the
      // share door blanked it. See redact-document.ts.
      // A tab-scoped visitor (docs/specs/013-workspace/tab-scoped-share-links.md) sees the other tabs locked.
      if (!grant) return notFound();
      const liveDoc = redactDocumentForScope(
        redactDocumentForReader(d, ctx.resolveOwner()),
        grant.tabScope,
      );
      return json({ document: liveDoc });
    }
    if (request.method === 'PUT') {
      // Metadata-only PUT now that tabs live in their own table.
      // Body: { name?, tabIds?, tabs? } — name renames the document;
      // `tabs` (preferred, docs/specs/006-document/tab-folders.md) reorders AND sets each tab's
      // per-document folder; `tabIds` is the legacy folder-less shape,
      // still accepted for older clients. All optional, at least one
      // must be present.
      const body = (await request.json()) as {
        name?: string;
        tabIds?: string[];
        tabs?: { id: string; folder?: string | null }[];
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
        // The deck has its own write below; the meta upsert never touches it.
        presentation: existing.presentation ?? null,
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
      // Prefer the folder-carrying `tabs` shape; fall back to the
      // legacy `tabIds` (treated as loose) so older clients keep working.
      if (Array.isArray(body.tabs)) {
        await reorderTabs(env, id, body.tabs);
      } else if (Array.isArray(body.tabIds)) {
        await reorderTabs(env, id, body.tabIds);
      }
      const liveDoc = await getDocument(env, id);
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
  // a valid X-Share-Code for the source. Skips share_links /
  // change_log on the copy by design (docs/specs/014-identity/auth-and-guest-access.md + docs/specs/012-collaboration/activity-and-audit.md) so
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
      let scope: { tabScope: string | null } | null = await gateGrant(
        ctx,
        id,
        source.ownerId,
        source.teamId,
      );
      if (!scope) {
        const sharedRow = (await listSharedWith(env, owner)).find((s) => s.id === id);
        if (sharedRow) scope = { tabScope: sharedRow.tabId };
      }
      if (!scope) return forbidden();
      const body = (await request.json().catch(() => ({}) as { name?: unknown })) as {
        name?: unknown;
      };
      const newId = crypto.randomUUID();
      // The copy's name meets the name cap (docs/specs/006-document/name-length.md),
      // including the default, which a long source name pushes past it.
      const requested =
        typeof body.name === 'string' ? capStoredName(body.name, null, 'document') : '';
      const newName = requested || capStoredName(`Copy of ${source.name}`, null, 'document');
      const copy = await copyDocument(env, id, newId, owner, newName, scope.tabScope);
      if (!copy) return notFound();
      ctx.waitUntil?.(recordDocumentDuplicated(env, copy, source.name, owner));
      // A copy taken by someone who came in through a share link is news the
      // owner wants: their shared document was worth forking.
      //
      // Same gate as the visitor-open event, for the same reason: the copy
      // route's read check admits joined team members, who present no share
      // code, and telling an owner that a teammate duplicating a team-library
      // document was "copied by a visitor" is simply untrue.
      if (owner !== source.ownerId && shareCodeOf(request) !== null) {
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

  // /api/documents/<id>/shared-tabs — what a delete leaves behind in other
  // documents (docs/specs/006-document/tab-document-many-to-many.md).
  {
    const sharedTabsResp = await handleDocumentSharedTabs(ctx);
    if (sharedTabsResp) return sharedTabsResp;
  }

  // /api/documents/<id>/thumbnail — cached SVG snapshot (docs/specs/006-document/document-snapshots.md). Read-
  // gated exactly like GET /api/documents/<id>: the owner, a joined team
  // member, or a valid share-code visitor. A native <img> can't send
  // auth headers, so the live app fetches this with headers and wraps
  // the bytes in a blob URL; a miss (no document, no read access, no R2
  // binding, empty document) is a 404 the row turns into its icon.
  if (segments.length === 4 && segments[3] === 'thumbnail') {
    const id = segments[2]!;
    if (request.method === 'GET') {
      // One query for the gate AND the cache-freshness check: this runs for
      // every preview in the Explorer grid, so its D1 round trips are the
      // floor on how fast a card can paint.
      const d = await getDocumentThumbMeta(env, id);
      if (!d) return notFound();
      const grant = await gateGrant(ctx, id, d.ownerId, d.teamId);
      if (!grant) return notFound();
      // A tab-scoped visitor (docs/specs/013-workspace/tab-scoped-share-links.md) gets their tab, never the
      // first-tab snapshot.
      const svg = grant.tabScope
        ? await getDocumentTabImageSvg(env, d, grant.tabScope)
        : await getDocumentThumbnailSvg(env, d, { defer: ctx.waitUntil });
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
  }

  const subResp = await handleDocumentSubresources(ctx);
  if (subResp) return subResp;

  // Realtime-room admission (docs/specs/015-api/api.md): the one-time WS ticket mint +
  // the Durable Object upgrade — see document-room-routes.ts.
  const roomResp = await handleDocumentRoomRoutes(ctx);
  if (roomResp) return roomResp;

  // /api/documents/<id>/log — owner OR edit-role share-code holder.
  //   GET  → newest-first list of audit entries (capped at 200).
  //   POST → append a new entry. Body is a ChangeLogEntryDTO.
  // See docs/specs/012-collaboration/activity-and-audit.md.
  if (segments.length === 4 && segments[3] === 'log') {
    const id = segments[2]!;
    // A tab-scoped edit visitor (docs/specs/013-workspace/tab-scoped-share-links.md) reads and writes their
    // tab's entries only.
    const granted = await requireDocumentGrant(ctx, id, 'edit');
    if (granted instanceof Response) return granted;
    const { document: access, grant } = granted;

    if (request.method === 'GET') {
      const entries = await listChangeLog(env, id, grant.tabScope);
      // Redact each entry's author owner id for non-owners (docs/specs/015-api/public-api-and-tokens.md §6): it's
      // the same value a token / X-Owner-Id authenticates with, so a non-owner
      // edit collaborator must not be able to harvest it from the audit trail.
      // The owner still sees the real ids; display name / colour are untouched
      // (mirrors redactCommentAuthorIds + the document-DTO ownerId redaction).
      const isOwner = ctx.resolveOwner() === access.ownerId;
      const safe = isOwner ? entries : entries.map((e) => ({ ...e, participantId: '' }));
      return json({ entries: safe });
    }
    if (request.method === 'POST') {
      // Per-entry byte cap: only the 8MB outer body cap applied before, so 30
      // huge entries could balloon the capped list response. Nothing
      // downstream measures anything — parseChangeLogEntryBody copies summary
      // and the before/after payloads straight through — so this cap is the
      // only bound on what an edit-access caller can write, and every
      // collaborator refetches up to 30 of them per GET.
      //
      // Checked twice on purpose: a declared length lets us reject a hostile
      // entry BEFORE parsing it, and bodyExceedsCap then re-checks the parsed
      // body for the request shapes no header can size. The second call costs
      // nothing when a header was present.
      const declared = declaredBodyBytes(request);
      if (declared !== null && declared > MAX_CHANGE_LOG_ENTRY_BYTES) {
        return payloadTooLarge();
      }
      const body = (await request.json()) as Partial<ChangeLogEntryDTO>;
      if (bodyExceedsCap(request, body, MAX_CHANGE_LOG_ENTRY_BYTES)) {
        return payloadTooLarge();
      }
      const entry = parseChangeLogEntryBody(body);
      if (!entry) return badRequest('missing change_log fields');
      if (grant.tabScope !== null && entry.tabId !== grant.tabScope) return notFound();
      // The entry's tab must belong to THIS document. The log is listed by
      // joining through document_tabs, so an unchecked tab id let an editor of
      // one document write rows into another document's activity panel. It is
      // also what turned a brand-new tab's first edit (logged before the
      // debounced autosave created the tab row) into a foreign-key 500: that
      // case now answers a 409 the editor retries.
      if (entry.tabId && !access.tabs.some((t) => t.id === entry.tabId)) {
        return conflict(CHANGE_LOG_TAB_NOT_SAVED);
      }
      // Stamp the author from the resolved caller's participant record
      // rather than trusting the body, so a client can't forge
      // participantId / participantName / participantColor and frame
      // another collaborator in the audit trail — the same defence the
      // comment-write paths apply. requireDocumentGrant already proved
      // the caller is identified, so resolveOwner() is non-null here.
      const caller = ctx.resolveOwner()!;
      const writer = await getParticipant(env, caller);
      const stamped = {
        ...entry,
        participantId: caller,
        participantName: writer?.name ?? entry.participantName,
        participantColor: writer?.color ?? entry.participantColor,
      };
      await insertChangeLogEntry(env, stamped);
      return json({ entry: stamped }, { status: 201 });
    }
  }

  // /api/documents/<id>/log/<entryId> — owner OR edit-role share
  // visitor. DELETE drops a single log entry; called by Revert
  // and by the symmetric Undo path so the entry vanishes on the
  // canvas of every connected client.
  if (segments.length === 5 && segments[3] === 'log') {
    const id = segments[2]!;
    const entryId = segments[4]!;
    const granted = await requireDocumentGrant(ctx, id, 'edit');
    if (granted instanceof Response) return granted;

    if (request.method === 'DELETE') {
      await deleteChangeLogEntry(env, id, entryId, granted.grant.tabScope);
      return noContent();
    }
  }

  // /api/documents/<id>/log/tab/<tabId> — owner-only DELETE that
  // drops every log entry for a tab. Called by the live app when
  // it deletes a tab so the per-tab audit dies with the tab.
  if (segments.length === 6 && segments[3] === 'log' && segments[4] === 'tab') {
    const id = segments[2]!;
    const tabId = segments[5]!;
    const access = await requireOwnedDocument(ctx, id);
    if (access instanceof Response) return access;

    if (request.method === 'DELETE') {
      await deleteChangeLogForTab(env, id, tabId);
      return noContent();
    }
  }

  return notFound();
}
