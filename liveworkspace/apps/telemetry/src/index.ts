// liveworkspace telemetry (liveworkspace/docs/specs/008-telemetry/telemetry.md): one Worker for every app's anonymous
// events. Its API, on liveworkspace.app/api/telemetry, takes batches in and serves the numbers the
// dashboard shows; the dashboard itself is a page of the static site (liveworkspace/apps/site), at
// liveworkspace.app/telemetry. A daily cron keeps 60 days and counts yesterday again.

import { TELEMETRY_EVENTS_PATH, TELEMETRY_SUMMARY_PATH } from '@liveworkspace/telemetry';
import { deleteEventsBefore, recountDay } from './db';
import type { Env } from './env';
import { handleIngest } from './ingest';
import { handleSummary } from './summary';
import { API_PATH, CORS, DAY_MS, RETENTION_MS } from './config';
import { json, under } from '@liveworkspace/index-app/worker-http';
import { guardRequest } from '@liveworkspace/api-kit/request-failure';
import { createApiRouteLabel } from '@liveworkspace/telemetry/error-tokens';

const worker = {
  // One guard for the whole request (liveworkspace/docs/specs/002-architecture/architecture.md "When a request fails").
  fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return guardRequest(
      () => serve(request, env, ctx),
      () => ({ route: routeLabel(request.method, request.url), json: publicJson }),
    );
  },

  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    const now = Date.now();
    ctx.waitUntil(
      deleteEventsBefore(env, now - RETENTION_MS).then(
        ({ events, counts }) =>
          console.info(JSON.stringify({ sweep: 'events', rows: events, counts })),
        (err: unknown) => console.error('events sweep failed', err),
      ),
    );
    // Yesterday, a whole UTC day no batch can still land in.
    ctx.waitUntil(
      recountDay(env, now - (now % DAY_MS) - DAY_MS).then(
        (counts) => console.info(JSON.stringify({ recount: 'yesterday', counts })),
        (err: unknown) => console.error('day recount failed', err),
      ),
    );
  },
};

// The route words a failure is logged under (`Get.Telemetry.Summary`), never anything a caller sent.
const routeLabel = createApiRouteLabel(new Set(['telemetry']), new Set(['events', 'summary']));

// A failure's answer, readable by any page as every answer here is.
function publicJson(body: unknown, init: ResponseInit = {}): Response {
  const res = json(body, init);
  for (const [name, value] of Object.entries(CORS)) res.headers.set(name, value);
  return res;
}

async function serve(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);
  if (under(url.pathname, API_PATH))
    return api(request, env, ctx, url.pathname.slice(API_PATH.length));
  return new Response('Not found', { status: 404 });
}

async function api(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  path: string,
): Promise<Response> {
  if (path === TELEMETRY_EVENTS_PATH) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (request.method !== 'POST')
      return new Response(null, { status: 405, headers: { Allow: 'POST' } });
    const res = await handleIngest(request, env);
    return new Response(null, { status: res.status, headers: CORS });
  }
  if (path === TELEMETRY_SUMMARY_PATH) {
    if (request.method !== 'GET')
      return new Response(null, { status: 405, headers: { Allow: 'GET' } });
    const summary = await handleSummary(request, env, ctx);
    // A copy: an answer from the edge cache has headers that can't be changed.
    const res = new Response(summary.body, summary);
    // Public numbers, so any page may read them.
    res.headers.set('Access-Control-Allow-Origin', '*');
    return res;
  }
  return new Response('Not found', { status: 404 });
}

export default worker;
