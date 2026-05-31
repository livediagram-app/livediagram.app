import type { Tab } from '@livediagram/diagram';
import {
  createFolder,
  createShareLink,
  deleteChangeLogEntry,
  deleteChangeLogForTab,
  deleteDiagram,
  deleteFolder,
  deleteShareLink,
  deleteTabRow,
  folderMoveWouldCycle,
  generateShareCode,
  getDiagram,
  getDiagramByShareCode,
  getFolder,
  getParticipant,
  getShareLink,
  getTab,
  insertChangeLogEntry,
  listChangeLog,
  copyDiagram,
  deleteAccount,
  dropSharedAccess,
  listDiagramsByOwner,
  listFoldersByOwner,
  listSharedWith,
  migrateOwnerId,
  listShareLinks,
  recordSharedAccess,
  reorderTabs,
  setDiagramFolder,
  setDiagramShare,
  updateFolder,
  upsertDiagramMeta,
  upsertParticipant,
  upsertTab,
} from './db';
import { getClerkUserId } from './auth/clerk';
import { DiagramRoom } from './diagram-room';
import type { ChangeLogEntryDTO, DiagramDTO, Env, ParticipantDTO, ShareRole } from './types';

export { DiagramRoom };

// CORS for the browser. Live app runs at the same hostname as the API
// (router stitches them together) so this is mostly a safety net for
// local dev where origins may differ. Headers list is the minimum the
// live app sends today.
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  // `Authorization` carries the Clerk Bearer token (Stage 2 hybrid
  // auth — spec/04, spec/11). Without it in the allow-list every
  // signed-in cross-origin request fails the preflight and surfaces
  // to JS as "Failed to fetch", which was hiding behind DELETE
  // /api/account and any other authed call from localhost:3002 →
  // localhost:8787 in dev.
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Owner-Id, X-Share-Code',
  'Access-Control-Max-Age': '86400',
};

function json(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  for (const [k, v] of Object.entries(CORS_HEADERS)) headers.set(k, v);
  return new Response(JSON.stringify(body), { ...init, headers });
}

function notFound(): Response {
  return json({ error: 'not_found' }, { status: 404 });
}

function badRequest(msg: string): Response {
  return json({ error: 'bad_request', message: msg }, { status: 400 });
}

function forbidden(): Response {
  return json({ error: 'forbidden' }, { status: 403 });
}

// Returned whenever `resolveOwner()` yields null on a mutation /
// owner-scoped read. Owner can be null for two reasons under hybrid
// auth (spec/04):
//
//   1. Pure-guest path with no `X-Owner-Id` header sent.
//   2. A Bearer token was sent but verification failed silently
//      (expired, invalid signature, JWKS unreachable, etc.) —
//      `getClerkUserId` returns null on any error so the guest path
//      still serves.
//
// Pre-Clerk this used to be a flat "missing X-Owner-Id" message,
// which now misdirects signed-in users debugging an auth failure to
// look at the wrong header. The new message names both legitimate
// identity sources so the caller can tell which one they're missing.
function missingAuth(): Response {
  return badRequest('authentication required: send a valid Clerk Bearer token or X-Owner-Id');
}

function shareCodeOf(request: Request): string | null {
  return request.headers.get('X-Share-Code');
}

// True when the request is allowed to write to the given diagram —
// either the X-Owner-Id matches the diagram's ownerId, OR the
// caller provided an X-Share-Code that maps to an active edit-role
// share link for this diagram. Used by the audit-log endpoints so
// edit-role visitors can persist their own entries instead of
// vanishing on refresh. See specs/12-activity-and-audit.md.
async function canEditDiagram(
  env: Env,
  diagramId: string,
  owner: string | null,
  shareCode: string | null,
  ownerId: string,
): Promise<boolean> {
  if (owner && owner === ownerId) return true;
  if (!shareCode) return false;
  const link = await getShareLink(env, shareCode);
  if (!link) return false;
  if (link.diagramId !== diagramId) return false;
  return link.role === 'edit';
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const segments = url.pathname.replace(/^\//, '').split('/');
    if (segments[0] !== 'api') return notFound();

    // Hybrid identity (spec/04). Verify a Clerk Bearer token once at
    // the top of the handler — null when `CLERK_JWKS_URL` is unset,
    // no Bearer was sent, or the token failed verification. Every
    // dispatch site below uses `resolveOwner()` instead of the legacy
    // `ownerOf(request)`, so a signed-in user's diagrams come back
    // under their Clerk userId and guests keep working via the
    // legacy `X-Owner-Id` header.
    const clerkUserId = await getClerkUserId(env, request);
    const resolveOwner = (): string | null => clerkUserId ?? request.headers.get('X-Owner-Id');

    try {
      // ---------- /api/share/<code> ----------
      // Resolve a share code to its diagram + role. Used by visitors
      // landing on /live/diagram/shared?s=<code>. Returns 404 if the
      // code doesn't exist OR was revoked.
      if (segments[1] === 'share' && segments.length === 3) {
        const code = segments[2]!;
        if (request.method === 'GET') {
          // Primary: resolve through share_links so the code's role
          // (edit vs view) is carried back to the visitor.
          // Defensive fallback: a second share_links lookup gated on
          // diagrams.shareable so a code on a revoked-then-rewritten
          // diagram still 404s. Both legs query share_links — the
          // legacy diagrams.share_code column was dropped in
          // migration 0008.
          const link = await getShareLink(env, code);
          if (link) {
            const d = await getDiagram(env, link.diagramId);
            if (!d) return notFound();
            // Track the visit in shared_with so a "Shared with you"
            // list (#8) can surface this diagram later. Only record
            // when (a) the visitor identifies (Bearer or
            // X-Owner-Id) AND (b) they're not the diagram owner —
            // an owner opening their own share link shouldn't
            // appear in their own Shared list. Failure is silent;
            // resolving the share code is the user-visible thing,
            // tracking is a nice-to-have.
            const visitor = resolveOwner();
            if (visitor && visitor !== d.ownerId) {
              await recordSharedAccess(env, visitor, d.id, link.role).catch(() => {});
            }
            return json({ diagram: d, role: link.role });
          }
          const d = await getDiagramByShareCode(env, code);
          if (!d) return notFound();
          const visitor = resolveOwner();
          if (visitor && visitor !== d.ownerId) {
            await recordSharedAccess(env, visitor, d.id, 'edit' as ShareRole).catch(() => {});
          }
          return json({ diagram: d, role: 'edit' as ShareRole });
        }
      }

      // ---------- /api/shared ----------
      // List diagrams a non-owner has previously accessed via a
      // share link. Used by the Explorer's "Shared with you"
      // accordion. Per-owner; pure-guest path works because
      // shared_with rows are keyed off the resolved owner string.
      if (segments[1] === 'shared') {
        if (segments.length === 2) {
          if (request.method === 'GET') {
            const owner = resolveOwner();
            if (!owner) return missingAuth();
            const shared = await listSharedWith(env, owner);
            return json({ shared });
          }
        }
        // /api/shared/<diagramId> — dismiss / un-link.
        if (segments.length === 3) {
          const diagramId = segments[2]!;
          if (request.method === 'DELETE') {
            const owner = resolveOwner();
            if (!owner) return missingAuth();
            await dropSharedAccess(env, owner, diagramId);
            return json({ ok: true });
          }
        }
      }

      // ---------- /api/diagrams ----------
      if (segments[1] === 'diagrams') {
        if (segments.length === 2) {
          if (request.method === 'GET') {
            const owner = resolveOwner();
            if (!owner) return missingAuth();
            const diagrams = await listDiagramsByOwner(env, owner);
            return json({ diagrams });
          }
          if (request.method === 'POST') {
            const body = (await request.json()) as Partial<DiagramDTO> & { tabs?: Tab[] };
            const owner = resolveOwner();
            if (!owner) return missingAuth();
            if (!body.id || !body.name) {
              return badRequest('missing id/name');
            }
            const now = Date.now();
            // Diagram meta first so the FK in tabs can resolve.
            await upsertDiagramMeta(env, {
              id: body.id,
              ownerId: owner,
              name: body.name,
              shareable: body.shareable ?? false,
              shareCode: body.shareCode ?? null,
              folderId: body.folderId ?? null,
              savedAt: now,
              createdAt: body.createdAt ?? now,
            });
            // Seed tabs if the caller provided them. The live app's
            // welcome flow uses this when it commits a fresh diagram
            // id — it ships the templated tab inline so the very
            // first per-tab fetch already has data.
            if (Array.isArray(body.tabs)) {
              for (let i = 0; i < body.tabs.length; i++) {
                await upsertTab(env, body.id, body.tabs[i]!, i);
              }
            }
            const diagram = await getDiagram(env, body.id);
            return json({ diagram }, { status: 201 });
          }
        }

        // /api/diagrams/<id>
        if (segments.length === 3) {
          const id = segments[2]!;
          if (request.method === 'GET') {
            // Loading a diagram by raw id is an owner-only operation —
            // visitors should be using /api/share/:code instead. Without
            // this gate, any visitor with a guessed UUID could pull a
            // diagram they don't own. Mismatched owner returns 404
            // (not 403) so we don't leak the diagram's existence.
            const owner = resolveOwner();
            if (!owner) return missingAuth();
            const d = await getDiagram(env, id);
            return d && d.ownerId === owner ? json({ diagram: d }) : notFound();
          }
          if (request.method === 'PUT') {
            // Metadata-only PUT now that tabs live in their own table.
            // Body: { name?: string, tabIds?: string[] } — name renames
            // the diagram, tabIds reorders the tabs to match. Both are
            // optional, and at least one must be present.
            const body = (await request.json()) as { name?: string; tabIds?: string[] };
            const owner = resolveOwner();
            const shareCode = shareCodeOf(request);
            if (!owner) return missingAuth();
            const existing = await getDiagram(env, id);
            const now = Date.now();
            const ownerId = existing?.ownerId ?? owner;
            // Anyone with the diagram id could previously rewrite it.
            // We now gate on canEditDiagram so only the owner or an
            // edit-role share visitor can touch metadata.
            const allowed = existing
              ? await canEditDiagram(env, id, owner, shareCode, ownerId)
              : true; // create-on-first-write keeps the prior behaviour
            if (!allowed) return forbidden();
            await upsertDiagramMeta(env, {
              id,
              ownerId,
              name: body.name ?? existing?.name ?? 'Untitled diagram',
              shareable: existing?.shareable ?? false,
              shareCode: existing?.shareCode ?? null,
              folderId: existing?.folderId ?? null,
              savedAt: now,
              createdAt: existing?.createdAt ?? now,
            });
            if (Array.isArray(body.tabIds)) {
              await reorderTabs(env, id, body.tabIds);
            }
            const diagram = await getDiagram(env, id);
            return json({ diagram });
          }
          if (request.method === 'DELETE') {
            // Owner-only. Until this guard landed, any client that
            // knew or guessed a diagram id could DELETE it — the
            // endpoint took no auth headers and the handler called
            // `deleteDiagram(env, id)` unconditionally. Now we
            // resolve the caller (Clerk Bearer or X-Owner-Id, per
            // spec/04), 404 on a missing diagram (no existence
            // leak), and 403 on a mismatched owner. Mirrors the GET
            // branch above which had this guard from the start.
            const owner = resolveOwner();
            if (!owner) return missingAuth();
            const existing = await getDiagram(env, id);
            if (!existing) return notFound();
            if (existing.ownerId !== owner) return forbidden();
            await deleteDiagram(env, id);
            return new Response(null, { status: 204, headers: CORS_HEADERS });
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
            const owner = resolveOwner();
            if (!owner) return missingAuth();
            const source = await getDiagram(env, id);
            if (!source) return notFound();
            // Authorisation: any of the three valid paths above.
            // The share-code check mirrors canEditDiagram's logic;
            // we don't need full edit role for a read-then-copy
            // (view-role visitors can also fork their own copy).
            const code = shareCodeOf(request);
            let allowed = source.ownerId === owner;
            if (!allowed && code) {
              const link = await getShareLink(env, code);
              if (link && link.diagramId === id) allowed = true;
            }
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

        // /api/diagrams/<id>/folder — owner-only assignment to a folder
        // (or null for Unsorted). See spec/15. Folder existence + owner
        // match is validated before the write so we don't leave the
        // diagram pointing at a folder it can't see.
        if (segments.length === 4 && segments[3] === 'folder') {
          const id = segments[2]!;
          const owner = resolveOwner();
          if (!owner) return missingAuth();
          const existing = await getDiagram(env, id);
          if (!existing) return notFound();
          if (existing.ownerId !== owner) return forbidden();
          if (request.method === 'PUT') {
            const body = (await request.json()) as { folderId?: string | null };
            const folderId = body.folderId ?? null;
            if (folderId !== null) {
              const folder = await getFolder(env, folderId);
              if (!folder || folder.ownerId !== owner) return notFound();
            }
            await setDiagramFolder(env, id, folderId);
            return new Response(null, { status: 204, headers: CORS_HEADERS });
          }
        }

        // /api/diagrams/<id>/tabs/<tabId> — owner or edit-role visitor.
        //   GET    — full tab payload (data + everything).
        //   PUT    — upsert one tab. Body is a Tab. orderIndex falls
        //            through the existing row, or appends when new.
        //   DELETE — remove one tab.
        if (segments.length === 5 && segments[3] === 'tabs') {
          const id = segments[2]!;
          const tabId = segments[4]!;
          const owner = resolveOwner();
          const shareCode = shareCodeOf(request);
          if (!owner) return missingAuth();
          const existing = await getDiagram(env, id);
          if (!existing) return notFound();
          const allowed = await canEditDiagram(env, id, owner, shareCode, existing.ownerId);
          if (!allowed) return forbidden();

          if (request.method === 'GET') {
            const tab = await getTab(env, id, tabId);
            return tab ? json({ tab }) : notFound();
          }
          if (request.method === 'PUT') {
            const body = (await request.json()) as Tab;
            if (!body.id || !body.name || !Array.isArray(body.elements)) {
              return badRequest('missing tab id/name/elements');
            }
            // Find the existing order index; append if new.
            const existingTab = await getTab(env, id, tabId);
            const orderIndex = existingTab?.orderIndex ?? existing.tabs.length; // tabs[] is already summaries
            await upsertTab(env, id, { ...body, id: tabId }, orderIndex);
            const tab = await getTab(env, id, tabId);
            return tab ? json({ tab }) : notFound();
          }
          if (request.method === 'DELETE') {
            await deleteTabRow(env, id, tabId);
            return new Response(null, { status: 204, headers: CORS_HEADERS });
          }
        }

        // /api/diagrams/<id>/share — owner-only.
        //   GET     — list every share link for this diagram.
        //   POST    — mint a new link. Body: { role: 'edit' | 'view' }
        //   DELETE  — revoke every link (back-compat with the
        //             single-code era).
        if (segments.length === 4 && segments[3] === 'share') {
          const id = segments[2]!;
          const owner = resolveOwner();
          if (!owner) return missingAuth();
          const existing = await getDiagram(env, id);
          if (!existing) return notFound();
          if (existing.ownerId !== owner) return forbidden();

          if (request.method === 'GET') {
            const links = await listShareLinks(env, id);
            return json({ links });
          }
          if (request.method === 'POST') {
            const body = (await request.json().catch(() => ({}))) as { role?: ShareRole };
            const role: ShareRole = body.role === 'view' ? 'view' : 'edit';
            const code = generateShareCode();
            const link = await createShareLink(env, id, code, role);
            return json({ link }, { status: 201 });
          }
          if (request.method === 'DELETE') {
            // Bulk-revoke: drop every link AND flip legacy shareable
            // off so the live app stops opening the room.
            const links = await listShareLinks(env, id);
            for (const link of links) await deleteShareLink(env, link.code);
            await setDiagramShare(env, id, false);
            return json({ shareable: false, shareCode: null });
          }
        }

        // /api/diagrams/<id>/share/<code> — revoke one specific link.
        if (segments.length === 5 && segments[3] === 'share') {
          const id = segments[2]!;
          const code = segments[4]!;
          const owner = resolveOwner();
          if (!owner) return missingAuth();
          const existing = await getDiagram(env, id);
          if (!existing) return notFound();
          if (existing.ownerId !== owner) return forbidden();

          if (request.method === 'DELETE') {
            await deleteShareLink(env, code);
            return new Response(null, { status: 204, headers: CORS_HEADERS });
          }
        }

        // /api/diagrams/<id>/ws — Durable Object WebSocket
        if (segments.length === 4 && segments[3] === 'ws') {
          const id = segments[2]!;
          const stub = env.DIAGRAM_ROOM.get(env.DIAGRAM_ROOM.idFromName(id));
          return stub.fetch(request);
        }

        // /api/diagrams/<id>/log — owner OR edit-role share-code holder.
        //   GET  → newest-first list of audit entries (capped at 200).
        //   POST → append a new entry. Body is a ChangeLogEntryDTO.
        // See specs/12-activity-and-audit.md.
        if (segments.length === 4 && segments[3] === 'log') {
          const id = segments[2]!;
          const owner = resolveOwner();
          const shareCode = shareCodeOf(request);
          if (!owner) return missingAuth();
          const existing = await getDiagram(env, id);
          if (!existing) return notFound();
          const allowed = await canEditDiagram(env, id, owner, shareCode, existing.ownerId);
          if (!allowed) return forbidden();

          if (request.method === 'GET') {
            const entries = await listChangeLog(env, id);
            return json({ entries });
          }
          if (request.method === 'POST') {
            const body = (await request.json()) as Partial<ChangeLogEntryDTO>;
            if (
              !body.id ||
              !body.participantId ||
              !body.participantName ||
              !body.participantColor ||
              !body.kind ||
              !body.summary ||
              !Array.isArray(body.elementIds) ||
              typeof body.beforeState !== 'object' ||
              typeof body.afterState !== 'object'
            ) {
              return badRequest('missing change_log fields');
            }
            const entry: ChangeLogEntryDTO = {
              id: body.id,
              tabId: body.tabId ?? null,
              participantId: body.participantId,
              participantName: body.participantName,
              participantColor: body.participantColor,
              kind: body.kind,
              summary: body.summary,
              elementIds: body.elementIds,
              beforeState: (body.beforeState ?? {}) as Record<string, unknown>,
              afterState: (body.afterState ?? {}) as Record<string, unknown>,
              createdAt: body.createdAt ?? Date.now(),
            };
            await insertChangeLogEntry(env, entry);
            return json({ entry }, { status: 201 });
          }
        }

        // /api/diagrams/<id>/log/<entryId> — owner OR edit-role share
        // visitor. DELETE drops a single log entry; called by Revert
        // and by the symmetric Undo path so the entry vanishes on the
        // canvas of every connected client.
        if (segments.length === 5 && segments[3] === 'log') {
          const id = segments[2]!;
          const entryId = segments[4]!;
          const owner = resolveOwner();
          const shareCode = shareCodeOf(request);
          if (!owner) return missingAuth();
          const existing = await getDiagram(env, id);
          if (!existing) return notFound();
          const allowed = await canEditDiagram(env, id, owner, shareCode, existing.ownerId);
          if (!allowed) return forbidden();

          if (request.method === 'DELETE') {
            await deleteChangeLogEntry(env, entryId);
            return new Response(null, { status: 204, headers: CORS_HEADERS });
          }
        }

        // /api/diagrams/<id>/log/tab/<tabId> — owner-only DELETE that
        // drops every log entry for a tab. Called by the live app when
        // it deletes a tab so the per-tab audit dies with the tab.
        if (segments.length === 6 && segments[3] === 'log' && segments[4] === 'tab') {
          const id = segments[2]!;
          const tabId = segments[5]!;
          const owner = resolveOwner();
          if (!owner) return missingAuth();
          const existing = await getDiagram(env, id);
          if (!existing) return notFound();
          if (existing.ownerId !== owner) return forbidden();

          if (request.method === 'DELETE') {
            await deleteChangeLogForTab(env, tabId);
            return new Response(null, { status: 204, headers: CORS_HEADERS });
          }
        }
      }

      // ---------- /api/folders ----------
      // Owner-scoped folder tree. See spec/15-folders.md.
      if (segments[1] === 'folders') {
        const owner = resolveOwner();
        if (!owner) return missingAuth();

        // /api/folders — list / create
        if (segments.length === 2) {
          if (request.method === 'GET') {
            const folders = await listFoldersByOwner(env, owner);
            return json({ folders });
          }
          if (request.method === 'POST') {
            const body = (await request.json()) as {
              id?: string;
              name?: string;
              parentId?: string | null;
            };
            if (!body.id || !body.name) return badRequest('missing id/name');
            const parentId = body.parentId ?? null;
            // Parent must exist and belong to the same owner before we
            // accept it — otherwise the tree could grow into another
            // user's folders.
            if (parentId) {
              const parent = await getFolder(env, parentId);
              if (!parent || parent.ownerId !== owner) return notFound();
            }
            const folder = await createFolder(env, {
              id: body.id,
              ownerId: owner,
              parentId,
              name: body.name,
            });
            return json({ folder }, { status: 201 });
          }
        }

        // /api/folders/<id> — update / delete
        if (segments.length === 3) {
          const id = segments[2]!;
          const existing = await getFolder(env, id);
          if (!existing) return notFound();
          if (existing.ownerId !== owner) return forbidden();
          if (request.method === 'PUT') {
            const body = (await request.json()) as {
              name?: string;
              parentId?: string | null;
            };
            // Cycle check on reparent: refusing here keeps the tree
            // walk in `listFoldersByOwner` consumers bounded.
            if (body.parentId !== undefined && body.parentId !== null) {
              const newParent = await getFolder(env, body.parentId);
              if (!newParent || newParent.ownerId !== owner) return notFound();
              if (await folderMoveWouldCycle(env, id, body.parentId)) {
                return json({ error: 'cycle' }, { status: 409 });
              }
            }
            await updateFolder(env, id, { name: body.name, parentId: body.parentId });
            const updated = await getFolder(env, id);
            return json({ folder: updated });
          }
          if (request.method === 'DELETE') {
            await deleteFolder(env, id);
            return new Response(null, { status: 204, headers: CORS_HEADERS });
          }
        }
      }

      // ---------- /api/account ----------
      // Account self-deletion. Clerk-only — no X-Owner-Id fallback,
      // because the entire purpose is to wipe data bound to a
      // verified Clerk identity. The client then calls Clerk's
      // `user.delete()` to drop the Clerk record too; the order
      // (backend first, then Clerk) means a Clerk-delete failure
      // leaves the user signed in but with empty data, which they
      // can recover from by re-signing-out — vs. losing access to
      // Clerk but leaving orphaned rows in D1. Idempotent: re-
      // calling with the same Clerk id is a no-op once the rows
      // are gone.
      if (segments[1] === 'account' && segments.length === 2) {
        if (request.method === 'DELETE') {
          if (!clerkUserId) return forbidden();
          const deleted = await deleteAccount(env, clerkUserId);
          return json({ deleted });
        }
      }

      // ---------- /api/migrate ----------
      // Guest → authed ownership migration. Called from the live
      // app's sign-up flow once Clerk reports a session; moves
      // every `diagrams.owner_id` and `folders.owner_id` row from
      // the caller's localStorage participant id (`guestOwnerId`)
      // to their verified Clerk userId. Clerk-only — there is no
      // X-Owner-Id fallback here, because the entire purpose of
      // this endpoint is to lock data behind a Clerk account.
      // Idempotent: a second call with the same `guestOwnerId`
      // simply moves zero rows.
      if (segments[1] === 'migrate' && segments.length === 2) {
        if (request.method === 'POST') {
          if (!clerkUserId) return forbidden();
          const body = (await request.json().catch(() => null)) as {
            guestOwnerId?: string;
          } | null;
          const fromOwnerId = body?.guestOwnerId?.trim();
          if (!fromOwnerId) return badRequest('guestOwnerId is required');
          if (fromOwnerId === clerkUserId) {
            // Nothing to do — the guest id already matches the
            // Clerk userId (e.g. retry after a successful run).
            return json({ migrated: { diagrams: 0, folders: 0 } });
          }
          const migrated = await migrateOwnerId(env, fromOwnerId, clerkUserId);
          return json({ migrated });
        }
      }

      // ---------- /api/participants/<id> ----------
      //
      // GET stays open — participant ids are already broadcast through
      // the WS room and embedded in change-log rows, so anyone in a
      // shared session can already learn the id; the endpoint just
      // exposes display name + colour, which the same shared session
      // surfaces in every cursor / activity entry anyway.
      //
      // PUT is owner-only on the participant. Without this guard any
      // caller who knew (or guessed) another participant's id could
      // rewrite their display name + colour — and because change-log
      // rows store name + colour denormalised at write time, that
      // vandalism would propagate across every diagram they'd
      // collaborated on. The guard requires the caller's resolved
      // owner (Clerk Bearer OR X-Owner-Id, spec/04) to match the
      // participant id being mutated.
      if (segments[1] === 'participants' && segments.length === 3) {
        const id = segments[2]!;
        if (request.method === 'GET') {
          const p = await getParticipant(env, id);
          return p ? json({ participant: p }) : notFound();
        }
        if (request.method === 'PUT') {
          const owner = resolveOwner();
          if (!owner) return missingAuth();
          if (owner !== id) return forbidden();
          const body = (await request.json()) as Partial<ParticipantDTO>;
          if (!body.name || !body.color) return badRequest('missing name/color');
          const existing = await getParticipant(env, id);
          const now = Date.now();
          const p: ParticipantDTO = {
            id,
            name: body.name,
            color: body.color,
            createdAt: existing?.createdAt ?? now,
          };
          await upsertParticipant(env, p);
          return json({ participant: p });
        }
      }
    } catch (err) {
      console.error('api error', err);
      return json(
        { error: 'internal_error', message: String((err as Error).message ?? err) },
        { status: 500 },
      );
    }

    return notFound();
  },
} satisfies ExportedHandler<Env>;
