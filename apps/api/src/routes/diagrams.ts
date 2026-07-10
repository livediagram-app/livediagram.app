// /api/diagrams — diagram metadata, per-tab content, copy, folder
// assignment, tab linking, comments, share links, the realtime WS
// upgrade, and the change-log. The largest resource: every sub-path
// under a diagram id lives here.

import type { Tab } from '@livediagram/diagram';
import { isValidTab } from '@livediagram/diagram';
import { MAX_CHANGE_LOG_ENTRY_BYTES, MAX_NAME_LEN, MAX_TAB_BYTES, byteLength } from '../limits';
import { parseChangeLogEntryBody } from '../change-log-body';
import {} from '../comments';
import {
  copyDiagram,
  deleteChangeLogEntry,
  deleteChangeLogForTab,
  deleteDiagram,
  getDiagram,
  countDiagramsByOwner,
  getMembership,
  getParticipant,
  insertChangeLogEntry,
  listChangeLog,
  listDiagramsByOwner,
  listSharedWith,
  reorderTabs,
  seedTabs,
  upsertDiagramMeta,
} from '../db';
import { badRequest, forbidden, json, noContent, notFound, svgImage } from '../responses';
import { getDiagramThumbnailSvg } from '../thumbnail';
import { emailEnabled } from '../email/client';
import { notifyMilestone } from '../email/notifications';
import { handleDiagramPlacement } from './diagram-placement-route';
import { handleDiagramRoomRoutes } from './diagram-room-routes';
import { handleDiagramSubresources } from './diagram-subresource-routes';
import type { ChangeLogEntryDTO, DiagramDTO } from '../types';
import {
  gateEdit,
  gateRead,
  requireDiagramAccess,
  requireOwnedDiagram,
  requireOwner,
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
      const now = Date.now();
      // Diagram meta first so the FK in tabs can resolve.
      await upsertDiagramMeta(env, {
        id: body.id,
        ownerId: owner,
        name: body.name,
        shareable: body.shareable ?? false,
        shareCode: body.shareCode ?? null,
        folderId: body.folderId ?? null,
        // Diagrams are always created personal; they move into a
        // team library via PUT /folder afterwards (spec/35).
        teamId: null,
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
      return allowed ? json({ diagram: d }) : notFound();
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
        savedAt: now,
        createdAt: existing.createdAt,
      });
      // Prefer the folder-carrying `tabs` shape; fall back to the
      // legacy `tabIds` (treated as loose) so older clients keep working.
      if (Array.isArray(body.tabs)) {
        await reorderTabs(env, id, body.tabs);
      } else if (Array.isArray(body.tabIds)) {
        await reorderTabs(env, id, body.tabIds);
      }
      const diagram = await getDiagram(env, id);
      return json({ diagram });
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
      let allowed = owner === existing.ownerId;
      if (!allowed && existing.teamId && ctx.verifiedUserId) {
        const membership = await getMembership(env, existing.teamId, ctx.verifiedUserId);
        allowed = membership?.status === 'joined';
      }
      if (!allowed) return forbidden();
      await deleteDiagram(env, id);
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
      // Per-entry byte cap: only the 8MB outer body cap applied before,
      // so 30 huge entries could balloon the capped list response.
      const lenHeader = Number(request.headers.get('content-length'));
      if (Number.isFinite(lenHeader) && lenHeader > MAX_CHANGE_LOG_ENTRY_BYTES) {
        return json({ error: 'payload_too_large' }, { status: 413 });
      }
      const body = (await request.json()) as Partial<ChangeLogEntryDTO>;
      const entry = parseChangeLogEntryBody(body);
      if (!entry) return badRequest('missing change_log fields');
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
