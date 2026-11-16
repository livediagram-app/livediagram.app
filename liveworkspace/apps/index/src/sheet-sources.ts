// Sheet sources on the index (liveworkspace/docs/specs/004-index/sheet-sources.md, its blueprint): a chart in one app
// reading one range of a sheet in another, on the reader's own access (Work Tracker 940: each reader's own grant,
// never a pass), and the change signal a source app sends when a watched sheet changes.
//
//   GET  /items/:id/sheets           the plan's Sheets, for a picker
//   POST /items/:id/sheet-range      one range's read; `watch` (with the reader item's grant) asks the plan to tell it
//   POST /app/items/:id/sheet-changed  the source app's signal, relayed to each watcher's app

import { createAppDoors, DoorError, type AppDoors } from '@liveworkspace/app-doors';
import {
  isSheetSourceApp,
  isSourceWatchApp,
  ITEM_GRANT_HEADER,
  readSheetRangeAsk,
  SHEET_CHANGE_SHEETS_MAX,
  SHEET_WATCHERS_MAX,
  type App,
  type SheetList,
  type SheetRangeRead,
  type SourceChange,
} from '@liveworkspace/index-client';
import { loadItem } from './access';
import { callApp, eachLimited } from './app-calls';
import { isId } from './codec';
import type { RouteContext } from './context';
import { appKey, appOrigin, type Env } from './env';
import { badRequest, fail, json, notFound, readObject } from './http';
import { verifyOwnGrant } from './own-grants';
import type { Loaded } from './access';

// Watchers told at once, as the workbench close calls its items.
export const SOURCE_SIGNAL_CONCURRENCY = 10;
// A range read waits this long for the sheet app; past it the reader shows its saved values and offers Update.
export const SHEET_DOOR_TIMEOUT_MS = 8_000;

const doorsFor = (env: Env): AppDoors =>
  createAppDoors({
    origin: (app) => appOrigin(env, app),
    key: (app) => appKey(env, app),
    caller: 'index',
    timeoutMs: SHEET_DOOR_TIMEOUT_MS,
  });

// The plan as the person reaches it themselves: their own access (owner, team, or a live link they opened), any
// level. A share code sent with the request, a public (Community) link, an app acting for them, and an item in an app
// with no sheets all answer as missing.
async function ownSource(ctx: RouteContext, id: string): Promise<Loaded | Response> {
  const { person, share } = ctx.caller;
  if (!person || share || person.app || person.drive || person.export) return notFound();
  const loaded = await loadItem(ctx.env, id, ctx.caller, 'view');
  if (loaded instanceof Response) return loaded.status === 403 ? notFound() : loaded;
  if (!isSheetSourceApp(loaded.row.app) || loaded.access.public) return notFound();
  return loaded;
}

// A door's refusal as the index answers it.
function doorRefusal(err: unknown): Response {
  const status = err instanceof DoorError ? err.status : 0;
  if (status === 404) return notFound();
  if (status === 409) return fail(409, 'range_gone');
  if (status === 400) return badRequest('invalid_range');
  console.warn('[index] sheet-range door failed', { status });
  return fail(503, 'source_unavailable');
}

// GET /items/:id/sheets
export async function handleSheetList(ctx: RouteContext, id: string): Promise<Response> {
  if (ctx.request.method !== 'GET') return notFound();
  const loaded = await ownSource(ctx, id);
  if (loaded instanceof Response) return loaded;
  let sheets;
  try {
    sheets = await doorsFor(ctx.env).listSheets(loaded.row.app, id);
  } catch (err) {
    return doorRefusal(err);
  }
  const tab = loaded.access.tabId;
  const answer: SheetList = {
    itemId: id,
    itemName: loaded.row.title,
    sheets: tab ? sheets.filter((s) => s.tabId === tab) : sheets,
  };
  return json(answer);
}

// The reader item that may watch: named in `watch`, proved by its own grant (X-Index-Grant), in a reader app, and
// not reached through a public link. Anything less reads without a watch.
async function watcherOf(ctx: RouteContext, watch: unknown): Promise<string | null> {
  const itemId = (watch as { itemId?: unknown } | null)?.itemId;
  if (!isId(itemId)) return null;
  const grant = await verifyOwnGrant(ctx.env, ctx.request.headers.get(ITEM_GRANT_HEADER));
  if (!grant || grant.item !== itemId || !isSourceWatchApp(grant.app)) return null;
  if (grant.link) {
    const link = await ctx.env.INDEX_DB.prepare('SELECT public FROM share_links WHERE code = ?')
      .bind(grant.link)
      .first<{ public: number }>();
    if (!link || link.public) return null;
  }
  return itemId;
}

// POST /items/:id/sheet-range
export async function handleSheetRange(ctx: RouteContext, id: string): Promise<Response> {
  if (ctx.request.method !== 'POST') return notFound();
  const body = await readObject(ctx.request);
  const ask = readSheetRangeAsk(body);
  if (!ask) return badRequest('invalid_range');
  const loaded = await ownSource(ctx, id);
  if (loaded instanceof Response) return loaded;
  const watcher = await watcherOf(ctx, body?.watch);
  let read;
  try {
    read = await doorsFor(ctx.env).readSheetRange(loaded.row.app, id, { ...ask, watcher });
  } catch (err) {
    return doorRefusal(err);
  }
  // A tab-scoped link reads its own tab's sheets only.
  const tab = loaded.access.tabId;
  if (tab && read.tabId !== tab) return notFound();
  const answer: SheetRangeRead = {
    ...read,
    itemId: id,
    itemName: loaded.row.title,
    sheetId: ask.sheetId,
    readAt: Date.now(),
  };
  return json(answer);
}

const isIdList = (v: unknown, max: number): v is string[] =>
  Array.isArray(v) && v.length > 0 && v.length <= max && v.every(isId);

// POST /app/items/:id/sheet-changed, with the source app's key (`app`, already checked).
export async function handleSheetChanged(
  request: Request,
  env: Env,
  app: App,
  itemId: string,
): Promise<Response> {
  if (request.method !== 'POST') return notFound();
  const item = await env.INDEX_DB.prepare('SELECT app FROM items WHERE id = ?')
    .bind(itemId)
    .first<{ app: App }>();
  if (!item) return notFound();
  if (item.app !== app || !isSheetSourceApp(app)) return fail(403, 'wrong_app');
  const body = await readObject(request);
  const sheetIds = body?.sheetIds;
  const watchers = body?.watchers;
  if (!isIdList(sheetIds, SHEET_CHANGE_SHEETS_MAX) || !isIdList(watchers, SHEET_WATCHERS_MAX)) {
    return badRequest();
  }
  const unique = [...new Set(watchers)];
  const rows = await env.INDEX_DB.prepare(
    'SELECT id, app FROM items WHERE id IN (SELECT value FROM json_each(?))',
  )
    .bind(JSON.stringify(unique))
    .all<{ id: string; app: App }>();
  const told = (rows.results ?? []).filter((r) => isSourceWatchApp(r.app));
  const change: SourceChange = { app, itemId, sheetIds: [...new Set(sheetIds)] };
  await eachLimited(told, SOURCE_SIGNAL_CONCURRENCY, async (row) => {
    const result = await callApp(
      env,
      row.app,
      'POST',
      `/items/${encodeURIComponent(row.id)}/source-changed`,
      change,
    );
    if (!result.ok)
      console.warn('[index] source-changed failed', { app: row.app, error: result.error });
  });
  const reached = new Set(told.map((r) => r.id));
  return json({ gone: unique.filter((w) => !reached.has(w)) });
}
