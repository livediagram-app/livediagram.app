import type { Tab } from '@livediagram/diagram';
import {
  createShareLink,
  deleteChangeLogEntry,
  deleteChangeLogForTab,
  deleteDiagram,
  deleteShareLink,
  deleteTabRow,
  generateShareCode,
  getDiagram,
  getDiagramByShareCode,
  getParticipant,
  getShareLink,
  getTab,
  insertChangeLogEntry,
  listChangeLog,
  listDiagramsByOwner,
  listShareLinks,
  reorderTabs,
  setDiagramShare,
  upsertDiagramMeta,
  upsertParticipant,
  upsertTab,
} from './db';
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
  'Access-Control-Allow-Headers': 'Content-Type, X-Owner-Id, X-Share-Code',
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

function ownerOf(request: Request): string | null {
  return request.headers.get('X-Owner-Id');
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

    try {
      // ---------- /api/share/<code> ----------
      // Resolve a share code to its diagram + role. Used by visitors
      // landing on /live?s=<code>. Returns 404 if the code doesn't
      // exist OR was revoked.
      if (segments[1] === 'share' && segments.length === 3) {
        const code = segments[2]!;
        if (request.method === 'GET') {
          // Prefer share_links so multi-link diagrams resolve any of
          // their codes; fall back to the legacy column for diagrams
          // that pre-date migration 0003 and somehow didn't get
          // backfilled.
          const link = await getShareLink(env, code);
          if (link) {
            const d = await getDiagram(env, link.diagramId);
            return d ? json({ diagram: d, role: link.role }) : notFound();
          }
          const d = await getDiagramByShareCode(env, code);
          return d ? json({ diagram: d, role: 'edit' as ShareRole }) : notFound();
        }
      }

      // ---------- /api/diagrams ----------
      if (segments[1] === 'diagrams') {
        if (segments.length === 2) {
          if (request.method === 'GET') {
            const owner = ownerOf(request);
            if (!owner) return badRequest('missing X-Owner-Id');
            const diagrams = await listDiagramsByOwner(env, owner);
            return json({ diagrams });
          }
          if (request.method === 'POST') {
            const body = (await request.json()) as Partial<DiagramDTO> & { tabs?: Tab[] };
            const owner = ownerOf(request);
            if (!owner) return badRequest('missing X-Owner-Id');
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
            const owner = ownerOf(request);
            if (!owner) return badRequest('missing X-Owner-Id');
            const d = await getDiagram(env, id);
            return d && d.ownerId === owner ? json({ diagram: d }) : notFound();
          }
          if (request.method === 'PUT') {
            // Metadata-only PUT now that tabs live in their own table.
            // Body: { name?: string, tabIds?: string[] } — name renames
            // the diagram, tabIds reorders the tabs to match. Both are
            // optional, and at least one must be present.
            const body = (await request.json()) as { name?: string; tabIds?: string[] };
            const owner = ownerOf(request);
            const shareCode = shareCodeOf(request);
            if (!owner) return badRequest('missing X-Owner-Id');
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
            await deleteDiagram(env, id);
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
          const owner = ownerOf(request);
          const shareCode = shareCodeOf(request);
          if (!owner) return badRequest('missing X-Owner-Id');
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
          const owner = ownerOf(request);
          if (!owner) return badRequest('missing X-Owner-Id');
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
            await setDiagramShare(env, id, false, null);
            return json({ shareable: false, shareCode: null });
          }
        }

        // /api/diagrams/<id>/share/<code> — revoke one specific link.
        if (segments.length === 5 && segments[3] === 'share') {
          const id = segments[2]!;
          const code = segments[4]!;
          const owner = ownerOf(request);
          if (!owner) return badRequest('missing X-Owner-Id');
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
          const owner = ownerOf(request);
          const shareCode = shareCodeOf(request);
          if (!owner) return badRequest('missing X-Owner-Id');
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
              diagramId: id,
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
          const owner = ownerOf(request);
          const shareCode = shareCodeOf(request);
          if (!owner) return badRequest('missing X-Owner-Id');
          const existing = await getDiagram(env, id);
          if (!existing) return notFound();
          const allowed = await canEditDiagram(env, id, owner, shareCode, existing.ownerId);
          if (!allowed) return forbidden();

          if (request.method === 'DELETE') {
            await deleteChangeLogEntry(env, id, entryId);
            return new Response(null, { status: 204, headers: CORS_HEADERS });
          }
        }

        // /api/diagrams/<id>/log/tab/<tabId> — owner-only DELETE that
        // drops every log entry for a tab. Called by the live app when
        // it deletes a tab so the per-tab audit dies with the tab.
        if (segments.length === 6 && segments[3] === 'log' && segments[4] === 'tab') {
          const id = segments[2]!;
          const tabId = segments[5]!;
          const owner = ownerOf(request);
          if (!owner) return badRequest('missing X-Owner-Id');
          const existing = await getDiagram(env, id);
          if (!existing) return notFound();
          if (existing.ownerId !== owner) return forbidden();

          if (request.method === 'DELETE') {
            await deleteChangeLogForTab(env, id, tabId);
            return new Response(null, { status: 204, headers: CORS_HEADERS });
          }
        }
      }

      // ---------- /api/participants/<id> ----------
      if (segments[1] === 'participants' && segments.length === 3) {
        const id = segments[2]!;
        if (request.method === 'GET') {
          const p = await getParticipant(env, id);
          return p ? json({ participant: p }) : notFound();
        }
        if (request.method === 'PUT') {
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
