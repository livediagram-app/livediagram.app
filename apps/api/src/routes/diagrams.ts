// /api/diagrams — diagram metadata, per-tab content, copy, folder
// assignment, tab linking, comments, share links, the realtime WS
// upgrade, and the change-log. The largest resource: every sub-path
// under a diagram id lives here.

import type { Tab } from '@livediagram/diagram';
import { parseChangeLogEntryBody } from '../change-log-body';
import { timingSafeEqual } from '../auth/timing-safe';
import {
  findComment,
  redactCommentAuthorIds,
  removeComment,
  rewriteCommentAuthors,
} from '../comments';
import {
  copyDiagram,
  createShareLink,
  deleteChangeLogEntry,
  deleteChangeLogForTab,
  deleteDiagram,
  deleteShareLink,
  deleteTabRow,
  diagramsContainingTab,
  extendShareLink,
  generateShareCode,
  getDiagram,
  getDiagramSharePassword,
  getFolder,
  getMembership,
  getParticipant,
  getShareLink,
  getShareLinkIncludingExpired,
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
import { badRequest, forbidden, json, noContent, notFound } from '../responses';
import type { ShareLinkExpiry } from '@livediagram/api-schema';
import type { ChangeLogEntryDTO, DiagramDTO, ShareRole } from '../types';
import {
  gateEdit,
  gateRead,
  requireDiagramAccess,
  requireOwnedDiagram,
  requireOwner,
  type RouteContext,
} from './context';

export async function handleDiagrams(ctx: RouteContext): Promise<Response> {
  const { request, env, url, segments } = ctx;
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
      const owner = requireOwner(ctx);
      if (owner instanceof Response) return owner;
      const d = await getDiagram(env, id);
      return d && d.ownerId === owner ? json({ diagram: d }) : notFound();
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
      const existing = await getDiagram(env, id);
      const now = Date.now();
      const ownerId = existing?.ownerId ?? owner;
      // Anyone with the diagram id could previously rewrite it.
      // We now gate on canEditDiagram so only the owner or an
      // edit-role share visitor can touch metadata.
      const allowed = existing ? await gateEdit(ctx, id, ownerId, existing.teamId) : true; // create-on-first-write keeps the prior behaviour
      if (!allowed) return forbidden();
      await upsertDiagramMeta(env, {
        id,
        ownerId,
        name: body.name ?? existing?.name ?? 'Untitled diagram',
        shareable: existing?.shareable ?? false,
        shareCode: existing?.shareCode ?? null,
        folderId: existing?.folderId ?? null,
        teamId: existing?.teamId ?? null,
        savedAt: now,
        createdAt: existing?.createdAt ?? now,
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
      // Owner-only. Until this guard landed, any client that
      // knew or guessed a diagram id could DELETE it — the
      // endpoint took no auth headers and the handler called
      // `deleteDiagram(env, id)` unconditionally. Now we
      // resolve the caller (Clerk Bearer or X-Owner-Id, per
      // spec/04), 404 on a missing diagram (no existence
      // leak), and 403 on a mismatched owner. Mirrors the GET
      // branch above which had this guard from the start.
      const existing = await requireOwnedDiagram(ctx, id);
      if (existing instanceof Response) return existing;
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

  // /api/diagrams/<id>/folder — placement (spec/15 + spec/35). Body:
  // { folderId, teamId? }. A team diagram is managed by every joined
  // member (spec/35), so the rules are by membership, not ownership:
  //   - INTO a team (or between teams): caller must be a joined
  //     member of the destination team; if the diagram is currently
  //     personal, only its owner may file it into a team; if it's in
  //     another team, the caller must be a joined member of that team
  //     too.
  //   - WITHIN the current team: any joined member may re-folder it.
  //   - OUT of a team to personal: any joined member may move it into
  //     THEIR OWN personal library; ownership transfers to the mover
  //     (folders are owner-scoped, so the row follows). The owner
  //     moving it out keeps ownership.
  //   - A purely personal move (no team on either side) stays owner-
  //     only.
  // Folder existence + scope match is validated before the write so
  // the diagram never points at a folder outside its scope.
  if (segments.length === 4 && segments[3] === 'folder') {
    const id = segments[2]!;
    if (request.method === 'PUT') {
      const owner = requireOwner(ctx);
      if (owner instanceof Response) return owner;
      const existing = await getDiagram(env, id);
      if (!existing) return notFound();
      const body = (await request.json()) as { folderId?: string | null; teamId?: string | null };
      const folderId = body.folderId ?? null;
      const teamId = body.teamId !== undefined ? body.teamId : existing.teamId;
      const isOwner = existing.ownerId === owner;
      const caller = ctx.clerkUserId;

      if (teamId !== existing.teamId) {
        // Changing scope.
        if (teamId !== null) {
          // Into a team / between teams: joined member of the
          // destination. A personal diagram can only be filed in by
          // its owner; a team diagram can be moved by any joined
          // member of its current team.
          if (!caller) return forbidden();
          const dest = await getMembership(env, teamId, caller);
          if (dest?.status !== 'joined') return forbidden();
          if (existing.teamId === null) {
            if (!isOwner) return forbidden();
          } else {
            const src = await getMembership(env, existing.teamId, caller);
            if (src?.status !== 'joined') return forbidden();
          }
        } else if (!isOwner) {
          // Out of a team to personal: any joined member of the
          // current team (it becomes the mover's personal diagram).
          if (!caller || !existing.teamId) return forbidden();
          const membership = await getMembership(env, existing.teamId, caller);
          if (membership?.status !== 'joined') return forbidden();
        }
      } else if (!isOwner) {
        // Same scope, non-owner: only legal inside a team the caller
        // has joined (re-foldering a teammate's diagram).
        if (!caller || !existing.teamId) return forbidden();
        const membership = await getMembership(env, existing.teamId, caller);
        if (membership?.status !== 'joined') return forbidden();
      }

      // A non-owner moving a team diagram out to personal takes
      // ownership (spec/35): the diagram lands in the mover's library.
      const movingOutToPersonal = teamId === null && existing.teamId !== null;
      const newOwnerId = movingOutToPersonal && !isOwner ? caller! : undefined;
      // Whose personal folder a personal placement must belong to.
      const personalOwner = newOwnerId ?? existing.ownerId;

      if (folderId !== null) {
        const folder = await getFolder(env, folderId);
        if (!folder) return notFound();
        // Scope match: personal placement needs that owner's personal
        // folder; team placement needs a folder of that team.
        if (teamId === null && (folder.teamId !== null || folder.ownerId !== personalOwner)) {
          return notFound();
        }
        if (teamId !== null && folder.teamId !== teamId) return notFound();
      }
      await setDiagramFolder(env, id, folderId, teamId, newOwnerId);
      return noContent();
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
    const owner = requireOwner(ctx);
    if (owner instanceof Response) return owner;
    const existing = await getDiagram(env, id);
    if (!existing) return notFound();

    if (request.method === 'GET') {
      const allowed = await gateRead(ctx, id, existing.ownerId, existing.teamId);
      if (!allowed) return forbidden();
      const tab = await getTab(env, id, tabId);
      if (!tab) return notFound();
      // Blank other people's comment author ids before handing the tab
      // to a non-owner: a visitor should only ever see their OWN author
      // id (so they can delete-own), never another participant's owner
      // id. The diagram owner sees everything (viewerId === ownerId is a
      // no-op). Same anti-claim posture as redactOwner on the diagram.
      const safe =
        owner === existing.ownerId
          ? tab
          : { ...tab, elements: redactCommentAuthorIds(tab.elements, owner) };
      return json({ tab: safe });
    }

    // Writes below: owner or edit-role share visitor only.
    const allowed = await gateEdit(ctx, id, existing.ownerId, existing.teamId);
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
      return noContent();
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
    const owner = requireOwner(ctx);
    if (owner instanceof Response) return owner;
    const existing = await getDiagram(env, id);
    if (!existing) return notFound();
    const allowed = await gateRead(ctx, id, existing.ownerId, existing.teamId);
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
      // Stamp the writer's stable id so they (and only they) can later
      // delete this comment via the DELETE endpoint below. Server-set,
      // never read from the client.
      authorId: owner,
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

  // DELETE /api/diagrams/<id>/tabs/<tabId>/comments/<commentId> —
  // delete a SINGLE comment you authored. Read-role visitors are
  // allowed (gateRead, like the POST above) so a view-only collaborator
  // can remove their own comment without edit rights — but only their
  // own: the comment's server-stamped authorId must equal the caller.
  // Owners / edit-role visitors also use this for delete-own; deleting
  // SOMEONE ELSE'S comment still goes through the edit-gated tab PUT.
  if (
    segments.length === 7 &&
    segments[3] === 'tabs' &&
    segments[5] === 'comments' &&
    request.method === 'DELETE'
  ) {
    const id = segments[2]!;
    const tabId = segments[4]!;
    const commentId = segments[6]!;
    const owner = requireOwner(ctx);
    if (owner instanceof Response) return owner;
    const existing = await getDiagram(env, id);
    if (!existing) return notFound();
    const allowed = await gateRead(ctx, id, existing.ownerId, existing.teamId);
    if (!allowed) return forbidden();
    const tab = await getTab(env, id, tabId);
    if (!tab) return notFound();
    // Locate the comment + confirm authorship before mutating anything.
    const found = findComment(tab.elements, commentId);
    if (!found) return notFound();
    // Delete-own only. The diagram owner may also delete their own
    // comments here; removing other people's requires the edit-gated
    // tab PUT. Mismatched author is forbidden (not 404) — the caller
    // can see the comment exists, they just can't delete it.
    if (found.authorId !== owner) return forbidden();
    const updatedElements = removeComment(tab.elements, commentId);
    await upsertTab(env, id, { ...tab, elements: updatedElements }, tab.orderIndex);
    return noContent();
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
    const owner = requireOwner(ctx);
    if (owner instanceof Response) return owner;
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
    const access = await requireOwnedDiagram(ctx, id);
    if (access instanceof Response) return access;

    if (request.method === 'GET') {
      // Owner-only response, so it's safe to return the share password
      // in the clear — this is how the Share dialog shows it (spec/24).
      const links = await listShareLinks(env, id);
      const password = await getDiagramSharePassword(env, id);
      return json({ links, password });
    }
    if (request.method === 'POST') {
      const body = (await request.json().catch(() => ({}))) as {
        role?: ShareRole;
        expiry?: ShareLinkExpiry;
      };
      const role: ShareRole = body.role === 'view' ? 'view' : 'edit';
      // Expiry (spec/34): unknown / missing value falls back to the
      // pre-expiry behaviour, a link that works until revoked.
      const expiry: ShareLinkExpiry =
        body.expiry === 'week' || body.expiry === 'month' || body.expiry === 'sixMonths'
          ? body.expiry
          : 'never';
      const code = generateShareCode();
      const link = await createShareLink(env, id, code, role, expiry);
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
    const access = await requireOwnedDiagram(ctx, id);
    if (access instanceof Response) return access;

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
    const access = await requireOwnedDiagram(ctx, id);
    if (access instanceof Response) return access;

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
      return noContent();
    }
  }

  // /api/diagrams/<id>/share/<code>/extend — re-arm an expiring link
  // for another round of its creation-time duration (spec/34).
  // Owner-only; works whether the link is currently active or expired
  // (extending an active link pushes the deadline out from now); 400
  // on a never-expiring link (nothing to extend).
  if (segments.length === 6 && segments[3] === 'share' && segments[5] === 'extend') {
    const id = segments[2]!;
    const code = segments[4]!;
    const access = await requireOwnedDiagram(ctx, id);
    if (access instanceof Response) return access;

    if (request.method === 'POST') {
      const existing = await getShareLinkIncludingExpired(env, code);
      if (!existing || existing.diagramId !== id) return notFound();
      const link = await extendShareLink(env, code);
      if (!link) return badRequest('link never expires');
      return json({ link });
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
      // Team diagrams (spec/35): a claimed id that is a JOINED member
      // of the diagram's team gets edit, same trust level as the
      // owner-id match above (WS upgrades can't carry the Bearer).
      if (!role && diagram?.teamId && claimedOwnerId) {
        const membership = await getMembership(env, diagram.teamId, claimedOwnerId);
        if (membership?.status === 'joined') role = 'edit';
      }
    }
    // Refuse the upgrade unless the caller is the owner or holds a valid
    // share code for THIS diagram. Without this, a diagram with no share
    // password forwarded every upgrade (role === null) to the room, so
    // anyone who learned the diagram id could read live ops; and the DO
    // additionally drops op frames from non-edit sessions.
    if (!role) return forbidden();
    // Password gate (spec/24): a non-owner joining the realtime room of
    // a password-protected diagram must carry the matching password on
    // the `p` query param (WS upgrades can't set headers). Owners
    // bypass. A bad / missing password refuses the upgrade outright so
    // the room never even sees the peer.
    if (!isOwnerUpgrade) {
      const required = await getDiagramSharePassword(env, id);
      if (required && !(await timingSafeEqual(url.searchParams.get('p') ?? '', required)))
        return forbidden();
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
    const access = await requireDiagramAccess(ctx, id, 'edit');
    if (access instanceof Response) return access;

    if (request.method === 'GET') {
      const entries = await listChangeLog(env, id);
      return json({ entries });
    }
    if (request.method === 'POST') {
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
