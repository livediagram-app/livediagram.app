// /api/diagrams — diagram metadata, per-tab content, copy, folder
// assignment, tab linking, comments, share links, the realtime WS
// upgrade, and the change-log. The largest resource: every sub-path
// under a diagram id lives here.

import type { Tab } from '@livediagram/diagram';
import { isValidTab } from '@livediagram/diagram';
import {
  MAX_CHANGE_LOG_ENTRY_BYTES,
  MAX_DECK_LEN,
  MAX_NAME_LEN,
  MAX_TAB_BYTES,
  byteLength,
  bodyExceedsCap,
  declaredBodyBytes,
} from '../limits';
import {
  CHANGE_LOG_TAB_NOT_SAVED,
  DIAGRAM_CONVERSION_HEADER,
  readDiagramConversion,
} from '@livediagram/api-schema';
import { parseChangeLogEntryBody } from '../change-log-body';
import {} from '../comments';
import {
  copyDiagram,
  deleteChangeLogEntry,
  deleteChangeLogForTab,
  deleteDiagram,
  getDiagram,
  getFolder,
  countDiagramsByOwner,
  getMembership,
  getParticipant,
  insertChangeLogEntry,
  listChangeLog,
  listDiagramsByOwner,
  listSharedWith,
  reorderTabs,
  seedTabs,
  setDiagramPresentation,
  upsertDiagramMeta,
} from '../db';
import { badRequest, conflict, forbidden, json, noContent, notFound, svgImage } from '../responses';
import { getDiagramThumbnailSvg } from '../thumbnail';
import { redactOwnerId } from '../redact-owner';
import { emailEnabled } from '../email/client';
import { notifyMilestone } from '../email/notifications';
import {
  recordDiagramCreated,
  recordDiagramDuplicated,
  recordDiagramOffline,
  recordDiagramRenamed,
  recordDiagramSynced,
  recordVisitorCopied,
} from '../timeline';
import { markTimelineEventsDeletedBySource } from '../db/timeline';
import { handleDiagramPlacement } from './diagram-placement-route';
import { handleDiagramRoomRoutes } from './diagram-room-routes';
import { handleDiagramSubresources } from './diagram-subresource-routes';
import type { ChangeLogEntryDTO, DiagramDTO } from '../types';
import {
  gateEdit,
  gateRead,
  ownsDiagram,
  requireDiagramAccess,
  requireOwnedDiagram,
  requireOwner,
  shareCodeOf,
  type RouteContext,
} from './context';

export async function handleDiagrams(ctx: RouteContext): Promise<Response> {
  const { request, env, segments } = ctx;
  if (segments[1] !== 'diagrams') return notFound();
  if (segments.length === 2) {
    if (request.method === 'GET') {
      const owner = requireOwner(ctx);
      if (owner instanceof Response) return owner;
      const diagrams = await listDiagramsByOwner(env, owner);
      return json({ diagrams });
    }
    if (request.method === 'POST') {
      const body = (await request.json()) as Partial<DiagramDTO> & { tabs?: Tab[] };
      const owner = requireOwner(ctx);
      if (owner instanceof Response) return owner;
      if (!body.id || !body.name) {
        return badRequest('missing id/name');
      }
      if (body.name.length > MAX_NAME_LEN) {
        return badRequest('name too long');
      }
      // Validate any seeded tabs up front (structure + per-tab byte cap) so a
      // create can't smuggle a malformed / oversized tab past the tab gate.
      if (Array.isArray(body.tabs)) {
        for (const tab of body.tabs) {
          if (!isValidTab(tab)) return badRequest('invalid tab');
          if (byteLength(JSON.stringify(tab)) > MAX_TAB_BYTES) {
            return json({ error: 'payload_too_large' }, { status: 413 });
          }
        }
      }
      // Ownership guard (security): upsertDiagramMeta is INSERT ... ON
      // CONFLICT(id) DO UPDATE owner_id = excluded.owner_id, so a POST with an
      // id that already exists under a DIFFERENT owner would silently transfer
      // ownership to the caller. Diagram ids are unguessable UUIDs but they
      // leak to every share-link visitor / team member, so refuse the create
      // when the id is already owned by someone else (legitimate updates go
      // through PUT, which gates on edit access).
      const clash = await getDiagram(env, body.id);
      if (clash && clash.ownerId !== owner) return forbidden();
      if (typeof body.presentation === 'string' && body.presentation.length > MAX_DECK_LEN) {
        return badRequest('presentation too large');
      }
      // A seeded folder must be one of the caller's own personal folders, the
      // same scope rule PUT /folder applies. Anything else (a folder deleted
      // since an offline diagram was filed in it, someone else's) lands the
      // diagram in Unsorted rather than failing the create: this is how an
      // Offline Mode sync carries its placement (spec/76).
      let folderId = typeof body.folderId === 'string' ? body.folderId : null;
      if (folderId !== null) {
        const folder = await getFolder(env, folderId);
        if (!folder || folder.teamId !== null || folder.ownerId !== owner) folderId = null;
      }
      const now = Date.now();
      // Diagram meta first so the FK in tabs can resolve.
      await upsertDiagramMeta(env, {
        id: body.id,
        ownerId: owner,
        name: body.name,
        shareable: body.shareable ?? false,
        shareCode: body.shareCode ?? null,
        folderId,
        // Diagrams are always created personal; they move into a
        // team library via PUT /folder afterwards (spec/35).
        teamId: null,
        // Usually none. An Offline Mode sync carries the deck it built
        // offline (spec/76), which would otherwise be lost with the local copy.
        presentation: typeof body.presentation === 'string' ? body.presentation : null,
        // Provenance (spec/15): only the closed set of generated sources
        // is accepted; anything else (or absent) is a user-made diagram.
        source: body.source === 'ai' || body.source === 'mcp' ? body.source : null,
        savedAt: now,
        createdAt: body.createdAt ?? now,
      });
      // Seed tabs if the caller provided them. The live app's
      // welcome flow uses this when it commits a fresh diagram
      // id — it ships the templated tab inline so the very
      // first per-tab fetch already has data.
      if (Array.isArray(body.tabs)) {
        await seedTabs(env, body.id, body.tabs);
      }
      const diagram = await getDiagram(env, body.id);
      // spec/138 §4.2: only a GENUINE create earns a timeline event. A
      // POST that resolved to an existing row is the editor re-committing
      // an id it already owns, and "Diagram Created" twice for one
      // diagram is a lie the feed can't walk back.
      if (diagram && !clash) {
        // A sync (spec/76) is a POST like any other, so the editor declares it:
        // undeclared, moving a diagram from this browser INTO the account was
        // reported as a diagram being created for the first time.
        const conversion = readDiagramConversion(request.headers.get(DIAGRAM_CONVERSION_HEADER));
        ctx.waitUntil?.(
          conversion === 'sync'
            ? recordDiagramSynced(env, diagram, owner)
            : recordDiagramCreated(env, diagram, owner),
        );
      }
      // spec/64 (#6): on a genuine create (no prior row), check for a diagram
      // milestone. Count + send run in the background, off the response path.
      if (emailEnabled(env) && !clash) {
        ctx.waitUntil?.(
          countDiagramsByOwner(env, owner).then((count) => notifyMilestone(env, owner, count)),
        );
      }
      return json({ diagram }, { status: 201 });
    }
  }

  // /api/diagrams/<id>
  if (segments.length === 3) {
    const id = segments[2]!;
    if (request.method === 'GET') {
      // Read access (spec/35): the owner, a valid share-code visitor,
      // OR a joined member of the diagram's team — the same gate the
      // tab-content read below uses, so a team member can open a team
      // diagram by raw id (not just via a share link). A miss returns
      // 404 (not 403) so a guessed UUID can't probe existence.
      const d = await getDiagram(env, id);
      if (!d) return notFound();
      const allowed = await gateRead(ctx, id, d.ownerId, d.teamId);
      // Redacted for every non-owner, exactly as the share-code resolver
      // does (spec/04): the gate above admits any valid share code, view
      // or edit, so this is the same audience — and a guest owner's id IS
      // their credential. This door was returning it intact while the
      // share door blanked it. See redact-owner.ts.
      return allowed ? json({ diagram: redactOwnerId(d, ctx.resolveOwner()) }) : notFound();
    }
    if (request.method === 'PUT') {
      // Metadata-only PUT now that tabs live in their own table.
      // Body: { name?, tabIds?, tabs? } — name renames the diagram;
      // `tabs` (preferred, spec/30) reorders AND sets each tab's
      // per-diagram folder; `tabIds` is the legacy folder-less shape,
      // still accepted for older clients. All optional, at least one
      // must be present.
      const body = (await request.json()) as {
        name?: string;
        tabIds?: string[];
        tabs?: { id: string; folder?: string | null }[];
        // Slide deck (spec/31): serialised StoredPresentation, or null to
        // clear. Absent leaves the stored deck alone, so an ordinary rename
        // can never wipe it.
        presentation?: string | null;
      };
      const owner = requireOwner(ctx);
      if (owner instanceof Response) return owner;
      if (typeof body.name === 'string' && body.name.length > MAX_NAME_LEN) {
        return badRequest('name too long');
      }
      const existing = await getDiagram(env, id);
      // Unknown id: 404. This PUT used to create-on-first-write (the legacy
      // localStorage-sync model), which let any stray meta write mint a
      // permanent zero-tab ghost row, e.g. a client path that missed the
      // Offline Mode dispatch (spec/76) writing an offline diagram's id to
      // the server. Diagrams are only ever created via POST /diagrams now.
      if (!existing) return notFound();
      const now = Date.now();
      const ownerId = existing.ownerId;
      // Anyone with the diagram id could previously rewrite it.
      // We now gate on canEditDiagram so only the owner or an
      // edit-role share visitor can touch metadata.
      const allowed = await gateEdit(ctx, id, ownerId, existing.teamId);
      if (!allowed) return forbidden();
      await upsertDiagramMeta(env, {
        id,
        ownerId,
        name: body.name ?? existing.name,
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
        await setDiagramPresentation(env, id, body.presentation);
      }
      // Prefer the folder-carrying `tabs` shape; fall back to the
      // legacy `tabIds` (treated as loose) so older clients keep working.
      if (Array.isArray(body.tabs)) {
        await reorderTabs(env, id, body.tabs);
      } else if (Array.isArray(body.tabIds)) {
        await reorderTabs(env, id, body.tabIds);
      }
      const diagram = await getDiagram(env, id);
      // spec/138 §4.2: a rename only. The same PUT also carries tab
      // reorders and deck writes, and neither is a timeline moment —
      // the feed would fill with "Renamed X → X" on every save.
      if (diagram && typeof body.name === 'string' && body.name !== existing.name) {
        ctx.waitUntil?.(recordDiagramRenamed(env, diagram, existing.name, owner));
      }
      // Redacted like the GET: an edit-role share visitor passes gateEdit, and
      // a guest owner's id is a credential (see redact-owner.ts).
      return json({ diagram: diagram ? redactOwnerId(diagram, owner) : diagram });
    }
    if (request.method === 'DELETE') {
      // Owner, OR a joined member of the diagram's team (spec/35:
      // members fully manage team diagrams, delete included). NOT a
      // share-link visitor — editing content via a link is one thing,
      // destroying the diagram is owner/team-only. Resolve the caller
      // first (400 with no auth), then 404 on a missing diagram (no
      // existence leak), then 403 on a caller with no claim.
      const owner = requireOwner(ctx);
      if (owner instanceof Response) return owner;
      const existing = await getDiagram(env, id);
      if (!existing) return notFound();
      // `ownsDiagram`, not `owner === existing.ownerId`: a TEAM diagram's
      // owner id is a Clerk id every teammate can read, so proving ownership
      // of one needs a verified account id rather than the X-Owner-Id header
      // (see routes/context.ts). The membership leg below already worked that
      // way; this leg didn't, so a stale member holding the owner's id could
      // delete a team diagram.
      let allowed = await ownsDiagram(ctx, existing);
      if (!allowed && existing.teamId && ctx.verifiedUserId) {
        const membership = await getMembership(env, existing.teamId, ctx.verifiedUserId);
        allowed = membership?.status === 'joined';
      }
      if (!allowed) return forbidden();
      // spec/138 §3.5: a deleted diagram leaves NO trace on the Timeline.
      // Its history is swept and no tombstone is written — from the feed's
      // point of view it never existed. (There used to be a "Diagram
      // Deleted" card; it was noise the reader had asked to be rid of.)
      //
      // "Take offline" (spec/76) reaches this same DELETE — the server copy
      // really does go — but the diagram is not gone, it moved into the
      // caller's browser, and THAT is worth a card. Honoured for the OWNER
      // only: the DELETE is also reachable by any joined member of the
      // diagram's team (see the gate above, spec/35), and the Explorer
      // offers Take Offline on a team-library row without checking who owns
      // it. When a teammate does it the diagram moves into THEIR browser and
      // leaves the owner's account for good — from the owner's and the
      // team's side that is a deletion, and a deletion records nothing.
      const conversion =
        owner === existing.ownerId
          ? readDiagramConversion(request.headers.get(DIAGRAM_CONVERSION_HEADER))
          : null;
      await deleteDiagram(env, id);
      ctx.waitUntil?.(
        markTimelineEventsDeletedBySource(env, 'diagram', id)
          .then(() =>
            conversion === 'offline'
              ? // Owner-only: an offline diagram exists in exactly one browser,
                // so no teammate has a stake in it.
                recordDiagramOffline(env, existing, owner)
              : undefined,
          )
          .catch((err) => console.error('timeline diagram delete failed', err)),
      );
      return noContent();
    }
  }

  // /api/diagrams/<id>/copy — duplicate this diagram into the
  // caller's own files. Accepted from (a) the owner — same as
  // any other "duplicate" path; (b) a visitor with an active
  // `shared_with` row for the source; (c) a visitor providing
  // a valid X-Share-Code for the source. Skips share_links /
  // change_log on the copy by design (spec/04 + spec/12) so
  // the new diagram reads as the visitor's own clean workspace.
  if (segments.length === 4 && segments[3] === 'copy') {
    const id = segments[2]!;
    if (request.method === 'POST') {
      const owner = requireOwner(ctx);
      if (owner instanceof Response) return owner;
      const source = await getDiagram(env, id);
      if (!source) return notFound();
      // Authorisation: any of (a) owner, (b) holder of any
      // share code (view or edit) for this diagram, (c)
      // visitor with an active shared_with row for the source.
      // The owner + share-code legs are exactly canReadDiagram
      // (view-role visitors can fork their own copy, so this
      // is a read check, not an edit check). The third leg is
      // copy-specific so it stays inline.
      let allowed = await gateRead(ctx, id, source.ownerId, source.teamId);
      if (!allowed) {
        const sharedRows = await listSharedWith(env, owner);
        if (sharedRows.some((s) => s.id === id)) allowed = true;
      }
      if (!allowed) return forbidden();
      const body = (await request.json().catch(() => ({}) as { name?: string })) as {
        name?: string;
      };
      const newId = crypto.randomUUID();
      const newName = (body.name?.trim() || `Copy of ${source.name}`).slice(0, 200);
      const copy = await copyDiagram(env, id, newId, owner, newName);
      if (!copy) return notFound();
      ctx.waitUntil?.(recordDiagramDuplicated(env, copy, source.name, owner));
      // A copy taken by someone who came in through a share link is news the
      // owner wants: their shared diagram was worth forking.
      //
      // Same gate as the visitor-open event, for the same reason: the copy
      // route's read check admits joined team members, who present no share
      // code, and telling an owner that a teammate duplicating a team-library
      // diagram was "copied by a visitor" is simply untrue.
      if (owner !== source.ownerId && shareCodeOf(request) !== null) {
        ctx.waitUntil?.(
          getParticipant(env, owner).then((p) =>
            recordVisitorCopied(env, source, owner, p?.name ?? null),
          ),
        );
      }
      return json({ diagram: copy }, { status: 201 });
    }
  }

  // /api/diagrams/<id>/folder — placement (spec/15 + spec/35); the
  // scope-change policy lives in diagram-placement-route.ts.
  {
    const placementResp = await handleDiagramPlacement(ctx);
    if (placementResp) return placementResp;
  }

  // /api/diagrams/<id>/thumbnail — cached SVG snapshot (spec/67). Read-
  // gated exactly like GET /api/diagrams/<id>: the owner, a joined team
  // member, or a valid share-code visitor. A native <img> can't send
  // auth headers, so the live app fetches this with headers and wraps
  // the bytes in a blob URL; a miss (no diagram, no read access, no R2
  // binding, empty diagram) is a 404 the row turns into its icon.
  if (segments.length === 4 && segments[3] === 'thumbnail') {
    const id = segments[2]!;
    if (request.method === 'GET') {
      const d = await getDiagram(env, id);
      if (!d) return notFound();
      const allowed = await gateRead(ctx, id, d.ownerId, d.teamId);
      if (!allowed) return notFound();
      const svg = await getDiagramThumbnailSvg(env, d);
      if (svg == null) return notFound();
      // The client cache-busts via a `?v=<savedAt>` query param, so a
      // long private max-age is safe: a changed diagram changes the URL.
      return svgImage(svg, 'private, max-age=86400');
    }
  }

  const subResp = await handleDiagramSubresources(ctx);
  if (subResp) return subResp;

  // Realtime-room admission (spec/11): the one-time WS ticket mint +
  // the Durable Object upgrade — see diagram-room-routes.ts.
  const roomResp = await handleDiagramRoomRoutes(ctx);
  if (roomResp) return roomResp;

  // /api/diagrams/<id>/log — owner OR edit-role share-code holder.
  //   GET  → newest-first list of audit entries (capped at 200).
  //   POST → append a new entry. Body is a ChangeLogEntryDTO.
  // See specs/12-activity-and-audit.md.
  if (segments.length === 4 && segments[3] === 'log') {
    const id = segments[2]!;
    const access = await requireDiagramAccess(ctx, id, 'edit');
    if (access instanceof Response) return access;

    if (request.method === 'GET') {
      const entries = await listChangeLog(env, id);
      // Redact each entry's author owner id for non-owners (spec/61 §6): it's
      // the same value a token / X-Owner-Id authenticates with, so a non-owner
      // edit collaborator must not be able to harvest it from the audit trail.
      // The owner still sees the real ids; display name / colour are untouched
      // (mirrors redactCommentAuthorIds + the diagram-DTO ownerId redaction).
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
        return json({ error: 'payload_too_large' }, { status: 413 });
      }
      const body = (await request.json()) as Partial<ChangeLogEntryDTO>;
      if (bodyExceedsCap(request, body, MAX_CHANGE_LOG_ENTRY_BYTES)) {
        return json({ error: 'payload_too_large' }, { status: 413 });
      }
      const entry = parseChangeLogEntryBody(body);
      if (!entry) return badRequest('missing change_log fields');
      // The entry's tab must belong to THIS diagram. The log is listed by
      // joining through diagram_tabs, so an unchecked tab id let an editor of
      // one diagram write rows into another diagram's activity panel. It is
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
      // comment-write paths apply. requireDiagramAccess already proved
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

  // /api/diagrams/<id>/log/<entryId> — owner OR edit-role share
  // visitor. DELETE drops a single log entry; called by Revert
  // and by the symmetric Undo path so the entry vanishes on the
  // canvas of every connected client.
  if (segments.length === 5 && segments[3] === 'log') {
    const id = segments[2]!;
    const entryId = segments[4]!;
    const access = await requireDiagramAccess(ctx, id, 'edit');
    if (access instanceof Response) return access;

    if (request.method === 'DELETE') {
      await deleteChangeLogEntry(env, id, entryId);
      return noContent();
    }
  }

  // /api/diagrams/<id>/log/tab/<tabId> — owner-only DELETE that
  // drops every log entry for a tab. Called by the live app when
  // it deletes a tab so the per-tab audit dies with the tab.
  if (segments.length === 6 && segments[3] === 'log' && segments[4] === 'tab') {
    const id = segments[2]!;
    const tabId = segments[5]!;
    const access = await requireOwnedDiagram(ctx, id);
    if (access instanceof Response) return access;

    if (request.method === 'DELETE') {
      await deleteChangeLogForTab(env, id, tabId);
      return noContent();
    }
  }

  return notFound();
}
