// Items (liveworkspace/docs/one-explorer-contracts.md "Items"): listing, making, reading, renaming and
// moving, the Trash, copies, opens and grants.

import {
  APP_KINDS,
  ITEM_SOURCES,
  ITEM_VIEWS,
  isApp,
  OPEN_DEBOUNCE_MS,
  SEARCH_MAX,
  TITLE_MAX,
  type ItemSource,
  type ItemView,
} from '@liveworkspace/index-client';
import { loadItem } from './access';
import { callApp } from './app-calls';
import { personalScope, scopeOf, teamScope, type Person } from './auth';
import { decodeCursor, isId, parseLimit } from './codec';
import { INTENT_MAX, OPEN_MEMORY_MAX, PURGE_NOW_MAX } from './config';
import type { PersonContext, RouteContext } from './context';
import type { Env } from './env';
import { getFolderRow, readName, reachableFolder, teamFilter } from './folders';
import { mintGrant, signingKey } from './grants';
import { badRequest, fail, forbidden, json, noContent, notFound, readObject } from './http';
import { listItems, type ListSpec } from './lists';
import { drainTombstones, purgeRows } from './purge';
import { decorate, getItemRow, type Access, type ItemRow } from './rows';

const DEFAULT_TITLE = 'Untitled';
// Emptying the Trash purges at most this many per call; the Explorer calls again while some remain.
const EMPTY_TRASH_MAX = 1000;

// The list filters from a query string, checked. A refusal is the response to send.
export async function parseListSpec(
  env: Env,
  person: Person,
  params: URLSearchParams,
  view: ItemView,
): Promise<ListSpec | Response> {
  const app = params.get('app');
  if (app !== null && !isApp(app)) return badRequest('invalid_app');
  const limit = parseLimit(params.get('limit'));
  if (limit === null) return badRequest('invalid_query');
  const cursor = decodeCursor(params.get('cursor'));
  if (cursor === null) return badRequest('invalid_cursor');
  const scopes = teamFilter(person, params.get('team'));
  if (scopes instanceof Response) return scopes;
  const spec: ListSpec = { view, limit };
  if (app) spec.app = app;
  if (cursor) spec.cursor = cursor;
  if (scopes) spec.scopes = scopes;
  const folder = params.get('folder');
  if (folder !== null) {
    if (!isId(folder)) return badRequest('invalid_folder');
    if (!(await reachableFolder(env, person, folder))) return notFound('folder_not_found');
    spec.folder = folder;
  }
  const tag = params.get('tag');
  if (tag !== null) {
    if (!isId(tag)) return badRequest('invalid_tag');
    const mine = await env.INDEX_DB.prepare('SELECT 1 FROM tags WHERE id = ? AND owner_id = ?')
      .bind(tag, person.id)
      .first();
    if (!mine) return notFound();
    spec.tag = tag;
  }
  const q = params.get('q')?.trim();
  if (q) {
    if (q.length > SEARCH_MAX) return badRequest('invalid_query');
    spec.q = q;
  }
  return spec;
}

export async function handleList(ctx: PersonContext, view: ItemView): Promise<Response> {
  const spec = await parseListSpec(ctx.env, ctx.person, ctx.url.searchParams, view);
  if (spec instanceof Response) return spec;
  return json(await listItems(ctx.env, ctx.person, spec));
}

// GET /items: the view comes from the query.
export async function handleItemList(ctx: PersonContext): Promise<Response> {
  const view = ctx.url.searchParams.get('view') ?? 'all';
  if (!(ITEM_VIEWS as readonly string[]).includes(view)) return badRequest('invalid_query');
  return handleList(ctx, view as ItemView);
}

// GET and DELETE /trash.
export async function handleTrash(ctx: PersonContext): Promise<Response> {
  const { request, env, url, person } = ctx;
  if (request.method === 'GET') return handleList(ctx, 'trash');
  if (request.method !== 'DELETE') return notFound();
  const team = url.searchParams.get('team');
  if (team && !person.teams.includes(team)) return forbidden('not_team_member');
  const scope = team ? teamScope(team) : personalScope(person.id);
  const { results } = await env.INDEX_DB.prepare(
    'SELECT id, app FROM items WHERE scope = ? AND trashed_at IS NOT NULL ORDER BY updated_at DESC LIMIT ?',
  )
    .bind(scope, EMPTY_TRASH_MAX)
    .all<Pick<ItemRow, 'id' | 'app'>>();
  await purgeRows(env, results);
  if (results.length > 0) {
    const ids = results.slice(0, PURGE_NOW_MAX).map((r) => r.id);
    ctx.waitUntil(drainTombstones(env, { ids }));
  }
  console.log('[index] emptied trash', {
    scope: team ? 'team' : 'personal',
    purged: results.length,
  });
  return json({ purged: results.length });
}

async function itemFor(env: Env, person: Person | null, row: ItemRow, access: Access) {
  const [item] = await decorate(env, person, [row], new Map([[row.id, access]]));
  return item!;
}

const optionalId = (value: unknown): value is string | null | undefined =>
  value === undefined || value === null || isId(value);

// POST /items: the index makes the id; the item's Durable Object starts empty when first opened with
// the grant.
export async function createItem(ctx: PersonContext): Promise<Response> {
  const { request, env, person } = ctx;
  const body = await readObject(request);
  if (!body) return badRequest();
  if (!isApp(body.app)) return badRequest('invalid_app');
  const title = body.title === undefined ? DEFAULT_TITLE : readName(body.title, TITLE_MAX);
  if (!title) return badRequest('invalid_title');
  if (!optionalId(body.teamId)) return badRequest('invalid_team');
  if (!optionalId(body.folderId)) return badRequest('invalid_folder');
  const intent = body.intent ?? null;
  if (intent !== null && (typeof intent !== 'string' || intent.length > INTENT_MAX)) {
    return badRequest();
  }
  const source = body.source ?? null;
  if (source !== null && !(ITEM_SOURCES as readonly unknown[]).includes(source))
    return badRequest();
  const teamId = body.teamId ?? null;
  if (teamId && !person.teams.includes(teamId)) return forbidden('not_team_member');
  const scope = scopeOf(person.id, teamId);
  const folderId = body.folderId ?? null;
  if (folderId) {
    const folder = await getFolderRow(env, folderId);
    if (!folder || folder.scope !== scope) return notFound('folder_not_found');
  }
  // Without a key there would be no grant to open it with: refuse before making the row.
  if (!(await signingKey(env))) return fail(503, 'grants_unavailable');

  const now = Date.now();
  const row: ItemRow = {
    id: crypto.randomUUID(),
    app: body.app,
    kind: APP_KINDS[body.app],
    owner_id: person.id,
    team_id: teamId,
    scope,
    folder_id: folderId,
    title,
    source: source as ItemSource | null,
    intent: intent as string | null,
    summary: '{}',
    created_at: now,
    updated_at: now,
    trashed_at: null,
    trash_reason: null,
  };
  await insertItem(env, row);
  const access: Access = { level: 'edit', tabId: null, via: 'owner', code: null };
  const grant = await mintGrant(env, {
    app: row.app,
    sub: person.id,
    itemId: row.id,
    level: 'edit',
    tabId: null,
    teamId,
  });
  console.log('[index] created', { app: row.app, team: teamId !== null });
  return json({ item: await itemFor(env, person, row, access), grant }, { status: 201 });
}

async function insertItem(env: Env, row: ItemRow): Promise<void> {
  await env.INDEX_DB.prepare(
    `INSERT INTO items (id, app, kind, owner_id, team_id, scope, folder_id, title, source, intent, summary,
       created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      row.id,
      row.app,
      row.kind,
      row.owner_id,
      row.team_id,
      row.scope,
      row.folder_id,
      row.title,
      row.source,
      row.intent,
      row.summary,
      row.created_at,
      row.updated_at,
    )
    .run();
}

// /items/:id and below.
export async function handleItem(ctx: RouteContext, id: string): Promise<Response> {
  const { request, segments } = ctx;
  const method = request.method;
  const sub = segments[2];

  if (segments.length === 2) {
    if (method === 'GET') return getItem(ctx, id);
    if (method === 'PATCH') return updateItem(ctx, id);
    if (method === 'DELETE') return deleteItem(ctx, id);
  }
  if (segments.length === 3 && method === 'POST') {
    if (sub === 'restore') return restoreItem(ctx, id);
    if (sub === 'copy') return copyItem(ctx, id);
    if (sub === 'open') return recordOpen(ctx, id);
    if (sub === 'grant') return grantItem(ctx, id);
  }
  return notFound();
}

async function getItem(ctx: RouteContext, id: string): Promise<Response> {
  const loaded = await loadItem(ctx.env, id, ctx.caller, 'view');
  if (loaded instanceof Response) return loaded;
  return json({ item: await itemFor(ctx.env, ctx.caller.person, loaded.row, loaded.access) });
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
  if (person && body.teamId !== undefined && (body.teamId ?? null) !== row.team_id) {
    const target = body.teamId ?? null;
    // Into or out of a team: joined membership of each team involved.
    if (row.team_id && !person.teams.includes(row.team_id)) return forbidden('not_team_member');
    if (target && !person.teams.includes(target)) return forbidden('not_team_member');
    // Leaving a team, it becomes the mover's own.
    if (!target) ownerId = person.id;
    teamId = target;
    // Its folder was in the old scope.
    folderId = null;
  }
  const scope = scopeOf(ownerId, teamId);
  if (body.folderId !== undefined) {
    folderId = body.folderId ?? null;
    if (folderId) {
      const folder = await getFolderRow(env, folderId);
      if (!folder || folder.scope !== scope) return notFound('folder_not_found');
    }
  }
  // updatedAt is the last content or title change, so a move leaves it.
  const updatedAt = title !== row.title ? Date.now() : row.updated_at;
  await env.INDEX_DB.prepare(
    `UPDATE items SET title = ?, owner_id = ?, team_id = ?, scope = ?, folder_id = ?, updated_at = ?
     WHERE id = ?`,
  )
    .bind(title, ownerId, teamId, scope, folderId, updatedAt, id)
    .run();
  const next: ItemRow = {
    ...row,
    title,
    owner_id: ownerId,
    team_id: teamId,
    scope,
    folder_id: folderId,
    updated_at: updatedAt,
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
  if (url.searchParams.get('permanent') === 'true') {
    await purgeRows(env, [{ id: row.id, app: row.app }]);
    ctx.waitUntil(drainTombstones(env, { ids: [row.id] }));
    console.log('[index] purged', { app: row.app });
    return noContent();
  }
  const reason = url.searchParams.get('reason') === 'empty' ? 'empty' : 'deleted';
  await env.INDEX_DB.prepare(
    'UPDATE items SET trashed_at = ?, trash_reason = ? WHERE id = ? AND trashed_at IS NULL',
  )
    .bind(Date.now(), reason, id)
    .run();
  return noContent();
}

async function restoreItem(ctx: RouteContext, id: string): Promise<Response> {
  const { env, caller } = ctx;
  const loaded = await loadItem(env, id, caller, 'edit', { manage: true });
  if (loaded instanceof Response) return loaded;
  await env.INDEX_DB.prepare('UPDATE items SET trashed_at = NULL, trash_reason = NULL WHERE id = ?')
    .bind(id)
    .run();
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
  };
  await insertItem(env, row);
  // A link scoped to one tab copies only that tab.
  const copied = await callApp(
    env,
    from.app,
    'POST',
    `/items/${encodeURIComponent(from.id)}/copy-to/${encodeURIComponent(row.id)}`,
    { tabId: access.tabId },
  );
  if (!copied.ok) {
    await env.INDEX_DB.prepare('DELETE FROM items WHERE id = ?').bind(row.id).run();
    console.warn('[index] copy failed', { app: from.app, error: copied.error });
    return fail(502, 'copy_failed');
  }
  const ownAccess: Access = { level: 'edit', tabId: null, via: 'owner', code: null };
  return json({ item: await itemFor(env, person, row, ownAccess) }, { status: 201 });
}

// Recent opens this isolate has written, so a burst never reaches D1. Oldest out first.
const recentOpens = new Map<string, number>();

function rememberOpen(key: string, at: number): boolean {
  const last = recentOpens.get(key);
  if (last !== undefined && at - last < OPEN_DEBOUNCE_MS) return false;
  recentOpens.delete(key);
  recentOpens.set(key, at);
  if (recentOpens.size > OPEN_MEMORY_MAX) {
    const oldest = recentOpens.keys().next().value;
    if (oldest !== undefined) recentOpens.delete(oldest);
  }
  return true;
}

// The statement that records a link a person opened, under Shared. Rewrites only when the code changed or
// a minute has passed.
export function sharedWithUpsert(
  env: Env,
  personId: string,
  itemId: string,
  code: string,
  at: number,
) {
  return env.INDEX_DB.prepare(
    `INSERT INTO shared_with (person_id, item_id, share_code, last_seen) VALUES (?, ?, ?, ?)
     ON CONFLICT (person_id, item_id) DO UPDATE SET share_code = excluded.share_code, last_seen = excluded.last_seen
     WHERE shared_with.share_code <> excluded.share_code OR excluded.last_seen - shared_with.last_seen >= ?`,
  ).bind(personId, itemId, code, at, OPEN_DEBOUNCE_MS);
}

async function recordOpen(ctx: RouteContext, id: string): Promise<Response> {
  const { env, caller } = ctx;
  const loaded = await loadItem(env, id, caller, 'view');
  if (loaded instanceof Response) return loaded;
  const person = caller.person;
  // A link visitor with no identity has no Recent to keep.
  if (!person) return noContent();
  const now = Date.now();
  if (!rememberOpen(`${person.id} ${id}`, now)) return noContent();
  const db = env.INDEX_DB;
  const statements = [
    // At most one write a minute per person and item, even across isolates.
    db
      .prepare(
        `INSERT INTO opens (person_id, item_id, last_opened_at) VALUES (?, ?, ?)
         ON CONFLICT (person_id, item_id) DO UPDATE SET last_opened_at = excluded.last_opened_at
         WHERE excluded.last_opened_at - opens.last_opened_at >= ?`,
      )
      .bind(person.id, id, now, OPEN_DEBOUNCE_MS),
  ];
  if (loaded.access.via === 'link' && loaded.access.code) {
    statements.push(sharedWithUpsert(env, person.id, id, loaded.access.code, now));
  }
  await db.batch(statements);
  return noContent();
}

async function grantItem(ctx: RouteContext, id: string): Promise<Response> {
  const { env, caller } = ctx;
  const loaded = await loadItem(env, id, caller, 'view');
  if (loaded instanceof Response) return loaded;
  const { row, access } = loaded;
  const sub = caller.person ? caller.person.id : `link:${access.code}`;
  const grant = await mintGrant(env, {
    app: row.app,
    sub,
    itemId: row.id,
    level: access.level,
    tabId: access.tabId,
    teamId: row.team_id,
  });
  if (!grant) return fail(503, 'grants_unavailable');
  return json(grant);
}
