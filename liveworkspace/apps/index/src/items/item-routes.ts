// One item's routes, /items/:id and below (items.ts): reading, renaming and moving, the Trash, copies and grants.

import { inTeamNow } from '../fresh-teams';
import { TITLE_MAX } from '@liveworkspace/index-client';
import { loadItem } from '../access';
import { archiveItem, isArchived, archivedRefusal } from '../archive';
import { callApp } from '../app-calls';
import { archivedScope, scopeOf } from '../auth';
import { touchItem } from '../drive';
import type { RouteContext } from '../context';
import { readName, getFolderRow } from '../folders';
import { mintGrant } from '../grants';
import { notFound, json, readObject, badRequest, forbidden, noContent, fail } from '../http';
import { purgeRows, drainTombstonesSoon } from '../purge';
import { type ItemRow, type Access, getItemRow } from '../rows';
import { eventStatements } from '../events';
import { itemHistory } from '../history';
import { recordVisitorCopy, recordVisitorOpen } from '../visitors';
import { recordOpen } from './opens';
import { insertItem, itemFor, optionalId } from './create';
import { clientIpOf } from './shared';
import { tellStanding } from '../standing';

export async function handleItem(ctx: RouteContext, id: string): Promise<Response> {
  const { request, segments } = ctx;
  const method = request.method;
  const sub = segments[2];

  if (segments.length === 2) {
    if (method === 'GET') return getItem(ctx, id);
    if (method === 'PATCH') return updateItem(ctx, id);
    if (method === 'DELETE') return deleteItem(ctx, id);
  }
  if (segments.length === 3 && method === 'GET' && sub === 'history') return itemHistory(ctx, id);
  if (segments.length === 3 && method === 'POST') {
    if (sub === 'restore') return restoreItem(ctx, id);
    if (sub === 'copy') return copyItem(ctx, id);
    if (sub === 'open') return recordOpen(ctx, id);
    if (sub === 'grant') return grantItem(ctx, id);
    if (sub === 'archive') return archiveItem(ctx, id);
  }
  return notFound();
}

async function getItem(ctx: RouteContext, id: string): Promise<Response> {
  const loaded = await loadItem(ctx.env, id, ctx.caller, 'view');
  if (loaded instanceof Response) return loaded;
  const { row, access } = loaded;
  // Beside the item, how the caller reaches it, for the previews service (liveworkspace/docs/specs/006-media/previews.md): the
  // one tab a link confines them to, and the public link's code when that is their only way in.
  return json({
    item: await itemFor(ctx.env, ctx.caller.person, row, access),
    tabId: access.tabId,
    publicCode: access.public ? access.code : null,
  });
}

async function updateItem(ctx: RouteContext, id: string): Promise<Response> {
  const { request, env, caller } = ctx;
  const loaded = await loadItem(env, id, caller, 'edit');
  if (loaded instanceof Response) return loaded;
  const { row, access } = loaded;
  const body = await readObject(request);
  if (!body) return badRequest();

  let title = row.title;
  if (body.title !== undefined) {
    const read = readName(body.title, TITLE_MAX);
    if (!read) return badRequest('invalid_title');
    title = read;
  }
  const moving = body.folderId !== undefined || body.teamId !== undefined;
  // Filing and team moves belong to the item's owner and team; a link editor may only rename.
  const person = caller.person;
  if (moving && (access.via === 'link' || !person)) return forbidden();
  if (!optionalId(body.teamId)) return badRequest('invalid_team');
  if (!optionalId(body.folderId)) return badRequest('invalid_folder');

  let teamId = row.team_id;
  let ownerId = row.owner_id;
  let folderId = row.folder_id;
  // An archived item is in no team and no folder: naming either moves it out (blueprints/archive.md "The move
  // out"); a rename alone leaves it in Archived.
  const archived = isArchived(row);
  if (person && body.teamId !== undefined && (body.teamId ?? null) !== row.team_id) {
    const target = body.teamId ?? null;
    // Into or out of a team: joined membership of each team involved.
    if (row.team_id && !(await inTeamNow(env, person, row.team_id)))
      return forbidden('not_team_member');
    if (target && !(await inTeamNow(env, person, target))) return forbidden('not_team_member');
    // Leaving a team, it becomes the mover's own.
    if (!target) ownerId = person.id;
    teamId = target;
    // Its folder was in the old scope.
    folderId = null;
  }
  const scope = archived && !moving ? archivedScope(ownerId) : scopeOf(ownerId, teamId);
  const archivedAt = archived && !moving ? row.archived_at : null;
  let folderName: string | null = null;
  if (body.folderId !== undefined) {
    folderId = body.folderId ?? null;
    if (folderId) {
      const folder = await getFolderRow(env, folderId);
      if (!folder || folder.scope !== scope) return notFound('folder_not_found');
      folderName = folder.name;
    }
  }
  // updatedAt is the last content or title change, so a move leaves it.
  const now = Date.now();
  const updatedAt = title !== row.title ? now : row.updated_at;
  const db = env.INDEX_DB;
  const actorId = person?.id ?? null;
  const events: D1PreparedStatement[] = [];
  if (title !== row.title) {
    events.push(
      ...eventStatements(db, {
        itemId: id,
        type: 'renamed',
        actorId,
        detail: { from: row.title },
        at: now,
      }),
    );
  }
  if (folderId !== row.folder_id || teamId !== row.team_id || scope !== row.scope) {
    const teamChanged = teamId !== row.team_id;
    events.push(
      ...eventStatements(db, {
        itemId: id,
        type: 'moved',
        actorId,
        detail: teamChanged
          ? { folderName, teamId, fromTeamId: row.team_id }
          : { folderName, teamId },
        at: now,
        // Into, out of or between teams: in the audit log of each team involved; a move between folders, in none.
        auditTeams: teamChanged ? [row.team_id, teamId] : [],
      }),
    );
  }
  await db.batch([
    db
      .prepare(
        `UPDATE items SET title = ?, owner_id = ?, team_id = ?, scope = ?, folder_id = ?, updated_at = ?,
         archived_at = ? WHERE id = ?`,
      )
      .bind(title, ownerId, teamId, scope, folderId, updatedAt, archivedAt, id),
    ...events,
  ]);
  // Moved out of Archived: its app starts what it runs on its own clock for it again (one-explorer-contracts.md
  // "Where an item stands").
  if (archived && moving) {
    tellStanding(env, ctx.waitUntil, row.app, id, {
      archived: false,
      trashed: row.trashed_at !== null,
      at: now,
    });
  }
  // Renamed or moved: its owner's mirror before and after (into or out of a team, one side is personal).
  if (events.length > 0) {
    touchItem(ctx.drive, row);
    touchItem(ctx.drive, { owner_id: ownerId, team_id: teamId });
  }
  const next: ItemRow = {
    ...row,
    title,
    owner_id: ownerId,
    team_id: teamId,
    scope,
    folder_id: folderId,
    updated_at: updatedAt,
    archived_at: archivedAt,
  };
  const nextAccess: Access =
    access.via === 'link' ? access : { level: 'edit', tabId: null, via: 'owner', code: null };
  return json({ item: await itemFor(env, person, next, nextAccess) });
}

async function deleteItem(ctx: RouteContext, id: string): Promise<Response> {
  const { env, url, caller } = ctx;
  const loaded = await loadItem(env, id, caller, 'edit', { manage: true });
  if (loaded instanceof Response) return loaded;
  const { row } = loaded;
  const offline = url.searchParams.get('reason') === 'offline';
  // A joined teammate taking a team item offline (livediagram/docs/specs/006-document/offline-mode.md "Take
  // Offline"): their copy is in their browser, and from the team's side it is a deletion, so the team's copy goes
  // to the team Trash rather than for good. Only its owner's Take Offline is a move.
  const teammate =
    offline && row.team_id !== null && caller.person !== null && caller.person.id !== row.owner_id;
  if (url.searchParams.get('permanent') === 'true' && !teammate) {
    const now = Date.now();
    await purgeRows(env, [{ id: row.id, app: row.app }], now, {
      actorId: caller.person?.id ?? null,
      ...(offline ? { detail: { reason: 'offline' } } : {}),
    });
    touchItem(ctx.drive, row);
    ctx.waitUntil(drainTombstonesSoon(env, [row.id]));
    console.info('[index] purged', { app: row.app });
    return noContent();
  }
  const reason = url.searchParams.get('reason') === 'empty' ? 'empty' : 'deleted';
  const db = env.INDEX_DB;
  const now = Date.now();
  const statements = [
    db
      .prepare(
        'UPDATE items SET trashed_at = ?, trash_reason = ? WHERE id = ? AND trashed_at IS NULL',
      )
      .bind(now, reason, id),
  ];
  // An empty item tidied away by its app is not news; one already in the Trash was recorded going there.
  if (reason === 'deleted' && row.trashed_at === null) {
    statements.push(
      ...eventStatements(db, {
        itemId: id,
        type: 'trashed',
        actorId: caller.person?.id ?? null,
        at: now,
      }),
    );
  }
  await db.batch(statements);
  if (row.trashed_at === null) {
    touchItem(ctx.drive, row);
    // Into the Trash: its app stops what it runs on its own clock for it. One already there was told.
    tellStanding(env, ctx.waitUntil, row.app, id, {
      archived: isArchived(row),
      trashed: true,
      at: now,
    });
  }
  return noContent();
}

async function restoreItem(ctx: RouteContext, id: string): Promise<Response> {
  const { env, caller } = ctx;
  const loaded = await loadItem(env, id, caller, 'edit', { manage: true });
  if (loaded instanceof Response) return loaded;
  const db = env.INDEX_DB;
  const now = Date.now();
  const statements = [
    db.prepare('UPDATE items SET trashed_at = NULL, trash_reason = NULL WHERE id = ?').bind(id),
  ];
  if (loaded.row.trashed_at !== null) {
    statements.push(
      ...eventStatements(db, {
        itemId: id,
        type: 'restored',
        actorId: caller.person?.id ?? null,
        at: now,
      }),
    );
  }
  await db.batch(statements);
  if (loaded.row.trashed_at !== null) {
    touchItem(ctx.drive, loaded.row);
    // Out of the Trash (back to Archived, for an archived item): its app hears where it stands now.
    tellStanding(env, ctx.waitUntil, loaded.row.app, id, {
      archived: isArchived(loaded.row),
      trashed: false,
      at: now,
    });
  }
  const row = await getItemRow(env, id);
  return json({ item: await itemFor(env, caller.person, row!, loaded.access) });
}

// POST /items/:id/copy: the index makes the row, then asks the app to copy the content. A copy the app
// could not make leaves no row behind.
async function copyItem(ctx: RouteContext, id: string): Promise<Response> {
  const { request, env, caller } = ctx;
  const person = caller.person;
  // A copy needs someone to own it.
  if (!person) return fail(401, 'unauthorized');
  const loaded = await loadItem(env, id, caller, 'view');
  if (loaded instanceof Response) return loaded;
  const { row: from, access } = loaded;
  if (isArchived(from)) return archivedRefusal();
  const body = await readObject(request);
  if (!body) return badRequest();
  let title = `${from.title} (copy)`.slice(0, TITLE_MAX);
  if (body.title !== undefined) {
    const read = readName(body.title, TITLE_MAX);
    if (!read) return badRequest('invalid_title');
    title = read;
  }
  // Their own or their team's stays where it is; anything reached through a link lands in their root.
  const own = access.via !== 'link';
  const now = Date.now();
  const teamId = own ? from.team_id : null;
  const row: ItemRow = {
    ...from,
    id: crypto.randomUUID(),
    owner_id: person.id,
    team_id: teamId,
    scope: scopeOf(person.id, teamId),
    folder_id: own ? from.folder_id : null,
    title,
    created_at: now,
    updated_at: now,
    trashed_at: null,
    trash_reason: null,
    archived_at: null,
  };
  await insertItem(env, row, { copiedFrom: from.title });
  // A link scoped to one tab copies only that tab. The app hears who copies and the link they came in by, so the
  // copy carries only what they may read, the address they copy from, for what it counts per network (a
  // Community post's copies), and the row's title, so the copy opens with the name the Explorer lists.
  const copied = await callApp(
    env,
    from.app,
    'POST',
    `/items/${encodeURIComponent(from.id)}/copy-to/${encodeURIComponent(row.id)}`,
    { tabId: access.tabId, by: person.id, code: access.code, ip: clientIpOf(request, env), title },
  );
  if (!copied.ok) {
    await env.INDEX_DB.prepare('DELETE FROM items WHERE id = ?').bind(row.id).run();
    console.warn('[index] copy failed', { app: from.app, error: copied.error });
    return fail(502, 'copy_failed');
  }
  touchItem(ctx.drive, row);
  // Through a link: Copied by a Visitor, in the source's owner's History.
  recordVisitorCopy(env, ctx.waitUntil, from, person, access, now);
  const ownAccess: Access = { level: 'edit', tabId: null, via: 'owner', code: null };
  return json({ item: await itemFor(env, person, row, ownAccess) }, { status: 201 });
}

// Recent opens this isolate has written, so a burst never reaches D1. Oldest out first.

async function grantItem(ctx: RouteContext, id: string): Promise<Response> {
  const { env, caller } = ctx;
  const loaded = await loadItem(env, id, caller, 'view');
  if (loaded instanceof Response) return loaded;
  const { row, access } = loaded;
  // An archived item is never granted: its owner (the only one who still reaches it) hears why.
  if (isArchived(row)) return archivedRefusal();
  const sub = caller.person ? caller.person.id : `link:${access.code}`;
  const grant = await mintGrant(env, {
    app: row.app,
    sub,
    itemId: row.id,
    level: access.level,
    tabId: access.tabId,
    ownerId: row.owner_id,
    teamId: row.team_id,
    trashed: row.trashed_at !== null,
    link: access.via === 'link' ? access.code : null,
  });
  if (!grant) return fail(503, 'grants_unavailable');
  // Through a link: Opened by a Visitor, in the owner's History.
  recordVisitorOpen(env, ctx.waitUntil, row, caller.person, access);
  return json(grant);
}
