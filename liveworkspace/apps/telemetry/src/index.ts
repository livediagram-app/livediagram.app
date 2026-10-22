// liveworkspace telemetry (liveworkspace/docs/telemetry.md): one Worker on liveworkspace.app/telemetry
// for every app's anonymous events. It takes batches in, serves the dashboard's numbers, and serves
// the dashboard itself (a static export, under ASSETS). A daily cron keeps 60 days.

import { TELEMETRY_EVENTS_PATH, TELEMETRY_SUMMARY_PATH } from '@liveworkspace/telemetry';
import { deleteEventsBefore } from './db';
import type { Env } from './env';
import { handleIngest } from './ingest';
import { handleSummary } from './summary';

// Everything lives under this path of liveworkspace.app.
export const BASE_PATH = '/telemetry';

const DAY_MS = 86_400_000;
// The dashboard's longest look back is 59 days (the last 30 and the 30 before them).
export const RETENTION_MS = 60 * DAY_MS;

// The ingest is posted to cross-site by every app's pages, as a CORS "simple request" (text/plain, no
// credentials), so it needs no preflight; the header only lets a page read the 204.
const CORS = { 'Access-Control-Allow-Origin': '*' };

// The dashboard's pages get the same defence-in-depth headers as every app's public pages. Set here,
// not in a _headers file, because a Worker serving through the ASSETS binding skips _headers. Both
// apps' Trusted Types policies are named: the dashboard renders both apps' UI.
export const PAGE_HEADERS: Record<string, string> = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy':
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), fullscreen=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Content-Security-Policy':
    "require-trusted-types-for 'script'; trusted-types livediagram-markup livediagram-inert-parse liveplanner-markup liveplanner-inert-parse nextjs default; frame-ancestors 'none'",
};

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== BASE_PATH && !url.pathname.startsWith(`${BASE_PATH}/`)) {
      return new Response('Not found', { status: 404 });
    }
    const path = url.pathname.slice(BASE_PATH.length) || '/';

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
    if (path.startsWith('/api/')) return new Response('Not found', { status: 404 });

    // The dashboard: its export is built with basePath /telemetry, so its files sit at the root of
    // out/ and its pages ask for /telemetry/_next/…; strip the prefix to find them.
    const assetUrl = new URL(url);
    assetUrl.pathname = path;
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

export default worker;
