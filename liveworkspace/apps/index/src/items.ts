// Items (liveworkspace/docs/one-explorer-contracts.md "Items"): listing, making, reading, renaming and
// moving, the Trash, copies, opens and grants.

import { inTeamNow, inTeamsNow } from './fresh-teams';
import {
  APP_KINDS,
  FILTER_VALUES_MAX,
  INTENT_WORD,
  ITEM_OWNERS,
  ITEM_SOURCES,
  ITEM_VIEWS,
  LIST_LIMIT_MAX,
  isApp,
  MOST_USED_MAX,
  OPEN_DEBOUNCE_MS,
  SEARCH_MAX,
  SEARCH_WORDS_MAX,
  USE_WINDOW_DAYS,
  TITLE_MAX,
  type App,
  type ItemOwner,
  type ItemSource,
  type ItemView,
} from '@liveworkspace/index-client';
import { loadItem } from './access';
import { callApp } from './app-calls';
import { personalScope, scopeOf, teamScope, type Person } from './auth';
import { decodeCursor, isId, parseLimit } from './codec';
import { defaultPlacement } from './default-placement';
import { INTENT_MAX, OPEN_MEMORY_MAX, PURGE_NOW_MAX } from './config';

const DAY_MS = 86_400_000;
import type { PersonContext, RouteContext } from './context';
import type { Env } from './env';
import { getFolderRow, readName, reachableFolder, teamFilter } from './folders';
import { mintGrant, signingKey } from './grants';
import {
  badRequest,
  conflict,
  fail,
  forbidden,
  json,
  noContent,
  notFound,
  readObject,
} from './http';
import { listItems, type ListFilters, type ListSpec } from './lists';
import { firstVisitStatement, tellApp, wasFirstVisit } from './notices';
import { drainTombstones, purgeRows } from './purge';
import { decorate, getItemRow, type Access, type ItemRow } from './rows';
import { bulkEventStatements, eventStatements, moveScopeStatements } from './timeline';

const DEFAULT_TITLE = 'Untitled';
// Emptying the Trash purges at most this many per call; the Explorer calls again while some remain.
const EMPTY_TRASH_MAX = 1000;

// A comma list of at most FILTER_VALUES_MAX distinct values, each passing `ok`; null when malformed.
function readList(raw: string, ok: (value: string) => boolean): string[] | null {
  const values = [...new Set(raw.split(','))];
  if (values.length > FILTER_VALUES_MAX || !values.every(ok)) return null;
  return values;
}

// The Explorer's filters (its lens) from a query string, checked: GET /items and GET /shared.
export async function parseListFilters(
  env: Env,
  person: Person,
  params: URLSearchParams,
): Promise<ListFilters | Response> {
  const filters: ListFilters = {};
  const q = params.get('q')?.trim();
  if (q) {
    if (q.length > SEARCH_MAX) return badRequest('invalid_query');
    const words = [...new Set(q.split(/\s+/))];
    if (words.length > SEARCH_WORDS_MAX) return badRequest('invalid_query');
    filters.words = words;
  }
  const apps = params.get('apps');
  if (apps !== null) {
    const values = readList(apps, isApp);
    if (!values) return badRequest('invalid_query');
    filters.apps = values as App[];
  }
  const source = params.get('source');
  if (source !== null) {
    const values = readList(source, (v) => (ITEM_SOURCES as readonly string[]).includes(v));
    if (!values) return badRequest('invalid_query');
    filters.source = values as ItemSource[];
  }
  const since = params.get('since');
  if (since !== null) {
    const n = Number(since);
    if (since === '' || !Number.isSafeInteger(n) || n < 0) return badRequest('invalid_query');
    filters.since = n;
  }
  const owner = params.get('owner');
  if (owner !== null) {
    if (!(ITEM_OWNERS as readonly string[]).includes(owner)) return badRequest('invalid_query');
    filters.owner = owner as ItemOwner;
  }
  const intent = params.get('intent');
  if (intent !== null) {
    const values = readList(intent, (v) => INTENT_WORD.test(v));
    if (!values) return badRequest('invalid_query');
    filters.intent = values;
  }
  const space = params.get('space');
  if (space !== null) {
    const values = readList(space, (v) => v === 'mine' || v === 'shared' || v.startsWith('team:'));
    if (!values) return badRequest('invalid_query');
    const teams = values.filter((v) => v.startsWith('team:')).map((v) => v.slice(5));
    if (!(await inTeamsNow(env, person, teams))) return forbidden('not_team_member');
    filters.space = { mine: values.includes('mine'), shared: values.includes('shared'), teams };
  }
  return filters;
}

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
  const scopes = await teamFilter(env, person, params.get('team'));
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
  const deep = params.get('deep');
  if (deep !== null) {
    if (deep !== '1' || !spec.folder) return badRequest('invalid_query');
    spec.deep = true;
  }
  const filters = await parseListFilters(env, person, params);
  if (filters instanceof Response) return filters;
  Object.assign(spec, filters);
  const used = params.get('used');
  if (used !== null) {
    const n = Number(used);
    if (view !== 'recent' || !Number.isInteger(n) || n < 1 || n > MOST_USED_MAX)
      return badRequest('invalid_query');
    spec.used = n;
  }
  // Home's other reads, answered beside the first page (lists.ts `mine`, `any`).
  const mine = params.get('mine');
  if (mine !== null) {
    const n = Number(mine);
    if (!Number.isInteger(n) || n < 1 || n > LIST_LIMIT_MAX) return badRequest('invalid_query');
    spec.mine = n;
  }
  const any = params.get('any');
  if (any !== null) {
    if (any !== '1') return badRequest('invalid_query');
    spec.any = true;
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
  // `app` empties that app's items only, as an Explorer filtered to one app shows them; without it, every app's.
  const appParam = url.searchParams.get('app');
  if (appParam !== null && !isApp(appParam)) return badRequest('invalid_app');
  // An app acting for a person may empty its own items, never every app's.
  if (person.app && appParam !== person.app) return forbidden('wrong_app');
  const team = url.searchParams.get('team');
  if (team && !(await inTeamNow(env, person, team))) return forbidden('not_team_member');
  const scope = team ? teamScope(team) : personalScope(person.id);
  const { results } = await env.INDEX_DB.prepare(
    `SELECT id, app FROM items WHERE scope = ? AND trashed_at IS NOT NULL${appParam ? ' AND app = ?' : ''}
     ORDER BY updated_at DESC LIMIT ?`,
  )
    .bind(...(appParam ? [scope, appParam, EMPTY_TRASH_MAX] : [scope, EMPTY_TRASH_MAX]))
    .all<Pick<ItemRow, 'id' | 'app'>>();
  await purgeRows(env, results);
  if (results.length > 0) {
    const ids = results.slice(0, PURGE_NOW_MAX).map((r) => r.id);
    ctx.waitUntil(drainTombstones(env, { ids }));
  }
  console.log('[index] emptied trash', {
    scope: team ? 'team' : 'personal',
    app: appParam ?? 'all',
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
  // An app acting for a person makes its own kind only.
  if (person.app && person.app !== body.app) return forbidden('wrong_app');
  const title = body.title === undefined ? DEFAULT_TITLE : readName(body.title, TITLE_MAX);
  if (!title) return badRequest('invalid_title');
  if (!optionalId(body.teamId)) return badRequest('invalid_team');
  if (!optionalId(body.folderId)) return badRequest('invalid_folder');
  // A client may name the id it minted (an offline item synced up, an API client that made one): 409
  // `item_exists` when it is taken.
  if (body.id !== undefined && !isId(body.id)) return badRequest('invalid_body');
  const intent = body.intent ?? null;
  if (intent !== null && (typeof intent !== 'string' || intent.length > INTENT_MAX)) {
    return badRequest();
  }
  const source = body.source ?? null;
  if (source !== null && !(ITEM_SOURCES as readonly unknown[]).includes(source))
    return badRequest();
  let teamId = body.teamId ?? null;
  if (teamId && !(await inTeamNow(env, person, teamId))) return forbidden('not_team_member');
  let scope = scopeOf(person.id, teamId);
  let folderId = body.folderId ?? null;
  if (folderId) {
    const folder = await getFolderRow(env, folderId);
    if (!folder || folder.scope !== scope) return notFound('folder_not_found');
  }
  // No place named (no `folderId` key, no team) and an intent: the person's default folder for it, if any.
  if (!('folderId' in body) && teamId === null && intent !== null) {
    const placed = await defaultPlacement(env, person, body.app, intent as string);
    if (placed) ({ folderId, teamId, scope } = placed);
  }
  // Without a key there would be no grant to open it with: refuse before making the row.
  if (!(await signingKey(env))) return fail(503, 'grants_unavailable');

  const now = Date.now();
  const row: ItemRow = {
    id: (body.id as string | undefined) ?? crypto.randomUUID(),
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
  try {
    await insertItem(
      env,
      row,
      row.source && row.source !== 'person' ? { source: row.source } : null,
      body.synced === true ? 'synced' : 'created',
    );
  } catch (err) {
    if (String(err).includes('UNIQUE')) return conflict('item_exists');
    throw err;
  }
  const access: Access = { level: 'edit', tabId: null, via: 'owner', code: null };
  const grant = await mintGrant(env, {
    app: row.app,
    sub: person.id,
    itemId: row.id,
    level: 'edit',
    tabId: null,
    ownerId: row.owner_id,
    teamId,
  });
  console.log('[index] created', {
    app: row.app,
    team: teamId !== null,
    filed: !('folderId' in body) && folderId !== null ? 'default' : 'given',
  });
  return json({ item: await itemFor(env, person, row, access), grant }, { status: 201 });
}

// The row, and its `created` event (`synced` for an offline item put back) in the same batch.
async function insertItem(
  env: Env,
  row: ItemRow,
  detail: Record<string, string | null> | null = null,
  type: 'created' | 'synced' = 'created',
): Promise<void> {
  const db = env.INDEX_DB;
  const insert = db
    .prepare(
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
    );
  await db.batch([
    insert,
    ...eventStatements(db, {
      itemId: row.id,
      type,
      actorId: row.owner_id,
      detail,
      at: row.created_at,
    }),
  ]);
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
    if (row.team_id && !(await inTeamNow(env, person, row.team_id)))
      return forbidden('not_team_member');
    if (target && !(await inTeamNow(env, person, target))) return forbidden('not_team_member');
    // Leaving a team, it becomes the mover's own.
    if (!target) ownerId = person.id;
    teamId = target;
    // Its folder was in the old scope.
    folderId = null;
  }
  const scope = scopeOf(ownerId, teamId);
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
  if (folderId !== row.folder_id || teamId !== row.team_id) {
    // Its events go where it went (who sees its history is who reaches it), then the move is recorded there.
    events.push(...moveScopeStatements(db, id, row.scope, scope));
    events.push(
      ...eventStatements(db, {
        itemId: id,
        type: 'moved',
        actorId,
        detail: { folderName, teamId },
        at: now,
      }),
    );
  }
  await db.batch([
    db
      .prepare(
        `UPDATE items SET title = ?, owner_id = ?, team_id = ?, scope = ?, folder_id = ?, updated_at = ?
         WHERE id = ?`,
      )
      .bind(title, ownerId, teamId, scope, folderId, updatedAt, id),
    ...events,
  ]);
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
    // Taken offline into one browser: the item goes, and its person's Timeline says where (an event about no
    // item, keeping its name and app).
    if (url.searchParams.get('reason') === 'offline') {
      const actor = caller.person?.id ?? row.owner_id;
      const now = Date.now();
      await env.INDEX_DB.batch(
        bulkEventStatements(env.INDEX_DB, [
          {
            id: `off:${row.id}:${now}`,
            app: row.app,
            itemId: null,
            type: 'taken_offline',
            actorId: actor,
            title: row.title,
            at: now,
            scopes: [`p:${actor}`],
          },
        ]),
      );
    }
    await purgeRows(env, [{ id: row.id, app: row.app }]);
    ctx.waitUntil(drainTombstones(env, { ids: [row.id] }));
    console.log('[index] purged', { app: row.app });
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
  return noContent();
}

async function restoreItem(ctx: RouteContext, id: string): Promise<Response> {
  const { env, caller } = ctx;
  const loaded = await loadItem(env, id, caller, 'edit', { manage: true });
  if (loaded instanceof Response) return loaded;
  const db = env.INDEX_DB;
  const statements = [
    db.prepare('UPDATE items SET trashed_at = NULL, trash_reason = NULL WHERE id = ?').bind(id),
  ];
  if (loaded.row.trashed_at !== null) {
    statements.push(
      ...eventStatements(db, {
        itemId: id,
        type: 'restored',
        actorId: caller.person?.id ?? null,
        at: Date.now(),
      }),
    );
  }
  await db.batch(statements);
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
  await insertItem(env, row, { copiedFrom: from.title });
  // A link scoped to one tab copies only that tab. The app hears who copies and the link they came in by, so the
  // copy carries only what they may read.
  const copied = await callApp(
    env,
    from.app,
    'POST',
    `/items/${encodeURIComponent(from.id)}/copy-to/${encodeURIComponent(row.id)}`,
    { tabId: access.tabId, by: person.id, code: access.code },
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
// The UTC day each person's use days were last pruned here, so a prune runs at most once a day per person per
// isolate. Bounded like recentOpens.
const prunedOn = new Map<string, number>();

/** The UTC day number of `at`: what a use day counts by. */
export const useDayOf = (at: number) => Math.floor(at / DAY_MS);

function pruneDue(personId: string, day: number): boolean {
  if (prunedOn.get(personId) === day) return false;
  prunedOn.delete(personId);
  prunedOn.set(personId, day);
  if (prunedOn.size > OPEN_MEMORY_MAX) {
    const oldest = prunedOn.keys().next().value;
    if (oldest !== undefined) prunedOn.delete(oldest);
  }
  return true;
}

/** The statements that count today as a use day of `itemId` for `personId`, and, at most once a day, drop the
 * person's days that have left the window. Both read through use_days' (person_id, …) indexes. */
export function useDayStatements(env: Env, personId: string, itemId: string, at: number) {
  const db = env.INDEX_DB;
  const day = useDayOf(at);
  const statements = [
    db
      .prepare('INSERT OR IGNORE INTO use_days (person_id, item_id, day) VALUES (?, ?, ?)')
      .bind(personId, itemId, day),
  ];
  if (pruneDue(personId, day)) {
    statements.push(
      db
        .prepare('DELETE FROM use_days WHERE person_id = ? AND day < ?')
        .bind(personId, day - USE_WINDOW_DAYS + 1),
    );
  }
  return statements;
}

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
    // Most Used: today counts once, however many opens.
    ...useDayStatements(env, person.id, id, now),
  ];
  // Through a link: kept for Shared with me, and a first time in tells the app (notices.ts).
  const visitAt = loaded.access.via === 'link' && loaded.access.code ? statements.length : -1;
  if (visitAt >= 0) {
    statements.push(firstVisitStatement(env, person.id, id));
    statements.push(sharedWithUpsert(env, person.id, id, loaded.access.code!, now));
  }
  const results = await db.batch(statements);
  if (visitAt >= 0 && wasFirstVisit(results[visitAt])) {
    tellApp(ctx.waitUntil, env, loaded.row, {
      type: 'joined',
      personId: person.id,
      level: loaded.access.level,
    });
  }
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
    ownerId: row.owner_id,
    teamId: row.team_id,
  });
  if (!grant) return fail(503, 'grants_unavailable');
  return json(grant);
}
