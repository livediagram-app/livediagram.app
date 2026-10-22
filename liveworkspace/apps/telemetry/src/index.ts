// liveworkspace telemetry (liveworkspace/docs/telemetry.md): one Worker for every app's anonymous
// events. Its API, on liveworkspace.app/api/telemetry, takes batches in and serves the dashboard's
// numbers; the dashboard itself (a static export, under ASSETS) is liveworkspace.app/telemetry. A
// daily cron keeps 60 days.

import { TELEMETRY_EVENTS_PATH, TELEMETRY_SUMMARY_PATH } from '@liveworkspace/telemetry';
import { deleteEventsBefore } from './db';
import type { Env } from './env';
import { handleIngest } from './ingest';
import { handleSummary } from './summary';
import { API_PATH, CORS, DASHBOARD_PATH, PAGE_HEADERS, RETENTION_MS } from './config';

const under = (pathname: string, base: string) =>
  pathname === base || pathname.startsWith(`${base}/`);

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (under(url.pathname, API_PATH))
      return api(request, env, ctx, url.pathname.slice(API_PATH.length));
    if (!under(url.pathname, DASHBOARD_PATH)) return new Response('Not found', { status: 404 });

    // The dashboard: its export is built with basePath /telemetry, so its files sit at the root of
    // out/ and its pages ask for /telemetry/_next/…; strip the prefix to find them.
    const assetUrl = new URL(url);
    assetUrl.pathname = url.pathname.slice(DASHBOARD_PATH.length) || '/';
    const asset = await env.ASSETS.fetch(new Request(assetUrl, request));
    const res = new Response(asset.body, asset);
    for (const [name, value] of Object.entries(PAGE_HEADERS)) res.headers.set(name, value);
    return res;
  },

  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      deleteEventsBefore(env, Date.now() - RETENTION_MS).then(
        (rows) => console.log(JSON.stringify({ sweep: 'events', rows })),
        (err: unknown) => console.error('events sweep failed', err),
      ),
    );
  },
};

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
    const res = await handleSummary(request, env, ctx);
    // Public numbers: a local dashboard on another port may read them too.
    res.headers.set('Access-Control-Allow-Origin', '*');
    return res;
  }
  return new Response('Not found', { status: 404 });
}

export default worker;
