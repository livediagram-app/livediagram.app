// /api/diagrams — diagram metadata, per-tab content, copy, folder
// assignment, tab linking, comments, share links, the realtime WS
// upgrade, and the change-log. The largest resource: every sub-path
// under a diagram id lives here.

import type { Tab } from '@livediagram/diagram';
import { canEditDiagram, canReadDiagram } from '../auth/diagram-access';
import { parseChangeLogEntryBody } from '../change-log-body';
import { rewriteCommentAuthors } from '../comments';
import {
  copyDiagram,
  createShareLink,
  deleteChangeLogEntry,
  deleteChangeLogForTab,
  deleteDiagram,
  deleteShareLink,
  deleteTabRow,
  diagramsContainingTab,
  generateShareCode,
  getDiagram,
  getDiagramSharePassword,
  getFolder,
  getParticipant,
  getShareLink,
  getTab,
  insertChangeLogEntry,
  linkTabToDiagram,
  listChangeLog,
  listDiagramsByOwner,
  listShareLinks,
  listSharedWith,
  reorderTabs,
  setDiagramFolder,
  setDiagramShare,
  setDiagramSharePassword,
  upsertDiagramMeta,
  upsertTab,
} from '../db';
import { badRequest, CORS_HEADERS, forbidden, json, missingAuth, notFound } from '../responses';
import type { ChangeLogEntryDTO, DiagramDTO, ShareRole } from '../types';
import { shareCodeOf, sharePasswordOf, type RouteContext } from './context';

export async function handleDiagrams(ctx: RouteContext): Promise<Response> {
  const { request, env, url, segments, resolveOwner } = ctx;
  if (segments[1] !== 'diagrams') return notFound();
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
        ? await canEditDiagram(env, id, owner, shareCode, ownerId, sharePasswordOf(request))
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
      // Authorisation: any of (a) owner, (b) holder of any
      // share code (view or edit) for this diagram, (c)
      // visitor with an active shared_with row for the source.
      // The owner + share-code legs are exactly canReadDiagram
      // (view-role visitors can fork their own copy, so this
      // is a read check, not an edit check). The third leg is
      // copy-specific so it stays inline.
      let allowed = await canReadDiagram(
        env,
        id,
        owner,
        shareCodeOf(request),
        source.ownerId,
        sharePasswordOf(request),
      );
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

  // /api/diagrams/<id>/tabs/<tabId>
  //   GET    — full tab payload. READ access: owner or ANY valid
  //            share code (view OR edit) for this diagram, so
  //            view-only visitors can load tab content (spec/04 +
  //            spec/13). This is a viewer's only path to content:
  //            the share resolve returns summaries, and the
  //            realtime room relays ops, not snapshots.
  //   PUT    — upsert one tab. Body is a Tab. orderIndex falls
  //            through the existing row, or appends when new.
  //   DELETE — remove one tab.
  //   PUT / DELETE are writes: owner or edit-role only.
  if (segments.length === 5 && segments[3] === 'tabs') {
    const id = segments[2]!;
    const tabId = segments[4]!;
    const owner = resolveOwner();
    const shareCode = shareCodeOf(request);
    if (!owner) return missingAuth();
    const existing = await getDiagram(env, id);
    if (!existing) return notFound();

    if (request.method === 'GET') {
      const allowed = await canReadDiagram(
        env,
        id,
        owner,
        shareCode,
        existing.ownerId,
        sharePasswordOf(request),
      );
      if (!allowed) return forbidden();
      const tab = await getTab(env, id, tabId);
      return tab ? json({ tab }) : notFound();
    }

    // Writes below: owner or edit-role share visitor only.
    const allowed = await canEditDiagram(
      env,
      id,
      owner,
      shareCode,
      existing.ownerId,
      sharePasswordOf(request),
    );
    if (!allowed) return forbidden();
    if (request.method === 'PUT') {
      const body = (await request.json()) as Tab;
      if (!body.id || !body.name || !Array.isArray(body.elements)) {
        return badRequest('missing tab id/name/elements');
      }
      // Find the existing order index; append if new.
      const existingTab = await getTab(env, id, tabId);
      const orderIndex = existingTab?.orderIndex ?? existing.tabs.length; // tabs[] is already summaries
      // Rewrite the author fields on any newly-added comment to
      // match the resolved owner's participant record. Without
      // this the client can claim any authorName / authorColor
      // and impersonate another participant in the comment
      // thread (see the spec/04 + spec/12 security audit
      // thread). Existing comments preserve their original
      // authors (compared by id against the prior tab).
      const writerParticipant = await getParticipant(env, owner);
      const sanitised = writerParticipant
        ? {
            ...body,
            elements: rewriteCommentAuthors(
              body.elements,
              existingTab?.elements ?? [],
              writerParticipant,
            ),
          }
        : body;
      await upsertTab(env, id, { ...sanitised, id: tabId }, orderIndex);
      const tab = await getTab(env, id, tabId);
      return tab ? json({ tab }) : notFound();
    }
    if (request.method === 'DELETE') {
      await deleteTabRow(env, id, tabId);
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }
  }

  // /api/diagrams/<id>/tabs/<tabId>/comments — append a comment
  // to an element's thread. Read-role visitors are allowed here
  // (the only write path open to view-role) so view-only
  // collaborators can chime in on a thread without being
  // promoted to edit. Owner / edit-role roles already get this
  // via the normal tab autosave; this endpoint short-circuits
  // that path so a view-role visitor's autosave (blocked) isn't
  // their only way to persist.
  if (
    segments.length === 6 &&
    segments[3] === 'tabs' &&
    segments[5] === 'comments' &&
    request.method === 'POST'
  ) {
    const id = segments[2]!;
    const tabId = segments[4]!;
    const owner = resolveOwner();
    const shareCode = shareCodeOf(request);
    if (!owner) return missingAuth();
    const existing = await getDiagram(env, id);
    if (!existing) return notFound();
    const allowed = await canReadDiagram(
      env,
      id,
      owner,
      shareCode,
      existing.ownerId,
      sharePasswordOf(request),
    );
    if (!allowed) return forbidden();
    let body: { elementId?: unknown; text?: unknown };
    try {
      body = (await request.json()) as { elementId?: unknown; text?: unknown };
    } catch {
      return badRequest('invalid json');
    }
    const elementId = typeof body.elementId === 'string' ? body.elementId : null;
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    if (!elementId) return badRequest('missing elementId');
    if (!text) return badRequest('missing text');
    if (text.length > 2000) return badRequest('text too long');
    const tab = await getTab(env, id, tabId);
    if (!tab) return notFound();
    const target = tab.elements.find((el) => el.id === elementId);
    if (!target || target.type === 'arrow') return notFound();
    const writer = await getParticipant(env, owner);
    const authorName = writer?.name ?? 'Anonymous';
    const authorColor = writer?.color ?? '#94a3b8';
    const comment = {
      id: crypto.randomUUID(),
      text,
      createdAt: Date.now(),
      authorName,
      authorColor,
    };
    const updatedElements = tab.elements.map((el) => {
      if (el.id !== elementId || el.type === 'arrow') return el;
      const thread = (el as { commentThread?: { comments: (typeof comment)[]; resolved: boolean } })
        .commentThread ?? { comments: [], resolved: false };
      return {
        ...el,
        commentThread: {
          comments: [...thread.comments, comment],
          // Adding a comment unresolves a resolved thread; same
          // rule as the editor's local addComment.
          resolved: false,
        },
      };
    });
    await upsertTab(env, id, { ...tab, elements: updatedElements }, tab.orderIndex);
    return json({ comment });
  }

  // /api/diagrams/<id>/tabs/<tabId>/link — owner only.
  //   POST — add an existing tab to this diagram (spec/17).
  // Auth: the caller must own this diagram AND own at least
  // one diagram that already contains the tab. The second
  // half stops a stranger from grafting a tab they have no
  // read access to. The `existing.ownerId !== owner` guard
  // above the dispatch (canEditDiagram on this diagram) only
  // covers the destination side.
  if (
    segments.length === 6 &&
    segments[3] === 'tabs' &&
    segments[5] === 'link' &&
    request.method === 'POST'
  ) {
    const id = segments[2]!;
    const tabId = segments[4]!;
    const owner = resolveOwner();
    if (!owner) return missingAuth();
    const existing = await getDiagram(env, id);
    if (!existing) return notFound();
    if (existing.ownerId !== owner) return forbidden();
    // The tab must already live in at least one of the
    // caller's owned diagrams. Iterating ids and looking up
    // ownership is fine at the < 20-tab / < 1000-diagram
    // scale we operate at; if that ever changes a single
    // JOIN against diagrams replaces the loop.
    const sourceIds = await diagramsContainingTab(env, tabId);
    if (sourceIds.length === 0) return notFound();
    let authorised = false;
    for (const sid of sourceIds) {
      const source = await getDiagram(env, sid);
      if (source && source.ownerId === owner) {
        authorised = true;
        break;
      }
    }
    if (!authorised) return forbidden();
    await linkTabToDiagram(env, id, tabId);
    // Return the tab summary the client uses to render the
    // new pill in its TabBar without re-fetching the whole
    // diagram. Pulled fresh so the order_index reflects the
    // append we just performed.
    const tab = await getTab(env, id, tabId);
    return tab ? json({ tab }) : notFound();
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
      // Owner-only response, so it's safe to return the share password
      // in the clear — this is how the Share dialog shows it (spec/24).
      const links = await listShareLinks(env, id);
      const password = await getDiagramSharePassword(env, id);
      return json({ links, password });
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

  // /api/diagrams/<id>/share-password — owner-only get/set of the
  // diagram's optional share password (spec/24). PUT body
  // { password: string | null }; null / empty clears it.
  if (segments.length === 4 && segments[3] === 'share-password') {
    const id = segments[2]!;
    const owner = resolveOwner();
    if (!owner) return missingAuth();
    const existing = await getDiagram(env, id);
    if (!existing) return notFound();
    if (existing.ownerId !== owner) return forbidden();

    if (request.method === 'PUT') {
      const body = (await request.json().catch(() => ({}))) as { password?: string | null };
      const password = typeof body.password === 'string' ? body.password : null;
      await setDiagramSharePassword(env, id, password);
      // Echo back the stored value (normalised: whitespace-only ->
      // null) so the dialog reflects exactly what gates access.
      return json({ password: await getDiagramSharePassword(env, id) });
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
      // Tell every connected peer in this diagram's room that
      // the code just got revoked so any viewer / editor who
      // hydrated with `X-Share-Code: <code>` can hard-redirect
      // instead of continuing to read a diagram they no longer
      // have access to. Fire-and-forget: the persistence above
      // is the authoritative revoke, the broadcast is UX.
      const stub = env.DIAGRAM_ROOM.get(env.DIAGRAM_ROOM.idFromName(id));
      stub
        .fetch('https://room/broadcast', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ op: { kind: 'share-revoked', code } }),
        })
        .catch(() => {});
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }
  }

  // /api/diagrams/<id>/ws — Durable Object WebSocket. Resolve
  // the visitor's role server-side before handing the request
  // to the DO so peer avatars can show "Editor" / "Viewer"
  // badges that the client can't lie about: clients sending a
  // crafted `hello` frame still get their role re-stamped from
  // the X-Verified-Role header below. Falls through to no role
  // when we can't resolve (e.g. owner request with no share
  // code and no auth) — the DO leaves role undefined and the
  // UI hides the badge for that peer.
  if (segments.length === 4 && segments[3] === 'ws') {
    const id = segments[2]!;
    const stub = env.DIAGRAM_ROOM.get(env.DIAGRAM_ROOM.idFromName(id));
    // Browsers can't put custom headers on a WebSocket upgrade,
    // so the client passes its share code / owner id as query
    // params (`?s=...&o=...`). We resolve role here and forward
    // it to the Durable Object via X-Verified-Role; the DO
    // ignores any role the client might set in its own hello
    // payload, so this header is the trust boundary.
    let role: 'edit' | 'view' | null = null;
    const claimedOwnerId = url.searchParams.get('o');
    const diagram = await getDiagram(env, id);
    const isOwnerUpgrade = !!(diagram && claimedOwnerId && claimedOwnerId === diagram.ownerId);
    if (isOwnerUpgrade) {
      role = 'edit';
    } else {
      const code = url.searchParams.get('s');
      if (code) {
        const link = await getShareLink(env, code);
        if (link && link.diagramId === id) role = link.role;
      }
    }
    // Password gate (spec/24): a non-owner joining the realtime room of
    // a password-protected diagram must carry the matching password on
    // the `p` query param (WS upgrades can't set headers). Owners
    // bypass. A bad / missing password refuses the upgrade outright so
    // the room never even sees the peer.
    if (!isOwnerUpgrade) {
      const required = await getDiagramSharePassword(env, id);
      if (required && url.searchParams.get('p') !== required) return forbidden();
    }
    const forwarded = new Request(request);
    if (role) forwarded.headers.set('X-Verified-Role', role);
    return stub.fetch(forwarded);
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
    const allowed = await canEditDiagram(
      env,
      id,
      owner,
      shareCode,
      existing.ownerId,
      sharePasswordOf(request),
    );
    if (!allowed) return forbidden();

    if (request.method === 'GET') {
      const entries = await listChangeLog(env, id);
      return json({ entries });
    }
    if (request.method === 'POST') {
      const body = (await request.json()) as Partial<ChangeLogEntryDTO>;
      const entry = parseChangeLogEntryBody(body);
      if (!entry) return badRequest('missing change_log fields');
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
    const allowed = await canEditDiagram(
      env,
      id,
      owner,
      shareCode,
      existing.ownerId,
      sharePasswordOf(request),
    );
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

  return notFound();
}
