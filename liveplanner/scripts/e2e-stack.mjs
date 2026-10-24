#!/usr/bin/env node
// E2E stack (docs/specs/003-system-architecture/e2e-smoke.md): the three-process stack the Playwright smoke suite
// runs against — the real static `apps/editor/out` build served with the
// production router/worker rewrites, the api worker (its Durable Objects local), and liveworkspace's index
// (liveworkspace/apps/index, liveworkspace/docs/one-explorer.md) on its own local D1.
// Dependency-free (node builtins) so it adds nothing to install cost.
//
// Boots:
//   1. index — `wrangler dev --local` (liveworkspace/apps/index) on E2E_INDEX_PORT (8219), its D1 kept apart from
//      a developer's own local index, trusting this stack's accounts stand-in and calling this api.
//   2. api — `wrangler dev --local` (apps/api): plans and workbenches in local Durable Objects.
//   3. live — a static file server for `out/` that reproduces the four
//      things production does (docs/specs/003-system-architecture/e2e-smoke.md): strip the `/live` assetPrefix,
//      rewrite `/project/*` to the single placeholder, forward `/api/index/*` to the index, serve
//      liveworkspace's Explorer at `/explorer` when its site is built, and proxy the rest of
//      `/api/*` (WebSocket upgrades included) to the api worker so the app is same-origin.
//
// Foregrounds both and stays alive; Playwright's webServer waits on the
// live port. SIGINT/SIGTERM tears the whole tree down.

import { spawn } from 'node:child_process';
import { generateKeyPairSync, randomUUID, sign } from 'node:crypto';
import http from 'node:http';
import net from 'node:net';
import {
  cpSync,
  createReadStream,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
// The caching rules production's router applies (docs/specs/016-platform/stale-builds.md), run from
// the same file: type-only TypeScript, which Node runs as is.
import {
  HTML_CACHE_CONTROL,
  IMMUTABLE_CACHE_CONTROL,
  cacheRule,
  isBuildAsset,
} from '../apps/router/src/cache-policy.ts';
import { createTokenStandIn } from '../../packages/auth-client/src/e2e-token-stand-in.ts';
import {
  isWorkspaceFramePath,
  WORKSPACE_FRAME_PAGE,
} from '../apps/editor/lib/workbench/workbench-frame-path.ts';
// Every page enforces Trusted Types in production (docs/specs/016-platform/trusted-types.md), so the suite runs
// against the same header: a violation throws in the page, and the pageErrors fixture fails the spec on it.
import { TRUSTED_TYPES_CSP } from '../packages/ui/src/trusted-types-csp.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// E2E_EDITOR_OUT serves another export of the editor app, e.g. the signed-in `.next/out-signed-in`
// the signed-in specs run against (apps/editor/scripts/build-signed-in.mjs).
const OUT_DIR = path.join(ROOT, 'apps', 'editor', process.env.E2E_EDITOR_OUT ?? 'out');
// The builds a simulated deploy (POST /__e2e/deploy) made: copies whose chunk files carry new
// names, as a real deploy's do. Deploy n is served from deployDirs[n - 1].
const deployDirs = [];
// Production's caching, as a browser meets it (docs/specs/016-platform/stale-builds.md): Cloudflare's
// asset server marks every file `public, max-age=0, must-revalidate` with an ETag, and the router's
// caching rules then make pages `no-store` and build assets immutable. E2E_CACHE_POLICY=off serves
// without the router's rules, as production did before them.
const ASSET_SERVER_CACHE_CONTROL = 'public, max-age=0, must-revalidate';
const CACHE_POLICY = process.env.E2E_CACHE_POLICY !== 'off';
// Set by POST /__e2e/assets-out-of-cache, cleared by the next simulated deploy: build assets go out
// `no-store`, so the browser keeps a page but not its chunks, as a cache that evicted them (or never
// held a lazily loaded one) does.
//
// Both belong to the browser context that asked (a cookie each, which `page.request` shares with
// its page), never to the whole stack: the suite runs in parallel, and a deploy every test saw
// would pull chunks from under pages that never asked for one.
const DEPLOY_COOKIE = 'e2e-deploy';
const OUT_OF_CACHE_COOKIE = 'e2e-assets-out-of-cache';
function cookiesOf(req) {
  const jar = new Map();
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const eq = part.indexOf('=');
    if (eq > 0) jar.set(part.slice(0, eq).trim(), part.slice(eq + 1).trim());
  }
  return jar;
}
// The build this request's browser context is served: its latest simulated deploy, else OUT_DIR.
function buildFor(req) {
  return deployDirs[Number(cookiesOf(req).get(DEPLOY_COOKIE)) - 1] ?? OUT_DIR;
}
function assetsOutOfCacheFor(req) {
  return cookiesOf(req).get(OUT_OF_CACHE_COOKIE) === '1';
}

const EDITOR_PORT = Number(process.env.E2E_EDITOR_PORT ?? 3202);
const API_PORT = Number(process.env.E2E_API_PORT ?? 8289);
const INDEX_PORT = Number(process.env.E2E_INDEX_PORT ?? 8219);
// The key the api and the index share (the api's INDEX_KEY, the index's INDEX_KEY_LIVEPLANNER). Test-only.
const INDEX_KEY = 'e2e-index-key';
const INDEX_DIR = path.resolve(ROOT, '..', 'liveworkspace', 'apps', 'index');
// The index's local D1 for this stack, apart from a developer's `wrangler dev` state.
const INDEX_STATE = path.join(INDEX_DIR, '.wrangler', 'e2e-state');
// liveworkspace's site, whose Explorer production serves at liveplanner's own /explorer (the router's
// workspace routes, @liveworkspace/sites/workspace-proxy): its static export, when built.
const WORKSPACE_SITE_DIR = path.resolve(ROOT, '..', 'liveworkspace', 'apps', 'site', 'out');
// The other sites, for the audits that open them (docs/specs/004-interface-design/blueprints/
// optical-alignment.md, "Ink audit"). Help sits under its basePath on the live origin, as the
// router mounts it; marketing owns "/" in production, so it gets its own port. (The telemetry
// dashboard is liveworkspace's now, liveworkspace/docs/telemetry.md.)
const SITES = [{ prefix: '/help', dir: path.join(ROOT, 'apps', 'help', 'out') }];
const MARKETING_DIR = path.join(ROOT, 'apps', 'marketing', 'out');
const MARKETING_PORT = Number(process.env.E2E_MARKETING_PORT ?? 3203);
// A switch for trying the editor beside a stack that is already up:
//   E2E_EDITOR_ONLY=1  serve the static editor only, proxying to the api
//                    already listening on E2E_API_PORT (no second worker).
const EDITOR_ONLY = process.env.E2E_EDITOR_ONLY === '1';
// The stack always acts as the liveworkspace accounts Worker (docs/specs/003-system-architecture/e2e-smoke.md):
// a key made at boot, its JWKS on the issuer's own path (/e2e/accounts/api/auth/jwks) for the api worker and the
// index to verify against, the guest handoff (/e2e/accounts/api/auth/guest, liveworkspace/docs/accounts.md
// "Guests") answering every visitor a guest token, /e2e/token?sub=<id> minting an access token for any test
// account and /e2e/guest-token minting a guest token, all with the issuer and audience the api expects.
// Test-only: nothing outside this stack trusts the key.
//   E2E_WORKBENCH=1  the workbench embed e2e (docs/specs/013-workspace/blueprints/workbench-embeds.md,
//                    "Testing"): the api builds its workbench and pairing URLs on this live origin
//                    (APP_BASE_URL). The live build must carry NEXT_PUBLIC_E2E_AUTH=1.
const WORKBENCH = process.env.E2E_WORKBENCH === '1';
const accountsKey = generateKeyPairSync('rsa', { modulusLength: 2048 });
const ACCOUNTS_KID = 'e2e-accounts-stub';
// What the api worker is started with (below): its issuer is `${ACCOUNTS_URL}/api/auth`, and the
// audience is its own API_RESOURCE, exactly as against the real accounts Worker.
const ACCOUNTS_PATH = '/e2e/accounts';
// The account's API tokens (made on liveworkspace.app): a spec seeds one at /e2e/accounts/__seed/token, and the api
// checks it through the account API as in production (packages/auth-client e2e-token-stand-in.ts).
const accountTokens = createTokenStandIn(ACCOUNTS_PATH);
const API_RESOURCE = 'https://e2e.liveplanner.test/api';

const b64url = (buf) => Buffer.from(buf).toString('base64url');

function signToken(claims) {
  const header = b64url(JSON.stringify({ alg: 'RS256', kid: ACCOUNTS_KID, typ: 'JWT' }));
  const payload = b64url(JSON.stringify(claims));
  const signature = sign('sha256', Buffer.from(`${header}.${payload}`), accountsKey.privateKey);
  return `${header}.${payload}.${b64url(signature)}`;
}

const ISSUER = `http://127.0.0.1:${EDITOR_PORT}${ACCOUNTS_PATH}/api/auth`;

// An RS256 access token shaped like the accounts Worker's: sub, email (verified), iss, aud.
function mintAccessToken(sub, email) {
  const now = Math.floor(Date.now() / 1000);
  return signToken({
    sub,
    iss: ISSUER,
    aud: API_RESOURCE,
    iat: now,
    nbf: now - 5,
    exp: now + 3600,
    ...(email ? { email, email_verified: true } : {}),
  });
}

// A guest token shaped like the accounts Worker's (liveworkspace/apps/accounts/src/guests.ts): a year long.
const GUEST_TOKEN_TTL_SECONDS = 365 * 24 * 60 * 60;
function mintGuestToken(guestId = `guest_${randomUUID()}`) {
  const now = Math.floor(Date.now() / 1000);
  const token = signToken({
    iss: ISSUER,
    aud: API_RESOURCE,
    sub: guestId,
    kind: 'guest',
    iat: now,
    exp: now + GUEST_TOKEN_TTL_SECONDS,
  });
  return { token, guestId };
}

// Answers the accounts stand-in routes, or returns false for anything else.
function serveAccountsStandIn(pathname, url, res) {
  if (pathname === `${ACCOUNTS_PATH}/api/auth/guest`) {
    // A new guest for every handoff: each browser context is its own visitor, and the app keeps the token.
    const redirectUri = url.searchParams.get('redirect_uri') ?? '';
    const state = url.searchParams.get('state') ?? '';
    if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+\/auth\/guest$/.test(redirectUri)) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('redirect_uri must be this stack');
      return true;
    }
    const fragment = new URLSearchParams({ guest_token: mintGuestToken().token, state });
    res.writeHead(302, { Location: `${redirectUri}#${fragment}`, 'Cache-Control': 'no-store' });
    res.end();
    return true;
  }
  if (pathname === '/e2e/guest-token') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(mintGuestToken()));
    return true;
  }
  if (pathname === `${ACCOUNTS_PATH}/api/auth/jwks`) {
    const jwk = accountsKey.publicKey.export({ format: 'jwk' });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ keys: [{ ...jwk, kid: ACCOUNTS_KID, alg: 'RS256', use: 'sig' }] }));
    return true;
  }
  if (pathname === '/e2e/token') {
    const sub = url.searchParams.get('sub') ?? '';
    if (!/^user_[A-Za-z0-9]+$/.test(sub)) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('sub must look like user_<id>');
      return true;
    }
    res.writeHead(200, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' });
    res.end(mintAccessToken(sub, url.searchParams.get('email') ?? undefined));
    return true;
  }
  return false;
}

const children = [];
function run(cmd, args, opts = {}) {
  const child = spawn(cmd, args, { stdio: 'inherit', ...opts });
  children.push(child);
  return child;
}
function shutdown(code) {
  for (const dir of deployDirs) rmSync(dir, { recursive: true, force: true });
  for (const c of children) {
    try {
      c.kill('SIGTERM');
    } catch {
      // best effort
    }
  }
  process.exit(code ?? 0);
}
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

function waitForExit(child) {
  return new Promise((resolve, reject) => {
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`exit ${code}`))));
    child.on('error', reject);
  });
}

async function waitForPort(port, label, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const ok = await new Promise((resolve) => {
      const req = http.request({ host: '127.0.0.1', port, method: 'HEAD', path: '/' }, (res) => {
        res.resume();
        resolve(true);
      });
      req.on('error', () => resolve(false));
      req.end();
    });
    if (ok) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`${label} did not come up on :${port} within ${timeoutMs}ms`);
}

// --- Static file serving with the production rewrites --------------------
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
  // Cloudflare serves it so; streaming compilation needs it.
  '.wasm': 'application/wasm',
  '.map': 'application/json; charset=utf-8',
};

// What production sends for a response: the asset server's caching, then the router's rules.
function cacheControlFor(req, pathname, status, contentType) {
  if (assetsOutOfCacheFor(req) && isBuildAsset(pathname)) {
    return { cacheControl: 'no-store', missing: false };
  }
  if (!CACHE_POLICY) return { cacheControl: ASSET_SERVER_CACHE_CONTROL, missing: false };
  const rule = cacheRule(pathname, status, contentType);
  if (rule === 'no-store') return { cacheControl: HTML_CACHE_CONTROL, missing: false };
  if (rule === 'immutable') return { cacheControl: IMMUTABLE_CACHE_CONTROL, missing: false };
  if (rule === 'missing-asset') return { cacheControl: HTML_CACHE_CONTROL, missing: true };
  return { cacheControl: ASSET_SERVER_CACHE_CONTROL, missing: false };
}

function serveFile(req, res, filePath, pathname) {
  const ext = path.extname(filePath);
  const contentType = MIME[ext] ?? 'application/octet-stream';
  const { size, mtimeMs } = statSync(filePath);
  const etag = `W/"${size}-${Math.floor(mtimeMs)}"`;
  const headers = {
    'Content-Type': contentType,
    ETag: etag,
    'Cache-Control': cacheControlFor(req, pathname, 200, contentType).cacheControl,
    ...(contentType.startsWith('text/html')
      ? { 'Content-Security-Policy': TRUSTED_TYPES_CSP }
      : {}),
  };
  if (req.headers['if-none-match'] === etag) {
    res.writeHead(304, headers);
    res.end();
    return;
  }
  res.writeHead(200, headers);
  createReadStream(filePath).pipe(res);
}

// A missing file: the site's HTML 404 page, as Cloudflare's `not_found_handling = "404-page"`
// answers, unless the router's rules make a missing build asset a plain-text 404.
function serveNotFound(req, res, pathname, notFoundPage) {
  const html = 'text/html; charset=utf-8';
  const { cacheControl, missing } = cacheControlFor(req, pathname, 404, html);
  if (missing || !notFoundPage || !existsSync(notFoundPage)) {
    res.writeHead(404, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': cacheControl,
      'X-Content-Type-Options': 'nosniff',
    });
    res.end('Not found');
    return;
  }
  res.writeHead(404, {
    'Content-Type': html,
    'Cache-Control': cacheControl,
    'Content-Security-Policy': TRUSTED_TYPES_CSP,
  });
  createReadStream(notFoundPage).pipe(res);
}

// A deploy, simulated: a copy of the build a context is served whose chunk files are renamed,
// every reference to them rewritten, and the copy served to that context from now on. The old
// names are gone for it, exactly as after a real deploy, while a page the browser kept still
// names them.
const TEXT_FILES = new Set(['.html', '.txt', '.js', '.css', '.json', '.map']);
function filesUnder(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) filesUnder(p, out);
    else out.push(p);
  }
  return out;
}
function simulateDeploy(from) {
  const next = mkdtempSync(path.join(tmpdir(), 'liveplanner-e2e-deploy-'));
  const n = deployDirs.push(next);
  cpSync(from, next, { recursive: true });
  const renames = new Map();
  for (const file of filesUnder(path.join(next, '_next', 'static', 'chunks'))) {
    const ext = path.extname(file);
    const name = path.basename(file);
    const renamed = `${name.slice(0, -ext.length)}-d${n}${ext}`;
    renames.set(name, renamed);
    renameSync(file, path.join(path.dirname(file), renamed));
  }
  const escaped = [...renames.keys()].map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = new RegExp(`(?<![A-Za-z0-9_-])(${escaped.join('|')})`, 'g');
  for (const file of filesUnder(next)) {
    if (!TEXT_FILES.has(path.extname(file))) continue;
    const text = readFileSync(file, 'utf8');
    const rewritten = text.replace(pattern, (m) => renames.get(m) ?? m);
    if (rewritten !== text) writeFileSync(file, rewritten);
  }
  console.log(`[e2e] simulated deploy ${n}: ${renames.size} chunks renamed, serving ${next}`);
  return n;
}

// Resolve a request path to a file in out/, mirroring the editor worker
// (apps/editor/src/worker.ts) + the static export's file layout.
function resolveStatic(pathname, out) {
  // The build references assets as `/live/_next/*` (assetPrefix); the
  // files live at out/_next/*.
  let p = pathname.startsWith('/live/') ? pathname.slice('/live'.length) : pathname;
  // /project and everything under it share one placeholder HTML.
  if (p === '/project' || p.startsWith('/project/')) p = '/project/placeholder';
  // So does every form link, /form/<code> (apps/editor/lib/form-path.ts, as the editor worker rewrites it): without this
  // the stack answered a published form's link with the 404 page, so no spec could open one.
  if (p === '/form' || p.startsWith('/form/')) p = '/form/placeholder';
  // So does every place inside a workspace frame, as the editor worker serves them (lib/workbench/workbench-frame-path.ts).
  if (isWorkspaceFramePath(p)) p = WORKSPACE_FRAME_PAGE;
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

// A clean-route static file in `dir`: the exact file, `<p>.html`, or `<p>/index.html`.
function resolveIn(dir, p) {
  for (const c of [
    path.join(dir, p),
    path.join(dir, `${p}.html`),
    path.join(dir, p, 'index.html'),
  ]) {
    if (existsSync(c) && statSync(c).isFile()) return c;
  }
  return null;
}

// The router's workspace routes (@liveworkspace/sites/workspace-proxy): the Explorer is liveworkspace's page, shown
// at liveplanner's own /explorer with the address unchanged, its build assets under /_liveworkspace. Served from
// the site's static export when it is built; otherwise a logged 404, so only the specs that open the Explorer page
// need the build.
const isWorkspacePath = (pathname) =>
  pathname === '/explorer' ||
  pathname.startsWith('/explorer/') ||
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
  if (file) return serveFile(req, res, file, pathname);
  serveNotFound(req, res, pathname, path.join(WORKSPACE_SITE_DIR, '404.html'));
}

// The router's forward (apps/router/src/index.ts): `/api/index/*` is the index's, the same request at its origin
// minus this site's cookies.
const isIndexPath = (pathname) => pathname === '/api/index' || pathname.startsWith('/api/index/');

function proxyApi(req, res) {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const toIndex = isIndexPath(pathname);
  const headers = { ...req.headers };
  if (toIndex) {
    delete headers.cookie;
    headers.host = `127.0.0.1:${INDEX_PORT}`;
  }
  const proxyReq = http.request(
    {
      host: '127.0.0.1',
      port: toIndex ? INDEX_PORT : API_PORT,
      method: req.method,
      path: req.url,
      headers,
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
      proxyRes.pipe(res);
    },
  );
  proxyReq.on('error', () => {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: toIndex ? 'index_unreachable' : 'api_unreachable' }));
  });
  req.pipe(proxyReq);
}

// The realtime room is a WebSocket on /api/projects/<id>/ws. Production routes
// the upgrade through the router like any other /api request; without this the
// browser's socket was never answered here, so no e2e test could see a room op.
// Relays the raw upgrade to the api worker and pipes both directions.
function proxyApiUpgrade(req, socket, head) {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (!pathname.startsWith('/api/')) {
    socket.destroy();
    return;
  }
  const upstream = net.connect(API_PORT, '127.0.0.1', () => {
    const headerLines = [];
    for (let i = 0; i < req.rawHeaders.length; i += 2) {
      headerLines.push(`${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}`);
    }
    upstream.write(
      `${req.method} ${req.url} HTTP/${req.httpVersion}\r\n${headerLines.join('\r\n')}\r\n\r\n`,
    );
    if (head.length > 0) upstream.write(head);
    socket.pipe(upstream).pipe(socket);
  });
  upstream.on('error', () => socket.destroy());
  socket.on('error', () => upstream.destroy());
}

function startLiveServer() {
  const server = http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const liveOut = buildFor(req);
    if (accountTokens.serve(req, res, pathname)) return;
    if (serveAccountsStandIn(pathname, new URL(req.url, 'http://localhost'), res)) return;
    if (pathname === '/__e2e/assets-out-of-cache' && req.method === 'POST') {
      res.writeHead(204, {
        'Cache-Control': 'no-store',
        'Set-Cookie': `${OUT_OF_CACHE_COOKIE}=1; Path=/; SameSite=Lax`,
      });
      res.end();
      return;
    }
    if (pathname === '/__e2e/deploy' && req.method === 'POST') {
      const deploy = simulateDeploy(liveOut);
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'Set-Cookie': [
          `${DEPLOY_COOKIE}=${deploy}; Path=/; SameSite=Lax`,
          `${OUT_OF_CACHE_COOKIE}=; Path=/; SameSite=Lax; Max-Age=0`,
        ],
      });
      res.end(JSON.stringify({ deploy }));
      return;
    }
    if (pathname === '/api' || pathname.startsWith('/api/')) return proxyApi(req, res);
    if (isWorkspacePath(pathname)) return serveWorkspace(req, res, pathname);
    // Cloudflare's assets layer (`html_handling` defaults to
    // "auto-trailing-slash") answers `/new/` — whose file is `new.html`, not
    // `new/index.html` — with a redirect to `/new`, query intact. Without
    // this the stack answered 404, the page recovered client-side without its
    // query string, and `?truth=1` typed on `/new/` armed nothing.
    const bare = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : null;
    if (bare && !bare.startsWith('/project') && existsSync(path.join(liveOut, `${bare}.html`))) {
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
      `[e2e] ${OUT_DIR} missing — run \`pnpm --filter @liveplanner/editor build\` first`,
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
      // Everything it trusts and calls is this stack, never what a developer's .dev.vars names.
      '--var',
      'ENVIRONMENT:development',
      '--var',
      `ACCOUNTS_URL:http://127.0.0.1:${EDITOR_PORT}${ACCOUNTS_PATH}`,
      '--var',
      `INDEX_AUDIENCES:${API_RESOURCE}`,
      '--var',
      `INDEX_KEY_LIVEPLANNER:${INDEX_KEY}`,
      '--var',
      `APP_ORIGIN_LIVEPLANNER:http://127.0.0.1:${API_PORT}`,
      '--var',
      'MERGE_KEY:e2e-merge-key',
    ],
    { cwd: INDEX_DIR },
  );
  console.log('[e2e] starting api worker…');
  run(
    'pnpm',
    [
      '--filter',
      '@liveplanner/api',
      'exec',
      'wrangler',
      'dev',
      '--local',
      '--port',
      String(API_PORT),
      // Verify access and guest tokens against the stack's own key, and reach the stack's index, never a real
      // accounts Worker or index a developer's .dev.vars may name. The client id and secret only turn the guest
      // handoff on; the stand-in checks neither.
      '--var',
      `ACCOUNTS_URL:http://127.0.0.1:${EDITOR_PORT}${ACCOUNTS_PATH}`,
      '--var',
      `API_RESOURCE:${API_RESOURCE}`,
      '--var',
      'ACCOUNTS_CLIENT_ID:liveplanner-e2e',
      '--var',
      'ACCOUNTS_CLIENT_SECRET:e2e-client-secret',
      '--var',
      `AUTH_ORIGIN:http://localhost:${EDITOR_PORT}`,
      '--var',
      `INDEX_ORIGIN:http://127.0.0.1:${INDEX_PORT}`,
      '--var',
      `INDEX_KEY:${INDEX_KEY}`,
      ...(WORKBENCH ? ['--var', `APP_BASE_URL:http://localhost:${EDITOR_PORT}`] : []),
    ],
    {
      cwd: ROOT,
    },
  );
  await waitForPort(INDEX_PORT, 'index');
  await waitForPort(API_PORT, 'api worker');
  console.log('[e2e] api worker up; starting live static server…');
  startLiveServer();
}

main().catch((err) => {
  console.error('[e2e] stack failed:', err);
  shutdown(1);
});
