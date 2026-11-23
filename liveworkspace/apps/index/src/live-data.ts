// Live data on the index (liveworkspace/docs/specs/004-index/live-data.md, its blueprint): a chart or table in one app
// counting a plan's board cards or showing one of its Dashboard metrics, on the reader's own access, as a sheet range
// is read (sheet-sources.ts, whose access and watch rules this shares).
//
//   GET  /items/:id/plan-data   the plan's boards, metrics and filter values, for a picker
//   POST /items/:id/plan-data   one board's counts or one metric's rows; `watch` (with the reader item's grant) asks
//                               the plan to tell it when its cards change

import { DoorError } from '@liveworkspace/app-doors';
import { readPlanDataAsk, type PlanDataListing, type PlanDataRead } from '@liveworkspace/index-client';
import type { RouteContext } from './context';
import { badRequest, fail, json, notFound, readObject } from './http';
import { doorsFor, ownSource, watcherOf } from './sheet-sources';

// A door's refusal as the index answers it.
function doorRefusal(err: unknown): Response {
  const status = err instanceof DoorError ? err.status : 0;
  if (status === 404) return notFound();
  if (status === 400) return badRequest('invalid_source');
  console.warn('[index] plan-data door failed', { status });
  return fail(503, 'source_unavailable');
}

export async function handlePlanData(ctx: RouteContext, id: string): Promise<Response> {
  const { method } = ctx.request;
  if (method === 'GET') return listPlanData(ctx, id);
  if (method === 'POST') return readPlanData(ctx, id);
  return notFound();
}

async function listPlanData(ctx: RouteContext, id: string): Promise<Response> {
  const loaded = await ownSource(ctx, id);
  if (loaded instanceof Response) return loaded;
  let listing;
  try {
    listing = await doorsFor(ctx.env).listPlanData(loaded.row.app, id);
  } catch (err) {
    return doorRefusal(err);
  }
  // A tab-scoped link lists its own tab's board alone.
  const tab = loaded.access.tabId;
  const answer: PlanDataListing = {
    ...listing,
    boards: tab ? listing.boards.filter((b) => b.tabId === tab) : listing.boards,
    itemId: id,
    itemName: loaded.row.title,
  };
  return json(answer);
}

async function readPlanData(ctx: RouteContext, id: string): Promise<Response> {
  const body = await readObject(ctx.request);
  const ask = readPlanDataAsk(body);
  if (!ask) return badRequest('invalid_source');
  const loaded = await ownSource(ctx, id);
  if (loaded instanceof Response) return loaded;
  const watcher = await watcherOf(ctx, body?.watch);
  let read;
  try {
    read = await doorsFor(ctx.env).readPlanData(loaded.row.app, id, { ...ask, watcher });
  } catch (err) {
    return doorRefusal(err);
  }
  // A tab-scoped link reads its own tab's board only; a metric spans the plan's every board, so it reads none.
  const tab = loaded.access.tabId;
  if (tab && (ask.kind === 'metric' || read.tabId !== tab)) return notFound();
  const answer: PlanDataRead = {
    ...read,
    itemId: id,
    itemName: loaded.row.title,
    kind: ask.kind,
    readAt: Date.now(),
  };
  return json(answer);
}
