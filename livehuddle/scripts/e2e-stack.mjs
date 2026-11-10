#!/usr/bin/env node
// E2E stack (docs/specs/003-system-architecture/e2e-smoke.md): the four-process stack the Playwright smoke suite
// runs against — the real static `apps/editor/out` build served with the
// production router/worker rewrites, the api worker with local Durable Objects, and liveworkspace's index
// (liveworkspace/apps/index, liveworkspace/docs/specs/004-index/one-explorer.md) on its own local D1.
// Dependency-free (node builtins) so it adds nothing to install cost.
//
// Boots:
//   1. index — `wrangler dev --local` (liveworkspace/apps/index) on E2E_INDEX_PORT (8119), its D1 kept apart from
//      a developer's own local index, trusting this stack's accounts stand-in and calling this api.
//   2. media — liveworkspace's media service (liveworkspace/apps/media, its scripts/e2e-media.mjs) under
//      `wrangler dev --local` on E2E_MEDIA_PORT (8120), its D1 and R2 fresh each run, so uploads and the gallery
//      run end to end.
//   3. api — `wrangler dev --local` (apps/api): each canvas's content in its own local Durable Object, its images
//      in the stack's media.
//   4. live — a static file server for `out/` that reproduces what production
//      does (docs/specs/003-system-architecture/e2e-smoke.md): strip the `/live` assetPrefix,
//      rewrite `/document/*` to the single placeholder, forward `/api/index/*` to the index and
//      `/api/previews/*` to media, serve
//      liveworkspace's Explorer at `/explorer` when its site is built, and proxy the rest of
//      `/api/*` (WebSocket upgrades included) to the api worker so the app is same-origin.
//
// Foregrounds both and stays alive; Playwright's webServer waits on the
// live port. SIGINT/SIGTERM tears the whole tree down.

import { existsSync, readFileSync, rmSync, statSync } from 'node:fs';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
// The parts every product's stack shares, at the monorepo's root.
import { createAccountsStandIn } from '../../scripts/e2e-stack/accounts-stand-in.mjs';
import { run, shutdown, waitForExit, waitForPort } from '../../scripts/e2e-stack/processes.mjs';
import { createProxies } from '../../scripts/e2e-stack/proxies.mjs';
import { createStaticServing } from '../../scripts/e2e-stack/static-serving.mjs';
// Every page enforces Trusted Types in production (docs/specs/016-platform/trusted-types.md), so the suite runs
// against the same header: a violation throws in the page, and the pageErrors fixture fails the spec on it.
import { TRUSTED_TYPES_CSP } from '../packages/ui/src/trusted-types-csp.ts';
// The media service's stand-in boot, shared by the products' stacks (liveworkspace/apps/media/scripts/e2e-media.mjs).
import {
  e2eMediaKey,
  MEDIA_DIR,
  startE2EMedia,
} from '../../liveworkspace/apps/media/scripts/e2e-media.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// E2E_EDITOR_OUT serves another export of the editor app, e.g. the signed-in `.next/out-signed-in`
// the signed-in specs run against (apps/editor/scripts/build-signed-in.mjs).
const OUT_DIR = path.join(ROOT, 'apps', 'editor', process.env.E2E_EDITOR_OUT ?? 'out');
// Served with production's caching and Trusted Types header, and a simulated deploy per browser context
// (scripts/e2e-stack/static-serving.mjs at the monorepo's root, shared with the other stacks).
const { buildFor, serveFile, serveNotFound, resolveIn, serveE2eControls, cacheControlFor } =
  createStaticServing({ outDir: OUT_DIR, csp: TRUSTED_TYPES_CSP, product: 'livehuddle' });

const EDITOR_PORT = Number(process.env.E2E_EDITOR_PORT ?? 3502);
const API_PORT = Number(process.env.E2E_API_PORT ?? 9087);
const INDEX_PORT = Number(process.env.E2E_INDEX_PORT ?? 8119);
const MEDIA_PORT = Number(process.env.E2E_MEDIA_PORT ?? 8120);
// The media service's local D1 and R2 for this stack, apart from a developer's `wrangler dev` state.
const MEDIA_STATE = path.join(MEDIA_DIR, '.wrangler', `e2e-state-${MEDIA_PORT}`);
const MEDIA_APP = 'livehuddle.app';
// The key the api and the index share (the api's INDEX_KEY, the index's INDEX_KEY_LIVEHUDDLE). Test-only.
const INDEX_KEY = 'e2e-index-key';
// Accounts' key at the index (its MERGE_KEY): what the index's "teams as they are now" call carries to the
// stand-in (POST /api/account/index/teams). Test-only.
const MERGE_KEY = 'e2e-merge-key';
const INDEX_DIR = path.resolve(ROOT, '..', 'liveworkspace', 'apps', 'index');
// The index's local D1 for this stack, apart from a developer's `wrangler dev` state.
const INDEX_STATE = path.join(INDEX_DIR, '.wrangler', 'e2e-state');
// The stack's own wrangler dev registry, so a service binding (media's INDEX) reaches this stack's Workers, never a
// developer's or another stack's registered under the same name. Every wrangler the stack starts inherits it. Fresh
// each run: a previous run's entries point at Workers that are gone, and a binding to one loses its connection.
const WRANGLER_REGISTRY = path.join(INDEX_DIR, '.wrangler', `e2e-registry-${MEDIA_PORT}`);
rmSync(WRANGLER_REGISTRY, { recursive: true, force: true });
process.env.WRANGLER_REGISTRY_PATH = WRANGLER_REGISTRY;
// liveworkspace's site, whose Explorer production serves at livehuddle's own /explorer (the router's
// routeToWorkspace, @liveworkspace/sites/workspace-proxy): its static export, when built.
// E2E_WORKSPACE_SITE_OUT serves another export of it: the signed-in specs' `.next/out-e2e`
// (liveworkspace/apps/site/scripts/build-e2e.mjs), which reads the specs' session as the editor's signed-in build does.
const WORKSPACE_SITE_DIR = path.resolve(
  ROOT,
  '..',
  'liveworkspace',
  'apps',
  'site',
  process.env.E2E_WORKSPACE_SITE_OUT ?? 'out',
);
// The other sites, for the audits that open them (docs/specs/004-interface-design/blueprints/
// optical-alignment.md, "Ink audit"). Help sits under its basePath on the live origin, as the router mounts it
// (the Community is liveworkspace's page, served with the Explorer below); marketing owns "/" in production, so it
// gets its own port.
const SITES = [{ prefix: '/help', dir: path.join(ROOT, 'apps', 'help', 'out') }];
const MARKETING_DIR = path.join(ROOT, 'apps', 'marketing', 'out');
const MARKETING_PORT = Number(process.env.E2E_MARKETING_PORT ?? 3513);
// A switch for trying the editor beside a stack that is already up:
//   E2E_EDITOR_ONLY=1  serve the static editor only, proxying to the api
//                    already listening on E2E_API_PORT (no second worker).
const EDITOR_ONLY = process.env.E2E_EDITOR_ONLY === '1';
//   The accounts stand-in: the stack acts as the liveworkspace accounts Worker, always, and the api and the
//                    index both trust it: the api keeps no settings or profiles of its own, and the index
//                    lets in only tokens an accounts it trusts signed. For the signed-in specs
//                    (docs/specs/003-system-architecture/e2e-smoke.md): a key made at boot, its JWKS
//                    on the issuer's own path (/e2e/accounts/api/auth/jwks) for the api worker to
//                    verify against, the guest handoff (/e2e/accounts/api/auth/guest) answering every
//                    visitor a guest token (docs/specs/014-identity/auth-and-guest-access.md),
//                    /e2e/token?sub=<id> minting an access token for any test account, with its teams
//                    claim, and /e2e/guest-token minting a guest token, all with the issuer and audience
//                    the api expects.
//                    It also answers the account API the api calls with its client credentials
//                    (/api/account/internal: settings, profiles, sightings, milestones, emails,
//                    activity, making a team, the teams change feed and the API token routes) from
//                    its own records, which the signed-in specs fill through /e2e/accounts/__seed/*
//                    (e2e/accounts-stub.ts). Test-only: nothing outside this stack trusts the key
//                    or the records.
// The audience the api is started with (below), as against the real accounts Worker.
const API_RESOURCE = 'https://e2e.livehuddle.test/api';
// The accounts stand-in (scripts/e2e-stack/accounts-stand-in.mjs at the monorepo's root, shared with the other
// stacks): the origin the api and the index both trust, on this live origin, and the client the api is started with.
const { ACCOUNTS_ORIGIN, ACCOUNTS_CLIENT, serveAccountsStandIn } = createAccountsStandIn({
  editorPort: EDITOR_PORT,
  apiResource: API_RESOURCE,
  clientId: 'e2e-livehuddle',
  mergeKey: MERGE_KEY,
});
const { proxyApi, proxyApiUpgrade } = createProxies({
  apiPort: API_PORT,
  indexPort: INDEX_PORT,
  mediaPort: MEDIA_PORT,
});

// Resolve a request path to a file in out/, mirroring the editor worker
// (apps/editor/src/worker.ts) + the static export's file layout.
function resolveStatic(pathname, out) {
  // The build references assets as `/live/_next/*` (assetPrefix); the
  // files live at out/_next/*.
  let p = pathname.startsWith('/live/') ? pathname.slice('/live'.length) : pathname;
  // /document and everything under it share one placeholder HTML.
  if (p === '/document' || p.startsWith('/document/')) p = '/document/placeholder';
  // So does every form link, /form/<code> (apps/editor/lib/form-path.ts, as the editor worker rewrites it): without this
  // the stack answered a published form's link with the 404 page, so no spec could open one.
  if (p === '/form' || p.startsWith('/form/')) p = '/form/placeholder';
  if (p === '/') p = '/index';
  const candidates = [
    path.join(out, p), // exact file (assets)
    path.join(out, `${p}.html`), // clean route → new.html
    path.join(out, p, 'index.html'),
  ];
  for (const c of candidates) {
    if (existsSync(c) && statSync(c).isFile()) return c;
  }
  return null;
}

// A basePath site's file for a request under its prefix, or null. A missing build is not an
// error here: only the audits need these sites, and they fail loudly on the 404.
function resolveSite(pathname) {
  for (const site of SITES) {
    if (pathname !== site.prefix && !pathname.startsWith(`${site.prefix}/`)) continue;
    const p = pathname.slice(site.prefix.length) || '/';
    return resolveIn(site.dir, p === '/' ? '/index' : p) ?? { notFound: site.dir };
  }
  return null;
}

// The router's routeToWorkspace (@liveworkspace/sites/workspace-proxy): the Explorer and the Community are
// liveworkspace's pages, shown at livehuddle's own /explorer and /community with the address unchanged, their build
// assets under /_liveworkspace. Served from the site's static export when it is built; otherwise a logged 404, so
// only the specs that open those pages need the build.
const isWorkspacePath = (pathname) =>
  pathname === '/explorer' ||
  pathname.startsWith('/explorer/') ||
  pathname === '/community' ||
  pathname.startsWith('/community/') ||
  pathname.startsWith('/_liveworkspace/');

function serveWorkspace(req, res, pathname) {
  if (!existsSync(WORKSPACE_SITE_DIR)) {
    console.warn(`[e2e] ${pathname}: liveworkspace's site is not built (${WORKSPACE_SITE_DIR})`);
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(`Not built: ${WORKSPACE_SITE_DIR}`);
    return;
  }
  // The export's own layout: each Explorer view a page of its own, its assets under out/_liveworkspace.
  const p = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  const file = resolveIn(WORKSPACE_SITE_DIR, p);
  if (file && path.extname(file) === '.html') return serveWorkspacePage(req, res, file, pathname);
  if (file) return serveFile(req, res, file, pathname);
  serveNotFound(req, res, pathname, path.join(WORKSPACE_SITE_DIR, '404.html'));
}

// An Explorer page names the app it is shown for (liveworkspace/docs/specs/004-index/one-explorer.md "The Explorer on
// each app's address"): locally the page otherwise reads the app from the port's block, and this stack runs on
// whatever ports it is given (an agent's block, a CI runner's), so it says livehuddle outright.
const APP_META = '<meta name="liveworkspace-app" content="livehuddle">';
function serveWorkspacePage(req, res, filePath, pathname) {
  const html = readFileSync(filePath, 'utf8').replace(/<head>/i, `<head>${APP_META}`);
  const { size, mtimeMs } = statSync(filePath);
  const etag = `W/"${size}-${Math.floor(mtimeMs)}-app"`;
  const headers = {
    'Content-Type': 'text/html; charset=utf-8',
    ETag: etag,
    'Cache-Control': cacheControlFor(req, pathname, 200, 'text/html; charset=utf-8').cacheControl,
    'Content-Security-Policy': TRUSTED_TYPES_CSP,
  };
  if (req.headers['if-none-match'] === etag) {
    res.writeHead(304, headers);
    res.end();
    return;
  }
  res.writeHead(200, headers);
  res.end(html);
}

function startLiveServer() {
  const server = http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const liveOut = buildFor(req);
    if (serveAccountsStandIn(req, pathname, new URL(req.url, 'http://localhost'), res)) return;
    if (serveE2eControls(req, res, pathname, liveOut)) return;
    if (pathname === '/api' || pathname.startsWith('/api/')) return proxyApi(req, res);
    if (isWorkspacePath(pathname)) return serveWorkspace(req, res, pathname);
    // Cloudflare's assets layer (`html_handling` defaults to
    // "auto-trailing-slash") answers `/new/` — whose file is `new.html`, not
    // `new/index.html` — with a redirect to `/new`, query intact. Without
    // this the stack answered 404, the page recovered client-side without its
    // query string, and `?truth=1` typed on `/new/` armed nothing.
    const bare = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : null;
    if (bare && !bare.startsWith('/document') && existsSync(path.join(liveOut, `${bare}.html`))) {
      const search = new URL(req.url, 'http://localhost').search;
      res.writeHead(307, { Location: `${bare}${search}` });
      res.end();
      return;
    }
    const site = resolveSite(pathname);
    if (typeof site === 'string') return serveFile(req, res, site, pathname);
    if (site) {
      console.warn(`[e2e] ${pathname}: no build at ${site.notFound}`);
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(`Not built: ${site.notFound}`);
      return;
    }
    const file = resolveStatic(pathname, liveOut);
    if (file) return serveFile(req, res, file, pathname);
    serveNotFound(req, res, pathname, path.join(liveOut, '404.html'));
  });
  server.on('upgrade', proxyApiUpgrade);
  server.listen(EDITOR_PORT, () => console.log(`[e2e] live static server on :${EDITOR_PORT}`));
  startMarketingServer();
}

// Marketing on its own port, clean routes, the same caching as production. Absent build: a logged 404.
function startMarketingServer() {
  if (!existsSync(MARKETING_DIR)) {
    console.warn(`[e2e] marketing not built (${MARKETING_DIR}); :${MARKETING_PORT} answers 404`);
  }
  const server = http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const p = pathname === '/' ? '/index' : pathname.replace(/\/$/, '');
    const file = existsSync(MARKETING_DIR) ? resolveIn(MARKETING_DIR, p) : null;
    if (file) return serveFile(req, res, file, pathname);
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(existsSync(MARKETING_DIR) ? 'Not found' : `Not built: ${MARKETING_DIR}`);
  });
  server.listen(MARKETING_PORT, () =>
    console.log(`[e2e] marketing static server on :${MARKETING_PORT}`),
  );
}

// --- Boot ---------------------------------------------------------------
async function main() {
  if (!existsSync(OUT_DIR)) {
    console.error(
      `[e2e] ${OUT_DIR} missing — run \`pnpm --filter @livehuddle/editor build\` first`,
    );
    process.exit(1);
  }
  if (EDITOR_ONLY) {
    console.log(`[e2e] static editor only, proxying to the api on :${API_PORT}`);
    startLiveServer();
    return;
  }
  if (!existsSync(WORKSPACE_SITE_DIR)) {
    console.warn(
      `[e2e] liveworkspace's site is not built (${WORKSPACE_SITE_DIR}): /explorer answers 404 until it is`,
    );
  }
  console.log('[e2e] applying the index local D1 migrations…');
  rmSync(INDEX_STATE, { recursive: true, force: true });
  await waitForExit(
    run(
      'pnpm',
      [
        'exec',
        'wrangler',
        'd1',
        'migrations',
        'apply',
        'liveworkspace-index',
        '--local',
        '--persist-to',
        INDEX_STATE,
      ],
      { cwd: INDEX_DIR },
    ),
  );
  console.log('[e2e] starting the index…');
  run(
    'pnpm',
    [
      'exec',
      'wrangler',
      'dev',
      '--local',
      '--port',
      String(INDEX_PORT),
      '--inspector-port',
      String(INDEX_PORT + 1000),
      '--persist-to',
      INDEX_STATE,
      // Everything it trusts and calls is this stack, never what a developer's .dev.vars names: the accounts the
      // api trusts (the stand-in), this api's audience and key, and this api's origin.
      '--var',
      'ENVIRONMENT:development',
      '--var',
      `ACCOUNTS_URL:${ACCOUNTS_ORIGIN}`,
      '--var',
      `INDEX_AUDIENCES:${API_RESOURCE}`,
      '--var',
      `INDEX_KEY_LIVEHUDDLE:${INDEX_KEY}`,
      '--var',
      `APP_ORIGIN_LIVEHUDDLE:http://127.0.0.1:${API_PORT}`,
      '--var',
      `MERGE_KEY:${MERGE_KEY}`,
    ],
    { cwd: INDEX_DIR },
  );
  const mediaUrl = await startE2EMedia({
    run,
    waitForExit,
    port: MEDIA_PORT,
    state: MEDIA_STATE,
    apps: [MEDIA_APP],
    // Previews end to end: the stack's index decides who sees one, this api's export door draws it.
    indexUrl: `http://127.0.0.1:${INDEX_PORT}/api/index`,
    appOrigins: { [MEDIA_APP]: `http://127.0.0.1:${API_PORT}` },
  });
  console.log('[e2e] starting api worker…');
  run(
    'pnpm',
    [
      '--filter',
      '@livehuddle/api',
      'exec',
      'wrangler',
      'dev',
      '--local',
      '--port',
      String(API_PORT),
      // Verify access and guest tokens against the stack's own key (the accounts stand-in above), never a
      // real accounts Worker a developer's .dev.vars may name. The client id and secret also turn the
      // guest handoff (/api/auth/guest) on, to the stand-in's.
      '--var',
      `ACCOUNTS_URL:${ACCOUNTS_ORIGIN}`,
      '--var',
      `API_RESOURCE:${API_RESOURCE}`,
      '--var',
      `ACCOUNTS_CLIENT_ID:${ACCOUNTS_CLIENT.id}`,
      '--var',
      `ACCOUNTS_CLIENT_SECRET:${ACCOUNTS_CLIENT.secret}`,
      // The guest handoff comes back to this stack's editor, never the router a developer's .dev.vars names.
      '--var',
      `AUTH_ORIGIN:http://localhost:${EDITOR_PORT}`,
      // The stack's index, never one a developer's .dev.vars names.
      '--var',
      `INDEX_ORIGIN:http://127.0.0.1:${INDEX_PORT}`,
      '--var',
      `INDEX_KEY:${INDEX_KEY}`,
      // The stack's media, never one a developer's .dev.vars names.
      '--var',
      `MEDIA_URL:${mediaUrl}`,
      '--var',
      `MEDIA_KEY:${e2eMediaKey(MEDIA_APP)}`,
      // More vars for the api, space-separated `KEY:value` pairs: E2E_API_VARS="REALTIME_APP_ID:x …" turns on
      // what a stack has no secrets for, such as proximity audio's calls (docs/specs/012-collaboration/proximity-audio.md).
      ...(process.env.E2E_API_VARS ?? '')
        .split(/\s+/)
        .filter(Boolean)
        .flatMap((v) => ['--var', v]),
    ],
    {
      cwd: ROOT,
    },
  );
  await waitForPort(INDEX_PORT, 'index');
  await waitForPort(MEDIA_PORT, 'media');
  await waitForPort(API_PORT, 'api worker');
  console.log('[e2e] api worker up; starting live static server…');
  startLiveServer();
}

main().catch((err) => {
  console.error('[e2e] stack failed:', err);
  shutdown(1);
});
