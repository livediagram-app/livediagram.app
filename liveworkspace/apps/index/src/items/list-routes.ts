// Listing items and the Trash (items.ts).

import { inTeamsNow, inTeamNow } from '../fresh-teams';
import {
  FILTER_VALUES_MAX,
  SEARCH_MAX,
  SEARCH_WORDS_MAX,
  isApp,
  type App,
  ITEM_SOURCES,
  type ItemSource,
  ITEM_OWNERS,
  type ItemOwner,
  INTENT_WORD,
  type ItemView,
  MOST_USED_MAX,
  LIST_LIMIT_MAX,
  ITEM_VIEWS,
} from '@liveworkspace/index-client';
import { type Person, personalScope, teamScope, ownScopes } from '../auth';
import { isId, parseLimit, decodeCursor } from '../codec';
import { PURGE_NOW_MAX } from '../config';
import type { PersonContext } from '../context';
import type { Env } from '../env';
import { teamFilter, reachableFolder } from '../folders';
import { badRequest, forbidden, notFound, json } from '../http';
import { type ListFilters, type ListSpec, listItems } from '../lists';
import { purgeRows, drainTombstonesSoon } from '../purge';
import type { ItemRow } from '../rows';
import { EMPTY_TRASH_MAX } from './shared';

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
  const modes = params.get('modes');
  if (modes !== null) {
    const values = readList(modes, (v) => INTENT_WORD.test(v));
    if (!values) return badRequest('invalid_query');
    filters.modes = values;
  }
  const space = params.get('space');
  if (space !== null) {
    // A team needs its id: `team:` alone is a malformed filter, not a team the person isn't in.
    const values = readList(
      space,
      (v) => v === 'mine' || v === 'shared' || (v.startsWith('team:') && isId(v.slice(5))),
    );
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
  // The data export's scope is set below, whatever team the query names.
  const scopes = person.export ? undefined : await teamFilter(env, person, params.get('team'));
  if (scopes instanceof Response) return scopes;
  const spec: ListSpec = { view, limit };
  if (app) spec.app = app;
  if (cursor) spec.cursor = cursor;
  if (scopes) spec.scopes = scopes;
  // The Drive mirror lists the person's personal items only, in every view: nothing shared with them, no team's.
  if (person.drive) spec.scopes = [personalScope(person.id)];
  // The data export lists one scope: the person's personal items, or the one team it named.
  if (person.export) {
    spec.view = 'all';
    // Its personal scope keeps the person's Archived: Download Your Data holds every document they own.
    spec.scopes = person.teams[0] ? [teamScope(person.teams[0])] : ownScopes(person.id);
  }
  const folder = params.get('folder');
  if (folder !== null) {
    if (!isId(folder)) return badRequest('invalid_folder');
    if (!(await reachableFolder(env, person, folder))) return notFound('folder_not_found');
    spec.folder = folder;
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
    // Search's whole reach, links included: not the mirror's to ask.
    if (any !== '1' || person.drive || person.export) return badRequest('invalid_query');
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
  // The person's own Trash holds their archived items' too (blueprints/archive.md).
  const scopes = JSON.stringify(team ? [teamScope(team)] : ownScopes(person.id));
  const { results } = await env.INDEX_DB.prepare(
    `SELECT id, app FROM items WHERE scope IN (SELECT value FROM json_each(?)) AND trashed_at IS NOT NULL${appParam ? ' AND app = ?' : ''}
     ORDER BY updated_at DESC LIMIT ?`,
  )
    .bind(...(appParam ? [scopes, appParam, EMPTY_TRASH_MAX] : [scopes, EMPTY_TRASH_MAX]))
    .all<Pick<ItemRow, 'id' | 'app'>>();
  await purgeRows(env, results, Date.now(), { actorId: person.id });
  if (results.length > 0 && !team) ctx.drive.add(person.id);
  if (results.length > 0) {
    const ids = results.slice(0, PURGE_NOW_MAX).map((r) => r.id);
    ctx.waitUntil(drainTombstonesSoon(env, ids));
  }
  console.log('[index] emptied trash', {
    scope: team ? 'team' : 'personal',
    app: appParam ?? 'all',
    purged: results.length,
  });
  return json({ purged: results.length });
}
